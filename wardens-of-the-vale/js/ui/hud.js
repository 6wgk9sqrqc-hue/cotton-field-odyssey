// Heads-up display: frames, bars, nameplates, combat text, minimap, tracker, chat.
import * as THREE from '../lib/three.module.min.js';
import { G, emit, on } from '../state.js';
import { icon, itemIcon } from './icons.js';
import { itemTooltip, spellTooltip, unitTooltip, bindTooltip, showTooltip, hideTooltip } from './tooltip.js';
import { CLASSES, xpToLevel, MAX_LEVEL } from '../data/classes.js';
import { getItem } from '../data/items.js';
import { QUALITY, conColor, moneyText, escapeHTML, fmtTime } from '../util.js';
import { ABILITIES, castAbility, checkCast, rankData, knownRank, cooldownLeft, abilityCost, defaultPower, abilityRange } from '../engine/spells.js';
import { canAttack, distance, rangeTo, inMeleeRange, friendly } from '../engine/combat.js';
import { useItem, countItem, allSlots } from '../engine/inventory.js';
import { setTarget, cycleTarget, interact, input, nearestInteractable, interactObject, cam } from '../engine/player.js';
import { npcQuestMarker, questState, goalText, isComplete } from '../engine/quests.js';
import { QUESTS } from '../data/quests.js';
import { releaseSpirit, canResurrect, resurrectAtCorpse, lootEmpty } from '../engine/world.js';
import { drawMinimap, minimapZoom } from './minimap.js';
import { petHappinessText } from '../engine/summons.js';
import { unspentTalentPoints } from '../engine/progression.js';

const $ = (id) => document.getElementById(id);
export const CLASS_ICON = { warrior: 'swords', paladin: 'hammer', hunter: 'bow', rogue: 'dagger', priest: 'star', shaman: 'totem', mage: 'fireball', warlock: 'demon', druid: 'paw' };
const CREATURE_ICON = { beast: 'paw', humanoid: 'mask', undead: 'skull', elemental: 'orb', demon: 'demon', dragonkin: 'flame', critter: 'paw', totem: 'totem' };
export function classIcon(cls) {
  const c = CLASSES[cls]?.color ?? '#888888';
  return icon(CLASS_ICON[cls] ?? 'star', 'physical', [c, '#1a1208']);
}
function portraitFor(u) {
  if (u.kind === 'player' || u.kind === 'companion') return classIcon(u.cls);
  if (u.kind === 'npc') return icon(u.guard ? 'shield' : u.npc?.trainer ? 'book' : u.npc?.vendor ? 'coin' : 'hand', 'physical', ['#6a8a5a', '#1a2a12']);
  if (u.kind === 'totem') return icon('totem', 'nature');
  if (u.kind === 'pet' && u.data?.demon) return icon(u.data.demon === 'imp' ? 'imp' : u.data.demon === 'voidwalker' ? 'void' : 'kiss', 'shadow');
  return icon(CREATURE_ICON[u.creature] ?? 'paw', 'physical', u.boss ? ['#c08030', '#3a1a08'] : u.elite ? ['#a08850', '#2a1a08'] : undefined);
}

