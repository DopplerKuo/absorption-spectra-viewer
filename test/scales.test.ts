import { describe, it, expect } from 'vitest';
import { logScale, logTicks, niceLinearTicks, axisTicks } from '../src/scales';

describe('logScale', () => {
  it('maps domain endpoints to range endpoints', () => {
    const s = logScale([1, 1000], [0, 300]);
    expect(s(1)).toBeCloseTo(0);
    expect(s(1000)).toBeCloseTo(300);
  });
  it('maps each decade to proportional pixels', () => {
    const s = logScale([1, 1000], [0, 300]); // 3 decades / 300px = 100px per decade
    expect(s(10)).toBeCloseTo(100);
    expect(s(100)).toBeCloseTo(200);
  });
  it('inverts pixel back to value', () => {
    const s = logScale([1, 1000], [0, 300]);
    expect(s.invert(100)).toBeCloseTo(10);
    expect(s.invert(s(42))).toBeCloseTo(42);
  });
  it('supports an inverted range (SVG y-axis: small pixel = large value)', () => {
    const s = logScale([1e-4, 1e5], [400, 0]);
    expect(s(1e5)).toBeCloseTo(0);
    expect(s(1e-4)).toBeCloseTo(400);
  });
});

describe('logTicks', () => {
  it('produces decade majors across the range', () => {
    const majors = logTicks(1e-2, 1e2).filter((t) => t.major).map((t) => t.value);
    expect(majors).toEqual([0.01, 0.1, 1, 10, 100]);
  });
  it('includes minor ticks between decades', () => {
    const minors = logTicks(1, 100).filter((t) => !t.major).map((t) => t.value);
    expect(minors).toContain(20);
    expect(minors).toContain(50);
  });
});

describe('niceLinearTicks', () => {
  it('produces round ticks inside a sub-decade zoom window', () => {
    const vals = niceLinearTicks(2700, 3000).map((t) => t.value);
    expect(vals).toContain(2800);
    expect(vals).toContain(2900);
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(2700);
    expect(Math.max(...vals)).toBeLessThanOrEqual(3000);
  });
});

describe('degenerate domain (min === max)', () => {
  it('logScale collapses to the range start instead of emitting NaN', () => {
    const s = logScale([500, 500], [0, 300]);
    expect(Number.isFinite(s(500))).toBe(true);
    expect(s(500)).toBe(0);
    expect(s.invert(0)).toBe(500);
  });
  it('tick generators return a single tick instead of an empty array', () => {
    expect(niceLinearTicks(2700, 2700)).toEqual([{ value: 2700, major: true }]);
    expect(axisTicks(2700, 2700)).toEqual([{ value: 2700, major: true }]);
  });
});

describe('axisTicks', () => {
  it('uses log ticks for wide spans', () => {
    const t = axisTicks(100, 11000);
    expect(t.some((x) => x.value === 1000 && x.major)).toBe(true);
  });
  it('uses linear-nice ticks for a narrow semantic-zoom window', () => {
    const t = axisTicks(2700, 3000);
    expect(t.some((x) => x.value === 2800)).toBe(true);
  });
});
