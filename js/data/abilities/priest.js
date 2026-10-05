import { defineAbility, spellHit, directHeal, dot, hot, aoeEnemies, aoeAllies, dealDamage, engage, heal, projectile } from '../../engine/spells.js';
import { fear } from '../../engine/summons.js';
import * as fx from '../../engine/fx.js';
import { G } from '../../state.js';

const P = 'priest';
const HOLY = 0xfff0a0, SHADOW = 0x9040d0;

defineAbility({
  id: 'smite', name: 'Smite', cls: P, icon: 'sun', school: 'holy', range: 30,
  ranks: [{ lvl: 1, cost: 20, cast: 1.5, min: 13, max: 17 }, { lvl: 6, cost: 30, cast: 2.0, min: 25, max: 31 }, { lvl: 14, cost: 60, cast: 2.5, min: 54, max: 62 }],
  desc: (r) => `Smite an enemy for ${r.min} to ${r.max} Holy damage.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: rd.cast / 3.5 }); fx.at(t, HOLY, 14, 4); },
});
defineAbility({
  id: 'lesser_heal', name: 'Lesser Heal', cls: P, icon: 'hand', school: 'holy', target: 'friend', range: 40, heal: true,
  ranks: [{ lvl: 1, cost: 30, cast: 1.5, min: 46, max: 56 }, { lvl: 4, cost: 45, cast: 2.0, min: 71, max: 85 }, { lvl: 10, cost: 75, cast: 2.5, min: 135, max: 157 }],
  desc: (r) => `Heal your target for ${r.min} to ${r.max}.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: rd.cast / 3.5 }); fx.rise(t, HOLY, 14); },
});
defineAbility({
  id: 'heal', name: 'Heal', cls: P, icon: 'hand', school: 'holy', target: 'friend', range: 40, heal: true, learn: 16,
  ranks: [{ lvl: 16, cost: 155, cast: 3, min: 295, max: 341 }],
  desc: (r) => `Heal your target for ${r.min} to ${r.max}.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: 0.86 }); fx.rise(t, HOLY, 22); },
});
defineAbility({
  id: 'flash_heal', name: 'Flash Heal', cls: P, icon: 'star', school: 'holy', target: 'friend', range: 40, heal: true, learn: 20,
  ranks: [{ lvl: 20, cost: 125, cast: 1.5, min: 193, max: 237 }],
  desc: (r) => `Heals a friendly target for ${r.min} to ${r.max}.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: 0.43 }); fx.rise(t, HOLY, 16); },
});
defineAbility({
  id: 'pw_fortitude', name: 'Power Word: Fortitude', cls: P, icon: 'heart', school: 'holy', target: 'friend', range: 30,
  ranks: [{ lvl: 1, cost: 60, sta: 3 }, { lvl: 12, cost: 155, sta: 8 }],
  desc: (r) => `Power infuses the target, increasing their Stamina by ${r.sta} for 30 min.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'pw_fortitude', name: 'Power Word: Fortitude', icon: 'heart', dur: 1800, mods: { sta: Math.round(rd.sta * (1 + (u.mods?.fortPct ?? 0))) }, unique: true }, u); fx.rise(t, HOLY, 10); },
});
defineAbility({
  id: 'shadow_word_pain', name: 'Shadow Word: Pain', cls: P, icon: 'skull', school: 'shadow', range: 30, learn: 4,
  ranks: [{ lvl: 4, cost: 25, total: 30 }, { lvl: 10, cost: 50, total: 66 }, { lvl: 18, cost: 95, total: 132 }],
  desc: (r) => `A word of darkness that causes ${r.total} Shadow damage over 18 sec.`,
  effect: ({ u, t, ab, rd }) => {
    const r = Math.random() * 100;
    if (r < 4) { fx.at(t, 0x888888, 4); return; }
    dot(u, t, ab, { total: rd.total, dur: 18 + (u.mods?.swpDur ?? 0), interval: 3, school: 'shadow', coef: 1 });
    engage(t, u);
    fx.at(t, SHADOW, 12);
  },
});
defineAbility({
  id: 'pw_shield', name: 'Power Word: Shield', cls: P, icon: 'shield', school: 'holy', target: 'friend', range: 40, learn: 6,
  ranks: [{ lvl: 6, cost: 45, absorb: 44 }, { lvl: 12, cost: 80, absorb: 88 }, { lvl: 18, cost: 130, absorb: 158 }],
  usable: (u, t) => !(t ?? u).hasAura?.('weakened_soul'), usableMsg: 'Target has Weakened Soul.',
  desc: (r) => `Draws on the soul of the party member to shield them, absorbing ${r.absorb} damage. Lasts 30 sec. While the shield holds, spellcasting will not be interrupted by damage. Once shielded, the target cannot be shielded again for 15 sec.`,
  effect: ({ u, t, rd }) => {
    const h = fx.shell(t, 0xffffc0, 0.22);
    t.addAura({ id: 'pw_shield', name: 'Power Word: Shield', icon: 'shield', dur: 30, absorb: Math.round(rd.absorb * (1 + (u.mods?.shieldPct ?? 0))), onRemove: () => h.remove() }, u);
    t.addAura({ id: 'weakened_soul', name: 'Weakened Soul', icon: 'shield', dur: 15, debuff: true, unique: true }, u);
  },
});
defineAbility({
  id: 'renew', name: 'Renew', cls: P, icon: 'leaf', school: 'holy', target: 'friend', range: 40, learn: 8, heal: true,
  ranks: [{ lvl: 8, cost: 30, total: 45 }, { lvl: 14, cost: 65, total: 100 }, { lvl: 20, cost: 105, total: 175 }],
  desc: (r) => `Heals the target of ${r.total} damage over 15 sec.`,
  effect: ({ u, t, ab, rd }) => { hot(u, t, ab, { total: rd.total * (1 + (u.mods?.renewPct ?? 0)), dur: 15, interval: 3, coef: 1 }); fx.rise(t, HOLY, 10); },
});
defineAbility({
  id: 'fade', name: 'Fade', cls: P, icon: 'ghost', school: 'shadow', target: 'self', cd: 30, learn: 8,
  ranks: [{ lvl: 8, cost: 45, threat: 55 }, { lvl: 16, cost: 70, threat: 155 }],
  desc: (r) => `Fade out, temporarily reducing all your threat by ${r.threat} for 10 sec.`,
  effect: ({ u, rd }) => {
    const mobs = G.units.filter((m) => m.threat?.has(u));
    for (const m of mobs) m.threat.set(u, Math.max(0, m.threat.get(u) - rd.threat));
    u.addAura({ id: 'fade', name: 'Fade', icon: 'ghost', dur: 10, onRemove: () => { for (const m of mobs) if (m.threat?.has(u)) m.threat.set(u, m.threat.get(u) + rd.threat); } }, u);
  },
});
defineAbility({
  id: 'mind_blast', name: 'Mind Blast', cls: P, icon: 'eye', school: 'shadow', range: 30, cd: 8, learn: 10,
  ranks: [{ lvl: 10, cost: 50, cast: 1.5, min: 42, max: 46 }, { lvl: 16, cost: 80, cast: 1.5, min: 76, max: 83 }],
  desc: (r) => `Blasts the target for ${r.min} to ${r.max} Shadow damage, but causes a high amount of threat.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: 0.43, threatMul: 2 }); fx.at(t, SHADOW, 18, 4); },
});
defineAbility({
  id: 'inner_fire', name: 'Inner Fire', cls: P, icon: 'flame', school: 'holy', target: 'self', learn: 12,
  ranks: [{ lvl: 12, cost: 20, armor: 315 }, { lvl: 20, cost: 45, armor: 480 }],
  desc: (r) => `A burst of Holy energy fills the caster, increasing armor by ${r.armor}. Each melee or ranged damage hit against the priest removes one charge. Lasts 10 min or 20 charges.`,
  effect: ({ u, rd }) => { u.addAura({ id: 'inner_fire', name: 'Inner Fire', icon: 'flame', dur: 600, charges: 20, mods: { armor: rd.armor }, onStruck: (a) => { a.charges--; } }, u); fx.rise(u, 0xffe080, 14); },
});
defineAbility({
  id: 'psychic_scream', name: 'Psychic Scream', cls: P, icon: 'fear', school: 'shadow', target: 'none', cd: 30, learn: 14,
  ranks: [{ lvl: 14, cost: 100, dur: 8 }],
  desc: (r) => `The caster lets out a psychic scream, causing up to 2 enemies within 8 yards to flee for ${r.dur} sec. Damage caused may interrupt the effect.`,
  effect: ({ u, rd }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 8, 2)) fear(u, e, rd.dur); fx.novaAt(u, 8, SHADOW); },
});
defineAbility({
  id: 'dispel_magic', name: 'Dispel Magic', cls: P, icon: 'swirl', school: 'holy', target: 'any', range: 30, learn: 18,
  ranks: [{ lvl: 18, cost: 85 }],
  desc: () => 'Dispels magic on the target, removing 1 harmful spell from a friend or 1 beneficial spell from an enemy.',
  effect: ({ u, t }) => {
    const hostile = t.faction === 'hostile' || t.faction === 'neutral';
    const a = t.auras.find((x) => (hostile ? !x.debuff && x.dispel !== null && !x.hidden && x.caster === t : x.debuff && x.dispel === 'magic'));
    if (a) t.removeAura(a, 'dispel');
    fx.at(t, 0xffffff, 10);
  },
});
defineAbility({
  id: 'holy_fire', name: 'Holy Fire', cls: P, icon: 'flame', school: 'holy', range: 30, cd: 10, learn: 20,
  ranks: [{ lvl: 20, cost: 85, cast: 3.5, min: 78, max: 98, total: 30 }],
  desc: (r) => `Consumes the enemy in Holy flames that cause ${r.min} to ${r.max} Holy damage and an additional ${r.total} Holy damage over 10 sec.`,
  effect: ({ u, t, ab, rd }) => { if (spellHit(u, t, ab, rd.min, rd.max, { coef: 0.8 })) dot(u, t, ab, { id: 'holy_fire_dot', total: rd.total, dur: 10, interval: 2, school: 'holy' }); fx.at(t, 0xffc040, 24, 5); },
});
// talents
defineAbility({
  id: 'inner_focus', name: 'Inner Focus', cls: P, icon: 'eye', school: 'holy', target: 'self', cd: 180, gcd: false, talent: true,
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'When activated, reduces the mana cost of your next spell by 100% and increases its critical effect chance by 25%.',
  effect: ({ u }) => u.addAura({ id: 'inner_focus', name: 'Inner Focus', icon: 'eye', dur: Infinity, mods: { scrit: 25 } }, u),
});
defineAbility({
  id: 'mind_flay', name: 'Mind Flay', cls: P, icon: 'eye', school: 'shadow', range: 20, channel: 3, tickEvery: 1, talent: true,
  ranks: [{ lvl: 1, cost: 45, total: 75 }],
  desc: (r) => `Assault the target's mind with Shadow energy, causing ${r.total} damage over 3 sec and slowing their movement speed by 50%.`,
  onChannelStart: ({ u, t }) => { engage(t, u); t.addAura({ id: 'mind_flay', name: 'Mind Flay', icon: 'eye', dur: 3, debuff: true, mods: { speed: -0.5 } }, u); },
  onTick: ({ u, t, ab, rd }) => { if (!t.dead) { dealDamage(u, t, rd.total / 3, { school: 'shadow', abilityName: ab.name, ability: ab.id }); fx.at(t, SHADOW, 6); } },
});
defineAbility({
  id: 'holy_nova', name: 'Holy Nova', cls: P, icon: 'sun', school: 'holy', target: 'none', talent: true,
  ranks: [{ lvl: 1, cost: 185, dmg: [28, 32], heal: [52, 60] }],
  desc: (r) => `Causes an explosion of holy light around the caster, causing ${r.dmg[0]} to ${r.dmg[1]} Holy damage to all enemy targets within 10 yards and healing all party members within 10 yards for ${r.heal[0]} to ${r.heal[1]}. These effects cause no threat.`,
  effect: ({ u, ab, rd }) => {
    for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 10)) spellHit(u, e, ab, rd.dmg[0], rd.dmg[1], { coef: 0.1, threatMul: 0 });
    for (const a of aoeAllies(u, u.pos.x, u.pos.z, 10)) heal(u, a, rd.heal[0] + Math.random() * (rd.heal[1] - rd.heal[0]), { noThreat: true, abilityName: ab.name });
    fx.novaAt(u, 10, HOLY);
  },
});
defineAbility({
  id: 'silence', name: 'Silence', cls: P, icon: 'skull', school: 'shadow', range: 20, cd: 45, talent: true, gcd: false,
  ranks: [{ lvl: 1, cost: 60 }],
  desc: () => 'Silences the target, preventing them from casting spells for 5 sec.',
  effect: ({ u, t }) => { t.addAura({ id: 'silence', name: 'Silence', icon: 'skull', dur: 5, debuff: true, flags: { silence: true } }, u); engage(t, u); },
});
void projectile;
