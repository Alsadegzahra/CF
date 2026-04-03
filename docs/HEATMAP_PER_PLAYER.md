# Per-player court heatmap (feature spec)

**Goal:** One heatmap per player showing where that player spent time on the court (position density over the match).

**Status:** Spec / TODO. Current pipeline produces a single **all-players** heatmap in `reports/heatmap.png`. This doc describes how to add **per-player** heatmaps.

---

## Inputs (from CourtFlow)

- Tracked player positions over time: for each frame, `(player_id, x_court, y_court)` in **court coordinates**.  
  Already available from detection + tracker + homography mapping in `tracks/tracks.json` (each record has `player_id`, `x_court`, `y_court`).

---

## Steps to implement

1. **Accumulate positions per player**  
   For each `player_id`, collect all `(x_court, y_court)` positions across the video (or selected segment).

2. **Build a 2D density per player**  
   - **Option A:** 2D histogram (bin court into grid, count points per cell).  
   - **Option B:** Kernel density estimation (KDE) for smoother heatmaps.  
   Use the same court coordinate system (e.g. 0–1 or meters) for all players so heatmaps are comparable.

3. **Render one heatmap per player**  
   - Overlay the density on a top-down court image or court outline.  
   - Use a colormap (e.g. viridis, hot) from low (cold) to high (hot) activity.  
   - Output: one image per player (e.g. `heatmap_player_1.png`, `heatmap_player_2.png`) or a 2×2 panel for 4 players.

4. **Optional**  
   - Toggle by match segment (e.g. heatmap for set 1 only).  
   - Normalize by time on court so players with different play time are comparable.

---

## Libraries (Python)

- `numpy` for histograms / arrays.  
- `matplotlib` or `opencv` for drawing; `seaborn` or `scipy.stats.gaussian_kde` for KDE if you want smooth heatmaps.

Existing heatmap logic: `src/analytics/heatmap.py` — `build_heatmap(tracks, out_path, ...)` builds one heatmap from all tracks. Extend or call it **per player** (filter tracks by `player_id`) and pass the same `court_bounds` / `grid_shape` for consistency.

---

## Minimal code outline

```python
# Pseudo-outline: per-player heatmap (run inside CourtFlow after you have tracks in court coords)

def build_player_heatmaps(tracks_by_player, court_width=1.0, court_height=1.0, grid_n=50):
    """
    tracks_by_player: dict[player_id, list of (x, y) in court coords]
    Returns: dict[player_id, 2D array] density grid
    """
    import numpy as np
    out = {}
    for pid, points in tracks_by_player.items():
        if not points:
            continue
        xs, ys = np.array(points).T
        # 2D histogram on court (0..court_width, 0..court_height)
        h, _, _ = np.histogram2d(xs, ys, bins=grid_n, range=[[0, court_width], [0, court_height]])
        out[pid] = h
    return out

def draw_heatmap(density_2d, court_image_or_shape, output_path):
    """Overlay density on court; save to output_path (e.g. heatmap_player_1.png)."""
    # Use matplotlib imshow with colormap (e.g. 'hot' or 'viridis') and alpha over court image
    # or cv2.applyColorMap on the density and blend with court image
    pass
```

**Integration:** In `src/analytics/report.py` or a new `src/analytics/heatmap_per_player.py`, after loading tracks with `x_court`/`y_court`, group by `player_id`, call `build_player_heatmaps`, then `draw_heatmap` for each. Write outputs to `reports/heatmap_player_1.png` etc. and add paths to the report schema (e.g. `renders.heatmap_player_1`) so the dashboard can show them.

---

Heatmaps and 2/3/4 player logic live entirely in **CourtFlow**; CF_Training (or any external repo) only supplies **best.pt** for detection.
