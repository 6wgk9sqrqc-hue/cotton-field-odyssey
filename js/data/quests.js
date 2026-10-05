// Questlines for Cottonvale, Whisperwood, Saltmarsh Fen, Ashen Ridge and the Hollow Spire.
import { defItem, defArmor, defWeapon } from './items.js';

export const QUESTS = {};
const Q = (q) => { q.minLevel ??= Math.max(1, q.level - 2); q.turnin ??= q.giver; QUESTS[q.id] = q; return q; };
const qi = (id, name, icon = 'sack') => defItem(id, name, { type: 'quest', stack: 20, quest: true, icon, q: 1 });
const A = (id, name, slot, type, ilvl, q, stats, color, extra) => defArmor(id, name, slot, type, ilvl, q, stats, { color, ...extra });
const W = (id, name, wtype, ilvl, q, stats, color, extra) => defWeapon(id, name, wtype, ilvl, q, stats, { color, ...extra });

// ---------- quest items ----------
qi('weevil_carapace', 'Weevil Carapace', 'shell');
qi('tidecrawler_claw', 'Tidecrawler Claw', 'claw');
qi('stolen_seed', 'Stolen Seed Sack', 'sack');
qi('razorback_hide', 'Razorback Hide', 'leather');
qi('strawhide_scythe', 'Strawhide\'s Rusted Scythe', 'axe');
qi('sweetroot', 'Sweetroot', 'leaf');
qi('wolf_pelt', 'Timber Wolf Pelt', 'leather');
qi('heartwood', 'Rootkin Heartwood', 'straw');
qi('venom_sac', 'Webweaver Venom Sac', 'poison');
qi('silkweave_fang', 'Fang of Matron Silkweave', 'fang');
qi('varn_orders', 'Varn\'s Sealed Orders', 'scroll');
qi('bear_haunch', 'Mossback Haunch', 'meat');
qi('glowcap', 'Glowcap', 'mushroom');
qi('mirefin_scale', 'Mirefin Scale', 'shell');
qi('mudjaw_tooth', 'Mudjaw Tooth', 'fang');
qi('lurker_core', 'Bog Lurker Core', 'ore');
qi('fishing_net', 'Waterlogged Net', 'net');
qi('hag_grimoire', 'Hag\'s Grimoire', 'book');
qi('grimgill_crown', 'Crown of King Grimgill', 'crown');
qi('cinder_totem', 'Cinder Totem', 'totem');
qi('ember_core', 'Ember Core', 'orb');
qi('ashen_ore', 'Chunk of Ashen Ore', 'ore');
qi('gorgak_tusk', 'Tusk of Gorgak Cinderhorn', 'fang');
qi('necro_focus', 'Necromantic Focus', 'orb');
qi('mortis_skull', 'Skull of Warden Mortis', 'skull');
qi('vexmire_phylactery', 'Vexmire\'s Phylactery', 'shard');
qi('kings_heart', 'Heart of the Hollow King', 'heart');

