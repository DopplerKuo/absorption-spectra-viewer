# 交接任務：雷射–組織吸收光譜 互動視覺化元件

你是一個能自主規劃、自主實作、自我驗證的工程 agent。這份文件給你完成這個專案所需的全部高信心背景。**先輸出實作計畫，再開始執行；過程中自我驗證、迭代到「完成標準」全綠為止，不需要中途等我逐項確認。**

## 0. 一句話目標

把一張「雷射波長 × 生物組織吸收係數」的科學圖，轉成一個**資料驅動、可程式控制的互動 SVG 視覺化元件**——引擎與資料分離，資料可抽換。

## 1. 背景知識（已確認，不需重新研究，但數據仍須用原始文獻驗證）

**領域**：laser–tissue interaction / biophotonics（光與生物組織交互作用）。臨床上用來決定「哪個波長的雷射會被哪種組織優先吸收」。核心理論：選擇性光熱分解（Selective Photothermolysis, Anderson & Parrish 1983）——選對波長就能選擇性作用於特定目標。

**這批素材橫跨兩個子領域，不要窄化成單一科別**：
- 牙科 / 硬組織：含 Hydroxyapatite(HA)、Er,Cr:YSGG 等
- 醫美 / 皮膚：含 Oxy/Deoxy-Hemoglobin、PDL/Ruby/Alexandrite 等
- 共同母領域是 laser–tissue interaction。設計必須通用到同時容納兩者。

**資料模型本質（整個專案的地基）**：
- **曲線 = 固定的基準資料集（reference dataset）**，不是使用者輸入。每條曲線是某成分的吸收光譜 = 一長串 (波長, 吸收係數) 數對，是分子的物理性質。
  - 形狀固定：由莫耳消光係數 ε(λ) 決定。
  - 高度可被濃度縮放：實際吸收 = ε(λ) × 濃度。
- **雷射波長 = 離散的標記層（markers）**，與連續曲線是不同圖層。波長是物理本體，機型名稱（KTP、Nd:YAG…）只是 metadata。
- **原圖 Y 軸是「相對」且為對數刻度**，各曲線為視覺比較被各自縮放/位移過，不在同一絕對單位。要精準就須改用絕對吸收係數 μa（cm⁻¹）。

## 2. 素材（5 張圖，先下載）

先把參考圖下載到你的工作目錄（Google Drive 公開直連）：

```bash
curl -L "https://drive.google.com/uc?export=download&id=1o2KWPFmW6Of5CdrV-H21fD4QuQeTbj6U" -o Therapy_Wavelength_main.jpg
curl -L "https://drive.google.com/uc?export=download&id=1e0ux5W1O_HdDNHkfx0yeKRRI6iHTYTTh" -o Absorption-spectral_collagen.png
curl -L "https://drive.google.com/uc?export=download&id=1yhZEEcJTnGWCDykrUsRkRthOc1_PhANP" -o absorption_chart_dynamic.png
curl -L "https://drive.google.com/uc?export=download&id=1G4nr155V2zhRZ5fqOvzL1ydnvYblH1j7" -o ref1.jpg
curl -L "https://drive.google.com/uc?export=download&id=1axTy3jA7rnb_yIN0ewATo0nzXWSNIpHo" -o ref2.png
```

| 檔名 | 角色 | 含哪些曲線 |
|---|---|---|
| Therapy_Wavelength_main.jpg | **主圖**，最完整、學術風，版面/配色以它為準 | Hb, Melanin, HA, H₂O |
| Absorption-spectral_collagen.png | 補 collagen 曲線（主圖沒有） | + Collagen, Protein |
| absorption_chart_dynamic.png | **未來想要的動態效果範例**：局部放大 + 兩波長吸收差對比（Er,Cr:YSGG vs Er:YAG 在水差約 300%） | 同主圖 |
| ref1.jpg | 同類參考（醫美風） | Oxy/Deoxy-Hb, Melanin, Water |
| ref2.png | 同類參考（附穿透深度右軸） | H₂O, CHA/HA, Collagen |

圖只作為**形狀／趨勢／版面**參考；**數據以原始文獻為準**（見第 5 節）。

## 3. 產出定義（What）

一個元件（建議命名如 `<AbsorptionSpectrum>`），吃一份結構化光譜資料，輸出可互動 SVG。

**Input 分層（嚴格按此範圍）**：

| 層 | Input | 做不做 |
|---|---|---|
| 視覺化核心 | ① 查值：給波長 → 回該波長下每條曲線的吸收係數<br>② 語意縮放：給波長區間 → 放大該段並重新刻度座標軸<br>③ 選曲線：勾選顯示哪些成分<br>④ 雷射定位：選機型 → 自動標出對應波長垂直線<br>⑤ 兩波長比較：給兩個波長 → 算吸收係數的倍數差 | ✅ 必做 |
| 半步動態 | ⑥ 濃度縮放：調整某曲線濃度 → 高度等比縮放 | ⚠️ 預留資料結構與介面，預設不啟用 |
| 模擬器領域 | 散射 μs'、穿透深度、脈衝時間/TRT、治療效果模擬 | ❌ 不做 |

