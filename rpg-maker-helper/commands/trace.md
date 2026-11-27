---
description: Trace a switch, variable, item or quest through the whole RPG Maker game and find why something does not happen
argument-hint: "<switch or variable number or name, an item, or what should happen>"
---

Trace this through the RPG Maker project and explain the whole chain: $ARGUMENTS

1. Use the rpg-maker-helper skill and its recipes reference. Work out what to follow: a switch or
   variable (number or name from System.json), an item, weapon or armor (id from the database), or a
   quest ("X should happen but doesn't": find the event that should do it and follow every switch
   and variable on its page conditions and branches).
2. Find every place it is set, changed, given or taken, and every place it is checked: map events,
   common events and troop pages, plus page conditions. For each, note how the player gets there.
3. Lay out the chain in the order the player would go through it, as a numbered list. Each step names map, event, page and the exact command.
4. If something breaks the chain, say where and why: set but never checked, checked but never set, the wrong number, a page that can never be active, a branch that is never reached, or an event the player can't reach. Give the fix as clicks in the editor.
5. If it helps, add a small Mermaid flowchart of the chain.
