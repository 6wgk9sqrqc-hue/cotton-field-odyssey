// Touch controls: a thumb cluster of big ability buttons around a
// context-sensitive main button (attack, talk, loot, use), a menu sheet, a
// joystick hint and full-screen windows. Only shown when body has .touch.
import { G, emit, on } from '../state.js';
import { updateSlot, useEntry, softTarget } from './hud.js';
import { icon } from './icons.js';
import { canAttack } from '../engine/combat.js';
import { setTarget, cycleTarget, interact, input, nearestInteractable, interactObject } from '../engine/player.js';
import { lootEmpty } from '../engine/world.js';
import { unspentTalentPoints } from '../engine/progression.js';

const $ = (id) => document.getElementById(id);
const PER_PAGE = 6;
const PAGES = 4;
let page = 0;
const slots = [];
let mainKind = '';
let built = false;

// Cluster geometry in CSS pixels, inside a box anchored bottom-right. The
// jump button sits in the corner like Roblox's; Attack is just left of it and
// the abilities fan out in two arcs. Held upright the phone gets a tighter
// layout that leaves the left half free for the thumbstick.
function geometry(portrait) {
  const L = portrait
    ? { w: 222, h: 270, cx: 222 - 46, cy: 270 - 44, jump: 70, main: 62, slot: 52, util: 40, mainR: 80, inner: [84, [128, 90]], outer: [146, [180, 150, 120, 90]], target: [200, 110], page: [200, 85] }
    : { w: 330, h: 256, cx: 330 - 56, cy: 256 - 52, jump: 84, main: 72, slot: 56, util: 46, mainR: 104, inner: [102, [135, 90]], outer: [178, [180, 155, 130, 105]], target: [178, 80], page: [250, 170] };
  const polar = (r, deg) => [L.cx + Math.cos((deg * Math.PI) / 180) * r, L.cy - Math.sin((deg * Math.PI) / 180) * r];
  L.slots = [...L.inner[1].map((a) => polar(L.inner[0], a)), ...L.outer[1].map((a) => polar(L.outer[0], a))];
  L.mainPos = polar(L.mainR, 180);
  L.targetPos = polar(...L.target);
  L.pagePos = polar(...L.page);
  return L;
}
let layoutKey = '';
function layoutCluster() {
  const portrait = window.innerHeight > window.innerWidth;
  const key = portrait ? 'p' : 'l';
  if (key === layoutKey) return;
  layoutKey = key;
  const L = geometry(portrait);
  const cluster = $('thCluster');
  cluster.style.width = L.w + 'px';
  cluster.style.height = L.h + 'px';
  sizeAt($('thJump'), [L.cx, L.cy], L.jump);
  sizeAt($('thMain'), L.mainPos, L.main);
  cluster.querySelectorAll('.th-slot').forEach((el) => sizeAt(el, L.slots[+el.dataset.k], L.slot));
  sizeAt($('thTarget'), L.targetPos, L.util);
  sizeAt($('thPage'), L.pagePos, L.util);
}
function sizeAt(el, pos, size) {
  el.style.width = el.style.height = size + 'px';
  place(el, pos, size);
}

function place(el, [x, y], size) {
  el.style.left = (x - size / 2) + 'px';
  el.style.top = (y - size / 2) + 'px';
}

function entryRef(k) {
  const idx = page * PER_PAGE + k;
  return idx < 12 ? [1, idx] : [2, idx - 12];
}
function entryAt(k) {
  const [n, i] = entryRef(k);
  return (n === 1 ? G.player.bar : G.player.bar2)[i];
}

