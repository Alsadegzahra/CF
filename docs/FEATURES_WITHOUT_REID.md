# Features you can offer without ReID

CourtFlow’s **default** is **ByteTrack** (no ReID). You can also run **detection-only** (no tracker). Everything below works with **no ReID** and keeps the stack simpler.

---

## Feature list (no ReID)

| Feature | ByteTrack (default) | Detection-only |
|--------|----------------------|-----------------|
| **4 players per frame** | ✓ Persistent IDs from first frame | ✓ P1–P4 by position each frame |
| **Court mapping** | ✓ Pixel → court (homography) | ✓ Same |
| **Total distance** | ✓ Sum over all 4 players | ✓ Same (by “slot”) |
| **Per-player distance** | ✓ P1–P4 (stable identity) | ✓ P1–P4 (by position per frame) |
| **Heatmap (combined)** | ✓ | ✓ |
| **Per-player heatmaps** | ✓ | ✓ |
| **Zone coverage** | ✓ Net / baseline % per player | ✓ Same |
| **Intensity timeline** | ✓ For highlight windows | ✓ Same |
| **Auto high-intensity highlights** | ✓ Clips from report | ✓ Same |
| **Overlay video** | ✓ P1–P4 boxes on video | ✓ Same |
| **Sample overlay images** | ✓ | ✓ |
| **Player thumbnails** | ✓ One per P1–P4 (by section) | ✓ Same |
| **Pose refinement** | ✓ Ground point + skeleton on video | ✓ Same (`--pose`) |
| **Court-side prior** | ✓ Left/right for P1–P4 (with calib) | ✓ Same |
| **Swap correction** | ✓ Position-based (no ReID) | N/A (no IDs across frames) |
| **Export highlights MP4** | ✓ | ✓ |
| **Report JSON** | ✓ Summary, players, heatmaps, highlights | ✓ Same (+ `tracking_mode`) |
| **R2 / upload** | ✓ If configured | ✓ Same |

---

## What ReID adds (optional)

- **Re-association after long occlusion**: when a player leaves frame (e.g. near the door) and comes back, ReID can re-attach the same ID. Without ReID you may get a new ID or re-anchor.
- **Cost**: extra compute, more moving parts (BoT-SORT, patch, same-kit handling), and ReID can **hurt** when kits are similar (P1/P2 or P3/P4 swap).

So you can **ship the full product without ReID**: ByteTrack (or detection-only) + court mapping + report + heatmaps + overlays + highlights. ReID is an optional improvement for occlusion-heavy setups, not required for the list above.

---

## How to run (no ReID)

- **Default (ByteTrack, no ReID):**  
  `python3 -m src.app.cli run-match --match_id <id>`
- **Explicit ByteTrack:**  
  `python3 -m src.app.cli run-match --match_id <id> --tracker config/trackers/bytetrack_padel.yaml`
- **Same-kit (no ReID, fewer swaps):**  
  `python3 -m src.app.cli run-match --match_id <id> --same-kit`
- **Detection-only (no tracker at all):**  
  `python3 -m src.app.cli run-match --match_id <id> --detection-only`

See **`docs/DETECTION_AND_TRACKING_OPTIONS.md`** for details.
