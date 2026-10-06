// First-time tutorial: coach marks that teach the touch controls and walk the
// player through their first quest. Each step finishes when the player does
// the thing it asks for, so nothing pauses the game. Progress is saved with
// the character and the tutorial can be replayed from Settings.
import * as THREE from '../lib/three.module.min.js';
import { G, on } from '../state.js';
import { cam, input } from '../engine/player.js';
import { lootEmpty } from '../engine/world.js';
import { canAttack } from '../engine/combat.js';
import { softTarget } from './hud.js';
import { slotEntry } from './touch.js';
import { ABILITIES } from '../engine/spells.js';

const $ = (id) => document.getElementById(id);
const done = (p, id) => !!(p.quests.active[id] || p.quests.completed[id]);
const finished = (p, id) => !!p.quests.completed[id];
const npcUnit = (id) => G.units.find((u) => u.npc?.id === id);
const openWins = () => [...document.querySelectorAll('#windows .win')].filter((w) => !w.hidden);
const footButton = (label) => {
  for (const w of openWins()) for (const b of w.querySelectorAll('.win-foot .btn')) if (b.textContent === label) return b;
  return null;
};
const gossipRow = (cls) => document.querySelector(`#windows .win:not([hidden]) .gossip-opt .gi.${cls}`)?.closest('.gossip-opt') ?? null;
const mainKind = () => $('thMain')?.dataset.kind ?? '';
const CASTERS = new Set(['mage', 'priest', 'warlock', 'druid', 'shaman']);
// the first damaging ability on the visible page of the thumb cluster
function offensiveSlot() {
  for (let k = 0; k < 6; k++) {
    const e = slotEntry(k);
    const ab = e && ABILITIES[e];
    if (ab && !['attack', 'auto_shot', 'shoot'].includes(e) && ab.target === 'enemy' && ab.range !== undefined && !ab.heal) {
      return { el: document.querySelector(`#thCluster .th-slot[data-k="${k}"]`), name: ab.name };
    }
  }
  return null;
}

// Track what the player has done since the step started.
const seen = { moved: 0, looked: 0, jumped: false, gossip: null, kill: false, loot: false, sheet: false };

