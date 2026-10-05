// Heightfield terrain: zones blend together, mountain ridges separate them,
// and roads cut passes through the ridges. Heights are sampled once into a
// grid and bilinearly interpolated at runtime.
import * as THREE from '../lib/three.module.min.js';
import { fbm, ridged, smoothstep, lerp, clamp, distToSegment, rng } from '../util.js';
import { ZONES, OVERWORLD_ZONES, WORLD_HALF, ROADS, LAKES, LAVA, TOWNS, FIELDS, WATER_LEVEL } from '../data/world.js';
import { inDungeon } from './collision.js';

const STEP = 4;
const N = Math.floor((WORLD_HALF * 2) / STEP) + 1;
const heights = new Float32Array(N * N);
const zoneGrid = new Uint8Array(N * N);
const roadGrid = new Uint8Array(N * N);
const ZLIST = OVERWORLD_ZONES.map((id) => ZONES[id]);

const roadSegs = [];
for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) roadSegs.push([r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]]);

export function roadDist(x, z) {
  let m = 1e9;
  for (const s of roadSegs) {
    // cheap bounding reject
    if (x < Math.min(s[0], s[2]) - 40 || x > Math.max(s[0], s[2]) + 40 || z < Math.min(s[1], s[3]) - 40 || z > Math.max(s[1], s[3]) + 40) continue;
    const d = distToSegment(x, z, s[0], s[1], s[2], s[3]);
    if (d < m) m = d;
  }
  return m;
}

function zoneDistances(x, z) {
  const wx = x + (fbm(x * 0.006, z * 0.006, 3, 11) - 0.5) * 140;
  const wz = z + (fbm(x * 0.006 + 50, z * 0.006, 3, 12) - 0.5) * 140;
  return ZLIST.map((zn) => Math.hypot(wx - zn.center.x, wz - zn.center.z));
}

function zoneBase(id, x, z) {
  switch (id) {
    case 'cottonvale': return 3 + fbm(x * 0.012, z * 0.012, 4, 2) * 9 + fbm(x * 0.05, z * 0.05, 2, 3) * 1.2;
    case 'whisperwood': return 5 + fbm(x * 0.015, z * 0.015, 4, 3) * 17;
    case 'saltmarsh': return 0.5 + (fbm(x * 0.022, z * 0.022, 4, 5) - 0.5) * 7;
    case 'ashen': return 20 + fbm(x * 0.01, z * 0.01, 4, 9) * 14 + ridged(x * 0.02, z * 0.02, 3, 4) * 9;
  }
  return 0;
}

function rawHeight(x, z, opts = {}) {
  const d = zoneDistances(x, z);
  let d1 = 1e9, d2 = 1e9;
  for (const v of d) { if (v < d1) { d2 = d1; d1 = v; } else if (v < d2) d2 = v; }
  let h = 0, wsum = 0;
  for (let i = 0; i < ZLIST.length; i++) {
    const w = Math.exp(-(d[i] - d1) / 22);
    if (w < 0.01) continue;
    h += zoneBase(ZLIST[i].id, x, z) * w; wsum += w;
  }
  h /= wsum;
  const rd = opts.roadDist ?? roadDist(x, z);
  const rm = 1 - smoothstep(9, 28, rd);
  // ridges along zone borders
  const b = 1 - smoothstep(0, 64, d2 - d1);
  let ridge = b * b * (40 + ridged(x * 0.03, z * 0.03, 3, 21) * 32);
  // outer mountains (west, north, east); the south is open sea
  const edge = Math.max(smoothstep(540, 650, -x), smoothstep(540, 650, -z), smoothstep(560, 660, x));
  ridge += edge * (70 + ridged(x * 0.02, z * 0.02, 3, 8) * 40);
  ridge *= 1 - rm;
  h += ridge;
  // gently smooth the road surface
  if (rm > 0) h = lerp(h, h * 0.85 + 0.6, rm * 0.5);
  // southern sea
  const sea = smoothstep(500, 590, z);
  h = lerp(h, -9, sea);
  // eastern bay of the fen
  const bay = smoothstep(560, 640, x) * smoothstep(-200, -60, z);
  h = lerp(h, -7, bay * 0.9);
  return h;
}

