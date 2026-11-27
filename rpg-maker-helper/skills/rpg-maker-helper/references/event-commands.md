# Event command codes (MV and MZ)

Each command is `{code, indent, parameters}`. Codes 400 and up continue the command above them.
`p[0]` is the first parameter. For Control commands "ON" is 0 and "OFF" is 1.

## Message

| Code | Editor name | Parameters |
|---|---|---|
| 101 | Show Text | face name, face index, background (0 window, 1 dim, 2 transparent), position (0 top, 1 middle, 2 bottom), MZ: speaker name. The lines follow as 401 `[text]` |
| 102 | Show Choices | choices (array), cancel (-2 branch, -1 disallow, else choice index), default, position, background. Then 402 `[index, text]` When, 403 When Cancel, 404 end |
| 103 | Input Number | variable id, digits |
| 104 | Select Item | variable id, item type |
| 105 | Show Scrolling Text | speed, no fast. Lines as 405 |
| 108 | Comment | first line; more lines as 408 |

Text codes inside messages: `\V[n]` variable, `\N[n]` actor name, `\P[n]` party member, `\C[n]` color,
`\I[n]` icon, `\G` currency, `\{` `\}` size, `\.` `\|` waits, `\!` wait for button, `\>` `\<` instant.

## Flow control

| Code | Editor name | Parameters |
|---|---|---|
| 111 | Conditional Branch | see below. 411 Else, 412 End |
| 112 | Loop | 413 Repeat Above |
| 113 | Break Loop | |
| 115 | Exit Event Processing | |
| 117 | Common Event | common event id |
| 118 | Label | name |
| 119 | Jump to Label | name |

Conditional Branch `p[0]` is the type:

| Type | Checks | Parameters |
|---|---|---|
| 0 | Switch | `[0, switchId, 0 ON / 1 OFF]` |
| 1 | Variable | `[1, variableId, 0 constant / 1 variable, value or variable id, op]`, op 0 `=`, 1 `≥`, 2 `≤`, 3 `>`, 4 `<`, 5 `≠` |
| 2 | Self Switch | `[2, "A", 0 ON / 1 OFF]` |
| 3 | Timer | `[3, seconds, 0 ≥ / 1 ≤]` |
| 4 | Actor | `[4, actorId, check, value]`: 0 in party, 1 name, 2 class, 3 skill, 4 weapon, 5 armor, 6 state |
| 5 | Enemy | `[5, enemy index, 0 appeared / 1 state, stateId]` |
| 6 | Character | `[6, -1 player / 0 this / event id, direction 2 down 4 left 6 right 8 up]` |
| 7 | Gold | `[7, amount, 0 ≥ / 1 ≤ / 2 <]` |
| 8 | Item | `[8, itemId]` |
| 9 | Weapon | `[9, weaponId, include equipped]` |
| 10 | Armor | `[10, armorId, include equipped]` |
| 11 | Button | `[11, button name]` |
| 12 | Script | `[12, code]` |
| 13 | Vehicle | `[13, 0 boat / 1 ship / 2 airship]` |

## Game progression

| Code | Editor name | Parameters |
|---|---|---|
| 121 | Control Switches | first id, last id, 0 ON / 1 OFF |
| 122 | Control Variables | first id, last id, operation (0 Set, 1 Add, 2 Sub, 3 Mul, 4 Div, 5 Mod), operand type (0 constant, 1 variable, 2 random, 3 game data, 4 script), operand value(s) |
| 123 | Control Self Switch | "A" to "D", 0 ON / 1 OFF |
| 124 | Control Timer | 0 start (seconds) / 1 stop |

## Party

| Code | Editor name | Parameters |
|---|---|---|
| 125 | Change Gold | 0 increase / 1 decrease, 0 constant / 1 variable, value |
| 126 | Change Items | item id, 0 increase / 1 decrease, 0 constant / 1 variable, value |
| 127 | Change Weapons | weapon id, op, operand type, value, include equipped |
| 128 | Change Armors | armor id, op, operand type, value, include equipped |
| 129 | Change Party Member | actor id, 0 add / 1 remove, initialize |

## Movement and map

