# Business Documents — CANOPY.

## Files

- **CANOPY_Business_Plan.html** — Full business plan (overview, problem, solution, product, market, differentiation, commercial model, site modelling, deployment, status, vision) merged with proposal detail (partnership, product in detail, ROI, pricing, add-ons, security, tech). Open in a browser to read or to export as PDF.
- **BUSINESS_PROPOSAL_Canopy_Sight.html** — Original business proposal (Northern Edge Software, Darius, CANOPY.). Open in a browser to read or to export as PDF.

## How to get a PDF

### Option 1: Browser (no install)

1. Open **CANOPY_Business_Plan.html** (or **BUSINESS_PROPOSAL_Canopy_Sight.html**) in Chrome, Edge, or Firefox.
2. Use **File → Print** (or Ctrl+P).
3. Choose **Save as PDF** or **Microsoft Print to PDF** as the destination.
4. Set paper size to **A4** and margins to **Default** or **Minimum**.
5. Save the file (e.g. `CANOPY_Business_Plan.pdf` or `BUSINESS_PROPOSAL_Canopy_Sight.pdf`).

### Option 2: Script (requires Puppeteer)

From the repo root:

```bash
npm install puppeteer --save-dev
```

**Business plan PDF:**

```bash
node scripts/generate-business-plan-pdf.js
```

Output: **docs/CANOPY_Business_Plan.pdf**

**Original proposal PDF:**

```bash
node scripts/generate-proposal-pdf.js
```

Output: **docs/BUSINESS_PROPOSAL_Canopy_Sight.pdf**
