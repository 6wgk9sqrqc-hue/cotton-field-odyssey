// Trees, rocks, crops and buildings. Static meshes are merged into one
// vertex-colored geometry per prop type so the world costs few draw calls.
import * as THREE from '../lib/three.module.min.js';
import { heightAt, zoneAt, roadDistFast, inTown, inField, slopeAt, lavaAt } from './terrain.js';
import { addCircle, addBox } from './collision.js';
import { FIELDS, WORLD_HALF, DUNGEON } from '../data/world.js';
import { STRUCTURES } from '../data/structures.js';
import { rng, hash2 } from '../util.js';
import { G } from '../state.js';

const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

// parts: [{ g: geometry, c: hex, p: [x,y,z], r: [rx,ry,rz], s: [sx,sy,sz] }]
export function mergeParts(parts) {
  let count = 0;
  const geos = parts.map((pt) => {
    let g = pt.g.index ? pt.g.toNonIndexed() : pt.g.clone();
    if (pt.q) _q.copy(pt.q);
    else { const r = pt.r ?? [0, 0, 0]; _e.set(r[0], r[1], r[2], pt.order ?? 'XYZ'); _q.setFromEuler(_e); }
    _s.set(...(pt.s ?? [1, 1, 1]));
    _p.set(...(pt.p ?? [0, 0, 0]));
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    count += g.attributes.position.count;
    return { g, c: pt.c };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const { g, c } of geos) {
    _c.setHex(c);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    pos.set(pa, o * 3); nor.set(na, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b;
    }
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
// open tube for thin stalks, whose end caps are never seen
const T = (rt, rb, h, s = 3) => new THREE.CylinderGeometry(rt, rb, h, s, 1, true);
const K = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const I = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const D = (r) => new THREE.DodecahedronGeometry(r, 0);
const O = (r) => new THREE.OctahedronGeometry(r, 0);
const S = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
function prism() {
  // unit triangular prism: base 1 wide along x, 1 deep along z, apex height 1
  const g = new THREE.BufferGeometry();
  const v = [
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
    0.5, 0, -0.5, -0.5, 0, -0.5, 0, 1, -0.5,
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
    0.5, 0, 0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
const PRISM = prism();

// ---------- prop designs ----------
const PROPS = {
  oak: () => mergeParts([
    { g: C(0.25, 0.4, 3, 6), c: 0x5a3e26, p: [0, 1.5, 0] },
    { g: I(2.0, 0), c: 0x4f7f34, p: [0, 3.8, 0], s: [1, 0.85, 1] },
    { g: I(1.4, 0), c: 0x5f9040, p: [0.9, 4.4, 0.4] },
    { g: I(1.3, 0), c: 0x467530, p: [-0.8, 4.1, -0.5] },
  ]),
  appletree: () => mergeParts([
    { g: C(0.2, 0.32, 2.2, 6), c: 0x5a3e26, p: [0, 1.1, 0] },
    { g: I(1.6, 0), c: 0x5a8a3a, p: [0, 3.0, 0] },
    { g: S(0.14, 5, 4), c: 0xc0302a, p: [0.9, 2.8, 0.9] },
    { g: S(0.14, 5, 4), c: 0xc0302a, p: [-1.0, 3.2, 0.4] },
    { g: S(0.14, 5, 4), c: 0xc0302a, p: [0.3, 2.6, -1.2] },
  ]),
  pine: () => mergeParts([
    { g: C(0.2, 0.32, 2.4, 6), c: 0x4a3222, p: [0, 1.2, 0] },
    { g: K(2.2, 3.4, 7), c: 0x2c5a34, p: [0, 3.4, 0] },
    { g: K(1.7, 3.0, 7), c: 0x316638, p: [0, 5.0, 0] },
    { g: K(1.1, 2.4, 7), c: 0x37703e, p: [0, 6.6, 0] },
  ]),
  bigtree: () => mergeParts([
    { g: C(0.5, 0.9, 5, 7), c: 0x4a3426, p: [0, 2.5, 0] },
    { g: C(0.15, 0.3, 3, 5), c: 0x4a3426, p: [1.2, 4.6, 0], r: [0, 0, -0.8] },
    { g: I(3.0, 0), c: 0x2f5a2c, p: [0, 6.6, 0], s: [1.1, 0.75, 1.1] },
    { g: I(2.0, 0), c: 0x3a6a32, p: [2.0, 6.0, 1.0] },
    { g: I(2.2, 0), c: 0x284e28, p: [-1.8, 6.4, -0.8] },
  ]),
  cypress: () => mergeParts([
    { g: C(0.25, 0.6, 5, 6), c: 0x5a4a38, p: [0, 2.5, 0] },
    { g: S(2.2, 7, 5), c: 0x5a6a34, p: [0, 5.6, 0], s: [1, 0.5, 1] },
    { g: B(0.15, 1.6, 0.15), c: 0x7a8a5a, p: [1.4, 4.6, 0] },
    { g: B(0.15, 1.8, 0.15), c: 0x7a8a5a, p: [-1.2, 4.5, 0.6] },
    { g: B(0.15, 1.4, 0.15), c: 0x7a8a5a, p: [0.2, 4.7, -1.5] },
  ]),
  deadtree: () => mergeParts([
    { g: C(0.18, 0.35, 4, 5), c: 0x3a3430, p: [0, 2, 0] },
    { g: C(0.07, 0.14, 2, 4), c: 0x3a3430, p: [0.7, 3.6, 0], r: [0, 0, -0.9] },
    { g: C(0.06, 0.12, 1.6, 4), c: 0x3a3430, p: [-0.6, 3.2, 0.2], r: [0.2, 0, 0.9] },
    { g: C(0.05, 0.1, 1.4, 4), c: 0x3a3430, p: [0, 4.2, -0.5], r: [-0.8, 0, 0] },
  ]),
  bush: () => mergeParts([
    { g: I(0.8, 0), c: 0x4f7a32, p: [0, 0.5, 0], s: [1.2, 0.8, 1] },
    { g: I(0.6, 0), c: 0x5a8a3a, p: [0.6, 0.45, 0.3] },
  ]),
  fern: () => mergeParts([
    { g: K(0.5, 1.0, 5), c: 0x3f7a3a, p: [0, 0.5, 0] },
    { g: K(0.4, 0.8, 5), c: 0x4a8a40, p: [0.4, 0.4, 0.2], r: [0, 0, -0.4] },
    { g: K(0.4, 0.8, 5), c: 0x4a8a40, p: [-0.4, 0.4, -0.1], r: [0, 0, 0.4] },
  ]),
  rock: () => mergeParts([{ g: D(1.0), c: 0x85807a, p: [0, 0.4, 0], s: [1.2, 0.8, 1] }]),
  bigrock: () => mergeParts([
    { g: D(2.4), c: 0x7a756e, p: [0, 1.2, 0], s: [1.3, 0.9, 1.1] },
    { g: D(1.2), c: 0x8a857e, p: [1.8, 0.6, 0.6] },
  ]),
  ashspike: () => mergeParts([
    { g: K(0.9, 4.5, 5), c: 0x3a3230, p: [0, 2.0, 0], r: [0.1, 0, 0.08] },
    { g: K(0.5, 2.6, 5), c: 0x4a3a34, p: [1.0, 1.1, 0.3], r: [0, 0, -0.2] },
  ]),
  emberrock: () => mergeParts([
    { g: D(0.9), c: 0x2e2826, p: [0, 0.4, 0] },
    { g: D(0.3), c: 0xff6a20, p: [0.5, 0.7, 0.2] },
  ]),
  reeds: () => mergeParts([
    { g: C(0.03, 0.04, 1.8, 3), c: 0x6a7a3a, p: [0, 0.9, 0] },
    { g: C(0.03, 0.04, 1.5, 3), c: 0x7a8a40, p: [0.25, 0.75, 0.1], r: [0, 0, -0.15] },
    { g: C(0.03, 0.04, 1.6, 3), c: 0x6a7a3a, p: [-0.2, 0.8, -0.15], r: [0.1, 0, 0.15] },
    { g: B(0.08, 0.3, 0.08), c: 0x5a3a22, p: [0, 1.8, 0] },
  ]),
  mushroom: () => mergeParts([
    { g: C(0.08, 0.12, 0.6, 5), c: 0xe0d8c0, p: [0, 0.3, 0] },
    { g: S(0.38, 7, 4), c: 0x8a4ab0, p: [0, 0.62, 0], s: [1, 0.5, 1] },
    { g: C(0.06, 0.08, 0.4, 5), c: 0xe0d8c0, p: [0.4, 0.2, 0.2] },
    { g: S(0.24, 7, 4), c: 0x9a5ac0, p: [0.4, 0.42, 0.2], s: [1, 0.5, 1] },
  ]),
  blighted: () => mergeParts([
    { g: C(0.04, 0.05, 0.8, 3), c: 0x4a4038, p: [0, 0.4, 0], r: [0.2, 0, 0.2] },
    { g: O(0.22), c: 0x5a5048, p: [0.05, 0.6, 0], s: [1, 0.5, 1] },
    { g: O(0.11), c: 0x8a8070, p: [0.12, 0.75, 0.05] },
  ]),
  wheat: () => mergeParts([
    { g: T(0.018, 0.028, 1.05, 3), c: 0xb89a48, p: [0, 0.52, 0] },
    { g: T(0.018, 0.028, 0.95, 3), c: 0xc4a450, p: [0.26, 0.47, 0.08], r: [0, 0, -0.14] },
    { g: T(0.018, 0.028, 1.0, 3), c: 0xb09040, p: [-0.24, 0.5, -0.1], r: [0.1, 0, 0.14] },
    { g: T(0.018, 0.028, 0.9, 3), c: 0xc0a04c, p: [0.06, 0.45, 0.27], r: [0.16, 0, 0] },
    { g: O(0.08), c: 0xe8c860, p: [0, 1.18, 0], s: [0.8, 2.6, 0.8] },
    { g: O(0.08), c: 0xf0d070, p: [0.345, 1.08, 0.08], s: [0.8, 2.5, 0.8], r: [0, 0, -0.14] },
    { g: O(0.08), c: 0xe0c058, p: [-0.33, 1.13, -0.04], s: [0.8, 2.5, 0.8], r: [0.1, 0, 0.14] },
    { g: O(0.08), c: 0xecc868, p: [0.06, 1.03, 0.36], s: [0.8, 2.4, 0.8], r: [0.16, 0, 0] },
  ]),
  grass: () => mergeParts([
    { g: K(0.12, 0.6, 3), c: 0x6a9a40, p: [0, 0.3, 0] },
    { g: K(0.1, 0.5, 3), c: 0x5a8a38, p: [0.15, 0.25, 0.1], r: [0, 0, -0.3] },
    { g: K(0.1, 0.5, 3), c: 0x7aa848, p: [-0.12, 0.25, -0.05], r: [0, 0, 0.3] },
  ]),
};

const propGeoCache = {};
function propGeo(type) {
  if (!propGeoCache[type]) propGeoCache[type] = PROPS[type]();
  return propGeoCache[type];
}

// instances[type][chunkKey] = [matrices...]
const pending = {};
function addInstance(type, x, z, rot, scale, tint, sinkY = 0.1) {
  const ck = Math.floor((x + WORLD_HALF) / 140) + ',' + Math.floor((z + WORLD_HALF) / 140);
  pending[type] ??= {};
  pending[type][ck] ??= [];
  const y = heightAt(x, z) - sinkY;
  pending[type][ck].push({ x, y, z, rot, scale, tint });
}

function flushInstances(scene) {
  const group = new THREE.Group();
  group.name = 'props';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  for (const type in pending) {
    const geo = propGeo(type);
    for (const ck in pending[type]) {
      const list = pending[type][ck];
      const im = new THREE.InstancedMesh(geo, vcMat, list.length);
      list.forEach((it, i) => {
        e.set(0, it.rot, 0); q.setFromEuler(e);
        s.setScalar(it.scale); p.set(it.x, it.y, it.z);
        m.compose(p, q, s);
        im.setMatrixAt(i, m);
        c.setRGB(it.tint, it.tint, it.tint);
        im.setColorAt(i, c);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  }
  scene.add(group);
  return group;
}

const DENSITY = {
  cottonvale: [['oak', 0.05], ['appletree', 0.012], ['bush', 0.06], ['rock', 0.02], ['grass', 0.25]],
  whisperwood: [['pine', 0.3], ['oak', 0.14], ['bigtree', 0.05], ['bush', 0.08], ['fern', 0.16], ['rock', 0.04], ['mushroom', 0.015]],
  saltmarsh: [['cypress', 0.13], ['deadtree', 0.04], ['reeds', 0.22], ['mushroom', 0.03], ['bush', 0.04]],
  ashen: [['deadtree', 0.04], ['rock', 0.07], ['bigrock', 0.025], ['ashspike', 0.05], ['emberrock', 0.04]],
};
const COLLIDE = { oak: 0.55, appletree: 0.45, pine: 0.5, bigtree: 1.0, cypress: 0.6, deadtree: 0.4, rock: 0.9, bigrock: 2.6, ashspike: 0.9 };

export function buildScenery(scene) {
  const R = rng(1337);
  const cell = 6;
  for (let z = -WORLD_HALF + 20; z < WORLD_HALF - 20; z += cell) {
    for (let x = -WORLD_HALF + 20; x < WORLD_HALF - 20; x += cell) {
      const jx = x + (hash2(x, z, 3) - 0.5) * cell * 0.9;
      const jz = z + (hash2(x, z, 4) - 0.5) * cell * 0.9;
      const h = heightAt(jx, jz);
      const zone = zoneAt(jx, jz);
      const rd = roadDistFast(jx, jz);
      if (rd < 7) continue;
      if (inTown(jx, jz, 8)) continue;
      if (inField(jx, jz)) continue;
      if (lavaAt(jx, jz)) continue;
      const slope = slopeAt(jx, jz);
      const r = hash2(x, z, 9);
      let acc = 0;
      const list = DENSITY[zone];
      if (!list) continue;
      for (const [type, dens] of list) {
        let d = dens;
        const wet = type === 'reeds';
        if (wet) d = h < 1.5 && h > -1.2 ? dens * 2.5 : 0;
        else if (h < 0.3 && type !== 'cypress' && type !== 'deadtree') d = 0;
        if (slope > 1.1 && type !== 'rock' && type !== 'bigrock' && type !== 'pine') d *= 0.2;
        if (h > 50 && type === 'grass') d = 0;
        if (zone === 'cottonvale' && type === 'grass' && rd < 12) d *= 0.3;
        acc += d;
        if (r < acc) {
          const scale = 0.75 + hash2(x, z, 11) * 0.6;
          const rot = hash2(x, z, 12) * Math.PI * 2;
          const tint = 0.85 + hash2(x, z, 13) * 0.3;
          addInstance(type, jx, jz, rot, scale, tint, type === 'cypress' && h < 0 ? h : 0.1);
          if (COLLIDE[type]) addCircle(jx, jz, COLLIDE[type] * scale);
          break;
        }
      }
    }
  }
  // crops in rows
  for (const f of FIELDS) {
    const type = f.kind === 'blighted' ? 'blighted' : 'wheat';
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    for (let lz = -f.d / 2 + 1.5; lz < f.d / 2 - 1; lz += 2.8) {
      for (let lx = -f.w / 2 + 1.2; lx < f.w / 2 - 1; lx += 1.9) {
        if (f.kind === 'weevil' && R() < 0.35) continue;
        const ox = lx + (R() - 0.5) * 0.4;
        const x = f.x + ox * c + lz * s;
        const z = f.z - ox * s + lz * c;
        addInstance(type, x, z, R() * 6.28, 0.85 + R() * 0.35, 0.9 + R() * 0.2, 0.05);
      }
    }
    // fence around the field, with a gap on the south side
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
      const lx = a * (f.w / 2 + 1), lz = b * (f.d / 2 + 1);
      return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    });
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % 4];
      if (i === 2) {
        // leave an opening in the middle of this side
        const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
        const dx = (x2 - x1), dz = (z2 - z1), L = Math.hypot(dx, dz);
        const ux = dx / L, uz = dz / L;
        fence(x1, z1, mx - ux * 3, mz - uz * 3);
        fence(mx + ux * 3, mz + uz * 3, x2, z2);
      } else fence(x1, z1, x2, z2);
    }
  }
  const props = flushInstances(scene);
  const structures = buildStructures(scene);
  const dungeon = buildDungeon(scene);
  return { props, structures, dungeon };
}

// ---------- structures ----------
const fenceParts = [];
function fence(x1, z1, x2, z2, color = 0x8a6a44) {
  const L = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(L / 3));
  const rot = Math.atan2(x2 - x1, z2 - z1);
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n, z = z1 + ((z2 - z1) * i) / n;
    const y = heightAt(x, z);
    fenceParts.push({ g: B(0.18, 1.3, 0.18), c: color, p: [x, y + 0.6, z] });
    if (i < n) {
      const nx = x1 + ((x2 - x1) * (i + 1)) / n, nz = z1 + ((z2 - z1) * (i + 1)) / n;
      const ny = heightAt(nx, nz);
      const mx = (x + nx) / 2, mz = (z + nz) / 2, my = (y + ny) / 2;
      const seg = Math.hypot(nx - x, nz - z);
      const tilt = Math.atan2(ny - y, seg);
      fenceParts.push({ g: B(0.08, 0.12, seg), c: color, p: [mx, my + 1.0, mz], r: [-tilt, rot, 0], order: 'YXZ' });
      fenceParts.push({ g: B(0.08, 0.12, seg), c: color, p: [mx, my + 0.55, mz], r: [-tilt, rot, 0], order: 'YXZ' });
    }
  }
  addBox((x1 + x2) / 2, (z1 + z2) / 2, 0.15, L / 2, rot);
}

function rotPt(x, z, rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [x * c + z * s, -x * s + z * c];
}

// Each builder returns parts in local space; the caller places and merges them.
const BUILD = {
  house(o) {
    const w = o.w ?? 8, d = o.d ?? 6, h = o.h ?? 3.6;
    const wall = o.wall ?? 0xe2d4b2, beam = 0x5a3a22, roof = o.roof ?? 0x9a3a2a;
    const p = [
      { g: B(w, h, d), c: wall, p: [0, h / 2, 0] },
      { g: B(w + 0.1, 0.25, d + 0.1), c: beam, p: [0, h, 0] },
      { g: B(w + 0.1, 0.3, d + 0.1), c: 0x6a6258, p: [0, 0.15, 0] },
      { g: PRISM, c: roof, p: [0, h + 0.1, 0], s: [w + 1, o.roofH ?? 2.6, d + 1.2], r: [0, Math.PI / 2, 0] },
      { g: B(1.3, 2.2, 0.15), c: 0x4a2e1a, p: [0, 1.1, d / 2 + 0.05] },
      { g: B(1.0, 0.9, 0.12), c: 0xf0d080, p: [-w / 4 - 0.4, 2.1, d / 2 + 0.03] },
      { g: B(1.0, 0.9, 0.12), c: 0xf0d080, p: [w / 4 + 0.4, 2.1, d / 2 + 0.03] },
      { g: B(0.8, 2.4, 0.8), c: 0x6a5a50, p: [w / 3, h + 1.6, -d / 4] },
    ];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push({ g: B(0.3, h, 0.3), c: beam, p: [sx * w / 2, h / 2, sz * d / 2] });
    return { parts: p, box: [w / 2, d / 2] };
  },
  inn(o) {
    const w = 14, d = 10, h = 6.4;
    const p = BUILD.house({ w, d, h, roof: 0x6a4a3a, roofH: 4, wall: 0xd8c8a0 }).parts;
    p.push({ g: B(w + 0.2, 0.3, d + 0.2), c: 0x5a3a22, p: [0, 3.2, 0] });
    p.push({ g: B(0.15, 1.2, 1.8), c: 0x6a4a2a, p: [w / 2 + 0.6, 3.2, d / 2 - 1] });
    p.push({ g: B(0.12, 1.0, 1.6), c: 0xd8b060, p: [w / 2 + 0.7, 3.2, d / 2 - 1] });
    p.push({ g: B(0.12, 0.12, 1.4), c: 0x3a2a1a, p: [w / 2 + 0.4, 3.9, d / 2 - 1] });
    return { parts: p, box: [w / 2, d / 2] };
  },
  barn(o) {
    const w = 12, d = 9, h = 5;
    const p = [
      { g: B(w, h, d), c: 0x9a3a2a, p: [0, h / 2, 0] },
      { g: PRISM, c: 0x4a3a30, p: [0, h, 0], s: [w + 1, 3.5, d + 1], r: [0, Math.PI / 2, 0] },
      { g: B(4, 3.6, 0.2), c: 0x6a2a1a, p: [0, 1.8, d / 2 + 0.05] },
      { g: B(4.2, 0.2, 0.25), c: 0xe0d8c8, p: [0, 1.8, d / 2 + 0.12], r: [0, 0, 0.7] },
      { g: B(4.2, 0.2, 0.25), c: 0xe0d8c8, p: [0, 1.8, d / 2 + 0.12], r: [0, 0, -0.7] },
    ];
    return { parts: p, box: [w / 2, d / 2] };
  },
  windmill(o) {
    const p = [
      { g: C(2.2, 3.2, 10, 8), c: 0xe0d6c0, p: [0, 5, 0] },
      { g: K(2.8, 3, 8), c: 0x7a3a2a, p: [0, 11.5, 0] },
      { g: B(1.2, 2.0, 0.2), c: 0x4a2e1a, p: [0, 1, 3.05] },
      { g: C(0.3, 0.3, 1.2, 6), c: 0x5a3a22, p: [0, 9, 2.6], r: [Math.PI / 2, 0, 0] },
    ];
    return { parts: p, circle: 3.3, blades: { y: 9, z: 3.3 } };
  },
  tower(o) {
    const h = o.h ?? 12, r = o.r ?? 3;
    const col = o.color ?? 0x8a8478;
    const p = [
      { g: C(r, r + 0.4, h, 10), c: col, p: [0, h / 2, 0] },
      { g: C(r + 0.5, r + 0.5, 1, 10), c: col, p: [0, h + 0.3, 0] },
      { g: B(1.2, 2.2, 0.2), c: 0x3a2a1a, p: [0, 1.1, r + 0.25] },
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.push({ g: B(0.9, 0.9, 0.9), c: col, p: [Math.cos(a) * (r + 0.2), h + 1.2, Math.sin(a) * (r + 0.2)] });
    }
    if (o.roof) p.push({ g: K(r + 1, 4, 10), c: o.roof, p: [0, h + 2.8, 0] });
    return { parts: p, circle: r + 0.4 };
  },
  wall(o) {
    const L = o.len ?? 10, h = o.h ?? 4, col = o.color ?? 0x8a8478;
    const p = [{ g: B(L, h, 1.4), c: col, p: [0, h / 2, 0] }];
    for (let x = -L / 2 + 0.7; x < L / 2; x += 2) p.push({ g: B(0.9, 0.8, 1.5), c: col, p: [x, h + 0.4, 0] });
    return { parts: p, box: [L / 2, 0.7] };
  },
  palisade(o) {
    const L = o.len ?? 10;
    const p = [];
    for (let x = -L / 2; x <= L / 2; x += 0.55) p.push({ g: C(0.25, 0.28, 3.2 + ((x * 7) % 1) * 0.5, 5), c: 0x6a4a2e, p: [x, 1.6, 0] });
    for (let x = -L / 2; x <= L / 2; x += 0.55) p.push({ g: K(0.25, 0.6, 5), c: 0x5a3e26, p: [x, 3.5, 0] });
    return { parts: p, box: [L / 2, 0.4] };
  },
  tent(o) {
    const col = o.color ?? 0xb8a888;
    const p = [
      { g: PRISM, c: col, p: [0, 0, 0], s: [4, 2.8, 5], r: [0, 0, 0] },
      { g: B(0.12, 3, 0.12), c: 0x5a3e26, p: [0, 1.4, 2.6] },
      { g: B(0.12, 3, 0.12), c: 0x5a3e26, p: [0, 1.4, -2.6] },
    ];
    return { parts: p, box: [2, 2.5] };
  },
  hut(o) {
    // stilt hut for the fens
    const w = o.w ?? 6, d = o.d ?? 6, ph = o.stilt ?? 1.4;
    const p = [{ g: B(w + 2, 0.3, d + 2), c: 0x6a5238, p: [0, ph, 0] }];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push({ g: C(0.15, 0.18, ph + 1.5, 5), c: 0x4a3a28, p: [sx * (w / 2 + 0.8), ph / 2 - 0.5, sz * (d / 2 + 0.8)] });
    p.push({ g: B(w, 2.8, d), c: o.wall ?? 0x7a6448, p: [0, ph + 1.55, 0] });
    p.push({ g: K(Math.max(w, d) * 0.8, 3, 4), c: o.roof ?? 0x9a8a50, p: [0, ph + 4.4, 0], r: [0, Math.PI / 4, 0] });
    p.push({ g: B(1.1, 2.0, 0.1), c: 0x2a1e14, p: [0, ph + 1.15, d / 2 + 0.03] });
    return { parts: p, box: [w / 2 + 0.3, d / 2 + 0.3] };
  },
  mudhut(o) {
    const p = [
      { g: S(2.4, 8, 6), c: o.color ?? 0x5a5a3a, p: [0, 0.6, 0], s: [1, 0.9, 1] },
      { g: K(1.2, 1.6, 6), c: 0x7a7a4a, p: [0, 2.8, 0] },
      { g: B(0.9, 1.4, 0.4), c: 0x1a1a10, p: [0, 0.7, 2.2] },
    ];
    return { parts: p, circle: 2.3 };
  },
  well() {
    const p = [
      { g: C(1.1, 1.2, 1.0, 10), c: 0x8a8478, p: [0, 0.5, 0] },
      { g: C(0.9, 0.9, 0.2, 10), c: 0x2a3a4a, p: [0, 0.9, 0] },
      { g: B(0.15, 2.4, 0.15), c: 0x5a3a22, p: [-1, 1.2, 0] },
      { g: B(0.15, 2.4, 0.15), c: 0x5a3a22, p: [1, 1.2, 0] },
      { g: PRISM, c: 0x7a3a2a, p: [0, 2.3, 0], s: [2.6, 1.0, 2.0], r: [0, 0, 0] },
    ];
    return { parts: p, circle: 1.2 };
  },
  cart() {
    const p = [
      { g: B(1.8, 0.6, 3), c: 0x7a5a38, p: [0, 1.0, 0] },
      { g: C(0.55, 0.55, 0.12, 10), c: 0x4a3222, p: [-1.0, 0.55, 0.6], r: [0, 0, Math.PI / 2] },
      { g: C(0.55, 0.55, 0.12, 10), c: 0x4a3222, p: [1.0, 0.55, 0.6], r: [0, 0, Math.PI / 2] },
      { g: B(0.12, 0.12, 2), c: 0x5a3a22, p: [0.4, 0.9, 2.3] },
      { g: B(0.12, 0.12, 2), c: 0x5a3a22, p: [-0.4, 0.9, 2.3] },
      { g: S(0.5, 6, 4), c: 0xf0eee6, p: [0.3, 1.5, -0.4] },
      { g: S(0.45, 6, 4), c: 0xf0eee6, p: [-0.3, 1.5, 0.5] },
    ];
    return { parts: p, box: [1, 1.6] };
  },
  hay() {
    return { parts: [{ g: C(0.9, 0.9, 1.6, 10), c: 0xd8b860, p: [0, 0.8, 0], r: [0, 0, Math.PI / 2] }], circle: 0.9 };
  },
  crates() {
    return {
      parts: [
        { g: B(1, 1, 1), c: 0x8a6a40, p: [0, 0.5, 0] },
        { g: B(0.9, 0.9, 0.9), c: 0x7a5a38, p: [1.1, 0.45, 0.2], r: [0, 0.3, 0] },
        { g: B(0.8, 0.8, 0.8), c: 0x8a6a40, p: [0.4, 1.4, 0.1], r: [0, 0.6, 0] },
        { g: C(0.4, 0.4, 1, 8), c: 0x6a4a2a, p: [-1, 0.5, 0.3] },
      ], circle: 1.3,
    };
  },
  campfire() {
    const p = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      p.push({ g: D(0.25), c: 0x6a6460, p: [Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7] });
    }
    p.push({ g: B(1.2, 0.15, 0.15), c: 0x3a2a1a, p: [0, 0.15, 0], r: [0, 0.6, 0] });
    p.push({ g: B(1.2, 0.15, 0.15), c: 0x3a2a1a, p: [0, 0.15, 0], r: [0, -0.6, 0] });
    return { parts: p, circle: 0.8, fire: true };
  },
  signpost(o) {
    const p = [
      { g: B(0.2, 3, 0.2), c: 0x5a3a22, p: [0, 1.5, 0] },
      { g: B(1.6, 0.35, 0.08), c: 0x9a7a50, p: [0.6, 2.6, 0], r: [0, 0.3, 0] },
      { g: B(1.6, 0.35, 0.08), c: 0x9a7a50, p: [-0.6, 2.1, 0], r: [0, -0.4, 0] },
    ];
    return { parts: p, circle: 0.2 };
  },
  stall(o) {
    const col = o.color ?? 0xb04a3a;
    const p = [
      { g: B(3, 1.0, 1.4), c: 0x7a5a38, p: [0, 0.5, 0] },
      { g: B(0.12, 2.6, 0.12), c: 0x5a3a22, p: [-1.4, 1.3, -0.6] },
      { g: B(0.12, 2.6, 0.12), c: 0x5a3a22, p: [1.4, 1.3, -0.6] },
      { g: B(0.12, 2.2, 0.12), c: 0x5a3a22, p: [-1.4, 1.1, 0.6] },
      { g: B(0.12, 2.2, 0.12), c: 0x5a3a22, p: [1.4, 1.1, 0.6] },
      { g: B(3.4, 0.1, 1.8), c: col, p: [0, 2.4, 0], r: [0.25, 0, 0] },
    ];
    return { parts: p, box: [1.5, 0.8] };
  },
  lamp() {
    return {
      parts: [
        { g: B(0.15, 3.2, 0.15), c: 0x2a2a2a, p: [0, 1.6, 0] },
        { g: B(0.5, 0.5, 0.5), c: 0xffd070, p: [0, 3.3, 0] },
        { g: K(0.45, 0.4, 4), c: 0x2a2a2a, p: [0, 3.75, 0], r: [0, Math.PI / 4, 0] },
      ], circle: 0.2, glow: 3.3,
    };
  },
  dock(o) {
    const L = o.len ?? 16, w = o.w ?? 4;
    const p = [{ g: B(w, 0.25, L), c: 0x7a5a38, p: [0, 1.2, 0] }];
    for (let z = -L / 2 + 1; z <= L / 2; z += 3) for (const sx of [-1, 1]) p.push({ g: C(0.15, 0.15, 4, 5), c: 0x4a3a28, p: [sx * (w / 2 - 0.2), -0.6, z] });
    return { parts: p, platform: { hw: w / 2, hd: L / 2, y: 1.32 } };
  },
  ruin(o) {
    const p = [];
    const R = rng(o.seed ?? 5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const h = 1 + R() * 4;
      p.push({ g: B(1, h, 1), c: o.color ?? 0x8a8478, p: [Math.cos(a) * 5, h / 2, Math.sin(a) * 5] });
    }
    p.push({ g: B(4, 0.6, 1), c: o.color ?? 0x8a8478, p: [0, 0.3, 2], r: [0, 0.4, 0] });
    return { parts: p, ruinCols: true };
  },
  statue(o) {
    return {
      parts: [
        { g: B(2.2, 1.2, 2.2), c: 0x8a8478, p: [0, 0.6, 0] },
        { g: B(0.9, 2.0, 0.6), c: 0xb0aaa0, p: [0, 2.2, 0] },
        { g: B(0.5, 0.5, 0.5), c: 0xb0aaa0, p: [0, 3.5, 0] },
        { g: B(0.15, 2.6, 0.15), c: 0xb0aaa0, p: [0.6, 3.0, 0.2] },
      ], box: [1.1, 1.1],
    };
  },
  spire() {
    const p = [
      { g: C(9, 12, 6, 8), c: 0x2a2630, p: [0, 3, 0] },
      { g: C(6, 8.5, 22, 8), c: 0x332e3a, p: [0, 17, 0] },
      { g: C(3, 5.5, 18, 8), c: 0x3a3442, p: [0, 37, 0] },
      { g: K(3.6, 14, 8), c: 0x241f2c, p: [0, 53, 0] },
      { g: I(1.6, 0), c: 0xb070ff, p: [0, 61.5, 0] },
      { g: B(4, 6, 1), c: 0x120e18, p: [0, 3, 11.6] },
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      p.push({ g: K(1.2, 9, 5), c: 0x2a2630, p: [Math.cos(a) * 10, 4.5, Math.sin(a) * 10] });
    }
    return { parts: p, circle: 11 };
  },
  gate(o) {
    const w = o.w ?? 8;
    const p = [
      { g: B(1.6, 6, 1.6), c: o.color ?? 0x8a8478, p: [-w / 2, 3, 0] },
      { g: B(1.6, 6, 1.6), c: o.color ?? 0x8a8478, p: [w / 2, 3, 0] },
      { g: B(w + 1.6, 1.4, 1.6), c: o.color ?? 0x8a8478, p: [0, 6.4, 0] },
    ];
    return { parts: p, posts: w / 2 };
  },
  shrine(o) {
    return {
      parts: [
        { g: C(2.4, 2.6, 0.5, 10), c: 0xb0aaa0, p: [0, 0.25, 0] },
        { g: B(0.5, 3.4, 0.5), c: 0xc8c2b8, p: [-1.6, 2.1, 0] },
        { g: B(0.5, 3.4, 0.5), c: 0xc8c2b8, p: [1.6, 2.1, 0] },
        { g: B(4.0, 0.5, 0.8), c: 0xc8c2b8, p: [0, 4.0, 0] },
        { g: I(0.5, 0), c: o.color ?? 0xffe9a0, p: [0, 2.2, 0] },
      ], circle: 0.6,
    };
  },
  grave() {
    return { parts: [{ g: B(0.7, 1.0, 0.2), c: 0x8a8a88, p: [0, 0.5, 0] }, { g: B(0.8, 0.12, 1.8), c: 0x5a4a38, p: [0, 0.06, 0.9] }], box: [0.35, 0.15] };
  },
  boat() {
    const p = [
      { g: B(3, 1.2, 9), c: 0x5a4430, p: [0, 0.6, 0] },
      { g: K(1.5, 2.5, 4), c: 0x5a4430, p: [0, 0.6, 5.6], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.4] },
      { g: C(0.15, 0.2, 9, 5), c: 0x4a3828, p: [0, 5, 0], r: [0.2, 0, 0.15] },
      { g: B(3.5, 3, 0.05), c: 0x8a8070, p: [0.3, 5.5, 0.3], r: [0.2, 0.2, 0.15] },
    ];
    return { parts: p, box: [1.6, 4.6] };
  },
};

