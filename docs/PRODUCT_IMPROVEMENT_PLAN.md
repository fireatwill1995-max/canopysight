# Canopy Sight — Product Completion & Improvement Plan

This document is the master plan for making every page fully functional, intuitive, and production-ready. It follows the **Product Completion + Improvement Execution** lifecycle.

---

## Detection Visualization (DONE)

- **Requirement:** Do not use full-coloured circles for detections; use a **skinny outline box**.
- **Implementation:**
  - **event-playback.tsx:** Overlay is a 1px outline box, no fill; label remains above box.
  - **live-video-feed.tsx:** `drawHazardBoxes` draws only a 1px stroke rectangle (no fill, no circles). Label above box retained.

---

## 1. Page-by-Page Discovery & Plan

### 1.1 Home (`/`)

| Item | Status |
|------|--------|
| **Purpose** | Entry: redirect signed-in/demo users to dashboard, others to sign-in. |
| **User intent** | Land and get to the right place. |
| **Missing** | Optional: brief landing copy for unauthenticated visitors if they hit `/` before sign-in. |
| **Action** | Keep server redirect; ensure sign-in/sign-up and dashboard are the only destinations. No dead UI. |

---

### 1.2 Dashboard (`/dashboard`)

| Item | Status |
|------|--------|
| **Purpose** | Real-time overview: sites count, devices, active alerts, recent events; simulation CTA; sites list; live alert feed. |
| **User intent** | See system health, jump to sites, see live alerts. |
| **Missing / Incomplete** | Stats show "—" or N/A when API not in use; no real counts from `site.list`/`device.list`/`alert.list`. |
| **Actions** | (1) Optionally wire stats from real APIs (sites count, devices count, active alerts count, recent events) when not in simulation. (2) Add loading/skeleton for stats. (3) Ensure "Refresh sites" has aria-label and loading state. (4) Empty state for alert feed. (5) Breadcrumb or back from dashboard consistent with rest of app. |

---

### 1.3 Sign-in / Sign-up (`/sign-in`, `/sign-up`)

| Item | Status |
|------|--------|
| **Purpose** | Clerk-hosted auth. |
| **User intent** | Sign in or create account. |
| **Actions** | Ensure redirect after auth goes to dashboard; no custom dead UI (Clerk handles the form). |

---

### 1.4 Sites List (`/sites`)

| Item | Status |
|------|--------|
| **Purpose** | List sites, search, add site. |
| **User intent** | Find a site, create a new site. |
| **Missing / Incomplete** | Create modal: latitude/longitude validation (range); no loading state on submit; no "use current location" or map hint. |
| **Actions** | (1) Add loading state on Create (button disabled + "Creating..."). (2) Validate lat/long ranges (-90–90, -180–180). (3) Clear error state when modal opens. (4) Empty state already present; ensure link to create is obvious. (5) Optional: tooltip on coordinates "Decimal degrees, e.g. -33.8688". |

---

### 1.5 Site Detail (`/sites/[id]`)

| Item | Status |
|------|--------|
| **Purpose** | Overview, Live Feed, Zones, Mesh. Tabs; simulation toggle; zone CRUD; live video with detections (skinny outline box). |
| **User intent** | View site, watch live feed, manage zones, see mesh. |
| **Missing / Incomplete** | Overview tab: zones list not clickable to edit (could deep-link to Zones tab with zone selected). Zone edit modal: no validation (min 3 points). Delete zone: confirm dialog present. |
| **Actions** | (1) Overview zones: add "Edit" link that switches to Zones tab and opens edit for that zone. (2) Zone form validation (name required, type required). (3) Loading states on zone save/delete. (4) Live feed: detection boxes already updated to skinny outline. (5) Empty state when no devices: message + simulation CTA clear. |

---

### 1.6 Devices List (`/devices`)

| Item | Status |
|------|--------|
| **Purpose** | List devices, filter by status/type/site, search, add device, delete device. |
| **User intent** | Find device, add device, remove device. |
| **Missing / Incomplete** | Create modal: validate required fields; loading state. Delete: confirm exists. |
| **Actions** | (1) Create: loading state, validation (name, siteId), error display. (2) Clear filters button already present. (3) Empty state and no-results state clear. (4) Device cards: ensure "View" links to device detail. |

---

### 1.7 Device Detail (`/devices/[id]`)

| Item | Status |
|------|--------|
| **Purpose** | Show single device, edit, camera config, status. |
| **User intent** | View/edit device, manage camera. |
| **Actions** | Verify all buttons (Save, Add camera config, etc.) have handlers and loading/error feedback. Add empty state for no camera config. |

---

### 1.8 Alerts (`/alerts`)

| Item | Status |
|------|--------|
| **Purpose** | List alerts, filter (severity, status), search, acknowledge, resolve. |
| **User intent** | Triage alerts, acknowledge, resolve. |
| **Missing / Incomplete** | Simulation mode: mock data; real mode: API. Acknowledge/Resolve need loading state per row. |
| **Actions** | (1) Disable Acknowledge/Resolve in simulation with tooltip. (2) Per-row loading state for acknowledge/resolve. (3) Success toast already; ensure refetch after mutation. (4) Empty state when no alerts. |

---

### 1.9 Incidents List (`/incidents`)

