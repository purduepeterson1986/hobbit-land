/* Hobbit Land — settings, turns, dice, cards and token movement */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const HB = window.HL_HOBBITS;
  const BOARD = window.HL_BOARD;
  const CARDS = window.HL_CARDS;

  // Timing for the whole game. hop: ms per space walked. think: pause before a computer rolls.
  // pace: scales the other pauses (toasts, card moves, celebrations).
  const SPEED = { hop: 360, think: 1300, pace: 1.35 };
  const STORE_KEY = 'hobbit-land-settings-v1';
  const ORDINALS = ['1st', '2nd', '3rd', '4th'];
  const MEDALS = ['🥇', '🥈', '🥉', '4'];

  /* ---------- settings ---------- */
  const settings = {
    players: 2,
    hobbits: ['frodo', 'sam', 'merry', 'pippin'],   // which hobbit each seat plays (always all four, in some order)
    types: ['human', 'human', 'cpu', 'cpu'],
    length: 'normal',   // road length: short, normal or long
    sound: true,
    diceSound: true,    // the dice rolling sound on its own
    autoTap: false,     // computer players tap Continue on their own
    autoSecs: 5         // how long a computer's card stays up before that (2, 5 or 10)
  };
  const LENGTH_IDS = ['short', 'normal', 'long'];
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      if ([2, 3, 4].includes(saved.players)) settings.players = saved.players;
      if (Array.isArray(saved.hobbits)) {
        const ids = saved.hobbits.slice(0, 4);
        const all = HB.list.map((h) => h.id);
        if (ids.length === 4 && all.every((id) => ids.includes(id))) settings.hobbits = ids;
      }
      if (Array.isArray(saved.types)) saved.types.slice(0, 4).forEach((t, i) => { settings.types[i] = t === 'cpu' ? 'cpu' : 'human'; });
      if (LENGTH_IDS.includes(saved.length)) settings.length = saved.length;
      if (typeof saved.sound === 'boolean') settings.sound = saved.sound;
      if (typeof saved.diceSound === 'boolean') settings.diceSound = saved.diceSound;
      if (typeof saved.autoTap === 'boolean') settings.autoTap = saved.autoTap;
      if ([2, 5, 10].includes(saved.autoSecs)) settings.autoSecs = saved.autoSecs;
    }
  } catch (e) { /* storage unavailable: defaults are fine */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isCpu = (i) => settings.types[i] === 'cpu';
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sound (synthesised, no audio files) ---------- */
  const Sound = {
    ctx: null,
    ensure() {
      if (!settings.sound) return null;
      // iPhone and iPad: "playback" lets sounds play even when the side switch is set to silent.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch (e) { return null; }
    },
    tone(freq, start, dur, type, vol, slideTo) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime + start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },
    noise(start, dur, vol, freq) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime + start;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 1800;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
    },
    click() { this.tone(620, 0, 0.08, 'triangle', 0.08, 400); },
    dice() { for (let i = 0; i < 8; i++) this.noise(i * 0.075 + Math.random() * 0.02, 0.045, 0.0875, 1400 + Math.random() * 1600); this.noise(0.7, 0.08, 0.1, 900); },
    step(back) { this.tone(back ? 300 : 360 + Math.random() * 50, 0, 0.08, 'triangle', 0.06, back ? 220 : 260); },
    card() { this.noise(0, 0.18, 0.25, 3200); this.tone(700, 0.05, 0.12, 'sine', 0.05, 900); },
    good() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.3, 'sine', 0.11)); },
    bad() { this.tone(330, 0, 0.22, 'triangle', 0.1, 247); this.tone(247, 0.2, 0.32, 'triangle', 0.1, 185); },
    stay() { this.tone(440, 0, 0.18, 'sine', 0.08); this.tone(440, 0.22, 0.22, 'sine', 0.07); },
    shortcut() { [392, 523, 659].forEach((f, i) => this.tone(f, i * 0.14, 0.42, 'triangle', 0.1)); },
    turn() { this.tone(520, 0, 0.12, 'sine', 0.05); },
    gollum() { this.tone(190, 0, 0.12, 'sine', 0.07, 120); this.tone(160, 0.17, 0.15, 'sine', 0.06, 100); },
    rest() { [784, 988, 1175].forEach((f, i) => this.tone(f, i * 0.1, 0.5, 'sine', 0.07)); },
    eagle() { this.tone(1500, 0, 0.35, 'triangle', 0.05, 950); this.tone(1400, 0.42, 0.45, 'triangle', 0.045, 820); },
    swap() { this.noise(0, 0.5, 0.18, 900); this.tone(300, 0, 0.4, 'sine', 0.06, 700); this.tone(700, 0.1, 0.4, 'sine', 0.05, 300); },
    pop() { this.noise(0, 0.12, 0.15, 2400); this.tone(900 + Math.random() * 500, 0, 0.18, 'triangle', 0.02, 300); },
    hoom() { this.tone(98, 0, 0.9, 'sine', 0.12, 82); this.tone(147, 0.05, 0.8, 'sine', 0.05, 123); },
    rider() { [0, 0.17, 0.31, 0.5, 0.66, 0.8, 0.97, 1.11].forEach((t, i) => this.noise(t + Math.random() * 0.012, 0.05, 0.002 + (i % 2) * 0.0004, 700 + (i % 2) * 180)); },
    finish() { this.noise(0, 0.5, 0.25, 300); [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1 + i * 0.12, 0.45, 'triangle', 0.12)); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.13, 0.4, 'triangle', 0.13)); }
  };

  /* ============================================================
     SETUP SCREEN
     ============================================================ */
  const elCount = $('#player-count');
  const elSeats = $('#seats');
  const elLength = $('#road-length');
  const elAuto = $('#auto-tap');
  const elAutoSecs = $('#auto-secs');
  const elAutoSecsRow = $('#auto-secs-row');
  const elSummary = $('#summary');

  function buildSetup() {
    elCount.innerHTML = [2, 3, 4].map((n) =>
      '<button type="button" class="seg" role="radio" data-n="' + n + '" aria-label="' + n + ' players">' + n + '</button>').join('');

    elLength.innerHTML = LENGTH_IDS.map((k) =>
      '<button type="button" class="seg" role="radio" data-length="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</button>').join('');
    elLength.addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      settings.length = b.dataset.length;
      Sound.click(); refreshSetup(); save();
    });

    elAuto.innerHTML = '<button type="button" class="seg" role="radio" data-auto="off">Off</button>' +
      '<button type="button" class="seg" role="radio" data-auto="on">On</button>';
    elAutoSecs.innerHTML = [2, 5, 10].map((s) =>
      '<button type="button" class="seg" role="radio" data-secs="' + s + '">' + s + ' sec</button>').join('');
    elAuto.addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      settings.autoTap = b.dataset.auto === 'on';
      Sound.click(); refreshSetup(); save();
    });
    elAutoSecs.addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      settings.autoSecs = Number(b.dataset.secs);
      Sound.click(); refreshSetup(); save();
    });

    elSeats.innerHTML = [0, 1, 2, 3].map((i) =>
      '<div class="seat" data-i="' + i + '">' +
      '<span class="seat-n">Player ' + (i + 1) + '</span>' +
      '<div class="hobbit-pick" role="radiogroup" aria-label="Hobbit for player ' + (i + 1) + '">' +
      HB.list.map((h) => '<button type="button" class="hp" role="radio" data-h="' + h.id + '" style="--pc:' + h.color + '">' +
        HB.portrait(h, 'hp-face') + '<span class="hp-name">' + h.name + '</span><span class="hp-tag"></span></button>').join('') +
      '</div>' +
      '<div class="segmented small" role="radiogroup" aria-label="Who plays player ' + (i + 1) + '">' +
      '<button type="button" class="seg" role="radio" data-type="human">Person</button>' +
      '<button type="button" class="seg" role="radio" data-type="cpu">Computer</button></div>' +
      '</div>').join('');

    elCount.addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      settings.players = Number(b.dataset.n);
      Sound.click(); refreshSetup(); save();
    });
    elSeats.addEventListener('click', (e) => {
      const seat = e.target.closest('.seat');
      if (!seat) return;
      const i = Number(seat.dataset.i);
      const type = e.target.closest('[data-type]'), hp = e.target.closest('[data-h]');
      if (type) settings.types[i] = type.dataset.type;
      else if (hp) {
        // Choosing a hobbit another player has swaps the two players' hobbits.
        const want = hp.dataset.h, j = settings.hobbits.indexOf(want);
        settings.hobbits[j] = settings.hobbits[i];
        settings.hobbits[i] = want;
      } else return;
      Sound.click(); refreshSetup(); save();
    });
    $('#start-btn').addEventListener('click', () => { startIndex = 0; startGame(); });
    refreshSetup();
  }

  function refreshSetup() {
    resetSeries();   // any change on the settings screen starts a fresh run of games
    const mark = (root, attr, val) => root.querySelectorAll('[' + attr + ']').forEach((b) => {
      const on = b.getAttribute(attr) === String(val);
      b.classList.toggle('selected', on); b.setAttribute('aria-checked', on);
    });
    mark(elCount, 'data-n', settings.players);
    mark(elLength, 'data-length', settings.length);
    mark(elAuto, 'data-auto', settings.autoTap ? 'on' : 'off');
    mark(elAutoSecs, 'data-secs', settings.autoSecs);
    elAutoSecsRow.hidden = !settings.autoTap;
    elSeats.querySelectorAll('.seat').forEach((row, i) => {
      row.hidden = i >= settings.players;
      const mine = settings.hobbits[i];
      row.style.setProperty('--pc', HB.byId(mine).color);
      row.querySelectorAll('.hp').forEach((b) => {
        const id = b.dataset.h, owner = settings.hobbits.indexOf(id);
        const on = id === mine;
        b.classList.toggle('selected', on); b.setAttribute('aria-checked', on);
        const taken = !on && owner < settings.players;
        b.classList.toggle('taken', taken);
        $('.hp-tag', b).textContent = taken ? 'P' + (owner + 1) : '';
        b.setAttribute('aria-label', HB.byId(id).name + (taken ? ', chosen by player ' + (owner + 1) + ' (tap to swap)' : ''));
      });
      row.querySelectorAll('[data-type]').forEach((b) => {
        const on = b.dataset.type === settings.types[i];
        b.classList.toggle('selected', on); b.setAttribute('aria-checked', on);
      });
    });
    const names = [];
    for (let i = 0; i < settings.players; i++) names.push('<b>' + HB.byId(settings.hobbits[i]).name + '</b>' + (isCpu(i) ? ' (computer)' : ''));
    elSummary.innerHTML = settings.players + ' players: ' + names.join(', ') + ' · ' + settings.length.charAt(0).toUpperCase() + settings.length.slice(1) + ' road';
  }

  /* ============================================================
     GAME
     ============================================================ */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const elStage = $('#stage');
  const elWrap = $('#board-wrap');
  const elBoard = $('#board');
  const layer = (id) => $('#l-' + id, elBoard);
  const elPlayers = $('#players');
  const elToast = $('#toast');
  const elStatus = $('#status');
  const elRoll = $('#roll-btn');
  const elDie = $('#die');
  const elDieWrap = $('#die-wrap');

  // One road for each length, built the first time it is needed.
  const BOARDS = {};
  function boardFor(length) {
    if (BOARDS[length]) return BOARDS[length];
    const b = BOARD.build(length);
    // A short "where am I" name for every space: the nearest named place, or the shortcut it is on.
    const stopNodes = b.nodes.filter((n) => n.name);
    b.nodes.forEach((n) => {
      if (n.name) { n.place = 'At ' + n.name; return; }
      if (n.route !== 'main') { n.place = 'On the ' + BOARD.SHORTCUTS.find((sc) => sc.id === n.route).name; return; }
      let best = null, bd = Infinity;
      stopNodes.forEach((st) => { const d = Math.hypot(st.x - n.x, st.y - n.y); if (d < bd) { bd = d; best = st; } });
      n.place = 'Near ' + best.name;
    });
    b.startDist = b.dist[b.start];
    BOARDS[length] = b;
    return b;
  }
  let geo = boardFor('normal');
  let NODES = geo.nodes;
  let START_DIST = geo.startDist;

  let players = [];
  let current = 0;
  let gen = 0;          // bumped on every new game; stale timers and moves stop when it changes
  let startIndex = 0;   // rotates who goes first on "Next game"
  let playing = false;
  let awaitingRoll = false;
  let placesGiven = 0;
  let reactors = [];
  let look = null;
  let moved = false;    // has anything happened yet in this game (for the restart warning)
  let series = { wins: [0, 0, 0, 0], games: 0 };
  const resetSeries = () => { series = { wins: [0, 0, 0, 0], games: 0 }; };
  const winsText = (n) => n + (n === 1 ? ' win' : ' wins');

  const CANCEL = { cancelled: true };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const guard = (g) => { if (g !== gen) throw CANCEL; };
  const speed = () => SPEED;
  const pause = (ms) => sleep(ms * speed().pace);
  // Hold the game still while the Restart or Settings question is on screen.
  async function holdForQuestion(g) {
    while (modalKind === 'confirm') { await sleep(200); guard(g); }
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  /* ---------- parchment texture (made once) ---------- */
  (function parchment() {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      const img = x.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 200 + Math.random() * 55;
        img.data[i] = v; img.data[i + 1] = v * 0.93; img.data[i + 2] = v * 0.78; img.data[i + 3] = 26;
      }
      x.putImageData(img, 0, 0);
      for (let k = 0; k < 40; k++) {
        x.fillStyle = 'rgba(150,110,60,' + (Math.random() * 0.05).toFixed(3) + ')';
        x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 30, 0, 6.28); x.fill();
      }
      elStage.style.setProperty('--grain', 'url(' + c.toDataURL() + ')');
    } catch (e) { /* plain parchment colour is fine */ }
  })();

  /* ---------- drawing the board ---------- */
  function spaceSVG(n, i) {
    let cls = 'space k-' + n.kind + (n.card ? ' is-card' : '') + (n.rest ? ' is-rest' : '') + (n.route !== 'main' ? ' r-' + n.route : '');
    let inner;
    if (n.kind === 'start') {
      inner = '<circle class="sp-ring" r="24"/><circle class="sp-base" r="20"/>' +
        '<circle r="11" fill="#3f7d3a" stroke="#22401f" stroke-width="1.4"/><circle r="2.2" fill="#f1c84b"/>';
    } else if (n.kind === 'finish') {
      inner = '<circle class="sp-glow" r="34"/><circle class="sp-ring" r="25"/><circle class="sp-base" r="21"/>' +
        '<circle r="10" fill="none" stroke="#e8b43a" stroke-width="4.5"/><circle r="10" fill="none" stroke="#fff1a8" stroke-width="1.2" opacity=".8"/>';
    } else if (n.kind === 'fork') {
      inner = '<circle class="sp-ring" r="20"/><circle class="sp-base" r="17"/>' +
        '<path d="M0,10 V-11" stroke="#5a3d22" stroke-width="2.4"/>' +
        '<path d="M-1,-11 H9 L13,-7.5 L9,-4 H-1 Z" fill="#f3e6c4" stroke="#5a3d22" stroke-width="1.2"/>' +
        '<path d="M1,-2 H-9 L-13,1.5 L-9,5 H1 Z" fill="#f3e6c4" stroke="#5a3d22" stroke-width="1.2"/>';
    } else if (n.rest) {
      // a resting place: +1 on the next roll
      inner = '<circle class="sp-ring" r="20"/><circle class="sp-base" r="17"/>' +
        '<path d="M-7,5 C-9,-5 -1,-11 8,-9 C8,-1 2,6 -7,5 Z" fill="#5fae6a" stroke="#2e6b3a" stroke-width="1.2"/>' +
        '<path d="M-7,5 L5,-6" stroke="#2e6b3a" stroke-width="1"/>' +
        '<text class="sp-plus" x="10" y="14" text-anchor="middle">+1</text>';
    } else if (n.card) {
      inner = '<circle class="sp-base" r="16"/>' +
        '<g transform="rotate(-8)"><rect x="-6.5" y="-9" width="13" height="18" rx="2.2" fill="#fff8e2" stroke="#7a2f1a" stroke-width="1.3"/>' +
        '<path d="M0,-5 L3.2,0 L0,5 L-3.2,0 Z" fill="#b8342a"/></g>';
    } else {
      inner = '<circle class="sp-base" r="16"/><circle class="sp-shine" cx="-5" cy="-6" r="5"/>';
    }
    return '<g transform="translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')"><g class="' + cls + '" data-id="' + n.id + '" style="animation-delay:' + (i * 9) + 'ms">' +
      '<ellipse class="sp-shadow" cx="1.5" cy="3" rx="17" ry="13"/>' + inner + '</g></g>';
  }

  function renderBoard() {
    look = BOARD.dress(geo);
    layer('terrain').innerHTML = BOARD.terrainHTML() + BOARD.cartoucheHTML();
    layer('scenery').innerHTML = look.sceneryHTML;
    layer('landmarks').innerHTML = look.landmarkHTML;
    layer('road').innerHTML = BOARD.roadHTML(geo);
    layer('labels').innerHTML = BOARD.labelsHTML(geo);
    layer('spaces').innerHTML = NODES.map(spaceSVG).join('');
    layer('sky').innerHTML = look.skyHTML;
    layer('tokens').innerHTML = '';
    layer('fx').innerHTML = '';
    layer('fx-under').innerHTML = '';
    layer('critters').innerHTML = '';
    layer('weather').innerHTML = '';
    layer('tint').setAttribute('fill', look.time.tint);
    elStage.dataset.season = look.season.name.toLowerCase();
    elStage.dataset.time = Object.keys({ morning: 1, midday: 1, evening: 1 }).find((k) => look.time.name.toLowerCase() === k) || 'midday';
    reactors = [...elBoard.querySelectorAll('[data-rx]')].map((el) => ({ el, x: Number(el.dataset.x), y: Number(el.dataset.y), r: Number(el.dataset.r) || 100 }));
    elStage.classList.remove('intro'); void elStage.offsetWidth; elStage.classList.add('intro');
  }

  /* ---------- tokens ---------- */
  function makeToken(p) {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'token');
    g.innerHTML = '<g class="tk-ring"><ellipse rx="19" ry="7" fill="none" stroke="' + p.h.color + '" stroke-width="3"/></g>' +
      '<ellipse class="tk-shadow" cx="0" cy="0" rx="13" ry="4.4"/>' +
      '<g class="tk-lift"><g class="tk-face"><g transform="scale(1.02)">' + HB.figure(p.h) + '</g></g>' +
      // the hobbit's initial on the jacket; outside tk-face so it never shows mirrored
      '<text class="tk-letter" x="0" y="-9.6" text-anchor="middle">' + p.name.charAt(0) + '</text></g>' +
      '<g class="tk-badge" transform="translate(13,-50)" display="none"><circle r="10" fill="#f6c453" stroke="#7a4a12" stroke-width="1.6"/>' +
      '<text y="4.2" text-anchor="middle" class="tk-badge-n"></text></g>';
    layer('tokens').appendChild(g);
    p.el = g;
    p.liftEl = $('.tk-lift', g);
    p.faceEl = $('.tk-face', g);
    p.shadowEl = $('.tk-shadow', g);
    p.x = NODES[p.node].x; p.y = NODES[p.node].y; p.h0 = 0; p.sx = 1; p.sy = 1; p.dir = 1;
    drawToken(p);
  }
  function drawToken(p) {
    p.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')');
    p.liftEl.setAttribute('transform', 'translate(0,' + (-p.h0).toFixed(1) + ') rotate(' + (p.rot || 0).toFixed(1) + ') scale(' + p.sx.toFixed(3) + ',' + p.sy.toFixed(3) + ')');
    p.faceEl.setAttribute('transform', 'scale(' + p.dir + ',1)');
    const k = 1 - Math.min(0.5, p.h0 / 60);
    p.shadowEl.setAttribute('transform', 'scale(' + k.toFixed(3) + ')');
  }

  // Where tokens sharing a space stand, so they never hide each other.
  const SLOTS = { 1: [[0, 0]], 2: [[-11, -2], [11, 2]], 3: [[-13, 2], [13, 2], [0, -9]], 4: [[-12, -6], [12, -6], [-12, 7], [12, 7]] };
  function slotFor(p) {
    // a token that is walking away does not hold a place on the space it is leaving
    const here = players.filter((q) => q.node === p.node && (q === p || !q.active));
    const k = Math.min(4, here.length);
    const s = SLOTS[k][here.indexOf(p)] || [0, 0];
    return [NODES[p.node].x + s[0], NODES[p.node].y + s[1]];
  }
  function tween(p, tx, ty, ms) {
    const fx = p.x, fy = p.y, t0 = performance.now();
    if (ms <= 0 || reduceMotion()) { p.x = tx; p.y = ty; drawToken(p); return Promise.resolve(); }
    return new Promise((res) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
        p.x = fx + (tx - fx) * e; p.y = fy + (ty - fy) * e; drawToken(p);
        if (t < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  function settle(nodeId, except, ms) {
    const list = players.filter((q) => q.node === nodeId && q !== except);
    // tokens further down the screen are drawn in front
    return Promise.all(list.map((q) => { const [x, y] = slotFor(q); return tween(q, x, y, ms == null ? 220 : ms); })).then(() => sortTokens());
  }
  function sortTokens() {
    const layerEl = layer('tokens');
    players.slice().sort((a, b) => (a.active ? 1 : 0) - (b.active ? 1 : 0) || a.y - b.y).forEach((q) => layerEl.appendChild(q.el));
  }

  function hop(p, toId, back) {
    const from = [p.x, p.y], to = [NODES[toId].x, NODES[toId].y];
    const dur = speed().hop * (back ? 1.1 : 1);
    if (Math.abs(to[0] - from[0]) > 2) p.dir = to[0] < from[0] ? -1 : 1;
    const t0 = performance.now(), lift = back ? 14 : 22;
    lookAt(to[0], to[1]);
    return new Promise((res) => {
      if (reduceMotion()) { p.x = to[0]; p.y = to[1]; p.node = toId; drawToken(p); landFx(p, back); return res(); }
      let landed = false;
      const step = (now) => {
        const raw = (now - t0) / dur;
        const t = Math.min(1, raw);
        p.x = from[0] + (to[0] - from[0]) * t;
        p.y = from[1] + (to[1] - from[1]) * t;
        p.h0 = Math.sin(Math.PI * t) * lift;
        p.sx = 0.96; p.sy = 1.05;
        if (t >= 1) {
          if (!landed) { landed = true; p.node = toId; landFx(p, back); }
          const s = Math.min(1, (raw - 1) / 0.35);   // a little squash on landing
          p.h0 = 0; p.sy = 1 - 0.14 * Math.sin(Math.PI * s); p.sx = 1 + 0.1 * Math.sin(Math.PI * s);
          if (s >= 1) { p.sx = 1; p.sy = 1; drawToken(p); return res(); }
        }
        drawToken(p);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function landFx(p, back) {
    Sound.step(back);
    dust(p.x, p.y);
    react(p.x, p.y);
  }

  // Move a token: positive steps go forward, negative steps go back along the way it came.
  async function move(p, steps, g) {
    if (!steps) return;
    const startNode = p.node;
    p.active = true;
    sortTokens();
    settleLater(startNode, p);
    const [cx, cy] = [NODES[p.node].x, NODES[p.node].y];
    await tween(p, cx, cy, 120);
    guard(g);
    if (steps > 0) {
      for (let i = 0; i < steps; i++) {
        const n = NODES[p.node];
        if (n.kind === 'finish') break;
        // A move that starts on a fork takes the shortcut. A move that only passes it does not.
        const next = i === 0 && n.fork ? n.alt : n.next;
        if (next == null) break;
        await holdForQuestion(g);
        if (i === 0 && n.fork) highlightShortcut(n.fork);
        await hop(p, next, false);
        guard(g);
        p.trail.push(next);
        updatePlayers();
      }
    } else {
      for (let i = 0; i < -steps; i++) {
        if (p.trail.length <= 1) break;
        await holdForQuestion(g);
        p.trail.pop();
        await hop(p, p.trail[p.trail.length - 1], true);
        guard(g);
        updatePlayers();
      }
    }
    p.active = false;
    await settle(p.node, null, 200);
    guard(g);
  }
  function settleLater(nodeId, except) { setTimeout(() => settle(nodeId, except), 60); }

  /* ---------- the scenery reacts ---------- */
  function react(x, y) {
    reactors.forEach((r) => {
      if (Math.abs(r.x - x) > r.r || Math.abs(r.y - y) > r.r || Math.hypot(r.x - x, r.y - y) > r.r) return;
      const el = r.el;
      if (el.classList.contains('react')) return;
      el.classList.add('react');
      clearTimeout(el._rxTimer);
      el._rxTimer = setTimeout(() => el.classList.remove('react'), 2400);
    });
  }
  function lookAt(x, y) {
    const pupil = $('#eye-pupil', elBoard);
    if (!pupil) return;
    const dx = x - 1566, dy = y - 442, d = Math.hypot(dx, dy) || 1;
    pupil.style.transform = 'translate(' + (dx / d * 9).toFixed(1) + 'px,' + (dy / d * 2.5).toFixed(1) + 'px)';
  }
  function highlightShortcut(id) {
    const roads = layer('road').querySelectorAll('path');
    const idx = BOARD.SHORTCUTS.findIndex((s) => s.id === id) + 1;   // roads: main first, then shortcuts (2 paths each)
    const el = roads[idx * 2 + 1];
    if (!el) return;
    el.classList.remove('lit'); void el.getBoundingClientRect(); el.classList.add('lit');
    setTimeout(() => el.classList.remove('lit'), 2600);
  }

  /* ---------- little effects ---------- */
  function fxEl(parent, tag, attrs, life) {
    const el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    parent.appendChild(el);
    setTimeout(() => el.remove(), life || 900);
    return el;
  }
  function dust(x, y) {
    if (reduceMotion()) return;
    const under = layer('fx-under');
    for (let i = 0; i < 3; i++) {
      fxEl(under, 'circle', { cx: (x + (i - 1) * 7).toFixed(1), cy: (y + 2).toFixed(1), r: 4, class: 'dust', style: '--dx:' + ((i - 1) * 9) + 'px' }, 700);
    }
  }
  function sparkle(x, y, color, count) {
    if (reduceMotion()) return;
    const fx = layer('fx');
    for (let i = 0; i < (count || 12); i++) {
      const a = (i / (count || 12)) * Math.PI * 2 + Math.random() * 0.4, d = 26 + Math.random() * 26;
      fxEl(fx, 'circle', { cx: x.toFixed(1), cy: (y - 18).toFixed(1), r: (2 + Math.random() * 2.4).toFixed(1), fill: color || '#ffe27a', class: 'spark',
        style: '--dx:' + (Math.cos(a) * d).toFixed(1) + 'px;--dy:' + (Math.sin(a) * d).toFixed(1) + 'px;animation-delay:' + (Math.random() * 80).toFixed(0) + 'ms' }, 1100);
    }
  }
  function eruption() {
    if (reduceMotion()) return;
    const fx = layer('fx');
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, d = 60 + Math.random() * 90;
      fxEl(fx, 'circle', { cx: 1480, cy: 778, r: (2.5 + Math.random() * 4).toFixed(1), fill: Math.random() < 0.5 ? '#ff6a1a' : '#ffd34d', class: 'lava-drop',
        style: '--dx:' + (Math.cos(a) * d).toFixed(1) + 'px;--dy:' + (Math.sin(a) * d).toFixed(1) + 'px;animation-delay:' + (Math.random() * 300).toFixed(0) + 'ms' }, 1800);
    }
    elStage.classList.remove('quake'); void elStage.offsetWidth; elStage.classList.add('quake');
  }

  /* ---------- passing birds ---------- */
  // Every so often a small flock flies right across the map.
  function scheduleBirds(g) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion() && elLayer.hidden) flyby();
      scheduleBirds(g);
    }, 14000 + Math.random() * 20000);
  }
  function flyby() {
    const leftToRight = Math.random() < 0.5;
    const y0 = 70 + Math.random() * 620, y1 = y0 + (Math.random() - 0.5) * 300;
    const x0 = leftToRight ? -60 : BOARD.W + 60, x1 = leftToRight ? BOARD.W + 60 : -60;
    const dur = 9 + Math.random() * 5;
    const k = 3 + Math.floor(Math.random() * 4);
    let birds = '';
    for (let i = 0; i < k; i++) {
      const bx = (leftToRight ? -1 : 1) * (i * 16 + Math.random() * 10), by = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 11 + Math.random() * 6;
      const s = 0.9 + Math.random() * 0.4;
      birds += '<g transform="translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ') scale(' + s.toFixed(2) + ')">' +
        '<path class="wing" style="animation-delay:-' + (Math.random() * 0.4).toFixed(2) + 's" d="M-7,0 q3.5,-5 7,0 q3.5,-5 7,0" stroke="#3b2a1c" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>';
    }
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x0 + ',' + y0.toFixed(0) + ')');
    g.innerHTML = '<g class="flyby" style="--fx:' + (x1 - x0) + 'px;--fy:' + (y1 - y0).toFixed(0) + 'px;--dur:' + dur.toFixed(1) + 's">' + birds + '</g>';
    layer('sky').appendChild(g);
    setTimeout(() => g.remove(), dur * 1000 + 500);
  }
  // A few birds that wander about the map on their own curvy paths, each at its own speed.
  function scheduleWander(g) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion() && elLayer.hidden) wanderBirds();
      scheduleWander(g);
    }, 9000 + Math.random() * 11000);
  }
  function wanderBirds() {
    const rand = (a, b) => a + Math.random() * (b - a);
    const count = 1 + Math.floor(Math.random() * 3);
    for (let b = 0; b < count; b++) {
      const s = 0.9 + Math.random() * 0.4;
      const g = document.createElementNS(SVGNS, 'g');
      g.innerHTML = '<path class="wing" style="animation-delay:-' + (Math.random() * 0.4).toFixed(2) + 's" d="M-7,0 q3.5,-5 7,0 q3.5,-5 7,0" stroke="#3b2a1c" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      layer('sky').appendChild(g);
      // enter from off the edge of the map, glide along a gently curving path at a steady speed, leave off the edge
      let x = rand(200, 1400), y = -60, h = Math.PI / 2 + rand(-0.6, 0.6);
      if (Math.random() < 0.5) { x = rand(200, 1400); y = 980; h = -Math.PI / 2 + rand(-0.6, 0.6); }
      else if (Math.random() < 0.5) { x = -60; y = rand(100, 800); h = rand(-0.5, 0.5); }
      else { x = 1660; y = rand(100, 800); h = Math.PI + rand(-0.5, 0.5); }
      const pts = [[x, y]];
      let len = 0;
      for (let i = 0; i < 9; i++) {
        h += rand(-0.3, 0.3);   // the heading changes a little at each step, so the path curves smoothly
        const step = rand(220, 300);
        const nx = x + Math.cos(h) * step, ny = y + Math.sin(h) * step;
        len += step;
        x = nx; y = ny;
        pts.push([x, y]);
        if (x < -80 || x > 1680 || y < -80 || y > 1000) break;   // it has flown off the map
      }
      const speed = 55 + Math.random() * 35;   // random speed in map units per second
      const dur = (len / speed) * 1000;
      let acc = 0;
      const frames = pts.map(([px, py], i) => {
        if (i > 0) acc += Math.hypot(px - pts[i - 1][0], py - pts[i - 1][1]);
        return { offset: Math.min(1, acc / Math.max(1, len)), transform: 'translate(' + px.toFixed(0) + 'px,' + py.toFixed(0) + 'px) scale(' + s.toFixed(2) + ')' };
      });
      const anim = g.animate(frames, { duration: dur, easing: 'linear' });
      anim.onfinish = () => g.remove();
    }
  }

  /* ---------- Gollum peeks out ---------- */
  // Now and then Gollum peeks out from behind a rock a little ahead of the leading hobbit.
  let gollumCount = 0;
  function peekGollum(target) {
    const left = players.filter((p) => !p.place);
    if (!left.length) return false;
    const leader = target || left.reduce((a, b) => (geo.dist[b.node] < geo.dist[a.node] ? b : a));
    // look a few spaces ahead of the leader (or right next to the hobbit he is after)
    let anchor = NODES[leader.node];
    if (!target) for (let i = 0, ahead = 2 + Math.floor(Math.random() * 3); i < ahead && anchor.next != null; i++) anchor = NODES[anchor.next];
    const roadMids = NODES.filter((n) => n.next != null).map((n) => [(n.x + NODES[n.next].x) / 2, (n.y + NODES[n.next].y) / 2]);
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const a = Math.random() * Math.PI * 2, d = 52 + Math.random() * 34;
      const x = anchor.x + Math.cos(a) * d, y = anchor.y + Math.sin(a) * d;
      if (x < 60 || x > BOARD.W - 60 || y < 70 || y > BOARD.H - 20) continue;
      if (NODES.some((n) => Math.hypot(n.x - x, n.y - y + 14) < 40)) continue;
      if (roadMids.some((m) => Math.hypot(m[0] - x, m[1] - y + 14) < 32)) continue;
      if (players.some((p) => Math.hypot(p.x - x, p.y - y) < 44)) continue;
      spot = [x, y];
    }
    if (!spot) return false;
    const [x, y] = spot;
    // his eyes turn toward the leading hobbit
    const dx = leader.x - x, dy = leader.y - 20 - (y - 25), dd = Math.hypot(dx, dy) || 1;
    const px = (dx / dd * 2).toFixed(1), py = (dy / dd * 1.6).toFixed(1);
    const id = 'gclip' + (++gollumCount);
    const say = Math.random() < 0.6 ? (Math.random() < 0.5 ? 'Precious…' : 'My precious…') : '';
    const flip = x > BOARD.W - 160;
    const ex = Math.max(-1.4, Math.min(1.4, Number(px))), ey = Math.max(-1.2, Math.min(1.2, Number(py)));
    // big pale bulging eyes with small pupils
    const eye = (cx) => '<ellipse cx="' + cx + '" cy="-27.5" rx="4" ry="4.6" fill="#e9f0de" stroke="#6d6a50" stroke-width=".7"/>' +
      '<circle cx="' + (cx + ex).toFixed(1) + '" cy="' + (-27.5 + ey).toFixed(1) + '" r="1.9" fill="#8fb3b0"/>' +
      '<circle cx="' + (cx + ex).toFixed(1) + '" cy="' + (-27.5 + ey).toFixed(1) + '" r="1" fill="#101410"/>' +
      '<circle cx="' + (cx + ex - 0.6).toFixed(1) + '" cy="' + (-28.2 + ey).toFixed(1) + '" r=".45" fill="#fff"/>' +
      '<ellipse class="g-lid" cx="' + cx + '" cy="-27.5" rx="4.2" ry="4.8" fill="#b9b496"/>';
    // long skinny fingers hooked over the top of the rock
    const fingers = (cx, by) => {
      let d = '';
      [-4.2, -1.4, 1.4, 4.2].forEach((o) => { d += 'M' + (cx + o).toFixed(1) + ',' + (by - 2.6).toFixed(1) + ' q.7,-1.6 1.3,0 l.2,3.6 '; });
      return '<path d="' + d + '" stroke="#6d6a50" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="' + d + '" stroke="#cbc6a7" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    };
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(1.15)');
    g.setAttribute('class', 'critter');
    g.innerHTML =
      '<clipPath id="' + id + '"><rect x="-40" y="-80" width="80" height="80"/></clipPath>' +
      '<ellipse cx="0" cy="1" rx="26" ry="5" fill="rgba(70,45,15,.2)"/>' +
      '<g clip-path="url(#' + id + ')"><g class="gollum-peek">' +
      '<path d="M-14,-11 Q-10,-17 -3,-16 L3,-16 Q10,-17 14,-11 Z" fill="#bdb898" stroke="#7d7a5e" stroke-width=".7"/>' +
      '<path d="M-9.2,-25.5 Q-14,-27 -16.5,-31.5 Q-12.5,-30.6 -9.2,-30.4 Z M9.2,-25.5 Q14,-27 16.5,-31.5 Q12.5,-30.6 9.2,-30.4 Z" fill="#bdb898" stroke="#7d7a5e" stroke-width=".7"/>' +
      '<path d="M0,-39.5 C7,-39.5 10,-33 9.6,-27 C9.2,-20 5,-14.5 0,-14.5 C-5,-14.5 -9.2,-20 -9.6,-27 C-10,-33 -7,-39.5 0,-39.5 Z" fill="#c9c4a5" stroke="#7d7a5e" stroke-width=".8"/>' +
      '<ellipse cx="-6" cy="-20.5" rx="2" ry="3.2" fill="#8f8a6c" opacity=".35"/><ellipse cx="6" cy="-20.5" rx="2" ry="3.2" fill="#8f8a6c" opacity=".35"/>' +
      '<path d="M-2,-39.2 q-5,2 -8,9 M1,-39.5 q-1,4 -4,6 M3,-39.2 q5,2 7.5,10 M-6,-36 q-4.5,6 -3.5,15 M6.5,-35.5 q4.5,6 3.5,14 M0,-39.5 q1,-3 3,-3.5" stroke="#3b3729" stroke-width=".65" fill="none" stroke-linecap="round"/>' +
      eye(-4.3) + eye(4.3) +
      '<path d="M-8,-31.8 Q-4.5,-34.2 -1,-32 M1,-32 Q4.5,-34.2 8,-31.8" stroke="#7d7a5e" stroke-width=".9" fill="none" stroke-linecap="round"/>' +
      '<circle cx="-1" cy="-22" r=".55" fill="#4a4636"/><circle cx="1" cy="-22" r=".55" fill="#4a4636"/>' +
      '<path d="M-5.6,-19 Q0,-15.2 5.6,-19 Q0,-17.4 -5.6,-19 Z" fill="#3a2a22"/>' +
      '<path d="M-3.2,-18.4 h1.2 v1.2 h-1.2 Z M-0.9,-18.1 h1.1 v1.3 h-1.1 Z M1.6,-18.4 h1.1 v1.1 h-1.1 Z" fill="#f2ecd0"/>' +
      '</g></g>' +
      '<path d="M-26,0 L-22,-12 L-9,-17 L6,-15.5 L19,-10 L26,0 Z" fill="#a39d8f" stroke="#6b665c" stroke-width="1"/>' +
      '<path d="M6,-15.5 L19,-10 L26,0 L8,0 Z" fill="#8a8476"/>' +
      '<g clip-path="url(#' + id + ')"><g class="gollum-peek">' +
      fingers(-13.5, -14.6) + fingers(13, -11.6) +
      '</g></g>' +
      (say ? '<g class="g-bubble"><rect x="' + (flip ? -96 : 18) + '" y="-62" width="78" height="22" rx="10" fill="#fffaf0" stroke="#6d6a50" stroke-width="1"/>' +
        '<text x="' + (flip ? -57 : 57) + '" y="-46.5" text-anchor="middle" class="g-say">' + say + '</text></g>' : '');
    layer('critters').appendChild(g);
    setTimeout(() => Sound.gollum(), 500);
    setTimeout(() => g.remove(), 4600);
    return true;
  }

  /* ---------- visitors: Gollum, Gandalf, an eagle, a Black Rider, an Ent ---------- */
  // Every few turns one visitor may appear. They are only for show.
  let turnsSinceVisitor = 0;
  let visitorBusyUntil = 0;
  const VISITORS = [
    { id: 'gollum', weight: 3, run: () => peekGollum() && 4600 },
    { id: 'gandalf', weight: 2, run: () => gandalfCart() },
    { id: 'eagle', weight: 2, run: () => eagleFly(960, -70, 1230, 150, 1700, 330, 9, 1) && 9500 },
    { id: 'rider', weight: 2, run: () => blackRider() },
    { id: 'ent', weight: 2, run: () => entWalk() }
  ];
  function maybeVisitor() {
    turnsSinceVisitor++;
    if (reduceMotion() || performance.now() < visitorBusyUntil) return;
    if (turnsSinceVisitor < 3 || Math.random() > 0.35) return;
    const pool = VISITORS.slice();
    while (pool.length) {
      let total = 0;
      pool.forEach((v) => { total += v.weight; });
      let r = Math.random() * total, i = 0;
      while ((r -= pool[i].weight) > 0) i++;
      const ms = pool[i].run();
      if (ms) { turnsSinceVisitor = 0; visitorBusyUntil = performance.now() + ms; return; }
      pool.splice(i, 1);
    }
  }
  // a visitor walking across the map: an outer group placed at the start, an inner group that moves
  function walker(layerId, x0, y0, dx, dy, dur, flip, inner, cls) {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x0 + ',' + y0 + ')');
    g.innerHTML = '<g class="walker ' + (cls || '') + '" style="--wx:' + dx + 'px;--wy:' + dy + 'px;--dur:' + dur + 's">' +
      '<g transform="scale(' + (flip ? -1 : 1) + ',1)">' + inner + '</g></g>';
    layer(layerId).appendChild(g);
    setTimeout(() => g.remove(), dur * 1000 + 300);
    return g;
  }

  // Gandalf's cart rolls through the Shire, letting off fireworks.
  function gandalfCart() {
    const x0 = -40, x1 = 250, y = 346, dur = 10;
    const wheel = (cx) => '<g transform="translate(' + cx + ',-6)"><g class="wheel"><circle r="6" fill="#6b4a2b" stroke="#3a2614" stroke-width="1.2"/>' +
      '<path d="M-6,0 H6 M0,-6 V6 M-4.2,-4.2 L4.2,4.2 M-4.2,4.2 L4.2,-4.2" stroke="#3a2614" stroke-width="1"/></g></g>';
    const art = '<ellipse cx="4" cy="1" rx="38" ry="5" fill="rgba(70,45,15,.2)"/>' +
      // horse
      '<g class="trot"><path d="M20,0 v-9 M25,0 v-9 M34,0 v-9 M38,0 v-9" stroke="#8a8a86" stroke-width="2.4"/>' +
      '<ellipse cx="29" cy="-12" rx="11" ry="5.5" fill="#a9a9a4"/><path d="M37,-14 L42,-24 L46,-22 L42,-12 Z" fill="#a9a9a4"/>' +
      '<path d="M40,-24 l-3,-3" stroke="#6d6d68" stroke-width="2"/><path d="M18,-12 q-4,2 -3,7" stroke="#6d6d68" stroke-width="2" fill="none"/></g>' +
      // shafts and cart
      '<path d="M10,-12 L22,-12" stroke="#5a3d22" stroke-width="1.6"/>' +
      '<rect x="-24" y="-20" width="34" height="13" rx="2" fill="#9a6a3a" stroke="#5a3d22" stroke-width="1.2"/>' +
      '<path d="M-20,-20 v-6 M-15,-20 v-8 M-10,-20 v-5" stroke="#c8433a" stroke-width="3"/><path d="M-20,-26 v-2 M-15,-28 v-2" stroke="#2f6fc0" stroke-width="3"/>' +
      wheel(-16) + wheel(4) +
      // Gandalf: grey robe, white beard, tall pointed hat
      '<path d="M-3,-20 L-11,-20 L-9,-38 L-3,-38 Z" fill="#8e8e94" stroke="#5f5f66" stroke-width=".8"/>' +
      '<circle cx="-6" cy="-41" r="3.6" fill="#f0c9a3"/>' +
      '<path d="M-9,-40 Q-6,-30 -3,-40 Z" fill="#f6f6f2"/>' +
      '<ellipse cx="-6" cy="-44" rx="7.5" ry="1.8" fill="#77777e"/>' +
      '<path d="M-10,-44 L-5,-58 Q-3,-62 1,-60 L-2,-44 Z" fill="#8e8e94" stroke="#5f5f66" stroke-width=".8"/>';
    walker('critters', x0, y, x1 - x0, 6, dur, false, art, 'cart');
    // fireworks along the way
    [0.25, 0.48, 0.72].forEach((t) => setTimeout(() => {
      if (!playing) return;
      firework(x0 + (x1 - x0) * t - 6, y - 70 - Math.random() * 50);
    }, dur * 1000 * t));
    return dur * 1000 + 300;
  }

  // A burst of fireworks, Shire-style.
  const FIREWORK_COLORS = ['#ff5d6c', '#ffd34d', '#7fd3ff', '#9fe08a', '#c79bff', '#ffffff'];
  function firework(x, y, color) {
    if (reduceMotion()) return;
    const fx = layer('fx');
    const c1 = color || FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const c2 = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    fxEl(fx, 'line', { x1: x, y1: y + 60, x2: x, y2: y + 60, stroke: '#ffe9a8', 'stroke-width': 2, class: 'rocket', style: '--rise:-60px' }, 500);
    setTimeout(() => {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2, d = 26 + Math.random() * 22;
        fxEl(fx, 'circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (1.8 + Math.random() * 1.6).toFixed(1), fill: i % 2 ? c1 : c2, class: 'burst',
          style: '--dx:' + (Math.cos(a) * d).toFixed(1) + 'px;--dy:' + (Math.sin(a) * d).toFixed(1) + 'px' }, 1500);
      }
    }, 420);
  }
  function fireworksAt(x, y, n) {
    for (let i = 0; i < (n || 3); i++) setTimeout(() => firework(x + (Math.random() - 0.5) * 90, y - 50 - Math.random() * 50), i * 450);
  }

  // A great eagle glides over. It passes through (mx, my) on its way from (x0, y0) to (x1, y1).
  function eagleArt(k) {
    return '<g transform="scale(' + k + ')"><ellipse cx="0" cy="44" rx="34" ry="6" fill="rgba(40,25,10,.12)"/>' +
      '<g class="eagle-wings"><path d="M0,0 C-14,-10 -36,-12 -56,-4 C-40,-4 -30,0 -24,4 C-34,4 -42,8 -48,12 C-30,8 -14,8 0,6 Z" fill="#6b4a2b" stroke="#3a2614" stroke-width="1"/>' +
      '<path d="M0,0 C14,-10 36,-12 56,-4 C40,-4 30,0 24,4 C34,4 42,8 48,12 C30,8 14,8 0,6 Z" fill="#6b4a2b" stroke="#3a2614" stroke-width="1"/></g>' +
      '<ellipse cx="0" cy="3" rx="8" ry="11" fill="#7a5532"/>' +
      '<circle cx="0" cy="-8" r="5.5" fill="#e9dcc0"/><path d="M0,-6 l2.5,4 l-4,-1 Z" fill="#e8b43a"/>' +
      '<circle cx="-1.8" cy="-9" r=".9" fill="#1a1208"/><circle cx="1.8" cy="-9" r=".9" fill="#1a1208"/>' +
      '<path d="M-5,13 l-3,7 M5,13 l3,7" stroke="#e8b43a" stroke-width="1.6"/></g>';
  }
  function eagleFly(x0, y0, mx, my, x1, y1, dur, k) {
    if (reduceMotion()) return false;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x0 + ',' + y0 + ')');
    g.innerHTML = '<g class="eagle-fly" style="--mx:' + (mx - x0) + 'px;--my:' + (my - y0) + 'px;--fx:' + (x1 - x0) + 'px;--fy:' + (y1 - y0) + 'px;--dur:' + dur + 's">' + eagleArt(k || 1) + '</g>';
    layer('sky').appendChild(g);
    setTimeout(() => Sound.eagle(), dur * 300);
    setTimeout(() => g.remove(), dur * 1000 + 300);
    return true;
  }

  // A Black Rider gallops across the Lone-lands near Bree.
