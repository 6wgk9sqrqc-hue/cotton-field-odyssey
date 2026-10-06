// All dialog windows, the item cursor and context menus.
import { G, emit, on } from '../state.js';
import { applyQuality } from '../engine/scene.js';
import { questie, questColor, setFocus, trackerHint, fmtDist } from './questie.js';
import { icon, itemIcon } from './icons.js';
import { itemTooltip, spellTooltip, trainerTooltip, bindTooltip, showTooltip, hideTooltip } from './tooltip.js';
import { classIcon, chat } from './hud.js';
import { drawWorldMap } from './minimap.js';
import { CLASSES, xpToLevel, trainCost } from '../data/classes.js';
import { getItem, EQUIP_SLOTS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { TALENTS, canLearnTalent, applyTalents, pointsInTree, talentPointsAt, pointsSpent } from '../data/talents.js';
import { FLIGHT_POINTS } from '../data/world.js';
import { QUALITY, moneyHTML, moneyText, escapeHTML, conColor } from '../util.js';
import { ABILITIES, knownRank, castAbility, rankData } from '../engine/spells.js';
import {
  equipItem, unequip, useItem, moveItem, destroyItem, sellItem, buyItem, buyBack, buyPrice, repairAll, repairCost, sellJunk, allSlots, countItem, canEquip,
} from '../engine/inventory.js';
import { trainerList, learn, unspentTalentPoints, placeOnBar } from '../engine/progression.js';
import {
  questsForNpc, acceptQuest, turnInQuest, abandonQuest, isComplete, goalText, questRewardXP, questRewardMoney, questState,
} from '../engine/quests.js';
import { takeLoot, takeAll, startFlight, nearestFlightPoint, flightCost, spiritHealerRes, lootEmpty } from '../engine/world.js';
import { HIRELINGS, hire, dismiss } from '../engine/companions.js';
import { distance } from '../engine/combat.js';
import { petHappinessText } from '../engine/summons.js';

const $ = (id) => document.getElementById(id);
const wins = new Map();
let zTop = 30;

// ---------- window frame ----------
function openWin(name, title, opts = {}) {
  let w = wins.get(name);
  const wasHidden = !w || w.el.hidden;
  if (!w) {
    const el = document.createElement('div');
    el.className = 'win panel' + (opts.parch ? ' parch' : '');
    el.innerHTML = `<div class="win-h"><h3></h3><button class="close" aria-label="Close">×</button></div><div class="win-b"></div><div class="win-foot" hidden></div>`;
    $('windows').appendChild(el);
    w = { el, name, h: el.querySelector('h3'), b: el.querySelector('.win-b'), foot: el.querySelector('.win-foot'), pos: opts.pos ?? 'left', dragged: false };
    el.querySelector('.close').addEventListener('click', () => closeWin(name));
    el.addEventListener('mousedown', () => { el.style.zIndex = ++zTop; });
    dragify(el, el.querySelector('.win-h'), () => { w.dragged = true; });
    wins.set(name, w);
  }
  if (wasHidden && !w.dragged) placeWin(w, opts);
  w.el.hidden = false;
  w.el.style.zIndex = ++zTop;
  w.h.textContent = title;
  w.foot.hidden = true;
  w.foot.innerHTML = '';
  document.querySelectorAll('#microMenu button').forEach((b) => b.classList.toggle('on', isOpen(b.dataset.win) || b.dataset.win === name));
  return w;
}
// Left-docked panels sit side by side, like the classic UI's panel slots,
// so opening the character sheet and the spellbook together never stacks them.
function placeWin(w, opts) {
  const el = w.el;
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = Math.min(opts.width ?? 380, vw - 16);
  const top = opts.top ?? Math.max(8, Math.min(90, vh * 0.12));
  el.style.width = W + 'px';
  el.style.top = top + 'px';
  el.style.maxHeight = opts.top !== undefined ? `${vh - top - 8}px` : `calc(${vh}px - ${top}px - 70px)`;
  let left;
  if (w.pos === 'right') left = Math.max(8, vw - W - 190);
  else if (w.pos === 'center') left = Math.max(8, (vw - W) / 2);
  else {
    left = Math.min(Math.max(8, vw * 0.06), vw - W - 8);
    for (const o of wins.values()) {
      if (o === w || o.el.hidden || o.pos !== 'left' || o.dragged) continue;
      const r = o.el.offsetLeft + o.el.offsetWidth + 8;
      if (r + W <= vw - 8 && r > left) left = r;
    }
  }
  el.style.left = left + 'px';
}
export function closeWin(name) {
  const w = wins.get(name);
  if (w) { w.el.hidden = true; w.onClose?.(); w.onClose = null; }
  hideTooltip();
  document.querySelector(`#microMenu [data-win="${name}"]`)?.classList.remove('on');
  if (name === 'vendor') G.ui.vendorOpen = null;
}
export function isOpen(name) { const w = wins.get(name); return !!w && !w.el.hidden; }
export function closeAll() { for (const n of wins.keys()) closeWin(n); }
function dragify(el, handle, onDrag) {
  let start = null;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 4) onDrag?.();
    el.style.left = Math.max(-el.offsetWidth + 60, Math.min(window.innerWidth - 60, start.l + e.clientX - start.x)) + 'px';
    el.style.top = Math.max(0, Math.min(window.innerHeight - 40, start.t + e.clientY - start.y)) + 'px';
  });
  handle.addEventListener('pointerup', () => { start = null; });
}
function foot(w, buttons) {
  w.foot.hidden = false;
  w.foot.innerHTML = '';
  for (const [label, fn, cls] of buttons) {
    const b = document.createElement('button');
    b.className = 'btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    w.foot.appendChild(b);
  }
}
const tap = (el, fn) => {
  el.addEventListener('click', (e) => fn(e));
};

