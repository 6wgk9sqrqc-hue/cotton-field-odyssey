// Experience, levels, rested bonus and class training.
import { G, emit } from '../state.js';
import { xpToLevel, MAX_LEVEL, trainCost, CLASSES } from '../data/classes.js';
import { ABILITIES } from './spells.js';
import { talentPointsAt, pointsSpent } from '../data/talents.js';
import * as fx from './fx.js';

export function gainXP(u, amount, source) {
  if (u.level >= MAX_LEVEL || amount <= 0) return;
  let bonus = 0;
  if (source === 'kill' && u.rested > 0) {
    bonus = Math.min(amount, u.rested);
    u.rested -= bonus;
  }
  const total = amount + bonus;
  u.xp += total;
  emit('xp', { unit: u, amount: total, bonus, source });
  while (u.level < MAX_LEVEL && u.xp >= xpToLevel(u.level)) {
    u.xp -= xpToLevel(u.level);
    levelUp(u);
  }
  if (u.level >= MAX_LEVEL) u.xp = 0;
}

export function levelUp(u) {
  const oldHp = u.maxHp, oldMana = u.maxMana;
  const oldStats = { ...u.stats };
  u.level += 1;
  u.dirty = true;
  u.recalc();
  u.hp = u.maxHp;
  u.mana = u.maxMana;
  fx.rise(u, 0xffe080, 60);
  fx.novaAt(u, 6, 0xffe080);
  const gains = {};
  for (const k of ['str', 'agi', 'sta', 'int', 'spi']) gains[k] = (u.stats[k] ?? 0) - (oldStats[k] ?? 0);
  const newSpells = trainableAt(u, u.level).filter((x) => x.lvl === u.level).map((x) => x.name + (x.rank > 1 ? ` (Rank ${x.rank})` : ''));
  emit('levelUp', { unit: u, level: u.level, hp: u.maxHp - oldHp, mana: u.maxMana - oldMana, gains, newSpells, talentPoint: u.level >= 10 });
  if (u.pet) { u.pet.level = u.level; u.pet.dirty = true; u.pet.recalc(); u.pet.hp = u.pet.maxHp; }
}

// Every ability rank the class can learn up to `level`.
export function classAbilities(cls) {
  return Object.values(ABILITIES).filter((a) => a.cls === cls && !a.talent);
}
export function trainableAt(u, level = u.level) {
  const out = [];
  for (const ab of classAbilities(u.cls)) {
    const ranks = ab.ranks ?? [{ lvl: ab.learn ?? 1 }];
    ranks.forEach((r, i) => {
      if (r.lvl <= level) out.push({ id: ab.id, name: ab.name, rank: i + 1, lvl: r.lvl, ab });
    });
  }
  return out;
}
// What the trainer offers: next unlearned rank of each ability.
export function trainerList(u) {
  const list = [];
  for (const ab of classAbilities(u.cls)) {
    const ranks = ab.ranks ?? [{ lvl: ab.learn ?? 1 }];
    const known = u.spells[ab.id] ?? 0;
    if (known >= ranks.length) continue;
    const next = ranks[known];
    const lvl = next.lvl ?? ab.learn ?? 1;
    // quest-only abilities are taught by trainers in this game
    list.push({ ab, rank: known + 1, lvl, cost: trainCost(lvl), available: lvl <= u.level });
  }
  list.sort((a, b) => a.lvl - b.lvl || a.ab.name.localeCompare(b.ab.name));
  return list;
}
export function learn(u, id, rank) {
  const ab = ABILITIES[id];
  const ranks = ab.ranks ?? [{ lvl: ab.learn ?? 1 }];
  const lvl = ranks[rank - 1]?.lvl ?? 1;
  if (lvl > u.level) { emit('error', `Requires level ${lvl}.`); return false; }
  const cost = trainCost(lvl);
  if (u.money < cost) { emit('error', 'You don\'t have enough money.'); return false; }
  u.money -= cost;
  const first = !u.spells[id];
  u.spells[id] = rank;
  emit('money', { unit: u });
  emit('learned', { unit: u, ability: ab, rank, first });
  emit('system', `You have learned a new ${ab.passive ? 'ability' : 'spell'}: ${ab.name}${rank > 1 ? ` (Rank ${rank})` : ''}.`);
  if (first && !ab.passive) placeOnBar(u, id);
  if (id === 'dual_wield' || id === 'dual_wield_hunter') u.dirty = true;
  return true;
}
export function placeOnBar(u, id) {
  if (u.bar.includes(id)) return;
  const i = u.bar.findIndex((x) => !x);
  if (i >= 0) u.bar[i] = id;
  else {
    const j = u.bar2.findIndex((x) => !x);
    if (j >= 0) u.bar2[j] = id;
  }
  emit('barChanged', { unit: u });
}

export function updateRested(u, dt) {
  // resting near an innkeeper slowly fills the rested pool, up to one and a half levels
  if (!u.resting || u.level >= MAX_LEVEL) return;
  const cap = xpToLevel(u.level) * 1.5;
  u.rested = Math.min(cap, (u.rested ?? 0) + xpToLevel(u.level) * 0.05 * dt / 60);
}
export function unspentTalentPoints(u) { return Math.max(0, talentPointsAt(u.level) - pointsSpent(u)); }
export { CLASSES };
