// Power-on stability: full throttle while steering at various speeds; reports peak slip angle and spins.
const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
const grip = +(process.argv[3] || 0.92), tyreB = +(process.argv[4] || 8);
C.STAGES.push({ id: 'flat', name: 'Flat', grip, offGrip: grip, offDrag: 0, tyreB, hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
const D = 180 / Math.PI;
function gearFor(P, v) { // pick the gear auto would hold at this speed
  for (let g = 1; g <= P.gearbox.gears; g++) { const rpm = v / C.RW * P.ratios[g - 1] * P.final * 60 / (2 * Math.PI); if (rpm < P.engine.redline - 400) return g; }
  return P.gearbox.gears;
}
function run(P, v0, f, T) {
  const c = C.makeCar(W, P, 600); c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0; c.gear = gearFor(P, v0);
  c.rpm = v0 / C.RW * P.ratios[c.gear - 1] * P.final * 60 / (2 * Math.PI);
  let t = 0, bMax = 0, slide = 0, spun = false;
  while (t < T) {
    C.stepCar(W, c, P, Object.assign({ steer: 0, thr: 0, brk: 0, hb: false }, f(t, c)), 1 / 120); t += 1 / 120;
    const b = Math.abs(c.beta); bMax = Math.max(bMax, b); if (b > 0.44) slide += 1 / 120; if (b > 1.05) spun = true;
  }
  return { bMax: bMax * D, slide, spun };
}
const only = process.argv[5];
for (const P of C.CARS) {
  if (only && P.id !== only) continue;
  const out = [P.id.padEnd(8)];
  for (const kmh of [30, 50, 80, 110]) {
    const v = kmh / 3.6;
    const cells = [];
    for (const st of [0.35, 0.7, 1]) {
      // coast in with the wheel turned, floor it at 0.4 s (boost arrives mid-corner)
      const r = run(P, v, t => ({ steer: -st, thr: t > 0.4 ? 1 : 0 }), 2.6);
      cells.push(`${r.bMax.toFixed(0).padStart(2)}${r.spun ? '!' : r.slide > 0.5 ? '~' : ' '}`);
    }
    out.push(`${kmh}: ${cells.join(' ')}`);
  }
  console.log(out.join(' | '));
}
