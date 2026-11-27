---
description: Find bugs in the RPG Maker project and explain how to fix each one in the editor
argument-hint: "[optional: a map id or name to focus on]"
---

Find bugs in this RPG Maker MV or MZ project and explain the fixes. Focus: $ARGUMENTS

1. Call `check_project`. If a map is named above, still check the whole project but put the findings for that map first.
2. For every finding that is not obvious, look closer before you explain it: `read_event` for the event, `find_switch_usage` or `find_variable_usage` for switches and variables, `view_map` for transfers into walls or blocked spots. Drop anything that turns out to be fine, and say so.
3. Sort what is left:
   - **Breaks the game**: the player gets stuck, a quest can't be finished, the game stops with an error, a transfer goes nowhere
   - **Visible problems**: missing images or sounds, text that does not fit the window, events stacked on top of each other
   - **Cleanup**: leftover notes like TODO, unused switches, small things
4. For each bug give: where it is (map, event, page, position), what goes wrong for the player in one sentence, and the fix as clicks in the editor.
5. End with a short summary: how many bugs of each kind, and which one to fix first.

If nothing is found, say so and name what was checked.
