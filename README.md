# Living World Kit Lite for RPG Maker

**Claude reads and checks your RPG Maker MV or MZ project. Free, read only.**

Living World Kit Lite connects Claude (Claude Code or the Claude desktop app) to your RPG Maker MV
or MZ project through a small local MCP server. Ask Claude about your game in plain words and it looks
at the real project files: maps, events, database, plugins. It never writes to your project.

## What Claude can do with it

- **Project overview:** engine, start position, party, database sizes, maps, plugins.
- **Maps as text:** see any map as a grid with passability, regions and events.
- **Events as readable commands:** read every event and common event like a script, with switch
  and variable names.
- **Find things:** search the database, find where a switch or variable is set and checked, find any
  text in messages and choices, see how maps connect.
- **Plugin help:** the help text of every installed plugin, from any author, with parameters,
  notetags and plugin commands.
- **Project check** that finds common bugs:
  switches checked but never set, transfers into walls, onto events, into dead ends or to missing
  maps, missing images and sounds, text too long for the message window, single words alone on the
  last line, sentences torn across two windows, TODO notes left in game text, broken indentation in
  event lists, unreachable maps, enemies without a battle image, plugins in the wrong order and
  plugins that replace each other's functions.

Example requests:

- "Give me an overview of my project."
- "Check my project for bugs and explain the three most important ones."
- "The guard in the castle never lets me through. Why?"
- "Where is switch 12 turned on, and who checks it?"
- "Where does the player get the Old Key?"

## Commands

The plugin adds five commands. Type them in Claude Code or Cowork, or just ask in your own words:

| Command | What it does |
|---|---|
| `/living-world-kit-lite:bug-hunt` | Finds bugs, sorts them by how bad they are and explains each fix as clicks in the editor |
| `/living-world-kit-lite:explain-map` | Walks through one map: exits, events, what happens where |
| `/living-world-kit-lite:trace` | Follows a switch, variable, item or quest through the whole game and finds where the chain breaks |
| `/living-world-kit-lite:world-map` | Draws every map and transfer as a diagram |
| `/living-world-kit-lite:plugin-audit` | Checks plugin order and conflicts and sums up what each plugin does |

A skill teaches Claude to explain everything in the words of the RPG Maker editor, with map, event,
page and position, so you can find each spot right away.

## Install

You need an RPG Maker MV or MZ project, Claude Code or the Claude desktop app (Cowork), and
Node.js 18 or newer.

**Claude Code:**

    /plugin install living-world-kit-lite --marketplace oasis-b/living-world-kit-lite

Start Claude Code in your game folder (the one with `Game.rpgproject` or `game.rmmzproject`), or
tell Claude where your game is. It opens the project with the `open_project` tool. Then ask:
"Give me an overview of my project." If something does not work, ask Claude to run `check_setup`.

**Claude desktop app:** add the plugin from the directory, start a Cowork session on your computer
and tell Claude which game to look at.

## Tools

| Tool | What it does |
|---|---|
| `check_setup` | Checks Node.js and the project folder, says how to fix problems |
| `open_project` | Opens a game folder, or lists the games it finds |
| `project_overview` | Engine, title, start, party, maps, database, plugins |
| `list_maps`, `view_map` | All maps, and one map as a text grid with events and exits |
| `list_events`, `read_event`, `read_common_event` | Events with every page and command in plain words |
| `search_database` | Actors, items, skills, enemies, troops, states and more |
| `find_switch_usage`, `find_variable_usage` | Where a switch or variable is set and checked |
| `find_item_usage` | Where an item, weapon or armor is given, taken, sold, checked or dropped |
| `find_text` | Text in dialogue, choices, comments, scripts and plugin commands |
| `map_connections` | Every transfer between maps |
| `tiles_used` | The tiles a map uses |
| `check_project` | The project check described above |
| `plugin_help` | Help, parameters, notetags and plugin commands of installed plugins |
| `about_full_kit` | What the full Living World Kit adds |

All tools only read.

## Want Claude to build and playtest too?

The full **Living World Kit for Claude** adds everything that changes and plays your game:

- builds maps from a text layout, events from presets (NPCs, doors, chests, shops, inns, cutscenes),
  database entries and switch names, with a backup of every change and undo
- playtests: Claude starts the real game in a hidden browser, walks, talks, picks choices, fights
  battles and sends screenshots; player profiles play whole chapters and report where they get stuck
- switches plugins on and off in the right order and installs two free Living World plugin packs
- a workflow package: CLAUDE.md template, about 60 lessons from a complete game, planning templates

Get it on itch.io: https://oasis-b.itch.io/living-world-kit-for-claude
Manual and roadmap: https://oasis-b.itch.io/living-world-plugins-docs

## Privacy and what the plugin runs

The plugin starts one local program, `node server/lw_lite.js`, with no dependencies. It reads the
files of the project you open and never writes, deletes or uploads anything. It opens no network
connection. When no project is open, `check_setup` and `open_project` look for game folders in
the current folder, Documents and Desktop and list their paths. Your project reaches Claude only
through the tool answers inside your own Claude session.

---

MIT license, see LICENSE. Made by oasis-b. Not affiliated with Anthropic or Gotcha Gotcha Games. Claude is a trademark of
Anthropic. RPG Maker is a trademark of Gotcha Gotcha Games.
