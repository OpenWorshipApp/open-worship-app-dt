// The names-lookup run (2026-10-22, the user's ask with the Reader's Names and
// Places row menu circled on **Open in Chatbot**: _make the chatbot to be
// super smart that can answer everything about location/name_). Where
// `elder-run.mjs` drives conversations typed in the ordinary box, this one
// opens the conversation the way that menu does -- the same handoff the
// row's press leaves (`chatbot-handoff-lookup`, `requestChatbotLookup`) --
// and then asks a scenario's questions in that tab, in order
// (`../references/lookup-khmer-asks.json`).
//
// A scenario's `record` is a person or a place by name, or -- since
// 2026-10-23, `../references/passage-khmer-asks.json` -- a passage by its
// verse key, title and Bible, handed over as a Bible view's 🤖 does. An
// ask is typed (`text`) or PRESSED (`press`, the same day,
// `../references/word-study-asks.json`): the newest answer's button whose
// words are that, else start with it, else hold it, compared in NFC -- a
// word is learned by its button, and a Bible writes ά as U+1F71.
//
//   node lookup-run.mjs --pid=<published pid> [--server="Local Ollama"]
//        [--model=gemma4:cloud] [--only=noah,A3] [--timeout=300]
//        [--scenarios=<file>] [--out=<file>]
//
// One JSON line an answer: the words, the buttons, the cost line, every tool
// the window called and how long it took. `expect` rides along for the
// grader and is never sent.
//
// The rules it keeps:
// - Aimed at ONE instance by its published pid -- a scratch profile beside
//   the user's app (memory `scratch-dev-instance-beside-user-app`). It writes
//   the handoff into THAT instance's data folder and nowhere else.
// - The row's press asks the AI caution first; a script cannot answer it,
//   so it leaves the handoff the press would leave, and the window takes it
//   on its focus event (`takeHandoff`), as it does after the press. Open the
//   window itself first through the taskbar route (`--owa-open-chatbot`),
//   which asks no caution by the user's word.
// - Only what a scenario names is pressed, and only in its own tab: the
//   rest of the conversation is typed, as a person types it.
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
const SERVER = args.server ?? 'Local Ollama';
const MODEL = args.model ?? 'gemma4:cloud';
const ANSWER_TIMEOUT_MS = Number(args.timeout ?? 300) * 1000;
const ONLY = args.only ? String(args.only).split(',') : null;
const OUT = path.resolve(
  args.out ??
    path.join(
      REPO,
      'test-results',
      'chatbot-quality',
      `lookup-${new Date().toISOString().slice(0, 10)}.jsonl`,
    ),
);
const SCENARIOS = JSON.parse(
  fs.readFileSync(
    path.resolve(
      args.scenarios ??
        path.join(HERE, '..', 'references', 'lookup-khmer-asks.json'),
    ),
    'utf8',
  ),
).scenarios;
const RUN_ID = new Date().toISOString();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => {
  console.log(`${new Date().toTimeString().slice(0, 8)} ${parts.join(' ')}`);
};

// ---- the instance ------------------------------------------------------------

if (!args.pid) {
  console.log('Pass --pid=<the published pid of the instance to drive>.');
  process.exit(2);
}
const info = JSON.parse(
  fs.readFileSync(
    path.join(os.tmpdir(), 'open-worship-app-cdp', `${args.pid}.json`),
    'utf8',
  ),
);
const setting = JSON.parse(
  fs.readFileSync(path.join(info.userDataPath, 'setting.json'), 'utf8'),
);
const DATA_DIR = setting.clientSetting?.['selected-parent-dir'];
if (typeof DATA_DIR !== 'string' || !fs.existsSync(DATA_DIR)) {
  console.log('The instance has no data folder to leave the handoff in.');
  process.exit(2);
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
          if (message.error) entry.reject(new Error(message.error.message));
          else entry.resolve(message.result);
          return;
        }
        for (const listener of this.listeners) listener(message);
      });
    });
    return this;
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    }
    return result.result?.value;
  }
}

