import { readFileSync, readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkIsPortAlive,
  connectToCdp,
  describeDeadPin,
  listCandidatePorts,
  pinCdpPort,
  readLiveInstances,
  readPublishedInstances,
  resolveAppBrowserUrl,
  resolveCdpPort,
} from './discovery.mjs';

// The published discovery folder is read through a mocked `node:fs` (never the
// real temp folder, where whatever instance is running would leak in), and
// `net.connect` hands back fake sockets that connect or fail as a test plans
// it -- a refused connection to a closed port takes ~2 s on Windows, and a
// real port could belong to anything.
const discoveryState = vi.hoisted(() => {
  return { connectCalls: [], connectPlan: new Map(), sockets: [] };
});

vi.mock('node:fs', () => {
  return { readFileSync: vi.fn(), readdirSync: vi.fn() };
});
vi.mock('node:net', async () => {
  const { EventEmitter } = await import('node:events');
  const connect = (port, host) => {
    discoveryState.connectCalls.push([port, host]);
    const socket = new EventEmitter();
    socket.destroyCount = 0;
    socket.destroy = () => {
      socket.destroyCount += 1;
    };
    discoveryState.sockets.push(socket);
    const outcome = discoveryState.connectPlan.get(port) ?? 'error';
    queueMicrotask(() => {
      if (outcome === 'connect') {
        socket.emit('connect');
      } else {
        socket.emit('error', Object.assign(new Error('refused'), {}));
      }
    });
    return socket;
  };
  return { connect, default: { connect } };
});

// One file per published instance; `files` maps a file name to its text, or
// to an Error the read throws.
function publish(files) {
  vi.mocked(readdirSync).mockReturnValue(Object.keys(files));
  vi.mocked(readFileSync).mockImplementation((filePath) => {
    const name = String(filePath).split(/[\\/]/).pop();
    const content = files[name];
    if (content instanceof Error) {
      throw content;
    }
    return typeof content === 'string' ? content : JSON.stringify(content);
  });
}