export function initTouchHud() {
  if (built) return;
  built = true;
  const root = $('touchHud');
  root.innerHTML = `
    <div id="joyHint"><div></div></div>
    <div id="thCluster">
      <button id="thJump" aria-label="Jump"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 7 L33 22 L25 22 L25 33 L15 33 L15 22 L7 22 Z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></button>
      <button id="thMain" aria-label="Attack or interact"><img alt=""><span class="lbl">Attack</span></button>
      ${[0, 1, 2, 3, 4, 5].map((k) => `<div class="th-slot slot" data-k="${k}"><img alt=""><span class="count"></span><div class="cd"></div><div class="cdt"></div></div>`).join('')}
      <button id="thTarget" class="th-util" aria-label="Next target"><img alt=""><small>Target</small></button>
      <button id="thPage" class="th-util" aria-label="Next ability page"><b>1</b><small>Page</small></button>
    </div>
    <div id="thTop">
      <button id="thQuests" aria-label="Quest log"><img alt=""></button>
      <button id="thBags" aria-label="Bags"><img alt=""></button>
      <button id="thMenu" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
    <div id="thSheet" class="panel" hidden>
      <div class="sheet-grid">
        ${[['character', 'Character', 'i_chest'], ['spellbook', 'Spellbook', 'book'], ['talents', 'Talents', 'star'], ['quests', 'Quest Log', 'scroll'], ['map', 'World Map', 'eye'], ['bags', 'Bags', 'bag'], ['chat', 'Chat', 'scroll'], ['menu', 'Settings', 'hourglass']]
          .map(([id, label, ic]) => `<button data-open="${id}"><img alt="" src="${icon(ic)}"><span>${label}</span></button>`).join('')}
      </div>
      <div class="sheet-foot">${document.fullscreenEnabled ? '<button class="btn small ghosty" id="thFull">Full screen</button>' : ''}<button class="btn small ghosty" id="thSheetClose">Close</button></div>
    </div>`;
  const cluster = $('thCluster');
  cluster.querySelectorAll('.th-slot').forEach((el) => {
    const k = +el.dataset.k;
    slots[k] = { el, img: el.querySelector('img'), count: el.querySelector('.count'), cd: el.querySelector('.cd'), cdt: el.querySelector('.cdt'), entry: undefined };
    bindSlot(el, k);
  });
  layoutCluster();
  window.addEventListener('resize', layoutCluster);
  window.addEventListener('orientationchange', () => setTimeout(layoutCluster, 200));
  $('thTarget').querySelector('img').src = icon('target');
  $('thQuests').querySelector('img').src = icon('scroll');
  $('thBags').querySelector('img').src = icon('bag');

  press($('thMain'), () => { if (G.player) mainAction(G.player)[1]?.(); });
  press($('thTarget'), () => cycleTarget());
  // jump fires on touch down and keeps hopping while held, like Roblox
  const jb = $('thJump');
  const jumpOff = () => { input.jumpHeld = false; jb.classList.remove('down'); };
  jb.addEventListener('touchstart', (e) => { input.jump = true; input.jumpHeld = true; jb.classList.add('down'); e.preventDefault(); }, { passive: false });
  jb.addEventListener('touchend', (e) => { jumpOff(); e.preventDefault(); }, { passive: false });
  jb.addEventListener('touchcancel', jumpOff);
  jb.addEventListener('mousedown', () => { input.jump = true; input.jumpHeld = true; });
  jb.addEventListener('mouseup', jumpOff);
  jb.addEventListener('mouseleave', jumpOff);
  press($('thPage'), () => setPage((page + 1) % PAGES));
  press($('thQuests'), () => G.ui.toggle('quests'));
  press($('thBags'), () => G.ui.toggle('bags'));
  press($('thMenu'), () => { $('thSheet').hidden = !$('thSheet').hidden; });
  press($('thSheetClose'), () => { $('thSheet').hidden = true; });
  if ($('thFull')) press($('thFull'), () => {
    $('thSheet').hidden = true;
    if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); return; }
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  });
  $('thSheet').querySelectorAll('[data-open]').forEach((b) => press(b, () => {
    $('thSheet').hidden = true;
    const w = b.dataset.open;
    if (w === 'chat') { document.body.classList.toggle('chat-open'); document.body.classList.remove('chat-closed'); return; }
    G.ui.toggle(w);
  }));
  // tapping the target frame clears the target
  $('targetFrame').addEventListener('touchend', (e) => { if (e.target.closest('.auras')) return; setTarget(null); e.preventDefault(); }, { passive: false });
  on('barChanged', () => { for (const s of slots) s.entry = undefined; });
}

// what sits in cluster slot k on the current page
export function slotEntry(k) { return G.player ? entryAt(k) : null; }

