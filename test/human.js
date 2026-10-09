// Imperfect keyboard driver: AI line at a given aggression, digital inputs at 20 Hz with a reaction lag.
const C = require('../src/core.js');
if (process.argv[2]) Object.assign(C.TUNE, JSON.parse(process.argv[2]));
const aggrs = (process.argv[3] || '0.95,1.05').split(',').map(Number);
const only = process.argv[4];
const res = {};
for (let si = 0; si < C.STAGES.length; si++) {
  const W = C.buildWorld(si); const T = W.T;
  for (const P of C.CARS) {
    if (only && P.id !== only) continue;
    for (const ag of aggrs) {
      const ai = C.prepAI(W, P, ag); const c = C.makeCar(W, P, T.spawnS);
      let t = 0, off = 0, resets = 0, hits = 0, spins = 0, inSpin = false, q = [];
      while (t < 300) {
        const a = C.aiDrive(W, c, P, ai);
        if (Math.round(t * 120) % 6 === 0) {
          q.push({ steer: Math.abs(a.steer) > 0.1 ? Math.sign(a.steer) : 0, thr: a.thr > 0.5 ? 1 : 0, brk: a.brk > 0.25 ? 1 : 0, hb: false, analog: false });
          if (q.length > 3) q.shift(); // ~0.1 s reaction lag
          c._inp = q[0];
        }
        C.stepCar(W, c, P, c._inp, 1 / 120); t += 1 / 120;
        if (!c.onRoad) off += 1 / 120; if (c.hitV > 4) hits++; c.hitV = 0;
        const b = Math.abs(c.beta);
        if (b > 1.0 && !inSpin) { spins++; inSpin = true; } else if (b < 0.3) inSpin = false;
        c._st = Math.hypot(c.vx, c.vz) < 1.5 ? (c._st || 0) + 1 / 120 : 0;
        if (Math.abs(c.lat) > 26 || c._st > 2.5) { C.resetCar(W, c, c.s - 10); resets++; c._st = 0; }
        if (c.s >= T.finishS) break;
      }
      const k = P.id; res[k] = res[k] || { t: 0, off: 0, resets: 0, spins: 0, hits: 0 };
      res[k].t += t; res[k].off += off; res[k].resets += resets; res[k].spins += spins; res[k].hits += hits;
      console.log(W.st.id.padEnd(6), P.id.padEnd(9), ag, t.toFixed(1) + 's', 'off', off.toFixed(1), 'hits', hits, 'resets', resets, 'spins', spins);
    }
  }
}
console.log('--- totals');
for (const k in res) console.log(k.padEnd(9), 't', res[k].t.toFixed(0), 'off', res[k].off.toFixed(0), 'hits', res[k].hits, 'resets', res[k].resets, 'spins', res[k].spins);
