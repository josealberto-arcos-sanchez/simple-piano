// Comprobación de coherencia del Service Worker con la app (Node puro, sin dependencias).
// Verifica que:
//   1. Todos los ficheros referenciados en index.html (src/href) están en CORE de sw.js.
//   2. Todos los módulos que importan los ficheros de js/ están en CORE.
//   3. Los iconos listados en manifest.json están en CORE.
//   4. Cada entrada de CORE existe en disco (y CORE incluye ./ e index.html).
//   5. La versión del cache de sw.js coincide con APP_VERSION de js/version.js.
// Uso:  node scripts/check-sw.mjs   (o npm run check)
// Salida: 0 si todo correcto, 1 con la lista de problemas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];

// normaliza './x' -> 'x' y '.' -> ''
function normalize(rel) {
  if (rel === '.' || rel === '') return '';
  if (rel.startsWith('./')) rel = rel.slice(2);
  return rel.replace(/^\/+/, '');
}

// ── lee sw.js y su lista CORE ──
const sw = read('sw.js');
const m = sw.match(/CORE\s*=\s*\[([\s\S]*?)\]/);
if (!m) {
  console.error('ERROR: no se encontró la lista CORE en sw.js');
  process.exit(1);
}
const core = new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => normalize(x[1])));
const inCore = (rel) => core.has(normalize(rel));

// ── 1. ficheros referenciados en index.html ──
const html = read('index.html');
for (const r of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const ref = r[1];
  if (!ref) continue;
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('#')) continue;
  if (ref.includes(':')) continue; // data:/mailto: etc.
  const norm = ref.replace(/\?.*$/, '').replace(/#.*$/, '');
  if (!inCore(norm)) {
    failures.push(`Falta en CORE de sw.js (referenciado en index.html): ${norm}`);
  }
}

// ── 2. imports de módulos de js/ ──
const jsDir = path.join(root, 'js');
for (const file of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(jsDir, file), 'utf8');
  for (const im of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = im[1];
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const rel = path.relative(root, path.resolve(jsDir, spec)).split(path.sep).join('/');
      if (!inCore(rel)) {
        failures.push(`Falta en CORE de sw.js (importado por js/${file}): ${rel}`);
      }
    }
  }
}

// ── 3. iconos de manifest.json ──
if (fs.existsSync(path.join(root, 'manifest.json'))) {
  const manifest = JSON.parse(read('manifest.json'));
  for (const ic of manifest.icons ?? []) {
    if (!inCore(ic.src)) {
      failures.push(`Falta en CORE de sw.js (icono de manifest.json): ${ic.src}`);
    }
  }
}

// ── 4. entradas de CORE: existencia en disco y entradas imprescindibles ──
if (!inCore('')) failures.push('CORE debe incluir ./ (raíz, para navegación offline)');
if (!inCore('index.html')) failures.push('CORE debe incluir index.html (fallback offline)');
for (const entry of core) {
  const p = entry ? path.join(root, entry) : root;
  if (!fs.existsSync(p)) failures.push(`Entrada de CORE no existe en disco: ${entry}`);
}

// ── 5. versión del cache de sw.js vs APP_VERSION ──
const vJs = read('js/version.js').match(/APP_VERSION\s*=\s*'([^']+)'/);
const vCache = sw.match(/CACHE\s*=\s*'([^']+)'/);
if (!vJs) failures.push('No se encontró APP_VERSION en js/version.js');
else if (!vCache) failures.push('No se encontró CACHE en sw.js');
else if (!vCache[1].includes(vJs[1])) {
  failures.push(`Versión desincronizada: cache de sw.js '${vCache[1]}' vs APP_VERSION '${vJs[1]}'`);
}

// ── resultado ──
if (failures.length > 0) {
  console.error(`ERROR: ${failures.length} problema(s) de coherencia con sw.js:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`OK: Service Worker coherente: CORE cubre index.html, imports e iconos; versión ${vJs[1]}.`);
