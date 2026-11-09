#!/usr/bin/env node
// The elderly-user corpus (`references/elder-asks.json`, ~600 things a
// non-technical church member types while preparing a lesson) asked one by
// one through the REAL help window of a SCRATCH development profile, each
// graded by machine and the note put back after it (owa-enhance-bible-note-
// chatbot §2, BN-52).
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/run-elder-asks.mjs \
//     <userDataPath part> --file=<the test note's .own, whole path> --id=<note id> \
//     [--asks=<corpus json>] [--out=<results .jsonl>] [--only=2-1,3-4]
//     [--category=3,11] [--every=N] [--limit=N] [--wait=150] [--fresh]
//
// The help window must already be open on that note (its caution's Open is
// the person's press unless the conversation allowed it -- CLAUDE.md). It
// refuses the person's own development profile, as `ask-note-chat.mjs` does.
// One JSON line per ask goes to `--out`; a run resumes past the ids already
// there unless `--fresh`.
//
// Grading (by `expect.do`): a CHANGE is an `owa_note_edit` edit that
// changed the note and has a change matching one of `expect.any` (and, with
// `expect.blocks`, touches no other block) -- one call is the bar, more is
// `pass-multi`; an ANSWER changes nothing and is no failure sentence
// (`expect.mention` words in it, `expect.tool` called); NEW-NOTE is an
// `owa_bible_note` add; UNDO leaves the note as it was before the earlier
// change; EITHER is a matching change or an honest answer. Any ask whose
// answer claims a change no tool made is `false-claim`, whatever it expected.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(SCRIPT_DIR, '..', '..', '..', '..');
const [, , userDataPart, ...rest] = process.argv;
const flag = (name, fallback = null) => {
    const found = rest.find((arg) => arg.startsWith(`--${name}=`));
    return found === undefined ? fallback : found.slice(name.length + 3);
};
if (!userDataPart || flag('file') === null || flag('id') === null) {
    console.error(
        'Give a piece of the scratch profile path, --file=<note .own> and --id=<note id>.',
    );
    process.exit(2);
}
const NOTE_FILE = flag('file');
const NOTE_ID = Number(flag('id'));
const ASKS_PATH =
    flag('asks') ?? join(SCRIPT_DIR, '..', 'references', 'elder-asks.json');
const OUT_PATH = flag('out') ?? join(tmpdir(), 'elder-asks-results.jsonl');
const WAIT_SECONDS = Number(flag('wait', '150'));
const ONLY_SET = flag('only') === null ? null : new Set(flag('only').split(','));
const CATEGORY_SET =
    flag('category') === null
        ? null
        : new Set(flag('category').split(',').map(Number));
const EVERY = Number(flag('every', '1'));
// With --every=3, --offset=0, 1 and 2 split the corpus over three profiles.
const OFFSET = Number(flag('offset', '0'));
const LIMIT = Number(flag('limit', '100000'));
// Asks an hour at most, an earlier question asked first counted too: the
// window's spend guard pauses a profile at 150 model calls an hour, and its
// Allow more is the person's press, never a script's.
const PACE = Number(flag('pace', '55'));

// --- the instance ------------------------------------------------------------

function findInstance() {
    const dir = join(tmpdir(), 'open-worship-app-cdp');
    for (const file of readdirSync(dir)) {
        try {
            const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
            if (String(data.userDataPath ?? '').includes(userDataPart)) {
                return data;
            }
        } catch (_error) {
            // not one
        }
    }
    return null;
}
const instance = findInstance();
if (instance === null || instance.isDev !== true) {
    console.error('No development instance matches', userDataPart);
    process.exit(1);
}
if (/open-worship-app-dev[\\/]?$/i.test(String(instance.userDataPath))) {
    console.error("That is the person's own development profile: use a scratch one.");
    process.exit(1);
}
const PORT = instance.port;

async function listPages() {
    return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}

