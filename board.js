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
  function stopsFor(length, MAP) {
    const list = STOPS.map((st) => Object.assign({}, st));
    const i = list.findIndex((st) => st.id === 'marshes');
    const ith = list.find((st) => st.id === 'ithilien');
    if (MAP === 'southern') {
      applyMap(list, MAP);
      if (length === 'short') {
        // Emyn Muil and the Dead Marshes are left out; the bottom of the map shifts right
        list.splice(list.indexOf(list.find((st) => st.id === 'marshes')), 1);
        list.splice(list.indexOf(list.find((st) => st.id === 'emynmuil')), 1);
        Object.assign(ith, { at: [1120, 720], n: 6, via: [[1330, 420], [1260, 560]], label: [34, -4], anchor: 'start' });
        Object.assign(list.find((st) => st.id === 'morgul'), { at: [1260, 840] });
        Object.assign(list.find((st) => st.id === 'ungol'), { at: [1380, 820] });
        Object.assign(list.find((st) => st.id === 'amonhen'), { label: [-28, 6], anchor: 'end' });
      } else if (length === 'long') {
        // from Emyn Muil the road runs west past Ithilien, loops round through the south-west and comes back to the Dead Marshes
        Object.assign(list.find((st) => st.id === 'marshes'), { at: [700, 860], n: 20, via: [[1360, 470], [1230, 580], [1080, 640], [930, 690], [780, 745], [620, 780], [500, 805], [420, 856], [480, 884]], label: [0, -34], anchor: 'middle' });
      }
      return list;
    }
    if (MAP === 'serpent') {
      // Serpent's own short and long roads, on top of its normal stops
      applyMap(list, MAP);
      const m = list.find((st) => st.id === 'marshes'), e = list.find((st) => st.id === 'emynmuil');
      if (length === 'short') {
        list.splice(list.indexOf(m), 1);
        list.splice(list.indexOf(e), 1);
        // the bottom of the map shifts right: Ithilien, Minas Morgul and Cirith Ungol move over
        Object.assign(ith, { at: [1040, 780], n: 6, via: [[1240, 540], [1120, 640]], label: [34, -4], anchor: 'start' });
        Object.assign(list.find((st) => st.id === 'morgul'), { at: [1130, 860] });
        Object.assign(list.find((st) => st.id === 'ungol'), { at: [1300, 770] });
        Object.assign(list.find((st) => st.id === 'amonhen'), { label: [-28, 6], anchor: 'end' });
      } else if (length === 'long') {
        // from Emyn Muil the road runs west past Ithilien, loops round and comes back to the Dead Marshes
        Object.assign(m, { at: [600, 860], n: 20, via: [[1000, 620], [860, 640], [700, 650], [560, 700], [470, 790], [490, 862], [545, 882]], label: [0, -34], anchor: 'middle' });
        Object.assign(ith, { at: [800, 760], via: [[690, 882], [785, 852]] });
      }
      return list;
    }
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
    if (length !== 'short' && length !== 'long') applyMap(list, MAP);
    return list;
  }

  const SHORTCUTS = [
    { id: 'ferry', name: 'Buckleberry Ferry', from: 'maggot', to: 'bree', n: 5, via: [[450, 298], [528, 282]], label: [492, 336] },
    { id: 'moria', name: 'Mines of Moria', from: 'durin', to: 'lorien', n: 6, via: [[1068, 404], [1180, 434]], label: [1150, 470] }
  ];

  /* ---------- preview routes: same stops and step counts, new geometry ---------- */
  const MAPS = {
    serpent: { name: 'Serpent', stops: {
      maggot: { at: [150, 532], label: [-4, 40] }, bree: { at: [430, 200] }, weathertop: { at: [640, 400] }, rivendell: { at: [820, 190] },
      durin: { at: [1000, 400] }, lorien: { at: [1180, 200], via: [[1056, 446], [1120, 452], [1170, 440], [1196, 330]] }, amonhen: { at: [1320, 380] }, emynmuil: { at: [1150, 560] },
      marshes: { at: [960, 640] }, ithilien: { at: [760, 780] }, morgul: { at: [960, 860] }, ungol: { at: [1200, 760] } },
      flip: ['ferry'] },
    southern: { name: 'Southern Marches', stops: {
      maggot: { at: [260, 340], via: [[250, 178], [325, 194], [338, 262]] }, bree: { at: [420, 500], via: [[120, 390], [100, 470], [160, 560], [270, 572], [345, 540]] }, weathertop: { at: [580, 700] }, rivendell: { at: [760, 515] },
      durin: { at: [808, 172], via: [[760, 420], [790, 300]] }, lorien: { at: [1100, 330], via: [[880, 330], [990, 440], [1080, 440], [1110, 380]] }, amonhen: { at: [1280, 250] }, emynmuil: { at: [1420, 400] },
      marshes: { at: [1240, 560] }, ithilien: { at: [1020, 720] }, morgul: { at: [1200, 840] }, ungol: { at: [1360, 840] } } }
  };
  function applyMap(list, map) {
    const M = MAPS[map];
    if (!M) return list;
    list.forEach((st) => { const o = M.stops[st.id]; if (o) { st.at = o.at; st.via = o.via || []; if (o.label) st.label = o.label; } });
    return list;
  }
  // Shortcut routes for a preview map: bow to the north of the straight line between the two stops.
  function shortcutsFor(map, STOPS) {
    if (!MAPS[map]) return SHORTCUTS;
    return SHORTCUTS.map((sc) => {
      const f = STOPS.find((s) => s.id === sc.from).at, t = STOPS.find((s) => s.id === sc.to).at;
      const dx = t[0] - f[0], dy = t[1] - f[1], len = Math.hypot(dx, dy) || 1;
      let px = -dy / len, py = dx / len;
      if (py > 0) { px = -px; py = -py; }
      if ((MAPS[map].flip || []).includes(sc.id)) { px = -px; py = -py; }
      const bow = 70;
      const via = [[f[0] + dx * 0.33 + px * bow, f[1] + dy * 0.33 + py * bow], [f[0] + dx * 0.66 + px * bow, f[1] + dy * 0.66 + py * bow]];
      return Object.assign({}, sc, { via, label: [f[0] + dx * 0.5 + px * bow * 0.9, f[1] + dy * 0.5 + py * bow * 0.9 - 8] });
    });
  }

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
  function build(length, map) {
    const STOPS = stopsFor(length || 'normal', map);
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

    const shortcuts = shortcutsFor(map, STOPS);
    shortcuts.forEach((sc) => {
      const fi =STOPS.findIndex((s) => s.id === sc.from), ti = STOPS.findIndex((s) => s.id === sc.to);
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

    return { nodes, roads, stopNode, stops: STOPS, shortcuts, map: map || 'classic', length: length || 'normal', start: nodes[0].id, finish: finish.id, longCount, dist, W, H };
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

  // a leafy tree: a tapering trunk, a darker under-canopy, sunlit clumps on top
  function roundTree(c1, c2) {
    const d1 = darker(c2, 0.8), hi = lighter(c1, 0.35);
    return shadow(10) + '<path d="M-2.8,1 C-1.8,-3 -1.6,-8 -1.5,-13 L1.5,-13 C1.6,-8 1.8,-3 2.8,1 Z" fill="#6b4a2b"/>' +
      '<path d="M0,-11 L-4.4,-16.4 M0.4,-12.6 L4.2,-17.6" stroke="#6b4a2b" stroke-width="1.5" stroke-linecap="round"/>' +
      '<circle cx="-6.8" cy="-16.4" r="6.6" fill="' + d1 + '"/><circle cx="6.8" cy="-17" r="6.8" fill="' + d1 + '"/><circle cx="0" cy="-15.4" r="6.2" fill="' + d1 + '"/>' +
      '<circle cx="0" cy="-22" r="10.4" fill="' + c1 + '"/><circle cx="-6.6" cy="-20" r="6.6" fill="' + c2 + '"/><circle cx="6.4" cy="-21" r="7" fill="' + c2 + '"/>' +
      '<circle cx="-2.4" cy="-28" r="6" fill="' + c1 + '"/><circle cx="4" cy="-27" r="5.4" fill="' + c1 + '"/>' +
      '<circle cx="-4" cy="-28.6" r="3.4" fill="' + hi + '" opacity=".7"/><circle cx="2.6" cy="-30" r="2.2" fill="' + hi + '" opacity=".6"/><circle cx="-8.2" cy="-21.6" r="2" fill="' + hi + '" opacity=".45"/>';
  }
  // a fir tree: three drooping tiers of boughs, shaded on the right
  function pine(c1, c2, snow) {
    const tier = (t, b, w) => {
      const m = t + (b - t) * 0.45;
      return '<path d="M0,' + t + ' C' + f1(-w * 0.3) + ',' + f1(m) + ' ' + f1(-w * 0.7) + ',' + (b - 3) + ' ' + -w + ',' + b + ' Q' + f1(-w * 0.5) + ',' + (b - 1.6) + ' 0,' + (b + 0.6) +
        ' Q' + f1(w * 0.5) + ',' + (b - 1.6) + ' ' + w + ',' + b + ' C' + f1(w * 0.7) + ',' + (b - 3) + ' ' + f1(w * 0.3) + ',' + f1(m) + ' 0,' + t + ' Z" fill="' + c1 + '"/>' +
        '<path d="M0,' + t + ' C' + f1(w * 0.3) + ',' + f1(m) + ' ' + f1(w * 0.7) + ',' + (b - 3) + ' ' + w + ',' + b + ' Q' + f1(w * 0.5) + ',' + (b - 1.6) + ' ' + f1(w * 0.2) + ',' + (b + 0.2) +
        ' C' + f1(w * 0.18) + ',' + f1(m + 2) + ' ' + f1(w * 0.08) + ',' + f1(t + (b - t) * 0.3) + ' 0,' + t + ' Z" fill="' + c2 + '"/>';
    };
    return shadow(8) + '<rect x="-1.6" y="-7" width="3.2" height="8" fill="#5a3d22"/>' + tier(-20, -3, 12.5) + tier(-28, -11, 10) + tier(-37, -19, 7.5) +
      (snow ? '<path d="M0,-37 C-1.4,-34 -2.6,-31.6 -3.6,-29.6 Q0,-31.4 3.6,-29.6 C2.6,-31.6 1.4,-34 0,-37 Z" fill="#fff"/>' : '');
  }
  // a mallorn of Lothlórien: a silver trunk and a crown of golden leaves
  function mallorn() {
    return shadow(11) + '<path d="M-2.8,1 C-2,-12 -1.8,-24 -1.2,-34 L1.2,-34 C1.8,-24 2,-12 2.8,1 Z" fill="#ece7d8" stroke="#b9b29c" stroke-width=".6"/>' +
      '<path d="M0,-25 L-6,-32 M0.4,-29 L5,-36" stroke="#d8d2bf" stroke-width="1.3" stroke-linecap="round"/>' +
      '<circle cx="-8" cy="-33" r="7.5" fill="#c9952a"/><circle cx="8.5" cy="-34" r="8" fill="#c9952a"/><circle cx="0" cy="-31.4" r="7" fill="#c9952a"/>' +
      '<circle cx="0" cy="-43" r="11" fill="#e9b93c"/><circle cx="-8" cy="-38" r="7" fill="#f1cd57"/><circle cx="8" cy="-39" r="7.5" fill="#d9a62b"/>' +
      '<circle cx="-3" cy="-49" r="6.5" fill="#f1cd57"/><circle cx="4" cy="-48" r="6" fill="#e9b93c"/>' +
      '<circle cx="-5" cy="-50" r="3.6" fill="#fde58a" opacity=".8"/><circle cx="3" cy="-52" r="2.6" fill="#fde58a" opacity=".7"/><circle cx="-10" cy="-39" r="2.4" fill="#fde58a" opacity=".6"/>';
  }
  // a bare, twisted dead tree
  function deadTree() {
    return shadow(7) + '<path d="M-2.4,0 C-1.6,-6 -1.4,-13 -0.8,-20 L0.8,-20 C1,-14 1.6,-6 2.4,0 Z" fill="#4a3426"/>' +
      '<path d="M-0.6,-11 Q-4,-14 -7,-19 M-7,-19 L-9.4,-23.4 M-7,-19 L-5.4,-22.6 M0.4,-15 Q3,-19 6,-24 M6,-24 L9.4,-25.4 M6,-24 L6.6,-27.6 M0,-19.6 L-2.6,-27" stroke="#4a3426" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
  }
  function bush(c1, c2, flower) {
    return '<ellipse cx="0" cy="0.4" rx="9" ry="2.4" fill="rgba(70,45,15,.15)"/>' +
      '<circle cx="-4" cy="-4" r="5" fill="' + darker(c1, 0.85) + '"/><circle cx="4" cy="-4.5" r="5.5" fill="' + c2 + '"/><circle cx="0" cy="-7.5" r="5" fill="' + c1 + '"/>' +
      '<circle cx="-1.6" cy="-9.4" r="2.2" fill="' + lighter(c1, 0.35) + '" opacity=".7"/>' +
      (flower ? '<circle cx="-3" cy="-8" r="1.4" fill="' + flower + '"/><circle cx="3.5" cy="-6" r="1.4" fill="' + flower + '"/><circle cx="0" cy="-3" r="1.3" fill="' + flower + '"/>' : '');
  }
  // a weathered boulder with a lit face, a shaded side, a crack and a pebble beside it
  function rock(c1, c2, s) {
    const ln = darker(c2, 0.75);
    return '<g transform="scale(' + (s || 1) + ')"><ellipse cx="1" cy="0.4" rx="10" ry="2" fill="rgba(40,30,20,.18)"/>' +
      '<path d="M-9,0 C-9.6,-3.6 -8,-7 -4.6,-9.2 C-1.6,-11.2 3,-11.2 5.8,-8.4 C8.2,-6 9.6,-2.8 9,0 Z" fill="' + c1 + '" stroke="' + ln + '" stroke-width=".6"/>' +
      '<path d="M1.6,-10.8 C4.4,-10.4 6.6,-8.4 7.6,-6.2 C8.8,-3.8 9.4,-1.8 9,0 L2.4,0 C3.6,-3.6 3.4,-7.2 1.6,-10.8 Z" fill="' + c2 + '"/>' +
      '<path d="M-6.6,-6.4 C-5,-8.6 -2.4,-10 0.4,-10.4 C-1.6,-8.8 -3.4,-7.4 -4.6,-5.4 Z" fill="#fff" opacity=".22"/>' +
      '<path d="M-2,-6.2 l1.4,2.2 l-.8,2.4" stroke="' + ln + '" stroke-width=".6" fill="none"/>' +
      '<ellipse cx="11" cy="-1" rx="2.4" ry="1.6" fill="' + c2 + '"/></g>';
  }
  // a woolly sheep with a dark face, facing right
  function sheep() {
    return shadow(7) + '<path d="M-4.5,0 v-4.5 M-2,0 v-4 M2.5,0 v-4.5 M5,0 v-4" stroke="#2e241c" stroke-width="1.2" stroke-linecap="round"/>' +
      '<ellipse cx="0" cy="-6.5" rx="7" ry="4.4" fill="#e4dece"/>' +
      '<circle cx="-4.6" cy="-7" r="2.8" fill="#f8f4ea"/><circle cx="-1.6" cy="-9.2" r="2.9" fill="#fbf8ef"/><circle cx="2" cy="-9" r="2.7" fill="#fbf8ef"/>' +
      '<circle cx="4.4" cy="-7.4" r="2.4" fill="#f4efe2"/><circle cx="-0.5" cy="-6.2" r="3" fill="#f6f2e6"/>' +
      '<path d="M5.6,-9.4 C8.6,-10.8 11,-8.4 10.4,-6.4 L9.2,-4.8 C8.2,-4.2 6.6,-5 6,-6.6 Z" fill="#2e241c"/>' +
      '<path d="M6.4,-9.4 L4.2,-10.6 L6.2,-8.2 Z" fill="#2e241c"/><circle cx="8.4" cy="-8" r=".45" fill="#d8d0b8"/>';
  }
  // a horse in profile facing right, feet on the ground at (0,0). Legs swing unless o.still.
  function horseArt(o) {
    const c = o.coat, sh = o.shade, mn = o.mane, hf = o.hoof || '#2a1d14';
    const ln = o.line ? ' stroke="' + o.line + '" stroke-width=".6" stroke-linejoin="round"' : '';
    const la = o.still ? '' : ' class="leg-a"', lb = o.still ? '' : ' class="leg-b"';
    const hoof = (x) => '<path d="M' + f1(x) + ',-2 h2.3 l.6,2 h-3.1 Z" fill="' + hf + '"/>';
    const fore = (x, col, cls) => '<g' + cls + '><path d="M' + x + ',-17 h3.6 l-.6,9 l.4,6 h-1.9 l-.6,-6 Z" fill="' + col + '"' + ln + '/>' + hoof(x + 1.2) + '</g>';
    const hind = (x, col, cls) => '<g' + cls + '><path d="M' + x + ',-19.5 h5.6 l-1.4,8.5 l-1.7,4.5 l.6,4.5 h-1.8 l-.8,-4.5 l.2,-4.5 Z" fill="' + col + '"' + ln + '/>' + hoof(x + 0.9) + '</g>';
    return fore(11, sh, lb) + hind(-12, sh, la) + fore(7.5, c, la) + hind(-8.5, c, lb) +
      '<path' + (o.still ? '' : ' class="trot"') + ' d="M-14,-23 C-20,-23 -23,-18 -23,-9 C-21,-13 -19.5,-15.5 -17.5,-16.5 C-19,-12.5 -18.6,-8.5 -17.6,-6 C-15,-11 -14,-16 -12.5,-19.5 Z" fill="' + mn + '"/>' +
      '<path d="M-15,-20 C-15,-26 -10,-27.5 -4,-26.5 C2,-25.6 7,-27 11.5,-26.2 C16.5,-25.4 18,-20.5 16,-16.2 C14.4,-12.8 10.5,-12.6 6.5,-13.6 C1.5,-13.2 -4.5,-13 -9,-13.6 C-13,-14.2 -15,-16.6 -15,-20 Z" fill="' + c + '"' + ln + '/>' +
      '<path d="M-12.5,-15.6 C-6,-13.4 4,-13.6 15.4,-16.6 C14,-13.2 10.4,-12.8 6.5,-13.8 C1.5,-13.4 -4.5,-13.2 -9,-13.8 Z" fill="' + sh + '"/>' +
      '<path d="M-8,-25.2 C-4.6,-22 -5.4,-17.4 -8.6,-14.4 M10.6,-25.4 C8.4,-21.8 8.6,-17.6 9.6,-14.6" stroke="' + sh + '" stroke-width=".8" fill="none"/>' +
      '<path d="M7.5,-25 C9.5,-32 13,-38 17,-42.2 L21.2,-40.2 C20.2,-34 19.2,-28 17.4,-20.6 Z" fill="' + c + '"' + ln + '/>' +
      '<path d="M16.2,-41.4 C18,-45.2 22,-44.8 24,-41.6 L29.6,-36.4 C30.8,-34.8 29.8,-33 27.6,-33 L22.4,-33.8 C19.6,-34.4 17,-36.4 16.2,-41.4 Z" fill="' + c + '"' + ln + '/>' +
      '<path d="M26.2,-33.6 C28,-33.2 29.4,-33.6 29.8,-35" stroke="' + sh + '" stroke-width=".7" fill="none"/>' +
      '<path d="M18.4,-43.4 L18.8,-47.6 L21,-43.8 Z" fill="' + c + '"' + ln + '/>' +
      '<path d="M17.4,-43.6 C13,-39.6 10,-33 7.6,-25.6 L10.2,-25.8 C12,-31.6 14.6,-37 18.8,-41.2 Z M17.6,-43.4 C19.6,-44 21.4,-42.8 21.8,-41.2 C20.4,-41.6 19,-41.8 17.6,-41.6 Z" fill="' + mn + '"/>' +
      '<circle cx="21.8" cy="-39.8" r=".9" fill="' + (o.eye || '#1a1208') + '"/><circle cx="28.4" cy="-35.2" r=".5" fill="' + sh + '"/>';
  }
  function darker(hex, f) {
    const n = parseInt(hex.slice(1), 16), k = f || 0.72;
    return '#' + [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0')).join('');
  }
  function lighter(hex, f) {
    const n = parseInt(hex.slice(1), 16), k = f || 0.3;
    return '#' + [16, 8, 0].map((s) => { const v = (n >> s) & 255; return Math.round(v + (255 - v) * k).toString(16).padStart(2, '0'); }).join('');
  }
  function horse(c) {
    // the extra outer group lets the .flip rule mirror the horse without undoing its scale
    return shadow(9) + '<g><g transform="scale(.42)">' + horseArt({ coat: c, shade: darker(c), mane: darker(c, 0.45), still: true }) + '</g></g>';
  }
  function flowers(cols) {
    let s = '';
    for (let i = 0; i < 5; i++) s += '<circle cx="' + f1(rand(-8, 8)) + '" cy="' + f1(rand(-5, 0)) + '" r="1.5" fill="' + pick(cols) + '"/>';
    return s;
  }
  // a clump of grass blades, two shades
  function tuft(c) {
    return '<path d="M-5,0 Q-6.4,-4 -8,-7.4 Q-4.6,-4.4 -3.4,0 Z M-2,0 Q-2.4,-6 -1,-10.6 Q0,-5 0.4,0 Z" fill="' + darker(c, 0.78) + '"/>' +
      '<path d="M-3.6,0 Q-3.6,-5 -4.6,-9 Q-1.6,-5 -1.4,0 Z M0.6,0 Q1.4,-6 3.4,-9.4 Q2.6,-4 2.6,0 Z M2.6,0 Q4.4,-3.6 7,-6.4 Q5,-2.6 4.4,0 Z" fill="' + c + '"/>';
  }
  // marsh reeds with leaves and bulrush heads
  function reeds() {
    return '<path d="M-3,0 q-1,-8 -3,-13 M0,0 v-15 M3,0 q1,-8 4,-12" stroke="#6b7a4a" stroke-width="1.2" fill="none"/>' +
      '<path d="M-1,0 Q-6,-5 -8,-9 Q-4,-6 0.4,0 Z M1,0 Q5,-4 8,-6 Q4,-3 2.4,0 Z" fill="#7d8c56"/>' +
      '<ellipse cx="0" cy="-15" rx="1.2" ry="3" fill="#5a3d22"/><ellipse cx="-5.8" cy="-13" rx="1" ry="2.4" fill="#6a4a2a" transform="rotate(-18 -5.8 -13)"/>';
  }
  function mountainSVG(w, h, o) {
    const px = rand(-w * 0.08, w * 0.08);
    const fill = o.fill || '#c2ae8c', shade = o.shade || '#9c8664', line = o.line || '#6e5636';
    if (o.jagged) {
      // the Mountains of Shadow: sharp, broken ridges with a few lesser points (no extra random numbers, so the layout is unchanged)
      const P = (x, y) => f1(x) + ',' + f1(y);
      const left = [[-w / 2, 0], [-w * 0.34, -h * 0.4], [-w * 0.27, -h * 0.36], [-w * 0.14, -h * 0.72], [px - w * 0.07, -h * 0.66]];
      const right = [[px + w * 0.09, -h * 0.74], [px + w * 0.15, -h * 0.7], [w * 0.28, -h * 0.42], [w * 0.35, -h * 0.46], [w / 2, 0]];
      const outline = left.concat([[px, -h]], right).map((p) => P(p[0], p[1])).join(' L');
      return '<path d="M' + outline + ' Z" fill="' + fill + '"/>' +
        '<path d="M' + P(px, -h) + ' L' + right.map((p) => P(p[0], p[1])).join(' L') + ' L' + P(px + w * 0.08, 0) + ' L' + P(px + w * 0.02, -h * 0.5) + ' Z" fill="' + shade + '"/>' +
        '<path d="M' + outline + '" fill="none" stroke="' + line + '" stroke-width="1.4" stroke-linejoin="round"/>' +
        '<path d="M' + P(px - w * 0.04, -h * 0.8) + ' L' + P(px - w * 0.1, -h * 0.5) + ' M' + P(-w * 0.2, -h * 0.5) + ' L' + P(-w * 0.26, -h * 0.25) + '" stroke="#6a5448" stroke-width=".9" opacity=".7"/>';
    }
    let s ='<path d="M' + f1(-w / 2) + ',0 L' + f1(px) + ',' + f1(-h) + ' L' + f1(w / 2) + ',0 Z" fill="' + fill + '"/>' +
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
  // a hobbit hole: a grassy hill with a round door in a wooden frame, round windows and a doorstep
  function hobbitHole(doorColor, big) {
    const k = big ? 1 : 0.62;
    const win = (x) => '<circle cx="' + x + '" cy="-21" r="7.4" fill="#7a5a36"/><circle cx="' + x + '" cy="-21" r="5.6" fill="#f6e3a1" class="win"/>' +
      '<path d="M' + (x - 5.6) + ',-21 H' + (x + 5.6) + ' M' + x + ',-26.6 V-15.4" stroke="#7a5a36" stroke-width="1.2"/>' +
      '<rect x="' + (x - 7) + '" y="-12.6" width="14" height="3" rx="1" fill="#8a5a32"/>' +
      '<circle cx="' + (x - 4) + '" cy="-13.4" r="1.5" fill="#e86a6a"/><circle cx="' + x + '" cy="-13.8" r="1.5" fill="#f6c94a"/><circle cx="' + (x + 4) + '" cy="-13.4" r="1.5" fill="#e86a6a"/>';
    return '<g transform="scale(' + k + ')">' +
      '<path d="M-62,0 C-58,-30 -36,-54 0,-57 C36,-54 58,-30 62,0 Z" fill="#86b25c" stroke="#5c7f3a" stroke-width="1.4"/>' +
      '<path d="M-50,-30 C-36,-50 -14,-55 6,-55.4 C-14,-50 -32,-42 -42,-26 Z" fill="#a3c978" opacity=".75"/>' +
      '<path d="M26,-48 C42,-40 54,-24 58,-4 L61,0 C58,-30 46,-44 26,-48 Z" fill="#6f9a48" opacity=".8"/>' +
      '<path d="M-40,-42 q2,-4 3,0 q2,-4 3,0 M14,-50 q2,-4 3,0 q2,-4 3,0 M-54,-12 q2,-4 3,0 M44,-24 q2,-4 3,0" stroke="#5c7f3a" stroke-width="1.1" fill="none"/>' +
      '<circle cx="-24" cy="-49" r="1.7" fill="#f6c94a"/><circle cx="-18" cy="-51" r="1.7" fill="#fff"/><circle cx="30" cy="-45" r="1.7" fill="#e86a6a"/><circle cx="36" cy="-41" r="1.7" fill="#f6c94a"/>' +
      '<circle cx="0" cy="-17" r="16" fill="#6b4a2b" stroke="#4a3220" stroke-width="1"/><circle cx="0" cy="-17" r="13.4" fill="#2a1e14"/>' +
      '<g class="door"><circle cx="0" cy="-17" r="12.6" fill="' + doorColor + '" stroke="#2a2a1a" stroke-width="1"/>' +
      '<path d="M-8,-26.6 V-7.4 M-4,-29 V-5 M0,-29.6 V-4.4 M4,-29 V-5 M8,-26.6 V-7.4" stroke="rgba(0,0,0,.2)" stroke-width="1"/>' +
      '<circle cx="0" cy="-17" r="2.2" fill="#f1c84b" stroke="#8a6a1a" stroke-width=".5"/></g>' +
      '<path d="M-12,0 L-10,-3 H10 L12,0 Z" fill="#b8ad98" stroke="#7a705e" stroke-width=".8"/>' +
      win(-32) + win(32) +
      '<path d="M-46,0 H46" stroke="#6e8f44" stroke-width="2"/></g>';
  }
  function chimney(x, y) {
    return '<rect x="' + (x - 3) + '" y="' + (y - 10) + '" width="6" height="10" fill="#8b6b4a" stroke="#5a412a" stroke-width=".8"/>' +
      '<rect x="' + (x - 3.8) + '" y="' + (y - 11.4) + '" width="7.6" height="2" fill="#6b4f36"/>' +
      '<g class="smoke">' + [0, 1, 2].map((i) => '<circle class="puff" style="animation-delay:' + (i * 1.3) + 's" cx="' + x + '" cy="' + (y - 12) + '" r="3.4" fill="#e9e3d6"/>').join('') + '</g>';
  }
  // a timber-framed cottage with a thatched roof
  function house(w, h, wall, roof, smoke) {
    const hw = w / 2, rh = w * 0.55, beam = '#5a412a', th = darker(roof, 0.75);
    const win = (x) => '<rect x="' + x + '" y="' + (-h + 4) + '" width="5" height="5" fill="#f6dd8a" class="win"/>' +
      '<path d="M' + (x + 2.5) + ',' + (-h + 4) + ' v5 M' + x + ',' + (-h + 6.5) + ' h5" stroke="' + beam + '" stroke-width=".6"/>' +
      '<rect x="' + x + '" y="' + (-h + 4) + '" width="5" height="5" fill="none" stroke="' + beam + '" stroke-width=".7"/>';
    return (smoke ? chimney(Math.round(w / 4), Math.round(-h - w * 0.18)) : '') + shadow(hw + 2) +
      '<rect x="' + -hw + '" y="' + -h + '" width="' + w + '" height="' + h + '" fill="' + wall + '" stroke="' + beam + '" stroke-width="1"/>' +
      '<path d="M' + -hw + ',' + f1(-h * 0.4) + ' H' + hw + ' M' + f1(-hw * 0.55) + ',' + f1(-h * 0.4) + ' V0 M' + f1(hw * 0.55) + ',' + f1(-h * 0.4) + ' V0 M' + -hw + ',' + f1(-h * 0.4) + ' L' + f1(-hw * 0.55) + ',0 M' + hw + ',' + f1(-h * 0.4) + ' L' + f1(hw * 0.55) + ',0" stroke="' + beam + '" stroke-width="1" opacity=".75"/>' +
      '<path d="M' + (-hw - 5) + ',' + (-h + 1.5) + ' Q' + (-hw - 2) + ',' + (-h - 2) + ' ' + f1(-hw * 0.45) + ',' + f1(-h - rh * 0.72) + ' Q0,' + f1(-h - rh - 1.5) + ' ' + f1(hw * 0.45) + ',' + f1(-h - rh * 0.72) +
        ' Q' + (hw + 2) + ',' + (-h - 2) + ' ' + (hw + 5) + ',' + (-h + 1.5) + ' Q0,' + (-h - 1.5) + ' ' + (-hw - 5) + ',' + (-h + 1.5) + ' Z" fill="' + roof + '" stroke="#4a3220" stroke-width="1"/>' +
      '<path d="M' + f1(-hw * 0.6) + ',' + f1(-h - rh * 0.45) + ' l-2,4.6 M' + f1(-hw * 0.2) + ',' + f1(-h - rh * 0.75) + ' l-1,5 M' + f1(hw * 0.2) + ',' + f1(-h - rh * 0.75) + ' l1,5 M' + f1(hw * 0.6) + ',' + f1(-h - rh * 0.45) + ' l2,4.6" stroke="' + th + '" stroke-width=".9" stroke-linecap="round"/>' +
      '<path d="M-3.2,0 V-6.4 Q0,-10.4 3.2,-6.4 V0 Z" fill="#5a3a22" stroke="#3a2614" stroke-width=".6"/><circle cx="1.6" cy="-3.6" r=".6" fill="#e8c860"/>' +
      win(-hw + 3) + win(hw - 8);
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
  // a mûmak of Harad: a great grey beast with two pairs of tusks and a war-tower on its back
  function oliphaunt() {
    const skin = '#9a9286', far = '#7d756a', ln = '#5f584e';
    return shadow(22) +
      '<path d="M-12,-14 h6 v13.4 h-6 Z M10,-14 h6 v13.4 h-6 Z" fill="' + far + '"/>' +
      '<path d="M-22,-18 Q-26,-15 -25,-9" stroke="' + far + '" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M-22,-18 C-23,-28 -14,-33 -2,-33 C10,-33 18,-30 21,-24 C23,-18 21,-11 16,-9 L-16,-9 C-21,-10 -22,-14 -22,-18 Z" fill="' + skin + '" stroke="' + ln + '" stroke-width=".8"/>' +
      '<path d="M-20,-13 C-10,-9.6 8,-9.6 19,-12 C17,-9.6 16.4,-9 16,-9 L-16,-9 C-18,-9.6 -19.4,-11 -20,-13 Z" fill="#857d71"/>' +
      '<path d="M-18,-12 L-11,-12 C-11.2,-7 -10.6,-3 -10.2,0 L-18.8,0 C-18.4,-3 -17.8,-7 -18,-12 Z M5,-12 L12,-12 C11.8,-7 12.4,-3 12.8,0 L4.2,0 C4.6,-3 5.2,-7 5,-12 Z" fill="#8d8579" stroke="' + ln + '" stroke-width=".6"/>' +
      '<path d="M-14.6,-11 C-14.4,-7 -14,-4 -13.8,-1 M8.4,-11 C8.6,-7 9,-4 9.2,-1" stroke="#746c61" stroke-width=".5" fill="none"/>' +
      '<path d="M-18,0 a1.1,1.1 0 0 1 2.2,0 M-14.4,0 a1.1,1.1 0 0 1 2.2,0 M5,0 a1.1,1.1 0 0 1 2.2,0 M8.6,0 a1.1,1.1 0 0 1 2.2,0" fill="#e8e0d0"/>' +
      '<path d="M-16,-32.4 C-16,-24 -10,-20 -4,-20 L6,-20 C12,-20 14,-24 14,-32 Z" fill="#c7313a"/>' +
      '<path d="M-15.4,-26 C-13,-21.6 -9,-20.4 -4,-20.4 L6,-20.4 C11,-20.4 13,-22.4 13.8,-26" stroke="#e8b43a" stroke-width="1" fill="none"/>' +
      '<path d="M-10,-40 h18 v7 h-18 Z" fill="#7a5530" stroke="#4a3220" stroke-width=".8"/>' +
      '<path d="M-10,-40 v-2.6 h3 v2.6 h3 v-2.6 h3 v2.6 h3 v-2.6 h3 v2.6 h3 v-2.6 v2.6 Z" fill="#7a5530" stroke="#4a3220" stroke-width=".5"/>' +
      '<path d="M-8,-36.6 h14" stroke="#4a3220" stroke-width=".6"/>' +
      '<path d="M6,-42.6 V-48" stroke="#4a3220" stroke-width=".9"/><path d="M6,-48 l6,1.6 l-6,1.6 Z" fill="#c7313a"/>' +
      '<path d="M16,-30 C20,-35 28,-34 30,-28 C31,-24 30,-19 27,-17 L19,-17 C16,-19 15,-26 16,-30 Z" fill="' + skin + '" stroke="' + ln + '" stroke-width=".8"/>' +
      '<path d="M17,-30 C12,-31 9,-25 11,-19 C13,-17 16,-19 17,-22 Z" fill="#8d8579" stroke="' + ln + '" stroke-width=".6"/>' +
      '<g class="swing"><path d="M27,-20 Q33,-12 30,-4 Q29,-1 31,0" stroke="' + skin + '" stroke-width="4" fill="none" stroke-linecap="round"/></g>' +
      '<path d="M24,-19 Q30,-16 35,-21 M22,-18 Q27,-12 32,-14" stroke="#fffbe8" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="24" cy="-27.6" r="1.1" fill="#2a2420"/>';
  }
  // Barad-dûr: a stepped black tower with spiked ledges, two horns cradling the Eye
  function baradDur() {
    return '<path d="M-20,0 L-17,-38 L-13,-42 L-12,-108 L-7,-116 L-5,-150 L5,-150 L7,-116 L12,-108 L13,-42 L17,-38 L20,0 Z" fill="#2c2420" stroke="#120d0b" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M3,-150 L5,-150 L7,-116 L12,-108 L13,-42 L17,-38 L20,0 L6,0 L6,-110 Z" fill="#1d1714"/>' +
      '<path d="M-6,-104 V-46 M-1,-110 V-46" stroke="#3a302a" stroke-width=".8"/>' +
      '<path d="M-17,-38 l-3,-6 M17,-38 l3,-6 M-12,-108 l-4,-7 M12,-108 l4,-7 M-7,-116 l-2,-6 M7,-116 l2,-6" stroke="#2c2420" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M-4,-150 C-8,-156 -11,-162 -12,-170 M4,-150 C8,-156 11,-162 12,-170" stroke="#2c2420" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<rect x="-2" y="-90" width="4" height="6" fill="#ff7a2a"/><rect x="-2" y="-56" width="4" height="6" fill="#ff7a2a"/>' +
      '<rect x="-1.4" y="-132" width="2.8" height="5" fill="#ff7a2a"/><rect x="-10" y="-28" width="3" height="5" fill="#ff7a2a"/><rect x="7" y="-28" width="3" height="5" fill="#ff7a2a"/>';
  }
  // the Black Gate: two spiked Towers of the Teeth and an iron gate between them
  function blackGate() {
    const t = (x) => '<g transform="translate(' + x + ',0)">' + shadow(8) +
      '<path d="M-8,0 L-6,-30 L-7,-34 L7,-34 L6,-30 L8,0 Z" fill="#3a302a" stroke="#120d0b" stroke-width="1"/>' +
      '<path d="M2,-34 L1,0 L8,0 L6,-30 L7,-34 Z" fill="#2a221d"/>' +
      '<path d="M-7,-34 l1.4,-4.4 l1.4,4.4 l1.4,-4.4 l1.4,4.4 l1.4,-4.4 l1.4,4.4 l1.4,-4.4 l1.4,4.4 l1.4,-4.4 l1.4,4.4 Z" fill="#3a302a" stroke="#120d0b" stroke-width=".6" stroke-linejoin="round"/>' +
      '<rect x="-1.6" y="-24" width="3.2" height="6" fill="#ff7a2a"/><rect x="-1.6" y="-12" width="3.2" height="6" fill="#ff7a2a"/></g>';
    let studs = '';
    for (let i = 0; i < 4; i++) studs += '<circle cx="' + (11.4 + i * 6.4) + '" cy="-18.4" r=".7" fill="#7a6a5a"/><circle cx="' + (11.4 + i * 6.4) + '" cy="-3.6" r=".7" fill="#7a6a5a"/>';
    return t(0) + '<rect x="8" y="-22" width="26" height="22" fill="#2a221d" stroke="#120d0b"/>' +
      '<path d="M8,-22 l2.2,-4 l2.2,4 l2.2,-4 l2.2,4 l2.2,-4 l2.2,4 l2.2,-4 l2.2,4 l2.2,-4 l2.2,4 l2.2,-4 l1.6,4 Z" fill="#2a221d" stroke="#120d0b" stroke-width=".5" stroke-linejoin="round"/>' +
      '<path d="M21,-22 V0 M8,-15 H34 M8,-7.4 H34" stroke="#4a3d33" stroke-width="1"/>' + studs + t(42);
  }
  // Mount Doom: a broad ashen base under a steep cone, lava running down, the crater glowing
  function mountDoom() {
    const lava = (d, w) => '<path d="' + d + '" stroke="#a8300f" stroke-width="' + (w + 2.4) + '" fill="none" stroke-linecap="round"/><path d="' + d + '" stroke="#ff8a2a" stroke-width="' + w + '" fill="none" stroke-linecap="round"/>';
    return '<path d="M-122,0 C-104,-14 -86,-30 -64,-40 C-52,-45 -42,-50 -34,-56 L34,-56 C42,-50 54,-45 66,-40 C88,-30 106,-14 122,0 Z" fill="#33251f" stroke="#1d1411" stroke-width="1.4"/>' +
      '<path d="M30,-54 C52,-44 80,-32 122,0 L54,0 C58,-18 48,-34 30,-54 Z" fill="#271b17"/>' +
      '<path d="M-46,-44 C-40,-62 -32,-80 -27,-96 L27,-96 C32,-80 40,-62 46,-44 C20,-38 -20,-38 -46,-44 Z" fill="#3e2d26" stroke="#1d1411" stroke-width="1.4"/>' +
      '<path d="M10,-96 L27,-96 C32,-80 40,-62 46,-44 C36,-42 26,-41 20,-41 C24,-56 20,-76 10,-96 Z" fill="#2a1d18"/>' +
      '<path d="M-20,-90 L-30,-62 M-6,-92 L-10,-66 M-62,-34 L-82,-16 M-44,-40 L-56,-18 M-96,-14 L-104,-6 M72,-28 L88,-12" stroke="#5a4438" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>' +
      lava('M-10,-96 Q-16,-70 -28,-50 Q-42,-30 -40,0', 3) + lava('M10,-96 Q18,-66 34,-48 Q48,-32 56,-12', 2.4) +
      '<path d="M20,-66 l5,-1.6 l.8,5.6 l-5,.8 Z" fill="#ffb84a"/>' +
      '<ellipse cx="0" cy="-96" rx="27" ry="6" fill="#1d1411"/>' +
      '<ellipse class="doom-glow" cx="0" cy="-100" rx="40" ry="16" fill="#ff6a1a" opacity=".5"/>' +
      '<ellipse cx="0" cy="-97" rx="22" ry="4.4" fill="#ffb13a" opacity=".85"/>';
  }
  // the ashen plain of Mordor, with dunes of ash and faint glowing cracks
  function mordorGround() {
    return '<path d="M1318,548 Q1420,532 1600,536 L1600,920 L1312,920 Q1300,760 1318,548 Z" fill="#4a332b" opacity=".85"/>' +
      '<path d="M1340,580 Q1460,560 1600,566 L1600,920 L1336,920 Z" fill="#5a3a2c" opacity=".55"/>' +
      '<g fill="#3e2a22" opacity=".55"><ellipse cx="1400" cy="640" rx="40" ry="6"/><ellipse cx="1540" cy="700" rx="46" ry="7"/><ellipse cx="1380" cy="860" rx="38" ry="6"/><ellipse cx="1570" cy="880" rx="30" ry="5"/><ellipse cx="1450" cy="740" rx="34" ry="5"/></g>' +
      '<path d="M1372,700 l14,8 l-4,12 l16,6 M1548,610 l-10,14 l8,10 M1420,800 l18,-6 l6,12 M1560,780 l-12,10 l4,12 M1356,620 l10,10" stroke="#d2541c" stroke-width="1.2" fill="none" opacity=".45" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  // Which spaces turn over a card this game: CARD_SHARE of the ordinary spaces, chosen at random,
  // but never more than CARD_RUN_CAP card spaces, or BLANK_RUN_CAP blank spaces, in a row along any way
  // through the map (the long road or either shortcut). Forks and resting places are skipped when counting.
  const CARD_SHARE = 0.35;
  const CARD_RUN_CAP = 4;
  const BLANK_RUN_CAP = 5;
  const capFor = (card) => (card ? CARD_RUN_CAP : BLANK_RUN_CAP);
  function pickCardSpaces(geo, share) {
    const nodes = geo.nodes;
    const eligible = (n) => (n.kind === 'path' || n.kind === 'landmark') && !n.rest;
    // every way from Bag End to Mount Doom: at each fork, the long road or the shortcut
    const ways = [];
    (function walk(id, seq) {
      const n = nodes[id];
      const s = eligible(n) ? seq.concat(n) : seq;
      if (n.next == null) { ways.push(s); return; }
      walk(n.next, s);
      if (n.alt != null) walk(n.alt, s);
    })(geo.start, []);
    const runsOK = () => ways.every((w) => {
      let run = 0;
      for (let i = 0; i < w.length; i++) { run = i && w[i].card === w[i - 1].card ? run + 1 : 1; if (run > capFor(w[i].card)) return false; }
      return true;
    });
    // Go along the long road, then each shortcut. Each space is a card with the chance that keeps the total
    // near the share, unless the spaces just before it already make a full run, which forces the other kind.
    const order = [];
    const seen = new Set();
    ways.forEach((w) => w.forEach((n) => { if (!seen.has(n.id)) { seen.add(n.id); order.push(n); } }));
    const prevOf = new Map();
    ways.forEach((w) => w.forEach((n, i) => { if (i && !prevOf.has(n.id)) prevOf.set(n.id, w[i - 1]); }));
    const target = Math.round(order.length * share);
    for (let tries = 0; tries < 200; tries++) {
      let left = target;
      order.forEach((n, i) => {
        let same = 0, p = prevOf.get(n.id), last = p ? p.card : null;
        while (p && p.card === last && same < capFor(last)) { same++; p = prevOf.get(p.id); }
        const want = Math.random() < left / (order.length - i);
        n.card = same >= capFor(last) ? !last : want;
        if (n.card) left--;
      });
      if (runsOK()) return;
    }
  }

  /* ---------- dress the board for one game ---------- */
  function dress(geo, opts) {
    opts = opts || {};
    const nodes = geo.nodes;
    const SER = geo.map === 'serpent' || geo.map === 'southern';
    const season = SEASONS[pick(Object.keys(SEASONS))];
    const time = TIMES[pick(Object.keys(TIMES))];

    pickCardSpaces(geo, opts.cardShare == null ? CARD_SHARE : opts.cardShare);

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
    land(58, 150, wrap(58, 150, 1, 'rx rx-door', hobbitHole(pick(['#3f7d3a', '#2f6b48', '#3b6f2c'])) + chimney(16, -30), rx('door', 58, 140, 120)));
    reserve(58, 125, 62);
    if (!SER) {
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
      land(318, 250, wrap(318, 252, 1, '', house(26, 16, '#e9dcc0', '#9a6a3a', true)));
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
    land(548, 214, wrap(548, 214, 1, '', house(30, 20, '#e2cfa6', '#7d4a2a', true)));
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
    land(1148, 772, wrap(1148, 772, 1, 'rx rx-trunk', oliphaunt(), rx('trunk', 1148, 758, 120)));
    reserve(1148, 752, 30);
    }
    // Mordor: a dark land walled by mountains
    put(-1000, mordorGround());   // drawn first, under Mordor's own rocks and mountains
    if (!SER) {
    // Minas Morgul
    land(1214, 772, wrap(1214, 772, 1, 'rx rx-glow', tower(16, 58, '#8a8f86', '#6f746b', '#7dff9c') +
      '<ellipse class="glow morgul-glow" cx="0" cy="-60" rx="14" ry="22" fill="#7dff9c" opacity=".25"/>', rx('glow', 1214, 740, 120)));
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
    }
    if (SER) {
      // Serpent: the same kinds of places, drawn on their new stops
      const place = (id, dx, dy, svg, kind) => {
        if (!geo.stopNode[id]) return;
        const x = geo.stopNode[id].x + dx, y = geo.stopNode[id].y + dy;
        land(y, wrap(x, y, 1, kind ? 'rx rx-' + kind : '', svg, kind ? rx(kind, f1(x), f1(y - 20), 120) : ''));
      };
      place('maggot', -40, 14, house(26, 16, '#e9dcc0', '#9a6a3a', true));
      place('bree', 46, -8, house(30, 20, '#e2cfa6', '#7d4a2a', true));
      place('bree', 78, -2, house(24, 16, '#d8c49b', '#8a5634'));
      place('weathertop', 0, 40, '<path d="M-110,0 C-80,-14 -60,-70 -18,-92 C0,-100 18,-100 36,-90 C74,-66 90,-16 110,0 Z" fill="#b9a97c" stroke="#7a6640" stroke-width="1.6"/>');
      place('weathertop', 0, -16, '<rect x="-34" y="-12" width="6" height="14" fill="#a39d8f"/><rect x="-22" y="-18" width="6" height="18" fill="#b0aa9b"/><rect x="34" y="-14" width="6" height="14" fill="#a39d8f"/><rect x="46" y="-8" width="5" height="8" fill="#b0aa9b"/>');
      place('weathertop', 62, -22, '<path d="M-6,0 L6,0" stroke="#5a3d22" stroke-width="2.4"/><g class="flame"><path d="M-5,-1 Q-6,-9 0,-16 Q6,-9 5,-1 Z" fill="#f08a24"/><path d="M-2.5,-1 Q-3,-6 0,-10 Q3,-6 2.5,-1 Z" fill="#ffd34d"/></g>', 'fire');
      place('rivendell', -34, 4, elfHouse(22, 18));
      place('rivendell', 6, 2, elfHouse(18, 24));
      place('rivendell', -58, -92, '<path d="M-6,0 Q-8,40 -4,92 L6,92 Q8,40 6,0 Z" fill="#9fd0ec"/><path class="flow" d="M0,0 V92" stroke="#e8f6ff" stroke-width="3" stroke-dasharray="6 7" fill="none"/><ellipse cx="0" cy="94" rx="16" ry="5" fill="#b6def2"/>');
      place('durin', 0, -6, '<path d="M-36,0 L-30,-58 L-6,-74 L22,-66 L34,-40 L36,0 Z" fill="#8f8a80" stroke="#5f5a50" stroke-width="1.4"/>');
      place('durin', 0, -8, '<path d="M-13,0 V-24 Q0,-42 13,-24 V0" fill="#3b3a3f"/><path class="glow" d="M-13,0 V-24 Q0,-42 13,-24 V0 M-9,-26 L9,-26 M0,-34 l-3,6 h6 Z M-10,-6 v-14 M10,-6 v-14" stroke="#cfe7ff" stroke-width="1.4" fill="none"/>', 'glow');
      place('durin', -44, 54, '<ellipse cx="0" cy="0" rx="40" ry="14" fill="#36505e" stroke="#26363f" stroke-width="1.4"/><ellipse cx="-7" cy="-2" rx="28" ry="8" fill="#46687a" opacity=".6"/>');
      place('lorien', 0, -10, '<ellipse cx="0" cy="-20" rx="110" ry="80" fill="#f7d774" opacity=".18"/>');
      place('lorien', 40, -10, '<g class="glints">' + [[-20, -60], [6, -78], [24, -52], [-4, -40], [14, -66]].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.2" fill="#fff6c4"/>').join('') + '</g>', 'sparkle');
      place('amonhen', 0, 8, '<path d="M-46,0 Q-26,-40 0,-44 Q26,-40 46,0 Z" fill="#a6b07a" stroke="#6f7444" stroke-width="1.4"/><rect x="-7" y="-52" width="14" height="10" fill="#bdb6a6" stroke="#6b665c"/><rect x="-9" y="-44" width="18" height="3" fill="#a8a192"/>');
      place('emynmuil', -20, 6, rock('#a7a297', '#857f72', 1.3));
      place('emynmuil', 14, 10, rock('#a7a297', '#857f72', 1));
      place('emynmuil', 34, 2, rock('#a7a297', '#857f72', 0.8));
      place('marshes', -30, 10, '<ellipse cx="0" cy="0" rx="30" ry="9" fill="#6f7f62" stroke="#4f5a44" stroke-width="1"/>');
      place('marshes', 26, -2, '<ellipse cx="0" cy="0" rx="22" ry="7" fill="#6f7f62" stroke="#4f5a44" stroke-width="1"/>');
      place('marshes', 0, -4, [[-30, -4], [24, -16], [-18, -30], [10, -40]].map((p, i) => '<circle class="marsh-light" style="animation-delay:' + (i * 0.7) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="#d6ffb8"/>').join(''), 'lights');
      // the oliphaunt stands beside the road at Ithilien, wherever no other road space is in its way
      const stIth = geo.stopNode.ithilien;
      const mumakAt = stIth && [[0, -12], [-46, -16], [46, -16], [-40, 34], [40, 34], [0, 44], [0, -56]].find(([dx, dy]) =>
        !geo.nodes.some((n) => n !== stIth && Math.hypot(n.x - (stIth.x + dx), n.y - (stIth.y + dy - 18)) < 40)) || [0, -12];
      if (stIth) place('ithilien', mumakAt[0], mumakAt[1], oliphaunt(), 'trunk');
      place('morgul', 0, 0, tower(16, 58, '#8a8f86', '#6f746b', '#7dff9c') + '<ellipse class="glow morgul-glow" cx="0" cy="-60" rx="14" ry="22" fill="#7dff9c" opacity=".25"/>', 'glow');
      place('ungol', -8, 0, tower(14, 44, '#6e665e', null, '#ffb25a'));
      place('ungol', 46, -6, '<g class="spider"><ellipse cx="0" cy="-12" rx="5" ry="6" fill="#2a1e1a"/><path d="M-4,-13 l-7,-5 M-4,-10 l-8,1 M4,-13 l7,-5 M4,-10 l8,1" stroke="#2a1e1a" stroke-width="1.4"/></g>', 'spider');
    }
    // Lights drifting among the trees of Lothlórien (brighter in the evening)
    (function () {
      const lo = geo.stopNode.lorien;
      if (!lo) return;
      let motes = '';
      for (let i = 0; i < 9; i++) {
        const x = lo.x + rand(-95, 95), y = lo.y + rand(-120, 10);
        motes += '<circle class="mote" cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(rand(1.6, 2.6)) + '" fill="#fff3b0" style="--mx:' + f1(rand(-18, 18)) + 'px;--my:' + f1(rand(-22, -8)) +
          'px;animation-duration:' + f1(rand(5, 9)) + 's;animation-delay:-' + f1(rand(0, 9)) + 's"/>';
      }
      land(lo.y + 30, '<g class="lorien-lights">' + motes + '</g>');
    })();
    // Barad-dûr and the Eye
    land(600, wrap(1566, 604, 1, '', baradDur()));
    land(601, '<g id="eye" transform="translate(1566,442)"><ellipse class="eye-glow" cx="0" cy="0" rx="26" ry="14" fill="#ff8a2a" opacity=".35"/>' +
      '<path d="M-20,0 Q0,-14 20,0 Q0,14 -20,0 Z" fill="#ffb02e" stroke="#c43c12" stroke-width="1.5"/>' +
      '<g id="eye-pupil"><ellipse cx="0" cy="0" rx="2.6" ry="9" fill="#1a0a05"/></g></g>');
    reserve(1566, 520, 36); reserve(1566, 450, 30);
    // Black Gate
    land(560, wrap(1340, 566, 1, '', blackGate()));
    reserve(1360, 550, 34);
    // Mount Doom
    land(880, wrap(1480, 880, 1, 'rx rx-lava', mountDoom() +
      '<g class="sparks">' + [-16, -6, 4, 14].map((x, i) => '<circle cx="' + x + '" cy="' + (-100 - i % 2 * 4) + '" r="2.4" fill="#ffd34d"/>').join('') + '</g>', rx('lava', 1480, 780, 150)));
    // smoke above Mount Doom
    land(700, '<g>' + [0, 1, 2, 3].map((i) => '<circle class="doom-smoke" style="animation-delay:' + (i * 1.6) + 's" cx="' + (1480 + i * 3) + '" cy="740" r="14" fill="#5c514c"/>').join('') + '</g>');
    reserve(1480, 820, 70);
    if (!SER) {
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

    }

    /* ---- mountain ranges ---- */
    if (!SER) range([[1108, 40], [1132, 120], [1196, 290], [1186, 360], [1208, 470], [1176, 560]], 34, [52, 84], { snow: true, fill: '#c8bba3', shade: '#a4957a', ignore: 'moria' });
    if (SER) range([[1040, 330], [1080, 270], [1130, 200], [1170, 130]], 34, [46, 70], { snow: true, fill: '#c8bba3', shade: '#a4957a' });
    if (!SER) range([[612, 640], [700, 628], [800, 618], [880, 610]], 34, [44, 66], { snow: true, fill: '#c9bea6', shade: '#a99a7e' });
    range([[1326, 562], [1420, 548], [1520, 546]], 30, [40, 60], { fill: '#4a3b34', shade: '#2f2521', line: '#1a1210', jagged: true });
    range([[1312, 600], [1302, 700], [1306, 800], [1300, 910]], 30, [40, 58], { fill: '#4a3b34', shade: '#2f2521', line: '#1a1210', jagged: true });

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
  // the Brandywine and the Anduin on each map
  const RIVERS = {
    southern: [{ w: 9, pts: [[252, -10], [262, 120], [282, 250], [302, 350], [330, 450], [356, 560], [376, 700], [360, 820], [334, 930]] },
      { w: 11, pts: [[1440, -10], [1420, 180], [1400, 300], [1380, 420], [1340, 520], [1300, 620], [1262, 720], [1210, 930]] }],
    serpent: [{ w: 9, pts: [[318, -10], [326, 140], [336, 250], [364, 330], [384, 420], [350, 520], [320, 640], [336, 780], [330, 930]] },
      { w: 11, pts: [[1400, -10], [1380, 150], [1340, 260], [1300, 340], [1250, 420], [1200, 520], [1130, 620], [1070, 740], [1040, 930]] }],
    classic: [{ w: 9, pts: [[486, -10], [470, 150], [462, 300], [440, 420], [418, 500], [430, 640], [470, 780], [500, 930]] },
      { w: 11, pts: [[1352, -10], [1350, 180], [1344, 330], [1336, 470], [1290, 562], [1220, 622], [1192, 648], [1120, 712], [1062, 792], [1036, 930]] }]
  };
  function terrainHTML(map) {
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
      (RIVERS[map] || RIVERS.classic).map((r) => river(r.pts, r.w)).join('') +
      // Shire hills
      '<g fill="#9cc06c" stroke="#77984c" stroke-width="1.2" opacity=".85">' +
      '<path d="M150,290 Q190,250 230,290 Z"/><path d="M40,300 Q90,250 140,300 Z"/><path d="M300,120 Q340,84 380,120 Z"/><path d="M300,380 Q330,350 370,380 Z" />' +
      '</g>';
  }

  function cartoucheHTML(mapName) {
    return '<g class="cartouche" transform="translate(40,700)">' +
      '<path d="M10,0 H330 Q340,0 340,10 V150 Q340,160 330,160 H10 Q0,160 0,150 V10 Q0,0 10,0 Z" fill="#f3e6c4" stroke="#7a5a32" stroke-width="2.4"/>' +
      '<path d="M18,10 H322 Q330,10 330,18 V142 Q330,150 322,150 H18 Q10,150 10,142 V18 Q10,10 18,10 Z" fill="none" stroke="#a37a3e" stroke-width="1" stroke-dasharray="2 3"/>' +
      '<text x="170" y="66" text-anchor="middle" class="map-title">Hobbit Land</text>' +
      '<text x="170" y="98" text-anchor="middle" class="map-sub">From the Shire to Mount Doom</text>' +
      '<g transform="translate(46,126)"><circle r="11" fill="none" stroke="#d4a72c" stroke-width="4"/><circle r="11" fill="none" stroke="#fff3b0" stroke-width="1" opacity=".7"/></g>' +
      '<g transform="translate(294,126)"><circle r="11" fill="none" stroke="#d4a72c" stroke-width="4"/><circle r="11" fill="none" stroke="#fff3b0" stroke-width="1" opacity=".7"/></g>' +
      '<text x="170" y="132" text-anchor="middle" class="map-sub map-name">' + (mapName ? mapName + ' Map' : '') + '</text>' +
      '</g>' +
      '<g class="compass" transform="translate(612,800)">' +
      '<circle r="34" fill="#f3e6c4" stroke="#7a5a32" stroke-width="1.6" opacity=".9"/>' +
      '<path d="M0,-30 L6,0 L0,30 L-6,0 Z" fill="#7a5a32"/><path d="M-30,0 L0,6 L30,0 L0,-6 Z" fill="#b08a52"/>' +
      '<path d="M0,-30 L6,0 L-6,0 Z" fill="#b23a2a"/>' +
      '<text y="-38" text-anchor="middle" class="map-label small">N</text></g>';
  }

  // Place names moved so no road space covers them. Stops: [dx, dy, anchor] from the stop.
  // Shortcuts: [x, y] on the map.
  const LABEL_FIX = {
    classic: { maggot: [0, -34, 'middle'], bree: [-29, -17, 'end'], rivendell: [-29, 50, 'end'], amonhen: [-40, -23, 'end'], ithilien: [29, -17, 'start'], marshes: [-29, -17, 'end'] },
    serpent: { bagend: [-23, 40, 'end'], bree: [-29, -17, 'end'], rivendell: [-34, 0, 'end'], amonhen: [17, -29, 'start'], ithilien: [-17, -29, 'end'], marshes: [23, 40, 'start'],
      'c:ferry': [350, 419], 'c:moria': [1085, 285] },
    southern: { maggot: [-17, -29, 'end'], bree: [-50, -29, 'end'], weathertop: [0, 46, 'middle'], rivendell: [-34, 0, 'end'], lorien: [29, 17, 'start'],
      amonhen: [-17, -29, 'end'], morgul: [0, 58, 'middle'], ungol: [-17, -29, 'end'], emynmuil: [-50, -29, 'end'], marshes: [-29, -17, 'end'],
      ithilien: [-17, -92, 'middle'], 'ithilien@short': [-40, -4, 'end'],
      'c:ferry': [415, 315], 'c:moria': [963, 224] }
  };

  function labelsHTML(geo) {
    let s = '';
    const fix = LABEL_FIX[geo.map] || {};
    geo.stops.forEach((st) => {
      if (geo.map === 'serpent' && st.id === 'marshes') return;   // Serpent names the marshes in the middle of the oval
      const n = geo.stopNode[st.id];
      const f = fix[st.id + '@' + geo.length] || fix[st.id];
      const dx = f ? f[0] : st.label[0], dy = f ? f[1] : st.label[1], an = f ? f[2] : (st.anchor || 'middle');
      s += '<text class="map-label" x="' + f1(n.x + dx) + '" y="' + f1(n.y + dy) + '" text-anchor="' + an + '">' + st.name + '</text>';
    });
    // places the short road skips keep their names on the map
    const ser = geo.map === 'serpent';
    // (on the long road the way to Ithilien runs along the bottom of the oval, so the name sits a little higher there)
    if (ser) s += '<text class="map-label region" x="' + (geo.length === 'long' ? 712 : 740) + '" y="' + (geo.length === 'long' ? 842 : 870) + '" text-anchor="middle">Dead Marshes</text>';
    else if (geo.map === 'southern' && !geo.stops.some((st) => st.id === 'marshes')) s += '<text class="map-label region" x="1154" y="612" text-anchor="middle">Dead Marshes</text>';
    else if (!geo.stops.some((st) => st.id === 'marshes')) s += '<text class="map-label region" x="790" y="836" text-anchor="middle">Dead Marshes</text>';
    if (geo.map === 'southern' && !geo.stops.some((st) => st.id === 'emynmuil')) s += '<text class="map-label region" x="1430" y="470" text-anchor="middle">Emyn Muil</text>';
    else if (!geo.stops.some((st) => st.id === 'emynmuil')) s += '<text class="map-label region" x="' + (ser ? 1000 : 960) + '" y="' + (ser ? 600 : 642) + '" text-anchor="middle">Emyn Muil</text>';
    (geo.shortcuts || SHORTCUTS).forEach((sc) => {
      const f = fix['c:' + sc.id];
      const x = f ? f[0] : sc.label[0], y = f ? f[1] : sc.label[1];
      s += '<text class="map-label short" x="' + x + '" y="' + y + '" text-anchor="middle">' + sc.name + '</text>';
    });
    [['Old Forest', 470, 372], ['Barrow-downs', 410, 600], ['Caradhras', 1160, 62], ['Fangorn', 925, 556], ['Rohan', 700, 400], ['Isengard', 690, 594], ['Mirkwood', 1490, 170],
      ['Mordor', 1440, 600], ['Anduin', 1365, 250], ['The Shire', 160, 38], ['Barad-dûr', 1592, 618, 'end'], ['Black Gate', 1360, 520], ['Misty Mountains', 1240, 30], ['Trollshaws', 884, 302]].forEach((l) => {
      if (geo.map !== 'classic' && !['Mordor', 'Barad-dûr', 'Black Gate', 'Mirkwood', 'The Shire', 'Misty Mountains', 'Anduin'].includes(l[0])) return;
      const p = (geo.map === 'southern' && { Anduin: [1367, 242], 'Black Gate': [1372, 541] }[l[0]]) || [l[1], l[2]];
      // Barad-dûr sits at the right edge, so its name ends there instead of being centred under the tower
      s += '<text class="map-label region" x="' + p[0] + '" y="' + p[1] + '" text-anchor="' + (l[3] || 'middle') + '">' + l[0] + '</text>';
    });
    return s;
  }

  /* ---------- the road ---------- */
  // Each stretch of road takes on the land it crosses, decided by the stop it is heading to.
  const STOP_LAND = { bagend: 'lane', maggot: 'lane', bree: 'lane', weathertop: 'earth', rivendell: 'earth', durin: 'earth', lorien: 'mountain',
    amonhen: 'forest', emynmuil: 'rock', marshes: 'boardwalk', ithilien: 'gondor', morgul: 'gondor', ungol: 'mordor', doom: 'mordor' };
  // verge: the soft edge either side; road: the surface; tex: marks on the surface (D is the path); stone/edge: the stepping stones
  const LAND = {
    lane: { verge: '#7fa04f', vo: 0.45, road: '#e3cc94', tex: '<path d="D" stroke="#cdb078" stroke-width="7" opacity=".5" fill="none" stroke-linecap="round"/>', stone: '#f1e5c4', edge: '#8a6a3a' },
    earth: { verge: '#8a7a4a', vo: 0.35, road: '#d6b880', tex: '<path d="D" stroke="#a88a58" stroke-width="3" stroke-dasharray="0.1 7" opacity=".7" fill="none" stroke-linecap="round"/>', stone: '#eadab6', edge: '#7a5a32' },
    mountain: { verge: '#8f8a80', vo: 0.5, road: '#cbc5b9', tex: '<path d="D" stroke="#b5aea1" stroke-width="19" stroke-dasharray="7 2" fill="none"/>', stone: '#dedad2', edge: '#6e6a62', snow: true },
    forest: { verge: '#6f9a48', vo: 0.4, road: '#dbc68e', tex: '<path d="D" stroke="#e2b33b" stroke-width="3.4" stroke-dasharray="0.1 9" fill="none" stroke-linecap="round"/>', stone: '#efe4c4', edge: '#8a7040' },
    rock: { verge: '#8a8478', vo: 0.45, road: '#c6bda9', tex: '<path d="D" stroke="#9a9282" stroke-width="3" stroke-dasharray="0.1 6" fill="none" stroke-linecap="round"/>', stone: '#d8d0c0', edge: '#6e6656' },
    boardwalk: { verge: '#4f5e48', vo: 0.5, road: '#8e6a40', w: 20, tex: '<path d="D" stroke="#b08a58" stroke-width="18" stroke-dasharray="3.2 1.3" fill="none"/>', stone: '#d2bc92', edge: '#5a4a32' },
    gondor: { verge: '#6f9a48', vo: 0.4, road: '#cbc3a8', tex: '<path d="D" stroke="#b7ae92" stroke-width="19" stroke-dasharray="5 1.6" fill="none"/><path d="D" stroke="#7fa04f" stroke-width="2" stroke-dasharray="0.1 13" opacity=".7" fill="none" stroke-linecap="round"/>', stone: '#e4dfcc', edge: '#7a7462' },
    mordor: { verge: '#c84a1a', vo: 0.22, road: '#3b2d27', tex: '<path d="D" stroke="#e2541c" stroke-width="2" stroke-dasharray="1.5 8" opacity=".6" fill="none" stroke-linecap="round"/>', stone: '#5e4d44', edge: '#1d1411' },
    ferry: { verge: '#5f8fb0', vo: 0.4, road: '#a9cfe0', tex: '<path d="D" stroke="#fff" stroke-width="2" stroke-dasharray="6 10" opacity=".8" fill="none" stroke-linecap="round"/>', stone: '#d6c3a0', edge: '#5a4a3a' },
    moria: { stone: '#8b8279', edge: '#2e2924' }
  };
  // which land each space stands in, plus the long road in order (worked out once per board)
  function landOf(geo) {
    if (geo.land) return geo.land;
    const N = geo.nodes, land = {}, order = [];
    for (let n = N[geo.start]; n; n = n.next != null ? N[n.next] : null) order.push(n);
    let cur = 'mordor';
    for (let i = order.length - 1; i >= 0; i--) { if (order[i].stop) cur = STOP_LAND[order[i].stop] || cur; land[order[i].id] = cur; }
    N.forEach((m) => { if (m.route !== 'main') land[m.id] = m.route === 'ferry' ? 'ferry' : 'moria'; });
    geo.land = land;
    geo.longRoad = order;
    return land;
  }
  const steady = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };   // the same "random" every game
  function nearestOn(geo, route, x, y) {
    let best = null, bd = Infinity;
    geo.nodes.forEach((m) => { if (m.route === route) { const d = (m.x - x) ** 2 + (m.y - y) ** 2; if (d < bd) { bd = d; best = m; } } });
    return best;
  }

  function roadHTML(geo) {
    const land = landOf(geo);
    let verge = '', body = '', tex = '';
    geo.roads.forEach((r) => {
      if (r.id === 'moria') {   // the tunnel under the mountains stays dark
        verge += '<path d="' + r.d + '" class="road-edge tunnel"/>';
        body += '<path d="' + r.d + '" class="road tunnel" data-route="moria"/>';
        return;
      }
      // split the road into stretches by the land each part crosses
      const groups = [];
      r.pts.forEach((p) => {
        const L = r.id === 'main' ? land[nearestOn(geo, 'main', p[0], p[1]).id] : 'ferry';
        const g = groups[groups.length - 1];
        if (!g || g.L !== L) { if (g) g.pts.push(p); groups.push({ L, pts: [p] }); } else g.pts.push(p);
      });
      groups.forEach((g) => {
        const d = 'M' + g.pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join('L'), s = LAND[g.L];
        verge += '<path d="' + d + '" stroke="' + s.verge + '" stroke-width="36" opacity="' + s.vo + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="' + d + '" stroke="' + s.verge + '" stroke-width="27" opacity="' + (s.vo * 0.8).toFixed(2) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
        body += '<path d="' + d + '" class="road-body" data-route="' + r.id + '" stroke="' + s.road + '" stroke-width="' + (s.w || 22) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
        tex += s.tex.replace(/D/g, d);
      });
    });
    return verge + body + tex + bridgesHTML(geo) + roadsideHTML(geo);
  }

  // grass, pebbles, flowers, reeds or embers along the sides, and footprints between the spaces
  function roadsideHTML(geo) {
    const N = geo.nodes, land = landOf(geo);
    let s = '';
    const near = (x, y, r) => N.some((m) => Math.abs(m.x - x) < r && Math.abs(m.y - y) < r && Math.hypot(m.x - x, m.y - y) < r);
    geo.roads.forEach((r) => {
      if (r.id === 'moria') return;
      const pts = r.pts;
      for (let i = 2, k = 0; i < pts.length - 2; i += 3, k++) {
        const [x, y] = pts[i], [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1];
        const dl = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / dl, ny = (bx - ax) / dl;
        const L = r.id === 'main' ? land[nearestOn(geo, 'main', x, y).id] : 'ferry';
        const side = steady(k, 1) < 0.5 ? -1 : 1, off = 16 + steady(k, 2) * 5;
        const px = x + nx * off * side, py = y + ny * off * side;
        if (near(px, py, 21)) continue;
        const kind = steady(k, 3), t = 'translate(' + f1(px) + ',' + f1(py) + ')';
        if (L === 'mordor') s += kind < 0.6 ? '<ellipse transform="' + t + '" rx="2.4" ry="1.6" fill="#2a1d18"/>' : '<circle transform="' + t + '" r="1.2" fill="#ff7a2a" opacity=".7"/>';
        else if (L === 'boardwalk') s += kind < 0.5 ? '<rect transform="' + t + '" x="-1.4" y="-5" width="2.8" height="6" fill="#4a3220"/>' : '<path transform="' + t + '" d="M-2,0 q-1,-6 -3,-9 M0,0 v-10 M2,0 q1,-6 3,-8" stroke="#6b7a4a" stroke-width="1" fill="none"/>';
        else if (L === 'ferry') s += '<path transform="' + t + '" d="M-4,0 q2,-2 4,0 q2,-2 4,0" stroke="#e4f3fb" stroke-width="1" fill="none"/>';
        else if (L === 'mountain' || L === 'rock') s += kind < 0.55 ? '<path transform="' + t + '" d="M-3.4,0 L-2.4,-3 L0.6,-4 L3,-2 L3.4,0 Z" fill="' + (L === 'mountain' && kind < 0.25 ? '#fbfbff' : '#a39d90') + '"/>' : '<ellipse transform="' + t + '" rx="1.8" ry="1.2" fill="#8a8478"/>';
        else if (kind < 0.55) s += '<path transform="' + t + '" d="M-3,0 q0,-4 -2,-6 M0,0 q0,-5 1,-7 M3,0 q0,-4 2,-5" stroke="' + (L === 'forest' ? '#6f8a3a' : '#6f9440') + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
        else if (kind < 0.78) s += '<ellipse transform="' + t + '" rx="2" ry="1.3" fill="#a89e8a"/>';
        else s += '<g transform="' + t + '"><circle r="1.4" fill="' + (L === 'forest' ? '#e2b33b' : ['#f6a5c0', '#fff3a8', '#ffffff'][k % 3]) + '"/><circle r=".5" fill="#e8a83a"/></g>';
      }
    });
    geo.longRoad.forEach((n) => {
      if (n.next == null || !['lane', 'earth', 'forest'].includes(land[n.id])) return;
      const m = N[n.next], x = (n.x + m.x) / 2, y = (n.y + m.y) / 2, a = Math.atan2(m.y - n.y, m.x - n.x) * 180 / Math.PI;
      s += '<g transform="translate(' + f1(x) + ',' + f1(y) + ') rotate(' + f1(a) + ')" fill="#a8885a" opacity=".55"><ellipse cx="-3" cy="-2.4" rx="1.8" ry="1"/><ellipse cx="2" cy="2.4" rx="1.8" ry="1"/></g>';
    });
    return s;
  }

  // a wooden bridge wherever the long road crosses a river
  function bridgesHTML(geo) {
    const main = geo.roads.find((r) => r.id === 'main');
    if (!main) return '';
    const pts = main.pts;
    let s = '';
    (RIVERS[geo.map] || RIVERS.classic).forEach((rv) => {
      const rp = curve(rv.pts, 0, rv.pts.length - 1, 48);
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const i = run[Math.floor(run.length / 2)], [x, y] = pts[i];
        const a = pts[Math.min(pts.length - 1, i + 2)], b = pts[Math.max(0, i - 2)];
        const ang = Math.atan2(a[1] - b[1], a[0] - b[0]) * 180 / Math.PI;
        s += '<g transform="translate(' + f1(x) + ',' + f1(y) + ') rotate(' + f1(ang) + ')">' +
          '<ellipse cx="2" cy="16" rx="30" ry="4" fill="rgba(30,50,60,.25)"/>' +
          '<path d="M-32,-13 L-26,-13 L-26,13 L-32,13 Z M26,-13 L32,-13 L32,13 L26,13 Z" fill="#b0a898" stroke="#6e6656" stroke-width=".8"/>' +
          '<rect x="-26" y="-12" width="52" height="24" fill="#a8804e" stroke="#5a3d22" stroke-width="1"/>' +
          '<path d="M-26,0 H26" stroke="#c49a64" stroke-width="22" stroke-dasharray="3.2 1.3"/>' +
          '<path d="M-26,-12 H26 M-26,12 H26" stroke="#5a3d22" stroke-width="2.2" stroke-linecap="round"/>' +
          '<path d="M-24,-12 v-3 M-12,-12 v-3 M0,-12 v-3 M12,-12 v-3 M24,-12 v-3 M-24,12 v3 M-12,12 v3 M0,12 v3 M12,12 v3 M24,12 v3" stroke="#4a3220" stroke-width="1.8" stroke-linecap="round"/></g>';
        run = [];
      };
      pts.forEach((p, i) => {
        if (rp.some((q) => Math.abs(q[0] - p[0]) < 8 && Math.abs(q[1] - p[1]) < 8 && Math.hypot(q[0] - p[0], q[1] - p[1]) < 7)) run.push(i); else flush();
      });
      flush();
    });
    return s;
  }


  window.HL_BOARD = { horseArt, landOf, LAND, W, H, STOPS, SHORTCUTS, MAPS, build, dress, terrainHTML, cartoucheHTML, labelsHTML, roadHTML };
})();