// ---------- action bars ----------
const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const slots = { 1: [], 2: [] };
export function buildBars() {
  for (const n of [1, 2]) {
    const el = $(n === 1 ? 'actionBar' : 'actionBar2');
    el.innerHTML = '';
    slots[n] = [];
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('div');
      s.className = 'slot empty';
      s.innerHTML = `<img alt=""><span class="key">${n === 2 ? '⇧' : ''}${BAR_KEYS[i]}</span><span class="count"></span><div class="cd"></div><div class="cdt"></div>`;
      s.dataset.bar = n; s.dataset.idx = i;
      el.appendChild(s);
      slots[n].push({ el: s, img: s.querySelector('img'), count: s.querySelector('.count'), cd: s.querySelector('.cd'), cdt: s.querySelector('.cdt'), entry: undefined });
      bindSlot(s, n, i);
    }
  }
}
function barArr(n) { return n === 1 ? G.player.bar : G.player.bar2; }
function bindSlot(el, n, i) {
  let down = null, longT = null;
  const start = (x, y, touch) => {
    down = { x, y, t: performance.now(), touch };
    if (touch) longT = setTimeout(() => { down = null; G.ui.slotMenu?.(n, i, x, y); }, 550);
  };
  el.addEventListener('mousedown', (e) => { if (e.button === 0) start(e.clientX, e.clientY, false); });
  el.addEventListener('mousemove', (e) => {
    if (!down || down.touch) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 && !G.ui.cursor && barArr(n)[i]) {
      // drag an entry off the bar onto the cursor
      G.ui.pickup({ kind: 'bar', entry: barArr(n)[i] });
      barArr(n)[i] = null;
      down = null;
      emit('barChanged');
    }
  });
  el.addEventListener('mouseup', (e) => {
    if (e.button === 2) { G.ui.slotMenu?.(n, i, e.clientX, e.clientY); return; }
    if (!down) return;
    down = null;
    if (G.ui.cursor) { G.ui.dropOnBar(n, i); return; }
    useBar(n, i);
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('touchstart', (e) => { G.isTouch = true; const t = e.changedTouches[0]; start(t.clientX, t.clientY, true); e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', (e) => {
    clearTimeout(longT);
    if (!down) return;
    down = null;
    if (G.ui.cursor) { G.ui.dropOnBar(n, i); return; }
    useBar(n, i);
    e.preventDefault();
  }, { passive: false });
  bindTooltip(el, () => entryTooltip(barArr(n)?.[i]));
}
export function entryTooltip(entry) {
  if (!entry) return '';
  if (entry.startsWith('item:')) { const id = entry.slice(5); return itemTooltip(id, { n: countItem(G.player, id) }); }
  if (entry.startsWith('pet:')) return spellTooltip(entry.slice(4), 1, G.player.pet);
  return spellTooltip(entry);
}
export function useEntry(entry) {
  const p = G.player;
  if (!entry || !p || p.dead) return;
  if (entry.startsWith('item:')) {
    const id = entry.slice(5);
    for (const [bi, si, s] of allSlots(p)) if (s?.id === id) { useItem(p, bi, si); return; }
    emit('error', 'You don\'t have any of those.');
    return;
  }
  if (p.ghost) { emit('error', 'You can\'t do that while dead.'); return; }
  if (p.flying) return;
  // on touch screens an attack with no enemy targeted picks the nearest one in front
  const ab = ABILITIES[entry];
  if (G.isTouch && ab && (ab.target === undefined || ab.target === 'enemy') && (!p.target || p.target.dead || !canAttack(p, p.target))) {
    const t = softTarget(p);
    if (t) setTarget(t);
  }
  castAbility(p, entry, p.target);
}
export function softTarget(p, maxRange = 36) {
  let best = null, bs = 1e9;
  for (const u of G.units) {
    if (u.dead || u === p || u.kind === 'npc' || !canAttack(p, u) || !u.group.visible) continue;
    const d = distance(p, u);
    if (d > maxRange) continue;
    const a = Math.atan2(u.pos.x - p.pos.x, u.pos.z - p.pos.z);
    let da = Math.abs(a - p.facing) % (Math.PI * 2);
    if (da > Math.PI) da = Math.PI * 2 - da;
    const score = d + da * 9 - (u.threat?.has(p) ? 12 : 0) - (u.faction === 'neutral' ? -6 : 0);
    if (score < bs) { bs = score; best = u; }
  }
  return best;
}
export function useBar(n, i) {
  const p = G.player;
  const e = barArr(n)?.[i];
  const s = slots[n][i];
  if (s) { s.el.classList.remove('flash'); void s.el.offsetWidth; s.el.classList.add('flash'); }
  useEntry(e);
}
on('useBar', ({ bar, index }) => useBar(bar, index));

function entryIcon(entry) {
  if (!entry) return '';
  if (entry.startsWith('item:')) return itemIcon(getItem(entry.slice(5)));
  const ab = ABILITIES[entry.startsWith('pet:') ? entry.slice(4) : entry];
  return ab ? icon(ab.icon ?? 'star', ab.school) : '';
}

export function updateSlot(s, entry) {
  const p = G.player;
  if (s.entry !== entry) {
    s.entry = entry;
    s.img.src = entry ? entryIcon(entry) : '';
    s.img.style.visibility = entry ? 'visible' : 'hidden';
    s.el.classList.toggle('empty', !entry);
  }
  if (!entry) { s.cd.style.setProperty('--p', '0%'); s.cdt.textContent = ''; s.count.textContent = ''; return; }
  let cdLeft = 0, cdTotal = 1, usable = true, oor = false, nopower = false, active = false, queued = false;
  if (entry.startsWith('item:')) {
    const id = entry.slice(5);
    const n = countItem(p, id);
    s.count.textContent = n > 1 ? n : '';
    usable = n > 0;
    const it = getItem(id);
    const key = it?.use?.stone ? 'cd:stone' : it?.use?.potion ? 'cd:potion' : it?.use?.hearth ? 'hearth' : null;
    if (key) { cdLeft = Math.max(0, (p.cooldowns[key] ?? 0) - G.time); cdTotal = key === 'hearth' ? 900 : 120; }
  } else {
    const ab = ABILITIES[entry];
    if (!ab) return;
    const r = knownRank(p, entry);
    s.count.textContent = ab.reagent ? countItem(p, ab.reagent) : '';
    if (!r) usable = false;
    else {
      const rd = rankData(ab, r);
      cdLeft = cooldownLeft(p, ab);
      cdTotal = (rd.cd ?? ab.cd ?? 0) + (p.mods?.cd?.[ab.id] ?? 0) || 1;
      if (ab.gcd && G.time < p.gcdUntil && cdLeft < p.gcdUntil - G.time) { cdLeft = p.gcdUntil - G.time; cdTotal = p.gcdDur; }
      if (ab.stance && !ab.stance.includes(p.stance)) usable = false;
      if (ab.form && p.form !== ab.form) usable = false;
      if (ab.react && !(p.react[ab.react] > G.time)) usable = false;
      if (ab.stealth && !p.hasFlag('stealth')) usable = false;
      if (ab.combo && p.comboPoints <= 0) usable = false;
      if (ab.usable && !ab.usable(p, p.target)) usable = false;
      const pt = defaultPower(p, ab);
      const cost = abilityCost(p, ab, rd);
      if (cost > 0 && p.resource(pt) < cost) nopower = true;
      const t = p.target;
      if (t && ab.target === 'enemy' && canAttack(p, t)) {
        const range = abilityRange(p, ab, rd);
        if (range === 'melee') oor = !inMeleeRange(p, t);
        else if (range) { const d = rangeTo(p, t); oor = d > range || (ab.minRange && d < ab.minRange); }
      }
      if (entry === 'attack') active = p.autoAttack;
      if (entry === 'auto_shot' || entry === 'shoot') active = p.autoShot;
      if (ab.isStance) active = p.stance === entry.replace('_stance', '');
      if (ab.isForm) active = (p.form === 'bear' && entry === 'bear_form') || (p.form === 'cat' && entry === 'cat_form') || (p.form === 'ghostwolf' && entry === 'ghost_wolf');
      if (p.queued?.ab === ab) queued = true;
      if (['stealth', 'prowl'].includes(entry) && p.hasFlag('stealth')) active = true;
      if (p.auras.some((a) => a.id === entry && (a.group === 'aspect' || a.group === 'tracking' || a.id.endsWith('_src')))) active = true;
      if (entry.endsWith('_aura') && p.hasAura(entry + '_src')) active = true;
    }
  }
  s.el.classList.toggle('unusable', !usable);
  s.el.classList.toggle('oor', usable && oor);
  s.el.classList.toggle('nopower', usable && !oor && nopower);
  s.el.classList.toggle('active', active);
  s.el.classList.toggle('queued', queued);
  if (cdLeft > 0.05) {
    s.cd.style.setProperty('--p', `${Math.min(100, (cdLeft / cdTotal) * 100)}%`);
    s.cdt.textContent = cdLeft > 1.5 && cdTotal > 1.6 ? fmtTime(cdLeft) : '';
  } else { s.cd.style.setProperty('--p', '0%'); s.cdt.textContent = ''; }
}

// stance / form / aura bar and pet bar
let stanceKey = '', petKey = '';
function buildStanceBar() {
  const p = G.player;
  const ids = Object.values(ABILITIES).filter((a) => a.cls === p.cls && (a.isStance || a.isForm || (p.cls === 'paladin' && a.id.endsWith('_aura'))) && knownRank(p, a.id)).map((a) => a.id);
  const key = ids.join(',');
  if (key === stanceKey) return;
  stanceKey = key;
  const el = $('stanceBar');
  el.innerHTML = '';
  for (const id of ids) {
    const s = document.createElement('div');
    s.className = 'slot';
    s.innerHTML = `<img alt=""><div class="cd"></div><div class="cdt"></div><span class="count"></span>`;
    el.appendChild(s);
    const obj = { el: s, img: s.querySelector('img'), count: s.querySelector('.count'), cd: s.querySelector('.cd'), cdt: s.querySelector('.cdt') };
    s.addEventListener('click', () => useEntry(id));
    bindTooltip(s, () => spellTooltip(id));
    s._obj = obj; s._id = id;
  }
}
function buildPetBar() {
  const p = G.player;
  const pet = p.pet;
  const key = pet ? pet.id + ':' + pet.petAbilities.join(',') + pet.extraAbilities.join(',') : '';
  if (key === petKey) return;
  petKey = key;
  const el = $('petBar');
  el.innerHTML = '';
  if (!pet) return;
  const cmds = [
    { id: 'attack', icon: 'swords', tip: 'Attack: order your pet to attack your target.', fn: () => { if (p.target && canAttack(p, p.target)) { pet.target = p.target; pet.order = 'attack'; } } },
    { id: 'follow', icon: 'paw', tip: 'Follow: your pet stops fighting and follows you.', fn: () => { pet.target = null; pet.order = 'follow'; } },
    { id: 'stay', icon: 'hourglass', tip: 'Stay: your pet holds its position.', fn: () => { pet.order = 'stay'; } },
  ];
  for (const c of cmds) addPetBtn(el, icon(c.icon), c.fn, () => `<div class="tt-n tt-w">${c.tip.split(':')[0]}</div><div class="tt-d">${c.tip.split(': ')[1]}</div>`);
  for (const id of [...pet.petAbilities, ...pet.extraAbilities]) {
    const ab = ABILITIES[id];
    const btn = addPetBtn(el, icon(ab.icon, ab.school), (e) => {
      if (pet.petAbilities.includes(id) && (e.shiftKey || e.button === 2)) { pet.autocast[id] = !pet.autocast[id]; return; }
      castAbility(pet, id, pet.target ?? p.target, { free: true, ignoreGcd: true });
    }, () => spellTooltip(id, 1, pet) + (pet.petAbilities.includes(id) ? `<div class="tt-m">Right-click or shift-click toggles autocast.</div>` : ''));
    btn._pet = id;
  }
  const modes = ['passive', 'defensive', 'aggressive'];
  addPetBtn(el, icon('shield'), () => { pet.mode = modes[(modes.indexOf(pet.mode ?? 'defensive') + 1) % 3]; emit('system', `Pet stance: ${pet.mode}.`); }, () => `<div class="tt-n tt-w">Stance: ${pet.mode ?? 'defensive'}</div><div class="tt-d">Click to cycle Passive, Defensive and Aggressive.</div>`);
}
function addPetBtn(el, img, fn, tip) {
  const s = document.createElement('div');
  s.className = 'slot';
  s.innerHTML = `<img alt="" src="${img}">`;
  s.addEventListener('mouseup', (e) => fn(e));
  s.addEventListener('contextmenu', (e) => e.preventDefault());
  s.addEventListener('touchend', (e) => { fn(e); e.preventDefault(); });
  bindTooltip(s, tip);
  el.appendChild(s);
  return s;
}

// ---------- unit frames ----------
const cacheVals = new WeakMap();
function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }
function setWidth(el, pct) { const v = Math.max(0, Math.min(100, pct)).toFixed(1) + '%'; if (el.style.width !== v) el.style.width = v; }
function powerClass(u) {
  if (u.kind === 'pet' && u.powerType === 'energy') return 'focus';
  return u.powerType === 'rage' ? 'rage' : u.powerType === 'energy' ? 'energy' : u.maxMana > 0 && u.powerType === 'mana' ? 'pw' : 'none';
}
function fillFrame(el, u) {
  const nameEl = el.querySelector('.uf-name');
  const hp = el.querySelector('.bar.hp'), pw = el.querySelector('.bar.pw, .bar.rage, .bar.energy, .bar.focus, .bar.none');
  setText(nameEl, u.name + (u.ghost ? ' (Ghost)' : ''));
  setWidth(hp.querySelector('i'), (u.hp / u.maxHp) * 100);
  const hs = hp.querySelector('span');
  if (hs) setText(hs, u.dead ? 'Dead' : `${Math.ceil(u.hp)} / ${u.maxHp}`);
  if (pw) {
    const pc = powerClass(u);
    const want = 'bar ' + pc;
    if (pw.className !== want) pw.className = want;
    const max = u.maxPower || 1;
    setWidth(pw.querySelector('i'), (u.power / max) * 100);
    const ps = pw.querySelector('span');
    if (ps) setText(ps, pc === 'none' ? '' : `${Math.floor(u.power)} / ${max}`);
  }
  const img = el.querySelector('.portrait img');
  const key = u.id + ':' + (u.form ?? '');
  if (img && cacheVals.get(img) !== key) { cacheVals.set(img, key); img.src = portraitFor(u); }
  const lvl = el.querySelector('.lvl');
  if (lvl) {
    setText(lvl, u.boss && u.elite ? '??' : String(u.level));
    if (u !== G.player) lvl.style.color = u.kind === 'mob' ? conColor(G.player.level, u.level) : '#ffd060';
  }
}
let auraKey = '';
function auraIcon(a, small) {
  return `<div class="aura${a.debuff ? ' debuff' : ''}" data-aid="${a.id}"><img alt="" src="${icon(a.icon ?? 'star', a.school ?? (a.debuff ? 'shadow' : 'holy'))}">${a.stacks > 1 ? `<small>${a.stacks}</small>` : ''}${!small && a.remaining !== Infinity && a.remaining < 600 ? `<span class="t">${fmtTime(a.remaining)}</span>` : ''}</div>`;
}
function updateBuffs() {
  const p = G.player;
  const list = p.auras.filter((a) => !a.hidden && a.dur !== undefined);
  const key = list.map((a) => a.id + (a.stacks ?? 1) + Math.ceil(a.remaining)).join('|');
  if (key === auraKey) return;
  auraKey = key;
  const el = $('buffs');
  el.innerHTML = list.filter((a) => !a.debuff).concat(list.filter((a) => a.debuff)).map((a) => auraIcon(a)).join('');
  el.querySelectorAll('.aura').forEach((n) => {
    const a = p.auras.find((x) => x.id === n.dataset.aid);
    bindTooltip(n, () => auraTip(a));
    n.addEventListener('contextmenu', (e) => { e.preventDefault(); if (a && !a.debuff && !a.stance && a.group !== 'form') p.removeAura(a, 'cancel'); });
    n.addEventListener('dblclick', () => { if (a && !a.debuff && !a.stance && a.group !== 'form') p.removeAura(a, 'cancel'); });
  });
}
function auraTip(a) {
  if (!a) return '';
  const ab = ABILITIES[a.id];
  return `<div class="tt-n tt-w">${escapeHTML(a.name ?? a.id)}</div>${ab?.desc ? `<div class="tt-d">${escapeHTML(safeDesc(ab))}</div>` : ''}${a.remaining !== Infinity ? `<div class="tt-m">${fmtTime(a.remaining)} remaining</div>` : ''}${!a.debuff ? '<div class="tt-m">Right-click to cancel.</div>' : ''}`;
}
function safeDesc(ab) { try { return ab.desc(rankData(ab, knownRank(G.player, ab.id) || 1)); } catch { return ''; } }

