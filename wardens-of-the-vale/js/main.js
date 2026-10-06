// Boot, character creation/loading and the main loop.
import { G, emit, on } from './state.js';
import './data/abilities/index.js';
import { initScene, updateScene, render, setPixelRatio, applyQuality } from './engine/scene.js';
import { preset, QUALITY_ORDER } from './engine/gfx.js';
import { initFx, updateFx } from './engine/fx.js';
import { heightAt } from './engine/terrain.js';
import { dungeonWalkable } from './engine/collision.js';
import { Unit } from './engine/unit.js';
import { CLASSES } from './data/classes.js';
import { ABILITIES, updateCasting, updateAutoAttack, updateProjectiles } from './engine/spells.js';
import { initInventory, addItem } from './engine/inventory.js';
import { applyTalents } from './data/talents.js';
import { refreshCharacterModel } from './engine/appearance.js';
import { setStance, setForm, updateTraps, callPet, summonDemon } from './engine/summons.js';
import { initWorld, updateWorld, setPos, teleportHome, nearestGraveyard } from './engine/world.js';
import { updateAI, fearMove } from './engine/ai.js';
import { updateCompanion, hire, syncPartyLevels } from './engine/companions.js';
import { initInput, updatePlayer, updateCamera, cam, setTarget, clearInput } from './engine/player.js';
import { updateRested } from './engine/progression.js';
import { initHud, updateHud, chat, entryTooltip } from './ui/hud.js';
import { initWindows, toggle, closeAll, pickup, dropOnBar, slotMenu, openQuestLog, clearCursor } from './ui/windows.js';
import { initMaps } from './ui/minimap.js';
import { initTouchHud, updateTouchHud } from './ui/touch.js';
import { initQuestie, updateQuestie } from './ui/questie.js';
import { initTutorial, startTutorial, stopTutorial, updateTutorial } from './ui/tutorial.js';
import { initSfx } from './ui/sfx.js';
import { showStart, hideStart } from './ui/charselect.js';
import { saveChar, newSaveId, serialize } from './save.js';
import { getItem } from './data/items.js';
import { DUNGEON } from './data/world.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

function progress(msg, f) {
  $('loadText').textContent = msg;
  if (f !== undefined) $('loadFill').style.width = Math.round(f * 100) + '%';
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  // The game is built for phones: every device gets the touch layout. With a
  // mouse, dragging on the left side works as the thumbstick.
  G.isTouch = true;
  document.body.classList.add('touch');
  progress('Shaping the land…', 0.1);
  await nextFrame();
  let k = 0;
  initScene(canvas, (m) => progress(m, 0.15 + 0.2 * k++));
  progress('Drawing the maps…', 0.7);
  await nextFrame();
  initFx();
  initMaps();
  progress('Populating the Vale…', 0.85);
  await nextFrame();
  initWorld();
  initInput(canvas);
  G.fearMove = fearMove;
  G.dungeonWalkable = dungeonWalkable;
  G.ui = {
    cursor: null, vendorOpen: null, pickup, dropOnBar, slotMenu, entryTooltip, toggle, openQuestLog, setTarget,
    modalOpen: () => !$('startScreen').hidden, logout, replayTutorial: () => startTutorial(true),
  };
  initHud();
  initTouchHud();
  initQuestie();
  initWindows();
  initTutorial();
  initSfx();
  progress('Ready', 1);
  await nextFrame();
  $('loading').hidden = true;
  const hot = window.claude?.hot;
  const restored = hot?.data?.save;
  if (hot?.snapshot) hot.snapshot(() => (G.player ? { save: serialize(G.player) } : {}));
  if (restored) enterWorld({ save: restored });
  else showStart(enterWorld);
  requestAnimationFrame(loop);
}

