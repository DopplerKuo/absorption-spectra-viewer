import { describe, it, expect } from 'vitest';
import dataset from '../data/laser-tissue.json';
import { niceDecadeRange } from '../src/scales';
import { dataYExtent } from '../src/query';
import type { Dataset } from '../src/types';

const ds = dataset as unknown as Dataset;

describe('niceDecadeRange', () => {
  it('rounds outward to whole decades', () => {
    expect(niceDecadeRange(4200, 11990)).toEqual([1000, 100000]);
    expect(niceDecadeRange(0.15, 49)).toEqual([0.1, 100]);
  });
  it('guarantees at least one decade', () => {
    const [lo, hi] = niceDecadeRange(500, 600);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe('dataYExtent (auto-fit y on semantic zoom)', () => {
  it('finds the μa range of water within the Er-laser window', () => {
    const ext = dataYExtent(ds, 2700, 3000, ['water'])!;
    expect(ext[0]).toBeGreaterThan(100); // ~700 at 2700 nm
    expect(ext[1]).toBeGreaterThan(10000); // ~1.2e4 peak near 2940 nm
    // -> nice range should zoom y from full [1e-4,1e5] down to ~[100,1e5]
    expect(niceDecadeRange(ext[0], ext[1])[0]).toBeGreaterThanOrEqual(100);
  });
  it('returns null where no visible curve has data', () => {
    expect(dataYExtent(ds, 1100, 1300, ['hydroxyapatite'])).toBeNull();
  });
});
