// Graphics quality presets, procedural textures and the shader patches that
// give the world its look: detail-textured terrain, wind in the foliage,
// plank/stone/shingle patterns on buildings and rim light on characters.
import * as THREE from '../lib/three.module.min.js';
import { G } from '../state.js';

// ---------- quality ----------
export const PRESETS = {
  low: { shadows: false, shadowSize: 0, shadowRange: 0, pixelRatio: 1, minPixelRatio: 0.6, bloom: false, particles: 0.4, terrainShadows: false, far: 0.75 },
  medium: { shadows: true, shadowSize: 1024, shadowRange: 34, pixelRatio: 1.5, minPixelRatio: 0.7, bloom: false, particles: 0.7, terrainShadows: false, far: 0.9 },
  high: { shadows: true, shadowSize: 2048, shadowRange: 55, pixelRatio: 2, minPixelRatio: 0.85, bloom: true, particles: 1, terrainShadows: true, far: 1 },
};
const QKEY = 'wov_quality';

export function detectQuality() {
  const mem = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (G.isTouch) return mem <= 2 || cores <= 2 ? 'low' : 'medium';
  return cores <= 2 ? 'medium' : 'high';
}
export function loadQuality() {
  let q = null;
  try { q = localStorage.getItem(QKEY); } catch { /* storage blocked */ }
  return PRESETS[q] ? q : detectQuality();
}
export function storeQuality(q) {
  try { localStorage.setItem(QKEY, q); } catch { /* storage blocked */ }
}
export function preset() { return PRESETS[G.quality] ?? PRESETS.medium; }

// Uniforms shared by every patched material, updated once per frame.
export const shared = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.5, 1, 0.35).normalize() },
  uSunColor: { value: new THREE.Color(0xfff0d8) },
  uSkyTop: { value: new THREE.Color(0x8fbce6) },
  uHorizon: { value: new THREE.Color(0xc9dcec) },
  uRim: { value: new THREE.Color(0x8aa0c0).multiplyScalar(0.32) },
  uCloud: { value: 0.5 },
};

// ---------- tileable noise ----------
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
// value noise on a lattice that wraps every px by py cells
function tnoise(x, y, px, py, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const ix0 = ((x0 % px) + px) % px, iy0 = ((y0 % py) + py) % py;
  const ix1 = (ix0 + 1) % px, iy1 = (iy0 + 1) % py;
  const a = hash(ix0, iy0, s), b = hash(ix1, iy0, s), c = hash(ix0, iy1, s), d = hash(ix1, iy1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// fractal noise over u,v in [0,1); tiles seamlessly
function tfbm(u, v, px, py, oct, s) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += tnoise(u * px, v * py, px, py, s + o * 17) * amp;
    norm += amp; amp *= 0.5; px *= 2; py *= 2;
  }
  return sum / norm;
}
// distance to the nearest of a wrapped grid of jittered points
function cells(u, v, n, s) {
  const x = u * n, y = v * n;
  const cx = Math.floor(x), cy = Math.floor(y);
  let best = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gy = cy + j;
    const wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n;
    const px = gx + hash(wx, wy, s), py = gy + hash(wx, wy, s + 7);
    const d = Math.hypot(px - x, py - y);
    if (d < best) { best = d; id = hash(wx, wy, s + 13); }
  }
  return [best, id];
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function dataTexture(data, size, opts = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

// Ground detail: R grass, G dirt and pebbles, B rock with cracks and strata, A sand ripples.
let detailTex = null;
export function detailTexture() {
  if (detailTex) return detailTex;
  const S = 256;
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, k = (y * S + x) * 4;
    const grass = 0.5 + (tfbm(u, v, 16, 16, 4, 1) - 0.5) * 1.3 + (hash(x, y, 5) - 0.5) * 0.28 + (tnoise(u * 64, v * 8, 64, 8, 9) - 0.5) * 0.25;
    const [pd, pid] = cells(u, v, 18, 21);
    const pebble = smooth(0.32, 0.18, pd) * (pid - 0.45) * 0.9;
    const dirt = 0.5 + (tfbm(u, v, 8, 8, 4, 3) - 0.5) * 1.1 + pebble + (hash(x, y, 6) - 0.5) * 0.12;
    const rn = tfbm(u, v, 6, 6, 5, 11);
    const crack = 1 - smooth(0.0, 0.035, Math.abs(rn - 0.5));
    const strata = Math.sin((v * 14 + tfbm(u, v, 4, 4, 3, 13) * 2.5) * Math.PI * 2) * 0.12;
    const rock = 0.55 + (tfbm(u, v, 12, 12, 4, 15) - 0.5) * 0.8 + strata - crack * 0.38;
    const sand = 0.5 + Math.sin((u * 10 + tfbm(u, v, 4, 4, 3, 17) * 1.6) * Math.PI * 2) * 0.13 + (hash(x, y, 8) - 0.5) * 0.16 + (tfbm(u, v, 8, 8, 3, 19) - 0.5) * 0.3;
    d[k] = clamp01(grass) * 255; d[k + 1] = clamp01(dirt) * 255; d[k + 2] = clamp01(rock) * 255; d[k + 3] = clamp01(sand) * 255;
  }
  detailTex = dataTexture(d, S, { aniso: 8 });
  return detailTex;
}

