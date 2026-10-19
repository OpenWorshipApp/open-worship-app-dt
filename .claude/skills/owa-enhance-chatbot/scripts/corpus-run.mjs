// Ask every question of the supported-question corpus through the REAL help
// window, on the assistant named, and write one JSON line per answer: the
// words, the buttons under them, the rounds, tokens and seconds, and every
// tool the window called. The research phase of this skill starts here.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/corpus-run.mjs \
//        --server="<the Assistant row>" [--model="<the Model row>"] \
//        [--out=<file.jsonl>] [--files=presenter,reader] [--ids=a,b]
//        [--limit=N] [--timeout=480] [--skip=<regex>] [--templates]
//        [--offline] [--pace=135] [--pace-since=<ISO>] [--pace-files=a,b]
//        [--no-page-switch] [--as-focus=reader] [--typed] [--dry]
//        [--profile=<data folder name>]
//
// --asks=<file.json> asks a short list of questions the corpus does not have
// (2026-10-16): each is TYPED, so each joins the window's Alt+Up history.
//
// --lang=km asks every question in the app's OWN language (2026-10-17, the
// user's ask: _test model gemma4:cloud on Khmer all questions_): the words
// are each row's translation in `questions/i18n/<lang>.json`, pressed in the
// More… list as that window draws it, and the app must already be shown in
// that language. The head row's pickers are found by what they HOLD (focus
// keys, Free/Auto, the engine), never by their aria-labels, which are
// translated -- so this is the only way the run works in a non-English
// window at all. --allow-more presses the spend guard's Allow more when it
// trips and asks the paused row again: ONLY with the user's explicit word in
// the conversation, only on a dev app, only for an assistant at $0.
//
// --server=Auto with no --model asks what a window on its default asks
// (2026-10-16): Auto has no model picker, and a record's `model` is who it
// picked. --files / --ids narrow it; --skip leaves out questions matching a pattern;
// --templates asks the fill-in rows (typed, with a sample filled in) instead
// of the rest; --as-focus asks the questions that belong to EVERY window as
// one other window offers them; --no-page-switch refuses a question that
// would take the main window to another page.
//
// Needs the DEV app running with the help window OPEN and VISIBLE (a window
// the OS is not painting throttles its timers; the first press of the 🤖 is
// the person's, for the caution). Resumable: a question already answered in
// --out is skipped, and a run the app's relaunch cut short exits 4 to be
// started again.
//
// The rules it keeps, each written after the run of 2026-10-12 broke it:
//
// - IT OWNS ITS TAB, OR IT STOPS. Every question gets a tab this run opens,
//   closed only after it is shown to be that tab (its place in the strip, the
//   count, this question as its first message). It used to type /clear into
//   "the tab in front"; with two drivers alive that was the user's own
//   conversation, and it was emptied. A lock file keeps it to one driver.
// - IT TYPES NOTHING. Questions are pressed in the window's own "More… —
//   everything it can answer" list, as a person picks one: what is typed in
//   the box goes into the Alt+Up history, and a typed run pushed every
//   question of the user's out of it. Only a template row (and --typed) is
//   typed.
// - IT UNDOES ONLY WHAT ITS OWN QUESTION DID. The dev app is shared: a screen
//   that came on during a question was another session's, and hiding it "to
//   put things back" broke that session's test. What a question left behind
//   is RECORDED; only a walkthrough card its own tool call started is closed.
// - IT STAYS UNDER THE SPEND GUARD. 150 model calls in a rolling hour pause
//   the assistant until a person presses Allow more -- never this script.
//   --pace=135 counts its own rounds and waits; a pause it meets anyway ends
//   the run (exit 9) with the paused rows marked to be asked again.
// - IT IS STOPPED BY ITS STOP FILE, or by process id. Stopping the shell that
//   started it leaves node running on Windows.
// - A ROW THAT ASKS THE ASSISTANT TO ACT MAKES IT ACT. "Can you start a 5
//   minute countdown on the screen?" started one for real, on a screen that
//   was off, and it was still held three hours later. Every record carries
//   `screensBefore` / `screensAfter` when a question changed a screen: read
//   them when the pass ends and take off what your own question put up. Lock
//   the screen (its padlock) before a row that would present over something
//   you could not put back.
// - A RELOAD UNDER A QUESTION IS NOT AN ANSWER. A dev server's hot reload (a
//   save under src/chatbot by anyone) loads the window again, the ask in
//   flight is gone, and the question stands alone in its tab for good. The
//   run used to wait out its whole timeout on it, seven minutes a time; it
//   now reads when the page was loaded, records the row as `reloaded` with
//   no answer, and the next start asks it again.
// - IT FINDS ITS APP BY PROFILE (added 2026-10-13). "The newest dev instance"
//   was another session's scratch app the moment that session started one,
//   and a press landed there. --profile names the data folder; the default is
//   the dev app's own, and with no instance on it the run does not start.
// - A QUESTION IS ASKED AGAIN BY A LINE. Append {"key": "...", "stale": true}
//   to --out and the earlier answer is dropped at the next start; the file is
//   never rewritten under a running pass.
//
// --offline reads the guide's own answers: aim --server at a custom server
// that is NOT running on this computer (a refused connection falls back to
// the guide in a second; an unreachable address on the network takes twenty).
// A "where is" asked that way RINGS the control in the main window.
//
// Exit codes: 0 done · 2 cannot start · 4 the window went away (start again)
// · 6 three answers running with no model · 7 another driver holds the lock
// · 8 the tab in front was not this run's · 9 paused by the spend guard.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
// Everything this run writes besides its answers: the lock, the marker of the
// tab it has open, the window default to put back, and the STOP file that ends
// it after the question in flight. Gitignored with the rest of test-results/.
const WORK_DIR = path.join(REPO, 'test-results', 'chatbot-quality', 'run');
fs.mkdirSync(WORK_DIR, { recursive: true });
const STOP_FILE = path.join(WORK_DIR, 'STOP');
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        return match ? [match[1], match[2] ?? true] : [arg, true];
    }),
);
const OUT =
    args.out ??
    path.join(
        REPO,
        'test-results',
        'chatbot-quality',
        `corpus-${new Date().toISOString().slice(0, 10)}.jsonl`,
    );
const TIMEOUT_MS = Number(args.timeout ?? 480) * 1000;
// The data folder NAME of the app this run drives: the dev app's own unless
// told otherwise. A scratch instance has a folder of its own.
const PROFILE =
    typeof args.profile === 'string' ? args.profile : 'open-worship-app-dev';
