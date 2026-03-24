/**
 * Generates Canopy Sight Development Plan PDF to the user's Desktop.
 * Run from repo root: node scripts/generate-funding-plan-pdf.js
 * Requires: npm install puppeteer --save-dev (then: npx puppeteer browsers install chrome)
 */

const path = require("path");
const fs = require("fs");

const repoRoot = path.resolve(__dirname, "..");
const htmlPath = path.join(repoRoot, "docs", "Canopy_Sight_Development_Plan_Funding.html");

// Desktop: prefer OneDrive\Desktop then Desktop
const userProfile = process.env.USERPROFILE || process.env.HOME || ".";
const desktopOneDrive = path.join(userProfile, "OneDrive", "Desktop");
const desktopPlain = path.join(userProfile, "Desktop");
const desktopDir = fs.existsSync(desktopOneDrive) ? desktopOneDrive : desktopPlain;
const pdfPath = path.join(desktopDir, "Canopy_Sight_Development_Plan_Funding.pdf");

if (!fs.existsSync(htmlPath)) {
  console.error("HTML not found:", htmlPath);
  process.exit(1);
}

(async () => {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.log("Puppeteer not found. Run: npm install puppeteer --save-dev");
    console.log("Then: npx puppeteer browsers install chrome");
    console.log("");
    console.log("Alternatively, open this file in a browser and use File → Print → Save as PDF:");
    console.log(htmlPath);
    console.log("");
    console.log("Target PDF path:", pdfPath);
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
  console.log("PDF saved to Desktop:", pdfPath);
})();
