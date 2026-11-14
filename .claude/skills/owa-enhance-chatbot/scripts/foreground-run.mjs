// The foreground ask set (references/foreground-asks.json), asked through the
// REAL help window of a SCRATCH development instance, each scenario in a tab
// of its own; every change a scenario made is undone at its end.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/foreground-run.mjs \
//     --pid=<the scratch app's pid> [--only=countdown,C1] [--out=x.jsonl] \
//     [--timeout=240] [--gap=60] [--profile=scratchpad]
//
// Refuses an instance whose data folder path lacks --profile (default
// `scratchpad`): it starts, changes and clears foreground extras, and hides a
// screen an answer turned on. The help window must be open (its caution is a
// person's press, or the user's say-so on a dev instance). Each record carries
// what the answer said and pressed, its tools, the screens after it, a stall's
// progress lines and `undoClaimedWithoutButton` (EC-530). Mind the spend
// guard: 150 model calls an hour pauses the assistant until a person presses
// Allow more -- the whole set is ~70 rounds.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ANSWER_TIMEOUT_MS = Number(args.timeout ?? 240) * 1000;
const ONLY = args.only ? String(args.only).split(',') : null;
const OUT = path.resolve(
  args.out ??
    path.join(
      process.cwd(),
      'test-results',
      'chatbot-quality',
      `foreground-${Date.now()}.jsonl`,
    ),
);
const SCENARIOS = JSON.parse(
  fs.readFileSync(
    path.resolve(
      args.scenarios ??
        path.join(HERE, '..', 'references', 'foreground-asks.json'),
    ),
    'utf8',
  ),
).scenarios;
const RUN_ID = new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...p) =>
  console.log(`${new Date().toTimeString().slice(0, 8)} ${p.join(' ')}`);
