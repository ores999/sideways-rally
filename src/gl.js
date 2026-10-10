// ===================== RENDERER: math, shaders, meshes =====================
const GFX = (() => {
'use strict';

// ---------- mat4 (column-major) ----------
const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2); o.fill(0);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  ortho(o, l, r, b, t, n, f) {
    o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  },
  lookAt(o, e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
    o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
    return o;
  },
  mul(o, a, b) {
    const r = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    }
    o.set(r); return o;
  },
  inv(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return o; det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  // T * Ry(yaw) * Rx(pitch) * Rz(roll) * S
  trs(o, x, y, z, yaw, pitch, roll, s) {
    s = s || 1;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Ry * Rx * Rz (row-major entries r[row][col])
    const r00 = cy * cr + sy * sp * sr, r01 = -cy * sr + sy * sp * cr, r02 = sy * cp;
    const r10 = cp * sr, r11 = cp * cr, r12 = -sp;
    const r20 = -sy * cr + cy * sp * sr, r21 = sy * sr + cy * sp * cr, r22 = cy * cp;
    o[0] = r00 * s; o[1] = r10 * s; o[2] = r20 * s; o[3] = 0;
    o[4] = r01 * s; o[5] = r11 * s; o[6] = r21 * s; o[7] = 0;
    o[8] = r02 * s; o[9] = r12 * s; o[10] = r22 * s; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  },
};

// ---------- colors ----------
function lin(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [Math.pow(((v >> 16) & 255) / 255, 2.2), Math.pow(((v >> 8) & 255) / 255, 2.2), Math.pow((v & 255) / 255, 2.2)];
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scalec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ---------- geometry builder ----------
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  tri(a, b, c, col, spec, ref, ua, ub, uc) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ref) {
      const mx = (a[0] + b[0] + c[0]) / 3 - ref[0], my = (a[1] + b[1] + c[1]) / 3 - ref[1], mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
      if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    }
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2], spec || 0); }
    this.u.push(...(ua || [0, 0]), ...(ub || [0, 0]), ...(uc || [0, 0]));
  }
  quad(a, b, c, d, col, spec, ref, uv) {
    this.tri(a, b, c, col, spec, ref, uv && uv[0], uv && uv[1], uv && uv[2]);
    this.tri(a, c, d, col, spec, ref, uv && uv[0], uv && uv[2], uv && uv[3]);
  }
  box(cx, cy, cz, sx, sy, sz, col, spec, mask) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const ref = [cx, cy, cz], uv = mask ? [[0, mask], [0, mask], [0, mask], [0, mask]] : null;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, spec, ref, uv);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], col, spec, ref, uv);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], col, spec, ref, uv);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, spec, ref, uv);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], col, spec, ref, uv);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, spec, ref, uv);
  }
  // cylinder along y (axis 'y') or along x (axis 'x')
  cyl(cx, cy, cz, r0, r1, h, seg, col, spec, axis, caps, mask, capCol) {
    const P = (a, y, r) => axis === 'x' ? [cx + y, cy + Math.cos(a) * r, cz + Math.sin(a) * r] : [cx + Math.cos(a) * r, cy + y, cz + Math.sin(a) * r];
    const uv = mask ? [[0, mask], [0, mask], [0, mask], [0, mask]] : null;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const ref = axis === 'x' ? [cx + h / 2, cy - Math.cos(am) * 50, cz - Math.sin(am) * 50] : [cx - Math.cos(am) * 50, cy + h / 2, cz - Math.sin(am) * 50];
      this.quad(P(a0, 0, r0), P(a1, 0, r0), P(a1, h, r1), P(a0, h, r1), col, spec, ref, uv);
      if (caps) {
        const cc = capCol || col;
        const c0 = axis === 'x' ? [cx, cy, cz] : [cx, cy, cz], c1 = axis === 'x' ? [cx + h, cy, cz] : [cx, cy + h, cz];
        const in0 = axis === 'x' ? [cx + 1, cy, cz] : [cx, cy + 1, cz], in1 = axis === 'x' ? [cx + h - 1, cy, cz] : [cx, cy + h - 1, cz];
        this.tri(c0, P(a0, 0, r0), P(a1, 0, r0), cc, spec, in0, uv && uv[0], uv && uv[0], uv && uv[0]);
        if (r1 > 0) this.tri(c1, P(a0, h, r1), P(a1, h, r1), cc, spec, in1, uv && uv[0], uv && uv[0], uv && uv[0]);
      }
    }
  }
  // side profile prism: pts [[z,y],...] star-shaped; extruded from x0 to x1
  prism(pts, x0, x1, col, spec, sideCol) {
    let cz = 0, cy = 0; for (const p of pts) { cz += p[0]; cy += p[1]; } cz /= pts.length; cy /= pts.length;
    const ref = [(x0 + x1) / 2, cy, cz];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      this.quad([x0, a[1], a[0]], [x0, b[1], b[0]], [x1, b[1], b[0]], [x1, a[1], a[0]], col, spec, ref);
      this.tri([x0, cy, cz], [x0, a[1], a[0]], [x0, b[1], b[0]], sideCol || col, spec, ref);
      this.tri([x1, cy, cz], [x1, a[1], a[0]], [x1, b[1], b[0]], sideCol || col, spec, ref);
    }
  }
  rock(cx, cy, cz, r, col, R, flatBottom) {
    // jittered octahedron-sphere (2 subdivisions)
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(q => q / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const J = V.map(v => 0.75 + R() * 0.5);
    const ref = [cx, cy, cz];
    for (const f of F) {
      const pts = f.map(i => { const v = V[i]; let y = v[1] * r * J[i]; if (flatBottom && y < 0) y *= 0.35; return [cx + v[0] * r * J[i], cy + y, cz + v[2] * r * J[i]]; });
      this.tri(pts[0], pts[1], pts[2], col, 0, ref);
    }
  }
  merge(g) { this.p.push(...g.p); this.n.push(...g.n); this.c.push(...g.c); this.u.push(...g.u); return this; }
  count() { return this.p.length / 3; }
}

// ---------- shaders ----------
const COMMON = `
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1.0,0.0)),u.x), mix(hash12(i+vec2(0.0,1.0)),hash12(i+vec2(1.0,1.0)),u.x), u.y); }
`;
// scene shaders write linear HDR (exposure applied) when a post chain follows, otherwise tonemap here
const OUTC = `
uniform float u_hdr;
vec4 outc(vec3 c, float a){ return u_hdr > 0.5 ? vec4(c * u_exp, a) : vec4(pow(aces(c * u_exp), vec3(1.0/2.2)), a); }
`;

// Cumulus on a plane about 900 m up (the height only sets their size on the ground and the parallax, not how the sky looks), fixed in the world and drifting with the wind. The sky draws it (looking
// from the camera) and the lit shader shades the ground with it (looking from each vertex toward the sun), so the
// shadows on the ground belong to the clouds overhead. "k" fades the fine octaves where they would alias.
const CLOUDS = `
float cfbm(vec2 p, float k){
  p += (vnoise(p*0.6 + 3.1) - 0.5) * 0.9;
  float s = vnoise(p) * 0.5; p = p * 2.03 + vec2(17.1, 9.2);
  s += vnoise(p) * 0.27; p = p * 2.01 + vec2(-3.3, 5.7);
  s += vnoise(p) * 0.15 * k; p = p * 2.02 + vec2(8.4, -6.1);
  s += vnoise(p) * 0.08 * k;
  return s / (0.77 + 0.23 * k);
}
float cbillow(vec2 p){ return 1.0 - abs(vnoise(p) * 2.0 - 1.0); }
vec2 cloudUV(vec3 o, vec3 d, float t){ return (o.xz / 900.0 + d.xz / (d.y + 0.12)) * 1.5 + vec2(t * 0.011, t * 0.005); }
float cloudLo(float cover){ return 0.7 - cover * 0.3; }
// density with cauliflower rims: billowy detail eats into the edge
float cloudN(vec2 uv, float k){ float bd = cbillow(uv * 5.3 + 7.0) * 0.6 + cbillow(uv * 11.7 - 3.0) * 0.4; return cfbm(uv, k) - (1.0 - bd) * 0.11 * k; }
`;