// The guide's own answer is what is being read: an assistant that is not
// there is the point, not a failure of the run.
const OFFLINE = args.offline === true;
// The language the questions are asked in; null is the corpus's own English.
const LANG = typeof args.lang === 'string' && args.lang !== 'en' ? args.lang : null;
const MAIN_PAGES = {
    presenter: 'presenter.html',
    reader: 'reader.html',
    appDocumentEditor: 'appDocumentEditor.html',
};
// What a template row's placeholder is filled with: the row cannot be asked as
// it stands, and the window fills the box instead of asking it.
const TEMPLATE_FILL = {
    en: {
        'add-a-slide': 'Welcome to church',
        'write-a-note': 'grace',
        'find-a-control': 'Clear All',
    },
    km: {
        'add-a-slide': 'សូមស្វាគមន៍មកកាន់ព្រះវិហារ',
        'write-a-note': 'ព្រះគុណ',
        'find-a-control': 'លុបទាំងអស់',
    },
    fr: {
        'add-a-slide': 'Bienvenue à l’église',
        'write-a-note': 'la grâce',
        'find-a-control': 'Tout effacer',
    },
};

// ---- plumbing: the dev instance, one CDP socket, the app's own MCP door ---

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findDevInstance() {
    const dir = path.join(os.tmpdir(), 'open-worship-app-cdp');
    const found = [];
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) {
            continue;
        }
        const info = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (info.isDev !== true) {
            continue;
        }
        try {
            const res = await fetch(`${info.url}/json/version`, {
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                found.push(info);
            }
        } catch {
            // A stale file for a dead instance.
        }
    }
    if (found.length === 0) {
        throw new Error('No live DEV app instance found');
    }
    // By PROFILE, never by "newest" and never by process: another session may
    // start a scratch dev app of its own while a run is going (the newest is
    // then somebody else's), and a watcher relaunches the user's app under a
    // new process id. The folder NAME tells the two apart.
    const mine = found.filter((one) => {
        return String(one.userDataPath).split(/[\\/]/).pop() === PROFILE;
    });
    if (mine.length === 0) {
        throw new Error(
            `No running DEV app instance uses the profile ${PROFILE}`,
        );
    }
    mine.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    return mine[0];
}

async function listPages(instance) {
    const res = await fetch(`${instance.url}/json/list`, {
        signal: AbortSignal.timeout(5000),
    });
    const targets = await res.json();
    return targets.filter((target) => {
        return target.type === 'page' && !target.url.startsWith('devtools://');
    });
}

async function findPage(instance, match, timeoutMs = 10000) {
    const startedAt = Date.now();
    for (;;) {
        const pages = await listPages(instance);
        const found = pages.find((page) => page.url.includes(match));
        if (found !== undefined) {
            return found;
        }
        if (Date.now() - startedAt > timeoutMs) {
            return null;
        }
        await sleep(500);
    }
}

// One socket held open for the life of the run: Network events for the
// page's own tool calls arrive on it between evaluations.
class CdpSession {
    constructor(target) {
        this.target = target;
        this.nextId = 0;
        this.pending = new Map();
        this.listeners = new Set();
        this.socket = null;
    }
    async open() {
        await new Promise((resolve, reject) => {
            const socket = new WebSocket(this.target.webSocketDebuggerUrl);
            this.socket = socket;
            socket.addEventListener('open', () => resolve());
            socket.addEventListener('error', () => {
                reject(new Error(`Could not attach to ${this.target.url}`));
            });
            socket.addEventListener('close', () => {
                for (const [, entry] of this.pending) {
                    entry.reject(new Error('socket closed'));
                }
                this.pending.clear();
            });
            socket.addEventListener('message', (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (message.id !== undefined) {
                    const entry = this.pending.get(message.id);
                    if (entry === undefined) {
                        return;
                    }
                    this.pending.delete(message.id);
                    clearTimeout(entry.timeoutId);
                    if (message.error) {
                        entry.reject(new Error(message.error.message));
                    } else {
                        entry.resolve(message.result);
                    }
                    return;
                }
                for (const listener of this.listeners) {
                    listener(message);
                }
            });
        });
        return this;
    }
    send(method, params = {}, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const id = ++this.nextId;
            const timeoutId = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP ${method} timed out`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timeoutId });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }
    async evaluate(expression, timeoutMs = 30000) {
        const result = await this.send(
            'Runtime.evaluate',
            {
                expression,
                returnByValue: true,
                awaitPromise: true,
                allowUnsafeEvalBlockedByCSP: true,
            },
            timeoutMs,
        );
        if (result.exceptionDetails) {
            throw new Error(
                result.exceptionDetails.exception?.description ??
                    result.exceptionDetails.text,
            );
        }
        return result.result?.value;
    }
    on(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    close() {
        try {
            this.socket?.close();
        } catch {
            // Already closing.
        }
    }
}

// The app's own MCP door, as an outside caller: the same tools the window uses.
class McpClient {
    constructor(instance) {
        this.url = instance.mcpUrl;
        this.token = instance.mcpToken;
        this.sessionId = null;
        this.requestId = 0;
    }
    async post(body) {
        const headers = {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${this.token}`,
        };
        if (this.sessionId !== null) {
            headers['mcp-session-id'] = this.sessionId;
        }
        const response = await fetch(this.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60000),
        });
        const newSessionId = response.headers.get('mcp-session-id');
        if (newSessionId) {
            this.sessionId = newSessionId;
        }
        if (response.status === 404) {
            this.sessionId = null;
            return { expired: true };
        }
        if (!response.ok || response.status === 202) {
            return null;
        }
        const type = response.headers.get('content-type') ?? '';
        if (type.includes('text/event-stream')) {
            const text = await response.text();
            const line = text
                .split(/\r?\n/)
                .reverse()
                .find((one) => one.startsWith('data:'));
            return line ? (JSON.parse(line.slice(5))?.result ?? null) : null;
        }
        const data = await response.json();
        return data?.result ?? null;
    }
    async init() {
        await this.post({
            jsonrpc: '2.0',
            id: ++this.requestId,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'owa-corpus-run', version: '0.1.0' },
            },
        });
        await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    }
    async call(name, args = {}) {
        for (let attempt = 0; attempt < 2; attempt++) {
            if (this.sessionId === null) {
                await this.init();
            }
            const result = await this.post({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'tools/call',
                params: { name, arguments: args },
            });
            if (result?.expired) {
                continue;
            }
            const text = (result?.content ?? [])
                .filter((item) => item?.type === 'text')
                .map((item) => item.text)
                .join('\n');
            try {
                return JSON.parse(text);
            } catch {
                return text.length > 0 ? { text } : null;
            }
        }
        return null;
    }
}

