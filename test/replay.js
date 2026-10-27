// Replays run the physics again on the recorded inputs (game.js `rec`/`rp`), so stepCar must be deterministic:
// the same inputs from a copy of the car (structuredClone, as the game takes one every second) give the same run.
// Drives each stage and car for 40 s with the AI plus some noise, handbrake taps and a reset, then replays it from the
// start and from a copy part way through. Expect 0 everywhere.
const C = require('../src/core.js');
const SECS = +(process.argv[2] || 40);
let worst = 0;
for (let si = 0; si < C.STAGES.length; si++) {
  const W = C.buildWorld(si);
  for (const P of C.CARS) {
    if (P.only && ![].concat(P.only).includes(W.st.id)) continue;
    const ai = C.prepAI(W, P, 1.1), c = C.makeCar(W, P, W.T.spawnS), rec = [], snaps = [], trace = [], resets = new Map();
    c.rpm = 4200; // revved on the line
    for (let k = 0; k < 120 * SECS; k++) {
      if (k % 120 === 0) snaps.push({ k, c: structuredClone(c) });
      if (k === 120 * 17) { const s = Math.max(W.T.spawnS, c.s - 12); resets.set(k, s); C.resetCar(W, c, s); }
      const a = C.aiDrive(W, c, P, ai), inp = { steer: a.steer + Math.sin(k * 0.05) * 0.2, thr: a.thr, brk: a.brk, hb: k % 700 < 30, analog: true };
      rec.push(inp);
      C.stepCar(W, c, P, inp, 1 / 120); c.hitV = 0; c.landV = 0;
      trace.push(c.x, c.z, c.h, c.vx);
    }
    const replay = sn => {
      const r = structuredClone(sn.c); let e = 0;
      for (let k = sn.k; k < rec.length; k++) {
        if (resets.has(k)) C.resetCar(W, r, resets.get(k));
        C.stepCar(W, r, P, rec[k], 1 / 120); r.hitV = 0; r.landV = 0;
        e = Math.max(e, Math.abs(r.x - trace[k * 4]), Math.abs(r.z - trace[k * 4 + 1]), Math.abs(r.h - trace[k * 4 + 2]), Math.abs(r.vx - trace[k * 4 + 3]));
      }
      return e;
    };
    const e = Math.max(replay(snaps[0]), replay(snaps[Math.floor(snaps.length / 2)]), replay(snaps[snaps.length - 1]));
    worst = Math.max(worst, e);
    if (e > 0) console.log(`${W.st.name} ${P.name}: off by ${e}`);
  }
}
console.log(worst === 0 ? 'replays exact on every stage and car' : `worst ${worst}`);
