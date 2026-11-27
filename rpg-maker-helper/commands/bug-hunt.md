---
description: Find bugs in the RPG Maker project and explain how to fix each one in the editor
argument-hint: "[optional: a map id or name to focus on]"
---

Find bugs in this RPG Maker MV or MZ project and explain the fixes. Focus: $ARGUMENTS

1. Use the rpg-maker-helper skill. Go through the bug checks in its recipes reference for the whole
   project. If a map is named above, put the findings for that map first.
2. For every finding, read the event before you report it. Drop anything that turns out to be fine.
3. Sort what is left:
   - **Breaks the game**: the player gets stuck, a quest can't be finished, the game stops with an error, a transfer goes nowhere
   - **Visible problems**: missing images or sounds, text that does not fit the window, events stacked on top of each other
   - **Cleanup**: leftover notes like TODO, unused switches, small things
4. For each bug give: where it is (map, event, page, position), what goes wrong for the player in one sentence, and the fix as clicks in the editor.
5. End with a short summary: how many bugs of each kind, and which one to fix first.

If nothing is found, say so and name what was checked.
