// Car against car, as in an online room: each "browser" drives its own car and sees the other only through samples
// (every 0.1 s, sent in batches, with latency), resolves its own side of a contact (C.carContact) and sends 'hit'.
// Compared with an ideal run where both sides see the truth. Reports per scenario: speed and heading of each car 1.5 s
// after the first contact, peak yaw rate, how deep and how long the real cars overlapped, impulses and messages used.
// Run: node carhit.js [scenario]
const C = require('../src/core.js');
const D = 180 / Math.PI;
C.STAGES.push({ id: 'flat', kind: 'pine', name: 'Flat', grip: 0.92, offGrip: 0.92, offDrag: 0, tyreB: 8, hw: 80, h0: 0, seed: 5, blend: 20, elev: { a1: 0, l1: 100, p1: 0, a2: 0, l2: 100, p2: 0 }, segs: [['S', 2500]] });
const W = C.buildWorld(C.STAGES.length - 1);
W.O.cols = new Map();
const car = id => C.CARS.find(c => c.id === id);
const go = (thr, steer = 0, from = 0, to = 1e9) => t => ({ steer: t >= from && t < to ? steer : 0, thr, brk: 0, hb: false, analog: true });
// a: ahead (m), r: right (m), hd: heading off the road (deg, + = right), v: speed (m/s) along its heading
const SC = {
  'rear-end':  { A: { c: 'foca', a: 0, r: 0, hd: 0, v: 30, inp: go(0.4) }, B: { c: 'impressa', a: 12, r: 0.3, hd: 0, v: 18, inp: go(0.4) } },
  'swipe':     { A: { c: 'foca', a: 0, r: -1.15, hd: 0, v: 25, inp: go(0.5, 0.25, 0.1, 0.5) }, B: { c: 'lancha', a: 0.6, r: 1.15, hd: 0, v: 25, inp: go(0.5) } },
  'T-bone':    { A: { c: 'foca', a: 0, r: 0, hd: 0, v: 15, inp: go(0.3) }, B: { c: 'delta', a: 14, r: 6, hd: 90, v: 8, inp: go(0.3) } },
  'PIT':       { A: { c: 'kwattro', a: 0, r: -1.7, hd: 0, v: 24, inp: go(0.5, 0.35, 0.2, 0.7) }, B: { c: 'selica', a: 4.8, r: 0, hd: 0, v: 22, inp: go(0.5) } },
  'head-on':   { A: { c: 'foca', a: 0, r: 0, hd: 0, v: 15, inp: go(0.2) }, B: { c: 'pejo', a: 30, r: 1.0, hd: 180, v: 15, inp: go(0.2) } },
  'rubbing':   { A: { c: 'foca', a: 0, r: -0.96, hd: 0, v: 30, inp: go(0.6, 0.05) }, B: { c: 'impressa', a: 0.5, r: 0.96, hd: 0, v: 30, inp: go(0.6, -0.05) } },
  'f1-rear':   { A: { c: 'f1', a: 0, r: 0, hd: 0, v: 40, inp: go(0.5) }, B: { c: 'foca', a: 14, r: -0.4, hd: 0, v: 25, inp: go(0.5) } },
  'parked':    { A: { c: 'foca', a: 0, r: 0.5, hd: 0, v: 20, inp: go(0.2) }, B: { c: 'delta', a: 15, r: 0, hd: 0, v: 0, inp: t => ({ steer: 0, thr: 0, brk: 0, hb: true, analog: true }) } },
};
const NET = { ideal: null, net: { lat: 0.06, jit: 0.02, rate: 6 }, slow: { lat: 0.15, jit: 0.05, rate: 3 } };