// Sites that flatten the ground (towns, fields) or carve basins (lakes, lava).
const flatSites = [];
export const lavaPools = [];
function prepareSites() {
  for (const t of TOWNS) flatSites.push({ x: t.x, z: t.z, r: t.r, h: Math.max(1.6, rawHeight(t.x, t.z)) });
  for (const f of FIELDS) flatSites.push({ x: f.x, z: f.z, r: Math.max(f.w, f.d) * 0.62, h: Math.max(1.4, rawHeight(f.x, f.z)) });
  for (const l of LAVA) {
    const lvl = rawHeight(l.x, l.z) - 1.2;
    lavaPools.push({ ...l, level: lvl });
  }
}

function finalHeight(x, z, rd) {
  let h = rawHeight(x, z, { roadDist: rd });
  for (const s of flatSites) {
    const dd = Math.hypot(x - s.x, z - s.z);
    if (dd < s.r * 1.25) h = lerp(s.h, h, smoothstep(s.r * 0.75, s.r * 1.25, dd));
  }
  for (const l of LAKES) {
    const dd = Math.hypot(x - l.x, z - l.z);
    if (dd < l.r * 1.4) h = lerp(-l.depth, h, smoothstep(l.r * 0.55, l.r * 1.35, dd));
  }
  for (const l of lavaPools) {
    const dd = Math.hypot(x - l.x, z - l.z);
    if (dd < l.r * 1.4) h = lerp(l.level - 2, h, smoothstep(l.r * 0.7, l.r * 1.3, dd));
  }
  return h;
}

export function generateHeights() {
  prepareSites();
  for (let j = 0; j < N; j++) {
    const z = -WORLD_HALF + j * STEP;
    for (let i = 0; i < N; i++) {
      const x = -WORLD_HALF + i * STEP;
      const rd = roadDist(x, z);
      heights[j * N + i] = finalHeight(x, z, rd);
      roadGrid[j * N + i] = Math.min(255, Math.floor(rd));
      const d = zoneDistances(x, z);
      let best = 0;
      for (let k = 1; k < d.length; k++) if (d[k] < d[best]) best = k;
      zoneGrid[j * N + i] = best;
    }
  }
}

