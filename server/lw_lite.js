#!/usr/bin/env node
/*
 * Living World Kit Lite for Claude - read and check RPG Maker MV and MZ projects
 * by oasis-b. MIT license, see LICENSE.txt.
 *
 * Connects Claude (Claude Desktop or Claude Code) to an RPG Maker MV or MZ project, read only:
 * project overview, maps as text, events as readable commands, database search, switch and
 * variable usage, plugin help, and a project check that finds common bugs.
 * It never writes to your project.
 *
 * Building maps and events, playtests in a hidden browser and the free Living World plugin packs
 * are in the full Living World Kit for Claude: https://oasis-b.itch.io/living-world-kit-for-claude
 *
 * No dependencies: plain Node.js 18 or newer.
 * Usage:   node lw_lite.js /path/to/your/project      (or set LW_PROJECT)
 * Built from the full kit 1.1.1 by kit/tools/build_lite.py. Do not edit by hand.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var readline = require('readline');

var VERSION = '1.0.0';
var FULL_KIT = 'https://oasis-b.itch.io/living-world-kit-for-claude';


// The project is the last argument. Wrappers (like Claude Desktop's) may put other paths in front.
var PROJECT_GIVEN = process.argv.slice(2).filter(function (a) { return !/lw_mcp\.js$/.test(a) && a.indexOf('--') !== 0; }).pop() || process.env.LW_PROJECT || '';
var PROJECT = findProject(PROJECT_GIVEN || '.');

// People pick all kinds of folders: the project file, the folder above the project,
// a deployed game with www/. Find the real project folder (the one with data/System.json).
function findProject(given) {
    var p = path.resolve(String(given).replace(/^~(?=$|[\/\\])/, require('os').homedir()).replace(/^["']|["']$/g, ''));
    var has = function (d) { return fs.existsSync(path.join(d, 'data', 'System.json')); };
    try { if (fs.statSync(p).isFile()) p = path.dirname(p); } catch (e) { return p; }
    if (has(p)) return p;
    if (path.basename(p) === 'data' && has(path.dirname(p))) return path.dirname(p);
    if (has(path.join(p, 'www'))) return path.join(p, 'www');
    var subs = [];
    try { subs = fs.readdirSync(p).filter(function (n) { return n[0] !== '.' && has(path.join(p, n)); }); } catch (e) { /* unreadable */ }
    if (subs.length === 1) return path.join(p, subs[0]);
    return p;
}

var MAX_OUT = 30000; // characters per tool result, keeps long sessions affordable

var cache = {};

function dataPath(name) {
    return path.join(PROJECT, 'data', name);
}

function readData(name) {
    var file = dataPath(name);
    var stat;
    try {
        stat = fs.statSync(file);
    } catch (e) {
        throw new Error('File not found: data/' + name);
    }
    var hit = cache[file];
    if (hit && hit.mtime === stat.mtimeMs) return hit.json;
    var text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var json = JSON.parse(text);
    cache[file] = { mtime: stat.mtimeMs, json: json };
    return json;
}

function mapFile(id) {
    return 'Map' + String(id).padStart(3, '0') + '.json';
}

function readMap(id) {
    return readData(mapFile(id));
}

function mapInfos() {
    return readData('MapInfos.json');
}

function mapIds() {
    var infos = mapInfos();
    var ids = [];
    for (var i = 1; i < infos.length; i++) {
        if (infos[i] && fs.existsSync(dataPath(mapFile(i)))) ids.push(i);
    }
    return ids;
}

function mapName(id) {
    var info = mapInfos()[id];
    return info ? info.name : '(missing map ' + id + ')';
}

function system() {
    return readData('System.json');
}

function switchName(id) {
    var n = system().switches[id];
    return n ? n : '';
}

function variableName(id) {
    var n = system().variables[id];
    return n ? n : '';
}

function isProject() {
    return fs.existsSync(dataPath('System.json')) && fs.existsSync(dataPath('MapInfos.json'));
}

// One clear sentence on what is wrong with the project folder and how to fix it.
function projectProblem() {
    var fix = ' Fix: ' + (process.env.LW_FROM_BUNDLE ? 'in Claude Desktop open Settings, Extensions, Living World Kit, and pick your project folder again.'
        : 'call open_project with the game folder (the one with Game.rpgproject or game.rmmzproject), or start Claude in that folder.');
    if (!PROJECT_GIVEN) return 'No project folder is set.' + fix;
    if (!fs.existsSync(PROJECT)) return 'The project folder does not exist: ' + PROJECT + '.' + fix;
    var subs = [];
    try { subs = fs.readdirSync(PROJECT).filter(function (n) { return fs.existsSync(path.join(PROJECT, n, 'data', 'System.json')); }); } catch (e) {
        return 'The kit cannot read the project folder ' + PROJECT + ' (' + e.code + '). On macOS allow the app access in System Settings, Privacy & Security, Files and Folders.';
    }
    if (subs.length > 1) return 'The folder ' + PROJECT + ' holds several projects (' + subs.join(', ') + '). Pick one of them.' + fix;
    if (fs.existsSync(dataPath('System.json'))) return 'The project ' + PROJECT + ' has no data/MapInfos.json. Open and save it once in RPG Maker.';
    return 'No RPG Maker MV or MZ project in ' + PROJECT + ' (there is no data/System.json).' + fix;
}

// RPG Maker MZ projects have js/rmmz_core.js and game.rmmzproject, MV projects js/rpg_core.js.
function isMZ() {
    return fs.existsSync(path.join(PROJECT, 'js', 'rmmz_core.js')) || fs.existsSync(path.join(PROJECT, 'game.rmmzproject'));
}

// Settings the MZ editor adds to System.json when it saves a project.
var MZ_ADVANCED_DEFAULTS = { windowOpacity: 192, screenScale: 1, picturesUpperLimit: 100 };

function mzMissingAdvanced() {
    if (!isMZ()) return [];
    var adv;
    try { adv = system().advanced || {}; } catch (e) { return []; }
    return Object.keys(MZ_ADVANCED_DEFAULTS).filter(function (k) { return adv[k] === undefined; });
}

function engineName() {
    return isMZ() ? 'RPG Maker MZ' : 'RPG Maker MV';
}

// Living World plugins are LW_<Name> for MV and LWZ_<Name> for MZ.
var LW_NAME = /^LWZ?_/;
// Plugins that come with a new MZ project and are not in its plugin list.
var MZ_SAMPLE_PLUGINS = ['AltMenuScreen', 'AltSaveScreen', 'ButtonPicture', 'TextPicture'];
var DB_FILES = {
    actor: 'Actors.json', class: 'Classes.json', skill: 'Skills.json', item: 'Items.json',
    weapon: 'Weapons.json', armor: 'Armors.json', enemy: 'Enemies.json', troop: 'Troops.json',
    state: 'States.json', animation: 'Animations.json', tileset: 'Tilesets.json',
    commonevent: 'CommonEvents.json'
};

function dbName(kind, id) {
    try {
        var list = readData(DB_FILES[kind]);
        var e = list[id];
        return e && e.name ? e.name : '#' + id;
    } catch (e) {
        return '#' + id;
    }
}

function swRange(a, b) {
    if (a === b) return 'S' + a + nameTag(switchName(a));
    return 'S' + a + '..S' + b;
}

function varRange(a, b) {
    if (a === b) return 'V' + a + nameTag(variableName(a));
    return 'V' + a + '..V' + b;
}

function nameTag(n) {
    return n ? ' "' + n + '"' : '';
}

var OPS = ['=', '+=', '-=', '*=', '/=', '%='];

function operandText(p) {
    // control variables operand (params 3..)
    switch (p[3]) {
        case 0: return String(p[4]);
        case 1: return 'V' + p[4];
        case 2: return 'random ' + p[4] + '..' + p[5];
        case 3: return 'game data';
        case 4: return 'script ' + p[4];
    }
    return '?';
}

function conditionText(p) {
    switch (p[0]) {
        case 0: return 'switch ' + swRange(p[1], p[1]) + ' is ' + (p[2] === 0 ? 'ON' : 'OFF');
        case 1: return 'variable ' + varRange(p[1], p[1]) + ' ' + ['==', '>=', '<=', '>', '<', '!='][p[4]] +
            ' ' + (p[2] === 0 ? p[3] : 'V' + p[3]);
        case 2: return 'self switch ' + p[1] + ' is ' + (p[2] === 0 ? 'ON' : 'OFF');
        case 3: return 'timer ' + (p[2] === 0 ? '>=' : '<=') + ' ' + p[1] + 's';
        case 4: return 'actor ' + dbName('actor', p[1]) + ' condition ' + p[2];
        case 5: return 'enemy #' + (p[1] + 1) + ' condition ' + p[2];
        case 6: return 'character ' + p[1] + ' facing ' + p[2];
        case 7: return 'gold ' + ['>=', '<=', '<'][p[2]] + ' ' + p[1];
        case 8: return 'has item ' + dbName('item', p[1]);
        case 9: return 'has weapon ' + dbName('weapon', p[1]);
        case 10: return 'has armor ' + dbName('armor', p[1]);
        case 11: return 'button ' + p[1] + ' pressed';
        case 12: return 'script: ' + p[1];
        case 13: return 'vehicle ' + p[1] + ' driven';
    }
    return 'condition ' + JSON.stringify(p);
}

function audioName(a) {
    return a && a.name ? a.name : '(none)';
}

