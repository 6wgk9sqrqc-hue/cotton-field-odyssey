// Time of day: the sun rises in the east, crosses the southern sky and sets in
// the west; at night a moon takes over the shadows. Days run long and nights
// short so most play happens in daylight.
import * as THREE from '../lib/three.module.min.js';
import { G } from '../state.js';

const DAY_START = 6, DAY_END = 20;
const DAY_RATE = 14 / (26 * 60);   // 14 in-game hours of daylight in 26 minutes
const NIGHT_RATE = 10 / (8 * 60);  // 10 hours of night in 8 minutes

export function initTime() {
  G.dayTime = G.settings?.dayTime ?? 9.5;
}
export function advanceTime(dt) {
  if (G.dayTime === undefined) initTime();
  const day = G.dayTime >= DAY_START && G.dayTime < DAY_END;
  G.dayTime = (G.dayTime + dt * (day ? DAY_RATE : NIGHT_RATE)) % 24;
  if (G.settings) G.settings.dayTime = G.dayTime;
}
export function clockText() {
  const h = Math.floor(G.dayTime ?? 12), m = Math.floor(((G.dayTime ?? 12) % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function arcDir(frac, maxEl, out) {
  // frac 0 = rising in the east, 0.5 = highest in the south, 1 = setting in the west
  const el = Math.sin(frac * Math.PI) * maxEl;
  const az = frac * Math.PI;
  out.set(Math.cos(az) * Math.cos(el), Math.sin(el), 0.55 * Math.cos(el) + 0.05).normalize();
  return out;
}

const state = {
  sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), lightDir: new THREE.Vector3(),
  day: 1, sunset: 0, night: 0, sunAlt: 1,
};
// Everything the renderer needs to light the current hour.
export function skyState() {
  const h = G.dayTime ?? 9.5;
  // sun runs a little below the horizon outside daylight so dawn and dusk blend
  const sf = (h - DAY_START) / (DAY_END - DAY_START);
  arcDir(Math.max(-0.25, Math.min(1.25, sf)), 62 * Math.PI / 180, state.sunDir);
  const mf = (((h - DAY_END + 24) % 24)) / (24 - (DAY_END - DAY_START));
  arcDir(Math.max(0, Math.min(1, mf)), 48 * Math.PI / 180, state.moonDir);
  const alt = state.sunDir.y;
  state.sunAlt = alt;
  state.day = smooth(-0.06, 0.22, alt);
  state.night = 1 - smooth(-0.16, 0.03, alt);
  state.sunset = smooth(-0.12, 0.03, alt) * (1 - smooth(0.05, 0.42, alt));
  // the brighter of sun and moon casts the shadows
  state.lightDir.copy(alt > -0.04 ? state.sunDir : state.moonDir);
  return state;
}
