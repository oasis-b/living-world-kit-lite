# RPG Maker Helper

**Claude explains your RPG Maker MV or MZ project and finds its bugs. Free, read only.**

RPG Maker Helper teaches Claude how RPG Maker MV and MZ store a game: maps, events and their
pages, every event command, the database and the plugin list. Ask about your game in plain words
and Claude reads the real project files and answers in the words of the editor, with map, event,
page and position, so you can find each spot right away. It never changes your project.

## What you can ask

- "Give me an overview of my project."
- "The guard in the castle never lets me through. Why?"
- "Where is switch 12 turned on, and who checks it?"
- "Where does the player get the Old Key?"
- "Check my project for bugs and explain the three most important ones."

## Commands

| Command | What it does |
|---|---|
| `/rpg-maker-helper:bug-hunt` | Finds bugs, sorts them by how bad they are and explains each fix as clicks in the editor |
| `/rpg-maker-helper:explain-map` | Walks through one map: exits, events, what happens where |
| `/rpg-maker-helper:trace` | Follows a switch, variable, item or quest through the whole game and finds where the chain breaks |
| `/rpg-maker-helper:world-map` | Draws every map and transfer as a diagram |
| `/rpg-maker-helper:plugin-audit` | Checks plugin order and conflicts and sums up what each plugin does |

The bug hunt looks for switches checked but never set, transfers to missing maps or outside the
map, missing images and sounds, text too long for the window, TODO notes in game text, Autorun
events that never stop, broken indentation, unreachable maps and plugins in the wrong order.

## How to use it

In Claude Code:

    /plugin install rpg-maker-helper --marketplace oasis-b/living-world-kit-lite

In the Claude desktop app, add it from the plugin directory.

Open Claude Code or a Cowork session in your game folder (the one with `Game.rpgproject` or
`game.rmmzproject`), or tell Claude where your game is. Then just ask.

## Want it faster and more exact?

**Living World Kit Lite** is the same idea with a small read-only tool server: events decoded in
plain words, every switch, variable and item usage in one step, maps as text grids and a full
project check. Free and open source:

    /plugin install living-world-kit-lite --marketplace oasis-b/living-world-kit-lite

https://github.com/oasis-b/living-world-kit-lite

**Living World Kit for Claude** lets Claude also build maps and events and playtest your game in a
real browser: https://oasis-b.itch.io/living-world-kit-for-claude

## Privacy

RPG Maker Helper contains only instructions for Claude. It runs no program of its own, opens no
connection and stores nothing. Claude reads your project with its usual tools inside your own
session.

---

MIT license, see LICENSE. Made by oasis-b. Not affiliated with Anthropic or Gotcha Gotcha Games.
Claude is a trademark of Anthropic. RPG Maker is a trademark of Gotcha Gotcha Games.
