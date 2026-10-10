// ===================== CAR MODELS: shaped bodies, arches, flares, painted liveries =====================
const CARMODEL = (() => {
'use strict';
const { Geo, lin } = GFX;

// Body dimensions (m). z forward, y up, x = car's left. Ground at y = 0.
const SHAPES = {
  hatch:    { zf: 2.1, zr: -2.08, W: 1.82, nose: 0.6, hoodF: 0.78, hoodB: 0.95, zW: 0.92, belt: 1.0, roof: 1.43, zRoofF: 0.02, zRoofR: -1.52, zRearG: -1.98, tail: 0.98, wbOff: 0.06, archR: 0.44, kind: 'hatch' },
  sedan:    { zf: 2.22, zr: -2.2, W: 1.78, nose: 0.6, hoodF: 0.76, hoodB: 0.92, zW: 0.9, belt: 0.98, roof: 1.41, zRoofF: 0.04, zRoofR: -0.98, zRearG: -1.52, deck: 1.02, tail: 0.98, wbOff: 0.1, archR: 0.43, kind: 'sedan' },
  boxhatch: { zf: 1.98, zr: -1.97, W: 1.78, nose: 0.66, hoodF: 0.84, hoodB: 0.95, zW: 0.88, belt: 1.0, roof: 1.44, zRoofF: 0.24, zRoofR: -1.62, zRearG: -1.93, tail: 0.98, wbOff: 0.05, archR: 0.44, kind: 'hatch', boxy: true, flares: true },
  small:    { zf: 1.92, zr: -1.93, W: 1.78, nose: 0.6, hoodF: 0.76, hoodB: 0.9, zW: 0.78, belt: 0.96, roof: 1.38, zRoofF: 0.0, zRoofR: -1.38, zRearG: -1.9, tail: 0.95, wbOff: 0.0, archR: 0.44, kind: 'hatch', flares: true, scoop: true },
  liftback: { zf: 2.18, zr: -2.14, W: 1.78, nose: 0.55, hoodF: 0.73, hoodB: 0.89, zW: 0.6, belt: 0.95, roof: 1.33, zRoofF: -0.12, zRoofR: -1.02, zRearG: -1.96, tail: 0.98, wbOff: 0.12, archR: 0.43, kind: 'fastback' },
  coupe:    { zf: 2.15, zr: -2.1, W: 1.84, nose: 0.56, hoodF: 0.8, hoodB: 0.95, zW: 0.5, belt: 1.0, roof: 1.37, zRoofF: -0.08, zRoofR: -1.12, zRearG: -1.98, tail: 1.02, wbOff: 0.2, archR: 0.45, kind: 'fastback', boxy: true, flares: true },
};
const WR = 0.335;

// ---------- polygon helpers ----------
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function triangulate(p) {
  const idx = p.map((_, i) => i);
  const tris = [];
  const cross = (a, b, c) => (p[b][0] - p[a][0]) * (p[c][1] - p[a][1]) - (p[b][1] - p[a][1]) * (p[c][0] - p[a][0]);
  const inTri = (q, a, b, c) => {
    const s1 = (p[b][0] - p[a][0]) * (q[1] - p[a][1]) - (p[b][1] - p[a][1]) * (q[0] - p[a][0]);
    const s2 = (p[c][0] - p[b][0]) * (q[1] - p[b][1]) - (p[c][1] - p[b][1]) * (q[0] - p[b][0]);
    const s3 = (p[a][0] - p[c][0]) * (q[1] - p[c][1]) - (p[a][1] - p[c][1]) * (q[0] - p[c][0]);
    return s1 > 1e-9 && s2 > 1e-9 && s3 > 1e-9;
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < 4000) {
    let found = false;
    for (let i = 0; i < idx.length; i++) {
      const m = idx.length, a = idx[(i - 1 + m) % m], b = idx[i], c = idx[(i + 1) % m];
      if (cross(a, b, c) <= 1e-10) continue;
      let ok = true;
      for (const q of idx) if (q !== a && q !== b && q !== c && inTri(p[q], a, b, c)) { ok = false; break; }
      if (!ok) continue;
      tris.push([a, b, c]); idx.splice(i, 1); found = true; break;
    }
    if (!found) break;
  }
  if (idx.length === 3) tris.push(idx.slice());
  return tris;
}
function pushTri(g, a, b, c, n, col, spec, ua, ub, uc) {
  for (const v of [a, b, c]) { g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.c.push(col[0], col[1], col[2], spec); }
  g.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
}
const WHITE_UV = [0.995, 0.004];

// Atlas layout (1024 px): right side 0..220, left side 232..452, top view 470..912, extras 920..1024
const AT = { side: 220, rY: 0, lY: 232, tY: 470, tH: 442, ex: 924, px: 232 };
function mkUV(S) {
  const L = 4.4, z0 = -2.2, yTop = 1.05, yb = 0.12;
  return {
    side(side, z, y) {
      const fx = side > 0 ? (2.2 - z) / L : (z - z0) / L;
      const fy = (yTop - y) / (yTop - yb);
      const top = side > 0 ? AT.lY : AT.rY;
      return [fx, 1 - (top + fy * AT.side) / 1024];
    },
    top(x, z) { const fx = (z - z0) / L; const fy = (0.95 - x) / 1.9; return [fx, 1 - (AT.tY + fy * AT.tH) / 1024]; },
  };
}

// side profile with wheel-arch cut-outs, CCW in (z, y)
function bodyProfile(S, wb) {
  const yb = 0.25, R = S.archR, cy = WR;
  const fz = wb / 2 + S.wbOff, rz = -wb / 2 + S.wbOff;
  const top = [];
  top.push([S.zf - 0.1, yb + 0.02]);
  top.push([S.zf + 0.02, yb + 0.18]);
  top.push([S.zf + 0.03, S.nose - 0.06]);
  top.push([S.zf - 0.04, S.nose + 0.05]);
  top.push([S.zf - 0.2, S.hoodF - 0.02]);
  top.push([S.zf - 0.45, S.hoodF + 0.03]);
  if (S.boxy) top.push([(S.zf + S.zW) / 2, (S.hoodF + S.hoodB) / 2 + 0.01]);
  top.push([S.zW, S.hoodB]);
  if (S.kind === 'sedan') {
    top.push([S.zRearG - 0.02, S.belt + 0.02]);
    top.push([S.zr + 0.3, S.deck]);
    top.push([S.zr + 0.06, S.deck - 0.03]);
    top.push([S.zr - 0.01, S.tail - 0.14]);
  } else {
    top.push([S.zRearG + 0.15, S.belt]);
    top.push([S.zr + 0.06, S.tail]);
    top.push([S.zr - 0.01, S.tail - 0.12]);
  }
  top.push([S.zr - 0.02, yb + 0.22]);
  top.push([S.zr + 0.1, yb + 0.02]);
  // bottom from rear to front with arches
  const out = top.map(p => ({ p, arch: false }));
  // reverse orientation later if needed; build bottom
  const th0 = Math.asin((yb - cy) / R);
  const arch = (cz) => { const pts = []; const n = 12; for (let i = 0; i <= n; i++) { const t = Math.PI - th0 - (Math.PI - 2 * th0) * i / n; pts.push({ p: [cz + R * Math.cos(t), cy + R * Math.sin(t)], arch: true }); } return pts; };
  out.push(...arch(rz));
  out.push(...arch(fz));
  return { pts: out, fz, rz };
}

// flat-shaded quad with its normal taken from the geometry, flipped to face `out`
function faceQuad(g, a, b, c, d, out, col, spec, ua, ub, uc, ud) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
  if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) { n = [-n[0], -n[1], -n[2]]; [b, d] = [d, b]; [ub, ud] = [ud, ub]; }
  pushTri(g, a, b, c, n, col, spec, ua, ub, uc);
  pushTri(g, a, c, d, n, col, spec, ua, uc, ud);
}

