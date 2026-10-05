// Ability registry plus the casting machinery shared by players and mobs:
// global cooldown, cast bars, channels, swing timers and next-swing attacks.
import * as THREE from '../lib/three.module.min.js';
import { G, emit } from '../state.js';
import { rand, clamp } from '../util.js';
import {
  dealDamage, heal, meleeRoll, rangedRoll, spellRoll, weaponDamage, canAttack, friendly, inMeleeRange, rangeTo,
  isBehind, distance, unitsNear, addThreat, engage,
} from './combat.js';
import { getItem } from '../data/items.js';
import { burst } from './fx.js';

export const ABILITIES = {};
export function defineAbility(def) {
  def.school ??= 'physical';
  def.target ??= 'enemy';
  def.gcd ??= true;
  ABILITIES[def.id] = def;
  return def;
}
export function rankData(ab, r = 1) {
  if (!ab.ranks) return ab;
  return { ...ab, ...ab.ranks[clamp(r, 1, ab.ranks.length) - 1], rank: r };
}
export function knownRank(u, id) {
  if (u.kind === 'player' || u.kind === 'companion') return u.spells?.[id] ?? 0;
  return 1;
}

const ERR = (u, msg) => { if (u.kind === 'player') emit('error', msg); return msg; };

export function abilityCost(u, ab, rd) {
  let cost = rd.cost ?? 0;
  if (typeof cost === 'function') cost = cost(u);
  cost += u.mods?.costFlat?.[ab.id] ?? 0;
  cost *= 1 - (u.mods?.costPct?.[ab.id] ?? 0);
  if (u.hasAura?.('clearcasting') && ab.school !== 'physical' && (rd.costType ?? defaultPower(u, ab)) === 'mana') cost = 0;
  if (u.hasAura?.('inner_focus') && (rd.costType ?? defaultPower(u, ab)) === 'mana') cost = 0;
  return Math.max(0, Math.round(cost));
}
export function defaultPower(u, ab) {
  if (ab.costType) return ab.costType;
  if (ab.form === 'bear') return 'rage';
  if (ab.form === 'cat') return 'energy';
  if (u.cls === 'warrior') return 'rage';
  if (u.cls === 'rogue') return 'energy';
  return 'mana';
}
export function castTime(u, ab, rd) {
  let t = rd.cast ?? 0;
  t += u.mods?.castTime?.[ab.id] ?? 0;
  if (ab.id.startsWith('summon_') && u.hasAura?.('fel_domination')) t -= 5.5;
  if (t > 0) t /= u.stats.castSpeed ?? 1;
  return Math.max(0, t);
}
export function abilityRange(u, ab, rd) {
  const r = rd.range ?? ab.range ?? 0;
  if (r === 'melee') return 'melee';
  return r + (u.mods?.range?.[ab.id] ?? 0);
}
export function cooldownLeft(u, ab) {
  const k = ab.cdGroup ? 'grp:' + ab.cdGroup : ab.id;
  return Math.max(0, (u.cooldowns[k] ?? 0) - G.time);
}
function setCooldown(u, ab, rd) {
  let cd = rd.cd ?? ab.cd ?? 0;
  cd += u.mods?.cd?.[ab.id] ?? 0;
  if (cd <= 0) return;
  const k = ab.cdGroup ? 'grp:' + ab.cdGroup : ab.id;
  u.cooldowns[k] = G.time + cd;
}

// Pick a sensible target for an ability, like the classic client does.
export function resolveTarget(u, ab, explicit) {
  const t = explicit ?? u.target;
  switch (ab.target) {
    case 'self': case 'none': return u;
    case 'friend':
      if (t && !t.dead && friendly(u, t) && t.kind !== 'npc') return t;
      return u;
    case 'pet': return u.pet && !u.pet.dead ? u.pet : null;
    case 'any': return t ?? u;
    case 'corpse': return t;
    default: return t;
  }
}

