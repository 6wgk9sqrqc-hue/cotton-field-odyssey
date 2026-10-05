// Friendly characters: quest givers, vendors, trainers, innkeepers, guards.
import { VENDOR_ITEMS } from './items.js';

const S = [0xf0c8a0, 0xe0b48c, 0xc8956a, 0x9a6a48, 0x6a4a34];
const H = [0x2a1e14, 0x5a3a1e, 0xa0702a, 0xd8c070, 0xb03a1a, 0xe8e8e8];
const look = (skin, hair, o = {}) => ({ t: 'human', skin: S[skin], hair: H[hair], hairStyle: o.hs ?? 0, ...o });
const guardLook = (tabard = 0x2a4a8a) => look(1, 0, { shirt: 0x8a8a94, chestTrim: tabard, pants: 0x5a5a64, boots: 0x3a3a3a, helm: { type: 'plate', color: 0x9a9aa4, crest: tabard }, shoulders: 0x9a9aa4, weapon: { type: 'polearm', color: 0xb8bcc4 }, offhand: { type: 'shield', color: tabard }, cape: tabard });

const GENERAL = ['tough_jerky', 'cottonvale_bread', 'spring_water', 'small_pouch', 'rough_arrow', 'flash_powder', 'pet_food', 'linen_bandage'];
const GENERAL2 = ['haunch_of_meat', 'honey_bun', 'ice_cold_milk', 'woolen_bag', 'rough_arrow', 'sharp_arrow', 'pet_food', 'flash_powder', 'linen_bandage', 'wool_bandage', 'minor_healing_potion', 'lesser_healing_potion', 'minor_mana_potion'];
const GENERAL3 = ['mutton_chop', 'moist_cornbread', 'melon_juice', 'haunch_of_meat', 'ice_cold_milk', 'woolen_bag', 'sharp_arrow', 'pet_food', 'flash_powder', 'wool_bandage', 'lesser_healing_potion', 'healing_potion', 'lesser_mana_potion', 'elixir_lions_strength', 'elixir_minor_agility', 'elixir_minor_fortitude', 'elixir_wisdom'];

