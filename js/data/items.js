// Item templates and generators. Armor, weapon damage, stat budgets and
// vendor prices are derived from item level and quality.
import { rng } from '../util.js';

export const ITEMS = {};
export const SLOT_NAMES = {
  head: 'Head', neck: 'Neck', shoulder: 'Shoulder', back: 'Back', chest: 'Chest', wrist: 'Wrist', hands: 'Hands',
  waist: 'Waist', legs: 'Legs', feet: 'Feet', finger: 'Finger', trinket: 'Trinket', onehand: 'One-Hand', mainhand: 'Main Hand',
  offhand: 'Off Hand', twohand: 'Two-Hand', ranged: 'Ranged', ammo: 'Projectile', bag: 'Bag', shield: 'Off Hand', holdable: 'Held In Off-hand',
};
export const EQUIP_SLOTS = ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist', 'hands', 'waist', 'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2', 'mainhand', 'offhand', 'ranged'];
export const WEAPON_NAMES = {
  dagger: 'Dagger', fist: 'Fist Weapon', sword: 'Sword', sword2h: 'Sword', axe: 'Axe', axe2h: 'Axe', mace: 'Mace', mace2h: 'Mace',
  staff: 'Staff', polearm: 'Polearm', bow: 'Bow', gun: 'Gun', wand: 'Wand', thrown: 'Thrown', shield: 'Shield', holdable: 'Held In Off-hand',
};
const TWO_HAND = new Set(['sword2h', 'axe2h', 'mace2h', 'staff', 'polearm']);
const RANGED = new Set(['bow', 'gun', 'wand', 'thrown']);
export const isTwoHand = (t) => TWO_HAND.has(t);
export const isRanged = (t) => RANGED.has(t);

const SLOT_W = { chest: 1, legs: 0.9, head: 0.8, shoulder: 0.75, feet: 0.7, hands: 0.6, waist: 0.55, wrist: 0.45, back: 0.4, neck: 0.5, finger: 0.5, trinket: 0.6, onehand: 0.6, mainhand: 0.6, offhand: 0.5, twohand: 1.2, ranged: 0.4, shield: 0.6, holdable: 0.5 };
const ARMOR_MUL = { cloth: 1.4, leather: 3.0, mail: 6.2 };
const Q_MUL = [0.5, 0.8, 1, 1.3, 1.65, 2];

function sellPrice(ilvl, q, slotW = 0.6) {
  return Math.max(1, Math.round((ilvl * ilvl * 0.9 + ilvl * 6 + 4) * (q === 0 ? 0.6 : Q_MUL[q] * (q >= 2 ? 1.6 : 1)) * slotW));
}

export function defArmor(id, name, slot, type, ilvl, q = 1, stats = {}, extra = {}) {
  const w = SLOT_W[slot] ?? 0.5;
  let armor = 0;
  if (slot === 'back') armor = Math.round((ilvl + 5) * 1.4 * 0.45 * (q >= 2 ? 1.1 : 1));
  else if (ARMOR_MUL[type]) armor = Math.round((ilvl + 5) * ARMOR_MUL[type] * w * (q >= 3 ? 1.15 : q === 2 ? 1.05 : q === 0 ? 0.8 : 1));
  if (type === 'shield') armor = Math.round(ilvl * 11 + 40) * (q >= 3 ? 1.15 : 1);
  ITEMS[id] = {
    id, name, q, slot, type, ilvl, req: extra.req ?? Math.max(1, ilvl - 5), armor, stats,
    price: extra.price ?? sellPrice(ilvl, q, w), dur: slot === 'neck' || slot === 'finger' || slot === 'trinket' || slot === 'back' ? 0 : Math.round(20 + ilvl * 1.5 * w * 2),
    bind: q >= 2 ? (extra.bop ? 'bop' : 'boe') : null, ...extra,
  };
  return ITEMS[id];
}

