// Player input, movement and the third-person camera.
import * as THREE from '../lib/three.module.min.js';
import { G, emit, on } from '../state.js';
import { clamp, normAngle, lerp } from '../util.js';
import { heightAt } from './terrain.js';
import { inDungeon } from './collision.js';
import { canAttack, distance, friendly, rangeTo, inMeleeRange } from './combat.js';
import { castAbility, ABILITIES, knownRank } from './spells.js';
import { updateDash } from './summons.js';
import { takeAll, lootEmpty, objectUsable, useObject } from './world.js';

export const cam = { yaw: Math.PI, pitch: 0.32, dist: 11, want: 11, dragging: false, follow: true };
export const input = { keys: new Set(), mouse: { l: false, r: false, x: 0, y: 0, downX: 0, downY: 0, moved: 0 }, joy: { x: 0, y: 0, active: false }, autorun: false, mouseTurn: false };

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let canvas;

export function initInput(cv) {
  canvas = cv;
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (!input.keys.has(k)) onKeyPress(k, e);
    input.keys.add(k);
    if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.l = input.mouse.r = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('mousedown', (e) => {
    const m = input.mouse;
    if (e.button === 0) m.l = true;
    if (e.button === 2) m.r = true;
    m.x = m.downX = e.clientX; m.y = m.downY = e.clientY; m.moved = 0;
  });
  window.addEventListener('mousemove', (e) => {
    const m = input.mouse;
    const dx = e.clientX - m.x, dy = e.clientY - m.y;
    m.x = e.clientX; m.y = e.clientY;
    if (m.l || m.r) {
      m.moved += Math.abs(dx) + Math.abs(dy);
      if (m.moved > 4) {
        cam.yaw -= dx * 0.006;
        cam.pitch = clamp(cam.pitch + dy * 0.005, -0.6, 1.35);
        cam.dragging = true;
      }
    }
    hoverPick(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', (e) => {
    const m = input.mouse;
    const click = m.moved <= 4;
    if (e.button === 0) { m.l = false; if (click && e.target === canvas) clickPick(e.clientX, e.clientY, false); }
    if (e.button === 2) { m.r = false; if (click && e.target === canvas) clickPick(e.clientX, e.clientY, true); }
    if (!m.l && !m.r) cam.dragging = false;
  });
  cv.addEventListener('wheel', (e) => { cam.want = clamp(cam.want + Math.sign(e.deltaY) * 1.5, 2.5, 32); e.preventDefault(); }, { passive: false });
  initTouch(cv);
}

// ---------- touch: left joystick, right-side camera drag, tap to target ----------
const touches = new Map();
let pinch = null;
function initTouch(cv) {
  const joyEl = document.getElementById('joystick');
  const knob = document.getElementById('joyKnob');
  cv.addEventListener('touchstart', (e) => {
    G.isTouch = true;
    document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      const leftSide = t.clientX < window.innerWidth * 0.42 && t.clientY > window.innerHeight * 0.35;
      if (leftSide && !input.joy.active) {
        input.joy.active = true;
        input.joy.id = t.identifier;
        input.joy.cx = t.clientX; input.joy.cy = t.clientY;
        if (joyEl) { joyEl.style.left = t.clientX + 'px'; joyEl.style.top = t.clientY + 'px'; joyEl.classList.add('on'); }
        touches.set(t.identifier, { kind: 'joy' });
      } else {
        touches.set(t.identifier, { kind: 'cam', x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, moved: 0, t0: performance.now() });
      }
    }
    const cams = [...touches.values()].filter((v) => v.kind === 'cam');
    if (cams.length === 2) pinch = { d: Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y), want: cam.want };
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      const tr = touches.get(t.identifier);
      if (!tr) continue;
      if (tr.kind === 'joy') {
        let dx = t.clientX - input.joy.cx, dy = t.clientY - input.joy.cy;
        const len = Math.hypot(dx, dy), max = 55;
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        input.joy.x = dx / max; input.joy.y = dy / max;
        if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        const dx = t.clientX - tr.x, dy = t.clientY - tr.y;
        tr.x = t.clientX; tr.y = t.clientY;
        tr.moved += Math.abs(dx) + Math.abs(dy);
        const cams = [...touches.values()].filter((v) => v.kind === 'cam');
        if (cams.length === 2 && pinch) {
          const d = Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y);
          cam.want = clamp(pinch.want * (pinch.d / Math.max(20, d)), 2.5, 32);
        } else if (tr.moved > 8) {
          cam.yaw -= dx * 0.008;
          cam.pitch = clamp(cam.pitch + dy * 0.006, -0.6, 1.35);
          cam.dragging = true;
        }
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      const tr = touches.get(t.identifier);
      if (!tr) continue;
      if (tr.kind === 'joy') {
        input.joy.active = false; input.joy.x = input.joy.y = 0;
        if (knob) knob.style.transform = '';
        if (joyEl) joyEl.classList.remove('on');
      } else if (tr.moved < 10 && performance.now() - tr.t0 < 400) {
        tapPick(t.clientX, t.clientY);
      }
      touches.delete(t.identifier);
    }
    if ([...touches.values()].filter((v) => v.kind === 'cam').length < 2) pinch = null;
    if (![...touches.values()].some((v) => v.kind === 'cam')) cam.dragging = false;
    e.preventDefault();
  };
  cv.addEventListener('touchend', end, { passive: false });
  cv.addEventListener('touchcancel', end, { passive: false });
}

