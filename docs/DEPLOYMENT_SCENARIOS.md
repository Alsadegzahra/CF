# CourtFlow Deployment Scenarios

All possible ways to deploy CourtFlow at a padel court. Each scenario combines a camera type, a compute location, and the hardware needed.

---

## Scenario 1: CSI Camera + Edge CPU

The simplest edge setup. Camera plugs directly into the board. The board does all recording and processing using its CPU only. Slow but fully offline.

```
At court:                        Cloud:
┌─────────────────────┐          ┌─────────┐
│  Single-board computer│         │ Storage │
│  + CSI camera (ribbon)│─upload─▶│ results │
│  + SSD               │         └─────────┘
│                      │
│  Records + processes │
│  (CPU only, slow)    │
└──────────────────────┘
```

| | |
|---|---|
| At court | Single-board computer, CSI camera, SSD, power supply, cooler |
| Hardware cost | ~$150 |
| Cloud cost/month | ~$2 (storage only) |
| Processing time | ~60 min/match |
| Camera range | ~30cm (ribbon cable) |
| Internet | Only for upload |
| Pros | Fully offline processing, no recurring GPU cost |
| Cons | Very slow, overheating risk, camera stuck to board |

---

## Scenario 2: CSI Camera + Edge AI Accelerator

Same as Scenario 1 but with a dedicated AI chip that accelerates YOLO inference. Much faster processing while staying fully on-device.

```
At court:                        Cloud:
┌─────────────────────┐          ┌─────────┐
│  Single-board computer│         │ Storage │
│  + CSI camera         │─upload─▶│ results │
│  + AI accelerator    │         └─────────┘
│  + SSD               │
│                      │
│  Records + processes │
│  (accelerated, fast) │
└──────────────────────┘
```

| | |
|---|---|
| At court | Single-board computer, CSI camera, AI accelerator, SSD, power supply, cooler |
| Hardware cost | ~$230 |
| Cloud cost/month | ~$2 (storage only) |
| Processing time | ~5-10 min/match |
| Camera range | ~30cm (ribbon cable) |
| Internet | Only for upload |
| Pros | Fast edge processing, low cloud cost, offline capable |
| Cons | More expensive hardware, AI chip integration complexity, camera stuck to board |

---

## Scenario 3: CSI Camera + Full Board + Cloud GPU

Board records video and uploads to cloud. A GPU in the cloud does all the AI processing. Board is more powerful than needed but works.

```
At court:                        Cloud:
┌───────────────────┐  upload    ┌─────────┐
│  Single-board      │──video──▶ │ Storage │
│  computer          │           └────┬────┘
│  + CSI camera      │           ┌────▼────┐
│                    │           │GPU worker│
│  Records + uploads │           └────┬────┘
└────────────────────┘           ┌────▼────┐
                                 │ Results │──▶ Dashboard
                                 └─────────┘
```

| | |
|---|---|
| At court | Single-board computer, CSI camera, power supply |
| Hardware cost | ~$100 |
| Cloud cost/month | ~$15 |
| Processing time | ~3 min/match |
| Camera range | ~30cm (ribbon cable) |
| Internet | Required (for upload) |
| Pros | Fast results, simple software on device |
| Cons | Board is overpowered for just recording, camera stuck to board |

---

## Scenario 4: CSI Camera + Minimal Board + Cloud GPU (cheapest)

Same as Scenario 3 but with the cheapest possible board. Since the board only records and uploads, it doesn't need much power.

```
At court:                        Cloud:
┌───────────────────┐  upload    ┌─────────┐
│  Minimal board     │──video──▶ │ Storage │
│  (low-power)       │           └────┬────┘
│  + CSI camera      │           ┌────▼────┐
│                    │           │GPU worker│
│  Records + uploads │           └────┬────┘
└────────────────────┘           ┌────▼────┐
                                 │ Results │──▶ Dashboard
                                 └─────────┘
```

| | |
|---|---|
| At court | Low-power board, CSI camera, power supply |
| Hardware cost | **~$45** (cheapest option with a board) |
| Cloud cost/month | ~$15 |
| Processing time | ~3 min/match |
| Camera range | ~30cm (ribbon cable) |
| Internet | Required |
| Pros | Cheapest hardware, fast cloud results, low power, no cooling needed |
| Cons | Camera stuck to board, both must mount together |

---

## Scenario 5: PoE IP Camera + Full Board + Edge AI Accelerator

Professional edge setup. IP camera is mounted far away, connected by a long Ethernet cable. Board does all processing locally with an AI accelerator.