// ---------- character ----------
function createPlayer(o) {
  const s = o.save;
  const cls = s?.cls ?? o.cls;
  const C = CLASSES[cls];
  const u = new Unit({ kind: 'player', name: s?.name ?? o.name, level: s?.level ?? 1, cls, faction: 'player', x: s?.pos?.x ?? 36, z: s?.pos?.z ?? 294, radius: 0.5 });
  u.saveId = s?.id ?? newSaveId();
  u.look = s?.look ?? o.look;
  u.facing = s?.facing ?? Math.PI;
  const start = { attack: 1 };
  for (const a of C.abilities) start[a] = 1;
  if (['priest', 'mage', 'warlock'].includes(cls)) start.shoot = 1;
  u.spells = s?.spells ?? start;
  u.spells.attack = 1;
  u.talents = s?.talents ?? {};
  const toEntry = (e) => (e && !ABILITIES[e] ? 'item:' + e : e);
  u.bar = s?.bar ?? C.bar.map(toEntry);
  u.bar2 = s?.bar2 ?? new Array(12).fill(null);
  u.quests = s?.quests ?? { active: {}, completed: {} };
  u.explored = s?.explored ?? {};
  u.flightPoints = s?.flightPoints ?? { fp_millbrook: true };
  u.untracked = s?.untracked ?? {};
  u.xp = s?.xp ?? 0;
  u.rested = s?.rested ?? 0;
  u.bind = s?.bind ?? { x: 22, z: 289, name: 'Millbrook' };
  u.data = s?.data ?? {};
  u.played = s?.played ?? 0;
  u.sessionStart = G.time;
  initInventory(u, s);
  if (!s) {
    let mhUsed = false;
    for (const id of C.start.items) {
      const it = getItem(id);
      let slot = it.slot;
      if (slot === 'onehand' || slot === 'twohand' || slot === 'mainhand') { slot = mhUsed ? 'offhand' : 'mainhand'; mhUsed = true; }
      u.equip[slot] = { id, dur: it.dur };
    }
    for (const [id, n] of C.start.bag) addItem(u, id, n);
    addItem(u, 'hearthstone', 1);
  }
  for (const k in s?.cooldowns ?? {}) u.cooldowns[k] = G.time + s.cooldowns[k];
  u.powerType = C.power;
  u.gcdDur = C.gcd;
  u.rage = 0;
  u.energy = 100;
  u.cancelForm = () => setForm(u, null);
  applyTalents(u);
  u.recalc();
  u.hp = s?.hp > 0 ? Math.min(u.maxHp, s.hp) : u.maxHp;
  u.mana = s?.mana !== undefined ? Math.min(u.maxMana, s.mana) : u.maxMana;
  refreshCharacterModel(u);
  return u;
}

function enterWorld(o) {
  const p = createPlayer(o);
  G.player = p;
  if (o.save?.settings) Object.assign(G.settings, o.save.settings);
  if (G.settings.uiScale) document.documentElement.style.setProperty('--ui', G.settings.uiScale);
  p.addToScene();
  if (p.cls === 'warrior') setStance(p, 'battle');
  if (o.save?.inDungeon) setPos(p, DUNGEON.exitTo.x, DUNGEON.exitTo.z);
  else setPos(p, p.pos.x, p.pos.z);
  if (o.save?.deadOnSave) {
    const gy = nearestGraveyard(p.pos);
    setPos(p, gy.x, gy.z);
    p.hp = Math.round(p.maxHp * 0.5);
  }
  if (p.cls === 'hunter' && o.save?.petOut && p.data.petInfo && !p.data.petDead) callPet(p);
  if (p.cls === 'warlock' && o.save?.demonOut) summonDemon(p, o.save.demonOut);
  for (const id of o.save?.party ?? []) hire(id);
  cam.yaw = p.facing + Math.PI;
  hideStart();
  $('hud').hidden = false;
  G.running = true;
  emit('barChanged');
  emit('questsChanged', { unit: p });
  if (o.new) {
    chat(`Welcome to the Vale, ${p.name}.`, 'c-sys');
    chat('Marshal Edda Brightfield, just ahead in the town square, has work for a new recruit. Look for the yellow ! above her head.', 'c-quest');
    saveChar(p);
  } else chat(`Welcome back, ${p.name}.`, 'c-sys');
  startTutorial();
}
function logout() {
  const p = G.player;
  if (!p) return;
  saveChar(p);
  G.running = false;
  stopTutorial();
  closeAll();
  clearCursor();
  clearInput();
  for (const c of [...G.party]) { c.removeFromScene(); }
  G.party.length = 0;
  if (p.pet) { p.pet.removeFromScene(); p.pet = null; }
  for (const t of Object.values(p.totems)) t?.removeFromScene?.();
  for (const m of G.units) m.threat?.clear();
  setTarget(null);
  p.removeFromScene();
  G.player = null;
  $('hud').hidden = true;
  document.body.classList.remove('ghost', 'dead');
  showStart(enterWorld);
}

