// Several tabs asking at once, wave after wave (2026-10-17, the user's ask:
// _do a stress test on gemma4:cloud_). The help window lets every tab work on
// its own (chatbot-window.md, _Each TAB works on its own_): this asks K
// supported questions in K tabs of its own at the same moment, then reads
// each tab until it has answered, and checks what one question at a time
// never can -- that every tab got an answer, by a model, to ITS question
// (no answer landed in another tab), and how the waiting grows with K.
//
//   node stress-tabs.mjs --server="Ollam super-mac" --model="gemma4:cloud" \
//        [--lang=km] [--tabs=4] [--waves=5] [--timeout=420] [--out=<file>]
//        [--allow-more]
//
// The questions are the corpus's Presenter rows that need nothing on screen
// (no `tools`, no `state`), spread over the list, pressed in each tab's own
// More… list -- nothing typed, so nothing joins the Alt+Up history. The tabs
// are this run's own: opened by it, closed by it only once each is shown to
// hold its own question, last first. The main window stays where it is.
// `--allow-more` presses the spend guard's Allow more (the user's word only).
//
// Exit codes: 0 done · 2 cannot start · 7 another driver holds the lock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const WORK_DIR = path.join(REPO, 'test-results', 'chatbot-quality', 'run');
fs.mkdirSync(WORK_DIR, { recursive: true });
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        return match ? [match[1], match[2] ?? true] : [arg, true];
    }),
);
const LANG = typeof args.lang === 'string' && args.lang !== 'en' ? args.lang : null;
const TAB_COUNT = Math.min(Number(args.tabs ?? 4), 8);
const WAVES = Number(args.waves ?? 5);
const TIMEOUT_MS = Number(args.timeout ?? 420) * 1000;
const OUT = path.resolve(
    String(
        args.out ??
            path.join(
                REPO,
                'test-results',
                'chatbot-quality',
                `stress-tabs-${new Date().toISOString().slice(0, 10)}.jsonl`,
            ),
    ),
);
const PROFILE = 'open-worship-app-dev';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => {
    console.log(new Date().toISOString().slice(11, 19), ...parts);
};

// ---- one driver at a time, the corpus run's own lock -------------------------

const LOCK_FILE = path.join(WORK_DIR, 'driver.lock');
if (fs.existsSync(LOCK_FILE)) {
    const other = Number(fs.readFileSync(LOCK_FILE, 'utf8'));
    try {
        if (other && other !== process.pid) {
            process.kill(other, 0);
            console.log('FATAL: another driver is running, pid', other);
            process.exit(7);
        }
    } catch {
        // gone
    }
}
fs.writeFileSync(LOCK_FILE, String(process.pid));
process.on('exit', () => {
    try {
        if (Number(fs.readFileSync(LOCK_FILE, 'utf8')) === process.pid) {
            fs.unlinkSync(LOCK_FILE);
        }
    } catch {
        // gone
    }
});

// ---- plumbing ---------------------------------------------------------------

async function findInstance() {
    const dir = path.join(os.tmpdir(), 'open-worship-app-cdp');
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) continue;
        const info = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (info.isDev !== true) continue;
        if (String(info.userDataPath).split(/[\\/]/).pop() !== PROFILE) continue;
        try {
            const res = await fetch(`${info.url}/json/version`, {
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) return info;
        } catch {
            // stale
        }
    }
    return null;
}

class Cdp {
    constructor(target) {
        this.target = target;
        this.id = 0;
        this.pending = new Map();
    }
    async open() {
        await new Promise((resolve, reject) => {
            this.socket = new WebSocket(this.target.webSocketDebuggerUrl);
            this.socket.addEventListener('open', resolve);
            this.socket.addEventListener('error', () => reject(new Error('cdp open failed')));
            this.socket.addEventListener('message', (event) => {
                const message = JSON.parse(event.data);
                const entry = this.pending.get(message.id);
                if (!entry) return;
                this.pending.delete(message.id);
                clearTimeout(entry.timer);
                if (message.error) entry.reject(new Error(message.error.message));
                else entry.resolve(message.result);
            });
        });
        return this;
    }
    evaluate(expression, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const id = ++this.id;
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error('CDP evaluate timed out'));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: (result) => {
                    if (result.exceptionDetails) {
                        reject(new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text));
                    } else {
                        resolve(result.result?.value);
                    }
                },
                reject,
                timer,
            });
            this.socket.send(JSON.stringify({
                id,
                method: 'Runtime.evaluate',
                params: { expression, returnByValue: true, awaitPromise: true },
            }));
        });
    }
}

