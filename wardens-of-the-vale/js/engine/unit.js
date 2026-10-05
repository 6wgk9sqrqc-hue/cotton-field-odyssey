// A Unit is anything that can fight: the player, mobs, pets, totems and NPCs.
import * as THREE from '../lib/three.module.min.js';
import { G, emit } from '../state.js';
import { uid, clamp, normAngle } from '../util.js';
import { CLASSES } from '../data/classes.js';
import { getItem, isTwoHand } from '../data/items.js';
import { heightAt, waterDepth } from './terrain.js';
import { platformHeight } from './scenery.js';
import { resolve, inDungeon, dungeonWalkable } from './collision.js';
import { animate } from './models.js';
import { dealDamage, heal, rageConv } from './combat.js';

const ringGeo = new THREE.RingGeometry(0.85, 1.0, 32).rotateX(-Math.PI / 2);
const shadowGeo = new THREE.CircleGeometry(0.8, 16).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const ringMats = {
  hostile: new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.85, depthWrite: false }),
  neutral: new THREE.MeshBasicMaterial({ color: 0xffe020, transparent: true, opacity: 0.85, depthWrite: false }),
  friendly: new THREE.MeshBasicMaterial({ color: 0x30ff40, transparent: true, opacity: 0.85, depthWrite: false }),
};

export const STAT_KEYS = ['str', 'agi', 'sta', 'int', 'spi'];

export class Unit {
  constructor(o) {
    this.id = uid();
    this.kind = o.kind ?? 'mob';
    this.name = o.name ?? 'Unknown';
    this.level = o.level ?? 1;
    this.cls = o.cls ?? null;
    this.tpl = o.tpl ?? null;
    this.faction = o.faction ?? 'hostile';
    this.creature = o.creature ?? 'humanoid';
    this.elite = !!o.elite;
    this.rare = !!o.rare;
    this.boss = !!o.boss;
    this.pos = { x: o.x ?? 0, z: o.z ?? 0 };
    this.y = heightAt(this.pos.x, this.pos.z);
    this.vy = 0;
    this.facing = o.facing ?? 0;
    this.radius = o.radius ?? 0.5;
    this.home = { x: this.pos.x, z: this.pos.z, facing: this.facing };
    this.baseSpeed = o.speed ?? 7;
    this.auras = [];
    this.cooldowns = {};
    this.gcdUntil = 0;
    this.gcdDur = 1.5;
    this.cast = null;
    this.target = null;
    this.autoAttack = false;
    this.autoShot = false;
    this.swing = { mh: 0, oh: 0.3, ranged: 0 };
    this.queued = null;
    this.threat = this.kind === 'mob' || o.threat ? new Map() : null;
    this.inCombat = false;
    this.combatUntil = 0;
    this.dead = false;
    this.ghost = false;
    this.comboPoints = 0;
    this.comboTarget = null;
    this.stance = null;
    this.form = null;
    this.pet = null;
    this.owner = o.owner ?? null;
    this.totems = {};
    this.lastSpend = -99;
    this.react = {};
    this.equip = {};
    this.mods = {};
    this.stats = {};
    this.moving = 0;
    this.airborne = false;
    this.swimming = false;
    this.anim = { swing: 0, offSwing: 0, cast: 0, shoot: 0 };
    this.mana = 0; this.maxMana = 0;
    this.rage = 0; this.energy = 100; this.maxEnergy = 100;
    this.hp = 1; this.maxHp = 1;
    this.powerType = null;
    this.npc = o.npc ?? null;
    this.data = o.data ?? {};
    Object.assign(this, o.extra ?? {});
    this.group = new THREE.Group();
    this.group.userData.unit = this;
    if (o.model) this.setModel(o.model);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.renderOrder = 1;
    this.ring = null;
  }

  setModel(model) {
    if (this.model) this.group.remove(this.model.root);
    this.model = model;
    this.group.add(model.root);
    model.root.traverse((n) => { if (n.isMesh) n.userData.unit = this; });
    this.height = model.height;
  }

