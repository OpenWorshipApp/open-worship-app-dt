import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The side door every `owa_*` tool asks the running app through. Discovery is
// replaced (which port is live is `discovery.mjs`'s business and has its own
// tests), `fetch` answers the DevTools listing, and a fake WebSocket plays the
// page: it opens on the next task and answers only what a test tells it to.
const cdpState = vi.hoisted(() => {
  return { livePort: null, deadPin: null, resolveCalls: [] };
});

vi.mock('./discovery.mjs', () => {
  return {
    resolveCdpPort: async (options) => {
      cdpState.resolveCalls.push(options);
      return cdpState.livePort;
    },
    describeDeadPin: () => {
      return cdpState.deadPin;
    },
  };
});

import {
  evaluateInApp,
  evaluateInTarget,
  getVersion,
  listTargets,
  pickTarget,
  requireLivePort,
  runInTarget,
  waitForNewAppPage,
} from './cdp.mjs';

const wsState = { sockets: [], answer: null, isOpenFailing: false };

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.listenerMap = new Map();
    this.closeCount = 0;
    this.isCloseThrowing = false;
    wsState.sockets.push(this);
    // On a task, not a microtask: `openSocket` awaits the class before it
    // adds its listeners, and an open fired sooner would be missed.
    setTimeout(() => {
      this.emit(wsState.isOpenFailing ? 'error' : 'open', {});
    }, 0);
  }

  addEventListener(type, listener) {
    if (!this.listenerMap.has(type)) {
      this.listenerMap.set(type, []);
    }
    this.listenerMap.get(type).push(listener);
  }

  emit(type, event) {
    for (const listener of this.listenerMap.get(type) ?? []) {
      listener(event);
    }
  }

  send(text) {
    const message = JSON.parse(text);
    this.sent.push(message);
    wsState.answer?.(message, this);
  }

  reply(payload) {
    this.emit('message', {
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }

  close() {
    this.closeCount += 1;
    if (this.isCloseThrowing) {
      throw new Error('already closing');
    }
  }
}

function answerWith(genReply) {
  wsState.answer = (message, socket) => {
    queueMicrotask(() => {
      socket.reply(genReply(message, socket));
    });
  };
}

function stubListing(targets) {
  const fetchSpy = vi.fn(async () => {
    return { ok: true, json: async () => targets };
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

const target = {
  id: 'P',
  type: 'page',
  url: 'https://localhost:3000/presenter.html',
  webSocketDebuggerUrl: 'ws://127.0.0.1:60401/devtools/page/P',
};

beforeEach(() => {
  cdpState.livePort = null;
  cdpState.deadPin = null;
  cdpState.resolveCalls = [];
  wsState.sockets = [];
  wsState.answer = null;
  wsState.isOpenFailing = false;
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('listTargets and getVersion', () => {
  test('lists only the page targets a question can be about', async () => {
    const fetchSpy = stubListing([
      { id: 'A', type: 'page', url: 'https://localhost:3000/presenter.html' },
      {
        id: 'B',
        type: 'page',
        url: 'devtools://devtools/bundled/inspector.html',
      },
      { id: 'C', type: 'service_worker', url: 'https://localhost:3000/sw.js' },
      { id: 'D', type: 'page' },
      {
        id: 'E',
        type: 'page',
        url: 'http://127.0.0.1:39240/screen.html?screenId=1',
      },
    ]);
    const targets = await listTargets(60401);
    expect(
      targets.map((one) => {
        return one.id;
      }),
    ).toEqual(['A', 'E']);
    expect(fetchSpy).toHaveBeenCalledWith('http://127.0.0.1:60401/json/list', {
      signal: expect.any(AbortSignal),
    });
  });

  test('a listing the endpoint refuses is an error naming the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return { ok: false, status: 500 };
      }),
    );
    await expect(listTargets(60401)).rejects.toThrow(
      'CDP /json/list answered 500',
    );
  });

  test('getVersion answers what the endpoint says, or null when it will not', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        return { ok: true, json: async () => ({ Browser: 'Chrome/150', url }) };
      }),
    );
    await expect(getVersion(60401)).resolves.toEqual({
      Browser: 'Chrome/150',
      url: 'http://127.0.0.1:60401/json/version',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return { ok: false, status: 404 };
      }),
    );
    await expect(getVersion(60401)).resolves.toBe(null);
  });
});

