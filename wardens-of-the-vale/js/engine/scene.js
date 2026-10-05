// Renderer, sky dome, sun shadows, lights and zone atmosphere.
import * as THREE from '../lib/three.module.min.js';
import { G } from '../state.js';
import { ZONES } from '../data/world.js';
import { generateHeights, buildTerrain, zoneAt } from './terrain.js';
import { buildScenery, glowLights, fires, updateScenery } from './scenery.js';
import { lerp } from '../util.js';
import { shared, preset, loadQuality, storeQuality, PRESETS } from './gfx.js';
import { skyMaterial } from './envshaders.js';
import { initPost, renderFrame, resizePost, setBloom } from './post.js';
import { initAmbient, updateAmbient } from './ambient.js';
import { initGrass, updateGrass, resetGrass } from './grassfield.js';

let sky, sun, hemi, torchLight, glowSprites, fireSprites, terrain;

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Lighting mood per zone. Colors are blended when the player crosses a border.
const ATMO = {
  cottonvale: { sun: 0xfff1d8, sunI: 2.5, sky: 0xe4f0ff, ground: 0x6b5a3c, hemiI: 1.05, cloud: 0.42, cloudTint: 0xffffff, shallow: 0x46aaa2, deep: 0x14405a, rim: 0x9ab4d8 },
  whisperwood: { sun: 0xffe6b8, sunI: 2.2, sky: 0xd0e8da, ground: 0x34452c, hemiI: 1.0, cloud: 0.55, cloudTint: 0xf2f6f0, shallow: 0x3c8c7a, deep: 0x103a3e, rim: 0x9ac8b0 },
  saltmarsh: { sun: 0xf6ebc6, sunI: 2.0, sky: 0xd8e4cc, ground: 0x4a4a2e, hemiI: 1.05, cloud: 0.72, cloudTint: 0xe2e6da, shallow: 0x5e8058, deep: 0x22382a, rim: 0xb0c8a0 },
  ashen: { sun: 0xffc48c, sunI: 2.1, sky: 0xf0d0bc, ground: 0x4a2c24, hemiI: 0.95, cloud: 0.88, cloudTint: 0x9a8680, shallow: 0x6e5a4e, deep: 0x2a1e1c, rim: 0xe0a080 },
  spire: { sun: 0x8a78b0, sunI: 0.5, sky: 0xb0a0d8, ground: 0x2a2038, hemiI: 1.25, cloud: 0, cloudTint: 0x404040, shallow: 0x303040, deep: 0x101018, rim: 0x9070c0 },
};
const cur = {
  fog: new THREE.Color(), sky: new THREE.Color(), sun: new THREE.Color(), hsky: new THREE.Color(), hground: new THREE.Color(),
  cloudTint: new THREE.Color(), shallow: new THREE.Color(), deep: new THREE.Color(), rim: new THREE.Color(),
  sunI: 2.5, hemiI: 1, cloud: 0.4, near: 70, far: 260, torch: 0,
};
const want = {
  fog: new THREE.Color(), sky: new THREE.Color(), sun: new THREE.Color(), hsky: new THREE.Color(), hground: new THREE.Color(),
  cloudTint: new THREE.Color(), shallow: new THREE.Color(), deep: new THREE.Color(), rim: new THREE.Color(),
  sunI: 2.5, hemiI: 1, cloud: 0.4, near: 70, far: 260, torch: 0,
};
const SUN_DIR = new THREE.Vector3(0.48, 0.78, 0.4).normalize();

