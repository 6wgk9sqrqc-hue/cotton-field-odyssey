import { defineAbility, spellHit, dot, aoeEnemies, dealDamage, engage, projectile } from '../../engine/spells.js';
import { blink } from '../../engine/summons.js';
import * as fx from '../../engine/fx.js';
import { G, emit } from '../../state.js';

const M = 'mage';
const FIRE = 0xff7030, FROST = 0x80c8ff, ARCANE = 0xff90ff;

function chill(u, t, dur, slow = 0.4) {
  t.addAura({ id: 'chilled', name: 'Chilled', icon: 'snowflake', dur: dur + (u.mods?.chillDur ?? 0), debuff: true, mods: { speed: -(slow + (u.mods?.chillSlow ?? 0)) }, unique: true }, u);
}

defineAbility({
  id: 'fireball', name: 'Fireball', cls: M, icon: 'fireball', school: 'fire', range: 35,
  ranks: [
    { lvl: 1, cost: 30, cast: 1.5, min: 14, max: 22, dot: 2, dotDur: 4 }, { lvl: 6, cost: 45, cast: 2.0, min: 31, max: 45, dot: 3, dotDur: 6 },
    { lvl: 12, cost: 65, cast: 2.5, min: 53, max: 73, dot: 6, dotDur: 6 }, { lvl: 18, cost: 95, cast: 3.0, min: 84, max: 116, dot: 12, dotDur: 8 },
  ],
  desc: (r) => `Hurls a fiery ball that causes ${r.min} to ${r.max} Fire damage and an additional ${r.dot} Fire damage over ${r.dotDur} sec.`,
  effect: ({ u, t, ab, rd }) => projectile(u, t, { color: FIRE, size: 0.9, speed: 26, school: 'fire' }, () => {
    if (t.dead) return;
    if (spellHit(u, t, ab, rd.min, rd.max, { coef: Math.min(1, rd.cast / 3.5) })) dot(u, t, ab, { id: 'fireball_dot', total: rd.dot, dur: rd.dotDur, interval: 2, school: 'fire' });
    fx.at(t, FIRE, 20, 5);
  }),
});
defineAbility({
  id: 'frostbolt', name: 'Frostbolt', cls: M, icon: 'frostbolt', school: 'frost', range: 30, learn: 4,
  ranks: [
    { lvl: 4, cost: 25, cast: 1.5, min: 18, max: 20, slow: 5 }, { lvl: 8, cost: 35, cast: 1.8, min: 31, max: 35, slow: 6 },
    { lvl: 14, cost: 50, cast: 2.2, min: 51, max: 57, slow: 7 }, { lvl: 20, cost: 65, cast: 2.6, min: 74, max: 82, slow: 8 },
  ],
  desc: (r) => `Launches a bolt of frost at the enemy, causing ${r.min} to ${r.max} Frost damage and slowing movement speed by 40% for ${r.slow} sec.`,
  effect: ({ u, t, ab, rd }) => projectile(u, t, { color: FROST, size: 0.75, speed: 28, school: 'frost' }, () => {
    if (t.dead) return;
    if (spellHit(u, t, ab, rd.min, rd.max, { coef: Math.min(1, rd.cast / 3.5) * 0.95 })) chill(u, t, rd.slow);
    fx.at(t, FROST, 18, 4);
  }),
});
defineAbility({
  id: 'fire_blast', name: 'Fire Blast', cls: M, icon: 'flame', school: 'fire', range: 20, cd: 8, learn: 6,
  ranks: [{ lvl: 6, cost: 40, min: 24, max: 32 }, { lvl: 14, cost: 75, min: 57, max: 71 }],
  desc: (r) => `Blasts the enemy for ${r.min} to ${r.max} Fire damage.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: 0.43 }); fx.at(t, FIRE, 22, 5); },
});
defineAbility({
  id: 'arcane_missiles', name: 'Arcane Missiles', cls: M, icon: 'orb', school: 'arcane', range: 30, channel: 3, tickEvery: 1, learn: 8,
  ranks: [{ lvl: 8, cost: 85, per: 24, channel: 3 }, { lvl: 16, cost: 140, per: 36, channel: 4 }],
  desc: (r) => `Launches Arcane Missiles at the enemy, causing ${r.per} Arcane damage each second for ${r.channel} sec.`,
  onChannelStart: ({ u, t }) => engage(t, u),
  onTick: ({ u, t, ab, rd }) => projectile(u, t, { color: ARCANE, size: 0.5, speed: 34, school: 'arcane' }, () => { if (!t.dead) spellHit(u, t, ab, rd.per, rd.per, { coef: 0.24 }); }),
});
defineAbility({
  id: 'frost_armor', name: 'Frost Armor', cls: M, icon: 'armor', school: 'frost', target: 'self',
  ranks: [{ lvl: 1, cost: 60, armor: 30 }, { lvl: 10, cost: 120, armor: 110 }, { lvl: 20, cost: 200, armor: 200 }],
  desc: (r) => `Increases armor by ${r.armor}. If an enemy strikes the caster, they may have their movement slowed by 30% and the time between their attacks increased by 25% for 5 sec. Lasts 30 min.`,
  effect: ({ u, rd }) => {
    u.addAura({
      id: 'frost_armor', name: 'Frost Armor', icon: 'armor', dur: 1800, group: 'mage_armor', mods: { armor: rd.armor },
      onStruck: (a, src) => src.addAura({ id: 'frost_armor_slow', name: 'Frost Armor', icon: 'snowflake', dur: 5, debuff: true, mods: { speed: -0.3, atkSpeed: -0.25 } }, u),
    }, u);
    fx.rise(u, FROST, 14);
  },
});
defineAbility({
  id: 'arcane_intellect', name: 'Arcane Intellect', cls: M, icon: 'book', school: 'arcane', target: 'friend', range: 30,
  ranks: [{ lvl: 1, cost: 60, int: 2 }, { lvl: 14, cost: 135, int: 7 }],
  desc: (r) => `Increases the target's Intellect by ${r.int} for 30 min.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'arcane_intellect', name: 'Arcane Intellect', icon: 'book', dur: 1800, mods: { int: rd.int }, unique: true }, u); fx.rise(t, ARCANE, 10); },
});
function conjure(u, item, n) {
  u.addItem?.(item, n);
  emit('loot', { unit: u, item, count: n, conjured: true });
}
defineAbility({
  id: 'conjure_water', name: 'Conjure Water', cls: M, icon: 'drink', school: 'arcane', target: 'self', learn: 4,
  ranks: [{ lvl: 4, cost: 60, cast: 3, item: 'conjured_water', n: 2 }, { lvl: 10, cost: 105, cast: 3, item: 'conjured_fresh_water', n: 2 }, { lvl: 20, cost: 180, cast: 3, item: 'conjured_purified_water', n: 2 }],
  desc: (r) => `Conjures ${r.n} bottles of water, providing the mage and their allies with something to drink.`,
  effect: ({ u, rd }) => conjure(u, rd.item, rd.n + (u.level >= 10 ? 2 : 0)),
});
defineAbility({
  id: 'conjure_food', name: 'Conjure Food', cls: M, icon: 'bread', school: 'arcane', target: 'self', learn: 6,
  ranks: [{ lvl: 6, cost: 60, cast: 3, item: 'conjured_muffin', n: 2 }, { lvl: 12, cost: 105, cast: 3, item: 'conjured_bread', n: 2 }],
  desc: (r) => `Conjures ${r.n} muffins, providing the mage and their allies with something to eat.`,
  effect: ({ u, rd }) => conjure(u, rd.item, rd.n + (u.level >= 12 ? 2 : 0)),
});
defineAbility({
  id: 'polymorph', name: 'Polymorph', cls: M, icon: 'sheep', school: 'arcane', range: 30, creature: ['humanoid', 'beast', 'critter'], learn: 8,
  ranks: [{ lvl: 8, cost: 50, cast: 1.5, dur: 20 }],
  desc: (r) => `Transforms the enemy into a sheep, forcing it to wander around for up to ${r.dur} sec. While wandering, the sheep cannot attack or cast spells but will regenerate very quickly. Any damage will transform the target back. Only one target can be polymorphed at a time.`,
  effect: ({ u, t, rd }) => {
    for (const o of G.units) { const p = o.getAura?.('polymorph'); if (p && p.caster === u && o !== t) o.removeAura(p); }
    if (Math.random() < 0.04) { fx.at(t, 0x888888, 4); emit('combatText', { unit: t, text: 'Resist', kind: 'miss', src: u }); engage(t, u); return; }
    t.addAura({
      id: 'polymorph', name: 'Polymorph', icon: 'sheep', dur: rd.dur, debuff: true, flags: { incap: true, sheep: true }, breakOnDamage: true, interval: 1,
      tick: (a) => { a.unit.hp = Math.min(a.unit.maxHp, a.unit.hp + a.unit.maxHp * 0.1); },
    }, u);
    if (t.threat) engage(t, u);
    fx.at(t, ARCANE, 20);
  },
});
defineAbility({
  id: 'frost_nova', name: 'Frost Nova', cls: M, icon: 'snowflake', school: 'frost', target: 'none', cd: 25, learn: 10,
  ranks: [{ lvl: 10, cost: 55, min: 19, max: 22 }],
  desc: (r) => `Blasts enemies near the caster for ${r.min} to ${r.max} Frost damage and freezes them in place for up to 8 sec. Damage caused may interrupt the effect.`,
  effect: ({ u, ab, rd }) => {
    for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 10)) {
      if (spellHit(u, e, ab, rd.min, rd.max, { coef: 0.13 })) e.addAura({ id: 'frost_nova', name: 'Frost Nova', icon: 'snowflake', dur: 8, debuff: true, flags: { root: true }, damageCap: e.maxHp * 0.15 }, u);
    }
    fx.novaAt(u, 10, FROST);
  },
});
defineAbility({
  id: 'arcane_explosion', name: 'Arcane Explosion', cls: M, icon: 'burst', school: 'arcane', target: 'none', learn: 14,
  ranks: [{ lvl: 14, cost: 75, min: 32, max: 36 }],
  desc: (r) => `Causes an explosion of arcane magic around the caster, causing ${r.min} to ${r.max} Arcane damage to all enemies within 10 yards.`,
  effect: ({ u, ab, rd }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 10)) spellHit(u, e, ab, rd.min, rd.max, { coef: 0.14 }); fx.novaAt(u, 10, ARCANE); },
});
defineAbility({
  id: 'flamestrike', name: 'Flamestrike', cls: M, icon: 'flame', school: 'fire', range: 30, learn: 16,
  ranks: [{ lvl: 16, cost: 195, cast: 3, min: 55, max: 71, total: 48 }],
  desc: (r) => `Calls down a pillar of fire on the target area, burning all enemies within 8 yards for ${r.min} to ${r.max} Fire damage and an additional ${r.total} Fire damage over 8 sec.`,
  effect: ({ u, t, ab, rd }) => {
    const x = t.pos.x, z = t.pos.z;
    for (const e of aoeEnemies(u, x, z, 8)) if (spellHit(u, e, ab, rd.min, rd.max, { coef: 0.17 })) dot(u, e, ab, { id: 'flamestrike_dot', total: rd.total, dur: 8, interval: 2, school: 'fire' });
    fx.nova(x, t.y, z, 8, FIRE, 0.8);
    fx.burst({ x, y: t.y + 1, z }, FIRE, 40, 6, 0.8, 6);
  },
});
defineAbility({
  id: 'blink', name: 'Blink', cls: M, icon: 'swirl', school: 'arcane', target: 'self', cd: 15, gcd: true, learn: 20, ignoreControl: true,
  ranks: [{ lvl: 20, cost: 80 }],
  desc: () => 'Teleports the caster 20 yards forward, removing stun and root effects.',
  effect: ({ u }) => { u.removeAurasWhere((a) => a.flags?.stun || a.flags?.root); blink(u, 20); },
});
defineAbility({
  id: 'evocation', name: 'Evocation', cls: M, icon: 'swirl', school: 'arcane', target: 'self', channel: 8, tickEvery: 2, cd: 300, learn: 20,
  ranks: [{ lvl: 20, cost: 0 }],
  desc: () => 'While channeling this spell, you gain 15% of your total mana every 2 sec. Lasts 8 sec.',
  onTick: ({ u }) => { u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.15); fx.rise(u, ARCANE, 10); },
});
defineAbility({
  id: 'mana_shield', name: 'Mana Shield', cls: M, icon: 'orb', school: 'arcane', target: 'self', learn: 20,
  ranks: [{ lvl: 20, cost: 50, absorb: 120 }],
  desc: (r) => `Absorbs ${r.absorb} damage, draining 2 mana per damage absorbed. Lasts 1 min.`,
  effect: ({ u, rd }) => { const h = fx.shell(u, 0x8080ff, 0.18); u.addAura({ id: 'mana_shield', name: 'Mana Shield', icon: 'orb', dur: 60, absorb: rd.absorb, manaShield: true, onRemove: () => h.remove() }, u); },
});
defineAbility({
  id: 'fire_ward', name: 'Fire Ward', cls: M, icon: 'shield', school: 'fire', target: 'self', cd: 30, learn: 20,
  ranks: [{ lvl: 20, cost: 85, absorb: 165 }],
  desc: (r) => `Absorbs ${r.absorb} Fire damage. Lasts 30 sec.`,
  effect: ({ u, rd }) => u.addAura({ id: 'fire_ward', name: 'Fire Ward', icon: 'shield', dur: 30, absorb: rd.absorb, absorbSchool: 'fire' }, u),
});
// talents
defineAbility({
  id: 'presence_of_mind', name: 'Presence of Mind', cls: M, icon: 'hourglass', school: 'arcane', target: 'self', cd: 180, gcd: false, talent: true,
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'When activated, your next Mage spell with a casting time less than 10 sec becomes an instant cast spell.',
  effect: ({ u }) => u.addAura({ id: 'presence_of_mind', name: 'Presence of Mind', icon: 'hourglass', dur: Infinity, mods: { castSpeed: 1000 }, onSpellHit: (a) => { a.remaining = 0; } }, u),
});
defineAbility({
  id: 'pyroblast', name: 'Pyroblast', cls: M, icon: 'fireball', school: 'fire', range: 35, talent: true,
  ranks: [{ lvl: 1, cost: 125, cast: 6, min: 148, max: 195, total: 56 }],
  desc: (r) => `Hurls an immense fiery boulder that causes ${r.min} to ${r.max} Fire damage and an additional ${r.total} Fire damage over 12 sec.`,
  effect: ({ u, t, ab, rd }) => projectile(u, t, { color: FIRE, size: 1.4, speed: 22 }, () => { if (!t.dead && spellHit(u, t, ab, rd.min, rd.max, { coef: 1 })) dot(u, t, ab, { id: 'pyroblast_dot', total: rd.total, dur: 12, interval: 3, school: 'fire' }); fx.at(t, FIRE, 30, 6); }),
});
defineAbility({
  id: 'cold_snap', name: 'Ice Block', cls: M, icon: 'snowflake', school: 'frost', target: 'self', cd: 300, gcd: false, talent: true, ignoreControl: true,
  ranks: [{ lvl: 1, cost: 15 }],
  desc: () => 'You become encased in a block of ice, protecting you from all physical attacks and spells for 10 sec, but during that time you cannot attack, move or cast spells.',
  effect: ({ u }) => { u.removeAurasWhere((a) => a.debuff && (a.flags?.stun || a.flags?.root)); const h = fx.shell(u, FROST, 0.45); u.addAura({ id: 'ice_block', name: 'Ice Block', icon: 'snowflake', dur: 10, flags: { immune: true, stun: true }, onRemove: () => h.remove() }, u); },
});
void dealDamage;