function commandText(cmd) {
    var p = cmd.parameters || [];
    switch (cmd.code) {
        case 0: return null;
        case 101: return 'Text' + (p[4] ? ' [name ' + p[4] + ']' : '') + (p[0] ? ' [face ' + p[0] + ':' + p[1] + ']' : '') +
            (p[2] !== 0 ? ' bg' + p[2] : '') + (p[3] !== 2 ? ' pos' + p[3] : '') + ':';
        case 401: return '  "' + p[0] + '"';
        case 102: return 'Choices: ' + p[0].map(function (c, i) { return (i + 1) + ') ' + c; }).join(' | ');
        case 402: return 'When ' + (p[0] + 1) + ') ' + p[1] + ':';
        case 403: return 'When cancel:';
        case 404: return 'End choices';
        case 103: return 'Input number -> V' + p[0] + ' (' + p[1] + ' digits)';
        case 104: return 'Select item -> V' + p[0];
        case 105: return 'Scrolling text:';
        case 405: return '  "' + p[0] + '"';
        case 108: return '// ' + p[0];
        case 408: return '// ' + p[0];
        case 111: return 'If ' + conditionText(p) + ':';
        case 411: return 'Else:';
        case 412: return 'End if';
        case 112: return 'Loop:';
        case 413: return 'Repeat above';
        case 113: return 'Break loop';
        case 115: return 'Exit event processing';
        case 117: return 'Call common event ' + p[0] + ' "' + dbName('commonevent', p[0]) + '"';
        case 118: return 'Label: ' + p[0];
        case 119: return 'Jump to label: ' + p[0];
        case 121: return 'Switch ' + swRange(p[0], p[1]) + ' = ' + (p[2] === 0 ? 'ON' : 'OFF');
        case 122: return 'Variable ' + varRange(p[0], p[1]) + ' ' + OPS[p[2]] + ' ' + operandText(p);
        case 123: return 'Self switch ' + p[0] + ' = ' + (p[1] === 0 ? 'ON' : 'OFF');
        case 124: return 'Timer ' + (p[0] === 0 ? 'start ' + p[1] + 's' : 'stop');
        case 125: return 'Gold ' + (p[0] === 0 ? '+' : '-') + (p[1] === 0 ? p[2] : 'V' + p[2]);
        case 126: return 'Item ' + dbName('item', p[0]) + ' ' + (p[1] === 0 ? '+' : '-') + (p[2] === 0 ? p[3] : 'V' + p[3]);
        case 127: return 'Weapon ' + dbName('weapon', p[0]) + ' ' + (p[1] === 0 ? '+' : '-') + (p[2] === 0 ? p[3] : 'V' + p[3]);
        case 128: return 'Armor ' + dbName('armor', p[0]) + ' ' + (p[1] === 0 ? '+' : '-') + (p[2] === 0 ? p[3] : 'V' + p[3]);
        case 129: return 'Party ' + (p[1] === 0 ? 'add ' : 'remove ') + dbName('actor', p[0]);
        case 132: return 'Change battle BGM ' + audioName(p[0]);
        case 134: return 'Save access ' + (p[0] === 0 ? 'off' : 'on');
        case 135: return 'Menu access ' + (p[0] === 0 ? 'off' : 'on');
        case 136: return 'Encounters ' + (p[0] === 0 ? 'off' : 'on');
        case 201: return 'Transfer player -> ' + (p[0] === 0 ? 'map ' + p[1] + ' "' + mapName(p[1]) + '" (' + p[2] + ',' + p[3] + ')' : 'variables V' + p[1] + ',V' + p[2] + ',V' + p[3]);
        case 202: return 'Set vehicle location';
        case 203: return 'Set event ' + p[0] + ' location';
        case 204: return 'Scroll map';
        case 205: return 'Move route for ' + (p[0] === -1 ? 'player' : p[0] === 0 ? 'this event' : 'event ' + p[0]) +
            (p[1].wait ? ' (wait)' : '') + ': ' + p[1].list.filter(function (m) { return m.code; }).length + ' steps';
        case 505: return null;
        case 211: return 'Transparency ' + (p[0] === 0 ? 'on' : 'off');
        case 212: return 'Show animation ' + dbName('animation', p[1]) + ' on ' + (p[0] === -1 ? 'player' : p[0] === 0 ? 'this event' : 'event ' + p[0]);
        case 213: return 'Balloon ' + p[1] + ' on ' + (p[0] === -1 ? 'player' : p[0] === 0 ? 'this event' : 'event ' + p[0]);
        case 214: return 'Erase event';
        case 216: return 'Followers ' + (p[0] === 0 ? 'show' : 'hide');
        case 217: return 'Gather followers';
        case 221: return 'Fade out';
        case 222: return 'Fade in';
        case 223: return 'Tint screen ' + JSON.stringify(p[0]) + ' ' + p[1] + 'f';
        case 224: return 'Flash screen';
        case 225: return 'Shake screen';
        case 230: return 'Wait ' + p[0] + 'f';
        case 231: return 'Show picture ' + p[0] + ' "' + p[1] + '"';
        case 232: return 'Move picture ' + p[0];
        case 235: return 'Erase picture ' + p[0];
        case 236: return 'Weather ' + p[0];
        case 241: return 'Play BGM ' + audioName(p[0]);
        case 242: return 'Fade out BGM';
        case 245: return 'Play BGS ' + audioName(p[0]);
        case 249: return 'Play ME ' + audioName(p[0]);
        case 250: return 'Play SE ' + audioName(p[0]);
        case 251: return 'Stop SE';
        case 261: return 'Play movie ' + p[0];
        case 281: return 'Map name display ' + (p[0] === 0 ? 'on' : 'off');
        case 282: return 'Change tileset ' + dbName('tileset', p[0]);
        case 283: return 'Change battleback';
        case 284: return 'Change parallax ' + p[0];
        case 285: return 'Get location info -> V' + p[0];
        case 301: return 'Battle ' + (p[0] === 0 ? 'troop ' + p[1] + ' "' + dbName('troop', p[1]) + '"' : p[0] === 1 ? 'troop from V' + p[1] : 'random encounter') +
            (p[2] ? ' (can escape)' : '') + (p[3] ? ' (can lose)' : '');
        case 601: return 'If win:';
        case 602: return 'If escape:';
        case 603: return 'If lose:';
        case 604: return 'End battle branches';
        case 302: return 'Shop: ' + shopGood(p) + (p[4] ? ' (buy only)' : '');
        case 605: return '  also ' + shopGood(p);
        case 303: return 'Name input for ' + dbName('actor', p[0]);
        case 311: return 'Change HP';
        case 312: return 'Change MP';
        case 313: return 'Change state';
        case 314: return 'Recover all';
        case 315: return 'Change EXP';
        case 316: return 'Change level';
        case 318: return 'Change skill';
        case 319: return 'Change equipment';
        case 320: return 'Change name of ' + dbName('actor', p[0]) + ' to ' + p[1];
        case 322: return 'Change actor image';
        case 351: return 'Open menu';
        case 352: return 'Open save screen';
        case 353: return 'Game over';
        case 354: return 'Return to title';
        case 355: return 'Script: ' + p[0];
        case 655: return '  ' + p[0];
        case 356: return 'Plugin command: ' + p[0];
        case 357: return 'Plugin command: ' + p[0] + ' ' + p[1] + (p[3] && Object.keys(p[3]).length ? ' ' + JSON.stringify(p[3]) : '');
        case 657: return null;
    }
    return 'Command ' + cmd.code + ' ' + JSON.stringify(p).slice(0, 120);
}

function shopGood(p) {
    var kind = ['item', 'weapon', 'armor'][p[0]];
    return kind + ' ' + dbName(kind, p[1]) + (p[2] === 1 ? ' at ' + p[3] : '');
}

function listText(list, indentBase) {
    var out = [];
    (list || []).forEach(function (cmd) {
        var t = commandText(cmd);
        if (t === null) return;
        out.push('  '.repeat(Math.max(0, (cmd.indent || 0) + (indentBase || 0))) + t);
    });
    return out;
}

var TRIGGERS = ['action button', 'player touch', 'event touch', 'autorun', 'parallel'];

function pageConditions(c) {
    var out = [];
    if (c.switch1Valid) out.push('switch ' + swRange(c.switch1Id, c.switch1Id));
    if (c.switch2Valid) out.push('switch ' + swRange(c.switch2Id, c.switch2Id));
    if (c.variableValid) out.push('variable ' + varRange(c.variableId, c.variableId) + ' >= ' + c.variableValue);
    if (c.selfSwitchValid) out.push('self switch ' + c.selfSwitchCh);
    if (c.itemValid) out.push('item ' + dbName('item', c.itemId));
    if (c.actorValid) out.push('actor ' + dbName('actor', c.actorId) + ' in party');
    return out.length ? out.join(' and ') : 'always';
}

function tileAt(map, x, y, z) {
    return map.data[(z * map.height + y) * map.width + x] || 0;
}

function passableFlags(map) {
    var ts = readData('Tilesets.json')[map.tilesetId];
    return ts ? ts.flags : [];
}

function isPassable(map, flags, x, y) {
    // passable if the player can stand there and leave in at least one direction
    for (var z = 3; z >= 0; z--) {
        var id = tileAt(map, x, y, z);
        var f = flags[id] || 0;
        if ((f & 0x10) !== 0) continue; // star tile
        if ((f & 0x0f) === 0x0f) return false;
        return true;
    }
    return false;
}

function regionAt(map, x, y) {
    return tileAt(map, x, y, 5);
}

function eventLabel(i) {
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return chars[i % chars.length];
}

function mapView(id, opts) {
    var map = readMap(id);
    var flags = passableFlags(map);
    var rows = [];
    var grid = [];
    for (var y = 0; y < map.height; y++) {
        var row = [];
        for (var x = 0; x < map.width; x++) {
            var ch = isPassable(map, flags, x, y) ? '.' : '#';
            if (opts && opts.regions) {
                var r = regionAt(map, x, y);
                if (r) ch = r < 10 ? String(r) : '+';
            }
            row.push(ch);
        }
        grid.push(row);
    }
    var legend = [];
    var n = 0;
    map.events.forEach(function (ev) {
        if (!ev) return;
        var label = transfersOf(ev).length ? 'D' : eventLabel(n++);
        if (ev.x < map.width && ev.y < map.height) grid[ev.y][ev.x] = label;
        legend.push(label + ' = event ' + ev.id + ' "' + ev.name + '" at (' + ev.x + ',' + ev.y + ')' +
            describeTransfers(ev));
    });
    var header = '    ' + colRuler(map.width);
    rows.push(header);
    grid.forEach(function (row, y) {
        rows.push(String(y).padStart(3, ' ') + ' ' + row.join(''));
    });
    var info = 'Map ' + id + ' "' + mapName(id) + '" ' + map.width + 'x' + map.height +
        ', tileset ' + map.tilesetId + ' "' + dbName('tileset', map.tilesetId) + '"' +
        (map.displayName ? ', display name "' + map.displayName + '"' : '') +
        ', BGM ' + (map.autoplayBgm ? audioName(map.bgm) : 'none') +
        (map.encounters && map.encounters.length ? ', encounters every ~' + map.encounterStep + ' steps' : '') +
        (map.note ? '\nNote: ' + map.note.trim() : '');
    return info + '\nLegend: . walkable, # blocked, D event with a transfer, other characters are events' +
        (opts && opts.regions ? ', digits are region ids (+ for 10 and above)' : '') +
        '\n\n' + rows.join('\n') + '\n\n' + legend.join('\n');
}

function colRuler(w) {
    var s = '';
    for (var x = 0; x < w; x++) s += x % 10 === 0 ? String((x / 10) % 10) : ' ';
    var t = '';
    for (x = 0; x < w; x++) t += String(x % 10);
    return s + '\n    ' + t;
}

function transfersOf(ev) {
    var out = [];
    (ev.pages || []).forEach(function (page, pi) {
        (page.list || []).forEach(function (cmd) {
            if (cmd.code === 201 && cmd.parameters[0] === 0) {
                out.push({ page: pi + 1, map: cmd.parameters[1], x: cmd.parameters[2], y: cmd.parameters[3] });
            }
        });
    });
    return out;
}

function describeTransfers(ev) {
    var t = transfersOf(ev);
    if (!t.length) return '';
    return ' -> ' + t.map(function (d) {
        return 'map ' + d.map + ' "' + mapName(d.map) + '" (' + d.x + ',' + d.y + ')';
    }).join(', ');
}

// calls fn(where, list, page) for every command list in the project
function eachList(fn) {
    mapIds().forEach(function (id) {
        var map;
        try { map = readMap(id); } catch (e) { return; }
        map.events.forEach(function (ev) {
            if (!ev) return;
            ev.pages.forEach(function (page, pi) {
                fn({ kind: 'map', map: id, event: ev.id, eventName: ev.name, page: pi + 1, x: ev.x, y: ev.y }, page.list, page);
            });
        });
    });
    readData('CommonEvents.json').forEach(function (ce) {
        if (!ce) return;
        fn({ kind: 'common', id: ce.id, name: ce.name }, ce.list, null, ce);
    });
    readData('Troops.json').forEach(function (tr) {
        if (!tr) return;
        tr.pages.forEach(function (page, pi) {
            fn({ kind: 'troop', id: tr.id, name: tr.name, page: pi + 1 }, page.list, null);
        });
    });
}

function whereText(w) {
    if (w.kind === 'map') return 'map ' + w.map + ' "' + mapName(w.map) + '" event ' + w.event + ' "' + w.eventName + '" page ' + w.page + ' (' + w.x + ',' + w.y + ')';
    if (w.kind === 'common') return 'common event ' + w.id + ' "' + w.name + '"';
    return 'troop ' + w.id + ' "' + w.name + '" page ' + w.page;
}

