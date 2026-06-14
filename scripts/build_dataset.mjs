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

// --- Collagen / protein: ONE merged curve. Collagen is the dominant structural protein and
// laser-tissue charts treat them as one line. No open absolute μa(λ) dataset exists, so this is a
// RECONSTRUCTED ESTIMATE: most-probable absolute μa anchors triangulated from multiple primary
// sources, each derived from a real value × explicit tissue concentration and adversarially
// verified. ~×3 uncertain → drawn dashed, labelled "(est.)", OFF by default. ----
const cpAnchors = [
  { nm: 193, mua: 13000, low: 6200, high: 19500, how: 'Fisher & Hahn 2004 peptide-bond σ=1.14e-17 cm² (96% of collagen 193 nm absorption) × dermal residue density (ρ≈0.11–0.30 g/cm³, M≈110 g/mol); cross-checked vs corneal μa 16000–39900 cm⁻¹.' },
  { nm: 220, mua: 3100, low: 1700, high: 5100, how: 'Peptide-bond shoulder ε≈100–300 M⁻¹cm⁻¹ × residue molarity 2.4–3.9 M. Steep band edge → low confidence.' },
  { nm: 280, mua: 15, low: 8, high: 35, how: 'Aromatic band. Collagen has ZERO tryptophan; only tyrosine (~2–3 per 1000 residues), εTyr≈1209–1490 M⁻¹cm⁻¹. Far below generic (Trp-bearing) protein.' },
  { nm: 700, mua: 0.022, low: 0.01, high: 0.04, how: 'Taroni 2007 collagen powder floor (μa>0.026 cm⁻¹ at ρ=0.196 g/cm³) scaled to tissue collagen density. Optical window — weak absorber.' },
  { nm: 910, mua: 0.022, low: 0.012, high: 0.05, how: 'Davydov 2025 (open access) collagen extinction shape on the Taroni absolute scale; C–H overtone region.' },
  { nm: 6060, mua: 1600, low: 700, high: 2500, how: 'Amide I (C=O stretch, 1650 cm⁻¹) molar absorption 300–400 M⁻¹cm⁻¹ (Barth 2007) × residue molarity. Overlaps strong water IR absorption.' },
];
const collagenProtein = {
  id: 'collagen-protein',
  label: 'Collagen / protein (est.)',
  color: '#0a8a5c',
  points: cpAnchors.map((a) => [a.nm, a.mua]),
  modelFormula: 'Reconstructed multi-source estimate (~×3 uncertainty) — not a measured spectrum',
  source: {
    ref: 'Multi-source triangulation: Fisher & Hahn, Appl. Opt. 43:5443 (2004); Taroni et al., J. Biomed. Opt. 12:014021 (2007); Davydov et al., Adv. Sci. PMC12591192 (2025); Barth, BBA 1767:1073 (2007); PhotochemCAD Trp/Tyr (OMLC). Collagen treated as the dominant structural protein.',
    note: 'RECONSTRUCTED ESTIMATE, not a measured spectrum. Each anchor = real source value × explicit tissue concentration; ~×3 uncertainty (see anchor table below). Off by default.',
  },
  gaps: [
    { fromNm: 950, toNm: 6000, reason: 'No absolute μa anchor between the vis-NIR window and the mid-IR amide bands; SWIR peaks (1200/1500/1725 nm) are figure-only/normalized so absolute values could not be grounded.' },
  ],
  enabledByDefault: false,
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

### Melanin — ${melanin.points.length} model points, 300–1100 nm
- Source: ${melanin.source.ref}
- Model (NOT tabulated): \`${melanin.modelFormula}\`
- Gaps: ${melanin.gaps.map((g) => `${g.fromNm}–${g.toNm} nm`).join('; ')} (power-law not meaningful outside vis–NIR).

### Hydroxyapatite (HA) / dental enamel — ${haPoints.length} points, 9300–10600 nm
- Source: ${hydroxyapatite.source.ref}
- Values: ${haPoints.map((p) => `${p[0]} nm → ${p[1]} cm⁻¹`).join('; ')}.
- Note: ${hydroxyapatite.source.note}
- Gap: ${hydroxyapatite.gaps[0].fromNm}–${hydroxyapatite.gaps[0].toNm} nm (no tabulated mineral μa; vis–NIR absorption negligible/scattering-dominated).

### Collagen / protein — ${cpAnchors.length} RECONSTRUCTED-ESTIMATE anchors (off by default, drawn dashed)
Collagen is the dominant structural protein; laser-tissue charts merge "collagen" and "protein"
into one line, so they are one curve here. **No open absolute μa(λ) dataset exists** (the canonical
Taroni/Sekar spectra are paywalled figures; SWIR peaks are figure-only/normalized). These anchors
are the **most-probable absolute μa**, each triangulated from a real source value × an explicit
tissue-concentration assumption and adversarially verified. **~×3 uncertainty — an estimate, not a
measurement.** ${collagenProtein.source.ref}

| nm | μa (cm⁻¹) | plausible range | derivation |
|---|---|---|---|
${cpAnchors.map((a) => `| ${a.nm} | ${a.mua} | ${a.low}–${a.high} | ${a.how} |`).join('\n')}

Gap ${collagenProtein.gaps[0].fromNm}–${collagenProtein.gaps[0].toNm} nm: ${collagenProtein.gaps[0].reason}

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