const animatedBlades = [];
export const glowLights = [];
export const fires = [];
export const platforms = [];

function buildStructures(scene) {
  const all = [];
  for (const st of STRUCTURES) {
    const b = BUILD[st.type];
    if (!b) continue;
    const res = b(st);
    const rot = st.rot ?? 0;
    const y = st.y ?? (heightAt(st.x, st.z) - (st.sink ?? 0.15));
    for (const pt of res.parts) {
      const [lx, lz] = rotPt(pt.p[0], pt.p[2], rot);
      const r = pt.r ?? [0, 0, 0];
      const q = new THREE.Quaternion().setFromAxisAngle(_up, rot).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])));
      all.push({ g: pt.g, c: pt.c, p: [st.x + lx, y + pt.p[1], st.z + lz], q, s: pt.s });
    }
    if (res.box && !st.noCollide) addBox(st.x, st.z, res.box[0], res.box[1], rot);
    if (res.circle && !st.noCollide) addCircle(st.x, st.z, res.circle);
    if (res.posts) {
      const [ax, az] = rotPt(-res.posts, 0, rot), [bx, bz] = rotPt(res.posts, 0, rot);
      addCircle(st.x + ax, st.z + az, 1); addCircle(st.x + bx, st.z + bz, 1);
    }
    if (res.ruinCols) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; addCircle(st.x + Math.cos(a) * 5, st.z + Math.sin(a) * 5, 0.8); }
    if (res.platform) platforms.push({ x: st.x, z: st.z, rot, ...res.platform, y: y + res.platform.y });
    if (res.blades) {
      const hub = new THREE.Group();
      const [lx, lz] = rotPt(0, res.blades.z, rot);
      hub.position.set(st.x + lx, y + res.blades.y, st.z + lz);
      hub.rotation.y = rot;
      const blades = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.5, 0.1), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
        bl.position.y = 3.3;
        const arm = new THREE.Group();
        arm.rotation.z = (i / 4) * Math.PI * 2;
        arm.add(bl);
        blades.add(arm);
      }
      hub.add(blades);
      scene.add(hub);
      animatedBlades.push(blades);
    }
    if (res.fire) fires.push({ x: st.x, y: y + 0.2, z: st.z });
    if (res.glow) glowLights.push({ x: st.x, y: y + res.glow, z: st.z });
  }
  // structures are merged in batches to keep vertex buffers reasonable
  const group = new THREE.Group();
  group.name = 'structures';
  const batches = new Map();
  for (const pt of all) {
    const k = Math.floor((pt.p[0] + 2000) / 160) + ',' + Math.floor((pt.p[2] + 2000) / 160);
    if (!batches.has(k)) batches.set(k, []);
    batches.get(k).push(pt);
  }
  for (const list of batches.values()) {
    const geo = mergeParts(list);
    group.add(new THREE.Mesh(geo, vcMat));
  }
  if (fenceParts.length) {
    for (let i = 0; i < fenceParts.length; i += 1200) group.add(new THREE.Mesh(mergeParts(fenceParts.slice(i, i + 1200)), vcMat));
  }
  scene.add(group);
  return group;
}

