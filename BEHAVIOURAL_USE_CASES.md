# Canopy Sight™ — Behavioural & environmental use cases

This document maps the product’s behavioural and environmental safety use cases to the software features so the same technology can be used consistently (hazard and pattern behaviour) across sites.

---

## A. Early behavioural indicators (environmental level)

**Goals:** Pacing and agitation patterns, repeated approach to reception points, clustering in waiting areas, abnormal dwell times.  
**Benefit:** Earlier staff presence and de-escalation → fewer violent incidents → safer working environment.

| Capability | Where it lives |
|------------|----------------|
| **Abnormal dwell times** | Edge-agent: `LoiteringDetector` (dwell time in zones, severity thresholds). Risk scorer: `dwellTimeFactor`. Detection events: `loiteringEvent` (duration, severity). |
| **Clustering in waiting areas** | Edge-agent: `ZoneAnalyzer.getOccupancyByZone()`. Event metadata: `behaviouralIndicator: "clustering"` when occupancy in zone ≥ 3; `occupancyInZone` in metadata. |
| **Pacing / agitation** | Risk scorer: `speedFactor` (velocity), `directionFactor`. Behavioural patterns (analytics): high frequency and risk escalation. *Future:* explicit pacing pattern (back-and-forth in zone) can use same zones + tracking. |
| **Repeated approach to reception points** | Define zones at reception; loitering + zone breach counts and analytics give “repeated approach” signals. |

---

## B. Congestion & flow-related safety risk

**Goals:** Overcrowding in corridors/waiting areas, pinch points near entrances/lifts/clinical areas, time-of-day pressure patterns.  
**Benefit:** Fewer trips, falls, and access blockages → better patient and staff safety.

| Capability | Where it lives |
|------------|----------------|
| **Overcrowding / pinch points** | Edge-agent: `behaviouralIndicator: "congestion"` when occupancy in zone ≥ 5; `occupancyInZone` in event metadata. |
| **Occupancy by zone** | API: `analytics.occupancyByZone(siteId, startDate, endDate)` → counts per zone. Web: Analytics → “Congestion & flow — occupancy by zone”. |
| **Time-of-day pressure** | API: `analytics.timeOfDayPressure(siteId?, startDate, endDate)` → events by hour, labels: Peak / Out-of-hours / Normal. Web: Analytics → “Time-of-day pressure”. Risk scorer: `timeOfDayFactor` (night 22–06, rush hours). |

---

## C. Lone worker & out-of-hours safety

**Goals:** Abnormal activity in normally quiet zones, delayed response to incidents after hours.  
**Benefit:** Improved staff confidence and reduced risk during evenings and nights.

| Capability | Where it lives |
|------------|----------------|
| **Out-of-hours risk** | Risk scorer: `timeOfDayFactor` (e.g. 22:00–06:00). Analytics: “Time-of-day pressure” with “Out-of-hours” label. |
| **Quiet-zone anomalies** | Same occupancy-by-zone + time-of-day: low baseline in a zone at night + sudden activity can be flagged via behavioural patterns and occupancy. |
| **Delayed response** | Incident reports + resolution timestamps; *future:* alert response timestamps for “delayed response” metrics. |

---

## D. Incident reconstruction & learning

**Goals:** Visual timeline, environmental context, contributing conditions (crowding, layout, timing).  
**Benefit:** Learning from incidents and improving layout and procedures.

| Capability | Where it lives |
|------------|----------------|
| **Visual timeline** | API: `incident.reconstruction(id, windowMinutes)` → `timeline` (detection events around incident time). Web: Incidents → “View reconstruction” → incident detail with timeline. |
| **Environmental context** | Incident report: `contributingConditions` (crowding, zoneIds, layoutNotes, timeOfDay/hourOfDay). Shown on reconstruction page. |
| **Contributing conditions** | Create/update incident with `contributingConditions`. Reconstruction returns them with the incident. |

---

## Summary

- **A (early behavioural):** Loitering/dwell (edge + risk), clustering (occupancy + behaviouralIndicator), pacing/agitation (speed + direction + patterns).  
- **B (congestion & flow):** Congestion/clustering (occupancy, behaviouralIndicator), occupancy by zone API + Analytics, time-of-day pressure API + Analytics.  
- **C (lone worker / out-of-hours):** Time-of-day factor and “Out-of-hours” in analytics; quiet-zone anomalies via occupancy + time.  
- **D (incident reconstruction):** `incident.reconstruction`, timeline, contributing conditions, and “View reconstruction” in the UI.

All of the above use the same principles: **zones**, **dwell/occupancy**, **risk scoring**, and **time-of-day**, so the same technology supports these use cases consistently across environments.
