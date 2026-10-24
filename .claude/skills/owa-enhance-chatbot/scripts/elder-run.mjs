// The elder-persona run (2026-10-17, the user's asks: _test with complex as
// much as possible in Khmer setting language_; _imagine user is an elderly
// (non-technical) and ask a lot of non-sense questions and do a lot of crazy
// interactive_; _find chatbot best assistant model_). Where `corpus-run.mjs`
// asks the supported questions one by one in English, this one drives
// CONVERSATIONS in the app's own language (`../references/elder-khmer-asks.json`):
// a verse half-remembered, a panic, nonsense, "delete everything", a story
// that rambles, a question interrupted, stopped, asked again, a thumb down.
// Language-blind: the head row's pickers are found by their options, never
// by their aria-labels, which are translated.
//
//   node elder-run.mjs --models="Ollam super-mac|gemma4:cloud,ឥតគិតថ្លៃ|"
//        [--only=V1-,N4-] [--pace=125] [--timeout=420] [--out=<file>]
//        [--scenarios=<file>] [--allow-more]
//   node elder-digest.mjs <out> [scenario-prefix | numbers]
//
// A model is `server|model` as the pickers show them; `server|` asks the
// server's own default (Free) or none (Auto). One JSON line a step, one a
// scenario (what it left behind: a walkthrough card, a page the main window
// moved to, a screen, a data change -- read with `owa_undo list`). Models are
// interleaved scenario by scenario, so a run cut short compares them on the
// same questions; resumable, a scenario with an error asked again.
//
// The rules it keeps:
// - The dev app, its own profile, the help window open and visible. A tab is
//   opened per scenario and closed only once shown to be its own.
// - Nothing that reaches a projector, removes, acts for the person or leaves
//   the app is pressed (`DENY_PRESS`), whatever a scenario says; the model
//   may still act on its own -- that is what is measured -- so each
//   scenario's screens and data changes are recorded for undoing.
// - The pace cap counts every model round of the hour, across runs
//   (`elder-rounds.json`). `--allow-more` presses the spend guard's Allow
//   more when it trips: ONLY with the user's explicit word in the
//   conversation, only on a dev app, and only for assistants at $0.
// - A file under `src/` saved during a run reloads the window: the scenario
//   in flight is marked and asked again, but the models are then compared
//   across code -- stop the run (`ELDER-STOP`) before changing code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    return match ? [match[1], match[2] ?? true] : [arg, true];
  }),
);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..', '..', '..');
const WORK_DIR = path.join(REPO, 'test-results', 'chatbot-quality', 'run');
fs.mkdirSync(WORK_DIR, { recursive: true });
const SERVER = args.server ?? 'Ollam super-mac';
// "model" on --server, or "server|model" (no model after the bar: Auto, or
// a server's own default).
const MODELS = String(args.models ?? 'gemma4:cloud').split(',');
const toPair = (entry) => {
  const [server, model] = entry.includes('|')
    ? entry.split('|')
    : [SERVER, entry];
  return {
    server,
    model: model === '' ? null : model,
    label: entry.includes('|') ? model || server : entry,
  };
};
const OUT = path.resolve(
  args.out ??
    path.join(
      REPO,
      'test-results',
      'chatbot-quality',
      `elder-${new Date().toISOString().slice(0, 10)}.jsonl`,
    ),
);
const SCENARIOS = JSON.parse(
  fs.readFileSync(
    path.resolve(
      args.scenarios ??
        path.join(HERE, '..', 'references', 'elder-khmer-asks.json'),
    ),
    'utf8',
  ),
);
const PACE = Number(args.pace ?? 135);
const ANSWER_TIMEOUT_MS = Number(args.timeout ?? 300) * 1000;
const STOP_FILE = path.join(WORK_DIR, 'ELDER-STOP');
const RUN_ID = new Date().toISOString();
const PROFILE = 'open-worship-app-dev';
const FOCUS_INDEX = { presenter: 0, reader: 1 };
// Never pressed, whatever a scenario says: what reaches a projector, removes,
// acts for the person, lifts the spend guard, or leaves the app.
const DENY_PRESS =
  /អេក្រង់|screen|ធ្វើជំនួសខ្ញុំ|Do it|អនុញ្ញាតបន្ថែម|Allow more|លុប|Delete|Trash|សម្អាត|Clear|Google|http/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => {
  const line = `${new Date().toTimeString().slice(0, 8)} ${parts.join(' ')}`;
  console.log(line);
};