const LIT_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec4 a_col;
layout(location=3) in vec2 a_uv;
layout(location=4) in vec4 a_i0;
layout(location=5) in vec4 a_i1;
layout(location=6) in vec3 a_ic;
uniform mat4 u_model, u_vp, u_svp, u_svp2;
uniform vec2 u_shNo;
uniform float u_sway, u_time;
uniform vec3 u_hitPos; uniform float u_hitK;
uniform vec3 u_sunDir; uniform float u_cld;
out vec3 v_wp; out vec3 v_n; out vec4 v_col; out vec2 v_uv; out vec4 v_sp; out vec3 v_ic; out vec3 v_lp; out vec4 v_sp2; out float v_cs;
${COMMON}
${CLOUDS}
void main(){
  vec3 p = vec3(a_pos.x*a_i1.x, a_pos.y*a_i1.y, a_pos.z*a_i1.x);
  if (u_sway > 1.5) {
    // low ground cover: whole tuft leans with the breeze
    float ph = u_time*1.9 + a_i0.x*0.31 + a_i0.z*0.23;
    p.x += (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.4) * a_pos.y * 0.07;
    p.z += cos(ph * 0.8 + 0.6) * a_pos.y * 0.05;
  } else p.x += u_sway * sin(u_time*1.4 + a_i0.x*0.11 + a_i0.z*0.07) * max(a_pos.y-1.5,0.0)*0.025;
  if (u_sway > 0.0 && u_sway < 1.5 && u_hitK > 0.001) {
    float hk = u_hitK * (1.0 - smoothstep(0.6, 3.2, distance(a_i0.xz, u_hitPos.xz)));
    float hh = max(a_pos.y - 0.6, 0.0);
    p.x += hk * sin(u_time * 10.5) * hh * 0.045;
    p.z += hk * cos(u_time * 8.3) * hh * 0.03;
  }
  float c = cos(a_i0.w), s = sin(a_i0.w);
  vec3 q = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z) + a_i0.xyz;
  vec3 n = vec3(c*a_nrm.x + s*a_nrm.z, a_nrm.y, -s*a_nrm.x + c*a_nrm.z);
  vec4 wp = u_model * vec4(q, 1.0);
  v_lp = q;
  v_wp = wp.xyz; v_n = mat3(u_model) * n; v_col = a_col; v_uv = a_uv + vec2(a_i1.z, 0.0);
  v_ic = a_uv.y < -0.5 ? vec3(1.0) : a_ic;
  // shadow coordinates for both cascades, pushed out along the normal by about a texel of each (no acne, no peter-panning)
  vec3 nw = normalize(mat3(u_model) * n);
  v_sp = u_svp * vec4(wp.xyz + nw * u_shNo.x, 1.0);
  v_sp2 = u_svp2 * vec4(wp.xyz + nw * u_shNo.y, 1.0);
  // cloud shadow: is there cloud between this point and the sun? (per vertex: the field is hundreds of metres wide)
  v_cs = 1.0;
  if (u_cld > 0.0) {
    float lo = cloudLo(u_cld);
    v_cs = 1.0 - smoothstep(lo - 0.005, lo + 0.03, cloudN(cloudUV(wp.xyz, u_sunDir, u_time), 1.0)) * (0.7 + 0.3 * u_cld) * 0.68;
  }
  gl_Position = u_vp * wp;
}`;

const LIT_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_wp; in vec3 v_n; in vec4 v_col; in vec2 v_uv; in vec4 v_sp; in vec3 v_ic; in vec3 v_lp; in vec4 v_sp2; in float v_cs;
uniform vec3 u_sunDir, u_sunCol, u_sky, u_gnd, u_fogCol, u_cam;
uniform vec2 u_fog;
uniform int u_mode;
uniform vec3 u_tint;
uniform float u_alpha, u_exp;
uniform sampler2D u_tex;
uniform sampler2DShadow u_shadow;
uniform float u_shOn; uniform vec2 u_shTex;
uniform vec3 u_r1, u_r2, u_r3; uniform float u_lines, u_icy;
uniform vec3 u_hlPos, u_hlDir; uniform float u_hlOn;
uniform float u_dirt, u_carY; uniform vec3 u_dirtCol;
uniform vec3 u_zen, u_hor; uniform vec3 u_fol;
uniform vec3 u_verge, u_tt;
uniform vec3 u_glw; uniform float u_cld, u_time, u_gbump; uniform vec4 u_fogLo;
uniform float u_wet; uniform vec3 u_skyline;
out vec4 o;
${COMMON}
${OUTC}
// sky seen in a reflection: zenith to horizon above, dark ground bounce below, with a crisp horizon line
vec3 envRefl(vec3 R){
  vec3 sky = mix(u_hor, u_zen, pow(clamp(R.y, 0.0, 1.0), 0.5));
  sky += u_glw * pow(max(dot(R, u_sunDir), 0.0), 5.0) * (1.0 - clamp(R.y * 1.5, 0.0, 1.0)); // the warm haze around the sun
  // a broken skyline (treetops, hills, buttes) along the horizon, so paint and glass reflect a horizon line instead
  // of a plain gradient: that line sliding over the panels is most of what makes a body read as glossy and curved
  float az = atan(R.z, R.x);
  float hz = 0.03 + 0.055 * vnoise(vec2(az * 5.0, 3.0)) + 0.035 * vnoise(vec2(az * 21.0, 7.0));
  sky = mix(sky, u_skyline, (1.0 - smoothstep(hz - 0.015, hz + 0.004, R.y)) * smoothstep(-0.06, 0.0, R.y));
  return mix(u_gnd * 0.5, sky, smoothstep(-0.03, 0.025, R.y));
}
// two cascades side by side in one depth atlas (left: near, sharp; right: far). 12 Poisson taps rotated per
// pixel, each a hardware 2x2 compare, give a soft edge without the blocky steps of a fixed grid. The first four
// sit on the rim of the disc about 90 degrees apart: when they agree, the pixel is fully lit or fully in shadow
// and the other eight are skipped. Only penumbrae pay for all twelve (most of the screen costs a third).
const vec2 PD[12] = vec2[12](vec2(-0.696, 0.457), vec2(0.519, 0.767), vec2(0.962, -0.195), vec2(-0.322, -0.933),
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.203, 0.621), vec2(0.473, -0.480), vec2(0.185, -0.893),
  vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.792, -0.598));
float pcf(vec3 sp, float x0, float rad, float bias){
  float a = hash12(gl_FragCoord.xy) * 6.2832, ca = cos(a), sa = sin(a);
  vec2 k = vec2(2.0 * u_shTex.x, u_shTex.y) * rad;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(ca * PD[i].x - sa * PD[i].y, sa * PD[i].x + ca * PD[i].y) * k;
    s += textureLod(u_shadow, vec3(clamp(sp.x + o.x, 0.002, 0.998) * 0.5 + x0, sp.y + o.y, sp.z - bias), 0.0);
  }
  if (s < 0.001 || s > 3.999) return s * 0.25;
  for (int i = 4; i < 12; i++) {
    vec2 o = vec2(ca * PD[i].x - sa * PD[i].y, sa * PD[i].x + ca * PD[i].y) * k;
    s += textureLod(u_shadow, vec3(clamp(sp.x + o.x, 0.002, 0.998) * 0.5 + x0, sp.y + o.y, sp.z - bias), 0.0);
  }
  return s / 12.0;
}
float shadowF(){
  vec3 s1 = v_sp2.xyz / v_sp2.w * 0.5 + 0.5;
  float m1 = max(abs(s1.x - 0.5), abs(s1.y - 0.5));
  if (m1 > 0.5 || s1.z > 1.0) return 1.0;
  vec3 s0 = v_sp.xyz / v_sp.w * 0.5 + 0.5;
  float m0 = max(abs(s0.x - 0.5), abs(s0.y - 0.5));
  float far = 1.0, k = 1.0;
  if (m0 < 0.48 && s0.z < 1.0) k = smoothstep(0.38, 0.48, m0);
  if (k > 0.0) far = mix(pcf(s1, 0.5, 1.3, 0.0004), 1.0, smoothstep(0.42, 0.5, m1));
  if (k >= 1.0) return far;
  return mix(pcf(s0, 0.0, 1.7, 0.0003), far, k);
}
void main(){
  vec3 base = v_col.rgb * v_ic * u_tint;
  vec3 n = normalize(v_n);
  float spec = v_col.a;
  float dist = length(v_wp - u_cam);
  float aOut = u_alpha;
  float bh = 0.0, bk = 0.0;   // micro relief (height, metres of amplitude) for bump shading
  float sparkle = 0.0, foliage = 0.0, flk = 0.0;
  if (u_mode == 1) {
    float u = v_uv.x, v = v_uv.y, au = abs(u);
    vec2 m = vec2(u * 4.3, v);                       // metres across / along the road
    float fw = length(fwidth(m));                    // metres per pixel
    float fine = 1.0 - smoothstep(0.012, 0.05, fw);  // detail that would shimmer fades out with distance
    float mid = 1.0 - smoothstep(0.06, 0.25, fw);
    float n1 = vnoise(vec2(u*5.0, v*0.8)), n3 = vnoise(vec2(u*2.0+5.0, v*0.11));
    float n4 = vnoise(vec2(u*14.0, v*2.5));
    float wob = (vnoise(vec2(3.0, v*0.035)) - 0.5) * 0.12; // the ruts wander a little
    float rut = exp(-pow((au - 0.42 + wob)/0.13, 2.0)) * (0.75 + 0.25*n4);
    float damp = smoothstep(0.45, 0.8, vnoise(m*vec2(0.3, 0.07) + 11.0));
    vec3 c = mix(u_r1, u_r2, clamp(rut*(0.55+0.5*n1), 0.0, 1.0));
    if (u_lines > 0.5) {
      // tarmac: aggregate grain, rubbered-in wheel lines, repair patches, sealed cracks
      float agg = vnoise(m*30.0)*0.55 + vnoise(m*83.0)*0.45;
      c *= 1.0 + (mix(0.5, agg, fine) - 0.5) * 0.24;
      c = mix(c, u_r3, smoothstep(0.74, 0.92, vnoise(m*57.0 + 9.0)) * 0.3 * fine);
      vec2 pg = m / vec2(3.1, 9.0), pf = fract(pg);
      float box = step(0.86, hash12(floor(pg) + 17.0)) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.72);
      c = mix(c, u_r2 * 0.82, box * 0.5);
      // cracks run mostly along the road (stretched noise contour, wobbling), only in some stretches
      vec2 wq = m * vec2(0.9, 0.3);
      float cn = vnoise(vec2(m.x * 1.3, m.y * 0.09) + vec2(vnoise(wq), vnoise(wq + 4.0)) * 0.6);
      float crack = (1.0 - smoothstep(0.0, 0.005 + fw*0.5, abs(cn - 0.5))) * smoothstep(0.6, 0.8, vnoise(m * vec2(0.25, 0.04) + 3.0)) * mid;
      c = mix(c, u_r2 * 0.5, crack * 0.75);
      c = mix(c, u_verge, smoothstep(0.78, 1.02, au + (n1 - 0.5)*0.16) * 0.3); // sand blown onto the edges
      c *= 0.9 + 0.2*n3;
      float e = smoothstep(0.855, 0.87, au) * (1.0 - smoothstep(0.905, 0.92, au));
      c = mix(c, vec3(0.75), e * 0.9 * (0.65 + 0.35*n1));
      float cl = (1.0 - smoothstep(0.012, 0.025, au)) * step(0.5, fract(v/9.0));
      c = mix(c, vec3(0.7,0.62,0.25), cl*0.8);
      spec = 0.1 + crack * 0.15 + box * 0.04 + (e + cl) * 0.1;
      bh = (agg * fine * 0.7 - crack * 0.6) * (1.0 - e); bk = 0.006;
    } else if (u_icy > 0.5) {
      // packed snow: crusty between the ruts, polished ice in them, loose powder pushed to the sides
      float crust = vnoise(m*7.0)*0.6 + vnoise(m*19.0)*0.4;
      float streak = vnoise(vec2(m.x*18.0, m.y*0.3));
      c *= 0.93 + 0.13 * mix(0.5, crust, mid);
      c = mix(c, u_r2 * 0.92, rut * smoothstep(0.45, 0.8, streak) * 0.35 * mid);
      c = mix(c, u_r3, (1.0 - rut) * smoothstep(0.5, 0.85, vnoise(m*vec2(1.5, 0.6) + 2.0)) * 0.55);
      c *= 0.9 + 0.18*n3;
      spec = u_icy * rut * (0.6 + 0.4*streak) * 0.9;
      bh = crust * mid * (1.0 - rut*0.7); bk = 0.012;
      sparkle = (1.0 - rut) * fine;
    } else {
      // gravel: compacted wheel lines with tyre streaks, loose stones on the crown and the shoulders, damp patches
      // stones are cells, not noise blobs: small gravel everywhere (pressed flat in the wheel lines), bigger loose
      // stones on the crown and the shoulders, darker fines in the gaps, each stone its own shade
      float loose = clamp(1.0 - rut*1.3, 0.0, 1.0) * (0.6 + 0.4*n1);
      // stone cells come from a pre-computed Voronoi texture (world.js gravelTex): small stones in rgb (shade, joint,
      // dome), sparse bigger ones in a, read through two different rotations so the tiles never line up
      vec4 ga = texture(u_tex, vec2(m.x * 0.94 - m.y * 0.34, m.x * 0.34 + m.y * 0.94));
      vec4 gb = texture(u_tex, vec2(m.x * 0.82 + m.y * 0.57, m.y * 0.82 - m.x * 0.57) + 0.37);
      float big = smoothstep(0.03, 0.2, gb.a) * loose, bs = clamp((gb.a - 0.25) / 0.75, 0.0, 1.0);
      float flat0 = mix(1.0, 0.45, rut);  // wheels have pressed the small stones into the surface
      c *= 1.0 + (ga.r - 0.5) * 0.36 * fine * flat0;
      c *= mix(1.0, 0.74, (1.0 - ga.g) * fine * flat0 * (0.5 + 0.5*loose));
      c = mix(c, c * (0.78 + 0.5 * bs), big * 0.8 * fine);
      c = mix(c, u_r3, 0.05 * (0.5 + 0.8*loose) * (1.0 - fine));  // far away: just the average lighter tone
      float streak = vnoise(vec2(m.x*22.0, m.y*0.35));
      c *= 1.0 - rut * (streak - 0.5) * 0.3 * mid;
      c *= 0.84 + 0.3*n3;
      c = mix(c, c * vec3(0.74, 0.72, 0.7), damp * 0.45);
      spec = damp * 0.08 * (1.0 - loose);
      bh = (ga.b * ga.g * 0.5 * flat0 + gb.a * loose * 0.7) * fine + loose * 0.5 * mid; bk = 0.006;
    }
    // ragged edge where the surface meets the verge, instead of a ruled line
    float edge = au + (vnoise(vec2(v*0.5, 1.0)) - 0.5)*0.1 + (vnoise(m*2.5) - 0.5)*0.06;
    c = mix(c, u_verge, smoothstep(0.93, 1.02, edge) * (u_lines > 0.5 ? 0.5 : 0.8));
    if (u_wet > 0.0) {
      // rain: a dark, glossy film everywhere, and standing water in the dips of the wheel lines that mirrors the sky
      vec2 pq = m * vec2(0.55, 0.16);
      float pn = vnoise(pq + 21.0) * 0.62 + vnoise(pq * 2.7 + 5.0) * 0.38;
      float pd = smoothstep(0.64, 0.78, pn + rut * (u_lines > 0.5 ? 0.04 : 0.16)) * (1.0 - smoothstep(0.75, 0.9, au)) * (u_lines > 0.5 ? 0.75 : 1.0);
      c *= mix(1.0, 0.8, u_wet) * (1.0 - pd * 0.22);
      spec = max(spec, u_wet * mix(u_lines > 0.5 ? 0.36 : 0.18, 0.85, pd));
      bk *= 1.0 - pd * 0.85; // water lies flat over the stones
    }
    base = c;
  } else if (u_mode == 8) {
    // foliage: needle clumps in the vertex colour, and (below) light coming through when the sun is behind
    float nn = vnoise(v_wp.xz * 2.1 + v_wp.y * 1.3) * 0.6 + vnoise(vec2(v_wp.x + v_wp.z, v_wp.y) * 5.3) * 0.4;
    base *= 0.86 + 0.28 * nn;
    foliage = 1.0;
    // coordinate running across the current face (faces are flat, so the angle alone would be constant on each)
    float fu = dot(v_wp.xz, vec2(n.z, -n.x));
    float fl = 1.0 - smoothstep(0.04, 0.2, length(fwidth(v_wp)));
    {
      // needles hanging off the branch: streaks that follow the slope, with clumps and a few bright tips
      float nd = vnoise(vec2(fu * 13.0, v_wp.y * 1.6)) * 0.55 + vnoise(vec2(fu * 31.0, v_wp.y * 4.5)) * 0.45;
      float clump = vnoise(vec2(fu * 3.1, v_wp.y * 0.8 + 3.0));
      base *= mix(1.0, 0.62 + 0.8 * nd + 0.3 * (clump - 0.5), 0.9 * fl);
      base = mix(base, base * vec3(1.25, 1.3, 0.8), smoothstep(0.78, 0.95, vnoise(vec2(fu * 17.0, v_wp.y * 5.0 + 9.0))) * 0.5 * fl);
    }
    if (spec > 0.015 && spec < 0.03) {
      // cactus: vertical ribs with pale spines along the crests, a waxy dull sheen
      float ang = atan(n.x, n.z);
      float rib = abs(sin(ang * 5.0 + v_wp.y * 0.0));
      float sp = step(0.93, vnoise(vec2(ang * 22.0, v_wp.y * 11.0))) * smoothstep(0.7, 1.0, rib);
      base *= 0.7 + 0.45 * rib;
      base = mix(base, vec3(0.55, 0.5, 0.35), sp * 0.8);
      foliage = 0.0; spec = 0.0;
    }
    if (v_uv.y < -0.5 && dot(base, vec3(0.333)) < 0.12) {
      // bark: vertical furrows that follow the trunk's own angle, knots, paler plates, darker at the foot
      float fur = vnoise(vec2(fu * 22.0, v_wp.y * 0.7)), fin = vnoise(vec2(fu * 61.0, v_wp.y * 2.3));
      float knot = smoothstep(0.8, 0.92, vnoise(vec2(fu * 9.0 + 4.0, v_wp.y * 1.5)));
      base = base / max(dot(base, vec3(0.333)), 0.001) * 0.05 * vec3(1.0); // reset the canopy streaks, then build the bark
      base *= vec3(1.15, 0.95, 0.8) * (0.4 + 1.2 * fur * (0.65 + 0.7 * fin)) * (1.0 - knot * 0.45);
      foliage = 0.0;
      bh = fur + fin * 0.5; bk = 0.05;
    }
  } else if (u_mode == 10) {
    // trees: needle sprays / leaf clumps cut out of a painted atlas, edges by alpha-to-coverage; bark (uv.y shifted
    // below -0.5, untinted) and the dense inner crown are opaque. Back faces of the sprays take the flipped normal,
    // so the underside of a branch sits in its own shade.
    bool bark = v_uv.y < -0.5;
    vec2 tuv = bark ? v_uv + vec2(0.0, 2.0) : v_uv;
    vec4 t = texture(u_tex, tuv);
    if (!bark && tuv.x < 0.5) {
      vec2 tc = tuv * 512.0; vec2 ddx = dFdx(tc), ddy = dFdy(tc);
      float lod = max(0.0, 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy))));
      float a = t.a * (1.0 + lod * 0.32);
      if (u_fol.z > 0.5) { a = clamp((a - 0.5) / max(fwidth(a), 0.0001) + 0.5, 0.0, 1.0); if (a < 0.01) discard; }
      else if (a < 0.5) discard;
      aOut = a;
      if (!gl_FrontFacing) n = -n;
    }
    base *= t.rgb;
    if (!bark) {
      foliage = 1.0;
      // snow lying on the upper side of the branches (Frostvik)
      if (u_icy > 0.5) {
        float sn = smoothstep(0.42, 0.72, n.y + (vnoise(v_wp.xz * 2.7 + v_wp.y * 1.9) - 0.5) * 0.45);
        base = mix(base, vec3(0.78, 0.82, 0.9), sn * 0.88);
      }
    }
  } else if (u_mode == 11) {
    base *= texture(u_tex, v_uv).rgb; // vertex colour × texture, nothing more (tyre lettering)
  } else if (u_mode == 2) {
    vec4 t = texture(u_tex, v_uv);
    if (t.a < 0.5) discard;
    base = t.rgb * u_tint * v_ic;
  } else if (u_mode == 5) {
    base = v_col.rgb * texture(u_tex, v_uv).rgb * u_tint;
    // metallic paint: fine grain in the colour and a scatter of flakes that catch the sun (keyed on model-space position, so it rides with the car)
    float fadeL = 1.0 - smoothstep(0.004, 0.02, length(fwidth(v_lp)));
    float paint = smoothstep(0.4, 0.58, spec);
    float fk = vnoise(v_lp.xy * 140.0 + v_lp.zz * 90.0) * 0.5 + vnoise(v_lp.zy * 300.0 + v_lp.xx * 200.0) * 0.5;
    base *= 1.0 + (fk - 0.5) * 0.18 * paint * fadeL;
    flk = step(0.9975, hash12(floor(v_lp.xz * 240.0) + floor(v_lp.y * 240.0) * 31.0)) * paint * fadeL;
    // occlusion: the lower body sees less sky and catches the shade of the car itself
    base *= mix(0.62, 1.0, smoothstep(0.18, 0.62, v_lp.y));
  } else if (u_mode == 9) {
    // ground: the same broad variation as mode 3, then two layers of a tiling detail texture (blades, needles,
    // ripples or grain depending on the stage) sampled at different scales and rotations. Mipmaps average it out
    // with distance, so it never shimmers; its luminance doubles as a height for the bump shading.
    float d = vnoise(v_wp.xz*0.45)*0.45 + vnoise(v_wp.xz*1.9)*0.25 + vnoise(v_wp.xz*0.05)*0.5;
    base *= 0.68 + 0.45*d;
    float up = smoothstep(0.5, 0.88, n.y);
    float pm = smoothstep(0.42, 0.78, vnoise(v_wp.xz*0.021 + 31.0) * 0.7 + vnoise(v_wp.xz*0.09) * 0.3);
    base = mix(base, base * u_tt, pm * 0.6 * up);
    vec2 gp = v_wp.xz;
    vec3 d1 = texture(u_tex, gp / 3.4).rgb, d2 = texture(u_tex, mat2(0.8, 0.6, -0.6, 0.8) * gp / 1.17 + 0.37).rgb;
    vec3 det = d1 * d2 * 4.0;
    base *= mix(vec3(1.0), det, 0.85 * up);
    float hh = dot(d1, vec3(0.333)) * 0.6 + dot(d2, vec3(0.333)) * 0.4;
    bh = (hh - 0.5) * up; bk = u_gbump;
    float steep = 1.0 - up;
    if (steep > 0.01) {
      // cliffs and cut banks: layered rock (bands that wander a little in height) instead of ground texture smeared down the face
      float wy = v_wp.y + (vnoise(vec2(v_wp.x + v_wp.z, 0.0) * 0.12) - 0.5) * 3.0;
      float bands = vnoise(vec2((v_wp.x * 0.7 + v_wp.z * 0.5) * 0.25, wy * 2.3)) * 0.55 + vnoise(vec2((v_wp.x - v_wp.z) * 0.9, wy * 7.5)) * 0.3 + vnoise(v_wp.xy * 3.1 + v_wp.zz * 2.3) * 0.15;
      base *= 1.0 + (bands - 0.5) * 0.5 * steep;
      bh += bands * steep * 1.5;
    }
    sparkle = u_icy * up * (1.0 - smoothstep(0.02, 0.09, length(fwidth(v_wp.xz))));
    spec += u_wet * 0.07 * up; // wet grass and mud catch a dull sheen
  } else if (u_mode == 3) {
    float d = vnoise(v_wp.xz*0.45)*0.45 + vnoise(v_wp.xz*1.9)*0.25 + vnoise(v_wp.xz*0.05)*0.5;
    base *= 0.68 + 0.45*d;
    // rock: strata bands that tilt with the slice of the world they're cut from, speckle, a few hairline cracks
    float fr = 1.0 - smoothstep(0.03, 0.12, length(fwidth(v_wp)));
    float bands = vnoise(vec2((v_wp.x * 0.7 + v_wp.z * 0.5) * 0.35, v_wp.y * 7.0)) * 0.6 + vnoise(vec2((v_wp.x - v_wp.z) * 1.4, v_wp.y * 19.0)) * 0.4;
    float spk = vnoise(v_wp.xy * 11.0 + v_wp.z * 7.0);
    float crk = 1.0 - smoothstep(0.0, 0.045, abs(vnoise(v_wp.xy * 2.3 + v_wp.zz * 1.7) - 0.5));
    float steep = 1.0 - smoothstep(0.55, 0.9, n.y);
    base *= 1.0 + ((bands - 0.5) * 0.55 + (spk - 0.5) * 0.3 * fr - crk * 0.35 * fr) * mix(0.35, 1.0, steep);
    // ground: broad patches with a hue shift (dry grass, wind-packed snow, redder sand), close-up grain with relief
    float up = smoothstep(0.55, 0.9, n.y);
    float fine = 1.0 - smoothstep(0.025, 0.1, length(fwidth(v_wp.xz)));
    float pm = smoothstep(0.42, 0.78, vnoise(v_wp.xz*0.021 + 31.0) * 0.7 + vnoise(v_wp.xz*0.09) * 0.3);
    base = mix(base, base * u_tt, pm * 0.6 * up);
    float gr = vnoise(v_wp.xz*6.0)*0.6 + vnoise(v_wp.xz*17.0 + 5.0)*0.4;
    base *= 1.0 + (gr - 0.5) * 0.3 * fine * up;
    bh = gr * up * fine; bk = 0.03;
    sparkle = u_icy * up * fine;
  } else if (u_mode == 6) {
    float a = texture(u_tex, v_uv).a * u_alpha * (1.0 - smoothstep(u_fog.x, u_fog.y, dist));
    if (u_hdr > 0.5) a = 1.0 - pow(1.0 - a, 2.2); // same perceived darkening in linear space
    o = vec4(0.0, 0.0, 0.0, a);
    return;
  } else if (u_mode == 7) {
    // ground cover: alpha-to-coverage edges, fades out with distance before it can shimmer
    vec4 t = texture(u_tex, v_uv);
    // keep coverage as mips average the thin blades away
    vec2 tc = v_uv * vec2(512.0, 256.0); vec2 ddx = dFdx(tc), ddy = dFdy(tc);
    float lod = max(0.0, 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy))));
    float fade = 1.0 - smoothstep(u_fol.x, u_fol.y, dist);
    float a = t.a * (1.0 + lod * 0.28) * fade;
    if (u_fol.z > 0.5) { a = clamp((a - 0.5) / max(fwidth(a), 0.0001) + 0.5, 0.0, 1.0); if (a < 0.01) discard; }
    else if (a < 0.5) discard;
    aOut = a;
    base = t.rgb * u_tint * v_ic;
  } else if (u_mode == 4) {
    vec3 col = base;
    col = mix(col, u_fogCol, smoothstep(u_fog.x, u_fog.y, dist) * 0.7);
    o = outc(col, u_alpha);
    return;
  }
  if (u_dirt > 0.0) {
    float ly = v_wp.y - u_carY;
    float nn = vnoise(v_uv * vec2(70.0, 110.0)) * 0.5 + vnoise(v_uv * vec2(14.0, 22.0)) * 0.5;
    float m = clamp(u_dirt * (1.0 - smoothstep(0.25, 1.05, ly)) * (0.45 + 0.75 * nn), 0.0, 0.85);
    base = mix(base, u_dirtCol, m);
    spec *= 1.0 - m * 0.85;
  }
  if (bk > 0.0) {
    // bump from the procedural height (surface-gradient method, no tangents needed)
    vec3 dpx = dFdx(v_wp), dpy = dFdy(v_wp);
    vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
    float det = dot(dpx, r1);
    float hb = bh * bk * (1.0 - smoothstep(u_fog.x * 0.3, u_fog.x, dist));
    vec3 sg = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
    n = normalize(abs(det) * n - sg);
  }
  float sh = u_shOn > 0.5 ? shadowF() : 1.0;
  sh *= v_cs; // shadow of the actual clouds overhead (see CLOUDS)
  float ndl = max(dot(n, u_sunDir), 0.0);
  vec3 amb = mix(u_gnd, u_sky, n.y*0.5 + 0.5);
  vec3 light = amb + u_sunCol * ndl * sh;
  if (u_hlOn > 0.0) {
    vec3 L = u_hlPos - v_wp; float d = length(L); L /= d;
    float cone = smoothstep(0.80, 0.96, dot(-L, u_hlDir));
    float att = 1.0 / (1.0 + d*d*0.0022);
    light += vec3(1.0, 0.92, 0.78) * 4.0 * cone * att * max(dot(n, L)*0.8+0.2, 0.0) * u_hlOn;
  }
  vec3 col = base * light;
  if (spec > 0.0) {
    // glossy surfaces: Fresnel-weighted sky reflection (clearcoat paint, glass, ice) plus a sharp sun glint;
    // spec >= 0.75 marks bare metal, whose reflection takes the surface colour
    vec3 V = normalize(u_cam - v_wp);
    if (dot(n, V) < 0.0) n = -n;
    float ndv = max(dot(n, V), 0.0);
    float metal = step(0.75, spec);
    float F0 = mix(0.05, 0.55, metal);
    float F = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
    vec3 refl = envRefl(reflect(-V, n)) * F * spec * mix(2.0, 1.35, metal);
    if (metal > 0.5) refl *= base * 1.6 + 0.15;
    col = col * (1.0 - F * spec * 0.55) + refl * mix(0.55, 1.0, sh);
    vec3 H = normalize(V + u_sunDir);
    float nh = max(dot(n, H), 0.0);
    col += u_sunCol * (pow(nh, 600.0) * 5.0 + pow(nh, 70.0) * 0.22) * spec * sh * (0.35 + F);
  }
  if (foliage > 0.0) {
    float back = pow(max(dot((v_wp - u_cam) / max(dist, 1e-3), u_sunDir), 0.0), 5.0);
    col += base * u_sunCol * 0.5 * back * (0.35 + 0.65 * sh);
  }
  if (flk > 0.0) {
    vec3 Vf = normalize(u_cam - v_wp);
    float tw = step(0.45, fract(dot(Vf, vec3(37.0, 41.0, 43.0)) + hash12(floor(v_lp.xz * 240.0))));
    col += u_sunCol * mix(vec3(1.0), clamp(base * 4.0, 0.0, 1.5), 0.65) * sh * flk * tw * 0.55 * max(dot(n, u_sunDir), 0.0);
  }
  if (sparkle > 0.0) {
    // ice crystals: rare points that catch the sun (or the headlights) and flicker as the view moves
    vec2 cell = floor(v_wp.xz * 40.0);
    float hs = hash12(cell);
    if (hs > 0.992) {
      vec3 V = normalize(u_cam - v_wp);
      float tw = step(0.62, fract(hs * 173.0 + dot(V, vec3(23.0, 17.0, 29.0))));
      vec3 L = u_hlOn > 0.0 ? normalize(u_hlPos - v_wp) : u_sunDir;
      col += (u_sunCol * sh + vec3(u_hlOn * 1.2)) * tw * sparkle * 1.2 * max(dot(n, L), 0.0) * (1.0 - smoothstep(4.0, 30.0, dist));
    }
  }
  // fog with sun in-scatter: distant ground glows warm towards the sun, same term as the sky's horizon
  vec3 vd = (v_wp - u_cam) / max(dist, 1e-3);
  vec3 fc = u_fogCol + u_glw * pow(max(dot(vd, u_sunDir), 0.0), 5.0);
  float fk = smoothstep(u_fog.x, u_fog.y, dist);
  // far scenery: the haze is thick near the ground and thins with height, so mountains and mesas rise out of it
  // (their feet as hazy as the terrain in front of them) instead of floating clear above a band of fog
  if (u_fogLo.y > 0.0) fk = mix(max(fk, smoothstep(u_fogLo.x, u_fogLo.y, dist) * 0.8), fk, smoothstep(0.0, u_fogLo.z, v_wp.y - u_fogLo.w));
  col = mix(col, fc, fk);
  o = outc(col, aOut);
}`;

