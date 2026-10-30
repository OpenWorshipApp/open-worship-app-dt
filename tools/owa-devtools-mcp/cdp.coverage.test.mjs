import http from 'node:http';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// The side door every `owa_*` tool uses: a real HTTP endpoint on a free port
// answers `/json/list` and `/json/version` the way Chromium does, and the
// page socket is a stub that answers each command as the test says.
const mocks = vi.hoisted(() => ({
  resolveCdpPort: vi.fn(),
  describeDeadPin: vi.fn(),
}));

vi.mock('./discovery.mjs', () => ({
  resolveCdpPort: mocks.resolveCdpPort,
  describeDeadPin: mocks.describeDeadPin,
}));

import {
  PAGE_KINDS,
  evaluateInApp,
  evaluateInTarget,
  getVersion,
  listTargets,
  pickTarget,
  requireLivePort,
  runInTarget,
  waitForNewAppPage,
} from './cdp.mjs';

const endpoint = {
  server: null,
  port: 0,
  // Each `/json/list` answer in turn; the last one repeats.
  lists: [],
  listStatus: 200,
  version: { Browser: 'Chrome/140' },
};

beforeAll(async () => {
  endpoint.server = http.createServer((req, res) => {
    if (req.url === '/json/list') {
      if (endpoint.listStatus !== 200) {
        res.writeHead(endpoint.listStatus);
        res.end();
        return;
      }
      const list =
        endpoint.lists.length > 1
          ? endpoint.lists.shift()
          : (endpoint.lists[0] ?? []);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }
    if (req.url === '/json/version' && endpoint.version !== null) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(endpoint.version));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => {
    endpoint.server.listen(0, '127.0.0.1', resolve);
  });
  endpoint.port = endpoint.server.address().port;
});

afterAll(async () => {
  await new Promise((resolve) => {
    endpoint.server.close(resolve);
  });
});

const socketState = {
  sockets: [],
  // How the page answers a sent command: `(message, socket) => void`.
  onSend: null,
  failToOpen: false,
  closeThrows: false,
};

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.listeners = {};
    this.closeCount = 0;
    socketState.sockets.push(this);
    setTimeout(() => {
      this.emit(socketState.failToOpen ? 'error' : 'open', {});
    }, 0);
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  emit(type, event) {
    this.listeners[type]?.(event);
  }

  reply(data) {
    setTimeout(() => {
      this.emit('message', {
        data: typeof data === 'string' ? data : JSON.stringify(data),
      });
    }, 0);
  }

  send(text) {
    const message = JSON.parse(text);
    this.sent.push(message);
    socketState.onSend?.(message, this);
  }

  close() {
    this.closeCount += 1;
    if (socketState.closeThrows) {
      throw new Error('already closing');
    }
  }
}

