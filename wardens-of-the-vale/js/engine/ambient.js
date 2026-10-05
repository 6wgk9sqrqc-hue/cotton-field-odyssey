// Ambient particles around the player that give each zone some life:
// pollen over Goldmeadow, fireflies in Whisperwood, spores over the fen,
// embers on Ashen Ridge and dust motes in the Spire.
import * as THREE from '../lib/three.module.min.js';
import { G } from '../state.js';
import { heightAt } from './terrain.js';
import { preset } from './gfx.js';

const MAX = 240;
const R = 26; // half-size of the box of particles around the player
const ZONE = {
  cottonvale: { mode: 'pollen', n: 120, color: [1.4, 1.3, 0.95], size: 0.09, alpha: 0.55 },
  whisperwood: { mode: 'firefly', n: 90, color: [1.6, 2.0, 0.6], size: 0.16, alpha: 0.9 },
  saltmarsh: { mode: 'spore', n: 140, color: [0.9, 1.25, 0.8], size: 0.1, alpha: 0.5 },
  ashen: { mode: 'ember', n: 150, color: [2.4, 0.9, 0.25], size: 0.11, alpha: 0.95 },
  spire: { mode: 'dust', n: 110, color: [0.9, 0.75, 1.3], size: 0.08, alpha: 0.5 },
};

let points, posA, colA, sizeA;
const ps = [];
let zone = null, fade = 0, cfg = ZONE.cottonvale;
const uniforms = { uPx: { value: 400 }, uTex: { value: null } };

export function initAmbient(scene) {
  const geo = new THREE.BufferGeometry();
  posA = new Float32Array(MAX * 3);
  colA = new Float32Array(MAX * 4);
  sizeA = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colA, 4));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizeA, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uPx;
      attribute vec4 aColor;
      attribute float aSize;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, aSize * uPx / max(0.5, -mv.z));
        vColor.a *= smoothstep(${R.toFixed(1)}, ${(R * 0.6).toFixed(1)}, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec4 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vColor.rgb * a * a * vColor.a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  scene.add(points);
}

function spawn(p, cx, cz, anywhere) {
  p.x = cx + (Math.random() * 2 - 1) * R;
  p.z = cz + (Math.random() * 2 - 1) * R;
  const g = G.player && G.player.pos.x > 950 ? 0 : heightAt(p.x, p.z);
  p.g = g;
  p.ph = Math.random() * Math.PI * 2;
  p.s = 0.6 + Math.random() * 0.8;
  switch (cfg.mode) {
    case 'firefly': p.h = 0.4 + Math.random() * 2.8; break;
    case 'ember': p.h = anywhere ? Math.random() * 9 : Math.random() * 0.5; p.vy = 0.8 + Math.random() * 1.6; break;
    case 'spore': p.h = Math.random() * 5; p.vy = 0.15 + Math.random() * 0.25; break;
    case 'dust': p.h = Math.random() * 6; p.vy = (Math.random() - 0.5) * 0.1; break;
    default: p.h = 0.5 + Math.random() * 6; p.vy = (Math.random() - 0.5) * 0.2;
  }
  p.y = g + p.h;
}

export function updateAmbient(dt, zoneId) {
  if (!points) return;
  const p0 = G.player;
  const cx = p0 ? p0.pos.x : G.camera.position.x, cz = p0 ? p0.pos.z : G.camera.position.z;
  if (zoneId !== zone) {
    fade -= dt * 2;
    if (fade <= 0 || !zone) {
      zone = zoneId;
      cfg = ZONE[zoneId] ?? ZONE.cottonvale;
      ps.length = 0;
      const n = Math.min(MAX, Math.round(cfg.n * preset().particles));
      for (let i = 0; i < n; i++) { const p = {}; spawn(p, cx, cz, true); ps.push(p); }
      fade = 0;
    }
  } else fade = Math.min(1, fade + dt * 0.8);
  uniforms.uPx.value = (G.renderer.domElement.height / 2) / Math.tan((G.camera.fov * Math.PI) / 360);
  const t = G.time;
  let k = 0;
  for (const p of ps) {
    switch (cfg.mode) {
      case 'firefly':
        p.x += Math.sin(t * 0.7 * p.s + p.ph) * dt * 0.8;
        p.z += Math.cos(t * 0.6 * p.s + p.ph * 1.3) * dt * 0.8;
        p.y = p.g + p.h + Math.sin(t * 1.1 + p.ph) * 0.4;
        break;
      case 'ember':
        p.h += p.vy * dt;
        p.x += Math.sin(t * 2 + p.ph) * dt * 0.6 + dt * 0.5;
        p.y = p.g + p.h;
        if (p.h > 10) spawn(p, cx, cz, false);
        break;
      default:
        p.h += (p.vy ?? 0) * dt;
        p.x += (Math.sin(t * 0.3 * p.s + p.ph) * 0.35 + 0.25) * dt;
        p.z += Math.cos(t * 0.25 * p.s + p.ph) * 0.3 * dt;
        p.y = p.g + p.h + Math.sin(t * 0.8 + p.ph) * 0.25;
        if (p.h > 8 || p.h < 0.2) p.vy = -(p.vy ?? 0);
    }
    // wrap around the player so the cloud of motes always surrounds them
    if (p.x - cx > R || cx - p.x > R || p.z - cz > R || cz - p.z > R) spawn(p, cx, cz, true);
    let a = cfg.alpha * fade;
    if (cfg.mode === 'firefly') a *= Math.max(0, Math.sin(t * 1.6 * p.s + p.ph * 3)) ** 2;
    if (cfg.mode === 'ember') a *= Math.min(1, (10 - p.h) / 4) * (0.7 + 0.3 * Math.sin(t * 9 + p.ph));
    posA[k * 3] = p.x; posA[k * 3 + 1] = p.y; posA[k * 3 + 2] = p.z;
    colA[k * 4] = cfg.color[0]; colA[k * 4 + 1] = cfg.color[1]; colA[k * 4 + 2] = cfg.color[2]; colA[k * 4 + 3] = a;
    sizeA[k] = cfg.size * p.s;
    k++;
  }
  const g = points.geometry;
  g.setDrawRange(0, k);
  g.attributes.position.needsUpdate = true;
  g.attributes.aColor.needsUpdate = true;
  g.attributes.aSize.needsUpdate = true;
}