export function initScene(canvas, onProgress) {
  G.quality = loadQuality();
  const P = preset();
  const lowPower = G.quality === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !P.bloom && G.quality !== 'low', powerPreference: 'high-performance' });
  G.maxPixelRatio = Math.min(window.devicePixelRatio || 1, P.pixelRatio);
  G.pixelRatio = G.maxPixelRatio;
  renderer.setPixelRatio(G.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = P.shadows;
  renderer.shadowMap.type = G.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 430);
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.lowPower = lowPower;

  scene.fog = new THREE.Fog(0xc9dcec, 70, 260);
  scene.background = new THREE.Color(0x8fbce6);

  hemi = new THREE.HemisphereLight(0xdfeeff, 0x5a5040, 1.05);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 2.5);
  sun.position.copy(SUN_DIR).multiplyScalar(200);
  scene.add(sun, sun.target);
  configureShadows();
  shared.uSunDir.value.copy(SUN_DIR);
  torchLight = new THREE.PointLight(0xffa860, 0, 30, 1.6);
  scene.add(torchLight);

  sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMaterial(lowPower));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  onProgress?.('Shaping the land…');
  generateHeights();
  onProgress?.('Painting the fields…');
  terrain = buildTerrain(scene);
  onProgress?.('Planting the forests…');
  buildScenery(scene);
  initGrass(scene);

  // lantern and torch glows as additive sprites
  const tex = glowTexture();
  G.glowTex = tex;
  const smat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0xffb060).multiplyScalar(0.9), opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  glowSprites = new THREE.Group();
  for (const l of glowLights) {
    const s = new THREE.Sprite(smat);
    s.position.set(l.x, l.y, l.z);
    s.scale.setScalar(l.torch ? 1.6 : 1.5);
    glowSprites.add(s);
  }
  scene.add(glowSprites);
  const fmat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0xff8a30).multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb040).multiplyScalar(2.2) });
  fireSprites = [];
  for (const f of fires) {
    const s = new THREE.Sprite(fmat);
    s.position.set(f.x, f.y + 0.6, f.z);
    s.scale.setScalar(1.8);
    scene.add(s);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 6), coreMat);
    core.position.set(f.x, f.y + 0.5, f.z);
    scene.add(core);
    fireSprites.push({ s, core });
  }

  initPost(renderer);
  setBloom(P.bloom);
  initAmbient(scene);
  window.addEventListener('resize', onResize);
  onResize();
  setZoneAtmosphere('cottonvale', true);
  return { renderer, scene, camera };
}

function configureShadows() {
  const P = preset();
  sun.castShadow = P.shadows;
  if (!P.shadows) return;
  const R = P.shadowRange;
  sun.shadow.mapSize.set(P.shadowSize, P.shadowSize);
  const c = sun.shadow.camera;
  c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 20; c.far = 420;
  c.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 2;
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
}

// Switch quality while playing: resolution, shadows and bloom change live.
export function applyQuality(q, persist = true) {
  if (!PRESETS[q]) return;
  G.quality = q;
  if (persist) storeQuality(q);
  const P = preset();
  G.maxPixelRatio = Math.min(window.devicePixelRatio || 1, P.pixelRatio);
  G.pixelRatio = G.maxPixelRatio;
  G.renderer.setPixelRatio(G.pixelRatio);
  G.renderer.shadowMap.enabled = P.shadows;
  G.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  configureShadows();
  terrain?.group.children.forEach((m) => { m.castShadow = P.terrainShadows; });
  G.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  setBloom(P.bloom);
  resetGrass(G.scene);
  setZoneAtmosphere(curZone ?? 'cottonvale');
  onResize();
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  G.renderer.setSize(w, h, false);
  G.camera.aspect = w / h;
  // tall screens get a wider vertical view so the sides are not cut off
  G.camera.fov = w / h < 1 ? 80 : 70;
  G.camera.updateProjectionMatrix();
  resizePost(w, h, G.renderer.getPixelRatio());
}
export function setPixelRatio(pr) {
  G.pixelRatio = pr;
  G.renderer.setPixelRatio(pr);
  resizePost(window.innerWidth, window.innerHeight, pr);
}