export function checkCast(u, ab, rd, target, opts = {}) {
  if (u.dead && !ab.whileDead) return 'You are dead.';
  if (!opts.ignoreControl) {
    if (u.isIncapacitated()) return "You can't do that right now.";
    if (u.hasFlag('silence') && ab.school !== 'physical' && !ab.ignoreSilence) return "Can't do that while silenced.";
    if (u.hasFlag('pacify') && ab.melee) return "Can't do that while pacified.";
    if (u.schoolLocked(ab.school) && ab.school !== 'physical') return `${cap(ab.school)} spells are locked out.`;
  }
  if (!opts.ignoreGcd && ab.gcd && G.time < u.gcdUntil - 0.02) return 'Ability is not ready yet.';
  if (cooldownLeft(u, ab) > 0.02) return 'Ability is not ready yet.';
  if (u.cast && !opts.fromQueue) return 'Another action is in progress.';
  if (ab.stance && !ab.stance.includes(u.stance)) return `Must be in ${ab.stance.map((s) => cap(s) + ' Stance').join(' or ')}.`;
  if (ab.form && u.form !== ab.form) return `Must be in ${cap(ab.form)} Form.`;
  if (ab.stealth && !u.hasFlag('stealth')) return 'You must be stealthed.';
  if (ab.outOfCombat && u.inCombat) return "You can't do that while in combat.";
  if (ab.weapon && u.weapon('mh').type !== ab.weapon) return `Requires ${cap(ab.weapon)}.`;
  if (ab.shield && !u.canBlockBase?.()) return 'Requires a shield.';
  if (ab.react && !(u.react[ab.react] > G.time)) return "You can't do that yet.";
  if (ab.needsPet && (!u.pet || u.pet.dead)) return 'You have no pet.';
  if (ab.petDead && (!u.pet || !u.pet.dead) && !u.data?.petDead) return 'Your pet is alive.';
  if (ab.reagent && !u.hasItem?.(ab.reagent)) return `Missing reagent: ${getItem(ab.reagent)?.name ?? ab.reagent}.`;
  if (ab.indoorsBlocked && G.player?.pos.x > 950) return "You can't use that here.";
  if (ab.usable && !ab.usable(u, target)) return ab.usableMsg ?? "You can't do that yet.";
  const ptype = defaultPower(u, ab);
  const cost = abilityCost(u, ab, rd);
  if (cost > 0 && u.resource(ptype) < cost) return ptype === 'mana' ? 'Not enough mana' : ptype === 'rage' ? 'Not enough rage' : ptype === 'energy' ? 'Not enough energy' : 'Not enough health';
  if (ab.combo && (u.comboPoints <= 0 || (!ab.comboAny && u.comboTarget !== target))) return 'That ability requires combo points.';
  if (ab.target === 'enemy') {
    if (!target) return 'You have no target.';
    if (target.dead || !canAttack(u, target)) return 'Invalid target.';
    if (ab.creature && !ab.creature.includes(target.creature)) return 'Invalid target.';
    if (ab.targetOutOfCombat && target.inCombat) return 'Target is in combat.';
    if (ab.behind && !isBehind(u, target)) return 'You must be behind your target.';
  } else if (ab.target === 'friend' || ab.target === 'pet') {
    if (!target || target.dead) return 'Invalid target.';
  }
  if (target && target !== u && (ab.target === 'enemy' || ab.target === 'friend' || ab.target === 'pet')) {
    const range = abilityRange(u, ab, rd);
    if (range === 'melee') { if (!inMeleeRange(u, target)) return 'You are too far away!'; }
    else if (range > 0) {
      const d = rangeTo(u, target);
      if (d > range) return 'Out of range.';
      if (ab.minRange && d < ab.minRange) return 'Target is too close.';
    }
  }
  if (castTime(u, ab, rd) > 0 && u.moving > 0.1 && u.kind === 'player' && !ab.castWhileMoving) return "Can't do that while moving.";
  return null;
}

