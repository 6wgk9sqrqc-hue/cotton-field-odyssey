export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
let _uid = 1;
export const uid = () => _uid++;

// Deterministic hash noise so the world looks the same on every load.
export function hash2(x, z, seed = 0) {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, z, oct = 4, seed = 1) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x * f, z * f, seed + i * 17) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return s / norm;
}
export function ridged(x, z, oct = 4, seed = 7) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise(x * f, z * f, seed + i * 31) * 2 - 1);
    s += n * n * amp; norm += amp; amp *= 0.5; f *= 2.1;
  }
  return s / norm;
}
// Seeded RNG (mulberry32) for repeatable world props.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// Money is stored in copper, like the classic UI.
export function moneyHTML(c) {
  c = Math.max(0, Math.floor(c));
  const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cu = c % 100;
  let out = '';
  if (g) out += `<span class="coin g">${g}</span>`;
  if (s || g) out += `<span class="coin s">${s}</span>`;
  out += `<span class="coin c">${cu}</span>`;
  return out;
}
export function moneyText(c) {
  c = Math.max(0, Math.floor(c));
  const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cu = c % 100;
  const parts = [];
  if (g) parts.push(g + 'g');
  if (s) parts.push(s + 's');
  if (cu || !parts.length) parts.push(cu + 'c');
  return parts.join(' ');
}

export const QUALITY = [
  { name: 'Poor', color: '#9d9d9d' },
  { name: 'Common', color: '#ffffff' },
  { name: 'Uncommon', color: '#1eff00' },
  { name: 'Rare', color: '#0070dd' },
  { name: 'Epic', color: '#a335ee' },
  { name: 'Legendary', color: '#ff8000' },
];

// Classic "con" colors: how dangerous a mob is relative to you.
export function grayLevel(pl) {
  if (pl <= 5) return 0;
  if (pl <= 39) return pl - Math.floor(pl / 10) - 5;
  return pl - Math.floor(pl / 5) - 1;
}
export function conColor(playerLevel, mobLevel) {
  const d = mobLevel - playerLevel;
  if (d >= 5) return '#ff2020';
  if (d >= 3) return '#ff8040';
  if (d >= -2) return '#ffff00';
  if (mobLevel > grayLevel(playerLevel)) return '#40c040';
  return '#808080';
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function fmtTime(sec) {
  sec = Math.ceil(sec);
  if (sec >= 3600) return Math.ceil(sec / 3600) + 'h';
  if (sec >= 60) return Math.ceil(sec / 60) + 'm';
  return sec + 's';
}
export function fmtDuration(sec) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return s ? `${m} min ${s} sec` : `${m} min`;
  }
  return `${+sec.toFixed(1)} sec`;
}
