import { readFileSync, readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  NO_APP_URL,
  checkIsAppChoiceProblem,
  chooseAppInstance,
  describeAppChoiceList,
  describeAppChoiceProblem,
  findDrivenInstance,
  requireAppChoice,
  resolveAppBrowserUrl,
  toAppChoiceRow,
} from './discovery.mjs';

// The published instances are a fake folder: nothing is read from, or
// written into, the real one running apps publish to.
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const versionState = vi.hoisted(() => ({ mcpVersion: '2026.11.13' }));
vi.mock('./mcpVersion.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  readMcpVersion: () => versionState.mcpVersion,
}));

const devApp = {
  pid: 31001,
  port: 62001,
  isDev: true,
  version: '2026.11.13',
  userDataPath: '/Users/someone/Library/Application Support/owa-dev',
  startedAt: '2026-11-14T08:00:00Z',
};
const installedApp = {
  pid: 31002,
  port: 62002,
  isDev: false,
  version: '2026.11.2',
  userDataPath: 'C:\\Users\\someone\\AppData\\Roaming\\owa',
  startedAt: '2026-11-14T07:00:00Z',
};

let livePidSet = new Set();

function publish(instances) {
  livePidSet = new Set(instances.map((instance) => instance.pid));
  vi.mocked(readdirSync).mockReturnValue(
    instances.map((_, index) => `${index}.json`),
  );
  vi.mocked(readFileSync).mockImplementation((filePath) => {
    const match = String(filePath).match(/(\d+)\.json$/);
    if (match === null) {
      throw new Error('not published');
    }
    return JSON.stringify(instances[Number(match[1])]);
  });
}

beforeEach(() => {
  vi.stubEnv('OWA_CDP_PORT', '');
  vi.stubEnv('OWA_CDP_TARGET', '');
  versionState.mcpVersion = '2026.11.13';
  vi.spyOn(process, 'kill').mockImplementation((pid) => {
    if (livePidSet.has(pid)) {
      return true;
    }
    throw Object.assign(new Error('gone'), { code: 'ESRCH' });
  });
  publish([devApp, installedApp]);
  requireAppChoice(true);
});

afterEach(() => {
  chooseAppInstance(null);
  requireAppChoice(false);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkIsAppChoiceProblem', () => {
  test('several running apps and none chosen is a problem, one app is not', () => {
    expect(checkIsAppChoiceProblem()).toBe(true);
    publish([installedApp]);
    expect(checkIsAppChoiceProblem()).toBe(false);
    // Chosen, the other app running beside it changes nothing.
    publish([devApp, installedApp]);
    chooseAppInstance(devApp);
    expect(checkIsAppChoiceProblem()).toBe(false);
  });
});

describe('a chosen app that told no profile', () => {
  test('is gone when its process is, and no other app takes its place', () => {
    // An app too old to publish its profile.
    chooseAppInstance({ pid: 31009, isDev: true });
    const sameKind = { ...devApp, pid: 31010 };
    publish([sameKind, installedApp]);

    expect(findDrivenInstance()).toBeNull();
    expect(resolveAppBrowserUrl()).toBe(NO_APP_URL);
    const text = describeAppChoiceProblem();
    expect(text).toContain(
      'The app chosen with owa_choose_app (pid 31009) is no longer running',
    );
    expect(text).toContain('pid 31010');
    expect(checkIsAppChoiceProblem()).toBe(true);
  });
});

describe('the choice list', () => {
  test('says when an app is not the version of this server', () => {
    const row = toAppChoiceRow(installedApp);
    expect(row).toEqual({
      pid: 31002,
      kind: 'installed app',
      version: '2026.11.2',
      isSameVersionAsMcp: false,
      profile: 'owa',
      startedAt: '2026-11-14 07:00 UTC',
    });
    const lines = describeAppChoiceList([devApp, installedApp]).split('\n');
    expect(lines[0]).not.toContain('NOT the version');
    expect(lines[1]).toBe(
      '- pid 31002, installed app, version 2026.11.2, profile "owa", ' +
        'started 2026-11-14 07:00 UTC, NOT the version of this MCP server',
    );
  });

  test('a version the server cannot read is never called a mismatch', () => {
    versionState.mcpVersion = null;
    expect(toAppChoiceRow(installedApp).isSameVersionAsMcp).toBeNull();
    expect(describeAppChoiceList([installedApp])).not.toContain('NOT');
  });

  test('names no profile, start or version it was not told', () => {
    const bare = { pid: 31003, port: 62003, userDataPath: '' };
    expect(toAppChoiceRow(bare)).toEqual({
      pid: 31003,
      kind: 'installed app',
      version: null,
      isSameVersionAsMcp: null,
      profile: null,
      startedAt: null,
    });
    expect(toAppChoiceRow({ ...bare, userDataPath: 42 }).profile).toBeNull();
    expect(toAppChoiceRow({ ...bare, userDataPath: '///' }).profile).toBeNull();
    expect(describeAppChoiceList([bare])).toBe(
      '- pid 31003, installed app, version unknown, the newest',
    );
  });

  test('marks the app being worked with', () => {
    expect(toAppChoiceRow(devApp, { drivenPid: 31001 }).isWorkedWith).toBe(
      true,
    );
    expect(toAppChoiceRow(devApp, { drivenPid: 31002 })).not.toHaveProperty(
      'isWorkedWith',
    );
  });
});
