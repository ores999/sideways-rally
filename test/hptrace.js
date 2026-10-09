const C = require('../src/core.js');
if (process.argv[3]) Object.assign(C.TUNE, JSON.parse(process.argv[3]));
C.STAGES.push({ id: 'flat', name: 'Flat', grip: 0.92, offGrip: 0.92, offDrag: 0, tyreB: 8, hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
const P = C.CARS.find(p => p.id === (process.argv[2] || 'foca'));
const mode = process.argv[4] || 'hp';
const c = C.makeCar(W, P, 600); const v0 = mode === 'brk' ? 25 : 12.5; c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0; c.gear = mode === 'brk' ? 4 : 2;
c._dbgOn = true; const D = 180 / Math.PI;
let t = 0, chi = Math.atan2(c.vx, c.vz), turned = 0;
for (let i = 0; i < 120 * 4; i++) {
  const inp = mode === 'brk' ? { steer: -1, brk: 1, thr: 0, hb: false } : { steer: -1, brk: t < 0.6 ? 1 : 0, thr: t < 0.6 ? 0 : 0.5, hb: false };
  C.stepCar(W, c, P, inp, 1 / 120); t += 1 / 120;
  const ch = Math.atan2(c.vx, c.vz); turned += C.wrapA(ch - chi); chi = ch;
  const d = c._dbg;
  if (i % 12 === 0 && d) console.log(t.toFixed(2), 'v', (Math.hypot(c.vx, c.vz)).toFixed(1), 'r', c.w.toFixed(2), 'R', (Math.hypot(c.vx, c.vz) / Math.max(0.01, Math.abs(c.w))).toFixed(1), 'b', (c.beta * D).toFixed(1), 'del', (d.delta * D).toFixed(1), 'af', (d.af * D).toFixed(1), 'ar', (d.ar * D).toFixed(1), 'FyF/cap', (d.FyF / d.capF).toFixed(2), 'FyR/cap', (d.FyR / d.capR).toFixed(2), 'kF', d.kF.toFixed(2), 'kR', d.kR.toFixed(2), 'FxF', (d.FxF / d.capF).toFixed(2), 'FxR', (d.FxR / d.capR).toFixed(2), 'turn', (Math.abs(turned) * D).toFixed(0), 'g', c.gear, 'rpm', c.rpm.toFixed(0));
  if (Math.abs(turned) > 160 / D) break;
}