function log(...parts) {
    console.log(new Date().toISOString().slice(11, 19), ...parts);
}

function toPlainText(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// ---- the corpus -------------------------------------------------------------

function loadCorpus() {
    const dir = path.join(REPO, 'tools/owa-devtools-mcp/questions');
    // `<page>.<section>.<id>` → { en, text }: what the More… list shows in
    // that language.
    const translated =
        LANG === null
            ? null
            : JSON.parse(
                  fs.readFileSync(path.join(dir, 'i18n', `${LANG}.json`), 'utf8'),
              ).questions;
    const rows = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.json') || name === 'schema.json') {
            continue;
        }
        const file = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        const fileFocus = Array.isArray(file.focus)
            ? file.focus[0]
            : (file.focus ?? 'presenter');
        for (const section of file.sections) {
            for (const question of section.questions) {
                const local =
                    translated?.[`${file.page}.${section.id}.${question.id}`] ??
                    null;
                rows.push({
                    key: `${file.page}/${section.id}/${question.id}`,
                    file: name.replace(/\.json$/, ''),
                    fileFocus: file.focus ?? null,
                    focus: fileFocus,
                    section: section.id,
                    sectionLabel: section.label,
                    id: question.id,
                    en: question.text,
                    isUntranslated: translated !== null && local === null,
                    text:
                        question.template === true
                            ? (local?.text ?? question.text).replace(
                                  '...',
                                  TEMPLATE_FILL[LANG ?? 'en']?.[question.id] ?? '...',
                              )
                            : (local?.text ?? question.text),
                    kind: question.kind,
                    isTemplate: question.template === true,
                    resources: question.resources ?? {},
                });
            }
        }
    }
    return rows;
}

function readDone() {
    const done = new Map();
    if (!fs.existsSync(OUT)) {
        return done;
    }
    for (const line of fs.readFileSync(OUT, 'utf8').split(/\r?\n/)) {
        if (line.trim().length === 0) {
            continue;
        }
        try {
            const row = JSON.parse(line);
            // A line that only says a question's answer is STALE (its page,
            // its row or the window's code changed since): asked again.
            // Appended rather than the file being rewritten, because a
            // running pass appends to it too.
            if (row.key && row.stale === true) {
                done.delete(row.key);
                continue;
            }
            if (row.key && row.answer && !row.noModel && !row.error) {
                done.set(row.key, row);
            }
        } catch {
            // A line cut short by a kill.
        }
    }
    return done;
}

// ---- page expressions -------------------------------------------------------

// The head row's pickers by what they HOLD, never by their aria-labels, which
// are translated: the focus picker's options are the windows' keys, the
// assistant picker's include Free and Auto, the model picker is the engine.
const FIND_PICKER_SOURCE = `const findPicker = (role) => {
    const selects = [...document.querySelectorAll('.chat-head-row select')];
    const valuesOf = (one) => [...one.options].map((option) => option.value);
    if (role === 'model') {
        return document.querySelector('.chat-head-row select.chat-engine');
    }
    if (role === 'focus') {
        return selects.find((one) => {
            const values = valuesOf(one);
            return values.includes('presenter') && values.includes('reader') && values.includes('lwShare');
        }) ?? null;
    }
    return selects.find((one) => {
        const values = valuesOf(one);
        return values.includes('free') || values.includes('::auto::');
    }) ?? null;
};`;

const STATE_EXPRESSION = `(() => {
    ${FIND_PICKER_SOURCE}
    const readPick = (role, isValue = false) => {
        const picker = findPicker(role);
        if (picker === null) {
            return null;
        }
        const on = [...picker.options].find((o) => o.value === picker.value);
        return on ? (isValue ? on.value : on.textContent.trim()) : null;
    };
    const cues = [...document.querySelectorAll('.chat-cues article.cue')].map(
        (cue) => {
            // innerText of the ATTACHED nodes: a detached clone has no
            // layout, so its innerText is textContent and every line break
            // the answer draws is lost.
            const body = cue.querySelector('.cue-body');
            const text = [...body.children]
                .filter((child) => {
                    return !child.matches(
                        '.cue-note, .cue-actions, .cue-replies, .cue-tools, .chat-clips',
                    );
                })
                .map((child) => child.innerText)
                .join(String.fromCharCode(10))
                .trim();
            const cost = cue.querySelector('.cue-cost');
            return {
                author: cue.classList.contains('cue-you') ? 'you' : 'bot',
                text,
                note: cue.querySelector('.cue-note')?.innerText.trim() ?? null,
                // The names the answer puts in bold are the controls it
                // tells the person to press.
                bold: [...new Set(
                    [...body.querySelectorAll(':scope > p strong, :scope > ol strong, :scope > ul strong, :scope > div:not(.cue-actions):not(.cue-replies):not(.cue-tools) strong')]
                        .map((node) => node.textContent.trim())
                        .filter((name) => name.length > 0),
                )],
                code: [...new Set(
                    [...body.querySelectorAll('code')].map((node) => node.textContent.trim()),
                )],
                actions: [...cue.querySelectorAll('.cue-actions .cue-act')].map(
                    (b) => b.textContent.trim(),
                ),
                replies: [...cue.querySelectorAll('.cue-replies .cue-reply')].map(
                    (b) => b.textContent.trim(),
                ),
                chips: [...cue.querySelectorAll('.chat-clips *[class*="chat-clip-name"]')].map(
                    (b) => b.innerText.trim(),
                ),
                cost: cost ? cost.innerText.trim() : null,
                costFull: cost ? cost.getAttribute('title') : null,
                hasPreview: cue.querySelector('.chat-lyric-preview, pre') !== null,
            };
        },
    );
    return {
        focus: readPick('focus'),
        focusKey: readPick('focus', true),
        provider: readPick('provider'),
        // The VALUES are what puts a default back: the words are translated.
        providerKey: readPick('provider', true),
        modelKey: readPick('model', true),
        // Auto has no model picker: AUTO PICK says who answered last.
        model:
            readPick('model') ??
            document.querySelector('.chat-auto-pick')?.innerText.trim() ??
            null,
        isBusy:
            document.querySelector('.chat-stop') !== null ||
            document.querySelector('.chat-progress') !== null,
        progress: [...document.querySelectorAll('.chat-progress .chat-status')].map(
            (p) => p.innerText.trim(),
        ),
        alert: document.querySelector('.chat-alert')?.innerText ?? null,
        tabCount: document.querySelectorAll('.chat-tab').length,
        activeTab: [...document.querySelectorAll('.chat-tab')].findIndex((t) =>
            t.classList.contains('is-on'),
        ),
        visibility: document.visibilityState,
        // When this page was loaded: a reload under a question takes the
        // ask with it and leaves the question standing with no answer.
        loadedAt: performance.timeOrigin,
        isHeadFolded:
            document.querySelector('.chat-head-fold[aria-expanded="false"]') !==
            null,
        cues,
    };
})()`;

