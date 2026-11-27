---
description: Check RPG Maker plugin order and conflicts and sum up what each plugin does
---

Check the plugins of this RPG Maker project.

1. Use the rpg-maker-helper skill. Read js/plugins.js for the load order and which plugins are on, and the header comment of each js/plugins/<name>.js (only the header).
2. Make a table in load order: name, on or off, what it does in one sentence, author if the header names one.
3. Check: plugin files that are missing, MZ `@base` and `@orderAfter` rules that the order breaks, plugins switched off that others need, two plugins that clearly do the same job, and plugin commands or notetags in the game that belong to a plugin that is off or missing.
4. For every problem give the fix as clicks in the Plugin Manager.