// Extruded side profile with rounded shoulders: the side panels are inset by `bevel` and joined to the
// perimeter (bonnet, roof line, nose, tail, arch lips) by two chamfer facets, so the body stops reading as a slab.
function extrudeProfile(g, prof, x0, x1, opt, uv) {
  let pts = prof.map(o => o.p);
  const flags = prof.map(o => o.arch);
  if (signedArea(pts) < 0) { pts = pts.slice().reverse(); flags.reverse(); }
  const m = pts.length, bv = opt.bevel || 0;
  // outward edge normals in (z, y) and mitred vertex normals (length-limited so sharp corners don't spike)
  const en = pts.map((A, i) => { const B = pts[(i + 1) % m]; const dz = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dz, dy) || 1; return [dy / l, -dz / l]; });
  const vn = pts.map((_, i) => {
    const a = en[(i - 1 + m) % m], b = en[i]; let nz = a[0] + b[0], ny = a[1] + b[1]; const l = Math.hypot(nz, ny) || 1; nz /= l; ny /= l;
    const k = Math.min(1.6, 1 / Math.max(0.2, nz * b[0] + ny * b[1])); return [nz * k, ny * k];
  });
  // rings across the rounded shoulder: s = how far in from the side face (0 = side panel edge, 1 = perimeter face)
  const RING = [0, 1 / 3, 2 / 3, 1].map(t => { const ph = t * Math.PI / 2; return { dx: bv * (1 - Math.cos(ph)), dn: bv * (1 - Math.sin(ph)) }; });
  const ring = (r, i) => [pts[i][0] - vn[i][0] * RING[r].dn, pts[i][1] - vn[i][1] * RING[r].dn];
  const inset = pts.map((_, i) => ring(0, i));
  const tris = triangulate(inset);
  const white = [1, 1, 1];
  const hx = x1 - bv;
  // caps: +x (left) and -x (right) textured by the side livery
  for (const [a, b, c] of tris) {
    const A = inset[a], B = inset[b], Cc = inset[c];
    pushTri(g, [x1, A[1], A[0]], [x1, B[1], B[0]], [x1, Cc[1], Cc[0]], [1, 0, 0], white, opt.spec, uv.side(1, A[0], A[1]), uv.side(1, B[0], B[1]), uv.side(1, Cc[0], Cc[1]));
    pushTri(g, [x0, A[1], A[0]], [x0, Cc[1], Cc[0]], [x0, B[1], B[0]], [-1, 0, 0], white, opt.spec, uv.side(-1, A[0], A[1]), uv.side(-1, Cc[0], Cc[1]), uv.side(-1, B[0], B[1]));
    // the side panels are a few long ear-clipped triangles: keep them flat (smoothing would streak across them)
    (g.lock || (g.lock = new Set())).add(g.p.length / 9 - 1).add(g.p.length / 9 - 2);
  }
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m, A = pts[i], B = pts[j], n = en[i];
    const isArch = flags[i] && flags[j];
    const col = isArch ? opt.archCol : opt.edgeCol, spec = isArch ? 0 : opt.spec;
    const top = !isArch && n[1] > 0.55 && opt.topTex;
    // perimeter face between the two shoulders
    // split across the width so the body warp (crown, bowed ends) can curve it
    const out = [0, n[1], n[0]], NC = isArch ? 1 : 8;
    for (let c = 0; c < NC; c++) {
      const xa = -hx + 2 * hx * c / NC, xb = -hx + 2 * hx * (c + 1) / NC;
      const a0 = [xa, A[1], A[0]], a1 = [xb, A[1], A[0]], b0 = [xa, B[1], B[0]], b1 = [xb, B[1], B[0]];
      if (top) faceQuad(g, a0, b0, b1, a1, out, white, spec, uv.top(xa, A[0]), uv.top(xa, B[0]), uv.top(xb, B[0]), uv.top(xb, A[0]));
      else faceQuad(g, a0, b0, b1, a1, out, col, spec, WHITE_UV, WHITE_UV, WHITE_UV, WHITE_UV);
    }
    if (!bv) continue;
    // shoulder facets on both sides
    for (const sx of [-1, 1]) {
      for (let r = 0; r < RING.length - 1; r++) {
        const pA0 = ring(r, i), pB0 = ring(r, j), pA1 = ring(r + 1, i), pB1 = ring(r + 1, j);
        const X0 = sx * (x1 - RING[r].dx), X1 = sx * (x1 - RING[r + 1].dx);
        const q = [[X0, pA0[1], pA0[0]], [X0, pB0[1], pB0[0]], [X1, pB1[1], pB1[0]], [X1, pA1[1], pA1[0]]];
        const last = r === RING.length - 2, ph = (r + 0.5) / (RING.length - 1) * Math.PI / 2, fo = [sx * Math.cos(ph), n[1] * Math.sin(ph), n[0] * Math.sin(ph)];
        // the outer facets carry the side livery, the innermost one the top livery (or the plain edge colour)
        if (isArch) faceQuad(g, q[0], q[1], q[2], q[3], fo, !last ? opt.edgeCol : col, !last ? opt.spec : 0, WHITE_UV, WHITE_UV, WHITE_UV, WHITE_UV);
        else if (!last) faceQuad(g, q[0], q[1], q[2], q[3], fo, white, spec, uv.side(sx, pA0[0], pA0[1]), uv.side(sx, pB0[0], pB0[1]), uv.side(sx, pB1[0], pB1[1]), uv.side(sx, pA1[0], pA1[1]));
        else if (top) faceQuad(g, q[0], q[1], q[2], q[3], fo, white, spec, uv.top(X0, pA0[0]), uv.top(X0, pB0[0]), uv.top(X1, pB1[0]), uv.top(X1, pA1[0]));
        else faceQuad(g, q[0], q[1], q[2], q[3], fo, col, spec, WHITE_UV, WHITE_UV, WHITE_UV, WHITE_UV);
      }
    }
  }
}

// generic box with uv to white texel
function box(g, cx, cy, cz, sx, sy, sz, col, spec) {
  const i0 = g.u.length; g.box(cx, cy, cz, sx, sy, sz, col, spec || 0);
  for (let i = i0; i < g.u.length; i += 2) { g.u[i] = WHITE_UV[0]; g.u[i + 1] = WHITE_UV[1]; }
}
function quadUV(g, a, b, c, d, col, spec, ref, uvs) { g.quad(a, b, c, d, col, spec || 0, ref, uvs || [WHITE_UV, WHITE_UV, WHITE_UV, WHITE_UV]); }
function cylUV(g, ...args) { const i0 = g.u.length; g.cyl(...args); for (let i = i0; i < g.u.length; i += 2) { g.u[i] = WHITE_UV[0]; g.u[i + 1] = WHITE_UV[1]; } }

function cabin(g, S, hw, uv, glass, roofTex, gg) {
  const prof = [[S.zW - 0.02, S.hoodB - 0.01], [S.zRoofF, S.roof], [S.zRoofR, S.roof], [S.zRearG, (S.kind === 'sedan' ? S.belt + 0.02 : S.belt) - 0.01]];
  const wB = hw * 0.93, wT = hw * 0.78;
  const wAt = y => wB + (wT - wB) * Math.min(1, Math.max(0, (y - S.belt) / (S.roof - S.belt)));
  const P = (side, q) => [side * wAt(q[1]), q[1], q[0]];
  const gl = [glass[0], glass[1], glass[2]];
  // glass goes into its own mesh (drawn tinted and see-through after the opaque pass)
  for (const side of [-1, 1]) {
    const a = P(side, prof[0]), b = P(side, prof[1]), c = P(side, prof[2]), d = P(side, prof[3]);
    quadUV(gg, a, b, c, d, gl, 0.85, [0, 1.1, -0.5]);
  }
  const L = (q) => P(1, q), Rr = (q) => P(-1, q);
  colStrip(gg, Rr(prof[0]), L(prof[0]), Rr(prof[1]), L(prof[1]), 6, gl, 0.85, [0, 0.8, -1]);
  colStrip(gg, Rr(prof[2]), L(prof[2]), Rr(prof[3]), L(prof[3]), 6, gl, 0.7, [0, 0.8, 0.5]);
  // roof panel (textured top view), a little narrower, with a chamfer down to the top of the side glass
  const wR = wT - 0.05, yR = S.roof + 0.02, zc = (S.zRoofF + S.zRoofR) / 2;
  const r1 = [-wR, yR, S.zRoofF], r2 = [wR, yR, S.zRoofF], r3 = [wR, yR, S.zRoofR], r4 = [-wR, yR, S.zRoofR];
  colStrip(g, r1, r2, r4, r3, 6, [1, 1, 1], 0.55, [0, 0, zc], (t, e) => uv.top(-wR + 2 * wR * t, e ? S.zRoofR : S.zRoofF));
  for (const side of [-1, 1]) quadUV(g, [side * wR, yR, S.zRoofF], [side * wT, S.roof, S.zRoofF], [side * wT, S.roof, S.zRoofR], [side * wR, yR, S.zRoofR], roofTex, 0.55, [0, S.roof - 2, zc]);
  colStrip(g, [-wR, yR, S.zRoofF], [wR, yR, S.zRoofF], [-wT, S.roof, S.zRoofF + 0.03], [wT, S.roof, S.zRoofF + 0.03], 6, roofTex, 0.55, [0, S.roof - 2, zc]);
  colStrip(g, [-wR, yR, S.zRoofR], [wR, yR, S.zRoofR], [-wT, S.roof, S.zRoofR - 0.03], [wT, S.roof, S.zRoofR - 0.03], 6, roofTex, 0.55, [0, S.roof - 2, zc]);
  // pillars (A, B, C) in roof colour, slightly proud of the glass
  const pc = roofTex;
  for (const side of [-1, 1]) {
    const off = side * 0.008;
    const A0 = P(side, prof[0]), A1 = P(side, prof[1]);
    const t = 0.1;
    quadUV(g, [A0[0] + off, A0[1], A0[2]], [A1[0] + off, A1[1], A1[2]], [A1[0] + off, A1[1], A1[2] - t], [A0[0] + off, A0[1], A0[2] - t * 1.6], pc, 0.5, [0, 1, 0]);
    const zb = (S.zRoofF + S.zRoofR) / 2 + 0.1;
    const yb0 = S.belt, B0 = [side * wAt(yb0) + off, yb0, zb], B1 = [side * wAt(S.roof) + off, S.roof, zb + 0.02];
    quadUV(g, B0, [B0[0], B0[1], B0[2] - 0.1], [B1[0], B1[1], B1[2] - 0.1], B1, [0.05, 0.05, 0.05], 0.3, [0, 1, 0]);
    const C0 = P(side, prof[3]), C1 = P(side, prof[2]);
    const cw = S.kind === 'hatch' ? 0.42 : 0.2;
    quadUV(g, [C0[0] + off, C0[1], C0[2]], [C1[0] + off, C1[1], C1[2]], [C1[0] + off, C1[1], C1[2] + cw * 0.6], [C0[0] + off, C0[1], C0[2] + cw], pc, 0.5, [0, 1, 0]);
  }
  // rubber seals: a thin dark band along the bottom and top of each side window
  for (const side of [-1, 1]) {
    for (const [q0, q1, dy] of [[prof[0], prof[3], 0.022], [prof[1], prof[2], -0.022]]) {
      const a = P(side, q0), b = P(side, q1), off = side * 0.004;
      quadUV(g, [a[0] + off, a[1], a[2]], [b[0] + off, b[1], b[2]], [b[0] + off, b[1] + dy, b[2]], [a[0] + off, a[1] + dy, a[2]], [0.015, 0.016, 0.018], 0.35, [0, a[1] + dy * 40, (a[2] + b[2]) / 2]);
    }
  }
  // crew-name stickers along the bottom of the side glass, behind the B-pillar
  const nv0 = 1 - (AT.ex + 52) / 1024, nv1 = 1 - (AT.ex + 98) / 1024;
  const zb2 = (S.zRoofF + S.zRoofR) / 2 + 0.02, len = Math.min(0.62, Math.max(0.3, zb2 - S.zRearG - 0.1));
  for (const side of [-1, 1]) {
    const y0 = S.belt + 0.03, y1 = S.belt + 0.085, x0 = side * (wAt(y0) + 0.006), x1 = side * (wAt(y1) + 0.006);
    const za = zb2 - 0.04, zbb = za - len;
    const uvs = side > 0 ? [[0, nv1], [0.615, nv1], [0.615, nv0], [0, nv0]] : [[0.615, nv1], [0, nv1], [0, nv0], [0.615, nv0]];
    quadUV(g, [x0, y0, za], [x0, y0, zbb], [x1, y1, zbb], [x1, y1, za], [1, 1, 1], 0.3, [0, y0, (za + zbb) / 2], uvs);
  }
  // sunstrip on the windscreen top
  const s0 = 0.82, s1 = 0.97;
  const lerpP = (t) => [prof[0][0] + (prof[1][0] - prof[0][0]) * t, prof[0][1] + (prof[1][1] - prof[0][1]) * t];
  const q0 = lerpP(s0), q1 = lerpP(s1);
  const e = 0.006;
  const sv0 = 1 - (AT.ex + 4) / 1024, sv1 = 1 - (AT.ex + 44) / 1024;
  colStrip(g, [-wAt(q0[1]) * 0.98, q0[1] + e, q0[0] + e], [wAt(q0[1]) * 0.98, q0[1] + e, q0[0] + e], [-wAt(q1[1]) * 0.98, q1[1] + e, q1[0] + e], [wAt(q1[1]) * 0.98, q1[1] + e, q1[0] + e], 6, [1, 1, 1], 0.2, [0, 0, -5],
    (t, ed) => [0.62 * t, ed ? sv0 : sv1]);
}