// ---------- reward gear ----------
// Cottonvale
A('millbrook_gloves', 'Millbrook Field Gloves', 'hands', 'leather', 5, 1, { sta: 1 }, 0x7a5a3a);
A('farmhand_sandals', 'Farmhand\'s Sandals', 'feet', 'cloth', 5, 1, { spi: 1 }, 0xb0a080);
A('warden_bracers', 'Recruit Warden Bracers', 'wrist', 'mail', 5, 1, { str: 1 }, 0x8a8a90);
W('weevil_crusher', 'Weevil-Crusher', 'mace', 6, 2, { str: 2 }, 0x8a7a5a);
W('coastline_dirk', 'Coastline Dirk', 'dagger', 6, 2, { agi: 2 }, 0xc0c8d0);
A('shellback_buckler', 'Shellback Buckler', 'offhand', 'shield', 6, 2, { sta: 2 }, 0xc0603a);
A('kelpwoven_cloak', 'Kelpwoven Cloak', 'back', 'cloth', 6, 2, { int: 1, spi: 1 }, 0x3a6a4a);
A('coyote_vest', 'Dustfang Hide Vest', 'chest', 'leather', 7, 2, { agi: 2, sta: 1 }, 0x9a7a4a);
A('militia_hauberk', 'Militia Chain Hauberk', 'chest', 'mail', 7, 2, { str: 2, sta: 1 }, 0x8a8a90);
A('harvest_robe', 'Harvest Festival Robe', 'chest', 'cloth', 7, 2, { int: 2, spi: 1 }, 0xc8a050, { robe: true });
W('bandit_cutlass', 'Burlap Cutlass', 'sword', 8, 2, { agi: 2, sta: 1 }, 0xa0a4ac);
W('seedcaller_staff', 'Seedcaller Staff', 'staff', 8, 2, { int: 3, spi: 2 }, 0x6a5a3a, { glow: 0xd0ff80 });
W('hayfork', 'Hargrove Hayfork', 'polearm', 8, 2, { str: 3, sta: 2 }, 0x9a9a9a);
A('scarecrow_boots', 'Straw-Stuffed Boots', 'feet', 'leather', 8, 2, { sta: 2, agi: 1 }, 0x8a6a40);
A('wardens_belt', 'Warden\'s Leather Belt', 'waist', 'leather', 7, 2, { str: 1, sta: 2 }, 0x6a4a2a);
A('blightbane_mantle', 'Blightbane Mantle', 'shoulder', 'cloth', 9, 2, { int: 2, spi: 2 }, 0x6a8a3a);
A('strawhide_pauldrons', 'Strawhide Pauldrons', 'shoulder', 'mail', 9, 2, { str: 2, sta: 2 }, 0x9a8a5a);
A('scythe_leggings', 'Reaper\'s Leggings', 'legs', 'leather', 9, 2, { agi: 3, sta: 1 }, 0x5a4a3a);
A('petri_ring', 'Petri\'s Lucky Hook', 'finger', 'jewel', 8, 2, { sta: 2, spi: 1 });
// Whisperwood
A('pelt_hood', 'Wolfpelt Hood', 'head', 'leather', 10, 2, { agi: 3, sta: 2 }, 0x6a6a70);
A('ranger_greaves', 'Thornhaven Ranger Greaves', 'feet', 'mail', 10, 2, { str: 2, sta: 3 }, 0x7a7a6a);
A('mossweave_gloves', 'Mossweave Gloves', 'hands', 'cloth', 10, 2, { int: 2, spi: 2 }, 0x5a7a3a);
W('rootsplitter', 'Rootsplitter', 'axe2h', 11, 2, { str: 5, sta: 2 }, 0x8a8a8a);
W('heartwood_wand', 'Heartwood Wand', 'wand', 11, 2, { int: 2 }, 0x6a4a2a, { school: 'nature' });
W('stalker_fang', 'Stalker\'s Fang', 'dagger', 11, 2, { agi: 3, sta: 1 }, 0xe0e0d0);
A('silkspun_robe', 'Silkspun Robe', 'chest', 'cloth', 12, 2, { int: 4, spi: 3 }, 0xd0d0e0, { robe: true });
A('webbed_jerkin', 'Webbed Jerkin', 'chest', 'leather', 12, 2, { agi: 4, sta: 3 }, 0x5a5a4a);
A('broodguard_vest', 'Broodguard Vest', 'chest', 'mail', 12, 2, { str: 4, sta: 3 }, 0x6a6a5a);
W('matron_fang_blade', 'Silkweave Stinger', 'sword', 13, 3, { agi: 4, sta: 3 }, 0x60ff60, { bop: true });
W('matron_staff', 'Broodmother\'s Spire', 'staff', 13, 3, { int: 5, spi: 4, sta: 2 }, 0x4a2a4a, { glow: 0xff2060, bop: true });
W('matron_maul', 'Webcrusher Maul', 'mace2h', 13, 3, { str: 6, sta: 4 }, 0x5a3a5a, { bop: true });
A('cultbane_bracers', 'Cultbane Bracers', 'wrist', 'leather', 11, 2, { agi: 2, sta: 2 }, 0x4a2a5a);
A('acolyte_sash', 'Purloined Acolyte Sash', 'waist', 'cloth', 11, 2, { int: 2, sta: 2 }, 0x4a2a5a);
A('idolbreaker_gauntlets', 'Idolbreaker Gauntlets', 'hands', 'mail', 11, 2, { str: 3, sta: 2 }, 0x6a6a74);
A('varn_signet', 'Varn\'s Signet', 'finger', 'jewel', 12, 2, { int: 3, sta: 2 });
A('thornhaven_cape', 'Thornhaven Cloak', 'back', 'cloth', 12, 2, { agi: 2, sta: 3 }, 0x2a4a2a);
A('bear_hide_pants', 'Mossback Hide Pants', 'legs', 'leather', 12, 2, { sta: 4, str: 2 }, 0x4a3a28);
A('glowcap_pendant', 'Glowcap Pendant', 'neck', 'jewel', 11, 2, { int: 2, spi: 3 });
A('greyback_mantle', 'Greyback Mantle', 'shoulder', 'leather', 12, 2, { agi: 3, sta: 3 }, 0x9a9aa0);
// Saltmarsh
A('mirefin_boots', 'Mirefin Waders', 'feet', 'leather', 14, 2, { agi: 3, sta: 3 }, 0x4a6a5a);
A('scalemail_leggings', 'Brinewater Scalemail Leggings', 'legs', 'mail', 14, 2, { str: 4, sta: 4 }, 0x6a7a74);
A('saltwoven_pants', 'Saltwoven Trousers', 'legs', 'cloth', 14, 2, { int: 4, spi: 3 }, 0x3a5a6a);
W('crocjaw_cleaver', 'Crocjaw Cleaver', 'axe', 15, 2, { str: 3, sta: 3 }, 0x7a7a6a);
W('tidecaller_rod', 'Tidecaller Rod', 'wand', 15, 2, { int: 3, spi: 1 }, 0x3a6a8a, { school: 'frost' });
W('harpoon_gun', 'Harbor Harpoon Gun', 'gun', 15, 2, { agi: 3, sta: 2 }, 0x5a5a5a);
A('lurker_shield', 'Bogwood Shield', 'offhand', 'shield', 15, 2, { sta: 4, str: 2 }, 0x4a5a2a);
A('netweaver_gloves', 'Netweaver Gloves', 'hands', 'leather', 14, 2, { agi: 3, sta: 2 }, 0x6a5a3a);
A('hagspell_hood', 'Hag-Hexed Hood', 'head', 'cloth', 15, 2, { int: 4, spi: 3 }, 0x2a3a2a);
A('kings_bane_helm', 'Murkslayer Helm', 'head', 'mail', 16, 2, { str: 5, sta: 4 }, 0x7a7a6a);
A('kelpfin_tunic', 'Kelpfin Tunic', 'chest', 'leather', 16, 2, { agi: 5, sta: 4 }, 0x3a6a5a);
W('grimgill_trident', 'Grimgill\'s Trident', 'polearm', 17, 3, { str: 7, sta: 5 }, 0xd8b040, { bop: true });
W('grimgill_scepter', 'Scepter of the Deep', 'mace', 17, 3, { int: 5, spi: 3, sta: 3 }, 0x3a8aaa, { bop: true });
W('brack_cutlass', 'Brack\'s Barnacled Cutlass', 'sword', 17, 3, { agi: 5, sta: 4 }, 0x9aa0a0, { bop: true });
A('drowned_bracers', 'Drowned Man\'s Bracers', 'wrist', 'mail', 16, 2, { str: 3, sta: 3 }, 0x5a6a6a);
A('captains_coat', 'Captain\'s Greatcoat', 'chest', 'cloth', 17, 3, { int: 6, spi: 5, sta: 3 }, 0x2a3a5a, { robe: true, bop: true });
// Ashen Ridge
A('ogrehide_belt', 'Ogrehide Belt', 'waist', 'leather', 17, 2, { str: 3, sta: 4 }, 0x7a5a4a);
A('emberweave_cuffs', 'Emberweave Cuffs', 'wrist', 'cloth', 17, 2, { int: 3, spi: 3 }, 0xa04a2a);
A('dawnwatch_girdle', 'Dawnwatch Girdle', 'waist', 'mail', 17, 2, { str: 4, sta: 3 }, 0x8a2a2a);
W('drakefang_spear', 'Drakefang Spear', 'polearm', 18, 2, { agi: 5, sta: 4 }, 0xd0c0a0);
W('cinder_wand', 'Wand of Cinders', 'wand', 18, 2, { int: 4 }, 0xff6020, { school: 'fire' });
W('golemfist', 'Ashstone Knuckles', 'fist', 18, 2, { str: 3, agi: 3 }, 0x5a5452);
A('ashen_mantle', 'Ashen Mantle', 'shoulder', 'cloth', 18, 2, { int: 4, spi: 4 }, 0x5a4a4a);
A('drake_scale_spaulders', 'Drakescale Spaulders', 'shoulder', 'mail', 18, 2, { str: 4, sta: 4 }, 0x6a3a3a);
A('cindertread_boots', 'Cindertread Boots', 'feet', 'leather', 18, 2, { agi: 4, sta: 4 }, 0x4a3a3a);
W('gorgak_cleaver', 'Gorgak\'s Ridgecleaver', 'axe2h', 21, 3, { str: 10, sta: 7 }, 0xb03a20, { bop: true });
W('gorgak_totem', 'Cinderhorn Totem Staff', 'staff', 21, 3, { int: 9, spi: 6, sta: 4 }, 0x6a3a2a, { glow: 0xff6020, bop: true });
W('gorgak_shank', 'Ogre-Toe Shank', 'dagger', 21, 3, { agi: 6, sta: 4 }, 0xb8bcc4, { bop: true });
A('scout_ring', 'Scout\'s Signet', 'finger', 'jewel', 19, 2, { agi: 3, sta: 3 });
A('bonewarden_band', 'Bonewarden Band', 'finger', 'jewel', 19, 2, { str: 3, sta: 3 });
A('necro_amulet', 'Severed Phylactery Chain', 'neck', 'jewel', 19, 2, { int: 4, spi: 3 });
A('spirebreaker_cloak', 'Spirebreaker Cloak', 'back', 'cloth', 21, 3, { sta: 6, str: 4 }, 0x3a2a5a, { bop: true });
A('spirebreaker_drape', 'Spirebreaker Drape', 'back', 'cloth', 21, 3, { int: 6, spi: 4 }, 0x5a2a6a, { bop: true });
A('spirebreaker_shroud', 'Spirebreaker Shroud', 'back', 'cloth', 21, 3, { agi: 6, sta: 4 }, 0x2a2a3a, { bop: true });
// final rewards (epic)
W('dawnbringer', 'Dawnbringer', 'sword2h', 25, 4, { str: 14, sta: 10, crit: 1 }, 0xffd070, { bop: true });
W('hollowbane', 'Hollowbane', 'sword', 25, 4, { agi: 9, sta: 7, crit: 1 }, 0xb090ff, { bop: true });
W('staff_of_first_light', 'Staff of the First Light', 'staff', 25, 4, { int: 14, spi: 10, sta: 6, sp: 12 }, 0xfff0c0, { glow: 0xfff0a0, bop: true });
W('kings_bow', 'Bow of the Fallen King', 'bow', 25, 4, { agi: 10, sta: 7 }, 0x6a4a8a, { bop: true });