export function defWeapon(id, name, wtype, ilvl, q = 1, stats = {}, extra = {}) {
  const speed = extra.speed ?? ({ dagger: 1.7, fist: 1.9, sword: 2.4, axe: 2.6, mace: 2.5, sword2h: 3.3, axe2h: 3.5, mace2h: 3.4, staff: 3.0, polearm: 3.5, bow: 2.8, gun: 2.7, wand: 1.8, thrown: 2.0 })[wtype];
  let dps = (2 + ilvl * 0.55) * (q === 0 ? 0.7 : q === 1 ? 0.85 : q === 2 ? 1 : q === 3 ? 1.15 : 1.3);
  if (TWO_HAND.has(wtype)) dps *= 1.33;
  if (wtype === 'wand') dps *= 1.6;
  if (wtype === 'bow' || wtype === 'gun') dps *= 0.95;
  const avg = dps * speed;
  const slot = TWO_HAND.has(wtype) ? 'twohand' : RANGED.has(wtype) ? 'ranged' : extra.slot ?? 'onehand';
  ITEMS[id] = {
    id, name, q, slot, type: wtype, ilvl, req: extra.req ?? Math.max(1, ilvl - 5), stats,
    dmg: extra.dmg ?? [Math.max(1, Math.round(avg * 0.75)), Math.max(2, Math.round(avg * 1.25))], speed,
    school: wtype === 'wand' ? (extra.school ?? 'arcane') : 'physical',
    price: extra.price ?? sellPrice(ilvl, q, SLOT_W[slot]), dur: Math.round(25 + ilvl * 2.2),
    bind: q >= 2 ? (extra.bop ? 'bop' : 'boe') : null, ...extra,
  };
  return ITEMS[id];
}

export function defItem(id, name, props) {
  ITEMS[id] = { id, name, q: 1, stack: 1, price: 0, ...props };
  return ITEMS[id];
}

// ---------- starting gear ----------
defWeapon('worn_shortsword', 'Worn Shortsword', 'sword', 2, 1, {}, { req: 1, color: 0xb8bcc4, dmg: [1, 4], speed: 1.9 });
defArmor('battered_buckler', 'Battered Buckler', 'offhand', 'shield', 2, 1, {}, { req: 1, color: 0x7a5a3a });
defArmor('recruit_shirt', "Recruit's Vest", 'chest', 'mail', 2, 1, {}, { req: 1, color: 0x8a8a90 });
defArmor('recruit_pants', "Recruit's Pants", 'legs', 'leather', 2, 1, {}, { req: 1, color: 0x5a4a3a });
defArmor('recruit_boots', "Recruit's Boots", 'feet', 'cloth', 2, 1, {}, { req: 1, color: 0x3a2a20 });
defWeapon('battered_mace', 'Battered Mace', 'mace', 2, 1, {}, { req: 1, color: 0x8a8a8a, dmg: [2, 5], speed: 2.4 });
defArmor('squire_shirt', "Squire's Tabard", 'chest', 'mail', 2, 1, {}, { req: 1, color: 0xc8b070 });
defArmor('squire_pants', "Squire's Pants", 'legs', 'mail', 2, 1, {}, { req: 1, color: 0x6a6a7a });
defWeapon('worn_axe', 'Worn Axe', 'axe', 2, 1, {}, { req: 1, color: 0x9a9aa0, dmg: [2, 4], speed: 2.2 });
defWeapon('worn_shortbow', 'Worn Shortbow', 'bow', 2, 1, {}, { req: 1, dmg: [2, 4], speed: 2.3 });
defArmor('hunter_vest', 'Trapper\'s Vest', 'chest', 'leather', 2, 1, {}, { req: 1, color: 0x6a7a3a });
defArmor('hunter_pants', 'Trapper\'s Leggings', 'legs', 'leather', 2, 1, {}, { req: 1, color: 0x5a4a32 });
defWeapon('worn_dagger', 'Worn Dagger', 'dagger', 2, 1, {}, { req: 1, color: 0xc0c4cc, dmg: [1, 3], speed: 1.6 });
defWeapon('worn_dirk', 'Worn Dirk', 'dagger', 2, 1, {}, { req: 1, color: 0xa0a4ac, dmg: [1, 2], speed: 1.5 });
defArmor('footpad_shirt', "Footpad's Vest", 'chest', 'leather', 2, 1, {}, { req: 1, color: 0x3a3a40 });
defArmor('footpad_pants', "Footpad's Pants", 'legs', 'leather', 2, 1, {}, { req: 1, color: 0x2a2a30 });
defWeapon('worn_mace', 'Worn Mace', 'mace', 2, 1, {}, { req: 1, color: 0x8a8a8a, dmg: [2, 4], speed: 2.2 });
defArmor('neophyte_robe', "Neophyte's Robe", 'chest', 'cloth', 2, 1, {}, { req: 1, color: 0xe8e4d8, robe: true });
defArmor('primal_vest', 'Primal Vest', 'chest', 'leather', 2, 1, {}, { req: 1, color: 0x4a6a8a });
defArmor('primal_kilt', 'Primal Kilt', 'legs', 'leather', 2, 1, {}, { req: 1, color: 0x5a4a3a });
defWeapon('worn_staff', 'Worn Staff', 'staff', 2, 1, {}, { req: 1, dmg: [2, 6], speed: 2.9 });
defArmor('apprentice_robe', "Apprentice's Robe", 'chest', 'cloth', 2, 1, {}, { req: 1, color: 0x5a3a8a, robe: true });
defArmor('acolyte_robe', "Acolyte's Robe", 'chest', 'cloth', 2, 1, {}, { req: 1, color: 0x5a1a2a, robe: true });
defArmor('novice_leather_vest', "Novice's Leather Vest", 'chest', 'leather', 2, 1, {}, { req: 1, color: 0x5a6a3a });

