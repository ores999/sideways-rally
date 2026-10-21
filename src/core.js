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
    feel: { lag: 0.15, kick: 1.0, ayc: 0.5, push: 0, twitch: 0.85 },
    character: 'Modern and precise. Active diffs pull it into corners and the sequential box snaps through the gears: the easiest car to drive fast.',
    col: { base: '#1d4fa3', roof: '#f2f2ee', lower: '#14336e', stripe: '#f2f2ee', stripe2: '#d7262e', rim: '#e4e4e4', text: '#ffffff' } },
  { id: 'impressa', name: 'Subaru Impreza WRC', note: 'The Prodrive-built, boxer-engined World Rally Car', era: 'WRC · 1998', cls: 'WRC', num: 5, shape: 'sedan', wing: 'big',
    engine: { code: 'EJ20 Boxer', layout: 'Flat-4', cyl: 4, boxer: true, disp: 1994, asp: 'Turbo · anti-lag', hp: 300, hpRpm: 5500, nmCap: 560, redline: 7000, idle: 900, onset: 2300, spool: 7, antilag: true, na: 0.46, boostBar: 2.4, shape: 2.4 },
    gearbox: { type: 'Sequential', gears: 6, shift: 0.05, top: 195 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Active centre diff' },
    mass: 1230, wd: 0.55, wb: 2.52, cgH: 0.43, inertia: 0.97, CdA: 0.76, ClA: 0.42, brake: 1.15, lock: 0.55, tyre: 1.03, agility: 1.0,
    feel: { lag: 0.2, kick: 1.0, ayc: 0.35, push: 0, twitch: 0.9 },
    character: 'The low boxer engine keeps it planted and balanced. Slides come on gently and are easy to hold.',
    col: { base: '#1b3f96', roof: '#1b3f96', lower: '#1b3f96', stripe: '#ffd21a', stripe2: '#ffd21a', rim: '#c9a33b', text: '#ffd21a' } },
  { id: 'lancha', name: 'Mitsubishi Lancer Evo VI', note: 'Ralliart\'s Group A Evo, world champion in 1999', era: 'Group A · 1999', cls: 'Group A', num: 7, shape: 'sedan', wing: 'big',
    engine: { code: '4G63T', layout: 'Inline-4', cyl: 4, disp: 1997, asp: 'Turbo · anti-lag', hp: 300, hpRpm: 6500, nmCap: 540, redline: 7500, idle: 950, onset: 2200, spool: 6.5, antilag: true, na: 0.45, boostBar: 2.3, shape: 2.6 },
    gearbox: { type: 'H-pattern', gears: 6, shift: 0.15, top: 205 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Active yaw control' },
    mass: 1230, wd: 0.57, wb: 2.51, cgH: 0.48, inertia: 1.0, CdA: 0.82, ClA: 0.42, brake: 1.12, lock: 0.55, tyre: 1.0, agility: 1.08,
    feel: { lag: 0.25, kick: 1.05, ayc: 0.9, push: 0, twitch: 1.0 },
    character: 'Active yaw control turns the car on the throttle: turn in, floor it and the nose tucks in. The H-pattern box makes every shift count.',
    col: { base: '#f3f3f1', roof: '#f3f3f1', lower: '#141414', stripe: '#d3191f', stripe2: '#141414', rim: '#f3f3f1', text: '#d3191f' } },
  { id: 'delta', name: 'Lancia Delta HF Integrale', note: 'The Group A legend behind six makes\' titles in a row', era: 'Group A · 1992', cls: 'Group A', num: 1, shape: 'boxhatch', wing: 'roof',
    engine: { code: '16V Turbo', layout: 'Inline-4', cyl: 4, disp: 1995, asp: 'Turbo', hp: 295, hpRpm: 7000, nmCap: 430, redline: 7800, idle: 1000, onset: 3000, spool: 5, antilag: false, flutter: true, na: 0.42, boostBar: 1.9, shape: 2.2 },
    gearbox: { type: 'H-pattern', gears: 6, shift: 0.17, top: 190 },
    drive: { layout: 'AWD', front: 0.47, diff: 'Epicyclic + Torsen' },
    mass: 1120, wd: 0.56, wb: 2.48, cgH: 0.5, inertia: 0.92, CdA: 0.8, ClA: 0.15, brake: 1.05, lock: 0.58, tyre: 0.98, agility: 1.18,
    feel: { lag: 0.45, kick: 1.1, ayc: 0, push: 0.05, twitch: 1.12 },
    character: 'Light, tall and darty, with no anti-lag: lift and the boost is gone. Keep the revs up out of slow corners.',
    col: { base: '#f5f5f2', roof: '#f5f5f2', lower: '#f5f5f2', stripe: '#45a6de', stripe2: '#122f7a', stripe3: '#d6262b', rim: '#eeeeee', text: '#122f7a' } },
  { id: 'pejo', name: 'Peugeot 205 T16', note: 'Mid-engined Group B champion of 1985 and 1986', era: 'Group B · 1985', cls: 'Group B', num: 2, shape: 'small', wing: 'roof',
    engine: { code: 'XU8T', layout: 'Inline-4 (mid)', cyl: 4, disp: 1775, asp: 'Turbo', hp: 370, hpRpm: 7500, nmCap: 450, redline: 8300, idle: 1100, onset: 3000, spool: 3.3, antilag: false, flutter: true, na: 0.5, boostBar: 2.2, shape: 2.1 },
    gearbox: { type: 'H-pattern', gears: 5, shift: 0.2, top: 200 },
    drive: { layout: 'AWD', front: 0.42, diff: 'Rear-biased centre diff' },
    mass: 910, wd: 0.43, wb: 2.54, cgH: 0.45, inertia: 0.95, frontGrip: 1.04, rearGrip: 1.04, CdA: 0.72, ClA: 0.25, brake: 1.15, lock: 0.6, tyre: 1.0, agility: 1.08,
    feel: { lag: 0.5, kick: 1.25, ayc: 0, push: 0, twitch: 1.2 },
    character: 'Mid-engined Group B. The tail wants to come round and the turbo arrives late and all at once: catch it early, short-shift on loose ground.',
    col: { base: '#f5f5f2', roof: '#f5f5f2', lower: '#f5f5f2', stripe: '#1d3c8f', stripe2: '#f5c400', stripe3: '#d6262b', rim: '#f2f2f2', text: '#1d3c8f' } },
  { id: 'kwattro', name: 'Audi Sport Quattro S1', note: 'The short-wheelbase, five-cylinder Group B Quattro', era: 'Group B · 1986', cls: 'Group B', num: 3, shape: 'coupe', wing: 'big',
    engine: { code: '20V Five', layout: 'Inline-5', cyl: 5, disp: 2110, asp: 'Turbo · recirculation', hp: 470, hpRpm: 7800, nmCap: 590, redline: 8400, idle: 1000, onset: 4000, spool: 3.0, antilag: true, na: 0.36, boostBar: 2.6, shape: 2.0 },
    gearbox: { type: 'H-pattern', gears: 6, shift: 0.18, top: 210 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Locking centre diff' },
    mass: 1090, wd: 0.61, wb: 2.22, cgH: 0.5, inertia: 1.06, rearGrip: 1.03, CdA: 0.86, ClA: 0.55, brake: 1.05, lock: 0.55, tyre: 0.97, agility: 0.88,
    feel: { lag: 0.7, kick: 1.35, ayc: 0, push: 0.45, twitch: 0.95 },
    character: 'Five cylinders, 470 hp and a heavy nose. Huge turbo lag, then a wall of boost that pushes it wide. Brake early, turn in on the brakes and wait for it.',
    col: { base: '#f1efe8', roof: '#f1efe8', lower: '#f1efe8', stripe: '#c41e2a', stripe2: '#d9a43a', rim: '#d9a43a', text: '#c41e2a' } },
  { id: 'selica', name: 'Toyota Celica GT-Four', note: 'Toyota Team Europe\'s four-wheel-drive Group A turbo', era: 'Group A · 1995', cls: 'Group A', num: 6, shape: 'liftback', wing: 'big',
    engine: { code: '3S-GTE', layout: 'Inline-4', cyl: 4, disp: 1998, asp: 'Turbo · anti-lag', hp: 299, hpRpm: 6000, nmCap: 520, redline: 7200, idle: 900, onset: 2400, spool: 6.5, antilag: true, na: 0.45, boostBar: 2.2, shape: 2.5 },
    gearbox: { type: 'Sequential', gears: 6, shift: 0.07, top: 200 },
    drive: { layout: 'AWD', front: 0.5, diff: 'Viscous centre diff' },
    mass: 1200, wd: 0.58, wb: 2.54, cgH: 0.47, inertia: 1.0, CdA: 0.76, ClA: 0.4, brake: 1.12, lock: 0.56, tyre: 1.0, agility: 1.02,
    feel: { lag: 0.25, kick: 1.0, ayc: 0.1, push: 0.15, twitch: 0.85 },
    character: 'Heavy, stable and built to last. It understeers a little if you rush the entry, and forgives almost anything.',
    col: { base: '#f4f4f0', roof: '#f4f4f0', lower: '#f4f4f0', stripe: '#d4202c', stripe2: '#1f8a4c', stripe3: '#f2c230', rim: '#f2f2f2', text: '#d4202c' } },
  // the bonus car: only the driver who holds the fastest time on a road may take it there, and its times never count
  { id: 'saveiro', name: 'Volkswagen Saveiro Cross', note: 'White, raised, speakers in the bed. The keys go to whoever holds No. 1 on the road', era: 'Pickup · Bonus', cls: 'Bonus', num: 1, shape: 'pickup', wing: 'none', bonus: true,
    engine: { code: 'EA211 "No. 1"', layout: 'Inline-4', cyl: 4, disp: 1598, asp: 'Turbo · anti-lag', hp: 560, hpRpm: 6800, nmCap: 700, redline: 7600, idle: 850, onset: 1800, spool: 9, antilag: true, na: 0.5, boostBar: 3.0, shape: 2.6 },
    gearbox: { type: 'Sequential', gears: 6, shift: 0.04, top: 235 },
    drive: { layout: 'AWD', front: 0.45, diff: '4MOTION, obviously' },
    // exaggerated on purpose: grip and brakes far past any rally car, so it turns like nothing and stops on a coin
    mass: 1080, wd: 0.56, wb: 2.75, cgH: 0.38, inertia: 0.75, CdA: 0.86, ClA: 2.4, brake: 2.6, lock: 0.72, tyre: 1.75, agility: 1.6, frontGrip: 1.12,
    feel: { lag: 0.05, kick: 1.0, ayc: 0.6, push: 0, twitch: 0.85 },
    character: 'A pickup with 560 hp, a sound system in the bed, grip from another planet and brakes that stop it on a coin. Only the fastest driver on a road gets the keys, and its times go on the board without ever counting.',
    col: { base: '#f4f4f1', roof: '#f4f4f1', lower: '#1b1c1f', stripe: '#d4a62a', stripe2: '#1b1c1f', rim: '#d9ad3a', text: '#1b1c1f', gold: '#d4a62a' } },
  // a V8-era Formula 1 car, only for the Monaco street circuit (`only`): normally aspirated (na 1, no boost), seamless
  // 7-speed, rear drive, slicks and wings. Its times are kept apart from the rally cars'
  { id: 'f1', name: 'Ferrari F2008', note: 'Scuderia Ferrari\'s 2.4-litre V8 Formula 1 car. Monaco only', era: 'Formula 1 · 2008', cls: 'F1', num: 2, shape: 'f1', wing: 'none', only: 'monaco',
    engine: { code: 'Tipo 056', layout: 'V8 (90°)', cyl: 8, disp: 2398, asp: 'Normally aspirated', hp: 760, hpRpm: 18500, nmCap: 320, redline: 19000, idle: 4200, onset: 1e5, spool: 1, antilag: false, na: 1, boostBar: 0, shape: 0.7 },
    gearbox: { type: 'Seamless', gears: 7, shift: 0.02, top: 300 },
    drive: { layout: 'RWD', front: 0, diff: 'Hydraulic diff' },
    // lockV: full lock at hairpin speed, little of it at 200 km/h (with this much grip a key tap was a swerve);
    // rearGrip keeps the tail planted when it brakes hard with the wheel turned (the load all goes to the front)
    mass: 605, wd: 0.46, wb: 3.1, cgH: 0.3, inertia: 0.9, CdA: 1.25, ClA: 4.5, brake: 3.0, lock: 0.55, lockV: [15, 0.115], tyre: 1.45, rearGrip: 1.12, agility: 1.0,
    feel: { lag: 0, kick: 1, ayc: 0, push: 0, twitch: 0.9 },
    character: 'Seven hundred and sixty horsepower at 19,000 rpm in a car that weighs as much as a rally car\'s engine and gearbox. The wings press it down harder the faster it goes, the brakes are brutal, and the rear tyres spin up the moment you get greedy out of a slow corner.',
    col: { base: '#d40a14', roof: '#d40a14', lower: '#141516', stripe: '#f4f4f1', stripe2: '#141516', rim: '#3a3c40', text: '#f4f4f1', helmet: '#f2d21a' } },
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
    lag: sp.lag || 0.3,
    stability: (2 - (c.feel || {}).twitch || 1) + c.ClA * 0.3 - (c.agility - 1) * 0.7 + (c.wd - 0.5) * 0.8,
  };
}
function carStats(c) {
  // the F1 is off any rally car's scale: the bars are set by the others and it fills them (or not) like they do
  const all = CARS.filter(o => !o.only).map(carStatsRaw), me = carStatsRaw(c), out = {};
  for (const k of Object.keys(me)) {
    const vs = all.map(o => o[k]), lo = Math.min(...vs), hi = Math.max(...vs);
    out[k] = clamp(Math.round(3 + 7 * (hi > lo ? (me[k] - lo) / (hi - lo) : 1)), 1, 10);
  }
  return out;
}

// ---------------- Stages ----------------
// Q: a square corner at a city junction. It always turns exactly its nominal angle (the others turn whatever their
// rounded sample count gives), so a city route stays on its street grid however many corners it takes
const RADIUS = { 6: 190, 5: 125, 4: 82, 3: 54, 2: 35, 1: 23, H: 12.5, Q: 9 };

// the Monaco lap (OpenStreetMap contributors, ODbL): centreline every 4 m from the line, the sea's outline, the
// pontoons (packed: decimetre steps, game axes x east, z south), and the climbs (fraction of the lap, metres)
const MONACO = {"path": "0,0;-4,-40;-3,-40;-3,-40;-3,-39;-3,-40;-3,-40;-3,-40;-4,-40;-3,-40;-4,-40;-3,-40;-2,-40;-2,-39;-2,-40;-2,-40;-1,-40;-1,-40;0,-40;1,-40;1,-40;2,-40;2,-40;2,-40;3,-40;3,-40;3,-40;4,-40;5,-39;5,-40;6,-40;6,-39;8,-39;8,-40;8,-39;10,-39;10,-38;11,-39;11,-38;12,-38;12,-38;12,-39;12,-38;11,-38;9,-39;8,-39;6,-40;6,-40;6,-39;6,-40;7,-39;8,-39;13,-38;18,-35;27,-30;34,-21;38,-13;39,-8;40,-6;39,-5;40,-5;40,-5;39,-6;40,-5;40,-5;39,-5;40,-6;39,-5;40,-6;40,-5;39,-6;40,-5;40,-6;39,-6;40,-6;39,-6;40,-7;39,-7;39,-8;40,-7;39,-9;39,-8;39,-10;38,-10;39,-10;39,-10;38,-11;39,-11;38,-11;38,-11;39,-12;38,-11;39,-11;38,-12;38,-11;39,-12;38,-11;38,-12;39,-11;38,-11;39,-11;38,-11;39,-10;38,-11;39,-11;38,-10;39,-11;39,-10;39,-9;39,-8;39,-8;39,-6;40,-6;40,-5;40,-4;39,-5;40,-4;40,-5;40,-4;39,-4;40,-4;40,-4;40,-5;39,-8;39,-10;38,-12;37,-14;37,-15;36,-17;37,-17;36,-17;36,-18;36,-17;36,-17;36,-18;36,-17;36,-17;36,-18;36,-17;36,-18;36,-17;36,-17;37,-17;36,-16;37,-15;38,-13;38,-13;38,-12;39,-11;38,-10;39,-10;39,-10;38,-11;39,-11;38,-11;38,-12;39,-12;38,-12;38,-12;38,-11;40,-7;40,-2;39,-2;38,10;40,1;40,-3;40,-5;39,-7;39,-7;40,-8;38,-10;38,-12;38,-14;37,-15;36,-17;36,-18;34,-21;34,-21;32,-24;32,-24;31,-25;30,-26;30,-28;28,-28;27,-30;25,-31;25,-31;22,-33;21,-34;18,-36;15,-37;10,-39;7,-39;4,-40;0,-40;-2,-40;-4,-40;-5,-39;-7,-40;-8,-39;-9,-39;-12,-38;-13,-38;-15,-37;-15,-37;-17,-36;-17,-36;-19,-36;-23,-33;-27,-29;-30,-26;-31,-26;-30,-26;-30,-27;-30,-26;-30,-27;-29,-27;-29,-27;-28,-29;-26,-31;-22,-33;-19,-35;-15,-37;-10,-39;-5,-40;2,-40;6,-39;11,-38;14,-38;17,-36;18,-36;21,-34;22,-34;23,-33;23,-32;24,-32;23,-33;24,-32;23,-32;24,-32;24,-33;24,-32;23,-32;24,-32;24,-32;23,-33;24,-32;23,-33;23,-32;24,-33;23,-32;24,-32;24,-32;25,-32;24,-32;24,-31;25,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;24,-32;25,-31;25,-32;26,-29;32,-25;36,-16;40,-5;39,5;38,12;36,19;31,24;28,29;24,32;18,36;12,38;8,39;4,40;2,40;3,40;5,39;9,40;13,37;17,37;19,35;22,33;22,33;23,33;23,33;23,33;23,33;22,33;20,35;18,35;17,36;18,36;23,33;31,25;38,10;39,-7;34,-21;23,-33;8,-39;-7,-39;-18,-35;-25,-31;-28,-30;-27,-28;-28,-29;-26,-31;-24,-31;-25,-32;-24,-32;-23,-32;-24,-33;-23,-32;-20,-35;-15,-37;-7,-39;4,-40;14,-37;23,-33;31,-25;35,-20;36,-16;38,-13;38,-11;39,-10;39,-11;38,-12;37,-15;37,-14;37,-16;38,-14;37,-13;38,-13;39,-10;39,-8;40,-5;40,0;39,6;37,15;29,27;18,35;8,40;1,40;-1,40;-1,40;-2,40;-2,40;-2,40;-1,39;-2,40;-2,40;-2,40;-2,40;-2,40;-2,40;-1,40;-2,40;-2,40;-2,40;-2,40;-3,40;-2,40;-3,40;-4,40;-4,39;-5,40;-5,40;-5,39;-6,40;-7,39;-7,40;-7,39;-8,39;-9,39;-9,39;-9,39;-10,39;-10,39;-11,38;-11,39;-12,38;-12,38;-13,38;-13,38;-14,37;-14,38;-15,37;-15,37;-15,37;-16,37;-16,36;-17,36;-18,36;-17,36;-18,36;-19,35;-19,36;-19,35;-20,34;-20,35;-21,34;-21,34;-22,34;-22,33;-22,33;-23,33;-23,33;-23,32;-24,32;-25,32;-24,32;-26,31;-25,31;-26,30;-26,30;-27,30;-27,30;-27,29;-28,29;-28,28;-28,29;-29,28;-28,27;-30,27;-29,27;-30,27;-31,26;-30,26;-31,25;-32,25;-31,24;-32,25;-32,23;-33,24;-32,23;-33,23;-34,22;-33,22;-34,21;-34,21;-34,21;-35,20;-35,20;-35,19;-35,19;-35,18;-36,19;-36,18;-35,18;-36,18;-36,18;-35,18;-36,18;-36,18;-36,18;-35,18;-36,18;-35,19;-36,18;-36,18;-35,18;-36,18;-36,18;-36,16;-38,15;-37,14;-38,12;-38,13;-38,13;-38,13;-38,12;-38,13;-38,12;-38,12;-39,10;-38,11;-39,9;-39,10;-39,10;-39,9;-39,9;-39,7;-39,7;-40,7;-39,7;-40,6;-39,7;-40,7;-39,7;-39,7;-40,7;-39,7;-39,7;-40,7;-39,7;-40,7;-39,7;-40,6;-39,7;-39,8;-38,12;-33,22;-19,35;-7,39;-3,40;-8,39;-20,34;-33,22;-39,11;-39,6;-40,2;-40,-5;-38,-12;-36,-17;-37,-16;-38,-11;-40,-3;-40,3;-40,5;-39,6;-40,6;-39,5;-40,6;-40,5;-39,6;-40,5;-40,5;-39,6;-40,5;-39,5;-40,6;-40,5;-39,6;-40,5;-40,5;-39,6;-40,5;-40,5;-39,6;-40,5;-40,6;-39,5;-40,5;-39,6;-40,5;-40,6;-39,5;-40,6;-40,5;-39,6;-40,6;-39,7;-39,7;-40,7;-39,7;-40,6;-39,6;-40,5;-40,5;-39,5;-40,5;-40,5;-39,5;-40,6;-40,5;-40,5;-39,5;-40,5;-40,5;-39,7;-39,10;-36,17;-32,24;-27,29;-23,33;-20,34;-20,35;-18,36;-18,35;-18,36;-17,36;-17,37;-16,36;-15,37;-14,38;-13,38;-12,38;-12,38;-11,39;-11,38;-10,39;-9,39;-8,39;-7,39;-7,40;-5,39;-5,40;-4,40;-2,40;-2,40;0,40;0,40;0,40;1,40;2,40;3,40;5,39;8,40;10,38;12,38;14,38;19,35;24,32;29,28;30,26;32,24;32,24;31,25;30,26;27,30;22,33;16,37;9,39;6,40;5,39;5,40;7,39;7,40;7,39;7,39;8,40;7,39;7,39;8,40;7,39;7,39;8,40;7,39;7,39;7,40;8,39;7,39;7,40;8,39;7,39;8,40;9,39;9,38;10,39;8,40;4,39;-3,40;-15,37;-24,32;-30,26;-33,23;-34,21;-31,26;-22,33;-9,38;1,40;6,40;9,39;11,38;12,38;12,38;14,38;13,38;14,37;14,38;15,37;15,37;17,36;17,37;17,36;17,36;18,35;19,36;19,35;20,34;21,34;22,34;23,32;25,32;25,31;26,31;26,30;28,29;28,28;30,27;31,25;31,25;33,23;34,21;35,20;35,18;36,18;36,17;37,17;35,17;36,20;33,21;31,26;24,32;16,37;7,39;-4,39;-16,37;-27,29;-34,21;-37,15;-38,12;-39,11;-38,11;-39,11;-38,11;-39,10;-39,10;-39,8;-40,6;-39,6;-40,4;-40,3;-40,1;-40,-2;-40,-4;-38,-10;-37,-17;-31,-24;-25,-32;-16,-36;-9,-39;-7,-39;-8,-40;-11,-38;-13,-38;-16,-36;-19,-35;-22,-34;-23,-33;-25,-31;-25,-31;-25,-32;-23,-32;-23,-33;-22,-34;-21,-33;-21,-34;-22,-34;-21,-34;-21,-34;-21,-34;-20,-35;-19,-35;-18,-36;-18,-36;-16,-36;-14,-38;-13,-38;-11,-38;-12,-38;-10,-39;-11,-38;-10,-39;-11,-38;-11,-39;-12,-38;-12,-38;-12,-39;-11,-38;-11,-38;-12,-39;-11,-38;-11,-38;-11,-39;-11,-38;-11,-39;-11,-38;-11,-39;-11,-38;-10,-39;-11,-39;-10,-38;-10,-39;-10,-39;-9,-39;-8,-39;-8,-39;-8,-39;-7,-40;-7,-39;-6,-40;-7,-39;-6,-40;-6,-39;-7,-40;-6,-39;-6,-40;-6,-39;-6,-40;-5,-39;-5,-40;-4,-40;-5,-40;-5,-39;-4,-40", "sea": "-26104,17285;212,150;238,-72;1205,-749;2382,-300;-62,193;262,322;1073,15;-134,391;224,164;364,-279;949,188;332,-437;802,165;-107,342;516,437;71,-454;307,-195;103,-546;-114,-276;277,-247;150,-508;513,-222;552,16;1238,314;176,432;1199,577;266,760;733,547;347,-92;354,-430;-262,-364;-516,-21;-22,-471;480,-176;188,-369;352,-217;-61,-199;873,-210;184,-267;1347,-265;354,-348;511,-687;133,-589;551,-395;-82,-156;-311,188;-182,-168;-94,-259;169,-416;1226,-1028;336,-31;146,360;778,50;1159,768;206,-282;-160,28;-1303,-838;101,-174;-181,-48;190,-7;-178,-68;34,-247;909,-687;2172,1522;-1191,1342;-1149,59;13,219;1202,-121;1942,-1965;164,-165;59,60;69,14;22,-8;63,-62;1,-88;-62,-66;856,-853;49,49;89,7;63,-64;8,-27;-14,-68;-49,-47;279,-275;2398,-1552;-120,-182;-404,254;-19,-33;-519,346;11,22;-138,78;-89,-16;-103,-69;-265,-223;-165,-203;-67,-125;-62,-138;-112,-315;37,-136;78,4;-17,-247;-79,6;-11,92;-1711,117;-39,-488;-491,28;-73,-1042;451,-62;-14,-85;-1117,159;-41,-92;-44,26;3,-61;19,-9;-91,-194;797,-702;30,31;25,-22;34,31;46,-44;113,52;67,-15;70,24;16,45;112,40;39,-23;65,22;26,34;59,36;59,-22;65,71;111,160;94,32;71,115;70,189;47,-6;39,54;13,128;106,103;94,131;126,23;144,-48;75,14;60,-119;59,14;37,-91;96,-38;43,16;5,-80;78,-60;204,42;118,98;80,29;50,235;-36,52;-3,117;38,32;95,18;53,107;185,132;88,-95;93,-13;117,55;-46,1117;234,13;9,-150;-61,-13;37,-883;55,10;6,13;104,-8;57,12;106,-22;-14,18;6,6;36,-21;59,-2;53,8;13,38;21,2;142,-53;56,-2;185,5;36,34;48,10;21,-34;25,-10;138,-14;50,-45;36,-78;219,-273;82,9;63,-39;130,-3;33,-42;15,-215;127,-83;68,-97;125,-105;93,-40;92,-84;194,-59;30,-47;35,-151;44,-48;110,-8;71,45;46,59;265,75;102,6;66,-39;335,-352;318,-407;-28,-163;58,-273;43,-31;19,4;57,-45;-13,-52;2,-55;133,-143;58,-112;25,-25;71,-28;74,6;27,-11;-4,-16;-60,-27;-13,-35;19,-32;-13,-27;-40,-13;-7,-41;60,-75;-53,-48;5,-77;34,-49;32,-362;961,-1158;-101,-79;8,-18;1063,-1297;1146,-1427;-215,-160;-2241,2701;-115,-95;-408,68;-445,-363;-118,-606;-385,74;70,345;117,-19;222,1139;-1442,401;-35,0;-99,29;3,13;-931,273;-219,-719;157,-48;36,-35;-14,-47;-58,-31;-363,104;-36,52;10,47;54,22;143,-41;219,715;-814,230;-109,-367;-151,-82;-118,-90;-56,-56;-94,-129;-58,-111;-50,-128;-96,-498;22,-140;-77,-390;141,-25;115,563;55,-8;-113,-566;387,-75;128,605;104,-19;-282,-1444;-107,19;108,569;-21,4;7,39;-374,75;-100,-570;-53,9;104,569;-166,33;-151,-760;-70,-89;-100,-42;-117,11;-11,-213;9,-195;31,-207;90,-313;193,-366;2135,-311;139,98;455,-62;-16,-115;883,-118;244,1227;-117,22;69,352;386,-66;-283,-1481;845,-220;764,-226;543,1330;184,-69;38,-45;-541,-1315;65,-25;64,-82;-39,-29;65,-73;10,-52;371,-474;-158,-357;325,-448;-70,-181;226,-280;-78,-181;175,-221;-82,-176;105,-148;-113,-249;-47,-78;41,-480;196,2;125,-290;450,187;-294,732;-68,-28;-29,56;70,28;-63,142;67,27;-130,309;248,102;126,-308;289,117;658,-1598;160,-192;496,-331;209,-260;127,-314;26,-329;-75,-336;-595,-1061;111,-40;-212,-387;2,-124;79,-119;272,-177;188,-280;18,-85;-96,-41;-52,12;-43,54;44,40;-141,171;-132,20;-67,-153;-64,-247;32,-280;111,-343;93,-155;306,-347;235,-188;544,-363;398,-163;143,-41;172,-17;123,22;335,119;63,2;-89,169;-201,134;-39,-53;-27,-9;-26,14;-22,31;-4,32;42,70;38,23;76,-9;195,-103;56,-57;57,-100;66,-159;42,-59;189,-180;5,-33;-12,-42;-26,-32;-44,-14;-41,13;-20,20;37,49;-154,120;-212,-263;70,-242;72,-114;101,-98;101,-75;112,-57;133,-27;98,3;348,657;305,494;128,167;161,127;172,61;151,35;199,16;304,-46;248,-77;517,-443;-636,-2827;82,-143;1345,-916;508,-566;1184,-338;652,19;346,262;1,453;277,-42;148,196;-216,538;481,-268;340,-859;17,-505;559,-476;287,-734;553,-718;626,-471;377,-795;781,-484;557,-669;552,-1028;313,-181;74,-936;365,-680;490,-474;1508,-794;1251,-199;1811,-27;-278,-488;455,-350;1470,-237;1517,-486;134,235;356,145;9,322;117,-76;218,532;513,210;87,249;492,254;1414,1637;241,-48;209,-348;652,400;408,71;19,330;442,386;6,661;556,961;774,262;-28,157;603,606;364,745;121,-64;486,699;182,15;-58,307;452,395;271,-175;-26,238;317,294;225,-62;451,181;77,767;721,112;44,213;627,300;445,-165;237,137;115,328;297,75;-14,135;638,-63;169,368;401,-106;237,213;278,-228;654,439;291,-94;917,412;1550,-348;661,4;182,201;351,-204;518,192;488,540;30000,60000;-78756,62675;-50000,-30000", "piers": ["1026,-300;0,0", "4851,1642;0,0", "-2950,5347;0,0", "-1724,5477;0,0", "-385,6963;0,0", "193,6828;0,0", "1050,6406;0,0", "1771,1011;0,0", "1292,1061;0,0", "4468,1594;0,0", "4206,1827;0,0", "3707,1954;0,0", "3232,2110;0,0", "4567,-974;0,0", "5424,-2514;0,0", "5555,-2543;0,0", "5858,-2629;0,0", "1959,2472;0,0", "2276,2384;0,0", "1490,-433;0,0", "2663,-2139;0,0", "6443,-2462;0,0", "-197,5567;0,0", "-2182,4550;0,0", "2609,2288;0,0", "3235,-2101;0,0", "4958,1614;0,0", "5024,1596;0,0", "5128,1266;0,0", "7639,-5798;0,0"], "elev": [[0.0, 6], [0.06081, 7], [0.08817, 9], [0.14594, 25], [0.19155, 37], [0.23107, 43], [0.27364, 47], [0.30404, 45], [0.33566, 41], [0.38005, 33], [0.4059, 26], [0.43022, 17], [0.46215, 12], [0.57768, 6], [0.62633, 4], [0.71146, 3], [0.82092, 3], [0.87565, 3.5], [0.90909, 4], [1.0, 6]]};

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
    bank: 1.3, bankDrag: 0.9, night: true, snow: true,
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
    tarmac: true, walls: [[0.30, 0.40, 2.6], [0.71, 0.79, 2.6]], // the gorge: rock walls a little off the road
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
    grip: 0.88, offGrip: 0.58, offDrag: 1.6, tyreB: 8, hw: 4.0, h0: 0.4, seed: 4409, blend: 24, rival: 'Colin McRay', rows: true,
    elev: { a1: 4, l1: 150, p1: 0.8, a2: 1.8, l2: 55, p2: 0.6 },
    segs: [
      ['S', 100], ['R', 4, 60], ['S', 70], ['L', 4, 55], ['S', 60], ['C', 1.2], ['S', 80], ['R', 3, 80], ['S', 50],
      ['L', 5, 45], ['R', 5, 45], ['S', 90], ['J', 1.8], ['S', 100], ['L', 2, 90, 'dc'], ['S', 60], ['R', 'H', 165],
      ['S', 90], ['L', 4, 65], ['S', 70], ['R', 3, 85, 'cau'], ['S', 80], ['C', 1.4], ['S', 70], ['L', 5, 50],
      ['R', 4, 60], ['S', 110], ['L', 3, 80], ['S', 60], ['R', 2, 95], ['S', 80], ['J', 2.0], ['S', 90],
      ['L', 4, 60], ['R', 5, 45], ['S', 70], ['L', 3, 85], ['S', 150]
    ] },
  // Monaco: one lap of the street circuit (its shape from OpenStreetMap, its climbs), from the grid round to just
  // short of the line. Armco both sides the whole way; the harbour on one side or the other for most of it
  { id: 'monaco', kind: 'city', name: 'Monaco', region: 'Monte Carlo', surface: 'Tarmac', tag: 'Casino, the hairpin and the tunnel',
    grip: 1.15, offGrip: 1.05, offDrag: 0.3, tyreB: 11, hw: 4.5, h0: 0, seed: 5501, blend: 22, rival: 'Ott Tänakk',
    tarmac: true, town: true, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 },
    street: { gap: 50, path: MONACO.path, sea: MONACO.sea, piers: MONACO.piers, elev: MONACO.elev,
      at: { tunnel0: 0.46215, tunnel1: 0.57768, casino: 0.27364 }, stands: [[0.73579, 0.86652, 1], [0.92429, 0.05473, 1]] } },
];

