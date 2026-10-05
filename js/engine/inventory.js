// Bags, equipment, vendors and consumables for the player.
import { G, emit } from '../state.js';
import { getItem, isTwoHand, isRanged, EQUIP_SLOTS } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { heal } from './combat.js';
import { castAbility } from './spells.js';
import { refreshCharacterModel } from './appearance.js';
import { moneyText } from '../util.js';
import * as fx from './fx.js';

export const BACKPACK = 16;

export function initInventory(u, save) {
  u.bags = save?.bags ?? [{ id: 'backpack', slots: new Array(BACKPACK).fill(null) }, null, null, null, null];
  u.money = save?.money ?? 0;
  u.equip = save?.equip ?? {};
  u.buyback = [];
  u.addItem = (id, n = 1, extra) => addItem(u, id, n, extra);
  u.removeItem = (id, n = 1) => removeItem(u, id, n);
  u.hasItem = (id) => countItem(u, id) > 0;
  u.countItem = (id) => countItem(u, id);
  u.ammoItem = () => ammoItem(u);
  u.useAmmo = () => useAmmo(u);
}

export function bagSize(b) { return b ? b.slots.length : 0; }
export function* allSlots(u) {
  for (let bi = 0; bi < u.bags.length; bi++) {
    const b = u.bags[bi];
    if (!b) continue;
    for (let si = 0; si < b.slots.length; si++) yield [bi, si, b.slots[si]];
  }
}
export function countItem(u, id) {
  let n = 0;
  for (const [, , s] of allSlots(u)) if (s?.id === id) n += s.n;
  return n;
}
export function freeSlots(u) {
  let n = 0;
  for (const [, , s] of allSlots(u)) if (!s) n++;
  return n;
}
export function addItem(u, id, n = 1, extra = {}) {
  const it = getItem(id);
  if (!it) return n;
  const stack = it.stack ?? 1;
  let left = n;
  if (stack > 1) {
    for (const [bi, si, s] of allSlots(u)) {
      if (left <= 0) break;
      if (s?.id === id && s.n < stack) {
        const k = Math.min(stack - s.n, left);
        s.n += k; left -= k;
      }
    }
  }
  for (const [bi, si, s] of allSlots(u)) {
    if (left <= 0) break;
    if (!s) {
      const k = Math.min(stack, left);
      u.bags[bi].slots[si] = { id, n: k, ...(it.dur ? { dur: extra.dur ?? it.dur } : {}) };
      left -= k;
    }
  }
  if (left < n) emit('bagsChanged', { unit: u, added: id });
  if (left > 0) emit('error', 'Inventory is full.');
  return left;
}
export function removeItem(u, id, n = 1) {
  let left = n;
  for (const [bi, si, s] of allSlots(u)) {
    if (left <= 0) break;
    if (s?.id === id) {
      const k = Math.min(s.n, left);
      s.n -= k; left -= k;
      if (s.n <= 0) u.bags[bi].slots[si] = null;
    }
  }
  if (left < n) emit('bagsChanged', { unit: u });
  return n - left;
}
function ammoItem(u) {
  const rt = u.weapon('ranged')?.type;
  for (const [, , s] of allSlots(u)) {
    const it = s && getItem(s.id);
    if (it?.type === 'ammo' && (it.ammo === 'bow' && (rt === 'bow' || rt === 'gun'))) return s.id;
  }
  return null;
}
function useAmmo(u) {
  const a = ammoItem(u);
  if (!a) return false;
  removeItem(u, a, 1);
  if (!ammoItem(u)) u.dirty = true;
  return true;
}