// ---------- consumables ----------
const food = (id, name, lvl, hp, price, icon = 'meat') => defItem(id, name, { type: 'food', stack: 20, req: lvl, use: { food: hp, dur: 18 }, price, icon });
const drink = (id, name, lvl, mana, price) => defItem(id, name, { type: 'drink', stack: 20, req: lvl, use: { drink: mana, dur: 18 }, price, icon: 'drink' });
food('tough_jerky', 'Tough Jerky', 1, 61, 6);
food('cottonvale_bread', 'Cottonvale Rye', 1, 61, 6, 'bread');
food('haunch_of_meat', 'Haunch of Meat', 5, 243, 25);
food('honey_bun', 'Honey Bun', 5, 243, 25, 'bread');
food('mutton_chop', 'Mutton Chop', 15, 552, 50);
food('moist_cornbread', 'Moist Cornbread', 15, 552, 50, 'bread');
drink('spring_water', 'Refreshing Spring Water', 1, 151, 6);
drink('ice_cold_milk', 'Ice Cold Milk', 5, 436, 25);
drink('melon_juice', 'Melon Juice', 15, 835, 50);
food('conjured_muffin', 'Conjured Muffin', 1, 61, 0, 'bread'); ITEMS.conjured_muffin.conjured = true;
food('conjured_bread', 'Conjured Bread', 5, 243, 0, 'bread'); ITEMS.conjured_bread.conjured = true;
food('conjured_rye', 'Conjured Rye', 15, 552, 0, 'bread'); ITEMS.conjured_rye.conjured = true;
drink('conjured_water', 'Conjured Water', 1, 151, 0); ITEMS.conjured_water.conjured = true;
drink('conjured_fresh_water', 'Conjured Fresh Water', 5, 436, 0); ITEMS.conjured_fresh_water.conjured = true;
drink('conjured_purified_water', 'Conjured Purified Water', 15, 835, 0); ITEMS.conjured_purified_water.conjured = true;
defItem('minor_healing_potion', 'Minor Healing Potion', { type: 'potion', stack: 5, req: 1, use: { heal: [70, 90], potion: true }, price: 5, icon: 'potion_red' });
defItem('lesser_healing_potion', 'Lesser Healing Potion', { type: 'potion', stack: 5, req: 3, use: { heal: [140, 180], potion: true }, price: 25, icon: 'potion_red' });
defItem('healing_potion', 'Healing Potion', { type: 'potion', stack: 5, req: 12, use: { heal: [280, 360], potion: true }, price: 100, icon: 'potion_red' });
defItem('minor_mana_potion', 'Minor Mana Potion', { type: 'potion', stack: 5, req: 5, use: { mana: [140, 180], potion: true }, price: 20, icon: 'potion_blue' });
defItem('lesser_mana_potion', 'Lesser Mana Potion', { type: 'potion', stack: 5, req: 14, use: { mana: [280, 360], potion: true }, price: 80, icon: 'potion_blue' });
defItem('elixir_lions_strength', "Elixir of Lion's Strength", { type: 'potion', stack: 5, req: 1, use: { buff: 'elixir_str' }, price: 12, icon: 'potion_orange' });
defItem('elixir_minor_agility', 'Elixir of Minor Agility', { type: 'potion', stack: 5, req: 2, use: { buff: 'elixir_agi' }, price: 12, icon: 'potion_green' });
defItem('elixir_minor_fortitude', 'Elixir of Minor Fortitude', { type: 'potion', stack: 5, req: 2, use: { buff: 'elixir_sta' }, price: 12, icon: 'potion_yellow' });
defItem('elixir_wisdom', 'Elixir of Wisdom', { type: 'potion', stack: 5, req: 5, use: { buff: 'elixir_int' }, price: 20, icon: 'potion_purple' });
defItem('healthstone_minor', 'Minor Healthstone', { type: 'potion', stack: 1, req: 1, use: { heal: [100, 100], stone: true }, price: 0, icon: 'stone', unique: true, conjured: true });
defItem('healthstone_lesser', 'Lesser Healthstone', { type: 'potion', stack: 1, req: 12, use: { heal: [250, 250], stone: true }, price: 0, icon: 'stone', unique: true, conjured: true });
defItem('linen_bandage', 'Linen Bandage', { type: 'bandage', stack: 20, req: 1, use: { bandage: 66 }, price: 5, icon: 'bandage' });
defItem('wool_bandage', 'Wool Bandage', { type: 'bandage', stack: 20, req: 10, use: { bandage: 161 }, price: 14, icon: 'bandage' });
defItem('hearthstone', 'Hearthstone', { type: 'hearth', stack: 1, use: { hearth: true }, price: 0, icon: 'hearth', bind: 'bop', unique: true,
  desc: 'Returns you to the inn where you last set your home. Speak to an Innkeeper to change it.' });