function setPage(n) {
  page = n;
  $('thPage').querySelector('b').textContent = String(page + 1);
  for (const s of slots) s.entry = undefined;
  $('thCluster').classList.remove('paged');
  void $('thCluster').offsetWidth;
  $('thCluster').classList.add('paged');
}

// Fires on touch end (or click with a mouse), with a pressed look while held.
function press(el, fn) {
  el.addEventListener('touchstart', (e) => { el.classList.add('down'); e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', (e) => { el.classList.remove('down'); e.preventDefault(); fn(e); }, { passive: false });
  el.addEventListener('touchcancel', () => el.classList.remove('down'));
  el.addEventListener('click', (e) => fn(e));
}

function bindSlot(el, k) {
  let down = null, longT = null;
  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    down = { x: t.clientX, y: t.clientY };
    el.classList.add('down');
    longT = setTimeout(() => {
      down = null;
      el.classList.remove('down');
      const [n, i] = entryRef(k);
      G.ui.slotMenu?.(n, i, t.clientX - 120, t.clientY - 160);
    }, 520);
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('touchend', (e) => {
    clearTimeout(longT);
    el.classList.remove('down');
    e.preventDefault();
    if (!down) return;
    down = null;
    const [n, i] = entryRef(k);
    if (G.ui.cursor) { G.ui.dropOnBar(n, i); return; }
    useEntry(entryAt(k));
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }, { passive: false });
  el.addEventListener('touchcancel', () => { clearTimeout(longT); down = null; el.classList.remove('down'); });
  el.addEventListener('click', () => {
    const [n, i] = entryRef(k);
    if (G.ui.cursor) { G.ui.dropOnBar(n, i); return; }
    useEntry(entryAt(k));
  });
}

// What the big button does right now.
function mainAction(p) {
  const t = p.target;
  if (p.dead) return ['', null];
  if (t && t.dead && t.loot && !lootEmpty(t)) return ['loot', () => interact(t)];
  if (t && !t.dead && canAttack(p, t)) return ['attack', () => interact(t)];
  if (t && t.kind === 'npc' && !t.guard && (!t.spiritHealer || p.ghost)) return ['talk', () => interact(t)];
  const n = nearestInteractable();
  if (n) {
    const kind = n.isObject ? 'use' : n.dead ? 'loot' : 'talk';
    return [kind, () => { if (n.isObject) interactObject(n); else { setTarget(n); interact(n); } }];
  }
  return ['attack', () => {
    const e = softTarget(p, 30);
    if (e) { setTarget(e); interact(e); } else emit('error', 'There is nothing to attack nearby.');
  }];
}
const MAIN_LOOK = {
  attack: ['swords', 'Attack'], talk: ['scroll', 'Talk'], loot: ['coin', 'Loot'], use: ['hand', 'Use'], '': ['swords', ''],
};

let slowT = 0;
export function updateTouchHud(dt) {
  if (!built || !G.isTouch || !G.player) return;
  const p = G.player;
  for (let k = 0; k < PER_PAGE; k++) updateSlot(slots[k], entryAt(k));
  slowT -= dt;
  if (slowT > 0) return;
  slowT = 0.15;
  const [kind] = mainAction(p);
  if (kind !== mainKind) {
    mainKind = kind;
    const [ic, label] = MAIN_LOOK[kind] ?? MAIN_LOOK.attack;
    const b = $('thMain');
    b.querySelector('img').src = icon(ic);
    b.querySelector('.lbl').textContent = label;
    b.dataset.kind = kind;
  }
  $('thMain').classList.toggle('engaged', !!(p.autoAttack || p.autoShot));
  $('joyHint').classList.toggle('hide', input.joy.active);
  $('thMenu').classList.toggle('alert', unspentTalentPoints(p) > 0);
  // page dots show which pages hold anything
  const any = [];
  for (let pg = 0; pg < PAGES; pg++) {
    let has = false;
    for (let k = 0; k < PER_PAGE; k++) { const idx = pg * PER_PAGE + k; if ((idx < 12 ? p.bar[idx] : p.bar2[idx - 12])) has = true; }
    any.push(has);
  }
  $('thPage').classList.toggle('more', any.some((h, i) => h && i !== page));
}
