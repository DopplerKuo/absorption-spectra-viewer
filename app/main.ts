// photolyze web app: drives the AbsorptionSpectrum engine.
// Model: the sidebar is the DATA (two input layers — Curves and Lasers, each toggleable/addable/removable);
// the chart area is the VIEW (live wavelength range + zoom) and analysis (hover readout, compare).
import { AbsorptionSpectrum, fmtMua, parsePoints } from '../src/index';
import type { Dataset } from '../src/index';
import datasetJson from '../data/laser-tissue.json';

const dataset = datasetJson as unknown as Dataset;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const curveById = (id: string) => chart.getDataset().curves.find((c) => c.id === id);

const userCurves = new Set<string>();
const userLasers = new Set<string>();
let pendingFillId: string | null = null;

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

// ================= DATA LAYER 1: Curves =================
const curveList = $('curveList');
function buildCurveList() {
  curveList.innerHTML = '';
  const visible = new Set(chart.getState().visibleIds);
  for (const c of chart.getDataset().curves) {
    const row = document.createElement('label');
    row.className = 'row';
    const dash = c.modelFormula
      ? `background:repeating-linear-gradient(90deg,${c.color} 0 5px,transparent 5px 8px);`
      : `background:${c.color};`;
    row.innerHTML =
      `<input type="checkbox" ${visible.has(c.id) ? 'checked' : ''} />` +
      `<span class="swatch" style="${dash}"></span><span>${c.label}</span>`;
    row.querySelector('input')!.addEventListener('change', (e) => chart.toggleCurve(c.id, (e.target as HTMLInputElement).checked));
    if (userCurves.has(c.id)) row.appendChild(removeBtn(() => removeCurve(c.id)));
    curveList.appendChild(row);
  }
  // gap rows: components with no data yet — fillable in place
  for (const u of chart.getDataset().unavailableCurves ?? []) {
    const row = document.createElement('div');
    row.className = 'row gap';
    row.innerHTML = `<span style="width:14px;flex:none"></span><span class="swatch"></span><span>${u.label}</span>`;
    const add = document.createElement('button');
    add.className = 'addhere';
    add.textContent = '+ data';
    add.addEventListener('click', () => openCurveForm(u.id, u.label));
    row.appendChild(add);
    curveList.appendChild(row);
  }
}
function removeBtn(onClick: () => void) {
  const x = document.createElement('button');
  x.className = 'rowx';
  x.textContent = '×';
  x.title = 'Remove';
  x.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return x;
}
function removeCurve(id: string) {
  chart.removeCurve(id);
  userCurves.delete(id);
  buildCurveList();
  buildCmpOptions();
}
buildCurveList();

// curve add form (inside the Curves section)
const addForm = $('addForm');
$('addToggle').addEventListener('click', () => {
  if (addForm.hasAttribute('hidden')) openCurveForm();
  else addForm.setAttribute('hidden', '');
});
function openCurveForm(id?: string, label?: string) {
  addForm.removeAttribute('hidden');
  pendingFillId = id ?? null;
  $<HTMLInputElement>('impLabel').value = label ?? '';
  const ta = $<HTMLTextAreaElement>('impData');
  ta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  (label ? ta : $<HTMLInputElement>('impLabel')).focus();
}
$('addCancel').addEventListener('click', () => {
  addForm.setAttribute('hidden', '');
  $('impMsg').textContent = '';
});
$('impFile').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  $<HTMLTextAreaElement>('impData').value = await f.text();
  $('impFileName').textContent = f.name;
});
$('impAdd').addEventListener('click', () => {
  const msg = $('impMsg');
  msg.className = 'msg';
  msg.textContent = '';
  const label = $<HTMLInputElement>('impLabel').value.trim();
  const source = $<HTMLInputElement>('impSource').value.trim();
  try {
    if (!label) throw new Error('Enter a curve name.');
    if (!source) throw new Error('Enter a source / citation.');
    const points = parsePoints($<HTMLTextAreaElement>('impData').value);
    const id = pendingFillId ?? slug(label);
    chart.upsertCurve({ id, label, color: $<HTMLInputElement>('impColor').value, points, source: { ref: source } });
    userCurves.add(id);
    pendingFillId = null;
    buildCurveList();
    buildCmpOptions();
    addForm.setAttribute('hidden', '');
    ['impLabel', 'impSource', 'impData'].forEach((i) => (($(i) as HTMLInputElement | HTMLTextAreaElement).value = ''));
    $('impFileName').textContent = '';
  } catch (err) {
    msg.className = 'msg err';
    msg.textContent = (err as Error).message;
  }
});

// ================= DATA LAYER 2: Lasers =================
const laserChips = $('laserChips');
function buildLaserChips() {
  const active = new Set(chart.getState().activeLaserIds);
  laserChips.innerHTML = '';
  for (const l of chart.getDataset().lasers) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (active.has(l.id) ? ' on' : '');
    chip.dataset.id = l.id;
    chip.title = `${l.label} · ${l.wavelengthNm} nm`;
    chip.append(l.label);
    if (userLasers.has(l.id)) {
      const x = document.createElement('span');
      x.className = 'x';
      x.textContent = '×';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        chart.removeLaser(l.id);
        userLasers.delete(l.id);
        buildLaserChips();
      });
      chip.appendChild(x);
    }
    chip.addEventListener('click', () => chart.toggleLaser(l.id));
    laserChips.appendChild(chip);
  }
}
buildLaserChips();

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

const laserAddForm = $('laserAddForm');
$('laserAddToggle').addEventListener('click', () => {
  laserAddForm.toggleAttribute('hidden');
  if (!laserAddForm.hasAttribute('hidden')) $<HTMLInputElement>('lzLabel').focus();
});
$('lzCancel').addEventListener('click', () => {
  laserAddForm.setAttribute('hidden', '');
  $('lzMsg').textContent = '';
});
$('lzAdd').addEventListener('click', () => {
  const msg = $('lzMsg');
  msg.className = 'msg';
  const label = $<HTMLInputElement>('lzLabel').value.trim();
  const nm = Number($<HTMLInputElement>('lzNm').value);
  if (!label) {
    msg.className = 'msg err';
    msg.textContent = 'Enter a name.';
    return;
  }
  if (!(nm > 0)) {
    msg.className = 'msg err';
    msg.textContent = 'Enter a positive wavelength.';
    return;
  }
  const id = `${slug(label)}-${Math.round(nm)}`;
  chart.upsertLaser({ id, label, wavelengthNm: nm });
  userLasers.add(id);
  buildLaserChips();
  laserAddForm.setAttribute('hidden', '');
  $<HTMLInputElement>('lzLabel').value = '';
  $<HTMLInputElement>('lzNm').value = '';
});

// ================= Analysis: Compare =================
const cmpCurve = $<HTMLSelectElement>('cmpCurve');
function buildCmpOptions() {
  const prev = cmpCurve.value;
  const curves = chart.getDataset().curves;
  cmpCurve.innerHTML = curves.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
  cmpCurve.value = curves.some((c) => c.id === prev) ? prev : curves.some((c) => c.id === 'water') ? 'water' : curves[0]?.id ?? '';
}
buildCmpOptions();
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
