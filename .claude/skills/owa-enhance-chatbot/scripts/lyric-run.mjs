#!/usr/bin/env node
// The song conversation, asked as a person asks it (2026-11-12, the user's
// goal: _chatbot will be very smart to help user edit lyric_). Every ask in
// `references/lyric-edit-asks.json` gets a FRESH copy of the run's song in
// the scratch profile's Documents folder and a tab of its own: the copy is
// put on the box's paperclip input over CDP (`DOM.setFileInputFiles`, what
// choosing it does), the words typed through React's own setter, Send
// pressed. Each answer is recorded with its buttons, every tool call the
// window made (read off the network), and the song as the change left it --
// the newest entry of its editing history on disk -- graded by the ask's own
// checks: the change asked for made, and nothing else lost (the chords, the
// translation lines under the words, the parts not named).
//
//   node lyric-run.mjs --profile=<userDataPath part> [--only=L01,L02]
//        [--asks=lyric-edit-asks-2.json] [--out=<file.jsonl>] [--wait=150]
//
// `--asks` names another set in `references/` (a second song, harder asks);
// the first is the default.
//
// A SCRATCH profile only (memory scratch-dev-instance-beside-user-app): it
// refuses a packaged instance and the person's own development profile. The
// help window must already be open there (`--owa-open-chatbot` on launch is
// the route with no caution, by the user's word). On Auto it asks a free
// assistant; nothing is saved -- every change stays in the copy's editing
// history -- and the copies are left for the run's own clean-up.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateOpenLyric } from '../../../../tools/owa-devtools-mcp/openLyric.mjs';
import { describeLyricDocument } from '../../../../tools/owa-devtools-mcp/openLyricEdit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        return match ? [match[1], match[2] ?? true] : [arg, true];
    }),
);
const ASKS = JSON.parse(
    fs.readFileSync(
        path.join(
            HERE,
            '..',
            'references',
            path.basename(String(args.asks ?? 'lyric-edit-asks.json')),
        ),
        'utf8',
    ),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WAIT_MS = Number(args.wait ?? 150) * 1000;

let instance = null;
const discoveryDir = path.join(os.tmpdir(), 'open-worship-app-cdp');
for (const file of fs.readdirSync(discoveryDir)) {
    const data = JSON.parse(
        fs.readFileSync(path.join(discoveryDir, file), 'utf8'),
    );
    try {
        // A file left by an instance that is gone names a dead port.
        process.kill(data.pid, 0);
    } catch {
        continue;
    }
    if (
        String(data.userDataPath ?? '').includes(String(args.profile ?? '\0'))
    ) {
        instance = {
            port: data.port,
            isDev: data.isDev,
            userDataPath: data.userDataPath,
        };
    }
}
if (instance === null || instance.isDev !== true) {
    console.error('No development instance matches --profile');
    process.exit(1);
}
if (/open-worship-app-dev[\\/]?$/i.test(instance.userDataPath)) {
    console.error(
        "That is the person's own development profile: use a scratch one.",
    );
    process.exit(1);
}
const setting = JSON.parse(
    fs.readFileSync(path.join(instance.userDataPath, 'setting.json'), 'utf8'),
);
const DOCUMENTS = path.join(
    setting.clientSetting['selected-parent-dir'],
    'documents',
);
const OUT = path.resolve(
    String(args.out ?? path.join(os.tmpdir(), `lyric-run-${Date.now()}.jsonl`)),
);

const targets = await (
    await fetch(`http://127.0.0.1:${instance.port}/json/list`)
).json();
const target = targets.find(
    (one) => one.type === 'page' && one.url.includes('chatbot.html'),
);
if (!target) {
    console.error('no help window');
    process.exit(1);
}
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve));
let lastId = 0;
const pending = new Map();
const toolCalls = [];
socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
        return;
    }
    const body =
        message.method === 'Network.requestWillBeSent'
            ? message.params?.request?.postData
            : null;
    if (typeof body === 'string' && body.includes('tools/call')) {
        try {
            const parsed = JSON.parse(body);
            toolCalls.push({
                name: parsed.params?.name,
                args: parsed.params?.arguments,
            });
        } catch {}
    }
});
function send(method, params = {}) {
    const id = ++lastId;
    return new Promise((resolve) => {
        pending.set(id, (message) => resolve(message.result ?? message));
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    return result?.result?.value;
}
await send('Network.enable');

/** The song as its newest editing-history entry holds it, else the file. */
function readSongNow(filePath) {
    const historyDir = `${filePath}.histories`;
    if (fs.existsSync(historyDir)) {
        const entries = fs
            .readdirSync(historyDir)
            .map((name) => {
                return {
                    name,
                    at: fs.statSync(path.join(historyDir, name)).mtimeMs,
                };
            })
            .sort((a, b) => b.at - a.at);
        for (const entry of entries) {
            try {
                const json = JSON.parse(
                    fs.readFileSync(path.join(historyDir, entry.name), 'utf8'),
                );
                if (typeof json?.content === 'string') return json.content;
            } catch {}
        }
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).content;
}

function countChords(text) {
    return [...String(text).matchAll(/\[[A-G][^\]\s]*\]/g)].length;
}
function countTranslations(text) {
    return String(text)
        .split('\n')
        .filter((line) => /^\t\S/.test(line)).length;
}
function partLines(described, part) {
    return described.parts.find((one) => one.part === part) ?? null;
}
function listChordNames(lines) {
    return (lines ?? []).flatMap((line) => {
        return [...String(line).matchAll(/\[([A-G][^\]\s]*)\]/g)].map(
            (one) => one[1],
        );
    });
}
function toBare(lines) {
    return (lines ?? []).map((line) =>
        String(line)
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
    );
}

