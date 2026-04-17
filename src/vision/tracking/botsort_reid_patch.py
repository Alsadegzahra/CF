"""
Monkey-patch Ultralytics BoT-SORT so that when IoU is poor (e.g. after occlusion),
we use ReID-only for association instead of forcing distance to 1.0.

Default BoT-SORT does: emb_dists[dists_mask] = 1.0 then dists = min(iou, emb),
so after long occlusion both iou and emb can be bad → min(1, 1) = 1 → new ID.
We use ReID only when IoU is *very* bad (e.g. > 0.9), so we re-attach after true
occlusion but keep original behavior for moderate IoU (avoids jitter/wrong matches).
See `REID_ONLY_IOU_DIST_THRESH` below and Ultralytics BoT-SORT association behavior.
"""
from __future__ import annotations

import numpy as np

# Use ReID for association only when IoU distance is above this (true occlusion).
# Below this we keep Ultralytics default (emb=1.0 when iou bad) to avoid jitter.
REID_ONLY_IOU_DIST_THRESH = 0.9

_patch_applied = False


def apply_botsort_reid_after_occlusion() -> None:
    """Apply patch once. Safe to call multiple times."""
    global _patch_applied
    if _patch_applied:
        return
    try:
        from ultralytics.trackers import bot_sort
        from ultralytics.trackers.utils import matching
    except Exception:
        _patch_applied = True
        return

    # Class name varies by Ultralytics version: BOTSORT, BOTSort, BoTSort, BOTrack
    for name in ("BOTSORT", "BOTSort", "BoTSort", "BOTrack"):
        BOTSORT = getattr(bot_sort, name, None)
        if BOTSORT is not None:
            break
    else:
        _patch_applied = True
        return

    def get_dists_patched(self, tracks: list, detections: list) -> np.ndarray:
        """Same as Ultralytics get_dists but do NOT set emb_dists[dists_mask]=1.0,
        so when IoU is poor we use ReID distance and can re-associate after occlusion.
        """
        dists = matching.iou_distance(tracks, detections)
        dists_mask = dists > (1 - self.proximity_thresh)

        if self.args.fuse_score:
            dists = matching.fuse_score(dists, detections)

        if self.args.with_reid and self.encoder is not None:
            emb_dists = matching.embedding_distance(tracks, detections) / 2.0
            emb_dists[emb_dists > (1 - self.appearance_thresh)] = 1.0
            # Only when IoU is *very* bad (true occlusion) use ReID; else keep
            # original (emb=1.0) to avoid jitter and wrong matches when IoU is moderately bad.
            mask_moderate_bad = dists_mask & (dists <= REID_ONLY_IOU_DIST_THRESH)
            emb_dists[mask_moderate_bad] = 1.0
            dists = np.minimum(dists, emb_dists)
        return dists

    try:
        BOTSORT.get_dists = get_dists_patched
    except Exception:
        pass
    _patch_applied = True
