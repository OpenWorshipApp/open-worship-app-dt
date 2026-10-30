import http from 'node:http';
import net from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  checkIsPortAlive,
  connectToCdp,
  pinCdpPort,
  readPublishedInstances,
  resolveCdpPort,
} from './discovery.mjs';

// The published-instance folder is faked, as in `discoveryTarget.test.mjs`;
// the ports are real loopback ones, so "is it up" is answered by a socket.
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

function publish(fileMap) {
  vi.mocked(readdirSync).mockReturnValue(Object.keys(fileMap));
  vi.mocked(readFileSync).mockImplementation((filePath) => {
    const name = String(filePath).split(/[\\/]/).pop();
    return JSON.stringify(fileMap[name]);
  });
}

async function findDeadPort() {
  const probe = net.createServer();
  await new Promise((resolve) => {
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => {
    probe.close(resolve);
  });
  return port;
}

// A CDP endpoint as far as discovery can tell: `/json/version` answers.
let endpoint;
let livePort = 0;
let deadPort = 0;

beforeAll(async () => {
  endpoint = http.createServer((req, res) => {
    res.writeHead(req.url === '/json/version' ? 200 : 404, {
      'content-type': 'application/json',
    });
    res.end('{}');
  });
  await new Promise((resolve) => {
    endpoint.listen(0, '127.0.0.1', resolve);
  });
  livePort = endpoint.address().port;
  deadPort = await findDeadPort();
});

afterAll(async () => {
  await new Promise((resolve) => {
    endpoint.close(resolve);
  });
});

beforeEach(() => {
  vi.stubEnv('OWA_CDP_PORT', '');
  vi.stubEnv('OWA_CDP_TARGET', '');
  publish({});
});

afterEach(() => {
  pinCdpPort(null);
  vi.unstubAllEnvs();
});

describe('readPublishedInstances', () => {
  test('finds nobody when nothing was ever published', () => {
    vi.mocked(readdirSync).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    expect(readPublishedInstances()).toEqual([]);
  });

  test('reads only the instance files, newest first', () => {
    publish({
      'notes.txt': { port: 1 },
      '11.json': { port: 9301, startedAt: '2026-10-01T00:00:00Z' },
      '12.json': { port: 9302, startedAt: '2026-10-02T00:00:00Z' },
      '13.json': { port: 'not a port' },
    });
    expect(readPublishedInstances().map((one) => one.port)).toEqual([
      9302, 9301,
    ]);
    const readNames = vi.mocked(readFileSync).mock.calls.map(([filePath]) => {
      return String(filePath).split(/[\\/]/).pop();
    });
    expect(readNames).not.toContain('notes.txt');
  });
});

describe('checkIsPortAlive and resolveCdpPort', () => {
  test('a port answering /json/version is alive, a closed one is not', async () => {
    expect(await checkIsPortAlive(livePort)).toBe(true);
    expect(await checkIsPortAlive(deadPort, 500)).toBe(false);
  });

  test('takes the first candidate that answers', async () => {
    publish({
      '1.json': { port: deadPort, startedAt: '2026-10-02T00:00:00Z' },
      '2.json': { port: livePort, startedAt: '2026-10-01T00:00:00Z' },
    });
    expect(await resolveCdpPort({ excludePorts: [9223] })).toBe(livePort);
  });

  test('keeps looking until its deadline, then says there is none', async () => {
    const startedAt = Date.now();
    expect(
      await resolveCdpPort({ port: deadPort, timeout: 40, interval: 10 }),
    ).toBeNull();
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(40);
  });
});

describe('connectToCdp', () => {
  test('connects to the first candidate that takes the connection', async () => {
    publish({
      '1.json': { port: deadPort, startedAt: '2026-10-02T00:00:00Z' },
      '2.json': { port: livePort, startedAt: '2026-10-01T00:00:00Z' },
    });
    const { socket, port } = await connectToCdp({ excludePorts: [9223] });
    try {
      expect(port).toBe(livePort);
      expect(socket.remotePort).toBe(livePort);
    } finally {
      socket.destroy();
    }
  });

  test('names the ports it tried when none answered', async () => {
    publish({ '1.json': { port: deadPort } });
    await expect(connectToCdp({ excludePorts: [9223] })).rejects.toThrow(
      `No running Open Worship App found (tried ${deadPort})`,
    );
    publish({});
    await expect(connectToCdp({ excludePorts: [9223] })).rejects.toThrow(
      'No running Open Worship App found (tried nothing)',
    );
  });

  test('says the pinned port is dead rather than that no app runs', async () => {
    vi.stubEnv('OWA_CDP_PORT', String(deadPort));
    await expect(connectToCdp()).rejects.toThrow(
      `Port ${deadPort} was named by OWA_CDP_PORT and is not answering.`,
    );
  });
});
