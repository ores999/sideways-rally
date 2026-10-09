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
    grass: ['#46612a', '#5a7334', '#354d21', '#77804a'], verge: '#86735a', rock: '#7a766d', dirt: '#6a5840',
    pine: ['#2c4a25', '#365a2b', '#22401e'], trunk: '#5a4330', birch: ['#5f8a34', '#7a9c40', '#94a64a'],
    dust: [0.42, 0.34, 0.24], mark: [0.12, 0.09, 0.06, 0.45], far: '#5f7f86', skirt: '#4b6230',
    grade: { lift: [0.0, 0.012, 0.02], gain: [1.03, 1.0, 0.955], sat: 1.07, con: 0.12, vig: 0.24, bloom: 0.07, thr: 1.1 },
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
};

function env(st) {
  const V = VIS[st.id];
  const el = V.sunEl * Math.PI / 180, az = V.sunAz * Math.PI / 180;
  return {
    V,
    sunDir: [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)],
    sunCol: scalec(lin(V.sunCol), V.sunI), sky: scalec(lin(V.sky), V.skyI), gnd: scalec(lin(V.gnd), V.gndI),
    fogCol: lin(V.fogCol), fog: V.fog.slice(), zen: lin(V.zen), glow: lin(V.glow), sunDisc: lin(V.sunDisc), cloudCol: lin(V.cloudCol), clouds: V.clouds, stars: V.stars || 0,
    exp: V.exp, r1: lin(V.road[0]), r2: lin(V.road[1]), r3: lin(V.road[2]), lines: V.lines, icy: V.icy, time: 0, shadows: true,
    grade: V.grade, folFade: [70, 105], verge: lin(V.verge), tt: V.tt,
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
  const { TR, T, st, nz } = W; const V = VIS[st.id];
  const nx = TR.nx, nzc = TR.nz, cell = TR.cell, H = TR.H;
  const n = nx * nzc;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 4);
  const pal = st.kind === 'pine' ? V.grass.map(lin) : st.kind === 'frost' ? V.snow.map(lin) : V.sand.map(lin);
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
    if (st.kind === 'pine') {
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n3 * 0.6); c = mixc(c, pal[3], Math.max(0, n2 - 0.6) * 1.6);
      c = mixc(c, rock, C.sstep(0.18, 0.4, slope));
      c = mixc(c, verge, (1 - C.sstep(hw + 1.5, hw + 5, d)) * 0.85);
    } else if (st.kind === 'frost') {
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n2 * 0.5);
      c = mixc(c, rock, C.sstep(0.32, 0.6, slope) * 0.85);
      c = mixc(c, verge, (1 - C.sstep(hw + 2, hw + 6, d)) * 0.6);
    } else {
      c = mixc(pal[0], pal[1], n1); c = mixc(c, pal[2], n3 * 0.7); c = mixc(c, pal[3], Math.max(0, n2 - 0.55) * 1.4);
      const band = Math.floor((y + nz.n2(x / 50, z / 50) * 1.5) / 3.2);
      const sc = strata[((band % 4) + 4) % 4];
      c = mixc(c, sc, C.sstep(0.12, 0.35, slope));
      c = mixc(c, verge, (1 - C.sstep(hw + 1.5, hw + 4, d)) * 0.7);
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
    for (const t of O.trees || []) shade(t.x, t.z, 5.5 * (t.s || 1), st.kind === 'frost' ? 0.22 : 0.3);
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
  const { T, TR, st } = W; const V = VIS[st.id];
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
  for (const side of [-1, 1]) {
    const P2 = [], C2 = [];
    for (let i = 0; i < n; i++) {
      const h = T.H[i], rx = -Math.cos(h) * side, rz = Math.sin(h) * side;
      const ex = T.X[i] + rx * hw, ez = T.Z[i] + rz * hw;
      const ox = T.X[i] + rx * (hw + 1.6), oz = T.Z[i] + rz * (hw + 1.6);
      const oy = C.terrainH(TR, ox, oz) + 0.03;
      const mx = (ex + ox) / 2, mz = (ez + oz) / 2, my = (T.Y[i] + oy) / 2 + 0.02;
      P2.push([ex, T.Y[i] - 0.005, ez], [mx, my, mz], [ox, oy, oz]);
      // the outer edge takes the colour of the ground it lands on, so the strip no longer ends in a ruled line
      const tc = W.TC; let oc = verge;
      if (tc) { const ci = Math.max(0, Math.min(tc.nx - 1, Math.round((ox - tc.x0) / tc.cell))), cj = Math.max(0, Math.min(tc.nz - 1, Math.round((oz - tc.z0) / tc.cell))), k = (cj * tc.nx + ci) * 4; oc = [tc.col[k], tc.col[k + 1], tc.col[k + 2]]; }
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
// three pine shapes so a forest isn't one tree cloned: the classic four tiers, a slimmer spruce with five, and an
// older tree, broad at the foot with a sparse top. Each tier is turned a little against the one below, so the
// facets don't line up into ridges. [radius, height, base] per tier.
const PINE_TIERS = [
  [[1.75, 3.0, 1.2], [1.4, 2.7, 2.6], [1.0, 2.4, 3.9], [0.6, 1.9, 5.0]],
  [[1.5, 2.6, 1.0], [1.28, 2.4, 2.2], [1.05, 2.2, 3.3], [0.8, 2.0, 4.3], [0.5, 1.7, 5.2]],
  [[2.0, 2.6, 1.4], [1.5, 2.5, 2.9], [0.95, 2.3, 4.2], [0.45, 1.6, 5.6]],
];
function turnNew(g, from, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = from; i < g.p.length; i += 3) {
    const x = g.p[i], z = g.p[i + 2]; g.p[i] = x * c - z * s; g.p[i + 2] = x * s + z * c;
    const nx = g.n[i], nz = g.n[i + 2]; g.n[i] = nx * c - nz * s; g.n[i + 2] = nx * s + nz * c;
  }
}
function pineGeo(V, snowy, variant) {
  const g = new Geo();
  const trunk = lin(V.trunk), green = [1, 1, 1];
  g.cyl(0, -0.3, 0, 0.2, 0.12, 2.4, 6, trunk, 0, 'y', false, -1);
  PINE_TIERS[variant || 0].forEach(([r, h, y], k) => {
    const from = g.p.length;
    g.cyl(0, y, 0, r, 0, h, 7, green, 0, 'y', true, 0, scalec(green, 0.6));
    if (snowy) g.cyl(0, y + h * 0.42, 0, r * 0.62, 0, h * 0.58, 7, lin('#f4f7fc'), 0.1, 'y', false, -1);
    turnNew(g, from, k * 0.47);
  });
  // self-shading: the canopy darkens towards the trunk and the bottom tiers, tips catch the light
  for (let i = 0, v = 0; i < g.p.length; i += 3, v += 4) {
    const y = g.p[i + 1], r = Math.hypot(g.p[i], g.p[i + 2]);
    if (y < 1.1 && r < 0.3) continue; // trunk
    const k = (0.62 + 0.38 * C.sstep(0.8, 7.2, y)) * (0.8 + 0.2 * Math.min(1, r / 1.2 + (y > 6 ? 1 : 0)));
    g.c[v] *= k; g.c[v + 1] *= k; g.c[v + 2] *= k;
  }
  return g;
}
// distant pine: same tiers and colours as pineGeo, but bare cones (5 sides, no undersides) and a stub trunk,
// about a quarter of the vertices. Drawn past ~80 m where the difference is lost in the haze.
function pineFarGeo(V, snowy, variant) {
  const g = new Geo();
  g.cyl(0, -0.3, 0, 0.2, 0.12, 2.4, 3, lin(V.trunk), 0, 'y', false, -1);
  const layers = PINE_TIERS[variant || 0], N = 5;
  for (const [r, h, y] of layers) {
    const cone = (rr, y0, hh, col) => { for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2 + y, a1 = (i + 1) / N * Math.PI * 2 + y;
      g.tri([Math.cos(a0) * rr, y0, Math.sin(a0) * rr], [Math.cos(a1) * rr, y0, Math.sin(a1) * rr], [0, y0 + hh, 0], col, 0, [0, y0 - 40, 0], [0, 0], [0, 0], [0, 0]); } };
    cone(r, y, h, [1, 1, 1]);
    if (snowy) cone(r * 0.62, y + h * 0.42, h * 0.58, lin('#f4f7fc'));
  }
  for (let i = 0, v = 0; i < g.p.length; i += 3, v += 4) {
    const yy = g.p[i + 1], rr = Math.hypot(g.p[i], g.p[i + 2]);
    if (yy < 1.1 && rr < 0.3) continue;
    const k = (0.62 + 0.38 * C.sstep(0.8, 7.2, yy)) * (0.8 + 0.2 * Math.min(1, rr / 1.2 + (yy > 6 ? 1 : 0)));
    g.c[v] *= k; g.c[v + 1] *= k; g.c[v + 2] *= k;
  }
  return g;
}
function birchGeo(V) {
  const g = new Geo(); const R = C.rng(9);
  g.cyl(0, -0.3, 0, 0.15, 0.1, 5.0, 6, lin('#e9e6dc'), 0, 'y', false, -1);
  for (let i = 0; i < 3; i++) g.rock((R() - 0.5) * 1.2, 4.2 + i * 0.9, (R() - 0.5) * 1.2, 1.5 - i * 0.25, [1, 1, 1], R, false);
  return g;
}
function cactusGeo() {
  const g = new Geo(); const col = [1, 1, 1], sp = 0.02; // spec 0.02 marks cactus in the foliage shader
  g.cyl(0, -0.2, 0, 0.32, 0.28, 4.2, 10, col, sp, 'y', true, 0);
  g.cyl(0, 1.8, 0, 0.2, 0.2, 0.8, 8, col, sp, 'x', true, 0);
  g.cyl(0.75, 1.8, 0, 0.2, 0.18, 1.5, 8, col, sp, 'y', true, 0);
  g.cyl(-0.8, 2.3, 0, 0.18, 0.18, 0.8, 8, col, sp, 'x', true, 0);
  g.cyl(-0.8, 2.3, 0, 0.18, 0.16, 1.2, 8, col, sp, 'y', true, 0);
  return g;
}
function shrubGeo() { const g = new Geo(); g.rock(0, 0.3, 0, 0.8, [1, 1, 1], C.rng(4), true); return g; }
function rockGeo() { const g = new Geo(); g.rock(0, 0.4, 0, 1.0, [1, 1, 1], C.rng(17), true); return g; }
function hayGeo() { const g = new Geo(); g.cyl(-0.65, 0.6, 0, 0.6, 0.6, 1.3, 10, lin('#d9b45a'), 0, 'x', true, 0, lin('#c79d45')); return g; }
function fanGeo() {
  const g = new Geo();
  const jeans = lin('#2b3a55'), skin = lin('#d8a27c'), shirt = [1, 1, 1];
  g.box(0.13, 0.42, 0, 0.17, 0.84, 0.2, jeans, 0, -1);
  g.box(-0.13, 0.42, 0, 0.17, 0.84, 0.2, jeans, 0, -1);
  g.box(0, 1.14, 0, 0.5, 0.62, 0.28, shirt, 0, 0);
  g.box(0.33, 1.42, 0, 0.12, 0.6, 0.12, shirt, 0, 0);
  g.box(-0.33, 1.42, 0, 0.12, 0.6, 0.12, shirt, 0, 0);
  g.box(0, 1.6, 0, 0.24, 0.26, 0.24, skin, 0, -1);
  g.box(0, 1.76, 0, 0.27, 0.07, 0.27, lin('#222222'), 0, -1);
  return g;
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
function archGeo(width, colPillar) {
  const g = new Geo();
  g.box(-width / 2, 2.6, 0, 0.55, 5.4, 0.55, colPillar, 0.2);
  g.box(width / 2, 2.6, 0, 0.55, 5.4, 0.55, colPillar, 0.2);
  g.box(0, 4.95, 0, width + 0.6, 1.25, 0.3, colPillar, 0.1);
  return g;
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
    grass(0, 46, 90, 230, '#24401a', '#7aa043');
    grass(128, 34, 80, 190, '#2a4a1d', '#86aa4c'); dots(128, 9, ['#f3e46a', '#ffffff', '#f6d24a'], 70, 150, 4.5);
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
  const V = VIS[st.id];
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
  const { T, st } = W; const V = VIS[st.id];
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
      const N = 18, el = kind === 'mesa' ? 0.35 + R() * 0.35 : R() * 0.15, th = R() * Math.PI;
      const st4 = (V.strata || ['#a5502e', '#c46a3c', '#8a3f25', '#d18a57']).map(c => mixc(far, lin(c), 0.55 + R() * 0.2));
      const out = [];
      for (let j = 0; j < N; j++) {
        const a = j / N * Math.PI * 2;
        const rr = (1 + el * Math.cos(2 * (a - th))) * (0.78 + R() * 0.4) * (R() < 0.25 ? 0.74 : 1); // spurs, and the odd bay cut back
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
      const N = 9, M = 4, px = x + (R() - 0.5) * w * 0.35, pz = z + (R() - 0.5) * w * 0.35, base = my - 30;
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
      const shade = (y) => { const t = (y - base) / h; return t > snowAt ? snowC : mixc(mixc(cc, [0, 0, 0], 0.18 * (1 - t)), rockHi, Math.max(0, t - 0.25) * 0.8); };
      for (let j = 0; j < N; j++) { const a = rings[0][j], b = rings[0][(j + 1) % N]; g.tri(top, a, b, shade((top[1] + a[1] + b[1]) / 3), 0, ref); }
      for (let k = 0; k < M - 1; k++) for (let j = 0; j < N; j++) {
        const a = rings[k][j], b = rings[k][(j + 1) % N], c = rings[k + 1][j], d = rings[k + 1][(j + 1) % N];
        g.tri(a, c, b, shade((a[1] + b[1] + c[1]) / 3), 0, ref); g.tri(b, c, d, shade((b[1] + c[1] + d[1]) / 3), 0, ref);
      }
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
  return g;
}

// ---------- build stage scene ----------
function buildScene(R, W) {
  const { T, O, st } = W; const V = VIS[st.id];
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
    const pines = O.trees.filter(t => t.type === 0 || t.type === 2), birches = O.trees.filter(t => t.type === 1);
    const pc = V.pine.map(lin);
    // per tree: one of the three shapes, a little brighter or darker, and a slight drift towards yellow or blue
    const hh = (o, k) => { const v = Math.sin(o.x * 12.9898 + o.z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    for (let vi = 0; vi < PINE_TIERS.length; vi++) {
      const set = pines.filter(o => Math.min(2, (hh(o, 0) * 3) | 0) === vi);
      if (!set.length) continue;
      const pineInst = instData(set, o => {
        const c = pc[(o.c * 3) | 0], k = (st.kind === 'frost' ? 2.4 : 1.9) * (0.84 + hh(o, 1) * 0.3), hu = (hh(o, 2) - 0.5) * 0.18;
        return [o.x, o.y, o.z, o.rot, o.s, o.sy, 0, 0, c[0] * k * (1 + hu), c[1] * k, c[2] * k * (1 - hu * 1.4)];
      });
      const pg = R.mesh(pineGeo(V, st.kind === 'frost', vi), pineInst, cull);
      pg.lod = { m: R.mesh(pineFarGeo(V, st.kind === 'frost', vi), pineInst, cull), dist: 80, shadowDist: 30 };
      add(pg, { mode: 8, sway: 1 }, true);
    }
    if (birches.length) {
      const bc = V.birch.map(lin);
      const bg = R.mesh(birchGeo(V), instData(birches, o => { const c = bc[(o.c * 3) | 0]; return [o.x, o.y, o.z, o.rot, o.s, o.sy, 0, 0, c[0], c[1], c[2]]; }), cull);
      add(bg, { mode: 8, sway: 1 }, true);
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
    add(R.mesh(bannerQuadGeo(T.hw * 2 + 2.0, 4.42, 5.48, -0.17)), { mode: 2, tex, model }, false);
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

return { VIS, env, buildScene, buildCar };
})();