STAGES.forEach(st => { st.key = st.id; });

// ---------------- Stage variants ----------------
// A stage key names the road and how it is run: '<id>' as built, '<id>-r' driven the other way, plus '-night' or
// '-rain'; 'daily-YYYYMMDD' is a stage generated from the date, the same for everyone that day. Saves (best times,
// medals, challenges) are keyed on it, so a reversed night run has its own records.
const CONDS = ['day', 'night', 'rain'];
function stageKey(id, rev, cond) { return id + (rev ? '-r' : '') + (cond && cond !== 'day' ? '-' + cond : ''); }
const variantCache = new Map();
function stageDef(key) {
  if (variantCache.has(key)) return variantCache.get(key);
  let st = null;
  const dm = /^daily-(\d{8})$/.exec(key || '');
  if (dm) st = dailyStage(dm[1]);
  else {
    const parts = String(key || '').split('-'), base = STAGES.find(b => b.id === parts[0]);
    if (!base) return null;
    const rev = parts.includes('r'), cond = parts.includes('night') ? 'night' : parts.includes('rain') ? 'rain' : 'day';
    if (parts.slice(1).some(q => q !== 'r' && q !== 'night' && q !== 'rain')) return null;
    if (!rev && cond === 'day') st = base;
    else {
      st = Object.assign({}, base, { key, rev, cond });
      // wet: less grip everywhere, and tyres that let go sooner (snow just turns into a blizzard)
      if (cond === 'rain' && base.kind !== 'frost') { st.grip *= base.tarmac ? 0.8 : 0.88; st.offGrip *= 0.88; st.tyreB *= 0.92; }
      if (cond === 'rain' && base.kind === 'frost') { st.grip *= 0.96; }
    }
  }
  if (st) { st.cond = st.cond || 'day'; st.rev = !!st.rev; variantCache.set(key, st); }
  return st;
}
// a readable name for the variant: "Pine Ridge · Reverse · Night"
function condName(st, cond) { cond = cond || st.cond; return cond === 'night' ? 'Night' : cond === 'rain' ? (st.kind === 'frost' ? 'Blizzard' : 'Rain') : st.kind === 'frost' ? 'Dusk' : 'Day'; }
function stageTitle(st) { return st.name + (st.rev ? ' · Reverse' : '') + (st.cond && st.cond !== 'day' ? ' · ' + condName(st) : ''); }

