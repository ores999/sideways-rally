// Steering under braking, hairpin turning and power-on stability, per car.
// usage: node brakes.js [TUNE-json] [grip] [tyreB]
const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
C.STAGES.push({ id: 'flat', name: 'Flat', grip: +(process.argv[3] || 0.92), offGrip: 0.92, offDrag: 0, tyreB: +(process.argv[4] || 8), hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
const D = 180 / Math.PI;
function run(P, v0, gear, T, f, stop) {
  const c = C.makeCar(W, P, 600); c.vx = Math.sin(c.h) * v0; c.vz = Math.cos(c.h) * v0; c.vF = v0; c.gear = gear;
  const h0 = Math.atan2(c.vx, c.vz), x0 = c.x, z0 = c.z;
  let t = 0, path = 0, bMax = 0, chi = h0, turned = 0, spun = false;
  while (t < T) {
    const inp = Object.assign({ steer: 0, thr: 0, brk: 0, hb: false }, f(t, c));
    const px = c.x, pz = c.z;
    C.stepCar(W, c, P, inp, 1 / 120); t += 1 / 120;
    path += Math.hypot(c.x - px, c.z - pz);
    const v = Math.hypot(c.vx, c.vz);
    if (v > 1) { const ch = Math.atan2(c.vx, c.vz); turned += C.wrapA(ch - chi); chi = ch; }
    bMax = Math.max(bMax, Math.abs(c.beta));
    if (Math.abs(c.beta) > 1.2) spun = true;
    if (stop && stop(c, t, turned)) break;
  }
  return { t, path, turned: Math.abs(turned) * D, bMax: bMax * D, v: Math.hypot(c.vx, c.vz), spun, c, x0, z0, h0 };
}
const rows = [];
for (const P of C.CARS) {
  const out = [P.id.padEnd(8)];
  // A) 90 km/h, steer full (keyboard), coast vs brake: degrees of path turned over the first 30 m
  const by30 = (c, t) => false;
  for (const [lbl, brk] of [['coast', 0], ['brk50', 0.5], ['brk100', 1]]) {
    const r = run(P, 25, 4, 4, t => ({ steer: -1, brk }), (c, t) => false);
    // re-run measuring at 30 m of travel
    const r30 = run(P, 25, 4, 4, t => ({ steer: -1, brk }), (() => { let p = 0, lx = null, lz = null; return (c) => { if (lx !== null) p += Math.hypot(c.x - lx, c.z - lz); lx = c.x; lz = c.z; return p > 30; }; })());
    const r1 = run(P, 25, 4, 1.0, t => ({ steer: -1, brk }));
    const yaw1 = Math.abs(C.wrapA(r1.c.h - r1.h0)) * D;
    const r2 = run(P, 25, 4, 2.0, t => ({ steer: -1, brk }));
    out.push(`${lbl} ${r30.turned.toFixed(0)}°/30m v${(r30.v * 3.6).toFixed(0)} yaw1s ${yaw1.toFixed(0)} b${r2.bMax.toFixed(0)}${r2.spun ? "!" : ""}`);
  }
  // B) hairpin: 45 km/h entry, brake + full steer for 0.6 s then full steer, part throttle; time & path to turn 160°
  const hp = (lbl, f) => { const r = run(P, 12.5, 2, 6, f, (c, t, turned) => Math.abs(turned) > 160 * Math.PI / 180); out.push(`${lbl} ${r.t.toFixed(2)}s ${r.path.toFixed(0)}m b${r.bMax.toFixed(0)}${r.spun ? ' SPIN' : ''}`); };
  // brake while turning until 32 km/h, then a little throttle
  const hp2 = (lbl, v0, f) => { const r = run(P, v0, 3, 8, f, (c, t, turned) => Math.abs(turned) > 160 * Math.PI / 180); out.push(`${lbl} ${r.t.toFixed(2)}s ${r.path.toFixed(0)}m b${r.bMax.toFixed(0)}${r.spun ? ' SPIN' : ''}`); };
  hp2('hpin60', 16.7, (t, c) => { const v = Math.hypot(c.vx, c.vz); if (v > 9) c._ph = 1; else if (c._ph === 1) c._ph = 2; return c._ph === 2 ? { steer: -1, thr: 0.35 } : { steer: -1, brk: 1 }; });
  hp2('hpinHB', 16.7, (t, c) => { const v = Math.hypot(c.vx, c.vz); return v > 10 && !c._d ? { steer: -1, brk: 1 } : (c._d = (c._d || 0) + 1, c._d < 40 ? { steer: -1, hb: true } : { steer: -1, thr: 0.5 }); });
  // C) power-on: 35 km/h in 2nd, full steer + full throttle for 2.5 s (hairpin exit, foot down)
  let r = run(P, 10, 2, 2.5, t => ({ steer: -1, thr: 1 }));
  out.push(`exitFull b${r.bMax.toFixed(0)}${r.spun ? ' SPIN' : ''}`);
  // D) exit: half steer, full throttle from 50 km/h in 2nd
  r = run(P, 14, 2, 2.5, t => ({ steer: -0.5, thr: 1 }));
  out.push(`exitHalf b${r.bMax.toFixed(0)}${r.spun ? ' SPIN' : ''}`);
  rows.push(out.join(' | '));
}
console.log(rows.join('\n'));