// fender: a body-colour blister that swells out of the side panel around each arch and ends in a dark lip over the
// tyre. fw = how far it stands proud of the side; it tapers away at both ends into the sill and bumper.
function fender(g, cz, hw, R, fw, col) {
  const cy = WR, yb = 0.27, th0 = Math.asin((yb - cy) / (R + 0.12)), n = 14, lip = [0.025, 0.026, 0.028];
  const ring = (t, u) => {
    const k = fw * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)))); // full width over the wheel, less at the ends
    return { t, k };
  };
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const A = ring(Math.PI - th0 - (Math.PI - 2 * th0) * u0, u0), B = ring(Math.PI - th0 - (Math.PI - 2 * th0) * u1, u1);
    const p = (r, t, x) => [x, cy + r * Math.sin(t), cz + r * Math.cos(t)];
    for (const sx of [-1, 1]) {
      // cross-section from the side panel out: blend, crest, outer face, lip
      const sec = (q) => [
        p(R + 0.2, q.t, sx * (hw - 0.004)),
        p(R + 0.11, q.t, sx * (hw + q.k * 0.75)),
        p(R + 0.04, q.t, sx * (hw + q.k)),
        p(R + 0.005, q.t, sx * (hw + q.k * 0.85)),
        p(R - 0.005, q.t, sx * (hw - 0.03)),
      ];
      const a = sec(A), b = sec(B), ref = [0, cy, cz];
      quadUV(g, a[0], b[0], b[1], a[1], col, 0.5, ref);
      quadUV(g, a[1], b[1], b[2], a[2], col, 0.5, ref);
      quadUV(g, a[2], b[2], b[3], a[3], lip, 0.15, ref);
      quadUV(g, a[3], b[3], b[4], a[4], lip, 0, [sx * (hw + 1), cy + 3, cz]);
    }
  }
}

// convex prism: polygon in (x, z) extruded from y0 to y1 (bumpers with rounded corners, wedge mirrors)
function prism(g, pts, y0, y1, col, spec) {
  const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length, cy = (y0 + y1) / 2;
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length];
    quadUV(g, [A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], col, spec, [cx, cy, cz]);
    g.tri([cx, y1, cz], [A[0], y1, A[1]], [B[0], y1, B[1]], col, spec, [cx, y1 - 5, cz], WHITE_UV, WHITE_UV, WHITE_UV);
    g.tri([cx, y0, cz], [A[0], y0, A[1]], [B[0], y0, B[1]], col, spec, [cx, y0 + 5, cz], WHITE_UV, WHITE_UV, WHITE_UV);
  }
}
// rectangle in plan with rounded corners (arcs) and extra points along the long sides, so the body warp can bow it
function rrect(x0, x1, z0, z1, c) {
  const pts = [], arc = (cx, cz, a0) => { for (let k = 0; k <= 3; k++) { const a = a0 + k / 3 * Math.PI / 2; pts.push([cx + Math.cos(a) * c, cz + Math.sin(a) * c]); } };
  const along = (xa, xb, z) => { for (let k = 1; k < 6; k++) pts.push([xa + (xb - xa) * k / 6, z]); };
  arc(x1 - c, z0 + c, -Math.PI / 2); arc(x1 - c, z1 - c, 0); along(x1 - c, x0 + c, z1); arc(x0 + c, z1 - c, Math.PI / 2); arc(x0 + c, z0 + c, Math.PI); along(x0 + c, x1 - c, z0);
  return pts;
}
// quad strip between edge a0→a1 and edge b0→b1, split into n columns; uvAt(s, edge) gives the uv (or null for plain)
function colStrip(g, a0, a1, b0, b1, n, col, spec, ref, uvAt) {
  const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (let k = 0; k < n; k++) {
    const s0 = k / n, s1 = (k + 1) / n;
    const uvs = uvAt ? [uvAt(s0, 0), uvAt(s1, 0), uvAt(s1, 1), uvAt(s0, 1)] : null;
    quadUV(g, L(a0, a1, s0), L(a0, a1, s1), L(b0, b1, s1), L(b0, b1, s0), col, spec, ref, uvs);
  }
}
// Smooth shading across gentle angles: every vertex takes the average normal of the faces that meet at its
// position within maxDeg of its own face, so crowns, rounded shoulders, cut corners and tyres shade as curves
// while real creases stay sharp. Triangles in g.lock keep their flat normal (but still feed their neighbours).
function smoothNormals(g, maxDeg) {
  const P = g.p, N = g.n, nv = P.length / 3, cosT = Math.cos(maxDeg * Math.PI / 180), lock = g.lock || new Set();
  const F = N.slice(), groups = new Map();
  const q = v => Math.round(v * 2000);
  for (let i = 0; i < nv; i++) { const k = q(P[i * 3]) + ',' + q(P[i * 3 + 1]) + ',' + q(P[i * 3 + 2]); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(i); }
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    for (const i of idx) {
      if (lock.has((i / 3) | 0)) continue;
      let sx = 0, sy = 0, sz = 0;
      for (const j of idx) {
        const d = F[i * 3] * F[j * 3] + F[i * 3 + 1] * F[j * 3 + 1] + F[i * 3 + 2] * F[j * 3 + 2];
        if (d >= cosT) { sx += F[j * 3]; sy += F[j * 3 + 1]; sz += F[j * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz); if (l < 1e-6) continue;
      N[i * 3] = sx / l; N[i * 3 + 1] = sy / l; N[i * 3 + 2] = sz / l;
    }
  }
}

// Body warp, applied to every vertex of the body, glass and lamps after they're built (wheels are separate):
// a crown across the bonnet, roof and boot, front and tail bowed out in plan, and a little tumblehome.
// One smooth field for everything, so lamps, plates and wings stay seated on the panels they belong to.
function warpCar(geos, S) {
  const hw = S.W / 2, crown = 0.05, bowF = 0.055, bowR = 0.07, taper = 0.045, pullF = 0.03, pullR = 0.045;
  const W = (x, y, z) => {
    const u = Math.min(1, Math.abs(x) / hw), cu = 1 - u * u;
    const sst = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const kF = sst(S.zf - 0.75, S.zf, z), kR = sst(S.zr + 0.75, S.zr, z);
    y += crown * cu * sst(0.5, 0.88, y);
    z += (bowF * kF - bowR * kR) * cu;
    // the sides draw in towards the nose and tail, so the corners round off in plan instead of meeting square
    x *= 1 - (pullF * kF + pullR * kR) * u * u;
    x *= 1 - taper * Math.max(0, y - 0.3);
    return [x, y, z];
  };
  for (const g of geos) {
    const P = g.p, N = g.n;
    for (let i = 0; i < P.length; i += 3) { const q = W(P[i], P[i + 1], P[i + 2]); P[i] = q[0]; P[i + 1] = q[1]; P[i + 2] = q[2]; }
    // flat normals again from the warped triangles, kept on the side they faced before
    for (let t = 0; t < P.length; t += 9) {
      const ax = P[t + 3] - P[t], ay = P[t + 4] - P[t + 1], az = P[t + 5] - P[t + 2], bx = P[t + 6] - P[t], by = P[t + 7] - P[t + 1], bz = P[t + 8] - P[t + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz);
      if (l < 1e-10) continue;
      nx /= l; ny /= l; nz /= l;
      if (nx * N[t] + ny * N[t + 1] + nz * N[t + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      for (let v = 0; v < 9; v += 3) { N[t + v] = nx; N[t + v + 1] = ny; N[t + v + 2] = nz; }
    }
  }
}

// The side panels are a few big flat triangles (smoothing streaked across them), so their curvature lives in the
// normals instead: a smooth field that leans the upper side towards the sky and the lower side towards the ground
// (the barrel of a real door) and the ends towards the nose and the tail. Linear in position, so it interpolates
// across the big triangles without streaks; reflections then sweep over the doors like they do on a curved panel.
function curveSides(g) {
  const P = g.p, N = g.n;
  for (const t of g.lock || []) for (let v = 0; v < 3; v++) {
    const i = (t * 3 + v) * 3, sx = Math.sign(N[i]) || 1;
    const ny = Math.max(-0.3, Math.min(0.32, (P[i + 1] - 0.62) * 0.8)), nz = Math.max(-0.085, Math.min(0.085, P[i + 2] * 0.038));
    const l = Math.hypot(1, ny, nz);
    N[i] = sx / l; N[i + 1] = ny / l; N[i + 2] = nz / l;
  }
}
// an ellipsoid (lat/long), optionally cut flat at the back (-z), for mirror housings
function blob(g, cx, cy, cz, rx, ry, rz, col, spec, cutBack) {
  const NA = 10, NB = 6;
  const P = (a, b) => { const x = Math.cos(b) * Math.cos(a), y = Math.sin(b), z = Math.cos(b) * Math.sin(a); return [cx + x * rx, cy + y * ry, cz + Math.max(z, cutBack ? -0.2 : -1) * rz]; };
  for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) {
    const a0 = i / NA * Math.PI * 2, a1 = (i + 1) / NA * Math.PI * 2, b0 = -Math.PI / 2 + j / NB * Math.PI, b1 = -Math.PI / 2 + (j + 1) / NB * Math.PI;
    quadUV(g, P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), col, spec, [cx, cy, cz]);
  }
}
function ellipseQuad(g, cx, cy, z, rx, ry, col, spec) {
  for (let k = 0; k < 12; k++) {
    const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2;
    g.tri([cx, cy, z], [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, z], [cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, z], col, spec, [cx, cy, z + 5], WHITE_UV, WHITE_UV, WHITE_UV);
  }
}
// roof scoop: the intake mouth faces forward at zF, the top slopes down to meet the roof at zB; rounded shoulders
function scoop(g, y0, zF, zB, w, h, col, spec) {
  const sec = (z, k, hh) => { const ww = w / 2 * k; return [[-ww, y0, z], [-ww * 0.92, y0 + hh * 0.75, z], [-ww * 0.6, y0 + hh, z], [ww * 0.6, y0 + hh, z], [ww * 0.92, y0 + hh * 0.75, z], [ww, y0, z]]; };
  const n = 5, ref = [0, y0 - 1, (zF + zB) / 2];
  let prev = sec(zF, 1, h);
  for (let k = 1; k <= n; k++) {
    const t = k / n, cur = sec(zF + (zB - zF) * t, 1 - 0.3 * t, h * (1 - t) * (1 - t * 0.2) + 0.004);
    for (let i = 0; i < prev.length - 1; i++) quadUV(g, prev[i], prev[i + 1], cur[i + 1], cur[i], col, spec, ref);
    prev = cur;
  }
  // the mouth: a dark opening framed by a lip
  const m = sec(zF, 0.82, h * 0.78).map(q => [q[0], q[1] + h * 0.06, zF + 0.004]);
  for (let i = 0; i < m.length - 1; i++) g.tri([0, y0 + h * 0.4, zF + 0.004], m[i], m[i + 1], [0.01, 0.01, 0.012], 0, [0, y0 + h * 0.4, zF - 5], WHITE_UV, WHITE_UV, WHITE_UV);
  const f = sec(zF, 1, h);
  for (let i = 0; i < f.length - 1; i++) g.tri([0, y0, zF], f[i], f[i + 1], col, spec, [0, y0 + h * 0.4, zF - 5], WHITE_UV, WHITE_UV, WHITE_UV);
}

// wing element: an airfoil section (round nose, thin tail, a little camber) across x, trailing edge raised by aoa
function airfoil(g, x0, x1, y, z, chord, thick, aoa, col, spec) {
  const N = 7, up = [], lo = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, ts = t * t, yt = 5 * thick * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * ts + 0.2843 * ts * t - 0.1036 * ts * ts), yc = 0.04 * chord * 4 * t * (1 - t);
    up.push([t * chord, yc + yt]); lo.push([t * chord, yc - yt]);
  }
  const ca = Math.cos(aoa), sa = Math.sin(aoa);
  const pts = up.concat(lo.slice(1, N).reverse()).map(([u, v]) => [z - (u * ca - v * sa) , y + (u * sa + v * ca)]);
  const m = pts.length, cz = pts.reduce((a, q) => a + q[0], 0) / m, cy = pts.reduce((a, q) => a + q[1], 0) / m;
  for (let i = 0; i < m; i++) {
    const A = pts[i], B = pts[(i + 1) % m];
    quadUV(g, [x0, A[1], A[0]], [x1, A[1], A[0]], [x1, B[1], B[0]], [x0, B[1], B[0]], col, spec, [0, cy, cz]);
    for (const x of [x0, x1]) g.tri([x, cy, cz], [x, A[1], A[0]], [x, B[1], B[0]], col, spec, [x - Math.sign(x - (x0 + x1) / 2) * 5, cy, cz], WHITE_UV, WHITE_UV, WHITE_UV);
  }
}
// round tube along z (exhaust tip), open end dark
function tube(g, x, y, z0, z1, r, col, spec) {
  const N = 12;
  for (let k = 0; k < N; k++) {
    const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2;
    const P = (a, z, rr) => [x + Math.cos(a) * rr, y + Math.sin(a) * rr, z];
    quadUV(g, P(a0, z0, r), P(a1, z0, r), P(a1, z1, r), P(a0, z1, r), col, spec, [x, y, (z0 + z1) / 2]);
    quadUV(g, P(a0, z1, r), P(a1, z1, r), P(a1, z1, r * 0.8), P(a0, z1, r * 0.8), col, spec, [x, y, z1 + Math.sign(z1 - z0) * 5]);
    g.tri([x, y, z1 + (z0 - z1) * 0.4], P(a0, z1 + (z0 - z1) * 0.05, r * 0.8), P(a1, z1 + (z0 - z1) * 0.05, r * 0.8), [0.01, 0.01, 0.01], 0, [x, y, z1 + Math.sign(z1 - z0) * 5], WHITE_UV, WHITE_UV, WHITE_UV);
  }
}

