// Creature, pet and guard behaviour.
import { G, emit } from '../state.js';
import { clamp, angleTo, rand, normAngle } from '../util.js';
import { canAttack, distance, rangeTo, inMeleeRange, engage, isInFront, friendly } from './combat.js';
import { castAbility, ABILITIES, cooldownLeft, rankData, checkCast } from './spells.js';
import { updateDash, updateTotem } from './summons.js';
import { buildModel } from './appearance.js';
import { bloodPactTick } from '../data/abilities/pets.js';
import { inDungeon } from './collision.js';

export function aggroRadius(m, t) {
  const diff = (t.level ?? 1) - m.level;
  const base = m.tpl?.aggro ?? 13;
  return clamp(base - diff, 4, 28) * (m.elite ? 1.1 : 1);
}
function canSee(m, t) {
  if (t.dead || t.ghost || t.flying || t.hasFlag?.('feign')) return false;
  if (t.hasFlag?.('stealth')) {
    const det = Math.max(0, 3 + (m.level - t.level) * 1.0 + (m.elite ? 2 : 0));
    return distance(m, t) < det && isInFront(m, t, Math.PI / 2);
  }
  return true;
}

// Steering: try straight, then fan out around obstacles.
export function steerTowards(u, x, z, speed, dt, stopDist = 0) {
  const dx = x - u.pos.x, dz = z - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopDist + 0.05) { u.moving = 0; return true; }
  const step = Math.min(speed * dt, d - stopDist);
  const base = Math.atan2(dx, dz);
  const tries = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
  for (const off of tries) {
    const a = base + off * (u._steerSide ?? 1);
    if (u.moveBy(Math.sin(a) * step, Math.cos(a) * step)) {
      u.facing = turnTowards(u.facing, a, dt * 12);
      u.moving = speed;
      if (off !== 0) u._steerSide = Math.sign(off) || 1;
      return false;
    }
  }
  u.moving = 0;
  u._stuck = (u._stuck ?? 0) + dt;
  return false;
}
function turnTowards(cur, target, maxStep) {
  const d = normAngle(target - cur);
  return cur + clamp(d, -maxStep, maxStep);
}

export function fearMove(u, dt) {
  const a = u.auras.find((x) => x.flags?.fear);
  if (!a) return;
  a._t = (a._t ?? 0) - dt;
  if (a._t <= 0) { a._t = 1.5 + Math.random(); a.fearDir += rand(-1.2, 1.2); }
  const sp = u.speed() * 0.75;
  if (!u.moveBy(Math.sin(a.fearDir) * sp * dt, Math.cos(a.fearDir) * sp * dt)) a.fearDir += Math.PI * 0.7;
  u.facing = a.fearDir;
  u.moving = sp;
}

function sheepSwap(u) {
  const sheep = u.hasFlag('sheep');
  if (sheep && !u._sheepModel) {
    u._origModel = u.model;
    u._sheepModel = buildModel({ t: 'quad', color: 0xf0ece0, length: 0.9, legLen: 0.4, width: 0.6, bodyH: 0.55, headSize: 0.3, headColor: 0x3a3a3a, snout: 0.15, snoutColor: 0x3a3a3a, legColor: 0x3a3a3a, tailLen: 0.15 });
    u.setModel(u._sheepModel);
  } else if (!sheep && u._sheepModel) {
    u.setModel(u._origModel);
    u._sheepModel = null;
  }
}

// ---------- creatures ----------
export function updateMob(m, dt) {
  if (m.dead) { m.moving = 0; return; }
  sheepSwap(m);
  if (updateDash(m, dt)) return;
  if (m.hasFlag('fear')) { fearMove(m, dt); return; }
  if (!m.canAct()) { m.moving = 0; return; }
  if (m.evading) return evade(m, dt);
  if (m.fleeing) return flee(m, dt);
  if (m.inCombat && m.threat.size) return combat(m, dt);
  if (m.inCombat && !m.threat.size) { startEvade(m); return; }
  idle(m, dt);
}