// focus(p) returns what to point at: { el, label } rings a page element,
// { unit, label } marks someone in the world, { hand } shows a gesture.
const STEPS = [
  {
    id: 'welcome', center: true, title: 'Welcome to the Vale',
    text: 'This short tutorial teaches the controls and gets you started on your first quest. End it any time, and replay it later from Settings.',
    buttons: [['Start tutorial', 'next'], ['No thanks', 'end', 'ghosty']],
  },
  {
    id: 'move', title: 'Walk',
    text: 'Put your left thumb anywhere on the left half of the screen and drag. Push a little to walk, all the way to run.',
    focus: () => ({ hand: 'stick' }),
    check: () => seen.moved > 6,
  },
  {
    id: 'look', title: 'Look around',
    text: 'Drag one finger on the right side of the screen to turn the camera. Pinch with two fingers to zoom.',
    focus: () => ({ hand: 'look' }),
    check: () => seen.looked > 1.1,
  },
  {
    id: 'jump', title: 'Jump',
    text: 'Tap the arrow button to jump, or hold it to keep hopping. Running into a fence or a rock hops over it for you.',
    focus: () => ({ el: $('thJump') }),
    check: () => seen.jumped,
  },
  {
    id: 'talk', title: 'Your first quest',
    text: 'A yellow ! marks someone with a quest for you. Walk up to Marshal Edda and press the big button when it says Talk.',
    skip: (p) => done(p, 'cv_recruit'),
    focus: () => (mainKind() === 'talk' && G.player.target?.npc?.id === 'edda' ? { el: $('thMain'), label: 'Talk' } : { unit: npcUnit('edda'), label: 'Marshal Edda' }),
    check: (p) => seen.gossip === 'edda' || done(p, 'cv_recruit'),
  },
  {
    id: 'accept', title: 'Accept the quest', quiet: true,
    text: 'Tap A Fresh Recruit to read it, then tap Accept.',
    skip: (p) => done(p, 'cv_recruit'),
    focus: () => {
      const acc = footButton('Accept');
      if (acc) return { el: acc, label: 'Tap Accept' };
      const row = gossipRow('q-av');
      if (row) return { el: row, label: 'Tap the quest' };
      return { unit: npcUnit('edda'), label: 'Talk to Edda' };
    },
    check: (p) => done(p, 'cv_recruit'),
  },
  {
    id: 'tracker', title: 'Quest tracker',
    text: 'Your quests are listed here with how far away each goal is. Tap a quest to follow it with the guide arrow.',
    focus: () => ({ el: $('questTracker') }),
    buttons: [['Next', 'next']],
  },
  {
    id: 'turnin', title: 'Follow the arrow',
    text: 'The arrow at the top always points to your goal. Follow it to Farmer Tobias by his barn and talk to him to finish the quest.',
    skip: (p) => finished(p, 'cv_recruit'),
    focus: () => {
      const btn = footButton('Complete Quest');
      if (btn) return { el: btn, label: 'Tap Complete Quest' };
      const row = gossipRow('q-ready');
      if (row) return { el: row, label: 'Tap the quest' };
      const t = npcUnit('tobias');
      if (t && Math.hypot(t.pos.x - G.player.pos.x, t.pos.z - G.player.pos.z) < 30) return { unit: t, label: 'Farmer Tobias' };
      return { el: $('questArrow') };
    },
    check: (p) => finished(p, 'cv_recruit'),
  },
  {
    id: 'nextq', title: 'More work', quiet: true,
    text: 'Tobias has a job for you. Accept The Weevil Problem.',
    skip: (p) => done(p, 'cv_weevils'),
    focus: () => {
      const acc = footButton('Accept');
      if (acc) return { el: acc, label: 'Tap Accept' };
      const row = gossipRow('q-av');
      if (row) return { el: row, label: 'Tap The Weevil Problem' };
      return { unit: npcUnit('tobias'), label: 'Talk to Tobias' };
    },
    check: (p) => done(p, 'cv_weevils'),
  },
  {
    id: 'fight', title: 'Fight',
    text: 'Follow the arrow to the weevil fields north of town. Tap a creature to target it, then press Attack or the ability the ring points to.',
    focus: (p) => {
      const t = p.target;
      if (t && !t.dead && canAttack(p, t)) {
        const s = offensiveSlot();
        if (s && (CASTERS.has(p.cls) || p.autoAttack || p.autoShot || p.cast)) return { el: s.el, label: `Tap ${s.name}` };
        return { el: $('thMain'), label: 'Attack!' };
      }
      const e = softTarget(p, 32);
      if (e) return { unit: e, label: 'Tap to target' };
      return { el: $('questArrow') };
    },
    check: () => seen.kill,
  },
  {
    id: 'loot', title: 'Loot',
    text: 'Creatures that sparkle after they fall carry loot. Walk up to one and press the big button when it says Loot.',
    focus: (p) => {
      if (mainKind() === 'loot') return { el: $('thMain'), label: 'Loot' };
      let best = null, bd = 40;
      for (const u of G.units) {
        if (!u.dead || !u.loot || lootEmpty(u)) continue;
        const d = Math.hypot(u.pos.x - p.pos.x, u.pos.z - p.pos.z);
        if (d < bd) { bd = d; best = u; }
      }
      return best ? { unit: best, label: 'Loot me' } : null;
    },
    check: () => seen.loot,
  },
  {
    id: 'menus', title: 'Bags, map and more',
    text: 'These buttons open your quest log and bags. The ☰ menu holds your character, spellbook, talents, world map and settings.',
    focus: () => ({ el: $('thTop') }),
    buttons: [['Next', 'next']],
    check: () => seen.sheet,
  },
  {
    id: 'end', center: true, title: 'You are ready, Warden',
    text: 'Finish quests and defeat creatures to level up. Visit your class trainer in Millbrook every couple of levels to learn new abilities. Replay this tutorial any time from Settings.',
    buttons: [['Play', 'finish']],
  },
];

let card, ring, mark, hand, dim;
let cur = -1;
let collapsed = false, wasCombat = false;
let lastPos = null, lastYaw = 0, lastPitch = 0, wasAir = false;
let layoutT = 0, lastEl = null;

function state() {
  const p = G.player;
  if (!p) return null;
  p.data ??= {};
  return p.data;
}

export function initTutorial() {
  dim = document.createElement('div');
  dim.id = 'tutDim';
  dim.hidden = true;
  card = document.createElement('div');
  card.id = 'tutCard';
  card.className = 'panel';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-live', 'polite');
  ring = document.createElement('div');
  ring.id = 'tutRing';
  ring.hidden = true;
  ring.innerHTML = '<span></span>';
  mark = document.createElement('div');
  mark.id = 'tutMark';
  mark.hidden = true;
  mark.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7 L12 17 L20 7 Z"/></svg>';
  hand = document.createElement('div');
  hand.id = 'tutHand';
  hand.hidden = true;
  document.body.append(dim, card, ring, mark, hand);
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act(b.dataset.act);
    else if (card.classList.contains('compact')) { collapsed = false; card.classList.remove('compact'); }
  });
  on('openGossip', ({ unit }) => { seen.gossip = unit?.npc?.id ?? null; });
  on('killXP', () => { seen.kill = true; });
  on('openLoot', ({ unit }) => { if (unit) seen.loot = true; });
  on('loot', ({ unit }) => { if (unit === G.player) seen.loot = true; });
}

