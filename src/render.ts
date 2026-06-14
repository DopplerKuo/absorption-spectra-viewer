// Pure SVG-string renderer for a log-log absorption spectrum.
// No DOM dependency: usable headless (server/tests) and as the draw step of the component.

import type { Dataset, Curve, Laser } from './types';
import { logScale, logTicks, axisTicks, type Scale } from './scales';
import { sampleCurve } from './interpolate';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  margin?: Partial<Margin>;
  /** x-axis wavelength window in nm. Narrow it for semantic zoom (axis re-ticks automatically). */
  xDomainNm?: [number, number];
  /** y-axis μa window in cm^-1. */
  yDomain?: [number, number];
  /** Curve ids to draw. Defaults to curves with enabledByDefault !== false. */
  visibleCurveIds?: string[];
  /** Laser markers to draw: ids, 'all', or 'none'. Default 'all'. */
  lasers?: string[] | 'all' | 'none';
  /** Highlight one laser (e.g. the selected one) and pin a μa readout at its wavelength. */
  activeLaserIds?: string[];
  /** Draw a query cursor + per-curve readout at this wavelength (input ①). */
  query?: number | null;
  /** Draw a two-wavelength comparison annotation (input ⑤). */
  compare?: { a: number; b: number; curveId: string } | null;
  /** Draw a drag-to-zoom selection while brushing. With fromMua/toMua it is a 2D rectangle. */
  brush?: { fromNm: number; toNm: number; fromMua?: number; toMua?: number } | null;
  title?: string;
  showLegend?: boolean;
  background?: string;
  fontFamily?: string;
  /** Shade the visible-light range at its true log-axis position (e.g. {fromNm:380,toNm:700}). */
  visibleBand?: { fromNm: number; toNm: number } | null;
}

// Approximate sRGB of the visible spectrum, used to colour the visible-light band accurately.
const SPECTRUM_STOPS: Array<[number, string]> = [
  [380, '#7a3fb0'],
  [430, '#2b3fd0'],
  [480, '#00a0d0'],
  [520, '#28c24a'],
  [565, '#cfd400'],
  [590, '#f0a000'],
  [625, '#f04e1e'],
  [680, '#d0241c'],
  [700, '#b81d18'],
];

const DEFAULTS = {
  width: 960,
  height: 560,
  margin: { top: 56, right: 212, bottom: 58, left: 76 } as Margin,
  xDomainNm: [100, 12000] as [number, number],
  yDomain: [1e-4, 1e5] as [number, number],
  lasers: 'all' as const,
  showLegend: true,
  background: '#ffffff',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
};

const SUP: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
const sup = (n: number) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const fmtPow10 = (v: number) => `10${sup(Math.round(Math.log10(v)))}`;
const fmtNm = (v: number) => String(v); // axis is labelled in nm; keep it consistent
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;'); // safe in both text and attribute contexts
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Format a μa value compactly for readouts. */
export function fmtMua(v: number | null): string {
  if (v == null) return '—';
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  if (exp >= 4 || exp <= -2) {
    const m = v / Math.pow(10, exp);
    return `${(Math.round(m * 100) / 100)}×10${sup(exp)}`;
  }
  return String(Math.round(v * 1000) / 1000);
}

/** Break a curve into polyline segments within [xmin,xmax], split at gaps / domain edges. */
function curveSegments(
  curve: Curve,
  xmin: number,
  xmax: number,
  xs: (v: number) => number,
  ys: (v: number) => number,
): string[] {
  const wavelengths = new Set<number>();
  for (const [nm] of curve.points) if (nm > xmin && nm < xmax) wavelengths.add(nm);
  wavelengths.add(xmin);
  wavelengths.add(xmax);
  // sample at gap boundaries too, so a gap between two data points still breaks the line
  for (const g of curve.gaps ?? []) {
    if (g.fromNm > xmin && g.fromNm < xmax) wavelengths.add(g.fromNm);
    if (g.toNm > xmin && g.toNm < xmax) wavelengths.add(g.toNm);
  }
  const sorted = [...wavelengths].sort((a, b) => a - b);

  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  for (const nm of sorted) {
    const mua = sampleCurve(curve, nm);
    if (mua == null || mua <= 0) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push([xs(nm), ys(mua)]);
  }
  if (current.length > 1) segments.push(current);

  return segments.map(
    (seg) => `M ${seg.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(' L ')}`,
  );
}

export interface Geometry {
  width: number;
  height: number;
  margin: Margin;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xs: Scale;
  ys: Scale;
}

