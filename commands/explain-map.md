---
description: Walk through one map of the RPG Maker project, with its events, exits and what happens where
argument-hint: "<map id or name>"
---

Explain this map of the RPG Maker project: $ARGUMENTS

1. If no map is given, call `list_maps` and ask which one. If a name is given, find its id with `list_maps`.
2. Call `view_map` and `list_events` for it, and `map_connections` for the exits.
3. Read every event that matters for the story or the player with `read_event` (NPCs, doors, chests, cutscenes, autorun and parallel events). Skip pure decoration.
4. Explain the map like a tour for someone who opens it in the editor for the first time:
   - what the map is (size, tileset, music, notes) and where the player usually arrives
   - the exits: where each one leads and what it needs (a switch, an item)
   - the events in the order a player meets them: who or what it is, what happens when you talk to it or step on it, and which switches, variables or items it changes or needs
   - anything that runs on its own (autorun, parallel) and when it stops
5. Point out anything that looks wrong along the way, with the fix as clicks in the editor.

Use the map grid from `view_map` only when it helps, and keep it as it is.
