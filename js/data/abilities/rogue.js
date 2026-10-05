import { defineAbility, weaponStrike, dot, interrupt, addCombo, dealDamage, engage, aoeEnemies } from '../../engine/spells.js';
import { G, emit } from '../../state.js';
import * as fx from '../../engine/fx.js';
import { rand, randInt } from '../../util.js';

const R = 'rogue';
const hit = (r) => r.outcome !== 'miss' && r.outcome !== 'dodge' && r.outcome !== 'parry';

defineAbility({
  id: 'sinister_strike', name: 'Sinister Strike', cls: R, icon: 'sword', range: 'melee', melee: true,
  ranks: [{ lvl: 1, cost: 45, bonus: 3 }, { lvl: 6, cost: 45, bonus: 6 }, { lvl: 14, cost: 45, bonus: 10 }],
  desc: (r) => `An instant strike that causes ${r.bonus} damage in addition to your normal weapon damage. Awards 1 combo point.`,
  effect: ({ u, t, ab, rd }) => { const r = weaponStrike(u, t, ab, { bonus: rd.bonus, refundOnMiss: true }); if (hit(r)) addCombo(u, t, 1 + (r.outcome === 'crit' && Math.random() < (u.mods?.sealFate ?? 0) ? 1 : 0)); },
});
defineAbility({
  id: 'eviscerate', name: 'Eviscerate', cls: R, icon: 'dagger', range: 'melee', melee: true, combo: true,
  ranks: [{ lvl: 1, cost: 35, min: 6, max: 11, per: 6 }, { lvl: 8, cost: 35, min: 10, max: 16, per: 8 }, { lvl: 16, cost: 35, min: 17, max: 25, per: 15 }],
  desc: (r) => `Finishing move that causes damage per combo point: 1 point: ${r.min}-${r.max}, 5 points: ${r.min + r.per * 4}-${r.max + r.per * 4}.`,
  effect: ({ u, t, ab, rd }) => {
    const cp = u.comboPoints;
    const base = rand(rd.min, rd.max) + rd.per * (cp - 1) + u.stats.ap * 0.03 * cp;
    const r = weaponStrike(u, t, ab, { flat: base * (1 + (u.mods?.eviscPct ?? 0)) });
    if (!hit(r)) { u.comboPoints = cp; return false; }
    if (Math.random() < (u.mods?.ruthless ?? 0) * 0.2) { u.comboPoints = 0; addCombo(u, t, 1); return false; }
  },
});
defineAbility({
  id: 'stealth', name: 'Stealth', cls: R, icon: 'mask', target: 'self', gcd: false, cd: 10, keepStealth: true,
  ranks: [{ lvl: 1, cost: 0, speed: 0.6 }],
  desc: () => 'Allows the rogue to sneak around, but reduces your speed by 40%. Lasts until cancelled. Any action other than certain finesse abilities breaks stealth.',
  usable: (u) => !u.inCombat || u.hasFlag('stealth'), usableMsg: "You can't do that while in combat.",
  effect: ({ u }) => {
    if (u.hasFlag('stealth')) { u.breakStealth(); return; }
    u.autoAttack = false;
    u.addAura({ id: 'stealth', name: 'Stealth', icon: 'mask', dur: Infinity, flags: { stealth: true }, onRemove: () => { u.cooldowns.stealth = G.time + 10; } }, u);
  },
});
defineAbility({
  id: 'backstab', name: 'Backstab', cls: R, icon: 'dagger', range: 'melee', melee: true, behind: true, weapon: 'dagger', learn: 4,
  ranks: [{ lvl: 4, cost: 60, bonus: 15 }, { lvl: 12, cost: 60, bonus: 30 }, { lvl: 20, cost: 60, bonus: 48 }],
  desc: (r) => `Backstab the target, causing 150% weapon damage plus ${r.bonus}. Must be behind the target. Requires a dagger. Awards 1 combo point.`,
  effect: ({ u, t, ab, rd }) => { const r = weaponStrike(u, t, ab, { mult: 1.5, bonus: rd.bonus, critBonus: u.mods?.backstabCrit ?? 0, refundOnMiss: true }); if (hit(r)) addCombo(u, t); },
});
defineAbility({
  id: 'pick_pocket', name: 'Pick Pocket', cls: R, icon: 'coin', stealth: true, keepStealth: true, range: 5, creature: ['humanoid'], gcd: false, learn: 4, targetOutOfCombat: true,
  ranks: [{ lvl: 4, cost: 0 }],
  usable: (u, t) => !!t && !t.data.pickpocketed, usableMsg: 'Your target has no pockets to pick.',
  desc: () => 'Pick the target\'s pocket. Must be stealthed.',
  effect: ({ u, t }) => {
    t.data.pickpocketed = true;
    if (Math.random() < 0.15) { engage(t, u); u.breakStealth(); emit('error', 'Your target noticed you!'); return; }
    emit('pickpocket', { unit: u, target: t, money: randInt(t.level * 3, t.level * 9) });
  },
});
defineAbility({
  id: 'gouge', name: 'Gouge', cls: R, icon: 'fist', range: 'melee', melee: true, cd: 10, learn: 6,
  ranks: [{ lvl: 6, cost: 45, dmg: 10, dur: 4 }, { lvl: 18, cost: 45, dmg: 20, dur: 4 }],
  desc: (r) => `Causes ${r.dmg} damage, incapacitating the opponent for ${r.dur} sec and turning off your attack. Any damage caused will revive the target. Awards 1 combo point.`,
  effect: ({ u, t, ab, rd }) => {
    const r = weaponStrike(u, t, ab, { flat: rd.dmg, noBlock: true });
    if (!hit(r)) return;
    t.addAura({ id: 'gouge', name: 'Gouge', icon: 'fist', dur: rd.dur + (u.mods?.gougeDur ?? 0), debuff: true, flags: { incap: true }, breakOnDamage: true, appliedBy: 'gouge' }, u);
    u.autoAttack = false;
    addCombo(u, t);
  },
});
defineAbility({
  id: 'evasion', name: 'Evasion', cls: R, icon: 'cloak', target: 'self', cd: 300, gcd: false, learn: 8,
  ranks: [{ lvl: 8, cost: 0 }],
  desc: () => 'Increases the rogue\'s dodge chance by 50% for 15 sec.',
  effect: ({ u }) => u.addAura({ id: 'evasion', name: 'Evasion', icon: 'cloak', dur: 15, mods: { dodge: 50 } }, u),
});
defineAbility({
  id: 'sap', name: 'Sap', cls: R, icon: 'mace', stealth: true, keepStealth: true, range: 5, creature: ['humanoid'], targetOutOfCombat: true, learn: 10,
  ranks: [{ lvl: 10, cost: 65, dur: 25 }],
  desc: (r) => `Incapacitates the target for up to ${r.dur} sec. Must be stealthed. Only works on Humanoids that are not in combat. Any damage caused will revive the target.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'sap', name: 'Sap', icon: 'mace', dur: rd.dur, debuff: true, flags: { incap: true }, breakOnDamage: true }, u); fx.at(t, 0xffff80, 6); },
});
defineAbility({
  id: 'slice_and_dice', name: 'Slice and Dice', cls: R, icon: 'swords', target: 'self', combo: true, learn: 10, comboAny: true,
  ranks: [{ lvl: 10, cost: 25 }],
  desc: () => 'Finishing move that increases melee attack speed by 20%. Lasts longer per combo point: 1 point 9 sec, 5 points 21 sec.',
  effect: ({ u }) => { u.addAura({ id: 'slice_and_dice', name: 'Slice and Dice', icon: 'swords', dur: (6 + 3 * u.comboPoints) * (1 + (u.mods?.sndDur ?? 0)), mods: { atkSpeed: 0.2 } }, u); },
});
defineAbility({
  id: 'sprint', name: 'Sprint', cls: R, icon: 'boot', target: 'self', cd: 300, gcd: false, keepStealth: true, learn: 10,
  ranks: [{ lvl: 10, cost: 0 }],
  desc: () => 'Increases the rogue\'s movement speed by 70% for 15 sec. Does not break stealth.',
  effect: ({ u }) => u.addAura({ id: 'sprint', name: 'Sprint', icon: 'boot', dur: 15, mods: { speed: 0.7 } }, u),
});
defineAbility({
  id: 'kick', name: 'Kick', cls: R, icon: 'boot', range: 'melee', melee: true, cd: 10, learn: 12,
  ranks: [{ lvl: 12, cost: 25, dmg: 15 }],
  desc: (r) => `A quick kick that injures a single foe for ${r.dmg} damage. It also interrupts spellcasting and prevents any spell in that school from being cast for 5 sec.`,
  effect: ({ u, t, ab, rd }) => { const r = weaponStrike(u, t, ab, { flat: rd.dmg }); if (hit(r)) interrupt(u, t, 5); },
});
defineAbility({
  id: 'expose_armor', name: 'Expose Armor', cls: R, icon: 'armor', range: 'melee', melee: true, combo: true, learn: 14,
  ranks: [{ lvl: 14, cost: 25, per: 80 }],
  desc: (r) => `Finishing move that exposes the target, reducing armor by ${r.per} per combo point for 30 sec.`,
  effect: ({ u, t, ab, rd }) => {
    const r = weaponStrike(u, t, ab, { flat: 0, noProcs: true });
    if (!hit(r)) { return false; }
    t.addAura({ id: 'expose_armor', name: 'Expose Armor', icon: 'armor', dur: 30, debuff: true, mods: { armor: -rd.per * u.comboPoints } }, u);
  },
});
defineAbility({
  id: 'garrote', name: 'Garrote', cls: R, icon: 'chain', range: 'melee', melee: true, stealth: true, behind: true, learn: 14,
  ranks: [{ lvl: 14, cost: 50, total: 144 }],
  desc: (r) => `Garrote the enemy, causing ${r.total} damage over 18 sec. Must be stealthed and behind the target. Awards 1 combo point.`,
  effect: ({ u, t, ab, rd }) => { dot(u, t, ab, { total: rd.total + u.stats.ap * 0.18, dur: 18, interval: 3, school: 'physical' }); engage(t, u); addCombo(u, t); u.autoAttack = true; },
});
defineAbility({
  id: 'feint', name: 'Feint', cls: R, icon: 'cloak', range: 'melee', cd: 10, learn: 16,
  ranks: [{ lvl: 16, cost: 20, threat: 150 }],
  desc: (r) => `Performs a feint, causing no damage but lowering your threat by ${r.threat}.`,
  effect: ({ u, t, rd }) => { if (t.threat?.has(u)) t.threat.set(u, Math.max(0, t.threat.get(u) - rd.threat)); },
});
defineAbility({
  id: 'ambush', name: 'Ambush', cls: R, icon: 'dagger', range: 'melee', melee: true, stealth: true, behind: true, weapon: 'dagger', learn: 18,
  ranks: [{ lvl: 18, cost: 60, bonus: 70 }],
  desc: (r) => `Ambush the target, causing 250% weapon damage plus ${r.bonus}. Must be stealthed and behind the target. Requires a dagger. Awards 1 combo point.`,
  effect: ({ u, t, ab, rd }) => { const r = weaponStrike(u, t, ab, { mult: 2.5, bonus: rd.bonus, critBonus: u.mods?.ambushCrit ?? 0 }); if (hit(r)) addCombo(u, t); u.autoAttack = true; },
});
defineAbility({
  id: 'rupture', name: 'Rupture', cls: R, icon: 'claw', range: 'melee', melee: true, combo: true, learn: 20,
  ranks: [{ lvl: 20, cost: 25 }],
  desc: () => 'Finishing move that causes damage over time, increased by combo points: 1 point 40 over 8 sec, 5 points 144 over 16 sec.',
  effect: ({ u, t, ab }) => {
    const cp = u.comboPoints;
    const totals = [0, 40, 60, 84, 112, 144];
    const r = weaponStrike(u, t, ab, { flat: 0, noProcs: true });
    if (!hit(r)) return false;
    dot(u, t, ab, { total: totals[cp] + u.stats.ap * 0.04 * cp, dur: 6 + 2 * cp, interval: 2, school: 'physical' });
  },
});
defineAbility({
  id: 'instant_poison', name: 'Instant Poison', cls: R, icon: 'poison', target: 'self', school: 'nature', learn: 20,
  ranks: [{ lvl: 20, cost: 0, cast: 3, min: 19, max: 25 }],
  desc: (r) => 'Coats your weapons with poison for 30 min. Each strike has a 20% chance of poisoning the enemy, instantly inflicting ' + `${r.min} to ${r.max} Nature damage.`,
  effect: ({ u, rd }) => u.addAura({
    id: 'instant_poison', name: 'Instant Poison', icon: 'poison', dur: 1800,
    onHit: (a, t) => { if (!t.dead && Math.random() < 0.2 + (u.mods?.poisonChance ?? 0)) dealDamage(u, t, rand(rd.min, rd.max), { school: 'nature', abilityName: 'Instant Poison' }); },
  }, u),
});
// talents
defineAbility({
  id: 'cold_blood', name: 'Cold Blood', cls: R, icon: 'drop', target: 'self', cd: 180, gcd: false, talent: true,
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'When activated, increases the critical strike chance of your next offensive ability by 100%.',
  effect: ({ u }) => u.addAura({ id: 'cold_blood', name: 'Cold Blood', icon: 'drop', dur: 60, mods: { crit: 100 }, onHit: (a) => { a.remaining = 0; } }, u),
});
defineAbility({
  id: 'blade_flurry', name: 'Blade Flurry', cls: R, icon: 'swords', target: 'self', cd: 120, talent: true,
  ranks: [{ lvl: 1, cost: 25 }],
  desc: () => 'Increases your attack speed by 20%. In addition, attacks strike an additional nearby opponent. Lasts 15 sec.',
  effect: ({ u }) => u.addAura({
    id: 'blade_flurry', name: 'Blade Flurry', icon: 'swords', dur: 15, mods: { atkSpeed: 0.2 },
    onHit: (a, t, outcome, dmg) => { const o = aoeEnemies(u, t.pos.x, t.pos.z, 6).find((e) => e !== t); if (o) dealDamage(u, o, dmg, { school: 'physical', abilityName: 'Blade Flurry', ignoreArmor: true }); },
  }, u),
});
defineAbility({
  id: 'ghostly_strike', name: 'Ghostly Strike', cls: R, icon: 'ghost', range: 'melee', melee: true, cd: 20, talent: true,
  ranks: [{ lvl: 1, cost: 40 }],
  desc: () => 'A strike that deals 125% weapon damage and increases your chance to dodge by 15% for 7 sec. Awards 1 combo point.',
  effect: ({ u, t, ab }) => { const r = weaponStrike(u, t, ab, { mult: 1.25 }); if (hit(r)) { addCombo(u, t); u.addAura({ id: 'ghostly_strike', name: 'Ghostly Strike', icon: 'ghost', dur: 7, mods: { dodge: 15 } }, u); } },
});
