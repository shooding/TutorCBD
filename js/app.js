/*
 * app.js — 主控制器
 * ------------------------------------------------------------
 * 串接 data.js（知識圖譜）、srs.js（間隔複習）、storage.js（進度儲存）、
 * graph.js（視覺化）。提供四個分頁：總覽 / 知識圖譜 / 複習佇列 / 設定，
 * 以及節點課程 + 測驗流程（答題後依 SRS 更新紅/黃/綠掌握狀態）。
 */
(function (global) {
  'use strict';

  const KG = global.KG_DATA;
  const SRS = global.SRS;
  const Store = global.Store;
  const Graph = global.Graph;

  const STATUS_META = {
    green: { label: '已掌握', cls: 'green' },
    yellow: { label: '學習中', cls: 'yellow' },
    red: { label: '需加強', cls: 'red' },
    grey: { label: '尚未學習', cls: 'grey' }
  };
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  let state = Store.load();
  const nodeById = {};
  KG.NODES.forEach(function (n) { nodeById[n.id] = n; });

  function $(id) { return document.getElementById(id); }
  function now() { return Date.now(); }

  function statusOf(id) {
    const p = state.progress[id];
    return p && p.status ? p.status : 'grey';
  }

  function counts() {
    const c = { green: 0, yellow: 0, red: 0, grey: 0 };
    KG.NODES.forEach(function (n) { c[statusOf(n.id)]++; });
    return c;
  }

  // ---------------- 分頁切換 ----------------
  function switchView(view) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + view);
    });
  }

  // ---------------- Header 進度 ----------------
  function renderHeader() {
    const c = counts();
    const total = KG.NODES.length;
    const el = $('header-progress');
    el.innerHTML =
      '<div class="progressbar">' +
        seg('green', c.green, total) +
        seg('yellow', c.yellow, total) +
        seg('red', c.red, total) +
      '</div>' +
      '<div class="progress-caption">已掌握 ' + c.green + ' / ' + total +
      ' 個知識點（學習中 ' + c.yellow + '、需加強 ' + c.red + '）</div>';
  }
  function seg(cls, val, total) {
    const pct = total ? (val / total * 100) : 0;
    return '<span class="seg-' + cls + '" style="width:' + pct + '%"></span>';
  }

  // ---------------- 總覽 ----------------
  function renderDashboard() {
    const c = counts();
    const total = KG.NODES.length;
    let html = '<div class="summary-grid">' +
      statCard('green', c.green, '已掌握') +
      statCard('yellow', c.yellow, '學習中') +
      statCard('red', c.red, '需加強') +
      statCard('grey', c.grey, '尚未學習') +
      '<div class="stat-card"><div class="num">' + total + '</div><div class="label">知識點總數</div></div>' +
    '</div>';

    Object.keys(KG.AREAS).forEach(function (code) {
      const area = KG.AREAS[code];
      const nodes = KG.NODES.filter(function (n) { return n.area === code; });
      if (!nodes.length) return;
      html += '<div class="area-block">' +
        '<h2 class="area-title"><span class="area-dot" style="background:' + area.color + '"></span>' +
        area.name + '<span style="font-weight:400;color:var(--ink-soft);font-size:13px">（' + nodes.length + '）</span></h2>' +
        '<div class="node-grid">' + nodes.map(nodeCard).join('') + '</div></div>';
    });

    $('view-dashboard').innerHTML = html;
  }

  function statCard(cls, num, label) {
    return '<div class="stat-card ' + cls + '"><div class="num">' + num + '</div><div class="label">' + label + '</div></div>';
  }

  function nodeCard(n) {
    const st = statusOf(n.id);
    const meta = STATUS_META[st];
    const p = state.progress[n.id];
    const due = p ? '複習：' + SRS.dueLabel(p, now()) : '';
    return '<div class="node-card ' + meta.cls + '" data-node-id="' + n.id + '">' +
      '<h3>' + n.title + '</h3>' +
      '<p class="summary">' + n.summary + '</p>' +
      '<div class="meta"><span class="chip ' + meta.cls + '">' + meta.label + '</span>' +
      '<span class="due">' + due + '</span></div></div>';
  }

  // ---------------- 複習佇列 ----------------
  function renderReview() {
    const list = KG.NODES.slice().sort(function (a, b) {
      return SRS.urgency(state.progress[a.id], now()) - SRS.urgency(state.progress[b.id], now());
    });
    const dueCount = list.filter(function (n) { return SRS.isDue(state.progress[n.id], now()); }).length;

    let html = '<p class="hint" style="margin-bottom:14px">依艾賓浩斯遺忘曲線排序：<b>' + dueCount +
      '</b> 個知識點待複習（未學習與紅色節點優先、間隔最短）。</p><div class="review-list">';

    html += list.map(function (n) {
      const st = statusOf(n.id);
      const meta = STATUS_META[st];
      const p = state.progress[n.id];
      const isDue = SRS.isDue(p, now());
      const score = p ? '　上次 ' + p.lastScore + ' 分' : '';
      return '<div class="review-row ' + meta.cls + (isDue ? ' due-now' : '') + '" data-node-id="' + n.id + '">' +
        '<span class="chip ' + meta.cls + '">' + meta.label + '</span>' +
        '<div class="info"><h4>' + n.title + '</h4>' +
        '<small>' + KG.AREAS[n.area].name + '　·　' + SRS.dueLabel(p, now()) + score + '</small></div>' +
        '<span class="btn ghost">複習</span></div>';
    }).join('');
    html += '</div>';
    $('view-review').innerHTML = html;
  }

  // ---------------- 知識圖譜 ----------------
  function renderGraphLegend() {
    let html = '';
    Object.keys(STATUS_META).forEach(function (k) {
      html += '<span class="item"><span class="dot" style="background:' + Graph.STATUS_COLOR[k] + '"></span>' + STATUS_META[k].label + '</span>';
    });
    Object.keys(KG.EDGE_META).forEach(function (t) {
      const m = KG.EDGE_META[t];
      html += '<span class="item"><span class="swatch" style="background:' + m.color +
        (m.dash ? ';background:repeating-linear-gradient(90deg,' + m.color + ' 0 4px,transparent 4px 7px)' : '') +
        '"></span>' + m.label + '</span>';
    });
    $('graph-legend').innerHTML = html;
  }

  function renderGraph() {
    Graph.render($('graph-canvas'), {
      data: KG,
      statusOf: statusOf,
      onSelect: openNode
    });
  }

  // ---------------- 設定 ----------------
  function renderSettings() {
    const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleString('zh-TW') : '—';
    $('view-settings').innerHTML =
      '<div class="settings-panel">' +
      '<h3>進度備份</h3>' +
      '<p>進度儲存在本機瀏覽器（localStorage）。更換裝置或清除瀏覽器資料前，請先匯出備份。</p>' +
      '<div class="btn-row">' +
        '<button class="btn" id="btn-export">匯出備份 (JSON)</button>' +
        '<button class="btn ghost" id="btn-import">匯入備份</button>' +
        '<button class="btn danger" id="btn-reset">重設所有進度</button>' +
      '</div>' +
      '<div class="io-msg" id="io-msg"></div>' +
      '<p style="margin-top:16px">最後更新：' + updated + '　·　資料版本 v' + (KG.VERSION || 1) + '</p>' +
      '</div>';

    $('btn-export').addEventListener('click', function () {
      Store.download(state);
      ioMsg('已匯出備份檔。', 'ok');
    });
    $('btn-import').addEventListener('click', function () { $('import-file').click(); });
    $('btn-reset').addEventListener('click', function () {
      if (global.confirm('確定要清除所有學習進度嗎？此動作無法復原。')) {
        state = Store.reset();
        ioMsg('進度已重設。', 'ok');
        renderAll();
      }
    });
  }

  function ioMsg(text, cls) {
    const el = $('io-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'io-msg ' + (cls || '');
  }

  // ---------------- 節點課程 + 測驗彈窗 ----------------
  function relationsHtml(node) {
    const rels = [];
    KG.EDGES.forEach(function (e) {
      const meta = KG.EDGE_META[e.type];
      if (e.from === node.id && nodeById[e.to]) {
        rels.push({ to: e.to, text: meta.label + '：' + nodeById[e.to].title });
      } else if (e.to === node.id && nodeById[e.from]) {
        const verb = e.type === 'depends' ? '被延伸' : (e.type === 'extends' ? '延伸自' : meta.label);
        rels.push({ to: e.from, text: verb + '：' + nodeById[e.from].title });
      }
    });
    if (!rels.length) return '';
    return '<div class="relations">' + rels.map(function (r) {
      return '<span class="rel" data-goto="' + r.to + '">' + r.text + '</span>';
    }).join('') + '</div>';
  }

  function openNode(id) {
    const node = nodeById[id];
    if (!node) return;
    const area = KG.AREAS[node.area];
    const st = statusOf(id);
    const p = state.progress[id];

    let html =
      '<div class="modal-eyebrow" style="color:' + area.color + '">' + area.name + '</div>' +
      '<h2>' + node.title + '</h2>' +
      '<p class="node-summary">' + node.summary + '</p>' +
      '<div style="margin-bottom:12px"><span class="chip ' + STATUS_META[st].cls + '">' + STATUS_META[st].label +
        '</span>' + (p ? ' <span class="due">下次複習：' + SRS.dueLabel(p, now()) + '</span>' : '') + '</div>' +
      relationsHtml(node) +
      '<div class="lesson">' + node.lesson.join('') + '</div>' +
      '<div class="quiz-actions"><button class="btn" id="start-quiz">開始測驗（' + node.quiz.length + ' 題）</button></div>';

    openModal(html);
    $('start-quiz').addEventListener('click', function () { startQuiz(node); });
  }

  function startQuiz(node) {
    const session = { node: node, i: 0, correct: 0, answered: false };
    renderQuestion(session);
  }

  function renderQuestion(session) {
    const node = session.node;
    const total = node.quiz.length;
    const q = node.quiz[session.i];
    session.answered = false;

    let html =
      '<div class="modal-eyebrow" style="color:var(--brand-dark)">' + node.title + '　·　測驗</div>' +
      '<div class="quiz-head"><span class="quiz-progress">第 ' + (session.i + 1) + ' / ' + total + ' 題</span>' +
        '<span class="quiz-progress">目前答對 ' + session.correct + '</span></div>' +
      (q.src ? '<span class="quiz-src">考古題來源：' + q.src + '</span>' : '<span class="quiz-src" style="background:#f1f5f9;color:var(--ink-soft)">命題重點自編練習</span>') +
      '<p class="quiz-stem">' + q.stem + '</p>' +
      '<div class="opts" id="opts">' +
      q.options.map(function (opt, idx) {
        return '<button class="opt" data-idx="' + idx + '"><span class="mark">' + LETTERS[idx] + '</span>' + opt + '</button>';
      }).join('') +
      '</div>' +
      '<div id="explain-slot"></div>' +
      '<div class="quiz-actions" id="quiz-actions"></div>';

    $('modal-body').innerHTML = html;

    Array.prototype.forEach.call(document.querySelectorAll('#opts .opt'), function (btn) {
      btn.addEventListener('click', function () { answer(session, parseInt(btn.dataset.idx, 10)); });
    });
  }

  function answer(session, choice) {
    if (session.answered) return;
    session.answered = true;
    const q = session.node.quiz[session.i];
    const correct = q.answer;
    const isRight = choice === correct;
    if (isRight) session.correct++;

    Array.prototype.forEach.call(document.querySelectorAll('#opts .opt'), function (btn) {
      const idx = parseInt(btn.dataset.idx, 10);
      btn.disabled = true;
      if (idx === correct) btn.classList.add('correct');
      else if (idx === choice) btn.classList.add('wrong');
    });

    $('explain-slot').innerHTML =
      '<div class="explain ' + (isRight ? 'right' : 'wrong') + '"><b>' +
      (isRight ? '答對了！' : '正確答案：' + LETTERS[correct] + '　') + '</b>' + q.explain + '</div>';

    const last = session.i === session.node.quiz.length - 1;
    $('quiz-actions').innerHTML = '<button class="btn" id="quiz-next">' + (last ? '看結果' : '下一題') + '</button>';
    $('quiz-next').addEventListener('click', function () {
      if (last) { finishQuiz(session); }
      else { session.i++; renderQuestion(session); }
    });
  }

  function finishQuiz(session) {
    const node = session.node;
    const total = node.quiz.length;
    const ratio = session.correct / total;
    const prev = Store.getNode(state, node.id);
    const updated = SRS.review(prev, ratio, now());
    Store.setNode(state, node.id, updated);   // 內含存檔

    const meta = STATUS_META[updated.status];
    const pct = Math.round(ratio * 100);

    $('modal-body').innerHTML =
      '<div class="result">' +
      '<div class="modal-eyebrow" style="color:var(--brand-dark)">' + node.title + '　·　測驗結果</div>' +
      '<div class="score">' + pct + '<span style="font-size:20px">分</span></div>' +
      '<div class="verdict ' + meta.cls + '">' + meta.label +
        '（答對 ' + session.correct + ' / ' + total + '）</div>' +
      '<p class="next-due">依艾賓浩斯間隔，下次建議複習：' + SRS.dueLabel(updated, now()) + '</p>' +
      '<div class="quiz-actions" style="justify-content:center">' +
        '<button class="btn ghost" id="retry-quiz">再測一次</button>' +
        '<button class="btn" id="finish-quiz">完成</button>' +
      '</div></div>';

    $('retry-quiz').addEventListener('click', function () { startQuiz(node); });
    $('finish-quiz').addEventListener('click', closeModal);
    renderAll();
  }

  // ---------------- Modal 基礎 ----------------
  function openModal(html) {
    $('modal-body').innerHTML = html;
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; }

  // ---------------- 事件委派 ----------------
  function wireEvents() {
    $('tabs').addEventListener('click', function (e) {
      const tab = e.target.closest('.tab');
      if (tab) switchView(tab.dataset.view);
    });

    // 卡片 / 佇列列 / 關係標籤 → 開啟節點（事件委派，涵蓋動態內容）
    document.addEventListener('click', function (e) {
      const goto = e.target.closest('[data-goto]');
      if (goto) { openNode(goto.dataset.goto); return; }
      const row = e.target.closest('[data-node-id]');
      if (row && !e.target.closest('.graph-node')) { openNode(row.dataset.nodeId); }
    });

    $('modal-close').addEventListener('click', closeModal);
    $('modal').addEventListener('click', function (e) {
      if (e.target === $('modal')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal').hidden) closeModal();
    });

    $('import-file').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          state = Store.parseImport(reader.result);
          Store.save(state);
          renderAll();
          ioMsg('已成功匯入備份。', 'ok');
        } catch (err) {
          ioMsg('匯入失敗：' + err.message, 'err');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // ---------------- 全量重繪 ----------------
  function renderAll() {
    renderHeader();
    renderDashboard();
    renderReview();
    renderSettings();
    renderGraph();
  }

  function init() {
    renderGraphLegend();
    wireEvents();
    renderAll();
    switchView('dashboard');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 對外暴露（供自動化測試 / 除錯使用）
  global.TutorApp = {
    openNode: openNode,
    switchView: switchView,
    statusOf: statusOf,
    getState: function () { return state; }
  };
})(window);
