// Drift control: can a driver hold a slide at a chosen angle, and does the throttle steer it?
//  1. hold: a driver with an analogue stick starts a slide (lift + full lock), then holds a target body slip angle
//     (15/25/35 deg) for 5 s with countersteer and throttle. Reports the RMS error over the last 4 s, and whether
//     the slide died (< 6 deg) or the car spun (> 75 deg).
//  2. throttle: in a held slide with the wheel fixed, step the throttle 0.4 → 1.0 and report how the slip angle
//     moves over the next 0.8 s (positive = the throttle swings the tail out, which is what lets you steer a drift
//     with your right foot).
// Run: node drift.js [TUNE json] [grip] [tyreB]
const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
const D = 180 / Math.PI;
const surf = process.argv[3] ? [[+process.argv[3], +(process.argv[4] || 8), 'custom']] : [[0.92, 8, 'gravel'], [0.74, 7.5, 'snow'], [1.15, 11, 'tarmac']];
function world(grip, tyreB) {
  C.STAGES.push({ id: 'flat', kind: 'pine', name: 'Flat', grip, offGrip: grip, offDrag: 0, tyreB, hw: 200, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 3000]] });
  const W = C.buildWorld(C.STAGES.length - 1); C.STAGES.pop(); return W;
}
function gearFor(P, v) {
  for (let g = 1; g <= P.gearbox.gears; g++) { const rpm = v / C.RW * P.ratios[g - 1] * P.final * 60 / (2 * Math.PI); if (rpm < P.engine.redline * 0.8) return g; }
  return P.gearbox.gears;
}
function start(W, P, v0) {
  const c = C.makeCar(W, P, 300); c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0; c.gear = gearFor(P, v0);
  c.rpm = v0 / C.RW * P.ratios[c.gear - 1] * P.final * 60 / (2 * Math.PI);
  return c;
}
const step = (W, c, P, inp) => C.stepCar(W, c, P, Object.assign({ steer: 0, thr: 0, brk: 0, hb: false, analog: true }, inp), 1 / 120);
// left-hand drift: beta > 0 is the nose pointing left of the direction of travel; steer -1 = full left lock
function provoke(W, c, P) { for (let i = 0; i < 0.6 * 120; i++) step(W, c, P, { steer: -1, thr: 0, hb: i < 0.25 * 120 }); }
function hold(W, P, target, v0) {
  const c = start(W, P, v0); provoke(W, c, P);
  let ie = 0, se = 0, n = 0, died = false, spun = false, vSum = 0;
  for (let i = 0; i < 5 * 120; i++) {
    const b = c.beta, e = b - target;            // too much angle → countersteer (steer right, +)
    ie = Math.max(-0.6, Math.min(0.6, ie + e / 120));
    const steer = Math.max(-1, Math.min(1, -0.35 + 2.6 * e + 1.2 * ie + 0.18 * c.w));
    const spd = Math.hypot(c.vx, c.vz), thr = Math.max(0, Math.min(1, 0.55 + 0.12 * (v0 - spd) - 1.5 * e));
    step(W, c, P, { steer, thr });
    if (i >= 120) { se += e * e; n++; vSum += spd; }
    if (Math.abs(c.beta) > 75 / D) spun = true;
    if (i >= 120 && Math.abs(c.beta) < 6 / D) died = true;
  }
  return { rms: Math.sqrt(se / n) * D, died, spun, v: vSum / n * 3.6 };
}
// the driver above holds 25 deg for 1.5 s; then, from that same moment, the wheel is frozen and the throttle either
// drops to 0.3 or goes to 1 for 0.8 s. The difference in slip angle is how much the right foot steers the slide.
function throttle(W, P, v0) {
  const c = start(W, P, v0); provoke(W, c, P);
  const target = 25 / D; let ie = 0, steer = 0;
  for (let i = 0; i < 1.5 * 120; i++) {
    const e = c.beta - target; ie = Math.max(-0.6, Math.min(0.6, ie + e / 120));
    steer = Math.max(-1, Math.min(1, -0.35 + 2.6 * e + 1.2 * ie + 0.18 * c.w));
    const spd = Math.hypot(c.vx, c.vz);
    step(W, c, P, { steer, thr: Math.max(0, Math.min(1, 0.55 + 0.12 * (v0 - spd) - 1.5 * e)) });
  }
  const b0 = c.beta, out = {};
  for (const thr of [0.3, 1]) {
    const k = Object.assign({}, c, { rd: Object.assign({}, c.rd) });
    for (let i = 0; i < 0.8 * 120; i++) step(W, k, P, { steer, thr });
    out[thr] = k.beta;
  }
  return { b0: b0 * D, d: (out[1] - out[0.3]) * D };
}
// 3. keys: the same job with a keyboard: left / nothing / right and throttle on / off, decided 20 times a second and
//    applied with a 0.1 s reaction lag, like a person tapping. Holds 25 deg for 5 s.
function keys(W, P, target, v0) {
  const c = start(W, P, v0); provoke(W, c, P);
  let se = 0, n = 0, died = false, spun = false, q = [], cur = { steer: -1, thr: 1 };
  for (let i = 0; i < 5 * 120; i++) {
    if (i % 6 === 0) {
      const e = c.beta - target, spd = Math.hypot(c.vx, c.vz);
      // too little angle: turn in and stay on the throttle; too much: countersteer and lift; in between: ease off
      const steer = e < -0.06 ? -1 : e > 0.08 ? 1 : (c.w > 0.9 ? 1 : c.w < 0.35 ? -1 : 0);
      const thr = e > 0.12 || spd > v0 + 4 ? 0 : 1;
      q.push({ steer, thr }); if (q.length > 3) cur = q.shift();
    }
    C.stepCar(W, c, P, { steer: cur.steer, thr: cur.thr, brk: 0, hb: false, analog: false }, 1 / 120);
    if (i >= 120) { const e = c.beta - target; se += e * e; n++; }
    if (Math.abs(c.beta) > 75 / D) spun = true;
    if (i >= 120 && Math.abs(c.beta) < 6 / D) died = true;
  }
  return { rms: Math.sqrt(se / n) * D, died, spun };
}
const targets = [15, 25, 35];
for (const [grip, tyreB, name] of surf) {
  const W = world(grip, tyreB);
  const v0 = name === 'tarmac' ? 19 : name === 'snow' ? 14 : 16;
  console.log(`${name} (grip ${grip})   hold ${targets.map(t => (t + '°').padEnd(14)).join('')} full vs 0.3 throttle   keys 25°`);
  const tot = targets.map(() => 0); let lost = 0, kTot = 0, kLost = 0;
  for (const P of C.CARS) {
    const cells = targets.map((tg, k) => { const r = hold(W, P, tg / D, v0); tot[k] += r.rms; if (r.died || r.spun) lost++; return `${r.rms.toFixed(1).padStart(4)}°${r.spun ? '!' : r.died ? 'x' : ' '} ${r.v.toFixed(0).padStart(3)}k  `; });
    const th = throttle(W, P, v0);
    const kr = keys(W, P, 25 / D, v0); kTot += kr.rms; if (kr.died || kr.spun) kLost++;
    console.log(`  ${P.id.padEnd(8)}        ${cells.join('')}at ${th.b0.toFixed(0).padStart(3)}°: ${th.d >= 0 ? '+' : ''}${th.d.toFixed(1)}°        ${kr.rms.toFixed(1).padStart(4)}°${kr.spun ? '!' : kr.died ? 'x' : ' '}`);
  }
  console.log(`  mean RMS error ${tot.map(x => (x / C.CARS.length).toFixed(1) + '°').join(' / ')}, slides lost or spun: ${lost}; keys ${(kTot / C.CARS.length).toFixed(1)}°, lost or spun: ${kLost}`);
}
