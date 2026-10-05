// Builds character models from class defaults, chosen looks and equipped gear.
import { humanoid, quadruped, spider, insect, crab, croc, bird, elemental, totemModel } from './models.js';
import { CLASSES, SKIN_TONES, HAIR_COLORS } from '../data/classes.js';
import { getItem } from '../data/items.js';

export function buildModel(spec) {
  switch (spec.t) {
    case 'human': return humanoid(spec);
    case 'quad': return quadruped(spec);
    case 'spider': return spider(spec);
    case 'insect': return insect(spec);
    case 'crab': return crab(spec);
    case 'croc': return croc(spec);
    case 'bird': return bird(spec);
    case 'elemental': return elemental(spec);
    case 'totem': return totemModel(spec.color, spec.top);
    default: return humanoid(spec);
  }
}

const HELM_TYPES = { cloth: 'hood', leather: 'cap', mail: 'plate' };
export function characterSpec(u) {
  const C = CLASSES[u.cls];
  const look = u.look ?? {};
  const o = {
    t: 'human',
    skin: SKIN_TONES[look.skin ?? 1] ?? 0xe0b48c,
    hair: HAIR_COLORS[look.hairColor ?? 0] ?? 0x2a1e14,
    hairStyle: look.hairStyle ?? 0,
    ...C.look,
    bulk: look.build === 1 ? 1.12 : 1,
  };
  const eq = (slot) => (u.equip?.[slot] ? getItem(u.equip[slot].id) : null);
  const chest = eq('chest'), legs = eq('legs'), feet = eq('feet'), hands = eq('hands'), head = eq('head'), shoulder = eq('shoulder'), back = eq('back'), waist = eq('waist');
  if (chest?.color) { o.shirt = chest.color; o.robe = chest.robe ? chest.color : undefined; o.sleeve = chest.color; }
  else if (!chest) { o.shirt = 0xd8c8a8; o.robe = undefined; }
  if (legs?.color) o.pants = legs.color;
  if (feet?.color) o.boots = feet.color;
  if (hands?.color) o.gloves = hands.color;
  if (waist?.color) o.belt = waist.color;
  if (head) o.helm = { type: HELM_TYPES[head.type] === 'cap' ? 'hood' : HELM_TYPES[head.type] ?? 'plate', color: head.color ?? 0x8a8a8a, full: head.type === 'mail' };
  if (shoulder) o.shoulders = shoulder.color ?? 0x7a7a80;
  if (back) o.cape = back.color ?? 0x6a2a2a;
  const mh = eq('mainhand'), oh = eq('offhand'), rg = eq('ranged');
  if (mh) o.weapon = { type: weaponModel(mh), color: mh.color ?? 0xb8bcc4 };
  if (oh) o.offhand = oh.type === 'shield' ? { type: 'shield', color: oh.color ?? 0x7a5a3a } : oh.dmg ? { type: weaponModel(oh), color: oh.color ?? 0xb8bcc4 } : { type: 'orb' };
  if (!oh && rg && (rg.type === 'bow')) o.offhand = { type: 'bow' };
  if (!mh && rg?.type === 'gun') o.weapon = { type: 'gun' };
  if (!mh && rg?.type === 'wand') o.weapon = { type: 'wand' };
  if (u.ghost) { o.ghost = true; o.weapon = undefined; o.offhand = undefined; }
  return o;
}
function weaponModel(it) {
  const t = it.type;
  if (t === 'polearm' || t === 'staff' || t === 'dagger' || t === 'fist' || t === 'wand' || t === 'gun' || t === 'bow') return t;
  return t; // sword, axe, mace, sword2h, axe2h, mace2h map directly
}

export function formSpec(u, form) {
  const hair = HAIR_COLORS[u.look?.hairColor ?? 0] ?? 0x5a3a1e;
  if (form === 'bear') return { t: 'quad', color: 0x5a3a24, belly: 0x6a4a2a, length: 1.8, legLen: 0.65, width: 0.85, bodyH: 0.85, headSize: 0.5, snout: 0.24, tailLen: 0.15, hump: true, mane: hair, scale: 1.15 };
  if (form === 'cat') return { t: 'quad', color: 0x2e2a28, belly: 0x5a4a3a, length: 1.5, legLen: 0.55, width: 0.42, bodyH: 0.45, headSize: 0.36, snout: 0.16, tailLen: 0.9, tailW: 0.08, eyes: 0xffd040, stripes: hair };
  if (form === 'ghostwolf') return { t: 'quad', color: 0x8ab0d0, length: 1.5, legLen: 0.65, width: 0.45, bodyH: 0.5, headSize: 0.38, snout: 0.34, tailLen: 0.6, tailW: 0.12, eyes: 0xc0f0ff, ghost: true, mane: 0xb0d0f0 };
  return null;
}

export function refreshCharacterModel(u) {
  const spec = u.form && formSpec(u, u.form) ? formSpec(u, u.form) : characterSpec(u);
  u.setModel(buildModel(spec));
  u.radius = u.form === 'bear' ? 0.8 : u.form ? 0.6 : 0.5;
}
