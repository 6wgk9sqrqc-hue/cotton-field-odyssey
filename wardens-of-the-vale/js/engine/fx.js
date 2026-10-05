// Lightweight particle bursts, rings and glows for spell feedback.
import * as THREE from '../lib/three.module.min.js';
import { G, on } from '../state.js';

const parts = [];
const rings = [];
let pointsMesh, posArr, colArr, sizeArr;
const MAX = 900;

export function initFx() {
  const geo = new THREE.BufferGeometry();
  posArr = new Float32Array(MAX * 3);
  colArr = new Float32Array(MAX * 3);
  sizeArr = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55, map: G.glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  pointsMesh = new THREE.Points(geo, mat);
  pointsMesh.frustumCulled = false;
  pointsMesh.renderOrder = 5;
  G.scene.add(pointsMesh);
  on('impact', (e) => burst({ x: e.x, y: e.y, z: e.z }, e.color ?? 0xffffff, 10, 3));
}

const tmpC = new THREE.Color();
export function burst(p, color, n = 14, speed = 4, life = 0.6, up = 0) {
  tmpC.setHex(color);
  for (let i = 0; i < n; i++) {
    if (parts.length >= MAX) parts.shift();
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    parts.push({
      x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s * 0.6 + up, vz: Math.sin(a) * Math.cos(b) * s,
      life, max: life, r: tmpC.r, g: tmpC.g, b: tmpC.b, grav: up ? -1 : 4,
    });
  }
}
export function rise(u, color, n = 16) {
  tmpC.setHex(color);
  for (let i = 0; i < n; i++) {
    if (parts.length >= MAX) parts.shift();
    const a = Math.random() * Math.PI * 2, r = Math.random() * (u.radius ?? 0.5) * 1.6;
    parts.push({
      x: u.pos.x + Math.cos(a) * r, y: u.y + Math.random() * 0.5, z: u.pos.z + Math.sin(a) * r, vx: 0, vy: 1.5 + Math.random() * 1.5, vz: 0,
      life: 1.0, max: 1.0, r: tmpC.r, g: tmpC.g, b: tmpC.b, grav: 0,
    });
  }
}
export function at(u, color, n = 14, speed = 3) {
  burst({ x: u.pos.x, y: u.y + (u.height ?? 1.8) * 0.55, z: u.pos.z }, color, n, speed);
}

const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
export function nova(x, y, z, radius, color, dur = 0.5) {
  if (!G.scene) return;
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.position.set(x, y + 0.3, z);
  G.scene.add(m);
  rings.push({ m, t: 0, dur, radius });
}
export function novaAt(u, radius, color) { nova(u.pos.x, u.y, u.pos.z, radius, color); burst({ x: u.pos.x, y: u.y + 1, z: u.pos.z }, color, 24, radius * 1.2); }

// a persistent glow around a unit (shields, auras); returns a handle with remove()
const shellGeo = new THREE.SphereGeometry(1, 16, 12);
export function shell(u, color, opacity = 0.25) {
  const m = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  const s = Math.max(1, (u.height ?? 1.8) * 0.65);
  m.scale.set(s * 0.8, s, s * 0.8);
  m.position.y = (u.height ?? 1.8) * 0.5 / (u.model?.scale ?? 1);
  u.group.add(m);
  return { remove: () => u.group.remove(m), mesh: m };
}

export function updateFx(dt) {
  let k = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (const p of parts) {
    const f = p.life / p.max;
    posArr[k * 3] = p.x; posArr[k * 3 + 1] = p.y; posArr[k * 3 + 2] = p.z;
    colArr[k * 3] = p.r * f; colArr[k * 3 + 1] = p.g * f; colArr[k * 3 + 2] = p.b * f;
    k++;
  }
  if (pointsMesh) {
    pointsMesh.geometry.setDrawRange(0, k);
    pointsMesh.geometry.attributes.position.needsUpdate = true;
    pointsMesh.geometry.attributes.color.needsUpdate = true;
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const f = r.t / r.dur;
    r.m.scale.setScalar(0.5 + r.radius * f);
    r.m.material.opacity = 0.9 * (1 - f);
    if (f >= 1) { G.scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
  }
}