export const NPCS = [
  // ---------------- Millbrook ----------------
  { id: 'edda', name: 'Marshal Edda Brightfield', title: 'Vale Wardens', x: 40, z: 286, facing: 0, quests: true,
    m: look(1, 3, { hs: 1, shirt: 0x8a8a94, chestTrim: 0x2a4a8a, pants: 0x4a4a54, helm: null, shoulders: 0x9a9aa4, cape: 0x2a4a8a, weapon: { type: 'sword', color: 0xd0d4dc } }),
    gossip: 'The harvest won\'t gather itself, recruit, and neither will the Vale defend itself. Speak quickly.' },
  { id: 'tobias', name: 'Farmer Tobias Hollin', x: -4, z: 300, facing: 1.6, quests: true,
    m: look(2, 1, { shirt: 0x9a8a5a, pants: 0x5a6a8a, helm: { type: 'strawhat', color: 0xd8b860 } }),
    gossip: 'Weevils in the wheat, bandits in the barn, and blight in the Hargrove fields. Some years I wonder why I bother.' },
  { id: 'wilm', name: 'Old Wilm Hargrove', x: 58, z: 278, facing: -1.6, quests: true,
    m: look(0, 5, { shirt: 0x6a5a4a, pants: 0x4a4a3a, beard: 0xe8e8e8, hunch: 0.2 }),
    gossip: 'Forty years I worked that farm. Forty years. Then the scarecrows got up and walked.' },
  { id: 'rosie', name: 'Rosalind Pell', title: 'Innkeeper', x: 20, z: 287, facing: 0, quests: true, innkeeper: true, vendor: ['tough_jerky', 'cottonvale_bread', 'spring_water', 'ice_cold_milk', 'honey_bun'],
    m: look(1, 4, { hs: 1, shirt: 0xa04a3a, pants: 0x5a3a2a }),
    gossip: 'Welcome to the Golden Boll! A warm bed, a cold drink, and the best rye this side of the Vale.' },
  { id: 'bram', name: 'Bram Copperkettle', title: 'General Goods', x: 47, z: 296, facing: -1.6, quests: true, vendor: GENERAL,
    m: look(2, 2, { shirt: 0x3a6a9a, pants: 0x4a3a2a, beard: 0xa0702a }) },
  { id: 'hilda', name: 'Hilda Stonehand', title: 'Armorer & Weaponsmith', x: 33, z: 306, facing: 1.6, quests: true, repair: true, vendor: VENDOR_ITEMS[4],
    m: look(3, 0, { hs: 2, shirt: 0x5a4a3a, chestTrim: 0x2a2a2a, pants: 0x3a3a3a, bareArms: true, weapon: { type: 'mace', color: 0x6a6a6a } }) },
  { id: 'corwin', name: 'Corwin Skyhollow', title: 'Flight Master', x: 76, z: 288, facing: -1.6, flight: 'fp_millbrook',
    m: look(1, 2, { shirt: 0x6a7a9a, pants: 0x4a4a5a, cape: 0x8a6a3a, helm: { type: 'hood', color: 0x6a7a9a } }) },
  { id: 'petri', name: 'Old Petri', title: 'Fisherman', x: 66, z: 508, facing: 3.1, quests: true,
    m: look(2, 5, { shirt: 0x4a6a6a, pants: 0x3a3a3a, beard: 0xd0d0d0, helm: { type: 'strawhat', color: 0x8a7a50 } }) },
  // class trainers outside the Trainers' Hall
  { id: 't_warrior', name: 'Garrok Ironhide', title: 'Warrior Trainer', x: 54, z: 310, facing: -1.6, trainer: 'warrior', m: look(3, 0, { shirt: 0x7a7a84, pants: 0x4a3a2a, shoulders: 0x8a8a90, weapon: { type: 'axe2h', color: 0xb8bcc4 } }) },
  { id: 't_paladin', name: 'Brother Anselm', title: 'Paladin Trainer', x: 52, z: 314, facing: -1.6, trainer: 'paladin', m: look(0, 3, { shirt: 0xc8b070, chestTrim: 0xe8e0c0, pants: 0x6a6a7a, shoulders: 0xd8c890, weapon: { type: 'mace2h', color: 0xd8c890 } }) },
  { id: 't_hunter', name: 'Ranger Sela Thorne', title: 'Hunter Trainer', x: 51, z: 318, facing: -1.6, trainer: 'hunter', m: look(1, 2, { hs: 1, shirt: 0x5a7a3a, pants: 0x4a3a2a, offhand: { type: 'bow' }, cape: 0x3a5a2a }) },
  { id: 't_rogue', name: 'Nix Quietstep', title: 'Rogue Trainer', x: 51, z: 322, facing: -1.6, trainer: 'rogue', m: look(2, 0, { shirt: 0x2a2a30, pants: 0x1a1a20, helm: { type: 'hood', color: 0x2a2a30 }, weapon: { type: 'dagger' }, offhand: { type: 'dagger' } }) },
  { id: 't_priest', name: 'Sister Amelie', title: 'Priest Trainer', x: 52, z: 326, facing: -1.6, trainer: 'priest', m: look(0, 3, { hs: 1, shirt: 0xe8e4d8, robe: 0xe8e4d8, chestTrim: 0xc8a040, weapon: { type: 'staff', glow: 0xfff0a0 } }) },
  { id: 't_shaman', name: 'Elder Tamsin Rainhide', title: 'Shaman Trainer', x: 54, z: 330, facing: -1.6, trainer: 'shaman', m: look(4, 0, { hs: 3, shirt: 0x3a5a7a, pants: 0x5a4a3a, beard: 0x2a1e14, weapon: { type: 'mace', color: 0x8a6a3a }, offhand: { type: 'shield', color: 0x5a3a2a } }) },
  { id: 't_mage', name: 'Magister Olwen', title: 'Mage Trainer', x: 46, z: 324, facing: -1.6, trainer: 'mage', m: look(0, 5, { shirt: 0x4a3a8a, robe: 0x4a3a8a, helm: { type: 'hat', color: 0x3a2a7a }, beard: 0xe8e8e8, weapon: { type: 'staff', glow: 0x80c0ff } }) },
  { id: 't_warlock', name: 'Morgana Vey', title: 'Warlock Trainer', x: 46, z: 316, facing: -1.6, trainer: 'warlock', m: look(1, 0, { hs: 1, shirt: 0x4a1a2a, robe: 0x4a1a2a, horns: 0x2a1a1a, weapon: { type: 'staff', glow: 0x60ff40 } }) },
  { id: 't_druid', name: 'Fernwick Oakshade', title: 'Druid Trainer', x: 46, z: 320, facing: -1.6, trainer: 'druid', m: look(2, 1, { hs: 3, shirt: 0x5a6a3a, pants: 0x4a3a2a, antlers: true, ears: 'long', weapon: { type: 'staff', glow: 0x80ff60 } }) },
  { id: 'g_mb1', name: 'Vale Warden', guard: true, x: 30, z: 255, facing: Math.PI, m: guardLook() },
  { id: 'g_mb2', name: 'Vale Warden', guard: true, x: 50, z: 255, facing: Math.PI, m: guardLook() },
  { id: 'g_mb3', name: 'Vale Warden', guard: true, x: 95, z: 318, facing: Math.PI / 2, m: guardLook() },
  { id: 'g_mb4', name: 'Vale Warden', guard: true, x: -15, z: 330, facing: -Math.PI / 2, m: guardLook() },
  { id: 'g_mb5', name: 'Vale Warden', guard: true, x: 50, z: 345, facing: 0, m: guardLook() },

  // ---------------- Thornhaven ----------------
  { id: 'fenna', name: 'Warden Fenna Ashgrove', title: 'Thornhaven Watch', x: -326, z: 26, facing: 0.6, quests: true,
    m: look(1, 4, { hs: 1, shirt: 0x3a5a3a, chestTrim: 0x8a6a3a, pants: 0x3a3a2a, cape: 0x2a4a2a, offhand: { type: 'bow' }, ears: 'long' }) },
  { id: 'yanna', name: 'Herbalist Yanna', x: -318, z: 18, facing: 0, quests: true,
    m: look(0, 3, { hs: 1, shirt: 0x7a9a5a, pants: 0x5a4a3a, helm: { type: 'hood', color: 0x5a7a3a } }) },
  { id: 'dorrin', name: 'Dorrin Mossbrew', title: 'Innkeeper', x: -339, z: 18, facing: Math.PI / 2, quests: true, innkeeper: true, vendor: ['haunch_of_meat', 'honey_bun', 'ice_cold_milk', 'tough_jerky', 'spring_water'],
    m: look(2, 1, { shirt: 0x8a5a3a, pants: 0x4a3a2a, beard: 0x5a3a1e, bulk: 1.2 }) },
  { id: 'tibbit', name: 'Tibbit Quickfingers', title: 'General Goods', x: -322, z: 26, facing: -1.6, vendor: GENERAL2,
    m: look(1, 2, { shirt: 0x6a4a7a, pants: 0x3a3a3a, scale: 0.85 }) },
  { id: 'leaf', name: 'Garrick Ironleaf', title: 'Armorer & Weaponsmith', x: -315, z: 18, facing: 0, repair: true, vendor: VENDOR_ITEMS[10],
    m: look(3, 0, { shirt: 0x5a4a3a, pants: 0x3a3a3a, bareArms: true, beard: 0x2a1e14, weapon: { type: 'mace', color: 0x6a6a6a } }) },
  { id: 'lira', name: 'Lira Windwhistle', title: 'Flight Master', x: -308, z: 44, facing: -1, flight: 'fp_thornhaven',
    m: look(0, 3, { hs: 1, shirt: 0x6a8a9a, pants: 0x4a4a5a, cape: 0x8a6a3a }) },
  { id: 'mentor_th', name: 'Elder Moonshade', title: 'Mentor of All Paths', x: -344, z: 36, facing: Math.PI / 2, trainer: 'all',
    m: look(0, 5, { shirt: 0x5a5a8a, robe: 0x5a5a8a, beard: 0xe8e8e8, weapon: { type: 'staff', glow: 0xffffff } }) },
  { id: 'g_th1', name: 'Thornhaven Sentinel', guard: true, x: -300, z: 15, facing: Math.PI / 2, m: guardLook(0x2a5a2a) },
  { id: 'g_th2', name: 'Thornhaven Sentinel', guard: true, x: -360, z: 50, facing: -Math.PI / 2, m: guardLook(0x2a5a2a) },
  { id: 'g_th3', name: 'Thornhaven Sentinel', guard: true, x: -330, z: 58, facing: 0, m: guardLook(0x2a5a2a) },

  // ---------------- Brinewater ----------------
  { id: 'quill', name: 'Harbormaster Quill Brannigan', x: 366, z: 56, facing: 0, quests: true,
    m: look(2, 4, { shirt: 0x2a3a5a, pants: 0x3a3a3a, beard: 0xb03a1a, helm: { type: 'hat', color: 0x1a1a2a } }) },
  { id: 'ottilie', name: 'Fen-Warden Ottilie', x: 352, z: 64, facing: 1.6, quests: true,
    m: look(1, 1, { hs: 1, shirt: 0x4a5a3a, pants: 0x3a3a2a, cape: 0x3a4a2a, weapon: { type: 'polearm', color: 0x9a9aa0 } }) },
  { id: 'mags', name: 'Mags Saltbarrel', title: 'Innkeeper', x: 356, z: 48, facing: Math.PI / 2, quests: true, innkeeper: true, vendor: ['haunch_of_meat', 'ice_cold_milk', 'mutton_chop', 'melon_juice'],
    m: look(3, 5, { hs: 1, shirt: 0x7a4a3a, pants: 0x4a3a2a, bulk: 1.15 }) },
  { id: 'hux', name: 'Peddler Hux', title: 'General Goods', x: 372, z: 48, facing: -1.6, quests: true, vendor: GENERAL2,
    m: look(1, 2, { shirt: 0x6a6a3a, pants: 0x4a3a2a, helm: { type: 'strawhat', color: 0x9a8a50 } }) },
  { id: 'brindle', name: 'Brindle Hammerhand', title: 'Armorer & Weaponsmith', x: 372, z: 70, facing: Math.PI, repair: true, vendor: VENDOR_ITEMS[10],
    m: look(3, 0, { shirt: 0x4a4a4a, pants: 0x3a3a3a, bareArms: true, beard: 0x5a3a1e, bulk: 1.2, scale: 0.9 }) },
  { id: 'brine_fm', name: 'Gull Mavery', title: 'Flight Master', x: 382, z: 84, facing: 0, flight: 'fp_brinewater',
    m: look(2, 3, { shirt: 0x5a7a8a, pants: 0x4a4a5a }) },
  { id: 'mentor_bw', name: 'Old Seer Callum', title: 'Mentor of All Paths', x: 346, z: 70, facing: 1.6, trainer: 'all',
    m: look(2, 5, { shirt: 0x3a5a6a, robe: 0x3a5a6a, beard: 0xe8e8e8, weapon: { type: 'staff', glow: 0x80c0ff } }) },
  { id: 'g_bw1', name: 'Brinewater Militia', guard: true, x: 340, z: 40, facing: -2, m: guardLook(0x2a5a6a) },
  { id: 'g_bw2', name: 'Brinewater Militia', guard: true, x: 385, z: 40, facing: 2, m: guardLook(0x2a5a6a) },

  // ---------------- Dawnwatch Keep ----------------
  { id: 'aldric', name: 'Commander Aldric Vane', title: 'Dawnwatch Garrison', x: -62, z: -309, facing: 0, quests: true,
    m: look(1, 5, { shirt: 0x8a8a94, chestTrim: 0x8a2a2a, pants: 0x4a4a54, shoulders: 0xa0a0a8, cape: 0x8a2a2a, beard: 0xd0d0d0, weapon: { type: 'sword2h', color: 0xd0d4dc } }) },
  { id: 'ilsa', name: 'Quartermaster Ilsa', x: -50, z: -296, facing: -1.6, quests: true, repair: true, vendor: VENDOR_ITEMS[16],
    m: look(0, 4, { hs: 1, shirt: 0x6a5a4a, pants: 0x3a3a3a, chestTrim: 0x8a2a2a }) },
  { id: 'thalen', name: 'Sage Thalen', x: -72, z: -300, facing: 1.6, quests: true,
    m: look(0, 5, { shirt: 0x6a3a6a, robe: 0x6a3a6a, beard: 0xe8e8e8, helm: { type: 'hat', color: 0x4a2a4a }, weapon: { type: 'staff', glow: 0xd0a0ff } }) },
  { id: 'barnaby', name: 'Barnaby Coalfoot', title: 'Innkeeper', x: -70, z: -286, facing: Math.PI / 2, innkeeper: true, vendor: GENERAL3,
    m: look(2, 1, { shirt: 0x6a4a2a, pants: 0x3a3a3a, beard: 0x5a3a1e, scale: 0.88, bulk: 1.2 }) },
  { id: 'dawn_fm', name: 'Skyrider Bren', title: 'Flight Master', x: -44, z: -282, facing: -2, flight: 'fp_dawnwatch',
    m: look(1, 0, { shirt: 0x6a7a9a, pants: 0x4a4a5a, cape: 0x8a2a2a }) },
  { id: 'mentor_dw', name: 'Battlemage Corra', title: 'Mentor of All Paths', x: -56, z: -284, facing: 3, trainer: 'all',
    m: look(1, 4, { hs: 1, shirt: 0x8a2a2a, robe: 0x8a2a2a, weapon: { type: 'staff', glow: 0xff8040 } }) },
  { id: 'g_dw1', name: 'Dawnwatch Soldier', guard: true, x: -60, z: -262, facing: 0, m: guardLook(0x8a2a2a) },
  { id: 'g_dw2', name: 'Dawnwatch Soldier', guard: true, x: -48, z: -262, facing: 0, m: guardLook(0x8a2a2a) },
  { id: 'g_dw3', name: 'Dawnwatch Soldier', guard: true, x: -26, z: -300, facing: Math.PI / 2, m: guardLook(0x8a2a2a) },
  { id: 'g_dw4', name: 'Dawnwatch Soldier', guard: true, x: -44, z: -338, facing: Math.PI, m: guardLook(0x8a2a2a) },

  // ---------------- Spire Gate camp ----------------
  { id: 'mira', name: 'Scout Mira Dusk', title: 'Dawnwatch Scouts', x: 60, z: -480, facing: Math.PI, quests: true,
    m: look(1, 0, { hs: 1, shirt: 0x3a3a4a, pants: 0x2a2a3a, helm: { type: 'hood', color: 0x3a3a4a }, offhand: { type: 'bow' }, cape: 0x2a2a3a }) },
  { id: 'holt', name: 'Captain Holt', title: 'Sellswords for Hire', x: 70, z: -476, facing: Math.PI, hire: true,
    m: look(3, 1, { shirt: 0x7a6a5a, chestTrim: 0x3a3a3a, pants: 0x4a3a2a, shoulders: 0x6a6a70, beard: 0x5a3a1e, weapon: { type: 'sword', color: 0xb8bcc4 }, offhand: { type: 'shield', color: 0x5a4a3a } }),
    gossip: 'The Spire eats lone heroes for breakfast. My sellswords will walk in with you, free of charge, if it means that tower falls.' },
];

// The spirit healer appears at every graveyard but only to the dead.
export const SPIRIT_HEALER = { name: 'Spirit Healer', m: { t: 'human', skin: 0xc8e0ff, headColor: 0xc8e0ff, shirt: 0xc8e0ff, robe: 0xc8e0ff, hair: 0xffffff, hairStyle: 1, glow: 0xa0c8ff, ghost: true, floating: true, scale: 1.3 } };
