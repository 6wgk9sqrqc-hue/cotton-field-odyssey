// Geography of the Vale. North is -z, east is +x. One unit = one yard.
export const WORLD_HALF = 700;
export const WATER_LEVEL = 0;

export const ZONES = {
  cottonvale: {
    id: 'cottonvale', name: 'Cottonvale', levels: [1, 6], center: { x: 0, z: 330 },
    fog: 0xc9dcec, sky: 0x8fbce6, ground: 0x7fa54a, ground2: 0xa7b45a, rock: 0x8b8072,
    music: 'pastoral',
  },
  whisperwood: {
    id: 'whisperwood', name: 'Whisperwood', levels: [6, 12], center: { x: -390, z: -10 },
    fog: 0x8fa79a, sky: 0x7e9fae, ground: 0x3f6b33, ground2: 0x2f5530, rock: 0x6a6658,
    music: 'forest',
  },
  saltmarsh: {
    id: 'saltmarsh', name: 'Saltmarsh Fen', levels: [12, 16], center: { x: 390, z: 0 },
    fog: 0x93a184, sky: 0x8ea290, ground: 0x5f6a3a, ground2: 0x4d5a36, rock: 0x6b6450,
    music: 'swamp',
  },
  ashen: {
    id: 'ashen', name: 'Ashen Ridge', levels: [16, 20], center: { x: 0, z: -380 },
    fog: 0xb09a8c, sky: 0xa08a80, ground: 0x6f625a, ground2: 0x5b4f4a, rock: 0x4e4642,
    music: 'ashen',
  },
  spire: {
    id: 'spire', name: 'The Hollow Spire', levels: [19, 21], center: { x: 1120, z: 0 }, dungeon: true,
    fog: 0x1a1424, sky: 0x120e18, ground: 0x3a3440, ground2: 0x2e2a34, rock: 0x2a2630,
    music: 'dungeon',
  },
};
export const OVERWORLD_ZONES = ['cottonvale', 'whisperwood', 'saltmarsh', 'ashen'];

// Settlements are flattened and kept clear of trees.
export const TOWNS = [
  { id: 'millbrook', name: 'Millbrook', zone: 'cottonvale', x: 40, z: 300, r: 48 },
  { id: 'thornhaven', name: 'Thornhaven', zone: 'whisperwood', x: -330, z: 30, r: 38 },
  { id: 'brinewater', name: 'Brinewater', zone: 'saltmarsh', x: 360, z: 60, r: 40 },
  { id: 'dawnwatch', name: 'Dawnwatch Keep', zone: 'ashen', x: -60, z: -300, r: 42 },
  { id: 'spiregate', name: 'Spire Gate', zone: 'ashen', x: 80, z: -515, r: 22 },
  { id: 'hargrove', name: 'Hargrove Farm', zone: 'cottonvale', x: 175, z: 330, r: 26, noGuards: true },
  { id: 'banditcamp', name: 'Burlap Hollow', zone: 'cottonvale', x: -140, z: 395, r: 22, noGuards: true },
  { id: 'cultcamp', name: 'Witchgrove', zone: 'whisperwood', x: -470, z: -110, r: 26, noGuards: true },
  { id: 'mirefin', name: 'Mirefin Village', zone: 'saltmarsh', x: 470, z: -90, r: 30, noGuards: true },
  { id: 'cinderhorn', name: 'Cinderhorn Camp', zone: 'ashen', x: 150, z: -330, r: 32, noGuards: true },
];

// Roads also carve the passes through the mountain ridges between zones.
export const ROADS = [
  [[40, 300], [30, 210], [0, 140]],
  [[0, 140], [-120, 110], [-230, 62], [-330, 30], [-420, 0], [-470, -110]],
  [[0, 140], [130, 112], [250, 72], [360, 60], [430, -20], [470, -90]],
  [[0, 140], [-10, 20], [-30, -120], [-50, -220], [-60, -300]],
  [[-60, -300], [10, -420], [80, -515]],
  [[-60, -300], [60, -310], [150, -330]],
  [[40, 300], [110, 320], [175, 330]],
  [[40, 300], [55, 420], [70, 505]],
  [[40, 300], [-60, 330], [-140, 395]],
];

export const LAKES = [
  { x: 115, z: 240, r: 26, depth: 4 },
  { x: -455, z: 95, r: 42, depth: 5 },
  { x: -250, z: -120, r: 30, depth: 4 },
];
export const LAVA = [
  { x: 140, z: -420, r: 18, level: 14 },
  { x: -170, z: -420, r: 22, level: 16 },
  { x: 40, z: -230, r: 12, level: 18 },
];