defItem('soul_shard', 'Soul Shard', { type: 'reagent', stack: 1, price: 0, icon: 'shard', q: 1 });
defItem('rough_arrow', 'Rough Arrow', { type: 'ammo', slot: 'ammo', ammo: 'bow', stack: 200, req: 1, ammoDps: 2, price: 0, buyPrice: 10, icon: 'arrow', buyStack: 200 });
defItem('sharp_arrow', 'Sharp Arrow', { type: 'ammo', slot: 'ammo', ammo: 'bow', stack: 200, req: 10, ammoDps: 3.5, price: 0, buyPrice: 50, icon: 'arrow', buyStack: 200 });
defItem('flash_powder', 'Flash Powder', { type: 'reagent', stack: 20, price: 6, buyPrice: 25, icon: 'powder' });
defItem('pet_food', 'Tender Wolf Steak', { type: 'petfood', stack: 20, price: 4, buyPrice: 15, icon: 'meat', desc: 'A hunter can feed this to a pet.' });
defItem('linen_cloth', 'Linen Cloth', { type: 'trade', stack: 20, price: 13, icon: 'cloth' });
defItem('wool_cloth', 'Wool Cloth', { type: 'trade', stack: 20, price: 33, icon: 'cloth2' });
defItem('light_leather', 'Light Leather', { type: 'trade', stack: 20, price: 15, icon: 'leather' });
defItem('copper_ore', 'Copper Ore', { type: 'trade', stack: 20, price: 5, icon: 'ore' });

// bags
defItem('small_pouch', 'Small Brown Pouch', { type: 'bag', slot: 'bag', bagSlots: 6, price: 25, buyPrice: 100, icon: 'bag' });
defItem('linen_bag', 'Linen Bag', { type: 'bag', slot: 'bag', bagSlots: 6, price: 25, icon: 'bag', q: 1 });
defItem('woolen_bag', 'Woolen Bag', { type: 'bag', slot: 'bag', bagSlots: 8, price: 125, buyPrice: 500, icon: 'bag' });
defItem('traveler_pack', "Traveler's Backpack", { type: 'bag', slot: 'bag', bagSlots: 12, price: 625, icon: 'bag2', q: 2, bind: 'boe' });

