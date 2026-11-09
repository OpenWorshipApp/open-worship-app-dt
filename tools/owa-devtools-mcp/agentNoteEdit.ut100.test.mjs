// `agentNoteEdit.mjs`'s own worker, which its sibling suite replaces with a
// stand-in: the note's window found among the app's windows by its address,
// waited for until its editor says it is ready, opened from the main window
// when none is open, and the next window tried when one shows another
// folder's note of the same file name. The debugging endpoint is a fake
// (`cdp.mjs` mocked); the waits run on fake timers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  evaluateInTarget: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
}));

vi.mock('./cdp.mjs', () => ({
  evaluateInApp: app.evaluateInApp,
  evaluateInTarget: app.evaluateInTarget,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
}));

import {
  NOTE_EDIT_TOOL_NAME,
  NOTE_WINDOW_OTHER_CODE,
  NOTE_WINDOW_READY_GLOBAL_NAME,
  checkIsNoteWindowUrl,
  registerNoteEditTool,
  runNoteEdit,
} from './agentNoteEdit.mjs';

const NOTE_PATH = 'C:\\data\\bible-notes\\Default.own';
const PORT = 9222;
const BASE = 'https://localhost:3000';

function genWindow(id, query) {
  return { id, type: 'page', url: `${BASE}/bibleNote.html?${query}` };
}

const PRESENTER = { id: 'p', type: 'page', url: `${BASE}/presenter.html` };
const OTHER_NOTE = genWindow('w4', 'file=Default.own&id=4');
const OTHER_FILE = genWindow('ws', 'file=Sunday.own&id=3');
const NOTE = genWindow('w3', 'file=Default.own&id=3&uuid=a');
const NOTE_TWIN = genWindow('w3b', 'file=Default.own&id=3&uuid=b');

