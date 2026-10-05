// Stances, shapeshifts, pets, totems, traps and movement abilities.
import * as THREE from '../lib/three.module.min.js';
import { G, emit } from '../state.js';
import { Unit } from './unit.js';
import { buildModel, refreshCharacterModel } from './appearance.js';
import { MOBS } from '../data/mobs.js';
import { canAttack, distance, inMeleeRange, engage, addThreat } from './combat.js';
import { heightAt } from './terrain.js';
import * as fx from './fx.js';

// ---------- warrior stances ----------
const STANCES = {
  battle: { name: 'Battle Stance', icon: 'swords', mods: {} },
  defensive: { name: 'Defensive Stance', icon: 'shield', mods: { dmgDone: -0.1, dmgTaken: -0.1, threat: 0.3 } },
};
export function setStance(u, stance) {
  if (u.stance === stance && u.hasAura('stance_' + stance)) return;
  u.removeAurasWhere((a) => a.group === 'stance');
  const s = STANCES[stance];
  u.addAura({ id: 'stance_' + stance, name: s.name, icon: s.icon, dur: Infinity, group: 'stance', mods: s.mods, stance: true }, u);
  u.stance = stance;
  u.rage = Math.min(u.rage, (u.mods?.tacticalMastery ?? 0) * 5);
  emit('stance', { unit: u });
}

// ---------- druid and shaman forms ----------
export function setForm(u, form) {
  const prev = u.form;
  if (prev === form) return;
  u.removeAurasWhere((a) => a.group === 'form');
  // shapeshifting breaks roots and snares
  if (form) u.removeAurasWhere((a) => a.debuff && (a.flags?.root || (a.mods?.speed ?? 0) < 0));
  if (u.hasFlag('stealth')) u.breakStealth();
  u.form = form;
  u.comboPoints = 0;
  if (form === 'bear') { u.powerType = 'rage'; u.rage = Math.random() < (u.mods?.furor ?? 0) ? 10 : 0; }
  else if (form === 'cat') { u.powerType = 'energy'; u.energy = Math.random() < (u.mods?.furor ?? 0) ? 40 : 0; }
  else u.powerType = u.cls === 'druid' || u.cls === 'shaman' ? 'mana' : u.powerType;
  if (form === 'ghostwolf') u.addAura({ id: 'ghost_wolf', name: 'Ghost Wolf', icon: 'wolf', dur: Infinity, group: 'form', mods: { speed: 0.4 } }, u);
  if (form === 'bear') u.addAura({ id: 'bear_form', name: 'Bear Form', icon: 'bear', dur: Infinity, group: 'form' }, u);
  if (form === 'cat') u.addAura({ id: 'cat_form', name: 'Cat Form', icon: 'cat', dur: Infinity, group: 'form' }, u);
  u.gcdDur = form === 'cat' ? 1.0 : 1.5;
  u.autoAttack = u.autoAttack && form !== 'ghostwolf';
  u.recalc();
  refreshCharacterModel(u);
  fx.rise(u, form === 'ghostwolf' ? 0x80c0ff : 0x80ff60, 16);
  emit('form', { unit: u });
}
export function cancelForm(u) { setForm(u, null); }

// ---------- movement ----------
export function dash(u, t, speed, onArrive) {
  u.dash = { target: t, speed, onArrive, until: G.time + 2.5 };
}
export function updateDash(u, dt) {
  const d = u.dash;
  if (!d) return false;
  const t = d.target;
  if (!t || t.dead || G.time > d.until || u.isIncapacitated?.()) { u.dash = null; return false; }
  if (inMeleeRange(u, t)) {
    u.dash = null;
    d.onArrive?.();
    return true;
  }
  u.faceTowards(t);
  const step = d.speed * dt;
  const dist = distance(u, t);
  const k = Math.min(step, dist - 1.5) / dist;
  if (!u.moveBy((t.pos.x - u.pos.x) * k, (t.pos.z - u.pos.z) * k)) { u.dash = null; return false; }
  u.moving = d.speed;
  return true;
}
export function blink(u, dist) {
  const dx = Math.sin(u.facing), dz = Math.cos(u.facing);
  for (let i = 0; i < dist; i += 0.5) if (!u.moveBy(dx * 0.5, dz * 0.5)) break;
  fx.burst({ x: u.pos.x, y: u.y + 1, z: u.pos.z }, 0xff90ff, 20, 4);
}

