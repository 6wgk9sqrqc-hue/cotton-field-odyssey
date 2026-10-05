import { defineAbility, spellHit, weaponStrike, dot, aoeEnemies, dealDamage, engage, heal, projectile, addThreat } from '../../engine/spells.js';
import { tameBeast, callPet, dismissPet, revivePet, feedPet, placeTrap, fear } from '../../engine/summons.js';
import * as fx from '../../engine/fx.js';
import { G, emit } from '../../state.js';

const H = 'hunter';
const RANGED = { range: 35, minRange: 8, usable: (u) => ['bow', 'gun'].includes(u.weapon('ranged').type), usableMsg: 'Requires a bow or gun.' };

defineAbility({
  id: 'auto_shot', name: 'Auto Shot', cls: H, icon: 'bow', gcd: false, ...RANGED, noAutoAttack: true,
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'Automatically shoots the target until cancelled. Requires a bow or gun and ammunition. Cannot be used within 8 yards.',
  effect: ({ u, t }) => { u.autoShot = !(u.autoShot && u.target === t); u.target = t; if (u.autoShot) { u.autoAttack = false; if (t.threat) engage(t, u); } },
});
defineAbility({
  id: 'raptor_strike', name: 'Raptor Strike', cls: H, icon: 'claw', onNextSwing: true, gcd: false, range: 'melee', melee: true, cd: 6,
  ranks: [{ lvl: 1, cost: 15, bonus: 5 }, { lvl: 8, cost: 25, bonus: 11 }, { lvl: 16, cost: 35, bonus: 21 }],
  desc: (r) => `A strong attack that increases melee damage by ${r.bonus}. Replaces your next melee swing.`,
  effect: ({ u, t, ab, rd }) => weaponStrike(u, t, ab, { bonus: rd.bonus }),
});
defineAbility({
  id: 'track_beasts', name: 'Track Beasts', cls: H, icon: 'paw', target: 'self', gcd: true, school: 'nature',
  ranks: [{ lvl: 1, cost: 0 }],
  desc: () => 'Shows the location of all nearby beasts on the minimap.',
  effect: ({ u }) => {
    if (u.hasAura('track_beasts')) { u.removeAura(u.getAura('track_beasts')); return; }
    u.removeAurasWhere((a) => a.group === 'tracking');
    u.addAura({ id: 'track_beasts', name: 'Track Beasts', icon: 'paw', dur: Infinity, group: 'tracking', track: 'beast' }, u);
  },
});
defineAbility({
  id: 'track_humanoids', name: 'Track Humanoids', cls: H, icon: 'eye', target: 'self', school: 'nature', learn: 10,
  ranks: [{ lvl: 10, cost: 0 }],
  desc: () => 'Shows the location of all nearby humanoids on the minimap.',
  effect: ({ u }) => {
    if (u.hasAura('track_humanoids')) { u.removeAura(u.getAura('track_humanoids')); return; }
    u.removeAurasWhere((a) => a.group === 'tracking');
    u.addAura({ id: 'track_humanoids', name: 'Track Humanoids', icon: 'eye', dur: Infinity, group: 'tracking', track: 'humanoid' }, u);
  },
});
function aspect(u, id, name, icon, mods, extra = {}) {
  if (u.hasAura(id)) { u.removeAura(u.getAura(id)); return; }
  u.addAura({ id, name, icon, dur: Infinity, group: 'aspect', mods, ...extra }, u);
  fx.rise(u, 0x80ff80, 10);
}
defineAbility({
  id: 'aspect_monkey', name: 'Aspect of the Monkey', cls: H, icon: 'paw', target: 'self', school: 'nature', gcdOverride: 1, learn: 4,
  ranks: [{ lvl: 4, cost: 20 }],
  desc: () => 'The hunter takes on the aspects of a monkey, increasing chance to dodge by 8%. Only one Aspect can be active at a time.',
  effect: ({ u }) => aspect(u, 'aspect_monkey', 'Aspect of the Monkey', 'paw', { dodge: 8 }),
});
defineAbility({
  id: 'aspect_hawk', name: 'Aspect of the Hawk', cls: H, icon: 'feather', target: 'self', school: 'nature', gcdOverride: 1, learn: 10,
  ranks: [{ lvl: 10, cost: 20, rap: 20 }, { lvl: 18, cost: 35, rap: 35 }],
  desc: (r) => `The hunter takes on the aspects of a hawk, increasing ranged attack power by ${r.rap}. Only one Aspect can be active at a time.`,
  effect: ({ u, rd }) => aspect(u, 'aspect_hawk', 'Aspect of the Hawk', 'feather', { rap: Math.round(rd.rap * (1 + (u.mods?.hawkPct ?? 0))) }),
});
defineAbility({
  id: 'aspect_cheetah', name: 'Aspect of the Cheetah', cls: H, icon: 'boot', target: 'self', school: 'nature', gcdOverride: 1, learn: 20,
  ranks: [{ lvl: 20, cost: 40 }],
  desc: () => 'Increases movement speed by 30%. If you are struck you will be dazed for 4 sec.',
  effect: ({ u }) => aspect(u, 'aspect_cheetah', 'Aspect of the Cheetah', 'boot', { speed: 0.3 }, {
    onStruck: (a, src) => { if (Math.random() < 0.5) { u.removeAura(a); u.addAura({ id: 'dazed', name: 'Dazed', icon: 'boot', dur: 4, debuff: true, mods: { speed: -0.5 } }, src); } },
  }),
});
defineAbility({
  id: 'serpent_sting', name: 'Serpent Sting', cls: H, icon: 'poison', school: 'nature', ...RANGED, learn: 4,
  ranks: [{ lvl: 4, cost: 15, total: 20 }, { lvl: 10, cost: 30, total: 40 }, { lvl: 18, cost: 50, total: 80 }],
  desc: (r) => `Stings the target, causing ${r.total} Nature damage over 15 sec. Only one Sting per Hunter can be active on any one target.`,
  effect: ({ u, t, ab, rd }) => {
    projectile(u, t, { color: 0x60ff40, size: 0.4, speed: 40 }, () => {
      if (t.dead) return;
      dot(u, t, ab, { total: rd.total * (1 + (u.mods?.stingPct ?? 0)), dur: 15, interval: 3, school: 'nature', group: 'sting', dispel: 'poison' });
      engage(t, u);
    });
  },
});
defineAbility({
  id: 'arcane_shot', name: 'Arcane Shot', cls: H, icon: 'arrow', school: 'arcane', cd: 6, ...RANGED, learn: 6,
  ranks: [{ lvl: 6, cost: 25, dmg: 13 }, { lvl: 12, cost: 35, dmg: 21 }, { lvl: 20, cost: 50, dmg: 33 }],
  desc: (r) => `An instant shot that causes ${r.dmg} Arcane damage plus a share of your ranged attack power.`,
  effect: ({ u, t, ab, rd }) => {
    projectile(u, t, { color: 0xff80ff, size: 0.5, speed: 45 }, () => { if (!t.dead) spellHit(u, t, ab, rd.dmg + u.stats.rap * 0.15, rd.dmg + u.stats.rap * 0.15, { coef: 0 }); });
    u.anim.shoot = 0.5;
  },
});
defineAbility({
  id: 'hunters_mark', name: "Hunter's Mark", cls: H, icon: 'target', school: 'arcane', range: 100, learn: 6,
  ranks: [{ lvl: 6, cost: 15, rap: 20 }, { lvl: 16, cost: 30, rap: 45 }],
  desc: (r) => `Places the Hunter's Mark on the target, increasing the ranged attack power of all attackers against it by ${r.rap} for 2 min.`,
  effect: ({ u, t, rd }) => { t.addAura({ id: 'hunters_mark', name: "Hunter's Mark", icon: 'target', dur: 120, debuff: true, rangedTaken: rd.rap / 14 * 2.8, unique: true }, u); engage(t, u); fx.at(t, 0xff4040, 6); },
});
defineAbility({
  id: 'concussive_shot', name: 'Concussive Shot', cls: H, icon: 'arrow', cd: 12, ...RANGED, learn: 8,
  ranks: [{ lvl: 8, cost: 15 }],
  desc: () => 'Dazes the target, slowing movement speed by 50% for 4 sec.',
  effect: ({ u, t }) => {
    projectile(u, t, { arrow: true, speed: 45 }, () => {
      if (t.dead) return;
      t.addAura({ id: 'concussive_shot', name: 'Concussive Shot', icon: 'arrow', dur: 4, debuff: true, mods: { speed: -0.5 } }, u);
      dealDamage(u, t, 1, { school: 'physical', abilityName: 'Concussive Shot', ignoreArmor: true });
    });
  },
});
defineAbility({
  id: 'distracting_shot', name: 'Distracting Shot', cls: H, icon: 'arrow', school: 'arcane', cd: 8, ...RANGED, learn: 12,
  ranks: [{ lvl: 12, cost: 35, threat: 110 }],
  desc: (r) => `Distracts the target to attack you, causing ${r.threat} additional threat.`,
  effect: ({ u, t, rd }) => projectile(u, t, { color: 0xffa0ff, size: 0.4, speed: 45 }, () => { if (!t.dead) { addThreat(t, u, rd.threat); dealDamage(u, t, 1, { school: 'arcane', abilityName: 'Distracting Shot' }); } }),
});
defineAbility({
  id: 'multi_shot', name: 'Multi-Shot', cls: H, icon: 'arrows', cd: 10, ...RANGED, learn: 18,
  ranks: [{ lvl: 18, cost: 100, bonus: 40 }],
  desc: (r) => `Fires several missiles, hitting your current target and up to 2 enemies near it for ranged weapon damage plus ${r.bonus}.`,
  effect: ({ u, t, ab, rd }) => {
    const targets = [t, ...aoeEnemies(u, t.pos.x, t.pos.z, 8).filter((e) => e !== t).slice(0, 2)];
    for (const e of targets) projectile(u, e, { arrow: true, speed: 45 }, () => { if (!e.dead) weaponStrike(u, e, ab, { ranged: true, bonus: rd.bonus }); });
    u.useAmmo?.();
  },
});
defineAbility({
  id: 'wing_clip', name: 'Wing Clip', cls: H, icon: 'feather', range: 'melee', melee: true, learn: 12,
  ranks: [{ lvl: 12, cost: 40, dmg: 5 }],
  desc: (r) => `Attacks the enemy for ${r.dmg} damage and reduces its movement speed by 50% for 10 sec.`,
  effect: ({ u, t, ab, rd }) => { const r = weaponStrike(u, t, ab, { flat: rd.dmg }); if (r.dmg > 0) t.addAura({ id: 'wing_clip', name: 'Wing Clip', icon: 'feather', dur: 10, debuff: true, mods: { speed: -0.5 } }, u); },
});
defineAbility({
  id: 'mongoose_bite', name: 'Mongoose Bite', cls: H, icon: 'fang', react: 'counter', cd: 5, range: 'melee', melee: true, learn: 16,
  ranks: [{ lvl: 16, cost: 30, dmg: 25 }],
  desc: (r) => `Attack the enemy for ${r.dmg} damage. Only usable after you dodge, parry or block.`,
  effect: ({ u, t, ab, rd }) => { u.react.counter = 0; weaponStrike(u, t, ab, { flat: rd.dmg + u.stats.ap * 0.1, noDodge: true }); },
});
defineAbility({
  id: 'disengage', name: 'Disengage', cls: H, icon: 'boot', range: 'melee', cd: 5, learn: 20,
  ranks: [{ lvl: 20, cost: 50, threat: 140 }],
  desc: (r) => `Attempts to disengage from the target, reducing threat by ${r.threat}.`,
  effect: ({ u, t, rd }) => { if (t.threat?.has(u)) t.threat.set(u, Math.max(0, t.threat.get(u) - rd.threat)); },
});
defineAbility({
  id: 'scare_beast', name: 'Scare Beast', cls: H, icon: 'fear', school: 'nature', range: 30, cd: 30, creature: ['beast'], learn: 14,
  ranks: [{ lvl: 14, cost: 50, cast: 1.5, dur: 10 }],
  desc: (r) => `Scares a beast, causing it to run in fear for up to ${r.dur} sec.`,
  effect: ({ u, t, rd }) => { fear(u, t, rd.dur); engage(t, u); },
});
defineAbility({
  id: 'immolation_trap', name: 'Immolation Trap', cls: H, icon: 'flame', school: 'fire', target: 'none', cd: 15, learn: 16,
  ranks: [{ lvl: 16, cost: 50, total: 105 }],
  desc: (r) => `Place a fire trap that will burn the first enemy to approach for ${r.total} Fire damage over 15 sec. Lasts 1 min.`,
  effect: ({ u, ab, rd }) => placeTrap(u, { color: 0xff6020, trigger: (e) => { dot(u, e, ab, { total: rd.total, dur: 15, interval: 3, school: 'fire' }); engage(e, u); fx.at(e, 0xff6020, 20); } }),
});
defineAbility({
  id: 'freezing_trap', name: 'Freezing Trap', cls: H, icon: 'snowflake', school: 'frost', target: 'none', cd: 15, learn: 20,
  ranks: [{ lvl: 20, cost: 50, dur: 10 }],
  desc: (r) => `Place a frost trap that freezes the first enemy that approaches, preventing all action for up to ${r.dur} sec. Any damage breaks the effect.`,
  effect: ({ u, rd }) => placeTrap(u, { color: 0x80c0ff, trigger: (e) => { e.addAura({ id: 'freezing_trap', name: 'Freezing Trap', icon: 'snowflake', dur: rd.dur, debuff: true, flags: { incap: true }, breakOnDamage: true }, u); engage(e, u); fx.at(e, 0x80c0ff, 20); } }),
});
// pets
defineAbility({
  id: 'tame_beast', name: 'Tame Beast', cls: H, icon: 'paw', school: 'nature', range: 30, channel: 20, tickEvery: 20, creature: ['beast'], learn: 10, noAutoAttack: true,
  ranks: [{ lvl: 10, cost: 0 }],
  usable: (u, t) => !u.pet && !u.data?.petDead && !!t && t.level <= u.level && t.tpl?.tameable !== false && !t.elite, usableMsg: 'You cannot tame that, or you already have a pet.',
  desc: () => 'Begins taming a beast to be your companion. Your armor is reduced by 100% while you focus on taming. If you lose the beast\'s attention for any reason, the taming process will fail. Must be level of the beast or higher.',
  onChannelStart: ({ u, t }) => { engage(t, u); u.addAura({ id: 'taming', name: 'Tame Beast', icon: 'paw', dur: 20, pct: { armor: -1 } }, u); },
  onTick: ({ u, t }) => { if (!t.dead) tameBeast(u, t); },
  onChannelEnd: ({ u }) => u.removeAurasWhere((a) => a.id === 'taming'),
});
defineAbility({
  id: 'call_pet', name: 'Call Pet', cls: H, icon: 'paw', target: 'self', learn: 10, school: 'nature',
  ranks: [{ lvl: 10, cost: 0 }],
  usable: (u) => !!u.data?.petInfo && !u.pet && !u.data.petDead, usableMsg: 'You have no pet to call, or it is dead.',
  desc: () => 'Summons your pet to you.',
  effect: ({ u }) => callPet(u),
});
defineAbility({
  id: 'dismiss_pet', name: 'Dismiss Pet', cls: H, icon: 'paw', target: 'self', learn: 10, school: 'nature', cast: 5,
  ranks: [{ lvl: 10, cost: 0, cast: 5 }],
  usable: (u) => !!u.pet, usableMsg: 'You have no pet.',
  desc: () => 'Dismiss your pet. Dismissing your pet will reduce its happiness by 50.',
  effect: ({ u }) => dismissPet(u),
});
defineAbility({
  id: 'revive_pet', name: 'Revive Pet', cls: H, icon: 'heart', target: 'self', learn: 10, school: 'nature',
  ranks: [{ lvl: 10, cost: 80, cast: 10 }],
  usable: (u) => !!u.data?.petInfo && (!!u.data.petDead || u.pet?.dead), usableMsg: 'Your pet is alive.',
  desc: () => 'Revive your pet, returning it to life with 15% of its base health.',
  effect: ({ u }) => revivePet(u),
});
defineAbility({
  id: 'feed_pet', name: 'Feed Pet', cls: H, icon: 'meat', target: 'self', learn: 10, school: 'nature',
  ranks: [{ lvl: 10, cost: 0 }],
  usable: (u) => !!u.pet && !u.pet.dead && u.hasItem?.('pet_food'), usableMsg: 'You need a pet and some pet food (Tender Wolf Steak).',
  desc: () => 'Feed your pet, restoring its happiness and health over 10 sec. Uses Tender Wolf Steak.',
  effect: ({ u }) => feedPet(u),
});
defineAbility({
  id: 'mend_pet', name: 'Mend Pet', cls: H, icon: 'heart', target: 'pet', school: 'nature', range: 20, channel: 5, tickEvery: 1, learn: 12, needsPet: true,
  ranks: [{ lvl: 12, cost: 40, total: 100 }, { lvl: 20, cost: 70, total: 190 }],
  desc: (r) => `Heals your pet for ${r.total} health over 5 sec.`,
  onTick: ({ u, rd }) => { if (u.pet && !u.pet.dead) { heal(u, u.pet, rd.total / 5, { periodic: true, abilityName: 'Mend Pet' }); fx.rise(u.pet, 0x80ff80, 4); } },
});
defineAbility({
  id: 'dual_wield_hunter', name: 'Dual Wield', cls: H, icon: 'swords', passive: true, learn: 20, ranks: [{ lvl: 20 }],
  desc: () => 'Allows one-hand and off-hand weapons to be equipped in the off-hand.',
});
// talents
defineAbility({
  id: 'aimed_shot', name: 'Aimed Shot', cls: H, icon: 'target', cd: 6, ...RANGED, talent: true,
  ranks: [{ lvl: 1, cost: 75, cast: 3, bonus: 70 }],
  desc: (r) => `An aimed shot that increases ranged damage by ${r.bonus}.`,
  effect: ({ u, t, ab, rd }) => { u.useAmmo?.(); projectile(u, t, { arrow: true, speed: 60 }, () => { if (!t.dead) weaponStrike(u, t, ab, { ranged: true, bonus: rd.bonus }); }); },
});
defineAbility({
  id: 'counterattack', name: 'Counterattack', cls: H, icon: 'swords', react: 'counter', cd: 5, range: 'melee', melee: true, talent: true,
  ranks: [{ lvl: 1, cost: 45, dmg: 40 }],
  desc: (r) => `A strike that becomes active after parrying, dodging or blocking. Deals ${r.dmg} damage and immobilizes the target for 5 sec.`,
  effect: ({ u, t, ab, rd }) => { u.react.counter = 0; const r = weaponStrike(u, t, ab, { flat: rd.dmg }); if (r.dmg) t.addAura({ id: 'counterattack', name: 'Counterattack', icon: 'swords', dur: 5, debuff: true, flags: { root: true } }, u); },
});
defineAbility({
  id: 'intimidation', name: 'Intimidation', cls: H, icon: 'shout', target: 'self', cd: 60, talent: true, needsPet: true,
  ranks: [{ lvl: 1, cost: 30 }],
  desc: () => "Command your pet to intimidate the target on its next successful melee attack, causing a high amount of threat and stunning it for 3 sec.",
  effect: ({ u }) => { if (u.pet) u.pet.addAura({ id: 'intimidation', name: 'Intimidation', icon: 'shout', dur: 15, onHit: (a, t) => { t.addAura({ id: 'intimidated', name: 'Intimidation', icon: 'shout', dur: 3, debuff: true, flags: { stun: true } }, u.pet); addThreat(t, u.pet, 200); a.remaining = 0; } }, u); },
});
void G; void emit;
