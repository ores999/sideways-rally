const C = require('../src/core.js');
for (let si = 0; si < C.STAGES.length; si++) {
  const W = C.buildWorld(si); const T = W.T;
  for (const ci of [0, 4, 5]) {
    const P = C.CARS[ci]; const ai = C.prepAI(W, P, 0.82); const c = C.makeCar(W, P, T.spawnS);
    let t = 0, off = 0, resets = 0, hits = 0, flips = 0, last = 0;
    while (t < 300) {
      const a = C.aiDrive(W, c, P, ai);
      // keyboard-like: digital steering with deadband, digital pedals, reaction delay ~ via 20 Hz updates
      if (Math.round(t * 120) % 6 === 0) {
        const st = Math.abs(a.steer) > 0.08 ? Math.sign(a.steer) : 0;
        if (st !== last) flips++; last = st;
        c._inp = { steer: st, thr: a.thr > 0.5 ? 1 : 0, brk: a.brk > 0.2 ? 1 : 0, hb: false, analog: false };
      }
      C.stepCar(W, c, P, c._inp, 1 / 120); t += 1 / 120;
      if (!c.onRoad) off += 1 / 120; if (c.hitV > 3) hits++; c.hitV = 0;
      c._st = Math.hypot(c.vx,c.vz) < 1.5 ? (c._st||0) + 1/120 : 0; if (Math.abs(c.lat) > 26 || c._st > 2.5) { C.resetCar(W, c, c.s - 10); resets++; c._st = 0; }
      if (c.s >= T.finishS) break;
    }
    console.log(W.st.name.padEnd(11), P.name.padEnd(22), t.toFixed(1) + 's', 'off', off.toFixed(1), 'hits', hits, 'resets', resets, 'steer changes/s', (flips / t).toFixed(1));
  }
}
