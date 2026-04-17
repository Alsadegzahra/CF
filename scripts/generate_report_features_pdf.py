"""
Generate docs/CourtFlow_Report_Features.pdf (field guide to report.json and PDF exports).
Run: python3 scripts/generate_report_features_pdf.py
"""
from __future__ import annotations

from pathlib import Path


def _txt(s: str) -> str:
    for a, b in [("\u2014", "-"), ("\u2013", "-"), ("\u00b7", "-")]:
        s = s.replace(a, b)
    return s.encode("latin-1", "replace").decode("latin-1")


def main() -> None:
    from fpdf import FPDF

    root = Path(__file__).resolve().parents[1]
    out = root / "docs" / "CourtFlow_Report_Features.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=14)

    def h1(t: str) -> None:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 14)
        pdf.multi_cell(pdf.epw, 8, _txt(t))

    def h2(t: str) -> None:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 11)
        pdf.multi_cell(pdf.epw, 6, _txt(t))

    def p(t: str) -> None:
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(pdf.epw, 5, _txt(t))
        pdf.ln(1)

    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, _txt("CourtFlow - Report features reference"), ln=True)
    pdf.set_font("Helvetica", "", 10)
    p(
        "This document describes what each part of a match report means: "
        "report.json (machine-readable), the printable report.pdf, and how tiers group metrics."
    )

    h1("Top-level fields (report.json)")
    p("match_id, court_id - Identifiers for the match and court.")
    p("generated_at - UTC timestamp when the report was built.")
    p("schema_version - Contract version for the JSON shape.")
    p("status - e.g. computed when tracks were processed.")
    p("tracking_mode - tracking (ByteTrack/BoT-SORT) or detection_only (no tracker).")
    p("video - duration_seconds, fps, and related metadata from the source file.")
    p("highlights - List of {start, end, reason} time windows (e.g. high_intensity from movement).")

    h1("summary")
    p("Aggregates across all players: num_players, total_track_points, total_distance / total_duration_s (legacy movement scaling).")
    p("insight - One-line hero text (aligned with Tier 1 when tracks exist).")
    p("tier_1_total_distance_m, tier_1_tracking_span_s - Tier 1 physical totals (meters, seconds).")

    h1("players (per player id 1-4)")
    p("distance_m - Path length on court in meters (Tier 1, 10x20m model).")
    p("active_duration_s - Time span from first to last sample.")
    p("rank_by_distance, share_of_distance_pct - Rank and % of team total distance.")
    p("avg_speed, max_speed - From movement metrics (normalized court scaling; see Tier 2 for km/h).")
    p("sprint_count, acceleration_peaks, deceleration_count - Dynamics from segment speeds.")
    p("lateral_movement_pct - Share of movement that is side-to-side.")
    p("zone_coverage_pct - % of time in each of 6 court zones (0-5).")
    p("net_pct, baseline_pct - % near net band vs baselines (spatial).")

    h1("analytics")
    p("heatmap_path - Relative path to combined heatmap PNG (all players).")
    p("heatmap_player_{1-4} - Per-player heatmap paths.")
    p("team_spacing_m - team_1_avg_m (P1-P2), team_2_avg_m (P3-P4) mean separation in meters.")

    pdf.add_page()
    h1("analytics_tiers.tier_1 (basic)")
    p("session: clip_length_s (video length), num_players, total_distance_m (sum of all players paths), tracking_span_s, total_track_points.")
    p("players: distance_m, active_duration_s, rank_by_distance, share_of_distance_pct, track_points.")
    p("insight - Same one-liner as summary when computed.")

    h1("analytics_tiers.tier_2 (standard)")
    p("Speed and sprints using physical meters on court; segment speeds capped for max/sprint stats.")
    p("session: heatmaps paths, max_speed_m_s_any_player, sprint_count_all_players.")
    p("players: avg_speed_m_s / kmh, max_speed_m_s / kmh, sprint_count, distance_m.")

    h1("analytics_tiers.tier_3 (detailed)")
    p("session: high_intensity_windows (count), team spacing for both pairs.")
    p("players: zone_coverage_pct (cells 0–5), net_pct, baseline_pct, lateral_movement_pct, acceleration_peaks, deceleration_count.")

    h1("padel")
    p("rally_metrics, shot_speeds - Filled when ball pipeline provides data; often empty.")
    p("wall_usage - wall vs ground bounce counts when bounce_events exist.")
    p("player_stats_sample - Sample rows of time-series stats when computed.")

    pdf.add_page()
    h1("report.pdf (exported PDF)")
    p("Generated beside report.json after each successful report build (requires fpdf2).")
    p("Contains: header, summary, Tier 1-3 tables, embedded heatmap images (combined + per player), player table, padel stub, footer.")
    p("Heatmaps are read from the reports/ folder next to report.json.")

    h1("API (optional)")
    p("GET /matches/{id}/report - JSON.")
    p("GET /matches/{id}/report.pdf - Download PDF.")

    pdf.output(str(out))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