// ================= COTTONVALE =================
Q({ id: 'cv_recruit', name: 'A Fresh Recruit', level: 1, minLevel: 1, giver: 'edda', turnin: 'tobias',
  text: 'So you\'re the new recruit the Wardens sent. Good. Millbrook needs every hand it can get.\n\nFarmer Tobias Hollin is waiting by his barn on the west side of town. His fields are being eaten alive and he needs someone with a strong arm. Go and introduce yourself.',
  obj: 'Speak with Farmer Tobias Hollin in Millbrook.', done: 'Ah, Edda sent you? Bless her. Pull up a hay bale, we have work to do.',
  goals: [], reward: { xpMult: 0.4 } });
Q({ id: 'cv_weevils', name: 'The Weevil Problem', level: 1, minLevel: 1, giver: 'tobias', prev: 'cv_recruit',
  text: 'See those fields north of town? The Gnawed Acres, we call them now. Cotton Weevils the size of dogs have been chewing through my crop since spring.\n\nKill 8 of the blasted things before they eat what\'s left of the harvest.',
  obj: 'Kill 8 Cotton Weevils in the Gnawed Acres north of Millbrook.', done: 'You\'ve got weevil guts on your boots. That\'s the smell of honest work!',
  goals: [{ kind: 'kill', mob: 'cotton_weevil', n: 8 }], reward: { choice: ['millbrook_gloves', 'farmhand_sandals', 'warden_bracers'] } });
Q({ id: 'cv_rats', name: 'Vermin in the Cellar', level: 1, minLevel: 1, giver: 'rosie',
  text: 'Bristle Rats! In my cellar, in my flour, in my good boots! They come up from the fields west and south of town.\n\nClear out 6 of them and the first round is on me.',
  obj: 'Kill 6 Bristle Rats around Millbrook.', done: 'Oh, you\'re a treasure. Here, take a few of these for the road.',
  goals: [{ kind: 'kill', mob: 'bristle_rat', n: 6 }], reward: { items: [['cottonvale_bread', 5]] } });
Q({ id: 'cv_carapace', name: 'Shells for the Smith', level: 2, giver: 'hilda',
  text: 'Weevil carapace is tough stuff. Boil it, press it, and you\'ve got a fine backing for a shield or a pair of bracers.\n\nBring me 6 Weevil Carapaces and I\'ll put them to good use. Some of the bugs\' shells will be too cracked to use, so you may need to squash a few extra.',
  obj: 'Bring 6 Weevil Carapaces to Hilda Stonehand.', done: 'Lovely, still a bit of goo on these. Perfect.',
  goals: [{ kind: 'item', item: 'weevil_carapace', n: 6, from: ['cotton_weevil'], chance: 0.6 }], reward: { choice: ['weevil_crusher', 'shellback_buckler'], money: 1 } });
Q({ id: 'cv_marshal', name: 'Report to the Marshal', level: 2, giver: 'tobias', turnin: 'edda', prev: 'cv_weevils',
  text: 'You\'ve done right by me. Marshal Edda will want to hear that the Acres are safe, at least for now. She stands by the statue in the square.',
  obj: 'Report to Marshal Edda Brightfield in Millbrook.', done: 'Tobias speaks well of you. That\'s rare; he complains about everyone.',
  goals: [], reward: { xpMult: 0.5 } });
Q({ id: 'cv_coyotes', name: 'Dustfang Menace', level: 3, giver: 'edda', prev: 'cv_marshal',
  text: 'The Dustfang coyotes have grown bold. They\'ve taken three lambs this week and nipped at the heels of the carters on the road.\n\nThey roam the plains to the east and west of Millbrook. Thin their packs: kill 8 Dustfang Coyotes.',
  obj: 'Kill 8 Dustfang Coyotes.', done: 'The carters will sleep easier. Well done, recruit.',
  goals: [{ kind: 'kill', mob: 'dustfang_coyote', n: 8 }], reward: { choice: ['coyote_vest', 'militia_hauberk', 'harvest_robe'] } });
