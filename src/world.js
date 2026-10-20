// ===================== WORLD: stage visuals, scenery, car models =====================
const WORLD = (() => {
'use strict';
const { Geo, lin, mixc, scalec } = GFX;
const C = RallyCore;

const VIS = {
  pine: {
    zen: '#3d78c4', fogCol: '#b9cfe0', glow: '#fff2d6', sunDisc: '#fff4de', cloudCol: '#f4f7fb', clouds: 0.6,
    sunEl: 34, sunAz: 150, sunCol: '#fff0d6', sunI: 2.7, sky: '#8fb4dc', skyI: 0.78, gnd: '#5e5a3c', gndI: 0.5, exp: 0.95,
    fog: [70, 470], road: ['#9a7f5f', '#6c5640', '#b8a585'], icy: 0, lines: false, tt: [1.25, 1.1, 0.62], rays: 0.35,
    grass: ['#4b5c2b', '#5d6c34', '#3a4a24', '#7f7b4b'], verge: '#86735a', rock: '#7a766d', dirt: '#6a5840',
    pine: ['#2c4a25', '#365a2b', '#22401e'], trunk: '#5a4330', birch: ['#5f8a34', '#7a9c40', '#94a64a'],
    dust: [0.42, 0.34, 0.24], mark: [0.12, 0.09, 0.06, 0.45], far: '#5f7f86', skirt: '#4b6230',
    grade: { lift: [0.0, 0.012, 0.02], gain: [1.03, 1.0, 0.955], sat: 1.0, con: 0.13, vig: 0.24, bloom: 0.07, thr: 1.1 },
  },
  frost: {
    zen: '#16285a', fogCol: '#7c86ad', glow: '#ff9a62', sunDisc: '#ffb98a', cloudCol: '#c5a3b8', clouds: 0.45, stars: 0.9,
    sunEl: 5, sunAz: 240, sunCol: '#ffb58a', sunI: 1.3, sky: '#6f86c6', skyI: 0.85, gnd: '#8e95b8', gndI: 0.55, exp: 1.05,
    fog: [40, 380], road: ['#d7deea', '#9eadc4', '#f3f6fb'], icy: 0.9, lines: false, tt: [0.93, 0.97, 1.05], rays: 0.45,
    snow: ['#eef2f9', '#e3e9f4', '#f7f9fd'], verge: '#c9cfda', rock: '#4f5566',
    pine: ['#1d3424', '#24402b', '#18301f'], trunk: '#3e3026',
    dust: [0.92, 0.95, 1.0], mark: [0.32, 0.36, 0.46, 0.5], far: '#56608a', skirt: '#cfd6e6', night: true, snowfall: true,
    grade: { lift: [0.012, 0.0, 0.03], gain: [1.02, 0.985, 1.0], sat: 1.04, con: 0.1, vig: 0.3, bloom: 0.1, thr: 1.15 },
  },
  forest: {
    zen: '#4a78a8', fogCol: '#a8b8ae', glow: '#ffe2b4', sunDisc: '#fff1d8', cloudCol: '#eef2ee', clouds: 0.5,
    sunEl: 22, sunAz: 120, sunCol: '#ffe8c8', sunI: 2.5, sky: '#8fb0c8', skyI: 0.85, gnd: '#4a5034', gndI: 0.5, exp: 1.0,
    fog: [50, 340], road: ['#7f6a50', '#5a4936', '#a08c6c'], icy: 0, lines: false, tt: [1.18, 1.05, 0.7], rays: 0.45,
    grass: ['#4a4f28', '#3d4a24', '#3a3220', '#5f5a34'], verge: '#6f5f48', rock: '#6f6c64', dirt: '#5a4a36',
    tuftPer: 3, tuftTint: [[0.86, 0.92, 0.78], [0.8, 0.88, 0.72], [0.95, 0.9, 0.74]],
    pine: ['#24401f', '#2d4c26', '#1c3619'], trunk: '#4e3a2a', birch: ['#5f8a34', '#7a9c40', '#94a64a'],
    dust: [0.38, 0.31, 0.22], mark: [0.11, 0.08, 0.05, 0.45], far: '#56766e', skirt: '#40562a',
    grade: { lift: [0.0, 0.016, 0.018], gain: [1.03, 1.0, 0.95], sat: 1.06, con: 0.14, vig: 0.28, bloom: 0.08, thr: 1.1 },
  },
  mesa: {
    zen: '#3a6db3', fogCol: '#e9c39b', glow: '#ffcf96', sunDisc: '#ffe1b8', cloudCol: '#fbe7d4', clouds: 0.3,
    sunEl: 16, sunAz: 300, sunCol: '#ffd6a6', sunI: 3.1, sky: '#a9bfe0', skyI: 0.7, gnd: '#a4673f', gndI: 0.55, exp: 1.0,
    fog: [140, 560], road: ['#4c4b4e', '#38373a', '#7a6a5e'], icy: 0, lines: true, tt: [1.1, 0.9, 0.78], rays: 0.3,
    sand: ['#c98a54', '#d49a63', '#b9784a', '#dcab78'], verge: '#b98a63', rock: '#9d4c2c', strata: ['#a5502e', '#c46a3c', '#8a3f25', '#d18a57'],
    cactus: ['#4b6b3a', '#5a7a44', '#3f5c30'],
    dust: [0.72, 0.5, 0.34], mark: [0.04, 0.04, 0.05, 0.55], far: '#b8826a', skirt: '#b57a4c',
    grade: { lift: [0.018, 0.006, 0.0], gain: [1.035, 1.0, 0.94], sat: 1.08, con: 0.14, vig: 0.24, bloom: 0.06, thr: 1.2 },
  },
  // downtown: a clear, slightly hazy afternoon over grey streets and pale concrete sidewalks (the buildings' colours are
  // in CITY_STYLES)
  city: {
    zen: '#3f74b8', fogCol: '#bcc6cf', glow: '#fff0d8', sunDisc: '#fff4e0', cloudCol: '#f2f4f7', clouds: 0.45,
    sunEl: 38, sunAz: 210, sunCol: '#fff2dc', sunI: 2.8, sky: '#95b4d6', skyI: 0.8, gnd: '#6a6862', gndI: 0.5, exp: 0.98,
    fog: [80, 520], road: ['#4b4b4f', '#3b3b3f', '#6f6b67'], icy: 0, lines: true, tt: [1.0, 1.0, 1.0], rays: 0.3,
    ground: ['#4a4a4d', '#454549', '#525256', '#3e3e42'], verge: '#86827b', rock: '#77756f', walk: '#a29a8d', kerb: '#aaa498', roof: '#6b6965',
    birch: ['#4b6a2f', '#577636', '#647d3c'],
    dust: [0.6, 0.6, 0.6], mark: [0.04, 0.04, 0.05, 0.55], far: '#7f8b98', skirt: '#4c4d50',
    grade: { lift: [0.006, 0.008, 0.014], gain: [1.02, 1.0, 0.97], sat: 0.98, con: 0.12, vig: 0.24, bloom: 0.06, thr: 1.15 },
  },
};

// ---------- conditions ----------
// night and rain are built from each stage's own palette, so a wet Pine Ridge still looks like Pine Ridge
const darken = (hex, k) => { const v = parseInt(hex.slice(1), 16); const f = c => Math.round(Math.min(255, c * k)).toString(16).padStart(2, '0'); return '#' + f((v >> 16) & 255) + f((v >> 8) & 255) + f(v & 255); };
function nightVis(B, st) {
  const frost = st.kind === 'frost';
  return {
    zen: '#02050c', fogCol: frost ? '#0e1528' : '#0a1019', glow: '#1a2438', sunDisc: '#e6edff', cloudCol: '#121827', clouds: Math.min(B.clouds, 0.3), stars: 1.0,
    sunEl: 34, sunAz: (B.sunAz + 50) % 360, sunCol: '#8ea4dc', sunI: frost ? 0.42 : 0.34, sky: '#22314e', skyI: frost ? 0.36 : 0.28, gnd: B.gnd, gndI: 0.12, exp: 1.3,
    fog: [22, frost ? 260 : 230], rays: 0, night: true, hl: 1.7,
    grade: { lift: [0.0, 0.006, 0.022], gain: [0.97, 1.0, 1.06], sat: 0.9, con: 0.16, vig: 0.4, bloom: 0.17, thr: 0.85 },
  };
}
function rainVis(B, st) {
  if (st.kind === 'frost') return {
    zen: '#4a5778', fogCol: '#8790ad', glow: '#b8bfd6', sunDisc: '#d8dcea', cloudCol: '#9aa2bd', clouds: 1.0, overcast: 0.85, stars: 0,
    sunI: 0.55, sunCol: '#d9dff0', sky: '#7f8db8', skyI: 1.0, gndI: 0.65, fog: [18, 170], rays: 0, blizzard: true,
    grade: { lift: [0.01, 0.01, 0.025], gain: [0.99, 0.99, 1.02], sat: 0.85, con: 0.08, vig: 0.32, bloom: 0.08, thr: 1.2 },
  };
  const g = B.grass ? { grass: B.grass.map(c => darken(c, 0.82)) } : B.sand ? { sand: B.sand.map(c => darken(c, 0.72)) }
    : B.ground ? { ground: B.ground.map(c => darken(c, 0.7)), walk: darken(B.walk, 0.72), kerb: darken(B.kerb, 0.75) } : {};
  return Object.assign(g, {
    zen: '#56616e', fogCol: '#8c959e', glow: '#c2c8ce', sunDisc: '#dfe3e8', cloudCol: '#a2aab3', clouds: 1.0, overcast: 0.8,
    sunI: B.sunI * 0.3, sunCol: '#e6eaee', sky: '#97a3b0', skyI: 1.08, gndI: 0.42, exp: 1.06, fog: [30, 250], rays: 0, wet: 1, rain: true,
    road: B.road.map(c => darken(c, 0.66)), verge: darken(B.verge, 0.7), dirt: B.dirt && darken(B.dirt, 0.7),
    dust: B.dust.map(v => v * 0.7), mark: B.mark,
    grade: { lift: [0.008, 0.012, 0.016], gain: [0.98, 1.0, 1.02], sat: 0.86, con: 0.11, vig: 0.3, bloom: 0.08, thr: 1.15 },
  });
}
function visOf(st) {
  if (st._vis) return st._vis;
  const B = VIS[st.id];
  const V = st.cond === 'night' ? Object.assign({}, B, nightVis(B, st)) : st.cond === 'rain' ? Object.assign({}, B, rainVis(B, st)) : B;
  Object.defineProperty(st, '_vis', { value: V, enumerable: false, configurable: true });
  return V;
}

// what the horizon looks like in reflections: the tree line, snowy hills or the buttes, hazed towards the fog
const SKYLINE = { pine: '#3c4a37', forest: '#2c3829', frost: '#56607a', mesa: '#9a6449', city: '#8e9298' };
function skylineOf(V, st) {
  const base = lin(SKYLINE[st.id] || '#404840'), fog = lin(V.fogCol);
  const c = mixc(base, fog, st.cond === 'rain' ? 0.55 : 0.25);
  return st.cond === 'night' ? scalec(c, 0.25) : c;
}
function env(st) {
  const V = visOf(st);
  const el = V.sunEl * Math.PI / 180, az = V.sunAz * Math.PI / 180;
  return {
    V,
    sunDir: [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)],
    sunCol: scalec(lin(V.sunCol), V.sunI), sky: scalec(lin(V.sky), V.skyI), gnd: scalec(lin(V.gnd), V.gndI),
    fogCol: lin(V.fogCol), fog: V.fog.slice(), zen: lin(V.zen), glow: lin(V.glow), sunDisc: lin(V.sunDisc), cloudCol: lin(V.cloudCol), clouds: V.clouds, stars: V.stars || 0,
    exp: V.exp, r1: lin(V.road[0]), r2: lin(V.road[1]), r3: lin(V.road[2]), lines: V.lines, icy: V.icy, time: 0, shadows: true,
    grade: V.grade, folFade: [100, 150], verge: lin(V.verge), tt: V.tt,
    skyline: skylineOf(V, st),
    night: !!V.night, hlK: V.hl || 1, wet: V.wet || 0, rain: !!V.rain, blizzard: !!V.blizzard, snowfall: !!V.snowfall || !!V.blizzard, overcast: V.overcast || 0,
  };
}

// ---------- canvas textures ----------
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h); return cv;
}
const FONT = '"Big Shoulders Display", "Barlow Semi Condensed", "Arial Narrow", sans-serif';
function bannerCanvas(text, bg, fg, sub) {
  return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.globalAlpha = 0.18;
    for (let x = -h; x < w; x += 46) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 22, h); g.lineTo(x + 22 + h, 0); g.lineTo(x + h, 0); g.fill(); }
    g.globalAlpha = 1;
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${sub ? 64 : 78}px ${FONT}`;
    g.fillText(text, w / 2, sub ? 52 : h / 2 + 4);
    if (sub) { g.font = `600 28px ${FONT}`; g.fillText(sub, w / 2, 102); }
  });
}
function chevronCanvas(dir) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#c8202a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, 7); g.fillRect(0, h - 22, w, 7);
    for (let i = 0; i < 3; i++) {
      const cx = 48 + i * 80;
      g.beginPath();
      if (dir > 0) { g.moveTo(cx - 28, 14); g.lineTo(cx + 28, 50); g.lineTo(cx - 28, 86); g.lineTo(cx - 8, 86); g.lineTo(cx + 46, 50); g.lineTo(cx - 8, 14); }
      else { g.moveTo(cx + 28, 14); g.lineTo(cx - 28, 50); g.lineTo(cx + 28, 86); g.lineTo(cx + 8, 86); g.lineTo(cx - 46, 50); g.lineTo(cx + 8, 14); }
      g.fill();
    }
    g.fillStyle = '#6b6f75'; g.fillRect(0, h - 14, w, 14); // post color strip
  });
}
function numberCanvas(num, ring) {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = ring; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 106, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 150px ${FONT}`; g.fillText(String(num), 128, 136);
  });
}
function boardCanvas(text, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 64px ${FONT}`; g.fillText(text, w / 2, h / 2 + 3);
    g.fillStyle = '#5d6168'; g.fillRect(0, h - 10, w, 10);
  });
}

// ---------- strip mesh with smooth normals ----------
function stripMesh(rows, cols, P, Cc, U) {
  // P: array of rows*cols [x,y,z]; Cc: rgba per vertex; U: uv per vertex
  const n = rows * cols;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 4), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pos.set(P[i], i * 3); col.set(Cc[i], i * 4); if (U) uv.set(U[i], i * 2); }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    for (const v of [a, b, c]) { nrm[v] += nx; nrm[v + 1] += ny; nrm[v + 2] += nz; }
  }
  for (let i = 0; i < n; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
  return { p: pos, n: nrm, c: col, u: U ? uv : null, idx: new Uint32Array(idx) };
}

// ---------- terrain ----------
function terrainMesh(W) {
  const { TR, T, st, nz } = W; const V = visOf(st);
  const nx = TR.nx, nzc = TR.nz, cell = TR.cell, H = TR.H;
  const n = nx * nzc;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 4);
  const pal = (st.kind === 'pine' ? V.grass : st.kind === 'frost' ? V.snow : st.kind === 'city' ? V.ground : V.sand).map(lin);
  const verge = lin(V.verge), rock = lin(V.rock);
  const strata = V.strata ? V.strata.map(lin) : null;
  const hw = T.hw;
  for (let j = 0; j < nzc; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = TR.x0 + i * cell, z = TR.z0 + j * cell, y = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    const hl = H[j * nx + Math.max(0, i - 1)], hr = H[j * nx + Math.min(nx - 1, i + 1)];
    const hd = H[Math.max(0, j - 1) * nx + i], hu = H[Math.min(nzc - 1, j + 1) * nx + i];
    let gx = (hl - hr), gz = (hd - hu), gy = 2 * cell; const l = Math.hypot(gx, gy, gz);
    gx /= l; gy /= l; gz /= l;
    nrm[k * 3] = gx; nrm[k * 3 + 1] = gy; nrm[k * 3 + 2] = gz;
    const slope = 1 - gy;
    const n1 = nz.n2(x / 38, z / 38) * 0.5 + 0.5, n2 = nz.n2(x / 9 + 40, z / 9) * 0.5 + 0.5, n3 = nz.n2(x / 120 - 7, z / 120) * 0.5 + 0.5;
    let c;
    const d = TR.D[k];
    if (st.kind === 'city') {
      // the streets off the route: asphalt in a few shades, darker where it has been patched
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n3 * 0.5); c = mixc(c, pal[3], Math.max(0, n2 - 0.6) * 1.2);
    } else if (st.kind === 'pine') {
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n3 * 0.6); c = mixc(c, pal[3], Math.max(0, n2 - 0.6) * 1.6);
      c = mixc(c, rock, C.sstep(0.18, 0.4, slope));
      c = mixc(c, verge, (1 - C.sstep(hw + 1.3, hw + 3.2, d)) * 0.75);
    } else if (st.kind === 'frost') {
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n2 * 0.5);
      c = mixc(c, rock, C.sstep(0.32, 0.6, slope) * 0.85);
      c = mixc(c, verge, (1 - C.sstep(hw + 1.6, hw + 4, d)) * 0.55);
    } else {
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n3 * 0.7); c = mixc(c, pal[3], Math.max(0, n2 - 0.55) * 1.4);
      const band = Math.floor((y + nz.n2(x / 50, z / 50) * 1.5) / 3.2);
      const sc = strata[((band % 4) + 4) % 4];
      c = mixc(c, sc, C.sstep(0.12, 0.35, slope));
      c = mixc(c, verge, (1 - C.sstep(hw + 1.3, hw + 3.2, d)) * 0.65);
    }
    col[k * 4] = c[0]; col[k * 4 + 1] = c[1]; col[k * 4 + 2] = c[2]; col[k * 4 + 3] = 0;
  }
  // shade baked into the ground under trees and rocks: grounds them and gives woods a darker floor
  const shade = (ox, oz, R, amt) => {
    const i0 = Math.max(0, Math.floor((ox - R - TR.x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((ox + R - TR.x0) / cell));
    const j0 = Math.max(0, Math.floor((oz - R - TR.z0) / cell)), j1 = Math.min(nzc - 1, Math.ceil((oz + R - TR.z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(TR.x0 + i * cell - ox, TR.z0 + j * cell - oz) / R; if (d >= 1) continue;
      const k = (j * nx + i) * 4, f = 1 - amt * (1 - d) * (1 - d);
      col[k] *= f; col[k + 1] *= f; col[k + 2] *= f;
    }
  };
  const O = W.O;
  if (O) {
    // (the city's street trees stand on sidewalks over streets the route's road doesn't share the terrain with)
    for (const t of st.city ? [] : O.trees || []) shade(t.x, t.z, 5.5 * (t.s || 1) * (t.type === 3 ? 1.3 : 1), st.kind === 'frost' ? 0.22 : t.type === 3 ? 0.36 : 0.3);
    for (const r of O.rocks || []) shade(r.x, r.z, 2.5 * (r.s || 1), 0.25);
  }
  // indices grouped in square blocks so the renderer can skip blocks outside the view. Each block also has coarser
  // versions (every 2nd / 4th vertex) for distance; their borders keep every vertex and a zipper strip joins them
  // to the coarse interior, so neighbouring blocks at different detail never open cracks.
  const B = 24, LODS = [1, 2, 4], chunks = [], parts = LODS.map(() => []);
  const vid = (i, j) => j * nx + i;
  const tri = (out, a, b, c) => out.push(a, b, c);
  // triangulate the band between the outer polyline O and the inner polyline I (same direction), advancing along
  // whichever is behind in grid coordinate (Oc / Ic) so the strip has no overlaps or slivers past its ends
  const zip = (out, O, I, Oc, Ic) => {
    let a = 0, b = 0;
    while (a < O.length - 1 || b < I.length - 1) {
      const na = a < O.length - 1 ? Oc[a + 1] : Infinity, nb = b < I.length - 1 ? Ic[b + 1] : Infinity;
      if (na <= nb) { tri(out, O[a], O[a + 1], I[b]); a++; } else { tri(out, O[a], I[b + 1], I[b]); b++; }
    }
  };
  for (let bj = 0; bj < nzc - 1; bj += B) for (let bi = 0; bi < nx - 1; bi += B) {
    const i1 = Math.min(bi + B, nx - 1), j1 = Math.min(bj + B, nzc - 1), full = i1 - bi === B && j1 - bj === B;
    const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let j = bj; j <= j1; j++) for (let i = bi; i <= i1; i++) { const v = vid(i, j) * 3; for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], pos[v + k]); box[k + 3] = Math.max(box[k + 3], pos[v + k]); } }
    const lods = LODS.map((st, L) => {
      const out = [];
      if (st === 1 || !full) {
        for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) { const a = vid(i, j), b = a + 1, c = a + nx, d = c + 1; out.push(a, b, c, b, d, c); }
      } else {
        for (let j = bj + st; j < j1 - st; j += st) for (let i = bi + st; i < i1 - st; i += st) { const a = vid(i, j), b = vid(i + st, j), c = vid(i, j + st), d = vid(i + st, j + st); out.push(a, b, c, b, d, c); }
        const rng = (x0, x1, step) => { const r = []; for (let x = x0; x <= x1; x += step) r.push(x); return r; };
        const oi = rng(bi, i1, 1), oj = rng(bj, j1, 1), ii = rng(bi + st, i1 - st, st), ij = rng(bj + st, j1 - st, st);
        zip(out, oi.map(i => vid(i, bj)), ii.map(i => vid(i, bj + st)), oi, ii);
        zip(out, oi.map(i => vid(i, j1)), ii.map(i => vid(i, j1 - st)), oi, ii);
        zip(out, oj.map(j => vid(bi, j)), ij.map(j => vid(bi + st, j)), oj, ij);
        zip(out, oj.map(j => vid(i1, j)), ij.map(j => vid(i1 - st, j)), oj, ij);
      }
      parts[L].push(out); return out.length;
    });
    chunks.push({ box, lods: lods.map(n => ({ first: 0, count: n })) });
  }
  // lay the levels out one after another (all level-0 blocks, then level 1, then 2): neighbours at the same level stay contiguous
  const idx = new Uint32Array(parts.reduce((a, P) => a + P.reduce((x, o) => x + o.length, 0), 0));
  let q = 0;
  parts.forEach((P, L) => P.forEach((o, ci) => { chunks[ci].lods[L].first = q; idx.set(o, q); q += o.length; }));
  for (const c of chunks) { c.first = c.lods[0].first; c.count = c.lods[0].count; }
  // coarser levels only where fog already softens the ground (pushed out on stages with long views)
  chunks.lodDist = [Math.max(150, V.fog[0] + 60), Math.max(400, V.fog[1] * 0.85)];
  W.TC = { col, nx, nz: nzc, x0: TR.x0, z0: TR.z0, cell };
  return { p: pos, n: nrm, c: col, idx, chunks };
}

function roadMeshes(W) {
  const { T, TR, st } = W; const V = visOf(st);
  const hw = T.hw, n = T.n;
  // road ribbon (3 columns so u spans -1..1)
  const P = [], Cc = [], U = [];
  for (let i = 0; i < n; i++) {
    const h = T.H[i], rx = -Math.cos(h), rz = Math.sin(h);
    for (const u of [-1, 0, 1]) {
      P.push([T.X[i] + rx * hw * u, T.Y[i] + 0.0, T.Z[i] + rz * hw * u]);
      Cc.push([1, 1, 1, 0]); U.push([u, i * 2]);
    }
  }
  const road = stripMesh(n, 3, P, Cc, U);
  // shoulders: both sides; cols: edge, mid, outer
  const verge = lin(V.verge);
  const sides = [];
  // in the city the strip is the concrete gutter out to the kerb, flat
  const city = !!st.city, vw = city ? C.CITY_X.kerb - hw : 1.6;
  for (const side of [-1, 1]) {
    const P2 = [], C2 = [];
    for (let i = 0; i < n; i++) {
      const h = T.H[i], rx = -Math.cos(h) * side, rz = Math.sin(h) * side;
      const ex = T.X[i] + rx * hw, ez = T.Z[i] + rz * hw;
      const ox = T.X[i] + rx * (hw + vw), oz = T.Z[i] + rz * (hw + vw);
      const oy = city ? T.Y[i] - 0.012 : C.terrainH(TR, ox, oz) + 0.03;
      const mx = (ex + ox) / 2, mz = (ez + oz) / 2, my = (T.Y[i] + oy) / 2 + 0.02;
      P2.push([ex, T.Y[i] - 0.005, ez], [mx, my, mz], [ox, oy, oz]);
      // the outer edge takes the colour of the ground it lands on, so the strip no longer ends in a ruled line
      const tc = W.TC; let oc = verge;
      if (tc && !city) { const ci = Math.max(0, Math.min(tc.nx - 1, Math.round((ox - tc.x0) / tc.cell))), cj = Math.max(0, Math.min(tc.nz - 1, Math.round((oz - tc.z0) / tc.cell))), k = (cj * tc.nx + ci) * 4; oc = [tc.col[k], tc.col[k + 1], tc.col[k + 2]]; }
      const mc = [(verge[0] + oc[0]) / 2, (verge[1] + oc[1]) / 2, (verge[2] + oc[2]) / 2];
      C2.push([...verge, 0], [...mc, 0], [...oc, 0]);
    }
    sides.push(stripMesh(n, 3, P2, C2));
  }
  let banks = null;
  if (st.bank) {
    const snow = lin('#f2f5fb'), dirty = lin('#d8dde8');
    const prof = [[0.9, 0.02], [1.5, 0.7], [2.3, 1.05], [3.2, 0.85], [4.3, -0.4]];
    const parts = [];
    for (const side of [-1, 1]) {
      const P3 = [], C3 = [];
      for (let i = 0; i < n; i++) {
        const h = T.H[i], rx = -Math.cos(h) * side, rz = Math.sin(h) * side;
        const wob = 0.12 * Math.sin(i * 0.7 + side) + 0.1 * Math.sin(i * 0.23);
        for (let k = 0; k < prof.length; k++) {
          const off = hw + prof[k][0];
          const x = T.X[i] + rx * off, z = T.Z[i] + rz * off;
          const ty = C.terrainH(TR, x, z);
          let y = k === prof.length - 1 ? ty - 0.4 : Math.max(T.Y[i] + prof[k][1] + (k > 0 && k < 4 ? wob : 0), ty + (k === 0 ? 0.02 : 0.15));
          P3.push([x, y, z]);
          const cc = k === 0 ? dirty : snow;
          C3.push([...cc, 0.12]);
        }
      }
      parts.push(stripMesh(n, prof.length, P3, C3));
    }
    banks = parts;
  }
  return { road, sides, banks };
}

// ---------- prop geometry ----------
// ---------- trees ----------
// Pines are built like real conifers: whorls of drooping branch sprays (alpha-tested cards cut from a painted needle
// texture, rolled alternately so the crown reads from the side and from below), around a dark inner cone that keeps
// you from seeing the sky through the middle. Far away (and in the shadow pass) they swap for solid skirts with
// ragged, drooping edges in the same colours. Three shapes so a forest isn't one tree cloned: a classic pine, a slim
// spruce and an old tree, broad at the foot with a sparse top.
const PINE_SHAPES = [
  { h: 7.4, base: 1.25, whorls: 9, r0: 1.95, r1: 0.32, br: 8, droop: 0.42, core: 0.55 },
  { h: 7.9, base: 1.0, whorls: 11, r0: 1.5, r1: 0.26, br: 7, droop: 0.5, core: 0.6 },
  { h: 7.0, base: 1.5, whorls: 7, r0: 2.25, r1: 0.4, br: 8, droop: 0.36, core: 0.5 },
  // old growth (Dark Pines, tree type 3): 20-30 m with the crown held high over a long bare trunk (`tr` = trunk radius
  // at the foot and at the top, `stubs` = dead lower branches left on it): a spruce, a pine with a rounded crown, a fir
  // `roll` = how far the sprays are turned out of the horizontal: flatter here, these crowns are mostly seen from below
  { h: 23, base: 7, whorls: 16, r0: 2.9, r1: 0.35, br: 10, droop: 0.48, core: 0.42, tr: [0.36, 0.09], stubs: 7, roll: 0.4 },
  { h: 21, base: 10.5, whorls: 11, r0: 3.1, r1: 0.6, br: 9, droop: 0.3, core: 0.4, tr: [0.4, 0.12], stubs: 5, round: 0.45, roll: 0.4 },
  { h: 26, base: 8.5, whorls: 17, r0: 2.4, r1: 0.3, br: 9, droop: 0.42, core: 0.45, tr: [0.34, 0.08], stubs: 9, roll: 0.4 },
];
const TALL = 3; // index of the first old-growth shape
// crown radius at fraction f of the way from its foot to the top; `round` pulls the foot in for a rounded crown
const crownR = (S, f) => (S.r1 + (S.r0 - S.r1) * Math.pow(1 - f, 1.1)) * (S.round ? 1 - S.round * (1 - C.sstep(0, 0.35, f)) : 1);
// texture atlas (512²): u 0-0.5 one needle spray (base at v=0, tip at v=1), 0.5-0.75 bark, 0.75-1 dense needles
const TA = { frond: [0, 0.5], bark: [0.5, 0.75], dense: [0.75, 1] };
let treeAtlasData = null, leafAtlasData = null;
// premultiplied canvas pixels filter to dark halos: copy colour into the transparent texels next to opaque ones
function bleedAlpha(g, W, H) {
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const rgb = new Float32Array(W * H * 3), have = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 8) { have[i] = 1; rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; }
  for (let pass = 0; pass < 8; pass++) {
    const nh = have.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (have[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X; if (!have[j]) continue; r += rgb[j * 3]; gg += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n++;
      }
      if (n) { rgb[i * 3] = r / n; rgb[i * 3 + 1] = gg / n; rgb[i * 3 + 2] = b / n; nh[i] = 1; }
    }
    have.set(nh);
  }
  const out = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) { out.data[i * 4] = rgb[i * 3]; out.data[i * 4 + 1] = rgb[i * 3 + 1]; out.data[i * 4 + 2] = rgb[i * 3 + 2]; out.data[i * 4 + 3] = d[i * 4 + 3]; }
  return out;
}
function treeAtlas() {
  if (treeAtlasData) return treeAtlasData;
  const W = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'), R = C.rng(5150);
  const rnd = (a, b) => a + R() * (b - a);
  // needle colours are near-neutral greens: the tree's own colour comes from the instance tint
  const nd = (x0, y0, x1, y1, w, c0, c1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  // a spray: a twig with side shoots, every part densely set with needles that point forward and out
  const shoot = (x0, y0, ang, len, wid, depth) => {
    const steps = Math.round(len / 3.2);
    const ex = x0 + Math.sin(ang) * len, ey = y0 - Math.cos(ang) * len;
    for (let i = 0; i < steps; i++) {
      const t = i / steps, x = x0 + (ex - x0) * t, y = y0 + (ey - y0) * t, taper = 1 - t * 0.55;
      for (const sd of [-1, 1]) {
        const a = ang + sd * rnd(0.7, 1.15), L = wid * taper * rnd(0.75, 1.2);
        const tip = t > 0.7 ? '#dfe5c8' : '#c2c9aa';
        nd(x, y, x + Math.sin(a) * L, y - Math.cos(a) * L, rnd(1.6, 2.6), R() < 0.5 ? '#5d6556' : '#737c66', R() < 0.25 ? '#eef2dc' : tip);
      }
    }
    g.strokeStyle = '#4b3a28'; g.lineWidth = depth ? 3 : 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke();
    if (depth > 0) for (let k = 1; k < 6; k++) {
      const t = k / 6.5, sx = x0 + (ex - x0) * t, sy = y0 + (ey - y0) * t, sd = k % 2 ? 1 : -1;
      shoot(sx, sy, ang + sd * rnd(0.55, 0.85), len * (0.42 - t * 0.25) * rnd(0.85, 1.15), wid * 0.85, depth - 1);
    }
  };
  g.clearRect(0, 0, W, W);
  g.save(); g.beginPath(); g.rect(0, 0, 256, 512); g.clip();
  shoot(128, 505, 0, 470, 30, 1);
  for (let k = 0; k < 4; k++) shoot(128 + rnd(-6, 6), 490 - k * 60, rnd(-0.12, 0.12), 380 - k * 70, 24, 0);
  g.restore();
  // bark: grey-brown plates split by dark vertical furrows (neutral; the trunk colour comes from the vertex colour)
  g.fillStyle = '#8a8076'; g.fillRect(256, 0, 128, 512);
  for (let i = 0; i < 900; i++) { const x = 256 + R() * 128, y = R() * 512, h = rnd(10, 40); g.fillStyle = `rgba(${R() < 0.5 ? '170,160,150' : '95,85,76'},${rnd(0.25, 0.5)})`; g.fillRect(x, y, rnd(3, 9), h); }
  for (let i = 0; i < 26; i++) { let x = 256 + R() * 128; g.strokeStyle = 'rgba(35,28,22,0.75)'; g.lineWidth = rnd(1.5, 3.5); g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 512; y += 16) { x += rnd(-2.5, 2.5); g.lineTo(x, y); } g.stroke(); }
  // dense needles: the inner crown and the far trees, opaque
  g.fillStyle = '#6a7260'; g.fillRect(384, 0, 128, 512);
  for (let i = 0; i < 5200; i++) { const x = 384 + R() * 128, y = R() * 512, a = rnd(-0.9, 0.9) + (R() < 0.5 ? Math.PI : 0), L = rnd(5, 11); nd(x, y, x + Math.sin(a) * L, y - Math.cos(a) * L * 0.6, rnd(1.4, 2.2), R() < 0.55 ? '#50584a' : '#7c856c', R() < 0.3 ? '#cfd5b8' : '#9aa284'); }
  for (let y = 0; y < 512; y++) for (let x = 384; x < 512; x++) { /* opaque */ }
  const img = bleedAlpha(g, W, W);
  for (let y = 0; y < W; y++) for (let x = 256; x < W; x++) img.data[(y * W + x) * 4 + 3] = 255;
  return treeAtlasData = img;
}
function leafAtlas() {
  if (leafAtlasData) return leafAtlasData;
  const W = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'), R = C.rng(808);
  const rnd = (a, b) => a + R() * (b - a);
  g.clearRect(0, 0, W, W);
  // a clump of small birch leaves on thin twigs, round overall, ragged at the edge
  g.save(); g.beginPath(); g.rect(0, 0, 256, 512); g.clip();
  for (let i = 0; i < 14; i++) { const a = rnd(-1.2, 1.2); g.strokeStyle = '#5b4a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 500); g.quadraticCurveTo(128 + Math.sin(a) * 60, 380, 128 + Math.sin(a) * 110, 500 - Math.cos(a) * 330 - rnd(0, 80)); g.stroke(); }
  // several overlapping lobes, so a clump has a ragged, uneven outline instead of a disc
  const lobes = []; for (let i = 0; i < 7; i++) lobes.push([128 + rnd(-55, 55), 260 + rnd(-150, 150), rnd(45, 80)]);
  for (let i = 0; i < 1900; i++) {
    const L = lobes[(R() * lobes.length) | 0], r = Math.sqrt(R()) * L[2], a = R() * Math.PI * 2, x = L[0] + Math.cos(a) * r, y = L[1] + Math.sin(a) * r * 1.6;
    if (y > 505 || y < 8 || x < 6 || x > 250) continue;
    const c = ['#7d9a4c', '#93ad5a', '#a8bf6a', '#647f3c', '#c3d27c'][(R() * 5) | 0];
    g.fillStyle = c; g.save(); g.translate(x, y); g.rotate(R() * Math.PI); g.beginPath(); g.ellipse(0, 0, rnd(3.5, 6), rnd(6, 10), 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.restore();
  // birch bark: chalky white with black dashes running across the trunk
  g.fillStyle = '#e9e6dc'; g.fillRect(256, 0, 128, 512);
  for (let i = 0; i < 160; i++) { const y = R() * 512, x = 256 + R() * 128, w = rnd(8, 40); g.fillStyle = `rgba(20,18,16,${rnd(0.55, 0.9)})`; g.fillRect(x, y, w, rnd(2, 5)); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(150,140,125,${rnd(0.1, 0.3)})`; g.fillRect(256 + R() * 128, R() * 512, rnd(2, 6), rnd(10, 40)); }
  // dense leaves for the far version
  g.fillStyle = '#86a052'; g.fillRect(384, 0, 128, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = ['#6d8a42', '#9ab35e', '#b5c86e', '#5b7638'][(R() * 4) | 0]; g.beginPath(); g.ellipse(384 + R() * 128, R() * 512, rnd(2.5, 4.5), rnd(4, 7), R() * 3, 0, Math.PI * 2); g.fill(); }
  const img = bleedAlpha(g, W, W);
  for (let y = 0; y < W; y++) for (let x = 256; x < W; x++) img.data[(y * W + x) * 4 + 3] = 255;
  return leafAtlasData = img;
}
// a raw mesh builder for the trees: positions, smooth normals given per vertex, colour, uv, with winding set so the
// front face is the side the normal points to (the shader flips the normal on back faces of the sprays)
function rawGeo() {
  const g = { p: [], n: [], c: [], u: [] };
  g.v = (P, N, Cc, U) => { g.p.push(P[0], P[1], P[2]); g.n.push(N[0], N[1], N[2]); g.c.push(Cc[0], Cc[1], Cc[2], Cc[3] || 0); g.u.push(U[0], U[1]); };
  g.tri = (a, b, c) => {
    // a, b, c: [P, N, C, U]; flip winding to face the mean normal
    const e1 = [b[0][0] - a[0][0], b[0][1] - a[0][1], b[0][2] - a[0][2]], e2 = [c[0][0] - a[0][0], c[0][1] - a[0][1], c[0][2] - a[0][2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const mn = [a[1][0] + b[1][0] + c[1][0], a[1][1] + b[1][1] + c[1][1], a[1][2] + b[1][2] + c[1][2]];
    if (fn[0] * mn[0] + fn[1] * mn[1] + fn[2] * mn[2] < 0) [b, c] = [c, b];
    for (const q of [a, b, c]) g.v(q[0], q[1], q[2], q[3]);
  };
  g.quad = (a, b, c, d) => { g.tri(a, b, c); g.tri(a, c, d); };
  return g;
}
const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// self-shading baked into the vertex colour: darker low down and towards the trunk, the outer tips catch light
const pineAO = (y, h, out) => (0.62 + 0.38 * C.sstep(0.6, h, y)) * (0.72 + 0.28 * out);
function trunkPart(g, h, r0, r1, seg, colK, uvr, flag) {
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
    const P = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r], N = a => [Math.cos(a), 0.15, Math.sin(a)];
    const U = (a, y) => [uvr[0] + (uvr[1] - uvr[0]) * (a / (Math.PI * 2)), Math.min(0.999, Math.max(0.001, (y + 0.3) / (h + 0.3))) + flag];
    const c = [colK[0], colK[1], colK[2], 0];
    g.quad([P(a0, -0.3, r0), N(a0), c, U(a0, -0.3)], [P(a1, -0.3, r0), N(a1), c, U(a1, -0.3)], [P(a1, h, r1), N(a1), c, U(a1, h)], [P(a0, h, r1), N(a0), c, U(a0, h)]);
  }
}
// an old tree's trunk: a flared foot with a few root lobes, a little mossy, tapering all the way up. The bark texture
// runs once over the bare part and again inside the crown, so it isn't stretched over 20 m. Dead branch stubs stick
// out of the bare part, as on a real old conifer that has shed its lower branches.
function oldTrunk(g, S, seg, col, R, stubs) {
  const top = S.h * 0.82, r0 = S.tr[0], r1 = S.tr[1], rAt = y => r0 + (r1 - r0) * Math.max(0, y) / top;
  const lob = R() * 6.28, span = S.base + 0.9;
  // [height, flare, lobes, moss]
  const rings = [[-0.3, 1.6, 1, 1], [0.25, 1.28, 0.6, 0.7], [0.9, 1.07, 0.2, 0.25], [1.9, 1, 0, 0], [S.base + 0.6, 1, 0, 0], [top, 1, 0, 0]];
  const ring = (k, a) => { const [y, fl, lb] = rings[k]; const r = rAt(y) * fl * (1 + lb * 0.16 * Math.cos(4 * a + lob)); return [Math.cos(a) * r, y, Math.sin(a) * r]; };
  const tint = k => { const m = rings[k][3]; return [col[0] * (1 - 0.3 * m), col[1] * (1 - 0.12 * m), col[2] * (1 - 0.4 * m), 0]; };
  for (let k = 0; k < rings.length - 1; k++) {
    const inner = k === rings.length - 2;
    const v0 = inner ? 0.001 : Math.max(0.001, (rings[k][0] + 0.3) / span), v1 = inner ? 0.999 : Math.min(0.999, (rings[k + 1][0] + 0.3) / span);
    const ny0 = 0.15 + (rings[k][1] - 1) * 0.9, ny1 = 0.15 + (rings[k + 1][1] - 1) * 0.9;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const U = (a, v) => [TA.bark[0] + (TA.bark[1] - TA.bark[0]) * (a / (Math.PI * 2)), v - 2];
      const N = (a, ny) => nrm3([Math.cos(a), ny, Math.sin(a)]);
      g.quad([ring(k, a0), N(a0, ny0), tint(k), U(a0, v0)], [ring(k, a1), N(a1, ny0), tint(k), U(a1, v0)],
        [ring(k + 1, a1), N(a1, ny1), tint(k + 1), U(a1, v1)], [ring(k + 1, a0), N(a0, ny1), tint(k + 1), U(a0, v1)]);
    }
  }
  // dead stubs: thin three-sided twigs leaving the trunk slightly downwards, longer higher up
  const dc = [col[0] * 0.85, col[1] * 0.85, col[2] * 0.85, 0];
  for (let i = 0; i < stubs; i++) {
    const y = 2.4 + (S.base - 2.6) * (i + R() * 0.8) / stubs, th = R() * 6.28, r = rAt(y);
    const len = (0.45 + R() * 0.9) * (0.6 + 0.4 * y / S.base), rb = 0.035 + r * 0.1;
    const d = nrm3([Math.cos(th), -0.2 - R() * 0.35, Math.sin(th)]), s1 = nrm3(cross3(d, [0, 1, 0])), s2 = cross3(s1, d);
    const b = [Math.cos(th) * r * 0.85, y, Math.sin(th) * r * 0.85], t = [b[0] + d[0] * len, b[1] + d[1] * len, b[2] + d[2] * len];
    for (let q = 0; q < 3; q++) {
      const off = a => [s1[0] * Math.cos(a) + s2[0] * Math.sin(a), s1[1] * Math.cos(a) + s2[1] * Math.sin(a), s1[2] * Math.cos(a) + s2[2] * Math.sin(a)];
      const a0 = q / 3 * Math.PI * 2, a1 = (q + 1) / 3 * Math.PI * 2, o0 = off(a0), o1 = off(a1);
      const P = (p, o, w) => [p[0] + o[0] * w, p[1] + o[1] * w, p[2] + o[2] * w], u0 = TA.bark[0] + 0.01 + q * 0.07, u1 = u0 + 0.06;
      g.quad([P(b, o0, rb), o0, dc, [u0, 0.4 - 2]], [P(b, o1, rb), o1, dc, [u1, 0.4 - 2]], [P(t, o1, 0.008), o1, dc, [u1, 0.46 - 2]], [P(t, o0, 0.008), o0, dc, [u0, 0.46 - 2]]);
    }
  }
}
// mid: the version for the middle distance (100-230 m): about half the whorls, fewer and wider single-segment sprays,
// a coarser core. Same atlas and colours, so the dissolve from the full tree is invisible.
function pineGeo(V, snowy, variant, mid) {
  const S = PINE_SHAPES[variant || 0], R = C.rng(311 + (variant || 0) * 97), g = rawGeo();
  const trunk = scalec(lin(V.trunk), 2.4);
  // uv.y shifted by -2: no instance tint (bark), see LIT_FS mode 10
  if (S.tr && mid) trunkPart(g, S.base + 1.5, S.tr[0] * 1.08, S.tr[0] * 0.75, 6, trunk, TA.bark, -2); // flare and stubs are lost at 100 m
  else if (S.tr) oldTrunk(g, S, 10, trunk, R, S.stubs);
  else trunkPart(g, S.h * 0.82, 0.21, 0.07, mid ? 5 : 8, trunk, TA.bark, -2);
  const radAt = y => crownR(S, Math.min(1, Math.max(0, (y - S.base) / (S.h - S.base))));
  // inner cone: dense needles, dark
  { const rings = mid ? 4 : 7, seg = mid ? 6 : 8;
    for (let k = 0; k < rings; k++) {
      const y0 = S.base - 0.2 + (S.h - S.base) * k / rings, y1 = S.base - 0.2 + (S.h - S.base) * (k + 1) / rings;
      const r0 = radAt(y0) * S.core, r1 = k === rings - 1 ? 0 : radAt(y1) * S.core;
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * Math.PI * 2 + k * 0.4, a1 = (i + 1) / seg * Math.PI * 2 + k * 0.4;
        const P = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r], N = a => nrm3([Math.cos(a), 0.55, Math.sin(a)]);
        const U = (a, y) => [TA.dense[0] + 0.25 * ((a % (Math.PI * 2)) / (Math.PI * 2)), y / S.h];
        const cc = y => { const k2 = pineAO(y, S.h, 0.15) * 0.8; return [k2, k2, k2, 0]; };
        g.quad([P(a0, y0, r0), N(a0), cc(y0), U(a0, y0)], [P(a1, y0, r0), N(a1), cc(y0), U(a1, y0)], [P(a1, y1, r1), N(a1), cc(y1), U(a1, y1)], [P(a0, y1, r1), N(a0), cc(y1), U(a0, y1)]);
      }
    }
  }
  // whorls of drooping sprays
  const up = [0, 1, 0];
  const frond = (y0, th, L, roll, droop) => {
    const dir = [Math.cos(th), 0, Math.sin(th)], side = [-Math.sin(th), 0, Math.cos(th)];
    const pt = t => { const r = 0.12 + L * t; return [dir[0] * r, y0 + L * (0.12 * t - droop * t * t), dir[2] * r]; };
    const tan = t => nrm3([dir[0] * L, L * (0.12 - 2 * droop * t), dir[2] * L]);
    const segs = mid ? 1 : 3, wid = L * (mid ? 0.82 : 0.62);
    let prev = null;
    for (let q = 0; q <= segs; q++) {
      const t = q / segs, P = pt(t), T = tan(t), B = nrm3(cross3(side, T));
      const ac = [side[0] * Math.cos(roll) + B[0] * Math.sin(roll), side[1] * Math.cos(roll) + B[1] * Math.sin(roll), side[2] * Math.cos(roll) + B[2] * Math.sin(roll)];
      const w = wid * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.85)));
      let cn = nrm3(cross3(ac, T)); if (cn[1] < 0) cn = [-cn[0], -cn[1], -cn[2]];
      const vol = nrm3([dir[0] + cn[0] * 0.6, 0.6 + cn[1] * 0.6, dir[2] + cn[2] * 0.6]);
      const k = pineAO(P[1], S.h, t);
      const col = [k, k, k, 0];
      const L0 = [P[0] - ac[0] * w / 2, P[1] - ac[1] * w / 2, P[2] - ac[2] * w / 2], R0 = [P[0] + ac[0] * w / 2, P[1] + ac[1] * w / 2, P[2] + ac[2] * w / 2];
      const row = [[L0, vol, col, [TA.frond[0] + 0.004, 0.01 + t * 0.98]], [R0, vol, col, [TA.frond[1] - 0.004, 0.01 + t * 0.98]]];
      if (prev) g.quad(prev[0], prev[1], row[1], row[0]);
      prev = row;
    }
  };
  const whorls = mid ? Math.round(S.whorls * (S.tr ? 0.45 : 0.55)) : S.whorls;
  for (let k = 0; k < whorls; k++) {
    const f = k / (whorls - 1), y0 = S.base + (S.h - S.base - 0.55) * f + (R() - 0.5) * (S.tr ? 0.4 : 0.18);
    const L = crownR(S, f) * (0.88 + R() * 0.24) * 1.12;
    // an old tree's lowest whorls are thinning out, the light no longer reaches them
    const nb = Math.max(mid ? 3 : 4, Math.round(S.br * (mid ? 0.62 : 1) * (1 - f * 0.4) * (S.tr && f < 0.15 ? 0.6 : 1)));
    const ph = k * 2.39996 + R() * 0.4;
    for (let b = 0; b < nb; b++) frond(y0, ph + b / nb * Math.PI * 2 + (R() - 0.5) * 0.35, L * (0.85 + R() * 0.3), (b % 2 ? 1 : -1) * ((S.roll || 0.7) + R() * 0.35), S.droop * (0.8 + R() * 0.4));
  }
  // the leader: two crossed sprays standing up at the top
  for (const th of [0, Math.PI / 2]) {
    const c = [1, 1, 1, 0], s0 = [Math.cos(th) * 0.3, 0, Math.sin(th) * 0.3], y0 = S.h - 0.75, y1 = S.h + 0.45, n = nrm3([Math.cos(th + Math.PI / 2), 0.4, Math.sin(th + Math.PI / 2)]);
    g.quad([[-s0[0], y0, -s0[2]], n, c, [TA.frond[0] + 0.004, 0.01]], [[s0[0], y0, s0[2]], n, c, [TA.frond[1] - 0.004, 0.01]], [[s0[0] * 0.4, y1, s0[2] * 0.4], n, c, [TA.frond[1] - 0.004, 0.99]], [[-s0[0] * 0.4, y1, -s0[2] * 0.4], n, c, [TA.frond[0] + 0.004, 0.99]]);
  }
  return g;
}
// far pine: solid skirts with a ragged, drooping rim (alternating branch tips), same colours, a quarter of the cost
function pineFarGeo(V, snowy, variant) {
  const S = PINE_SHAPES[variant || 0], g = rawGeo(), R = C.rng(77 + (variant || 0));
  if (S.tr) trunkPart(g, S.base + 1.5, S.tr[0] * 1.08, S.tr[0] * 0.75, 5, scalec(lin(V.trunk), 2.4), TA.bark, -2);
  else trunkPart(g, S.h * 0.5, 0.2, 0.12, 4, scalec(lin(V.trunk), 2.4), TA.bark, -2);
  const tiers = S.tr ? 6 : 5, N = 10;
  for (let k = 0; k < tiers; k++) {
    const f0 = k / tiers, f1 = (k + 1.35) / tiers;
    const yb = S.base + (S.h - S.base) * f0 - 0.35, yt = Math.min(S.h + 0.3, S.base + (S.h - S.base) * f1);
    const rad = crownR(S, f0) * 1.12, top = [0, yt, 0];
    const rim = [];
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + k * 0.5, rr = rad * (i % 2 ? 0.8 : 1.0) * (0.92 + R() * 0.16); rim.push([Math.cos(a) * rr, yb - (i % 2 ? 0 : rad * S.droop * 0.35), Math.sin(a) * rr, a]); }
    for (let i = 0; i < N; i++) {
      const A = rim[i], B = rim[(i + 1) % N];
      const nA = nrm3([Math.cos(A[3]), 0.7, Math.sin(A[3])]), nB = nrm3([Math.cos(B[3]), 0.7, Math.sin(B[3])]), nT = [0, 1, 0];
      const k1 = pineAO(yb, S.h, 1) * 0.74, k0 = pineAO(yt, S.h, 0.4) * 0.74; // matched by eye to the near trees' mix of lit sprays and shade
      const U = (a, y) => [TA.dense[0] + 0.25 * ((a % (Math.PI * 2)) / (Math.PI * 2)), Math.min(0.99, y / S.h)];
      g.tri([[A[0], A[1], A[2]], nA, [k1, k1, k1, 0], U(A[3], A[1])], [[B[0], B[1], B[2]], nB, [k1, k1, k1, 0], U(B[3], B[1])], [top, nT, [k0, k0, k0, 0], U(A[3], yt)]);
      // underside, dark, so trees seen from below or across a slope aren't hollow
      const d = 0.32, uc = [0, -1, 0], ub = [0, yb + 0.6, 0];
      g.tri([[A[0], A[1], A[2]], uc, [d, d, d, 0], U(A[3], A[1])], [[B[0], B[1], B[2]], uc, [d, d, d, 0], U(B[3], B[1])], [ub, uc, [d, d, d, 0], U(A[3], ub[1])]);
    }
  }
  return g;
}
function birchGeo(V) {
  const g = rawGeo(), R = C.rng(9);
  trunkPart(g, 5.4, 0.16, 0.07, 8, [1.1, 1.1, 1.05], TA.bark, -2);
  // leaf clumps: three crossed cards each, normals pointing out from the crown centre so the crown lights as a volume
  const cc = [0, 5.0, 0], clumps = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996 + R() * 0.5, y = 3.7 + (i / 15) * 3.2 + (R() - 0.5) * 0.4, spread = 1.35 * Math.sin(Math.PI * (0.18 + 0.75 * (y - 3.4) / 3.8));
    clumps.push([Math.cos(a) * spread * (0.6 + R() * 0.4), y, Math.sin(a) * spread * (0.6 + R() * 0.4), 0.62 + R() * 0.32]);
  }
  for (const [x, y, z, r] of clumps) {
    const out = nrm3([x - cc[0], (y - cc[1]) + 0.8, z - cc[2]]);
    const k = 0.75 + 0.25 * C.sstep(3.8, 6.6, y), col = [k, k, k, 0];
    for (let q = 0; q < 3; q++) {
      const a = q * Math.PI / 3 + R() * 0.5, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
      g.quad([[x - dx, y - r * 1.05, z - dz], out, col, [0.004, 0.01]], [[x + dx, y - r * 1.05, z + dz], out, col, [0.496, 0.01]], [[x + dx, y + r * 1.05, z + dz], out, col, [0.496, 0.99]], [[x - dx, y + r * 1.05, z - dz], out, col, [0.004, 0.99]]);
    }
  }
  return g;
}
function birchFarGeo(V) {
  const g = rawGeo();
  trunkPart(g, 4.4, 0.15, 0.08, 4, [1.1, 1.1, 1.05], TA.bark, -2);
  const N = 8, rad = 1.7, yb = 3.6, yt = 7.0, ym = 5.2;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
    const P = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r], Nn = (a, ny) => nrm3([Math.cos(a), ny, Math.sin(a)]), U = (a, y) => [0.76 + 0.23 * (a / (Math.PI * 2)), y / 8];
    const c1 = [0.85, 0.85, 0.85, 0], c0 = [0.6, 0.6, 0.6, 0];
    g.quad([P(a0, ym, rad), Nn(a0, 0.1), c1, U(a0, ym)], [P(a1, ym, rad), Nn(a1, 0.1), c1, U(a1, ym)], [P(a1, yt, 0.3), Nn(a1, 0.9), c1, U(a1, yt)], [P(a0, yt, 0.3), Nn(a0, 0.9), c1, U(a0, yt)]);
    g.quad([P(a0, yb, 0.4), Nn(a0, -0.7), c0, U(a0, yb)], [P(a1, yb, 0.4), Nn(a1, -0.7), c0, U(a1, yb)], [P(a1, ym, rad), Nn(a1, 0.1), c1, U(a1, ym)], [P(a0, ym, rad), Nn(a0, 0.1), c1, U(a0, ym)]);
  }
  return g;
}
// saguaro: a ribbed trunk with a domed top and two arms that leave it sideways and turn up through a rounded elbow
function cactusGeo() {
  const g = new Geo(); const col = [1, 1, 1], sp = 0.02; // spec 0.02 marks cactus in the foliage shader
  const dome = (x, y, z, r) => { const N = 12, M = 3; for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, b0 = j / M * Math.PI / 2, b1 = (j + 1) / M * Math.PI / 2;
    const P = (a, b) => [x + Math.cos(a) * Math.cos(b) * r, y + Math.sin(b) * r * 0.9, z + Math.sin(a) * Math.cos(b) * r];
    g.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), col, sp, [x, y - 1, z]); } };
  g.cyl(0, -0.2, 0, 0.31, 0.27, 4.2, 12, col, sp, 'y', false); dome(0, 4.0, 0, 0.27);
  for (const [sx, y0, len, up] of [[1, 1.7, 0.55, 1.35], [-1, 2.25, 0.5, 1.0]]) {
    const r = 0.19;
    g.cyl(0, y0, 0, r, r, sx * len, 10, col, sp, 'x', false);
    // elbow: a few short segments bending from sideways to up
    for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4, ang = t * Math.PI / 2; g.cyl(sx * (len - 0.05 + Math.sin(ang) * 0.12), y0 + (1 - Math.cos(ang)) * 0.16, 0, r, r, 0.07, 10, col, sp, 'y', false); }
    g.cyl(sx * (len + 0.07), y0 + 0.16, 0, r, r * 0.9, up, 10, col, sp, 'y', false); dome(sx * (len + 0.07), y0 + 0.16 + up - 0.02, 0, r * 0.9);
  }
  return smoothGeo(g, 55);
}
// smooth shading for props built from flat facets: each vertex takes the mean normal of the faces meeting at its
// position within maxDeg of its own, so curved things shade round while real edges stay crisp
function smoothGeo(g, maxDeg) {
  const P = g.p, N = g.n, nv = P.length / 3, cosT = Math.cos(maxDeg * Math.PI / 180), F = N.slice(), groups = new Map();
  const q = v => Math.round(v * 1000);
  for (let i = 0; i < nv; i++) { const k = q(P[i * 3]) + ',' + q(P[i * 3 + 1]) + ',' + q(P[i * 3 + 2]); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(i); }
  for (const idx of groups.values()) for (const i of idx) {
    let sx = 0, sy = 0, sz = 0;
    for (const j of idx) if (F[i * 3] * F[j * 3] + F[i * 3 + 1] * F[j * 3 + 1] + F[i * 3 + 2] * F[j * 3 + 2] >= cosT) { sx += F[j * 3]; sy += F[j * 3 + 1]; sz += F[j * 3 + 2]; }
    const l = Math.hypot(sx, sy, sz); if (l > 1e-6) { N[i * 3] = sx / l; N[i * 3 + 1] = sy / l; N[i * 3 + 2] = sz / l; }
  }
  return g;
}
// boulder: an icosphere subdivided twice, pushed in and out by a few broad bumps and some finer knobs, the bottom
// flattened where it sits in the ground; shaded smooth with the sharper ridges kept
function boulderGeo(seed, flat) {
  const R = C.rng(seed), t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm3);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < 2; s++) {
    const mid = new Map(), m = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!mid.has(k)) { V.push(nrm3([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2])); mid.set(k, V.length - 1); } return mid.get(k); };
    const NF = []; for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } F = NF;
  }
  const bumps = []; for (let i = 0; i < 7; i++) bumps.push([nrm3([R() - 0.5, R() - 0.5, R() - 0.5]), (R() - 0.35) * 0.32, 2 + R() * 3]);
  const knobs = []; for (let i = 0; i < 16; i++) knobs.push([nrm3([R() - 0.5, R() - 0.5, R() - 0.5]), (R() - 0.5) * 0.12, 8 + R() * 8]);
  const sq = [0.9 + R() * 0.35, 0.7 + R() * 0.25, 0.85 + R() * 0.3];
  const P = V.map(v => {
    let r = 1;
    for (const [d, a, k] of bumps) r += a * Math.pow(Math.max(0, v[0] * d[0] + v[1] * d[1] + v[2] * d[2]), k);
    for (const [d, a, k] of knobs) r += a * Math.pow(Math.max(0, v[0] * d[0] + v[1] * d[1] + v[2] * d[2]), k);
    let y = v[1] * r * sq[1]; if (flat && y < -0.1) y = -0.1 + (y + 0.1) * 0.25;
    return [v[0] * r * sq[0], y + 0.35, v[2] * r * sq[2]];
  });
  const g = new Geo();
  for (const [a, b, c] of F) g.tri(P[a], P[b], P[c], [1, 1, 1], 0, [0, 0.35, 0]);
  return smoothGeo(g, 42);
}
function shrubGeo() { const g = new Geo(); g.rock(0, 0.3, 0, 0.8, [1, 1, 1], C.rng(4), true); return smoothGeo(g, 60); }
function rockGeo() { return boulderGeo(17, true); }
function hayGeo() { const g = new Geo(); g.cyl(-0.65, 0.6, 0, 0.6, 0.6, 1.3, 16, lin('#d9b45a'), 0, 'x', true, 0, lin('#c79d45')); return smoothGeo(g, 30); }
// spectators: round limbs and a round head instead of boxes. Shirt and sleeves take the instance colour (uv.y 0),
// skin, jeans and hair don't (uv.y -1).
function sphereGeo(g, cx, cy, cz, r, ry, col, mask, NA, NB) {
  NA = NA || 10; NB = NB || 6;
  const P = (a, b) => [cx + Math.cos(b) * Math.cos(a) * r, cy + Math.sin(b) * ry, cz + Math.cos(b) * Math.sin(a) * r];
  const uv = [[0, mask], [0, mask], [0, mask], [0, mask]];
  for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) {
    const a0 = i / NA * Math.PI * 2, a1 = (i + 1) / NA * Math.PI * 2, b0 = -Math.PI / 2 + j / NB * Math.PI, b1 = -Math.PI / 2 + (j + 1) / NB * Math.PI;
    g.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), col, 0, [cx, cy, cz], uv);
  }
}
function fanGeo() {
  const g = new Geo();
  const jeans = lin('#2b3a55'), skin = lin('#d8a27c'), shirt = [1, 1, 1], hair = lin('#2a211b'), shoe = lin('#1a1a1c');
  for (const sx of [-1, 1]) {
    g.cyl(sx * 0.11, 0.0, 0.02, 0.07, 0.06, 0.09, 8, shoe, 0, 'y', true, -1);
    g.cyl(sx * 0.11, 0.08, 0, 0.075, 0.09, 0.78, 8, jeans, 0, 'y', true, -1);
    // arms up, cheering: sleeve, forearm, hand
    g.cyl(sx * 0.27, 1.22, 0, 0.065, 0.058, 0.3, 7, shirt, 0, 'y', true, 0);
    g.cyl(sx * 0.29, 1.5, 0, 0.05, 0.045, 0.24, 7, skin, 0, 'y', false, -1);
    sphereGeo(g, sx * 0.29, 1.76, 0, 0.055, 0.06, skin, -1, 7, 4);
  }
  g.cyl(0, 0.82, 0, 0.19, 0.2, 0.18, 10, jeans, 0, 'y', false, -1);         // hips
  g.cyl(0, 0.98, 0, 0.2, 0.22, 0.44, 10, shirt, 0, 'y', true, 0);           // torso
  sphereGeo(g, 0, 1.42, 0, 0.215, 0.07, shirt, 0, 10, 4);                   // shoulders
  g.cyl(0, 1.44, 0, 0.055, 0.055, 0.08, 7, skin, 0, 'y', false, -1);        // neck
  sphereGeo(g, 0, 1.62, 0, 0.115, 0.13, skin, -1, 10, 6);                   // head
  sphereGeo(g, 0, 1.68, -0.015, 0.122, 0.09, hair, -1, 10, 4);              // hair / beanie
  return smoothGeo(g, 50);
}
function chevronGeo() {
  const g = new Geo(); const w = 0.85, y0 = 0.75, y1 = 1.55;
  // board (front face +z) uv full texture minus post strip
  g.quad([-w, y0, 0.06], [w, y0, 0.06], [w, y1, 0.06], [-w, y1, 0.06], [1, 1, 1], 0, [0, y0, -5], [[0, 0.12], [1, 0.12], [1, 1], [0, 1]]);
  g.quad([-w, y0, 0.0], [w, y0, 0.0], [w, y1, 0.0], [-w, y1, 0.0], [1, 1, 1], 0, [0, y0, 5], [[0.5, 0.04], [0.5, 0.04], [0.5, 0.04], [0.5, 0.04]]);
  const post = (x) => {
    const pts = [[x - 0.05, -0.2, -0.05], [x + 0.05, -0.2, -0.05], [x + 0.05, y1, -0.05], [x - 0.05, y1, -0.05]];
    g.quad(...pts, [1, 1, 1], 0, [x, 0.5, 5], [[0.5, 0.04], [0.5, 0.04], [0.5, 0.04], [0.5, 0.04]]);
  };
  post(-0.6); post(0.6);
  return g;
}

