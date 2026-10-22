// ===================== GAME: loop, camera, input, audio, UI =====================
(() => {
'use strict';
const C = RallyCore, { M4, lin } = GFX;
const $ = id => document.getElementById(id);
const canvas = $('view');
const clamp = C.clamp, lerp = C.lerp, wrapA = C.wrapA;

let R = null;
try { R = GFX.createRenderer(canvas); } catch (e) { console.error(e); }
if (!R) {
  $('menu').hidden = true; $('garage').hidden = true;
  const o = $('loading'); o.hidden = false;
  o.innerHTML = '<div id="err" class="card"><h2 class="pause-title">No WebGL 2</h2><p>This game draws its stages with WebGL 2, and this browser or device did not provide it. Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.</p></div>';
  return;
}
const gl = R.gl;

// ---------- persistence ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('sideways.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sideways.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('sideways.' + k); } catch (e) { /* storage unavailable */ } },
};
const settings = Object.assign({ voice: false, sound: true, ghost: false, leadGhost: false, gfx: 'auto', fps: false, mirror: 'net', cam: 0, stage: 0, car: 0, gearbox: 'auto', rev: false, cond: 'day', name: '' }, store.get('settings', {}));
if (settings.stage !== 'daily') settings.stage = clamp(settings.stage | 0, 0, C.STAGES.length - 1);
settings.car = clamp(settings.car | 0, 0, C.CARS.length - 1);
if (!C.CONDS.includes(settings.cond)) settings.cond = 'day';
// ghost cars and the co-driver's voice are off unless you turn them on (once for everyone who had them on before)
if (!settings.v2) { settings.voice = false; settings.ghost = false; settings.v2 = 1; }
settings.dailyKey = C.dailyKey(); // a new day, a new road
// graphics: a preset sets every level below; touching one of them makes it 'custom' (settings.g). Everything is
// applied as it renders, nothing rebuilds the stage. Auto starts at Quality (Balanced on touch screens) and steps
// down for the session when the lowest resolution still can't hold the frame rate.
// Measured at 3200x2000 (ms/frame, Pine / Dark Pines / Monaco / Spa): Quality 14.0 / 14.2 / 8.3 / 8.0,
// Balanced 8.4 / 9.6 / 5.5 / 5.2, Performance 2.7 / 3.2 / 2.5 / 2.8. Resolution is most of it; then the post chain
// and MSAA (~3 ms each at that size), shadows ~1-2.5 ms. Shorter tree and grass distances changed nothing measurable.
// Minimum (owner: "una opción extrema, sin árboles ni cosas que cuesten") also bares the scenery: no grass, no crowd,
// trees as their far, solid shapes (they're still there to hit), and a lower resolution floor.
const PRESETS = {
  min: { res: 0, aa: 0, shadows: false, post: false, rays: false, scenery: false },
  perf: { res: 0, aa: 0, shadows: false, post: false, rays: false, scenery: true },
  bal: { res: 1, aa: 1, shadows: true, post: true, rays: false, scenery: true },
  qual: { res: 2, aa: 2, shadows: true, post: true, rays: true, scenery: true },
};
const GFX_LV = ['min', 'perf', 'bal', 'qual'], GFX_NAME = { auto: 'Auto', min: 'Minimum', perf: 'Performance', bal: 'Balanced', qual: 'Quality', custom: 'Custom' };
const RES_K = [0.5, 0.75, 1]; // of the screen's own pixels (at most 2 per CSS pixel)
const coarse = matchMedia('(pointer: coarse)').matches, gAuto = { lv: coarse ? 2 : 3 };
if ('shadows' in settings || 'post' in settings) { // before presets there were two switches: keep what was turned off
  if (settings.shadows === false || (settings.post === false && !coarse)) { // (touch screens started with post off)
    settings.gfx = 'custom';
    settings.g = Object.assign({}, PRESETS.qual, settings.shadows === false ? { res: 1, shadows: false } : {}, settings.post === false ? { post: false, rays: false } : {});
  }
  delete settings.shadows; delete settings.post;
}
if (!GFX_NAME[settings.gfx] || (settings.gfx === 'custom' && !settings.g)) settings.gfx = 'auto';
if (settings.g) settings.g = Object.assign({}, PRESETS.qual, settings.g);
const gq = () => settings.gfx === 'custom' ? settings.g : PRESETS[settings.gfx === 'auto' ? GFX_LV[gAuto.lv] : settings.gfx];
const saveSettings = () => store.set('settings', settings);
// ---- bytes <-> text (base64url) ----
function b64e(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(t) { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }
function dec(b64) { return new Float32Array(b64d(b64).buffer); } // legacy best-time ghosts: raw float32
// ---- compact ghosts ----
// A ghost is x, y, z, heading every 0.05 s. Quantised (2 cm, 1 mrad) and stored as second differences, which are
// tiny for anything that moves smoothly, as zig-zag varints: about 4 bytes a sample instead of 16, and they deflate well.
const GQ = [50, 50, 50, 1000];
function packGhost(g) {
  const n = Math.floor(g.length / 4), out = [];
  const put = v => { v = v < 0 ? -2 * v - 1 : 2 * v; while (v > 127) { out.push((v & 127) | 128); v = Math.floor(v / 128); } out.push(v); };
  put(n);
  for (let ch = 0; ch < 4; ch++) {
    let p1 = 0, d1 = 0;
    for (let i = 0; i < n; i++) { const q = Math.round(g[i * 4 + ch] * GQ[ch]), d = q - p1; put(i === 0 ? q : i === 1 ? d : d - d1); d1 = i === 0 ? 0 : d; p1 = q; }
  }
  return new Uint8Array(out);
}
function unpackGhost(u8, at) {
  let k = at || 0;
  const get = () => { let v = 0, m = 1, b; do { if (k >= u8.length) throw new Error('short ghost'); b = u8[k++]; v += (b & 127) * m; m *= 128; } while (b & 128); return v & 1 ? -(v + 1) / 2 : v / 2; };
  const n = get(); if (!(n > 0 && n < 40000)) throw new Error('bad ghost');
  const g = new Float32Array(n * 4);
  for (let ch = 0; ch < 4; ch++) {
    let q = 0, d1 = 0;
    for (let i = 0; i < n; i++) { const v = get(); if (i === 0) q = v; else { d1 = i === 1 ? v : d1 + v; q += d1; } g[i * 4 + ch] = q / GQ[ch]; }
  }
  return { g, end: k };
}
// ---- best times: one per stage variant and car ----
const pbKey = (key, car) => 'pb.' + key + '.' + car;
function loadPB(key, car) {
  const r = store.get(pbKey(key, car), null); if (!r) return null;
  try { r.ghost = r.q ? unpackGhost(b64d(r.q)).g : r.g ? dec(r.g) : null; } catch (e) { return null; }
  return r.ghost ? r : null;
}
function stageBest(key) { let best = null; for (const c of C.CARS) { if (c.bonus || c.only) continue; const r = store.get(pbKey(key, c.id), null); if (r && (!best || r.t < best.t)) best = { t: r.t, car: c.id }; } return best; }
// earlier versions kept one best per stage (whatever the car): it becomes that car's best
for (const st of C.STAGES) { const r = store.get('pb.' + st.id, null); if (r && r.t) { if (r.car && !store.get(pbKey(st.id, r.car), null)) store.set(pbKey(st.id, r.car), r); store.del('pb.' + st.id); } }
const carById = id => C.CARS.find(c => c.id === id);
const fmt = t => { if (t == null || !isFinite(t)) return '—'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const fmtD = d => (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2);

// ---------- state ----------
const STEP = 1 / 120;
const trackCache = new Map();
function trackFor(key) { let T = trackCache.get(key); if (!T) { T = C.buildTrack(C.stageDef(key)); trackCache.set(key, T); } return T; }
const keyFor = i => C.stageKey(C.STAGES[i].id, settings.rev, settings.cond);
function curKey() { if (rallyOn()) return rally.legs[rally.idx]; return settings.stage === 'daily' ? settings.dailyKey : keyFor(settings.stage); }
let W = null, S = null, P = C.CARS[settings.car], car = null, carModel = null, rival = null, pb = null, aiDone = null, chal = null;
let loadedKey = '', mode = 'boot', prevMode = 'race';
let rally = store.get('rally', null);
const rallyOn = () => !!(rally && !rally.done && rally.playing);
let raceT = 0, cdT = 0, cdShown = -1, finishT = 0, doneT = 0, splitsHit = [], ghostRec = [], ghostTimer = 0;
// Endless laps (settings.laps) on a closed circuit (W.T.lap, Monaco): no finish, the clock runs per lap from the line,
// the best lap per road and car is kept (store 'lap.<key>.<car>': time and where the car was every 0.05 s, for the
// delta). Every lap goes on the board (and online) under its own key, `<stage key>-lap` (lapKeyOf): a flying lap
// isn't comparable with the one-lap stage from the grid, so laps get a table of their own. No medals, no challenge
// links, no No. 1. Never in rallies or online rooms.
const lap = { n: 0, t0: 0, next: 0, best: null, last: null, rec: [], list: [] };
const lapsOn = () => !!(settings.laps && W && W.T.lap && !rallyOn() && !netRun());
const lapKey = (key, car) => `lap.${key}.${car}`;
// board keys: a stage key, or a stage key + '-lap' for the endless-laps table
const lapKeyOf = key => key + '-lap', isLapKey = k => /-lap$/.test(k), boardDef = k => C.stageDef(String(k).replace(/-lap$/, ''));
const boardTitle = k => C.stageTitle(boardDef(k)) + (isLapKey(k) ? ' · Laps' : '');
const lapsMenu = () => !!(settings.laps && settings.stage !== 'daily' && C.STAGES[settings.stage].street);
const curBoard = () => mapKey(curKeyMenu()) + (lapsMenu() ? '-lap' : '');
function lapBest(key, car) {
  const b = store.get(lapKey(key, car), null);
  return b && b.t > 0 && Array.isArray(b.s) ? { t: b.t, sArr: Float32Array.from(b.s, v => v / 10) } : null;
}
function onLap() {
  const t = raceT - lap.t0, old = lap.best, isBest = !old || t < old.t;
  lap.n++; lap.last = t; lap.t0 = raceT; lap.list.push(t);
  if (isBest && lap.rec.length > 20) {
    lap.best = { t, sArr: Float32Array.from(lap.rec) };
    store.set(lapKey(W.st.key, P.id), { t, s: lap.rec.map(v => Math.round(v * 10)), at: Date.now() });
  }
  lap.rec = [];
  if (settings.name && t > 20 && t < 1200 && boardAdd([{ n: settings.name, k: lapKeyOf(W.st.key), c: P.id, t, s: [], d: Date.now() }])) onlineSync();
  const d = old ? fmtD(t - old.t) : '';
  center(`<div class="mid yel">Lap ${lap.n}${isBest ? ' · best' : ''}</div><div class="sub ${!old || t <= old.t ? 'ahead' : 'behind'}">${fmt(t)}${d ? ` <span style="font-size:.6em;color:var(--mute)">${d}</span>` : ''}</div>`, 2.8);
  sfx.beep(990, 0.09); if (isBest) setTimeout(() => sfx.beep(1320, 0.18), 120);
  if (isBest && old) say('Best lap.');
}
let noteIdx = 0, called = [], offT = 0, stuckT = 0, wrongT = 0, time = 0, acc = 0, alpha = 0;
let resultsShown = false, lastMedal = 0;
// headlights: on by themselves for night and dusk stages, off by day; L (or the pad's d-pad up, or the touch
// button) switches them whenever you like
let lightsOn = false;
function setLights(on, quiet) {
  lightsOn = !!on;
  for (const id of ['pLights', 'touchLights']) { const b = $(id); if (b) b.setAttribute('aria-pressed', String(lightsOn)); }
  if (!quiet) { sfx.click && sfx.click(); $('camTag').textContent = 'Lights · ' + (lightsOn ? 'on' : 'off') + ' (L)'; camTagT = 2; }
}
const toggleLights = () => { if (mode === 'race' || mode === 'countdown' || mode === 'done' || mode === 'paused') setLights(!lightsOn); };
// the rear-view mirror: online races (the default), always or off, in Options and the pause menu; B in a run turns it on
// or off for this kind of run
const mirWanted = () => settings.mirror === 'on' || (settings.mirror === 'net' && netRun());
function setMirror(v) {
  settings.mirror = v; saveSettings();
  for (const id of ['optMirror', 'pMirror']) for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
}
for (const id of ['optMirror', 'pMirror']) for (const b of $(id).children) b.addEventListener('click', () => setMirror(b.dataset.v));
function toggleMirror() {
  setMirror(mirWanted() ? 'off' : netRun() ? 'net' : 'on');
  sfx.click && sfx.click(); $('camTag').textContent = 'Mirror · ' + (mirWanted() ? 'on' : 'off') + ' (B)'; camTagT = 2;
}
const prev = { x: 0, y: 0, z: 0, h: 0 };
const evt = { hit: 0, land: 0, shift: false, down: false, kind: '', x: 0, z: 0, nx: 0, nz: 0, front: true };
let input = { steer: 0, thr: 0, brk: 0, hb: false, analog: false };

// ---------- UI: menu ----------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const nf = n => Math.round(n).toLocaleString('en-US');
function drawThumb(cv, T, st) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  const acc = { pine: '#8cc06f', frost: '#8fb6ff', mesa: '#ff9152', forest: '#6fbf73', monaco: '#e6c27a', spa: '#7fc35a' }[st.id] || '#ffd23a';
  g.fillStyle = '#10141a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
  for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
  const b = T.bbox, sc = Math.min((w - 20) / (b.maxX - b.minX), (h - 20) / (b.maxZ - b.minZ));
  const ox = (w - (b.maxX - b.minX) * sc) / 2, oz = (h - (b.maxZ - b.minZ) * sc) / 2;
  const px = i => w - (ox + (T.X[i] - b.minX) * sc), pz = i => h - (oz + (T.Z[i] - b.minZ) * sc);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = acc; g.lineWidth = 6; g.globalAlpha = 0.28; g.beginPath();
  for (let i = 0; i < T.n; i += 2) i ? g.lineTo(px(i), pz(i)) : g.moveTo(px(i), pz(i)); g.stroke();
  g.globalAlpha = 1; g.strokeStyle = '#efece4'; g.lineWidth = 2.5; g.beginPath();
  for (let i = 0; i < T.n; i += 2) i ? g.lineTo(px(i), pz(i)) : g.moveTo(px(i), pz(i)); g.stroke();
  g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(px(0), pz(0), 5, 0, 7); g.fill();
  g.fillStyle = '#efece4'; g.fillRect(px(T.n - 1) - 4, pz(T.n - 1) - 4, 8, 8);
}
const MEDALS = ['', 'Bronze', 'Silver', 'Gold'];
const SHORT = { f1: 'F2008', foca: 'Focus', impressa: 'Impreza', lancha: 'Lancer Evo', delta: 'Delta', pejo: '205 T16', kwattro: 'Quattro S1', selica: 'Celica', saveiro: 'Saveiro' };
const shortCar = id => SHORT[id] || (carById(id) || { name: id }).name;
function stageRow(key, selected, onClick, extraTitle) {
  const st = C.stageDef(key), T = trackFor(key);
  const b = el('button', 'row stage-row'); b.setAttribute('aria-pressed', String(selected));
  const cv = el('canvas'); cv.width = 184; cv.height = 140; drawThumb(cv, T, st);
  const t = el('span', 't');
  t.append(el('b', null, extraTitle || st.name), el('small', null, `${st.surface} · ${(T.L / 1000).toFixed(1)} km · ${st.tag}`));
  const mine = store.get(pbKey(key, C.CARS[settings.car].id), null), best = stageBest(key), m = store.get('medal.' + key, 0);
  let line = mine ? `Best ${fmt(mine.t)}` : best ? 'No time in this car' : 'No time set yet';
  if (best && (!mine || best.car !== C.CARS[settings.car].id) && (!mine || best.t < mine.t)) line += ` · Record ${fmt(best.t)} ${shortCar(best.car)}`;
  if (rival && loadedKey === key) line += ` · Rival ${fmt(rival.time)}`;
  t.append(el('span', 'best', line));
  const ch = store.get('chal.' + key, null);
  if (ch) { const c = el('span', 'chal-tag'); c.textContent = `vs ${ch.n} · ${fmt(ch.t)}`; t.append(c); }
  const pip = el('span', 'medal-pip' + (m ? ' m' + m : '')); pip.title = m ? MEDALS[m] + ' medal' : 'No medal yet';
  b.append(cv, t, pip);
  b.addEventListener('click', onClick);
  return b;
}
function renderStageList() {
  renderChallengeBanner();
  const daily = $('dailyRow'); daily.innerHTML = '';
  const dk = settings.dailyKey;
  daily.append(stageRow(dk, settings.stage === 'daily', () => { settings.dailyKey = C.dailyKey(); selectStage('daily'); }, C.stageDef(dk).name + (dk !== C.dailyKey() ? ' · ' + dk.slice(12, 14) + '/' + dk.slice(10, 12) : '')));
  const box = $('stageList'); box.innerHTML = '';
  C.STAGES.forEach((st, i) => box.append(stageRow(keyFor(i), settings.stage === i, () => selectStage(i))));
  // direction and conditions apply to the four fixed stages; the daily stage is what it is
  const fixed = settings.stage !== 'daily';
  for (const b of $('optDir').children) { b.setAttribute('aria-pressed', String((b.dataset.v === 'rev') === !!settings.rev)); b.disabled = !fixed; }
  const kind = fixed ? C.STAGES[settings.stage].kind : 'pine';
  for (const b of $('optCond').children) { b.setAttribute('aria-pressed', String(b.dataset.v === settings.cond)); b.disabled = !fixed; b.textContent = C.condName({ kind }, b.dataset.v); }
  $('varNote').hidden = fixed;
  // closed circuits (Monaco) can be driven lap after lap
  const circuit = fixed && !!C.STAGES[settings.stage].street;
  $('optLaps').hidden = !circuit;
  for (const b of $('optLaps').children) b.setAttribute('aria-pressed', String((b.dataset.v === 'laps') === !!settings.laps));
  updateSummary();
}
function renderStageInfo() { renderStageList(); renderRallyPane(); renderTimes(); }
function updateSummary() {
  $('startBtn').classList.toggle('wait', false);
  if (inRoom()) {
    const room = net.room, host = room && net.peers.get(room.h), n = peerList().length;
    $('selSummary').textContent = `Room ${net.code} · ${room ? C.stageDef(room.k).name : '…'} · ${C.CARS[settings.car].name}`;
    let label = `Start race · ${n} driver${n > 1 ? 's' : ''} `, wait = true;
    if (!room || net.status !== 'online') label = 'Connecting… ';
    else if (room.ph !== 'lobby') label = 'Race in progress ';
    else if (!isHost()) label = `Waiting for ${host ? host.n : 'the host'} `;
    else wait = false;
    $('startBtn').firstChild.textContent = label; $('startBtn').classList.toggle('wait', wait);
    return;
  }
  const tab = document.querySelector('.tab[aria-selected="true"]');
  if (tab && tab.id === 'tabRally') {
    const r = rally && !rally.done ? rally : null, it = RALLIES.find(x => x.id === (r ? r.id : settings.rallyId)) || RALLIES[0];
    $('selSummary').textContent = `${it.name} · ${(r ? carById(r.car) : C.CARS[settings.car]).name}`;
    $('startBtn').firstChild.textContent = r ? `Continue rally · SS${r.idx + 1} ` : 'Start rally ';
  } else {
    const laps = lapsMenu(), lb = laps && lapBest(curKeyMenu(), C.CARS[settings.car].id);
    $('selSummary').textContent = `${C.stageTitle(C.stageDef(curKeyMenu()))} · ${C.CARS[settings.car].name}${laps ? ' · endless laps' + (lb ? ', best ' + fmt(lb.t) : '') : ''}`;
    $('startBtn').firstChild.textContent = laps ? 'Start laps ' : 'Start stage ';
  }
}
// the stage the menu has selected (a rally in progress doesn't change what the Stage tab shows)
function curKeyMenu() { return settings.stage === 'daily' ? settings.dailyKey : keyFor(settings.stage); }
function renderCarList() {
  const box = $('carList'); box.innerHTML = '';
  C.CARS.forEach((c, i) => {
    const b = el('button', 'row car-row'); b.setAttribute('aria-pressed', String(i === settings.car));
    const sw = el('span', 'swatch'); sw.style.background = `linear-gradient(135deg, ${c.col.base} 0 52%, ${c.col.stripe} 52% 70%, ${c.col.stripe2} 70%)`;
    const t = el('span', 't'); t.append(el('b', null, c.name));
    if (c.bonus) {
      const ok = !inRoom() && bonusOK(curKeyMenu()), lead = leaderOf(curKeyMenu()), road = C.stageDef(mapKey(curKeyMenu())).name;
      b.classList.add('bonus'); if (!ok) b.classList.add('locked');
      t.append(el('small', ok ? null : 'lock', inRoom() ? '🔒 Not in online races: those are run in the rally cars' : ok ? `You're No. 1 on ${road}: the keys are yours · its times don't count`
        : lead ? `🔒 Only the No. 1 on ${road} drives it (${lead.n} right now)` : `🔒 Set the fastest time on ${road} to unlock it`));
      for (const [x, y, d] of [[2, 10, 0], [97, 18, 0.6], [52, 86, 1.1], [92, 84, 0.3], [30, 4, 1.4]]) { const sp = el('span', 'spark', '✦'); sp.style.left = x + '%'; sp.style.top = y + '%'; sp.style.animationDelay = d + 's'; b.append(sp); }
    } else if (c.only) {
      const ok = fitsRoad(c, curKeyMenu()), road = onlyNames(c);
      b.classList.add('only'); if (!ok) b.classList.add('locked');
      t.append(el('small', ok ? null : 'lock', ok ? `${c.era} · ${c.engine.layout} · its times are a class of their own` : `🔒 ${road} only`));
    } else t.append(el('small', null, `${c.era} · ${c.engine.layout} turbo`));
    const hp = el('span', 'hp'); hp.append(`${Math.round(c.peak.hp)} hp`); hp.append(el('small', null, `0–100 ${c.spec.t100.toFixed(1)} s`));
    b.append(sw, t, hp);
    b.addEventListener('click', () => selectCar(i, b));
    box.append(b);
  });
  renderCarCard(); renderTune();
}
// ---- the bonus car: whoever holds No. 1 on a road (any car, any conditions) may take the Saveiro there ----
const isBonus = c => !!(c && c.bonus);
// cars kept apart from the rally cars' times: the bonus Saveiro and the cars built for one road (the F1 at Monaco)
const apart = c => !!(c && (c.bonus || c.only));
const fitsRoad = (c, key) => !c.only || [].concat(c.only).includes(C.stageDef(key).id);
// the roads a car built for some of them runs on, by name ("Monaco and Spa-Francorchamps")
const onlyNames = c => [].concat(c.only).map(id => C.stageDef(id).name).join(' and ');
function leaderOf(key) {
  const m = mapKey(key), oc = online.on ? online.cache.get(m) : null; let best = null;
  for (const e of [...boardAll().filter(x => mapKey(x.k) === m), ...(oc ? oc.rows : [])]) if (!apart(carById(e.c)) && (!best || e.t < best.t)) best = e;
  return best;
}
const bonusOK = key => { const b = leaderOf(key); return !!(b && settings.name && b.n.toLowerCase() === settings.name.toLowerCase()); };
const plainCar = () => { const i = settings.lastCar | 0; return C.CARS[i] && !apart(C.CARS[i]) ? i : 0; };
// hand the keys back when the road, the name or the board says the Saveiro isn't yours here (or a rally starts)
function keepCarAllowed(key) {
  const c = C.CARS[settings.car];
  if (c.only) {
    if (fitsRoad(c, key || curKeyMenu())) return false;
    settings.car = plainCar(); saveSettings();
    toast(`The ${shortCar(c.id)} only runs at ${onlyNames(c)}: back in the ${C.CARS[settings.car].name}.`);
    if (inRoom()) netTrack();
    return true;
  }
  if (!isBonus(c) || (!inRoom() && bonusOK(key || curKeyMenu()))) return false;
  settings.car = plainCar(); saveSettings();
  toast(`The Saveiro stays with the No. 1 of each road: back in the ${C.CARS[settings.car].name}.`);
  return true;
}
function specRows(c) {
  const E = c.engine, pk = c.peak;
  return [
    ['Engine', `${E.code} · ${(E.disp / 1000).toFixed(1)} L ${E.layout.toLowerCase()}`],
    ['Aspiration', E.boostBar ? `${E.asp} · ${E.boostBar.toFixed(1)} bar` : E.asp],
    ['Power', `${nf(pk.hp)} hp <em>@ ${nf(pk.hpRpm)} rpm</em>`],
    ['Torque', `${nf(pk.nm)} Nm <em>@ ${nf(pk.nmRpm)} rpm</em>`],
    ['Redline', `${nf(E.redline)} rpm`],
    ['Gearbox', `${c.gearbox.gears}-speed ${c.gearbox.type} <em>· ${c.gearbox.shift.toFixed(2)} s shifts</em>`],
    ['Drivetrain', `${c.drive.layout} ${Math.round(c.drive.front * 100)}/${Math.round(100 - c.drive.front * 100)} <em>· ${c.drive.diff}</em>`],
    ['Weight', `${nf(c.mass)} kg <em>· ${Math.round(c.pw)} hp/t</em>`],
    ['Balance', `${Math.round(c.wd * 100)} / ${Math.round(100 - c.wd * 100)} <em>front / rear</em>`],
    ['Wheelbase', `${c.wb.toFixed(2)} m`],
    ['0–100 km/h', `${c.spec.t100.toFixed(2)} s <em>tarmac</em>`],
    ['0–160 km/h', `${c.spec.t160.toFixed(2)} s`],
    c.engine.boostBar ? ['Boost lag', `${c.spec.lag.toFixed(2)} s <em>to full boost from 60 km/h</em>`] : ['Boost lag', 'None <em>· no turbo</em>'],
    ['Top speed', `${Math.round(c.spec.vmax)} km/h <em>stage gearing</em>`],
  ];
}
function buildSheet(box, c) {
  box.innerHTML = '';
  const s = C.carStats(c);
  const stats = el('div', 'stats');
  for (const [k, v] of [['Speed', s.speed], ['Accel', s.accel], ['Grip', s.grip], ['Agility', s.handling], ['Turbo lag', c.engine.boostBar ? s.lag : 0], ['Stability', s.stability]]) {
    stats.append(el('span', null, k));
    const bar = el('div', 'bar'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `${k} ${v} of 10`);
    for (let i = 0; i < 10; i++) bar.append(el('i', i < v ? 'on' : ''));
    stats.append(bar);
  }
  const dy = el('div', 'dyno');
  const head = el('div', 'dyno-head'); const read = el('span', 'dyno-read', 'Hover or tap the curves');
  head.append(el('span', 'label', 'Dyno'), read);
  const cv = el('canvas'); cv.width = 640; cv.height = 336; cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', `Power peaks at ${Math.round(c.peak.hp)} hp at ${c.peak.hpRpm} rpm; torque peaks at ${Math.round(c.peak.nm)} Nm at ${c.peak.nmRpm} rpm`);
  dy.append(head, cv);
  const dl = el('dl', 'spec');
  for (const [k, v] of specRows(c)) { dl.append(el('dt', null, k)); const dd = el('dd'); dd.innerHTML = v; dl.append(dd); }
  const ch = el('p', 'character', c.character || '');
  box.append(ch, stats, dy, dl);
  drawDyno(cv, c, null);
  const hover = e => {
    const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * cv.width;
    const rpm = dynoRpmAt(c, x);
    if (rpm == null) { read.textContent = 'Hover or tap the curves'; drawDyno(cv, c, null); return; }
    const p = c.curve[Math.round((rpm - 1000) / 100)];
    read.textContent = `${nf(rpm)} rpm · ${Math.round(p[2])} hp · ${Math.round(p[1])} Nm`;
    drawDyno(cv, c, rpm);
  };
  cv.addEventListener('pointermove', hover);
  cv.addEventListener('pointerdown', hover);
  cv.addEventListener('pointerleave', () => { read.textContent = 'Hover or tap the curves'; drawDyno(cv, c, null); });
}
const DY = { l: 56, r: 616, t1: 30, b1: 150, t2: 186, b2: 300 };
function dynoX(c, rpm) { const max = c.engine.redline; return DY.l + (rpm - 1000) / (max - 1000) * (DY.r - DY.l); }
function dynoRpmAt(c, x) { if (x < DY.l - 6 || x > DY.r + 6) return null; const max = c.engine.redline; return clamp(Math.round((1000 + (x - DY.l) / (DY.r - DY.l) * (max - 1000)) / 100) * 100, 1000, max); }
function drawDyno(cv, c, hoverRpm) {
  const g = cv.getContext('2d'), pts = c.curve;
  g.clearRect(0, 0, cv.width, cv.height);
  const panel = (top, bot, idx, maxV, label, unit, peakRpm, peakV) => {
    g.strokeStyle = 'rgba(236,232,220,0.08)'; g.lineWidth = 2;
    for (let k = 0; k <= 2; k++) { const y = bot - (bot - top) * k / 2; g.beginPath(); g.moveTo(DY.l, y); g.lineTo(DY.r, y); g.stroke(); }
    g.fillStyle = '#8d95a1'; g.font = '600 20px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText(String(Math.round(maxV)), DY.l - 10, top); g.fillText('0', DY.l - 10, bot);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#c9c6be'; g.font = '700 20px "Barlow Semi Condensed", sans-serif';
    g.fillText(label, DY.l, top - 10);
    const Y = v => bot - v / maxV * (bot - top);
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(dynoX(c, p[0]), Y(p[idx])) : g.moveTo(dynoX(c, p[0]), Y(p[idx])));
    g.lineTo(dynoX(c, pts[pts.length - 1][0]), bot); g.lineTo(dynoX(c, pts[0][0]), bot); g.closePath();
    g.fillStyle = 'rgba(255,210,58,0.12)'; g.fill();
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(dynoX(c, p[0]), Y(p[idx])) : g.moveTo(dynoX(c, p[0]), Y(p[idx])));
    g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
    const px = dynoX(c, peakRpm), py = Y(peakV);
    g.fillStyle = '#11151b'; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill();
    g.fillStyle = '#efece4'; g.font = '700 20px "Chivo Mono", monospace'; g.textAlign = px > DY.r - 120 ? 'right' : 'left';
    g.fillText(`${Math.round(peakV)} ${unit}`, px + (g.textAlign === 'right' ? -14 : 14), Math.max(top + 8, py - 12));
    if (hoverRpm != null) {
      const hp = pts[Math.round((hoverRpm - 1000) / 100)];
      const hx = dynoX(c, hoverRpm), hy = Y(hp[idx]);
      g.fillStyle = '#efece4'; g.beginPath(); g.arc(hx, hy, 7, 0, 7); g.fill();
    }
  };
  const maxHp = Math.ceil(c.peak.hp / 100) * 100, maxNm = Math.ceil(c.peak.nm / 100) * 100;
  panel(DY.t1, DY.b1, 2, maxHp, 'Power · hp', 'hp', c.peak.hpRpm, c.peak.hp);
  panel(DY.t2, DY.b2, 1, maxNm, 'Torque · Nm', 'Nm', c.peak.nmRpm, c.peak.nm);
  // shared rpm axis
  g.fillStyle = '#8d95a1'; g.font = '600 20px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let r = 2000; r <= c.engine.redline; r += 2000) if (dynoX(c, r) < DY.r - 60) g.fillText(`${r / 1000}k`, dynoX(c, r), DY.b2 + 10);
  g.textAlign = 'right'; g.fillText('rpm', DY.r, DY.b2 + 10);
  // turbo onset marker
  const ox = dynoX(c, c.engine.onset);
  g.strokeStyle = 'rgba(236,232,220,0.25)'; g.setLineDash([6, 6]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(ox, DY.t1); g.lineTo(ox, DY.b2); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#8d95a1'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('boost', ox + 6, DY.b1 - 6);
  if (hoverRpm != null) {
    const hx = dynoX(c, hoverRpm);
    g.strokeStyle = 'rgba(236,232,220,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, DY.t1); g.lineTo(hx, DY.b2); g.stroke();
  }
}
function renderCarCard() {
  const c = C.CARS[settings.car];
  $('gNum').textContent = '#' + c.num;
  $('gCls').textContent = c.era;
  $('gName').textContent = c.name;
  $('gNod').textContent = c.note;
  buildSheet($('gSheet'), c);
  buildSheet($('specInline'), c);
  updateSummary();
}
// tabs
for (const t of document.querySelectorAll('.tab')) {
  t.addEventListener('click', () => {
    for (const o of document.querySelectorAll('.tab')) { o.setAttribute('aria-selected', String(o === t)); $(o.dataset.pane).hidden = o !== t; }
    if (t.id === 'tabRally') renderRallyPane();
    if (t.id === 'tabOnline') renderOnline();
    $('gSheet').hidden = t.id !== 'tabCar'; $('gTimes').hidden = t.id === 'tabCar';
    updateSummary();
  });
}
function updateToggles() {
  for (const [id, key] of TOGGLES) $(id).setAttribute('aria-pressed', String(!!settings[key]));
  $('gearAuto').setAttribute('aria-pressed', String(settings.gearbox !== 'manual'));
  $('gearManual').setAttribute('aria-pressed', String(settings.gearbox === 'manual'));
  if (A.master) A.master.gain.value = settings.sound ? 0.55 : 0;
}
const TOGGLES = [['optVoice', 'voice'], ['optSound', 'sound'], ['optGhost', 'ghost'], ['optLead', 'leadGhost'], ['optFps', 'fps'], ['pVoice', 'voice'], ['pSound', 'sound'], ['pGhost', 'ghost'], ['pLead', 'leadGhost']];
for (const [id, key] of TOGGLES) {
  $(id).addEventListener('click', () => {
    settings[key] = !settings[key]; saveSettings(); updateToggles();
    if (key === 'voice' && !settings.voice && 'speechSynthesis' in window) speechSynthesis.cancel();
    if (key === 'leadGhost' && settings.leadGhost && W) onlineGhost(mapKey(W.st.key));
    if (key === 'fps') renderGfx();
  });
}
// ---- graphics ----
// after any change: a fresh measuring window for the dynamic resolution, and the menu
function applyGfx(user) {
  dyn.acc = 0; dyn.n = 0; dyn.slow = 0;
  if (user) { dyn.scale = 1; dyn.lastDown = -99; } // a new choice starts at full resolution and is judged from there
  renderGfx();
}
function setGfx(v) {
  if (v === 'auto' && settings.gfx !== 'auto') gAuto.lv = coarse ? 2 : 3;
  settings.gfx = v; delete settings.g; saveSettings(); applyGfx(true);
}
// one level by hand: the preset becomes 'custom', starting from what was in use
function setGfxLevel(k, v) {
  const g = Object.assign({}, gq(), { [k]: v });
  if (k === 'post' && !v) g.rays = false; // the shafts are part of the post chain
  if (k === 'rays' && v) g.post = true;
  const same = GFX_LV.find(n => Object.keys(PRESETS[n]).every(q => PRESETS[n][q] === g[q]));
  if (same) { settings.gfx = same; delete settings.g; } else { settings.gfx = 'custom'; settings.g = g; }
  saveSettings(); applyGfx(true);
}
function renderGfx() {
  const G = gq(), lv = settings.gfx === 'auto' ? GFX_LV[gAuto.lv] : null;
  for (const id of ['optGfx', 'pGfx']) for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v === settings.gfx));
  for (const el of document.querySelectorAll('[data-g]')) for (const b of el.children) b.setAttribute('aria-pressed', String(String(G[el.dataset.g]) === b.dataset.v));
  for (const k in GFX_OPT) $(GFX_OPT[k]).setAttribute('aria-pressed', String(G[k]));
  $('gfxNote').textContent = settings.gfx === 'auto' ? `Running ${GFX_NAME[lv]}. Auto starts high and steps down if your device can't hold 60 fps.`
    : settings.gfx === 'custom' ? 'Custom: your own mix of the settings below.'
    : { min: 'For very slow devices: no grass or crowds, simple trees, low resolution.', perf: 'Lower resolution, no shadows, no glow.', bal: 'Sharp enough and smooth on most laptops.', qual: 'Everything on, at full resolution.' }[settings.gfx];
  $('fps').hidden = !settings.fps;
}
for (const id of ['optGfx', 'pGfx']) for (const b of $(id).children) b.addEventListener('click', () => setGfx(b.dataset.v));
for (const el of document.querySelectorAll('[data-g]')) for (const b of el.children) b.addEventListener('click', () => setGfxLevel(el.dataset.g, +b.dataset.v));
const GFX_OPT = { scenery: 'optScenery', shadows: 'optShadows', post: 'optPost', rays: 'optRays' };
for (const k in GFX_OPT) $(GFX_OPT[k]).addEventListener('click', () => setGfxLevel(k, !gq()[k]));
$('gearAuto').addEventListener('click', () => { settings.gearbox = 'auto'; saveSettings(); updateToggles(); });
$('gearManual').addEventListener('click', () => { settings.gearbox = 'manual'; saveSettings(); updateToggles(); });
function selectStage(i) {
  if (mode === 'loading') return;
  if (inRoom() && !isHost()) { toast('In a room the host picks the stage.'); return; }
  if (inRoom() && net.room.ph !== 'lobby') { toast('Wait for this race to finish.'); return; }
  if (rally && rally.playing) { rally.playing = false; saveRally(); }
  settings.stage = i; if (i === 'daily') settings.dailyKey = settings.dailyKey || C.dailyKey();
  timesStage = null;
  keepCarAllowed(); renderCarList(); // the Saveiro's and the F1's locks depend on the road
  saveSettings(); renderStageList();
  if (curKey() !== loadedKey) loadStage(curKey());
  if (inRoom()) netStageSync();
}
for (const b of $('optDir').children) b.addEventListener('click', () => { settings.rev = b.dataset.v === 'rev'; selectStage(settings.stage); });
for (const b of $('optCond').children) b.addEventListener('click', () => { settings.cond = b.dataset.v; selectStage(settings.stage); });
for (const b of $('optLaps').children) b.addEventListener('click', () => { settings.laps = b.dataset.v === 'laps'; saveSettings(); timesStage = null; renderStageList(); renderTimes(); });
// per-car customisation (sound only): what the turbo does on a lift, and the exhaust
function getTune(id) {
  const V = VOICES[id] || VOICES.foca, t = (settings.tune || {})[id] || {};
  return { dump: t.dump || (V.flutter > 0.5 ? 'flutter' : 'bov'), exhaust: t.exhaust || 'stock', music: t.music || 'on' };
}
function renderTune() {
  const c = C.CARS[settings.car], t = getTune(c.id); // the selected car (P only follows once its model is built)
  $('tuneCar').textContent = c.name;
  for (const b of $('tuneDump').children) b.setAttribute('aria-pressed', String(b.dataset.v === t.dump));
  for (const b of $('tuneExh').children) b.setAttribute('aria-pressed', String(b.dataset.v === t.exhaust));
  $('tuneMusicRow').hidden = !isBonus(c);
  $('tuneDumpRow').hidden = !c.engine.boostBar; // no turbo, nothing to release
  for (const b of $('tuneMusic').children) b.setAttribute('aria-pressed', String(b.dataset.v === t.music));
}
function setTune(key, v) {
  settings.tune = settings.tune || {};
  const id = C.CARS[settings.car].id;
  settings.tune[id] = Object.assign({}, settings.tune[id] || {}, { [key]: v });
  saveSettings(); renderTune();
  if (key === 'music') { initAudio(); return; } // the speakers just start or stop
  // let them hear it: blip the throttle and lift (the click is the user gesture audio needs; initAudio
  // rebuilds the engine voice when the exhaust changed)
  initAudio(); if (!A.ctx) return;
  Object.assign(A, { rev: REV_T, revRpm: P.engine.idle, revB: 0, revThr: 0, press: 0, holdT: 0, thrPk: 0, alT: 0, dumpT: 0 });
}
const REV_T = 2.4;
for (const b of $('tuneDump').children) b.addEventListener('click', () => setTune('dump', b.dataset.v));
for (const b of $('tuneExh').children) b.addEventListener('click', () => setTune('exhaust', b.dataset.v));
for (const b of $('tuneMusic').children) b.addEventListener('click', () => setTune('music', b.dataset.v));
function selectCar(i, btn) {
  if (mode === 'loading') return;
  const c = C.CARS[i];
  if (c.only && !fitsRoad(c, curKeyMenu())) {
    if (btn) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
    toast(`The ${shortCar(c.id)} is built for ${onlyNames(c)}: pick one of those first.`);
    return;
  }
  if (isBonus(c) && inRoom()) {
    if (btn) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
    toast('Online races are run in the rally cars: the Saveiro waits outside.');
    return;
  }
  if (isBonus(c) && !bonusOK(curKeyMenu())) {
    if (btn) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
    const lead = leaderOf(curKeyMenu());
    toast(lead ? `Only ${lead.n} (No. 1 on ${C.stageDef(mapKey(curKeyMenu())).name}) gets the Saveiro here. Beat ${fmt(lead.t)} first.` : 'Set the fastest time on this road first: the Saveiro goes to the No. 1.');
    return;
  }
  if (!apart(c)) settings.lastCar = i;
  const fresh = isBonus(c) && settings.car !== i;
  settings.car = i; saveSettings(); renderCarList();
  if (inRoom()) netTrack();
  if (fresh) {
    initAudio(); if (A.ctx && sfx.horn) { sfx.horn(-0.3); setTimeout(() => sfx.horn(0.3), 260); }
    const row = $('carList').children[i]; if (row) row.classList.add('yay');
  }
  if (rally && rally.playing) { rally.playing = false; saveRally(); if (curKey() !== loadedKey) { loadStage(curKey()); return; } }
  setupCar(); renderStageInfo();
}
$('startBtn').addEventListener('click', () => menuGo());
function menuGo() {
  if (inRoom()) { netStart(); return; }
  const tab = document.querySelector('.tab[aria-selected="true"]');
  if (tab && tab.id === 'tabRally') { startOrContinueRally(); return; }
  if (rally && rally.playing) { rally.playing = false; saveRally(); }
  if (keepCarAllowed()) { renderCarList(); if (curKey() === loadedKey) setupCar(); }
  if (curKey() !== loadedKey) { loadStage(curKey(), () => startRace()); return; }
  startRace();
}

// ---------- loading ----------
function showLoading(text) { $('loadingText').textContent = text; $('loading').hidden = false; }
function hideLoading() { $('loading').hidden = true; }
function loadStage(key, after) {
  const prevMode2 = mode;
  mode = 'loading';
  const st = C.stageDef(key) || C.stageDef(C.STAGES[0].id);
  showLoading('Building ' + C.stageTitle(st));
  setTimeout(() => {
    R.disposeAll(); carModel = null; csMesh = null; csTex = null;
    net.models.clear(); if (net.race) for (const o of net.race.others.values()) o.model = null;
    W = C.buildWorld(st);
    S = WORLD.buildScene(R, W);
    loadedKey = st.key;
    document.body.dataset.cond = st.cond;
    document.body.dataset.stage = W.st.id;
    // whatever brought this road here (Next, a link, the menu), the car must be allowed on it
    if (!rallyOn() && keepCarAllowed(st.key)) renderCarList();
    setupCar();
    buildMinimap(); buildTvSpots(); resetEffects();
    hideLoading();
    mode = prevMode2 === 'boot' || prevMode2 === 'loading' ? 'menu' : 'menu';
    renderStageInfo();
    if (after) after();
  }, 50);
}
function disposeCar(m) { if (!m) return; for (const k of ['body', 'glass', 'lens', 'lightF', 'lightR', 'flame', 'wheel', 'wheelBlur', 'wheelR', 'wheelBlurR', 'caliper', 'spk']) if (m[k]) R.disposeMesh(m[k]); if (m.tex) gl.deleteTexture(m.tex); if (m.tyreTex) gl.deleteTexture(m.tyreTex); }
function setupCar() {
  P = C.CARS[settings.car];
  disposeCar(carModel);
  carModel = WORLD.buildCar(R, P, !!S.E.night);
  buildContactShadow();
  rival = null;
  for (const ag of [0.9, 0.86, 0.82, 0.78]) {
    const r = C.simulateRun(W, P, { aggr: ag });
    if (!rival || (r.resets + r.hits) * 10 + r.offT < (rival.resets + rival.hits) * 10 + rival.offT) rival = r;
    if (r.resets === 0 && r.hits === 0 && r.offT < 1.5) { rival = r; break; }
  }
  rival.sArr = refCurve(rival.ghost);
  pb = loadPB(W.st.key, P.id);
  if (pb) pb.sArr = refCurve(pb.ghost);
  loadChallenge();
  loadLead(); if (settings.leadGhost) onlineGhost(mapKey(W.st.key));
  aiDone = C.prepAI(W, P, 0.86);
  car = C.makeCar(W, P, W.T.spawnS);
  snapVis();
  if (A.ctx) buildVoice();
}
function refCurve(g) {
  const T = W.T, n = g.length / 4, sArr = new Float32Array(n), tmp = {};
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const x = g[k * 4], z = g[k * 4 + 2];
    let bi = idx, bd = 1e18;
    for (let i = Math.max(0, idx - 10); i <= Math.min(T.n - 1, idx + 40); i++) { const dx = x - T.X[i], dz = z - T.Z[i]; const d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
    idx = bi; C.project(T, bi, x, z, tmp);
    sArr[k] = Math.max(k ? sArr[k - 1] : 0, tmp.s);
  }
  return sArr;
}
function refTimeAt(sArr, s) {
  let lo = 0, hi = sArr.length - 1;
  if (s <= sArr[0]) return 0.05;
  if (s >= sArr[hi]) return (hi + 1) * 0.05;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sArr[m] < s) lo = m; else hi = m; }
  const f = (s - sArr[lo]) / Math.max(1e-4, sArr[hi] - sArr[lo]);
  return (lo + 1 + f) * 0.05;
}
function ghostPose(g, t, out) {
  const n = g.length / 4; let f = t / 0.05 - 1;
  if (f < 0) f = 0; if (f > n - 1) f = n - 1;
  const i = Math.floor(f), j = Math.min(n - 1, i + 1), a = f - i;
  out.x = lerp(g[i * 4], g[j * 4], a); out.y = lerp(g[i * 4 + 1], g[j * 4 + 1], a); out.z = lerp(g[i * 4 + 2], g[j * 4 + 2], a);
  out.h = g[i * 4 + 3] + wrapA(g[j * 4 + 3] - g[i * 4 + 3]) * a; out.k = f;
  return out;
}

// ---------- challenges ----------
// A challenge is a link: the stage, the car, the time, the splits, the driver's name and the ghost, packed, deflated
// and base64url-encoded after '#c='. Opening it stores the challenge on that stage; from then on the friend's ghost
// runs there in red and the delta and results compare against them. Nothing goes through a server.
const driverName = () => (settings.name || '').trim() || 'A friend';
const cleanName = t => String(t || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) || 'A friend';
const utf8 = new TextEncoder(), utf8d = new TextDecoder();
async function zip(u8, inflate) {
  const Z = inflate ? window.DecompressionStream : window.CompressionStream; if (!Z) return null;
  const out = new Blob([u8]).stream().pipeThrough(new Z('deflate-raw'));
  return new Uint8Array(await new Response(out).arrayBuffer());
}
async function makeChallengeLink(run) {
  const head = utf8.encode(JSON.stringify({ v: 1, k: run.key, c: run.car, t: +run.t.toFixed(3), s: run.splits.map(x => +x.toFixed(3)), n: cleanName(driverName()), L: trackFor(run.key).L, d: Math.floor(Date.now() / 1000) }));
  const gh = packGhost(run.ghost);
  const raw = new Uint8Array(2 + head.length + gh.length);
  raw[0] = head.length & 255; raw[1] = head.length >> 8; raw.set(head, 2); raw.set(gh, 2 + head.length);
  let body = null; try { body = await zip(raw, false); } catch (e) { body = null; }
  const data = body || raw, out = new Uint8Array(1 + data.length);
  out[0] = body ? 0x81 : 0x01; out.set(data, 1);
  return location.href.split('#')[0] + '#c=' + b64e(out);
}
async function readChallenge(text) {
  const u8 = b64d(text);
  if (u8.length < 8 || (u8[0] & 0x7f) !== 1) throw new Error('version');
  let raw = u8.subarray(1);
  if (u8[0] & 0x80) { raw = await zip(raw, true); if (!raw) throw new Error('this browser cannot unpack it'); }
  const hl = raw[0] | (raw[1] << 8);
  const h = JSON.parse(utf8d.decode(raw.subarray(2, 2 + hl)));
  const st = typeof h.k === 'string' ? C.stageDef(h.k) : null;
  if (!st || !carById(h.c) || !(h.t > 20 && h.t < 1200) || !Array.isArray(h.s) || h.s.length !== 2 || !h.s.every(x => x > 0 && x < h.t)) throw new Error('not a valid run');
  if (h.L && Math.abs(trackFor(h.k).L - h.L) > 1) throw new Error('the stage has changed since this run');
  const { g } = unpackGhost(raw, 2 + hl);
  if (Math.abs(g.length / 4 * 0.05 - h.t) > 3) throw new Error('ghost does not match the time');
  return { k: h.k, c: h.c, t: h.t, s: h.s, n: cleanName(h.n), d: h.d || 0, q: b64e(packGhost(g)) };
}
let pendingChal = null;
async function checkChallengeLink() {
  const mr = /[#&]r=([A-Za-z0-9]{4})(?![A-Za-z0-9])/.exec(location.hash || '');
  if (mr) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file: */ }
    $('tabOnline').click(); netJoin(mr[1]);
    return;
  }
  const mb = /[#&]b=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (mb) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file: */ }
    try { const r = await readTimes(mb[1]); toast(r.added ? `Added ${r.added} of ${r.n}'s times to your leaderboard.` : `You already had ${r.n}'s times.`); renderTimes(); }
    catch (e) { toast('That times link could not be read (' + e.message + ').'); }
    return;
  }
  const m = /[#&]c=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file: */ }
  try {
    const c = await readChallenge(m[1]);
    store.set('chal.' + c.k, c);
    boardAdd([{ n: c.n, k: c.k, c: c.c, t: c.t, s: c.s, d: (c.d || 0) * 1000, f: 1 }]);
    pendingChal = c;
    $('tabStage').click();
    renderStageInfo();
    if (W && W.st.key === c.k) loadChallenge();
  } catch (e) { toast('That challenge link could not be read (' + e.message + ').'); }
}
function loadChallenge() {
  chal = null;
  const c = W && store.get('chal.' + W.st.key, null);
  if (!c) return;
  try { c.ghost = unpackGhost(b64d(c.q)).g; c.sArr = refCurve(c.ghost); chal = c; } catch (e) { chal = null; }
}
function renderChallengeBanner() {
  const box = $('chalBox'); box.innerHTML = '';
  const c = pendingChal; if (!c) return;
  const st = C.stageDef(c.k);
  const card = el('div', 'chal-card');
  const t = el('div', 't');
  t.append(el('span', 'label', 'Challenge'), el('b', null, `${c.n} set ${fmt(c.t)}`), el('small', null, `${C.stageTitle(st)} · ${carById(c.c).name}`));
  const go = el('button', 'btn primary', 'Race it'), no = el('button', 'btn', 'Later');
  go.addEventListener('click', () => acceptChallenge(c));
  no.addEventListener('click', () => { pendingChal = null; renderChallengeBanner(); });
  const a = el('div', 'actions'); a.append(go, no);
  card.append(t, a); box.append(card);
}
function acceptChallenge(c) {
  if (inRoom()) { toast('Leave the room first: this one is a race against a ghost.'); return; }
  pendingChal = null;
  if (rally && rally.playing) { rally.playing = false; saveRally(); }
  const st = C.stageDef(c.k);
  if (st.daily) { settings.stage = 'daily'; settings.dailyKey = c.k; }
  else { settings.stage = C.STAGES.findIndex(b => b.id === st.id); settings.rev = st.rev; settings.cond = st.cond; }
  settings.car = Math.max(0, C.CARS.findIndex(x => x.id === c.c)); saveSettings();
  $('tabStage').click(); renderCarList(); renderStageList();
  loadStage(c.k, () => startRace());
}
let shareLink = '';
async function openShare() {
  if (!lastRun) return;
  $('shareTitle').textContent = 'Challenge a friend';
  $('shareText').textContent = `Whoever opens this link races your ghost on ${C.stageTitle(C.stageDef(lastRun.key))} in the ${carById(lastRun.car).name}: ${fmt(lastRun.t)} to beat.`;
  $('shareLink').value = 'Packing your run…'; $('share').hidden = false;
  $('shareNative').hidden = !navigator.share;
  try { shareLink = await makeChallengeLink(lastRun); $('shareLink').value = shareLink; }
  catch (e) { $('shareLink').value = 'Could not build the link: ' + e.message; shareLink = ''; }
}
$('rShare').addEventListener('click', openShare);
$('shareClose').addEventListener('click', () => { $('share').hidden = true; });
$('shareCopy').addEventListener('click', async () => {
  if (!shareLink) return;
  try { await navigator.clipboard.writeText(shareLink); toast('Link copied. Send it to a friend.'); }
  catch (e) { const i = $('shareLink'); i.focus(); i.select(); try { document.execCommand('copy'); toast('Link copied. Send it to a friend.'); } catch (e2) { toast('Select the link and copy it.'); } }
});
$('shareNative').addEventListener('click', async () => {
  if (!shareLink || !navigator.share) return;
  const text = shareLink.includes('#r=') ? `Race me live in Sideways Rally: room ${net.code}` : shareLink.includes('#b=') ? `My Sideways Rally times` : `Beat my ${fmt(lastRun.t)} on ${C.stageTitle(C.stageDef(lastRun.key))}`;
  try { await navigator.share({ title: 'Sideways Rally', text, url: shareLink }); } catch (e) { /* cancelled */ }
});
let toastT = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.hidden = false; t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }

// ---------- rally ----------
// A rally is a run of stages with the same car, one go at each, against a field of drivers whose stage times come
// from the AI rival's time on that stage (same car as yours) scaled by how good each driver is, with a little luck
// either way and the odd puncture. Progress is saved, so a rally can be finished another day.
const RALLIES = [
  { id: 'classic', name: 'Sideways Rally', blurb: 'The four stages as built', legs: ['pine', 'frost', 'mesa', 'forest'] },
  { id: 'reverse', name: 'Reverse Rally', blurb: 'All four, driven the other way', legs: ['forest-r', 'mesa-r', 'frost-r', 'pine-r'] },
  { id: 'night', name: 'Night & Rain', blurb: 'Headlights, wet gravel and a blizzard', legs: ['pine-rain', 'forest-night', 'mesa-night', 'frost-rain'] },
  { id: 'grand', name: 'Grand Rally', blurb: 'Eight stages, both ways, every condition', legs: ['pine', 'forest-r', 'frost-night', 'mesa', 'pine-r-rain', 'forest-night', 'mesa-r-rain', 'frost'] },
];
const FIELD = [['Tommi Mäkinon', 0.994], ['Colin McRay', 0.999], ['Carlos Sanz', 1.006], ['Juha Kankunnen', 1.013], ['Didier Oriol', 1.022], ['Marcus Grönhol', 1.032], ['Petter Solbergg', 1.046], ['Ari Vatanon', 1.064]];
if (!RALLIES.some(r => r.id === settings.rallyId)) settings.rallyId = RALLIES[0].id;
if (rally && (!RALLIES.some(r => r.id === rally.id) || !carById(rally.car))) rally = null;
if (rally) rally.playing = false;
function saveRally() { store.set('rally', rally); }
function newRally(it) {
  rally = { id: it.id, legs: it.legs.slice(), idx: 0, car: C.CARS[settings.car].id, seed: (Math.random() * 1e9) | 0, my: [], pen: [], tries: [], field: FIELD.map(([name, skill]) => ({ name, skill, times: [] })), done: false, playing: true };
  saveRally();
}
function startOrContinueRally() {
  if (inRoom()) { toast('Leave the room to run a rally.'); return; }
  if (apart(C.CARS[settings.car])) { const was = C.CARS[settings.car]; settings.car = plainCar(); saveSettings(); toast(`Rallies are run in the rally cars: the ${shortCar(was.id)} waits outside.`); }
  if (!rally || rally.done) newRally(RALLIES.find(r => r.id === settings.rallyId) || RALLIES[0]);
  rally.playing = true; saveRally();
  settings.car = C.CARS.findIndex(c => c.id === rally.car); saveSettings(); renderCarList();
  const key = rally.legs[rally.idx];
  if (key !== loadedKey) loadStage(key, () => startRace());
  else { if (P.id !== rally.car) setupCar(); startRace(); }
}
function rallyStandings(upto) {
  const rows = [{ name: driverName() === 'A friend' ? 'You' : driverName(), you: true, stage: rally.my[upto] + (rally.pen[upto] || 0), total: 0 }];
  for (let k = 0; k <= upto; k++) rows[0].total += rally.my[k] + (rally.pen[k] || 0);
  for (const f of rally.field) { let tot = 0; for (let k = 0; k <= upto; k++) tot += f.times[k]; rows.push({ name: f.name, stage: f.times[upto], total: tot }); }
  const byStage = rows.slice().sort((a, b) => a.stage - b.stage);
  rows.forEach(r => { r.spos = byStage.indexOf(r) + 1; });
  rows.sort((a, b) => a.total - b.total);
  return rows;
}
function rallyFinishLeg(t) {
  const k = rally.idx, rt = rival.time;
  rally.my[k] = t;
  rally.field.forEach((f, j) => {
    const Rn = C.rng(rally.seed + k * 131 + j * 7919);
    const luck = (Rn() + Rn() + Rn() - 1.5) * 0.011;
    let ft = rt * f.skill * (1 + luck);
    if (Rn() < 0.06) ft += 8 + Rn() * 24; // a puncture, a spin, a ditch
    f.times[k] = ft;
  });
  rally.idx++;
  if (rally.idx >= rally.legs.length) { rally.done = true; rally.playing = false; }
  const rows = rallyStandings(k), me = rows.find(r => r.you);
  if (rally.done) {
    const best = store.get('rallyBest.' + rally.id, null);
    if (!best || rows.indexOf(me) + 1 < best.pos || (rows.indexOf(me) + 1 === best.pos && me.total < best.total)) store.set('rallyBest.' + rally.id, { pos: rows.indexOf(me) + 1, total: me.total, car: rally.car });
  }
  saveRally();
  return { k, pos: me.spos, overall: rows.indexOf(me) + 1 };
}
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
function buildRallyTable() {
  const k = rallyLeg.k, rows = rallyStandings(k), lead = rows[0].total;
  const pen = rally.pen[k] || 0;
  $('rRallyHead').textContent = rally.done
    ? (rallyLeg.overall === 1 ? `Rally won! ${(rows[1].total - rows[0].total).toFixed(1)} s ahead of ${rows[1].name}` : `Rally finished ${ord(rallyLeg.overall)}`)
    : `Stage ${ord(rallyLeg.pos)} · Overall ${ord(rallyLeg.overall)}` + (pen ? ` · includes ${pen} s restart penalty` : '');
  const tb = $('rRallyTable'); tb.innerHTML = '';
  const head = el('tr'); ['', 'Driver', 'Stage', 'Total', 'Gap'].forEach(h => head.append(el('th', null, h))); tb.append(head);
  rows.forEach((r, i) => {
    const tr = el('tr', r.you ? 'you' : '');
    tr.append(el('td', null, String(i + 1)), el('td', null, r.name), el('td', null, fmt(r.stage) + (r.spos === 1 ? ' ★' : '')), el('td', null, fmt(r.total)), el('td', null, i ? '+' + (r.total - lead).toFixed(1) : '—'));
    tb.append(tr);
  });
}
function rallyNext() {
  if (!rally) { toMenu(); return; }
  if (rally.done) { rallyLeg = null; $('tabRally').click(); toMenu(); return; }
  rally.playing = true; saveRally();
  setScreen('none');
  loadStage(rally.legs[rally.idx], () => startRace());
}
function renderRallyPane() {
  const now = $('rallyNow'); now.innerHTML = '';
  const live = rally && !rally.done ? rally : null;
  if (live) {
    const it = RALLIES.find(r => r.id === live.id), card = el('div', 'rally-card');
    const t = el('div', 't');
    let line = `Next: SS${live.idx + 1} of ${live.legs.length} · ${C.stageTitle(C.stageDef(live.legs[live.idx]))}`;
    if (live.idx > 0) { const rows = rallyStandings(live.idx - 1); line += ` · Running ${ord(rows.findIndex(r => r.you) + 1)}`; }
    t.append(el('span', 'label', 'Rally in progress'), el('b', null, it.name), el('small', null, `${carById(live.car).name}`), el('small', null, line));
    const ab = el('button', 'btn', 'Abandon');
    ab.addEventListener('click', () => { if (confirm('Abandon this rally? Its times will be lost.')) { rally = null; store.del('rally'); renderRallyPane(); updateSummary(); } });
    card.append(t, ab); now.append(card);
  }
  const list = $('rallyList'); list.innerHTML = '';
  for (const it of RALLIES) {
    const b = el('button', 'row rally-row'); b.setAttribute('aria-pressed', String(live ? live.id === it.id : settings.rallyId === it.id));
    b.disabled = !!live && live.id !== it.id;
    const t = el('span', 't');
    t.append(el('b', null, it.name), el('small', null, `${it.legs.length} stages · ${it.blurb}`));
    t.append(el('small', 'legs', it.legs.map(k => C.stageTitle(C.stageDef(k))).join(' → ')));
    const best = store.get('rallyBest.' + it.id, null);
    t.append(el('span', 'best', best ? `Best: ${ord(best.pos)} · ${fmt(best.total)} · ${shortCar(best.car)}` : 'Not run yet'));
    b.append(t);
    b.addEventListener('click', () => { if (live) return; settings.rallyId = it.id; saveSettings(); renderRallyPane(); });
    list.append(b);
  }
  updateSummary();
}

// ---------- leaderboard ----------
// Every finished run goes on a board kept in this browser: one best per driver, stage and car. Friends' times get on
// it through their challenge links and through "Share my times" links (#b=…, every best of one driver, no ghosts).
const boardAll = () => { const b = store.get('board', []); return Array.isArray(b) ? b : []; };
function boardAdd(list) {
  const b = boardAll(); let added = 0;
  for (const e of list) {
    const i = b.findIndex(x => x.n.toLowerCase() === e.n.toLowerCase() && x.k === e.k && x.c === e.c);
    if (i < 0) { b.push(e); added++; } else if (e.t < b[i].t - 1e-4) { b[i] = Object.assign({}, e, { f: b[i].f && e.f ? 1 : 0 }); added++; }
  }
  store.set('board', b.slice(-3000)); return added;
}
// the bests this browser already had before there were names belong to whoever names it first
function seedBoard(name) {
  const list = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const lk = localStorage.key(i); if (!lk || !lk.startsWith('sideways.pb.')) continue;
      const rest = lk.slice('sideways.pb.'.length), dot = rest.lastIndexOf('.'); if (dot < 0) continue;
      const k = rest.slice(0, dot), c = rest.slice(dot + 1), r = store.get('pb.' + rest, null);
      if (r && r.t > 20 && C.stageDef(k) && carById(c)) list.push({ n: name, k, c, t: r.t, s: r.splits || [], d: r.at || Date.now() });
    }
  } catch (e) { /* storage unavailable */ }
  boardAdd(list);
}
function renameOnBoard(from, to) { if (!from || from === to) return; const b = boardAll(); for (const e of b) if (!e.f && e.n === from) e.n = to; store.set('board', b); }
// ---- online board (Supabase, see online/README.md) ----
// With a project URL and its public key the board is shared: every new best goes up, and the table for a stage is
// fetched (cached 30 s) and merged with this browser's. Without them, or offline, the local board is all there is.
const ONLINE = { url: 'https://vbklwyvoehukqlplpfjw.supabase.co', key: 'sb_publishable_uFGnQh0R6rZTuaPa7cb4eA_bBMXRcpn' };
const online = { on: !!(ONLINE.url && ONLINE.key), cache: new Map(), status: 'idle', busy: new Set() };
function onlineHeaders(json) {
  const h = { apikey: ONLINE.key };
  if (/^eyJ/.test(ONLINE.key)) h.Authorization = 'Bearer ' + ONLINE.key; // legacy anon keys are JWTs; publishable keys go in apikey only
  if (json) { h['Content-Type'] = 'application/json'; h.Prefer = 'return=minimal'; }
  return h;
}
// the board groups by road (stage and direction), not by conditions: day, night and rain share a table
const mapKey = k => String(k).replace(/-(night|rain)(?=(-lap)?$)/, '');
const mapVariants = m => { if (/^daily-/.test(m)) return [m]; const lp = isLapKey(m) ? '-lap' : '', b = lp ? m.slice(0, -4) : m; return [b, b + '-night', b + '-rain'].map(x => x + lp); };
async function onlineFetch(key) {
  const c = online.cache.get(key);
  if (c && performance.now() - c.at < 30000) return c.rows;
  if (online.busy.has(key)) return c ? c.rows : null;
  online.busy.add(key);
  try {
    const r = await fetch(ONLINE.url.replace(/\/$/, '') + '/rest/v1/best_times?select=name,stage,car,time,created_at&stage=in.(' + mapVariants(key).map(encodeURIComponent).join(',') + ')&order=time.asc&limit=300', { headers: onlineHeaders(false) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = (await r.json()).filter(x => x && typeof x.name === 'string' && carById(x.car) && x.time > 20).map(x => ({ n: cleanName(x.name), k: x.stage, c: x.car, t: +x.time, d: Date.parse(x.created_at) || 0, o: 1 }));
    online.cache.set(key, { at: performance.now(), rows }); online.status = 'ok';
    return rows;
  } catch (e) {
    // remembered for the same 30 s, so a missing connection doesn't turn into a retry loop
    online.cache.set(key, { at: performance.now(), rows: c ? c.rows : [] }); online.status = 'error';
    return c ? c.rows : [];
  } finally { online.busy.delete(key); }
}
// your bests that haven't gone up yet (all of them the first time, so times set before the board existed count too).
// Each goes up with its run (the packed ghost, deflated: a few KB) when this browser still has it, so the No. 1 on a
// road can be raced as a ghost; bests that went up before ghosts existed go up once more with theirs. A server
// without the ghost column (online/supabase.sql not updated yet) answers 400: then times go up without ghosts.
let syncing = false;
async function ghostEncode(q) { const raw = b64d(q); let body = null; try { body = await zip(raw, false); } catch (e) { body = null; } return (body ? 'z' : 'r') + b64e(body || raw); }
async function ghostDecode(str) {
  try { let u8 = b64d(str.slice(1)); if (str[0] === 'z') { u8 = await zip(u8, true); if (!u8) return null; } else if (str[0] !== 'r') return null; return unpackGhost(u8).g; } catch (e) { return null; }
}
function ownGhost(e) { const r = store.get(pbKey(e.k, e.c), null); return r && r.q && Math.abs(r.t - e.t) < 0.005 ? r.q : null; }
// the stages the server's check takes (online/supabase.sql). Times on any other stage stay on this browser until the
// server is migrated: one refused row fails the whole batch, and a 400 reads as "no ghost column"
const ONLINE_STAGES = /^(pine|frost|mesa|forest|monaco|spa)(-r)?(-night|-rain)?$|^daily-\d{8}$|^(monaco|spa)(-r)?(-night|-rain)?-lap$/;
async function onlineSync() {
  if (!online.on || !settings.name || syncing) return;
  const sent = new Set(store.get('sent', [])), sentG = new Set(store.get('sentG', [])), me = settings.name.toLowerCase(), id = e => e.n.toLowerCase() + '|' + e.k + '|' + e.c + '|' + e.t.toFixed(3);
  const withG = !online.noGhost;
  const all = boardAll().filter(e => !e.f && e.n.toLowerCase() === me && ONLINE_STAGES.test(e.k) && !isLapKey(e.k) && !apart(carById(e.c)) && (!sent.has(id(e)) || (withG && !sentG.has(id(e)) && ownGhost(e))));
  const todo = all.slice(0, withG ? 25 : 200);
  if (!todo.length) { syncApart(sent, id); return; }
  syncing = true;
  let retry = false;
  try {
    const rows = [];
    for (const e of todo) {
      const row = { name: e.n, stage: e.k, car: e.c, time: +e.t.toFixed(3), splits: (e.s || []).slice(0, 4).map(x => +(+x).toFixed(3)) };
      if (withG) { const q = ownGhost(e); row.ghost = q ? await ghostEncode(q) : null; if (row.ghost && row.ghost.length > 39000) row.ghost = null; }
      rows.push(row);
    }
    const r = await fetch(ONLINE.url.replace(/\/$/, '') + '/rest/v1/times', { method: 'POST', headers: onlineHeaders(true), body: JSON.stringify(rows) });
    if (!r.ok) { if (withG && r.status === 400) { online.noGhost = true; retry = true; } throw new Error('HTTP ' + r.status); }
    for (const [i, e] of todo.entries()) { sent.add(id(e)); if (rows[i].ghost) sentG.add(id(e)); else if (withG) sentG.add(id(e)); }
    store.set('sent', [...sent].slice(-3000)); store.set('sentG', [...sentG].slice(-3000));
    for (const e of todo) { online.cache.delete(mapKey(e.k)); online.gAt.delete(mapKey(e.k)); }
    online.status = 'ok'; renderTimes();
    if (settings.leadGhost && W) onlineGhost(mapKey(W.st.key)); // your new run may be the No. 1 now
    retry = all.length > todo.length;
    if (!retry) syncApart(sent, id);
  } catch (e) { online.status = 'error'; }
  finally { syncing = false; if (retry) setTimeout(onlineSync, 1500); }
}
// The cars kept apart (the Saveiro, the F1) send their times in requests of their own, one per car, and without
// ghosts (so the No. 1 ghost query, fastest row with a ghost, never lands on one): a server whose car check doesn't
// list a car yet (online/supabase.sql not run) refuses its rows, and that must not hold back anyone else's times.
// A refused car is left alone for the session (online.noCar). Laps go the same way, apart from the stage times
// (a server whose stage check has no '-lap' keys yet refuses them), in groups of their own per apart car.
async function syncApart(sent, id) {
  if (!settings.name) return;
  const me = settings.name.toLowerCase();
  online.noCar = online.noCar || new Set();
  const grp = e => (isLapKey(e.k) ? 'lap|' : '|') + (apart(carById(e.c)) ? e.c : '');
  const all = boardAll().filter(e => !e.f && e.n.toLowerCase() === me && ONLINE_STAGES.test(e.k) && (apart(carById(e.c)) || isLapKey(e.k)) && !online.noCar.has(grp(e)) && !sent.has(id(e)));
  for (const car of new Set(all.map(grp))) {
    const todo = all.filter(e => grp(e) === car).slice(0, 50);
    try {
      const r = await fetch(ONLINE.url.replace(/\/$/, '') + '/rest/v1/times', { method: 'POST', headers: onlineHeaders(true),
        body: JSON.stringify(todo.map(e => ({ name: e.n, stage: e.k, car: e.c, time: +e.t.toFixed(3), splits: (e.s || []).slice(0, 4).map(x => +(+x).toFixed(3)) }))) });
      if (!r.ok) { online.noCar.add(car); continue; }
      for (const e of todo) { sent.add(id(e)); online.cache.delete(mapKey(e.k)); }
      store.set('sent', [...sent].slice(-3000)); renderTimes();
    } catch (e) { return; /* offline: next time */ }
  }
}
// ---- the No. 1's ghost: the fastest recorded run on this road (yours, a friend's challenge, or the online board's),
// drawn in gold with a name tag when the "No. 1 ghost" option is on ----
online.ghosts = new Map(); online.gAt = new Map();
let lead = null;
async function onlineGhost(m) {
  if (!online.on || online.noGhost) return;
  const at = online.gAt.get(m); if (at && performance.now() - at < 60000) return;
  online.gAt.set(m, performance.now());
  try {
    const r = await fetch(ONLINE.url.replace(/\/$/, '') + '/rest/v1/times?select=name,stage,car,time,ghost&stage=in.(' + mapVariants(m).map(encodeURIComponent).join(',') + ')&ghost=not.is.null&order=time.asc&limit=1', { headers: onlineHeaders(false) });
    if (!r.ok) { if (r.status === 400) online.noGhost = true; return; }
    const row = (await r.json())[0];
    if (!row || typeof row.ghost !== 'string' || !carById(row.car) || apart(carById(row.car)) || !(row.time > 20)) return;
    const g = await ghostDecode(row.ghost); if (!g) return;
    online.ghosts.set(m, { n: cleanName(row.name), t: +row.time, c: row.car, k: row.stage, g });
    if (W && mapKey(W.st.key) === m) loadLead();
  } catch (e) { /* offline: the local candidates still count */ }
}
function loadLead() {
  lead = null;
  if (!W) return;
  const m = mapKey(W.st.key), cands = [];
  for (const k of mapVariants(m)) {
    for (const c of C.CARS) if (!c.bonus && !c.only) { const r = store.get(pbKey(k, c.id), null); if (r && r.q) cands.push({ n: driverName(), t: r.t, c: c.id, k, q: r.q }); }
    const ch = store.get('chal.' + k, null); if (ch && ch.q) cands.push({ n: ch.n, t: ch.t, c: ch.c, k, q: ch.q });
  }
  const og = online.ghosts.get(m); if (og) cands.push(og);
  cands.sort((a, b) => a.t - b.t);
  for (const c of cands) {
    try {
      const g = c.g || unpackGhost(b64d(c.q)).g;
      if (Math.abs(g.length / 4 * 0.05 - c.t) > 3) continue; // a recording that doesn't match its time
      lead = { n: c.n, t: c.t, c: c.c, ghost: g, sArr: refCurve(g) }; break;
    } catch (e) { /* unreadable: try the next one */ }
  }
}
let timesStage = null, timesCar = 'all';
function renderTimes() {
  for (const box of [$('gTimes'), $('timesInline')]) {
    box.innerHTML = '';
    const b = boardAll(), key = timesStage || curBoard();
    const head = el('div', 't-head'); head.append(el('h4', null, 'Times'));
    const share = el('button', 'btn', 'Share my times'); share.addEventListener('click', shareTimes); head.append(share);
    const f = el('div', 'filters'), ss = el('select'), cs = el('select');
    ss.setAttribute('aria-label', 'Stage'); cs.setAttribute('aria-label', 'Car');
    const keys = [...new Set([key, curBoard(), mapKey(curKeyMenu()), ...b.map(e => mapKey(e.k))])].filter(k => boardDef(k));
    keys.sort((a, c) => (a === key ? -1 : c === key ? 1 : 0) || boardTitle(a).localeCompare(boardTitle(c)));
    for (const k of keys) { const o = el('option', null, boardTitle(k) + (/^daily-/.test(k) ? ' · ' + k.slice(12, 14) + '/' + k.slice(10, 12) : '')); o.value = k; o.selected = k === key; ss.append(o); }
    for (const [v, t] of [['all', 'All cars'], ...C.CARS.map(c => [c.id, shortCar(c.id)])]) { const o = el('option', null, t); o.value = v; o.selected = v === timesCar; cs.append(o); }
    ss.addEventListener('change', () => { timesStage = ss.value; renderTimes(); });
    ss.title = 'Day, night and rain runs of a stage share its table';
    cs.addEventListener('change', () => { timesCar = cs.value; renderTimes(); });
    f.append(ss, cs);
    box.append(head, f);
    // this browser's times and the online ones, one row per driver and car (the better of the two)
    const oc = online.on ? online.cache.get(key) : null, merged = new Map();
    for (const e of [...b.filter(x => mapKey(x.k) === key), ...(oc ? oc.rows : [])]) {
      const id = e.n.toLowerCase() + '|' + e.c, have = merged.get(id);
      if (!have || e.t < have.t - 1e-4) merged.set(id, e);
    }
    let rows = [...merged.values()].filter(e => timesCar === 'all' || e.c === timesCar).sort((a, c) => a.t - c.t).slice(0, 40);
    if (rival && !isBonus(P) && mapKey(loadedKey) === key && (timesCar === 'all' || timesCar === P.id)) rows = [...rows, { n: W.st.rival + ' (AI)', k: loadedKey, c: P.id, t: rival.time, ai: 1 }].sort((a, c) => a.t - c.t);
    const note = el('p', 'board-note', online.on ? (online.status === 'error' ? 'Offline: showing this browser\'s times' : oc ? 'Online leaderboard' : 'Loading the online leaderboard…') : 'Times on this browser and from friends\' links');
    box.append(note);
    if (!rows.length) { box.append(el('p', 'empty', isLapKey(key) ? 'No laps on this road yet: run endless laps to set one.' : 'No times on this stage yet. Set one, or open a friend\'s link.')); continue; }
    const tb = el('table', 'tt board'), hr = el('tr');
    ['', 'Driver', 'Car', 'Time', 'Gap'].forEach(h => hr.append(el('th', null, h))); tb.append(hr);
    // the Saveiro's times are listed where they fall, gold and without a place: they never count, so places and gaps
    // run from the best time in a real car
    const counted = rows.filter(e => !apart(carById(e.c))), lead = (counted[0] || rows[0]).t, me = driverName().toLowerCase();
    let place = 0;
    rows.forEach(e => {
      const ec = carById(e.c), bonus = apart(ec);
      const tr = el('tr', (isBonus(ec) ? 'bonus ' : '') + (e.ai ? 'ai' : e.n.toLowerCase() === me ? 'me' : ''));
      // night and rain runs share the table with a small tag, so you can see where a time came from
      const cond = e.k && /-(night|rain)(-lap)?$/.test(e.k) ? C.condName(boardDef(e.k)) : '';
      const carTd = el('td', null, shortCar(e.c)); if (cond) carTd.append(el('span', 'cond', cond)); if (bonus) carTd.append(el('span', 'cond nc', isBonus(ec) ? 'doesn\'t count' : 'own class'));
      const first = !bonus && place === 0, d = e.t - lead;
      tr.append(el('td', null, bonus ? '—' : String(++place)), el('td', null, e.n), carTd, el('td', null, fmt(e.t)), el('td', null, first ? '—' : (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2)));
      tb.append(tr);
    });
    box.append(tb);
  }
  // fetch the online table for this road and draw again when it arrives
  const key = timesStage || curBoard();
  if (online.on) {
    const c = online.cache.get(key);
    // one request at a time per stage: drawing again while it is out must not start (or wait on) another
    if ((!c || performance.now() - c.at >= 30000) && !online.busy.has(key)) onlineFetch(key).then(() => {
      if ((timesStage || curBoard()) === key) renderTimes();
      if (mapKey(curKeyMenu()) === key && mode === 'menu') { if (keepCarAllowed() && curKey() === loadedKey) setupCar(); renderCarList(); }
    });
  }
}
async function shareTimes() {
  const mine = boardAll().filter(e => !e.f && e.n.toLowerCase() === driverName().toLowerCase());
  if (!mine.length) { toast('No times to share yet: finish a stage first.'); return; }
  const raw = utf8.encode(JSON.stringify({ v: 1, n: cleanName(driverName()), e: mine.slice(0, 300).map(e => [e.k, e.c, +e.t.toFixed(3), Math.floor((e.d || Date.now()) / 1000)]) }));
  let body = null; try { body = await zip(raw, false); } catch (e) { body = null; }
  const data = body || raw, out = new Uint8Array(1 + data.length); out[0] = body ? 0x81 : 0x01; out.set(data, 1);
  shareLink = location.href.split('#')[0] + '#b=' + b64e(out);
  $('shareTitle').textContent = 'Share my times';
  $('shareText').textContent = `Whoever opens this link gets your ${mine.length} best time${mine.length > 1 ? 's' : ''} on their leaderboard.`;
  $('shareLink').value = shareLink; $('shareNative').hidden = !navigator.share; $('share').hidden = false;
}
async function readTimes(text) {
  const u8 = b64d(text);
  if (u8.length < 4 || (u8[0] & 0x7f) !== 1) throw new Error('version');
  let raw = u8.subarray(1);
  if (u8[0] & 0x80) { raw = await zip(raw, true); if (!raw) throw new Error('this browser cannot unpack it'); }
  const h = JSON.parse(utf8d.decode(raw)), n = cleanName(h.n);
  if (!Array.isArray(h.e)) throw new Error('no times');
  const list = h.e.slice(0, 300).filter(r => Array.isArray(r) && boardDef(r[0]) && carById(r[1]) && r[2] > 20 && r[2] < 1200).map(r => ({ n, k: r[0], c: r[1], t: r[2], s: [], d: (r[3] || 0) * 1000, f: 1 }));
  return { n, added: boardAdd(list), total: list.length };
}
// ---------- driver name ----------
function showWelcome(change) {
  $('wName').value = change ? settings.name || '' : '';
  $('welcome').hidden = false; setTimeout(() => $('wName').focus(), 50);
}
function confirmName() {
  const v = cleanName($('wName').value);
  const name = $('wName').value.trim() ? v : 'Driver ' + ((Math.random() * 900 + 100) | 0);
  const old = settings.name;
  settings.name = name; saveSettings();
  $('optName').value = name;
  if (!settings.boardSeeded) { seedBoard(name); settings.boardSeeded = 1; saveSettings(); } else renameOnBoard(old, name);
  $('welcome').hidden = true;
  if (keepCarAllowed() && W) setupCar();
  updateDriver(); renderTimes(); renderCarList(); onlineSync();
  if (inRoom()) netTrack();
  if (net.pending) { const pj = net.pending; net.pending = ''; $('tabOnline').click(); if (pj[0] === '+') netJoin(pj.slice(1), true); else netJoin(pj); }
}
function updateDriver() { $('driverName').textContent = settings.name || '—'; }
$('wGo').addEventListener('click', confirmName);
$('wName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmName(); } });
$('driverChip').addEventListener('click', () => showWelcome(true));

// ---------- online rooms: live races with friends ----------
// A room is a Supabase Realtime channel (net.js) named after a 4-letter code. Its creator is the host: they pick the
// stage in their Stage tab (everyone else's Stage tab follows it) and start the races. Everyone drives the same stage at
// the same moment, each in their own car (the Saveiro stays out), and the others are drawn from what they send: their
// pose 30 times a second, each sample on its own, over the direct link between the two browsers (net.js), or for a pair
// that couldn't open one, 10 times a second through the server, batched into 2-10 messages a second depending on how
// many are in the room (Supabase's free plan allows 100 messages a second for the project, and counts each receiver).
// The cars hit each other (C.carContact: each browser resolves its own car against the others as it sees them, see
// core.js); a paused, finished or just reset car is a ghost. Each driver's clock decides, and the finishing order gives
// points (10 8 6 5 4 3) that the room keeps.
// The host holds the room's state (stage, phase, race, points) and sends all of it whenever it changes and every few
// seconds; everyone keeps the latest copy, so if the host goes the next driver in (by join time) carries on with it.
// Clocks: each browser pings the host (over the direct link, four times a second until the green light and once a second
// after it) and keeps the offset from the quickest of the last 16 round trips, so the start lights go green at the same
// moment everywhere. Each driver's time is their own, from their own green light. The others are drawn on "wall race
// time" (wt: seconds since that shared green), which is also what their samples are stamped with; after the green it
// follows the offset slowly (2 ms a second at most), so two clocks that drift apart over a long race stay in step.
const NET_V = 3, ROOM_MAX = 6, PTS = [10, 8, 6, 5, 4, 3], CLOSE_MS = 60000, LOAD_MS = 12000;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PCOL = ['#ffd23a', '#5ec8ff', '#ff6b8a', '#8be36f', '#c58bff', '#ff9c48'];
const nowMs = () => performance.timeOrigin + performance.now();
const sess = {
  get(k) { try { return sessionStorage.getItem('sideways.' + k); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) sessionStorage.removeItem('sideways.' + k); else sessionStorage.setItem('sideways.' + k, v); } catch (e) { /* storage unavailable */ } },
};
// one id per tab: a reload keeps it (and the room), so you come back as the same driver with your points
const netId = sess.get('netId') || (() => { const v = Math.random().toString(36).slice(2, 10).padEnd(8, '0'); sess.set('netId', v); return v; })();
const net = { ch: null, code: '', status: 'off', peers: new Map(), bye: new Map(), room: null, off: 0, rtt: 1e9, clk: [], race: null, ld: new Map(), loadT: 0, noState: 0,
  hostGone: 0, sentRoom: 0, models: new Map(), pending: '', prog: new Map(), j: 0, pause: false, waitN: '', hudT: 0, preT: 0, tk: 0, warned: false, rx: {}, drops: 0,
  p2p: NET.p2p && !window.__noP2P, trace: null, // __noP2P: tests that want everything through the server
  sv: new Map(), boardTap: false, boardT: 0 }; // sv: each driver's round trip to the server (it comes with their samples)
const inRoom = () => !!net.ch;
const isHost = () => !!(net.room && net.room.h === netId);
const netRun = () => !!(net.race && net.race.inRun);
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
// w: can open direct links (older clients don't say, and go through the server)
const myMeta = () => ({ i: netId, n: cleanName(driverName()), c: C.CARS[settings.car].id, v: NET_V, j: net.j, w: net.p2p ? 1 : 0 });
function cleanPeer(m) {
  if (!m || typeof m.i !== 'string' || !/^[a-z0-9]{4,12}$/.test(m.i)) return null;
  const c = carById(m.c);
  return { i: m.i, n: cleanName(m.n), c: c && !c.bonus ? c.id : 'foca', v: m.v | 0, j: +m.j || 0, w: m.w === 1 ? 1 : 0 };
}
// the room in join order: it gives the colours and the next host
function peerList() { return [...net.peers.values()].sort((a, b) => a.j - b.j || (a.i < b.i ? -1 : 1)); }
function netLoaded(id) { let s = net.ld.get(id); if (!s) { s = new Set(); net.ld.set(id, s); if (net.ld.size > 6) net.ld.delete(net.ld.keys().next().value); } return s; }
const freshRoom = () => ({ v: NET_V, h: netId, seq: 0, k: curKeyMenu(), ph: 'lobby', race: null, pts: {}, last: null, n: 0 });

function netCreate() { let c = ''; for (let k = 0; k < 4; k++) c += CODE_ABC[(Math.random() * CODE_ABC.length) | 0]; netJoin(c, true); }
function netJoin(code, create) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4 || [...code].some(ch => !CODE_ABC.includes(ch))) { toast('A room code is 4 letters and numbers, like K7QX.'); return; }
  if (!online.on) { toast('Online rooms need the online server, and this copy of the game has none set up.'); return; }
  if (!settings.name) { net.pending = (create ? '+' : '') + code; showWelcome(false); return; }
  if (net.ch) { if (net.code === code) return; netLeave(true); }
  if (rally && rally.playing) { rally.playing = false; saveRally(); }
  if (isBonus(C.CARS[settings.car])) {
    settings.car = plainCar(); saveSettings(); renderCarList(); if (W && mode === 'menu') setupCar();
    toast(`Online races are run in the rally cars: you're in the ${C.CARS[settings.car].name}.`);
  }
  // your place in the room's order survives a reload
  const kept = /^([A-Z0-9]{4}):(\d+)$/.exec(sess.get('roomJ') || '');
  net.j = kept && kept[1] === code ? +kept[2] : Date.now();
  sess.set('room', code); sess.set('roomJ', code + ':' + net.j);
  Object.assign(net, { code, status: 'connecting', peers: new Map(), bye: new Map(), room: create ? freshRoom() : null, race: null, off: 0, rtt: create ? 0 : 1e9, clk: [], noState: nowMs(), hostGone: 0, prog: new Map(), warned: false });
  net.peers.set(netId, myMeta());
  net.ch = NET.room({ url: ONLINE.url, key: ONLINE.key, topic: 'sr-room-' + code, me: netId, meta: myMeta(), p2p: net.p2p, onMsg: netMsg, onPresence: netPresence,
    onStatus: s => { if (s === 'reconnecting') net.drops++; net.status = s; if (s === 'online') netHello(); renderOnline(); updateSummary(); },
    onLink: () => { if (mode === 'menu') renderOnline(); } });
  renderOnline(); updateSummary(); renderCarList();
}
function netLeave(quiet) {
  if (!net.ch) return;
  if (net.race && net.race.inRun && !net.race.fin[netId]) netRetire();
  net.ch.send('bye', { f: netId });
  net.ch.leave(); net.ch = null;
  netClearRun();
  Object.assign(net, { code: '', status: 'off', room: null, race: null, peers: new Map(), pause: false });
  sess.set('room', null);
  if (mode === 'race' || mode === 'countdown' || mode === 'done') toMenu();
  renderOnline(); updateSummary(); renderCarList();
  if (!quiet) toast('You left the room.');
}
// say who you are (presence takes a second or three to reach the others, a broadcast doesn't)
function netHello() {
  if (!net.ch) return;
  net.peers.set(netId, myMeta());
  net.ch.send('hello', { f: netId, m: myMeta() });
  if (isHost()) sendRoom(); else if (!net.room) net.noState = nowMs();
  // back after a drop: tell the host again how our race went, in case it missed it
  if (net.race && net.race.fin[netId]) net.ch.send('fin', Object.assign({ f: netId, r: net.race.id }, net.race.fin[netId]));
}
function netTrack() { if (!net.ch) return; const m = myMeta(); net.peers.set(netId, m); net.ch.track(m); net.ch.send('hello', { f: netId, m }); renderOnline(); }
function netPresence(list) {
  const t = nowMs(), seen = new Set();
  for (const m of list) {
    const p = cleanPeer(m); if (!p || p.i === netId) continue;
    if (net.bye.has(p.i) && t - net.bye.get(p.i) < 8000) continue; // said goodbye; presence hasn't caught up yet
    seen.add(p.i); net.peers.set(p.i, Object.assign(net.peers.get(p.i) || {}, p, { pres: t }));
  }
  for (const [id, p] of net.peers) if (id !== netId && !seen.has(id) && t - (p.hi || 0) > 6000) net.peers.delete(id);
  netPeersChanged();
}
function netPeersChanged() {
  const order = peerList(), at = order.findIndex(p => p.i === netId);
  if (at >= ROOM_MAX && !(net.race && net.race.grid.some(g => g.i === netId))) { const c = net.code; netLeave(true); toast(`Room ${c} is full: ${ROOM_MAX} drivers is the most.`); return; }
  // a direct link with everyone in the room who can open one (net.js does the handshake), none with those who left
  if (net.p2p) {
    for (const [id, p] of net.peers) if (id !== netId && p.w) net.ch.link(id);
    for (const id of net.ch.links()) if (!net.peers.has(id)) net.ch.unlink(id);
  }
  renderOnline(); updateSummary();
}
// someone in the room has no direct link with us: they only hear us through the server
function netWsNeeded() { for (const id of net.peers.keys()) if (id !== netId && !net.ch.linked(id)) return true; return false; }
// via: the sender's id when it came over the direct link ('' through the server); a ping is answered the same way
function netMsg(ev, p, via) {
  net.rx[ev] = (net.rx[ev] || 0) + 1;
  if (!p || typeof p.f !== 'string' || p.f === netId) return;
  const t = nowMs();
  if (ev === 'hello') {
    const pe = cleanPeer(p.m); if (!pe || pe.i !== p.f) return;
    net.bye.delete(pe.i);
    net.peers.set(pe.i, Object.assign(net.peers.get(pe.i) || {}, pe, { hi: t }));
    netPeersChanged();
    if (isHost()) sendRoom();
    // the host is back after a reload with nothing: the first of the others hands the room back
    else if (net.room && net.room.h === pe.i) { const next = peerList().find(x => x.i !== pe.i); if (next && next.i === netId) net.ch.send('room', Object.assign({}, net.room, { f: netId })); }
  } else if (ev === 'bye') { net.peers.delete(p.f); net.bye.set(p.f, t); netPeersChanged(); }
  else if (ev === 'room') netRoomMsg(p);
  else if (ev === 'ping') {
    if (!isHost()) return;
    const o = { f: netId, to: p.f, c: p.c, h: nowMs() };
    if (!(via && net.ch.direct(via, 'pong', o))) net.ch.send('pong', o);
  } else if (ev === 'pong') {
    if (p.to !== netId || !net.room || p.f !== net.room.h || !isFinite(p.c) || !isFinite(p.h)) return;
    const rtt = t - p.c;
    if (rtt > 0 && rtt < 4000) netClock(rtt, p.h + rtt / 2 - t);
  }
  else if (ev === 'ld') { if (typeof p.r === 'string') { netLoaded(p.r).add(p.f); renderOnline(); } }
  else if (ev === 'st') netState(p);
  else if (ev === 'hit') netHitMsg(p);
  else if (ev === 'fin') netFin(p.f, p);
}
function netRoomMsg(p) {
  if (p.v !== NET_V) {
    if ((p.v | 0) > NET_V && !net.warned) { net.warned = true; toast('Your friends have a newer version of the game: reload the page to race with them.'); }
    return;
  }
  // only the host speaks for the room (or someone handing it back to a host who reloaded)
  if (p.f !== p.h && !(p.h === netId && !net.room)) return;
  if (!validRoom(p)) return;
  const cur = net.room;
  if (cur && cur.h === p.h && p.h !== netId && (p.seq | 0) < cur.seq) return; // an older copy
  if (isHost() && p.h !== netId) {
    // two hosts (a code picked twice, or a takeover crossing the old host's return): whoever joined first keeps it
    const them = net.peers.get(p.h);
    if (!(them && (them.j < net.j || (them.j === net.j && them.i < netId)))) { sendRoom(); return; }
  }
  applyRoom({ v: NET_V, h: p.h, seq: p.seq | 0, k: p.k, ph: p.ph, race: p.race || null, pts: p.pts, last: p.last || null, n: p.n | 0 });
}
function validRoom(p) {
  if (typeof p.h !== 'string' || !C.stageDef(p.k) || !['lobby', 'load', 'race'].includes(p.ph)) return false;
  const r = p.race;
  if (r) {
    if (typeof r.id !== 'string' || !C.stageDef(r.k) || !Array.isArray(r.grid) || r.grid.length > ROOM_MAX || !r.fin || typeof r.fin !== 'object') return false;
    r.grid = r.grid.map(cleanPeer).filter(Boolean);
    for (const id in r.fin) { const f = r.fin[id]; if (!f || (f.t != null && !(f.t > 0 && f.t < 3600))) delete r.fin[id]; }
    r.at = +r.at || 0; r.close = +r.close || 0; r.done = !!r.done;
  }
  if (!p.pts || typeof p.pts !== 'object') p.pts = {};
  for (const id in p.pts) { const e = p.pts[id]; if (!e || typeof e !== 'object') { delete p.pts[id]; continue; } e.n = cleanName(e.n); e.p = e.p | 0; e.w = e.w | 0; }
  if (p.last && (!Array.isArray(p.last.rows) || !C.stageDef(p.last.k))) p.last = null;
  if (p.last) p.last.rows = p.last.rows.slice(0, ROOM_MAX).map(x => ({ i: String(x.i), n: cleanName(x.n), c: carById(x.c) ? x.c : 'foca', t: x.t > 0 && x.t < 3600 ? +x.t : null, g: x.g | 0 }));
  return true;
}
function applyRoom(r) {
  const prev = net.room;
  net.room = r; net.noState = 0;
  if (!prev || prev.h !== r.h) { if (r.h === netId) netClockHost(); else { net.rtt = 1e9; net.clk = []; netSync(5); } }
  if (r.h !== netId) netFollowStage(r.k);
  const race = r.race;
  if (race && !race.done && r.ph !== 'lobby' && race.grid.some(g => g.i === netId) && !(netId in race.fin) && (!net.race || net.race.id !== race.id)) netLoadRace(race);
  const nr = net.race;
  if (nr && race && nr.id === race.id) {
    nr.at = race.at; netGreen();
    for (const id in race.fin) netGotFin(id, race.fin[id]);
    nr.close = race.close ? race.close - net.off : 0;
    nr.done = race.done;
  }
  renderOnline(); updateSummary();
  if (nr && !$('results').hidden) renderNetResults();
}
// the host's changes: to everyone, and to itself (a broadcast doesn't come back to the sender)
function hostCommit() { sendRoom(); applyRoom(net.room); }
function sendRoom() { if (!net.ch || !isHost()) return; net.room.seq++; net.sentRoom = nowMs(); net.ch.send('room', Object.assign({}, net.room, { f: netId })); }
function netSync(n) {
  for (let k = 0; k < n; k++) setTimeout(() => { if (net.ch && net.room && !isHost()) netPing(); }, 60 + k * 170);
}
function netPing() { const o = { f: netId, c: nowMs() }; if (!net.ch.direct(net.room.h, 'ping', o)) net.ch.send('ping', o); }
// the host's clock: the offset from the quickest of the last 16 round trips (a slow one was held up somewhere, and
// the longer it took the less is known about when the host read its clock)
function netClock(rtt, off) {
  const w = net.clk; w.push([rtt, off]); if (w.length > 16) w.shift();
  let b = w[0]; for (const x of w) if (x[0] < b[0]) b = x;
  net.rtt = b[0]; net.off = b[1]; netGreen();
}
function netClockHost() { net.off = 0; net.rtt = 0; net.clk = []; }
// local time of the green light; it settles while the clock offset improves and stays put from the start
function netGreen() { const r = net.race; if (r && r.at && !r.green) r.greenL = r.wt0 = r.at - net.off; }
// a guest's Stage tab shows the room's stage (and builds it in the background once the host stops clicking around)
function netFollowStage(k) {
  if (curKeyMenu() === k) return;
  const st = C.stageDef(k); if (!st) return;
  if (st.daily) { settings.stage = 'daily'; settings.dailyKey = k; }
  else { const i = C.STAGES.findIndex(b => b.id === st.id); if (i < 0) return; settings.stage = i; settings.rev = st.rev; settings.cond = st.cond; }
  saveSettings(); timesStage = null; renderStageList(); renderTimes();
  if (keepCarAllowed() && W && mode === 'menu' && curKey() === loadedKey) setupCar();
  renderCarList();
  clearTimeout(net.preT);
  net.preT = setTimeout(() => { if (inRoom() && mode === 'menu' && curKeyMenu() === k && loadedKey !== k && !(net.room && net.room.ph !== 'lobby')) loadStage(k); }, 1500);
}
function netStageSync() { if (isHost() && net.room.ph === 'lobby' && net.room.k !== curKeyMenu()) { net.room.k = curKeyMenu(); hostCommit(); } }
// the host's start button: everyone in the room lines up
function netStart() {
  const room = net.room;
  if (!room || !isHost() || net.status !== 'online' || room.ph !== 'lobby' || mode !== 'menu') return;
  const k = curKeyMenu(); if (!C.stageDef(k)) return;
  net.peers.set(netId, myMeta());
  const grid = peerList().filter(p => p.v === NET_V).slice(0, ROOM_MAX).map(p => ({ i: p.i, n: p.n, c: fitsRoad(carById(p.c), k) ? p.c : 'foca' }));
  room.k = k; room.ph = 'load'; room.race = { id: Math.random().toString(36).slice(2, 9), k, grid, fin: {}, at: 0, close: 0, done: false };
  net.loadT = nowMs();
  hostCommit();
}
function netTakeOver() {
  const room = net.room;
  if (room.race) { if (room.race.at) room.race.at = Math.round(room.race.at - net.off); if (room.race.close) room.race.close = Math.round(room.race.close - net.off); }
  room.h = netId; netClockHost(); net.hostGone = 0; net.loadT = nowMs();
  hostCommit(); toast('The host has gone: you run the room now.');
}
// runs four times a second while in a room: the host moves the race along, everyone watches for a missing host
function netTick() {
  if (!net.ch) return;
  net.tk++;
  const nr = net.race;
  if (nr && nr.inRun && net.room && !isHost()) {
    // over a direct link pings cost nothing: four a second until the green light, then one a second for the drift
    if (net.ch.linked(net.room.h) && (!nr.green || net.tk % 4 === 0)) netPing();
    // after the green, wall race time follows the offset at 2 ms a second at most (a sample never goes back in time)
    if (nr.green && nr.at) nr.wt0 += clamp(nr.at - net.off - nr.wt0, -0.5, 0.5);
  }
  if (netRun() && !$('results').hidden && net.tk % 2 === 0) renderNetResults();
  { const on = net.room && net.room.race && !net.room.race.done; if (mode === 'menu' && net.room && !$('paneOnline').hidden && (on ? net.tk % 4 === 0 : net.tk % 8 === 0 && net.ch.anyLinked())) renderOnline(); }
  if (net.status !== 'online') return;
  const t = nowMs(), room = net.room;
  if (!room) {
    // nobody speaks for this room (a link to a room whose host has gone): the first driver in starts it afresh
    if (net.noState && t - net.noState > 3000 && peerList()[0].i === netId) { net.room = freshRoom(); netClockHost(); hostCommit(); }
    return;
  }
  if (room.h !== netId) {
    if (net.peers.has(room.h)) { net.hostGone = 0; return; }
    if (!net.hostGone) net.hostGone = t;
    if (t - net.hostGone > 3000 && peerList()[0].i === netId) netTakeOver();
    return;
  }
  const r = room.race;
  if (room.ph === 'load' && r) {
    const ld = netLoaded(r.id);
    // everyone on the line (or the slow ones get left to catch up): lights in 1.5 s, green 3.6 s after that
    if (r.grid.every(g => ld.has(g.i) || !net.peers.has(g.i)) || t - net.loadT > LOAD_MS) { r.at = Math.round(t + 1500 + 3600); room.ph = 'race'; hostCommit(); }
  } else if (room.ph === 'race') netCheckClose();
  if (t - net.sentRoom > (room.ph === 'lobby' ? 10000 : 4000)) sendRoom();
}
function netCheckClose() {
  const room = net.room, r = room && room.race;
  if (!isHost() || !r || r.done || room.ph !== 'race') return;
  if (r.grid.every(g => g.i in r.fin || !net.peers.has(g.i)) || (r.close && nowMs() > r.close)) netFinalize();
}
function netFinalize() {
  const room = net.room, r = room.race;
  r.done = true; room.ph = 'lobby'; room.n = (room.n | 0) + 1;
  const fin = r.grid.filter(g => r.fin[g.i] && r.fin[g.i].t != null).sort((a, b) => r.fin[a.i].t - r.fin[b.i].t), rows = [];
  fin.forEach((g, k) => {
    const e = room.pts[g.i] || (room.pts[g.i] = { n: g.n, p: 0, w: 0 });
    e.n = g.n; e.p += PTS[k] || 0; if (!k) e.w++;
    rows.push({ i: g.i, n: g.n, c: r.fin[g.i].c || g.c, t: r.fin[g.i].t, g: PTS[k] || 0 });
  });
  for (const g of r.grid) if (!fin.includes(g)) { if (!room.pts[g.i]) room.pts[g.i] = { n: g.n, p: 0, w: 0 }; rows.push({ i: g.i, n: g.n, c: g.c, t: null, g: 0 }); }
  room.last = { id: r.id, k: r.k, rows };
  hostCommit();
}

// ---- racing: line up, send your pose, draw the others ----
function netLoadRace(race) {
  if (mode === 'loading') {
    setTimeout(() => { const rr = net.room && net.room.race; if (rr && rr.id === race.id && !rr.done && (!net.race || net.race.id !== rr.id)) netLoadRace(rr); }, 300);
    return;
  }
  if (rally && rally.playing) { rally.playing = false; saveRally(); }
  { const c = C.CARS[settings.car]; if (isBonus(c) || !fitsRoad(c, race.k)) { settings.car = plainCar(); saveSettings(); renderCarList(); } }
  netClearRun();
  const nr = net.race = { id: race.id, k: race.k, at: race.at || 0, greenL: 0, wt0: 0, green: false, grid: race.grid.map(g => Object.assign({}, g)), others: new Map(), fin: Object.assign({}, race.fin),
    hist: [], buf: [], lastS: -1e9, lastB: -1e9, cred: 0, cut: false, cutB: false, inRun: true, done: false, close: 0, col: PCOL[0] };
  nr.grid.forEach((g, k) => {
    g.col = PCOL[k % PCOL.length];
    if (g.i === netId) nr.col = g.col;
    else nr.others.set(g.i, { i: g.i, n: g.n, c: g.c, col: g.col, hist: [], cur: 0, err: [0, 0, 0, 0], spin: 0, pose: {}, mat: M4.create(), model: null, vis: false, alpha: 1, dc: 1e9, s: null, tag: null, bar: null,
      kick: null, thru: false, was: false, soft: false, ep: -1e9, mute: -1e9 });
  });
  if (!isHost()) { net.rtt = 1e9; net.clk = []; netSync(5); }
  $('share').hidden = true; $('welcome').hidden = true;
  setScreen('none');
  const go = () => {
    if (net.race !== nr) return;
    netModels(); startRace(); netGrid();
    if (net.ch) net.ch.send('ld', { f: netId, r: nr.id });
    netLoaded(nr.id).add(netId);
  };
  if (race.k !== loadedKey) { loadStage(race.k, go); return; }
  showLoading('Lining up');
  setTimeout(() => { if (P.id !== C.CARS[settings.car].id) setupCar(); hideLoading(); go(); }, 40);
}
function netModels() {
  const nr = net.race; if (!nr || !S) return;
  for (const o of nr.others.values()) {
    const key = o.c + (S.E.night ? ':n' : '');
    if (!net.models.has(key)) net.models.set(key, WORLD.buildCar(R, carById(o.c), !!S.E.night));
    o.model = net.models.get(key);
  }
}
// side by side on the start line, up to three abreast (the fourth and on share a lane: everyone is a ghost until the
// green, and cars that overlap then pass through each other until they're apart)
function netGrid() {
  const nr = net.race, n = nr.grid.length, k = Math.max(0, nr.grid.findIndex(g => g.i === netId)), lanes = Math.min(n, 3);
  if (lanes < 2) return;
  const lat = ((k % lanes) - (lanes - 1) / 2) * Math.min(2.4, (2 * W.T.hw - 2.4) / (lanes - 1));
  car.x += car.rd.rx * lat; car.z += car.rd.rz * lat;
  C.locate(W.T, car); car.y = C.groundAt(W, car, car.x, car.z); car.gyPrev = car.y; car.ghostT = 0;
  snapVis();
}
function netClearRun() {
  $('netTags').textContent = ''; $('hNet').hidden = true;
  for (const e of $('hProgBar').querySelectorAll('em.np')) e.remove();
  if (net.race) for (const o of net.race.others.values()) { o.tag = null; o.bar = null; }
  net.pause = false;
}
function netRetire() {
  const nr = net.race; if (!nr || nr.fin[netId]) return;
  nr.fin[netId] = { t: null };
  if (net.ch) net.ch.send('fin', { f: netId, r: nr.id, t: null });
  if (isHost()) netFin(netId, { r: nr.id, t: null });
}
function netFinished() {
  const nr = net.race, f = { t: r3(finishT), c: P.id, s: splitsHit.map(r3) };
  nr.fin[netId] = f;
  if (net.ch) net.ch.send('fin', Object.assign({ f: netId, r: nr.id }, f));
  if (isHost()) netFin(netId, Object.assign({ r: nr.id }, f));
}
// a result for this race, from the driver or from the host's copy (whichever comes first): friends' times go on
// your board, like a challenge link's
function netGotFin(id, f) {
  const nr = net.race; if (!nr || id in nr.fin) return;
  nr.fin[id] = f;
  const g = nr.grid.find(x => x.i === id);
  if (id !== netId && f.t != null && g && Array.isArray(f.s) && f.s.length === 2 && f.s.every(x => x > 0 && x < f.t)) { boardAdd([{ n: g.n, k: nr.k, c: f.c, t: f.t, s: f.s, d: Date.now(), f: 1 }]); renderTimes(); }
}
function netFin(id, p) {
  if (p.t != null && !(p.t > 0 && p.t < 3600)) return;
  const f = p.t == null ? { t: null } : { t: +p.t, c: carById(p.c) ? p.c : 'foca', s: Array.isArray(p.s) ? p.s.slice(0, 2).map(Number) : [] };
  if (net.race && p.r === net.race.id) netGotFin(id, f);
  const rr = net.room && net.room.race;
  if (isHost() && rr && p.r === rr.id && !rr.done && !(id in rr.fin)) {
    rr.fin[id] = f;
    if (f.t != null && !rr.close) rr.close = Math.round(nowMs() + CLOSE_MS);
    hostCommit(); netCheckClose();
  }
  renderOnline(); if (netRun() && !$('results').hidden) renderNetResults();
}
// Supabase counts a broadcast once sent and once per receiver: n drivers sending f a second cost n·n·f
function netRate() { const n = Math.max(1, net.race.grid.filter(g => g.i === netId || net.peers.has(g.i)).length); return clamp(70 / (n * n), 2, 10); }
const netWT = () => (nowMs() - net.race.wt0) / 1000;
const NET_DT = 1 / 30; // a sample this often over direct links (0.1 s through the server)
// a sample every 1/30 s (0.1 s through the server): [wt, x, y, z, heading, vx, vz, s, pitch, roll, front wheel angle, flags,
// rpm / 10]. The pose is the drawn one, which is a physics step behind the physics (it's interpolated between the last two
// steps), so it's stamped a step earlier: the time it really shows. The others are drawn a step back too, like your car
// flags: 1 brake, 2 lights, bits 2-4 throttle (0-7), bits 5-7 boost (0-7), 256 a gear change since the last sample (not
// the limiter: at ten samples a second it would cut their engine for whole tenths), 512 a ghost (touches nothing). The
// engine fields are for the others' engine sound
function netSample() {
  const nr = net.race; if (!nr.greenL || !net.ch) return;
  const wt = netWT();
  if (mode === 'done' && doneT > 6) { if (nr.buf.length) netSend(); return; } // parked after the finish: nothing more to say
  if (car.shiftT > 0) nr.cut = true;
  const fast = net.ch.anyLinked(), dt = wt - nr.lastS;
  if ((mode !== 'countdown' && mode !== 'race' && mode !== 'done') || wt < -4 || dt < (fast ? NET_DT : 0.1) - 0.004) return;
  nr.lastS = wt;
  const brk = (mode === 'race' && (input.brk > 0.1 || input.hb || net.pause)) || mode === 'done';
  const thr = mode === 'done' ? 0 : car.thrE || input.thr, q = v => Math.round(clamp(v, 0, 1) * 7);
  const s = [r3(wt - STEP), r2(vis.x), r2(vis.y + susp.heave + 0.02), r2(vis.z), r3(vis.h), r1(car.vx), r1(car.vz), r1(car.s), r3(susp.pitch), r3(susp.roll), r2(vis.steer),
    (brk ? 1 : 0) | (lightsOn ? 2 : 0) | q(thr) << 2 | q(car.boost) << 5 | (nr.cut ? 256 : 0) | (netGhost() ? 512 : 0), Math.round(car.rpm / 10)];
  nr.cut = false;
  nr.hist.push([wt, car.s]);
  // straight away to everyone with a direct link
  if (fast) net.ch.fast('st', { f: netId, r: nr.id, p: [s] });
  if (!netWsNeeded()) { nr.buf.length = 0; nr.cred = 0; return; }
  // through the server, for the rest: a sample every 0.1 s in the batch, and a batch whenever the rate has earned one
  // (1 Hz on the grid, but the last second before the green goes at the race rate so the launch is heard on time).
  // The newest sample always goes in, so a batch is never staler than the moment it leaves
  nr.cred = Math.min(1, nr.cred + Math.min(dt, 0.5) * (mode === 'countdown' && wt < -1.2 ? 1 : netRate()));
  const go = nr.cred >= 0.95;
  if (go || wt - nr.lastB >= 0.096) { if (nr.cutB) s[11] |= 256; nr.cutB = false; nr.buf.push(s); nr.lastB = wt; }
  else if (s[11] & 256) nr.cutB = true; // a gear change in a sample left out: the next one carries it
  if (go) { nr.cred -= 1; netSend(); }
}
// sv: your round trip to the server, for the others' room table (a pair that talks through the server is both trips apart)
function netSend() { const nr = net.race; net.ch.send('st', { f: netId, r: nr.id, p: nr.buf, sv: Math.round(net.ch.srv) || undefined }); nr.buf = []; }
// ---- the cars hit each other ----
// a ghost touches nothing: on the grid, paused, finished, retired and for a moment after a reset (R)
function netGhost() { const nr = net.race; return !nr || mode !== 'race' || net.pause || !!nr.fin[netId] || car.ghostT > 0; }
// one physics step of your car against the others as this browser sees them (at wall race time wt)
const netQ = {};
function netCollide(wt) {
  const nr = net.race; if (!nr || !nr.greenL) return;
  car.ghost = netGhost();
  if (car.ghostT > 0) car.ghostT -= STEP;
  for (const o of nr.others.values()) {
    if (o.out || !o.hist.length) continue;
    const q = netPose(o, wt, netQ); q.ghost = !!(q.fl & 512);
    const r = C.carContact(car, P, q, carById(o.c), o, wt);
    if (!r) continue;
    // the first touch of a contact goes to the other driver too, in case their view of it just missed
    // (over the direct link when there is one)
    if (r.first && r.jn > 0 && net.ch) { const m = { f: netId, to: o.i, r: nr.id, t: r3(wt), j: [r1(-r.Jx), r1(-r.Jz)], b: [r2(r.bf), r2(r.br)], dv: r.own.map(r3), h: r3(r.h) }; if (!net.ch.direct(o.i, 'hit', m)) net.ch.send('hit', m); }
    netContactFx(o, r.first ? -r.vn : 0, Math.abs(r.vt), r.px, r.pz, r.nx, r.nz, r.front);
  }
}
// the other driver saw a contact: apply it here if this browser hasn't already (or is about to) on its own
function netHitMsg(p) {
  const nr = net.race; if (!nr || p.r !== nr.id || p.to !== netId || mode !== 'race') return;
  const o = nr.others.get(p.f); if (!o || o.out || !o.hist.length) return;
  const num = (a, n) => Array.isArray(a) && a.length === n && a.every(v => typeof v === 'number' && isFinite(v));
  if (!num(p.j, 2) || !num(p.b, 2) || !num(p.dv, 3) || !isFinite(p.t) || !isFinite(p.h) || Math.abs(p.b[0]) > 4 || Math.abs(p.b[1]) > 2) return;
  const wt = netWT(); if (Math.abs(wt - p.t) > 1) return;
  car.ghost = netGhost();
  const q = netPose(o, wt, netQ);
  if (!C.carHitMsg(car, P, o, { t: p.t, j: p.j, b: p.b, dv: p.dv, h: p.h }, wt, q)) return;
  const fx = Math.sin(car.h), fz = Math.cos(car.h), px = car.x + fx * p.b[0] - fz * p.b[1], pz = car.z + fz * p.b[0] + fx * p.b[1], jl = Math.hypot(p.j[0], p.j[1]) || 1;
  carFx.msg = [o, jl / P.mass * 1.6, 0, px, pz, p.j[0] / jl, p.j[1] / jl, p.b[0] > 0]; // shown with the next frame
}
// what a contact looks, sounds and feels like: a hit (v, closing speed) goes through onImpact like a tree or a wall,
// a light touch only thumps; panels sliding along each other (vs) throw sparks and scrape
const carFx = { scr: 0, x: 0, z: 0, nx: 0, nz: 0, lvl: 0, msg: null };
function netContactFx(o, v, vs, px, pz, nx, nz, front) {
  if (v > evt.hit) { evt.hit = v; evt.kind = 'car'; evt.x = px; evt.z = pz; evt.nx = nx; evt.nz = nz; evt.front = front; evt.col = carById(o.c).col; }
  if (vs > carFx.scr) Object.assign(carFx, { scr: vs, x: px, z: pz, nx, nz });
}
function netContactFrame(dt) {
  if (carFx.msg) { netContactFx(...carFx.msg); carFx.msg = null; }
  if (evt.kind === 'car' && evt.hit > 0.8 && evt.hit <= 3) {
    // a nudge: the body rocks, a dull knock, a short buzz
    const v = evt.hit;
    susp.rv += (Math.random() < 0.5 ? -1 : 1) * v * 0.05; susp.pv += (evt.front ? 1 : -1) * v * 0.04;
    cam.shake = Math.max(cam.shake, 0.03 + v * 0.015); rumble(v / 8, v / 5, 90);
    sfx.thump(v * 0.6);
  }
  // scraping: sparks off the contact, more the faster the panels slide
  if (carFx.scr > 1.5 && mode === 'race') {
    const n = Math.min(6, Math.floor(carFx.scr * dt * 40 + Math.random()));
    for (let i = 0; i < n; i++) chips.emit(carFx.x + rnd() * 0.5, vis.gy + 0.25 + Math.random() * 0.4, carFx.z + rnd() * 0.5, car.vx * 0.7 + carFx.nx * 1.5 + rnd() * 3, 0.6 + Math.random() * 2, car.vz * 0.7 + carFx.nz * 1.5 + rnd() * 3, 0.04, 0, 0.25 + Math.random() * 0.2, [3.0, 1.6, 0.5], 1, -9.8, 0.6);
    if (Math.random() < dt * 8) rumble(0, 0.25, 70);
  }
  carFx.lvl = clamp((carFx.scr - 1) / 8, 0, 1);
  carFx.scr = 0;
}
function netState(p) {
  if (!Array.isArray(p.p) || !p.p.length) return;
  const last = p.p[p.p.length - 1];
  if (Array.isArray(last) && isFinite(last[7])) net.prog.set(p.f, { r: p.r, s: +last[7] });
  if (typeof p.sv === 'number' && p.sv > 0 && p.sv < 5000) net.sv.set(p.f, p.sv);
  const nr = net.race; if (!nr || p.r !== nr.id) return;
  const o = nr.others.get(p.f); if (!o) return;
  const list = [];
  for (const s of p.p.slice(0, 60)) {
    if (!Array.isArray(s) || s.length < 12) continue;
    let ok = true; for (let k = 0; k < 12; k++) if (typeof s[k] !== 'number' || !isFinite(s[k])) { ok = false; break; }
    if (!ok) continue;
    s[12] = typeof s[12] === 'number' && isFinite(s[12]) ? clamp(s[12] * 10, 0, 12000) : -1; // rpm (-1: an older client, estimated from speed)
    s.length = 13;
    list.push(s);
  }
  // new samples move the estimate: it keeps being drawn where it was and o.err eases the difference away
  C.trackTake(o, list, nr.greenL ? netWT() - STEP : 0);
}
// where a driver is at wall race time wt (core.js: their samples, carried on past the newest one, plus a contact's kick)
const netPose = C.seenPose;
function netUpdate(dt) {
  const nr = net.race; if (!nr || !nr.inRun || !nr.greenL || !W) return;
  const wt = netWT();
  // test hook (netlag.py): per frame, the wall clock, your car and where each of the others is drawn
  const tr = net.trace && [nowMs(), vis.x, vis.z, []];
  if (tr) net.trace.push(tr);
  for (const o of nr.others.values()) {
    o.vis = o.visM = false;
    if (!o.hist.length) continue;
    const p = netPose(o, wt - STEP, o.pose); // as your car: a physics step back
    // the correction eases out over ~0.2 s, quicker when it's next to your car (what you see is what you hit)
    const k = Math.exp(-dt * (5 + 15 * clamp((14 - Math.hypot(p.x - car.x, p.z - car.z)) / 8, 0, 1)));
    for (let q = 0; q < 4; q++) o.err[q] *= k;
    p.x += o.err[0]; p.y += o.err[1]; p.z += o.err[2]; p.h += o.err[3];
    o.s = p.s;
    if (tr) tr[3].push([o.n, p.x, p.z, wt - STEP - o.hist[o.hist.length - 1][0]]);
    const f = nr.fin[o.i];
    o.out = !!(f && f.t == null) || (!net.peers.has(o.i) && wt - o.hist[o.hist.length - 1][0] > 2);
    if (o.out || !o.model) continue;
    const dc = Math.hypot(p.x - cam.pos[0], p.y - cam.pos[1], p.z - cam.pos[2]), dm = Math.hypot(p.x - vis.x, p.z - vis.z);
    // see-through when it's a ghost (paused, finished, just reset) and when it's passing through your car (you were
    // overlapping while one of you was a ghost); those also fade as the camera nears them. A car you can hit stays
    // solid however close it gets, unless the camera is in its body
    const gh = mode === 'race' && ((p.fl & 512) || net.pause || car.ghostT > 0);
    const near = gh || o.thru ? clamp((dc - 3.5) / 6, 0, 1) : clamp((camGap(o, p) - 0.25) / 0.65, 0, 1);
    o.alphaM = (gh ? 0.5 : 1) * (o.thru && dm < 5.5 ? 0.35 + 0.65 * clamp((dm - 2.5) / 3, 0, 1) : 1); // in the mirror
    o.alpha = near * o.alphaM;
    o.dc = dc;
    const wr = (p.vx * Math.sin(p.h) + p.vz * Math.cos(p.h)) / 0.335, wa = Math.abs(wr);
    o.spin += Math.sign(wr) * (wa < 15 ? wa : 15 + (wa - 15) * 0.25) * dt;
    M4.trs(o.mat, p.x, p.y, p.z, p.h, p.pitch, p.roll, 1);
    o.vis = o.alpha > 0.01 && dc < 900;
    o.visM = dc < 900;
  }
}
// how far the camera is from the outside of a driver's body (its contact box up to roof height; 0 inside it)
function camGap(o, p) {
  const b = o.box || (o.box = C.carBox(carById(o.c))), ex = cam.pos[0] - p.x, ez = cam.pos[2] - p.z, sh = Math.sin(p.h), ch = Math.cos(p.h);
  const lz = ex * sh + ez * ch, lx = ex * ch - ez * sh;
  return Math.hypot(Math.max(0, Math.abs(lx) - b.w), Math.max(0, lz - b.f, b.r - lz), Math.max(0, cam.pos[1] - p.y - 1.45));
}
const netWm = M4.create(), netWt = M4.create(), netSh = M4.create(), netGc = { x: 0, z: 0, s: 0, lat: 0, rd: {} };
function netWheel(o, i, noSpin) {
  const sh = o.model.shape, x = (i % 2 ? -1 : 1) * halfTrack(sh, i), z = i < 2 ? o.model.fz : o.model.rz;
  M4.trs(netWt, x, 0.335, z, i < 2 ? o.pose.steer : 0, noSpin ? 0 : o.spin, 0, 1);
  return M4.mul(netWm, o.mat, netWt);
}
function netGround(o) {
  const T = W.T, p = o.pose, i = C.nearest(T, p.x, p.z, 14);
  if (i < 0) return C.terrainH(W.TR, p.x, p.z);
  C.project(T, i, p.x, p.z, netGc.rd); netGc.x = p.x; netGc.z = p.z; netGc.s = netGc.rd.s; netGc.lat = netGc.rd.lat;
  return C.groundAt(W, netGc, p.x, p.z);
}
function netDepth() {
  if (!netRun()) return;
  for (const o of net.race.others.values()) if (o.vis && o.alpha > 0.5 && Math.hypot(o.pose.x - vis.x, o.pose.z - vis.z) < 90) R.drawDepth(o.model.body, o.mat);
}
// mir: drawn in the rear-view mirror (o.alphaM: it doesn't fade as the screen's camera nears it)
function netDrawOpaque(E, mir) {
  if (!netRun()) return;
  const dcol = (DIRT[W.st.id] || DIRT[W.st.kind]).col;
  for (const o of net.race.others.values()) {
    if (!(mir ? o.visM : o.vis) || (mir ? o.alphaM : o.alpha) < 0.99) continue;
    const m = o.model, y = o.pose.y, lit = o.pose.fl & 2, brk = o.pose.fl & 1;
    R.drawLit(m.body, { model: o.mat, mode: 5, tex: m.tex, dirt: dirt * 0.8, carY: y, dirtCol: dcol });
    if (o.dc < 180) {
      for (let i = 0; i < 4; i++) R.drawLit(wheelMesh(m, i), { model: netWheel(o, i), mode: 11, tex: m.tyreTex, dirt: dirt * 0.7, carY: y, dirtCol: dcol });
      for (let i = 0; i < 4; i++) R.drawLit(m.caliper, { model: netWheel(o, i, true), dirt: dirt * 0.5, carY: y, dirtCol: dcol });
    }
    R.drawLit(m.lightF, { model: o.mat, mode: 4, tint: lit ? (E.night ? [2.6, 2.6, 2.6] : [1.9, 1.9, 1.9]) : [0.3, 0.3, 0.3] });
    const rainL = m.shape.kind === 'f1' ? (W.st.cond === 'rain' || E.night ? [2.6, 2.6, 2.6] : [0.2, 0.2, 0.2]) : null;
    R.drawLit(m.lightR, { model: o.mat, mode: 4, tint: rainL || (brk ? [3.2, 3.2, 3.2] : lit ? [0.85, 0.85, 0.85] : [0.55, 0.55, 0.55]) });
  }
}
// in the transparent pass with the polygon offset of the contact shadows already set
function netContact(E, mir) {
  if (!netRun() || !csMesh) return;
  for (const o of net.race.others.values()) {
    if (!(mir ? o.visM : o.vis) || o.dc > 120) continue;
    const gy = netGround(o), hgt = Math.max(0, o.pose.y - 0.02 - gy);
    const ca = clamp(1 - hgt / 2.2, 0, 1) * (E.night ? 0.42 : E.overcast ? 0.7 : 0.55) * (mir ? o.alphaM : o.alpha);
    if (ca <= 0.01) continue;
    M4.trs(netSh, o.pose.x, gy + 0.03, o.pose.z, o.pose.h, o.pose.pitch, o.pose.roll, 1 + Math.min(hgt, 2) * 0.12);
    R.drawLit(csMesh, { model: netSh, mode: 6, tex: csTex, alpha: ca });
  }
}
function netDrawTransparent(E, mir) {
  if (!netRun()) return;
  let lit = false;
  for (const o of net.race.others.values()) {
    if (!(mir ? o.visM : o.vis)) continue;
    if (!lit) { R.setLitFrame(E); lit = true; }
    const m = o.model, a = mir ? o.alphaM : o.alpha;
    if (a >= 0.99) { if (m.glass && o.dc < 180) R.drawLit(m.glass, { model: o.mat, alpha: 0.8 }); if (m.lens && o.dc < 120) R.drawLit(m.lens, { model: o.mat, alpha: 0.18 }); }
    else R.drawLit(m.body, { model: o.mat, alpha: a, mode: 5, tex: m.tex });
  }
}
// name tags over the others' cars (like the No. 1 ghost's)
function placeNetTags() {
  const box = $('netTags');
  if (!netRun() || !(mode === 'race' || mode === 'countdown' || mode === 'done') || $('hud').hidden) { if (box.childElementCount) { box.textContent = ''; if (net.race) for (const o of net.race.others.values()) o.tag = null; } return; }
  const vp = R.env.vp, w0 = innerWidth, h0 = innerHeight;
  for (const o of net.race.others.values()) {
    if (!o.tag) { o.tag = el('span', null, o.n); o.tag.style.background = o.col; box.append(o.tag); }
    const p = o.pose, d = o.dc;
    let show = o.vis && d > 4 && d < 260;
    if (show) {
      const y = p.y + 1.75, w = vp[3] * p.x + vp[7] * y + vp[11] * p.z + vp[15];
      const nx = (vp[0] * p.x + vp[4] * y + vp[8] * p.z + vp[12]) / w, ny = (vp[1] * p.x + vp[5] * y + vp[9] * p.z + vp[13]) / w;
      if (w <= 0.1 || Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) show = false;
      else {
        o.tag.style.transform = `translate(${((nx * 0.5 + 0.5) * w0).toFixed(1)}px, ${((0.5 - ny * 0.5) * h0).toFixed(1)}px) translate(-50%, -100%)`;
        o.tag.style.opacity = (clamp((d - 4) / 5, 0, 1) * clamp((260 - d) / 60, 0, 1) * Math.max(o.alpha, 0.5)).toFixed(2);
      }
    }
    if (o.tag.hidden === show) o.tag.hidden = !show;
  }
}
// when a driver passed distance s (wall race time), from their samples (column k holds s)
function timeAtS(H, k, s) {
  const n = H.length; if (!n || H[n - 1][k] < s) return null;
  if (H[0][k] >= s) return H[0][0];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H[m][k] < s) lo = m; else hi = m; }
  const a = H[lo], b = H[hi];
  return a[0] + (b[0] - a[0]) * clamp((s - a[k]) / Math.max(1e-3, b[k] - a[k]), 0, 1);
}
// the race order: finished by time, then the rest by how far along they are; gaps are to the leader at the same spot
function netRows() {
  const nr = net.race, T = W.T, span = T.finishS - T.startS, wt = nr.greenL ? netWT() : 0;
  const gc = id => (nr.grid.find(g => g.i === id) || { c: 'foca' }).c;
  const rows = [{ i: netId, n: driverName(), c: P.id, col: nr.col, s: car.s, v: Math.hypot(car.vx, car.vz), fin: nr.fin[netId], hist: nr.hist, hs: 1, me: true }];
  for (const o of nr.others.values()) rows.push({ i: o.i, n: o.n, c: gc(o.i), col: o.col, s: o.s == null ? T.startS : o.s, v: o.pose.vx == null ? 0 : Math.hypot(o.pose.vx, o.pose.vz), fin: nr.fin[o.i], hist: o.hist, hs: 7, gone: !net.peers.has(o.i) });
  const rank = x => (x.fin && x.fin.t != null ? 0 : x.fin || x.gone ? 2 : 1);
  rows.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.fin.t - b.fin.t : b.s - a.s));
  const lead = rows[0];
  for (const x of rows) {
    x.out = rank(x) === 2; x.prog = clamp((x.s - T.startS) / span, 0, 1);
    if (x.fin && x.fin.c) x.c = x.fin.c;
    if (x.out) x.txt = x.fin ? 'Retired' : 'Left';
    else if (x === lead) x.txt = x.fin ? fmt(x.fin.t) : Math.round(x.prog * 100) + '%';
    else if (x.fin) x.txt = fmtD(x.fin.t - lead.fin.t);
    else if (mode === 'countdown') x.txt = '—';
    else {
      // when the leader passed this spot; right behind them (closer than their newest sample) it's distance over speed
      const tl = timeAtS(lead.hist, lead.hs, x.s);
      x.txt = fmtD(tl == null ? Math.max(0, lead.s - x.s) / Math.max(5, x.v) : Math.max(0, wt - tl));
    }
  }
  return rows;
}
function netHUD(dt) {
  const box = $('hNet');
  if (!netRun()) { if (!box.hidden) box.hidden = true; return; }
  const nr = net.race, T = W.T, span = T.finishS - T.startS;
  for (const o of nr.others.values()) {
    if (!o.bar) { o.bar = el('em', 'np'); o.bar.style.background = o.col; $('hProgBar').append(o.bar); }
    o.bar.hidden = o.s == null || !!o.out;
    if (o.s != null) o.bar.style.left = clamp((o.s - T.startS) / span, 0, 1) * 100 + '%';
  }
  net.hudT -= dt; if (net.hudT > 0) return; net.hudT = 0.25;
  box.hidden = false; box.textContent = '';
  netRows().forEach((x, k) => {
    const r = el('div', 'r' + (x.me ? ' me' : '') + (x.out ? ' out' : '')), i = el('i');
    i.style.background = x.col;
    r.append(el('span', 'p', x.out ? '–' : String(k + 1)), i, el('b', null, x.me ? 'You' : x.n), el('span', null, x.txt));
    box.append(r);
  });
  if (nr.done) box.append(el('div', 'foot', 'Race over'));
  else if (nr.close) box.append(el('div', 'foot', netClosesIn()));
  else if (mode === 'countdown') box.append(el('div', 'foot', isTouch ? 'Tap for the table' : 'Hold Tab for the table'));
}
function netClosesIn() { const s = Math.max(0, Math.ceil((net.race.close - nowMs()) / 1000)); return `Closes in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
// ---- the room table: held on Tab (d-pad down on a pad; a tap on the standings on a touch screen) in a race ----
// every driver with their place, gap, room points and ping: the round trip of the direct link between your browsers,
// or through the server (your trip to it plus theirs, which comes with their samples)
let padBoard = false;
function netBoard(dt) {
  const box = $('netBoard');
  if (!netRun()) net.boardTap = false;
  if (!(netRun() && !$('hud').hidden && (keys.Tab || padBoard || net.boardTap))) { if (!box.hidden) box.hidden = true; return; }
  if (!box.hidden && (net.boardT -= dt) > 0) return;
  net.boardT = 0.25; box.hidden = false; box.textContent = '';
  const room = net.room, nr = net.race, head = el('div', 'nb-head');
  head.append(el('b', null, `Room ${net.code}`), el('span', null, C.stageTitle(W.st)));
  if (nr.done || nr.close) head.append(el('span', 'nb-st', nr.done ? 'Race over' : netClosesIn()));
  const tb = el('table', 'tt nb'), hr = el('tr');
  for (const h of ['', '', 'Driver', 'Gap', 'Pts', 'Ping']) hr.append(el('th', null, h));
  tb.append(hr);
  netRows().forEach((x, k) => {
    const tr = el('tr', (x.me ? 'you' : '') + (x.out ? ' out' : '')), dot = el('td', 'dot'), di = el('i'), nm = el('td', 'nm', x.n);
    di.style.background = x.col; dot.append(di);
    if (room && x.i === room.h) nm.append(el('span', 'tag host', 'host'));
    if (x.me) nm.append(el('span', 'tag', 'you'));
    nm.append(el('small', null, shortCar(x.c)));
    const pe = room && room.pts[x.i];
    tr.append(el('td', null, x.out ? '–' : String(k + 1)), dot, nm, el('td', null, x.txt), el('td', null, String(pe ? pe.p : 0)), netPingCell(x));
    tb.append(tr);
  });
  box.append(head, tb, el('div', 'nb-foot', 'Ping: the round trip to each driver, straight between your browsers (direct) or through the room server. Your own row is your trip to the server.'));
}
function netPingCell(x) {
  const td = el('td', 'ping'), ch = net.ch;
  if (x.gone || !ch) return td;
  let ms = 0, via = 'server';
  if (x.me) ms = ch.srv;
  else if (ch.linked(x.i)) { ms = ch.rtt(x.i); via = 'direct'; }
  else if (ch.srv && net.sv.has(x.i)) ms = ch.srv + net.sv.get(x.i);
  td.append(el('b', ms ? (ms < 60 ? 'good' : ms < 130 ? 'ok' : 'bad') : '', ms ? `${Math.max(1, Math.round(ms))} ms` : '…'), el('small', null, via));
  return td;
}
function renderNetResults() {
  const nr = net.race; if (!nr || !W) return;
  const last = net.room && net.room.last && net.room.last.id === nr.id ? net.room.last : null;
  $('rNetHead').textContent = `Room ${net.code} · ${last ? 'final' : 'live'}`;
  const tb = $('rNetTable'); tb.textContent = '';
  const head = el('tr'); ['', '', 'Driver', 'Time', last ? 'Pts' : ''].forEach(h => head.append(el('th', null, h))); tb.append(head);
  tb.className = 'tt netres';
  const rows = netRows();
  rows.forEach((x, k) => {
    const tr = el('tr', x.me ? 'you' : ''), d = el('td', 'dot'), i = el('i');
    i.style.background = x.col; d.append(i);
    const g = last ? last.rows.find(y => y.i === x.i) : null;
    const tm = x.fin && x.fin.t != null ? (k ? fmt(x.fin.t) + ' ' + x.txt : fmt(x.fin.t)) : x.out ? x.txt : `On stage · ${Math.round(x.prog * 100)}%`;
    tr.append(el('td', null, x.out ? '–' : String(k + 1)), d, el('td', null, `${x.me ? 'You' : x.n} · ${shortCar(x.c)}`), el('td', null, tm), el('td', null, g ? (g.g ? '+' + g.g : '0') : ''));
    tb.append(tr);
  });
  const waiting = rows.filter(x => !x.fin && !x.out);
  let note = '';
  if (last) note = 'Race over. The host starts the next one from the lobby.';
  else if (waiting.length) {
    const s = nr.close ? Math.max(0, Math.ceil((nr.close - nowMs()) / 1000)) : 0;
    note = `Waiting for ${waiting.map(x => x.me ? 'you' : x.n).join(', ')}` + (s ? ` · closes in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
  }
  $('rNetNote').textContent = note;
}
function netInvite() {
  shareLink = location.href.split('#')[0] + '#r=' + net.code;
  $('shareTitle').textContent = 'Invite friends';
  $('shareText').textContent = `Send this link: it opens the game and joins room ${net.code}. Or just tell them the code.`;
  $('shareLink').value = shareLink; $('shareNative').hidden = !navigator.share; $('share').hidden = false;
}
// the Online tab: create or join, or the room you're in
function renderOnline() {
  $('tabOnline').classList.toggle('live', inRoom());
  $('netOut').hidden = inRoom(); $('netIn').hidden = !inRoom();
  if (!inRoom()) return;
  const box = $('netIn'), room = net.room, order = peerList(), mb = box.closest('.menu-body'), sc = mb ? mb.scrollTop : 0;
  box.textContent = '';
  const card = el('div', 'room-card'), t = el('div', 't'), hostP = room && net.peers.get(room.h);
  const status = net.status === 'reconnecting' ? 'Connection lost · reconnecting…' : net.status !== 'online' ? 'Connecting…' : !room ? 'Joining…' : isHost() ? 'You run this room' : `Host · ${hostP ? hostP.n : '…'}`;
  t.append(el('span', 'label', 'Room'), el('b', 'code', net.code), el('small', net.status === 'online' ? null : 'warn', status));
  const inv = el('button', 'btn', 'Invite'); inv.addEventListener('click', netInvite);
  card.append(t, inv); box.append(card);
  if (room) {
    const st = C.stageDef(room.k), T = trackFor(room.k), sb = el('div', 'room-stage');
    sb.append(el('b', null, st.name), el('small', null, [st.daily ? 'Daily' : st.rev ? 'Reverse' : 'Forward', C.condName(st), st.surface, (T.L / 1000).toFixed(1) + ' km'].join(' · ')),
      el('small', null, isHost() ? 'Pick another in the Stage tab' : 'The host picks it'));
    box.append(el('p', 'label group-label', 'Stage'), sb);
  }
  box.append(el('p', 'label group-label', `Drivers · ${order.length} of ${ROOM_MAX}`));
  const list = el('div', 'room-list'), race = room && room.race && !room.race.done ? room.race : null;
  const rT = race ? trackFor(race.k) : null;
  order.forEach((p, k) => {
    const row = el('div', 'room-row' + (p.i === netId ? ' me' : '')), dot = el('i'), tt = el('span', 't'), nm = el('b', null, p.n);
    dot.style.background = PCOL[k % PCOL.length];
    if (room && p.i === room.h) nm.append(el('span', 'tag host', 'host'));
    if (p.i === netId) nm.append(el('span', 'tag', 'you'));
    if (p.v !== NET_V) nm.append(el('span', 'tag old', 'reload'));
    let sub = (carById(p.c) || C.CARS[0]).name;
    if (race) {
      const f = race.fin[p.i], pr = net.prog.get(p.i), inGrid = race.grid.some(g => g.i === p.i);
      if (!inGrid) sub += ' · waits for the next race';
      else if (f) sub += f.t == null ? ' · retired' : ' · finished ' + fmt(f.t);
      else if (room.ph === 'load') sub += netLoaded(race.id).has(p.i) ? ' · on the line' : ' · loading';
      else if (pr && pr.r === race.id) sub += ` · on stage ${Math.round(clamp((pr.s - rT.startS) / (rT.finishS - rT.startS), 0, 1) * 100)}%`;
      else sub += ' · on stage';
    }
    // how their car reaches yours: straight from their browser (and the round trip) or through the server
    if (p.i !== netId) { const ms = net.ch.rtt(p.i); sub += net.ch.linked(p.i) ? ' · direct' + (ms ? ` ${Math.max(1, Math.round(ms))} ms` : '') : ' · via server'; }
    tt.append(nm, el('small', null, sub));
    const pe = room && room.pts[p.i], pts = el('span', 'pts', String(pe ? pe.p : 0));
    pts.append(el('small', null, pe && pe.w ? `${pe.w} win${pe.w > 1 ? 's' : ''}` : 'pts'));
    row.append(dot, tt, pts); list.append(row);
  });
  box.append(list);
  if (race && !race.grid.some(g => g.i === netId)) box.append(el('p', 'room-note', `A race is on at ${C.stageDef(race.k).name}. You line up for the next one.`));
  else if (race && netId in race.fin) box.append(el('p', 'room-note', 'The others are still out there. The room shows the result when they finish.'));
  if (room && room.last) {
    box.append(el('p', 'label group-label', `Last race · ${C.stageTitle(C.stageDef(room.last.k))}`));
    const tb = el('table', 'tt netres'), win = room.last.rows[0];
    room.last.rows.forEach((x, k) => {
      const tr = el('tr', x.i === netId ? 'you' : '');
      tr.append(el('td', null, x.t == null ? '–' : String(k + 1)), el('td', 'dot'), el('td', null, `${x.n} · ${shortCar(x.c)}`), el('td', null, x.t == null ? 'DNF' : k && win.t != null ? fmtD(x.t - win.t) : fmt(x.t)), el('td', null, x.g ? '+' + x.g : ''));
      tb.append(tr);
    });
    box.append(tb);
  }
  if (order.length < 2 && room && isHost()) box.append(el('p', 'room-note', 'Send your friends the code or the invite link. You can start a race on your own too.'));
  const lv = el('button', 'btn', 'Leave room'); lv.addEventListener('click', () => netLeave()); box.append(lv);
  if (mb) mb.scrollTop = sc;
}
$('netCreate').addEventListener('click', netCreate);
$('netJoinBtn').addEventListener('click', () => netJoin($('netCode').value));
$('netCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); netJoin($('netCode').value); } });
$('netCode').addEventListener('input', () => { const v = $('netCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v !== $('netCode').value) $('netCode').value = v; });
setInterval(netTick, 250);
// a race started from someone else's click: audio may still be waiting for a gesture of yours
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (A.ctx && A.ctx.state === 'suspended' && !document.hidden && mode !== 'paused') A.ctx.resume(); }, { passive: true });
window.addEventListener('pagehide', () => { if (net.ch) net.ch.send('bye', { f: netId }); });

// ---------- race flow ----------
const isTouch = matchMedia('(pointer: coarse)').matches;
function setScreen(name) {
  $('menu').hidden = name !== 'menu';
  $('garage').hidden = name !== 'menu';
  $('hud').hidden = name !== 'race';
  $('touch').hidden = !(name === 'race' && isTouch);
  $('pause').hidden = name !== 'pause';
  $('results').hidden = name !== 'results';
  if (name !== 'results') $('share').hidden = true;
}
function startRace() {
  if (!W || mode === 'loading') return;
  rallyLeg = null;
  if (rallyOn()) {
    // one go per stage: starting a stage of the rally again costs 10 s
    const k = rally.idx;
    if (rally.tries[k]) rally.pen[k] = (rally.pen[k] || 0) + 10;
    rally.tries[k] = (rally.tries[k] || 0) + 1; saveRally();
  }
  $('share').hidden = true;
  setLights(!!S.E.night, true);
  initAudio(); warmSpeech();
  C.resetCar(W, car, W.T.spawnS); snapVis(); resetEffects();
  raceT = 0; cdT = 0; cdShown = -1; finishT = 0; doneT = 0; splitsHit = []; ghostRec = []; ghostTimer = 0;
  Object.assign(lap, { n: 0, t0: 0, next: W.T.startS + (W.T.lap || 0), best: lapsOn() ? lapBest(W.st.key, P.id) : null, last: null, rec: [], list: [] });
  noteIdx = 0; called = []; offT = 0; stuckT = 0; wrongT = 0; resultsShown = false; acc = 0;
  $('hStage').textContent = (rallyOn() ? `SS${rally.idx + 1} · ` : netRun() ? 'Online · ' : '') + W.st.name + (W.st.rev ? ' ⇄' : '');
  net.pause = false; $('pTitle').textContent = 'Paused'; $('pNote').hidden = true; $('pLaps').hidden = true;
  $('hSurf').textContent = W.st.surface + (W.st.cond !== 'day' ? ' · ' + C.condName(W.st) : '');
  const span = W.T.finishS - W.T.startS;
  $('hS1').style.left = ((W.T.splits[0] - W.T.startS) / span * 100) + '%';
  $('hS2').style.left = ((W.T.splits[1] - W.T.startS) / span * 100) + '%';
  $('hS1').hidden = $('hS2').hidden = lapsOn();
  $('hPB').hidden = !pb; $('hChal').hidden = !chal;
  $('notes').innerHTML = ''; noteKey = '';
  $('hint').hidden = true;
  setScreen('race');
  mode = 'countdown';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  showCamTag();
}
let lastRun = null, rallyLeg = null;
function finish() {
  finishT = raceT; mode = 'done'; doneT = 0;
  const key = W.st.key, rt = rival.time;
  const medal = finishT <= rt ? 3 : finishT <= rt * 1.06 ? 2 : finishT <= rt * 1.15 ? 1 : 0;
  lastMedal = medal;
  const old = store.get(pbKey(key, P.id), null), oldBest = stageBest(key);
  const isPB = !old || finishT < old.t;
  const ghost = new Float32Array(ghostRec);
  const bonus = apart(P);
  lastRun = bonus ? null : { key, car: P.id, t: finishT, splits: splitsHit.slice(), ghost };
  // the Saveiro's times go on the board (marked, without a place) but never count: no medal, no record, no No. 1
  if (isPB) {
    store.set(pbKey(key, P.id), { t: finishT, car: P.id, splits: splitsHit.slice(), q: b64e(packGhost(ghost)), at: Date.now() });
    pb = { t: finishT, car: P.id, splits: splitsHit.slice(), ghost }; pb.sArr = refCurve(ghost);
  }
  if (!bonus && medal > store.get('medal.' + key, 0)) store.set('medal.' + key, medal);
  if (settings.name && boardAdd([{ n: settings.name, k: key, c: P.id, t: finishT, s: splitsHit.slice(), d: Date.now() }])) onlineSync();
  rallyLeg = rallyOn() ? rallyFinishLeg(finishT) : null;
  if (netRun()) netFinished();
  center(`<div class="mid yel">Finish</div><div class="sub">${fmt(finishT)}</div>`, 2.4);
  sfx.beep(880, 0.12); setTimeout(() => sfx.beep(1320, 0.25), 140);
  const beat = chal && finishT < chal.t;
  say(rallyLeg ? (rallyLeg.pos === 1 ? 'Stop. Fastest time. Mega.' : 'Stop. Good stage.') : beat ? `Stop. We beat ${chal.n}.` : medal === 3 ? 'Stage win. Mega.' : medal ? 'Stop. Good stage.' : 'Stop. We go again.');
  buildResults(old, isPB, medal, oldBest);
  if (bonus) { $('rPB').hidden = false; $('rPB').textContent = isBonus(P) ? (isPB ? 'New best in the Saveiro' : 'Saveiro run') + ' · on the board, doesn\'t count for No. 1' : (isPB ? `New best in the ${shortCar(P.id)}` : `${shortCar(P.id)} run`) + ' · on the board in a class of its own'; $('rShare').hidden = true; }
  else loadLead();
}
function buildResults(old, isPB, medal, oldBest) {
  const inRally = !!rallyLeg;
  $('rStage').textContent = `${inRally ? `SS${rallyLeg.k + 1} of ${rally.legs.length}` : 'Stage complete'} · ${C.stageTitle(W.st)} · ${P.name}`;
  $('rTime').textContent = fmt(finishT);
  const names = ['No medal', 'Bronze', 'Silver', 'Gold'];
  const m = $('rMedal'); m.className = 'medal m' + medal; m.textContent = names[medal];
  $('rPB').hidden = !isPB;
  $('rPB').textContent = isPB && oldBest && finishT < oldBest.t ? 'New stage record' : `New best in the ${shortCar(P.id)}`;
  const tb = $('rTable'); tb.innerHTML = '';
  const row = (cells, cls) => { const tr = el('tr'); cells.forEach((c, i) => { const td = el(i === 0 ? 'td' : 'td', i && cls && cls[i] ? cls[i] : '', c); tr.append(td); }); tb.append(tr); };
  const head = el('tr'); ['', 'Split 1', 'Split 2', 'Finish'].forEach(h => head.append(el('th', null, h))); tb.append(head);
  const mine = [...splitsHit, finishT];
  const riv = [...rival.splits, rival.time];
  const gapRow = (label, ref) => row([label, ...mine.map((t, i) => ref[i] != null ? fmtD(t - ref[i]) : '')], [null, ...mine.map((t, i) => t - ref[i] <= 0 ? 'ahead' : 'behind')]);
  row(['You', ...mine.map(fmt)]);
  row([`Rival · ${W.st.rival}`, ...riv.map(fmt)]);
  gapRow('Gap to rival', riv);
  if (chal) { const cs = [...chal.s, chal.t]; row([`${chal.n} · ${shortCar(chal.c)}`, ...cs.map(fmt)]); gapRow(`Gap to ${chal.n}`, cs); }
  if (old && !isPB) row([`Your best · ${shortCar(P.id)}`, '', '', fmt(old.t)]);
  if (old && isPB) row(['Previous best', '', '', fmt(old.t)]);
  if (oldBest && oldBest.car !== P.id && oldBest.t < finishT) row([`Stage record · ${shortCar(oldBest.car)}`, '', '', fmt(oldBest.t)]);
  const rt = rival.time;
  $('rTargets').textContent = `Gold ${fmt(rt)} · Silver ${fmt(rt * 1.06)} · Bronze ${fmt(rt * 1.15)}`;
  const cl = $('rChal');
  if (chal) {
    const d = finishT - chal.t; cl.hidden = false; cl.className = 'chal-res ' + (d <= 0.005 ? 'ahead' : 'behind');
    cl.textContent = Math.abs(d) < 0.005 ? `Dead heat with ${chal.n}!` : d < 0 ? `You beat ${chal.n} by ${(-d).toFixed(2)} s. Send it back!` : `${chal.n} is still ${d.toFixed(2)} s faster.`;
  }
  else cl.hidden = true;
  // rally: standings instead of the stage table, no retries
  const inNet = netRun();
  $('rTable').hidden = inRally || inNet; $('rTargets').hidden = inRally || inNet; $('rRally').hidden = !inRally;
  $('rRetry').hidden = inRally || inNet; $('rShare').hidden = false; $('rNext').hidden = inNet; $('rNet').hidden = !inNet;
  $('rMenu').textContent = inNet ? 'Lobby' : 'Menu'; $('rMenu').classList.toggle('primary', inNet);
  if (inRally) buildRallyTable();
  if (inNet) renderNetResults();
  const nxt = $('rNext'); nxt.classList.toggle('primary', inRally);
  if (inRally) nxt.textContent = rally.done ? 'Done' : `Next: SS${rally.idx + 1}`;
  else nxt.textContent = 'Next: ' + C.stageDef(nextKey()).name;
  nxt.title = inRally && !rally.done ? C.stageTitle(C.stageDef(rally.legs[rally.idx])) : '';
}
// the next road in the list, skipping the ones the car doesn't run on (the F1 goes Monaco → Spa → Monaco)
function nextIdx() {
  const c = C.CARS[settings.car];
  let ni = settings.stage === 'daily' ? 0 : (settings.stage + 1) % C.STAGES.length;
  for (let k = 0; c.only && k < C.STAGES.length && !fitsRoad(c, keyFor(ni)); k++) ni = (ni + 1) % C.STAGES.length;
  return ni;
}
function nextKey() { return keyFor(nextIdx()); }
function retry() { if (netRun()) { toMenu(); return; } if (rallyLeg) return; setScreen('race'); startRace(); }
function nextStage() {
  if (rallyLeg) { rallyNext(); return; }
  settings.stage = nextIdx(); saveSettings();
  setScreen('none');
  loadStage(curKey(), () => { renderStageList(); startRace(); });
}
function toMenu() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (rally && rally.playing) { rally.playing = false; saveRally(); }
  rallyLeg = null;
  if (netRun()) { if (!net.race.fin[netId]) netRetire(); net.race.inRun = false; netClearRun(); if (inRoom()) $('tabOnline').click(); }
  mode = 'menu'; C.resetCar(W, car, W.T.spawnS); snapVis(); resetEffects();
  renderStageInfo(); renderCarList();
  setScreen('menu');
  // the menu shows what its tabs have selected; leave the rally's stage loaded only if it is the same
  if (curKey() !== loadedKey) loadStage(curKey());
}
function togglePause() {
  if (netRun() && (mode === 'race' || mode === 'countdown' || (mode === 'done' && !resultsShown))) {
    net.pause = !net.pause;
    if (!net.pause) { setScreen('race'); return; }
    setScreen('pause');
    $('pTitle').textContent = 'Race on'; $('pNote').hidden = false; $('pRestart').hidden = true; $('pMenu').textContent = 'Leave race';
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    return;
  }
  if (mode === 'paused') { mode = prevMode; setScreen('race'); return; }
  if (mode === 'race' || mode === 'countdown' || (mode === 'done' && !resultsShown)) {
    prevMode = mode; mode = 'paused'; setScreen('pause');
    $('pRestart').hidden = rallyOn();
    $('pMenu').textContent = rallyOn() ? 'Leave rally' : 'Menu';
    // lap mode: every lap so far, the best one marked
    const pl = $('pLaps'), bl = lap.list.length ? Math.min(...lap.list) : 0;
    pl.hidden = !(lapsOn() && lap.list.length);
    if (!pl.hidden) pl.innerHTML = lap.list.map((t, i) => [t, i]).slice(-10).map(([t, i]) => `${t === bl ? '<b class="yel">' : ''}Lap ${i + 1} · ${fmt(t)}${t === bl ? '</b>' : ''}`).join('<br>') + (lap.best ? `<br><small>Best ever in the ${escapeHTML(shortCar(P.id))}: ${fmt(lap.best.t)}</small>` : '');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
$('pResume').addEventListener('click', togglePause);
$('pRestart').addEventListener('click', () => { if (!rallyOn() && !netRun()) startRace(); });
$('pMenu').addEventListener('click', toMenu);
$('rRetry').addEventListener('click', retry);
$('rNext').addEventListener('click', nextStage);
$('rMenu').addEventListener('click', toMenu);
$('touchPause').addEventListener('click', togglePause);
$('touchLights').addEventListener('click', toggleLights);
// on a touch screen the standings open and close the room table
$('hNet').addEventListener('click', () => { net.boardTap = !net.boardTap; net.boardT = 0; });
$('netBoard').addEventListener('click', () => { net.boardTap = false; });
$('pLights').addEventListener('click', toggleLights);
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'race' || mode === 'countdown') && !net.pause) togglePause(); if (A.ctx) { if (document.hidden) A.ctx.suspend(); else A.ctx.resume(); } });

function manualReset() {
  if (mode !== 'race') return;
  C.resetCar(W, car, Math.max(W.T.spawnS, car.s - 12));
  if (netRun()) car.ghostT = 2.5; // back on the road as a ghost for a moment, so it can't land on someone
  snapVis(true); breakSkids(); offT = 0; stuckT = 0; wrongT = 0;
  center('<div class="mid">Back on the road</div>', 1.0);
}

// ---------- center messages / hints ----------
let centerT = 0;
function center(html, dur) {
  const cm = $('centerMsg'); cm.innerHTML = html;
  for (const c of cm.children) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  centerT = dur;
}
let hintText = '';
function hint(html) { if (html === hintText) return; hintText = html; const h = $('hint'); if (!html) { h.hidden = true; return; } h.innerHTML = html; h.hidden = false; }
const CAM_NAMES = ['Chase', 'Far chase', 'Bonnet', 'TV'];
let camTagT = 0;
function showCamTag() { $('camTag').textContent = 'Camera · ' + CAM_NAMES[settings.cam] + ' (C)'; camTagT = 2.5; }

// ---------- input ----------
const keys = {};
const touch = { left: false, right: false, gas: false, brake: false, hb: false };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  if (!$('welcome').hidden) return;
  const k = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k) && mode !== 'menu') e.preventDefault();
  if (k === 'Space' && mode === 'menu' && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
  const first = !keys[k]; keys[k] = true;
  if (!first) return;
  if (k === 'Escape' || k === 'KeyP') togglePause();
  else if (k === 'KeyC' && mode !== 'menu') { settings.cam = (settings.cam + 1) % 4; saveSettings(); showCamTag(); }
  else if (k === 'KeyR') manualReset();
  else if ((k === 'KeyE' || k === 'ShiftLeft' || k === 'ShiftRight') && mode === 'race') pendUp++;
  else if ((k === 'KeyQ' || k === 'ControlLeft' || k === 'ControlRight') && mode === 'race') pendDown++;
  else if (k === 'KeyM') { settings.sound = !settings.sound; saveSettings(); updateToggles(); }
  else if (k === 'KeyL') toggleLights();
  else if (k === 'KeyB' && mode !== 'menu') toggleMirror();
  else if (k === 'Enter') {
    if (mode === 'menu') { e.preventDefault(); menuGo(); }
    else if (resultsShown && !$('results').hidden) { e.preventDefault(); retry(); }
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
for (const b of document.querySelectorAll('.tb')) {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); touch[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
  const off = e => { touch[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
}
const padPrev = {};
let dbgAuto = false;
let pendUp = 0, pendDown = 0;
function readInput() {
  let steer = 0, thr = 0, brk = 0, hb = false, analog = false;
  if (keys.ArrowLeft || keys.KeyA || touch.left) steer -= 1;
  if (keys.ArrowRight || keys.KeyD || touch.right) steer += 1;
  if (keys.ArrowUp || keys.KeyW || touch.gas) thr = 1;
  if (keys.ArrowDown || keys.KeyS || touch.brake) brk = 1;
  if (keys.Space || touch.hb) hb = true;
  let pads = [];
  padBoard = false;
  try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const ax = p.axes[0] || 0;
    if (Math.abs(ax) > 0.12) { steer = Math.sign(ax) * Math.pow((Math.abs(ax) - 0.12) / 0.88, 1.3); analog = true; }
    const bv = i => (p.buttons[i] ? (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0)) : 0);
    thr = Math.max(thr, bv(7)); brk = Math.max(brk, bv(6));
    if (bv(0) > 0.5 || bv(2) > 0.5) hb = true;
    const edge = i => { const now = bv(i) > 0.5; const was = padPrev[p.index + ':' + i]; padPrev[p.index + ':' + i] = now; return now && !was; };
    if (edge(9) && $('welcome').hidden) { if (mode === 'menu') menuGo(); else if (resultsShown && !$('results').hidden) retry(); else togglePause(); }
    if (edge(3) && mode !== 'menu') { settings.cam = (settings.cam + 1) % 4; saveSettings(); showCamTag(); }
    if (edge(8)) manualReset();
    if (edge(12)) toggleLights();
    padBoard = bv(13) > 0.5; // d-pad down, held: the room table
    if (edge(5) && mode === 'race') pendUp++;
    if (edge(4) && mode === 'race') pendDown++;
    break;
  }
  input = { steer, thr, brk, hb, analog };
  if (dbgAuto && mode === 'race') { const a = C.aiDrive(W, car, P, aiDone); input = { steer: a.steer, thr: a.thr, brk: a.brk, hb: false, analog: true }; }
  return input;
}

// ---------- audio ----------
// Engine voices are built from firing orders relative to crank speed (rpm / 60):
// inline-4 fires at order 2, the boxer adds a strong order-1 burble, the five-cylinder fires at order 2.5 with a half-order warble.
const VOICES = {
  foca:     { orders: [[2, 'sawtooth', 0.55], [4, 'square', 0.1], [1, 'sawtooth', 0.22], [6, 'sawtooth', 0.05]], drive: 6, lp: [480, 2600], q: 3.2, am: 0.06, amRate: 2, turbo: 0.012, whine: 0.02, flutter: 0, antilag: 0.9, induct: 0.05 },
  impressa: { orders: [[2, 'sawtooth', 0.42], [1, 'square', 0.34], [0.5, 'sawtooth', 0.26], [4, 'square', 0.06]], drive: 7, lp: [360, 2000], q: 2.6, am: 0.55, amRate: 1, turbo: 0.01, whine: 0.018, flutter: 0, antilag: 1.0, induct: 0.045 },
  lancha:   { orders: [[2, 'sawtooth', 0.55], [4, 'sawtooth', 0.14], [1, 'square', 0.18], [8, 'sine', 0.04]], drive: 9, lp: [560, 3100], q: 4, am: 0.1, amRate: 2, turbo: 0.014, whine: 0, flutter: 0, antilag: 0.8, induct: 0.06 },
  delta:    { orders: [[2, 'sawtooth', 0.5], [4, 'square', 0.12], [1, 'sawtooth', 0.15], [3, 'sine', 0.06]], drive: 5, lp: [650, 3400], q: 3.6, am: 0.05, amRate: 2, turbo: 0.018, whine: 0, flutter: 1, antilag: 0, induct: 0.07 },
  pejo:     { orders: [[2, 'sawtooth', 0.55], [4, 'square', 0.16], [1, 'square', 0.12], [6, 'sawtooth', 0.06]], drive: 11, lp: [520, 3000], q: 4.5, am: 0.08, amRate: 2, turbo: 0.03, whine: 0, flutter: 1, antilag: 0.25, induct: 0.09 },
  selica:   { orders: [[2, 'sawtooth', 0.52], [4, 'square', 0.12], [1, 'sawtooth', 0.2], [6, 'sawtooth', 0.05]], drive: 7, lp: [500, 2800], q: 3.4, am: 0.07, amRate: 2, turbo: 0.014, whine: 0.012, flutter: 0, antilag: 0.85, induct: 0.06 },
  kwattro:  { orders: [[2.5, 'sawtooth', 0.5], [5, 'square', 0.1], [1.25, 'sawtooth', 0.3], [0.5, 'sine', 0.24]], drive: 8, lp: [420, 2500], q: 3, am: 0.38, amRate: 0.5, turbo: 0.032, whine: 0, flutter: 0.3, antilag: 1.0, induct: 0.08 },
  saveiro:  { orders: [[2, 'sawtooth', 0.55], [4, 'square', 0.12], [1, 'sawtooth', 0.24], [6, 'sawtooth', 0.05]], drive: 8, lp: [470, 2700], q: 3.4, am: 0.07, amRate: 2, turbo: 0.03, whine: 0.016, flutter: 0, antilag: 1.0, induct: 0.07 },
  // the V8 fires at order 4 (eight cylinders, a firing every 90 degrees): a scream, no turbo
  f1:       { orders: [[4, 'sawtooth', 0.5], [8, 'square', 0.1], [2, 'sawtooth', 0.16], [12, 'sawtooth', 0.05]], drive: 5, lp: [1400, 7000], q: 2.5, am: 0.03, amRate: 4, turbo: 0, whine: 0.03, flutter: 0, antilag: 0, induct: 0.06 },
};
// Combustion model per car (AudioWorklet path). Pulses are shaped in crank angle, so the timbre follows the revs,
// while the exhaust pipes add fixed resonances on top, which is what makes it read as an engine and not a synth.
// off: firing offset of each cylinder (fraction of a firing interval), amp: pulse strength per cylinder. Uneven values
// give the boxer burble (unequal headers) and the five-cylinder warble. pipes: [length m, reflection] per section.
const ENGINES = {
  foca:     { cyl: 4, off: [0, 0.02, -0.01, 0.01], amp: [1, 0.96, 1.03, 0.98], rasp: 0.5, sharp: 0.4, decay: 0.06, pipes: [[2.4, 0.5], [0.55, 0.32]], intake: 0.32, mech: 0.08, drive: 1.8, muf: [2850, 4950], body: [160, 3], gain: 0.43 },
  impressa: { cyl: 4, off: [0, 0.16, 0.02, -0.1], amp: [1.08, 0.82, 1.0, 0.86], rasp: 0.38, sharp: 0.35, decay: 0.095, pipes: [[2.9, 0.55], [0.8, 0.3]], intake: 0.26, mech: 0.06, drive: 1.5, muf: [2100, 4000], body: [110, 4], gain: 0.65 },
  lancha:   { cyl: 4, off: [0, 0.01, 0, -0.01], amp: [1, 0.98, 1.02, 0.97], rasp: 0.58, sharp: 0.5, decay: 0.05, pipes: [[2.2, 0.5], [0.45, 0.35]], intake: 0.36, mech: 0.09, drive: 2.0, muf: [3250, 5700], body: [190, 3], gain: 0.49 },
  delta:    { cyl: 4, off: [0, 0.03, 0, 0.02], amp: [1, 0.95, 1.02, 0.97], rasp: 0.46, sharp: 0.4, decay: 0.07, pipes: [[2.6, 0.45], [0.7, 0.3]], intake: 0.34, mech: 0.1, drive: 1.6, muf: [2650, 4750], body: [150, 3], gain: 0.61 },
  pejo:     { cyl: 4, off: [0, 0.02, 0.01, 0], amp: [1, 0.94, 1.05, 0.96], rasp: 0.65, sharp: 0.5, decay: 0.045, pipes: [[1.5, 0.5], [0.4, 0.36]], intake: 0.42, mech: 0.12, drive: 2.2, muf: [3600, 6450], body: [210, 2], gain: 0.51 },
  selica:   { cyl: 4, off: [0, 0.02, -0.01, 0.015], amp: [1, 0.97, 1.03, 0.97], rasp: 0.48, sharp: 0.45, decay: 0.06, pipes: [[2.3, 0.5], [0.5, 0.33]], intake: 0.34, mech: 0.09, drive: 1.9, muf: [3000, 5300], body: [175, 3], gain: 0.47 },
  kwattro:  { cyl: 5, off: [0, 0.04, -0.03, 0.05, 0], amp: [1, 0.93, 1.06, 0.9, 1.02], rasp: 0.46, sharp: 0.4, decay: 0.08, pipes: [[2.5, 0.5], [0.65, 0.3]], intake: 0.3, mech: 0.07, drive: 1.7, muf: [2400, 4350], body: [130, 4], gain: 0.61 },
  // the Saveiro: a 1.6 four with a straight-through pipe, rough and loud
  saveiro:  { cyl: 4, off: [0, 0.03, -0.02, 0.02], amp: [1, 0.94, 1.05, 0.97], rasp: 0.62, sharp: 0.5, decay: 0.055, pipes: [[1.9, 0.52], [0.5, 0.34]], intake: 0.38, mech: 0.11, drive: 2.1, muf: [3100, 5600], body: [170, 3], gain: 0.5 },
  // the F1's flat-plane V8: even firing, short primaries straight out of the periscopes, no silencer to speak of, a
  // loud airbox; rref is the rpm its intake roar and valvetrain are scaled to (19,000 instead of a rally car's 8,000)
  f1:       { cyl: 8, off: [0, 0.01, -0.01, 0.005, 0, -0.005, 0.01, 0], amp: [1, 0.98, 1.02, 0.99, 1, 0.97, 1.01, 0.99], rasp: 0.3, sharp: 0.6, decay: 0.045, pipes: [[0.7, 0.45], [0.25, 0.3]], intake: 0.45, mech: 0.1, drive: 1.5, muf: [7000, 11000], body: [520, 2.5], gain: 0.5, rref: 19000 },
};
const AUDIO_WORKLET = `
const TAU = 6.283185307179586;
let seed = 22222;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
class Engine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const k = (name, def, max) => ({ name, defaultValue: def, minValue: 0, maxValue: max, automationRate: 'k-rate' });
    return [k('rpm', 900, 21000), k('load', 0, 1), k('boost', 0, 2), k('cut', 0, 1), k('inside', 0, 1), k('pop', 0, 1)];
  }
  constructor(o) {
    super();
    const c = (o && o.processorOptions) || {};
    const n = this.n = c.cyl || 4;
    this.fire = new Float64Array(n); this.amp = new Float32Array(n); this.age = new Float64Array(n).fill(9); this.a = new Float32Array(n);
    for (let k = 0; k < n; k++) { this.fire[k] = (((k + (c.off ? c.off[k] : 0)) / n) % 1 + 1) % 1; this.amp[k] = c.amp ? c.amp[k] : 1; }
    this.rasp = c.rasp == null ? 0.3 : c.rasp; this.dec = c.decay || 0.06; this.drive = c.drive || 1.6; this.sharp = c.sharp == null ? 0.4 : c.sharp;
    this.rref = c.rref || 8000; this.inK = c.intake == null ? 0.3 : c.intake; this.mechK = c.mech == null ? 0.08 : c.mech; this.muf = c.muf || [1400, 2500];
    this.pipes = (c.pipes || [[2.2, 0.5], [0.6, 0.3]]).map(([L, r]) => { const len = Math.max(2, Math.round(2 * L / 343 * sampleRate)); return { b: new Float32Array(len), i: 0, len, r, z: 0 }; });
    this.th = 0; this.rpm = 900; this.load = 0; this.cut = 0;
    this.m1 = 0; this.m2 = 0; this.dcx = 0; this.dcy = 0; this.ox = 0; this.oy = 0; this.b1 = 0; this.b2 = 0; this.rl = 0; this.mk = 0;
    // afterfire: unburnt fuel lighting off in the hot exhaust. A bang queued from the game goes out with the next firing;
    // on the overrun the 'pop' parameter sets how often a firing turns into a crackle (and how often one misfires)
    this.bq = 0; this.bA = 0; this.bt = 1; this.bTau = 0.01; this.bl = 0;
    // end: the voice was let go. A processor that returns true keeps running after its node is disconnected
    if (this.port) this.port.onmessage = e => { if (e.data && e.data.bang) this.bq = Math.max(this.bq, e.data.bang); if (e.data && e.data.end) this.end = true; };
  }
  process(_, outputs, P) {
    if (this.end) return false;
    const out = outputs[0][0]; if (!out) return true;
    const fs = sampleRate, N = out.length;
    const rpmT = P.rpm[0], loadT = P.load[0], boost = P.boost[0], cutT = P.cut[0], inside = P.inside[0], pop = P.pop ? P.pop[0] : 0;
    // intake resonance (airbox + runners) rises a little with revs; two-pole bandpass, coefficients per block
    const fi = 170 + this.rpm * 0.04, w = TAU * fi / fs, q = 2.2, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const bb0 = al / a0, ba1 = -2 * Math.cos(w) / a0, ba2 = (1 - al) / a0;
    const gm = 1 - Math.exp(-TAU * (this.muf[0] + (this.muf[1] - this.muf[0]) * this.load) * (1 - 0.45 * inside) / fs);
    const gr = 1 - Math.exp(-TAU * 1400 / fs);
    const sm = 1 - Math.exp(-1 / (0.012 * fs));
    for (let i = 0; i < N; i++) {
      this.rpm += (rpmT - this.rpm) * sm; this.load += (loadT - this.load) * sm; this.cut += (cutT - this.cut) * sm * 3;
      const dth = this.rpm / 120 / fs; // one cycle = two revolutions
      const prev = this.th; this.th += dth; const wrap = this.th >= 1; if (wrap) this.th -= 1;
      const strength = (0.34 + 0.66 * this.load * (1 + 0.35 * boost)) * (1 - 0.8 * this.cut);
      // combustion gets ragged off throttle at high revs (overrun burble), smooth under load
      const jit = 0.05 + 0.32 * (1 - this.load) * Math.min(1, Math.max(0, (this.rpm - 2200) / 2500));
      const ar = Math.max(0.0025, dth * 1.2);
      const ovr = pop * (1 - this.load) * Math.min(1, Math.max(0, (this.rpm - 2300) / 2200));
      let x = 0, env = 0;
      for (let k = 0; k < this.n; k++) {
        const f = this.fire[k];
        if (wrap ? (f > prev || f <= this.th) : (f > prev && f <= this.th)) {
          this.age[k] = (this.th - f + 1) % 1;
          let a = this.amp[k] * strength * (1 + jit * (rnd() * 2 - 1)), b = 0;
          if (this.bq > 0) { b = this.bq; this.bq = 0; }
          else if (ovr > 0) { const r = rnd(); if (r < ovr * 0.07) b = 0.18 + rnd() * rnd() * 0.5; else if (r < ovr * 0.14) a *= 0.12; }
          if (b > 0) { this.bA = b; this.bt = 0; this.bTau = 0.006 + 0.016 * b; }
          this.a[k] = a;
        } else this.age[k] += dth;
        const ag = this.age[k];
        if (ag < 0.6) {
          // blowdown: a steep pressure front (sharp) riding on the slower bulk of the pulse
          const e = (1 - this.sharp) * Math.exp(-ag / this.dec) + this.sharp * 2.2 * Math.exp(-ag / (this.dec * 0.18));
          x += (1 - Math.exp(-ag / ar)) * e * this.a[k];
          env += Math.exp(-ag / 0.012);
        }
      }
      const nz = rnd() * 2 - 1;
      let e = x * (1 - this.rasp + this.rasp * nz * 1.7);
      // the bang: a hard pressure front and a ragged, noisy tail that rings through the same pipes
      let bg = 0;
      if (this.bt < 0.12) {
        const bt = this.bt; this.bt += 1 / fs;
        bg = this.bA * (1 - Math.exp(-bt / 0.0004)) * (2.4 * Math.exp(-bt / 0.0016) + Math.exp(-bt / this.bTau) * (0.45 + 1.1 * (rnd() * 2 - 1)));
        e += bg * 1.6;
      }
      // exhaust: open-ended pipe sections as damped feedback combs (inverted reflection), then the silencer
      for (const p of this.pipes) {
        const d = p.b[p.i]; p.z += (d - p.z) * 0.45;
        const y = e - p.r * p.z; p.b[p.i] = y; p.i = p.i + 1 === p.len ? 0 : p.i + 1; e = y;
      }
      this.m1 += (e - this.m1) * gm; this.m2 += (this.m1 - this.m2) * gm;
      this.bl += (bg - this.bl) * 0.35; // part of the bang is lit at the tailpipe, past the silencer
      // intake: the same pulses through the airbox resonance, plus a roar that grows with load and revs
      const xi = x - this.b2; const bi = bb0 * xi - ba1 * this.b1 - ba2 * this.b2; this.b2 = this.b1; this.b1 = bi;
      const rv = this.rpm / this.rref;
      this.rl += (nz * this.load * rv * rv - this.rl) * gr;
      // valvetrain clatter, ticking with every firing
      this.mk = nz * env * rv;
      const s = (this.m2 + this.bl * 0.9) * (1 - 0.4 * inside) + (bi * 1.6 + this.rl * 0.9) * this.inK * (0.7 + 0.9 * inside) + this.mk * this.mechK * (0.5 + inside);
      // DC blocker, then a soft clip that thickens the sound under load
      const dy = s - this.dcx + 0.995 * this.dcy; this.dcx = s; this.dcy = dy;
      const c = Math.tanh(this.drive * dy);
      const o2 = c - this.ox + 0.997 * this.oy; this.ox = c; this.oy = o2; // the clip is asymmetric: block DC again
      out[i] = o2 * 0.5;
    }
    return true;
  }
}
// loose surface: random stone clicks, each a short burst of noise; overlapping clicks build the crunch
class Crunch extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const k = (name, def, max) => ({ name, defaultValue: def, minValue: 0, maxValue: max, automationRate: 'k-rate' });
    return [k('rate', 0, 4000), k('decay', 0.003, 0.05)];
  }
  constructor() { super(); this.env = 0; if (this.port) this.port.onmessage = e => { if (e.data && e.data.end) this.end = true; }; }
  process(_, outputs, P) {
    if (this.end) return false;
    const out = outputs[0][0]; if (!out) return true;
    const p = P.rate[0] / sampleRate, kd = Math.exp(-1 / (P.decay[0] * sampleRate));
    for (let i = 0; i < out.length; i++) {
      if (rnd() < p) { const a = rnd(); this.env += 0.15 + a * a * a; }
      this.env *= kd;
      out[i] = (rnd() * 2 - 1) * Math.min(this.env, 2.5) * 0.35;
    }
    return true;
  }
}
registerProcessor('engine', Engine);
registerProcessor('crunch', Crunch);
`;
// register the worklet from a Blob URL (single-file build); if anything fails the oscillator synth stays in use
function loadWorklet(ctx) {
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') return;
  const tryUrl = url => ctx.audioWorklet.addModule(url);
  const blob = URL.createObjectURL(new Blob([AUDIO_WORKLET], { type: 'application/javascript' }));
  tryUrl(blob).catch(() => tryUrl('data:application/javascript;base64,' + btoa(AUDIO_WORKLET)))
    .then(() => { A.wk = true; buildSurfaces(); buildVoice(); })
    .catch(() => { A.wk = false; });
}
const A = { voice: null };
let flameT = 0;
function initAudio() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); if (!A.voice || A.voice.id !== P.id || A.voice.ex !== getTune(P.id).exhaust) buildVoice(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let ctx; try { ctx = new AC(); } catch (e) { return; }
  A.ctx = ctx;
  const master = ctx.createGain(); master.gain.value = settings.sound ? 0.55 : 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  // pausing silences the whole game (engine, gravel, crowd, ambience, reverb tails) and resuming brings it back
  const pz = ctx.createGain(); A.pz = pz;
  master.connect(pz); pz.connect(comp); comp.connect(ctx.destination); A.master = master;
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A.noise = nb;
  A.noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random() * 2); return s; };
  A.gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  A.filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  // The car's own sounds go through A.car: distance from the camera (gain), air absorption (lowpass), left/right
  // (pan), so on the TV camera the car is out there in the stage instead of in your ears. The world around it
  // (crowd, birds, wind, rain) goes through A.env. Both feed a reverb shaped by the place: tree trunks and clearings
  // in the forests, the far buttes in the desert, snow that swallows the highs, and a slapback echo between the
  // walls of the gorge.
  A.car = A.gain(1); A.carLp = A.filt('lowpass', 20000, 0.5); A.carPan = ctx.createStereoPanner ? ctx.createStereoPanner() : A.gain(1);
  A.car.connect(A.carLp); A.carLp.connect(A.carPan); A.carPan.connect(master);
  A.env = A.gain(1); A.envPan = ctx.createStereoPanner ? ctx.createStereoPanner() : A.gain(1); A.env.connect(master);
  A.revIn = A.gain(0.0); A.conv = ctx.createConvolver(); A.revOut = A.gain(1);
  A.carPan.connect(A.revIn); A.env.connect(A.revIn); A.revIn.connect(A.conv); A.conv.connect(A.revOut); A.revOut.connect(master);
  A.slapIn = A.gain(0); A.slap = ctx.createDelay(0.2); A.slap.delayTime.value = 0.042; A.slapFb = A.gain(0.38); A.slapLp = A.filt('lowpass', 3200, 0.5);
  A.carPan.connect(A.slapIn); A.slapIn.connect(A.slap); A.slap.connect(A.slapLp); A.slapLp.connect(A.slapFb); A.slapFb.connect(A.slap); A.slapLp.connect(master);
  A.revKey = '';
  // surfaces and wind (shared)
  A.gbp = A.filt('bandpass', 1100, 0.6); A.gg = A.gain(0); A.noiseSrc().connect(A.gbp); A.gbp.connect(A.gg); A.gg.connect(A.car);
  A.sbp = A.filt('bandpass', 2400, 3.5); A.sg = A.gain(0); A.noiseSrc().connect(A.sbp); A.sbp.connect(A.sg); A.sg.connect(A.car);
  A.wlp = A.filt('lowpass', 380, 0.5); A.wg = A.gain(0); A.noiseSrc().connect(A.wlp); A.wlp.connect(A.wg); A.wg.connect(A.car);
  A.scbp = A.filt('bandpass', 1800, 2.2); A.scg = A.gain(0); A.noiseSrc().connect(A.scbp); A.scbp.connect(A.scg); A.scg.connect(A.car);
  // tyre squeal on tarmac: a wavering tone rather than just hiss
  A.sqo = ctx.createOscillator(); A.sqo.type = 'triangle'; A.sqo.frequency.value = 820; A.sqo.start();
  A.sqbp = A.filt('bandpass', 1000, 1.4); A.sqg = A.gain(0); A.sqo.connect(A.sqbp); A.sqbp.connect(A.sqg); A.sqg.connect(A.car);
  // rain: a soft wide hiss, and water under the tyres that rises with speed
  A.rnf = A.filt('highpass', 1200, 0.4); A.rnl = A.filt('lowpass', 7500, 0.4); A.rng = A.gain(0); A.noiseSrc().connect(A.rnf); A.rnf.connect(A.rnl); A.rnl.connect(A.rng); A.rng.connect(master);
  A.wsbp = A.filt('bandpass', 3000, 0.7); A.wsg = A.gain(0); A.noiseSrc().connect(A.wsbp); A.wsbp.connect(A.wsg); A.wsg.connect(A.car);
  // the crowd: an applause bed (many random claps) and cheering voices (formants), level and side from the fans near
  // the car; whistles and air horns as one-off events
  A.crowd = A.gain(0); A.crowdPan = ctx.createStereoPanner ? ctx.createStereoPanner() : A.gain(1); A.crowd.connect(A.crowdPan); A.crowdPan.connect(A.env);
  A.vox = A.gain(0.0);
  for (const [f, q, k] of [[640, 5, 1], [1150, 6, 0.7], [2400, 7, 0.35]]) { const b = A.filt('bandpass', f, q), g = A.gain(k); A.noiseSrc().connect(b); b.connect(g); g.connect(A.vox); }
  A.vox.connect(A.crowd);
  // ambience: wind that comes and goes (crickets, birds and the rest are one-off events)
  A.ambW = A.gain(0); A.ambWlp = A.filt('lowpass', 520, 0.6); A.noiseSrc().connect(A.ambWlp); A.ambWlp.connect(A.ambW); A.ambW.connect(A.env);
  A.crickT = [0.3, 0.7, 1.1]; A.crickP = [0.62, 0.74, 0.86];
  A.gust = 0; A.gustT = 0; A.birdT = 2; A.stoneT = 0; A.hornT = 0; A.whistleT = 0; A.thunderT = 20; A.hawkT = 15; A.voxT = 0;
  A.camPrev = null; A.camVel = [0, 0, 0]; A.dopp = 1;
  A.alT = 0; A.popT = 0;
  buildVoice();
  loadWorklet(ctx);
}
function buildSurfaces() {
  const ctx = A.ctx; if (!ctx || !A.wk || A.cr) return;
  try {
    A.cr = new AudioWorkletNode(ctx, 'crunch', { numberOfInputs: 0, outputChannelCount: [1] });
    A.crbp = A.filt('bandpass', 2000, 0.8); A.crlp = A.filt('lowpass', 5000, 0.5); A.crg = A.gain(0);
    A.cr.connect(A.crbp); A.crbp.connect(A.crlp); A.crlp.connect(A.crg); A.crg.connect(A.car);
    // gravel flung into the wheel arches and the floor: a hard, bright spray of tiny hits, loudest on board
    A.sp = new AudioWorkletNode(ctx, 'crunch', { numberOfInputs: 0, outputChannelCount: [1] });
    A.spbp = A.filt('bandpass', 3600, 0.9); A.sphp = A.filt('highpass', 1400, 0.5); A.spg = A.gain(0);
    A.sp.connect(A.sphp); A.sphp.connect(A.spbp); A.spbp.connect(A.spg); A.spg.connect(A.car);
    // applause: claps are the same kind of random clicks, slower and softer, filtered to the hands' band
    A.cl = new AudioWorkletNode(ctx, 'crunch', { numberOfInputs: 0, outputChannelCount: [1] });
    A.clbp = A.filt('bandpass', 1300, 1.1); A.clg = A.gain(0.7); A.cl.connect(A.clbp); A.clbp.connect(A.clg); A.clg.connect(A.crowd);
    A.cl.parameters.get('rate').value = 0; A.cl.parameters.get('decay').value = 0.012;
  } catch (e) { A.cr = null; }
}
// stop and unplug a voice's nodes; worklet processors are told to end, or they would keep running unheard
function freeNodes(nodes) {
  for (const n of nodes) {
    try { n.stop && n.stop(); } catch (e) { /* already stopped */ }
    if (n.port) n.port.postMessage({ end: 1 });
    try { n.disconnect(); } catch (e) { /* ignore */ }
  }
  nodes.length = 0;
}
function buildVoice() {
  const ctx = A.ctx; if (!ctx) return;
  if (A.voice) freeNodes(A.voice.nodes);
  const V = VOICES[P.id] || VOICES.foca;
  const nodes = [];
  const osc = (type) => { const o = ctx.createOscillator(); o.type = type; o.start(); nodes.push(o); return o; };
  // turbo: a whistle that rises with boost plus the rush of air through the compressor
  const turbo = () => {
    const tw = osc('sine'); const tg = A.gain(0); nodes.push(tg); tw.connect(tg); tg.connect(A.car);
    const ts = A.noiseSrc(); nodes.push(ts); const tbp = A.filt('bandpass', 3000, 6); nodes.push(tbp); const tng = A.gain(0); nodes.push(tng);
    ts.connect(tbp); tbp.connect(tng); tng.connect(A.car);
    const wh = osc('sine'); const whg = A.gain(0); nodes.push(whg); wh.connect(whg); whg.connect(A.car);
    return { tw, tg, tbp, tng, wh, whg };
  };
  if (A.wk) {
    try {
      const EN0 = ENGINES[P.id] || ENGINES.foca;
      // sport exhaust: a freer silencer, more rasp and drive, a deeper boom from the pipe and a bit louder
      const EN = getTune(P.id).exhaust === 'sport' ? Object.assign({}, EN0, { muf: [EN0.muf[0] * 1.22, EN0.muf[1] * 1.22], rasp: Math.min(0.85, EN0.rasp + 0.1), sharp: Math.min(0.7, (EN0.sharp || 0.4) + 0.06), drive: EN0.drive + 0.3, body: [EN0.body[0] * 0.92, EN0.body[1] + 2.5], gain: EN0.gain * 1.15 }) : EN0;
      const en = new AudioWorkletNode(ctx, 'engine', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: EN });
      nodes.push(en);
      const body = A.filt('peaking', EN.body[0], 0.8); body.gain.value = EN.body[1]; nodes.push(body);
      const air = A.filt('highshelf', 4500, 0.7); air.gain.value = -1.5; nodes.push(air);
      const eg = A.gain(0); nodes.push(eg);
      en.connect(body); body.connect(air); air.connect(eg); eg.connect(A.car);
      A.voice = Object.assign({ id: P.id, ex: getTune(P.id).exhaust, V, EN, nodes, wk: en, prm: en.parameters, eg }, turbo());
      return;
    } catch (e) { A.wk = false; freeNodes(nodes); }
  }
  const sum = A.gain(1); nodes.push(sum);
  const oscs = V.orders.map(([ord, type, amp], i) => { const o = osc(type); if (i === 1) o.detune.value = 7; const g = A.gain(amp); nodes.push(g); o.connect(g); g.connect(sum); return { o, ord }; });
  const shaper = ctx.createWaveShaper(); const n = 1024, cv = new Float32Array(n), k = V.drive;
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  shaper.curve = cv; nodes.push(shaper);
  const lp = A.filt('lowpass', 900, V.q); nodes.push(lp);
  const am = A.gain(1 - V.am * 0.5); nodes.push(am);
  const lfo = osc('sine'); const depth = A.gain(V.am * 0.5); nodes.push(depth); lfo.connect(depth); depth.connect(am.gain);
  const eg = A.gain(0); nodes.push(eg);
  sum.connect(shaper); shaper.connect(lp); lp.connect(am); am.connect(eg); eg.connect(A.car);
  const tb = turbo();
  const ns = A.noiseSrc(); nodes.push(ns); const ib = A.filt('bandpass', 1200, 1.2); nodes.push(ib); const ig = A.gain(0); nodes.push(ig);
  ns.connect(ib); ib.connect(ig); ig.connect(A.car);
  A.voice = Object.assign({ id: P.id, ex: getTune(P.id).exhaust, V, nodes, oscs, lp, lfo, eg, ib, ig }, tb);
}
// ---- the others' engines (online rooms) ----
// The nearest one or two rivals within ~120 m of the camera get a voice of their own: the combustion model with their
// car's ENGINES entry (stock exhaust), the turbo whistle, dump valve and anti-lag bangs, and gravel or a tyre hiss
// while they slide close by. Each goes through a bus with the same distance gain, air absorption, pan and Doppler as
// your car, taken from where their car is drawn. The engine itself (rpm, throttle, boost, gear changes) plays their
// samples about one network batch behind the drawn car, so it runs on smoothly instead of holding a note and jumping
// when the next batch comes in. Rivals sit a little under your own car (NV_K) and are muffled on the bonnet camera.
// Without the worklet two oscillators stand in for the engine.
const NV_MAX = 2, NV_ON = 120, NV_OFF = 135, NV_K = 0.6;
function nvBuild(o) {
  const ctx = A.ctx, nodes = [], c = carById(o.c) || C.CARS[0], V = VOICES[c.id] || VOICES.foca, EN = ENGINES[c.id] || ENGINES.foca;
  const bus = A.gain(0), lp = A.filt('lowpass', 8000, 0.5), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : A.gain(1), eg = A.gain(0);
  eg.connect(bus); bus.connect(lp); lp.connect(pan); pan.connect(A.master); pan.connect(A.revIn);
  nodes.push(eg, bus, lp, pan);
  const v = { o, P: c, V, EN, nodes, bus, lp, pan, eg, en: null, cr: null, wk: !!A.wk, dopp: 1, lag: 0.3, acur: 0, gear: 1, hold: 0, press: 0, pk: 0, dumpT: 0, alT: 0, popT: 0, cutI: -1, end: 0 };
  if (A.wk) {
    try {
      const en = new AudioWorkletNode(ctx, 'engine', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: EN }); nodes.push(en);
      const body = A.filt('peaking', EN.body[0], 0.8); body.gain.value = EN.body[1]; nodes.push(body);
      en.connect(body); body.connect(eg); v.en = en;
    } catch (e) { /* the oscillators below */ }
    if (v.en) try {
      const cr = new AudioWorkletNode(ctx, 'crunch', { numberOfInputs: 0, outputChannelCount: [1] }), crbp = A.filt('bandpass', 1900, 0.8), crg = A.gain(0);
      nodes.push(cr, crbp, crg); cr.connect(crbp); crbp.connect(crg); crg.connect(bus); Object.assign(v, { cr, crbp, crg });
    } catch (e) { v.cr = null; }
  }
  if (!v.en) {
    v.lpo = A.filt('lowpass', 900, V.q); nodes.push(v.lpo); v.lpo.connect(eg);
    v.oscs = V.orders.slice(0, 2).map(([ord, type, amp]) => { const os = ctx.createOscillator(); os.type = type; os.start(); const g = A.gain(amp); os.connect(g); g.connect(v.lpo); nodes.push(os, g); return { os, ord }; });
  }
  v.tw = ctx.createOscillator(); v.tw.type = 'sine'; v.tw.start(); v.tg = A.gain(0); v.tw.connect(v.tg); v.tg.connect(bus); nodes.push(v.tw, v.tg);
  return v;
}
// a driver's engine at time ta of their samples: rpm (older clients send none: then it comes from the speed and the
// gearbox, with the car's own shift points), throttle, boost, and whether a gear change falls in this stretch
const nvE = { rpm: 0, thr: 0, boost: 0, cut: 0, ci: -1 };
function nvEngine(v, ta) {
  const H = v.o.hist, n = H.length;
  let i = Math.min(v.acur, n - 1);
  while (i > 0 && H[i][0] > ta) i--;
  while (i < n - 1 && H[i + 1][0] <= ta) i++;
  v.acur = i;
  const a = H[i], b = i < n - 1 ? H[i + 1] : a, u = b === a ? 0 : clamp((ta - a[0]) / Math.max(1e-3, b[0] - a[0]), 0, 1), fa = a[11] | 0, fb = b[11] | 0;
  nvE.thr = lerp((fa >> 2) & 7, (fb >> 2) & 7, u) / 7; nvE.boost = lerp((fa >> 5) & 7, (fb >> 5) & 7, u) / 7;
  nvE.cut = b !== a && fb & 256 ? 1 : 0; nvE.ci = i;
  if (a[12] >= 0 && b[12] >= 0) nvE.rpm = lerp(a[12], b[12], u);
  else {
    const P0 = v.P, E = P0.engine, w = Math.hypot(lerp(a[5], b[5], u), lerp(a[6], b[6], u)) / C.RW * P0.final * 60 / (2 * Math.PI), at = g => w * P0.ratios[g - 1];
    while (v.gear < P0.ratios.length && at(v.gear) > E.redline - 220) v.gear++;
    while (v.gear > 1 && at(v.gear) < E.redline * 0.52 && at(v.gear - 1) < E.redline - 900) v.gear--;
    nvE.rpm = Math.max(E.idle, at(v.gear), v.gear === 1 && nvE.thr > 0.05 ? 1400 + nvE.thr * 2600 : 0); // the clutch slips on launch
  }
  return nvE;
}
function nvUpdate(v, d, dt, t, wt, crx, crz, onboard) {
  const o = v.o, p = o.pose, H = o.hist, E = v.P.engine, V = v.V, newest = H[H.length - 1][0];
  // how far behind the newest sample to play: the biggest recent gap, eased down slowly
  const lag = wt - newest;
  v.lag = lag > v.lag ? lag : v.lag + (lag - v.lag) * Math.min(1, dt);
  const e = nvEngine(v, Math.min(newest, wt - v.lag - 0.02)), rpm = e.rpm, thr = e.thr, boost = e.boost;
  v.rpm = rpm; v.thr = thr;
  // ---- where it is for the listener ----
  const dx = p.x - cam.pos[0], dz = p.z - cam.pos[2];
  const vr = ((p.vx - A.camVel[0]) * dx + (p.vz - A.camVel[2]) * dz) / d;
  v.dopp += (clamp(343 / (343 + vr), 0.82, 1.22) - v.dopp) * Math.min(1, dt * 6);
  v.d = d; v.gk = (d <= 9 ? 1 : Math.pow(9 / d, 0.9)) * clamp((NV_OFF - d) / 30, 0, 1) * NV_K * (onboard ? 0.5 : 1);
  v.bus.gain.setTargetAtTime(v.gk, t, 0.05);
  v.lp.frequency.setTargetAtTime(clamp(20000 / (1 + Math.pow(d / 40, 1.5)), 900, 20000) * (onboard ? 0.3 : 1), t, 0.06);
  if (v.pan.pan) v.pan.pan.setTargetAtTime(clamp((dx * crx + dz * crz) / d * 0.9, -0.85, 0.85), t, 0.05);
  // ---- the engine ----
  if (v.en) {
    const pr = v.en.parameters;
    pr.get('rpm').setTargetAtTime(rpm * v.dopp, t, 0.03);
    pr.get('load').setTargetAtTime(thr, t, 0.04);
    pr.get('boost').setTargetAtTime(boost, t, 0.05);
    pr.get('cut').setTargetAtTime(e.cut, t, 0.006);
    pr.get('pop').setTargetAtTime((V.antilag > 0 ? 0.1 : 0.04) + (v.alT > 0 ? 0.25 * V.antilag : 0), t, 0.05);
    v.eg.gain.setTargetAtTime(v.EN.gain * (0.75 + rpm / E.redline * 0.35) * (1.45 - 0.45 * thr), t, 0.03);
  } else {
    for (const q of v.oscs) q.os.frequency.setTargetAtTime(rpm / 60 * q.ord * v.dopp, t, 0.02);
    v.lpo.frequency.setTargetAtTime(V.lp[0] + thr * (V.lp[1] - V.lp[0]) + rpm * 0.12, t, 0.03);
    v.eg.gain.setTargetAtTime(0.06 + thr * 0.12 + rpm / E.redline * 0.05, t, 0.025);
  }
  v.tw.frequency.setTargetAtTime((1500 + boost * 5400) * v.dopp, t, 0.05);
  v.tg.gain.setTargetAtTime(boost * V.turbo * (0.4 + thr), t, 0.06);
  // lifts and gear changes, as on your car: the dump valve lets go of the pressure built while the throttle was held,
  // and anti-lag cars bang on the overrun
  const bang = size => { if (v.en) v.en.port.postMessage({ bang: size }); };
  const dump = k => { if (V.flutter > 0.5) sfx.flutter(v.press * k, boost, v.bus); else sfx.bov(v.press * k, v.bus); v.press *= 1 - k; v.dumpT = 0.5; };
  const held = v.hold;
  if (thr > 0.6) { v.hold = held + dt; v.press += (boost - v.press) * Math.min(1, dt * 2.5); }
  else { if (thr < 0.3) v.hold = 0; v.press = Math.max(0, v.press - dt * 1.5); }
  v.dumpT -= dt;
  const canDump = v.press > 0.3 && held > 0.3 && v.dumpT <= 0;
  v.pk = Math.max(thr, v.pk - dt * 2.5);
  if (v.pk > 0.5 && thr < 0.1) {
    v.pk = 0; v.hold = 0;
    if (canDump) dump(1);
    if (V.antilag > 0 && rpm > 3800) v.alT = 0.5 + V.antilag * 0.8;
    else if (rpm > 5000) bang(0.45);
  }
  if (v.alT > 0) {
    v.alT -= dt;
    if (thr < 0.1 && rpm > 2800) { if (V.antilag > 0) { v.popT -= dt; if (v.popT <= 0) { bang(Math.random() < 0.3 ? 1 : 0.6); v.popT = 0.06 + Math.random() * 0.14 / V.antilag; } } }
    else v.alT = 0;
  }
  if (e.cut && v.cutI !== e.ci) {
    v.cutI = e.ci;
    if (V.antilag > 0.5 && Math.random() < 0.7) bang(Math.random() < 0.4 ? 1 : 0.6);
    if (v.P.gearbox.type !== 'Sequential' && canDump) dump(0.55);
  }
  // ---- their tyres, close by: stones under them on gravel and snow, a hiss when they slide on tarmac ----
  if (v.cr) {
    const tar = !!W.st.tarmac, frost = W.st.kind === 'frost', spd = Math.hypot(p.vx, p.vz), slip = Math.abs(p.vx * Math.cos(p.h) - p.vz * Math.sin(p.h));
    const near = clamp((70 - d) / 30, 0, 1), hiss = tar ? clamp((slip - 2.5) / 7, 0, 1) : 0;
    const rate = near > 0 ? (tar ? (hiss > 0 ? 2600 : 0) : clamp(spd * 14 + slip * 90, 0, 2600)) : 0;
    const pr = v.cr.parameters;
    pr.get('rate').setTargetAtTime(rate, t, 0.05);
    pr.get('decay').setTargetAtTime(frost ? 0.007 : 0.0025, t, 0.1);
    v.crbp.frequency.setTargetAtTime(tar ? 2400 : frost ? 900 : 1900, t, 0.1);
    v.crbp.Q.setTargetAtTime(tar ? 3 : 0.8, t, 0.1);
    v.crg.gain.setTargetAtTime(rate > 0 ? near * (tar ? hiss * 0.3 : frost ? 0.5 : 0.65) : 0, t, 0.05);
  }
}
function netAudio(dt, t, crx, crz, onboard) {
  const nv = A.nv || (A.nv = new Map()), nr = net.race;
  const on = !!(nr && nr.inRun && nr.greenL && (mode === 'race' || mode === 'countdown' || mode === 'done'));
  // who is heard: the nearest NV_MAX in range (a voice that is playing holds on a little further out, and against
  // a newcomer that is only slightly nearer)
  const pick = [];
  if (on) for (const o of nr.others.values()) {
    if (o.out || !o.hist.length || o.pose.x === undefined) continue;
    const d = Math.max(0.5, Math.hypot(o.pose.x - cam.pos[0], o.pose.y + 0.6 - cam.pos[1], o.pose.z - cam.pos[2])), v = nv.get(o), live = v && !v.end;
    if (d < (live ? NV_OFF : NV_ON)) pick.push({ o, d, k: live ? d * 0.85 : d });
  }
  pick.sort((a, b) => a.k - b.k);
  if (pick.length > NV_MAX) pick.length = NV_MAX;
  // the rest fade out and are taken apart
  for (const [o, v] of nv) {
    if (pick.some(q => q.o === o)) continue;
    if (!v.end) { v.end = t + 0.6; v.bus.gain.setTargetAtTime(0, t, 0.12); }
    else if (t >= v.end) { freeNodes(v.nodes); nv.delete(o); }
  }
  if (!pick.length) return;
  const wt = netWT();
  for (const q of pick) {
    let v = nv.get(q.o);
    if (v && !v.wk && A.wk) { freeNodes(v.nodes); v = null; } // built while the worklet was still loading
    if (!v) { v = nvBuild(q.o); nv.set(q.o, v); }
    v.end = 0;
    nvUpdate(v, q.d, dt, t, wt, crx, crz, onboard);
  }
}
const sfx = {
  click() {
    if (!A.ctx) return; const c = A.ctx, t = c.currentTime;
    const s = A.noiseSrc(), f = A.filt('bandpass', 3200, 2.5), g = A.gain(0);
    s.connect(f); f.connect(g); g.connect(A.master);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.04);
    s.stop(t + 0.06);
  },
  burst(when, dur, type, f, q, vol, atk, dest) {
    const c = A.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = A.noise;
    const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q;
    const g = c.createGain();
    if (atk) { g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + atk); } else g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(b); b.connect(g); g.connect(dest || A.car); s.start(when, Math.random() * 1.5); s.stop(when + dur + 0.05);
  },
  tone(freq, dur, type, vol, slide, dest) { if (A.ctx) this.toneAt(A.ctx.currentTime, freq, dur, type, vol, slide, dest); },
  toneAt(t, freq, dur, type, vol, slide, dest) {
    const c = A.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || A.car); o.start(t); o.stop(t + dur + 0.05);
  },
  beep(f, d) { this.tone(f, d, 'square', 0.12, null, A.master); },
  // backfire: a sharp crack, a low boom that drops in pitch, the body of the blast and a short ring in the pipe.
  // small = the quieter crackle of a sport exhaust burbling on the overrun (no flame)
  pop(big, small) {
    const c = A.ctx; if (!c) return; const t = c.currentTime + 0.004, k = big ? 1 : small ? 0.42 : 0.7;
    this.burst(t, small ? 0.012 : 0.02, 'highpass', 1600 + Math.random() * 900, 0.8, 0.55 * k);
    this.toneAt(t, 105 + Math.random() * 45, big ? 0.17 : 0.11, 'sine', 0.55 * k, 42);
    this.burst(t, big ? 0.12 : 0.07, 'lowpass', 280 + Math.random() * 120, 0.7, 0.65 * k);
    this.burst(t + 0.008, small ? 0.08 : 0.15, 'bandpass', 560 + Math.random() * 260, 1.6, 0.13 * k);
    if (!small) flameT = big ? 0.09 : 0.055;
  },
  // blow-off valve: "pssshh". The valve opens with a soft puff, then the boost vents as a broad hiss that
  // settles slightly lower as the pressure bleeds off (no resonant sweep - that reads as a whip)
  bov(amt, dest) {
    const c = A.ctx; if (!c) return; const t = c.currentTime + 0.01, k = clamp(amt, 0.3, 1.2), dur = 0.3 + k * 0.4, out = dest || A.car;
    const s = c.createBufferSource(); s.buffer = A.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.Q.value = 0.5;
    hp.frequency.setValueAtTime(1700, t); hp.frequency.linearRampToValueAtTime(1100, t + dur);
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3600; pk.Q.value = 0.8; pk.gain.value = 4;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; lp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26 * k, t + 0.03);
    g.gain.setValueAtTime(0.26 * k, t + 0.06); g.gain.setTargetAtTime(0.0001, t + 0.06, dur / 3.2);
    s.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(out); s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.5);
    this.burst(t, 0.1, 'bandpass', 650, 0.9, 0.16 * k, 0.012, out);
  },
  blowoff(amt) { this.bov(amt); },
  // compressor surge (no valve): the trapped boost can't get out, so it pushes back out of the turbo's inlet in puffs
  // as the compressor stalls and recovers - "stu-tu-tu-tu". It's air, not parts: a rush that never fully stops,
  // swelling and dipping in soft rounded pulses that come slower and fainter as the turbo spins down, with the
  // turbo's whistle winding down underneath
  flutter(amt, boost, dest) {
    const c = A.ctx; if (!c) return; const out = dest || A.car;
    const k = clamp(amt, 0.3, 1.2), t0 = c.currentTime + 0.01, R = 1500, dur = 0.5 + 0.45 * k;
    const L = Math.ceil(dur * R) + 1, ea = new Float32Array(L), ew = new Float32Array(L), ef = new Float32Array(L);
    let ph = 0, rate = 19 + 6 * k, jit = 1;
    for (let j = 0; j < L; j++) {
      const x = j / R;
      // overall swell: a soft onset, then it fades as the pressure goes; the first instant is mostly one rush of air
      const big = Math.min(1, x / 0.02) * Math.exp(-x / (0.22 + 0.2 * k)) * Math.min(1, (dur - x) / 0.08);
      const floor = 0.26 + 0.5 * Math.exp(-x / 0.05);
      // pulse shape over one cycle: rises quickly and falls away smoothly (no edges, so no clicks)
      const m = Math.pow(Math.sin(Math.PI * Math.sqrt(ph)), 2);
      ea[j] = Math.max(0.0001, k * big * (floor + (1 - floor) * m));
      ew[j] = Math.max(0.0001, k * big * (0.6 + 0.4 * m));
      ef[j] = 1300 + 2000 * m * (0.5 + 0.5 * big);
      ph += rate * jit / R;
      if (ph >= 1) { ph -= 1; jit = 0.92 + Math.random() * 0.16; }
      rate = Math.max(9, rate * Math.exp(-1.1 / R)); // the surge slows as the wheel loses speed
    }
    const env = c.createGain(); env.gain.setValueCurveAtTime(ea, t0, dur); env.connect(out);
    const src = c.createBufferSource(); src.buffer = A.noise;
    // the air: a broad rush (highpassed so it isn't a rumble), opening up at each puff, with a soft hollow
    // colour from the inlet pipe and a little low "whoomph" body
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260; hp.Q.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.setValueCurveAtTime(ef, t0, dur);
    const col = c.createBiquadFilter(); col.type = 'peaking'; col.frequency.value = 1150; col.Q.value = 0.9; col.gain.value = 5;
    const ga = c.createGain(); ga.gain.value = 0.48;
    src.connect(hp); hp.connect(lp); lp.connect(col); col.connect(ga); ga.connect(env);
    const body = c.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 520; body.Q.value = 0.6;
    const gb = c.createGain(); gb.gain.value = 0.55;
    src.connect(body); body.connect(gb); gb.connect(env);
    // the whistle winding down, only lightly touched by the pulses
    const wenv = c.createGain(); wenv.gain.setValueCurveAtTime(ew, t0, dur); wenv.connect(out);
    const w = c.createOscillator(); w.type = 'sine'; const wf = 1500 + clamp(boost == null ? amt : boost, 0, 1) * 5400;
    w.frequency.setValueAtTime(wf, t0); w.frequency.exponentialRampToValueAtTime(wf * 0.5, t0 + dur);
    const gw = c.createGain(); gw.gain.value = 0.035; w.connect(gw); gw.connect(wenv);
    src.start(t0, Math.random() * 1.2); src.stop(t0 + dur + 0.05); w.start(t0); w.stop(t0 + dur + 0.05);
  },
  clack() { const c = A.ctx; if (!c) return; this.burst(c.currentTime, 0.035, 'highpass', 1800, 0.8, 0.22); },
  // a stone off the floor or into an arch: mostly a sharp metallic tick, sometimes a duller knock under the car
  stone() {
    const c = A.ctx; if (!c) return; const t = c.currentTime + Math.random() * 0.02;
    if (Math.random() < 0.7) this.burst(t, 0.02 + Math.random() * 0.02, 'bandpass', 2600 + Math.random() * 3400, 9, 0.05 + Math.random() * 0.09);
    else { this.burst(t, 0.045, 'bandpass', 450 + Math.random() * 450, 4, 0.08 + Math.random() * 0.08); this.burst(t, 0.03, 'highpass', 2200, 0.7, 0.03); }
  },
  panTo(pan) { const c = A.ctx, p = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (p.pan) p.pan.value = clamp(pan, -1, 1); p.connect(A.env); return p; },
  // fans: a two-tone wolf whistle or a rising one
  whistle(pan) {
    const c = A.ctx; if (!c) return; const t = c.currentTime + 0.01, out = this.panTo(pan), wolf = Math.random() < 0.5;
    const o = c.createOscillator(), g = c.createGain(), f = 2100 + Math.random() * 500;
    const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 6 + Math.random() * 3; vg.gain.value = 40; v.connect(vg); vg.connect(o.frequency);
    if (wolf) { o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.16); o.frequency.setValueAtTime(f * 0.95, t + 0.24); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.36); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.6); }
    else { o.frequency.setValueAtTime(f * 0.85, t); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.45); }
    const d = wolf ? 0.62 : 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.03); if (wolf) { g.gain.setValueAtTime(0.03, t + 0.17); g.gain.linearRampToValueAtTime(0.004, t + 0.22); g.gain.linearRampToValueAtTime(0.03, t + 0.27); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(out); o.start(t); v.start(t); o.stop(t + d + 0.05); v.stop(t + d + 0.05);
  },
  // an air horn from the bank: two reedy tones a third apart, blown for a moment, sagging a little as it runs out
  horn(pan) {
    const c = A.ctx; if (!c) return; const t = c.currentTime + 0.02, out = this.panTo(pan), d = 0.5 + Math.random() * 0.6, base = 300 + Math.random() * 80;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 0.04); g.gain.setValueAtTime(0.045, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    lp.connect(g); g.connect(out);
    for (const k of [1, 1.26]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(base * k, t); o.frequency.linearRampToValueAtTime(base * k * 0.97, t + d); o.connect(lp); o.start(t); o.stop(t + d + 0.2); }
  },
  // songbirds in the woods: a short phrase of chirps that sweep up or down
  bird() {
    const c = A.ctx; if (!c) return; const out = this.panTo((Math.random() - 0.5) * 1.6), up = Math.random() < 0.5;
    let t = c.currentTime + 0.02; const n = 2 + ((Math.random() * 5) | 0), f0 = 2600 + Math.random() * 2400, vol = 0.008 + Math.random() * 0.012;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(), g = c.createGain(), d = 0.04 + Math.random() * 0.08, f = f0 * (0.9 + Math.random() * 0.25);
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (up ? 1.35 : 0.72), t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02); t += d + 0.025 + Math.random() * 0.07;
    }
  },
  // a cricket's chirp: three soft pulses of a high tone, each with a rounded envelope (no edges, so no buzz)
  cricket(k) {
    const c = A.ctx; if (!c) return; const out = this.panTo([-0.6, 0.15, 0.6][k] + (Math.random() - 0.5) * 0.2), f = [4400, 4650, 4520][k];
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + 0.01, R = 4000, n = 3, pd = 0.014, gap = 0.016, L = Math.ceil((n * (pd + gap)) * R), env = new Float32Array(L);
    for (let i = 0; i < L; i++) { const x = i / R, ph = x % (pd + gap); env[i] = ph < pd ? 0.0035 * Math.pow(Math.sin(Math.PI * ph / pd), 2) : 0; }
    o.frequency.value = f; g.gain.value = 0; g.gain.setValueCurveAtTime(env, t0, L / R);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + L / R + 0.02);
  },
  // a hawk circling over the desert, far off
  hawk() {
    const c = A.ctx; if (!c) return; const t = c.currentTime + 0.02, out = this.panTo((Math.random() - 0.5) * 1.4);
    const o = c.createOscillator(), g = c.createGain(), v = c.createOscillator(), vg = c.createGain();
    v.frequency.value = 11; vg.gain.value = 70; v.connect(vg); vg.connect(o.frequency);
    o.frequency.setValueAtTime(2300, t); o.frequency.exponentialRampToValueAtTime(1450, t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g); g.connect(out); o.start(t); v.start(t); o.stop(t + 1.3); v.stop(t + 1.3);
  },
  // distant thunder: a slow rumble that rolls in and out
  thunder() {
    const c = A.ctx; if (!c) return; const t = c.currentTime + 0.05, d = 3 + Math.random() * 3, out = this.panTo((Math.random() - 0.5) * 1.2);
    const s2 = c.createBufferSource(); s2.buffer = A.noise; s2.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140 + Math.random() * 80; lp.Q.value = 0.9;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    let tt = t; for (let k = 0; k < 6; k++) { tt += 0.2 + Math.random() * 0.6; g.gain.linearRampToValueAtTime((0.1 + Math.random() * 0.14) * Math.exp(-(tt - t) / d * 1.5), tt); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1);
    s2.connect(lp); lp.connect(g); g.connect(out); s2.start(t, Math.random()); s2.stop(t + d + 1.2);
  },
  thump(v) { const c = A.ctx; if (!c) return; this.tone(85, 0.28, 'sine', Math.min(0.9, v * 0.08), 38); this.burst(c.currentTime, 0.18, 'lowpass', 260, 0.7, Math.min(0.8, v * 0.06)); },
  // impact: low body thump + panel crunch, a faint ring of metal, then small bits settling. Soft objects only whump.
  crash(v, kind) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + 0.004, k = clamp((v - 3) / 12, 0, 1);
    const soft = kind === 'bank' || kind === 'hay' || kind === 'fan' || kind === 'barrier';
    this.toneAt(t, 60 + Math.random() * 12, 0.22 + k * 0.2, 'sine', 0.3 + k * 0.5, 33);
    this.burst(t, 0.14 + k * 0.16, 'lowpass', soft ? 300 : 420, 0.7, 0.3 + k * 0.5);
    if (soft) { this.burst(t + 0.02, 0.35 + k * 0.3, 'bandpass', kind === 'bank' ? 1300 : kind === 'barrier' ? 800 : 2200, 0.5, 0.1 + k * 0.2); return; }
    this.burst(t, 0.12 + k * 0.2, 'bandpass', 560 + Math.random() * 280, 0.9, 0.25 + k * 0.65);
    if (v > 5) {
      const r = 0.9 + Math.random() * 0.2;
      for (const [f, d] of [[430, 0.3], [1120, 0.22], [1850, 0.15]]) this.burst(t, d * (0.7 + k * 0.6), 'bandpass', f * r, 14, 0.5 + k * 1.1);
    }
    if (v > 7) {
      const n = 2 + Math.round(k * 5);
      for (let i = 0; i < n; i++) this.burst(t + 0.05 + Math.random() * (0.12 + k * 0.28), 0.025, 'highpass', 2500 + Math.random() * 3000, 0.7, 0.03 + Math.random() * 0.06 * (0.5 + k));
    }
    if (kind === 'tree') { this.burst(t, 0.06, 'bandpass', 1700, 1.2, 0.2 + k * 0.3); this.burst(t + 0.06, 0.6 + k * 0.4, 'highpass', 3800, 0.5, 0.03 + k * 0.05); }
    else if (kind === 'rock' || kind === 'wall') this.toneAt(t, 150, 0.1, 'triangle', 0.06 + k * 0.08, 90);
    else if (kind === 'post') { this.toneAt(t, 410, 0.45, 'sine', 0.05 + k * 0.08, 396); this.toneAt(t, 1130, 0.25, 'sine', 0.025 + k * 0.04, 1105); } // a hollow steel pole rings
    // another car: two thin steel shells boom against each other, and a bumper cracks
    else if (kind === 'car') { this.toneAt(t, 150 + Math.random() * 20, 0.18, 'sine', 0.08 + k * 0.12, 118); this.toneAt(t + 0.006, 245 + Math.random() * 30, 0.12, 'triangle', 0.03 + k * 0.05, 210); this.burst(t + 0.01, 0.05, 'highpass', 1800, 0.8, 0.08 + k * 0.12); }
  },
};
// reverb for the place, rebuilt when the stage changes: [first, last] early reflection, count; tail length; how dark the
// tail gets; how much is sent; a distant echo off the far cliffs [delay, level]
const REVERB = {
  pine: { er: [0.018, 0.09, 12], tail: 1.3, damp: 0.55, wet: 0.16 },
  forest: { er: [0.008, 0.05, 22], tail: 1.5, damp: 0.5, wet: 0.24 },
  mesa: { er: [0.06, 0.3, 7], tail: 1.0, damp: 0.3, wet: 0.11, echo: [0.62, 0.22] },
  frost: { er: [0.02, 0.1, 8], tail: 0.8, damp: 0.82, wet: 0.09 },
  city: { er: [0.01, 0.07, 20], tail: 1.2, damp: 0.45, wet: 0.2 },
};
function buildReverb() {
  const c = A.ctx; if (!c || !W) return;
  const key = W.st.id; if (A.revKey === key) return; A.revKey = key;
  const Pv = REVERB[W.st.id] || REVERB[W.st.kind] || REVERB.pine, sr = c.sampleRate, len = Math.ceil(sr * Pv.tail), buf = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch), Rn = C.rng(77 + ch * 13); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, env = Math.exp(-t * 6.9 / Pv.tail) * Math.min(1, t / 0.012), k = 0.12 + 0.85 * (1 - Pv.damp) * Math.exp(-t * 2.5);
      lp += ((Rn() * 2 - 1) - lp) * k; d[i] = lp * env * 0.5;
    }
    for (let j = 0; j < Pv.er[2]; j++) { const t = Pv.er[0] + Rn() * (Pv.er[1] - Pv.er[0]), i = Math.floor(t * sr); if (i < len) d[i] += (Rn() < 0.5 ? -1 : 1) * (0.4 + Rn() * 0.6) * Math.exp(-t * 7); }
    if (Pv.echo) { const i0 = Math.floor((Pv.echo[0] + ch * 0.035) * sr); for (let q = 0; q < 900 && i0 + q < len; q++) d[i0 + q] += (Rn() * 2 - 1) * Pv.echo[1] * Math.exp(-q / 180); }
  }
  A.conv.buffer = buf; A.revWet = Pv.wet;
}
// ---- the Saveiro's sound system: a synthesised cumbia from the bed (kick and bass on 1 and 3, güiro scrapes, offbeat
// keyboard chords, a conga) that goes through the car's own bus, so it follows the truck like its engine does; the
// speaker cones pump on the kick (spkPump) ----
const BEAT = { bpm: 96, roots: [55, 49, 43.65, 41.2], chords: [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]] };
function updateBeat(c, t) {
  const on = isBonus(P) && getTune(P.id).music !== 'off' && mode !== 'loading' && mode !== 'boot';
  if (!on) { A.beatNext = 0; if (A.beatBus) A.beatBus.gain.setTargetAtTime(0, t, 0.05); return; }
  if (!A.beatBus) {
    A.beatBus = A.gain(0); A.beatIn = A.filt('highpass', 45, 0.7); A.beatLp = A.filt('lowpass', 6500, 0.6);
    A.beatIn.connect(A.beatLp); A.beatLp.connect(A.beatBus); A.beatBus.connect(A.car);
  }
  A.beatBus.gain.setTargetAtTime(mode === 'menu' ? 0.26 : 0.32, t, 0.1);
  const sd = 60 / BEAT.bpm / 4;
  if (!A.beatNext || A.beatNext < t - 0.2) { A.beatNext = t + 0.05; A.beatStep = 0; }
  while (A.beatNext < t + 0.12) { beatStep(c, A.beatNext, A.beatStep, sd); A.beatNext += sd; A.beatStep = (A.beatStep + 1) % 64; }
}
function beatStep(c, w, st, sd) {
  const s = st % 16, bar = (st / 16) | 0, out = A.beatIn, root = BEAT.roots[bar];
  if (s === 0 || s === 8) { // kick
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(110, w); o.frequency.exponentialRampToValueAtTime(42, w + 0.12);
    g.gain.setValueAtTime(0.0001, w); g.gain.linearRampToValueAtTime(0.5, w + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, w + 0.3);
    o.connect(g); g.connect(out); o.start(w); o.stop(w + 0.32);
    A.kicks = (A.kicks || []).filter(k => k > c.currentTime - 1); A.kicks.push(w);
  }
  if (s === 0 || s === 8 || s === 14) beatTone(c, w, s === 8 ? root * 1.5 : s === 14 ? root * 2 : root, s === 14 ? sd * 1.6 : sd * 5, 0.36, 300, true);
  if (s % 4 === 0) sfx.burst(w, 0.11, 'bandpass', 4200, 1.6, 0.05, 0.03, out);                 // güiro: a long scrape on the beat,
  else if (s % 4 >= 2) sfx.burst(w, 0.035, 'bandpass', 4800, 1.8, 0.04, 0.004, out);          // two short ones after it
  if (s % 4 === 2) for (const f of BEAT.chords[bar]) beatTone(c, w, f, sd * 1.4, 0.035, 1800, false);
  if (s === 7 || s === 15) sfx.toneAt(w, 196, 0.14, 'sine', 0.12, 170, out);                  // conga
  if (s === 6) sfx.toneAt(w, 262, 0.1, 'sine', 0.09, 230, out);
}
function beatTone(c, w, f, d, vol, cut, bass) {
  const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = bass ? 'sine' : 'square'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cut;
  o.connect(lp);
  let o2 = null; if (bass) { o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = f; const g2 = c.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(lp); o2.start(w); o2.stop(w + d + 0.3); }
  g.gain.setValueAtTime(0.0001, w); g.gain.linearRampToValueAtTime(vol, w + (bass ? 0.01 : 0.006));
  if (bass) g.gain.setTargetAtTime(0.0001, w + d * 0.6, d * 0.25); else g.gain.exponentialRampToValueAtTime(0.0001, w + d);
  lp.connect(g); g.connect(A.beatIn); o.start(w); o.stop(w + d + 0.3);
}
// how far the speaker cones stand out right now (m): a kick throws them out, they settle back
function spkPump() {
  if (!A.ctx || !A.kicks || !A.beatNext) return 0;
  const t = A.ctx.currentTime; let p = 0;
  for (const k of A.kicks) if (k <= t) p = Math.max(p, Math.exp(-(t - k) * 13));
  return p * 0.014;
}
function updateAudio(dt) {
  if (!A.ctx || !A.voice) return;
  const c = A.ctx, t = c.currentTime, Vc = A.voice, V = Vc.V, E = P.engine;
  const racing = mode === 'race' || mode === 'countdown';
  // menu preview of the customisation: the car's own engine blips the throttle, then lifts
  let pv = false;
  if (A.rev > 0 && !racing && mode !== 'done') {
    A.rev -= dt; pv = A.rev > 0; const u = REV_T - A.rev, on = u > 0.15 && u < 0.85;
    A.revRpm += ((on ? E.redline * 0.88 : E.idle) - A.revRpm) * (1 - Math.exp(-dt * (on ? 4.5 : 1.5)));
    A.revB = on ? Math.min(1, A.revB + dt * 2.2) : A.revB * Math.exp(-dt * 3); A.revThr = on ? 1 : 0;
  } else A.rev = 0;
  const active = racing || mode === 'done' || pv;
  const rpm = pv ? A.revRpm : car.rpm, thr = racing ? car.thrE || input.thr : pv ? A.revThr : 0, boost = pv ? A.revB : car.boost;
  const tune = getTune(P.id), sport = tune.exhaust === 'sport';
  const lim = car.limiter > 0 ? 0.35 : 1;
  A.pz.gain.setTargetAtTime(mode === 'paused' ? 0 : 1, t, mode === 'paused' ? 0.03 : 0.08);
  updateBeat(c, t);
  // ---- where the car is for the listener (the camera) ----
  buildReverb();
  const onboard = settings.cam === 2 && racing;
  const ldx = vis.x - cam.pos[0], ldy = vis.y + 0.6 - cam.pos[1], ldz = vis.z - cam.pos[2], dist = Math.max(0.5, Math.hypot(ldx, ldy, ldz));
  const cfx = cam.look[0] - cam.pos[0], cfz = cam.look[2] - cam.pos[2], cfl = Math.hypot(cfx, cfz) || 1, crx = -cfz / cfl, crz = cfx / cfl;
  if (dt > 0) {
    if (A.camPrev) for (let a = 0; a < 3; a++) A.camVel[a] += (clamp((cam.pos[a] - A.camPrev[a]) / dt, -90, 90) - A.camVel[a]) * Math.min(1, dt * 10);
    A.camPrev = cam.pos.slice();
  }
  // doppler: the car's speed away from the listener (only really moves off 1 on the TV camera, the others travel with it)
  const vr = ((car.vx - A.camVel[0]) * ldx + (car.vz - A.camVel[2]) * ldz) / dist;
  A.dopp += (clamp(343 / (343 + (racing || mode === 'done' ? vr : 0)), 0.82, 1.22) - A.dopp) * Math.min(1, dt * 6);
  const dk = dist <= 9 ? 1 : Math.pow(9 / dist, 0.9);
  A.car.gain.setTargetAtTime(dk, t, 0.05);
  A.carLp.frequency.setTargetAtTime(clamp(20000 / (1 + Math.pow(dist / 40, 1.5)), 900, 20000), t, 0.06);
  if (A.carPan.pan) A.carPan.pan.setTargetAtTime(clamp((ldx * crx + ldz * crz) / dist * 0.9, -0.85, 0.85), t, 0.05);
  netAudio(dt, t, crx, crz, onboard);
  if (Vc.wk) {
    const pr = Vc.prm;
    pr.get('rpm').setTargetAtTime(rpm * A.dopp, t, 0.012);
    pr.get('load').setTargetAtTime(active ? thr : 0, t, 0.03);
    pr.get('boost').setTargetAtTime(boost, t, 0.05);
    pr.get('cut').setTargetAtTime(racing && (car.limiter > 0 || car.shiftT > 0) ? 1 : 0, t, 0.006);
    // overrun crackle: a little on any car, more with anti-lag, a lot with the sport exhaust just after a lift
    const pop = (sport ? 0.3 : V.antilag > 0 ? 0.1 : 0.04) + (A.alT > 0 ? (sport ? 0.6 : 0.25 * V.antilag) : 0);
    if (pr.get('pop')) pr.get('pop').setTargetAtTime(pop, t, 0.05);
    pr.get('inside').setTargetAtTime(settings.cam === 2 ? 1 : 0, t, 0.1);
    Vc.eg.gain.setTargetAtTime(active ? Vc.EN.gain * (0.75 + (rpm / E.redline) * 0.35) * (1.45 - 0.45 * thr) : 0, t, 0.03);
  } else {
    const f0 = rpm / 60;
    for (const o of Vc.oscs) o.o.frequency.setTargetAtTime(f0 * o.ord * A.dopp, t, 0.01);
    Vc.lfo.frequency.setTargetAtTime(f0 * V.amRate, t, 0.02);
    Vc.lp.frequency.setTargetAtTime(V.lp[0] + thr * (V.lp[1] - V.lp[0]) + rpm * 0.12, t, 0.03);
    Vc.eg.gain.setTargetAtTime(active ? (0.06 + thr * 0.12 + (rpm / E.redline) * 0.05) * lim : 0, t, 0.025);
    Vc.ib.frequency.setTargetAtTime(800 + rpm * 0.28, t, 0.05);
    Vc.ig.gain.setTargetAtTime(active ? V.induct * thr * (rpm / E.redline) * (0.5 + boost) : 0, t, 0.04);
  }
  Vc.tw.frequency.setTargetAtTime((1500 + boost * 5400) * A.dopp, t, 0.05);
  Vc.tg.gain.setTargetAtTime(active ? boost * V.turbo * (0.4 + thr) : 0, t, 0.06);
  if (Vc.tng) {
    Vc.tbp.frequency.setTargetAtTime(2200 + boost * 4200, t, 0.05);
    Vc.tng.gain.setTargetAtTime(active ? boost * thr * V.turbo * 4 : 0, t, 0.06);
  }
  const spd = Math.hypot(car.vx, car.vz);
  Vc.wh.frequency.setTargetAtTime(Math.max(40, Math.abs(car.vF) / C.RW / (2 * Math.PI) * P.final * 34), t, 0.03);
  // straight-cut gears sing loudest on the overrun, when the load comes off the teeth
  Vc.whg.gain.setTargetAtTime(active ? V.whine * clamp(spd / 22, 0, 1) * (car.gear > 0 ? 1 : 0) * (1 + 0.9 * (1 - thr)) : 0, t, 0.05);
  // surfaces (a city is paved from kerb to kerb, off the route too)
  const sid = W.st.kind, paved = !!W.st.tarmac && (car.onRoad || !!W.st.town);
  let gv = 0, sv = 0;
  if (active && !car.air) {
    const base = paved ? 0.03 : car.onRoad ? (sid === 'pine' ? 0.22 : sid === 'frost' ? 0.12 : 0.03) : 0.26;
    gv = clamp(spd / 32, 0, 1) * base + clamp(car.slip / 10, 0, 1) * (paved ? 0 : 0.15);
    if (paved || (sid === 'frost' && car.onRoad)) sv = clamp((car.slip - 2.5) / 7, 0, 1) * (paved ? 0.22 : 0.08);
  }
  A.gbp.frequency.setTargetAtTime(sid === 'frost' ? 650 : paved ? 500 : 1100, t, 0.1);
  if (A.cr) {
    // stones under the tyres: click rate follows speed and sliding; snow gives a softer, duller crunch
    const loose = !paved;
    const rate = active && !car.air && loose ? clamp(spd * 14 + car.slip * 90, 0, 2600) : 0;
    A.cr.parameters.get('rate').setTargetAtTime(rate, t, 0.05);
    A.cr.parameters.get('decay').setTargetAtTime(sid === 'frost' ? 0.007 : 0.0025, t, 0.1);
    A.crbp.frequency.setTargetAtTime(sid === 'frost' ? 900 : 1900, t, 0.1);
    A.crlp.frequency.setTargetAtTime(sid === 'frost' ? 2600 : 6000, t, 0.1);
    A.crg.gain.setTargetAtTime(rate > 0 ? (sid === 'frost' ? 0.5 : 0.65) * (car.onRoad ? 1 : 1.3) : 0, t, 0.05);
    gv *= 0.6; // the noise bed stays underneath as the rumble
  }
  A.gg.gain.setTargetAtTime(gv, t, 0.05); A.sg.gain.setTargetAtTime(sv * 0.6, t, 0.05);
  const sq = active && !car.air && paved ? clamp((car.slip - 2.2) / 6, 0, 1) : 0;
  A.sqo.frequency.setTargetAtTime(760 + clamp(car.slip, 0, 12) * 18 + (Math.random() - 0.5) * 70, t, 0.02);
  A.sqg.gain.setTargetAtTime(sq * 0.07, t, 0.04);
  A.wg.gain.setTargetAtTime(active ? Math.pow(spd / 55, 2) * 0.16 + (S.E.blizzard ? 0.05 : 0) : S.E.blizzard ? 0.03 : 0, t, 0.1);
  const wetOn = S.E.rain ? 1 : 0;
  A.rng.gain.setTargetAtTime(wetOn * (settings.cam === 2 && racing ? 0.05 : 0.03), t, 0.3);
  A.wsg.gain.setTargetAtTime(wetOn && active && !car.air ? clamp(spd / 30, 0, 1.2) * 0.08 : 0, t, 0.08);
  // rubbing a canyon wall or a snowbank
  // or another car: panels grinding along each other
  const wallS = active && car.bankP > 0.05 ? clamp(car.bankP * 2, 0, 1) * clamp(spd / 18, 0, 1) : 0, carS = active && netRun() ? carFx.lvl || 0 : 0;
  const soft = W.st.bank && wallS >= carS;
  A.scbp.frequency.setTargetAtTime(soft ? 700 : carS > wallS ? 1100 + Math.random() * 1400 : 1500 + Math.random() * 700, t, 0.03);
  A.scg.gain.setTargetAtTime(soft ? wallS * 0.35 : Math.max(wallS, carS) * 0.55, t, 0.04);
  // ---- the place: reverb send, the gorge's slapback, gravel in the arches, stones off the floor ----
  const inGorge = W.T.walls.some(w => car.s > w.s0 - 15 && car.s < w.s1 + 15);
  A.revIn.gain.setTargetAtTime((A.revWet || 0.15) * (onboard ? 0.35 : 1), t, 0.3);
  // the city's building fronts ~8 m off the road on both sides: a slapback there and back (~47 ms)
  const town = !!W.st.town;
  A.slap.delayTime.setTargetAtTime(town ? 0.047 : W.st.rows ? 0.05 : 0.042, t, 0.2);
  A.slapIn.gain.setTargetAtTime(onboard ? 0.05 : inGorge ? 0.3 : town ? 0.2 : W.st.rows ? 0.07 : 0, t, 0.25);
  const looseGround = !paved;
  if (A.sp) {
    const srate = active && !car.air && looseGround ? clamp(spd * 9 + car.slip * 110 + car.wheelspin * 180, 0, 3600) : 0;
    A.sp.parameters.get('rate').setTargetAtTime(srate, t, 0.05);
    A.sp.parameters.get('decay').setTargetAtTime(sid === 'frost' ? 0.0035 : 0.0011, t, 0.1);
    A.spbp.frequency.setTargetAtTime(sid === 'frost' ? 1700 : S.E.wet ? 2600 : 3600, t, 0.1);
    A.spg.gain.setTargetAtTime(srate > 0 ? (sid === 'frost' ? 0.11 : 0.18) * (onboard ? 1.7 : 1) * (car.onRoad ? 1 : 1.25) : 0, t, 0.05);
  }
  if (active && racing && !car.air && looseGround && sid !== 'frost') {
    A.stoneT += dt * spd / 26 * (1 + car.slip / 5 + car.wheelspin / 3);
    while (A.stoneT >= 1) { A.stoneT -= 1 + Math.random(); sfx.stone(); }
  }
  // handbrake: the hydraulic lever thunks as it goes up
  if (racing && input.hb && !A.hbPrev) sfx.burst(t, 0.05, 'bandpass', 700, 2, 0.07);
  A.hbPrev = racing && input.hb;
  // ---- the crowd: louder the more fans are close to you, and when the car is passing them ----
  let cw = 0, cx = 0, ex = 0;
  if (S && S.fans) for (const f of S.fans) {
    const fx2 = f.x - cam.pos[0], fz2 = f.z - cam.pos[2], d = Math.hypot(fx2, fz2); if (d > 110) continue;
    const w = Math.exp(-d / 24); cw += w; cx += w * (fx2 * crx + fz2 * crz) / Math.max(d, 1); ex += w * f.jump;
  }
  // only out on the stage: in the menu the start-line crowd stays quiet
  const crowdL = (1 - Math.exp(-cw / 3)) * (racing || mode === 'done' ? 1 : 0), excite = cw > 0 ? ex / cw : 0;
  A.crowd.gain.setTargetAtTime(crowdL * (0.18 + 0.32 * excite) * (onboard ? 0.6 : 1), t, 0.25);
  if (A.crowdPan.pan) A.crowdPan.pan.setTargetAtTime(cw > 0 ? clamp(cx / cw, -0.8, 0.8) : 0, t, 0.2);
  if (A.cl) A.cl.parameters.get('rate').setTargetAtTime(crowdL > 0.02 ? 25 + 170 * excite : 0, t, 0.2);
  A.voxT -= dt; if (A.voxT <= 0) { A.voxT = 0.12 + Math.random() * 0.2; A.vox.gain.setTargetAtTime(crowdL > 0.02 ? (0.03 + 0.2 * excite) * (0.6 + 0.8 * Math.random()) : 0, t, 0.08); }
  if (crowdL > 0.25 && excite > 0.35 && (racing || mode === 'done')) {
    A.whistleT -= dt * excite * 1.4; if (A.whistleT <= 0) { A.whistleT = 0.6 + Math.random() * 1.6; sfx.whistle(cw > 0 ? cx / cw + (Math.random() - 0.5) * 0.5 : 0); }
    A.hornT -= dt; if (A.hornT <= 0 && Math.random() < dt * 1.2) { A.hornT = 2.5 + Math.random() * 3; sfx.horn(cw > 0 ? cx / cw : 0); }
  }
  // ---- ambience ----
  A.gustT -= dt; if (A.gustT <= 0) { A.gustT = 1.2 + Math.random() * 3; A.gustTo = Math.random(); }
  A.gust += ((A.gustTo || 0.4) - A.gust) * Math.min(1, dt * 0.8);
  const night = W.st.cond === 'night', rain = W.st.cond === 'rain', amb = onboard ? 0.45 : 1;
  const windK = (sid === 'mesa' ? 0.05 : sid === 'frost' ? (S.E.blizzard ? 0.1 : 0.05) : W.st.rows || sid === 'city' ? 0.02 : 0.03) * (night ? 0.7 : 1);
  const out = racing || mode === 'done'; // the menu only keeps a soft breeze
  A.ambW.gain.setTargetAtTime(windK * (0.35 + 0.9 * A.gust) * amb * (out ? 1 : 0.4), t, 0.4);
  A.ambWlp.frequency.setTargetAtTime(380 + A.gust * 600, t, 0.5);
  if (out && night && sid !== 'frost' && sid !== 'city') for (let k = 0; k < 3; k++) { A.crickT[k] -= dt; if (A.crickT[k] <= 0) { A.crickT[k] = A.crickP[k] * (0.9 + Math.random() * 0.2); sfx.cricket(k); } }
  if (out && !night && !rain && sid === 'pine') { A.birdT -= dt; if (A.birdT <= 0) { A.birdT = 2.5 + Math.random() * 6; if (Math.random() < 0.85) sfx.bird(); } }
  if (out && !night && sid === 'mesa') { A.hawkT -= dt; if (A.hawkT <= 0) { A.hawkT = 18 + Math.random() * 30; sfx.hawk(); } }
  if (out && rain && sid !== 'frost') { A.thunderT -= dt; if (A.thunderT <= 0) { A.thunderT = 25 + Math.random() * 40; sfx.thunder(); } }
  // events
  if (racing || pv) {
    const dump = amt => { if (tune.dump === 'flutter') sfx.flutter(amt, boost); else sfx.bov(amt); };
    // a bang from the exhaust: through the engine model when it runs (it fires with the next cylinder), else a sample
    const bang = size => {
      if (Vc.wk) Vc.wk.port.postMessage({ bang: size }); else sfx.pop(size > 0.8, size < 0.5);
      if (size >= 0.5) flameT = size > 0.8 ? 0.09 : 0.055;
    };
    // pressure the valve can let go: it builds while the throttle is held on boost and the dump spends it,
    // so blipping or tapping the throttle doesn't vent every time
    const held = A.holdT || 0; // how long the throttle had been held, before this frame's lift resets it
    if (thr > 0.6) { A.holdT = held + dt; A.press = (A.press || 0) + (boost - (A.press || 0)) * Math.min(1, dt * 2.5); }
    else { if (thr < 0.3) A.holdT = 0; A.press = Math.max(0, (A.press || 0) - dt * 1.5); }
    A.dumpT = (A.dumpT || 0) - dt;
    const canDump = () => A.press > 0.3 && held > 0.3 && A.dumpT <= 0;
    const spend = k => { dump(A.press * k); A.press *= 1 - k; A.dumpT = 0.5; };
    // a lift = the throttle closing from over half within ~0.3 s (analogue pedals and the AI don't snap shut in one frame)
    A.thrPk = Math.max(thr, (A.thrPk || 0) - dt * 2.5);
    if (A.thrPk > 0.5 && thr < 0.1) {
      A.thrPk = 0;
      // the boost has to go somewhere: out of the valve, or back through the turbo
      if (canDump()) spend(1);
      A.holdT = 0;
      if (V.antilag > 0 && rpm > 3800) A.alT = 0.5 + V.antilag * 0.8;
      else if (sport && rpm > 3200) A.alT = 0.8 + Math.random() * 0.5;
      else if (rpm > 5000) bang(0.45);
    }
    if (A.alT > 0) {
      A.alT -= dt;
      if (thr < 0.1 && rpm > 2800) {
        // anti-lag: the big bangs (the crackle in between comes from the engine model's 'pop')
        if (V.antilag > 0) { A.popT -= dt; if (A.popT <= 0) { bang(Math.random() < 0.3 ? 1 : 0.6); A.popT = 0.06 + Math.random() * 0.14 / V.antilag; } }
      } else A.alT = 0;
    }
    if (racing) {
      if (car.limiter > 0 && (V.antilag > 0.5 || sport) && Math.random() < dt * 8) bang(V.antilag > 0.5 ? 0.6 : 0.35);
      if (evt.shift) {
        if (P.gearbox.type === 'Sequential') sfx.clack();
        if (V.antilag > 0.5 && Math.random() < 0.7) bang(Math.random() < 0.4 ? 1 : 0.6);
        else if (sport && Math.random() < 0.6) bang(0.35);
        if (P.gearbox.type !== 'Sequential' && canDump()) spend(0.55); // the lift for an H-pattern change
      }
    }
  }
  if (evt.land > 3.5) sfx.thump(evt.land);
}

// ---------- co-driver ----------
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /en[-_]GB/i.test(v.lang) && /male|daniel|arthur|george/i.test(v.name)) || vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
let speakQ = 0;
function warmSpeech() { if (!('speechSynthesis' in window)) return; try { const u = new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); } catch (e) { /* ignore */ } }
function say(text) {
  if (!settings.voice || !('speechSynthesis' in window)) return;
  try {
    if (speakQ > 1) { speechSynthesis.cancel(); speakQ = 0; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.28; u.pitch = 0.95; u.volume = 1;
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
    u.onend = u.onerror = () => { speakQ = Math.max(0, speakQ - 1); };
    speakQ++;
    speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable */ }
}
function noteWords(n) {
  if (n.kind === 'jump') return 'Jump!';
  if (n.kind === 'crest') return 'Over crest';
  let t = `${n.dir > 0 ? 'Left' : 'Right'} ${n.sev === 'H' ? 'hairpin' : n.sev === 'Q' ? 'square' : n.sev}`;
  if (n.mods.includes('long')) t += ' long';
  if (n.mods.includes('dc')) t += ", don't cut";
  if (n.mods.includes('cau')) t += ', caution';
  return t;
}
function callNotes() {
  const T = W.T, v = Math.max(12, car.vF);
  const lead = 40 + v * 2.7;
  while (noteIdx < T.notes.length && T.notes[noteIdx].s < car.s + lead) {
    const n = T.notes[noteIdx]; noteIdx++;
    if (n.end < car.s) continue;
    let text = noteWords(n);
    called.push(n);
    if (n.into && noteIdx < T.notes.length) {
      const m = T.notes[noteIdx]; noteIdx++; called.push(m); m.wasInto = true;
      text += ', into ' + noteWords(m) + (m.dist ? ', ' + m.dist : '');
    } else if (n.dist) text += ', ' + n.dist;
    say(text);
  }
  called = called.filter(n => n.end > car.s - 4);
}
function noteIcon(n) {
  const stroke = 'var(--paper)';
  if (n.kind === 'jump') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 52h22l12-14" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 32q8-16 16-2" fill="none" stroke="var(--signal)" stroke-width="4" stroke-dasharray="4 5" stroke-linecap="round"/><path d="M40 52h18" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/></svg>`;
  if (n.kind === 'crest') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 50q28-36 56 0" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/><path d="M32 8v14m-6-6 6 6 6-6" fill="none" stroke="var(--signal)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const A = { 6: 22, 5: 40, 4: 62, 3: 88, 2: 112, 1: 140, H: 178, Q: 90 }[n.sev] * Math.PI / 180;
  const r = { 6: 60, 5: 34, 4: 23, 3: 17, 2: 14, 1: 11, H: 9, Q: 5 }[n.sev];
  const sgn = n.dir > 0 ? -1 : 1;
  let x = 0, y = 0, th = 0; const pts = [[0, 0]]; y -= 14; pts.push([x, y]);
  const steps = 16, ds = r * A / steps;
  for (let i = 1; i <= steps; i++) { th = A * i / steps; x += Math.sin(th - A / steps / 2) * sgn * ds; y -= Math.cos(th - A / steps / 2) * ds; pts.push([x, y]); }
  const dx = Math.sin(th) * sgn, dy = -Math.cos(th);
  const hx = x + dx * 9, hy = y + dy * 9, px = -dy, py = dx;
  const head = [[hx, hy], [x + px * 8, y + py * 8], [x - px * 8, y - py * 8]];
  const all = pts.concat(head);
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; for (const [a, b] of all) { mnx = Math.min(mnx, a); mxx = Math.max(mxx, a); mny = Math.min(mny, b); mxy = Math.max(mxy, b); }
  const sz = Math.max(mxx - mnx, mxy - mny) + 14, cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  const vb = `${(cx - sz / 2).toFixed(1)} ${(cy - sz / 2).toFixed(1)} ${sz.toFixed(1)} ${sz.toFixed(1)}`;
  const d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  const hd = 'M' + head.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
  return `<svg viewBox="${vb}" aria-hidden="true"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="${hd}" fill="var(--signal)"/></svg>`;
}
function noteHTML(n, cls) {
  let dir = '', sev = '';
  if (n.kind === 'jump') { dir = 'Caution'; sev = 'Jump'; }
  else if (n.kind === 'crest') { dir = 'Over'; sev = 'Crest'; }
  else { dir = n.dir > 0 ? 'Left' : 'Right'; sev = n.sev === 'H' ? 'Hairpin' : n.sev === 'Q' ? 'Square' : String(n.sev); }
  const mods = [];
  if (n.mods.includes('dc')) mods.push(`<span>Don't cut</span>`);
  if (n.mods.includes('cau')) mods.push(`<span>Caution</span>`);
  if (n.mods.includes('long')) mods.push(`<span class="soft">Long</span>`);
  if (n.into) mods.push(`<span class="soft">Into</span>`);
  if (n.dist) mods.push(`<span class="soft">${n.dist}</span>`);
  return `<div class="note ${cls}">${noteIcon(n)}<div class="w"><span class="dir">${dir}</span><span class="sev">${sev}</span>${mods.length ? `<div class="mods">${mods.join('')}</div>` : ''}</div></div>`;
}
let noteKey = '';
function updateNoteCards() {
  const show = called.filter(n => n.end > car.s).slice(0, 2);
  const key = show.map(n => n.s).join(',');
  if (key === noteKey) return;
  noteKey = key;
  $('notes').innerHTML = show.map((n, i) => noteHTML(n, i ? 'next' : 'now')).join('');
}

// ---------- vehicle visuals ----------
// Body rides on a spring-damper (heave, pitch, roll); each wheel follows the ground under it within its travel.
const vis = { x: 0, y: 0, z: 0, h: 0, spin: 0, steer: 0, lastVF: 0, aLong: 0, gp: 0, gr: 0, gy: 0 };
const susp = { heave: 0, hv: 0, pitch: 0, pv: 0, roll: 0, rv: 0, wy: [0.335, 0.335, 0.335, 0.335], gh: [0, 0, 0, 0], surf: [0, 0, 0, 0] };
const carMat = M4.create(), tmpM = M4.create(), wheelM = M4.create(), shadowM = M4.create();
function snapVis(keepCam) {
  vis.x = prev.x = car.x; vis.y = prev.y = car.y; vis.z = prev.z = car.z; vis.h = prev.h = car.h;
  vis.lastVF = car.vF; vis.aLong = 0;
  susp.heave = susp.hv = susp.pitch = susp.pv = susp.roll = susp.rv = 0;
  for (let i = 0; i < 4; i++) susp.wy[i] = 0.335;
  vis.gy = car.y; vis.gp = 0; vis.gr = 0;
  cam.snap = true;
}
function savePrev() { prev.x = car.x; prev.y = car.y; prev.z = car.z; prev.h = car.h; }
// wheel centres: half the track from the body width, or per axle (the F1's tF / tR)
const halfTrack = (sh, i) => (i < 2 ? sh.tF : sh.tR) || sh.W / 2 - 0.13;
const wheelMesh = (m, i) => i < 2 || !m.wheelR ? m.wheel : m.wheelR;
function wheelLocal(i) { const sh = carModel.shape; return [(i % 2 ? -1 : 1) * halfTrack(sh, i), i < 2 ? carModel.fz : carModel.rz]; }
function surfBump(x, z, surf) {
  const sid = W.st.kind;
  const amp = surf === 0 || W.st.town ? (W.st.tarmac ? 0.004 : sid === 'pine' ? 0.026 : sid === 'frost' ? 0.016 : 0.004) : surf === 1 ? 0.03 : 0.042;
  return amp * (W.nz.n2(x * 0.9, z * 0.9) * 0.65 + W.nz.n2(x * 2.6 + 9, z * 2.6) * 0.35);
}
function updateVis(dt) {
  vis.x = lerp(prev.x, car.x, alpha); vis.y = lerp(prev.y, car.y, alpha); vis.z = lerp(prev.z, car.z, alpha);
  vis.h = prev.h + wrapA(car.h - prev.h) * alpha;
  const c = Math.cos(vis.h), sn = Math.sin(vis.h), T = W.T;
  let flat = 0;
  for (let i = 0; i < 4; i++) {
    const [lx, lz] = wheelLocal(i);
    const wx = vis.x + lx * c + lz * sn, wz = vis.z - lx * sn + lz * c;
    const latW = Math.abs(car.lat + (wx - car.x) * car.rd.rx + (wz - car.z) * car.rd.rz);
    const surf = T.ru ? (latW < C.paveEdge(T, car.idx, car.lat) + 0.2 ? 0 : C.inGravel(T, car.idx, Math.sign(car.lat || 1) * latW) ? 1 : 2)
      : latW < T.hw + 0.2 ? 0 : latW < T.hw + 1.7 ? 1 : 2;
    susp.surf[i] = surf;
    const g = C.groundAt(W, car, wx, wz);
    flat += g;
    susp.gh[i] = g + surfBump(wx, wz, surf);
  }
  const gh = susp.gh, fz0 = carModel.fz, rz0 = carModel.rz, hx = wheelLocal(0)[0];
  vis.gp = -Math.atan2((gh[0] + gh[1]) / 2 - (gh[2] + gh[3]) / 2, fz0 - rz0);
  vis.gr = Math.atan2((gh[0] + gh[2]) / 2 - (gh[1] + gh[3]) / 2, 2 * hx);
  vis.gy = flat / 4;
  // load transfer
  const aL = dt > 0 ? (car.vF - vis.lastVF) / dt : 0; vis.lastVF = car.vF;
  vis.aLong += (clamp(aL, -14, 14) - vis.aLong) * Math.min(1, dt * 6);
  const aLat = car.air ? 0 : car.vF * car.w;
  if (!car.air) {
    const tP = vis.gp + clamp(-vis.aLong * 0.006, -0.055, 0.065);
    const tR = vis.gr + clamp(aLat * 0.0075, -0.08, 0.08);
    const tH = (gh[0] + gh[1] + gh[2] + gh[3]) / 4 - vis.y;
    susp.pv += (150 * (tP - susp.pitch) - 13 * susp.pv) * dt; susp.pitch += susp.pv * dt;
    susp.rv += (150 * (tR - susp.roll) - 13 * susp.rv) * dt; susp.roll += susp.rv * dt;
    susp.hv += (170 * (tH - susp.heave) - 14 * susp.hv) * dt; susp.heave += susp.hv * dt;
    // bump stops: with the wheels on the ground the body can only move so far relative to it
    const pc = clamp(susp.pitch, vis.gp - 0.07, vis.gp + 0.08); if (pc !== susp.pitch) { susp.pitch = pc; susp.pv *= 0.25; }
    const rc = clamp(susp.roll, vis.gr - 0.09, vis.gr + 0.09); if (rc !== susp.roll) { susp.roll = rc; susp.rv *= 0.25; }
    const hc = clamp(susp.heave, tH - 0.12, tH + 0.1); if (hc !== susp.heave) { susp.heave = hc; susp.hv *= 0.25; }
  } else {
    susp.pv *= Math.exp(-dt * 2); susp.rv *= Math.exp(-dt * 2);
    susp.pitch += (susp.pv + 0.14) * dt; susp.roll += susp.rv * dt;
    susp.pitch = Math.min(susp.pitch, 0.26);
    susp.hv += (170 * (0 - susp.heave) - 14 * susp.hv) * dt; susp.heave += susp.hv * dt;
  }
  if (evt.land > 2.5) { susp.hv -= Math.min(2.4, evt.land * 0.24); susp.pv += (Math.random() - 0.35) * Math.min(0.8, evt.land * 0.06); }
  // past ~65 km/h the drawn spin rate eases off (the blur discs take over), which keeps the spokes from strobing backwards
  const wr = car.vF / 0.335, wa = Math.abs(wr);
  vis.spin += Math.sign(wr) * (wa < 15 ? wa : 15 + (wa - 15) * 0.25) * dt;
  if (car.air && car.thrE > 0.5) vis.spin += 30 * dt;
  if (car.spinV > 0.5) vis.spin += car.spinV / 0.335 * dt;
  // the front wheels show the angle the physics uses, so in a slide they visibly countersteer into it
  vis.steer += ((car.delta || 0) - vis.steer) * Math.min(1, dt * 14);
  M4.trs(carMat, vis.x, vis.y + susp.heave + 0.02, vis.z, vis.h, susp.pitch, susp.roll, 1);
  for (let i = 0; i < 4; i++) {
    const [lx, lz] = wheelLocal(i);
    const by = carMat[1] * lx + carMat[9] * lz + carMat[13];
    const tgt = car.air ? 0.235 : 0.335 + clamp(gh[i] - by, -0.13, 0.1);
    susp.wy[i] += (tgt - susp.wy[i]) * Math.min(1, dt * (car.air ? 7 : 32));
  }
}
function wheelMatrix(i, noSpin) {
  const [x, z] = wheelLocal(i);
  M4.trs(tmpM, x, susp.wy[i], z, i < 2 ? vis.steer : 0, noSpin ? 0 : vis.spin, 0, 1);
  return M4.mul(wheelM, carMat, tmpM);
}
function wheelWorld(i) {
  const [lx, lz] = wheelLocal(i), c = Math.cos(vis.h), sn = Math.sin(vis.h);
  return [vis.x + lx * c + lz * sn, susp.gh[i], vis.z - lx * sn + lz * c];
}
// contact shadow: soft dark footprint that grounds the car, fading when airborne
let csMesh = null, csTex = null;
function buildContactShadow() {
  const sh = carModel.shape, z0 = sh.zr - 0.35, z1 = sh.zf + 0.35, hw = sh.W / 2 + 0.28;
  const cw = 64, ch = 128, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'), img = g.createImageData(cw, ch);
  const wheels = [0, 1, 2, 3].map(wheelLocal);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const lx = (x / (cw - 1) * 2 - 1) * hw, lz = z1 - y / (ch - 1) * (z1 - z0);
    const qx = Math.abs(lx) - (sh.W / 2 - 0.25), qz = Math.abs(lz - (z0 + z1) / 2) - ((z1 - z0) / 2 - 0.6);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 0.25;
    let a = 0.62 * (1 - C.sstep(-0.35, 0.3, d));
    for (const [wx, wz] of wheels) { const dd = Math.hypot((lx - wx) / 0.2, (lz - wz) / 0.34); a = Math.max(a, 0.95 * Math.exp(-dd * dd)); }
    const k = (y * cw + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = Math.round(clamp(a, 0, 1) * 255);
  }
  g.putImageData(img, 0, 0);
  if (csMesh) R.disposeMesh(csMesh);
  if (csTex) gl.deleteTexture(csTex);
  csTex = R.texture(cv);
  const q = new GFX.Geo();
  q.quad([hw, 0, z1], [-hw, 0, z1], [-hw, 0, z0], [hw, 0, z0], [1, 1, 1], 0, [0, -1, 0], [[1, 1], [0, 1], [0, 0], [1, 0]]);
  csMesh = R.mesh(q);
}
// dirt builds up on the lower body and wheels as you drive
const DIRT = { pine: { col: lin('#857259'), max: 0.6, rate: 0.03 }, frost: { col: lin('#bcc5d3'), max: 0.42, rate: 0.03 }, mesa: { col: lin('#b08a66'), max: 0.32, rate: 0.012 }, city: { col: lin('#7d7b78'), max: 0.2, rate: 0.008 }, spa: { col: lin('#6f6a5c'), max: 0.22, rate: 0.008 } };
let dirt = 0;
function updateDirt(dt) {
  if (mode !== 'race') return;
  const D = (DIRT[W.st.id] || DIRT[W.st.kind]), spd = Math.hypot(car.vx, car.vz);
  const off = susp.surf[2] + susp.surf[3] > 1 ? 2.4 : 1;
  const r = D.rate * clamp(spd / 25, 0, 1.6) * off + (car.slip > 3 ? 0.012 : 0);
  dirt += (D.max - dirt) * r * dt;
  if (evt.land > 3) dirt = Math.min(D.max, dirt + 0.02);
}

// ---------- camera ----------
const cam = { pos: [0, 5, -10], look: [0, 0, 0], yaw: 0, y: 0, fov: 60, shake: 0, snap: true, tv: null, pull: 0, roll: 0, up: [0, 1, 0], blur: 0 };
let tvSpots = [];
function buildTvSpots() {
  const T = W.T; tvSpots = [];
  const cols = W.O.cols, city = !!W.st.town;
  const blocked = (ax, ay, az, bx, by, bz) => {
    if (C.rayWalls(W, ax, az, bx, bz) < 1) return true;
    const n = 14;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
      const gx = Math.floor(x / C.CELL), gz = Math.floor(z / C.CELL);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const arr = cols.get(C.hkey(gx + a, gz + b)); if (!arr) continue;
        for (const o of arr) {
          if (o.kind !== 'tree' && o.kind !== 'rock') continue;
          // a street tree only hides what is behind its crown (3.4-8.8 m up), not its thin trunk
          const gy = y - C.terrainH(W.TR, o.x, o.z), r = o.kind !== 'tree' ? o.r + 0.6 : !city ? 2.4 : gy < 3.4 ? 0.35 : 1.8;
          if ((x - o.x) ** 2 + (z - o.z) ** 2 < r * r && gy < (o.kind === 'tree' ? (city ? 8.8 : 9) : 2.5)) return true;
        }
      }
      if (C.terrainH(W.TR, x, z) > y - 0.5) return true;
    }
    return false;
  };
  let side = 1;
  for (let s = 70; s < T.L - 30; s += 75) {
    let best = null;
    // in the city: a cameraman on the sidewalk, under the trees, or a first-floor window over them
    for (const sd of [side, -side]) for (const off of city ? [1.4, 2.6] : [6.5, 9, 12]) for (const hgt of city ? [2.2, 9.6] : [4, 7]) {
      if (best) break;
      const p = C.sampleAt(T, s); const rx = -Math.cos(p.h) * sd, rz = Math.sin(p.h) * sd;
      const x = p.x + rx * (T.hw + off), z = p.z + rz * (T.hw + off);
      const y = Math.max(C.terrainH(W.TR, x, z), p.y) + hgt;
      let ok = true;
      for (const ds of city ? [-60, -30, 0, 20] : [-25, 0, 25, 45]) { const q = C.sampleAt(T, s + ds); if (blocked(x, y, z, q.x, q.y + 1, q.z)) { ok = false; break; } }
      if (ok) best = { s, x, y, z };
    }
    if (best) tvSpots.push(best);
    side = -side;
  }
  if (!tvSpots.length) tvSpots.push({ s: 0, x: T.X[0] + 10, y: T.Y[0] + 6, z: T.Z[0] });
}
const camOffsets = [[6.6, 2.35, 2.6], [9.8, 3.5, 3.2]];
let dbgCam = null;
function updateCamera(dt) {
  if (dbgCam) {
    const c = Math.cos(vis.h), sn = Math.sin(vis.h);
    const tw = (o) => [vis.x + o[0] * c + o[2] * sn, vis.y + o[1], vis.z - o[0] * sn + o[2] * c];
    // (world: true puts the camera at world coordinates instead of round the car)
    cam.pos = dbgCam.world ? dbgCam.p.slice() : tw(dbgCam.p); cam.look = dbgCam.world ? dbgCam.l.slice() : tw(dbgCam.l); cam.fov = dbgCam.fov || 40; return;
  }
  const fx = Math.sin(vis.h), fz = Math.cos(vis.h);
  const spd = Math.hypot(car.vx, car.vz);
  let fovT = 60, rollT = 0;
  if (mode === 'menu' || mode === 'loading' || mode === 'boot') {
    const a = time * 0.14 + 2.2;
    const wide = canvas.clientWidth > 760;
    const r = wide ? 9.2 : 9.5;
    cam.pos = [vis.x + Math.sin(a) * r, vis.y + 1.9, vis.z + Math.cos(a) * r];
    const ang = Math.atan2(vis.x - cam.pos[0], vis.z - cam.pos[2]);
    const rgx = -Math.cos(ang), rgz = Math.sin(ang);
    const sh = wide ? -0.4 : 0;
    cam.look = [vis.x + rgx * sh, vis.y + (wide ? 0.5 : -1.0), vis.z + rgz * sh];
    cam.fov = 50; cam.snap = true; cam.roll = 0; cam.pull = 0; cam.blur = 0; cam.up = [0, 1, 0];
    if (W && W.O.walls) {
      const f = C.rayWalls(W, vis.x, vis.z, cam.pos[0], cam.pos[2]);
      if (f < 1) { const k = Math.max(0.25, f - 0.08); cam.pos[0] = vis.x + (cam.pos[0] - vis.x) * k; cam.pos[2] = vis.z + (cam.pos[2] - vis.z) * k; }
    }
    clampCam();
    return;
  }
  const cm = mode === 'done' && doneT > 0.3 ? 3 : settings.cam;
  if (cm === 0 || cm === 1) {
    const [dist0, hgt, ahead] = camOffsets[cm];
    // the car pulls away a little under power and the camera closes in under braking, so g-forces read on screen
    const pullT = car.air ? 0 : clamp(vis.aLong * 0.034, -0.38, 0.46);
    cam.pull += (pullT - cam.pull) * (1 - Math.exp(-dt * (pullT > cam.pull ? 2.2 : 3.5)));
    let dist = dist0 + cam.pull * (cm === 1 ? 1.3 : 1);
    const vdir = spd > 4 ? Math.atan2(car.vx, car.vz) : vis.h;
    const target = vis.h + wrapA(vdir - vis.h) * 0.5;
    if (cam.snap) { cam.yaw = target; cam.y = vis.y + hgt; cam.wallD = dist; }
    cam.yaw += wrapA(target - cam.yaw) * (1 - Math.exp(-dt * (car.air ? 2.5 : 5.5)));
    if (W.O.walls) {
      // between buildings the camera comes in rather than through a wall: at once, then back out gently
      const reach = dist + 0.6, f = C.rayWalls(W, vis.x, vis.z, vis.x - Math.sin(cam.yaw) * reach, vis.z - Math.cos(cam.yaw) * reach);
      cam.wallD = Math.min(Math.max(1.6, f * reach - 0.6), (cam.wallD || dist) + dt * 6);
      dist = Math.min(dist, cam.wallD);
    }
    const cx = vis.x - Math.sin(cam.yaw) * dist, cz = vis.z - Math.cos(cam.yaw) * dist;
    const ty = vis.y + hgt;
    cam.y += (ty - cam.y) * (1 - Math.exp(-dt * (car.air ? 1.4 : 8)));
    cam.pos = [cx, cam.y, cz];
    cam.look = [vis.x + fx * ahead, vis.y + 1.05, vis.z + fz * ahead];
    fovT = 58 + clamp(spd * 0.24, 0, 14);
    // a slight horizon tilt with lateral g (under 2 degrees), never while airborne
    rollT = car.air ? 0 : clamp(car.vF * car.w * 0.0017, -0.03, 0.03);
  } else if (cm === 2) {
    const sh = carModel.shape;
    // the F1's onboard is the camera on top of its airbox, looking over the driver's helmet
    const p = sh.cam ? mulPoint(carMat, 0, sh.cam[0], sh.cam[1]) : mulPoint(carMat, 0, sh.hoodB + 0.22, sh.zW + 0.14), l = mulPoint(carMat, 0, sh.cam ? sh.cam[2] : sh.hoodB + 0.05, 14);
    cam.pos = p; cam.look = l; fovT = 66 + clamp(spd * 0.12, 0, 8);
    rollT = susp.roll * 0.6; // onboard: the camera is bolted to the body, so it rolls with it (partly, for comfort)
  } else {
    // TV / trackside
    if (!cam.tv || car.s > cam.tv.s + 22 || car.s < cam.tv.s - 160) cam.tv = tvSpots.find(t => t.s > car.s + 8) || tvSpots[tvSpots.length - 1];
    if (mode === 'done') {
      const a = time * 0.25; cam.pos = [vis.x + Math.sin(a) * 8.5, vis.y + 2.6, vis.z + Math.cos(a) * 8.5];
      cam.look = [vis.x, vis.y + 0.8, vis.z]; fovT = 48;
    } else {
      cam.pos = [cam.tv.x, cam.tv.y, cam.tv.z];
      cam.look = [vis.x, vis.y + 0.8, vis.z];
      const d = Math.hypot(vis.x - cam.tv.x, vis.z - cam.tv.z);
      fovT = clamp(2 * Math.atan(7 / Math.max(d, 1)) * 180 / Math.PI, 9, 62);
    }
  }
  const asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  if (asp < 1.1 && cm !== 3) fovT *= 1 + clamp(1.1 - asp, 0, 0.65) * 0.6;
  cam.fov += (fovT - cam.fov) * (cam.snap ? 1 : Math.min(1, dt * 4));
  if (evt.land > 3) cam.shake = Math.max(cam.shake, Math.min(0.5, evt.land * 0.04));
  const rough = car.air || (!car.onRoad && !W.st.town) ? 0.03 : (W.st.tarmac ? 0.003 : W.st.kind === 'pine' ? 0.012 : W.st.kind === 'frost' ? 0.007 : 0.003);
  const sk = cam.shake + rough * clamp(spd / 30, 0, 1.5);
  if (cm !== 3 && sk > 0.0005) {
    // smooth multi-sine shake rather than per-frame noise, so it reads as a jolt and not as jitter
    const t = time, s = sk * 0.5;
    cam.pos[0] += (Math.sin(t * 31.7) * 0.6 + Math.sin(t * 53.1 + 1.3) * 0.4) * s;
    cam.pos[1] += (Math.sin(t * 37.3 + 2.1) * 0.6 + Math.sin(t * 61.7) * 0.4) * s;
    cam.pos[2] += (Math.sin(t * 29.9 + 4.2) * 0.6 + Math.sin(t * 47.3 + 0.7) * 0.4) * s;
  }
  cam.shake *= Math.exp(-dt * 6);
  cam.roll += (rollT - cam.roll) * (cam.snap ? 1 : 1 - Math.exp(-dt * 3.5));
  // up vector rolled about the view axis
  const vx = cam.look[0] - cam.pos[0], vy = cam.look[1] - cam.pos[1], vz = cam.look[2] - cam.pos[2];
  const vl = Math.hypot(vx, vy, vz) || 1, rl = Math.hypot(vz, vx) || 1;
  const rx = -vz / rl, rz = vx / rl; // right vector (horizontal)
  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  cam.up = [rx * sr, cr, rz * sr];
  // speed blur at the screen edges, only well above town speed and not on the TV camera
  const blurT = mode === 'race' && cm !== 3 ? clamp((spd - 30) / 25, 0, 1) : 0;
  cam.blur += (blurT - cam.blur) * Math.min(1, dt * 3);
  cam.snap = false;
  clampCam();
}
function clampCam() {
  const th = C.terrainH(W.TR, cam.pos[0], cam.pos[2]);
  const ry = C.roadYAt(W.T, car.s);
  const floor = Math.max(th, Math.abs(car.lat) < W.T.hw + 6 ? ry - 0.2 : th) + 0.6;
  if (cam.pos[1] < floor) { cam.pos[1] = floor; cam.y = Math.max(cam.y, floor); }
}
function mulPoint(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }

// ---------- particles ----------
function makePool(max) {
  const p = new Float32Array(max * 3), v = new Float32Array(max * 3), col = new Float32Array(max * 4), c0 = new Float32Array(max * 4);
  const sz = new Float32Array(max), gr = new Float32Array(max), life = new Float32Array(max), ml = new Float32Array(max), acc = new Float32Array(max), drag = new Float32Array(max);
  const pts = R.points(max);
  const pool = { n: 0, pts,
    emit(x, y, z, vx, vy, vz, size, grow, lf, cc, a, rise, dr) {
      if (pool.n >= max) return;
      const i = pool.n++;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
      c0[i * 4] = cc[0]; c0[i * 4 + 1] = cc[1]; c0[i * 4 + 2] = cc[2]; c0[i * 4 + 3] = a;
      sz[i] = size; gr[i] = grow; life[i] = lf; ml[i] = lf; acc[i] = rise; drag[i] = dr == null ? 1.7 : dr;
    },
    update(dt) {
      for (let i = 0; i < pool.n; i++) {
        life[i] -= dt;
        if (life[i] <= 0) {
          const j = --pool.n;
          if (i !== j) {
            p.copyWithin(i * 3, j * 3, j * 3 + 3); v.copyWithin(i * 3, j * 3, j * 3 + 3); c0.copyWithin(i * 4, j * 4, j * 4 + 4);
            sz[i] = sz[j]; gr[i] = gr[j]; life[i] = life[j]; ml[i] = ml[j]; acc[i] = acc[j]; drag[i] = drag[j];
          }
          i--; continue;
        }
        const k = Math.exp(-drag[i] * dt);
        v[i * 3] *= k; v[i * 3 + 1] = v[i * 3 + 1] * k + acc[i] * dt; v[i * 3 + 2] *= k;
        p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
        sz[i] += gr[i] * dt;
        const f = life[i] / ml[i];
        col[i * 4] = c0[i * 4]; col[i * 4 + 1] = c0[i * 4 + 1]; col[i * 4 + 2] = c0[i * 4 + 2];
        col[i * 4 + 3] = c0[i * 4 + 3] * Math.pow(f, 1.4) * Math.min(1, (ml[i] - life[i]) * 8);
      }
      pts.update(p, col, sz, pool.n);
    },
    clear() { pool.n = 0; },
  };
  return pool;
}
const dust = makePool(1800);   // soft: dust, powder, smoke
const chips = makePool(700);   // hard: gravel, snow chunks, needles, debris, sparks
const emitAcc = [0, 0, 0, 0], chipAcc = [0, 0, 0, 0];
const rnd = () => Math.random() - 0.5;
// surface look per stage: [road, verge, off-road]
const SURF_FX = {
  pine: [{ c: [0.52, 0.44, 0.33], a: 0.27, k: 1, chip: [0.22, 0.18, 0.14] }, { c: [0.46, 0.39, 0.29], a: 0.28, k: 1.1, chip: [0.25, 0.2, 0.15] }, { c: [0.38, 0.35, 0.25], a: 0.2, k: 0.8, chip: [0.16, 0.26, 0.09] }],
  frost: [{ c: [0.95, 0.97, 1.0], a: 0.4, k: 1.05, chip: [0.92, 0.95, 1.0] }, { c: [0.95, 0.97, 1.0], a: 0.45, k: 1.3, chip: [0.92, 0.95, 1.0] }, { c: [0.96, 0.98, 1.0], a: 0.5, k: 1.5, chip: [0.94, 0.96, 1.0] }],
  mesa: [{ c: [0.8, 0.79, 0.78], a: 0.1, k: 0.02, chip: null }, { c: [0.76, 0.56, 0.4], a: 0.28, k: 1.0, chip: [0.45, 0.28, 0.18] }, { c: [0.78, 0.55, 0.38], a: 0.3, k: 1.1, chip: [0.5, 0.3, 0.2] }],
  city: [{ c: [0.8, 0.79, 0.78], a: 0.1, k: 0.02, chip: null }, { c: [0.78, 0.77, 0.75], a: 0.12, k: 0.1, chip: null }, { c: [0.8, 0.79, 0.78], a: 0.1, k: 0.03, chip: null }],
  // a race circuit: [track and run-off, gravel trap, grass]
  spa: [{ c: [0.8, 0.79, 0.78], a: 0.1, k: 0.02, chip: null }, { c: [0.72, 0.65, 0.53], a: 0.3, k: 1.2, chip: [0.55, 0.5, 0.42] }, { c: [0.4, 0.38, 0.27], a: 0.16, k: 0.6, chip: [0.2, 0.3, 0.12] }],
};
// in the rain the wheels throw a fine grey spray (tarmac too) and only a little of the gravel
const SPRAY = { c: [0.8, 0.83, 0.87], a: 0.12, k: 0.75 };
const SURF_WET = {
  pine: [Object.assign({}, SPRAY, { chip: [0.16, 0.13, 0.1] }), Object.assign({}, SPRAY, { c: [0.62, 0.6, 0.55], a: 0.16, k: 0.8, chip: [0.18, 0.14, 0.1] }), { c: [0.36, 0.34, 0.26], a: 0.14, k: 0.6, chip: [0.14, 0.2, 0.08] }],
  mesa: [Object.assign({}, SPRAY, { chip: null }), { c: [0.6, 0.46, 0.36], a: 0.18, k: 0.7, chip: [0.4, 0.25, 0.16] }, { c: [0.6, 0.45, 0.33], a: 0.2, k: 0.8, chip: [0.45, 0.27, 0.18] }],
  city: [Object.assign({}, SPRAY, { chip: null }), Object.assign({}, SPRAY, { chip: null }), Object.assign({}, SPRAY, { chip: null })],
  spa: [Object.assign({}, SPRAY, { chip: null }), { c: [0.55, 0.5, 0.42], a: 0.18, k: 0.8, chip: [0.45, 0.4, 0.33] }, { c: [0.36, 0.34, 0.26], a: 0.14, k: 0.6, chip: [0.14, 0.2, 0.08] }],
};
function emitEffects(dt) {
  if (mode === 'menu' || mode === 'paused') return;
  const sid = W.st.kind, spd = Math.hypot(car.vx, car.vz);
  const FX = (S.E.wet && (SURF_WET[W.st.id] || SURF_WET[sid])) || SURF_FX[W.st.id] || SURF_FX[sid];
  if (!car.air && spd > 1.5) {
    for (let i = 0; i < 4; i++) {
      const rear = i >= 2, f = FX[susp.surf[i]];
      const drive = rear ? 1 - P.drive.front : P.drive.front;
      let rate = (spd * 0.85 + car.slip * (rear ? 3.6 : 1.4) + car.wheelspin * 6 * drive) * f.k * (rear ? 1 : 0.45);
      let smoke = 0;
      if (W.st.tarmac && (susp.surf[i] === 0 || W.st.town) && !S.E.wet) { smoke = clamp((car.slip - 3) / 6, 0, 1) * (rear ? 1 : 0.4); rate += smoke * 24; }
      if (S.E.wet) rate *= clamp(spd / 14, 0.15, 1.4); // spray only really flies at speed
      emitAcc[i] += rate * dt;
      const w = wheelWorld(i);
      while (emitAcc[i] >= 1) {
        emitAcc[i] -= 1;
        dust.emit(w[0] + rnd() * 0.5, w[1] + 0.12 + rnd() * 0.15, w[2] + rnd() * 0.5, car.vx * 0.28 + rnd() * 2, 0.5 + Math.random() * 1.5, car.vz * 0.28 + rnd() * 2,
          0.9 * (0.7 + Math.random() * 0.6), 1.5 + Math.random() * 1.1, (sid === 'frost' ? 1.5 : 2.3) * (0.7 + Math.random() * 0.6),
          smoke > 0.3 && Math.random() < smoke ? [0.86, 0.86, 0.87] : f.c, smoke > 0.3 ? 0.32 : f.a, 0.25);
      }
      // gravel / snow chunks thrown back by spinning or sliding tyres
      if (f.chip && rear) {
        const chipRate = clamp(car.wheelspin * 4 + Math.max(0, car.slip - 3) * 2.5, 0, 30) * (sid === 'frost' ? 0.8 : 1);
        chipAcc[i] += chipRate * dt;
        const fx = Math.sin(vis.h), fz = Math.cos(vis.h);
        while (chipAcc[i] >= 1) {
          chipAcc[i] -= 1;
          chips.emit(w[0] + rnd() * 0.3, w[1] + 0.1, w[2] + rnd() * 0.3, car.vx * 0.4 - fx * (2 + Math.random() * 3) + rnd() * 2.5, 1.2 + Math.random() * 2.6, car.vz * 0.4 - fz * (2 + Math.random() * 3) + rnd() * 2.5,
            sid === 'frost' ? 0.09 : 0.055 + Math.random() * 0.04, 0, 0.55 + Math.random() * 0.3, f.chip, 0.95, -9.8, 0.4);
        }
      }
    }
    if (car.bankP > 0.15 && spd > 5) {
      const lx = Math.cos(vis.h), lz = -Math.sin(vis.h), sg = car.lat > 0 ? -1 : 1;
      if (W.st.bank) for (let i = 0; i < 2; i++) dust.emit(vis.x + lx * sg * 1.2, vis.y + 0.5, vis.z + lz * sg * 1.2, lx * sg * 3 + car.vx * 0.4, 2 + Math.random() * 2, lz * sg * 3 + car.vz * 0.4, 1.0, 2.0, 1.3, [0.96, 0.98, 1], 0.5, -2);
      else if (Math.random() < dt * 30) for (let i = 0; i < 3; i++) chips.emit(vis.x + lx * sg * 1.0, vis.y + 0.4, vis.z + lz * sg * 1.0, car.vx * 0.6 + rnd() * 3, 1 + Math.random() * 2, car.vz * 0.6 + rnd() * 3, 0.05, 0, 0.35, [3.0, 1.6, 0.5], 1, -9.8, 0.6);
    }
  }
  if (evt.land > 3.5) {
    const f = FX[susp.surf[2]];
    for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28; dust.emit(vis.x + Math.cos(a) * 1.5, vis.gy + 0.2, vis.z + Math.sin(a) * 1.5, Math.cos(a) * 3.5 + car.vx * 0.3, 0.8 + Math.random() * 1.6, Math.sin(a) * 3.5 + car.vz * 0.3, 1.3, 2.3, 1.9, f.c, 0.32, 0.2); }
  }
}
// ---------- impacts ----------
let hitFlash = 0, flashShown = false, slideRumbleT = 0;
const flashEl = $('hitFlash');
function rumble(strong, weak, ms) {
  try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.vibrationActuator && p.vibrationActuator.playEffect) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }); } catch (e) { /* no rumble */ }
}
function onImpact(e) {
  const v = e.hit, sid = W.st.kind;
  // body jolt through the suspension springs
  susp.pv += (e.front ? 1 : -1) * Math.min(1.5, v * 0.085);
  susp.rv += (Math.random() < 0.5 ? -1 : 1) * Math.min(1.1, v * 0.065);
  susp.hv += Math.min(0.8, v * 0.035);
  cam.shake = Math.max(cam.shake, Math.min(0.45, 0.05 + v * 0.028));
  if (v > 7) hitFlash = Math.max(hitFlash, Math.min(0.7, 0.22 + (v - 7) * 0.06));
  rumble(Math.min(1, v / 14), Math.min(1, v / 9), 120 + Math.min(300, v * 18));
  if (isTouch && v > 7 && navigator.vibrate) try { navigator.vibrate(Math.round(Math.min(90, 25 + v * 3))); } catch (err) { /* not supported */ }
  sfx.crash(v, e.kind);
  const hx = e.x, hz = e.z, hy = vis.gy + 0.55, nx = e.nx, nz = e.nz;
  const n = Math.round(clamp(v * 1.3, 3, 24));
  const body = lin(P.col.base), dark = [0.03, 0.03, 0.035], glass = [0.55, 0.65, 0.75], other = e.kind === 'car' && e.col ? lin(e.col.base) : body;
  if (e.kind !== 'bank' && e.kind !== 'hay' && v > 5) {
    for (let i = 0; i < n; i++) {
      // another car: flakes of both paints
      const cc = Math.random() < 0.45 ? (Math.random() < 0.5 ? body : other) : (v > 11 && Math.random() < 0.3 ? glass : dark);
      chips.emit(hx + rnd() * 0.6, hy + rnd() * 0.4, hz + rnd() * 0.6, nx * (2 + Math.random() * 3) + car.vx * 0.3 + rnd() * 3, 1.5 + Math.random() * 3, nz * (2 + Math.random() * 3) + car.vz * 0.3 + rnd() * 3,
        0.06 + Math.random() * 0.07, 0, 0.9 + Math.random() * 0.6, cc, 1, -9.8, 0.35);
    }
  }
  if (e.kind === 'tree') {
    S.E.hitPos = [hx, 0, hz]; S.E.hitK = Math.min(1, v / 9);
    const needle = sid === 'frost' ? [0.92, 0.95, 1.0] : [0.14, 0.24, 0.1];
    for (let i = 0; i < Math.round(clamp(v * 2, 6, 28)); i++)
      chips.emit(hx + rnd() * 2.4, hy + 1.5 + Math.random() * 3, hz + rnd() * 2.4, rnd() * 1.5, -0.2 - Math.random() * 0.6, rnd() * 1.5, 0.07, 0, 2.2 + Math.random() * 1.2, needle, 0.9, -1.2, 2.5);
  }
  const snowy = e.kind === 'bank' || sid === 'frost';
  const puff = snowy ? [0.95, 0.97, 1] : sid === 'mesa' ? [0.62, 0.48, 0.36] : sid === 'city' ? [0.55, 0.55, 0.56] : [0.33, 0.29, 0.21];
  for (let i = 0; i < Math.round(clamp(v * 1.1, 4, 14)); i++)
    dust.emit(hx + rnd() * 1.2, vis.gy + 0.15 + Math.random() * 0.5, hz + rnd() * 1.2, nx * 2 + rnd() * 3, 0.4 + Math.random() * 1.4, nz * 2 + rnd() * 3, 0.9, 1.6, 1.3, puff, snowy ? 0.5 : 0.22, 0.1);
}
// snowfall
const FLAKES = 1500;
const fp = new Float32Array(FLAKES * 3), fc = new Float32Array(FLAKES * 4), fs = new Float32Array(FLAKES);
for (let i = 0; i < FLAKES; i++) { fp[i * 3] = (Math.random() - 0.5) * 80; fp[i * 3 + 1] = (Math.random() - 0.5) * 40; fp[i * 3 + 2] = (Math.random() - 0.5) * 80; fc.set([1, 1, 1, 0.85], i * 4); fs[i] = 0.05 + Math.random() * 0.05; }
const snowPts = R.points(FLAKES);
const flakeWorld = new Float32Array(FLAKES * 3);
function updateSnow(dt) {
  const bz = S.E.blizzard ? 1 : 0, gust = 1 + 0.5 * Math.sin(time * 0.6) + 0.25 * Math.sin(time * 1.7);
  for (let i = 0; i < FLAKES; i++) {
    fp[i * 3 + 1] -= (1.4 + (i % 7) * 0.12) * (1 + bz * 1.6) * dt;
    fp[i * 3] += (Math.sin(time * 0.7 + i) * 0.4 + bz * 6.5 * gust) * dt; fp[i * 3 + 2] += (Math.cos(time * 0.5 + i * 1.3) * 0.4 + bz * 2.2 * gust) * dt;
    for (let a = 0; a < 3; a++) {
      const half = a === 1 ? 20 : 40, c = cam.pos[a];
      flakeWorld[i * 3 + a] = c + (((fp[i * 3 + a] - c) % (half * 2)) + half * 3) % (half * 2) - half;
    }
  }
  snowPts.update(flakeWorld, fc, fs, FLAKES);
}
// rain: streaks in a box that travels with the camera. Each drop is a short line along its fall relative to the
// camera, so at speed the rain slants towards you and stretches; fogged like everything else.
const DROPS = 3400;
const dp = new Float32Array(DROPS * 3), dlen = new Float32Array(DROPS);
for (let i = 0; i < DROPS; i++) { dp[i * 3] = (Math.random() - 0.5) * 50; dp[i * 3 + 1] = (Math.random() - 0.5) * 24; dp[i * 3 + 2] = (Math.random() - 0.5) * 50; dlen[i] = 0.7 + Math.random() * 0.6; }
const rainLn = R.lines(DROPS * 2), rainV = new Float32Array(DROPS * 6), rainC = new Float32Array(DROPS * 8);
const camPrev = [0, 0, 0], camVel = [0, 0, 0];
function updateRain(dt) {
  if (dt <= 0) return;
  for (let a = 0; a < 3; a++) { const v = (cam.pos[a] - camPrev[a]) / dt; camVel[a] += (clamp(v, -80, 80) - camVel[a]) * Math.min(1, dt * 8); camPrev[a] = cam.pos[a]; }
  const fall = 10, wx = 1.6, wz = 0.7, ex = 0.022;
  const half = [25, 12, 25];
  for (let i = 0; i < DROPS; i++) {
    dp[i * 3] += wx * dt; dp[i * 3 + 1] -= fall * dt; dp[i * 3 + 2] += wz * dt;
    let x = 0, y = 0, z = 0;
    for (let a = 0; a < 3; a++) {
      const h = half[a], c = cam.pos[a], w = c + (((dp[i * 3 + a] - c) % (h * 2)) + h * 3) % (h * 2) - h;
      if (a === 0) x = w; else if (a === 1) y = w; else z = w;
    }
    const L = dlen[i] * ex;
    rainV[i * 6] = x; rainV[i * 6 + 1] = y; rainV[i * 6 + 2] = z;
    rainV[i * 6 + 3] = x - (wx - camVel[0]) * L; rainV[i * 6 + 4] = y + (fall + camVel[1]) * L * 1.6; rainV[i * 6 + 5] = z - (wz - camVel[2]) * L;
    rainC.set([0.8, 0.84, 0.9, 0.42, 0.8, 0.84, 0.9, 0.0], i * 8);
  }
  rainLn.update(rainV, rainC, DROPS * 2);
}
// tyre tracks: a continuous strip per rear wheel with soft edges. Drawn multiplicatively, so a track darkens
// whatever is under it (sunlit or in shadow) instead of painting a colour on top.
// per stage, per surface [road, verge, off]: tint multiplier, alpha when rolling, extra alpha when sliding
const TRK = {
  pine: [{ t: [0.45, 0.38, 0.3], base: 0.12, slide: 0.45 }, { t: [0.45, 0.38, 0.3], base: 0.14, slide: 0.45 }, { t: [0.55, 0.6, 0.35], base: 0.16, slide: 0.45 }],
  frost: [{ t: [0.58, 0.66, 0.86], base: 0.3, slide: 0.75 }, { t: [0.58, 0.66, 0.86], base: 0.34, slide: 0.75 }, { t: [0.6, 0.68, 0.88], base: 0.38, slide: 0.75 }],
  mesa: [{ t: [0.1, 0.1, 0.11], base: 0, slide: 0.55 }, { t: [0.6, 0.45, 0.36], base: 0.16, slide: 0.5 }, { t: [0.6, 0.45, 0.36], base: 0.18, slide: 0.5 }],
  city: [{ t: [0.1, 0.1, 0.11], base: 0, slide: 0.55 }, { t: [0.1, 0.1, 0.11], base: 0, slide: 0.55 }, { t: [0.1, 0.1, 0.11], base: 0, slide: 0.55 }],
};
const SK = 4000, SKV = 18;
const skid = R.trail(SK * SKV);
let skN = 0, skTotal = 0;
const skLast = [null, null];
function breakSkids() { skLast[0] = skLast[1] = null; }
function resetEffects() { dust.clear(); chips.clear(); emitAcc.fill(0); chipAcc.fill(0); skN = 0; skTotal = 0; breakSkids(); cam.tv = null; hitFlash = 0; dirt = 0; if (S) S.E.hitK = 0; }
const skP = new Float32Array(SKV * 3), skC = new Float32Array(SKV * 4);
function updateSkids() {
  if (mode === 'menu') return;
  const sid = W.st.kind, spd = Math.hypot(car.vx, car.vz);
  const sliding = car.slip > 2.2 || (input.hb && Math.abs(car.vF) > 3) || car.wheelspin > 1.5 || (input.brk > 0.5 && car.vF > 6 && sid !== 'pine');
  const half = sid === 'frost' ? 0.15 : 0.13;
  for (let side = 0; side < 2; side++) {
    const wi = 2 + side, tk = TRK[sid][susp.surf[wi]];
    const slideA = sliding ? clamp(0.45 + car.slip * 0.06 + car.wheelspin * 0.05, 0.45, 1) * tk.slide : 0;
    const a = Math.max(tk.base, slideA);
    if (car.air || spd < 1.5 || (a <= 0 && !skLast[side])) { skLast[side] = null; continue; }
    const w = wheelWorld(wi);
    const x = w[0], z = w[2], y = C.groundAt(W, car, x, z) + 0.03;
    const last = skLast[side];
    if (!last) { skLast[side] = { x, y, z, nx: 0, nz: 0, a: 0, t: tk.t, fresh: true }; continue; }
    const dx = x - last.x, dz = z - last.z, d = Math.hypot(dx, dz);
    if (d < 0.5) continue;
    if (d > 4) { skLast[side] = { x, y, z, nx: 0, nz: 0, a: 0, t: tk.t, fresh: true }; continue; }
    const nx = -dz / d, nz = dx / d;
    if (last.fresh) { last.nx = nx; last.nz = nz; }
    if (a > 0.005 || last.a > 0.005) {
      // cross-section: edge (0) - inner (a) - inner (a) - edge (0); colours carry tint and alpha
      const P0 = [], P1 = [], off = [1, 0.45, -0.45, -1], al = [0, 1, 1, 0];
      for (let k = 0; k < 4; k++) {
        P0.push([last.x + last.nx * half * off[k], last.y, last.z + last.nz * half * off[k]]);
        P1.push([x + nx * half * off[k], y, z + nz * half * off[k]]);
      }
      let q = 0;
      const put = (p, t, aa) => { skP[q * 3] = p[0]; skP[q * 3 + 1] = p[1]; skP[q * 3 + 2] = p[2]; skC[q * 4] = t[0]; skC[q * 4 + 1] = t[1]; skC[q * 4 + 2] = t[2]; skC[q * 4 + 3] = aa; q++; };
      for (let k = 0; k < 3; k++) {
        const v = [[P0[k], last.t, last.a * al[k]], [P0[k + 1], last.t, last.a * al[k + 1]], [P1[k + 1], tk.t, a * al[k + 1]], [P1[k], tk.t, a * al[k]]];
        for (const o of [0, 1, 2, 0, 2, 3]) put(v[o][0], v[o][1], v[o][2]);
      }
      skid.write(skN * SKV, skP, skC);
      skN = (skN + 1) % SK; skTotal++;
    }
    skLast[side] = { x, y, z, nx, nz, a, t: tk.t, fresh: false };
  }
}

// ---------- HUD ----------
let mmBase = null, mmT = null;
function buildMinimap() {
  const T = W.T, cv = document.createElement('canvas'); cv.width = 300; cv.height = 300;
  const g = cv.getContext('2d');
  const b = T.bbox, sc = Math.min(260 / (b.maxX - b.minX), 260 / (b.maxZ - b.minZ));
  const ox = (300 - (b.maxX - b.minX) * sc) / 2, oz = (300 - (b.maxZ - b.minZ) * sc) / 2;
  mmT = (x, z) => [300 - (ox + (x - b.minX) * sc), 300 - (oz + (z - b.minZ) * sc)];
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(239,236,228,0.18)'; g.lineWidth = 9; g.beginPath();
  for (let i = 0; i < T.n; i += 2) { const [x, y] = mmT(T.X[i], T.Z[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.strokeStyle = 'rgba(239,236,228,0.85)'; g.lineWidth = 3; g.stroke();
  for (const s of T.splits) { const p = C.sampleAt(T, s); const [x, y] = mmT(p.x, p.z); g.fillStyle = '#efece4'; g.fillRect(x - 3, y - 3, 6, 6); }
  const [fx, fy] = mmT(T.X[T.n - 1], T.Z[T.n - 1]); g.fillStyle = '#ffd23a'; g.fillRect(fx - 5, fy - 5, 10, 10);
  mmBase = cv;
}
const mm = $('minimap').getContext('2d');
const gauge = $('gauge').getContext('2d');
const gp = {};
function drawMinimap() {
  if (!mmBase) return;
  mm.clearRect(0, 0, 300, 300); mm.drawImage(mmBase, 0, 0);
  const dot = (x, z, col, r, ring) => { const [a, b] = mmT(x, z); mm.beginPath(); mm.arc(a, b, r, 0, 7); if (ring) { mm.strokeStyle = col; mm.lineWidth = 3; mm.stroke(); } else { mm.fillStyle = col; mm.fill(); } };
  if (settings.ghost && !lapsOn() && (mode === 'race' || mode === 'done')) {
    ghostPose(rival.ghost, raceT, gp); dot(gp.x, gp.z, '#b8d3ff', 7, true);
    if (pb) { ghostPose(pb.ghost, raceT, gp); dot(gp.x, gp.z, '#ffd23a', 7, true); }
    if (chal) { ghostPose(chal.ghost, raceT, gp); dot(gp.x, gp.z, '#ff6b8a', 7, true); }
  }
  if (netRun()) for (const o of net.race.others.values()) if (o.hist.length && !o.out && o.pose.x != null) dot(o.pose.x, o.pose.z, o.col, 6, false);
  const [a, b] = mmT(vis.x, vis.z);
  mm.save(); mm.translate(a, b); mm.rotate(Math.PI - vis.h);
  mm.fillStyle = '#ffd23a'; mm.strokeStyle = '#0b0d11'; mm.lineWidth = 2;
  mm.beginPath(); mm.moveTo(0, -12); mm.lineTo(8, 9); mm.lineTo(0, 5); mm.lineTo(-8, 9); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
}
function drawGauge() {
  const g = gauge, w = 440, cx = 220, cy = 228, r = 172;
  const E = P.engine, red = E.redline, maxR = Math.ceil((red + 700) / 1000) * 1000;
  g.clearRect(0, 0, w, w);
  g.fillStyle = 'rgba(11,14,19,0.82)'; g.beginPath(); g.arc(cx, cy, r + 30, 0, 7); g.fill();
  g.strokeStyle = 'rgba(236,232,220,0.14)'; g.lineWidth = 2; g.stroke();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const ang = v => a0 + (a1 - a0) * v / maxR;
  g.lineCap = 'butt';
  g.lineWidth = 16; g.strokeStyle = 'rgba(236,232,220,0.12)'; g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
  g.strokeStyle = 'rgba(255,93,79,0.5)'; g.beginPath(); g.arc(cx, cy, r, ang(red), a1); g.stroke();
  const rpm = clamp(car.rpm, 0, maxR);
  g.strokeStyle = rpm > red - 150 ? '#ff5d4f' : '#ffd23a'; g.beginPath(); g.arc(cx, cy, r, a0, ang(rpm)); g.stroke();
  g.fillStyle = 'rgba(236,232,220,0.7)'; g.font = '600 24px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = maxR > 12000 ? 2000 : 1000; // the F1 revs to 19,000: a figure every two thousand
  for (let k = 0; k <= maxR / 1000; k += step / 1000) {
    const a = ang(k * 1000);
    g.strokeStyle = 'rgba(236,232,220,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14)); g.lineTo(cx + Math.cos(a) * (r - 26), cy + Math.sin(a) * (r - 26)); g.stroke();
    g.fillText(String(k), cx + Math.cos(a) * (r - 46), cy + Math.sin(a) * (r - 46));
  }
  // shift lights
  const on = clamp((rpm - (red - 1500)) / 1300, 0, 1) * 5;
  const flash = rpm > red - 200 && Math.floor(time * 16) % 2 === 0;
  for (let i = 0; i < 5; i++) {
    const lit = flash || i < on;
    g.fillStyle = !lit ? 'rgba(236,232,220,0.12)' : (i < 2 ? '#49d686' : i < 4 ? '#ffd23a' : '#ff5d4f');
    if (flash) g.fillStyle = '#ff5d4f';
    g.beginPath(); g.arc(cx - 64 + i * 32, cy - 82, 10, 0, 7); g.fill();
  }
  const kmh = Math.round(Math.abs(car.vF) * 3.6);
  g.fillStyle = '#efece4'; g.font = '700 92px "Chivo Mono", monospace'; g.fillText(String(kmh), cx, cy - 8);
  g.fillStyle = 'rgba(236,232,220,0.55)'; g.font = '700 21px "Barlow Semi Condensed", sans-serif'; g.fillText('KM/H', cx, cy + 44);
  const gear = car.gear < 0 ? 'R' : (Math.abs(car.vF) < 0.5 && input.thr < 0.1 && settings.gearbox !== 'manual' ? 'N' : String(car.gear));
  g.fillStyle = rpm > red - 150 && mode === 'race' ? '#ff5d4f' : '#ffd23a';
  g.fillRect(cx - 30, cy + 66, 60, 54);
  g.fillStyle = '#16130a'; g.font = '900 46px "Big Shoulders Display", sans-serif'; g.fillText(gear, cx, cy + 95);
  g.fillStyle = 'rgba(236,232,220,0.6)'; g.font = '700 18px "Barlow Semi Condensed", sans-serif';
  g.fillText(settings.gearbox === 'manual' ? 'MAN' : 'AUTO', cx + 62, cy + 95);
  // boost (a normally aspirated engine shows the throttle instead)
  const na = !E.boostBar, bar = na ? clamp(car.thrE || 0, 0, 1) : clamp(car.boost, 0, 1);
  g.textAlign = 'center';
  g.fillStyle = 'rgba(236,232,220,0.12)'; g.fillRect(cx - 120, cy + 128, 240, 8);
  g.fillStyle = na ? '#49d686' : '#8fb6ff'; g.fillRect(cx - 120, cy + 128, 240 * bar, 8);
  g.fillStyle = 'rgba(236,232,220,0.6)'; g.font = '700 16px "Barlow Semi Condensed", sans-serif'; g.fillText(na ? `THROTTLE ${Math.round(bar * 100)} %` : `BOOST ${(car.boost * E.boostBar).toFixed(1)} BAR`, cx, cy + 152);
}
let deltaT = 0;
function updateHUD(dt) {
  const T = W.T;
  const laps = lapsOn();
  const t = mode === 'done' ? finishT : mode === 'countdown' ? 0 : raceT - (laps ? lap.t0 : 0);
  $('hTime').textContent = fmt(t);
  const span = laps ? T.lap : T.finishS - T.startS;
  const prog = clamp((car.s - (laps ? lap.next - T.lap : T.startS)) / span, 0, 1);
  $('hProg').style.width = (prog * 100) + '%';
  if (settings.ghost && !laps && (mode === 'race' || mode === 'done')) {
    const rs = rival.sArr[clamp(Math.floor(raceT / 0.05) - 1, 0, rival.sArr.length - 1)];
    $('hRival').style.left = clamp((rs - T.startS) / span, 0, 1) * 100 + '%'; $('hRival').hidden = false;
    if (pb) { const bs = pb.sArr[clamp(Math.floor(raceT / 0.05) - 1, 0, pb.sArr.length - 1)]; $('hPB').style.left = clamp((bs - T.startS) / span, 0, 1) * 100 + '%'; }
    if (chal) { const cs = chal.sArr[clamp(Math.floor(raceT / 0.05) - 1, 0, chal.sArr.length - 1)]; $('hChal').style.left = clamp((cs - T.startS) / span, 0, 1) * 100 + '%'; }
  } else { $('hRival').hidden = true; $('hPB').hidden = true; $('hChal').hidden = true; }
  const showLead = settings.leadGhost && lead && !laps && (mode === 'race' || mode === 'done');
  $('hLead').hidden = !showLead;
  if (showLead) { const ls = lead.sArr[clamp(Math.floor(raceT / 0.05) - 1, 0, lead.sArr.length - 1)]; $('hLead').style.left = clamp((ls - T.startS) / span, 0, 1) * 100 + '%'; }
  deltaT -= dt;
  if (deltaT <= 0) {
    deltaT = 0.1;
    const dEl = $('hDelta');
    if (laps) {
      // lap n + 1 under way: the gap to the best lap at this point of the lap, or the last lap's time
      const ls = car.s - (lap.next - T.lap), lb = lap.best, info = `Lap ${lap.n + 1}${lb ? ' · best ' + fmt(lb.t) : ''}`;
      if (mode === 'race' && lb && lap.n > 0 && ls > 30) { const d = t - refTimeAt(lb.sArr, ls); dEl.className = 'd ' + (d <= 0 ? 'ahead' : 'behind'); dEl.innerHTML = `<small>${info}</small>${fmtD(d)}`; }
      else { dEl.className = 'd'; dEl.innerHTML = `<small>${info}</small>${lap.last != null ? 'last ' + fmt(lap.last) : lb ? fmt(lb.t) : '–'}`; }
    } else if (mode === 'race' && car.s > T.startS + 30) {
      const ref = chal || pb || rival;
      const d = raceT - refTimeAt(ref.sArr, car.s);
      dEl.className = 'd ' + (d <= 0 ? 'ahead' : 'behind');
      dEl.innerHTML = `<small>${refLabel()}</small>${fmtD(d)}`;
    } else if (mode !== 'done') { dEl.className = 'd'; dEl.innerHTML = chal ? `<small>${escapeHTML(chal.n)}</small>${fmt(chal.t)}` : `<small>Rival</small>${fmt(rival.time)}`; }
    else { const rt = chal ? chal.t : rival.time, d = finishT - rt; dEl.className = 'd ' + (d <= 0 ? 'ahead' : 'behind'); dEl.innerHTML = `<small>${chal ? 'vs ' + escapeHTML(chal.n) : 'vs rival'}</small>${fmtD(d)}`; }
  }
  updateNoteCards();
  netHUD(dt); netBoard(dt);
  const ms = mirShown(); if ($('hMirror').hidden === ms) { $('hMirror').hidden = !ms; mirBox.t = 0; }
  drawMinimap(); drawGauge();
  if (centerT > 0) { centerT -= dt; if (centerT <= 0) $('centerMsg').innerHTML = ''; }
  if (camTagT > 0) { camTagT -= dt; $('camTag').style.opacity = clamp(camTagT, 0, 1); }
}

// ---------- race logic per frame ----------
function raceChecks(dt) {
  const T = W.T;
  if (mode !== 'race') { hint(''); return; }
  const off = Math.abs(car.lat) - T.hw;
  const spd = Math.hypot(car.vx, car.vz);
  offT = off > 7 ? offT + dt : 0;
  stuckT = spd < 1.2 && (input.thr > 0.5 || input.brk > 0.5) ? stuckT + dt : (spd > 3 ? 0 : stuckT);
  const along = car.vx * car.rd.tx + car.vz * car.rd.tz;
  wrongT = along < -3 ? wrongT + dt : 0;
  if (Math.abs(car.lat) > 30 || offT > 6) { manualReset(); return; }
  if (wrongT > 1.2) { if (centerT <= 0) center('<div class="mid" style="color:var(--bad)">Wrong way</div>', 0.6); }
  if (off > 7) hint('Off the road · press <kbd>R</kbd> to get back');
  else if (stuckT > 2.2) hint('Stuck? Press <kbd>R</kbd> to reset');
  else hint('');
}
const escapeHTML = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const refLabel = () => chal ? 'vs ' + escapeHTML(chal.n) : pb ? 'vs best' : 'vs rival';
function onSplit(k) {
  const ref = chal ? chal.s[k] : pb ? pb.splits[k] : rival.splits[k];
  const d = raceT - ref;
  center(`<div class="mid yel">Split ${k + 1}</div><div class="sub ${d <= 0 ? 'ahead' : 'behind'}">${fmtD(d)} <span style="font-size:.6em;color:var(--mute)">${refLabel()}</span></div>`, 2.6);
  sfx.beep(990, 0.09);
}

// ---------- main loop ----------
let last = performance.now();
const proj = M4.create(), view = M4.create(), lightView = M4.create(), lightProj = M4.create();
// dynamic resolution: when frames run long the canvas renders fewer pixels (the browser scales it up),
// and it creeps back up once there is headroom again. Judged on 1.5 s windows so single hitches don't count.
// The frame rate comes first: it aims for 60 fps (on a 60 Hz screen there is no telling how much headroom is left).
const dyn = { scale: 1, acc: 0, n: 0, lastDown: -99, dpr: 1, slow: 0, fps: 0 };
function adaptRes(rawDt) {
  // gaps over a second are tab switches or loads, not slow rendering; a lone hitch averages out over the window
  if (rawDt <= 0 || rawDt > 1 || document.hidden || mode === 'loading') { dyn.acc = 0; dyn.n = 0; return; }
  dyn.acc += rawDt; dyn.n++;
  if (dyn.acc < 1.5) return;
  const avg = dyn.acc / dyn.n, floor = resFloor(); dyn.acc = 0; dyn.n = 0;
  if (avg > 1 / 52 && dyn.scale > floor) { dyn.scale = Math.max(floor, dyn.scale * (avg > 1 / 30 ? 0.75 : 0.85)); dyn.lastDown = time; dyn.slow = 0; }
  // Auto, already at the lowest resolution and still slow: one level down for this session (nothing is saved), drawing
  // as many pixels as before, so the frame only loses effects; the resolution climbs back if there's headroom
  else if (avg > 1 / 50 && settings.gfx === 'auto' && gAuto.lv > 0) {
    if (++dyn.slow >= 2) { const k = RES_K[gq().res]; gAuto.lv--; dyn.scale = clamp(dyn.scale * k / RES_K[gq().res], resFloor(), 1); dyn.lastDown = time; applyGfx(); }
  }
  else if (avg < 1 / 57 && dyn.scale < 1 && time - dyn.lastDown > 8) dyn.scale = Math.min(1, dyn.scale * 1.1);
}
const resFloor = () => gq().res ? 0.6 : gq().scenery ? 0.9 : 0.7; // never under about 45 % of the screen's pixels across (35 % at Minimum)
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * RES_K[gq().res] * dyn.scale;
  dyn.dpr = dpr;
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
let paused_dbg = false;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, Math.max(0, raw)); last = now;
  if (paused_dbg) return;
  adaptRes(raw);
  if (settings.fps) fpsTick(raw);
  tick(dt, true);
}
// the frame-rate readout: frames over the last half second, and the size the scene is drawn at
const fpsC = { t: 0, n: 0 };
function fpsTick(raw) {
  if (raw <= 0 || raw > 1) return;
  fpsC.t += raw; fpsC.n++;
  if (fpsC.t < 0.5) return;
  $('fps').textContent = `${Math.round(fpsC.n / fpsC.t)} fps · ${canvas.width}×${canvas.height}` + (settings.gfx === 'auto' ? ' · ' + GFX_NAME[GFX_LV[gAuto.lv]] : '');
  fpsC.t = fpsC.n = 0;
}
function tick(dt, doRender) {
  if (!W || !car) { gl.clearColor(0.04, 0.05, 0.07, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  time += dt;
  readInput();
  evt.hit = 0; evt.land = 0; evt.shift = false; evt.down = false; evt.kind = ''; evt.col = null;
  if (mode === 'countdown') {
    // online the lights run on the shared clock (and wait until the host has everyone on the line)
    if (netRun()) cdT = net.race.greenL ? 3.6 + (nowMs() - net.race.greenL) / 1000 : -1; else cdT += dt;
    const n = cdT < 0 ? 5 : cdT < 0.6 ? 4 : cdT < 1.6 ? 3 : cdT < 2.6 ? 2 : cdT < 3.6 ? 1 : 0;
    if (n === 5) {
      const g = net.race.grid, ld = netLoaded(net.race.id), txt = `${g.filter(x => ld.has(x.i)).length} of ${g.length} on the line`;
      if (cdShown !== 5) { center('<div class="mid">Waiting for drivers</div><div class="sub" style="color:var(--mute)" id="netWaitN"></div>', 1e9); net.waitN = ''; }
      if (txt !== net.waitN && $('netWaitN')) { net.waitN = txt; $('netWaitN').textContent = txt; }
      cdShown = 5;
    } else if (n !== cdShown) {
      cdShown = n;
      if (n === 4) center(`<div class="mid">${W.st.name}</div><div class="sub" style="color:var(--mute)">${netRun() ? `Online · ${net.race.grid.length} driver${net.race.grid.length > 1 ? 's' : ''}` : P.name}</div>`, 0.6);
      // start light tree: one red lamp per second, all green on go
      else if (n > 0) { center(`<div class="lights">${[3, 2, 1].map(k => `<i class="${k >= n ? 'r' : ''}"></i>`).join('')}</div><div class="cdn">${n}</div>`, 1.0); sfx.beep(620, 0.12); }
      else { center('<div class="lights go"><i></i><i></i><i></i></div><div class="big yel">Go</div>', 0.9); sfx.beep(1240, 0.35); mode = 'race'; raceT = 0; acc = 0; if (netRun()) net.race.green = true; }
    }
    // on the grid everyone is a ghost: cars that overlap now (four or more share lanes) pass through until apart
    if (netRun() && net.race.greenL) netCollide(netWT());
    const Ee = P.engine;
    car.rpm += ((Ee.idle + input.thr * (Ee.redline * 0.82 - Ee.idle) + (input.thr > 0 ? Math.sin(time * 40) * 150 : 0)) - car.rpm) * Math.min(1, dt * 9);
    car.thrE = input.thr; car.boost += (input.thr * 0.3 - car.boost) * Math.min(1, dt * 2);
    savePrev(); alpha = 1;
  }
  if (mode === 'race' || mode === 'done') {
    acc += dt; let steps = 0;
    const wtF = netRun() && net.race.greenL ? netWT() : 0;
    while (acc >= STEP && steps < 12) {
      acc -= STEP; steps++;
      savePrev();
      let inp = input;
      if (mode === 'race') {
        inp = Object.assign({}, input, { manual: settings.gearbox === 'manual', shiftUp: pendUp > 0, shiftDown: pendDown > 0 });
        if (pendUp > 0) pendUp--; if (pendDown > 0) pendDown--;
        // online pause: the car waits on the brakes (brake held at a standstill means reverse, so the handbrake holds it there)
        if (net.pause) { const v = car.vF; inp = { steer: 0, thr: v < -0.5 ? 1 : 0, brk: v > 0.5 ? 1 : 0, hb: Math.abs(v) < 3, analog: true }; }
      }
      if (mode === 'done') { const ai = C.aiDrive(W, car, P, aiDone); inp = { steer: ai.steer, thr: 0, brk: 1, hb: false, analog: true }; }
      C.stepCar(W, car, P, inp, STEP);
      if (wtF) netCollide(wtF - acc);
      if (car.hitV > evt.hit) { evt.hit = car.hitV; evt.kind = car.hitKind; evt.x = car.hitX; evt.z = car.hitZ; evt.nx = car.hitNx; evt.nz = car.hitNz; evt.front = car.hitFront; }
      car.hitV = 0;
      evt.land = Math.max(evt.land, car.landV); car.landV = 0;
      if (car.shifted === 1) evt.shift = true;
      if (mode === 'race') {
        raceT += STEP; ghostTimer += STEP;
        if (ghostTimer >= 0.05) { ghostTimer -= 0.05; ghostRec.push(car.x, car.y, car.z, car.h); }
        if (lapsOn()) {
          // the line is the stage's start; once well into the next lap the car is moved back a lap (same place)
          if (ghostRec.length > 4000) ghostRec = [];
          if (lap.rec.length < Math.floor((raceT - lap.t0) / 0.05)) lap.rec.push(car.s - (lap.next - W.T.lap));
          if (car.s >= lap.next) { onLap(); lap.next += W.T.lap; }
          if (C.lapWrap(W, car)) { lap.next -= W.T.lap; noteIdx = W.T.notes.findIndex(n => n.s > car.s); if (noteIdx < 0) noteIdx = W.T.notes.length; snapVis(true); }
        } else {
        if (splitsHit.length < W.T.splits.length && car.s >= W.T.splits[splitsHit.length]) { splitsHit.push(raceT); onSplit(splitsHit.length - 1); }
        if (car.s >= W.T.finishS && splitsHit.length >= W.T.splits.length) { finish(); }
        }
      }
    }
    if (steps >= 12) acc = 0;
    alpha = acc / STEP;
    if (mode === 'race') callNotes();
    if (mode === 'done') { doneT += dt; if (doneT > 2.2 && !resultsShown) { resultsShown = true; net.pause = false; setScreen('results'); } }
  }
  if (mode === 'paused') { alpha = 1; }
  updateVis(dt);
  if (netRun()) netSample();
  if (mode !== 'paused') {
    if (netRun()) netContactFrame(dt);
    if (evt.hit > 3 && (mode === 'race' || mode === 'done')) onImpact(evt);
    if (evt.land > 5) rumble(Math.min(1, evt.land / 16), Math.min(0.6, evt.land / 20), 140);
    // a pad hums softly through a slide, more the further the tail is out (light motor only, a few times a second)
    slideRumbleT -= dt;
    if (mode === 'race' && slideRumbleT <= 0 && !car.air) {
      const sl = clamp((Math.abs(car.beta) - 0.12) / 0.45, 0, 1) * clamp(Math.hypot(car.vx, car.vz) / 14, 0, 1);
      if (sl > 0.05) { rumble(0, 0.12 + 0.35 * sl, 140); slideRumbleT = 0.12; }
    }
    updateDirt(dt);
    S.E.hitK *= Math.exp(-dt * 2.2);
    if (hitFlash > 0.002 || flashShown) { hitFlash *= Math.exp(-dt * 5); flashEl.style.opacity = hitFlash.toFixed(3); flashShown = hitFlash > 0.002; }
    updateCamera(dt);
    netUpdate(dt);
    emitEffects(dt); dust.update(dt); chips.update(dt); updateSkids();
    if (S.E.snowfall) updateSnow(dt);
    if (S.E.rain) updateRain(dt);
    if (gq().scenery) S.updateFans(time, vis.x, vis.z);
  }
  updateAudio(dt);
  // the city's traffic lights flash amber (a lamp, so it swells and fades rather than blinks)
  if (S.amber) { const k = clamp(Math.sin(time * 5.7) * 2.2 + 0.4, 0, 1); S.amber.tint = [0.1 + 2.5 * k, 0.06 + 1.55 * k, 0.012 + 0.34 * k]; }
  if (flameT > 0) flameT -= dt;
  if (!$('hud').hidden) { raceChecks(dt); updateHUD(dt); }
  if (doRender) render();
}

const ghostP = {}, spkT = M4.create(), spkM = M4.create();
function render() {
  resize();
  const E = S.E;
  const G = gq();
  E.time = time; E.shadows = G.shadows;
  const w = canvas.width, h = canvas.height;
  M4.persp(proj, cam.fov * Math.PI / 180, w / h, settings.cam === 2 && mode !== 'menu' ? 0.08 : 0.25, 4500);
  M4.lookAt(view, cam.pos, cam.look, cam.up);
  M4.mul(R.env.vp, proj, view);
  M4.inv(R.env.ivp, R.env.vp);
  R.env.cam = cam.pos; R.env.fov = cam.fov * Math.PI / 180;
  // headlights
  const fx = Math.sin(vis.h), fz = Math.cos(vis.h);
  if (lightsOn && carModel.shape.kind !== 'f1') { E.hlOn = E.night ? E.hlK : E.overcast ? 0.5 : 0.25; E.hlPos = [vis.x + fx * 2.3, vis.y + 0.9, vis.z + fz * 2.3]; const l = Math.hypot(fx, 0.1, fz); E.hlDir = [fx / l, -0.1 / l, fz / l]; }
  else E.hlOn = 0;
  // street lamps at night: the 16 nearest a point ahead of the camera light the scene, the furthest of them faded so
  // none switches on or off as the set changes
  if (S.lamps && S.lamps.length) {
    const dx = cam.look[0] - cam.pos[0], dz = cam.look[2] - cam.pos[2], dl = Math.hypot(dx, dz) || 1;
    const px = cam.pos[0] + dx / dl * 22, pz = cam.pos[2] + dz / dl * 22;
    const L = S.lamps, d = S.lampD || (S.lampD = new Float32Array(L.length)), ix = S.lampI || (S.lampI = L.map((_, i) => i));
    for (let i = 0; i < L.length; i++) d[i] = (L[i][0] - px) ** 2 + (L[i][2] - pz) ** 2;
    ix.sort((a, b) => d[a] - d[b]); // nearly sorted already from the last frame
    const n = Math.min(16, L.length), dmax = Math.sqrt(d[ix[Math.min(n, L.length - 1)]]);
    if (!E.pl) E.pl = new Float32Array(64);
    for (let i = 0; i < n; i++) { const l = L[ix[i]]; E.pl.set([l[0], l[1], l[2], 2.4 * (1 - C.sstep(0.7 * dmax, dmax, Math.sqrt(d[ix[i]])))], i * 4); }
    E.plN = n;
  } else E.plN = 0;
  // shadow pass: a near cascade (32 m, about 1.5 cm a texel) around the car and a far one (140 m) for the scenery
  if (E.shadows) {
    const sd = E.sunDir;
    const cascade = (out, ext, ahead, depth) => {
      const cx = vis.x + fx * ahead, cz = vis.z + fz * ahead, cy = vis.y;
      M4.lookAt(lightView, [cx + sd[0] * depth, cy + sd[1] * depth, cz + sd[2] * depth], [cx, cy, cz], [0, 1, 0]);
      // snap to texels to avoid shimmer
      const texel = (2 * ext) / R.SHADOW;
      const lx = lightView[0] * cx + lightView[4] * cy + lightView[8] * cz + lightView[12];
      const ly = lightView[1] * cx + lightView[5] * cy + lightView[9] * cz + lightView[13];
      lightView[12] -= lx - Math.floor(lx / texel) * texel; lightView[13] -= ly - Math.floor(ly / texel) * texel;
      M4.ortho(lightProj, -ext, ext, -ext, ext, depth - 120, depth + 220);
      M4.mul(out, lightProj, lightView);
      return texel;
    };
    const t0 = cascade(R.env.svp, 16, 7, 200), t1 = cascade(R.env.svp2, 70, 30, 200);
    R.env.shNo = [t0 * 1.2, t1 * 1.2];
    for (let k = 0; k < 2; k++) {
      R.beginShadow(k);
      for (const c of S.shadowCasters) if (G.scenery || c.m !== S.fanMesh) R.drawDepth(c.m, c.model);
      R.drawDepth(carModel.body, carMat);
      for (let i = 0; i < 4; i++) R.drawDepth(wheelMesh(carModel, i), wheelMatrix(i));
      netDepth();
    }
    R.endShadow();
  }
  R.beginScene(w, h, G.post, G.aa === 0 ? 1 : G.aa === 1 || dyn.dpr >= 1.5 ? 2 : 4); // dense screens need less MSAA
  gl.clearColor(E.fogCol[0], E.fogCol[1], E.fogCol[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
  const leadPos = drawWorld(E, G, false);
  placeLeadTag($('hud').hidden ? null : leadPos);
  // light shafts: where the sun sits on screen, faded out as it leaves the view or goes behind the camera
  let rays = null;
  if (E.V.rays && G.rays) {
    const vp = R.env.vp, sd = E.sunDir, px = cam.pos[0] + sd[0] * 1000, py = cam.pos[1] + sd[1] * 1000, pz = cam.pos[2] + sd[2] * 1000;
    const cw = vp[3] * px + vp[7] * py + vp[11] * pz + vp[15];
    if (cw > 0) {
      const nx = (vp[0] * px + vp[4] * py + vp[8] * pz + vp[12]) / cw, ny = (vp[1] * px + vp[5] * py + vp[9] * pz + vp[13]) / cw;
      const k = E.V.rays * clamp(1 - (Math.max(Math.abs(nx), Math.abs(ny)) - 1) / 0.7, 0, 1);
      const sc = E.sunCol, m = Math.max(sc[0], sc[1], sc[2]) || 1;
      if (k > 0) rays = { uv: [nx * 0.5 + 0.5, ny * 0.5 + 0.5], col: [sc[0] / m * k, sc[1] / m * k, sc[2] / m * k] };
    }
  }
  R.endScene(E.grade, time, cam.blur, rays);
  placeNetTags();
  if (mirShown()) renderMirror(E, G);
}
// the scene into the target that's bound, seen from R.env's camera: the screen's, or (mir) the rear-view mirror's,
// which leaves out your own car (the mirror sits in it), grass, the crowd, dust and rain. Returns where the No. 1
// ghost was drawn (for its name tag)
function drawWorld(E, G, mir) {
  R.setLitFrame(E);
  for (const { m, o } of S.meshes) {
    if (!G.scenery || mir) { // no grass or crowd (bare scenery, or the mirror); bare scenery has trees as their last (far) level everywhere
      if (o.mode === 7 || m === S.fanMesh) continue;
      if (m.lods && !G.scenery) { R.drawLit(m.lods[m.lods.length - 1].m, o); continue; }
    }
    if (o.farFog) { R.drawLit(m, { mode: 0, fog: [380, 3200], fogRestore: E.fog, fogLo: [E.fog[0], E.fog[1], W.st.kind === 'mesa' ? 100 : 110, (S.farY || 0) - 30] }); continue; }
    if (m === S.road) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2); R.drawLit(m, o); gl.disable(gl.POLYGON_OFFSET_FILL); continue; }
    if (o.decal) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4); R.drawLit(m, o); gl.disable(gl.POLYGON_OFFSET_FILL); continue; }
    R.drawLit(m, o);
  }
  // car
  const dcol = (DIRT[W.st.id] || DIRT[W.st.kind]).col, baseY = vis.y + susp.heave;
  if (!mir) {
    R.drawLit(carModel.body, { model: carMat, mode: 5, tex: carModel.tex, dirt, carY: baseY, dirtCol: dcol });
    if (carModel.spk) { M4.trs(spkT, 0, 0, -spkPump(), 0, 0, 0, 1); M4.mul(spkM, carMat, spkT); R.drawLit(carModel.spk, { model: spkM, dirt: dirt * 0.4, carY: baseY, dirtCol: dcol }); }
    for (let i = 0; i < 4; i++) R.drawLit(wheelMesh(carModel, i), { model: wheelMatrix(i), mode: 11, tex: carModel.tyreTex, dirt: dirt * 0.9, carY: baseY, dirtCol: dcol });
    for (let i = 0; i < 4; i++) R.drawLit(carModel.caliper, { model: wheelMatrix(i, true), dirt: dirt * 0.6, carY: baseY, dirtCol: dcol });
    if (!(settings.cam === 2 && (mode === 'race' || mode === 'countdown'))) R.drawLit(carModel.lightF, { model: carMat, mode: 4, tint: lightsOn ? (E.night ? [2.6, 2.6, 2.6] : [1.9, 1.9, 1.9]) : [0.3, 0.3, 0.3] });
    if (flameT > 0) R.drawLit(carModel.flame, { model: carMat, mode: 4, tint: [2.6 + Math.random(), 1.6 + Math.random() * 0.6, 0.9] });
    const braking = (mode === 'race' && input.brk > 0.1) || mode === 'done' || (mode === 'race' && input.hb);
    // the F1's only lamp is its rain light: on in the rain and at night, not a brake light
    const rainL = carModel.shape.kind === 'f1' ? (W.st.cond === 'rain' || E.night ? [2.6, 2.6, 2.6] : [0.2, 0.2, 0.2]) : null;
    R.drawLit(carModel.lightR, { model: carMat, mode: 4, tint: rainL || (braking ? [3.2, 3.2, 3.2] : lightsOn ? [0.85, 0.85, 0.85] : [0.55, 0.55, 0.55]) });
  }
  netDrawOpaque(E, mir);
  R.drawSky(E); // after opaque geometry: covered pixels fail the depth test and skip the sky shader
  // transparent pass
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
  // contact shadow: grounds the car, spreads and fades as it leaves the ground
  if (csMesh && !mir) {
    const hgt = Math.max(0, vis.y - vis.gy);
    const ca = clamp(1 - hgt / 2.2, 0, 1) * (E.night ? 0.42 : E.overcast ? 0.7 : 0.55);
    if (ca > 0.01) {
      M4.trs(shadowM, vis.x, vis.gy + 0.03, vis.z, vis.h, vis.gp, vis.gr, 1 + Math.min(hgt, 2) * 0.12);
      gl.polygonOffset(-3, -6);
      R.drawLit(csMesh, { model: shadowM, mode: 6, tex: csTex, alpha: ca });
    }
  }
  if (netRun()) { gl.polygonOffset(-3, -6); netContact(E, mir); }
  // tinted glass over the interior (the bonnet camera sits in front of it); a little dirt film from the body's level
  if (carModel.glass && !mir) { gl.disable(gl.POLYGON_OFFSET_FILL); R.drawLit(carModel.glass, { model: carMat, alpha: 0.8, dirt: dirt * 0.5, carY: baseY, dirtCol: dcol }); if (carModel.lens) R.drawLit(carModel.lens, { model: carMat, alpha: 0.18 }); gl.enable(gl.POLYGON_OFFSET_FILL); }
  // wheel motion blur, fading in with wheel speed
  const wb = clamp((Math.abs(car.vF) / 0.335 - 9) / 22, 0, 0.85);
  if (wb > 0.02 && !mir) { gl.disable(gl.POLYGON_OFFSET_FILL); for (let i = 0; i < 4; i++) R.drawLit(i < 2 || !carModel.wheelBlurR ? carModel.wheelBlur : carModel.wheelBlurR, { model: wheelMatrix(i), alpha: wb }); gl.enable(gl.POLYGON_OFFSET_FILL); }
  gl.polygonOffset(-2, -4);
  gl.blendFunc(gl.DST_COLOR, gl.ZERO);
  R.drawTrail(skid, E, mixLight(E), Math.min(skTotal, SK) * SKV);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  let leadPos = null;
  if ((settings.ghost || (settings.leadGhost && lead)) && !lapsOn() && (mode === 'race' || mode === 'done')) {
    R.setLitFrame(E);
    const drawGhost = (g, tint, amax) => {
      ghostPose(g, raceT, ghostP);
      const d = Math.hypot(ghostP.x - R.env.cam[0], ghostP.z - R.env.cam[2]);
      const a = clamp((d - 3) / 6, 0, 1) * (amax || 0.32);
      if (a <= 0.01) return;
      const gm = M4.trs(M4.create(), ghostP.x, ghostP.y, ghostP.z, ghostP.h, 0, 0, 1);
      R.drawLit(carModel.body, { model: gm, alpha: a, tint, mode: 5, tex: carModel.tex });
    };
    if (settings.ghost) {
      drawGhost(rival.ghost, [0.75, 0.9, 1.3]);
      if (pb) drawGhost(pb.ghost, [1.4, 1.2, 0.5]);
      if (chal) drawGhost(chal.ghost, [1.5, 0.55, 0.65]);
    }
    // the No. 1 in gold (not twice if it is the same run as your best or the challenge already on screen)
    if (settings.leadGhost && lead && !(settings.ghost && ((pb && Math.abs(pb.t - lead.t) < 0.005) || (chal && Math.abs(chal.t - lead.t) < 0.005)))) {
      drawGhost(lead.ghost, [2.1, 1.45, 0.12], 0.55); // stronger than the others: gold on gravel is otherwise hard to see
      leadPos = { x: ghostP.x, y: ghostP.y, z: ghostP.z };
    }
  }
  netDrawTransparent(E, mir);
  if (!mir) {
    R.drawPoints(dust.pts, E, mixLight(E), 1);
    R.drawPoints(chips.pts, E, mixLight(E), 0);
    if (E.snowfall) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); R.drawPoints(snowPts, E, [0.9, 0.9, 1.0], 0.3); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    if (E.rain) R.drawLines(rainLn, E, mixLight(E));
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
  return leadPos;
}
// ---- the rear-view mirror (top of the screen): online races by default, Options → Always / Off, B in a run ----
// A camera on the roof of your car looking back (it moves with the body, pitch and roll included), drawn into a small
// target of its own and from there into the frame the page puts at the top of the HUD (#hMirror)
const mirShown = () => !!W && mirWanted() && !$('hud').hidden;
// vertical field of view (°); the frame's inner corner radius (CSS px, as in page.html); how much nearer trees and terrain
// switch to their simpler levels (a mirror pixel covers about three times the angle of a screen pixel)
const MIR_FOV = 20, MIR_RAD = 9, MIR_LOD = 3;
const mirView = M4.create(), mirProj = M4.create(), mirVp = new Float32Array(16), mirIvp = new Float32Array(16);
const mirBox = { x: 0, y: 0, w: 0, h: 0, rad: 0, t: 0, cw: 0, ch: 0 };
function mirrorBox() {
  // where the frame's inside is, in canvas pixels (GL counts y from the bottom): read from the page twice a second
  // and whenever the canvas changes size, not every frame (that would force a layout)
  const b = mirBox;
  if (b.t > performance.now() && b.cw === canvas.width && b.ch === canvas.height) return b;
  const el = $('hMirror'), r = el.getBoundingClientRect(), k = canvas.width / (canvas.clientWidth || 1);
  b.w = Math.round(el.clientWidth * k); b.h = Math.round(el.clientHeight * k);
  b.x = Math.round((r.left + el.clientLeft) * k); b.y = canvas.height - Math.round((r.top + el.clientTop) * k) - b.h;
  b.rad = MIR_RAD * k; b.t = performance.now() + 500; b.cw = canvas.width; b.ch = canvas.height;
  return b;
}
function renderMirror(E, G) {
  const b = mirrorBox(); if (b.w < 16 || b.h < 8) return;
  const m = carMat, at = (x, y, z, w) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];
  const eye = at(0, 1.3, 0.1, 1), dir = at(0, -0.06, -1, 0);
  M4.persp(mirProj, MIR_FOV * Math.PI / 180, b.w / b.h, 0.3, 4500);
  M4.lookAt(mirView, eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], at(0, 1, 0, 0));
  const env = R.env, keep = { cam: env.cam, fov: env.fov };
  mirVp.set(env.vp); mirIvp.set(env.ivp);
  M4.mul(env.vp, mirProj, mirView); M4.inv(env.ivp, env.vp); env.cam = eye; env.fov = MIR_FOV * Math.PI / 180; env.lodK = MIR_LOD;
  if (R.beginMirror(b.w, b.h, 4)) {
    gl.clearColor(E.fogCol[0], E.fogCol[1], E.fogCol[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    drawWorld(E, G, true);
    R.endMirror();
    R.drawMirror(b.x, b.y, b.w, b.h, b.rad, G.post ? E.grade : null);
  }
  env.vp.set(mirVp); env.ivp.set(mirIvp); env.cam = keep.cam; env.fov = keep.fov; env.lodK = 1;
}
// the No. 1 ghost's name tag, over the ghost on screen (hidden when it is behind the camera, very close or far off)
function placeLeadTag(p) {
  const tag = $('leadTag');
  if (!p) { if (!tag.hidden) tag.hidden = true; return; }
  const d = Math.hypot(p.x - cam.pos[0], p.z - cam.pos[2]), vp = R.env.vp, y = p.y + 1.9;
  const w = vp[3] * p.x + vp[7] * y + vp[11] * p.z + vp[15];
  if (w <= 0.1 || d < 5 || d > 160) { tag.hidden = true; return; }
  const nx = (vp[0] * p.x + vp[4] * y + vp[8] * p.z + vp[12]) / w, ny = (vp[1] * p.x + vp[5] * y + vp[9] * p.z + vp[13]) / w;
  if (Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) { tag.hidden = true; return; }
  const txt = `No. 1 · ${lead.n} · ${fmt(lead.t)}`; if (tag.textContent !== txt) tag.textContent = txt;
  tag.hidden = false; tag.style.transform = `translate(${((nx * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((0.5 - ny * 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`;
  tag.style.opacity = String(clamp((d - 5) / 6, 0, 1) * clamp((160 - d) / 40, 0, 1));
}
function mixLight(E) {
  const s = E.sunCol, a = E.sky, g = E.gnd, k = Math.max(0.2, E.sunDir[1]);
  return [a[0] * 0.8 + g[0] * 0.3 + s[0] * k * 0.7, a[1] * 0.8 + g[1] * 0.3 + s[1] * k * 0.7, a[2] * 0.8 + g[2] * 0.3 + s[2] * k * 0.7];
}

// ---------- boot ----------
keepCarAllowed(curKey());
renderStageInfo(); renderCarList(); updateToggles(); renderGfx(); setMirror(settings.mirror);
setScreen('menu');
const fontsReady = document.fonts && document.fonts.load ? Promise.race([
  Promise.all([document.fonts.load('800 60px "Big Shoulders Display"'), document.fonts.load('700 40px "Chivo Mono"'), document.fonts.load('600 20px "Barlow Semi Condensed"')]),
  new Promise(r => setTimeout(r, 1800)),
]).catch(() => {}) : Promise.resolve();
fontsReady.then(() => loadStage(curKey(), () => {
  checkChallengeLink();
  // a reload in the middle of a room session puts you back in it (sessionStorage: this tab only)
  const back = sess.get('room'); if (back && !net.ch && settings.name) { $('tabOnline').click(); netJoin(back); }
}));
$('optName').value = settings.name || '';
$('optName').addEventListener('change', () => { const old = settings.name, v = $('optName').value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20); if (!v) { $('optName').value = old || ''; return; } settings.name = v; saveSettings(); if (settings.boardSeeded) renameOnBoard(old, v); else { seedBoard(v); settings.boardSeeded = 1; saveSettings(); } if (keepCarAllowed() && W) setupCar(); updateDriver(); renderTimes(); renderCarList(); if (inRoom()) netTrack(); });
updateDriver();
if (!settings.name) showWelcome(false);
else if (!settings.boardSeeded) { seedBoard(settings.name); settings.boardSeeded = 1; saveSettings(); }
setTimeout(onlineSync, 1500);
addEventListener('hashchange', () => checkChallengeLink());
requestAnimationFrame(frame);
if (location.protocol === 'file:') window.__rally = {
  advance(sec, inp) { paused_dbg = true; const n = Math.round(sec / 0.05); for (let i = 0; i < n; i++) { if (inp) Object.assign(keys, inp); tick(0.05, i === n - 1); } },
  resume() { paused_dbg = false; last = performance.now(); },
  setCam(c) { settings.cam = c; },
  auto(v) { dbgAuto = v; },
  view(p, l, fov, world) { dbgCam = p ? { p, l, fov, world } : null; },
  pickCar(i) { selectCar(i); },
  audio: () => ({ A, sfx, getTune }),
  setDirt(v) { dirt = v; },
  // graphics: a preset name or levels to mix into the current ones; draw(n) renders the same frame n times
  gfx(v) { if (typeof v === 'string') setGfx(v); else if (v) { settings.g = Object.assign({}, gq(), v); settings.gfx = 'custom'; applyGfx(true); } return { gfx: settings.gfx, g: gq(), auto: gAuto.lv, scale: dyn.scale, w: canvas.width, h: canvas.height }; },
  draw(n) { for (let i = 0; i < n; i++) render(); }, get mode() { return mode; }, get dbg() { return { dirt, hitFlash, dust: dust.n, chips: chips.n, hitK: S.E.hitK, shake: cam.shake, evt: Object.assign({}, evt) }; }, get car() { return car; }, get W() { return W; }, startRace, settings, keys, toMenu, get raceT() { return raceT; }, net, netJoin, netCreate, netStart, netLeave, netRows: () => (netRun() ? netRows() : null) };
})();