// The pickers by what they hold (their labels are translated).
const FIND_PICKER_SOURCE = `const findPicker = (role) => {
    const selects = [...document.querySelectorAll('.chat-head-row select')];
    const valuesOf = (one) => [...one.options].map((option) => option.value);
    if (role === 'model') return document.querySelector('.chat-head-row select.chat-engine');
    if (role === 'focus') return selects.find((one) => valuesOf(one).includes('presenter') && valuesOf(one).includes('lwShare')) ?? null;
    return selects.find((one) => valuesOf(one).includes('free') || valuesOf(one).includes('::auto::')) ?? null;
};`;

const STATE = `(() => {
    ${FIND_PICKER_SOURCE}
    const readPick = (role) => {
        const picker = findPicker(role);
        const on = picker && [...picker.options].find((o) => o.value === picker.value);
        return on ? on.textContent.trim() : null;
    };
    const cues = [...document.querySelectorAll('.chat-cues article.cue')].map((cue) => {
        const body = cue.querySelector('.cue-body');
        const text = body ? [...body.children]
            .filter((c) => !c.matches('.cue-note, .cue-actions, .cue-replies, .cue-tools, .chat-clips'))
            .map((c) => c.innerText).join('\\n').trim() : cue.innerText.trim();
        const cost = cue.querySelector('.cue-cost');
        return {
            author: cue.classList.contains('cue-you') ? 'you' : 'bot',
            text,
            note: cue.querySelector('.cue-note')?.innerText.trim() ?? null,
            replies: [...cue.querySelectorAll('.cue-replies .cue-reply')].map((b) => b.textContent.trim()),
            costFull: cost ? cost.getAttribute('title') : null,
        };
    });
    return {
        provider: readPick('provider'),
        model: readPick('model'),
        isBusy: document.querySelector('.chat-stop') !== null || document.querySelector('.chat-progress') !== null,
        tabCount: document.querySelectorAll('.chat-tab').length,
        activeTab: [...document.querySelectorAll('.chat-tab')].findIndex((t) => t.classList.contains('is-on')),
        providerKey: findPicker('provider')?.value ?? null,
        modelKey: findPicker('model')?.value ?? null,
        isHeadFolded: document.querySelector('.chat-head-fold[aria-expanded="false"]') !== null,
        cues,
    };
})()`;

const PICK = (role, wanted, isByValue) => `(() => {
    ${FIND_PICKER_SOURCE}
    const picker = findPicker(${JSON.stringify(role)});
    if (!picker) return { ok: false, reason: 'no picker' };
    const option = [...picker.options].find((one) => ${isByValue ? 'one.value' : 'one.textContent.trim()'} === ${JSON.stringify(wanted)});
    if (!option) return { ok: false, reason: 'no option' };
    if (picker.value === option.value) return { ok: true };
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(picker, option.value);
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
})()`;

const PRESS_FROM_LIST = (question) => `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const more = document.querySelector('.chat-more');
    if (!more) return { ok: false, reason: 'no More button' };
    if (more.getAttribute('aria-expanded') !== 'true') more.click();
    let buttons = [];
    for (let turn = 0; turn < 50 && buttons.length === 0; turn++) {
        buttons = [...document.querySelectorAll('.chat-all .chat-starter')];
        if (buttons.length === 0) await wait(120);
    }
    const button = buttons.find((one) => one.textContent.trim() === ${JSON.stringify(question)});
    if (!button) return { ok: false, reason: 'not in the list', listed: buttons.length };
    button.click();
    return { ok: true };
})()`;

const CHOOSE_TAB = (index) => `(() => {
    const tab = document.querySelectorAll('.chat-tab')[${index}];
    const name = tab && tab.querySelector('.chat-tab-name');
    if (!name) return false;
    name.click();
    return true;
})()`;

const CLICK = (selector) => `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
})()`;

function parseUsage(costFull) {
    const line = String(costFull ?? '')
        .split(/\r?\n/)
        .find((one) => /^[^:;]*\d[^:;]*: [^;]+; [^;]*\d/.test(one.trim()));
    if (!line) return null;
    const toNumber = (text) => Number((/\d[\d,]*/.exec(text ?? '')?.[0] ?? '0').replace(/,/g, ''));
    const [head, rest] = line.trim().split(/: (.*)/s);
    const [inputText, outputText] = rest.split('; ');
    const inputParts = inputText.split(', ');
    return {
        rounds: toNumber(head),
        input: toNumber(inputParts[0]),
        cacheRead: toNumber(inputParts.slice(1).find((p) => /cache|ឃ្លាំង/.test(p))),
        output: toNumber(outputText),
    };
}