// Called when a character enters the world.
export function startTutorial(force = false) {
  const s = state();
  if (!s) return;
  if (force) s.tutorial = { i: 0 };
  if (!s.tutorial) s.tutorial = { i: 0 };
  if (s.tutorial.done) { hideAll(); cur = -1; return; }
  go(s.tutorial.i ?? 0);
}
export function stopTutorial() { hideAll(); cur = -1; }
export function tutorialActive() { return cur >= 0; }

function go(i) {
  const p = G.player;
  while (i < STEPS.length && STEPS[i].skip?.(p)) i++;
  if (i >= STEPS.length) { act('finish'); return; }
  cur = i;
  state().tutorial = { i };
  Object.assign(seen, { moved: 0, looked: 0, jumped: false, gossip: null, kill: false, loot: false, sheet: false });
  lastPos = { x: p.pos.x, z: p.pos.z };
  lastYaw = cam.yaw; lastPitch = cam.pitch;
  renderCard();
}

function act(a) {
  if (a === 'hide') { collapsed = true; card.classList.add('compact'); return; }
  if (a === 'next') go(cur + 1);
  else if (a === 'end' || a === 'finish') {
    const s = state();
    if (s) s.tutorial = { done: true };
    cur = -1;
    hideAll();
  }
}

function renderCard() {
  const st = STEPS[cur];
  const n = STEPS.length - 2; // welcome and the ending aren't counted
  const num = cur > 0 && cur < STEPS.length - 1 ? `<div class="tut-step">Step ${cur} of ${n}</div>` : '';
  const btns = (st.buttons ?? []).map(([label, a, cls]) => `<button class="btn small${cls ? ' ' + cls : ''}" data-act="${a}">${label}</button>`).join('');
  // a step with its own Next button needs no Skip link
  const links = st.center ? '' : `<div class="tut-links">${btns ? '' : '<button data-act="next">Skip step</button>'}<button data-act="hide">Hide</button><button data-act="end">End tutorial</button>${btns}</div>`;
  card.innerHTML = `${num}<h3>${st.title}</h3><p>${st.text}</p>${st.center && btns ? `<div class="tut-btns">${btns}</div>` : ''}${links}`;
  card.classList.toggle('center', !!st.center);
  collapsed = false;
  card.classList.remove('compact');
  card.hidden = false;
  card.style.top = '';
  card.scrollTop = 0;
}

function hideAll() {
  for (const el of [card, ring, mark, hand, dim]) if (el) el.hidden = true;
}

const v3 = new THREE.Vector3();
function project(u) {
  v3.set(u.pos.x, u.y + (u.height ?? 1.8) + 1.1, u.pos.z).project(G.camera);
  const behind = v3.z > 1;
  return { x: (v3.x * 0.5 + 0.5) * innerWidth, y: (-v3.y * 0.5 + 0.5) * innerHeight, behind };
}

// marker over someone in the world, pinned to the screen edge when off screen
function updateMark(f, winOpen) {
  if (f?.unit && !winOpen) {
    const s = project(f.unit);
    const m = 34, W = innerWidth, H = innerHeight;
    let { x, y } = s;
    let off = s.behind || x < m || x > W - m || y < m || y > H - m;
    if (s.behind) { x = W - x; y = H - 40; }
    if (off) {
      const cx = W / 2, cy = H / 2;
      const dx = x - cx, dy2 = y - cy;
      const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy2)));
      x = cx + dx * Math.min(1, k); y = cy + dy2 * Math.min(1, k);
      mark.style.setProperty('--rot', `${Math.atan2(dy2, dx) - Math.PI / 2}rad`);
    } else mark.style.setProperty('--rot', '0rad');
    mark.classList.toggle('off', off);
    mark.hidden = false;
    mark.style.left = x + 'px';
    mark.style.top = y + 'px';
    const lbl = mark.firstChild;
    if (lbl.textContent !== (f.label ?? '')) lbl.textContent = f.label ?? '';
  } else mark.hidden = true;
}

