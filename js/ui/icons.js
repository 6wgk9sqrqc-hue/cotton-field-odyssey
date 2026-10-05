// Procedural icons: a tinted bevelled tile with a glyph, cached as data URLs.
const cache = new Map();
const SCHOOL_BG = {
  physical: ['#8a7a64', '#3a3026'], holy: ['#f0d880', '#7a5a18'], fire: ['#ff9a40', '#7a1e08'], nature: ['#8ad860', '#1e4a14'],
  frost: ['#a0d8ff', '#1a3a6a'], shadow: ['#a070d0', '#24103a'], arcane: ['#f0a0f0', '#4a1a5a'],
};
const KIND_BG = {
  meat: ['#c87a5a', '#4a1e10'], bread: ['#e0b870', '#6a4a1a'], drink: ['#80c0f0', '#1a3a6a'], potion_red: ['#ff6060', '#5a0a0a'], potion_blue: ['#6090ff', '#0a1a5a'],
  potion_green: ['#70e070', '#0a4a0a'], potion_yellow: ['#f0e060', '#5a4a0a'], potion_orange: ['#ffa040', '#5a2a0a'], potion_purple: ['#c080ff', '#3a0a5a'],
  bandage: ['#f0e8d8', '#6a5a4a'], hearth: ['#a0c8ff', '#2a3a6a'], bag: ['#b08a5a', '#3a2a1a'], bag2: ['#c0a070', '#4a2a1a'], cloth: ['#e0d8c8', '#5a5040'],
  cloth2: ['#d0c0a0', '#4a3a28'], leather: ['#a0784a', '#3a2412'], ore: ['#c08a50', '#2a2420'], junk: ['#8a8a8a', '#2a2a2a'], shard: ['#c070ff', '#200a3a'],
  stone: ['#60ff70', '#0a3a10'], arrow: ['#c0b090', '#3a3020'], coin: ['#ffd050', '#6a4a0a'],
};