// ---------------- Daily stage ----------------
// Built from the date: corners, straights, jumps and crests in the proportions of the hand-made stages, kept only if
// the road never comes back too close to itself. The biome turns over day by day.
function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const DAILY_RIVALS = ['Marcus Grönhol', 'Juha Kankunnen', 'Carlos Sanz', 'Didier Oriol', 'Petter Solbergg', 'Ari Vatanon', 'Hannu Mikkolla', 'Walter Röhr'];
function genSegs(R, kind) {
  const pick = (w) => { let r = R() * w.reduce((a, x) => a + x[1], 0); for (const [v, k] of w) { if ((r -= k) < 0) return v; } return w[0][0]; };
  const sevW = kind === 'mesa' ? [[6, 0.06], [5, 0.16], [4, 0.22], [3, 0.2], [2, 0.14], [1, 0.04], ['H', 0.18]]
    : [[6, 0.08], [5, 0.2], [4, 0.27], [3, 0.2], [2, 0.12], [1, 0.03], ['H', 0.07]];
  const angFor = sev => sev === 'H' ? 165 + ((R() * 3) | 0) * 5 : sev === 6 ? 35 + R() * 10 : sev === 5 ? 40 + R() * 25 : sev === 4 ? 55 + R() * 25 : sev === 3 ? 75 + R() * 20 : sev === 2 ? 88 + R() * 12 : 85 + R() * 10;
  const segs = [['S', 100 + Math.round(R() * 40)]];
  let len = segs[0][1], dir = R() < 0.5 ? 1 : -1, sinceJump = 0, grade = 0;
  const target = 2800 + R() * 250;
  while (len < target) {
    const sev = pick(sevW);
    dir = R() < 0.66 ? -dir : dir;
    const ang = Math.round(angFor(sev));
    const seg = [dir > 0 ? 'L' : 'R', sev, ang];
    if ((sev === 2 || sev === 3 || sev === 4) && R() < 0.2) seg.push('dc');
    else if ((sev === 2 || sev === 3) && R() < 0.18) seg.push('cau');
    segs.push(seg); len += RADIUS[sev] * ang * PI / 180;
    if (kind === 'mesa' && R() < 0.22) { grade = grade ? 0 : (R() < 0.5 ? 0.04 : -0.035); segs.push(['G', grade]); }
    // most corners open onto a straight; some run straight into the next one
    if (sev === 'H' || R() > 0.22) {
      const sl = sev === 'H' ? 90 + R() * 25 : 40 + R() * 95;
      sinceJump += sl;
      if (sl > 80 && R() < (kind === 'mesa' ? 0.12 : 0.42)) {
        const jump = kind !== 'mesa' && sinceJump > 320 && R() < (kind === 'frost' ? 0.45 : 0.8);
        segs.push(['S', Math.round(sl * 0.5)], jump ? ['J', +(kind === 'frost' ? 1.8 : 1.8 + R() * 0.8).toFixed(1)] : ['C', +(1.2 + R() * 0.4).toFixed(1)], ['S', Math.round(sl * 0.5)]);
        if (jump) sinceJump = 0;
      } else segs.push(['S', Math.round(sl)]);
      len += sl;
    }
  }
  if (grade) segs.push(['G', 0]);
  segs.push(['S', 160]);
  return segs;
}
// the closest the road comes to itself between points more than 140 m apart along it
function selfClearance(T) {
  const cell = 24, grid = new Map();
  for (let i = 0; i < T.n; i++) { const k = hkey(Math.floor(T.X[i] / cell), Math.floor(T.Z[i] / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
  let best = 1e9;
  for (let i = 0; i < T.n; i++) {
    const cx = Math.floor(T.X[i] / cell), cz = Math.floor(T.Z[i] / cell);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const arr = grid.get(hkey(cx + a, cz + b)); if (!arr) continue;
      for (const j of arr) if (j > i + 70) { const d = Math.hypot(T.X[i] - T.X[j], T.Z[i] - T.Z[j]); if (d < best) best = d; }
    }
  }
  return best;
}
function dailyStage(ymd) {
  const kinds = ['pine', 'frost', 'mesa', 'forest'];
  const day = Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) / 86400000);
  const base = STAGES.find(b => b.id === kinds[((day % 4) + 4) % 4]);
  const seed = hashStr('sideways-' + ymd);
  for (let attempt = 0; attempt < 40; attempt++) {
    const R = rng(seed + attempt * 7919);
    const segs = genSegs(R, base.kind);
    const st = Object.assign({}, base, {
      key: 'daily-' + ymd, daily: ymd, segs, seed: (seed % 9000) + 1000 + attempt, h0: R() * 6.28, cond: 'day', rev: false,
      name: 'Daily · ' + base.name, rival: DAILY_RIVALS[day % DAILY_RIVALS.length], tag: 'A new road every day, the same for everyone',
      elev: { a1: base.elev.a1 * (0.7 + R() * 0.6), l1: base.elev.l1 * (0.8 + R() * 0.4), p1: R() * 6.28, a2: base.elev.a2 * (0.7 + R() * 0.6), l2: base.elev.l2 * (0.8 + R() * 0.4), p2: R() * 6.28 },
    });
    if (base.walls) st.walls = [[0.32 + R() * 0.1, 0.0, 2.6]].map(([a, , off]) => [a, a + 0.08, off]);
    const T = buildTrack(st);
    if (selfClearance(T) >= 34 && T.L > 2600 && T.L < 3400) return st;
  }
  return Object.assign({}, base, { key: 'daily-' + ymd, daily: ymd, name: 'Daily · ' + base.name, cond: 'day', rev: false });
}
function dailyKey(date) {
  const d = date || new Date();
  return 'daily-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

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
  let L, px, pz, ph, py, ks;
  if (st.street) ({ L, px, pz, ph, py, ks } = streetRoad(st, notesRaw));
  else {
  let s = 0;
  for (const seg of st.segs) {
    const t = seg[0];
    if (t === 'S') { const n = Math.round(seg[1]); for (let i = 0; i < n; i++) k.push(0); s += n; }
    else if (t === 'L' || t === 'R') {
      const R = RADIUS[seg[1]]; const n = Math.max(4, Math.round(R * seg[2] * PI / 180)); const dir = t === 'L' ? 1 : -1;
      notesRaw.push({ s0: s, s1: s + n, dir, sev: seg[1], ang: seg[2], mods: seg.slice(3) });
      const kk = seg[1] === 'Q' ? dir * seg[2] * PI / 180 / n : dir / R;
      for (let i = 0; i < n; i++) k.push(kk);
      s += n;
    }
    else if (t === 'J' || t === 'C') ev.push({ type: t, s, h: seg[1] });
    else if (t === 'G') grades.push({ s, g: seg[1] });
  }
  L = k.length;
  ks = blur(blur(k, st.kBlur || 6), st.kBlur || 6);
  px = new Float64Array(L + 1); pz = new Float64Array(L + 1); ph = new Float64Array(L + 1); py = new Float64Array(L + 1);
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
  }
  let walls = (st.walls || []).map(([a, b, off]) => ({ s0: Math.round(L * a), s1: Math.round(L * b), off }));
  let evs = ev, nraw = notesRaw, ksr = ks;
  if (st.rev) {
    // the same road driven the other way: same place in the world (so the same scenery around it), every corner
    // mirrored, uphill turned downhill. Jumps and crests are rebuilt facing the new direction of travel.
    const flip = a => { for (let i = 0, j = a.length - 1; i < j; i++, j--) { const t = a[i]; a[i] = a[j]; a[j] = t; } };
    flip(px); flip(pz); flip(py); flip(ph);
    for (let i = 0; i <= L; i++) ph[i] += PI;
    ksr = Float64Array.from(ks, v => -v); flip(ksr);
    nraw = notesRaw.map(r => ({ s0: L - r.s1, s1: L - r.s0, dir: -r.dir, sev: r.sev, ang: r.ang, mods: r.mods })).reverse();
    evs = ev.map(e => ({ type: e.type, s: L - e.s + (e.type === 'J' ? 18 : 0), h: e.h })).reverse();
    walls = walls.map(w => ({ s0: L - w.s1, s1: L - w.s0, off: w.off })).reverse();
  }
  for (const e of evs) for (let i = Math.max(0, e.s - 40); i <= Math.min(L, e.s + 80); i++) py[i] += bump(e, i);

  const n = Math.floor(L / 2) + 1;
  const X = new Float32Array(n), Z = new Float32Array(n), Y = new Float32Array(n), H = new Float32Array(n), K = new Float32Array(n);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    const m = Math.min(2 * i, L);
    X[i] = px[m]; Z[i] = pz[m]; Y[i] = py[m]; H[i] = ph[m]; K[i] = ksr[Math.min(m, L - 1)];
    minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]); minZ = Math.min(minZ, Z[i]); maxZ = Math.max(maxZ, Z[i]);
  }
  const hash = new Map();
  for (let i = 0; i < n; i++) {
    const kk = hkey(Math.floor(X[i] / CELL), Math.floor(Z[i] / CELL));
    let a = hash.get(kk); if (!a) { a = []; hash.set(kk, a); } a.push(i);
  }
  // pace notes
  const notes = [];
  for (const r of nraw) {
    const mods = r.mods.slice();
    if (r.sev !== 'H' && r.ang >= 110) mods.push('long');
    notes.push({ kind: 'turn', s: r.s0 - 8, end: r.s1 + 6, mid: (r.s0 + r.s1) / 2, dir: r.dir, sev: r.sev, ang: r.ang, mods });
  }
  for (const e of evs) notes.push({ kind: e.type === 'J' ? 'jump' : 'crest', s: e.s - (e.type === 'J' ? 22 : 24), end: e.s + 10, mid: e.s, h: e.h, mods: [] });
  notes.sort((a, b) => a.s - b.s);
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i], nx = notes[i + 1];
    const gap = nx ? nx.s - nt.end : (L - nt.end);
    nt.into = !!(nx && gap < 30 && nt.kind === 'turn' && nx.kind === 'turn');
    nt.dist = (nx && gap > 95) ? Math.min(500, Math.round(gap / 50) * 50) : 0;
  }
  const T = { st, L, n, X, Z, Y, H, K, hash, notes, hw: st.hw, events: evs,
    bbox: { minX, maxX, minZ, maxZ }, spawnS: 14, startS: 22, finishS: L - 45,
    splits: [Math.round(L * 0.34), Math.round(L * 0.67)] };
  T.walls = walls;
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

