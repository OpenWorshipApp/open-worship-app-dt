// The three buttons beside the box, pressed for real (2026-10-17, the user's
// ask with the 📎 📷 ◎ circled: _test this as well_): every way a question
// can carry more than words, in the app's own language, on the assistant
// named. One tab of this run's own; the attachments in it are numbered one
// after the other, so the last question can name one by its number.
//
//   node attach-run.mjs --server="Ollam super-mac" --model="gemma4:cloud" \
//        [--lang=km] [--out=<file.jsonl>] [--allow-more]
//
// - 📷 is pressed as a person presses it: the window takes the picture.
// - ◎ is pressed, the run waits for the picker to be up in the main window
//   (`#owa-picker-host` -- until then a click there PRESSES the control), then
//   clicks the Bible Lookup button with a real mouse event. The picker
//   swallows that click; a lookup popup that opened anyway is recorded.
// - 📎 opens the operating system's file dialog, which nothing here can
//   drive, so the run sets the files on that same input over CDP
//   (`DOM.setFileInputFiles`) -- exactly what choosing them does -- and the
//   window's own reading of them runs: a Khmer text file, a picture of the
//   main window, a PDF.
// Nothing is typed into anything but the help window's own box, nothing is
// put on a screen, and the tab is closed only once shown to be this run's.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const WORK_DIR = path.join(REPO, 'test-results', 'chatbot-quality', 'run');
const FILE_DIR = path.join(REPO, 'test-results', 'chatbot-quality', 'attach-files');
fs.mkdirSync(WORK_DIR, { recursive: true });
fs.mkdirSync(FILE_DIR, { recursive: true });
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        return match ? [match[1], match[2] ?? true] : [arg, true];
    }),
);
const OUT = path.resolve(
    String(args.out ?? path.join(REPO, 'test-results', 'chatbot-quality', `attach-${new Date().toISOString().slice(0, 10)}.jsonl`)),
);
const PROFILE = 'open-worship-app-dev';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

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
        if (Number(fs.readFileSync(LOCK_FILE, 'utf8')) === process.pid) fs.unlinkSync(LOCK_FILE);
    } catch {
        // gone
    }
});

