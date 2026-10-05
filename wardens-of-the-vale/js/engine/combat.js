// Damage, healing, hit tables and threat, modelled on the classic formulas.
import { G, emit } from '../state.js';
import { clamp, angleTo, normAngle, chance } from '../util.js';

export const SCHOOL_COLORS = {
  physical: '#ffffff', holy: '#ffe680', fire: '#ff8040', nature: '#80ff60', frost: '#80c8ff', shadow: '#c080ff', arcane: '#ff90ff',
};

// Rage conversion value from the original client.
export const rageConv = (L) => 0.0091107836 * L * L + 3.225598133 * L + 4.2652911;
export function armorDR(armor, attackerLevel) {
  const a = Math.max(0, armor);
  return clamp(a / (a + 400 + 85 * attackerLevel), 0, 0.75);
}

export function isBehind(attacker, target) {
  const a = angleTo(target.pos, attacker.pos);
  return Math.abs(normAngle(a - target.facing)) > Math.PI * 0.6;
}
export function isInFront(viewer, other, arc = Math.PI / 2) {
  const a = angleTo(viewer.pos, other.pos);
  return Math.abs(normAngle(a - viewer.facing)) <= arc;
}
export function distance(a, b) {
  return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
}
// edge-to-edge distance, which is what ranges are measured against
export function rangeTo(a, b) {
  return Math.max(0, distance(a, b) - (a.radius ?? 0.5) - (b.radius ?? 0.5));
}
export function meleeRange(a, b) {
  return Math.max(5, (a.radius ?? 0.5) + (b.radius ?? 0.5) + 2.6) - (a.radius ?? 0.5) - (b.radius ?? 0.5);
}
export function inMeleeRange(a, b) {
  return distance(a, b) <= Math.max(5, (a.radius ?? 0.5) + (b.radius ?? 0.5) + 2.6) + 0.5;
}

// Factions: the player side ('player' and town 'friendly'), 'hostile' mobs
// and 'neutral' wildlife that only fights back.
const side = (f) => (f === 'player' || f === 'friendly' ? 'A' : f === 'hostile' ? 'H' : 'N');
export function canAttack(a, b) {
  if (!a || !b || b.dead || a === b || b.ghost || a.ghost || b.flying || a.flying) return false;
  if (b.kind === 'npc' && !b.guard && !b.attackable) return false;
  if (a.kind === 'npc' && !a.guard && !a.attackable) return false;
  return side(a.faction) !== side(b.faction);
}
// Would `a` start a fight with `b` on sight?
export function hostile(a, b) {
  if (!canAttack(a, b)) return false;
  if (a.faction === 'neutral') return a.threat?.size > 0;
  return true;
}
export function friendly(a, b) {
  if (!a || !b) return false;
  return side(a.faction) === side(b.faction);
}

function levelDiff(att, def) { return (def.level ?? 1) - (att.level ?? 1); }

// One-roll melee attack table: miss, dodge, parry, block, crit, hit.
export function meleeRoll(att, def, opts = {}) {
  const dL = levelDiff(att, def);
  const st = att.stats, ds = def.stats;
  let miss = 5 + Math.max(0, dL) * 1.2 - Math.max(0, -dL) * 0.6 - (st.hit ?? 0);
  if (opts.white && att.dualWielding()) miss += 19;
  if (def.isIncapacitated?.() ) miss = 0;
  miss = Math.max(opts.white ? 0 : 0, miss);
  const front = !isBehind(att, def);
  let dodge = opts.noDodge || def.isIncapacitated?.() ? 0 : Math.max(0, (ds.dodge ?? 5) + dL * 0.5);
  let parry = opts.noParry || !front || !def.canParry || def.isIncapacitated?.() ? 0 : Math.max(0, (ds.parry ?? 5) + dL * 0.5);
  let block = opts.noBlock || !front || !def.canBlock?.() || def.isIncapacitated?.() ? 0 : Math.max(0, ds.block ?? 0);
  let crit = Math.max(0, (st.crit ?? 5) + (opts.critBonus ?? 0) - Math.max(0, dL) * 1.0);
  if (def.forceCritTaken) crit = 100;
  let r = Math.random() * 100;
  if ((r -= miss) < 0) return 'miss';
  if ((r -= dodge) < 0) return 'dodge';
  if ((r -= parry) < 0) return 'parry';
  if ((r -= block) < 0) {
    // blocked hits can still crit in classic; keep it simple
    return 'block';
  }
  if ((r -= crit) < 0) return 'crit';
  return 'hit';
}

