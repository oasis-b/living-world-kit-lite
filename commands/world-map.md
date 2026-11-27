---
description: Draw every map of the RPG Maker game and how they connect, as a diagram
argument-hint: "[optional: a map to center on]"
---

Draw how the maps of this RPG Maker project connect. Center on: $ARGUMENTS

1. Call `list_maps` and `map_connections`.
2. Draw a Mermaid flowchart (`flowchart LR`): one node per map with its id and name, one arrow per transfer. Label an arrow with what it needs when the transfer only happens under a condition (a switch, an item, a choice); read the event with `read_event` when you are not sure. Use a dashed arrow for a one-way trip.
3. Group maps that belong together (a town and its houses, the floors of a dungeon) in subgraphs when their names or connections make it clear.
4. If a map is named above, show only that map and the maps up to two steps away.
5. Below the diagram list what stands out: maps no transfer leads to, dead ends with no way back, transfers to maps that don't exist, and the start map from `project_overview`.

For a large game (more than about 40 maps), draw the main routes and group the rest, and say what you left out.
