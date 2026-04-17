"""
Build a printable PDF summary from reports/report.json.
Uses fpdf2 with built-in Helvetica (ASCII / Latin-1 safe strings).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from src.utils.io import read_json


def _embed_heatmaps(pdf: Any, reports_dir: Path) -> None:
    """Append pages with heatmap PNGs from reports_dir (same folder as report.json)."""
    combined = reports_dir / "heatmap.png"
    if combined.exists():
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, _pdf_text("Heatmaps - all players"), ln=True)
        pdf.ln(2)
        try:
            pdf.image(str(combined), x=15, w=180)
        except Exception:
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, _pdf_text("heatmap.png could not be embedded."), ln=True)

    any_player = False
    for pid in ("1", "2", "3", "4"):
        pimg = reports_dir / f"heatmap_player_{pid}.png"
        if pimg.exists():
            any_player = True
            break
    if any_player:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, _pdf_text("Heatmaps - per player"), ln=True)
        pdf.ln(2)
        for pid in ("1", "2", "3", "4"):
            pimg = reports_dir / f"heatmap_player_{pid}.png"
            if not pimg.exists():
                continue
            if pdf.get_y() > 200:
                pdf.add_page()
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, _pdf_text(f"Player {pid}"), ln=True)
            try:
                pdf.image(str(pimg), x=15, w=100)
                pdf.ln(8)
            except Exception:
                pdf.set_font("Helvetica", "", 9)
                pdf.cell(0, 5, _pdf_text(f"heatmap_player_{pid}.png failed."), ln=True)


def _pdf_text(s: Any) -> str:
    """Safe for FPDF core fonts (Latin-1)."""
    if s is None:
        return "-"
    t = str(s).replace("\u00b7", "-").replace("\u2013", "-").replace("\u2014", "-")
    return t.encode("latin-1", "replace").decode("latin-1")


def write_report_pdf_from_json(report_json_path: Path, out_pdf_path: Optional[Path] = None) -> Path:
    """
    Read report.json and write report.pdf beside it (or out_pdf_path).
    Returns path to the PDF.
    """
    try:
        from fpdf import FPDF
    except ImportError as e:
        raise ImportError("Install fpdf2: pip install fpdf2") from e

    data = read_json(report_json_path)
    if not isinstance(data, dict):
        data = {}

    out = out_pdf_path or report_json_path.with_name("report.pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, _pdf_text("CourtFlow - Match report"), ln=True)
    pdf.ln(2)

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, _pdf_text(f"Match ID: {data.get('match_id')}"), ln=True)
    pdf.cell(0, 6, _pdf_text(f"Court: {data.get('court_id')}"), ln=True)
    pdf.cell(0, 6, _pdf_text(f"Generated: {data.get('generated_at')}"), ln=True)
    pdf.cell(0, 6, _pdf_text(f"Status: {data.get('status')}"), ln=True)
    tm = data.get("tracking_mode")
    if tm:
        pdf.cell(0, 6, _pdf_text(f"Tracking mode: {tm}"), ln=True)

    video = data.get("video") or {}
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, _pdf_text("Video"), ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, _pdf_text(f"Duration (s): {video.get('duration_seconds')}"), ln=True)
    pdf.cell(0, 6, _pdf_text(f"FPS: {video.get('fps')}"), ln=True)

    summary = data.get("summary") or {}
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, _pdf_text("Summary"), ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, _pdf_text(summary.get("insight")))
    pdf.ln(1)
    if summary.get("tier_1_total_distance_m") is not None:
        pdf.cell(0, 6, _pdf_text(f"Tier 1 total distance (m): {summary.get('tier_1_total_distance_m')}"), ln=True)
    if summary.get("tier_1_tracking_span_s") is not None:
        pdf.cell(0, 6, _pdf_text(f"Tier 1 tracking span (s): {summary.get('tier_1_tracking_span_s')}"), ln=True)
    pdf.cell(0, 6, _pdf_text(f"Players (tracks): {summary.get('num_players')}"), ln=True)
    pdf.cell(0, 6, _pdf_text(f"Track points: {summary.get('total_track_points')}"), ln=True)

    t1 = (data.get("analytics_tiers") or {}).get("tier_1") or {}
    if t1:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, _pdf_text("Tier 1 (basic)"), ln=True)
        pdf.set_font("Helvetica", "", 10)
        sess = t1.get("session") or {}
        pdf.cell(0, 6, _pdf_text(f"Clip length (s): {sess.get('clip_length_s')}"), ln=True)
        pdf.cell(0, 6, _pdf_text(f"Total distance (m): {sess.get('total_distance_m')}"), ln=True)
        pdf.cell(0, 6, _pdf_text(f"Tracking span (s): {sess.get('tracking_span_s')}"), ln=True)

    t2 = (data.get("analytics_tiers") or {}).get("tier_2") or {}
    if t2:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, _pdf_text("Tier 2 (standard)"), ln=True)
        pdf.set_font("Helvetica", "", 10)
        sess2 = t2.get("session") or {}
        pdf.cell(0, 6, _pdf_text(f"Max speed any player (m/s): {sess2.get('max_speed_m_s_any_player')}"), ln=True)
        pdf.cell(0, 6, _pdf_text(f"Sprint count (all players): {sess2.get('sprint_count_all_players')}"), ln=True)
        hm = sess2.get("heatmaps") or {}
        if hm.get("combined"):
            pdf.cell(0, 6, _pdf_text(f"Heatmap file: {hm.get('combined')}"), ln=True)
        t2p = t2.get("players") or {}
        if t2p:
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 9)
            cw = [22, 26, 26, 24, 24]
            hdrs = ["Player", "Avg km/h", "Max km/h", "Sprints", "Dist (m)"]
            for i, h in enumerate(hdrs):
                pdf.cell(cw[i], 7, _pdf_text(h), border=1)
            pdf.ln()
            for pid in sorted(t2p.keys(), key=lambda x: int(x) if str(x).isdigit() else 0):
                p = t2p[pid] or {}
                row = [
                    f"P{pid}",
                    p.get("avg_speed_kmh"),
                    p.get("max_speed_kmh"),
                    p.get("sprint_count"),
                    p.get("distance_m"),
                ]
                for i, cell in enumerate(row):
                    pdf.cell(cw[i], 7, _pdf_text(cell), border=1)
                pdf.ln()

    reports_dir = report_json_path.parent
    _embed_heatmaps(pdf, reports_dir)

    t3 = (data.get("analytics_tiers") or {}).get("tier_3") or {}
    if t3:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, _pdf_text("Tier 3 (detailed)"), ln=True)
        pdf.set_font("Helvetica", "", 10)
        sess3 = t3.get("session") or {}
        pdf.cell(0, 6, _pdf_text(f"High-intensity windows: {sess3.get('high_intensity_windows')}"), ln=True)
        pdf.cell(0, 6, _pdf_text(f"Team 1 avg spacing (m): {sess3.get('team_1_avg_spacing_m')}"), ln=True)
        pdf.cell(0, 6, _pdf_text(f"Team 2 avg spacing (m): {sess3.get('team_2_avg_spacing_m')}"), ln=True)
        pdf.ln(2)
        t3p = t3.get("players") or {}
        if t3p:
            pdf.set_font("Helvetica", "", 9)
            cw3 = [18, 22, 22, 22, 28, 28]
            hdrs = ["Player", "Net %", "Base %", "Lat %", "Accel peaks", "Decel"]
            for i, h in enumerate(hdrs):
                pdf.cell(cw3[i], 7, _pdf_text(h), border=1)
            pdf.ln()
            for pid in sorted(t3p.keys(), key=lambda x: int(x) if str(x).isdigit() else 0):
                p = t3p[pid] or {}
                row = [
                    f"P{pid}",
                    p.get("net_pct"),
                    p.get("baseline_pct"),
                    p.get("lateral_movement_pct"),
                    p.get("acceleration_peaks"),
                    p.get("deceleration_count"),
                ]
                for i, cell in enumerate(row):
                    pdf.cell(cw3[i], 7, _pdf_text(cell), border=1)
                pdf.ln()
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 8)
            pdf.multi_cell(
                0,
                4,
                _pdf_text("Zone coverage (% per court cell 0-5) is in report.json under analytics_tiers.tier_3.players."),
            )

    players: Dict[str, Any] = data.get("players") or {}
    if players:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, _pdf_text("Players"), ln=True)
        pdf.set_font("Helvetica", "", 9)
        col_w = [22, 28, 18, 22, 28, 32]
        headers = ["Player", "Dist (m)", "Rank", "Share %", "Active (s)", "Avg speed"]
        for i, h in enumerate(headers):
            pdf.cell(col_w[i], 7, _pdf_text(h), border=1)
        pdf.ln()
        for pid in sorted(players.keys(), key=lambda x: int(x) if str(x).isdigit() else 0):
            p = players[pid] or {}
            row = [
                f"P{pid}",
                p.get("distance_m", p.get("distance")),
                p.get("rank_by_distance"),
                p.get("share_of_distance_pct"),
                p.get("active_duration_s", p.get("duration_s")),
                p.get("avg_speed"),
            ]
            for i, cell in enumerate(row):
                pdf.cell(col_w[i], 7, _pdf_text(cell)[:32], border=1)
            pdf.ln()

    padel = data.get("padel") or {}
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, _pdf_text("Padel metrics"), ln=True)
    pdf.set_font("Helvetica", "", 10)
    wall = padel.get("wall_usage") or {}
    pdf.cell(
        0,
        6,
        _pdf_text(
            f"Wall / ground bounces: {wall.get('wall_bounce_count')} / {wall.get('ground_bounce_count')}"
        ),
        ln=True,
    )
    rm = padel.get("rally_metrics") or []
    pdf.cell(0, 6, _pdf_text(f"Rally segments (ball pipeline): {len(rm)}"), ln=True)

    pdf.ln(6)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(0, 5, _pdf_text("Generated by CourtFlow. Full machine-readable data: report.json"))

    pdf.output(str(out))
    return out