// Building surfaces: R planks, G stone blocks, B roof shingles, A plaster.
let patternTex = null;
export function patternTexture() {
  if (patternTex) return patternTex;
  const S = 256;
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, k = (y * S + x) * 4;
    // planks: 8 boards per tile with staggered butt joints and grain
    const row = Math.floor(v * 8), fv = v * 8 - row;
    const joint = (u + hash(row, 0, 31)) % 1;
    const seam = Math.max(1 - smooth(0.0, 0.07, fv), 1 - smooth(0.0, 0.07, 1 - fv), 1 - smooth(0.0, 0.012, Math.min(joint, 1 - joint)));
    const grain = tfbm(u, v, 3, 96, 3, 33);
    const planks = 0.55 + (hash(row, Math.floor(joint * 2), 35) - 0.5) * 0.3 + (grain - 0.5) * 0.45 - seam * 0.45;
    // stone: 5 courses of blocks in running bond
    const sr = Math.floor(v * 5), sv = v * 5 - sr;
    const su = (u * 3 + (sr % 2) * 0.5) % 3, bi = Math.floor(su), fu = su - bi;
    const mortar = Math.max(1 - smooth(0.0, 0.06, Math.min(sv, 1 - sv)), 1 - smooth(0.0, 0.035, Math.min(fu, 1 - fu)));
    const stone = 0.5 + (hash(bi, sr, 37) - 0.5) * 0.34 + (tfbm(u, v, 12, 12, 4, 39) - 0.5) * 0.4 - mortar * 0.5 + (1 - sv) * 0.06;
    // shingles: 8 rows, each tile darker toward its lower edge
    const hr = Math.floor(v * 8), hv = v * 8 - hr;
    const hu = (u * 8 + (hr % 2) * 0.5) % 8, ti = Math.floor(hu), tu = hu - ti;
    const edge = 1 - smooth(0.0, 0.05, Math.min(tu, 1 - tu));
    const shingle = 0.42 + hv * 0.3 + (hash(ti, hr, 41) - 0.5) * 0.25 - edge * 0.3 - (1 - smooth(0.0, 0.12, hv)) * 0.25 + (tfbm(u, v, 16, 16, 3, 43) - 0.5) * 0.2;
    const plaster = 0.5 + (tfbm(u, v, 6, 6, 5, 45) - 0.5) * 0.35 + (hash(x, y, 47) - 0.5) * 0.06;
    d[k] = clamp01(planks) * 255; d[k + 1] = clamp01(stone) * 255; d[k + 2] = clamp01(shingle) * 255; d[k + 3] = clamp01(plaster) * 255;
  }
  patternTex = dataTexture(d, S, { aniso: 8 });
  return patternTex;
}

