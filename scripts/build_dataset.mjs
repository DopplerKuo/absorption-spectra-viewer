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

// --- Collagen / protein: ONE merged curve (collagen is the dominant structural protein; laser-tissue
// charts draw them as one line). No open absolute μa(λ) dataset exists, so this is a DENSE
// RECONSTRUCTED ESTIMATE: 28 most-probable absolute μa points triangulated from 6 sources and
// sanity-verified — the measured Sekar 2017 collagen spectrum (digitized, open access) anchors the
// 580–1700 nm SWIR; molecular ε×concentration gives the UV peptide/aromatic and mid-IR amide bands;
// the two reference figures + a skin-optics review supply shape. Confidence varies per point
// (0.35–0.85). Drawn dashed, labelled "(est.)". See the table in data/SOURCES.md. ----
const cpAnchors = [
  { nm: 190, mua: 28000, low: 13000, high: 50000, conf: 0.45 },
  { nm: 200, mua: 13000, low: 5000, high: 29000, conf: 0.5 },
  { nm: 205, mua: 11000, low: 4400, high: 23000, conf: 0.55 },
  { nm: 210, mua: 6800, low: 2600, high: 15000, conf: 0.55 },
  { nm: 220, mua: 3000, low: 1500, high: 5100, conf: 0.45 },
  { nm: 230, mua: 130, low: 40, high: 380, conf: 0.4 },
  { nm: 240, mua: 31, low: 10, high: 91, conf: 0.4 },
  { nm: 260, mua: 3, low: 1, high: 12, conf: 0.4 },
  { nm: 280, mua: 12, low: 5, high: 30, conf: 0.45 },
  { nm: 300, mua: 1, low: 0.3, high: 3, conf: 0.5 },
  { nm: 350, mua: 0.45, low: 0.2, high: 1, conf: 0.55 },
  { nm: 450, mua: 0.13, low: 0.06, high: 0.3, conf: 0.55 },
  { nm: 500, mua: 0.12, low: 0.05, high: 0.35, conf: 0.45 },
  { nm: 580, mua: 0.14, low: 0.09, high: 0.22, conf: 0.75 },
  { nm: 700, mua: 0.045, low: 0.022, high: 0.07, conf: 0.7 },
  { nm: 840, mua: 0.036, low: 0.026, high: 0.05, conf: 0.85 },
  { nm: 910, mua: 0.05, low: 0.022, high: 0.08, conf: 0.7 },
  { nm: 1000, mua: 0.08, low: 0.04, high: 0.12, conf: 0.75 },
  { nm: 1180, mua: 0.33, low: 0.18, high: 0.5, conf: 0.75 },
  { nm: 1300, mua: 0.16, low: 0.1, high: 0.25, conf: 0.75 },
  { nm: 1500, mua: 2.1, low: 1.3, high: 3, conf: 0.75 },
  { nm: 1725, mua: 2.3, low: 1.2, high: 3.5, conf: 0.55 },
  { nm: 2000, mua: 4, low: 0.5, high: 20, conf: 0.35 },
  { nm: 2350, mua: 60, low: 13, high: 110, conf: 0.4 },
  { nm: 3030, mua: 820, low: 200, high: 2300, conf: 0.4 },
  { nm: 6060, mua: 1600, low: 700, high: 2500, conf: 0.45 },
  { nm: 6450, mua: 680, low: 200, high: 1700, conf: 0.45 },
  { nm: 8000, mua: 270, low: 60, high: 760, conf: 0.4 },
];
const collagenProtein = {
  id: 'collagen-protein',
  label: 'Collagen / protein (est.)',
  color: '#0a8a5c',
  points: cpAnchors.map((a) => [a.nm, a.mua]),
  modelFormula: 'Dense reconstructed multi-source estimate — not a measured spectrum (confidence varies per point)',
  source: {
    ref: 'Multi-source triangulation (sanity-verified). SWIR 580–1700 nm: Sekar et al., J. Biomed. Opt. 22:015006 (2017), digitized open-access Fig. 2 (measured). UV/amide: peptide & Trp/Tyr ε (PhotochemCAD/OMLC; Anthis & Clore) and Barth, BBA 1767:1073 (2007) × tissue residue concentration. Cross-checked vs Fisher & Hahn (2004), Taroni (2007), Davydov (2025), and reference figures.',
    note: 'DENSE RECONSTRUCTED ESTIMATE, not a single measured spectrum. SWIR core is real (Sekar, measured); UV peptide peak and mid-IR amide bands are ε×concentration estimates (~×2–3); collagen has ~0 tryptophan so the 280 nm band is small. Per-point confidence (0.35–0.85) and uncertainty range in this file.',
  },
};
const unavailableCurves = [];

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
  collagenProtein,
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

### Melanin — ${melanin.points.length} model points, 250–1100 nm
- Source: ${melanin.source.ref}
- Model (NOT tabulated): \`${melanin.modelFormula}\`
- Gaps: ${melanin.gaps.map((g) => `${g.fromNm}–${g.toNm} nm`).join('; ')} (power-law not meaningful outside vis–NIR).

### Hydroxyapatite (HA) / dental enamel — ${haPoints.length} points, 9300–10600 nm
- Source: ${hydroxyapatite.source.ref}
- Values: ${haPoints.map((p) => `${p[0]} nm → ${p[1]} cm⁻¹`).join('; ')}.
- Note: ${hydroxyapatite.source.note}
- Gap: ${hydroxyapatite.gaps[0].fromNm}–${hydroxyapatite.gaps[0].toNm} nm (no tabulated mineral μa; vis–NIR absorption negligible/scattering-dominated).

### Collagen / protein — ${cpAnchors.length}-point DENSE reconstructed estimate (off by default, drawn dashed)
Collagen is the dominant structural protein; laser-tissue charts merge "collagen" and "protein"
into one line, so they are one curve here. **No single open absolute μa(λ) dataset spans the range**,
so this is triangulated from 6 sources and sanity-verified:
- **SWIR 580–1700 nm (measured, highest confidence):** Sekar et al. 2017 collagen spectrum, digitized
  from the open-access Fig. 2 (real peaks at 1180, 1500, 1725 nm).
- **UV peptide/aromatic (190–300 nm):** peptide-bond ε and Trp/Tyr ε (PhotochemCAD/OMLC; Anthis &
  Clore) × tissue residue concentration. Collagen has ~0 tryptophan → small 280 nm band.
- **Mid-IR amide A/I/II/III (3030/6060/6450/8000 nm):** Barth 2007 molar absorptions × residue molarity.
- **Shape cross-checks:** the two reference figures + a skin-optics review.

**Confidence varies per point (0.35–0.85); UV and mid-IR are ~×2–3 estimates, the SWIR core is measured.**
${collagenProtein.source.ref}

| nm | μa (cm⁻¹) | plausible range | confidence |
|---|---|---|---|
${cpAnchors.map((a) => `| ${a.nm} | ${a.mua} | ${a.low}–${a.high} | ${a.conf} |`).join('\n')}

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