function instData(list, fn) {
  const a = new Float32Array(list.length * 11);
  list.forEach((o, i) => { a.set(fn(o), i * 11); });
  return a;
}

// ---------- arches & boards ----------
// inflatable arch: two fat tubes and a beam, segmented where the air chambers are, the banner on the beam
function archGeo(width, colPillar) {
  const g = new Geo(), hi = scalec(colPillar, 1.6), lo = scalec(colPillar, 0.75);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 6; k++) { const y = k * 0.86 - 0.2; g.cyl(sx * width / 2, y, 0, 0.5 - (k === 0 ? 0 : 0.03), 0.5, 0.86, 14, k % 2 ? colPillar : hi, 0.15, 'y', false); }
    g.cyl(sx * width / 2, -0.2, 0, 0.62, 0.55, 0.3, 14, lo, 0.1, 'y', true);
  }
  const L = width + 1.0, n = 7;
  for (let k = 0; k < n; k++) g.cyl(-L / 2 + k * L / n, 4.95, 0, 0.62, 0.62, L / n, 14, k % 2 ? colPillar : hi, 0.15, 'x', k === 0 || k === n - 1);
  return smoothGeo(g, 50);
}
function bannerQuadGeo(width, y0, y1, z) {
  const g = new Geo(); const w = width / 2;
  // front (approach side, faces -z): text reads left-to-right for a driver heading +z
  g.quad([w, y0, z], [-w, y0, z], [-w, y1, z], [w, y1, z], [1, 1, 1], 0, [0, (y0 + y1) / 2, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  g.quad([-w, y0, -z], [w, y0, -z], [w, y1, -z], [-w, y1, -z], [1, 1, 1], 0, [0, (y0 + y1) / 2, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  return g;
}
function boardGeo() {
  const g = new Geo(); const w = 1.8, y0 = 0.5, y1 = 1.4;
  g.quad([-w, y0, 0.05], [w, y0, 0.05], [w, y1, 0.05], [-w, y1, 0.05], [1, 1, 1], 0, [0, 1, -5], [[0, 0.1], [1, 0.1], [1, 1], [0, 1]]);
  g.quad([-w, 0, 0], [w, 0, 0], [w, y1, 0], [-w, y1, 0], [1, 1, 1], 0, [0, 1, 5], [[0.5, 0.03], [0.5, 0.03], [0.5, 0.03], [0.5, 0.03]]);
  return g;
}

// ---------- ground cover (grass tufts, ferns, dry stalks, sage) ----------
// one 512x256 atlas per stage, four 128px-wide variants; transparent texels get their neighbours' colour so
// filtering never pulls in a dark halo
// tiling detail map for the ground (neutral grey = no change; drawn as strokes and blots that wrap around the edges).
// It multiplies the albedo, so the tile reads as blades of grass, pine litter, wind ripples or snow crust.
// gravel stones for the road shader: two tileable Voronoi layers in one 512² texture covering a metre of road.
// rgb = small stones (~4 cm): shade, gap (0 in the joints between stones), dome; a = bigger loose stones (~8 cm, in
// about 45 % of the cells, set apart on the fines): mask × (0.25 + 0.75 shade), 0 where there is none. Built once and
// shared by every gravel stage.
let gravelTexData = null;
function gravelTex() {
  if (gravelTexData) return gravelTexData;
  const N = 512, d = new Uint8Array(N * N * 4), R = C.rng(4242);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const layer = (cells, big) => {
    const pts = new Float32Array(cells * cells * 2), sh = new Float32Array(cells * cells), on = new Uint8Array(cells * cells);
    for (let i = 0; i < cells * cells; i++) { pts[i * 2] = 0.1 + R() * 0.8; pts[i * 2 + 1] = 0.1 + R() * 0.8; sh[i] = R(); on[i] = R() < 0.45 ? 1 : 0; }
    const cs = N / cells;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x + 0.5) / cs, fy = (y + 0.5) / cs, ix = Math.floor(fx), iy = Math.floor(fy);
      let d1 = 9, d2 = 9, id = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cx = ix + ox, cy = iy + oy, k = ((cy + cells) % cells) * cells + (cx + cells) % cells;
        const dx = cx + pts[k * 2] - fx, dy = cy + pts[k * 2 + 1] - fy, dd = dx * dx + dy * dy;
        if (dd < d1) { d2 = d1; d1 = dd; id = k; } else if (dd < d2) d2 = dd;
      }
      d1 = Math.sqrt(d1); d2 = Math.sqrt(d2);
      const dome = 1 - ss(0, 0.62, d1), gap = ss(0.02, 0.16, d2 - d1), o = (y * N + x) * 4;
      if (!big) { d[o] = sh[id] * 255; d[o + 1] = gap * 255; d[o + 2] = dome * 255; }
      else d[o + 3] = on[id] ? gap * ss(0.62, 0.4, d1) * (0.25 + 0.75 * sh[id]) * 255 : 0; // loose stones sit apart, on the fines
    }
  };
  layer(26, false); layer(13, true);
  return gravelTexData = { data: d, w: N, h: N };
}
function groundDetailCanvas(st) {
  const W = 512, R = C.rng(st.seed + 313), kind = st.id === 'forest' ? 'forest' : st.kind;
  return canvasTex(W, W, (g) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, W, W);
    const wrap = (x, y, m, f) => { for (const ox of [-W, 0, W]) { if ((ox < 0 && x > m) || (ox > 0 && x < W - m)) continue; for (const oy of [-W, 0, W]) { if ((oy < 0 && y > m) || (oy > 0 && y < W - m)) continue; f(x + ox, y + oy); } } };
    const blot = (x, y, r, col, a) => wrap(x, y, r, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(X - r, Y - r, 2 * r, 2 * r); });
    const line = (x, y, len, ang, wd, col, a) => wrap(x, y, len, (X, Y) => { g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(ang) * len, Y + Math.sin(ang) * len); g.stroke(); });
    const dot = (x, y, r, col, a) => wrap(x, y, r, (X, Y) => { g.fillStyle = `rgba(${col},${a})`; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill(); });
    const rnd = (a, b) => a + R() * (b - a);
    if (kind === 'pine' || kind === 'forest') {
      const forest = kind === 'forest';
      for (let i = 0; i < 70; i++) blot(R() * W, R() * W, rnd(25, 70), R() < 0.5 ? (forest ? '95,110,70' : '110,125,80') : '150,140,110', rnd(0.1, 0.22));
      const n = forest ? 9000 : 7000;
      for (let i = 0; i < n; i++) {
        const x = R() * W, y = R() * W, dark = R() < 0.5;
        if (forest) line(x, y, rnd(6, 12), R() * Math.PI, rnd(0.9, 1.5), dark ? '55,38,25' : '190,150,100', rnd(0.35, 0.6));
        else line(x, y, rnd(8, 18), -Math.PI / 2 + rnd(-0.8, 0.8), rnd(1.2, 1.9), dark ? '50,66,34' : '185,205,120', rnd(0.45, 0.75));
      }
      if (forest) { for (let i = 0; i < 70; i++) { const x = R() * W, y = R() * W; line(x, y, rnd(30, 70), R() * Math.PI, rnd(1.6, 2.6), '48,34,22', 0.75); } for (let i = 0; i < 60; i++) { const x = R() * W, y = R() * W, r = rnd(2.5, 6); dot(x + 1, y + 1.5, r, '30,28,26', 0.7); dot(x, y, r, '165,160,150', 0.85); dot(x - r * 0.3, y - r * 0.3, r * 0.45, '200,196,186', 0.6); } }
      else for (let i = 0; i < 90; i++) dot(R() * W, R() * W, rnd(1, 2.2), R() < 0.5 ? '215,200,120' : '235,235,230', 0.7);
    } else if (kind === 'mesa') {
      // wind ripples: wavy crests with a bright lee face and a shadow behind, sliding slowly across the tile
      for (let y0 = 4; y0 < W; y0 += rnd(10, 22)) {
        const ph = R() * 6.28, amp = rnd(2, 6), k = 1 + ((R() * 3) | 0), wob = rnd(0.5, 1.5), a = rnd(0.18, 0.34);
        for (let pass = 0; pass < 2; pass++) {
          g.strokeStyle = pass ? `rgba(255,238,205,${a})` : `rgba(95,70,48,${a})`; g.lineWidth = pass ? rnd(1.4, 2.2) : rnd(2, 3); g.beginPath();
          let pen = false;
          for (let x = 0; x <= W; x += 8) { const y = y0 + (pass ? 0 : 3) + Math.sin(x / W * Math.PI * 2 * k + ph) * amp + Math.sin(x / W * Math.PI * 2 * (k + 3) + ph * wob) * amp * 0.4; if (R() < 0.05 && x % W) pen = false; if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } }
          g.stroke();
        }
      }
      for (let i = 0; i < 12000; i++) dot(R() * W, R() * W, rnd(0.5, 1.1), R() < 0.5 ? '255,235,200' : '90,70,50', rnd(0.25, 0.5));
      for (let i = 0; i < 45; i++) { const x = R() * W, y = R() * W, r = rnd(2, 5); dot(x + 1, y + 1.4, r, '50,40,32', 0.6); dot(x, y, r, '175,150,125', 0.85); }
      for (let i = 0; i < 40; i++) blot(R() * W, R() * W, rnd(30, 80), R() < 0.5 ? '190,160,130' : '95,75,55', 0.1);
    } else if (kind === 'city') {
      // asphalt off the route: broad stains and patches, fine aggregate
      for (let i = 0; i < 50; i++) blot(R() * W, R() * W, rnd(30, 90), R() < 0.5 ? '150,150,150' : '90,90,92', rnd(0.08, 0.18));
      for (let i = 0; i < 9000; i++) dot(R() * W, R() * W, rnd(0.5, 1.1), R() < 0.5 ? '200,200,200' : '60,60,62', rnd(0.12, 0.3));
    } else {
      // snow: drifts, a fine crust, faint wind ripples and the odd glint
      for (let i = 0; i < 60; i++) blot(R() * W, R() * W, rnd(30, 90), R() < 0.5 ? '230,236,255' : '90,105,150', rnd(0.12, 0.25));
      for (let y0 = 14; y0 < W; y0 += 26) {
        const ph = R() * 6.28, amp = rnd(4, 9), k = 1 + ((R() * 2) | 0);
        g.strokeStyle = 'rgba(80,92,135,0.22)'; g.lineWidth = 4; g.beginPath();
        for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x / W * Math.PI * 2 * k + ph) * amp; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 14000; i++) dot(R() * W, R() * W, rnd(0.5, 1.2), R() < 0.6 ? '255,255,255' : '110,120,160', rnd(0.15, 0.32));
      for (let i = 0; i < 160; i++) dot(R() * W, R() * W, rnd(0.7, 1.4), '255,255,255', 0.95);
    }
  });
}

