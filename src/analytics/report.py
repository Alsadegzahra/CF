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
        from src.analytics.tier1 import build_tier1
        from src.analytics.tier2 import build_tier2
        from src.analytics.tier3 import build_tier3

        fps_meta = float(video_meta.get("fps", 30) or 30)
        report_dict["analytics_tiers"] = {
            "tier_1": build_tier1(tracks, video_meta, fps=fps_meta),
        }
        metrics = compute_movement_metrics(tracks, fps=fps_meta)
        report_dict["summary"] = {**report_dict["summary"], **metrics["summary"]}
        report_dict["players"] = metrics["players"]
        report_dict["status"] = "computed"

        # Rank / share / physical distance: align with Tier 1 (meters on court)
        t1 = report_dict["analytics_tiers"]["tier_1"]
        t1_players = t1.get("players") or {}
        for pid in report_dict["players"]:
            row = t1_players.get(str(pid))
            if row:
                report_dict["players"][pid]["rank_by_distance"] = row["rank_by_distance"]
                report_dict["players"][pid]["share_of_distance_pct"] = row["share_of_distance_pct"]
                report_dict["players"][pid]["distance_m"] = row["distance_m"]
                report_dict["players"][pid]["active_duration_s"] = row["active_duration_s"]
        report_dict["summary"]["insight"] = t1.get("insight", "Analytics computed.")
        sess = t1.get("session") or {}
        report_dict["summary"]["tier_1_total_distance_m"] = sess.get("total_distance_m", 0.0)
        report_dict["summary"]["tier_1_tracking_span_s"] = sess.get("tracking_span_s", 0.0)

        # Combined heatmap + per-player heatmaps
        heatmap_path = reports_dir / "heatmap.png"
        _hm_kw = {"court_bounds": (0.0, 0.0, 1.0, 1.0), "grid_shape": (50, 100)}
        build_heatmap(tracks, heatmap_path, **_hm_kw)
        analytics_heatmaps: dict = {"heatmap_path": str(heatmap_path)}
        for pid in report_dict["players"]:
            player_tracks = [t for t in tracks if str(t.get("player_id")) == str(pid)]
            if player_tracks:
                p_path = reports_dir / f"heatmap_player_{pid}.png"
                build_heatmap(player_tracks, p_path, **_hm_kw)
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

        heatmap_paths_tier2 = {
            "combined": "reports/heatmap.png",
            "per_player": {
                str(pid): f"reports/heatmap_player_{pid}.png"
                for pid in sorted(report_dict["players"].keys(), key=lambda x: int(x) if str(x).isdigit() else 0)
            },
        }
        report_dict["analytics_tiers"]["tier_2"] = build_tier2(
            tracks,
            video_meta,
            fps=fps_meta,
            heatmap_paths=heatmap_paths_tier2,
        )

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

        report_dict["analytics_tiers"]["tier_3"] = build_tier3(
            report_dict["players"],
            team_spacing=analytics_heatmaps.get("team_spacing_m") or {},
            highlights=report_dict.get("highlights") or [],
        )
    else:
        from src.analytics.tier1 import build_tier1
        from src.analytics.tier2 import build_tier2
        from src.analytics.tier3 import build_tier3

        fps_empty = float(video_meta.get("fps", 30) or 30)
        report_dict["analytics_tiers"] = {
            "tier_1": build_tier1([], video_meta, fps=fps_empty),
            "tier_2": build_tier2([], video_meta, fps=fps_empty, heatmap_paths={}),
            "tier_3": build_tier3({}, team_spacing={}, highlights=[]),
        }
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

    try:
        from src.analytics.report_pdf import write_report_pdf_from_json

        pdf_path = write_report_pdf_from_json(report_path)
        try:
            rel = pdf_path.relative_to(out_dir)
        except ValueError:
            rel = pdf_path.name
        print(f"   ✓ Report PDF: {rel}")
    except Exception as e:
        print(f"   (skip) PDF export: {e}")

    return report_path