// ---------- cursor (picked-up spells/items) and context menus ----------
export const cursor = { held: null };
export function pickup(obj) {
  cursor.held = obj;
  G.ui.cursor = obj;
  const ci = $('cursorIcon');
  const src = obj.kind === 'spell' ? icon(ABILITIES[obj.id].icon, ABILITIES[obj.id].school) : obj.kind === 'item' ? itemIcon(getItem(obj.id)) : obj.entry ? entrySrc(obj.entry) : '';
  ci.innerHTML = `<img alt="" src="${src}">`;
  ci.hidden = false;
  if (G.isTouch) chat('Tap an action button to place it there.', 'c-sys');
}
function entrySrc(entry) {
  if (entry.startsWith('item:')) return itemIcon(getItem(entry.slice(5)));
  const ab = ABILITIES[entry];
  return ab ? icon(ab.icon, ab.school) : '';
}
export function clearCursor() { cursor.held = null; G.ui.cursor = null; $('cursorIcon').hidden = true; }
window.addEventListener('mousemove', (e) => { const ci = $('cursorIcon'); if (!ci.hidden) { ci.style.left = e.clientX + 'px'; ci.style.top = e.clientY + 'px'; } });
export function dropOnBar(n, i) {
  const held = cursor.held;
  if (!held) return;
  const bar = n === 1 ? G.player.bar : G.player.bar2;
  const prev = bar[i];
  bar[i] = held.kind === 'spell' ? held.id : held.kind === 'item' ? 'item:' + held.id : held.entry;
  clearCursor();
  if (prev && held.kind === 'bar') pickup({ kind: 'bar', entry: prev });
  emit('barChanged');
}
let menuEl = null;
export function contextMenu(x, y, header, items) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'panel';
  menuEl.style.cssText = `position:fixed;z-index:80;min-width:180px;max-width:min(300px,calc(100vw - 16px));padding:6px;`;
  menuEl.innerHTML = (header ? `<div style="padding:4px 6px 6px;border-bottom:1px solid #3a2e1e;margin-bottom:4px;font-size:13px">${header}</div>` : '') +
    items.map((it, k) => `<button data-k="${k}" class="btn small ghosty" style="display:block;width:100%;margin:3px 0;text-align:left">${escapeHTML(it[0])}</button>`).join('');
  document.body.appendChild(menuEl);
  menuEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const fn = items[+b.dataset.k][1]; closeMenu(); fn(); }));
  const w = menuEl.offsetWidth, h = menuEl.offsetHeight;
  menuEl.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
  menuEl.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', outside, { once: true }), 0);
}
function outside(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); else if (menuEl) document.addEventListener('pointerdown', outside, { once: true }); }
export function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
export function slotMenu(n, i, x, y) {
  const bar = n === 1 ? G.player.bar : G.player.bar2;
  const e = bar[i];
  if (!e) return;
  contextMenu(x, y, G.isTouch ? G.ui.entryTooltip?.(e) : null, [['Clear this slot', () => { bar[i] = null; emit('barChanged'); }], ['Move to another slot', () => { bar[i] = null; pickup({ kind: 'bar', entry: e }); emit('barChanged'); }]]);
}

// ---------- character ----------
const SLOT_LABEL = { head: 'Head', neck: 'Neck', shoulder: 'Shoulder', back: 'Back', chest: 'Chest', wrist: 'Wrist', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet', finger1: 'Finger', finger2: 'Finger', trinket1: 'Trinket', trinket2: 'Trinket', mainhand: 'Main Hand', offhand: 'Off Hand', ranged: 'Ranged' };
const SLOT_ICON = { head: 'i_head', neck: 'i_neck', shoulder: 'i_shoulder', back: 'i_back', chest: 'i_chest', wrist: 'i_wrist', hands: 'i_hands', waist: 'i_waist', legs: 'i_legs', feet: 'i_feet', finger1: 'i_finger', finger2: 'i_finger', trinket1: 'orb', trinket2: 'orb', mainhand: 'i_sword', offhand: 'i_shield', ranged: 'i_bow' };
function equipSlotHTML(slot) {
  const inst = G.player.equip[slot];
  const it = inst && getItem(inst.id);
  const broken = it?.dur && inst.dur === 0;
  return `<div class="islot ${it ? 'q' + it.q : ''}${broken ? ' broken' : ''}" data-slot="${slot}" title="${SLOT_LABEL[slot]}"><img alt="" src="${it ? itemIcon(it) : icon(SLOT_ICON[slot], 'physical', ['#3a3226', '#16110b'])}" style="${it ? '' : 'opacity:.35'}"></div>`;
}
function renderCharacter() {
  const p = G.player;
  const w = openWin('character', `${p.name}`, { width: 460 });
  const s = p.stats;
  const C = CLASSES[p.cls];
  const mh = p.weapon('mh');
  const mhSpeed = mh.speed / (s.atkSpeed ?? 1);
  const avg = (mh.min + mh.max) / 2 + (s.ap / 14) * mh.speed;
  const rg = p.weapon('ranged');
  const left = ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist'];
  const right = ['hands', 'waist', 'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2'];
  w.b.innerHTML = `
    <div style="text-align:center;margin-bottom:8px">Level ${p.level} <span style="color:${C.color}">${C.name}</span></div>
    <div class="paperdoll">
      <div class="col">${left.map(equipSlotHTML).join('')}</div>
      <div class="mid">
        <div class="statgrid">
          <span>Health</span><span>${p.maxHp}</span>
          ${p.maxMana ? `<span>Mana</span><span>${p.maxMana}</span>` : ''}
          <span>Strength</span><span>${s.str}</span><span>Agility</span><span>${s.agi}</span><span>Stamina</span><span>${s.sta}</span>
          <span>Intellect</span><span>${s.int}</span><span>Spirit</span><span>${s.spi}</span>
          <span>Armor</span><span>${s.armor}</span>
          <span>Attack Power</span><span>${s.ap}</span>
          <span>Damage</span><span>${Math.round(mh.min + (s.ap / 14) * mh.speed)} - ${Math.round(mh.max + (s.ap / 14) * mh.speed)}</span>
          <span>Speed</span><span>${mhSpeed.toFixed(2)}</span>
          <span>DPS</span><span>${(avg / mhSpeed).toFixed(1)}</span>
          ${rg.type && rg.type !== 'fist' ? `<span>Ranged AP</span><span>${s.rap}</span>` : ''}
          <span>Melee Crit</span><span>${s.crit.toFixed(2)}%</span>
          ${s.scrit ? `<span>Spell Crit</span><span>${s.scrit.toFixed(2)}%</span>` : ''}
          <span>Dodge</span><span>${s.dodge.toFixed(2)}%</span>
          ${s.parry ? `<span>Parry</span><span>${s.parry.toFixed(2)}%</span>` : ''}
          ${s.block ? `<span>Block</span><span>${s.block.toFixed(2)}%</span>` : ''}
          ${s.sp ? `<span>Spell Damage</span><span class="good">+${s.sp}</span>` : ''}
        </div>
        <div class="weapons-row">${['mainhand', 'offhand', 'ranged'].map(equipSlotHTML).join('')}</div>
        ${p.pet ? `<div class="res-row">Pet: ${escapeHTML(p.pet.name)}, level ${p.pet.level}${p.pet.data?.happiness !== undefined ? ` (${petHappinessText(p.pet)})` : ''}</div>` : ''}
        <div class="res-row">XP ${p.level >= 20 ? 'max level' : `${p.xp} / ${xpToLevel(p.level)}`}${p.rested > 0 ? ` · Rested ${Math.round(p.rested)}` : ''}</div>
        <div class="res-row">Repair cost: ${moneyHTML(repairCost(p))}</div>
      </div>
      <div class="col">${right.map(equipSlotHTML).join('')}</div>
    </div>`;
  w.b.querySelectorAll('[data-slot]').forEach((el) => {
    const slot = el.dataset.slot;
    bindTooltip(el, () => { const inst = G.player.equip[slot]; return inst ? itemTooltip(inst.id, inst) : `<div class="tt-w">${SLOT_LABEL[slot]}</div>`; });
    tap(el, (e) => {
      const inst = G.player.equip[slot];
      if (!inst) return;
      contextMenu(e.clientX, e.clientY, G.isTouch ? itemTooltip(inst.id, inst) : null, [['Unequip', () => unequip(G.player, slot)]]);
    });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); unequip(G.player, slot); });
  });
}

