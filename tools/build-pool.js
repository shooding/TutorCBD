// tools/build-pool.js — 將 pool.json（官方考古題題池）併入 ../js/data.js
// 用法：node tools/build-pool.js（於專案根目錄執行）
// 冪等：從現有 data.js 讀取 lessons/AREAS/EDGES，僅以 pool.json 覆寫各節點 quiz。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
require(path.join(ROOT, 'js/data.js'));
const KG = global.window.KG_DATA;

const pool = JSON.parse(fs.readFileSync(path.join(__dirname, 'pool.json'), 'utf8'));
const refs = pool._refs;

const GARBAGE = ['第貳部分', '非選擇題', '試題結束', '題組', '##', '答案卷', '問答題', '【', 'pattern)', 'ayı'];
const hasGarbage = (s) => GARBAGE.some((g) => s.indexOf(g) !== -1);

const errors = [];
let total = 0;
const summary = [];

KG.NODES.forEach((node) => {
  const items = pool[node.id];
  if (!items || !items.length) { errors.push(`node ${node.id}: 無題池`); return; }
  const seen = new Set();
  const clean = [];
  items.forEach((q, i) => {
    const w = `${node.id}[#${i}]`;
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) errors.push(`${w}: answer 超出範圍 (${q.answer})`);
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${w}: 選項數 != 4`);
    q.options.forEach((o, j) => { if (!o || !o.trim()) errors.push(`${w}: 選項${j} 空白`); if (hasGarbage(o)) errors.push(`${w}: 選項${j} 含殘渣`); });
    if (hasGarbage(q.stem)) errors.push(`${w}: 題幹含殘渣`);
    if (!q.src) errors.push(`${w}: 缺 src`);
    let ref = q.ref || '';
    if (ref.charAt(0) === '@') { ref = refs[ref.slice(1)] || ''; if (!ref) errors.push(`${w}: ref 無法解析 ${q.ref}`); }
    if (!ref) errors.push(`${w}: 缺 ref`);
    const key = q.stem.slice(0, 30);
    if (seen.has(key)) return;
    seen.add(key);
    clean.push({ stem: q.stem, options: q.options, answer: q.answer, src: q.src, ref: ref });
  });
  node.quiz = clean;
  total += clean.length;
  summary.push(`${node.id}: ${clean.length}`);
});

if (errors.length) { console.error('=== 驗證失敗 ==='); errors.forEach((e) => console.error('  ' + e)); process.exit(1); }

KG.VERSION = 2;
const banner = `/*
 * data.js — 教師甄試學習知識圖譜資料（考古題題池版）
 * ------------------------------------------------------------
 * 每個知識點的 quiz 為「真實歷屆考古題題池」，測驗時由 app.js 隨機抽題。
 * 每題：
 *   answer  取自官方答案卷（教檢＝教育部/心測中心；教甄＝中策聯盟公布答案卷），
 *           本檔不判斷、不推導、不覆寫，亦不附加任何 AI 解析。
 *   src     官方出處引用（例「教檢2020·學習者發展與適性輔導 #6」）。
 *   ref     可回查官方依據：教檢＝官方試卷代碼 paper_id（可經教育部題庫
 *           tqa.rcpet.edu.tw 或 MCP get_teacher_exam_paper 調出官方題本＋答案）；
 *           教甄＝官方答案卷 PDF 網址。
 * 題幹／選項逐字取自官方語料。本檔由 tools/build-pool.js 建置，請勿手改。
 */
`;
const out = banner + '(function (global) {\n  \'use strict\';\n  global.KG_DATA = ' +
  JSON.stringify({ AREAS: KG.AREAS, NODES: KG.NODES, EDGES: KG.EDGES, EDGE_META: KG.EDGE_META, VERSION: KG.VERSION }, null, 2).replace(/\n/g, '\n  ') +
  ';\n})(window);\n';
fs.writeFileSync(path.join(ROOT, 'js/data.js'), out, 'utf8');
console.log('=== 建置完成 ===');
console.log('題池總題數:', total, '（' + KG.NODES.length + ' 個知識點）');
console.log(summary.join('  '));
