// Spatial hash of static colliders (trees, rocks, buildings) plus the walkable
// room list of the dungeon. Units slide along obstacles instead of stopping.
import { DUNGEON } from '../data/world.js';

const CELL = 16;
const grid = new Map();
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

export function addCircle(x, z, r) {
  insert({ type: 'c', x, z, r });
}
// Oriented box: centre, half width (local x), half depth (local z), rotation (y).
export function addBox(x, z, hw, hd, rot = 0) {
  insert({ type: 'b', x, z, hw, hd, rot, cos: Math.cos(rot), sin: Math.sin(rot) });
}
function insert(c) {
  const ext = c.type === 'c' ? c.r : Math.hypot(c.hw, c.hd);
  const x0 = Math.floor((c.x - ext) / CELL), x1 = Math.floor((c.x + ext) / CELL);
  const z0 = Math.floor((c.z - ext) / CELL), z1 = Math.floor((c.z + ext) / CELL);
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
}
export function clearColliders() { grid.clear(); }

function nearby(x, z) {
  const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
  return grid.get(k) || [];
}

export function inDungeon(x) { return x > 950; }
function inRooms(x, z, r) {
  // Rooms overlap by a few yards in the data so seams are walkable.
  for (const [x1, z1, x2, z2] of DUNGEON.rooms) {
    if (x >= x1 + r && x <= x2 - r && z >= z1 + r && z <= z2 - r) return true;
  }
  return false;
}
export function dungeonWalkable(x, z, r = 0.5) {
  return inRooms(x, z, r);
}

// Push a point out of every collider it overlaps. Returns the corrected point.
export function resolve(x, z, r) {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of nearby(x, z)) {
      if (c.type === 'c') {
        const dx = x - c.x, dz = z - c.z;
        const d = Math.hypot(dx, dz), min = c.r + r;
        if (d < min && d > 1e-4) {
          x = c.x + (dx / d) * min; z = c.z + (dz / d) * min; moved = true;
        }
      } else {
        // into box space
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const ex = c.hw + r, ez = c.hd + r;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
          let nx = lx, nz = lz;
          if (px < pz) nx = Math.sign(lx || 1) * ex; else nz = Math.sign(lz || 1) * ez;
          // back to world
          x = c.x + nx * c.cos + nz * c.sin;
          z = c.z - nx * c.sin + nz * c.cos;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

export function blockedPoint(x, z, r) {
  for (const c of nearby(x, z)) {
    if (c.type === 'c') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    } else {
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r) return true;
    }
  }
  return false;
}