// An option by its words, or -- for the focus, whose words are translated --
// by its value.
function genPickExpression(role, wanted, isByValue) {
    return `(() => {
        ${FIND_PICKER_SOURCE}
        const picker = findPicker(${JSON.stringify(role)});
        if (picker === null) {
            return { ok: false, reason: 'no picker' };
        }
        const wanted = ${JSON.stringify(wanted)};
        const option = [...picker.options].find((one) => {
            return ${isByValue ? 'one.value' : 'one.textContent.trim()'} === wanted;
        });
        if (option === undefined) {
            return {
                ok: false,
                reason: 'no option',
                options: [...picker.options].map((o) => o.textContent.trim()),
            };
        }
        if (option.disabled || option.hasAttribute('data-needs-key')) {
            return { ok: false, reason: 'not pickable' };
        }
        if (picker.value === option.value) {
            return { ok: true, already: true };
        }
        const setValue = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            'value',
        ).set;
        setValue.call(picker, option.value);
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
    })()`;
}

function genAskExpression(question) {
    return `(() => {
        const input = document.querySelector('textarea.chat-input');
        const form = document.querySelector('form.chat-ask');
        if (input === null || form === null) {
            return { ok: false, reason: 'no form' };
        }
        const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(input), 'value',
        )?.set;
        setter.call(input, ${JSON.stringify(question)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        form.requestSubmit();
        return { ok: true };
    })()`;
}

const CLICK = (selector) => `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (node === null) {
        return { ok: false };
    }
    if (node.disabled) {
        return { ok: false, reason: 'disabled' };
    }
    node.click();
    return { ok: true };
})()`;

// ---- the run ----------------------------------------------------------------

const LOCK_FILE = path.join(WORK_DIR, 'driver.lock');
function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}
if (fs.existsSync(LOCK_FILE)) {
    const other = Number(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (other && other !== process.pid && isAlive(other)) {
        console.log('FATAL: another driver is running, pid', other);
        process.exit(7);
    }
}
fs.writeFileSync(LOCK_FILE, String(process.pid));
process.on('exit', () => {
    try {
        if (Number(fs.readFileSync(LOCK_FILE, 'utf8')) === process.pid) {
            fs.unlinkSync(LOCK_FILE);
        }
    } catch {
        // Already gone.
    }
});
const instance = await findDevInstance();
const mcp = new McpClient(instance);
const chatbotPage = await findPage(instance, 'chatbot.html');
if (chatbotPage === null) {
    console.log('FATAL: the chatbot window is not open');
    process.exit(2);
}
const cdp = await new CdpSession(chatbotPage).open();
let isLeaving = false;
cdp.socket.addEventListener('close', () => {
    if (!isLeaving) {
        // The app was relaunched or the window closed: resumable.
        log('STOPPING: the chatbot window went away');
        process.exit(4);
    }
});
await cdp.send('Network.enable', { maxPostDataSize: 65536 });

// Every tool the WINDOW calls for the question in flight, off its own wire.
let toolCalls = [];
const requestMap = new Map();
cdp.on((message) => {
    if (message.method === 'Network.requestWillBeSent') {
        const { requestId, request } = message.params;
        if (request.method !== 'POST' || !request.url.includes('/mcp')) {
            return;
        }
        let body = null;
        try {
            body = JSON.parse(request.postData ?? 'null');
        } catch {
            return;
        }
        if (body?.method !== 'tools/call') {
            return;
        }
        const call = {
            name: body.params?.name,
            args: body.params?.arguments ?? {},
            at: Date.now(),
        };
        toolCalls.push(call);
        requestMap.set(requestId, call);
        return;
    }
    if (message.method === 'Network.loadingFinished') {
        const call = requestMap.get(message.params.requestId);
        if (call === undefined) {
            return;
        }
        requestMap.delete(message.params.requestId);
        call.ms = Date.now() - call.at;
        cdp.send('Network.getResponseBody', {
            requestId: message.params.requestId,
        })
            .then((result) => {
                const body = result?.body ?? '';
                call.resultChars = body.length;
                let text = body;
                try {
                    const line = body
                        .split(/\r?\n/)
                        .reverse()
                        .find((one) => one.startsWith('data:'));
                    const parsed = JSON.parse(line ? line.slice(5) : body);
                    call.isError = parsed?.result?.isError === true;
                    text = (parsed?.result?.content ?? [])
                        .map((item) => item?.text ?? '')
                        .join('\n');
                    call.resultChars = text.length;
                } catch {
                    // Keep the raw body's length.
                }
                call.result = text.slice(0, 400);
            })
            .catch(() => {});
    }
});

async function getState() {
    return await cdp.evaluate(STATE_EXPRESSION);
}

async function waitFor(check, timeoutMs, stepMs = 300) {
    const startedAt = Date.now();
    for (;;) {
        const state = await getState();
        if (check(state)) {
            return state;
        }
        if (Date.now() - startedAt > timeoutMs) {
            return null;
        }
        await sleep(stepMs);
    }
}

async function pick(role, wanted, isByValue = false) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const result = await cdp.evaluate(
            genPickExpression(role, wanted, isByValue),
        );
        if (!result.ok) {
            return result;
        }
        await sleep(350);
        const readBack = await cdp.evaluate(`(() => {
            ${FIND_PICKER_SOURCE}
            const picker = findPicker(${JSON.stringify(role)});
            const on = picker && [...picker.options].find(
                (o) => o.value === picker.value,
            );
            return on ? ${isByValue ? 'on.value' : 'on.textContent.trim()'} : null;
        })()`);
        if (readBack === wanted) {
            return { ok: true };
        }
    }
    return { ok: false, reason: 'did not stick' };
}

async function ask(text) {
    return await cdp.evaluate(genAskExpression(text));
}