  addToScene() {
    G.scene.add(this.group);
    G.scene.add(this.shadow);
    this.shadow.scale.setScalar(this.radius * 1.4 + 0.2);
    if (!G.units.includes(this)) G.units.push(this);
    this.syncVisual(0);
  }
  removeFromScene() {
    G.scene.remove(this.group);
    G.scene.remove(this.shadow);
    if (this.ring) G.scene.remove(this.ring);
    const i = G.units.indexOf(this);
    if (i >= 0) G.units.splice(i, 1);
  }

  // ---------- stats ----------
  get isPlayerSide() { return this.faction === 'player' || this.faction === 'friendly'; }
  weapon(hand = 'mh') {
    const w = this._weapons?.[hand];
    if (w) return w;
    return this._weapons?.unarmed ?? { min: 1, max: 2, speed: 2, type: 'fist' };
  }
  dualWielding() { return !!this._weapons?.oh; }
  canBlock() { return !!this.stats.block && !!this.equip?.offhand && getItem(this.equip.offhand.id)?.type === 'shield'; }
  get canParry() { return this._canParry ?? false; }

  recalc() {
    const old = { maxHp: this.maxHp, maxMana: this.maxMana };
    const s = { str: 0, agi: 0, sta: 0, int: 0, spi: 0, armor: 0, ap: 0, rap: 0, crit: 0, rcrit: 0, scrit: 0, dodge: 0, parry: 0, block: 0, blockValue: 0, hit: 0, shit: 0, sp: 0, heal: 0, mp5: 0, hp5: 0, res: {}, dmgDone: 0, dmgTaken: 0, schoolTaken: {}, speed: 1, atkSpeed: 1, castSpeed: 1, threat: 1, healDone: 0, healTaken: 0, physReduce: 0 };
    const pct = { str: 0, agi: 0, sta: 0, int: 0, spi: 0, armor: 0, maxHp: 0, maxMana: 0, ap: 0 };
    let weapons = {};
    if (this.tpl && this.kind !== 'player' && this.kind !== 'companion') {
      this.calcCreature(s, weapons);
    } else if (this.cls) {
      const C = CLASSES[this.cls];
      for (const k of STAT_KEYS) s[k] = Math.floor(C.base[k] + C.grow[k] * (this.level - 1));
      // equipment
      weapons.unarmed = { min: 1 + this.level * 0.3, max: 2 + this.level * 0.5, speed: 2.0, type: 'fist' };
      for (const slot in this.equip) {
        const inst = this.equip[slot];
        if (!inst) continue;
        const it = getItem(inst.id);
        if (!it) continue;
        if (inst.dur === 0 && it.dur) continue; // broken items give nothing
        s.armor += it.armor ?? 0;
        for (const k in it.stats) {
          if (k in s && typeof s[k] === 'number') s[k] += it.stats[k];
        }
        if (it.dmg && (slot === 'mainhand' || slot === 'offhand' || slot === 'ranged')) {
          const hand = slot === 'mainhand' ? 'mh' : slot === 'offhand' ? 'oh' : 'ranged';
          weapons[hand] = { min: it.dmg[0], max: it.dmg[1], speed: it.speed, type: it.type, twoHand: isTwoHand(it.type), school: it.school, id: it.id };
        }
      }
      if (weapons.oh && !this.canDualWield()) delete weapons.oh;
      if (this.kind === 'player' && weapons.ranged && (weapons.ranged.type === 'bow' || weapons.ranged.type === 'gun')) {
        const ammo = this.ammoItem?.();
        if (ammo) { const a = getItem(ammo); const add = (a.ammoDps ?? 0) * weapons.ranged.speed; weapons.ranged = { ...weapons.ranged, min: weapons.ranged.min + add, max: weapons.ranged.max + add }; }
      }
      this._canParry = !!C.parry && this.level >= (this.cls === 'warrior' || this.cls === 'paladin' ? 6 : 12);
    }
    // talents and passive modifiers (player only)
    const m = this.mods;
    if (m.stat) for (const k in m.stat) s[k] = (s[k] ?? 0) + m.stat[k];
    if (m.pct) for (const k in m.pct) pct[k] = (pct[k] ?? 0) + m.pct[k];
    // auras
    for (const a of this.auras) {
      if (a.mods) for (const k in a.mods) {
        if (k === 'res') { for (const r in a.mods.res) s.res[r] = (s.res[r] ?? 0) + a.mods.res[r]; continue; }
        if (k === 'schoolTaken') { for (const r in a.mods.schoolTaken) s.schoolTaken[r] = (s.schoolTaken[r] ?? 0) + a.mods.schoolTaken[r]; continue; }
        const v = a.mods[k] * (a.stacks ?? 1);
        if (k === 'speed' || k === 'atkSpeed' || k === 'castSpeed') s[k] *= 1 + v;
        else s[k] = (s[k] ?? 0) + v;
      }
      if (a.pct) for (const k in a.pct) pct[k] = (pct[k] ?? 0) + a.pct[k];
    }
    for (const k of STAT_KEYS) s[k] = Math.max(0, Math.round(s[k] * (1 + pct[k])));
    if (this.cls && !(this.tpl && this.kind === 'pet')) {
      const C = CLASSES[this.cls];
      const L = this.level;
      s.armor += s.agi * 2;
      s.ap += C.ap(s, L);
      s.rap += C.rap(s, L);
      s.crit += 5 + s.agi * C.critAgi;
      s.rcrit = s.crit + (m.rcrit ?? 0);
      if (weapons.mh?.twoHand && m.twoHandPct) s.dmgDone += m.twoHandPct;
      s.scrit += C.spellCritInt ? 1 + s.int * C.spellCritInt : 0;
      s.dodge += 3 + s.agi * C.dodgeAgi;
      if (this._canParry) s.parry += 5;
      if (this.canBlockBase()) { s.block += 5; s.blockValue += Math.floor(s.str / 20) + 5 + L; }
      const baseHp = C.hp[0] + C.hp[1] * (L - 1);
      this.maxHp = Math.round((baseHp + Math.min(20, s.sta) + Math.max(0, s.sta - 20) * 10 + (s.maxHpFlat ?? 0)) * (1 + pct.maxHp));
      if (C.mana) {
        const baseMana = C.mana[0] + C.mana[1] * (L - 1);
        this.maxMana = Math.round((baseMana + Math.min(20, s.int) + Math.max(0, s.int - 20) * 15) * (1 + pct.maxMana));
      }
      // forms
      if (this.form === 'bear') {
        s.armor = Math.round(s.armor * 1.8 + this.level * 8);
        s.ap += this.level * 3 + 10 + Math.round(this.level * (m.formAp ?? 0));
        this.maxHp = Math.round(this.maxHp * 1.15);
        weapons = { mh: { min: 2 + L * 0.9, max: 3 + L * 1.2, speed: 2.5, type: 'claw' } };
        s.threat *= 1.3;
      } else if (this.form === 'cat') {
        s.ap += this.level * 2 + 20 + Math.round(this.level * (m.formAp ?? 0));
        s.crit += 3;
        weapons = { mh: { min: 1 + L * 0.6, max: 2 + L * 0.8, speed: 1.0, type: 'claw' } };
        s.threat *= 0.71;
      }
      if (this.cls === 'rogue') s.threat *= 0.71;
    }
    s.armor = Math.max(0, Math.round(s.armor * (1 + pct.armor)));
    s.ap = Math.max(0, Math.round(s.ap * (1 + pct.ap)));
    this.stats = s;
    this._weapons = weapons;
    if (this.maxHp !== old.maxHp && old.maxHp > 1 && !this.dead) this.hp = clamp(this.hp * (this.maxHp / old.maxHp), 1, this.maxHp);
    if (this.maxMana !== old.maxMana && old.maxMana > 0) this.mana = clamp(this.mana * (this.maxMana / old.maxMana), 0, this.maxMana);
    this.hp = Math.min(this.hp, this.maxHp);
    this.mana = Math.min(this.mana, this.maxMana);
    this.dirty = false;
  }
  canBlockBase() { const oh = this.equip?.offhand; return !!oh && getItem(oh.id)?.type === 'shield' && CLASSES[this.cls]?.block; }
  canDualWield() {
    if (this.cls === 'rogue') return true;
    return !!(this.spells?.dual_wield || this.spells?.dual_wield_hunter);
  }