function usage(kind, id) {
    var reads = [];
    var writes = [];
    var re = kind === 'switch' ?
        new RegExp('\\$gameSwitches\\.(value|setValue)\\(\\s*' + id + '\\b') :
        new RegExp('\\$gameVariables\\.(value|setValue)\\(\\s*' + id + '\\b');
    eachList(function (w, list, page, ce) {
        if (page && page.conditions) {
            var c = page.conditions;
            if (kind === 'switch' && ((c.switch1Valid && c.switch1Id === id) || (c.switch2Valid && c.switch2Id === id))) reads.push(whereText(w) + ': page condition');
            if (kind === 'variable' && c.variableValid && c.variableId === id) reads.push(whereText(w) + ': page condition');
        }
        if (ce && kind === 'switch' && ce.trigger > 0 && ce.switchId === id) reads.push(whereText(w) + ': trigger switch');
        (list || []).forEach(function (cmd) {
            var p = cmd.parameters || [];
            if (kind === 'switch') {
                if (cmd.code === 121 && id >= p[0] && id <= p[1]) writes.push(whereText(w) + ': set ' + (p[2] === 0 ? 'ON' : 'OFF'));
                if (cmd.code === 111 && p[0] === 0 && p[1] === id) reads.push(whereText(w) + ': if');
            } else {
                if (cmd.code === 122 && id >= p[0] && id <= p[1]) writes.push(whereText(w) + ': ' + OPS[p[2]] + ' ' + operandText(p));
                if (cmd.code === 111 && p[0] === 1 && (p[1] === id || (p[2] === 1 && p[3] === id))) reads.push(whereText(w) + ': if');
                if ([103, 104, 285].indexOf(cmd.code) >= 0 && p[0] === id) writes.push(whereText(w) + ': input');
                if (cmd.code === 201 && p[0] === 1 && [p[1], p[2], p[3]].indexOf(id) >= 0) reads.push(whereText(w) + ': transfer');
            }
            if ((cmd.code === 355 || cmd.code === 655 || (cmd.code === 111 && p[0] === 12)) && re.test(String(cmd.code === 111 ? p[1] : p[0]))) {
                var m = String(cmd.code === 111 ? p[1] : p[0]).match(re);
                (m[1] === 'setValue' ? writes : reads).push(whereText(w) + ': script');
            }
        });
    });
    return { reads: reads, writes: writes };
}

function fileExistsAny(base, exts) {
    for (var i = 0; i < exts.length; i++) {
        if (fs.existsSync(base + exts[i])) return true;
    }
    return false;
}

function imageExists(folder, name) {
    if (!name) return true;
    return fileExistsAny(path.join(PROJECT, 'img', folder, name), ['.png', '.rpgmvp', '.png_']);
}

function audioExists(folder, name) {
    if (!name) return true;
    return fileExistsAny(path.join(PROJECT, 'audio', folder, name), ['.ogg', '.m4a', '.rpgmvo', '.rpgmvm', '.ogg_', '.m4a_']);
}

// Size of a PNG from its header, or null (encrypted or missing images are skipped).
function pngSize(file) {
    try {
        var fd = fs.openSync(file, 'r'), b = Buffer.alloc(24);
        fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
        if (b.readUInt32BE(12) !== 0x49484452) return null;
        return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    } catch (e) { return null; }
}

// Troop members whose battler images cover each other. Returns text lines, empty when fine.
function troopOverlaps(troop) {
    var enemies = readData('Enemies.json');
    var sideView = !!readData('System.json').optSideView;
    var box = (troop.members || []).map(function (m, i) {
        var en = enemies[m.enemyId];
        var size = en && en.battlerName && pngSize(path.join(PROJECT, 'img', sideView ? 'sv_enemies' : 'enemies', en.battlerName + '.png'));
        // wider than the screen means a sprite sheet that a battle plugin cuts up, its real size is unknown
        if (!size || size.w > 816 || size.h > 624) return null;
        return { i: i, name: en.name, x: m.x, y: m.y, w: size.w, h: size.h };
    });
    var out = [];
    for (var a = 0; a < box.length; a++) for (var b = a + 1; b < box.length; b++) {
        var p = box[a], q = box[b];
        if (!p || !q) continue;
        // battler x,y is the bottom centre of the image
        var ox = Math.min(p.x + p.w / 2, q.x + q.w / 2) - Math.max(p.x - p.w / 2, q.x - q.w / 2);
        var oy = Math.min(p.y, q.y) - Math.max(p.y - p.h, q.y - q.h);
        if (ox > 0 && oy > 0 && ox * oy > 0.5 * Math.min(p.w * p.h, q.w * q.h)) {
            out.push('"' + p.name + '" (' + p.w + 'x' + p.h + ' at ' + p.x + ',' + p.y + ') and "' + q.name + '" (' + q.w + 'x' + q.h + ' at ' + q.x + ',' + q.y + ') cover each other');
        }
    }
    if (out.length) {
        var n = box.length, total = box.reduce(function (s, x) { return s + (x ? x.w : 120); }, 0);
        var left = Math.max(0, (816 - total) / 2), xs = [];
        box.forEach(function (x) { var w = x ? x.w : 120; xs.push(Math.round(left + w / 2)); left += w; });
        out.push('Screen is 816 wide. Side by side would be x = ' + xs.join(', ') + (total > 816 ? ' (they are wider than the screen together, use smaller images or fewer enemies)' : ''));
    }
    return out;
}

// Indentation of one command list. A list built by hand or by a script can
// have a branch body on the wrong level: MV then skips commands or runs both
// branches. Message text (401) and a choice (102) right after it must sit on
// the level of their 101.
var BRANCH_HEADS = [111, 402, 403, 411, 601, 602, 603, 112];

function indentProblems(list) {
    var out = [];
    if (!list || !list.length) return out;
    var last = list[list.length - 1];
    if (last.code !== 0 || last.indent !== 0) { out.push('the list does not end with an end command on level 0'); return out; }
    var textLevel = null;
    for (var i = 0; i < list.length - 1 && out.length < 3; i++) {
        var c = list[i], d = list[i + 1];
        if (c.code === 101) textLevel = c.indent;
        else if (c.code !== 401) textLevel = null;
        if (textLevel !== null && (d.code === 401 || d.code === 102) && d.indent !== textLevel) {
            out.push('command ' + (i + 2) + ' (' + (d.code === 102 ? 'choice' : 'text line') + ') is on level ' + d.indent + ', its message on level ' + textLevel);
            continue;
        }
        if (BRANCH_HEADS.indexOf(c.code) >= 0 && d.indent !== c.indent + 1) out.push('command ' + (i + 1) + ' (code ' + c.code + ') opens a branch, but the next command is on level ' + d.indent + ' instead of ' + (c.indent + 1));
        else if (c.code === 0 && c.indent > 0 && d.indent !== c.indent - 1) out.push('command ' + (i + 1) + ' closes level ' + c.indent + ', but the next command is on level ' + d.indent);
        else if (d.indent > c.indent + 1) out.push('command ' + (i + 2) + ' jumps from level ' + c.indent + ' to ' + d.indent);
        else if (d.indent === c.indent + 1 && BRANCH_HEADS.indexOf(c.code) < 0) out.push('command ' + (i + 2) + ' is one level deeper than command ' + (i + 1) + ' (code ' + c.code + '), which opens no branch');
    }
    return out;
}

// Message windows: a single word alone on the last line, a sentence that
// spills into a new window with only a few words, and notes for the author
// left in the game text.
var CONTROL_CODES = /\\[A-Za-z]+\[[^\]]*\]|\\[A-Za-z]+<[^>]*>|\\[{}.|!><^$]/g;
var AUTHOR_NOTE = /\[TODO|\bTODO\b|\bFIXME\b|\bXXX\b|\bplaceholder\b|\blorem ipsum\b|\(placeholder[^)]*\)/i;

function messageProblems(list) {
    var out = [];
    var before = null;
    for (var i = 0; i < (list || []).length; i++) {
        var c = list[i];
        if (c.code !== 101) { if (c.code !== 401 && [0, 102, 402, 403, 404, 108, 408].indexOf(c.code) < 0) before = null; continue; }
        var lines = [];
        for (var j = i + 1; j < list.length && list[j].code === 401; j++) lines.push(String(list[j].parameters[0]).replace(/\\[NPV]\[\d+\]/gi, 'Name').replace(/\\G/g, 'G').replace(CONTROL_CODES, '').trim());
        while (lines.length && !lines[lines.length - 1]) lines.pop();
        if (!lines.length) continue;
        var all = lines.join(' ');
        if (lines.length > 1 && lines[lines.length - 1].split(/\s+/).length === 1) out.push(['lone word', '"' + lines[lines.length - 1] + '" stands alone on the last line of "' + all.slice(0, 50) + '...", shorten the text so it fits one line less']);
        var note = all.match(AUTHOR_NOTE);
        if (note) out.push(['author note in text', '"' + note[0] + '" in "' + all.slice(0, 60) + '"']);
        if (before && !/[.!?…:"'”»)\]~]\s*$/.test(before) && all.split(/\s+/).length <= 3) out.push(['split sentence', 'a sentence runs into a new window with only "' + all + '" (after "...' + before.slice(-30) + '")']);
        before = all;
        i = j - 1;
    }
    return out;
}

// Plugins that replace the same engine function without calling the old one:
// the plugin loaded later wins and the earlier one silently stops working.
var ENGINE_NAME = /^(Game_|Scene_|Window_|Sprite_|Spriteset_|BattleManager|DataManager|ImageManager|SceneManager|SoundManager|TextManager|AudioManager|ConfigManager|StorageManager|PluginManager|Input|TouchInput|Graphics|Bitmap|Tilemap|ShaderTilemap|WebAudio|JsonEx|Utils)/;

function pluginOverwrites(add) {
    var list;
    try { list = readPluginList(); } catch (e) { return; }
    var owner = {}, pairs = {};
    list.forEach(function (p) {
        if (!p.status) return;
        var src;
        try { src = fs.readFileSync(path.join(PROJECT, 'js', 'plugins', p.name + '.js'), 'utf8'); } catch (e) { return; }
        var author = ((src.match(/@author\s+([^\n*]+)/) || [])[1] || p.name).trim().toLowerCase();
        src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        var re = /(^|[^.\w$])([A-Z][\w$]*(?:\.prototype)?\.[\w$]+)\s*=\s*function\b/g, m;
        while ((m = re.exec(src))) {
            var name = m[2];
            if (!ENGINE_NAME.test(name)) continue;
            var esc = name.replace(/[.$]/g, '\\$&');
            var keepsOld = new RegExp(esc + '\\s*(?:;|,|\\)|\\.(?:call|apply)\\b)').test(src.slice(0, m.index + m[1].length)) ||
                new RegExp('=\\s*' + esc + '\\s*[;,]').test(src);
            // a plugin series replacing its own core on purpose is fine, two authors are not
            if (owner[name] && !keepsOld && owner[name].author !== author) {
                var pair = p.name + ' < ' + owner[name].plugin;
                (pairs[pair] = pairs[pair] || { later: p.name, earlier: owner[name].plugin, names: [] }).names.push(name);
            }
            owner[name] = { plugin: p.name, author: author };
        }
    });
    Object.keys(pairs).forEach(function (k) {
        var x = pairs[k];
        add('plugin overwrite', x.later + ' replaces ' + x.names.length + ' function' + (x.names.length > 1 ? 's' : '') + ' that ' + x.earlier + ' (higher in the list) also changes, without calling its version: ' +
            x.names.slice(0, 6).join(', ') + (x.names.length > 6 ? ' and ' + (x.names.length - 6) + ' more' : '') +
            '. Fine if that is on purpose; if a feature of ' + x.earlier + ' stopped working, this is the place to look');
    });
}

// A landing spot is useless if an event that blocks the player stands there,
// or if no neighbour tile can be entered (the player is boxed in).
function solidSpots(map) {
    var spots = {};
    map.events.forEach(function (ev) {
        if (!ev || !ev.pages.length) return;
        var pg = ev.pages[0];
        if (pg.priorityType === 1 && !pg.through && pg.trigger !== 3 && pg.trigger !== 4 && (pg.image.characterName || pg.image.tileId)) spots[ev.x + ',' + ev.y] = ev;
    });
    return spots;
}

function landingProblem(map, x, y) {
    var flags = passableFlags(map), solid = solidSpots(map);
    if (solid[x + ',' + y]) return 'on top of event ' + solid[x + ',' + y].id + ' "' + solid[x + ',' + y].name + '", which blocks the player';
    var out = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
        var nx = x + d[0], ny = y + d[1];
        return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && isPassable(map, flags, nx, ny) && !solid[nx + ',' + ny];
    });
    return out ? '' : 'and no tile next to it can be entered, the player is stuck';
}