let targetAuraKey = '';
function updateTargetFrame() {
  const p = G.player, t = p.target;
  const el = $('targetFrame');
  if (!t || (!G.units.includes(t) && t !== p)) { el.hidden = true; if (t && !G.units.includes(t)) setTarget(null); return; }
  el.hidden = false;
  if (t.dead && t.ring) t.showRing(null);
  fillFrame(el, t);
  const nameEl = el.querySelector('.uf-name');
  nameEl.style.color = t.dead ? '#9a9a9a' : t.kind === 'player' || t.kind === 'companion' ? CLASSES[t.cls]?.color : t.faction === 'hostile' ? '#ff5040' : t.faction === 'neutral' ? '#ffe040' : '#40ff40';
  const portrait = el.querySelector('.portrait');
  portrait.classList.toggle('is-elite', !!(t.elite || t.rare || t.boss));
  setText(el.querySelector('.elite-tag'), t.boss ? 'Boss' : t.elite ? 'Elite' : t.rare ? 'Rare' : '');
  const auras = t.auras.filter((a) => !a.hidden);
  const k = auras.map((a) => a.id + (a.stacks ?? 1)).join('|') + ':' + t.id;
  if (k !== targetAuraKey) {
    targetAuraKey = k;
    const box = el.querySelector('.auras');
    box.innerHTML = auras.slice(0, 16).map((a) => auraIcon(a, true)).join('');
    box.querySelectorAll('.aura').forEach((n) => { const a = t.auras.find((x) => x.id === n.dataset.aid); bindTooltip(n, () => auraTip(a)); });
  }
  // target's cast bar
  const tc = el.querySelector('.tcast');
  if (t.cast && t !== p) {
    tc.hidden = false;
    const c = t.cast;
    const f = c.channel ? 1 - (G.time - c.start) / c.total : (G.time - c.start) / c.total;
    setWidth(tc.querySelector('i'), f * 100);
    setText(tc.querySelector('span'), c.ability.name);
  } else tc.hidden = true;
  // target of target
  const tot = el.querySelector('.tot');
  const tt = t.target;
  if (tt && tt !== t && !t.dead && t.kind !== 'npc') {
    tot.hidden = false;
    setText(tot.querySelector('.tot-name'), tt.name);
    setWidth(tot.querySelector('i'), (tt.hp / tt.maxHp) * 100);
  } else tot.hidden = true;
}

