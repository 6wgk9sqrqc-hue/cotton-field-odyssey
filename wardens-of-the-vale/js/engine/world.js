// World lifecycle: creatures, NPCs, objects, loot, death, travel.
import * as THREE from '../lib/three.module.min.js';
import { G, emit, on } from '../state.js';
import { Unit } from './unit.js';
import { buildModel, characterSpec } from './appearance.js';
import { objectModel, animate } from './models.js';
import { MOBS } from '../data/mobs.js';
import { NPCS, SPIRIT_HEALER } from '../data/npcs.js';
import { SPAWNS, OBJECTS } from '../data/spawns.js';
import { GRAVEYARDS, SUBZONES, ZONES, FLIGHT_POINTS, DUNGEON, TOWNS } from '../data/world.js';
import { mobXP, MAX_LEVEL } from '../data/classes.js';
import { rollLoot } from '../data/loot.js';
import { getItem } from '../data/items.js';
import { heightAt, zoneAt, waterDepth, inTown } from './terrain.js';
import { blockedPoint, inDungeon, dungeonWalkable } from './collision.js';
import { distance, canAttack } from './combat.js';
import { gainXP } from './progression.js';
import { creditKill, questDrops, creditUse, creditExplore, wantsQuestItem, wantsUse, setMobNamer } from './quests.js';
import { addItem, damageGear } from './inventory.js';
import { onPetDeath, killTotem, dismissPet } from './summons.js';
import { rand, randInt, pick, moneyText } from '../util.js';
import * as fx from './fx.js';

const GUARD_TPL = { hp: 5, dmg: 3, armor: 2.5, parry: true, atkSpeed: 2.0 };
const NPC_TPL = { hp: 2.5, dmg: 1, armor: 1 };
const respawns = [];
let dungeonResetAt = -1;

export function initWorld() {
  setMobNamer((id) => MOBS[id]?.name ?? id);
  G.spawnMob = (tpl, lvl, x, z, opts) => spawnMob(tpl, lvl, x, z, opts);
  G.teleportHome = teleportHome;
  for (const n of NPCS) createNpc(n);
  for (const g of GRAVEYARDS) {
    const sh = createNpc({ id: 'spirit_' + g.id, name: SPIRIT_HEALER.name, x: g.x + 3, z: g.z, facing: 0, m: SPIRIT_HEALER.m, spiritHealer: true });
    sh.group.visible = false;
  }
  SPAWNS.forEach((sp, i) => {
    sp.idx = i;
    if (sp.dungeon) return;
    for (let k = 0; k < sp.n; k++) spawnFromEntry(sp);
  });
  resetDungeon();
  OBJECTS.forEach((o) => {
    const n = o.n ?? 1;
    for (let k = 0; k < n; k++) createObject(o);
  });
  on('death', onDeath);
  on('damage', onDamageEvent);
  on('pickpocket', ({ unit, target, money }) => {
    unit.money += money;
    emit('money', { unit });
    emit('loot', { unit, money });
    if (Math.random() < 0.4 && target.tpl?.junk?.length) { addItem(unit, pick(target.tpl.junk), 1); emit('loot', { unit, item: target.tpl.junk[0], count: 1 }); }
  });
}

