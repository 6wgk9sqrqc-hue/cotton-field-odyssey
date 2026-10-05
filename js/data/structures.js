// Buildings and set dressing. rot is the yaw in radians; a building's door
// faces its local +z.
const R = Math.PI;
export const STRUCTURES = [
  // ---- Millbrook ----
  { type: 'inn', x: 22, z: 280, rot: 0 },
  { type: 'house', x: 66, z: 276, rot: -R / 2, roof: 0x8a3a2a },
  { type: 'house', x: 64, z: 318, rot: -R / 2, w: 12, d: 8, roof: 0x5a4a6a, wall: 0xd8ccb0 }, // trainers' hall
  { type: 'house', x: 12, z: 322, rot: R / 2, roof: 0x9a5a2a },
  { type: 'house', x: 40, z: 336, rot: R, w: 7, d: 6, roof: 0x7a3a2a },
  { type: 'barn', x: -12, z: 290, rot: R / 2 },
  { type: 'windmill', x: -8, z: 336, rot: R / 4 },
  { type: 'well', x: 40, z: 302 },
  { type: 'stall', x: 50, z: 296, rot: -R / 2, color: 0x3a6a9a },
  { type: 'stall', x: 30, z: 306, rot: R / 2, color: 0xb04a3a },
  { type: 'crates', x: 56, z: 300 },
  { type: 'cart', x: 26, z: 296, rot: 0.4 },
  { type: 'hay', x: -4, z: 304 },
  { type: 'hay', x: -2, z: 308, rot: 0.6 },
  { type: 'lamp', x: 36, z: 290 }, { type: 'lamp', x: 46, z: 314 }, { type: 'lamp', x: 34, z: 262 },
  { type: 'lamp', x: 78, z: 300 }, { type: 'lamp', x: 40, z: 340 },
  { type: 'tower', x: 80, z: 282, h: 8, r: 2.2, roof: 0x8a3a2a, color: 0xa09a8c }, // flight perch
  { type: 'signpost', x: 34, z: 252, rot: 0.2 },
  { type: 'statue', x: 40, z: 290, rot: R },
  { type: 'grave', x: -6, z: 250, rot: 0.1 }, { type: 'grave', x: -2, z: 248 }, { type: 'grave', x: 4, z: 251, rot: -0.1 },
  { type: 'grave', x: -5, z: 258 }, { type: 'grave', x: 6, z: 259, rot: 0.15 },
  { type: 'shrine', x: 0, z: 262, rot: R },
  { type: 'dock', x: 72, z: 528, len: 22, rot: 0.05 },
  { type: 'boat', x: 82, z: 548, rot: 0.6, sink: 0.6, noCollide: true },
  { type: 'house', x: 52, z: 488, rot: 0, w: 6, d: 5, roof: 0x5a6a7a },

  // ---- Hargrove Farm (blighted) ----
  { type: 'house', x: 168, z: 318, rot: 0.2, roof: 0x4a3a3a, wall: 0xa89c88 },
  { type: 'barn', x: 196, z: 322, rot: -0.3 },
  { type: 'windmill', x: 150, z: 340, rot: -0.5 },
  { type: 'hay', x: 186, z: 340 }, { type: 'cart', x: 178, z: 336, rot: 2 },
  { type: 'crates', x: 160, z: 330 },

  // ---- Burlap Hollow (bandit camp) ----
  { type: 'tent', x: -150, z: 388, rot: 0.4, color: 0x9a8a6a },
  { type: 'tent', x: -132, z: 404, rot: -0.9, color: 0x8a7a5a },
  { type: 'tent', x: -150, z: 408, rot: 2.2, color: 0xa08a60 },
  { type: 'campfire', x: -140, z: 396 },
  { type: 'crates', x: -128, z: 388 }, { type: 'cart', x: -158, z: 398, rot: 1.2 },
  { type: 'palisade', x: -165, z: 395, rot: R / 2 - 0.2, len: 18 },

  // ---- Thornhaven ----
  { type: 'inn', x: -345, z: 18, rot: R / 2 },
  { type: 'house', x: -315, z: 10, rot: 0, roof: 0x3a4a3a, wall: 0xb8a888 },
  { type: 'house', x: -312, z: 48, rot: R, roof: 0x3a4a3a, wall: 0xb8a888 },
  { type: 'house', x: -350, z: 52, rot: R, w: 7, roof: 0x4a3a2a, wall: 0xb8a888 },
  { type: 'tower', x: -300, z: 30, h: 10, r: 2.4, color: 0x7a6a50, roof: 0x3a4a3a },
  { type: 'well', x: -330, z: 30 },
  { type: 'stall', x: -322, z: 22, rot: R / 2, color: 0x4a6a3a },
  { type: 'campfire', x: -335, z: 40 },
  { type: 'lamp', x: -325, z: 12 }, { type: 'lamp', x: -340, z: 42 }, { type: 'lamp', x: -305, z: 40 },
  { type: 'palisade', x: -330, z: -8, len: 30, rot: 0 },
  { type: 'palisade', x: -366, z: 30, len: 26, rot: R / 2 },
  { type: 'grave', x: -296, z: 72 }, { type: 'grave', x: -302, z: 78, rot: 0.2 }, { type: 'grave', x: -292, z: 80 },

  // ---- Witchgrove ----
  { type: 'tent', x: -478, z: -100, rot: 0.3, color: 0x4a2a5a },
  { type: 'tent', x: -462, z: -122, rot: -1.2, color: 0x3a2a4a },
  { type: 'ruin', x: -470, z: -112, seed: 3, color: 0x6a6a5a },
  { type: 'campfire', x: -466, z: -106 },

  // ---- Brinewater ----
  { type: 'hut', x: 350, z: 48, rot: R / 2, w: 9, d: 7, roof: 0x8a7a40 }, // inn
  { type: 'hut', x: 372, z: 40, rot: 0 },
  { type: 'hut', x: 372, z: 78, rot: R },
  { type: 'hut', x: 345, z: 76, rot: R, roof: 0x6a7a40 },
  { type: 'dock', x: 392, z: 60, len: 16, rot: R / 2 },
  { type: 'crates', x: 362, z: 64 }, { type: 'lamp', x: 360, z: 52 }, { type: 'lamp', x: 368, z: 70 },
  { type: 'tower', x: 385, z: 88, h: 7, r: 2, color: 0x6a5a40, roof: 0x8a7a40 },
  { type: 'grave', x: 318, z: 100 }, { type: 'grave', x: 324, z: 103 },

  // ---- Mirefin Village ----
  { type: 'mudhut', x: 460, z: -80 }, { type: 'mudhut', x: 480, z: -98, color: 0x4a5a3a },
  { type: 'mudhut', x: 470, z: -112, color: 0x5a6040 }, { type: 'mudhut', x: 490, z: -76 },
  { type: 'campfire', x: 472, z: -92 },
  { type: 'signpost', x: 455, z: -100, rot: 1 },

  // ---- Drowned Wreck / Hag's Bog ----
  { type: 'boat', x: 520, z: 150, rot: 1.1, sink: 1.2 },
  { type: 'hut', x: 300, z: -120, rot: 0.6, roof: 0x4a3a4a, wall: 0x4a4038 },

  // ---- Dawnwatch Keep ----
  { type: 'wall', x: -68, z: -334, len: 40, rot: 0 },
  { type: 'wall', x: -88, z: -300, len: 66, rot: R / 2 },
  { type: 'wall', x: -32, z: -322, len: 22, rot: R / 2 },
  { type: 'wall', x: -32, z: -279, len: 20, rot: R / 2 },
  { type: 'wall', x: -74, z: -268, len: 26, rot: 0 },
  { type: 'wall', x: -38, z: -268, len: 10, rot: 0 },
  { type: 'tower', x: -88, z: -334, h: 12, r: 3 }, { type: 'tower', x: -32, z: -334, h: 12, r: 3 },
  { type: 'tower', x: -88, z: -268, h: 12, r: 3 }, { type: 'tower', x: -32, z: -268, h: 12, r: 3 },
  { type: 'house', x: -64, z: -318, rot: 0, w: 14, d: 8, h: 5, roof: 0x3a3a4a, wall: 0x9a948a }, // keep hall
  { type: 'house', x: -76, z: -290, rot: R / 2, roof: 0x3a3a4a, wall: 0x9a948a },
  { type: 'stall', x: -48, z: -292, rot: -R / 2, color: 0x4a4a8a },
  { type: 'campfire', x: -58, z: -296 },
  { type: 'lamp', x: -50, z: -306 }, { type: 'lamp', x: -68, z: -278 },
  { type: 'crates', x: -42, z: -312 },

  // ---- Cinderhorn Camp ----
  { type: 'tent', x: 140, z: -320, rot: 0.8, color: 0x7a4a3a },
  { type: 'tent', x: 162, z: -340, rot: -0.6, color: 0x6a3a2a },
  { type: 'tent', x: 158, z: -316, rot: 2.6, color: 0x7a4a3a },
  { type: 'campfire', x: 150, z: -330 },
  { type: 'palisade', x: 130, z: -340, len: 18, rot: R / 2 + 0.3 },

  // ---- Spire Gate ----
  { type: 'spire', x: 80, z: -548 },
  { type: 'gate', x: 80, z: -530, w: 8, color: 0x2e2a34 },
  { type: 'ruin', x: 50, z: -510, seed: 9, color: 0x4a4450 },
];