/** Each check of an ask, against the song before and after. */
function grade(ask, before, after) {
    const was = describeLyricDocument(before);
    const now = describeLyricDocument(after);
    const results = [];
    const say = (name, isOk, detail = '') =>
        results.push({ name, isOk, detail });
    say('valid', validateOpenLyric(after).problems.length === 0);
    const expect = ask.expect ?? {};
    if (expect.unchanged === true) {
        say('unchanged', after === before);
    }
    for (const [part, index, words] of expect.lineHas ?? []) {
        const line = partLines(now, part)?.lines?.[index] ?? '';
        say(
            `${part} line ${index + 1} has "${words}"`,
            line.includes(words),
            line,
        );
    }
    for (const [part, index, words] of expect.lineLacks ?? []) {
        const line = partLines(now, part)?.lines?.[index] ?? '';
        say(
            `${part} line ${index + 1} lacks "${words}"`,
            !line.includes(words),
            line,
        );
    }
    for (const [part, index, words] of expect.translationHas ?? []) {
        const line = partLines(now, part)?.translations?.[index] ?? '';
        say(
            `${part} translation ${index + 1} has "${words}"`,
            String(line).includes(words),
            line,
        );
    }
    if (expect.chords !== undefined) {
        const count = countChords(after);
        say(
            `chords ${expect.chords}`,
            count === expect.chords,
            `${countChords(before)} → ${count}`,
        );
    }
    if (expect.translations !== undefined) {
        const count = countTranslations(after);
        say(
            `translation lines ${expect.translations}`,
            count === expect.translations,
            `${countTranslations(before)} → ${count}`,
        );
    }
    for (const part of expect.partsKept ?? []) {
        const one = JSON.stringify(partLines(was, part));
        const two = JSON.stringify(partLines(now, part));
        say(`${part} kept`, one === two);
    }
    for (const part of expect.partsGone ?? []) {
        say(`${part} gone`, partLines(now, part) === null);
    }
    for (const part of expect.partsAdded ?? []) {
        say(`${part} added`, partLines(now, part) !== null);
    }
    if (expect.key !== undefined) {
        say(`key ${expect.key}`, now.key === expect.key, String(now.key));
    }
    if (expect.title !== undefined) {
        say(
            `title ${expect.title}`,
            now.title === expect.title,
            String(now.title),
        );
    }
    if (expect.playOrderEnds !== undefined) {
        const order = now.playOrder.join(' → ');
        say(
            `play order ends "${expect.playOrderEnds}"`,
            order.endsWith(expect.playOrderEnds),
            order,
        );
    }
    for (const [part, count] of expect.partChords ?? []) {
        const names = listChordNames(partLines(now, part)?.lines);
        say(
            `${part} has ${count} chords`,
            names.length === count,
            names.join(' '),
        );
    }
    for (const [name, count] of Object.entries(expect.chordTally ?? {})) {
        const all = now.parts.flatMap((one) => listChordNames(one.lines));
        const found = all.filter((one) => one === name).length;
        say(`chord ${name} × ${count}`, found === count, String(found));
    }
    for (const [part, count] of expect.partLineCount ?? []) {
        const lines = partLines(now, part)?.lines ?? [];
        say(
            `${part} has ${count} lines`,
            lines.length === count,
            String(lines.length),
        );
    }
    for (const [part, count] of expect.partTranslations ?? []) {
        const list = (partLines(now, part)?.translations ?? []).filter(
            (one) => {
                return typeof one === 'string' && one.trim() !== '';
            },
        );
        say(
            `${part} has ${count} translation lines`,
            list.length === count,
            String(list.length),
        );
    }
    for (const part of expect.wordsKept ?? []) {
        const one = JSON.stringify(toBare(partLines(was, part)?.lines));
        const two = JSON.stringify(toBare(partLines(now, part)?.lines));
        say(`${part} words kept`, one === two, two.slice(0, 120));
    }
    for (const [part, words] of expect.partHas ?? []) {
        const text = (partLines(now, part)?.lines ?? []).join('\n');
        const bare = toBare(partLines(now, part)?.lines).join('\n');
        say(
            `${part} has "${words}"`,
            text.includes(words) || bare.includes(words),
            text.slice(0, 120),
        );
    }
    for (const [part, words] of expect.partLacks ?? []) {
        const text = toBare(partLines(now, part)?.lines).join('\n');
        say(
            `${part} lacks "${words}"`,
            !text.includes(words),
            text.slice(0, 120),
        );
    }
    if (expect.playOrderIs !== undefined) {
        const order = now.playOrder.join(' → ');
        say(
            `play order "${expect.playOrderIs}"`,
            order === expect.playOrderIs,
            order,
        );
    }
    if (expect.playOrderHasBefore !== undefined) {
        const [first, second] = expect.playOrderHasBefore;
        const order = now.playOrder;
        const isOk =
            order.indexOf(first) !== -1 &&
            order.indexOf(first) < order.indexOf(second);
        say(
            `play order has ${first} before ${second}`,
            isOk,
            order.join(' → '),
        );
    }
    for (const [name, value] of Object.entries(expect.config ?? {})) {
        say(
            `${name} ${value}`,
            String(now[name] ?? '') === String(value),
            String(now[name]),
        );
    }
    if (expect.wordsHave !== undefined) {
        const words = now.parts.flatMap((one) => one.lines).join('\n');
        for (const word of expect.wordsHave) {
            say(`words have "${word}"`, words.includes(word));
        }
    }
    if (expect.wordsLack !== undefined) {
        const words = now.parts.flatMap((one) => one.lines).join('\n');
        for (const word of expect.wordsLack) {
            say(`words lack "${word}"`, !words.includes(word));
        }
    }
    return results;
}