const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=4) in vec4 a_i0;
layout(location=5) in vec4 a_i1;
uniform mat4 u_model, u_svp;
void main(){
  vec3 p = vec3(a_pos.x*a_i1.x, a_pos.y*a_i1.y, a_pos.z*a_i1.x);
  float c = cos(a_i0.w), s = sin(a_i0.w);
  vec3 q = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z) + a_i0.xyz;
  gl_Position = u_svp * u_model * vec4(q, 1.0);
}`;
const DEPTH_FS = `#version 300 es
precision mediump float;
void main(){}`;

const SKY_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_p;
void main(){ v_p = a_pos; gl_Position = vec4(a_pos, 0.99999, 1.0); }`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 v_p;
uniform mat4 u_ivp; uniform vec3 u_cam;
uniform vec3 u_zen, u_hor, u_sunDir, u_sunCol, u_glow, u_cloud;
uniform float u_exp, u_time, u_clouds, u_stars, u_ovc;
out vec4 o;
${COMMON}
${OUTC}
${CLOUDS}
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main(){
  vec4 w = u_ivp * vec4(v_p, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w - u_cam);
  float y = d.y, yc = clamp(y, 0.0, 1.0);
  vec3 S = u_sunDir;
  float sd = max(dot(d, S), 0.0), x = 1.0 - sd;
  float az = dot(normalize(d.xz + 1e-5), normalize(S.xz)) * 0.5 + 0.5; // 1 toward the sun, 0 away

  // scattering: warm haze on the sun side, cooler and deeper away from it. The horizon line itself
  // stays on the fog colour so distant terrain melts into it.
  float up = smoothstep(0.0, 0.14, y);
  vec3 hor = u_hor * mix(vec3(1.0), mix(vec3(0.84, 0.93, 1.08), vec3(1.05, 1.0, 0.93), az), up);
  vec3 zen = u_zen * mix(0.9, 1.04, az);
  vec3 c = mix(hor, zen, pow(yc, 0.5));
  float lowSun = 1.0 - clamp(y * 1.5, 0.0, 1.0);
  c += u_glow * (pow(sd, 4.0) * 0.2 + pow(sd, 16.0) * 0.38 + pow(sd, 90.0) * 0.3) * (0.3 + 0.7 * lowSun);

  // faint stars, only where the sky is dark (Frostvik dusk)
  if (u_stars > 0.0 && y > 0.05) {
    vec3 q = d * 280.0, id = floor(q), f = fract(q);
    float h = hash12(id.xy + id.z * 17.31 + 5.7);
    if (h > 0.985) {
      vec3 ctr = vec3(hash12(id.xy + 7.3 + id.z), hash12(id.yz + 1.9), hash12(id.zx + 4.4)) * 0.6 + 0.2;
      float st = smoothstep(0.24, 0.0, length(f - ctr)) * (0.35 + 0.65 * (h - 0.985) / 0.015);
      st *= 0.8 + 0.2 * sin(u_time * 2.7 + h * 311.0);
      c += vec3(0.85, 0.92, 1.0) * st * u_stars * smoothstep(0.05, 0.4, y) * (1.0 - smoothstep(0.02, 0.14, lum(c)));
    }
  }

  float sunVis = 1.0;
  if (y > 0.0) {
    // high cirrus: thin streaks stretched along the wind, lit from the sun side
    vec2 cu = u_cam.xz / 8000.0 + d.xz / (y + 0.06);
    vec2 cq = vec2(cu.x * 0.5 + u_time * 0.003, cu.y * 1.8);
    float ci = vnoise(cq) * 0.55 + vnoise(cq * vec2(2.1, 2.6) + 4.0) * 0.3 + vnoise(cq * vec2(4.3, 5.5)) * 0.15;
    ci = smoothstep(0.5, 0.88, ci) * smoothstep(0.08, 0.42, y) * (0.3 + 0.5 * u_clouds);
    vec3 cic = mix(u_cloud, u_glow, 0.25 * lowSun) * (0.75 + 0.7 * pow(sd, 3.0));
    c = mix(c, cic, ci * 0.4);
    sunVis -= ci * 0.2;

    // altocumulus: a higher sheet of small puffs in patches, drifting a little faster than the cumulus
    vec2 ua = (u_cam.xz / 4000.0 + d.xz / (y + 0.05)) * 4.2 + vec2(u_time * 0.006, u_time * 0.001) + 13.0;
    float na = vnoise(ua) * 0.6 + vnoise(ua * 2.3 + 5.0) * 0.28 + vnoise(ua * 5.1) * 0.12;
    float aa = smoothstep(0.66, 0.8, na) * smoothstep(0.45, 0.75, vnoise(ua * 0.17 + 2.0)) * smoothstep(0.1, 0.4, y) * u_clouds * 0.55;
    vec3 ac = mix(u_cloud * vec3(0.86, 0.89, 0.96), u_cloud * (1.0 + 0.4 * pow(sd, 4.0)), smoothstep(0.66, 0.85, na));
    c = mix(c, mix(ac, hor, (1.0 - smoothstep(0.1, 0.5, y)) * 0.5), aa);
    sunVis -= aa * 0.3;

    // cumulus layer: projected on a plane, density sampled twice (here and toward the sun)
    // for self-shadowing; thin edges facing the sun get a silver lining
    if (u_clouds > 0.0) {
      float k = smoothstep(0.03, 0.3, y);
      vec2 uv = cloudUV(u_cam, d, u_time);
      float lo = cloudLo(u_clouds);
      float n0 = cloudN(uv, k);
      float a0 = smoothstep(lo, lo + 0.1, n0);
      if (a0 > 0.002) {
        vec2 toSun = normalize(S.xz + 1e-5) * mix(0.3, 0.1, S.y);
        float n1 = cfbm(uv + toSun, k);
        float lit = clamp(0.6 + (n0 - n1) * 4.5, 0.0, 1.0);
        vec3 tint = mix(vec3(1.0), u_sunCol / max(max(u_sunCol.r, max(u_sunCol.g, u_sunCol.b)), 1e-3), 0.55);
        vec3 bright = u_cloud * tint * (0.95 + 0.5 * pow(sd, 3.0));
        vec3 shade = mix(u_cloud * vec3(0.46, 0.53, 0.68), zen, 0.25) * 0.75;
        float thick = smoothstep(lo + 0.03, lo + 0.3, n0);
        vec3 cc = mix(shade, bright, lit * (1.0 - 0.4 * thick));
        // overhead we look at the flat, shadowed bases; toward the horizon at the sunlit flanks
        cc = mix(cc, shade * 0.9, thick * smoothstep(0.12, 0.65, y) * 0.5);
        float edge = (1.0 - thick) * a0;
        cc += u_sunCol * pow(sd, 10.0) * edge * 1.4;
        cc = mix(cc, hor, (1.0 - smoothstep(0.0, 0.4, y)) * 0.6); // aerial perspective toward the horizon
        float al = a0 * (0.7 + 0.3 * u_clouds) * smoothstep(0.0, 0.16, y);
        c = mix(c, cc, al);
        sunVis -= al * 0.9;
      }
    }
  }

  if (u_ovc > 0.0 && y > -0.05) {
    // overcast: a low, even deck that the cumulus melt into, a little brighter where the sun is behind it
    float deck = vnoise(cloudUV(u_cam, d, u_time) * 0.7) * 0.6 + vnoise(cloudUV(u_cam, d, u_time) * 2.1 + 3.0) * 0.4;
    vec3 oc = u_cloud * (0.82 + 0.22 * deck + 0.25 * pow(sd, 6.0)) * mix(1.0, 0.86, smoothstep(0.1, 0.8, y));
    c = mix(c, mix(oc, u_hor, 1.0 - smoothstep(0.0, 0.3, y)), u_ovc * smoothstep(-0.05, 0.12, y));
    sunVis -= u_ovc * 1.25;
  }
  // sun: soft limb, tight corona and a wide halo, dimmed by cloud in front of it
  float disc = 1.0 - smoothstep(2.2e-5, 4.6e-5, x);
  c += u_sunCol * (disc * 26.0 + exp(-x * 420.0) * 1.2 + exp(-x * 50.0) * 0.2) * clamp(sunVis, 0.0, 1.0);

  // a paler haze band sitting just above the horizon, then the horizon itself on the fog colour
  c = mix(c, c * 1.06 + u_hor * 0.06, smoothstep(0.16, 0.02, y) * smoothstep(-0.01, 0.03, y));
  c = mix(c, u_hor + u_glow * 0.35 * pow(max(dot(d, S), 0.0), 5.0), 1.0 - smoothstep(-0.02, 0.06, y));
  c *= 1.0 + (hash12(gl_FragCoord.xy) - 0.5) * 0.01; // dither against banding in the gradient
  o = outc(c, 0.0); // alpha 0 marks sky in the HDR target (light shafts use it as their source mask)
}`;

const PT_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in float a_size;
uniform mat4 u_vp; uniform vec3 u_cam; uniform float u_ps;
out vec4 v_col; out float v_d;
void main(){
  float d = length(a_pos - u_cam); v_d = d;
  // the sprite is flat, so tested at its centre's depth it cuts a hard line where it meets the road; test it at the
  // depth of its front (half its size towards the camera) instead, keeping its place on screen
  vec4 cc = u_vp * vec4(a_pos, 1.0);
  vec4 cf = u_vp * vec4(a_pos + (u_cam - a_pos) / max(d, 1e-3) * min(a_size * 0.5, d * 0.8), 1.0);
  gl_Position = vec4(cc.xy / cc.w * cf.w, cf.z, cf.w);
  gl_PointSize = clamp(a_size * u_ps / max(d, 0.3), 1.0, 320.0);
  v_col = a_col;
}`;
const PT_FS = `#version 300 es
precision highp float;
in vec4 v_col; in float v_d;
uniform vec3 u_fogCol, u_light; uniform vec2 u_fog; uniform float u_exp, u_soft;
out vec4 o;
${COMMON}
${OUTC}
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = dot(c, c) * 4.0;
  if (r > 1.0) discard;
  float a = mix(1.0, (1.0 - r)*(1.0 - r), u_soft) * smoothstep(0.8, 3.5, v_d); // fade sprites that reach the lens
  vec3 col = v_col.rgb * u_light;
  col = mix(col, u_fogCol, smoothstep(u_fog.x, u_fog.y, v_d));
  o = outc(col, v_col.a * a);
}`;

