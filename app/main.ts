// photolyze web app: drives the AbsorptionSpectrum engine.
// Sidebar = the data layers (Curves, Lasers); chart area = the view (live x/y range + zoom) and
// analysis (hover readout, two-wavelength compare).
import { AbsorptionSpectrum, fmtMua } from '../src/index';
import type { Dataset } from '../src/index';
import datasetJson from '../data/laser-tissue.json';

const dataset = datasetJson as unknown as Dataset;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const curveById = (id: string) => chart.getDataset().curves.find((c) => c.id === id);

// ---- view: editable x (nm) and y (μa) range inputs that double as the live range readout ----
const readout = $('readout');
const rangeFrom = $<HTMLInputElement>('rangeFrom');
const rangeTo = $<HTMLInputElement>('rangeTo');
const rangeYFrom = $<HTMLInputElement>('rangeYFrom');
const rangeYTo = $<HTMLInputElement>('rangeYTo');
const fmtY = (v: number) => (v >= 1000 || (v > 0 && v < 0.01) ? (+v.toPrecision(3)).toExponential() : String(+v.toPrecision(4)));
function setRange(x: [number, number], y: [number, number]) {
  rangeFrom.value = String(Math.round(x[0]));
  rangeTo.value = String(Math.round(x[1]));
  rangeYFrom.value = fmtY(y[0]);
  rangeYTo.value = fmtY(y[1]);
}
function applyX() {
  const a = Number(rangeFrom.value);
  const b = Number(rangeTo.value);
  if (a > 0 && b > 0 && a !== b) chart.zoomTo(a, b);
}
function applyY() {
  const a = Number(rangeYFrom.value);
  const b = Number(rangeYTo.value);
  if (a > 0 && b > 0 && a !== b) chart.setYDomain(a, b);
}

let activeLasers: string[] = [];

const chart = new AbsorptionSpectrum('#chart', dataset, {
  interactiveQuery: true,
  interactiveZoom: true,
  title: '',
  showLegend: false,
  margin: { top: 90, right: 26 },
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  visibleBand: { fromNm: 380, toNm: 700 },
  onQuery: setReadout,
  onZoom(x, y) {
    setRange(x, y);
  },
  onBrush(box) {
    const s = chart.getState();
    setRange(box ? [box.xFrom, box.xTo] : s.xDomain, box ? [box.yFrom, box.yTo] : s.yDomain); // live while dragging
  },
  onLaserSelect(ids) {
    activeLasers = ids;
    laserChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', ids.includes((c as HTMLElement).dataset.id!)));
    renderLaserReadout();
  },
});
setRange(chart.getState().xDomain, chart.getState().yDomain);

function setReadout(nm: number, values: Record<string, number | null>) {
  const parts = Object.entries(values)
    .filter(([, v]) => v != null)
    .map(([id, v]) => `<span style="color:${curveById(id)?.color ?? '#1a1714'}">${curveById(id)?.label ?? id} ${fmtMua(v)}</span>`);
  readout.innerHTML = `<b>${Math.round(nm)} nm</b>&ensp;` + (parts.length ? parts.join('&ensp;&ensp;') : '<span class="empty">no data here</span>');
}
function renderLaserReadout() {
  if (!activeLasers.length) {
    resetReadout();
    return;
  }
  const lasers = chart.getDataset().lasers;
  readout.innerHTML = activeLasers
    .map((id) => {
      const l = lasers.find((x) => x.id === id);
      if (!l) return '';
      const parts = Object.entries(chart.queryAt(l.wavelengthNm))
        .filter(([, v]) => v != null)
        .map(([cid, v]) => `<span style="color:${curveById(cid)?.color}">${curveById(cid)?.label} ${fmtMua(v)}</span>`);
      return `<b>${l.label} ${l.wavelengthNm} nm</b>&ensp;` + (parts.length ? parts.join('&ensp;') : '<span class="empty">no data</span>');
    })
    .join('<br>');
}
function resetReadout() {
  if (activeLasers.length) {
    renderLaserReadout();
    return;
  }
  readout.innerHTML = '<span class="empty">Hover to read μa · drag a box to zoom · click lasers to compare</span>';
}
$('chart').addEventListener('pointerleave', () => {
  if (!activeLasers.length) resetReadout();
});

// range inputs: type to set, or read the live range while dragging/scrolling
for (const inp of [rangeFrom, rangeTo]) {
  inp.addEventListener('change', applyX);
  inp.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') applyX();
  });
}
for (const inp of [rangeYFrom, rangeYTo]) {
  inp.addEventListener('change', applyY);
  inp.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') applyY();
  });
}
$('rangeFull').addEventListener('click', () => chart.resetZoom());

// ---- Curves (toggle which are shown) ----
const curveList = $('curveList');
for (const c of chart.getDataset().curves) {
  const visible = new Set(chart.getState().visibleIds);
  const row = document.createElement('label');
  row.className = 'row';
  const dash = c.modelFormula
    ? `background:repeating-linear-gradient(90deg,${c.color} 0 5px,transparent 5px 8px);`
    : `background:${c.color};`;
  row.innerHTML =
    `<input type="checkbox" ${visible.has(c.id) ? 'checked' : ''} />` +
    `<span class="swatch" style="${dash}"></span><span>${c.label}</span>`;
  row.querySelector('input')!.addEventListener('change', (e) => chart.toggleCurve(c.id, (e.target as HTMLInputElement).checked));
  curveList.appendChild(row);
}

// ---- Lasers (All/None + multi-select chips) ----
const laserChips = $('laserChips');
const active0 = new Set(chart.getState().activeLaserIds);
laserChips.innerHTML = chart
  .getDataset()
  .lasers.map((l) => `<button class="chip${active0.has(l.id) ? ' on' : ''}" data-id="${l.id}" title="${l.label} · ${l.wavelengthNm} nm">${l.label}</button>`)
  .join('');
laserChips.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip) =>
  chip.addEventListener('click', () => chart.toggleLaser(chip.dataset.id!)),
);
const laserAll = $<HTMLButtonElement>('laserAll');
const laserNone = $<HTMLButtonElement>('laserNone');
laserAll.addEventListener('click', () => {
  chart.showLasers('all');
  chart.selectLasers([]);
  laserAll.classList.add('active');
  laserNone.classList.remove('active');
});
laserNone.addEventListener('click', () => {
  chart.showLasers('none');
  chart.selectLasers([]);
  laserNone.classList.add('active');
  laserAll.classList.remove('active');
});

// ---- Compare two wavelengths ----
const cmpCurve = $<HTMLSelectElement>('cmpCurve');
cmpCurve.innerHTML = chart.getDataset().curves.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
cmpCurve.value = chart.getDataset().curves.some((c) => c.id === 'water') ? 'water' : chart.getDataset().curves[0]?.id ?? '';
$('cmpRun').addEventListener('click', () => {
  const a = Number($<HTMLInputElement>('cmpA').value);
  const b = Number($<HTMLInputElement>('cmpB').value);
  const id = cmpCurve.value;
  const r = chart.compareWavelengths(a, b, id);
  const label = curveById(id)?.label ?? id;
  $('cmpResult').textContent =
    r.ratio == null
      ? `No data for ${label} at one of those wavelengths`
      : `${label}: ${fmtMua(r.muaA)} / ${fmtMua(r.muaB)} = ${r.foldDifference!.toFixed(2)}× at ${r.higherAt} nm`;
});
$('cmpClear').addEventListener('click', () => {
  chart.clearComparison();
  $('cmpResult').textContent = '';
});

(window as unknown as { __chart: AbsorptionSpectrum }).__chart = chart;
