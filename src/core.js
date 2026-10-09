// ===================== RALLY CORE: tracks, terrain, physics, AI =====================
const RallyCore = (() => {
'use strict';
const PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const wrapA = a => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
const G = 9.81;

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const r = rng(seed), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  function grad(h, x, y) {
    switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y; }
  }
  function n2(x, y) {
    let X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y; X &= 255; Y &= 255;
    const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    const g00 = grad(perm[a], x, y), g10 = grad(perm[b], x - 1, y);
    const g01 = grad(perm[a + 1], x, y - 1), g11 = grad(perm[b + 1], x - 1, y - 1);
    const x1 = g00 + (g10 - g00) * u, x2 = g01 + (g11 - g01) * u;
    return (x1 + (x2 - x1) * v) * 0.7;
  }
  function fbm(x, y, o) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < o; i++) { s += a * n2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.02; }
    return s / n;
  }
  return { n2, fbm };
}

// ---------------- Cars ----------------
// Every number here feeds the physics: engine curve, turbo, gearbox, drivetrain split, mass, balance, aero.
const RW = 0.335; // wheel radius (m)
const CARS = [
  { id: 'foca', name: 'Ford Focus RS WRC', note: 'Ford\'s World Rally Car, built and run by M-Sport', era: 'WRC · 2003', cls: 'WRC', num: 4, shape: 'hatch', wing: 'mid',
    engine: { code: 'Duratec-R', layout: 'Inline-4', cyl: 4, disp: 1998, asp: 'Turbo · anti-lag', hp: 300, hpRpm: 6500, nmCap: 560, redline: 7500, idle: 950, onset: 2100, spool: 7.5, antilag: true, na: 0.46, boostBar: 2.5, shape: 2.6 },
    gearbox: { type: 'Sequential', gears: 5, shift: 0.06, top: 200 },
    drive: { layout: 'AWD', front: 0.45, diff: 'Active centre diff' },
    mass: 1230, wd: 0.55, wb: 2.64, cgH: 0.47, inertia: 1.0, CdA: 0.78, ClA: 0.45, brake: 1.15, lock: 0.56, tyre: 1.0, agility: 1.0,
    col: { base: '#1d4fa3', roof: '#f2f2ee', lower: '#14336e', stripe: '#f2f2ee', stripe2: '#d7262e', rim: '#e4e4e4', text: '#ffffff' } },
  { id: 'impressa', name: 'Subaru Impreza WRC', note: 'The Prodrive-built, boxer-engined World Rally Car', era: 'WRC · 1998', cls: 'WRC', num: 5, shape: 'sedan', wing: 'big',
    engine: { code: 'EJ20 Boxer', layout: 'Flat-4', cyl: 4, boxer: true, disp: 1994, asp: 'Turbo · anti-lag', hp: 300, hpRpm: 5500, nmCap: 560, redline: 7000, idle: 900, onset: 2300, spool: 7, antilag: true, na: 0.46, boostBar: 2.4, shape: 2.4 },
    gearbox: { type: 'Sequential', gears: 6, shift: 0.05, top: 195 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Active centre diff' },
    mass: 1230, wd: 0.55, wb: 2.52, cgH: 0.43, inertia: 0.97, CdA: 0.76, ClA: 0.42, brake: 1.15, lock: 0.55, tyre: 1.03, agility: 1.0,
    col: { base: '#1b3f96', roof: '#1b3f96', lower: '#1b3f96', stripe: '#ffd21a', stripe2: '#ffd21a', rim: '#c9a33b', text: '#ffd21a' } },
  { id: 'lancha', name: 'Mitsubishi Lancer Evo VI', note: 'Ralliart\'s Group A Evo, world champion in 1999', era: 'Group A · 1999', cls: 'Group A', num: 7, shape: 'sedan', wing: 'big',
    engine: { code: '4G63T', layout: 'Inline-4', cyl: 4, disp: 1997, asp: 'Turbo · anti-lag', hp: 300, hpRpm: 6500, nmCap: 540, redline: 7500, idle: 950, onset: 2200, spool: 6.5, antilag: true, na: 0.45, boostBar: 2.3, shape: 2.6 },
    gearbox: { type: 'H-pattern', gears: 6, shift: 0.15, top: 205 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Active yaw control' },
    mass: 1230, wd: 0.57, wb: 2.51, cgH: 0.48, inertia: 1.0, CdA: 0.82, ClA: 0.42, brake: 1.12, lock: 0.55, tyre: 1.0, agility: 1.08,
    col: { base: '#f3f3f1', roof: '#f3f3f1', lower: '#141414', stripe: '#d3191f', stripe2: '#141414', rim: '#f3f3f1', text: '#d3191f' } },
  { id: 'delta', name: 'Lancia Delta HF Integrale', note: 'The Group A legend behind six makes\' titles in a row', era: 'Group A · 1992', cls: 'Group A', num: 1, shape: 'boxhatch', wing: 'roof',
    engine: { code: '16V Turbo', layout: 'Inline-4', cyl: 4, disp: 1995, asp: 'Turbo', hp: 295, hpRpm: 7000, nmCap: 430, redline: 7800, idle: 1000, onset: 3000, spool: 5, antilag: false, flutter: true, na: 0.42, boostBar: 1.9, shape: 2.2 },
    gearbox: { type: 'H-pattern', gears: 6, shift: 0.17, top: 190 },
    drive: { layout: 'AWD', front: 0.47, diff: 'Epicyclic + Torsen' },
    mass: 1120, wd: 0.56, wb: 2.48, cgH: 0.5, inertia: 0.92, CdA: 0.8, ClA: 0.15, brake: 1.05, lock: 0.58, tyre: 0.98, agility: 1.18,
    col: { base: '#f5f5f2', roof: '#f5f5f2', lower: '#f5f5f2', stripe: '#45a6de', stripe2: '#122f7a', stripe3: '#d6262b', rim: '#eeeeee', text: '#122f7a' } },
  { id: 'pejo', name: 'Peugeot 205 T16', note: 'Mid-engined Group B champion of 1985 and 1986', era: 'Group B · 1985', cls: 'Group B', num: 2, shape: 'small', wing: 'roof',
    engine: { code: 'XU8T', layout: 'Inline-4 (mid)', cyl: 4, disp: 1775, asp: 'Turbo', hp: 370, hpRpm: 7500, nmCap: 450, redline: 8300, idle: 1100, onset: 3000, spool: 3.3, antilag: false, flutter: true, na: 0.5, boostBar: 2.2, shape: 2.1 },
    gearbox: { type: 'H-pattern', gears: 5, shift: 0.2, top: 200 },
    drive: { layout: 'AWD', front: 0.42, diff: 'Rear-biased centre diff' },
    mass: 910, wd: 0.43, wb: 2.54, cgH: 0.45, inertia: 0.95, frontGrip: 1.04, rearGrip: 1.04, CdA: 0.72, ClA: 0.25, brake: 1.15, lock: 0.6, tyre: 1.0, agility: 1.08,
    col: { base: '#f5f5f2', roof: '#f5f5f2', lower: '#f5f5f2', stripe: '#1d3c8f', stripe2: '#f5c400', stripe3: '#d6262b', rim: '#f2f2f2', text: '#1d3c8f' } },
  { id: 'kwattro', name: 'Audi Sport Quattro S1', note: 'The short-wheelbase, five-cylinder Group B Quattro', era: 'Group B · 1986', cls: 'Group B', num: 3, shape: 'coupe', wing: 'big',
    engine: { code: '20V Five', layout: 'Inline-5', cyl: 5, disp: 2110, asp: 'Turbo · recirculation', hp: 470, hpRpm: 7800, nmCap: 590, redline: 8400, idle: 1000, onset: 4000, spool: 3.0, antilag: true, na: 0.36, boostBar: 2.6, shape: 2.0 },
    gearbox: { type: 'H-pattern', gears: 6, shift: 0.18, top: 210 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Locking centre diff' },
    mass: 1090, wd: 0.61, wb: 2.22, cgH: 0.5, inertia: 1.06, rearGrip: 1.03, CdA: 0.86, ClA: 0.55, brake: 1.05, lock: 0.55, tyre: 0.97, agility: 0.88,
    col: { base: '#f1efe8', roof: '#f1efe8', lower: '#f1efe8', stripe: '#c41e2a', stripe2: '#d9a43a', rim: '#d9a43a', text: '#c41e2a' } },
  { id: 'selica', name: 'Toyota Celica GT-Four', note: 'Toyota Team Europe\'s four-wheel-drive Group A turbo', era: 'Group A · 1995', cls: 'Group A', num: 6, shape: 'liftback', wing: 'big',
    engine: { code: '3S-GTE', layout: 'Inline-4', cyl: 4, disp: 1998, asp: 'Turbo · anti-lag', hp: 299, hpRpm: 6000, nmCap: 520, redline: 7200, idle: 900, onset: 2400, spool: 6.5, antilag: true, na: 0.45, boostBar: 2.2, shape: 2.5 },
    gearbox: { type: 'Sequential', gears: 6, shift: 0.07, top: 200 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Viscous centre diff' },
    mass: 1200, wd: 0.58, wb: 2.54, cgH: 0.47, inertia: 1.0, CdA: 0.76, ClA: 0.4, brake: 1.12, lock: 0.56, tyre: 1.0, agility: 1.02,
    col: { base: '#f4f4f0', roof: '#f4f4f0', lower: '#f4f4f0', stripe: '#d4202c', stripe2: '#1f8a4c', stripe3: '#f2c230', rim: '#f2f2f2', text: '#d4202c' } },
];

function torqueAt(P, rpm) { // full-throttle torque with full boost (Nm)
  const E = P.engine;
  const w = Math.max(rpm, 500) * 2 * PI / 60;
  const x = rpm / E.hpRpm;
  let f = x <= 1 ? 1 - Math.pow(Math.max(0, 1 - x), E.shape) : 1 - 1.5 * (x - 1) * (x - 1);
  if (rpm > E.redline) f *= Math.max(0, 1 - (rpm - E.redline) / 500);
  return Math.min(E.nmCap, Math.max(0, E.hp * 745.7 * f / w));
}
const boostSS = (P, rpm) => clamp((rpm - P.engine.onset) / 1800, 0, 1);
function engineCurve(P) {
  const E = P.engine, out = [];
  let pk = { hp: 0, hpRpm: 0, nm: 0, nmRpm: 0 };
  for (let r = 1000; r <= E.redline; r += 100) {
    const T = torqueAt(P, r) * (E.na + (1 - E.na) * boostSS(P, r));
    const hp = T * r * 2 * PI / 60 / 745.7;
    out.push([r, T, hp]);
    if (hp > pk.hp) { pk.hp = hp; pk.hpRpm = r; }
    if (T > pk.nm) { pk.nm = T; pk.nmRpm = r; }
  }
  return { pts: out, peak: pk };
}

function prepareCar(P) {
  const E = P.engine, n = P.gearbox.gears;
  const g1 = n === 5 ? 3.05 : 3.25, gN = n === 5 ? 1.06 : 0.98;
  P.ratios = [];
  for (let i = 0; i < n; i++) P.ratios.push(g1 * Math.pow(gN / g1, Math.pow(i / (n - 1), 0.88)));
  P.final = (E.redline * 2 * PI / 60 * RW) / (gN * P.gearbox.top / 3.6);
  P.b = P.wd * P.wb; P.a = P.wb - P.b; // a: CG to front axle, b: CG to rear axle
  P.Iz = P.mass * P.a * P.b * P.inertia;
  P.grip = P.tyre;
  P.vtop = P.gearbox.top / 3.6;
  const ec = engineCurve(P); P.curve = ec.pts; P.peak = ec.peak;
  P.pw = P.peak.hp / (P.mass / 1000); // hp per tonne
  return P;
}
CARS.forEach(prepareCar);

function carStatsRaw(c) {
  const sp = c.spec || { t100: 4, t160: 8 };
  return {
    speed: c.gearbox.top,
    accel: 1 / (sp.t100 + sp.t160 * 0.6),
    grip: c.tyre * (1 + c.ClA * 0.25) * (1 - Math.abs(c.wd - 0.53) * 0.4),
    handling: c.agility * Math.sqrt(c.mass / c.Iz) * (1 - (c.wd - 0.5) * 1.6),
  };
}
function carStats(c) {
  const all = CARS.map(carStatsRaw), me = carStatsRaw(c), out = {};
  for (const k of Object.keys(me)) {
    const vs = all.map(o => o[k]), lo = Math.min(...vs), hi = Math.max(...vs);
    out[k] = Math.round(3 + 7 * (hi > lo ? (me[k] - lo) / (hi - lo) : 1));
  }
  return out;
}

// ---------------- Stages ----------------
const RADIUS = { 6: 190, 5: 125, 4: 82, 3: 54, 2: 35, 1: 23, H: 12.5 };

const STAGES = [
  { id: 'pine', kind: 'pine', name: 'Pine Ridge', region: 'Lakeland Forest', surface: 'Gravel', tag: 'Fast forest gravel with big jumps',
    grip: 0.92, offGrip: 0.62, offDrag: 1.4, tyreB: 8, hw: 4.3, h0: 0.0, seed: 1201, blend: 24, rival: 'Tommi Mäkinon',
    elev: { a1: 6, l1: 170, p1: 0.4, a2: 2.4, l2: 65, p2: 1.3 },
    segs: [
      ['S', 90], ['C', 1.3], ['S', 70], ['L', 5, 40], ['S', 90], ['R', 4, 70], ['S', 40], ['L', 3, 80, 'dc'],
      ['S', 100], ['J', 2.2], ['S', 110], ['R', 5, 50], ['L', 5, 45], ['S', 60], ['R', 'H', 165], ['S', 100],
      ['L', 2, 90], ['S', 70], ['C', 1.6], ['S', 70], ['R', 4, 60], ['L', 4, 55], ['S', 120], ['J', 2.6], ['S', 120],
      ['R', 3, 95, 'cau'], ['S', 60], ['L', 5, 60], ['S', 80], ['R', 6, 40], ['S', 70], ['J', 2.0], ['S', 90],
      ['L', 3, 90], ['S', 50], ['R', 2, 100, 'dc'], ['S', 90], ['L', 4, 70], ['S', 170]
    ] },
  { id: 'frost', kind: 'frost', name: 'Frostvik', region: 'Northern Snow Bowl', surface: 'Snow', tag: 'Snowbanks, ice and dusk',
    grip: 0.74, offGrip: 0.5, offDrag: 2.2, tyreB: 7.5, hw: 4.3, h0: 1.2, seed: 2207, blend: 26, rival: 'Kalle Rovanpeara',
    bank: 1.3, bankK: 60, bankDamp: 5, bankScrub: 0.5, night: true, snow: true,
    elev: { a1: 5, l1: 200, p1: 1.1, a2: 2.0, l2: 75, p2: 0.2 },
    segs: [
      ['S', 140], ['R', 5, 45], ['S', 60], ['L', 4, 70], ['S', 90], ['C', 1.4], ['S', 70], ['R', 3, 90, 'dc'],
      ['S', 50], ['L', 3, 80], ['S', 120], ['R', 5, 55], ['S', 40], ['L', 6, 35], ['S', 110], ['J', 1.8], ['S', 90],
      ['R', 'H', 170], ['S', 90], ['L', 4, 75], ['S', 60], ['R', 4, 65], ['S', 100], ['C', 1.6], ['S', 90],
      ['L', 2, 95, 'cau'], ['S', 70], ['R', 5, 60], ['L', 5, 55], ['S', 120], ['R', 3, 85], ['S', 60],
      ['L', 4, 80], ['S', 170]
    ] },
  { id: 'mesa', kind: 'mesa', name: 'Red Mesa', region: 'Canyon Country', surface: 'Tarmac', tag: 'Hairpins, a climb and a narrow gorge',
    grip: 1.15, offGrip: 0.64, offDrag: 1.6, tyreB: 11, hw: 4.3, h0: -0.6, seed: 3301, blend: 22, rival: 'Sebastian Lob',
    tarmac: true,
    elev: { a1: 3, l1: 220, p1: 0.0, a2: 1.5, l2: 70, p2: 2.0 },
    segs: [
      ['S', 120], ['L', 5, 50], ['S', 80], ['R', 4, 70], ['S', 60], ['G', 0.05], ['L', 'H', 175], ['S', 110],
      ['R', 'H', 175], ['S', 110], ['L', 2, 90], ['G', 0.0], ['S', 90], ['R', 5, 60], ['S', 150], ['L', 6, 40],
      ['S', 130], ['C', 1.3], ['S', 80], ['R', 3, 90, 'cau'], ['S', 70], ['L', 4, 60], ['G', -0.04], ['S', 90],
      ['R', 'H', 170], ['S', 100], ['L', 'H', 165], ['S', 90], ['G', 0.0], ['R', 4, 80], ['S', 120], ['L', 5, 70],
      ['S', 80], ['R', 2, 100, 'dc'], ['S', 90], ['L', 4, 70], ['S', 170]
    ] },
  // a narrow road through old pine forest: the trees stand in rows right off the verge the whole way
  { id: 'forest', kind: 'pine', name: 'Dark Pines', region: 'Old Growth Forest', surface: 'Gravel', tag: 'Narrow gravel lined with pines',
    grip: 0.88, offGrip: 0.58, offDrag: 1.6, tyreB: 8, hw: 4.0, h0: 0.4, seed: 4409, blend: 24, rival: 'Colin McRay',
    elev: { a1: 4, l1: 150, p1: 0.8, a2: 1.8, l2: 55, p2: 0.6 },
    segs: [
      ['S', 100], ['R', 4, 60], ['S', 70], ['L', 4, 55], ['S', 60], ['C', 1.2], ['S', 80], ['R', 3, 80], ['S', 50],
      ['L', 5, 45], ['R', 5, 45], ['S', 90], ['J', 1.8], ['S', 100], ['L', 2, 90, 'dc'], ['S', 60], ['R', 'H', 165],
      ['S', 90], ['L', 4, 65], ['S', 70], ['R', 3, 85, 'cau'], ['S', 80], ['C', 1.4], ['S', 70], ['L', 5, 50],
      ['R', 4, 60], ['S', 110], ['L', 3, 80], ['S', 60], ['R', 2, 95], ['S', 80], ['J', 2.0], ['S', 90],
      ['L', 4, 60], ['R', 5, 45], ['S', 70], ['L', 3, 85], ['S', 150]
    ] },
];

function blur(a, r) {
  const n = a.length, o = new Float64Array(n);
  let acc = 0;
  for (let i = -r; i <= r; i++) acc += (i >= 0 && i < n) ? a[i] : 0;
  for (let i = 0; i < n; i++) {
    o[i] = acc / (2 * r + 1);
    const add = i + r + 1, rem = i - r;
    acc += (add < n ? a[add] : 0) - (rem >= 0 ? a[rem] : 0);
  }
  return o;
}

function bump(e, s) {
  const d = s - e.s;
  if (e.type === 'J') {
    const up = 26, dn = 46, extra = 0.8;
    if (d < -up || d > dn + 30) return 0;
    if (d <= 0) { const u = (d + up) / up; return e.h * Math.pow(u, 1.7); }
    if (d <= dn) return e.h - (e.h + extra) * sstep(0, dn, d);
    return -extra * (1 - sstep(dn, dn + 30, d));
  }
  const a = Math.abs(d);
  return a > 34 ? 0 : e.h * (1 - sstep(0, 34, a));
}

const CELL = 16;
const hkey = (cx, cz) => (cx + 4096) + (cz + 4096) * 8192;

function buildTrack(st) {
  const k = [], notesRaw = [], ev = [], grades = [];
  let s = 0;
  for (const seg of st.segs) {
    const t = seg[0];
    if (t === 'S') { const n = Math.round(seg[1]); for (let i = 0; i < n; i++) k.push(0); s += n; }
    else if (t === 'L' || t === 'R') {
      const R = RADIUS[seg[1]]; const n = Math.max(4, Math.round(R * seg[2] * PI / 180)); const dir = t === 'L' ? 1 : -1;
      notesRaw.push({ s0: s, s1: s + n, dir, sev: seg[1], ang: seg[2], mods: seg.slice(3) });
      for (let i = 0; i < n; i++) k.push(dir / R);
      s += n;
    }
    else if (t === 'J' || t === 'C') ev.push({ type: t, s, h: seg[1] });
    else if (t === 'G') grades.push({ s, g: seg[1] });
  }
  const L = k.length;
  const ks = blur(blur(k, 6), 6);
  const px = new Float64Array(L + 1), pz = new Float64Array(L + 1), ph = new Float64Array(L + 1), py = new Float64Array(L + 1);
  let x = 0, z = 0, h = st.h0 || 0;
  ph[0] = h;
  for (let i = 0; i < L; i++) {
    const hm = h + ks[i] * 0.5; x += Math.sin(hm); z += Math.cos(hm); h += ks[i];
    px[i + 1] = x; pz[i + 1] = z; ph[i + 1] = h;
  }
  // elevation
  let y = 0, g = 0, gi = 0, gs = 0;
  for (let i = 0; i <= L; i++) {
    while (gi < grades.length && grades[gi].s <= i) { g = grades[gi].g; gi++; }
    gs += (g - gs) * 0.04; // ease grade changes
    if (i > 0) y += gs;
    py[i] = y;
  }
  const E = st.elev;
  for (let i = 0; i <= L; i++) {
    let u = E.a1 * Math.sin(i / E.l1 + E.p1) + E.a2 * Math.sin(i / E.l2 + E.p2);
    u *= sstep(0, 90, i) * sstep(0, 80, L - i);
    py[i] += u;
  }
  for (const e of ev) for (let i = Math.max(0, e.s - 40); i <= Math.min(L, e.s + 80); i++) py[i] += bump(e, i);

  const n = Math.floor(L / 2) + 1;
  const X = new Float32Array(n), Z = new Float32Array(n), Y = new Float32Array(n), H = new Float32Array(n), K = new Float32Array(n);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    const m = Math.min(2 * i, L);
    X[i] = px[m]; Z[i] = pz[m]; Y[i] = py[m]; H[i] = ph[m]; K[i] = ks[Math.min(m, L - 1)];
    minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]); minZ = Math.min(minZ, Z[i]); maxZ = Math.max(maxZ, Z[i]);
  }
  const hash = new Map();
  for (let i = 0; i < n; i++) {
    const kk = hkey(Math.floor(X[i] / CELL), Math.floor(Z[i] / CELL));
    let a = hash.get(kk); if (!a) { a = []; hash.set(kk, a); } a.push(i);
  }
  // pace notes
  const notes = [];
  for (const r of notesRaw) {
    const mods = r.mods.slice();
    if (r.sev !== 'H' && r.ang >= 110) mods.push('long');
    notes.push({ kind: 'turn', s: r.s0 - 8, end: r.s1 + 6, mid: (r.s0 + r.s1) / 2, dir: r.dir, sev: r.sev, ang: r.ang, mods });
  }
  for (const e of ev) notes.push({ kind: e.type === 'J' ? 'jump' : 'crest', s: e.s - (e.type === 'J' ? 22 : 24), end: e.s + 10, mid: e.s, h: e.h, mods: [] });
  notes.sort((a, b) => a.s - b.s);
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i], nx = notes[i + 1];
    const gap = nx ? nx.s - nt.end : (L - nt.end);
    nt.into = !!(nx && gap < 30 && nt.kind === 'turn' && nx.kind === 'turn');
    nt.dist = (nx && gap > 95) ? Math.min(500, Math.round(gap / 50) * 50) : 0;
  }
  const T = { st, L, n, X, Z, Y, H, K, hash, notes, hw: st.hw, events: ev,
    bbox: { minX, maxX, minZ, maxZ }, spawnS: 14, startS: 22, finishS: L - 45,
    splits: [Math.round(L * 0.34), Math.round(L * 0.67)] };
  T.walls = [];
  if (st.id === 'mesa') {
    T.walls.push({ s0: Math.round(L * 0.30), s1: Math.round(L * 0.40), off: 2.6 });
    T.walls.push({ s0: Math.round(L * 0.71), s1: Math.round(L * 0.79), off: 2.6 });
  }
  return T;
}

