# Searching the project and finding bugs

## Every place a command appears

Events live in three places: map events (`data/MapXXX.json`, `events[].pages[].list`), common events
(`data/CommonEvents.json`, `[].list`) and troop pages (`data/Troops.json`, `[].pages[].list`).
A search is only complete when it covered all three.

If Node.js or Python is available, walk all lists in one go instead of grepping file by file. A
small throwaway script like this (write it to a temporary file outside the project, run it with
the project folder as argument, delete it afterwards) prints every command that matches:

```js
// usage: node find.js <project folder> <test>, e.g. "c.code===121 && c.parameters[0]<=12 && c.parameters[1]>=12"
const fs = require('fs'), path = require('path');
const dir = path.join(process.argv[2], 'data'), test = new Function('c', 'return ' + process.argv[3]);
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const infos = read('MapInfos.json');
function scan(list, where) { (list || []).forEach((c, i) => { if (test(c)) console.log(where + ' line ' + (i + 1) + ': ' + JSON.stringify(c)); }); }
fs.readdirSync(dir).filter(f => /^Map\d{3}\.json$/.test(f)).forEach(f => {
  const id = +f.slice(3, 6), map = read(f), name = infos[id] ? infos[id].name : '';
  (map.events || []).forEach(e => e && e.pages.forEach((p, n) => scan(p.list,
    `map ${id} "${name}" event ${e.id} "${e.name}" (${e.x},${e.y}) page ${n + 1}`)));
});
read('CommonEvents.json').forEach(ce => ce && scan(ce.list, `common event ${ce.id} "${ce.name}"`));
read('Troops.json').forEach(t => t && t.pages.forEach((p, n) => scan(p.list, `troop ${t.id} "${t.name}" page ${n + 1}`)));
```

Never write into the project folder. Without Node or Python, use Grep on `data/` with a pattern
like `"code":121,"indent":[0-9]+,"parameters":\[12,` and read the surrounding event.

Useful tests:

| Question | Test |
|---|---|
| Where is switch S turned on or off | `c.code===121 && c.parameters[0]<=S && c.parameters[1]>=S` |
| Where is switch S checked in a branch | `c.code===111 && c.parameters[0]===0 && c.parameters[1]===S` |
| Where is variable V changed | `c.code===122 && c.parameters[0]<=V && c.parameters[1]>=V` (also 103, 104, 285 with `parameters[0]===V`) |
| Where is variable V checked | `c.code===111 && c.parameters[0]===1 && c.parameters[1]===V` |
| Where is item I given or taken | `c.code===126 && c.parameters[0]===I` (weapons 127, armors 128) |
| Where is item I checked | `c.code===111 && c.parameters[0]===8 && c.parameters[1]===I` (weapon type 9, armor type 10) |
| Where is item I sold | `(c.code===302 \|\| c.code===605) && c.parameters[0]===0 && c.parameters[1]===I` |
| Every transfer | `c.code===201` |
| A text in messages and choices | `(c.code===401 \|\| c.code===102 \|\| c.code===402) && JSON.stringify(c.parameters).includes('Old Key')` |
| Common event N called | `c.code===117 && c.parameters[0]===N` |
| Plugin commands | `c.code===356 \|\| c.code===357` |

Page conditions are not commands: also check `pages[].conditions` (`switch1Id`, `switch2Id`,
`variableId`, `itemId`, `actorId`) and common events' `switchId`. Enemies drop items through
`Enemies.json` `dropItems: [{kind 1 item / 2 weapon / 3 armor, dataId, denominator}]`.

## Why does X not happen

1. Find the event that should do it (search its text or name).
2. List its pages with their conditions and trigger. Which page is active right now? Remember: the
   highest page whose conditions are all met.
3. For each condition, find where it gets set. Is that place reachable for the player, and does it
   set the same number?
4. Inside the page, follow the branches: which Conditional Branch blocks the way?
5. Check the trigger: Action Button needs the player to face the event and press OK; Player Touch
   needs "Same as characters" or the player must step on it; Autorun without a switch or self switch
   that turns it off freezes the game.

## Bug checks

Go through these when asked to find bugs. Report only what you confirmed by reading the event.

| Bug | How to find it |
|---|---|
| Switch checked but never set | Switch ids in page conditions and type-0 branches that no 121 covers (a plugin or script may set it: search `$gameSwitches.setValue` in 355/655 and plugin parameters) |
| Variable checked but never changed | Same for variables with 122, 103, 104, 285 |
| Transfer to a missing map | 201 direct with a map id that has no `MapXXX.json` |
| Transfer outside the map or onto an event | target x,y outside width/height, or another event with "Same as characters" stands there |
| Missing image | `characterName` of pages, faces in 101, pictures in 231, enemy `battlerName` not found in `img/` |
| Missing sound | names in 241, 245, 249, 250 and map `bgm` not found in `audio/` |
| Text too long | more than 4 lines per Show Text window, or long lines (roughly 50 characters without a face, 40 with one in MV/MZ default size) |
| Lonely last word | a window whose last line holds a single word |
| TODO left in text | `TODO`, `FIXME`, `XXX` in 401, 402, 405 |
| Autorun that never stops | page with trigger 3 whose list never changes a switch, self switch or erases the event, and has no switch condition |
| Broken indentation | `indent` jumps by more than 1, or 411/412/404/413 at a different indent than their opener |
| Unreachable map | a map no 201 leads to and that is not the start map |
| Enemy without image | `Enemies.json` entry used in a troop with an empty `battlerName` |
| Plugin order | an MZ plugin's `@base` or `@orderAfter` plugin is missing or loads after it in `plugins.js`; a plugin with `status: false` that others need |
| Missing plugin file | a name in `plugins.js` without `js/plugins/<name>.js` |

## Map as text

To show a map: read `width`, `height` and the events, then draw a grid with `.` for floor, the
event's first letter at its x,y, and mark transfers. Passability needs the tileset flags
(`Tilesets.json` `flags`, bit 0x0F blocks directions), so only claim a wall when you checked it.
