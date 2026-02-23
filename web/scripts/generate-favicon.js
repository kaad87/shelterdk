/**
 * Genererer favicon og ikoner til browser + Google Search.
 * Kør fra web/: node scripts/generate-favicon.js
 * Kræver: npm install --save-dev sharp png-to-ico
 *
 * Opretter:
 *   app/favicon.ico      – 16x16, 32x32 (browser tabs)
 *   public/icon-48.png   – 48x48 (Google Search minimum)
 *   public/icon-96.png   – 96x96 (Google Search, høj opløsning)
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const pngToIco = require("png-to-ico").default;

const webDir = path.join(__dirname, "..");
const appDir = path.join(webDir, "app");
const publicDir = path.join(webDir, "public");
const svgPath = path.join(appDir, "icon.svg");
const outIco = path.join(appDir, "favicon.ico");
const tmp16 = path.join(appDir, ".favicon-16.png");
const tmp32 = path.join(appDir, ".favicon-32.png");
const icon48 = path.join(publicDir, "icon-48.png");
const icon96 = path.join(publicDir, "icon-96.png");

async function main() {
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Manglende: ${svgPath}`);
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  await sharp(svgPath).resize(16, 16).png().toFile(tmp16);
  await sharp(svgPath).resize(32, 32).png().toFile(tmp32);
  await sharp(svgPath).resize(48, 48).png().toFile(icon48);
  await sharp(svgPath).resize(96, 96).png().toFile(icon96);

  const buf = await pngToIco([tmp16, tmp32]);
  fs.writeFileSync(outIco, buf);
  fs.unlinkSync(tmp16);
  fs.unlinkSync(tmp32);

  console.log("Oprettet:", outIco, icon48, icon96);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