// ---------- vendor gear (white) ----------
const VENDOR_SETS = {
  cloth: { 4: 'Linen', 10: 'Woolen', 16: 'Silken' },
  leather: { 4: 'Rawhide', 10: 'Tanned', 16: 'Hardened' },
  mail: { 4: 'Chain', 10: 'Ringmail', 16: 'Scalemail' },
};
const SLOT_WORDS = {
  cloth: { chest: 'Robe', legs: 'Pants', head: 'Cap', shoulder: 'Mantle', feet: 'Shoes', hands: 'Gloves', waist: 'Sash', wrist: 'Cuffs' },
  leather: { chest: 'Jerkin', legs: 'Breeches', head: 'Cap', shoulder: 'Shoulderpads', feet: 'Boots', hands: 'Gloves', waist: 'Belt', wrist: 'Bracers' },
  mail: { chest: 'Hauberk', legs: 'Leggings', head: 'Coif', shoulder: 'Pauldrons', feet: 'Sabatons', hands: 'Gauntlets', waist: 'Girdle', wrist: 'Bracers' },
};
const ARMOR_COLORS = { cloth: [0xb8a888, 0x8a7aa0, 0x6a4a7a], leather: [0x7a5a3a, 0x6a4a2a, 0x5a3a24], mail: [0x8a8a90, 0x7a7a84, 0x6a6a74] };
export const VENDOR_ITEMS = { 4: [], 10: [], 16: [] };
for (const type of ['cloth', 'leather', 'mail']) {
  for (const tier of [4, 10, 16]) {
    const mat = VENDOR_SETS[type][tier];
    for (const slot of Object.keys(SLOT_WORDS[type])) {
      const id = `v_${type}_${slot}_${tier}`;
      const col = ARMOR_COLORS[type][tier === 4 ? 0 : tier === 10 ? 1 : 2];
      defArmor(id, `${mat} ${SLOT_WORDS[type][slot]}`, slot, type, tier + 1, 1, {}, { req: tier, color: col, robe: type === 'cloth' && slot === 'chest' });
      VENDOR_ITEMS[tier].push(id);
    }
  }
}
const VW = [
  ['sword', 'Shortsword', 'Broadsword', 'Cutlass'], ['axe', 'Hatchet', 'Hand Axe', 'Bearded Axe'], ['mace', 'Cudgel', 'Flanged Mace', 'Warhammer'],
  ['dagger', 'Stiletto', 'Dirk', 'Kris'], ['staff', 'Quarterstaff', 'Walking Staff', 'Oak Staff'], ['sword2h', 'Claymore', 'Greatsword', 'Zweihander'],
  ['axe2h', 'Woodsman Axe', 'Battle Axe', 'Greataxe'], ['mace2h', 'Maul', 'Sledge', 'War Maul'], ['bow', 'Hunting Bow', 'Recurve Bow', 'Longbow'],
  ['gun', 'Flintlock', 'Blunderbuss', 'Hand Cannon'], ['polearm', 'Pike', 'Halberd', 'Glaive'], ['fist', 'Knuckles', 'Hand Claw', 'Spiked Knuckles'],
];
for (const [t, a, b, c] of VW) {
  [[4, a], [10, b], [16, c]].forEach(([tier, n]) => {
    const id = `v_${t}_${tier}`;
    defWeapon(id, n, t, tier + 1, 1, {}, { req: tier, color: 0xb0b4bc });
    VENDOR_ITEMS[tier].push(id);
  });
}
defArmor('v_shield_4', 'Wooden Shield', 'offhand', 'shield', 5, 1, {}, { req: 4, color: 0x7a5a3a }); VENDOR_ITEMS[4].push('v_shield_4');
defArmor('v_shield_10', 'Reinforced Targe', 'offhand', 'shield', 11, 1, {}, { req: 10, color: 0x6a6a74 }); VENDOR_ITEMS[10].push('v_shield_10');
defArmor('v_shield_16', 'Iron Heater Shield', 'offhand', 'shield', 17, 1, {}, { req: 16, color: 0x7a7a84 }); VENDOR_ITEMS[16].push('v_shield_16');

// ---------- junk drops ----------
const junk = (id, name, price, icon = 'junk') => defItem(id, name, { q: 0, type: 'junk', stack: 10, price, icon });
junk('rat_tail', 'Ratty Tail', 3, 'tail'); junk('cracked_shell', 'Cracked Weevil Shell', 4, 'shell'); junk('broken_fang', 'Broken Fang', 6, 'fang');
junk('torn_burlap', 'Torn Burlap Scrap', 5, 'cloth'); junk('straw_tuft', 'Tuft of Moldy Straw', 4, 'straw'); junk('chipped_claw', 'Chipped Claw', 8, 'fang');
junk('crab_leg', 'Spindly Crab Leg', 6, 'tail'); junk('matted_fur', 'Matted Fur', 12, 'leather'); junk('silk_strand', 'Sticky Silk Strand', 18, 'cloth');
junk('splintered_bark', 'Splintered Bark', 14, 'straw'); junk('fish_scale', 'Slimy Scale', 22, 'shell'); junk('croc_tooth', 'Crocolisk Tooth', 30, 'fang');
junk('soggy_cloth', 'Soggy Rag', 26, 'cloth'); junk('ogre_tooth', 'Ogre Tooth', 45, 'fang'); junk('ash_shard', 'Smoldering Shard', 40, 'ore');
junk('bone_chip', 'Bone Chip', 38, 'bone'); junk('dusty_tome', 'Dusty Tome Page', 50, 'scroll'); junk('tarnished_ring', 'Tarnished Copper Ring', 35, 'ring');