// ---------- creatures ----------
export function spawnMob(tplId, level, x, z, opts = {}) {
  const tpl = MOBS[tplId];
  if (!tpl) return null;
  const lv = level ?? randInt(tpl.levels[0], tpl.levels[1]);
  const u = new Unit({
    kind: 'mob', name: tpl.name, level: lv, faction: tpl.faction ?? 'hostile', tpl, creature: tpl.creature, elite: tpl.elite, rare: tpl.rare, boss: tpl.boss,
    x, z, radius: tpl.radius ?? 0.6, model: buildModel(tpl.m), speed: tpl.speed ?? 7,
    data: { wander: opts.wander ?? 6, stationary: !!opts.stationary },
  });
  u.tplId = tplId;
  u.recalc();
  u.hp = u.maxHp;
  u.mana = u.maxMana;
  u.facing = opts.facing ?? Math.random() * Math.PI * 2;
  u.home.facing = u.facing;
  u.spawn = opts.spawn ?? null;
  u.temp = !!opts.temp;
  u.addToScene();
  return u;
}
function spawnFromEntry(sp) {
  const tpl = MOBS[sp.tpl];
  if (sp.rareChance && Math.random() > sp.rareChance) { scheduleRespawn(sp, sp.respawn ?? 600); return; }
  let x = sp.x, z = sp.z;
  const amphibious = ['crocolisk', 'mirefin', 'crab', 'bog', 'drowned'].includes(tpl.family);
  for (let tries = 0; tries < 25 && sp.r > 0; tries++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * sp.r;
    const tx = sp.x + Math.cos(a) * d, tz = sp.z + Math.sin(a) * d;
    if (blockedPoint(tx, tz, 1)) continue;
    if (!amphibious && heightAt(tx, tz) < 0.2 && !sp.dungeon) continue;
    if (heightAt(tx, tz) < -2.5 && !sp.dungeon) continue;
    const t = inTown(tx, tz);
    if (t && !t.noGuards) continue;
    x = tx; z = tz; break;
  }
  const lv = sp.lv ? randInt(sp.lv[0], sp.lv[1]) : undefined;
  return spawnMob(sp.tpl, lv, x, z, { spawn: sp, wander: sp.wander, stationary: sp.stationary, facing: sp.facing });
}
function scheduleRespawn(sp, sec) {
  respawns.push({ sp, at: G.time + sec });
}

export function resetDungeon() {
  for (const u of [...G.units]) if (u.kind === 'mob' && u.spawn?.dungeon) u.removeFromScene();
  for (const sp of SPAWNS) if (sp.dungeon) for (let k = 0; k < sp.n; k++) spawnFromEntry(sp);
  dungeonResetAt = G.time;
}

function onDamageEvent(e) {
  const t = e.tgt, s = e.src;
  if (!t || t.kind !== 'mob' || t.tappedBy || !s) return;
  const owner = s.owner ?? s;
  t.tappedBy = owner.kind === 'player' || owner.kind === 'companion' ? 'player' : 'other';
}

function onDeath({ unit: u, killer }) {
  if (u.kind === 'mob') return onMobDeath(u, killer);
  if (u.kind === 'pet') return onPetDeath(u);
  if (u.kind === 'totem') return killTotem(u);
  if (u.kind === 'player') return onPlayerDeath(u, killer);
  if (u.kind === 'companion') return emit('system', `${u.name} has fallen.`);
}

function onMobDeath(m, killer) {
  m.autoAttack = false;
  m.threat?.clear();
  const p = G.player;
  const sp = m.spawn;
  if (sp && !sp.dungeon) scheduleRespawn(sp, sp.respawn ?? rand(55, 90));
  m.corpseUntil = G.time + 75;
  if (m.tappedBy === 'player' && p && !m.temp) {
    const xp = p.level >= MAX_LEVEL ? 0 : mobXP(p.level, m.level, m.elite);
    if (xp > 0) { m.xpWorthy = true; gainXP(p, xp, 'kill'); emit('killXP', { unit: m, xp }); }
    creditKill(p, m.tplId);
  }
  if (m.tappedBy === 'player' && p) {
    const loot = rollLoot(m);
    loot.items.push(...questDrops(p, m));
    if (loot.money || loot.items.length) {
      m.loot = loot;
      addSparkle(m);
      if (G.settings.autoLoot) {}
    }
  }
  if (m.temp && !m.loot) m.corpseUntil = G.time + 6;
}