// ---------- equipment ----------
const SLOT_FOR = {
  head: ['head'], neck: ['neck'], shoulder: ['shoulder'], back: ['back'], chest: ['chest'], wrist: ['wrist'], hands: ['hands'], waist: ['waist'],
  legs: ['legs'], feet: ['feet'], finger: ['finger1', 'finger2'], trinket: ['trinket1', 'trinket2'], onehand: ['mainhand', 'offhand'], mainhand: ['mainhand'],
  offhand: ['offhand'], twohand: ['mainhand'], ranged: ['ranged'],
};
export function canEquip(u, it) {
  if (!it || !SLOT_FOR[it.slot]) return { ok: false, reason: 'You can\'t equip that.' };
  const C = CLASSES[u.cls];
  if ((it.req ?? 1) > u.level) return { ok: false, reason: `You must reach level ${it.req} to use that item.` };
  if (it.armor !== undefined && ['cloth', 'leather', 'mail', 'shield'].includes(it.type) && !C.armor.includes(it.type) && it.slot !== 'back') return { ok: false, reason: `You can't wear ${it.type} armor.` };
  if (it.dmg && !C.weapons.includes(it.type)) return { ok: false, reason: 'You don\'t know how to use that weapon.' };
  return { ok: true };
}
export function equipItem(u, bi, si) {
  const s = u.bags[bi]?.slots[si];
  if (!s) return false;
  const it = getItem(s.id);
  if (it?.type === 'bag') return equipBag(u, bi, si);
  const chk = canEquip(u, it);
  if (!chk.ok) { emit('error', chk.reason); return false; }
  if (u.inCombat && (it.slot === 'chest' || it.slot === 'legs' || it.slot === 'feet' || it.slot === 'head')) {
    // armor swaps are allowed; classic only blocked weapon swaps during casting
  }
  let target = SLOT_FOR[it.slot][0];
  const options = SLOT_FOR[it.slot];
  if (it.slot === 'onehand') {
    target = 'mainhand';
    const mh = u.equip.mainhand && getItem(u.equip.mainhand.id);
    if (mh && !isTwoHand(mh.type) && u.canDualWield() && !u.equip.offhand) target = 'offhand';
  } else if (options.length > 1) {
    target = options.find((o) => !u.equip[o]) ?? options[0];
  }
  const displaced = [];
  if (u.equip[target]) displaced.push(u.equip[target]);
  // two-handers clear the off-hand; off-hands clear a two-hander
  if (isTwoHand(it.type) && u.equip.offhand) { displaced.push(u.equip.offhand); delete u.equip.offhand; }
  if (target === 'offhand' && u.equip.mainhand && isTwoHand(getItem(u.equip.mainhand.id)?.type)) { displaced.push(u.equip.mainhand); delete u.equip.mainhand; }
  if (target === 'offhand' && it.dmg && !u.canDualWield()) { emit('error', 'You cannot dual wield yet.'); return false; }
  u.bags[bi].slots[si] = null;
  u.equip[target] = { id: s.id, dur: s.dur ?? it.dur, soulbound: true };
  for (const d of displaced) {
    const left = placeInstance(u, d, bi, si);
    if (left) { emit('error', 'Inventory is full.'); }
  }
  afterEquipChange(u);
  return true;
}
function placeInstance(u, inst, preferBag, preferSlot) {
  if (preferBag !== undefined && !u.bags[preferBag].slots[preferSlot]) { u.bags[preferBag].slots[preferSlot] = { id: inst.id, n: 1, dur: inst.dur }; return 0; }
  for (const [bi, si, s] of allSlots(u)) if (!s) { u.bags[bi].slots[si] = { id: inst.id, n: 1, dur: inst.dur }; return 0; }
  return 1;
}
export function unequip(u, slot) {
  const inst = u.equip[slot];
  if (!inst) return false;
  if (freeSlots(u) <= 0) { emit('error', 'Inventory is full.'); return false; }
  delete u.equip[slot];
  placeInstance(u, inst);
  afterEquipChange(u);
  return true;
}
function equipBag(u, bi, si) {
  const s = u.bags[bi].slots[si];
  const it = getItem(s.id);
  const free = u.bags.findIndex((b, i) => i > 0 && !b);
  if (free < 0) { emit('error', 'All bag slots are full.'); return false; }
  u.bags[bi].slots[si] = null;
  u.bags[free] = { id: s.id, slots: new Array(it.bagSlots).fill(null) };
  emit('bagsChanged', { unit: u });
  return true;
}
export function afterEquipChange(u) {
  u.dirty = true;
  u.recalc();
  refreshCharacterModel(u);
  // keep auto-attack timers sane after weapon swaps
  u.swing.mh = Math.max(u.swing.mh, 0.5);
  emit('equipChanged', { unit: u });
  emit('bagsChanged', { unit: u });
}
export function moveItem(u, fb, fs, tb, ts) {
  const A = u.bags[fb]?.slots, B = u.bags[tb]?.slots;
  if (!A || !B) return;
  const a = A[fs], b = B[ts];
  if (a && b && a.id === b.id) {
    const stack = getItem(a.id).stack ?? 1;
    const k = Math.min(stack - b.n, a.n);
    if (k > 0) { b.n += k; a.n -= k; if (a.n <= 0) A[fs] = null; emit('bagsChanged', { unit: u }); return; }
  }
  A[fs] = b; B[ts] = a;
  emit('bagsChanged', { unit: u });
}
export function destroyItem(u, bi, si) {
  u.bags[bi].slots[si] = null;
  emit('bagsChanged', { unit: u });
}