## 4. 範圍邊界（嚴格遵守，不要擴張）

- **做**：吸收光譜的視覺化、查詢、語意縮放、雷射波長定位、兩波長比較。
- **不做**：散射、穿透深度計算、脈衝時間/TRT、任何「這道雷射能打多深／治療效果」的物理模擬。這些超出需求，會把工具從互動圖膨脹成生醫引擎。若判斷未來可能需要，只在資料結構上預留，不實作。

## 5. 資料精準度（最高優先，專案成敗點）

要求**最精準**。規則：
1. **不要從圖上描點**（log 軸描點誤差可達數十 %）。一律回到原始 tabulated 實驗數據。
2. **絕不編造數據點**。找不到就明確標註缺口，不准填假數字佔位。寧缺勿假。
3. 每條曲線的資料來源、單位、原始文獻必須在資料檔裡標註清楚。
4. 數據統一轉成絕對吸收係數 μa（cm⁻¹），或標明單位與轉換方式。

**權威來源**：
- 水：Hale & Querry (1973)、Segelstein (1981) — OMLC `omlc.org/spectra/water/`
- 血紅素（含氧/去氧）：Scott Prahl / Gratzer / Kollias — `omlc.org/spectra/hemoglobin/`
- 黑色素：Steven Jacques — `omlc.org/spectra/melanin/`
- 氫氧基磷灰石(HA)、膠原蛋白：**OMLC 沒有**，須查牙科/生醫光譜專門文獻（高風險項，先盤點可得性，找不到就標缺口）。

**已知衝突，先講明並依此決策**：用真實文獻數據重組後，圖會跟原圖長得不完全一樣（原圖是多篇拼接的簡化示意）。**以數據精準為準，原圖只作版面參考。**

**已確認的雷射波長清單（離散標記層，可直接用）**：
KTP 532、Argon 488–514、Pulsed dye 585/595、Ruby 694、Alexandrite 755、Diode 810–980、Nd:YAG 1064、Nd:YAP 1340、Er,Cr:YSGG 2780、Er:YAG 2940、CO₂ 9300 / 10600（單位 nm）。

## 6. 已定的設計決策

- **引擎／資料分離**：渲染引擎要通用（任意多條曲線的 log-log 科學圖），牙科/醫美光譜只是第一份餵進去的資料。資料用獨立檔（如 JSON），可抽換。
- **縮放 = 語意縮放（semantic zoom）**：不是單純放大 SVG，是進入指定波長區間後重新刻度、重繪該段。
- **濃度維度**：資料結構預留 ε(λ) 與濃度欄位，但 v1 預設以固定高度呈現，不開放調整。
- **技術載體**：由你評估後決定並在計畫中說明理由。建議二選一——(a) 可重用元件（如 React，需 build，較易擴充）；(b) 單檔 HTML+JS（雙擊即開、零依賴、較難擴充）。預設傾向可重用元件，除非有更好理由。

## 7. 完成標準（Definition of Done，自己驗到全綠）

**資料驗收**
- [ ] 每條曲線都有資料點 + 來源標註 + 單位；無捏造數據；缺口已明確標示。
- [ ] 已知雷射波長處抽查，數值符合物理常識與文獻（例：2940nm 水吸收極高；1064nm 落在 700–1200nm 光學窗、各成分吸收都低；532nm Hb/Melanin 吸收高）。

**功能驗收**
- [ ] 查值、語意縮放、選曲線、雷射定位、兩波長比較 五項皆正常運作。
- [ ] log-log 座標軸正確；縮放後刻度正確重繪。
- [ ] 輸出為 SVG，可無損縮放、可由程式生成/控制。

**視覺驗收**
- [ ] 峰/谷位置、optical window、整體趨勢與原圖一致（趨勢一致即可，絕對值以文獻為準）。

**品質驗收**
- [ ] 引擎與資料分離，資料可抽換。
- [ ] 有 README：如何餵資料、如何呼叫各 input、資料來源與已知缺口。

## 8. 工作流程

1. 先輸出**實作計畫**（技術選型 + 資料盤點 + 里程碑）。
2. **先解決資料**：抓取、轉換、交叉驗證、標來源。資料不到位不要進實作。
3. 實作引擎與元件。
4. 對照第 7 節**自我驗證**，未過項目自行迭代修正。
5. 全部 DoD 綠燈才算完成；過程中不需等我逐項確認。
