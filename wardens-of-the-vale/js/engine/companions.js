// Hired sellswords that form a party with the player: a tank, a healer and damage dealers.
import { G, emit } from '../state.js';
import { Unit } from './unit.js';
import { buildModel, characterSpec } from './appearance.js';
import { canAttack, distance, inMeleeRange, rangeTo, engage } from './combat.js';
import { castAbility, checkCast, rankData, ABILITIES, knownRank } from './spells.js';
import { steerTowards } from './ai.js';
import { setStance } from './summons.js';
import { VENDOR_ITEMS } from '../data/items.js';
import { rand } from '../util.js';

export const HIRELINGS = [
  { id: 'garrett', name: 'Brother Garrett', cls: 'warrior', role: 'Tank', look: { skin: 2, hairColor: 1, hairStyle: 0 }, weapon: 'sword', shield: true },
  { id: 'lysa', name: 'Sister Lysa', cls: 'priest', role: 'Healer', look: { skin: 0, hairColor: 3, hairStyle: 1 }, weapon: 'staff' },
  { id: 'penn', name: 'Arcanist Penn', cls: 'mage', role: 'Damage', look: { skin: 1, hairColor: 5, hairStyle: 0 }, weapon: 'staff' },
  { id: 'vex', name: 'Vesper Quickblade', cls: 'rogue', role: 'Damage', look: { skin: 3, hairColor: 0, hairStyle: 2 }, weapon: 'dagger', offhand: 'dagger' },
];

function gearFor(h, level) {
  const tier = level >= 16 ? 16 : level >= 10 ? 10 : 4;
  const type = h.cls === 'warrior' ? 'mail' : h.cls === 'rogue' ? 'leather' : 'cloth';
  const eq = {};
  for (const slot of ['chest', 'legs', 'feet', 'hands', 'waist', 'wrist', 'head', 'shoulder']) eq[slot] = { id: `v_${type}_${slot}_${tier}` };
  eq.mainhand = { id: `v_${h.weapon}_${tier}` };
  if (h.shield) eq.offhand = { id: `v_shield_${tier}` };
  if (h.offhand) eq.offhand = { id: `v_${h.offhand}_${tier}` };
  return eq;
}

export function hire(hId) {
  const p = G.player;
  const h = HIRELINGS.find((x) => x.id === hId);
  if (!h || G.party.some((c) => c.hireId === hId)) return;
  if (G.party.length >= 4) { emit('error', 'Your party is full.'); return; }
  const u = new Unit({ kind: 'companion', name: h.name, level: p.level, cls: h.cls, faction: 'player', x: p.pos.x + rand(-2, 2), z: p.pos.z + rand(-2, 2), radius: 0.5 });
  u.hireId = h.id;
  u.role = h.role;
  u.look = h.look;
  u.equip = gearFor(h, p.level);
  u.spells = {};
  for (const ab of Object.values(ABILITIES)) {
    if (ab.cls !== h.cls || ab.talent) continue;
    const ranks = ab.ranks ?? [{ lvl: ab.learn ?? 1 }];
    let r = 0;
    ranks.forEach((rk, i) => { if ((rk.lvl ?? 1) <= p.level) r = i + 1; });
    if (r) u.spells[ab.id] = r;
  }
  u.powerType = h.cls === 'warrior' ? 'rage' : h.cls === 'rogue' ? 'energy' : 'mana';
  u.gcdDur = h.cls === 'rogue' ? 1 : 1.5;
  u.data = {};
  // seasoned sellswords: sturdier and better supplied than fresh recruits
  const vet = {
    Tank: { pct: { maxHp: 0.35, armor: 0.4 }, mods: { threat: 0.3, dodge: 4, parry: 3 } },
    Healer: { pct: { maxMana: 0.7, maxHp: 0.15 }, mods: { healDone: 0.2 } },
    Damage: { pct: { maxMana: 0.3, maxHp: 0.15 }, mods: { dmgDone: 0.12 } },
  }[h.role];
  u.addAura({ id: 'veteran', name: 'Veteran Sellsword', icon: 'shield', dur: Infinity, persistDead: true, hidden: true, ...vet }, u);
  u.mods = { castRegen: h.role === 'Healer' ? 0.5 : 0.15 };
  u.recalc();
  u.hp = u.maxHp;
  u.mana = u.maxMana;
  u.setModel(buildModel(characterSpec(u)));
  u.addToScene();
  if (h.cls === 'warrior') setStance(u, p.level >= 10 ? 'defensive' : 'battle');
  G.party.push(u);
  emit('partyChanged');
  emit('system', `${h.name} joins your party.`);
}
export function dismiss(u) {
  const i = G.party.indexOf(u);
  if (i < 0) return;
  G.party.splice(i, 1);
  for (const m of G.units) m.threat?.delete(u);
  u.removeFromScene();
  emit('partyChanged');
}
export function syncPartyLevels() {
  const p = G.player;
  for (const c of [...G.party]) {
    if (c.level !== p.level) { const id = c.hireId; dismiss(c); hire(id); }
  }
}

