// Questie: shows where every quest happens. Objectives become marked areas on
// the world map and minimap, creatures you still need wear a quest icon, the
// tracker shows how far and which way each quest is, and the focused quest
// gets a guide arrow at the top of the screen.
import { G, on } from '../state.js';
import { QUESTS } from '../data/quests.js';
import { getItem } from '../data/items.js';
import { MOBS } from '../data/mobs.js';
import { SPAWNS, OBJECTS } from '../data/spawns.js';
import { SUBZONES } from '../data/world.js';
import { goalProgress, goalTarget, isComplete } from '../engine/quests.js';
import { objectUsable } from '../engine/world.js';
import { inDungeon } from '../engine/collision.js';
import { cam } from '../engine/player.js';
import { escapeHTML } from '../util.js';

const COLORS = ['#ffd24a', '#5ad1ff', '#ff7a7a', '#9dff6a', '#d79bff', '#ffa94d', '#66f0c8', '#ff8fd1', '#c8c0ff', '#f0f070'];
const SPIRE_DOOR = { x: 80, z: -534 };
const $ = (id) => document.getElementById(id);

export const questie = { focus: null };
export function questieOn() { return G.settings?.questie !== false; }

export function questColor(p, id) {
  const ids = Object.keys(p.quests.active);
  const i = ids.indexOf(id);
  return COLORS[(i < 0 ? 0 : i) % COLORS.length];
}

function npcUnit(npcId) { return G.units.find((u) => u.npc?.id === npcId); }

// Where a quest's remaining work is: areas, objects and people.
export function questPOIs(p, id) {
  const q = QUESTS[id];
  const out = [];
  if (!q) return out;
  if (isComplete(p, id)) {
    const n = npcUnit(q.turnin);
    if (n) out.push({ kind: 'turnin', x: n.pos.x, z: n.pos.z, r: 0, label: `Return to ${n.name}` });
    return out;
  }
  q.goals.forEach((g, i) => {
    if (goalProgress(p, q, i) >= goalTarget(g)) return;
    if (g.kind === 'kill' || (g.kind === 'item' && g.from)) {
      const mobs = g.kind === 'kill' ? [g.mob] : g.from;
      let door = false;
      for (const s of SPAWNS) {
        if (!mobs.includes(s.tpl)) continue;
        const kind = g.kind === 'kill' ? 'slay' : 'loot';
        if (s.dungeon || s.x > 950) {
          if (!door) out.push({ kind, x: SPIRE_DOOR.x, z: SPIRE_DOOR.z, r: 0, goal: i, mobs, dungeon: true, inside: { x: s.x, z: s.z } });
          door = true;
          continue;
        }
        out.push({ kind, x: s.x, z: s.z, r: s.r, goal: i, mobs });
      }
    } else if (g.kind === 'item') {
      for (const o of OBJECTS) if (o.item === g.item) out.push({ kind: 'object', x: o.x, z: o.z, r: o.r ?? 0, goal: i, item: g.item });
    } else if (g.kind === 'use') {
      for (const o of OBJECTS) if (o.credit === g.id) out.push({ kind: 'object', x: o.x, z: o.z, r: o.r ?? 0, goal: i, credit: g.id });
    } else if (g.kind === 'explore') {
      const a = SUBZONES.find((s) => s.id === g.area);
      if (a) out.push({ kind: 'explore', x: a.x, z: a.z, r: a.r * 0.6, goal: i });
    }
  });
  return out;
}

// Creature templates that still count toward an active quest.
let needed = new Map(), neededT = -1;
function refreshNeeded(p) {
  if (G.time - neededT < 0.5 && neededT >= 0) return;
  neededT = G.time;
  needed = new Map();
  for (const id in p.quests.active) {
    const q = QUESTS[id];
    if (!q || isComplete(p, id)) continue;
    q.goals.forEach((g, i) => {
      if (goalProgress(p, q, i) >= goalTarget(g)) return;
      const mobs = g.kind === 'kill' ? [g.mob] : g.kind === 'item' && g.from ? g.from : [];
      for (const m of mobs) { if (!needed.has(m)) needed.set(m, []); needed.get(m).push({ id, i }); }
    });
  }
}
export function questsForUnit(p, u) {
  if (!u?.tplId || u.dead) return null;
  refreshNeeded(p);
  return needed.get(u.tplId) ?? null;
}
// Objective lines for the target frame, e.g. "Grain Weevils slain: 3/8".
export function unitQuestLines(p, u) {
  const list = questsForUnit(p, u);
  if (!list) return [];
  return list.map(({ id, i }) => {
    const q = QUESTS[id], g = q.goals[i];
    const what = g.kind === 'kill' ? (g.label ?? `${u.name} slain`) : getItem(g.item)?.name;
    return { id, text: `${what ?? q.name}: ${goalProgress(p, q, i)}/${goalTarget(g)}`, color: questColor(p, id) };
  });
}

