/**
 * Generate favicon and PWA icons from carwiseiq-logo.jpg using sharp.
 * Run from frontend: node scripts/generate-favicons.js
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const toIco = require('to-ico');

const FRONTEND = path.join(__dirname, '..');
const PUBLIC = path.join(FRONTEND, 'public');
const APP = path.join(FRONTEND, 'app');
const ICONS_DIR = path.join(PUBLIC, 'icons');
const LOGO_PATH = path.join(PUBLIC, 'carwiseiq-logo.jpg');

async function main() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.error('Logo not found:', LOGO_PATH);
    process.exit(1);
  }
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const sizes = [
    { size: 180, out: path.join(PUBLIC, 'apple-touch-icon.png') },
    { size: 192, out: path.join(ICONS_DIR, 'icon-192x192.png') },
    { size: 512, out: path.join(ICONS_DIR, 'icon-512x512.png') },
  ];

  let favicon32Buffer = await sharp(LOGO_PATH)
    .resize(32, 32)
    .png()
    .toBuffer();

  for (const { size, out } of sizes) {
    const buffer = await sharp(LOGO_PATH)
      .resize(size, size)
      .png()
      .toBuffer();
    fs.writeFileSync(out, buffer);
    console.log('Written:', path.relative(FRONTEND, out));
  }

  // favicon.ico from 32x32 PNG
  const icoBuffer = await toIco([favicon32Buffer]);
  const faviconPath = path.join(PUBLIC, 'favicon.ico');
  fs.writeFileSync(faviconPath, icoBuffer);
  console.log('Written:', path.relative(FRONTEND, faviconPath));

  // app/icon.png for Next.js (32x32)
  const appIconPath = path.join(APP, 'icon.png');
  await sharp(LOGO_PATH)
    .resize(32, 32)
    .png()
    .toFile(appIconPath);
  console.log('Written:', path.relative(FRONTEND, appIconPath));

  console.log('Favicon generation complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