// ---------- behaviour ----------
function partyMembers() { return [G.player, ...G.party].filter((u) => u && !u.dead && !u.ghost); }
function enemiesOfParty() {
  const set = new Set();
  const members = [G.player, ...G.party, G.player?.pet].filter(Boolean);
  for (const m of G.units) {
    if (m.dead || !m.threat || !m.inCombat) continue;
    for (const x of members) if (m.threat.has(x)) { set.add(m); break; }
  }
  return [...set];
}
function tryCast(u, id, t) {
  if (!u.spells[id]) return false;
  const ab = ABILITIES[id];
  const rd = rankData(ab, u.spells[id]);
  if (checkCast(u, ab, rd, t ?? u, {})) return false;
  return castAbility(u, id, t);
}

export function updateCompanion(u, dt) {
  const p = G.player;
  if (!p) return;
  if (u.dead) {
    u.moving = 0;
    // sellswords pick themselves up once the fighting stops
    if (!enemiesOfParty().length && !p.dead) {
      u.reviveAt ??= performance.now() + 8000;
      if (performance.now() > u.reviveAt) { u.dead = false; u.hp = u.maxHp * 0.4; u.mana = u.maxMana * 0.4; u.reviveAt = null; emit('say', { unit: u, text: 'Still breathing. Let\'s go.' }); }
    }
    return;
  }
  if (u.hasFlag('fear')) { G.fearMove?.(u, dt); return; }
  if (!u.canAct()) { u.moving = 0; return; }
  if (u.level !== p.level) return;
  const enemies = enemiesOfParty();
  if (u.cast) { u.moving = 0; return; }
  const role = u.role;
  if (u.cls === 'priest') return healer(u, dt, enemies);
  if (!enemies.length) { u.autoAttack = false; u.target = null; buffs(u); return follow(u, dt); }
  if (role === 'Tank') return tank(u, dt, enemies);
  return dps(u, dt, enemies);
}

function follow(u, dt) {
  const p = G.player;
  const idx = G.party.indexOf(u);
  const side = p.facing + Math.PI + (idx - 1.5) * 0.6;
  const fx = p.pos.x + Math.sin(side) * 3.2, fz = p.pos.z + Math.cos(side) * 3.2;
  const d = Math.hypot(fx - u.pos.x, fz - u.pos.z);
  if (distance(u, p) > 60) { u.pos.x = p.pos.x; u.pos.z = p.pos.z; }
  if (d > 1.5) steerTowards(u, fx, fz, Math.max(p.speed() * 1.05, d > 10 ? 10 : 7), dt, 1);
  else { u.moving = 0; u.facing = p.facing; }
  // drink or eat between fights
  if (!u.inCombat && !p.inCombat && u.moving === 0) {
    if (u.maxMana && u.mana < u.maxMana * 0.9) u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.06 * dt);
    if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05 * dt);
  }
}
function buffs(u) {
  if (u.inCombat) return;
  const members = partyMembers();
  if (u.cls === 'mage') for (const m of members) if (!m.hasAura('arcane_intellect') && m.maxMana) { if (tryCast(u, 'arcane_intellect', m)) return; }
  if (u.cls === 'warrior' && !u.hasAura('battle_shout') && u.rage >= 10) tryCast(u, 'battle_shout');
}
function pickTarget(u, enemies) {
  const p = G.player;
  if (p.target && enemies.includes(p.target)) return p.target;
  return enemies.sort((a, b) => distance(u, a) - distance(u, b))[0];
}

function tank(u, dt, enemies) {
  // grab anything that is not attacking the tank
  const loose = enemies.find((e) => e.target && e.target !== u && e.target.kind !== 'pet' && !e.hasAura('taunt'));
  let t = u.target && enemies.includes(u.target) && !u.target.dead ? u.target : null;
  if (loose && (!t || t.target === u)) t = loose;
  if (!t) t = pickTarget(u, enemies);
  u.target = t;
  u.autoAttack = true;
  if (!inMeleeRange(u, t)) { steerTowards(u, t.pos.x, t.pos.z, u.speed(), dt, u.radius + t.radius + 1.2); if (!u.inCombat || !t.threat?.has(u)) engage(t, u); return; }
  u.moving = 0;
  u.faceTowards(t);
  if (u.level >= 10 && u.stance !== 'defensive') { tryCast(u, 'defensive_stance'); return; }
  if (t.target !== u && t.target) { if (tryCast(u, 'taunt', t)) return; if (tryCast(u, 'mocking_blow', t)) return; }
  if (enemies.filter((e) => distance(e, u) < 8).length >= 2 && tryCast(u, 'thunder_clap')) return;
  if (tryCast(u, 'revenge', t)) return;
  if (u.hp < u.maxHp * 0.6 && tryCast(u, 'shield_block')) return;
  if (t.cast && tryCast(u, 'shield_bash', t)) return;
  if (u.rage < 15 && tryCast(u, 'bloodrage')) return;
  const sunder = t.getAura?.('sunder_armor');
  if ((!sunder || sunder.stacks < 5 || sunder.remaining < 8) && tryCast(u, 'sunder_armor', t)) return;
  if (!u.hasAura('battle_shout') && tryCast(u, 'battle_shout')) return;
  if (u.rage > 40 && !u.queued) castAbility(u, 'heroic_strike', t);
  if (u.stance === 'battle' && !t.hasAura('rend') && tryCast(u, 'rend', t)) return;
}

