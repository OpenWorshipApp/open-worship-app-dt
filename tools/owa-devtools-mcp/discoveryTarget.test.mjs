import { readFileSync, readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    NO_APP_URL,
    connectToCdp,
    describeDeadPin,
    listCandidatePorts,
    pinCdpPort,
    resolveAppBrowserUrl,
    resolveCdpPort,
} from './discovery.mjs';

vi.mock('node:fs', () => ({
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
}));

const dev = { port: 60401, isDev: true, startedAt: '2026-10-07T00:29:00Z' };
const prod = { port: 60377, isDev: false, startedAt: '2026-10-07T00:30:00Z' };
const unknown = { port: 60555, startedAt: '2026-10-07T00:31:00Z' };

function publish(instances) {
    vi.mocked(readdirSync).mockReturnValue(
        instances.map((_, i) => `${i}.json`),
    );
    vi.mocked(readFileSync).mockImplementation((filePath) => {
        const index = Number(String(filePath).match(/(\d+)\.json$/)[1]);
        return JSON.stringify(instances[index]);
    });
}

beforeEach(() => {
    vi.stubEnv('OWA_CDP_PORT', '');
    vi.stubEnv('OWA_CDP_TARGET', '');
    publish([dev, prod, unknown]);
});

afterEach(() => {
    pinCdpPort(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('OWA_CDP_TARGET', () => {
    test.each([
        ['dev', dev.port],
        ['prod', prod.port],
    ])('%s selects the same kind for both tool groups', (target, port) => {
        vi.stubEnv('OWA_CDP_TARGET', target);
        expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${port}`);
        expect(listCandidatePorts()).toEqual([port]);
    });

    test('an unset target preserves newest-first discovery and the legacy fallback', () => {
        expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${unknown.port}`);
        expect(listCandidatePorts()).toEqual([
            unknown.port,
            prod.port,
            dev.port,
            9223,
        ]);
    });

    test('each lookup follows the newly published port after a restart', () => {
        vi.stubEnv('OWA_CDP_TARGET', 'dev');
        expect(listCandidatePorts()).toEqual([dev.port]);
        publish([{ ...dev, port: 60402 }, prod]);
        expect(resolveAppBrowserUrl()).toBe('http://127.0.0.1:60402');
        expect(listCandidatePorts()).toEqual([60402]);
    });

    test('multiple matching instances remain newest-first and exclude the bridge listener', () => {
        vi.stubEnv('OWA_CDP_TARGET', 'dev');
        publish([
            dev,
            { ...dev, port: 60402, startedAt: '2026-10-07T00:32:00Z' },
            prod,
        ]);
        expect(resolveAppBrowserUrl()).toBe('http://127.0.0.1:60402');
        expect(listCandidatePorts()).toEqual([60402, dev.port]);
        expect(listCandidatePorts({ excludePorts: [60402] })).toEqual([
            dev.port,
        ]);
    });

    test.each(['dev', 'prod'])(
        'a missing %s never falls through to another kind or legacy port',
        async (target) => {
            vi.stubEnv('OWA_CDP_TARGET', target);
            publish([target === 'dev' ? prod : dev, unknown]);
            const fetcher = vi.fn();
            vi.stubGlobal('fetch', fetcher);
            expect(resolveAppBrowserUrl()).toBe(NO_APP_URL);
            expect(listCandidatePorts()).toEqual([]);
            expect(await resolveCdpPort()).toBe(null);
            expect(fetcher).not.toHaveBeenCalled();
            await expect(connectToCdp()).rejects.toThrow(
                `OWA_CDP_TARGET=${target}`,
            );
            expect(describeDeadPin()).toContain('AI features enabled');
        },
    );

    test('a dead matching endpoint never probes the responding other kind', async () => {
        vi.stubEnv('OWA_CDP_TARGET', 'dev');
        const fetcher = vi.fn(async (url) => ({
            ok: new URL(url).port === String(prod.port),
        }));
        vi.stubGlobal('fetch', fetcher);
        expect(await resolveCdpPort()).toBe(null);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(
            fetcher.mock.calls.every(
                ([url]) => new URL(url).port === String(dev.port),
            ),
        ).toBe(true);
    });

    test.each(['DEV', 'production', 'deev', ' '])(
        'an invalid target %j fails before discovery can connect',
        (target) => {
            vi.stubEnv('OWA_CDP_TARGET', target);
            expect(() => resolveAppBrowserUrl()).toThrow(
                'OWA_CDP_TARGET must be dev or prod',
            );
            expect(() => listCandidatePorts()).toThrow(
                'OWA_CDP_TARGET must be dev or prod',
            );
            expect(() => connectToCdp()).toThrow(
                'OWA_CDP_TARGET must be dev or prod',
            );
        },
    );

    test('explicit port pins retain priority over the kind', () => {
        vi.stubEnv('OWA_CDP_TARGET', 'dev');
        vi.stubEnv('OWA_CDP_PORT', String(prod.port));
        expect(resolveAppBrowserUrl()).toBe(`http://127.0.0.1:${prod.port}`);
        expect(listCandidatePorts()).toEqual([prod.port]);
        expect(describeDeadPin()).toContain('OWA_CDP_PORT');
        pinCdpPort(() => 60403);
        expect(resolveAppBrowserUrl()).toBe('http://127.0.0.1:60403');
        expect(listCandidatePorts()).toEqual([60403]);
        expect(describeDeadPin()).toContain('this app instance');
        expect(listCandidatePorts({ port: 60404 })).toEqual([60404]);
    });
});