export function castAbility(u, id, explicitTarget, opts = {}) {
  const ab = ABILITIES[id];
  if (!ab) return false;
  const r = opts.rank ?? knownRank(u, id);
  if (!r && !opts.free) return false;
  const rd = rankData(ab, r);
  // druids leave animal forms to cast caster spells
  if (u.form && !ab.form && !ab.anyForm && u.kind === 'player' && ab.school !== 'physical' && !ab.isForm) {
    u.cancelForm?.();
  }
  const target = resolveTarget(u, ab, explicitTarget);
  if (ab.onNextSwing) {
    // toggles a queued attack instead of firing now
    if (u.queued?.ab === ab) { u.queued = null; emit('queue', { unit: u }); return true; }
    const err = checkCast(u, ab, rd, target, { ignoreGcd: true });
    if (err && !err.startsWith('Not enough')) { ERR(u, err); return false; }
    u.queued = { ab, rd };
    if (target && canAttack(u, target)) { u.target = target; u.autoAttack = true; }
    emit('queue', { unit: u });
    return true;
  }
  const err = checkCast(u, ab, rd, target, opts);
  if (err) { ERR(u, err); return false; }
  if (target && target !== u && (ab.target === 'enemy' || ab.faceTarget)) {
    u.faceTowards(target);
    if (u.kind === 'player' && ab.melee !== false && canAttack(u, target) && ab.startsAttack !== false && !ab.noAutoAttack) {
      if (ab.melee || ab.range === 'melee') u.autoAttack = true;
    }
    if (canAttack(u, target) && u.kind === 'player') u.target = target;
  }
  if (ab.gcd) {
    let g = u.gcdDur;
    if (ab.gcdOverride) g = ab.gcdOverride;
    u.gcdUntil = G.time + g;
  }
  let ct = castTime(u, ab, rd);
  const swift = u.getAura?.('nature_swiftness');
  if (swift && ct > 0 && ct < 10 && ab.school === 'nature' && !ab.channel) { ct = 0; u.removeAura(swift, 'used'); }
  if (ct > 0 || ab.channel) {
    u.cast = {
      ability: ab, rd, target, start: G.time, total: ab.channel ? rd.channel ?? ab.channel : ct, end: G.time + (ab.channel ? rd.channel ?? ab.channel : ct),
      channel: !!ab.channel, ticks: 0, nextTick: G.time + (rd.tickEvery ?? ab.tickEvery ?? 1),
    };
    u.anim.cast = 1;
    if (ab.channel) {
      // channels pay up front and fire their opening effect
      if (!payCost(u, ab, rd)) { u.cast = null; return false; }
      setCooldown(u, ab, rd);
      ab.onChannelStart?.(ctx(u, ab, rd, target));
    }
    if (u.hasFlag('stealth') && !ab.keepStealth) u.breakStealth();
    emit('castStart', { unit: u, ability: ab });
    return true;
  }
  return execute(u, ab, rd, target);
}

function payCost(u, ab, rd) {
  const ptype = defaultPower(u, ab);
  const cost = abilityCost(u, ab, rd);
  if (cost > 0 && u.resource(ptype) < cost) { ERR(u, 'Not enough ' + ptype); return false; }
  u.spend(ptype, cost);
  if (cost > 0 && ptype === 'mana') {
    if (u.hasAura('clearcasting')) u.removeAura(u.getAura('clearcasting'));
  }
  if (ptype === 'mana' && u.hasAura('inner_focus')) u.removeAura(u.getAura('inner_focus'));
  if (ab.reagent) u.removeItem?.(ab.reagent, 1);
  return true;
}

export function ctx(u, ab, rd, target) {
  return { u, ab, rd, t: target, rank: rd.rank ?? 1 };
}

function execute(u, ab, rd, target) {
  if (!payCost(u, ab, rd)) return false;
  setCooldown(u, ab, rd);
  if (u.hasFlag('stealth') && !ab.keepStealth) u.breakStealth();
  if (ab.school !== 'physical' || ab.spell) u.anim.cast = Math.max(u.anim.cast, 0.35);
  const c = ctx(u, ab, rd, target);
  const res = ab.effect?.(c);
  if (ab.combo && res !== false) { u.comboPoints = 0; }
  if (ab.melee && target && canAttack(u, target) && !target.dead) {
    if (target.threat && !target.threat.has(u)) engage(target, u);
  }
  emit('abilityUsed', { unit: u, ability: ab, target });
  return true;
}

