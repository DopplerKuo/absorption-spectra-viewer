// AbsorptionSpectrum: the framework-agnostic, imperative component.
// Mounts an SVG into a container and exposes the interaction inputs (+ reserved concentration).
// All state changes re-render via the pure renderToSVGString.

import type { Dataset, Curve, Laser } from './types';
import { renderToSVGString, computeGeometry, type RenderOptions } from './render';
import { queryDataset, compareWavelengths, dataYExtent, type Comparison } from './query';
import { niceDecadeRange } from './scales';

export interface SpectrumOptions extends RenderOptions {
  /** Attach a live mouse cursor that queries μa as you move (input ①). Default true. */
  interactiveQuery?: boolean;
  /** Called whenever the live query position changes. */
  onQuery?: (wavelengthNm: number, values: Record<string, number | null>) => void;
  /** Enable the reserved concentration dimension (input ⑥). Default false (v1 = fixed heights). */
  enableConcentration?: boolean;
  /** Auto-fit the y-axis to the data when zooming x only (an x-drag / typed x-range). Default true. */
  fitYOnZoom?: boolean;
  /** Drag a rectangle to zoom (x and/or y), wheel to zoom, double-click to reset. Default true. */
  interactiveZoom?: boolean;
  /** Called after the visible domain changes via zoom/reset. */
  onZoom?: (xDomain: [number, number], yDomain: [number, number], isFull: boolean) => void;
  /** Called when the set of selected (highlighted) lasers changes. */
  onLaserSelect?: (laserIds: string[]) => void;
  /** Called continuously while drag-selecting a zoom rectangle (null when the drag ends). */
  onBrush?: (box: { xFrom: number; xTo: number; yFrom: number; yTo: number } | null) => void;
}

interface State {
  visibleIds: string[];
  xDomain: [number, number];
  yDomain: [number, number];
  lasers: string[] | 'all' | 'none';
  query: number | null;
  compare: { a: number; b: number; curveId: string } | null;
  /** selected/highlighted lasers (multi-select). */
  activeLaserIds: string[];
  /** live drag-to-zoom rectangle. */
  brush: { fromNm: number; toNm: number; fromMua: number; toMua: number } | null;
  /** curveId -> concentration multiplier (1 = default). Reserved, applied only when enabled. */
  concentration: Record<string, number>;
}

export class AbsorptionSpectrum {
  private container: HTMLElement;
  private dataset: Dataset;
  private options: SpectrumOptions;
  private state: State;
  private fullXDomain: [number, number];
  private defaultYDomain: [number, number];
  private pendingNm: number | null = null;
  private pendingMua: number | null = null;
  private rafId: number | null = null;
  private dragStartNm: number | null = null;
  private dragStartMua = 0;
  private dragStartClientX = 0;
  private dragStartClientY = 0;

  constructor(container: HTMLElement | string, dataset: Dataset, options: SpectrumOptions = {}) {
    const el = typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;
    if (!el) throw new Error(`AbsorptionSpectrum: container not found: ${String(container)}`);
    this.container = el;
    this.dataset = dataset;
    this.options = options;
    this.fullXDomain = options.xDomainNm ?? [100, 12000];
    this.defaultYDomain = options.yDomain ?? [1e-4, 1e5];
    this.state = {
      visibleIds:
        options.visibleCurveIds ??
        dataset.curves.filter((c) => c.enabledByDefault !== false).map((c) => c.id),
      xDomain: this.fullXDomain,
      yDomain: this.defaultYDomain,
      lasers: options.lasers ?? 'all',
      query: options.query ?? null,
      compare: options.compare ?? null,
      activeLaserIds: options.activeLaserIds ?? [],
      brush: null,
      concentration: Object.fromEntries(dataset.curves.map((c) => [c.id, 1])),
    };
    this.render();
    this.bindInteractions();
  }