// ---------- bags ----------
function renderBags() {
  const p = G.player;
  const w = openWin('bags', 'Bags', { width: 230, pos: 'right' });
  let html = '';
  p.bags.forEach((b, bi) => {
    if (!b) return;
    const it = bi === 0 ? null : getItem(b.id);
    html += `<div class="bag-block"><h5>${bi === 0 ? 'Backpack' : escapeHTML(it?.name ?? 'Bag')}</h5><div class="bags-grid">` +
      b.slots.map((s, si) => {
        const t = s && getItem(s.id);
        return `<div class="islot ${t ? 'q' + t.q : ''}" data-b="${bi}" data-s="${si}">${t ? `<img alt="" src="${itemIcon(t)}">${s.n > 1 ? `<span class="count">${s.n}</span>` : ''}` : ''}</div>`;
      }).join('') + '</div></div>';
  });
  html += `<div class="money-line">${moneyHTML(p.money)}</div>`;
  w.b.innerHTML = html;
  w.b.querySelectorAll('.islot').forEach((el) => {
    const bi = +el.dataset.b, si = +el.dataset.s;
    bindTooltip(el, () => { const s = p.bags[bi]?.slots[si]; return s ? itemTooltip(s.id, s, { compare: true }) : ''; });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); bagRightClick(bi, si); });
    tap(el, (e) => {
      const s = p.bags[bi]?.slots[si];
      if (cursor.held?.kind === 'item' && cursor.held.from) {
        const f = cursor.held.from;
        clearCursor();
        moveItem(p, f[0], f[1], bi, si);
        return;
      }
      if (!s) return;
      const it = getItem(s.id);
      const opts = [];
      const equipable = (it.armor !== undefined || it.dmg || it.type === 'bag') && it.slot !== 'ammo';
      if (G.ui.vendorOpen && it.price && !it.quest) opts.push([`Sell (${moneyText(it.price * s.n)})`, () => sellItem(p, bi, si)]);
      if (equipable) opts.push(['Equip', () => equipItem(p, bi, si)]);
      else if (it.use) opts.push(['Use', () => useItem(p, bi, si)]);
      if (it.use) opts.push(['Put on action bar', () => { placeItemOnBar(s.id); }]);
      opts.push(['Move', () => pickup({ kind: 'item', id: s.id, from: [bi, si] })]);
      if (!it.quest || true) opts.push(['Destroy', () => confirmDestroy(bi, si, e.clientX, e.clientY)]);
      contextMenu(e.clientX, e.clientY, G.isTouch ? itemTooltip(s.id, s, { compare: true }) : `<span style="color:${QUALITY[it.q ?? 1].color}">${escapeHTML(it.name)}</span>`, opts);
    });
  });
}
function placeItemOnBar(id) {
  const p = G.player;
  if (p.bar.includes('item:' + id) || p.bar2.includes('item:' + id)) return;
  pickup({ kind: 'item', id });
}
function bagRightClick(bi, si) {
  const p = G.player;
  const s = p.bags[bi]?.slots[si];
  if (!s) return;
  if (G.ui.vendorOpen) { sellItem(p, bi, si); return; }
  useItem(p, bi, si);
}
function confirmDestroy(bi, si, x, y) {
  const s = G.player.bags[bi]?.slots[si];
  if (!s) return;
  const it = getItem(s.id);
  contextMenu(x, y, `Destroy <span style="color:${QUALITY[it.q ?? 1].color}">${escapeHTML(it.name)}</span>? This cannot be undone.`, [['Yes, destroy it', () => destroyItem(G.player, bi, si)], ['Keep it', () => {}]]);
}

