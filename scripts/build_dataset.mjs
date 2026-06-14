// Assemble the first dataset (laser–tissue absorption) from normalized raw/ files
// plus hand-curated, fully-cited literature values for hydroxyapatite (dental enamel).
// Emits data/laser-tissue.json (the swappable data unit) and data/SOURCES.md.
//
// Run the fetchers first: node scripts/fetch_water.mjs && fetch_hemoglobin.mjs && melanin.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, 'raw');
const DATA = resolve(HERE, '..', 'data');
const readJSON = async (p) => JSON.parse(await readFile(resolve(RAW, p), 'utf8'));

const [water, hb, melanin] = await Promise.all([
  readJSON('water.json'),
  readJSON('hemoglobin.json'),
  readJSON('melanin.json'),
]);

// --- Hydroxyapatite / dental enamel: real mid-IR μa, fully cited. -----------------
// Only the 9.3–10.6 µm phosphate-band region has trustworthy tabulated μa.
// Set A (Zuerlein, Fried, Seka, Featherstone, SPIE 3248, 1998 — transmission, as-cited in
// derivative literature; primary full-text gated). 9.6 µm alternative: 5000±1000 cm⁻¹ by
// pulsed photothermal radiometry (Zuerlein et al., IEEE JSTQE 5:1083, 1999).
const haPoints = [
  [9300, 5500],
  [9600, 8000],
  [10300, 1125],
  [10600, 825],
];
const hydroxyapatite = {
  id: 'hydroxyapatite',
  label: 'Hydroxyapatite (HA) / enamel',
  color: '#6b8e23',
  points: haPoints,
  source: {
    ref: 'Zuerlein, Fried, Seka, Featherstone, "Absorption coefficients of dental enamel in the infrared", Proc. SPIE 3248 (1998); 9.6 µm cross-checked vs photothermal radiometry 5000±1000 cm⁻¹, Zuerlein et al., IEEE J. Sel. Top. Quantum Electron. 5(4):1083 (1999).',
    url: 'https://ieeexplore.ieee.org/document/796333/',
    note: 'Dental enamel mineral (~85% HA). Values as-cited from derivative literature (primary SPIE text gated). Absorption peaks 9.75–10 µm; 9.6 µm alt. 5000±1000 cm⁻¹. 9.6 µm ≈ 10× 10.6 µm.',
  },
  gaps: [
    { fromNm: 180, toNm: 9290, reason: 'No tabulated enamel/HA mineral μa below 9.3 µm: vis–NIR absorption negligible/scattering-dominated; OH band ~2.8 µm and overtones (1.5, 2.0 µm) are positions only, no μa (Fried 1995; Zuerlein/Fried).' },
  ],
};

// --- Lasers (discrete marker layer; handoff §5). ----------------------------------
const lasers = [
  { id: 'argon', label: 'Argon', wavelengthNm: 501, rangeNm: [488, 514], note: '488–514 nm' },
  { id: 'ktp', label: 'KTP', wavelengthNm: 532 },
  { id: 'pdl', label: 'PDL', wavelengthNm: 595, note: 'pulsed dye, 585 / 595 nm variants' },
  { id: 'ruby', label: 'Ruby', wavelengthNm: 694 },
  { id: 'alexandrite', label: 'Alexandrite', wavelengthNm: 755 },
  { id: 'diode', label: 'Diode', wavelengthNm: 905, rangeNm: [810, 980], note: '810–980 nm' },
  { id: 'ndyag', label: 'Nd:YAG', wavelengthNm: 1064 },
  { id: 'ndyap', label: 'Nd:YAP', wavelengthNm: 1340 },
  { id: 'ercrysgg', label: 'Er,Cr:YSGG', wavelengthNm: 2780 },
  { id: 'eryag', label: 'Er:YAG', wavelengthNm: 2940 },
  { id: 'co2_93', label: 'CO₂ 9.3µm', wavelengthNm: 9300 },
  { id: 'co2_106', label: 'CO₂ 10.6µm', wavelengthNm: 10600 },
];