// Press the question in the window's own "More… — everything it can answer"
// list, the way a person picks one: nothing is typed, so nothing is added to
// the Alt+Up history, and the list itself is tested row by row.
function genPickFromListExpression(question) {
    return `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const more = document.querySelector('.chat-more');
        if (more === null) {
            return { ok: false, reason: 'no More button' };
        }
        if (more.getAttribute('aria-expanded') !== 'true') {
            more.click();
        }
        let buttons = [];
        for (let turn = 0; turn < 50; turn++) {
            buttons = [...document.querySelectorAll('.chat-all .chat-starter')];
            if (buttons.length > 0) {
                break;
            }
            await wait(120);
        }
        if (buttons.length === 0) {
            return { ok: false, reason: 'the list did not load' };
        }
        const wanted = ${JSON.stringify(question)};
        const button = buttons.find((one) => {
            return one.textContent.trim() === wanted;
        });
        if (button === undefined) {
            return { ok: false, reason: 'not in the list', listed: buttons.length };
        }
        button.click();
        return { ok: true, listed: buttons.length };
    })()`;
}

function parseUsage(costFull) {
    const match =
        /^([\d,]+) model rounds?: ([\d,]+) tokens? in[^;]*?(?:, ([\d,]+) read from the cache)?(?:, [\d,]+ written to it)?; ([\d,]+) tokens? out/.exec(
            costFull ?? '',
        );
    if (match === null) {
        return LANG === null ? null : parseUsageAnyLanguage(costFull);
    }
    const toNumber = (value) => Number((value ?? '0').replace(/,/g, ''));
    return {
        rounds: toNumber(match[1]),
        input: toNumber(match[2]),
        cacheRead: toNumber(match[3]),
        output: toNumber(match[4]),
    };
}

// The same line in any language (`genTokenParts` in usageHelpers.ts):
// `<rounds>: <input>[, <read>][, <written>]; <output>.`, its counts in
// en-US digits whatever the language.
function parseUsageAnyLanguage(costFull) {
    const line = String(costFull ?? '')
        .split(/\r?\n/)
        .find((one) => /^[^:;]*\d[^:;]*: [^;]+; [^;]*\d/.test(one.trim()));
    if (line === undefined) {
        return null;
    }
    const toNumber = (text) => {
        const found = /\d[\d,]*/.exec(text ?? '');
        return found === null ? 0 : Number(found[0].replace(/,/g, ''));
    };
    const [head, rest] = line.trim().split(/: (.*)/s);
    const [inputText, outputText] = rest.split('; ');
    const inputParts = inputText.split(', ');
    const readPart = inputParts.slice(1).find((part) => {
        return /read from the cache|អានពីឃ្លាំង|lus? depuis le cache/i.test(part);
    });
    return {
        rounds: toNumber(head),
        input: toNumber(inputParts[0]),
        cacheRead: toNumber(readPart),
        output: toNumber(outputText),
    };
}

function summariseScreens(screens) {
    return (screens?.screens ?? []).map((screen) => ({
        id: screen.screenId,
        isShowing: screen.isShowing,
        background: screen.background?.name ?? null,
        slide: screen.slide === null ? null : JSON.stringify(screen.slide).slice(0, 80),
        bible: screen.bible?.reference ?? null,
        foreground: (screen.foreground ?? []).length,
    }));
}

// -- the questions -------------------------------------------------------------

const corpus = loadCorpus();
const CORPUS_TEXTS = new Set(corpus.map((row) => toPlainText(row.text)));
if (LANG !== null) {
    const missing = corpus.filter((row) => row.isUntranslated && !row.isTemplate);
    if (missing.length > 0) {
        log(`${missing.length} rows have no ${LANG} words; asked in English:`, missing.map((row) => row.key).join(', '));
    }
}
let rows = corpus.filter((row) => {
    return args.templates ? row.isTemplate : !row.isTemplate;
});
if (typeof args.files === 'string') {
    const files = args.files.split(',');
    rows = rows.filter((row) => files.includes(row.file));
}
if (typeof args.ids === 'string') {
    const ids = args.ids.split(',');
    rows = rows.filter((row) => ids.includes(row.id) || ids.includes(row.key));
}
// Questions the corpus does NOT have -- a paraphrase, a question about what
// the Bible says -- from a JSON list of {id, text, focus, kind}, INSTEAD of
// the corpus. None is in the list, so each is typed and goes into the
// window's Alt+Up history: keep it to the handful that proves the point.
if (typeof args.asks === 'string') {
    const asks = JSON.parse(fs.readFileSync(path.resolve(args.asks), 'utf8'));
    rows = asks.map((one, index) => {
        const id = String(one.id ?? index + 1);
        return {
            key: `asks/${one.focus ?? 'presenter'}/${id}`,
            file: 'asks',
            fileFocus: one.focus ?? 'presenter',
            focus: one.focus ?? 'presenter',
            section: 'asks',
            sectionLabel: 'Typed',
            id,
            text: one.text,
            kind: one.kind ?? 'howto',
            isTemplate: false,
            isTyped: true,
            resources: one.resources ?? {},
        };
    });
}
// One focus after another: a change of focus is a new system prompt, which a
// local server has to read again from the top.
const FOCUS_ORDER = [
    'presenter',
    'reader',
    'appDocumentEditor',
    'setting',
    'lyricEditor',
    'bibleNote',
    'webEditor',
    'lwShare',
];
rows.sort((a, b) => {
    return FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus);
});
// The questions that belong to EVERY window, asked as one other window offers
// them: the list is the same, the page behind the window is not.
if (typeof args['as-focus'] === 'string') {
    rows = rows
        .filter((row) => row.fileFocus === null)
        .map((row) => ({
            ...row,
            focus: args['as-focus'],
            key: `${row.key}@${args['as-focus']}`,
        }));
}
// Questions left for later: the guide alone answers a "where is" by RINGING
// the control in the main window, which is not a read.
if (typeof args.skip === 'string') {
    const skip = new RegExp(args.skip, 'i');
    rows = rows.filter((row) => !skip.test(row.text));
}
const done = readDone();
rows = rows.filter((row) => !done.has(row.key));
if (args.limit) {
    rows = rows.slice(0, Number(args.limit));
}
log(`corpus ${corpus.length}, already answered ${done.size}, to ask ${rows.length}`);
if (args.dry) {
    for (const row of rows) {
        console.log(row.focus.padEnd(18), row.key, '|', row.text);
    }
    process.exit(0);
}

// -- tabs: this run only ever touches a tab it opened itself --------------------
//
// It used to empty "the tab in front" with /clear and close "the last tab".
// With two drivers alive at once the tab in front was the user's own, and
// its conversation was cleared. Now every question gets a tab this run
// opens, and that tab is closed only after it is shown to be that tab: the
// same place in the strip, the same count, and this question as its first
// message. Anything else stops the run without a press.

const MARKER_FILE = path.join(WORK_DIR, 'scratch-open.json');
const toPlain = toPlainText;
let scratch = null;