export function rangedRoll(att, def, opts = {}) {
  const dL = levelDiff(att, def);
  let miss = 5 + Math.max(0, dL) * 1.2 - (att.stats.hit ?? 0);
  let dodge = opts.noDodge ? 0 : Math.max(0, (def.stats.dodge ?? 5) * 0.5);
  const crit = Math.max(0, (att.stats.rcrit ?? att.stats.crit ?? 5) + (opts.critBonus ?? 0) - Math.max(0, dL));
  let r = Math.random() * 100;
  if ((r -= miss) < 0) return 'miss';
  if ((r -= dodge) < 0) return 'dodge';
  if ((r -= crit) < 0) return 'crit';
  return 'hit';
}

export function spellMissChance(caster, target) {
  const dL = levelDiff(caster, target);
  let m = dL <= 2 ? 4 + Math.max(dL, -3) : 17 + (dL - 3) * 11;
  m -= caster.stats.shit ?? 0;
  return clamp(m, 1, 99);
}
export function spellRoll(caster, target, school, opts = {}) {
  if (friendly(caster, target)) return Math.random() * 100 < (caster.stats.scrit ?? 0) + (opts.critBonus ?? 0) ? 'crit' : 'hit';
  if (Math.random() * 100 < spellMissChance(caster, target)) return 'resist';
  const res = target.stats.res?.[school] ?? 0;
  if (res > 0 && Math.random() < res / (res + caster.level * 5) * 0.75) return 'resist';
  const crit = (caster.stats.scrit ?? 0) + (opts.critBonus ?? 0) + (caster.mods?.schoolCrit?.[school] ?? 0);
  return Math.random() * 100 < crit ? 'crit' : 'hit';
}

// Weapon swing damage including attack power, as in classic: AP/14 * speed.
export function weaponDamage(u, hand = 'mh', normalized = false) {
  const w = u.weapon(hand);
  const base = w.min + Math.random() * (w.max - w.min);
  const ap = hand === 'ranged' ? u.stats.rap : u.stats.ap;
  const speed = normalized ? (w.twoHand ? 3.3 : w.type === 'dagger' ? 1.7 : 2.4) : w.speed;
  let dmg = base + (Math.max(0, ap) / 14) * speed;
  if (hand === 'oh') dmg *= 0.5 + (u.mods?.offhandPct ?? 0);
  return dmg;
}

// ---------- threat ----------
export function addThreat(mob, who, amount) {
  if (!mob || mob.dead || !mob.threat || !who || who.dead) return;
  if (who.kind === 'npc' && !who.guard) return;
  if (mob.evading) return;
  const t = (mob.threat.get(who) ?? 0) + amount;
  mob.threat.set(who, Math.max(0, t));
  if (!mob.inCombat) mob.enterCombat?.(who);
  who.setInCombat?.();
}
export function engage(mob, who) {
  if (!mob || mob.dead || !mob.threat || mob.evading) return;
  if (!mob.threat.has(who)) mob.threat.set(who, 0.01);
  mob.enterCombat?.(who);
  who.setInCombat?.();
  if (who.owner) who.owner.setInCombat?.();
}