Q({ id: 'cv_crabs', name: 'Tidecrawler Claws', level: 3, giver: 'petri',
  text: 'Nothing beats boiled tidecrawler claw with a pinch of salt. But my knees aren\'t what they were, and those crabs pinch back.\n\nWalk the sands of the Cotton Coast and bring me 5 Tidecrawler Claws.',
  obj: 'Bring 5 Tidecrawler Claws to Old Petri at the Millbrook dock.', done: 'Ha! Supper is served. Take this old trinket, it\'s brought me luck.',
  goals: [{ kind: 'item', item: 'tidecrawler_claw', n: 5, from: ['tidecrawler'], chance: 0.65 }], reward: { choice: ['coastline_dirk', 'kelpwoven_cloak', 'petri_ring'] } });
Q({ id: 'cv_sweetroot', name: 'Sweetroot for the Stew', level: 3, giver: 'rosie',
  text: 'My famous harvest stew needs sweetroot, and the best of it grows wild on the hills between town and the coast.\n\nCould you gather 6 Sweetroot for me? Look for the pale green plants in the grass.',
  obj: 'Gather 6 Sweetroot south of Millbrook.', done: 'They smell divine. I\'ll set a bowl aside for you.',
  goals: [{ kind: 'item', item: 'sweetroot', n: 6 }], reward: { items: [['minor_healing_potion', 3]] } });
Q({ id: 'cv_boar', name: 'Razorback Hides', level: 5, giver: 'bram',
  text: 'Razorback boar hide makes the best saddlebags money can buy. Shame they\'re so ornery about giving it up.\n\nThe boars roam the hills north-east and north-west of town. Bring me 6 Razorback Hides and I\'ll pay you in something better than coin.',
  obj: 'Bring 6 Razorback Hides to Bram Copperkettle.', done: 'Look at the quality! I\'ll make a fine bag of these. Here, one\'s yours already.',
  goals: [{ kind: 'item', item: 'razorback_hide', n: 6, from: ['razorback_boar'], chance: 0.6 }], reward: { items: [['linen_bag', 1]], choice: ['wardens_belt', 'scarecrow_boots'] } });
Q({ id: 'cv_seed', name: 'The Stolen Seed', level: 4, giver: 'tobias', prev: 'cv_weevils',
  text: 'As if bugs weren\'t enough, the Burlap Gang raided the seed barn. Next year\'s planting, gone! They\'re camped at Burlap Hollow, south-west of town, hiding behind those ridiculous sack masks.\n\nGet our seed back. Eight sacks, there were.',
  obj: 'Recover 8 Stolen Seed Sacks from Burlap Hollow.', done: 'Every last sack! You\'ve saved next year\'s harvest, friend.',
  goals: [{ kind: 'item', item: 'stolen_seed', n: 8 }], reward: { choice: ['seedcaller_staff', 'bandit_cutlass', 'hayfork'] } });
Q({ id: 'cv_bandits', name: 'Burlap Banditry', level: 5, giver: 'edda', prev: 'cv_coyotes',
  text: 'The Burlap Gang grow bolder by the day. Robbing farmers is one thing; robbing Warden supply carts is another.\n\nMarch on Burlap Hollow and break them. Kill 6 Burlap Bandits and 4 Burlap Cutpurses. Watch for the lookouts with bows.',
  obj: 'Kill 6 Burlap Bandits and 4 Burlap Cutpurses at Burlap Hollow.', done: 'That will teach them to wear sacks on their heads. Excellent work.',
  goals: [{ kind: 'kill', mob: 'burlap_bandit', n: 6 }, { kind: 'kill', mob: 'burlap_cutpurse', n: 4 }], reward: { money: 1.5, choice: ['coyote_vest', 'harvest_robe', 'militia_hauberk'] } });
Q({ id: 'cv_hargrove', name: 'What Became of Hargrove Farm', level: 4, giver: 'wilm',
  text: 'They tell me I\'m mad. That scarecrows don\'t walk. But I saw them with my own eyes, I did, standing up out of the east field with green fire in their eyes.\n\nGo look at my farm, east along the road. Then tell me I\'m mad.',
  obj: 'Investigate Hargrove Farm east of Millbrook, then return to Old Wilm.', done: 'You saw them too? Then I\'m not mad. Somehow that\'s worse.',
  goals: [{ kind: 'explore', area: 'hargrove', label: 'Hargrove Farm investigated' }], reward: { xpMult: 0.8 } });
Q({ id: 'cv_scarecrows', name: 'Straw Men', level: 5, giver: 'wilm', prev: 'cv_hargrove',
  text: 'Something has poisoned my land with blight, and the scarecrows have drunk it in. Cut them down! Burn them if you must.\n\nDestroy 8 Blighted Scarecrows at Hargrove Farm.',
  obj: 'Destroy 8 Blighted Scarecrows at Hargrove Farm.', done: 'Thank the Light. The fields might heal now.',
  goals: [{ kind: 'kill', mob: 'animated_scarecrow', n: 8 }], reward: { choice: ['scarecrow_boots', 'blightbane_mantle', 'wardens_belt'] } });
Q({ id: 'cv_strawhide', name: 'Old Strawhide', level: 7, minLevel: 5, giver: 'wilm', prev: 'cv_scarecrows',
  text: 'The big one. Old Strawhide, my father built him before I was born. Now he stands in the middle of the blighted field with a scythe, and the others obey him.\n\nHe\'s strong, stranger. Bring a friend if you can. Bring me his scythe so I know he\'s finished.',
  obj: 'Slay Old Strawhide and bring his Rusted Scythe to Old Wilm.', done: 'Father\'s old scythe. Rest now, old straw. Rest.',
  goals: [{ kind: 'item', item: 'strawhide_scythe', n: 1, from: ['old_strawhide'], chance: 1 }], reward: { choice: ['strawhide_pauldrons', 'blightbane_mantle', 'scythe_leggings'], money: 2 } });
Q({ id: 'cv_to_thornhaven', name: 'The Road to Thornhaven', level: 6, minLevel: 5, giver: 'edda', turnin: 'fenna', prev: 'cv_bandits',
  text: 'The blight at Hargrove didn\'t come from nowhere. Warden Fenna in Thornhaven sends word of robed figures in the woods, chanting over blackened trees.\n\nFollow the west road out of Millbrook into Whisperwood. Find Fenna and lend her your blade.',
  obj: 'Travel west to Thornhaven in Whisperwood and speak with Warden Fenna Ashgrove.', done: 'Edda sent you? Then the Vale is waking up at last. We need you.',
  goals: [], reward: { xpMult: 0.6 } });