function blackRider(x0 = 800, x1 = 616, y = 392, dur = 7, dy = -4) {
    const horse = '<g class="gallop">' +
      '<path class="leg-a" d="M9,-12 L11,0" stroke="#0f0b0d" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M13,-12 L15,0" stroke="#0f0b0d" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M-10,-12 L-12,0" stroke="#0f0b0d" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path class="leg-a" d="M-6,-12 L-6,0" stroke="#0f0b0d" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path class="trot" d="M-14,-22 Q-24,-20 -22,-8 Q-20,-14 -14,-14 Z" fill="#0a0708"/>' +
      '<path d="M-14,-18 Q-14,-26 -4,-26 L10,-26 Q16,-26 16,-19 Q16,-13 8,-13 L-7,-13 Q-14,-13 -14,-18 Z" fill="#17120f"/>' +
      '<path d="M9,-25 L15,-40 L21,-38 L15,-19 Z" fill="#17120f"/>' +
      '<path d="M14,-42 Q18,-46 24,-42 L30,-37 Q31,-34 27,-34 L21,-35 L15,-33 Z" fill="#17120f"/>' +
      '<path d="M11,-41 Q7,-34 10,-26 L12,-30 Q10,-36 14,-42 Z" fill="#050405"/>' +
      '<circle cx="22" cy="-40" r=".8" fill="#e33"/>' +
      '<path d="M-2,-26 L5,-22 M2,-26 L0,-14" stroke="#0a0708" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
      '<path d="M-5,-27 Q-8,-40 -4,-52 L4,-52 Q7,-40 5,-27 Z" fill="#0c0a0b"/>' +
      '<path d="M-5,-27 Q-11,-26 -13,-20 M5,-27 Q11,-26 13,-22" stroke="#0c0a0b" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M3,-46 Q10,-42 12,-37" stroke="#0c0a0b" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M12,-37 L19,-63" stroke="#b9c2c6" stroke-width="1"/>' +
      '<path d="M-5,-50 C-6,-64 -2,-69 1,-68 C5,-67 6,-61 5,-51 Z" fill="#0c0a0b"/>' +
      '<path d="M-0.5,-58 Q1.5,-56 3,-58" stroke="#d8e6e0" stroke-width=".8" fill="none"/>' +
      '</g>';
    const art = SHADOW(22) + horse +
      '<g class="rider-mist">' + [0, 1, 2].map((i) => '<circle cx="' + (-24 - i * 9) + '" cy="-4" r="' + (5 + i * 2) + '" fill="#3a3436" opacity=".25"/>').join('') + '</g>';
    walker('critters', x0, y, x1 - x0, dy, dur, x1 < x0, art, 'rider');
    Sound.rider();
    return dur * 1000 + 300;
  }

    // An Ent wakes up in Fangorn, takes a few slow steps, then goes still again.
  function entWalk() {
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const x = 870 + Math.random() * 110, y = 430 + Math.random() * 110;
      if (NODES.some((n) => Math.hypot(n.x - x, n.y - (y - 30)) < 56)) continue;
      if (players.some((p) => Math.hypot(p.x - x, p.y - y) < 50)) continue;
      spot = [x, y];
    }
    if (!spot) return false;
    const art = '<ellipse cx="0" cy="1" rx="16" ry="4" fill="rgba(40,30,10,.25)"/>' +
      '<g class="ent-body">' +
      '<path d="M-7,0 L-9,-10 M-3,0 L-4,-8 M5,0 L7,-10 M9,0 L8,-6" stroke="#5a3d22" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M-9,-8 C-11,-30 -9,-48 0,-56 C9,-48 11,-30 9,-8 Z" fill="#6b4a2b" stroke="#3a2614" stroke-width="1.2"/>' +
      '<path d="M-4,-12 q2,-14 0,-30 M3,-14 q-2,-12 1,-28" stroke="#4a3220" stroke-width="1" fill="none"/>' +
      '<path class="ent-arm" d="M-8,-36 C-18,-40 -24,-48 -26,-58 M-22,-50 l-6,-2 M-8,-28 C-16,-26 -20,-20 -22,-14" stroke="#5a3d22" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path class="ent-arm" d="M8,-36 C18,-42 22,-50 22,-60 M20,-52 l6,-3 M8,-28 C16,-26 20,-20 22,-14" stroke="#5a3d22" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<circle cx="-8" cy="-60" r="9" fill="#4f7a37"/><circle cx="6" cy="-64" r="10" fill="#5a8a40"/><circle cx="0" cy="-54" r="8" fill="#46703a"/>' +
      '<circle cx="-26" cy="-60" r="5" fill="#5a8a40"/><circle cx="22" cy="-62" r="5" fill="#4f7a37"/>' +
      '<g class="ent-eyes"><ellipse cx="-3.4" cy="-40" rx="2" ry="2.4" fill="#f3e6a8"/><ellipse cx="3.4" cy="-40" rx="2" ry="2.4" fill="#f3e6a8"/>' +
      '<circle cx="-3.4" cy="-39.6" r=".9" fill="#2a1a08"/><circle cx="3.4" cy="-39.6" r=".9" fill="#2a1a08"/></g>' +
      '<path d="M-3,-31 q3,1.5 6,0" stroke="#3a2614" stroke-width="1" fill="none"/></g>';
    const dir = Math.random() < 0.5 ? 1 : -1;
    walker('critters', spot[0].toFixed(0), spot[1].toFixed(0), dir * 26, 0, 7.5, dir < 0, art, 'ent');
    setTimeout(() => Sound.hoom(), 1500);
    return 7800;
  }

  /* ---------- passers-by in the open ground above the Hobbit Land title ---------- */
  // Every so often a small group walks across the open ground above the Hobbit Land title.
  // They are only for show and are not part of the game.
  const SIGN_Y = 668;   // feet line, just above the title box
  // Passers-by are drawn with their feet on the ground at (0,0). Legs and arms swing (classes leg-a / leg-b).
  const SHADOW = (rx) => '<ellipse cx="2" cy="1" rx="' + rx + '" ry="3.5" fill="rgba(40,30,10,.22)"/>';
  function elfArt(dx, s) {
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      '<path class="leg-a" d="M-2,-14 L-3,0" stroke="#3b4a36" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M2,-14 L3,0" stroke="#3b4a36" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M-6,-44 Q-10,-22 -13,0 Q0,-3 13,0 Q10,-22 6,-44 Z" fill="#cfe0cb" stroke="#6f8a68" stroke-width=".8"/>' +
      '<path d="M-2,-40 Q-4,-20 -6,-2 L-1,-3 Q-2,-20 0,-40 Z" fill="#8fb08a" opacity=".55"/>' +
      '<path d="M-4,-44 L4,-44 L3,-30 L-3,-30 Z" fill="#9dbf96"/>' +
      '<path d="M-4,-31 H4" stroke="#c9a449" stroke-width="1.1"/>' +
      '<path class="leg-b" d="M-4,-42 Q-8,-37 -7,-31" stroke="#e7d2b0" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<path class="leg-a" d="M4,-42 Q8,-37 7,-31" stroke="#e7d2b0" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<path d="M-1.2,-48 H1.2 V-45 H-1.2 Z" fill="#e7d2b0"/>' +
      '<path d="M-3.6,-51 L-8,-54.5 L-3.4,-48.5 Z M3.6,-51 L8,-54.5 L3.4,-48.5 Z" fill="#f2dcbc"/>' +
      '<ellipse cx="0" cy="-51" rx="3.6" ry="4.2" fill="#f2dcbc"/>' +
      '<path d="M-4.5,-52 Q-5,-60 0,-58.5 Q5,-60 4.5,-52 Q3,-55.5 0,-55.5 Q-3,-55.5 -4.5,-52 Z" fill="#e9cf72"/>' +
      '<path d="M-4,-52 Q-6.5,-44 -5,-37 L-2.8,-41 Z M4,-52 Q6.5,-44 5,-37 L2.8,-41 Z" fill="#e9cf72"/>' +
      '<circle cx="-1.3" cy="-51" r=".45" fill="#1a2a20"/><circle cx="1.3" cy="-51" r=".45" fill="#1a2a20"/>' +
      '<circle cx="0" cy="-42" r="1" fill="#e8b43a"/></g></g>';
  }
  function elfPair() {
    return SHADOW(16) + elfArt(0, 1) + elfArt(-14, 0.95);
  }
  function orcArt(dx, s) {
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      '<path class="leg-a" d="M-3,-12 L-4,0" stroke="#3d2f22" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M3,-12 L4,0" stroke="#3d2f22" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M-7,-12 Q-9,-26 -4,-30 L5,-30 Q9,-26 7,-12 Z" fill="#4f5c35" stroke="#2c3520" stroke-width=".8"/>' +
      '<path d="M-7,-16 H7" stroke="#2a1d10" stroke-width="2"/><rect x="-1.5" y="-17" width="3" height="3" fill="#b8862b"/>' +
      '<path class="leg-a" d="M-5,-27 Q-8,-22 -7,-15" stroke="#66744a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M5,-27 Q10,-22 9,-14" stroke="#66744a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M9,-14 L15,-46" stroke="#5a3d22" stroke-width="1.3"/><path d="M15,-46 L12.5,-40 L17.5,-40 Z" fill="#a9b2b8" stroke="#5f6870" stroke-width=".5"/>' +
      '<ellipse cx="2" cy="-35" rx="6" ry="5.4" fill="#6e7d4a" stroke="#2c3520" stroke-width=".7"/>' +
      '<path d="M-3.5,-36 L-9,-40 L-4,-33 Z" fill="#6e7d4a" stroke="#2c3520" stroke-width=".5"/>' +
      '<path d="M-1,-38.5 L6,-38" stroke="#2c3520" stroke-width="1"/>' +
      '<circle cx="0.5" cy="-36.5" r="1" fill="#ffd34d"/><circle cx="4" cy="-36.5" r="1" fill="#ffd34d"/>' +
      '<path d="M-1,-31 L-2,-27 L0.5,-30.5 Z M4.5,-31 L5.5,-27 L3,-30.5 Z" fill="#f3ecd2"/></g></g>';
  }
  function orcBand() {
    return SHADOW(24) + orcArt(-24, 0.95) + orcArt(-8, 1) + orcArt(9, 0.9);
  }
  // a stocky dwarf with a grey beard and a hand-axe
  function dwarfArt(dx, s) {
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      '<path class="leg-a" d="M-3,-8 L-4,0" stroke="#3b2a1e" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M3,-8 L4,0" stroke="#3b2a1e" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M-6,-8 Q-7,-20 -3,-24 L3,-24 Q7,-20 6,-8 Z" fill="#7a2e1e" stroke="#4a1a10" stroke-width=".8"/>' +
      '<ellipse cx="0" cy="-30" rx="5" ry="5" fill="#f0c9a3"/>' +
      '<path d="M-5,-30 Q-6,-18 0,-19 Q6,-18 5,-30 Z" fill="#9a8f80" stroke="#5a5248" stroke-width=".6"/>' +
      '<path d="M-6,-31 Q0,-38 6,-31 Z" fill="#5a4030"/>' +
      '<path d="M6,-14 L6,-28" stroke="#6b4a2b" stroke-width="1.2"/><path d="M6,-28 L11,-26 L11,-20 L6,-22 Z" fill="#a9b2b8" stroke="#5f6870" stroke-width=".5"/>' +
      '</g></g>';
  }
  function dwarfPair() {
    return SHADOW(16) + dwarfArt(0, 1) + dwarfArt(-14, 0.95);
  }
  // a pack of wargs, lean and grey, loping along in a line
  function wargArt(dx, s) {
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      '<path class="leg-a" d="M-8,-10 L-10,0" stroke="#4a4540" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M-3,-10 L-4,0" stroke="#4a4540" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path class="leg-a" d="M5,-10 L6,0" stroke="#4a4540" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M10,-10 L11,0" stroke="#4a4540" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M-12,-17 Q-20,-20 -22,-14" stroke="#6d665d" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M-12,-14 Q-10,-22 2,-22 L10,-22 Q16,-22 17,-17 Q16,-12 10,-11 L-10,-11 Q-13,-12 -12,-14 Z" fill="#6d665d" stroke="#3a3430" stroke-width=".8"/>' +
      '<ellipse cx="20" cy="-20" rx="6" ry="4.5" fill="#6d665d" stroke="#3a3430" stroke-width=".7"/>' +
      '<path d="M17,-23 L16,-28 L20,-24 Z" fill="#4a4540"/>' +
      '<path d="M24,-19 L29,-18 L24,-17 Z" fill="#3a3430"/>' +
      '<circle cx="21" cy="-21" r="1" fill="#f0c040"/>' +
      '</g></g>';
  }
  function wargPack() {
    return SHADOW(20) + wargArt(-22, 0.95) + wargArt(0, 1) + wargArt(20, 0.9);
  }
  function gandalfOnFoot() {
    return SHADOW(12) + '<g class="trot">' +
      '<path class="leg-a" d="M-3,-3 L-5,0.8 L-0.5,0.8 Z" fill="#3a2a1a"/>' +
      '<path class="leg-b" d="M3,-3 L5,0.8 L0.5,0.8 Z" fill="#3a2a1a"/>' +
      '<path d="M-6,-40 Q-10,-20 -12,0 L12,0 Q10,-20 6,-40 Z" fill="#8e9097" stroke="#4f5058" stroke-width=".8"/>' +
      '<path d="M-3,-30 Q-5,-16 -6,-2 M3,-30 Q5,-16 6,-2" stroke="#5f6068" stroke-width=".6" fill="none"/>' +
      '<path d="M-6,-37 H6" stroke="#b8862b" stroke-width="1.6"/>' +
      '<path class="leg-a" d="M-4,-36 Q-7,-30 -6,-24" stroke="#8e9097" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M4,-36 Q8,-30 8,-24" stroke="#8e9097" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M8,-24 L12,-62" stroke="#6b4a2b" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="12" cy="-63" r="5" fill="#fff3b0" opacity=".35"/><circle cx="12" cy="-63" r="2.2" fill="#fff3b0" stroke="#e8b43a" stroke-width=".6"/>' +
      '<rect x="-1.2" y="-42" width="2.4" height="3" fill="#f0c9a3"/>' +
      '<circle cx="0" cy="-46" r="4.2" fill="#f0c9a3"/>' +
      '<path d="M-3,-45.5 Q0,-35 3,-45.5 Z" fill="#f6f6f2"/>' +
      '<path d="M-2.4,-48.5 H-0.6 M0.6,-48.5 H2.4" stroke="#c9c9c2" stroke-width=".6"/>' +
      '<ellipse cx="0" cy="-51" rx="7" ry="1.6" fill="#6a6c74"/>' +
      '<path d="M-5,-51 Q-3,-62 2,-70 Q4,-62 5,-51 Z" fill="#7d7f88" stroke="#4f5058" stroke-width=".6"/>' +
      '<path d="M-5,-53 Q0,-52 5,-53" stroke="#4f5058" stroke-width=".6" fill="none"/></g>';
  }
  function hobbitWithPony() {
    return SHADOW(26) + '<g class="trot">' +
      '<g>' +
      '<path class="leg-b" d="M-10,-12 L-11,0" stroke="#7a5530" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path class="leg-a" d="M-6,-12 L-5,0" stroke="#7a5530" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path class="leg-a" d="M9,-12 L10,0" stroke="#7a5530" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M13,-12 L14,0" stroke="#7a5530" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M-14,-22 Q-22,-20 -20,-12 Q-18,-16 -14,-16 Z" fill="#3e2a18"/>' +
      '<path d="M-14,-18 Q-14,-26 -4,-26 L8,-26 Q16,-26 16,-19 Q16,-12 8,-12 L-6,-12 Q-14,-12 -14,-18 Z" fill="#b08258" stroke="#6a4a2a" stroke-width=".8"/>' +
      '<rect x="-12" y="-33" width="9" height="7" rx="1" fill="#9a6a3a" stroke="#5a3d22" stroke-width=".6"/>' +
      '<path d="M10,-24 L16,-36 L21,-34 L15,-18 Z" fill="#b08258"/>' +
      '<path d="M14,-36 Q11,-30 13,-25 L16,-28 Q15,-32 17,-36 Z" fill="#3e2a18"/>' +
      '<path d="M16,-38 Q20,-42 25,-38 L27,-34 Q25,-31 21,-32 L17,-30 Z" fill="#b08258" stroke="#6a4a2a" stroke-width=".7"/>' +
      '<circle cx="21.5" cy="-35" r=".6" fill="#1a1208"/></g>' +
      '<g transform="translate(-30,0)">' +
      '<path class="leg-a" d="M-2,-8 L-3,0" stroke="#6b4a2b" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path class="leg-b" d="M2,-8 L3,0" stroke="#6b4a2b" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M-4.5,-20 Q-6,-12 -4,-8 L4,-8 Q6,-12 4.5,-20 Z" fill="#4f8a3a" stroke="#2f5a22" stroke-width=".6"/>' +
      '<path class="leg-b" d="M4,-18 Q8,-14 9,-17" stroke="#4f8a3a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="0" cy="-24" r="4" fill="#f0c9a3"/>' +
      '<ellipse cx="0" cy="-27.5" rx="6" ry="1.1" fill="#7a4a2a"/><path d="M-3.8,-27.5 Q-3.8,-34 0,-34 Q3.8,-34 3.8,-27.5 Z" fill="#7a4a2a"/>' +
      '</g></g>';
  }
    function passerby() {
    const kinds = ['rider', 'orcs', 'elves', 'gandalf', 'hobbit', 'dwarves', 'wargs'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x0 = dir > 0 ? -60 : 460, x1 = dir > 0 ? 460 : -60;
    if (kind === 'rider') { blackRider(x0, x1, SIGN_Y, 9, 0); return; }
    const art = kind === 'orcs' ? orcBand() : kind === 'elves' ? elfPair() : kind === 'gandalf' ? gandalfOnFoot() : kind === 'dwarves' ? dwarfPair() : kind === 'wargs' ? wargPack() : hobbitWithPony();
    const dur = kind === 'orcs' ? 13 : kind === 'elves' ? 14 : kind === 'wargs' ? 10 : kind === 'dwarves' ? 13 : 12;
    walker('critters', x0, SIGN_Y, x1 - x0, 0, dur, dir < 0, art, 'passer');
  }
  function scheduleSigns(g, first) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion()) passerby();
      scheduleSigns(g, false);
    }, first ? 9000 + Math.random() * 8000 : 28000 + Math.random() * 24000);
  }

  /* ---------- weather that comes and goes ---------- */
  function scheduleWeather(g, first) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion()) startWeather();
      scheduleWeather(g, false);
    }, (first ? 20000 + Math.random() * 25000 : 0) + (first ? 0 : 75000 + Math.random() * 45000));
  }
  function startWeather() {
    const kinds = ['rain', 'mist', 'snow'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const life = 32000 + Math.random() * 18000;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'wx wx-' + kind);
    let html = '';
    if (kind === 'rain') {
      const x = 220 + Math.random() * 1100, y = 120 + Math.random() * 380;
      let drops = '';
      for (let i = 0; i < 18; i++) {
        const dx = -46 + Math.random() * 92;
        drops += '<path class="drop" style="animation-delay:-' + (Math.random() * 0.8).toFixed(2) + 's" d="M' + dx.toFixed(0) + ',8 l-3,10" stroke="#6f8fa8" stroke-width="1.4" stroke-linecap="round"/>';
      }
      html = '<g transform="translate(' + x.toFixed(0) + ',' + y.toFixed(0) + ')"><g class="wx-drift" style="--dur:' + (life / 1000).toFixed(0) + 's">' +
        '<g class="rain">' + drops + '</g>' +
        '<g opacity=".7"><ellipse cx="0" cy="0" rx="56" ry="15" fill="#8a909a"/><ellipse cx="-20" cy="-10" rx="22" ry="14" fill="#9aa0aa"/><ellipse cx="14" cy="-14" rx="26" ry="17" fill="#8f959f"/>' +
        '<ellipse cx="0" cy="6" rx="50" ry="7" fill="#737983"/></g></g></g>';
    } else if (kind === 'mist') {
      const st = NODES.find((n) => n.stop === 'marshes');
      const cx = st ? st.x : 790, cy = st ? st.y : 820;
      for (let i = 0; i < 7; i++) {
        const x = cx - 120 + Math.random() * 240, y = cy - 70 + Math.random() * 140;
        html += '<ellipse class="mist" style="animation-duration:' + (10 + Math.random() * 8).toFixed(1) + 's;animation-delay:-' + (Math.random() * 8).toFixed(1) + 's" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) +
          '" rx="' + (70 + Math.random() * 50).toFixed(0) + '" ry="' + (22 + Math.random() * 14).toFixed(0) + '" fill="url(#mist-grad)"/>';
      }
    } else {
      for (let i = 0; i < 28; i++) {
        const x = 1040 + Math.random() * 250, y = 30 + Math.random() * 90;
        html += '<circle class="flake" style="animation-duration:' + (4 + Math.random() * 3).toFixed(1) + 's;animation-delay:-' + (Math.random() * 6).toFixed(1) + 's" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) +
          '" r="' + (1.4 + Math.random() * 1.4).toFixed(1) + '" fill="#fff"/>';
      }
    }
    g.innerHTML = html;
    layer('weather').appendChild(g);
    requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add('on')));
    setTimeout(() => g.classList.remove('on'), life - 3000);
    setTimeout(() => g.remove(), life);
    return life;
  }

  /* ---------- special card moves ---------- */
  // Fly a token through the air along a list of spaces, optionally carried by an eagle.
  function flyAlong(p, ids, lift, ms, carried) {
    const pts = [[p.x, p.y]].concat(ids.map((id) => [NODES[id].x, NODES[id].y]));
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = lens[lens.length - 1] || 1;
    let eagle = null;
    if (carried) {
      eagle = document.createElementNS(SVGNS, 'g');
      eagle.setAttribute('transform', 'translate(0,-66)');
      eagle.innerHTML = '<g class="eagle-carry">' + eagleArt(0.75) + '</g>';
      p.liftEl.appendChild(eagle);
    }
    const t0 = performance.now();
    return new Promise((res) => {
      if (reduceMotion()) { p.x = pts[pts.length - 1][0]; p.y = pts[pts.length - 1][1]; drawToken(p); if (eagle) eagle.remove(); return res(); }
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const d = e * L;
        let j = 1;
        while (j < lens.length - 1 && lens[j] < d) j++;
        const seg = lens[j] - lens[j - 1] || 1, u = Math.min(1, Math.max(0, (d - lens[j - 1]) / seg));
        const nx = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * u, ny = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * u;
        if (Math.abs(nx - p.x) > 0.5) p.dir = nx < p.x ? -1 : 1;
        p.x = nx; p.y = ny;
        p.h0 = Math.sin(Math.PI * t) * lift;
        drawToken(p);
        if (t < 1) requestAnimationFrame(step);
        else { if (eagle) eagle.remove(); p.h0 = 0; drawToken(p); res(); }
      };
      requestAnimationFrame(step);
    });
  }
  async function eagleCarry(p, steps, g) {
    const ids = [];
    let node = p.node;
    for (let i = 0; i < steps; i++) {
      const n = NODES[node];
      if (n.kind === 'finish') break;
      const nx = i === 0 && n.fork ? n.alt : n.next;
      if (nx == null) break;
      ids.push(nx); node = nx;
    }
    if (!ids.length) return;
    p.active = true;
    sortTokens();
    settleLater(p.node, p);
    Sound.eagle();
    await flyAlong(p, ids, 70, 900 + ids.length * 260, true);
    guard(g);
    p.trail.push(...ids);
    p.node = node;
    landFx(p, false);
    p.active = false;
    await settle(p.node, null, 200);
    guard(g);
    updatePlayers();
  }
  // After a hobbit's place is announced at Mount Doom, an eagle swoops down and carries them back to Bag End.
  async function eagleBack(p, g) {
    const start = geo.start;
    if (p.node === start) return;
    toast('An eagle swoops down and carries ' + p.name + ' back to Bag End.', p.h.color, 2400);
    eagleFly(p.x + 240, p.y - 380, p.x + 90, p.y - 150, p.x, p.y - 80, 1.1, 1);
    await sleep(900);
    guard(g);
    p.active = true;
    sortTokens();
    settleLater(p.node, p);
    await flyAlong(p, [start], 70, 2200, true);
    guard(g);
    p.trail.push(start);
    p.node = start;
    landFx(p, false);
    p.active = false;
    await settle(p.node, null, 200);
    guard(g);
    updatePlayers();
  }
  // When a hobbit's final landing shares a space with another hobbit still on the road, they have a scuffle. No words.
  // Adapted from the Merry and Pippin fight in the Middle Earth game: the two tumble round each other, bump, then both flop over and get up.
  function brawl(p, g) {
    const q = players.find((o) => o !== p && !o.place && o.node === p.node);
    if (!q || p.place || reduceMotion()) return Promise.resolve();
    const f = [p, q], dirs = [p.dir, q.dir];
    const cx = (p.x + q.x) / 2, cy = (p.y + q.y) / 2;
    const LOOP = 2.2, FLOP = 0.8, TOTAL = LOOP + FLOP;
    p.active = q.active = true;
    sortTokens();
    let last = performance.now(), t = 0, nextPuff = 0;
    return new Promise((res) => {
      const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now; t += dt;
        if (t < LOOP) {
          // tumbling round each other, spinning in opposite directions
          const e = Math.min(1, t / 0.3);
          f.forEach((h, i) => {
            const ang = t * 7 + (i ? Math.PI : 0), rad = (11 + 4 * Math.sin(t * 3)) * e;
            h.x = cx + Math.cos(ang) * rad;
            h.y = cy + Math.sin(ang) * rad * 0.4;
            h.dir = Math.cos(ang) > 0 ? -1 : 1;
            h.rot = (i ? -1 : 1) * t * 380;
            h.h0 = Math.abs(Math.sin(t * 9 + i * 1.7)) * 8;
            h.sx = 1; h.sy = 1;
          });
          if (t >= nextPuff) {
            nextPuff = t + 0.4;
            Sound.pop();
            dust(cx + (Math.random() - 0.5) * 16, cy);
            sparkle(cx + (Math.random() - 0.5) * 16, cy - 14, '#ffe27a', 8);
          }
        } else {
          // both flop over, then get back up
          const u = (t - LOOP) / FLOP;
          const s = Math.min(1, Math.sin(Math.PI * Math.min(1, u)) * 1.6);
          if (u < 0.05 && !f[0].flopped) { f[0].flopped = true; Sound.pop(); dust(cx, cy); }
          f.forEach((h, i) => { h.rot = (i ? -90 : 90) * s; h.h0 = 0; h.sx = 1; h.sy = 1; });
        }
        f.forEach(drawToken);
        if (t < TOTAL) return requestAnimationFrame(step);
        f.forEach((h, i) => { h.dir = dirs[i]; h.rot = 0; h.h0 = 0; h.sx = 1; h.sy = 1; delete h.flopped; });
        p.active = q.active = false;
        settle(p.node, null, 300).then(res);
      };
      requestAnimationFrame(step);
    });
  }
  // After the fight, one of the two wins and moves on one space. Whose turn it is does not change.
  // If the winner lands on another hobbit, they fight again.
  async function scuffle(p, g) {
    const q = players.find((o) => o !== p && !o.place && o.node === p.node);
    if (!q || p.place || p.node === geo.start) return;   // no scuffles on the start space
    await brawl(p, g);
    guard(g);
    const w = Math.random() < 0.5 ? p : q;
    await move(w, 1, g);
    guard(g);
    await afterLanding(w, g, false);
    guard(g);
    await scuffle(w, g);
  }
  async function swapPlaces(p, q, g) {
    const pn = p.node, qn = q.node;
    [p.trail, q.trail] = [q.trail, p.trail];
    p.node = qn; q.node = pn;
    p.active = q.active = true;
    sortTokens();
    Sound.swap();
    await Promise.all([flyAlong(p, [qn], 60, 1300, false), flyAlong(q, [pn], 60, 1300, false)]);
    guard(g);
    p.active = q.active = false;
    landFx(p, false); landFx(q, false);
    await Promise.all([settle(p.node, null, 200), settle(q.node, null, 200)]);
    guard(g);
    updatePlayers();
  }

  /* ---------- the die ---------- */
  // Rotation that brings each face to the front (see the face layout in styles.css).
  const FACE_ROT = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
  const dieRot = { x: -18, y: 24 };
  function spinTo(cur, target, extra) {
    const base = cur + extra;
    return base + ((((target - base) % 360) + 360) % 360);
  }
  function rollDie(v) {
    if (settings.diceSound) Sound.dice();
    const [tx, ty] = FACE_ROT[v];
    dieRot.x = spinTo(dieRot.x, tx, 720);
    dieRot.y = spinTo(dieRot.y, ty, 360);
    elDieWrap.classList.remove('toss'); void elDieWrap.offsetWidth; elDieWrap.classList.add('toss');
    elDie.style.transform = 'rotateX(' + dieRot.x + 'deg) rotateY(' + dieRot.y + 'deg)';
    elDie.setAttribute('data-value', v);
    return sleep(reduceMotion() ? 200 : 1050);
  }

  /* ---------- turns ---------- */
  function startGame() {
    gen++;
    closeModal();
    stopConfetti();
    elToast.classList.remove('show');
    geo = boardFor(settings.length);
    NODES = geo.nodes;
    START_DIST = geo.startDist;
    renderBoard();
    playing = true; awaitingRoll = false; placesGiven = 0; moved = false; turnsSinceVisitor = 0; visitorBusyUntil = 0;
    scheduleBirds(gen);
    scheduleWander(gen);
    scheduleWeather(gen, true);
    scheduleSigns(gen, true);
    players = Array.from({ length: settings.players }, (_, i) => {
      const h = HB.byId(settings.hobbits[i]);
      return { seat: i, h, name: h.name, cpu: isCpu(i), node: geo.start, trail: [geo.start], turns: 0, place: 0, active: false, bonus: 0, skip: false };
    });
    players.forEach(makeToken);
    players.forEach((p) => { const [x, y] = slotFor(p); p.x = x; p.y = y; drawToken(p); });
    sortTokens();
    current = startIndex % players.length;
    renderPlayers();
    show('game');
    fitStage();
    elDie.style.transform = 'rotateX(' + dieRot.x + 'deg) rotateY(' + dieRot.y + 'deg)';
    const g = gen;
    const first = players[current];
    setStatus(first, 'gets ready…');
    setRoll(false);
    sleep(700).then(() => {
      if (g !== gen) return;
      toast(look.season.name + ' ' + look.time.name.toLowerCase() + ' in the Shire. ' + first.name + ' goes first!', first.h.color, 2200);
      return sleep(1400);
    }).then(() => { if (g === gen) beginTurn(); });
  }

  function beginTurn() {
    if (!playing) return;
    const p = players[current];
    lookAt(p.x, p.y);
    players.forEach((q) => q.el.classList.toggle('turn', q === p));
    if (p.skip) {
      // Gollum stole this turn
      p.skip = false;
      updatePlayers();
      Sound.gollum();
      peekGollum(p);
      setStatus(p, 'loses this turn. Gollum stole it!');
      setRoll(false, 'Skipped');
      toast('Gollum stole ' + p.name + '’s turn!', p.h.color, 2400);
      const g = gen;
      pause(2600).then(() => holdForQuestion(g)).then(() => { if (g === gen) endTurn(); }).catch((e) => { if (e !== CANCEL) throw e; });
      return;
    }
    maybeVisitor();
    updatePlayers();
    Sound.turn();
    if (p.cpu) {
      setStatus(p, 'is about to roll…');
      setRoll(false, 'Computer');
      const g = gen;
      sleep(speed().think).then(() => { if (g === gen) playTurn(); });   // playTurn waits if a question is open
    } else {
      setStatus(p, '— your turn. Press <b>Roll</b>.');
      awaitingRoll = true;
      setRoll(true);
    }
  }

  async function playTurn() {
    const g = gen;
    const p = players[current];
    try {
      await holdForQuestion(g);
      awaitingRoll = false;
      setRoll(false, 'Rolling…');
      moved = true;
      p.turns++;
      const v = 1 + Math.floor(Math.random() * 6);
      const bonus = p.bonus || 0;
      setStatus(p, 'rolls…');
      await rollDie(v);
      guard(g);
      p.bonus = 0;
      updatePlayers();
      setStatus(p, 'rolled a <b>' + v + '</b>' + (bonus ? ' <b>+' + bonus + '</b> for resting = <b>' + (v + bonus) + '</b>' : ''));
      bubble(bonus ? v + '+' + bonus : v, p.h.color);
      await pause(bonus ? 700 : 380);
      guard(g);
      setRoll(false, 'Walking…');
      await move(p, v + bonus, g);
      await afterLanding(p, g, true);
      guard(g);
      await scuffle(p, g);
      guard(g);
      endTurn();
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  }

  async function afterLanding(p, g, fromDie) {
    const n = NODES[p.node];
    if (n.kind === 'finish') { await finishPlayer(p, g); return; }
    if (n.fork) {
      Sound.shortcut();
      sparkle(n.x, n.y, '#9fe08a', 14);
      highlightShortcut(n.fork);
      fireworksAt(n.x, n.y, 3);
      toast(p.name + ' found a shortcut! Next move takes the ' + n.forkName + '.', p.h.color, 2600);
      setStatus(p, 'found the <b>' + esc(n.forkName) + '</b>');
      await pause(2300);
      guard(g);
      return;
    }
    if (n.rest) {
      if (p.bonus) return;   // a rest bonus does not stack
      p.bonus = 1;
      Sound.rest();
      sparkle(n.x, n.y, '#9fe08a', 14);
      updatePlayers();
      toast(p.name + ' rests at ' + n.name + ': +1 on the next roll.', p.h.color, 2400);
      setStatus(p, 'rests at <b>' + esc(n.name) + '</b>: +1 on the next roll');
      await pause(2100);
      guard(g);
      return;
    }
    if (fromDie && n.card) {
      sparkle(n.x, n.y, '#ffe27a', 12);
      await pause(450);
      guard(g);
      const card = CARDS.draw();
      setStatus(p, 'turns over a card');
      await holdForQuestion(g);
      await showCard(p, card, g);
      guard(g);
      if (card.kind === 'special') {
        await specialCard(p, card, g);
      } else if (card.move) {
        setStatus(p, card.move > 0 ? 'moves forward' : 'moves back');
        await move(p, card.move, g);
        await afterLanding(p, g, false);   // a card move never turns over another card
      } else {
        bounce(p);
        await pause(500);
        guard(g);
      }
    }
  }

  async function specialCard(p, card, g) {
    if (card.special === 'eagles') {
      setStatus(p, 'is carried by the <b>Eagles</b>');
      await eagleCarry(p, card.move, g);
      await afterLanding(p, g, false);
    } else if (card.special === 'swap') {
      const others = players.filter((q) => q !== p && !q.place);
      if (!others.length) return;
      const q = others[Math.floor(Math.random() * others.length)];
      setStatus(p, 'swaps places with <b style="color:' + q.h.light + '">' + esc(q.name) + '</b>');
      toast(p.name + ' and ' + q.name + ' swap places!', p.h.color, 2200);
      await swapPlaces(p, q, g);
      await afterLanding(p, g, false);
    } else if (card.special === 'skip') {
      p.skip = true;
      updatePlayers();
      peekGollum(p);
      Sound.gollum();
      setStatus(p, 'will miss the next turn');
      await pause(2200);
      guard(g);
    }
  }

  function bounce(p) {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 500);
      p.h0 = Math.abs(Math.sin(t * Math.PI * 2)) * 8 * (1 - t);
      drawToken(p);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function finishPlayer(p, g) {
    placesGiven++;
    p.place = placesGiven;
    Sound.finish();
    eruption();
    if (p.place === 1) setTimeout(() => eagleFly(1100, -90, 1480, 650, 1720, 420, 6, 1.3), 900);
    sparkle(p.x, p.y, '#ffd34d', 18);
    setBadge(p);
    updatePlayers();
    const msg = p.place === 1 ? p.name + ' reached Mount Doom first and destroyed the Ring!' : p.name + ' reached Mount Doom: ' + ORDINALS[p.place - 1] + ' place!';
    toast(msg, p.h.color, 2800);
    setStatus(p, 'reached <b>Mount Doom</b>, ' + ORDINALS[p.place - 1] + ' place');
    await pause(4600);
    guard(g);
    await eagleBack(p, g);
  }

  function setBadge(p) {
    const b = $('.tk-badge', p.el);
    b.setAttribute('display', p.place ? 'inline' : 'none');
    $('.tk-badge-n', b).textContent = p.place || '';
  }

  function endTurn() {
    if (!playing) return;
    const left = players.filter((p) => !p.place);
    // The last hobbit keeps walking until they reach Mount Doom and get their place too.
    if (left.length === 0) {
      playing = false;
      updatePlayers();
      const g = gen;
      sleep(700).then(() => holdForQuestion(g)).then(() => { if (g === gen) endGame(); }).catch((e) => { if (e !== CANCEL) throw e; });
      return;
    }
    do { current = (current + 1) % players.length; } while (players[current].place);
    beginTurn();
  }

  /* ---------- player bar and status ---------- */
  function renderPlayers() {
    elPlayers.style.setProperty('--n', players.length);
    elPlayers.innerHTML = players.map((p, i) =>
      '<div class="player" data-i="' + i + '" style="--pc:' + p.h.color + '">' +
      HB.portrait(p.h, 'avatar') +
      '<div class="pinfo"><div class="pname"><span class="pn">' + esc(p.name) + '</span><span class="pplace"></span><span class="pbadges"></span></div>' +
      '<div class="pwhere"></div>' +
      '<div class="ptrack"><div class="pfill"></div></div>' +
      '<div class="pwins"></div></div>' +
      '</div>').join('');
    updatePlayers();
  }
  function updatePlayers() {
    elPlayers.querySelectorAll('.player').forEach((el, i) => {
      const p = players[i];
      if (!p) return;
      const active = playing && i === current;
      el.classList.toggle('active', active);
      el.classList.toggle('done', !!p.place);
      const n = NODES[p.node];
      $('.pwhere', el).innerHTML = p.place ? (n.kind === 'finish' ? 'Reached Mount Doom' : ORDINALS[p.place - 1] + ' place') : esc(n.place) + (p.cpu ? ' <span class="cpu-tag">· Computer</span>' : '');
      $('.pplace', el).textContent = p.place ? ' ' + MEDALS[p.place - 1] : '';
      // badges: a rest bonus waiting to be used, a shortcut ready to take, or a turn Gollum has stolen
      const onFork = !p.place && !!NODES[p.node].fork;
      const badges = (p.bonus && !p.place ? '<span class="pbadge rest" title="+1 on the next roll">🍃 +1</span>' : '') +
        (onFork ? '<span class="pbadge short" title="Next move takes the shortcut">➜ Shortcut</span>' : '') +
        (p.skip && !p.place ? '<span class="pbadge skip" title="Misses the next turn">Skip</span>' : '');
      const bEl = $('.pbadges', el);
      if (bEl.innerHTML !== badges) bEl.innerHTML = badges;
      const done = p.place ? 1 : Math.max(0, Math.min(1, 1 - geo.dist[p.node] / START_DIST));
      $('.pfill', el).style.width = (done * 100).toFixed(1) + '%';
      $('.pwins', el).textContent = series.games ? winsText(series.wins[p.seat]) : '';
      el.setAttribute('aria-label', p.name + ': ' + $('.pwhere', el).textContent + (active ? ', current turn' : ''));
    });
  }
  function setStatus(p, html) {
    elStatus.innerHTML = '<span class="st-face" style="--pc:' + p.h.color + '">' + HB.portrait(p.h, 'st-portrait') + '</span><span><b style="color:' + p.h.light + '">' + esc(p.name) + '</b> ' + html + '</span>';
  }
  function setRoll(on, label) {
    elRoll.disabled = !on;
    elRoll.textContent = on ? 'Roll' : (label || 'Wait…');
    elDieWrap.classList.toggle('ready', !!on);
    const p = players[current];
    if (p) elRoll.style.setProperty('--pc', p.h.color);
  }
  function bubble(v, color) {
    const b = document.createElement('div');
    b.className = 'roll-bubble';
    b.textContent = v;
    b.style.setProperty('--pc', color);
    elDieWrap.appendChild(b);
    setTimeout(() => b.remove(), 1500);
  }

  elRoll.addEventListener('click', () => { if (awaitingRoll && playing) playTurn(); });
  elDieWrap.addEventListener('click', () => { if (awaitingRoll && playing) playTurn(); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && awaitingRoll && playing && elLayer.hidden && document.activeElement !== elRoll) {
      e.preventDefault();
      playTurn();
    }
  });

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(text, color, ms) {
    clearTimeout(toastTimer);
    elToast.textContent = text;
    elToast.style.setProperty('--tc', color || '#fff');
    elToast.classList.add('show');
    // Every message stays up two seconds longer than its base time.
    toastTimer = setTimeout(() => elToast.classList.remove('show'), (ms || 1600) + 2000);
  }

  /* ---------- the card ---------- */
  const ARROWS = {
    forward: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10,26 H36 V14 L56,32 L36,50 V38 H10 Z" fill="#3f9a4a" stroke="#1f5a28" stroke-width="3" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M54,26 H28 V14 L8,32 L28,50 V38 H54 Z" fill="#c4423a" stroke="#7a1f1a" stroke-width="3" stroke-linejoin="round"/></svg>',
    stay: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="21" fill="#d9b04a" stroke="#7a5a12" stroke-width="3"/><rect x="21" y="28" width="22" height="8" rx="3" fill="#fff7dc"/></svg>',
    eagles: '<svg viewBox="-60 -30 120 70" aria-hidden="true">' + '<path d="M0,0 C-14,-10 -36,-12 -56,-4 C-40,-4 -30,0 -24,4 C-34,4 -42,8 -48,12 C-30,8 -14,8 0,6 Z M0,0 C14,-10 36,-12 56,-4 C40,-4 30,0 24,4 C34,4 42,8 48,12 C30,8 14,8 0,6 Z" fill="#6b4a2b" stroke="#3a2614" stroke-width="1.5"/><ellipse cx="0" cy="3" rx="8" ry="11" fill="#7a5532"/><circle cx="0" cy="-8" r="6" fill="#e9dcc0"/><path d="M0,-6 l3,4 l-5,-1 Z" fill="#e8b43a"/></svg>',
    swap: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14,24 H44 V14 L58,28 L44,42 V32 H14 Z" fill="#2f6fc0" stroke="#1b4277" stroke-width="2.5" stroke-linejoin="round" transform="translate(0,-6)"/><path d="M50,40 H20 V30 L6,44 L20,58 V48 H50 Z" fill="#d49a22" stroke="#87600f" stroke-width="2.5" stroke-linejoin="round" transform="translate(0,2)"/></svg>',
    skip: '<svg viewBox="-20 -42 40 34" aria-hidden="true"><path d="M-9.2,-25.5 Q-14,-27 -16.5,-31.5 Q-12.5,-30.6 -9.2,-30.4 Z M9.2,-25.5 Q14,-27 16.5,-31.5 Q12.5,-30.6 9.2,-30.4 Z" fill="#bdb898"/><path d="M0,-39.5 C7,-39.5 10,-33 9.6,-27 C9.2,-20 5,-14.5 0,-14.5 C-5,-14.5 -9.2,-20 -9.6,-27 C-10,-33 -7,-39.5 0,-39.5 Z" fill="#c9c4a5" stroke="#7d7a5e" stroke-width=".8"/><ellipse cx="-4.3" cy="-27.5" rx="4" ry="4.6" fill="#e9f0de" stroke="#6d6a50" stroke-width=".7"/><ellipse cx="4.3" cy="-27.5" rx="4" ry="4.6" fill="#e9f0de" stroke="#6d6a50" stroke-width=".7"/><circle cx="-4.3" cy="-27.5" r="1.3" fill="#101410"/><circle cx="4.3" cy="-27.5" r="1.3" fill="#101410"/><path d="M-5.6,-19 Q0,-15.2 5.6,-19 Q0,-17.4 -5.6,-19 Z" fill="#3a2a22"/></svg>'
  };
  function showCard(p, card, g) {
    return new Promise((resolve) => {
      openModal(
        '<div class="card-who">' + HB.portrait(p.h, 'cw-face') + '<span><b style="color:' + p.h.color + '">' + esc(p.name) + '</b> turns over a card</span></div>' +
        '<div class="play-card k-' + card.kind + (card.special ? ' sp-' + card.special : '') + '">' +
        (card.kind === 'special' ? '<div class="pc-rare">Rare card!</div>' : '') +
        '<div class="pc-corner tl">✦</div><div class="pc-corner br">✦</div>' +
        '<div class="pc-who" style="--hc:' + p.h.color + '">' + HB.portrait(p.h, 'pc-who-face') + '</div>' +
        '<div class="pc-icon">' + ARROWS[card.special || card.kind] + '</div>' +
        (card.phrase ? '<p class="pc-phrase">' + esc(card.phrase) + '</p>' : '') +
        '<h2 id="modal-title" class="pc-text">' + esc(card.text) + '</h2>' +
        '</div>',
        // Everyone reads the card; a person presses Continue, even on a computer's turn.
        [{ label: 'Continue', primary: true, run: () => { if (g !== gen) return; closeModal(); resolve(); } }],
        'card-modal'
      );
      // Computer players may have Continue tapped for them after the chosen time. People always tap it themselves.
      const shown = elModal.querySelector('.play-card');
      if (settings.autoTap && isCpu(p.seat)) {
        setTimeout(() => {
          if (g !== gen || modalKind !== 'card-modal' || elModal.querySelector('.play-card') !== shown) return;
          const btn = elModal.querySelector('.modal-actions .btn.primary');
          if (btn) btn.click();
        }, settings.autoSecs * 1000);
      }
      setTimeout(() => {
        if (g !== gen) return;
        if (card.kind === 'special') (card.special === 'skip' ? Sound.bad() : Sound.win());
        else (card.kind === 'forward' ? Sound.good() : card.kind === 'back' ? Sound.bad() : Sound.stay());
      }, 380);
    });
  }

  /* ---------- end of game ---------- */
  function endGame() {
    const ranked = players.slice().sort((a, b) => a.place - b.place);
    const winner = ranked[0];
    series.games++;
    series.wins[winner.seat]++;
    updatePlayers();
    const rows = ranked.map((p) =>
      '<div class="rank' + (p.place === 1 ? ' win' : '') + '" style="--pc:' + p.h.color + '">' +
      '<span class="place">' + MEDALS[p.place - 1] + '</span>' +
      HB.portrait(p.h, 'avatar') +
      '<span class="rname">' + esc(p.name) + '<small>' + (p.cpu ? 'Computer · ' : '') + p.turns + (p.turns === 1 ? ' turn' : ' turns') + '</small></span>' +
      '<span class="rscore">' + ORDINALS[p.place - 1] + '</span>' +
      '</div>').join('');
    const standings = players.map((p) => esc(p.name) + ' ' + series.wins[p.seat]).join(' · ');
    Sound.win();
    startConfetti([winner.h.color, '#f6c453']);
    openModal(
      '<div class="trophy-all">' + players.map((p) => HB.portrait(p.h, 'avatar')).join('') + '</div>' +
      '<h2 id="modal-title">Good game!</h2>' +
      '<p class="sub">' + esc(winner.name) + ' carried the Ring all the way to Mount Doom.</p>' +
      '<p class="series">Wins in this run (' + series.games + (series.games === 1 ? ' game' : ' games') + '): ' + standings + '</p>' +
      '<div class="ranks">' + rows + '</div>',
      [
        { label: 'Next game', primary: true, run: () => { startIndex++; startGame(); } },
        { label: 'Change settings', run: toSetup }
      ]
    );
  }

  function toSetup() {
    gen++;
    playing = false; awaitingRoll = false;
    resetSeries();
    closeModal();
    stopConfetti();
    elToast.classList.remove('show');
    refreshSetup();
    show('setup');
  }

  /* ---------- modal ---------- */
  const elLayer = $('#modal-layer');
  const elModal = $('#modal');
  let modalKind = '';
  function openModal(html, actions, kind) {
    modalKind = kind || '';
    elModal.className = 'modal' + (kind ? ' ' + kind : '');
    elModal.innerHTML = html + '<div class="modal-actions"></div>';
    const bar = $('.modal-actions', elModal);
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.primary ? 'primary' : 'ghost');
      b.innerHTML = '<span>' + esc(a.label) + '</span>';
      b.addEventListener('click', a.run);
      bar.appendChild(b);
    });
    elLayer.hidden = false;
    const first = $('.btn', bar);
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }
  function closeModal() { elLayer.hidden = true; elModal.innerHTML = ''; modalKind = ''; }
  function confirmModal(title, text, yesLabel, onYes) {
    openModal('<h2 id="modal-title">' + title + '</h2><p class="sub">' + text + '</p>', [
      { label: yesLabel, primary: true, run: onYes },
      { label: 'Keep playing', run: closeModal }
    ], 'confirm');
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elLayer.hidden && modalKind === 'confirm') closeModal();
  });

  const inProgress = () => playing && moved;
  $('#restart-btn').addEventListener('click', () => {
    if (inProgress()) confirmModal('Restart this game?', 'Everyone goes back to Bag End and the board is laid out again.', 'Restart', startGame);
    else startGame();
  });
  $('#menu-btn').addEventListener('click', () => {
    if (inProgress()) confirmModal('Leave this game?', 'Your current game will end so you can change the players or the road.', 'Go to settings', toSetup);
    else toSetup();
  });

  /* ---------- sound + fullscreen buttons ---------- */
  const soundBtn = $('#sound-btn');
  function refreshSound() {
    soundBtn.classList.toggle('off', !settings.sound);
    soundBtn.setAttribute('aria-label', settings.sound ? 'Sound on' : 'Sound off');
  }
  soundBtn.addEventListener('click', () => {
    settings.sound = !settings.sound;
    refreshSound(); save();
    if (settings.sound) Sound.good();
  });
  refreshSound();

  const diceBtn = $('#dice-btn');
  function refreshDice() {
    diceBtn.classList.toggle('off', !settings.diceSound);
    diceBtn.setAttribute('aria-label', settings.diceSound ? 'Dice sound on' : 'Dice sound off');
    diceBtn.setAttribute('title', settings.diceSound ? 'Dice sound on' : 'Dice sound off');
    diceBtn.setAttribute('aria-pressed', String(settings.diceSound));
  }
  diceBtn.addEventListener('click', () => {
    settings.diceSound = !settings.diceSound;
    refreshDice(); save();
    if (settings.diceSound) Sound.dice();
  });
  refreshDice();

  const fsBtn = $('#fs-btn');
  const root = document.documentElement;
  const fsRequest = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!fsRequest) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const r = fsRequest.call(root); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* not allowed here */ }
  });

  /* ---------- confetti ---------- */
  const canvas = $('#confetti');
  const cx = canvas.getContext('2d');
  let confetti = [], confettiRaf = 0;
  function startConfetti(colors) {
    stopConfetti();
    if (reduceMotion()) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width = innerWidth * dpr, H = canvas.height = innerHeight * dpr;
    const palette = colors.concat(['#f6c453', '#ffffff', '#9fdcb4']);
    confetti = Array.from({ length: 160 }, (_, i) => ({
      x: Math.random() * W, y: -Math.random() * H * 0.9 - 20,
      w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 10) * dpr,
      vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      color: palette[i % palette.length], round: i % 4 === 0
    }));
    const began = performance.now();
    const frame = (now) => {
      cx.clearRect(0, 0, W, H);
      let alive = false;
      const fading = now - began > 5000;
      for (const p of confetti) {
        p.x += p.vx + Math.sin((now / 400) + p.rot) * dpr; p.y += p.vy; p.rot += p.vr;
        if (p.y > H + 30) { if (fading) continue; p.y = -30; p.x = Math.random() * W; }
        alive = true;
        cx.save();
        cx.translate(p.x, p.y); cx.rotate(p.rot);
        cx.scale(1, Math.cos(p.rot * 2));
        cx.fillStyle = p.color;
        if (p.round) { cx.beginPath(); cx.arc(0, 0, p.w / 2, 0, 6.28); cx.fill(); }
        else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.restore();
      }
      confettiRaf = alive ? requestAnimationFrame(frame) : 0;
      if (!alive) cx.clearRect(0, 0, W, H);
    };
    confettiRaf = requestAnimationFrame(frame);
  }
  function stopConfetti() {
    if (confettiRaf) cancelAnimationFrame(confettiRaf);
    confettiRaf = 0; confetti = [];
    cx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ---------- fit the board to the window ---------- */
  function fitStage() {
    const W = elWrap.clientWidth, H = elWrap.clientHeight;
    if (!W || !H) return;
    const ratio = BOARD.W / BOARD.H;
    let w = W, h = W / ratio;
    if (h > H) { h = H; w = H * ratio; }
    elStage.style.width = Math.floor(w) + 'px';
    elStage.style.height = Math.floor(h) + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(fitStage).observe(elWrap);
  window.addEventListener('resize', fitStage);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  buildSetup();
})();
