# Better tracking: methods and resources (tennis, sports, MOT)

How tracking is improved globally, and where to look for tennis / racket-sport / team-sport ideas that apply to CourtFlow (padel).

---

## 1. Global methods used to fix / improve tracking

### Motion and association

| Method | What it does | Relevance to CourtFlow |
|--------|----------------|------------------------|
| **Kalman filtering** | Predicts next position from (x, y, vx, vy); smooths noisy detections; used for data association across frames. | You already use it via ByteTrack/BoT-SORT. Can add **adaptive process noise (Q)** for irregular motion. |
| **Mahalanobis distance + chi-squared** | Match detections to tracks using predicted state covariance; fewer false matches than raw IoU. | Tennis zero-shot pipeline uses this for association; could be explored in a custom association layer. |
| **Expansion IoU (EIoU)** | Enlarges boxes for association so nearby detections match better under motion/camera shake. | **Deep-EIoU** and **Deep HM-SORT** use it for sports; addresses “irregular motion” and camera motion. |
| **Harmonic mean (appearance + motion)** | Combines IoU (or EIoU) and ReID with harmonic mean instead of min; balances the two and reduces ID swaps. | **Deep HM-SORT**; could inspire tuning of BoT-SORT’s fusion (you already patch ReID vs IoU). |

### Appearance and re-identification

| Method | What it does | Relevance to CourtFlow |
|--------|----------------|------------------------|
| **ReID only when IoU is very bad** | Use appearance for association mainly after occlusion (IoU distance &gt; 0.9), not when IoU is “moderately” bad. | **Already done** in `botsort_reid_patch.py` (REID_ONLY_IOU_DIST_THRESH = 0.9). |
| **Dynamic feature gallery (DFG)** | Store appearance features per track; use them only in occlusion scenarios to re-identify. | Basketball system: conditional ReID reduces wrong matches and compute; similar in spirit to your ReID patch. |
| **Jersey / number recognition** | Use jersey numbers (and team ID) as strong identity signal when available. | Team sports; less applicable to padel (no numbers), but “domain-specific cues” idea applies (e.g. court side, role). |
| **Siamese / ReID backbone** | Dedicated ReID model (e.g. FastReID, OSNet) for embedding; better than “detector features as ReID”. | BoT-SORT supports `model: auto` or external ReID; you could plug a small ReID model for occlusion recovery. |

### Sport-specific design

| Method | What it does | Relevance to CourtFlow |
|--------|----------------|------------------------|
| **No Kalman, iterative EIoU + deep features** | Drop Kalman for association; use iterative scale-up EIoU and deep features (DeepEIoU + GTA). | Top on SportsMOT (81.0 HOTA); for irregular athlete motion; would require integrating a different tracker. |
| **Indefinite tracklet retention** | Never delete old tracklets; always try to re-associate when a person reappears. | Deep HM-SORT; reduces “new ID” after long occlusion; your `track_buffer` (e.g. 180) goes in this direction. |
| **Court homography + position** | Map image positions to court (bird’s-eye); use court position as extra cue for identity (e.g. “left vs right”). | You already have homography and canonical P1–P4 by position; can reinforce identity with court-side consistency. |
| **Longest-history heuristic** | In zero-shot setting: treat “person with longest continuous track” as player (vs line judges/ball persons). | Tennis article: simple rule to filter non-players; for padel you already fix 4 players; could help filter stray detections. |

---

## 2. Tennis and similar sports resources

### Articles and tutorials

