// The screen-control ask set (references/screen-asks.json), asked through the
// REAL help window of a SCRATCH development instance, each scenario in a tab
// of its own; the screen state is read before and after every ask and each
// ask's `check` is worked out from the two.
//
//   node .claude/skills/owa-enhance-chatbot/scripts/screen-run.mjs \
//     --pid=<the scratch app's pid> [--only=style,V1] [--out=x.jsonl] \
//     [--timeout=240] [--gap=45] [--profile=scratchpad] [--no-undo]
//
// Refuses an instance whose data folder path lacks --profile (default
// `scratchpad`), and one with a screen on a REAL display: the asks change the
// Bible text style, transitions, displays, groups and locks, and a screen
// shown on a monitor covers it. Put every screen on a virtual display first
// (Mini Screen ⋮ → Virtual Screens Manager → Virtual Displays → Add Virtual
// Display, then each screen's Display button): a screen shown there draws on
// no monitor. While an answer is written the screens are read every few
// seconds, and one SHOWING on a real display is hidden at once and recorded
// (`shownOnRealDisplay`). The help window must be open (its caution is a
// person's press, or the user's say-so on a dev instance).
//
// The state (`b` before, `a` after, for a `check`) is read off the setting
// files the app writes -- the Bible text style, each screen's three
// transitions, Line Sync, display, group, lock, stage and selection -- and
// `owa_list_screens` (showing, the passage). Every change the asks made
// through a tool that keeps a backup is undone at the scenario's end (newest
// first, an undo's own entry skipped), unless --no-undo; one made by pressing
// the panel has no backup, so the run reports the state left (`left`).
// Mind the spend guard: 150 model calls an hour pauses the assistant until a
// person presses Allow more -- the whole set is ~25 asks.
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
      `screen-${Date.now()}.jsonl`,
    ),
);
const SCENARIOS = JSON.parse(
  fs.readFileSync(
    path.resolve(
      args.scenarios ?? path.join(HERE, '..', 'references', 'screen-asks.json'),
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
const STORAGE_DIR = path.join(DATA_DIR, 'local-storage');

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
        clientInfo: { name: 'owa-screen-run', version: '0.1.0' },
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
  try {
    return JSON.parse(text);
  } catch {
    // A refusal (the firewall's, the schema's) is a sentence, not JSON.
    return { isError: out?.result?.isError === true, text };
  }
}
async function tool(name, a = {}) {
  try {
    return await callTool(name, a);
  } catch (e) {
    return { error: String(e.message) };
  }
}

// --- the screen state, off the setting files --------------------------------

function readSettingText(name) {
  try {
    return fs.readFileSync(path.join(STORAGE_DIR, name), 'utf8');
  } catch {
    return null;
  }
}
function readSettingJson(name, fallback) {
  const text = readSettingText(name);
  if (text === null || text.trim() === '') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
// The view the properties panel opens on (`toBibleTextStyleView`), its
// defaults filled in.
function toStyleView(raw) {
  const style = raw instanceof Object ? raw : {};
  return {
    fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : '',
    fontSize: Number.isFinite(style.fontSize) ? style.fontSize : 65,
    color: String(style.color || '#ffffff').toLowerCase(),
    textShadow: style.textShadow || 'none',
    effect: style.effect ?? null,
    isBold: style.isBold === true,
    isItalic: style.isItalic === true,
    lineHeight: Number.isFinite(style.lineHeight) ? style.lineHeight : 1.5,
    letterSpacing: Number.isFinite(style.letterSpacing)
      ? style.letterSpacing
      : 0,
    textAlign: style.textAlign || 'start',
  };
}
// Plain words: the panel's Reset, which keeps the size on purpose (it is set
// once for a room and a projector), so "back to normal" is graded without it.
function checkIsPlainStyle(view) {
  return (
    view.fontFamily === '' &&
    ['#ffffff', '#fff', 'white'].includes(view.color) &&
    view.textShadow === 'none' &&
    !view.isBold &&
    !view.isItalic &&
    view.lineHeight === 1.5 &&
    view.letterSpacing === 0 &&
    view.textAlign === 'start'
  );
}
async function readScreenState() {
  // A setting is written a moment after the press that changed it.
  await sleep(1200);
  const listed = await tool('owa_list_screens');
  const managers = readSettingJson('screen-managers', []);
  const longTextMap = readSettingJson('screen-ft-manager', {});
  const style = toStyleView(readSettingJson('screen-bible--style-text', {}));
  const screens = {};
  const effects = {};
  for (const manager of managers) {
    const id = String(manager.screenId);
    const listedOne = (listed?.screens ?? []).find((one) => {
      return one.screenId === manager.screenId;
    });
    const rendered = longTextMap[id]?.bibleItemData?.renderedList ?? [];
    screens[id] = {
      selected: manager.isSelected === true,
      locked: manager.isLocked === true,
      stage: manager.stageNumber ?? 0,
      group: manager.colorNote ?? null,
      display: Number(readSettingText(`screen-display--pid-${id}`) ?? NaN),
      showing: listedOne?.isShowing ?? null,
      ref: listedOne?.bible?.reference ?? null,
      bibleKeys: rendered.map((one) => one.bibleKey),
      lineSync: readSettingText(`screen-bible--line-sync-${id}`) === 'true',
    };
    effects[id] = {
      background: readSettingText(`pt-effect-${id}-background`) || 'fade',
      slide: readSettingText(`pt-effect-${id}-vary-app-document`) || 'fade',
      foreground: readSettingText(`pt-effect-${id}-foreground`) || 'fade',
    };
  }
  return {
    style,
    styleIsPlain: checkIsPlainStyle(style),
    styleIsDefault: checkIsPlainStyle(style) && style.fontSize === 65,
    screens,
    effects,
    count: managers.length,
  };
}
// What changed, as `path: before -> after` lines.
function diffState(before, after, prefix = '') {
  const lines = [];
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  for (const key of keys) {
    const b = before?.[key];
    const a = after?.[key];
    if (
      b instanceof Object &&
      a instanceof Object &&
      !Array.isArray(b) &&
      !Array.isArray(a)
    ) {
      lines.push(...diffState(b, a, `${prefix}${key}.`));
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      lines.push(`${prefix}${key}: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`);
    }
  }
  return lines;
}
function isYellow(color) {
  const hex = /^#?([\da-f]{6})/i.exec(String(color ?? '').trim());
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return r >= 200 && g >= 180 && b <= 140;
  }
  return /yellow|gold/i.test(String(color ?? ''));
}
function runCheck(expression, b, a) {
  if (!expression) return null;
  try {
    return Boolean(
      new Function('b', 'a', 'isYellow', `return (${expression});`)(
        b,
        a,
        isYellow,
      ),
    );
  } catch (error) {
    return `check failed: ${error.message}`;
  }
}

// A screen SHOWING on a real display covers a monitor: hidden at once.
async function hideShownOnRealDisplay() {
  const listed = await tool('owa_list_screens');
  const hidden = [];
  for (const one of listed?.screens ?? []) {
    if (one.isShowing && Number(one.display?.id) >= 0) {
      await tool('owa_hide_screens', { screenId: one.screenId });
      hidden.push(one.screenId);
    }
  }
  return hidden;
}

// --- the help window ----------------------------------------------------------

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

// The newest answer's button whose words ARE the needle, else start with it.
const PRESS = (needle) => `(() => {
    const clean = (text) => text.replace(/\\u200b/g, '').trim().normalize('NFC');
    const wanted = clean(${JSON.stringify(needle)});
    const cues = [...document.querySelectorAll('.chat-cues article.cue')]
        .filter((cue) => !cue.classList.contains('cue-you'))
        .reverse();
    for (const cue of cues) {
        const buttons = [...cue.querySelectorAll('.cue-actions .cue-act, .cue-replies .cue-reply')];
        const found =
            buttons.find((b) => clean(b.textContent) === wanted) ??
            buttons.find((b) => clean(b.textContent).startsWith(wanted));
        if (found) {
            found.click();
            return { ok: true, pressed: clean(found.textContent) };
        }
    }
    return {
        ok: false,
        labels: [...(cues[0]?.querySelectorAll('.cue-actions .cue-act, .cue-replies .cue-reply') ?? [])]
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

// The safety read before anything is asked.
const startListed = await tool('owa_list_screens');
const onRealDisplay = (startListed?.screens ?? []).filter((one) => {
  return Number(one.display?.id) >= 0;
});
if (onRealDisplay.length > 0 && args['allow-real-display'] !== true) {
  console.log(
    'screens on a real display:',
    onRealDisplay.map((one) => one.screenId).join(', '),
    '-- put every screen on a virtual display first',
  );
  process.exit(2);
}

// `{otherBible}` in an ask is the second Bible's language, read off the
// screen tool's own list (`KEY: Title (Language)`): the first installed Bible
// that is not the KJV. The set names no language of its own.
const startRead = await tool('owa_screen_edit', { action: 'read' });
const otherBible = (startRead?.bibles ?? [])
  .map((line) => {
    return /^([^:]+):.*\(([^()]+)\)\s*$/.exec(String(line));
  })
  .find((match) => {
    return match !== null && match[1].trim() !== 'KJV';
  });
const OTHER_BIBLE_LANGUAGE = otherBible?.[2].trim() ?? null;
function toAskText(text) {
  return String(text).replaceAll('{otherBible}', OTHER_BIBLE_LANGUAGE ?? '');
}
const needsOtherBible = SCENARIOS.some((scenario) => {
  return scenario.asks.some((ask) => {
    return (
      String(ask.text ?? '').includes('{otherBible}') &&
      (ONLY === null ||
        ONLY.includes(scenario.id) ||
        ONLY.includes(ask.id))
    );
  });
});
if (needsOtherBible && OTHER_BIBLE_LANGUAGE === null) {
  console.log(
    'an ask names {otherBible}: install a second Bible besides the KJV first',
  );
  process.exit(2);
}

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

let shownOnReal = [];
async function waitFor(check, timeoutMs, stepMs = 1000) {
  const started = Date.now();
  let round = 0;
  while (Date.now() - started < timeoutMs) {
    const state = await cdp.evaluate(STATE);
    if (check(state)) return state;
    round += 1;
    if (round % 3 === 0) {
      const hidden = await hideShownOnRealDisplay();
      if (hidden.length > 0) {
        shownOnReal.push(...hidden);
        log('SHOWN ON A REAL DISPLAY, hidden:', hidden.join(','));
      }
    }
    await sleep(stepMs);
  }
  return null;
}

const outStream = fs.createWriteStream(OUT, { flags: 'a' });
const write = (row) => outStream.write(`${JSON.stringify(row)}\n`);
log('writing', OUT);
let checked = 0;
let passed = 0;
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
  const scenarioBefore = await readScreenState();
  const before = await cdp.evaluate(STATE);
  if (before.tabCount >= 12) {
    log('12 tabs');
    process.exit(2);
  }
  await cdp.evaluate(`document.querySelector('.chat-tab-add')?.click()`);
  const opened = await waitFor((s) => s.tabCount > before.tabCount, 10000, 300);
  if (!opened) {
    log(scenario.id, 'no new tab');
    process.exit(2);
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
    const stateBefore = await readScreenState();
    const start = await cdp.evaluate(STATE);
    toolCalls = [];
    shownOnReal = [];
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
          error: 'no button',
          labels: pressed.labels,
        });
        continue;
      }
    } else {
      await cdp.evaluate(
        `(() => { const input = document.querySelector('textarea.chat-input'); const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set; set.call(input, ${JSON.stringify(toAskText(ask.text))}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`,
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
    const hiddenAfter = await hideShownOnRealDisplay();
    shownOnReal.push(...hiddenAfter);
    const stateAfter = await readScreenState();
    // A check the state met before the ask proves nothing: `already`.
    const isAlready =
      ask.check !== undefined &&
      runCheck(ask.check, stateBefore, stateBefore) === true;
    const isDone = isAlready
      ? 'already'
      : runCheck(ask.check, stateBefore, stateAfter);
    if (ask.check) {
      checked += 1;
      if (isDone === true) passed += 1;
    }
    const changed = diffState(stateBefore, stateAfter);
    write({
      runId: RUN_ID,
      scenario: scenario.id,
      id: ask.id,
      ask: ask.text === undefined ? null : toAskText(ask.text),
      press: pressed?.pressed ?? null,
      expect: ask.expect,
      check: ask.check ?? null,
      isDone,
      changed,
      seconds,
      isTimeout: done === null,
      text: last?.text ?? null,
      note: last?.note ?? null,
      actions: last?.actions ?? [],
      replies: last?.replies ?? [],
      cost: last?.cost ?? null,
      costFull: last?.costFull ?? null,
      shownOnRealDisplay: shownOnReal,
      stalled,
      // The button named, or promised in the model's own words (_The
      // button below will put it back_, 2026-11-14's S5 after an owa_undo),
      // over an answer that carries none.
      undoClaimedWithoutButton:
        /Undo this change|button (?:below|under)|puts? it back/i.test(
          last?.text ?? '',
        ) && !(last?.actions ?? []).includes('Undo this change'),
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
      ask.check
        ? isDone === true
          ? 'DONE'
          : isDone === 'already'
            ? 'ALREADY'
            : `NOT DONE(${isDone})`
        : 'read',
      shownOnReal.length > 0 ? `SHOWN ON REAL ${shownOnReal}` : '',
      `tools=${toolCalls.map((c) => c.name + (c.args?.action ? ':' + c.args.action : '') + (c.args?.find ? `:"${c.args.find}"` : '') + (c.isError ? '!' : '')).join(',')}`,
      '|',
      (last?.text ?? '').slice(0, 200).replace(/\n/g, ' '),
      '|',
      (last?.replies ?? []).join(' / '),
      '| changed:',
      changed.join('; ').slice(0, 300),
    );
  }
  // Put back what the scenario changed through a tool that keeps a backup,
  // newest first; an undo the scenario pressed is itself skipped.
  // The firewall rations acting calls (25 a rolling minute, every session)
  // and removals (10 per 5 minutes), and the model's own calls spend the
  // same budget: an undo refused for either is asked again after a wait.
  // The first run after the screen tool did not look, and three of its
  // undos were refused unseen -- the next scenarios started from a style
  // that was never put back (2026-11-14).
  let undone = [];
  const undoFailed = [];
  if (args['no-undo'] !== true) {
    const changes = (
      (await tool('owa_undo', { action: 'list' })).changes ?? []
    ).filter((c) => !undoBefore.has(c.id) && !c.isUndone && !c.isUndo);
    for (const c of changes) {
      const label = c.label ?? c.summary ?? c.id;
      let result = await tool('owa_undo', { action: 'undo', id: c.id });
      for (
        let attempt = 1;
        attempt <= 4 && /^Too many/.test(String(result?.text ?? ''));
        attempt += 1
      ) {
        log(scenario.id, 'undo refused for the pace, waiting 20 s');
        await sleep(20000);
        result = await tool('owa_undo', { action: 'undo', id: c.id });
      }
      if (result?.isError === true || result?.error !== undefined) {
        undoFailed.push(
          `${label}: ${String(result.text ?? result.error).slice(0, 200)}`,
        );
      } else {
        undone.push(label);
      }
    }
  }
  const scenarioAfter = await readScreenState();
  const left = diffState(scenarioBefore, scenarioAfter);
  write({
    runId: RUN_ID,
    scenario: scenario.id,
    undone,
    ...(undoFailed.length > 0 ? { undoFailed } : {}),
    left,
  });
  log(
    scenario.id,
    'undid',
    undone.length,
    undoFailed.length > 0 ? `| NOT undone: ${undoFailed.join('; ')}` : '',
    '| left:',
    left.join('; '),
  );
  const closed = await cdp.evaluate(CLOSE_TAB_BY_INDEX(tabIndex));
  if (!closed.ok) log(scenario.id, 'left its tab open');
  // The firewall rations acting calls to 25 a rolling minute across
  // sessions: the model's and this driver's undo share it.
  await sleep(Number(args.gap ?? 45) * 1000);
}
write({ runId: RUN_ID, summary: { checked, passed } });
outStream.end();
log('done', `${passed} of ${checked} checked asks done`);
process.exit(0);