const info = JSON.parse(
  fs.readFileSync(
    path.join(os.tmpdir(), 'open-worship-app-cdp', `${args.pid}.json`),
    'utf8',
  ),
);
if (
  !info.isDev ||
  !info.userDataPath.includes(String(args.profile ?? 'scratchpad'))
) {
  console.log('not a scratch development instance:', info.userDataPath);
  process.exit(2);
}
const setting = JSON.parse(
  fs.readFileSync(path.join(info.userDataPath, 'setting.json'), 'utf8'),
);
const DATA_DIR = setting.clientSetting?.['selected-parent-dir'];
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
// it -- "Next word: <the word>" holds the word -- then the next answer's.
const PRESS = (needle) => `(() => {
    // NFC on both sides: a Bible writes a Greek alpha with an acute as
    // U+1F71, which a copy of the word into a file comes back as U+03AC.
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

const CLOSE_TAB_BY_INDEX = (index) => `(() => {
    const tabs = [...document.querySelectorAll('.chat-tab')];
    const tab = tabs[${index}];
    if (!tab || !tab.classList.contains('is-on')) return { ok: false };
    tab.querySelector('.chat-tab-close')?.click();
    return { ok: true };
})()`;

const pages = await (await fetch(`${info.url}/json/list`)).json();
const chatTarget = pages.find(
  (page) => page.type === 'page' && page.url.includes('chatbot.html'),
);
if (!chatTarget) {
  console.log('help window not open');
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
async function tool(name, a = {}) {
  try {
    return await callTool(name, a);
  } catch (e) {
    return { error: String(e.message) };
  }
}
const outStream = fs.createWriteStream(OUT, { flags: 'a' });
const write = (row) => outStream.write(`${JSON.stringify(row)}\n`);
log('writing', OUT);
for (const scenario of SCENARIOS) {
  const asks = scenario.asks.filter(
    (a) => ONLY === null || ONLY.includes(scenario.id) || ONLY.includes(a.id),
  );
  if (asks.length === 0) continue;
  const undoBefore = new Set(
    ((await tool('owa_undo', { action: 'list' })).changes ?? []).map(
      (c) => c.id,
    ),
  );
  const before = await cdp.evaluate(STATE);
  if (before.tabCount >= 12) {
    log('12 tabs');
    process.exit(2);
  }
  if (scenario.handoff) {
    fs.writeFileSync(
      path.join(DATA_DIR, 'local-storage', 'chatbot-handoff-foreground'),
      JSON.stringify({ ...scenario.handoff, at: Date.now() }),
    );
    await cdp.evaluate(`window.dispatchEvent(new Event('focus'))`);
    const opened = await waitFor(
      (s) =>
        s.tabCount > before.tabCount &&
        !s.isBusy &&
        s.cues.some((c) => c.author === 'bot'),
      60000,
    );
    if (!opened) {
      log(scenario.id, 'handoff not taken');
      write({
        runId: RUN_ID,
        scenario: scenario.id,
        error: 'handoff not taken',
      });
      continue;
    }
    const card = opened.cues[opened.cues.length - 1];
    write({
      runId: RUN_ID,
      scenario: scenario.id,
      card: card.text,
      cardActions: card.actions,
      cardReplies: card.replies,
    });
    log(
      scenario.id,
      'card:',
      card.text.slice(0, 120).replace(/\n/g, ' '),
      '|',
      card.replies.join(' / '),
    );
  } else {
    await cdp.evaluate(`document.querySelector('.chat-tab-add')?.click()`);
    const opened = await waitFor(
      (s) => s.tabCount > before.tabCount,
      10000,
      300,
    );
    if (!opened) {
      log(scenario.id, 'no new tab');
      process.exit(2);
    }
  }
  await sleep(800);
  const picked = await cdp.evaluate(PICK('Auto'));
  if (!picked.ok) {
    log('could not pick Auto', JSON.stringify(picked));
  }
  const tabIndex = await cdp.evaluate(
    `[...document.querySelectorAll('.chat-tab')].findIndex((t) => t.classList.contains('is-on'))`,
  );
  for (const ask of asks) {
    const start = await cdp.evaluate(STATE);
    toolCalls = [];
    const startedAt = Date.now();
    let pressed = null;
    if (ask.press !== undefined) {
      pressed = await cdp.evaluate(PRESS(ask.press));
      if (!pressed.ok) {
        const replies = start.cues[start.cues.length - 1]?.replies ?? [];
        const r = await cdp.evaluate(
          `(() => { const b = [...document.querySelectorAll('.cue-replies .cue-reply')].reverse().find((x) => x.textContent.trim() === ${JSON.stringify(ask.press)}); if (!b) return { ok: false }; b.click(); return { ok: true, pressed: b.textContent.trim() }; })()`,
        );
        if (!r.ok) {
          log(
            ask.id,
            'no button',
            ask.press,
            JSON.stringify(pressed.labels),
            JSON.stringify(replies),
          );
          write({
            runId: RUN_ID,
            scenario: scenario.id,
            id: ask.id,
            error: 'no button',
            labels: pressed.labels,
            replies,
          });
          continue;
        }
        pressed = r;
      }
    } else {
      await cdp.evaluate(
        `(() => { const input = document.querySelector('textarea.chat-input'); const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set; set.call(input, ${JSON.stringify(ask.text)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`,
      );
      await sleep(400);
      const sent = await cdp.evaluate(
        `(() => { const input = document.querySelector('textarea.chat-input'); if (input.value === '') return 'empty'; document.querySelector('form.chat-ask').requestSubmit(); return 'sent'; })()`,
      );
      if (sent !== 'sent') log(ask.id, 'not sent:', sent);
    }
    const done = await waitFor(
      (s) =>
        !s.isBusy &&
        s.cues.length >= start.cues.length + (pressed ? 1 : 2) &&
        s.cues[s.cues.length - 1].author === 'bot',
      ANSWER_TIMEOUT_MS,
      1500,
    );
    let stalled = null;
    if (done === null) {
      // What the window said it was doing when the wait ran out, then Stop,
      // so the next ask is its own question and not an Add to this one.
      const hung = await cdp.evaluate(STATE);
      stalled = hung.progress;
      await cdp.evaluate(
        `(() => { const b = document.querySelector('.chat-stop'); if (b) b.click(); return !!b; })()`,
      );
      await waitFor((s) => !s.isBusy, 20000, 1000);
    }
    await sleep(800);
    const seconds = Math.round((Date.now() - startedAt) / 100) / 10;
    const state = await cdp.evaluate(STATE);
    const answers = state.cues
      .slice(start.cues.length)
      .filter((c) => c.author === 'bot');
    const last = answers[answers.length - 1] ?? null;
    const screens = await tool('owa_list_screens');
    let hidDefect = null;
    if (screens?.isAnyShowing) {
      hidDefect = screens.showingScreenIds;
      await tool('owa_hide_screens', {});
    }
    const fg = (screens?.screens ?? []).map((s) => ({
      id: s.screenId,
      on: s.isShowing,
      fg: s.foreground,
    }));
    write({
      runId: RUN_ID,
      scenario: scenario.id,
      id: ask.id,
      ask: ask.text ?? null,
      press: pressed?.pressed ?? null,
      expect: ask.expect,
      seconds,
      isTimeout: done === null,
      text: last?.text ?? null,
      note: last?.note ?? null,
      actions: last?.actions ?? [],
      replies: last?.replies ?? [],
      cost: last?.cost ?? null,
      costFull: last?.costFull ?? null,
      screensAfter: fg,
      screenTurnedOn: hidDefect,
      stalled,
      undoClaimedWithoutButton:
        /Undo this change/.test(last?.text ?? '') &&
        !(last?.actions ?? []).includes('Undo this change'),
      tools: toolCalls.map((c) => ({
        name: c.name,
        args: c.args,
        ms: c.ms,
        isError: c.isError,
        chars: c.chars,
        result: c.result,
      })),
    });
    log(
      ask.id,
      `${seconds}s`,
      done === null ? 'TIMEOUT' : '',
      hidDefect ? `SCREEN TURNED ON ${hidDefect}` : '',
      `tools=${toolCalls.map((c) => c.name + (c.args?.action ? ':' + c.args.action : '') + (c.isError ? '!' : '')).join(',')}`,
      '|',
      (last?.text ?? '').slice(0, 160).replace(/\n/g, ' '),
      '|',
      (last?.replies ?? []).join(' / '),
      '| fg:',
      JSON.stringify(fg.map((s) => s.fg)).slice(0, 200),
    );
  }
  // Put back everything this scenario changed, newest first. An undo the
  // scenario pressed is itself a change in the list, and undoing it puts
  // back up what the press took down (2026-11-13: a scenario's own Undo
  // was redone this way, its session left in the panel), so it is skipped.
  const changes = (
    (await tool('owa_undo', { action: 'list' })).changes ?? []
  ).filter((c) => !undoBefore.has(c.id) && !c.isUndone && !c.isUndo);
  for (const c of changes) {
    await tool('owa_undo', { action: 'undo', id: c.id });
  }
  const left = await tool('owa_foreground', { action: 'check' });
  if ((left?.screens ?? []).some((one) => (one.foreground ?? []).length > 0)) {
    await tool('owa_foreground', { action: 'stop', widget: 'all' });
  }
  write({
    runId: RUN_ID,
    scenario: scenario.id,
    undone: changes.map((c) => c.label ?? c.summary ?? c.id),
  });
  log(scenario.id, 'undid', changes.length);
  const closed = await cdp.evaluate(CLOSE_TAB_BY_INDEX(tabIndex));
  if (!closed.ok) log(scenario.id, 'left its tab open');
  // The firewall rations acting calls to 25 a rolling minute across
  // sessions: the model's and this driver's undo share it.
  await sleep(Number(args.gap ?? 60) * 1000);
}
outStream.end();
log('done');
process.exit(0);