// The car's place on the road, continuous through tight corners. Projecting onto the polyline (project) jumps on
// the inside of a bend: past each vertex the foot of the perpendicular hops forward by about lat × the turn angle,
// ~0.2 m a sample in a hairpin, which on a climbing road kicked the car upwards. Here the position between two
// samples comes from the normal lines at both ends (the same lines the road mesh is built on), so s and lat move
// smoothly and the height under the car is exactly the drawn road's. Falls back to project where those normals
// cross (far inside a bend) or at the ends.
function projectRoad(T, i, x, z, out) {
  let j = i;
  if (i >= T.n - 1) j = T.n - 2;
  else if (i > 0 && (x - T.X[i]) * Math.sin(T.H[i]) + (z - T.Z[i]) * Math.cos(T.H[i]) < 0) j = i - 1;
  const d0 = (x - T.X[j]) * Math.sin(T.H[j]) + (z - T.Z[j]) * Math.cos(T.H[j]);
  const d1 = (x - T.X[j + 1]) * Math.sin(T.H[j + 1]) + (z - T.Z[j + 1]) * Math.cos(T.H[j + 1]);
  if (j === 0 || j === T.n - 2 || !(d0 - d1 > 1e-6)) return project(T, i, x, z, out);
  const f = clamp(d0 / (d0 - d1), 0, 1);
  if (f <= 0 || f >= 1) { if (d0 < -0.01 || d1 > 0.01) return project(T, i, x, z, out); }
  const h = T.H[j] + (T.H[j + 1] - T.H[j]) * f, tx = Math.sin(h), tz = Math.cos(h), rx = -tz, rz = tx;
  const px = lerp(T.X[j], T.X[j + 1], f), pz = lerp(T.Z[j], T.Z[j + 1], f);
  out.lat = (x - px) * rx + (z - pz) * rz;
  if (Math.abs(out.lat) > T.hw + 8) return project(T, i, x, z, out);
  out.s = (j + f) * 2;
  out.roadY = lerp(T.Y[j], T.Y[j + 1], f);
  out.tx = tx; out.tz = tz; out.rx = rx; out.rz = rz;
  out.dist = Math.abs(out.lat);
  out.seg = j;
  return out;
}