beforeEach(() => {
  endpoint.lists = [];
  endpoint.listStatus = 200;
  endpoint.version = { Browser: 'Chrome/140' };
  socketState.sockets = [];
  socketState.onSend = null;
  socketState.failToOpen = false;
  socketState.closeThrows = false;
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const pageUrl = (name) => `https://localhost:3000/${name}`;

describe('listTargets and getVersion', () => {
  it('lists the app pages only, never a DevTools window or a worker', async () => {
    endpoint.lists = [
      [
        { id: 'A', type: 'page', url: pageUrl('presenter.html') },
        { id: 'B', type: 'page', url: 'devtools://devtools/inspector.html' },
        { id: 'C', type: 'service_worker', url: pageUrl('sw.js') },
        { id: 'D', type: 'page' },
        { id: 'E', type: 'page', url: pageUrl('reader.html') },
      ],
    ];
    const targets = await listTargets(endpoint.port);
    expect(targets.map((target) => target.id)).toEqual(['A', 'E']);
  });

  it('says what the endpoint answered when it is not a list', async () => {
    endpoint.listStatus = 500;
    await expect(listTargets(endpoint.port)).rejects.toThrow(
      'CDP /json/list answered 500',
    );
  });

  it('reads the browser version, or null when there is none', async () => {
    expect(await getVersion(endpoint.port)).toEqual({ Browser: 'Chrome/140' });
    endpoint.version = null;
    expect(await getVersion(endpoint.port)).toBeNull();
  });
});

describe('pickTarget', () => {
  const targets = [
    { id: 'S', url: pageUrl('setting.html') },
    { id: 'R1', url: pageUrl('reader.html') },
    { id: 'R2', url: pageUrl('reader.html') },
    { id: 'P', url: pageUrl('presenter.html') },
    { id: 'X', url: 'https://example.com/' },
  ];

  it('tells two windows at one address apart by id', () => {
    expect(pickTarget(targets, 'R2').id).toBe('R2');
  });

  it('prefers a whole address to a part of one', () => {
    const exact = [
      { id: 'long', url: pageUrl('reader.html?x=1') },
      { id: 'exact', url: pageUrl('reader.html') },
    ];
    expect(pickTarget(exact, pageUrl('reader.html')).id).toBe('exact');
    expect(pickTarget(exact, 'reader.html').id).toBe('long');
    expect(pickTarget(exact, 'nowhere.html')).toBeNull();
  });

  it('picks the main window over popups and strangers', () => {
    expect(pickTarget(targets).id).toBe('P');
    expect(pickTarget([targets[4], targets[0]]).id).toBe('S');
    expect(pickTarget([])).toBeNull();
    expect(PAGE_KINDS.presenter).toBe('presenter.html');
  });
});

describe('requireLivePort', () => {
  it('answers the live port it resolved', async () => {
    mocks.resolveCdpPort.mockResolvedValueOnce(9555);
    await expect(requireLivePort(9555)).resolves.toBe(9555);
    expect(mocks.resolveCdpPort).toHaveBeenCalledWith({ port: 9555 });
  });

  it('says a pin is dead rather than that no app runs', async () => {
    mocks.resolveCdpPort.mockResolvedValue(null);
    mocks.describeDeadPin.mockReturnValueOnce(
      'Port 9999 was named by OWA_CDP_PORT and is not answering.',
    );
    await expect(requireLivePort()).rejects.toThrow(
      'Port 9999 was named by OWA_CDP_PORT',
    );
    mocks.describeDeadPin.mockReturnValueOnce(null);
    await expect(requireLivePort()).rejects.toThrow(
      'No running Open Worship App was found',
    );
  });
});

describe('evaluateInTarget', () => {
  const target = {
    url: pageUrl('presenter.html'),
    webSocketDebuggerUrl: 'ws://x',
  };

  it('evaluates on one socket and answers the settled value', async () => {
    socketState.onSend = (message, socket) => {
      // Noise first: a line that is not JSON, and an event with no id.
      socket.reply('not json');
      socket.reply({ method: 'Runtime.consoleAPICalled' });
      socket.reply({ id: message.id, result: { result: { value: 42 } } });
    };
    await expect(evaluateInTarget(target, '6 * 7')).resolves.toBe(42);
    const [socket] = socketState.sockets;
    expect(socket.url).toBe('ws://x');
    expect(socket.sent).toEqual([
      {
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: '6 * 7',
          returnByValue: true,
          awaitPromise: true,
          allowUnsafeEvalBlockedByCSP: true,
        },
      },
    ]);
    expect(socket.closeCount).toBe(1);
  });

  it('answers undefined for an expression with no value', async () => {
    socketState.onSend = (message, socket) => {
      socket.reply({ id: message.id });
    };
    await expect(evaluateInTarget(target, 'void 0')).resolves.toBeUndefined();
  });

  it('says what the page threw, without the frames of the made-up script', async () => {
    socketState.onSend = (message, socket) => {
      socket.reply({
        id: message.id,
        result: {
          exceptionDetails: {
            text: 'Uncaught',
            exception: {
              description:
                'Error: That window is not open\n    at <anonymous>:1:7',
            },
          },
        },
      });
    };
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      /^That window is not open$/,
    );

    socketState.onSend = (message, socket) => {
      socket.reply({
        id: message.id,
        result: { exceptionDetails: { text: 'SyntaxError: bad' } },
      });
    };
    await expect(evaluateInTarget(target, '(')).rejects.toThrow(
      'SyntaxError: bad',
    );
  });

  it('passes on a protocol error, and survives a socket already closing', async () => {
    socketState.closeThrows = true;
    socketState.onSend = (message, socket) => {
      socket.reply({ id: message.id, error: { message: 'No such target' } });
    };
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      'No such target',
    );
  });

  it('names the window it could not attach to', async () => {
    socketState.failToOpen = true;
    await expect(evaluateInTarget(target, 'x')).rejects.toThrow(
      `Could not attach to ${target.url}`,
    );
  });

  it('gives up on a page that never answers', async () => {
    socketState.onSend = () => {};
    await expect(evaluateInTarget(target, 'x', 20)).rejects.toThrow(
      `Timed out evaluating in ${target.url}`,
    );
    expect(socketState.sockets[0].closeCount).toBe(1);
  });
});