// --- Components present in the source figures but WITHOUT reliable tabulated μa. ----
const unavailableCurves = [
  {
    id: 'collagen',
    label: 'Collagen (type I)',
    reason: 'No published per-wavelength μa(cm⁻¹) table spanning the range. Real μa exists only ~500–1700 nm (Sekar/Taroni) but figure-only / paywalled; reading points off a log plot is disallowed. Mid-IR amide region published as relative absorbance (a.u.), not cm⁻¹.',
    references: [
      'Taroni et al., J. Biomed. Opt. 12(1):014021 (2007) — collagen powder, "always higher than 0.026 cm⁻¹" 610–1040 nm.',
      'Sekar et al., J. Biomed. Opt. 22(1):015006 (2017) — 500–1700 nm μa (figure-only).',
      'Wilson et al., J. Biomed. Opt. 20(3):030901 (2015) — SWIR band positions.',
      'Viator et al., Phys. Med. Biol. 48:N15 (2003); Belbachir et al., Micron 40:893 (2009) — mid-IR amide positions (a.u.).',
    ],
    bandPositionsNm: [1200, 1500, 1690, 1725, 3030, 6060, 6450, 8000],
    note: 'Band positions only (NIR overtones + amide A/I/II/III). No μa magnitude — not plotted.',
  },
  {
    id: 'protein',
    label: 'Protein',
    reason: 'Standard tissue-optics chromophore models (Jacques 2013, OMLC) do NOT include protein. No source tabulates tissue protein μa(λ) in cm⁻¹. Only UV molar extinction (peptide ~190–220 nm, aromatic ~280 nm) and mid-IR amide molar absorption exist; converting to μa needs an assumed tissue protein concentration, so values are estimates, not data.',
    references: [
      'Pace et al., Protein Sci. 4:2411 (1995) — ε280 = 5500·#Trp + 1490·#Tyr + 125·#cystine.',
      'Barth, BBA Bioenergetics 1767:1073 (2007) — amide I molar absorption 300–400 M⁻¹cm⁻¹.',
      'Jacques, Phys. Med. Biol. 58:R37 (2013) — tissue chromophore model excludes protein.',
      'Boulnois, Lasers Med. Sci. 1:47 (1986) — classic schematic chromophore chart (protein line is schematic).',
    ],
    bandPositionsNm: [190, 205, 220, 280, 3030, 6060, 6450],
    note: 'UV peptide/aromatic + mid-IR amide positions only. No tabulated tissue μa — not plotted.',
  },
];

// --- Curves with display metadata + concentration dimension (reserved, input ⑥). --
const HB_NOTE = hb.conversion.formula + ` (default x = ${hb.conversion.defaultConcentration} ${hb.conversion.concentrationUnit})`;
const curves = [
  {
    id: 'water',
    label: 'H₂O (Water)',
    color: '#1f77b4',
    points: water.points,
    source: water.source,
    enabledByDefault: true,
  },
  {
    id: 'oxyhemoglobin',
    label: 'HbO₂ (Oxyhemoglobin)',
    color: '#d62728',
    points: hb.oxyhemoglobin.points,
    epsilon: hb.oxyhemoglobin.epsilon,
    defaultConcentration: hb.conversion.defaultConcentration,
    concentrationUnit: hb.conversion.concentrationUnit,
    concentrationFormula: HB_NOTE,
    source: hb.source,
    enabledByDefault: true,
  },
  {
    id: 'deoxyhemoglobin',
    label: 'Hb (Deoxyhemoglobin)',
    color: '#9467bd',
    points: hb.deoxyhemoglobin.points,
    epsilon: hb.deoxyhemoglobin.epsilon,
    defaultConcentration: hb.conversion.defaultConcentration,
    concentrationUnit: hb.conversion.concentrationUnit,
    concentrationFormula: HB_NOTE,
    source: hb.source,
    enabledByDefault: true,
  },
  {
    id: 'melanin',
    label: 'Melanin',
    color: '#e6a817',
    points: melanin.points,
    source: melanin.source,
    modelFormula: melanin.modelFormula,
    gaps: melanin.gaps,
    enabledByDefault: true,
  },
  hydroxyapatite,
];

const dataset = {
  meta: {
    title: 'Laser–tissue absorption spectra',
    description:
      'Absorption coefficient μa of biological chromophores vs wavelength, with clinical laser wavelength markers. Selective photothermolysis reference (Anderson & Parrish 1983).',
    wavelengthUnit: 'nm',
    absorptionUnit: 'cm^-1',
    references: [
      'Segelstein (1981) / Hale & Querry (1973) — water, OMLC.',
      'Prahl / Gratzer / Kollias — hemoglobin molar extinction, OMLC.',
      'Jacques — melanosome absorption (power-law fit), OMLC.',
      'Zuerlein, Fried, Featherstone, Seka (1998/1999) — dental enamel mid-IR μa.',
    ],
  },
  curves,
  lasers,
  unavailableCurves,
};