function updatePlayerFrame() {
  const p = G.player;
  const el = $('playerFrame');
  fillFrame(el, p);
  el.classList.toggle('resting', !!p.resting);
  el.querySelector('.uf-name').style.color = p.inCombat ? '#ff8060' : '#ffffff';
  const combo = el.querySelector('.combo');
  const show = (p.cls === 'rogue' || p.form === 'cat') && p.target;
  const n = show && p.comboTarget === p.target ? p.comboPoints : 0;
  const key = show ? 'c' + n : '';
  if (combo.dataset.k !== key) { combo.dataset.k = key; combo.innerHTML = show ? [0, 1, 2, 3, 4].map((i) => `<b class="${i < n ? 'on' : ''}"></b>`).join('') : ''; }
  const pf = $('petFrame');
  const pet = p.pet;
  if (pet) {
    pf.hidden = false;
    fillFrame(pf, pet);
    pf.title = pet.data?.happiness !== undefined ? `${pet.name} is ${petHappinessText(pet)}` : '';
  } else pf.hidden = true;
}
let partyKey = '';
function updateParty() {
  const el = $('partyFrames');
  const key = G.party.map((c) => c.id).join(',');
  if (key !== partyKey) {
    partyKey = key;
    el.innerHTML = G.party.map((c) => `<div class="party-member" data-id="${c.id}"><div class="pm-name"><span style="color:${CLASSES[c.cls].color}">${escapeHTML(c.name)}</span><span>${c.role}</span></div><div class="bar hp"><i></i></div><div class="bar pw"><i></i></div></div>`).join('');
    el.querySelectorAll('.party-member').forEach((n) => {
      const c = G.party.find((x) => String(x.id) === n.dataset.id);
      n.addEventListener('click', () => setTarget(c));
      n.addEventListener('touchend', (e) => { setTarget(c); e.preventDefault(); });
    });
  }
  el.querySelectorAll('.party-member').forEach((n) => {
    const c = G.party.find((x) => String(x.id) === n.dataset.id);
    if (!c) return;
    setWidth(n.querySelector('.bar.hp i'), c.dead ? 0 : (c.hp / c.maxHp) * 100);
    const pw = n.querySelector('.bar.pw, .bar.rage, .bar.energy');
    pw.className = 'bar ' + powerClass(c);
    setWidth(pw.querySelector('i'), (c.power / (c.maxPower || 1)) * 100);
    n.classList.toggle('sel', G.player.target === c);
  });
}