// ---------- spellbook ----------
let bookTab = 'class';
function renderSpellbook() {
  const p = G.player;
  const w = openWin('spellbook', 'Spellbook & Abilities', { width: 520 });
  const known = Object.keys(p.spells).filter((id) => ABILITIES[id] && ABILITIES[id].cls !== 'mob');
  const general = ['attack', 'shoot'].filter((id) => p.spells[id] || id === 'attack');
  const classSpells = known.filter((id) => !general.includes(id)).sort((a, b) => (firstLvl(ABILITIES[a]) - firstLvl(ABILITIES[b])) || ABILITIES[a].name.localeCompare(ABILITIES[b].name));
  const pet = p.pet;
  const tabs = [['class', CLASSES[p.cls].name], ['general', 'General']];
  if (pet) tabs.push(['pet', pet.name]);
  const list = bookTab === 'general' ? general : bookTab === 'pet' && pet ? [...pet.petAbilities, ...pet.extraAbilities] : classSpells;
  w.b.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === bookTab ? 'on' : ''}">${escapeHTML(l)}</button>`).join('')}</div>
    <div class="spell-grid">${list.map((id) => {
      const ab = ABILITIES[id];
      const r = bookTab === 'pet' ? 1 : knownRank(p, id) || 1;
      return `<div class="spell${ab.passive ? ' passive' : ''}" data-id="${id}"><img alt="" src="${icon(ab.icon, ab.school)}"><div><div class="nm">${escapeHTML(ab.name)}</div><div class="rk">${ab.passive ? 'Passive' : ab.ranks && ab.ranks.length > 1 ? 'Rank ' + r : ab.talent ? 'Talent' : ''}</div></div></div>`;
    }).join('')}</div>
    <p class="muted" style="font-size:12px;margin-top:10px">${G.isTouch ? 'Tap an ability to cast it or place it on your action bar.' : 'Click an ability to pick it up, then click an action button to place it. Double-click to cast.'}</p>`;
  w.b.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { bookTab = b.dataset.tab; renderSpellbook(); }));
  w.b.querySelectorAll('.spell').forEach((el) => {
    const id = el.dataset.id;
    const ab = ABILITIES[id];
    bindTooltip(el, () => spellTooltip(id, undefined, bookTab === 'pet' ? pet : p));
    if (ab.passive) return;
    if (bookTab === 'pet') {
      tap(el, () => castAbility(pet, id, pet.target ?? p.target, { free: true, ignoreGcd: true }));
      return;
    }
    el.addEventListener('dblclick', () => { clearCursor(); castAbility(p, id, p.target); });
    tap(el, (e) => {
      if (G.isTouch) {
        contextMenu(e.clientX, e.clientY, spellTooltip(id), [['Cast', () => castAbility(p, id, p.target)], ['Put on action bar', () => pickup({ kind: 'spell', id })], ['Add to first empty slot', () => placeOnBar(p, id)]]);
      } else pickup({ kind: 'spell', id });
    });
  });
}
function firstLvl(ab) { return ab.ranks?.[0]?.lvl ?? ab.learn ?? 1; }

// ---------- talents ----------
function renderTalents() {
  const p = G.player;
  const trees = TALENTS[p.cls];
  const pts = unspentTalentPoints(p);
  const w = openWin('talents', `Talents: ${pts} point${pts === 1 ? '' : 's'} available`, { width: 640, pos: 'center' });
  w.b.innerHTML = `${p.level < 10 ? '<p class="muted">Talent points are earned every level from level 10.</p>' : ''}
    <div class="talent-trees">${trees.map((tr, ti) => `<div class="tree"><h4><span>${tr.name}</span><span>${pointsInTree(p, ti)}</span></h4>
      ${[1, 2, 3].map((tier) => `<div class="tier">${tr.talents.filter((t) => t.tier === tier).map((t) => {
        const r = p.talents[t.id] ?? 0;
        const can = canLearnTalent(p, ti, t);
        const locked = pointsInTree(p, ti) < (tier - 1) * 5;
        return `<div class="tal ${r ? 'has' : can ? 'can' : ''} ${locked ? 'locked' : ''}" data-t="${t.id}" data-tree="${ti}"><img alt="" src="${icon(t.icon, schoolForTree(p.cls, ti))}"><b>${r}/${t.max}</b></div>`;
      }).join('')}</div>`).join('')}
    </div>`).join('')}</div>`;
  foot(w, [[`Reset talents (${moneyText(resetCost(p))})`, () => resetTalents(), 'small ghosty']]);
  w.b.querySelectorAll('.tal').forEach((el) => {
    const ti = +el.dataset.tree;
    const t = trees[ti].talents.find((x) => x.id === el.dataset.t);
    const tipFn = () => {
      const r = p.talents[t.id] ?? 0;
      const req = t.tier > 1 ? `<div class="${pointsInTree(p, ti) >= (t.tier - 1) * 5 ? 'tt-m' : 'tt-r'}">Requires ${(t.tier - 1) * 5} points in ${trees[ti].name}</div>` : '';
      return `<div class="tt-n tt-w">${escapeHTML(t.name)}</div><div class="tt-w">Rank ${r}/${t.max}</div>${req}<div class="tt-d">${escapeHTML(t.desc(Math.max(1, r)))}</div>${r && r < t.max ? `<div class="tt-w" style="margin-top:4px">Next rank:</div><div class="tt-d">${escapeHTML(t.desc(r + 1))}</div>` : ''}`;
    };
    bindTooltip(el, tipFn);
    tap(el, (e) => {
      if (G.isTouch) { contextMenu(e.clientX, e.clientY, tipFn(), canLearnTalent(p, ti, t) ? [['Learn rank', () => learnTalent(ti, t)]] : [['Close', () => {}]]); return; }
      learnTalent(ti, t);
    });
  });
}
function learnTalent(ti, t) {
  const p = G.player;
  if (!canLearnTalent(p, ti, t)) return;
  p.talents[t.id] = (p.talents[t.id] ?? 0) + 1;
  applyTalents(p);
  if (t.grants && p.talents[t.id] === 1) placeOnBar(p, t.grants);
  emit('talentsChanged');
  renderTalents();
}
const resetCost = (p) => (pointsSpent(p) ? 100 * p.level : 0);
function resetTalents() {
  const p = G.player;
  const c = resetCost(p);
  if (!c) return;
  if (p.money < c) { emit('error', 'You don\'t have enough money.'); return; }
  p.money -= c;
  p.talents = {};
  applyTalents(p);
  emit('money', { unit: p });
  renderTalents();
}
function schoolForTree(cls, ti) {
  const m = { warrior: ['physical', 'fire', 'physical'], paladin: ['holy', 'holy', 'holy'], hunter: ['nature', 'arcane', 'nature'], rogue: ['nature', 'physical', 'shadow'], priest: ['holy', 'holy', 'shadow'], shaman: ['nature', 'nature', 'frost'], mage: ['arcane', 'fire', 'frost'], warlock: ['shadow', 'shadow', 'fire'], druid: ['arcane', 'physical', 'nature'] };
  return m[cls][ti];
}

// ---------- quest log ----------
let selQuest = null;
export function openQuestLog(id) { selQuest = id ?? selQuest; renderQuests(); }
function renderQuests() {
  const p = G.player;
  const ids = Object.keys(p.quests.active);
  if (!ids.includes(selQuest)) selQuest = ids[0] ?? null;
  const w = openWin('quests', `Quest Log (${ids.length}/20)`, { width: 560, parch: true });
  const q = selQuest && QUESTS[selQuest];
  w.b.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px">
    <div class="list">${ids.length ? ids.map((id) => { const qq = QUESTS[id]; const done = isComplete(p, id); return `<div class="row ${id === selQuest ? 'sel' : ''}" data-q="${id}"><div class="grow"><div class="nm" style="color:${conColor(p.level, qq.level)};text-shadow:0 0 2px #000">[${qq.level}] ${escapeHTML(qq.name)}</div>${done ? '<div class="sub">Complete</div>' : ''}</div></div>`; }).join('') : '<p class="muted">No active quests. Look for the yellow ! above people\'s heads.</p>'}</div>
    <div>${q ? questDetailHTML(q, true) : ''}</div></div>`;
  w.b.querySelectorAll('[data-q]').forEach((el) => el.addEventListener('click', () => { selQuest = el.dataset.q; renderQuests(); }));
  bindRewardTips(w.b);
  if (q) foot(w, [[p.untracked?.[q.id] ? 'Track' : 'Untrack', () => { p.untracked ??= {}; p.untracked[q.id] = !p.untracked[q.id]; emit('questsChanged', { unit: p }); renderQuests(); }, 'small ghosty'], ['Abandon', () => confirmAbandon(q), 'small']]);
}
function confirmAbandon(q) {
  const r = wins.get('quests').foot.getBoundingClientRect();
  contextMenu(r.left + 20, r.top - 90, `Abandon "${escapeHTML(q.name)}"?`, [['Abandon quest', () => { abandonQuest(G.player, q.id); renderQuests(); }], ['Cancel', () => {}]]);
}
function questDetailHTML(q, inLog) {
  const p = G.player;
  const goals = q.goals.length ? q.goals.map((g, i) => `<div>- ${escapeHTML(goalText(p, q, i))}</div>`).join('') : '';
  return `<h4>${escapeHTML(q.name)}</h4>
    <p>${escapeHTML(q.text)}</p>
    <h4>Objectives</h4><p>${escapeHTML(q.obj)}</p>${inLog ? goals : ''}
    ${rewardsHTML(q)}`;
}
function rewardsHTML(q, selectable) {
  const r = q.reward ?? {};
  const xp = questRewardXP(G.player, q), money = questRewardMoney(q);
  let h = '<h4>Rewards</h4>';
  if (r.choice?.length) h += `<p class="muted">${selectable ? 'Choose one of these rewards:' : 'You will be able to choose one of these rewards:'}</p><div class="reward-grid">${r.choice.map((id, k) => rewardTile(id, 1, k, selectable)).join('')}</div>`;
  if (r.items?.length) h += `<p class="muted">You will receive:</p><div class="reward-grid">${r.items.map(([id, n]) => rewardTile(id, n)).join('')}</div>`;
  h += `<p>${xp ? `Experience: ${xp}<br>` : ''}${money ? `Money: ${moneyHTML(money)}` : ''}</p>`;
  return h;
}
function rewardTile(id, n, k, selectable) {
  const it = getItem(id);
  return `<div class="reward" data-item="${id}" ${k !== undefined ? `data-k="${k}"` : ''}><img alt="" src="${itemIcon(it)}"><span style="color:${QUALITY[it.q ?? 1].color}">${escapeHTML(it.name)}${n > 1 ? ' x' + n : ''}</span></div>`;
}
function bindRewardTips(root) {
  root.querySelectorAll('.reward').forEach((el) => {
    bindTooltip(el, () => itemTooltip(el.dataset.item, {}, { compare: true }));
    if (G.isTouch) el.addEventListener('contextmenu', (e) => { e.preventDefault(); showTooltip(itemTooltip(el.dataset.item), e.clientX, e.clientY); });
  });
}