export function updateTutorial(dt) {
  if (cur < 0 || !card) return;
  const p = G.player;
  if (!p || !G.running) { hideAll(); return; }
  const st = STEPS[cur];

  // measure what the player has done
  if (lastPos) {
    const d = Math.hypot(p.pos.x - lastPos.x, p.pos.z - lastPos.z);
    if (d < 3 && (input.joy.active || input.keys.size)) seen.moved += d;
    lastPos = { x: p.pos.x, z: p.pos.z };
  }
  let dy = Math.abs(cam.yaw - lastYaw);
  if (dy > Math.PI) dy = Math.PI * 2 - dy;
  if (cam.dragging) seen.looked += dy + Math.abs(cam.pitch - lastPitch);
  lastYaw = cam.yaw; lastPitch = cam.pitch;
  if (p.airborne && !wasAir && p.vy > 0) seen.jumped = true;
  wasAir = !!p.airborne;
  if (!$('thSheet')?.hidden) seen.sheet = true;

  if (st.check?.(p)) { go(cur + 1); return; }

  const busy = p.dead || p.ghost || !!p.flight;
  const winOpen = openWins().length > 0 || !$('thSheet')?.hidden;
  dim.hidden = !st.center || busy;
  const f = busy ? null : st.focus?.(p) ?? null;

  // the card steps aside while a window is open unless it is about that window
  const inWin = f?.el && f.el.closest('#windows');
  card.hidden = busy || (winOpen && !st.center) || (st.quiet && !!inWin);
  // fold away when a fight starts so the unit frames stay readable
  if (p.inCombat && !wasCombat) collapsed = true;
  wasCombat = !!p.inCombat;
  const small = !st.center && collapsed;
  if (card.classList.contains('compact') !== small) card.classList.toggle('compact', small);
  if (st.center && !card.hidden) { ring.hidden = mark.hidden = hand.hidden = true; return; }

  // world markers follow the camera every frame; reading page layout is
  // throttled because it forces the browser to lay the page out
  updateMark(f, winOpen);
  layoutT -= dt;
  if (layoutT > 0 && f?.el === lastEl) return;
  layoutT = 0.12;
  lastEl = f?.el ?? null;

  // ring around an element
  let ringRect = null;
  if (f?.el && f.el.offsetParent !== null && !f.el.hidden && (!winOpen || inWin)) {
    const r = f.el.getBoundingClientRect();
    if (r.width > 0) {
      const pad = 6;
      ring.hidden = false;
      ring.style.left = r.left - pad + 'px';
      ring.style.top = r.top - pad + 'px';
      ring.style.width = r.width + pad * 2 + 'px';
      ring.style.height = r.height + pad * 2 + 'px';
      ring.style.borderRadius = f.el.closest('#thCluster') ? '50%' : '12px';
      const lbl = ring.firstChild;
      lbl.textContent = f.label ?? '';
      lbl.hidden = !f.label;
      // labels sit above the ring unless that would leave the screen
      ring.classList.toggle('below', r.top < 60);
      ringRect = r;
    } else ring.hidden = true;
  } else ring.hidden = true;

  // gesture hints
  if (f?.hand && !winOpen) {
    hand.hidden = false;
    hand.className = f.hand;
    if (f.hand === 'stick') {
      const j = $('joyHint')?.getBoundingClientRect();
      if (j?.width) { hand.style.left = j.left + j.width / 2 + 'px'; hand.style.top = j.top + j.height / 2 + 'px'; }
    } else {
      hand.style.left = innerWidth * (innerHeight > innerWidth ? 0.62 : 0.6) + 'px';
      hand.style.top = innerHeight * 0.42 + 'px';
    }
  } else hand.hidden = true;

  // keep the card clear of whatever the ring points at
  if (!card.hidden) {
    card.style.top = '';
    card.style.left = '';
    card.style.transform = '';
    // never cover the quest log, bag and menu buttons
    const tt = $('thTop')?.getBoundingClientRect();
    if (tt?.width && !small) {
      const c = card.getBoundingClientRect();
      if (c.right > tt.left - 6 && c.left < tt.right && c.top < tt.bottom && c.bottom > tt.top) {
        card.style.left = Math.max(8, tt.left - 8 - c.width) + 'px';
        card.style.transform = 'none';
      }
    }
    if (ringRect && !small) {
      const c = card.getBoundingClientRect();
      const overlap = !(ringRect.right < c.left || ringRect.left > c.right || ringRect.bottom + 28 < c.top || ringRect.top - 28 > c.bottom);
      if (overlap) {
        const below = ringRect.bottom + 34;
        card.style.top = (below + c.height < innerHeight - 8 ? below : Math.max(8, ringRect.top - 34 - c.height)) + 'px';
      }
    }
  }
}
// for automated tests
export const tutorialDebug = { seen, step: () => STEPS[cur]?.id ?? null };