// ================= WHISPERWOOD =================
Q({ id: 'ww_wolves', name: 'Wolves at the Gate', level: 7, giver: 'fenna',
  text: 'The timber wolves have been driven mad. Something in the forest frightens them, and frightened wolves hunt in packs.\n\nKill 10 Timber Wolves in the woods around Thornhaven.',
  obj: 'Kill 10 Timber Wolves.', done: 'The howling has quieted. For now.',
  goals: [{ kind: 'kill', mob: 'timber_wolf', n: 10 }], reward: { choice: ['pelt_hood', 'ranger_greaves', 'mossweave_gloves'] } });
Q({ id: 'ww_pelts', name: 'Warm Pelts for Winter', level: 7, giver: 'dorrin',
  text: 'Winters in Whisperwood are cruel, and the inn\'s blankets are more holes than wool. Bring me 6 Timber Wolf Pelts and I\'ll stitch something proper.',
  obj: 'Bring 6 Timber Wolf Pelts to Dorrin Mossbrew.', done: 'Thick and warm! You\'ve earned a hot meal on the house.',
  goals: [{ kind: 'item', item: 'wolf_pelt', n: 6, from: ['timber_wolf'], chance: 0.55 }], reward: { items: [['haunch_of_meat', 5], ['ice_cold_milk', 5]] } });
Q({ id: 'ww_rootkin', name: 'Restless Roots', level: 8, giver: 'yanna',
  text: 'The Rootkin are spirits of the forest, gentle as a rule. Now they lash out at anything that moves. The blight has reached their heartwood.\n\nI can study the corruption if you bring me 6 pieces of Rootkin Heartwood. You\'ll find the saplings west of town and around Mirror Lake.',
  obj: 'Bring 6 Rootkin Heartwood to Herbalist Yanna.', done: 'Black veins through the grain. The same blight as the scarecrows.',
  goals: [{ kind: 'item', item: 'heartwood', n: 6, from: ['rootkin'], chance: 0.6 }], reward: { choice: ['rootsplitter', 'heartwood_wand', 'stalker_fang'] } });
Q({ id: 'ww_glowcap', name: 'Glowcap Gathering', level: 8, giver: 'yanna',
  text: 'Glowcaps grow in the shade of the old trees north of Thornhaven. Their light keeps the blight at bay, I think. Gather 7 for me.',
  obj: 'Gather 7 Glowcaps in Whisperwood.', done: 'Wonderful. I\'ll brew a ward from these.',
  goals: [{ kind: 'item', item: 'glowcap', n: 7 }], reward: { choice: ['glowcap_pendant', 'thornhaven_cape'] } });
Q({ id: 'ww_stalkers', name: 'Thicket Stalkers', level: 9, giver: 'fenna', prev: 'ww_wolves',
  text: 'Black cats as long as a man is tall stalk the western thickets. They\'ve killed two of my scouts. Hunt them down: 8 Thicket Stalkers.',
  obj: 'Kill 8 Thicket Stalkers in western Whisperwood.', done: 'My scouts are avenged. Thank you.',
  goals: [{ kind: 'kill', mob: 'thicket_stalker', n: 8 }], reward: { choice: ['thornhaven_cape', 'cultbane_bracers', 'idolbreaker_gauntlets'] } });
Q({ id: 'ww_venom', name: 'Silk and Venom', level: 9, giver: 'yanna',
  text: 'Webweaver venom is the base of a strong antidote, and we\'ll need antidotes if we go deeper into the woods.\n\nCollect 8 Webweaver Venom Sacs from the spiders of Silkweave Hollow, north-west of town.',
  obj: 'Bring 8 Webweaver Venom Sacs to Herbalist Yanna.', done: 'Careful how you hand those over! Thank you.',
  goals: [{ kind: 'item', item: 'venom_sac', n: 8, from: ['webweaver_spider'], chance: 0.6 }], reward: { items: [['lesser_healing_potion', 3]], money: 1 } });
Q({ id: 'ww_cocoons', name: 'Cocooned', level: 10, giver: 'fenna', prev: 'ww_venom',
  text: 'Woodcutters from Thornhaven have gone missing near Silkweave Hollow. If the spiders took them they may yet live, wrapped up in silk.\n\nCut 5 villagers free from their cocoons.',
  obj: 'Free 5 trapped villagers from Silk Cocoons in Silkweave Hollow.', done: 'Five families will sleep with their loved ones tonight. You have our gratitude.',
  goals: [{ kind: 'use', id: 'ww_cocoons', n: 5, label: 'Villagers freed' }], reward: { choice: ['silkspun_robe', 'webbed_jerkin', 'broodguard_vest'] } });
Q({ id: 'ww_matron', name: 'Matron Silkweave', level: 12, minLevel: 9, giver: 'fenna', prev: 'ww_cocoons',
  text: 'The freed woodcutters speak of a monstrous spider at the heart of the hollow, the brood matron. As long as she lives, the spiders will keep coming.\n\nKill Matron Silkweave and bring me her fang. Go carefully; she calls her young to defend her.',
  obj: 'Slay Matron Silkweave and bring her fang to Warden Fenna.', done: 'The brood is broken. Thornhaven owes you a debt.',
  goals: [{ kind: 'item', item: 'silkweave_fang', n: 1, from: ['silkweave_matron'], chance: 1 }], reward: { choice: ['matron_fang_blade', 'matron_staff', 'matron_maul'], money: 2 } });
Q({ id: 'ww_cult', name: 'Strange Robes', level: 10, giver: 'fenna', prev: 'ww_wolves',
  text: 'There\'s a ruin south-west of here we call the Witchgrove. Robed figures have taken it: the Hollow Cult, they call themselves. My scouts saw them pouring black water over the roots of the trees.\n\nKill 6 Hollow Cultists and 4 Hollow Acolytes.',
  obj: 'Kill 6 Hollow Cultists and 4 Hollow Acolytes at the Witchgrove.', done: 'The Hollow Cult. I\'ve heard that name before, from the old stories about the Spire.',
  goals: [{ kind: 'kill', mob: 'hollow_cultist', n: 6 }, { kind: 'kill', mob: 'hollow_acolyte', n: 4 }], reward: { choice: ['acolyte_sash', 'cultbane_bracers', 'idolbreaker_gauntlets'] } });