function place(d) {
  const P = car(d.c), c = C.makeCar(W, P, 300), fx = Math.sin(c.h), fz = Math.cos(c.h);
  c.x += fx * d.a - fz * d.r; c.z += fz * d.a + fx * d.r; c.h += d.hd / D;
  c.vx = Math.sin(c.h) * d.v; c.vz = Math.cos(c.h) * d.v; c.vF = d.v; c.gear = d.v > 25 ? 4 : d.v > 12 ? 3 : 1;
  C.locate(W.T, c);
  return { P, c, d, k: { hist: [], cur: 0, err: [0, 0, 0, 0], kick: null, thru: false, was: false, ep: -1e9, mute: -1e9 }, out: [], imp: 0, msg: 0, sent: 0, lastS: -1, lastSend: -1, buf: [] };
}
function run(name, mode) {
  const S = SC[name], N = NET[mode], a = place(S.A), b = place(S.B), dt = 1 / 120, R = C.rng(7);
  const yaw0 = a.c.h, yawB0 = b.c.h;
  if (C.boxContact(Object.assign(C.carBox(a.P), { x: a.c.x, z: a.c.z, h: a.c.h }), Object.assign(C.carBox(b.P), { x: b.c.x, z: b.c.z, h: b.c.h }))) return { first: -1 }; // set up on top of each other
  const vErr = { s: 0, n: 0, m: 0 };
  let t = 0, first = -1, overT = 0, overMax = 0, wMax = [0, 0], q = {};
  const mail = []; // [deliver time, to, kind, payload]
  const pairs = [[a, b], [b, a]];
  let vMax0 = 0, gain = 0, thru = 0;
  while (t < 6 && (first < 0 || t < first + 1.5)) {
    if (first < 0) vMax0 = Math.max(Math.hypot(a.c.vx, a.c.vz), Math.hypot(b.c.vx, b.c.vz));
    else if (t < first + 0.25) gain = Math.max(gain, Math.hypot(a.c.vx, a.c.vz) - vMax0, Math.hypot(b.c.vx, b.c.vz) - vMax0);
    if (a.k.thru || b.k.thru) thru = 1;
    for (const [x] of pairs) C.stepCar(W, x.c, x.P, x.d.inp(t), dt);
    // contacts: each side against the other as it sees it
    const snap = pairs.map(([, y]) => Object.assign({}, y.c));
    pairs.forEach(([x, y], i) => {
      if (N) {
        if (!x.k.hist.length) return;
        C.seenPose(x.k, t, q); // the best estimate: the drawn pose adds o.err, which only smooths the picture
      } else Object.assign(q, snap[i], { w: snap[i].w });
      q.ghost = false;
      const r = C.carContact(x.c, x.P, q, y.P, x.k, t);
      if (!r) return;
      if (r.jn > 0) x.imp++;
      if (process.env.TRACE && x.imp < 6) console.log('   ', t.toFixed(4), x === a ? 'A' : 'B', 'jn', r.jn.toFixed(0), 'vn', r.vn.toFixed(2), 'pen', r.pen.toFixed(2), 'n', r.nx.toFixed(2), r.nz.toFixed(2), 'q', q.x.toFixed(2), q.z.toFixed(2), 'first', r.first, 'thru', x.k.thru);
      if (first < 0) first = t;
      if (r.first && N) { x.sent++; mail.push([t + N.lat + R() * N.jit, y, 'hit', { t, j: [-r.Jx, -r.Jz], b: [r.bf, r.br], dv: r.own, h: r.h }]); }
    });
    t += dt;
    // the network
    if (N) {
      for (const [x, y] of pairs) {
        if (t - x.lastS >= 0.1 - 1e-9) { x.lastS = t; x.buf.push([t, x.c.x, x.c.y, x.c.z, x.c.h, x.c.vx, x.c.vz, x.c.s, 0, 0, 0, 0, 0]); }
        if (t - x.lastSend >= 1 / N.rate - 1e-9) { x.lastSend = t; mail.push([t + N.lat + R() * N.jit, y, 'st', x.buf]); x.buf = []; }
      }
      mail.sort((m, n) => m[0] - n[0]);
      while (mail.length && mail[0][0] <= t) {
        const [, to, kind, p] = mail.shift();
        if (kind === 'st') C.trackTake(to.k, p, t);
        else if (C.carHitMsg(to.c, to.P, to.k, p, t)) to.msg++;
      }
      for (const x of [a, b]) for (let i = 0; i < 4; i++) x.k.err[i] *= Math.exp(-dt * 5);
    }
    // how far off each side's view of the other is (as drawn: with err), before the first contact
    if (N && first < 0) for (const [x, y] of pairs) if (x.k.hist.length) { C.seenPose(x.k, t, q); const e = Math.hypot(q.x + x.k.err[0] - y.c.x, q.z + x.k.err[2] - y.c.z); vErr.s += e * e; vErr.n++; vErr.m = Math.max(vErr.m, e); }
    // the truth
    const BA = Object.assign(C.carBox(a.P), { x: a.c.x, z: a.c.z, h: a.c.h }), BB = Object.assign(C.carBox(b.P), { x: b.c.x, z: b.c.z, h: b.c.h });
    const ct = C.boxContact(BA, BB);
    if (ct) { overMax = Math.max(overMax, ct.pen); if (ct.pen > 0.1) overT += dt; }
    if (process.env.TRACE2 && first >= 0 && Math.round(t * 120) % 6 === 0) {
      const vp = (x, y) => { if (!x.k.hist.length) return '-'; C.seenPose(x.k, t, q); const B1 = Object.assign(C.carBox(x.P), { x: x.c.x, z: x.c.z, h: x.c.h }), B2 = Object.assign(C.carBox(y.P), { x: q.x + x.k.err[0], z: q.z + x.k.err[2], h: q.h + x.k.err[3] }); const r = C.boxContact(B1, B2); return (r ? r.pen.toFixed(2) : '----') + ' e' + Math.hypot(q.x + x.k.err[0] - y.c.x, q.z + x.k.err[2] - y.c.z).toFixed(2) + ' eh' + (C.wrapA(q.h + x.k.err[3] - y.c.h) * D).toFixed(0) + (x.k.kick ? 'K' : ' ') + (x.k.thru ? 'T' : ' '); };
      console.log(t.toFixed(2), 'true', ct ? ct.pen.toFixed(2) : '----', '| A sees', vp(a, b), '| B sees', vp(b, a), '| wB', b.c.w.toFixed(2), 'vB', Math.hypot(b.c.vx, b.c.vz).toFixed(1), 'vA', Math.hypot(a.c.vx, a.c.vz).toFixed(1));
    }
    if (process.env.TRACE && first >= 0 && t < first + 0.8 && Math.round(t * 120) % 3 === 0) {
      const v = (x, k) => { if (!x.k.hist.length) return '-'; C.seenPose(x.k, t, q); const o = k.c; return `${(q.x - o.x).toFixed(2)},${(q.z - o.z).toFixed(2)}`; };
      console.log(t.toFixed(3), 'pen', ct ? ct.pen.toFixed(2) : '----', 'A', a.c.x.toFixed(2), a.c.z.toFixed(2), Math.hypot(a.c.vx, a.c.vz).toFixed(1), 'B', b.c.x.toFixed(2), b.c.z.toFixed(2), b.c.vx.toFixed(1), b.c.vz.toFixed(1), 'A-view-err', v(a, b), 'B-view-err', v(b, a), 'kickA', !!a.k.kick, 'kickB', !!b.k.kick, a.k.thru, b.k.thru);
    }
    if (first >= 0) { wMax[0] = Math.max(wMax[0], Math.abs(a.c.w)); wMax[1] = Math.max(wMax[1], Math.abs(b.c.w)); }
  }
  const sp = x => Math.hypot(x.c.vx, x.c.vz) * 3.6;
  return { first, a: [sp(a), C.wrapA(a.c.h - yaw0) * D, wMax[0]], b: [sp(b), C.wrapA(b.c.h - yawB0) * D, wMax[1]], overMax, overT, imp: [a.imp, b.imp], msg: [a.msg, b.msg], sent: [a.sent, b.sent],
    gain, thru, vErr: vErr.n ? [Math.sqrt(vErr.s / vErr.n), vErr.m] : [0, 0], p: [a.P.mass * a.c.vx + b.P.mass * b.c.vx, a.P.mass * a.c.vz + b.P.mass * b.c.vz] };
}
const f = (v, n = 0, w = 5) => v.toFixed(n).padStart(w);
if (process.argv[2] === 'fuzz') {
  // random encounters: B somewhere ahead, any heading, both driving with a random steer; how bad does it get
  const R = C.rng(11), ids = C.CARS.map(c => c.id).filter(i => i !== 'saveiro'), pick = () => ids[Math.floor(R() * ids.length)];
  for (const mode of ['ideal', 'net', 'slow']) {
    const res = [];
    for (let n = 0; n < 300; n++) {
      // they'd meet about T s in, B's centre `off` m to the side of A's nose; B's heading (+ = left) any way round
      const hd = (R() * 2 - 1) * 180, v = 5 + R() * 30, vb = R() * 30, T = 0.6, off = (R() * 2 - 1) * 2.2, ma = v * T + 3, ba = Math.cos(hd / D), br = -Math.sin(hd / D);
      SC.fz = { A: { c: pick(), a: 0, r: 0, hd: 0, v, inp: go(R(), (R() * 2 - 1) * 0.2, R() * 0.5, R() * 1.5) },
        B: { c: pick(), a: ma - ba * vb * T - ba * 2.5, r: off - br * vb * T - br * 2.5, hd, v: vb, inp: go(R(), (R() * 2 - 1) * 0.2, 0, R() * 2) } };
      const r = run('fz', mode); if (r.first >= 0) res.push(r); else continue;
      if (process.env.CASE == n && process.env.MODE === mode) { SC.case = SC.fz; process.env.TRACE2 = 1; run('case', mode); delete process.env.TRACE2; }
      if (process.env.BAD && r.overMax > 0.7) console.log(mode, n, JSON.stringify({ A: Object.assign({}, SC.fz.A, { inp: undefined }), B: Object.assign({}, SC.fz.B, { inp: undefined }) }), 'over', r.overMax.toFixed(2), r.overT.toFixed(2), 'thru', r.thru);
    }
    const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    const ov = res.map(r => r.overMax), ot = res.map(r => r.overT), w = res.map(r => Math.max(r.a[2], r.b[2])), g = res.map(r => r.gain);
    console.log(mode.padEnd(6), res.length, 'contacts | overlap p50', f(q(ov, 0.5), 2), 'p95', f(q(ov, 0.95), 2), 'max', f(q(ov, 1), 2), '| >0.1 m for p95', f(q(ot, 0.95), 2), 's max', f(q(ot, 1), 2),
      '| pass-through', res.filter(r => r.thru).length, '| yaw p95', f(q(w, 0.95), 1), 'max', f(q(w, 1), 1), '| speed gain max', f(q(g, 1), 1), 'm/s');
  }
  process.exit(0);
}
const only = process.argv[2], onlyMode = process.argv[3];
console.log('scenario   mode    first | A km/h  hdg°  w   | B km/h  hdg°  w   | overlap max/s | imp A/B  msg A/B');
for (const name of Object.keys(SC)) {
  if (only && only !== name) continue;
  for (const mode of Object.keys(NET)) { if (onlyMode && onlyMode !== mode) continue;
    const r = run(name, mode);
    if (r.first < 0) { console.log(name.padEnd(10), mode.padEnd(6), '  no contact'); continue; }
    console.log(name.padEnd(10), mode.padEnd(6), f(r.first, 2), '|', f(r.a[0]), f(r.a[1]), f(r.a[2], 1, 4), ' |', f(r.b[0]), f(r.b[1]), f(r.b[2], 1, 4), ' |', f(r.overMax, 2), f(r.overT, 2), '   |', `${r.imp[0]}/${r.imp[1]}`.padStart(6), `${r.msg[0]}/${r.msg[1]}`.padStart(7), '  view', f(r.vErr[0], 2), f(r.vErr[1], 2));
  }
}