export function icon(sym, school = 'physical', bgOverride) {
  const key = sym + '|' + school + '|' + (bgOverride ?? '');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const [a, b] = bgOverride ?? KIND_BG[sym] ?? SCHOOL_BG[school] ?? SCHOOL_BG.physical;
  const g = x.createRadialGradient(22, 18, 4, 32, 32, 46);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  // subtle texture
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`;
    x.fillRect(Math.random() * 64, Math.random() * 64, 3, 3);
  }
  x.save();
  x.translate(32, 32);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  draw(x, sym);
  x.restore();
  // bevel
  x.strokeStyle = 'rgba(255,255,255,0.25)';
  x.lineWidth = 2;
  x.beginPath(); x.moveTo(1, 63); x.lineTo(1, 1); x.lineTo(63, 1); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.beginPath(); x.moveTo(63, 1); x.lineTo(63, 63); x.lineTo(1, 63); x.stroke();
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

const LIGHT = '#f8f0dc', DARK = 'rgba(20,12,4,0.85)';
function shape(x, path, fill = LIGHT, lw = 3) {
  x.beginPath();
  path();
  x.lineWidth = lw + 3;
  x.strokeStyle = DARK;
  x.stroke();
  x.fillStyle = fill;
  x.fill();
}
function line(x, path, color = LIGHT, lw = 4) {
  x.beginPath(); path();
  x.lineWidth = lw + 3; x.strokeStyle = DARK; x.stroke();
  x.lineWidth = lw; x.strokeStyle = color; x.stroke();
}
function blade(x, len = 34, w = 5, rot = -Math.PI / 4) {
  x.save(); x.rotate(rot);
  shape(x, () => { x.moveTo(-w, 6); x.lineTo(-w, -len + 8); x.lineTo(0, -len); x.lineTo(w, -len + 8); x.lineTo(w, 6); x.closePath(); }, '#e8ecf0');
  shape(x, () => { x.rect(-11, 6, 22, 4); }, '#c8a050');
  shape(x, () => { x.rect(-3, 10, 6, 12); }, '#6a4a2a');
  x.restore();
}
function circle(x, r, fill, cx = 0, cy = 0) { shape(x, () => x.arc(cx, cy, r, 0, Math.PI * 2), fill); }
function star(x, n, r1, r2, fill) {
  shape(x, () => { for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1; const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); }, fill);
}
function flame(x, s = 1, fill = '#ffd060') {
  x.save(); x.scale(s, s);
  shape(x, () => { x.moveTo(0, 22); x.bezierCurveTo(-20, 18, -18, -2, -6, -10); x.bezierCurveTo(-4, -2, 0, 0, 2, -6); x.bezierCurveTo(4, -16, 0, -22, 4, -26); x.bezierCurveTo(16, -14, 22, 6, 0, 22); }, fill);
  shape(x, () => { x.moveTo(0, 18); x.bezierCurveTo(-10, 14, -8, 4, -2, 0); x.bezierCurveTo(4, 6, 10, 10, 0, 18); }, '#fff4c0');
  x.restore();
}
function potion(x, fill) {
  shape(x, () => { x.moveTo(-6, -22); x.lineTo(6, -22); x.lineTo(6, -10); x.bezierCurveTo(20, -4, 20, 22, 0, 22); x.bezierCurveTo(-20, 22, -20, -4, -6, -10); x.closePath(); }, fill);
  shape(x, () => x.rect(-7, -26, 14, 5), '#8a6a3a');
}
function armorPiece(x, kind) {
  switch (kind) {
    case 'chest': shape(x, () => { x.moveTo(-20, -18); x.lineTo(-8, -22); x.lineTo(0, -16); x.lineTo(8, -22); x.lineTo(20, -18); x.lineTo(16, -4); x.lineTo(14, 22); x.lineTo(-14, 22); x.lineTo(-16, -4); x.closePath(); }); break;
    case 'legs': shape(x, () => { x.moveTo(-14, -22); x.lineTo(14, -22); x.lineTo(16, 22); x.lineTo(4, 22); x.lineTo(0, -4); x.lineTo(-4, 22); x.lineTo(-16, 22); x.closePath(); }); break;
    case 'head': shape(x, () => { x.moveTo(-18, 14); x.bezierCurveTo(-20, -24, 20, -24, 18, 14); x.lineTo(8, 14); x.lineTo(8, 2); x.lineTo(-8, 2); x.lineTo(-8, 14); x.closePath(); }); break;
    case 'shoulder': shape(x, () => { x.moveTo(-22, 10); x.bezierCurveTo(-22, -16, 22, -16, 22, 10); x.lineTo(12, 6); x.lineTo(0, 12); x.lineTo(-12, 6); x.closePath(); }); break;
    case 'feet': shape(x, () => { x.moveTo(-8, -22); x.lineTo(6, -22); x.lineTo(6, 8); x.lineTo(22, 12); x.lineTo(22, 22); x.lineTo(-8, 22); x.closePath(); }); break;
    case 'hands': shape(x, () => { x.moveTo(-12, 22); x.lineTo(-14, -2); x.lineTo(-14, -20); x.lineTo(-8, -20); x.lineTo(-8, -6); x.lineTo(-4, -22); x.lineTo(2, -22); x.lineTo(2, -6); x.lineTo(8, -20); x.lineTo(14, -18); x.lineTo(14, 4); x.lineTo(20, -2); x.lineTo(22, 4); x.lineTo(12, 22); x.closePath(); }); break;
    case 'waist': shape(x, () => x.rect(-24, -8, 48, 16)); shape(x, () => x.rect(-7, -10, 14, 20), '#d8b050'); break;
    case 'wrist': shape(x, () => { x.rect(-16, -14, 32, 28); }); line(x, () => { x.moveTo(-16, -4); x.lineTo(16, -4); x.moveTo(-16, 6); x.lineTo(16, 6); }, '#a08a60', 2); break;
    case 'back': shape(x, () => { x.moveTo(-12, -22); x.lineTo(12, -22); x.lineTo(22, 22); x.bezierCurveTo(8, 16, -8, 16, -22, 22); x.closePath(); }); break;
    case 'neck': line(x, () => { x.arc(0, -6, 16, 0.2, Math.PI - 0.2); }, '#d8b050', 3); circle(x, 7, '#60c0ff', 0, 12); break;
    case 'finger': line(x, () => x.arc(0, 4, 13, 0, Math.PI * 2), '#d8b050', 5); circle(x, 6, '#ff5050', 0, -10); break;
  }
}
function draw(x, sym) {
  switch (sym) {
    case 'sword': case 'i_sword': blade(x); break;
    case 'swords': blade(x, 34, 4, -Math.PI / 4); blade(x, 34, 4, Math.PI / 4); break;
    case 'dagger': case 'i_dagger': blade(x, 24, 4, -Math.PI / 4); break;
    case 'axe': case 'i_axe':
      x.rotate(-0.5);
      shape(x, () => x.rect(-3, -24, 6, 48), '#7a5430');
      shape(x, () => { x.moveTo(2, -22); x.bezierCurveTo(26, -24, 26, 4, 2, 0); x.closePath(); }, '#d8dce4');
      break;
    case 'mace': case 'hammer': case 'i_mace':
      x.rotate(-0.6);
      shape(x, () => x.rect(-3, -8, 6, 32), '#7a5430');
      if (sym === 'hammer') shape(x, () => x.rect(-14, -22, 28, 14), '#c8ccd4');
      else { x.translate(0, -14); star(x, 8, 13, 7, '#c8ccd4'); }
      break;
    case 'staff': case 'i_staff':
      x.rotate(-0.6);
      shape(x, () => x.rect(-2.5, -18, 5, 44), '#7a5430');
      circle(x, 8, '#80c8ff', 0, -22);
      break;
    case 'wand': case 'i_wand':
      x.rotate(-0.7);
      shape(x, () => x.rect(-2.5, -14, 5, 36), '#8a5a9a');
      star(x, 4, 12, 4, '#fff0a0'); break;
    case 'bow': case 'i_bow':
      line(x, () => { x.arc(-10, 0, 26, -1.1, 1.1); }, '#9a6a3a', 5);
      line(x, () => { x.moveTo(1, -23); x.lineTo(1, 23); }, '#e8e0d0', 1.5);
      break;
    case 'i_gun': shape(x, () => { x.rect(-24, -6, 40, 9); x.rect(4, 0, 10, 18); }, '#5a5a62'); break;
    case 'i_polearm': x.rotate(-0.6); shape(x, () => x.rect(-2, -14, 4, 40), '#7a5430'); shape(x, () => { x.moveTo(0, -30); x.lineTo(8, -14); x.lineTo(-8, -14); x.closePath(); }, '#d8dce4'); break;
    case 'i_fist': case 'fist': shape(x, () => { x.roundRect(-14, -12, 28, 26, 6); }); line(x, () => { for (let i = -1; i <= 1; i++) { x.moveTo(i * 7, -12); x.lineTo(i * 7, -2); } }, '#a08a70', 2); break;
    case 'shield': case 'i_shield': shape(x, () => { x.moveTo(0, -24); x.lineTo(20, -16); x.bezierCurveTo(20, 8, 10, 18, 0, 24); x.bezierCurveTo(-10, 18, -20, 8, -20, -16); x.closePath(); }, '#c8b070'); shape(x, () => { x.moveTo(0, -16); x.lineTo(0, 16); }, '#8a6a30'); break;
    case 'armor': armorPiece(x, 'chest'); break;
    case 'i_chest': case 'i_legs': case 'i_head': case 'i_shoulder': case 'i_feet': case 'i_hands': case 'i_waist': case 'i_wrist': case 'i_back': case 'i_neck': case 'i_finger': armorPiece(x, sym.slice(2)); break;
    case 'shout': shape(x, () => { x.moveTo(-20, -8); x.lineTo(-4, -8); x.lineTo(10, -20); x.lineTo(10, 20); x.lineTo(-4, 8); x.lineTo(-20, 8); x.closePath(); }); line(x, () => { x.arc(10, 0, 14, -0.7, 0.7); }, LIGHT, 2.5); break;
    case 'boot': armorPiece(x, 'feet'); break;
    case 'claw': for (let i = -1; i <= 1; i++) line(x, () => { x.moveTo(i * 10 - 6, -20); x.quadraticCurveTo(i * 10 + 8, 0, i * 10 - 2, 22); }, '#ffe0d0', 4); break;
    case 'burst': star(x, 10, 26, 10, '#fff0a0'); break;
    case 'drop': shape(x, () => { x.moveTo(0, -24); x.bezierCurveTo(16, -2, 18, 20, 0, 22); x.bezierCurveTo(-18, 20, -16, -2, 0, -24); }, '#ff4040'); break;
    case 'skull':
      shape(x, () => { x.arc(0, -4, 18, Math.PI * 0.85, Math.PI * 0.15); x.lineTo(10, 20); x.lineTo(-10, 20); x.closePath(); }, '#ece4d0');
      circle(x, 5, '#1a1010', -7, -2); circle(x, 5, '#1a1010', 7, -2); break;
    case 'heart': shape(x, () => { x.moveTo(0, 20); x.bezierCurveTo(-30, 0, -14, -26, 0, -10); x.bezierCurveTo(14, -26, 30, 0, 0, 20); }, '#ff5050'); break;
    case 'sun': star(x, 12, 24, 15, '#ffe070'); circle(x, 11, '#fff8d0'); break;
    case 'crown': shape(x, () => { x.moveTo(-22, 14); x.lineTo(-22, -12); x.lineTo(-11, 0); x.lineTo(0, -18); x.lineTo(11, 0); x.lineTo(22, -12); x.lineTo(22, 14); x.closePath(); }, '#ffd050'); break;
    case 'book': case 'scroll': shape(x, () => x.rect(-16, -20, 32, 40), sym === 'scroll' ? '#f0e0b0' : '#7a3a2a'); line(x, () => { x.moveTo(-10, -10); x.lineTo(10, -10); x.moveTo(-10, 0); x.lineTo(10, 0); x.moveTo(-10, 10); x.lineTo(6, 10); }, '#e8d8a8', 2); break;
    case 'hand': shape(x, () => { x.moveTo(-10, 22); x.lineTo(-14, 0); x.lineTo(-14, -14); x.lineTo(-9, -14); x.lineTo(-8, -2); x.lineTo(-6, -22); x.lineTo(-1, -22); x.lineTo(0, -4); x.lineTo(3, -22); x.lineTo(8, -21); x.lineTo(7, -2); x.lineTo(13, -14); x.lineTo(17, -11); x.lineTo(11, 8); x.lineTo(8, 22); x.closePath(); }, '#fff0d0'); break;
    case 'star': star(x, 5, 24, 10, '#fff0a0'); break;
    case 'sparkle': star(x, 4, 22, 5, '#ffd0ff'); star(x, 4, 8, 2, '#ffffff'); break;
    case 'paw': circle(x, 11, LIGHT, 0, 8); for (const [a, b] of [[-14, -6], [-6, -16], [6, -16], [14, -6]]) circle(x, 5, LIGHT, a, b); break;
    case 'eye': shape(x, () => { x.moveTo(-24, 0); x.quadraticCurveTo(0, -22, 24, 0); x.quadraticCurveTo(0, 22, -24, 0); }, '#fff8e0'); circle(x, 8, '#4a2a6a'); break;
    case 'feather': x.rotate(0.5); shape(x, () => { x.moveTo(0, -26); x.bezierCurveTo(16, -10, 10, 14, 0, 24); x.bezierCurveTo(-10, 14, -16, -10, 0, -26); }, '#f0e8d8'); line(x, () => { x.moveTo(0, -20); x.lineTo(0, 26); }, '#8a7a5a', 1.5); break;
    case 'poison': potion(x, '#60e040'); break;
    case 'arrow': case 'arrows':
      x.rotate(-Math.PI / 4);
      for (const o of sym === 'arrows' ? [-8, 0, 8] : [0]) {
        line(x, () => { x.moveTo(o, 22); x.lineTo(o, -16); }, '#c8a070', 3);
        shape(x, () => { x.moveTo(o, -26); x.lineTo(o + 6, -14); x.lineTo(o - 6, -14); x.closePath(); }, '#e0e4e8');
      }
      break;
    case 'target': line(x, () => x.arc(0, 0, 20, 0, Math.PI * 2), '#ff5050', 3); line(x, () => x.arc(0, 0, 10, 0, Math.PI * 2), '#ff5050', 3); circle(x, 3, '#ff5050'); break;
    case 'fang': shape(x, () => { x.moveTo(-12, -20); x.lineTo(12, -20); x.quadraticCurveTo(4, 4, 0, 24); x.quadraticCurveTo(-4, 4, -12, -20); }, '#f0ead8'); break;
    case 'fear': shape(x, () => { x.arc(0, 0, 20, 0, Math.PI * 2); }, '#5a2a7a'); circle(x, 5, '#ffffff', -7, -4); circle(x, 5, '#ffffff', 7, -4); shape(x, () => x.ellipse(0, 10, 5, 7, 0, 0, Math.PI * 2), '#1a0a1a'); break;
    case 'flame': flame(x); break;
    case 'fireball': circle(x, 13, '#ffb040', 4, 6); flame(x, 0.75); break;
    case 'snowflake': for (let i = 0; i < 3; i++) { x.save(); x.rotate(i * Math.PI / 3); line(x, () => { x.moveTo(0, -24); x.lineTo(0, 24); x.moveTo(-6, -16); x.lineTo(0, -10); x.lineTo(6, -16); x.moveTo(-6, 16); x.lineTo(0, 10); x.lineTo(6, 16); }, '#e8f8ff', 3); x.restore(); } break;
    case 'frostbolt': shape(x, () => { x.moveTo(0, -26); x.lineTo(10, 0); x.lineTo(0, 24); x.lineTo(-10, 0); x.closePath(); }, '#c8f0ff'); break;
    case 'bolt': shape(x, () => { x.moveTo(4, -26); x.lineTo(-12, 4); x.lineTo(-1, 4); x.lineTo(-6, 26); x.lineTo(12, -6); x.lineTo(1, -6); x.closePath(); }, '#fff8a0'); break;
    case 'wave': for (const o of [-10, 0, 10]) line(x, () => { x.moveTo(-22, o); x.bezierCurveTo(-10, o - 10, 0, o + 10, 22, o - 4); }, '#c8e8ff', 3); break;
    case 'rock': shape(x, () => { x.moveTo(-20, 16); x.lineTo(-16, -8); x.lineTo(-2, -20); x.lineTo(16, -12); x.lineTo(22, 14); x.closePath(); }, '#a89a88'); break;
    case 'orb': circle(x, 16, '#c0a0ff'); circle(x, 6, '#ffffff', -5, -5); break;
    case 'swirl': line(x, () => { for (let t = 0; t < 14; t += 0.2) { const r = t * 1.7, a = t * 0.9; t ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(0, 0); } }, '#ffe0ff', 3); break;
    case 'wolf': case 'cat': case 'bear':
      shape(x, () => { x.moveTo(-18, 20); x.lineTo(-18, -6); x.lineTo(-14, -22); x.lineTo(-6, -10); x.lineTo(6, -10); x.lineTo(14, -22); x.lineTo(18, -6); x.lineTo(18, 20); x.closePath(); }, sym === 'bear' ? '#8a5a3a' : sym === 'cat' ? '#3a3a3a' : '#b0c8e0');
      circle(x, 3, '#ffd040', -7, 2); circle(x, 3, '#ffd040', 7, 2); shape(x, () => x.ellipse(0, 12, 5, 4, 0, 0, Math.PI * 2), '#1a1a1a'); break;
    case 'totem': shape(x, () => x.rect(-8, -14, 16, 38), '#8a5a3a'); shape(x, () => x.rect(-16, -24, 32, 14), '#c86a3a'); circle(x, 3, '#ffffff', -6, -17); circle(x, 3, '#ffffff', 6, -17); break;
    case 'sheep': shape(x, () => x.ellipse(2, 4, 20, 14, 0, 0, Math.PI * 2), '#f8f4ec'); shape(x, () => x.ellipse(-18, -4, 7, 6, 0, 0, Math.PI * 2), '#3a3a3a'); break;
    case 'drink': shape(x, () => { x.moveTo(-14, -18); x.lineTo(14, -18); x.lineTo(10, 22); x.lineTo(-10, 22); x.closePath(); }, '#c8e8ff'); shape(x, () => x.rect(-12, -4, 24, 4), '#80b8f0'); break;
    case 'bread': shape(x, () => x.ellipse(0, 4, 22, 14, 0, 0, Math.PI * 2), '#d8a050'); line(x, () => { for (const o of [-8, 0, 8]) { x.moveTo(o - 4, -6); x.lineTo(o + 4, 6); } }, '#8a5a20', 2); break;
    case 'meat': shape(x, () => x.ellipse(-2, -2, 18, 14, -0.5, 0, Math.PI * 2), '#c8584a'); shape(x, () => x.rect(10, 8, 12, 6), '#f0e8d8'); break;
    case 'hourglass': shape(x, () => { x.moveTo(-14, -22); x.lineTo(14, -22); x.lineTo(2, 0); x.lineTo(14, 22); x.lineTo(-14, 22); x.lineTo(-2, 0); x.closePath(); }, '#f0e0a0'); break;
    case 'demon': case 'imp': shape(x, () => { x.arc(0, 4, 16, 0, Math.PI * 2); }, sym === 'imp' ? '#e05a3a' : '#7a2a8a'); shape(x, () => { x.moveTo(-14, -6); x.lineTo(-20, -24); x.lineTo(-6, -12); x.closePath(); x.moveTo(14, -6); x.lineTo(20, -24); x.lineTo(6, -12); x.closePath(); }, '#2a1a1a'); circle(x, 3, '#ffe040', -6, 2); circle(x, 3, '#ffe040', 6, 2); break;
    case 'void': shape(x, () => x.ellipse(0, 2, 16, 22, 0, 0, Math.PI * 2), '#5a3aaa'); circle(x, 3, '#ffffff', -6, -6); circle(x, 3, '#ffffff', 6, -6); break;
    case 'kiss': shape(x, () => { x.moveTo(-20, 0); x.quadraticCurveTo(-10, -14, 0, -4); x.quadraticCurveTo(10, -14, 20, 0); x.quadraticCurveTo(0, 18, -20, 0); }, '#ff60a0'); break;
    case 'shard': shape(x, () => { x.moveTo(0, -26); x.lineTo(12, -4); x.lineTo(4, 24); x.lineTo(-10, 6); x.closePath(); }, '#d080ff'); break;
    case 'stone': shape(x, () => { x.moveTo(-16, 14); x.lineTo(-12, -14); x.lineTo(6, -20); x.lineTo(18, 0); x.lineTo(8, 20); x.closePath(); }, '#80ff90'); break;
    case 'moon': shape(x, () => { x.arc(0, 0, 20, 0.6, Math.PI * 2 - 0.6); x.arc(10, 0, 15, Math.PI * 2 - 1.0, 1.0, true); }, '#e8e8ff'); break;
    case 'leaf': shape(x, () => { x.moveTo(-18, 20); x.bezierCurveTo(-20, -16, 10, -24, 22, -22); x.bezierCurveTo(20, -4, 10, 22, -18, 20); }, '#90e060'); line(x, () => { x.moveTo(-18, 20); x.lineTo(14, -14); }, '#3a6a1a', 2); break;
    case 'root': line(x, () => { x.moveTo(-20, 22); x.bezierCurveTo(-10, 0, 10, 10, 4, -20); x.moveTo(20, 22); x.bezierCurveTo(10, 6, -14, 4, -10, -22); }, '#8a6a3a', 5); break;
    case 'sleep': x.font = 'bold 30px serif'; x.fillStyle = LIGHT; x.strokeStyle = DARK; x.lineWidth = 4; x.strokeText('Zz', -16, 10); x.fillText('Zz', -16, 10); break;
    case 'net': line(x, () => { for (let i = -2; i <= 2; i++) { x.moveTo(i * 9, -22); x.lineTo(i * 9, 22); x.moveTo(-22, i * 9); x.lineTo(22, i * 9); } }, '#f0f0f0', 2); break;
    case 'interrupt': line(x, () => { x.arc(0, 0, 18, 0, Math.PI * 2); x.moveTo(-12, -12); x.lineTo(12, 12); }, '#ff6060', 4); break;
    case 'mask': shape(x, () => { x.moveTo(-24, -8); x.quadraticCurveTo(0, -18, 24, -8); x.quadraticCurveTo(20, 12, 0, 6); x.quadraticCurveTo(-20, 12, -24, -8); }, '#2a2a30'); circle(x, 4, '#ffffff', -9, -4); circle(x, 4, '#ffffff', 9, -4); break;
    case 'cloak': armorPiece(x, 'back'); break;
    case 'chain': for (let i = -1; i <= 1; i++) line(x, () => x.ellipse(i * 12, i * -6, 8, 5, -0.5, 0, Math.PI * 2), '#c8ccd4', 3); break;
    case 'ghost': shape(x, () => { x.moveTo(-16, 22); x.lineTo(-16, -6); x.bezierCurveTo(-16, -26, 16, -26, 16, -6); x.lineTo(16, 22); x.lineTo(8, 14); x.lineTo(0, 22); x.lineTo(-8, 14); x.closePath(); }, '#e0f0ff'); circle(x, 3, '#1a1a2a', -6, -6); circle(x, 3, '#1a1a2a', 6, -6); break;
    case 'coin': circle(x, 18, '#ffd050'); circle(x, 12, '#f0b030'); break;
    case 'potion_red': case 'potion_blue': case 'potion_green': case 'potion_yellow': case 'potion_orange': case 'potion_purple':
      potion(x, { potion_red: '#ff4848', potion_blue: '#4878ff', potion_green: '#48e048', potion_yellow: '#f0e040', potion_orange: '#ff9030', potion_purple: '#b060ff' }[sym]); break;
    case 'bandage': x.rotate(-0.6); shape(x, () => x.roundRect(-22, -9, 44, 18, 6), '#f8f0e0'); line(x, () => { x.moveTo(-6, -9); x.lineTo(-6, 9); x.moveTo(6, -9); x.lineTo(6, 9); }, '#d0c0a8', 2); break;
    case 'hearth': shape(x, () => x.ellipse(0, 2, 18, 22, 0, 0, Math.PI * 2), '#c0d8f0'); star(x, 5, 10, 4, '#4a7ad0'); break;
    case 'bag': case 'bag2': shape(x, () => { x.moveTo(-18, -6); x.quadraticCurveTo(-22, 22, 0, 22); x.quadraticCurveTo(22, 22, 18, -6); x.lineTo(8, -14); x.lineTo(-8, -14); x.closePath(); }, sym === 'bag2' ? '#c0a070' : '#a07a4a'); line(x, () => { x.moveTo(-10, -12); x.lineTo(10, -12); }, '#5a3a1a', 3); break;
    case 'cloth': case 'cloth2': shape(x, () => { x.moveTo(-20, -14); x.lineTo(20, -18); x.lineTo(18, 16); x.lineTo(-18, 20); x.closePath(); }, sym === 'cloth' ? '#f0e8d8' : '#c8b898'); break;
    case 'leather': shape(x, () => { x.moveTo(-20, -10); x.lineTo(-8, -20); x.lineTo(14, -16); x.lineTo(22, 6); x.lineTo(6, 20); x.lineTo(-18, 14); x.closePath(); }, '#b08050'); break;
    case 'ore': shape(x, () => { x.moveTo(-18, 14); x.lineTo(-14, -10); x.lineTo(4, -18); x.lineTo(20, -2); x.lineTo(12, 18); x.closePath(); }, '#7a7068'); circle(x, 5, '#ff9040', -2, 0); circle(x, 3, '#ff9040', 8, 8); break;
    case 'junk': case 'tail': case 'shell': case 'straw': case 'bone':
      if (sym === 'tail') line(x, () => { x.moveTo(-20, 16); x.bezierCurveTo(-4, -26, 8, 26, 20, -14); }, '#d8a8a0', 4);
      else if (sym === 'shell') shape(x, () => { x.arc(0, 6, 18, Math.PI, 0); x.closePath(); }, '#a08a60');
      else if (sym === 'straw') line(x, () => { for (let i = -3; i <= 3; i++) { x.moveTo(i * 4, 20); x.lineTo(i * 6, -20); } }, '#e0c060', 2);
      else if (sym === 'bone') line(x, () => { x.moveTo(-16, 16); x.lineTo(16, -16); }, '#f0e8d8', 7);
      else shape(x, () => x.rect(-14, -14, 28, 28), '#8a8a8a');
      break;
    case 'ring': armorPiece(x, 'finger'); break;
    case 'sack': shape(x, () => { x.moveTo(-14, -10); x.quadraticCurveTo(-24, 22, 0, 22); x.quadraticCurveTo(24, 22, 14, -10); x.closePath(); }, '#d8c088'); line(x, () => { x.moveTo(-6, -14); x.lineTo(6, -14); }, '#8a6a3a', 3); break;
    case 'mushroom': shape(x, () => { x.arc(0, 0, 18, Math.PI, 0); x.closePath(); }, '#60c0ff'); shape(x, () => x.rect(-5, 0, 10, 20), '#f0e8d8'); break;
    case 'trap': line(x, () => { x.arc(0, 0, 18, 0, Math.PI * 2); }, '#c8ccd4', 3); line(x, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.moveTo(Math.cos(a) * 18, Math.sin(a) * 18); x.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } }, '#c8ccd4', 2); break;
    case 'whip': line(x, () => { x.moveTo(-20, 20); x.bezierCurveTo(10, 10, -10, -20, 22, -22); }, '#8a3a6a', 3); break;
    default: x.font = 'bold 30px serif'; x.fillStyle = LIGHT; x.textAlign = 'center'; x.fillText('?', 0, 10);
  }
}

// Icon for an item template.
export function itemIcon(it) {
  if (!it) return icon('junk');
  if (it.icon) return icon(it.icon, 'physical');
  if (it.dmg) return icon('i_' + ({ sword2h: 'sword', axe2h: 'axe', mace2h: 'mace', thrown: 'dagger' }[it.type] ?? it.type), 'physical', itemBg(it));
  if (it.type === 'shield') return icon('i_shield', 'physical', itemBg(it));
  if (it.slot && ['chest', 'legs', 'head', 'shoulder', 'feet', 'hands', 'waist', 'wrist', 'back', 'neck', 'finger'].includes(it.slot)) return icon('i_' + it.slot, 'physical', itemBg(it));
  if (it.slot === 'trinket') return icon('orb', 'arcane');
  return icon('junk');
}
function itemBg(it) {
  if (it.color !== undefined) {
    const c = it.color;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    return [`rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`, `rgb(${r * 0.35 | 0},${g * 0.35 | 0},${b * 0.35 | 0})`];
  }
  return ['#9a8a74', '#2a2420'];
}