// Water: RGB normal map from tileable ripples, A foam noise.
let waterTex = null;
export function waterTexture() {
  if (waterTex) return waterTex;
  const S = 256;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    h[y * S + x] = tfbm(u, v, 6, 6, 5, 51) + 0.35 * tfbm(u, v, 14, 14, 3, 53);
  }
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = (y * S + x) * 4;
    const hl = h[y * S + ((x + S - 1) % S)], hr = h[y * S + ((x + 1) % S)];
    const hd = h[((y + S - 1) % S) * S + x], hu = h[((y + 1) % S) * S + x];
    const nx = (hl - hr) * 9, ny = (hd - hu) * 9, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const [cd] = cells(x / S, y / S, 20, 55);
    const foam = clamp01(tfbm(x / S, y / S, 10, 10, 4, 57) * 0.9 + (1 - smooth(0.05, 0.5, cd)) * 0.35);
    d[k] = (nx / l * 0.5 + 0.5) * 255; d[k + 1] = (ny / l * 0.5 + 0.5) * 255; d[k + 2] = (nz / l * 0.5 + 0.5) * 255; d[k + 3] = foam * 255;
  }
  waterTex = dataTexture(d, S, { aniso: 4 });
  return waterTex;
}

// ---------- material patches ----------
function addUniforms(sh, extra) {
  Object.assign(sh.uniforms, shared, extra);
}
// Surfaces right in front of the camera dissolve in a dither pattern so a
// tree trunk or wall never blocks the view of your character.
const NEAR_FADE = /* glsl */`
  {
    float camD = length(vViewPosition);
    float keep = smoothstep(1.6, 4.2, camD);
    if (keep < 1.0) {
      float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
      if (n > keep) discard;
    }
  }
`;

const TERRAIN_FRAG = /* glsl */`
  {
    vec2 tp = vWPos.xz;
    vec4 tf = texture2D(uDetail, tp * 0.105);
    vec4 tc = texture2D(uDetail, tp * 0.021 + 0.37);
    vec3 tn = normalize(vWNormal);
    vec2 sideUV = abs(tn.x) > abs(tn.z) ? vWPos.zy : vWPos.xy;
    float rockSide = texture2D(uDetail, sideUV * vec2(0.07, 0.11)).b;
    float steep = smoothstep(0.35, 0.75, 1.0 - tn.y);
    float tg = mix(tf.r, tc.r, 0.35);
    float td = mix(tf.g, tc.g, 0.4);
    float tr = mix(mix(tf.b, tc.b, 0.4), rockSide, steep);
    float ts = mix(tf.a, tc.a, 0.3);
    vec4 w = vSurf + vec4(0.0, 0.0, steep * 0.6, 0.0);
    w /= max(0.001, w.x + w.y + w.z + w.w);
    float detail = dot(w, vec4(tg, td, tr, ts));
    diffuseColor.rgb *= 0.6 + 0.8 * detail;
    float macro = texture2D(uDetail, tp * 0.0029 + 0.11).g;
    float macro2 = texture2D(uDetail, tp * 0.0011 + 0.53).r;
    diffuseColor.rgb *= 0.8 + 0.4 * macro;
    // broad patches of lusher and drier ground
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.02, 0.78), w.x * smoothstep(0.45, 0.75, macro2) * 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.92, 0.8), w.x * smoothstep(0.55, 0.25, macro2) * 0.6);
    // a little extra green in lush grass, dust on the dirt
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 1.06, 0.9), w.x * (tf.r - 0.4));
  }
`;
export function terrainMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tex = detailTexture();
  m.onBeforeCompile = (sh) => {
    addUniforms(sh, { uDetail: { value: tex } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 surf;\nvarying vec4 vSurf;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = surf;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec4 vSurf;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + TERRAIN_FRAG);
  };
  m.customProgramCacheKey = () => 'wov-terrain';
  return m;
}

