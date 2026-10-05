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
// the abilities fan out in two arcs.
const BOX_W = 330, BOX_H = 256, CX = BOX_W - 56, CY = BOX_H - 52;
const polar = (r, deg) => [CX + Math.cos((deg * Math.PI) / 180) * r, CY - Math.sin((deg * Math.PI) / 180) * r];
const SLOT_POS = [polar(102, 135), polar(102, 90), polar(178, 180), polar(178, 155), polar(178, 130), polar(178, 105)];
const UTIL_POS = { thTarget: polar(178, 80), thPage: polar(250, 170) };

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
  cluster.style.width = BOX_W + 'px';
  cluster.style.height = BOX_H + 'px';
  place($('thJump'), [CX, CY], 84);
  place($('thMain'), polar(104, 180), 72);
  cluster.querySelectorAll('.th-slot').forEach((el) => {
    const k = +el.dataset.k;
    place(el, SLOT_POS[k], 56);
    slots[k] = { el, img: el.querySelector('img'), count: el.querySelector('.count'), cd: el.querySelector('.cd'), cdt: el.querySelector('.cdt'), entry: undefined };
    bindSlot(el, k);
  });
  for (const id in UTIL_POS) place($(id), UTIL_POS[id], 46);
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
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
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
