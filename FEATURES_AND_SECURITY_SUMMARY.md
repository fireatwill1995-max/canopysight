# Canopy Sight™ — Features & Security Summary

Short overview of software capabilities and how data and video are stored and protected.

---

## Features

### Core capabilities
- **Dashboard** — System metrics, site/device status, and high-level overview.
- **Sites** — Manage rail locations (name, address, coordinates); view devices, zones, and events per site.
- **Devices** — Monitor edge units (cameras, MeshConnect); status, heartbeat, firmware, stream URLs.
- **Alerts** — Alert center with severity (advisory, warning, critical) and status (active, acknowledged, resolved).
- **Playback** — Browse detection events and request time-limited signed URLs for video clips (S3/local).
- **Analytics** — Date-filtered analytics, heatmaps, and reporting.
- **Incidents** — Manual incident reports with severity and resolution tracking.
- **Settings** — User profile, API keys, data retention, export, notifications, and system configuration.

### Backend & AI
- **tRPC API** — 9 routers: sites, devices, detections, alerts, zones, analytics, video, notifications, system, MeshConnect, etc.
- **Multi-tenant** — All data scoped by organization; queries enforce `organizationId`.
- **Roles** — User roles (admin, supervisor, viewer) for access control.
- **Edge agent** — YOLO-based detection, zone breach detection, risk scoring, event upload, offline queue.
- **AI** — Claude integration, incident analysis, report generation, natural-language queries, vector search (pgvector).

### Data model (high level)
- Organizations, users (Clerk-ready; demo mode uses demo org/user), sites, devices, camera/MeshConnect configs.
- Detection events (type, confidence, bounding box, zone IDs, risk score, optional embedding).
- Video clips (metadata only: file path, duration, size, MIME type); actual files in S3 or local storage.
- Alerts, detection zones, heatmaps, incident reports, system health, audit logs, notification preferences.

---

## Security

### Authentication & access
- **Auth** — Designed for **Clerk** (production). Current build supports **demo mode** (demo user + demo organization) so all protected procedures have a valid org/user context.
- **Protected procedures** — All sensitive tRPC routes use `protectedProcedure`; they require a valid `userId` and `organizationId` from context. Unauthorized requests receive `UNAUTHORIZED`.
- **Organization scoping** — Every query that returns or updates data filters by `organizationId` (e.g. video clip lookup for signed URLs), so tenants cannot access other tenants’ data.

### API & infrastructure
- **Helmet** — Security headers (CSP, etc.) on the Express API.
- **CORS** — Allowed origins configurable via `ALLOWED_ORIGINS`; localhost and ngrok patterns supported for development.
- **Rate limiting** — In-memory rate limiter (e.g. 100 requests per 60s per key); production can use Redis for distributed limiting.
- **Credentials** — API keys, Clerk keys, and database URLs live in environment variables (`.env`), not in code. See `SETUP_ENV.md`.

### Data storage
- **Database** — **PostgreSQL** via Prisma. Connection string in `DATABASE_URL`. Schema includes indexes and relations; optional **pgvector** for embeddings.
- **Sensitive fields** — MeshConnect config supports `encryptionEnabled` and stores encryption key and WiFi password as encrypted fields (AES-256 noted in schema).
- **Audit** — `AuditLog` records action, resource type, resource id, user, IP, user-agent, and changes for a compliance trail.

### Video storage
- **What’s stored** — Only **metadata** in PostgreSQL: `VideoClip` (file path, thumbnail path, duration, start/end time, size, MIME type). No raw video in the database.
- **Where files live** — Designed for **S3 or local storage**; `filePath` and `thumbnailPath` point to those locations.
- **Access control** — Clip access is only via **signed URLs**:
  - `getSignedUrl` and `getThumbnailUrl` are **protected procedures**.
  - Server looks up the clip by `clipId` **and** `organizationId`; if the clip doesn’t belong to the caller’s org, the request fails.
  - Signed URLs are short-lived (e.g. 60s–24h configurable); current implementation uses a placeholder URL until real S3 (or equivalent) signed URL generation is wired in.
- **Recommendation** — In production, replace the placeholder in `generateSignedUrl` (e.g. AWS S3 `getSignedUrl`) so links are cryptographically time-limited and point to your bucket.

---

## Summary table

| Area              | Implementation summary |
|-------------------|------------------------|
| **Auth**          | Clerk-ready; demo mode with org/user context for protected routes. |
| **Data isolation**| Strict organization-scoped queries and mutations. |
| **API security**  | Helmet, CORS, rate limiting, env-based secrets. |
| **Database**      | PostgreSQL + Prisma; optional encryption for sensitive config fields; audit log. |
| **Video**         | Metadata in DB; files in S3/local; access only via org-scoped, time-limited signed URLs (S3 signing to be completed in production). |

---

*This document reflects the current codebase (e.g. demo auth, placeholder signed URL). For production, configure Clerk, real S3 signed URLs, Redis rate limiting, and backups as described in `DEPLOYMENT_GUIDE.md` and `README.md`.*