// ---------- picking ----------
function pickAt(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, G.camera);
  const targets = [];
  const p = G.player;
  for (const u of G.units) {
    if (u === p || !u.group.visible) continue;
    if (p && distance(u, p) > 90) continue;
    targets.push(u.group);
  }
  for (const o of G.objects) if (o.mesh.visible && p && Math.hypot(o.x - p.pos.x, o.z - p.pos.z) < 60) targets.push(o.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    let n = h.object;
    while (n && !n.userData.unit && !n.userData.object) n = n.parent;
    if (n?.userData.unit) return n.userData.unit;
    if (n?.userData.object) return n.userData.object;
  }
  return null;
}
let hoverT = 0;
function hoverPick(x, y) {
  const now = performance.now();
  if (now - hoverT < 60 || !G.running) return;
  hoverT = now;
  const h = pickAt(x, y);
  G.hoverUnit = h?.isObject ? null : h;
  G.hoverObject = h?.isObject ? h : null;
  let cur = 'default';
  if (h?.isObject) cur = 'pointer';
  else if (h) {
    if (h.dead && h.loot) cur = 'copy';
    else if (canAttack(G.player, h)) cur = 'crosshair';
    else if (h.kind === 'npc') cur = 'help';
  }
  canvas.style.cursor = cur;
  emit('hover', h);
}
function clickPick(x, y, right) {
  const h = pickAt(x, y);
  if (!h) { if (!right) setTarget(null); return; }
  if (h.isObject) { if (right || true) interactObject(h); return; }
  setTarget(h);
  if (right) interact(h);
}
let lastTap = { unit: null, t: 0 };
function tapPick(x, y) {
  const h = pickAt(x, y);
  if (!h) { const g = groundAt(x, y); if (g) moveTo(g.x, g.z); return; }
  if (h.isObject) { interactObject(h); return; }
  const now = performance.now();
  const again = G.player.target === h && (now - lastTap.t < 1500 || h.kind === 'npc' || (h.dead && h.loot));
  setTarget(h);
  if (again) interact(h);
  lastTap = { unit: h, t: now };
}

