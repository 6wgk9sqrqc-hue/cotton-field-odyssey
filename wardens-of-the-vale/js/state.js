// Shared game state and a tiny event bus. Every module imports G and reads
// fields at runtime, which keeps the import graph free of cycles.
export const G = {
  time: 0,          // seconds of game time since the world loaded
  dt: 0,
  frame: 0,
  scene: null,
  camera: null,
  renderer: null,
  player: null,
  units: [],        // every live unit: player, mobs, npcs, pets, totems
  objects: [],      // clickable world objects (quest objects, mailbox, portals)
  corpses: [],
  party: [],        // hired companions
  hoverUnit: null,
  hoverObject: null,
  isTouch: false,
  paused: false,
  running: false,
  save: null,       // active character save slot data
  settings: { nameplates: true, autoLoot: false, showFps: false, sound: true, quality: 'auto' },
};

const listeners = new Map();
export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(fn);
}
export function emit(type, data) {
  const list = listeners.get(type);
  if (list) for (const fn of list) fn(data);
}