  // Creature stats come from the mob template and level.
  calcCreature(s, weapons) {
    const t = this.tpl, L = this.level;
    const hpBase = 40 + 16 * L + 0.6 * L * L;
    this.maxHp = Math.round(hpBase * (t.hp ?? 1) * (this.elite ? 2.1 : 1) * (this.boss ? 1.6 : 1) * (this.data.hpMul ?? 1));
    const dmin = (1.5 + 1.25 * L + 0.03 * L * L) * (t.dmg ?? 1) * (this.elite ? 1.35 : 1) * (this.data.dmgMul ?? 1);
    const spd = t.atkSpeed ?? 2.0;
    weapons.mh = { min: dmin * spd / 2, max: dmin * 1.35 * spd / 2, speed: spd, type: 'creature' };
    if (t.ranged) weapons.ranged = { min: dmin * 0.9, max: dmin * 1.2, speed: 2.4, type: 'bow' };
    s.armor = Math.round((L * 22 + 10) * (t.armor ?? 1));
    s.dodge = 5; s.parry = t.parry ? 5 : 0; s.crit = 5; s.scrit = 5;
    s.str = s.agi = s.sta = s.int = s.spi = L * 2 + 10;
    s.ap = 0;
    s.res = { ...(t.res ?? {}) };
    this._canParry = !!t.parry;
    if (t.mana || t.spells) this.maxMana = Math.round(60 + L * 30);
    if (this.kind === 'pet' && this.owner) {
      // pets scale with their master's level and a share of their stamina
      const os = this.owner.stats, om = this.owner.mods ?? {};
      this.maxHp = Math.round((this.maxHp * (t.petHp ?? 1) + (os.sta ?? 0) * 3) * (1 + (om.petHp ?? 0)));
      s.armor = Math.round((s.armor * (t.petArmor ?? 1) + (os.armor ?? 0) * 0.35) * (1 + (om.petArmor ?? 0)));
      s.crit += om.petCrit ?? 0;
      s.ap = Math.round((os.rap ?? os.ap ?? 0) * (t.apShare ?? 0.22));
      s.sp = Math.round((os.int ?? 0) * 0.15 + (os.sp ?? 0) * 0.15);
      if (this.data.happiness !== undefined) {
        const h = this.data.happiness;
        s.dmgDone += h > 66 ? 0.25 : h > 33 ? 0 : -0.25;
      }
    }
  }