// ---- plumbing --------------------------------------------------------------

async function findInstance() {
  const dir = path.join(os.tmpdir(), 'open-worship-app-cdp');
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const info = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (!info.isDev) continue;
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
  throw new Error('no live dev instance on ' + PROFILE);
}

class Cdp {
  constructor(target) {
    this.target = target;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.target.webSocketDebuggerUrl);
      this.socket.addEventListener('open', resolve);
      this.socket.addEventListener('error', () =>
        reject(new Error('cdp open failed')),
      );
      this.socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== undefined) {
          const entry = this.pending.get(message.id);
          if (!entry) return;
          this.pending.delete(message.id);
          clearTimeout(entry.timer);
          if (message.error) entry.reject(new Error(message.error.message));
          else entry.resolve(message.result);
          return;
        }
        for (const listener of this.listeners) listener(message);
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
    const result = await this.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
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
}

class Mcp {
  constructor(instance) {
    this.url = instance.mcpUrl;
    this.token = instance.mcpToken;
    this.session = null;
    this.n = 0;
  }
  async post(body) {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${this.token}`,
    };
    if (this.session) headers['mcp-session-id'] = this.session;
    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.session = sid;
    if (res.status === 404) {
      this.session = null;
      return { expired: true };
    }
    if (!res.ok || res.status === 202) return null;
    const text = await res.text();
    const line = text
      .split(/\r?\n/)
      .reverse()
      .find((one) => one.startsWith('data:'));
    try {
      return JSON.parse(line ? line.slice(5) : text)?.result ?? null;
    } catch {
      return null;
    }
  }
  async call(name, a = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!this.session) {
        await this.post({
          jsonrpc: '2.0',
          id: ++this.n,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'owa-elder-run', version: '0.1.0' },
          },
        });
        await this.post({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        });
      }
      const result = await this.post({
        jsonrpc: '2.0',
        id: ++this.n,
        method: 'tools/call',
        params: { name, arguments: a },
      });
      if (result?.expired) continue;
      const text = (result?.content ?? [])
        .filter((i) => i?.type === 'text')
        .map((i) => i.text)
        .join('\n');
      try {
        return JSON.parse(text);
      } catch {
        return text ? { text } : null;
      }
    }
    return null;
  }
}

// ---- page expressions --------------------------------------------------------

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
            actions: [...cue.querySelectorAll('.cue-actions .cue-act')].map((b) => b.textContent.trim()),
            replies: [...cue.querySelectorAll('.cue-replies .cue-reply')].map((b) => b.textContent.trim()),
            buttons: [...cue.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean),
            cost: cost ? cost.innerText.trim() : null,
            costFull: cost ? cost.getAttribute('title') : null,
        };
    });
    return {
        isBusy: document.querySelector('.chat-stop') !== null || document.querySelector('.chat-progress') !== null,
        progress: [...document.querySelectorAll('.chat-progress .chat-status')].map((p) => p.innerText.trim()),
        alert: document.querySelector('.chat-alert')?.innerText ?? null,
        tabCount: document.querySelectorAll('.chat-tab').length,
        activeTab: [...document.querySelectorAll('.chat-tab')].findIndex((t) => t.classList.contains('is-on')),
        isHeadFolded: document.querySelector('.chat-head-fold[aria-expanded="false"]') !== null,
        inputValue: document.querySelector('textarea.chat-input')?.value ?? null,
        loadedAt: performance.timeOrigin,
        visibility: document.visibilityState,
        cues,
    };
})()`;

// The head row's pickers by what they hold: the focus one holds a window per
// option, the assistant one the server's name, the model one the model.
const PICK = (kind, wanted) => `(() => {
    const selects = [...document.querySelectorAll('.chat-head-row select')];
    const texts = (s) => [...s.options].map((o) => o.textContent.trim());
    let picker = null;
    let option = null;
    if (${JSON.stringify(kind)} === 'focus') {
        picker = selects[0];
        option = picker?.options[${JSON.stringify(wanted)}];
    } else {
        for (const s of selects) {
            const found = [...s.options].find((o) => o.textContent.trim() === ${JSON.stringify(wanted)});
            if (found) { picker = s; option = found; break; }
        }
    }
    if (!picker || !option) {
        return { ok: false, reason: 'no option', options: selects.map(texts) };
    }
    if (picker.value === option.value) return { ok: true, already: true };
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(picker, option.value);
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
})()`;

const TYPE_AND_SEND = (text) => `(() => {
    const input = document.querySelector('textarea.chat-input');
    const form = document.querySelector('form.chat-ask');
    if (!input || !form) return { ok: false, reason: 'no form' };
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
    set.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = form.querySelector('button[type="submit"]');
    form.requestSubmit();
    return { ok: true, submitDisabled: submit ? submit.disabled : null };
})()`;

const SUBMIT_AS_IS = `(() => {
    const form = document.querySelector('form.chat-ask');
    const input = document.querySelector('textarea.chat-input');
    if (!form) return { ok: false };
    form.requestSubmit();
    return { ok: true, value: input?.value ?? null };
})()`;

// A button under the LAST bot answer (or the last question), by its words.
const PRESS = (pattern, fallback, scope) => `(() => {
    const cues = [...document.querySelectorAll('.chat-cues article.cue')];
    const want = ${JSON.stringify(scope)};
    const cue = [...cues].reverse().find((c) => want === 'you' ? c.classList.contains('cue-you') : !c.classList.contains('cue-you'));
    if (!cue) return { ok: false, reason: 'no cue' };
    const buttons = [...cue.querySelectorAll('button')];
    const all = buttons.map((b) => b.textContent.trim());
    const deny = new RegExp(${JSON.stringify(DENY_PRESS.source)}, 'i');
    // An icon button (the thumbs) has no words, only its aria-label.
    const nameOf = (b) => b.textContent.trim() || (b.getAttribute('aria-label') ?? '').trim();
    const tryOne = (source) => {
        if (!source) return null;
        const re = new RegExp(source, 'i');
        return buttons.find((b) => re.test(nameOf(b)) && !deny.test(nameOf(b))) ?? null;
    };
    const button = tryOne(${JSON.stringify(pattern)}) ?? tryOne(${JSON.stringify(fallback ?? null)});
    if (!button) return { ok: false, reason: 'no such button', buttons: all };
    if (button.disabled) return { ok: false, reason: 'disabled', label: button.textContent.trim() };
    button.click();
    return { ok: true, label: button.textContent.trim(), buttons: all };
})()`;

const CLICK = (selector) => `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return { ok: false };
    node.click();
    return { ok: true };
})()`;

// ---- measurement helpers -----------------------------------------------------

function parseUsage(costFull) {
  if (!costFull) return null;
  const line = costFull
    .split('\n')
    .find((one) => /\d/.test(one) && /[:：]/.test(one) && !/·/.test(one));
  if (!line) return null;
  const nums = [...line.matchAll(/(\d[\d,]*)/g)].map((m) =>
    Number(m[1].replace(/,/g, '')),
  );
  if (nums.length < 3) return null;
  return {
    rounds: nums[0],
    input: nums[1],
    cacheRead: nums.length >= 4 ? nums[2] : 0,
    output: nums[nums.length - 1],
  };
}

const KHMER = /[ក-៿]/g;
const LATIN = /[A-Za-z]/g;
function scriptMix(text) {
  const km = (text.match(KHMER) ?? []).length;
  const en = (text.match(LATIN) ?? []).length;
  return {
    km,
    en,
    kmShare: km + en === 0 ? null : Math.round((km / (km + en)) * 100) / 100,
  };
}
const LEAK =
  /\bowa_[a-z_]+|\bW-\d{2}\w?\b|\b[\w/-]+\.(?:tsx?|mjs|json|html)\b|\bsrc\/|data-react|\bisShowing\b|\bneedsPage\b|\bundefined\b|\[object |\{"|"[a-zA-Z]+":|<\/?[a-z]+>|\bmanualId\b|\bdemoId\b/;
const ERROR_WORDS =
  /could not answer|I could not|TypeError|ReferenceError|is not a function|Cannot read|stack|មិនអាចឆ្លើយបានទេ/i;

function openedRefs(buttons) {
  return (buttons ?? [])
    .map((label) => {
      const m =
        /^(?:Open|បើក)\s+(.+?)\s+(?:in Bible Lookup|ក្នុងការស្វែងរកព្រះគម្ពីរ)$/i.exec(
          label,
        );
      return m ? m[1] : null;
    })
    .filter(Boolean);
}
// A Khmer button names the verse as ពគប writes it (`ម៉ាថាយ ៥:៤៤`): read
// back to the English the scenarios expect.
const KM_BOOK_MAP = {
  ម៉ាថាយ: 'matthew',
  លូកា: 'luke',
  ទំនុកដំកើង: 'psalm',
  រ៉ូម: 'romans',
  យ៉ូហាន: 'john',
  សុភាសិត: 'proverbs',
};
const normRef = (ref) => {
  let text = ref.replace(/[០-៩]/g, (d) => String('០១២៣៤៥៦៧៨៩'.indexOf(d)));
  for (const [km, en] of Object.entries(KM_BOOK_MAP)) {
    text = text.replace(km, en);
  }
  return text
    .toLowerCase()
    .replace(/^psalms /, 'psalm ')
    .replace(/\s+/g, ' ')
    .trim();
};

// ---- the run -------------------------------------------------------------------

const instance = await findInstance();
const mcp = new Mcp(instance);
const pages = await (await fetch(`${instance.url}/json/list`)).json();
const chatTarget = pages.find(
  (p) => p.type === 'page' && p.url.includes('chatbot.html'),
);
if (!chatTarget) {
  console.log('FATAL: the chatbot window is not open');
  process.exit(2);
}
const cdp = await new Cdp(chatTarget).open();
await cdp.send('Network.enable', { maxPostDataSize: 65536 });
await cdp.send('Runtime.enable');

let toolCalls = [];
let pageErrors = [];
const requestMap = new Map();
cdp.listeners.add((message) => {
  if (message.method === 'Runtime.exceptionThrown') {
    const d = message.params.exceptionDetails;
    pageErrors.push({
      kind: 'exception',
      text: (d.exception?.description ?? d.text ?? '').slice(0, 300),
    });
    return;
  }
  if (
    message.method === 'Runtime.consoleAPICalled' &&
    message.params.type === 'error'
  ) {
    pageErrors.push({
      kind: 'console.error',
      text: message.params.args
        .map((a) => a.value ?? a.description ?? '')
        .join(' ')
        .slice(0, 300),
    });
    return;
  }
  if (message.method === 'Network.requestWillBeSent') {
    const { requestId, request } = message.params;
    if (request.method !== 'POST' || !request.url.includes('/mcp')) return;
    let body = null;
    try {
      body = JSON.parse(request.postData ?? 'null');
    } catch {
      return;
    }
    if (body?.method !== 'tools/call') return;
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
    if (!call) return;
    requestMap.delete(message.params.requestId);
    call.ms = Date.now() - call.at;
    cdp
      .send('Network.getResponseBody', { requestId: message.params.requestId })
      .then((result) => {
        const body = result?.body ?? '';
        let text = body;
        try {
          const line = body
            .split(/\r?\n/)
            .reverse()
            .find((one) => one.startsWith('data:'));
          const parsed = JSON.parse(line ? line.slice(5) : body);
          call.isError = parsed?.result?.isError === true;
          text = (parsed?.result?.content ?? [])
            .map((i) => i?.text ?? '')
            .join('\n');
        } catch {
          // raw
        }
        call.chars = text.length;
        call.result = text.slice(0, 300);
      })
      .catch(() => {});
  }
});

const getState = () => cdp.evaluate(STATE);
async function waitFor(check, timeoutMs, stepMs = 400) {
  const started = Date.now();
  for (;;) {
    const state = await getState();
    if (check(state)) return state;
    if (Date.now() - started > timeoutMs) return null;
    await sleep(stepMs);
  }
}
const botCount = (state) => state.cues.filter((c) => c.author === 'bot').length;

// Done: what this file already holds, so a restart carries on.
const done = new Set();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    try {
      const row = JSON.parse(line);
      if (row.type === 'scenario' && !row.error)
        done.add(`${row.scenario}|${row.model}`);
    } catch {
      // partial
    }
  }
}
// Kept on disk: the window's pace cap counts every round of the hour, across
// runs, and a run that forgets the last one's rounds trips it.
const ROUNDS_FILE = path.join(WORK_DIR, 'elder-rounds.json');
const roundsLog = (() => {
  try {
    return JSON.parse(fs.readFileSync(ROUNDS_FILE, 'utf8'));
  } catch {
    return [];
  }
})();
const saveRounds = () => {
  try {
    fs.writeFileSync(
      ROUNDS_FILE,
      JSON.stringify(roundsLog.filter((r) => r.at > Date.now() - 3600_000)),
    );
  } catch {}
};
function roundsLastHour() {
  const since = Date.now() - 3600_000;
  return roundsLog
    .filter((r) => r.at > since)
    .reduce((sum, r) => sum + r.rounds, 0);
}
async function pace() {
  for (;;) {
    const used = roundsLastHour();
    if (used < PACE) return;
    log(`pacing: ${used} model rounds in the last hour; waiting`);
    await sleep(30000);
    if (fs.existsSync(STOP_FILE)) return;
  }
}

let tab = null;
async function openTab() {
  let state = await getState();
  if (state.isHeadFolded) {
    await cdp.evaluate(CLICK('.chat-head-fold'));
    await sleep(400);
    state = await getState();
  }
  if (state.tabCount >= 12) throw new Error('twelve tabs already');
  await cdp.evaluate(CLICK('.chat-tab-add'));
  const after = await waitFor(
    (s) =>
      s.tabCount === state.tabCount + 1 &&
      s.activeTab === s.tabCount - 1 &&
      s.cues.length === 0 &&
      !s.isBusy,
    6000,
    150,
  );
  if (!after) throw new Error('new tab did not open');
  tab = { index: after.activeTab, count: after.tabCount, first: null };
}
async function closeTab() {
  if (!tab) return;
  const state = await getState();
  const first = state.cues.find((c) => c.author === 'you');
  const isOurs =
    state.tabCount === tab.count &&
    state.activeTab === tab.index &&
    (tab.first === null ||
      (first &&
        first.text
          .replace(/\s+/g, ' ')
          .trim()
          .startsWith(tab.first.replace(/\s+/g, ' ').trim().slice(0, 20))));
  if (!isOurs) {
    log(
      'NOT closing: the tab in front is not this run’s',
      JSON.stringify({
        tab,
        count: state.tabCount,
        active: state.activeTab,
        first: first?.text?.slice(0, 40),
      }),
    );
    tab = null;
    return;
  }
  if (state.isBusy) {
    await cdp.evaluate(CLICK('.chat-stop'));
    await sleep(1500);
  }
  await cdp.evaluate(CLICK('.chat-tab.is-on .chat-tab-close'));
  await waitFor((s) => s.tabCount === tab.count - 1, 6000, 150);
  tab = null;
}

async function pick(kind, wanted) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await cdp.evaluate(PICK(kind, wanted));
    if (!result.ok) return result;
    if (result.already) return result;
    await sleep(400);
  }
  return { ok: true };
}

