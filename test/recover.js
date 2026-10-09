// Drift recovery: provoke a slide, then floor it. Reports how long until the car grips again (|beta| < 8 deg),
// the peak slip angle after the throttle goes down, and spins. Run: node recover.js [TUNE json] [grip] [tyreB]
const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
const D = 180 / Math.PI;
const surf = process.argv[3] ? [[+process.argv[3], +(process.argv[4] || 8)]] : [[0.92, 8], [0.74, 7.5], [1.15, 11]];
function world(grip, tyreB) {
  C.STAGES.push({ id: 'flat', name: 'Flat', grip, offGrip: grip, offDrag: 0, tyreB, hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
  const W = C.buildWorld(C.STAGES.length - 1); C.STAGES.pop(); return W;
}
function gearFor(P, v) {
  for (let g = 1; g <= P.gearbox.gears; g++) { const rpm = v / C.RW * P.ratios[g - 1] * P.final * 60 / (2 * Math.PI); if (rpm < P.engine.redline - 400) return g; }
  return P.gearbox.gears;
}
// t0: when the throttle goes down. Before that the slide is provoked with a handbrake flick or a lift-off.
function run(W, P, v0, provoke, after, T) {
  const c = C.makeCar(W, P, 600); c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0; c.gear = gearFor(P, v0);
  c.rpm = v0 / C.RW * P.ratios[c.gear - 1] * P.final * 60 / (2 * Math.PI);
  let t = 0, t0 = null, last = null, bPk = 0, spun = false, flips = 0, sg = 0;
  while (t < T) {
    let inp = provoke(t, c);
    if (!inp) { if (t0 === null) t0 = t; inp = after(t - t0, c); }
    C.stepCar(W, c, P, Object.assign({ steer: 0, thr: 0, brk: 0, hb: false }, inp), 1 / 120); t += 1 / 120;
    const b = Math.abs(c.beta);
    if (t0 !== null) {
      bPk = Math.max(bPk, b); if (b > 8 / D) last = t - t0;
      if (b > 5 / D) { const s = Math.sign(c.beta); if (sg && s !== sg) flips++; sg = s; }
    }
    if (b > 1.3) spun = true;
  }
  // grip: when |beta| last dropped under 8 deg (settled), null if it was still sliding at the end
  const grip = last === null ? 0 : last > T - t0 - 0.5 ? null : last;
  return { grip, bPk: bPk * D, spun, flips, v: Math.hypot(c.vx, c.vz) * 3.6 };
}
const flick = (t, c) => t < 0.45 ? { steer: -1, hb: true } : null;          // handbrake flick at speed
const lift = (t, c) => t < 0.9 ? { steer: -1, thr: 0 } : null;              // lift-off into a full-lock corner
const cases = [
  ['hb>straight', 15, flick, () => ({ steer: 0, thr: 1 })],
  ['hb>counter', 15, flick, t => ({ steer: t < 0.25 ? 1 : 0, thr: 1 })],
  ['lift>straight', 24, lift, () => ({ steer: 0, thr: 1 })],
  ['lift>counter', 24, lift, t => ({ steer: t < 0.3 ? 1 : 0, thr: 1 })],
  ['hb>hold', 15, flick, t => ({ steer: t < 0.6 ? -1 : 0, thr: 1 })], // keeps turning in for 0.6 s, then lets go
];
const fmt = r => `${r.grip === null ? ' -- ' : r.grip.toFixed(2)}s ${r.bPk.toFixed(0).padStart(2)}°${r.spun ? '!' : r.flips ? '~' : ' '}`;
for (const [grip, tyreB] of surf) {
  const W = world(grip, tyreB);
  console.log(`grip ${grip} B ${tyreB}   ` + cases.map(k => k[0].padEnd(14)).join(''));
  let tot = 0, n = 0, miss = 0;
  for (const P of C.CARS) {
    const cells = cases.map(([, v, pr, af]) => { const r = run(W, P, v, pr, af, 4); if (r.grip === null) miss++; else { tot += r.grip; n++; } return fmt(r).padEnd(14); });
    console.log(`  ${P.id.padEnd(8)}            ${cells.join('')}`);
  }
  console.log(`  mean grip-back ${(tot / Math.max(n, 1)).toFixed(2)}s, never gripped: ${miss}`);
}