/** Plot geometry + scales for given options. Shared by the renderer and the component (hover inversion). */
export function computeGeometry(opts: RenderOptions = {}): Geometry {
  const width = opts.width ?? DEFAULTS.width;
  const height = opts.height ?? DEFAULTS.height;
  const margin: Margin = { ...DEFAULTS.margin, ...(opts.margin ?? {}) };
  const xDomain = opts.xDomainNm ?? DEFAULTS.xDomainNm;
  const yDomain = opts.yDomain ?? DEFAULTS.yDomain;
  const x0 = margin.left;
  const x1 = width - margin.right;
  const y0 = margin.top;
  const y1 = height - margin.bottom;
  return {
    width,
    height,
    margin,
    x0,
    x1,
    y0,
    y1,
    xDomain,
    yDomain,
    xs: logScale(xDomain, [x0, x1]),
    ys: logScale(yDomain, [y1, y0]), // inverted: large μa near the top
  };
}

export function renderToSVGString(dataset: Dataset, opts: RenderOptions = {}): string {
  const geom = computeGeometry(opts);
  const { width, height, x0, x1, y0, y1, xDomain, yDomain, xs, ys } = geom;
  const showLegend = opts.showLegend ?? DEFAULTS.showLegend;
  const lasersOpt = opts.lasers ?? DEFAULTS.lasers;

  const visibleIds =
    opts.visibleCurveIds ??
    dataset.curves.filter((c) => c.enabledByDefault !== false).map((c) => c.id);
  const visible = dataset.curves.filter((c) => visibleIds.includes(c.id));

  const xticks = axisTicks(xDomain[0], xDomain[1]);
  const yticks = logTicks(yDomain[0], yDomain[1]);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
      `width="${width}" height="${height}" font-family="${esc(opts.fontFamily ?? DEFAULTS.fontFamily)}" role="img" aria-label="${esc(dataset.meta.title)}">`,
  );
  // visible-light band, positioned at its true wavelengths on the log axis
  const vb =
    opts.visibleBand && opts.visibleBand.toNm > xDomain[0] && opts.visibleBand.fromNm < xDomain[1]
      ? opts.visibleBand
      : null;
  let defsInner = `<clipPath id="plot"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath>`;
  if (vb) {
    const lf = Math.log10(vb.fromNm);
    const lspan = Math.log10(vb.toNm) - lf;
    const stops = SPECTRUM_STOPS.filter(([w]) => w >= vb.fromNm && w <= vb.toNm)
      .map(([w, c]) => `<stop offset="${(((Math.log10(w) - lf) / lspan) * 100).toFixed(1)}%" stop-color="${c}"/>`)
      .join('');
    // userSpaceOnUse anchors colours to absolute wavelength pixels, so they stay correct when zoomed
    defsInner += `<linearGradient id="visband" gradientUnits="userSpaceOnUse" x1="${r2(xs(vb.fromNm))}" y1="0" x2="${r2(xs(vb.toNm))}" y2="0">${stops}</linearGradient>`;
  }
  parts.push(`<defs>${defsInner}</defs>`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${opts.background ?? DEFAULTS.background}"/>`);
  if (vb) {
    const bx0 = r2(xs(Math.max(vb.fromNm, xDomain[0])));
    const bx1 = r2(xs(Math.min(vb.toNm, xDomain[1])));
    if (bx1 > bx0) {
      parts.push(
        `<g clip-path="url(#plot)"><rect x="${bx0}" y="${y0}" width="${r2(bx1 - bx0)}" height="${y1 - y0}" fill="url(#visband)" opacity="0.15"/>` +
          `<text x="${bx0 + 4}" y="${y1 - 5}" font-size="9" fill="#475467">visible</text></g>`,
      );
    }
  }

  // --- gridlines ---
  const grid: string[] = [];
  for (const t of yticks) {
    const y = r2(ys(t.value));
    grid.push(
      `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t.major ? '#d0d5dd' : '#eef1f4'}" stroke-width="1"/>`,
    );
  }
  for (const t of xticks) {
    const x = r2(xs(t.value));
    grid.push(
      `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${t.major ? '#d0d5dd' : '#eef1f4'}" stroke-width="1"/>`,
    );
  }
  parts.push(`<g>${grid.join('')}</g>`);

  // --- laser markers (input ④) ---
  const laserList: Laser[] =
    lasersOpt === 'none'
      ? []
      : lasersOpt === 'all'
        ? dataset.lasers
        : dataset.lasers.filter((l) => (lasersOpt as string[]).includes(l.id));
  const activeIds = new Set(opts.activeLaserIds ?? []);
  const ACCENT = '#b42318';
  const inView = laserList.filter((l) => l.wavelengthNm >= xDomain[0] && l.wavelengthNm <= xDomain[1]);
  const laserParts: string[] = [];
  for (const l of inView) {
    const x = r2(xs(l.wavelengthNm));
    const on = activeIds.has(l.id);
    if (l.rangeNm) {
      const bx0 = r2(xs(Math.max(l.rangeNm[0], xDomain[0])));
      const bx1 = r2(xs(Math.min(l.rangeNm[1], xDomain[1])));
      if (bx1 > bx0) laserParts.push(`<rect x="${bx0}" y="${y0}" width="${r2(bx1 - bx0)}" height="${y1 - y0}" fill="${on ? ACCENT : '#111827'}" opacity="${on ? 0.08 : 0.05}"/>`);
    }
    laserParts.push(
      `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${on ? ACCENT : '#475467'}" stroke-width="${on ? 1.75 : 1}"${on ? '' : ' stroke-dasharray="4 3"'} opacity="${on ? 1 : 0.6}"/>`,
    );
  }
  parts.push(`<g clip-path="url(#plot)" data-layer="lasers">${laserParts.join('')}</g>`);
  // laser labels (with invisible wide hit-targets for clicking) drawn above the plot
  const laserLabels = inView.map((l) => {
    const x = r2(xs(l.wavelengthNm));
    const on = activeIds.has(l.id);
    return (
      `<g data-laser="${esc(l.id)}" style="cursor:pointer">` +
      `<rect x="${x - 7}" y="${y0}" width="14" height="${y1 - y0}" fill="transparent"/>` +
      `<text x="${x}" y="${y0 - 6}" transform="rotate(-90 ${x} ${y0 - 6})" font-size="10" font-weight="${on ? 700 : 400}" fill="${on ? ACCENT : '#475467'}" text-anchor="start">${esc(l.label)}</text>` +
      `</g>`
    );
  });
  parts.push(`<g>${laserLabels.join('')}</g>`);

  // --- curves (clipped to the plot area) ---
  const curveParts: string[] = [];
  for (const c of visible) {
    const paths = curveSegments(c, xDomain[0], xDomain[1], xs, ys);
    for (const d of paths) {
      curveParts.push(
        `<path d="${d}" fill="none" stroke="${c.color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"${c.modelFormula ? ' stroke-dasharray="6 3"' : ''}/>`,
      );
    }
    // mark sparse curves (few points) with dots so they are visible
    if (c.points.length <= 8) {
      for (const [nm, mua] of c.points) {
        if (nm < xDomain[0] || nm > xDomain[1]) continue;
        curveParts.push(`<circle cx="${r2(xs(nm))}" cy="${r2(ys(mua))}" r="3" fill="${c.color}"/>`);
      }
    }
  }
  parts.push(`<g clip-path="url(#plot)" data-layer="curves">${curveParts.join('')}</g>`);

  // --- drag-to-zoom selection (2D rectangle; spans full height if no μa bounds given) ---
  if (opts.brush) {
    const bx0 = r2(xs(Math.max(Math.min(opts.brush.fromNm, opts.brush.toNm), xDomain[0])));
    const bx1 = r2(xs(Math.min(Math.max(opts.brush.fromNm, opts.brush.toNm), xDomain[1])));
    const hasY = opts.brush.fromMua != null && opts.brush.toMua != null;
    const by0 = hasY ? r2(ys(Math.max(opts.brush.fromMua!, opts.brush.toMua!))) : y0;
    const by1 = hasY ? r2(ys(Math.min(opts.brush.fromMua!, opts.brush.toMua!))) : y1;
    if (bx1 > bx0 && by1 > by0)
      parts.push(
        `<g clip-path="url(#plot)"><rect x="${bx0}" y="${by0}" width="${r2(bx1 - bx0)}" height="${r2(by1 - by0)}" fill="#1f77b4" opacity="0.14" stroke="#1f77b4" stroke-width="1"/></g>`,
      );
  }

  // --- query cursor + readout (input ①) ---
  if (opts.query != null && opts.query >= xDomain[0] && opts.query <= xDomain[1]) {
    const qx = r2(xs(opts.query));
    const cur: string[] = [
      `<line x1="${qx}" y1="${y0}" x2="${qx}" y2="${y1}" stroke="#101828" stroke-width="1.25"/>`,
    ];
    const readout: string[] = [];
    let row = 0;
    for (const c of visible) {
      const mua = sampleCurve(c, opts.query);
      if (mua == null) continue;
      const cy = r2(ys(mua));
      cur.push(`<circle cx="${qx}" cy="${cy}" r="4" fill="#fff" stroke="${c.color}" stroke-width="2"/>`);
      readout.push(
        `<text x="${qx + 8}" y="${y0 + 14 + row * 15}" font-size="11" fill="${c.color}">${esc(c.label)}: ${fmtMua(mua)}</text>`,
      );
      row++;
    }
    parts.push(`<g clip-path="url(#plot)">${cur.join('')}</g>`);
    parts.push(
      `<text x="${qx}" y="${y1 + 32}" font-size="11" font-weight="600" fill="#101828" text-anchor="middle">${fmtNm(opts.query)} nm</text>`,
    );
    parts.push(`<g>${readout.join('')}</g>`);
  }

  // --- two-wavelength comparison (input ⑤) ---
  if (opts.compare) {
    const c = dataset.curves.find((x) => x.id === opts.compare!.curveId);
    if (c) {
      const { a, b } = opts.compare;
      const ma = sampleCurve(c, a);
      const mb = sampleCurve(c, b);
      const cmp: string[] = [];
      for (const [nm, mua] of [
        [a, ma],
        [b, mb],
      ] as Array<[number, number | null]>) {
        if (nm < xDomain[0] || nm > xDomain[1]) continue;
        const cx = r2(xs(nm));
        cmp.push(`<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" stroke="#067647" stroke-width="1.5" stroke-dasharray="2 2"/>`);
        if (mua != null) cmp.push(`<circle cx="${cx}" cy="${r2(ys(mua))}" r="4" fill="#067647"/>`);
      }
      parts.push(`<g clip-path="url(#plot)">${cmp.join('')}</g>`);
      if (ma != null && mb != null && ma > 0 && mb > 0) {
        const fold = Math.max(ma, mb) / Math.min(ma, mb);
        parts.push(
          `<text x="${x0 + 10}" y="${y0 + 16}" font-size="12" font-weight="600" fill="#067647">${esc(c.label)}: μa(${fmtNm(a)}) / μa(${fmtNm(b)}) = ${fold.toFixed(1)}×</text>`,
        );
      }
    }
  }

  // --- axes + ticks + labels ---
  const axes: string[] = [];
  axes.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#101828" stroke-width="1.5"/>`);
  for (const t of yticks) {
    const y = r2(ys(t.value));
    axes.push(`<line x1="${x0 - 5}" y1="${y}" x2="${x0}" y2="${y}" stroke="#101828" stroke-width="1"/>`);
    if (t.major)
      axes.push(`<text x="${x0 - 9}" y="${y + 3.5}" font-size="11" fill="#101828" text-anchor="end">${fmtPow10(t.value)}</text>`);
  }
  for (const t of xticks) {
    const x = r2(xs(t.value));
    axes.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y1 + 5}" stroke="#101828" stroke-width="1"/>`);
    if (t.major)
      axes.push(`<text x="${x}" y="${y1 + 18}" font-size="11" fill="#101828" text-anchor="middle">${fmtNm(t.value)}</text>`);
  }
  axes.push(
    `<text x="${(x0 + x1) / 2}" y="${height - 14}" font-size="12.5" font-weight="600" fill="#101828" text-anchor="middle">Wavelength (nm)</text>`,
  );
  axes.push(
    `<text transform="translate(${18},${(y0 + y1) / 2}) rotate(-90)" font-size="12.5" font-weight="600" fill="#101828" text-anchor="middle">Absorption coefficient μa (cm⁻¹)</text>`,
  );
  parts.push(`<g>${axes.join('')}</g>`);

  // --- title ---
  if (opts.title ?? dataset.meta.title) {
    parts.push(
      `<text x="${x0}" y="${20}" font-size="14" font-weight="700" fill="#101828">${esc(opts.title ?? dataset.meta.title)}</text>`,
    );
  }

  // --- legend ---
  if (showLegend) {
    const lx = x1 + 16;
    const legend: string[] = [`<text x="${lx}" y="${y0 + 2}" font-size="11" font-weight="700" fill="#101828">Curves</text>`];
    let ly = y0 + 18;
    for (const c of dataset.curves) {
      const on = visibleIds.includes(c.id);
      legend.push(
        `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 22}" y2="${ly - 4}" stroke="${c.color}" stroke-width="3"${c.modelFormula ? ' stroke-dasharray="6 3"' : ''} opacity="${on ? 1 : 0.3}"/>`,
      );
      legend.push(
        `<text x="${lx + 28}" y="${ly}" font-size="11" fill="${on ? '#101828' : '#98a2b3'}">${esc(c.label)}</text>`,
      );
      ly += 17;
    }
    if (dataset.unavailableCurves?.length) {
      ly += 6;
      legend.push(`<text x="${lx}" y="${ly}" font-size="10" font-weight="700" fill="#98a2b3">No tabulated μa</text>`);
      ly += 15;
      for (const u of dataset.unavailableCurves) {
        legend.push(`<line x1="${lx}" y1="${ly - 4}" x2="${lx + 22}" y2="${ly - 4}" stroke="#98a2b3" stroke-width="2" stroke-dasharray="2 3"/>`);
        legend.push(`<text x="${lx + 28}" y="${ly}" font-size="10" fill="#98a2b3">${esc(u.label)}</text>`);
        ly += 15;
      }
    }
    parts.push(`<g>${legend.join('')}</g>`);
  }

  parts.push('</svg>');
  return parts.join('');
}
