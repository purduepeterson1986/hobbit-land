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
  const MAP_IDS = ['classic', 'serpent', 'southern'];
  const MAP_NAMES = { classic: 'Eriador', serpent: 'Serpent', southern: 'Ithilien' };
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
    // Auto-tap only matters when a seat is a computer player, so the section is shown only then.
    const anyCpu = Array.from({ length: settings.players }, (_, i) => isCpu(i)).some(Boolean);
    $('#auto-panel').hidden = !anyCpu;
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
  function boardFor(length, map) {
    const key = map + '|' + length;
    if (BOARDS[key]) return BOARDS[key];
    const b = BOARD.build(length, map);
    // A short "where am I" name for every space: the named place it is fewest steps from along the road
    // (the one behind it or the one ahead), or the shortcut it is on.
    const road = [];
    for (let n = b.nodes[b.start]; n; n = n.next != null ? b.nodes[n.next] : null) road.push(n);
    const behind = [], ahead = [];
    road.forEach((n, i) => { behind[i] = n.name ? i : i > 0 ? behind[i - 1] : 0; });
    for (let i = road.length - 1; i >= 0; i--) ahead[i] = road[i].name ? i : ahead[i + 1];
    b.nodes.forEach((n) => {
      if (n.name) { n.place = 'At ' + n.name; return; }
      if (n.route !== 'main') { n.place = 'On the ' + BOARD.SHORTCUTS.find((sc) => sc.id === n.route).name; return; }
    });
    road.forEach((n, i) => {
      if (n.name) return;
      const j = i - behind[i] <= ahead[i] - i ? behind[i] : ahead[i];
      n.place = 'Near ' + road[j].name;
    });
    b.startDist = b.dist[b.start];
    BOARDS[key] = b;
    return b;
  }
  let geo = boardFor('normal', 'classic');
  let mapNow = 'classic';   // the map chosen for the game in play
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
      // dark volcanic rock with glowing cracks, and the One Ring lying on it, seen at a slant
      inner = '<circle class="sp-glow" r="32"/><circle class="sp-ring" r="23.5"/><circle class="sp-base" r="21"/>' +
        '<path d="M-15,8 L-8,4 L-3,10 M7,-13 L10,-7 L16,-8 M-13,-10 L-8,-6 M3,12 L8,15" stroke="#e8541c" stroke-width="1.4" fill="none" opacity=".85" stroke-linecap="round"/>' +
        '<g transform="rotate(-14)"><ellipse rx="11" ry="5" fill="none" stroke="#8a5a12" stroke-width="3.6"/>' +
        '<path d="M-11,0 A11,5 0 0 0 11,0" fill="none" stroke="#f0c24a" stroke-width="3.6"/>' +
        '<path d="M-8,3.4 A11,5 0 0 0 6,4.2" fill="none" stroke="#fff3b0" stroke-width="1" opacity=".9"/></g>';
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

  // The compass rose sits in open ground in the lower middle of the map, clear of the road and the place names.
  function placeCompass() {
    const c = $('.compass', layer('terrain'));
    if (!c) return;
    const mids = NODES.filter((n) => n.next != null).map((n) => [(n.x + NODES[n.next].x) / 2, (n.y + NODES[n.next].y) / 2]);
    const pts = NODES.map((n) => [n.x, n.y]).concat(mids);
    const labels = [...layer('labels').querySelectorAll('text')].map((t) => { try { return t.getBBox(); } catch (e) { return { x: 0, y: 0, width: 0, height: 0 }; } });
    const clear = (x, y) => !pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 62) &&
      !labels.some((b) => x + 40 > b.x && x - 40 < b.x + b.width && y + 40 > b.y && y - 50 < b.y + b.height);
    let best = null, bd = Infinity;
    for (let x = 440; x <= 1000; x += 12) for (let y = 560; y <= 860; y += 12) {
      const d = Math.hypot(x - 612, y - 800);
      if (d < bd && clear(x, y)) { bd = d; best = [x, y]; }
    }
    if (!best) return;
    c.setAttribute('transform', 'translate(' + best[0] + ',' + best[1] + ')');
    // trees, rocks and animals that would stand on the compass are cleared away
    for (const el of [...layer('scenery').children]) {
      let bb; try { bb = el.getBBox(); } catch (e) { continue; }
      const m = el.transform && el.transform.baseVal.consolidate();
      const ex = (m ? m.matrix.e : 0) + bb.x + bb.width / 2, ey = (m ? m.matrix.f : 0) + bb.y + bb.height / 2;
      if (bb.width < 160 && bb.height < 160 && Math.hypot(ex - best[0], ey - best[1]) < 46) el.remove();
    }
  }

  function renderBoard() {
    look = BOARD.dress(geo);
    layer('terrain').innerHTML = BOARD.terrainHTML(geo.map) + BOARD.cartoucheHTML(MAP_NAMES[geo.map]);
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
    crowd = null;
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
      '<g class="tk-lift"><g class="tk-idle"><g class="tk-face"><g transform="scale(1.02)">' + HB.figure(p.h) + '</g></g>' +
      // the hobbit's initial on the jacket; outside tk-face so it never shows mirrored
      '<text class="tk-letter" x="0" y="-9.6" text-anchor="middle">' + p.name.charAt(0) + '</text>' +
      // a snack for when the hobbit has been waiting a long time
      '<g class="tk-snack"><circle cx="0" cy="0" r="3.4" fill="#d8402e"/><path d="M0,-3 q1,-3 3,-3" stroke="#4a7a2a" stroke-width="1.2" fill="none"/></g></g></g>' +
      // moths that circle a hobbit who has rested, until the +1 is used
      '<g class="tk-moths" display="none"><g transform="translate(0,-44) scale(1,.45)">' +
      [0, 1, 2].map((i) => '<g class="moth-orbit" style="animation-delay:-' + (i * 0.9) + 's;animation-duration:' + (2.4 + i * 0.5) + 's"><circle r="20" fill="none"/>' +
        '<g transform="translate(20,0) scale(1,2.2)"><path class="moth" d="M-3,-1 L0,0 L-3,1.6 Z M3,-1 L0,0 L3,1.6 Z" fill="#f4ecd0"/><circle r=".9" fill="#fff6c4"/></g></g>').join('') +
      '</g></g>' +
      '<g class="tk-badge" transform="translate(13,-50)" display="none"><circle r="10" fill="#f6c453" stroke="#7a4a12" stroke-width="1.6"/>' +
      '<text y="4.2" text-anchor="middle" class="tk-badge-n"></text></g>';
    layer('tokens').appendChild(g);
    p.el = g;
    p.liftEl = $('.tk-lift', g);
    p.faceEl = $('.tk-face', g);
    p.shadowEl = $('.tk-shadow', g);
    p.idleEl = $('.tk-idle', g);
    p.mothsEl = $('.tk-moths', g);
    p.lastMoved = performance.now();
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
    if (p.idleEl) p.idleEl.classList.remove('sit', 'snack');
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
    p.lastMoved = performance.now();
    if (p.idleEl) p.idleEl.classList.remove('sit', 'snack');
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
      if (el.dataset.rx === 'hop') {
        if (el.classList.contains('scatter')) return;
        const dx = r.x - x, dy = r.y - y, d = Math.hypot(dx, dy) || 1;
        el.style.setProperty('--ax', (dx / d * 18).toFixed(1) + 'px');
        el.style.setProperty('--ay', (dy / d * 9).toFixed(1) + 'px');
        el.classList.add('scatter');
        clearTimeout(el._rxTimer);
        el._rxTimer = setTimeout(() => el.classList.remove('scatter'), 4200);
        return;
      }
      if (el.classList.contains('react')) return;
      el.classList.add('react');
      clearTimeout(el._rxTimer);
      el._rxTimer = setTimeout(() => el.classList.remove('react'), 2400);
    });
  }
  // Between moves the Eye slowly turns to the hobbit closest to Mount Doom.
  function eyeOnLeader() {
    const left = players.filter((p) => !p.place);
    if (!left.length) return;
    const lead = left.reduce((a, b) => (geo.dist[b.node] < geo.dist[a.node] ? b : a));
    const pupil = $('#eye-pupil', elBoard);
    if (pupil) pupil.classList.add('slow');
    lookAt(lead.x, lead.y);
    setTimeout(() => { if (pupil) pupil.classList.remove('slow'); }, 1800);
  }
  function lookAt(x, y) {
    const pupil = $('#eye-pupil', elBoard);
    if (!pupil) return;
    const dx = x - 1566, dy = y - 442, d = Math.hypot(dx, dy) || 1;
    pupil.style.transform = 'translate(' + (dx / d * 9).toFixed(1) + 'px,' + (dy / d * 2.5).toFixed(1) + 'px)';
  }
  function wakeDoors(n) {
    const doors = reactors.filter((r) => r.el.dataset.rx === 'glow').sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
    if (!doors || Math.hypot(doors.x - n.x, doors.y - n.y) > 150) return;
    doors.el.classList.remove('awake'); void doors.el.getBoundingClientRect(); doors.el.classList.add('awake');
    setTimeout(() => doors.el.classList.remove('awake'), 5200);
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
  // The winner's eruption at Mount Doom: a flash, a shockwave, two waves of lava and a smoke column.
  function eruption() {
    if (reduceMotion()) return;
    const fx = layer('fx');
    const cx = 1480, cy = 778;
    fxEl(fx, 'circle', { cx, cy: cy - 70, r: 26, fill: '#ffd34d', class: 'erupt-flash' }, 1400);
    fxEl(fx, 'circle', { cx, cy: cy - 70, r: 30, fill: 'none', stroke: '#ff8a2a', 'stroke-width': 6, class: 'erupt-ring' }, 1800);
    for (let wave = 0; wave < 2; wave++) {
      for (let i = 0; i < 60; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.0, d = 120 + Math.random() * 260;
        fxEl(fx, 'circle', { cx, cy: cy - 70, r: (3 + Math.random() * 7).toFixed(1), fill: ['#ff6a1a', '#ffd34d', '#e8541c'][Math.floor(Math.random() * 3)], class: 'lava-drop',
          style: '--dx:' + (Math.cos(a) * d).toFixed(1) + 'px;--dy:' + (Math.sin(a) * d).toFixed(1) + 'px;animation-delay:' + (wave * 500 + Math.random() * 400).toFixed(0) + 'ms;animation-duration:' + (2.4 + Math.random() * 1.2).toFixed(2) + 's' }, 5000);
      }
    }
    for (let i = 0; i < 8; i++) {
      const dx = (Math.random() - 0.5) * 120;
      fxEl(fx, 'circle', { cx: (cx + (Math.random() - 0.5) * 40).toFixed(1), cy: cy - 60, r: (10 + Math.random() * 10).toFixed(1), fill: '#4a3f3a', class: 'erupt-smoke',
        style: '--dx:' + dx.toFixed(1) + 'px;animation-delay:' + (Math.random() * 600).toFixed(0) + 'ms' }, 5200);
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
        '<path class="wing" style="animation-delay:-' + (Math.random() * 0.4).toFixed(2) + 's" d="M-7.5,0 C-5.2,-4.4 -2.2,-4 -0.8,-1 L0,0.6 L0.8,-1 C2.2,-4 5.2,-4.4 7.5,0 C4.8,-2 2.2,-1.2 1,1.2 L0,2.2 L-1,1.2 C-2.2,-1.2 -4.8,-2 -7.5,0 Z" fill="#3b2a1c"/></g>';
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
      g.innerHTML = '<path class="wing" style="animation-delay:-' + (Math.random() * 0.4).toFixed(2) + 's" d="M-7.5,0 C-5.2,-4.4 -2.2,-4 -0.8,-1 L0,0.6 L0.8,-1 C2.2,-4 5.2,-4.4 7.5,0 C4.8,-2 2.2,-1.2 1,1.2 L0,2.2 L-1,1.2 C-2.2,-1.2 -4.8,-2 -7.5,0 Z" fill="#3b2a1c"/>';
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

  // Crebain from Dunland: a big, fast flock of dark crows sweeping low across the map.
  function crebain() {
    if (reduceMotion()) return false;
    const leftToRight = Math.random() < 0.5;
    const y0 = 260 + Math.random() * 360, y1 = y0 + (Math.random() - 0.5) * 220;
    const x0 = leftToRight ? -80 : BOARD.W + 80, x1 = leftToRight ? BOARD.W + 80 : -80;
    const dur = 6.5 + Math.random() * 1.5;
    let birds = '';
    for (let i = 0; i < 16; i++) {
      const bx = (leftToRight ? -1 : 1) * (Math.random() * 120), by = (Math.random() - 0.5) * 70;
      birds += '<g transform="translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ') scale(' + (0.9 + Math.random() * 0.5).toFixed(2) + ')">' +
        '<path class="wing crow" style="animation-delay:-' + (Math.random() * 0.3).toFixed(2) + 's" d="M-8.5,0.4 C-6,-4.6 -2.6,-4.4 -0.9,-1 L0,0.6 L0.9,-1 C2.6,-4.4 6,-4.6 8.5,0.4 L6.4,-0.6 L5.6,0.8 C4,-1.6 2.2,-1 1.1,1.4 L0,2.6 L-1.1,1.4 C-2.2,-1 -4,-1.6 -5.6,0.8 L-6.4,-0.6 Z" fill="#15131a"/></g>';
    }
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x0 + ',' + y0.toFixed(0) + ')');
    g.innerHTML = '<g class="flyby crebain" style="--fx:' + (x1 - x0) + 'px;--fy:' + (y1 - y0).toFixed(0) + 'px;--dur:' + dur.toFixed(1) + 's">' + birds + '</g>';
    layer('sky').appendChild(g);
    setTimeout(() => g.remove(), dur * 1000 + 500);
    return dur * 1000 + 500;
  }

  // Tom Bombadil skips through the Old Forest in his yellow boots.
  function bombadil() {
    const run = clearRun(260, 120, 720, 300, 620);
    if (!run) return false;
    const [x0, y] = run, x1 = x0 + 260;
    const dir = Math.random() < 0.5 ? 1 : -1;
    walker('critters', dir > 0 ? x0 : x1, y, (x1 - x0) * dir, 0, 9, dir < 0, SHADOW(10) + bombadilArt(), 'bombadil');
    return 9300;
  }
  // Tom Bombadil: blue jacket, yellow boots, brown beard and a battered hat with a long blue feather
  function bombadilArt() {
    const leg = (cls, x, dx) => '<g class="' + cls + '"><path d="M' + x + ',-13 L' + (x + dx) + ',-3" stroke="#6b4a2b" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M' + (x + dx - 2.4) + ',-5 h4.2 l.2,3 q3,.4 3.2,2 h-7.6 Z" fill="#f1c232" stroke="#9a7a12" stroke-width=".6"/></g>';
    return '<g class="skip">' + leg('leg-b', 2.5, 1) + leg('leg-a', -2.5, -1) +
      '<path d="M-8.4,-13 C-9.6,-20 -8.6,-28 -5.4,-32 L5.4,-32 C8.6,-28 9.6,-20 8.4,-13 C3,-11.6 -3,-11.6 -8.4,-13 Z" fill="#2f5fb0" stroke="#1d3c74" stroke-width=".8"/>' +
      '<path d="M2,-31 C4,-24 5,-18 5.4,-12.4" stroke="#24508f" stroke-width="1.4" fill="none"/>' +
      '<path d="M-8.6,-17 Q0,-15.4 8.6,-17" stroke="#6b4a2b" stroke-width="1.8" fill="none"/><rect x="-1.4" y="-17.6" width="2.8" height="2.4" rx=".4" fill="#e8b43a"/>' +
      '<circle cx="-1" cy="-24" r=".6" fill="#e8b43a"/><circle cx="-1.2" cy="-20.4" r=".6" fill="#e8b43a"/>' +
      '<g class="leg-a"><path d="M-6,-30 Q-12.5,-35 -12,-43" stroke="#2f5fb0" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="-12" cy="-44.4" r="1.6" fill="#ecc29c"/></g>' +
      '<g class="leg-b"><path d="M6,-30 Q12.5,-35 12,-43" stroke="#2f5fb0" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="12" cy="-44.4" r="1.6" fill="#ecc29c"/></g>' +
      '<ellipse cx="0" cy="-37" rx="5" ry="5.2" fill="#ecc29c"/>' +
      '<circle cx="-3" cy="-35.4" r="1.2" fill="#e88a7a" opacity=".6"/><circle cx="3.2" cy="-35.4" r="1.2" fill="#e88a7a" opacity=".6"/>' +
      '<path d="M-4.8,-36 C-5,-30 -2.4,-26.4 0,-25.6 C2.4,-26.4 5,-30 4.8,-36 C3,-33.4 -3,-33.4 -4.8,-36 Z" fill="#8a5a32"/>' +
      '<path d="M-2.6,-34.6 Q0,-32.6 2.6,-34.6" stroke="#5a3418" stroke-width=".8" fill="none"/>' +
      '<circle cx="-1.8" cy="-38.2" r=".6" fill="#1a1208"/><circle cx="1.8" cy="-38.2" r=".6" fill="#1a1208"/>' +
      '<path d="M-3,-40 Q-1.8,-40.8 -0.8,-40 M0.8,-40 Q1.8,-40.8 3,-40" stroke="#6b4a2b" stroke-width=".6" fill="none"/>' +
      '<path d="M-8.4,-41.4 C-4,-43.2 4,-43.2 8.4,-41.4 C5,-40.2 -5,-40.2 -8.4,-41.4 Z" fill="#5a3d22"/>' +
      '<path d="M-5,-42 C-5.4,-47 -3.6,-50.6 0.4,-50.4 C4,-50.2 5.4,-47 5,-42 Z" fill="#6b4a2b"/>' +
      '<path d="M-5,-43.6 Q0,-42.6 5,-43.6" stroke="#2f5fb0" stroke-width="1.2" fill="none"/>' +
      '<path d="M3.4,-44 C6,-50 10,-55 16.4,-57.4 C12.4,-53.6 8.6,-50 4.6,-43.4 Z" fill="#3a7ad0"/>' +
      '<path d="M3.8,-44 C7.6,-50.4 11,-54 16.4,-57.4" stroke="#1d3c74" stroke-width=".4" fill="none"/></g>';
  }

  // A Nazgûl on a winged beast circles high above Mordor, then flies off.
  function fellBeast() {
    if (reduceMotion()) return false;
    const g = document.createElementNS(SVGNS, 'g');
    g.innerHTML = fellBeastArt();
    layer('sky').appendChild(g);
    const cx = 1440, cy = 560, rx = 110, ry = 44, loops = 1.5, frames = [], N = 48;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI + (i / N) * loops * Math.PI * 2;
      frames.push({ transform: 'translate(' + (cx + Math.cos(a) * rx).toFixed(1) + 'px,' + (cy + Math.sin(a) * ry).toFixed(1) + 'px) scale(' + (Math.sin(a) < 0 ? 0.85 : 1) + ')', opacity: i === 0 ? 0 : 1, offset: (i / N) * 0.8 });
    }
    frames.push({ transform: 'translate(1700px,120px) scale(.6)', opacity: 0, offset: 1 });
    const anim = g.animate(frames, { duration: 13000, easing: 'linear' });
    anim.onfinish = () => g.remove();
    return 13300;
  }
  // A Nazgûl riding a fell beast: ragged bat-like wings, a long snaky neck and tail, the rider on its back
  function fellBeastArt() {
    const wing = '<path d="M-3,-2 C-12,-14 -30,-22 -60,-15 L-53,-9.5 C-56,-7 -57,-4 -56,-1 C-50,-3.6 -45,-3 -40,1 C-43,4 -43,7 -42,9.4 C-36,5 -29,4.4 -22,6 C-23,8 -22.6,10.6 -21,12 C-15,8 -9,6.6 -3,6 Z" fill="#141016"/>' +
      '<path d="M-3,-1 L-58,-14.4 M-28,-17.4 L-40,0.6 M-20,-12 L-22,5.6 M-40,-17.2 L-55,-1.4" stroke="#3e3446" stroke-width=".9" fill="none" stroke-linecap="round"/>';
    return '<g class="fell-beast" stroke="#8a7a92" stroke-width="1.2" stroke-opacity=".7">' +
      '<g class="fb-wings"><g stroke="#8a7a92">' + wing + '</g><g transform="scale(-1,1)">' + wing + '</g></g>' +
      '<path d="M-1.4,7 C-4,16 2,20 -1,27 C-3,31 1,35 3,37 L1.4,33 C4,30 5,24 2.4,19 C1,15 2.6,10 2,6 Z" fill="#141016"/>' +
      '<path d="M3,37 L5,40 L1,39 Z" fill="#141016"/>' +
      '<ellipse cx="0" cy="2" rx="4.6" ry="7.6" fill="#141016"/>' +
      '<path d="M-1.8,-4 C-3,-10 -1,-15 1,-19 L3.2,-18 C1.6,-14 1.8,-9 2,-4 Z" fill="#141016"/>' +
      '<path d="M-0.6,-18 C-1.4,-21 0,-25 2.4,-26.4 L3.2,-22.6 L5.2,-21.6 C4,-19.4 2.6,-18 1.2,-17 Z" fill="#141016"/>' +
      '<path d="M1,-24.4 L-1.4,-27 M2.6,-25.4 L2,-28.8" stroke="#141016" stroke-width=".8"/>' +
      '<circle cx="2.6" cy="-23" r=".55" fill="#c84020" stroke="none"/>' +
      '<path d="M-2.6,-3 L2.6,-3 L2,4 L-2,4 Z" fill="#1d1820"/><circle cx="0" cy="-4.6" r="2.2" fill="#1d1820"/>' +
      '<path d="M0,-6.8 L.4,-9.4 L1,-6.6 Z" fill="#b9c2c6" stroke="none"/></g>';
  }

  // Shadowfax, the white horse, gallops across open ground.
  function shadowfax() {
    const run = clearRun(380, 300, 1250, 240, 700);
    if (!run) return false;
    const [x0, y] = run, x1 = x0 + 380;
    const dir = Math.random() < 0.5 ? 1 : -1;
    walker('critters', dir > 0 ? x0 : x1, y, (x1 - x0) * dir, 0, 6, dir < 0, SHADOW(20) + shadowfaxArt(), 'shadowfax');
    return 6300;
  }
  function shadowfaxArt() {
    return '<g class="gallop">' + BOARD.horseArt({ coat: '#f8f8f4', shade: '#d6d8d4', mane: '#e4e8ee', hoof: '#8a8a86', eye: '#2a2a30', line: '#a8aaa6' }) + '</g>';
  }

  /* ---------- the sky over Mordor and at night ---------- */
  // Now and then silent lightning flickers behind Barad-dûr.
  function scheduleLightning(g) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion() && elLayer.hidden) lightning();
      scheduleLightning(g);
    }, 18000 + Math.random() * 26000);
  }
  function lightning() {
    let x = 1500 + (Math.random() - 0.5) * 80, y = 300, d = 'M' + x.toFixed(0) + ',' + y;
    while (y < 520) { y += 22 + Math.random() * 22; x += (Math.random() - 0.5) * 34; d += ' L' + x.toFixed(0) + ',' + y.toFixed(0); }
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'lightning');
    g.innerHTML = '<ellipse cx="1500" cy="420" rx="200" ry="150" fill="#d8c8ff" class="l-sky"/><path d="' + d + '" stroke="#f4eeff" stroke-width="2.4" fill="none" stroke-linejoin="round" class="l-bolt"/>';
    layer('terrain').appendChild(g);   // behind the dark tower
    setTimeout(() => g.remove(), 1400);
  }
  // On evening games, a rare shooting star crosses the sky.
  function scheduleStars(g) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion() && elLayer.hidden && look.time.name === 'Evening') shootingStar();
      scheduleStars(g);
    }, 22000 + Math.random() * 38000);
  }
  function shootingStar() {
    const x = 200 + Math.random() * 1100, y = 30 + Math.random() * 160, dir = Math.random() < 0.5 ? 1 : -1;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x.toFixed(0) + ',' + y.toFixed(0) + ') scale(' + dir + ',1)');
    g.innerHTML = '<g class="star-streak"><path d="M-70,-26 L0,0" stroke="url(#star-tail)" stroke-width="2.2" stroke-linecap="round"/><circle r="2.4" fill="#fffbe8"/></g>';
    layer('sky').appendChild(g);
    setTimeout(() => g.remove(), 1600);
  }

  // A hobbit who has stood still a long time sits down for a rest, or has a snack.
  function scheduleIdle(g) {
    setTimeout(() => {
      if (g !== gen || !playing) return;
      if (!reduceMotion()) {
        const now = performance.now();
        const bored = players.filter((p) => !p.place && !p.active && p.idleEl && now - p.lastMoved > 20000 && !p.idleEl.classList.contains('sit') && !p.idleEl.classList.contains('snack'));
        if (bored.length && Math.random() < 0.6) {
          const p = bored[Math.floor(Math.random() * bored.length)];
          const kind = Math.random() < 0.5 ? 'sit' : 'snack';
          p.idleEl.classList.add(kind);
          setTimeout(() => p.idleEl.classList.remove(kind), 5000);
        }
      }
      scheduleIdle(g);
    }, 6000 + Math.random() * 5000);
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
    setTimeout(() => g.remove(), 7200);
    return true;
  }

  /* ---------- visitors: Gollum, Gandalf, an eagle, a Black Rider, an Ent ---------- */
  // Every few turns one visitor may appear. They are only for show.
  let turnsSinceVisitor = 0;
  let visitorBusyUntil = 0;
  const VISITORS = [
    { id: 'gollum', weight: 3, run: () => peekGollum() && 7200 },
    { id: 'gandalf', weight: 2, run: () => gandalfCart() },
    { id: 'eagle', weight: 2, run: () => eagleFly(960, -70, 1230, 150, 1700, 330, 9, 1) && 9500 },
    { id: 'rider', weight: 2, run: () => { const y = clearLane(800, 616, 392, 110, 860); return y != null && blackRider(800, 616, y); } },
    { id: 'ent', weight: 2, run: () => entWalk() },
    { id: 'crebain', weight: 2, run: () => crebain() },
    { id: 'bombadil', weight: 1, run: () => bombadil() },
    { id: 'nazgul', weight: 1, run: () => fellBeast() },
    { id: 'shadowfax', weight: 1, run: () => shadowfax() }
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

  // Visitors walk straight across the map. Find the height nearest y0 (within the given range) where the
  // way from x0 to x1 stays clear of every road space. Returns null if there is no clear way.
  function clearLane(x0, x1, y0, yMin, yMax) {
    const lo = Math.min(x0, x1) - 30, hi = Math.max(x0, x1) + 30;
    const ok = (y) => !NODES.some((n) => n.x > lo && n.x < hi && n.y > y - 70 && n.y < y + 24);
    for (let d = 0; d <= Math.max(y0 - yMin, yMax - y0); d += 6) {
      if (y0 - d >= yMin && ok(y0 - d)) return y0 - d;
      if (y0 + d <= yMax && ok(y0 + d)) return y0 + d;
    }
    return null;
  }

  // Somewhere inside a box where a straight run of the given length stays clear of the road. Picks one at random.
  function clearRun(len, x0, x1, yMin, yMax) {
    const ok = (a, y) => !NODES.some((n) => n.x > a - 30 && n.x < a + len + 30 && n.y > y - 70 && n.y < y + 24);
    const found = [];
    for (let a = x0; a + len <= x1; a += 20) for (let y = yMin; y <= yMax; y += 10) if (ok(a, y)) found.push([a, y]);
    return found.length ? found[Math.floor(Math.random() * found.length)] : null;
  }

  // Gandalf's cart rolls through the Shire, letting off fireworks.
  function gandalfCart() {
    const x0 = -40, x1 = 250, dur = 10;
    const y = clearLane(x0, x1, 346, 250, 620);
    if (y == null) return false;
    walker('critters', x0, y, x1 - x0, 6, dur, false, cartArt(), 'cart');
    // fireworks along the way
    [0.25, 0.48, 0.72].forEach((t) => setTimeout(() => {
      if (!playing) return;
      firework(x0 + (x1 - x0) * t - 6, y - 70 - Math.random() * 50);
    }, dur * 1000 * t));
    return dur * 1000 + 300;
  }
  // Gandalf's cart: a grey pony pulling a little wagon of fireworks, Gandalf at the reins
  function cartArt() {
    const wheel = (cx) => '<g transform="translate(' + cx + ',-6)"><g class="wheel"><circle r="6" fill="none" stroke="#3a2614" stroke-width="1.6"/>' +
      '<path d="M-5.2,0 H5.2 M0,-5.2 V5.2 M-3.7,-3.7 L3.7,3.7 M-3.7,3.7 L3.7,-3.7" stroke="#5a3d22" stroke-width=".9"/><circle r="1.4" fill="#3a2614"/></g></g>';
    return '<ellipse cx="4" cy="1" rx="38" ry="5" fill="rgba(70,45,15,.2)"/>' +
      '<g transform="translate(30,0) scale(.62)"><g class="trot">' + BOARD.horseArt({ coat: '#b4b4ae', shade: '#8a8a84', mane: '#e8e8e2', hoof: '#4a4440', line: '#6d6d68' }) +
      '<path d="M7,-26 C9,-20 9,-16 8,-13" stroke="#4a3018" stroke-width="2" fill="none"/></g></g>' +
      // shafts and harness
      '<path d="M8,-12.5 L36,-12" stroke="#5a3d22" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="35.4" cy="-12" r="1.1" fill="#3a2614"/>' +
      '<path d="M-6,-37 Q14,-34 42,-25" stroke="#3a2614" stroke-width=".5" fill="none"/>' +
      // the wagon: planks, side rail and a load of rockets
      '<path d="M-20,-27 v-5 M-16,-27 v-8 M-12,-27 v-6 M-8,-27 v-9" stroke="#c8433a" stroke-width="2.6"/>' +
      '<path d="M-20,-32 v-1.6 M-16,-35 v-1.6 M-12,-33 v-1.6 M-8,-36 v-1.6" stroke="#2f6fc0" stroke-width="2.6"/>' +
      '<path d="M-18,-27 v-3 M-14,-27 v-5" stroke="#e8b43a" stroke-width="2.2"/>' +
      '<path d="M-25,-20 L10,-20 L8.5,-8 L-23.5,-8 Z" fill="#9a6a3a" stroke="#5a3d22" stroke-width="1.1" stroke-linejoin="round"/>' +
      '<path d="M-24.5,-16 H9.6 M-24,-12 H9" stroke="#7a5230" stroke-width=".8"/>' +
      '<path d="M-26,-21 H11" stroke="#6b4a2b" stroke-width="2.2" stroke-linecap="round"/>' +
      wheel(-16) + wheel(3) +
      // Gandalf on the seat: grey robe, long white beard, tall bent hat
      '<path d="M-1,-20 L-12,-20 C-12,-28 -10.5,-34 -8.5,-38 L-3.5,-38 C-2,-33 -1,-27 -1,-20 Z" fill="#8e9097" stroke="#4f5058" stroke-width=".7"/>' +
      '<path d="M-3.5,-35 Q-1,-35 2,-31" stroke="#8e9097" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="2.4" cy="-30.6" r="1.2" fill="#e3bc94"/>' +
      '<circle cx="-6" cy="-41" r="3.4" fill="#e9c4a0"/>' +
      '<path d="M-9.2,-41.4 C-9.2,-36 -7.6,-32 -5.6,-29.6 C-4,-32 -2.8,-36 -2.8,-41.4 Q-6,-38.6 -9.2,-41.4 Z" fill="#eeeeea"/>' +
      '<path d="M-7.6,-42.6 H-6.4 M-5.6,-42.6 H-4.4" stroke="#d8d8d2" stroke-width=".8"/>' +
      '<ellipse cx="-6" cy="-44.4" rx="7.6" ry="1.7" fill="#6a6c74"/>' +
      '<path d="M-9.6,-44.6 C-8.6,-51 -6.4,-56 -4.6,-58.6 C-3.4,-60.4 -1.2,-61 0.8,-59.8 C-1.8,-59 -2.4,-55 -2.4,-44.6 Z" fill="#7d7f88" stroke="#4f5058" stroke-width=".6"/>';
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

  function eagleArt(k) {
    // one wing (the left); the right is its mirror. Fingered tip feathers, a lighter band of coverts.
    const wing = '<path d="M-5,-3 C-15,-12 -33,-14.4 -49,-10.6 L-61,-8.6 L-53.6,-5.8 L-61.4,-3.4 L-53.4,-1.6 L-59,1.8 L-50.6,1.6 L-54,5.6 L-45,3.8 C-35,5.6 -20,7.6 -6,6.2 Z" fill="#4e3420" stroke="#2a1a0e" stroke-width=".9" stroke-linejoin="round"/>' +
      '<path d="M-5,-3 C-15,-11.6 -31,-13.2 -43.6,-9.6 C-33,-6.4 -19,-2.4 -6,1.4 Z" fill="#7a5532"/>' +
      '<path d="M-14,-6.6 C-22,-8.6 -30,-9 -38,-8 M-12,-1.6 C-22,-2.8 -32,-2 -42,0" stroke="#3a2614" stroke-width=".6" fill="none"/>';
    return '<g transform="scale(' + k + ')"><ellipse cx="0" cy="44" rx="34" ry="6" fill="rgba(40,25,10,.12)"/>' +
      '<g class="eagle-wings"><g>' + wing + '</g><g transform="scale(-1,1)">' + wing + '</g></g>' +
      '<path d="M-4.4,8 L-9.6,19.6 Q0,23.4 9.6,19.6 L4.4,8 Z" fill="#3e2818" stroke="#2a1a0e" stroke-width=".7"/>' +
      '<path d="M-2.4,10 L-4,20.6 M0,10 V21.6 M2.4,10 L4,20.6" stroke="#5a3c24" stroke-width=".5"/>' +
      '<path d="M0,-6.6 C7,-6.6 9.4,1 7.4,9.4 C5.6,14 -5.6,14 -7.4,9.4 C-9.4,1 -7,-6.6 0,-6.6 Z" fill="#6b4a2b" stroke="#3a2614" stroke-width=".7"/>' +
      '<path d="M-4.6,0 Q-2,2 0,0.4 Q2,2 4.6,0 M-5,4 Q-2.4,6 0,4.4 Q2.4,6 5,4" stroke="#4e3420" stroke-width=".6" fill="none"/>' +
      '<g stroke-linecap="round"><path d="M-4,10.6 L-5.2,16.4 M4,10.6 L5.2,16.4" stroke="#8a6a44" stroke-width="2.6"/>' +
      '<path d="M-5.2,16.4 l-2.2,3.6 M-5.2,16.4 l-.2,4 M-5.2,16.4 l1.8,3.4 M5.2,16.4 l2.2,3.6 M5.2,16.4 l.2,4 M5.2,16.4 l-1.8,3.4" stroke="#e8b43a" stroke-width="1.2"/></g>' +
      '<path d="M-5.4,-6.4 C-6.2,-12 -3.6,-15 0,-15 C3.6,-15 6.2,-12 5.4,-6.4 C3,-4.2 -3,-4.2 -5.4,-6.4 Z" fill="#f4eee0" stroke="#b8ae98" stroke-width=".5"/>' +
      '<path d="M-3.6,-11.4 L-1,-10.6 M3.6,-11.4 L1,-10.6" stroke="#3a3028" stroke-width=".9" stroke-linecap="round"/>' +
      '<circle cx="-2.2" cy="-10" r=".85" fill="#1a1208"/><circle cx="2.2" cy="-10" r=".85" fill="#1a1208"/>' +
      '<path d="M-1.8,-9 L1.8,-9 L1.4,-6 C1,-4.4 0,-4 -0.4,-5 L-1,-6.4 Z" fill="#e8b43a" stroke="#a87a1c" stroke-width=".4"/></g>';
  }
  function eagleFly(x0, y0, mx, my, x1, y1, dur, k) {
    if (reduceMotion()) return false;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + x0 + ',' + y0 + ')');
    g.setAttribute('class', 'visitor-eagle');
    g.innerHTML = '<g class="eagle-fly" style="--mx:' + (mx - x0) + 'px;--my:' + (my - y0) + 'px;--fx:' + (x1 - x0) + 'px;--fy:' + (y1 - y0) + 'px;--dur:' + dur + 's">' + eagleArt(k || 1) + '</g>';
    layer('sky').appendChild(g);
    setTimeout(() => Sound.eagle(), dur * 300);
    setTimeout(() => g.remove(), dur * 1000 + 300);
    return true;
  }

  // A Black Rider gallops across the Lone-lands near Bree.
  function blackRider(x0 = 800, x1 = 616, y = 392, dur = 7, dy = -4) {
    const art = SHADOW(22) + riderArt() +
      '<g class="rider-mist">' + [0, 1, 2].map((i) => '<circle cx="' + (-24 - i * 9) + '" cy="-4" r="' + (5 + i * 2) + '" fill="#3a3436" opacity=".25"/>').join('') + '</g>';
    walker('critters', x0, y, x1 - x0, dy, dur, x1 < x0, art, 'rider');
    Sound.rider();
    return dur * 1000 + 300;
  }
  function riderArt() {
    return '<g class="gallop">' +
      BOARD.horseArt({ coat: '#1d1714', shade: '#0d0908', mane: '#050405', hoof: '#000', eye: '#e33', line: '#3a3034' }) +
      // tattered black cloak streaming back over the horse
      '<path class="trot" d="M-3,-50 C-7,-42 -10,-34 -16,-27 L-13,-25.5 L-15,-22.5 L-11,-22.8 L-12,-19.5 L-7.5,-21.5 L-6,-19 L-3,-22 C0,-23 3,-24 5,-27 C6,-36 5,-44 3,-51 Z" fill="#0c0a0b" stroke="#2c2628" stroke-width=".5"/>' +
      '<path d="M1,-31 L4.5,-23.5 L3,-17.5" stroke="#0c0a0b" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M3,-46 Q9,-42 12,-37.5" stroke="#121012" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M12,-37.5 Q16,-37 19.5,-38.5" stroke="#3a3436" stroke-width=".5" fill="none"/>' +
      '<path d="M12.4,-38 L18.6,-62" stroke="#c9d2d6" stroke-width="1.1" stroke-linecap="round"/><path d="M10.6,-39.4 L14.4,-38.4" stroke="#6a6266" stroke-width="1.2"/>' +
      // the hood, with only darkness inside
      '<path d="M-4.6,-49 C-6.4,-60 -2.6,-68 0.8,-68.4 C4.6,-68 6.4,-61 5.4,-50 C2,-48.2 -1.6,-48.2 -4.6,-49 Z" fill="#0c0a0b" stroke="#2c2628" stroke-width=".5"/>' +
      '<path d="M0.6,-62.6 C3,-62.6 4.6,-60 4.4,-56.6 L1.4,-55.4 C0.4,-57.6 0,-60.4 0.6,-62.6 Z" fill="#000"/>' +
      '<circle cx="2.8" cy="-59.6" r=".45" fill="#d8e6e0" opacity=".8"/></g>';
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
    const dir = Math.random() < 0.5 ? 1 : -1;
    walker('critters', spot[0].toFixed(0), spot[1].toFixed(0), dir * 26, 0, 7.5, dir < 0, entArt(), 'ent');
    setTimeout(() => Sound.hoom(), 1500);
    return 7800;
  }
  // an Ent: a walking tree with bark skin, root feet, a mossy beard and a leafy crown
  function entArt() {
    const leaves = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#4a7434"/><circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.7) + '" fill="#5e8e42"/><circle cx="' + (x - r * 0.45) + '" cy="' + (y - r * 0.5) + '" r="' + (r * 0.35) + '" fill="#76a656"/>';
    return '<ellipse cx="0" cy="1" rx="16" ry="4" fill="rgba(40,30,10,.25)"/>' +
      '<g class="ent-body">' +
      '<path d="M-6,-8 C-8,-4 -10,-1 -13,0 L-4,0 C-4,-3 -3,-6 -2,-8 Z M2,-8 C3,-5 4,-2 4,0 L12,0 C9,-1 7,-4 6,-8 Z" fill="#5a3d22" stroke="#3a2614" stroke-width=".8"/>' +
      '<path d="M-9,-6 C-11,-26 -10,-44 -4,-58 L4,-58 C10,-44 11,-26 9,-6 C5,-4.4 -5,-4.4 -9,-6 Z" fill="#6b4a2b" stroke="#3a2614" stroke-width="1.1"/>' +
      '<path d="M3,-57 C8,-44 9,-26 8.4,-7 C6.6,-5.6 4.6,-5.4 3.4,-5.6 C5.4,-24 5.4,-42 3,-57 Z" fill="#5a3d22"/>' +
      '<path d="M-6,-10 C-5,-18 -7,-24 -5.6,-32 M-2,-8 C-1,-14 -3,-20 -1.6,-26 M5.6,-10 C6.4,-16 5,-22 6.2,-30 M-4.4,-46 C-5.4,-50 -4,-54 -2.6,-56" stroke="#4a3220" stroke-width=".9" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="-4" cy="-18" rx="1.4" ry="2" fill="#4a3220"/>' +
      '<path class="ent-arm" d="M-8,-36 C-18,-40 -24,-48 -26,-58 M-22,-50 l-6,-2 M-8,-28 C-16,-26 -20,-20 -22,-14 M-20,-17 l-4,1 M-22,-14 l-1,4" stroke="#5a3d22" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path class="ent-arm" d="M8,-36 C18,-42 22,-50 22,-60 M20,-52 l6,-3 M8,-28 C16,-26 20,-20 22,-14 M20,-17 l4,1 M22,-14 l1,4" stroke="#5a3d22" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      leaves(-8, -60, 9) + leaves(6, -64, 10) + leaves(-1, -70, 7) + leaves(0, -55, 7) + leaves(-26, -60, 5) + leaves(22, -62, 5) +
      '<path d="M-6,-34 C-7,-26 -4.6,-20 -2.4,-16 L-0.6,-20 L1.4,-15 C3.6,-20 7,-26 6,-34 C3,-32 -3,-32 -6,-34 Z" fill="#7a8a4a" opacity=".92"/>' +
      '<path d="M-3.4,-31 C-3.6,-26 -2.6,-22 -2,-19 M0.4,-31.6 V-21 M3.4,-31 C3.4,-27 3,-24 2.2,-20" stroke="#5a6a34" stroke-width=".6" fill="none"/>' +
      '<path d="M-6.2,-43.4 Q-3.4,-45.6 -0.8,-43.4 M0.8,-43.4 Q3.4,-45.6 6.2,-43.4" stroke="#3a2614" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<g class="ent-eyes"><ellipse cx="-3.4" cy="-40" rx="2" ry="2.4" fill="#f3e6a8"/><ellipse cx="3.4" cy="-40" rx="2" ry="2.4" fill="#f3e6a8"/>' +
      '<circle cx="-3.4" cy="-39.6" r=".9" fill="#2a1a08"/><circle cx="3.4" cy="-39.6" r=".9" fill="#2a1a08"/></g>' +
      '<ellipse cx="0" cy="-36" rx="1.5" ry="2.6" fill="#5a3d22" stroke="#3a2614" stroke-width=".5"/>' +
      '<path d="M-2.6,-32.4 q2.6,1.4 5.2,0" stroke="#3a2614" stroke-width="1" fill="none"/></g>';
  }

  /* ---------- passers-by in the open ground above the Hobbit Land title ---------- */
  // Every so often a small group walks across the open ground above the Hobbit Land title.
  // They are only for show and are not part of the game.
  const SIGN_Y = 668;   // feet line, just above the title box
  // Passers-by are drawn with their feet on the ground at (0,0). Legs and arms swing (classes leg-a / leg-b).
  const SHADOW = (rx) => '<ellipse cx="2" cy="1" rx="' + rx + '" ry="3.5" fill="rgba(40,30,10,.22)"/>';
  // an arm or leg that swings from its top: the limb, plus a hand, boot or foot at its end
  const limb = (cls, d, col, w, end) => '<g class="' + cls + '"><path d="' + d + '" stroke="' + col + '" stroke-width="' + w + '" fill="none" stroke-linecap="round"/>' + (end || '') + '</g>';
  const hand = (x, y, c) => '<circle cx="' + x + '" cy="' + y + '" r="1.25" fill="' + (c || '#ecc29c') + '"/>';
  // an elf of Lórien: tall and slim, long hair, grey-green cloak, a bow across the back
  function elfArt(dx, s, hair) {
    const h = hair || '#e9cf72', skin = '#f2dcbc';
    const boot = (x) => '<path d="M' + (x - 1.8) + ',-4 h3.2 l.4,4 h-4.2 Z" fill="#6b5238"/>';
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      '<path d="M-4,-46 C-8,-34 -11,-18 -12.6,-5 C-8.6,-3.6 -5,-3.8 -2,-5 C-3,-18 -2,-34 0,-46 Z" fill="#a9bba2" stroke="#6f8a68" stroke-width=".5"/>' +
      limb('leg-a', 'M-1.6,-16 L-1.8,-3', '#5a6a4a', 2.2, boot(-1.8)) + limb('leg-b', 'M1.6,-16 L1.8,-3', '#4e5e40', 2.2, boot(1.8)) +
      '<path d="M-6.4,-48 Q-11,-34 -5,-21" stroke="#8a6a3a" stroke-width="1.1" fill="none"/><path d="M-6.4,-48 L-5,-21" stroke="#efe6cc" stroke-width=".35"/>' +
      '<path d="M-4.6,-44.6 C-6,-36 -6.4,-24 -6.6,-14 L6.6,-14 C6.4,-24 6,-36 4.6,-44.6 Q0,-46 -4.6,-44.6 Z" fill="#9dbf96" stroke="#6f8a68" stroke-width=".6"/>' +
      '<path d="M2.4,-44 C3.6,-34 4,-24 4,-14.4 L6.6,-14 C6.4,-24 6,-36 4.6,-44.6 Z" fill="#86a880"/>' +
      '<path d="M0,-25 V-14.2" stroke="#6f8a68" stroke-width=".5"/><path d="M-6,-27.4 H6" stroke="#8a6a3a" stroke-width="1.3"/>' +
      limb('leg-b', 'M-4,-43 Q-7.4,-36 -6.6,-29.6', '#9dbf96', 2, hand(-6.6, -28.8, skin)) +
      limb('leg-a', 'M4,-43 Q7.4,-36 6.6,-29.6', '#9dbf96', 2, hand(6.6, -28.8, skin)) +
      '<path d="M-1.2,-48.4 H1.2 V-45 H-1.2 Z" fill="' + skin + '"/>' +
      '<path d="M-3.4,-51.4 L-8.4,-55 L-3.2,-49 Z M3.4,-51.4 L8.4,-55 L3.2,-49 Z" fill="' + skin + '" stroke="#c8a888" stroke-width=".3"/>' +
      '<path d="M-4.2,-53 C-6.6,-46 -6.2,-40 -4.8,-36.4 L-3,-41 L-3.2,-49 Z M4.2,-53 C6.6,-46 6.2,-40 4.8,-36.4 L3,-41 L3.2,-49 Z" fill="' + h + '"/>' +
      '<ellipse cx="0" cy="-51" rx="3.6" ry="4.3" fill="' + skin + '"/>' +
      '<path d="M-4.4,-51.6 C-4.8,-57.6 -2,-59.2 0,-59.2 C2,-59.2 4.8,-57.6 4.4,-51.6 C3.6,-54.4 1.6,-55.2 0,-55 C-1.6,-55.2 -3.6,-54.4 -4.4,-51.6 Z" fill="' + h + '"/>' +
      '<path d="M-4.2,-54.2 Q0,-55.8 4.2,-54.2" stroke="#f0dc8c" stroke-width=".55" fill="none"/>' +
      '<path d="M-2.2,-52.4 H-0.6 M0.6,-52.4 H2.2" stroke="#8a6a3a" stroke-width=".4"/>' +
      '<circle cx="-1.4" cy="-51.2" r=".5" fill="#1a3a30"/><circle cx="1.4" cy="-51.2" r=".5" fill="#1a3a30"/>' +
      '<path d="M-0.9,-48.6 Q0,-48.1 0.9,-48.6" stroke="#b07a6a" stroke-width=".4" fill="none"/>' +
      '<path d="M0,-45.6 C-1.6,-44.6 -1.6,-43 0,-42.4 C1.6,-43 1.6,-44.6 0,-45.6 Z" fill="#7fae5a" stroke="#c9a449" stroke-width=".4"/></g></g>';
  }
  function elfPair() {
    return SHADOW(16) + elfArt(0, 1) + elfArt(-14, 0.95, '#d6cfbe');
  }
  // an orc: hunched, grey-green, in rough leather and scraps of iron, with a jagged spear
  function orcArt(dx, s, helm) {
    const skin = '#6e7d4a', foot = (x) => '<path d="M' + (x - 2.6) + ',-3 h4.4 l.6,3 h-5.4 Z" fill="#2a221a"/>';
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      limb('leg-a', 'M-3,-12 L-3.6,-2.6', '#3d2f22', 3.2, foot(-3.6)) + limb('leg-b', 'M3,-12 L3.6,-2.6', '#33271c', 3.2, foot(3.6)) +
      limb('leg-a', 'M-4,-28 Q-8.4,-22 -7.4,-15.4', skin, 3, hand(-7.4, -14.6, skin)) +
      '<path d="M-7.4,-12 C-9,-20 -6.6,-28 -1.6,-31 C3,-32.6 8,-29 8.4,-24 C8.8,-19 8,-15 7,-12 Z" fill="#5a4a32" stroke="#2c2418" stroke-width=".7"/>' +
      '<path d="M-7.4,-12.4 L-5.6,-9.4 L-3.6,-12 L-1.4,-9.2 L1,-12 L3.2,-9.4 L5.2,-12 L7,-9.6 L7.2,-12.4 Z" fill="#4a3c28"/>' +
      '<path d="M-7.6,-17 Q0,-15.6 8,-17.4" stroke="#2a1d10" stroke-width="1.8" fill="none"/><rect x="-0.6" y="-18" width="2.6" height="2.4" fill="#8a7a5a"/>' +
      '<path d="M-1,-26 L4,-26.6 M-1.4,-22 L5,-22.4" stroke="#3e3222" stroke-width=".7"/>' +
      '<path d="M-4,-31.2 C-1,-34.2 4.2,-33.8 6.8,-30 L4.8,-26.8 C2,-29.4 -1,-29.2 -3.4,-27.4 Z" fill="#6d7278" stroke="#3a3e42" stroke-width=".6"/>' +
      limb('leg-b', 'M5,-27 Q10,-22 9,-14.6', skin, 3, hand(9, -14, skin)) +
      '<path d="M7.6,-6 L15,-46" stroke="#5a3d22" stroke-width="1.3"/>' +
      '<path d="M15,-46.4 L12.2,-39.2 L14.2,-40 L15.2,-37.4 L17.4,-39.8 Z" fill="#9aa2a8" stroke="#4f585e" stroke-width=".5"/>' +
      '<ellipse cx="2.6" cy="-34.6" rx="5.8" ry="5.2" fill="' + skin + '" stroke="#2c3520" stroke-width=".7"/>' +
      '<path d="M-2.4,-35.6 L-9.4,-40.6 L-3,-32.6 Z" fill="' + skin + '" stroke="#2c3520" stroke-width=".5"/>' +
      (helm ? '<path d="M-3.4,-36.4 C-3,-41.4 1,-42.4 3.4,-42.2 C6.6,-42 8.8,-39.6 8.4,-36.4 Q2.6,-38.4 -3.4,-36.4 Z" fill="#4a4e54" stroke="#2a2e32" stroke-width=".5"/>' : '') +
      '<path d="M-0.6,-38 L7.4,-37.2" stroke="#2c3520" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="1.4" cy="-36.2" r="1" fill="#ffd34d"/><circle cx="5" cy="-36" r="1" fill="#ffd34d"/>' +
      '<circle cx="1.6" cy="-36.2" r=".4" fill="#1a1208"/><circle cx="5.2" cy="-36" r=".4" fill="#1a1208"/>' +
      '<path d="M0,-31.6 Q3.6,-30.4 7.4,-32" stroke="#2c3520" stroke-width=".7" fill="none"/>' +
      '<path d="M1,-31.6 L0.6,-29.2 L2,-31.2 Z M5.8,-31.8 L6.6,-29.4 L5,-31.2 Z" fill="#f3ecd2"/></g></g>';
  }
  function orcBand() {
    return SHADOW(24) + orcArt(-24, 0.95) + orcArt(-8, 1, true) + orcArt(9, 0.9);
  }
  // a stocky dwarf: iron helm, braided beard, mail under a red tunic, an axe on his shoulder
  function dwarfArt(dx, s, beard) {
    const b = beard || '#9a8f80', skin = '#f0c9a3';
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      limb('leg-a', 'M-2.6,-9 L-3,-3.4', '#4a3a2a', 3.2, '<path d="M-5.6,-3.6 h4.8 v3.6 h-6 q0,-2 1.2,-3.6 Z" fill="#3b2a1e"/>') +
      limb('leg-b', 'M2.6,-9 L3,-3.4', '#4a3a2a', 3.2, '<path d="M0.8,-3.6 h4.8 q1.2,1.6 1.2,3.6 h-6 Z" fill="#3b2a1e"/>') +
      limb('leg-b', 'M-5.4,-23 Q-8.8,-18 -7.8,-13', '#7a2e1e', 3.4, hand(-7.8, -12.4, skin)) +
      '<path d="M-7,-8 C-8.4,-14 -7.6,-21 -4.6,-24.6 L4.6,-24.6 C7.6,-21 8.4,-14 7,-8 Z" fill="#7a2e1e" stroke="#4a1a10" stroke-width=".7"/>' +
      '<path d="M-7.2,-10.6 L7.2,-10.6 L6.6,-7.6 L-6.6,-7.6 Z" fill="#8a8f96" stroke="#5f646a" stroke-width=".4"/>' +
      '<path d="M-6.4,-9.1 H6.4" stroke="#5f646a" stroke-width=".9" stroke-dasharray=".8 .8"/>' +
      '<path d="M-7.6,-14.2 Q0,-13 7.6,-14.2" stroke="#3a2614" stroke-width="2.2" fill="none"/><rect x="-1.4" y="-15.4" width="2.8" height="2.4" rx=".3" fill="#d8a838"/>' +
      '<ellipse cx="0" cy="-29.4" rx="4.8" ry="4.9" fill="' + skin + '"/>' +
      '<path d="M-5.2,-29 C-6.6,-22 -4.6,-17 -2,-14.6 L-0.5,-17.4 L0.5,-17.4 L2,-14.6 C4.6,-17 6.6,-22 5.2,-29 C3.6,-27 2,-26.6 0,-27.2 C-2,-26.6 -3.6,-27 -5.2,-29 Z" fill="' + b + '" stroke="rgba(0,0,0,.25)" stroke-width=".4"/>' +
      '<path d="M-2.6,-24 L-2,-16.6 M2.6,-24 L2,-16.6 M0,-26 V-19" stroke="rgba(0,0,0,.22)" stroke-width=".5"/>' +
      '<circle cx="-2" cy="-15.4" r=".8" fill="#d8a838"/><circle cx="2" cy="-15.4" r=".8" fill="#d8a838"/>' +
      '<path d="M-3.2,-27 Q0,-28.6 3.2,-27" stroke="rgba(0,0,0,.35)" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="0.3" cy="-28.6" rx="1.4" ry="1.7" fill="#e0a888"/>' +
      '<path d="M-3.2,-31.4 L-0.8,-31 M3.2,-31.4 L0.8,-31" stroke="' + b + '" stroke-width="1" stroke-linecap="round"/>' +
      '<circle cx="-1.8" cy="-30.2" r=".55" fill="#1a1208"/><circle cx="1.8" cy="-30.2" r=".55" fill="#1a1208"/>' +
      '<path d="M-5.6,-31.4 C-5.6,-36.8 -3,-38.8 0,-38.8 C3,-38.8 5.6,-36.8 5.6,-31.4 Z" fill="#8a8f96"/>' +
      '<path d="M-6.2,-31.4 H6.2" stroke="#5f646a" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M-3,-36 Q-1,-37.8 1.4,-37.8" stroke="#c8ccd2" stroke-width=".7" fill="none"/>' +
      limb('leg-a', 'M5,-23 Q8.4,-19 7.8,-15', '#7a2e1e', 3.4, hand(7.8, -14.4, skin)) +
      '<path d="M7.2,-11 L9.8,-34" stroke="#6b4a2b" stroke-width="1.3" stroke-linecap="round"/>' +
      '<path d="M9.4,-33.6 C12.8,-35 14.8,-31.8 14.6,-28.6 C12.8,-29.6 10.8,-29.4 9.8,-28.4 Z" fill="#b4bcc2" stroke="#5f6870" stroke-width=".5"/>' +
      '</g></g>';
  }
  function dwarfPair() {
    return SHADOW(16) + dwarfArt(0, 1, '#8a5a32') + dwarfArt(-14, 0.95);
  }
  // a pack of wargs: big shaggy wolves with heavy heads and bushy tails
  function wargArt(dx, s) {
    const fur = '#6d665d', dark = '#4e4841';
    const fore = (x, col, cls) => '<g class="' + cls + '"><path d="M' + x + ',-14 h3 l-.6,7 l.6,6 h-1.7 l-.9,-6 Z" fill="' + col + '"/><ellipse cx="' + (x + 2.4) + '" cy="-0.7" rx="1.8" ry=".8" fill="' + col + '"/></g>';
    const hind = (x, col, cls) => '<g class="' + cls + '"><path d="M' + x + ',-15 h5 l-1.2,6 l-1.6,4 l.6,4 h-1.6 l-.8,-4 l.1,-4 Z" fill="' + col + '"/><ellipse cx="' + (x + 2.2) + '" cy="-0.7" rx="1.8" ry=".8" fill="' + col + '"/></g>';
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      fore(11, dark, 'leg-b') + hind(-11, dark, 'leg-a') +
      '<path d="M-11,-17 C-17,-19 -21,-16 -23,-10.6 C-20.4,-12.6 -18,-13 -15.4,-13 C-17,-11.6 -17.6,-9.6 -17.4,-7.6 C-14.6,-10.6 -12.4,-12 -11,-14 Z" fill="' + fur + '" stroke="#3a3430" stroke-width=".5"/>' +
      fore(8, fur, 'leg-a') + hind(-8, fur, 'leg-b') +
      '<path d="M-12,-15 C-12,-20 -8,-22 -2,-21 C4,-21 8,-25 13,-25.4 C17,-25.4 18.4,-21 17,-16 C16,-12.4 13,-11 10,-11.6 C6,-13 2,-13.6 -3,-12.6 C-7,-11.6 -12,-11 -12,-15 Z" fill="' + fur + '" stroke="#3a3430" stroke-width=".6"/>' +
      '<path d="M2,-21.4 L4.6,-25.6 L6.4,-23.6 L8.4,-27 L10.4,-24.8 L12.4,-27.6 L14,-24.4 L11,-21 Z" fill="' + dark + '"/>' +
      '<path d="M-3,-12.8 C2,-13.6 6,-13 10,-11.8 C6,-14.6 2,-15 -3,-12.8 Z" fill="#8a8378"/>' +
      '<path d="M15,-24 C17,-28.4 21,-28.4 23,-25.4 L29,-22 C30.2,-21 29.8,-19.2 28.2,-19 L23.2,-18 C20,-17 16,-18 15,-21 Z" fill="' + fur + '" stroke="#3a3430" stroke-width=".6"/>' +
      '<path d="M16.6,-26.4 L16.6,-31.6 L19.8,-27.4 Z M19.4,-27 L20.6,-31.8 L22.2,-26.4 Z" fill="' + dark + '"/>' +
      '<path d="M18.6,-24.6 L22.4,-23.6" stroke="#2a2620" stroke-width=".7"/><circle cx="21" cy="-23.2" r=".9" fill="#f0c040"/>' +
      '<circle cx="29" cy="-21.2" r=".9" fill="#1a1612"/>' +
      '<path d="M23,-19.4 L28.4,-19.6" stroke="#2a1612" stroke-width=".7"/><path d="M24.4,-19.4 l.4,1 l.4,-1 M26.4,-19.5 l.4,1 l.4,-1" stroke="#f3ecd2" stroke-width=".4" fill="none"/>' +
      '</g></g>';
  }
  function wargPack() {
    return SHADOW(20) + wargArt(-22, 0.95) + wargArt(0, 1) + wargArt(20, 0.9);
  }
  // Gandalf the Grey on foot: long robe, bent pointed hat, long white beard, a glowing staff
  function gandalfOnFoot() {
    const grey = '#8e9097', skin = '#e9c4a0';
    return SHADOW(12) + '<g class="trot">' +
      '<path class="leg-a" d="M-3.4,-3 L-5.6,0.8 L-0.6,0.8 Z" fill="#3a2a1a"/>' +
      '<path class="leg-b" d="M3,-3 L5.4,0.8 L0.6,0.8 Z" fill="#3a2a1a"/>' +
      limb('leg-a', 'M-4,-38 Q-8,-31 -7,-25', '#7d7f88', 3.4, hand(-7, -24.2, skin)) +
      '<path d="M-5,-41 C-7,-30 -10,-14 -12,0 L11.4,0 C9.4,-14 7.4,-30 5,-41 Z" fill="' + grey + '" stroke="#4f5058" stroke-width=".7"/>' +
      '<path d="M2,-38 C4,-26 7,-12 9,0 L11.4,0 C9.4,-14 7.4,-30 5,-41 Z" fill="#787a82"/>' +
      '<path d="M-2.6,-30 Q-4.6,-16 -6,-1 M0.6,-28 Q1.4,-14 2,-1" stroke="#686a72" stroke-width=".6" fill="none"/>' +
      '<path d="M-6.4,-42 Q0,-44.6 6.4,-42 L7,-34.6 Q0,-32 -7,-34.6 Z" fill="#7d7f88" stroke="#4f5058" stroke-width=".5"/>' +
      '<path d="M8.6,-23 L12.4,-63" stroke="#6b4a2b" stroke-width="1.7" stroke-linecap="round"/>' +
      '<path d="M12.4,-63 C10.6,-65 11.6,-67.4 13.6,-67 C15.4,-66.4 14.6,-64 13,-64" stroke="#6b4a2b" stroke-width="1.2" fill="none"/>' +
      '<circle cx="12.6" cy="-64.6" r="5" fill="#fff3b0" opacity=".3"/><circle cx="12.6" cy="-64.6" r="1.8" fill="#fff8d0"/>' +
      '<path d="M4,-39 Q8.2,-33 8.6,-27" stroke="#7d7f88" stroke-width="3.4" fill="none" stroke-linecap="round"/>' + hand(8.6, -26, skin) +
      '<rect x="-1.2" y="-43" width="2.4" height="3" fill="' + skin + '"/>' +
      '<path d="M-4,-47 C-5,-42 -4.6,-38 -4,-36 L-3,-44 Z M4,-47 C5,-42 4.6,-38 4,-36 L3,-44 Z" fill="#c9c9c2"/>' +
      '<circle cx="0" cy="-46.4" r="4" fill="' + skin + '"/>' +
      '<path d="M-3.8,-45.6 C-4,-40 -2.2,-35 0.4,-31.6 C2.4,-35 4,-40 3.8,-45.6 Q0,-42.6 -3.8,-45.6 Z" fill="#eeeeea" stroke="#c9c9c2" stroke-width=".4"/>' +
      '<path d="M-2.8,-44.4 Q0,-45.8 2.8,-44.4" stroke="#dcdcd6" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      '<path d="M-2.8,-48.4 L-0.6,-47.8 M2.8,-48.4 L0.6,-47.8" stroke="#dcdcd6" stroke-width=".9" stroke-linecap="round"/>' +
      '<circle cx="-1.4" cy="-47.2" r=".5" fill="#1a1208"/><circle cx="1.4" cy="-47.2" r=".5" fill="#1a1208"/>' +
      '<ellipse cx="0" cy="-50.6" rx="7.6" ry="1.7" fill="#6a6c74"/>' +
      '<path d="M-4.8,-51 C-3.8,-58 -1.6,-64 0.6,-67 C2,-69 4.6,-70.4 7,-69 C4.4,-68.2 3.4,-63 4.8,-51 Z" fill="#7d7f88" stroke="#4f5058" stroke-width=".6"/>' +
      '<path d="M-4.6,-52.6 Q0,-51.6 4.7,-52.6" stroke="#5a5c64" stroke-width=".7" fill="none"/></g>';
  }
  // a hobbit leading a pony loaded with packs
  function hobbitWithPony() {
    return SHADOW(24) + '<ellipse cx="36" cy="1" rx="7" ry="2.6" fill="rgba(40,30,10,.22)"/>' +
      '<path d="M22.4,-29 C28,-26 32,-22 33.2,-18" stroke="#8a6a3a" stroke-width=".7" fill="none"/>' +
      '<g class="trot"><g transform="scale(.82)">' + BOARD.horseArt({ coat: '#a87a4e', shade: '#7d5634', mane: '#3e2a18', hoof: '#2a1d14' }) +
      '<path d="M21,-43 L28.6,-35.6 M19.6,-39.6 L27,-34" stroke="#3a2614" stroke-width=".8"/>' +
      '<path d="M-11,-30 h12 v6 h-12 Z" fill="#9a6a3a" stroke="#5a3d22" stroke-width=".7"/>' +
      '<rect x="-9" y="-34" width="9" height="4" rx="2" fill="#6a7a4a" stroke="#3e4a2a" stroke-width=".5"/>' +
      '<path d="M-4.6,-24 V-18" stroke="#5a3d22" stroke-width="1"/></g></g>' +
      hobbitArt(36, 1, '#4f8a3a', true);
  }
  // a man of Gondor or a Ranger: tall, in a long cloak, with a sword at his side
  function manArt(dx, s, cloak) {
    const skin = '#e3bc94';
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      '<path d="M-6,-48 C-10,-34 -13,-18 -14,-9.6 C-9,-8.4 -4,-8.8 -1,-10 C-2,-22 -2,-36 -1,-48 Z" fill="' + cloak + '" stroke="#26301e" stroke-width=".6"/>' +
      limb('leg-a', 'M-2.4,-18 L-3,-4', '#4a3a2a', 3.2, '<path d="M-5.6,-6 h4.6 v6 h-5.8 q0,-1.4 1.2,-2 Z" fill="#2a1e14"/>') +
      limb('leg-b', 'M2.4,-18 L3,-4', '#3e3022', 3.2, '<path d="M0.8,-6 h4.4 v4 q1.4,.6 1.4,2 h-5.8 Z" fill="#2a1e14"/>') +
      limb('leg-b', 'M-6,-44 Q-10.4,-37 -9.6,-30.6', cloak, 3.2, hand(-9.6, -29.6, skin)) +
      '<path d="M-5.6,-46 C-7,-38 -7.4,-28 -7,-17 L7,-17 C7.4,-28 7,-38 5.6,-46 Q0,-47.6 -5.6,-46 Z" fill="#6b5a44" stroke="#3a2e22" stroke-width=".6"/>' +
      '<path d="M2.4,-45.6 C3.6,-36 4,-26 4,-17 L7,-17 C7.4,-28 7,-38 5.6,-46 Z" fill="#5a4a36"/>' +
      '<path d="M-7,-28 Q0,-26.6 7,-28" stroke="#2a1d10" stroke-width="1.7" fill="none"/><rect x="-1.2" y="-29.2" width="2.4" height="2.2" fill="#a8a088"/>' +
      '<path d="M5.6,-27 L12.4,-9.6" stroke="#2a1e14" stroke-width="1.9" stroke-linecap="round"/><path d="M3.8,-29.6 L7.8,-26.4" stroke="#a88a3a" stroke-width="1.3"/><circle cx="3.4" cy="-30" r=".9" fill="#a88a3a"/>' +
      '<path d="M-6.6,-46.6 Q0,-48.8 6.6,-46.6 L7.2,-41.8 Q0,-40.2 -7.2,-41.8 Z" fill="' + cloak + '" stroke="#26301e" stroke-width=".5"/>' +
      '<circle cx="0" cy="-44" r=".9" fill="#c8ccd2"/>' +
      limb('leg-a', 'M6,-44 Q10.4,-37 9.6,-30.6', cloak, 3.2, hand(9.6, -29.6, skin)) +
      '<rect x="-1.4" y="-50" width="2.8" height="4" fill="' + skin + '"/>' +
      '<ellipse cx="0" cy="-53" rx="4.2" ry="4.8" fill="' + skin + '"/>' +
      '<path d="M-3.8,-51.4 Q0,-46 3.8,-51.4 Q0,-48.8 -3.8,-51.4 Z" fill="#3a2a1c" opacity=".55"/>' +
      '<path d="M-4.8,-52.4 C-5.4,-59.6 -1.6,-60.2 0,-60 C1.6,-60.2 5.4,-59.6 4.8,-52.4 C4.8,-49 4.2,-47.4 3.4,-46.4 L3.2,-53 C2,-55.4 -2,-55.4 -3.2,-53 L-3.4,-46.4 C-4.2,-47.4 -4.8,-49 -4.8,-52.4 Z" fill="#3a2a1c"/>' +
      '<path d="M-2.6,-54.6 L-0.8,-54.2 M2.6,-54.6 L0.8,-54.2" stroke="#2a1c10" stroke-width=".6"/>' +
      '<circle cx="-1.5" cy="-53.2" r=".5" fill="#1a1208"/><circle cx="1.5" cy="-53.2" r=".5" fill="#1a1208"/>' +
      '</g></g>';
  }
  // a hobbit on his own: short, curly-haired, big bare feet, a coloured waistcoat
  function hobbitArt(dx, s, vest, leading) {
    const skin = '#f0c9a3', hair = '#6a4426', shirt = '#f1e6c8';
    const leg = (cls, x, f) => '<g class="' + cls + '"><path d="M' + x + ',-11 L' + (x + f * 0.4) + ',-6" stroke="#6b4a2b" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M' + (x + f * 0.4) + ',-6.4 L' + (x + f * 0.6) + ',-1.4" stroke="' + skin + '" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="' + (x + f * 1.6) + '" cy="-0.6" rx="2.9" ry="1.3" fill="#c48c5c"/><path d="M' + (x + f * 0.2) + ',-1.6 q' + f + ',-1 ' + 2 * f + ',0" stroke="#8a5a32" stroke-width=".5" fill="none"/></g>';
    return '<g transform="translate(' + dx + ',0) scale(' + s + ')"><g class="trot">' +
      leg('leg-a', -1.8, -1) + leg('leg-b', 1.8, 1) +
      limb('leg-b', 'M-4.6,-21.4 Q-7.8,-17 -7.2,-12.6', shirt, 2.4, hand(-7.2, -12, skin)) +
      '<path d="M-5.4,-22.6 C-6.4,-17 -6,-13 -5,-10 L5,-10 C6,-13 6.4,-17 5.4,-22.6 Q0,-24.4 -5.4,-22.6 Z" fill="' + shirt + '" stroke="#8a7a5a" stroke-width=".5"/>' +
      '<path d="M-5.2,-12 L5.2,-12 L5.4,-9 L-5.4,-9 Z" fill="#6b4a2b"/>' +
      '<path d="M-5.4,-22.4 C-6.2,-17 -5.8,-13.6 -5.1,-11.4 L-1,-11.4 L-0.6,-17.4 L-2.4,-22.9 Z M5.4,-22.4 C6.2,-17 5.8,-13.6 5.1,-11.4 L1,-11.4 L0.6,-17.4 L2.4,-22.9 Z" fill="' + vest + '"/>' +
      '<circle cx="-1.2" cy="-15.6" r=".55" fill="#e8c860"/><circle cx="-1.1" cy="-13" r=".55" fill="#e8c860"/>' +
      (leading ? '<path d="M4.6,-21.4 Q5.6,-18 -2.8,-17.6" stroke="' + shirt + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + hand(-3.2, -17.6, skin)
        : limb('leg-a', 'M4.6,-21.4 Q7.8,-17 7.2,-12.6', shirt, 2.4, hand(7.2, -12, skin))) +
      '<path d="M-4.2,-28.6 L-6.6,-31.4 L-4,-26.6 Z M4.2,-28.6 L6.6,-31.4 L4,-26.6 Z" fill="' + skin + '" stroke="#c89a70" stroke-width=".3"/>' +
      '<circle cx="0" cy="-27.4" r="4.5" fill="' + skin + '"/>' +
      '<circle cx="-2.8" cy="-26" r="1" fill="#e88a7a" opacity=".5"/><circle cx="2.8" cy="-26" r="1" fill="#e88a7a" opacity=".5"/>' +
      '<g fill="' + hair + '"><circle cx="-3.4" cy="-30.6" r="2"/><circle cx="-1.2" cy="-32" r="2.1"/><circle cx="1.4" cy="-32" r="2.1"/><circle cx="3.6" cy="-30.4" r="1.9"/>' +
      '<circle cx="-4.3" cy="-28.6" r="1.3"/><circle cx="4.4" cy="-28.4" r="1.3"/></g>' +
      '<circle cx="-1.5" cy="-27.6" r=".55" fill="#1a1208"/><circle cx="1.5" cy="-27.6" r=".55" fill="#1a1208"/>' +
      '<path d="M-1.4,-25 Q0,-23.9 1.4,-25" stroke="#8a4a2a" stroke-width=".6" fill="none" stroke-linecap="round"/>' +
      '</g></g>';
  }

  // When a hobbit reaches Mount Doom, the Free Peoples gather above the Hobbit Land title and dance
  // until the eagle sets the hobbit down at Bag End.
  let crowd = null;
  function startParty() {
    if (crowd || reduceMotion()) return;
    const folk = [
      () => hobbitArt(0, 1, '#b8862b'), () => dwarfArt(0, 1), () => elfArt(0, 1), () => manArt(0, 1, '#4a5a3a'),
      () => hobbitArt(0, 1, '#4f7a3a'), () => gandalfOnFoot(), () => dwarfArt(0, 1), () => hobbitArt(0, 1, '#7a2e1e'),
      () => elfArt(0, 1), () => manArt(0, 1, '#5a4a6a'), () => hobbitArt(0, 1, '#3a5a8a'),
    ];
    const n = folk.length, left = 58, right = 362;
    let html = '';
    folk.forEach((make, i) => {
      const x = left + (right - left) * i / (n - 1) + (Math.random() * 8 - 4);
      const flip = Math.random() < 0.5 ? -1 : 1;
      const d = (0.55 + Math.random() * 0.35).toFixed(2), dl = (-Math.random()).toFixed(2), r = ((Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 8)).toFixed(1);
      html += '<g class="dancer" style="animation-delay:' + (i * 0.18 + Math.random() * 0.3).toFixed(2) + 's" transform="translate(' + x.toFixed(1) + ',' + SIGN_Y + ')">' + SHADOW(11) +
        '<g class="dance" style="--d:' + d + 's;--dl:' + dl + 's;--r:' + r + 'deg"><g transform="scale(' + (1.25 * flip) + ',1.25)">' + make() + '</g></g></g>';
    });
    // Anyone already walking past above the title quietly fades away, so no one crosses in front of the dancers.
    for (const w of [...layer('critters').children]) {
      if ((w.getAttribute('transform') || '').endsWith(',' + SIGN_Y + ')')) { w.classList.add('shoo'); setTimeout(() => w.remove(), 700); }
    }
    crowd = document.createElementNS(SVGNS, 'g');
    crowd.setAttribute('class', 'crowd');
    crowd.innerHTML = html;
    layer('critters').appendChild(crowd);
  }
  function endParty() {
    if (!crowd) return;
    const c = crowd;
    crowd = null;
    c.classList.add('leaving');
    setTimeout(() => c.remove(), 900);
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
      if (!reduceMotion() && !crowd) passerby();
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
    return flyPts(p, ids.map((id) => [NODES[id].x, NODES[id].y]), lift, ms, carried);
  }
  // Fly a token through the air along a list of points (map coordinates).
  function flyPts(p, points, lift, ms, carried) {
    const pts = [[p.x, p.y]].concat(points);
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
  // After a hobbit's place is announced at Mount Doom, an eagle leaves Farmer Maggot's, glides over the map to Mount Doom,
  // lifts the hobbit and carries him over the top of the map to Bag End. The eagle stays on the map the whole way.
  // One eagle does the whole trip, and it never leaves the map.
  function animate(ms, fn) {
    const t0 = performance.now();
    return new Promise((res) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        fn(t);
        if (t < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  const ease = (t) => t * t * (3 - 2 * t);
  const quad = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  const inMap = (x, y) => [Math.max(60, Math.min(1540, x)), Math.max(50, Math.min(870, y))];
  // The bend point for a curve from height a to height b whose highest point is exactly `top`.
  const bendFor = (a, b, top) => top >= Math.min(a, b) ? Math.min(a, b) : top - Math.sqrt((a - top) * (b - top));
  async function eagleBack(p, g) {
    const start = geo.start;
    if (p.node === start) { endParty(); return; }
    const s = geo.nodes[start];
    if (reduceMotion()) {
      p.x = s.x; p.y = s.y; drawToken(p);
    } else {
      const home = geo.stopNode.maggot || s;
      const bird = document.createElementNS(SVGNS, 'g');
      bird.innerHTML = eagleArt(1);
      layer('sky').appendChild(bird);
      const put = (x, y, o) => {
        bird.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
        if (o != null) bird.setAttribute('opacity', o.toFixed(2));
      };
      const TALON = 70;                       // eagle sits this far above the hobbit's feet when holding him
      // 1. Rise up from Farmer Maggot's and glide across the top of the map to above Mount Doom.
      const [ax, ay] = inMap(home.x, home.y - 40);
      const [hx, hy] = inMap(p.x, p.y - TALON - 90);
      const cx = (ax + hx) / 2, cy = bendFor(ay, hy, Math.max(60, Math.min(ay, hy) - 150));
      Sound.eagle();
      await animate(4200, (t) => { const u = ease(t); put(quad(ax, cx, hx, u), quad(ay, cy, hy, u), Math.min(1, t * 5)); });
      guard(g);
      // 2. Drop down onto the hobbit and grab him.
      await animate(700, (t) => { const u = ease(t); put(hx, hy + (p.y - TALON - hy) * u); });
      guard(g);
      Sound.eagle();
      await sleep(350);
      guard(g);
      // 3. Carry him back over the map to Bag End.
      p.active = true;
      sortTokens();
      settleLater(p.node, p);
      const x0 = p.x, y0 = p.y;
      const LIFT = 80;
      const kx = (x0 + s.x) / 2, ky = bendFor(y0, s.y, Math.max(75 + TALON + LIFT, Math.min(y0, s.y) - 150));
      await animate(5200, (t) => {
        const u = ease(t);
        const nx = quad(x0, kx, s.x, u), ny = quad(y0, ky, s.y, u);
        if (Math.abs(nx - p.x) > 0.5) p.dir = nx < p.x ? -1 : 1;
        p.x = nx; p.y = ny;
        p.h0 = LIFT * Math.min(1, t * 6, (1 - t) * 6);
        drawToken(p);
        put(nx, ny - p.h0 - TALON);
      });
      guard(g);
      p.h0 = 0; drawToken(p);
      endParty();
      // 4. Let go, climb a little and fade away over Bag End.
      animate(1200, (t) => put(s.x, Math.max(40, s.y - TALON - 40 * ease(t)), 1 - t)).then(() => bird.remove());
    }
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
    // Each game picks one of the three maps at random.
    mapNow = MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
    geo = boardFor(settings.length, mapNow);
    NODES = geo.nodes;
    START_DIST = geo.startDist;
    renderBoard();
    playing = true; awaitingRoll = false; placesGiven = 0; moved = false; turnsSinceVisitor = 0; visitorBusyUntil = 0;
    scheduleBirds(gen);
    scheduleWander(gen);
    scheduleWeather(gen, true);
    scheduleSigns(gen, true);
    scheduleLightning(gen);
    scheduleStars(gen);
    scheduleIdle(gen);
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
    placeCompass();   // after the board is on screen, so the place names can be measured
    elDie.style.transform = 'rotateX(' + dieRot.x + 'deg) rotateY(' + dieRot.y + 'deg)';
    const g = gen;
    const first = players[current];
    setStatus(first, 'gets ready…');
    setRoll(false);
    sleep(700).then(() => {
      if (g !== gen) return;
      toast(look.season.name + ' ' + look.time.name.toLowerCase() + ' in the Shire.\nHobbits using the ' + MAP_NAMES[mapNow] + ' map.\n' + first.name + ' goes first!', first.h.color, 6000);   // stays up for 8 seconds (6 s + the 2 s hold)
      return sleep(8000);
    }).then(() => { if (g === gen) beginTurn(); });
  }

  function beginTurn() {
    if (!playing) return;
    const p = players[current];
    eyeOnLeader();
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
    if (n.stop === 'durin') wakeDoors(n);
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
    startParty();
    // a passing eagle visitor fades away, so the eagle that comes for the hobbit is the only one in the sky
    layer('sky').querySelectorAll('.visitor-eagle').forEach((e) => { e.classList.add('shoo'); setTimeout(() => e.remove(), 700); });
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
      if (p.mothsEl) p.mothsEl.setAttribute('display', p.bonus && !p.place && !reduceMotion() ? 'inline' : 'none');
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
    elToast.classList.toggle('lines', text.includes('\n'));   // several lines: keep each on its own line
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
