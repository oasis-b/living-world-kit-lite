---
description: Trace a switch, variable, item or quest through the whole RPG Maker game and find why something does not happen
argument-hint: "<switch or variable number or name, an item, or what should happen>"
---

Trace this through the RPG Maker project and explain the whole chain: $ARGUMENTS

1. Work out what to follow:
   - a switch or variable (number or name): use `find_switch_usage` or `find_variable_usage`
   - an item, weapon or armor: find its id with `search_database`, then look for where it is given or checked with `find_text` and by reading the events that use it
   - a quest or "X should happen but doesn't": find the event that should do it with `find_text` or `list_events`, read it with `read_event`, and follow every switch and variable on its page conditions and branches
2. For every place it is set or changed, read the event and note how the player gets there (map, event, trigger, conditions). For every place it is checked, note what it unlocks.
3. Lay out the chain in the order the player would go through it, as a numbered list. Each step names map, event, page and the exact command.
4. If something breaks the chain, say where and why: set but never checked, checked but never set, the wrong number, a page that can never be active, a branch that is never reached, or an event the player can't reach. Give the fix as clicks in the editor.
5. If it helps, add a small Mermaid flowchart of the chain.