// ---------- crowd control helpers ----------
export function fear(src, t, dur) {
  if (t.boss) { emit('combatText', { unit: t, text: 'Immune', kind: 'miss', src }); return; }
  t.addAura({ id: 'fear', name: 'Fear', icon: 'fear', dur, debuff: true, flags: { fear: true }, damageCap: t.maxHp * 0.15, fearDir: Math.random() * Math.PI * 2 }, src);
  if (t.threat) engage(t, src);
  fx.at(t, 0x9040d0, 10);
}
export function taunt(t, u, dur, mocking) {
  if (!t.threat) return;
  let max = 0;
  for (const v of t.threat.values()) max = Math.max(max, v);
  if (!mocking) t.threat.set(u, Math.max(t.threat.get(u) ?? 0, max));
  t.addAura({ id: 'taunt', name: mocking ? 'Mocking Blow' : 'Taunt', icon: 'shout', dur, debuff: true, tauntedBy: u }, u);
  t.target = u;
  engage(t, u);
}

// ---------- pets ----------
const DEMONS = {
  imp: {
    name: 'Imp', creature: 'demon', hp: 0.5, dmg: 0.35, armor: 0.5, petHp: 1, apShare: 0.05, caster: true, mana: true, radius: 0.4, abilities: ['p_firebolt'], blood: true,
    m: { t: 'human', skin: 0xc04a2a, headColor: 0xc04a2a, shirt: 0xc04a2a, pants: 0x7a2a1a, boots: 0x4a1a0a, bareArms: true, scale: 0.55, horns: 0x2a1a1a, tail: 0xc04a2a, eyes: 0xffd040, ears: 'long', glow: 0xff6020 },
  },
  voidwalker: {
    name: 'Voidwalker', creature: 'demon', hp: 1.4, dmg: 0.65, armor: 1.7, petHp: 1.15, apShare: 0.12, mana: true, radius: 0.8, abilities: ['p_torment'], extra: ['p_sacrifice'],
    m: { t: 'human', skin: 0x4a3a8a, headColor: 0x4a3a8a, shirt: 0x3a2a7a, pants: 0x3a2a7a, bareArms: true, bulk: 1.5, armBulk: 1.6, armLen: 0.95, scale: 1.25, noLegs: true, floating: true, eyes: 0xffffff, glow: 0x6040c0 },
  },
  succubus: {
    name: 'Succubus', creature: 'demon', hp: 0.95, dmg: 0.95, armor: 0.9, petHp: 1, apShare: 0.2, mana: true, radius: 0.5, abilities: ['p_lash'], extra: ['p_seduction'],
    m: { t: 'human', skin: 0xb07ab0, headColor: 0xb07ab0, shirt: 0x2a1a2a, pants: 0x2a1a2a, boots: 0x1a0a1a, bareArms: true, bulk: 0.85, hair: 0x1a0a1a, hairStyle: 1, horns: 0x2a1a2a, tail: 0xb07ab0, weapon: { type: 'whip' } },
  },
};
const PET_NAMES = ['Grimbolt', 'Zhaal', 'Kraxis', 'Sizzik', 'Vorrath', 'Nyx', 'Lashka', 'Teelo'];

function makePet(owner, tpl, name, level, spec, data = {}) {
  const pet = new Unit({
    kind: 'pet', name, level, faction: 'player', tpl, creature: tpl.creature, owner,
    x: owner.pos.x - Math.sin(owner.facing) * 2 + 1, z: owner.pos.z - Math.cos(owner.facing) * 2, radius: tpl.radius ?? 0.6, data,
    model: buildModel(spec),
  });
  pet.facing = owner.facing;
  pet.petAbilities = [...(tpl.abilities ?? [])];
  pet.autocast = Object.fromEntries(pet.petAbilities.map((a) => [a, true]));
  pet.extraAbilities = [...(tpl.extra ?? [])];
  pet.powerType = tpl.mana ? 'mana' : 'energy';
  pet.recalc();
  pet.hp = pet.maxHp;
  pet.mana = pet.maxMana;
  pet.energy = 100;
  pet.order = 'follow';
  pet.addToScene();
  owner.pet = pet;
  emit('petChanged', { unit: owner });
  return pet;
}