// Plants bend with the wind; the bend grows with height above the base.
export function windMaterial(amp, base = 0, speed = 1.6, key = 'w') {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    addUniforms(sh, { uWindAmp: { value: amp }, uWindBase: { value: base }, uWindSpeed: { value: speed } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWindAmp;\nuniform float uWindBase;\nuniform float uWindSpeed;')
      .replace('#include <project_vertex>', /* glsl */`
        {
          #ifdef USE_INSTANCING
            vec3 wo = instanceMatrix[3].xyz;
          #else
            vec3 wo = vec3(0.0);
          #endif
          float wh = max(transformed.y - uWindBase, 0.0);
          float wp = uTime * uWindSpeed + wo.x * 0.21 + wo.z * 0.17;
          float gust = 0.65 + 0.35 * sin(uTime * 0.37 + wo.x * 0.011 + wo.z * 0.007);
          float ws = (sin(wp) * 0.7 + sin(wp * 2.7 + 1.3) * 0.3) * uWindAmp * gust * wh * wh;
          transformed.x += ws;
          transformed.z += ws * 0.55;
        }
        #include <project_vertex>`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + NEAR_FADE);
  };
  m.customProgramCacheKey = () => 'wov-wind-' + key;
  return m;
}

// Buildings: a per-vertex surface id picks planks, stone, shingles or plaster,
// projected from whichever world axis the face points along.
const STRUCT_FRAG = /* glsl */`
  {
    vec3 an = abs(normalize(vWNormal));
    vec2 puv = an.y > 0.82 ? vWPos.xz : (an.x > an.z ? vWPos.zy : vWPos.xy);
    float sid = floor(vSurfId + 0.5);
    float pv = 0.5;
    if (sid > 0.5 && sid < 1.5) pv = texture2D(uPattern, puv * vec2(0.45, 0.5)).r;
    else if (sid > 1.5 && sid < 2.5) pv = texture2D(uPattern, puv * 0.3).g;
    else if (sid > 2.5 && sid < 3.5) pv = texture2D(uPattern, puv * 0.55).b;
    else if (sid > 3.5) pv = texture2D(uPattern, puv * 0.22).a;
    diffuseColor.rgb *= 0.5 + pv;
  }
`;
export function structureMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tex = patternTexture();
  m.onBeforeCompile = (sh) => {
    addUniforms(sh, { uPattern: { value: tex } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float surfId;\nvarying float vSurfId;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfId = surfId;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPattern;\nvarying float vSurfId;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + STRUCT_FRAG)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + NEAR_FADE);
  };
  m.customProgramCacheKey = () => 'wov-struct';
  return m;
}

// Characters and creatures: a cool rim light that lifts silhouettes off the ground.
export function addRimLight(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uRim = shared.uRim;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <opaque_fragment>', /* glsl */`
        {
          float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          outgoingLight += uRim * pow(rimF, 2.5);
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'wov-rim';
  return m;
}

// Surface id for a building part, guessed from its shape and color:
// 1 planks, 2 stone, 3 shingles, 4 plaster, 0 plain.
const _hsl = {};
const _col = new THREE.Color();
export function surfaceFor(part) {
  if (part.surf !== undefined) return part.surf;
  const t = part.g?.type;
  _col.setHex(part.c);
  _col.getHSL(_hsl);
  const { h, s, l } = _hsl;
  if (t === 'ConeGeometry' || part.g?.userData?.prism) return l < 0.62 ? 3 : 4;
  if (s < 0.16 && l > 0.12 && l < 0.62) return 2;
  if (l > 0.6) return 4;
  if (h > 0.02 && h < 0.13 && l < 0.5) return 1;
  if (h <= 0.02 || h > 0.95) return l < 0.5 ? 1 : 4;
  return 0;
}
