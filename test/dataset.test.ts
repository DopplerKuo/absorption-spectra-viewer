import { describe, it, expect } from 'vitest';
import dataset from '../data/laser-tissue.json';
import { sampleCurve } from '../src/interpolate';
import type { Curve, Dataset } from '../src/types';

const ds = dataset as unknown as Dataset;
const byId = (id: string): Curve => {
  const c = ds.curves.find((x) => x.id === id);
  if (!c) throw new Error(`missing curve ${id}`);
  return c;
};
const at = (id: string, nm: number) => sampleCurve(byId(id), nm);

describe('dataset schema (DoD: every curve has points + source + unit, no fabrication)', () => {
  it('declares correct units', () => {
    expect(ds.meta.wavelengthUnit).toBe('nm');
    expect(ds.meta.absorptionUnit).toBe('cm^-1');
  });

  it.each(['water', 'oxyhemoglobin', 'deoxyhemoglobin', 'melanin', 'hydroxyapatite', 'collagen-protein'])(
    'curve "%s" has data points, a cited source, ascending finite positive values',
    (id) => {
      const c = byId(id);
      expect(c.points.length).toBeGreaterThan(0);
      expect(c.source.ref.length).toBeGreaterThan(10);
      for (let i = 0; i < c.points.length; i++) {
        const [nm, mua] = c.points[i];
        expect(Number.isFinite(nm) && Number.isFinite(mua)).toBe(true);
        expect(mua).toBeGreaterThan(0);
        if (i > 0) expect(nm).toBeGreaterThan(c.points[i - 1][0]); // strictly ascending
      }
    },
  );

  it('model-fit and as-cited curves are flagged honestly', () => {
    expect(byId('melanin').modelFormula).toMatch(/lambda|\^/i);
    expect(byId('hydroxyapatite').source.note).toMatch(/as-cited|cited/i);
  });

  it('gaps are well-formed (from < to, with a reason)', () => {
    for (const c of ds.curves) {
      for (const g of c.gaps ?? []) {
        expect(g.fromNm).toBeLessThan(g.toNm);
        expect(g.reason.length).toBeGreaterThan(5);
      }
    }
  });

  it('collagen/protein is one merged curve, flagged as a reconstructed estimate (not measured)', () => {
    const c = byId('collagen-protein');
    expect(c.modelFormula).toMatch(/estimate/i); // honestly labelled, not presented as measured data
    expect(c.enabledByDefault).toBe(false); // off by default given ~×3 uncertainty
    expect(c.source.ref.length).toBeGreaterThan(20);
    // UV-strong, vis-NIR transparent window, mid-IR amide band — the correct qualitative shape
    expect(at('collagen-protein', 193)!).toBeGreaterThan(1000);
    expect(at('collagen-protein', 700)!).toBeLessThan(1);
  });

  it('every laser has a positive wavelength; the full handoff list is present', () => {
    for (const l of ds.lasers) expect(l.wavelengthNm).toBeGreaterThan(0);
    const ids = ds.lasers.map((l) => l.id);
    for (const need of ['ktp', 'ndyag', 'ercrysgg', 'eryag', 'co2_93', 'co2_106'])
      expect(ids).toContain(need);
  });
});

describe('physics sanity (DoD: values match physics & literature at laser wavelengths)', () => {
  it('2940 nm: water absorption is extremely high (Er:YAG peak)', () => {
    expect(at('water', 2940)!).toBeGreaterThan(5000);
  });

  it('optical window: water/melanin low at 1064 nm; hemoglobin low in the NIR (800 nm, within its domain)', () => {
    expect(at('water', 1064)!).toBeLessThan(10);
    expect(at('melanin', 1064)!).toBeLessThan(100);
    expect(at('oxyhemoglobin', 800)!).toBeLessThan(50);
    expect(at('deoxyhemoglobin', 800)!).toBeLessThan(50);
  });

  it('532 nm: hemoglobin & melanin absorb far more than water', () => {
    const water = at('water', 532)!;
    expect(at('oxyhemoglobin', 532)! / water).toBeGreaterThan(1000);
    expect(at('melanin', 532)! / water).toBeGreaterThan(1000);
  });

  it('2780 vs 2940 nm: water absorbs ~3–4× more at 2940 (the ~300% dynamic-figure claim)', () => {
    const ratio = at('water', 2940)! / at('water', 2780)!;
    expect(ratio).toBeGreaterThan(2.3);
    expect(ratio).toBeLessThan(4.5);
  });

  it('melanin decreases monotonically from visible into NIR', () => {
    expect(at('melanin', 400)!).toBeGreaterThan(at('melanin', 700)!);
    expect(at('melanin', 700)!).toBeGreaterThan(at('melanin', 1064)!);
  });

  it('HA/enamel: 9.6 µm phosphate band ~10× stronger than 10.6 µm', () => {
    const ratio = at('hydroxyapatite', 9600)! / at('hydroxyapatite', 10600)!;
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(12);
  });

  it('hemoglobin has no data beyond its 250–1000 nm domain (returns null, never extrapolates)', () => {
    expect(at('oxyhemoglobin', 1500)).toBeNull();
  });
});
