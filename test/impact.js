// Impacts: drive at a lone tree (head-on, offset, clipping a corner) and along a row of trees at a shallow angle.
// Reports speed kept, heading change and peak yaw rate. Run: node impact.js [TUNE json]   ('{"impactP":0}' = flat 18% loss on every hit, the old model)
const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
const D = 180 / Math.PI;
C.STAGES.push({ id: 'flat', kind: 'pine', name: 'Flat', grip: 0.92, offGrip: 0.92, offDrag: 0, tyreB: 8, hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
const put = (x, z) => { const k = C.hkey(Math.floor(x / C.CELL), Math.floor(z / C.CELL)); let a = W.O.cols.get(k); if (!a) W.O.cols.set(k, a = []); a.push({ x, z, r: 0.45, kind: 'tree' }); };
function run(P, setup, v0, T) {
  W.O.cols = new Map();
  const c = C.makeCar(W, P, 600); c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0; c.gear = 3;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
  setup((ahead, right) => put(c.x + fx * ahead + rx * right, c.z + fz * ahead + rz * right));
  const h0 = c.h; let t = 0, wMax = 0, hit = 0;
  while (t < T) { C.stepCar(W, c, P, { steer: 0, thr: 0.3, brk: 0, hb: false }, 1 / 120); t += 1 / 120; wMax = Math.max(wMax, Math.abs(c.w)); hit = Math.max(hit, c.hitV); c.hitV = 0; }
  return { keep: Math.hypot(c.vx, c.vz) / v0, dh: C.wrapA(c.h - h0) * D, wMax, hit };
}
const cases = [
  ['head-on', s => s(12, 0)],
  ['offset 0.6m', s => s(12, 0.6)],
  ['corner 1.2m', s => s(12, 1.2)],
  // a row of trees the car drifts into at ~6 degrees, like brushing the forest edge
  ['row 6deg', s => { for (let k = 0; k < 14; k++) s(8 + k * 5, 2.6 - k * 5 * Math.tan(6 / D)); }],
];
const fmt = r => `${(r.keep * 100).toFixed(0).padStart(3)}% ${r.dh.toFixed(0).padStart(4)}° w${r.wMax.toFixed(1)}`;
console.log('car       ' + cases.map(k => k[0].padEnd(20)).join(''));
for (const P of C.CARS) console.log(P.id.padEnd(10) + cases.map(([, f]) => fmt(run(P, f, 20, 2.5)).padEnd(20)).join(''));