function checkProject(opts) {
    var limit = (opts && opts.limit) || 25;
    var problems = [];
    var byKind = {};
    function add(kind, text) {
        byKind[kind] = (byKind[kind] || 0) + 1;
        if (byKind[kind] <= limit) problems.push('[' + kind + '] ' + text);
    }

    var maxChars = (opts && opts.maxChars) || 0;
    var setS = {}, readS = {}, setV = {}, readV = {};
    var ids = mapIds();
    var idSet = {};
    ids.forEach(function (i) { idSet[i] = true; });

    var missAdv = mzMissingAdvanced();
    if (missAdv.length) add('MZ settings', 'System.json has no ' + missAdv.join(', ') + ' (the project was never saved in the MZ editor). The game stops on the title screen. Open the project in MZ and save it once.');

    // system sounds, music and title images: a missing one stops the game at start with "Failed to load"
    var sys = readData('System.json');
    (sys.sounds || []).forEach(function (se, i) {
        if (se && se.name && !audioExists('se', se.name)) add('missing audio', 'System sound ' + (i + 1) + ' (Database, System) "' + se.name + '", the game stops when it plays');
    });
    [['titleBgm', 'bgm', 'title music'], ['battleBgm', 'bgm', 'battle music'], ['victoryMe', 'me', 'victory ME'], ['defeatMe', 'me', 'defeat ME'],
        ['gameoverMe', 'me', 'game over ME']].forEach(function (k) {
        if (sys[k[0]] && sys[k[0]].name && !audioExists(k[1], sys[k[0]].name)) add('missing audio', 'System ' + k[2] + ' "' + sys[k[0]].name + '"');
    });
    ['boat', 'ship', 'airship'].forEach(function (v) {
        if (sys[v] && sys[v].bgm && sys[v].bgm.name && !audioExists('bgm', sys[v].bgm.name)) add('missing audio', 'System ' + v + ' music "' + sys[v].bgm.name + '"');
    });
    if (sys.title1Name && !imageExists('titles1', sys.title1Name)) add('missing image', 'title screen background "' + sys.title1Name + '"');
    if (sys.title2Name && !imageExists('titles2', sys.title2Name)) add('missing image', 'title screen frame "' + sys.title2Name + '"');

    // troops: every enemy needs a battler image, a blank one crashes the battle
    var enemies = readData('Enemies.json');
    var sideView = !!readData('System.json').optSideView;
    readData('Troops.json').forEach(function (tr) {
        if (!tr) return;
        var seen = {};
        (tr.members || []).forEach(function (m) {
            if (seen[m.enemyId]) return;
            seen[m.enemyId] = true;
            var en = enemies[m.enemyId];
            if (!en) add('missing enemy', 'troop ' + tr.id + ' "' + tr.name + '": enemy ' + m.enemyId + ' does not exist');
            else if (!en.battlerName) add('missing image', 'troop ' + tr.id + ' "' + tr.name + '": enemy ' + en.id + ' "' + en.name + '" has no battler image, the battle will crash');
            else if (!imageExists(sideView ? 'sv_enemies' : 'enemies', en.battlerName)) add('missing image', 'troop ' + tr.id + ' "' + tr.name + '": enemy ' + en.id + ' battler "' + en.battlerName + '"');
        });
        var ov = troopOverlaps(tr).filter(function (t) { return !/^Screen is/.test(t); });
        if (ov.length) add('enemies overlap', 'troop ' + tr.id + ' "' + tr.name + '": ' + ov[0] + (ov.length > 1 ? ' (+' + (ov.length - 1) + ' more pairs)' : ''));
    });

    // per map checks
    ids.forEach(function (id) {
        var map;
        try { map = readMap(id); } catch (e) { add('broken map', 'map ' + id + ': ' + e.message); return; }
        var flags = passableFlags(map);
        var spots = {};
        // wall tops (A4 roof rows) are walkable in most tilesets: next to a floor the player can walk onto the wall
        var isTop = function (x, y) { var t = tileAt(map, x, y, 0); if (t < 5888 || t >= 8192) return false; return Math.floor((Math.floor((t - 2048) / 48) - 80) / 8) % 2 === 0; };
        var onWall = [];
        for (var wy = 0; wy < map.height; wy++) for (var wx = 0; wx < map.width; wx++) {
            if (!isTop(wx, wy) || !isPassable(map, flags, wx, wy)) continue;
            var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
                var nx = wx + d[0], ny = wy + d[1];
                return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !isTop(nx, ny) && isPassable(map, flags, nx, ny);
            });
            if (nb) onWall.push('(' + wx + ',' + wy + ')');
        }
        if (onWall.length) add('walk on wall', 'map ' + id + ' "' + mapName(id) + '": ' + onWall.length + ' walkable wall top tiles next to the floor, e.g. ' + onWall.slice(0, 5).join(' ') + '. Block them with a region rule, a blocking tile on an upper layer, or use the wall side tile below the top');
        if (map.autoplayBgm && !audioExists('bgm', map.bgm.name)) add('missing audio', 'map ' + id + ' BGM "' + map.bgm.name + '"');
        if (map.parallaxName && !imageExists('parallaxes', map.parallaxName)) add('missing image', 'map ' + id + ' parallax "' + map.parallaxName + '"');
        map.events.forEach(function (ev) {
            if (!ev) return;
            if (ev.x >= map.width || ev.y >= map.height) add('outside map', 'map ' + id + ' event ' + ev.id + ' "' + ev.name + '" at (' + ev.x + ',' + ev.y + ')');
            // two events that both block the player on the same tile
            var solid = ev.pages.some(function (pg) { return pg.priorityType === 1 && !pg.through; });
            var key = ev.x + ',' + ev.y;
            if (solid) {
                if (spots[key]) add('stacked events', 'map ' + id + ' events ' + spots[key] + ' and ' + ev.id + ' both stand at (' + key + ')');
                else spots[key] = ev.id;
            }
            ev.pages.forEach(function (page, pi) {
                var img = page.image || {};
                if (img.characterName && !imageExists('characters', img.characterName)) add('missing image', 'map ' + id + ' event ' + ev.id + ' page ' + (pi + 1) + ' character "' + img.characterName + '"');
                // player touch + same priority + through: the player walks onto it and nothing ever starts
                if (page.trigger === 1 && page.priorityType === 1 && page.through && (page.list || []).length > 1) {
                    add('dead trigger', 'map ' + id + ' event ' + ev.id + ' "' + ev.name + '" page ' + (pi + 1) + ': player touch with priority "same as characters" and through on never starts. Use priority "below characters" or turn through off');
                }
            });
        });
    });

    // every command list
    eachList(function (w, list, page, ce) {
        if (page && page.conditions) {
            var c = page.conditions;
            if (c.switch1Valid) readS[c.switch1Id] = readS[c.switch1Id] || whereText(w);
            if (c.switch2Valid) readS[c.switch2Id] = readS[c.switch2Id] || whereText(w);
            if (c.variableValid) readV[c.variableId] = readV[c.variableId] || whereText(w);
        }
        if (ce && ce.trigger > 0) readS[ce.switchId] = readS[ce.switchId] || whereText(w);
        indentProblems(list).forEach(function (t) { add('broken indent', whereText(w) + ': ' + t); });
        messageProblems(list).forEach(function (t) { add(t[0], whereText(w) + ': ' + t[1]); });
        var textLines = [];
        var hasFace = false;
        (list || []).forEach(function (cmd, i) {
            var p = cmd.parameters || [];
            switch (cmd.code) {
                case 121: for (var s = p[0]; s <= p[1]; s++) setS[s] = true; break;
                case 122: for (var v = p[0]; v <= p[1]; v++) setV[v] = true; break;
                case 103: case 104: case 285: setV[p[0]] = true; break;
                case 111:
                    if (p[0] === 0) readS[p[1]] = readS[p[1]] || whereText(w);
                    if (p[0] === 1) readV[p[1]] = readV[p[1]] || whereText(w);
                    break;
                case 101:
                    hasFace = !!p[0];
                    if (p[0] && !imageExists('faces', p[0])) add('missing image', whereText(w) + ': face "' + p[0] + '"');
                    break;
                case 401:
                    if (maxChars) {
                        var limitChars = hasFace ? Math.round(maxChars * 0.78) : maxChars;
                        var plain = String(p[0]).replace(/\\n<[^>]*>/gi, '').replace(/\\[A-Za-z]+\[[^\]]*\]/g, '').replace(/\\[{}!.|^<>$]/g, '');
                        if (plain.length > limitChars) add('long text', whereText(w) + ': ' + plain.length + ' chars (limit ' + limitChars + '): "' + plain.slice(0, 60) + '..."');
                    }
                    break;
                case 201:
                    if (p[0] === 0) {
                        if (!idSet[p[1]]) add('bad transfer', whereText(w) + ': to missing map ' + p[1]);
                        else {
                            try {
                                var t = readMap(p[1]);
                                if (p[2] >= t.width || p[3] >= t.height) add('bad transfer', whereText(w) + ': (' + p[2] + ',' + p[3] + ') is outside map ' + p[1] + ' (' + t.width + 'x' + t.height + ')');
                                else if (!isPassable(t, passableFlags(t), p[2], p[3])) add('bad transfer', whereText(w) + ': lands on a blocked tile (' + p[2] + ',' + p[3] + ') on map ' + p[1] + ' "' + mapName(p[1]) + '"');
                                else { var why = landingProblem(t, p[2], p[3]); if (why) add('bad transfer', whereText(w) + ': lands at (' + p[2] + ',' + p[3] + ') on map ' + p[1] + ' "' + mapName(p[1]) + '", ' + why); }
                            } catch (e) { /* ignore */ }
                        }
                    }
                    break;
                case 231: if (!imageExists('pictures', p[1])) add('missing image', whereText(w) + ': picture "' + p[1] + '"'); break;
                case 241: if (p[0] && !audioExists('bgm', p[0].name)) add('missing audio', whereText(w) + ': BGM "' + p[0].name + '"'); break;
                case 245: if (p[0] && !audioExists('bgs', p[0].name)) add('missing audio', whereText(w) + ': BGS "' + p[0].name + '"'); break;
                case 249: if (p[0] && !audioExists('me', p[0].name)) add('missing audio', whereText(w) + ': ME "' + p[0].name + '"'); break;
                case 250: if (p[0] && !audioExists('se', p[0].name)) add('missing audio', whereText(w) + ': SE "' + p[0].name + '"'); break;
                case 117: if (!readData('CommonEvents.json')[p[0]]) add('missing common event', whereText(w) + ': ' + p[0]); break;
                case 301: if (p[0] === 0 && !readData('Troops.json')[p[1]]) add('missing troop', whereText(w) + ': ' + p[1]); break;
                case 355: case 655:
                    String(p[0]).replace(/\$gameSwitches\.setValue\(\s*(\d+)/g, function (m, n) { setS[+n] = true; return m; });
                    String(p[0]).replace(/\$gameVariables\.setValue\(\s*(\d+)/g, function (m, n) { setV[+n] = true; return m; });
                    break;
            }
        });
    });

    // switches and variables touched by plugins count as set
    var pluginText = '';
    try {
        var dir = path.join(PROJECT, 'js', 'plugins');
        fs.readdirSync(dir).forEach(function (f) { if (/\.js$/.test(f)) pluginText += fs.readFileSync(path.join(dir, f), 'utf8'); });
    } catch (e) { /* no plugins */ }

    Object.keys(readS).forEach(function (k) {
        if (setS[k]) return;
        if (new RegExp('\\$gameSwitches\\.setValue\\(\\s*' + k + '\\b').test(pluginText)) return;
        add('switch never set', 'S' + k + nameTag(switchName(+k)) + ' is checked (first: ' + readS[k] + ') but no event or plugin line with this number turns it on or off');
    });
    Object.keys(readV).forEach(function (k) {
        if (setV[k]) return;
        if (new RegExp('\\$gameVariables\\.setValue\\(\\s*' + k + '\\b').test(pluginText)) return;
        add('variable never set', 'V' + k + nameTag(variableName(+k)) + ' is checked (first: ' + readV[k] + ') but no event or plugin line with this number changes it');
    });

    // plugins: files, order, and Living World notetags and commands against their help
    checkPlugins(add);
    pluginOverwrites(add);

    // reachability from the start map
    var sys = system();
    var graph = mapGraph();
    var seen = {};
    var queue = [sys.startMapId];
    seen[sys.startMapId] = true;
    while (queue.length) {
        var cur = queue.shift();
        (graph[cur] || []).forEach(function (e) {
            if (!seen[e.to]) { seen[e.to] = true; queue.push(e.to); }
        });
    }
    var unreachable = ids.filter(function (i) { return !seen[i]; });
    if (unreachable.length) {
        add('no door leads here', unreachable.length + ' maps have no transfer path from the start map ' + sys.startMapId +
            ' (they may be reached by plugins or scripts): ' + unreachable.slice(0, 40).map(function (i) { return i + ' "' + mapName(i) + '"'; }).join(', ') +
            (unreachable.length > 40 ? ' ...' : ''));
    }

    var kinds = Object.keys(byKind);
    var cut = kinds.some(function (k) { return byKind[k] > limit; });
    return 'Checked ' + ids.length + ' maps.\n' +
        (kinds.length ? 'Found: ' + kinds.map(function (k) { return byKind[k] + ' ' + k; }).join(', ') +
            (cut ? ' (each kind lists at most ' + limit + ', raise limit to see more)' : '') + '\n\n' + problems.join('\n') : 'No problems found.');
}