async function findInstance() {
    const dir = path.join(os.tmpdir(), 'open-worship-app-cdp');
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) continue;
        const info = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (info.isDev !== true || String(info.userDataPath).split(/[\\/]/).pop() !== PROFILE) continue;
        try {
            if ((await fetch(`${info.url}/json/version`, { signal: AbortSignal.timeout(3000) })).ok) return info;
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
    send(method, params = {}, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const id = ++this.id;
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP ${method} timed out`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }
    async evaluate(expression, timeoutMs = 30000) {
        const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
        if (result.exceptionDetails) {
            throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
        }
        return result.result?.value;
    }
}

const FIND_PICKER_SOURCE = `const findPicker = (role) => {
    const selects = [...document.querySelectorAll('.chat-head-row select')];
    const valuesOf = (one) => [...one.options].map((option) => option.value);
    if (role === 'model') return document.querySelector('.chat-head-row select.chat-engine');
    if (role === 'focus') return selects.find((one) => valuesOf(one).includes('presenter') && valuesOf(one).includes('lwShare')) ?? null;
    return selects.find((one) => valuesOf(one).includes('free') || valuesOf(one).includes('::auto::')) ?? null;
};`;

const STATE = `(() => {
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
            actions: [...cue.querySelectorAll('.cue-actions .cue-act')].map((b) => b.textContent.trim()),
            clips: [...cue.querySelectorAll('.chat-clips .chat-clip-name')].map((b) => b.innerText.trim()),
            cost: cost ? cost.getAttribute('title') : null,
        };
    });
    const ask = document.querySelector('form.chat-ask');
    return {
        isBusy: document.querySelector('.chat-stop') !== null || document.querySelector('.chat-progress') !== null,
        tabCount: document.querySelectorAll('.chat-tab').length,
        activeTab: [...document.querySelectorAll('.chat-tab')].findIndex((t) => t.classList.contains('is-on')),
        boxClips: ask ? [...(ask.closest('.chat-foot, .chat-ask-wrap, body') ?? document).querySelectorAll('.chat-clips')]
            .filter((list) => !list.closest('article.cue'))
            .flatMap((list) => [...list.querySelectorAll('.chat-clip-name')].map((name) => {
                const clip = name.closest('[class*="chat-clip"]')?.parentElement ?? name.parentElement;
                return { name: name.innerText.trim(), number: clip?.querySelector('.chat-clip-number')?.innerText.trim() ?? null };
            })) : [],
        attachError: document.querySelector('.chat-attach-error')?.innerText.trim() ?? null,
        attachTitles: [...document.querySelectorAll('.chat-attach')].map((b) => b.getAttribute('aria-label') + ' / ' + b.getAttribute('title')),
        cues,
    };
})()`;

const PICK = (role, wanted, isByValue) => `(() => {
    ${FIND_PICKER_SOURCE}
    const picker = findPicker(${JSON.stringify(role)});
    if (!picker) return { ok: false };
    const option = [...picker.options].find((one) => ${isByValue ? 'one.value' : 'one.textContent.trim()'} === ${JSON.stringify(wanted)});
    if (!option) return { ok: false };
    if (picker.value === option.value) return { ok: true };
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(picker, option.value);
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
})()`;

const TYPE_AND_SEND = (text) => `(() => {
    const input = document.querySelector('textarea.chat-input');
    const form = document.querySelector('form.chat-ask');
    if (!input || !form) return { ok: false };
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return { ok: true };
})()`;

const CLICK = (selector) => `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
})()`;

// ---- the files a person would choose ---------------------------------------

function writeFiles(mainShot) {
    const text = path.join(FILE_DIR, 'ទំនុក-ព្រះគុណ.txt');
    fs.writeFileSync(
        text,
        [
            'ព្រះគុណដ៏អស្ចារ្យ',
            '',
            'ព្រះគុណដ៏អស្ចារ្យ សំឡេងពីរោះណាស់',
            'បានសង្គ្រោះមនុស្សមានបាបដូចខ្ញុំ',
            'ពីមុនខ្ញុំវង្វេង តែឥឡូវរកឃើញ',
            'ពីមុនខ្ញុំខ្វាក់ តែឥឡូវមើលឃើញ',
        ].join('\n'),
    );
    const picture = path.join(FILE_DIR, 'presenter.png');
    fs.writeFileSync(picture, Buffer.from(mainShot, 'base64'));
    // The smallest PDF a reader opens: one page, one line.
    const pdf = path.join(FILE_DIR, 'service-order.pdf');
    const objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
        '4 0 obj << /Length 44 >> stream\nBT /F1 18 Tf 20 70 Td (Order of service) Tj ET\nendstream endobj',
        '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];
    let body = '%PDF-1.4\n';
    const offsets = [];
    for (const object of objects) {
        offsets.push(body.length);
        body += `${object}\n`;
    }
    const xrefAt = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    body += offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    fs.writeFileSync(pdf, body);
    return { text, picture, pdf };
}

// ---- the run ----------------------------------------------------------------

const instance = await findInstance();
if (instance === null) {
    console.log('FATAL: no live dev instance');
    process.exit(2);
}
const pages = (await (await fetch(`${instance.url}/json/list`)).json()).filter((t) => t.type === 'page');
const chatbotTarget = pages.find((t) => t.url.includes('chatbot.html'));
const mainTarget = pages.find((t) => /\/(presenter|reader|appDocumentEditor)\.html/.test(t.url));
if (!chatbotTarget || !mainTarget) {
    console.log('FATAL: the help window or the main window is not open');
    process.exit(2);
}
const chat = await new Cdp(chatbotTarget).open();
const main = await new Cdp(mainTarget).open();
await chat.send('DOM.enable');
const getState = () => chat.evaluate(STATE);

const shot = await main.send('Page.captureScreenshot', { format: 'png' });
const files = writeFiles(shot.data);
log('main window:', mainTarget.url);

// A tab of this run's own, on the assistant named, asking about the main page.
const before = await getState();
await chat.evaluate(CLICK('.chat-tab-add'));
await sleep(800);
let state = await getState();
if (state.tabCount !== before.tabCount + 1 || state.cues.length !== 0) {
    console.log('FATAL: the new tab did not open empty');
    process.exit(2);
}
const ownIndex = state.activeTab;
const windowDefault = await chat.evaluate(`(() => { ${FIND_PICKER_SOURCE} return { provider: findPicker('provider')?.value, model: findPicker('model')?.value }; })()`);
await chat.evaluate(PICK('provider', args.server, false));
await sleep(500);
await chat.evaluate(PICK('model', args.model, false));
const mainPage = /\/(presenter|reader|appDocumentEditor)\.html/.exec(mainTarget.url)[1];
await chat.evaluate(PICK('focus', mainPage, true));
await sleep(400);
log('attach buttons:', JSON.stringify((await getState()).attachTitles));

async function waitAnswer(botsBefore, timeoutMs = 300000) {
    const startedAt = Date.now();
    for (;;) {
        const now = await getState();
        const bots = now.cues.filter((cue) => cue.author === 'bot');
        if (!now.isBusy && bots.length > botsBefore) {
            return now;
        }
        if (Date.now() - startedAt > timeoutMs) return null;
        await sleep(600);
    }
}

async function pressAllowMoreIfPaused(answer) {
    if (args['allow-more'] !== true) return false;
    if (!/ខ្ញុំបានផ្អាកជំនួយការ|I have paused the assistant/.test(`${answer?.note ?? ''} ${answer?.text ?? ''}`)) return false;
    const pressed = await chat.evaluate(`(() => {
        const button = [...(document.querySelector('.chat-head')?.querySelectorAll('button') ?? [])]
            .find((one) => /អនុញ្ញាតបន្ថែម|Allow more/.test(one.textContent));
        if (!button) return false;
        button.click();
        return true;
    })()`);
    log('ALLOW MORE pressed (user-authorized):', pressed);
    await sleep(2000);
    return pressed;
}

async function attachFiles(paths) {
    const { root } = await chat.send('DOM.getDocument', { depth: 1 });
    const { nodeId } = await chat.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input.chat-file-input' });
    await chat.send('DOM.setFileInputFiles', { nodeId, files: paths });
}

let firstQuestion = null;
const steps = [
    {
        id: 'A1-camera',
        attach: async () => chat.evaluate(CLICK('.chat-attach:nth-of-type(2)')),
        ask: 'តើខ្ញុំកំពុងនៅទំព័រណា? ហើយខ្ញុំដាក់ចម្រៀងមួយបទលើអេក្រង់ធំដោយរបៀបណា?',
    },
    {
        id: 'A2-point',
        attach: async () => {
            await chat.evaluate(CLICK('.chat-attach:nth-of-type(3)'));
            // The picker up in the main window first: until then the click
            // would press the control itself.
            let isUp = false;
            for (let turn = 0; turn < 40 && !isUp; turn++) {
                await sleep(250);
                isUp = await main.evaluate(`document.getElementById('owa-picker-host') !== null`);
            }
            if (!isUp) return { ok: false, reason: 'the picker never came up' };
            const box = await main.evaluate(`(() => {
                const button = document.querySelector('#app-header button:has(i.bi-book)');
                if (!button) return null;
                const r = button.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            })()`);
            if (box === null) return { ok: false, reason: 'no Bible Lookup button' };
            await main.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
            await sleep(300);
            await main.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
            await main.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
            await sleep(1500);
            return { ok: true };
        },
        ask: 'តើប៊ូតុងដែលខ្ញុំចង្អុលនេះ ប្រើសម្រាប់ធ្វើអ្វី?',
    },
    {
        id: 'A3-text-file',
        attach: async () => attachFiles([files.text]),
        ask: 'ខ្ញុំមានទំនុកចម្រៀងនៅក្នុងឯកសារនេះ។ តើខ្ញុំដាក់វាជាចម្រៀងនៅក្នុងកម្មវិធីនេះ ហើយបង្ហាញលើអេក្រង់ដោយរបៀបណា?',
    },
    {
        id: 'A4-picture-file-by-number',
        attach: async () => attachFiles([files.picture]),
        askFor: (clips) => {
            const number = clips[clips.length - 1]?.number ?? '';
            return `នៅក្នុងរូបភាពលេខ ${number} តើប៊ូតុងណាសម្រាប់បើក ឬបិទអេក្រង់ធំ ហើយវានៅត្រង់ណា?`;
        },
    },
    {
        id: 'A5-pdf',
        attach: async () => attachFiles([files.pdf]),
        ask: 'តើឯកសារ PDF នេះនិយាយអំពីអ្វី? តើខ្ញុំបង្ហាញវាលើអេក្រង់បានទេ?',
    },
];

const lookupWasOpen = await main.evaluate(`document.querySelector('.modal, .app-modal, [class*="bible-lookup-popup"]') !== null`);
for (const step of steps) {
    const now0 = await getState();
    if (now0.activeTab !== ownIndex) {
        log('STOP: the tab in front is not this run\'s');
        break;
    }
    const attached = await step.attach();
    await sleep(1500);
    const withClips = await getState();
    const record = {
        id: step.id,
        attached,
        boxClips: withClips.boxClips,
        attachError: withClips.attachError,
    };
    if (step.id === 'A2-point') {
        record.lookupOpenedByClick =
            !lookupWasOpen &&
            (await main.evaluate(`document.querySelector('.modal, .app-modal, [class*="bible-lookup-popup"]') !== null`));
    }
    const question = step.askFor ? step.askFor(withClips.boxClips) : step.ask;
    record.q = question;
    let answer = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        const botsBefore = (await getState()).cues.filter((cue) => cue.author === 'bot').length;
        const startedAt = Date.now();
        await chat.evaluate(TYPE_AND_SEND(question));
        if (firstQuestion === null) firstQuestion = question;
        const done = await waitAnswer(botsBefore);
        record.seconds = Math.round((Date.now() - startedAt) / 100) / 10;
        answer = done?.cues[done.cues.length - 1] ?? null;
        if (!(await pressAllowMoreIfPaused(answer))) break;
    }
    const sent = (await getState()).cues.filter((cue) => cue.author === 'you').pop();
    record.sentClips = sent?.clips ?? [];
    record.answer = answer?.text ?? '';
    record.note = answer?.note ?? null;
    record.replies = answer?.replies ?? [];
    record.actions = answer?.actions ?? [];
    record.cost = answer?.cost ?? null;
    record.at = new Date().toISOString();
    fs.appendFileSync(OUT, JSON.stringify(record) + '\n');
    log(`[${step.id}] attached=${JSON.stringify(record.attached)} clips=${JSON.stringify(record.boxClips)} ${record.attachError ? 'ERR=' + record.attachError : ''} ${record.seconds}s | ${record.answer.replace(/\s+/g, ' ').slice(0, 120)}`);
}

// Put the tab back: the default the window had, then close it -- ours only.
const end = await getState();
const first = end.cues.find((cue) => cue.author === 'you');
if (end.activeTab === ownIndex && first && first.text.replace(/\s+/g, ' ').includes(firstQuestion.slice(0, 20))) {
    await chat.evaluate(PICK('provider', windowDefault.provider, true));
    await sleep(400);
    if (windowDefault.model) await chat.evaluate(PICK('model', windowDefault.model, true));
    await sleep(300);
    await chat.evaluate(CLICK('.chat-tab.is-on .chat-tab-close'));
    log('tab closed; window default put back');
} else {
    log('LEFT ALONE: the tab in front is not the one this run opened');
}
if (await main.evaluate(`document.getElementById('owa-picker-host') !== null`)) {
    await main.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await main.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
}
chat.socket.close();
main.socket.close();
process.exit(0);