describe('runInTarget', () => {
  const target = { url: 'x', webSocketDebuggerUrl: 'ws://x' };

  it('ignores what is not an answer to a step it sent', async () => {
    socketState.onSend = (message, socket) => {
      socket.reply('{broken');
      socket.reply({ id: 99, result: {} });
      socket.reply({ id: message.id });
    };
    await expect(
      runInTarget(target, [{ method: 'Page.bringToFront' }]),
    ).resolves.toEqual([{}]);
    expect(socketState.sockets[0].sent[0].params).toEqual({});
  });

  it('names the window it could not attach to', async () => {
    socketState.failToOpen = true;
    await expect(runInTarget(target, [])).rejects.toThrow(
      'Could not attach to x',
    );
  });

  it('stops at its deadline, mid-wait, and sends nothing after it', async () => {
    socketState.onSend = (message, socket) => {
      socket.reply({ id: message.id, result: { ok: true } });
    };
    await expect(
      runInTarget(
        target,
        [
          { method: 'Input.dispatchDragEvent', params: { type: 'dragEnter' } },
          { waitMs: 60 },
          { method: 'Input.dispatchDragEvent', params: { type: 'drop' } },
        ],
        20,
      ),
    ).rejects.toThrow('Timed out acting in x');
    // The wait outlives the deadline; the drop must never be sent.
    await new Promise((resolve) => {
      setTimeout(resolve, 70);
    });
    expect(socketState.sockets[0].sent).toHaveLength(1);
  });
});

describe('evaluateInApp', () => {
  beforeEach(() => {
    mocks.resolveCdpPort.mockImplementation(async () => endpoint.port);
    socketState.onSend = (message, socket) => {
      socket.reply({
        id: message.id,
        result: { result: { value: socket.url } },
      });
    };
  });

  it('evaluates in the main window and hands back the windows it saw', async () => {
    const targets = [
      {
        id: 'R',
        type: 'page',
        url: pageUrl('reader.html'),
        webSocketDebuggerUrl: 'ws://reader',
      },
      {
        id: 'P',
        type: 'page',
        url: pageUrl('presenter.html'),
        webSocketDebuggerUrl: 'ws://presenter',
      },
    ];
    endpoint.lists = [targets];
    const answer = await evaluateInApp('1');
    expect(answer).toEqual({
      port: endpoint.port,
      target: targets[1],
      targets,
      value: 'ws://presenter',
    });
    const aimed = await evaluateInApp('1', { match: 'reader.html' });
    expect(aimed.value).toBe('ws://reader');
  });

  it('names the open pages when the asked-for one is not there', async () => {
    endpoint.lists = [
      [
        { id: 'R', type: 'page', url: pageUrl('reader.html?x=1') },
        { id: 'S', type: 'page', url: pageUrl('setting.html') },
      ],
    ];
    await expect(
      evaluateInApp('1', { match: 'presenter.html' }),
    ).rejects.toThrow(
      'The app has no open page matching "presenter.html". The open pages ' +
        'are: reader.html?x=1, setting.html.',
    );
    endpoint.lists = [[]];
    await expect(evaluateInApp('1')).rejects.toThrow(
      'The app has no open page',
    );
    expect(socketState.sockets).toHaveLength(0);
  });
});

describe('waitForNewAppPage', () => {
  const main = { id: 'A', type: 'page', url: pageUrl('presenter.html') };

  it('polls until the window a press asked for becomes a target', async () => {
    endpoint.lists = [
      [main],
      [main, { id: 'W', type: 'page', url: 'https://example.com/' }],
      [main, { id: 'S', type: 'page', url: pageUrl('setting.html?tab=2') }],
    ];
    await expect(
      waitForNewAppPage(endpoint.port, [main], 2000, 5),
    ).resolves.toBe('setting.html');
  });

  it('looks once when told not to wait, and says nothing opened', async () => {
    endpoint.lists = [[main]];
    await expect(waitForNewAppPage(endpoint.port, [main], 0)).resolves.toBe(
      null,
    );
  });

  it('says nothing either way when the app went away', async () => {
    endpoint.listStatus = 500;
    await expect(
      waitForNewAppPage(endpoint.port, [main], 1000, 5),
    ).resolves.toBeNull();
  });
});