function sampleAt(T, s) {
  const f = clamp(s / 2, 0, T.n - 1.0001); const i = Math.floor(f), t = f - i;
  return { x: lerp(T.X[i], T.X[i + 1], t), z: lerp(T.Z[i], T.Z[i + 1], t), y: lerp(T.Y[i], T.Y[i + 1], t),
    h: T.H[i] + (T.H[i + 1] - T.H[i]) * t, i, t };
}
function roadYAt(T, s) { const f = clamp(s / 2, 0, T.n - 1.0001); const i = Math.floor(f); return lerp(T.Y[i], T.Y[i + 1], f - i); }

function nearest(T, x, z, maxR) {
  const r = Math.ceil(maxR / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let bi = -1, bd = maxR * maxR;
  for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
    const arr = T.hash.get(hkey(cx + a, cz + b)); if (!arr) continue;
    for (const i of arr) { const dx = x - T.X[i], dz = z - T.Z[i]; const d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  }
  return bi;
}

function project(T, i, x, z, out) {
  let j = i;
  if (i >= T.n - 1) j = T.n - 2;
  else if (i > 0) {
    const tx = Math.sin(T.H[i]), tz = Math.cos(T.H[i]);
    if ((x - T.X[i]) * tx + (z - T.Z[i]) * tz < 0) j = i - 1;
  }
  const ax = T.X[j], az = T.Z[j], ex = T.X[j + 1] - ax, ez = T.Z[j + 1] - az;
  const l2 = ex * ex + ez * ez, len = Math.sqrt(l2);
  let t = ((x - ax) * ex + (z - az) * ez) / l2;
  const tc = clamp(t, 0, 1);
  const tx = ex / len, tz = ez / len, rx = -tz, rz = tx;
  out.lat = (x - ax) * rx + (z - az) * rz;
  out.s = (j + (j === 0 || j === T.n - 2 ? t : tc)) * 2;
  out.roadY = lerp(T.Y[j], T.Y[j + 1], tc);
  out.tx = tx; out.tz = tz; out.rx = rx; out.rz = rz;
  const qx = ax + ex * tc - x, qz = az + ez * tc - z;
  out.dist = Math.sqrt(qx * qx + qz * qz);
  out.seg = j;
  return out;
}

// ---------------- Terrain ----------------
function terrainNatural(st, nz, x, z, d, lat, s, T) {
  if (st.kind === 'pine') {
    let h = 7 * nz.fbm(x / 230, z / 230, 4) + 1.8 * nz.fbm(x / 40, z / 40, 3);
    h += sstep(40, 260, d) * 16 * (0.55 + 0.45 * nz.n2(x / 330 + 3, z / 330));
    return h;
  }
  if (st.kind === 'frost') {
    let h = 5 * nz.fbm(x / 200, z / 200, 4) + 1.2 * nz.fbm(x / 35, z / 35, 2);
    h += sstep(50, 320, d) * 42 * (0.6 + 0.4 * nz.fbm(x / 260, z / 260, 3));
    return h;
  }
  // mesa: terraced canyon
  let m = 34 * (0.5 + 0.5 * nz.fbm(x / 240, z / 240, 4)) + 6 * nz.n2(x / 60, z / 60);
  const step = 9, f = m / step, fl = Math.floor(f), fr = f - fl;
  const terr = (fl + sstep(0.72, 1.0, fr)) * step;
  let h = sstep(25, 150, d) * terr + 1.2 * nz.fbm(x / 30, z / 30, 2);
  if (T.walls) for (const w of T.walls) {
    const fade = sstep(w.s0 - 30, w.s0 + 10, s) * (1 - sstep(w.s1 - 10, w.s1 + 30, s));
    if (fade > 0) h += fade * 24 * sstep(T.hw + w.off + 0.6, T.hw + w.off + 7, d) * (0.85 + 0.15 * nz.n2(x / 9, z / 9));
  }
  return h;
}

function buildTerrain(T, nz) {
  const st = T.st, cell = 4, margin = 330;
  const b = T.bbox;
  const x0 = Math.floor((b.minX - margin) / cell) * cell, z0 = Math.floor((b.minZ - margin) / cell) * cell;
  const nx = Math.ceil((b.maxX + margin - x0) / cell) + 1, nzc = Math.ceil((b.maxZ + margin - z0) / cell) + 1;
  const Hh = new Float32Array(nx * nzc), D = new Float32Array(nx * nzc), Ls = new Float32Array(nx * nzc);
  // coarse samples for baseline
  const cs = [], CC = 64, chash = new Map();
  for (let i = 0; i < T.n; i += 8) cs.push(i);
  for (const i of cs) { const kk = hkey(Math.floor(T.X[i] / CC), Math.floor(T.Z[i] / CC)); let a = chash.get(kk); if (!a) { a = []; chash.set(kk, a); } a.push(i); }
  let meanY = 0; for (let i = 0; i < T.n; i++) meanY += T.Y[i]; meanY /= T.n;
  const tmp = {};
  const hw = T.hw, flat = hw + 1.6;
  const W_CUT = 1 / (185 * 185 + 900), N_CUT = 1 / ((46 * 46 + 1) * (46 * 46 + 1));
  for (let j = 0; j < nzc; j++) {
    const z = z0 + j * cell;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell;
      // baseline (smooth cutoff so terrain stays continuous)
      const cx = Math.floor(x / CC), cz = Math.floor(z / CC);
      let ws = 2e-6, wy = 2e-6 * meanY, dC = 1e4;
      for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) {
        const arr = chash.get(hkey(cx + a, cz + c)); if (!arr) continue;
        for (const q of arr) {
          const dx = x - T.X[q], dz = z - T.Z[q]; const dd = dx * dx + dz * dz;
          if (dd < dC) dC = dd;
          const w = 1 / (dd + 900) - W_CUT; if (w > 0) { ws += w; wy += w * T.Y[q]; }
        }
      }
      dC = Math.sqrt(dC);
      const baseline = wy / ws;
      // near road
      const ni = nearest(T, x, z, 56);
      let d = Math.max(56, dC), lat = 0, s = 0, roadY = baseline, nearB = baseline;
      if (ni >= 0) {
        project(T, ni, x, z, tmp); d = tmp.dist; lat = tmp.lat; s = tmp.s; roadY = tmp.roadY;
        let w2 = 0, y2 = 0;
        const r = 3, ccx = Math.floor(x / CELL), ccz = Math.floor(z / CELL);
        for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) {
          const arr = T.hash.get(hkey(ccx + a, ccz + c)); if (!arr) continue;
          for (const q of arr) { const dx = x - T.X[q], dz = z - T.Z[q]; const dd = dx * dx + dz * dz + 1; const w = 1 / (dd * dd) - N_CUT; if (w > 0) { w2 += w; y2 += w * T.Y[q]; } }
        }
        nearB = w2 > 0 ? y2 / w2 : roadY;
      }
      const natural = lerp(nearB, baseline, sstep(16, 52, d)) + terrainNatural(st, nz, x, z, d, lat, s, T);
      let hgt;
      if (d < flat) hgt = roadY - 0.18;
      else { const t = sstep(flat, hw + st.blend, d); hgt = lerp(nearB - 0.18, natural, t); }
      const idx = j * nx + i;
      Hh[idx] = hgt; D[idx] = d; Ls[idx] = s;
    }
  }
  return { x0, z0, cell, nx, nz: nzc, H: Hh, D, S: Ls };
}

