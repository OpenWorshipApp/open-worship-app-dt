#!/usr/bin/env node
// The standing note asks (`references/note-asks.md`), asked one after another
// through the real help window of a SCRATCH development profile, each change
// taken back before the next (owa-enhance-bible-note-chatbot, §2, BN-05).
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/run-note-asks.mjs <userDataPath part> [--only=1,4,11] [--wait=150]
//
// For each ask it prints: how many `owa_note_edit` edit calls the model made
// (one is the bar), the calls themselves, and the answer's first line -- the
// grading (fields right, the note right on a picture of the note window, the
// answer true) is the run's, in the scoreboard. After an ask that changed the
// note, its **Undo this change** is pressed (the answer's one action button,
// in any language). The help window must already be
// open on the note; `ask-note-chat.mjs` refuses the person's own profile.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ASKS_PATH = join(SCRIPT_DIR, '..', 'references', 'note-asks.md');
const [, , userDataPart, ...rest] = process.argv;
if (!userDataPart) {
    console.error("Give a piece of the scratch profile's userDataPath.");
    process.exit(2);
}
const onlyArg = rest.find((arg) => arg.startsWith('--only='));
const onlySet = onlyArg
    ? new Set(onlyArg.slice('--only='.length).split(',').map(Number))
    : null;
const waitSeconds = Number(
    rest.find((arg) => arg.startsWith('--wait='))?.slice('--wait='.length) ??
        150,
);

/** `11. _Add a table …_ — what it should do` → number and words. */
function readAsks() {
    const asks = [];
    for (const line of readFileSync(ASKS_PATH, 'utf8').split(/\r?\n/)) {
        const match = /^(\d+)\.\s+_([^_]+)_/.exec(line);
        if (match !== null) {
            asks.push({ n: Number(match[1]), text: match[2].trim() });
        }
    }
    return asks;
}

function findInstancePort() {
    for (const file of readdirSync(join(tmpdir(), 'open-worship-app-cdp'))) {
        try {
            const data = JSON.parse(
                readFileSync(
                    join(tmpdir(), 'open-worship-app-cdp', file),
                    'utf8',
                ),
            );
            if (String(data.userDataPath ?? '').includes(userDataPart)) {
                return data.port;
            }
        } catch (_error) {
            // not one
        }
    }
    return null;
}

/** Presses the last answer's Undo this change, when it has one. */
async function pressUndo(port) {
    const targets = await (
        await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    const target = targets.find((one) => {
        return one.type === 'page' && one.url.includes('chatbot.html');
    });
    if (!target) {
        return 'no help window';
    }
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve));
    const expression = `(() => {
        const cues = [...document.querySelectorAll('article.cue')];
        const last = cues[cues.length - 1];
        // Under a note change the answer's one action button (class cue-act) is
        // Undo this change, whatever language the window is in.
        const actions = last ? [...last.querySelectorAll('button.cue-act')] : [];
        const button = actions.length === 1 ? actions[0] : null;
        if (!button) return 'nothing to undo';
        button.click();
        return 'undone';
    })()`;
    const answer = await new Promise((resolve) => {
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id === 1) {
                resolve(message.result?.result?.value);
            }
        });
        socket.send(
            JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: { expression, returnByValue: true },
            }),
        );
    });
    socket.close();
    return answer;
}

const port = findInstancePort();
if (port === null) {
    console.error('No published instance matches', userDataPart);
    process.exit(1);
}
const rows = [];
for (const ask of readAsks()) {
    if (onlySet !== null && !onlySet.has(ask.n)) {
        continue;
    }
    let output = '';
    try {
        output = execFileSync(
            process.execPath,
            [
                join(SCRIPT_DIR, 'ask-note-chat.mjs'),
                userDataPart,
                ask.text,
                String(waitSeconds),
            ],
            { encoding: 'utf8' },
        );
    } catch (error) {
        output = String(error.stdout ?? error.message);
    }
    const calls = output.split(/\r?\n/).filter((line) => {
        return (
            line.startsWith('TOOL owa_note_edit') &&
            !line.includes('"action":"read"')
        );
    });
    const answerLine =
        output.split(/\r?\n/).find((line) => {
            return (
                /^[A-Z][^:]{0,4}/.test(line) &&
                !/^(TOOL|ASSISTANT|typed)/.test(line) &&
                !/^\(\d+ s\)$/.test(line)
            );
        }) ?? '';
    const seconds = /\((\d+) s\)/.exec(output)?.[1] ?? '?';
    console.log(`\n#${ask.n} ${ask.text}`);
    console.log(`   ${calls.length} change call(s), ${seconds} s`);
    for (const call of calls) {
        console.log(`   ${call.slice('TOOL owa_note_edit '.length, 400)}`);
    }
    console.log(`   → ${answerLine.slice(0, 200)}`);
    if (calls.length > 0) {
        console.log(`   undo: ${await pressUndo(port)}`);
        await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    rows.push({ n: ask.n, calls: calls.length, seconds });
}
console.log(
    `\n${rows.length} asked; one call: ${rows.filter((row) => row.calls === 1).length}; ` +
        `none: ${rows.filter((row) => row.calls === 0).length}; more: ${rows.filter((row) => row.calls > 1).length}`,
);
