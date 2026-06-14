# 雷射–組織吸收光譜互動視覺化元件 — 實作計畫

> 對應交接文件 `handoff-prompt.md`。本計畫先定技術選型與資料盤點，再切里程碑，每個里程碑都對應第 7 節 DoD 的可執行驗證。

**目標：** 把「雷射波長 × 組織吸收係數」科學圖，做成資料驅動、可程式控制的互動 SVG 元件；引擎與資料分離、資料可抽換。

**架構：** 框架無關的純 TypeScript 引擎，直接產生 SVG 字串（可 headless 生成），再掛進 DOM 提供互動。資料是獨立 JSON，吃進引擎。數學核心（log scale、log-log 內插、倍數比較）為純函式，走 TDD。

**技術選型：** Vanilla TypeScript + Vite（dev/build）+ Vitest（測試），零執行期相依。

---

## 技術選型理由

| 決策 | 選擇 | 理由 |
|---|---|---|
| 載體 | 可重用元件（非單檔 HTML） | DoD 要「引擎/資料分離、資料可抽換、可程式控制」，元件化最乾淨。 |
| 框架 | 無框架（純 TS class） | 元件本體就是 SVG 渲染引擎；不綁 React 更可攜、SVG 更直接可程式控制。`<AbsorptionSpectrum>` 以 class 形式體現。 |
| SVG 產生 | 字串建構器 + 注入 DOM | 同一套 renderer 可 headless 產生 SVG（DoD：可由程式生成），測試也能在純 Node 下對 SVG 字串斷言，不需 jsdom。 |
| 語言 | TypeScript | 資料契約型別化，避免資料欄位漂移。 |
| 建置/測試 | Vite + Vitest | 零設定 dev server + 單 bundle build；Vitest 跑數學核心 TDD。 |

環境已確認：node v22.21.1 / npm 10.9.4 / python 3.14.2。

---

## 資料盤點（第 5 節，最高優先）

轉換目標：絕對吸收係數 μa（cm⁻¹），波長 nm。圖只作版面/趨勢參考，**數據一律回原始 tabulated 文獻，絕不描點、絕不編造，缺口明標**。

| 曲線 | 來源 | 形式 | 信心 | 處理 |
|---|---|---|---|---|
| H₂O 水 | Hale & Querry 1973 + Segelstein 1981（OMLC） | `.dat`，已是 μa(1/cm) | 高 | 直接取用，Segelstein 補密度 |
| HbO₂ 含氧血紅素 | Prahl/Gratzer/Kollias（OMLC summary.html） | 莫耳消光 ε(cm⁻¹/M) | 高 | μa=2.303·ε·(150/64500) 全血 |
| Hb 去氧血紅素 | 同上 | 同上 | 高 | 同上 |
| Melanin 黑色素 | Jacques（OMLC eumelanin） | 冪律公式 μa=A·λ^(−B) | 高（模型，非 tabulated，明標） | 依官方係數生成，標適用區間 |
| Hydroxyapatite (HA) | 牙科/生醫光譜文獻（OMLC 無） | 須查 | **低，高風險** | 找得到的波段建表＋標來源；找不到的波段標缺口 |
| Collagen 膠原蛋白 | 生醫 IR 文獻（OMLC 無） | 須查 | **低，高風險** | 同上 |
| Protein 蛋白質 | 文獻（OMLC 無） | 須查 | **低，高風險** | 同上；無可靠資料則整條標缺口、預設不顯示 |

**雷射波長標記層（離散，可直接用）：** KTP 532、Argon 488–514、Pulsed dye 585/595、Ruby 694、Alexandrite 755、Diode 810–980、Nd:YAG 1064、Nd:YAP 1340、Er,Cr:YSGG 2780、Er:YAG 2940、CO₂ 9300 / 10600（nm）。

**已知衝突處理：** 真實文獻重組後與原圖不會完全一致 → 以數據為準，原圖只看趨勢/版面。