// ---------- cast bar ----------
let castFail = 0;
on('castStop', (e) => { if (e.unit === G.player && e.interrupted) castFail = G.time + 0.6; });
function updateCastBar() {
  const p = G.player;
  const el = $('castBar');
  const c = p.cast;
  if (c) {
    el.hidden = false;
    el.classList.toggle('channel', !!c.channel);
    el.classList.remove('fail');
    const f = c.channel ? 1 - (G.time - c.start) / (c.end - c.start) : (G.time - c.start) / (c.end - c.start);
    setWidth(el.querySelector('i'), f * 100);
    setText(el.querySelector('.cname'), c.ability.name);
    setText(el.querySelector('.ctime'), Math.max(0, c.end - G.time).toFixed(1));
  } else if (G.time < castFail) {
    el.hidden = false;
    el.classList.add('fail');
    setText(el.querySelector('.cname'), 'Interrupted');
    setText(el.querySelector('.ctime'), '');
  } else el.hidden = true;
}

// ---------- xp ----------
function updateXP() {
  const p = G.player;
  const el = $('xpBar');
  if (p.level >= MAX_LEVEL) { setWidth(el.querySelector('.fill'), 100); setText(el.querySelector('span'), `Level ${MAX_LEVEL}`); return; }
  const need = xpToLevel(p.level);
  setWidth(el.querySelector('.fill'), (p.xp / need) * 100);
  setWidth(el.querySelector('.rested'), Math.min(100, ((p.xp + (p.rested ?? 0)) / need) * 100));
  setText(el.querySelector('span'), `XP ${p.xp} / ${need}${p.rested > 0 ? `  (Rested +${Math.round(p.rested)})` : ''}`);
}

