// summarize brake-turn / hairpin metrics across cars and the three surfaces for a TUNE
const { execFileSync } = require('child_process');
const T = process.argv[2] || '{}';
const surf = [['pine', 0.92, 8], ['frost', 0.74, 7.5], ['mesa', 1.15, 11]];
for (const [n, g, b] of surf) {
  const out = execFileSync('node', ['brakes.js', T, g, b]).toString().trim().split('\n');
  const agg = { coastY: 0, brkY: 0, brkB: [], spins: 0, hp: 0, hpHB: 0, hpB: 0, bad: [] };
  for (const line of out) {
    const id = line.split('|')[0].trim();
    const m = line.match(/coast (\d+)°\/30m v\d+ yaw1s (\d+) b(\d+).*brk100 (\d+)°\/30m v\d+ yaw1s (\d+) b(\d+)(!?).*hpin60 ([\d.]+)s (\d+)m b(\d+)( SPIN)?.*hpinHB ([\d.]+)s (\d+)m b(\d+)( SPIN)?/);
    agg.coastY += +m[2]; agg.brkY += +m[5]; agg.brkB.push(+m[6]); agg.hp += +m[8]; agg.hpHB += +m[12];
    if (m[7] || m[11] || m[15]) agg.bad.push(id + (m[7] ? ':brk' : '') + (m[11] ? ':hp' : '') + (m[15] ? ':hb' : ''));
  }
  const k = out.length;
  console.log(n.padEnd(6), 'yaw1s coast', (agg.coastY / k).toFixed(0), 'brake', (agg.brkY / k).toFixed(0), '| brk b max', Math.max(...agg.brkB), 'avg', (agg.brkB.reduce((a, b) => a + b, 0) / k).toFixed(0), '| hpin60', (agg.hp / k).toFixed(2), 'hpHB', (agg.hpHB / k).toFixed(2), '| bad', agg.bad.join(' '));
}
