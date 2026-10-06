// Minimap and world map drawn from a pre-rendered top-down image of the terrain.
import { G } from '../state.js';
import { renderMapImage } from '../engine/terrain.js';
import { WORLD_HALF, ZONES, OVERWORLD_ZONES, TOWNS, FLIGHT_POINTS, SUBZONES, DUNGEON } from '../data/world.js';
import { npcQuestMarker } from '../engine/quests.js';
import { canAttack } from '../engine/combat.js';
import { inDungeon } from '../engine/collision.js';
import { drawQuestPOIs, questie, guideTarget, questColor, questieOn, drawBadge } from './questie.js';

let mapImg = null;
let radius = 90; // yards shown from centre to edge
export function initMaps() { mapImg = renderMapImage(1024); }
export function minimapZoom(k) { radius = Math.max(40, Math.min(220, radius * k)); }

function markerColor(u, p) {
  if (u.kind === 'companion') return '#3c9cff';
  if (u.kind === 'pet') return '#80c8ff';
  return null;
}

export function drawMinimap(cv) {
  const p = G.player;
  if (!p || !mapImg) return;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const scale = W / 2 / radius; // px per yard
  ctx.save();
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, W, W);
  ctx.beginPath();
  ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
  ctx.clip();
  if (inDungeon(p.pos.x)) {
    // the dungeon floor plan
    ctx.fillStyle = '#2a2430';
    for (const [x1, z1, x2, z2] of DUNGEON.rooms) {
      ctx.fillRect(W / 2 + (x1 - p.pos.x) * scale, W / 2 + (z1 - p.pos.z) * scale, (x2 - x1) * scale, (z2 - z1) * scale);
    }
  } else {
    const ipx = mapImg.width / (WORLD_HALF * 2);
    const sx = (p.pos.x - radius + WORLD_HALF) * ipx, sz = (p.pos.z - radius + WORLD_HALF) * ipx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mapImg, sx, sz, radius * 2 * ipx, radius * 2 * ipx, 0, 0, W, W);
  }
  const toPx = (x, z) => [W / 2 + (x - p.pos.x) * scale, W / 2 + (z - p.pos.z) * scale];
  // Questie: objective areas and badges for every active quest
  if (!inDungeon(p.pos.x)) {
    drawQuestPOIs(ctx, p, toPx, scale, { badge: 11, cull: (poi) => Math.abs(poi.x - p.pos.x) < radius + poi.r && Math.abs(poi.z - p.pos.z) < radius + poi.r });
  }
  // tracked creatures
  const track = p.auras.find((a) => a.track)?.track;
  for (const u of G.units) {
    if (u === p || u.dead) continue;
    const dx = u.pos.x - p.pos.x, dz = u.pos.z - p.pos.z;
    if (Math.abs(dx) > radius || Math.abs(dz) > radius) continue;
    const [x, y] = toPx(u.pos.x, u.pos.z);
    if (u.kind === 'npc' && u.npc?.quests) {
      const m = npcQuestMarker(p, u.npc.id);
      if (m === 'available' || m === 'turnin') { glyph(ctx, x, y, m === 'turnin' ? '?' : '!', '#ffd100'); continue; }
      if (m === 'low' || m === 'progress') { glyph(ctx, x, y, m === 'progress' ? '?' : '!', '#a0a0a0'); continue; }
    }
    if (u.kind === 'npc' && (u.npc?.flight)) { dot(ctx, x, y, 3.5, '#60ff60'); continue; }
    if (u.kind === 'npc' && (u.npc?.innkeeper || u.npc?.vendor || u.npc?.trainer)) { dot(ctx, x, y, 2.5, '#e0e0a0'); continue; }
    const mc = markerColor(u, p);
    if (mc) { dot(ctx, x, y, 3, mc); continue; }
    if (track && u.creature === track && u.kind === 'mob') { dot(ctx, x, y, 2.5, '#ff4040'); continue; }
    if (u.kind === 'mob' && (u.threat?.has(p) || p.target === u) && canAttack(p, u)) dot(ctx, x, y, 2.5, '#ff8060');
  }
  // quest objects nearby
  for (const o of G.objects) {
    if (!o.glow.visible || !o.mesh.visible) continue;
    const [x, y] = toPx(o.x, o.z);
    dot(ctx, x, y, 2.5, '#ffe070');
  }
  // the focused quest's next stop, pinned to the rim when it is off the map
  if (questie.focus && questieOn()) {
    const t = guideTarget(p, questie.focus);
    if (t) {
      let [x, y] = toPx(t.x, t.z);
      const dx = x - W / 2, dy = y - W / 2, d = Math.hypot(dx, dy);
      const color = questColor(p, questie.focus);
      if (d > W / 2 - 14) {
        x = W / 2 + dx / d * (W / 2 - 14); y = W / 2 + dy / d * (W / 2 - 14);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(10, 9); ctx.lineTo(0, 4); ctx.lineTo(-10, 9); ctx.closePath();
        ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(x, y, 15 + Math.sin(G.time * 5) * 3, 0, Math.PI * 2);
        ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
      }
    }
  }
  if (p.corpse) {
    let [x, y] = toPx(p.corpse.x, p.corpse.z);
    const dx = x - W / 2, dy = y - W / 2, d = Math.hypot(dx, dy);
    if (d > W / 2 - 8) { x = W / 2 + dx / d * (W / 2 - 8); y = W / 2 + dy / d * (W / 2 - 8); }
    glyph(ctx, x, y, '✝', '#ffffff');
  }
  ctx.restore();
}
function dot(ctx, x, y, r, c) {
  ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2);
  ctx.fillStyle = c; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke();
}
function glyph(ctx, x, y, ch, c) {
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#000';
  ctx.strokeText(ch, x, y); ctx.fillStyle = c; ctx.fillText(ch, x, y);
}

