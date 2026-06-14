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

## Components WITHOUT reliable tabulated μa (declared gaps, not plotted)

### Collagen (type I)
- Reason: No published per-wavelength μa(cm⁻¹) table spanning the range. Real μa exists only ~500–1700 nm (Sekar/Taroni) but figure-only / paywalled; reading points off a log plot is disallowed. Mid-IR amide region published as relative absorbance (a.u.), not cm⁻¹.
- Band positions (nm, positions only): 1200, 1500, 1690, 1725, 3030, 6060, 6450, 8000
- References:
  - Taroni et al., J. Biomed. Opt. 12(1):014021 (2007) — collagen powder, "always higher than 0.026 cm⁻¹" 610–1040 nm.
  - Sekar et al., J. Biomed. Opt. 22(1):015006 (2017) — 500–1700 nm μa (figure-only).
  - Wilson et al., J. Biomed. Opt. 20(3):030901 (2015) — SWIR band positions.
  - Viator et al., Phys. Med. Biol. 48:N15 (2003); Belbachir et al., Micron 40:893 (2009) — mid-IR amide positions (a.u.).

### Protein
- Reason: Standard tissue-optics chromophore models (Jacques 2013, OMLC) do NOT include protein. No source tabulates tissue protein μa(λ) in cm⁻¹. Only UV molar extinction (peptide ~190–220 nm, aromatic ~280 nm) and mid-IR amide molar absorption exist; converting to μa needs an assumed tissue protein concentration, so values are estimates, not data.
- Band positions (nm, positions only): 190, 205, 220, 280, 3030, 6060, 6450
- References:
  - Pace et al., Protein Sci. 4:2411 (1995) — ε280 = 5500·#Trp + 1490·#Tyr + 125·#cystine.
  - Barth, BBA Bioenergetics 1767:1073 (2007) — amide I molar absorption 300–400 M⁻¹cm⁻¹.
  - Jacques, Phys. Med. Biol. 58:R37 (2013) — tissue chromophore model excludes protein.
  - Boulnois, Lasers Med. Sci. 1:47 (1986) — classic schematic chromophore chart (protein line is schematic).

## Known conflict (documented decision)
Reconstructing from real literature makes the chart differ from any single source figure
(those are multi-paper simplified schematics). **Data accuracy wins; source figures are
layout reference only.** This is most visible for HA/collagen/protein, where the schematic
figures draw full-range curves but trustworthy μa exists only in narrow bands (or not at all).