export function updateCasting(u) {
  const c = u.cast;
  if (!c) return;
  const ab = c.ability;
  if (u.dead || u.isIncapacitated()) { u.interruptCast(); return; }
  if (c.target && c.target !== u && (c.target.dead && !ab.targetDead) && ab.target !== 'none') { u.cast = null; emit('castStop', { unit: u }); return; }
  if (c.channel) {
    if (c.target && c.target !== u && ab.target === 'enemy' && (c.target.dead || rangeTo(u, c.target) > (abilityRange(u, ab, c.rd) || 40) + 5)) {
      u.cast = null; emit('castStop', { unit: u }); return;
    }
    while (G.time >= c.nextTick && u.cast === c) {
      c.ticks++;
      c.nextTick += c.rd.tickEvery ?? ab.tickEvery ?? 1;
      ab.onTick?.(ctx(u, ab, c.rd, c.target), c.ticks);
    }
    if (G.time >= c.end && u.cast === c) {
      u.cast = null;
      ab.onChannelEnd?.(ctx(u, ab, c.rd, c.target));
      c.onDone?.();
      emit('castStop', { unit: u, done: true });
    }
    return;
  }
  if (G.time >= c.end) {
    u.cast = null;
    emit('castStop', { unit: u, done: true });
    // re-validate target and range at completion
    const err = checkCast(u, ab, c.rd, c.target, { ignoreGcd: true, fromQueue: true, ignoreControl: false });
    if (err && !err.startsWith("Can't do that while moving")) { ERR(u, err); return; }
    if (c.target && c.target !== u) u.faceTowards(c.target);
    execute(u, ab, c.rd, c.target);
  }
}

// ---------- effect helpers used by ability scripts ----------
export function spellPower(u, school, heal = false) {
  return (u.stats.sp ?? 0) + (heal ? u.stats.heal ?? 0 : 0);
}

// Direct damage spell with a hit roll; returns damage dealt (0 on resist).
export function spellHit(u, t, ab, min, max, o = {}) {
  const school = o.school ?? ab.school;
  const shatter = t.hasFlag?.('root') ? u.mods?.shatter ?? 0 : 0;
  const outcome = spellRoll(u, t, school, { critBonus: (u.mods?.spellCrit?.[ab.id] ?? 0) + (o.critBonus ?? 0) + shatter });
  if (outcome === 'resist') {
    emit('combatText', { unit: t, text: 'Resist', kind: 'miss', src: u });
    emit('damage', { src: u, tgt: t, amount: 0, school, missType: 'resist', ability: ab.name });
    if (t.threat) engage(t, u);
    return 0;
  }
  let dmg = rand(min, max) + spellPower(u, school) * (o.coef ?? ab.coef ?? 0.5);
  const crit = outcome === 'crit';
  if (crit) dmg *= 1.5 + (u.mods?.spellCritDmg?.[school] ?? 0) + (u.mods?.critDmgAbility?.[ab.id] ?? 0);
  const done = dealDamage(u, t, dmg, { school, ability: ab.id, abilityName: ab.name, crit, threatMul: o.threatMul, bonusThreat: o.bonusThreat });
  if (crit) for (const a of u.auras) a.onSpellCrit?.(a, t, ab);
  for (const a of [...u.auras]) a.onSpellHit?.(a, t, ab, done);
  return done || 1;
}

// Weapon-based special attack. Returns { outcome, dmg }.
export function weaponStrike(u, t, ab, o = {}) {
  const hand = o.hand ?? 'mh';
  const outcome = o.ranged ? rangedRoll(u, t, o) : meleeRoll(u, t, { ...o, critBonus: (o.critBonus ?? 0) + (u.mods?.spellCrit?.[ab.id] ?? 0) });
  u.anim.swing = hand === 'mh' && !o.ranged ? 1 : u.anim.swing;
  if (hand === 'oh') u.anim.offSwing = 1;
  if (o.ranged) u.anim.shoot = 0.5;
  if (outcome === 'miss' || outcome === 'dodge' || outcome === 'parry') {
    emit('combatText', { unit: t, text: cap(outcome), kind: 'miss', src: u });
    emit('damage', { src: u, tgt: t, amount: 0, school: 'physical', missType: outcome, ability: ab.name });
    onAvoided(u, t, outcome);
    if (t.threat) engage(t, u);
    if (o.refundOnMiss) { const p = defaultPower(u, ab); if (p === 'rage' || p === 'energy') u[p] += abilityCost(u, ab, rankData(ab, knownRank(u, ab.id))) * 0.8; }
    return { outcome, dmg: 0 };
  }
  let dmg = o.flat !== undefined ? o.flat : weaponDamage(u, o.ranged ? 'ranged' : hand, o.normalized) * (o.mult ?? 1) + (o.bonus ?? 0);
  if (outcome === 'crit') dmg *= 2 + (u.mods?.critDmgAbility?.[ab.id] ?? 0) + (u.mods?.meleeCritDmg ?? 0);
  const done = dealDamage(u, t, dmg, {
    school: o.school ?? 'physical', ability: ab.id, abilityName: ab.name, crit: outcome === 'crit', blocked: outcome === 'block', melee: !o.ranged,
    threatMul: o.threatMul, bonusThreat: o.bonusThreat, armorPen: o.armorPen,
  });
  if (outcome === 'block') onAvoided(u, t, 'block');
  if (!o.noProcs) procOnHit(u, t, outcome, done, hand, ab);
  return { outcome, dmg: done };
}

