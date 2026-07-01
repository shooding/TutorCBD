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
  每個知識點含課程講義 + 4 題測驗，其中**至少 1 題為真實教檢考古題**（`src` 欄標註
  年度與科目來源），其餘為依命題重點自編之練習題。
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
           //    quiz:[{ stem, options[4], answer, explain, src }] }]
  EDGES,   // [{ from, to, type }]  type: 'depends'(依賴) | 'extends'(延伸) | 'confuse'(易混淆)
  EDGE_META,
  VERSION
}
```

## 使用 Twinkle Hub MCP 蒐集考古題

以 `search_teacher_exam_questions("<自然語言查詢>")` 對教檢題庫（~12,700 題）做語意檢索，
逐一為每個知識點挑選最貼切的真實考題，保留原題幹 / 選項 / 官方答案，並在 `src` 標註來源。
如需擴充題庫，續用同一工具搜尋，或以 `get_teacher_exam_paper(paper_id)` 取整份試卷。

## 驗收（已通過）

以 Playwright（headless chromium）驅動實際 UI 自動驗收：
- 24 張知識點卡片 + 24 個圖譜節點正確渲染。
- 隨機完成 3 個知識點課程與測驗（4/4）並達綠色（已掌握）。
- 全程 console 無 error/warning、頁面無 JS 例外。
