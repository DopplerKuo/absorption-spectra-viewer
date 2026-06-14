// Generate MELANIN (melanosome interior) absorption coefficient from the OMLC / Jacques
// power-law approximation. This is a MODEL FIT, not tabulated experimental points — labeled as such.
//   μa = 1.70e12 * λ^(-3.48) cm^-1   (skin)      λ in nm
// Source: S. L. Jacques, "Melanosome absorption coefficient", OMLC (omlc.org/spectra/melanin/),
//   based on Jacques & McAuliffe (1991) and Jacques et al. (1996).
// Validity: visible–NIR where melanin dominates. We emit 300–1100 nm and mark the rest as a gap.
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, 'raw');

const A = 1.7e12;
const B = 3.48;
const mua = (nm) => A * Math.pow(nm, -B);

const MIN_NM = 300;
const MAX_NM = 1100;
const STEP = 10;

const points = [];
for (let nm = MIN_NM; nm <= MAX_NM; nm += STEP) {
  points.push([nm, +mua(nm).toPrecision(6)]);
}

const result = {
  id: 'melanin',
  points,
  modelFormula: 'mu_a = 1.70e12 * lambda_nm^(-3.48) [cm^-1] (skin)',
  source: {
    ref: 'Jacques, S. L., melanosome interior absorption coefficient, OMLC. Power-law fit from Jacques & McAuliffe (1991) Photochem. Photobiol. 53:769; Jacques et al. (1996) SPIE 2681:468.',
    url: 'https://omlc.org/spectra/melanin/mua.html',
    note: 'MODEL fit (not tabulated). Melanosome interior μa. Concentration of melanin varies ~10x; this is the canonical average shape. Emitted 300-1100 nm only.',
  },
  gaps: [
    { fromNm: 180, toNm: 299, reason: 'Power-law fit not validated in UV; melanin not the dominant absorber there.' },
    { fromNm: 1101, toNm: 12000, reason: 'Melanin absorption negligible vs water/HA in IR; power-law extrapolation not meaningful.' },
  ],
};
await mkdir(RAW, { recursive: true });
await writeFile(resolve(RAW, 'melanin.json'), JSON.stringify(result, null, 2));
console.log(`melanin: ${points.length} model points ${MIN_NM}-${MAX_NM} nm`);
console.log('probes:', [400, 532, 694, 755, 1064].map((nm) => `${nm}:${mua(nm).toFixed(1)}`).join(' '), 'cm^-1');