// The request rides in the expression as one line of JSON.
const REQUEST_PATTERN = /const request = Object\.assign\((.*), \{\r?\n/;

function requestOf(expression) {
  const matched = REQUEST_PATTERN.exec(expression);
  expect(matched).not.toBeNull();
  return JSON.parse(matched[1]);
}

function checkIsReadyAsk(expression) {
  return expression.includes(NOTE_WINDOW_READY_GLOBAL_NAME);
}

// `ready` says what each window answers when asked whether its editor is
// up (a function may throw: no page context yet); `answers` what each
// window's worker answers.
function routeWindows({ ready = {}, answers = {} } = {}) {
  app.evaluateInTarget.mockImplementation(async (target, expression) => {
    if (checkIsReadyAsk(expression)) {
      const value = ready[target.id] ?? true;
      return typeof value === 'function' ? value() : value;
    }
    return answers[target.id];
  });
}

function workerCalls() {
  return app.evaluateInTarget.mock.calls
    .filter(([, expression]) => !checkIsReadyAsk(expression))
    .map(([target, expression, timeout]) => ({
      id: target.id,
      request: requestOf(expression),
      timeout,
    }));
}

function readyCalls() {
  return app.evaluateInTarget.mock.calls
    .filter(([, expression]) => checkIsReadyAsk(expression))
    .map(([target, , timeout]) => ({ id: target.id, timeout }));
}

function textOf(result) {
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text);
}

function errorOf(result) {
  expect(result.isError).toBe(true);
  return result.content[0].text;
}

// Settles `promise` on fake timers, saying whether it was still waiting
// just before `ms` had passed.
async function runFor(promise, ms) {
  let isSettled = false;
  promise.then(
    () => {
      isSettled = true;
    },
    () => {
      isSettled = true;
    },
  );
  await vi.advanceTimersByTimeAsync(ms - 500);
  const wasWaiting = !isSettled;
  await vi.advanceTimersByTimeAsync(1000);
  return { wasWaiting, result: await promise };
}

beforeEach(() => {
  app.requireLivePort.mockResolvedValue(PORT);
  app.listTargets.mockResolvedValue([]);
  app.evaluateInApp.mockResolvedValue({ value: {} });
  routeWindows();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("a note's open window", () => {
  it('takes the request; windows of another note, file or page are passed over', async () => {
    app.listTargets.mockResolvedValue([
      PRESENTER,
      OTHER_NOTE,
      OTHER_FILE,
      NOTE,
    ]);
    const answer = { name: 'Sunday', hash: 'ab12', blocks: [] };
    routeWindows({ answers: { w3: answer } });
    const result = await runNoteEdit({
      action: 'read',
      file: NOTE_PATH,
      id: 3,
      from: 2,
      page: 'presenter.html',
    });
    expect(textOf(result)).toEqual(answer);
    expect(app.listTargets).toHaveBeenCalledWith(PORT);
    expect(readyCalls()).toEqual([{ id: 'w3', timeout: 5000 }]);
    // Long enough for verses read from a Bible and a backup, and a little
    // longer for the window itself.
    expect(workerCalls()).toEqual([
      {
        id: 'w3',
        request: {
          action: 'read',
          filePath: NOTE_PATH,
          noteId: 3,
          from: 2,
          domain: 'note-edit',
        },
        timeout: 65000,
      },
    ]);
    expect(app.evaluateInTarget.mock.calls.at(-1)[1]).toContain('}, 60000);');
    // Nothing was opened from the main window.
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('is never a window whose address cannot be read', () => {
    // A relative address is read against the app's own; this one is no
    // address at all (an unclosed IPv6 host).
    expect(checkIsNoteWindowUrl('http://[bad', 'Default.own', 3)).toBe(false);
    expect(
      checkIsNoteWindowUrl(
        'http://[bad/bibleNote.html?file=Default.own&id=3',
        'Default.own',
        3,
      ),
    ).toBe(false);
  });

  it('is found by the file name of a path written with forward slashes', async () => {
    app.listTargets.mockResolvedValue([NOTE]);
    routeWindows({ answers: { w3: { name: 'Sunday', isChanged: true } } });
    const result = await runNoteEdit({
      action: 'edit',
      file: 'C:/data/bible-notes/Default.own',
      id: 3,
      hash: 'ab12',
      changes: [{ block: 1, text: 'Grace' }],
    });
    expect(textOf(result)).toEqual({ name: 'Sunday', isChanged: true });
    expect(workerCalls()[0].request).toEqual({
      action: 'edit',
      filePath: 'C:/data/bible-notes/Default.own',
      noteId: 3,
      hash: 'ab12',
      changes: [{ block: 1, text: 'Grace' }],
      domain: 'note-edit',
    });
  });

  it('is waited for while it loads, then asked', async () => {
    vi.useFakeTimers();
    app.listTargets.mockResolvedValue([NOTE]);
    const states = [
      () => {
        throw new Error('Cannot find context with specified id');
      },
      false,
      true,
    ];
    let asked = 0;
    routeWindows({
      ready: {
        w3: () => {
          const state = states[Math.min(asked, states.length - 1)];
          asked += 1;
          return typeof state === 'function' ? state() : state;
        },
      },
      answers: { w3: { name: 'Sunday' } },
    });
    const pending = runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(textOf(await pending)).toEqual({ name: 'Sunday' });
    expect(readyCalls()).toHaveLength(3);
    expect(workerCalls()).toHaveLength(1);
  });

  it('is given up on when its editor is not up within 20 seconds', async () => {
    vi.useFakeTimers();
    app.listTargets.mockResolvedValue([NOTE]);
    routeWindows({ ready: { w3: false } });
    const { wasWaiting, result } = await runFor(
      runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 }),
      20000,
    );
    expect(wasWaiting).toBe(true);
    expect(errorOf(result)).toBe(
      "The note's window is still opening. Try again in a moment.",
    );
    expect(workerCalls()).toEqual([]);
  });

  it("answering nothing is the app's silence", async () => {
    app.listTargets.mockResolvedValue([NOTE]);
    routeWindows({ answers: { w3: null } });
    expect(
      errorOf(await runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 })),
    ).toBe('The app did not answer.');
    routeWindows({ answers: { w3: 'done' } });
    expect(
      errorOf(await runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 })),
    ).toBe('The app did not answer.');
  });

  it("refusing is the window's own sentence", async () => {
    app.listTargets.mockResolvedValue([NOTE]);
    routeWindows({
      answers: { w3: { isError: true, reason: 'The note was typed into.' } },
    });
    expect(
      errorOf(await runNoteEdit({ action: 'edit', file: NOTE_PATH, id: 3 })),
    ).toBe('The note was typed into.');
  });
});

describe('a window showing another note of the same name', () => {
  it('passes the request to the next window of that address', async () => {
    app.listTargets.mockResolvedValue([NOTE, NOTE_TWIN]);
    routeWindows({
      answers: {
        w3: { code: NOTE_WINDOW_OTHER_CODE, isError: true, reason: 'Other' },
        w3b: { name: 'Sunday', hash: 'cd' },
      },
    });
    const result = await runNoteEdit({
      action: 'read',
      file: NOTE_PATH,
      id: 3,
    });
    expect(textOf(result)).toEqual({ name: 'Sunday', hash: 'cd' });
    expect(workerCalls().map((one) => one.id)).toEqual(['w3', 'w3b']);
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });

  it('when every one refuses, the right one is opened; when that refuses too, the person is told', async () => {
    const windows = [NOTE];
    app.listTargets.mockImplementation(async () => [...windows]);
    app.evaluateInApp.mockImplementation(async () => {
      windows.push(NOTE_TWIN);
      return { value: { isOpened: true } };
    });
    const other = { code: NOTE_WINDOW_OTHER_CODE };
    routeWindows({ answers: { w3: other, w3b: other } });
    const result = await runNoteEdit({
      action: 'read',
      file: NOTE_PATH,
      id: 3,
    });
    expect(errorOf(result)).toBe(
      'No window of this note would take the request. Ask the person to ' +
        'close the note windows of that name and open the note with Open on ' +
        'its row.',
    );
    // Each window asked once, the main window asked to open it once.
    expect(workerCalls().map((one) => one.id)).toEqual(['w3', 'w3b']);
    expect(app.evaluateInApp).toHaveBeenCalledTimes(1);
  });
});