const TR_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
uniform mat4 u_vp;
out vec4 v_col; out vec3 v_wp;
void main(){ v_col = a_col; v_wp = a_pos; gl_Position = u_vp * vec4(a_pos, 1.0); }`;
const TR_FS = `#version 300 es
precision highp float;
in vec4 v_col; in vec3 v_wp;
uniform vec3 u_fogCol, u_cam, u_light; uniform vec2 u_fog; uniform float u_exp, u_hdr;
out vec4 o;
${COMMON}
// multiplicative: drawn with blendFunc(DST_COLOR, ZERO); rgb is a tint the surface is multiplied by, a its strength
void main(){
  float a = v_col.a * (1.0 - smoothstep(u_fog.x * 0.6, u_fog.y * 0.5, length(v_wp - u_cam)));
  vec3 f = mix(vec3(1.0), v_col.rgb, a);
  o = vec4(u_hdr > 0.5 ? pow(f, vec3(2.2)) : f, 1.0);
}`;

const LN_FS = `#version 300 es
precision highp float;
in vec4 v_col; in vec3 v_wp;
uniform vec3 u_fogCol, u_cam, u_light; uniform vec2 u_fog; uniform float u_exp;
out vec4 o;
${COMMON}
${OUTC}
void main(){
  float d = length(v_wp - u_cam);
  float a = v_col.a * smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(u_fog.x, u_fog.y, d));
  o = outc(v_col.rgb * u_light, a);
}`;

// ---------- post-processing (HDR resolve, bloom, tonemap + grade) ----------
const FS_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;
// first bloom level: 4 bilinear taps (a 4x4 box) with a soft-knee threshold and firefly clamp
const BLOOM_PRE_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_texel; uniform float u_thr, u_knee;
out vec4 o;
void main(){
  vec3 s = texture(u_src, v_uv + u_texel * vec2(-1.0, -1.0)).rgb + texture(u_src, v_uv + u_texel * vec2(1.0, -1.0)).rgb
         + texture(u_src, v_uv + u_texel * vec2(-1.0, 1.0)).rgb + texture(u_src, v_uv + u_texel * vec2(1.0, 1.0)).rgb;
  s = min(s * 0.25, vec3(24.0));
  float br = max(s.r, max(s.g, s.b));
  float rq = clamp(br - u_thr + u_knee, 0.0, 2.0 * u_knee); rq = rq * rq / (4.0 * u_knee + 1e-4);
  o = vec4(s * max(rq, br - u_thr) / max(br, 1e-4), 1.0);
}`;
// dual-filter downsample / upsample (Kawase-style), cheap and smooth
const BLOOM_DOWN_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_texel;
out vec4 o;
void main(){
  vec3 s = texture(u_src, v_uv).rgb * 4.0;
  s += texture(u_src, v_uv + u_texel * vec2(-1.0, -1.0)).rgb + texture(u_src, v_uv + u_texel * vec2(1.0, -1.0)).rgb;
  s += texture(u_src, v_uv + u_texel * vec2(-1.0, 1.0)).rgb + texture(u_src, v_uv + u_texel * vec2(1.0, 1.0)).rgb;
  o = vec4(s / 8.0, 1.0);
}`;
const BLOOM_UP_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_texel; uniform float u_k;
out vec4 o;
void main(){
  vec3 s = texture(u_src, v_uv + u_texel * vec2(-2.0, 0.0)).rgb + texture(u_src, v_uv + u_texel * vec2(2.0, 0.0)).rgb
         + texture(u_src, v_uv + u_texel * vec2(0.0, -2.0)).rgb + texture(u_src, v_uv + u_texel * vec2(0.0, 2.0)).rgb;
  s += (texture(u_src, v_uv + u_texel * vec2(-1.0, -1.0)).rgb + texture(u_src, v_uv + u_texel * vec2(1.0, -1.0)).rgb
      + texture(u_src, v_uv + u_texel * vec2(-1.0, 1.0)).rgb + texture(u_src, v_uv + u_texel * vec2(1.0, 1.0)).rgb) * 2.0;
  o = vec4(s / 12.0 * u_k, 1.0);
}`;
// light shafts: march from each pixel towards the sun over the sky mask (alpha 0 = sky) near the sun; trees and
// terrain in between break the march up into shafts. Rendered at quarter resolution.
const RAYS_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_sun; uniform float u_asp;
out vec4 o;
${COMMON}
void main(){
  vec2 d = (u_sun - v_uv) * (0.9 / 28.0);
  vec2 uv = v_uv + d * hash12(gl_FragCoord.xy);
  float acc = 0.0, w = 1.0, ws = 0.0;
  for (int i = 0; i < 28; i++) {
    vec4 t = texture(u_src, uv);
    float near = 1.0 - smoothstep(0.0, 0.55, length((uv - u_sun) * vec2(u_asp, 1.0)));
    acc += (1.0 - clamp(t.a, 0.0, 1.0)) * min(dot(t.rgb, vec3(0.2126, 0.7152, 0.0722)), 4.0) * near * w;
    ws += w; w *= 0.94; uv += d;
  }
  o = vec4(vec3(acc / ws), 1.0);
}`;
const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene, u_bloom;
uniform float u_bloomK, u_sat, u_con, u_vig, u_time, u_asp, u_blur;
uniform sampler2D u_rays; uniform vec3 u_rayCol;
uniform vec3 u_lift, u_gain;
out vec4 o;
${COMMON}
void main(){
  vec3 c = texture(u_scene, v_uv).rgb;
  if (u_blur > 0.001) {
    // radial speed blur: zero in the middle of the screen, a few pixels of streak at the edges
    vec2 d = v_uv - 0.5;
    float k = u_blur * smoothstep(0.18, 0.75, length(d * vec2(u_asp, 1.0))) * 0.022;
    float j = hash12(gl_FragCoord.xy) * 0.5;
    for (int i = 1; i <= 5; i++) c += texture(u_scene, v_uv - d * k * (float(i) - j) / 5.0).rgb;
    c /= 6.0;
  }
  // a light unsharp mask: the resolve and the dynamic resolution soften fine detail a touch, this brings it back
  if (u_blur <= 0.001) {
    vec2 px = 1.0 / vec2(textureSize(u_scene, 0));
    vec3 nb = texture(u_scene, v_uv + vec2(px.x, 0.0)).rgb + texture(u_scene, v_uv - vec2(px.x, 0.0)).rgb + texture(u_scene, v_uv + vec2(0.0, px.y)).rgb + texture(u_scene, v_uv - vec2(0.0, px.y)).rgb;
    c = max(c + (c - nb * 0.25) * 0.32, vec3(0.0));
  }
  c += texture(u_bloom, v_uv).rgb * u_bloomK;
  c += texture(u_rays, v_uv).rgb * u_rayCol;
  c = pow(aces(c), vec3(1.0 / 2.2));
  // grade in display space: split tone (shadows lift, highlights gain), gentle S-curve, saturation
  c = c * u_gain + u_lift * (1.0 - c);
  c = mix(c, c * c * (3.0 - 2.0 * c), u_con);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, u_sat);
  vec2 q = (v_uv - 0.5) * vec2(u_asp, 1.0);
  c *= 1.0 - u_vig * smoothstep(0.35, 1.05, length(q) * 1.15);
  c += (hash12(gl_FragCoord.xy + fract(u_time) * 61.0) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function createRenderer(canvas) {
  // no antialiasing or depth on the canvas itself: the scene always renders into our own multisampled target (HDR
  // with post, or a plain RGBA8 one without) and only the resolved picture reaches the canvas. A multisampled canvas
  // cost a second full-screen MSAA buffer and its resolve every frame for nothing (~0.3 ms at 2560x1600).
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', depth: false, stencil: false });
  if (!gl) return null;

  function compile(vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const prog = {
    lit: compile(LIT_VS, LIT_FS),
    depth: compile(DEPTH_VS, DEPTH_FS),
    sky: compile(SKY_VS, SKY_FS),
    pt: compile(PT_VS, PT_FS),
    tr: compile(TR_VS, TR_FS),
    ln: compile(TR_VS, LN_FS),
    bpre: compile(FS_VS, BLOOM_PRE_FS),
    bdown: compile(FS_VS, BLOOM_DOWN_FS),
    bup: compile(FS_VS, BLOOM_UP_FS),
    comp: compile(FS_VS, COMPOSITE_FS),
    rays: compile(FS_VS, RAYS_FS),
  };

  // shadow map
  const SHADOW = 2048;
  const shTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW * 2, SHADOW);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const shFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shTex, 0);
  gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // white 1x1 texture as default
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  const skyVao = gl.createVertexArray();
  gl.bindVertexArray(skyVao);
  const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // ---- HDR target + bloom chain ----
  const floatOK = !!gl.getExtension('EXT_color_buffer_float');
  const post = { ok: floatOK, w: 0, h: 0, samples: 0, maxSamples: 0, on: false, levels: [], bloomFmt: gl.RGBA16F };
  // without post: an RGBA8 multisampled target, resolved straight onto the canvas
  const ldr = { ok: true, w: 0, h: 0, samples: 0, maxSamples: 4, on: false, fbo: null, color: null, depth: null, rFbo: null, rColor: null };
  try { const sc = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA8, gl.SAMPLES); ldr.maxSamples = sc && sc.length ? Math.min(4, Math.max(...sc)) : 0; } catch (e) { ldr.maxSamples = 0; }
  function buildLdr(w, h, ns) {
    if (ldr.fbo) { gl.deleteFramebuffer(ldr.fbo); gl.deleteRenderbuffer(ldr.color); gl.deleteRenderbuffer(ldr.depth); gl.deleteFramebuffer(ldr.rFbo); gl.deleteRenderbuffer(ldr.rColor); }
    // single-sample stage for the resolve: a multisample blit needs identical formats, and the canvas may be RGB8
    ldr.rFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, ldr.rFbo);
    ldr.rColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, ldr.rColor);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, ldr.rColor);
    ldr.w = w; ldr.h = h; ldr.samples = ns;
    ldr.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, ldr.fbo);
    ldr.color = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, ldr.color);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ns, gl.RGBA8, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, ldr.color);
    ldr.depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, ldr.depth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ns, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ldr.depth);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ldr.ok = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }
  if (floatOK) {
    try {
      const sc = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
      post.maxSamples = sc && sc.length ? Math.min(4, Math.max(...sc)) : 0;
    } catch (e) { post.maxSamples = 0; }
    // the bloom chain is blurry anyway: a packed float format halves its memory traffic, if the GPU can render to it
    try {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R11F_G11F_B10F, 4, 4);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) post.bloomFmt = gl.R11F_G11F_B10F;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); gl.deleteTexture(t);
    } catch (e) { post.bloomFmt = gl.RGBA16F; }
  }
  function ftex(w, h, fmt) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt || gl.RGBA16F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function fbo(tex) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return f; }
  function freePost() {
    for (const k of ['msFbo', 'resFbo']) if (post[k]) gl.deleteFramebuffer(post[k]);
    for (const k of ['msColor', 'msDepth', 'resDepth']) if (post[k]) gl.deleteRenderbuffer(post[k]);
    if (post.resTex) gl.deleteTexture(post.resTex);
    for (const L of post.levels) { gl.deleteFramebuffer(L.fbo); gl.deleteTexture(L.tex); }
    if (post.rays) { gl.deleteFramebuffer(post.rays.fbo); gl.deleteTexture(post.rays.tex); post.rays = null; }
    post.levels = []; post.msFbo = post.resFbo = post.msColor = post.msDepth = post.resDepth = post.resTex = null; post.w = post.h = 0;
  }
  function buildPost(w, h) {
    freePost();
    post.w = w; post.h = h;
    post.resTex = ftex(w, h); post.resFbo = fbo(post.resTex);
    if (post.samples > 1) {
      post.msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, post.msFbo);
      post.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, post.msColor);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, post.samples, gl.RGBA16F, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, post.msColor);
      post.msDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, post.msDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, post.samples, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, post.msDepth);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.resFbo);
      post.resDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, post.resDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, post.resDepth);
    }
    const okFb = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    let lw = Math.max(1, w >> 1), lh = Math.max(1, h >> 1);
    for (let i = 0; i < 6 && lw >= 4 && lh >= 4; i++) { const tex = ftex(lw, lh, post.bloomFmt); post.levels.push({ tex, fbo: fbo(tex), w: lw, h: lh }); lw >>= 1; lh >>= 1; }
    { const rw = Math.max(1, w >> 2), rh = Math.max(1, h >> 2), tex = ftex(rw, rh, post.bloomFmt); post.rays = { tex, fbo: fbo(tex), w: rw, h: rh }; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    if (!okFb) { freePost(); post.ok = false; }
  }
  // bind the scene target for this frame; returns whether the HDR path is active
  // samples: MSAA wanted for this frame (high-density screens get away with fewer)
  function beginScene(w, h, wantPost, samples) {
    post.on = false;
    if (wantPost && post.ok) {
      const ns = Math.min(post.maxSamples, samples || 4);
      if (post.w !== w || post.h !== h || post.samples !== ns) { post.samples = ns; buildPost(w, h); }
      if (post.ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, post.msFbo || post.resFbo); post.on = true; }
    }
    ldr.on = false;
    if (!post.on) {
      const ns = Math.min(ldr.maxSamples, samples || 4);
      if (ldr.ok && ns > 1) {
        if (ldr.w !== w || ldr.h !== h || ldr.samples !== ns) buildLdr(w, h, ns);
        if (ldr.ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, ldr.fbo); ldr.on = true; }
      }
      if (!ldr.on) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    env.hdr = post.on ? 1 : 0;
    gl.viewport(0, 0, w, h);
    return post.on;
  }
  function fsDraw() { gl.bindVertexArray(skyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  // rays: { uv: sun position on screen, col: shaft colour × strength } or null
  function endScene(G, time, blur, rays) {
    if (ldr.on) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, ldr.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, ldr.rFbo);
      gl.blitFramebuffer(0, 0, ldr.w, ldr.h, 0, 0, ldr.w, ldr.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, ldr.rFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, ldr.w, ldr.h, 0, 0, ldr.w, ldr.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return;
    }
    if (!post.on) return;
    const w = post.w, h = post.h;
    if (post.msFbo) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, post.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, post.resFbo);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    gl.activeTexture(gl.TEXTURE0);
    const L = post.levels;
    // prefilter into level 0, then down the chain
    let u = prog.bpre.u; gl.useProgram(prog.bpre.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, L[0].fbo); gl.viewport(0, 0, L[0].w, L[0].h);
    gl.bindTexture(gl.TEXTURE_2D, post.resTex); gl.uniform1i(u.u_src, 0);
    gl.uniform2f(u.u_texel, 1 / w, 1 / h); gl.uniform1f(u.u_thr, G.thr); gl.uniform1f(u.u_knee, G.thr * 0.5);
    fsDraw();
    u = prog.bdown.u; gl.useProgram(prog.bdown.p); gl.uniform1i(u.u_src, 0);
    for (let i = 1; i < L.length; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, L[i].fbo); gl.viewport(0, 0, L[i].w, L[i].h);
      gl.bindTexture(gl.TEXTURE_2D, L[i - 1].tex); gl.uniform2f(u.u_texel, 0.5 / L[i - 1].w, 0.5 / L[i - 1].h);
      fsDraw();
    }
    // back up, adding each smaller level onto the next larger one
    u = prog.bup.u; gl.useProgram(prog.bup.p); gl.uniform1i(u.u_src, 0); gl.uniform1f(u.u_k, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = L.length - 1; i > 0; i--) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, L[i - 1].fbo); gl.viewport(0, 0, L[i - 1].w, L[i - 1].h);
      gl.bindTexture(gl.TEXTURE_2D, L[i].tex); gl.uniform2f(u.u_texel, 0.5 / L[i].w, 0.5 / L[i].h);
      fsDraw();
    }
    gl.disable(gl.BLEND);
    const doRays = rays && post.rays && (rays.col[0] + rays.col[1] + rays.col[2]) > 0.001;
    if (doRays) {
      u = prog.rays.u; gl.useProgram(prog.rays.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.rays.fbo); gl.viewport(0, 0, post.rays.w, post.rays.h);
      gl.bindTexture(gl.TEXTURE_2D, post.resTex); gl.uniform1i(u.u_src, 0);
      gl.uniform2fv(u.u_sun, rays.uv); gl.uniform1f(u.u_asp, w / h);
      fsDraw();
    }
    // composite to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    u = prog.comp.u; gl.useProgram(prog.comp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.resTex); gl.uniform1i(u.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L[0].tex); gl.uniform1i(u.u_bloom, 1);
    gl.uniform1f(u.u_bloomK, G.bloom / Math.max(1, L.length - 1)); gl.uniform1f(u.u_sat, G.sat); gl.uniform1f(u.u_con, G.con);
    gl.uniform1f(u.u_vig, G.vig); gl.uniform1f(u.u_time, time || 0); gl.uniform1f(u.u_asp, w / h); gl.uniform1f(u.u_blur, blur || 0);
    gl.uniform3fv(u.u_lift, G.lift); gl.uniform3fv(u.u_gain, G.gain);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, doRays ? post.rays.tex : L[L.length - 1].tex); gl.uniform1i(u.u_rays, 2);
    gl.uniform3fv(u.u_rayCol, doRays ? rays.col : [0, 0, 0]);
    fsDraw();
    gl.activeTexture(gl.TEXTURE0);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  }

  let buffers = [];
  const texs = [];
  let instBufs = [];
  function buf(data, target) {
    const b = gl.createBuffer(); gl.bindBuffer(target || gl.ARRAY_BUFFER, b);
    gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); buffers.push(b); return b;
  }
  const vaos = [];
  // mesh from Geo or raw arrays {p,n,c,u,idx}
  function mesh(g, inst, opts) {
    const b0 = buffers.length;
    const vao = gl.createVertexArray(); vaos.push(vao);
    gl.bindVertexArray(vao);
    const P = g.p instanceof Float32Array ? g.p : new Float32Array(g.p);
    const N = g.n instanceof Float32Array ? g.n : new Float32Array(g.n);
    const C = g.c instanceof Float32Array ? g.c : new Float32Array(g.c);
    const U = g.u ? (g.u instanceof Float32Array ? g.u : new Float32Array(g.u)) : null;
    buf(P); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    buf(N); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    buf(C); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    if (U && U.length) { buf(U); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0); }
    const m = { vao, count: P.length / 3, indexed: false, inst: 0, instBuf: null };
    if (g.idx) {
      const ib = buf(g.idx instanceof Uint32Array ? g.idx : new Uint32Array(g.idx), gl.ELEMENT_ARRAY_BUFFER);
      m.indexed = true; m.count = g.idx.length;
    }
    if (g.chunks) m.chunks = g.chunks;
    if (inst && opts && opts.cell) { const r = sortInstances(P, inst, opts.cell); inst = r.data; m.chunks = r.chunks; }
    if (opts && opts.cullDist) m.cullDist = opts.cullDist;
    if (inst) setInstances(m, inst, true);
    gl.bindVertexArray(null);
    m.bufs = buffers.slice(b0);
    return m;
  }
  // Group instances by ground cell so each cell is a contiguous run with a bounding box; the runs a pass can't see
  // are skipped at draw time. Boxes cover the geometry at each instance's scale (plus a margin for sway).
  function sortInstances(P, data, cell) {
    let R = 0, y0 = 0, y1 = 0;
    for (let i = 0; i < P.length; i += 3) { R = Math.max(R, Math.hypot(P[i], P[i + 2])); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
    const n = data.length / 11, keys = new Array(n);
    for (let i = 0; i < n; i++) keys[i] = { i, k: Math.floor(data[i * 11 + 2] / cell) * 100003 + Math.floor(data[i * 11] / cell) };
    keys.sort((a, b) => a.k - b.k);
    const out = new Float32Array(data.length), chunks = [];
    let cur = null;
    keys.forEach((e, j) => {
      out.set(data.subarray(e.i * 11, e.i * 11 + 11), j * 11);
      const x = out[j * 11], y = out[j * 11 + 1], z = out[j * 11 + 2], sxz = out[j * 11 + 4], sy = out[j * 11 + 5];
      if (!cur || cur.k !== e.k) { cur = { k: e.k, first: j, count: 0, box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] }; chunks.push(cur); }
      cur.count++;
      const r = R * sxz + 1, b = cur.box;
      b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y + y0 * sy - 0.5); b[2] = Math.min(b[2], z - r);
      b[3] = Math.max(b[3], x + r); b[4] = Math.max(b[4], y + y1 * sy + 0.5); b[5] = Math.max(b[5], z + r);
    });
    return { data: out, chunks };
  }
  // ---- culling: frustum planes of the current pass ----
  const planes = new Float32Array(24), cullCam = [0, 0, 0];
  let cullOn = false, cullDistOn = false, shadowLod = false;
  function setCull(m, cam) {
    for (let p = 0; p < 6; p++) {
      const r = p >> 1, sg = p & 1 ? -1 : 1;
      const a = m[3] + sg * m[r], b = m[7] + sg * m[4 + r], c = m[11] + sg * m[8 + r], d = m[15] + sg * m[12 + r];
      const l = Math.hypot(a, b, c) || 1;
      planes[p * 4] = a / l; planes[p * 4 + 1] = b / l; planes[p * 4 + 2] = c / l; planes[p * 4 + 3] = d / l;
    }
    cullOn = true; cullDistOn = !!cam; shadowLod = false;
    if (cam) { cullCam[0] = cam[0]; cullCam[1] = cam[1]; cullCam[2] = cam[2]; }
  }
  function boxVisible(bx, maxD) {
    for (let p = 0; p < 24; p += 4) {
      const a = planes[p], b = planes[p + 1], c = planes[p + 2];
      if (a * (a > 0 ? bx[3] : bx[0]) + b * (b > 0 ? bx[4] : bx[1]) + c * (c > 0 ? bx[5] : bx[2]) + planes[p + 3] < 0) return false;
    }
    if (maxD) {
      const dx = Math.max(bx[0] - cullCam[0], 0, cullCam[0] - bx[3]), dy = Math.max(bx[1] - cullCam[1], 0, cullCam[1] - bx[4]), dz = Math.max(bx[2] - cullCam[2], 0, cullCam[2] - bx[5]);
      if (dx * dx + dy * dy + dz * dz > maxD * maxD) return false;
    }
    return true;
  }
  // draw a chunked mesh as runs of consecutive visible chunks (instanced: re-point the instance attributes at the run)
  function drawRuns(m) {
    const ch = m.chunks, n = ch.length, maxD = cullDistOn ? m.cullDist || 0 : 0;
    if (!m.inst && ch.lodDist) {
      // blocks with levels of detail: each visible block picks its level by ground distance from the camera
      // (full detail in passes without a camera); blocks that land next to each other in the index buffer share a draw
      const ld = ch.lodDist; let rs = 0, re = 0;
      for (let k = 0; k < n; k++) {
        const c = ch[k];
        if (cullOn && !boxVisible(c.box, maxD)) continue;
        let L = 0;
        if (cullDistOn) {
          const b = c.box, dx = Math.max(b[0] - cullCam[0], 0, cullCam[0] - b[3]), dz = Math.max(b[2] - cullCam[2], 0, cullCam[2] - b[5]);
          const d = Math.hypot(dx, dz); L = d > ld[1] ? 2 : d > ld[0] ? 1 : 0;
        }
        const r = c.lods[L];
        if (r.first === re && re > rs) re += r.count;
        else { if (re > rs) gl.drawElements(gl.TRIANGLES, re - rs, gl.UNSIGNED_INT, rs * 4); rs = r.first; re = r.first + r.count; }
      }
      if (re > rs) gl.drawElements(gl.TRIANGLES, re - rs, gl.UNSIGNED_INT, rs * 4);
      return;
    }
    if (m.inst && m.lod && (cullDistOn || shadowLod)) {
      // instanced props with a simpler far version: near cells draw the full mesh, far cells the low one
      // (same instance order in both, so the chunks line up)
      const D = cullDistOn ? m.lod.dist : m.lod.shadowDist || m.lod.dist, near = c => groundDist(c.box) <= D;
      instRuns(m, m, maxD, near);
      gl.bindVertexArray(m.lod.m.vao);
      instRuns(m, m.lod.m, maxD, c => !near(c));
      return;
    }
    instRuns(m, m, maxD, null);
  }
  function groundDist(b) { const dx = Math.max(b[0] - cullCam[0], 0, cullCam[0] - b[3]), dz = Math.max(b[2] - cullCam[2], 0, cullCam[2] - b[5]); return Math.hypot(dx, dz); }
  // runs of consecutive chunks of `src` that are visible (and pass `pred`), drawn with `tgt`'s geometry and instances
  function instRuns(src, tgt, maxD, pred) {
    const ch = src.chunks, n = ch.length, ok = c => (!cullOn || boxVisible(c.box, maxD)) && (!pred || pred(c));
    let i = 0;
    while (i < n) {
      if (!ok(ch[i])) { i++; continue; }
      let j = i + 1;
      while (j < n && ok(ch[j])) j++;
      const first = ch[i].first, count = ch[j - 1].first + ch[j - 1].count - first;
      if (tgt.inst) {
        gl.bindBuffer(gl.ARRAY_BUFFER, tgt.instBuf);
        const o = first * 44;
        gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 44, o); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 44, o + 16); gl.vertexAttribPointer(6, 3, gl.FLOAT, false, 44, o + 32);
        if (tgt.indexed) gl.drawElementsInstanced(gl.TRIANGLES, tgt.count, gl.UNSIGNED_INT, 0, count);
        else gl.drawArraysInstanced(gl.TRIANGLES, 0, tgt.count, count);
      } else gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, first * 4);
      i = j;
    }
  }
  function disposeMesh(m) {
    if (!m) return;
    for (const b of m.bufs || []) gl.deleteBuffer(b);
    if (m.instBuf) gl.deleteBuffer(m.instBuf);
    gl.deleteVertexArray(m.vao);
    const set = new Set(m.bufs || []);
    buffers = buffers.filter(b => !set.has(b));
    if (m.instBuf) instBufs = instBufs.filter(b => b !== m.instBuf);
    const vi = vaos.indexOf(m.vao); if (vi >= 0) vaos.splice(vi, 1);
  }
  // instance data: Float32Array stride 11 [x,y,z,rot, sxz,sy,0,0, r,g,b]
  function setInstances(m, data, creating) {
    if (!creating) gl.bindVertexArray(m.vao);
    if (!m.instBuf) {
      m.instBuf = gl.createBuffer(); instBufs.push(m.instBuf);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const st = 11 * 4;
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, st, 0); gl.vertexAttribDivisor(4, 1);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, st, 16); gl.vertexAttribDivisor(5, 1);
      gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 3, gl.FLOAT, false, st, 32); gl.vertexAttribDivisor(6, 1);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, m.instBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    m.inst = data.length / 11;
    if (!creating) gl.bindVertexArray(null);
  }
  function texture(canvasOrImg, opts) {
    opts = opts || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (canvasOrImg.data && canvasOrImg.w) gl.texImage2D(gl.TEXTURE_2D, 0, opts.linear ? gl.RGBA8 : gl.SRGB8_ALPHA8, canvasOrImg.w, canvasOrImg.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvasOrImg.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, opts.linear ? gl.RGBA8 : gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, canvasOrImg);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, opts.repeat ? Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4) : 4);
    if (!opts.keep) texs.push(t);
    return t;
  }

  // dynamic point buffer
  function points(max) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, max * 12, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, max * 16, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    const zb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, zb); gl.bufferData(gl.ARRAY_BUFFER, max * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, pb, cb, zb, max, count: 0,
      update(P, C, Z, n) {
        gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, P, 0, n * 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, C, 0, n * 4);
        gl.bindBuffer(gl.ARRAY_BUFFER, zb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, Z, 0, n);
        this.count = n;
      } };
  }
  // dynamic triangle trail buffer (pos3 + rgba)
  function trail(maxVerts) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, maxVerts * 12, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, maxVerts * 16, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, pb, cb, maxVerts, count: 0,
      write(offsetVerts, P, C) {
        gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferSubData(gl.ARRAY_BUFFER, offsetVerts * 12, P);
        gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferSubData(gl.ARRAY_BUFFER, offsetVerts * 16, C);
      } };
  }

  // dynamic line buffer (rain streaks): pos3 + rgba per vertex, two vertices a line
  function lines(maxVerts) {
    const t = trail(maxVerts);
    t.update = function (P, Cc, n) { this.write(0, P.subarray(0, n * 3), Cc.subarray(0, n * 4)); this.count = n; };
    return t;
  }
  function drawLines(Ln, E, light) {
    if (!Ln.count) return;
    const u = prog.ln.u;
    gl.useProgram(prog.ln.p);
    gl.uniformMatrix4fv(u.u_vp, false, env.vp); gl.uniform3fv(u.u_cam, env.cam);
    gl.uniform3fv(u.u_fogCol, E.fogCol); gl.uniform2fv(u.u_fog, E.fog); gl.uniform3fv(u.u_light, light); gl.uniform1f(u.u_exp, E.exp);
    gl.uniform1f(u.u_hdr, env.hdr || 0);
    gl.bindVertexArray(Ln.vao); gl.drawArrays(gl.LINES, 0, Ln.count);
  }

  function disposeAll() {
    for (const b of buffers) gl.deleteBuffer(b);
    for (const v of vaos) gl.deleteVertexArray(v);
    for (const t of texs) gl.deleteTexture(t);
    for (const b of instBufs) gl.deleteBuffer(b);
    buffers = []; instBufs = []; vaos.length = 0; texs.length = 0;
  }

  const I4 = M4.create();
  const env = { vp: M4.create(), svp: M4.create(), svp2: M4.create(), ivp: M4.create(), cam: [0, 0, 0], exp: 1, hdr: 0, shNo: [0.02, 0.08] };

  function setLitFrame(E) {
    const u = prog.lit.u;
    gl.useProgram(prog.lit.p);
    setCull(env.vp, env.cam);
    gl.uniformMatrix4fv(u.u_vp, false, env.vp);
    gl.uniformMatrix4fv(u.u_svp, false, env.svp); gl.uniformMatrix4fv(u.u_svp2, false, env.svp2); gl.uniform2fv(u.u_shNo, env.shNo);
    gl.uniform3fv(u.u_sunDir, E.sunDir); gl.uniform3fv(u.u_sunCol, E.sunCol);
    gl.uniform3fv(u.u_sky, E.sky); gl.uniform3fv(u.u_gnd, E.gnd);
    gl.uniform3fv(u.u_fogCol, E.fogCol); gl.uniform2fv(u.u_fog, E.fog);
    gl.uniform3fv(u.u_cam, env.cam);
    gl.uniform1f(u.u_exp, E.exp);
    gl.uniform1f(u.u_hdr, env.hdr || 0);
    gl.uniform3fv(u.u_zen, E.zen); gl.uniform3fv(u.u_hor, E.fogCol);
    gl.uniform3fv(u.u_fol, [E.folFade ? E.folFade[0] : 60, E.folFade ? E.folFade[1] : 90, (post.on ? post.samples > 1 : ldr.on) ? 1 : 0]);
    gl.uniform1f(u.u_time, E.time);
    gl.uniform1f(u.u_shOn, E.shadows ? 1 : 0);
    gl.uniform2f(u.u_shTex, 1 / (2 * SHADOW), 1 / SHADOW);
    gl.uniform3fv(u.u_r1, E.r1); gl.uniform3fv(u.u_r2, E.r2); gl.uniform3fv(u.u_r3, E.r3);
    gl.uniform1f(u.u_lines, E.lines ? 1 : 0); gl.uniform1f(u.u_icy, E.icy || 0);
    gl.uniform3fv(u.u_verge, E.verge || E.r3); gl.uniform3fv(u.u_tt, E.tt || [1, 1, 1]);
    gl.uniform1f(u.u_gbump, E.gbump == null ? 0.05 : E.gbump);
    gl.uniform3fv(u.u_glw, E.glow ? [E.glow[0] * 0.35, E.glow[1] * 0.35, E.glow[2] * 0.35] : [0, 0, 0]); gl.uniform1f(u.u_cld, E.clouds || 0);
    gl.uniform3fv(u.u_hlPos, E.hlPos || [0, 0, 0]); gl.uniform3fv(u.u_hlDir, E.hlDir || [0, 0, 1]); gl.uniform1f(u.u_hlOn, E.hlOn || 0);
    gl.uniform1f(u.u_wet, E.wet || 0);
    gl.uniform3fv(u.u_skyline, E.skyline || E.gnd);
    gl.uniform3fv(u.u_hitPos, E.hitPos || [0, -999, 0]); gl.uniform1f(u.u_hitK, E.hitK || 0);
    gl.uniform1f(u.u_dirt, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shTex); gl.uniform1i(u.u_shadow, 1);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.u_tex, 0);
  }
  // draw opts: model, mode, tint, alpha, tex, sway, fog(override)
  function drawLit(m, o) {
    o = o || {};
    const u = prog.lit.u;
    gl.uniformMatrix4fv(u.u_model, false, o.model || I4);
    gl.uniform1i(u.u_mode, o.mode || 0);
    gl.uniform3fv(u.u_tint, o.tint || [1, 1, 1]);
    gl.uniform1f(u.u_alpha, o.alpha == null ? 1 : o.alpha);
    gl.uniform1f(u.u_sway, o.sway || 0);
    if (o.dirt != null) { gl.uniform1f(u.u_dirt, o.dirt); gl.uniform1f(u.u_carY, o.carY || 0); gl.uniform3fv(u.u_dirtCol, o.dirtCol || [0.3, 0.25, 0.2]); }
    if (o.fog) gl.uniform2fv(u.u_fog, o.fog);
    if (o.fogLo) gl.uniform4fv(u.u_fogLo, o.fogLo);
    if (o.a2c) gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.bindTexture(gl.TEXTURE_2D, o.tex || white);
    gl.bindVertexArray(m.vao);
    if (!m.inst) { gl.vertexAttrib4f(4, 0, 0, 0, 0); gl.vertexAttrib4f(5, 1, 1, 0, 0); gl.vertexAttrib3f(6, 1, 1, 1); }
    if (m.chunks) drawRuns(m);
    else if (m.inst) {
      if (m.indexed) gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0, m.inst);
      else gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.inst);
    } else {
      if (m.indexed) gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, m.count);
    }
    if (o.fog) gl.uniform2fv(u.u_fog, o.fogRestore);
    if (o.fogLo) gl.uniform4f(u.u_fogLo, 0, 0, 1, 0);
    if (o.a2c) gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    if (o.dirt != null) gl.uniform1f(u.u_dirt, 0);
  }
  function drawDepth(m, model) {
    const u = prog.depth.u;
    gl.uniformMatrix4fv(u.u_model, false, model || I4);
    gl.bindVertexArray(m.vao);
    if (!m.inst) { gl.vertexAttrib4f(4, 0, 0, 0, 0); gl.vertexAttrib4f(5, 1, 1, 0, 0); }
    if (m.chunks) drawRuns(m);
    else if (m.inst) {
      if (m.indexed) gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0, m.inst);
      else gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.inst);
    } else {
      if (m.indexed) gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, m.count);
    }
  }
  // cascade 0 = near (left half of the atlas), 1 = far (right half); call 0 first, it clears the whole atlas
  function beginShadow(cascade) {
    const c = cascade || 0, m = c ? env.svp2 : env.svp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo);
    if (!c) { gl.viewport(0, 0, SHADOW * 2, SHADOW); gl.clear(gl.DEPTH_BUFFER_BIT); }
    gl.viewport(c * SHADOW, 0, SHADOW, SHADOW);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2.0);
    gl.useProgram(prog.depth.p);
    gl.uniformMatrix4fv(prog.depth.u.u_svp, false, m);
    setCull(m, null);
    // the shadow pass keeps every caster, but far from the camera the simple tree casts a shadow just as good
    if (env.cam) { cullCam[0] = env.cam[0]; cullCam[1] = env.cam[1]; cullCam[2] = env.cam[2]; shadowLod = true; }
  }
  function endShadow() {
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function drawSky(E) {
    const u = prog.sky.u;
    gl.useProgram(prog.sky.p);
    gl.uniformMatrix4fv(u.u_ivp, false, env.ivp);
    gl.uniform3fv(u.u_cam, env.cam);
    gl.uniform3fv(u.u_zen, E.zen); gl.uniform3fv(u.u_hor, E.fogCol); gl.uniform3fv(u.u_sunDir, E.sunDir);
    gl.uniform3fv(u.u_sunCol, E.sunDisc); gl.uniform3fv(u.u_glow, E.glow); gl.uniform3fv(u.u_cloud, E.cloudCol);
    gl.uniform1f(u.u_exp, E.exp); gl.uniform1f(u.u_time, E.time); gl.uniform1f(u.u_clouds, E.clouds); gl.uniform1f(u.u_stars, E.stars || 0); gl.uniform1f(u.u_hdr, env.hdr || 0);
    gl.uniform1f(u.u_ovc, E.overcast || 0);
    gl.depthMask(false);
    gl.bindVertexArray(skyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.useProgram(prog.lit.p); // drawn mid-frame: hand the lit program (and its uniforms) back to the passes that follow
  }
  function drawPoints(P, E, light, soft) {
    if (!P.count) return;
    const u = prog.pt.u;
    gl.useProgram(prog.pt.p);
    gl.uniformMatrix4fv(u.u_vp, false, env.vp);
    gl.uniform3fv(u.u_cam, env.cam);
    gl.uniform1f(u.u_ps, gl.drawingBufferHeight / (2 * Math.tan(env.fov / 2)));
    gl.uniform3fv(u.u_fogCol, E.fogCol); gl.uniform2fv(u.u_fog, E.fog);
    gl.uniform3fv(u.u_light, light); gl.uniform1f(u.u_exp, E.exp); gl.uniform1f(u.u_soft, soft == null ? 1 : soft); gl.uniform1f(u.u_hdr, env.hdr || 0);
    gl.bindVertexArray(P.vao); gl.drawArrays(gl.POINTS, 0, P.count);
  }
  function drawTrail(Tr, E, light, count) {
    if (!count) return;
    const u = prog.tr.u;
    gl.useProgram(prog.tr.p);
    gl.uniformMatrix4fv(u.u_vp, false, env.vp);
    gl.uniform3fv(u.u_cam, env.cam);
    gl.uniform3fv(u.u_fogCol, E.fogCol); gl.uniform2fv(u.u_fog, E.fog); gl.uniform3fv(u.u_light, light); gl.uniform1f(u.u_exp, E.exp);
    gl.uniform1f(u.u_hdr, env.hdr || 0);
    gl.bindVertexArray(Tr.vao); gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  return { gl, env, mesh, disposeMesh, setInstances, texture, points, trail, lines, drawLines, disposeAll, setLitFrame, drawLit, drawDepth, beginShadow, endShadow, drawSky, drawPoints, drawTrail, SHADOW,
    beginScene, endScene, post };
}

return { M4, Geo, lin, mixc, scalec, createRenderer };
})();
