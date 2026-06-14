// Fetch + normalize WATER absorption coefficient (μa, cm^-1) vs wavelength (nm).
// Primary: Segelstein (1981) — dense, full-range. Cross-check: Hale & Querry (1973).
// Both OMLC .dat files are already in absolute μa (1/cm); no conversion needed.
// Output: scripts/raw/water.json  { source, points: [[nm, mua_cm-1], ...] }
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, 'raw');

const SEGELSTEIN = 'https://omlc.org/spectra/water/data/segelstein81.dat';
const HALE = 'https://omlc.org/spectra/water/data/hale73.dat';

// Chart range of interest. Keep a little margin around 200 nm – 11 µm.
const MIN_NM = 180;
const MAX_NM = 12000;

const NUM = /^\s*([0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)\s+([0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)\s*$/;

function parseDat(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(NUM);
    if (!m) continue; // skips headers, blanks
    const nm = parseFloat(m[1]);
    const mua = parseFloat(m[2]);
    if (!Number.isFinite(nm) || !Number.isFinite(mua)) continue;
    out.push([nm, mua]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return r.text();
}

const [segTxt, haleTxt] = await Promise.all([get(SEGELSTEIN), get(HALE)]);
await mkdir(RAW, { recursive: true });
await writeFile(resolve(RAW, 'segelstein81.dat'), segTxt);
await writeFile(resolve(RAW, 'hale73.dat'), haleTxt);

const seg = parseDat(segTxt).filter(([nm]) => nm >= MIN_NM && nm <= MAX_NM);
const hale = parseDat(haleTxt).filter(([nm]) => nm >= MIN_NM && nm <= MAX_NM);

// Cross-check Segelstein against Hale at shared wavelengths (sanity, not for data).
function nearest(points, nm) {
  let best = null, bd = Infinity;
  for (const p of points) { const d = Math.abs(p[0] - nm); if (d < bd) { bd = d; best = p; } }
  return best;
}
const checks = [];
for (const [nm, m] of hale) {
  const s = nearest(seg, nm);
  if (s && Math.abs(s[0] - nm) <= 5) {
    const ratio = s[1] / m;
    checks.push({ nm, hale: m, seg: s[1], ratio: +ratio.toFixed(3) });
  }
}
const bad = checks.filter((c) => c.ratio < 0.5 || c.ratio > 2).length;

const result = {
  id: 'water',
  source: {
    ref: 'Segelstein, D. J. (1981), "The complex refractive index of water", M.S. thesis, University of Missouri-Kansas City. Cross-checked vs Hale & Querry (1973), Appl. Opt. 12:555.',
    url: 'https://omlc.org/spectra/water/',
    note: 'Absolute absorption coefficient μa in cm^-1, directly tabulated. Pure liquid water.',
  },
  points: seg,
};
await writeFile(resolve(RAW, 'water.json'), JSON.stringify(result, null, 2));

console.log(`water: ${seg.length} points in [${MIN_NM}, ${MAX_NM}] nm`);
console.log(`cross-check vs Hale: ${checks.length} shared λ, ${bad} disagree >2x`);
const probe = (nm) => { const p = nearest(seg, nm); return `${nm}nm -> ${p[1].toExponential(3)} cm^-1 (@${p[0]}nm)`; };
console.log('probes:', probe(532), '|', probe(1064), '|', probe(2780), '|', probe(2940), '|', probe(10600));
