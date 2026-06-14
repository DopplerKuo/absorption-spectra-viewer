// Parse user-supplied curve data into validated [nm, μa] points.
// Accepts a JSON array `[[nm, mua], ...]` or line-delimited `nm, mua` (comma / tab / space / semicolon).
// Enforces the log-log invariants: ≥2 points, positive wavelength and positive μa, ascending by nm.

import type { Point } from './types';

export function parsePoints(text: string): Point[] {
  const t = (text ?? '').trim();
  if (!t) throw new Error('No data provided.');

  let rows: number[][];
  if (t[0] === '[') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(t);
    } catch {
      throw new Error('Looks like JSON but could not be parsed. Expected [[nm, μa], ...].');
    }
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of [nm, μa] pairs.');
    rows = parsed.map((p, i) => {
      if (!Array.isArray(p) || p.length < 2) throw new Error(`Item ${i + 1}: expected [nm, μa].`);
      return [Number(p[0]), Number(p[1])];
    });
  } else {
    rows = t
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && l[0] !== '#') // allow blank lines and # comments
      .map((l, i) => {
        const nums = l.split(/[\s,;]+/).map(Number);
        if (nums.length < 2 || !Number.isFinite(nums[0]) || !Number.isFinite(nums[1])) {
          throw new Error(`Line ${i + 1} ("${l}"): expected "nm, μa".`);
        }
        return [nums[0], nums[1]];
      });
  }

  if (rows.length < 2) throw new Error('Need at least 2 data points.');
  for (const [nm, mua] of rows) {
    if (!Number.isFinite(nm) || !Number.isFinite(mua)) throw new Error('All values must be numbers.');
    if (nm <= 0) throw new Error('Wavelength (nm) must be positive.');
    if (mua <= 0) throw new Error('Absorption μa must be positive (the axis is logarithmic).');
  }

  rows.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === rows[i - 1][0]) throw new Error(`Duplicate wavelength ${rows[i][0]} nm.`);
  }
  return rows as Point[];
}
