// Public API of the photolyze engine.
export { AbsorptionSpectrum } from './spectrum';
export type { SpectrumOptions } from './spectrum';
export { renderToSVGString, computeGeometry, fmtMua } from './render';
export type { RenderOptions, Geometry, Margin } from './render';
export { queryDataset, compareWavelengths, dataYExtent } from './query';
export type { Comparison } from './query';
export { sampleCurve, interpolateLogLog } from './interpolate';
export { parsePoints } from './parse';
export { logScale, logTicks, niceLinearTicks, axisTicks, niceDecadeRange } from './scales';
export type { Scale, Tick } from './scales';
export type {
  Dataset,
  DatasetMeta,
  Curve,
  CurveSource,
  Laser,
  Gap,
  Point,
  UnavailableCurve,
} from './types';
