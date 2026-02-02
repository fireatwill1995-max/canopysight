# CANOPY Product Brief (v1) — Requirement Checklist

This checklist is transcribed from `CANOPY. - Product Brief.pdf` (Prime Three Offerings v1).

## 1) Synthetic Models (Core Platform)

### Inputs (v1)
- UAV data (imagery, LiDAR, telemetry)
- Ground / temporary sensor nodes (environmental, vibration, etc.)
- External APIs (weather, mapping, historical datasets)
- Manual annotations (optional)

### Core capabilities (v1)
- Real-time state representation (“what is happening now”)
- Time-series persistence (“what has happened”)
- Predictive modelling hooks (“what may happen next”)
- Spatial awareness (GIS-native)
- Uncertainty scoring (confidence per data layer)

### Outputs (v1)
- Model state API
- Time-based simulations
- Data layers consumable by dashboards and external systems

### Non-goals (v1)
- Photorealistic rendering
- Game-engine visuals
- AI-only “black box” predictions

## 2) Deployable Sensing (Truth Layer)

### Components (v1)
- UAV-based data acquisition
- Temporary / mobile ground sensors
- Mesh or backhaul communications
- Location-aware data tagging

### Core capabilities (v1)
- Rapid deployment (minutes, not weeks)
- Automatic geospatial tagging
- Time-synchronised data streams
- Health/status reporting for sensors
- Seamless ingestion into Synthetic Models

### Outputs (v1)
- Live sensor streams
- Buffered data uploads
- Sensor metadata (location, uptime, confidence)

### Non-goals (v1)
- Mass-manufactured sensor hardware
- Long-term fixed infrastructure replacement
- Perfect accuracy (confidence is surfaced instead)

## 3) Operational Intelligence (Decision Layer)

### Core capabilities (v1)
- Live situational awareness views
- Alerts based on model thresholds
- Time-based playback (“what changed”)
- Scenario comparison (baseline vs current)
- Integration with existing GIS / ops tools

### Outputs (v1)
- Dashboards
- Alerts / notifications
- Reports
- External system integrations

### Non-goals (v1)
- Custom dashboards for every user
- Heavy workflow engines
- Complex permissions hierarchies

## System relationship (critical)
- Deployable Sensing ↓ Synthetic Models ↓ Operational Intelligence ↑ Feedback / Re-tasking
- “Sensing feeds models; models inform decisions; decisions drive new sensing”

## Technical principles (guiding rules)
- API-first architecture
- GIS-native data structures
- Time-aware by default
- Confidence and uncertainty are first-class data
- Modular (each layer usable independently)
- Dark-mode, low-distraction UI

## Focus summary
### Build this first
- Ingestion → Model → Visualisation loop
- One environment
- One sensing modality
- One predictive output

### Explicitly defer
- Scale optimisation
- Full automation
- Advanced AI/ML
- Broad hardware support