  // ---------- resources ----------
  get power() {
    if (this.powerType === 'rage') return this.rage;
    if (this.powerType === 'energy') return this.energy;
    if (this.powerType === 'mana') return this.mana;
    return 0;
  }
  get maxPower() {
    if (this.powerType === 'rage') return 100;
    if (this.powerType === 'energy') return this.maxEnergy;
    if (this.powerType === 'mana') return this.maxMana;
    return 0;
  }
  addRage(v) { this.rage = clamp(this.rage + v, 0, 100); }
  resource(type) { return type === 'rage' ? this.rage : type === 'energy' ? this.energy : type === 'mana' ? this.mana : type === 'health' ? this.hp : 0; }
  spend(type, v) {
    if (v <= 0) return;
    if (type === 'rage') this.rage -= v;
    else if (type === 'energy') this.energy -= v;
    else if (type === 'mana') { this.mana -= v; this.lastSpend = G.time; }
    else if (type === 'health') this.hp = Math.max(1, this.hp - v);
  }

  // ---------- auras ----------
  getAura(id, caster) { return this.auras.find((a) => a.id === id && (!caster || a.caster === caster)); }
  hasAura(id) { return this.auras.some((a) => a.id === id); }
  hasFlag(f) { for (const a of this.auras) if (a.flags?.[f]) return true; return false; }
  addAura(def, caster) {
    if (this.dead && !def.persistDead) return null;
    // same spell from the same caster refreshes; group-unique auras replace each other
    let existing = this.auras.find((a) => a.id === def.id && (def.unique || a.caster === caster));
    if (!existing && def.group) existing = this.auras.find((a) => a.group === def.group && (def.groupAny || a.caster === caster));
    if (existing && existing.id === def.id) {
      existing.remaining = def.dur ?? existing.dur;
      existing.dur = def.dur ?? existing.dur;
      if (def.maxStacks) existing.stacks = Math.min(def.maxStacks, (existing.stacks ?? 1) + 1);
      if (def.absorb !== undefined) existing.absorb = def.absorb;
      if (def.charges !== undefined) existing.charges = def.charges;
      if (def.tick) { existing.tick = def.tick; existing.tickAmount = def.tickAmount; existing.nextTick = def.interval ?? existing.nextTick; }
      if (def.mods) existing.mods = def.mods;
      this.dirty = true;
      emit('aura', { unit: this });
      return existing;
    }
    if (existing) this.removeAura(existing, 'replaced');
    const a = { stacks: 1, ...def, caster, unit: this, remaining: def.dur ?? Infinity, nextTick: def.interval ?? 3, applied: G.time };
    this.auras.push(a);
    if (a.flags?.stun || a.flags?.fear || a.flags?.incap || a.flags?.sleep) this.onControlled(a);
    if (a.flags?.silence && this.cast && this.cast.ability?.school !== 'physical') this.interruptCast();
    if (a.flags?.stealth === undefined && this.hasFlag('stealth') && def.debuff && caster && caster !== this) this.breakStealth();
    a.onApply?.(a);
    this.dirty = true;
    emit('aura', { unit: this, aura: a });
    return a;
  }
  removeAura(a, reason) {
    const i = this.auras.indexOf(a);
    if (i < 0) return;
    this.auras.splice(i, 1);
    a.onRemove?.(a, reason);
    this.dirty = true;
    emit('aura', { unit: this, aura: a, removed: true });
  }
  removeAurasWhere(fn, reason) {
    for (const a of [...this.auras]) if (fn(a)) this.removeAura(a, reason);
  }
  onControlled() {
    if (this.cast) this.interruptCast();
    this.moving = 0;
  }
  isStunned() { return this.hasFlag('stun'); }
  isIncapacitated() { return this.hasFlag('stun') || this.hasFlag('incap') || this.hasFlag('sleep') || this.hasFlag('fear'); }
  canAct() { return !this.dead && !this.isIncapacitated(); }
  canMove() { return !this.dead && !this.isIncapacitated() && !this.hasFlag('root'); }
  breakStealth() { this.removeAurasWhere((a) => a.flags?.stealth, 'broken'); }
  onDamaged(dmg, src, opts) {
    // crowd control that breaks on damage (Polymorph, Sap, Gouge, fear thresholds)
    for (const a of [...this.auras]) {
      if (a.breakOnDamage && !(opts.periodic && a.ignorePeriodic) && a.appliedBy !== opts.ability) this.removeAura(a, 'damage');
      else if (a.damageCap !== undefined) { a.damageCap -= dmg; if (a.damageCap <= 0) this.removeAura(a, 'damage'); }
    }
    if (this.hasFlag('stealth') && dmg > 0) this.breakStealth();
    if (this.sitting) this.standUp();
    this.removeAurasWhere((a) => a.eating, 'damage');
  }

