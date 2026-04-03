# CourtFlow – Feature checklist (final list)

This doc maps the **final feature list** (PDF) to implementation status. Each feature is marked **Done**, **Partial**, or **Not started**, with file references or notes.

---

## 1. Match Duration

| Status | What | Where |
|--------|------|--------|
| **Done** | Total recorded match time (end − start from video) | `video.duration_seconds` from ingest; `summary.match_duration_seconds` in report. Pipeline: `stages.py` (meta), `report.py`, `video/clips.py` (`probe_duration`) |

---

## 2. Heatmap (Per Player)

| Status | What | Where |
|--------|------|--------|
| **Done** | Combined heatmap: density of all players on court | `src/analytics/heatmap.py` `build_heatmap()`, report `analytics.heatmap_path`, dashboard. |
| **Done** | Per-player heatmap (one image per player) | `report.py` builds `heatmap_player_1.png` … `heatmap_player_4.png`; API `GET /report/heatmap?player_id=1`; dashboard toggles P1–P4. |

---

## 3. Zone Coverage Distribution

| Status | What | Where |
|--------|------|--------|
| **Done** | % of time spent in defined court zones (6 zones) | `src/analytics/spatial.py` `compute_zone_coverage()`; report `players[].zone_coverage_pct` (zone 0..5). |

---

## 4. Net vs Baseline %

| Status | What | Where |
|--------|------|--------|
| **Done** | % of time near net vs baseline | `src/analytics/spatial.py` `compute_net_baseline_pct()`; report `players[].net_pct`, `players[].baseline_pct`. |

---

## 5. Team Spacing Visualization

| Status | What | Where |
|--------|------|--------|
| **Done** | Distance between teammates (P1–P2, P3–P4) | `src/analytics/spatial.py` `compute_team_spacing()`; report `analytics.team_spacing_m` (team_1_avg_m, team_2_avg_m). Dashboard can show; time-series viz optional. |

---

## 6. Coverage Gap Detection

| Status | What | Where |
|--------|------|--------|
| **Not started** | Areas of court under-covered (low occupancy) | Requires: same grid as heatmap, flag cells with persistently low counts; optionally outline “gap” regions. |

---

## 7. Positional Drift

| Status | What | Where |
|--------|------|--------|
| **Not started** | Shift in average position over match (early vs late) | Requires: centroid in early window vs late window per player; compare. |

---

## 8. Transition Frequency (Baseline → Net)

| Status | What | Where |
|--------|------|--------|
| **Not started** | How often a player moves forward (boundary crossings) | Requires: zone sequence per player, count transitions from baseline zone to net zone. |

---

## 9. Positional Efficiency Score

| Status | What | Where |
|--------|------|--------|
| **Not started** | Composite spatial performance index (coverage + spacing + transitions) | Requires: combine zone coverage, team spacing, transition metrics into one score. |

---

## 10. Distance Covered

| Status | What | Where |
|--------|------|--------|
| **Done** | Total movement distance (frame-to-frame displacement) | `src/analytics/movement.py` `compute_movement_metrics()` → per-player `distance`; report `players[].distance`, dashboard. |

---

## 11. Average Speed

| Status | What | Where |
|--------|------|--------|
| **Done** | Mean movement speed (distance ÷ time) | `movement.py` → `avg_speed`; report and dashboard. |

---

## 12. Maximum Speed

| Status | What | Where |
|--------|------|--------|
| **Done** | Peak frame velocity | `movement.py` → `max_speed`; report `players[].max_speed`. |

---

## 13. Sprint Count

| Status | What | Where |
|--------|------|--------|
| **Done** | Number of high-speed bursts (threshold + min duration) | `movement.py` → `sprint_count` (threshold 4 m/s, min 3 segments); report `players[].sprint_count`. |

---

## 14. Acceleration Peaks

| Status | What | Where |
|--------|------|--------|
| **Done** | Rapid speed increases (derivative of velocity) | `movement.py` → `acceleration_peaks`; report `players[].acceleration_peaks`. |

---

## 15. Deceleration Load

| Status | What | Where |
|--------|------|--------|
| **Done** | Rapid braking intensity (negative acceleration spikes) | `movement.py` → `deceleration_count`; report `players[].deceleration_count`. |

---

## 16. Lateral Movement %

| Status | What | Where |
|--------|------|--------|
| **Done** | % side-to-side (horizontal displacement ÷ total) | `movement.py` → `lateral_movement_pct`; report `players[].lateral_movement_pct`. |

---

## 17. Movement Intensity Timeline

| Status | What | Where |
|--------|------|--------|
| **Done** | Movement intensity over time (used for highlights) | `movement.py` `intensity_timeline()`; used in report to pick top intensity windows for motion-based highlights. |

---

## 18. Load Distribution Over Match

| Status | What | Where |
|--------|------|--------|
| **Not started** | Early vs late match comparison (e.g. match thirds) | Requires: split match into windows, compare distance/speed per window; add to report. |

---

## 19. Motion-Based Fatigue Trend

| Status | What | Where |
|--------|------|--------|
| **Not started** | Decline in movement output over time (regression) | Requires: speed/acceleration vs time, detect downward trend. |

---

## 20. Intensity Drop-Off Detection

| Status | What | Where |
|--------|------|--------|
| **Not started** | Late-match performance drop (peak vs final-phase) | Requires: compare peak intensity window vs final segment. |

---

## 21. Motion-Based Highlight Detection

| Status | What | Where |
|--------|------|--------|
| **Done** | Auto-generated high-intensity clips | `report.py`: `intensity_timeline()` → top windows → `report.highlights`; `highlights/select.py` uses them; export to highlights.mp4. |

---

## 22. Replay with Positional Overlay

| Status | What | Where |
|--------|------|--------|
| **Done** | Video replay with movement overlay (bboxes + IDs) | `src/video/overlay.py` `draw_tracks_on_frame()`; `stages.py` stage_05_renders → `renders/track_overlay_preview.mp4`. |

---

## Summary

| Status | Count |
|--------|--------|
| **Done** | 18 |
| **Not started** | 7 |

**Not started (7):** Coverage gap (§6), Positional drift (§7), Transition frequency baseline→net (§8), Positional efficiency score (§9), Load distribution (§18), Fatigue trend (§19), Intensity drop-off (§20).

**Next steps (optional):** Add load distribution (match thirds), positional drift (early vs late centroid), baseline→net transition count, and fatigue/drop-off from intensity timeline; then coverage gap and positional efficiency score.
