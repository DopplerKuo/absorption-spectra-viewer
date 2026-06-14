# Data sources, units, and known gaps

All absorption coefficients are **μa in cm⁻¹** vs **wavelength in nm**. Curves are reference
datasets (molecular physical properties), not user input. Data comes from original tabulated
literature — **never eyeballed off log-axis figures, never fabricated**. Source figures are
used only for layout/trend reference; where literature gives no reliable μa, the gap is marked.

## Plotted curves

### H₂O (Water) — 557 points, 180–12000 nm
- Source: Segelstein, D. J. (1981), "The complex refractive index of water", M.S. thesis, University of Missouri-Kansas City. Cross-checked vs Hale & Querry (1973), Appl. Opt. 12:555.
- URL: https://omlc.org/spectra/water/
- Units: μa cm⁻¹, directly tabulated (no conversion).
- Probes: 1064 nm → 1.541e-1 cm⁻¹ (@1059 nm); 2780 nm → 4.197e+3 cm⁻¹ (@2780 nm); 2940 nm → 1.199e+4 cm⁻¹ (@2938 nm); 10600 nm → 8.415e+2 cm⁻¹ (@10590 nm).

### HbO₂ / Hb (Hemoglobin) — 376 points each, 250–1000 nm
- Source: Prahl, S. (compiler), molar extinction coefficient of hemoglobin in water, using data of W. B. Gratzer (Med. Res. Council Labs, London) and N. Kollias (Wellman Labs, Harvard). OMLC.
- Conversion: `mu_a = 2.303 * epsilon * (x / 64500), x in g/L`, MW 64500 g/mol, default 150 g/L (whole blood).
- Molar extinction ε retained per curve for the reserved concentration dimension (input ⑥).
- Probes (HbO₂): 415 nm → 2.808e+3 cm⁻¹ (@414 nm); 532 nm → 2.350e+2 cm⁻¹ (@532 nm); 1064 nm → 5.484e+0 cm⁻¹ (@1000 nm).

### Melanin — 86 model points, 250–1100 nm
- Source: Jacques, S. L., melanosome absorption power laws (OMLC: mua.html & generic_optics 2015), geometric mean. Cross-validated against measured eumelanin (Sarna & Swartz 1988, via OMLC eumelanin.html): agreement ~3–6% over 400–800 nm.
- Model (NOT tabulated): `geometric mean of two Jacques melanosome power laws: 1.70e12·λ^-3.48 and 6.6e11·λ^-3.33`
- Gaps: 180–249 nm; 1101–12000 nm (power-law not meaningful outside vis–NIR).

### Hydroxyapatite (HA) / dental enamel — 4 points, 9300–10600 nm
- Source: Zuerlein, Fried, Seka, Featherstone, "Absorption coefficients of dental enamel in the infrared", Proc. SPIE 3248 (1998); 9.6 µm cross-checked vs photothermal radiometry 5000±1000 cm⁻¹, Zuerlein et al., IEEE J. Sel. Top. Quantum Electron. 5(4):1083 (1999).
- Values: 9300 nm → 5500 cm⁻¹; 9600 nm → 8000 cm⁻¹; 10300 nm → 1125 cm⁻¹; 10600 nm → 825 cm⁻¹.
- Note: Dental enamel mineral (~85% HA). Values as-cited from derivative literature (primary SPIE text gated). Absorption peaks 9.75–10 µm; 9.6 µm alt. 5000±1000 cm⁻¹. 9.6 µm ≈ 10× 10.6 µm.
- Gap: 180–9290 nm (no tabulated mineral μa; vis–NIR absorption negligible/scattering-dominated).

### Collagen / protein — 28-point DENSE reconstructed estimate (off by default, drawn dashed)
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
Multi-source triangulation (sanity-verified). SWIR 580–1700 nm: Sekar et al., J. Biomed. Opt. 22:015006 (2017), digitized open-access Fig. 2 (measured). UV/amide: peptide & Trp/Tyr ε (PhotochemCAD/OMLC; Anthis & Clore) and Barth, BBA 1767:1073 (2007) × tissue residue concentration. Cross-checked vs Fisher & Hahn (2004), Taroni (2007), Davydov (2025), and reference figures.

| nm | μa (cm⁻¹) | plausible range | confidence |
|---|---|---|---|
| 190 | 28000 | 13000–50000 | 0.45 |
| 200 | 13000 | 5000–29000 | 0.5 |
| 205 | 11000 | 4400–23000 | 0.55 |
| 210 | 6800 | 2600–15000 | 0.55 |
| 220 | 3000 | 1500–5100 | 0.45 |
| 230 | 130 | 40–380 | 0.4 |
| 240 | 31 | 10–91 | 0.4 |
| 260 | 3 | 1–12 | 0.4 |
| 280 | 12 | 5–30 | 0.45 |
| 300 | 1 | 0.3–3 | 0.5 |
| 350 | 0.45 | 0.2–1 | 0.55 |
| 450 | 0.13 | 0.06–0.3 | 0.55 |
| 500 | 0.12 | 0.05–0.35 | 0.45 |
| 580 | 0.14 | 0.09–0.22 | 0.75 |
| 700 | 0.045 | 0.022–0.07 | 0.7 |
| 840 | 0.036 | 0.026–0.05 | 0.85 |
| 910 | 0.05 | 0.022–0.08 | 0.7 |
| 1000 | 0.08 | 0.04–0.12 | 0.75 |
| 1180 | 0.33 | 0.18–0.5 | 0.75 |
| 1300 | 0.16 | 0.1–0.25 | 0.75 |
| 1500 | 2.1 | 1.3–3 | 0.75 |
| 1725 | 2.3 | 1.2–3.5 | 0.55 |
| 2000 | 4 | 0.5–20 | 0.35 |
| 2350 | 60 | 13–110 | 0.4 |
| 3030 | 820 | 200–2300 | 0.4 |
| 6060 | 1600 | 700–2500 | 0.45 |
| 6450 | 680 | 200–1700 | 0.45 |
| 8000 | 270 | 60–760 | 0.4 |

## Known conflict (documented decision)
Reconstructing from real literature makes the chart differ from any single source figure
(those are multi-paper simplified schematics). **Data accuracy wins; source figures are
layout reference only.** This is most visible for HA/collagen/protein, where the schematic
figures draw full-range curves but trustworthy μa exists only in narrow bands (or not at all).