let curZone = null;
export function setZoneAtmosphere(zoneId, instant = false) {
  const z = ZONES[zoneId];
  const a = ATMO[zoneId];
  if (!z || !a) return;
  curZone = zoneId;
  want.fog.setHex(z.fog); want.sky.setHex(z.sky);
  want.sun.setHex(a.sun); want.hsky.setHex(a.sky); want.hground.setHex(a.ground);
  want.cloudTint.setHex(a.cloudTint); want.shallow.setHex(a.shallow); want.deep.setHex(a.deep);
  want.rim.setHex(a.rim).multiplyScalar(0.3);
  want.sunI = a.sunI; want.hemiI = a.hemiI; want.cloud = a.cloud;
  want.torch = z.dungeon ? 3.2 : 0;
  if (z.dungeon) { want.near = 8; want.far = 70; } else if (zoneId === 'whisperwood') { want.near = 40; want.far = 210; } else if (zoneId === 'saltmarsh') { want.near = 30; want.far = 190; } else { want.near = 70; want.far = 260; }
  want.far *= preset().far;
  if (instant) blendAtmosphere(1);
}
function blendAtmosphere(t) {
  for (const k of ['fog', 'sky', 'sun', 'hsky', 'hground', 'cloudTint', 'shallow', 'deep', 'rim']) cur[k].lerp(want[k], t);
  for (const k of ['sunI', 'hemiI', 'cloud', 'near', 'far', 'torch']) cur[k] = lerp(cur[k], want[k], t);
}

const _center = new THREE.Vector3();
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
export function updateScene(dt) {
  const p = G.player;
  blendAtmosphere(Math.min(1, dt * 0.8));
  const scene = G.scene;
  scene.fog.color.copy(cur.fog);
  scene.fog.near = cur.near; scene.fog.far = cur.far;
  scene.background.copy(cur.fog);
  hemi.color.copy(cur.hsky); hemi.groundColor.copy(cur.hground); hemi.intensity = cur.hemiI;
  sun.color.copy(cur.sun); sun.intensity = cur.sunI;
  torchLight.intensity = cur.torch;
  shared.uTime.value = G.time;
  shared.uSunColor.value.copy(cur.sun);
  shared.uSkyTop.value.copy(cur.sky);
  shared.uHorizon.value.copy(cur.fog);
  shared.uCloud.value = cur.cloud;
  shared.uRim.value.copy(cur.rim);
  sky.material.uniforms.uCloudTint.value.copy(cur.cloudTint);
  if (terrain?.waterMat) {
    terrain.waterMat.uniforms.uShallow.value.copy(cur.shallow);
    terrain.waterMat.uniforms.uDeep.value.copy(cur.deep);
  }
  sky.position.copy(G.camera.position);
  sky.visible = curZone !== 'spire';
  // keep the shadow map centered on the player, snapped to whole texels so it does not shimmer
  _center.copy(p ? new THREE.Vector3(p.pos.x, p.y, p.pos.z) : G.camera.position);
  if (sun.castShadow) {
    const P = preset();
    const texel = (P.shadowRange * 2) / P.shadowSize;
    _fwd.copy(SUN_DIR).negate();
    _right.crossVectors(_fwd, THREE.Object3D.DEFAULT_UP).normalize();
    _up.crossVectors(_right, _fwd).normalize();
    const a = Math.round(_center.dot(_right) / texel) * texel;
    const b = Math.round(_center.dot(_up) / texel) * texel;
    const c = _center.dot(_fwd);
    _center.copy(_right).multiplyScalar(a).addScaledVector(_up, b).addScaledVector(_fwd, c);
  }
  sun.target.position.copy(_center);
  sun.position.copy(_center).addScaledVector(SUN_DIR, 220);
  if (p) {
    torchLight.position.set(p.pos.x, p.y + 4, p.pos.z);
    const zid = zoneAt(p.pos.x, p.pos.z);
    if (zid !== curZone) setZoneAtmosphere(zid, zid === 'spire' || curZone === 'spire');
  }
  for (const f of fireSprites) {
    const k = 1 + Math.sin(G.time * 11 + f.s.position.x) * 0.12 + Math.sin(G.time * 7.3) * 0.08;
    f.s.scale.setScalar(1.8 * k);
    f.core.scale.set(k, k * 1.1, k);
  }
  updateScenery(dt);
  updateGrass();
  updateAmbient(dt, curZone);
}

export function render() { renderFrame(G.renderer, G.scene, G.camera); }