export function summonDemon(u, kind) {
  const tpl = DEMONS[kind];
  if (u.pet) dismissPet(u, true);
  u.removeAurasWhere((a) => a.id === 'fel_domination');
  const name = u.data.demonNames?.[kind] ?? PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
  u.data.demonNames = { ...(u.data.demonNames ?? {}), [kind]: name };
  const pet = makePet(u, tpl, name, u.level, tpl.m, { demon: kind });
  fx.burst({ x: pet.pos.x, y: pet.y + 1, z: pet.pos.z }, 0x80ff40, 30, 4);
  u.data.lastDemon = kind;
  return pet;
}

export function tameBeast(u, beast) {
  if (beast.dead || u.pet) return;
  const tpl = beast.tpl;
  const info = { tplId: beast.tplId, name: tpl.name.split(' ').pop(), family: tpl.family, level: beast.level, happiness: 70 };
  // the tamed creature leaves the world and becomes a companion
  beast.tamed = true;
  beast.removeFromScene();
  for (const m of G.units) m.threat?.delete(beast);
  u.data.petInfo = info;
  u.data.petDead = false;
  callPet(u);
  emit('system', `You have tamed ${tpl.name}. It is now your companion.`);
  emit('tamed', { unit: u, family: tpl.family });
}
export function hunterPetTemplate(info) {
  const base = MOBS[info.tplId];
  const famAbilities = { cat: ['p_claw', 'p_growl'], bear: ['p_claw', 'p_growl'], bird: ['p_claw', 'p_growl'], crab: ['p_claw', 'p_growl'], boar: ['p_bite', 'p_growl'] };
  return {
    ...base, hp: (base.hp ?? 1) * 0.95, dmg: (base.dmg ?? 1) * 0.85, armor: (base.armor ?? 1) * 1.1, apShare: 0.22, petHp: 1,
    abilities: famAbilities[base.family] ?? ['p_bite', 'p_growl'], mana: false, boss: false, elite: false,
  };
}
export function callPet(u) {
  const info = u.data.petInfo;
  if (!info || u.pet) return;
  if (u.cls === 'hunter') {
    const tpl = hunterPetTemplate(info);
    const spec = { ...MOBS[info.tplId].m, scale: (MOBS[info.tplId].m.scale ?? 1) * 0.95 };
    const pet = makePet(u, tpl, info.name, u.level, spec, { happiness: info.happiness ?? 70 });
    if (info.hp !== undefined && info.hp > 0) pet.hp = Math.min(pet.maxHp, info.hp);
    return pet;
  }
}
export function dismissPet(u, silent) {
  const p = u.pet;
  if (!p) return;
  if (u.cls === 'hunter' && u.data.petInfo) {
    u.data.petInfo.happiness = Math.max(0, (p.data.happiness ?? 70) - (silent ? 0 : 20));
    u.data.petInfo.hp = p.hp;
  }
  for (const m of G.units) m.threat?.delete(p);
  p.removeFromScene();
  u.pet = null;
  emit('petChanged', { unit: u });
}
export function onPetDeath(p) {
  const u = p.owner;
  if (!u) return;
  if (u.cls === 'hunter') {
    u.data.petDead = true;
    if (u.data.petInfo) u.data.petInfo.happiness = Math.max(0, (p.data.happiness ?? 70) - 25);
  }
  setTimeout(() => { if (u.pet === p) { p.removeFromScene(); u.pet = null; emit('petChanged', { unit: u }); } }, 4000);
}
export function revivePet(u) {
  if (u.pet?.dead) { u.pet.removeFromScene(); u.pet = null; }
  u.data.petDead = false;
  const p = callPet(u);
  if (p) { p.hp = Math.round(p.maxHp * 0.15); fx.rise(p, 0x80ff80, 20); }
}
export function feedPet(u) {
  const p = u.pet;
  if (!p) return;
  u.removeItem?.('pet_food', 1);
  p.data.happiness = Math.min(100, (p.data.happiness ?? 50) + 35);
  p.addAura({ id: 'feed_pet', name: 'Feed Pet Effect', icon: 'meat', dur: 10, interval: 1, tick: (a) => { a.unit.hp = Math.min(a.unit.maxHp, a.unit.hp + a.unit.maxHp * 0.03); } }, u);
  p.dirty = true;
  emit('system', `${p.name} happily eats the food.`);
}
export function petHappinessText(p) {
  const h = p?.data?.happiness ?? 70;
  return h > 66 ? 'Happy' : h > 33 ? 'Content' : 'Unhappy';
}

