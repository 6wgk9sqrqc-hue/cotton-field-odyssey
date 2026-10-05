// Character saves in localStorage. Every access is guarded: storage can be
// unavailable (private windows, embedded viewers) and the game must still run.
import { G } from './state.js';

const INDEX = 'wov_chars_v1';
const KEY = (id) => 'wov_char_' + id;
let memory = {}; // fallback when storage is blocked

function read(k) {
  try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch { /* storage blocked */ }
  return memory[k] ?? null;
}
function write(k, v) {
  memory[k] = v;
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}
function remove(k) {
  delete memory[k];
  try { localStorage.removeItem(k); } catch { /* storage blocked */ }
}

// Characters made before the game had its own name were saved under 'cfo_'
// keys. Copy them across once so nobody loses a character.
function migrateOldSaves() {
  try {
    if (localStorage.getItem(INDEX) !== null) return;
    const old = JSON.parse(localStorage.getItem('cfo_chars_v1') ?? 'null');
    if (!old?.chars?.length) return;
    for (const c of old.chars) {
      const data = localStorage.getItem('cfo_char_' + c.id);
      if (data !== null) localStorage.setItem(KEY(c.id), data);
      c.zone = (c.zone ?? '').replace('Cottonvale', 'Goldmeadow').replace('Cotton Coast', 'Gullsand Coast');
    }
    localStorage.setItem(INDEX, JSON.stringify(old));
  } catch { /* storage blocked */ }
}
migrateOldSaves();

export function listChars() { return read(INDEX)?.chars ?? []; }
export function lastCharId() { return read(INDEX)?.last ?? null; }
export function loadChar(id) { return read(KEY(id)); }
export function deleteChar(id) {
  const idx = read(INDEX) ?? { chars: [] };
  idx.chars = idx.chars.filter((c) => c.id !== id);
  write(INDEX, idx);
  remove(KEY(id));
}
export function storageWorks() {
  try { localStorage.setItem('wov_probe', '1'); localStorage.removeItem('wov_probe'); return true; } catch { return false; }
}

export function serialize(p) {
  const cds = {};
  for (const k of ['hearth', 'cd:potion', 'cd:stone']) if ((p.cooldowns[k] ?? 0) > G.time) cds[k] = p.cooldowns[k] - G.time;
  return {
    v: 1, id: p.saveId, name: p.name, cls: p.cls, look: p.look, level: p.level, xp: p.xp, rested: p.rested ?? 0, money: p.money,
    pos: p.ghost && p.corpse ? { x: p.corpse.x, z: p.corpse.z } : { x: p.pos.x, z: p.pos.z }, facing: p.facing,
    inDungeon: p.pos.x > 950, bind: p.bind, hp: p.dead || p.ghost ? 0 : Math.round(p.hp), mana: Math.round(p.mana), deadOnSave: !!(p.dead || p.ghost),
    bags: p.bags, equip: p.equip, spells: p.spells, talents: p.talents, bar: p.bar, bar2: p.bar2,
    quests: p.quests, explored: p.explored, flightPoints: p.flightPoints, untracked: p.untracked ?? {},
    data: { petInfo: p.data.petInfo, petDead: p.data.petDead, demonNames: p.data.demonNames, lastDemon: p.data.lastDemon },
    petOut: !!p.pet && !p.pet.dead, demonOut: p.pet?.data?.demon ?? null, party: G.party.map((c) => c.hireId),
    cooldowns: cds, settings: G.settings, played: (p.played ?? 0) + (G.time - (p.sessionStart ?? 0)),
  };
}
export function saveChar(p) {
  if (!p?.saveId) return false;
  const data = serialize(p);
  const ok = write(KEY(p.saveId), data);
  const idx = read(INDEX) ?? { chars: [] };
  const entry = { id: p.saveId, name: p.name, cls: p.cls, level: p.level, zone: G.subzone ?? G.zoneName ?? '', updated: Date.now() };
  const i = idx.chars.findIndex((c) => c.id === p.saveId);
  if (i >= 0) idx.chars[i] = entry; else idx.chars.push(entry);
  idx.last = p.saveId;
  write(INDEX, idx);
  return ok;
}
export function newSaveId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