function tuftAtlas(id) {
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); const R = C.rng(id === 'pine' ? 71 : id === 'frost' ? 72 : 73);
  const blade = (cx, base, h, lean, w, c0, c1) => {
    const grd = g.createLinearGradient(0, base, 0, base - h); grd.addColorStop(0, c0); grd.addColorStop(1, c1);
    g.fillStyle = grd; g.beginPath();
    g.moveTo(cx - w, base);
    g.quadraticCurveTo(cx - w * 0.4 + lean * 0.35, base - h * 0.55, cx + lean, base - h);
    g.quadraticCurveTo(cx + w * 0.4 + lean * 0.35, base - h * 0.55, cx + w, base);
    g.closePath(); g.fill();
  };
  const grass = (ox, n, hMin, hMax, c0, c1, spread) => {
    for (let i = 0; i < n; i++) {
      const cx = ox + 64 + (R() - 0.5) * (spread || 70), h = hMin + R() * (hMax - hMin);
      blade(cx, H, h, (cx - ox - 64) * 0.5 + (R() - 0.5) * 50, 1.6 + R() * 2.4, c0, c1);
    }
  };
  const dots = (ox, n, cols, yMin, yMax, r) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[(R() * cols.length) | 0];
      g.beginPath(); g.arc(ox + 64 + (R() - 0.5) * 80, yMin + R() * (yMax - yMin), r * (0.7 + R() * 0.6), 0, Math.PI * 2); g.fill();
    }
  };
  const twig = (x, y, len, ang, w, col, depth) => {
    const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    if (depth > 0) for (let k = 0; k < 2; k++) twig(x2, y2, len * (0.55 + R() * 0.2), ang + (k ? 1 : -1) * (0.35 + R() * 0.4), w * 0.7, col, depth - 1);
  };
  if (id === 'pine') {
    grass(0, 46, 90, 230, '#26401b', '#7b9945');
    grass(128, 34, 80, 190, '#2b481e', '#87a14e'); dots(128, 9, ['#f3e46a', '#ffffff', '#f6d24a'], 70, 150, 4.5);
    // fern: arching fronds made of leaflets
    for (let f = 0; f < 7; f++) {
      const a = -1.25 + f * 0.42 + (R() - 0.5) * 0.2, len = 150 + R() * 70;
      for (let k = 0; k < 15; k++) {
        const t = k / 15, x = 320 + Math.sin(a) * len * t * 0.95, y = H - Math.cos(a * 0.85) * len * t * (1 - t * 0.35);
        const lw = (1 - t) * 13 + 3;
        g.fillStyle = k % 2 ? '#2f5a22' : '#3d6e2a';
        g.beginPath(); g.ellipse(x, y, lw, 3.2, a + Math.PI / 2, 0, Math.PI * 2); g.fill();
      }
    }
    grass(384, 40, 70, 200, '#4f4422', '#bfa55c');
  } else if (id === 'frost') {
    const stalks = (ox, n) => {
      for (let i = 0; i < n; i++) {
        const cx = ox + 64 + (R() - 0.5) * 70, h = 90 + R() * 150, lean = (R() - 0.5) * 40;
        blade(cx, H, h, lean, 1.2 + R() * 0.8, '#3a2e22', '#a88c5e');
        g.fillStyle = '#8a7048'; g.beginPath(); g.ellipse(cx + lean, H - h + 6, 2.6, 9, lean * 0.01, 0, Math.PI * 2); g.fill();
      }
    };
    const snowFoot = (ox, w) => { g.fillStyle = '#eef2f9'; g.beginPath(); g.ellipse(ox + 64, H, w, 26, 0, Math.PI, 0); g.fill(); };
    stalks(0, 22); snowFoot(0, 52);
    for (let i = 0; i < 5; i++) twig(128 + 64 + (R() - 0.5) * 30, H, 60 + R() * 30, (R() - 0.5) * 0.9, 4, '#2d241c', 3);
    dots(128, 26, ['#f4f7fc', '#e3e9f4', '#ffffff'], 120, 210, 11); snowFoot(128, 58);
    for (let i = 0; i < 16; i++) blade(256 + 64 + (R() - 0.5) * 50, H, 150 + R() * 100, (R() - 0.5) * 16, 1.3, '#4a3a26', '#c2a26a');
    snowFoot(256, 40);
    stalks(384, 12); snowFoot(384, 46);
  } else {
    grass(0, 44, 70, 190, '#6b5226', '#e2c27b');
    // sage: dome of small grey-green leaves on a woody base
    for (let i = 0; i < 4; i++) twig(128 + 64 + (R() - 0.5) * 20, H, 40, (R() - 0.5) * 1.2, 4, '#4a3a2a', 2);
    for (let i = 0; i < 140; i++) {
      const a = R() * Math.PI, r = Math.sqrt(R()) * 58;
      g.fillStyle = ['#6f7b5d', '#8d9a76', '#a6ae8c', '#5f6b50'][(R() * 4) | 0];
      g.beginPath(); g.arc(128 + 64 + Math.cos(a) * r, H - 18 - Math.sin(a) * r * 1.25, 4 + R() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 6; i++) twig(256 + 64 + (R() - 0.5) * 20, H, 55 + R() * 25, (R() - 0.5) * 1.4, 3.5, '#6a4f36', 3);
    grass(384, 30, 60, 170, '#6b5226', '#d9b66a'); dots(384, 10, ['#f2c84a', '#f6e27a'], 80, 160, 4);
  }
  // bleed colour into transparent texels (premultiplied canvas data would otherwise filter to black)
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const rgb = new Float32Array(W * H * 3), have = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 8) { have[i] = 1; rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; }
  for (let pass = 0; pass < 6; pass++) {
    const nh = have.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (have[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X; if (!have[j]) continue; r += rgb[j * 3]; gg += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n++;
      }
      if (n) { rgb[i * 3] = r / n; rgb[i * 3 + 1] = gg / n; rgb[i * 3 + 2] = b / n; nh[i] = 1; }
    }
    have.set(nh);
  }
  const out = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) { out.data[i * 4] = rgb[i * 3]; out.data[i * 4 + 1] = rgb[i * 3 + 1]; out.data[i * 4 + 2] = rgb[i * 3 + 2]; out.data[i * 4 + 3] = d[i * 4 + 3]; }
  return out;
}
// three crossed quads, normals straight up so a tuft is lit like the ground it stands on
function tuftGeo() {
  const p = [], n = [], c = [], u = [];
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3, dx = Math.cos(a) * 0.5, dz = Math.sin(a) * 0.5;
    const V = [[-dx, 0, -dz, 0, 0], [dx, 0, dz, 0.25, 0], [dx, 1, dz, 0.25, 1], [-dx, 1, -dz, 0, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { const v = V[i]; p.push(v[0], v[1], v[2]); n.push(0, 1, 0); c.push(1, 1, 1, 0); u.push(v[3], v[4]); }
  }
  return { p, n, c, u };
}
function placeTufts(W) {
  const { T, TR, st } = W, R = C.rng(st.seed + 555), hw = T.hw, out = [], tmp = {};
  if (st.city) return new Float32Array(0);
  const V = visOf(st);
  const per = V.tuftPer || (st.kind === 'pine' ? 5 : st.kind === 'frost' ? 2 : 3);
  const dMin = st.bank ? hw + 4.7 : hw + 1.1;
  const tint = V.tuftTint ? V.tuftTint : st.kind === 'pine' ? [[1, 1, 1], [0.92, 1.0, 0.86], [1.06, 1.02, 0.9]] : st.kind === 'frost' ? [[1, 1, 1], [0.95, 0.95, 1.0]] : [[1, 1, 1], [1.05, 0.97, 0.9], [0.92, 0.9, 0.86]];
  const wts = st.kind === 'pine' ? [0.5, 0.18, 0.17, 0.15] : st.kind === 'frost' ? [0.4, 0.25, 0.2, 0.15] : [0.45, 0.25, 0.15, 0.15];
  const pick = () => { let r = R(); for (let k = 0; k < 4; k++) { if ((r -= wts[k]) < 0) return k; } return 0; };
  for (let i = 2; i < T.n - 2; i++) {
    const h = T.H[i], rx = -Math.cos(h), rz = Math.sin(h), tx = Math.sin(h), tz = Math.cos(h);
    for (const side of [-1, 1]) for (let k = 0; k < per; k++) {
      const d = dMin + Math.pow(R(), 1.9) * 24, along = (R() - 0.5) * 2;
      const x = T.X[i] + rx * d * side + tx * along, z = T.Z[i] + rz * d * side + tz * along;
      const j = C.nearest(T, x, z, 40); if (j < 0) continue;
      C.project(T, j, x, z, tmp); if (tmp.dist < dMin - 0.2) continue;
      const y = C.terrainH(TR, x, z);
      const sl = Math.abs(C.terrainH(TR, x + 1, z) - y) + Math.abs(C.terrainH(TR, x, z + 1) - y);
      if (sl > 0.7) continue;
      const v = pick(), tc = tint[(R() * tint.length) | 0], b = 0.85 + R() * 0.3;
      const big = v === 1 && st.kind !== 'pine' ? 1.2 : v === 2 && st.kind === 'pine' ? 1.3 : 1;
      const sc = (0.55 + R() * 0.6) * big;
      out.push(x, y - 0.06, z, R() * 6.28, sc * 1.25, sc * (0.6 + R() * 0.45) * (st.kind === 'frost' ? 0.9 : 1), v * 0.25, 0, tc[0] * b, tc[1] * b, tc[2] * b);
    }
  }
  return new Float32Array(out);
}

// ---------- far scenery ----------
function farGeo(W) {
  const { T, st } = W; const V = visOf(st);
  const g = new Geo(); const R = C.rng(st.seed + 99);
  const cx = (T.bbox.minX + T.bbox.maxX) / 2, cz = (T.bbox.minZ + T.bbox.maxZ) / 2;
  const rad = Math.max(T.bbox.maxX - T.bbox.minX, T.bbox.maxZ - T.bbox.minZ) / 2 + 650;
  let my = 0; for (let i = 0; i < T.n; i++) my += T.Y[i]; my /= T.n;
  const far = lin(V.far);
  if (st.kind === 'mesa') {
    // buttes and mesas: an irregular outline (spurs and bays that carry straight up the cliff), a concave apron of
    // scree melting into the desert, a sheer cliff in strata bands and a harder, darker caprock that juts out a
    // little. Some are long mesas, some carry a second smaller tier. (Slender spires read as chimneys from this far.)
    const sand = lin(V.skirt);
    const butte = (x, z, w, h, kind) => {
      const N = 30, el = kind === 'mesa' ? 0.35 + R() * 0.35 : R() * 0.15, th = R() * Math.PI;
      const st4 = (V.strata || ['#a5502e', '#c46a3c', '#8a3f25', '#d18a57']).map(c => mixc(far, lin(c), 0.55 + R() * 0.2));
      const out = [];
      for (let j = 0; j < N; j++) {
        const a = j / N * Math.PI * 2;
        // spurs, the odd bay cut back, and narrow gullies every other point that run down the whole cliff
        const rr = (1 + el * Math.cos(2 * (a - th))) * (0.84 + R() * 0.3) * (R() < 0.18 ? 0.78 : 1) * (j % 2 ? 0.95 : 1.03);
        out.push([Math.sin(a), Math.cos(a), rr]);
      }
      const base = my - 34, ref = [x, base + h * 0.4, z];
      const ring = (y, k, jit) => out.map(([sx, sz, rr]) => { const q = w * rr * k * (1 + (jit ? (R() - 0.5) * jit : 0)); return [x + sx * q, y, z + sz * q]; });
      const band = (A, B, col) => { for (let j = 0; j < N; j++) { const j2 = (j + 1) % N; g.quad(A[j], A[j2], B[j2], B[j], col, 0, ref); } };
      const cap = (A, y, col) => { const c0 = [x, y, z]; for (let j = 0; j < N; j++) g.tri(c0, A[j], A[(j + 1) % N], col, 0, [x, y - 50, z]); };
      const scree = mixc(st4[2], far, 0.3), apron = mixc(scree, sand, 0.55);
      // apron and scree: wide and low at the foot, steepening up to the cliff
      const r0 = ring(base, 1.55, 0.12), r1 = ring(base + h * 0.1, 1.22, 0.1), r2 = ring(base + h * 0.24, 1.02, 0.06);
      band(r0, r1, apron); band(r1, r2, scree);
      // the cliff: strata bands, each a touch narrower, sharing the outline so spurs run straight up
      let y = base + h * 0.24, prev = ring(y, 0.98, 0), kk = 0.98;
      const bands = 3 + ((R() * 2) | 0), top = base + h * 0.9, bh = (top - y) / bands;
      for (let k = 0; k < bands; k++) {
        kk *= 0.97 + R() * 0.02;
        const nxt = ring(y + bh, kk, 0);
        band(prev, nxt, st4[k % 4]);
        prev = nxt; y += bh;
      }
      // caprock: a hard, darker layer that overhangs the cliff a little, then the flat top
      const capC = mixc(st4[2], [0.2, 0.12, 0.08], 0.25), topC = mixc(st4[3], [1, 0.92, 0.82], 0.15);
      const c0 = ring(y, kk * 1.04, 0), c1 = ring(base + h, kk * 1.04, 0);
      for (let j = 0; j < N; j++) { const j2 = (j + 1) % N; g.quad(prev[j], prev[j2], c0[j2], c0[j], capC, 0, [x, y + 30, z]); }
      band(c0, c1, capC);
      if (kind === 'tier') {
        // a second, smaller tier set back on the top
        const t0 = ring(base + h, kk * 0.55, 0), t1 = ring(base + h * 1.35, kk * 0.5, 0), t2 = ring(base + h * 1.4, kk * 0.52, 0);
        cap(c1, base + h, topC);
        band(t0, t1, st4[1]); band(t1, t2, capC); cap(t2, base + h * 1.4, topC);
      } else cap(c1, base + h, topC);
    };
    for (let i = 0; i < 34; i++) {
      const a = i / 34 * Math.PI * 2 + R() * 0.1, r = rad + R() * 700;
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, p = R();
      if (p < 0.32) butte(x, z, 120 + R() * 140, 45 + R() * 60, 'mesa');
      else if (p < 0.68) butte(x, z, 70 + R() * 90, 60 + R() * 70, 'tier');
      else butte(x, z, 70 + R() * 140, 55 + R() * 100, 'butte');
    }
  } else {
    // low-poly mountains: rings of jittered points under an off-centre peak, so each one has ridges and a
    // shoulder; darker at the foot, paler rock up high, snow on the tops (all of them at Frostvik, the tallest
    // elsewhere). Two rows: a nearer, lower one and a taller one further out that the haze softens.
    const snowC = lin('#eef2f8'), rockHi = mixc(far, [0.82, 0.86, 0.9], 0.35);
    const mountain = (x, z, w, h, cc, snowAt) => {
      const N = 14, M = 6, v0 = g.p.length, px = x + (R() - 0.5) * w * 0.35, pz = z + (R() - 0.5) * w * 0.35, base = my - 30;
      // each spoke keeps roughly one bearing from the peak down, and every ring reaches further out than the one
      // above it, so the slopes always open outwards (a ring tucked inside the next one folded the foot under
      // into a dark, flat-topped wall facing away from the sun)
      const rings = [], ang = [], prevR = new Array(N).fill(0);
      for (let j = 0; j < N; j++) ang.push(j / N * Math.PI * 2 + (R() - 0.5) * 0.4);
      for (let k = 1; k <= M; k++) {
        const f = k / M, ring = [];
        for (let j = 0; j < N; j++) {
          const an = ang[j] + (R() - 0.5) * 0.16;
          const rr = Math.max(w * f * (0.78 + R() * 0.44), prevR[j] + w * 0.16); prevR[j] = rr;
          const hh = k === M ? 0 : h * Math.pow(1 - f, 1.25) * (0.8 + R() * 0.4);
          ring.push([x + (px - x) * (1 - f) + Math.sin(an) * rr, base + hh, z + (pz - z) * (1 - f) + Math.cos(an) * rr]);
        }
        rings.push(ring);
      }
      const top = [px, base + h, pz], ref = [x, base - 50, z];
      const shade = (y) => { const t = (y - base) / h, rock = mixc(mixc(cc, [0, 0, 0], 0.18 * (1 - t)), rockHi, Math.max(0, t - 0.25) * 0.8); return mixc(rock, snowC, C.sstep(snowAt - 0.04, snowAt + 0.04, t)); };
      for (let j = 0; j < N; j++) { const a = rings[0][j], b = rings[0][(j + 1) % N]; g.tri(top, a, b, shade((top[1] + a[1] + b[1]) / 3), 0, ref); }
      for (let k = 0; k < M - 1; k++) for (let j = 0; j < N; j++) {
        const a = rings[k][j], b = rings[k][(j + 1) % N], c = rings[k + 1][j], d = rings[k + 1][(j + 1) % N];
        g.tri(a, c, b, shade((a[1] + b[1] + c[1]) / 3), 0, ref); g.tri(b, c, d, shade((b[1] + c[1] + d[1]) / 3), 0, ref);
      }
      // colour by vertex height, so rock, scree and snow grade into each other instead of tiling the slope in facets
      for (let i = v0; i < g.p.length; i += 3) { const c = shade(g.p[i + 1] + (Math.sin(g.p[i] * 0.05) + Math.sin(g.p[i + 2] * 0.043)) * h * 0.04); const v = i / 3 * 4; g.c[v] = c[0]; g.c[v + 1] = c[1]; g.c[v + 2] = c[2]; }
    };
    const frost = st.kind === 'frost';
    for (const [n, r0, rj, hk, tint] of [[40, 0, 450, 0.8, 0], [46, 650, 900, 1.35, 0.12]]) {
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + R() * 0.12, r = rad + r0 + R() * rj;
        const w = 220 + R() * 300, h = ((frost ? 140 : 70) + R() * (frost ? 230 : 120)) * hk;
        const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
        const cc = mixc(far, [0.9, 0.95, 1.0], (frost ? 0.1 + R() * 0.2 : R() * 0.08) + tint);
        mountain(x, z, w, h, cc, frost ? 0.55 + R() * 0.15 : h > 190 ? 0.78 : 2);
      }
    }
  }
  // skirt under everything
  const sk = lin(V.skirt), E = 6000;
  g.quad([cx - E, my - 26, cz - E], [cx + E, my - 26, cz - E], [cx + E, my - 26, cz + E], [cx - E, my - 26, cz + E], sk, 0, [cx, my - 100, cz]);
  g.my = my;
  // smooth the slopes and the rounded cliff faces; ridges, cliff tops and caprock edges are sharper than this and stay crisp
  return smoothGeo(g, 72);
}