// ---------- durability and repair ----------
export function damageGear(u, pct) {
  for (const slot of EQUIP_SLOTS) {
    const inst = u.equip[slot];
    if (!inst) continue;
    const it = getItem(inst.id);
    if (!it?.dur) continue;
    inst.dur = Math.max(0, Math.floor((inst.dur ?? it.dur) - it.dur * pct));
  }
  u.dirty = true;
  emit('equipChanged', { unit: u });
}
export function repairCost(u) {
  let c = 0;
  for (const slot of EQUIP_SLOTS) {
    const inst = u.equip[slot];
    if (!inst) continue;
    const it = getItem(inst.id);
    if (!it?.dur) continue;
    const missing = it.dur - (inst.dur ?? it.dur);
    if (missing > 0) c += Math.ceil((missing / it.dur) * Math.max(10, it.price * 0.6 + it.ilvl * 4));
  }
  return c;
}
export function repairAll(u) {
  const c = repairCost(u);
  if (c <= 0) return;
  if (u.money < c) { emit('error', 'You don\'t have enough money to repair.'); return; }
  u.money -= c;
  for (const slot of EQUIP_SLOTS) {
    const inst = u.equip[slot];
    const it = inst && getItem(inst.id);
    if (it?.dur) inst.dur = it.dur;
  }
  u.dirty = true;
  emit('system', `Your items have been repaired for ${moneyText(c)}.`);
  emit('equipChanged', { unit: u });
  emit('money', { unit: u });
}

// ---------- vendors ----------
export function buyPrice(it) { return it.buyPrice ?? Math.max(1, Math.round((it.price || 1) * 4)); }
export function buyItem(u, id, count) {
  const it = getItem(id);
  const n = count ?? it.buyStack ?? 1;
  const price = buyPrice(it) * (it.buyStack ? 1 : n);
  if (u.money < price) { emit('error', 'You don\'t have enough money.'); return false; }
  const left = addItem(u, id, n);
  if (left === n) return false;
  u.money -= price;
  emit('money', { unit: u });
  return true;
}
export function sellItem(u, bi, si) {
  const s = u.bags[bi]?.slots[si];
  if (!s) return;
  const it = getItem(s.id);
  if (it.quest) { emit('error', 'You can\'t sell quest items.'); return; }
  if (!it.price) { emit('error', 'The merchant doesn\'t want that.'); return; }
  const value = it.price * s.n;
  u.money += value;
  u.bags[bi].slots[si] = null;
  u.buyback.unshift({ ...s, value });
  u.buyback.length = Math.min(u.buyback.length, 12);
  emit('money', { unit: u });
  emit('bagsChanged', { unit: u });
  emit('sold', { item: it, n: s.n, value });
}
export function buyBack(u, idx) {
  const b = u.buyback[idx];
  if (!b || u.money < b.value) { emit('error', 'You don\'t have enough money.'); return; }
  if (freeSlots(u) <= 0) { emit('error', 'Inventory is full.'); return; }
  u.money -= b.value;
  placeInstance(u, b);
  for (const [bi, si, s] of allSlots(u)) if (s && s.id === b.id && s.n === 1 && b.n > 1) { s.n = b.n; break; }
  u.buyback.splice(idx, 1);
  emit('money', { unit: u });
  emit('bagsChanged', { unit: u });
}
export function sellJunk(u) {
  let total = 0;
  for (const [bi, si, s] of allSlots(u)) {
    if (!s) continue;
    const it = getItem(s.id);
    if (it.q === 0 && it.price) { total += it.price * s.n; u.bags[bi].slots[si] = null; }
  }
  if (total) {
    u.money += total;
    emit('system', `Sold junk for ${moneyText(total)}.`);
    emit('money', { unit: u });
    emit('bagsChanged', { unit: u });
  }
}