let mcpSession = null;
let mcpCount = 0;
async function mcpPost(body) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${info.mcpToken}`,
  };
  if (mcpSession) headers['mcp-session-id'] = mcpSession;
  const res = await fetch(info.mcpUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) mcpSession = sid;
  if (res.status === 202) return null;
  const text = await res.text();
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((one) => one.startsWith('data:'));
  return JSON.parse(line ? line.slice(5) : text);
}
async function callTool(name, toolArgs) {
  if (mcpSession === null) {
    await mcpPost({
      jsonrpc: '2.0',
      id: ++mcpCount,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'owa-lookup-run', version: '0.1.0' },
      },
    });
    await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  }
  const out = await mcpPost({
    jsonrpc: '2.0',
    id: ++mcpCount,
    method: 'tools/call',
    params: { name, arguments: toolArgs },
  });
  const text = (out?.result?.content ?? [])
    .filter((one) => one.type === 'text')
    .map((one) => one.text)
    .join('\n');
  return JSON.parse(text);
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
            cost: cost ? cost.innerText.trim() : null,
            costFull: cost ? cost.getAttribute('title') : null,
        };
    });
    return {
        isBusy: document.querySelector('.chat-stop') !== null || document.querySelector('.chat-progress') !== null,
        progress: [...document.querySelectorAll('.chat-progress .chat-status')].map((p) => p.innerText.trim()),
        tabCount: document.querySelectorAll('.chat-tab').length,
        cues,
    };
})()`;

// The head row's pickers by what they hold (their labels are translated).
const PICK = (wanted) => `(() => {
    const selects = [...document.querySelectorAll('.chat-head-row select')];
    for (const s of selects) {
        const found = [...s.options].find((o) => o.textContent.trim().replace(/\\u200b/g, '') === ${JSON.stringify(wanted)});
        if (!found) continue;
        if (s.value === found.value) return { ok: true, already: true };
        const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        set.call(s, found.value);
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
    }
    return { ok: false, options: selects.map((s) => [...s.options].map((o) => o.textContent.trim())) };
})()`;

// The tab in front, closed only when it is the one the scenario opened --
// named by its record -- so a person's tab is never what goes.
const CLOSE_OWN_TAB = (title) => `(() => {
    const tab = document.querySelector('.chat-tab.is-on');
    const name = tab?.querySelector('.chat-tab-name')?.textContent.trim();
    if (!tab || name !== ${JSON.stringify(title)}) return { ok: false, name };
    tab.querySelector('.chat-tab-close')?.click();
    return { ok: true };
})()`;

const TYPE_AND_SEND = (text) => `(() => {
    const input = document.querySelector('textarea.chat-input');
    const form = document.querySelector('form.chat-ask');
    if (!input || !form) return { ok: false, reason: 'no form' };
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
    set.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return { ok: true };
})()`;

// A button pressed rather than words typed (2026-10-23, the word study: a
// word is learned by its button, `word-study-asks.json`). The newest
// answer's button whose words ARE the needle, else start with it, else hold
// it -- "Next word: אֵ֥ת" holds the word -- then the next answer's.
const PRESS = (needle) => `(() => {
    // NFC on both sides: a Bible writes ά as U+1F71, which a copy of the
    // word into a file comes back as U+03AC.
    const clean = (text) => text.replace(/\\u200b/g, '').trim().normalize('NFC');
    const wanted = clean(${JSON.stringify(needle)});
    const cues = [...document.querySelectorAll('.chat-cues article.cue')]
        .filter((cue) => !cue.classList.contains('cue-you'))
        .reverse();
    for (const cue of cues) {
        const buttons = [...cue.querySelectorAll('.cue-actions .cue-act')];
        const found =
            buttons.find((b) => clean(b.textContent) === wanted) ??
            buttons.find((b) => clean(b.textContent).startsWith(wanted)) ??
            buttons.find((b) => clean(b.textContent).includes(wanted));
        if (found) {
            found.click();
            return { ok: true, pressed: clean(found.textContent) };
        }
    }
    return {
        ok: false,
        labels: [...(cues[0]?.querySelectorAll('.cue-actions .cue-act') ?? [])]
            .map((b) => clean(b.textContent)),
    };
})()`;