// ---------- NPC gossip and quest dialogs ----------
let gossipNpc = null;
export function openGossip(u) {
  gossipNpc = u;
  const p = G.player;
  const n = u.npc;
  if (u.spiritHealer) return renderSpiritHealer(u);
  const { offer, progress, ready } = questsForNpc(p, n.id);
  const opts = [];
  for (const q of ready) opts.push(['q-ready', '?', q.name, () => renderQuestComplete(q)]);
  for (const q of offer) opts.push(['q-av', '!', q.name, () => renderQuestOffer(q)]);
  for (const q of progress) opts.push(['q-prog', '?', q.name, () => renderQuestProgress(q)]);
  const sub = (fn) => () => { closeWin('gossip'); fn(u); };
  if (n.vendor) opts.push(['', '¤', 'Let me browse your goods.', sub(renderVendor)]);
  if (n.trainer) opts.push(['', '✦', n.trainer === 'all' || n.trainer === p.cls ? 'Train me.' : 'I seek training.', sub(renderTrainer)]);
  if (n.innkeeper) opts.push(['', '⌂', 'Make this inn your home.', () => { p.bind = { x: u.pos.x, z: u.pos.z + 2, name: G.subzone ?? 'this inn' }; emit('system', `${G.subzone ?? 'This inn'} is now your home.`); closeWin('gossip'); }]);
  if (n.flight) opts.push(['', '➶', 'Show me where I can fly.', sub(renderFlight)]);
  if (n.hire) opts.push(['', '⚔', 'I need sellswords for the Spire.', sub(renderHire)]);
  // a single obvious choice skips the greeting, like the classic client
  if (opts.length === 1 && !n.gossip && (n.vendor || n.flight || n.trainer)) { opts[0][3](); return; }
  const w = openWin('gossip', u.name, { width: 420, parch: true, pos: 'left' });
  w.b.innerHTML = `<p>${escapeHTML(n.gossip ?? greeting(u))}</p><div>${opts.map((o, k) => `<div class="gossip-opt" data-k="${k}"><span class="gi ${o[0]}">${o[1]}</span><span>${escapeHTML(o[2])}</span></div>`).join('')}</div>`;
  w.b.querySelectorAll('.gossip-opt').forEach((el) => el.addEventListener('click', () => opts[+el.dataset.k][3]()));
}
function greeting(u) {
  const p = G.player;
  const lines = [`Greetings, ${p.name}.`, 'Well met, traveler.', 'What can I do for you?', `The Light keep you, ${CLASSES[p.cls].name.toLowerCase()}.`, 'Busy times in the Vale.'];
  return lines[u.id % lines.length];
}
function renderQuestOffer(q) {
  const w = openWin('gossip', q.name, { width: 440, parch: true });
  w.b.innerHTML = questDetailHTML(q, false);
  bindRewardTips(w.b);
  foot(w, [['Decline', () => closeWin('gossip'), 'ghosty'], ['Accept', () => { acceptQuest(G.player, q.id); closeWin('gossip'); if (gossipNpc && questsForNpc(G.player, gossipNpc.npc.id).offer.length) openGossip(gossipNpc); }]]);
}
function renderQuestProgress(q) {
  const p = G.player;
  const w = openWin('gossip', q.name, { width: 420, parch: true });
  w.b.innerHTML = `<h4>${escapeHTML(q.name)}</h4><p>${escapeHTML(q.obj)}</p>${q.goals.map((g, i) => `<div>- ${escapeHTML(goalText(p, q, i))}</div>`).join('')}`;
  foot(w, [['Goodbye', () => closeWin('gossip'), 'ghosty']]);
}
function renderQuestComplete(q) {
  const p = G.player;
  let choice = null;
  const w = openWin('gossip', q.name, { width: 440, parch: true });
  w.b.innerHTML = `<h4>${escapeHTML(q.name)}</h4><p>${escapeHTML(q.done)}</p>${rewardsHTML(q, true)}`;
  bindRewardTips(w.b);
  w.b.querySelectorAll('.reward[data-k]').forEach((el) => el.addEventListener('click', () => {
    choice = +el.dataset.k;
    w.b.querySelectorAll('.reward[data-k]').forEach((x) => x.classList.toggle('sel', x === el));
  }));
  foot(w, [['Complete Quest', () => {
    if (turnInQuest(p, q.id, choice)) {
      closeWin('gossip');
      if (gossipNpc) { const next = questsForNpc(p, gossipNpc.npc.id); if (next.offer.length || next.ready.length) openGossip(gossipNpc); }
    }
  }]]);
}
function renderSpiritHealer(u) {
  const w = openWin('gossip', u.name, { width: 380, parch: true });
  const p = G.player;
  w.b.innerHTML = `<p>It is not yet your time. I can bring you back to life, but your equipment will suffer 25% durability damage${p.level >= 10 ? ' and you will be afflicted by Resurrection Sickness for 10 minutes' : ''}.</p><p class="muted">Alternatively, return to your corpse to resurrect without penalty.</p>`;
  foot(w, [['Return me to life', () => { spiritHealerRes(); closeWin('gossip'); }]]);
}