async function waitAnswer(beforeBots, timeoutMs = ANSWER_TIMEOUT_MS) {
  // A question cue first, then idle with a new bot cue last.
  const final = await waitFor(
    (s) =>
      !s.isBusy &&
      botCount(s) > beforeBots &&
      s.cues[s.cues.length - 1].author === 'bot',
    timeoutMs,
    700,
  );
  return final;
}

function summariseScreens(screens) {
  return JSON.stringify({
    any: screens?.isAnyShowing ?? null,
    ids: screens?.showingScreenIds ?? null,
    held: (screens?.screens ?? []).map((s) => [
      s.screenId,
      s.isShowing,
      s.bible?.reference ?? null,
      s.slide?.name ?? null,
      (s.foreground ?? []).length,
    ]),
  });
}

async function runStep(step, record) {
  const before = await getState();
  const beforeBots = botCount(before);
  const started = Date.now();
  if (step.ask !== undefined) {
    await pace();
    record.sent = step.ask;
    const sent = await cdp.evaluate(TYPE_AND_SEND(step.ask));
    record.submit = sent;
    if (tab.first === null && step.ask.trim().length > 0) tab.first = step.ask;
    if (step.interrupt) {
      await sleep(step.interrupt.afterMs);
      const mid = await getState();
      record.interrupt = { text: step.interrupt.text, wasBusy: mid.isBusy };
      const second = await cdp.evaluate(TYPE_AND_SEND(step.interrupt.text));
      await sleep(800);
      const after = await getState();
      record.interrupt.submit = second;
      record.interrupt.inputAfter = after.inputValue;
      record.interrupt.youCuesAfter = after.cues.filter(
        (c) => c.author === 'you',
      ).length;
    }
    if (step.stopAfterMs) {
      await sleep(step.stopAfterMs);
      const mid = await getState();
      record.stop = { wasBusy: mid.isBusy };
      await cdp.evaluate(CLICK('.chat-stop'));
      await sleep(1500);
    }
    if (step.maybeNothing) {
      await sleep(5000);
      const s = await getState();
      record.nothingSent = botCount(s) === beforeBots && !s.isBusy;
      if (record.nothingSent) {
        record.seconds = (Date.now() - started) / 1000;
        record.inputAfter = s.inputValue;
        return s;
      }
    }
  } else if (step.press !== undefined) {
    const pressed = await cdp.evaluate(PRESS(step.press, step.fallback, 'bot'));
    record.press = pressed;
    if (!pressed.ok) {
      record.seconds = 0;
      return before;
    }
  } else if (step.askAgain) {
    await pace();
    const pressed = await cdp.evaluate(
      PRESS('^(សួរម្ដងទៀត|Ask again)$', null, 'you'),
    );
    record.press = pressed;
    await sleep(600);
    const s = await getState();
    record.inputAfterAskAgain = s.inputValue;
    if (!s.isBusy && botCount(s) === beforeBots) {
      record.submitAsIs = await cdp.evaluate(SUBMIT_AS_IS);
    }
  } else if (step.thumbsDown) {
    const pressed = await cdp.evaluate(
      PRESS('^(ចម្លើយមិនល្អ|Bad answer)$', null, 'bot'),
    );
    record.press = pressed;
    await sleep(2500);
    const s = await getState();
    record.seconds = (Date.now() - started) / 1000;
    const last = s.cues[s.cues.length - 1];
    record.afterThumb = {
      cues: s.cues.length - before.cues.length,
      lastAuthor: last?.author,
      lastText: last?.text?.slice(0, 600),
      buttons: last?.buttons,
    };
    if (s.isBusy) {
      const fin = await waitAnswer(beforeBots);
      return fin ?? (await getState());
    }
    return s;
  }
  // Wait for what that started: an answer, or nothing for a press that only
  // opened something in the app.
  let final = null;
  if (step.press !== undefined) {
    await sleep(1500);
    const s = await getState();
    if (s.isBusy || botCount(s) > beforeBots) {
      final = await waitAnswer(beforeBots);
    } else {
      final = s;
      record.noNewAnswer = true;
    }
  } else {
    final = await waitAnswer(beforeBots);
  }
  record.seconds = Math.round((Date.now() - started) / 100) / 10;
  if (final === null) {
    record.timedOut = true;
    await cdp.evaluate(CLICK('.chat-stop'));
    await sleep(2000);
    final = await getState();
  }
  if (final.loadedAt !== before.loadedAt) record.reloaded = true;
  return final;
}

