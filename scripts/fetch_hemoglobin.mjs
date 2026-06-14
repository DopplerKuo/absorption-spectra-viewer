// Fetch + normalize HEMOGLOBIN (HbO2 oxy, Hb deoxy).
// Source: Scott Prahl compilation (Gratzer + Kollias), OMLC.
// summary.html holds a <pre> table: lambda(nm)  HbO2(cm^-1/M)  Hb(cm^-1/M)  [molar extinction].
// Convert to absorption coefficient for WHOLE BLOOD:
//   μa = 2.303 * ε * (x / 64500),  x = 150 g/L (typical whole blood)  [per OMLC].
// We keep BOTH the molar extinction ε (for the reserved concentration dimension)
// and the converted μa at the default concentration.
// Output: scripts/raw/hemoglobin.json
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, 'raw');
const URL = 'https://omlc.org/spectra/hemoglobin/summary.html';

const HB_MW = 64500; // g/mole
const DEFAULT_GPL = 150; // g/L whole blood
const factor = (gpl) => (2.303 * gpl) / HB_MW; // μa = factor * ε

const r = await fetch(URL);
if (!r.ok) throw new Error(`fetch ${URL} -> ${r.status}`);
const html = await r.text();
await mkdir(RAW, { recursive: true });
await writeFile(resolve(RAW, 'hemoglobin_summary.html'), html);

// Extract the <pre>...</pre> block containing the data table.
const pre = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/gi)].map((m) => m[1]);
const ROW = /^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/;
const rows = [];
for (const block of pre) {
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(ROW);
    if (!m) continue;
    rows.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]); // nm, HbO2 ε, Hb ε
  }
}
rows.sort((a, b) => a[0] - b[0]);
if (rows.length < 100) throw new Error(`parsed only ${rows.length} hemoglobin rows — table format changed?`);

const f = factor(DEFAULT_GPL);
const mk = (idx) => ({
  epsilon: rows.map((r0) => [r0[0], r0[idx]]),       // cm^-1 / M
  points: rows.map((r0) => [r0[0], +(r0[idx] * f).toPrecision(6)]), // μa cm^-1 @150 g/L
});

const result = {
  oxyhemoglobin: mk(1),
  deoxyhemoglobin: mk(2),
  conversion: {
    formula: 'mu_a = 2.303 * epsilon * (x / 64500), x in g/L',
    defaultConcentration: DEFAULT_GPL,
    concentrationUnit: 'g/L',
    molecularWeight: HB_MW,
    factorAtDefault: f,
  },
  source: {
    ref: 'Prahl, S. (compiler), molar extinction coefficient of hemoglobin in water, using data of W. B. Gratzer (Med. Res. Council Labs, London) and N. Kollias (Wellman Labs, Harvard). OMLC.',
    url: 'https://omlc.org/spectra/hemoglobin/summary.html',
    note: 'Molar extinction ε in cm^-1/M; converted to μa (cm^-1) at whole-blood 150 g/L.',
  },
};
await writeFile(resolve(RAW, 'hemoglobin.json'), JSON.stringify(result, null, 2));

const at = (arr, nm) => arr.reduce((b, p) => (Math.abs(p[0] - nm) < Math.abs(b[0] - nm) ? p : b));
console.log(`hemoglobin: ${rows.length} rows, factor@150g/L = ${f.toExponential(4)}`);
console.log('HbO2 μa probes:',
  ['415', '532', '578', '760', '1064'].map((nm) => `${nm}:${at(result.oxyhemoglobin.points, +nm)[1].toExponential(2)}`).join(' '));
console.log('Hb   μa probes:',
  ['430', '532', '555', '760', '1064'].map((nm) => `${nm}:${at(result.deoxyhemoglobin.points, +nm)[1].toExponential(2)}`).join(' '));