// ---------- using items ----------
export function useItem(u, bi, si) {
  const s = u.bags[bi]?.slots[si];
  if (!s) return false;
  const it = getItem(s.id);
  if (!it) return false;
  if (u.dead && !it.use?.hearth) return false;
  if ((it.req ?? 1) > u.level && it.use) { emit('error', `Requires level ${it.req}.`); return false; }
  if (it.slot && it.slot !== 'ammo' && (it.armor !== undefined || it.dmg || it.type === 'bag')) return equipItem(u, bi, si);
  const use = it.use;
  if (!use) return false;
  if (use.food || use.drink) {
    if (u.inCombat) { emit('error', "You can't eat or drink while in combat."); return false; }
    u.sitting = true;
    u.moving = 0;
    const id = use.food ? 'food' : 'drink';
    const per = (use.food ?? use.drink) / use.dur;
    u.addAura({
      id, name: use.food ? 'Food' : 'Drink', icon: use.food ? 'meat' : 'drink', dur: use.dur, eating: true, interval: 1,
      tick: (a) => { if (use.food) a.unit.hp = Math.min(a.unit.maxHp, a.unit.hp + per); else a.unit.mana = Math.min(a.unit.maxMana, a.unit.mana + per); },
      update: (a) => { if (!a.unit.sitting) a.remaining = 0; },
    }, u);
    removeItem(u, s.id, 1);
    return true;
  }
  if (use.potion || use.stone) {
    const key = use.stone ? 'cd:stone' : 'cd:potion';
    if ((u.cooldowns[key] ?? 0) > G.time) { emit('error', 'Item is not ready yet.'); return false; }
    u.cooldowns[key] = G.time + 120;
    if (use.heal) { heal(u, u, use.heal[0] + Math.random() * (use.heal[1] - use.heal[0]), { abilityName: it.name, noThreat: false }); fx.rise(u, 0xff4040, 14); }
    if (use.mana) { u.mana = Math.min(u.maxMana, u.mana + use.mana[0] + Math.random() * (use.mana[1] - use.mana[0])); fx.rise(u, 0x4080ff, 14); }
    removeItem(u, s.id, 1);
    emit('itemUsed', { unit: u, item: it });
    return true;
  }
  if (use.buff) {
    const B = { elixir_str: { str: 8 }, elixir_agi: { agi: 8 }, elixir_sta: { sta: 8 }, elixir_int: { int: 8 } }[use.buff];
    u.addAura({ id: use.buff, name: it.name, icon: it.icon, dur: 1800, mods: B, group: 'elixir', groupAny: true }, u);
    removeItem(u, s.id, 1);
    fx.rise(u, 0xffc040, 12);
    return true;
  }
  if (use.bandage) {
    if (u.hasAura('recently_bandaged')) { emit('error', 'You are recently bandaged.'); return false; }
    if (!castAbility(u, 'bandage', u, { free: true, rank: 1 })) return false;
    removeItem(u, s.id, 1);
    if (u.cast) u.cast.bandage = use.bandage;
    u.addAura({ id: 'recently_bandaged', name: 'Recently Bandaged', icon: 'bandage', dur: 60, debuff: true }, u);
    return true;
  }
  if (use.hearth) {
    if ((u.cooldowns.hearth ?? 0) > G.time) { emit('error', 'Hearthstone is not ready yet.'); return false; }
    if (u.dead) return false;
    castAbility(u, 'hearthstone_cast', u, { free: true, rank: 1 });
    return true;
  }
  return false;
}