```
At court:
              Ethernet (up to 100m)
┌──────────┐       ┌───────────┐
│ IP Camera│◀──────│ PoE power │
│ (mounted │       └─────┬─────┘         Cloud:
│  high)   │             │               ┌─────────┐
└──────────┘       ┌─────▼─────┐         │ Storage │
                   │  Router   │         │ results │
                   └─────┬─────┘         └─────────┘
                   ┌─────▼──────────┐        ▲
                   │ Single-board    │        │
                   │ computer        │─upload─┘
                   │ + AI accelerator│
                   │ + SSD           │
                   │ Records+process │
                   └────────────────┘
```

| | |
|---|---|
| At court | IP camera, PoE injector, router, Ethernet cables, single-board computer, AI accelerator, SSD |
| Hardware cost | ~$350 |
| Cloud cost/month | ~$2 (storage only) |
| Processing time | ~5-10 min/match |
| Camera range | **Up to 100m** (Ethernet) |
| Internet | Only for upload |
| Pros | Camera far from board, fast local processing, works offline |
| Cons | Most expensive, most devices to manage, complex setup |

---

## Scenario 6: PoE IP Camera + Minimal Board + Cloud GPU

IP camera mounted far away. A cheap board records the stream and uploads to cloud. GPU in the cloud does all processing. Good balance of flexibility and cost.

```
At court:
              Ethernet (up to 100m)
┌──────────┐       ┌───────────┐
│ IP Camera│◀──────│ PoE power │
│ (mounted │       └─────┬─────┘         Cloud:
│  high)   │             │               ┌─────────┐
└──────────┘       ┌─────▼─────┐         │ Storage │
                   │  Router   │         └────┬────┘
                   └─────┬─────┘         ┌────▼────┐
                   ┌─────▼──────────┐    │GPU worker│
                   │ Minimal board  │    └────┬────┘
                   │ Records RTSP   │    ┌────▼────┐
                   │ + uploads      │──▶ │ Results │──▶ Dashboard
                   └────────────────┘    └─────────┘
```

| | |
|---|---|
| At court | IP camera, PoE injector, router, Ethernet cables, low-power board |
| Hardware cost | ~$120 |
| Cloud cost/month | ~$15 |
| Processing time | ~3 min/match |
| Camera range | **Up to 100m** (Ethernet) |
| Internet | Required |
| Pros | Camera far from board, fast cloud results, relatively cheap |
| Cons | More devices than CSI setups, needs reliable internet |

---

## Scenario 7: Smart IP Camera + Cloud GPU (no board)

The simplest setup. A camera that can upload video directly to cloud storage (S3/R2 compatible). No board, no router (uses venue network). Just a camera and a PoE injector.

```
At court:                        Cloud:
┌──────────┐   upload direct     ┌─────────┐
│ IP Camera│────video──────────▶ │ Storage │
│ (PoE)    │                     └────┬────┘
└──────────┘                     ┌────▼────┐
                                 │GPU worker│
 Just a camera.                  └────┬────┘
 No board.                       ┌────▼────┐
 No router.                      │ Results │──▶ Dashboard
                                 └─────────┘
```

| | |
|---|---|
| At court | Camera + PoE injector (uses venue network) |
| Hardware cost | ~$50-150 |
| Cloud cost/month | ~$15 |
| Processing time | ~3 min/match |
| Camera range | Wherever you mount it |
| Internet | Required (camera uploads directly) |
| Pros | Fewest devices, simplest install, cheapest possible |
| Cons | Hard to find cameras that upload to R2/S3 directly, less control over file naming/match IDs |

---

## Comparison Table

| Scenario | Camera | Board | Compute | Hardware | $/month | Speed | Range | Devices at court |
|----------|--------|-------|---------|---------|---------|-------|-------|-----------------|
| 1 | CSI | Full | Edge CPU | $150 | $2 | 60 min | 30cm | 2 |
| 2 | CSI | Full | Edge + AI | $230 | $2 | 5-10 min | 30cm | 2 |
| 3 | CSI | Full | Cloud GPU | $100 | $15 | 3 min | 30cm | 2 |
| 4 | CSI | Minimal | Cloud GPU | **$45** | $15 | 3 min | 30cm | 2 |
| 5 | IP (PoE) | Full | Edge + AI | $350 | $2 | 5-10 min | 100m | 5 |
| 6 | IP (PoE) | Minimal | Cloud GPU | $120 | $15 | 3 min | 100m | 5 |
| **7** | **IP (smart)** | **None** | **Cloud GPU** | **$50-150** | **$15** | **3 min** | **Any** | **2** |

---

## Recommendations

- **Testing at home:** Scenario 3 (what we have working now — Pi 5 + Pi Camera + Cloud)
- **First real court:** Scenario 6 (IP camera far from board, cloud processing)
- **Scaling to many courts:** Scenario 4 or 7 (cheapest per court)
- **No internet at court:** Scenario 2 or 5 (everything on-device)
- **Dream setup:** Scenario 7 (just a camera, everything else in the cloud)
