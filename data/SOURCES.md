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

### Melanin — 81 model points, 300–1100 nm
- Source: Jacques, S. L., melanosome interior absorption coefficient, OMLC. Power-law fit from Jacques & McAuliffe (1991) Photochem. Photobiol. 53:769; Jacques et al. (1996) SPIE 2681:468.
- Model (NOT tabulated): `mu_a = 1.70e12 * lambda_nm^(-3.48) [cm^-1] (skin)`
- Gaps: 180–299 nm; 1101–12000 nm (power-law not meaningful outside vis–NIR).

### Hydroxyapatite (HA) / dental enamel — 4 points, 9300–10600 nm
- Source: Zuerlein, Fried, Seka, Featherstone, "Absorption coefficients of dental enamel in the infrared", Proc. SPIE 3248 (1998); 9.6 µm cross-checked vs photothermal radiometry 5000±1000 cm⁻¹, Zuerlein et al., IEEE J. Sel. Top. Quantum Electron. 5(4):1083 (1999).
- Values: 9300 nm → 5500 cm⁻¹; 9600 nm → 8000 cm⁻¹; 10300 nm → 1125 cm⁻¹; 10600 nm → 825 cm⁻¹.
- Note: Dental enamel mineral (~85% HA). Values as-cited from derivative literature (primary SPIE text gated). Absorption peaks 9.75–10 µm; 9.6 µm alt. 5000±1000 cm⁻¹. 9.6 µm ≈ 10× 10.6 µm.
- Gap: 180–9290 nm (no tabulated mineral μa; vis–NIR absorption negligible/scattering-dominated).

### Collagen / protein — 6 RECONSTRUCTED-ESTIMATE anchors (off by default, drawn dashed)
Collagen is the dominant structural protein; laser-tissue charts merge "collagen" and "protein"
into one line, so they are one curve here. **No open absolute μa(λ) dataset exists** (the canonical
Taroni/Sekar spectra are paywalled figures; SWIR peaks are figure-only/normalized). These anchors
are the **most-probable absolute μa**, each triangulated from a real source value × an explicit
tissue-concentration assumption and adversarially verified. **~×3 uncertainty — an estimate, not a
measurement.** Multi-source triangulation: Fisher & Hahn, Appl. Opt. 43:5443 (2004); Taroni et al., J. Biomed. Opt. 12:014021 (2007); Davydov et al., Adv. Sci. PMC12591192 (2025); Barth, BBA 1767:1073 (2007); PhotochemCAD Trp/Tyr (OMLC). Collagen treated as the dominant structural protein.

| nm | μa (cm⁻¹) | plausible range | derivation |
|---|---|---|---|
| 193 | 13000 | 6200–19500 | Fisher & Hahn 2004 peptide-bond σ=1.14e-17 cm² (96% of collagen 193 nm absorption) × dermal residue density (ρ≈0.11–0.30 g/cm³, M≈110 g/mol); cross-checked vs corneal μa 16000–39900 cm⁻¹. |
| 220 | 3100 | 1700–5100 | Peptide-bond shoulder ε≈100–300 M⁻¹cm⁻¹ × residue molarity 2.4–3.9 M. Steep band edge → low confidence. |
| 280 | 15 | 8–35 | Aromatic band. Collagen has ZERO tryptophan; only tyrosine (~2–3 per 1000 residues), εTyr≈1209–1490 M⁻¹cm⁻¹. Far below generic (Trp-bearing) protein. |
| 700 | 0.022 | 0.01–0.04 | Taroni 2007 collagen powder floor (μa>0.026 cm⁻¹ at ρ=0.196 g/cm³) scaled to tissue collagen density. Optical window — weak absorber. |
| 910 | 0.022 | 0.012–0.05 | Davydov 2025 (open access) collagen extinction shape on the Taroni absolute scale; C–H overtone region. |
| 6060 | 1600 | 700–2500 | Amide I (C=O stretch, 1650 cm⁻¹) molar absorption 300–400 M⁻¹cm⁻¹ (Barth 2007) × residue molarity. Overlaps strong water IR absorption. |

Gap 950–6000 nm: No absolute μa anchor between the vis-NIR window and the mid-IR amide bands; SWIR peaks (1200/1500/1725 nm) are figure-only/normalized so absolute values could not be grounded.

## Known conflict (documented decision)
Reconstructing from real literature makes the chart differ from any single source figure
(those are multi-paper simplified schematics). **Data accuracy wins; source figures are
layout reference only.** This is most visible for HA/collagen/protein, where the schematic
figures draw full-range curves but trustworthy μa exists only in narrow bands (or not at all).
