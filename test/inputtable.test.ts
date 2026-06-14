import { describe, it, expect } from 'vitest';
import dataset from '../data/laser-tissue.json';
import { renderToSVGString } from '../src/render';
import { queryDataset } from '../src/query';
import type { Dataset, Curve } from '../src/types';

const ds = dataset as unknown as Dataset;

// The curves array is the INPUT layer: any chromophore (e.g. collagen/protein once you have real
// μa data) can be fed in and is immediately queryable and rendered. No engine change required.
describe('curves are an input layer', () => {
  const collagen: Curve = {
    id: 'collagen',
    label: 'Collagen (my data)',
    color: '#0a8a0a',
    points: [
      [1500, 2],
      [1700, 5],
      [2940, 30],
    ],
    source: { ref: 'user-supplied μa table' },
  };
  const withCollagen: Dataset = { ...ds, curves: [...ds.curves, collagen] };

  it('a supplied curve is immediately queryable', () => {
    const r = queryDataset(withCollagen, 1600, ['collagen']);
    expect(r.collagen).not.toBeNull();
    expect(r.collagen!).toBeGreaterThan(0);
  });

  it('a supplied curve is rendered (one more path than the base dataset)', () => {
    const base = (renderToSVGString(ds).match(/<path /g) ?? []).length;
    const more = (
      renderToSVGString(withCollagen, {
        visibleCurveIds: withCollagen.curves.map((c) => c.id),
      }).match(/<path /g) ?? []
    ).length;
    expect(more).toBeGreaterThan(base);
    expect(renderToSVGString(withCollagen, { visibleCurveIds: ['collagen'] })).toContain(
      'Collagen (my data)',
    );
  });
});