// Ground point under a screen position, found by marching the camera ray.
function groundAt(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, G.camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const dungeon = G.player && inDungeon(G.player.pos.x);
  let prev = 0;
  for (let t = 1; t < 160; t += 0.75) {
    const px = o.x + d.x * t, pz = o.z + d.z * t, py = o.y + d.y * t;
    const gy = dungeon ? 0 : heightAt(px, pz);
    if (py <= gy) {
      // refine between the last two steps
      const tt = (prev + t) / 2;
      return { x: o.x + d.x * tt, z: o.z + d.z * tt };
    }
    prev = t;
  }
  return null;
}

// Walk to a unit, object or spot, then run a callback (talk, loot, attack).
// Any manual movement cancels it.
let marker = null;
export function approach(target, range, then) {
  const p = G.player;
  if (!p || p.dead) return;
  p.approach = { target, range, then, t0: G.time };
}
export function moveTo(x, z) {
  const p = G.player;
  if (!p || p.dead || p.flight) return;
  p.approach = { x, z, range: 0.7, t0: G.time };
  if (!marker) {
    marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    marker.renderOrder = 3;
    G.scene.add(marker);
  }
  marker.position.set(x, (inDungeon(x) ? 0 : heightAt(x, z)) + 0.08, z);
  marker.visible = true;
  marker.userData.t = 0;
}
function approachDone(p, a) {
  const t = a.target;
  if (!t) return Math.hypot(a.x - p.pos.x, a.z - p.pos.z) <= a.range;
  if (a.range === 'melee') return inMeleeRange(p, t);
  const tx = t.pos ? t.pos.x : t.x, tz = t.pos ? t.pos.z : t.z;
  return Math.hypot(tx - p.pos.x, tz - p.pos.z) - (t.radius ?? 0.5) <= a.range;
}
function approachGone(p, a) {
  const t = a.target;
  if (G.time - a.t0 > 20) return true;
  if (!t) return false;
  if (t.pos) {
    if (!G.units.includes(t)) return true;
    if (a.range === 'melee' && (t.dead || !canAttack(p, t))) return true;
    return distance(p, t) > 80;
  }
  return Math.hypot(t.x - p.pos.x, t.z - p.pos.z) > 80;
}

export function setTarget(u) {
  const p = G.player;
  if (!p) return;
  if (p.target && p.target !== u) p.target.showRing(null);
  if (u && u.ghost) u = null;
  if (p.target !== u) { p.autoShot = p.autoShot && !!u && u === p.target; if (!u) p.autoAttack = false; }
  p.target = u;
  if (u) u.showRing(u.dead ? null : canAttack(p, u) ? (u.faction === 'neutral' && !u.threat?.size ? 'neutral' : 'hostile') : 'friendly');
  emit('targetChanged', { unit: u });
}

