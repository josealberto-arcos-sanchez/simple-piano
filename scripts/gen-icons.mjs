// Genera los iconos de Simple Piano (PNG 192 / 512 / 512 maskable).
// Dibuja el diseño como SVG y lo renderiza con Chromium (Playwright).
// Requiere el navegador de Playwright:  npx playwright install chromium
// Uso:  node scripts/gen-icons.mjs   (o npm run icons)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');

// Todas las medidas están en unidades de 1/100 del lado (u = size / 100).
function iconSvg(size, maskable) {
  const u = size / 100;
  const m = maskable ? size * 0.13 : size * 0.06;
  const pw = size - 2 * m;
  const py = size * 0.54;
  const ph = size * 0.33;

  const notes = [
    { x: 20, y: 16, c: '#4ade80' },
    { x: 52, y: 28, c: '#f472b6' },
    { x: 78, y: 10, c: '#ffd166' },
  ].map((n) => `<rect x="${n.x * u}" y="${n.y * u}" width="${14 * u}" height="${19 * u}" rx="${3.5 * u}" fill="${n.c}" stroke="rgba(255,255,255,0.9)" stroke-width="${1.8 * u}"/>`);

  const keyboard = `<rect x="${m}" y="${py}" width="${pw}" height="${ph}" rx="${6 * u}" fill="#f8fafc"/>`;

  const dividers = [1, 2, 3, 4].map((i) => {
    const x = m + (pw * i) / 5;
    return `<line x1="${x}" y1="${py + 2 * u}" x2="${x}" y2="${py + ph - 2 * u}" stroke="#cbd5e1" stroke-width="${1.2 * u}"/>`;
  });

  const bkw = pw * 0.11;
  const bkh = ph * 0.58;
  const blackKeys = [1, 2, 4].map((f) => {
    const x = m + (pw * f) / 5 - bkw / 2;
    return `<rect x="${x}" y="${py - 1.5 * u}" width="${bkw}" height="${bkh}" rx="${1.5 * u}" fill="#111827"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset="1" stop-color="#25124e"/></linearGradient></defs>
<rect width="${size}" height="${size}" fill="url(#bg)"/>
${notes.join('\n')}
${keyboard}
${dividers.join('\n')}
${blackKeys.join('\n')}
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, maskable } of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0">${iconSvg(size, maskable)}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(outDir, file) });
    console.log(`OK  icons/${file} (${size} px)`);
  }
} finally {
  await browser.close();
}