function idle(m, dt) {
  m.autoAttack = false;
  m.target = null;
  m._scan = (m._scan ?? 0) - dt;
  if (m._scan <= 0) {
    m._scan = 0.25 + Math.random() * 0.1;
    if (m.faction === 'hostile') {
      let best = null, bd = 1e9;
      for (const u of G.units) {
        if (u.faction !== 'player' && !(u.guard && u.kind === 'npc')) continue;
        if (u.kind === 'totem' || u.dead) continue;
        const d = distance(m, u);
        if (d > 32) continue;
        if (d < aggroRadius(m, u) && d < bd && canSee(m, u) && Math.abs(u.y - m.y) < 12) { best = u; bd = d; }
      }
      if (best) {
        engage(m, best);
        m.target = best;
        callForHelp(m, best);
        return;
      }
    }
  }
  // wander around home
  if (m.tpl?.stationary || m.data.stationary) { m.moving = 0; return; }
  if (m.patrol) return patrol(m, dt);
  if (!m.wanderTo || G.time > m.wanderUntil) {
    if (Math.random() < 0.006 || !m.wanderTo) {
      const r = m.data.wander ?? 6;
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      m.wanderTo = { x: m.home.x + Math.cos(a) * d, z: m.home.z + Math.sin(a) * d };
      m.wanderUntil = G.time + 4 + Math.random() * 8;
      m.idleFor = 2 + Math.random() * 6;
    }
  }
  if (m.idleFor > 0) { m.idleFor -= dt; m.moving = 0; return; }
  if (m.wanderTo) {
    const done = steerTowards(m, m.wanderTo.x, m.wanderTo.z, m.baseSpeed * 0.35, dt, 0.4);
    if (done) { m.wanderTo = null; m.idleFor = 3 + Math.random() * 8; }
  }
}

function patrol(m, dt) {
  const p = m.patrol;
  m.patrolIdx ??= 0;
  const wp = p[m.patrolIdx];
  if (steerTowards(m, wp[0], wp[1], m.baseSpeed * 0.4, dt, 0.5)) m.patrolIdx = (m.patrolIdx + 1) % p.length;
}

export function callForHelp(m, target) {
  const r = m.tpl?.social ?? 0;
  if (!r) return;
  for (const o of G.units) {
    if (o === m || o.dead || o.kind !== 'mob' || o.inCombat || o.evading) continue;
    if (o.tpl?.family !== m.tpl?.family) continue;
    if (distance(o, m) < r) { o._helping = true; engage(o, target); o._helping = false; o.target = target; }
  }
}

function pickTarget(m) {
  const taunt = m.auras.find((a) => a.tauntedBy && !a.tauntedBy.dead);
  // drop invalid entries
  for (const [u] of m.threat) {
    if (u.dead || u.ghost || !G.units.includes(u) || (u.kind === 'totem' && u.removed) || distance(u, m) > 100) m.threat.delete(u);
  }
  if (taunt) return taunt.tauntedBy;
  let top = null, topV = -1;
  for (const [u, v] of m.threat) if (v > topV) { top = u; topV = v; }
  const cur = m.target;
  if (cur && m.threat.has(cur) && top && top !== cur) {
    const curV = m.threat.get(cur);
    const need = inMeleeRange(m, top) ? 1.1 : 1.3;
    if (topV < curV * need) return cur;
  }
  return top;
}

function startEvade(m) {
  m.evading = true;
  m.inCombat = false;
  m.threat.clear();
  m.target = null;
  m.autoAttack = false;
  m.cast = null;
  m.fleeing = 0;
  m.removeAurasWhere((a) => a.debuff);
}
function evade(m, dt) {
  m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * 0.5);
  if (steerTowards(m, m.home.x, m.home.z, m.baseSpeed * 1.2, dt, 0.5) || (m._stuck ?? 0) > 3 || distance(m, { pos: m.home }) < 1) {
    m._stuck = 0;
    if (distance(m, { pos: m.home }) > 3) { m.pos.x = m.home.x; m.pos.z = m.home.z; }
    m.evading = false;
    m.hp = m.maxHp;
    m.mana = m.maxMana;
    m.facing = m.home.facing ?? m.facing;
    m.fled = false;
    m.data.pickpocketed = false;
    emit('evaded', { unit: m });
  }
}

function flee(m, dt) {
  m.fleeing -= dt;
  const t = m.target;
  if (m.fleeing <= 0 || !t || t.dead) { m.fleeing = 0; return; }
  const a = angleTo(t.pos, m.pos);
  const sp = m.baseSpeed * 0.62 * (m.stats.speed ?? 1);
  if (!m.moveBy(Math.sin(a) * sp * dt, Math.cos(a) * sp * dt)) m.moveBy(Math.sin(a + 1.2) * sp * dt, Math.cos(a + 1.2) * sp * dt);
  m.facing = a;
  m.moving = sp;
  // runners bring friends
  if (Math.random() < dt * 2) callForHelp(m, t);
}