// ---------- vendor ----------
let vendorTab = 'buy';
function renderVendor(u) {
  const p = G.player;
  G.ui.vendorOpen = u;
  const w = openWin('vendor', u.name, { width: 420 });
  const items = u.npc.vendor ?? [];
  w.onClose = () => { G.ui.vendorOpen = null; };
  const tabs = `<div class="tabs"><button data-tab="buy" class="${vendorTab === 'buy' ? 'on' : ''}">Merchant</button><button data-tab="back" class="${vendorTab === 'back' ? 'on' : ''}">Buyback</button></div>`;
  let list = '';
  if (vendorTab === 'buy') {
    list = items.map((id) => {
      const it = getItem(id);
      const price = buyPrice(it);
      const can = canEquip(p, it);
      const red = (it.req ?? 1) > p.level || ((it.armor !== undefined || it.dmg) && it.slot && !can.ok);
      return `<div class="row" data-buy="${id}"><img alt="" src="${itemIcon(it)}"><div class="grow"><div class="nm" style="color:${red ? '#ff4040' : QUALITY[it.q ?? 1].color}">${escapeHTML(it.name)}${it.buyStack ? ` (${it.buyStack})` : ''}</div><div class="sub">${moneyHTML(price)}</div></div></div>`;
    }).join('');
  } else {
    list = p.buyback.length ? p.buyback.map((b, k) => { const it = getItem(b.id); return `<div class="row" data-back="${k}"><img alt="" src="${itemIcon(it)}"><div class="grow"><div class="nm" style="color:${QUALITY[it.q ?? 1].color}">${escapeHTML(it.name)}${b.n > 1 ? ' x' + b.n : ''}</div><div class="sub">${moneyHTML(b.value)}</div></div></div>`; }).join('') : '<p class="muted">Nothing to buy back.</p>';
  }
  w.b.innerHTML = `${tabs}<div class="list">${list}</div><p class="muted" style="font-size:12px">${G.isTouch ? 'Open your bags and tap an item to sell it.' : 'Right-click items in your bags to sell them.'}</p><div class="money-line">${moneyHTML(p.money)}</div>`;
  w.b.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { vendorTab = b.dataset.tab; renderVendor(u); }));
  w.b.querySelectorAll('[data-buy]').forEach((el) => {
    const id = el.dataset.buy;
    bindTooltip(el, () => itemTooltip(id, {}, { buy: buyPrice(getItem(id)), compare: true }));
    tap(el, (e) => {
      if (G.isTouch) { contextMenu(e.clientX, e.clientY, itemTooltip(id, {}, { buy: buyPrice(getItem(id)) }), [['Buy', () => { buyItem(p, id); renderVendor(u); }], ['Buy 5', () => { for (let i = 0; i < 5; i++) buyItem(p, id); renderVendor(u); }]]); return; }
      buyItem(p, id);
      renderVendor(u);
    });
  });
  w.b.querySelectorAll('[data-back]').forEach((el) => tap(el, () => { buyBack(p, +el.dataset.back); renderVendor(u); }));
  const btns = [['Sell junk', () => { sellJunk(p); renderVendor(u); }, 'small ghosty']];
  if (u.npc.repair) btns.push([`Repair all (${moneyText(repairCost(p))})`, () => { repairAll(p); renderVendor(u); }, 'small']);
  foot(w, btns);
  if (!isOpen('bags')) renderBags();
}

// ---------- trainer ----------
function renderTrainer(u) {
  const p = G.player;
  const trainerCls = u.npc.trainer;
  const w = openWin('trainer', `${u.name}`, { width: 460 });
  if (trainerCls !== 'all' && trainerCls !== p.cls) {
    w.b.innerHTML = `<p>I can only train ${CLASSES[trainerCls].name.toLowerCase()}s, I'm afraid. Seek out your own class trainer near the Trainers' Hall in Millbrook, or a Mentor of All Paths in the other towns.</p>`;
    return;
  }
  const list = trainerList(p);
  const avail = list.filter((e) => e.available), later = list.filter((e) => !e.available);
  const row = (e) => `<div class="row trainer-row ${e.available ? '' : 'cant'}" data-id="${e.ab.id}" data-r="${e.rank}"><img alt="" src="${icon(e.ab.icon, e.ab.school)}"><div class="grow"><div class="nm" style="color:${e.available ? (p.money >= e.cost ? '#40ff40' : '#ff6040') : '#9a9a9a'}">${escapeHTML(e.ab.name)}${e.rank > 1 ? ` (Rank ${e.rank})` : ''}</div><div class="sub">Level ${e.lvl}</div></div><div class="price">${moneyHTML(e.cost)}</div></div>`;
  w.b.innerHTML = `<p class="muted">${avail.length ? 'Choose a skill to learn:' : 'You have learned everything I can teach you for now.'}</p><div class="list">${avail.map(row).join('')}</div>${later.length ? `<h4 style="font-family:var(--display);font-weight:400;color:var(--gold);margin:12px 0 4px">Future training</h4><div class="list">${later.slice(0, 12).map(row).join('')}</div>` : ''}<div class="money-line">${moneyHTML(p.money)}</div>`;
  w.b.querySelectorAll('.trainer-row').forEach((el) => {
    const e = list.find((x) => x.ab.id === el.dataset.id && x.rank === +el.dataset.r);
    bindTooltip(el, () => trainerTooltip(e));
    tap(el, (ev) => {
      if (!e.available) return;
      if (G.isTouch) { contextMenu(ev.clientX, ev.clientY, trainerTooltip(e), [['Train', () => { learn(p, e.ab.id, e.rank); renderTrainer(u); }]]); return; }
      learn(p, e.ab.id, e.rank);
      renderTrainer(u);
    });
  });
  if (avail.length > 1) foot(w, [['Train all affordable', () => { for (const e of trainerList(p)) if (e.available && p.money >= e.cost) learn(p, e.ab.id, e.rank); renderTrainer(u); }, 'small']]);
}