// what shows through the glass: tub, dashboard, bucket seats, roll cage, steering wheel and the crew in helmets
function interior(g, S, hw, spec) {
  const tub = [0.03, 0.032, 0.036], seat = [0.035, 0.036, 0.04], cage = lin('#c9ccd2'), acc = lin(spec.col.stripe === '#f2f2ee' ? spec.col.stripe2 || spec.col.base : spec.col.stripe);
  const zF = S.zW - 0.05, zB = S.zRearG + 0.12, yF = S.belt + 0.006, zm = (S.zRoofF + S.zRoofR) / 2;
  const floorY = Math.max(S.hoodB, S.belt) + 0.006;
  quadUV(g, [-hw * 0.9, floorY, zB], [hw * 0.9, floorY, zB], [hw * 0.9, floorY, zF], [-hw * 0.9, floorY, zF], tub, 0, [0, floorY - 3, zm]);
  // dashboard: tucked behind the windscreen (which rises from the bonnet line at zW to the roof at zRoofF)
  const wsY = z => S.hoodB + (S.zW - z) / (S.zW - S.zRoofF) * (S.roof - S.hoodB);
  let zDash = S.zW - 0.1; while (zDash > S.zRoofF && wsY(zDash) < floorY + 0.16) zDash -= 0.02;
  box(g, 0, floorY + 0.06, zDash - 0.12, S.W * 0.78, 0.12, 0.22, tub, 0.2);
  const seatZ = zm - 0.02, room = S.roof - floorY;
  for (const sx of [-1, 1]) {
    const x = sx * 0.36;
    box(g, x, floorY + room * 0.32, seatZ - 0.12, 0.46, room * 0.64, 0.1, seat, 0.15);        // seat back
    for (const wx of [-0.2, 0.2]) box(g, x + wx, floorY + room * 0.28, seatZ - 0.04, 0.06, room * 0.5, 0.16, acc, 0.2); // bolsters
    // helmet (driver on the left of the car, +x) with a dark visor facing forward
    const hy = floorY + room * 0.62;
    cylUV(g, x, hy, seatZ + 0.02, 0.115, 0.08, 0.21, 9, sx > 0 ? lin('#f2f2ee') : acc, 0.6, 'y', true);
    box(g, x, hy + 0.09, seatZ + 0.12, 0.17, 0.06, 0.04, [0.01, 0.01, 0.012], 0.9);
  }
  // steering wheel in front of the driver
  for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2, r = 0.13, cx = 0.36, cy = floorY + room * 0.4, cz = zDash - 0.3;
    box(g, cx + Math.cos((a0 + a1) / 2) * r, cy + Math.sin((a0 + a1) / 2) * r, cz, 0.06, 0.06, 0.03, [0.02, 0.02, 0.02], 0.3);
  }
  // roll cage: main hoop behind the seats, a bar along each A-pillar and over the roof, a diagonal
  const t = 0.035, top = S.roof - 0.05, zh = seatZ - 0.24;
  for (const sx of [-1, 1]) {
    box(g, sx * hw * 0.74, (floorY + top) / 2, zh, t, top - floorY, t, cage, 0.5);
    box(g, sx * hw * 0.7, top, (zh + S.zRoofF) / 2, t, t, Math.abs(S.zRoofF - zh), cage, 0.5);
  }
  box(g, 0, top, zh, hw * 1.48, t, t, cage, 0.5);
  const dx = hw * 1.48, dy = top - floorY - 0.1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const q = (u, v) => [-hw * 0.74 + Math.cos(ang) * u - Math.sin(ang) * v, floorY + 0.05 + Math.sin(ang) * u + Math.cos(ang) * v];
  const A = q(0, -t / 2), B = q(len, -t / 2), C = q(len, t / 2), D = q(0, t / 2);
  for (const dz of [-t / 2, t / 2]) quadUV(g, [A[0], A[1], zh + dz], [B[0], B[1], zh + dz], [C[0], C[1], zh + dz], [D[0], D[1], zh + dz], cage, 0.5, [0, A[1], zh - dz * 40]);
}