function mapGraph() {
    var graph = {};
    eachList(function (w, list) {
        if (w.kind !== 'map') return;
        (list || []).forEach(function (cmd) {
            if (cmd.code === 201 && cmd.parameters[0] === 0) {
                graph[w.map] = graph[w.map] || [];
                var to = cmd.parameters[1];
                if (!graph[w.map].some(function (e) { return e.to === to && e.event === w.event; })) {
                    graph[w.map].push({ to: to, event: w.event, x: w.x, y: w.y, tx: cmd.parameters[2], ty: cmd.parameters[3] });
                }
            }
        });
    });
    return graph;
}

function tilesUsed(mapId) {
    var map = readMap(mapId);
    var flags = passableFlags(map);
    var count = [{}, {}, {}, {}];
    for (var z = 0; z < 4; z++) {
        for (var i = 0; i < map.width * map.height; i++) {
            var t = map.data[z * map.width * map.height + i];
            if (!t) continue;
            var base = t >= 2048 ? 2048 + Math.floor((t - 2048) / 48) * 48 : t;
            count[z][base] = (count[z][base] || 0) + 1;
        }
    }
    var out = ['Tiles used on map ' + mapId + ' "' + mapName(mapId) + '" (tileset ' + map.tilesetId + '). Autotiles are shown by their kind (shape 0).'];
    count.forEach(function (c, z) {
        var keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 25);
        if (!keys.length) return;
        out.push('Layer ' + z + ': ' + keys.map(function (k) {
            var f = flags[k] || 0;
            var pass = (f & 0x10) ? 'star' : ((f & 0x0f) === 0x0f ? 'blocked' : 'walkable');
            return k + ' ' + tileLabel(+k) + ' x' + c[k] + ' ' + pass;
        }).join(', '));
    });
    return out.join('\n');
}

function tileLabel(t) {
    if (t >= 2048) {
        var kind = Math.floor((t - 2048) / 48);
        if (kind < 16) return '(A1:' + kind + ')';
        if (kind < 48) return '(A2:' + (kind - 16) + ')';
        if (kind < 80) return '(A3:' + (kind - 48) + ')';
        return '(A4:' + (kind - 80) + ')';
    }
    if (t >= 1536) return '(A5:' + Math.floor((t - 1536) / 8) + ',' + ((t - 1536) % 8) + ')';
    var sheet = ['B', 'C', 'D', 'E'][Math.floor(t / 256)];
    var r = t % 256;
    var col = (r >= 128 ? 8 : 0) + (r % 8);
    var row = Math.floor((r % 128) / 8);
    return '(' + sheet + ':' + row + ',' + col + ')';
}

function pluginsFile() {
    return path.join(PROJECT, 'js', 'plugins.js');
}

function readPluginList() {
    var txt = fs.readFileSync(pluginsFile(), 'utf8');
    return JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
}

var pluginCache = {};