function stubFetch(isOk) {
  const fetchSpy = vi.fn(async (url) => {
    const { hostname, port } = new URL(url);
    const answer = isOk(Number(port), hostname);
    if (answer instanceof Error) {
      throw answer;
    }
    return { ok: answer };
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

const newest = { port: 60555, startedAt: '2026-11-03T00:31:00.000Z' };
const dev = { port: 60401, isDev: true, startedAt: '2026-11-03T00:30:00.000Z' };
const oldest = { port: 60377, startedAt: '2026-11-03T00:29:00.000Z' };

beforeEach(() => {
  vi.stubEnv('OWA_CDP_PORT', '');
  vi.stubEnv('OWA_CDP_TARGET', '');
  discoveryState.connectCalls = [];
  discoveryState.connectPlan = new Map();
  discoveryState.sockets = [];
  publish({});
});

afterEach(() => {
  pinCdpPort(null);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('readPublishedInstances', () => {
  // A killed app never ran its cleanup and a write can be caught halfway:
  // neither may stop the live instances being found.
  test('reads every well-formed instance file, newest first, and skips the rest', () => {
    publish({
      'notes.txt': 'not an instance',
      '1.json': oldest,
      'half.json': '{"port": 6040',
      'locked.json': Object.assign(new Error('EACCES'), { code: 'EACCES' }),
      'text-port.json': { port: '60999', startedAt: '2026-11-03T01:00:00Z' },
      '2.json': newest,
      '3.json': dev,
    });
    expect(readPublishedInstances()).toEqual([newest, dev, oldest]);
    const readNames = vi.mocked(readFileSync).mock.calls.map(([filePath]) => {
      return String(filePath).split(/[\\/]/).pop();
    });
    expect(readNames).not.toContain('notes.txt');
  });

  test('no discovery folder at all is no instances', () => {
    vi.mocked(readdirSync).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    expect(readPublishedInstances()).toEqual([]);
    expect(resolveAppBrowserUrl()).toBe('http://127.0.0.1:1');
  });
});

describe('readLiveInstances', () => {
  // Signal 0 only probes. A process owned by someone else answers EPERM --
  // alive -- and only ESRCH means the instance is gone.
  test('drops an instance whose process is gone, keeps one it cannot signal', () => {
    publish({
      'gone.json': { ...newest, pid: 101 },
      'other-user.json': { ...dev, pid: 102 },
      'alive.json': { ...oldest, pid: 103 },
      'no-pid.json': { port: 60300, startedAt: '2026-11-03T00:00:00Z' },
    });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid) => {
      if (pid === 101) {
        throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
      }
      if (pid === 102) {
        throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
      }
      return true;
    });
    expect(
      readLiveInstances().map((instance) => {
        return instance.port;
      }),
    ).toEqual([dev.port, oldest.port, 60300]);
    expect(killSpy.mock.calls).toEqual([
      [101, 0],
      [102, 0],
      [103, 0],
    ]);
    // The candidate list never offers the dead one.
    expect(listCandidatePorts()).toEqual([dev.port, oldest.port, 60300, 9223]);
  });
});

describe('the pin', () => {
  test('a pin that is not a function, or answers no port, pins nothing', () => {
    publish({ 'a.json': newest });
    pinCdpPort(60377);
    expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${newest.port}`);
    pinCdpPort(() => 'soon');
    expect(listCandidatePorts()).toEqual([newest.port, 9223]);
    pinCdpPort(() => 0);
    expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${newest.port}`);
  });

  test('a dead pin with nothing published says no app published anything', () => {
    vi.stubEnv('OWA_CDP_PORT', '9999');
    expect(describeDeadPin()).toBe(
      'Port 9999 was named by OWA_CDP_PORT and is not answering. No ' +
        'running app has published a port at all.',
    );
  });
});

describe('checkIsPortAlive', () => {
  test('asks 127.0.0.1 first, and stops there when it answers', async () => {
    const fetchSpy = stubFetch(() => {
      return true;
    });
    await expect(checkIsPortAlive(60401)).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:60401/json/version',
      { signal: expect.any(AbortSignal) },
    );
  });

  test('falls back to localhost when 127.0.0.1 does not answer', async () => {
    const fetchSpy = stubFetch((_port, hostname) => {
      return hostname === 'localhost'
        ? true
        : new TypeError('connect ECONNREFUSED');
    });
    await expect(checkIsPortAlive(60401)).resolves.toBe(true);
    expect(
      fetchSpy.mock.calls.map(([url]) => {
        return new URL(url).hostname;
      }),
    ).toEqual(['127.0.0.1', 'localhost']);
  });

  test('a port that answers with an error status on both hosts is not alive', async () => {
    stubFetch(() => {
      return false;
    });
    await expect(checkIsPortAlive(60401)).resolves.toBe(false);
  });
});

describe('resolveCdpPort', () => {
  test('answers the first candidate that responds, best first', async () => {
    publish({ 'a.json': newest, 'b.json': dev });
    const fetchSpy = stubFetch((port) => {
      return port === dev.port;
    });
    await expect(resolveCdpPort()).resolves.toBe(dev.port);
    expect(
      fetchSpy.mock.calls.map(([url]) => {
        return Number(new URL(url).port);
      }),
    ).toEqual([newest.port, newest.port, dev.port]);
  });

  // An app still booting has published nothing yet.
  test('with a timeout it keeps looking until one answers', async () => {
    vi.useFakeTimers();
    publish({ 'a.json': dev });
    let isUp = false;
    const fetchSpy = stubFetch((port) => {
      return isUp && port === dev.port;
    });
    const resolving = resolveCdpPort({ timeout: 5000, interval: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    // One round: the published port and the legacy one, on both hosts.
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    isUp = true;
    await vi.advanceTimersByTimeAsync(1000);
    await expect(resolving).resolves.toBe(dev.port);
  });

  test('gives up at the deadline', async () => {
    vi.useFakeTimers();
    publish({ 'a.json': dev });
    const fetchSpy = stubFetch(() => {
      return false;
    });
    const resolving = resolveCdpPort({ timeout: 1500, interval: 1000 });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(resolving).resolves.toBe(null);
    // Rounds at 0, 1000 and 2000 ms; the last is past the deadline.
    expect(fetchSpy).toHaveBeenCalledTimes(12);
  });
});

describe('connectToCdp', () => {
  // Connecting IS the liveness check, on 127.0.0.1 only.
  test('tries each candidate in turn and keeps the first that connects', async () => {
    publish({ 'a.json': newest, 'b.json': dev });
    discoveryState.connectPlan.set(dev.port, 'connect');
    const { socket, port } = await connectToCdp();
    expect(port).toBe(dev.port);
    expect(discoveryState.connectCalls).toEqual([
      [newest.port, '127.0.0.1'],
      [dev.port, '127.0.0.1'],
    ]);
    const [refused, connected] = discoveryState.sockets;
    expect(refused.destroyCount).toBe(1);
    expect(socket).toBe(connected);
    expect(connected.destroyCount).toBe(0);
    // The bridge puts its own error handler on; the probe's is gone.
    expect(connected.listenerCount('error')).toBe(0);
  });

  test('when none connects it says what it tried', async () => {
    publish({ 'a.json': newest });
    await expect(connectToCdp()).rejects.toThrow(
      `No running Open Worship App found (tried ${newest.port}, 9223)`,
    );
  });

  test('with every candidate excluded it dials nothing', async () => {
    publish({ 'a.json': newest });
    await expect(
      connectToCdp({ excludePorts: [newest.port, 9223] }),
    ).rejects.toThrow('No running Open Worship App found (tried nothing)');
    expect(discoveryState.connectCalls).toEqual([]);
  });

  test('a pinned port that does not connect says what the app published', async () => {
    publish({ 'a.json': dev });
    vi.stubEnv('OWA_CDP_PORT', '9999');
    await expect(connectToCdp()).rejects.toThrow(
      'Port 9999 was named by OWA_CDP_PORT and is not answering. The app ' +
        `published ${dev.port} (dev). Point OWA_CDP_PORT at one of those, ` +
        'or unset it to take the newest.',
    );
    expect(discoveryState.connectCalls).toEqual([[9999, '127.0.0.1']]);
  });
});