// ---------- nameplates and floating combat text ----------
const overlay = () => $('overlay');
const plates = new Map();
const v3 = new THREE.Vector3();
function project(x, y, z) {
  v3.set(x, y, z).project(G.camera);
  if (v3.z > 1) return null;
  return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight };
}
function updateNameplates() {
  const p = G.player;
  const seen = new Set();
  for (const u of G.units) {
    if (u === p || !u.group.visible) continue;
    if (u.spiritHealer && !p.ghost) continue;
    const d = distance(u, p);
    const isNpc = u.kind === 'npc';
    const range = isNpc ? 40 : 45;
    if (d > range) continue;
    if (u.dead && !(u.loot && d < 20)) continue;
    if (!G.settings.nameplates && !isNpc && u !== p.target) continue;
    const pos = project(u.pos.x, u.y + (u.height ?? 1.8) + 0.45, u.pos.z);
    if (!pos) continue;
    seen.add(u);
    let pl = plates.get(u);
    if (!pl) {
      const el = document.createElement('div');
      el.className = 'np';
      el.innerHTML = `<div class="mark"></div><div class="np-name"></div><div class="np-title"></div><div class="np-bar"><i></i></div><div class="np-cast" hidden><i></i></div>`;
      overlay().appendChild(el);
      pl = { el, mark: el.querySelector('.mark'), name: el.querySelector('.np-name'), title: el.querySelector('.np-title'), bar: el.querySelector('.np-bar'), fill: el.querySelector('.np-bar i'), cast: el.querySelector('.np-cast'), castI: el.querySelector('.np-cast i'), key: '' };
      plates.set(u, pl);
    }
    const hostileish = canAttack(p, u);
    const color = u.dead ? '#aaaaaa' : u.kind === 'companion' ? '#3c9cff' : u.kind === 'pet' && u.owner === p ? '#80c8ff' : u.faction === 'hostile' ? '#ff4030' : u.faction === 'neutral' ? '#ffe040' : '#40ff40';
    const lvl = u.kind === 'mob' ? ` <span class="lvl" style="color:${conColor(p.level, u.level)}">${u.boss && u.elite ? '??' : u.level}${u.elite ? '+' : ''}</span>` : '';
    const key = u.name + color + lvl + (u.title ?? '');
    if (pl.key !== key) {
      pl.key = key;
      pl.name.innerHTML = `${escapeHTML(u.name)}${lvl}`;
      pl.name.style.color = color;
      pl.title.textContent = u.title ? `<${u.title}>` : '';
    }
    let mark = '', mcls = '';
    if (isNpc && u.npc?.quests) {
      const m = npcQuestMarker(p, u.npc.id);
      if (m === 'available') { mark = '!'; mcls = 'available'; }
      else if (m === 'low') { mark = '!'; mcls = 'low'; }
      else if (m === 'turnin') { mark = '?'; mcls = 'turnin'; }
      else if (m === 'progress') { mark = '?'; mcls = 'progress'; }
    }
    if (pl.mark.textContent !== mark) { pl.mark.textContent = mark; pl.mark.className = 'mark ' + mcls; }
    const showBar = !isNpc && !u.dead && (hostileish ? (u.inCombat || u === p.target || u.hp < u.maxHp) : (u.kind === 'companion' || u.kind === 'pet'));
    pl.bar.style.display = showBar ? '' : 'none';
    if (showBar) pl.fill.style.width = (u.hp / u.maxHp) * 100 + '%';
    pl.el.classList.toggle('friendly', !hostileish);
    pl.el.classList.toggle('target', u === p.target);
    if (u.cast && !isNpc) {
      pl.cast.hidden = false;
      const c = u.cast;
      pl.castI.style.width = Math.min(100, (c.channel ? 1 - (G.time - c.start) / c.total : (G.time - c.start) / c.total) * 100) + '%';
    } else pl.cast.hidden = true;
    const scale = Math.max(0.65, Math.min(1, 18 / Math.max(6, d)));
    pl.el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    pl.el.style.opacity = d > range - 8 ? ((range - d) / 8).toFixed(2) : '1';
  }
  for (const [u, pl] of plates) if (!seen.has(u)) { pl.el.remove(); plates.delete(u); }
}

const fct = [];
export function floatText(u, text, cls, big) {
  if (!u || !G.camera) return;
  const el = document.createElement('div');
  el.className = 'fct ' + cls + (big ? ' crit' : '');
  el.textContent = text;
  overlay().appendChild(el);
  fct.push({ el, u, x: u.pos.x, y: u.y + (u.height ?? 1.8), z: u.pos.z, t: 0, ox: (Math.random() - 0.5) * 40 });
  if (fct.length > 40) fct.shift().el.remove();
}
function updateFct(dt) {
  for (let i = fct.length - 1; i >= 0; i--) {
    const f = fct[i];
    f.t += dt;
    if (f.t > 1.4) { f.el.remove(); fct.splice(i, 1); continue; }
    if (G.units.includes(f.u)) { f.x = f.u.pos.x; f.z = f.u.pos.z; }
    const pos = project(f.x, f.y + 0.4, f.z);
    if (!pos) { f.el.style.opacity = 0; continue; }
    const rise = f.t * 60;
    const pop = f.el.classList.contains('crit') ? (f.t < 0.12 ? 1.6 - f.t * 5 : 1) : 1;
    f.el.style.transform = `translate(${pos.x + f.ox}px, ${pos.y - rise}px) translate(-50%, -50%) scale(${pop})`;
    f.el.style.opacity = f.t > 0.9 ? ((1.4 - f.t) / 0.5).toFixed(2) : '1';
  }
}

// ---------- chat ----------
let chatTab = 'all';
export function chat(text, cls = 'c-sys') {
  const log = $('chatLog');
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = text;
  d.hidden = chatTab === 'combat' ? cls !== 'c-combat' : cls === 'c-combat';
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
  log.appendChild(d);
  while (log.children.length > 250) log.firstChild.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
}
function setChatTab(t) {
  chatTab = t;
  document.querySelectorAll('#chatTabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  for (const d of $('chatLog').children) d.hidden = t === 'combat' ? d.className !== 'c-combat' : d.className === 'c-combat';
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}
function itemLink(id, n) {
  const it = getItem(id);
  if (!it) return id;
  return `<span style="color:${QUALITY[it.q ?? 1].color}">[${escapeHTML(it.name)}]</span>${n > 1 ? 'x' + n : ''}`;
}

// ---------- center texts ----------
export function errorText(msg) {
  const el = $('errorText');
  const d = document.createElement('div');
  d.textContent = msg;
  el.appendChild(d);
  while (el.children.length > 3) el.firstChild.remove();
  setTimeout(() => d.remove(), 2000);
}
export function zoneText(text, sub, small) {
  const el = $('zoneText');
  el.querySelector('.big').textContent = text;
  el.querySelector('.sub').textContent = sub ?? '';
  el.classList.remove('show');
  el.classList.toggle('small', !!small);
  void el.offsetWidth;
  el.classList.add('show');
}
export function toast(html, cls = 'toast', ms = 3500) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), ms);
}

