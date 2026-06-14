// Log-log interpolation for "look up μa at a wavelength", with gap/domain awareness.

import type { Point, Gap } from './types';

const log10 = Math.log10;

/**
 * Interpolate a value at x along a polyline in log-log space.
 * Returns null when x is outside [first, last] wavelength (no extrapolation).
 */
export function interpolateLogLog(points: Point[], x: number): number | null {
  const n = points.length;
  if (n === 0) return null;
  if (x < points[0][0] || x > points[n - 1][0]) return null;

  // binary search for the bracketing segment
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = points[lo];
  const [x1, y1] = points[hi];
  if (x === x0) return y0;
  if (x === x1) return y1;
  if (x1 === x0) return y0;

  // log-log linear interpolation when all values are positive (the physical case)
  if (y0 > 0 && y1 > 0 && x0 > 0 && x1 > 0) {
    const t = (log10(x) - log10(x0)) / (log10(x1) - log10(x0));
    return Math.pow(10, log10(y0) + t * (log10(y1) - log10(y0)));
  }
  // linear fallback for non-positive values
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

/**
 * Sample a curve at x. Returns null when x is outside the data domain, inside a declared gap,
 * OR when the only supporting segment bridges a gap (so a no-data region is never interpolated
 * across — even for a sample just outside the gap whose bracketing points straddle it).
 */
export function sampleCurve(curve: { points: Point[]; gaps?: Gap[] }, x: number): number | null {
  const pts = curve.points;
  const n = pts.length;
  if (n === 0) return null;
  if (x < pts[0][0] || x > pts[n - 1][0]) return null;

  const gaps = curve.gaps;
  if (gaps && gaps.length) {
    for (const g of gaps) if (x >= g.fromNm && x <= g.toNm) return null;

    // locate the bracketing segment; reject if it spans a gap (unless x is an actual data point)
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid][0] <= x) lo = mid;
      else hi = mid;
    }
    if (x === pts[lo][0]) return pts[lo][1];
    if (x === pts[hi][0]) return pts[hi][1];
    for (const g of gaps) {
      if (pts[lo][0] < g.toNm && pts[hi][0] > g.fromNm) return null;
    }
  }
  return interpolateLogLog(pts, x);
}