function dps(u, dt, enemies) {
  const t = pickTarget(u, enemies);
  if (!t) return;
  u.target = t;
  if (u.cls === 'mage') {
    u.autoAttack = false;
    if (rangeTo(u, t) > 28) { steerTowards(u, t.pos.x, t.pos.z, u.speed(), dt, 25); return; }
    u.moving = 0;
    u.faceTowards(t);
    const close = enemies.filter((e) => distance(e, u) < 8 && e.target === u);
    if (close.length && tryCast(u, 'frost_nova')) return;
    if (u.mana < u.maxMana * 0.1) { tryCast(u, 'shoot', t); return; }
    if (tryCast(u, 'fire_blast', t)) return;
    if (enemies.filter((e) => distance(e, u) < 9).length >= 3 && tryCast(u, 'arcane_explosion')) return;
    if (tryCast(u, 'frostbolt', t)) return;
    tryCast(u, 'fireball', t);
    return;
  }
  // rogue
  u.autoAttack = true;
  if (!inMeleeRange(u, t)) {
    // circle behind the target when possible
    const behind = t.facing + Math.PI;
    steerTowards(u, t.pos.x + Math.sin(behind) * 1.5, t.pos.z + Math.cos(behind) * 1.5, u.speed(), dt, 0.5);
    return;
  }
  u.moving = 0;
  u.faceTowards(t);
  if (t.cast && tryCast(u, 'kick', t)) return;
  if (u.comboPoints >= 2 && !u.hasAura('slice_and_dice') && tryCast(u, 'slice_and_dice')) return;
  if (u.comboPoints >= 4 && tryCast(u, 'eviscerate', t)) return;
  if (tryCast(u, 'backstab', t)) return;
  tryCast(u, 'sinister_strike', t);
}

function healer(u, dt, enemies) {
  const members = partyMembers();
  const hurt = members.filter((m) => m.hp < m.maxHp * 0.95).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const low = hurt[0];
  const tankU = G.party.find((c) => c.role === 'Tank' && !c.dead);
  if (low && low.hp < low.maxHp * 0.85) {
    if (rangeTo(u, low) > 36) { steerTowards(u, low.pos.x, low.pos.z, u.speed(), dt, 30); return; }
    u.moving = 0;
    const frac = low.hp / low.maxHp;
    if (frac < 0.45 && !low.hasAura('weakened_soul') && low.inCombat && tryCast(u, 'pw_shield', low)) return;
    if (frac < 0.4 && tryCast(u, 'flash_heal', low)) return;
    if (frac < 0.55 && tryCast(u, 'heal', low)) return;
    if (frac < 0.7 && tryCast(u, 'lesser_heal', low)) return;
    if (!low.hasAura('renew') && tryCast(u, 'renew', low)) return;
  }
  if (tankU && tankU.inCombat && !tankU.hasAura('weakened_soul') && tankU.hp < tankU.maxHp * 0.8 && tryCast(u, 'pw_shield', tankU)) return;
  if (!enemies.length) {
    for (const m of members) if (!m.hasAura('pw_fortitude') && tryCast(u, 'pw_fortitude', m)) return;
    if (!u.hasAura('inner_fire') && tryCast(u, 'inner_fire')) return;
    return follow(u, dt);
  }
  // stay behind the fight
  const t = pickTarget(u, enemies);
  if (t && distance(u, t) < 12) {
    const a = Math.atan2(u.pos.x - t.pos.x, u.pos.z - t.pos.z);
    steerTowards(u, t.pos.x + Math.sin(a) * 18, t.pos.z + Math.cos(a) * 18, u.speed(), dt, 1);
    return;
  }
  u.moving = 0;
  if (t && u.mana > u.maxMana * 0.6 && !t.hasAura('shadow_word_pain') && rangeTo(u, t) < 30 && tryCast(u, 'shadow_word_pain', t)) return;
  if (t && u.mana > u.maxMana * 0.7 && rangeTo(u, t) < 30) tryCast(u, 'smite', t);
}
void knownRank;
