---
description: Check the plugin list of the RPG Maker project for order problems and conflicts, and summarize what each plugin does
---

Audit the plugins of this RPG Maker MV or MZ project.

1. Call `plugin_help` without a name for the list in load order, and `check_project` for plugin problems (wrong order, missing files, plugins that overwrite the same engine function, unknown notetags or plugin commands).
2. For each active plugin, read its help with `plugin_help` and its name when you need more than the one-line description. Note what it needs ("Needs", "Place below", "Requires" in its help) and check that the order in the list fits.
3. Report:
   - **Problems** first: wrong order, missing files, plugins that are off but still used by events, conflicts. For each, the fix as clicks in the Plugin Manager.
   - **What is installed**: a short table with plugin, on or off, and what it does in one line.
   - **Worth knowing**: plugins that change the same area (battle, menus, messages) and could get in each other's way.
4. Say clearly when a judgement comes from the plugin's help and when it is your guess.
