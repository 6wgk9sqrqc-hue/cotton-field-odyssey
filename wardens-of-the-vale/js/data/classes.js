// The nine classic classes. Numbers follow the shape of the original game
// (stat growth, base health/mana, armor and weapon proficiencies) scaled for a
// level 20 cap.
export const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Warrior', color: '#c79c6e', power: 'rage', gcd: 1.5,
    desc: 'A master of arms who builds rage by dealing and taking blows. Switches between Battle and Defensive stances.',
    role: 'Tank / Melee damage',
    base: { str: 23, agi: 20, sta: 22, int: 20, spi: 20 },
    grow: { str: 1.3, agi: 0.8, sta: 1.2, int: 0.15, spi: 0.3 },
    hp: [55, 18], mana: null,
    armor: ['cloth', 'leather', 'mail', 'shield'],
    weapons: ['dagger', 'fist', 'axe', 'axe2h', 'sword', 'sword2h', 'mace', 'mace2h', 'polearm', 'staff', 'bow', 'gun', 'thrown'],
    critAgi: 0.035, dodgeAgi: 0.04, spellCritInt: 0,
    ap: (s, L) => s.str * 2 + L * 3 - 20, rap: (s, L) => s.agi + L - 10,
    parry: true, block: true, dualWieldAt: 20,
    start: { items: ['worn_shortsword', 'battered_buckler', 'recruit_shirt', 'recruit_pants', 'recruit_boots'], bag: [['tough_jerky', 6]] },
    abilities: ['battle_stance', 'heroic_strike', 'battle_shout'],
    bar: ['attack', 'heroic_strike', 'battle_shout', null, null, null, null, null, null, null, 'tough_jerky', 'hearthstone'],
    look: { shirt: 0x8a8a90, pants: 0x5a4a3a, boots: 0x3a2a20, belt: 0x4a3020 },
    trees: ['Arms', 'Fury', 'Protection'],
  },
  paladin: {
    id: 'paladin', name: 'Paladin', color: '#f58cba', power: 'mana', gcd: 1.5,
    desc: 'A holy warrior who empowers attacks with Seals, judges foes, heals allies and wears heavy armor.',
    role: 'Tank / Healer / Melee damage',
    base: { str: 22, agi: 20, sta: 22, int: 20, spi: 21 },
    grow: { str: 1.1, agi: 0.5, sta: 1.0, int: 0.6, spi: 0.6 },
    hp: [52, 16], mana: [60, 11], regen: [15, 5],
    armor: ['cloth', 'leather', 'mail', 'shield'],
    weapons: ['axe', 'axe2h', 'sword', 'sword2h', 'mace', 'mace2h', 'polearm'],
    critAgi: 0.03, dodgeAgi: 0.04, spellCritInt: 0.03,
    ap: (s, L) => s.str * 2 + L * 3 - 20, rap: (s, L) => s.agi - 10,
    parry: true, block: true,
    start: { items: ['battered_mace', 'squire_shirt', 'squire_pants', 'recruit_boots'], bag: [['tough_jerky', 4], ['spring_water', 4]] },
    abilities: ['seal_righteousness', 'holy_light', 'devotion_aura'],
    bar: ['attack', 'seal_righteousness', 'holy_light', 'devotion_aura', null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { shirt: 0xc8b070, pants: 0x6a6a7a, boots: 0x4a3a2a, belt: 0x6a4a20 },
    trees: ['Holy', 'Protection', 'Retribution'],
  },
  hunter: {
    id: 'hunter', name: 'Hunter', color: '#abd473', power: 'mana', gcd: 1.5,
    desc: 'A ranged fighter who shoots from afar, tames a beast companion, and lays traps. Cannot shoot inside 8 yards.',
    role: 'Ranged damage / Pet',
    base: { str: 20, agi: 23, sta: 21, int: 20, spi: 21 },
    grow: { str: 0.4, agi: 1.4, sta: 0.9, int: 0.5, spi: 0.6 },
    hp: [50, 15], mana: [65, 10], regen: [15, 5],
    armor: ['cloth', 'leather'],
    weapons: ['axe', 'axe2h', 'sword', 'sword2h', 'dagger', 'fist', 'polearm', 'staff', 'bow', 'gun', 'thrown'],
    critAgi: 0.035, dodgeAgi: 0.04, spellCritInt: 0.02,
    ap: (s, L) => s.str + s.agi + L * 2 - 20, rap: (s, L) => s.agi * 2 + L * 2 - 10,
    parry: true, dualWieldAt: 20,
    start: { items: ['worn_axe', 'worn_shortbow', 'hunter_vest', 'hunter_pants', 'recruit_boots'], bag: [['rough_arrow', 400], ['tough_jerky', 4], ['spring_water', 2]] },
    abilities: ['auto_shot', 'raptor_strike', 'track_beasts'],
    bar: ['auto_shot', 'raptor_strike', 'attack', null, null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { shirt: 0x6a7a3a, pants: 0x5a4a32, boots: 0x3a2a20, belt: 0x4a3020 },
    trees: ['Beast Mastery', 'Marksmanship', 'Survival'],
  },
  rogue: {
    id: 'rogue', name: 'Rogue', color: '#fff569', power: 'energy', gcd: 1.0,
    desc: 'A stealthy fighter who builds combo points with quick strikes and spends them on finishing moves.',
    role: 'Melee damage',
    base: { str: 21, agi: 24, sta: 21, int: 20, spi: 20 },
    grow: { str: 0.7, agi: 1.5, sta: 0.7, int: 0.2, spi: 0.3 },
    hp: [50, 15], mana: null,
    armor: ['cloth', 'leather'],
    weapons: ['dagger', 'fist', 'sword', 'mace', 'bow', 'gun', 'thrown'],
    critAgi: 0.04, dodgeAgi: 0.05, spellCritInt: 0,
    ap: (s, L) => s.str + s.agi + L * 2 - 20, rap: (s, L) => s.agi + L - 10,
    parry: true, dualWieldAt: 1,
    start: { items: ['worn_dagger', 'worn_dirk', 'footpad_shirt', 'footpad_pants', 'recruit_boots'], bag: [['tough_jerky', 6]] },
    abilities: ['sinister_strike', 'eviscerate', 'stealth'],
    bar: ['attack', 'sinister_strike', 'eviscerate', 'stealth', null, null, null, null, null, null, 'tough_jerky', 'hearthstone'],
    look: { shirt: 0x3a3a40, pants: 0x2a2a30, boots: 0x222222, belt: 0x2a2018 },
    trees: ['Assassination', 'Combat', 'Subtlety'],
  },
  priest: {
    id: 'priest', name: 'Priest', color: '#ffffff', power: 'mana', gcd: 1.5,
    desc: 'A devoted healer who wields Holy light to mend allies and Shadow magic to torment foes.',
    role: 'Healer / Ranged damage',
    base: { str: 20, agi: 20, sta: 20, int: 22, spi: 23 },
    grow: { str: 0.2, agi: 0.3, sta: 0.4, int: 1.3, spi: 1.4 },
    hp: [42, 13], mana: [110, 13], regen: [12.5, 4],
    armor: ['cloth'],
    weapons: ['dagger', 'mace', 'staff', 'wand'],
    critAgi: 0.03, dodgeAgi: 0.04, spellCritInt: 0.035,
    ap: (s, L) => s.str - 10, rap: (s, L) => s.agi - 10,
    start: { items: ['worn_mace', 'neophyte_robe', 'recruit_boots'], bag: [['tough_jerky', 4], ['spring_water', 6]] },
    abilities: ['smite', 'lesser_heal', 'pw_fortitude'],
    bar: ['smite', 'lesser_heal', 'pw_fortitude', null, null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { robe: 0xe8e4d8, shirt: 0xe8e4d8, pants: 0xd8d0c0, boots: 0x6a5a40, belt: 0xc8a040 },
    trees: ['Discipline', 'Holy', 'Shadow'],
  },
  shaman: {
    id: 'shaman', name: 'Shaman', color: '#0070de', power: 'mana', gcd: 1.5,
    desc: 'A spiritual guide who calls down lightning, imbues weapons, and plants Totems of the elements.',
    role: 'Healer / Caster / Melee',
    base: { str: 21, agi: 20, sta: 22, int: 21, spi: 22 },
    grow: { str: 0.8, agi: 0.5, sta: 0.9, int: 0.8, spi: 0.9 },
    hp: [50, 16], mana: [55, 11], regen: [15, 5],
    armor: ['cloth', 'leather', 'shield'],
    weapons: ['axe', 'axe2h', 'mace', 'mace2h', 'dagger', 'fist', 'staff'],
    critAgi: 0.03, dodgeAgi: 0.04, spellCritInt: 0.03,
    ap: (s, L) => s.str * 2 + L * 2 - 20, rap: (s, L) => s.agi - 10,
    parry: true, block: true,
    start: { items: ['worn_mace', 'battered_buckler', 'primal_vest', 'primal_kilt', 'recruit_boots'], bag: [['tough_jerky', 4], ['spring_water', 4]] },
    abilities: ['lightning_bolt', 'healing_wave', 'rockbiter_weapon'],
    bar: ['lightning_bolt', 'healing_wave', 'rockbiter_weapon', 'attack', null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { shirt: 0x4a6a8a, pants: 0x5a4a3a, boots: 0x3a2a20, belt: 0x6a4a2a },
    trees: ['Elemental', 'Enhancement', 'Restoration'],
  },
  mage: {
    id: 'mage', name: 'Mage', color: '#69ccf0', power: 'mana', gcd: 1.5,
    desc: 'A scholar of arcane, fire and frost who blasts foes from range and controls them with Polymorph and Frost Nova.',
    role: 'Ranged damage',
    base: { str: 20, agi: 20, sta: 20, int: 24, spi: 22 },
    grow: { str: 0.2, agi: 0.3, sta: 0.4, int: 1.5, spi: 1.3 },
    hp: [40, 13], mana: [100, 13], regen: [12.5, 4],
    armor: ['cloth'],
    weapons: ['dagger', 'sword', 'staff', 'wand'],
    critAgi: 0.03, dodgeAgi: 0.04, spellCritInt: 0.035,
    ap: (s, L) => s.str - 10, rap: (s, L) => s.agi - 10,
    start: { items: ['worn_staff', 'apprentice_robe', 'recruit_boots'], bag: [['tough_jerky', 2], ['spring_water', 6]] },
    abilities: ['fireball', 'frost_armor', 'arcane_intellect'],
    bar: ['fireball', 'frost_armor', 'arcane_intellect', null, null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { robe: 0x5a3a8a, shirt: 0x5a3a8a, pants: 0x3a2a5a, boots: 0x3a2a3a, belt: 0xa08040 },
    trees: ['Arcane', 'Fire', 'Frost'],
  },
  warlock: {
    id: 'warlock', name: 'Warlock', color: '#9482c9', power: 'mana', gcd: 1.5,
    desc: 'A dark caster who afflicts foes with curses and lingering shadow, and commands summoned demons.',
    role: 'Ranged damage / Pet',
    base: { str: 20, agi: 20, sta: 21, int: 23, spi: 22 },
    grow: { str: 0.3, agi: 0.4, sta: 0.7, int: 1.2, spi: 1.2 },
    hp: [44, 14], mana: [90, 12], regen: [8, 4],
    armor: ['cloth'],
    weapons: ['dagger', 'sword', 'staff', 'wand'],
    critAgi: 0.03, dodgeAgi: 0.04, spellCritInt: 0.03,
    ap: (s, L) => s.str - 10, rap: (s, L) => s.agi - 10,
    start: { items: ['worn_dagger', 'acolyte_robe', 'recruit_boots'], bag: [['tough_jerky', 4], ['spring_water', 4]] },
    abilities: ['shadow_bolt', 'demon_skin', 'summon_imp'],
    bar: ['shadow_bolt', 'summon_imp', 'demon_skin', null, null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { robe: 0x5a1a2a, shirt: 0x5a1a2a, pants: 0x2a1a1a, boots: 0x2a1a1a, belt: 0x6a2a6a },
    trees: ['Affliction', 'Demonology', 'Destruction'],
  },
  druid: {
    id: 'druid', name: 'Druid', color: '#ff7d0a', power: 'mana', gcd: 1.5,
    desc: 'A shapeshifter who heals and casts nature magic, or takes the form of a bear to tank and a cat to strike.',
    role: 'Healer / Tank / Melee / Caster',
    base: { str: 21, agi: 20, sta: 21, int: 22, spi: 22 },
    grow: { str: 0.6, agi: 0.6, sta: 0.7, int: 1.0, spi: 1.0 },
    hp: [46, 15], mana: [60, 11], regen: [15, 5],
    armor: ['cloth', 'leather'],
    weapons: ['dagger', 'fist', 'mace', 'mace2h', 'staff'],
    critAgi: 0.03, dodgeAgi: 0.04, spellCritInt: 0.03,
    ap: (s, L) => s.str * 2 - 20, rap: (s, L) => s.agi - 10,
    start: { items: ['worn_staff', 'novice_leather_vest', 'hunter_pants', 'recruit_boots'], bag: [['tough_jerky', 4], ['spring_water', 4]] },
    abilities: ['wrath', 'healing_touch', 'mark_of_the_wild'],
    bar: ['wrath', 'healing_touch', 'mark_of_the_wild', 'attack', null, null, null, null, null, null, 'tough_jerky', 'spring_water'],
    look: { shirt: 0x5a6a3a, pants: 0x4a3a2a, boots: 0x3a2a20, belt: 0x6a4a2a },
    trees: ['Balance', 'Feral Combat', 'Restoration'],
  },
};
export const CLASS_ORDER = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];

// Classic experience curve scaled down so a run to the level 20 cap takes an evening.
const XP_CLASSIC = [400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600, 8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400, 21300];
export const XP_SCALE = 0.5;
export const MOB_XP_SCALE = 0.65;
export const QUEST_XP_SCALE = 0.65;
export const MAX_LEVEL = 20;
export const xpToLevel = (L) => (L >= MAX_LEVEL ? 0 : Math.round(XP_CLASSIC[L - 1] * XP_SCALE));

// Zero-difference value from the original mob experience formula.
function zeroDiff(L) {
  if (L <= 7) return 5;
  if (L <= 9) return 6;
  if (L <= 11) return 7;
  if (L <= 15) return 8;
  if (L <= 19) return 9;
  return 11;
}
export function mobXP(playerLevel, mobLevel, elite) {
  const base = mobLevel * 5 + 45;
  let xp;
  if (mobLevel >= playerLevel) xp = base * (1 + 0.05 * Math.min(4, mobLevel - playerLevel));
  else {
    const gray = playerLevel <= 5 ? 0 : playerLevel - Math.floor(playerLevel / 10) - 5;
    if (mobLevel <= gray) return 0;
    xp = base * (1 - (playerLevel - mobLevel) / zeroDiff(playerLevel));
  }
  return Math.max(0, Math.round(xp * (elite ? 2 : 1) * MOB_XP_SCALE));
}

// Quest experience by quest level, with the classic penalty for outleveled quests.
export function questXP(questLevel, playerLevel, mult = 1) {
  const base = (50 + 90 * questLevel + 2.5 * questLevel * questLevel) * QUEST_XP_SCALE * mult;
  const over = playerLevel - questLevel;
  const k = over <= 5 ? 1 : over === 6 ? 0.8 : over === 7 ? 0.6 : over === 8 ? 0.4 : over === 9 ? 0.2 : 0.1;
  return Math.max(1, Math.round(base * k / 5) * 5);
}
export const questMoney = (L) => Math.round(L * L * 5 + L * 20);
export const trainCost = (L) => (L <= 1 ? 10 : Math.round(Math.pow(L, 2.4) * 1.8));

export const SKIN_TONES = [0xf0c8a0, 0xe0b48c, 0xc8956a, 0x9a6a48, 0x6a4a34, 0x8ab0a0, 0xa0a8c8];
export const HAIR_COLORS = [0x2a1e14, 0x5a3a1e, 0xa0702a, 0xd8c070, 0xb03a1a, 0xe8e8e8, 0x3a5a8a, 0x6a2a6a];
export const HAIR_STYLES = ['Short', 'Long', 'Topknot', 'Mane'];