export function drawWorldMap(cv) {
  const p = G.player;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  ctx.drawImage(mapImg, 0, 0, W, W);
  const toPx = (x, z) => [((x + WORLD_HALF) / (WORLD_HALF * 2)) * W, ((z + WORLD_HALF) / (WORLD_HALF * 2)) * W];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of OVERWORLD_ZONES) {
    const z = ZONES[id];
    const [x, y] = toPx(z.center.x, z.center.z + (id === 'cottonvale' ? 120 : 0));
    ctx.font = `${Math.round(W / 26)}px "Marcellus SC", Georgia, serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const label = `${z.name}`;
    ctx.strokeText(label, x, y); ctx.fillStyle = '#ffe9a0'; ctx.fillText(label, x, y);
    ctx.font = `${Math.round(W / 46)}px "Alegreya Sans", sans-serif`;
    ctx.strokeText(`Level ${z.levels[0]}-${z.levels[1]}`, x, y + W / 30); ctx.fillStyle = '#fff'; ctx.fillText(`Level ${z.levels[0]}-${z.levels[1]}`, x, y + W / 30);
  }
  ctx.font = `${Math.round(W / 60)}px "Alegreya Sans", sans-serif`;
  for (const s of SUBZONES) {
    const [x, y] = toPx(s.x, s.z);
    const known = p.explored?.[s.id];
    if (!known) continue;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(s.name, x, y + 14); ctx.fillStyle = '#f0e8d0'; ctx.fillText(s.name, x, y + 14);
  }
  for (const f of FLIGHT_POINTS) {
    const [x, y] = toPx(f.x, f.z);
    ctx.fillStyle = p.flightPoints?.[f.id] ? '#60ff60' : '#808080';
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // spire marker
  const [sx, sy] = toPx(80, -548);
  ctx.fillStyle = '#b070ff'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawQuestPOIs(ctx, p, toPx, W / (WORLD_HALF * 2), { badge: Math.max(7, W / 80) });
  for (const u of G.units) {
    if (u.kind !== 'npc' || !u.npc?.quests) continue;
    const m = npcQuestMarker(p, u.npc.id);
    if (!m) continue;
    if (!questieOn() && m !== 'available' && m !== 'turnin') continue;
    const [x, y] = toPx(u.pos.x, u.pos.z);
    const gray = m === 'low' || m === 'progress';
    glyph(ctx, x, y, m === 'turnin' || m === 'progress' ? '?' : '!', gray ? '#a8a8a8' : '#ffd100');
  }
  // focused quest: a ring around its next stop
  if (questie.focus) {
    const t = guideTarget(p, questie.focus);
    if (t && !inDungeon(t.x)) {
      const [x, y] = toPx(t.x, t.z);
      ctx.beginPath(); ctx.arc(x, y, Math.max(10, W / 50), 0, Math.PI * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = questColor(p, questie.focus); ctx.stroke();
    }
  }
  if (p.corpse) { const [x, y] = toPx(p.corpse.x, p.corpse.z); glyph(ctx, x, y, '✝', '#fff'); }
  const pos = inDungeon(p.pos.x) ? { x: 80, z: -540 } : p.pos;
  const [px, py] = toPx(pos.x, pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-p.facing + Math.PI);
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
  ctx.fillStyle = '#ffe060'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
  ctx.restore();
  void TOWNS; void drawBadge;
}
