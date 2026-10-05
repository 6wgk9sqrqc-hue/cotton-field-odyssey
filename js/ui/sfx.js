// Tiny synthesized sound effects (no audio files). Audio starts after the first user gesture.
import { G, on } from '../state.js';

let ctx = null, master = null;
function ac() {
  if (!G.settings.sound) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.25, filterFreq = 1200, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}
const SCHOOL_PITCH = { fire: 220, frost: 660, arcane: 520, shadow: 160, holy: 440, nature: 330, physical: 120 };
let lastHit = 0;
export function initSfx() {
  const unlock = () => { ac(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  on('damage', (e) => {
    const p = G.player;
    if (!p || (e.src !== p && e.tgt !== p && e.src?.owner !== p)) return;
    const now = performance.now();
    if (now - lastHit < 60) return;
    lastHit = now;
    if (e.missType) { noise(0.08, 0.12, 2500); return; }
    if (e.school === 'physical') { noise(0.12, e.crit ? 0.4 : 0.25, e.tgt === p ? 500 : 900); if (e.crit) tone(90, 0.2, 'square', 0.15, 0.5); }
    else tone(SCHOOL_PITCH[e.school] ?? 300, 0.25, e.school === 'shadow' ? 'sawtooth' : 'triangle', 0.18, e.school === 'frost' ? 1.6 : 0.6);
  });
  on('castStart', (e) => { if (e.unit === G.player && e.ability) tone(SCHOOL_PITCH[e.ability.school] ?? 300, 0.35, 'sine', 0.06, 1.5); });
  on('heal', (e) => { if (e.tgt === G.player && !e.periodic) { tone(523, 0.18, 'sine', 0.12); tone(784, 0.25, 'sine', 0.1, 0, 0.08); } });
  on('levelUp', () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.2, 0, i * 0.12)); });
  on('questComplete', () => { [392, 523, 659].forEach((f, i) => tone(f, 0.4, 'triangle', 0.18, 0, i * 0.1)); });
  on('questsChanged', (e) => { if (e?.accepted) tone(440, 0.2, 'triangle', 0.12); });
  on('loot', (e) => { if (e.money) { tone(1320, 0.08, 'square', 0.06); tone(1760, 0.1, 'square', 0.05, 0, 0.05); } });
  on('error', () => tone(110, 0.12, 'square', 0.05));
  on('playerDead', () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, 'sine', 0.15, 0, i * 0.25)); });
}