// ---- the run -----------------------------------------------------------------

const pages = await (await fetch(`${info.url}/json/list`)).json();
const chatTarget = pages.find(
  (page) => page.type === 'page' && page.url.includes('chatbot.html'),
);
const readerPage = pages.find(
  (page) => page.type === 'page' && /reader\.html|presenter\.html/.test(page.url),
);
if (!chatTarget) {
  console.log('The help window is not open: start it with --owa-open-chatbot.');
  process.exit(2);
}
const cdp = await new Cdp(chatTarget).open();
await cdp.send('Network.enable', { maxPostDataSize: 65536 });

let toolCalls = [];
const requestMap = new Map();
cdp.listeners.add((message) => {
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
        try {
          const line = body
            .split(/\r?\n/)
            .reverse()
            .find((one) => one.startsWith('data:'));
          const parsed = JSON.parse(line ? line.slice(5) : body);
          call.isError = parsed?.result?.isError === true;
          const text = (parsed?.result?.content ?? [])
            .map((one) => one?.text ?? '')
            .join('\n');
          call.chars = text.length;
          call.result = text.slice(0, 400);
        } catch {
          call.result = body.slice(0, 400);
        }
      })
      .catch(() => {});
  }
});

async function waitFor(check, timeoutMs, stepMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await cdp.evaluate(STATE);
    if (check(state)) return state;
    await sleep(stepMs);
  }
  return null;
}

const outStream = fs.createWriteStream(OUT, { flags: 'a' });
const write = (row) => outStream.write(`${JSON.stringify(row)}\n`);
log('writing', OUT);