---

## 檔案結構

```
photolyze/
  reference/                  # 5 張參考圖（已下載）
  scripts/
    fetch_water.mjs           # 抓 + 轉換水
    fetch_hemoglobin.mjs      # 抓 + 轉換 HbO2/Hb
    melanin.mjs               # Jacques 公式生成
    build_dataset.mjs         # 組裝 data/laser-tissue.json
    raw/                      # 下載的原始 .dat
  data/
    laser-tissue.json         # 第一份資料集（curves + lasers + meta）
    SOURCES.md                # 逐曲線來源、單位、缺口
  src/
    types.ts                  # 資料契約 + 內部型別
    scales.ts                 # log/linear scale + nice log ticks
    interpolate.ts            # log-log 內插（查值），gap/domain → null
    render.ts                 # SVG 字串：軸/格線/曲線/雷射標記
    spectrum.ts               # AbsorptionSpectrum class（公開 API）
    index.ts                  # 對外匯出
  demo/
    index.html                # 互動展示頁
    main.ts                   # 控制項接到引擎
  test/
    scales.test.ts
    interpolate.test.ts
    spectrum.test.ts
    dataset.test.ts           # schema 驗證 + 物理 sanity（DoD 資料驗收）
  README.md
  package.json / tsconfig.json / vite.config.ts
```

---

## 資料契約（types.ts）

```ts
type Point = [wavelengthNm: number, value: number];

interface Curve {
  id: string;                 // 'water'
  label: string;              // 'H₂O (Water)'
  color: string;
  points: Point[];            // [nm, μa(cm^-1)]，依波長遞增
  source: { ref: string; url?: string; note?: string };
  gaps?: { fromNm: number; toNm: number; reason: string }[];
  // ⑥ 濃度維度（預留，v1 不啟用）
  epsilon?: Point[];          // 莫耳消光 cm^-1/M（若適用）
  defaultConcentration?: number;
  concentrationUnit?: string; // 'g/L' | 'mol/L'
  enabledByDefault?: boolean;
}

interface Laser {
  id: string; label: string;  // 'Er:YAG'
  wavelengthNm: number;       // 2940（或區間中心）
  rangeNm?: [number, number]; // diode 810-980 / argon 488-514
  note?: string;
}

interface Dataset {
  meta: {
    title: string; description: string;
    wavelengthUnit: 'nm'; absorptionUnit: 'cm^-1';
    references: string[];
  };
  curves: Curve[];
  lasers: Laser[];
}
```

## 引擎公開 API（spectrum.ts）

```ts
class AbsorptionSpectrum {
  constructor(container: HTMLElement | string, dataset: Dataset, options?: Options);
  render(): void;

  queryAt(wavelengthNm: number): Record<string, number | null>;     // ① 查值
  zoomTo(fromNm: number, toNm: number): void;                       // ② 語意縮放（重刻度重繪）
  resetZoom(): void;
  setVisibleCurves(ids: string[]): void;                           // ③ 選曲線
  toggleCurve(id: string, visible: boolean): void;
  showLasers(ids: string[] | 'all'): void;                         // ④ 雷射定位（垂直線）
  compareWavelengths(a: number, b: number, curveId: string):       // ⑤ 兩波長比較
    { a: number; b: number; muaA: number|null; muaB: number|null; ratio: number|null };
  setConcentration(curveId: string, value: number): void;          // ⑥ 預留，預設停用
}

// headless：可由程式直接生成 SVG 字串
function renderToSVGString(dataset: Dataset, opts?: RenderOptions): string;
```

---

## 里程碑（每個結束跑對應測試/驗證到綠）

### M0 — 專案骨架
package.json（type:module、scripts: dev/build/test/typecheck）、tsconfig、vite.config、vitest 設定。驗：`npm run typecheck` 過、`npm test` 能跑（空）。

