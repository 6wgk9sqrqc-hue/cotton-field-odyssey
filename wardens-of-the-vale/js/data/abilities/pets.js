// Abilities used by hunter pets and warlock demons.
import { defineAbility, spellHit, weaponStrike, addThreat, dealDamage, projectile, aoeAllies, engage } from '../../engine/spells.js';
import * as fx from '../../engine/fx.js';

const P = (o) => defineAbility({ cls: 'pet', gcd: false, ...o });
P({
  id: 'p_bite', name: 'Bite', icon: 'fang', range: 'melee', melee: true, cd: 10, costType: 'energy', cost: 35,
  desc: () => 'Bite the enemy for extra damage.',
  effect: ({ u, t, ab }) => weaponStrike(u, t, ab, { bonus: 4 + u.level * 1.6 }),
});
P({
  id: 'p_claw', name: 'Claw', icon: 'claw', range: 'melee', melee: true, costType: 'energy', cost: 25,
  desc: () => 'Claw the enemy for extra damage.',
  effect: ({ u, t, ab }) => weaponStrike(u, t, ab, { bonus: 2 + u.level * 1.1 }),
});
P({
  id: 'p_growl', name: 'Growl', icon: 'shout', range: 5, cd: 5, costType: 'energy', cost: 15,
  desc: () => 'Taunt the target, increasing the likelihood the creature will focus attacks on your pet.',
  effect: ({ u, t }) => { addThreat(t, u, 20 + u.level * 6); engage(t, u); },
});
P({
  id: 'p_firebolt', name: 'Firebolt', icon: 'fireball', school: 'fire', range: 30, cast: 2, costType: 'mana', cost: 10,
  desc: () => 'Deals fire damage to a target.',
  effect: ({ u, t, ab }) => projectile(u, t, { color: 0xff7030, size: 0.5, speed: 26 }, () => { if (!t.dead) spellHit(u, t, ab, 5 + u.level * 1.7, 7 + u.level * 2.1, { coef: 0 }); }),
});
P({
  id: 'p_torment', name: 'Torment', icon: 'void', school: 'shadow', range: 5, cd: 5, costType: 'mana', cost: 10,
  desc: () => 'Torments the target, increasing the likelihood the creature will attack the Voidwalker.',
  effect: ({ u, t }) => { addThreat(t, u, 30 + u.level * 8); engage(t, u); fx.at(t, 0x9040d0, 6); },
});
P({
  id: 'p_sacrifice', name: 'Sacrifice', icon: 'void', school: 'shadow', target: 'self', cd: 300,
  desc: () => 'Sacrifices the Voidwalker, giving its master a shield that absorbs damage for 30 sec.',
  effect: ({ u }) => {
    const o = u.owner;
    if (!o) return;
    o.addAura({ id: 'sacrifice', name: 'Sacrifice', icon: 'void', dur: 30, absorb: 90 + u.level * 12 }, u);
    dealDamage(u, u, u.hp + 1, { noThreat: true, abilityName: 'Sacrifice' });
  },
});
P({
  id: 'p_lash', name: 'Lash of Pain', icon: 'kiss', school: 'shadow', range: 'melee', cd: 12, costType: 'mana', cost: 15,
  desc: () => 'An instant attack that lashes the target, causing Shadow damage.',
  effect: ({ u, t, ab }) => spellHit(u, t, ab, 8 + u.level * 2, 10 + u.level * 2.4, { coef: 0 }),
});
P({
  id: 'p_seduction', name: 'Seduction', icon: 'kiss', school: 'shadow', range: 20, cast: 1.5, cd: 15, creature: ['humanoid'], costType: 'mana', cost: 20,
  desc: () => 'Seduces the target, preventing all actions for up to 15 sec. Any damage breaks the effect.',
  effect: ({ u, t }) => { t.addAura({ id: 'seduction', name: 'Seduction', icon: 'kiss', dur: 15, debuff: true, flags: { incap: true }, breakOnDamage: true }, u); },
});
P({
  id: 'p_blood_pact', name: 'Blood Pact', icon: 'drop', school: 'shadow', target: 'self', passive: true,
  desc: () => 'Increases the Stamina of party members within 30 yards.',
});
export function bloodPactTick(imp) {
  for (const a of aoeAllies(imp, imp.pos.x, imp.pos.z, 30)) if (a !== imp) a.addAura({ id: 'blood_pact', name: 'Blood Pact', icon: 'drop', dur: 4, mods: { sta: 3 + Math.floor(imp.level / 4) }, unique: true }, imp);
}
