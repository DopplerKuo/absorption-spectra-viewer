import { describe, it, expect } from 'vitest';
import { parsePoints } from '../src/parse';

describe('parsePoints (user data import)', () => {
  it('parses comma-separated lines and sorts ascending', () => {
    expect(parsePoints('1700, 5.4\n1500, 2.1')).toEqual([
      [1500, 2.1],
      [1700, 5.4],
    ]);
  });
  it('parses whitespace/tab and skips blank lines and # comments', () => {
    expect(parsePoints('# my collagen data\n1500\t2\n\n1700 5')).toEqual([
      [1500, 2],
      [1700, 5],
    ]);
  });
  it('parses a JSON array of pairs', () => {
    expect(parsePoints('[[1500,2.1],[1700,5.4]]')).toEqual([
      [1500, 2.1],
      [1700, 5.4],
    ]);
  });
  it('requires at least two points', () => {
    expect(() => parsePoints('1500, 2')).toThrow();
  });
  it('rejects non-positive wavelength or μa (log-log axes)', () => {
    expect(() => parsePoints('0, 2\n1700, 5')).toThrow();
    expect(() => parsePoints('1500, 0\n1700, 5')).toThrow();
    expect(() => parsePoints('1500, -1\n1700, 5')).toThrow();
  });
  it('rejects non-numeric values', () => {
    expect(() => parsePoints('abc, 2\n1700, 5')).toThrow();
  });
  it('rejects duplicate wavelengths', () => {
    expect(() => parsePoints('1500, 2\n1500, 3')).toThrow();
  });
});
