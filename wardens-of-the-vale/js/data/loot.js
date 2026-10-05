// Boss loot tables and creature drop rules.
import { defArmor, defWeapon, genItem, VENDOR_ITEMS } from './items.js';
import { MOBS } from './mobs.js';
import { pick, randInt } from '../util.js';

const A = (id, name, slot, type, ilvl, q, stats, color, extra) => defArmor(id, name, slot, type, ilvl, q, stats, { color, bop: true, ...extra });
const W = (id, name, wtype, ilvl, q, stats, color, extra) => defWeapon(id, name, wtype, ilvl, q, stats, { color, bop: true, ...extra });
// Warden Mortis
A('mortis_girdle', 'Ossified Girdle', 'waist', 'mail', 22, 3, { str: 6, sta: 5 }, 0xd8d0b8);
W('bonecrusher', 'Bonecrusher', 'mace2h', 22, 3, { str: 9, sta: 6 }, 0xc8c0a8);
A('ossuary_wraps', 'Ossuary Wraps', 'wrist', 'cloth', 22, 3, { int: 5, spi: 4 }, 0xe8e0c8);
A('warden_spaulders', 'Wardenbone Spaulders', 'shoulder', 'leather', 22, 3, { agi: 6, sta: 5 }, 0xb8b0a0);
// Lady Vexmire
A('vexmire_robes', 'Vexmire\'s Robes', 'chest', 'cloth', 23, 3, { int: 8, spi: 6, sta: 5 }, 0x4a0a3a, { robe: true });
W('necrotic_wand', 'Wand of Withering', 'wand', 23, 3, { int: 4, sta: 3 }, 0x60ff90, { school: 'shadow' });
A('deathweave_gloves', 'Deathweave Gloves', 'hands', 'leather', 23, 3, { agi: 6, sta: 5 }, 0x2a1a2a);
A('soulbinder_helm', 'Soulbinder Helm', 'head', 'mail', 23, 3, { str: 8, sta: 7 }, 0x3a2a4a);
W('vexmire_dirk', 'Vexmire\'s Kiss', 'dagger', 23, 3, { agi: 5, sta: 4 }, 0x9a70d0);
// The Hollow King
A('hollow_crown', 'Crown of Hollow Light', 'head', 'cloth', 25, 3, { int: 10, spi: 8, sta: 6 }, 0xb090d0);
A('kingsguard_breastplate', 'Kingsguard Breastplate', 'chest', 'mail', 25, 3, { str: 10, sta: 10 }, 0x5a4a6a);
A('shadowfang_vest', 'Shadowfang Vest', 'chest', 'leather', 25, 3, { agi: 10, sta: 8 }, 0x2a1a3a);
W('crownbreaker', 'Crownbreaker', 'axe', 25, 3, { str: 6, agi: 5, sta: 4 }, 0x9a70d0);
A('ring_hollow', 'Ring of the Hollow Throne', 'finger', 'jewel', 25, 3, { sta: 6, int: 4, agi: 4 });
A('kings_aegis', 'Aegis of the Fallen King', 'offhand', 'shield', 25, 3, { sta: 8, str: 5 }, 0x4a2a5a);
// Named quest bosses also drop something nice
W('strawhide_scythe_w', 'Strawhide\'s Reaper', 'polearm', 9, 2, { str: 3, sta: 2 }, 0x8a8a8a);
A('silkweave_shawl', 'Silkweave Shawl', 'back', 'cloth', 13, 2, { int: 2, sta: 3 }, 0xe0e0e8);
A('grimgill_fins', 'Grimgill\'s Fin Pauldrons', 'shoulder', 'mail', 17, 2, { str: 4, sta: 4 }, 0x4a8a6a);
W('gorgak_club', 'Cinderhorn Bonebreaker', 'mace', 21, 2, { str: 5, sta: 4 }, 0x6a4a3a);

export const BOSS_LOOT = {
  mortis: { n: 2, items: ['mortis_girdle', 'bonecrusher', 'ossuary_wraps', 'warden_spaulders'] },
  vexmire: { n: 2, items: ['vexmire_robes', 'necrotic_wand', 'deathweave_gloves', 'soulbinder_helm', 'vexmire_dirk'] },
  king: { n: 3, items: ['hollow_crown', 'kingsguard_breastplate', 'shadowfang_vest', 'crownbreaker', 'ring_hollow', 'kings_aegis'] },
  old_strawhide: { n: 1, items: ['strawhide_scythe_w'], chance: 0.6 },
  silkweave_matron: { n: 1, items: ['silkweave_shawl'], chance: 0.6 },
  king_grimgill: { n: 1, items: ['grimgill_fins'], chance: 0.6 },
  gorgak: { n: 1, items: ['gorgak_club'], chance: 0.6 },
};

let seedCounter = (Date.now() % 100000) * 7;
export function randomGreen(level, q = 2) {
  seedCounter = (seedCounter * 1103515245 + 12345) % 2147483647;
  const ilvl = Math.max(3, level + randInt(-1, 2));
  return genItem(seedCounter, ilvl, q).id;
}

// Roll a corpse's loot (quest items are added by the quest system).
export function rollLoot(mob) {
  const tpl = mob.tpl ?? {};
  const L = mob.level;
  const out = { money: 0, items: [] };
  if (tpl.noLoot) return out;
  const coinBearing = (mob.creature === 'humanoid' || mob.creature === 'undead' || tpl.money) && !tpl.noMoney;
  if (coinBearing && Math.random() < 0.85) out.money = Math.round(L * (2 + Math.random() * 5) * (tpl.money ?? 1) * (mob.elite ? 2.5 : 1) * (mob.boss ? 3 : 1));
  if (tpl.junk?.length && Math.random() < (mob.creature === 'beast' ? 0.7 : 0.45)) out.items.push([pick(tpl.junk), 1]);
  if (tpl.cloth && Math.random() < 0.3) out.items.push([L <= 12 ? 'linen_cloth' : 'wool_cloth', randInt(1, 2)]);
  if (mob.creature === 'beast' && Math.random() < 0.18 && L >= 5) out.items.push(['light_leather', 1]);
  let greenChance = mob.elite ? 0.12 : 0.025;
  if (tpl.greenChance) greenChance = tpl.greenChance;
  if (mob.boss) greenChance = 0;
  if (Math.random() < greenChance) out.items.push([randomGreen(L, Math.random() < (tpl.blueChance ?? 0.03) ? 3 : 2), 1]);
  if (Math.random() < 0.035 && !mob.boss) {
    const tier = L >= 14 ? 16 : L >= 8 ? 10 : 4;
    out.items.push([pick(VENDOR_ITEMS[tier]), 1]);
  }
  if (Math.random() < 0.02) out.items.push([L >= 12 ? 'lesser_healing_potion' : 'minor_healing_potion', 1]);
  const table = BOSS_LOOT[tpl.lootTable ?? mob.tplId];
  if (table && Math.random() < (table.chance ?? 1)) {
    const pool = [...table.items];
    for (let i = 0; i < table.n && pool.length; i++) out.items.push([pool.splice(Math.floor(Math.random() * pool.length), 1)[0], 1]);
  }
  if (mob.boss && !table) out.items.push([randomGreen(L, 2), 1]);
  return out;
}
export { MOBS };