// --- a stdio MCP server pinned to the instance, for reading the note ---------

const mcp = spawn(
    process.execPath,
    [join(REPO_DIR, 'tools', 'owa-devtools-mcp', 'bin.mjs')],
    {
        cwd: REPO_DIR,
        env: { ...process.env, OWA_CDP_PORT: String(PORT) },
        stdio: ['pipe', 'pipe', 'pipe'],
    },
);
mcp.stderr.on('data', () => {});
let mcpBuffer = '';
const mcpWaiting = new Map();
mcp.stdout.on('data', (chunk) => {
    mcpBuffer += chunk;
    let index;
    while ((index = mcpBuffer.indexOf('\n')) >= 0) {
        const line = mcpBuffer.slice(0, index);
        mcpBuffer = mcpBuffer.slice(index + 1);
        if (line.trim() === '') {
            continue;
        }
        const message = JSON.parse(line);
        mcpWaiting.get(message.id)?.(message);
        mcpWaiting.delete(message.id);
    }
});
let mcpId = 0;
function mcpRequest(method, params) {
    const id = ++mcpId;
    mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolve) => mcpWaiting.set(id, resolve));
}
async function callTool(name, args) {
    const answer = await mcpRequest('tools/call', { name, arguments: args });
    const text = (answer.result?.content ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
    return { isError: answer.result?.isError === true, text };
}
await mcpRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'run-elder-asks', version: '1' },
});
mcp.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
);

async function readNote() {
    const read = await callTool('owa_note_edit', {
        action: 'read',
        file: NOTE_FILE,
        id: NOTE_ID,
    });
    try {
        return JSON.parse(read.text);
    } catch (_error) {
        return { hash: null, error: read.text };
    }
}

// --- the help window ---------------------------------------------------------

let socket = null;
let socketId = 0;
const socketWaiting = new Map();
const toolCalls = new Map();

async function connectHelpWindow() {
    const page = (await listPages()).find((one) => {
        return one.type === 'page' && one.url.includes('chatbot.html');
    });
    if (!page) {
        throw new Error('no help window');
    }
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve));
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== undefined && socketWaiting.has(message.id)) {
            socketWaiting.get(message.id)(message);
            socketWaiting.delete(message.id);
            return;
        }
        if (message.method === 'Network.requestWillBeSent') {
            const body = message.params?.request?.postData;
            if (typeof body === 'string' && body.includes('tools/call')) {
                try {
                    const parsed = JSON.parse(body);
                    toolCalls.set(message.params.requestId, {
                        name: parsed.params?.name,
                        args: parsed.params?.arguments ?? {},
                        at: Date.now(),
                        isError: null,
                        text: null,
                    });
                } catch (_error) {
                    // not one call
                }
            }
        }
        if (message.method === 'Network.loadingFinished') {
            const call = toolCalls.get(message.params.requestId);
            if (call !== undefined) {
                send('Network.getResponseBody', {
                    requestId: message.params.requestId,
                }).then((answer) => {
                    readToolAnswer(call, answer.result?.body ?? '');
                });
            }
        }
    });
    await send('Network.enable', {});
}

/** A tool's answer off its HTTP response: plain JSON or server-sent events. */
function readToolAnswer(call, body) {
    const lines = body.includes('data:')
        ? body
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5))
        : [body];
    for (const line of lines) {
        try {
            const message = JSON.parse(line);
            if (message.result !== undefined) {
                call.isError = message.result.isError === true;
                call.text = (message.result.content ?? [])
                    .filter((part) => part.type === 'text')
                    .map((part) => part.text)
                    .join('\n');
            }
        } catch (_error) {
            // a line that is no message
        }
    }
}

function send(method, params) {
    const id = ++socketId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => socketWaiting.set(id, resolve));
}