function sampleGrid(arr, x, z) {
  const gx = clamp((x + WORLD_HALF) / STEP, 0, N - 1.001);
  const gz = clamp((z + WORLD_HALF) / STEP, 0, N - 1.001);
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const a = arr[j * N + i], b = arr[j * N + i + 1], c = arr[(j + 1) * N + i], d = arr[(j + 1) * N + i + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

export function heightAt(x, z) {
  if (inDungeon(x)) return 0;
  return sampleGrid(heights, x, z);
}
export function roadDistFast(x, z) {
  if (inDungeon(x)) return 99;
  return sampleGrid(roadGrid, x, z);
}
export function zoneAt(x, z) {
  if (inDungeon(x)) return 'spire';
  const gx = clamp(Math.round((x + WORLD_HALF) / STEP), 0, N - 1);
  const gz = clamp(Math.round((z + WORLD_HALF) / STEP), 0, N - 1);
  return ZLIST[zoneGrid[gz * N + gx]].id;
}
export function slopeAt(x, z) {
  const e = 2;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
export function waterDepth(x, z) {
  if (inDungeon(x)) return 0;
  return WATER_LEVEL - heightAt(x, z);
}
export function lavaAt(x, z) {
  for (const l of lavaPools) if (Math.hypot(x - l.x, z - l.z) < l.r * 0.95 && heightAt(x, z) < l.level + 0.2) return l;
  return null;
}
export function inField(x, z) {
  for (const f of FIELDS) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const dx = x - f.x, dz = z - f.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < f.w / 2 && Math.abs(lz) < f.d / 2) return f;
  }
  return null;
}
export function inTown(x, z, pad = 0) {
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return t;
  return null;
}

// ---------- rendering ----------
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
function zoneColor(x, z, h, slope, rd) {
  const d = zoneDistances(x, z);
  let d1 = Math.min(...d);
  const col = new THREE.Color(0, 0, 0);
  let wsum = 0;
  const n = fbm(x * 0.05, z * 0.05, 3, 33);
  for (let i = 0; i < ZLIST.length; i++) {
    const w = Math.exp(-(d[i] - d1) / 14);
    if (w < 0.01) continue;
    tmpC.setHex(ZLIST[i].ground);
    tmpC2.setHex(ZLIST[i].ground2);
    tmpC.lerp(tmpC2, n);
    col.r += tmpC.r * w; col.g += tmpC.g * w; col.b += tmpC.b * w; wsum += w;
  }
  col.multiplyScalar(1 / wsum);
  const zi = d.indexOf(d1);
  const zone = ZLIST[zi];
  // rock on steep slopes and high ridges
  const rockT = clamp((slope - 0.55) * 1.6, 0, 1) + clamp((h - (zone.id === 'ashen' ? 60 : 30)) / 30, 0, 1);
  if (rockT > 0) col.lerp(tmpC.setHex(zone.rock), clamp(rockT, 0, 1));
  // roads
  const rm = 1 - smoothstep(4, 8.5, rd);
  if (rm > 0) {
    const roadHex = zone.id === 'ashen' ? 0x7d6a5c : zone.id === 'saltmarsh' ? 0x7a6a48 : 0xa38660;
    col.lerp(tmpC.setHex(roadHex), rm * 0.9);
  }
  // shores, beaches and lake beds
  if (h < 1.6) {
    const sand = z > 470 ? 0xd8c690 : zone.id === 'saltmarsh' ? 0x5a5236 : 0xb3a173;
    col.lerp(tmpC.setHex(sand), clamp((1.6 - h) / 1.6, 0, 1) * 0.85);
  }
  if (h < -1.5) col.lerp(tmpC.setHex(0x3c4a40), clamp((-1.5 - h) / 5, 0, 0.7));
  // fields
  const f = inField(x, z);
  if (f) {
    const soil = f.kind === 'blighted' ? 0x5d5060 : f.kind === 'wheat' ? 0x9b8a4a : 0x6e5434;
    col.lerp(tmpC.setHex(soil), 0.75);
  }
  // town ground
  const t = inTown(x, z);
  if (t) {
    const dd = Math.hypot(x - t.x, z - t.z) / t.r;
    col.lerp(tmpC.setHex(zone.id === 'ashen' ? 0x6d6560 : 0x9a8a68), (1 - dd) * 0.45);
  }
  // lava rims glow
  for (const l of lavaPools) {
    const dd = Math.hypot(x - l.x, z - l.z);
    if (dd < l.r * 1.6) col.lerp(tmpC.setHex(0x3a2420), (1 - smoothstep(l.r * 0.8, l.r * 1.6, dd)) * 0.8);
  }
  return col;
}

export function buildTerrain(scene) {
  const CH = 35; // cells per chunk
  const chunks = Math.ceil((N - 1) / CH);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  group.name = 'terrain';
  for (let cj = 0; cj < chunks; cj++) {
    for (let ci = 0; ci < chunks; ci++) {
      const i0 = ci * CH, j0 = cj * CH;
      const i1 = Math.min(i0 + CH, N - 1), j1 = Math.min(j0 + CH, N - 1);
      const w = i1 - i0 + 1, d = j1 - j0 + 1;
      const pos = new Float32Array(w * d * 3), nor = new Float32Array(w * d * 3), col = new Float32Array(w * d * 3);
      let skipChunk = true;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = ((j - j0) * w + (i - i0)) * 3;
        const x = -WORLD_HALF + i * STEP, z = -WORLD_HALF + j * STEP;
        const h = heights[j * N + i];
        if (h > -8.5) skipChunk = false;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
        const hl = heights[j * N + Math.max(0, i - 1)], hr = heights[j * N + Math.min(N - 1, i + 1)];
        const hd = heights[Math.max(0, j - 1) * N + i], hu = heights[Math.min(N - 1, j + 1) * N + i];
        const nx = hl - hr, nz = hd - hu, ny = 2 * STEP;
        const len = Math.hypot(nx, ny, nz);
        nor[k] = nx / len; nor[k + 1] = ny / len; nor[k + 2] = nz / len;
        const slope = Math.hypot(hr - hl, hu - hd) / (2 * STEP);
        const c = zoneColor(x, z, h, slope, roadGrid[j * N + i]);
        // subtle per-vertex jitter breaks up the grid
        const jit = 0.94 + ((i * 7 + j * 13) % 11) / 90;
        col[k] = c.r * jit; col[k + 1] = c.g * jit; col[k + 2] = c.b * jit;
      }
      if (skipChunk) continue;
      const idx = [];
      for (let j = 0; j < d - 1; j++) for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, c = a + w, e = c + 1;
        if ((i + j) % 2) { idx.push(a, c, b, b, c, e); } else { idx.push(a, c, e, a, e, b); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.userData.ground = true;
      group.add(mesh);
    }
  }
  scene.add(group);

  // water
  const wgeo = new THREE.PlaneGeometry(WORLD_HALF * 2 + 400, WORLD_HALF * 2 + 400, 1, 1);
  wgeo.rotateX(-Math.PI / 2);
  const wmat = new THREE.MeshLambertMaterial({ color: 0x3a6f8a, transparent: true, opacity: 0.72, depthWrite: false });
  const water = new THREE.Mesh(wgeo, wmat);
  water.position.y = WATER_LEVEL - 0.15;
  water.renderOrder = 2;
  water.name = 'water';
  scene.add(water);

  // lava
  const lmat = new THREE.MeshBasicMaterial({ color: 0xff5a1a });
  for (const l of lavaPools) {
    const g = new THREE.CircleGeometry(l.r * 1.15, 24);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, lmat);
    m.position.set(l.x, l.level, l.z);
    m.name = 'lava';
    scene.add(m);
  }
  return { group, water, lavaMat: lmat, waterMat: wmat };
}

