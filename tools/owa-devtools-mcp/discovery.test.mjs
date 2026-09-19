import { afterEach, describe, expect, test } from 'vitest';

import {
    NO_APP_URL,
    describeDeadPin,
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
    });

    // `MC-30`: the list used to go on to every published instance and the
    // legacy fallbacks, and `resolveCdpPort` takes the first that ANSWERS --
    // so a pin that had died drove whatever was published last, which is the
    // packaged app with the user's real data when one is up. A named port is
    // now that port or nothing, the way `resolveAppBrowserUrl` always was.
    test('a port named on purpose is the WHOLE list', () => {
        pinCdpPort(() => 60377);
        expect(listCandidatePorts()).toEqual([60377]);
        pinCdpPort(null);
        process.env.OWA_CDP_PORT = '9223';
        expect(listCandidatePorts()).toEqual([9223]);
    });

    test('with nothing named it still walks discovery and the fallbacks', () => {
        pinCdpPort(null);
        expect(listCandidatePorts().length).toBeGreaterThan(0);
    });

    // The message a person reads when their pin is dead. The old one said "no
    // app is running" with the app right there on another port.
    test('a dead pin is described, and nothing else is', () => {
        pinCdpPort(null);
        expect(describeDeadPin()).toBe(null);
        process.env.OWA_CDP_PORT = '9223';
        const described = describeDeadPin();
        expect(described).toContain('9223');
        expect(described).toContain('OWA_CDP_PORT');
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