// ---------- random green generator ----------
export const SUFFIXES = {
  bear: { name: 'of the Bear', stats: ['str', 'sta'] }, eagle: { name: 'of the Eagle', stats: ['sta', 'int'] },
  monkey: { name: 'of the Monkey', stats: ['agi', 'sta'] }, owl: { name: 'of the Owl', stats: ['int', 'spi'] },
  tiger: { name: 'of the Tiger', stats: ['str', 'agi'] }, whale: { name: 'of the Whale', stats: ['sta', 'spi'] },
  falcon: { name: 'of the Falcon', stats: ['agi', 'int'] }, gorilla: { name: 'of the Gorilla', stats: ['str', 'int'] },
  boar: { name: 'of the Boar', stats: ['str', 'spi'] }, wolf: { name: 'of the Wolf', stats: ['agi', 'spi'] },
  strength: { name: 'of Strength', stats: ['str'] }, agility: { name: 'of Agility', stats: ['agi'] },
  stamina: { name: 'of Stamina', stats: ['sta'] }, intellect: { name: 'of Intellect', stats: ['int'] }, spirit: { name: 'of Spirit', stats: ['spi'] },
  power: { name: 'of Power', stats: ['ap'] }, sorcery: { name: 'of Sorcery', stats: ['sp'] }, healing: { name: 'of Healing', stats: ['heal'] },
};
const GEN_MAT = {
  cloth: [['Linen', 'Frayed'], ['Woolen', 'Embroidered'], ['Silken', 'Mystic']],
  leather: [['Rawhide', 'Scouting'], ['Wolfhide', 'Thornhide'], ['Ridgeback', 'Emberhide']],
  mail: [['Chainlink', 'Riveted'], ['Ringmail', 'Banded'], ['Scalemail', 'Ironclad']],
};
const GEN_SLOT = {
  cloth: { chest: ['Robe', 'Tunic'], legs: ['Leggings', 'Pants'], head: ['Hood', 'Circlet'], shoulder: ['Mantle', 'Amice'], feet: ['Sandals', 'Slippers'], hands: ['Gloves', 'Handwraps'], waist: ['Cord', 'Sash'], wrist: ['Cuffs', 'Bindings'], back: ['Cloak', 'Cape'] },
  leather: { chest: ['Tunic', 'Jerkin'], legs: ['Breeches', 'Pants'], head: ['Cap', 'Helm'], shoulder: ['Shoulderpads', 'Spaulders'], feet: ['Boots', 'Treads'], hands: ['Gloves', 'Grips'], waist: ['Belt', 'Girdle'], wrist: ['Bracers', 'Wristguards'], back: ['Cloak', 'Cape'] },
  mail: { chest: ['Hauberk', 'Vest'], legs: ['Leggings', 'Legguards'], head: ['Coif', 'Helm'], shoulder: ['Pauldrons', 'Mantle'], feet: ['Sabatons', 'Greaves'], hands: ['Gauntlets', 'Grips'], waist: ['Girdle', 'Waistband'], wrist: ['Bracers', 'Vambraces'], back: ['Cloak', 'Cape'] },
};
const GEN_WEAPON = {
  sword: ['Blade', 'Sabre', 'Longsword'], axe: ['Axe', 'Cleaver', 'Hatchet'], mace: ['Mace', 'Hammer', 'Morningstar'], dagger: ['Dagger', 'Knife', 'Shiv'],
  staff: ['Staff', 'Spire', 'Crook'], sword2h: ['Greatsword', 'Claymore', 'Bastard Sword'], axe2h: ['Greataxe', 'Reaver', 'Executioner'], mace2h: ['Maul', 'Bludgeon', 'Warhammer'],
  bow: ['Shortbow', 'Recurve', 'Longbow'], gun: ['Rifle', 'Musket', 'Blunderbuss'], wand: ['Wand', 'Rod', 'Scepter'], polearm: ['Spear', 'Halberd', 'Glaive'], fist: ['Claw', 'Knuckles', 'Fang'],
};
const GEN_WMAT = [['Sturdy', 'Bronze', 'Thornwood'], ['Tempered', 'Keen', 'Brigand'], ['Ashen', 'Runed', 'Gleaming']];
const JEWEL = { neck: [['Pendant', 'Choker'], ['Amulet', 'Necklace']], finger: [['Band', 'Ring'], ['Signet', 'Loop']] };
const JEWEL_MAT = [['Copper', 'Bone'], ['Silver', 'Jade'], ['Moonstone', 'Golden']];

