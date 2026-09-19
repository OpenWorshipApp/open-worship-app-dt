/**
 * The capture wall's rules, against the REAL address dialect. The point of
 * reading `webUrlPolicy.mjs` itself rather than a stub is that `127.1`,
 * `0x7f.1` and `localtest.me` are exactly what a hand-written twin gets wrong.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => {
    return {
        session: { fromPartition: vi.fn() },
    };
});
vi.mock('./aiHelpers', () => {
    return { importEsm: vi.fn(), toMcpPackagePath: vi.fn() };
});

import { checkIsLocalHostname } from '../tools/owa-devtools-mcp/webUrlPolicy.mjs';
import {
    checkIsCaptureRequestAllowed,
    checkIsCaptureUrlAllowed,
} from './webCaptureHelpers';

const policy = { checkIsLocalHostname };

function checkAllowed(url: string, captureHostname: string) {
    return checkIsCaptureRequestAllowed(url, captureHostname, policy);
}

describe('checkIsCaptureUrlAllowed', () => {
    it('takes a web address', () => {
        expect(checkIsCaptureUrlAllowed('https://example.com/a')).toBe(true);
        expect(checkIsCaptureUrlAllowed('http://192.168.1.50/notices')).toBe(
            true,
        );
    });

    it('refuses anything that is not one', () => {
        // The disk read `webSecurity: false` would otherwise allow.
        expect(
            checkIsCaptureUrlAllowed('file:///C:/Users/me/setting.json'),
        ).toBe(false);
        expect(checkIsCaptureUrlAllowed('data:text/html,<b>hi')).toBe(false);
        expect(checkIsCaptureUrlAllowed('owa://local/presenter.html')).toBe(
            false,
        );
        expect(checkIsCaptureUrlAllowed('not a url')).toBe(false);
    });
});

describe('checkIsCaptureRequestAllowed', () => {
    it('lets a public page reach the public internet', () => {
        expect(checkAllowed('https://example.com/a.png', 'example.com')).toBe(
            true,
        );
        expect(checkAllowed('https://cdn.other.com/a.js', 'example.com')).toBe(
            true,
        );
    });

    it('never lets a public page reach this machine', () => {
        for (const url of [
            'http://127.0.0.1:39223/mcp',
            'http://127.0.0.2:9223/json/version',
            'http://localhost:3000/presenter.html',
            'http://127.1/',
            'ws://127.0.0.1:9223/devtools/page/1',
            'http://[::1]:39223/mcp',
        ]) {
            expect(checkAllowed(url, 'example.com')).toBe(false);
        }
    });

    it('never lets a public page reach the room', () => {
        for (const url of [
            'http://192.168.1.1/admin',
            'http://10.0.0.5/nas',
            'http://172.16.4.9/printer',
            'http://nas.local/share',
        ]) {
            expect(checkAllowed(url, 'example.com')).toBe(false);
        }
    });

    it('lets the intranet notice board load ITSELF', () => {
        expect(
            checkAllowed('http://192.168.1.50/logo.png', '192.168.1.50'),
        ).toBe(true);
        expect(
            checkAllowed('http://10.0.0.5/a.css', '10.0.0.5'),
            'own host',
        ).toBe(true);
    });

    it('does not let it reach the rest of the room', () => {
        expect(checkAllowed('http://192.168.1.1/admin', '192.168.1.50')).toBe(
            false,
        );
        expect(checkAllowed('http://127.0.0.1:39223/mcp', '192.168.1.50')).toBe(
            false,
        );
    });

    it('gives this machine no same-host exemption at all', () => {
        // A slide pointed at the app's own door may not walk to the next port,
        // nor to itself: loopback is where both doors live.
        expect(
            checkAllowed('http://127.0.0.1:9223/json/list', '127.0.0.1'),
        ).toBe(false);
        expect(checkAllowed('http://localhost:3000/a', 'localhost')).toBe(
            false,
        );
    });

    it('refuses a request it cannot parse', () => {
        expect(checkAllowed('not a url', 'example.com')).toBe(false);
    });
});
