// Character select and creation.
import { G } from '../state.js';
import { CLASSES, CLASS_ORDER, SKIN_TONES, HAIR_COLORS, HAIR_STYLES } from '../data/classes.js';
import { listChars, deleteChar, loadChar, lastCharId, storageWorks } from '../save.js';
import { classIcon } from './hud.js';
import { escapeHTML } from '../util.js';

const $ = (id) => document.getElementById(id);
let sel = null;
let creating = { cls: 'warrior', name: '', look: { skin: 1, hairColor: 0, hairStyle: 0, build: 0 } };
let confirmDel = false;
let onPlay = null;

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const NAMES = ['Aldren', 'Brisa', 'Corwyn', 'Dessa', 'Eamon', 'Fenwick', 'Galen', 'Hesper', 'Ilsabet', 'Joram', 'Kestrel', 'Lorne', 'Maelis', 'Nedra', 'Orrin', 'Perrin', 'Quilla', 'Roderic', 'Sable', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yorick'];

export function showStart(play) {
  onPlay = play;
  const chars = listChars();
  sel = chars.find((c) => c.id === lastCharId())?.id ?? chars[0]?.id ?? null;
  if (!creating.name) creating.name = NAMES[Math.floor(Math.random() * NAMES.length)];
  render();
  $('startScreen').hidden = false;
}
export function hideStart() { $('startScreen').hidden = true; }

function render() {
  const chars = listChars();
  const C = CLASSES[creating.cls];
  $('startScreen').innerHTML = `<div class="ss-wrap">
    <div class="ss-head"><h1>Wardens of the Vale</h1><p>A classic adventure across the Vale. Nine classes. Four zones. One Hollow King.</p></div>
    <div class="ss-cols${chars.length ? '' : ' no-chars'}">
      <section class="ss-section panel">
        <h2>Your Characters</h2>
        ${chars.length ? `<div class="char-list">${chars.map((c) => `<div class="char-row ${c.id === sel ? 'sel' : ''}" data-id="${c.id}" tabindex="0"><img alt="" src="${classIcon(c.cls)}"><div class="meta"><div class="nm" style="color:${CLASSES[c.cls].color}">${escapeHTML(c.name)}</div><div class="sub">Level ${c.level} ${CLASSES[c.cls].name}${c.zone ? ' · ' + escapeHTML(c.zone) : ''}</div></div></div>`).join('')}</div>
        <div class="ss-actions"><button class="btn" id="ssPlay" ${sel ? '' : 'disabled'}>Enter World</button><button class="btn ghosty small" id="ssDelete" ${sel ? '' : 'disabled'}>Delete</button></div>
        ${confirmDel && sel ? `<div class="confirm-del">Delete ${escapeHTML(chars.find((c) => c.id === sel)?.name ?? '')} forever?<div class="ss-actions"><button class="btn small" id="ssDelYes">Delete</button><button class="btn small ghosty" id="ssDelNo">Keep</button></div></div>` : ''}`
          : '<p class="ss-help">No characters yet. Create one to begin your journey in Millbrook, a farming town in Goldmeadow.</p>'}
        ${storageWorks() ? '' : '<p class="ss-help" style="color:#ffb060">Your browser is blocking saved data here, so progress lasts only until you close this page.</p>'}
        <div class="ss-help" style="margin-top:14px">
          <b>Keyboard:</b> <kbd>WASD</kbd> move, mouse to look, <kbd>Tab</kbd> target, <kbd>1</kbd>–<kbd>=</kbd> abilities, right-click to attack or talk.<br>
          <b>Touch:</b> left thumb moves, right thumb turns the camera, tap to target, tap again to interact.
        </div>
      </section>
      <section class="ss-section panel ss-create">
        <h2>Create a Character</h2>
        <div class="class-grid">${CLASS_ORDER.map((id) => `<div class="class-pick ${id === creating.cls ? 'sel' : ''}" data-cls="${id}" tabindex="0"><img alt="" src="${classIcon(id)}"><span style="color:${CLASSES[id].color}">${CLASSES[id].name}</span></div>`).join('')}</div>
        <div class="class-info"><h3 style="color:${C.color}">${C.name}</h3><div class="role">${C.role}</div><p>${C.desc}</p><p class="ss-help">Resource: ${C.power === 'rage' ? 'Rage (builds as you deal and take damage)' : C.power === 'energy' ? 'Energy (refills quickly) and combo points' : 'Mana (regenerates after 5 seconds without casting)'}. Armor: ${C.armor.filter((a) => a !== 'shield').join(', ')}${C.armor.includes('shield') ? ', shields' : ''}. Talent trees: ${C.trees.join(', ')}.</p></div>
        <div class="appear">
          <label>Skin<div class="swatches">${SKIN_TONES.map((c, i) => `<div class="swatch ${creating.look.skin === i ? 'sel' : ''}" data-k="skin" data-v="${i}" style="background:${hex(c)}"></div>`).join('')}</div></label>
          <label>Hair<div class="swatches">${HAIR_COLORS.map((c, i) => `<div class="swatch ${creating.look.hairColor === i ? 'sel' : ''}" data-k="hairColor" data-v="${i}" style="background:${hex(c)}"></div>`).join('')}</div></label>
          <label>Style<div class="swatches">${HAIR_STYLES.map((n, i) => `<button class="btn small ${creating.look.hairStyle === i ? '' : 'ghosty'}" data-k="hairStyle" data-v="${i}">${n}</button>`).join('')}</div></label>
          <label>Build<div class="swatches">${['Lean', 'Broad'].map((n, i) => `<button class="btn small ${creating.look.build === i ? '' : 'ghosty'}" data-k="build" data-v="${i}">${n}</button>`).join('')}</div></label>
        </div>
        <div class="name-row"><input id="ssName" maxlength="14" value="${escapeHTML(creating.name)}" aria-label="Character name" autocomplete="off" spellcheck="false"><button class="btn ghosty small" id="ssRandom">Random name</button><button class="btn" id="ssCreate">Create &amp; Play</button></div>
      </section>
    </div>
  </div>`;
  document.querySelectorAll('.char-row').forEach((el) => {
    el.addEventListener('click', () => { sel = el.dataset.id; confirmDel = false; render(); });
    el.addEventListener('dblclick', () => play(el.dataset.id));
  });
  document.querySelectorAll('.class-pick').forEach((el) => el.addEventListener('click', () => { creating.cls = el.dataset.cls; render(); }));
  document.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); creating.look[el.dataset.k] = +el.dataset.v; render(); }));
  const nameEl = $('ssName');
  nameEl.addEventListener('input', () => { creating.name = nameEl.value; });
  nameEl.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') create(); });
  $('ssRandom').addEventListener('click', () => { creating.name = NAMES[Math.floor(Math.random() * NAMES.length)]; render(); });
  $('ssCreate').addEventListener('click', create);
  $('ssPlay')?.addEventListener('click', () => play(sel));
  $('ssDelete')?.addEventListener('click', () => { confirmDel = true; render(); });
  $('ssDelYes')?.addEventListener('click', () => { deleteChar(sel); sel = listChars()[0]?.id ?? null; confirmDel = false; render(); });
  $('ssDelNo')?.addEventListener('click', () => { confirmDel = false; render(); });
}
function create() {
  let name = (creating.name || '').replace(/[^A-Za-z' -]/g, '').trim();
  if (name.length < 2) name = NAMES[Math.floor(Math.random() * NAMES.length)];
  name = name.charAt(0).toUpperCase() + name.slice(1);
  onPlay({ new: true, name, cls: creating.cls, look: { ...creating.look } });
}
function play(id) {
  const data = loadChar(id);
  if (!data) return;
  onPlay({ save: data });
}
