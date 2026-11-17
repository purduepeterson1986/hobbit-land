/* Hobbit Land — the board: the road, its spaces, and the map drawn around it.
 *
 * The board is an SVG 1600 x 920 units. The road is described by STOPS (named places)
 * with a number of steps between each one. The spaces are spread evenly along a smooth
 * curve through the stops and the "via" bend points.
 *
 * Shortcuts: a SHORTCUT leaves the road at a fork stop and rejoins it at a later stop.
 * A token takes it only when a move STARTS on the fork space, which only happens when
 * the token landed exactly on the fork.
 *
 * Every game, build() is called once for the road (it never changes) and dress() makes
 * a fresh look: which spaces are card spaces, plus trees, rocks, sheep, clouds, season
 * and time of day.
 */
(function () {
  'use strict';

  const W = 1600, H = 920;

  /* ============================================================
     THE ROAD
     ============================================================ */
  // at: position. n: steps from the previous stop. via: bend points before this stop.
  // label: where the place name is written (dx, dy from the stop), anchor: text alignment.
  const STOPS = [
    { id: 'bagend', name: 'Bag End', at: [112, 158], kind: 'start', label: [0, 44] },
    { id: 'maggot', name: 'Farmer Maggot’s', at: [370, 290], n: 9, via: [[188, 112], [258, 142], [232, 214], [280, 282]], kind: 'fork', label: [-4, -32] },
    { id: 'bree', name: 'Bree', rest: true, at: [600, 250], n: 13, via: [[392, 376], [366, 456], [452, 506], [546, 456], [588, 356]], label: [-34, 2], anchor: 'end' },
    { id: 'weathertop', name: 'Weathertop', at: [820, 132], n: 6, via: [[680, 196], [744, 142]], label: [0, 76] },
    { id: 'rivendell', name: 'Rivendell', rest: true, at: [1030, 176], n: 5, via: [[900, 172], [962, 128]], label: [-30, 24], anchor: 'end' },
    { id: 'durin', name: 'Doors of Durin', at: [1000, 332], n: 4, via: [[1014, 252]], kind: 'fork', label: [-30, 42], anchor: 'end' },
    { id: 'lorien', name: 'Lothlórien', rest: true, at: [1282, 462], n: 12, via: [[1076, 304], [1112, 226], [1160, 172], [1222, 214], [1252, 306], [1272, 390]], label: [30, -30], anchor: 'start' },
    { id: 'amonhen', name: 'Amon Hen', at: [1140, 590], n: 4, via: [[1228, 542]], label: [-4, 40] },
    { id: 'emynmuil', name: 'Emyn Muil', at: [950, 660], n: 5, via: [[1042, 614]], label: [-30, -26], anchor: 'end' },
    { id: 'marshes', name: 'Dead Marshes', at: [800, 800], n: 5, via: [[872, 730]], label: [-30, -4], anchor: 'end' },
    { id: 'ithilien', name: 'Ithilien', at: [1080, 842], n: 7, via: [[862, 872], [972, 886]], label: [0, -30] },
    { id: 'morgul', name: 'Minas Morgul', at: [1250, 822], n: 4, via: [[1170, 872]], label: [40, 44], anchor: 'start' },
    { id: 'ungol', name: 'Cirith Ungol', at: [1345, 680], n: 4, via: [[1300, 746]], label: [-36, -18], anchor: 'end' },
    { id: 'doom', name: 'Mount Doom', at: [1480, 776], n: 7, via: [[1420, 630], [1500, 668], [1556, 740]], kind: 'finish', label: [0, 120] }
  ];

  // Road length. Normal is the road above. Short cuts out the loops through the Emyn Muil and the Dead Marshes;
  // Long stretches that loop out west toward the Hobbit Land sign.
  const LENGTHS = {
    short: { name: 'Short' },
    normal: { name: 'Normal' },
    long: { name: 'Long' }
  };
  function stopsFor(length) {
    const list = STOPS.map((st) => Object.assign({}, st));
    const i = list.findIndex((st) => st.id === 'marshes');
    const ith = list.find((st) => st.id === 'ithilien');
    if (length === 'short') {
      // straight down from Amon Hen to Ithilien
      list.splice(i, 1);
      list.splice(list.findIndex((st) => st.id === 'emynmuil'), 1);
      Object.assign(ith, { n: 6, via: [[1092, 688]], label: [34, -4], anchor: 'start' });
      Object.assign(list.find((st) => st.id === 'amonhen'), { label: [-28, 6], anchor: 'end' });
    } else if (length === 'long') {
      Object.assign(list[i], { at: [780, 836], n: 20, label: [0, -34], anchor: 'middle',
        via: [[868, 724], [760, 698], [640, 692], [528, 722], [462, 800], [530, 876], [660, 888]] });
      Object.assign(ith, { n: 7, via: [[862, 872], [972, 886]] });
    }
    return list;
  }

  const SHORTCUTS = [
    { id: 'ferry', name: 'Buckleberry Ferry', from: 'maggot', to: 'bree', n: 5, via: [[450, 298], [528, 282]], label: [492, 336] },
    { id: 'moria', name: 'Mines of Moria', from: 'durin', to: 'lorien', n: 6, via: [[1068, 404], [1180, 434]], label: [1150, 470] }
  ];

  /* ---------- curve helpers ---------- */
  const mirror = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    const f = (i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    return [f(0), f(1)];
  }
  // Points along the smooth curve through ctrl, from ctrl[a] to ctrl[b].
  function curve(ctrl, a, b, per) {
    per = per || 24;
    const out = [ctrl[a].slice()];
    for (let i = a; i < b; i++) {
      const p0 = ctrl[i - 1] || mirror(ctrl[i], ctrl[i + 1]);
      const p3 = ctrl[i + 2] || mirror(ctrl[i + 1], ctrl[i]);
      for (let s = 1; s <= per; s++) out.push(catmull(p0, ctrl[i], ctrl[i + 1], p3, s / per));
    }
    return out;
  }
  // n points spread evenly along pts by distance; the last one is the end of pts.
  function evenly(pts, n) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    const out = [];
    let j = 1;
    for (let k = 1; k <= n; k++) {
      const target = (L * k) / n;
      while (j < pts.length - 1 && cum[j] < target) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const t = Math.min(1, Math.max(0, (target - cum[j - 1]) / seg));
      out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
    }
    return out;
  }
  const pathD = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');

  /* ---------- build the road graph (same every game) ---------- */
  function build(length) {
    const STOPS = stopsFor(length || 'normal');
    const nodes = [];
    const add = (p, o) => { const n = Object.assign({ id: nodes.length, x: p[0], y: p[1], next: null, alt: null, route: 'main', kind: 'path' }, o); nodes.push(n); return n; };

    const ctrl = [], stopIdx = [];
    STOPS.forEach((s) => { (s.via || []).forEach((v) => ctrl.push(v)); stopIdx.push(ctrl.length); ctrl.push(s.at); });

    const stopNode = {};
    let prev = add(STOPS[0].at, { kind: 'start', name: STOPS[0].name, stop: STOPS[0].id });
    stopNode[STOPS[0].id] = prev;
    for (let s = 1; s < STOPS.length; s++) {
      const st = STOPS[s];
      const pts = evenly(curve(ctrl, stopIdx[s - 1], stopIdx[s]), st.n);
      for (let k = 0; k < st.n; k++) {
        const last = k === st.n - 1;
        const n = add(pts[k], last ? { kind: st.kind || 'landmark', name: st.name, stop: st.id, rest: !!st.rest } : {});
        prev.next = n.id;
        prev = n;
      }
      stopNode[st.id] = prev;
    }

    const roads = [];
    const mainPts = curve(ctrl, 0, ctrl.length - 1, 30);
    roads.push({ id: 'main', pts: mainPts, d: pathD(mainPts) });

    SHORTCUTS.forEach((sc) => {
      const fi = STOPS.findIndex((s) => s.id === sc.from), ti = STOPS.findIndex((s) => s.id === sc.to);
      const bctrl = [ctrl[stopIdx[fi] - 1], STOPS[fi].at].concat(sc.via, [STOPS[ti].at, ctrl[stopIdx[ti] + 1]]);
      const curvePts = curve(bctrl, 1, bctrl.length - 2, 30);
      const pts = evenly(curvePts, sc.n);
      const fork = stopNode[sc.from], target = stopNode[sc.to];
      fork.fork = sc.id;
      fork.forkName = sc.name;
      let p = null;
      for (let k = 0; k < sc.n - 1; k++) {
        const n = add(pts[k], { route: sc.id });
        if (p) p.next = n.id; else fork.alt = n.id;
        p = n;
      }
      p.next = target.id;
      roads.push({ id: sc.id, pts: curvePts, d: pathD(curvePts) });
    });

    // How far each space is from the finish along the long road (for the progress bars).
    const finish = nodes.find((n) => n.kind === 'finish');
    const longCount = (() => { let c = 0, n = nodes[0]; while (n.next != null) { c++; n = nodes[n.next]; } return c; })();
    const dist = new Array(nodes.length).fill(0);
    (function walk() {
      // distance to finish following "next" (shortcut spaces lead back onto the road)
      nodes.forEach((n) => {
        let c = 0, m = n;
        while (m.next != null && c < 500) { c++; m = nodes[m.next]; }
        dist[n.id] = c;
      });
    })();

    return { nodes, roads, stopNode, stops: STOPS, length: length || 'normal', start: nodes[0].id, finish: finish.id, longCount, dist, W, H };
  }

  /* ============================================================
     THE LOOK OF THE MAP (changes a little every game)
     ============================================================ */
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  const SEASONS = {
    spring: { name: 'Spring', grass: '#a9c97a', leaves: ['#7fb85a', '#93c868', '#6aa64c'], extra: '#f3b6c8', flowers: ['#f6a5c0', '#fff3a8', '#ffffff', '#c9a6f2'], drift: ['#f6a5c0', '#ffffff', '#f9cfe0'] },
    summer: { name: 'Summer', grass: '#9cbd68', leaves: ['#5f9a3f', '#6fa94a', '#4f8a36'], extra: null, flowers: ['#ffd23f', '#ff8a5b', '#ffffff', '#7fb2ff'], drift: null },
    autumn: { name: 'Autumn', grass: '#bcb46e', leaves: ['#d9902e', '#c4612a', '#e2b33b', '#9c6a2a'], extra: null, flowers: ['#ffcf5a', '#e8743b', '#fff1c1'], drift: ['#d9902e', '#c4612a', '#e2b33b', '#9c6a2a'] }
  };
  const TIMES = {
    morning: { name: 'Morning', tint: 'rgba(255,190,110,.24)', sky: 'rgba(255,240,210,.0)' },
    midday: { name: 'Midday', tint: 'rgba(255,255,240,.12)', sky: 'rgba(0,0,0,0)' },
    evening: { name: 'Evening', tint: 'rgba(90,40,120,.30)', sky: 'rgba(120,70,140,.06)' }
  };

  /* ---------- small drawings, origin at the bottom centre ---------- */
  function wrap(x, y, s, cls, inner, extra) {
    return '<g transform="translate(' + f1(x) + ',' + f1(y) + ')' + (s && s !== 1 ? ' scale(' + f1(s * 100) / 100 + ')' : '') + '">' +
      '<g class="' + cls + '"' + (extra || '') + '>' + inner + '</g></g>';
  }
  const shadow = (rx) => '<ellipse cx="0" cy="1" rx="' + rx + '" ry="' + (rx / 3).toFixed(1) + '" fill="rgba(70,45,15,.18)"/>';

  function roundTree(c1, c2) {
    return shadow(10) + '<rect x="-2" y="-12" width="4" height="13" rx="1" fill="#6b4a2b"/>' +
      '<circle cx="0" cy="-21" r="11" fill="' + c1 + '"/><circle cx="-6.5" cy="-15" r="7" fill="' + c2 + '"/><circle cx="6.5" cy="-16" r="7.2" fill="' + c2 + '"/>' +
      '<circle cx="-3.5" cy="-25" r="4.2" fill="#fff" opacity=".18"/>';
  }
  function pine(c1, c2, snow) {
    return shadow(8) + '<rect x="-1.8" y="-8" width="3.6" height="9" fill="#5a3d22"/>' +
      '<path d="M0,-36 L-8,-20 L8,-20 Z M0,-28 L-10,-10 L10,-10 Z M0,-20 L-12,-4 L12,-4 Z" fill="' + c1 + '"/>' +
      '<path d="M0,-36 L8,-20 L3,-20 Z M0,-28 L10,-10 L4,-10 Z M0,-20 L12,-4 L5,-4 Z" fill="' + c2 + '"/>' +
      (snow ? '<path d="M0,-36 L-4,-28 L4,-28 Z" fill="#fff"/>' : '');
  }
  function mallorn() {
    return shadow(11) + '<path d="M-2.6,0 L-1.6,-34 L1.6,-34 L2.6,0 Z" fill="#e7e2d2" stroke="#b9b29c" stroke-width=".6"/>' +
      '<circle cx="0" cy="-42" r="12" fill="#e9b93c"/><circle cx="-9" cy="-34" r="8" fill="#f1cd57"/><circle cx="9" cy="-35" r="8.5" fill="#d9a62b"/>' +
      '<circle cx="-3" cy="-48" r="5" fill="#fff3b0" opacity=".45"/>';
  }
  function deadTree() {
    return shadow(7) + '<path d="M0,0 L0,-20 M0,-12 L-7,-19 M0,-16 L6,-24 M0,-20 L-3,-27 M-7,-19 L-9,-23 M6,-24 L9,-25" stroke="#4a3426" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
  }
  function bush(c1, c2, flower) {
    return '<circle cx="-4" cy="-4" r="5" fill="' + c1 + '"/><circle cx="4" cy="-4.5" r="5.5" fill="' + c2 + '"/><circle cx="0" cy="-7.5" r="5" fill="' + c1 + '"/>' +
      (flower ? '<circle cx="-3" cy="-8" r="1.4" fill="' + flower + '"/><circle cx="3.5" cy="-6" r="1.4" fill="' + flower + '"/><circle cx="0" cy="-3" r="1.3" fill="' + flower + '"/>' : '');
  }
  function rock(c1, c2, s) {
    s = s || 1;
    return '<path d="M' + (-9 * s) + ',0 L' + (-7 * s) + ',' + (-7 * s) + ' L' + (-1 * s) + ',' + (-11 * s) + ' L' + (6 * s) + ',' + (-8 * s) + ' L' + (9 * s) + ',0 Z" fill="' + c1 + '"/>' +
      '<path d="M' + (-1 * s) + ',' + (-11 * s) + ' L' + (6 * s) + ',' + (-8 * s) + ' L' + (9 * s) + ',0 L' + (1 * s) + ',0 Z" fill="' + c2 + '"/>';
  }
  function sheep() {
    return shadow(7) + '<path d="M-4,0 v-4 M3,0 v-4" stroke="#3a2b20" stroke-width="1.4"/>' +
      '<ellipse cx="0" cy="-6.5" rx="7" ry="4.6" fill="#fbf8ef" stroke="#cfc6b0" stroke-width=".6"/>' +
      '<circle cx="-3" cy="-9" r="2.6" fill="#fbf8ef"/><circle cx="2.5" cy="-9.5" r="2.6" fill="#fbf8ef"/>' +
      '<ellipse cx="7" cy="-8" rx="2.4" ry="2.1" fill="#3a2b20"/>';
  }
  function horse(c) {
    return shadow(9) + '<path d="M-6,0 v-6 M-3,0 v-6 M4,0 v-6 M7,0 v-6" stroke="' + c + '" stroke-width="1.6"/>' +
      '<ellipse cx="0" cy="-8" rx="9" ry="4" fill="' + c + '"/><path d="M7,-9 L11,-16 L14,-15 L11,-8 Z" fill="' + c + '"/>' +
      '<path d="M-9,-8 q-3,2 -2,6" stroke="#2a1d14" stroke-width="1.5" fill="none"/><path d="M9,-14 l3,-2" stroke="#2a1d14" stroke-width="1.6"/>';
  }
  function flowers(cols) {
    let s = '';
    for (let i = 0; i < 5; i++) s += '<circle cx="' + f1(rand(-8, 8)) + '" cy="' + f1(rand(-5, 0)) + '" r="1.5" fill="' + pick(cols) + '"/>';
    return s;
  }
  function tuft(c) {
    return '<path d="M-4,0 q1,-5 -1,-8 M0,0 q0,-6 1,-10 M4,0 q-1,-5 2,-7" stroke="' + c + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
  }
  function reeds() {
    return '<path d="M-3,0 q-1,-8 -3,-13 M0,0 v-15 M3,0 q1,-8 4,-12" stroke="#6b7a4a" stroke-width="1.2" fill="none"/>' +
      '<ellipse cx="0" cy="-15" rx="1.2" ry="3" fill="#5a3d22"/>';
  }
  function mountainSVG(w, h, o) {
    const px = rand(-w * 0.08, w * 0.08);
    const fill = o.fill || '#c2ae8c', shade = o.shade || '#9c8664', line = o.line || '#6e5636';
    let s = '<path d="M' + f1(-w / 2) + ',0 L' + f1(px) + ',' + f1(-h) + ' L' + f1(w / 2) + ',0 Z" fill="' + fill + '"/>' +
      '<path d="M' + f1(px) + ',' + f1(-h) + ' L' + f1(w / 2) + ',0 L' + f1(px + w * 0.06) + ',0 Z" fill="' + shade + '"/>';
    if (o.snow) {
      const k = 0.32;
      const lx = px + (-w / 2 - px) * k, rx = px + (w / 2 - px) * k, yy = -h + h * k;
      s += '<path d="M' + f1(px) + ',' + f1(-h) + ' L' + f1(lx) + ',' + f1(yy) + ' L' + f1(lx + (px - lx) * 0.45) + ',' + f1(yy + h * 0.06) +
        ' L' + f1(px) + ',' + f1(yy - h * 0.02) + ' L' + f1(px + (rx - px) * 0.55) + ',' + f1(yy + h * 0.07) + ' L' + f1(rx) + ',' + f1(yy) + ' Z" fill="#fbfbff"/>';
    }
    s += '<path d="M' + f1(-w / 2) + ',0 L' + f1(px) + ',' + f1(-h) + ' L' + f1(w / 2) + ',0" fill="none" stroke="' + line + '" stroke-width="1.6" stroke-linejoin="round"/>';
    s += '<path d="M' + f1(px - w * 0.1) + ',' + f1(-h * 0.55) + ' l' + f1(w * 0.06) + ',' + f1(h * 0.12) + ' M' + f1(px - w * 0.2) + ',' + f1(-h * 0.25) + ' l' + f1(w * 0.07) + ',' + f1(h * 0.1) + '" stroke="' + line + '" stroke-width="1" opacity=".5"/>';
    return s;
  }
  function cloud() {
    return '<g opacity=".72"><ellipse cx="0" cy="0" rx="34" ry="11" fill="#fffdf6"/><ellipse cx="-14" cy="-7" rx="15" ry="10" fill="#fffdf6"/>' +
      '<ellipse cx="10" cy="-10" rx="18" ry="13" fill="#fffdf6"/><ellipse cx="0" cy="3" rx="30" ry="5" fill="#e8dcc4" opacity=".6"/></g>';
  }
  function birds() {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const x = rand(-16, 16), y = rand(-10, 4), k = rand(0.8, 1.2);
      s += '<path d="M' + f1(x - 5 * k) + ',' + f1(y) + ' q' + f1(2.5 * k) + ',' + f1(-3 * k) + ' ' + f1(5 * k) + ',0 q' + f1(2.5 * k) + ',' + f1(-3 * k) + ' ' + f1(5 * k) + ',0" stroke="#3b2a1c" stroke-width="1.3" fill="none"/>';
    }
    return s;
  }

  /* ---------- landmarks ---------- */
  function hobbitHole(doorColor, big) {
    const k = big ? 1 : 0.62;
    return '<path d="M' + -60 * k + ',0 Q' + -50 * k + ',' + -52 * k + ' 0,' + -56 * k + ' Q' + 50 * k + ',' + -52 * k + ' ' + 60 * k + ',0 Z" fill="#88b45e" stroke="#5c7f3a" stroke-width="1.4"/>' +
      '<path d="M' + -40 * k + ',' + -42 * k + ' q8,-4 16,-2 M' + 10 * k + ',' + -48 * k + ' q8,-3 14,0" stroke="#5c7f3a" stroke-width="1.2" fill="none"/>' +
      '<circle cx="0" cy="' + -17 * k + '" r="' + 15 * k + '" fill="#7a5a36"/>' +
      '<g class="door"><circle cx="0" cy="' + -17 * k + '" r="' + 12.5 * k + '" fill="' + doorColor + '" stroke="#2a2a1a" stroke-width="1"/>' +
      '<circle cx="0" cy="' + -17 * k + '" r="' + 2.2 * k + '" fill="#f1c84b"/></g>' +
      '<circle cx="' + -30 * k + '" cy="' + -20 * k + '" r="' + 6 * k + '" fill="#f6e3a1" stroke="#7a5a36" stroke-width="2"/>' +
      '<circle cx="' + 30 * k + '" cy="' + -20 * k + '" r="' + 6 * k + '" fill="#f6e3a1" stroke="#7a5a36" stroke-width="2"/>' +
      '<path d="M' + -40 * k + ',0 h' + 80 * k + '" stroke="#6e8f44" stroke-width="2"/>';
  }
  function chimney(x, y) {
    return '<rect x="' + (x - 3) + '" y="' + (y - 10) + '" width="6" height="10" fill="#8b6b4a" stroke="#5a412a" stroke-width=".8"/>' +
      '<g class="smoke">' + [0, 1, 2].map((i) => '<circle class="puff" style="animation-delay:' + (i * 1.3) + 's" cx="' + x + '" cy="' + (y - 12) + '" r="3.4" fill="#e9e3d6"/>').join('') + '</g>';
  }
  function house(w, h, wall, roof) {
    return shadow(w / 2) + '<rect x="' + -w / 2 + '" y="' + -h + '" width="' + w + '" height="' + h + '" fill="' + wall + '" stroke="#5a412a" stroke-width="1"/>' +
      '<path d="M' + (-w / 2 - 4) + ',' + -h + ' L0,' + (-h - w * 0.55) + ' L' + (w / 2 + 4) + ',' + -h + ' Z" fill="' + roof + '" stroke="#4a3220" stroke-width="1"/>' +
      '<rect x="-3" y="-9" width="6" height="9" fill="#5a3a22"/>' +
      '<rect x="' + (-w / 2 + 3) + '" y="' + (-h + 4) + '" width="5" height="5" fill="#f6dd8a" stroke="#5a412a" stroke-width=".6"/>' +
      '<rect x="' + (w / 2 - 8) + '" y="' + (-h + 4) + '" width="5" height="5" fill="#f6dd8a" stroke="#5a412a" stroke-width=".6"/>';
  }
  function elfHouse(w, h) {
    return shadow(w / 2) + '<path d="M' + -w / 2 + ',0 V' + -h + ' Q0,' + (-h - w * 0.8) + ' ' + w / 2 + ',' + -h + ' V0 Z" fill="#f4efe2" stroke="#9b8f6f" stroke-width="1"/>' +
      '<path d="M' + (-w / 2 + 3) + ',0 V' + (-h + 2) + ' M' + (w / 2 - 3) + ',0 V' + (-h + 2) + '" stroke="#c8bfa4" stroke-width="1.2"/>' +
      '<path d="M-4,0 V-10 Q0,-15 4,-10 V0 Z" fill="#7a8fa8"/>' +
      '<path d="M' + (-w / 2 - 2) + ',' + -h + ' Q0,' + (-h - w * 0.95) + ' ' + (w / 2 + 2) + ',' + -h + '" stroke="#5f8f6f" stroke-width="2.4" fill="none"/>';
  }
  function tower(w, h, wall, roofCol, glow) {
    let crenel = '';
    for (let i = 0; i < 4; i++) crenel += '<rect x="' + (-w / 2 + i * (w / 3.5)) + '" y="' + (-h - 5) + '" width="' + (w / 7) + '" height="5" fill="' + wall + '"/>';
    return shadow(w / 1.6) + '<path d="M' + (-w / 2 - 3) + ',0 L' + -w / 2 + ',' + -h + ' L' + w / 2 + ',' + -h + ' L' + (w / 2 + 3) + ',0 Z" fill="' + wall + '" stroke="rgba(0,0,0,.35)" stroke-width="1"/>' + crenel +
      (roofCol ? '<path d="M' + (-w / 2 - 2) + ',' + -h + ' L0,' + (-h - w) + ' L' + (w / 2 + 2) + ',' + -h + ' Z" fill="' + roofCol + '"/>' : '') +
      '<rect x="-2" y="' + (-h * 0.62) + '" width="4" height="7" fill="' + (glow || '#2a1f18') + '"/>' +
      '<rect x="-2" y="' + (-h * 0.32) + '" width="4" height="7" fill="' + (glow || '#2a1f18') + '"/>';
  }

  /* ---------- dress the board for one game ---------- */
  function dress(geo, opts) {
    opts = opts || {};
    const nodes = geo.nodes;
    const season = SEASONS[pick(Object.keys(SEASONS))];
    const time = TIMES[pick(Object.keys(TIMES))];

    // Which spaces turn over a card this game: about 40% of the ordinary spaces.
    const eligible = nodes.filter((n) => (n.kind === 'path' || n.kind === 'landmark') && !n.rest);
    eligible.forEach((n) => { n.card = false; });
    const order = eligible.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    order.slice(0, Math.round(eligible.length * (opts.cardShare == null ? 0.4 : opts.cardShare))).forEach((n) => { n.card = true; });

    // Everything is placed away from the road and from the landmark drawings.
    const roadPts = [];
    geo.roads.forEach((r) => r.pts.forEach((p, i) => { if (i % 2 === 0) roadPts.push([p[0], p[1], r.id]); }));
    const reserved = [];
    const reserve = (x, y, r) => reserved.push([x, y, r]);
    const nearRoad = (x, y, r, ignore) => roadPts.some((p) => p[2] !== ignore && Math.abs(p[0] - x) < r && Math.abs(p[1] - y) < r && Math.hypot(p[0] - x, p[1] - y) < r);
    const nearReserved = (x, y, pad) => reserved.some((q) => Math.hypot(q[0] - x, q[1] - y) < q[2] + (pad || 0));

    const items = [];   // [y, svg] drawn in order of y so nearer things overlap further ones
    const put = (y, svg) => items.push([y, svg]);
    function scatter(zone, count, gap, draw, opt) {
      opt = opt || {};
      const placed = [];
      let tries = 0;
      while (placed.length < count && tries < count * 30) {
        tries++;
        const x = rand(zone[0], zone[2]), y = rand(zone[1], zone[3]);
        if (opt.inside && !opt.inside(x, y)) continue;
        if (nearRoad(x, y, opt.road || 30, opt.ignore)) continue;
        if (!opt.overlapOK && nearReserved(x, y, 6)) continue;
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < gap)) continue;
        placed.push([x, y]);
        put(y, draw(x, y));
      }
    }
    function range(points, step, size, opt) {
      // a chain of mountains along a line
      for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay] = points[i], [bx, by] = points[i + 1];
        const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
        for (let k = 0; k <= n; k++) {
          if (i > 0 && k === 0) continue;
          const t = k / n;
          const x = ax + (bx - ax) * t + rand(-8, 8), y = ay + (by - ay) * t + rand(-6, 6);
          const w = rand(size[0], size[1]), h = w * rand(0.62, 0.85);
          if (nearRoad(x, y - h * 0.35, w * 0.42 + 8, opt.ignore)) continue;
          if (nearReserved(x, y - h * 0.4, 4)) continue;
          put(y, wrap(x, y, 1, 'mtn', mountainSVG(w, h, opt)));
        }
      }
    }

    /* ---- landmarks (fixed places, some react when a hobbit goes by) ---- */
    const L = [];   // drawn after scenery, in order of y as well
    // land(x, y, svg) or land(y, svg): y decides the drawing order
    const land = (a, b, c) => (c === undefined ? L.push([a, b]) : L.push([b, c]));
    const rx = (type, x, y, r) => ' data-rx="' + type + '" data-x="' + x + '" data-y="' + y + '" data-r="' + (r || 110) + '"';

    // Bag End
    land(58, 150, wrap(58, 150, 1, 'rx rx-door', hobbitHole(pick(['#3f7d3a', '#2f6b48', '#3b6f2c'])) + chimney(30, 104), rx('door', 58, 140, 120)));
    reserve(58, 125, 62);
    // a couple of neighbours' holes
    land(205, 60, wrap(205, 60, 1, 'rx rx-door', hobbitHole(pick(['#c8433a', '#d49a22', '#3c6fb0'])), rx('door', 205, 50, 90)) + '');
    reserve(205, 45, 40);
    // Farmer Maggot's field and mushrooms
    (function () {
      let rows = '';
      for (let i = 0; i < 5; i++) rows += '<path d="M-38,' + (i * 7) + ' L38,' + (i * 7 - 4) + '" stroke="#7a5a2c" stroke-width="2.4" stroke-dasharray="4 3"/>';
      let shrooms = '';
      for (let i = 0; i < 4; i++) shrooms += '<g transform="translate(' + (44 + i * 9) + ',' + (14 + (i % 2) * 6) + ')"><rect x="-1" y="-5" width="2.2" height="5" fill="#f3ead6"/><path d="M-4.5,-4.5 Q0,-10 4.5,-4.5 Z" fill="#c9773b"/></g>';
      land(335, 335, '<g transform="translate(335,322)"><path d="M-44,-6 L42,-12 L46,32 L-40,36 Z" fill="#c9a86a" opacity=".6"/>' + rows + shrooms + '</g>');
      land(318, 250, wrap(318, 252, 1, '', house(26, 16, '#e9dcc0', '#9a6a3a')));
      reserve(335, 335, 40); reserve(318, 240, 20);
    })();
    // Old Man Willow in the Old Forest
    land(470, 430, wrap(470, 430, 1.3, 'rx rx-tree', shadow(14) + '<path d="M-3,0 Q-5,-14 0,-24 Q5,-14 3,0 Z" fill="#6b4a2b"/>' +
      '<path d="M0,-24 Q-22,-30 -24,-4 M0,-24 Q-14,-34 -14,-6 M0,-24 Q4,-36 6,-6 M0,-24 Q18,-34 22,-4 M0,-24 Q24,-26 28,-8" stroke="#6f8f4a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="0" cy="-28" rx="18" ry="9" fill="#7f9f55"/>', rx('tree', 470, 420, 120)));
    reserve(470, 405, 34);
    // Barrow-downs
    land(410, 560, '<g transform="translate(400,560)">' + [[0, 0, 26], [44, 8, 20], [-30, 12, 16]].map((m) =>
      '<path d="M' + (m[0] - m[2]) + ',' + m[1] + ' Q' + m[0] + ',' + (m[1] - m[2] * 1.1) + ' ' + (m[0] + m[2]) + ',' + m[1] + ' Z" fill="#a9b07a" stroke="#6f7444" stroke-width="1.2"/>' +
      '<rect x="' + (m[0] - 2) + '" y="' + (m[1] - m[2] * 0.9) + '" width="4" height="9" fill="#9a958a"/>').join('') + '</g>');
    reserve(405, 548, 46);
    // Buckleberry Ferry raft and Brandy Hall
    land(462, 312, wrap(462, 312, 1, 'rx rx-bob', '<path d="M-20,-2 L20,-6 L22,2 L-18,6 Z" fill="#a8774a" stroke="#5a3d22" stroke-width="1.2"/><path d="M-12,-2 v6 M-2,-3 v6 M8,-4 v6" stroke="#5a3d22" stroke-width="1"/>', rx('bob', 462, 300, 90)));
    // Bree
    land(548, 214, wrap(548, 214, 1, '', house(30, 20, '#e2cfa6', '#7d4a2a')));
    land(592, 196, wrap(592, 196, 1, '', house(24, 16, '#d8c49b', '#8a5634')));
    land(520, 190, wrap(530, 186, 1, 'rx rx-sign', '<path d="M0,0 V-26 H14" stroke="#4a3220" stroke-width="2" fill="none"/><g class="swing"><path d="M8,-26 v4 M18,-26 v4" stroke="#4a3220" stroke-width="1"/><rect x="4" y="-22" width="18" height="11" rx="2" fill="#f2e3b9" stroke="#4a3220" stroke-width="1"/><circle cx="13" cy="-16.5" r="3.2" fill="#f7f2e6" stroke="#4a3220" stroke-width=".8"/></g>', rx('sign', 540, 190, 110)));
    reserve(558, 200, 42);
    // Weathertop: a tall hill with a broken ring of stones and a fire
    land(820, 210, '<g transform="translate(820,214)"><path d="M-120,0 C-90,-14 -70,-70 -20,-92 C0,-100 20,-100 40,-90 C80,-66 96,-16 120,0 Z" fill="#b9a97c" stroke="#7a6640" stroke-width="1.6"/>' +
      '<path d="M40,-90 C80,-66 96,-16 120,0 L60,0 C70,-30 60,-70 30,-94 Z" fill="#9d8c62" opacity=".6"/></g>');
    land(800, 118, wrap(800, 120, 1, '', '<rect x="-34" y="-12" width="6" height="14" fill="#a39d8f"/><rect x="-22" y="-18" width="6" height="18" fill="#b0aa9b"/><rect x="34" y="-14" width="6" height="14" fill="#a39d8f"/><rect x="46" y="-8" width="5" height="8" fill="#b0aa9b"/>'));
    land(866, 108, wrap(866, 108, 1, 'rx rx-fire', '<path d="M-6,0 L6,0" stroke="#5a3d22" stroke-width="2.4"/><g class="flame"><path d="M-5,-1 Q-6,-9 0,-16 Q6,-9 5,-1 Z" fill="#f08a24"/><path d="M-2.5,-1 Q-3,-6 0,-10 Q3,-6 2.5,-1 Z" fill="#ffd34d"/></g>', rx('fire', 866, 100, 110)));
    // The stone trolls
    land(930, 262, '<g>' + [[858, 262, 1], [884, 272, 1.15], [910, 258, 0.95]].map((t) => wrap(t[0], t[1], t[2], 'rx rx-troll',
      shadow(10) + '<path d="M-9,0 L-10,-16 Q-12,-26 -4,-30 Q2,-34 7,-28 Q12,-22 9,-14 L10,0 Z" fill="#9a958a" stroke="#6b665c" stroke-width="1"/>' +
      '<circle cx="-2" cy="-24" r="1.3" fill="#4a463e"/><circle cx="3" cy="-24" r="1.3" fill="#4a463e"/><path d="M-3,-19 q3,2 6,0" stroke="#4a463e" stroke-width="1" fill="none"/>', rx('troll', t[0], t[1] - 14, 120))).join('') + '</g>');
    reserve(884, 250, 46);
    // Rivendell: elven houses and a waterfall
    land(1096, 150, '<g transform="translate(1096,60)"><path d="M-6,0 Q-8,40 -4,92 L6,92 Q8,40 6,0 Z" fill="#9fd0ec"/>' +
      '<path class="flow" d="M0,0 V92" stroke="#e8f6ff" stroke-width="3" stroke-dasharray="6 7" fill="none"/><ellipse cx="0" cy="94" rx="16" ry="5" fill="#b6def2"/></g>');
    land(1024, 112, wrap(1024, 112, 1, 'rx rx-sparkle', elfHouse(22, 18) + '<g class="glints"><circle cx="-14" cy="-30" r="2" fill="#fff6c4"/><circle cx="12" cy="-38" r="1.6" fill="#fff6c4"/><circle cx="2" cy="-46" r="1.8" fill="#fff6c4"/></g>', rx('sparkle', 1030, 105, 120)));
    land(1062, 96, wrap(1062, 96, 1, '', elfHouse(18, 24)));
    land(1000, 92, wrap(1000, 92, 0.8, '', elfHouse(18, 16)));
    reserve(1040, 90, 44); reserve(1096, 110, 26);
    // Doors of Durin, on a cliff, with the dark pool and its watcher
    land(938, 320, '<g transform="translate(938,322)"><path d="M-36,0 L-30,-58 L-6,-74 L22,-66 L34,-40 L36,0 Z" fill="#8f8a80" stroke="#5f5a50" stroke-width="1.4"/>' +
      '<path d="M22,-66 L34,-40 L36,0 L18,0 Z" fill="#77726a"/></g>');
    land(939, 322, wrap(938, 318, 1, 'rx rx-glow', '<path d="M-13,0 V-24 Q0,-42 13,-24 V0" fill="#3b3a3f"/>' +
      '<path class="glow" d="M-13,0 V-24 Q0,-42 13,-24 V0 M-9,-26 L9,-26 M0,-34 l-3,6 h6 Z M-10,-6 v-14 M10,-6 v-14" stroke="#cfe7ff" stroke-width="1.4" fill="none"/>', rx('glow', 938, 300, 120)));
    land(962, 392, '<ellipse cx="962" cy="392" rx="40" ry="14" fill="#36505e" stroke="#26363f" stroke-width="1.4"/><ellipse cx="955" cy="390" rx="28" ry="8" fill="#46687a" opacity=".6"/>');
    land(980, 394, wrap(980, 394, 1, 'rx rx-tentacle', '<path class="tent" d="M0,0 Q-6,-10 0,-18 Q6,-26 0,-32" stroke="#4d6b3a" stroke-width="4" fill="none" stroke-linecap="round"/>', rx('tentacle', 975, 380, 110)));
    reserve(938, 290, 44); reserve(962, 392, 44);
    // Caradhras, the big snowy peak the long road climbs over
    land(1160, 250, wrap(1160, 250, 1, 'rx rx-snow', mountainSVG(230, 190, { snow: true, fill: '#c8bba3', shade: '#a4957a' }) +
      '<g class="flurry">' + [-30, -10, 12, 30, 0].map((x, i) => '<circle cx="' + x + '" cy="' + (-120 + i * 8) + '" r="3" fill="#fff"/>').join('') + '</g>', rx('snow', 1160, 170, 120)));
    reserve(1160, 160, 96);
    // A fire deep in Moria (glimpsed under the mountains)
    land(1132, 408, wrap(1132, 408, 1, 'rx rx-fire', '<g class="flame" opacity=".85"><ellipse cx="0" cy="-6" rx="10" ry="7" fill="#d9481f" opacity=".5"/><path d="M-5,0 Q-6,-9 0,-15 Q6,-9 5,0 Z" fill="#f08a24"/></g>', rx('fire', 1132, 400, 90)));
    // Lothlórien glow
    land(1300, 470, '<ellipse cx="1290" cy="450" rx="110" ry="80" fill="#f7d774" opacity=".18"/>');
    land(1335, 468, wrap(1335, 468, 1, 'rx rx-sparkle', '<g class="glints">' + [[-20, -60], [6, -78], [24, -52], [-4, -40], [14, -66]].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.2" fill="#fff6c4"/>').join('') + '</g>', rx('sparkle', 1290, 450, 130)));
    // Amon Hen hill with its seat, and the falls of Rauros
    land(1100, 560, '<g transform="translate(1100,560)"><path d="M-46,0 Q-26,-40 0,-44 Q26,-40 46,0 Z" fill="#a6b07a" stroke="#6f7444" stroke-width="1.4"/>' +
      '<rect x="-7" y="-52" width="14" height="10" fill="#bdb6a6" stroke="#6b665c"/><rect x="-9" y="-44" width="18" height="3" fill="#a8a192"/></g>');
    reserve(1100, 535, 34);
    land(1192, 662, wrap(1192, 660, 1, 'rx rx-splash', '<path d="M-14,-18 H14 L12,6 H-12 Z" fill="#cfeaf8"/><path class="flow" d="M-8,-18 V6 M0,-18 V6 M8,-18 V6" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>' +
      '<g class="spray"><circle cx="-10" cy="6" r="3" fill="#fff"/><circle cx="0" cy="8" r="3.6" fill="#fff"/><circle cx="10" cy="6" r="3" fill="#fff"/></g>', rx('splash', 1192, 650, 120)));
    reserve(1192, 650, 26);
    // Dead Marshes pools and lights
    (function () {
      const pools = [[770, 846, 30, 9], [840, 832, 22, 7], [724, 790, 26, 8], [858, 790, 18, 6], [760, 752, 20, 6]];
      pools.forEach((p) => { if (!nearRoad(p[0], p[1], 26)) land(p[1] - 5, '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + p[2] + '" ry="' + p[3] + '" fill="#6f7f62" stroke="#4f5a44" stroke-width="1"/>'); });
      land(820, wrap(0, 0, 1, 'rx rx-lights', [[770, 842], [842, 828], [726, 786], [760, 748], [858, 786]].map((p, i) =>
        '<circle class="marsh-light" style="animation-delay:' + (i * 0.7) + 's" cx="' + p[0] + '" cy="' + (p[1] - 6) + '" r="3.2" fill="#d6ffb8"/>').join(''), rx('lights', 790, 800, 140)));
    })();
    // Oliphaunt in Ithilien
    land(1148, 772, wrap(1148, 772, 1, 'rx rx-trunk', shadow(20) +
      '<path d="M-16,0 v-12 M-8,0 v-12 M8,0 v-12 M15,0 v-12" stroke="#8d8579" stroke-width="5"/>' +
      '<ellipse cx="0" cy="-20" rx="21" ry="13" fill="#9a9286"/><circle cx="20" cy="-24" r="9" fill="#9a9286"/>' +
      '<path d="M18,-28 L-6,-36 L-4,-30 Z" fill="#c7313a"/>' +
      '<g class="swing"><path d="M27,-22 Q32,-10 26,-2" stroke="#9a9286" stroke-width="4" fill="none" stroke-linecap="round"/></g>' +
      '<path d="M23,-18 q6,2 10,-2" stroke="#fffbe8" stroke-width="2" fill="none"/><circle cx="21" cy="-27" r="1.3" fill="#2a2420"/>', rx('trunk', 1148, 758, 120)));
    reserve(1148, 752, 30);
    // Mordor: a dark land walled by mountains
    land(540, '<path d="M1318,548 Q1420,532 1600,536 L1600,920 L1312,920 Q1300,760 1318,548 Z" fill="#4a332b" opacity=".85"/>' +
      '<path d="M1340,580 Q1460,560 1600,566 L1600,920 L1336,920 Z" fill="#5a3a2c" opacity=".55"/>');
    // Minas Morgul
    land(1214, 772, wrap(1214, 772, 1, 'rx rx-glow', tower(16, 58, '#8a8f86', '#6f746b', '#7dff9c') +
      '<ellipse class="glow" cx="0" cy="-60" rx="14" ry="22" fill="#7dff9c" opacity=".25"/>', rx('glow', 1214, 740, 120)));
    reserve(1214, 740, 26);
    // Cirith Ungol tower and Shelob
    land(1296, 648, wrap(1296, 648, 1, '', tower(14, 44, '#6e665e', null, '#ffb25a')));
    reserve(1296, 625, 22);
    land(1392, 716, wrap(1392, 724, 1, 'rx rx-spider', '<path d="M-22,-48 L22,-10 M22,-48 L-22,-10 M0,-52 V-6 M-24,-29 H24" stroke="#e8e2d6" stroke-width=".8" opacity=".75"/>' +
      '<path d="M-14,-29 Q0,-40 14,-29 Q0,-18 -14,-29" stroke="#e8e2d6" stroke-width=".8" fill="none" opacity=".75"/>' +
      '<g class="spider"><path d="M0,-52 V-34" stroke="#e8e2d6" stroke-width=".8"/><ellipse cx="0" cy="-29" rx="5" ry="6" fill="#2a1e1a"/>' +
      '<path d="M-4,-30 l-7,-5 M-4,-27 l-8,1 M-4,-25 l-6,5 M4,-30 l7,-5 M4,-27 l8,1 M4,-25 l6,5" stroke="#2a1e1a" stroke-width="1.4"/>' +
      '<circle cx="-1.6" cy="-26" r=".9" fill="#ff5a3c"/><circle cx="1.6" cy="-26" r=".9" fill="#ff5a3c"/></g>', rx('spider', 1392, 700, 110)));
    reserve(1392, 696, 26);
    // Barad-dûr and the Eye
    land(600, wrap(1566, 604, 1, '', '<path d="M-20,0 L-13,-110 L-6,-118 L-4,-150 L4,-150 L6,-118 L13,-110 L20,0 Z" fill="#2c2420" stroke="#120d0b" stroke-width="1.2"/>' +
      '<path d="M-4,-150 L-12,-170 M4,-150 L12,-170" stroke="#2c2420" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="-2" y="-90" width="4" height="6" fill="#ff7a2a"/><rect x="-2" y="-56" width="4" height="6" fill="#ff7a2a"/>'));
    land(601, '<g id="eye" transform="translate(1566,442)"><ellipse class="eye-glow" cx="0" cy="0" rx="26" ry="14" fill="#ff8a2a" opacity=".35"/>' +
      '<path d="M-20,0 Q0,-14 20,0 Q0,14 -20,0 Z" fill="#ffb02e" stroke="#c43c12" stroke-width="1.5"/>' +
      '<g id="eye-pupil"><ellipse cx="0" cy="0" rx="2.6" ry="9" fill="#1a0a05"/></g></g>');
    reserve(1566, 520, 36); reserve(1566, 450, 30);
    // Black Gate
    land(560, wrap(1340, 566, 1, '', tower(12, 34, '#3a302a', null, '#ff7a2a') + '<rect x="8" y="-22" width="26" height="22" fill="#2a221d" stroke="#120d0b"/><path d="M8,-11 h26 M21,-22 v22" stroke="#4a3d33" stroke-width="1"/>' +
      '<g transform="translate(42,0)">' + tower(12, 34, '#3a302a', null, '#ff7a2a') + '</g>'));
    reserve(1360, 550, 34);
    // Mount Doom
    land(880, wrap(1480, 880, 1, 'rx rx-lava', '<path d="M-118,0 Q-60,-50 -26,-96 L26,-96 Q60,-50 118,0 Z" fill="#3a2a24" stroke="#1d1411" stroke-width="1.6"/>' +
      '<path d="M26,-96 Q60,-50 118,0 L40,0 Q30,-50 12,-96 Z" fill="#2c1f1b"/>' +
      '<path d="M-10,-96 Q-16,-60 -36,-30 Q-44,-14 -40,0" stroke="#e8541c" stroke-width="5" fill="none" opacity=".9"/>' +
      '<path d="M10,-96 Q20,-56 46,-26" stroke="#e8541c" stroke-width="4" fill="none" opacity=".8"/>' +
      '<ellipse class="doom-glow" cx="0" cy="-100" rx="40" ry="16" fill="#ff6a1a" opacity=".5"/>' +
      '<g class="sparks">' + [-16, -6, 4, 14].map((x, i) => '<circle cx="' + x + '" cy="' + (-100 - i % 2 * 4) + '" r="2.4" fill="#ffd34d"/>').join('') + '</g>', rx('lava', 1480, 780, 150)));
    // smoke above Mount Doom
    land(700, '<g>' + [0, 1, 2, 3].map((i) => '<circle class="doom-smoke" style="animation-delay:' + (i * 1.6) + 's" cx="' + (1480 + i * 3) + '" cy="740" r="14" fill="#5c514c"/>').join('') + '</g>');
    reserve(1480, 820, 70);
    // Isengard
    land(690, 570, wrap(690, 570, 1, '', '<ellipse cx="0" cy="-4" rx="34" ry="12" fill="none" stroke="#6f6a60" stroke-width="4"/>' +
      '<path d="M-6,-4 L-5,-58 L-9,-70 L-2,-64 L0,-74 L2,-64 L9,-70 L5,-58 L6,-4 Z" fill="#2e2b2a" stroke="#111" stroke-width="1"/>'));
    reserve(690, 540, 40);
    // Edoras
    land(784, 470, wrap(784, 470, 1, '', '<path d="M-44,0 Q-20,-34 0,-36 Q20,-34 44,0 Z" fill="#b7bf74" stroke="#7e8546" stroke-width="1.4"/>' +
      '<path d="M-14,-34 L-14,-44 L0,-54 L14,-44 L14,-34 Z" fill="#d9a83a" stroke="#7a5a1a" stroke-width="1"/><path d="M-14,-44 L0,-54 L14,-44" stroke="#f6e08a" stroke-width="1.6" fill="none"/>' +
      '<path d="M0,-54 v-10" stroke="#5a3d22" stroke-width="1"/><path class="flag" d="M0,-64 h9 l-2,3 l2,3 h-9 Z" fill="#2e9657"/>'));
    reserve(784, 440, 44);
    // The Lonely Mountain far to the north-east
    land(150, wrap(1500, 150, 1, 'mtn', mountainSVG(200, 120, { fill: '#b9a98c', shade: '#978566' })));
    reserve(1500, 100, 80);

    /* ---- mountain ranges ---- */
    range([[1108, 40], [1132, 120], [1196, 290], [1186, 360], [1208, 470], [1176, 560]], 34, [52, 84], { snow: true, fill: '#c8bba3', shade: '#a4957a', ignore: 'moria' });
    range([[612, 640], [700, 628], [800, 618], [880, 610]], 34, [44, 66], { snow: true, fill: '#c9bea6', shade: '#a99a7e' });
    range([[1326, 562], [1420, 548], [1520, 546]], 30, [40, 60], { fill: '#4a3b34', shade: '#2f2521', line: '#1a1210' });
    range([[1312, 600], [1302, 700], [1306, 800], [1300, 910]], 30, [40, 58], { fill: '#4a3b34', shade: '#2f2521', line: '#1a1210' });

    /* ---- scenery that moves around from game to game ---- */
    // Only a dozen trees sway all the time, to keep the board light on tablets.
    let ambLeft = 12;
    const amb = () => (ambLeft > 0 && Math.random() < 0.3 ? (ambLeft--, ' amb') : '');
    const L1 = season.leaves;
    // The Shire
    scatter([24, 40, 440, 380], 22, 26, (x, y) => wrap(x, y, rand(0.8, 1.1), 'rx rx-tree' + amb(),
      season.extra && Math.random() < 0.4 ? roundTree(season.extra, pick(L1)) : roundTree(pick(L1), pick(L1)), rx('tree', f1(x), f1(y - 16), 70)), { road: 30 });
    scatter([24, 60, 440, 380], 10, 22, (x, y) => wrap(x, y, 1, '', bush(pick(L1), pick(L1), pick(season.flowers))), { road: 24 });
    scatter([24, 60, 440, 380], 14, 14, (x, y) => wrap(x, y, 1, '', flowers(season.flowers)), { road: 22 });
    scatter([140, 200, 440, 380], irand(4, 7), 18, (x, y) => wrap(x, y, 1, 'rx rx-hop' + (Math.random() < 0.5 ? ' flip' : ''), sheep(), rx('hop', f1(x), f1(y - 6), 80)), { road: 28 });
    // Old Forest (inside the long loop) and the edge of it
    scatter([300, 330, 580, 560], 26, 22, (x, y) => wrap(x, y, rand(0.85, 1.15), 'rx rx-tree' + amb(), roundTree(pick(['#4f7a37', '#3f6b2e', '#5a8a40']), pick(['#3a5e28', '#46703a'])), rx('tree', f1(x), f1(y - 16), 70)), { road: 28 });
    // Bree-land and the Lone-lands
    scatter([560, 60, 990, 330], 16, 34, (x, y) => wrap(x, y, rand(0.8, 1.05), 'rx rx-tree', roundTree(pick(['#7aa252', '#6a9446']), pick(['#5d8a3e', '#86ad5c'])), rx('tree', f1(x), f1(y - 16), 70)), { road: 30 });
    scatter([560, 40, 990, 330], 10, 24, (x, y) => wrap(x, y, rand(0.8, 1.2), '', rock('#b9b1a0', '#9b9282')), { road: 26 });
    scatter([560, 40, 990, 330], 12, 20, (x, y) => wrap(x, y, 1, '', tuft('#7a8a4a')), { road: 22 });
    // Rivendell pines
    scatter([970, 40, 1120, 250], 12, 20, (x, y) => wrap(x, y, rand(0.8, 1.1), 'rx rx-tree', pine('#3f6b4a', '#2f5538'), rx('tree', f1(x), f1(y - 16), 70)), { road: 28 });
    // Rohan grass, horses, Fangorn
    scatter([600, 330, 960, 600], 22, 22, (x, y) => wrap(x, y, 1, '', tuft(pick(['#8a9a4a', '#a3a356']))), { road: 24 });
    scatter([620, 340, 860, 600], irand(3, 5), 30, (x, y) => wrap(x, y, 1, 'rx rx-hop' + (Math.random() < 0.5 ? ' flip' : ''), horse(pick(['#7a4a2a', '#5a3a22', '#c9b48a', '#3a2a20'])), rx('hop', f1(x), f1(y - 8), 90)), { road: 30 });
    scatter([850, 380, 1000, 560], 18, 18, (x, y) => wrap(x, y, rand(0.9, 1.2), 'rx rx-tree' + amb(), roundTree(pick(['#3f6b2e', '#335a26', '#4a7a36']), pick(['#2c4f20', '#3a6230'])), rx('tree', f1(x), f1(y - 16), 70)), { road: 30 });
    // Lothlórien
    scatter([1190, 330, 1340, 560], 13, 26, (x, y) => wrap(x, y, rand(0.9, 1.15), 'rx rx-tree' + amb(), mallorn(), rx('tree', f1(x), f1(y - 20), 80)), { road: 30 });
    // Mirkwood and the lands by the river
    scatter([1390, 180, 1590, 420], 30, 22, (x, y) => wrap(x, y, rand(0.9, 1.15), 'rx rx-tree', pick([roundTree('#2f4a2a', '#253d22'), pine('#2b4430', '#1f3524')]), rx('tree', f1(x), f1(y - 16), 70)), { road: 30 });
    // Emyn Muil rocks
    scatter([870, 580, 1080, 720], 16, 18, (x, y) => wrap(x, y, rand(0.9, 1.6), '', rock('#a7a297', '#857f72')), { road: 26 });
    // Dead Marshes reeds
    scatter([690, 720, 920, 910], 16, 16, (x, y) => wrap(x, y, 1, '', reeds()), { road: 24 });
    scatter([690, 720, 920, 910], 4, 40, (x, y) => wrap(x, y, 1, '', deadTree()), { road: 26 });
    // Ithilien woods
    scatter([960, 760, 1240, 912], 12, 24, (x, y) => wrap(x, y, rand(0.85, 1.05), 'rx rx-tree' + amb(), roundTree(pick(['#5f9a3f', '#4f8a36', '#6fa94a']), pick(['#3f7a2e', '#5a8f40'])), rx('tree', f1(x), f1(y - 16), 70)), { road: 30 });
    // Mordor rocks and dead trees
    scatter([1340, 600, 1590, 905], 14, 24, (x, y) => wrap(x, y, rand(0.8, 1.3), '', rock('#4c3d36', '#33281f')), { road: 26, inside: (x, y) => !(Math.hypot(x - 1480, y - 840) < 110) });
    scatter([1340, 600, 1590, 905], 5, 40, (x, y) => wrap(x, y, 1, '', deadTree()), { road: 26, inside: (x, y) => !(Math.hypot(x - 1480, y - 840) < 110) });
    // South-west hills and woods around the title
    scatter([420, 640, 700, 910], 10, 26, (x, y) => wrap(x, y, rand(0.85, 1.05), 'rx rx-tree', roundTree(pick(L1), pick(L1)), rx('tree', f1(x), f1(y - 16), 70)), { road: 30, inside: (x, y) => !(x < 600 && y > 760 && x > 520) });

    // clouds and birds drift above everything
    let sky = '';
    for (let i = 0; i < irand(4, 6); i++) {
      const x = rand(80, 1520), y = rand(40, 880), s = rand(0.7, 1.3);
      sky += '<g transform="translate(' + f1(x) + ',' + f1(y) + ') scale(' + s.toFixed(2) + ')"><g class="cloud" style="animation-duration:' + irand(50, 90) + 's;animation-delay:-' + irand(0, 40) + 's">' + cloud() + '</g></g>';
    }
    for (let i = 0; i < irand(2, 4); i++) {
      const x = rand(120, 1480), y = rand(60, 780);
      if (nearRoad(x, y, 30)) continue;
      sky += wrap(x, y, 1, 'rx rx-birds', birds(), rx('birds', f1(x), f1(y), 100));
    }

    // falling leaves (autumn) or petals (spring) drift down the whole map
    if (season.drift) {
      for (let i = 0; i < 16; i++) {
        const x = rand(0, 1600), y = rand(-40, 0), sway = rand(-90, 90);
        sky += '<ellipse class="drift" cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(rand(3, 5)) + '" ry="' + f1(rand(1.6, 2.6)) + '" fill="' + pick(season.drift) + '" style="--sway:' + f1(sway) + 'px;animation-duration:' + f1(rand(9, 16)) + 's;animation-delay:-' + f1(rand(0, 14)) + 's"/>';
      }
    }

    items.sort((a, b) => a[0] - b[0]);
    L.sort((a, b) => a[0] - b[0]);
    return { season, time, sceneryHTML: items.map((i) => i[1]).join(''), landmarkHTML: L.map((i) => i[1]).join(''), skyHTML: sky };
  }

  /* ---------- the parts of the map that are the same every game ---------- */
  function terrainHTML() {
    const river = (pts, w) => {
      const c = curve(pts, 0, pts.length - 1, 16);
      const d = pathD(c);
      return '<path d="' + d + '" stroke="#5f8fb0" stroke-width="' + (w + 3) + '" fill="none" stroke-linecap="round" opacity=".55"/>' +
        '<path d="' + d + '" stroke="#8fc0dc" stroke-width="' + w + '" fill="none" stroke-linecap="round"/>' +
        '<path class="flow" d="' + d + '" stroke="#e4f3fb" stroke-width="2" stroke-dasharray="10 18" fill="none" stroke-linecap="round" opacity=".8"/>';
    };
    return '' +
      // soft region colours
      '<g opacity=".5">' +
      '<ellipse cx="230" cy="220" rx="250" ry="190" fill="#a7c77a"/>' +
      '<ellipse cx="470" cy="440" rx="130" ry="110" fill="#7fa25a"/>' +
      '<ellipse cx="780" cy="470" rx="200" ry="140" fill="#cfd28c"/>' +
      '<ellipse cx="1490" cy="300" rx="130" ry="150" fill="#5f7a4a"/>' +
      '<ellipse cx="1100" cy="850" rx="170" ry="80" fill="#9fc07a"/>' +
      '<ellipse cx="800" cy="820" rx="130" ry="90" fill="#9a9a78"/>' +
      '<ellipse cx="970" cy="650" rx="120" ry="70" fill="#c2b9a2"/>' +
      '</g>' +
      // rivers: the Brandywine and the Anduin
      river([[486, -10], [470, 150], [462, 300], [440, 420], [418, 500], [430, 640], [470, 780], [500, 930]], 9) +
      river([[1352, -10], [1350, 180], [1344, 330], [1336, 470], [1290, 562], [1220, 622], [1192, 648], [1120, 712], [1062, 792], [1036, 930]], 11) +
      // Shire hills
      '<g fill="#9cc06c" stroke="#77984c" stroke-width="1.2" opacity=".85">' +
      '<path d="M150,290 Q190,250 230,290 Z"/><path d="M40,300 Q90,250 140,300 Z"/><path d="M300,120 Q340,84 380,120 Z"/><path d="M300,380 Q330,350 370,380 Z" />' +
      '</g>';
  }

  function cartoucheHTML() {
    return '<g class="cartouche" transform="translate(40,700)">' +
      '<path d="M10,0 H330 Q340,0 340,10 V150 Q340,160 330,160 H10 Q0,160 0,150 V10 Q0,0 10,0 Z" fill="#f3e6c4" stroke="#7a5a32" stroke-width="2.4"/>' +
      '<path d="M18,10 H322 Q330,10 330,18 V142 Q330,150 322,150 H18 Q10,150 10,142 V18 Q10,10 18,10 Z" fill="none" stroke="#a37a3e" stroke-width="1" stroke-dasharray="2 3"/>' +
      '<text x="170" y="66" text-anchor="middle" class="map-title">Hobbit Land</text>' +
      '<text x="170" y="98" text-anchor="middle" class="map-sub">From the Shire to Mount Doom</text>' +
      '<g transform="translate(170,126)"><circle r="11" fill="none" stroke="#d4a72c" stroke-width="4"/><circle r="11" fill="none" stroke="#fff3b0" stroke-width="1" opacity=".7"/></g>' +
      '</g>' +
      '<g class="compass" transform="translate(612,800)">' +
      '<circle r="34" fill="#f3e6c4" stroke="#7a5a32" stroke-width="1.6" opacity=".9"/>' +
      '<path d="M0,-30 L6,0 L0,30 L-6,0 Z" fill="#7a5a32"/><path d="M-30,0 L0,6 L30,0 L0,-6 Z" fill="#b08a52"/>' +
      '<path d="M0,-30 L6,0 L-6,0 Z" fill="#b23a2a"/>' +
      '<text y="-38" text-anchor="middle" class="map-label small">N</text></g>';
  }

  function labelsHTML(geo) {
    let s = '';
    geo.stops.forEach((st) => {
      const n = geo.stopNode[st.id];
      s += '<text class="map-label" x="' + f1(n.x + st.label[0]) + '" y="' + f1(n.y + st.label[1]) + '" text-anchor="' + (st.anchor || 'middle') + '">' + st.name + '</text>';
    });
    // places the short road skips keep their names on the map
    if (!geo.stops.some((st) => st.id === 'marshes')) s += '<text class="map-label region" x="790" y="836" text-anchor="middle">Dead Marshes</text>';
    if (!geo.stops.some((st) => st.id === 'emynmuil')) s += '<text class="map-label region" x="960" y="642" text-anchor="middle">Emyn Muil</text>';
    SHORTCUTS.forEach((sc) => {
      s += '<text class="map-label short" x="' + sc.label[0] + '" y="' + sc.label[1] + '" text-anchor="middle">' + sc.name + '</text>';
    });
    [['Old Forest', 470, 372], ['Barrow-downs', 410, 600], ['Caradhras', 1160, 62], ['Fangorn', 925, 556], ['Rohan', 700, 400], ['Isengard', 690, 594], ['Mirkwood', 1490, 170],
      ['Mordor', 1440, 600], ['Anduin', 1365, 250], ['The Shire', 160, 38], ['Barad-dûr', 1566, 640], ['Black Gate', 1360, 520], ['Misty Mountains', 1240, 30], ['Trollshaws', 884, 302]].forEach((l) => {
      s += '<text class="map-label region" x="' + l[1] + '" y="' + l[2] + '" text-anchor="middle">' + l[0] + '</text>';
    });
    return s;
  }

  function roadHTML(geo) {
    return geo.roads.map((r) => {
      if (r.id === 'moria') {
        return '<path d="' + r.d + '" class="road-edge tunnel" /><path d="' + r.d + '" class="road tunnel"/>';
      }
      return '<path d="' + r.d + '" class="road-edge' + (r.id === 'ferry' ? ' ferry' : '') + '"/><path d="' + r.d + '" class="road' + (r.id === 'ferry' ? ' ferry' : '') + '"/>';
    }).join('');
  }

  window.HL_BOARD = { W, H, STOPS, SHORTCUTS, build, dress, terrainHTML, cartoucheHTML, labelsHTML, roadHTML };
})();