  // ---------- combat state ----------
  setInCombat() {
    this.inCombat = true;
    this.combatUntil = G.time + 6;
    if (this.sitting && this.kind === 'player') this.standUp();
    this.removeAurasWhere((a) => a.eating, 'combat');
  }
  standUp() { this.sitting = false; }
  // A creature starts fighting: remember the attacker and alert its pack.
  enterCombat(who) {
    const fresh = !this.inCombat;
    this.setInCombat();
    if (!this.target && who) this.target = who;
    if (fresh && this.kind === 'mob') G.onMobEngaged?.(this, who);
  }

  interruptCast(lockSchool, lockDur) {
    if (!this.cast) return;
    const ab = this.cast.ability;
    this.cast = null;
    emit('castStop', { unit: this, interrupted: true });
    if (lockSchool && ab) {
      this.addAura({ id: 'lockout', name: 'Interrupted', icon: 'interrupt', dur: lockDur ?? 4, debuff: true, lockSchool: ab.school, hidden: false }, null);
    }
  }
  pushback() {
    const c = this.cast;
    if (!c) return;
    if (this.mods?.noPushback?.[c.ability.id]) return;
    if (c.ability.id === 'bandage' || c.ability.id === 'hearthstone_cast') { this.interruptCast(); return; }
    if (c.channel) c.end -= c.total * 0.2;
    else if ((c.pushes ?? 0) < 2) { c.end = Math.min(c.end + 0.5, c.start + c.total + 1.0); c.pushes = (c.pushes ?? 0) + 1; }
  }
  schoolLocked(school) {
    return this.auras.some((a) => a.lockSchool && (a.lockSchool === school || a.lockAll));
  }

