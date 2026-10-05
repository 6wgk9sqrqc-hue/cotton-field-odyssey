import { defineAbility, spellHit, dot, aoeEnemies, dealDamage, engage, heal, projectile } from '../../engine/spells.js';
import { summonDemon, fear } from '../../engine/summons.js';
import * as fx from '../../engine/fx.js';
import { G, emit } from '../../state.js';

const L = 'warlock';
const SHADOW = 0x9040d0, FIRE = 0xff7030, FEL = 0x60ff40;

defineAbility({
  id: 'shadow_bolt', name: 'Shadow Bolt', cls: L, icon: 'skull', school: 'shadow', range: 30,
  ranks: [
    { lvl: 1, cost: 25, cast: 1.7, min: 13, max: 18 }, { lvl: 6, cost: 40, cast: 2.2, min: 26, max: 32 },
    { lvl: 12, cost: 70, cast: 2.8, min: 52, max: 61 }, { lvl: 20, cost: 110, cast: 3.0, min: 92, max: 104 },
  ],
  desc: (r) => `Sends a shadowy bolt at the enemy, causing ${r.min} to ${r.max} Shadow damage.`,
  effect: ({ u, t, ab, rd }) => projectile(u, t, { color: SHADOW, size: 0.8, speed: 24, school: 'shadow' }, () => {
    if (t.dead) return;
    spellHit(u, t, ab, rd.min, rd.max, { coef: Math.min(0.86, rd.cast / 3.5) });
    fx.at(t, SHADOW, 18, 4);
  }),
});
defineAbility({
  id: 'immolate', name: 'Immolate', cls: L, icon: 'flame', school: 'fire', range: 30, learn: 4,
  ranks: [{ lvl: 4, cost: 25, cast: 2, dmg: 11, total: 20 }, { lvl: 10, cost: 45, cast: 2, dmg: 24, total: 40 }, { lvl: 20, cost: 90, cast: 2, dmg: 53, total: 90 }],
  desc: (r) => `Burns the enemy for ${r.dmg} Fire damage and then an additional ${r.total} Fire damage over 15 sec.`,
  effect: ({ u, t, ab, rd }) => { if (spellHit(u, t, ab, rd.dmg, rd.dmg, { coef: 0.2 })) dot(u, t, ab, { total: rd.total, dur: 15, interval: 3, school: 'fire', coef: 0.65 }); fx.at(t, FIRE, 16, 3); },
});
defineAbility({
  id: 'corruption', name: 'Corruption', cls: L, icon: 'skull', school: 'shadow', range: 30, learn: 4,
  ranks: [{ lvl: 4, cost: 35, cast: 2, total: 40, dur: 12 }, { lvl: 14, cost: 55, cast: 2, total: 90, dur: 15 }],
  desc: (r) => `Corrupts the target, causing ${r.total} Shadow damage over ${r.dur} sec.`,
  effect: ({ u, t, ab, rd }) => { dot(u, t, ab, { total: rd.total, dur: rd.dur, interval: 3, school: 'shadow', coef: 0.8 }); engage(t, u); fx.at(t, SHADOW, 12); },
});
defineAbility({
  id: 'curse_weakness', name: 'Curse of Weakness', cls: L, icon: 'skull', school: 'shadow', range: 30, learn: 4,
  ranks: [{ lvl: 4, cost: 20, pct: 0.08 }, { lvl: 12, cost: 35, pct: 0.12 }],
  desc: (r) => `Target's melee attack power is reduced, lowering its damage by ${Math.round(r.pct * 100)}% for 2 min. Only one Curse per Warlock can be active on any one target.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'curse_weakness', name: 'Curse of Weakness', icon: 'skull', dur: 120, debuff: true, dispel: 'curse', group: 'curse', mods: { dmgDone: -rd.pct } }, u); engage(t, u); fx.at(t, SHADOW, 8); },
});
defineAbility({
  id: 'curse_agony', name: 'Curse of Agony', cls: L, icon: 'skull', school: 'shadow', range: 30, learn: 8,
  ranks: [{ lvl: 8, cost: 25, total: 84 }, { lvl: 18, cost: 50, total: 180 }],
  desc: (r) => `Curses the target with agony, causing ${r.total} Shadow damage over 24 sec. This damage is dealt slowly at first, and builds up as the Curse reaches its full duration.`,
  effect: ({ u, t, ab, rd }) => {
    dot(u, t, ab, { total: rd.total, dur: 24, interval: 2, school: 'shadow', dispel: 'curse', group: 'curse', coef: 1.2, ramp: (a) => { const n = 12 - Math.round(a.remaining / 2); return n <= 4 ? 0.5 : n <= 8 ? 1 : 1.5; } });
    engage(t, u); fx.at(t, SHADOW, 8);
  },
});
defineAbility({
  id: 'life_tap', name: 'Life Tap', cls: L, icon: 'drop', school: 'shadow', target: 'self', learn: 6, costType: 'health',
  ranks: [{ lvl: 6, cost: 30, mana: 30 }, { lvl: 16, cost: 75, mana: 75 }],
  desc: (r) => `Converts ${r.cost} health into ${r.mana} mana.`,
  effect: ({ u, rd }) => { u.mana = Math.min(u.maxMana, u.mana + rd.mana * (1 + (u.mods?.lifeTapPct ?? 0))); fx.rise(u, SHADOW, 10); },
});
defineAbility({
  id: 'demon_skin', name: 'Demon Skin', cls: L, icon: 'demon', school: 'shadow', target: 'self',
  ranks: [{ lvl: 1, cost: 50, armor: 30, hp5: 2 }, { lvl: 10, cost: 110, armor: 90, hp5: 3 }],
  desc: (r) => `Protects the caster, increasing armor by ${r.armor} and health regeneration by ${r.hp5} every 5 sec. Lasts 30 min.`,
  effect: ({ u, rd }) => { u.addAura({ id: 'demon_skin', name: 'Demon Skin', icon: 'demon', dur: 1800, group: 'demon_armor', mods: { armor: Math.round(rd.armor * (1 + (u.mods?.demonSkinPct ?? 0))), hp5: rd.hp5 } }, u); fx.rise(u, FEL, 12); },
});
defineAbility({
  id: 'demon_armor', name: 'Demon Armor', cls: L, icon: 'demon', school: 'shadow', target: 'self', learn: 20,
  ranks: [{ lvl: 20, cost: 300, armor: 210, hp5: 3 }],
  desc: (r) => `Protects the caster, increasing armor by ${r.armor}, Shadow resistance by 3 and health regeneration by ${r.hp5} every 5 sec. Lasts 30 min.`,
  effect: ({ u, rd }) => { u.addAura({ id: 'demon_armor', name: 'Demon Armor', icon: 'demon', dur: 1800, group: 'demon_armor', mods: { armor: rd.armor, hp5: rd.hp5, res: { shadow: 3 } } }, u); fx.rise(u, FEL, 12); },
});
defineAbility({
  id: 'fear', name: 'Fear', cls: L, icon: 'fear', school: 'shadow', range: 20, learn: 8,
  ranks: [{ lvl: 8, cost: 40, cast: 1.5, dur: 10 }],
  desc: (r) => `Strikes fear in the enemy, causing it to run in fear for up to ${r.dur} sec. Damage caused may interrupt the effect. Only 1 target can be feared at a time.`,
  effect: ({ u, t, rd }) => {
    for (const o of G.units) { const f = o.getAura?.('fear'); if (f && f.caster === u && o !== t) o.removeAura(f); }
    if (Math.random() < 0.05) { emit('combatText', { unit: t, text: 'Resist', kind: 'miss', src: u }); engage(t, u); return; }
    fear(u, t, rd.dur);
    engage(t, u);
  },
});
defineAbility({
  id: 'drain_soul', name: 'Drain Soul', cls: L, icon: 'shard', school: 'shadow', range: 30, channel: 15, tickEvery: 3, learn: 10,
  ranks: [{ lvl: 10, cost: 55, total: 55 }],
  desc: (r) => `Drains the soul of the target, causing ${r.total} Shadow damage over 15 sec. If the target dies while being drained, the caster gains a Soul Shard.`,
  onChannelStart: ({ u, t }) => { engage(t, u); t.addAura({ id: 'drain_soul', name: 'Drain Soul', icon: 'shard', dur: 15, debuff: true, soulDrain: u, onRemove: (a, reason) => { if (reason === 'death') { u.addItem?.('soul_shard', 1); emit('loot', { unit: u, item: 'soul_shard', count: 1 }); } } }, u); },
  onTick: ({ u, t, ab, rd }) => { if (!t.dead) { dealDamage(u, t, rd.total / 5, { school: 'shadow', abilityName: ab.name, ability: ab.id }); fx.at(t, SHADOW, 6); } },
  onChannelEnd: ({ t }) => { const a = t?.getAura?.('drain_soul'); if (a && !t.dead) t.removeAura(a, 'expired'); },
});
defineAbility({
  id: 'drain_life', name: 'Drain Life', cls: L, icon: 'drop', school: 'shadow', range: 20, channel: 5, tickEvery: 1, learn: 14,
  ranks: [{ lvl: 14, cost: 55, per: 10 }],
  desc: (r) => `Transfers ${r.per} health every second from the target to the caster. Lasts 5 sec.`,
  onChannelStart: ({ u, t }) => engage(t, u),
  onTick: ({ u, t, ab, rd }) => { if (!t.dead) { const d = dealDamage(u, t, rd.per + (u.stats.sp ?? 0) * 0.1, { school: 'shadow', abilityName: ab.name, ability: ab.id }); heal(u, u, d, { periodic: true, abilityName: ab.name, noThreat: true }); fx.at(t, 0xff4060, 5); } },
});
defineAbility({
  id: 'searing_pain', name: 'Searing Pain', cls: L, icon: 'flame', school: 'fire', range: 30, learn: 18,
  ranks: [{ lvl: 18, cost: 45, cast: 1.5, min: 38, max: 47 }],
  desc: (r) => `Inflict searing pain on the enemy target, causing ${r.min} to ${r.max} Fire damage. Causes a high amount of threat.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: 0.43, threatMul: 2 }); fx.at(t, FIRE, 16, 4); },
});
defineAbility({
  id: 'rain_of_fire', name: 'Rain of Fire', cls: L, icon: 'flame', school: 'fire', range: 30, channel: 8, tickEvery: 2, learn: 20,
  ranks: [{ lvl: 20, cost: 185, per: 42 }],
  desc: (r) => `Calls down a fiery rain to burn enemies in the area of effect for ${r.per} Fire damage every 2 sec. Lasts 8 sec.`,
  onChannelStart: ({ u, t }) => { u.cast.area = { x: t.pos.x, z: t.pos.z, y: t.y }; },
  onTick: ({ u, ab, rd }) => {
    const ar = u.cast?.area; if (!ar) return;
    for (const e of aoeEnemies(u, ar.x, ar.z, 8)) dealDamage(u, e, rd.per, { school: 'fire', abilityName: ab.name, ability: ab.id });
    fx.burst({ x: ar.x, y: ar.y + 6, z: ar.z }, FIRE, 40, 6, 0.9, -8);
    fx.nova(ar.x, ar.y, ar.z, 8, FIRE, 0.6);
  },
});
defineAbility({
  id: 'create_healthstone', name: 'Create Healthstone (Minor)', cls: L, icon: 'stone', school: 'shadow', target: 'self', reagent: 'soul_shard', learn: 10,
  ranks: [{ lvl: 10, cost: 95, cast: 3, item: 'healthstone_minor' }, { lvl: 22, cost: 240, cast: 3, item: 'healthstone_lesser' }],
  usable: (u) => !u.hasItem?.('healthstone_minor') && !u.hasItem?.('healthstone_lesser'), usableMsg: 'You already have a Healthstone.',
  desc: () => 'Creates a Minor Healthstone that can be used to instantly restore 100 health. Requires a Soul Shard.',
  effect: ({ u, rd }) => { u.addItem?.(rd.item, 1); emit('loot', { unit: u, item: rd.item, count: 1 }); },
});
// demons
const demon = (id, name, lvl, kind, reagent) => defineAbility({
  id, name, cls: L, icon: kind === 'imp' ? 'imp' : kind === 'voidwalker' ? 'void' : 'kiss', school: 'shadow', target: 'self', learn: lvl, reagent,
  ranks: [{ lvl, cost: Math.round(40 + lvl * 8), cast: 10 }],
  desc: () => ({
    imp: 'Summons an Imp under the command of the Warlock. It hurls Firebolts and grants Blood Pact (+Stamina) to the party.',
    voidwalker: 'Summons a Voidwalker under the command of the Warlock. It soaks up damage and taunts with Torment. Requires a Soul Shard.',
    succubus: 'Summons a Succubus under the command of the Warlock. She lashes enemies and can Seduce humanoids. Requires a Soul Shard.',
  })[kind],
  effect: ({ u }) => summonDemon(u, kind),
});
demon('summon_imp', 'Summon Imp', 1, 'imp');
demon('summon_voidwalker', 'Summon Voidwalker', 10, 'voidwalker', 'soul_shard');
demon('summon_succubus', 'Summon Succubus', 20, 'succubus', 'soul_shard');
defineAbility({
  id: 'health_funnel', name: 'Health Funnel', cls: L, icon: 'drop', school: 'shadow', target: 'pet', range: 20, channel: 10, tickEvery: 1, learn: 12, needsPet: true, costType: 'health',
  ranks: [{ lvl: 12, cost: 12, per: 12 }],
  desc: (r) => `Gives ${r.per} health to the caster's pet every second for 10 sec as long as the caster channels. Costs health each second.`,
  onTick: ({ u, rd }) => { if (u.pet && !u.pet.dead && u.hp > rd.per + 1) { u.hp -= rd.per * 0.8; heal(u, u.pet, rd.per, { periodic: true, abilityName: 'Health Funnel' }); fx.rise(u.pet, FEL, 4); } },
});
// talents
defineAbility({
  id: 'siphon_life', name: 'Siphon Life', cls: L, icon: 'drop', school: 'shadow', range: 30, talent: true,
  ranks: [{ lvl: 1, cost: 65, total: 150 }],
  desc: (r) => `Transfers ${r.total / 10} health from the target to the caster every 3 sec. Lasts 30 sec.`,
  effect: ({ u, t, ab, rd }) => { dot(u, t, ab, { total: rd.total, dur: 30, interval: 3, school: 'shadow', onTick: (a) => heal(u, u, rd.total / 10, { periodic: true, abilityName: ab.name, noThreat: true }) }); engage(t, u); },
});
defineAbility({
  id: 'fel_domination', name: 'Fel Domination', cls: L, icon: 'demon', school: 'shadow', target: 'self', cd: 900, gcd: false, talent: true,
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'Your next Imp, Voidwalker or Succubus summon cast time is reduced by 5.5 sec and mana cost by 50%.',
  effect: ({ u }) => u.addAura({ id: 'fel_domination', name: 'Fel Domination', icon: 'demon', dur: 15 }, u),
});
defineAbility({
  id: 'shadowburn', name: 'Shadowburn', cls: L, icon: 'skull', school: 'shadow', range: 20, cd: 15, talent: true, reagent: 'soul_shard',
  ranks: [{ lvl: 1, cost: 105, min: 91, max: 104 }],
  desc: (r) => `Instantly blasts the target for ${r.min} to ${r.max} Shadow damage. If the target dies within 5 sec, the caster gains a Soul Shard. Requires a Soul Shard.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: 0.43 }); fx.at(t, SHADOW, 22, 5); },
});