| Item | Status |
|------|--------|
| **Purpose** | List incidents, filter, resolve, link to detail. |
| **User intent** | See incidents, resolve, open reconstruction. |
| **Actions** | (1) Resolve: loading state per row. (2) Link to incident detail/reconstruction. (3) Empty state. |

---

### 1.10 Incident Detail / Reconstruction (`/incidents/[id]`)

| Item | Status |
|------|--------|
| **Purpose** | Show incident reconstruction: timeline, conditions, links to related alerts/detections. |
| **User intent** | Understand what happened, resolve. |
| **Actions** | (1) Loading skeleton. (2) Error state with Retry and Back. (3) Resolve button with handler and loading state. (4) Breadcrumb: Incidents > [title]. |

---

### 1.11 Playback (`/playback`)

| Item | Status |
|------|--------|
| **Purpose** | Site + date range → list of events; select event → EventPlayback with video + **skinny outline box** overlay. |
| **User intent** | Review past detections by time. |
| **Missing / Incomplete** | When no site selected, empty state. When no events, empty state. Event list: loading skeleton. |
| **Actions** | (1) EventPlayback: detection overlay already skinny outline box. (2) "Select most recent" button disabled when no events. (3) Date validation: end >= start. (4) Optional: keyboard nav in event list. |

---

### 1.12 Analytics (`/analytics`)

| Item | Status |
|------|--------|
| **Purpose** | Heatmap, filters, detection list, trends, behavioral patterns, report generator. |
| **User intent** | Analyze detection distribution, risk, time of day, export report. |
| **Note** | Heatmap uses gradient circles for **density** (not object detection overlay); that stays. Detection overlays elsewhere use skinny outline box. |
| **Actions** | (1) Filters: ensure site required for heatmap with clear message. (2) Empty states for no data. (3) Report generator: ensure all buttons connected. (4) Loading states on filter change. |

---

### 1.13 Settings Root (`/settings`)

| Item | Status |
|------|--------|
| **Purpose** | Hub to Notifications, System, User, API Keys, Data Retention, Export. |
| **User intent** | Navigate to the right settings section. |
| **Actions** | Cards and links present; ensure each sub-page exists and is reachable. Add short guidance text. |

---

### 1.14 Settings Sub-pages

- **Notifications (`/settings/notifications`):** List/create/update/delete notification targets; loading and empty states.
- **User (`/settings/user`):** Profile/preferences; save with feedback.
- **API Keys (`/settings/api-keys`):** List/create/revoke; copy key on create; never show full key again.
- **System (`/settings/system`):** System-wide config; save with feedback.
- **Data Retention (`/settings/data-retention`):** Policies; save with feedback.
- **Export (`/settings/export`):** Export incidents/alerts/detections; trigger download or show "request submitted".

For each: ensure every button has a handler, loading state, and error/success feedback; no placeholder logic.

---

## 2. UX & Feature Research Summary

- **Consistency:** Same pattern for list pages: search, filters, clear filters, empty state, loading skeleton, per-row actions with loading state.
- **Feedback:** Every mutation: loading (disable button + text), success toast, error toast, refetch where needed.
- **Validation:** Required fields and ranges (e.g. lat/long, dates) validated before submit.
- **Accessibility:** aria-labels on icon-only buttons, focus management in modals.
- **Smart defaults:** Date range "last 7 days" on analytics; playback "yesterday–today".
- **No dead UI:** Remove or implement every button; no "Coming soon" without a clear alternative.

---

## 3. Architecture & Code Quality

- **No duplicated logic:** Shared hooks for list filtering, mutation feedback (toast + refetch).
- **Reusable components:** Card, Button, Skeleton, empty state component used consistently.
- **State:** Server state via tRPC; local UI state (modals, filters) in component or small context if needed.
- **Modularity:** Feature pages stay in app routes; shared components in `components/`; API in `apps/api`.

---

## 4. Testing & Deployment

- **Tests:** Run `npm run test`; fix failing tests in `apps/api/src/__tests__/`.
- **Stability:** No console errors; API failures show user-facing error and retry where appropriate.
- **Deploy:** Build (`npm run build` from root or per app); deploy API and Web to Fly.io per existing config; verify health after deploy.

---

## 5. Execution Checklist (High Level)

- [x] Detection: skinny outline box (event-playback, live-video-feed).
- [x] Dashboard: real stats when not simulation (sites, devices, active alerts, recent events); refresh loading state.
- [x] Sites: create validation (name, lat/long ranges); placeholders for coordinates.
- [ ] Site detail: zone edit from overview (optional); zone validation.
- [ ] Devices: create/delete already have loading; validation present.
- [x] Alerts: per-row loading for acknowledge/resolve; simulation disabled with tooltip.
- [x] Incidents: incident detail Resolve button + loading; error state Retry; success/error toasts.
- [x] Playback: date validation (end >= start); invalid range message; empty events when invalid.
- [ ] Analytics: filter/site requirement message; empty/loading states.
- [x] Settings: guidance text on root; sub-pages exist.
- [x] Run tests; fix failures (all 19 tests pass).
- [x] Build (turbo build succeeds).
- [ ] Deploy to Fly.io (use existing workflow; verify after deploy).

---

*Last updated: Product Completion Mode — full application pass.*
