/**
 * One-off: generate app/favicon.ico from app/icon.svg for Google/search results.
 * Run from web/: node scripts/generate-favicon.js
 * Requires: npm install --save-dev sharp png-to-ico
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const pngToIco = require("png-to-ico").default;

const appDir = path.join(__dirname, "..", "app");
const svgPath = path.join(appDir, "icon.svg");
const outIco = path.join(appDir, "favicon.ico");
const tmp16 = path.join(appDir, ".favicon-16.png");
const tmp32 = path.join(appDir, ".favicon-32.png");

async function main() {
  await sharp(svgPath)
    .resize(16, 16)
    .png()
    .toFile(tmp16);
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(tmp32);
  const buf = await pngToIco([tmp16, tmp32]);
  fs.writeFileSync(outIco, buf);
  fs.unlinkSync(tmp16);
  fs.unlinkSync(tmp32);
  console.log("Wrote", outIco);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