- **Zero-Shot Player Tracking in Tennis with Kalman Filtering** (Medium, Jan 2025)  
  - [Link](https://medium.com/data-science/zero-shot-player-tracking-in-tennis-with-kalman-filtering-80bba73a4247)  
  - GroundingDINO + Kalman filter; association via Mahalanobis + chi-squared; 30-frame memory; “longest tracking history” to pick players vs line judges; court homography for bird’s-eye.  
  - **Takeaway:** Strong association (Mahalanobis) and simple heuristics (longest history) transfer; homography you already do.

### Datasets

- **TenniSet**  
  - [Tennis dataset (Faulkner et al., DICTA 2017)](https://github.com/HaydenFaulkner/Tennis) – broadcast tennis (e.g. 2012 Olympics); used in the Medium article.  
- **SportsMOT** (ICCV 2023)  
  - [GitHub](https://github.com/MCG-NJU/SportsMOT) | [Hugging Face](https://huggingface.co/datasets/MCG-NJU/SportsMOT) | [DeeperAction page](https://deeperaction.github.io/tracks/sportsmot.html)  
  - 240 sequences, 150K+ frames, basketball/volleyball/football; fast motion, similar appearances, moving camera.  
  - **Use:** Evaluate/tune trackers for “sports-like” conditions even if not padel.

### Repos and code

- **ritunk/tennis_analysis**  
  - [GitHub](https://github.com/ritunk/tennis_analysis) – tennis analysis; may include detection/tracking or court alignment.  
- **nicocarpe/fieldvision**  
  - [GitHub](https://github.com/nicocarpe/fieldvision) – court/field vision; useful for homography and court structure.  
- **Deep-EIoU** (Expansion IoU for sports MOT)  
  - [GitHub](https://github.com/hsiangwei0903/Deep-EIoU) – ExpansionIoU + deep features; ~77% HOTA on SportsMOT; PyTorch.  
- **Kalman filter object detection (tennis project)**  
  - [GitHub](https://github.com/dcaustin33/kalman_filter_object_detection) – Kalman + Mahalanobis association (from the Medium tennis article).

### Papers (sports MOT)

- **Deep HM-SORT** (2024)  
  - [arXiv:2406.12081](https://arxiv.org/abs/2406.12081)  
  - Deep features + harmonic mean + Expansion IoU; 80.1 HOTA (SportsMOT), 85.4 (SoccerNet); indefinite tracklet retention.  
- **DeepEIoU + GTA** (WACV 2024 / SportsMOT leaderboard)  
  - Iterative scale-up ExpansionIoU + deep features; no Kalman; 81.0 HOTA, 86.5 IDF1 on SportsMOT.  
- **SportsMOT dataset**  
  - [ICCV 2023](https://openaccess.thecvf.com/content/ICCV2023/html/Cui_SportsMOT_A_Large_Multi-Object_Tracking_Dataset_in_Multiple_Sports_Scenes_ICCV_2023_paper.html)  
  - MixSort (motion + appearance) as baseline; dataset as benchmark.  
- **Occlusion-aware ReID (basketball)**  
  - [Real-Time Basketball Player Tracking with Dynamic Feature Gallery](https://mislab.cs.nthu.edu.tw/project-pages/2024_Real-Time_Basketball_Player_Tracking_Method.html)  
  - Rule-based occlusion detection + ReID only when needed; Siamese feature extractor.  
- **Jersey number + graph (SportsSUSHI, WACV 2025)**  
  - [Towards long-term player tracking with graph hierarchies and domain-specific features](https://openaccess.thecvf.com/content/WACV2025W/CV4WS/papers/Koshkina_Towards_long-term_player_tracking_with_graph_hierarchies_and_domain-specific_features_WACVW_2025_paper.pdf)  
  - Jersey numbers, team ID, field position; graph-based reconnection after occlusion.

---

## 3. Concrete next steps for CourtFlow

1. **Keep current stack, tune it**  
   - Try **BoT-SORT with ReID** again on a few matches (you already use ReID-only when IoU &gt; 0.9).  
   - Tune **track_buffer** (e.g. 180 → 240) for long occlusions; **match_thresh** and **min_box_area** in tracker YAML.  
   - Optionally try a **dedicated ReID model** (e.g. OSNet) in BoT-SORT instead of `model: auto`.

2. **Add or strengthen motion smoothing**  
   - You already have EMA on positions/bboxes.  
   - Consider **adaptive Kalman Q** (from the tennis Kalman repo) so process noise increases when motion is irregular.

3. **Experiment with Expansion IoU**  
   - Deep-EIoU is open source; could be used as a reference to add an “expansion IoU” option in association (e.g. enlarge boxes by a few pixels before IoU), or to compare against ByteTrack/BoT-SORT on a short clip.

4. **Use SportsMOT for validation**  
   - If you implement or tweak a tracker, run it on SportsMOT (or a subset) and report HOTA/IDF1 for comparison with papers (e.g. Deep HM-SORT, Deep-EIoU).

5. **Court position as identity prior**  
   - You already map to court and assign P1–P4.  
   - Strengthen “canonical” identity by penalizing or correcting IDs that jump court sides (e.g. P1 left → P1 right in one frame) using homography and court geometry.

6. **Same-kit / occlusion**  
   - For same-kit: keep ByteTrack or BoT-SORT with ReID disabled / conservative; DFG-style “ReID only in occlusion” is already in the spirit of your patch.  
   - For future: consider a small **jersey-number or role cue** only if you ever have numbers or stable roles (e.g. server).

---

## 4. Quick reference links

| Resource | URL |
|----------|-----|
| Tennis zero-shot (Kalman) | https://medium.com/data-science/zero-shot-player-tracking-in-tennis-with-kalman-filtering-80bba73a4247 |
| Kalman + association code | https://github.com/dcaustin33/kalman_filter_object_detection |
| SportsMOT (dataset + MixSort) | https://github.com/MCG-NJU/SportsMOT |
| Deep-EIoU (Expansion IoU) | https://github.com/hsiangwei0903/Deep-EIoU |
| Deep HM-SORT (paper) | https://arxiv.org/abs/2406.12081 |
| Tennis dataset (TenniSet) | https://github.com/HaydenFaulkner/Tennis |
| CourtFlow ReID patch | `src/vision/tracking/botsort_reid_patch.py` |
| CourtFlow tracker configs | `config/trackers/bytetrack_padel.yaml`, `botsort_padel.yaml` |

---

## 5. Skeleton-based tracking: would it help?

**Short answer: yes, it can help**, mainly as an extra cue for identity and a more stable “ground point”, not as a full replacement for bbox tracking.

| Use of skeleton / pose | How it helps | Caveat |
|------------------------|---------------|--------|
| **Ground point from keypoints** | Use ankle or knee (or mid-hip) instead of bbox bottom for court position; less jitter when players crouch or extend. | Need to associate keypoints to detections (same detector with pose, or pose-on-crop). |
| **Pose as ReID cue** | Pose similarity (e.g. body orientation, limb angles) can disambiguate same-kit players when appearance is similar. | Extra compute; need to fuse with bbox ReID (e.g. only when bbox ReID is uncertain). |
| **Pose consistency across frames** | Same person has smooth pose change; sudden pose jump can indicate wrong association. | Useful for post-hoc swap correction or association scoring. |
| **Full pose-based MOT** | Systems like PoseTrack do joint detection + pose + tracking; identity can be driven by pose + appearance. | Heavier pipeline; for padel, bbox MOT + court prior is usually enough; add pose as optional refinement. |

**Practical path for CourtFlow:** Keep bbox-based tracking as the main pipeline. Optionally add a **pose model** (e.g. YOLO-pose or lightweight HRNet on crops) to (1) compute a **keypoint-based ground point** (e.g. mean of ankles) and blend with bbox bottom for `x_pixel`/`y_pixel`, and (2) use **pose embedding or orientation** in swap correction (e.g. don’t swap if it would make P1’s orientation jump inconsistently). That gives you better stability and fewer spurious swaps without replacing the tracker.

**Implemented:** Pose runs **per frame after detection** (in the same pass as tracking): we get (frame, detections) from the tracker, run pose on each detection’s crop, then attach ground point and keypoints to that frame’s tracks. So pose is “after detection, before we write tracks” and no second video pass is needed. Use **`--pose`** on run-match. The tracker (ByteTrack/BoT-SORT) itself does not use pose for association—that would require custom association code; pose is used for better ground point, skeleton overlay, and future use (e.g. pose-based swap correction). See `src/vision/pose/ground_point.py` and CLI `--pose`.

---

## 6. Sport-specific implementation plan (CourtFlow)

Three directions you said you want to work on: **no-Kalman EIoU**, **long tracklet retention**, **court homography + left/right prior**. Concrete steps:

### 6.1 No Kalman + iterative EIoU + deep features (DeepEIoU / GTA)

- **Goal:** Reduce ID swaps and handle irregular motion by using Expansion IoU and deep-feature association instead of (or in addition to) Kalman.
- **Options:**
  - **A – External comparison:** Run [Deep-EIoU](https://github.com/hsiangwei0903/Deep-EIoU) on a few match clips; export its tracks and compare HOTA/IDF1 or visual consistency with ByteTrack/BoT-SORT. No change to CourtFlow code yet.
  - **B – Expansion IoU in pipeline:** If Ultralytics trackers ever support “expansion IoU” or a similar option, enable it. Otherwise, add a **post-association** step: when matching detections to tracks, optionally enlarge bboxes by a few pixels and recompute IoU (experimental).
  - **C – New tracker backend:** Integrate Deep-EIoU (or a minimal EIoU + deep-feature association) as an optional tracker path in CourtFlow; keep ByteTrack/BoT-SORT as default. Larger effort; start with A.
- **Recommendation:** Start with **A** (benchmark Deep-EIoU vs current trackers on 1–2 matches), then decide on B or C.

### 6.2 Long tracklet retention

- **Goal:** Keep tracks alive longer so that when a player reappears after occlusion they get the same ID.
- **Current:** `config/trackers/botsort_padel.yaml` has `track_buffer: 240`; ByteTrack configs use 90.
- **Steps:**
  - Add a “long retention” ByteTrack config, e.g. `config/trackers/bytetrack_padel_long_buffer.yaml` with `track_buffer: 180` (or 240), and document when to use it.
  - For BoT-SORT, 240 is already long; you can try 300 if you have long occlusions and are okay with slightly higher wrong re-associations.
- **Done:** `config/trackers/bytetrack_padel_long_buffer.yaml` exists with `track_buffer: 180`. Use `--tracker config/trackers/bytetrack_padel_long_buffer.yaml` when IDs drop after long occlusions.

### 6.3 Court homography + left/right position prior

- **Goal:** Use court space (bird’s-eye) so that P1–P4 are stable by **court side** (e.g. P1,P2 = one side of net, P3,P4 = other side); reduce swaps and re-anchor jitter.
- **Implementation (in codebase):**
  - **Canonicalize:** When calibration is available, load homography in `run_tracking`, pass it into `canonicalize_from_first_frame`. In `_pick_four_from_frame_tracks`, compute `x_court` from each bbox (ground point → `pixel_to_court`), then order players by court side (e.g. `x_court < net_x` then court y) so that P1,P2 are one half and P3,P4 the other, consistently.
  - **Swap correction:** In `correct_canonical_swaps`, when calibration is available, use court position: only allow a swap if after the swap each player would still be on the same court half as before (e.g. P1 stays on “left” half). Reject flips that would move a player to the wrong half.
- **Done:** Implemented. Calibration is loaded from `match_dir/calibration` when present; `canonical_ids` uses `NET_X_COURT = 0.5` for net position; swap correction rejects flips that would move a player to the wrong court half.

---

*Summary: Global fixes are better association (Kalman + Mahalanobis, Expansion IoU, harmonic mean with ReID), conditional ReID (only when IoU is very bad), indefinite or long tracklet retention, and court/position priors. Tennis and sports MOT give you Kalman tutorials, SportsMOT benchmark, and ready repos (Deep-EIoU, tennis_analysis) to adapt for padel. Skeleton/pose can help as an extra cue (ground point, pose-based swap check). Sport-specific: benchmark Deep-EIoU (A), add long-buffer ByteTrack config, implement court-side prior in canonicalize + swap correction.*