async function evaluate(expression) {
    const answer = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    return answer.result?.result?.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const askTimeList = [];

/** Waits while the last hour already holds `PACE` asks. */
async function waitForPace() {
    for (;;) {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        while (askTimeList.length > 0 && askTimeList[0] < hourAgo) {
            askTimeList.shift();
        }
        if (askTimeList.length < PACE) {
            askTimeList.push(Date.now());
            return;
        }
        await sleep(askTimeList[0] - hourAgo + 1000);
    }
}

/**
 * Whether the tab in front is still a conversation about the note: its
 * head says Bible Note (the picker, or the folded line) and a chip or a
 * kept question names the note. A tab that lost it asks the Reader.
 */
async function checkIsNoteTab() {
    return evaluate(`(() => {
        const picker = document.querySelector('select[aria-label="Which part of the app"]');
        const focus = picker ? (picker.selectedOptions[0]?.innerText || picker.value || '') : (document.querySelector('.chat-head')?.innerText || '');
        return /bible ?note/i.test(focus);
    })()`);
}

/** Whether the window is paused by its spend guard. */
async function checkIsPaused() {
    return evaluate(`(() => {
        return [...document.querySelectorAll('button')].some((one) => /^allow more$/i.test((one.innerText || '').trim()));
    })()`);
}

/** Asks one line as a person types it; the answer, its buttons and calls. */
async function ask(text) {
    await waitForPace();
    const before = await evaluate(`document.querySelectorAll('article.cue').length`);
    const startedAt = Date.now();
    const typed = await evaluate(`(() => {
        const box = document.querySelector('textarea');
        if (!box) return 'no box';
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(box, ${JSON.stringify(text)});
        box.dispatchEvent(new Event('input', { bubbles: true }));
        return 'typed';
    })()`);
    await sleep(300);
    const sent = await evaluate(`(() => {
        const button = document.querySelector('button.chat-send[type=submit]:not(.chat-add)');
        if (!button) return 'no send';
        button.click();
        return 'sent';
    })()`);
    let isDone = false;
    while (Date.now() - startedAt < WAIT_SECONDS * 1000) {
        await sleep(1500);
        const state = JSON.parse(
            await evaluate(`JSON.stringify({
                isBusy: [...document.querySelectorAll('button')].some((one) => (one.innerText || '').trim().toUpperCase() === 'STOP'),
                count: document.querySelectorAll('article.cue').length,
            })`),
        );
        if (!state.isBusy && state.count >= before + 2) {
            isDone = true;
            break;
        }
    }
    // The last tool answers come a moment after the window draws its answer.
    await sleep(800);
    const answer = JSON.parse(
        await evaluate(`(() => {
            const cues = [...document.querySelectorAll('article.cue')];
            const last = cues[cues.length - 1];
            if (!last) return JSON.stringify({ text: '', buttons: [], actions: 0 });
            const buttons = [...last.querySelectorAll('button')].map((one) => (one.innerText || one.title || '').trim()).filter(Boolean);
            return JSON.stringify({
                text: (last.innerText || '').slice(0, 4000),
                buttons,
                actions: last.querySelectorAll('button.cue-act').length,
            });
        })()`),
    );
    const calls = [...toolCalls.values()]
        .filter((call) => call.at >= startedAt)
        .map(({ name, args, isError, text: resultText }) => {
            return { name, args, isError, text: resultText };
        });
    return {
        typed,
        sent,
        isDone,
        seconds: Math.round((Date.now() - startedAt) / 1000),
        answer,
        calls,
    };
}

/** Presses the last answer's Undo this change, when it has exactly one. */
async function pressUndo() {
    return evaluate(`(() => {
        const cues = [...document.querySelectorAll('article.cue')];
        const last = cues[cues.length - 1];
        const actions = last ? [...last.querySelectorAll('button.cue-act')] : [];
        const button = actions.find((one) => /undo/i.test(one.innerText || ''));
        if (!button) return 'nothing to undo';
        button.click();
        return 'undone';
    })()`);
}

// --- putting the note back ---------------------------------------------------

let baseline = null;

/**
 * The note's title back as it was: a new title is kept at once and is no
 * part of the content's hash, so a rename asked for would otherwise stay
 * for every ask after it.
 */
async function restoreTitle(note) {
    if (note.name === baseline.name) {
        return '';
    }
    await callTool('owa_note_edit', {
        action: 'edit',
        file: NOTE_FILE,
        id: NOTE_ID,
        hash: note.hash,
        title: baseline.name,
        changes: [],
    });
    return ' + title';
}

async function restoreNote() {
    let note = await readNote();
    if (note.hash === baseline.hash) {
        return `kept${await restoreTitle(note)}`;
    }
    await pressUndo();
    await sleep(2500);
    note = await readNote();
    if (note.hash === baseline.hash) {
        return `undo button${await restoreTitle(note)}`;
    }
    for (const action of ['undo', 'undo', 'undo', 'redo', 'redo', 'redo', 'redo']) {
        await callTool('owa_note_edit', {
            action,
            file: NOTE_FILE,
            id: NOTE_ID,
        });
        await sleep(600);
        note = await readNote();
        if (note.hash === baseline.hash) {
            return `history ${action}${await restoreTitle(note)}`;
        }
    }
    return 'DRIFTED';
}

/** The test note attached to the tab again, after an ask moved it away. */
async function reattachNote() {
    const opened = await callTool('owa_click', {
        find: `Open BibleNote: ${baseline.name}`,
        button: 'right',
    });
    if (opened.isError) {
        return `row: ${opened.text.slice(0, 120)}`;
    }
    const pressed = await callTool('owa_click', { find: 'Open in Chatbot' });
    await sleep(1500);
    // The AI caution, when asked again: its exact Open, on this scratch
    // profile only (the conversation allowed it).
    const caution = await evaluateIn('reader.html', `(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let title = null;
        while (walker.nextNode()) {
            if (/^\\s*Be careful with AI\\s*$/i.test(walker.currentNode.nodeValue || '')) {
                title = walker.currentNode.parentElement;
                break;
            }
        }
        if (title === null) return 'no caution';
        let box = title;
        while (box && box.querySelectorAll('button').length < 2) box = box.parentElement;
        const open = box ? [...box.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === 'Open') : [];
        if (open.length !== 1) return 'caution without one Open';
        open[0].click();
        return 'caution opened';
    })()`);
    await sleep(3000);
    return `${pressed.isError ? 'menu failed' : 'menu'}; ${caution}`;
}

async function evaluateIn(pagePart, expression) {
    const page = (await listPages()).find((one) => {
        return one.type === 'page' && one.url.includes(pagePart);
    });
    if (!page) {
        return `no ${pagePart}`;
    }
    const other = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => other.addEventListener('open', resolve));
    const value = await new Promise((resolve) => {
        other.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id === 1) {
                resolve(message.result?.result?.value);
            }
        });
        other.send(
            JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: { expression, returnByValue: true },
            }),
        );
    });
    other.close();
    return value;
}

