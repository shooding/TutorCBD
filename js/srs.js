/*
 * srs.js — 間隔複習排程（參考艾賓浩斯遺忘曲線）
 * ------------------------------------------------------------
 * 掌握狀態(status)以測驗答對率決定：
 *   correctRatio >= 0.8 → green  (已掌握)
 *   correctRatio >= 0.5 → yellow (學習中)
 *   否則               → red    (未掌握 / 需加強)
 *
 * 複習頻率參考艾賓浩斯遺忘曲線：記憶保留隨時間指數衰減，
 * 因此答對後間隔逐步拉長，答錯則重置為最短間隔。
 * 紅色（未掌握）節點刻意採用「極短間隔」，使其在複習佇列中
 * 高頻出現；綠色節點間隔最長。
 *
 * 間隔階梯（單位：毫秒）——由 艾賓浩斯 常見節點轉化：
 *   20分、1小時、9小時、1天、2天、6天、15天、31天
 */
(function (global) {
  'use strict';

  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  // 艾賓浩斯間隔階梯
  const INTERVALS = [20 * MIN, HOUR, 9 * HOUR, DAY, 2 * DAY, 6 * DAY, 15 * DAY, 31 * DAY];

  function classify(ratio) {
    if (ratio >= 0.8) return 'green';
    if (ratio >= 0.5) return 'yellow';
    return 'red';
  }

  // 依據本次測驗結果，更新單一節點的複習狀態
  // prev: 既有進度物件(可能為 undefined)
  // ratio: 本次答對率 0~1
  // now: 目前時間戳(ms)
  function review(prev, ratio, now) {
    const status = classify(ratio);
    const p = prev ? Object.assign({}, prev) : {
      status: 'red', level: 0, reps: 0, lastScore: 0, dueAt: now, history: []
    };

    p.lastScore = Math.round(ratio * 100);
    p.reps = (p.reps || 0) + 1;
    p.status = status;
    p.lastReviewed = now;

    if (status === 'green') {
      // 答對，間隔往後推進一階
      p.level = Math.min((p.level || 0) + 1, INTERVALS.length - 1);
    } else if (status === 'yellow') {
      // 部分掌握，維持目前階層(不前進也不歸零)，但至少為第 0 階
      p.level = Math.max(0, (p.level || 0));
    } else {
      // 未掌握，重置為最短間隔(艾賓浩斯：紅色高頻複習)
      p.level = 0;
    }

    // 紅色節點使用最短間隔的一半，讓它更快回到複習佇列
    const base = INTERVALS[p.level];
    const interval = status === 'red' ? Math.round(base / 2) : base;
    p.dueAt = now + interval;
    p.intervalMs = interval;

    p.history = (p.history || []).slice(-19);
    p.history.push({ t: now, score: p.lastScore, status: status });

    return p;
  }

  // 是否到期需複習
  function isDue(progress, now) {
    if (!progress) return true;               // 從未學過 → 視為需學習
    return (progress.dueAt || 0) <= now;
  }

  // 到期的「急迫度」：負值表示已逾期(愈負愈急)，用於排序
  function urgency(progress, now) {
    if (!progress) return -Infinity;          // 未學過最優先
    return (progress.dueAt || 0) - now;
  }

  // 人類可讀的下次複習時間描述
  function dueLabel(progress, now) {
    if (!progress) return '尚未學習';
    const diff = (progress.dueAt || 0) - now;
    if (diff <= 0) return '待複習';
    if (diff < HOUR) return '約 ' + Math.max(1, Math.round(diff / MIN)) + ' 分鐘後';
    if (diff < DAY) return '約 ' + Math.round(diff / HOUR) + ' 小時後';
    return '約 ' + Math.round(diff / DAY) + ' 天後';
  }

  global.SRS = {
    INTERVALS: INTERVALS,
    classify: classify,
    review: review,
    isDue: isDue,
    urgency: urgency,
    dueLabel: dueLabel
  };
})(window);
