"""
Build Phase1Report (small JSON) from metrics + metadata.
Uses: analytics/movement, analytics/heatmap, utils/io, domain/report_contract
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from src.domain.report_contract import empty_report
from src.utils.io import read_json, write_json_atomic


def build_phase1_report(
    match: dict,
    *,
    video_meta: dict,
    tracks_path: Optional[Path] = None,
    calib_path: Optional[Path] = None,
    out_dir: Path,
    detection_only: bool = False,
) -> Path:
    """Build report.json from video meta and tracks. Fills summary, players, and heatmap from tracks.
    When detection_only is True, report includes tracking_mode so UI can show that P1–P4 are by position per frame."""
    report_dict = empty_report(
        match_id=match["match_id"],
        court_id=match["court_id"],
        video_meta=video_meta,
    )
    reports_dir = out_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_path = reports_dir / "report.json"

    report_dict["tracking_mode"] = "detection_only" if detection_only else "tracking"

    tracks: list = []
    if tracks_path and tracks_path.exists():
        raw = read_json(tracks_path)
        if isinstance(raw, list):
            tracks = raw

    if tracks:
        from src.analytics.movement import compute_movement_metrics, intensity_timeline
        from src.analytics.heatmap import build_heatmap
        from src.analytics.padel import PadelAnalytics

        fps_meta = float(video_meta.get("fps", 30) or 30)
        metrics = compute_movement_metrics(tracks, fps=fps_meta)
        report_dict["summary"] = {**report_dict["summary"], **metrics["summary"]}
        report_dict["players"] = metrics["players"]
        report_dict["status"] = "computed"

        # Add rank and share of distance for dashboard
        total_dist = report_dict["summary"].get("total_distance") or 0.0
        players_list = [
            (pid, report_dict["players"][pid].get("distance") or 0.0)
            for pid in report_dict["players"]
        ]
        players_list.sort(key=lambda x: -x[1])  # highest distance first
        for rank, (pid, dist) in enumerate(players_list, start=1):
            report_dict["players"][pid]["rank_by_distance"] = rank
            report_dict["players"][pid]["share_of_distance_pct"] = (
                round(100.0 * dist / total_dist, 1) if total_dist > 0 else 0.0
            )
        # One-line insight for dashboard hero
        n = report_dict["summary"].get("num_players") or 0
        d_s = report_dict["summary"].get("total_duration_s") or 0
        report_dict["summary"]["insight"] = (
            f"{n} players · {total_dist:.0f} m total · {d_s:.0f} s active"
            + (
                f" · Most active: P{players_list[0][0]} ({players_list[0][1]:.0f} m)"
                if players_list else ""
            )
        )

        # Combined heatmap + per-player heatmaps
        heatmap_path = reports_dir / "heatmap.png"
        build_heatmap(tracks, heatmap_path)
        analytics_heatmaps: dict = {"heatmap_path": str(heatmap_path)}
        for pid in report_dict["players"]:
            player_tracks = [t for t in tracks if str(t.get("player_id")) == str(pid)]
            if player_tracks:
                p_path = reports_dir / f"heatmap_player_{pid}.png"
                build_heatmap(player_tracks, p_path)
                analytics_heatmaps[f"heatmap_player_{pid}"] = str(p_path)
        from src.analytics.spatial import compute_zone_coverage, compute_net_baseline_pct, compute_team_spacing
        zone_coverage = compute_zone_coverage(tracks)
        net_baseline = compute_net_baseline_pct(tracks)
        for pid in report_dict["players"]:
            report_dict["players"][pid]["zone_coverage_pct"] = zone_coverage.get(pid, {})
            report_dict["players"][pid]["net_pct"] = net_baseline.get(pid, {}).get("net_pct", 0.0)
            report_dict["players"][pid]["baseline_pct"] = net_baseline.get(pid, {}).get("baseline_pct", 0.0)
        analytics_heatmaps["team_spacing_m"] = compute_team_spacing(tracks)
        report_dict["analytics"] = analytics_heatmaps

        # Motion-based highlights: top intensity windows
        duration_s = float(video_meta.get("duration_seconds", 0))
        if duration_s > 0 and fps_meta > 0:
            timeline = intensity_timeline(tracks, window_s=12.0, fps=fps_meta)
            if timeline:
                sorted_windows = sorted(timeline, key=lambda w: -w["intensity"])
                max_highlights = 10
                clip_len_s = 12.0
                report_dict["highlights"] = []
                for w in sorted_windows[:max_highlights]:
                    start = max(0.0, w["start_s"])
                    end = min(start + clip_len_s, duration_s)
                    if end > start:
                        report_dict["highlights"].append({
                            "start": round(start, 1),
                            "end": round(end, 1),
                            "reason": "high_intensity",
                        })

        duration_s = float(video_meta.get("duration_seconds", 0))
        num_frames = int(duration_s * fps_meta) if duration_s > 0 and fps_meta > 0 else max((t.get("frame", 0) for t in tracks), default=0)
        fps = fps_meta
        padel = PadelAnalytics().run_from_tracks(tracks, num_frames=num_frames, fps=fps)
        report_dict["padel"] = {
            "rally_metrics": padel["rally_metrics"],
            "shot_speeds": padel["shot_speeds"],
            "wall_usage": padel["wall_usage"],
            "player_stats_sample": padel["player_stats_data"][:5] if padel["player_stats_data"] else [],
        }
    else:
        report_dict["summary"]["total_track_points"] = 0
        report_dict["summary"]["num_players"] = 0
        report_dict["summary"]["total_distance"] = 0.0
        report_dict["summary"]["total_duration_s"] = 0.0
        report_dict["summary"]["insight"] = "No track data — run detection to see analytics."
        report_dict["analytics"] = {}
        report_dict["padel"] = {
            "rally_metrics": [],
            "shot_speeds": [],
            "wall_usage": {"wall_bounce_count": 0, "ground_bounce_count": 0, "wall_usage_ratio": 0.0},
            "player_stats_sample": [],
        }

    write_json_atomic(report_path, report_dict)
    return report_path