// ---------- main loop ----------
let last = performance.now(), saveT = 0, fpsT = 0, frames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  try {
    const t0 = performance.now();
    if (G.running && G.player) {
      // tests can fast-forward the simulation; normal play runs one tick per frame
      const n = G.debugSteps ?? 1;
      for (let i = 0; i < n; i++) tick(n > 1 ? 0.05 : dt);
    } else idleCamera(dt);
    const t1 = performance.now();
    G.renderer.info.autoReset = false;
    G.renderer.info.reset();
    render();
    const t2 = performance.now();
    adaptResolution(dt);
    G.perf = { tick: (G.perf?.tick ?? 0) * 0.95 + (t1 - t0) * 0.05, render: (G.perf?.render ?? 0) * 0.95 + (t2 - t1) * 0.05, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
  } catch (e) {
    console.error(e);
  }
  frames++;
  fpsT += dt;
  if (fpsT > 1) { G.fps = frames / fpsT; frames = 0; fpsT = 0; }
}
// Dynamic resolution: drop the render scale when frames run long, raise it
// again when there is headroom. Frame time is measured between animation frames.
// If frames stay slow even at the lowest resolution, drop one quality level
// for this session (the saved choice is left alone).
let slowT = 0, fastT = 0, floorT = 0, warmT = 0;
function adaptResolution(dt) {
  if (window.__noDynRes || !G.running || document.hidden) return;
  warmT += dt;
  if (warmT < 6) return; // shaders are still compiling right after loading
  const P = preset();
  const ms = dt * 1000;
  if (ms > 24) { slowT += dt; fastT = 0; } else if (ms < 15) { fastT += dt; slowT = Math.max(0, slowT - dt); } else { slowT = Math.max(0, slowT - dt * 0.5); fastT = 0; }
  const minPr = Math.min(G.maxPixelRatio, P.minPixelRatio);
  if (slowT > 1.5 && G.pixelRatio > minPr + 0.01) { setPixelRatio(Math.max(minPr, G.pixelRatio - 0.15)); slowT = 0; }
  else if (fastT > 4 && G.pixelRatio < G.maxPixelRatio - 0.01) { setPixelRatio(Math.min(G.maxPixelRatio, G.pixelRatio + 0.1)); fastT = 0; }
  floorT = G.pixelRatio <= minPr + 0.01 && ms > 26 ? floorT + dt : Math.max(0, floorT - dt * 0.5);
  const qi = QUALITY_ORDER.indexOf(G.quality);
  if (floorT > 5 && qi > 0) { floorT = 0; warmT = 0; applyQuality(QUALITY_ORDER[qi - 1], false); }
}
const ACTIVE_R = 130;
// how far away creatures and people are drawn
const UNIT_FAR = { low: 80, medium: 105, high: 150 };
function tick(dt) {
  G.time += dt;
  G.dt = dt;
  const p = G.player;
  updatePlayer(dt);
  const far = Math.min(G.scene.fog.far + 25, UNIT_FAR[G.quality] ?? 120);
  for (const u of [...G.units]) {
    if (!G.units.includes(u)) continue;
    const d = Math.hypot(u.pos.x - p.pos.x, u.pos.z - p.pos.z);
    const active = u === p || d < ACTIVE_R || u.kind === 'pet' || u.kind === 'companion' || (u.inCombat && d < 250);
    if (active) {
      if (u !== p && !u.flight) {
        if (u.kind === 'companion') updateCompanion(u, dt);
        else updateAI(u, dt);
      }
      if (u.kind !== 'totem') {
        if (!u.flight) u.updatePhysics(dt);
        updateCasting(u);
        updateAutoAttack(u, dt);
      }
      u.update(dt);
    } else if (u.kind === 'mob' && (u.hp < u.maxHp || u.dirty)) {
      u.update(dt);
    }
    const vis = d < far && (!u.spiritHealer || p.ghost);
    if (u.group.visible !== vis) { u.group.visible = vis; u.shadow.visible = vis; }
    if (vis) u.syncVisual(dt);
  }
  if (p.level !== G._lastLevel) { G._lastLevel = p.level; syncPartyLevels(); }
  updateProjectiles(dt);
  updateTraps();
  updateWorld(dt);
  updateRested(p, dt);
  updateCamera(dt);
  updateScene(dt);
  updateFx(dt);
  updateHud(dt);
  updateTouchHud(dt);
  updateQuestie(dt);
  updateTutorial(dt);
  saveT += dt;
  if (saveT > 15) { saveT = 0; saveChar(p); }
}
let idleA = 0;
function idleCamera(dt) {
  idleA += dt * 0.05;
  const cx = 40, cz = 300;
  const r = 70;
  const x = cx + Math.sin(idleA) * r, z = cz + Math.cos(idleA) * r;
  G.camera.position.set(x, heightAt(x, z) + 28, z);
  G.camera.lookAt(cx, heightAt(cx, cz) + 4, cz);
  G.time += dt;
  updateScene(dt);
  updateFx(dt);
  for (const u of G.units) {
    const d = Math.hypot(u.pos.x - cx, u.pos.z - cz);
    if (d < 150) { if (u.kind === 'npc') updateAI(u, dt); u.syncVisual(dt); }
  }
}

window.addEventListener('beforeunload', () => { if (G.player) saveChar(G.player); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.player) saveChar(G.player); });
on('levelUp', () => { if (G.player) saveChar(G.player); });
on('questComplete', () => { if (G.player) saveChar(G.player); });

// PWA: cache the game for offline play where service workers are allowed
// (not when embedded in another page's frame).
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && window.self === window.top) {
  try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch { /* not allowed here */ }
}

// handle for automated tests and the browser console
window.__wov = { G };
boot().catch((e) => {
  console.error(e);
  $('loadText').textContent = 'Something went wrong while loading: ' + e.message;
});
void teleportHome;
