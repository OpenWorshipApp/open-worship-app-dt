import { afterEach, describe, expect, test } from 'vitest';

import {
    NO_APP_URL,
    listCandidatePorts,
    pinCdpPort,
    resolveAppBrowserUrl,
} from './discovery.mjs';

const newest = { pid: 2, port: 60401, startedAt: '2026-09-10T00:30:00.000Z' };
const older = { pid: 1, port: 60377, startedAt: '2026-09-10T00:29:00.000Z' };

describe('pinCdpPort', () => {
    afterEach(() => {
        pinCdpPort(null);
        delete process.env.OWA_CDP_PORT;
    });

    // The in-app host lives inside ONE instance. Measured with the packaged
    // app up and a dev build started after it: the packaged app's own chatbot
    // reported the dev window's pages, because discovery is newest-first.
    test('the instance that owns the host wins over a newer published one', () => {
        pinCdpPort(() => older.port);
        expect(resolveAppBrowserUrl([newest, older])).toBe(
            `http://127.0.0.1:${older.port}`,
        );
    });

    // The `owa_*` tools resolve the app on their own, through the candidate
    // list rather than chrome-devtools' `browserUrl`; the pin must lead both.
    test('the pinned port heads the candidate list', () => {
        process.env.OWA_CDP_PORT = '9223';
        pinCdpPort(() => 60377);
        const ports = listCandidatePorts();
        expect(ports[0]).toBe(60377);
        expect(ports).toContain(9223);
    });

    test('a pinned port beats a pinned env port too', () => {
        process.env.OWA_CDP_PORT = '9223';
        pinCdpPort(() => 60377);
        expect(resolveAppBrowserUrl([newest])).toBe('http://127.0.0.1:60377');
    });

    // Chromium reports its port after `ready`; a session opened before that
    // must still reach an app rather than launching a browser of its own.
    test('a pin not known yet falls through to the env port, then discovery', () => {
        pinCdpPort(() => null);
        process.env.OWA_CDP_PORT = '9223';
        expect(resolveAppBrowserUrl([newest])).toBe('http://127.0.0.1:9223');
        delete process.env.OWA_CDP_PORT;
        expect(resolveAppBrowserUrl([newest, older])).toBe(
            `http://127.0.0.1:${newest.port}`,
        );
    });

    test('with nothing to go on it answers a URL that connects to nothing', () => {
        expect(resolveAppBrowserUrl([])).toBe(NO_APP_URL);
        expect(NO_APP_URL).not.toBe('');
    });
});
