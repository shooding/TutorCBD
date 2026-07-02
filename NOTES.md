# 教師甄試學習系統 — 開發筆記

## 目前狀態：完成 ✅

純前端、零外部相依的教師甄試（教育專業科目）學習系統，以**知識圖譜**組織知識點、
以**艾賓浩斯間隔複習**排程複習，測驗題庫**內建教檢歷屆考古題**（透過 Twinkle Hub MCP
`search_teacher_exam_questions` 搜尋自教育部教師資格考試題庫，民國 094–115）。

整個系統為離線靜態檔（HTML/CSS/原生 JS），可直接壓縮成 zip 分享。

## 如何執行

無建置步驟。以任一靜態伺服器開啟根目錄即可（因使用 localStorage，建議用 http 而非 file://）：

```bash
python3 -m http.server 8000
# 瀏覽 http://localhost:8000/index.html
```

## 檔案結構

- **`index.html`** — 應用外殼與四個分頁（總覽 / 知識圖譜 / 複習佇列 / 設定）。
- **`css/style.css`** — 樣式，含紅/黃/綠掌握狀態配色。
- **`js/data.js`** — 知識圖譜資料：24 個知識點、31 條關係邊，橫跨 5 大領域
  （教育心理學 / 課程與教學 / 教育測驗與評量 / 班級經營與輔導 / 教育學基礎）。
  每個知識點含課程講義 + **考古題題池**；測驗時由 `app.js` 隨機抽 5 題（選項亦隨機排序）。
  - 全庫 **134 題真實考古題**（每知識點 3–9 題）：**118 題教檢**（民國 94–115）＋ **16 題教甄**
    （中策聯盟 2026）。
  - **零 AI 編造**：每題 `answer` 直接取自官方答案卷、題幹/選項逐字取自官方語料、不附任何解析。
  - **可回查**：`src` 為官方出處引用；`ref` 為官方依據 —— 教檢＝官方試卷代碼 `paper_id`
    （可經 tqa.rcpet.edu.tw 或 MCP `get_teacher_exam_paper` 調出官方題本＋答案），
    教甄＝官方答案卷 PDF 網址。
  - 本檔由 `tools/build-pool.js` 程式化建置（併入 `tools/pool.json` 並驗證結構），請勿手改。
  - 原自編練習題已移除；測驗題一律為官方考古題。
- **`tools/pool.json`** — 各知識點的官方考古題題池原始資料（`src`/`ref`），題庫的單一真實來源。
- **`tools/build-pool.js`** — 建置腳本：讀 `data.js` 的課程內容 + `pool.json`，驗證後產生 `data.js`（冪等）。
- **`js/srs.js`** — 間隔複習排程（艾賓浩斯遺忘曲線）。答對率 `>=0.8` 綠、`>=0.5` 黃、
  否則紅；答對推進間隔一階、答錯歸零，紅色節點採最短間隔的一半以高頻回到佇列。
- **`js/storage.js`** — localStorage 進度儲存 + JSON 匯出/匯入備份（含格式驗證與下載）。
- **`js/graph.js`** — 純 SVG + 原生 JS 的知識圖譜視覺化。以決定性（不用亂數）的
  Fruchterman–Reingold 力導向演算法佈局，節點顏色即掌握狀態，邊依關係類型著色
  （依賴 / 延伸 / 易混淆）。

## 資料結構（`js/data.js`）

```js
window.KG_DATA = {
  AREAS,   // { code: { name, color } }
  NODES,   // [{ id, title, area, summary, lesson:[html...],
           //    quiz:[{ stem, options[4], answer, src, ref }] }]  ← quiz 為考古題題池
           //    answer=正解 index(官方答案卷)；src=官方出處；ref=paper_id 或官方答案卷 URL
  EDGES,   // [{ from, to, type }]  type: 'depends'(依賴) | 'extends'(延伸) | 'confuse'(易混淆)
  EDGE_META,
  VERSION
}
```

## 使用 Twinkle Hub MCP 蒐集考古題

- **教檢**：以 `search_teacher_exam_questions("<自然語言查詢>")` 對教檢題庫（~12,700 題）
  做語意檢索，逐一為每個知識點挑選最貼切的真實考題。
- **教甄**：教甄題庫（~2,400 題）多數縣市未公布標準答案（`answer: null`），附答案者集中於
  **中策聯盟（涵蓋約 10 縣市共用試題）**。作法是以 `get_teacher_recruit_paper(
  "tjse_midtea_115_jh_教育專業")` 取整份「教育專業」試卷（50 題、附官方答案）逐題比對，
  再以 `search_teacher_recruit_questions(..., county="midtea")` 補齊其餘知識點。

建置題池的作法：對每個知識點語意搜尋取回候選 → 套過濾規則（`answer` 非 null、四選項齊全、
題幹須含主題關鍵字、去重、排除 OCR 殘渣）→ 逐字寫入 `tools/pool.json`（含 `src`/`ref`）→
`node tools/build-pool.js` 驗證後併入 `data.js`。**未公布答案（`answer: null`）的題一律不採用。**

## 驗收（已通過）

以 Playwright（headless chromium）驅動實際 UI 自動驗收：
- 24 張知識點卡片 + 24 個圖譜節點正確渲染；題池每節點 3–9 題。
- 隨機完成 3 個知識點測驗（5/5）並達綠色（以官方正解文字比對作答）。
- **隨機抽題驗證**：同一節點連續兩次測驗抽到的題組不同。
- 作答後正確顯示官方出處與回查依據（教檢＝試卷代碼、教甄＝官方答案卷連結），且無 AI 解析。
- 全程 console 無 error/warning、頁面無 JS 例外。
