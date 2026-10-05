import { defineAbility, spellHit, directHeal, dot, hot, aoeEnemies, dealDamage, engage, projectile, weaponStrike, addCombo } from '../../engine/spells.js';
import { setForm, taunt, dash } from '../../engine/summons.js';
import * as fx from '../../engine/fx.js';
import { G } from '../../state.js';

const D = 'druid';
const NATURE = 0x80ff60, ARCANE = 0xc0a0ff;
const hit = (r) => r.outcome !== 'miss' && r.outcome !== 'dodge' && r.outcome !== 'parry';

defineAbility({
  id: 'wrath', name: 'Wrath', cls: D, icon: 'leaf', school: 'nature', range: 30,
  ranks: [{ lvl: 1, cost: 20, cast: 1.5, min: 13, max: 16 }, { lvl: 6, cost: 35, cast: 2.0, min: 28, max: 33 }, { lvl: 14, cost: 55, cast: 2.0, min: 48, max: 57 }],
  desc: (r) => `Causes ${r.min} to ${r.max} Nature damage to the target.`,
  effect: ({ u, t, ab, rd }) => projectile(u, t, { color: NATURE, size: 0.7, speed: 26 }, () => { if (!t.dead) spellHit(u, t, ab, rd.min, rd.max, { coef: rd.cast / 3.5 }); }),
});
defineAbility({
  id: 'starfire', name: 'Starfire', cls: D, icon: 'star', school: 'arcane', range: 30, learn: 20,
  ranks: [{ lvl: 20, cost: 95, cast: 3.5, min: 95, max: 115 }],
  desc: (r) => `Causes ${r.min} to ${r.max} Arcane damage to the target.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: 1 }); fx.burst({ x: t.pos.x, y: t.y + 5, z: t.pos.z }, ARCANE, 30, 3, 0.8, -6); },
});
defineAbility({
  id: 'healing_touch', name: 'Healing Touch', cls: D, icon: 'hand', school: 'nature', target: 'friend', range: 40, heal: true,
  ranks: [{ lvl: 1, cost: 25, cast: 1.5, min: 40, max: 55 }, { lvl: 8, cost: 55, cast: 2.0, min: 94, max: 119 }, { lvl: 14, cost: 110, cast: 2.5, min: 204, max: 253 }, { lvl: 20, cost: 185, cast: 3.0, min: 376, max: 459 }],
  desc: (r) => `Heals a friendly target for ${r.min} to ${r.max}.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: rd.cast / 3.5 }); fx.rise(t, NATURE, 18); },
});
defineAbility({
  id: 'mark_of_the_wild', name: 'Mark of the Wild', cls: D, icon: 'paw', school: 'nature', target: 'friend', range: 30,
  ranks: [{ lvl: 1, cost: 20, armor: 25, stats: 0 }, { lvl: 10, cost: 50, armor: 65, stats: 2 }, { lvl: 20, cost: 100, armor: 105, stats: 4 }],
  desc: (r) => `Increases the friendly target's armor by ${r.armor}${r.stats ? ` and all attributes by ${r.stats}` : ''} for 30 min.`,
  effect: ({ u, t, rd }) => {
    const k = 1 + (u.mods?.motwPct ?? 0);
    t.addAura({ id: 'mark_of_the_wild', name: 'Mark of the Wild', icon: 'paw', dur: 1800, unique: true, mods: { armor: Math.round(rd.armor * k), str: rd.stats, agi: rd.stats, sta: rd.stats, int: rd.stats, spi: rd.stats } }, u);
    fx.rise(t, NATURE, 12);
  },
});
defineAbility({
  id: 'moonfire', name: 'Moonfire', cls: D, icon: 'moon', school: 'arcane', range: 30, learn: 4,
  ranks: [{ lvl: 4, cost: 25, min: 9, max: 12, total: 12, dur: 9 }, { lvl: 10, cost: 50, min: 17, max: 21, total: 32, dur: 12 }, { lvl: 16, cost: 75, min: 30, max: 37, total: 52, dur: 12 }],
  desc: (r) => `Burns the enemy for ${r.min} to ${r.max} Arcane damage and then an additional ${r.total} Arcane damage over ${r.dur} sec.`,
  effect: ({ u, t, ab, rd }) => { if (spellHit(u, t, ab, rd.min, rd.max, { coef: 0.15 })) dot(u, t, ab, { total: rd.total, dur: rd.dur, interval: 3, school: 'arcane', coef: 0.5 }); fx.burst({ x: t.pos.x, y: t.y + 4, z: t.pos.z }, ARCANE, 20, 2, 0.6, -6); },
});
defineAbility({
  id: 'rejuvenation', name: 'Rejuvenation', cls: D, icon: 'leaf', school: 'nature', target: 'friend', range: 40, heal: true, learn: 4,
  ranks: [{ lvl: 4, cost: 25, total: 32 }, { lvl: 10, cost: 40, total: 56 }, { lvl: 16, cost: 75, total: 116 }],
  desc: (r) => `Heals the target for ${r.total} over 12 sec.`,
  effect: ({ u, t, ab, rd }) => { hot(u, t, ab, { total: rd.total * (1 + (u.mods?.rejuvPct ?? 0)), dur: 12, interval: 3, coef: 0.8 }); fx.rise(t, NATURE, 10); },
});
defineAbility({
  id: 'regrowth', name: 'Regrowth', cls: D, icon: 'leaf', school: 'nature', target: 'friend', range: 40, heal: true, learn: 12,
  ranks: [{ lvl: 12, cost: 120, cast: 2, min: 93, max: 107, total: 98 }],
  desc: (r) => `Heals a friendly target for ${r.min} to ${r.max} and another ${r.total} over 21 sec.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: 0.3 }); hot(u, t, ab, { id: 'regrowth_hot', total: rd.total, dur: 21, interval: 3, coef: 0.5 }); fx.rise(t, NATURE, 18); },
});
defineAbility({
  id: 'thorns', name: 'Thorns', cls: D, icon: 'root', school: 'nature', target: 'friend', range: 30, learn: 6,
  ranks: [{ lvl: 6, cost: 35, dmg: 3 }, { lvl: 14, cost: 60, dmg: 6 }],
  desc: (r) => `Thorns sprout from the friendly target causing ${r.dmg} Nature damage to attackers when hit. Lasts 10 min.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'thorns', name: 'Thorns', icon: 'root', dur: 600, unique: true, onStruck: (a, src) => dealDamage(t, src, rd.dmg * (1 + (u.mods?.thornsPct ?? 0)), { school: 'nature', abilityName: 'Thorns' }) }, u); fx.rise(t, NATURE, 8); },
});
defineAbility({
  id: 'entangling_roots', name: 'Entangling Roots', cls: D, icon: 'root', school: 'nature', range: 30, learn: 8, indoorsBlocked: true,
  ranks: [{ lvl: 8, cost: 50, cast: 1.5, total: 20, dur: 12 }, { lvl: 18, cost: 65, cast: 1.5, total: 35, dur: 15 }],
  desc: (r) => `Roots the target in place and causes ${r.total} Nature damage over ${r.dur} sec. Damage caused may interrupt the effect.`,
  effect: ({ u, t, ab, rd }) => {
    if (Math.random() < 0.05) { fx.at(t, 0x888888, 4); engage(t, u); return; }
    t.addAura({
      id: 'entangling_roots', name: 'Entangling Roots', icon: 'root', dur: rd.dur, debuff: true, flags: { root: true }, damageCap: t.maxHp * 0.2, interval: 3,
      tick: (a) => dealDamage(u, t, rd.total / (rd.dur / 3), { school: 'nature', periodic: true, abilityName: ab.name }),
    }, u);
    engage(t, u);
    fx.at(t, 0x5a8a3a, 16);
  },
});
defineAbility({
  id: 'faerie_fire', name: 'Faerie Fire', cls: D, icon: 'sparkle', school: 'nature', range: 30, learn: 18,
  ranks: [{ lvl: 18, cost: 55, armor: 175 }],
  desc: (r) => `Decrease the armor of the target by ${r.armor} for 40 sec. While affected, the target cannot stealth.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'faerie_fire', name: 'Faerie Fire', icon: 'sparkle', dur: 40, debuff: true, mods: { armor: -rd.armor }, unique: true }, u); engage(t, u); fx.at(t, 0xff80ff, 14); },
});
defineAbility({
  id: 'hibernate', name: 'Hibernate', cls: D, icon: 'sleep', school: 'nature', range: 30, creature: ['beast', 'dragonkin'], learn: 18,
  ranks: [{ lvl: 18, cost: 50, cast: 1.5, dur: 20 }],
  desc: (r) => `Forces the enemy target to sleep for up to ${r.dur} sec. Any damage will awaken the target. Only one target can be forced to hibernate at a time. Only works on Beasts and Dragonkin.`,
  effect: ({ u, t, rd }) => {
    for (const o of G.units) { const h = o.getAura?.('hibernate'); if (h && h.caster === u && o !== t) o.removeAura(h); }
    t.addAura({ id: 'hibernate', name: 'Hibernate', icon: 'sleep', dur: rd.dur, debuff: true, flags: { sleep: true }, breakOnDamage: true }, u);
    if (t.threat) engage(t, u);
  },
});
defineAbility({
  id: 'cure_poison', name: 'Cure Poison', cls: D, icon: 'drop', school: 'nature', target: 'friend', range: 30, learn: 14,
  ranks: [{ lvl: 14, cost: 55 }],
  desc: () => 'Cures 1 poison effect on the target.',
  effect: ({ u, t }) => { const a = t.auras.find((x) => x.dispel === 'poison'); if (a) t.removeAura(a, 'dispel'); fx.rise(t, NATURE, 8); },
});
// forms
defineAbility({
  id: 'bear_form', name: 'Bear Form', cls: D, icon: 'bear', school: 'nature', target: 'self', isForm: true, anyForm: true, learn: 10,
  ranks: [{ lvl: 10, cost: (u) => (u.form === 'bear' ? 0 : Math.round((60 + 11 * (u.level - 1)) * 0.35)) }],
  desc: () => 'Shapeshift into a bear, increasing melee attack power, armor contribution from items and Health. Also protects the caster from Polymorph effects. The act of shapeshifting frees the caster of movement impairing effects.',
  effect: ({ u }) => setForm(u, u.form === 'bear' ? null : 'bear'),
});
defineAbility({
  id: 'cat_form', name: 'Cat Form', cls: D, icon: 'cat', school: 'nature', target: 'self', isForm: true, anyForm: true, learn: 20,
  ranks: [{ lvl: 20, cost: (u) => (u.form === 'cat' ? 0 : Math.round((60 + 11 * (u.level - 1)) * 0.35)) }],
  desc: () => 'Shapeshift into a cat, increasing melee attack power. Also protects the caster from Polymorph effects. The cat can only use cat abilities, and builds combo points. The act of shapeshifting frees the caster of movement impairing effects.',
  effect: ({ u }) => setForm(u, u.form === 'cat' ? null : 'cat'),
});
const bear = { form: 'bear', costType: 'rage', range: 'melee', melee: true };
defineAbility({
  id: 'maul', name: 'Maul', cls: D, icon: 'claw', onNextSwing: true, gcd: false, ...bear, learn: 10,
  ranks: [{ lvl: 10, cost: 15, bonus: 18 }, { lvl: 18, cost: 15, bonus: 27 }],
  desc: (r) => `Increases the druid's next attack by ${r.bonus} damage and causes a high amount of threat.`,
  effect: ({ u, t, ab, rd }) => weaponStrike(u, t, ab, { bonus: rd.bonus, threatMul: 1.75 }),
});
defineAbility({
  id: 'growl', name: 'Growl', cls: D, icon: 'bear', gcd: false, cd: 10, form: 'bear', costType: 'rage', range: 5, learn: 10,
  ranks: [{ lvl: 10, cost: 0 }],
  desc: () => 'Taunts the target to attack you, and increases threat to that of the highest. Lasts 3 sec.',
  effect: ({ u, t }) => taunt(t, u, 3),
});
defineAbility({
  id: 'demoralizing_roar', name: 'Demoralizing Roar', cls: D, icon: 'bear', target: 'none', form: 'bear', costType: 'rage', learn: 10,
  ranks: [{ lvl: 10, cost: 10, ap: 40 }],
  desc: (r) => `The druid roars, decreasing the melee attack power of nearby enemies by ${r.ap} for 30 sec.`,
  effect: ({ u, rd }) => {
    for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 10)) {
      e.addAura({ id: 'demoralizing_roar', name: 'Demoralizing Roar', icon: 'bear', dur: 30, debuff: true, group: 'demoralize', groupAny: true, mods: { dmgDone: -Math.min(0.25, rd.ap / (e.level * 12 + 60)) } }, u);
      engage(e, u);
      if (e.threat) e.threat.set(u, (e.threat.get(u) ?? 0) + 9 + u.level);
    }
    fx.novaAt(u, 10, 0xa04040);
  },
});
defineAbility({
  id: 'enrage', name: 'Enrage', cls: D, icon: 'drop', target: 'self', form: 'bear', costType: 'rage', cd: 60, gcd: false, learn: 12,
  ranks: [{ lvl: 12, cost: 0 }],
  desc: () => 'Generates 20 rage over 10 sec, but reduces base armor by 27% in Bear Form.',
  effect: ({ u }) => u.addAura({ id: 'enrage', name: 'Enrage', icon: 'drop', dur: 10, interval: 1, pct: { armor: -0.27 }, tick: (a) => { a.unit.addRage(2); a.unit.setInCombat(); } }, u),
});
defineAbility({
  id: 'bash', name: 'Bash', cls: D, icon: 'paw', ...bear, cd: 60, learn: 14,
  ranks: [{ lvl: 14, cost: 10, dur: 2 }],
  desc: (r) => `Stuns the target for ${r.dur} sec.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'bash', name: 'Bash', icon: 'paw', dur: rd.dur + (u.mods?.bashDur ?? 0), debuff: true, flags: { stun: true } }, u); engage(t, u); },
});
defineAbility({
  id: 'swipe', name: 'Swipe', cls: D, icon: 'claw', ...bear, learn: 16,
  ranks: [{ lvl: 16, cost: 20, dmg: 18 }],
  desc: (r) => `Swipe nearby enemies, inflicting ${r.dmg} damage. Affects up to 3 targets.`,
  effect: ({ u, t, ab, rd }) => { for (const e of aoeEnemies(u, t.pos.x, t.pos.z, 6, 3)) weaponStrike(u, e, ab, { flat: rd.dmg + u.stats.ap * 0.06, threatMul: 1.75 }); },
});
const cat = { form: 'cat', costType: 'energy', range: 'melee', melee: true, gcdOverride: 1.0 };
defineAbility({
  id: 'claw', name: 'Claw', cls: D, icon: 'claw', ...cat, learn: 20,
  ranks: [{ lvl: 20, cost: 45, bonus: 27 }],
  desc: (r) => `Claw the enemy, causing ${r.bonus} additional damage. Awards 1 combo point.`,
  effect: ({ u, t, ab, rd }) => { const r = weaponStrike(u, t, ab, { bonus: rd.bonus, refundOnMiss: true }); if (hit(r)) addCombo(u, t); },
});
defineAbility({
  id: 'rip', name: 'Rip', cls: D, icon: 'claw', ...cat, combo: true, learn: 20,
  ranks: [{ lvl: 20, cost: 30 }],
  desc: () => 'Finishing move that causes damage over 12 sec, increased by combo points: 1 point 42, 5 points 162.',
  effect: ({ u, t, ab }) => { const r = weaponStrike(u, t, ab, { flat: 0, noProcs: true }); if (!hit(r)) return false; dot(u, t, ab, { total: 42 + 30 * (u.comboPoints - 1) + u.stats.ap * 0.06 * u.comboPoints, dur: 12, interval: 2, school: 'physical' }); },
});
defineAbility({
  id: 'prowl', name: 'Prowl', cls: D, icon: 'cat', target: 'self', form: 'cat', costType: 'energy', gcd: false, cd: 10, keepStealth: true, learn: 20,
  ranks: [{ lvl: 20, cost: 0 }],
  usable: (u) => !u.inCombat || u.hasFlag('stealth'), usableMsg: "You can't do that while in combat.",
  desc: () => 'Allows the Druid to prowl around, but reduces movement speed by 40%. Lasts until cancelled.',
  effect: ({ u }) => { if (u.hasFlag('stealth')) { u.breakStealth(); return; } u.autoAttack = false; u.addAura({ id: 'prowl', name: 'Prowl', icon: 'cat', dur: Infinity, flags: { stealth: true } }, u); },
});
// talents
defineAbility({
  id: 'feral_charge', name: 'Feral Charge', cls: D, icon: 'bear', form: 'bear', costType: 'rage', range: 25, minRange: 8, cd: 15, gcd: false, talent: true, melee: true,
  ranks: [{ lvl: 1, cost: 5 }],
  desc: () => 'Causes you to charge an enemy, immobilizing and interrupting any spell being cast for 4 sec.',
  effect: ({ u, t }) => { engage(t, u); dash(u, t, 26, () => { t.addAura({ id: 'feral_charge', name: 'Feral Charge', icon: 'bear', dur: 4, debuff: true, flags: { root: true } }, u); if (t.cast) t.interruptCast(true, 4); u.autoAttack = true; }); },
});
defineAbility({
  id: 'insect_swarm', name: 'Insect Swarm', cls: D, icon: 'swirl', school: 'nature', range: 30, talent: true,
  ranks: [{ lvl: 1, cost: 45, total: 66 }],
  desc: (r) => `The enemy target is swarmed by insects, decreasing their chance to hit by 2% and causing ${r.total} Nature damage over 12 sec.`,
  effect: ({ u, t, ab, rd }) => { dot(u, t, ab, { total: rd.total, dur: 12, interval: 2, school: 'nature', mods: { hit: -2 } }); engage(t, u); },
});
defineAbility({
  id: 'natures_swiftness_druid', name: "Nature's Swiftness", cls: D, icon: 'leaf', school: 'nature', target: 'self', cd: 180, gcd: false, talent: true,
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'When activated, your next Nature spell becomes an instant cast spell.',
  effect: ({ u }) => u.addAura({ id: 'nature_swiftness', name: "Nature's Swiftness", icon: 'leaf', dur: Infinity }, u),
});
