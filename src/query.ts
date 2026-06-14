// Pure query logic: look up μa at a wavelength (input ①) and compare two wavelengths (input ⑤).
// Kept DOM-free so it can be unit-tested in Node and reused by the component class.

import type { Dataset } from './types';
import { sampleCurve } from './interpolate';

/** μa min/max of the visible curves within a wavelength window (for auto-fitting the y-axis on zoom). */
export function dataYExtent(
  dataset: Dataset,
  fromNm: number,
  toNm: number,
  visibleIds?: string[],
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const c of dataset.curves) {
    if (visibleIds && !visibleIds.includes(c.id)) continue;
    const inWindow = c.points.map((p) => p[0]).filter((nm) => nm >= fromNm && nm <= toNm);
    for (const nm of [fromNm, toNm, ...inWindow]) {
      const v = sampleCurve(c, nm);
      if (v != null && v > 0) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
}

/** input ①: wavelength -> μa for each (optionally filtered) curve. null = no data there. */
export function queryDataset(
  dataset: Dataset,
  wavelengthNm: number,
  visibleIds?: string[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const c of dataset.curves) {
    if (visibleIds && !visibleIds.includes(c.id)) continue;
    out[c.id] = sampleCurve(c, wavelengthNm);
  }
  return out;
}

export interface Comparison {
  curveId: string;
  a: number;
  b: number;
  muaA: number | null;
  muaB: number | null;
  /** μa(a) / μa(b). */
  ratio: number | null;
  /** max/min as a "×" fold difference (always ≥ 1). */
  foldDifference: number | null;
  /** which wavelength has the higher μa, or null if not comparable. */
  higherAt: number | null;
}

/** input ⑤: ratio / fold-difference of μa between two wavelengths on one curve. */
export function compareWavelengths(
  dataset: Dataset,
  a: number,
  b: number,
  curveId: string,
): Comparison {
  const c = dataset.curves.find((x) => x.id === curveId);
  if (!c) throw new Error(`unknown curve "${curveId}"`);
  const muaA = sampleCurve(c, a);
  const muaB = sampleCurve(c, b);
  let ratio: number | null = null;
  let foldDifference: number | null = null;
  let higherAt: number | null = null;
  if (muaA != null && muaB != null && muaA > 0 && muaB > 0) {
    ratio = muaA / muaB;
    foldDifference = Math.max(muaA, muaB) / Math.min(muaA, muaB);
    higherAt = muaA >= muaB ? a : b;
  }
  return { curveId, a, b, muaA, muaB, ratio, foldDifference, higherAt };
}
