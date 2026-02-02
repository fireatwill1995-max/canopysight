/**
 * Generates a PDF from the CANOPY. Business Plan HTML.
 * Run from repo root: node scripts/generate-business-plan-pdf.js
 * Requires: npm install puppeteer --save-dev (then: npx puppeteer browsers install chrome)
 *
 * Or use browser: open docs/CANOPY_Business_Plan.html → File → Print → Save as PDF
 */

const path = require("path");
const fs = require("fs");

const repoRoot = path.resolve(__dirname, "..");
const htmlPath = path.join(repoRoot, "docs", "CANOPY_Business_Plan.html");
const pdfPath = path.join(repoRoot, "docs", "CANOPY_Business_Plan.pdf");

if (!fs.existsSync(htmlPath)) {
  console.error("HTML not found:", htmlPath);
  process.exit(1);
}

(async () => {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.log("Run: npm install puppeteer --save-dev (or use npx puppeteer)");
    console.log("Alternatively, open docs/CANOPY_Business_Plan.html in a browser and use File → Print → Save as PDF.");
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