function combat(m, dt) {
  const t = pickTarget(m);
  if (!t) { startEvade(m); return; }
  if (t !== m.target) { m.target = t; }
  // leash
  const homeD = Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z);
  const leash = m.boss ? 60 : inDungeon(m.pos.x) ? 90 : 70;
  if (homeD > leash || (m._stuck ?? 0) > 6) { m._stuck = 0; startEvade(m); return; }
  if (G.time - (m.lastDamagedAt ?? G.time) > 15 && G.time - (m.lastHitAt ?? 0) > 15 && !inMeleeRange(m, t) && rangeTo(m, t) > 30) { startEvade(m); return; }
  // fleeing at low health
  if (m.tpl?.flee && !m.fled && m.hp < m.maxHp * 0.18 && !m.boss) {
    m.fled = true;
    if (Math.random() < 0.65) {
      m.fleeing = 5.5;
      m.cast = null;
      emit('emote', { unit: m, text: `${m.name} attempts to run away in fear!` });
      return;
    }
  }
  if (m.cast) { m.moving = 0; m.faceTowards(t); return; }
  // abilities
  m._abilityCheck = (m._abilityCheck ?? 0) - dt;
  if (m._abilityCheck <= 0) {
    m._abilityCheck = 0.5;
    for (const a of m.tpl?.a ?? []) {
      const ab = ABILITIES[a.id];
      if (!ab) continue;
      if (a.below && m.hp > m.maxHp * a.below) continue;
      if (a.first && m.data.usedFirst?.[a.id]) continue;
      if (a.id === 'm_enrage' && m.hasAura('m_enrage')) continue;
      if (cooldownLeft(m, ab) > 0) continue;
      if (Math.random() > (a.chance ?? 0.5)) { if (!a.first) continue; }
      if (ab.school !== 'physical' && m.hasFlag('silence')) continue;
      if (m.schoolLocked(ab.school)) continue;
      const tgt = ab.target === 'self' || ab.target === 'none' ? m : t;
      const err = checkCast(m, ab, rankData(ab, 1), tgt, { ignoreGcd: true });
      if (err) continue;
      if (castAbility(m, a.id, tgt, { free: true, ignoreGcd: true })) {
        m.cooldowns[a.id] = G.time + (a.cd ?? 10) * (0.8 + Math.random() * 0.4);
        if (a.first) { m.data.usedFirst ??= {}; m.data.usedFirst[a.id] = true; }
        if (m.cast) return;
        break;
      }
    }
  }
  const caster = m.tpl?.caster && m.mana > 0;
  const ranged = m.tpl?.ranged || (caster && !inMeleeRange(m, t));
  const d = rangeTo(m, t);
  if (ranged && d > 6 && d < 28 && !m.hasFlag('root')) {
    m.moving = 0;
    m.faceTowards(t);
    if (m.tpl?.ranged) { m.autoShot = true; m.autoAttack = false; }
    return;
  }
  m.autoShot = false;
  m.autoAttack = true;
  if (!inMeleeRange(m, t)) {
    if (m.hasFlag('root')) { m.moving = 0; m.faceTowards(t); return; }
    const reach = (m.radius + t.radius) + 1.2;
    steerTowards(m, t.pos.x, t.pos.z, m.speed(), dt, reach);
  } else {
    m.moving = 0;
    m.faceTowards(t);
    m._stuck = 0;
  }
}