await mkdir(DATA, { recursive: true });
await writeFile(resolve(DATA, 'laser-tissue.json'), JSON.stringify(dataset, null, 2));

// --- SOURCES.md ------------------------------------------------------------------
const at = (pts, nm) => {
  const p = pts.reduce((b, q) => (Math.abs(q[0] - nm) < Math.abs(b[0] - nm) ? q : b));
  return `${p[1].toExponential(3)} cm⁻¹ (@${p[0]} nm)`;
};
const md = `# Data sources, units, and known gaps

All absorption coefficients are **μa in cm⁻¹** vs **wavelength in nm**. Curves are reference
datasets (molecular physical properties), not user input. Data comes from original tabulated
literature — **never eyeballed off log-axis figures, never fabricated**. Source figures are
used only for layout/trend reference; where literature gives no reliable μa, the gap is marked.

## Plotted curves

### H₂O (Water) — ${water.points.length} points, 180–12000 nm
- Source: ${water.source.ref}
- URL: ${water.source.url}
- Units: μa cm⁻¹, directly tabulated (no conversion).
- Probes: 1064 nm → ${at(water.points, 1064)}; 2780 nm → ${at(water.points, 2780)}; 2940 nm → ${at(water.points, 2940)}; 10600 nm → ${at(water.points, 10600)}.

### HbO₂ / Hb (Hemoglobin) — ${hb.oxyhemoglobin.points.length} points each, 250–1000 nm
- Source: ${hb.source.ref}
- Conversion: \`${hb.conversion.formula}\`, MW ${hb.conversion.molecularWeight} g/mol, default ${hb.conversion.defaultConcentration} ${hb.conversion.concentrationUnit} (whole blood).
- Molar extinction ε retained per curve for the reserved concentration dimension (input ⑥).
- Probes (HbO₂): 415 nm → ${at(hb.oxyhemoglobin.points, 415)}; 532 nm → ${at(hb.oxyhemoglobin.points, 532)}; 1064 nm → ${at(hb.oxyhemoglobin.points, 1064)}.

### Melanin — ${melanin.points.length} model points, 300–1100 nm
- Source: ${melanin.source.ref}
- Model (NOT tabulated): \`${melanin.modelFormula}\`
- Gaps: ${melanin.gaps.map((g) => `${g.fromNm}–${g.toNm} nm`).join('; ')} (power-law not meaningful outside vis–NIR).

### Hydroxyapatite (HA) / dental enamel — ${haPoints.length} points, 9300–10600 nm
- Source: ${hydroxyapatite.source.ref}
- Values: ${haPoints.map((p) => `${p[0]} nm → ${p[1]} cm⁻¹`).join('; ')}.
- Note: ${hydroxyapatite.source.note}
- Gap: ${hydroxyapatite.gaps[0].fromNm}–${hydroxyapatite.gaps[0].toNm} nm (no tabulated mineral μa; vis–NIR absorption negligible/scattering-dominated).

## Components WITHOUT reliable tabulated μa (declared gaps, not plotted)

${unavailableCurves
  .map(
    (c) => `### ${c.label}
- Reason: ${c.reason}
- Band positions (nm, positions only): ${c.bandPositionsNm.join(', ')}
- References:
${c.references.map((r) => `  - ${r}`).join('\n')}`,
  )
  .join('\n\n')}

## Known conflict (documented decision)
Reconstructing from real literature makes the chart differ from any single source figure
(those are multi-paper simplified schematics). **Data accuracy wins; source figures are
layout reference only.** This is most visible for HA/collagen/protein, where the schematic
figures draw full-range curves but trustworthy μa exists only in narrow bands (or not at all).
`;
await writeFile(resolve(DATA, 'SOURCES.md'), md);

const nearest = (pts, nm) => pts.reduce((b, q) => (Math.abs(q[0] - nm) < Math.abs(b[0] - nm) ? q : b));
console.log(`dataset: ${curves.length} curves, ${lasers.length} lasers, ${unavailableCurves.length} unavailable`);
console.log('curve point counts:', curves.map((c) => `${c.id}:${c.points.length}`).join(' '));
console.log('water 2940/2780 ratio:', (nearest(water.points, 2940)[1] / nearest(water.points, 2780)[1]).toFixed(2));
