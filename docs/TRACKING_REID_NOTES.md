# ReID and occlusion in BoT-SORT

This note explains why tracker IDs can be lost after long occlusion and what we do about it.

---

## What happens after long occlusion

BoT-SORT (and similar trackers) combine **IoU distance** and **ReID embedding distance** for data association:

- **IoU:** overlap between predicted track box and detection. After the player was missing for many frames, the Kalman prediction has drifted or the person reappears in a different place → IoU is poor (distance ≈ 1).
- **ReID:** appearance embedding of the crop. After occlusion, pose/angle can change so the embedding may also be weaker.

The **default Ultralytics logic** (in `get_dists`) is:

1. Compute `dists = iou_distance(tracks, detections)`.
2. Where IoU is bad (`dists > 1 - proximity_thresh`), set `emb_dists[dists_mask] = 1.0` so ReID is ignored there.
3. Then `dists = np.minimum(dists, emb_dists)`.

So when IoU is bad, ReID is **forced to 1.0** and never used for those track–detection pairs. Result: after long occlusion, both IoU and (the masked) ReID are 1 → no match → **new ID** (or lost track).

Community feedback (e.g. Reddit r/computervision, [BoT-SORT original](https://github.com/NirAharon/BoT-SORT)) suggests: **use ReID for association when IoU is poor**, instead of discarding it. That way the same person can be re-attached by appearance after they reappear.

---

## What we do (CourtFlow)

We **patch** Ultralytics’ BoT-SORT so that we use ReID for association only when IoU is **very** bad (e.g. IoU distance &gt; 0.9), not whenever IoU is “bad” (e.g. &gt; 0.6). Then:

- Where IoU is good or **moderately** bad: we keep the original behaviour (`emb_dists` set to 1.0 for those pairs), so we avoid wrong ReID matches and **jitter** when players cross or boxes drift.
- Where IoU is **very** bad (true occlusion): we use **ReID-only** for those pairs, so the track can be re-associated after the person reappears.

The threshold is `REID_ONLY_IOU_DIST_THRESH = 0.9` in `src/vision/tracking/botsort_reid_patch.py`. The patch is applied automatically before any tracking run. It only affects the association step; all other BoT-SORT behaviour (Kalman, buffer, etc.) is unchanged.

---

## References

- Reddit r/computervision: ReID-only (or ReID-dominant) matching when IoU is bad; original BoT-SORT `bot_sort.py` (e.g. around association with `min(iou, emb)` and when to use embedding alone).
- [BoT-SORT (NirAharon)](https://github.com/NirAharon/BoT-SORT): ReID branch with FastReID; improves IDF1.
- Ultralytics: [Track mode](https://docs.ultralytics.com/modes/track/), tracker args, ReID with `model: auto` or a classification/ReID model.

---

## Config

- Default BoT-SORT config: `config/trackers/botsort_padel.yaml` (`with_reid: True`, `model: auto`).
- For same-kit (ReID confuses P1/P2 or P3/P4): use `--same-kit` or `config/trackers/botsort_padel_same_kit.yaml` / `bytetrack_padel_same_kit.yaml` (no ReID or ByteTrack). See `docs/DETECTION_AND_TRACKING_OPTIONS.md`.
