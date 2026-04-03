# CourtFlow docs

| Doc | Purpose |
|-----|--------|
| [CONTRACTS_AND_STRUCTURES.md](CONTRACTS_AND_STRUCTURES.md) | Pipeline flow, data structures, file layout, key interfaces. |
| [COURT_CALIBRATION.md](COURT_CALIBRATION.md) | Court calibration flow: homography, ROI, manual click, artifacts. |
| [DETECTION_AND_TRACKING_OPTIONS.md](DETECTION_AND_TRACKING_OPTIONS.md) | **Match pipeline to best.pt:** default copy ingest, `--reencode`, `--conf`, `--roi`, `--detection-only`; where they live and how to maintain. |
| [DETECTION_TRAINING.md](DETECTION_TRAINING.md) | Custom-trained YOLO: where to train, YOLO26, how to use best.pt in CourtFlow. |
| [HEATMAP_PER_PLAYER.md](HEATMAP_PER_PLAYER.md) | Per-player court heatmap: spec and implementation outline (from CF_Training handout). |
| [INTELLIGENCE.md](INTELLIGENCE.md) | Improve accuracy: detection, tracking, ROI, ground point (vision layer). |
| [LICENSES_AND_PRE_LAUNCH.md](LICENSES_AND_PRE_LAUNCH.md) | OSS licenses (deps, Ultralytics/AGPL), pre-launch checklist (business, privacy, content, terms). |
| [PRE_PILOT_PRETRAINED.md](PRE_PILOT_PRETRAINED.md) | Pre-pilot: pretrained pipeline tuning only, no training. |
| [RUN_MATCH_TIME_AND_RESULTS.md](RUN_MATCH_TIME_AND_RESULTS.md) | Why run-match is slow, how to speed up, where to check results. |
| [TESTING.md](TESTING.md) | How to test: pipeline, calibration, API, dashboard. |
| [TODO_CODE.md](TODO_CODE.md) | Code improvement todo: vision, ball/padel, calibration, tests. |
| [WHATS_LEFT_IN_THE_SYSTEM.md](WHATS_LEFT_IN_THE_SYSTEM.md) | **What’s left:** dashboard, pipeline, pilot vs later. |
| [PILOT_AND_DATA_COLLECTION.md](PILOT_AND_DATA_COLLECTION.md) | Pilot workflow: good-enough tracking, collect data, train later. |
| [EDGE_DEPLOYMENT.md](EDGE_DEPLOYMENT.md) | Edge: Pi + 1080p PoE camera, record RTSP → run pipeline (BOM, options, Hailo). |

**Main:** [../README.md](../README.md) · **Deploy:** [../DEPLOY.md](../DEPLOY.md)