  // ---------- movement ----------
  groundAt(x, z) {
    let h = heightAt(x, z);
    const p = platformHeight(x, z);
    if (p > h - 0.5 && p < this.y + 1.5) h = Math.max(h, p);
    return h;
  }
  // Try to move by (dx, dz); slides along obstacles and refuses cliffs.
  moveBy(dx, dz) {
    if (!dx && !dz) return false;
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    const r = resolve(nx, nz, this.radius * 0.8);
    if (inDungeon(r.x) || inDungeon(this.pos.x)) {
      if (!dungeonWalkable(r.x, r.z, this.radius * 0.8)) {
        // slide along one axis
        if (dungeonWalkable(this.pos.x + dx, this.pos.z, this.radius * 0.8)) { this.pos.x += dx; return true; }
        if (dungeonWalkable(this.pos.x, this.pos.z + dz, this.radius * 0.8)) { this.pos.z += dz; return true; }
        return false;
      }
    } else {
      const h0 = this.groundAt(this.pos.x, this.pos.z), h1 = this.groundAt(r.x, r.z);
      const step = Math.hypot(r.x - this.pos.x, r.z - this.pos.z) || 1e-3;
      if ((h1 - h0) / step > 1.25 && h1 > h0 + 0.3 && !this.airborne) {
        // too steep to climb: try sliding along the contour
        return false;
      }
      if (Math.abs(r.x) > 690 || Math.abs(r.z) > 690) return false;
    }
    this.pos.x = r.x; this.pos.z = r.z;
    return true;
  }
  updatePhysics(dt) {
    const ground = this.groundAt(this.pos.x, this.pos.z);
    const depth = inDungeon(this.pos.x) ? 0 : -ground;
    this.swimming = depth > 1.5 && this.kind !== 'totem' && !this.flying;
    if (this.swimming) {
      this.y += (-1.3 - this.y) * Math.min(1, dt * 6);
      this.vy = 0; this.airborne = false;
    } else if (this.airborne || this.y > ground + 0.6) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        // falling damage past roughly eight yards, lethal around thirty
        if (this.vy < -19 && (this.kind === 'player' || this.kind === 'companion') && !this.ghost && !this.dead) {
          const dmg = Math.round(this.maxHp * Math.min(1.1, ((-this.vy - 19) / 17) ** 1.4));
          if (dmg > 0) dealDamage(null, this, dmg, { school: 'physical', ignoreArmor: true, abilityName: 'Falling', noThreat: true });
        }
        this.y = ground; this.vy = 0; this.airborne = false;
      } else this.airborne = true;
    } else {
      this.y = ground;
    }
  }
  speed() {
    let sp = this.baseSpeed * (this.stats.speed ?? 1);
    if (this.swimming) sp *= 0.67;
    if (this.hasFlag('stealth')) sp *= this.mods?.stealthSpeed ?? 0.6;
    if (this.ghost) sp *= 1.25;
    return sp;
  }
  faceTowards(other) {
    this.facing = Math.atan2(other.pos.x - this.pos.x, other.pos.z - this.pos.z);
  }

  // ---------- periodic update ----------
  updateAuras(dt) {
    for (const a of [...this.auras]) {
      if (a.remaining !== Infinity) a.remaining -= dt;
      if (a.tick && a.interval) {
        a.nextTick -= dt;
        while (a.nextTick <= 0.0001 && a.remaining > -0.05 && this.auras.includes(a)) {
          a.nextTick += a.interval;
          a.tick(a);
          if (this.dead) break;
        }
      }
      a.update?.(a, dt);
      if (a.remaining <= 0 || (a.charges !== undefined && a.charges <= 0)) this.removeAura(a, 'expired');
      if (this.dead && !a.persistDead) this.removeAura(a, 'death');
    }
  }
  updateRegen(dt) {
    this._regenT = (this._regenT ?? 0) + dt;
    // energy ticks 20 every 2 seconds
    if (this.powerType === 'energy' || this.cls === 'rogue' || this.form === 'cat') {
      this._energyT = (this._energyT ?? 0) + dt;
      if (this._energyT >= 2) { this._energyT -= 2; this.energy = Math.min(this.maxEnergy, this.energy + 20 * (1 + (this.mods?.energyRegen ?? 0))); }
    }
    if (this._regenT < 2) return;
    this._regenT -= 2;
    if (this.dead) return;
    const C = CLASSES[this.cls];
    // health: only out of combat (and while eating)
    if (!this.inCombat && this.kind !== 'totem') {
      const sp = this.stats.spi ?? 10;
      const regen = (C ? (this.cls === 'warrior' ? 0.8 : 0.4) * sp * 0.5 + this.level * 0.5 : this.maxHp * 0.03);
      this.hp = Math.min(this.maxHp, this.hp + regen * (this.mods?.hpRegen ?? 1));
    }
    if (this.stats.hp5) this.hp = Math.min(this.maxHp, this.hp + this.stats.hp5 * 0.4);
    // mana: the five second rule
    if (this.maxMana > 0) {
      let reg = 0;
      const spiRegen = C?.regen ? C.regen[0] / 2 + (this.stats.spi ?? 0) / C.regen[1] : this.maxMana * 0.02;
      if (G.time - this.lastSpend >= 5) reg = spiRegen;
      else reg = spiRegen * (this.mods?.castRegen ?? 0);
      reg += (this.stats.mp5 ?? 0) * 0.4;
      if (!C && !this.inCombat) reg = this.maxMana * 0.05;
      this.mana = Math.min(this.maxMana, this.mana + reg);
    }
    // rage decays out of combat
    if (!this.inCombat && this.rage > 0) this.rage = Math.max(0, this.rage - 3);
  }

  update(dt) {
    if (this.dirty) this.recalc();
    this.updateAuras(dt);
    if (this.dirty) this.recalc();
    this.updateRegen(dt);
    if (this.inCombat && G.time > this.combatUntil && !this.isEngaged()) {
      this.inCombat = false;
      emit('combatEnd', { unit: this });
    }
    for (const k in this.anim) if (this.anim[k] > 0) this.anim[k] = Math.max(0, this.anim[k] - dt * (k === 'cast' || k === 'shoot' ? 1 : 2.4));
  }
  // Is any living mob fighting this unit?
  isEngaged() {
    for (const m of G.units) if (m.threat && !m.dead && m.inCombat && m.threat.has(this)) return true;
    if (this.threat && this.threat.size) return true;
    return false;
  }

  syncVisual(dt) {
    const g = this.group;
    g.position.set(this.pos.x, this.y, this.pos.z);
    g.rotation.y = this.facing;
    if (this.model) {
      animate(this.model, dt, {
        time: G.time, speed: this.moving, dead: this.dead && !this.ghost, sit: this.sitting, swing: this.anim.swing > 0 ? 1 - this.anim.swing : 0,
        offSwing: this.anim.offSwing > 0 ? 1 - this.anim.offSwing : 0, cast: this.cast || this.anim.cast > 0 ? 1 : 0, shoot: this.anim.shoot > 0,
        combat: this.inCombat || this.autoAttack, stunned: this.isStunned(), airborne: this.airborne, flying: this.flying,
      });
    }
    this.shadow.position.set(this.pos.x, this.groundAt(this.pos.x, this.pos.z) + 0.06, this.pos.z);
    this.shadow.visible = !this.swimming && !this.flying;
    if (this.ring) this.ring.position.set(this.pos.x, this.groundAt(this.pos.x, this.pos.z) + 0.08, this.pos.z);
  }
  showRing(kind) {
    if (!kind) { if (this.ring) { G.scene.remove(this.ring); this.ring = null; } return; }
    if (!this.ring) { this.ring = new THREE.Mesh(ringGeo, ringMats[kind]); this.ring.renderOrder = 3; G.scene.add(this.ring); }
    this.ring.material = ringMats[kind];
    this.ring.scale.setScalar(this.radius * 1.3 + 0.5);
  }
}

export function makeUnit(o) { return new Unit(o); }
