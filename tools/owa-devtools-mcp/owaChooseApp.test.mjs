import { readFileSync, readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `owa_choose_app` and `owa_app_state`'s version check, through the real
// discovery: which running app an outside agent works with, and whether this
// server is that app's version (2026-11-13, the user's two asks).
const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    default: real,
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});
vi.mock('./cdp.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  evaluateInApp: app.evaluateInApp,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
}));

import {
  chooseAppInstance,
  readChosenAppInstance,
  requireAppChoice,
} from './discovery.mjs';
import { registerOwaTools } from './owaTools.mjs';

const devApp = {
  pid: 19366,
  port: 61001,
  isDev: true,
  version: '2026.11.13',
  userDataPath: '/Users/someone/Library/Application Support/open-worship-app-dev',
  startedAt: '2026-11-13T08:00:00Z',
};
const scratchApp = {
  pid: 2966,
  port: 61002,
  isDev: true,
  version: '2026.11.13',
  userDataPath: '/Users/someone/scratch/profile14',
  startedAt: '2026-11-13T09:00:00Z',
};

let published = [];
let livePidSet = new Set();

function publish(instances) {
  published = instances;
  livePidSet = new Set(instances.map((instance) => instance.pid));
}

function genHandlers(options) {
  const handlers = new Map();
  registerOwaTools(
    {
      registerTool(name, schema, handler) {
        handlers.set(name, { schema, handler });
      },
    },
    options,
  );
  return handlers;
}

function readAnswer(result) {
  return JSON.parse(result.content[0].text);
}

let realReadFileSync;

beforeEach(async () => {
  realReadFileSync = (await vi.importActual('node:fs')).readFileSync;
  vi.stubEnv('OWA_CDP_PORT', '');
  vi.stubEnv('OWA_CDP_TARGET', '');
  vi.spyOn(process, 'kill').mockImplementation((pid) => {
    if (livePidSet.has(pid)) {
      return true;
    }
    throw Object.assign(new Error('gone'), { code: 'ESRCH' });
  });
  vi.mocked(readdirSync).mockImplementation(() => {
    return published.map((_, i) => `${i}.json`);
  });
  vi.mocked(readFileSync).mockImplementation((filePath, ...rest) => {
    const match = /open-worship-app-cdp[\\/](\d+)\.json$/.exec(
      String(filePath),
    );
    if (match !== null) {
      return JSON.stringify(published[Number(match[1])]);
    }
    if (/mcp-version\.json$/.test(String(filePath))) {
      return JSON.stringify({ appVersion: '2026.11.13' });
    }
    return realReadFileSync(filePath, ...rest);
  });
  app.evaluateInApp.mockResolvedValue({ value: 'en' });
  app.listTargets.mockResolvedValue([]);
  publish([devApp, scratchApp]);
  requireAppChoice(true);
});

afterEach(() => {
  chooseAppInstance(null);
  requireAppChoice(false);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('owa_choose_app', () => {
  it('is the stdio door only', () => {
    expect(genHandlers({ door: 'stdio' }).has('owa_choose_app')).toBe(true);
    expect(genHandlers({ door: 'app' }).has('owa_choose_app')).toBe(false);
  });

  it('lists the running apps and asks for a choice when none is made', async () => {
    const handlers = genHandlers({ door: 'stdio' });
    const listed = readAnswer(await handlers.get('owa_choose_app').handler({}));
    expect(listed.apps.map(({ pid }) => pid)).toEqual([2966, 19366]);
    expect(listed.apps[0]).toMatchObject({
      kind: 'development',
      profile: 'profile14',
      isSameVersionAsMcp: true,
    });
    expect(listed.apps.some((row) => row.isWorkedWith)).toBe(false);
    expect(listed.note).toContain('ask the user which one');
    expect(JSON.stringify(listed)).not.toContain('/Users/someone');
  });

  it('chooses one, drops the browser connection once, and marks it', async () => {
    const onAppChosen = vi.fn();
    const handlers = genHandlers({ door: 'stdio', onAppChosen });
    const choose = handlers.get('owa_choose_app').handler;
    const chosen = readAnswer(await choose({ pid: devApp.pid }));
    expect(chosen.chosen).toMatchObject({
      pid: devApp.pid,
      isWorkedWith: true,
    });
    expect(chosen.versionCheck.isMatch).toBe(true);
    expect(readChosenAppInstance()?.pid).toBe(devApp.pid);
    expect(onAppChosen).toHaveBeenCalledTimes(1);
    // The same choice again keeps the connection.
    await choose({ pid: devApp.pid });
    expect(onAppChosen).toHaveBeenCalledTimes(1);
    const listed = readAnswer(await choose({}));
    expect(
      listed.apps.find((row) => row.pid === devApp.pid).isWorkedWith,
    ).toBe(true);
    expect(listed.note).toContain('isWorkedWith');
  });

  it('refuses a pid no running app has, naming the ones there are', async () => {
    const handlers = genHandlers({ door: 'stdio' });
    const result = await handlers.get('owa_choose_app').handler({ pid: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No running Open Worship app');
    expect(result.content[0].text).toContain('pid 19366');
    expect(readChosenAppInstance()).toBeNull();
  });

  it('refuses a choice while OWA_CDP_PORT names the app', async () => {
    vi.stubEnv('OWA_CDP_PORT', String(scratchApp.port));
    const handlers = genHandlers({ door: 'stdio' });
    const result = await handlers
      .get('owa_choose_app')
      .handler({ pid: devApp.pid });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('OWA_CDP_PORT');
    expect(readChosenAppInstance()).toBeNull();
  });
});

describe("owa_app_state's version check", () => {
  it('says which app it read and whether this server is its version', async () => {
    chooseAppInstance(devApp);
    app.requireLivePort.mockResolvedValue(devApp.port);
    const handlers = genHandlers({ door: 'stdio' });
    const state = readAnswer(await handlers.get('owa_app_state').handler({}));
    expect(state.workedWith).toEqual({ pid: devApp.pid, isChosen: true });
    expect(state.versionCheck).toEqual({
      mcp: '2026.11.13',
      app: '2026.11.13',
      isMatch: true,
    });
  });

  it('tells the agent to tell the user when they differ', async () => {
    publish([{ ...devApp, version: '2026.12.1' }]);
    app.requireLivePort.mockResolvedValue(devApp.port);
    const handlers = genHandlers({ door: 'stdio' });
    const state = readAnswer(await handlers.get('owa_app_state').handler({}));
    expect(state.workedWith).toEqual({ pid: devApp.pid, isChosen: false });
    expect(state.versionCheck.isMatch).toBe(false);
    expect(state.versionCheck.note).toContain('OLDER than the app');
  });

  it('costs the in-app door nothing: its app is the code it runs', async () => {
    publish([devApp]);
    app.requireLivePort.mockResolvedValue(devApp.port);
    const handlers = genHandlers({ door: 'app' });
    const state = readAnswer(await handlers.get('owa_app_state').handler({}));
    expect(state).not.toHaveProperty('versionCheck');
    expect(state).not.toHaveProperty('workedWith');
  });
});