/** Note windows other than the test note's, closed (a new note opens one). */
async function closeOtherNoteWindows() {
    let count = 0;
    for (const page of await listPages()) {
        if (
            page.type === 'page' &&
            page.url.includes('bibleNote.html') &&
            !page.url.includes(`&id=${NOTE_ID}&`)
        ) {
            await fetch(`http://127.0.0.1:${PORT}/json/close/${page.id}`);
            count++;
        }
    }
    return count;
}

// --- grading -----------------------------------------------------------------

const FAILURE_PATTERN =
    /could not answer|stopped before saying|something went wrong|could not (?:find an answer|be reached|reach)|is not available right now|needs an assistant|ran out of (?:room|time)/i;
// "I put" alone is also an offer ("where should I put it?"): only "I've put".
const CLAIM_PATTERN =
    /\b(?:I(?:'ve| have)|I just) (?:made|changed|added|put|moved|removed|deleted|translated|updated|fixed|drew|drawn|centred|centered|underlined|coloured|colored|bolded|enlarged|inserted|replaced|corrected|ticked|wrote|written|created|rewrote|rewritten)\b|\bI (?:made|changed|added|moved|removed|deleted|translated|updated|fixed|drew|centred|centered|underlined|coloured|colored|bolded|enlarged|inserted|replaced|corrected|ticked|wrote|created|rewrote)\b/i;

function parseJson(text) {
    try {
        return JSON.parse(text ?? '');
    } catch (_error) {
        return null;
    }
}

function checkMatches(predicate, change, args) {
    const isAdd = change.block === undefined && change.after !== undefined;
    for (const [key, value] of Object.entries(predicate)) {
        switch (key) {
            case 'add':
                if (isAdd !== value) return false;
                break;
            case 'kind':
                if (value === 'section') {
                    if (!isAdd) return false;
                } else if (change.kind !== value) {
                    return false;
                }
                break;
            case 'verse':
                if (
                    change.kind !== 'passage' &&
                    !/\[\^/.test(String(change.text ?? ''))
                ) {
                    return false;
                }
                break;
            case 'text':
                if (typeof change.text !== 'string' || isAdd) return false;
                break;
            case 'remove':
                if (change.remove !== true) return false;
                break;
            case 'move':
                if (
                    change.block === undefined ||
                    change.after === undefined ||
                    change.remove === true
                ) {
                    return false;
                }
                break;
            case 'size':
                if (
                    change.size !== value &&
                    !(
                        typeof change.size === 'number' &&
                        (value === 'larger' ? change.size > 16 : change.size < 15)
                    )
                ) {
                    return false;
                }
                break;
            case 'styles':
                if (
                    !(change.styles ?? []).includes(value) &&
                    !(value === 'bold' && /\*\*/.test(String(change.text ?? '')))
                ) {
                    return false;
                }
                break;
            case 'color':
            case 'background':
            case 'font':
            case 'clear':
                if (change[key] === undefined) return false;
                break;
            case 'align':
                if (change.align !== value) return false;
                break;
            case 'indent':
                if (
                    change.indent !== value &&
                    !(value === 'more' && Number(change.indent) > 0)
                ) {
                    return false;
                }
                break;
            case 'checked':
                if (change.checked !== true) return false;
                break;
            case 'title':
                if (args.title === undefined) return false;
                break;
            case 'action':
                return false;
            default:
                break;
        }
    }
    return true;
}

function grade(item, run, noteBefore, noteAfter) {
    const expect = item.expect ?? { do: 'either' };
    const calls = run.calls;
    const edits = calls.filter((call) => {
        return call.name === 'owa_note_edit' && call.args.action === 'edit';
    });
    const goodEdits = edits.filter((call) => {
        return call.isError === false && parseJson(call.text)?.isChanged === true;
    });
    const refusedEdits = edits.filter((call) => call.isError === true);
    const historySteps = calls.filter((call) => {
        return (
            call.name === 'owa_note_edit' &&
            (call.args.action === 'undo' || call.args.action === 'redo') &&
            call.isError === false
        );
    });
    const newNotes = calls.filter((call) => {
        return (
            call.name === 'owa_bible_note' &&
            call.args.action === 'add' &&
            call.isError === false
        );
    });
    const changes = goodEdits.flatMap((call) => {
        return (call.args.changes ?? []).map((change) => ({ change, args: call.args }));
    });
    const titleChanged = goodEdits.some((call) => call.args.title !== undefined);
    const isChanged = noteBefore.hash !== noteAfter.hash || titleChanged;
    const text = String(run.answer.text ?? '');
    const isFailure = FAILURE_PATTERN.test(text) || !run.isDone;
    const usedTools = new Set(calls.map((call) => call.name));
    const result = (verdict, reason) => ({ verdict, reason });
    const matchAny = () => {
        const list = expect.any ?? [];
        if (list.length === 0) {
            return changes.length > 0 || titleChanged;
        }
        return list.some((predicate) => {
            if (predicate.title === true && titleChanged) {
                return true;
            }
            return changes.some(({ change, args }) => checkMatches(predicate, change, args));
        });
    };
    const outsideBlocks = () => {
        if (!Array.isArray(expect.blocks)) {
            return [];
        }
        return changes
            .map(({ change }) => change.block)
            .filter((block) => block !== undefined && !expect.blocks.includes(block));
    };
    if (!isChanged && newNotes.length === 0 && historySteps.length === 0 && CLAIM_PATTERN.test(text) && !/\?\s*$/.test(text.split('\n')[0])) {
        // A claim of a change nothing made -- unless the answer only offers.
        if (!/\b(?:would you like|shall I|do you want|I can)\b/i.test(text.slice(0, 200))) {
            return result('fail', 'false-claim');
        }
    }
    if (isFailure && !isChanged && newNotes.length === 0) {
        return result('fail', run.isDone ? 'failure-answer' : 'timeout');
    }
    const multi = goodEdits.length > 1 || refusedEdits.length > 0;
    switch (expect.do) {
        case 'change': {
            if (goodEdits.length === 0) {
                return result('fail', newNotes.length > 0 ? 'new-note-instead' : refusedEdits.length > 0 ? 'refused' : 'no-change');
            }
            if (!matchAny()) {
                return result('fail', 'wrong-change');
            }
            const outside = outsideBlocks();
            if (outside.length > 0) {
                return result('fail', `outside-blocks ${outside.join(',')}`);
            }
            return result(multi ? 'pass-multi' : 'pass', '');
        }
        case 'answer': {
            if (isChanged || goodEdits.length > 0) {
                return result('fail', 'changed-unasked');
            }
            if (newNotes.length > 0) {
                return result('fail', 'new-note-unasked');
            }
            if (Array.isArray(expect.mention) && expect.mention.length > 0) {
                const lower = text.toLowerCase();
                if (!expect.mention.some((word) => lower.includes(String(word).toLowerCase()))) {
                    return result('fail', `missing-mention ${expect.mention.join('|')}`);
                }
            }
            if (expect.tool && !usedTools.has(expect.tool)) {
                return result('fail', `no-${expect.tool}`);
            }
            return result('pass', '');
        }
        case 'new-note':
            return newNotes.length > 0
                ? result('pass', '')
                : result('fail', goodEdits.length > 0 ? 'added-to-this-note' : 'no-new-note');
        case 'undo':
            return noteAfter.hash === run.hashBeforeAfter
                ? result('pass', '')
                : result('fail', historySteps.length > 0 ? 'undo-wrong-step' : 'not-undone');
        default: {
            if (goodEdits.length > 0) {
                if (!matchAny()) {
                    return result('fail', 'wrong-change');
                }
                return result(multi ? 'pass-multi' : 'pass', 'changed');
            }
            if (newNotes.length > 0) {
                return result('pass', 'new-note');
            }
            if (isChanged) {
                return result('pass', 'history');
            }
            return result('pass', 'answered');
        }
    }
}

// --- the run -----------------------------------------------------------------

const corpus = JSON.parse(readFileSync(ASKS_PATH, 'utf8'));
const doneIdSet = new Set();
if (existsSync(OUT_PATH) && !rest.includes('--fresh')) {
    for (const line of readFileSync(OUT_PATH, 'utf8').split(/\r?\n/)) {
        const row = parseJson(line);
        if (
            row?.id !== undefined &&
            row.verdict !== 'not-note-ask' &&
            row.verdict !== 'paused'
        ) {
            doneIdSet.add(row.id);
        }
    }
}
const items = corpus
    .filter((item) => ONLY_SET === null || ONLY_SET.has(item.id))
    .filter((item) => CATEGORY_SET === null || CATEGORY_SET.has(item.category))
    .filter((_item, index) => index % EVERY === OFFSET % EVERY)
    .filter((item) => !doneIdSet.has(item.id))
    .slice(0, LIMIT);

await connectHelpWindow();
baseline = await readNote();
if (baseline.hash === null || baseline.hash === undefined) {
    console.error('The test note could not be read:', baseline.error);
    process.exit(1);
}
console.log(`baseline "${baseline.name}" ${baseline.hash}; ${items.length} to ask -> ${OUT_PATH}`);

for (const item of items) {
    if (await checkIsPaused()) {
        console.error(
            'The window is paused by its spend guard (Allow more is the person\'s press): stopping.',
        );
        break;
    }
    if (!(await checkIsNoteTab())) {
        console.log(`(the tab lost the note: ${await reattachNote()})`);
        socket?.close();
        await connectHelpWindow();
    }
    let preface = null;
    let hashBeforeAfter = baseline.hash;
    if (typeof item.after === 'string' && item.after.trim() !== '') {
        preface = await ask(item.after);
        hashBeforeAfter = baseline.hash;
    }
    const noteBefore = await readNote();
    const run = await ask(item.text);
    run.hashBeforeAfter = hashBeforeAfter;
    const noteAfter = await readNote();
    // A note ask reads the note into the question before the model is
    // asked; the window's own shortcuts change it with no model. An ask
    // with neither was not about the note at all -- the run's fault, to be
    // asked again, not the chatbot's.
    const isNoteAsk =
        run.calls.some((call) => call.name === 'owa_note_edit') ||
        /^\s*(?:ASSISTANT\s+)?Done in one change/i.test(run.answer.text);
    const graded = isNoteAsk
        ? grade(item, run, noteBefore, noteAfter)
        : { verdict: 'not-note-ask', reason: 'the tab was not about the note' };
    if (/paused|Allow more/i.test(run.answer.text) && (await checkIsPaused())) {
        graded.verdict = 'paused';
        graded.reason = 'spend guard';
    }
    const { verdict, reason } = graded;
    const newNoteMade =
        run.calls.some((call) => call.name === 'owa_bible_note' && call.args.action === 'add' && call.isError === false) ||
        (preface?.calls ?? []).some((call) => call.name === 'owa_bible_note' && call.args.action === 'add' && call.isError === false);
    let restored = await restoreNote();
    let reattached = null;
    if (newNoteMade) {
        await closeOtherNoteWindows();
        reattached = await reattachNote();
    }
    const row = {
        id: item.id,
        category: item.category,
        text: item.text,
        after: item.after ?? null,
        expect: item.expect,
        verdict,
        reason,
        seconds: run.seconds,
        calls: run.calls.map((call) => ({
            name: call.name,
            args: call.args,
            isError: call.isError,
            text: String(call.text ?? '').slice(0, 600),
        })),
        prefaceCalls: preface === null ? null : preface.calls.map((call) => ({ name: call.name, action: call.args.action, isError: call.isError })),
        answer: run.answer.text.slice(0, 1500),
        buttons: run.answer.buttons,
        restored,
        reattached,
    };
    appendFileSync(OUT_PATH, `${JSON.stringify(row)}\n`);
    console.log(
        `${item.id.padEnd(6)} ${verdict.padEnd(10)} ${String(reason).padEnd(22)} ${String(run.seconds).padStart(3)}s ${restored}${reattached ? ` / ${reattached}` : ''} | ${item.text.slice(0, 60)}`,
    );
    if (restored === 'DRIFTED') {
        console.error('The note could not be put back: stopping.');
        break;
    }
    if (verdict === 'paused') {
        console.error(
            "The window is paused by its spend guard (Allow more is the person's press): stopping.",
        );
        break;
    }
}
socket?.close();
mcp.kill();
process.exit(0);