// The exact spot to walk to next: the nearest needed creature or object if
// one is around, otherwise the nearest objective area, or the quest giver.
export function guideTarget(p, id) {
  const q = QUESTS[id];
  if (!q) return null;
  const px = p.pos.x, pz = p.pos.z;
  const pois = questPOIs(p, id);
  if (!pois.length) return null;
  const inside = inDungeon(px);
  let best = null, bd = Infinity;
  const consider = (x, z, label, r = 0) => {
    const d = Math.max(0, Math.hypot(x - px, z - pz) - r);
    if (d < bd) { bd = d; best = { x, z, label, dist: d }; }
  };
  for (const poi of pois) {
    if (poi.kind === 'turnin') { consider(poi.x, poi.z, poi.label); continue; }
    if (poi.kind === 'slay' || poi.kind === 'loot') {
      if (poi.dungeon && inside) { consider(poi.inside.x, poi.inside.z, 'Inside the Spire'); continue; }
      if (poi.dungeon) { consider(poi.x, poi.z, 'The Hollow Spire'); continue; }
      consider(poi.x, poi.z, labelFor(q, poi), poi.r * 0.7);
    } else consider(poi.x, poi.z, labelFor(q, poi), poi.r * 0.7);
  }
  // a live creature or usable object close by beats the middle of an area
  for (const u of G.units) {
    if (u.dead || !u.tplId || Math.abs(u.pos.x - px) > 90 || Math.abs(u.pos.z - pz) > 90) continue;
    const need = questsForUnit(p, u);
    if (need?.some((n) => n.id === id)) consider(u.pos.x, u.pos.z, u.name);
  }
  for (const o of G.objects) {
    if (o.def.quest !== id && !q.goals.some((g) => g.item === o.def.item || g.id === o.def.credit)) continue;
    if (Math.abs(o.x - px) > 90 || Math.abs(o.z - pz) > 90 || !objectUsable(o)) continue;
    consider(o.x, o.z, o.def.name);
  }
  return best;
}
function labelFor(q, poi) {
  const g = q.goals[poi.goal];
  if (!g) return q.name;
  if (g.kind === 'explore') return g.label ?? 'Explore';
  if (g.kind === 'use') return g.label ?? 'Objective';
  if (g.kind === 'item') return getItem(g.item)?.name ?? q.name;
  if (g.kind === 'kill') return g.label ?? MOBS[g.mob]?.name ?? q.name;
  return g.label ?? q.name;
}