const stats = { steps: 0 };
const order = [];
for (const scenario of SCENARIOS) {
  if (
    typeof args.only === 'string' &&
    !args.only.split(',').some((id) => scenario.id.startsWith(id))
  )
    continue;
  for (const model of MODELS) order.push({ scenario, model });
}
log(
  `elder run: ${order.length} scenario runs on ${SERVER} (${MODELS.join(', ')}), already done ${done.size}`,
);
const startPage =
  (await mcp.call('owa_app_state', {}))?.mainWindow?.page ?? 'reader.html';
let undoBefore = await mcp.call('owa_undo', { action: 'list' });

for (const { scenario, model } of order) {
  if (fs.existsSync(STOP_FILE)) {
    log('STOP file; leaving');
    break;
  }
  if (done.has(`${scenario.id}|${model}`)) continue;
  const summary = {
    type: 'scenario',
    runId: RUN_ID,
    scenario: scenario.id,
    kind: scenario.kind,
    model,
    at: new Date().toISOString(),
  };
  const screensBefore = summariseScreens(
    await mcp.call('owa_list_screens', {}),
  );
  try {
    await openTab();
    const pair = toPair(model);
    const assistant = await pick('assistant', pair.server);
    if (!assistant.ok)
      throw new Error('assistant: ' + JSON.stringify(assistant));
    await sleep(300);
    if (pair.model !== null) {
      const picked = await pick('model', pair.model);
      if (!picked.ok) throw new Error('model: ' + JSON.stringify(picked));
    }
    const focus = await pick('focus', FOCUS_INDEX[scenario.focus ?? 'reader']);
    if (!focus.ok) throw new Error('focus: ' + JSON.stringify(focus));
    await sleep(300);
    let stepIndex = 0;
    for (const step of scenario.steps) {
      stepIndex += 1;
      toolCalls = [];
      pageErrors = [];
      const record = {
        type: 'step',
        runId: RUN_ID,
        scenario: scenario.id,
        kind: scenario.kind,
        model,
        step: stepIndex,
      };
      let final;
      try {
        final = await runStep(step, record);
      } catch (error) {
        record.error = error.message;
        final = await getState();
      }
      await sleep(500);
      const bots = final.cues.filter((c) => c.author === 'bot');
      const last = bots[bots.length - 1] ?? null;
      record.answer = last?.text ?? '';
      record.note = last?.note ?? null;
      record.actions = last?.actions ?? [];
      record.replies = last?.replies ?? [];
      record.buttons = last?.buttons ?? [];
      record.cost = last?.cost ?? null;
      record.usage = parseUsage(last?.costFull);
      record.costFull = last?.costFull ?? null;
      // Who answered: the cost hover's first line names the server and
      // model (Auto picks one per question).
      record.answeredBy =
        (record.costFull ?? '')
          .split('\n')
          .find((one) => one.includes('·'))
          ?.replace(/^[^:：៖]*[:：៖]\s*/, '') ?? null;
      record.alert = final.alert;
      record.tools = toolCalls.map((c) => ({
        name: c.name,
        args: c.args,
        ms: c.ms,
        chars: c.chars,
        isError: c.isError || undefined,
        result: c.result,
      }));
      record.pageErrors = pageErrors.slice(0, 10);
      record.script = scriptMix(`${record.answer} ${record.note ?? ''}`);
      record.leak = (LEAK.exec(`${record.answer}\n${record.note ?? ''}`) ?? [
        null,
      ])[0];
      record.errorWords = (ERROR_WORDS.exec(
        `${record.answer}\n${record.note ?? ''}`,
      ) ?? [null])[0];
      record.paused = /ខ្ញុំបានផ្អាកជំនួយការ|I have paused the assistant/.test(
        `${record.note ?? ''} ${record.answer}`,
      );
      if (step.expect) {
        const opened = openedRefs(record.buttons);
        record.opened = opened;
        const quoted = [
          ...`${record.answer}`.matchAll(/\b((?:[1-3] )?[A-Z][a-z]+ \d+:\d+)/g),
        ].map((m) => m[1]);
        record.quotedRefs = [...new Set(quoted)];
        const want = step.expect.map(normRef);
        record.found = opened.some((ref) => want.includes(normRef(ref)));
        record.foundInText = record.quotedRefs.some((ref) =>
          want.includes(normRef(ref)),
        );
      }
      if (step.expectWords) {
        record.foundWords = step.expectWords.every((w) =>
          record.answer.includes(w),
        );
      }
      if (record.usage)
        roundsLog.push({ at: Date.now(), rounds: record.usage.rounds });
      else if (step.ask !== undefined)
        roundsLog.push({ at: Date.now(), rounds: 1 });
      saveRounds();
      fs.appendFileSync(OUT, JSON.stringify(record) + '\n');
      stats.steps += 1;
      log(
        `[${scenario.id} · ${model} · ${stepIndex}]`,
        record.error ? `ERROR ${record.error}` : '',
        `${record.seconds ?? '?'}s r${record.usage?.rounds ?? '?'} ${record.usage ? record.usage.input + record.usage.cacheRead : '?'}tok`,
        `tools=${record.tools.map((t) => t.name.replace('owa_', '')).join('>')}`,
        record.found === undefined
          ? ''
          : `found=${record.found}${record.foundInText ? '/text' : ''}`,
        record.leak ? `LEAK=${record.leak}` : '',
        record.pageErrors.length ? `PAGEERR=${record.pageErrors.length}` : '',
        record.timedOut ? 'TIMEOUT' : '',
        `| ${record.answer.replace(/\s+/g, ' ').slice(0, 110)}`,
      );
      if (record.paused) {
        // The user's own word, 2026-10-17: "I grant you all
        // permission do not wait for me to click" -- for this
        // benchmark on the dev app, every assistant at $0.
        if (args['allow-more'] !== true) {
          log(
            'STOPPING: the spend guard paused the assistant; a person must press Allow more',
          );
          summary.paused = true;
          break;
        }
        const pressed = await cdp.evaluate(`(() => {
                    const button = [...(document.querySelector('.chat-head')?.querySelectorAll('button') ?? [])]
                        .find((b) => /អនុញ្ញាតបន្ថែម|Allow more/.test(b.textContent));
                    if (!button) return false;
                    button.click();
                    return true;
                })()`);
        log(`ALLOW MORE pressed by the driver (user-authorized): ${pressed}`);
        summary.allowMorePressed = (summary.allowMorePressed ?? 0) + 1;
        roundsLog.length = 0;
        saveRounds();
        await sleep(3000);
        // The paused step was answered by the guide: asked again
        // in a tab of its own on the next start of this scenario.
        summary.error = 'paused; asked again';
        break;
      }
      if (record.reloaded) {
        summary.reloaded = true;
        summary.error = 'reloaded; asked again';
        break;
      }
    }
  } catch (error) {
    summary.error = error.message;
    log(`[${scenario.id} · ${model}] SCENARIO ERROR ${error.message}`);
  }
  // What the conversation left behind in the app: a walkthrough card, a
  // page the main window moved to, a screen, a data change.
  try {
    const guide = await mcp.call('owa_guide_status', {});
    if (guide?.isRunning) {
      summary.guide = {
        title: guide.title,
        steps: guide.stepCount,
        step: guide.stepIndex,
      };
      await mcp.call('owa_guide_step', { action: 'stop' });
    }
    const screensAfter = summariseScreens(
      await mcp.call('owa_list_screens', {}),
    );
    if (screensAfter !== screensBefore)
      summary.screens = { before: screensBefore, after: screensAfter };
    const appState = await mcp.call('owa_app_state', {});
    summary.mainPage = appState?.mainWindow?.page ?? null;
    if (summary.mainPage && summary.mainPage !== startPage) {
      summary.pageMoved = summary.mainPage;
      await mcp.call('owa_goto_page', { page: startPage });
      await sleep(2000);
    }
    const undoAfter = await mcp.call('owa_undo', { action: 'list' });
    if (JSON.stringify(undoAfter) !== JSON.stringify(undoBefore)) {
      summary.dataChanged = JSON.stringify(undoAfter).slice(0, 800);
      undoBefore = undoAfter;
    }
  } catch (error) {
    summary.afterError = error.message;
  }
  try {
    await closeTab();
  } catch (error) {
    summary.closeError = error.message;
  }
  fs.appendFileSync(OUT, JSON.stringify(summary) + '\n');
  if (summary.paused) break;
}
log('done; steps', stats.steps);
cdp.socket.close();
process.exit(0);