// Deterministic random green from a seed so saves only need the seed.
export function genItem(seed, ilvl, q = 2) {
  const R = rng(seed);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const tier = ilvl <= 8 ? 0 : ilvl <= 15 ? 1 : 2;
  const roll = R();
  let suffixKey = pick(Object.keys(SUFFIXES));
  const id = `gen_${seed}_${ilvl}_${q}`;
  if (ITEMS[id]) return ITEMS[id];
  const kind = roll < 0.62 ? 'armor' : roll < 0.88 ? 'weapon' : 'jewel';
  let def;
  if (kind === 'weapon') {
    const wt = pick(Object.keys(GEN_WEAPON));
    if (wt === 'wand' || wt === 'staff') suffixKey = pick(['owl', 'eagle', 'intellect', 'spirit', 'sorcery', 'healing', 'falcon']);
    const n = `${pick(GEN_WMAT[tier])} ${pick(GEN_WEAPON[wt])} ${SUFFIXES[suffixKey].name}`;
    const stats = budgetStats(suffixKey, ilvl, q, TWO_HAND.has(wt) ? 1.2 : wt === 'wand' || RANGED.has(wt) ? 0.4 : 0.6);
    def = defWeapon(id, n, wt, ilvl, q, stats, { color: [0xb8bcc4, 0xc8b070, 0x9ab0c8][tier], school: wt === 'wand' ? pick(['arcane', 'fire', 'frost', 'shadow']) : undefined });
  } else if (kind === 'jewel') {
    const slot = R() < 0.5 ? 'neck' : 'finger';
    const n = `${pick(JEWEL_MAT[tier])} ${pick(JEWEL[slot][tier >= 1 ? 1 : 0])} ${SUFFIXES[suffixKey].name}`;
    def = defArmor(id, n, slot, 'jewel', ilvl, q, budgetStats(suffixKey, ilvl, q, 0.55));
  } else {
    const type = pick(['cloth', 'leather', 'mail']);
    const slot = pick(Object.keys(GEN_SLOT[type]));
    if (type === 'cloth') suffixKey = pick(['owl', 'eagle', 'intellect', 'spirit', 'whale', 'sorcery', 'healing', 'stamina', 'falcon']);
    const n = `${pick(GEN_MAT[type][tier])} ${pick(GEN_SLOT[type][slot])} ${SUFFIXES[suffixKey].name}`;
    def = defArmor(id, n, slot, slot === 'back' ? 'cloth' : type, ilvl, q, budgetStats(suffixKey, ilvl, q, SLOT_W[slot]), {
      color: (ARMOR_COLORS[type][tier] + Math.floor(R() * 0x101010)) & 0xffffff, robe: type === 'cloth' && slot === 'chest' && R() < 0.6,
    });
  }
  def.generated = true;
  def.seed = seed;
  return def;
}
export function budgetStats(suffixKey, ilvl, q, w) {
  const sfx = SUFFIXES[suffixKey];
  let budget = Math.max(1, Math.round((ilvl * 0.55 + 1.5) * w * (q === 2 ? 1 : q === 3 ? 1.35 : 1.7)));
  const out = {};
  if (sfx.stats.length === 1) {
    const s = sfx.stats[0];
    out[s] = s === 'ap' ? budget * 2 : s === 'sp' ? Math.max(1, Math.round(budget * 0.85)) : s === 'heal' ? budget * 2 : budget;
  } else {
    const a = Math.ceil(budget / 2), b = Math.max(1, budget - a);
    out[sfx.stats[0]] = a; out[sfx.stats[1]] = b;
  }
  return out;
}

// Resolve an item instance ({id} or a generated id) to its template.
export function getItem(id) {
  if (ITEMS[id]) return ITEMS[id];
  if (typeof id === 'string' && id.startsWith('gen_')) {
    const [, seed, ilvl, q] = id.split('_');
    return genItem(+seed, +ilvl, +q);
  }
  return null;
}

export const EQUIP_COLORS = ARMOR_COLORS;