export function interact(u) {
  const p = G.player;
  if (!u || !p || p.dead || p.flying) return;
  if (u.dead && u.kind === 'mob') {
    if (!u.loot || lootEmpty(u)) return;
    if (distance(p, u) > 6) {
      if (G.isTouch) approach(u, 3.5, () => interact(u));
      else emit('error', 'You are too far away.');
      return;
    }
    if (G.isTouch || G.settings?.autoLoot) {
      takeAll(u);
      if (u.loot && !lootEmpty(u)) emit('openLoot', { unit: u });
      return;
    }
    emit('openLoot', { unit: u });
    return;
  }
  if (canAttack(p, u) && !p.ghost) {
    if (p.cls === 'hunter' && p.weapon('ranged').type && ['bow', 'gun'].includes(p.weapon('ranged').type) && rangeTo(p, u) > 7) {
      if (!p.autoShot) castAbility(p, 'auto_shot', u);
    } else if (['priest', 'mage', 'warlock'].includes(p.cls) && p.weapon('ranged').type === 'wand' && rangeTo(p, u) > 6) {
      if (!p.autoShot) castAbility(p, 'shoot', u);
    } else {
      p.autoAttack = true;
      p.autoShot = false;
      if (G.isTouch && !inMeleeRange(p, u)) approach(u, 'melee');
    }
    if (p.pet && p.pet.mode !== 'passive') { p.pet.target = u; p.pet.order = 'attack'; }
    return;
  }
  if (u.kind === 'npc' && !u.guard) {
    if (u.spiritHealer && !p.ghost) return;
    if (distance(p, u) > 6) {
      if (G.isTouch) approach(u, 3.5, () => interact(u));
      else emit('error', 'You are too far away.');
      return;
    }
    if (u.npc?.gossip && u.name === 'Grateful Woodcutter') return;
    emit('openGossip', { unit: u });
    return;
  }
  if (u.kind === 'npc' && u.guard) {
    if (distance(p, u) < 8) emit('say', { unit: u, text: 'Stay out of trouble, citizen. The inn is in the town center if you need rest.' });
  }
}
export function interactObject(o) {
  const p = G.player;
  if (!objectUsable(o) || p.dead) return;
  if (Math.hypot(o.x - p.pos.x, o.z - p.pos.z) > 6) {
    if (G.isTouch) approach(o, 3, () => interactObject(o));
    else emit('error', 'You are too far away.');
    return;
  }
  if (o.def.portal) { useObject(o); return; }
  if (p.inCombat) { emit('error', "You can't do that while in combat."); return; }
  p.cast = {
    ability: { id: 'opening', name: 'Opening', school: 'physical', icon: 'hand' }, rd: {}, target: p, start: G.time, total: 1.5, end: G.time + 1.5, channel: true, ticks: 0, nextTick: Infinity,
    onDone: () => useObject(o),
  };
  emit('castStart', { unit: p });
}

export function cycleTarget() {
  const p = G.player;
  if (!p) return;
  const cands = G.units.filter((u) => !u.dead && canAttack(p, u) && u.kind !== 'npc' && distance(p, u) < 40 && u.group.visible)
    .map((u) => {
      const a = Math.atan2(u.pos.x - p.pos.x, u.pos.z - p.pos.z);
      const front = Math.abs(normAngle(a - p.facing)) < Math.PI / 2 || Math.abs(normAngle(a - (cam.yaw + Math.PI))) < Math.PI / 2;
      return { u, d: distance(p, u) + (front ? 0 : 30) };
    })
    .sort((a, b) => a.d - b.d).map((c) => c.u);
  if (!cands.length) return;
  const i = cands.indexOf(p.target);
  setTarget(cands[(i + 1) % Math.min(cands.length, 6)]);
}
export function targetNearestFriend() {
  const p = G.player;
  const cands = G.units.filter((u) => !u.dead && u !== p && (u.kind === 'companion' || u.kind === 'pet') && distance(p, u) < 40).sort((a, b) => distance(p, a) - distance(p, b));
  if (cands.length) setTarget(cands[0]);
}

// ---------- key presses ----------
const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
function onKeyPress(k, e) {
  const p = G.player;
  if (!p || !G.running) return;
  if (k === 'escape') { emit('escape'); return; }
  if (G.ui?.modalOpen?.()) return;
  const bi = BAR_KEYS.indexOf(k);
  if (bi >= 0) { emit('useBar', { bar: e.shiftKey ? 2 : 1, index: bi }); return; }
  switch (k) {
    case 'tab': cycleTarget(); break;
    case 'f': if (p.target) interact(p.target); else { const n = nearestInteractable(); if (n) n.isObject ? interactObject(n) : (setTarget(n), interact(n)); } break;
    case 't': if (p.target && canAttack(p, p.target)) interact(p.target); break;
    case 'x': if (!p.inCombat) { p.sitting = !p.sitting; } break;
    case 'r': case 'numlock': input.autorun = !input.autorun; break;
    case 'c': emit('toggleWindow', 'character'); break;
    case 'b': emit('toggleWindow', 'bags'); break;
    case 'p': emit('toggleWindow', 'spellbook'); break;
    case 'n': emit('toggleWindow', 'talents'); break;
    case 'l': emit('toggleWindow', 'quests'); break;
    case 'm': emit('toggleWindow', 'map'); break;
    case 'v': G.settings.nameplates = !G.settings.nameplates; break;
    case 'f1': setTarget(p); break;
    case 'f2': targetNearestFriend(); break;
  }
}
export function nearestInteractable() {
  const p = G.player;
  let best = null, bd = 6;
  for (const u of G.units) {
    if (u === p) continue;
    const d = distance(p, u);
    if (d > bd) continue;
    if ((u.kind === 'npc' && !u.guard && (!u.spiritHealer || p.ghost)) || (u.dead && u.loot)) { best = u; bd = d; }
  }
  for (const o of G.objects) {
    if (!objectUsable(o)) continue;
    const d = Math.hypot(o.x - p.pos.x, o.z - p.pos.z);
    if (d < bd) { best = o; bd = d; }
  }
  return best;
}

