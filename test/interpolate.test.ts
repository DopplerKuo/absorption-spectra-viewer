import { describe, it, expect } from 'vitest';
import { interpolateLogLog, sampleCurve } from '../src/interpolate';
import type { Point } from '../src/types';

describe('interpolateLogLog', () => {
  const pts: Point[] = [
    [100, 1],
    [1000, 100],
  ]; // a straight line in log-log space (slope 1)

  it('returns exact endpoint values', () => {
    expect(interpolateLogLog(pts, 100)).toBeCloseTo(1);
    expect(interpolateLogLog(pts, 1000)).toBeCloseTo(100);
  });
  it('interpolates along the log-log line (geometric mean maps to geometric mean)', () => {
    // x = sqrt(100*1000) = 316.23 -> y = sqrt(1*100) = 10
    expect(interpolateLogLog(pts, 316.227)).toBeCloseTo(10, 1);
  });
  it('returns null outside the data domain', () => {
    expect(interpolateLogLog(pts, 50)).toBeNull();
    expect(interpolateLogLog(pts, 2000)).toBeNull();
  });
});

describe('sampleCurve', () => {
  const curve = {
    points: [
      [100, 1],
      [1000, 100],
      [5000, 5],
    ] as Point[],
    gaps: [{ fromNm: 1200, toNm: 4000, reason: 'no data' }],
  };

  it('interpolates within available data', () => {
    expect(sampleCurve(curve, 316.227)).toBeCloseTo(10, 1);
  });
  it('returns null inside a declared gap (never interpolates across it)', () => {
    expect(sampleCurve(curve, 2000)).toBeNull();
  });
  it('returns null outside the domain', () => {
    expect(sampleCurve(curve, 20)).toBeNull();
  });

  it('returns null for shoulder samples whose only segment bridges an interior gap', () => {
    expect(sampleCurve(curve, 1100)).toBeNull(); // left shoulder of the 1200–4000 gap
    expect(sampleCurve(curve, 4500)).toBeNull(); // right shoulder
    expect(sampleCurve(curve, 1000)).toBeCloseTo(100); // real data point preserved
    expect(sampleCurve(curve, 5000)).toBeCloseTo(5); // real data point preserved
  });
});