function stopForIdentity(why) {
    log('STOPPING (tab identity):', why);
    isLeaving = true;
    cdp.close();
    process.exit(8);
}

async function openScratchTab() {
    const before = await getState();
    if (before.isHeadFolded) {
        await cdp.evaluate(CLICK('.chat-head-fold'));
        await sleep(500);
    }
    if (before.tabCount >= 12) {
        console.log('FATAL: twelve tabs already; this run opens none');
        isLeaving = true;
        cdp.close();
        process.exit(2);
    }
    const added = await cdp.evaluate(CLICK('.chat-tab-add'));
    if (!added.ok) {
        stopForIdentity('New chat could not be pressed');
    }
    const after = await waitFor((one) => {
        return (
            one.tabCount === before.tabCount + 1 &&
            one.activeTab === one.tabCount - 1 &&
            one.cues.length === 0 &&
            !one.isBusy
        );
    }, 6000, 150);
    if (after === null) {
        stopForIdentity('the new tab did not come to the front, empty');
    }
    scratch = { index: after.activeTab, tabCount: after.tabCount };
    fs.writeFileSync(MARKER_FILE, JSON.stringify({ ...scratch, question: null }));
    return after;
}

function checkIsScratch(state, firstQuestion) {
    if (
        scratch === null ||
        state.tabCount !== scratch.tabCount ||
        state.activeTab !== scratch.index
    ) {
        return false;
    }
    if (firstQuestion === null) {
        return state.cues.length === 0;
    }
    const first = state.cues.find((cue) => cue.author === 'you');
    return first !== undefined && toPlain(first.text) === toPlain(firstQuestion);
}

async function closeScratchTab(firstQuestion) {
    let state = await getState();
    if (!checkIsScratch(state, firstQuestion)) {
        stopForIdentity('the tab in front is not the one this run opened');
    }
    if (state.isBusy) {
        await cdp.evaluate(CLICK('.chat-stop'));
        await sleep(2000);
        state = await getState();
        if (!checkIsScratch(state, firstQuestion)) {
            stopForIdentity('the tab changed while stopping');
        }
    }
    const wantedCount = scratch.tabCount - 1;
    await cdp.evaluate(CLICK('.chat-tab.is-on .chat-tab-close'));
    const closed = await waitFor((one) => one.tabCount === wantedCount, 6000, 150);
    if (closed === null) {
        stopForIdentity('the tab did not close');
    }
    scratch = null;
    fs.rmSync(MARKER_FILE, { force: true });
}

// A tab a cut-short run left behind: closed only when it is where the marker
// says and holds one of this corpus's own questions (or nothing, at the END
// of the strip and never the only tab).
async function closeLeftover() {
    if (!fs.existsSync(MARKER_FILE)) {
        return;
    }
    const marker = JSON.parse(fs.readFileSync(MARKER_FILE, 'utf8'));
    fs.rmSync(MARKER_FILE, { force: true });
    let state = await getState();
    if (state.tabCount !== marker.tabCount || marker.index !== state.tabCount - 1 || state.tabCount < 2) {
        log('a leftover tab was noted but the strip has changed; left alone');
        return;
    }
    await cdp.evaluate(`(() => {
        const tab = document.querySelectorAll('.chat-tab')[${marker.index}];
        const name = tab && tab.querySelector('.chat-tab-name');
        if (name) { name.click(); return true; }
        return false;
    })()`);
    await sleep(700);
    state = await getState();
    const first = state.cues.find((cue) => cue.author === 'you');
    const isOurs =
        state.activeTab === marker.index &&
        (first === undefined
            ? state.cues.length === 0
            : CORPUS_TEXTS.has(toPlain(first.text)));
    if (!isOurs) {
        log('the leftover tab does not hold a corpus question; left alone');
        return;
    }
    scratch = { index: marker.index, tabCount: marker.tabCount };
    await closeScratchTab(first === undefined ? null : first.text);
    log('closed the tab a cut-short run left');
}

async function ensureAssistant(server, model) {
    let state = await getState();
    if (state.provider !== server) {
        const picked = await pick('provider', server);
        if (!picked.ok) {
            return picked;
        }
        await sleep(400);
        state = await getState();
    }
    // --server=Auto names no model: Auto chooses one at every question.
    if (typeof model === 'string' && state.model !== model) {
        const picked = await pick('model', model);
        if (!picked.ok) {
            return picked;
        }
    }
    return { ok: true };
}

await closeLeftover();
// What a NEW tab starts on is the window default this run must put back.
const DEFAULTS_FILE = path.join(WORK_DIR, 'window-defaults.json');
let state = await openScratchTab();
let defaults = {
    provider: state.provider,
    model: state.model,
    providerKey: state.providerKey,
    modelKey: state.modelKey,
};
if (fs.existsSync(DEFAULTS_FILE)) {
    defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
} else {
    fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(defaults));
}
log('window default to put back:', JSON.stringify(defaults));

async function restoreAndLeave(exitCode) {
    try {
        if (scratch === null) {
            await openScratchTab();
        }
        const now = await getState();
        if (checkIsScratch(now, null) && defaults.providerKey) {
            // By value, which reads the same in every language; a model is
            // only put back where the default had a model picker (not Auto).
            const picked = await pick('provider', defaults.providerKey, true);
            await sleep(400);
            const modelPicked = defaults.modelKey
                ? await pick('model', defaults.modelKey, true)
                : { ok: true };
            await sleep(300);
            await closeScratchTab(null);
            if (picked.ok && modelPicked.ok) {
                // Put back: the next run reads the window as it then is.
                fs.rmSync(DEFAULTS_FILE, { force: true });
            } else {
                log('the window default could not be put back:', JSON.stringify(defaults));
            }
        } else if (checkIsScratch(now, null) && defaults.provider !== null) {
            await ensureAssistant(defaults.provider, defaults.model);
            await sleep(300);
            await closeScratchTab(null);
        }
        const after = await getState();
        log('left the window with', after.tabCount, 'tab(s)');
    } catch (error) {
        log('restore failed:', error.message);
    }
    isLeaving = true;
    cdp.close();
    process.exit(exitCode);
}

