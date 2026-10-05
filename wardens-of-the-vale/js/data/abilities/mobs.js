// Creature abilities. Damage scales with the creature's level.
import { defineAbility, spellHit, weaponStrike, dot, aoeEnemies, aoeAllies, dealDamage, directHeal, interrupt, projectile, engage } from '../../engine/spells.js';
import { fear, dash } from '../../engine/summons.js';
import * as fx from '../../engine/fx.js';
import { G, emit } from '../../state.js';
import { rand } from '../../util.js';

const lvlDmg = (u, a, b) => [a + u.level * b, a * 1.25 + u.level * b * 1.2];
const M = (o) => defineAbility({ cls: 'mob', gcd: false, ...o });

M({ id: 'm_strike', name: 'Heavy Strike', icon: 'sword', range: 'melee', melee: true, effect: ({ u, t, ab }) => weaponStrike(u, t, ab, { mult: 1.4 }) });
M({ id: 'm_cleave', name: 'Cleave', icon: 'axe', range: 'melee', melee: true, effect: ({ u, t, ab }) => { for (const e of aoeEnemies(u, t.pos.x, t.pos.z, 6, 3)) weaponStrike(u, e, ab, { mult: 1.1 }); } });
M({ id: 'm_bite', name: 'Bite', icon: 'fang', range: 'melee', melee: true, effect: ({ u, t, ab }) => weaponStrike(u, t, ab, { mult: 1.3 }) });
M({ id: 'm_maul', name: 'Maul', icon: 'claw', range: 'melee', melee: true, effect: ({ u, t, ab }) => weaponStrike(u, t, ab, { mult: 1.5 }) });
M({
  id: 'm_rend', name: 'Rend', icon: 'claw', range: 'melee', melee: true,
  effect: ({ u, t, ab }) => { const r = weaponStrike(u, t, ab, { mult: 0.6 }); if (r.dmg > 0) dot(u, t, ab, { total: 6 + u.level * 4, dur: 12, interval: 3, school: 'physical', dispel: null }); },
});
M({
  id: 'm_poison', name: 'Venom Spit', icon: 'poison', school: 'nature', range: 10,
  effect: ({ u, t, ab }) => { dot(u, t, ab, { total: 6 + u.level * 4, dur: 12, interval: 3, school: 'nature', dispel: 'poison' }); fx.at(t, 0x80ff40, 8); },
});
M({
  id: 'm_disease', name: 'Festering Bite', icon: 'skull', school: 'nature', range: 'melee', melee: true,
  effect: ({ u, t, ab }) => { t.addAura({ id: 'm_disease', name: 'Festering Rot', icon: 'skull', dur: 30, debuff: true, dispel: 'disease', mods: { sta: -Math.round(2 + u.level / 3) }, interval: 3, tick: (a) => dealDamage(u, t, 1 + u.level * 0.6, { school: 'nature', periodic: true, abilityName: 'Festering Rot' }) }, u); },
});
M({
  id: 'm_blight', name: 'Blight Touch', icon: 'skull', school: 'nature', range: 'melee', melee: true,
  effect: ({ u, t, ab }) => { dot(u, t, ab, { total: 5 + u.level * 3, dur: 12, interval: 3, school: 'nature', dispel: 'disease' }); fx.at(t, 0x90ff40, 8); },
});
M({
  id: 'm_web', name: 'Web', icon: 'net', school: 'nature', range: 20,
  effect: ({ u, t }) => { projectile(u, t, { color: 0xeeeeee, size: 0.6, speed: 22 }, () => { if (!t.dead) t.addAura({ id: 'm_web', name: 'Web', icon: 'net', dur: 4, debuff: true, flags: { root: true } }, u); }); },
});
M({
  id: 'm_entangle', name: 'Grasping Vines', icon: 'root', school: 'nature', range: 20,
  effect: ({ u, t }) => { t.addAura({ id: 'm_entangle', name: 'Grasping Vines', icon: 'root', dur: 5, debuff: true, flags: { root: true }, damageCap: t.maxHp * 0.1 }, u); fx.at(t, 0x5a8a3a, 10); },
});
M({
  id: 'm_gouge', name: 'Gouge', icon: 'fist', range: 'melee', melee: true,
  effect: ({ u, t, ab }) => { const r = weaponStrike(u, t, ab, { mult: 0.5 }); if (r.dmg > 0) t.addAura({ id: 'm_gouge', name: 'Gouge', icon: 'fist', dur: 3, debuff: true, flags: { incap: true }, breakOnDamage: true, appliedBy: 'm_gouge' }, u); },
});
M({
  id: 'm_charge', name: 'Charge', icon: 'boot', range: 25, minRange: 6,
  effect: ({ u, t }) => dash(u, t, 20, () => { t.addAura({ id: 'm_charge', name: 'Charge', icon: 'boot', dur: 1.5, debuff: true, flags: { stun: true } }, u); dealDamage(u, t, 3 + u.level * 1.5, { school: 'physical', abilityName: 'Charge' }); }),
});
const bolt = (id, name, school, color, icon, extra) => M({
  id, name, icon, school, range: 30, cast: 2.5, spell: true,
  effect: ({ u, t, ab }) => projectile(u, t, { color, size: 0.7, speed: 24 }, () => { if (!t.dead) { const [a, b] = lvlDmg(u, 6, 2.6); if (spellHit(u, t, ab, a, b, { coef: 0 })) extra?.(u, t); } }),
});
bolt('m_shadow_bolt', 'Shadow Bolt', 'shadow', 0x9040d0, 'skull');
bolt('m_fire_bolt', 'Fire Bolt', 'fire', 0xff7030, 'fireball');
bolt('m_lightning_bolt', 'Lightning Bolt', 'nature', 0x9ad8ff, 'bolt');
bolt('m_frostbolt', 'Frostbolt', 'frost', 0x80c8ff, 'frostbolt', (u, t) => t.addAura({ id: 'chilled', name: 'Chilled', icon: 'snowflake', dur: 5, debuff: true, mods: { speed: -0.4 } }, u));
M({
  id: 'm_heal', name: 'Heal', icon: 'hand', school: 'holy', target: 'self', cast: 2, spell: true,
  effect: ({ u, ab }) => {
    const hurt = aoeAllies(u, u.pos.x, u.pos.z, 30).filter((a) => a.hp < a.maxHp * 0.6).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? u;
    directHeal(u, hurt, ab, u.maxHp * 0.18, u.maxHp * 0.24, { coef: 0 });
    fx.rise(hurt, 0xfff0a0, 12);
  },
});
M({
  id: 'm_curse', name: 'Curse of Weakness', icon: 'skull', school: 'shadow', range: 30,
  effect: ({ u, t }) => t.addAura({ id: 'm_curse', name: 'Curse of Weakness', icon: 'skull', dur: 60, debuff: true, dispel: 'curse', mods: { dmgDone: -0.1 } }, u),
});
M({
  id: 'm_hex', name: 'Hex of Frogs', icon: 'sheep', school: 'nature', range: 30, cast: 1.5, spell: true,
  effect: ({ u, t }) => t.addAura({ id: 'm_hex', name: 'Hex', icon: 'sheep', dur: 6, debuff: true, dispel: 'curse', flags: { incap: true }, breakOnDamage: true }, u),
});
M({ id: 'm_fear', name: 'Terrify', icon: 'fear', school: 'shadow', range: 15, effect: ({ u, t }) => fear(u, t, 4) });
M({
  id: 'm_howl', name: 'Bloodcurdling Howl', icon: 'shout', target: 'none',
  effect: ({ u }) => { for (const a of aoeAllies(u, u.pos.x, u.pos.z, 15)) a.addAura({ id: 'm_howl', name: 'Howl', icon: 'shout', dur: 15, mods: { atkSpeed: 0.3 } }, u); fx.novaAt(u, 15, 0xff4040); },
});
M({
  id: 'm_war_cry', name: 'War Cry', icon: 'shout', target: 'none',
  effect: ({ u }) => { for (const a of aoeAllies(u, u.pos.x, u.pos.z, 20)) a.addAura({ id: 'm_war_cry', name: 'War Cry', icon: 'shout', dur: 20, mods: { dmgDone: 0.25 } }, u); emit('yell', { unit: u, text: 'Mrrglglgl! Defend the king!' }); },
});
M({
  id: 'm_bloodlust', name: 'Bloodlust', icon: 'drop', target: 'self', school: 'nature',
  effect: ({ u }) => { const tgt = aoeAllies(u, u.pos.x, u.pos.z, 20).find((a) => a.inCombat && a !== u) ?? u; tgt.addAura({ id: 'm_bloodlust', name: 'Bloodlust', icon: 'drop', dur: 15, mods: { atkSpeed: 0.3 } }, u); fx.rise(tgt, 0xff3030, 10); },
});
M({
  id: 'm_enrage', name: 'Enrage', icon: 'drop', target: 'self',
  effect: ({ u }) => { u.addAura({ id: 'm_enrage', name: 'Enrage', icon: 'drop', dur: 120, mods: { atkSpeed: 0.5, dmgDone: 0.2 } }, u); emit('emote', { unit: u, text: `${u.name} becomes enraged!` }); },
});
M({
  id: 'm_stomp', name: 'War Stomp', icon: 'burst', target: 'none',
  effect: ({ u }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 8)) { dealDamage(u, e, 4 + u.level * 1.6, { school: 'physical', abilityName: 'War Stomp' }); e.addAura({ id: 'm_stomp', name: 'War Stomp', icon: 'burst', dur: 2, debuff: true, flags: { stun: true } }, u); } fx.novaAt(u, 8, 0xc0a080); },
});
M({
  id: 'm_mud', name: 'Mud Slick', icon: 'drop', school: 'nature', range: 20,
  effect: ({ u, t }) => { t.addAura({ id: 'm_mud', name: 'Mud Slick', icon: 'drop', dur: 8, debuff: true, mods: { speed: -0.5, atkSpeed: -0.2 } }, u); fx.at(t, 0x6a5a3a, 12); },
});
M({
  id: 'm_fire_nova', name: 'Fire Nova', icon: 'burst', school: 'fire', target: 'none',
  effect: ({ u, ab }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 8)) { const [a, b] = lvlDmg(u, 4, 1.8); spellHit(u, e, ab, a, b, { coef: 0 }); } fx.novaAt(u, 8, 0xff6020); },
});
M({
  id: 'm_fire_breath', name: 'Fire Breath', icon: 'flame', school: 'fire', range: 10,
  effect: ({ u, t, ab }) => { for (const e of aoeEnemies(u, t.pos.x, t.pos.z, 5)) { const [a, b] = lvlDmg(u, 6, 2.2); spellHit(u, e, ab, a, b, { coef: 0 }); } fx.burst({ x: t.pos.x, y: t.y + 1, z: t.pos.z }, 0xff6020, 30, 5); },
});
M({
  id: 'm_shield_bash', name: 'Shield Bash', icon: 'shield', range: 'melee', melee: true,
  effect: ({ u, t, ab }) => { const r = weaponStrike(u, t, ab, { mult: 0.6 }); if (r.dmg > 0) { interrupt(u, t, 4); t.addAura({ id: 'm_bash', name: 'Shield Bash', icon: 'shield', dur: 2, debuff: true, flags: { stun: true } }, u); } },
});
M({
  id: 'm_bone_shatter', name: 'Bone Shatter', icon: 'burst', target: 'none', cast: 1.5,
  effect: ({ u }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 10)) { dealDamage(u, e, 20 + u.level * 3, { school: 'physical', abilityName: 'Bone Shatter' }); e.addAura({ id: 'm_bone_shatter', name: 'Shattered', icon: 'armor', dur: 10, debuff: true, mods: { armor: -200 } }, u); } fx.novaAt(u, 10, 0xe8e0c8); },
});
M({
  id: 'm_shadow_volley', name: 'Shadow Bolt Volley', icon: 'skull', school: 'shadow', target: 'none', cast: 2,
  effect: ({ u, ab }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 30)) projectile(u, e, { color: 0x9040d0, size: 0.6, speed: 24 }, () => { if (!e.dead) { const [a, b] = lvlDmg(u, 4, 1.7); spellHit(u, e, ab, a, b, { coef: 0 }); } }); },
});
M({
  id: 'm_shadow_nova', name: 'Shadow Nova', icon: 'burst', school: 'shadow', target: 'none', cast: 2,
  effect: ({ u, ab }) => { for (const e of aoeEnemies(u, u.pos.x, u.pos.z, 14)) { const [a, b] = lvlDmg(u, 10, 2.8); spellHit(u, e, ab, a, b, { coef: 0 }); } fx.novaAt(u, 14, 0x9040d0); },
});
function summonAdds(u, tpl, n, lvl, yell) {
  if (!G.spawnMob) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = G.spawnMob(tpl, lvl ?? Math.max(1, u.level - 2), u.pos.x + Math.cos(a) * 4, u.pos.z + Math.sin(a) * 4, { temp: true });
    if (m && u.target) { engage(m, u.target); m.target = u.target; }
  }
  if (yell) emit('yell', { unit: u, text: yell });
}
M({ id: 'm_summon_crows', name: 'Call Crows', icon: 'feather', target: 'none', effect: ({ u }) => summonAdds(u, 'crow', 3, 5, 'Caw! Pick their bones clean!') });
M({ id: 'm_summon_spiderlings', name: 'Brood Swarm', icon: 'net', target: 'none', effect: ({ u }) => summonAdds(u, 'spiderling', 3, 9) });
M({ id: 'm_summon_drowned', name: 'Call the Drowned', icon: 'skull', target: 'none', effect: ({ u }) => summonAdds(u, 'drowned_sailor', 2, 14, 'All hands! Repel boarders!') });
M({ id: 'm_raise_dead', name: 'Raise Dead', icon: 'skull', target: 'none', cast: 2, effect: ({ u }) => summonAdds(u, 'raised_skeleton', u.boss ? 2 : 1, Math.max(1, u.level - 2)) });
M({ id: 'm_summon_hollow', name: 'Call of the Hollow', icon: 'skull', target: 'none', effect: ({ u }) => summonAdds(u, 'raised_skeleton', 3, 19, 'Rise, my servants! Rise and feast!') });
void rand;