| Code | Editor name | Parameters |
|---|---|---|
| 201 | Transfer Player | 0 direct / 1 from variables, map id, x, y, direction (0 retain), fade (0 black, 1 white, 2 none). With variables: map, x, y are variable ids |
| 202 | Set Vehicle Location | |
| 203 | Set Event Location | event id (0 this), type, x, y, direction |
| 204 | Scroll Map | direction, distance, speed |
| 205 | Set Movement Route | character (-1 player, 0 this event, else event id), route `{list, repeat, skippable, wait}`; 505 lines repeat the steps |
| 211 | Change Transparency | 0 ON / 1 OFF |
| 212 | Show Animation | character, animation id, wait |
| 213 | Show Balloon Icon | character, balloon id, wait |
| 214 | Erase Event | (until the map is reloaded) |
| 216 | Change Player Followers | 0 ON / 1 OFF |
| 217 | Gather Followers | |
| 281 | Change Map Name Display | |
| 282 | Change Tileset | tileset id |
| 283 | Change Battle Back | |
| 284 | Change Parallax | name, loop, scroll |
| 285 | Get Location Info | variable id, info type, location |

## Picture, screen, timing

| Code | Editor name | Parameters |
|---|---|---|
| 221, 222 | Fadeout Screen, Fadein Screen | |
| 223 | Tint Screen | tone, frames, wait |
| 224 | Flash Screen | color, frames, wait |
| 225 | Shake Screen | power, speed, frames, wait |
| 230 | Wait | frames (60 = 1 second) |
| 231 | Show Picture | number, image name, origin, position type, x, y, scale x, scale y, opacity, blend |
| 232 | Move Picture | number, ... |
| 233, 234, 235 | Rotate, Tint, Erase Picture | number |
| 236 | Set Weather Effect | type, power, frames |

## Audio and video

| Code | Editor name | Parameters |
|---|---|---|
| 241 | Play BGM | `{name, volume, pitch, pan}` |
| 242 | Fadeout BGM | seconds |
| 243, 244 | Save BGM, Resume BGM | |
| 245 | Play BGS | audio |
| 249 | Play ME | audio |
| 250 | Play SE | audio |
| 251 | Stop SE | |
| 261 | Play Movie | file name (in `movies/`) |
| 132, 133, 139, 140 | Change Battle BGM, Victory ME, Defeat ME, Vehicle BGM | audio |

## Scene control

| Code | Editor name | Parameters |
|---|---|---|
| 301 | Battle Processing | 0 direct / 1 variable / 2 same as random encounter, troop id, can escape, can lose. 601 If Win, 602 If Escape, 603 If Lose, 604 end |
| 302 | Shop Processing | goods type (0 item, 1 weapon, 2 armor), id, 0 standard / 1 own price, price, purchase only. More goods as 605 |
| 303 | Name Input Processing | actor id, max characters |
| 351 | Open Menu Screen | |
| 352 | Open Save Screen | |
| 353 | Game Over | |
| 354 | Return to Title Screen | |
| 134, 135, 136, 137 | Change Save, Menu, Encounter, Formation Access | 0 disable / 1 enable |

## Actor

311 Change HP, 312 Change MP, 326 Change TP, 313 Change State, 314 Recover All, 315 Change EXP,
316 Change Level, 317 Change Parameter, 318 Change Skill, 319 Change Equipment, 320 Change Name,
321 Change Class, 322 Change Actor Images, 323 Change Vehicle Image, 324 Change Nickname,
325 Change Profile. Most take `[0 fixed / 1 variable, actor id (0 = whole party), ...]`.

## Battle (troop pages)

331 Change Enemy HP, 332 MP, 342 TP, 333 State, 334 Recover All, 335 Enemy Appear,
336 Enemy Transform, 337 Show Battle Animation, 339 Force Action, 340 Abort Battle.

## Advanced

| Code | Editor name | Parameters |
|---|---|---|
| 355 | Script | first line; more lines as 655 |
| 356 | Plugin Command (MV) | one text line, plugin name first |
| 357 | Plugin Command (MZ) | plugin name, command name, command text, args object; 657 lines only display the args |