describe('no window of the note open', () => {
  it('opens it from the main window, waits for it to appear and asks it', async () => {
    vi.useFakeTimers();
    app.listTargets
      .mockResolvedValueOnce([PRESENTER])
      .mockResolvedValueOnce([PRESENTER])
      .mockResolvedValue([PRESENTER, NOTE]);
    app.evaluateInApp.mockResolvedValue({ value: { isOpened: true } });
    routeWindows({ answers: { w3: { name: 'Sunday' } } });
    const pending = runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(textOf(await pending)).toEqual({ name: 'Sunday' });
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    // The row's own Open: the note named by its whole path and id, asked
    // of the instance being driven.
    expect(requestOf(expression)).toEqual({
      filePath: NOTE_PATH,
      noteId: 3,
      domain: 'note-window',
    });
    expect(options).toEqual({ port: PORT });
    expect(app.listTargets).toHaveBeenCalledTimes(3);
    expect(workerCalls().map((one) => one.id)).toEqual(['w3']);
  });

  it("the main window's refusal is the answer, and its silence is said", async () => {
    app.evaluateInApp.mockResolvedValue({
      value: { isError: true, reason: 'There is no note 3 in Default.own.' },
    });
    expect(
      errorOf(await runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 })),
    ).toBe('There is no note 3 in Default.own.');
    for (const value of [null, undefined, 'opened']) {
      app.evaluateInApp.mockResolvedValue({ value });
      expect(
        errorOf(await runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 })),
      ).toBe('The app did not answer.');
    }
    expect(app.evaluateInTarget).not.toHaveBeenCalled();
  });

  it('is given up on when the window has not appeared within 20 seconds', async () => {
    vi.useFakeTimers();
    app.listTargets.mockResolvedValue([PRESENTER, OTHER_NOTE]);
    const { wasWaiting, result } = await runFor(
      runNoteEdit({ action: 'read', file: NOTE_PATH, id: 3 }),
      20000,
    );
    expect(wasWaiting).toBe(true);
    expect(errorOf(result)).toBe(
      "The note's window did not open. Ask the person to open the note " +
        'with Open on its row in the Bible Notes panel.',
    );
    expect(app.evaluateInApp).toHaveBeenCalledTimes(1);
    expect(app.evaluateInTarget).not.toHaveBeenCalled();
  });
});

describe('the registered tool', () => {
  function registerHandler() {
    const registerTool = vi.fn();
    registerNoteEditTool({ registerTool });
    const [name, , handler] = registerTool.mock.calls[0];
    expect(name).toBe(NOTE_EDIT_TOOL_NAME);
    return handler;
  }

  it("runs the note's own window's worker", async () => {
    app.listTargets.mockResolvedValue([NOTE]);
    routeWindows({ answers: { w3: { name: 'Sunday', isChanged: false } } });
    const handler = registerHandler();
    expect(
      textOf(
        await handler({ action: 'undo', file: NOTE_PATH, id: 3, note: 'x' }),
      ),
    ).toEqual({ name: 'Sunday', isChanged: false });
    expect(workerCalls()[0].request).toEqual({
      action: 'undo',
      filePath: NOTE_PATH,
      noteId: 3,
      domain: 'note-edit',
    });
  });

  it('answers a failure to reach the app as an error result, never a throw', async () => {
    app.requireLivePort.mockRejectedValue(new Error('The app is not running.'));
    const handler = registerHandler();
    expect(
      errorOf(await handler({ action: 'read', file: NOTE_PATH, id: 3 })),
    ).toBe('The app is not running.');
    // The window closed under the request: what the endpoint threw.
    app.requireLivePort.mockResolvedValue(PORT);
    app.listTargets.mockResolvedValue([NOTE]);
    app.evaluateInTarget.mockImplementation(async (_target, expression) => {
      if (checkIsReadyAsk(expression)) {
        return true;
      }
      throw 'Target closed';
    });
    expect(
      errorOf(await handler({ action: 'read', file: NOTE_PATH, id: 3 })),
    ).toBe('Target closed');
  });
});