// ---------- flight master ----------
function renderFlight(u) {
  const p = G.player;
  const here = nearestFlightPoint(p);
  p.flightPoints[here.id] = true;
  const w = openWin('flight', 'Flight Master', { width: 380, parch: true });
  const dests = FLIGHT_POINTS.filter((f) => f.id !== here.id);
  w.b.innerHTML = `<p>Where would you like to fly?</p><div class="list">${dests.map((f) => {
    const known = p.flightPoints[f.id];
    return `<div class="row" data-f="${f.id}" style="${known ? '' : 'opacity:.5'}"><div class="grow"><div class="nm">${escapeHTML(f.name)}</div><div class="sub">${known ? moneyHTML(flightCost(here, f)) : 'Not yet discovered: speak to its flight master first.'}</div></div></div>`;
  }).join('')}</div>`;
  w.b.querySelectorAll('[data-f]').forEach((el) => tap(el, () => {
    if (!p.flightPoints[el.dataset.f]) return;
    closeAll();
    startFlight(p, el.dataset.f);
  }));
}

// ---------- sellswords ----------
function renderHire(u) {
  const w = openWin('hire', 'Sellswords', { width: 420, parch: true });
  w.b.innerHTML = `<p>${escapeHTML(u.npc.gossip)}</p><div class="list">${HIRELINGS.map((h) => {
    const inParty = G.party.find((c) => c.hireId === h.id);
    return `<div class="row" data-h="${h.id}"><img alt="" src="${classIcon(h.cls)}"><div class="grow"><div class="nm">${escapeHTML(h.name)}</div><div class="sub">${h.role}, ${CLASSES[h.cls].name}</div></div><button class="btn small">${inParty ? 'Dismiss' : 'Hire'}</button></div>`;
  }).join('')}</div><p class="muted">Sellswords follow you, fight at your side and level with you. A tank holds threat, a healer keeps the party alive.</p>`;
  w.b.querySelectorAll('[data-h]').forEach((el) => el.querySelector('button').addEventListener('click', () => {
    const c = G.party.find((x) => x.hireId === el.dataset.h);
    if (c) dismiss(c); else hire(el.dataset.h);
    renderHire(u);
  }));
}

// ---------- loot ----------
function renderLoot(m) {
  const w = openWin('loot', m.name, { width: 280, pos: 'center' });
  const l = m.loot;
  if (!l || lootEmpty(m)) { closeWin('loot'); return; }
  const rows = [];
  if (l.money) rows.push(`<div class="row" data-k="money"><img alt="" src="${icon('coin')}"><div class="grow"><div class="nm">${moneyHTML(l.money)}</div></div></div>`);
  l.items.forEach(([id, n], k) => {
    const it = getItem(id);
    rows.push(`<div class="row" data-k="${k}" data-item="${id}"><img alt="" src="${itemIcon(it)}"><div class="grow"><div class="nm" style="color:${QUALITY[it.q ?? 1].color}">${escapeHTML(it.name)}${n > 1 ? ' x' + n : ''}</div>${it.quest ? '<div class="sub">Quest Item</div>' : ''}</div></div>`);
  });
  w.b.innerHTML = `<div class="loot-list">${rows.join('')}</div>`;
  w.b.querySelectorAll('[data-k]').forEach((el) => {
    if (el.dataset.item) bindTooltip(el, () => itemTooltip(el.dataset.item));
    tap(el, () => { takeLoot(m, el.dataset.k === 'money' ? 'money' : +el.dataset.k); if (!lootEmpty(m)) renderLoot(m); else closeWin('loot'); });
  });
  foot(w, [['Take All', () => { takeAll(m); closeWin('loot'); }]]);
  w.lootUnit = m;
}

// ---------- world map ----------
function renderMap() {
  const p = G.player;
  const size = Math.floor(Math.max(240, Math.min(window.innerWidth - 48, window.innerHeight - 120, 760)));
  const w = openWin('map', 'World Map: The Vale', { width: size + 28, pos: 'center', top: 8 });
  const ids = Object.keys(p.quests.active);
  const legend = ids.length ? `<div class="map-quests">${ids.map((id) => {
    const q = QUESTS[id];
    const h = trackerHint(p, id);
    return `<button class="mq${questie.focus === id ? ' on' : ''}" data-q="${id}"><i style="background:${questColor(p, id)}"></i><span>${escapeHTML(q.name)}</span><small>${h ? fmtDist(h.dist) : ''}</small></button>`;
  }).join('')}</div>` : '';
  w.b.innerHTML = `<div class="map-wrap"><canvas id="worldMap" width="900" height="900" style="width:${size}px"></canvas></div>${legend}<div class="legend"><span><b style="color:#ffd100">!</b> quest available</span><span><b style="color:#a8a8a8">!</b> soon</span><span><b style="color:#ffd100">?</b> quest complete</span><span><span class="lg-badge">✕</span> slay</span><span><span class="lg-badge">●</span> loot</span><span><span class="lg-badge">◆</span> use or collect</span><span><span class="lg-badge">★</span> explore</span><span><b style="color:#60ff60">▲</b> flight path</span><span><b style="color:#b070ff">●</b> The Hollow Spire</span></div>`;
  drawWorldMap($('worldMap'));
  w.b.querySelectorAll('.mq').forEach((b) => b.addEventListener('click', () => { setFocus(b.dataset.q); renderMap(); }));
}

