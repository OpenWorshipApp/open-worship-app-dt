#!/usr/bin/env node
// Preaching lessons made through the REAL help window of a SCRATCH
// development profile, one per row of `references/lesson-asks.json`, each
// checked by `lesson-rubric.mjs` and kept whole for a blind reader against
// `references/lesson-rubric.md` (owa-enhance-bible-note-chatbot, BN-66).
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/run-lesson-asks.mjs \
//     <userDataPath part> [--asks=<json>] [--out=<results .jsonl>]
//     [--only=L-01,F-02] [--wait=240] [--pace=40] [--tag=<title suffix>]
//     [--not-english] [--fresh]
//
// For each row: a new note -- empty, or the row's `seed` as a preacher wrote
// it -- then its row's Open in Chatbot in the Reader, the AI caution's exact
// Open pressed (on a SCRATCH profile only, and only when the conversation
// allowed it: CLAUDE.md, Agent access), the window's card read (an empty
// note's offers a lesson), then the row's `ask` typed, or its `press`
// (`reply:N`, the card's Nth button, in whatever language the window is
// shown) and, with `then: "first-option"`, the answer's first option pressed
// while the note is still empty. The note is read back whole, graded, and
// one JSON line written; its window and the chat tab are closed after.
// It refuses the person's own development profile, stops at the spend guard
// (Allow more is the person's press) and paces its asks under it. A run
// resumes past the ids already in `--out` unless `--fresh`.
//
// `--not-english`: the window is shown in another language; the structure
// check counts headings instead of reading their English names.
//
// `--review=N`: how a preacher prepares with it -- each lesson made, then N
// rounds of "is this a good sermon?" with its first fix pressed; the draft
// (`blocksBefore`) is kept beside the lesson it became (`blocks`), so the
// two can be read blind against each other (BN-72). `--fixes=N` presses up
// to N of each review's fixes, the next one off the buttons the answer to
// the last carries (BN-77) -- only fixes the review itself offered.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gradeLesson } from './lesson-rubric.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(SCRIPT_DIR, '..', '..', '..', '..');
const [, , userDataPart, ...rest] = process.argv;
const flag = (name, fallback = null) => {
    const found = rest.find((arg) => arg.startsWith(`--${name}=`));
    return found === undefined ? fallback : found.slice(name.length + 3);
};
if (!userDataPart || userDataPart.startsWith('--')) {
    console.error('Give a piece of the scratch profile path first.');
    process.exit(2);
}
const ASKS_PATH =
    flag('asks') ?? join(SCRIPT_DIR, '..', 'references', 'lesson-asks.json');
const OUT_PATH = flag('out') ?? join(tmpdir(), 'lesson-asks-results.jsonl');
const WAIT_SECONDS = Number(flag('wait', '240'));
const PACE = Number(flag('pace', '40'));
const TAG =
    flag('tag') ?? new Date().toISOString().slice(11, 16).replace(':', '');
const ONLY_SET = flag('only') === null ? null : new Set(flag('only').split(','));
const IS_ENGLISH = !rest.includes('--not-english');
const REVIEW_ROUNDS = Number(flag('review', '0'));
const FIXES_PER_REVIEW = Math.max(1, Number(flag('fixes', '1')));

// --- the instance ------------------------------------------------------------

function checkIsAlive(pid) {
    try {
        process.kill(Number(pid), 0);
        return true;
    } catch (_error) {
        return false;
    }
}

function findInstance() {
    const dir = join(tmpdir(), 'open-worship-app-cdp');
    for (const file of readdirSync(dir)) {
        try {
            const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
            // A killed launch leaves its file behind: the live one only.
            if (
                String(data.userDataPath ?? '').includes(userDataPart) &&
                checkIsAlive(data.pid)
            ) {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- a stdio MCP server pinned to the instance ------------------------------

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
function parseJson(text) {
    try {
        return JSON.parse(text ?? '');
    } catch (_error) {
        return null;
    }
}
await mcpRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'run-lesson-asks', version: '1' },
});
mcp.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
);

