// Classic-style tooltips for items, spells and units.
import { G } from '../state.js';
import { getItem, SLOT_NAMES, WEAPON_NAMES, isTwoHand } from '../data/items.js';
import { QUALITY, moneyHTML, escapeHTML, fmtDuration, conColor } from '../util.js';
import { ABILITIES, rankData, abilityCost, defaultPower, castTime, abilityRange, knownRank } from '../engine/spells.js';
import { canEquip } from '../engine/inventory.js';
import { CLASSES } from '../data/classes.js';
import { trainCost } from '../data/classes.js';

const tt = () => document.getElementById('tooltip');
const STAT_NAMES = { str: 'Strength', agi: 'Agility', sta: 'Stamina', int: 'Intellect', spi: 'Spirit' };

export function itemTooltip(id, inst = {}, opts = {}) {
  const it = getItem(id);
  if (!it) return '';
  const p = G.player;
  const q = QUALITY[it.q ?? 1];
  let h = `<div class="tt-n" style="color:${q.color}">${escapeHTML(it.name)}</div>`;
  if (it.bind === 'bop') h += `<div class="tt-w">Binds when picked up</div>`;
  else if (it.bind === 'boe') h += `<div class="tt-w">Binds when equipped</div>`;
  if (it.unique) h += `<div class="tt-w">Unique</div>`;
  if (it.quest) h += `<div class="tt-w">Quest Item</div>`;
  if (it.conjured) h += `<div class="tt-w">Conjured Item</div>`;
  if (it.slot && it.slot !== 'ammo' && it.slot !== 'bag') {
    const slotName = it.dmg ? (isTwoHand(it.type) ? 'Two-Hand' : it.slot === 'ranged' ? 'Ranged' : 'One-Hand') : it.type === 'shield' ? 'Off Hand' : SLOT_NAMES[it.slot] ?? it.slot;
    const typeName = it.dmg ? WEAPON_NAMES[it.type] : it.type === 'shield' ? 'Shield' : it.type === 'jewel' ? '' : it.slot === 'back' ? '' : cap(it.type);
    h += `<div class="tt-row"><span class="tt-w">${slotName}</span><span class="tt-w">${typeName ?? ''}</span></div>`;
  }
  if (it.dmg) {
    h += `<div class="tt-row"><span class="tt-w">${it.dmg[0]} - ${it.dmg[1]}${it.school && it.school !== 'physical' ? ' ' + cap(it.school) : ''} Damage</span><span class="tt-w">Speed ${it.speed.toFixed(2)}</span></div>`;
    h += `<div class="tt-w">(${((it.dmg[0] + it.dmg[1]) / 2 / it.speed).toFixed(1)} damage per second)</div>`;
  }
  if (it.armor) h += `<div class="tt-w">${it.armor} Armor</div>`;
  for (const k of ['str', 'agi', 'sta', 'int', 'spi']) if (it.stats?.[k]) h += `<div class="tt-w">${it.stats[k] > 0 ? '+' : ''}${it.stats[k]} ${STAT_NAMES[k]}</div>`;
  if (it.bagSlots) h += `<div class="tt-w">${it.bagSlots} Slot Bag</div>`;
  if (it.ammoDps) h += `<div class="tt-w">Adds ${it.ammoDps} damage per second</div>`;
  const dur = it.dur;
  if (dur && it.slot) {
    const cur = inst.dur ?? dur;
    h += `<div class="${cur === 0 ? 'tt-r' : 'tt-w'}">Durability ${cur} / ${dur}</div>`;
  }
  if (p && (it.armor !== undefined || it.dmg) && it.slot) {
    const chk = canEquip(p, it);
    if (!chk.ok && !chk.reason.startsWith('You must reach')) h += `<div class="tt-r">${escapeHTML(chk.reason)}</div>`;
  }
  if (it.req && it.req > 1) h += `<div class="${p && p.level < it.req ? 'tt-r' : 'tt-w'}">Requires Level ${it.req}</div>`;
  if (it.stats?.ap) h += `<div class="tt-g">Equip: +${it.stats.ap} Attack Power.</div>`;
  if (it.stats?.sp) h += `<div class="tt-g">Equip: Increases damage and healing done by magical spells and effects by up to ${it.stats.sp}.</div>`;
  if (it.stats?.heal) h += `<div class="tt-g">Equip: Increases healing done by spells and effects by up to ${it.stats.heal}.</div>`;
  if (it.stats?.crit) h += `<div class="tt-g">Equip: Improves your chance to get a critical strike by ${it.stats.crit}%.</div>`;
  if (it.stats?.hit) h += `<div class="tt-g">Equip: Improves your chance to hit by ${it.stats.hit}%.</div>`;
  if (it.stats?.mp5) h += `<div class="tt-g">Equip: Restores ${it.stats.mp5} mana per 5 sec.</div>`;
  const u = it.use;
  if (u?.food) h += `<div class="tt-g">Use: Restores ${u.food} health over ${u.dur} sec. Must remain seated while eating.</div>`;
  if (u?.drink) h += `<div class="tt-g">Use: Restores ${u.drink} mana over ${u.dur} sec. Must remain seated while drinking.</div>`;
  if (u?.heal) h += `<div class="tt-g">Use: Restores ${u.heal[0]}${u.heal[1] !== u.heal[0] ? ' to ' + u.heal[1] : ''} health.</div>`;
  if (u?.mana) h += `<div class="tt-g">Use: Restores ${u.mana[0]} to ${u.mana[1]} mana.</div>`;
  if (u?.bandage) h += `<div class="tt-g">Use: Heals ${u.bandage} damage over 8 sec.</div>`;
  if (u?.buff) h += `<div class="tt-g">Use: Increases ${({ elixir_str: 'Strength', elixir_agi: 'Agility', elixir_sta: 'Stamina', elixir_int: 'Intellect' })[u.buff]} by 8 for 30 min.</div>`;
  if (it.desc) h += `<div class="tt-flavor">"${escapeHTML(it.desc)}"</div>`;
  if (it.stack > 1 && inst.n > 1) h += `<div class="tt-m">Stack of ${inst.n}</div>`;
  if (opts.buy) h += `<div class="tt-w">Price: ${moneyHTML(opts.buy)}</div>`;
  else if (it.price && !it.quest) h += `<div class="tt-w">Sell Price: ${moneyHTML(it.price * (inst.n ?? 1))}</div>`;
  if (opts.compare && p) {
    const slot = it.slot === 'finger' ? 'finger1' : it.slot === 'trinket' ? 'trinket1' : it.slot === 'onehand' || it.slot === 'twohand' ? 'mainhand' : it.slot;
    const cur = p.equip?.[slot];
    if (cur && cur.id !== id) h += `<hr style="border-color:#444"><div class="tt-m">Currently Equipped:</div>` + itemTooltip(cur.id, cur);
  }
  return h;
}

