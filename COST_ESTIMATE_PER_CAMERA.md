# Rough Monthly Run Cost per Camera – Canopy Sight

Ballpark figures to feed into business cases. Actuals depend on deployment (self‑hosted vs cloud), region, scale, and how you allocate shared backend costs.

---

## 1. Edge (per camera)

| Item | Notes | Rough monthly |
|------|--------|----------------|
| **Hardware (amortized)** | Raspberry Pi 4 (or similar) + power + SD/storage. Assume ~\$80–150 one‑off, 3–5 year life. | **\$2–5** |
| **Power** | Pi ~3–5 W; 24/7 ≈ 2.5–4 kWh/month at typical commercial rates. | **\$0.50–2** |
| **Network** | Existing site LAN; no extra if you don’t use cellular. | **\$0** (or add cellular if needed) |

**Edge subtotal (per camera): ~\$2.50–7/month** (excluding one‑time hardware).

---

## 2. Backend (shared across all cameras)

API + PostgreSQL + optional Redis + (optional) object storage. Allocate per camera by dividing total backend cost by camera count.

| Item | Small (e.g. 10–50 cams) | Medium (50–200 cams) |
|------|--------------------------|------------------------|
| **API + web** | Single VPS/small instance (~\$20–60/mo) or PaaS (~\$25–75/mo) | Scaled / managed (~\$80–200/mo) |
| **PostgreSQL** | Managed DB (~\$15–50/mo) or same VPS | Dedicated / larger (~\$50–150/mo) |
| **Redis** (optional) | Small instance or same host (~\$0–15/mo) | (~\$15–40/mo) |
| **Storage** (clips/events) | 10–50 GB (~\$1–5/mo) | 50–200 GB (~\$5–25/mo) |

**Example:** Total backend ~\$50–120/mo for 20 cameras → **~\$2.50–6 per camera/month**.  
For 100 cameras, backend ~\$150–400/mo → **~\$1.50–4 per camera/month**.

---

## 3. Bandwidth

- **Edge → API:** Events, heartbeats, optional thumbnails/clips; typically **&lt; 1 GB/camera/month** unless you upload a lot of video.
- **Viewing:** Live view and playback from central; depends on usage, not camera count.

Roughly **\$0.10–0.50/camera/month** for event/telemetry traffic in many regions; more if you stream or store a lot of video in the cloud.

---

## 4. Total range (monthly run cost per camera)

| Scenario | Per camera (run cost only) |
|----------|----------------------------|
| **Low** (self‑hosted, small scale, minimal storage) | **~\$5–12** |
| **Mid** (managed DB, some storage, 20–50 cams) | **~\$10–18** |
| **High** (cloud‑heavy, more storage, redundancy) | **~\$15–25** |

Excluded: one‑time hardware, installation, support, or licensing of third‑party services (e.g. Maps, Sentry).

---

## 5. What drives cost

- **Edge:** Power and (if applicable) cellular; hardware is usually amortized.
- **Backend:** Database size and retention, API/web hosting tier, Redis if used.
- **Storage:** Volume of stored clips/events and retention policy.
- **Scale:** Per‑camera backend cost usually **falls** as camera count increases (shared API/DB).

Use the ranges above as inputs for “monthly run cost per camera to maintain” the system; refine with your actual deployment and vendor quotes.
