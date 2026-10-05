// Abilities every character has: bandaging and the hearthstone.
import { defineAbility, heal } from '../../engine/spells.js';
import { G, emit } from '../../state.js';
import * as fx from '../../engine/fx.js';

defineAbility({
  id: 'bandage', name: 'First Aid', cls: 'all', icon: 'bandage', target: 'self', channel: 8, tickEvery: 1, gcd: false,
  desc: () => 'Heals over 8 sec while channeled. Taking damage interrupts it.',
  onTick: ({ u }) => { const amt = u.cast?.bandage ?? 66; heal(u, u, amt / 8, { periodic: true, abilityName: 'First Aid', noThreat: true }); fx.rise(u, 0xff8080, 3); },
});
defineAbility({
  id: 'hearthstone_cast', name: 'Hearthstone', cls: 'all', icon: 'hearth', target: 'self', cast: 10, gcd: true, school: 'arcane',
  desc: () => 'Returns you to your home inn.',
  effect: ({ u }) => {
    u.cooldowns.hearth = G.time + 900;
    G.teleportHome?.(u);
    emit('system', 'You feel the pull of home.');
  },
});