function carGeo(spec, night) {
  const S = SHAPES[spec.shape]; const col = spec.col;
  const base = lin(col.base), roofC = lin(col.roof), lower = lin(col.lower);
  const black = lin('#141516'), glass = lin('#0f161e'), grey = lin('#3b3e44'), chrome = lin('#b9bcc2'), dark = lin('#08090a');
  const hw = S.W / 2, uv = mkUV(S);
  const g = new Geo(), gg = new Geo();
  const prof = bodyProfile(S, spec.wb);
  extrudeProfile(g, prof.pts, -hw, hw, { spec: 0.6, edgeCol: base, archCol: dark, topTex: true, bevel: 0.075 }, uv);
  cabin(g, S, hw, uv, glass, roofC, gg);
  interior(g, S, hw, spec);
  for (const z of [prof.fz, prof.rz]) fender(g, z, hw, S.archR, S.flares ? 0.1 : 0.065, base);
  // side skirts
  for (const sx of [-1, 1]) box(g, sx * (hw + 0.02), 0.28, (prof.fz + prof.rz) / 2, 0.05, 0.08, (prof.fz - prof.rz) - 2 * S.archR - 0.12, lower, 0.3);
  // front bumper, splitter, grille, intakes, fog lights, tow hook
  prism(g, rrect(-S.W * 0.495, S.W * 0.495, S.zf - 0.1, S.zf + 0.06, 0.07), 0.26, 0.47, black, 0.3);       // front bumper
  prism(g, rrect(-S.W * 0.46, S.W * 0.46, S.zf - 0.05, S.zf + 0.17, 0.05), 0.252, 0.287, black, 0.2);  // splitter
  box(g, 0, S.nose - 0.12, S.zf + 0.02, S.W * 0.42, 0.13, 0.04, dark, 0.1);
  for (let i = 0; i < 6; i++) box(g, 0, S.nose - 0.17 + i * 0.022, S.zf + 0.045, S.W * 0.4, 0.007, 0.01, grey, 0.4);
  for (const sx of [-1, 1]) {
    box(g, sx * 0.55, 0.36, S.zf + 0.068, 0.24, 0.1, 0.03, dark, 0.1);
    cylUV(g, sx * 0.62, 0.39, S.zf + 0.076, 0.036, 0.036, 0.012, 10, lin('#e8e4d6'), 0.9, 'z', true);
  }
  box(g, -0.3, 0.3, S.zf + 0.1, 0.05, 0.04, 0.08, lin('#d7262e'), 0.3);
  box(g, 0.3, 0.3, S.zr - 0.12, 0.05, 0.04, 0.08, lin('#d7262e'), 0.3); // rear tow hook
  // front rally plate
  quadUV(g, [-0.22, 0.4, S.zf + 0.065], [0.22, 0.4, S.zf + 0.065], [0.22, 0.46, S.zf + 0.065], [-0.22, 0.46, S.zf + 0.065], [1, 1, 1], 0.2, [0, 0.43, S.zf - 1],
    [[0.66, 1 - (AT.ex + 44) / 1024], [1, 1 - (AT.ex + 44) / 1024], [1, 1 - (AT.ex + 4) / 1024], [0.66, 1 - (AT.ex + 4) / 1024]]);
  // bonnet vents and pins
  // bonnet louvres: thin slats flush with the bonnet slope (a solid slab filled the bonnet camera's view)
  { const zc = (S.zf + S.zW) / 2 - 0.05, yAt = z => S.hoodF + (S.hoodB - S.hoodF) * (S.zf - 0.45 - z) / (S.zf - 0.45 - S.zW) + 0.012;
    for (let k = 0; k < 5; k++) { const z = zc - 0.1 + k * 0.05; box(g, 0, yAt(z), z, 0.5, 0.012, 0.022, dark, 0.2); } }
  for (const sx of [-1, 1]) cylUV(g, sx * 0.55, S.hoodF + 0.02, S.zf - 0.38, 0.03, 0.03, 0.03, 8, chrome, 0.9, 'y', true);
  // mirrors
  for (const sx of [-1, 1]) {
    // rounded, aerodynamic housing (flat at the back, where the glass sits) on a slim strut from the door
    const mx = sx * (hw + 0.09), mz = S.zW - 0.25, my = S.hoodB + 0.14;
    blob(g, mx, my, mz, 0.1, 0.05, 0.075, roofC, 0.6, true);
    ellipseQuad(g, mx, my, mz - 0.016, 0.09, 0.043, lin('#8fa3b5'), 0.95);
    prism(g, [[-0.025, -0.03], [0.025, -0.03], [0.02, 0.035], [-0.02, 0.035]].map(([u, v]) => [sx * (hw + 0.03) + u, S.zW - 0.22 + v]), S.hoodB + 0.075, S.hoodB + 0.11, black, 0.3);
  }
  // rear bumper, diffuser, exhaust, rally plate
  prism(g, rrect(-S.W * 0.495, S.W * 0.495, S.zr - 0.07, S.zr + 0.08, 0.07), 0.27, 0.49, black, 0.3);    // rear bumper
  box(g, 0, 0.27, S.zr - 0.03, S.W * 0.7, 0.05, 0.12, dark, 0.1);
  tube(g, -hw * 0.55, 0.3, S.zr + 0.05, S.zr - 0.12, 0.052, lin('#9a9da3'), 0.9); // exhaust tip
  quadUV(g, [0.26, 0.5, S.zr - 0.067], [-0.26, 0.5, S.zr - 0.067], [-0.26, 0.62, S.zr - 0.067], [0.26, 0.62, S.zr - 0.067], [1, 1, 1], 0.2, [0, 0.55, S.zr + 1],
    [[0.66, 1 - (AT.ex + 44) / 1024], [1, 1 - (AT.ex + 44) / 1024], [1, 1 - (AT.ex + 4) / 1024], [0.66, 1 - (AT.ex + 4) / 1024]]);
  // wings
  const tailY = S.kind === 'sedan' ? S.deck : S.tail;
  if (spec.wing === 'big') {
    // airfoil main plane on two swan-neck pylons, a gurney strip at the tail, thin endplates
    const z = S.kind === 'sedan' ? S.zr + 0.55 : S.zr + 0.62, y = tailY + (S.kind === 'sedan' ? 0.3 : 0.22), wc = spec.id === 'kwattro' ? base : lin(col.stripe);
    for (const sx of [-0.55, 0.55]) prism(g, [[sx - 0.02, z - 0.1], [sx + 0.02, z - 0.1], [sx + 0.02, z - 0.34], [sx - 0.02, z - 0.34]], y - 0.3, y + 0.02, black, 0.25);
    airfoil(g, -S.W * 0.48, S.W * 0.48, y + 0.02, z, 0.48, 0.12 * 0.48, 0.12, wc, 0.6);
    box(g, 0, y + 0.085, z - 0.47, S.W * 0.96, 0.05, 0.012, black, 0.2);
    for (const sx of [-1, 1]) prism(g, [[sx * S.W * 0.49 - 0.008, z + 0.04], [sx * S.W * 0.49 + 0.008, z + 0.04], [sx * S.W * 0.49 + 0.008, z - 0.55], [sx * S.W * 0.49 - 0.008, z - 0.55]], y - 0.08, y + 0.16, black, 0.25);
  } else if (spec.wing === 'mid') {
    airfoil(g, -S.W * 0.4, S.W * 0.4, S.roof - 0.02, S.zRoofR + 0.0, 0.46, 0.1 * 0.46, 0.16, roofC, 0.6);
    for (const sx of [-1, 1]) prism(g, [[sx * S.W * 0.4 - 0.012, S.zRoofR + 0.02], [sx * S.W * 0.4 + 0.012, S.zRoofR + 0.02], [sx * S.W * 0.4 + 0.012, S.zRoofR - 0.46], [sx * S.W * 0.4 - 0.012, S.zRoofR - 0.46]], S.roof - 0.15, S.roof + 0.06, black, 0.25);
    box(g, 0, S.tail + 0.05, S.zr + 0.1, S.W * 0.9, 0.04, 0.16, black, 0.2);
  } else if (spec.wing === 'roof') {
    airfoil(g, -S.W * 0.4, S.W * 0.4, S.roof - 0.01, S.zRoofR + 0.02, 0.32, 0.1 * 0.32, 0.14, base, 0.6);
  }
  if (spec.id === 'kwattro') {
    box(g, 0, 0.25, S.zf + 0.2, S.W * 1.02, 0.04, 0.42, black, 0.2); // big front splitter
    for (const sx of [-1, 1]) box(g, sx * 0.5, S.hoodF + 0.1, S.zf - 0.15, 0.3, 0.06, 0.14, black, 0.2); // front wing blades
  }
  // roof intake: a forward-facing scoop that blends back into the roof
  if (S.scoop || spec.id === 'delta') scoop(g, S.roof + 0.02, S.zRoofF - 0.25, S.zRoofF - 0.72, 0.44, 0.11, roofC, 0.5);
  else scoop(g, S.roof + 0.02, S.zRoofF - 0.22, S.zRoofF - 0.55, 0.32, 0.075, black, 0.25);
  // antenna
  box(g, 0.25, S.roof + 0.2, S.zRoofR + 0.25, 0.012, 0.4, 0.012, black, 0);
  // mudflaps (textured)
  const mv0 = 1 - (AT.ex + 50) / 1024, mv1 = 1 - (AT.ex + 98) / 1024;
  for (const z of [prof.fz - S.archR - 0.1, prof.rz - S.archR - 0.08]) for (const sx of [-1, 1]) {
    const x0 = sx * (hw - 0.03), x1 = sx * (hw - 0.33);
    quadUV(g, [x0, 0.05, z], [x1, 0.05, z], [x1, 0.42, z], [x0, 0.42, z], [1, 1, 1], 0.1, [0, 0.2, z + 1], [[0.62, mv1], [0.82, mv1], [0.82, mv0], [0.62, mv0]]);
  }
  // light pod for night stages
  if (night) box(g, 0, S.nose + 0.2, S.zf - 0.1, S.W * 0.8, 0.22, 0.12, black, 0.3);
  // emissive parts: lamps sit in glossy black housings; the lens backing is dim so only the lamps themselves glow
  const lf = new Geo(), lr = new Geo(), lens = new Geo();
  const hl = lin('#fff3d2'), red = lin('#ff2a1a'), amber = lin('#ffa53a');
  const sc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // a lamp: bright bulb in the middle of a dimmer reflector bowl, in 18 segments so it reads round
  const disc = (geo, cx, cy, z, r, c, dir) => {
    const N = 18, ri = r * 0.42, cO = [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55];
    for (let k = 0; k < N; k++) {
      const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2, P = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z];
      geo.tri([cx, cy, z + dir * 0.002], P(a0, ri), P(a1, ri), c, 0, [cx, cy, z - dir * 5]);
      geo.quad(P(a0, ri), P(a1, ri), P(a1, r), P(a0, r), cO, 0, [cx, cy, z - dir * 5]);
    }
  };
  // lenses in columns so they follow the bowed nose and tail
  const rect = (geo, x0, y0, x1, y1, z, c, dir) => { for (let k = 0; k < 4; k++) { const xa = x0 + (x1 - x0) * k / 4, xb = x0 + (x1 - x0) * (k + 1) / 4; geo.quad([xa, y0, z], [xb, y0, z], [xb, y1, z], [xa, y1, z], c, 0, [0, 0, z - dir * 5]); } };
  const zr = S.zr - 0.028, ty = tailY - 0.2;
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.3), z = S.zf + 0.037, y = S.nose - 0.02;
    prism(g, rrect(x - 0.215, x + 0.215, z - 0.032, z + 0.008, 0.016), y - 0.075, y + 0.075, [0.012, 0.013, 0.015], 0.9);
    rect(lf, x - 0.2, y - 0.065, x + 0.2, y + 0.065, z + 0.01, sc(hl, 0.16), 1);
    rect(lens, x - 0.205, y - 0.07, x + 0.205, y + 0.07, z + 0.022, [0.8, 0.85, 0.9], 1); // clear cover
    disc(lf, x - sx * 0.035, y, z + 0.012, 0.056, hl, 1);
    disc(lf, x + sx * 0.1, y, z + 0.012, 0.045, sc(hl, 0.85), 1);
    rect(lf, x + sx * 0.15, y - 0.05, x + sx * 0.195, y + 0.05, z + 0.012, sc(amber, 0.45), 1);
    // tail: housing, three segments (outer ones brightest), a pale reverse lamp next to the garnish
    const xo = sx * (hw - 0.06), xi = sx * (hw - 0.42);
    { const cx = (xo + xi) / 2; prism(g, rrect(cx - 0.19, cx + 0.19, zr - 0.003, zr + 0.027, 0.01), ty - 0.09, ty + 0.07, [0.012, 0.013, 0.015], 0.9); }
    rect(lr, xi, ty - 0.08, xo, ty + 0.06, zr - 0.004, sc(red, 0.35), -1);
    rect(lr, xo - sx * 0.02, ty - 0.06, xo - sx * 0.14, ty + 0.045, zr - 0.006, red, -1);
    rect(lr, xo - sx * 0.16, ty - 0.06, xo - sx * 0.26, ty + 0.045, zr - 0.006, sc(red, 0.8), -1);
    rect(lr, xo - sx * 0.28, ty - 0.06, xi + sx * 0.02, ty + 0.045, zr - 0.006, [0.55, 0.55, 0.52], -1);
  }
  { const gw = (S.W - 0.86) / 2; prism(g, rrect(-gw, gw, zr - 0.003, zr + 0.027, 0.01), ty - 0.06, ty + 0.04, [0.02, 0.022, 0.026], 0.85); } // garnish between the tail lamps
  if (night) for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * S.W * 0.19, y = S.nose + 0.2, z = S.zf - 0.035, r = 0.075;
    lf.quad([x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], [x - r, y + r, z], hl, 0, [x, y, z - 5]);
  }
  // exhaust flame (drawn only on backfires)
  const fl = new Geo();
  const ex = -hw * 0.55, ez = S.zr - 0.08;
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3, ca = Math.cos(a) * 0.12, sa = Math.sin(a) * 0.12;
    fl.quad([ex - ca, 0.3 - sa, ez], [ex + ca, 0.3 + sa, ez], [ex + ca * 0.3, 0.3 + sa * 0.3, ez - 0.55], [ex - ca * 0.3, 0.3 - sa * 0.3, ez - 0.55], lin('#ff9a3a'), 0, [ex, 0.3, ez + 3]);
  }
  for (let i = 3; i < lens.c.length; i += 4) lens.c[i] = 0.95;
  warpCar([g, gg, lf, lr, fl, lens], S);
  smoothNormals(g, 36); smoothNormals(gg, 36);
  curveSides(g);
  return { body: g, glass: gg, lens, lightF: lf, lightR: lr, flame: fl, shape: S, fz: prof.fz, rz: prof.rz };
}

