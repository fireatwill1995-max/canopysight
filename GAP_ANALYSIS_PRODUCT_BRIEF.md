# Gap Analysis — Current Repo vs CANOPY Product Brief (v1)

## Context / Assumption
This repository currently implements a **rail safety monitoring** product (sites, devices, detections, alerts, analytics). To meet the **CANOPY** brief, we align:
- **One environment** → a `Site` (GIS point + address) as the environment anchor.
- **One sensing modality** → edge devices / sensors already modeled (`Device`, `SystemHealth`) and detections (`DetectionEvent`).
- **One predictive output** → existing risk scoring + alerts.

## Coverage Summary

### ✅ Already Present (strong alignment)
- **API-first**: tRPC API with routers.
- **Time-aware by default**: timestamps across detections/alerts/system health; time-range queries.
- **GIS-native core**: `Site` lat/long; zones; heatmap.
- **Confidence surfaced**: detection confidence exists; risk scoring exists.
- **Operational views**: dashboard + analytics + alerts pages exist.
- **Alerts/notifications**: alerts router + notifications preferences exist.
- **Modular**: monorepo with `apps/api`, `apps/web`, `apps/edge-agent`, shared packages.

### ⚠️ Partial / Needs Improvement
- **Synthetic model state API**: not explicitly represented as a “living model” layer; needs an API that presents “current state” + confidence/uncertainty per layer.
- **Time-based playback (“what changed”)**: components exist (`EventPlayback`) but no end-to-end playback page/flow.
- **Scenario comparison (baseline vs current)**: not implemented.
- **External system integrations**: foundations exist (API), but no explicit integration endpoints.
- **Dark-mode, low-distraction UI**: theme tokens exist; needed a user-facing toggle and consistent dark styling across components.

### ❌ Missing (must implement for brief compliance)
- **Uncertainty scoring per data layer** (first-class): needs a consistent per-layer confidence model (not just per detection).
- **Ingestion flows** for:
  - UAV data (imagery/LiDAR/telemetry) — at least an ingestion API + metadata storage hooks.
  - Ground / temporary sensors — ingestion API + location tagging + buffering hooks.
  - External APIs (weather/mapping/historical) — adapter/hook layer.
  - Manual annotations — CRUD for annotations.
- **Time-based simulations**: at least a “simulation hook” API + basic scenario execution structure.
- **Feedback / re-tasking loop**: mechanism to turn decisions into sensing tasks (even a basic “tasking” endpoint).

## Fixes Implemented So Far (this session)
- **Dark-mode toggle**: added to `apps/web/src/components/navigation.tsx` (persists in `localStorage`) and improved dark-mode styles for cards/glass.
- **Incident feature completeness** (previous): added missing incident router + validators; fixed analytics mismatches; added behavioral patterns endpoint.

## Next Implementation Blocks (to reach v1 brief)
1. **Synthetic Model Layer**
   - Model state API (per-site “current” model)
   - Time-series persistence view and API
   - Layer confidence/uncertainty aggregation
2. **Deployable Sensing Ingestion**
   - Ingestion endpoints for sensor/UAV/external (metadata-first, payload later)
   - Time-sync + health/status reporting
   - Buffered upload hooks
3. **Operational Intelligence**
   - Playback page (“what changed”) using existing event timeline/playback components
   - Scenario compare (baseline snapshot vs current)
   - Reports wired to a real API endpoint (not placeholder)