Q({ id: 'ww_idols', name: 'Smash the Idols', level: 10, giver: 'yanna', prev: 'ww_rootkin',
  text: 'The cult has raised idols in the Witchgrove. I can feel them from here, draining the life from the soil.\n\nDestroy 4 Hollow Idols. Just touch them with a bit of this glowcap salve, and they\'ll crumble.',
  obj: 'Destroy 4 Hollow Idols at the Witchgrove.', done: 'The forest breathes easier already.',
  goals: [{ kind: 'use', id: 'ww_idols', n: 4, label: 'Hollow Idols destroyed' }], reward: { choice: ['glowcap_pendant', 'acolyte_sash'], money: 1 } });
Q({ id: 'ww_varn', name: 'Acolyte-Master Varn', level: 11, minLevel: 9, giver: 'fenna', prev: 'ww_cult',
  text: 'The cult answers to Acolyte-Master Varn, who directs them from the heart of the Witchgrove. Cut off the head and the body will wither.\n\nKill Varn and bring me any orders he carries.',
  obj: 'Slay Acolyte-Master Varn and recover his orders.', done: 'Sealed with a black spire... These orders come from the north. From Ashen Ridge.',
  goals: [{ kind: 'item', item: 'varn_orders', n: 1, from: ['cult_leader_varn'], chance: 1 }], reward: { choice: ['varn_signet', 'pelt_hood', 'ranger_greaves'], money: 2 } });
Q({ id: 'ww_bears', name: 'Mossback Haunches', level: 11, giver: 'dorrin',
  text: 'A Mossback haunch, slow-roasted with glowcap and rosemary... my grandfather\'s recipe. Bring me 6 haunches from the bears in the deep south and west woods.',
  obj: 'Bring 6 Mossback Haunches to Dorrin Mossbrew.', done: 'The smell alone will fill the inn for a week!',
  goals: [{ kind: 'item', item: 'bear_haunch', n: 6, from: ['mossback_bear'], chance: 0.6 }], reward: { choice: ['bear_hide_pants', 'greyback_mantle'], items: [['haunch_of_meat', 10]] } });
Q({ id: 'ww_to_brinewater', name: 'Orders Bound for the Fen', level: 12, minLevel: 10, giver: 'fenna', turnin: 'quill', prev: 'ww_varn',
  text: 'Varn\'s orders mention supplies moving through the fens east of Millbrook: Saltmarsh Fen. Someone in Brinewater is helping the cult, knowingly or not.\n\nTake these orders to Harbormaster Quill Brannigan in Brinewater. The east road from the crossroads will take you there.',
  obj: 'Take Varn\'s orders to Harbormaster Quill Brannigan in Brinewater.', done: 'Cult orders, in my harbor? Over my drowned body.',
  goals: [], reward: { xpMult: 0.6 } });

// ================= SALTMARSH FEN =================
Q({ id: 'sm_murk', name: 'Murkfolk Raiders', level: 12, giver: 'quill',
  text: 'The Mirefin murkfolk have always been a nuisance, but this season they raid our nets and our boats every night.\n\nThey live in the mud village to the north-east. Kill 10 Mirefin Murkfolk. And don\'t let them run off; they always come back with friends.',
  obj: 'Kill 10 Mirefin Murkfolk.', done: 'Good riddance. Maybe now we can fish in peace.',
  goals: [{ kind: 'kill', mob: 'mirefin_murkfolk', n: 10 }], reward: { choice: ['mirefin_boots', 'scalemail_leggings', 'saltwoven_pants'] } });
Q({ id: 'sm_scales', name: 'Slick Scales', level: 13, giver: 'hux',
  text: 'Mirefin scales! The alchemists in the capital pay a fortune for them. Well... a modest fortune. Bring me 8 and I\'ll share the profit.',
  obj: 'Bring 8 Mirefin Scales to Peddler Hux.', done: 'Shiny! You\'re a natural trader.',
  goals: [{ kind: 'item', item: 'mirefin_scale', n: 8, from: ['mirefin_murkfolk', 'mirefin_oracle'], chance: 0.55 }], reward: { money: 3, items: [['woolen_bag', 1]] } });
Q({ id: 'sm_croc', name: 'Mudjaw Teeth', level: 13, giver: 'ottilie',
  text: 'The mudjaw crocolisks have grown fat on drowned things. Their teeth make good arrowheads, and fewer crocolisks means fewer missing children.\n\nBring me 6 Mudjaw Teeth.',
  obj: 'Bring 6 Mudjaw Teeth to Fen-Warden Ottilie.', done: 'Sharp as the day they were pulled. Thank you.',
  goals: [{ kind: 'item', item: 'mudjaw_tooth', n: 6, from: ['mudjaw_crocolisk'], chance: 0.6 }], reward: { choice: ['crocjaw_cleaver', 'harpoon_gun', 'tidecaller_rod'] } });
Q({ id: 'sm_nets', name: 'Lost Nets', level: 13, giver: 'mags',
  text: 'The storm last week tore half the village\'s nets loose. They\'re tangled up along the eastern shore. Without them, no fish; without fish, no stew.\n\nBring back 6 Waterlogged Nets, would you?',
  obj: 'Recover 6 Waterlogged Nets along the eastern shore.', done: 'Soggy, but whole! The fishermen will be grateful.',
  goals: [{ kind: 'item', item: 'fishing_net', n: 6 }], reward: { choice: ['netweaver_gloves', 'drowned_bracers'], items: [['mutton_chop', 5]] } });
Q({ id: 'sm_oracles', name: 'The Oracles\' Chant', level: 14, giver: 'quill', prev: 'sm_murk',
  text: 'The murkfolk oracles chant every night at the heart of their village, and every night the fog thickens and the drowned walk. Silence them: kill 6 Mirefin Oracles.',
  obj: 'Kill 6 Mirefin Oracles in Mirefin Village.', done: 'The night was quiet. First time in months.',
  goals: [{ kind: 'kill', mob: 'mirefin_oracle', n: 6 }], reward: { choice: ['lurker_shield', 'tidecaller_rod', 'netweaver_gloves'] } });
Q({ id: 'sm_lurkers', name: 'What Lurks in the Bog', level: 14, giver: 'ottilie',
  text: 'Living mud, they are. Bog Lurkers rise out of the black pools south of here. I want to know what animates them.\n\nKill them and bring me 5 Bog Lurker Cores.',
  obj: 'Bring 5 Bog Lurker Cores to Fen-Warden Ottilie.', done: 'The cores pulse with the same sickly magic as the cult\'s idols. This is no accident.',
  goals: [{ kind: 'item', item: 'lurker_core', n: 5, from: ['bog_lurker'], chance: 0.6 }], reward: { choice: ['lurker_shield', 'mirefin_boots', 'saltwoven_pants'] } });
