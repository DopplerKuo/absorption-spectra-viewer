import { describe, it, expect } from 'vitest';
import dataset from '../data/laser-tissue.json';
import { renderToSVGString, fmtMua } from '../src/render';
import type { Dataset } from '../src/types';

const ds = dataset as unknown as Dataset;
const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;

describe('renderToSVGString (DoD: SVG output, programmatically generated)', () => {
  it('produces a valid root <svg> with a viewBox', () => {
    const svg = renderToSVGString(ds);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 960 560"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('draws one path per default-visible curve (log-log axes, gaps split into segments)', () => {
    const svg = renderToSVGString(ds);
    // water, oxyhb, deoxyhb, melanin, HA => at least 5 path segments
    expect(countPaths(svg)).toBeGreaterThanOrEqual(5);
    expect(svg).toContain('data-layer="curves"');
  });

  it('labels the log y-axis with decade powers of ten', () => {
    const svg = renderToSVGString(ds);
    expect(svg).toContain('10⁻⁴');
    expect(svg).toContain('10⁵');
    expect(svg).toContain('Absorption coefficient');
  });

  it('semantic zoom re-ticks the x-axis (round ticks appear only when zoomed in)', () => {
    const full = renderToSVGString(ds);
    const zoom = renderToSVGString(ds, { xDomainNm: [2700, 3000] });
    expect(full).not.toContain('>2800<');
    expect(zoom).toContain('>2800<'); // a nice-linear tick that only exists in the zoom window
  });

  it('renders/omits laser markers per the lasers option (input ④)', () => {
    expect(renderToSVGString(ds, { lasers: 'all' })).toContain('Er:YAG');
    expect(renderToSVGString(ds, { lasers: 'none' })).not.toContain('Er:YAG');
    const one = renderToSVGString(ds, { lasers: ['eryag'] });
    expect(one).toContain('Er:YAG');
    expect(one).not.toContain('Nd:YAG');
  });

  it('draws a query cursor with a per-curve readout (input ①)', () => {
    const svg = renderToSVGString(ds, { query: 2940 });
    expect(svg).toContain('2940 nm');
    expect(svg).toContain('H₂O (Water):');
  });

  it('draws a two-wavelength comparison annotation (input ⑤)', () => {
    const svg = renderToSVGString(ds, { compare: { a: 2940, b: 2780, curveId: 'water' } });
    expect(svg).toMatch(/2\.\d×/); // ~2.9× fold difference
  });

  it('shows unavailable curves in the legend, greyed (寧缺勿假, visible gaps)', () => {
    const svg = renderToSVGString(ds);
    expect(svg).toContain('No tabulated μa');
    expect(svg).toContain('Collagen');
  });

  it('marks the visible-light range only when enabled (off by default, no misleading rainbow)', () => {
    expect(renderToSVGString(ds)).not.toContain('visband');
    const svg = renderToSVGString(ds, { visibleBand: { fromNm: 380, toNm: 700 } });
    expect(svg).toContain('linearGradient id="visband"');
    expect(svg).toContain('>visible<');
  });

  it('escapes double quotes so text is safe inside SVG attributes', () => {
    const svg = renderToSVGString(ds, { title: 'A "quoted" title' });
    expect(svg).toContain('&quot;');
    expect(svg).not.toContain('aria-label="A "quoted"'); // attribute not broken by raw quotes
  });
});

describe('fmtMua', () => {
  it('handles null, small, and large magnitudes', () => {
    expect(fmtMua(null)).toBe('—');
    expect(fmtMua(0.154)).toBe('0.154');
    expect(fmtMua(11990)).toMatch(/×10⁴/);
  });
});