function terrainH(TR, x, z) {
  let fx = (x - TR.x0) / TR.cell, fz = (z - TR.z0) / TR.cell;
  fx = clamp(fx, 0, TR.nx - 1.001); fz = clamp(fz, 0, TR.nz - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = TR.H[j * TR.nx + i], b = TR.H[j * TR.nx + i + 1], c = TR.H[(j + 1) * TR.nx + i], d = TR.H[(j + 1) * TR.nx + i + 1];
  // triangles: (a,b,c) and (b,d,c)
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

// ---------------- Objects ----------------
function placeObjects(T, TR, nz) {
  const st = T.st, R = rng(st.seed * 7 + 3), hw = T.hw;
  const out = { trees: [], rocks: [], cacti: [], fans: [], chevrons: [], hay: [], boards: [] };
  const cols = new Map();
  const addCol = (x, z, r, kind) => {
    const kk = hkey(Math.floor(x / CELL), Math.floor(z / CELL)); let a = cols.get(kk); if (!a) { a = []; cols.set(kk, a); } a.push({ x, z, r, kind });
  };
  const tmp = {};
  const roadDist = (x, z) => { const i = nearest(T, x, z, 60); if (i < 0) return 1e4; project(T, i, x, z, tmp); return tmp.dist; };
  const inWall = (s) => T.walls.some(w => s > w.s0 - 40 && s < w.s1 + 40);
  const nearStartFinish = (s) => s < 70 || s > T.L - 80;
  const scatter = (count, dmin, dmax, bias, fn) => {
    let tries = 0, made = 0;
    while (made < count && tries < count * 6) {
      tries++;
      const i = (R() * T.n) | 0;
      const side = R() < 0.5 ? -1 : 1;
      const d = dmin + Math.pow(R(), bias) * (dmax - dmin);
      const h = T.H[i];
      const rx = -Math.cos(h), rz = Math.sin(h);
      const x = T.X[i] + rx * d * side + (R() - 0.5) * 6, z = T.Z[i] + rz * d * side + (R() - 0.5) * 6;
      const rd = roadDist(x, z);
      if (rd < dmin) continue;
      if (fn(x, z, rd, i * 2, side)) made++;
    }
  };
  if (st.id === 'forest') {
    // rows of pines walking along both verges, then the forest filling in behind them
    const rows = [[hw + 4.6, 5.5], [hw + 8.5, 6], [hw + 13, 6.5], [hw + 19, 7.5]];
    for (const side of [-1, 1]) for (const [off, gap] of rows) {
      for (let s = 0; s < T.L; s += gap * (0.75 + R() * 0.5)) {
        if (nearStartFinish(s) && off < hw + 12) continue;
        const i = Math.min(T.n - 1, Math.round(s / 2)), h = T.H[i], rx = -Math.cos(h) * side, rz = Math.sin(h) * side;
        const o = off + (R() - 0.3) * 2.2;
        const x = T.X[i] + rx * o + (R() - 0.5) * 1.5, z = T.Z[i] + rz * o + (R() - 0.5) * 1.5;
        const d = roadDist(x, z);
        if (d < hw + 4.2) continue; // the inside of bends, where another part of the road passes close
        const sc = 0.8 + R() * 0.55;
        out.trees.push({ x, z, y: terrainH(TR, x, z) - 0.2, rot: R() * 6.28, s: sc, sy: sc * (0.95 + R() * 0.4), type: 0, c: R() });
        if (d < 40) addCol(x, z, 0.45 * sc, 'tree');
      }
    }
    scatter(3200, hw + 22, 170, 1.4, (x, z, d, s) => {
      const sc = 0.8 + R() * 0.6;
      out.trees.push({ x, z, y: terrainH(TR, x, z) - 0.2, rot: R() * 6.28, s: sc, sy: sc * (0.9 + R() * 0.4), type: R() < 0.06 ? 1 : 0, c: R() });
      if (d < 40) addCol(x, z, 0.45 * sc, 'tree');
      return true;
    });
    scatter(110, hw + 3.2, 30, 1.4, (x, z, d, s) => {
      if (nearStartFinish(s)) return false;
      const sc = 0.4 + R() * 0.8; out.rocks.push({ x, z, y: terrainH(TR, x, z) - 0.15 * sc, rot: R() * 6.28, s: sc, sy: sc * (0.6 + R() * 0.4), c: R() });
      addCol(x, z, 0.8 * sc, 'rock'); return true;
    });
  } else if (st.id === 'pine') {
    scatter(2700, hw + 5.5, 170, 1.7, (x, z, d, s) => {
      if (nearStartFinish(s) && d < hw + 10) return false;
      const birch = R() < 0.18;
      const sc = (birch ? 0.8 : 1.0) * (0.75 + R() * 0.6);
      out.trees.push({ x, z, y: terrainH(TR, x, z) - 0.2, rot: R() * 6.28, s: sc, sy: sc * (0.85 + R() * 0.35), type: birch ? 1 : 0, c: R() });
      if (d < 40) addCol(x, z, 0.45 * sc, 'tree');
      return true;
    });
    scatter(140, hw + 3.2, 40, 1.4, (x, z, d, s) => {
      if (nearStartFinish(s)) return false;
      const sc = 0.4 + R() * 0.9; out.rocks.push({ x, z, y: terrainH(TR, x, z) - 0.15 * sc, rot: R() * 6.28, s: sc, sy: sc * (0.6 + R() * 0.4), c: R() });
      addCol(x, z, 0.8 * sc, 'rock'); return true;
    });
  } else if (st.id === 'frost') {
    scatter(2000, hw + 6.5, 170, 1.6, (x, z, d, s) => {
      if (nearStartFinish(s) && d < hw + 10) return false;
      const sc = 0.75 + R() * 0.65;
      out.trees.push({ x, z, y: terrainH(TR, x, z) - 0.3, rot: R() * 6.28, s: sc, sy: sc * (0.9 + R() * 0.4), type: 2, c: R() });
      if (d < 40) addCol(x, z, 0.45 * sc, 'tree');
      return true;
    });
    scatter(60, hw + 5, 40, 1.4, (x, z, d, s) => {
      const sc = 0.5 + R() * 1.0; out.rocks.push({ x, z, y: terrainH(TR, x, z) - 0.25 * sc, rot: R() * 6.28, s: sc, sy: sc * 0.7, c: R() });
      addCol(x, z, 0.8 * sc, 'rock'); return true;
    });
  } else {
    scatter(170, hw + 4, 220, 1.5, (x, z, d, s) => {
      if (inWall(s) && d < 40) return false;
      const big = d > 30 && R() < 0.4;
      const sc = big ? 2 + R() * 3 : 0.4 + R() * 1.1;
      out.rocks.push({ x, z, y: terrainH(TR, x, z) - 0.2 * sc, rot: R() * 6.28, s: sc, sy: sc * (0.5 + R() * 0.5), c: R() });
      if (d < 45) addCol(x, z, 0.8 * sc, 'rock'); return true;
    });
    scatter(190, hw + 5, 130, 1.4, (x, z, d, s) => {
      if (inWall(s) && d < 40) return false;
      const sc = 0.7 + R() * 0.7;
      out.cacti.push({ x, z, y: terrainH(TR, x, z) - 0.1, rot: R() * 6.28, s: sc, sy: sc * (0.8 + R() * 0.5), type: R() < 0.6 ? 0 : 1, c: R() });
      if (d < 40) addCol(x, z, 0.4 * sc, 'cactus'); return true;
    });
  }
  // spectators, chevrons, hay
  const fanColors = 12;
  const addFanGroup = (s, side, dist, count, spread) => {
    for (let k = 0; k < count; k++) {
      const ss = s + (R() - 0.5) * spread;
      const p = sampleAt(T, ss);
      const rx = -Math.cos(p.h), rz = Math.sin(p.h);
      const d = dist + R() * 4;
      const x = p.x + rx * d * side, z = p.z + rz * d * side;
      if (roadDist(x, z) < hw + 7.5) continue;
      if (inWall(ss)) continue;
      out.fans.push({ x, z, y: terrainH(TR, x, z), rot: Math.atan2(-rx * side, -rz * side) + (R() - 0.5) * 0.8, c: (R() * fanColors) | 0, ph: R() * 6.28, h: 0.9 + R() * 0.2 });
      addCol(x, z, 0.35, 'fan');
    }
  };
  for (const nt of T.notes) {
    if (nt.mid < 80 || nt.mid > T.L - 90) continue;
    if (nt.kind === 'turn') {
      const tight = nt.sev === 'H' || nt.sev <= 3;
      if (tight && R() < 0.75) addFanGroup(nt.mid, nt.dir > 0 ? -1 : 1, hw + 9, 6 + ((R() * 8) | 0), 22);
      if (nt.sev === 'H' || nt.sev <= 2) {
        const out_ = nt.dir > 0 ? 1 : -1; // outside of a left turn is the right side (+lat)
        const p0 = sampleAt(T, nt.s + 6);
        for (let q = 0; q < 4; q++) {
          const ss = nt.mid - 12 + q * 8;
          if (ss > nt.end) break;
          const p = sampleAt(T, ss);
          const rx = -Math.cos(p.h), rz = Math.sin(p.h);
          const x = p.x + rx * (hw + 3.6) * out_, z = p.z + rz * (hw + 3.6) * out_;
          if (roadDist(x, z) < hw + 2.6) continue;
          out.chevrons.push({ x, z, y: terrainH(TR, x, z), rot: p0.h + PI, dir: nt.dir });
        }
      } else if ((nt.sev === 4 || nt.sev === 5) && R() < 0.6 && !inWall(nt.mid)) {
        const out_ = nt.dir > 0 ? 1 : -1;
        for (let q = 0; q < 3; q++) {
          const p = sampleAt(T, nt.end - 10 + q * 4);
          const rx = -Math.cos(p.h), rz = Math.sin(p.h);
          const x = p.x + rx * (hw + 3.6) * out_, z = p.z + rz * (hw + 3.6) * out_;
          if (roadDist(x, z) < hw + 2.6) continue;
          out.hay.push({ x, z, y: terrainH(TR, x, z), rot: p.h });
          addCol(x, z, 0.75, 'hay');
        }
      }
    } else if (nt.kind === 'jump') {
      addFanGroup(nt.mid + 30, 1, hw + 10, 7, 30);
      addFanGroup(nt.mid + 30, -1, hw + 10, 7, 30);
    }
  }
  addFanGroup(30, 1, hw + 8, 8, 26); addFanGroup(30, -1, hw + 8, 8, 26);
  addFanGroup(T.finishS + 10, 1, hw + 8, 8, 26); addFanGroup(T.finishS + 10, -1, hw + 8, 8, 26);
  out.cols = cols;
  return out;
}

// ---------------- World ----------------
function buildWorld(stageIndex) {
  const st = STAGES[stageIndex];
  const T = buildTrack(st);
  const nz = makeNoise(st.seed);
  const TR = buildTerrain(T, nz);
  const O = placeObjects(T, TR, nz);
  const W = { st, T, TR, O, nz };
  return W;
}

// ---------------- Car physics ----------------
function locate(T, c) {
  const lo = Math.max(0, c.idx - 10), hi = Math.min(T.n - 1, c.idx + 26);
  let bi = c.idx, bd = 1e18;
  for (let i = lo; i <= hi; i++) { const dx = c.x - T.X[i], dz = c.z - T.Z[i]; const d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  c.idx = bi;
  project(T, bi, c.x, c.z, c.rd);
  c.s = c.rd.s; c.lat = c.rd.lat;
}

function groundAt(W, c, x, z) {
  // uses the car's current road frame (valid within a few meters)
  const T = W.T, rd = c.rd;
  const dx = x - c.x, dz = z - c.z;
  const lat = c.lat + dx * rd.rx + dz * rd.rz;
  const a = Math.abs(lat), hw = T.hw;
  if (a <= hw) return roadYAt(T, c.s + dx * rd.tx + dz * rd.tz);
  const th = terrainH(W.TR, x, z);
  if (a >= hw + 1.6) return th;
  return lerp(roadYAt(T, c.s + dx * rd.tx + dz * rd.tz), th, (a - hw) / 1.6);
}

function makeCar(W, P, s0) {
  const c = { x: 0, y: 0, z: 0, h: 0, vx: 0, vy: 0, vz: 0, w: 0, vF: 0, vR: 0, steer: 0, rpm: P.engine.idle, gear: 1, shiftT: 0,
    boost: 0, spinV: 0, ax: 0, limiter: 0, air: false, airT: 0, idx: 0, s: 0, lat: 0, gyPrev: 0, slope: 0, slip: 0, beta: 0,
    wheelspin: 0, onRoad: true, hitV: 0, landV: 0, bankP: 0, shifted: 0, lifted: 0, thrE: 0, rd: {} };
  resetCar(W, c, s0);
  return c;
}

function resetCar(W, c, s) {
  const T = W.T;
  const p = sampleAt(T, s);
  c.x = p.x; c.z = p.z; c.h = p.h; c.idx = p.i;
  c.vx = c.vz = c.vy = c.w = c.vF = c.vR = 0; c.steer = 0; c.air = false; c.airT = 0; c.gear = 1; c.shiftT = 0;
  c.spinV = 0; c.ax = 0; c.boost = 0; c.limiter = 0;
  locate(T, c);
  c.y = groundAt(W, c, c.x, c.z); c.gyPrev = c.y; c.slope = 0;
}

const tyreF = al => Math.sin(1.45 * Math.atan(al));
const TUNE = { assist: 0.5, yawDamp: 0.7, turnAssist: 0.55, frontGrip: 1.0, rearGrip: 1.08, Bmul: 1, lockK: 17, latGrip: 1.1, absF: 0.4, absR: 0.35, tcF: 0.4, tcR: 0.6, hold: 6, holdK: 1.4, wt: 0.6, spinMax: 4.5, holdB: 0.6, trail: 3, trailK: 1.2, lowGrip: 0.12, edgeA: -0.1, edgeB: 2.0, edgeMix: 0.5, edgeBin: 0, slideA: 0.03, slideB: 0.2, slideF: 1, spinK: 5, spinB: 0.5, spinV: 12, impactP: 0.6 };

function stepCar(W, c, P, inp, dt) {
  const T = W.T;
  locate(T, c);
  c.onRoad = Math.abs(c.lat) < T.hw + 0.35;
  c.shifted = 0; c.wheelspin = 0;
  // gear requests are edge events handled once per step
  gearbox(c, P, inp);
  const n = 2, h = dt / n;
  for (let i = 0; i < n; i++) {
    dynamics(W, c, P, inp, h);
    c.x += c.vx * h; c.z += c.vz * h;
  }
  collide(W, c);
  locate(T, c);
  softWalls(W, c, dt);
  // vertical
  const gy = groundAt(W, c, c.x, c.z);
  c.vy -= G * dt; c.y += c.vy * dt;
  let gvy = (gy - c.gyPrev) / dt; c.gyPrev = gy;
  if (gvy > 7) gvy = 7;
  if (c.y <= gy) {
    const imp = gvy - c.vy;
    if (c.air && imp > 2.5) { c.landV = Math.max(c.landV, imp); if (imp > 6) { c.vx *= 0.96; c.vz *= 0.96; } }
    c.y = gy; if (c.vy < gvy) c.vy = gvy;
  }
  c.air = (c.y - gy) > 0.08;
  c.airT = c.air ? c.airT + dt : 0;
  const nfx = Math.sin(c.h), nfz = Math.cos(c.h);
  const ga = groundAt(W, c, c.x + nfx * 1.3, c.z + nfz * 1.3), gb = groundAt(W, c, c.x - nfx * 1.3, c.z - nfz * 1.3);
  c.slope = clamp((ga - gb) / 2.6, -0.6, 0.6);
}

function gearbox(c, P, inp) {
  const E = P.engine, n = P.gearbox.gears;
  const vF = c.vF;
  // reverse engages when stopped with the brake held
  if (c.gear >= 1 && vF < 0.4 && inp.brk > 0.5 && inp.thr < 0.1) { c.gear = -1; c.shiftT = 0; }
  else if (c.gear === -1 && ((inp.thr > 0.1 && vF > -0.8) || (inp.brk < 0.1 && vF > -0.3 && inp.thr > 0))) { c.gear = 1; }
  if (c.gear < 1) return;
  const rpmAt = g => Math.abs(vF) / RW * P.ratios[g - 1] * P.final * 60 / (2 * PI);
  if (inp.manual) {
    if (inp.shiftUp && c.gear < n && c.shiftT <= 0) { c.gear++; c.shiftT = P.gearbox.shift; c.shifted = 1; }
    if (inp.shiftDown && c.gear > 1 && rpmAt(c.gear - 1) < E.redline + 250) { c.gear--; c.shifted = -1; c.shiftT = P.gearbox.shift * 0.5; }
    return;
  }
  if (!c.air && c.gear < n && c.shiftT <= 0 && c.rpm > E.redline - 220 && (c.spinV < 2.5 || rpmAt(c.gear) > E.redline * 0.72)) { c.gear++; c.shiftT = P.gearbox.shift; c.shifted = 1; }
  else if (c.gear > 1 && rpmAt(c.gear) < E.redline * 0.52 && rpmAt(c.gear - 1) < E.redline - 900) { c.gear--; c.shifted = -1; }
}

function dynamics(W, c, P, inp, dt) {
  const st = W.st, E = P.engine;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
  // surface under each axle: grip fades from road to verge to off-road as the wheels cross the edge,
  // so dropping two wheels off loosens that end of the car instead of the whole car switching at once
  const hw = W.T.hw, along = c.rd && c.rd.rx !== undefined ? fx * c.rd.rx + fz * c.rd.rz : 0;
  const offAt = lat => TUNE.edgeBin ? (Math.abs(c.lat) > hw + 0.35 ? 1 : 0) : sstep(hw + TUNE.edgeA, hw + TUNE.edgeB, Math.abs(lat));
  const oF = offAt(c.lat + P.a * along), oR = offAt(c.lat - P.b * along), oM = (oF + oR) / 2;
  const offF = lerp(oF, oM, TUNE.edgeMix), offR = lerp(oR, oM, TUNE.edgeMix);
  const muF = lerp(st.grip, st.offGrip, offF) * P.tyre, muR = lerp(st.grip, st.offGrip, offR) * P.tyre;
  const mu = (muF + muR) / 2;
  const BtF = lerp(st.tyreB, 6.5, offF) * TUNE.Bmul, BtR = lerp(st.tyreB, 6.5, offR) * TUNE.Bmul;
  let vx = c.vx * fx + c.vz * fz;          // forward
  let vy = -(c.vx * rx + c.vz * rz);       // left
  let r = c.w;                              // yaw rate, + = left
  const spd = Math.hypot(vx, vy);
  // steering input smoothing (keyboard ramps, pads are direct)
  const tgt = clamp(inp.steer, -1, 1);
  // keys turn the wheel quickly at hairpin speeds and more gently at speed, so taps are corrections, not lunges
  const kSpd = clamp((spd - 8) / 32, 0, 1);
  const rate = inp.analog ? 18 : (tgt === 0 || Math.sign(tgt) !== Math.sign(c.steer) ? 9.9 * lerp(1.1, 0.85, kSpd) : 7.2 * lerp(1.15, 0.72, kSpd));
  c.steer += clamp(tgt - c.steer, -rate * dt, rate * dt);
  const rev = c.gear === -1;
  const thr = rev ? inp.brk : inp.thr, brk = rev ? inp.thr : inp.brk;
  c.thrE = thr;
  // ---- engine & drivetrain ----
  const ratio = c.gear > 0 ? P.ratios[c.gear - 1] : 3.1;
  const kG = ratio * P.final;
  let rpm = (Math.abs(vx) + c.spinV) / RW * kG * 60 / (2 * PI);
  if ((c.gear === 1 || rev) && thr > 0.05) rpm = Math.max(rpm, 1400 + thr * 2600); // slipping clutch on launch
  if (c.air) rpm = Math.max(rpm, c.rpm + (E.idle + thr * (E.redline + 100 - E.idle) - c.rpm) * Math.min(1, dt * 7));
  rpm = Math.max(rpm, E.idle);
  if (c.shiftT > 0) { c.shiftT -= dt; rpm = c.rpm + (rpm - c.rpm) * Math.min(1, dt * 18); }
  c.rpm = rpm;
  if (c.rpm >= E.redline) c.limiter = 0.045;
  if (c.limiter > 0) c.limiter -= dt;
  const bt = thr * clamp((c.rpm - E.onset) / 1800, 0, 1);
  if (bt > c.boost) c.boost += (bt - c.boost) * Math.min(1, E.spool * dt);
  else c.boost += (bt - c.boost) * Math.min(1, (E.antilag ? 0.7 : 4.5) * dt);
  let Teng = thr * torqueAt(P, c.rpm) * (E.na + (1 - E.na) * c.boost);
  if (c.shiftT > 0 || c.limiter > 0) Teng = 0;
  let Fdrive = Teng * kG * 0.86 / RW * (rev ? -1 : 1);
  if (thr < 0.05) Fdrive = -0.1 * E.nmCap * (c.rpm / E.redline) * kG * 0.86 / RW * clamp(vx / 3, -1, 1);
  if (c.air) {
    r *= Math.pow(0.55, dt);
    const k = Math.max(0, 1 - 0.6 * P.CdA * spd / P.mass * dt);
    c.vx *= k; c.vz *= k;
    c.w = r; c.h += r * dt;
    c.vF = vx; c.vR = -vy;
    c.spinV = Math.max(0, c.spinV - 20 * dt);
    return;
  }
  // ---- loads ----
  const m = P.mass, L = P.wb, a = P.a, b = P.b;
  const down = 0.6 * P.ClA * vx * vx;
  const dFz = m * c.ax * P.cgH / L * (c.ax < 0 ? TUNE.wt : 1); // under braking grip follows the load shift only partly (tyre load sensitivity)
  const Fzf = Math.max(0.15 * m * G, m * G * b / L + down * 0.45 - dFz);
  const Fzr = Math.max(0.15 * m * G, m * G * a / L + down * 0.55 + dFz);
  // a little extra bite at hairpin speeds, fading out by ~70 km/h
  const lowG = 1 + TUNE.lowGrip * (1 - clamp((spd - 5) / 15, 0, 1));
  const capF = muF * Fzf, capR = muR * Fzr;
  // ---- steering angle with self-aligning help ----
  const lockV = P.lock * Math.max(0.27, 1 / (1 + Math.abs(vx) / TUNE.lockK));
  const beta = Math.atan2(vy, Math.abs(vx) + 0.5);
  let delta = -c.steer * lockV;
  if (vx > 1) delta += TUNE.assist * beta * clamp(spd / 6, 0, 1);
  delta = clamp(delta, -P.lock, P.lock);
  // ---- longitudinal per axle ----
  const sgn = vx >= 0 ? 1 : -1;
  let FdF = Fdrive * P.drive.front, FdR = Fdrive * (1 - P.drive.front);
  const Fbrake = brk * P.brake * m * G;
  // brakes stop short of locking when the wheel is turned (ABS-like), so the fronts keep steering under braking
  const sU = Math.abs(c.steer);
  let FbF = Math.min(Fbrake * 0.66, capF * lerp(0.97, TUNE.absF, sU)), FbR = Math.min(Fbrake * 0.34, capR * lerp(0.72, TUNE.absR, sU));
  if (inp.hb) FbR = capR * 0.95;
  // traction limits, with the centre diff passing some excess to the other axle
  let excess = 0;
  const lim = (Fd, Fb, cap) => { const tot = Math.abs(Fd - sgn * Fb); return tot > cap ? tot - cap : 0; };
  // with the wheel turned, drive can only use part of each tyre (the rest is wheelspin), so full throttle never kills steering.
  // A tyre that is already running sideways (a slide caught with the wheel straight) keeps the same share for cornering
  // force, so flooring it pulls the car out of the slide instead of spinning both axles up and sliding on.
  const drv = Fdrive > 0 ? 1 : 0;
  const vxs = Math.max(Math.abs(vx), 0.6);
  const sideF = sstep(TUNE.slideA, TUNE.slideB, Math.abs(Math.atan2(vy + a * r, vxs) - delta * sgn)) * TUNE.slideF;
  const sideR = sstep(TUNE.slideA, TUNE.slideB, Math.abs(Math.atan2(vy - b * r, vxs)));
  const capFx = capF * lerp(1, TUNE.tcF, Math.max(sU, sideF) * drv), capRx = capR * lerp(1, TUNE.tcR, Math.max(sU, sideR) * drv);
  let exF = lim(FdF, FbF, capFx), exR = lim(FdR, FbR, capRx);
  if (exF > 0 && Fdrive * FdF > 0) {
    // the centre diff only passes on torque the front genuinely can't use, not what the steering cap holds back
    const moved = Math.min(lim(FdF, FbF, capF) * 0.6, Math.max(0, capRx - Math.abs(FdR)));
    FdR += Math.sign(FdF) * moved; FdF -= Math.sign(FdF) * exF; excess += exF - moved;
  }
  exR = lim(FdR, FbR, capRx);
  if (exR > 0 && Fdrive * FdR > 0 && !inp.hb) { FdR -= Math.sign(FdR) * exR; excess += exR; }
  const FxF = clamp(FdF - sgn * FbF, -capF, capF), FxR = clamp(FdR - sgn * FbR, -capR, capR);
  c.wheelspin = excess / m;
  // wheelspin settles at a slip that grows with the surplus torque instead of running into the rev limiter
  if (excess > 0 && thr > 0.3) { const sT = Math.min(TUNE.spinMax, 1 + excess / m * 0.5); c.spinV += (sT - c.spinV) * Math.min(1, dt * 10); }
  else c.spinV = Math.max(0, c.spinV - 26 * dt);
  // ---- lateral (tyre curve + friction circle) ----
  const vxa = Math.max(Math.abs(vx), 0.6);
  const af = Math.atan2(vy + a * r, vxa) - delta * sgn;
  const ar = Math.atan2(vy - b * r, vxa);
  const kF = Math.sqrt(Math.max(0, 1 - (FxF / capF) * (FxF / capF)));
  const kR = inp.hb ? 0.3 : Math.sqrt(Math.max(0.04, 1 - (FxR / capR) * (FxR / capR)));
  const FyF = -capF * tyreF(BtF * af) * kF * TUNE.frontGrip * (P.frontGrip || 1) * TUNE.latGrip * lowG;
  const FyR = -capR * tyreF(BtR * ar) * kR * TUNE.rearGrip * (P.rearGrip || 1) * TUNE.latGrip * lowG;
  // ---- forces ----
  const cd = Math.cos(delta), sd = Math.sin(delta);
  const drag = 0.6 * P.CdA * vx * Math.abs(vx);
  const roll = (0.015 * m * G + st.offDrag * m * 0.5 * (offF + offR) / 2) * clamp(vx / 1.5, -1, 1);
  const Fx = FxF * cd - FyF * sd + FxR - drag - roll - m * G * c.slope * 0.9;
  const Fy = FyF * cd + FxF * sd + FyR;
  const Mz = a * (FyF * cd + FxF * sd) - b * FyR;
  // arcade turn-in help, scaled by the car's agility
  const assist = -c.steer * P.agility * TUNE.turnAssist * clamp(spd / 10, 0, 1) * clamp(1 - Math.abs(beta) * 3, 0, 1) * (inp.hb ? 0 : 1);
  if (c._dbgOn) c._dbg = { FyF, FyR, FxF, FxR, delta, af, ar, kF, kR, Mz, assist, capF, capR, beta };
  // body-frame forces applied to the world velocity (re-projection each step accounts for frame rotation)
  vx += (Fx / m) * dt;
  vy += (Fy / m) * dt;
  r += (Mz / P.Iz + assist) * dt;
  // hold the rotation the driver asks for once the car is sliding (hairpins, handbrake turns): if the yaw rate falls
  // short of what the steering and the available grip allow, nudge it back up. Never adds beyond that target.
  if (c.steer !== 0 && vx > 2 && !inp.hb) {
    const rKin = vx * Math.tan(lockV * Math.abs(c.steer)) / L, rGrip = mu * TUNE.latGrip * lowG * G / Math.max(spd, 3);
    // at hairpin speeds it may rotate a little past the grip limit (a power slide), at speed it only restores it
    const rT = -Math.sign(c.steer) * Math.min(rKin, rGrip * lerp(TUNE.holdK, 1, clamp((spd - 12) / 8, 0, 1)));
    const short = (rT - r) * Math.sign(rT);
    // active once the car is sliding, fading out again past ~30 degrees so it never drives a spin
    const gate = clamp((Math.abs(beta) - 0.06) / 0.12, 0, 1) * clamp((TUNE.holdB - Math.abs(beta)) / 0.15, 0, 1);
    if (short > 0) r += Math.sign(rT) * short * TUNE.hold * P.agility * gate * dt;
  }
  // trail braking: braking with the wheel turned brings the yaw rate up to what the corner needs, so the nose
  // tucks in instead of the car ploughing straight on. Only ever closes the gap to a grip-limited target.
  if (brk > 0.05 && c.steer !== 0 && vx > 3 && !inp.hb) {
    const rKin = vx * Math.tan(lockV * Math.abs(c.steer)) / L, rGrip = mu * TUNE.latGrip * lowG * G / Math.max(spd, 3);
    const rT = -Math.sign(c.steer) * Math.min(rKin, rGrip * TUNE.trailK);
    const short = (rT - r) * Math.sign(rT);
    if (short > 0) r += Math.sign(rT) * short * TUNE.trail * Math.min(1, brk * 1.5) * P.agility * clamp(1 - Math.abs(beta) / 0.45, 0, 1) * dt;
  }
  r -= r * TUNE.yawDamp * (inp.hb ? 0.3 : 1) * dt;
  // spin catch: once the car is well past the angle a driver can hold and still rotating further into it,
  // bleed some of that rotation. Never with the handbrake up, and only as speed builds: at hairpin speed big
  // angles are the point. Keyboard-driver bots spin about 4x less with it; handbrake hairpin times are unchanged.
  if (!inp.hb && TUNE.spinK > 0 && r * beta < 0) {
    const over = clamp((Math.abs(beta) - TUNE.spinB) / 0.35, 0, 1) * clamp((spd - TUNE.spinV) / 8, 0, 1);
    if (over > 0) r -= r * TUNE.spinK * over * dt;
  }
  c.ax += (Fx / m - c.ax) * Math.min(1, dt * 8);
  // low speed: blend towards rolling kinematics (no slip-angle blow-up)
  if (spd < 4 && !(inp.hb && spd > 1.5)) {
    const kb = clamp((spd - 0.4) / 3.6, 0, 1);
    const rk = vx * Math.tan(delta) / L;
    r = lerp(rk, r, kb); vy = lerp(b * rk, vy, kb);
  }
  if (Math.abs(vx) < 0.05 && thr < 0.05) { vx = 0; if (Math.abs(vy) < 0.05) vy = 0; }
  if (rev && vx < -11) vx = -11;
  c.w = r; c.h += r * dt;
  c.vx = fx * vx - rx * vy; c.vz = fz * vx - rz * vy;
  c.vF = vx; c.vR = -vy;
  c.beta = Math.atan2(-vy, Math.abs(vx) + 0.6);
  c.slip = Math.abs(vy - b * r) + c.spinV * 0.3;
}

function collide(W, c) {
  const cols = W.O.cols;
  const fx = Math.sin(c.h), fz = Math.cos(c.h);
  for (let k = 0; k < 2; k++) {
    const off = k === 0 ? 1.2 : -1.1;
    const cx = c.x + fx * off, cz = c.z + fz * off, R = 1.0;
    const gx = Math.floor(cx / CELL), gz = Math.floor(cz / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = cols.get(hkey(gx + a, gz + b)); if (!arr) continue;
      for (const o of arr) {
        const dx = (c.x + fx * off) - o.x, dz = (c.z + fz * off) - o.z; const md = R + o.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < md * md) {
          const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d, pen = md - d;
          c.x += nx * pen; c.z += nz * pen;
          // bounce off the obstacle; the speed lost scales with how square the hit is, so a graze along the
          // forest edge costs a few percent while a head-on hit still kills the speed. (A full rigid-body impulse was
          // tried: it wedged the car against trunks more often and played worse with keyboard-driver bots.)
          const vn = c.vx * nx + c.vz * nz;
          if (vn < 0) {
            const sp = Math.hypot(c.vx, c.vz) || 1, sq = Math.min(1, -vn / sp);
            const e = o.kind === 'hay' ? 0.1 : 0.25;
            c.vx -= (1 + e) * vn * nx; c.vz -= (1 + e) * vn * nz;
            const keep = 1 - (o.kind === 'hay' ? 0.25 : 0.18) * Math.pow(sq, TUNE.impactP);
            c.vx *= keep; c.vz *= keep;
            c.w += (off > 0 ? 1 : -1) * (fx * nz - fz * nx) * Math.min(-vn, 14) * 0.13;
            if (-vn > c.hitV) { c.hitV = -vn; c.hitKind = o.kind; c.hitX = o.x; c.hitZ = o.z; c.hitNx = nx; c.hitNz = nz; c.hitFront = off > 0; }
            if (-vn > 4 && !c.air) c.vy = Math.max(c.vy, Math.min(1.4, -vn * 0.07));
          }
        }
      }
    }
  }
}

function softWalls(W, c, dt) {
  const st = W.st, T = W.T;
  let off = null, k = 0, damp = 0, scrub = 0, hard = 2.2;
  if (st.bank) { off = st.bank; k = st.bankK; damp = st.bankDamp; scrub = st.bankScrub; }
  else if (T.walls.length) {
    for (const w of T.walls) if (c.s >= w.s0 && c.s <= w.s1) { off = w.off; k = 260; damp = 16; scrub = 1.2; hard = 0.7; }
  }
  c.bankP = 0;
  if (off === null) return;
  const lat = c.lat;
  const p = Math.abs(lat) - (T.hw + off);
  if (p <= 0) return;
  const sg = Math.sign(lat), nx = c.rd.rx * sg, nz = c.rd.rz * sg;
  const vo = c.vx * nx + c.vz * nz;
  const acc = -k * p - (vo > 0 ? vo * damp : 0);
  c.vx += nx * acc * dt; c.vz += nz * acc * dt;
  const sc = Math.max(0, 1 - scrub * Math.min(p, 1.5) * dt);
  c.vx *= sc; c.vz *= sc;
  if (p > hard) {
    const q = p - hard; c.x -= nx * q; c.z -= nz * q;
    const vo2 = c.vx * nx + c.vz * nz;
    if (vo2 > 0) { c.vx -= nx * vo2 * 1.2; c.vz -= nz * vo2 * 1.2; if (vo2 > c.hitV) { c.hitV = vo2; c.hitKind = st.bank ? 'bank' : 'wall'; c.hitX = c.x + nx * 1.0; c.hitZ = c.z + nz * 1.0; c.hitNx = -nx; c.hitNz = -nz; c.hitFront = false; } }
  }
  c.bankP = p;
}

// ---------------- AI driver (rival ghost) ----------------
function prepAI(W, P, aggr) {
  const T = W.T, st = W.st, n = T.n;
  const k = new Float64Array(n); for (let i = 0; i < n; i++) k[i] = T.K[i];
  const ks = blur(k, 10);
  const off = new Float64Array(n);
  const fOff = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let km = 0; for (let j = -12; j <= 12; j++) km = Math.max(km, Math.abs(T.K[clamp(i + j, 0, n - 1)]));
    fOff[i] = clamp(1 - (km - 0.022) / 0.03, 0, 1);
    off[i] = clamp(-ks[i] * 900, -1, 1) * (T.hw - 2.8) * fOff[i];
  }
  const offS = blur(blur(off, 8), 8);
  // effective curvature of racing line (reduced)
  const vmax = new Float64Array(n);
  const mu = st.grip * P.tyre;
  for (let i = 0; i < n; i++) {
    let kk = 0; for (let j = -3; j <= 3; j++) { const q = clamp(i + j, 0, n - 1); kk = Math.max(kk, Math.abs(ks[q]) * 0.35 + Math.abs(T.K[q]) * 0.65); }
    const keff = Math.max(kk * (1 - 0.03 * fOff[i]), 1e-4);
    const den = 1 - mu * aggr * 0.6 * P.ClA / (P.mass * keff);
    const v2 = den > 0.05 ? mu * G * aggr / keff / den : 1e6;
    vmax[i] = Math.min(P.vtop * 1.05, Math.sqrt(v2));
  }
  // backward pass: speed you can still brake down from; no braking while airborne after a jump lip
  const decel = mu * G * 0.72;
  const airZone = new Uint8Array(n);
  for (const e of T.events) if (e.type === 'J') for (let q = Math.floor(e.s / 2); q < Math.min(n, Math.floor((e.s + 50) / 2)); q++) airZone[q] = 1;
  const vprof = new Float64Array(n);
  vprof[n - 1] = vmax[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    const nxt = vprof[i + 1];
    const reach = airZone[i] ? nxt : Math.sqrt(nxt * nxt + 2 * decel * 2);
    vprof[i] = Math.min(vmax[i], reach);
  }
  return { off: offS, vmax, vprof, mu };
}

function aiDrive(W, c, P, ai) {
  const T = W.T;
  const v = Math.max(0, c.vF);
  // Stanley-style tracking of the racing line, referenced at the front axle
  const sf = c.s + P.a;
  const p = sampleAt(T, sf);
  const oi = clamp(Math.round(sf / 2), 0, T.n - 1);
  const look = clamp(Math.round((sf + v * 0.25) / 2), 0, T.n - 1);
  const tgtLat = ai.off[oi];
  const e = (c.lat - P.a * Math.sin(wrapA(c.h - p.h))) - tgtLat; // + = right of target
  const course = c.h - (v > 2 ? c.beta : 0);
  const psi = wrapA(p.h - course);
  const kappa = T.K[look];
  let dLeft = psi + clamp(Math.atan2(1.0 * e, v + 4), -0.1, 0.1) + Math.atan(P.wb * kappa) * 1.05 - 0.15 * (c.w - v * kappa);
  const lockV = P.lock * Math.max(0.27, 1 / (1 + Math.abs(c.vF) / TUNE.lockK));
  const spdA = Math.hypot(c.vx, c.vz);
  dLeft += c.vF > 1 ? TUNE.assist * clamp(c.beta, -0.05, 0.05) * clamp(spdA / 6, 0, 1) : 0;
  let steer = clamp(-dLeft / lockV, -1, 1);
  // speed target
  const i0 = clamp(Math.round(c.s / 2), 0, T.n - 1);
  let target = 1e9;
  for (let j = 0; j <= 3 && i0 + j < T.n; j++) target = Math.min(target, ai.vprof[i0 + j]);
  let thr = 0, brk = 0;
  if (v < target - 0.5) thr = 1; else if (v < target + 0.5) thr = 0.35;
  if (v > 6) thr = Math.min(thr, 1 - 0.6 * Math.abs(steer));
  if (Math.abs(c.beta) > 0.1 && v > 6) thr = Math.min(thr, 0.3);
  if (v > target + 1.2) brk = clamp((v - target) / 4, 0.2, 1);
  return { steer, thr, brk, hb: false, analog: true };
}

function simulateRun(W, P, opts) {
  opts = opts || {};
  const T = W.T, dt = 1 / 120;
  const ai = prepAI(W, P, opts.aggr || 0.9);
  const c = makeCar(W, P, T.spawnS);
  const ghost = [];
  let t = 0, gt = 0, offT = 0, hits = 0, maxAir = 0, resets = 0, maxLand = 0, stuck = 0;
  const splits = [];
  while (t < 420) {
    const inp = aiDrive(W, c, P, ai);
    stepCar(W, c, P, inp, dt);
    t += dt; gt += dt;
    if (gt >= 0.05) { gt -= 0.05; ghost.push(c.x, c.y, c.z, c.h); }
    if (!c.onRoad) offT += dt;
    if (c.hitV > 3) hits++;
    c.hitV = 0;
    maxAir = Math.max(maxAir, c.airT); maxLand = Math.max(maxLand, c.landV); c.landV = 0;
    if (splits.length < T.splits.length && c.s >= T.splits[splits.length]) splits.push(t);
    stuck = (Math.hypot(c.vx, c.vz) < 1.5) ? stuck + dt : 0;
    if (Math.abs(c.lat) > 26 || stuck > 2.5) { resetCar(W, c, Math.max(T.spawnS, c.s - 10)); resets++; stuck = 0; }
    if (c.s >= T.finishS) break;
  }
  return { time: t, ghost: new Float32Array(ghost), offT, hits, maxAir, maxLand, resets, splits, finished: c.s >= T.finishS };
}

// ---------------- Spec sheet measurement (flat dry tarmac) ----------------
let FLAT = null;
function flatWorld() {
  if (FLAT) return FLAT;
  const st = { id: 'flat', grip: 1.12, offGrip: 1.12, offDrag: 0, tyreB: 11, hw: 60, h0: 0, seed: 1, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 6000]] };
  const T = buildTrack(st);
  T.walls = [];
  FLAT = { st, T, TR: { x0: -5000, z0: -5000, cell: 20000, nx: 2, nz: 2, H: new Float32Array(4) }, O: { cols: new Map() } };
  return FLAT;
}
function measureCar(P) {
  const W = flatWorld(), c = makeCar(W, P, 20), dt = 1 / 120;
  let t = 0, t100 = 0, t160 = 0, vmax = 0;
  while (t < 45) {
    stepCar(W, c, P, { steer: 0, thr: 1, brk: 0, hb: false }, dt); t += dt;
    const kmh = c.vF * 3.6;
    if (!t100 && kmh >= 100) t100 = t;
    if (!t160 && kmh >= 160) t160 = t;
    vmax = Math.max(vmax, kmh);
  }
  P.spec = { t100, t160, vmax };
  return P.spec;
}
CARS.forEach(measureCar);

return { TUNE, CARS, STAGES, RADIUS, RW, carStats, torqueAt, engineCurve, measureCar, buildWorld, buildTrack, makeNoise, rng, sampleAt, roadYAt, terrainH, nearest, project,
  makeCar, resetCar, stepCar, locate, groundAt, simulateRun, prepAI, aiDrive, clamp, lerp, sstep, wrapA, hkey, CELL };
})();
if (typeof module !== 'undefined') module.exports = RallyCore;