Q({ id: 'sm_hag', name: 'The Hag of the Bog', level: 15, giver: 'ottilie', prev: 'sm_lurkers',
  text: 'The fen hags brew curses in their hut in the bog to the south-west. If anyone taught the cult to wake the mud, it was them.\n\nKill 6 Fen Hags and find the grimoire they share.',
  obj: 'Kill 6 Fen Hags and recover the Hag\'s Grimoire.', done: 'Pages and pages of necromancy, signed with the black spire. It all leads north.',
  goals: [{ kind: 'kill', mob: 'fen_witch', n: 6 }, { kind: 'item', item: 'hag_grimoire', n: 1, from: ['fen_witch'], chance: 0.25 }], reward: { choice: ['hagspell_hood', 'kelpfin_tunic', 'kings_bane_helm'] } });
Q({ id: 'sm_grimgill', name: 'King of the Mirefin', level: 16, minLevel: 13, giver: 'quill', prev: 'sm_oracles',
  text: 'Every murkfolk tribe has a king, and the Mirefin king has struck a bargain with the cult: fog and fear in exchange for drowned slaves.\n\nKill King Grimgill and bring me his crown. That should end the bargain.',
  obj: 'Slay King Grimgill and bring his crown to Harbormaster Quill.', done: 'Grimgill\'s crown! The tribe will scatter without him.',
  goals: [{ kind: 'item', item: 'grimgill_crown', n: 1, from: ['king_grimgill'], chance: 1 }], reward: { choice: ['grimgill_trident', 'grimgill_scepter', 'kelpfin_tunic'], money: 3 } });
Q({ id: 'sm_drowned', name: 'The Drowned Wreck', level: 15, giver: 'quill',
  text: 'The Hopeful sank off the east shore twenty years ago. Now her crew walks the beach at night, dripping and moaning.\n\nPut 8 Drowned Sailors back to rest.',
  obj: 'Kill 8 Drowned Sailors near the Drowned Wreck.', done: 'May the tide keep them this time.',
  goals: [{ kind: 'kill', mob: 'drowned_sailor', n: 8 }], reward: { choice: ['drowned_bracers', 'kings_bane_helm', 'hagspell_hood'] } });
Q({ id: 'sm_rum', name: 'Spoiled Spirits', level: 15, giver: 'mags',
  text: 'The Hopeful carried casks of Brinewater rum when she went down. The drowned guard it like treasure. I\'d sooner see it smashed than have them drink it.\n\nSmash 5 Spoiled Rum Casks at the wreck.',
  obj: 'Smash 5 Spoiled Rum Casks at the Drowned Wreck.', done: 'A waste of good rum. But better smashed than haunted.',
  goals: [{ kind: 'use', id: 'sm_rum', n: 5, label: 'Rum casks smashed' }], reward: { money: 2, items: [['melon_juice', 5]] } });
Q({ id: 'sm_brack', name: 'Captain Brack', level: 17, minLevel: 14, giver: 'quill', prev: 'sm_drowned',
  text: 'The captain of the Hopeful still stands at her bow, giving orders to a crew of corpses. Captain Brack was my mentor, once.\n\nGive him the rest he deserves.',
  obj: 'Slay Captain Brack at the Drowned Wreck.', done: 'Thank you. I\'ll raise a glass to him tonight.',
  goals: [{ kind: 'kill', mob: 'captain_brack', n: 1 }], reward: { choice: ['brack_cutlass', 'captains_coat', 'kings_bane_helm'], money: 3 } });
Q({ id: 'sm_to_dawnwatch', name: 'To Dawnwatch Keep', level: 16, minLevel: 14, giver: 'quill', turnin: 'aldric', prev: 'sm_grimgill',
  text: 'Every thread leads north to Ashen Ridge, to the black spire on the cult\'s seal. Commander Aldric Vane holds Dawnwatch Keep against the ogres up there.\n\nTake the north road from the crossroads and tell him what you\'ve learned.',
  obj: 'Travel north to Dawnwatch Keep and speak with Commander Aldric Vane.', done: 'The Hollow Spire. So it has woken. Then we are out of time.',
  goals: [], reward: { xpMult: 0.6 } });

// ================= ASHEN RIDGE =================
Q({ id: 'ar_ogres', name: 'Ogres at the Ridge', level: 16, giver: 'aldric',
  text: 'The Cinderhorn ogres have pledged themselves to the Hollow Cult and harry our supply lines. Their camp lies east of the keep.\n\nKill 8 Cinderhorn Brutes and 4 Cinderhorn Maulers.',
  obj: 'Kill 8 Cinderhorn Brutes and 4 Cinderhorn Maulers.', done: 'A fine start. They\'ll think twice before raiding our wagons.',
  goals: [{ kind: 'kill', mob: 'cinderhorn_brute', n: 8 }, { kind: 'kill', mob: 'cinderhorn_mauler', n: 4 }], reward: { choice: ['ogrehide_belt', 'dawnwatch_girdle', 'emberweave_cuffs'] } });
Q({ id: 'ar_shamans', name: 'Cinder Totems', level: 17, giver: 'ilsa',
  text: 'The ogre shamans carry little totems that burn without fuel. They use them to set our wagons alight.\n\nKill Cinderhorn Shamans and bring me 5 Cinder Totems.',
  obj: 'Bring 5 Cinder Totems to Quartermaster Ilsa.', done: 'Still warm. I\'ll have them buried in sand.',
  goals: [{ kind: 'item', item: 'cinder_totem', n: 5, from: ['cinderhorn_shaman'], chance: 0.65 }], reward: { choice: ['cinder_wand', 'golemfist', 'drakefang_spear'] } });
Q({ id: 'ar_banners', name: 'Strike the Colors', level: 17, giver: 'aldric', prev: 'ar_ogres',
  text: 'The ogres fly war banners over their camp to rally their kin. Tear them down.\n\nBurn 4 Cinderhorn War Banners.',
  obj: 'Burn 4 Cinderhorn War Banners in Cinderhorn Camp.', done: 'Without their banners the ogres squabble among themselves. Excellent.',
  goals: [{ kind: 'use', id: 'ar_banners', n: 4, label: 'War Banners burned' }], reward: { choice: ['dawnwatch_girdle', 'ogrehide_belt'], money: 2 } });
