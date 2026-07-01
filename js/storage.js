/*
 * storage.js — 進度儲存 / 匯出 / 匯入
 * ------------------------------------------------------------
 * 使用 localStorage 儲存學習進度，並提供 JSON 匯出/匯入備份，
 * 避免更換裝置或清除瀏覽器資料時進度遺失。
 *
 * 進度結構：
 * {
 *   version: 1,
 *   updatedAt: <ms>,
 *   progress: { <nodeId>: { status, level, reps, lastScore, dueAt, history[] }, ... }
 * }
 */
(function (global) {
  'use strict';

  const KEY = 'tutorcbd.progress.v1';

  function nowSafe() { return Date.now(); }

  function emptyState() {
    return { version: 1, updatedAt: nowSafe(), progress: {} };
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) return emptyState();
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.progress) return emptyState();
      return data;
    } catch (e) {
      console.warn('[storage] 讀取失敗，改用空白進度：', e);
      return emptyState();
    }
  }

  function save(state) {
    try {
      state.updatedAt = nowSafe();
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('[storage] 儲存失敗：', e);
      return false;
    }
  }

  function getNode(state, id) {
    return state.progress[id];
  }

  function setNode(state, id, prog) {
    state.progress[id] = prog;
    save(state);
    return prog;
  }

  function reset() {
    const s = emptyState();
    save(s);
    return s;
  }

  // 匯出為可下載的 JSON 字串
  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  // 觸發下載
  function download(state, filename) {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || ('teacher-exam-progress-' + new Date().toISOString().slice(0, 10) + '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // 從匯入的文字解析並驗證
  function parseImport(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || typeof data.progress !== 'object') {
      throw new Error('備份檔格式不正確：缺少 progress 欄位');
    }
    // 基本清洗：只保留合理欄位
    const clean = emptyState();
    clean.version = data.version || 1;
    Object.keys(data.progress).forEach(function (id) {
      const p = data.progress[id];
      if (p && typeof p === 'object') {
        clean.progress[id] = {
          status: p.status || 'red',
          level: typeof p.level === 'number' ? p.level : 0,
          reps: typeof p.reps === 'number' ? p.reps : 0,
          lastScore: typeof p.lastScore === 'number' ? p.lastScore : 0,
          dueAt: typeof p.dueAt === 'number' ? p.dueAt : nowSafe(),
          lastReviewed: p.lastReviewed || null,
          intervalMs: p.intervalMs || 0,
          history: Array.isArray(p.history) ? p.history.slice(-20) : []
        };
      }
    });
    return clean;
  }

  global.Store = {
    KEY: KEY,
    load: load,
    save: save,
    getNode: getNode,
    setNode: setNode,
    reset: reset,
    exportJSON: exportJSON,
    download: download,
    parseImport: parseImport,
    emptyState: emptyState
  };
})(window);