// ---------- game menu ----------
function renderMenu() {
  const w = openWin('menu', 'Game Menu', { width: 520, pos: 'center' });
  const s = G.settings;
  w.b.innerHTML = `<div class="help">
    <div class="setting"><label><input type="checkbox" id="setNameplates" ${s.nameplates ? 'checked' : ''}> Show enemy nameplates (V)</label></div>
    <div class="setting"><label><input type="checkbox" id="setAutoLoot" ${s.autoLoot ? 'checked' : ''}> Auto loot</label></div>
    <div class="setting"><label><input type="checkbox" id="setQuestie" ${s.questie !== false ? 'checked' : ''}> Questie: show quest objectives on the maps and over creatures</label></div>
    <div class="setting"><label><input type="checkbox" id="setQuestArrow" ${s.questArrow !== false ? 'checked' : ''}> Quest guide arrow (tap a quest in the tracker to follow it)</label></div>
    <div class="setting"><label><input type="checkbox" id="setSound" ${s.sound ? 'checked' : ''}> Sound effects</label></div>
    <div class="setting"><label for="setScale">Interface scale</label><input type="range" id="setScale" min="0.6" max="1.3" step="0.05" value="${s.uiScale ?? ''}"></div>
    <div class="setting"><span>Graphics</span> <span class="seg">${['low', 'medium', 'high'].map((q) => `<button class="btn small ${G.quality === q ? '' : 'ghosty'}" data-q="${q}">${q.charAt(0).toUpperCase() + q.slice(1)}</button>`).join(' ')}</span></div>
    <div class="setting"><span>New to the game?</span> <button class="btn small ghosty" id="setTutorial">Replay tutorial</button></div>
    <p class="muted" style="margin:2px 0 8px;font-size:13px">High adds bloom, longer shadows and denser grass. Low turns shadows off for older phones. The resolution also adapts automatically when frames slow down.</p>
    <h4>Controls</h4>
    <p><b>Move:</b> touch and drag anywhere on the left side, Roblox style. The stick moves you relative to the camera; push it part way to walk slowly.<br>
    <b>Look:</b> drag on the right side to turn the camera, pinch to zoom.<br>
    <b>Jump:</b> the arrow button; hold it to keep hopping. Running into a fence or small rock hops over it.<br>
    <b>Act:</b> the big button attacks, talks, loots or uses what is in front of you, walking you over if needed. Abilities sit around it; Page shows the next set; hold one to move or clear it. Abilities with nothing targeted pick the nearest enemy.<br>
    Tap a creature or person to target it; tap the target's frame to clear it.</p>
    <p class="muted" style="font-size:13px">With a keyboard: WASD moves the same way, Space jumps, Tab cycles targets, 1–= use abilities, C B P N L M open windows, Esc opens this menu.</p>
    <h4>Tips</h4>
    <p>Eat and drink out of combat to recover. Mana only regenerates after 5 seconds without spending it. Speak to an innkeeper to set your Hearthstone and to earn rested experience. Visit your class trainer every couple of levels. Talents unlock at level 10.</p>
  </div>`;
  $('setNameplates').addEventListener('change', (e) => { s.nameplates = e.target.checked; });
  $('setTutorial').addEventListener('click', () => { closeAll(); G.ui.replayTutorial?.(); });
  $('setAutoLoot').addEventListener('change', (e) => { s.autoLoot = e.target.checked; });
  $('setQuestie').addEventListener('change', (e) => { s.questie = e.target.checked; });
  $('setQuestArrow').addEventListener('change', (e) => { s.questArrow = e.target.checked; });
  $('setSound').addEventListener('change', (e) => { s.sound = e.target.checked; });
  $('setScale').addEventListener('input', (e) => { s.uiScale = +e.target.value; document.documentElement.style.setProperty('--ui', s.uiScale); });
  w.b.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { applyQuality(b.dataset.q); renderMenu(); }));
  foot(w, [['Save & Log Out', () => { closeAll(); G.ui.logout(); }, 'ghosty'], ['Return to Game', () => closeWin('menu')]]);
}

// ---------- routing ----------
const RENDER = { character: renderCharacter, bags: renderBags, spellbook: renderSpellbook, talents: renderTalents, quests: renderQuests, map: renderMap, menu: renderMenu };
export function toggle(name) {
  if (isOpen(name)) closeWin(name);
  else RENDER[name]?.();
}
function refresh(...names) { for (const n of names) if (isOpen(n)) RENDER[n]?.(); }
export function initWindows() {
  on('toggleWindow', toggle);
  on('openGossip', ({ unit }) => openGossip(unit));
  on('openLoot', ({ unit }) => {
    if (G.settings.autoLoot) { takeAll(unit); if (lootEmpty(unit)) return; }
    renderLoot(unit);
  });
  on('lootClosed', ({ unit }) => { const w = wins.get('loot'); if (w?.lootUnit === unit) closeWin('loot'); });
  on('bagsChanged', () => refresh('bags'));
  on('money', () => refresh('bags'));
  on('equipChanged', () => refresh('character', 'bags'));
  on('questsChanged', () => refresh('quests'));
  on('levelUp', () => refresh('character', 'talents', 'spellbook'));
  on('learned', () => refresh('spellbook'));
  on('petChanged', () => refresh('spellbook'));
  on('escape', () => {
    if (cursor.held) { clearCursor(); return; }
    if (menuEl) { closeMenu(); return; }
    const open = [...wins.values()].filter((w) => !w.el.hidden);
    if (open.length) { open.sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex); closeWin(open[0].name); return; }
    if (G.player?.target) { G.ui.setTarget(null); return; }
    toggle('menu');
  });
  window.addEventListener('contextmenu', (e) => { if (cursor.held) { e.preventDefault(); clearCursor(); } });
  // close interaction windows when walking away
  setInterval(() => {
    const p = G.player;
    if (!p) return;
    for (const name of ['gossip', 'vendor', 'trainer', 'flight', 'hire']) {
      if (!isOpen(name)) continue;
      const npc = name === 'vendor' ? G.ui.vendorOpen : gossipNpc;
      if (npc && distance(p, npc) > 9) closeWin(name);
    }
    const lw = wins.get('loot');
    if (lw && !lw.el.hidden && lw.lootUnit && distance(p, lw.lootUnit) > 8) closeWin('loot');
  }, 500);
}
export { renderVendor, renderTrainer, rankData, questState, talentPointsAt, CLASSES, trainCost, EQUIP_SLOTS, countItem, allSlots };