// Precompute a small top-down color image of the world for the minimap and world map.
export function renderMapImage(size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const c = new THREE.Color();
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = -WORLD_HALF + (px / size) * WORLD_HALF * 2;
      const z = -WORLD_HALF + (py / size) * WORLD_HALF * 2;
      const h = sampleGrid(heights, x, z);
      const k = (py * size + px) * 4;
      if (h < WATER_LEVEL - 0.2) {
        const deep = clamp(-h / 8, 0, 1);
        c.setRGB(lerp(0.32, 0.12, deep), lerp(0.5, 0.26, deep), lerp(0.6, 0.42, deep));
      } else {
        const gx = Math.round((x + WORLD_HALF) / STEP), gz = Math.round((z + WORLD_HALF) / STEP);
        const zi = zoneGrid[gz * N + gx];
        c.setHex(ZLIST[zi].ground);
        const shade = clamp(0.75 + h / 120, 0.6, 1.25);
        c.multiplyScalar(shade);
        const rd = roadGrid[gz * N + gx];
        if (rd < 5) c.setHex(0xc8a878);
        if (inField(x, z)) c.setHex(0x9a7a50);
        if (h > 45) c.lerp(new THREE.Color(0x8a8070), 0.6);
      }
      for (const l of lavaPools) if (Math.hypot(x - l.x, z - l.z) < l.r) c.setHex(0xff6020);
      c.convertLinearToSRGB();
      img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export { rng };