// ---------- wheels ----------
// tyre with rounded shoulders, a staggered gravel tread and a bulging sidewall; dished rim with thick spokes,
// centre nut and a big vented disc behind. The caliper is a separate mesh so it doesn't spin with the wheel.
function wheelGeo(spec) {
  const g = new Geo();
  const tire = lin('#17181a'), tread = lin('#0e0f10'), side = lin('#1c1d20'), rim = lin(spec.col.rim), barrel = lin('#3a3c41'), hub = lin('#2a2b2e');
  const disc = lin('#6d7076'), hat = lin('#46484d');
  const N = 24, W = 0.25, r0 = 0.335, ri = 0.24, hw = W / 2, sh = 0.028;
  const P = (x, a, r) => [x, Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, am = (a0 + a1) / 2;
    const out = [0, -Math.cos(am) * 9, -Math.sin(am) * 9];
    // tread: two staggered rows of blocks
    const hiL = i % 2 ? 0.009 : 0, hiR = i % 2 ? 0 : 0.009;
    g.quad(P(-hw + sh, a0, r0 + hiL), P(0, a0, r0 + hiL), P(0, a1, r0 + hiL), P(-hw + sh, a1, r0 + hiL), hiL ? tread : tire, 0.05, out);
    g.quad(P(0, a0, r0 + hiR), P(hw - sh, a0, r0 + hiR), P(hw - sh, a1, r0 + hiR), P(0, a1, r0 + hiR), hiR ? tread : tire, 0.05, out);
    for (const sx of [-1, 1]) {
      const hiS = sx < 0 ? hiL : hiR;
      // shoulder, sidewall (bulging out a little at mid height), rim lip, barrel
      g.quad(P(sx * (hw - sh), a0, r0 + hiS), P(sx * (hw - sh), a1, r0 + hiS), P(sx * hw, a1, r0 - sh), P(sx * hw, a0, r0 - sh), tire, 0.05, [0, 0, 0]);
      const rm = (r0 - sh + ri) / 2;
      // sidewall: white vertex colour, the rubber and the moulded lettering come from the tyre texture (u around, v out)
      const su = k => [sx > 0 ? 1 - (i + k) / N : (i + k) / N, 0], tv = (uv, v) => [uv[0], v]; // reads clockwise on both sides
      g.quad(P(sx * hw, a0, r0 - sh), P(sx * hw, a1, r0 - sh), P(sx * (hw + 0.012), a1, rm), P(sx * (hw + 0.012), a0, rm), [1, 1, 1], 0.06, [-sx * 20, 0, 0], [tv(su(0), 0.94), tv(su(1), 0.94), tv(su(1), 0.5), tv(su(0), 0.5)]);
      g.quad(P(sx * (hw + 0.012), a0, rm), P(sx * (hw + 0.012), a1, rm), P(sx * hw * 0.98, a1, ri), P(sx * hw * 0.98, a0, ri), [1, 1, 1], 0.06, [-sx * 20, 0, 0], [tv(su(0), 0.5), tv(su(1), 0.5), tv(su(1), 0.02), tv(su(0), 0.02)]);
      g.quad(P(sx * hw * 0.98, a0, ri), P(sx * hw * 0.98, a1, ri), P(sx * hw * 0.86, a1, ri - 0.025), P(sx * hw * 0.86, a0, ri - 0.025), rim, 0.85, [-sx * 20, 0, 0]);
      g.quad(P(sx * hw * 0.86, a0, ri - 0.025), P(sx * hw * 0.86, a1, ri - 0.025), P(sx * hw * 0.3, a1, ri - 0.03), P(sx * hw * 0.3, a0, ri - 0.03), barrel, 0.4, [0, 0, 0]);
      // vented disc with a darker hat, visible through the spokes
      g.quad(P(sx * 0.3 * hw, a0, 0.08), P(sx * 0.3 * hw, a1, 0.08), P(sx * 0.3 * hw, a1, 0.2), P(sx * 0.3 * hw, a0, 0.2), i % 3 ? disc : lin('#55585e'), 0.65, [-sx * 20, 0, 0]);
      g.tri([sx * 0.32 * hw, 0, 0], P(sx * 0.32 * hw, a0, 0.08), P(sx * 0.32 * hw, a1, 0.08), hat, 0.4, [-sx * 20, 0, 0]);
    }
  }
  const spokes = spec.id === 'impressa' || spec.id === 'kwattro' ? 6 : 5;
  for (const sx of [-1, 1]) {
    const x = sx * W * 0.42, xb = x - sx * 0.022;
    for (let k = 0; k < spokes; k++) {
      const a = k / spokes * Math.PI * 2;
      const Q = (xx, aa, r) => [xx, Math.cos(aa) * r, Math.sin(aa) * r];
      const c0 = Q(x, a - 0.17, 0.055), c1 = Q(x, a + 0.17, 0.055), c2 = Q(x, a + 0.1, ri - 0.03), c3 = Q(x, a - 0.1, ri - 0.03);
      g.quad(c0, c1, c2, c3, rim, 0.85, [-sx * 20, 0, 0]);
      // spoke thickness: the two long edges
      for (const [p0, p1] of [[c0, c3], [c1, c2]]) g.quad(p0, p1, [xb, p1[1], p1[2]], [xb, p0[1], p0[2]], lin(spec.col.rim === '#f2f2f2' || spec.col.rim === '#f3f3f1' || spec.col.rim === '#eeeeee' ? '#b9bcc2' : '#8a7a3a'), 0.6, [0, 0, 0]);
    }
    g.cyl(x - sx * 0.005, 0, 0, 0.06, 0.05, sx * 0.018, 10, hub, 0.7, 'x', true);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.box(x + sx * 0.016, Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.01, 0.014, 0.014, lin('#c9ccd2'), 0.9); }
  }
  // everything else samples the plain white strip at the top of the tyre texture
  for (let i = 0; i < g.u.length; i += 2) if (g.u[i] === 0 && g.u[i + 1] === 0) g.u[i + 1] = 0.999;
  return g;
}
// tyre texture: dark rubber with the maker's name moulded into the sidewall twice around, a thin white strip on top
function tyreCanvas() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#1d1e21'; g.fillRect(0, 0, 1024, 64);
  for (let x = 0; x < 1024; x += 3) { g.fillStyle = `rgba(255,255,255,${0.012 + 0.02 * ((x * 7) % 5) / 5})`; g.fillRect(x, 0, 1, 64); }
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 2);
  g.font = `800 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const x of [256, 768]) {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText('SIDEWAYS  ·  GRAVEL G4', x + 1, 34);
    g.fillStyle = '#8e9095'; g.fillText('SIDEWAYS  ·  GRAVEL G4', x, 33);
  }
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 52, 1024, 2);
  return cv;
}
// caliper: clamps the disc at the top-rear; follows steering but not the wheel's spin
function caliperGeo(spec) {
  const g = new Geo(), c = lin(spec.id === 'impressa' || spec.id === 'kwattro' ? '#d9a43a' : '#c8202a');
  g.box(0, 0.13, -0.09, 0.25 * 0.5, 0.075, 0.13, c, 0.45);
  g.box(0, 0.165, -0.04, 0.25 * 0.45, 0.04, 0.06, c, 0.45);
  return g;
}

// motion-blur discs over the spokes: faded in with wheel speed so fast wheels read as a blur instead of strobing
function wheelBlurGeo(spec) {
  const g = new Geo(), rim = lin(spec.col.rim), dark = lin('#141518');
  const mix = (k) => [dark[0] + (rim[0] - dark[0]) * k, dark[1] + (rim[1] - dark[1]) * k, dark[2] + (rim[2] - dark[2]) * k];
  const N = 20, W = 0.25, rIn = 0.06, rOut = 0.215;
  for (const sx of [-1, 1]) {
    const x = sx * (W * 0.42 + 0.006);
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
      const P = (a, r) => [x, Math.cos(a) * r, Math.sin(a) * r];
      g.quad(P(a0, rIn), P(a1, rIn), P(a1, rOut), P(a0, rOut), mix(0.45), 0.3, [-sx * 20, 0, 0]);
      g.tri([x, 0, 0], P(a0, rIn), P(a1, rIn), lin('#2a2b2e'), 0.4, [-sx * 20, 0, 0]);
    }
  }
  return g;
}

// ---------- liveries ----------
const FONT = '"Big Shoulders Display", "Barlow Semi Condensed", "Arial Narrow", sans-serif';
function liveryCanvas(spec) {
  const S = SHAPES[spec.shape], col = spec.col;
  // painted at 2048² (the layout stays in 1024 units, scaled) so lettering and decals stay crisp up close
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 2048;
  const g = cv.getContext('2d'); g.scale(2, 2);
  const L = 4.4, z0 = -2.2, yTop = 1.05, yb = 0.12;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 1024);
  // side regions -------------------------------------------------
  const side = (sx) => {
    const top = sx > 0 ? AT.lY : AT.rY;
    const X = z => (sx > 0 ? (2.2 - z) / L : (z - z0) / L) * 1024;
    const Y = y => top + (yTop - y) / (yTop - yb) * AT.side;
    g.save();
    g.beginPath(); g.rect(0, top, 1024, AT.side); g.clip();
    g.fillStyle = col.base; g.fillRect(0, top, 1024, AT.side);
    const band = (y0, y1, c, za, zb) => { g.fillStyle = c; const xa = X(za == null ? 2.3 : za), xb = X(zb == null ? -2.3 : zb); g.fillRect(Math.min(xa, xb), Y(y1), Math.abs(xb - xa), Y(y0) - Y(y1)); };
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([z, y], i) => i ? g.lineTo(X(z), Y(y)) : g.moveTo(X(z), Y(y))); g.closePath(); g.fill(); };
    const text = (str, z, y, size, c, opts) => {
      opts = opts || {};
      g.save(); g.fillStyle = c; g.font = `${opts.w || 800} ${size}px ${FONT}`; g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
      g.translate(X(z), Y(y)); g.transform(1, 0, opts.skew == null ? -0.18 : opts.skew, 1, 0, 0);
      if (opts.stroke) { g.lineWidth = opts.stroke; g.strokeStyle = opts.strokeCol || '#000'; g.strokeText(str, 0, 0); }
      g.fillText(str, 0, 0); g.restore();
    };
    const roundel = (z, y) => {
      const x = X(z), yy = Y(y), r = 34;
      g.fillStyle = col.base === '#f5f5f2' || col.base === '#f3f3f1' || col.base === '#f1efe8' ? col.stripe : '#ffffff'; g.beginPath(); g.arc(x, yy, r + 5, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, yy, r, 0, 7); g.fill();
      g.fillStyle = '#111111'; g.font = `900 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(spec.num), x, yy + 3);
    };
    const dz = (S.zW + S.zf) / 2; // front fender
    const door = (S.zW + S.zRoofR) / 2 + 0.05;
    const rearQ = S.zr + 0.65;
    switch (spec.id) {
      case 'foca':
        band(0.12, 0.5, col.lower);
        poly([[1.2, 0.5], [-0.2, 0.5], [-1.4, 1.05], [-2.3, 1.05], [-2.3, 0.62], [-0.7, 0.62], [0.6, 0.12], [1.6, 0.12]], col.stripe);
        poly([[1.25, 0.5], [1.15, 0.5], [0.45, 0.12], [0.55, 0.12]], col.stripe2);
        text('FORD', -1.55, 0.86, 40, col.base);
        text('TORQUE COLA', -0.25, 0.42, 24, '#ffffff');
        roundel(0.5, 0.74);
        break;
      case 'impressa':
        band(0.66, 0.69, col.stripe); band(0.6, 0.62, col.stripe);
        poly([[0.9, 0.3], [-1.9, 0.3], [-2.1, 0.55], [-1.6, 0.55]], col.stripe);
        text('WRX', -0.32, 0.8, 58, col.stripe);
        text('SUBARU', 0.5, 0.47, 28, col.stripe);
        text('SIDEWAYS TYRES', -0.25, 0.46, 20, '#ffffff');
        roundel(0.5, 0.82);
        break;
      case 'lancha':
        band(0.12, 0.42, col.lower);
        poly([[2.3, 0.42], [2.3, 0.62], [0.2, 0.62], [-0.6, 0.85], [-2.3, 0.85], [-2.3, 0.62], [-0.8, 0.62], [0.0, 0.42]], col.stripe);
        text('EVO', -1.5, 0.94, 40, col.stripe);
        text('MITSUBISHI', -0.05, 0.37, 24, '#ffffff');
        roundel(0.55, 0.8);
        break;
      case 'delta':
        band(0.66, 0.72, col.stripe); band(0.72, 0.78, col.stripe2); band(0.78, 0.82, col.stripe3);
        text('LANCIA', -0.3, 0.48, 34, col.stripe2);
        text('INTEGRALE', -1.5, 0.9, 20, col.stripe2);
        roundel(0.48, 0.47);
        break;
      case 'pejo':
        poly([[2.3, 0.4], [2.3, 0.5], [0.3, 0.5], [-0.6, 0.95], [-2.3, 0.95], [-2.3, 0.85], [-0.7, 0.85], [0.2, 0.4]], col.stripe);
        poly([[2.3, 0.5], [2.3, 0.56], [0.36, 0.56], [-0.52, 1.0], [-0.62, 0.95], [0.3, 0.5]], col.stripe2);
        poly([[2.3, 0.56], [2.3, 0.6], [0.4, 0.6], [-0.46, 1.03], [-0.52, 1.0], [0.36, 0.56]], col.stripe3);
        text('PEUGEOT', -0.3, 0.46, 34, col.stripe);
        text('T16', -1.55, 0.86, 34, col.stripe);
        roundel(0.6, 0.79);
        break;
      case 'selica':
        // white with a red sweep and green pinstripes running back from the front arch
        poly([[2.3, 0.3], [2.3, 0.52], [0.6, 0.52], [-0.9, 0.86], [-2.3, 0.86], [-2.3, 0.7], [-1.0, 0.7], [0.45, 0.3]], col.stripe);
        poly([[2.3, 0.55], [2.3, 0.59], [0.66, 0.59], [-0.84, 0.92], [-2.3, 0.92], [-2.3, 0.88], [-0.9, 0.88], [0.6, 0.55]], col.stripe2);
        band(0.12, 0.2, col.stripe2);
        text('GT-FOUR', -1.45, 0.62, 30, '#ffffff');
        text('TOYOTA', 1.2, 0.72, 30, col.stripe);
        text('TORQUE OIL', -0.2, 0.4, 22, '#1d1f22');
        roundel(0.35, 0.78);
        break;
      case 'kwattro':
        band(0.3, 0.42, col.stripe); band(0.42, 0.46, col.stripe2);
        text('QUATTRO', 0.2, 0.68, 44, col.stripe);
        text('AUDI SPORT', 0.2, 0.52, 20, '#222222');
        roundel(-1.55, 0.78);
        break;
    }
    // panel gaps and handles, then baked light: darker towards the sills, a soft sheen under the shoulder
    const fz = spec.wb / 2 + S.wbOff, rz = -spec.wb / 2 + S.wbOff;
    const seam = (za, ya, zb, yb) => { g.beginPath(); g.moveTo(X(za), Y(ya)); g.lineTo(X(zb), Y(yb)); g.stroke(); };
    g.lineCap = 'round';
    const zd0 = Math.min(S.zW - 0.04, fz - S.archR - 0.1), zB = (S.zRoofF + S.zRoofR) / 2 + 0.06;
    const zd2 = S.kind === 'sedan' ? Math.max(rz + S.archR + 0.08, S.zRearG + 0.05) : null;
    for (const [w, c] of [[3, 'rgba(0,0,0,0.38)'], [1, 'rgba(255,255,255,0.18)']]) {
      g.lineWidth = w; g.strokeStyle = c;
      const o = w === 1 ? 2 : 0;
      seam(zd0 - o * 0.004, S.belt - 0.02, zd0 + 0.03 - o * 0.004, 0.34);
      seam(zB - o * 0.004, S.belt - 0.02, zB - o * 0.004, 0.34);
      if (zd2 != null) seam(zd2 - o * 0.004, S.belt - 0.02, zd2 + 0.04 - o * 0.004, 0.36);
      seam(zd0, 0.34, zd2 != null ? zd2 + 0.04 : zB, 0.34);
    }
    const handle = z => { g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(X(z) - 13, Y(S.belt - 0.1), 26, 7, 3); g.fill(); };
    handle(zB + 0.16); if (zd2 != null) handle(zd2 + 0.16);
    // weathering: dust thrown up behind each wheel and along the sills, tar and stone chips, a few scratches
    const wr = new Array(1).fill(0).map(() => { let sd = spec.num * 7919 + (sx > 0 ? 17 : 91); return () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296; })[0];
    for (const wz of [fz, rz]) {
      const cxp = X(wz), cyp = Y(0.335), r0 = 0.3 / L * 1024, r1 = 0.78 / L * 1024;
      const rg = g.createRadialGradient(cxp, cyp, r0, cxp, cyp, r1); rg.addColorStop(0, 'rgba(96,76,52,0)'); rg.addColorStop(0.35, 'rgba(96,76,52,0.28)'); rg.addColorStop(1, 'rgba(96,76,52,0)');
      g.fillStyle = rg; g.fillRect(cxp - r1, cyp - r1, 2 * r1, 2 * r1);
    }
    for (let k = 0; k < 520; k++) {
      const px = wr() * 1024, py = Y(0.12 + Math.pow(wr(), 2.2) * 0.42), rr = 0.6 + wr() * 1.7;
      g.fillStyle = wr() < 0.7 ? 'rgba(70,55,38,0.5)' : 'rgba(40,36,32,0.55)'; g.beginPath(); g.arc(px, py, rr, 0, 7); g.fill();
    }
    for (let k = 0; k < 70; k++) { // chips down to bare metal on the leading edges
      const px = (sx > 0 ? X(S.zf - 0.15 - wr() * 0.9) : X(S.zf - 0.15 - wr() * 0.9)), py = Y(0.2 + wr() * 0.5), rr = 0.7 + wr() * 1.3;
      g.fillStyle = 'rgba(205,208,210,0.75)'; g.beginPath(); g.arc(px, py, rr, 0, 7); g.fill();
    }
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.22)';
    for (let k = 0; k < 7; k++) { const x0 = X(S.zr + 0.4 + wr() * (S.zf - S.zr - 0.8)), y0 = Y(0.2 + wr() * 0.6), a = wr() * 0.5 - 0.25; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * (14 + wr() * 30), y0 + Math.sin(a) * (14 + wr() * 30)); g.stroke(); }
    let gr = g.createLinearGradient(0, Y(0.62), 0, Y(0.14));
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = gr; g.fillRect(0, Y(0.62), 1024, Y(0.12) - Y(0.62));
    gr = g.createLinearGradient(0, Y(S.belt + 0.04), 0, Y(S.belt - 0.14));
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, Y(S.belt + 0.04), 1024, Y(S.belt - 0.14) - Y(S.belt + 0.04));
    g.restore();
  };
  side(1); side(-1);
  // top view -----------------------------------------------------
  const TX = z => (z - z0) / L * 1024, TY = x => AT.tY + (0.95 - x) / 1.9 * AT.tH;
  g.fillStyle = col.base; g.fillRect(0, AT.tY, 1024, AT.tH);
  g.fillStyle = col.roof; g.fillRect(TX(S.zRoofR), AT.tY, TX(S.zRoofF) - TX(S.zRoofR), AT.tH);
  const lane = (w, c, za, zb) => { g.fillStyle = c; g.fillRect(TX(za), TY(w / 2), TX(zb) - TX(za), TY(-w / 2) - TY(w / 2)); };
  switch (spec.id) {
    case 'foca': lane(0.3, col.stripe, S.zW, 2.3); lane(0.06, col.stripe2, S.zW, 2.3); break;
    case 'impressa': lane(0.5, col.stripe, S.zW + 0.4, 2.3); lane(0.4, col.base, S.zW + 0.4, 2.3); break;
    case 'lancha': lane(0.7, col.stripe, S.zW, 2.3); break;
    case 'delta': lane(0.5, col.stripe, -2.3, 2.3); lane(0.32, col.stripe2, -2.3, 2.3); lane(0.12, col.stripe3, -2.3, 2.3); break;
    case 'pejo': lane(0.5, col.stripe, S.zW, 2.3); lane(0.2, col.stripe2, S.zW, 2.3); break;
    case 'kwattro': lane(0.36, col.stripe, S.zW, 2.3); lane(0.08, col.stripe2, S.zW, 2.3); break;
    case 'selica': lane(0.42, col.stripe, S.zW, 2.3); lane(0.06, col.stripe2, S.zW, 2.3); break;
  }
  // bonnet shut lines and the scuttle in front of the screen
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineCap = 'round';
  const hx = S.W / 2 - 0.13;
  for (const x of [hx, -hx]) { g.beginPath(); g.moveTo(TX(S.zf - 0.16), TY(x)); g.lineTo(TX(S.zW + 0.04), TY(x * 0.97)); g.stroke(); }
  g.beginPath(); g.moveTo(TX(S.zW + 0.04), TY(hx * 0.97)); g.lineTo(TX(S.zW + 0.04), TY(-hx * 0.97)); g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(TX(S.zW - 0.02), TY(hx), TX(S.zW + 0.03) - TX(S.zW - 0.02), TY(-hx) - TY(hx));
  // roof number
  const rx = TX((S.zRoofF + S.zRoofR) / 2), ry = TY(0);
  g.save(); g.translate(rx, ry); g.rotate(Math.PI / 2);
  g.fillStyle = '#ffffff'; g.fillRect(-60, -46, 120, 92);
  g.fillStyle = '#111'; g.font = `900 84px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(spec.num), 0, 4);
  g.restore();
  // extras: sunstrip, rally plate, mudflap
  g.fillStyle = '#0d1117'; g.fillRect(0, AT.ex, 640, 48);
  g.fillStyle = col.text === '#ffffff' ? '#ffd23a' : col.text; g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(spec.name.split(' ')[0].toUpperCase() + ' · SIDEWAYS RALLY TEAM', 320, AT.ex + 26);
  g.fillStyle = '#f4f2ea'; g.fillRect(676, AT.ex, 348, 48);
  g.fillStyle = '#111'; g.font = `800 30px ${FONT}`; g.fillText('SIDEWAYS RALLY ' + spec.num, 850, AT.ex + 26);
  g.fillStyle = '#ffffff'; g.fillRect(636, AT.ex + 50, 204, 50);
  g.fillStyle = spec.col.stripe === '#f2f2ee' ? spec.col.base : spec.col.stripe; g.font = `800 26px ${FONT}`; g.fillText('SIDEWAYS', 738, AT.ex + 76);
  // crew names for the rear side windows: dark sticker band, a small flag, white letters (invented names)
  const CREW = { foca: 'M. KORPELA · T. LAHTI', impressa: 'A. McLEOD · D. FINDLAY', lancha: 'T. MAKELA · R. MANNILA', delta: 'J. KANKARE · P. VIRTA',
    pejo: 'A. VATAJA · T. HARJU', kwattro: 'K. ERIKSEN · L. HOLM', selica: 'M. TORRES · L. MOYANO' };
  g.fillStyle = '#0c0f13'; g.fillRect(0, AT.ex + 52, 630, 46);
  const flag = [['#003580', '#ffffff'], ['#ffffff', '#003580'], ['#d52b1e', '#ffffff']][spec.num % 3];
  g.fillStyle = flag[0]; g.fillRect(12, AT.ex + 62, 40, 26); g.fillStyle = flag[1]; g.fillRect(24, AT.ex + 62, 7, 26); g.fillRect(12, AT.ex + 72, 40, 6);
  g.fillStyle = '#f4f2ea'; g.font = `800 30px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(CREW[spec.id] || 'SIDEWAYS RALLY TEAM', 64, AT.ex + 76);
  // white texel
  g.fillStyle = '#ffffff'; g.fillRect(1004, 1004, 20, 20);
  return cv;
}

function buildCar(R, spec, night) {
  const cg = carGeo(spec, night);
  return {
    spec, shape: cg.shape, fz: cg.fz, rz: cg.rz,
    body: R.mesh(cg.body), glass: R.mesh(cg.glass), lens: R.mesh(cg.lens), lightF: R.mesh(cg.lightF), lightR: R.mesh(cg.lightR), flame: R.mesh(cg.flame),
    tex: R.texture(liveryCanvas(spec)),
    wheel: R.mesh((() => { const w = wheelGeo(spec); smoothNormals(w, 30); return w; })()), wheelBlur: R.mesh(wheelBlurGeo(spec)), caliper: R.mesh(caliperGeo(spec)),
    tyreTex: R.texture(tyreCanvas()),
    exhaust: [-cg.shape.W / 2 * 0.55, 0.3, cg.shape.zr - 0.08],
  };
}

return { SHAPES, buildCar, triangulate };
})();