describe('pickTarget', () => {
  const presenter = { id: 'P', url: 'https://localhost:3000/presenter.html' };
  const readerOne = { id: 'R1', url: 'https://localhost:3000/reader.html' };
  const readerTwo = { id: 'R2', url: 'https://localhost:3000/reader.html' };
  const setting = {
    id: 'S',
    url: 'https://localhost:3000/setting.html?uuid=setting',
  };
  const chatbot = { id: 'C', url: 'https://localhost:3000/chatbot.html' };
  const screen = { id: 'X', url: 'http://127.0.0.1:39240/screen.html?id=1' };
  const stranger = { id: 'W', url: 'https://example.com/' };

  // "The app" to somebody asking for help is the main window -- never a
  // popup, and never the chatbot window asking about itself.
  test('with nothing asked for, the main window wins over every popup', () => {
    const targets = [chatbot, screen, setting, readerOne, presenter, stranger];
    expect(pickTarget(targets)).toBe(presenter);
    expect(pickTarget([chatbot, setting, readerOne])).toBe(readerOne);
    expect(pickTarget([stranger, screen, chatbot])).toBe(chatbot);
    expect(pickTarget([stranger])).toBe(stranger);
    expect(pickTarget([])).toBe(null);
    // The caller's list is read, never reordered.
    expect(targets[0]).toBe(chatbot);
  });

  test('a window asked for is found by id, then exact address, then a piece of it', () => {
    // Two Reader windows share an address; only the id tells them apart.
    expect(pickTarget([readerOne, readerTwo], 'R2')).toBe(readerTwo);
    const query = { id: 'Q', url: 'https://localhost:3000/reader.html?x=1' };
    expect(pickTarget([query, readerOne], readerOne.url)).toBe(readerOne);
    expect(pickTarget([presenter, setting], 'setting.html')).toBe(setting);
    expect(pickTarget([presenter], 'setting.html')).toBe(null);
  });
});

describe('requireLivePort', () => {
  test('answers the port discovery found for the port asked', async () => {
    cdpState.livePort = 60401;
    await expect(requireLivePort(9999)).resolves.toBe(60401);
    expect(cdpState.resolveCalls).toEqual([{ port: 9999 }]);
  });

  // A pin that is dead is a different problem from no app at all, and a
  // script pinned to a restarted dev app must not read "start the app".
  test('a dead pin is said as such', async () => {
    cdpState.deadPin =
      'Port 9999 was named by OWA_CDP_PORT and is not answering.';
    await expect(requireLivePort(9999)).rejects.toThrow(cdpState.deadPin);
  });

  test('with no app at all it says to start one', async () => {
    await expect(requireLivePort()).rejects.toThrow(
      'No running Open Worship App was found. Start the app (or ' +
        '`npm run dev`) and try again.',
    );
  });
});

describe('evaluateInTarget', () => {
  test('sends one Runtime.evaluate that awaits promises and answers its value', async () => {
    answerWith((message) => {
      return {
        id: message.id,
        result: { result: { type: 'object', value: { ok: 1 } } },
      };
    });
    await expect(evaluateInTarget(target, '1 + 1')).resolves.toEqual({
      ok: 1,
    });
    const [socket] = wsState.sockets;
    expect(socket.url).toBe(target.webSocketDebuggerUrl);
    expect(socket.sent).toEqual([
      {
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: '1 + 1',
          returnByValue: true,
          awaitPromise: true,
          allowUnsafeEvalBlockedByCSP: true,
        },
      },
    ]);
    // Nothing is held between questions.
    expect(socket.closeCount).toBe(1);
  });

  test('skips frames it cannot read and answers that are not its own', async () => {
    wsState.answer = (_message, socket) => {
      queueMicrotask(() => {
        socket.reply('not json at all');
        socket.reply({ method: 'Runtime.consoleAPICalled', params: {} });
        socket.reply({ id: 2, result: { result: { value: 'not mine' } } });
        socket.reply({ id: 1, result: { result: { value: 'mine' } } });
      });
    };
    await expect(evaluateInTarget(target, 'x')).resolves.toBe('mine');
  });

  test('an expression with no value answers undefined', async () => {
    answerWith((message) => {
      return { id: message.id, result: { result: { type: 'undefined' } } };
    });
    await expect(evaluateInTarget(target, 'void 0')).resolves.toBe(undefined);
  });

  // CDP describes an exception as its stack; a caller -- and a model -- only
  // needs what it says.
  test('a page that throws answers with what the error says, not its stack', async () => {
    answerWith((message) => {
      return {
        id: message.id,
        result: {
          result: { type: 'object', subtype: 'error' },
          exceptionDetails: {
            text: 'Uncaught',
            exception: {
              description: [
                'Error: That window is not open',
                '    at IpcRenderer.<anonymous> (<anonymous>:20:28)',
              ].join('\n'),
            },
          },
        },
      };
    });
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      /^That window is not open$/,
    );
  });

  test('an exception with no description answers its text', async () => {
    answerWith((message) => {
      return {
        id: message.id,
        result: {
          exceptionDetails: { text: 'Uncaught SyntaxError: Unexpected token' },
        },
      };
    });
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      'Uncaught SyntaxError: Unexpected token',
    );
  });

  test('a protocol error rejects with its message', async () => {
    answerWith((message) => {
      return {
        id: message.id,
        error: { message: 'Cannot find context with specified id' },
      };
    });
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      'Cannot find context with specified id',
    );
  });

  test('a page that cannot be attached to rejects, naming it', async () => {
    wsState.isOpenFailing = true;
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      `Could not attach to ${target.url}`,
    );
  });

  test('a page that never answers times out, and its socket is closed', async () => {
    vi.useFakeTimers();
    const evaluating = evaluateInTarget(target, 'x', 500);
    const settled = evaluating.catch((error) => {
      return error;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(wsState.sockets[0].closeCount).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    const error = await settled;
    expect(error.message).toBe(`Timed out evaluating in ${target.url}`);
    expect(wsState.sockets[0].closeCount).toBe(1);
  });

  test('a socket that is already closing does not lose the answer', async () => {
    answerWith((message, socket) => {
      socket.isCloseThrowing = true;
      return { id: message.id, result: { result: { value: 42 } } };
    });
    await expect(evaluateInTarget(target, 'x')).resolves.toBe(42);
  });
});

