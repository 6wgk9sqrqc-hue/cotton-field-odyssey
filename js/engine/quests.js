// Quest log, objective tracking and rewards.
import { G, emit, on } from '../state.js';
import { QUESTS } from '../data/quests.js';
import { getItem } from '../data/items.js';
import { questXP, questMoney, MAX_LEVEL } from '../data/classes.js';
import { addItem, removeItem, countItem, freeSlots } from './inventory.js';
import { gainXP } from './progression.js';
import { moneyText } from '../util.js';

export const MAX_QUESTS = 20;

export function questState(u, id) {
  if (u.quests.completed[id]) return 'completed';
  const a = u.quests.active[id];
  if (a) return isComplete(u, id) ? 'ready' : 'active';
  return 'none';
}
export function canAccept(u, q) {
  if (u.quests.completed[q.id] || u.quests.active[q.id]) return false;
  if (q.prev && !u.quests.completed[q.prev]) return false;
  if (q.classes && !q.classes.includes(u.cls)) return false;
  return true;
}
// "!" over a quest giver: yellow if level-appropriate, gray if not yet.
export function npcQuestMarker(u, npcId) {
  let best = null;
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (q.turnin === npcId && u.quests.active[id]) {
      if (isComplete(u, id)) return 'turnin';
      if (q.giver === npcId || !best) best = best ?? 'progress';
    }
  }
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (q.giver !== npcId || !canAccept(u, q)) continue;
    if (u.level >= q.minLevel) return 'available';
    if (u.level >= q.minLevel - 2) best = best ?? 'low';
  }
  return best;
}
export function questsForNpc(u, npcId) {
  const offer = [], progress = [], ready = [];
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (q.turnin === npcId && u.quests.active[id]) (isComplete(u, id) ? ready : progress).push(q);
    else if (q.giver === npcId && canAccept(u, q) && u.level >= q.minLevel) offer.push(q);
  }
  return { offer, progress, ready };
}

export function goalProgress(u, q, i) {
  const g = q.goals[i];
  const a = u.quests.active[q.id];
  if (!a) return 0;
  if (g.kind === 'item') return Math.min(g.n, countItem(u, g.item));
  if (g.kind === 'explore') return a.progress[i] ? 1 : 0;
  return Math.min(g.n, a.progress[i] ?? 0);
}
export function goalTarget(g) { return g.kind === 'explore' ? 1 : g.n; }
export function isComplete(u, id) {
  const q = QUESTS[id];
  return q.goals.every((g, i) => goalProgress(u, q, i) >= goalTarget(g));
}
export function goalText(u, q, i) {
  const g = q.goals[i];
  const p = goalProgress(u, q, i), n = goalTarget(g);
  if (g.kind === 'kill') return `${g.label ?? (MOB_NAME(g.mob) + ' slain')}: ${p}/${n}`;
  if (g.kind === 'item') return `${getItem(g.item)?.name}: ${p}/${n}`;
  if (g.kind === 'explore') return `${g.label}${p ? '' : ''}: ${p}/${n}`;
  return `${g.label}: ${p}/${n}`;
}
let MOB_NAME = (id) => id;
export function setMobNamer(fn) { MOB_NAME = fn; }