function onAvoided(att, def, outcome) {
  if (outcome === 'block') for (const a of [...def.auras]) a.onBlock?.(a, att);
  if (outcome === 'dodge' && att.cls === 'warrior') att.react.overpower = G.time + 5;
  if (outcome === 'dodge' || outcome === 'parry' || outcome === 'block') {
    if (def.cls === 'warrior') def.react.revenge = G.time + 5;
  }
  if (outcome === 'dodge' || outcome === 'parry' || outcome === 'block') {
    if (def.cls === 'hunter' || def.kind === 'player') def.react.counter = G.time + 5;
  }
}

function procOnHit(u, t, outcome, dmg, hand, ab) {
  if (dmg <= 0) return;
  for (const a of [...u.auras]) a.onHit?.(a, t, outcome, dmg, hand, ab);
  if (outcome === 'crit') {
    for (const a of [...u.auras]) a.onCrit?.(a, t, hand, ab);
    for (const a of [...t.auras]) a.onCritTaken?.(a, u);
  }
  u.onMeleeHit?.(t, outcome, dmg, hand, ab);
}

// White melee swing.
export function meleeSwing(u, t, hand) {
  const q = u.queued;
  if (hand === 'mh' && q) {
    u.queued = null;
    emit('queue', { unit: u });
    const ptype = defaultPower(u, q.ab);
    const cost = abilityCost(u, q.ab, q.rd);
    const err = checkCast(u, q.ab, q.rd, t, { ignoreGcd: true, fromQueue: true });
    if (!err && u.resource(ptype) >= cost) {
      u.spend(ptype, cost);
      setCooldown(u, q.ab, q.rd);
      q.ab.effect(ctx(u, q.ab, q.rd, t));
      u.anim.swing = 1;
      return;
    }
  }
  const outcome = meleeRoll(u, t, { white: true });
  if (hand === 'mh') u.anim.swing = 1; else u.anim.offSwing = 1;
  if (outcome === 'miss' || outcome === 'dodge' || outcome === 'parry') {
    emit('combatText', { unit: t, text: cap(outcome), kind: 'miss', src: u });
    emit('damage', { src: u, tgt: t, amount: 0, school: 'physical', missType: outcome, white: true });
    onAvoided(u, t, outcome);
    if (t.threat) engage(t, u);
    return;
  }
  let dmg = weaponDamage(u, hand);
  if (outcome === 'crit') dmg *= 2 + (u.mods?.meleeCritDmg ?? 0);
  const done = dealDamage(u, t, dmg, { school: 'physical', crit: outcome === 'crit', blocked: outcome === 'block', white: true, melee: true, hand });
  if (outcome === 'block') onAvoided(u, t, 'block');
  procOnHit(u, t, outcome, done, hand, null);
}

