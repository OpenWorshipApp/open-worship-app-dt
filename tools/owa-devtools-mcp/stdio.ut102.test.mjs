// The stdio door as functions, with what sits behind it faked: the MCP
// server, chrome-devtools-mcp's stdio transport and the discovery of the
// app driven. What is checked is the wiring -- which language folders the
// server is told to read, and what serving and closing do.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  findDrivenInstance: vi.fn(),
  configureLangPacks: vi.fn(),
  createOwaMcpServer: vi.fn(),
  logToStderr: vi.fn(),
  transports: [],
}));

vi.mock('chrome-devtools-mcp/build/src/third_party/index.js', () => ({
  StdioServerTransport: class FakeStdioServerTransport {
    constructor() {
      state.transports.push(this);
    }
  },
}));
vi.mock('./discovery.mjs', () => ({
  findDrivenInstance: state.findDrivenInstance,
}));
vi.mock('./langPacks.mjs', () => ({
  configureLangPacks: state.configureLangPacks,
}));
vi.mock('./server.mjs', () => ({
  createOwaMcpServer: state.createOwaMcpServer,
}));
vi.mock('./stderrLog.mjs', () => ({ logToStderr: state.logToStderr }));

import {
  configureDrivenLangPacks,
  createStdioDoorServer,
  runOwaMcpStdioServer,
} from './stdio.mjs';

function genServer() {
  return {
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

function readLister() {
  expect(state.configureLangPacks).toHaveBeenCalledTimes(1);
  const [[lister]] = state.configureLangPacks.mock.calls;
  expect(typeof lister).toBe('function');
  return lister;
}

beforeEach(() => {
  state.transports.length = 0;
});

describe('configureDrivenLangPacks', () => {
  it('reads the languages the driven app has installed, read afresh each time', () => {
    configureDrivenLangPacks();
    const lister = readLister();
    // Nothing is asked of the app until a language is wanted.
    expect(state.findDrivenInstance).not.toHaveBeenCalled();

    state.findDrivenInstance.mockReturnValue({
      pid: 1,
      langDirs: ['/data/lang/xx@1.0.0', '/data/lang/yy@2.0.0'],
    });
    expect(lister()).toEqual(['/data/lang/xx@1.0.0', '/data/lang/yy@2.0.0']);

    // The app it drives now is another one.
    state.findDrivenInstance.mockReturnValue({
      pid: 2,
      langDirs: ['/other/lang/xx@1.0.0'],
    });
    expect(lister()).toEqual(['/other/lang/xx@1.0.0']);
    expect(state.findDrivenInstance).toHaveBeenCalledTimes(2);
  });

  it("falls back to the checkout's packages when no app says", () => {
    configureDrivenLangPacks();
    const lister = readLister();
    // No app running.
    state.findDrivenInstance.mockReturnValue(null);
    expect(lister()).toBeNull();
    // An app too old to publish its folders.
    state.findDrivenInstance.mockReturnValue({ pid: 3 });
    expect(lister()).toBeNull();
    // Something that is not a list.
    state.findDrivenInstance.mockReturnValue({ pid: 4, langDirs: 'xx' });
    expect(lister()).toBeNull();
  });
});

describe('createStdioDoorServer', () => {
  it("passes chrome-devtools' own arguments and log file to the server", async () => {
    const server = genServer();
    state.createOwaMcpServer.mockResolvedValue({ server });
    const created = await createStdioDoorServer({
      argv: ['--headless'],
      logFile: '/tmp/owa.log',
    });
    expect(created).toEqual({ server });
    expect(state.createOwaMcpServer).toHaveBeenCalledWith({
      argv: ['--headless'],
      logFile: '/tmp/owa.log',
    });
    // The languages are wired before the server is made.
    expect(state.configureLangPacks.mock.invocationCallOrder[0]).toBeLessThan(
      state.createOwaMcpServer.mock.invocationCallOrder[0],
    );
  });

  it('takes no arguments at all', async () => {
    state.createOwaMcpServer.mockResolvedValue({ server: genServer() });
    await createStdioDoorServer();
    expect(state.createOwaMcpServer).toHaveBeenCalledWith({
      argv: [],
      logFile: undefined,
    });
  });
});

describe('runOwaMcpStdioServer', () => {
  it('serves on stdio, says so, and closes the server when asked', async () => {
    const server = genServer();
    state.createOwaMcpServer.mockResolvedValue({ server });
    const log = vi.fn();
    const door = await runOwaMcpStdioServer({ argv: ['--x'], log });

    expect(state.transports).toHaveLength(1);
    expect(server.connect).toHaveBeenCalledWith(state.transports[0]);
    expect(log).toHaveBeenCalledWith('connected over stdio');
    expect(state.logToStderr).not.toHaveBeenCalled();
    expect(door.server).toBe(server);
    expect(server.close).not.toHaveBeenCalled();

    await door.close();
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('logs to stderr unless told otherwise', async () => {
    state.createOwaMcpServer.mockResolvedValue({ server: genServer() });
    await runOwaMcpStdioServer();
    expect(state.logToStderr).toHaveBeenCalledWith('connected over stdio');
  });

  it('a server that cannot connect is never said to be serving', async () => {
    const server = genServer();
    server.connect.mockRejectedValue(new Error('stdin is closed'));
    state.createOwaMcpServer.mockResolvedValue({ server });
    const log = vi.fn();
    await expect(runOwaMcpStdioServer({ log })).rejects.toThrow(
      'stdin is closed',
    );
    expect(log).not.toHaveBeenCalled();
  });
});