describe('runInTarget', () => {
  test('a page that cannot be attached to rejects, naming it', async () => {
    wsState.isOpenFailing = true;
    await expect(
      runInTarget(target, [{ method: 'Input.dispatchDragEvent' }]),
    ).rejects.toThrow(`Could not attach to ${target.url}`);
  });

  test('skips frames it cannot read and sends params {} when a step has none', async () => {
    wsState.answer = (message, socket) => {
      queueMicrotask(() => {
        socket.reply('garbage');
        socket.reply({ id: message.id, result: { ok: true } });
      });
    };
    await expect(
      runInTarget(target, [{ method: 'Page.bringToFront' }]),
    ).resolves.toEqual([{ ok: true }]);
    expect(wsState.sockets[0].sent).toEqual([
      { id: 1, method: 'Page.bringToFront', params: {} },
    ]);
  });

  test('a command answered with no result counts as an empty one', async () => {
    answerWith((message) => {
      return { id: message.id };
    });
    await expect(
      runInTarget(target, [{ method: 'Input.dispatchKeyEvent' }]),
    ).resolves.toEqual([{}]);
  });

  // One gesture, one deadline: a drop that outlasts it must not go on to
  // send its later steps into a page that has already been told it failed.
  test('a gesture that outlasts its timeout sends nothing after it', async () => {
    vi.useFakeTimers();
    answerWith((message) => {
      return { id: message.id, result: {} };
    });
    const running = runInTarget(
      target,
      [
        { method: 'Input.dispatchDragEvent', params: { type: 'dragEnter' } },
        { waitMs: 1000 },
        { method: 'Input.dispatchDragEvent', params: { type: 'drop' } },
      ],
      500,
    );
    const settled = running.catch((error) => {
      return error;
    });
    await vi.advanceTimersByTimeAsync(500);
    expect((await settled).message).toBe(`Timed out acting in ${target.url}`);
    await vi.advanceTimersByTimeAsync(600);
    expect(
      wsState.sockets[0].sent.map((message) => {
        return message.params.type;
      }),
    ).toEqual(['dragEnter']);
  });

  test('a socket error after the answer changes nothing', async () => {
    answerWith((message) => {
      return { id: message.id, result: { done: 1 } };
    });
    await expect(
      runInTarget(target, [{ method: 'Page.bringToFront' }]),
    ).resolves.toEqual([{ done: 1 }]);
    const [socket] = wsState.sockets;
    expect(socket.closeCount).toBe(1);
    socket.emit('error', {});
    expect(socket.closeCount).toBe(1);
  });
});