// The window's own spend guard pauses the assistant at 150 model calls in a
// rolling hour, and only a person may lift that. This run stays under it by
// itself: before each question it counts the rounds its own answers took in
// the last hour (since the person's last press) and waits when a question
// would cross the line.
const PACE = Number(args.pace ?? 0);
const PACE_SINCE = typeof args['pace-since'] === 'string' ? Date.parse(args['pace-since']) : 0;
const PACE_FILES = [OUT, ...(typeof args['pace-files'] === 'string' ? args['pace-files'].split(',') : [])];
function countRecentRounds() {
    const from = Math.max(Date.now() - 3600 * 1000, PACE_SINCE);
    let rounds = 0;
    for (const file of PACE_FILES) {
        if (!fs.existsSync(file)) {
            continue;
        }
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            if (line.trim().length === 0) {
                continue;
            }
            try {
                const row = JSON.parse(line);
                if (Date.parse(row.at) >= from) {
                    // A row with no usage still asked once.
                    rounds += row.usage?.rounds ?? (row.pass === 'model' ? 1 : 0);
                }
            } catch {
                // cut short
            }
        }
    }
    return rounds;
}
async function waitForPace() {
    if (PACE <= 0) {
        return;
    }
    let said = false;
    // Room for a question that takes its whole ten rounds.
    while (countRecentRounds() + 10 > PACE) {
        if (!said) {
            log(`pacing: ${countRecentRounds()} model rounds in the last hour, waiting for room under ${PACE}`);
            said = true;
        }
        if (fs.existsSync(STOP_FILE)) {
            return;
        }
        await sleep(30000);
    }
}

const firstPick = await ensureAssistant(args.server, args.model);
if (!firstPick.ok) {
    console.log('FATAL: assistant', args.server, args.model, JSON.stringify(firstPick));
    await restoreAndLeave(2);
}
state = await getState();
log('asking on', state.provider, '/', state.model);
await closeScratchTab(null);

const appState = await mcp.call('owa_app_state', {});
const startPage = appState?.mainWindow?.page ?? 'presenter.html';
let mainPage = startPage;
let screensBefore = summariseScreens(await mcp.call('owa_list_screens', {}));
log('main window on', startPage, 'screens', JSON.stringify(screensBefore));
const NO_PAGE_SWITCH = args['no-page-switch'] === true;