const toPlain = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// ---- the questions ----------------------------------------------------------

function loadQuestions() {
    const dir = path.join(REPO, 'tools', 'owa-devtools-mcp', 'questions');
    const translated = LANG === null ? null : JSON.parse(fs.readFileSync(path.join(dir, 'i18n', `${LANG}.json`), 'utf8')).questions;
    const rows = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.json') || name === 'schema.json') continue;
        const file = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        const focus = Array.isArray(file.focus) ? file.focus[0] : (file.focus ?? 'presenter');
        if (focus !== 'presenter') continue;
        for (const section of file.sections) {
            for (const question of section.questions) {
                if (question.template || question.kind === 'state' || (question.resources?.tools ?? []).length > 0) continue;
                const local = translated?.[`${file.page}.${section.id}.${question.id}`];
                rows.push({
                    key: `${file.page}/${section.id}/${question.id}`,
                    text: local?.text ?? question.text,
                    en: question.text,
                });
            }
        }
    }
    return rows;
}

// ---- the run ------------------------------------------------------------------

const instance = await findInstance();
if (instance === null) {
    console.log('FATAL: no live dev instance on', PROFILE);
    process.exit(2);
}
const pages = (await (await fetch(`${instance.url}/json/list`)).json()).filter((t) => t.type === 'page');
const chatbot = pages.find((t) => t.url.includes('chatbot.html'));
if (!chatbot) {
    console.log('FATAL: the chatbot window is not open');
    process.exit(2);
}
const cdp = await new Cdp(chatbot).open();
const getState = () => cdp.evaluate(STATE);

const all = loadQuestions();
const needed = TAB_COUNT * WAVES;
const step = Math.max(1, Math.floor(all.length / needed));
const questions = all.filter((_, index) => index % step === 0).slice(0, needed);
log(`questions ${questions.length} of ${all.length}; ${TAB_COUNT} tabs × ${WAVES} waves on ${args.server} / ${args.model}`);

let state = await getState();
if (state.isHeadFolded) {
    await cdp.evaluate(CLICK('.chat-head-fold'));
    await sleep(400);
}
const startTabCount = state.tabCount;
if (startTabCount + TAB_COUNT > 12) {
    console.log('FATAL: no room for', TAB_COUNT, 'more tabs');
    process.exit(2);
}
// The window default, off a fresh tab of this run's own before anything is
// picked in one.
let windowDefault = null;
{
    await cdp.evaluate(CLICK('.chat-tab-add'));
    await sleep(800);
    const tab = await getState();
    if (tab.cues.length === 0 && tab.activeTab === tab.tabCount - 1) {
        windowDefault = {
            provider: tab.provider,
            model: tab.model,
            providerKey: tab.providerKey,
            modelKey: tab.modelKey,
        };
        await cdp.evaluate(CLICK('.chat-tab.is-on .chat-tab-close'));
        await sleep(400);
    }
}

async function pressAllowMore() {
    return await cdp.evaluate(`(() => {
        const button = [...(document.querySelector('.chat-head')?.querySelectorAll('button') ?? [])]
            .find((one) => /អនុញ្ញាតបន្ថែម|Allow more|Autoriser davantage/.test(one.textContent));
        if (!button) return false;
        button.click();
        return true;
    })()`);
}

