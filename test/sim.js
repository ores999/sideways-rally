const C = require('../src/core.js');
const only = process.argv[2];
for (let si = 0; si < C.STAGES.length; si++) {
  if (only && C.STAGES[si].id !== only) continue;
  let t0 = Date.now();
  const W = C.buildWorld(si);
  const tb = Date.now() - t0;
  console.log(`\n== ${W.st.name}  build ${tb}ms  grid ${W.TR.nx}x${W.TR.nz}  trees ${W.O.trees.length} rocks ${W.O.rocks.length} cacti ${W.O.cacti.length} fans ${W.O.fans.length} chev ${W.O.chevrons.length} hay ${W.O.hay.length}`);
  for (const P of C.CARS) {
    t0 = Date.now();
    const r = C.simulateRun(W, P, { aggr: +(process.argv[3] || 1.2) });
    const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
    console.log(`${P.name.padEnd(24)} ${fmt(r.time)} fin=${r.finished} off=${r.offT.toFixed(1)}s hits=${r.hits} resets=${r.resets} maxAir=${r.maxAir.toFixed(2)}s land=${r.maxLand.toFixed(1)} splits=${r.splits.map(fmt).join(' ')}  (${Date.now() - t0}ms)`);
  }
}
