// Log/linear axis math for the log-log spectrum chart, plus adaptive tick generation.

export interface Tick {
  value: number;
  major: boolean;
}

/** A log scale: value -> pixel, with .invert for pixel -> value. Range may be inverted. */
export interface Scale {
  (value: number): number;
  invert(px: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
}

const log10 = Math.log10;

export function logScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const ld0 = log10(d0);
  const ld1 = log10(d1);
  const span = ld1 - ld0;
  // Degenerate domain (d0 === d1): collapse everything to the range start instead of emitting NaN.
  const fn = ((v: number) =>
    span === 0 ? r0 : r0 + ((log10(v) - ld0) / span) * (r1 - r0)) as Scale;
  fn.invert = (px: number) =>
    span === 0 ? d0 : Math.pow(10, ld0 + ((px - r0) / (r1 - r0)) * span);
  fn.domain = domain;
  fn.range = range;
  return fn;
}

const EPS = 1e-9;

/** Decade major ticks (10^k) plus 2–9 minor ticks per decade, within [min, max]. */
export function logTicks(min: number, max: number): Tick[] {
  const ticks: Tick[] = [];
  const startExp = Math.floor(log10(min));
  const endExp = Math.ceil(log10(max));
  for (let e = startExp; e <= endExp; e++) {
    const decade = Math.pow(10, e);
    for (let m = 1; m < 10; m++) {
      const v = m * decade;
      if (v < min * (1 - EPS) || v > max * (1 + EPS)) continue;
      ticks.push({ value: v, major: m === 1 });
    }
  }
  return ticks;
}

function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const exp = Math.floor(log10(rough));
  const base = Math.pow(10, exp);
  const f = rough / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

/** Round "nice" ticks for a narrow (sub-decade) window, e.g. a 2700–3000 nm zoom. */
export function niceLinearTicks(min: number, max: number, target = 6): Tick[] {
  if (!(max > min)) return [{ value: min, major: true }];
  const step = niceStep((max - min) / target);
  const start = Math.ceil(min / step - EPS) * step;
  const ticks: Tick[] = [];
  for (let v = start; v <= max * (1 + EPS) + EPS; v += step) {
    ticks.push({ value: +v.toPrecision(12), major: true });
  }
  return ticks;
}

/** Picks log ticks for wide spans, nice-linear ticks for a narrow semantic-zoom window. */
export function axisTicks(min: number, max: number): Tick[] {
  if (!(max > min)) return [{ value: min, major: true }];
  return log10(max / min) >= 1.7 ? logTicks(min, max) : niceLinearTicks(min, max);
}

/** Round a [min,max] value range outward to whole decades (≥ 1 decade wide). */
export function niceDecadeRange(min: number, max: number): [number, number] {
  let lo = Math.pow(10, Math.floor(log10(min)));
  let hi = Math.pow(10, Math.ceil(log10(max)));
  if (hi <= lo) hi = lo * 10;
  return [lo, hi];
}