// Parses the English header block (/*: ... */) of a plugin file.
function pluginInfo(name) {
    var file = path.join(PROJECT, 'js', 'plugins', name + '.js');
    var stat;
    try { stat = fs.statSync(file); } catch (e) { return null; }
    var hit = pluginCache[name];
    if (hit && hit.mtime === stat.mtimeMs) return hit.info;
    var src = fs.readFileSync(file, 'utf8');
    var start = src.indexOf('/*:');
    while (start >= 0 && /^\/\*:[a-z]/.test(src.slice(start, start + 5))) start = src.indexOf('/*:', start + 3);
    var block = start >= 0 ? src.slice(start + 3, src.indexOf('*/', start)) : '';
    var lines = block.split(/\r?\n/).map(function (l) { return l.replace(/^\s*\*\s?/, ''); });
    var info = { name: name, desc: '', author: '', params: [], help: [], mzCommands: {}, base: [] };
    var cur = null, inHelp = false, curCmd = null;
    lines.forEach(function (l) {
        var m = l.match(/^@(\w+)\s*(.*)$/);
        if (m) {
            inHelp = false;
            if (m[1] === 'plugindesc') info.desc = m[2];
            else if (m[1] === 'author') info.author = m[2];
            else if (m[1] === 'help') { inHelp = true; if (m[2]) info.help.push(m[2]); }
            else if (m[1] === 'param') { cur = { name: m[2].trim(), desc: '', def: '', type: '' }; info.params.push(cur); curCmd = null; }
            else if (m[1] === 'command') { curCmd = { name: m[2].trim(), text: '', desc: '', args: [] }; info.mzCommands[curCmd.name] = curCmd; cur = null; }
            else if (curCmd && m[1] === 'arg') { curCmd.args.push(m[2].trim()); }
            else if (curCmd && m[1] === 'text' && !curCmd.args.length) curCmd.text = m[2];
            else if (curCmd && m[1] === 'desc' && !curCmd.args.length) curCmd.desc = m[2];
            else if (m[1] === 'base') { if (m[2].trim()) info.base.push(m[2].trim()); }
            else if (cur && m[1] === 'desc') cur.desc = m[2];
            else if (cur && m[1] === 'default') cur.def = m[2];
            else if (cur && m[1] === 'type') cur.type = m[2];
            else if (cur && m[1] === 'text') cur.text = m[2];
            return;
        }
        if (inHelp) info.help.push(l);
    });
    // sections: a title line between two lines of = or -
    var sections = [], sec = { title: 'Help', lines: [] };
    for (var i = 0; i < info.help.length; i++) {
        var l = info.help[i];
        if (/^[=-]{8,}\s*$/.test(l) && i + 2 < info.help.length && /^[=-]{8,}\s*$/.test(info.help[i + 2])) {
            if (sec.lines.join('').trim()) sections.push(sec);
            sec = { title: info.help[i + 1].trim(), lines: [] };
            i += 2;
            continue;
        }
        sec.lines.push(l);
    }
    if (sec.lines.join('').trim()) sections.push(sec);
    info.sections = sections;
    var helpText = info.help.join('\n');
    // Living World conventions: notetags <LW Name: ...> and commands that start a help line with LW_
    info.notetags = {};
    helpText.replace(/<(LW [A-Za-z][A-Za-z ]*?)\s*[:>]/g, function (m, k) { info.notetags[k] = true; return m; });
    info.commands = {};
    info.help.forEach(function (l) { var c = l.match(/^\s{2,}(LWZ?_[A-Za-z]\w*)\b/); if (c) info.commands[c[1]] = true; });
    // MZ plugins still take the MV text commands, registered with LW.mvCommand('LW_Name', ...)
    src.replace(/LW\.mvCommand\(\s*['"](LW_\w+)['"]/g, function (m, k) { info.commands[k] = true; return m; });
    info.requires = info.base.slice();
    helpText.replace(/Requires ((?:LWZ?_\w+(?:,\s*|\s+and\s+)?)+)/g, function (m, list) {
        list.split(/,\s*|\s+and\s+/).forEach(function (n) { if (n && info.requires.indexOf(n) < 0) info.requires.push(n); });
        return m;
    });
    pluginCache[name] = { mtime: stat.mtimeMs, info: info };
    return info;
}

function installedPluginFiles() {
    try {
        return fs.readdirSync(path.join(PROJECT, 'js', 'plugins')).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return f.slice(0, -3); });
    } catch (e) { return []; }
}

// What the enabled Living World plugins understand
function lwVocabulary() {
    var voc = { notetags: {}, commands: {}, any: false };
    readPluginList().forEach(function (p) {
        if (!p.status) return;
        var info = pluginInfo(p.name);
        if (!info) return;
        if (LW_NAME.test(p.name)) voc.any = true;
        Object.keys(info.notetags).forEach(function (k) { voc.notetags[k] = p.name; });
        Object.keys(info.commands).forEach(function (k) { voc.commands[k] = p.name; });
    });
    return voc;
}

function checkPlugins(add) {
    var list;
    try { list = readPluginList(); } catch (e) { add('plugins', 'js/plugins.js could not be read: ' + e.message); return; }
    var files = installedPluginFiles();
    var pos = {}, seen = {};
    list.forEach(function (p, i) {
        if (seen[p.name]) add('plugin twice', p.name + ' is in the plugin list twice');
        seen[p.name] = true;
        if (p.status) pos[p.name] = i;
        if (p.status && files.indexOf(p.name) < 0) add('missing plugin file', p.name + ' is on but js/plugins/' + p.name + '.js does not exist, the game will not start');
    });
    list.forEach(function (p) {
        if (!p.status) return;
        var info = pluginInfo(p.name);
        if (!info) return;
        info.requires.forEach(function (r) {
            if (pos[r] === undefined) add('plugin needs another', p.name + ' needs ' + r + ', which is ' + (seen[r] ? 'switched off' : 'not in the plugin list'));
            else if (pos[r] > pos[p.name]) add('plugin order', r + ' must be above ' + p.name + ' in the plugin list');
        });
        var known = {};
        info.params.forEach(function (pa) { known[pa.name] = true; });
        if (info.params.length) Object.keys(p.parameters || {}).forEach(function (k) {
            if (!known[k]) add('unknown parameter', p.name + ': parameter "' + k + '" is not in the plugin (renamed or old)');
        });
    });
    var voc = lwVocabulary();
    if (!voc.any) return;
    var allTags = {};
    files.forEach(function (n) { if (LW_NAME.test(n)) { var inf = pluginInfo(n); if (inf) Object.keys(inf.notetags).forEach(function (k) { allTags[k] = n; }); } });
    function checkNote(where, note) {
        String(note || '').replace(/<(LW [A-Za-z][A-Za-z ]*?)\s*[:>]/g, function (m, k) {
            if (voc.notetags[k]) return m;
            if (allTags[k]) add('plugin off', where + ': notetag <' + k + '> belongs to ' + allTags[k] + ', which is not on');
            else add('unknown notetag', where + ': <' + k + '> is not a notetag of any Living World plugin (typo?)');
            return m;
        });
    }
    ['Actors', 'Classes', 'Skills', 'Items', 'Weapons', 'Armors', 'Enemies', 'States', 'Tilesets'].forEach(function (f) {
        readData(f + '.json').forEach(function (e) { if (e && e.note) checkNote(f.toLowerCase().replace(/s$/, '') + ' ' + e.id + ' "' + e.name + '"', e.note); });
    });
    mapIds().forEach(function (id) {
        var map;
        try { map = readMap(id); } catch (e) { return; }
        checkNote('map ' + id + ' "' + mapName(id) + '"', map.note);
        map.events.forEach(function (ev) { if (ev && ev.note) checkNote('map ' + id + ' event ' + ev.id + ' "' + ev.name + '"', ev.note); });
    });
    var allCmds = {};
    files.forEach(function (n) { if (LW_NAME.test(n)) { var inf = pluginInfo(n); if (inf) Object.keys(inf.commands).forEach(function (k) { allCmds[k] = n; }); } });
    var on = {};
    list.forEach(function (p) { if (p.status) on[p.name] = true; });
    eachList(function (w, list) {
        (list || []).forEach(function (c) {
            if (c.code === 108 || c.code === 408) checkNote(whereText(w) + ' comment', c.parameters[0]);
            if (c.code === 357) {
                // MZ plugin command: [plugin, command, text, args]
                var pn = String(c.parameters[0] || ''), cn = String(c.parameters[1] || '');
                if (!LW_NAME.test(pn)) return;
                var pinf = pluginInfo(pn);
                if (!pinf) { add('missing plugin file', whereText(w) + ': plugin command ' + pn + ' ' + cn + ', but js/plugins/' + pn + '.js does not exist'); return; }
                if (!on[pn]) add('plugin off', whereText(w) + ': plugin command ' + pn + ' ' + cn + ', but ' + pn + ' is not on');
                var mc = pinf.mzCommands[cn];
                if (!mc) add('unknown plugin command', whereText(w) + ': ' + pn + ' has no command "' + cn + '" (commands: ' + Object.keys(pinf.mzCommands).join(', ') + ')');
                else Object.keys(c.parameters[3] || {}).forEach(function (k) {
                    if (mc.args.indexOf(k) < 0) add('unknown plugin command', whereText(w) + ': ' + pn + ' ' + cn + ' has no argument "' + k + '" (arguments: ' + (mc.args.join(', ') || 'none') + ')');
                });
                return;
            }
            if (c.code !== 356) return;
            var word = String(c.parameters[0]).trim().split(/\s+/)[0];
            if (!LW_NAME.test(word) || voc.commands[word]) return;
            if (allCmds[word]) add('plugin off', whereText(w) + ': plugin command ' + word + ' belongs to ' + allCmds[word] + ', which is not on');
            else add('unknown plugin command', whereText(w) + ': "' + c.parameters[0] + '" is not a command of any Living World plugin (typo?)');
        });
    });
}

var TOOLS = [];
// Lists that can grow with the project are paged, so one call never floods the context.
var PAGE_PROPS = {
    offset: { type: 'integer', description: 'Skip this many entries (for the next page)' },
    limit: { type: 'integer', description: 'Entries per page' }
};

function paged(lines, a, def, what) {
    var off = a.offset || 0, lim = a.limit || def;
    var part = lines.slice(off, off + lim);
    var more = lines.length - off - part.length;
    return part.join('\n') + (more > 0 ? '\n... ' + more + ' more ' + what + ' (offset ' + (off + lim) + ' for the next page, or narrow with a filter)' : '') +
        (off ? '\n(showing ' + (off + 1) + ' to ' + (off + part.length) + ' of ' + lines.length + ')' : '');
}

// MCP tool annotations: what each tool may do to the project. Nothing here reaches the internet.
// Every tool of Lite only reads.
var READ_ONLY = ['check_setup', 'open_project', 'find_item_usage', 'about_full_kit', 'project_overview', 'list_maps', 'view_map', 'list_events', 'read_event', 'read_common_event', 'search_database', 'find_switch_usage', 'find_variable_usage', 'find_text', 'map_connections', 'check_project', 'tiles_used', 'plugin_help'];
var OVERWRITES = [];

function annotations(name) {
    var title = name.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
    var ro = READ_ONLY.indexOf(name) >= 0;
    var an = { title: title, readOnlyHint: ro, openWorldHint: false };
    if (!ro) an.destructiveHint = OVERWRITES.indexOf(name) >= 0;
    if (ro) an.idempotentHint = true;
    return an;
}

function tool(name, description, props, required, run, noProject) {
    TOOLS.push({
        name: name,
        description: description,
        inputSchema: { type: 'object', properties: props || {}, required: required || [] },
        annotations: annotations(name),
        run: run,
        noProject: !!noProject
    });
}

tool('check_setup',
    'Check that the kit is set up: Node.js, the project folder and whether it is an RPG Maker MV or MZ project. ' +
    'Every problem comes with the fix. Works even when no project is found. Call it first when something does not work.',
    {}, [],
    function () {
        var out = [], bad = 0;
        out.push('Living World Kit Lite ' + VERSION + ', Node.js ' + process.version + ', ' + process.platform);
        if (parseInt(process.versions.node, 10) >= 18) out.push('OK    Node.js ' + process.versions.node);
        else { bad++; out.push('FIX   Node.js ' + process.versions.node + ' is too old\n      -> install Node.js 18 or newer from nodejs.org (the LTS version)'); }
        if (isProject()) out.push('OK    ' + engineName() + ' project: ' + PROJECT);
        else {
            bad++; out.push('FIX   project folder\n      -> ' + projectProblem());
            var cands = projectCandidates();
            if (cands.length) out.push('      Projects found on this computer (open one with open_project):\n' + cands.map(function (f) { return '        ' + f; }).join('\n'));
        }
        out.push('');
        out.push(bad ? bad + ' thing' + (bad > 1 ? 's' : '') + ' to fix.'
            : 'Everything is ready. Next: project_overview.');
        return out.join('\n');
    }, true);

// Lite starts in the folder Claude was started in. When that is not a game, these find one.
function projectsIn(dir, depth) {
    var found = [];
    var walk = function (d, left) {
        var names = [];
        try { names = fs.readdirSync(d); } catch (e) { return; }
        names.forEach(function (n) {
            if (n[0] === '.' || n === 'node_modules' || found.length >= 20) return;
            var full = path.join(d, n);
            try { if (!fs.statSync(full).isDirectory()) return; } catch (e) { return; }
            if (fs.existsSync(path.join(full, 'data', 'System.json'))) found.push(full);
            else if (left > 0 && n !== 'img' && n !== 'audio' && n !== 'js' && n !== 'data') walk(full, left - 1);
        });
    };
    walk(dir, depth);
    return found;
}
function projectCandidates() {
    var home = require('os').homedir();
    var places = [process.cwd(), path.join(home, 'Documents', 'RPG Maker MV'), path.join(home, 'Documents', 'RMMZ'),
        path.join(home, 'Documents', 'Games'), path.join(home, 'Documents'), path.join(home, 'Desktop')];
    var seen = {}, out = [];
    places.forEach(function (pl) {
        projectsIn(pl, pl === path.join(home, 'Documents') || pl === path.join(home, 'Desktop') ? 1 : 2).forEach(function (f) {
            if (!seen[f] && out.length < 20) { seen[f] = true; out.push(f); }
        });
    });
    return out;
}

tool('open_project',
    'Open an RPG Maker MV or MZ project to work with: the game folder (the one with Game.rpgproject or game.rmmzproject), ' +
    'the project file itself or the folder right above the game. Use it when the session did not start in the game folder, ' +
    'or to switch to another game. Without a path it lists the projects it can find on this computer. Read only.',
    { path: { type: 'string', description: 'Folder or project file. Leave empty to list projects found on this computer.' } }, [],
    function (a) {
        if (!a.path) {
            var c = projectCandidates();
            return c.length ? 'RPG Maker projects found:\n' + c.map(function (f) { return '- ' + f; }).join('\n') + '\n\nOpen one with open_project and its path.'
                : 'No RPG Maker project found in the usual places (the current folder, Documents, Desktop). Ask the user for the game folder.';
        }
        var p = findProject(a.path);
        if (!fs.existsSync(path.join(p, 'data', 'System.json'))) {
            var near = fs.existsSync(p) ? projectsIn(p, 2) : [];
            throw new Error('No RPG Maker MV or MZ project in ' + p + ' (no data/System.json).' +
                (near.length ? ' Projects inside it: ' + near.join(', ') : ' Ask the user for the folder with Game.rpgproject or game.rmmzproject.'));
        }
        PROJECT_GIVEN = a.path; PROJECT = p; cache = {}; pluginCache = {};
        return 'Opened the ' + engineName() + ' project ' + PROJECT + ' (' + mapIds().length + ' maps). Next: project_overview.';
    }, true);

tool('find_item_usage',
    'Where an item, weapon or armor is given, taken, sold, checked or dropped: event commands, page conditions, shops, ' +
    'conditional branches and enemy drops. Use it to trace keys and quest items.',
    { kind: { type: 'string', enum: ['item', 'weapon', 'armor'] }, id: { type: 'integer' } }, ['kind', 'id'],
    function (a) {
        var k = { item: 0, weapon: 1, armor: 2 }[a.kind];
        var change = [126, 127, 128][k], branch = [8, 9, 10][k];
        var gives = [], checks = [], shops = [], drops = [];
        eachList(function (w, list, page) {
            if (page && page.conditions && k === 0 && page.conditions.itemValid && page.conditions.itemId === a.id) checks.push(whereText(w) + ': page condition (party has it)');
            (list || []).forEach(function (cmd) {
                var p = cmd.parameters || [];
                if (cmd.code === change && p[0] === a.id) {
                    var amount = p[2] === 0 ? String(p[3]) : 'variable ' + p[3] + nameTag(variableName(p[3]));
                    gives.push(whereText(w) + ': ' + (p[1] === 0 ? 'gives ' : 'takes ') + amount);
                }
                if (cmd.code === 111 && p[0] === branch && p[1] === a.id) checks.push(whereText(w) + ': if the party has it');
                if ((cmd.code === 302 || cmd.code === 605) && p[0] === k && p[1] === a.id) shops.push(whereText(w) + ': sold' + (p[2] ? ' for ' + p[3] : ''));
            });
        });
        try {
            readData('Enemies.json').forEach(function (e) {
                if (!e) return;
                (e.dropItems || []).forEach(function (d) {
                    if (d.kind === k + 1 && d.dataId === a.id) drops.push('enemy ' + e.id + ' "' + e.name + '": drops it (1 in ' + d.denominator + ')');
                });
            });
        } catch (e) { /* no enemies */ }
        var out = [a.kind.charAt(0).toUpperCase() + a.kind.slice(1) + ' ' + a.id + ' "' + dbName(a.kind, a.id) + '"'];
        var sec = function (t, l) { out.push(t + ' (' + l.length + '):'); out.push(l.length ? l.map(function (x) { return '  ' + x; }).join('\n') : '  none'); };
        sec('Given or taken', gives); sec('Checked', checks); sec('Sold in shops', shops); sec('Dropped by enemies', drops);
        return out.join('\n');
    });

tool('about_full_kit',
    'What the free Lite version can do and what the full Living World Kit adds (building maps and events, playtests, ' +
    'free plugin packs). Call this when the user wants Claude to build, change or playtest something.',
    {}, [],
    function () {
        return [
            'This is the free Living World Kit Lite: it reads and checks RPG Maker MV and MZ projects and never writes to them.',
            '',
            'The full Living World Kit for Claude adds:',
            '- building: maps from a text layout, events from presets (NPCs, doors, chests, shops, inns, cutscenes),',
            '  database entries, switch and variable names, with a backup of every change and undo',
            '- playtests: Claude starts the real game in a hidden browser, walks, talks, picks choices, fights battles',
            '  and sends screenshots; player profiles play whole chapters and report where they get stuck',
            '- plugins: switch plugins on and off in the right order, install the two free Living World plugin packs',
            '- a workflow package: CLAUDE.md template, about 60 lessons from a complete game, planning templates',
            '',
            'Full kit: ' + FULL_KIT,
            'Manual and roadmap: https://oasis-b.itch.io/living-world-plugins-docs'
        ].join('\n');
    }, true);

tool('project_overview',
    'Overview of the RPG Maker MV or MZ project: engine, title, start position, party, maps, database sizes, active plugins. Call this first.',
    {}, [], function () {
        var sys = system();
        var plugins = [];
        try {
            var txt = fs.readFileSync(path.join(PROJECT, 'js', 'plugins.js'), 'utf8');
            var arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
            plugins = arr.map(function (p) { return (p.status ? '' : '(off) ') + p.name; });
        } catch (e) { plugins = ['(could not read js/plugins.js)']; }
        var counts = Object.keys(DB_FILES).map(function (k) {
            try { return k + ' ' + readData(DB_FILES[k]).filter(Boolean).length; } catch (e) { return k + ' ?'; }
        });
        var ids = mapIds();
        return [
            'Project: ' + PROJECT + ' (' + engineName() + ')',
            'Title: ' + sys.gameTitle + ', currency "' + sys.currencyUnit + '", locale ' + (sys.locale || '?'),
            'Start: map ' + sys.startMapId + ' "' + mapName(sys.startMapId) + '" at (' + sys.startX + ',' + sys.startY + ')',
            'Starting party: ' + sys.partyMembers.map(function (a) { return dbName('actor', a); }).join(', '),
            'Battle view: ' + (sys.optSideView ? 'side view' : 'front view'),
            'Maps: ' + ids.length,
            'Database: ' + counts.join(', '),
            'Named switches: ' + sys.switches.filter(Boolean).length + ', named variables: ' + sys.variables.filter(Boolean).length,
            'Plugins (' + plugins.length + '): ' + plugins.join(', '),
            '',
            'Living World Kit Lite reads and checks. Building and playtests: see about_full_kit.'
        ].join('\n');
    });

tool('list_maps',
    'List all maps as a tree with id, name, size and number of events. Optional filter by name.',
    Object.assign({ filter: { type: 'string', description: 'Only maps whose name contains this text' } }, PAGE_PROPS), [],
    function (a) {
        var infos = mapInfos();
        var f = (a.filter || '').toLowerCase();
        var lines = [];
        function depth(info) {
            var d = 0;
            while (info && info.parentId) { d++; info = infos[info.parentId]; }
            return d;
        }
        infos.filter(Boolean).sort(function (x, y) { return x.order - y.order; }).forEach(function (info) {
            if (f && info.name.toLowerCase().indexOf(f) < 0) return;
            var size = '';
            try {
                var m = readMap(info.id);
                size = ' ' + m.width + 'x' + m.height + ', ' + m.events.filter(Boolean).length + ' events';
            } catch (e) { size = ' (no file)'; }
            lines.push('  '.repeat(depth(info)) + info.id + ' ' + info.name + size);
        });
        return lines.length ? paged(lines, a, 150, 'maps') : 'No maps match.';
    });

tool('view_map',
    'Show a map as a text grid: walkable and blocked tiles, events and doors with a legend. Use regions=true to see region ids.',
    { mapId: { type: 'integer' }, regions: { type: 'boolean' } }, ['mapId'],
    function (a) { return mapView(a.mapId, { regions: !!a.regions }); });

tool('list_events',
    'List the events on a map with position, pages, triggers, conditions, graphics and the first lines of each page. Maps with many events are paged; name filters by event name.',
    Object.assign({ mapId: { type: 'integer' }, name: { type: 'string', description: 'Only events whose name contains this' } }, PAGE_PROPS), ['mapId'],
    function (a) {
        var map = readMap(a.mapId);
        var evs = map.events.filter(function (ev) { return ev && (!a.name || ev.name.toLowerCase().indexOf(a.name.toLowerCase()) >= 0); });
        var off = a.offset || 0, lim = a.limit || 30;
        var more = evs.length - off - lim;
        evs = evs.slice(off, off + lim);
        var out = [];
        evs.forEach(function (ev) {
            out.push('Event ' + ev.id + ' "' + ev.name + '" at (' + ev.x + ',' + ev.y + ')' + (ev.note ? ' note: ' + ev.note : ''));
            ev.pages.forEach(function (page, pi) {
                var img = page.image.characterName ? page.image.characterName + ':' + page.image.characterIndex : (page.image.tileId ? 'tile ' + page.image.tileId : 'no graphic');
                var lines = listText(page.list);
                out.push('  page ' + (pi + 1) + ': ' + pageConditions(page.conditions) + ', ' + TRIGGERS[page.trigger] + ', ' + img +
                    (page.through ? ', through' : '') + ', ' + lines.length + ' commands');
                lines.slice(0, 4).forEach(function (l) { out.push('    ' + l); });
                if (lines.length > 4) out.push('    ...');
            });
        });
        if (more > 0) out.push('... ' + more + ' more events (offset ' + (off + lim) + ' for the next page, or filter with name)');
        return out.join('\n') || 'No events on this map.';
    });

tool('read_event',
    'Read one event in full: every page with conditions and all commands as readable text.',
    { mapId: { type: 'integer' }, eventId: { type: 'integer' } }, ['mapId', 'eventId'],
    function (a) {
        var ev = readMap(a.mapId).events[a.eventId];
        if (!ev) throw new Error('No event ' + a.eventId + ' on map ' + a.mapId);
        var out = ['Event ' + ev.id + ' "' + ev.name + '" at (' + ev.x + ',' + ev.y + ')' + (ev.note ? '\nNote: ' + ev.note : '')];
        ev.pages.forEach(function (page, pi) {
            out.push('\n== Page ' + (pi + 1) + ' (' + pageConditions(page.conditions) + ', ' + TRIGGERS[page.trigger] +
                ', priority ' + ['below', 'same as', 'above'][page.priorityType] + ' player' +
                (page.image.characterName ? ', graphic ' + page.image.characterName + ':' + page.image.characterIndex : '') + ')');
            out = out.concat(listText(page.list));
        });
        return out.join('\n');
    });

tool('read_common_event',
    'Read a common event in full, or list all common events when no id is given.',
    { id: { type: 'integer' } }, [],
    function (a) {
        var list = readData('CommonEvents.json');
        if (!a.id) {
            return list.filter(Boolean).map(function (ce) {
                return ce.id + ' "' + ce.name + '" ' + ['call', 'autorun', 'parallel'][ce.trigger] +
                    (ce.trigger ? ' on S' + ce.switchId : '') + ', ' + ce.list.length + ' commands';
            }).join('\n');
        }
        var ce = list[a.id];
        if (!ce) throw new Error('No common event ' + a.id);
        return 'Common event ' + ce.id + ' "' + ce.name + '"\n' + listText(ce.list).join('\n');
    });

tool('search_database',
    'Search the database (actor, class, skill, item, weapon, armor, enemy, troop, state, animation, tileset, commonevent) by name, note or id. Returns compact entries.',
    {
        kind: { type: 'string', enum: Object.keys(DB_FILES) },
        query: { type: 'string', description: 'Text in name or note; leave empty to list all' },
        id: { type: 'integer', description: 'Show this entry in full' },
        offset: PAGE_PROPS.offset, limit: PAGE_PROPS.limit
    }, ['kind'],
    function (a) {
        var list = readData(DB_FILES[a.kind]);
        if (a.id) {
            var e = list[a.id];
            if (!e) throw new Error('No ' + a.kind + ' ' + a.id);
            var copy = JSON.parse(JSON.stringify(e));
            if (copy.flags) copy.flags = '(' + copy.flags.length + ' tile flags)';
            if (copy.frames) copy.frames = '(' + copy.frames.length + ' frames)';
            if (copy.list) copy.list = listText(copy.list);
            if (copy.pages) copy.pages = copy.pages.map(function (p) { return listText(p.list); });
            return JSON.stringify(copy, null, 1);
        }
        var q = (a.query || '').toLowerCase();
        var out = [];
        list.forEach(function (e) {
            if (!e) return;
            var hay = (e.name + ' ' + (e.note || '') + ' ' + (e.description || '')).toLowerCase();
            if (q && hay.indexOf(q) < 0) return;
            out.push(e.id + ' ' + e.name + (e.price !== undefined ? ', price ' + e.price : '') +
                (e.mpCost !== undefined ? ', MP ' + e.mpCost + ' TP ' + e.tpCost : '') +
                (e.params && a.kind === 'enemy' ? ', HP ' + e.params[0] + ' ATK ' + e.params[2] + ', exp ' + e.exp + ', gold ' + e.gold : '') +
                (e.note ? ' | note: ' + e.note.replace(/\s+/g, ' ').slice(0, 80) : ''));
        });
        return out.length ? paged(out, a, 60, 'entries') : 'Nothing found.';
    });

tool('find_switch_usage',
    'Find where a switch is turned on/off and where it is checked (page conditions, conditional branches, scripts, common event triggers).',
    { id: { type: 'integer' } }, ['id'],
    function (a) {
        var u = usage('switch', a.id);
        return 'Switch ' + a.id + nameTag(switchName(a.id)) + '\nSet (' + u.writes.length + '):\n' + (u.writes.join('\n') || '  none') +
            '\nChecked (' + u.reads.length + '):\n' + (u.reads.join('\n') || '  none');
    });

tool('find_variable_usage',
    'Find where a variable is changed and where it is checked.',
    { id: { type: 'integer' } }, ['id'],
    function (a) {
        var u = usage('variable', a.id);
        return 'Variable ' + a.id + nameTag(variableName(a.id)) + '\nChanged (' + u.writes.length + '):\n' + (u.writes.join('\n') || '  none') +
            '\nChecked (' + u.reads.length + '):\n' + (u.reads.join('\n') || '  none');
    });

tool('find_text',
    'Search all dialogue, choices, comments, scripts and plugin commands in maps, common events and troops for a text.',
    { query: { type: 'string' }, limit: { type: 'integer' } }, ['query'],
    function (a) {
        var q = a.query.toLowerCase();
        var lim = a.limit || 100;
        var out = [];
        eachList(function (w, list) {
            (list || []).forEach(function (cmd) {
                if (out.length >= lim) return;
                if ([401, 405, 102, 108, 408, 355, 655, 356].indexOf(cmd.code) < 0) return;
                var t = cmd.code === 102 ? cmd.parameters[0].join(' | ') : String(cmd.parameters[0]);
                if (t.toLowerCase().indexOf(q) >= 0) out.push(whereText(w) + ': ' + t);
            });
        });
        return (out.join('\n') || 'Not found.') + (out.length >= lim ? '\n(cut at ' + lim + ')' : '');
    });

tool('map_connections',
    'Show how maps connect through transfer events (door at x,y on map A leads to x,y on map B). Optional mapId for one map only.',
    Object.assign({ mapId: { type: 'integer' } }, PAGE_PROPS), [],
    function (a) {
        var g = mapGraph();
        var out = [];
        Object.keys(g).forEach(function (from) {
            if (a.mapId && +from !== a.mapId && !g[from].some(function (e) { return e.to === a.mapId; })) return;
            g[from].forEach(function (e) {
                if (a.mapId && +from !== a.mapId && e.to !== a.mapId) return;
                out.push(from + ' "' + mapName(+from) + '" (' + e.x + ',' + e.y + ') -> ' + e.to + ' "' + mapName(e.to) + '" (' + e.tx + ',' + e.ty + ')  [event ' + e.event + ']');
            });
        });
        return out.length ? paged(out, a, 80, 'transfers') : 'No transfers found.';
    });

tool('check_project',
    'Look for common bugs: switches/variables that are checked but never set, transfers to missing maps, into walls, onto events or into spots with no way out, missing images and sounds, stacked events, events outside the map, broken indentation in event lists, a single word alone on the last line of a message, sentences torn across two windows, author notes like TODO left in game text, plugins that replace each other\'s functions, missing common events or troops, maps no door leads to, and (with maxChars) message lines too long for the window.',
    {
        maxChars: { type: 'integer', description: 'Characters per message line without a face (around 54 for the default window). 0 skips this check.' },
        limit: { type: 'integer', description: 'Maximum number of problems listed per kind (default 25)' }
    }, [],
    function (a) {
        var r = checkProject(a);
        if (!/^No problems found/.test(r)) r += '\n\n(Lite finds and explains these. The full Living World Kit can also fix them and check the fix in a playtest: ' + FULL_KIT + ')';
        return r;
    });

tool('tiles_used',
    'List the tiles an existing map uses per layer, with their codes (A2:5, B:row,col ...) and whether they are walkable. Use this to copy the look of a map you like.',
    { mapId: { type: 'integer' } }, ['mapId'],
    function (a) { return tilesUsed(a.mapId); });

tool('plugin_help',
    'Read installed plugins. Without name: every plugin in js/plugins with on/off and description. With name: description, parameters with current values, ' +
    'help sections, notetags and plugin commands. With section: the full text of that help section. With search: help lines containing the text. ' +
    'Read the help before you use a plugin\'s notetags or commands.',
    { name: { type: 'string', description: 'Plugin file name without .js, e.g. LW_Cutscene' },
      section: { type: 'string', description: 'Help section title (or the start of it), e.g. "Plugin Commands"' },
      search: { type: 'string', description: 'Find help lines containing this text, in one plugin or (without name) in all' } }, [],
    function (a) {
        var list = [];
        try { list = readPluginList(); } catch (e) { /* none */ }
        var byName = {};
        list.forEach(function (p) { byName[p.name] = p; });
        if (!a.name && a.search) {
            var q = a.search.toLowerCase(), hits = [];
            installedPluginFiles().forEach(function (n) {
                var inf = pluginInfo(n);
                if (!inf) return;
                inf.sections.forEach(function (s) {
                    s.lines.forEach(function (l) { if (l.toLowerCase().indexOf(q) >= 0) hits.push(n + ' / ' + s.title + ': ' + l.trim()); });
                });
            });
            return hits.length ? paged(hits, a, 60, 'lines') : 'No help line contains "' + a.search + '".';
        }
        if (!a.name) {
            var out = list.map(function (p, i) {
                var inf = pluginInfo(p.name);
                return (i + 1) + '. ' + (p.status ? 'on ' : 'off') + ' ' + p.name + (inf ? ': ' + inf.desc : ' (file missing)');
            });
            var extra = installedPluginFiles().filter(function (n) { return !byName[n] && !(isMZ() && MZ_SAMPLE_PLUGINS.indexOf(n) >= 0); });
            if (extra.length) out.push('', 'In js/plugins but not in the plugin list: ' + extra.join(', ') + ' (add them in the Plugin Manager, or with set_plugin in the full kit)');
            return out.join('\n') || 'No plugins.';
        }
        var info = pluginInfo(a.name);
        if (!info) return 'No file js/plugins/' + a.name + '.js. Installed: ' + installedPluginFiles().join(', ');
        if (a.section) {
            var s = a.section.toLowerCase();
            var found = info.sections.filter(function (x) { return x.title.toLowerCase().indexOf(s) === 0; })[0] ||
                info.sections.filter(function (x) { return x.title.toLowerCase().indexOf(s) >= 0; })[0];
            if (!found) return 'No section "' + a.section + '". Sections: ' + info.sections.map(function (x) { return x.title; }).join(', ');
            return a.name + ' / ' + found.title + '\n\n' + found.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        }
        if (a.search) {
            var qq = a.search.toLowerCase(), h = [];
            info.sections.forEach(function (x) { x.lines.forEach(function (l) { if (l.toLowerCase().indexOf(qq) >= 0) h.push(x.title + ': ' + l.trim()); }); });
            return h.join('\n') || 'No line contains "' + a.search + '".';
        }
        var p = byName[a.name];
        var out2 = [a.name + (info.author ? ' by ' + info.author : '') + ': ' + info.desc,
            p ? 'In the plugin list at position ' + (list.indexOf(p) + 1) + ', ' + (p.status ? 'on' : 'off') : 'Not in the plugin list yet (add it in the Plugin Manager)'];
        if (info.requires.length) out2.push('Needs: ' + info.requires.join(', '));
        if (info.params.length) {
            out2.push('', 'Parameters (current value, default, description):');
            info.params.forEach(function (pa) {
                var v = p && p.parameters && p.parameters[pa.name] !== undefined ? p.parameters[pa.name] : '(not set)';
                out2.push('  ' + pa.name + ' = ' + JSON.stringify(v) + ' (default ' + JSON.stringify(pa.def) + (pa.type ? ', ' + pa.type : '') + ')' + (pa.desc ? ': ' + pa.desc : ''));
            });
        }
        var cmds = Object.keys(info.commands), tags = Object.keys(info.notetags);
        var mzc = Object.keys(info.mzCommands);
        if (mzc.length) {
            out2.push('', 'Plugin commands (MZ, add with a step { plugin: { name: "' + a.name + '", command, args } }):');
            mzc.forEach(function (k) { var c = info.mzCommands[k]; out2.push('  ' + k + (c.args.length ? ' (' + c.args.join(', ') + ')' : '') + (c.desc ? ': ' + c.desc : '')); });
        }
        if (cmds.length) out2.push('', (mzc.length ? 'Text commands from MV, still work: ' : 'Plugin commands: ') + cmds.join(', '));
        if (tags.length) out2.push('Notetags: ' + tags.map(function (t) { return '<' + t + '>'; }).join(', '));
        out2.push('', 'Help sections (read one with section): ' + info.sections.map(function (x) { return x.title + ' (' + x.lines.filter(function (l) { return l.trim(); }).length + ' lines)'; }).join(', '));
        return out2.join('\n');
    });

// ---------------------------------------------------------------------------
// MCP over stdio
// ---------------------------------------------------------------------------
function send(msg) {
    process.stdout.write(JSON.stringify(msg) + '\n');
}

function result(id, res) { send({ jsonrpc: '2.0', id: id, result: res }); }

function error(id, code, message) { send({ jsonrpc: '2.0', id: id, error: { code: code, message: message } }); }

function handle(msg) {
    var id = msg.id;
    switch (msg.method) {
        case 'initialize':
            return result(id, {
                protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
                capabilities: { tools: {} },
                serverInfo: { name: 'living-world-kit-lite', version: VERSION },
                instructions: (isProject() ? 'Living World Kit Lite (read and check only) for an ' + engineName() + ' project at ' + PROJECT + '. Start with project_overview, then view_map and list_events. ' +
                    'This version never writes to the project. Use these tools instead of reading data/*.json yourself: they decode event commands, names and conditions and search the whole project at once. ' +
                    'When the user wants Claude to build, change or playtest something, call about_full_kit and tell them what the full kit adds. '
                    : 'The project folder is not set up yet: ' + projectProblem() + ' Call check_setup to see what is missing. ') +
                    'Map ids, event ids and database ids are the same numbers you see in the RPG Maker editor. ' +
                    'To work on another project in this chat, call open_project (without a path it lists the projects it finds).' +
                    (process.env.LW_FROM_BUNDLE ? ' To change the project for good, the user picks a new folder in Claude Desktop: Settings, Extensions (or Plugins), Living World Kit for RPG Maker.' : '')
            });
        case 'notifications/initialized':
        case 'notifications/cancelled':
            return;
        case 'ping':
            return result(id, {});
        case 'tools/list':
            return result(id, {
                tools: TOOLS.map(function (t) {
                    return { name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations };
                })
            });
        case 'tools/call':
            var name = msg.params && msg.params.name;
            var t = TOOLS.filter(function (x) { return x.name === name; })[0];
            if (!t) return error(id, -32602, 'Unknown tool: ' + name);
            return Promise.resolve().then(function () {
                if (!t.noProject && !isProject()) throw new Error(projectProblem());
                var args = (msg.params && msg.params.arguments) || {};
                var props = t.inputSchema.properties;
                // common other spellings: snake_case, map_id/mapId/map, code for js, key for buttons
                var ALIAS = { map_id: ['mapId', 'map'], mapId: ['map'], map: ['mapId'], code: ['js'], script: ['js'], key: ['buttons'], keys: ['buttons'], button: ['buttons'], event_id: ['eventId'], troop_id: ['troopId'] };
                Object.keys(args).forEach(function (k) {
                    if (k in props) return;
                    var tries = [k.replace(/_([a-z])/g, function (m, c) { return c.toUpperCase(); })].concat(ALIAS[k] || []);
                    for (var i = 0; i < tries.length; i++) {
                        if (tries[i] in props && args[tries[i]] === undefined) { args[tries[i]] = args[k]; delete args[k]; break; }
                    }
                });
                Object.keys(props).forEach(function (k) {
                    if (props[k].type === 'array' && typeof args[k] === 'string') args[k] = [args[k]];
                });
                var missing = t.inputSchema.required.filter(function (k) { return args[k] === undefined || args[k] === null; });
                var unknown = Object.keys(args).filter(function (k) { return !(k in props); });
                if (missing.length || (unknown.length && Object.keys(props).length)) {
                    throw new Error((missing.length ? 'Missing: ' + missing.join(', ') + '. ' : '') +
                        (unknown.length ? 'Unknown: ' + unknown.join(', ') + '. ' : '') +
                        'Parameters of ' + t.name + ': ' + Object.keys(props).map(function (k) {
                            return k + (props[k].enum ? ' (' + props[k].enum.join('|') + ')' : '');
                        }).join(', '));
                }
                Object.keys(args).forEach(function (k) {
                    if (props[k] && props[k].enum && props[k].enum.indexOf(args[k]) < 0) {
                        throw new Error(k + ' must be one of: ' + props[k].enum.join(', '));
                    }
                });
                return t.run(args);
            }).then(function (out) {
                var content = [];
                if (out && typeof out === 'object' && out.image) {
                    content.push({ type: 'image', data: out.image, mimeType: out.mime || 'image/jpeg' });
                    out = out.text || '';
                }
                var text = String(out);
                if (text.length > MAX_OUT) text = text.slice(0, MAX_OUT) + '\n... (output cut at ' + MAX_OUT + ' characters, narrow the request)';
                content.push({ type: 'text', text: text });
                result(id, { content: content });
            }, function (e) {
                result(id, { content: [{ type: 'text', text: 'Error: ' + (e && e.message ? e.message : e) }], isError: true });
            });
        default:
            if (id !== undefined) error(id, -32601, 'Method not found: ' + msg.method);
    }
}

if (!process.env.LW_LIBRARY) {
    var rl = readline.createInterface({ input: process.stdin });
    rl.on('close', function () { process.exit(0); });
    rl.on('line', function (line) {
        line = line.trim();
        if (!line) return;
        var msg;
        try { msg = JSON.parse(line); } catch (e) { return error(null, -32700, 'Parse error'); }
        if (Array.isArray(msg)) msg.forEach(handle); else handle(msg);
    });
}

module.exports = { TOOLS: TOOLS, handle: handle, VERSION: VERSION, isProject: isProject,
    setProject: function (p) { PROJECT_GIVEN = p; PROJECT = findProject(p); cache = {}; return PROJECT; } };