for (let wave = 0; wave < WAVES; wave++) {
    const batch = questions.slice(wave * TAB_COUNT, (wave + 1) * TAB_COUNT);
    if (batch.length === 0) break;
    const own = [];
    // Open every tab and ask in it, one after the other, without waiting.
    for (const row of batch) {
        const before = await getState();
        await cdp.evaluate(CLICK('.chat-tab-add'));
        let opened = null;
        for (let i = 0; i < 30; i++) {
            await sleep(150);
            const now = await getState();
            if (now.tabCount === before.tabCount + 1 && now.activeTab === now.tabCount - 1 && now.cues.length === 0) {
                opened = now;
                break;
            }
        }
        if (opened === null) {
            log('STOP: a new tab did not open empty');
            break;
        }
        const picked = (await cdp.evaluate(PICK('provider', args.server, false))).ok &&
            (await sleep(400), (await cdp.evaluate(PICK('model', args.model, false))).ok) &&
            (await cdp.evaluate(PICK('focus', 'presenter', true))).ok;
        if (!picked) {
            log('STOP: could not pick', args.server, args.model);
            break;
        }
        await sleep(300);
        const sent = await cdp.evaluate(PRESS_FROM_LIST(row.text), 20000);
        own.push({ index: opened.activeTab, row, sentAt: Date.now(), sent: sent.ok, sentReason: sent.reason });
    }
    log(`wave ${wave + 1}: ${own.length} tabs asking`);
    // Read each tab until it has answered.
    const pending = new Set(own.map((_, i) => i));
    const startedAt = Date.now();
    while (pending.size > 0 && Date.now() - startedAt < TIMEOUT_MS) {
        for (const i of [...pending]) {
            const tab = own[i];
            await cdp.evaluate(CHOOSE_TAB(tab.index));
            await sleep(250);
            const now = await getState();
            if (now.activeTab !== tab.index) continue;
            const you = now.cues.filter((cue) => cue.author === 'you');
            const bots = now.cues.filter((cue) => cue.author === 'bot');
            const last = now.cues[now.cues.length - 1];
            if (!now.isBusy && last?.author === 'bot') {
                const paused = /ខ្ញុំបានផ្អាកជំនួយការ|I have paused the assistant/.test(`${last.note ?? ''} ${last.text}`);
                if (paused && args['allow-more'] === true) {
                    log('ALLOW MORE pressed (user-authorized):', await pressAllowMore());
                }
                tab.doneAt = Date.now();
                tab.answer = last.text;
                tab.note = last.note;
                tab.replies = last.replies;
                tab.usage = parseUsage(last.costFull);
                tab.firstYou = you[0]?.text ?? null;
                tab.youCount = you.length;
                tab.botCount = bots.length;
                tab.provider = now.provider;
                tab.model = now.model;
                tab.paused = paused;
                pending.delete(i);
            }
        }
        await sleep(500);
    }
    // Record, then close this wave's tabs -- last first, each shown to be ours.
    for (const tab of own) {
        const record = {
            wave: wave + 1,
            tabs: own.length,
            key: tab.row.key,
            q: tab.row.text,
            en: tab.row.en,
            sent: tab.sent,
            sentReason: tab.sentReason,
            seconds: tab.doneAt ? Math.round((tab.doneAt - tab.sentAt) / 100) / 10 : null,
            timedOut: tab.doneAt === undefined,
            ownQuestion: tab.firstYou === null ? null : toPlain(tab.firstYou) === toPlain(tab.row.text),
            youCount: tab.youCount,
            botCount: tab.botCount,
            answer: tab.answer ?? '',
            note: tab.note ?? null,
            replies: tab.replies ?? [],
            usage: tab.usage ?? null,
            noModel: (tab.usage ?? null) === null,
            paused: tab.paused === true,
            provider: tab.provider,
            model: tab.model,
            at: new Date().toISOString(),
        };
        fs.appendFileSync(OUT, JSON.stringify(record) + '\n');
        log(`  [w${record.wave}] ${record.key} | ${record.seconds}s r${record.usage?.rounds ?? '?'} own=${record.ownQuestion} ${record.timedOut ? 'TIMEOUT ' : ''}${record.noModel ? 'NOMODEL ' : ''}| ${toPlain(record.answer).slice(0, 70)}`);
    }
    for (const tab of [...own].reverse()) {
        await cdp.evaluate(CHOOSE_TAB(tab.index));
        await sleep(250);
        const now = await getState();
        const first = now.cues.find((cue) => cue.author === 'you');
        if (now.activeTab !== tab.index || first === undefined || toPlain(first.text) !== toPlain(tab.row.text)) {
            log('LEFT ALONE: tab', tab.index, 'does not hold its own question');
            continue;
        }
        if (now.isBusy) {
            await cdp.evaluate(CLICK('.chat-stop'));
            await sleep(1500);
        }
        await cdp.evaluate(CLICK('.chat-tab.is-on .chat-tab-close'));
        await sleep(400);
    }
    const after = await getState();
    log(`wave ${wave + 1} done; window holds ${after.tabCount} tab(s)`);
}

// What a new tab starts on is the window's default: picking in a tab moves
// it, so it is put back by value in a tab of this run's own.
if (windowDefault !== null && windowDefault.providerKey) {
    await cdp.evaluate(CLICK('.chat-tab-add'));
    await sleep(800);
    const tab = await getState();
    if (tab.cues.length === 0 && tab.activeTab === tab.tabCount - 1) {
        await cdp.evaluate(PICK('provider', windowDefault.providerKey, true));
        await sleep(500);
        if (windowDefault.modelKey) {
            await cdp.evaluate(PICK('model', windowDefault.modelKey, true));
            await sleep(300);
        }
        await cdp.evaluate(CLICK('.chat-tab.is-on .chat-tab-close'));
        await sleep(400);
        log('window default put back:', windowDefault.provider, '/', windowDefault.model);
    }
}
cdp.socket.close();
log('done');
process.exit(0);