export function spellTooltip(id, rank, unit = G.player) {
  const ab = ABILITIES[id];
  if (!ab) return '';
  const r = rank ?? (knownRank(unit, id) || 1);
  const rd = rankData(ab, r);
  let h = `<div class="tt-row"><span class="tt-n tt-w">${escapeHTML(ab.name)}</span>${ab.ranks && ab.ranks.length > 1 ? `<span class="tt-m">Rank ${r}</span>` : ''}</div>`;
  if (ab.passive) h += `<div class="tt-w">Passive</div>`;
  else {
    const cost = unit ? abilityCost(unit, ab, rd) : rd.cost ?? 0;
    const pt = unit ? defaultPower(unit, ab) : 'mana';
    const range = unit ? abilityRange(unit, ab, rd) : rd.range;
    const left = cost ? `${cost} ${pt === 'health' ? 'Health' : cap(pt)}` : '';
    const right = range === 'melee' ? 'Melee Range' : range ? `${range} yd range` : '';
    if (left || right) h += `<div class="tt-row"><span class="tt-w">${left}</span><span class="tt-w">${right}</span></div>`;
    const ct = unit ? castTime(unit, ab, rd) : rd.cast ?? 0;
    const cd = (rd.cd ?? ab.cd ?? 0) + (unit?.mods?.cd?.[id] ?? 0);
    const castTxt = ab.channel ? 'Channeled' : ct > 0 ? `${+ct.toFixed(2)} sec cast` : ab.onNextSwing ? 'Next melee' : 'Instant';
    h += `<div class="tt-row"><span class="tt-w">${castTxt}</span><span class="tt-w">${cd > 0 ? fmtDuration(cd) + ' cooldown' : ''}</span></div>`;
    const reqs = [];
    if (ab.stance) reqs.push('Requires ' + ab.stance.map((s) => cap(s) + ' Stance').join(', '));
    if (ab.form) reqs.push(`Requires ${cap(ab.form)} Form`);
    if (ab.weapon) reqs.push(`Requires ${cap(ab.weapon)}`);
    if (ab.shield) reqs.push('Requires Shields');
    if (ab.reagent) reqs.push(`Reagents: ${getItem(ab.reagent)?.name}`);
    for (const q of reqs) h += `<div class="tt-w">${q}</div>`;
  }
  try { h += `<div class="tt-d">${escapeHTML(ab.desc?.(rd) ?? '')}</div>`; } catch { /* description templates are best effort */ }
  return h;
}