/** The whole note, every part of a long one. */
async function readWholeNote(file, id) {
    const blocks = [];
    let name = null;
    let from = 1;
    for (let part = 0; part < 30; part++) {
        const read = await callTool('owa_note_edit', {
            action: 'read',
            file,
            id,
            ...(from > 1 ? { from } : {}),
        });
        const data = parseJson(read.text);
        if (data === null || !Array.isArray(data.blocks)) {
            return { name, blocks, error: read.text.slice(0, 300) };
        }
        name = data.name ?? name;
        blocks.push(...data.blocks);
        if (!data.nextFrom) {
            break;
        }
        from = data.nextFrom;
    }
    return { name, blocks };
}

// --- the help window ---------------------------------------------------------

let socket = null;
let socketId = 0;
const socketWaiting = new Map();
const toolCalls = new Map();

async function connectHelpWindow() {
    socket?.close();
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
                const parsed = parseJson(body);
                if (parsed !== null) {
                    toolCalls.set(message.params.requestId, {
                        name: parsed.params?.name,
                        args: parsed.params?.arguments ?? {},
                        at: Date.now(),
                        isError: null,
                        text: null,
                    });
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
        const message = parseJson(line);
        if (message?.result !== undefined) {
            call.isError = message.result.isError === true;
            call.text = (message.result.content ?? [])
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('\n');
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

/** Whether the window is paused by its spend guard (any language). */
let allowMoreWords = 'Allow more';
async function checkIsPaused() {
    return evaluate(`(() => {
        const words = ${JSON.stringify(allowMoreWords)}.trim().toLowerCase();
        return [...document.querySelectorAll('button')].some((one) => (one.innerText || '').trim().toLowerCase() === words);
    })()`);
}

/** The last answer: its words, its option buttons, its action buttons. */
async function readLastCue() {
    return JSON.parse(
        await evaluate(`(() => {
            const cues = [...document.querySelectorAll('article.cue')];
            const last = cues[cues.length - 1];
            if (!last) return JSON.stringify({ text: '', replies: [], actions: [] });
            const words = (one) => (one.innerText || one.title || '').trim();
            return JSON.stringify({
                text: (last.innerText || '').slice(0, 6000),
                replies: [...last.querySelectorAll('.cue-replies .cue-reply')].map(words),
                actions: [...last.querySelectorAll('button.cue-act')].map(words),
            });
        })()`),
    );
}

/** Waits for the answer to a question asked after `before` cues. */
async function waitForAnswer(before, startedAt) {
    while (Date.now() - startedAt < WAIT_SECONDS * 1000) {
        await sleep(1500);
        const state = JSON.parse(
            await evaluate(`JSON.stringify({
                isBusy: [...document.querySelectorAll('button.chat-send, button')].some((one) => one.classList.contains('chat-stop') || (one.innerText || '').trim().toUpperCase() === 'STOP'),
                count: document.querySelectorAll('article.cue').length,
            })`),
        );
        if (!state.isBusy && state.count >= before + 2) {
            // The last tool answers come a moment after the window draws.
            await sleep(800);
            return true;
        }
    }
    return false;
}

function callsSince(startedAt) {
    return [...toolCalls.values()]
        .filter((call) => call.at >= startedAt)
        .map(({ name, args, isError, text }) => ({ name, args, isError, text }));
}

/** Types one line as a person does and sends it. */
async function ask(text) {
    await waitForPace();
    const before = await evaluate(`document.querySelectorAll('article.cue').length`);
    const startedAt = Date.now();
    await evaluate(`(() => {
        const box = document.querySelector('textarea');
        if (!box) return 'no box';
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(box, ${JSON.stringify(text)});
        box.dispatchEvent(new Event('input', { bubbles: true }));
        return 'typed';
    })()`);
    await sleep(300);
    await evaluate(`(() => {
        const button = document.querySelector('button.chat-send[type=submit]:not(.chat-add)');
        if (!button) return 'no send';
        button.click();
        return 'sent';
    })()`);
    const isDone = await waitForAnswer(before, startedAt);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    return {
        isDone,
        startedAt,
        seconds,
        answerText: (await readLastCue()).text.slice(0, 3000),
    };
}

/** Presses the Nth option button of the last answer (or the card). */
async function pressReply(index) {
    await waitForPace();
    const before = await evaluate(`document.querySelectorAll('article.cue').length`);
    const startedAt = Date.now();
    const pressed = await evaluate(`(() => {
        const cues = [...document.querySelectorAll('article.cue')];
        const last = cues[cues.length - 1];
        const button = last ? last.querySelectorAll('.cue-replies .cue-reply')[${index}] : null;
        if (!button) return null;
        const words = (button.innerText || '').trim();
        button.click();
        return words;
    })()`);
    if (pressed === null) {
        return { isDone: false, startedAt, seconds: 0, pressed: null };
    }
    const isDone = await waitForAnswer(before, startedAt);
    return {
        isDone,
        startedAt,
        pressed,
        seconds: Math.round((Date.now() - startedAt) / 1000),
    };
}

// --- opening a note in the help window ---------------------------------------

let cautionWords = { title: 'Be careful with AI', open: 'Open' };

async function readShownWords() {
    const read = parseJson(
        (
            await callTool('owa_tran', {
                text: [
                    'Be careful with AI',
                    'Open',
                    'Allow more',
                    'Open in Chatbot',
                    'Open BibleNote',
                ],
            })
        ).text,
    );
    const shown = (english) => {
        return (
            read?.labels?.find((one) => one.english === english)?.onScreen ??
            english
        );
    };
    cautionWords = { title: shown('Be careful with AI'), open: shown('Open') };
    allowMoreWords = shown('Allow more');
    // A note row is called `<Open BibleNote>: <title>` in the window's words.
    return { openInChatbot: shown('Open in Chatbot'), openNote: shown('Open BibleNote') };
}

/** The AI caution's exact Open, on this scratch profile only. */
async function pressCaution() {
    return evaluateIn(
        'reader.html',
        `(() => {
        const title = ${JSON.stringify(cautionWords.title)}.trim();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let found = null;
        while (walker.nextNode()) {
            if ((walker.currentNode.nodeValue || '').trim() === title) {
                found = walker.currentNode.parentElement;
                break;
            }
        }
        if (found === null) return 'no caution';
        let box = found;
        while (box && box.querySelectorAll('button').length < 2) box = box.parentElement;
        const open = box ? [...box.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === ${JSON.stringify(cautionWords.open)}.trim()) : [];
        if (open.length !== 1) return 'caution without one Open';
        open[0].click();
        return 'caution opened';
    })()`,
    );
}

/** Waits for the help window's card naming the note; its words and buttons. */
async function waitForCard(title) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 25_000) {
        await sleep(1000);
        try {
            if (socket === null) {
                await connectHelpWindow();
            }
            const cue = await readLastCue();
            if (cue.text.includes(title)) {
                return cue;
            }
        } catch (_error) {
            socket = null;
        }
    }
    return null;
}

/** Note windows closed (each Open in Chatbot opens one). */
async function closeNoteWindows() {
    for (const page of await listPages()) {
        if (page.type === 'page' && page.url.includes('bibleNote.html')) {
            await fetch(`http://127.0.0.1:${PORT}/json/close/${page.id}`);
        }
    }
}

/** Every tab but one closed, by its own close button (the tab cap is 12). */
async function closeTabs() {
    for (let round = 0; round < 15; round++) {
        const left = await evaluate(`(() => {
            const tabs = [...document.querySelectorAll('.chat-tab')];
            if (tabs.length <= 1) return tabs.length;
            const first = tabs[0];
            const close = [...first.querySelectorAll('button, [role=button], span, i')].find((el) => /×|close/i.test((el.getAttribute('aria-label') || '') + (el.title || '') + (el.innerText || '')) && el.children.length === 0);
            if (!close) return 'no close';
            close.click();
            return tabs.length - 1;
        })()`);
        if (left === 1 || typeof left === 'string') {
            return left;
        }
        await sleep(400);
    }
    return 'tabs left';
}

// --- grading -----------------------------------------------------------------

function toPlainWords(text) {
    return (
        String(text ?? '')
            .replace(/\[\^[^\]\n]*\]/g, ' ')
            .replace(/^[#\-*\d.\s]+/, '')
            .toLowerCase()
            .match(/[\p{L}\p{M}\p{N}']{3,}/gu) ?? []
    );
}

/** A finish row: each line the preacher wrote, still there. */
function checkSeedKept(seed, blocks) {
    const noteWords = new Set(
        blocks.flatMap((block) => toPlainWords(block.text)),
    );
    const lost = [];
    for (const line of String(seed ?? '').split('\n')) {
        const words = toPlainWords(line);
        if (words.length === 0) {
            continue;
        }
        const kept = words.filter((word) => noteWords.has(word)).length;
        if (kept / words.length < 0.8) {
            lost.push(line);
        }
    }
    return lost;
}

// --- the run -----------------------------------------------------------------

const corpus = JSON.parse(readFileSync(ASKS_PATH, 'utf8'));
const doneIdSet = new Set();
if (existsSync(OUT_PATH) && !rest.includes('--fresh')) {
    for (const line of readFileSync(OUT_PATH, 'utf8').split(/\r?\n/)) {
        const row = parseJson(line);
        if (row?.id !== undefined && row.verdict !== 'paused') {
            doneIdSet.add(row.id);
        }
    }
}
const items = corpus
    .filter((item) => ONLY_SET === null || ONLY_SET.has(item.id))
    .filter((item) => !doneIdSet.has(item.id));

const shownWords = await readShownWords();
console.log(`${items.length} to ask on port ${PORT} -> ${OUT_PATH}`);

for (const item of items) {
    // No `L-01`: a word shaped like a guide page id is taken out of an
    // answer (`recipeIdHelpers.ts`), the note's own name with it.
    const title = `Lesson ${item.id.replace('-', '')} ${TAG}`;
    const added = parseJson(
        (
            await callTool('owa_bible_note', {
                action: 'add',
                title,
                text: item.seed ?? '',
            })
        ).text,
    );
    if (added?.id === undefined) {
        console.error(`${item.id}: the note could not be made`, added);
        break;
    }
    await sleep(1500);
    const row = await callTool('owa_click', {
        find: `${shownWords.openNote}: ${title}`,
        button: 'right',
    });
    const menu = await callTool('owa_click', { find: shownWords.openInChatbot });
    // The caution can take a few seconds to come up on a busy window.
    let caution = 'no caution';
    for (let tries = 0; tries < 8 && caution === 'no caution'; tries++) {
        await sleep(1000);
        caution = await pressCaution();
    }
    socket = null;
    const card = await waitForCard(title);
    if (card === null) {
        console.error(
            `${item.id}: no card (${row.isError ? 'row' : 'menu'} ${menu.isError ? 'failed' : 'pressed'}; ${caution})`,
        );
        break;
    }
    await connectHelpWindow();
    if (await checkIsPaused()) {
        console.error("Paused by the spend guard (Allow more is the person's press): stopping.");
        break;
    }
    const runs = [];
    if (typeof item.press === 'string') {
        const index = Number(item.press.split(':')[1] ?? 1) - 1;
        runs.push(await pressReply(index));
    } else {
        runs.push(await ask(item.ask));
    }
    let note = await readWholeNote(added.filePath, added.id);
    const isEmptyNote = () => {
        return note.blocks.every((block) => String(block.text ?? '').trim() === '');
    };
    if (item.then === 'first-option' && isEmptyNote()) {
        const options = (await readLastCue()).replies;
        if (options.length > 0) {
            runs.push(await pressReply(0));
            note = await readWholeNote(added.filePath, added.id);
        }
    }
    // `then: "ask:<words>"`: what a person types under the answer when the
    // note is still empty -- the passage, when no button offers one.
    if (String(item.then ?? '').startsWith('ask:') && isEmptyNote()) {
        runs.push(await ask(item.then.slice(4)));
        note = await readWholeNote(added.filePath, added.id);
    }
    // `then: "reply:N"`: the answer's Nth button pressed, whatever the note
    // holds -- a review's first fix, say.
    const replyThen = /^reply:(\d+)$/.exec(String(item.then ?? ''));
    let blocksBefore = null;
    if (replyThen !== null) {
        blocksBefore = note.blocks;
        runs.push(await pressReply(Number(replyThen[1]) - 1));
        note = await readWholeNote(added.filePath, added.id);
    }
    // `--review=N`: how a preacher prepares with the chatbot -- the draft
    // made, then N rounds of "is this a good sermon?" and its first fix
    // pressed. The draft is kept beside the lesson it became.
    const reviewList = [];
    if (REVIEW_ROUNDS > 0 && !isEmptyNote()) {
        blocksBefore = note.blocks;
        for (let round = 0; round < REVIEW_ROUNDS; round++) {
            const review = await ask('is this a good sermon?');
            runs.push(review);
            const fixes = (await readLastCue()).replies;
            if (fixes.length === 0) {
                reviewList.push({ review: review.answerText, pressed: null });
                break;
            }
            const fix = await pressReply(0);
            runs.push(fix);
            // The review's other fixes, pressed off the buttons each fix's
            // answer carries (BN-77).
            const alsoPressed = [];
            for (let count = 1; count < FIXES_PER_REVIEW; count++) {
                const carried = (await readLastCue()).replies;
                const next = carried.find((words) => {
                    return (
                        fixes.includes(words) &&
                        words !== fix.pressed &&
                        !alsoPressed.includes(words)
                    );
                });
                if (next === undefined) {
                    break;
                }
                const nextFix = await pressReply(carried.indexOf(next));
                runs.push(nextFix);
                if (nextFix.pressed === null) {
                    break;
                }
                alsoPressed.push(nextFix.pressed);
            }
            reviewList.push({
                review: review.answerText,
                pressed: fix.pressed,
                alsoPressed,
                offered: fixes,
                seconds: fix.seconds,
            });
        }
        note = await readWholeNote(added.filePath, added.id);
    }
    const answer = await readLastCue();
    const calls = runs.flatMap((run) => callsSince(run.startedAt));
    const uniqueCalls = [...new Map(calls.map((call) => [JSON.stringify(call), call])).values()];
    const grade = gradeLesson(note.blocks, { form: item.form, isEnglish: IS_ENGLISH });
    const lost = item.seed ? checkSeedKept(item.seed, note.blocks) : [];
    const paused = await checkIsPaused();
    const record = {
        id: item.id,
        form: item.form,
        genre: item.genre,
        ask: item.ask ?? null,
        pressed: runs.map((run) => run.pressed).filter(Boolean),
        isEnglish: IS_ENGLISH,
        title,
        noteId: added.id,
        filePath: added.filePath,
        card: { text: card.text.slice(0, 600), replies: card.replies },
        isDone: runs.every((run) => run.isDone),
        seconds: runs.reduce((sum, run) => sum + run.seconds, 0),
        calls: uniqueCalls.map((call) => ({
            name: call.name,
            action: call.args?.action ?? null,
            isError: call.isError,
            args: JSON.stringify(call.args).slice(0, 1500),
            text: String(call.text ?? '').slice(0, 600),
        })),
        answer: answer.text.slice(0, 3000),
        firstAnswer: runs.length > 1 ? (runs[0].answerText ?? null) : null,
        blocksBefore,
        reviews: reviewList,
        replies: answer.replies,
        actions: answer.actions,
        noteName: note.name,
        blocks: note.blocks,
        score: `${grade.score}/${grade.max}`,
        failed: grade.checks.filter((check) => !check.pass).map((check) => check.name),
        words: grade.words,
        lost,
        verdict: paused ? 'paused' : 'made',
    };
    appendFileSync(OUT_PATH, `${JSON.stringify(record)}\n`);
    console.log(
        `${item.id.padEnd(5)} ${record.score.padStart(5)} ${String(record.seconds).padStart(4)}s ${String(grade.words).padStart(5)}w ${record.calls.map((call) => `${call.name}${call.action ? `:${call.action}` : ''}${call.isError ? '!' : ''}`).join(',')} ${record.failed.join('; ')}${lost.length > 0 ? ` LOST ${lost.length}` : ''}`,
    );
    await closeNoteWindows();
    await closeTabs();
    if (paused) {
        console.error("Paused by the spend guard (Allow more is the person's press): stopping.");
        break;
    }
}
socket?.close();
mcp.kill();
process.exit(0);