export function updateAutoAttack(u, dt) {
  const t = u.target;
  const atkSpeed = u.stats.atkSpeed ?? 1;
  if (u.swing.mh > 0) u.swing.mh -= dt * atkSpeed;
  if (u.swing.oh > 0) u.swing.oh -= dt * atkSpeed;
  if (u.swing.ranged > 0) u.swing.ranged -= dt * (u.stats.rangedSpeed ?? 1);
  if (!t || t.dead || u.dead || !u.canAct() || u.hasFlag('pacify')) return;
  if (u.autoShot && u.kind === 'player' && u.weapon('ranged').type !== 'wand' && inMeleeRange(u, t) && canAttack(u, t)) u.autoAttack = true;
  if (u.autoAttack && canAttack(u, t) && !u.cast) {
    if (inMeleeRange(u, t)) {
      if (u.kind !== 'player' || facingOk(u, t)) {
        if (u.hasFlag('disarm') && u.kind === 'player') { /* disarmed hits like fists */ }
        if (u.swing.mh <= 0) {
          meleeSwing(u, t, 'mh');
          u.swing.mh = u.weapon('mh').speed;
          if (u.hasFlag('stealth')) u.breakStealth();
        }
        if (u.dualWielding() && u.swing.oh <= 0) {
          meleeSwing(u, t, 'oh');
          u.swing.oh = u.weapon('oh').speed;
        }
      }
    }
  }
  if (u.autoShot && canAttack(u, t) && !u.cast && u.swing.ranged <= 0 && u.moving < 0.1) {
    const w = u.weapon('ranged');
    const d = rangeTo(u, t);
    const wand = w.type === 'wand';
    const maxR = wand ? 30 : 35;
    if (d <= maxR && (wand || d >= 7.5 || u.kind !== 'player')) {
      if (u.kind === 'player' && !wand && !u.useAmmo()) { emit('error', 'Ammo needed'); u.autoShot = false; return; }
      u.faceTowards(t);
      u.swing.ranged = w.speed;
      u.anim.shoot = 0.6;
      const fx = wand ? { color: { arcane: 0xff80ff, fire: 0xff7030, frost: 0x80c0ff, shadow: 0xa060ff }[w.school] ?? 0xffffff, size: 0.6, speed: 30 } : { color: 0xd8c8a0, size: 0.25, speed: 45, arrow: true };
      projectile(u, t, fx, () => {
        if (t.dead) return;
        if (wand) {
          const r = spellRoll(u, t, w.school);
          if (r === 'resist') { emit('combatText', { unit: t, text: 'Resist', kind: 'miss', src: u }); return; }
          let dmg = rand(w.min, w.max) * (1 + (u.mods?.wandPct ?? 0));
          if (r === 'crit') dmg *= 1.5;
          dealDamage(u, t, dmg, { school: w.school, crit: r === 'crit', abilityName: 'Shoot' });
        } else {
          const out = rangedRoll(u, t, {});
          if (out === 'miss' || out === 'dodge') { emit('combatText', { unit: t, text: cap(out), kind: 'miss', src: u }); if (t.threat) engage(t, u); return; }
          let dmg = weaponDamage(u, 'ranged');
          for (const a of t.auras) if (a.rangedTaken) dmg += a.rangedTaken;
          if (out === 'crit') dmg *= 2 + (u.mods?.rangedCritDmg ?? 0);
          const done = dealDamage(u, t, dmg, { school: 'physical', crit: out === 'crit', abilityName: 'Auto Shot', ranged: true });
          for (const a of [...u.auras]) a.onRangedHit?.(a, t, done);
        }
      });
    }
  }
}
function facingOk(u, t) {
  const a = Math.atan2(t.pos.x - u.pos.x, t.pos.z - u.pos.z);
  let d = a - u.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= Math.PI / 2) return true;
  // the player turns to face whatever they are fighting while standing still
  if (u.kind === 'player' && u.moving < 0.1) { u.facing = a; return true; }
  if (u.kind === 'player') emit('error', 'You are facing the wrong way!');
  return false;
}

export function dot(u, t, ab, o) {
  // o: { id, name, total, dur, interval, school, icon, mods, flags, dispel, onTick }
  const interval = o.interval ?? 3;
  const ticks = Math.max(1, Math.round(o.dur / interval));
  const sp = spellPower(u, o.school ?? ab.school) * (o.coef ?? 0);
  const per = (o.total + sp) / ticks * (1 + (u.mods?.dotDmg?.[ab.id] ?? 0));
  return t.addAura({
    id: o.id ?? ab.id, name: o.name ?? ab.name, icon: o.icon ?? ab.icon, school: o.school ?? ab.school, debuff: true, dur: o.dur, interval,
    dispel: o.dispel ?? (ab.school === 'physical' ? null : 'magic'), mods: o.mods, flags: o.flags, maxStacks: o.maxStacks, group: o.group,
    tick: (a) => {
      if (a.caster && a.caster.dead && a.caster.kind !== 'player') { a.remaining = 0; return; }
      const amt = o.ramp ? per * o.ramp(a) : per;
      dealDamage(a.caster, a.unit, amt * (a.stacks ?? 1), { school: o.school ?? ab.school, periodic: true, abilityName: o.name ?? ab.name, ability: ab.id, noPushback: true });
      o.onTick?.(a);
    },
  }, u);
}