// ---------- quest tracker ----------
let trackerDirty = true;
on('questsChanged', () => { trackerDirty = true; });
on('bagsChanged', () => { trackerDirty = true; });
function updateTracker() {
  if (!trackerDirty) return;
  trackerDirty = false;
  const p = G.player;
  const ids = Object.keys(p.quests.active).filter((id) => !p.untracked?.[id]).slice(0, 6);
  const el = $('questTracker');
  if (!ids.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="qt-h">Quests</div>` + ids.map((id) => {
    const q = QUESTS[id];
    const done = isComplete(p, id);
    const goals = q.goals.length ? q.goals.map((g, i) => `<div class="qt-g">- ${escapeHTML(goalText(p, q, i))}</div>`).join('') : `<div class="qt-g">- ${escapeHTML(q.obj)}</div>`;
    return `<div class="qt-q" data-q="${id}"><div class="qt-name${done ? ' done' : ''}">${escapeHTML(q.name)}${done ? ' (Complete)' : ''}</div>${done ? `<div class="qt-g">- Return to ${escapeHTML(npcName(q.turnin))}</div>` : goals}</div>`;
  }).join('');
  el.querySelectorAll('.qt-q').forEach((n) => n.addEventListener('click', () => G.ui.openQuestLog(n.dataset.q)));
}
function npcName(id) { return G.units.find((u) => u.npc?.id === id)?.name ?? id; }

// ---------- death ----------
function updateDeath() {
  const p = G.player;
  $('deathPanel').hidden = !p.dead || p.ghost;
  $('ghostPanel').hidden = !p.ghost;
  document.body.classList.toggle('ghost', !!p.ghost);
  document.body.classList.toggle('dead', !!p.dead && !p.ghost);
  if (p.ghost) {
    const can = canResurrect();
    $('resBtn').hidden = !can;
    const d = p.corpse ? Math.round(Math.hypot(p.pos.x - p.corpse.x, p.pos.z - p.corpse.z)) : 0;
    setText($('ghostText'), can ? 'You are close enough to your corpse to resurrect.' : `Return to your corpse (${d} yards) or speak to the Spirit Healer at the graveyard.`);
  }
}

// ---------- main update ----------
let frameN = 0, slowT = 0;
export function updateHud(dt) {
  const p = G.player;
  if (!p) return;
  frameN++;
  updatePlayerFrame();
  updateTargetFrame();
  updateCastBar();
  for (const n of [1, 2]) for (let i = 0; i < 12; i++) updateSlot(slots[n][i], barArr(n)[i]);
  buildStanceBar();
  for (const s of $('stanceBar').children) updateSlot(s._obj, s._id);
  buildPetBar();
  updateNameplates();
  updateFct(dt);
  slowT -= dt;
  if (slowT <= 0) {
    slowT = 0.25;
    updateBuffs();
    updateXP();
    updateParty();
    updateDeath();
    updateTracker();
    const mm = document.querySelector('#microMenu [data-win="talents"]');
    if (mm) mm.classList.toggle('alert', unspentTalentPoints(p) > 0);
    const clock = new Date();
    setText($('mmClock'), clock.getHours().toString().padStart(2, '0') + ':' + clock.getMinutes().toString().padStart(2, '0'));
  }
  if (frameN % 3 === 0) drawMinimap($('minimap'));
  $('mmArrow').style.transform = `rotate(${(-p.facing + Math.PI).toFixed(3)}rad)`;
}

// ---------- events ----------
export function initHud() {
  buildBars();
  $('releaseBtn').addEventListener('click', () => releaseSpirit());
  $('resBtn').addEventListener('click', () => resurrectAtCorpse());
  $('mmZoomIn').addEventListener('click', () => minimapZoom(0.75));
  $('mmZoomOut').addEventListener('click', () => minimapZoom(1.33));
  $('minimapWrap').addEventListener('click', () => G.ui.toggle('map'));
  document.querySelectorAll('#microMenu button').forEach((b) => b.addEventListener('click', () => G.ui.toggle(b.dataset.win)));
  document.querySelectorAll('#chatTabs [data-tab]').forEach((b) => b.addEventListener('click', () => setChatTab(b.dataset.tab)));
  $('chatHide').addEventListener('click', () => { document.body.classList.remove('chat-open'); document.body.classList.add('chat-closed'); });
  $('chatShow').addEventListener('click', () => { document.body.classList.toggle('chat-open'); document.body.classList.remove('chat-closed'); });
  $('playerFrame').addEventListener('click', () => setTarget(G.player));
  $('petFrame').addEventListener('click', () => setTarget(G.player.pet));
  const tap = (id, fn) => { const b = $(id); b.addEventListener('touchend', (e) => { fn(); e.preventDefault(); }); b.addEventListener('click', fn); };
  tap('tcTarget', () => cycleTarget());
  tap('tcJump', () => { input.jump = true; });
  tap('tcPage', () => document.body.classList.toggle('page2'));
  tap('tcInteract', () => {
    const p = G.player;
    const t = p.target;
    if (t && (canAttack(p, t) || (t.kind === 'npc' && distance(p, t) < 7) || (t.dead && t.loot))) { interact(t); return; }
    const n = nearestInteractable();
    if (n) { if (n.isObject) interactObject(n); else { setTarget(n); interact(n); } }
    else if (t) interact(t);
  });
  bindTooltip($('playerFrame'), () => unitTooltip(G.player));

  on('error', (msg) => errorText(msg));
  on('system', (msg) => chat(escapeHTML(msg), 'c-sys'));
  on('zoneText', (e) => zoneText(e.text, e.sub, e.small));
  on('zoneChanged', () => { setText($('zoneName'), G.zoneName ?? ''); });
  on('subzone', (e) => { G.subzone = e.name; setText($('zoneName'), e.name); });
  on('damage', (e) => {
    const p = G.player;
    const mine = e.src === p || e.src?.owner === p;
    if (e.amount > 0) {
      if (e.tgt === p) floatText(p, `-${e.amount}`, 'self', e.crit);
      else if (mine) floatText(e.tgt, String(e.amount), e.white ? 'white' : 'spell', e.crit);
      else if (e.tgt?.owner === p || e.tgt?.kind === 'companion') floatText(e.tgt, `-${e.amount}`, 'self');
    }
    if (mine || e.tgt === p) {
      const who = e.src === p ? 'Your' : e.src ? `${e.src.name}'s` : '';
      const ab = e.ability ?? (e.white ? 'melee swing' : 'attack');
      if (e.missType) chat(`${escapeHTML(who)} ${escapeHTML(ab)} ${e.missType === 'resist' ? 'was resisted by' : 'missed'} ${escapeHTML(e.tgt.name)} (${e.missType}).`, 'c-combat');
      else chat(`${escapeHTML(who)} ${escapeHTML(ab)} ${e.crit ? 'crits' : 'hits'} ${e.tgt === p ? 'you' : escapeHTML(e.tgt.name)} for ${e.amount}${e.school !== 'physical' ? ' ' + e.school : ''}${e.absorbed ? ` (${e.absorbed} absorbed)` : ''}${e.blocked ? ' (blocked)' : ''}.`, 'c-combat');
    }
  });
  on('heal', (e) => {
    const p = G.player;
    if (e.tgt === p || e.src === p || e.tgt?.kind === 'companion') {
      if (e.effective > 0 || !e.periodic) floatText(e.tgt, `+${e.amount}`, 'heal', e.crit);
      chat(`${escapeHTML(e.ability ?? 'Heal')} heals ${e.tgt === p ? 'you' : escapeHTML(e.tgt.name)} for ${e.amount}.`, 'c-combat');
    }
  });
  on('combatText', (e) => {
    const p = G.player;
    if (e.src === p || e.unit === p || e.src?.owner === p) floatText(e.unit, e.text, 'miss');
  });
  on('xp', (e) => {
    if (e.source === 'kill') return;
    chat(`You gain ${e.amount} experience.`, 'c-xp');
  });
  on('killXP', (e) => {
    chat(`${escapeHTML(e.unit.name)} dies, you gain ${e.xp} experience${G.player.rested > 0 ? ' (rested bonus)' : ''}.`, 'c-xp');
    floatText(G.player, `+${e.xp} XP`, 'xp');
  });
  on('loot', (e) => {
    if (e.unit !== G.player) return;
    if (e.money) chat(`You loot ${moneyText(e.money)}.`, 'c-money');
    if (e.item) chat(`${e.conjured ? 'You create' : 'You receive loot'}: ${itemLink(e.item, e.count)}.`, 'c-loot');
  });
  on('questProgress', (e) => { toast(escapeHTML(e.text), 'questmsg', 3000); chat(escapeHTML(e.text), 'c-quest'); });
  on('questComplete', (e) => { if (e.xp) chat(`Experience gained: ${e.xp}.`, 'c-xp'); });
  on('levelUp', (e) => {
    toast(`Level ${e.level}<small>You have reached level ${e.level}!</small>`);
    chat(`Congratulations, you have reached level ${e.level}!`, 'c-sys');
    chat(`You have gained ${e.hp} hit points${e.mana ? ` and ${e.mana} mana` : ''}.`, 'c-sys');
    const gains = Object.entries(e.gains).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ');
    if (gains) chat(`Your attributes increased: ${gains}.`, 'c-sys');
    if (e.newSpells.length) chat(`New abilities are available from your class trainer: ${escapeHTML(e.newSpells.join(', '))}.`, 'c-sys');
    if (e.talentPoint) chat('You have gained a talent point. Press N to open your talents.', 'c-sys');
  });
  on('say', (e) => { chat(`${escapeHTML(e.unit.name)} says: ${escapeHTML(e.text)}`, 'c-say'); floatText(e.unit, '…', 'miss'); });
  on('yell', (e) => chat(`${escapeHTML(e.unit.name)} yells: ${escapeHTML(e.text)}`, 'c-yell'));
  on('emote', (e) => chat(escapeHTML(e.text), 'c-emote'));
  on('playerDead', () => chat('You have died.', 'c-err'));
  on('learned', () => { stanceKey = ''; });
  on('petChanged', () => { petKey = ''; });
  on('stance', () => { stanceKey = ''; });
  on('sold', (e) => chat(`Sold ${itemLink(e.item.id, e.n)} for ${moneyText(e.value)}.`, 'c-money'));
  on('tamed', () => { petKey = ''; });
  on('hover', (h) => {
    if (!h || G.isTouch) { hideTooltip(); return; }
    showTooltip(h.isObject ? `<div class="tt-n tt-y">${escapeHTML(h.name)}</div>` : unitTooltip(h), input.mouse.x, input.mouse.y);
  });
}
void friendly; void cam; void lootEmpty; void questState; void checkCast; void itemIcon;
