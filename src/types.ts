// Data contract for the generic log-log spectrum engine.
// A Dataset is the swappable unit: replace it to draw a different family of curves.

/** A single sample: [wavelength in nm, value]. For curves, value is μa in cm^-1. */
export type Point = [wavelengthNm: number, value: number];

/** A wavelength region where a curve has no reliable data (drawn as a break, never interpolated across). */
export interface Gap {
  fromNm: number;
  toNm: number;
  reason: string;
}

export interface CurveSource {
  ref: string;
  url?: string;
  note?: string;
}

/** One continuous reference spectrum (a molecule's physical property). */
export interface Curve {
  id: string;
  label: string;
  color: string;
  /** [nm, μa cm^-1], ascending by wavelength. */
  points: Point[];
  source: CurveSource;
  gaps?: Gap[];
  /** True if `points` come from a model/formula rather than tabulated experiment. */
  modelFormula?: string;

  // --- Reserved concentration dimension (input ⑥). Present but disabled in v1. ---
  // In v1, AbsorptionSpectrum.setConcentration() (only when enableConcentration:true) applies a
  // dimensionless MULTIPLIER to `points` (μa scales linearly with concentration). The fields below
  // are documentation/reserved for a future absolute recompute (μa = f(ε, concentration)); they are
  // NOT consumed by the v1 multiplier path.
  /** Molar extinction ε in cm^-1/M, if the curve scales with concentration. */
  epsilon?: Point[];
  defaultConcentration?: number;
  concentrationUnit?: string;
  /** How μa is derived from ε and concentration, for documentation. */
  concentrationFormula?: string;

  /** Whether this curve is visible on first render. Defaults to true. */
  enabledByDefault?: boolean;
}

/** A discrete laser wavelength marker (the physical entity; model name is metadata). */
export interface Laser {
  id: string;
  label: string;
  wavelengthNm: number;
  /** Optional emission band, e.g. diode 810–980 nm. */
  rangeNm?: [number, number];
  note?: string;
}

export interface DatasetMeta {
  title: string;
  description: string;
  wavelengthUnit: 'nm';
  absorptionUnit: 'cm^-1';
  references: string[];
}

/**
 * A component that belongs in this family but has NO reliable tabulated μa(λ) to plot.
 * Declared explicitly so gaps are visible, never filled with fabricated data (寧缺勿假).
 */
export interface UnavailableCurve {
  id: string;
  label: string;
  reason: string;
  references: string[];
  /** Known absorption-band positions (nm), positions only — no μa magnitude available. */
  bandPositionsNm?: number[];
  note?: string;
}

export interface Dataset {
  meta: DatasetMeta;
  curves: Curve[];
  lasers: Laser[];
  unavailableCurves?: UnavailableCurve[];
}