// ---------------- Street circuit ----------------
// A stage drawn from a real lap (st.street): its centreline every 4 m from the start line, the sea's outline (the
// coast, land on its left, closed far out at sea), the harbour's pontoons and the climbs (fractions of the lap, metres).
// The road is a spline through the points, sampled every metre; the stage runs from the line round to `gap` metres
// short of it. The rest of the lap is still there, drawn and fenced, so the town closes round.
// Cross-section (metres off the axis): kerb, the Armco just behind it, the building line.
const STREET = { kerb: 5.0, rail: 5.35, line: 8.6, slab: 0.15 };
// "x,z;dx,dz;..." in decimetres
function unpackPts(str) {
  const out = []; let x = 0, z = 0;
  for (const p of str.split(';')) { const c = p.indexOf(','); x += +p.slice(0, c); z += +p.slice(c + 1); out.push([x / 10, z / 10]); }
  return out;
}
// the whole lap as a closed loop, every metre: X, Z, heading H, curvature K and the height Y
function streetLoop(st) {
  const SP = st.street; if (SP.loop) return SP.loop;
  const P = unpackPts(SP.path), m = P.length, fine = [];
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    for (let q = 0; q < 8; q++) {
      const t = q / 8, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      fine.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const F = fine.length, acc = new Float64Array(F + 1);
  for (let i = 1; i <= F; i++) { const a = fine[i - 1], b = fine[i % F]; acc[i] = acc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const len = acc[F], N = Math.round(len), X = new Float64Array(N), Z = new Float64Array(N);
  for (let s = 0, j = 0; s < N; s++) {
    const d = s * len / N; while (acc[j + 1] < d) j++;
    const a = fine[j], b = fine[(j + 1) % F], t = (d - acc[j]) / (acc[j + 1] - acc[j]);
    X[s] = a[0] + (b[0] - a[0]) * t; Z[s] = a[1] + (b[1] - a[1]) * t;
  }
  const H = new Float64Array(N), K = new Float64Array(N), Y = new Float64Array(N), raw = new Float64Array(N);
  for (let s = 0; s < N; s++) { const a = (s - 1 + N) % N, b = (s + 1) % N; H[s] = Math.atan2(X[b] - X[a], Z[b] - Z[a]); }
  for (let s = 0; s < N; s++) K[s] = wrapA(H[(s + 1) % N] - H[(s - 1 + N) % N]) / 2;
  // climbs: straight lines between the control points, eased over 80 m
  const E = SP.elev;
  for (let s = 0, j = 0; s < N; s++) {
    const f = s / N; while (j < E.length - 2 && E[j + 1][0] <= f) j++;
    raw[s] = E[j][1] + (E[j + 1][1] - E[j][1]) * clamp((f - E[j][0]) / (E[j + 1][0] - E[j][0]), 0, 1);
  }
  for (let s = 0; s < N; s++) { let a = 0; for (let q = -40; q <= 40; q++) a += raw[(s + q + N) % N]; Y[s] = a / 81; }
  // a coarse hash of the loop, for distances to it (the stage's own T leaves the gap out)
  const hash = new Map();
  for (let s = 0; s < N; s += 2) { const k = hkey(Math.floor(X[s] / CELL), Math.floor(Z[s] / CELL)); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(s); }
  const at = s => Math.round(SP.at[s] * N);
  return SP.loop = { N, X, Z, H, K, Y, hash, at };
}
// a point beside the loop: lat > 0 is to the right of the direction of the lap
const loopSide = (LP, s, lat) => { s = ((Math.round(s) % LP.N) + LP.N) % LP.N; return [LP.X[s] - Math.cos(LP.H[s]) * lat, LP.Z[s] + Math.sin(LP.H[s]) * lat]; };
// the nearest point of the loop within r metres: { s, d } (d = 1e9 if none)
function loopNear(LP, x, z, r) {
  const k = Math.ceil(r / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let bs = -1, bd = r * r;
  for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) {
    const arr = LP.hash.get(hkey(cx + a, cz + b)); if (!arr) continue;
    for (const s of arr) { const dx = x - LP.X[s], dz = z - LP.Z[s], d = dx * dx + dz * dz; if (d < bd) { bd = d; bs = s; } }
  }
  if (bs < 0) return { s: -1, d: 1e9 };
  // refine between the neighbouring metres
  let best = bs, bd2 = bd;
  for (let q = -2; q <= 2; q++) { const s = (bs + q + LP.N) % LP.N, dx = x - LP.X[s], dz = z - LP.Z[s], d = dx * dx + dz * dz; if (d < bd2) { bd2 = d; best = s; } }
  return { s: best, d: Math.sqrt(bd2) };
}
// the stage's share of the lap, and pace notes read off the curvature: a run over 1/150 (carried on while over 1/300),
// rated by its tightest radius ('Q' a tight corner, 'H' a tight one that turns back on itself)
function streetRoad(st, notesRaw) {
  const LP = streetLoop(st), L = LP.N - st.street.gap;
  const px = new Float64Array(L + 1), pz = new Float64Array(L + 1), ph = new Float64Array(L + 1), py = new Float64Array(L + 1);
  for (let i = 0; i <= L; i++) { px[i] = LP.X[i]; pz[i] = LP.Z[i]; py[i] = LP.Y[i]; ph[i] = i ? ph[i - 1] + wrapA(LP.H[i] - LP.H[i - 1]) : LP.H[0]; }
  const k = new Float64Array(L); for (let i = 0; i < L; i++) k[i] = ph[i + 1] - ph[i];
  const ks = blur(k, 3);
  for (let i = 0; i < L;) {
    if (Math.abs(ks[i]) <= 1 / 150) { i++; continue; }
    const dir = ks[i] > 0 ? 1 : -1; let j = i, a = 0, km = 0;
    while (j < L && ks[j] * dir > 1 / 300) { a += ks[j]; km = Math.max(km, Math.abs(ks[j])); j++; }
    const ang = Math.round(Math.abs(a) * 180 / PI), r = 1 / km;
    if (ang >= 12) {
      let sev = r < 17 ? (ang >= 120 ? 'H' : 'Q') : r < 28 ? 1 : r < 44 ? 2 : r < 68 ? 3 : r < 100 ? 4 : r < 155 ? 5 : 6;
      if (typeof sev === 'number' && ang < 30) sev = Math.max(sev, 5);
      notesRaw.push({ s0: i, s1: j, dir, sev, ang, mods: [] });
    }
    i = j;
  }
  return { L, px, pz, ph, py, ks };
}
// Water (harbour and sea) on a grid: W[cell] = 1 under water, D = metres from a dry cell to the water (for the
// hillside). `ext` metres round the loop, `cell` metres a cell; the outline is filled row by row.
function waterMask(st, ext, cell) {
  const SP = st.street, key = ext + ':' + cell; SP.wm = SP.wm || {}; if (SP.wm[key]) return SP.wm[key];
  const LP = streetLoop(st), ring = SP.ring || (SP.ring = unpackPts(SP.sea));
  let mnX = 1e9, mxX = -1e9, mnZ = 1e9, mxZ = -1e9;
  for (let s = 0; s < LP.N; s++) { mnX = Math.min(mnX, LP.X[s]); mxX = Math.max(mxX, LP.X[s]); mnZ = Math.min(mnZ, LP.Z[s]); mxZ = Math.max(mxZ, LP.Z[s]); }
  const x0 = Math.floor((mnX - ext) / cell) * cell, z0 = Math.floor((mnZ - ext) / cell) * cell;
  const nx = Math.ceil((mxX + ext - x0) / cell) + 1, nz = Math.ceil((mxZ + ext - z0) / cell) + 1;
  const W = new Uint8Array(nx * nz), D = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * cell, xs = [];
    for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
      const a = ring[k], b = ring[i];
      if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (z - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const i0 = Math.max(0, Math.ceil((xs[q] - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((xs[q + 1] - x0) / cell));
      for (let i = i0; i <= i1; i++) W[j * nx + i] = 1;
    }
  }
  // chamfer distance from the water, two passes
  const c1 = cell, c2 = cell * Math.SQRT2;
  for (let i = 0; i < W.length; i++) D[i] = W[i] ? 0 : 1e6;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let d = D[k];
    if (i > 0) d = Math.min(d, D[k - 1] + c1);
    if (j > 0) { d = Math.min(d, D[k - nx] + c1); if (i > 0) d = Math.min(d, D[k - nx - 1] + c2); if (i < nx - 1) d = Math.min(d, D[k - nx + 1] + c2); }
    D[k] = d;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let d = D[k];
    if (i < nx - 1) d = Math.min(d, D[k + 1] + c1);
    if (j < nz - 1) { d = Math.min(d, D[k + nx] + c1); if (i < nx - 1) d = Math.min(d, D[k + nx + 1] + c2); if (i > 0) d = Math.min(d, D[k + nx - 1] + c2); }
    D[k] = d;
  }
  return SP.wm[key] = { x0, z0, cell, nx, nz, W, D };
}
const wetAt = (wm, x, z) => { const i = Math.round((x - wm.x0) / wm.cell), j = Math.round((z - wm.z0) / wm.cell); return i < 0 || j < 0 || i >= wm.nx || j >= wm.nz ? 0 : wm.W[j * wm.nx + i]; };
function shoreDist(wm, x, z) {
  let fx = clamp((x - wm.x0) / wm.cell, 0, wm.nx - 1.001), fz = clamp((z - wm.z0) / wm.cell, 0, wm.nz - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * wm.nx + i;
  return lerp(lerp(wm.D[k], wm.D[k + 1], u), lerp(wm.D[k + wm.nx], wm.D[k + wm.nx + 1], u), v);
}
// the land away from the streets: Monaco climbs about 13 m in every 100 m from the shore, steeper further up, with
// spurs and gullies; the quays stand 2.5 m over the water
function hillAt(nz, d, x, z) {
  const t = d < 450 ? 2.5 + d * 0.13 : 61 + (d - 450) * 0.3;
  return t + Math.min(1, d / 120) * (9 * nz.fbm(x / 260, z / 260, 3) + 2.5 * nz.n2(x / 60, z / 60));
}

// the first point where the line a→b crosses a building front (0..1), 1 if it is clear: keeps the chase camera out of
// the walls and lets trackside cameras see down the street
function rayWalls(W, ax, az, bx, bz) {
  if (!W.O.walls) return 1;
  const cols = W.O.cols, rx = bx - ax, rz = bz - az, n = Math.max(1, Math.ceil(Math.hypot(rx, rz) / 4)), seen = new Set();
  let best = 1;
  for (let q = 0; q <= n; q++) {
    const arr = cols.get(hkey(Math.floor((ax + rx * q / n) / CELL), Math.floor((az + rz * q / n) / CELL))); if (!arr) continue;
    for (const o of arr) {
      if (!o.seg || o.kind !== 'wall' || seen.has(o)) continue;
      seen.add(o);
      const sx = o.x1 - o.x0, sz = o.z1 - o.z0, den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) continue;
      const qx = o.x0 - ax, qz = o.z0 - az, t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
      if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
    }
  }
  return best;
}

// ---------------- Terrain ----------------
function terrainNatural(st, nz, x, z, d, lat, s, T) {
  if (st.kind === 'city') return 0;
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
  const LP = st.street && streetLoop(st), wm = st.street && waterMask(st, 640, 4);
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
      // the city is flat: the streets lie a few centimetres under the road (which is drawn over them)
      if (st.street) {
        // paved at the road's level out to the building line (the whole lap, gap included), the harbour and the sea
        // well under the water line, the hillside beyond
        const ln = loopNear(LP, x, z, 60);
        if (ln.d < STREET.line) hgt = LP.Y[ln.s] - (ln.d < hw - 0.8 ? 0.2 : 0.06);
        else if (wetAt(wm, x, z)) hgt = -6;
        else {
          // the hillside, but never more than a 30 % slope away from the streets (it is built up, not cliffs)
          const dd = Math.min(ln.d, d) - STREET.line, base = nearB - 0.06;
          hgt = lerp(base, clamp(hillAt(nz, shoreDist(wm, x, z), x, z), base - 0.3 * dd, base + 0.3 * dd), sstep(0, 60, dd));
        }
      }
      else if (d < flat) hgt = roadY - 0.18;
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
  // straight walls (building fronts, barriers): stored once in every cell they pass through
  const addSeg = (x0, z0, x1, z1, kind) => {
    const o = { seg: true, x0, z0, x1, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: 0.05, kind }, keys = new Set();
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 2)));
    for (let q = 0; q <= n; q++) keys.add(hkey(Math.floor((x0 + (x1 - x0) * q / n) / CELL), Math.floor((z0 + (z1 - z0) * q / n) / CELL)));
    for (const kk of keys) { let a = cols.get(kk); if (!a) cols.set(kk, a = []); a.push(o); }
  };
  if (st.street) { placeStreet(T, TR, st, nz, out, R, addCol, addSeg); out.cols = cols; return out; }
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
  if (st.rows) {
    // rows of old pines walking along both verges, then the forest filling in behind them. Most are old growth
    // (type 3: 18-30 m, crowns high over bare trunks, so the road runs under a roof of branches); the young ones
    // in between keep the forest closed at eye level under the crowns.
    const tree = (x, z, d, young, birch) => {
      const sc = birch ? 0.8 + R() * 0.6 : young ? 0.6 + R() * 0.4 : 0.85 + R() * 0.3;
      const sy = young || birch ? sc * (0.9 + R() * 0.4) : 0.85 + R() * 0.35;
      out.trees.push({ x, z, y: terrainH(TR, x, z) - 0.2, rot: R() * 6.28, s: sc, sy, type: birch ? 1 : young ? 0 : 3, c: R() });
      if (d < 40) addCol(x, z, (young || birch ? 0.45 : 0.5) * sc, 'tree');
    };
    const rows = [[hw + 4.6, 5.5], [hw + 8.5, 6], [hw + 13, 6.5], [hw + 19, 7.5]];
    for (const side of [-1, 1]) for (const [off, gap] of rows) {
      for (let s = 0; s < T.L; s += gap * (0.75 + R() * 0.5)) {
        if (nearStartFinish(s) && off < hw + 12) continue;
        const i = Math.min(T.n - 1, Math.round(s / 2)), h = T.H[i], rx = -Math.cos(h) * side, rz = Math.sin(h) * side;
        const o = off + (R() - 0.3) * 2.2;
        const x = T.X[i] + rx * o + (R() - 0.5) * 1.5, z = T.Z[i] + rz * o + (R() - 0.5) * 1.5;
        const d = roadDist(x, z);
        if (d < hw + 4.2) continue; // the inside of bends, where another part of the road passes close
        tree(x, z, d, R() < 0.2, false);
      }
    }
    scatter(3200, hw + 22, 170, 1.4, (x, z, d, s) => { const k = R(); tree(x, z, d, k < 0.26, k < 0.06); return true; });
    scatter(110, hw + 3.2, 30, 1.4, (x, z, d, s) => {
      if (nearStartFinish(s)) return false;
      const sc = 0.4 + R() * 0.8; out.rocks.push({ x, z, y: terrainH(TR, x, z) - 0.15 * sc, rot: R() * 6.28, s: sc, sy: sc * (0.6 + R() * 0.4), c: R() });
      addCol(x, z, 0.8 * sc, 'rock'); return true;
    });
  } else if (st.kind === 'pine') {
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
  } else if (st.kind === 'frost') {
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

// What stands round the lap, all from the loop so both directions share it: Armco both sides the whole way (colliders
// every 4 m), rows of buildings up the hill behind the sidewalks (the fronts nearest the road are walls, for the
// cameras), grandstands, palms along the waterfront, street lamps, the tunnel's lights, yachts moored stern-to along the
// quays and the pontoons, and the crowd.
function placeStreet(T, TR, st, nz, out, R, addCol, addSeg) {
  const LP = streetLoop(st), N = LP.N, SP = st.street, wm = waterMask(st, 640, 4), line = STREET.line;
  const t0 = LP.at('tunnel0'), t1 = LP.at('tunnel1'), cas = LP.at('casino');
  const wrapS = s => ((s % N) + N) % N;
  const within = (s, a, b) => a <= b ? s >= a && s <= b : s >= a || s <= b;
  const inTunnel = s => within(wrapS(s), t0 - 6, t1 + 6);
  const stands = SP.stands.map(([a, b, sd]) => [Math.round(a * N), Math.round(b * N), sd]);
  const inStand = (s, sd) => stands.some(([a, b, q]) => q === sd && within(wrapS(s), a - 4, b + 4));
  out.street = LP; out.walls = true;
  out.bldgs = []; out.lamps = []; out.palms = []; out.boats = []; out.stands = []; out.tlights = [];
  for (let s = 0; s < N; s += 4) for (const sd of [-1, 1]) {
    const a = loopSide(LP, s, sd * STREET.rail), b = loopSide(LP, s + 4, sd * STREET.rail);
    addSeg(a[0], a[1], b[0], b[1], 'rail');
  }
  // ---- buildings ----
  // convex footprints on a grid of 16 m cells; a new one may not overlap another or come within `min` of the lap
  const FC = 16, grid = new Map();
  const cellsOf = pts => { const ks = new Set(); let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, z] of pts) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } for (let i = Math.floor(a / FC); i <= Math.floor(b / FC); i++) for (let j = Math.floor(c / FC); j <= Math.floor(d / FC); j++) ks.add(hkey(i, j)); return ks; };
  const sep = (A, B) => {
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], nx = bz - az, nz2 = ax - bx;
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const [x, z] of A) { const v = x * nx + z * nz2; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
      for (const [x, z] of B) { const v = x * nx + z * nz2; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
      if (a1 <= b0 + 0.05 || b1 <= a0 + 0.05) return true;
    }
    return false;
  };
  const free = pts => { for (const k of cellsOf(pts)) for (const o of grid.get(k) || []) if (!sep(pts, o)) return false; return true; };
  const clear = (pts, min) => {
    const smp = pts.slice(); for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; smp.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
    smp.push([(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2]);
    return smp.every(([x, z]) => loopNear(LP, x, z, min + 1).d >= min - 0.05 && !wetAt(wm, x, z));
  };
  const keep = pts => { for (const k of cellsOf(pts)) { let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(pts); } };
  const rows = [{ off: 0, dep: [12, 24], fl: [3, 10] }, { off: 30, dep: [14, 26], fl: [6, 15] }, { off: 62, dep: [16, 30], fl: [8, 21] }, { off: 98, dep: [16, 30], fl: [8, 24] }];
  for (const sd of [-1, 1]) rows.forEach((row, ri) => {
    for (let s = 0; s < N;) {
      const w = Math.round(9 + R() * 9), s1 = s + w;
      if (inTunnel(s) || inTunnel(s1) || (ri === 0 && (inStand(s, sd) || inStand(s1, sd)))) { s += 4; continue; }
      const off = line + row.off + (ri ? R() * 6 : 0);
      const a = loopSide(LP, s, sd * off), b = loopSide(LP, s1, sd * off);
      const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1, ox = sd * -tz / tl, oz = sd * tx / tl;
      let placed = false;
      for (let dep = row.dep[0] + R() * (row.dep[1] - row.dep[0]); dep >= 8 && !placed; dep -= 5) {
        const pts = [a, b, [b[0] + ox * dep, b[1] + oz * dep], [a[0] + ox * dep, a[1] + oz * dep]];
        if (tl < 5 || !clear(pts, off - 0.4) || !free(pts)) continue;
        // the casino square is old and low; elsewhere the towers rise row by row up the hill
        const square = ri === 0 && within(wrapS(s), cas - 90, cas + 110);
        const fl = square ? 2 + Math.round(R() * 2) : Math.round(row.fl[0] + R() * (row.fl[1] - row.fl[0]) * (R() < 0.3 ? 1 : 0.6));
        let lo = 1e9, hi = -1e9;
        for (const [x, z] of pts) { const h = terrainH(TR, x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
        const base = ri === 0 ? Math.min(LP.Y[wrapS(s)], LP.Y[wrapS(s1)]) + STREET.slab : hi;
        out.bldgs.push({ pts, base, low: Math.min(lo, base) - 1.5, floors: fl, row: ri, classic: square, c: R() });
        keep(pts);
        if (ri === 0) addSeg(a[0], a[1], b[0], b[1], 'wall');
        placed = true;
      }
      s = placed ? s1 + (R() < 0.12 ? 3 + Math.round(R() * 5) : 0) : s + 4;
    }
  });
  // ---- the rest of the hill, built up: a jittered grid of blocks wherever there is dry land left, turned to the
  // nearest street, ever taller further up ----
  let mnX = 1e9, mxX = -1e9, mnZ = 1e9, mxZ = -1e9;
  for (let s = 0; s < N; s += 8) { mnX = Math.min(mnX, LP.X[s]); mxX = Math.max(mxX, LP.X[s]); mnZ = Math.min(mnZ, LP.Z[s]); mxZ = Math.max(mxZ, LP.Z[s]); }
  for (let gz = mnZ - 260; gz < mxZ + 260; gz += 21) for (let gx = mnX - 260; gx < mxX + 260; gx += 21) {
    const cx = gx + (R() - 0.5) * 6, cz = gz + (R() - 0.5) * 6, ln = loopNear(LP, cx, cz, 280);
    if (ln.d < 14 || wetAt(wm, cx, cz)) continue;
    const h = ln.s >= 0 ? LP.H[ln.s] + (R() < 0.3 ? PI / 2 : 0) + (R() - 0.5) * 0.2 : R() * PI;
    const ux = Math.sin(h), uz = Math.cos(h), vx = Math.cos(h), vz = -Math.sin(h), a2 = 6 + R() * 4, b2 = 6 + R() * 5;
    const pts = [[cx - ux * a2 - vx * b2, cz - uz * a2 - vz * b2], [cx + ux * a2 - vx * b2, cz + uz * a2 - vz * b2], [cx + ux * a2 + vx * b2, cz + uz * a2 + vz * b2], [cx - ux * a2 + vx * b2, cz - uz * a2 + vz * b2]];
    if (!clear(pts, line + 1.5) || !free(pts)) continue;
    let lo = 1e9, hi = -1e9;
    for (const [x, z] of pts) { const t = terrainH(TR, x, z); lo = Math.min(lo, t); hi = Math.max(hi, t); }
    const far = Math.min(1, ln.d / 200);
    out.bldgs.push({ pts, base: hi, low: lo - 1.5, floors: Math.round(5 + R() * (8 + far * 14)), row: 4, classic: false, c: R() });
    keep(pts);
  }
  // ---- grandstands, with their crowd ----
  const shirts = 12;
  for (const [a, b, sd] of stands) {
    out.stands.push({ s0: a, s1: b, sd });
    for (let s = a; within(s, a, b) && s !== wrapS(b); s = wrapS(s + 1)) for (let tier = 0; tier < 5; tier++) {
      if (R() > 0.3) continue;
      const [x, z] = loopSide(LP, s + R(), sd * (line + 1.2 + tier * 1.25)), dw = loopSide(LP, s, 0);
      out.fans.push({ x, z, y: LP.Y[s] + STREET.slab + 0.55 + tier * 0.62, rot: Math.atan2(dw[0] - x, dw[1] - z) + (R() - 0.5) * 0.5, c: (R() * shirts) | 0, ph: R() * 6.28, h: 0.9 + R() * 0.2 });
    }
  }
  // ---- palms on the waterfront, lamps, the tunnel's lights ----
  const nearFront = (x, z) => { for (const k of cellsOf([[x - 3, z - 3], [x + 3, z + 3]])) if ((grid.get(k) || []).length) return true; return false; };
  for (const sd of [-1, 1]) for (let s = 6; s < N; s += 11) {
    if (inTunnel(s) || inStand(s, sd)) continue;
    const [x, z] = loopSide(LP, s, sd * 7.3);
    if (!wetAt(wm, x, z) && shoreDist(wm, x, z) < 45 && !nearFront(x, z) && loopNear(LP, x, z, 8).d > 6.8) {
      out.palms.push({ x, z, y: LP.Y[s] + STREET.slab, rot: R() * 6.28, s: 0.85 + R() * 0.35, c: R() });
    }
  }
  for (let s = 10, k = 0; s < N; s += 31, k++) {
    if (inTunnel(s)) continue;
    const sd = k % 2 ? 1 : -1, [x, z] = loopSide(LP, s, sd * 6.1), [rx, rz] = loopSide(LP, s, 0);
    if (wetAt(wm, x, z)) continue;
    out.lamps.push({ x, z, y: LP.Y[s] + STREET.slab, rot: Math.atan2(rx - x, rz - z) });
  }
  for (let s = t0; within(s, t0, t1) && s !== t1; s = wrapS(s + 7)) for (const sd of [-1, 1]) {
    const [x, z] = loopSide(LP, s, sd * 3.1); out.tlights.push([x, LP.Y[s] + 5.7, z]);
  }
  // ---- yachts, moored stern-to along the pontoons and the harbour's quays ----
  const piers = SP.piers.map(unpackPts);
  let hx = 0, hz = 0, hn = 0; for (const p of piers) for (const [x, z] of p) { hx += x; hz += z; hn++; }
  hx /= hn; hz /= hn;
  const edges = [];
  for (const p of piers) for (let i = 0; i + 1 < p.length; i++) edges.push([p[i], p[i + 1], 0], [p[i], p[i + 1], 1]);
  const ring = SP.ring || (SP.ring = unpackPts(SP.sea));
  for (let i = 0; i + 1 < ring.length; i++) if (Math.hypot(ring[i][0] - hx, ring[i][1] - hz) < 330) edges.push([ring[i], ring[i + 1], 2]);
  const boats = [];
  for (const [a, b, kind] of edges) {
    const ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez); if (el < 6) continue;
    // into the water: off either side of a pontoon, off the right of the coast (land is on its left)
    const sides = kind === 2 ? [1] : [kind ? 1 : -1];
    for (const sg of sides) {
      const nx = sg * -ez / el, nz2 = sg * ex / el;
      for (let t = 4; t < el - 4; t += 8 + R() * 6) {
        const len = 12 + R() * R() * 34, wd = len * 0.27, px = a[0] + ex * t / el, pz = a[1] + ez * t / el;
        const cx = px + nx * (len / 2 + 1.5), cz = pz + nz2 * (len / 2 + 1.5);
        // the whole hull in the water: both quarters at the stern and at the bow, and the middle
        const ok = [[0.5, 0], [-0.5, 0], [0.5, 1], [-0.5, 1], [0, 0.5]].every(([u, v]) => wetAt(wm, px + nx * (2 + v * len) - nz2 * u * wd, pz + nz2 * (2 + v * len) + nx * u * wd));
        if (!ok || boats.some(o => Math.hypot(o.x - cx, o.z - cz) < (o.len + len) * 0.3)) continue;
        if (loopNear(LP, cx, cz, 12).d < 11) continue;
        boats.push({ x: cx, z: cz, rot: Math.atan2(nx, nz2), len, c: R() });
      }
    }
  }
  out.boats = boats;
}

// ---------------- World ----------------
function buildWorld(stage) {
  const st = typeof stage === 'object' ? stage : STAGES[stage];
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
  projectRoad(T, bi, c.x, c.z, c.rd);
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
  c.spinV = 0; c.ax = 0; c.boost = 0; c.limiter = 0; c.hbSlide = false; c.hbT = 0;
  locate(T, c);
  c.y = groundAt(W, c, c.x, c.z); c.gyPrev = c.y; c.slope = 0;
}

const tyreF = al => Math.sin(1.45 * Math.atan(al));
const FEEL0 = { lag: 0, kick: 1, ayc: 0, push: 0, twitch: 1 };
const TUNE = { assist: 0.5, yawDamp: 0.7, turnAssist: 0.55, frontGrip: 1.0, rearGrip: 1.08, Bmul: 1, lockK: 17, latGrip: 1.1, absF: 0.4, absR: 0.35, tcF: 0.4, tcR: 0.6, hold: 6, holdK: 1.4, wt: 0.6, spinMax: 4.5, holdB: 0.6, trail: 3, trailK: 1.2, lowGrip: 0.12, edgeA: -0.1, edgeB: 2.0, edgeMix: 0.5, edgeBin: 0, slideA: 0.03, slideB: 0.2, slideF: 1, spinK: 5, spinB: 0.5, spinV: 12, impactP: 0.6, rearSlide: 0.85, rsA: 0.15, rsB: 0.32, rsT0: 0.5, rsT1: 0.9, rsS0: 0.05, rsS1: 0.3, rsBA: 0.12, rsBB: 0.24, rearSlideP: 0.92, rsPA: 0.16, rsPB: 0.3 };

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

// steering lock at speed v: rally cars lose it gently; a car with `lockV` [k, floor] keeps nearly full lock at hairpin
// speed and gives most of it up past ~k m/s (the F1: with its downforce a key tap at 200 km/h was a 4 g swerve)
const lockAt = (P, v) => P.lock * (P.lockV ? Math.max(P.lockV[1], 1 / (1 + (v / P.lockV[0]) * (v / P.lockV[0]))) : Math.max(0.27, 1 / (1 + v / TUNE.lockK)));
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
  const F = P.feel || FEEL0;
  const bt = thr * clamp((c.rpm - E.onset) / 1800, 0, 1);
  // the exhaust drives the turbine: low in the revs there is little flow and it spools slowly (more so on the laggy
  // Group B cars); kick > 1 holds the boost back at part spool so it arrives late and all at once
  const flow = lerp(1, clamp((c.rpm - E.onset * 0.8) / Math.max(400, E.hpRpm - E.onset * 0.8), 0.12, 1), F.lag);
  if (bt > c.boost) c.boost += (bt - c.boost) * Math.min(1, E.spool * flow * dt);
  else c.boost += (bt - c.boost) * Math.min(1, (E.antilag ? 0.7 : 4.5) * dt);
  let Teng = thr * torqueAt(P, c.rpm) * (E.na + (1 - E.na) * Math.pow(c.boost, F.kick));
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
  const lockV = lockAt(P, Math.abs(vx));
  const beta = Math.atan2(vy, Math.abs(vx) + 0.5);
  let delta = -c.steer * lockV;
  if (vx > 1) delta += TUNE.assist * beta * clamp(spd / 6, 0, 1);
  delta = clamp(delta, -P.lock, P.lock);
  c.delta = delta; // the wheels' real angle (driver + self-aligning countersteer), for drawing them
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
  const push = 1 - F.push * 0.12 * thr * clamp((spd - 8) / 15, 0, 1); // a heavy nose runs wide under power
  const FyF = -capF * tyreF(BtF * af) * kF * TUNE.frontGrip * (P.frontGrip || 1) * TUNE.latGrip * lowG * push;
  // Power on in a real slide (the tail well out, the wheel turned either way): the spinning rear tyres give up some of
  // their side grip, so the throttle holds the slide instead of the rear pulling the car straight. Off the throttle,
  // or with the wheel straight to come out of it, the rear grips as before.
  // A slide started with the handbrake (a hairpin) keeps the looser rear until it is over; a power slide without
  // it lets go a little less, so ordinary fast corners stay under control.
  if (inp.hb) { c.hbSlide = true; c.hbT = 0.5; } // a tap counts too: the tail is still swinging out after it
  else { c.hbT = Math.max(0, (c.hbT || 0) - dt); if (c.hbT <= 0 && Math.abs(beta) < 0.08) c.hbSlide = false; }
  const hbS = c.hbSlide, rsLo = hbS ? TUNE.rearSlide : TUNE.rearSlideP;
  const slideK = TUNE.rearSlide == null ? 0 : Math.max(sstep(TUNE.rsA, TUNE.rsB, Math.abs(ar)), hbS ? sstep(TUNE.rsBA, TUNE.rsBB, Math.abs(beta)) : sstep(TUNE.rsPA, TUNE.rsPB, Math.abs(beta))) * sstep(TUNE.rsT0, TUNE.rsT1, thr) * sstep(TUNE.rsS0, TUNE.rsS1, Math.abs(c.steer));
  const rearK = lerp(TUNE.rearGrip, TUNE.rearSlide == null ? TUNE.rearGrip : rsLo, slideK);
  const FyR = -capR * tyreF(BtR * ar) * kR * rearK * (P.rearGrip || 1) * TUNE.latGrip * lowG;
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
  // active yaw control / active diffs: throttle with the wheel turned adds rotation, fading out once it slides
  const ayc = F.ayc && !inp.hb ? -c.steer * thr * F.ayc * 0.6 * clamp((spd - 4) / 12, 0, 1) * clamp(1 - Math.abs(beta) * 2.5, 0, 1) : 0;
  vx += (Fx / m) * dt;
  vy += (Fy / m) * dt;
  r += (Mz / P.Iz + assist + ayc) * dt;
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
  const calm = 2 - F.twitch; // twitch > 1: less yaw damping and a weaker spin catch (the 205 is nervous, the WRC cars settle)
  r -= r * TUNE.yawDamp * calm * (inp.hb ? 0.3 : 1) * dt;
  // spin catch: once the car is well past the angle a driver can hold and still rotating further into it,
  // bleed some of that rotation. Never with the handbrake up, and only as speed builds: at hairpin speed big
  // angles are the point. Keyboard-driver bots spin about 4x less with it; handbrake hairpin times are unchanged.
  if (!inp.hb && TUNE.spinK > 0 && r * beta < 0) {
    const over = clamp((Math.abs(beta) - TUNE.spinB) / 0.35, 0, 1) * clamp((spd - TUNE.spinV) / 8, 0, 1);
    if (over > 0) r -= r * TUNE.spinK * calm * over * dt;
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
        const px = c.x + fx * off, pz = c.z + fz * off;
        let ox = o.x, oz = o.z;
        if (o.seg) {
          // a wall: the nearest point on it stands in for the post
          const ex = o.x1 - o.x0, ez = o.z1 - o.z0, t = clamp(((px - o.x0) * ex + (pz - o.z0) * ez) / (ex * ex + ez * ez), 0, 1);
          ox = o.x0 + ex * t; oz = o.z0 + ez * t;
        }
        const dx = px - ox, dz = pz - oz; const md = R + o.r;
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
            // straw gives, a water-filled barrier a little; trees, rocks and buildings don't
            const e = o.kind === 'hay' ? 0.1 : o.kind === 'barrier' ? 0.15 : 0.25;
            c.vx -= (1 + e) * vn * nx; c.vz -= (1 + e) * vn * nz;
            const keep = 1 - (o.kind === 'hay' ? 0.25 : o.kind === 'barrier' ? 0.16 : 0.18) * Math.pow(sq, TUNE.impactP);
            c.vx *= keep; c.vz *= keep;
            c.w += (off > 0 ? 1 : -1) * (fx * nz - fz * nx) * Math.min(-vn, 14) * 0.13;
            if (-vn > c.hitV) { c.hitV = -vn; c.hitKind = o.kind; c.hitX = ox; c.hitZ = oz; c.hitNx = nx; c.hitNz = nz; c.hitFront = off > 0; }
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
  if (st.bank) {
    // snowbanks are deep snow, not a wall: the further the car ploughs in, the harder they slow it, but they never
    // push it back or bounce it onto the road (that read as being steered by an invisible rail)
    const p = Math.abs(c.lat) - (T.hw + st.bank);
    c.bankP = Math.max(0, p);
    // strongest through the bank itself (its crest is ~1 m in), lighter in the open snow beyond it
    if (p > 0) { const sc = Math.exp(-st.bankDrag * sstep(0, 1, p) * (1 - 0.65 * sstep(2, 3.4, p)) * dt); c.vx *= sc; c.vz *= sc; }
    return;
  }
  if (T.walls.length) {
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
  const lockV = lockAt(P, Math.abs(c.vF));
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
  // turbo lag: flooring it in third from 60 km/h, how long until the boost is nearly all there
  const c2 = makeCar(W, P, 20); c2.gear = 3; c2.vx = Math.sin(c2.h) * 16.7; c2.vz = Math.cos(c2.h) * 16.7; c2.vF = 16.7;
  for (let i = 0; i < 120; i++) stepCar(W, c2, P, { steer: 0, thr: 0.25, brk: 0, hb: false, manual: true }, dt);
  let lag = 0;
  for (let i = 1; i < 900 && !lag; i++) { stepCar(W, c2, P, { steer: 0, thr: 1, brk: 0, hb: false, manual: true }, dt); if (c2.boost > 0.9) lag = i * dt; }
  P.spec = { t100, t160, vmax, lag: P.engine.na >= 1 ? 0 : lag || 7.5 }; // no turbo, no lag
  return P.spec;
}
CARS.forEach(measureCar);

return { TUNE, CARS, STAGES, CONDS, stageDef, stageKey, stageTitle, condName, dailyKey, selfClearance, RADIUS, RW, carStats, torqueAt, engineCurve, measureCar, buildWorld, buildTrack, makeNoise, rng, sampleAt, roadYAt, terrainH, nearest, project,
  makeCar, resetCar, stepCar, locate, groundAt, simulateRun, prepAI, aiDrive, clamp, lerp, sstep, wrapA, hkey, CELL,
  STREET, streetLoop, loopSide, loopNear, waterMask, wetAt, shoreDist, hillAt, unpackPts, rayWalls };
})();
if (typeof module !== 'undefined') module.exports = RallyCore;
