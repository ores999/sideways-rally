// For netcrash.py: two browsers' own-car traces [wt, x, z, h, speed, yaw rate, car hit, kick|thru|soft, seen gap] on
// the shared race clock. Lines them up and measures the real overlap of the two bodies, prints JSON.
const C = require('../src/core.js');
const { cars, A, B } = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const PA = C.CARS[cars[0]], PB = C.CARS[cars[1]];
let j = 0, overMax = 0, run = 0, longest = 0, contacts = 0, prevIn = false, yawMax = 0;
const at = t => {
  while (j < B.length - 2 && B[j + 1][0] < t) j++;
  const a = B[j], b = B[j + 1]; if (!a || !b || t < a[0] || t > b[0] || b[0] - a[0] > 0.1) return null;
  const u = (t - a[0]) / (b[0] - a[0]);
  return { x: a[1] + (b[1] - a[1]) * u, z: a[2] + (b[2] - a[2]) * u, h: a[3] + C.wrapA(b[3] - a[3]) * u };
};
for (let i = 1; i < A.length; i++) {
  const r = A[i], q = at(r[0]); if (!q) continue;
  const ct = C.boxContact(Object.assign(C.carBox(PA), { x: r[1], z: r[2], h: r[3] }), Object.assign(C.carBox(PB), q));
  const pen = ct ? ct.pen : 0;
  if (pen > 0 && !prevIn) contacts++;
  prevIn = pen > 0;
  overMax = Math.max(overMax, pen);
  if (pen > 0.1) { run += r[0] - A[i - 1][0]; longest = Math.max(longest, run); } else run = 0;
}
for (const T of [A, B]) for (const r of T) yawMax = Math.max(yawMax, Math.abs(r[5]));
const felt = [A, B].map(T => T.filter(r => r[6] > 0).length), hard = [A, B].map(T => Math.max(0, ...T.map(r => r[6])));
console.log(JSON.stringify({ contacts, overlapMax: +overMax.toFixed(3), overlapLong: +longest.toFixed(3), yawMax: +yawMax.toFixed(2), felt, hardest: hard.map(v => +v.toFixed(1)),
  thru: [A, B].map(T => T.filter(r => r[7] & 2).length), soft: [A, B].map(T => T.filter(r => r[7] & 4).length) }));