// ---------- totems ----------
export function placeTotem(u, def) {
  const old = u.totems[def.element];
  if (old && !old.dead) killTotem(old);
  const a = u.facing + Math.PI * (0.5 + Object.keys(u.totems).indexOf(def.element) * 0.25);
  const t = new Unit({
    kind: 'totem', name: def.name, level: u.level, faction: 'player', creature: 'totem', owner: u, x: u.pos.x + Math.sin(a) * 1.2, z: u.pos.z + Math.cos(a) * 1.2, radius: 0.35,
    model: buildModel({ t: 'totem', color: def.color, top: def.top }),
  });
  t.maxHp = t.hp = 5 + u.level;
  t.stats = { armor: 0, dodge: 0, parry: 0, block: 0, res: {}, speed: 0 };
  t.recalc = () => {};
  t.totemDef = def;
  t.expire = G.time + def.dur;
  t.nextPulse = G.time + 0.3;
  t.addToScene();
  u.totems[def.element] = t;
  fx.burst({ x: t.pos.x, y: t.y + 1, z: t.pos.z }, def.top ?? 0xffaa33, 16, 3);
  return t;
}
export function killTotem(t) {
  if (t.removed) return;
  t.removed = true;
  t.dead = true;
  t.removeFromScene();
  for (const m of G.units) m.threat?.delete(t);
  if (t.owner && t.owner.totems[t.totemDef.element] === t) delete t.owner.totems[t.totemDef.element];
}
export function updateTotem(t) {
  const d = t.totemDef;
  if (t.dead || G.time >= t.expire || !t.owner || t.owner.dead || distance(t, t.owner) > 60) { killTotem(t); return; }
  if (G.time < t.nextPulse) return;
  t.nextPulse = G.time + d.pulse;
  if (d.buff) {
    for (const a of G.units) {
      if (a.dead || a.faction !== 'player' || a.kind === 'totem' || distance(a, t) > 20) continue;
      a.addAura({ ...d.buff, dur: d.pulse + 1.2, unique: true }, t);
    }
  }
  if (d.enemyPulse) for (const e of G.units) if (!e.dead && canAttack(t, e) && distance(e, t) <= (d.radius ?? 20)) d.enemyPulse(t, e);
  if (d.attack) {
    let best = null, bd = 21;
    for (const e of G.units) {
      if (e.dead || !canAttack(t, e) || e.kind === 'npc') continue;
      if (!e.inCombat && e.faction === 'neutral') continue;
      const dd = distance(e, t);
      if (dd < bd && (e.inCombat || e.faction === 'hostile')) { bd = dd; best = e; }
    }
    if (best) { t.faceTowards(best); d.attackFn(t, best); }
  }
  d.onPulse?.(t);
}

// ---------- hunter traps ----------
const trapGeo = new THREE.CircleGeometry(1.1, 16).rotateX(-Math.PI / 2);
export function placeTrap(u, def) {
  const old = G.traps?.find((tr) => tr.owner === u && tr.def.color === def.color);
  if (old) removeTrap(old);
  const mesh = new THREE.Mesh(trapGeo, new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.5, depthWrite: false }));
  mesh.position.set(u.pos.x, heightAt(u.pos.x, u.pos.z) + 0.1, u.pos.z);
  G.scene.add(mesh);
  G.traps ??= [];
  G.traps.push({ owner: u, x: u.pos.x, z: u.pos.z, def, mesh, expire: G.time + 60, armedAt: G.time + 2 });
}
function removeTrap(tr) {
  G.scene.remove(tr.mesh);
  G.traps.splice(G.traps.indexOf(tr), 1);
}
export function updateTraps() {
  if (!G.traps) return;
  for (const tr of [...G.traps]) {
    if (G.time > tr.expire) { removeTrap(tr); continue; }
    if (G.time < tr.armedAt) continue;
    for (const e of G.units) {
      if (e.dead || !canAttack(tr.owner, e) || e.kind === 'npc') continue;
      if (Math.hypot(e.pos.x - tr.x, e.pos.z - tr.z) < 2.6) {
        tr.def.trigger(e);
        removeTrap(tr);
        break;
      }
    }
  }
}

export { DEMONS, addThreat };