// ---------- per-frame movement ----------
export function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  const k = input.keys;
  if (p.flight) return;
  if (p.dead) { p.moving = 0; return; }
  if (updateDash(p, dt)) return;
  if (p.hasFlag('fear')) { G.fearMove?.(p, dt); return; }
  if (!p.canAct() && !p.ghost) { p.moving = 0; return; }
  const both = input.mouse.l && input.mouse.r;
  let fwd = 0, strafe = 0, turn = 0;
  if (k.has('w') || k.has('arrowup') || both) fwd += 1;
  if (k.has('s') || k.has('arrowdown')) fwd -= 1;
  if (k.has('q')) strafe -= 1;
  if (k.has('e')) strafe += 1;
  const mouseSteer = input.mouse.r;
  if (k.has('a') || k.has('arrowleft')) { if (mouseSteer) strafe -= 1; else turn += 1; }
  if (k.has('d') || k.has('arrowright')) { if (mouseSteer) strafe += 1; else turn -= 1; }
  if (input.autorun) fwd = Math.max(fwd, 1);
  if (fwd < 0 || both) input.autorun = input.autorun && !both && fwd >= 0;
  if (mouseSteer) p.facing = cam.yaw + Math.PI;
  if (turn) {
    p.facing += turn * dt * 3.2;
    if (!cam.dragging) cam.yaw = p.facing + Math.PI - (normAngle(p.facing + Math.PI - cam.yaw) * Math.exp(-dt * 6));
  }
  let mx = 0, mz = 0, speedMul = 1;
  if (fwd || strafe) {
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const sx = Math.sin(p.facing - Math.PI / 2), sz = Math.cos(p.facing - Math.PI / 2);
    mx = fx * fwd + sx * strafe; mz = fz * fwd + sz * strafe;
    const l = Math.hypot(mx, mz);
    mx /= l; mz /= l;
    if (fwd < 0) speedMul = 0.6;
  }
  // touch joystick: move relative to the camera, face the direction of travel
  if (input.joy.active && Math.hypot(input.joy.x, input.joy.y) > 0.15) {
    const mag = Math.min(1, Math.hypot(input.joy.x, input.joy.y));
    const camF = cam.yaw + Math.PI;
    const a = camF + Math.atan2(input.joy.x, -input.joy.y);
    mx = Math.sin(a); mz = Math.cos(a);
    p.facing = turnToward(p.facing, a, dt * 10);
    speedMul = mag < 0.55 ? 0.45 : 1;
  }
  const manual = fwd || strafe || turn || (input.joy.active && Math.hypot(input.joy.x, input.joy.y) > 0.15);
  if (manual && p.approach) p.approach = null;
  if (!manual && p.approach) {
    const a = p.approach;
    if (approachGone(p, a)) p.approach = null;
    else if (approachDone(p, a)) {
      p.approach = null;
      if (a.target?.pos && a.target !== p) p.faceTowards?.(a.target);
      a.then?.();
    } else if (!p.cast || p.cast.ability?.castWhileMoving) {
      const tx = a.target ? (a.target.pos ? a.target.pos.x : a.target.x) : a.x;
      const tz = a.target ? (a.target.pos ? a.target.pos.z : a.target.z) : a.z;
      const ang = Math.atan2(tx - p.pos.x, tz - p.pos.z);
      mx = Math.sin(ang); mz = Math.cos(ang);
      p.facing = turnToward(p.facing, ang, dt * 10);
      speedMul = 1;
    }
  }
  if (marker?.visible && (!p.approach || p.approach.target)) marker.visible = false;
  const rooted = p.hasFlag('root') || (p.cast && !p.ghost && p.cast.ability?.id === 'opening' && false);
  if ((mx || mz) && !rooted) {
    if (p.sitting) { p.sitting = false; }
    if (p.cast && !p.cast.ability?.castWhileMoving) { p.interruptCast(); }
    const sp = p.speed() * speedMul;
    if (!p.moveBy(mx * sp * dt, mz * sp * dt)) {
      // slide along walls and slopes
      if (!p.moveBy(mx * sp * dt, 0)) p.moveBy(0, mz * sp * dt);
    }
    p.moving = sp;
    if (!cam.dragging && cam.follow && !input.mouse.l) {
      const behind = p.facing + Math.PI;
      if (p.approach) cam.yaw = behind + normAngle(cam.yaw - behind) * Math.exp(-dt * 1.2);
      else if (!input.joy.active) cam.yaw = behind + normAngle(cam.yaw - behind) * Math.exp(-dt * 2.5);
      else if (fwd === 0) cam.yaw = behind + normAngle(cam.yaw - behind) * Math.exp(-dt * 0.8);
    }
  } else p.moving = 0;
  if ((k.has(' ') || input.jump) && !p.airborne && !p.swimming && !rooted) {
    p.vy = 8.2;
    p.airborne = true;
    p.y += 0.05;
    input.jump = false;
    if (p.cast) p.interruptCast();
  }
}
function turnToward(cur, target, maxStep) {
  const d = normAngle(target - cur);
  return cur + clamp(d, -maxStep, maxStep);
}

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
export function updateCamera(dt) {
  const p = G.player;
  if (!p) return;
  cam.dist = lerp(cam.dist, cam.want, Math.min(1, dt * 8));
  const h = (p.flight ? 2.5 : Math.min(2.4, (p.height ?? 1.8) * 0.9)) + 0.2;
  camTarget.set(p.pos.x, p.y + h, p.pos.z);
  let d = cam.dist;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const dirX = Math.sin(cam.yaw) * cp, dirZ = Math.cos(cam.yaw) * cp;
  // pull the camera in if terrain or a dungeon wall is in the way
  const dungeon = inDungeon(p.pos.x);
  for (let s = 1; s <= 8; s++) {
    const t = (d * s) / 8;
    const x = camTarget.x + dirX * t, z = camTarget.z + dirZ * t, y = camTarget.y + sp * t;
    const ground = dungeon ? 0 : heightAt(x, z);
    if (y < ground + 0.4 && !dungeon) { d = Math.max(1.5, t - 0.5); break; }
    if (dungeon && !G.dungeonWalkable?.(x, z, 0.3)) { d = Math.max(1.5, t - 0.8); break; }
  }
  camPos.set(camTarget.x + dirX * d, camTarget.y + sp * d, camTarget.z + dirZ * d);
  if (!dungeon) camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + 0.5);
  else camPos.y = Math.min(camPos.y, 7);
  G.camera.position.copy(camPos);
  G.camera.lookAt(camTarget);
  // fade the player model out when the camera is very close
  if (p.model) p.model.root.visible = d > 1.3;
}

export function clearInput() { input.keys.clear(); input.joy.active = false; input.joy.x = input.joy.y = 0; input.autorun = false; if (G.player) G.player.approach = null; }
void heightAt; void friendly; void ABILITIES; void knownRank; void takeAll;