for (const scenario of SCENARIOS) {
  const asks = scenario.asks.filter((ask) => {
    return ONLY === null || ONLY.includes(scenario.id) || ONLY.includes(ask.id);
  });
  if (asks.length === 0) continue;
  const { record } = scenario;
  // A passage is handed over as a Bible view's robot hands it
  // (`bibleItemAskHelpers.ts`: the verse key, the title as the view writes
  // it, its Bible); a person or a place is found by name first, as the
  // row's Open in Chatbot has its id (`openLookupRecordInChatbot`).
  const found =
    record.kind === 'verse'
      ? { id: record.target, name: record.title }
      : await callTool('owa_lookup_record', {
          kind: record.kind,
          name: record.name,
          lang: record.lang,
          ...(readerPage ? { page: readerPage.url } : {}),
        });
  if (!found?.id) {
    log(scenario.id, 'record not found', JSON.stringify(found).slice(0, 200));
    write({ runId: RUN_ID, scenario: scenario.id, error: 'record not found' });
    continue;
  }
  fs.writeFileSync(
    path.join(DATA_DIR, 'local-storage', 'chatbot-handoff-lookup'),
    JSON.stringify({
      kind: record.kind,
      target: found.id,
      title: found.name,
      ...(record.kind === 'verse'
        ? { bibleKey: record.bibleKey }
        : { langCode: record.lang }),
      ...(readerPage ? { page: readerPage.url } : {}),
      at: Date.now(),
    }),
  );
  const before = await cdp.evaluate(STATE);
  // At the strip's cap the window reuses a tab, and nothing here could tell
  // the conversation was its own.
  if (before.tabCount >= 12) {
    log('the help window has 12 tabs: close some, then run again');
    process.exit(2);
  }
  await cdp.evaluate(`window.dispatchEvent(new Event('focus'))`);
  const opened = await waitFor(
    (state) =>
      state.tabCount > before.tabCount &&
      !state.isBusy &&
      state.cues.some((cue) => cue.author === 'bot'),
    60000,
  );
  if (opened === null) {
    log(scenario.id, 'no conversation opened');
    write({ runId: RUN_ID, scenario: scenario.id, error: 'not opened' });
    continue;
  }
  const card = opened.cues[opened.cues.length - 1];
  log(scenario.id, 'opened:', card.text.slice(0, 120).replace(/\n/g, ' '));
  const pickedServer = await cdp.evaluate(PICK(SERVER));
  await sleep(500);
  const pickedModel = await cdp.evaluate(PICK(MODEL));
  // A head row folded to one line draws no picker at all (2026-10-23, the
  // user's own window): the tab's own assistant answers, and each answer's
  // footer (`costFull`) says which one it was.
  const isPickerHidden =
    pickedServer.options?.length === 0 && pickedModel.options?.length === 0;
  if (isPickerHidden) {
    log('no assistant picker drawn: the tab keeps its own assistant');
  } else if (!pickedServer.ok || !pickedModel.ok) {
    log('could not pick', SERVER, MODEL, JSON.stringify(pickedServer));
    process.exit(2);
  }
  write({
    runId: RUN_ID,
    scenario: scenario.id,
    recordId: found.id,
    title: found.name,
    card: card.text,
    cardActions: card.actions,
    cardReplies: card.replies,
  });
  for (const ask of asks) {
    const start = await cdp.evaluate(STATE);
    toolCalls = [];
    const startedAt = Date.now();
    let pressed = null;
    if (ask.press !== undefined) {
      pressed = await cdp.evaluate(PRESS(ask.press));
      if (!pressed.ok) {
        log(ask.id, 'no button', ask.press, JSON.stringify(pressed.labels));
        write({
          runId: RUN_ID,
          scenario: scenario.id,
          id: ask.id,
          press: ask.press,
          error: 'no button',
          labels: pressed.labels,
        });
        continue;
      }
    } else {
      await cdp.evaluate(TYPE_AND_SEND(ask.text));
    }
    // A press the window answers by itself writes no echo of a question:
    // one new answer, settled, is its reply.
    const done = await waitFor(
      (state) =>
        !state.isBusy &&
        state.cues.length >= start.cues.length + (pressed ? 1 : 2) &&
        state.cues[state.cues.length - 1].author === 'bot',
      ANSWER_TIMEOUT_MS,
      1500,
    );
    const seconds = Math.round((Date.now() - startedAt) / 100) / 10;
    const state = done ?? (await cdp.evaluate(STATE));
    const answers = state.cues
      .slice(start.cues.length)
      .filter((cue) => cue.author === 'bot');
    const last = answers[answers.length - 1] ?? null;
    write({
      runId: RUN_ID,
      scenario: scenario.id,
      id: ask.id,
      ask: ask.text ?? null,
      press: pressed?.pressed ?? null,
      expect: ask.expect,
      ...(ask.words ? { expectWords: ask.words } : {}),
      seconds,
      isTimeout: done === null,
      text: last?.text ?? null,
      note: last?.note ?? null,
      actions: last?.actions ?? [],
      replies: last?.replies ?? [],
      cost: last?.cost ?? null,
      costFull: last?.costFull ?? null,
      tools: toolCalls.map((call) => ({
        name: call.name,
        args: call.args,
        ms: call.ms,
        isError: call.isError,
        chars: call.chars,
        result: call.result,
      })),
    });
    log(
      ask.id,
      `${seconds}s`,
      done === null ? 'TIMEOUT' : '',
      `tools=${toolCalls.map((call) => call.name).join(',')}`,
      '|',
      (last?.text ?? '').slice(0, 140).replace(/\n/g, ' '),
    );
  }
  if (args['keep-tabs'] !== true) {
    const closed = await cdp.evaluate(CLOSE_OWN_TAB(found.name));
    if (!closed.ok) log(scenario.id, 'left its tab open:', closed.name);
  }
}
outStream.end();
log('done');
process.exit(0);