let unreachable = 0;
let isPaused = false;
let asked = 0;
for (const row of rows) {
    if (fs.existsSync(STOP_FILE)) {
        log('STOP file present; leaving');
        break;
    }
    if (!OFFLINE) {
        await waitForPace();
        if (fs.existsSync(STOP_FILE)) {
            log('STOP file present; leaving');
            break;
        }
    }
    asked += 1;
    const record = {
        key: row.key,
        file: row.file,
        section: row.section,
        id: row.id,
        kind: row.kind,
        q: row.text,
        en: LANG === null ? undefined : row.en,
        lang: LANG ?? undefined,
        focus: row.focus,
        fileFocus: row.fileFocus,
        resources: row.resources,
        isTemplate: row.isTemplate,
    };
    let askedInTab = false;
    try {
        const wantedPage = MAIN_PAGES[row.focus] ?? 'presenter.html';
        if (wantedPage !== mainPage && NO_PAGE_SWITCH) {
            throw new Error(`needs ${wantedPage}; page switches are off`);
        }
        await openScratchTab();
        const assistant = await ensureAssistant(args.server, args.model);
        if (!assistant.ok) {
            throw new Error(`assistant: ${assistant.reason}`);
        }
        const focusPick = await pick('focus', row.focus, true);
        if (!focusPick.ok) {
            throw new Error(`focus ${row.focus}: ${focusPick.reason}`);
        }
        // A main-window page is where its questions are asked from: the
        // assistant reads the window, and "go to the Reader first" on every
        // Reader answer would be a fact about this driver.
        if (wantedPage !== mainPage) {
            const went = await mcp.call('owa_goto_page', { page: wantedPage });
            await sleep(2500);
            const check = await mcp.call('owa_app_state', {});
            mainPage = check?.mainWindow?.page ?? mainPage;
            log('main window ->', mainPage, went?.text ?? '');
        }
        record.mainPage = mainPage;
        if (!checkIsScratch(await getState(), null)) {
            stopForIdentity('the tab in front changed before the question');
        }
        toolCalls = [];
        const startedAt = Date.now();
        let sent = { ok: false, reason: 'template' };
        if (!row.isTemplate && !row.isTyped && args.typed !== true) {
            sent = await cdp.evaluate(genPickFromListExpression(row.text), 20000);
        }
        record.askedBy = sent.ok ? 'list' : 'typed';
        if (!sent.ok) {
            record.listMiss = sent.reason;
            record.listed = sent.listed;
            const typed = await ask(row.text);
            if (!typed.ok) {
                throw new Error(`ask: ${typed.reason}`);
            }
        } else {
            record.listed = sent.listed;
        }
        askedInTab = true;
        fs.writeFileSync(MARKER_FILE, JSON.stringify({ ...scratch, question: row.text }));
        // The question's own cue, then an answer under it and the box idle.
        const asked = await waitFor((one) => one.cues.length >= 1, 8000, 150);
        const loadedAt = asked?.loadedAt ?? null;
        let isReloaded = false;
        let final = await waitFor(
            (one) => {
                // The page was loaded again under the question: the ask is
                // gone, and waiting out the timeout answers nothing.
                if (loadedAt !== null && one.loadedAt !== loadedAt) {
                    isReloaded = true;
                    return true;
                }
                return (
                    !one.isBusy &&
                    one.cues.length >= 2 &&
                    one.cues[one.cues.length - 1].author === 'bot'
                );
            },
            TIMEOUT_MS,
            700,
        );
        record.seconds = Math.round((Date.now() - startedAt) / 100) / 10;
        if (isReloaded) {
            // Not an answer of this pass: asked again on the next start.
            record.reloaded = true;
            await sleep(2500);
            final = await getState();
        }
        if (final === null) {
            record.timedOut = true;
            const stuck = await getState();
            record.progressAtStop = stuck.progress;
            if (checkIsScratch(stuck, row.text)) {
                await cdp.evaluate(CLICK('.chat-stop'));
                await sleep(2500);
            }
            final = await getState();
        }
        // The tool results' bodies land a beat after the answer.
        await sleep(400);
        const bots = final.cues.filter((cue) => cue.author === 'bot');
        const last = bots[bots.length - 1] ?? null;
        record.model = final.model;
        record.provider = final.provider;
        record.focusShown = final.focus;
        record.answer = last?.text ?? '';
        record.note = last?.note ?? null;
        record.actions = last?.actions ?? [];
        record.replies = last?.replies ?? [];
        record.chips = last?.chips ?? [];
        record.bold = last?.bold ?? [];
        record.code = last?.code ?? [];
        record.botCues = bots.length;
        record.cost = last?.cost ?? null;
        record.usage = parseUsage(last?.costFull);
        record.tools = toolCalls.map((call) => ({
            name: call.name,
            args: call.args,
            ms: call.ms,
            chars: call.resultChars,
            isError: call.isError === true ? true : undefined,
            result: call.result,
        }));
        record.visibility = final.visibility;
        record.alert = final.alert;
        // What the question left behind in the app. Read, and undone only
        // where this question's own tool call did it: the app is shared.
        const ownNames = toolCalls.map((call) => call.name);
        const guide = await mcp.call('owa_guide_status', { page: mainPage });
        if (guide?.isRunning === true) {
            record.guideStarted = { title: guide.title, steps: guide.stepCount };
            if (ownNames.includes('owa_guide_start')) {
                await mcp.call('owa_guide_step', { action: 'stop', page: mainPage });
                await sleep(800);
            } else {
                record.guideNotOurs = true;
            }
        }
        const screensAfter = summariseScreens(
            await mcp.call('owa_list_screens', {}),
        );
        if (JSON.stringify(screensAfter) !== JSON.stringify(screensBefore)) {
            record.screensBefore = screensBefore;
            record.screensAfter = screensAfter;
            record.ownActingCalls = ownNames.filter((name) => {
                return /click|type|present_bible|foreground|goto_page|guide_start/.test(name);
            });
            // Recorded, never undone: this driver does not hide a screen.
            // But an extra this question's OWN call put up comes off again
            // (2026-10-17: once the hint said to start it, _Can you start a
            // 5 minute countdown?_ left a countdown on both screens, off
            // and waiting for whoever switches one on).
            const startedWidgets = toolCalls
                .filter((call) => {
                    return (
                        call.name === 'owa_foreground' &&
                        (call.args?.action ?? 'start') === 'start' &&
                        typeof call.args?.widget === 'string'
                    );
                })
                .map((call) => call.args.widget);
            for (const widget of [...new Set(startedWidgets)]) {
                await mcp.call('owa_foreground', { action: 'stop', widget });
            }
            if (startedWidgets.length > 0) {
                record.undoneForeground = [...new Set(startedWidgets)];
                screensBefore = summariseScreens(
                    await mcp.call('owa_list_screens', {}),
                );
            } else {
                screensBefore = screensAfter;
            }
        }
        const pageNow = await mcp.call('owa_app_state', {});
        if (pageNow?.mainWindow?.page && pageNow.mainWindow.page !== mainPage) {
            record.pageMovedTo = pageNow.mainWindow.page;
            mainPage = pageNow.mainWindow.page;
        }
        record.windows = (pageNow?.windows ?? []).length;
        if ((await getState()).visibility !== 'visible') {
            record.windowHiddenAfter = true;
        }
    } catch (error) {
        record.error = error.message;
    }
    // The tab goes, whatever happened in it -- but only as this run's own.
    if (scratch !== null) {
        await closeScratchTab(askedInTab ? row.text : null);
    }
    // No model behind the answer: the server's own failure sentence, or the
    // guide standing in. Asked again on a resume.
    record.pass = OFFLINE ? 'offline' : 'model';
    if (
        !OFFLINE &&
        !record.error &&
        (record.usage === null || record.usage === undefined) &&
        /server is running|on and awake|could not be reached|took longer than|nothing answered|Request timed out|too slow|needs an assistant|មិនអាចភ្ជាប់|ម៉ាស៊ីនមេប្រើពេលលើស|ត្រូវការជំនួយការ/i.test(
            `${record.note ?? ''} ${record.answer ?? ''}`,
        )
    ) {
        record.noModel = true;
    }
    // In any language: no model round and a note under the answer is the
    // guide standing in for an assistant that failed (2026-10-17: LM Studio
    // could not load a model, said in Khmer, and the row was kept as answered).
    if (
        !OFFLINE &&
        !record.error &&
        (record.usage === null || record.usage === undefined) &&
        typeof record.note === 'string' &&
        record.note.trim().length > 0
    ) {
        record.noModel = true;
    }
    // The spend guard's pause: the guide answered, not the model, and only a
    // person's press lifts it. Not an answer of this pass; the run stops.
    if (
        !OFFLINE &&
        /I have paused the assistant|ខ្ញុំបានផ្អាកជំនួយការ/.test(
            `${record.note ?? ''} ${record.answer ?? ''}`,
        )
    ) {
        record.noModel = true;
        record.paused = true;
    }
    record.at = new Date().toISOString();
    fs.appendFileSync(OUT, JSON.stringify(record) + '\n');
    const usage = record.usage;
    log(
        `[${asked}/${rows.length}]`,
        record.key,
        '|',
        record.error
            ? `ERROR ${record.error}`
            : `${record.seconds}s r${usage?.rounds ?? '?'} ` +
              `${usage ? usage.input + usage.cacheRead : '?'}tok ` +
              `${record.askedBy} ` +
              `tools=${(record.tools ?? []).map((t) => t.name.replace('owa_', '')).join('>')} ` +
              `${record.timedOut ? 'TIMEOUT ' : ''}${record.reloaded ? 'RELOADED ' : ''}` +
              `| ${(record.answer ?? '').replace(/\s+/g, ' ').slice(0, 90)}`,
    );
    if (record.paused && args['allow-more'] === true) {
        // The user's own word in the conversation (see the header): the
        // guard's button in the window's head, and the paused row again.
        const pressed = await cdp.evaluate(`(() => {
            const button = [...(document.querySelector('.chat-head')?.querySelectorAll('button') ?? [])]
                .find((one) => /អនុញ្ញាតបន្ថែម|Allow more|Autoriser davantage/.test(one.textContent));
            if (!button) return false;
            button.click();
            return true;
        })()`);
        log(`ALLOW MORE pressed by the driver (user-authorized): ${pressed}`);
        if (pressed) {
            await sleep(3000);
            rows.push(row);
            continue;
        }
    }
    if (record.paused) {
        log('STOPPING: the spend guard paused the assistant; a person must press Allow more');
        isPaused = true;
        break;
    }
    // A server that has gone away answers every question the same way: stop
    // rather than write four hundred copies of it.
    if (record.error || record.noModel) {
        unreachable += 1;
        if (unreachable >= 3) {
            log('STOPPING: three answers in a row with no model behind them');
            break;
        }
    } else {
        unreachable = 0;
    }
}

const stoppedEarly = unreachable >= 3;
if (mainPage !== startPage && !NO_PAGE_SWITCH) {
    await mcp.call('owa_goto_page', { page: startPage });
    await sleep(1500);
}
log('done; asked', asked);
await restoreAndLeave(isPaused ? 9 : stoppedEarly ? 6 : 0);
