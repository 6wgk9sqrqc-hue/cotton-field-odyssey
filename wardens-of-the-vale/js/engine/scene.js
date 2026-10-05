// Renderer, sky dome, lights and zone-tinted fog.
import * as THREE from '../lib/three.module.min.js';
import { G } from '../state.js';
import { ZONES } from '../data/world.js';
import { generateHeights, buildTerrain, zoneAt } from './terrain.js';
import { buildScenery, glowLights, fires, updateScenery } from './scenery.js';
import { lerp } from '../util.js';

let sky, sun, hemi, torchLight, glowSprites, fireSprites;
const fogColor = new THREE.Color();
const skyTop = new THREE.Color();
const tmp = new THREE.Color();

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

export function initScene(canvas, onProgress) {
  const lowPower = G.isTouch || (navigator.hardwareConcurrency ?? 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 420);
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.lowPower = lowPower;

  scene.fog = new THREE.Fog(0xc9dcec, 70, 260);
  scene.background = new THREE.Color(0x8fbce6);

  hemi = new THREE.HemisphereLight(0xdfeeff, 0x5a5040, 1.15);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
  sun.position.set(0.5, 1, 0.35);
  scene.add(sun);
  torchLight = new THREE.PointLight(0xffa860, 0, 30, 1.6);
  scene.add(torchLight);

  // sky dome with a vertex gradient
  const sg = new THREE.SphereGeometry(400, 24, 12);
  const cols = new Float32Array(sg.attributes.position.count * 3);
  sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  scene.add(sky);

  onProgress?.('Shaping the land…');
  generateHeights();
  onProgress?.('Painting the fields…');
  buildTerrain(scene);
  onProgress?.('Planting the forests…');
  buildScenery(scene);

  // lantern and torch glows as additive sprites
  const tex = glowTexture();
  G.glowTex = tex;
  const smat = new THREE.SpriteMaterial({ map: tex, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  glowSprites = new THREE.Group();
  for (const l of glowLights) {
    const s = new THREE.Sprite(smat);
    s.position.set(l.x, l.y, l.z);
    s.scale.setScalar(l.torch ? 2.2 : 1.8);
    glowSprites.add(s);
  }
  scene.add(glowSprites);
  const fmat = new THREE.SpriteMaterial({ map: tex, color: 0xff8a30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  fireSprites = [];
  for (const f of fires) {
    const s = new THREE.Sprite(fmat);
    s.position.set(f.x, f.y + 0.6, f.z);
    s.scale.setScalar(1.8);
    scene.add(s);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
    core.position.set(f.x, f.y + 0.5, f.z);
    scene.add(core);
    fireSprites.push({ s, core });
  }

  window.addEventListener('resize', onResize);
  onResize();
  setZoneAtmosphere('cottonvale', true);
  return { renderer, scene, camera };
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  G.renderer.setSize(w, h, false);
  G.camera.aspect = w / h;
  G.camera.updateProjectionMatrix();
}

let curZone = null;
const targetFog = new THREE.Color(), targetSky = new THREE.Color();
let targetNear = 70, targetFar = 260;
export function setZoneAtmosphere(zoneId, instant = false) {
  const z = ZONES[zoneId];
  if (!z) return;
  curZone = zoneId;
  targetFog.setHex(z.fog);
  targetSky.setHex(z.sky);
  if (z.dungeon) { targetNear = 8; targetFar = 70; } else if (zoneId === 'whisperwood') { targetNear = 40; targetFar = 210; } else if (zoneId === 'saltmarsh') { targetNear = 30; targetFar = 190; } else { targetNear = 70; targetFar = 260; }
  if (G.lowPower) targetFar *= 0.8;
  if (instant) {
    fogColor.copy(targetFog); skyTop.copy(targetSky);
    G.scene.fog.near = targetNear; G.scene.fog.far = targetFar;
  }
}

export function updateScene(dt) {
  const p = G.player;
  const t = Math.min(1, dt * 0.8);
  fogColor.lerp(targetFog, t);
  skyTop.lerp(targetSky, t);
  G.scene.fog.color.copy(fogColor);
  G.scene.fog.near = lerp(G.scene.fog.near, targetNear, t);
  G.scene.fog.far = lerp(G.scene.fog.far, targetFar, t);
  G.scene.background.copy(fogColor);
  // recolor sky dome
  const pos = sky.geometry.attributes.position, col = sky.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400;
    tmp.copy(fogColor).lerp(skyTop, Math.max(0, Math.min(1, y * 2.2)));
    col.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  col.needsUpdate = true;
  const dungeon = curZone === 'spire';
  hemi.intensity = lerp(hemi.intensity, dungeon ? 0.75 : 1.15, t);
  sun.intensity = lerp(sun.intensity, dungeon ? 0.35 : 1.6, t);
  torchLight.intensity = lerp(torchLight.intensity, dungeon ? 3.2 : 0, t);
  if (p) {
    sky.position.copy(G.camera.position);
    torchLight.position.set(p.pos.x, p.y + 4, p.pos.z);
    const zid = zoneAt(p.pos.x, p.pos.z);
    if (zid !== curZone) setZoneAtmosphere(zid);
  }
  for (const f of fireSprites) {
    const k = 1 + Math.sin(G.time * 11 + f.s.position.x) * 0.12 + Math.sin(G.time * 7.3) * 0.08;
    f.s.scale.setScalar(1.8 * k);
    f.core.scale.set(k, k * 1.1, k);
  }
  updateScenery(dt);
}
