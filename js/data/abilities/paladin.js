import { defineAbility, spellHit, directHeal, aoeAllies, aoeEnemies, dealDamage, engage, heal } from '../../engine/spells.js';
import * as fx from '../../engine/fx.js';

const P = 'paladin';
const HOLY = 0xffe680;

// Seals: one active at a time; Judgement releases the active seal on the target.
function sealAura(u, id, name, extra) {
  return u.addAura({ id, name, icon: id === 'seal_righteousness' ? 'sun' : 'crown', dur: 30, group: 'seal', ...extra }, u);
}
defineAbility({
  id: 'seal_righteousness', name: 'Seal of Righteousness', cls: P, icon: 'sun', school: 'holy', target: 'self',
  ranks: [{ lvl: 1, cost: 20, dmg: 6, judge: [15, 16] }, { lvl: 10, cost: 40, dmg: 13, judge: [25, 28] }, { lvl: 18, cost: 60, dmg: 20, judge: [39, 43] }],
  desc: (r) => `Fills the Paladin with holy spirit for 30 sec. Each melee attack deals about ${r.dmg} additional Holy damage, scaled by weapon speed. Unleashing this Seal's energy with Judgement deals ${r.judge[0]} to ${r.judge[1]} Holy damage.`,
  effect: ({ u, rd }) => {
    sealAura(u, 'seal_righteousness', 'Seal of Righteousness', {
      judge: (t) => spellHit(u, t, { id: 'judgement', name: 'Judgement of Righteousness', school: 'holy', coef: 0.5 }, rd.judge[0], rd.judge[1]),
      onHit: (a, t, outcome, dmg, hand) => {
        if (hand !== 'mh' || t.dead) return;
        const w = u.weapon('mh');
        dealDamage(u, t, rd.dmg * (w.speed / 2.5) * (1 + (u.mods?.sealPct ?? 0)), { school: 'holy', abilityName: 'Seal of Righteousness' });
      },
    });
    fx.rise(u, HOLY, 10);
  },
});
defineAbility({
  id: 'seal_crusader', name: 'Seal of the Crusader', cls: P, icon: 'crown', school: 'holy', target: 'self', learn: 6,
  ranks: [{ lvl: 6, cost: 25, ap: 36, taken: 0.1 }, { lvl: 12, cost: 40, ap: 70, taken: 0.15 }],
  desc: (r) => `Fills the Paladin with the spirit of a crusader for 30 sec, increasing melee attack power by ${r.ap} and attack speed by 40%, but each hit deals less damage. Judgement causes the target to take ${Math.round(r.taken * 100)}% more Holy damage for 10 sec.`,
  effect: ({ u, rd }) => {
    sealAura(u, 'seal_crusader', 'Seal of the Crusader', {
      mods: { ap: rd.ap, atkSpeed: 0.4, dmgDone: -0.3 },
      judge: (t) => t.addAura({ id: 'judgement_crusader', name: 'Judgement of the Crusader', icon: 'crown', dur: 10, debuff: true, mods: { schoolTaken: { holy: rd.taken } } }, u),
    });
    fx.rise(u, HOLY, 10);
  },
});
defineAbility({
  id: 'judgement', name: 'Judgement', cls: P, icon: 'hammer', school: 'holy', cd: 10, range: 10, learn: 4,
  ranks: [{ lvl: 4, cost: (u) => Math.round((60 + 11 * (u.level - 1)) * 0.06) + 5 }],
  usable: (u) => u.auras.some((a) => a.group === 'seal'), usableMsg: 'You must have an active Seal.',
  desc: () => "Unleashes the energy of your active Seal upon an enemy, consuming the Seal.",
  effect: ({ u, t }) => {
    const seal = u.auras.find((a) => a.group === 'seal');
    if (!seal) return;
    seal.judge?.(t);
    u.removeAura(seal, 'judged');
    engage(t, u);
    fx.at(t, HOLY, 16, 4);
  },
});
function paladinAura(u, id, name, icon, mods, extra = {}) {
  // party aura: re-applied to allies in range every couple of seconds
  u.addAura({
    id: id + '_src', name, icon, dur: Infinity, group: 'paladin_aura', hidden: false, mods, ...extra, interval: 2,
    tick: (a) => {
      for (const ally of aoeAllies(u, u.pos.x, u.pos.z, 30)) {
        if (ally === u) continue;
        ally.addAura({ id, name, icon, dur: 3, mods, onStruck: extra.onStruck, unique: true }, u);
      }
    },
  }, u);
}
defineAbility({
  id: 'devotion_aura', name: 'Devotion Aura', cls: P, icon: 'shield', school: 'holy', target: 'self', gcd: true,
  ranks: [{ lvl: 1, cost: 0, armor: 55 }, { lvl: 10, cost: 0, armor: 105 }, { lvl: 20, cost: 0, armor: 180 }],
  desc: (r) => `Gives all party members within 30 yards ${r.armor} additional armor. Only one Aura per Paladin can be active at a time.`,
  effect: ({ u, rd }) => { paladinAura(u, 'devotion_aura', 'Devotion Aura', 'shield', { armor: Math.round(rd.armor * (1 + (u.mods?.devotionPct ?? 0))) }); fx.novaAt(u, 6, HOLY); },
});
defineAbility({
  id: 'retribution_aura', name: 'Retribution Aura', cls: P, icon: 'sun', school: 'holy', target: 'self', learn: 16,
  ranks: [{ lvl: 16, cost: 0, dmg: 5 }],
  desc: (r) => `Causes ${r.dmg} Holy damage to any enemy that strikes a party member within 30 yards.`,
  effect: ({ u, rd }) => {
    paladinAura(u, 'retribution_aura', 'Retribution Aura', 'sun', {}, { onStruck: (a, src) => dealDamage(u, src, rd.dmg, { school: 'holy', abilityName: 'Retribution Aura' }) });
    fx.novaAt(u, 6, HOLY);
  },
});
defineAbility({
  id: 'blessing_might', name: 'Blessing of Might', cls: P, icon: 'fist', school: 'holy', target: 'friend', range: 30, learn: 4,
  ranks: [{ lvl: 4, cost: 20, ap: 20 }, { lvl: 12, cost: 30, ap: 35 }],
  desc: (r) => `Places a Blessing on the friendly target, increasing melee attack power by ${r.ap} for 5 min. One Blessing per Paladin on any target.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'blessing_might', name: 'Blessing of Might', icon: 'fist', dur: 300, group: 'blessing', mods: { ap: Math.round(rd.ap * (1 + (u.mods?.blessingPct ?? 0))) } }, u); fx.rise(t, HOLY); },
});
defineAbility({
  id: 'blessing_wisdom', name: 'Blessing of Wisdom', cls: P, icon: 'book', school: 'holy', target: 'friend', range: 30, learn: 14,
  ranks: [{ lvl: 14, cost: 30, mp5: 10 }],
  desc: (r) => `Places a Blessing on the friendly target, restoring ${r.mp5} mana every 5 seconds for 5 min.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'blessing_wisdom', name: 'Blessing of Wisdom', icon: 'book', dur: 300, group: 'blessing', mods: { mp5: rd.mp5 } }, u); fx.rise(t, HOLY); },
});
defineAbility({
  id: 'holy_light', name: 'Holy Light', cls: P, icon: 'hand', school: 'holy', target: 'friend', range: 40, heal: true,
  ranks: [{ lvl: 1, cost: 35, cast: 2.5, min: 42, max: 51 }, { lvl: 6, cost: 60, cast: 2.5, min: 81, max: 96 }, { lvl: 14, cost: 110, cast: 2.5, min: 167, max: 196 }],
  desc: (r) => `Heals a friendly target for ${r.min} to ${r.max}.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: 0.71 }); fx.rise(t, HOLY, 18); },
});
defineAbility({
  id: 'flash_of_light', name: 'Flash of Light', cls: P, icon: 'hand', school: 'holy', target: 'friend', range: 40, heal: true, learn: 20,
  ranks: [{ lvl: 20, cost: 35, cast: 1.5, min: 67, max: 77 }],
  desc: (r) => `Heals a friendly target for ${r.min} to ${r.max}.`,
  effect: ({ u, t, ab, rd }) => { directHeal(u, t, ab, rd.min, rd.max, { coef: 0.43 }); fx.rise(t, HOLY, 12); },
});
function forbearance(u, t) {
  if (t.hasAura('forbearance')) return false;
  t.addAura({ id: 'forbearance', name: 'Forbearance', icon: 'hand', dur: 60, debuff: true, unique: true }, u);
  return true;
}
defineAbility({
  id: 'divine_protection', name: 'Divine Protection', cls: P, icon: 'shield', school: 'holy', target: 'self', cd: 300, learn: 6,
  ranks: [{ lvl: 6, cost: 15, dur: 6 }, { lvl: 18, cost: 35, dur: 8 }],
  usable: (u) => !u.hasAura('forbearance'), usableMsg: 'You cannot be protected again so soon (Forbearance).',
  desc: (r) => `Protects the Paladin from all damage for ${r.dur} sec. Causes Forbearance for 1 min.`,
  effect: ({ u, rd }) => {
    forbearance(u, u);
    const h = fx.shell(u, 0xffe090, 0.3);
    u.addAura({ id: 'divine_protection', name: 'Divine Protection', icon: 'shield', dur: rd.dur, flags: { immune: true }, onRemove: () => h.remove() }, u);
  },
});
defineAbility({
  id: 'blessing_protection', name: 'Blessing of Protection', cls: P, icon: 'hand', school: 'holy', target: 'friend', range: 30, cd: 300, learn: 10,
  ranks: [{ lvl: 10, cost: 25 }],
  usable: (u, t) => !(t ?? u).hasAura?.('forbearance'), usableMsg: 'Target cannot be protected again so soon.',
  desc: () => 'A targeted party member is protected from all physical attacks for 6 sec. Causes Forbearance.',
  effect: ({ u, t }) => {
    forbearance(u, t);
    t.addAura({ id: 'blessing_protection', name: 'Blessing of Protection', icon: 'hand', dur: 6, flags: { immunePhys: true }, group: 'blessing_prot' }, u);
    fx.rise(t, HOLY, 16);
  },
});
defineAbility({
  id: 'hammer_of_justice', name: 'Hammer of Justice', cls: P, icon: 'hammer', school: 'holy', cd: 60, range: 10, learn: 8,
  ranks: [{ lvl: 8, cost: 30, dur: 3 }, { lvl: 20, cost: 45, dur: 4 }],
  desc: (r) => `Stuns the target for ${r.dur} sec.`,
  effect: ({ u, t, rd }) => {
    t.addAura({ id: 'hammer_of_justice', name: 'Hammer of Justice', icon: 'hammer', dur: rd.dur, debuff: true, flags: { stun: true } }, u);
    engage(t, u);
    fx.at(t, HOLY, 14);
  },
});
defineAbility({
  id: 'purify', name: 'Purify', cls: P, icon: 'drop', school: 'holy', target: 'friend', range: 30, learn: 8,
  ranks: [{ lvl: 8, cost: 30 }],
  desc: () => 'Purifies the friendly target, removing 1 disease effect and 1 poison effect.',
  effect: ({ u, t }) => { for (const type of ['poison', 'disease']) { const a = t.auras.find((x) => x.dispel === type); if (a) t.removeAura(a, 'dispel'); } fx.rise(t, HOLY, 8); },
});
defineAbility({
  id: 'lay_on_hands', name: 'Lay on Hands', cls: P, icon: 'hand', school: 'holy', target: 'friend', range: 40, cd: 600, learn: 10,
  ranks: [{ lvl: 10, cost: 0 }],
  desc: () => "Heals a friendly target for an amount equal to the Paladin's maximum health and drains all of the Paladin's remaining mana.",
  effect: ({ u, t }) => { heal(u, t, u.maxHp, { abilityName: 'Lay on Hands' }); u.mana = 0; fx.rise(t, HOLY, 30); },
});
defineAbility({
  id: 'righteous_fury', name: 'Righteous Fury', cls: P, icon: 'sun', school: 'holy', target: 'self', learn: 16,
  ranks: [{ lvl: 16, cost: 40 }],
  desc: () => 'Increases the threat generated by your Holy spells and attacks by 60% for 30 min.',
  effect: ({ u }) => u.addAura({ id: 'righteous_fury', name: 'Righteous Fury', icon: 'sun', dur: 1800, mods: { holyThreat: 0.6 } }, u),
});
defineAbility({
  id: 'exorcism', name: 'Exorcism', cls: P, icon: 'sun', school: 'holy', range: 30, cd: 15, learn: 20, creature: ['undead', 'demon'],
  ranks: [{ lvl: 20, cost: 85, min: 84, max: 96 }],
  desc: (r) => `Causes ${r.min} to ${r.max} Holy damage to an Undead or Demon target.`,
  effect: ({ u, t, ab, rd }) => { spellHit(u, t, ab, rd.min, rd.max, { coef: 0.43 }); fx.at(t, HOLY, 20, 5); },
});
// talents
defineAbility({
  id: 'consecration', name: 'Consecration', cls: P, icon: 'sun', school: 'holy', target: 'none', cd: 8, talent: true,
  ranks: [{ lvl: 1, cost: 135, total: 64 }],
  desc: (r) => `Consecrates the land beneath the Paladin, doing ${r.total} Holy damage over 8 sec to enemies who enter the area.`,
  effect: ({ u, rd }) => {
    const x = u.pos.x, z = u.pos.z;
    let n = 0;
    fx.nova(x, u.y, z, 8, HOLY, 0.8);
    u.addAura({
      id: 'consecration_src', name: 'Consecration', icon: 'sun', dur: 8, interval: 1, hidden: true,
      tick: () => {
        n++;
        for (const e of aoeEnemies(u, x, z, 8)) dealDamage(u, e, rd.total / 8, { school: 'holy', abilityName: 'Consecration', periodic: true });
        if (n % 2) fx.nova(x, u.y, z, 8, HOLY, 0.6);
      },
    }, u);
  },
});
defineAbility({
  id: 'seal_command', name: 'Seal of Command', cls: P, icon: 'crown', school: 'holy', target: 'self', talent: true,
  ranks: [{ lvl: 1, cost: 65 }],
  desc: () => 'Gives the Paladin a chance to deal additional Holy damage equal to 70% of normal weapon damage. Only one Seal can be active at a time. Lasts 30 sec. Judging deals Holy damage.',
  effect: ({ u }) => sealAura(u, 'seal_command', 'Seal of Command', {
    judge: (t) => spellHit(u, t, { id: 'judgement', name: 'Judgement of Command', school: 'holy', coef: 0.4 }, 46, 50),
    onHit: (a, t, outcome, dmg, hand) => { if (hand === 'mh' && Math.random() < 0.07 * u.weapon('mh').speed) dealDamage(u, t, dmg * 0.7, { school: 'holy', abilityName: 'Seal of Command' }); },
  }),
});
defineAbility({
  id: 'divine_favor', name: 'Divine Favor', cls: P, icon: 'star', school: 'holy', target: 'self', cd: 120, talent: true, gcd: false,
  ranks: [{ lvl: 1, cost: 20 }],
  desc: () => 'When activated, gives your next Holy Light or Flash of Light a 100% critical effect chance.',
  effect: ({ u }) => u.addAura({ id: 'divine_favor', name: 'Divine Favor', icon: 'star', dur: 60 }, u),
});
defineAbility({
  id: 'blessing_kings', name: 'Blessing of Kings', cls: P, icon: 'crown', school: 'holy', target: 'friend', range: 30, talent: true,
  ranks: [{ lvl: 1, cost: 75 }],
  desc: () => 'Places a Blessing on the friendly target, increasing total stats by 10% for 5 min. One Blessing per Paladin on any target.',
  effect: ({ u, t }) => { t.addAura({ id: 'blessing_kings', name: 'Blessing of Kings', icon: 'crown', dur: 300, group: 'blessing', pct: { str: 0.1, agi: 0.1, sta: 0.1, int: 0.1, spi: 0.1 } }, u); fx.rise(t, HOLY); },
});
