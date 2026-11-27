# RPG Maker MV and MZ data format

All game data is JSON in `data/`. Arrays of database entries start with `null` at index 0, so the
entry with id 5 sits at index 5.

## Project files

| File or folder | What it holds |
|---|---|
| `Game.rpgproject` (MV), `game.rmmzproject` (MZ) | Marks the project folder |
| `js/rpg_core.js` (MV), `js/rmmz_core.js` (MZ) | Engine, tells you which one it is |
| `js/plugins.js` | `var $plugins = [...]`: plugins in load order, each `{name, status, description, parameters}` |
| `js/plugins/<Name>.js` | Plugin code, help in the first comment block |
| `img/characters`, `faces`, `pictures`, `enemies`, `sv_enemies`, `sv_actors`, `battlebacks1/2`, `parallaxes`, `tilesets`, `titles1/2`, `system` | Images (`.png`, the name in data has no extension) |
| `audio/bgm`, `bgs`, `me`, `se` | Sounds (`.ogg`, plus `.m4a` for some platforms, the name in data has no extension) |
| `data/System.json` | Title, start, party, switch and variable names, system sounds |
| `data/MapInfos.json` | Map tree: `[null, {id, name, parentId, order}, ...]` |
| `data/MapXXX.json` | One map, `Map001.json` is map 1 |
| `data/CommonEvents.json` | `{id, name, trigger, switchId, list}`; trigger 0 None, 1 Autorun, 2 Parallel, both run while `switchId` is ON |
| `data/Actors.json`, `Classes.json`, `Skills.json`, `Items.json`, `Weapons.json`, `Armors.json`, `Enemies.json`, `Troops.json`, `States.json`, `Animations.json`, `Tilesets.json` | Database tabs |

Every database entry has `id`, `name` and `note`. The note holds the notetags that plugins read,
like `<Something: 5>`.

## System.json

- `gameTitle`, `startMapId`, `startX`, `startY`, `partyMembers` (actor ids)
- `switches[n]` and `variables[n]`: the names shown in the editor, index = id. An empty name means unnamed.
- `titleBgm`, `battleBgm`, `title1Name`, `title2Name`, sounds and the rest of the System tab

## Map files

- `width`, `height`, `tilesetId`, `displayName` (name shown in game), `note`, `bgm`, `encounterList`
- `data`: tile ids, 6 layers. The tile at (x,y) on layer z is `data[(z * height + y) * width + x]`.
  Layers 0 to 3 are tiles, 4 is shadows, 5 is the region id (0 = none).
- `events`: `[null, {...}, ...]`, index = event id, `null` where an event was deleted.

## Events

An event: `{id, name, note, x, y, pages: [...]}`. The editor shows page 1 for `pages[0]`.

A page:

- `conditions`: all ticked ones must be true:
  - `switch1Valid` + `switch1Id`, `switch2Valid` + `switch2Id`: switch is ON
  - `variableValid` + `variableId` + `variableValue`: variable is at least that value (always "≥")
  - `selfSwitchValid` + `selfSwitchCh` ("A" to "D"): self switch ON
  - `itemValid` + `itemId`: party has the item
  - `actorValid` + `actorId`: actor is in the party
- **The active page is the highest page whose conditions are all met.** A later page with no
  conditions hides every page before it.
- `trigger`: 0 Action Button, 1 Player Touch, 2 Event Touch, 3 Autorun, 4 Parallel
- `priorityType`: 0 Below characters, 1 Same as characters, 2 Above characters
- `image`: `{characterName, characterIndex, direction, pattern, tileId}`; empty name and tileId 0 = no graphic
- `moveType` 0 Fixed, 1 Random, 2 Approach, 3 Custom (`moveRoute`); `through`, `directionFix`, `walkAnime`, `stepAnime`
- `list`: the commands, see event-commands.md. Each is `{code, indent, parameters}`. `indent` is
  the nesting depth inside branches, choices and loops. The list always ends with code 0.

Troops (`Troops.json`) have `pages` too, with battle conditions (`turnValid`, `enemyValid`,
`actorValid`, `switchValid`, `span` 0 Battle, 1 Turn, 2 Moment) and a `list`.

## MV and MZ differences

- Show Text (101) has a 5th parameter in MZ: the speaker name.
- Plugin commands: MV uses 356 with one text line (`"PluginName arg arg"`); MZ uses 357
  `[pluginName, commandName, commandText, {args}]` followed by 657 lines that only display the args.
- MZ plugins declare commands in their header with `@command` and `@arg`, and dependencies with
  `@base` and `@orderAfter`. MV plugins describe their commands in `@help`.
- MZ battle is time-based (TPB) or turn-based, set in System.json `battleSystem`.
- MZ ships extra sample plugins in `js/plugins` that may not be in `plugins.js`; that is normal.