// ---------- city facades ----------
// One floor of a facade per layer of a texture array (LIT_FS mode 12): two bays across (512 px for 6.6 m) and the
// floor's height up (256 px for 3 m, 4 m on the ground floor), repeating both ways. rgb is the colour (walls are
// painted light so the building's colour can tint them); alpha is the material: 255 wall, 191 trim (frames,
// shutters, stone dressings, never tinted), 128 glass (glossy, lit at night), 64 tinted glass (curtain walls: takes
// the building's colour). The variants of a floor share its structure and differ in what is behind the windows; the
// shader picks one per tile and floor. Rows go bottom-up, since an array upload can't be flipped.
const FAC_W = 6.6, MAT = { wall: 255, trim: 191, glass: 128, tglass: 64 };
const SHOPS = ['CAFE', 'BAR', 'PHARMACY', 'BAKERY', 'BOOKS', 'PIZZA', 'HOTEL', 'DELI', 'SHOES', 'MARKET', 'OPTICIAN', 'FLOWERS',
  'KIOSK', 'BANK', 'TAILOR', 'BIKES', 'HARDWARE', 'GRILL', 'LAUNDRY', 'MUSIC', 'TOYS', 'WINES', 'BARBER', 'TOBACCO'];
const SIGNS = [[[150, 32, 30], [246, 236, 214]], [[28, 74, 52], [236, 222, 170]], [[24, 40, 78], [240, 240, 236]], [[22, 22, 24], [228, 196, 110]],
  [[232, 226, 210], [40, 40, 44]], [[214, 168, 40], [30, 30, 30]], [[30, 96, 104], [244, 244, 240]], [[96, 30, 44], [240, 220, 180]]];