const STATE_SOURCE = `(() => {
    const isBusy = !!document.querySelector('button.chat-send.is-stop, button.chat-stop')
        || [...document.querySelectorAll('button')].some((one) => (one.innerText || '').trim().toUpperCase() === 'STOP');
    return JSON.stringify({ isBusy, count: document.querySelectorAll('article.cue').length });
})()`;

const only =
    typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
const original = ASKS.song.join('\n');
for (const ask of ASKS.asks) {
    if (only !== null && !only.has(ask.id)) continue;
    const name = `zz Robot ${ASKS.songName} ${ask.id}`;
    const filePath = path.join(DOCUMENTS, `${name}.owl`);
    fs.rmSync(`${filePath}.histories`, { recursive: true, force: true });
    fs.writeFileSync(
        filePath,
        JSON.stringify({
            metadata: {
                app: 'open-worship',
                fileVersion: 1,
                initDate: new Date().toISOString(),
            },
            content: original,
        }),
    );
    // A tab of its own: the + at the end of the strip. The strip holds 12
    // tabs (`MAX_SESSION_COUNT`) and + does nothing on a full one -- every
    // ask of the run that found it so went into ONE old tab, its earlier
    // songs still attached, and the model changed those. So a full strip
    // gives up its oldest tab (a scratch profile's: this run's own), and an
    // ask whose tab did not open is not asked.
    const countTabs = async () => {
        return Number(
            await evaluate(`document.querySelectorAll('.chat-tab').length`),
        );
    };
    while ((await countTabs()) >= 12) {
        await evaluate(
            `document.querySelector('.chat-tab .chat-tab-close')?.click()`,
        );
        await sleep(500);
    }
    const tabsBefore = await countTabs();
    // Once more after a second: a press that lands while the last tab is
    // still closing opens nothing.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        await evaluate(`document.querySelector('.chat-tab-add')?.click()`);
        await sleep(800 + attempt * 1200);
        if ((await countTabs()) === tabsBefore + 1) break;
    }
    if ((await countTabs()) !== tabsBefore + 1) {
        console.log(`${ask.id} SKIPPED: no new tab opened`);
        continue;
    }
    const { root } = await send('DOM.getDocument', { depth: 1 });
    const { nodeId } = await send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'input.chat-file-input',
    });
    await send('DOM.setFileInputFiles', { nodeId, files: [filePath] });
    await sleep(1500);
    const before = Number(JSON.parse(await evaluate(STATE_SOURCE)).count);
    await evaluate(`(() => {
        const box = document.querySelector('textarea');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(box, ${JSON.stringify(ask.ask)});
        box.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(300);
    toolCalls.length = 0;
    // A mark on the page: gone means the help window was RELOADED under
    // the ask -- the dev server does that on any save under `src/` the
    // window imports, another session's included -- and the ask went with
    // it. EC-527's H04 sat 150 s with no model round for that and was
    // graded wrong; it is not graded now (the mark is re-read every poll).
    const mark = JSON.stringify(`${ask.id}-${Date.now()}`);
    await evaluate(`window.__owaLyricRunAsk = ${mark}`);
    const startedAt = Date.now();
    await evaluate(
        `document.querySelector('button.chat-send[type=submit]:not(.chat-add)')?.click()`,
    );
    let isReloaded = false;
    while (Date.now() - startedAt < WAIT_MS) {
        await sleep(1500);
        if ((await evaluate(`window.__owaLyricRunAsk === ${mark}`)) !== true) {
            isReloaded = true;
            break;
        }
        const state = JSON.parse(await evaluate(STATE_SOURCE));
        if (!state.isBusy && state.count >= before + 2) break;
    }
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    if (isReloaded) {
        await sleep(3000);
        await evaluate(
            `document.querySelector('.chat-tab.is-on .chat-tab-close')?.click()`,
        );
        console.log(
            `${ask.id} RELOADED: the help window reloaded under the ask after ${seconds}s (a file it imports changed); not graded -- ask it again with --only=${ask.id}.`,
        );
        continue;
    }
    const answer = JSON.parse(
        await evaluate(`(() => {
            const cues = [...document.querySelectorAll('article.cue')];
            const last = cues[cues.length - 1];
            if (!last) return JSON.stringify({});
            const body = last.querySelector('.cue-body') ?? last;
            return JSON.stringify({
                text: (body.innerText || '').slice(0, 3000),
                buttons: [...last.querySelectorAll('button')].map((one) => (one.innerText || one.title || '').trim()).filter(Boolean),
                head: (document.querySelector('.chat-head')?.innerText || '').replace(/\\s+/g, ' ').slice(0, 200),
            });
        })()`),
    );
    // The spend guard's latch: every ask after this one would be answered
    // "paused" in 2 s and graded wrong. Only a PERSON lifts it (Allow
    // more), so the run stops here and says so (EC-527).
    if ((answer.buttons ?? []).some((one) => /^allow more$/i.test(one))) {
        await evaluate(
            `document.querySelector('.chat-tab.is-on .chat-tab-close')?.click()`,
        );
        console.log(
            `${ask.id} PAUSED: the spend guard stopped the assistant; a person must press Allow more in the help window. ${ask.id} and every ask after it were not graded.`,
        );
        break;
    }
    const after = readSongNow(filePath);
    const checks = grade(ask, original, after);
    const passed = checks.filter((one) => one.isOk).length;
    const row = {
        id: ask.id,
        ask: ask.ask,
        seconds,
        tools: toolCalls.map((one) => ({
            name: one.name,
            action: one.args?.action,
            args: one.args,
        })),
        answer,
        checks,
        score: `${passed}/${checks.length}`,
        isRight: passed === checks.length,
        after,
    };
    fs.appendFileSync(OUT, `${JSON.stringify(row)}\n`);
    // Its tab goes with it, so the next ask starts on an empty strip end.
    await evaluate(
        `document.querySelector('.chat-tab.is-on .chat-tab-close')?.click()`,
    );
    await sleep(500);
    console.log(
        `${ask.id} ${row.isRight ? 'RIGHT' : 'WRONG'} ${row.score} ${seconds}s tools=${row.tools
            .map((one) => `${one.name}:${one.action ?? ''}`)
            .join(',')}`,
    );
    for (const check of checks.filter((one) => !one.isOk)) {
        console.log(
            `   ✗ ${check.name} ${check.detail ? `(${String(check.detail).slice(0, 120)})` : ''}`,
        );
    }
}
console.log('written', OUT);
socket.close();
process.exit(0);