describe('evaluateInApp', () => {
  const reader = {
    id: 'R',
    type: 'page',
    url: 'https://localhost:3000/reader.html',
    webSocketDebuggerUrl: 'ws://r',
  };
  const presenter = { ...target, webSocketDebuggerUrl: 'ws://p' };
  const setting = {
    id: 'S',
    type: 'page',
    url: 'https://localhost:3000/setting.html?uuid=setting',
    webSocketDebuggerUrl: 'ws://s',
  };

  test('resolves the app, picks the page and hands back the windows as they were', async () => {
    cdpState.livePort = 60401;
    const fetchSpy = stubListing([reader, presenter]);
    answerWith((message) => {
      return { id: message.id, result: { result: { value: 'hello' } } };
    });
    const answer = await evaluateInApp('document.title');
    expect(answer.port).toBe(60401);
    expect(answer.target.id).toBe('P');
    expect(
      answer.targets.map((one) => {
        return one.id;
      }),
    ).toEqual(['R', 'P']);
    expect(answer.value).toBe('hello');
    expect(wsState.sockets[0].url).toBe('ws://p');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:60401/json/list',
      expect.any(Object),
    );
  });

  test('a page asked for by name is the one evaluated', async () => {
    cdpState.livePort = 60401;
    stubListing([reader, presenter]);
    answerWith((message) => {
      return { id: message.id, result: { result: { value: 1 } } };
    });
    const answer = await evaluateInApp('1', { match: 'reader.html' });
    expect(answer.target.id).toBe('R');
    expect(wsState.sockets[0].url).toBe('ws://r');
  });

  // The caller's cue to switch pages first: it cannot say so without being
  // told where the window is.
  test('asked for a page that is not open, it names the pages that are', async () => {
    cdpState.livePort = 60401;
    stubListing([presenter, setting]);
    await expect(evaluateInApp('x', { match: 'reader.html' })).rejects.toThrow(
      'The app has no open page matching "reader.html". The open pages ' +
        'are: presenter.html, setting.html?uuid=setting.',
    );
    expect(wsState.sockets).toEqual([]);
  });

  test('with no page open at all it says so', async () => {
    cdpState.livePort = 60401;
    stubListing([]);
    await expect(evaluateInApp('x')).rejects.toThrow(
      /^The app has no open page$/,
    );
  });

  test('no app running is refused before anything is listed', async () => {
    const fetchSpy = stubListing([presenter]);
    await expect(evaluateInApp('x')).rejects.toThrow(
      'No running Open Worship App was found',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('the timeout asked for is the one the page gets', async () => {
    vi.useFakeTimers();
    cdpState.livePort = 60401;
    stubListing([presenter]);
    const evaluating = evaluateInApp('x', { timeout: 300 });
    const settled = evaluating.catch((error) => {
      return error;
    });
    await vi.advanceTimersByTimeAsync(300);
    expect((await settled).message).toBe(
      `Timed out evaluating in ${presenter.url}`,
    );
  });
});

describe('waitForNewAppPage', () => {
  const presenter = {
    id: 'P',
    type: 'page',
    url: 'https://localhost:3000/presenter.html',
  };
  const capture = { id: 'K', type: 'page', url: 'https://example.com/' };
  const setting = {
    id: 'S',
    type: 'page',
    url: 'https://localhost:3000/setting.html?uuid=setting',
  };

  // A window becomes a target a few hundred milliseconds after the press that
  // asked for it, and the hidden capture windows come and go on their own.
  test('polls until an app window opens and names it', async () => {
    vi.useFakeTimers();
    const listings = [
      [presenter],
      [presenter, capture],
      [presenter, capture, setting],
    ];
    let lookCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const listing = listings[Math.min(lookCount, listings.length - 1)];
        lookCount += 1;
        return { ok: true, json: async () => listing };
      }),
    );
    const waiting = waitForNewAppPage(60401, [presenter], 1000, 200);
    await vi.advanceTimersByTimeAsync(400);
    await expect(waiting).resolves.toBe('setting.html');
    expect(lookCount).toBe(3);
  });

  test('told not to wait, it looks once', async () => {
    const fetchSpy = stubListing([presenter, capture]);
    await expect(waitForNewAppPage(60401, [presenter], 0)).resolves.toBe(null);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('gives up at the deadline when only a capture window came', async () => {
    vi.useFakeTimers();
    const fetchSpy = stubListing([presenter, capture]);
    const waiting = waitForNewAppPage(60401, [presenter], 500, 200);
    await vi.advanceTimersByTimeAsync(600);
    await expect(waiting).resolves.toBe(null);
    // Looks at 0, 200, 400 and 600 ms, the last one past the deadline.
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  test('an app that went away mid-question answers null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(waitForNewAppPage(60401, [presenter], 1000)).resolves.toBe(
      null,
    );
  });
});
