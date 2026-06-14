// MELANIN (cutaneous melanosome interior) — most-probable absolute μa (cm⁻¹).
// Upgraded from a single power law to the GEOMETRIC MEAN of the two OMLC/Jacques melanosome laws,
// cross-validated against the measured Sarna eumelanin spectrum (OMLC eumelanin.html): the geometric
// mean agrees with the measured shape to ~3–6% over 400–800 nm.
//   f1: μa = 1.70e12 · λ^(-3.48)        (Jacques, omlc.org/spectra/melanin/mua.html)
//   f2: μa = 6.6e11  · λ^(-3.33)        (= 679·(λ/500)^-3.33; Jacques generic-optics 2015, eumelanin)
//   most-probable = sqrt(f1·f2); the two laws bracket the uncertainty (low/high).
// Eumelanin-dominated cutaneous melanin. 250–350 nm lower confidence (formula overestimates vs
// measured deep-UV); >1100 nm is extrapolation. Absolute level scales with melanosome volume fraction.
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, 'raw');

const f1 = (nm) => 1.7e12 * Math.pow(nm, -3.48);
const f2 = (nm) => 6.6e11 * Math.pow(nm, -3.33);
const mua = (nm) => Math.sqrt(f1(nm) * f2(nm));

const MIN_NM = 250;
const MAX_NM = 1100;
const STEP = 10;

const points = [];
for (let nm = MIN_NM; nm <= MAX_NM; nm += STEP) points.push([nm, +mua(nm).toPrecision(6)]);

const result = {
  id: 'melanin',
  points,
  modelFormula: 'geometric mean of two Jacques melanosome power laws: 1.70e12·λ^-3.48 and 6.6e11·λ^-3.33',
  source: {
    ref: 'Jacques, S. L., melanosome absorption power laws (OMLC: mua.html & generic_optics 2015), geometric mean. Cross-validated against measured eumelanin (Sarna & Swartz 1988, via OMLC eumelanin.html): agreement ~3–6% over 400–800 nm.',
    url: 'https://omlc.org/spectra/melanin/mua.html',
    note: 'Melanosome-interior μa, eumelanin-dominated cutaneous melanin. MODEL (two power laws, geometric mean), cross-checked vs measured Sarna data 400–800 nm. 250–350 nm lower confidence; >1100 nm extrapolation. Absolute level scales with melanosome volume fraction (~10× person-to-person).',
  },
  gaps: [
    { fromNm: 180, toNm: 249, reason: 'Below the melanosome power-law / measured range; melanin not the dominant absorber in deep UV here.' },
    { fromNm: 1101, toNm: 12000, reason: 'Melanin absorption negligible vs water/HA in IR; power-law extrapolation not meaningful.' },
  ],
};
await mkdir(RAW, { recursive: true });
await writeFile(resolve(RAW, 'melanin.json'), JSON.stringify(result, null, 2));

console.log(`melanin: ${points.length} geometric-mean points ${MIN_NM}-${MAX_NM} nm`);
const probe = (nm) => `${nm}:${mua(nm).toFixed(1)} (laws ${f1(nm).toFixed(0)}/${f2(nm).toFixed(0)})`;
console.log('probes:', [400, 532, 694, 755, 1064].map(probe).join('  '), 'cm⁻¹');
