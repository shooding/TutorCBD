/*
 * graph.js — 知識圖譜視覺化（純 SVG + 原生 JS，無外部相依）
 * ------------------------------------------------------------
 * 以 Fruchterman-Reingold 力導向演算法計算節點座標（依領域分群播種，
 * 且完全決定性 — 不使用亂數，故每次佈局結果一致、可離線重現）。
 *
 * Graph.render(container, {
 *   data:     window.KG_DATA,
 *   statusOf: function(nodeId) -> 'green'|'yellow'|'red'|'grey',
 *   onSelect: function(nodeId)          // 點擊節點回呼
 * })
 *
 * 佈局只計算一次並快取；掌握狀態改變時重繪僅更新顏色，座標不變。
 */
(function (global) {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 780, H = 560;
  const NODE_R = 15;

  const STATUS_COLOR = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    grey: '#94a3b8'
  };

  let layoutCache = null;  // { positions: {id:{x,y}}, signature }

  function signature(data) {
    return data.NODES.map(function (n) { return n.id; }).join('|');
  }

  // 依領域給定分群中心（環狀排列），使同領域節點初始靠攏
  function areaCenters(areaCodes) {
    const centers = {};
    const R = Math.min(W, H) * 0.30;
    const cx = W / 2, cy = H / 2;
    areaCodes.forEach(function (code, i) {
      const ang = (2 * Math.PI * i) / areaCodes.length - Math.PI / 2;
      centers[code] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
    });
    return centers;
  }

  function computeLayout(data) {
    if (layoutCache && layoutCache.signature === signature(data)) {
      return layoutCache.positions;
    }

    const nodes = data.NODES;
    const n = nodes.length;
    const idx = {};
    nodes.forEach(function (nd, i) { idx[nd.id] = i; });

    const areaCodes = Object.keys(data.AREAS);
    const centers = areaCenters(areaCodes);

    // 決定性初始座標：領域中心 + 以黃金角散開的小偏移
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const pos = nodes.map(function (nd, i) {
      const c = centers[nd.area] || { x: W / 2, y: H / 2 };
      const r = 26 + (i % 5) * 6;
      const a = i * GOLDEN;
      return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
    });

    const edges = data.EDGES.map(function (e) {
      return { u: idx[e.from], v: idx[e.to] };
    }).filter(function (e) { return e.u != null && e.v != null; });

    const area = W * H;
    const k = 0.82 * Math.sqrt(area / n);
    const GRAVITY = 0.10;   // 向心力：讓連通圖保持緊湊、避免縱向拉長
    const ITER = 420;
    let temp = W / 8;
    const cool = temp / (ITER + 1);
    const cx = W / 2, cy = H / 2;

    for (let it = 0; it < ITER; it++) {
      const disp = pos.map(function () { return { x: 0, y: 0 }; });

      // 斥力（所有節點對）
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = pos[i].x - pos[j].x;
          let dy = pos[i].y - pos[j].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const f = (k * k) / dist;
          const ux = dx / dist, uy = dy / dist;
          disp[i].x += ux * f; disp[i].y += uy * f;
          disp[j].x -= ux * f; disp[j].y -= uy * f;
        }
      }

      // 引力（沿邊）
      edges.forEach(function (e) {
        let dx = pos[e.u].x - pos[e.v].x;
        let dy = pos[e.u].y - pos[e.v].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (dist * dist) / k;
        const ux = dx / dist, uy = dy / dist;
        disp[e.u].x -= ux * f; disp[e.u].y -= uy * f;
        disp[e.v].x += ux * f; disp[e.v].y += uy * f;
      });

      // 向心重力，避免孤立節點漂離
      for (let i = 0; i < n; i++) {
        disp[i].x += (cx - pos[i].x) * GRAVITY;
        disp[i].y += (cy - pos[i].y) * GRAVITY;
      }

      // 依溫度限制位移
      for (let i = 0; i < n; i++) {
        const d = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y) || 0.01;
        pos[i].x += (disp[i].x / d) * Math.min(d, temp);
        pos[i].y += (disp[i].y / d) * Math.min(d, temp);
      }
      temp -= cool;
    }

    // 正規化到固定比例的框內：確保圖譜填滿寬度、比例穩定，不因力導向結果過度縱向拉長
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    pos.forEach(function (p) {
      bx0 = Math.min(bx0, p.x); by0 = Math.min(by0, p.y);
      bx1 = Math.max(bx1, p.x); by1 = Math.max(by1, p.y);
    });
    const spanX = Math.max(1, bx1 - bx0), spanY = Math.max(1, by1 - by0);
    const TW = 760, TH = 430;

    const positions = {};
    nodes.forEach(function (nd, i) {
      positions[nd.id] = {
        x: ((pos[i].x - bx0) / spanX) * TW,
        y: ((pos[i].y - by0) / spanY) * TH
      };
    });
    layoutCache = { positions: positions, signature: signature(data) };
    return positions;
  }

  function el(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function render(container, opts) {
    const data = opts.data;
    const statusOf = opts.statusOf || function () { return 'grey'; };
    const onSelect = opts.onSelect || function () {};

    const pos = computeLayout(data);

    // 依實際座標計算邊界，套 padding 後設定 viewBox
    const xs = [], ys = [];
    data.NODES.forEach(function (nd) { xs.push(pos[nd.id].x); ys.push(pos[nd.id].y); });
    const pad = NODE_R + 46;
    const minX = Math.min.apply(null, xs) - pad;
    const minY = Math.min.apply(null, ys) - pad;
    const maxX = Math.max.apply(null, xs) + pad;
    const maxY = Math.max.apply(null, ys) + pad;

    const svg = el('svg', {
      viewBox: minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY),
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': '教育專業科目知識圖譜'
    });

    // 邊
    data.EDGES.forEach(function (e) {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const meta = data.EDGE_META[e.type] || { color: '#94a3b8', dash: '' };
      const line = el('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: meta.color, 'stroke-width': 1.8, class: 'graph-edge'
      });
      if (meta.dash) line.setAttribute('stroke-dasharray', meta.dash);
      svg.appendChild(line);
    });

    // 節點
    data.NODES.forEach(function (nd) {
      const p = pos[nd.id];
      const st = statusOf(nd.id);
      const g = el('g', { class: 'graph-node', 'data-node-id': nd.id, tabindex: '0', role: 'button' });
      g.appendChild(el('circle', { cx: p.x, cy: p.y, r: NODE_R, fill: STATUS_COLOR[st] || STATUS_COLOR.grey }));
      const label = el('text', { x: p.x, y: p.y + NODE_R + 13, 'text-anchor': 'middle' });
      label.textContent = nd.title;
      g.appendChild(label);
      g.appendChild(el('title', {})).textContent = nd.title + '：' + nd.summary;

      g.addEventListener('click', function () { onSelect(nd.id); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(nd.id); }
      });
      svg.appendChild(g);
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  global.Graph = { render: render, STATUS_COLOR: STATUS_COLOR };
})(window);
