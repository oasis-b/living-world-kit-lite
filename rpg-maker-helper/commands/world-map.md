---
description: Draw every RPG Maker map and how the maps connect as a diagram
---

Draw how the maps of this RPG Maker project connect.

1. Use the rpg-maker-helper skill. Read MapInfos.json for the map names and find every Transfer Player (code 201) in map events and common events.
2. Draw a Mermaid flowchart: one node per map (id and name), one arrow per connection, labelled with the event that does it. Mark the start map from System.json. Group maps by their parent in the map tree.
3. Below the diagram list: maps no transfer leads to (except the start map), transfers to maps that don't exist, and transfers that use variables (they can't be drawn, name the event).
