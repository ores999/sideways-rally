const C = require('../src/core.js');
Object.assign(C.TUNE, JSON.parse(process.argv[3] || '{}'));
C.STAGES.push({ id: 'flat', name: 'Flat', grip: +(process.argv[4] || 1.15), offGrip: 1, offDrag: 0, tyreB: +(process.argv[5] || 11), hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
const P = C.CARS.find(p => p.id === process.argv[2]);
const c = C.makeCar(W, P, 600); c.vx = Math.sin(c.h) * 25; c.vz = Math.cos(c.h) * 25; c.vF = 25; c.gear = 4; c._dbgOn = true;
const D = 180 / Math.PI; let t = 0;
for (let i = 0; i < 240; i++) {
  C.stepCar(W, c, P, { steer: -1, brk: 1, thr: 0, hb: false }, 1 / 120); t += 1 / 120;
  const d = c._dbg;
  if (i % 10 === 0) console.log(t.toFixed(2), 'v', Math.hypot(c.vx, c.vz).toFixed(1), 'r', c.w.toFixed(2), 'b', (c.beta * D).toFixed(0), 'af', (d.af * D).toFixed(0), 'ar', (d.ar * D).toFixed(0), 'FyF', (d.FyF / d.capF).toFixed(2), 'FyR', (d.FyR / d.capR).toFixed(2), 'FxF', (d.FxF / d.capF).toFixed(2), 'FxR', (d.FxR / d.capR).toFixed(2), 'capF', d.capF.toFixed(0), 'capR', d.capR.toFixed(0), 'assist', d.assist.toFixed(2), 'del', (d.delta * D).toFixed(0));
}