// ---------- pets ----------
export function updatePet(p, dt) {
  const o = p.owner;
  if (p.dead || !o) { p.moving = 0; return; }
  sheepSwap(p);
  if (updateDash(p, dt)) return;
  if (p.hasFlag('fear')) { fearMove(p, dt); return; }
  if (!p.canAct()) { p.moving = 0; return; }
  // happiness slowly fades
  if (p.data.happiness !== undefined) {
    p._hT = (p._hT ?? 0) + dt;
    if (p._hT > 20) { p._hT = 0; p.data.happiness = Math.max(0, p.data.happiness - 1); p.dirty = true; }
  }
  if (p.tpl?.blood) { p._bp = (p._bp ?? 0) - dt; if (p._bp <= 0) { p._bp = 2; bloodPactTick(p); } }
  if (p.level !== o.level) { p.level = o.level; p.dirty = true; }
  // choose a target
  let t = p.target;
  if (t && (t.dead || !canAttack(p, t) || t.evading)) t = p.target = null;
  if (p.order === 'attack' && !t) p.order = 'follow';
  if (!t && p.mode !== 'passive' && o.inCombat) {
    // defend the master: attack what attacks it, or what it is attacking
    let best = null;
    for (const m of G.units) {
      if (m.dead || !m.threat || !m.inCombat) continue;
      if (m.target === o || m.target === p) { best = m; break; }
    }
    if (!best && o.target && canAttack(o, o.target) && o.target.inCombat && o.target.threat?.has(o)) best = o.target;
    if (best && p.order !== 'stay') t = p.target = best;
  }
  if (p.mode === 'aggressive' && !t) {
    for (const m of G.units) if (!m.dead && m.faction === 'hostile' && distance(m, p) < 15) { t = p.target = m; break; }
  }
  if (t) {
    if (t.threat && !t.threat.has(p)) engage(t, p);
    if (p.cast) { p.moving = 0; return; }
    // autocast
    for (const id of p.petAbilities) {
      if (!p.autocast[id]) continue;
      const ab = ABILITIES[id];
      if (cooldownLeft(p, ab) > 0) continue;
      if (id === 'p_growl' && t.target === p) continue;
      if (id === 'p_torment' && t.target === p) continue;
      if (!checkCast(p, ab, rankData(ab, 1), t, { ignoreGcd: true })) {
        if (castAbility(p, id, t, { free: true, ignoreGcd: true })) { if (p.cast) return; break; }
      }
    }
    const caster = p.tpl?.caster;
    if (caster) {
      if (rangeTo(p, t) > 28) steerTowards(p, t.pos.x, t.pos.z, p.speed(), dt, 26);
      else { p.moving = 0; p.faceTowards(t); }
      p.autoAttack = false;
      return;
    }
    p.autoAttack = true;
    if (!inMeleeRange(p, t)) steerTowards(p, t.pos.x, t.pos.z, p.speed() * 1.1, dt, p.radius + t.radius + 1.2);
    else { p.moving = 0; p.faceTowards(t); }
    return;
  }
  p.autoAttack = false;
  if (p.order === 'stay') { p.moving = 0; return; }
  // follow at the master's side
  const d = distance(p, o);
  if (d > 70) { p.pos.x = o.pos.x - 2; p.pos.z = o.pos.z - 2; return; }
  const side = o.facing + Math.PI * 0.75;
  const fx = o.pos.x + Math.sin(side) * 2.4, fz = o.pos.z + Math.cos(side) * 2.4;
  const fd = Math.hypot(fx - p.pos.x, fz - p.pos.z);
  if (fd > 1.2) steerTowards(p, fx, fz, Math.max(o.speed() * 1.1, fd > 8 ? 12 : 7), dt, 0.8);
  else { p.moving = 0; p.facing = turnTowards(p.facing, o.facing, dt * 4); }
}

// ---------- town guards ----------
export function updateGuard(g, dt) {
  if (g.dead) return;
  if (g.cast) return;
  const t = g.target;
  if (t && (t.dead || t.evading || distance(g, t) > 35)) { g.target = null; g.autoAttack = false; }
  if (!g.target) {
    g._scan = (g._scan ?? 0) - dt;
    if (g._scan <= 0) {
      g._scan = 0.5;
      for (const m of G.units) {
        if (m.dead || m.faction !== 'hostile' || m.evading) continue;
        if (distance(g, m) < 22 && (m.inCombat || distance(g, m) < 12)) { g.target = m; engage(m, g); break; }
      }
    }
    // return to post
    if (!g.target) {
      const back = steerTowards(g, g.home.x, g.home.z, 5, dt, 0.4);
      if (back) g.facing = turnTowards(g.facing, g.home.facing, dt * 3);
      g.autoAttack = false;
      return;
    }
  }
  const tt = g.target;
  g.autoAttack = true;
  if (!inMeleeRange(g, tt)) steerTowards(g, tt.pos.x, tt.pos.z, 8, dt, g.radius + tt.radius + 1.2);
  else { g.moving = 0; g.faceTowards(tt); }
}

export function updateNpc(n, dt) {
  n.moving = 0;
  const p = G.player;
  if (p && distance(n, p) < 8 && !p.dead) n.facing = turnTowards(n.facing, angleTo(n.pos, p.pos), dt * 3);
  else n.facing = turnTowards(n.facing, n.home.facing ?? n.facing, dt * 1.5);
}

G.onMobEngaged = (m, who) => { if (who && !m.evading && !m._helping) callForHelp(m, who.owner && who.kind === 'totem' ? who.owner : who); };

export function updateAI(u, dt) {
  switch (u.kind) {
    case 'mob': return updateMob(u, dt);
    case 'pet': return updatePet(u, dt);
    case 'totem': return updateTotem(u);
    case 'npc': return u.guard ? updateGuard(u, dt) : updateNpc(u, dt);
  }
}
export { friendly };