### M1 — 資料（gate，未到位不進實作）
1. `fetch_water.mjs`：抓 hale73 + segelstein81，輸出 raw。
2. `fetch_hemoglobin.mjs`：抓 summary.html，解析 ε 表，轉 μa（全血 150 g/L），輸出 HbO2/Hb。
3. `melanin.mjs`：依 OMLC Jacques 公式生成（係數抓自原頁），標適用區間。
4. HA / Collagen / Protein：文獻研究（WebSearch/WebFetch + 平行 agent）。找到的波段建表＋標來源；找不到標缺口、寧缺勿假。
5. `build_dataset.mjs`：組 `data/laser-tissue.json`；寫 `data/SOURCES.md`。
6. `dataset.test.ts` 物理 sanity（DoD 資料驗收）：
   - 2940nm 水 μa 極高（>5000）。
   - 1064nm 落光學窗：水 μa 低（<10）、各成分皆低。
   - 532nm：HbO2 μa ≫ 水 μa（同波長比）。
   - 2780 vs 2940 水 μa 比約 1:3–1:4（對應 dynamic 圖 300%）。
   - schema：每條曲線有 points 或明確缺口、有 source、波長遞增、無 NaN。

驗：`npm test test/dataset.test.ts` 全綠。

### M2 — 數學核心（TDD）
`scales.ts`（logScale 正逆映射、niceLogTicks 十進位主刻度+次刻度）、`interpolate.ts`（log-log 線性內插；超出 domain 或落在 gap → null）。先寫失敗測試 → 實作 → 綠。驗：`scales.test.ts` / `interpolate.test.ts` 全綠。

### M3 — SVG 渲染器
`render.ts`：log-log 軸 + 格線、十進位刻度標籤、多曲線 polyline、雷射垂直標記（含區間帶）、語意縮放後重算 domain 並重刻度只繪該段。`renderToSVGString` 可純 Node 產出。驗：對 SVG 字串斷言（含 `<svg`、軸刻度數、曲線 path 數、縮放後刻度改變）。

### M4 — 元件 API
`spectrum.ts` 串起五項 input + 預留 ⑥；狀態變更重繪。驗：`spectrum.test.ts` — queryAt 對已知點正確、zoomTo 改變可視 domain、setVisibleCurves 影響輸出曲線數、showLasers 加標記、compareWavelengths 倍數正確。

### M5 — 互動 Demo
`demo/index.html` + `main.ts`：曲線勾選、滑鼠移動即時查值（垂直游標線 + tooltip）、語意縮放（含「2780 vs 2940 水」預設區間鈕）、雷射機型選單→標線、兩波長比較面板顯示倍數差。驗：`npm run build` 成功、`npm run dev` 起得來、瀏覽器（Playwright）截圖確認五項互動可見可動。

### M6 — README + DoD 總驗
`README.md`：如何餵資料、如何呼叫每個 input、資料來源與已知缺口。逐項對照第 7 節 DoD 打勾，未綠回頭修。

---

## DoD 對應驗證方式

| DoD 項 | 驗證 |
|---|---|
| 每曲線有資料點+來源+單位、無捏造、缺口明標 | `dataset.test.ts` schema + `SOURCES.md` |
| 雷射波長抽查符合物理/文獻 | `dataset.test.ts` 物理 sanity（2940/1064/532/2780vs2940） |
| 五項 input 正常 | `spectrum.test.ts` + Demo Playwright |
| log-log 軸正確、縮放重刻度 | `scales.test.ts` + `render.ts` 斷言 |
| 輸出 SVG、可無損縮放、可程式生成 | `renderToSVGString` + 測試 |
| 峰/谷/optical window 趨勢符原圖 | 物理 sanity + Demo 截圖對照 |
| 引擎/資料分離、可抽換 | 架構：data JSON ↔ engine；換 JSON 即換資料 |
| README 齊全 | M6 |