export function acceptQuest(u, id) {
  const q = QUESTS[id];
  if (!q || !canAccept(u, q)) return false;
  if (Object.keys(u.quests.active).length >= MAX_QUESTS) { emit('error', 'Your quest log is full.'); return false; }
  u.quests.active[id] = { progress: q.goals.map(() => 0), accepted: Date.now() };
  emit('system', `Quest accepted: ${q.name}`);
  emit('questsChanged', { unit: u, accepted: id });
  if (!q.goals.length) emit('questsChanged', { unit: u });
  return true;
}
export function abandonQuest(u, id) {
  const q = QUESTS[id];
  if (!u.quests.active[id]) return;
  delete u.quests.active[id];
  for (const g of q.goals) if (g.kind === 'item' && getItem(g.item)?.quest) removeItem(u, g.item, countItem(u, g.item));
  emit('system', `Quest abandoned: ${q.name}`);
  emit('questsChanged', { unit: u });
}
export function turnInQuest(u, id, choiceIdx) {
  const q = QUESTS[id];
  if (!u.quests.active[id] || !isComplete(u, id)) return false;
  const r = q.reward ?? {};
  const itemsNeeded = (r.items?.length ?? 0) + (r.choice?.length ? 1 : 0);
  if (freeSlots(u) < itemsNeeded) { emit('error', 'Inventory is full.'); return false; }
  if (r.choice?.length && (choiceIdx === undefined || choiceIdx === null)) { emit('error', 'Choose a reward first.'); return false; }
  for (const g of q.goals) if (g.kind === 'item' && getItem(g.item)?.quest) removeItem(u, g.item, g.n);
  delete u.quests.active[id];
  u.quests.completed[id] = true;
  const xp = u.level >= MAX_LEVEL ? 0 : questXP(q.level, u.level, r.xpMult ?? 1);
  const money = Math.round(questMoney(q.level) * (r.money ?? (q.goals.length ? 1 : 0.3)) + (u.level >= MAX_LEVEL ? questXP(q.level, u.level) * 0.6 : 0));
  if (money) { u.money += money; emit('money', { unit: u }); }
  for (const [iid, n] of r.items ?? []) addItem(u, iid, n);
  if (r.choice?.length) addItem(u, r.choice[choiceIdx], 1);
  emit('questComplete', { unit: u, quest: q, xp, money });
  emit('system', `${q.name} completed.` + (money ? ` Received ${moneyText(money)}.` : ''));
  if (xp) gainXP(u, xp, 'quest');
  emit('questsChanged', { unit: u });
  return true;
}
export function questRewardXP(u, q) { return u.level >= MAX_LEVEL ? 0 : questXP(q.level, u.level, q.reward?.xpMult ?? 1); }
export function questRewardMoney(q) { return Math.round(questMoney(q.level) * ((q.reward ?? {}).money ?? (q.goals.length ? 1 : 0.3))); }

// ---------- progress hooks ----------
export function creditKill(u, tplId) {
  let changed = false;
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    q.goals.forEach((g, i) => {
      if (g.kind === 'kill' && g.mob === tplId) {
        const a = u.quests.active[id];
        if ((a.progress[i] ?? 0) < g.n) {
          a.progress[i] = (a.progress[i] ?? 0) + 1;
          changed = true;
          emit('questProgress', { text: goalText(u, q, i), done: a.progress[i] >= g.n });
        }
      }
    });
  }
  if (changed) emit('questsChanged', { unit: u });
}
export function creditUse(u, useId) {
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    q.goals.forEach((g, i) => {
      if (g.kind === 'use' && g.id === useId) {
        const a = u.quests.active[id];
        if ((a.progress[i] ?? 0) < g.n) {
          a.progress[i] = (a.progress[i] ?? 0) + 1;
          emit('questProgress', { text: goalText(u, q, i), done: a.progress[i] >= g.n });
        }
      }
    });
  }
  emit('questsChanged', { unit: u });
}
export function creditExplore(u, areaId) {
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    q.goals.forEach((g, i) => {
      if (g.kind === 'explore' && g.area === areaId && !u.quests.active[id].progress[i]) {
        u.quests.active[id].progress[i] = 1;
        emit('questProgress', { text: goalText(u, q, i), done: true });
        emit('questsChanged', { unit: u });
      }
    });
  }
}
// Quest drops that should appear on this corpse.
export function questDrops(u, mob) {
  const out = [];
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    q.goals.forEach((g, i) => {
      if (g.kind !== 'item' || !g.from?.includes(mob.tplId)) return;
      if (goalProgress(u, q, i) >= g.n) return;
      if (Math.random() < (g.chance ?? 0.5)) out.push([g.item, 1]);
    });
  }
  return out;
}
// Does the player need this item for a quest right now?
export function wantsQuestItem(u, itemId) {
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    for (let i = 0; i < q.goals.length; i++) {
      const g = q.goals[i];
      if (g.kind === 'item' && g.item === itemId && goalProgress(u, q, i) < g.n) return true;
    }
  }
  return false;
}
export function wantsUse(u, useId) {
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    for (let i = 0; i < q.goals.length; i++) {
      const g = q.goals[i];
      if (g.kind === 'use' && g.id === useId && goalProgress(u, q, i) < g.n) return true;
    }
  }
  return false;
}
// item pickups update progress messages
on('bagsChanged', (e) => {
  if (!e?.added || !G.player || e.unit !== G.player) return;
  const u = G.player;
  for (const id in u.quests.active) {
    const q = QUESTS[id];
    q.goals.forEach((g, i) => {
      if (g.kind === 'item' && g.item === e.added) emit('questProgress', { text: goalText(u, q, i), done: goalProgress(u, q, i) >= g.n });
    });
  }
  emit('questsChanged', { unit: u });
});
