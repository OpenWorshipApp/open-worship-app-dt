import { readFileSync, readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    NO_APP_URL,
    chooseAppInstance,
    describeAppChoiceProblem,
    describeDeadPin,
    findDrivenInstance,
    listCandidatePorts,
    listChoosableInstances,
    readChosenAppInstance,
    requireAppChoice,
    resolveAppBrowserUrl,
    toAppChoiceRow,
} from './discovery.mjs';

vi.mock('node:fs', () => ({
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
}));

// The user's machine on the day: two development apps on their own profiles
// and the installed app, all with AI features on.
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
const installedApp = {
    pid: 4120,
    port: 61003,
    isDev: false,
    version: '2026.11.2',
    userDataPath: '/Users/someone/Library/Application Support/open-worship-app',
    startedAt: '2026-11-13T07:00:00Z',
};

let livePidSet = new Set();

function publish(instances) {
    livePidSet = new Set(instances.map((instance) => instance.pid));
    vi.mocked(readdirSync).mockReturnValue(
        instances.map((_, i) => `${i}.json`),
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
    vi.spyOn(process, 'kill').mockImplementation((pid) => {
        if (livePidSet.has(pid)) {
            return true;
        }
        throw Object.assign(new Error('gone'), { code: 'ESRCH' });
    });
    publish([devApp, scratchApp, installedApp]);
    requireAppChoice(true);
});

afterEach(() => {
    chooseAppInstance(null);
    requireAppChoice(false);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('several running apps and none chosen', () => {
    test('no app is driven, and both tool halves say so', () => {
        expect(findDrivenInstance()).toBeNull();
        expect(resolveAppBrowserUrl()).toBe(NO_APP_URL);
        // No port at all: never the newest in silence, nor the legacy one.
        expect(listCandidatePorts()).toEqual([]);
        const text = describeDeadPin();
        expect(text).toBe(describeAppChoiceProblem());
        expect(text).toContain('3 Open Worship apps are running');
        expect(text).toContain('owa_choose_app');
        expect(text).toContain('Nothing was done');
    });

    test('the list tells them apart by pid, kind, version and profile', () => {
        const text = describeAppChoiceProblem();
        expect(text).toContain(
            'pid 2966, development, version 2026.11.13, profile "profile14"',
        );
        expect(text).toContain('installed app, version 2026.11.2');
        expect(text).toContain('profile "open-worship-app-dev"');
        // Newest first, said once.
        expect(text.indexOf('pid 2966')).toBeLessThan(
            text.indexOf('pid 19366'),
        );
        expect(text.match(/the newest/g)).toHaveLength(1);
        // The profile is the folder's own name: no account name.
        expect(text).not.toContain('/Users/someone');
        expect(text).toContain('AI features turned off is not listed');
    });

    test('a single app needs no choice', () => {
        publish([installedApp]);
        expect(describeAppChoiceProblem()).toBeNull();
        expect(findDrivenInstance()?.pid).toBe(installedApp.pid);
    });

    test('scripts that never asked for a choice keep newest-first', () => {
        requireAppChoice(false);
        expect(describeAppChoiceProblem()).toBeNull();
        expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${scratchApp.port}`);
        expect(listCandidatePorts()).toContain(scratchApp.port);
    });

    test('a port named on purpose wins over the choice', () => {
        vi.stubEnv('OWA_CDP_PORT', String(installedApp.port));
        expect(describeAppChoiceProblem()).toBeNull();
        expect(findDrivenInstance()?.pid).toBe(installedApp.pid);
        expect(resolveAppBrowserUrl()).toBe(
            `http://127.0.0.1:${installedApp.port}`,
        );
    });

    test('a kind pin that leaves one app needs no choice', () => {
        vi.stubEnv('OWA_CDP_TARGET', 'prod');
        expect(listChoosableInstances().map(({ pid }) => pid)).toEqual([
            installedApp.pid,
        ]);
        expect(describeAppChoiceProblem()).toBeNull();
    });
});

describe('a chosen app', () => {
    test('is the one both halves drive, not the newest', () => {
        chooseAppInstance(devApp);
        expect(readChosenAppInstance()).toEqual({
            pid: devApp.pid,
            userDataPath: devApp.userDataPath,
            isDev: true,
        });
        expect(describeAppChoiceProblem()).toBeNull();
        expect(findDrivenInstance()?.pid).toBe(devApp.pid);
        expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${devApp.port}`);
        expect(listCandidatePorts()).toEqual([devApp.port]);
    });

    test('is followed across a restart on its own profile and kind', () => {
        chooseAppInstance(devApp);
        const restarted = {
            ...devApp,
            pid: 19999,
            port: 61009,
            startedAt: '2026-11-13T10:00:00Z',
        };
        publish([restarted, scratchApp, installedApp]);
        expect(findDrivenInstance()?.pid).toBe(19999);
        expect(resolveAppBrowserUrl()).toBe('http://127.0.0.1:61009');
        expect(readChosenAppInstance()?.pid).toBe(19999);
    });

    test('that quit is never replaced by another app', () => {
        chooseAppInstance(scratchApp);
        publish([devApp, installedApp]);
        expect(findDrivenInstance()).toBeNull();
        expect(resolveAppBrowserUrl()).toBe(NO_APP_URL);
        expect(listCandidatePorts()).toEqual([]);
        const text = describeDeadPin();
        expect(text).toContain('pid 2966) is no longer running');
        expect(text).toContain('pid 19366');
        expect(text).toContain('owa_choose_app');
    });

    test('a row marks the app worked with', () => {
        const row = toAppChoiceRow(devApp, { drivenPid: devApp.pid });
        expect(row).toMatchObject({
            pid: devApp.pid,
            kind: 'development',
            version: '2026.11.13',
            profile: 'open-worship-app-dev',
            startedAt: '2026-11-13 08:00 UTC',
            isWorkedWith: true,
        });
        expect(toAppChoiceRow(installedApp, { drivenPid: devApp.pid })).not.toHaveProperty(
            'isWorkedWith',
        );
    });
});