// ---------- damage ----------
export function dealDamage(src, tgt, amount, opts = {}) {
  if (!tgt || tgt.dead) return 0;
  const school = opts.school ?? 'physical';
  if (tgt.evading) { emit('combatText', { unit: tgt, text: 'Evade', kind: 'miss', src }); return 0; }
  if (tgt.hasFlag?.('immune') || (school === 'physical' && tgt.hasFlag?.('immunePhys'))) {
    emit('combatText', { unit: tgt, text: 'Immune', kind: 'miss', src }); return 0;
  }
  let dmg = amount;
  if (src && !src.dead) {
    dmg *= 1 + (src.stats?.dmgDone ?? 0) + (src.mods?.schoolDmg?.[school] ?? 0);
    if (opts.ability) dmg *= 1 + (src.mods?.spellDmg?.[opts.ability] ?? 0);
    if (src.kind === 'pet' && src.owner?.mods?.petDmg) dmg *= 1 + src.owner.mods.petDmg;
  }
  dmg *= 1 + (tgt.stats?.dmgTaken ?? 0) + (tgt.stats?.schoolTaken?.[school] ?? 0);
  if (school === 'physical' && !opts.ignoreArmor) {
    dmg *= 1 - armorDR(tgt.stats.armor * (1 - (opts.armorPen ?? 0)), src?.level ?? tgt.level);
    if (!opts.periodic) dmg -= tgt.stats.physReduce ?? 0;
  } else if (school !== 'physical' && !opts.periodic) {
    // flat damage reduction from things like Stoneskin only applies to physical
  }
  if (opts.blocked) dmg = Math.max(0, dmg - (tgt.stats.blockValue ?? 0));
  dmg = Math.max(opts.blocked ? 0 : 1, Math.round(dmg));
  // absorbs
  let absorbed = 0;
  for (const a of tgt.auras) {
    if (dmg <= 0) break;
    if (a.absorb > 0 && (!a.absorbSchool || a.absorbSchool === school || (a.absorbSchool === 'magic' && school !== 'physical'))) {
      const take = Math.min(a.absorb, dmg);
      if (a.manaShield) {
        const manaCost = take * 2;
        if (tgt.mana < manaCost) continue;
        tgt.mana -= manaCost;
      }
      a.absorb -= take; dmg -= take; absorbed += take;
      if (a.absorb <= 0) a.remaining = 0;
    }
  }
  if (src) { src.setInCombat?.(); src.lastHitAt = G.time; }
  tgt.setInCombat?.();
  const overkill = Math.max(0, dmg - tgt.hp);
  tgt.hp -= dmg;
  tgt.lastDamagedAt = G.time;
  // rage from taking damage
  if (tgt.powerType === 'rage' && dmg > 0) tgt.addRage(dmg / rageConv(tgt.level) * 2.5);
  // rage from white hits
  if (src && src.powerType === 'rage' && opts.white && dmg > 0) src.addRage(dmg / rageConv(src.level) * 7.5 * (opts.hand === 'oh' ? 0.5 : 1));
  // threat
  if (src && !opts.noThreat) {
    const real = dmg + absorbed;
    const tm = (src.stats?.threat ?? 1) * (opts.threatMul ?? 1) * (school === 'holy' ? 1 + (src.stats?.holyThreat ?? 0) : 1);
    // totems have no threat of their own: the shaman who planted them takes it
    const threatSrc = src.kind === 'totem' && src.owner ? src.owner : src;
    if (tgt.threat) addThreat(tgt, threatSrc, real * tm + (opts.bonusThreat ?? 0));
  }
  if (tgt.kind === 'player' && src?.threat && !src.threat.has(tgt)) engage(src, tgt);
  // casting pushback
  if (tgt.cast && dmg > 0 && !opts.noPushback) tgt.pushback?.();
  // crowd control that breaks on damage
  if (dmg > 0 || absorbed > 0) tgt.onDamaged?.(dmg, src, opts);
  // reactive procs (Thorns, Lightning Shield, Frost Armor, Retribution Aura)
  if (opts.melee && src && !src.dead) {
    for (const a of [...tgt.auras]) if (a.onStruck) a.onStruck(a, src, dmg);
  }
  emit('damage', { src, tgt, amount: dmg, absorbed, school, crit: opts.crit, periodic: opts.periodic, ability: opts.abilityName, blocked: opts.blocked, white: opts.white });
  if (tgt.hp <= 0) {
    tgt.hp = 0;
    if (tgt.preventDeath?.()) return dmg;
    killUnit(tgt, src, overkill);
  }
  return dmg;
}

export function heal(src, tgt, amount, opts = {}) {
  if (!tgt || tgt.dead) return 0;
  let h = amount * (1 + (src?.stats?.healDone ?? 0)) * (1 + (tgt.stats?.healTaken ?? 0));
  if (opts.ability && src?.mods?.healPct?.[opts.ability]) h *= 1 + src.mods.healPct[opts.ability];
  h = Math.round(h);
  const eff = Math.min(h, tgt.maxHp - tgt.hp);
  tgt.hp = Math.min(tgt.maxHp, tgt.hp + h);
  emit('heal', { src, tgt, amount: h, effective: eff, crit: opts.crit, periodic: opts.periodic, ability: opts.abilityName });
  // healing threat: half the effective heal, split among mobs fighting the healed unit
  if (src && eff > 0 && !opts.noThreat) {
    const mobs = G.units.filter((m) => m.threat && m.inCombat && !m.dead && (m.threat.has(tgt) || m.threat.has(src)));
    if (mobs.length) {
      const per = (eff * 0.5 * (src.stats?.threat ?? 1)) / mobs.length;
      for (const m of mobs) addThreat(m, src, per);
    }
  }
  return eff;
}

export function killUnit(u, killer, overkill = 0) {
  if (u.dead) return;
  u.dead = true;
  u.hp = 0;
  u.cast = null;
  u.autoAttack = false;
  u.autoShot = false;
  u.queued = null;
  u.onDeath?.(killer);
  const credit = killer?.owner ?? killer;
  if (credit) for (const a of [...credit.auras]) a.onKill?.(a, u);
  emit('death', { unit: u, killer, overkill });
}

// Every unit involved in a fight with `u`.
export function enemiesOf(u, radius = 40) {
  return G.units.filter((o) => !o.dead && o !== u && canAttack(u, o) && distance(u, o) <= radius);
}
export function alliesOf(u, radius = 40) {
  return G.units.filter((o) => !o.dead && friendly(u, o) && o.kind !== 'npc' && distance(u, o) <= radius);
}
export function unitsNear(x, z, r, filter) {
  const out = [];
  for (const o of G.units) {
    if (o.dead) continue;
    if (Math.hypot(o.pos.x - x, o.pos.z - z) - (o.radius ?? 0.5) <= r && (!filter || filter(o))) out.push(o);
  }
  return out;
}

export { chance };
