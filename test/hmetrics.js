const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
C.STAGES.push({ id: 'flat', name: 'Flat', grip: +(process.argv[3] || 0.92), offGrip: 0.92, offDrag: 0, tyreB: +(process.argv[4] || 8), hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
const D = 180 / Math.PI;
function run(P, v0, T, f) {
  const c = C.makeCar(W, P, 600); c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0;
  // settle gear
  c.gear = 3; let t = 0; const log = [];
  let chi = Math.atan2(c.vx, c.vz);
  while (t < T) { const inp = f(t, c); C.stepCar(W, c, P, inp, 1 / 120); t += 1 / 120; const ch2 = Math.atan2(c.vx, c.vz); const v = Math.hypot(c.vx, c.vz); log.push({ t, w: c.w, b: c.beta * D, v, ay: v * C.wrapA(ch2 - chi) * 120 }); chi = ch2; }
  return log;
}
const rows = [];
for (const P of C.CARS) {
  // 1) step steer at 70 km/h, partial throttle to hold speed
  let L = run(P, 19.4, 3, t => ({ steer: t > 0.2 ? -1 : 0, thr: 0.35, brk: 0, hb: false }));
  const wss = L.slice(-60).reduce((a, o) => a + Math.abs(o.w), 0) / 60;
  const t80 = (L.find(o => o.t > 0.2 && Math.abs(o.w) > 0.8 * wss) || { t: 9 }).t - 0.2;
  const ayMax = L.slice(-120).reduce((a, o) => a + Math.abs(o.ay), 0) / 120;
  const bMax70 = Math.max(...L.map(o => Math.abs(o.b)));
  // 2) full steer at 108 km/h, throttle on, 2.5 s
  L = run(P, 30, 2.5, t => ({ steer: 1, thr: 1, brk: 0, hb: false }));
  const bMax108 = Math.max(...L.map(o => Math.abs(o.b)));
  let flips = 0; for (let i = 1; i < L.length; i++) if (Math.sign(L[i].w) !== Math.sign(L[i - 1].w) && Math.abs(L[i].w) > 0.05) flips++;
  // 3) lift-off full steer at 90 for 1 s, then straight + throttle 2 s
  L = run(P, 25, 3, t => t < 1 ? { steer: -1, thr: 0, brk: 0, hb: false } : { steer: 0, thr: 1, brk: 0, hb: false });
  const bLift = Math.max(...L.map(o => Math.abs(o.b))), bLiftEnd = Math.abs(L[L.length - 1].b);
  // 4) handbrake flick at 54, 0.5 s, then neutral + throttle
  L = run(P, 15, 3, t => t < 0.5 ? { steer: -1, thr: 0, brk: 0, hb: true } : { steer: 0, thr: 0.6, brk: 0, hb: false });
  const c0 = L[0]; let yaw = 0; for (const o of L) yaw += o.w / 120;
  const bHB = Math.max(...L.map(o => Math.abs(o.b))), bHBend = Math.abs(L[L.length - 1].b);
  rows.push([P.name.slice(0, 18).padEnd(18), 'turnIn', t80.toFixed(2) + 's', 'ayMax', (ayMax / 9.81).toFixed(2) + 'g', 'b70', bMax70.toFixed(0), '| full108 bMax', bMax108.toFixed(0), 'flips', flips, '| lift bMax', bLift.toFixed(0), 'end', bLiftEnd.toFixed(0), '| HB yaw', (yaw * D).toFixed(0), 'bMax', bHB.toFixed(0), 'end', bHBend.toFixed(0)].join(' '));
}
console.log(rows.join('\n'));