export function unitTooltip(u) {
  const p = G.player;
  let h = `<div class="tt-n" style="color:${u.faction === 'hostile' ? '#ff4040' : u.faction === 'neutral' ? '#ffff40' : '#40ff40'}">${escapeHTML(u.name)}</div>`;
  if (u.title) h += `<div class="tt-w">&lt;${escapeHTML(u.title)}&gt;</div>`;
  if (u.kind === 'mob' || u.kind === 'pet') {
    const cls = u.elite ? ' (Elite)' : u.rare ? ' (Rare)' : u.boss ? ' (Boss)' : '';
    h += `<div class="tt-w">Level <span style="color:${conColor(p.level, u.level)}">${u.level}</span> ${cap(u.creature)}${cls}</div>`;
  } else if (u.kind === 'companion' || u.kind === 'player') h += `<div class="tt-w">Level ${u.level} ${CLASSES[u.cls]?.name ?? ''}</div>`;
  if (u.dead) h += `<div class="tt-m">Corpse</div>`;
  if (u.npc?.quests) h += `<div class="tt-y">Quest giver</div>`;
  return h;
}

export function trainerTooltip(entry) {
  return spellTooltip(entry.ab.id, entry.rank) + `<div class="tt-w">Requires level ${entry.lvl}</div><div class="tt-w">Cost: ${moneyHTML(trainCost(entry.lvl))}</div>`;
}

export function showTooltip(html, x, y) {
  const el = tt();
  if (!html) { el.hidden = true; return; }
  el.innerHTML = html;
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight;
  let px = x + 16, py = y + 16;
  if (px + w > window.innerWidth - 4) px = x - w - 12;
  if (py + h > window.innerHeight - 4) py = window.innerHeight - h - 4;
  el.style.left = Math.max(4, px) + 'px';
  el.style.top = Math.max(4, py) + 'px';
}
export function hideTooltip() { tt().hidden = true; }
// Attach hover tooltips to an element (desktop only; touch uses context menus).
export function bindTooltip(el, fn) {
  el.addEventListener('mouseenter', (e) => { if (!G.isTouch) showTooltip(fn(), e.clientX, e.clientY); });
  el.addEventListener('mousemove', (e) => { if (!G.isTouch && !tt().hidden) showTooltip(fn(), e.clientX, e.clientY); });
  el.addEventListener('mouseleave', hideTooltip);
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
