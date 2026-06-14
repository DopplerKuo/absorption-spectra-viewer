import { describe, it, expect } from 'vitest';
import dataset from '../data/laser-tissue.json';
import { queryDataset, compareWavelengths } from '../src/query';
import type { Dataset } from '../src/types';

const ds = dataset as unknown as Dataset;

describe('queryDataset (input ① look up μa at a wavelength)', () => {
  it('returns a value per curve, null where there is no data', () => {
    const r = queryDataset(ds, 1064);
    expect(r.water!).toBeCloseTo(0.154, 2);
    expect(r.melanin!).toBeLessThan(100);
    expect(r.hydroxyapatite).toBeNull(); // 1064 nm is in HA's gap
    expect(r.oxyhemoglobin).toBeNull(); // beyond hemoglobin's 250–1000 nm domain
  });

  it('respects the visible-curve filter (input ③)', () => {
    const r = queryDataset(ds, 532, ['water', 'melanin']);
    expect(Object.keys(r).sort()).toEqual(['melanin', 'water']);
  });
});

describe('compareWavelengths (input ⑤ two-wavelength ratio)', () => {
  it('computes the ~3x water fold-difference between Er:YAG and Er,Cr:YSGG', () => {
    const cmp = compareWavelengths(ds, 2940, 2780, 'water');
    expect(cmp.foldDifference!).toBeGreaterThan(2.3);
    expect(cmp.foldDifference!).toBeLessThan(4.5);
    expect(cmp.higherAt).toBe(2940);
    expect(cmp.ratio!).toBeCloseTo(cmp.muaA! / cmp.muaB!, 6);
  });

  it('returns null comparison when one wavelength has no data', () => {
    const cmp = compareWavelengths(ds, 532, 5000, 'oxyhemoglobin');
    expect(cmp.ratio).toBeNull();
    expect(cmp.foldDifference).toBeNull();
  });

  it('throws on an unknown curve id', () => {
    expect(() => compareWavelengths(ds, 1, 2, 'nope')).toThrow();
  });
});