Q({ id: 'ar_embers', name: 'Living Embers', level: 17, giver: 'thalen',
  text: 'The Ember Fields to the west seethe with fire elementals. Their cores hold the heat of the earth itself, and with them I can forge wards against the Spire\'s magic.\n\nBring me 8 Ember Cores.',
  obj: 'Bring 8 Ember Cores to Sage Thalen.', done: 'Beautiful. And dangerous. Like most beautiful things.',
  goals: [{ kind: 'item', item: 'ember_core', n: 8, from: ['ember_elemental'], chance: 0.6 }], reward: { choice: ['ashen_mantle', 'drake_scale_spaulders', 'cindertread_boots'] } });
Q({ id: 'ar_ore', name: 'Ashen Ore', level: 17, giver: 'ilsa',
  text: 'Our smiths need ore to mend the garrison\'s armor, and Ashen Ridge is full of it, if you can dodge the elementals. Mine 6 Chunks of Ashen Ore from the veins in the Ember Fields.',
  obj: 'Bring 6 Chunks of Ashen Ore to Quartermaster Ilsa.', done: 'Good, dense ore. The smiths will be busy for a week.',
  goals: [{ kind: 'item', item: 'ashen_ore', n: 6 }], reward: { money: 3, items: [['healing_potion', 3]] } });
Q({ id: 'ar_drakes', name: 'Ashwing Drakelings', level: 18, giver: 'ilsa', prev: 'ar_shamans',
  text: 'Drakelings nest in the ridges north of the keep. They swoop on our patrols and set the scrub ablaze.\n\nKill 8 Ashwing Drakelings.',
  obj: 'Kill 8 Ashwing Drakelings.', done: 'Our patrols thank you. So do their eyebrows.',
  goals: [{ kind: 'kill', mob: 'ash_drake', n: 8 }], reward: { choice: ['drakefang_spear', 'drake_scale_spaulders', 'cinder_wand'] } });
Q({ id: 'ar_golems', name: 'Stone and Ash', level: 18, giver: 'thalen', prev: 'ar_embers',
  text: 'The cult has bound the stones themselves. Ashstone golems walk the ridges to the west and far east. Destroy 6 of them and I may learn how the binding works.',
  obj: 'Destroy 6 Ashstone Golems.', done: 'The bindings are sigils of the Hollow King. He is not dead. He was never dead.',
  goals: [{ kind: 'kill', mob: 'rock_golem', n: 6 }], reward: { choice: ['golemfist', 'cindertread_boots', 'ashen_mantle'] } });
Q({ id: 'ar_gorgak', name: 'Gorgak Cinderhorn', level: 20, minLevel: 17, giver: 'aldric', prev: 'ar_banners',
  text: 'Gorgak Cinderhorn leads the ogres. As long as he lives, the Cinderhorn will fight for the cult.\n\nHe is enormous and cruel, and his shamans will heal him. Bring friends if you have them. Bring me his tusk.',
  obj: 'Slay Gorgak Cinderhorn and bring his tusk to Commander Aldric.', done: 'The Cinderhorn are broken! Now nothing stands between us and the Spire.',
  goals: [{ kind: 'item', item: 'gorgak_tusk', n: 1, from: ['gorgak'], chance: 1 }], reward: { choice: ['gorgak_cleaver', 'gorgak_totem', 'gorgak_shank'], money: 4 } });
Q({ id: 'ar_bones', name: 'Bones at the Gate', level: 19, giver: 'mira',
  text: 'Skeletons guard the approach to the Spire, armed and armored like a garrison. Thin their ranks so we can reach the gate.\n\nDestroy 10 Hollow Bonewardens.',
  obj: 'Destroy 10 Hollow Bonewardens near the Spire Gate.', done: 'The path to the gate is clearer. Barely.',
  goals: [{ kind: 'kill', mob: 'hollow_skeleton', n: 10 }], reward: { choice: ['bonewarden_band', 'scout_ring'] } });
Q({ id: 'ar_necros', name: 'The Necromancers', level: 19, giver: 'mira', prev: 'ar_bones',
  text: 'Hollow Necromancers raise the dead faster than we can put them down. Each carries a focus crystal; break those and the dead stay down.\n\nKill the necromancers and bring me 4 Necromantic Foci.',
  obj: 'Bring 4 Necromantic Foci to Scout Mira Dusk.', done: 'Shattered. The bones lie still. Now, the Spire itself.',
  goals: [{ kind: 'item', item: 'necro_focus', n: 4, from: ['hollow_necromancer'], chance: 0.6 }], reward: { choice: ['necro_amulet', 'bonewarden_band', 'scout_ring'] } });
Q({ id: 'ar_spire', name: 'Into the Hollow Spire', level: 20, minLevel: 18, giver: 'aldric', prev: 'ar_gorgak',
  text: 'The Hollow Spire stands at the north end of the ridge. Inside, the Hollow King\'s lieutenants gather their power: the bone-golem Warden Mortis and the necromancer Lady Vexmire.\n\nCaptain Holt\'s sellswords wait at the Spire Gate camp; take them with you. Destroy Mortis and Vexmire and bring me proof.',
  obj: 'Enter the Hollow Spire. Bring back the Skull of Warden Mortis and Vexmire\'s Phylactery.', done: 'You walked into the Spire and walked back out. The bards will sing of this.',
  goals: [{ kind: 'item', item: 'mortis_skull', n: 1, from: ['warden_mortis'], chance: 1 }, { kind: 'item', item: 'vexmire_phylactery', n: 1, from: ['lady_vexmire'], chance: 1 }],
  reward: { choice: ['spirebreaker_cloak', 'spirebreaker_drape', 'spirebreaker_shroud'], money: 5 } });
Q({ id: 'ar_king', name: 'The Hollow King', level: 21, minLevel: 19, giver: 'thalen', prev: 'ar_golems',
  text: 'I have read the sigils. The Hollow King was a lord of this vale long ago, who sold his heart for a crown that never rusts. The blight, the cult, the drowned: all of it flows from his throne at the top of the Spire.\n\nClimb the Spire. End him. Bring me his heart so it can be burned in clean fire.',
  obj: 'Slay the Hollow King atop the Hollow Spire and bring his heart to Sage Thalen.', done: 'It is done. Feel that? The wind off the ridge smells of rain, not ash. The Vale is free.',
  goals: [{ kind: 'item', item: 'kings_heart', n: 1, from: ['hollow_king'], chance: 1 }], reward: { choice: ['dawnbringer', 'hollowbane', 'staff_of_first_light', 'kings_bow'], money: 10 } });

export const QUEST_ORDER = Object.keys(QUESTS);
