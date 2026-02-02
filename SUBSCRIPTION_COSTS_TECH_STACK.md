# Subscription & Storage Costs – Your Tech Stack

Rough monthly costs for **Bitbucket**, **Fly.io**, **Cloudflare**, **Stripe**, **Clerk**, and **AI (OpenAI + Anthropic)** when running Canopy Sight. Verify on each vendor’s site; pricing changes.

---

## 1. Bitbucket (repo + CI)

| Plan | Pipelines minutes/mo | Storage | Rough monthly |
|------|----------------------|---------|----------------|
| **Free** | 50 min (public) / 0 (private) | 1 GB | **$0** |
| **Standard** | 250 min | 5 GB | **~$3/user** (min ~$15 for 5 users) |
| **Premium** | 3,500 min | Unlimited (fair use) | **~$6/user** |

- Your pipeline: install, lint, type-check, test, build web/api/edge → **~5–15 min/run**. At 2–4 runs/day that’s **~60–180 min/month**.
- **Typical:** **Standard** (~$15–30/mo for a small team) if you need private repo + enough minutes.

---

## 2. Fly.io (hosting: API, web, DB)

| Resource | Use case | Rough monthly |
|----------|----------|----------------|
| **Shared-cpu VMs** | API (1× 256MB or 512MB), Web (1× 256MB) | **~$5–15** total |
| **Postgres** | Managed Postgres (1× small) | **~$5–15** (or ~$0 if using free allowance) |
| **Redis** (optional) | Upstash Redis or Fly Redis | **~$0–10** |
| **Persistent volumes** | DB + any file storage | **~$0.15/GB** (~$2–5 for small DB) |

- **Free allowance:** Often a few shared-cpu VMs and a small amount of volume; good for dev/staging.
- **Typical prod:** **~$15–40/mo** for API + web + Postgres + a bit of volume.

---

## 3. Cloudflare (CDN, DNS, optional Workers/Pages)

| Product | Use case | Rough monthly |
|---------|----------|----------------|
| **DNS** | Domain + records | **$0** (free tier) |
| **CDN / Proxy** | Cache static assets, proxy to Fly | **$0** (free tier) |
| **Pages** (optional) | If you host Next.js on Pages instead of Fly | **$0** (free tier) |
| **Workers** (optional) | Edge logic, API proxy | **$0** (100k req/day free) then **~$5/mo** |
| **R2** (optional) | Object storage (clips, exports) | **$0** (10 GB free) then **~$0.015/GB** |
| **D1** (optional) | Edge SQL | **$0** (free tier) |

- **Typical:** **$0/mo** if you use free tiers; **~$5–20/mo** if you add Workers + R2.

---

## 4. Stripe (payments)

| Item | Model | Rough cost |
|------|--------|------------|
| **Transaction fees** | Per charge | **2.9% + $0.30** per successful card charge (US) |
| **Stripe Billing** (subscriptions) | If you sell SaaS subs | Same % + $0.30; no extra monthly fee for basic |
| **Stripe Tax** (optional) | If enabled | Extra % on top of fees |

- No fixed “subscription” to Stripe; cost is **% of revenue + optional products**.  
- Example: **$1,000/mo** in card revenue → **~$32/mo** in fees.

---

## 5. Clerk (login / auth)

| Plan | MAU (monthly active users) | Rough monthly |
|------|----------------------------|----------------|
| **Free** | 10,000 MAU | **$0** |
| **Pro** | 10,000 included, then overage | **~$25/mo** + overage |
| **Enterprise** | Custom | Custom |

- **Typical:** **$0** under 10k MAU; **~$25–50/mo** once you’re on Pro or need SSO/SAML.

---

## 6. AI – OpenAI + Anthropic (monthly, “working fully”)

Canopy Sight uses **OpenAI** (embeddings + summarization) and **Anthropic Claude** (analytics, NL query, compliance, predictive). Cost is **usage-based** (per token), not a fixed subscription.

| Provider | Model | Use in app | Approx. price (verify on vendor site) |
|----------|--------|-------------|----------------------------------------|
| **OpenAI** | text-embedding-3-small | 1 embedding per detection event | **~$0.02 / 1M tokens** |
| **OpenAI** | gpt-4o-mini | Event summarization (alerts) | **~$0.15 / 1M input, ~$0.60 / 1M output** |
| **Anthropic** | claude-3-5-sonnet-20241022 | NL query, anomaly/compliance/predictive chains, reports | **~$6 / 1M input, ~$30 / 1M output** |

**Rough monthly AI cost when “working fully”:**

| Scenario | Detections/mo | Reports + NL queries | **Total AI/month** |
|----------|----------------|----------------------|---------------------|
| **Light** | &lt; 10k events, few alerts | Few reports, occasional NL | **~$5–15** |
| **Medium** | 10k–50k events, regular alerts | Daily reports, regular NL | **~$15–40** |
| **Heavy** | 50k+ events, many alerts | Many reports, heavy NL/analytics | **~$40–100+** |

- Embeddings are cheap (e.g. 50k events ≈ 20M tokens ≈ **~$0.40**). Most cost is from **Claude** (reports, NL query, analytics) when used often.
- To cap cost: limit report frequency, cache NL results, or set usage alerts in OpenAI/Anthropic consoles.

---

## 7. Storage (summary)

| Where | What | Typical size | Rough monthly |
|-------|------|--------------|---------------|
| **Bitbucket** | Repo + build cache | 1–5 GB | Included in plan |
| **Fly.io volumes** | Postgres data | 1–10 GB | **~$2–5** |
| **Cloudflare R2** (optional) | Clips, exports, assets | 10–50 GB | **$0** (free tier) or **~$1–5** |
| **Clerk** | User/session data | N/A | Included |
| **Stripe** | Payment data | N/A | Included |

---

## 8. Total range (subscriptions + storage + AI)

| Stage | Bitbucket | Fly.io | Cloudflare | Stripe | Clerk | AI | **Total** |
|-------|-----------|--------|------------|--------|-------|-----|-----------|
| **Dev / small** | $0–15 | $0–20 | $0 | % of revenue | $0 | ~$5–15 | **~$5–50 + Stripe %** |
| **Prod (small)** | ~$15–30 | ~$20–40 | $0–10 | % of revenue | $0–25 | ~$15–40 | **~$50–145 + Stripe %** |
| **Prod (growing)** | ~$30+ | ~$40–80 | ~$5–20 | % of revenue | ~$25–50 | ~$40–100 | **~$140–280 + Stripe %** |

- **Stripe:** no fixed subscription; add **~2.9% + $0.30** per charge.
- **Clerk:** free until you exceed 10k MAU or need Pro features.

---

## 9. Checklist for your stack

- **Bitbucket:** Standard (or higher) if you need private repo + enough pipeline minutes.
- **Fly.io:** One org; 1–2 apps (API, web), Postgres (or external DB), optional Redis; persistent volumes for DB.
- **Cloudflare:** DNS + proxy (and optionally Workers/Pages/R2) for front-end and assets.
- **Stripe:** Connect in app; cost = transaction fees (+ optional Billing/Tax).
- **Clerk:** Connect in app; stay on free until MAU or feature needs justify Pro.
- **AI (OpenAI + Anthropic):** Pay-per-token; set usage alerts. See **§6** for "working fully" ranges (~$5–15 light, ~$15–40 medium, ~$40–100+ heavy).

For “what subscriptions and storage would it cost,” use the **Total range** row that matches your stage (dev vs prod, small vs growing); Stripe scales with revenue, AI scales with usage.