export function hot(u, t, ab, o) {
  const interval = o.interval ?? 3;
  const ticks = Math.max(1, Math.round(o.dur / interval));
  const per = (o.total + spellPower(u, 'holy', true) * (o.coef ?? 0)) / ticks;
  return t.addAura({
    id: o.id ?? ab.id, name: o.name ?? ab.name, icon: o.icon ?? ab.icon, school: ab.school, dur: o.dur, interval, dispel: 'magic',
    tick: (a) => heal(a.caster, a.unit, per, { periodic: true, abilityName: o.name ?? ab.name, ability: ab.id }),
  }, u);
}

export function directHeal(u, t, ab, min, max, o = {}) {
  const favor = u.getAura?.('divine_favor');
  if (favor) u.removeAura(favor, 'used');
  const r = spellRoll(u, t, ab.school, { critBonus: (u.mods?.spellCrit?.[ab.id] ?? 0) + (u.mods?.healCrit ?? 0) + (favor ? 100 : 0) });
  let h = rand(min, max) + spellPower(u, ab.school, true) * (o.coef ?? ab.coef ?? 0.6);
  if (r === 'crit') h *= 1.5;
  for (const a of t.auras) if (a.healTakenBonus) h += a.healTakenBonus;
  return heal(u, t, h, { crit: r === 'crit', abilityName: ab.name, ability: ab.id });
}

export function interrupt(u, t, lockDur) {
  if (!t.cast) return false;
  if (t.cast.ability?.uninterruptible) return false;
  t.interruptCast(true, lockDur);
  emit('combatText', { unit: t, text: 'Interrupted', kind: 'miss', src: u });
  return true;
}

export function aoeEnemies(u, x, z, r, max = 99) {
  return unitsNear(x, z, r, (o) => canAttack(u, o) && (o.kind !== 'npc' || o.attackable)).slice(0, max);
}
export function aoeAllies(u, x, z, r) {
  return unitsNear(x, z, r, (o) => friendly(u, o) && o.kind !== 'npc' && o.kind !== 'totem');
}

export function addCombo(u, t, n = 1) {
  if (u.comboTarget !== t) { u.comboTarget = t; u.comboPoints = 0; }
  u.comboPoints = Math.min(5, u.comboPoints + n);
  emit('combo', { unit: u });
}

// ---------- projectiles ----------
const projGeo = new THREE.SphereGeometry(0.22, 8, 6);
const arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.9);
export function projectile(src, tgt, fx, onHit) {
  if (!G.scene) { onHit(); return; }
  const group = new THREE.Group();
  let mesh;
  if (fx.arrow) {
    mesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: fx.color ?? 0xd8c8a0 }));
  } else {
    mesh = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(fx.color ?? 0xffffff).multiplyScalar(2.4) }));
    mesh.scale.setScalar((fx.size ?? 1));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: new THREE.Color(fx.color ?? 0xffffff).multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(1.6 * (fx.size ?? 1));
    group.add(glow);
  }
  group.add(mesh);
  const sy = src.y + (src.height ?? 1.8) * 0.7;
  group.position.set(src.pos.x + Math.sin(src.facing) * 0.5, sy, src.pos.z + Math.cos(src.facing) * 0.5);
  G.scene.add(group);
  G.projectiles.push({ group, mesh, tgt, speed: fx.speed ?? 25, onHit, fx, life: 6 });
}
G.projectiles = [];
const tmpV = new THREE.Vector3();
export function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    const t = p.tgt;
    tmpV.set(t.pos.x, t.y + (t.height ?? 1.8) * 0.55, t.pos.z);
    const d = tmpV.distanceTo(p.group.position);
    const step = p.speed * dt;
    p.life -= dt;
    if (d <= step + 0.3 || p.life <= 0) {
      G.scene.remove(p.group);
      G.projectiles.splice(i, 1);
      emit('impact', { x: tmpV.x, y: tmpV.y, z: tmpV.z, color: p.fx.color, school: p.fx.school });
      try { p.onHit(); } catch (e) { console.error(e); }
      continue;
    }
    tmpV.sub(p.group.position).normalize();
    p.group.position.addScaledVector(tmpV, step);
    if (p.fx.arrow) p.mesh.lookAt(p.group.position.clone().add(tmpV));
    else if (Math.random() < 0.8) burst(p.group.position, p.fx.color ?? 0xffffff, 1, 0.5, 0.35);
  }
}

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
export { distance, rangeTo, isBehind, canAttack, friendly, addThreat, engage, dealDamage, heal };