// ---------- drawing helpers shared by the minimap and world map ----------
export function drawBadge(ctx, x, y, kind, color, size = 9) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  if (kind === 'object') { ctx.moveTo(0, -size * 1.15); ctx.lineTo(size * 1.15, 0); ctx.lineTo(0, size * 1.15); ctx.lineTo(-size * 1.15, 0); ctx.closePath(); }
  else ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.22); ctx.strokeStyle = '#120c06'; ctx.stroke();
  ctx.strokeStyle = '#120c06'; ctx.fillStyle = '#120c06';
  ctx.lineWidth = Math.max(1.5, size * 0.24); ctx.lineCap = 'round';
  const s = size * 0.5;
  if (kind === 'slay') { ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke(); }
  else if (kind === 'loot') { ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-s * 0.35, -s * 0.95, s * 0.7, s * 0.6); }
  else if (kind === 'explore') { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
  else if (kind === 'object') { ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
export function drawArea(ctx, x, y, r, color) {
  if (r < 2) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color + '2e'; ctx.fill();
  ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = color + 'cc'; ctx.stroke(); ctx.setLineDash([]);
}
export function drawQuestGlyph(ctx, x, y, ch, color, px = 26) {
  ctx.font = `bold ${px}px Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, px / 6); ctx.strokeStyle = '#000';
  ctx.strokeText(ch, x, y); ctx.fillStyle = color; ctx.fillText(ch, x, y);
}

// Draw every active quest's objectives with a projector from world to canvas.
export function drawQuestPOIs(ctx, p, toPx, scale, opts = {}) {
  if (!questieOn()) return;
  const badges = [];
  const stack = new Map();
  for (const id in p.quests.active) {
    const color = questColor(p, id);
    const focused = questie.focus === id;
    for (const poi of questPOIs(p, id)) {
      if (opts.cull && !opts.cull(poi)) continue;
      if (poi.kind === 'turnin') continue; // drawn with the quest giver's own "?"
      const [x, y] = toPx(poi.x, poi.z);
      drawArea(ctx, x, y, poi.r * scale, color);
      // quests sharing a spot get their badges side by side
      const key = Math.round(poi.x / 4) + ',' + Math.round(poi.z / 4);
      const n = stack.get(key) ?? 0;
      stack.set(key, n + 1);
      badges.push({ x, y, n, kind: poi.kind, color, size: (opts.badge ?? 9) * (focused ? 1.25 : 1) });
    }
  }
  for (const b of badges) drawBadge(ctx, b.x + b.n * b.size * 2.1, b.y, b.kind, b.color, b.size);
}

// ---------- guide arrow and tracker distances ----------
function relAngle(p, x, z) {
  const a = Math.atan2(x - p.pos.x, z - p.pos.z);
  const f = cam.yaw + Math.PI;
  // screen rotation is clockwise while facing angles grow counter-clockwise
  let d = f - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function fmtDist(d) { return d < 4 ? 'here' : `${Math.round(d)} yd`; }

let arrowT = 0;
export function updateQuestie(dt) {
  const p = G.player;
  const el = $('questArrow');
  if (!p || !el) return;
  arrowT -= dt;
  if (arrowT > 0) return;
  arrowT = 0.1;
  if (questie.focus && !p.quests.active[questie.focus]) questie.focus = null;
  const on = questieOn() && G.settings?.questArrow !== false && questie.focus && !p.dead;
  if (!on) { el.hidden = true; return; }
  const t = guideTarget(p, questie.focus);
  if (!t) { el.hidden = true; return; }
  el.hidden = false;
  const q = QUESTS[questie.focus];
  el.style.setProperty('--qc', questColor(p, questie.focus));
  const here = t.dist < 4;
  el.classList.toggle('here', here);
  el.querySelector('.qa-arrow').style.transform = `rotate(${relAngle(p, t.x, t.z)}rad)`;
  const label = `${escapeHTML(t.label)} · ${fmtDist(t.dist)}`;
  const nameEl = el.querySelector('.qa-quest'), lblEl = el.querySelector('.qa-label');
  if (nameEl.textContent !== q.name) nameEl.textContent = q.name;
  if (lblEl.innerHTML !== label) lblEl.innerHTML = label;
}
// direction + distance for the tracker rows
export function trackerHint(p, id) {
  const t = guideTarget(p, id);
  if (!t) return null;
  return { rot: relAngle(p, t.x, t.z), dist: t.dist };
}

export function setFocus(id) {
  questie.focus = questie.focus === id ? null : id;
  arrowT = 0;
}

export function initQuestie() {
  const el = document.createElement('div');
  el.id = 'questArrow';
  el.hidden = true;
  el.innerHTML = `<svg class="qa-arrow" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 L33 30 L20 23 L7 30 Z"/></svg><div class="qa-text"><div class="qa-quest"></div><div class="qa-label"></div></div>`;
  $('hud').appendChild(el);
  // tapping the arrow puts it away
  el.addEventListener('click', () => { questie.focus = null; el.hidden = true; });
  // a newly accepted quest becomes the focus; a turned-in one passes it on
  on('questsChanged', (e) => {
    const p = G.player;
    if (!p || e?.unit !== p) return;
    if (e.accepted) questie.focus = e.accepted;
    else if (questie.focus && !p.quests.active[questie.focus]) {
      let best = null, bd = Infinity;
      for (const id in p.quests.active) { const t = guideTarget(p, id); if (t && t.dist < bd) { bd = t.dist; best = id; } }
      questie.focus = best;
    }
    neededT = -1;
    arrowT = 0;
  });
  on('bagsChanged', () => { neededT = -1; });
}
