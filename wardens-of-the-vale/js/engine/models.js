// Procedural low-poly models built from primitives. Every model returns a
// root group plus named pivots that animate() moves each frame.
import * as THREE from '../lib/three.module.min.js';
import { addRimLight } from './gfx.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const k = color + '|' + (opts.emissive ?? '') + '|' + (opts.opacity ?? 1) + '|' + (opts.basic ? 1 : 0);
  if (matCache.has(k)) return matCache.get(k);
  let m;
  if (opts.basic) m = new THREE.MeshBasicMaterial({ color, transparent: opts.opacity < 1, opacity: opts.opacity ?? 1, depthWrite: !(opts.opacity < 1) });
  else m = addRimLight(new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? 0x000000, transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1 }));
  matCache.set(k, m);
  return m;
}
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
// Boxes get softly rounded edges: the outer ring of a 3x3x3-segment cube bends
// around a radius while the faces stay flat, and the normals follow the bevel.
function roundedBox(w, h, d) {
  const r = Math.min(0.08, Math.min(w, h, d) * 0.3);
  if (r < 0.012) return new THREE.BoxGeometry(w, h, d);
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const c = [0, 0, 0], inner = [0, 0, 0], out = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    c[0] = pos.getX(i); c[1] = pos.getY(i); c[2] = pos.getZ(i);
    for (let a = 0; a < 3; a++) {
      const ia = half[a] - r;
      const coord = Math.abs(c[a]) > 0.4 ? Math.sign(c[a]) * half[a] : Math.sign(c[a]) * ia;
      inner[a] = Math.max(-ia, Math.min(ia, coord));
      out[a] = coord - inner[a];
    }
    const len = Math.hypot(out[0], out[1], out[2]);
    if (len > 1e-6) {
      const nx = out[0] / len, ny = out[1] / len, nz = out[2] / len;
      pos.setXYZ(i, inner[0] + nx * r, inner[1] + ny * r, inner[2] + nz * r);
      nor.setXYZ(i, nx, ny, nz);
    } else pos.setXYZ(i, inner[0], inner[1], inner[2]);
  }
  g.computeBoundingSphere();
  return g;
}
export const box = (w, h, d) => cached(`b${w},${h},${d}`, () => roundedBox(w, h, d));
export const sphere = (r, s = 10) => cached(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(5, s - 3)));
export const cyl = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const cone = (r, h, s = 8) => cached(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
export const ico = (r, d = 0) => cached(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const torus = (r, t, arc = Math.PI * 2) => cached(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 5, 12, arc));

// ---------------- batching ----------------
// Opaque parts that share a pivot are merged into one vertex-colored mesh, so
// a character costs one draw call per moving joint instead of one per part.
// Merged geometry is cached by model spec: every wolf of a kind shares it.
const bakedMat = addRimLight(new THREE.MeshLambertMaterial({ vertexColors: true }));
const bakeCache = new Map();
export function bakeModel(m, key) {
  const refs = new Set();
  for (const v of Object.values(m)) {
    if (v?.isObject3D) refs.add(v);
    else if (Array.isArray(v)) for (const x of v) if (x?.isObject3D) refs.add(x);
  }
  const groups = [];
  m.root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  groups.forEach((g, gi) => {
    const list = g.children.filter((c) => c.isMesh && !refs.has(c) && !c.children.length && c.material?.isMeshLambertMaterial && !c.material.transparent && !c.material.map && c.material.emissive.getHex() === 0);
    if (list.length < 2) return;
    const ck = key !== undefined ? key + '#' + gi : null;
    let geo = ck ? bakeCache.get(ck) : null;
    if (!geo) { geo = mergeMeshes(list); if (ck) bakeCache.set(ck, geo); }
    for (const c of list) g.remove(c);
    g.add(new THREE.Mesh(geo, bakedMat));
  });
  return m;
}
function mergeMeshes(list) {
  let nv = 0, ni = 0;
  for (const c of list) {
    c.updateMatrix();
    const g = c.geometry;
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const c of list) {
    const g = c.geometry, pa = g.attributes.position, na = g.attributes.normal, n = pa.count;
    nm.getNormalMatrix(c.matrix);
    const { r, g: gg, b } = c.material.color;
    for (let i = 0; i < n; i++) {
      const k = (vo + i) * 3;
      v.fromBufferAttribute(pa, i).applyMatrix4(c.matrix);
      pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
      col[k] = r; col[k + 1] = gg; col[k + 2] = b;
    }
    if (g.index) { const ia = g.index.array; for (let k = 0; k < ia.length; k++) index[io + k] = ia[k] + vo; io += ia.length; } else { for (let k = 0; k < n; k++) index[io + k] = vo + k; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

// ---------------- faces ----------------
// Simple drawn faces in the spirit of classic blocky avatars: a few styles of
// eyes, brows and mouths painted onto a transparent texture.
const faceTex = [];
function faceTexture(i) {
  if (faceTex[i]) return faceTex[i];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1c130d'; x.strokeStyle = '#1c130d'; x.lineCap = 'round';
  const eye = (cx, cy, w, h) => {
    x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.9)';
    x.beginPath(); x.arc(cx - w * 0.3, cy - h * 0.4, Math.max(2, w * 0.35), 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1c130d';
  };
  const style = i % 6;
  const ey = 54;
  if (style === 3) { x.lineWidth = 6; for (const cx of [40, 88]) { x.beginPath(); x.arc(cx, ey + 4, 10, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); } }
  else eye(40, ey, style === 5 ? 6 : 8, style === 5 ? 9 : 12), eye(88, ey, style === 5 ? 6 : 8, style === 5 ? 9 : 12);
  x.lineWidth = 5;
  if (style === 1 || style === 4) { // brows
    x.beginPath(); x.moveTo(28, ey - 22 + (style === 4 ? 4 : 0)); x.lineTo(50, ey - 18 - (style === 4 ? 4 : 0)); x.stroke();
    x.beginPath(); x.moveTo(100, ey - 22 + (style === 4 ? 4 : 0)); x.lineTo(78, ey - 18 - (style === 4 ? 4 : 0)); x.stroke();
  }
  x.lineWidth = 6;
  x.beginPath();
  if (style === 0 || style === 3) x.arc(64, 78, 20, Math.PI * 0.18, Math.PI * 0.82); // smile
  else if (style === 1) { x.moveTo(50, 92); x.lineTo(78, 90); } // determined
  else if (style === 2) { x.arc(64, 80, 16, Math.PI * 0.1, Math.PI * 0.9); x.closePath(); x.fill(); } // grin
  else if (style === 4) { x.moveTo(48, 88); x.quadraticCurveTo(70, 94, 82, 82); } // confident smirk
  else x.arc(64, 82, 12, Math.PI * 0.2, Math.PI * 0.8); // small smile
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceTex[i] = t;
  return t;
}
const faceMats = [];
function faceMaterial(i) {
  faceMats[i] ??= new THREE.MeshLambertMaterial({ map: faceTexture(i), transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return faceMats[i];
}
const faceGeo = new THREE.PlaneGeometry(1, 1);

function mesh(geo, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'object' ? color : mat(color, opts));
  m.position.set(x, y, z);
  return m;
}
function pivot(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

// ---------------- weapons ----------------
export function weaponMesh(type, color = 0xb8bcc4, glow) {
  const g = new THREE.Group();
  const wood = 0x6b4a2b, grip = 0x3a2a1c;
  switch (type) {
    case 'sword':
      g.add(mesh(box(0.06, 0.2, 0.06), grip, 0, 0.0, 0));
      g.add(mesh(box(0.28, 0.05, 0.08), 0x8a7a40, 0, 0.12, 0));
      g.add(mesh(box(0.08, 0.85, 0.03), color, 0, 0.56, 0));
      break;
    case 'sword2h':
      g.add(mesh(box(0.07, 0.4, 0.07), grip, 0, 0.0, 0));
      g.add(mesh(box(0.4, 0.06, 0.09), 0x8a7a40, 0, 0.2, 0));
      g.add(mesh(box(0.11, 1.25, 0.035), color, 0, 0.85, 0));
      break;
    case 'axe':
      g.add(mesh(box(0.06, 0.95, 0.06), wood, 0, 0.35, 0));
      g.add(mesh(box(0.05, 0.3, 0.3), color, 0, 0.72, 0.14));
      break;
    case 'axe2h':
      g.add(mesh(box(0.07, 1.5, 0.07), wood, 0, 0.55, 0));
      g.add(mesh(box(0.05, 0.45, 0.42), color, 0, 1.15, 0.2));
      g.add(mesh(box(0.05, 0.35, 0.3), color, 0, 1.15, -0.15));
      break;
    case 'mace':
      g.add(mesh(box(0.06, 0.75, 0.06), wood, 0, 0.3, 0));
      g.add(mesh(ico(0.14, 0), color, 0, 0.72, 0));
      break;
    case 'mace2h':
      g.add(mesh(box(0.07, 1.4, 0.07), wood, 0, 0.5, 0));
      g.add(mesh(box(0.3, 0.3, 0.3), color, 0, 1.15, 0));
      break;
    case 'dagger':
      g.add(mesh(box(0.05, 0.14, 0.05), grip, 0, 0, 0));
      g.add(mesh(box(0.16, 0.04, 0.06), 0x777777, 0, 0.08, 0));
      g.add(mesh(box(0.06, 0.4, 0.02), color, 0, 0.3, 0));
      break;
    case 'staff':
      g.add(mesh(cyl(0.035, 0.045, 1.8, 6), wood, 0, 0.45, 0));
      g.add(mesh(ico(0.11, 0), glow ?? 0x88ccff, 0, 1.4, 0, { emissive: glow ?? 0x2266aa }));
      break;
    case 'polearm':
      g.add(mesh(cyl(0.035, 0.035, 2.0, 6), wood, 0, 0.5, 0));
      g.add(mesh(cone(0.07, 0.4, 4), color, 0, 1.68, 0));
      g.add(mesh(box(0.04, 0.26, 0.24), color, 0, 1.38, 0.1));
      break;
    case 'fist':
      g.add(mesh(box(0.14, 0.12, 0.14), color, 0, 0.05, 0));
      g.add(mesh(cone(0.03, 0.18, 4), 0xdddddd, 0.04, 0.18, 0));
      g.add(mesh(cone(0.03, 0.18, 4), 0xdddddd, -0.04, 0.18, 0));
      break;
    case 'wand':
      g.add(mesh(cyl(0.02, 0.03, 0.45, 5), 0x8a5a9a, 0, 0.18, 0));
      g.add(mesh(ico(0.05, 0), glow ?? 0xff88ff, 0, 0.42, 0, { emissive: glow ?? 0x882288 }));
      break;
    case 'bow': {
      const arc = new THREE.Mesh(torus(0.6, 0.03, Math.PI * 0.9), mat(wood));
      arc.rotation.z = Math.PI / 2 + Math.PI * 0.05;
      arc.rotation.y = Math.PI / 2;
      arc.position.y = 0.0;
      g.add(arc);
      const str = mesh(box(0.01, 1.15, 0.01), 0xeeeeee, 0, 0, -0.08);
      g.add(str);
      break;
    }
    case 'gun':
      g.add(mesh(box(0.08, 0.8, 0.08), 0x555560, 0, 0.35, 0));
      g.add(mesh(box(0.1, 0.35, 0.16), wood, 0, -0.05, 0.04));
      break;
    case 'shield': {
      const s = mesh(cyl(0.38, 0.38, 0.06, 10), color);
      s.rotation.x = Math.PI / 2;
      g.add(s);
      g.add(mesh(sphere(0.08, 6), 0xc8b060, 0, 0, -0.05));
      break;
    }
    case 'orb':
      g.add(mesh(ico(0.12, 1), glow ?? 0x9988ff, 0, 0.05, 0, { emissive: glow ?? 0x332288 }));
      break;
    case 'book':
      g.add(mesh(box(0.22, 0.28, 0.07), color ?? 0x6a2a2a, 0, 0.05, 0));
      break;
    case 'torch':
      g.add(mesh(cyl(0.03, 0.04, 0.6, 5), wood, 0, 0.2, 0));
      g.add(mesh(cone(0.08, 0.2, 5), 0xffaa33, 0, 0.55, 0, { basic: true }));
      break;
    case 'claw':
      for (let i = -1; i <= 1; i++) g.add(mesh(cone(0.025, 0.25, 4), 0xeeeecc, i * 0.05, 0.12, 0));
      break;
  }
  return g;
}

// ---------------- humanoid ----------------
export function humanoid(o = {}) {
  const s = o.scale ?? 1;
  const W = o.bulk ?? 1; // width multiplier
  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  const skin = o.skin ?? 0xe0b48c;
  const shirt = o.shirt ?? 0x7a6a50;
  const pants = o.pants ?? 0x4a4038;
  const boots = o.boots ?? 0x3a2a20;
  const legLen = (o.legLen ?? 0.9);
  const hipY = legLen + 0.08;

  const hips = mesh(box(0.48 * W, 0.24, 0.3 * W), pants, 0, hipY, 0);
  body.add(hips);
  const torsoGroup = pivot(0, hipY + 0.1, 0);
  body.add(torsoGroup);
  const torsoH = 0.62;
  const torso = mesh(box(0.56 * W, torsoH, 0.32 * W), shirt, 0, torsoH / 2, 0);
  torsoGroup.add(torso);
  if (o.hunch) torsoGroup.rotation.x = o.hunch;
  if (o.belt !== false) torsoGroup.add(mesh(box(0.58 * W, 0.08, 0.34 * W), o.belt ?? 0x3a2a1a, 0, 0.04, 0));
  if (o.robe) {
    // flowing skirt for robes
    const skirt = mesh(cyl(0.25 * W, 0.38 * W, legLen + 0.1, 8), o.robe, 0, hipY - legLen / 2 + 0.02, 0);
    body.add(skirt);
  }
  if (o.chestTrim) torsoGroup.add(mesh(box(0.2 * W, torsoH * 0.95, 0.34 * W), o.chestTrim, 0, torsoH / 2, 0));

  // head
  const neckY = torsoH + 0.02;
  const headPivot = pivot(0, neckY, 0);
  torsoGroup.add(headPivot);
  const hs = (o.headScale ?? 1) * 0.34;
  const head = mesh(box(hs, hs * 1.05, hs), o.headColor ?? skin, 0, hs * 0.55, 0);
  headPivot.add(head);
  if (o.face !== false && !o.helm?.full && !o.eyes && !o.snout) {
    // a drawn face, picked from the look so each person keeps the same one
    const k = Math.abs(((o.skin ?? 0) * 7 + (o.shirt ?? 0) * 13 + (o.hair ?? 0) * 3 + (o.hairStyle ?? 0)) | 0) % 6;
    const f = new THREE.Mesh(faceGeo, faceMaterial(k));
    f.scale.set(hs * 0.92, hs * 0.92, 1);
    f.position.set(0, hs * 0.55, hs / 2 + 0.004);
    headPivot.add(f);
  } else if (o.face !== false && !o.helm?.full) {
    headPivot.add(mesh(box(0.05, 0.04, 0.02), o.eyes ?? 0x222222, -0.07 * (hs / 0.34), hs * 0.62, hs / 2 + 0.005, o.eyes ? { basic: true } : undefined));
    headPivot.add(mesh(box(0.05, 0.04, 0.02), o.eyes ?? 0x222222, 0.07 * (hs / 0.34), hs * 0.62, hs / 2 + 0.005, o.eyes ? { basic: true } : undefined));
  }
  if (o.hair !== undefined && o.hair !== null && !o.helm) {
    const hairStyle = o.hairStyle ?? 0;
    headPivot.add(mesh(box(hs + 0.04, hs * 0.35, hs + 0.04), o.hair, 0, hs * 1.0, -0.01));
    if (hairStyle === 1) headPivot.add(mesh(box(hs + 0.04, hs * 0.7, 0.08), o.hair, 0, hs * 0.6, -hs / 2 - 0.02)); // long
    if (hairStyle === 2) headPivot.add(mesh(box(0.1, 0.3, 0.1), o.hair, 0, hs * 1.3, -0.05)); // mohawk/topknot
    if (hairStyle === 3) headPivot.add(mesh(box(hs + 0.06, hs * 0.9, 0.12), o.hair, 0, hs * 0.5, -hs / 2 - 0.02)); // braid mane
  }
  if (o.beard) headPivot.add(mesh(box(hs * 0.8, hs * 0.45, 0.1), o.beard, 0, hs * 0.2, hs / 2 + 0.03));
  if (o.ears === 'long') {
    const e1 = mesh(box(0.04, 0.06, 0.28), skin, -hs / 2 - 0.02, hs * 0.65, -0.05); e1.rotation.y = -0.6; e1.rotation.x = 0.4; headPivot.add(e1);
    const e2 = mesh(box(0.04, 0.06, 0.28), skin, hs / 2 + 0.02, hs * 0.65, -0.05); e2.rotation.y = 0.6; e2.rotation.x = 0.4; headPivot.add(e2);
  }
  if (o.tusks) {
    headPivot.add(mesh(cone(0.025, 0.12, 4), 0xf0ead0, -0.08, hs * 0.25, hs / 2 + 0.03));
    headPivot.add(mesh(cone(0.025, 0.12, 4), 0xf0ead0, 0.08, hs * 0.25, hs / 2 + 0.03));
  }
  if (o.horns) {
    const h1 = mesh(cone(0.05, 0.3, 5), o.horns, -hs / 2, hs * 1.1, 0); h1.rotation.z = 0.6; headPivot.add(h1);
    const h2 = mesh(cone(0.05, 0.3, 5), o.horns, hs / 2, hs * 1.1, 0); h2.rotation.z = -0.6; headPivot.add(h2);
  }
  if (o.fins) {
    const f = mesh(box(0.04, 0.22, hs * 0.9), o.fins, 0, hs * 1.1, -0.02); headPivot.add(f);
    const f1 = mesh(box(0.2, 0.14, 0.04), o.fins, -hs / 2 - 0.08, hs * 0.6, 0); f1.rotation.z = 0.5; headPivot.add(f1);
    const f2 = mesh(box(0.2, 0.14, 0.04), o.fins, hs / 2 + 0.08, hs * 0.6, 0); f2.rotation.z = -0.5; headPivot.add(f2);
  }
  if (o.snout) headPivot.add(mesh(box(hs * 0.6, hs * 0.35, 0.18), o.snout, 0, hs * 0.35, hs / 2 + 0.08));
  if (o.helm) {
    const hc = o.helm.color ?? 0x888888;
    if (o.helm.type === 'hood') {
      headPivot.add(mesh(box(hs + 0.08, hs * 1.15, hs + 0.08), hc, 0, hs * 0.62, -0.03));
      headPivot.add(mesh(box(hs * 0.7, hs * 0.5, 0.02), 0x111111, 0, hs * 0.55, hs / 2 + 0.03, { basic: true }));
    } else if (o.helm.type === 'hat') {
      headPivot.add(mesh(cyl(0.34, 0.34, 0.04, 10), hc, 0, hs * 1.08, 0));
      headPivot.add(mesh(cone(0.18, 0.42, 8), hc, 0, hs * 1.3, 0));
    } else if (o.helm.type === 'strawhat') {
      headPivot.add(mesh(cyl(0.38, 0.38, 0.04, 10), hc, 0, hs * 1.05, 0));
      headPivot.add(mesh(cyl(0.16, 0.2, 0.16, 8), hc, 0, hs * 1.15, 0));
    } else if (o.helm.type === 'crown') {
      headPivot.add(mesh(cyl(0.2, 0.2, 0.12, 6), hc, 0, hs * 1.15, 0));
    } else {
      headPivot.add(mesh(box(hs + 0.07, hs * 0.75, hs + 0.07), hc, 0, hs * 0.85, 0));
      if (o.helm.full) headPivot.add(mesh(box(hs * 0.8, 0.04, 0.02), 0x111111, 0, hs * 0.62, hs / 2 + 0.04, { basic: true }));
      if (o.helm.crest) headPivot.add(mesh(box(0.05, 0.16, hs * 0.9), o.helm.crest, 0, hs * 1.3, 0));
    }
  }

  // arms
  const armW = 0.15 * (o.armBulk ?? W);
  const shoulderY = torsoH - 0.06;
  const armL = pivot(-0.36 * W, shoulderY, 0);
  const armR = pivot(0.36 * W, shoulderY, 0);
  torsoGroup.add(armL, armR);
  const armLen = o.armLen ?? 0.62;
  const sleeve = o.sleeve ?? shirt;
  armL.add(mesh(box(armW, armLen * 0.55, armW), sleeve, 0, -armLen * 0.27, 0));
  armR.add(mesh(box(armW, armLen * 0.55, armW), sleeve, 0, -armLen * 0.27, 0));
  armL.add(mesh(box(armW * 0.9, armLen * 0.5, armW * 0.9), o.gloves ?? (o.bareArms ? skin : sleeve), 0, -armLen * 0.78, 0));
  armR.add(mesh(box(armW * 0.9, armLen * 0.5, armW * 0.9), o.gloves ?? (o.bareArms ? skin : sleeve), 0, -armLen * 0.78, 0));
  const handL = pivot(0, -armLen, 0.02);
  const handR = pivot(0, -armLen, 0.02);
  armL.add(handL); armR.add(handR);
  const handCol = o.gloves ?? skin;
  armL.add(mesh(box(armW * 0.82, 0.11, armW * 0.95), handCol, 0, -armLen - 0.02, 0.01));
  armR.add(mesh(box(armW * 0.82, 0.11, armW * 0.95), handCol, 0, -armLen - 0.02, 0.01));
  if (o.shoulders) {
    torsoGroup.add(mesh(box(0.26, 0.14, 0.3), o.shoulders, -0.38 * W, shoulderY + 0.06, 0));
    torsoGroup.add(mesh(box(0.26, 0.14, 0.3), o.shoulders, 0.38 * W, shoulderY + 0.06, 0));
  }
  if (o.cape) {
    const capePivot = pivot(0, torsoH - 0.02, -0.18 * W);
    const c = mesh(box(0.5 * W, 1.0, 0.03), o.cape, 0, -0.5, 0);
    capePivot.add(c);
    torsoGroup.add(capePivot);
    root.userData.cape = capePivot;
  }
  // legs
  const legL = pivot(-0.13 * W, hipY, 0);
  const legR = pivot(0.13 * W, hipY, 0);
  body.add(legL, legR);
  const legW = 0.19 * W;
  legL.add(mesh(box(legW, legLen * 0.6, legW), pants, 0, -legLen * 0.3, 0));
  legR.add(mesh(box(legW, legLen * 0.6, legW), pants, 0, -legLen * 0.3, 0));
  legL.add(mesh(box(legW * 1.05, legLen * 0.42, legW * 1.15), boots, 0, -legLen * 0.79, 0.02));
  legR.add(mesh(box(legW * 1.05, legLen * 0.42, legW * 1.15), boots, 0, -legLen * 0.79, 0.02));
  legL.add(mesh(box(legW * 1.02, 0.1, legW * 1.75), boots, 0, -legLen + 0.05, 0.07));
  legR.add(mesh(box(legW * 1.02, 0.1, legW * 1.75), boots, 0, -legLen + 0.05, 0.07));
  if (o.tail) {
    const t = mesh(box(0.08, 0.08, 0.6), o.tail, 0, hipY, -0.4);
    t.rotation.x = 0.5;
    body.add(t);
  }
  if (o.ghost || o.noLegs) { legL.visible = legR.visible = false; }

  // weapons
  if (o.weapon) {
    const w = weaponMesh(o.weapon.type, o.weapon.color, o.weapon.glow);
    w.rotation.x = Math.PI / 2;
    handR.add(w);
    root.userData.weapon = w;
  }
  if (o.offhand) {
    const w = weaponMesh(o.offhand.type, o.offhand.color, o.offhand.glow);
    if (o.offhand.type === 'shield') { w.position.set(-0.08, 0.05, 0.05); w.rotation.y = -Math.PI / 2; }
    else if (o.offhand.type === 'bow') { w.rotation.x = 0; w.position.set(0, 0, 0.1); }
    else w.rotation.x = Math.PI / 2;
    handL.add(w);
  }
  if (o.glow) {
    const gl = mesh(sphere(0.6, 8), o.glow, 0, hipY + 0.4, 0, { basic: true, opacity: 0.25 });
    body.add(gl);
  }

  root.scale.setScalar(s);
  if (o.ghost) {
    root.traverse((n) => {
      if (n.isMesh) n.material = mat(n.material.color.getHex(), { opacity: 0.55, emissive: 0x223355 });
    });
  }
  return {
    kind: 'humanoid', root, body, torso: torsoGroup, head: headPivot, armL, armR, legL, legR, handR, handL,
    height: (hipY + torsoH + hs * 1.3 + 0.1) * s, scale: s, float: o.floating ? 0.4 : 0, opts: o,
  };
}

// ---------------- four-legged beasts ----------------
export function quadruped(o = {}) {
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  const len = o.length ?? 1.3, h = o.legLen ?? 0.55, bw = o.width ?? 0.5, bh = o.bodyH ?? 0.5;
  const c = o.color ?? 0x7a6a5a;
  const torso = mesh(box(bw, bh, len), c, 0, h + bh / 2, 0);
  body.add(torso);
  if (o.belly) body.add(mesh(box(bw * 0.8, 0.06, len * 0.8), o.belly, 0, h + 0.03, 0));
  if (o.mane) body.add(mesh(box(bw * 1.1, bh * 0.6, len * 0.35), o.mane, 0, h + bh * 0.85, len * 0.3));
  if (o.hump) body.add(mesh(box(bw * 0.9, bh * 0.5, len * 0.4), c, 0, h + bh * 1.1, len * 0.15));
  if (o.stripes) for (let i = -1; i <= 1; i++) body.add(mesh(box(bw * 1.02, bh * 0.3, 0.08), o.stripes, 0, h + bh * 0.75, i * len * 0.22));
  const headPivot = pivot(0, h + bh * 0.8, len / 2);
  body.add(headPivot);
  const hsz = o.headSize ?? 0.38;
  headPivot.add(mesh(box(hsz, hsz, hsz * 1.1), o.headColor ?? c, 0, 0, hsz * 0.4));
  const snoutL = o.snout ?? 0.25;
  headPivot.add(mesh(box(hsz * 0.6, hsz * 0.5, snoutL), o.snoutColor ?? c, 0, -hsz * 0.15, hsz * 0.9 + snoutL / 2 - 0.05));
  headPivot.add(mesh(box(0.05, 0.05, 0.02), o.eyes ?? 0x111111, -hsz * 0.3, hsz * 0.15, hsz * 0.97, o.eyes ? { basic: true } : undefined));
  headPivot.add(mesh(box(0.05, 0.05, 0.02), o.eyes ?? 0x111111, hsz * 0.3, hsz * 0.15, hsz * 0.97, o.eyes ? { basic: true } : undefined));
  if (o.ears !== false) {
    headPivot.add(mesh(cone(0.07, 0.18, 4), o.earColor ?? c, -hsz * 0.32, hsz * 0.6, hsz * 0.25));
    headPivot.add(mesh(cone(0.07, 0.18, 4), o.earColor ?? c, hsz * 0.32, hsz * 0.6, hsz * 0.25));
  }
  if (o.tusks) {
    const t1 = mesh(cone(0.035, 0.2, 4), 0xf4ecd0, -hsz * 0.25, -hsz * 0.2, hsz + snoutL * 0.8); t1.rotation.x = -0.6; headPivot.add(t1);
    const t2 = mesh(cone(0.035, 0.2, 4), 0xf4ecd0, hsz * 0.25, -hsz * 0.2, hsz + snoutL * 0.8); t2.rotation.x = -0.6; headPivot.add(t2);
  }
  if (o.horns) {
    const h1 = mesh(cone(0.06, 0.4, 5), o.horns, -hsz * 0.45, hsz * 0.55, hsz * 0.3); h1.rotation.z = 0.8; h1.rotation.x = -0.3; headPivot.add(h1);
    const h2 = mesh(cone(0.06, 0.4, 5), o.horns, hsz * 0.45, hsz * 0.55, hsz * 0.3); h2.rotation.z = -0.8; h2.rotation.x = -0.3; headPivot.add(h2);
  }
  const legs = [];
  const lw = o.legW ?? 0.14;
  const lc = o.legColor ?? c;
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const p = pivot(x * (bw / 2 - lw / 2), h, z * (len / 2 - lw));
    p.add(mesh(box(lw, h, lw), lc, 0, -h / 2, 0));
    if (o.paws) p.add(mesh(box(lw * 1.2, 0.06, lw * 1.4), o.paws, 0, -h + 0.03, 0.02));
    body.add(p);
    legs.push(p);
  }
  let tail = null;
  if (o.tail !== false) {
    tail = pivot(0, h + bh * 0.8, -len / 2);
    const tl = o.tailLen ?? 0.5;
    const tm = mesh(box(o.tailW ?? 0.08, o.tailW ?? 0.08, tl), o.tailColor ?? c, 0, 0, -tl / 2);
    tail.add(tm);
    tail.rotation.x = o.tailUp ?? 0.6;
    body.add(tail);
  }
  if (o.glow) body.add(mesh(sphere(0.7, 8), o.glow, 0, h + bh / 2, 0, { basic: true, opacity: 0.25 }));
  root.scale.setScalar(s);
  if (o.ghost) root.traverse((n) => { if (n.isMesh) n.material = mat(n.material.color.getHex(), { opacity: 0.6, emissive: 0x224466 }); });
  return { kind: 'quad', root, body, head: headPivot, legs, tail, height: (h + bh + hsz) * s, scale: s, opts: o };
}

// ---------------- spiders and insects ----------------
export function spider(o = {}) {
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  const c = o.color ?? 0x2a2a2a;
  const ab = mesh(sphere(0.55, 8), o.abdomen ?? c, 0, 0.75, -0.55);
  ab.scale.set(1, 0.85, 1.2);
  body.add(ab);
  if (o.marking) body.add(mesh(box(0.25, 0.05, 0.4), o.marking, 0, 1.22, -0.55, { basic: true }));
  body.add(mesh(sphere(0.32, 7), c, 0, 0.6, 0.15));
  const head = pivot(0, 0.6, 0.45);
  head.add(mesh(sphere(0.2, 6), c, 0, 0, 0));
  for (let i = -1; i <= 1; i += 2) head.add(mesh(box(0.06, 0.06, 0.02), o.eyes ?? 0xff2222, i * 0.08, 0.06, 0.19, { basic: true }));
  head.add(mesh(cone(0.04, 0.18, 4), 0x111111, -0.07, -0.12, 0.18));
  head.add(mesh(cone(0.04, 0.18, 4), 0x111111, 0.07, -0.12, 0.18));
  body.add(head);
  const legs = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const p = pivot(side * 0.25, 0.65, 0.3 - i * 0.18);
      p.rotation.y = side * (0.9 - i * 0.45) + (side < 0 ? Math.PI : 0);
      const upper = mesh(box(0.06, 0.06, 0.6), o.legColor ?? c, 0, 0.18, 0.28);
      upper.rotation.x = -0.6;
      p.add(upper);
      const lower = mesh(box(0.05, 0.75, 0.05), o.legColor ?? c, 0, -0.1, 0.55);
      lower.rotation.x = 0.35;
      p.add(lower);
      p.rotation.order = 'YXZ';
      body.add(p);
      legs.push(p);
    }
  }
  root.scale.setScalar(s);
  return { kind: 'spider', root, body, head, legs, height: 1.4 * s, scale: s, opts: o };
}

export function insect(o = {}) {
  // weevils and beetles: domed shell, long snout, six legs
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  const c = o.color ?? 0x4a3a2a;
  const shell = mesh(sphere(0.5, 8), c, 0, 0.5, -0.1);
  shell.scale.set(0.85, 0.7, 1.25);
  body.add(shell);
  if (o.shine) body.add(mesh(box(0.05, 0.02, 0.9), o.shine, 0, 0.86, -0.1));
  const head = pivot(0, 0.45, 0.5);
  head.add(mesh(sphere(0.2, 6), o.headColor ?? c, 0, 0, 0.05));
  const sn = mesh(cyl(0.04, 0.07, o.snout ?? 0.45, 5), o.headColor ?? c, 0, -0.1, 0.32);
  sn.rotation.x = Math.PI / 2 + 0.5;
  head.add(sn);
  head.add(mesh(box(0.04, 0.04, 0.02), 0xffee66, -0.1, 0.06, 0.2, { basic: true }));
  head.add(mesh(box(0.04, 0.04, 0.02), 0xffee66, 0.1, 0.06, 0.2, { basic: true }));
  body.add(head);
  const legs = [];
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 3; i++) {
    const p = pivot(side * 0.32, 0.38, 0.25 - i * 0.3);
    const l = mesh(box(0.05, 0.45, 0.05), o.legColor ?? 0x2a2018, side * 0.12, -0.18, 0);
    l.rotation.z = side * 0.6;
    p.add(l);
    body.add(p);
    legs.push(p);
  }
  root.scale.setScalar(s);
  return { kind: 'spider', root, body, head, legs, height: 1.0 * s, scale: s, opts: o };
}

export function crab(o = {}) {
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  const c = o.color ?? 0xc0603a;
  const shell = mesh(sphere(0.45, 8), c, 0, 0.45, 0);
  shell.scale.set(1.3, 0.55, 1);
  body.add(shell);
  const head = pivot(0, 0.5, 0.35);
  head.add(mesh(cyl(0.02, 0.02, 0.2, 4), c, -0.12, 0.1, 0));
  head.add(mesh(cyl(0.02, 0.02, 0.2, 4), c, 0.12, 0.1, 0));
  head.add(mesh(sphere(0.05, 5), 0x111111, -0.12, 0.2, 0));
  head.add(mesh(sphere(0.05, 5), 0x111111, 0.12, 0.2, 0));
  body.add(head);
  const legs = [];
  for (let side = -1; side <= 1; side += 2) {
    const claw = pivot(side * 0.45, 0.45, 0.35);
    claw.add(mesh(box(0.1, 0.1, 0.35), c, 0, 0, 0.15));
    claw.add(mesh(box(0.22, 0.14, 0.24), c, 0, 0.02, 0.38));
    body.add(claw);
    legs.push(claw);
    for (let i = 0; i < 3; i++) {
      const p = pivot(side * 0.5, 0.35, 0.05 - i * 0.2);
      const l = mesh(box(0.05, 0.4, 0.05), c, side * 0.15, -0.12, 0);
      l.rotation.z = side * 0.9;
      p.add(l);
      body.add(p);
      legs.push(p);
    }
  }
  root.scale.setScalar(s);
  return { kind: 'spider', root, body, head, legs, height: 0.8 * s, scale: s, opts: o };
}

export function croc(o = {}) {
  const m = quadruped({
    length: 2.2, legLen: 0.25, width: 0.75, bodyH: 0.35, color: o.color ?? 0x4a5a32, belly: 0x9a9a6a,
    headSize: 0.36, snout: 0.75, ears: false, tailLen: 1.6, tailW: 0.24, tailUp: -0.05, legW: 0.18,
    eyes: 0xffcc22, scale: o.scale ?? 1,
  });
  // splay legs out for the low crocodilian stance
  for (const l of m.legs) l.rotation.z = Math.sign(l.position.x) * 0.5;
  return m;
}

export function bird(o = {}) {
  // also used for bats and the flight master's skyhawk
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const body = pivot(0, o.hover ?? 1.6, 0);
  root.add(body);
  const c = o.color ?? 0x6a5a4a;
  const torso = mesh(sphere(0.35, 7), c, 0, 0, 0);
  torso.scale.set(0.9, 0.8, 1.4);
  body.add(torso);
  const head = pivot(0, 0.2, 0.45);
  head.add(mesh(sphere(0.2, 6), o.headColor ?? c, 0, 0, 0));
  head.add(mesh(cone(0.07, 0.25, 4), o.beak ?? 0xd0a030, 0, -0.02, 0.24));
  head.children[1].rotation.x = Math.PI / 2;
  head.add(mesh(box(0.04, 0.04, 0.02), o.eyes ?? 0x111111, -0.09, 0.06, 0.16, o.eyes ? { basic: true } : undefined));
  head.add(mesh(box(0.04, 0.04, 0.02), o.eyes ?? 0x111111, 0.09, 0.06, 0.16, o.eyes ? { basic: true } : undefined));
  body.add(head);
  const wingL = pivot(-0.25, 0.1, 0);
  const wingR = pivot(0.25, 0.1, 0);
  const span = o.span ?? 1.0;
  wingL.add(mesh(box(span, 0.04, 0.5), o.wing ?? c, -span / 2, 0, 0));
  wingR.add(mesh(box(span, 0.04, 0.5), o.wing ?? c, span / 2, 0, 0));
  body.add(wingL, wingR);
  body.add(mesh(box(0.3, 0.04, 0.45), o.wing ?? c, 0, 0, -0.6));
  root.scale.setScalar(s);
  return { kind: 'bird', root, body, head, wingL, wingR, legs: [], height: ((o.hover ?? 1.6) + 0.5) * s, scale: s, opts: o };
}

export function elemental(o = {}) {
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const body = pivot(0, 1.2, 0);
  root.add(body);
  const core = mesh(ico(0.45, 0), o.color ?? 0xff6622, 0, 0, 0, { emissive: o.emissive ?? 0x882200 });
  body.add(core);
  const shards = [];
  for (let i = 0; i < 6; i++) {
    const sh = mesh(ico(0.18 + (i % 3) * 0.05, 0), o.shard ?? o.color ?? 0xffaa44, 0, 0, 0, { emissive: o.emissive ?? 0x662200 });
    body.add(sh);
    shards.push(sh);
  }
  if (o.glowColor) body.add(mesh(sphere(0.8, 8), o.glowColor, 0, 0, 0, { basic: true, opacity: 0.22 }));
  const head = pivot(0, 0.6, 0);
  head.add(mesh(ico(0.25, 0), o.shard ?? o.color ?? 0xffaa44, 0, 0, 0, { emissive: o.emissive ?? 0x662200 }));
  body.add(head);
  root.scale.setScalar(s);
  return { kind: 'elemental', root, body, head, shards, legs: [], height: 2.2 * s, scale: s, opts: o };
}

export function totemModel(color = 0x8a6a3a, top = 0xffaa33) {
  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  body.add(mesh(cyl(0.16, 0.2, 1.1, 6), color, 0, 0.55, 0));
  body.add(mesh(box(0.42, 0.12, 0.12), color, 0, 0.9, 0));
  body.add(mesh(box(0.3, 0.3, 0.3), top, 0, 1.25, 0, { emissive: 0x332200 }));
  body.add(mesh(box(0.06, 0.06, 0.02), 0xffffff, -0.07, 1.3, 0.16, { basic: true }));
  body.add(mesh(box(0.06, 0.06, 0.02), 0xffffff, 0.07, 1.3, 0.16, { basic: true }));
  return { kind: 'static', root, body, legs: [], height: 1.5, scale: 1, opts: {} };
}

// ---------------- animation ----------------
export function animate(m, dt, st) {
  const t = st.time;
  const k = m.kind;
  if (st.dead) {
    m.deadT = Math.min(1, (m.deadT ?? 0) + dt * 2.5);
    const d = m.deadT;
    if (k === 'humanoid') {
      m.body.rotation.x = -d * Math.PI / 2;
      m.body.position.y = d * 0.25;
      m.armL.rotation.x = m.armR.rotation.x = -d * 0.4;
    } else if (k === 'elemental') {
      m.body.position.y = 1.2 - d * 1.0;
      m.body.scale.setScalar(1 - d * 0.5);
    } else {
      m.body.rotation.z = d * Math.PI / 2;
      m.body.position.y = d * 0.15;
    }
    return;
  }
  if (m.deadT) { m.deadT = 0; m.body.rotation.set(0, 0, 0); m.body.position.y = k === 'elemental' ? 1.2 : (k === 'bird' ? (m.opts.hover ?? 1.6) : 0); m.body.scale.setScalar(1); }
  const speed = st.speed ?? 0;
  m.phase = (m.phase ?? 0) + dt * (2.2 + speed * 1.25) * (speed > 0.1 ? 1 : 0);
  const sw = Math.sin(m.phase);
  const amp = Math.min(1, speed / 6);

  if (k === 'humanoid') {
    const swing = st.swing ?? 0; // 0..1 progress of a melee swing
    const cast = st.cast ?? 0;
    if (st.sit) {
      m.legL.rotation.x = m.legR.rotation.x = -1.45;
      m.body.position.y = -0.48 * (m.opts.legLen ?? 0.9) / 0.9;
      m.armL.rotation.x = m.armR.rotation.x = -0.3;
      return;
    }
    m.body.position.y = (m.float ?? 0) + Math.abs(sw) * 0.06 * amp + (m.float ? Math.sin(t * 2) * 0.1 : 0);
    if (st.airborne) {
      m.legL.rotation.x = -0.6; m.legR.rotation.x = 0.3;
    } else {
      m.legL.rotation.x = sw * 0.75 * amp;
      m.legR.rotation.x = -sw * 0.75 * amp;
    }
    let ar = -sw * 0.6 * amp, al = sw * 0.6 * amp;
    // idle breathing
    ar += Math.sin(t * 1.7) * 0.04; al -= Math.sin(t * 1.7) * 0.04;
    m.armR.rotation.z = 0.08; m.armL.rotation.z = -0.08;
    if (st.combat && speed < 0.5) { ar -= 0.5; al -= 0.35; }
    if (swing > 0) {
      // overhead chop: raise then strike down
      const p = swing;
      ar = p < 0.35 ? -2.6 * (p / 0.35) : -2.6 + (p - 0.35) / 0.65 * 3.0;
      m.torso.rotation.y = Math.sin(p * Math.PI) * 0.35;
    } else m.torso.rotation.y *= 0.85;
    if (st.offSwing > 0) {
      const p = st.offSwing;
      al = p < 0.35 ? -2.4 * (p / 0.35) : -2.4 + (p - 0.35) / 0.65 * 2.8;
    }
    if (cast > 0) {
      ar = -1.3 + Math.sin(t * 9) * 0.12;
      al = -1.3 - Math.sin(t * 9) * 0.12;
      m.armR.rotation.z = -0.35; m.armL.rotation.z = 0.35;
    }
    if (st.shoot) { al = -1.55; ar = -1.4; m.armR.rotation.z = 0.5; m.armL.rotation.z = -0.1; }
    // jumping: arms thrown up overhead
    if (st.airborne && !(swing > 0) && !(cast > 0) && !st.shoot) {
      m.jumpT = Math.min(1, (m.jumpT ?? 0) + dt * 9);
      ar = ar + (-2.9 - ar) * m.jumpT; al = al + (-2.9 - al) * m.jumpT;
      m.armR.rotation.z = 0.25 * m.jumpT; m.armL.rotation.z = -0.25 * m.jumpT;
    } else m.jumpT = 0;
    m.armR.rotation.x = ar;
    m.armL.rotation.x = al;
    if (st.stunned) m.head.rotation.z = Math.sin(t * 6) * 0.25; else m.head.rotation.z = 0;
    if (m.root.userData.cape) m.root.userData.cape.rotation.x = 0.1 + amp * 0.5 + Math.sin(t * 3) * 0.04;
  } else if (k === 'quad') {
    m.body.position.y = Math.abs(sw) * 0.05 * amp;
    const [fl, fr, bl, br] = m.legs;
    fl.rotation.x = sw * 0.7 * amp; br.rotation.x = sw * 0.7 * amp;
    fr.rotation.x = -sw * 0.7 * amp; bl.rotation.x = -sw * 0.7 * amp;
    if (m.tail) m.tail.rotation.y = Math.sin(t * 3) * 0.3;
    const sw2 = st.swing ?? 0;
    m.head.rotation.x = sw2 > 0 ? -Math.sin(sw2 * Math.PI) * 0.6 : Math.sin(t * 1.3) * 0.04;
    if (st.sit) { m.body.position.y = -0.2; bl.rotation.x = br.rotation.x = -1.2; }
  } else if (k === 'spider') {
    m.body.position.y = Math.abs(sw) * 0.03 * amp;
    m.legs.forEach((l, i) => {
      const ph = m.phase * 1.6 + i * 1.3;
      l.rotation.x = Math.sin(ph) * 0.25 * (amp + 0.05);
    });
    const sw2 = st.swing ?? 0;
    if (m.head) m.head.rotation.x = sw2 > 0 ? -Math.sin(sw2 * Math.PI) * 0.5 : 0;
  } else if (k === 'bird') {
    const flap = Math.sin(t * (st.flying ? 5 : 9)) * 0.7;
    m.wingL.rotation.z = flap; m.wingR.rotation.z = -flap;
    m.body.position.y = (m.opts.hover ?? 1.6) + Math.sin(t * 2.5) * 0.15;
    const sw2 = st.swing ?? 0;
    m.head.rotation.x = sw2 > 0 ? Math.sin(sw2 * Math.PI) * 0.6 : 0;
  } else if (k === 'elemental') {
    m.body.position.y = 1.2 + Math.sin(t * 2) * 0.12;
    m.shards.forEach((sh, i) => {
      const a = t * 1.5 + (i / m.shards.length) * Math.PI * 2;
      sh.position.set(Math.cos(a) * 0.75, Math.sin(t * 2 + i) * 0.35, Math.sin(a) * 0.75);
      sh.rotation.set(t + i, t * 0.7, 0);
    });
  }
}

// ---------------- world objects ----------------
export function objectModel(type, color) {
  const g = new THREE.Group();
  switch (type) {
    case 'chest':
      g.add(mesh(box(0.9, 0.5, 0.6), 0x6a4422, 0, 0.25, 0));
      g.add(mesh(box(0.92, 0.2, 0.62), 0x7a5430, 0, 0.6, 0));
      g.add(mesh(box(0.15, 0.15, 0.05), 0xd0b040, 0, 0.45, 0.31));
      break;
    case 'sack':
      g.add(mesh(sphere(0.4, 7), color ?? 0xb09a70, 0, 0.35, 0));
      g.add(mesh(cyl(0.08, 0.12, 0.2, 5), color ?? 0xb09a70, 0, 0.75, 0));
      break;
    case 'crate':
      g.add(mesh(box(0.8, 0.8, 0.8), 0x8a6a40, 0, 0.4, 0));
      break;
    case 'barrel':
      g.add(mesh(cyl(0.35, 0.35, 0.9, 8), 0x7a5430, 0, 0.45, 0));
      break;
    case 'cocoon': {
      const c = mesh(sphere(0.5, 7), 0xe8e8e0, 0, 0.9, 0);
      c.scale.set(0.7, 1.6, 0.7);
      g.add(c);
      break;
    }
    case 'plant':
      g.add(mesh(cyl(0.03, 0.03, 0.6, 4), 0x4a7a3a, 0, 0.3, 0));
      g.add(mesh(ico(0.18, 0), color ?? 0x7acc5a, 0, 0.65, 0, { emissive: 0x113311 }));
      break;
    case 'mushroom':
      g.add(mesh(cyl(0.06, 0.08, 0.4, 5), 0xe8e0c8, 0, 0.2, 0));
      g.add(mesh(sphere(0.25, 7), color ?? 0x9a3ac0, 0, 0.42, 0, { emissive: 0x220833 }));
      break;
    case 'ore':
      g.add(mesh(ico(0.5, 0), 0x6a6a70, 0, 0.3, 0));
      g.add(mesh(ico(0.18, 0), color ?? 0xd09040, 0.25, 0.5, 0.1, { emissive: 0x221100 }));
      break;
    case 'banner':
      g.add(mesh(cyl(0.05, 0.05, 3, 5), 0x4a3a2a, 0, 1.5, 0));
      g.add(mesh(box(0.8, 1.2, 0.03), color ?? 0x7a2a8a, 0.4, 2.3, 0));
      break;
    case 'totem':
      g.add(mesh(cyl(0.25, 0.3, 2.2, 6), 0x6a4a3a, 0, 1.1, 0));
      g.add(mesh(box(0.6, 0.5, 0.5), color ?? 0x8a3a3a, 0, 2.2, 0));
      break;
    case 'grave':
      g.add(mesh(box(0.6, 0.9, 0.18), 0x8a8a8a, 0, 0.45, 0));
      break;
    case 'bones':
      g.add(mesh(sphere(0.18, 6), 0xe8e0d0, 0, 0.15, 0));
      g.add(mesh(box(0.6, 0.06, 0.06), 0xe8e0d0, 0.2, 0.05, 0.2));
      break;
    case 'portal': {
      const ring = new THREE.Mesh(torus(1.4, 0.15), mat(0x6a3aa0, { emissive: 0x331155 }));
      ring.position.y = 1.6;
      g.add(ring);
      g.add(mesh(new THREE.CircleGeometry(1.35, 20), 0x9a5af0, 0, 1.6, 0, { basic: true, opacity: 0.55 }));
      break;
    }
    case 'brazier':
      g.add(mesh(cyl(0.3, 0.15, 0.9, 6), 0x3a3a3a, 0, 0.45, 0));
      g.add(mesh(cone(0.25, 0.5, 5), 0xff8822, 0, 1.1, 0, { basic: true }));
      break;
    case 'idol':
      g.add(mesh(box(0.5, 1.0, 0.4), color ?? 0x2a2a3a, 0, 0.5, 0));
      g.add(mesh(ico(0.25, 0), 0x9a4ae0, 0, 1.25, 0, { emissive: 0x441177 }));
      break;
    case 'cage':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(mesh(cyl(0.03, 0.03, 2, 4), 0x444444, Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8));
      }
      g.add(mesh(cyl(0.9, 0.9, 0.1, 8), 0x555555, 0, 2, 0));
      break;
    case 'nest':
      g.add(mesh(cyl(0.6, 0.4, 0.3, 8), 0x7a6040, 0, 0.15, 0));
      for (let i = 0; i < 3; i++) g.add(mesh(sphere(0.14, 6), color ?? 0xe0d8c8, Math.cos(i * 2) * 0.2, 0.35, Math.sin(i * 2) * 0.2));
      break;
    default:
      g.add(mesh(box(0.6, 0.6, 0.6), color ?? 0xaaaaaa, 0, 0.3, 0));
  }
  return g;
}