const FABRIC = [[236, 232, 220], [222, 214, 196], [205, 205, 200], [228, 220, 205], [190, 196, 204], [214, 200, 180], [200, 184, 170]];
let facadeData = null;
function facadeLayers() {
  if (facadeData) return facadeData;
  const W = 512, H = 256;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d', { willReadFrequently: true }); };
  const g = mk(), m = mk(), layers = [], at = {};
  let fh = 3, sx = W / FAC_W, R = Math.random, S = Math.random;
  const X = x => x * sx, Y = y => H - y * H / fh;
  const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  // x from the tile's left, y up from the floor, in metres
  const box = (x0, y0, x1, y1, col, mat) => {
    const px = X(x0), py = Y(y1), w = X(x1) - px, h = Y(y0) - py;
    if (col) { g.fillStyle = css(col); g.fillRect(px, py, w, h); }
    if (mat != null) { m.fillStyle = `rgb(${mat},${mat},${mat})`; m.fillRect(px, py, w, h); }
  };
  // shade laid over what is there (colour only): a ramp of black (or warm white) from a0 to a1, up the y axis or
  // along x ('h')
  const ramp = (x0, y0, x1, y1, a0, a1, dir, white) => {
    const gr = dir === 'h' ? g.createLinearGradient(X(x0), 0, X(x1), 0) : g.createLinearGradient(0, Y(y0), 0, Y(y1));
    const c = white ? '255,250,240' : '0,0,0';
    gr.addColorStop(0, `rgba(${c},${a0})`); gr.addColorStop(1, `rgba(${c},${a1})`);
    g.fillStyle = gr; g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
  };
  // an arched opening: the path of a rectangle up to the springing line with a half circle on top
  const arch = (x0, y0, x1, ys, col, mat) => {
    const r = (x1 - x0) / 2, path = c => { c.beginPath(); c.moveTo(X(x0), Y(y0)); c.lineTo(X(x0), Y(ys)); c.ellipse(X(x0 + r), Y(ys), X(r), r * H / fh, 0, Math.PI, 0); c.lineTo(X(x1), Y(y0)); c.closePath(); };
    if (col) { path(g); g.fillStyle = css(col); g.fill(); }
    if (mat != null) { path(m); m.fillStyle = `rgb(${mat},${mat},${mat})`; m.fill(); }
  };
  const jit = (c, k) => { const f = 1 + (R() - 0.5) * k; return c.map(v => v * f); };
  const dim = (c, k) => c.map(v => v * k);
  const pick = (a, r) => a[(r() * a.length) | 0];
  function layer(name, floorH, seed, variant, draw) {
    fh = floorH; sx = W / FAC_W; S = C.rng(seed); R = C.rng(seed * 7 + variant * 131 + 17);
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    m.fillStyle = 'rgb(255,255,255)'; m.fillRect(0, 0, W, H);
    draw(variant);
    const a = g.getImageData(0, 0, W, H).data, b = m.getImageData(0, 0, W, H).data, d = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      const sr = (H - 1 - y) * W * 4, dr = y * W * 4;
      for (let i = 0; i < W * 4; i += 4) {
        const k = b[sr + i] > 160 ? 1 + (R() - 0.5) * 0.08 : 1; // a little grain in everything but the glass
        d[dr + i] = Math.min(255, a[sr + i] * k); d[dr + i + 1] = Math.min(255, a[sr + i + 1] * k); d[dr + i + 2] = Math.min(255, a[sr + i + 2] * k);
        d[dr + i + 3] = b[sr + i];
      }
    }
    if (at[name] == null) at[name] = layers.length;
    layers.push(d);
  }

  // ---- walls ----
  // stretcher bond, n bricks across the tile so it repeats
  const bricks = (y0, y1, base, n, ch) => {
    box(0, y0, FAC_W, y1, [176, 166, 150]);
    const bw = FAC_W / n, rows = Math.max(1, Math.round((y1 - y0) / ch)), hh = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) for (let i = -1; i < n; i++) {
      const x = (i + (r % 2) * 0.5) * bw, yy = y0 + r * hh;
      let c = jit(base, 0.24); if (R() < 0.08) c = dim(c, 0.74);
      box(x + 0.012, yy + 0.012, x + bw - 0.012, yy + hh, c);
    }
  };
  // render or stone: a flat colour with soft blotches
  const render = (y0, y1, base, k) => {
    box(0, y0, FAC_W, y1, base);
    for (let i = 0; i < 26; i++) {
      const x = R() * FAC_W, y = y0 + R() * (y1 - y0), r = 0.2 + R() * 0.7;
      g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${(0.02 + R() * 0.04) * k})`;
      g.beginPath(); g.ellipse(X(x), Y(y), X(r), r * H / fh, 0, 0, 7); g.fill();
    }
  };
  // rain streaks running down from a ledge
  const streaks = (x0, x1, y, len, a) => {
    for (let i = 0; i < 5; i++) { const s = x0 + R() * (x1 - x0), w = 0.03 + R() * 0.1; ramp(s, y - len * (0.4 + R() * 0.6), s + w, y, 0, a * (0.5 + R())); }
  };

  // ---- windows ----
  // a pane of glass and what hangs behind it
  const pane = (x0, y0, x1, y1, st) => {
    box(x0, y0, x1, y1, jit([50, 54, 60], 0.2), MAT.glass);
    ramp(x0, y0, x1, y0 + (y1 - y0) * 0.45, 0.1, 0, 'v', true);
    if (!st) return;
    const fab = st.col || jit(pick(FABRIC, R), 0.08), h = y1 - y0;
    if (st.k === 'curtain') {
      const cw = (x1 - x0) * (0.2 + R() * 0.16);
      for (const [a, b] of [[x0, x0 + cw], [x1 - cw, x1]]) {
        box(a, y0, b, y1, fab);
        for (let x = a + 0.03; x < b; x += 0.06) box(x, y0, x + 0.012, y1, dim(fab, 0.84));
      }
    } else if (st.k === 'sheer') {
      box(x0, y0, x1, y1, dim(fab, 0.6));
      for (let x = x0 + 0.02; x < x1; x += 0.05) box(x, y0, x + 0.01, y1, dim(fab, 0.5));
    } else if (st.k === 'blind') {
      const yb = y1 - h * st.f;
      box(x0, yb, x1, y1, fab); box(x0, yb, x1, yb + 0.03, dim(fab, 0.62));
    } else if (st.k === 'venetian') {
      const yb = y1 - h * st.f;
      box(x0, yb, x1, y1, [196, 196, 192]);
      for (let y = yb; y < y1; y += 0.034) box(x0, y, x1, y + 0.009, [146, 146, 144]);
    }
  };
  const winState = (pClear) => {
    const r = R();
    return r < pClear ? null : r < pClear + 0.25 ? { k: 'curtain' } : r < pClear + 0.38 ? { k: 'sheer' }
      : r < pClear + 0.58 ? { k: 'blind', f: 0.15 + R() * 0.75 } : { k: 'venetian', f: 0.2 + R() * 0.8 };
  };
  // a roller shutter (persiana) let down from the head of the opening
  const persiana = (x0, y0, x1, y1, f, col) => {
    if (f <= 0) return;
    const yb = y1 - (y1 - y0) * f;
    box(x0, yb, x1, y1, col, MAT.trim);
    for (let y = yb; y < y1; y += 0.045) box(x0, y, x1, y + 0.011, dim(col, 0.7));
    if (f < 1) box(x0, yb, x1, yb + 0.025, dim(col, 0.55));
  };
  // an opening: panes, roller shutter, frame and glazing bars, the shade inside the reveal, a sill and its streaks
  const opening = (cx, y0, w, h, o) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, y1 = y0 + h, f = o.frame || 0.055, fc = o.fcol || [234, 231, 224], cols = o.cols || 2;
    const st = o.st === undefined ? winState(0.3) : o.st;
    for (let i = 0; i < cols; i++) pane(x0 + w * i / cols, y0, x0 + w * (i + 1) / cols, y1, st);
    if (o.shut) persiana(x0, y0, x1, y1, o.shut.f, o.shut.col);
    box(x0, y0, x0 + f, y1, fc, MAT.trim); box(x1 - f, y0, x1, y1, fc, MAT.trim);
    box(x0, y1 - f, x1, y1, fc, MAT.trim); box(x0, y0, x1, y0 + f, fc, MAT.trim);
    for (let i = 1; i < cols; i++) { const x = x0 + w * i / cols; box(x - f * 0.45, y0, x + f * 0.45, y1, fc, MAT.trim); }
    if (o.transom) { const y = y0 + h * o.transom; box(x0, y - f * 0.4, x1, y + f * 0.4, fc, MAT.trim); }
    ramp(x0, y1 - 0.18, x1, y1, 0, 0.5);
    ramp(x0, y0, x0 + 0.08, y1, 0.32, 0, 'h');
    if (o.sill !== false) {
      box(x0 - 0.07, y0 - 0.07, x1 + 0.07, y0, o.scol || [212, 206, 194], MAT.trim);
      ramp(x0 - 0.07, y0 - 0.15, x1 + 0.07, y0 - 0.07, 0, 0.3);
      streaks(x0, x1, y0 - 0.15, 1.2, 0.07);
    }
  };
  // an iron railing in front of the lower part of an opening (a French balcony)
  const railing = (x0, x1, y0, y1, col) => {
    box(x0, y1 - 0.045, x1, y1, col, MAT.trim); box(x0, y0, x1, y0 + 0.03, col, MAT.trim);
    for (let x = x0; x <= x1 + 0.001; x += 0.115) box(x - 0.008, y0, x + 0.008, y1, col, MAT.trim);
    box(x0, y0 + (y1 - y0) * 0.22, x1, y0 + (y1 - y0) * 0.22 + 0.02, col, MAT.trim);
  };
  // folding shutters standing open either side of an opening
  const shutters = (x0, x1, y0, y1, col) => {
    const sw = (x1 - x0) / 2;
    for (const [a, b] of [[x0 - sw, x0], [x1, x1 + sw]]) {
      box(a, y0, b, y1, col, MAT.trim);
      for (let y = y0 + 0.06; y < y1 - 0.06; y += 0.05) box(a + 0.04, y, b - 0.04, y + 0.014, dim(col, 0.72));
      ramp(a, y0, b, y1, 0.12, 0, 'h');
    }
  };
  const BAYS = [FAC_W / 4, FAC_W * 3 / 4];

  // ---- upper floors ----
  // brick: plain sashes under a stone lintel
  for (let v = 0; v < 3; v++) layer('brickU', 3, 101, v, () => {
    bricks(0, 3, [150, 84, 62], 28, 0.075);
    for (const cx of BAYS) {
      box(cx - 0.74, 2.55, cx + 0.74, 2.76, [214, 204, 186], MAT.trim);
      ramp(cx - 0.74, 2.55, cx + 0.74, 2.6, 0.25, 0);
      opening(cx, 0.95, 1.22, 1.6, { cols: 2, transom: 0.7, scol: [206, 198, 182] });
    }
  });
  // plaster (the Buenos Aires walk-up): French windows with a moulded surround, a hood, a railing and wooden persianas
  for (let v = 0; v < 3; v++) layer('plasterU', 3, 102, v, () => {
    render(0, 3, [230, 226, 218], 1);
    box(0, 0, FAC_W, 0.17, [238, 235, 229]); ramp(0, -0.02, FAC_W, 0.05, 0.25, 0); ramp(0, 0.17, FAC_W, 0.25, 0.18, 0);
    const pc = [126, 94, 62];
    for (const cx of BAYS) {
      box(cx - 0.7, 0.26, cx + 0.7, 2.74, [240, 237, 231]);
      ramp(cx + 0.62, 0.26, cx + 0.7, 2.74, 0, 0.18, 'h');
      box(cx - 0.84, 2.74, cx + 0.84, 2.87, [243, 240, 234]); ramp(cx - 0.84, 2.62, cx + 0.84, 2.74, 0, 0.28);
      const r = R();
      opening(cx, 0.3, 1.12, 2.28, { cols: 2, transom: 0.78, sill: false, shut: { f: r < 0.3 ? 0 : r < 0.55 ? 1 : 0.2 + R() * 0.6, col: jit(pc, 0.1) } });
      railing(cx - 0.62, cx + 0.62, 0.3, 1.25, [44, 44, 46]);
    }
  });
  // office: ribbon windows between concrete spandrels, venetian blinds at every height
  for (let v = 0; v < 3; v++) layer('officeU', 3, 103, v, () => {
    render(0, 3, [216, 212, 204], 0.6);
    for (let y = 0.12; y < 0.9; y += 0.13) box(0, y, FAC_W, y + 0.012, [196, 192, 184]);
    ramp(0, 0.75, FAC_W, 0.92, 0, 0.2);
    for (let i = 0; i < 6; i++) {
      const x0 = i * 1.1, x1 = x0 + 1.1, r = R();
      pane(x0, 0.92, x1, 2.74, r < 0.3 ? null : r < 0.85 ? { k: 'venetian', f: 0.1 + R() * 0.9 } : { k: 'blind', f: R() });
      box(x0, 0.92, x0 + 0.05, 2.74, [178, 180, 184], MAT.trim);
    }
    box(0, 0.88, FAC_W, 0.95, [160, 162, 166], MAT.trim); box(0, 2.71, FAC_W, 2.76, [178, 180, 184], MAT.trim);
    ramp(0, 2.56, FAC_W, 2.71, 0, 0.35);
    streaks(0, FAC_W, 0.88, 0.7, 0.06);
  });
  // curtain wall: tinted vision glass over darker spandrel glass, a mullion every 1.65 m
  for (let v = 0; v < 3; v++) layer('glassU', 3, 104, v, () => {
    box(0, 0, FAC_W, 0.92, [86, 90, 96], MAT.tglass);
    for (let i = 0; i < 4; i++) {
      const x0 = i * 1.65, r = R();
      box(x0, 0.92, x0 + 1.65, 3, jit([128, 134, 140], 0.12), MAT.tglass);
      ramp(x0, 0.92, x0 + 1.65, 3, 0, 0.06, 'v', true);
      if (r < 0.35) { const yb = 3 - 2.08 * (0.2 + R() * 0.8); box(x0, yb, x0 + 1.65, 3, [168, 170, 172], MAT.tglass); box(x0, yb, x0 + 1.65, yb + 0.02, [120, 122, 124], MAT.tglass); }
      box(x0 - 0.035, 0, x0 + 0.035, 3, [92, 96, 102], MAT.trim); box(x0 + 1.615, 0, x0 + 1.685, 3, [92, 96, 102], MAT.trim);
    }
    box(0, 0, FAC_W, 0.07, [92, 96, 102], MAT.trim); box(0, 0.9, FAC_W, 0.95, [92, 96, 102], MAT.trim);
  });
  // classic: ashlar between pilasters, tall windows under pediments, iron balconettes, grey shutters
  for (let v = 0; v < 3; v++) layer('classicU', 3, 105, v, () => {
    const st = [226, 219, 204];
    render(0, 3, st, 0.8);
    for (let r = 0, y = 0; y < 3; r++, y += 0.5) {
      box(0, y, FAC_W, y + 0.014, [200, 192, 176]);
      for (let x = (r % 2) * 0.55; x < FAC_W; x += 1.1) box(x, y, x + 0.012, y + 0.5, [204, 196, 180]);
    }
    for (const px of [0, FAC_W / 2, FAC_W]) {
      box(px - 0.26, 0, px + 0.26, 3, [236, 231, 219], MAT.wall);
      ramp(px + 0.26, 0, px + 0.36, 3, 0.22, 0, 'h');
    }
    for (const cx of BAYS) {
      box(cx - 0.72, 0.5, cx + 0.72, 2.7, [236, 231, 219]);
      ramp(cx - 0.72, 0.5, cx - 0.66, 2.7, 0.15, 0, 'h');
      box(cx - 0.9, 2.7, cx + 0.9, 2.86, [240, 236, 226], MAT.trim);
      ramp(cx - 0.9, 2.58, cx + 0.9, 2.7, 0, 0.3);
      const r = R();
      opening(cx, 0.6, 1.16, 2.0, { cols: 2, transom: 0.76, sill: false, fcol: [226, 222, 214], shut: { f: r < 0.5 ? 0 : r < 0.7 ? 1 : 0.3 + R() * 0.5, col: [150, 152, 148] } });
      railing(cx - 0.7, cx + 0.7, 0.55, 1.45, [36, 38, 40]);
      box(cx - 0.82, 0.48, cx + 0.82, 0.58, [232, 227, 215], MAT.trim);
      ramp(cx - 0.82, 0.36, cx + 0.82, 0.48, 0, 0.25);
    }
  });

  // ---- party walls (medianeras) and the parapets of their style ----
  layer('brickP', 3, 111, 0, () => {
    bricks(0, 3, [144, 82, 62], 28, 0.075);
    for (let i = 0; i < 3; i++) { const w = 0.6 + R() * 1.6, h = 0.3 + R() * 1, x = R() * (FAC_W - w), y = R() * (3 - h); box(x, y, x + w, y + h, jit([168, 160, 150], 0.1)); }
    streaks(0, FAC_W, 3, 2.5, 0.06);
  });
  layer('renderP', 3, 112, 0, () => {
    render(0, 3, [206, 202, 194], 2.2);
    for (let i = 0; i < 4; i++) { const w = 0.5 + R() * 1.5, h = 0.3 + R() * 0.9, x = R() * (FAC_W - w), y = R() * (3 - h); box(x, y, x + w, y + h, jit([196, 192, 186], 0.08)); }
    streaks(0, FAC_W, 3, 2.8, 0.08);
  });
  layer('concreteP', 3, 113, 0, () => {
    render(0, 3, [208, 204, 196], 1.5);
    for (const x of [0, 1.65, 3.3, 4.95]) { box(x, 0, x + 0.02, 3, [150, 148, 144]); streaks(x - 0.1, x + 0.1, 3, 2.5, 0.1); }
    box(0, 1.5, FAC_W, 1.52, [150, 148, 144]); box(0, 0, FAC_W, 0.02, [150, 148, 144]);
  });

  // ---- ground floors (in pool order: brick, rusticated base, shops, lobbies) ----
  // brick: a garage door or a front door, barred windows, a granite plinth and a stone band on top
  for (let v = 0; v < 2; v++) layer('brickG', 4, 121, v, () => {
    bricks(0, 4, [146, 82, 60], 28, 0.077);
    box(0, 3.62, FAC_W, 4, [212, 204, 188], MAT.trim); ramp(0, 3.52, FAC_W, 3.62, 0, 0.25);
    box(0, 0, FAC_W, 0.36, [92, 90, 86], MAT.trim);
    const door = (cx, col) => {
      box(cx - 0.55, 0.12, cx + 0.55, 2.4, col, MAT.trim);
      for (const y of [0.3, 1.3]) { box(cx - 0.42, y, cx + 0.42, y + 0.85, dim(col, 0.86), MAT.trim); }
      box(cx - 0.62, 2.4, cx + 0.62, 2.6, [212, 204, 188], MAT.trim);
      ramp(cx - 0.55, 2.2, cx + 0.55, 2.4, 0, 0.4); box(cx + 0.3, 1.1, cx + 0.36, 1.16, [200, 180, 120], MAT.trim);
    };
    const barred = cx => {
      opening(cx, 1.1, 1.0, 1.25, { cols: 2, st: winState(0.4) });
      for (let x = cx - 0.45; x <= cx + 0.46; x += 0.11) box(x - 0.008, 1.1, x + 0.008, 2.35, [40, 40, 42], MAT.trim);
    };
    if (v === 0) {
      box(0.4, 0.12, 3.0, 2.6, [150, 152, 154], MAT.trim);
      for (let y = 0.12; y < 2.6; y += 0.09) box(0.4, y, 3.0, y + 0.02, [116, 118, 120]);
      box(0.3, 2.6, 3.1, 2.75, [72, 72, 74], MAT.trim); ramp(0.4, 2.35, 3.0, 2.6, 0, 0.35);
      door(4.2, [104, 74, 50]); barred(5.7);
    } else { barred(BAYS[0] - 0.4); door(FAC_W / 2 + 0.4, [64, 70, 60]); barred(BAYS[1] + 0.4); }
  });
  // rusticated stone base: arched openings with fanlights and keystones, deep horizontal joints
  for (let v = 0; v < 2; v++) layer('base', 4, 122, v, () => {
    render(0, 4, [222, 214, 198], 0.8);
    for (let y = 0.45; y < 3.6; y += 0.45) { box(0, y, FAC_W, y + 0.045, [150, 144, 132]); box(0, y - 0.025, FAC_W, y, [238, 232, 220]); }
    box(0, 3.62, FAC_W, 4, [236, 230, 218], MAT.trim); ramp(0, 3.5, FAC_W, 3.62, 0, 0.3);
    const arched = (cx, y0, w, door) => {
      const x0 = cx - w / 2, x1 = cx + w / 2, ys = 2.55;
      arch(x0 - 0.12, y0, x1 + 0.12, ys, [236, 230, 218], MAT.trim);
      if (door) {
        arch(x0, y0, x1, ys, [84, 58, 40], MAT.trim);
        for (const a of [x0 + 0.08, cx + 0.04]) for (const y of [y0 + 0.15, y0 + 1.15]) box(a, y, a + w / 2 - 0.12, y + 0.85, [70, 48, 33], MAT.trim);
        arch(x0 + 0.06, ys, x1 - 0.06, ys + 0.02, [30, 34, 40], MAT.glass);
      } else {
        arch(x0, y0, x1, ys, [30, 34, 40], MAT.glass);
        const s = winState(0.4); if (s) pane(x0, y0, x1, ys - 0.1, s);
        box(cx - 0.03, y0, cx + 0.03, ys + w / 2, [70, 66, 60], MAT.trim);
        box(x0, ys - 0.03, x1, ys + 0.03, [70, 66, 60], MAT.trim);
        for (let x = x0 + 0.06; x < x1; x += 0.1) box(x - 0.008, y0, x + 0.008, y0 + 0.9, [40, 40, 42], MAT.trim);
      }
      ramp(x0, ys - 0.4, x1, ys + w / 2, 0, 0.35);
      box(cx - 0.1, ys + w / 2 - 0.05, cx + 0.1, ys + w / 2 + 0.22, [242, 238, 228], MAT.trim);
    };
    if (v === 0) { arched(BAYS[0], 0.6, 1.4); arched(BAYS[1], 0.6, 1.4); }
    else { arched(BAYS[0], 0.14, 1.5, true); arched(BAYS[1], 0.6, 1.4); }
    box(0, 0, FAC_W, 0.14, [150, 146, 138], MAT.trim);
  });
  // shops: a lit sign over each front, a dark frame, displays with shelves and stock, now and then a shutter down
  let shopN = 0;
  for (let v = 0; v < 8; v++) layer('shop', 4, 123, v, () => {
    render(0, 4, [222, 217, 208], 1);
    box(0, 3.66, FAC_W, 3.76, [236, 232, 224]); ramp(0, 3.56, FAC_W, 3.66, 0, 0.25);
    const two = v % 2 === 1, fronts = two ? [[0.22, 3.2], [3.4, FAC_W - 0.22]] : [[0.22, FAC_W - 0.22]];
    for (const [x0, x1] of fronts) {
      const [bg, fg] = SIGNS[(shopN * 5 + 3) % SIGNS.length], name = SHOPS[(shopN * 7 + 2) % SHOPS.length]; shopN++;
      // the sign: a lightbox board with its name
      box(x0, 2.96, x1, 3.58, bg, MAT.glass);
      box(x0, 2.96, x1, 3.0, dim(bg, 0.6), MAT.glass); box(x0, 3.54, x1, 3.58, dim(bg, 0.6), MAT.glass);
      let fs = 0.4 * H / fh; g.font = `700 ${fs | 0}px ${FONT}`;
      const tw = g.measureText(name).width, mw = (x1 - x0) * 0.84 * sx;
      if (tw > mw) { fs *= mw / tw; g.font = `700 ${fs | 0}px ${FONT}`; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = css(fg); g.fillText(name, X((x0 + x1) / 2), Y(3.27));
      // the front: plinth, display glass, a door at one end; the frame dark, aluminium, painted or varnished
      const fc = pick([[40, 42, 46], [168, 170, 174], [222, 220, 212], [36, 70, 52], [92, 34, 36], [104, 72, 46]], R);
      box(x0, 0, x1, 2.96, fc, MAT.trim);
      box(x0, 0, x1, 0.32, [70, 68, 66], MAT.trim);
      const shut = R() < 0.13, dl = R() < 0.5, dx0 = dl ? x0 + 0.1 : x1 - 1.05, dx1 = dx0 + 0.95;
      const gx0 = dl ? dx1 + 0.08 : x0 + 0.1, gx1 = dl ? x1 - 0.1 : dx0 - 0.08;
      // inside: a lit back wall, shelves, things on them
      box(gx0, 0.42, gx1, 2.8, jit([92, 86, 78], 0.2), MAT.glass);
      ramp(gx0, 0.42, gx1, 2.8, 0.06, 0.16, 'v', true);
      ramp(gx0, 0.42, gx1, 1.2, 0.35, 0);
      for (let y = 0.8; y < 2.6; y += 0.42) {
        box(gx0, y, gx1, y + 0.03, [90, 84, 76], MAT.glass);
        for (let x = gx0 + 0.05; x < gx1 - 0.1; x += 0.08 + R() * 0.12) if (R() < 0.7) box(x, y + 0.03, x + 0.05 + R() * 0.08, y + 0.08 + R() * 0.2, jit(pick(FABRIC.concat(SIGNS.map(s => s[0])), R), 0.3), MAT.glass);
      }
      for (let x = gx0 + 1.1; x < gx1 - 0.3; x += 1.1) box(x - 0.025, 0.42, x + 0.025, 2.8, fc, MAT.trim);
      box(dx0, 0.04, dx1, 2.8, fc, MAT.trim); box(dx0 + 0.08, 0.12, dx1 - 0.08, 2.7, [70, 66, 60], MAT.glass);
      box(dx0 + 0.06, 1.1, dx0 + 0.1, 1.5, [190, 190, 186], MAT.trim);
      if (shut) {
        // a roller shutter down over the display, and a tag on it
        const sc = [150, 152, 154];
        box(gx0 - 0.04, 0.32, gx1 + 0.04, 2.84, sc, MAT.trim);
        for (let y = 0.32; y < 2.84; y += 0.08) box(gx0 - 0.04, y, gx1 + 0.04, y + 0.018, dim(sc, 0.74));
        if (R() < 0.5) {
          g.strokeStyle = css(pick([[30, 30, 34], [180, 40, 50], [40, 90, 160]], R)); g.lineWidth = 3; g.beginPath();
          let x = gx0 + 0.3 + R() * 0.5, y = 1.2 + R() * 0.6; g.moveTo(X(x), Y(y));
          for (let i = 0; i < 7; i++) { x += 0.12 + R() * 0.15; g.quadraticCurveTo(X(x - 0.1), Y(y + (R() - 0.3) * 0.7), X(x), Y(y + (R() - 0.5) * 0.3)); }
          g.stroke();
        }
      }
    }
    if (two) { box(3.2, 0, 3.4, 3.62, [228, 223, 214]); ramp(3.34, 0, 3.4, 3.62, 0, 0.2, 'h'); }
    for (const x of [0, FAC_W - 0.22]) box(x, 0, x + 0.22, 3.62, [228, 223, 214]);
    ramp(0.16, 0, 0.22, 3.62, 0, 0.2, 'h');
    ramp(0, 2.86, FAC_W, 2.96, 0, 0.3);
  });
  // lobby: full-height tinted glass, a revolving door or a pair of doors, a canopy
  for (let v = 0; v < 2; v++) layer('lobby', 4, 124, v, () => {
    box(0, 0, FAC_W, 3.3, [86, 84, 80], MAT.glass);
    ramp(0, 0, FAC_W, 3.1, 0.16, 0.04, 'v', true);
    box(0, 2.6, FAC_W, 2.95, [120, 116, 108], MAT.glass);
    box(0, 3.3, FAC_W, 4, [86, 90, 96], MAT.tglass);
    for (let x = 0; x <= FAC_W; x += 1.1) box(x - 0.03, 0, x + 0.03, 4, [70, 74, 80], MAT.trim);
    box(0, 2.95, FAC_W, 3.0, [70, 74, 80], MAT.trim); box(0, 0, FAC_W, 0.1, [70, 74, 80], MAT.trim);
    box(0, 3.06, FAC_W, 3.3, [56, 58, 62], MAT.trim); ramp(0, 2.86, FAC_W, 3.06, 0, 0.35);
    if (v === 0) {
      const cx = FAC_W / 2;
      for (const d of [-1, 1]) { const a = cx + d * 0.04, b = cx + d * 1.0; box(Math.min(a, b), 0.1, Math.max(a, b), 2.6, [80, 82, 84], MAT.glass); }
      box(cx - 1.0, 0.1, cx - 0.96, 2.6, [190, 192, 196], MAT.trim); box(cx + 0.96, 0.1, cx + 1.0, 2.6, [190, 192, 196], MAT.trim);
      box(cx - 0.3, 1.0, cx - 0.1, 1.04, [210, 212, 214], MAT.trim); box(cx + 0.1, 1.0, cx + 0.3, 1.04, [210, 212, 214], MAT.trim);
    } else {
      box(0.2, 0, 2.0, 2.95, [196, 190, 180], MAT.trim);
      for (let y = 0.6; y < 2.9; y += 0.6) box(0.2, y, 2.0, y + 0.012, [150, 146, 140]);
    }
  });

  // ---- sidewalk paving (2.4 × 1.2 m: 40 cm tiles with nine panes each) ----
  // a detail texture about mid grey (188, linear 0.5: no change); its alpha is how proud the surface is (wet sheen)
  {
    fh = 1.2; sx = W / 2.4; R = C.rng(131);
    g.fillStyle = 'rgb(140,140,140)'; g.fillRect(0, 0, W, H);
    m.fillStyle = 'rgb(30,30,30)'; m.fillRect(0, 0, W, H);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) {
      const x0 = i * 0.4 + 0.004, y0 = j * 0.4 + 0.004, x1 = x0 + 0.392, y1 = y0 + 0.392;
      let c = 188 * (1 + (R() - 0.5) * 0.06); if (R() < 0.08) c *= 0.9 + R() * 0.2;
      box(x0, y0, x1, y1, [c, c, c * 0.98], 230);
      for (let k = 1; k < 3; k++) { box(x0 + k * 0.13 - 0.003, y0, x0 + k * 0.13 + 0.003, y1, [c * 0.9, c * 0.9, c * 0.88], 170); box(x0, y0 + k * 0.13 - 0.003, x1, y0 + k * 0.13 + 0.003, [c * 0.9, c * 0.9, c * 0.88], 170); }
      if (R() < 0.1) { g.strokeStyle = 'rgba(70,70,70,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(x0 + R() * 0.4), Y(y0)); g.lineTo(X(x0 + R() * 0.4), Y(y0 + 0.2)); g.lineTo(X(x0 + R() * 0.4), Y(y1)); g.stroke(); }
    }
    const a = g.getImageData(0, 0, W, H).data, b = m.getImageData(0, 0, W, H).data, d = new Uint8Array(W * H * 4);
    for (let i = 0; i < d.length; i += 4) { const k = 1 + (R() - 0.5) * 0.06; d[i] = a[i] * k; d[i + 1] = a[i + 1] * k; d[i + 2] = a[i + 2] * k; d[i + 3] = b[i]; }
    at.pave = layers.length; layers.push(d);
  }
  const data = new Uint8Array(W * H * 4 * layers.length);
  layers.forEach((d, i) => data.set(d, i * W * H * 4));
  return facadeData = { data, w: W, h: H, n: layers.length, at };
}

// ---------- city ----------
// Building styles: f is the front's entry in the facade table (its party wall is f + 1), tints (sRGB) colour the walls
// (or, on a curtain wall, the glass), ledge is the cornice (depth, height; lc its colour, else the wall's) and par
// the parapet over the roof.
const CITY_STYLES = [
  { f: 2, tints: ['#ffffff', '#f4ebe4', '#e9e0da', '#fbf3ea', '#e0dad6', '#f0e2d4'], ledge: [0.22, 0.24], lc: '#d6ccbb', par: 0.8 }, // brick
  { f: 4, tints: ['#efe4cf', '#e3c79c', '#d7ab8c', '#c5cfb9', '#cbd3dc', '#f2efe8', '#e2cfb0', '#d9c2c2'], ledge: [0.38, 0.3], par: 0.9 }, // plaster
  { f: 6, tints: ['#e6e1d8', '#d2cdc4', '#ebe5d9', '#c4c1bb'], lc: '#b9b7b1', par: 1.0 }, // office
  { f: 8, tints: ['#a9c3d6', '#a8c9bf', '#c4b29b', '#b4bcc4', '#97b1cc'], lc: '#4d5157', par: 1.2 }, // curtain wall
  { f: 10, tints: ['#f1e8d6', '#e6dac2', '#ddd5c8', '#f4ede0'], ledge: [0.5, 0.36], par: 1.1 }, // classic stone
];
// the style of a building with n floors over the ground floor
const styleFor = (n, r) => n <= 4 ? (r < 0.45 ? 0 : r < 0.9 ? 1 : 4) : n <= 9 ? (r < 0.1 ? 0 : r < 0.5 ? 1 : r < 0.72 ? 4 : 2) : (r < 0.1 ? 1 : r < 0.55 ? 2 : 3);
// u_fac: per entry (first upper-floor layer, variants, first ground-floor layer, variants); entry 1 is the paving.
// The ground-floor pools overlap: brick, rusticated base, shops and lobbies lie in that order in the array.
function facTable(L) {
  const a = L.at, f = new Float32Array(64), set = (i, u, nu, gr, ng) => f.set([u, nu, gr, ng], i * 4);
  set(1, a.pave, 1, a.pave, 1);
  set(2, a.brickU, 3, a.brickG, 8); set(3, a.brickP, 1, a.brickP, 1);
  set(4, a.plasterU, 3, a.base, 10); set(5, a.renderP, 1, a.renderP, 1);
  set(6, a.officeU, 3, a.shop, 10); set(7, a.concreteP, 1, a.concreteP, 1);
  set(8, a.glassU, 3, a.lobby, 2); set(9, a.glassU, 3, a.glassU, 3);
  set(10, a.classicU, 3, a.base, 4); set(11, a.renderP, 1, a.renderP, 1);
  return f;
}
// Every block of the grid: a raised slab of paved sidewalk with quarter-circle kerb corners, and a continuous row of
// buildings standing on its building line: a corner building on each corner with its ochava, deep lots in between,
// the odd tower. Walls carry their style and tile count in uv.x and their number of upper floors and a seed in uv.y
// (LIT_FS mode 12); fronts get a cornice, every wall a parapet. One mesh with a chunk per block, so a view only draws
// the blocks it can see.
function cityMesh(W) {
  const P = W.O.city, V = visOf(W.st), B = P.B, X = C.CITY_X, k = X.kerb, F = B / 2 - k - X.walk, oc = X.ochava;
  const walkC = lin(V.walk), kerbC = lin(V.kerb), roofC = lin(V.roof), S = B / 2 - k, r = P.kr, ys = X.slab;
  const p = [], nn = [], cc = [], uu = [], chunks = [];
  const [bi0, bi1, bj0, bj1] = P.blocks;
  // quarter turns of the canonical side (facade along v = +F, facing +v)
  const rot = (q, u, v) => q === 0 ? [u, v] : q === 1 ? [-v, u] : q === 2 ? [-u, -v] : [v, -u];
  for (let bj = bj0; bj <= bj1; bj++) for (let bi = bi0; bi <= bi1; bi++) {
    const g = new Geo(), R = C.rng(W.st.seed * 31 + (bi + 500) * 7919 + (bj + 500) * 104729);
    const cu = (bi + 0.5) * B, cv = (bj + 0.5) * B;
    const w = (u, v, y) => { const q = C.cityW(P, cu + u, cv + v); return [q[0], y, q[1]]; };
    // sidewalk slab: outline, kerb face, a paved top (uv: style 1 and metres of the block, so the tiles line up with it)
    const ring = [];
    [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]].forEach(([su, sv, q]) => {
      for (let a = 0; a <= 6; a++) { const th = (q + a / 6) * Math.PI / 2; ring.push([su * (S - r) + Math.cos(th) * r, sv * (S - r) + Math.sin(th) * r]); }
    });
    const mid = w(0, 0, ys), pv = (u, v) => [96 + u / 2.4, v / 1.2];
    for (let q = 0; q < ring.length; q++) {
      const a = ring[q], b = ring[(q + 1) % ring.length];
      g.tri(mid, w(a[0], a[1], ys), w(b[0], b[1], ys), walkC, 0.03, [mid[0], ys - 10, mid[2]], pv(0, 0), pv(a[0], a[1]), pv(b[0], b[1]));
      g.quad(w(a[0], a[1], -0.1), w(b[0], b[1], -0.1), w(b[0], b[1], ys), w(a[0], a[1], ys), kerbC, 0.05, [mid[0], 0, mid[2]]);
    }
    // buildings: a footprint (block coordinates, convex) pushed up to height h; kinds says which walls are drawn and
    // as what ('front', 'back': windows; 'party': a blank medianera)
    const tall = R() < 0.25 ? 1.6 : 1;
    const floors = () => { const x = R(); return Math.round((x < 0.55 ? 2 + R() * 3 : x < 0.88 ? 5 + R() * 5 : 10 + R() * 9) * tall); };
    const bldg = (fp, h, kinds) => {
      const nUp = Math.round((h - 4) / 3), sty = CITY_STYLES[styleFor(nUp, R())], n = fp.length;
      const tint = scalec(lin(sty.tints[(R() * sty.tints.length) | 0]), 0.92 + R() * 0.12), sd = nUp + 0.05 + R() * 0.9, top = h + sty.par;
      const lc = sty.lc ? scalec(lin(sty.lc), 0.94 + R() * 0.1) : scalec(tint, 1.05);
      let mu = 0, mv = 0; for (const [u, v] of fp) { mu += u; mv += v; } mu /= n; mv /= n;
      const E = fp.map(([u0, v0], q) => {
        const [u1, v1] = fp[(q + 1) % n], l = Math.hypot(u1 - u0, v1 - v0);
        let nu = (v1 - v0) / l, nv = -(u1 - u0) / l;
        if (((u0 + u1) / 2 - mu) * nu + ((v0 + v1) / 2 - mv) * nv < 0) { nu = -nu; nv = -nv; }
        return { u0, v0, u1, v1, l, nu, nv, du: (u1 - u0) / l, dv: (v1 - v0) / l, kind: kinds[q] };
      });
      const ref = w(mu, mv, h / 2);
      for (const e of E) {
        const mu2 = (e.u0 + e.u1) / 2, mv2 = (e.v0 + e.v1) / 2;
        if (e.kind) {
          // the wall, up through the parapet; u counts tiles from left to right as seen from the street
          const code = (e.kind === 'party' ? sty.f + 1 : sty.f) * 64, nt = Math.max(1, Math.round(e.l / FAC_W));
          const a = w(e.u0, e.v0, 0), b = w(e.u1, e.v1, 0), o = w(e.u0 + e.nu, e.v0 + e.nv, 0);
          const lr = (b[0] - a[0]) * (o[2] - a[2]) - (b[2] - a[2]) * (o[0] - a[0]) > 0;
          const ua = code + (lr ? 0 : nt), ub = code + (lr ? nt : 0);
          g.quad(w(e.u0, e.v0, -0.3), w(e.u1, e.v1, -0.3), w(e.u1, e.v1, top), w(e.u0, e.v0, top), tint, 0.04, ref, [[ua, sd], [ub, sd], [ub, sd], [ua, sd]]);
        }
        // the parapet's coping and its inner face (only ever seen from above)
        const iu0 = e.u0 - e.nu * 0.25, iv0 = e.v0 - e.nv * 0.25, iu1 = e.u1 - e.nu * 0.25, iv1 = e.v1 - e.nv * 0.25;
        g.quad(w(e.u0, e.v0, top), w(e.u1, e.v1, top), w(iu1, iv1, top), w(iu0, iv0, top), lc, 0.03, w(mu2, mv2, top - 10));
        g.quad(w(iu0, iv0, h), w(iu1, iv1, h), w(iu1, iv1, top), w(iu0, iv0, top), scalec(tint, 0.8), 0.03, w(mu2 + e.nu * 5, mv2 + e.nv * 5, h));
      }
      const rc = w(mu, mv, h), rf = scalec(roofC, 0.85 + R() * 0.3);
      for (let q = 0; q < n; q++) { const [ua, va] = fp[q], [ub, vb] = fp[(q + 1) % n]; g.tri(rc, w(ua, va, h), w(ub, vb, h), rf, 0.02, [rc[0], h - 10, rc[2]]); }
      if (!sty.ledge) return;
      // the cornice along the fronts: mitred where two fronts meet, cut square (with a cap) where a front ends
      const [d, lh] = sty.ledge, y0 = h - lh * 0.6, y1 = h + lh * 0.4, ym = (y0 + y1) / 2;
      const miter = (e1, e2) => { const k2 = d / (1 + e1.nu * e2.nu + e1.nv * e2.nv); return [e2.u0 + (e1.nu + e2.nu) * k2, e2.v0 + (e1.nv + e2.nv) * k2]; };
      E.forEach((e, q) => {
        if (e.kind !== 'front') return;
        const pe = E[(q + n - 1) % n], ne = E[(q + 1) % n];
        const s = pe.kind === 'front' ? miter(pe, e) : [e.u0 + e.nu * d, e.v0 + e.nv * d];
        const t = ne.kind === 'front' ? miter(e, ne) : [e.u1 + e.nu * d, e.v1 + e.nv * d];
        const cu2 = (e.u0 + e.u1) / 2, cv2 = (e.v0 + e.v1) / 2;
        g.quad(w(s[0], s[1], y0), w(t[0], t[1], y0), w(t[0], t[1], y1), w(s[0], s[1], y1), lc, 0.04, w(cu2 - e.nu, cv2 - e.nv, ym));
        g.quad(w(e.u0, e.v0, y0), w(e.u1, e.v1, y0), w(t[0], t[1], y0), w(s[0], s[1], y0), lc, 0.04, w(cu2 + e.nu * d / 2, cv2 + e.nv * d / 2, y0 + 1));
        g.quad(w(e.u0, e.v0, y1), w(e.u1, e.v1, y1), w(t[0], t[1], y1), w(s[0], s[1], y1), lc, 0.04, w(cu2 + e.nu * d / 2, cv2 + e.nv * d / 2, y1 - 1));
        if (pe.kind !== 'front') g.quad(w(e.u0, e.v0, y0), w(s[0], s[1], y0), w(s[0], s[1], y1), w(e.u0, e.v0, y1), lc, 0.04, w(e.u0 + e.du + e.nu * d / 2, e.v0 + e.dv + e.nv * d / 2, ym));
        if (ne.kind !== 'front') g.quad(w(e.u1, e.v1, y0), w(t[0], t[1], y0), w(t[0], t[1], y1), w(e.u1, e.v1, y1), lc, 0.04, w(e.u1 - e.du + e.nu * d / 2, e.v1 - e.dv + e.nv * d / 2, ym));
      });
    };
    const cw = [0, 1, 2, 3].map(() => 11 + R() * 5), ch = cw.map(() => 4 + floors() * 3);
    for (let q = 0; q < 4; q++) {
      // the corner building at this side's right-hand end, cut back at 45°
      const c = cw[q], hc = ch[q];
      bldg([[F - c, F - c], [F, F - c], [F, F - oc], [F - oc, F], [F - c, F]].map(([u, v]) => rot(q, u, v)), hc, ['party', 'front', 'front', 'front', 'party']);
      // the lots along the side, each wall drawn only where it can be seen
      const u0 = -F + cw[(q + 1) % 4], u1 = F - c, lots = [];
      for (let u = u0; u < u1 - 0.5;) { let wd = 7 + R() * 10; if (u1 - (u + wd) < 6) wd = u1 - u; lots.push([u, u + wd]); u += wd; }
      const hs = lots.map(() => 4 + floors() * 3), ds = lots.map(() => 14 + R() * 12);
      lots.forEach(([a, b], i) => {
        const h = hs[i], dp = ds[i];
        const hl = i ? hs[i - 1] : ch[(q + 1) % 4], hr = i < lots.length - 1 ? hs[i + 1] : hc;
        // footprint: front-right, front-left, back-left, back-right (facade, left side, back, right side)
        bldg([[b, F], [a, F], [a, F - dp], [b, F - dp]].map(([u, v]) => rot(q, u, v)), h, ['front', h > hl && 'party', h > 12 && 'back', h > hr && 'party']);
      });
    }
    const v0 = p.length / 3;
    p.push(...g.p); nn.push(...g.n); cc.push(...g.c); uu.push(...g.u);
    const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = 0; i < g.p.length; i += 3) for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], g.p[i + a]); box[a + 3] = Math.max(box[a + 3], g.p[i + a]); }
    chunks.push({ first: v0, count: g.p.length / 3, box });
  }
  const idx = new Uint32Array(p.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
  return { p: new Float32Array(p), n: new Float32Array(nn), c: new Float32Array(cc), u: new Float32Array(uu), idx, chunks };
}
// ---------- city street furniture ----------
const FURN = lin('#3a403f');
// a street lamp, its arm reaching out over the road along +z; the lens under the head is a mesh of its own (lit at night)
function lampGeo() {
  const g = new Geo();
  g.cyl(0, 0, 0, 0.16, 0.12, 0.55, 10, FURN, 0.15, 'y', true);
  g.cyl(0, 0.55, 0, 0.085, 0.06, 7.1, 10, FURN, 0.15, 'y', true);
  g.box(0, 7.6, 0.72, 0.07, 0.07, 1.45, FURN, 0.15);
  g.box(0, 7.53, 1.55, 0.34, 0.15, 0.64, FURN, 0.2);
  return smoothGeo(g, 40);
}
function lampLensGeo() { const g = new Geo(); g.box(0, 7.448, 1.55, 0.26, 0.02, 0.52, [1, 0.94, 0.82], 0); return g; }
// traffic lights: a pole, and a head per street facing +z (its amber lens apart, to flash)
function signalPoleGeo() { const g = new Geo(); g.cyl(0, 0, 0, 0.09, 0.07, 3.7, 10, FURN, 0.15, 'y', true); return smoothGeo(g, 40); }
function signalHeadGeo() {
  const g = new Geo(), body = lin('#1c1e1f');
  g.box(0, 3.0, 0.13, 0.08, 0.08, 0.14, FURN, 0.15);
  g.box(0, 3.0, 0.31, 0.32, 0.98, 0.24, body, 0.2);
  for (const y of [3.31, 3.0, 2.69]) g.box(0, y + 0.12, 0.48, 0.26, 0.025, 0.1, body, 0.2);
  g.box(0, 3.31, 0.435, 0.2, 0.2, 0.012, lin('#3a0d0b'), 0.6);
  g.box(0, 2.69, 0.435, 0.2, 0.2, 0.012, lin('#0b2a1a'), 0.6);
  return g;
}
function signalLensGeo() { const g = new Geo(); g.box(0, 3.0, 0.437, 0.2, 0.2, 0.012, [1, 0.62, 0.12], 0); return g; }
// paint and pits: zebra crossings over the streets out of every junction of the route (on the road or on the side
// street's asphalt) and a square of soil round each street tree, drawn just over what they lie on
function cityDecals(W) {
  const { O, T, TR } = W, g = new Geo(), R = C.rng(4242), paint = lin('#e4e2da'), soil = lin('#3d342a'), rim = lin('#9a958a');
  for (const zb of O.zebras) {
    const i = C.nearest(T, zb.x, zb.z, 60), y = zb.road && i >= 0 ? T.Y[i] + 0.012 : C.terrainH(TR, zb.x, zb.z) + 0.015;
    const fx = Math.sin(zb.rot), fz = Math.cos(zb.rot);
    const P = (a, b) => [zb.x + fx * a + fz * b, y, zb.z + fz * a - fx * b];
    for (let l = -T.hw + 0.75; l <= T.hw - 0.7; l += 1.0) g.quad(P(-1.5, l - 0.25), P(1.5, l - 0.25), P(1.5, l + 0.25), P(-1.5, l + 0.25), scalec(paint, 0.8 + R() * 0.25), 0.08, [zb.x, y - 5, zb.z]);
  }
  const y = C.CITY_X.slab + 0.008;
  for (const p of O.pits) {
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot), P = (a, b) => [p.x + fx * a + fz * b, y, p.z + fz * a - fx * b], ref = [p.x, y - 5, p.z];
    g.quad(P(-0.55, -0.55), P(0.55, -0.55), P(0.55, 0.55), P(-0.55, 0.55), scalec(soil, 0.85 + R() * 0.3), 0, ref);
    for (const [a0, b0, a1, b1] of [[-0.62, -0.62, 0.62, -0.55], [-0.62, 0.55, 0.62, 0.62], [-0.62, -0.55, -0.55, 0.55], [0.55, -0.55, 0.62, 0.55]])
      g.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), rim, 0.03, ref);
  }
  return g;
}
// water-filled barriers across the closed streets: two-metre sections, red and white
function barrierGeo(list) {
  const g = new Geo(), red = lin('#c8302c'), white = lin('#e8e6e0');
  for (const [x0, z0, x1, z1] of list) {
    const len = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / len, tz = (z1 - z0) / len, nx = -tz, nz = tx, n = Math.round(len / 2.05);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.04) * len / n, b = (i + 0.96) * len / n, col = i % 2 ? white : red;
      const P = (s, l, y) => [x0 + tx * s + nx * l, y, z0 + tz * s + nz * l];
      const y0 = -0.06, y1 = 0.95, lo = 0.3, hi = 0.14, ref = P((a + b) / 2, 0, 0.4);
      g.quad(P(a, -lo, y0), P(b, -lo, y0), P(b, -hi, y1), P(a, -hi, y1), col, 0.12, ref);
      g.quad(P(a, lo, y0), P(b, lo, y0), P(b, hi, y1), P(a, hi, y1), col, 0.12, ref);
      g.quad(P(a, -hi, y1), P(b, -hi, y1), P(b, hi, y1), P(a, hi, y1), col, 0.12, ref);
      g.quad(P(a, -lo, y0), P(a, -hi, y1), P(a, hi, y1), P(a, lo, y0), col, 0.12, ref);
      g.quad(P(b, -lo, y0), P(b, -hi, y1), P(b, hi, y1), P(b, lo, y0), col, 0.12, ref);
    }
  }
  return g;
}

// ---------- build stage scene ----------
const LOD_NEAR = 130, LOD_MID = 280;
function buildScene(R, W) {
  const { T, O, st } = W; const V = visOf(st);
  const S = { meshes: [], shadowCasters: [], E: env(st), V };
  const add = (m, o, cast) => { S.meshes.push({ m, o }); if (cast) S.shadowCasters.push({ m, model: o && o.model }); return m; };
  const t0 = performance.now();
  const gtex = R.texture(groundDetailCanvas(st), { repeat: true, linear: true });
  add(R.mesh(terrainMesh(W)), { mode: 9, tex: gtex });
  const rm = roadMeshes(W);
  S.road = add(R.mesh(rm.road), { mode: 1, tex: !V.lines && !V.icy ? R.texture(gravelTex(), { repeat: true, linear: true }) : undefined });
  for (const s of rm.sides) add(R.mesh(s), { mode: 9, tex: gtex });
  if (rm.banks) for (const b of rm.banks) add(R.mesh(b), { mode: 9, tex: gtex }, false);
  S.timing = { terrain: performance.now() - t0 };
  // trees and props: chunked so the views can skip what they can't see; past the fog they are invisible anyway
  const cull = { cell: 48, cullDist: S.E.fog[1] + 40 };
  const rot = o => o.rot;
  if (O.trees.length) {
    const pines = O.trees.filter(t => t.type !== 1), birches = O.trees.filter(t => t.type === 1);
    const pc = pines.length && V.pine.map(lin), ptex = pines.length && R.texture(treeAtlas());
    // per tree: one of three shapes (the old-growth ones for type 3), a little brighter or darker, and a slight drift
    // towards yellow or blue
    const hh = (o, k) => { const v = Math.sin(o.x * 12.9898 + o.z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    for (let vi = 0; vi < PINE_SHAPES.length; vi++) {
      const set = pines.filter(o => (o.type === 3 ? TALL : 0) + Math.min(2, (hh(o, 0) * 3) | 0) === vi);
      if (!set.length) continue;
      const pineInst = instData(set, o => {
        const c = pc[(o.c * 3) | 0], k = (st.kind === 'frost' ? 3.6 : 3.0) * (0.84 + hh(o, 1) * 0.3), hu = (hh(o, 2) - 0.5) * 0.18;
        return [o.x, o.y, o.z, o.rot, o.s, o.sy, 0, 0, c[0] * k * (1 + hu), c[1] * k, c[2] * k * (1 - hu * 1.4)];
      });
      const pg = R.mesh(pineGeo(V, st.kind === 'frost', vi), pineInst, cull);
      // full trees to ~100 m, the lighter version to ~230 m, solid skirts beyond (in the haze by then), each swap a
      // dissolve over a band. The sprays are alpha-tested and the depth pass isn't: shadows come from the skirts.
      // the old trees have about twice the sprays; past ~95 m the lighter version can't be told from them
      pg.lods = [{ m: pg, dist: vi >= TALL ? LOD_NEAR - 35 : LOD_NEAR, band: 18 }, { m: R.mesh(pineGeo(V, st.kind === 'frost', vi, true), pineInst, cull), dist: LOD_MID, band: 30 }, { m: R.mesh(pineFarGeo(V, st.kind === 'frost', vi), pineInst, cull) }];
      // a 25 m tree sways about as far as a young one at the top, not three times as far
      add(pg, { mode: 10, sway: vi >= TALL ? 0.4 : 1, tex: ptex, a2c: true }, true);
    }
    if (birches.length) {
      const bc = V.birch.map(lin);
      const binst = instData(birches, o => { const c = bc[(o.c * 3) | 0]; return [o.x, o.y, o.z, o.rot, o.s, o.sy, 0, 0, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6]; });
      const bg = R.mesh(birchGeo(V), binst, cull);
      bg.lods = [{ m: bg, dist: LOD_NEAR + 20, band: 22 }, { m: R.mesh(birchFarGeo(V), binst, cull) }];
      add(bg, { mode: 10, sway: 1, tex: R.texture(leafAtlas()), a2c: true }, true);
    }
  }
  if (O.rocks.length) {
    const rc = lin(V.rock);
    const rg = R.mesh(rockGeo(), instData(O.rocks, o => { const k = 0.75 + o.c * 0.5; return [o.x, o.y, o.z, o.rot, o.s, o.sy, 0, 0, rc[0] * k, rc[1] * k, rc[2] * k]; }), cull);
    add(rg, { mode: 3 }, true);
  }
  if (O.cacti.length) {
    const cc = V.cactus.map(lin);
    const tall = O.cacti.filter(c => c.type === 0), low = O.cacti.filter(c => c.type === 1);
    add(R.mesh(cactusGeo(), instData(tall, o => { const c = cc[(o.c * 3) | 0]; return [o.x, o.y, o.z, o.rot, o.s, o.sy, 0, 0, c[0], c[1], c[2]]; }), cull), { mode: 8 }, true);
    const sc = lin('#7d7a4a');
    add(R.mesh(shrubGeo(), instData(low, o => { const k = 0.7 + o.c * 0.6; return [o.x, o.y, o.z, o.rot, o.s * 1.2, o.sy * 0.8, 0, 0, sc[0] * k, sc[1] * k, sc[2] * k]; }), cull), { mode: 8 }, true);
  }
  if (O.city) {
    const fl = facadeLayers();
    S.city = add(R.mesh(cityMesh(W), null, { cullDist: S.E.fog[1] + 60 }), { mode: 12, arr: R.textureArray(fl), fac: facTable(fl) }, true);
    if (O.barriers.length) add(R.mesh(barrierGeo(O.barriers)), { mode: 0 }, true);
    const one = o => [o.x, o.y, o.z, o.rot, 1, 1, 0, 0, 1, 1, 1];
    const li = instData(O.lamps, one), heads = instData(O.signals.flatMap(s => s.heads.map(rot => ({ x: s.x, y: s.y, z: s.z, rot }))), one);
    add(R.mesh(lampGeo(), li, cull), { mode: 0 }, true);
    // lamp lenses glow at night; the amber of the traffic lights flashes (game.js sets S.amber.tint)
    add(R.mesh(lampLensGeo(), li, cull), { mode: 4, tint: S.E.night ? [3.2, 2.7, 1.9] : [0.42, 0.42, 0.42] });
    // at night they light the street: game.js hands the nearest of these heads to the shader
    if (S.E.night) S.lamps = O.lamps.map(o => [o.x + Math.sin(o.rot) * 1.55, o.y + 7.3, o.z + Math.cos(o.rot) * 1.55]);
    add(R.mesh(signalPoleGeo(), instData(O.signals, o => [o.x, o.y, o.z, 0, 1, 1, 0, 0, 1, 1, 1]), cull), { mode: 0 }, true);
    add(R.mesh(signalHeadGeo(), heads, cull), { mode: 0 }, true);
    S.amber = { mode: 4, tint: [0.1, 0.06, 0.01] };
    add(R.mesh(signalLensGeo(), heads, cull), S.amber);
    add(R.mesh(cityDecals(W)), { mode: 0, decal: true });
  }
  if (O.hay.length) add(R.mesh(hayGeo(), instData(O.hay, o => [o.x, o.y, o.z, o.rot, 1, 1, 0, 0, 1, 1, 1])), { mode: 8 }, true);
  // ground cover
  const tufts = placeTufts(W);
  // tufts fade out by folFade[1], so nothing past that needs drawing
  if (tufts.length) { S.tufts = add(R.mesh(tuftGeo(), tufts, { cell: 24, cullDist: S.E.folFade[1] + 8 }), { mode: 7, sway: 2, tex: R.texture(tuftAtlas(st.kind)), a2c: true }); S.tuftCount = tufts.length / 11; }
  // chevrons
  const chL = O.chevrons.filter(c => c.dir > 0), chR = O.chevrons.filter(c => c.dir < 0);
  const cg = chevronGeo();
  if (chL.length) add(R.mesh(cg, instData(chL, o => [o.x, o.y, o.z, o.rot, 1, 1, 0, 0, 1, 1, 1])), { mode: 2, tex: R.texture(chevronCanvas(-1)) }, true);
  if (chR.length) add(R.mesh(cg, instData(chR, o => [o.x, o.y, o.z, o.rot, 1, 1, 0, 0, 1, 1, 1])), { mode: 2, tex: R.texture(chevronCanvas(1)) }, true);
  // spectators (dynamic)
  const shirts = ['#d8262e', '#1f5fbf', '#f2c230', '#f4f4f0', '#2f9e55', '#f07a1c', '#7a3fb0', '#1a1a1a', '#e85d9f', '#22a6b3', '#b3d334', '#c7c2b8'].map(lin);
  S.fans = O.fans.map(f => ({ ...f, col: shirts[f.c % shirts.length], jump: 0 }));
  S.fanData = new Float32Array(S.fans.length * 11);
  const writeFans = (time, carX, carZ) => {
    S.fans.forEach((f, i) => {
      const d = Math.hypot(f.x - carX, f.z - carZ);
      const ex = d < 45 ? 1 : 0;
      f.jump += (ex - f.jump) * 0.08;
      const hop = f.jump * Math.max(0, Math.sin(time * 9 + f.ph)) * 0.35;
      S.fanData.set([f.x, f.y + hop, f.z, f.rot, 1, f.h, 0, 0, f.col[0], f.col[1], f.col[2]], i * 11);
    });
  };
  writeFans(0, 1e5, 1e5);
  S.fanMesh = R.mesh(fanGeo(), S.fanData);
  S.updateFans = (time, x, z) => { writeFans(time, x, z); R.setInstances(S.fanMesh, S.fanData); };
  add(S.fanMesh, { mode: 0 }, true);
  // arches: start, splits, finish
  const placeArch = (s, text, bg, fg, sub, pillar) => {
    const p = C.sampleAt(T, s);
    const model = GFX.M4.trs(new Float32Array(16), p.x, p.y, p.z, p.h, 0, 0, 1);
    add(R.mesh(archGeo(T.hw * 2 + 2.4, lin(pillar))), { mode: 0, model }, true);
    const tex = R.texture(bannerCanvas(text, bg, fg, sub));
    add(R.mesh(bannerQuadGeo(T.hw * 2 + 1.2, 4.5, 5.4, -0.64)), { mode: 2, tex, model }, false);
  };
  placeArch(T.startS, 'STAGE START', '#14171c', '#ffd23a', st.name.toUpperCase() + ' · ' + st.surface.toUpperCase(), '#22262d');
  placeArch(T.splits[0], 'SPLIT 1', '#f3f1ea', '#14171c', null, '#2b2f36');
  placeArch(T.splits[1], 'SPLIT 2', '#f3f1ea', '#14171c', null, '#2b2f36');
  placeArch(T.finishS, 'FLYING FINISH', '#ffd23a', '#14171c', null, '#22262d');
  // sponsor boards near start and finish
  const ads = [['SIDEWAYS TYRES', '#14171c', '#ffd23a'], ['TORQUE COLA', '#c8202a', '#ffffff'], ['MUDFLAP ENERGY', '#1f5fbf', '#ffffff'], ['GRAVEL & CO.', '#f3f1ea', '#14171c']];
  const bgeo = boardGeo();
  const boards = [];
  const addBoard = (s, side, k) => {
    const p = C.sampleAt(T, s); const rx = -Math.cos(p.h) * side, rz = Math.sin(p.h) * side;
    const x = p.x + rx * (T.hw + 3.2), z = p.z + rz * (T.hw + 3.2);
    boards.push({ x, z, y: C.terrainH(W.TR, x, z), rot: p.h + (side > 0 ? Math.PI / 2 : -Math.PI / 2), k });
  };
  [40, 60, T.finishS - 30, T.finishS + 15].forEach((s, i) => { addBoard(s, 1, i % 4); addBoard(s + 8, -1, (i + 1) % 4); });
  for (let k = 0; k < 4; k++) {
    const list = boards.filter(b => b.k === k); if (!list.length) continue;
    add(R.mesh(bgeo, instData(list, o => [o.x, o.y, o.z, o.rot, 1, 1, 0, 0, 1, 1, 1])), { mode: 2, tex: R.texture(boardCanvas(...ads[k])) }, true);
  }
  // far scenery
  const fg = farGeo(W);
  S.far = add(R.mesh(fg), { mode: 0, farFog: true }); S.farY = fg.my;
  S.timing.total = performance.now() - t0;
  return S;
}

function buildCar(R, spec, night) { return CARMODEL.buildCar(R, spec, night); }

return { VIS, visOf, env, buildScene, buildCar };
})();