const sparkleMat = () => new THREE.SpriteMaterial({ map: G.glowTex, color: 0xffe070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
function addSparkle(m) {
  const s = new THREE.Sprite(sparkleMat());
  s.scale.setScalar(1.2);
  s.position.set(0, (m.height ?? 1.5) * 0.4 / (m.model?.scale ?? 1), 0);
  m.group.add(s);
  m.sparkle = s;
}
export function lootEmpty(m) {
  return !m.loot || (!m.loot.money && !m.loot.items.length);
}
export function takeLoot(m, idx) {
  const p = G.player;
  if (!m.loot) return;
  if (idx === 'money') {
    if (m.loot.money) { p.money += m.loot.money; emit('loot', { unit: p, money: m.loot.money }); emit('money', { unit: p }); m.loot.money = 0; }
  } else {
    const [id, n] = m.loot.items[idx] ?? [];
    if (!id) return;
    const left = addItem(p, id, n);
    if (left < n) emit('loot', { unit: p, item: id, count: n - left });
    if (left === 0) m.loot.items.splice(idx, 1);
    else m.loot.items[idx][1] = left;
  }
  if (lootEmpty(m)) finishLoot(m);
}
export function takeAll(m) {
  takeLoot(m, 'money');
  for (let i = (m.loot?.items.length ?? 0) - 1; i >= 0; i--) takeLoot(m, i);
}
function finishLoot(m) {
  if (m.sparkle) { m.group.remove(m.sparkle); m.sparkle = null; }
  m.loot = null;
  m.corpseUntil = Math.min(m.corpseUntil, G.time + 8);
  emit('lootClosed', { unit: m });
}

// ---------- NPCs ----------
function createNpc(n) {
  const u = new Unit({ kind: 'npc', name: n.name, level: n.guard ? 30 : 20, faction: 'friendly', x: n.x, z: n.z, facing: n.facing ?? 0, model: buildModel(n.m), radius: 0.5 });
  u.npc = n;
  u.title = n.title;
  u.guard = !!n.guard;
  u.spiritHealer = !!n.spiritHealer;
  u.home.facing = n.facing ?? 0;
  u.tpl = u.guard ? GUARD_TPL : NPC_TPL;
  if (u.guard) u.threat = null;
  u.recalc();
  u.hp = u.maxHp;
  u.addToScene();
  return u;
}

// ---------- objects ----------
function createObject(def) {
  let x = def.x, z = def.z;
  if (def.r) {
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * def.r;
      const tx = def.x + Math.cos(a) * d, tz = def.z + Math.sin(a) * d;
      if (blockedPoint(tx, tz, 1) || heightAt(tx, tz) < 0.1) continue;
      x = tx; z = tz; break;
    }
  }
  const mesh = objectModel(def.kind, def.color);
  const y = inDungeon(x) ? 0 : heightAt(x, z);
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  const glow = new THREE.Sprite(sparkleMat());
  glow.scale.setScalar(1.4);
  glow.position.y = 1.2;
  mesh.add(glow);
  G.scene.add(mesh);
  const o = { def, x, z, y, mesh, glow, active: true, respawnAt: 0, name: def.name, isObject: true, pos: { x, z } };
  mesh.traverse((c) => { c.userData.object = o; });
  G.objects.push(o);
  return o;
}
export function objectUsable(o) {
  const p = G.player;
  if (!o.active || !p) return false;
  if (o.def.always) return true;
  if (o.def.item) return wantsQuestItem(p, o.def.item);
  if (o.def.credit) return wantsUse(p, o.def.credit);
  return false;
}
export function useObject(o) {
  const p = G.player;
  if (!objectUsable(o)) return;
  if (o.def.portal) return usePortal(o.def.portal);
  o.active = false;
  o.respawnAt = G.time + 25;
  o.mesh.visible = false;
  if (o.def.item) { addItem(p, o.def.item, 1); emit('loot', { unit: p, item: o.def.item, count: 1 }); }
  if (o.def.credit) creditUse(p, o.def.credit);
  if (o.def.freesVillager) freeVillager(o);
  fx.burst({ x: o.x, y: o.y + 1, z: o.z }, 0xffe080, 16, 3);
}
function freeVillager(o) {
  const v = new Unit({ kind: 'npc', name: 'Grateful Woodcutter', level: 8, faction: 'friendly', x: o.x, z: o.z, model: buildModel({ t: 'human', skin: 0xe0b48c, hair: 0x5a3a1e, shirt: 0x8a6a4a, pants: 0x4a4a3a }) });
  v.tpl = NPC_TPL;
  v.npc = { gossip: 'Thank you! Thank you!' };
  v.recalc();
  v.addToScene();
  v.freedRun = { dx: Math.sign(-330 - o.x) || 1, until: G.time + 6 };
  emit('say', { unit: v, text: pick(['Thank the Light! I thought I was done for!', 'Free! Oh, thank you, stranger!', 'I can feel my legs again! Thank you!']) });
}

// ---------- death ----------
let corpseMesh = null;
function onPlayerDeath(p) {
  p.deathPos = { x: p.pos.x, z: p.pos.z, inDungeon: inDungeon(p.pos.x) };
  damageGear(p, 0.1);
  p.cast = null;
  p.autoAttack = p.autoShot = false;
  p.target = null;
  if (p.pet) { p.pet.target = null; p.pet.order = 'follow'; }
  emit('playerDead', { unit: p });
}
export function releaseSpirit() {
  const p = G.player;
  if (!p.dead || p.ghost) return;
  const gy = nearestGraveyard(p.deathPos);
  // leave a corpse behind
  corpseMesh = buildModel(characterSpec(p));
  animate(corpseMesh, 1, { time: 0, dead: true });
  animate(corpseMesh, 1, { time: 0, dead: true });
  corpseMesh.root.position.set(p.deathPos.x, inDungeon(p.deathPos.x) ? 0 : heightAt(p.deathPos.x, p.deathPos.z), p.deathPos.z);
  corpseMesh.root.rotation.y = p.facing;
  G.scene.add(corpseMesh.root);
  p.ghost = true;
  p.dead = false;
  p.hp = 1;
  p.removeAurasWhere(() => true, 'release');
  if (p.pet) dismissPet(p, true);
  for (const m of G.units) m.threat?.delete(p);
  setPos(p, gy.x, gy.z);
  p.corpse = { x: p.deathPos.x, z: p.deathPos.z };
  emit('ghost', { unit: p, on: true });
  updateSpiritHealers();
}
export function nearestGraveyard(pos) {
  if (pos.inDungeon) return GRAVEYARDS.find((g) => g.spire);
  let best = GRAVEYARDS[0], bd = 1e9;
  for (const g of GRAVEYARDS) {
    const d = Math.hypot(g.x - pos.x, g.z - pos.z);
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}
export function canResurrect() {
  const p = G.player;
  if (!p?.ghost || !p.corpse) return false;
  return Math.hypot(p.pos.x - p.corpse.x, p.pos.z - p.corpse.z) < 30;
}
export function resurrectAtCorpse() {
  const p = G.player;
  if (!canResurrect()) return;
  setPos(p, p.corpse.x, p.corpse.z);
  revive(p, 0.5);
}
export function spiritHealerRes() {
  const p = G.player;
  if (!p.ghost) return;
  revive(p, 0.5);
  damageGear(p, 0.25);
  if (p.level >= 10) p.addAura({ id: 'res_sickness', name: 'Resurrection Sickness', icon: 'skull', dur: 600, debuff: true, pct: { str: -0.75, agi: -0.75, sta: -0.75, int: -0.75, spi: -0.75 } }, p);
}
function revive(p, frac) {
  p.ghost = false;
  p.dead = false;
  p.corpse = null;
  p.recalc();
  p.hp = Math.round(p.maxHp * frac);
  p.mana = Math.round(p.maxMana * frac);
  p.rage = 0;
  if (corpseMesh) { G.scene.remove(corpseMesh.root); corpseMesh = null; }
  fx.rise(p, 0xffffff, 40);
  emit('ghost', { unit: p, on: false });
  updateSpiritHealers();
}
function updateSpiritHealers() {
  const ghost = G.player?.ghost;
  for (const u of G.units) if (u.spiritHealer) u.group.visible = !!ghost;
}

// ---------- travel ----------
export function setPos(u, x, z, facing) {
  u.pos.x = x; u.pos.z = z;
  u.y = inDungeon(x) ? 0 : u.groundAt(x, z);
  u.vy = 0;
  if (facing !== undefined) u.facing = facing;
  u.dash = null;
  if (u.pet && !u.pet.dead) { u.pet.pos.x = x - 1.5; u.pet.pos.z = z - 1.5; u.pet.y = u.y; }
  for (const c of G.party) if (!c.dead) { c.pos.x = x + rand(-2, 2); c.pos.z = z + rand(-2, 2); c.y = u.y; }
  emit('teleport', { unit: u });
}
export function teleportHome(u) {
  const b = u.bind ?? { x: 22, z: 289 };
  setPos(u, b.x, b.z);
}
export function usePortal(kind) {
  const p = G.player;
  if (kind === 'spire_in') {
    const alive = G.units.some((m) => m.kind === 'mob' && m.spawn?.dungeon && !m.dead);
    if (!alive || G.time - dungeonResetAt > 1800) resetDungeon();
    setPos(p, DUNGEON.entrance.x, DUNGEON.entrance.z, DUNGEON.entrance.facing);
    emit('zoneText', { text: 'The Hollow Spire', sub: 'Dungeon' });
  } else if (kind === 'spire_out') {
    setPos(p, DUNGEON.exitTo.x, DUNGEON.exitTo.z, DUNGEON.exitTo.facing);
  }
}
// Flight: glide along a raised path between flight masters.
export function flightCost(from, to) {
  return Math.round(Math.hypot(to.x - from.x, to.z - from.z) * 0.6);
}
export function startFlight(u, toId) {
  const from = nearestFlightPoint(u);
  const to = FLIGHT_POINTS.find((f) => f.id === toId);
  if (!from || !to) return;
  const cost = flightCost(from, to);
  if (u.money < cost) { emit('error', 'You don\'t have enough money.'); return; }
  u.money -= cost;
  emit('money', { unit: u });
  const pts = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
    pts.push({ x, z });
  }
  // a glide height that clears every ridge along the way
  let maxH = 0;
  for (const p of pts) maxH = Math.max(maxH, heightAt(p.x, p.z));
  u.flight = { pts, i: 0, t: 0, h: maxH + 25, to };
  u.flying = true;
  u.autoAttack = false;
  u.target = null;
  if (u.pet) dismissPet(u, true);
  const bird = buildModel({ t: 'bird', color: 0x8a6a4a, headColor: 0xe8e0d0, wing: 0x6a4a2a, span: 2.2, hover: 0, scale: 1.6 });
  bird.root.position.y = -0.6;
  u.group.add(bird.root);
  u.flight.bird = bird;
  emit('flightStart', { unit: u });
}
export function nearestFlightPoint(u) {
  let best = null, bd = 1e9;
  for (const f of FLIGHT_POINTS) { const d = Math.hypot(f.x - u.pos.x, f.z - u.pos.z); if (d < bd) { bd = d; best = f; } }
  return best;
}
function updateFlight(u, dt) {
  const f = u.flight;
  const speed = 45;
  let move = speed * dt;
  while (move > 0 && f.i < f.pts.length - 1) {
    const a = f.pts[f.i], b = f.pts[f.i + 1];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    const rem = seg * (1 - f.t);
    if (move < rem) { f.t += move / seg; move = 0; } else { move -= rem; f.i++; f.t = 0; }
  }
  const a = f.pts[Math.min(f.i, f.pts.length - 1)], b = f.pts[Math.min(f.i + 1, f.pts.length - 1)];
  u.pos.x = a.x + (b.x - a.x) * f.t;
  u.pos.z = a.z + (b.z - a.z) * f.t;
  const prog = (f.i + f.t) / (f.pts.length - 1);
  const ground = heightAt(u.pos.x, u.pos.z);
  const climb = Math.min(1, prog * 6, (1 - prog) * 6);
  u.y = ground + (f.h - ground) * climb + 1;
  if (b !== a) u.facing = Math.atan2(b.x - a.x, b.z - a.z);
  u.moving = 0;
  u.sitting = true;
  animate(f.bird, dt, { time: G.time, flying: true });
  if (f.i >= f.pts.length - 1) {
    u.group.remove(f.bird.root);
    u.flight = null;
    u.flying = false;
    u.sitting = false;
    setPos(u, f.to.x + 2, f.to.z + 2);
    emit('flightEnd', { unit: u });
  }
}

// ---------- per-frame world update ----------
let zoneT = 0, lastZone = null, lastSub = null;
export function updateWorld(dt) {
  const p = G.player;
  // respawns
  for (let i = respawns.length - 1; i >= 0; i--) {
    if (G.time >= respawns[i].at) {
      const r = respawns.splice(i, 1)[0];
      const near = p && Math.hypot(p.pos.x - r.sp.x, p.pos.z - r.sp.z) < 25 && r.sp.r < 5;
      if (near) { respawns.push({ sp: r.sp, at: G.time + 20 }); continue; }
      spawnFromEntry(r.sp);
    }
  }
  // corpses
  for (const u of [...G.units]) {
    if (u.kind === 'mob' && u.dead && G.time > u.corpseUntil) u.removeFromScene();
    if (u.freedRun) {
      u.moving = 6;
      u.facing = u.freedRun.dx > 0 ? Math.PI / 2 : -Math.PI / 2;
      u.moveBy(u.freedRun.dx * 6 * dt, 0);
      if (G.time > u.freedRun.until) u.removeFromScene();
    }
  }
  // objects
  for (const o of G.objects) {
    if (!o.active && G.time > o.respawnAt) { o.active = true; o.mesh.visible = true; }
    o.glow.visible = objectUsable(o);
    if (!o.def.always) o.mesh.visible = o.active && (objectUsable(o) || o.def.kind === 'portal');
    o.glow.material.opacity = 0.6 + Math.sin(G.time * 3) * 0.3;
  }
  if (!p) return;
  if (p.flight) updateFlight(p, dt);
  // zone and subzone discovery
  zoneT -= dt;
  if (zoneT <= 0) {
    zoneT = 0.5;
    const z = zoneAt(p.pos.x, p.pos.z);
    if (z !== lastZone) {
      lastZone = z;
      const Z = ZONES[z];
      G.zoneName = Z?.name;
      if (Z && !Z.dungeon) emit('zoneText', { text: Z.name, sub: `Level ${Z.levels[0]}-${Z.levels[1]}` });
      emit('zoneChanged', { zone: z });
    }
    for (const s of SUBZONES) {
      if (Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < s.r) {
        if (lastSub !== s.id) { lastSub = s.id; emit('subzone', { name: s.name }); }
        creditExplore(p, s.id);
        if (!p.explored[s.id]) {
          p.explored[s.id] = true;
          const xp = p.level >= MAX_LEVEL ? 0 : Math.round(10 + p.level * 12);
          emit('zoneText', { text: s.name, sub: 'Discovered', small: true });
          if (xp) { gainXP(p, xp, 'explore'); emit('system', `Discovered ${s.name}: ${xp} experience gained.`); }
        }
        break;
      }
    }
    // resting near an innkeeper
    p.resting = G.units.some((n) => n.npc?.innkeeper && distance(n, p) < 14) && !p.inCombat;
  }
}
export { TOWNS };