// Cotton fields: flattened rectangles planted in rows.
export const FIELDS = [
  { x: 85, z: 210, w: 70, d: 46, rot: 0.08, kind: 'cotton' },
  { x: -70, z: 300, w: 60, d: 60, rot: -0.1, kind: 'cotton' },
  { x: -75, z: 200, w: 80, d: 56, rot: 0.25, kind: 'weevil' },
  { x: 175, z: 375, w: 76, d: 44, rot: 0.0, kind: 'blighted' },
  { x: 0, z: 410, w: 64, d: 40, rot: -0.05, kind: 'cotton' },
  { x: 140, z: 150, w: 50, d: 40, rot: 0.3, kind: 'wheat' },
];

export const GRAVEYARDS = [
  { id: 'gy_cotton', zone: 'cottonvale', x: 0, z: 255 },
  { id: 'gy_wood', zone: 'whisperwood', x: -300, z: 75 },
  { id: 'gy_marsh', zone: 'saltmarsh', x: 320, z: 95 },
  { id: 'gy_ashen', zone: 'ashen', x: -20, z: -255 },
  { id: 'gy_spire', zone: 'ashen', x: 40, z: -495, spire: true },
];

// Named sub-areas give "Discovered" XP and fill the quest explore objectives.
export const SUBZONES = [
  { id: 'millbrook', name: 'Millbrook', x: 40, z: 300, r: 50 },
  { id: 'hargrove', name: 'Hargrove Farm', x: 175, z: 345, r: 45 },
  { id: 'banditcamp', name: 'Burlap Hollow', x: -140, z: 395, r: 35 },
  { id: 'weevilfield', name: 'The Gnawed Acres', x: -75, z: 200, r: 45 },
  { id: 'cottoncoast', name: 'Cotton Coast', x: 60, z: 510, r: 70 },
  { id: 'millpond', name: 'Millpond', x: 115, z: 240, r: 35 },
  { id: 'thornhaven', name: 'Thornhaven', x: -330, z: 30, r: 40 },
  { id: 'witchgrove', name: 'Witchgrove', x: -470, z: -110, r: 45 },
  { id: 'silkhollow', name: 'Silkweave Hollow', x: -480, z: 170, r: 50 },
  { id: 'mirrorlake', name: 'Mirror Lake', x: -455, z: 95, r: 50 },
  { id: 'brinewater', name: 'Brinewater', x: 360, z: 60, r: 42 },
  { id: 'mirefinvillage', name: 'Mirefin Village', x: 470, z: -90, r: 45 },
  { id: 'drownedwreck', name: 'The Drowned Wreck', x: 520, z: 150, r: 40 },
  { id: 'witchbog', name: 'Hag\'s Bog', x: 300, z: -120, r: 45 },
  { id: 'dawnwatch', name: 'Dawnwatch Keep', x: -60, z: -300, r: 45 },
  { id: 'cinderhorn', name: 'Cinderhorn Camp', x: 150, z: -330, r: 45 },
  { id: 'emberfields', name: 'Ember Fields', x: -150, z: -420, r: 60 },
  { id: 'spiregate', name: 'Spire Gate', x: 80, z: -515, r: 35 },
];

export const FLIGHT_POINTS = [
  { id: 'fp_millbrook', name: 'Millbrook, Cottonvale', x: 70, z: 285 },
  { id: 'fp_thornhaven', name: 'Thornhaven, Whisperwood', x: -310, z: 50 },
  { id: 'fp_brinewater', name: 'Brinewater, Saltmarsh Fen', x: 380, z: 80 },
  { id: 'fp_dawnwatch', name: 'Dawnwatch Keep, Ashen Ridge', x: -40, z: -280 },
];

// Dungeon floor plan: rooms joined by corridors, all at floor height 0.
export const DUNGEON = {
  origin: { x: 1000, z: 0 },
  entrance: { x: 1012, z: 0, facing: Math.PI / 2 },
  exitTo: { x: 80, z: -500, facing: Math.PI },
  // axis aligned rectangles that are walkable [x1, z1, x2, z2]
  rooms: [
    [1000, -14, 1060, 14],     // entry hall
    [1058, -5, 1092, 5],       // corridor
    [1090, -30, 1140, 30],     // ossuary (boss 1)
    [1138, -5, 1172, 5],       // corridor
    [1170, -40, 1230, 40],     // library (boss 2)
    [1195, 38, 1205, 82],      // stair
    [1170, 80, 1240, 140],     // throne (final boss)
  ],
};
