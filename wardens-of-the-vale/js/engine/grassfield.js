// A dense carpet of grass tufts around the player, drawn as one instanced
// mesh. Tufts are re-planted on a fixed grid whenever the player has moved a
// few yards, sway in the wind and shrink away toward the edge of the patch.
import * as THREE from '../lib/three.module.min.js';
import { G } from '../state.js';
import { heightAt, zoneAt, roadDistFast, inTown, inField, slopeAt, lavaAt } from './terrain.js';
import { shared } from './gfx.js';
import { hash2 } from '../util.js';

const RADIUS = { low: 26, medium: 34, high: 44 };
const CELL = 1.25;
// tuft color and density per zone
const ZONE = {
  cottonvale: { c: [0.4, 0.6, 0.2], tip: [0.66, 0.72, 0.3], d: 0.85 },
  whisperwood: { c: [0.2, 0.38, 0.16], tip: [0.45, 0.6, 0.28], d: 0.7 },
  saltmarsh: { c: [0.38, 0.42, 0.18], tip: [0.72, 0.7, 0.36], d: 0.8 },
  ashen: { c: [0.32, 0.29, 0.26], tip: [0.5, 0.45, 0.38], d: 0.1 },
};

let mesh = null, radius = 34, cap = 0;
let cx = 1e9, cz = 1e9;
const center = { value: new THREE.Vector3() };

function tuftGeometry() {
  const pos = [], col = [], nor = [];
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.7;
    const r = 0.08 + (i % 3) * 0.06;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.32 + ((i * 37) % 10) * 0.035;
    const w = 0.055;
    const lean = 0.12 + (i % 2) * 0.08;
    const px = Math.cos(a + 1.57) * w, pz = Math.sin(a + 1.57) * w;
    const tx = x + Math.cos(a) * lean, tz = z + Math.sin(a) * lean;
    pos.push(x - px, 0, z - pz, x + px, 0, z + pz, tx, h, tz);
    col.push(0.68, 0.68, 0.68, 0.68, 0.68, 0.68, 1.05, 1.05, 1.05);
    for (let k = 0; k < 3; k++) nor.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function grassMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    sh.uniforms.uCenter = center;
    sh.uniforms.uRadius = { value: radius };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uCenter;\nuniform float uRadius;')
      .replace('#include <project_vertex>', /* glsl */`
        {
          vec3 wo = instanceMatrix[3].xyz;
          float d = distance(wo.xz, uCenter.xz);
          float fade = 1.0 - smoothstep(uRadius * 0.6, uRadius, d);
          float h = transformed.y;
          transformed *= fade;
          float wp = uTime * 1.9 + wo.x * 0.23 + wo.z * 0.19;
          float gust = 0.6 + 0.4 * sin(uTime * 0.4 + wo.x * 0.013 + wo.z * 0.009);
          float ws = (sin(wp) * 0.7 + sin(wp * 2.3 + 1.1) * 0.3) * 0.45 * gust * h * h;
          transformed.x += ws;
          transformed.z += ws * 0.6;
        }
        #include <project_vertex>`);
    // both sides of a blade are lit like the ground, so back faces never turn black
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  m.customProgramCacheKey = () => 'wov-grassfield';
  return m;
}

export function initGrass(scene) {
  radius = RADIUS[G.quality] ?? 34;
  const n = Math.ceil((radius * 2) / CELL);
  cap = n * n;
  mesh = new THREE.InstancedMesh(tuftGeometry(), grassMaterial(), cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(mesh);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
function replant(px, pz) {
  cx = px; cz = pz;
  const gx0 = Math.floor((px - radius) / CELL), gz0 = Math.floor((pz - radius) / CELL);
  const n = Math.ceil((radius * 2) / CELL);
  let k = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gx = gx0 + i, gz = gz0 + j;
      const x = (gx + hash2(gx, gz, 61)) * CELL, z = (gz + hash2(gx, gz, 62)) * CELL;
      const dd = Math.hypot(x - px, z - pz);
      if (dd > radius) continue;
      const zone = ZONE[zoneAt(x, z)];
      if (!zone) continue;
      const r = hash2(gx, gz, 63);
      if (r > zone.d) continue;
      const h = heightAt(x, z);
      if (h < 0.25) continue;
      const rd = roadDistFast(x, z);
      if (rd < 4.5 + r * 2) continue;
      if (inField(x, z) || lavaAt(x, z)) continue;
      if (slopeAt(x, z) > 1.05) continue;
      const t = inTown(x, z);
      if (t && Math.hypot(x - t.x, z - t.z) < t.r * 0.8 && r > 0.25) continue;
      const sc = 0.7 + hash2(gx, gz, 64) * 0.8;
      _e.set(0, hash2(gx, gz, 65) * 6.28, 0);
      _q.setFromEuler(_e);
      _s.set(sc, sc * (0.8 + r * 0.6), sc);
      _p.set(x, h - 0.04, z);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(k, _m);
      const v = 0.85 + hash2(gx, gz, 66) * 0.3;
      const tipMix = hash2(gx, gz, 67) * 0.45;
      _c.setRGB((zone.c[0] + (zone.tip[0] - zone.c[0]) * tipMix) * v, (zone.c[1] + (zone.tip[1] - zone.c[1]) * tipMix) * v, (zone.c[2] + (zone.tip[2] - zone.c[2]) * tipMix) * v);
      mesh.setColorAt(k, _c);
      k++;
      if (k >= cap) break;
    }
    if (k >= cap) break;
  }
  mesh.count = k;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function updateGrass() {
  if (!mesh) return;
  const p = G.player;
  const x = p ? p.pos.x : G.camera.position.x, z = p ? p.pos.z : G.camera.position.z;
  const inDungeon = x > 950;
  mesh.visible = !inDungeon && G.quality !== undefined;
  if (inDungeon) return;
  center.value.set(x, 0, z);
  if (Math.hypot(x - cx, z - cz) > radius * 0.18) replant(x, z);
}
export function grassRadius() { return radius; }
export function resetGrass(scene) {
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); mesh = null; }
  cx = cz = 1e9;
  initGrass(scene);
}