// ---------- dungeon ----------
function buildDungeon(scene) {
  const parts = [];
  const rooms = DUNGEON.rooms;
  const inside = (x, z, skip) => rooms.some((r, i) => i !== skip && x > r[0] - 0.01 && x < r[2] + 0.01 && z > r[1] - 0.01 && z < r[3] + 0.01);
  rooms.forEach((r, ri) => {
    const [x1, z1, x2, z2] = r;
    const w = x2 - x1, d = z2 - z1;
    parts.push({ g: B(w, 0.4, d), c: ri % 2 ? 0x3a3640 : 0x45404c, p: [(x1 + x2) / 2, -0.2, (z1 + z2) / 2] });
    // walls along the perimeter, skipping parts that open into another room
    const step = 2;
    const edges = [
      [x1, z1, x2, z1], [x2, z1, x2, z2], [x2, z2, x1, z2], [x1, z2, x1, z1],
    ];
    for (const [ax, az, bx, bz] of edges) {
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.round(L / step);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const nx = (bz - az) / L, nz = -(bx - ax) / L; // outward normal for CW
        if (inside(x - nx * 0.5, z - nz * 0.5, ri) || inside(x + nx * 0.6, z + nz * 0.6, ri)) continue;
        const along = Math.abs(bx - ax) > Math.abs(bz - az);
        const hgt = 7 + hash2(Math.round(x), Math.round(z), 2) * 1.5;
        parts.push({ g: B(along ? L / n + 0.05 : 1.2, hgt, along ? 1.2 : L / n + 0.05), c: 0x2e2a34, p: [x + nx * 0.6, hgt / 2, z + nz * 0.6] });
        if (i % 6 === 3) {
          parts.push({ g: B(0.25, 0.7, 0.25), c: 0x4a3a2a, p: [x - nx * 0.1, 3.2, z - nz * 0.1] });
          glowLights.push({ x: x - nx * 0.9, y: 3.7, z: z - nz * 0.9, torch: true });
        }
      }
    }
  });
  // pillars in the larger halls
  for (const r of [rooms[2], rooms[4], rooms[6]]) {
    const [x1, z1, x2, z2] = r;
    for (const fx of [0.25, 0.75]) for (const fz of [0.2, 0.8]) {
      const x = x1 + (x2 - x1) * fx, z = z1 + (z2 - z1) * fz;
      parts.push({ g: C(0.9, 1.1, 7.5, 8), c: 0x3e3846, p: [x, 3.75, z] });
      addCircle(x, z, 1.1);
    }
  }
  // throne dais
  parts.push({ g: B(12, 0.8, 6), c: 0x2a2232, p: [1205, 0.4, 132] });
  parts.push({ g: B(3, 4, 1), c: 0x4a2a5a, p: [1205, 2.4, 134] });
  const geo = mergeParts(parts);
  const m = new THREE.Mesh(geo, vcMat);
  m.name = 'dungeon';
  scene.add(m);
  return m;
}

export function platformHeight(x, z) {
  for (const p of platforms) {
    const dx = x - p.x, dz = z - p.z;
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < p.hw && Math.abs(lz) < p.hd) return p.y;
  }
  return -Infinity;
}

export function updateScenery(dt) {
  for (const b of animatedBlades) b.rotation.z += dt * 0.6;
}