  // --- effective dataset with concentration scaling applied (reserved ⑥) ---
  private effectiveDataset(): Dataset {
    if (!this.options.enableConcentration) return this.dataset;
    const curves = this.dataset.curves.map((c) => {
      const k = this.state.concentration[c.id] ?? 1;
      if (k === 1) return c;
      return { ...c, points: c.points.map(([nm, mua]) => [nm, mua * k] as [number, number]) };
    });
    return { ...this.dataset, curves };
  }

  private renderOpts(): RenderOptions {
    return {
      ...this.options,
      xDomainNm: this.state.xDomain,
      yDomain: this.state.yDomain,
      visibleCurveIds: this.state.visibleIds,
      lasers: this.state.lasers,
      query: this.state.query,
      compare: this.state.compare,
      activeLaserIds: this.state.activeLaserIds,
      brush: this.state.brush,
    };
  }

  render(): void {
    this.container.innerHTML = renderToSVGString(this.effectiveDataset(), this.renderOpts());
  }

  // Pointer interaction is bound once on the persistent container (the inner <svg> is replaced on
  // every render, so binding on it would leak listeners). RAF coalescing keeps the latest position.
  private bindInteractions(): void {
    const el = this.container;
    const geomNow = () => computeGeometry(this.renderOpts());
    const toNm = (clientX: number): number | null => {
      const svg = el.querySelector('svg');
      if (!svg) return null;
      const g = geomNow();
      const rect = svg.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * g.width;
      if (px < g.x0 || px > g.x1) return null;
      return g.xs.invert(px);
    };
    const toMua = (clientY: number): number => {
      const svg = el.querySelector('svg')!;
      const g = geomNow();
      const rect = svg.getBoundingClientRect();
      let py = ((clientY - rect.top) / rect.height) * g.height;
      py = Math.max(g.y0, Math.min(g.y1, py)); // clamp into the plot
      return g.ys.invert(py);
    };

    const hoverEnabled = this.options.interactiveQuery !== false;
    const zoomEnabled = this.options.interactiveZoom !== false;

    el.addEventListener('pointerdown', (e) => {
      if (!zoomEnabled) return;
      const me = e as PointerEvent;
      const nm = toNm(me.clientX);
      if (nm == null) return;
      this.dragStartNm = nm;
      this.dragStartMua = toMua(me.clientY);
      this.dragStartClientX = me.clientX;
      this.dragStartClientY = me.clientY;
      e.preventDefault();
    });

    el.addEventListener('pointermove', (e) => {
      const me = e as PointerEvent;
      const nm = toNm(me.clientX);
      if (nm == null) return;
      this.pendingNm = nm;
      this.pendingMua = toMua(me.clientY);
      if (this.rafId != null) return;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingNm == null) return;
        if (this.dragStartNm != null) {
          // drawing the drag-to-zoom rectangle
          this.state.query = null;
          const box = {
            fromNm: Math.min(this.dragStartNm, this.pendingNm),
            toNm: Math.max(this.dragStartNm, this.pendingNm),
            fromMua: Math.min(this.dragStartMua, this.pendingMua!),
            toMua: Math.max(this.dragStartMua, this.pendingMua!),
          };
          this.state.brush = box;
          this.render();
          this.options.onBrush?.({ xFrom: box.fromNm, xTo: box.toNm, yFrom: box.fromMua, yTo: box.toMua });
        } else if (hoverEnabled) {
          this.setQuery(this.pendingNm);
        }
      });
    });

    el.addEventListener('pointerleave', () => {
      if (this.rafId != null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.pendingNm = null;
      if (this.dragStartNm == null && hoverEnabled) this.setQuery(null);
    });

    // pointerup on window so a drag ending outside the chart still completes (mouse + touch)
    window.addEventListener('pointerup', (e) => {
      if (this.dragStartNm == null) return;
      const me = e as PointerEvent;
      const startNm = this.dragStartNm;
      const startMua = this.dragStartMua;
      const endNm = toNm(me.clientX) ?? startNm;
      const endMua = toMua(me.clientY);
      const dxPx = Math.abs(me.clientX - this.dragStartClientX);
      const dyPx = Math.abs(me.clientY - this.dragStartClientY);
      this.dragStartNm = null;
      this.state.brush = null;
      this.options.onBrush?.(null);

      if (dxPx < 6 && dyPx < 6) {
        this.handleClick(startNm); // a click, not a drag
      } else if (dyPx < 12) {
        this.zoomTo(startNm, endNm); // mostly horizontal → x zoom, auto-fit y
      } else if (dxPx < 12) {
        this.setYDomain(startMua, endMua); // mostly vertical → y zoom, keep x
      } else {
        this.zoomToBox(startNm, endNm, startMua, endMua); // a real rectangle → zoom both
      }
    });

    if (zoomEnabled) {
      el.addEventListener('dblclick', () => this.resetZoom());
      el.addEventListener(
        'wheel',
        (e) => {
          const we = e as WheelEvent;
          const nm = toNm(we.clientX);
          if (nm == null) return;
          we.preventDefault();
          const [lo, hi] = this.state.xDomain;
          const f = we.deltaY < 0 ? 0.8 : 1.25; // in : out
          const lc = Math.log10(nm);
          let nlo = Math.pow(10, lc + (Math.log10(lo) - lc) * f);
          let nhi = Math.pow(10, lc + (Math.log10(hi) - lc) * f);
          nlo = Math.max(nlo, this.fullXDomain[0]);
          nhi = Math.min(nhi, this.fullXDomain[1]);
          if (nlo <= this.fullXDomain[0] && nhi >= this.fullXDomain[1]) this.resetZoom();
          else if (nhi / nlo > 1.02) this.zoomTo(nlo, nhi);
        },
        { passive: false },
      );
    }
  }

  // Clicking near a laser marker toggles its selection (multi-select).
  private handleClick(nm: number): void {
    const geom = computeGeometry(this.renderOpts());
    const clickPx = geom.xs(nm);
    let nearest: string | null = null;
    let best = 8; // px tolerance
    for (const l of this.dataset.lasers) {
      if (l.wavelengthNm < geom.xDomain[0] || l.wavelengthNm > geom.xDomain[1]) continue;
      const d = Math.abs(geom.xs(l.wavelengthNm) - clickPx);
      if (d < best) {
        best = d;
        nearest = l.id;
      }
    }
    if (nearest) this.toggleLaser(nearest);
    else this.render();
  }

  private setQuery(nm: number | null): void {
    this.state.query = nm;
    this.render();
    if (nm != null && this.options.onQuery) this.options.onQuery(nm, this.queryAt(nm));
  }

  // ---------------------------------------------------------------- public API

  /** input ①: μa of each visible curve at a wavelength (null where no data). */
  queryAt(wavelengthNm: number): Record<string, number | null> {
    return queryDataset(this.effectiveDataset(), wavelengthNm, this.state.visibleIds);
  }

  /** input ②: semantic zoom on x only — re-tick/redraw, auto-fitting y to the data in range. */
  zoomTo(fromNm: number, toNm: number): void {
    const lo = Math.min(fromNm, toNm);
    const hi = Math.max(fromNm, toNm);
    if (!(hi > lo)) throw new Error('zoomTo: need two distinct wavelengths');
    this.state.xDomain = [lo, hi];
    if (this.options.fitYOnZoom !== false) {
      const ids = this.state.compare
        ? [...new Set([...this.state.visibleIds, this.state.compare.curveId])]
        : this.state.visibleIds;
      const ext = dataYExtent(this.effectiveDataset(), lo, hi, ids);
      this.state.yDomain = ext ? niceDecadeRange(ext[0], ext[1]) : this.defaultYDomain;
    }
    this.afterZoom(false);
  }

  /** Zoom to an explicit x and y rectangle (drag-a-box). y is taken as-is, not auto-fitted. */
  zoomToBox(fromNm: number, toNm: number, fromMua: number, toMua: number): void {
    const xlo = Math.min(fromNm, toNm);
    const xhi = Math.max(fromNm, toNm);
    const ylo = Math.max(Math.min(fromMua, toMua), Number.MIN_VALUE);
    const yhi = Math.max(fromMua, toMua);
    if (!(xhi > xlo) || !(yhi > ylo)) return;
    this.state.xDomain = [xlo, xhi];
    this.state.yDomain = [ylo, yhi];
    this.afterZoom(false);
  }

  /** Set the y-axis (μa) range explicitly, keeping the current x window. */
  setYDomain(fromMua: number, toMua: number): void {
    const ylo = Math.max(Math.min(fromMua, toMua), Number.MIN_VALUE);
    const yhi = Math.max(fromMua, toMua);
    if (!(yhi > ylo)) return;
    this.state.yDomain = [ylo, yhi];
    this.afterZoom(false);
  }

  resetZoom(): void {
    this.state.xDomain = this.fullXDomain;
    this.state.yDomain = this.defaultYDomain;
    this.afterZoom(true);
  }

  private afterZoom(isFull: boolean): void {
    this.render();
    this.options.onZoom?.(this.state.xDomain, this.state.yDomain, isFull);
  }

  /** input ③: set exactly which curves are shown. */
  setVisibleCurves(ids: string[]): void {
    this.state.visibleIds = ids.filter((id) => this.dataset.curves.some((c) => c.id === id));
    this.render();
  }

  toggleCurve(id: string, visible: boolean): void {
    const set = new Set(this.state.visibleIds);
    if (visible) set.add(id);
    else set.delete(id);
    this.setVisibleCurves([...set]);
  }

  /** input ④: which laser markers to show. */
  showLasers(ids: string[] | 'all' | 'none'): void {
    this.state.lasers = ids;
    this.state.activeLaserIds = this.state.activeLaserIds.filter((id) => this.laserVisible(id));
    this.render();
    this.options.onLaserSelect?.(this.state.activeLaserIds);
  }

  private laserVisible(id: string): boolean {
    const l = this.state.lasers;
    return l === 'all' ? true : l === 'none' ? false : l.includes(id);
  }

  /** input ④ (multi-select): toggle a laser's highlight. Selecting one is a lookup at its wavelength. */
  toggleLaser(id: string): void {
    const laser = this.dataset.lasers.find((l) => l.id === id);
    if (!laser) throw new Error(`unknown laser "${id}"`);
    const set = new Set(this.state.activeLaserIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
      if (!this.laserVisible(id) && this.state.lasers !== 'all') {
        this.state.lasers = this.state.lasers === 'none' ? [id] : [...this.state.lasers, id];
      }
    }
    this.state.activeLaserIds = [...set];
    this.render();
    this.options.onLaserSelect?.(this.state.activeLaserIds);
  }

  /** Replace the whole selection (e.g. [] to clear). */
  selectLasers(ids: string[]): void {
    this.state.activeLaserIds = ids.filter((id) => this.dataset.lasers.some((l) => l.id === id));
    this.render();
    this.options.onLaserSelect?.(this.state.activeLaserIds);
  }

  /** input ⑤: compute (and visually annotate) the μa fold-difference between two wavelengths. */
  compareWavelengths(a: number, b: number, curveId: string): Comparison {
    // validate first (throws on unknown id) so we never set state pointing at a missing curve
    const result = compareWavelengths(this.effectiveDataset(), a, b, curveId);
    this.state.compare = { a, b, curveId };
    this.render();
    return result;
  }

  clearComparison(): void {
    this.state.compare = null;
    this.render();
  }

  /** input ⑥ (reserved): scale a curve's height by concentration. No-op unless enableConcentration. */
  setConcentration(curveId: string, multiplier: number): void {
    if (!this.options.enableConcentration) {
      console.warn(
        'AbsorptionSpectrum: concentration scaling is reserved and disabled in v1. ' +
          'Construct with { enableConcentration: true } to enable.',
      );
      return;
    }
    if (!(multiplier > 0)) throw new Error('setConcentration: multiplier must be > 0');
    this.state.concentration[curveId] = multiplier;
    this.render();
  }

  /**
   * Input (add or replace) a single curve at runtime — the curves are the data INPUT layer.
   * Supplying a curve whose id was declared in `unavailableCurves` auto-promotes it to a plotted curve.
   */
  upsertCurve(curve: Curve): void {
    const curves = [...this.dataset.curves];
    const i = curves.findIndex((c) => c.id === curve.id);
    if (i >= 0) curves[i] = curve;
    else curves.push(curve);
    const unavailableCurves = (this.dataset.unavailableCurves ?? []).filter((u) => u.id !== curve.id);
    this.dataset = { ...this.dataset, curves, unavailableCurves };
    if (!(curve.id in this.state.concentration)) this.state.concentration[curve.id] = 1;
    if (curve.enabledByDefault !== false && !this.state.visibleIds.includes(curve.id)) {
      this.state.visibleIds = [...this.state.visibleIds, curve.id];
    }
    this.render();
  }

  /** Remove a curve by id. */
  removeCurve(id: string): void {
    this.dataset = { ...this.dataset, curves: this.dataset.curves.filter((c) => c.id !== id) };
    this.state.visibleIds = this.state.visibleIds.filter((x) => x !== id);
    if (this.state.compare?.curveId === id) this.state.compare = null;
    this.render();
  }

  /** Input (add or replace) a laser marker at runtime — lasers are an input layer too. */
  upsertLaser(laser: Laser): void {
    const lasers = [...this.dataset.lasers];
    const i = lasers.findIndex((l) => l.id === laser.id);
    if (i >= 0) lasers[i] = laser;
    else lasers.push(laser);
    lasers.sort((a, b) => a.wavelengthNm - b.wavelengthNm);
    this.dataset = { ...this.dataset, lasers };
    this.render();
  }

  /** Remove a laser by id. */
  removeLaser(id: string): void {
    this.dataset = { ...this.dataset, lasers: this.dataset.lasers.filter((l) => l.id !== id) };
    this.state.activeLaserIds = this.state.activeLaserIds.filter((x) => x !== id);
    this.render();
  }

  /** Swap the entire dataset (engine/data separation). */
  setDataset(dataset: Dataset): void {
    this.dataset = dataset;
    this.fullXDomain = this.options.xDomainNm ?? [100, 12000];
    this.state.visibleIds = dataset.curves
      .filter((c) => c.enabledByDefault !== false)
      .map((c) => c.id);
    this.state.xDomain = this.fullXDomain;
    this.state.yDomain = this.defaultYDomain;
    this.state.lasers = this.options.lasers ?? 'all';
    this.state.query = null;
    this.state.compare = null;
    this.state.activeLaserIds = [];
    this.state.concentration = Object.fromEntries(dataset.curves.map((c) => [c.id, 1]));
    this.render();
  }

  /** The engine's current dataset (snapshot; reflects upsert/remove/setDataset). */
  getDataset(): Readonly<Dataset> {
    return { ...this.dataset, curves: [...this.dataset.curves], lasers: [...this.dataset.lasers] };
  }

  /** A snapshot of the current state (a copy — mutating it does not affect the engine). */
  getState(): Readonly<State> {
    return {
      ...this.state,
      visibleIds: [...this.state.visibleIds],
      xDomain: [...this.state.xDomain] as [number, number],
      yDomain: [...this.state.yDomain] as [number, number],
      lasers: Array.isArray(this.state.lasers) ? [...this.state.lasers] : this.state.lasers,
      compare: this.state.compare ? { ...this.state.compare } : null,
      activeLaserIds: [...this.state.activeLaserIds],
      brush: this.state.brush ? { ...this.state.brush } : null,
      concentration: { ...this.state.concentration },
    };
  }
}
