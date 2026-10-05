# Wardens of the Vale

A classic-style fantasy RPG that runs in the browser (desktop and mobile) and installs as a PWA.
It plays like the original 2004 MMO formula: the same nine classes and their mechanics,
on an original map with original quests, played solo with optional hired companions.

## Play

Any static web server works. Serve this folder:

```sh
cd wardens-of-the-vale
python3 -m http.server 8000
# open http://localhost:8000
```

It can also be hosted on GitHub Pages, Netlify or similar. After the first load it works offline.

### Controls

| Desktop | |
|---|---|
| `W A S D` | move / turn (hold right mouse to strafe with A/D) |
| `Q` `E` | strafe |
| Left mouse drag | look around |
| Right mouse drag | steer the character |
| Both mouse buttons | run forward |
| Mouse wheel | zoom |
| Left click | select target |
| Right click | attack, talk, loot |
| `Tab` | cycle enemy targets |
| `F` | interact with target or the nearest NPC/object |
| `1`–`=` / `Shift`+`1`–`=` | action bars |
| `Space` / `R` / `X` | jump / autorun / sit |
| `C B P N L M` | character, bags, spellbook, talents, quest log, map |
| `Esc` | close windows, clear target, game menu |

On touch screens: drag on the left half to move, drag on the right half to turn the camera,
pinch to zoom, tap a creature to target it and tap again to attack or talk. Hold an action
button to move or clear it.

## What is in the game

**Classes**: Warrior, Paladin, Hunter, Rogue, Priest, Shaman, Mage, Warlock and Druid, each
with their classic abilities and ranks from level 1 to 20, trained at class trainers:

- Warrior: rage from dealing and taking damage, Battle and Defensive stances with stance-locked
  abilities, Charge, Overpower after a dodge, Revenge after a block/dodge/parry, Taunt, Sunder Armor.
- Paladin: Seals and Judgement, Auras, Blessings, Holy Light, Hammer of Justice, Divine
  Protection with Forbearance, Lay on Hands.
- Hunter: Auto Shot with ammunition and the 8-yard dead zone, Aspects, Stings, traps,
  Tame Beast, pet happiness and feeding, Call/Dismiss/Revive/Mend Pet.
- Rogue: energy and combo points, Stealth (and creature detection), Sap, Gouge, Backstab and
  Ambush from behind with daggers, finishing moves, Pick Pocket, Instant Poison, dual wield.
- Priest: Power Word: Shield with Weakened Soul, Renew, Shadow Word: Pain, Psychic Scream, Fade, wands.
- Shaman: shocks on a shared cooldown, weapon imbues, Earth/Fire/Water totems, Lightning Shield, Ghost Wolf.
- Mage: Fireball, Frostbolt chill, Frost Nova, Polymorph, Arcane Missiles, Blink, conjured food and water.
- Warlock: DoTs and curses, Fear, Drain Soul and soul shards, Imp/Voidwalker/Succubus, Healthstones, Life Tap.
- Druid: Bear Form (rage) and Cat Form (energy, combo points), Prowl, shapeshifting out of roots,
  healing over time, Entangling Roots, Hibernate.

**Mechanics**: global cooldown, cast times with pushback, channels and interrupts with school
lockouts, the one-roll melee hit table (miss/dodge/parry/block/crit), armor mitigation, spell
resists, the five-second rule for mana, threat tables with the 110%/130% target-switch rule,
taunts, aggro radius by level difference, social pulls, fleeing humanoids, leashing and evade,
con colors and gray mobs, rested experience, talents (three trees per class from level 10),
item quality tiers with random "of the Bear/Eagle/Monkey…" greens, durability and repair,
vendors with buyback, death, ghost corpse runs and the spirit healer, hearthstones, inns and
flight paths, falling damage, and an elite dungeon.

**World**: Goldmeadow (levels 1–6), Whisperwood (6–12), Saltmarsh Fen (12–16), Ashen Ridge
(16–20) and the Hollow Spire dungeon, with about 45 quests, named bosses, rare spawns and four
towns. Hire a tank, a healer and damage dealers at the Spire Gate camp for the dungeon.

Progress saves automatically to the browser's local storage.

## Code layout

```
index.html, css/game.css    page shell and interface styles
js/main.js                  boot, character creation, main loop
js/engine/                  terrain, scenery, units, combat, spells, AI, quests, inventory, world
js/data/                    classes, abilities, talents, items, creatures, NPCs, spawns, quests
js/ui/                      HUD, windows, tooltips, icons, minimap, character select, sound
js/lib/three.module.min.js  three.js r170 (MIT)
```

No build step and no dependencies beyond the vendored three.js.
