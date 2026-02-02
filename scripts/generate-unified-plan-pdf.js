/**
 * Generates the unified CANOPY. Business Plan PDF.
 * Run from repo root: node scripts/generate-unified-plan-pdf.js
 * Output: user's Desktop (or docs/ if Desktop not writable).
 */

const path = require("path");
const fs = require("fs");

const repoRoot = path.resolve(__dirname, "..");
const htmlPath = path.join(repoRoot, "docs", "CANOPY_Unified_Business_Plan.html");

// Prefer OneDrive Desktop (matches workspace); fallback to standard Desktop
const desktopPath =
  process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, "OneDrive", "Desktop")
    : path.join(process.env.HOME || "", "Desktop");
const desktopFallback = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, "Desktop")
  : path.join(process.env.HOME || "", "Desktop");

const pdfDir = fs.existsSync(desktopPath) ? desktopPath : (fs.existsSync(desktopFallback) ? desktopFallback : path.join(repoRoot, "docs"));
const pdfPath = path.join(pdfDir, "CANOPY_Business_Plan.pdf");

if (!fs.existsSync(htmlPath)) {
  console.error("HTML not found:", htmlPath);
  process.exit(1);
}

(async () => {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.log("Run: npm install puppeteer --save-dev");
    console.log("Or open docs/CANOPY_Unified_Business_Plan.html in a browser → File → Print → Save as PDF.");
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("file://" + htmlPath.replace(/\\/g, "/"), {
    waitUntil: "networkidle0",
  });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
  });
  await browser.close();
  console.log("PDF saved:", pdfPath);
})();
