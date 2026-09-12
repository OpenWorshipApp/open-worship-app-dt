import { describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => {
    return { app: {}, session: {}, shell: {} };
});

import {
    AI_CHAT_PARTITION,
    checkIsGuestAttachAllowed,
    checkIsGuestRequestAllowed,
    checkIsGuestUrlAllowed,
    toGuestWebPreferences,
} from './aiChatGuestHelpers';
import { checkIsLocalHostname } from '../tools/owa-devtools-mcp/webUrlPolicy.mjs';

describe('checkIsGuestUrlAllowed', () => {
    test('the web, and nothing on this machine', () => {
        expect(checkIsGuestUrlAllowed('https://chatgpt.com/')).toBe(true);
        expect(checkIsGuestUrlAllowed('http://example.com/')).toBe(true);
        expect(checkIsGuestUrlAllowed('file:///C:/Users/x/setting.json')).toBe(
            false,
        );
        expect(checkIsGuestUrlAllowed('owa://local/presenter.html')).toBe(
            false,
        );
        expect(checkIsGuestUrlAllowed('javascript:alert(1)')).toBe(false);
        expect(checkIsGuestUrlAllowed('about:blank')).toBe(false);
        expect(checkIsGuestUrlAllowed('not a url')).toBe(false);
    });
});

describe('checkIsGuestAttachAllowed', () => {
    test('an https site on the locked-down partition, and only that', () => {
        expect(
            checkIsGuestAttachAllowed({
                src: 'https://claude.ai/new',
                partition: AI_CHAT_PARTITION,
            }),
        ).toBe(true);
        expect(
            checkIsGuestAttachAllowed({
                src: 'http://claude.ai/new',
                partition: AI_CHAT_PARTITION,
            }),
        ).toBe(false);
        expect(
            checkIsGuestAttachAllowed({
                src: 'file:///C:/x.html',
                partition: AI_CHAT_PARTITION,
            }),
        ).toBe(false);
        expect(checkIsGuestAttachAllowed({ src: 'https://claude.ai/' })).toBe(
            false,
        );
        expect(
            checkIsGuestAttachAllowed({
                src: 'https://claude.ai/',
                partition: 'persist:other',
            }),
        ).toBe(false);
        expect(checkIsGuestAttachAllowed({})).toBe(false);
    });
});

describe('toGuestWebPreferences', () => {
    test('forces the sandbox whatever the page asked for', () => {
        const webPreferences = toGuestWebPreferences({
            preload: 'C:/evil.js',
            preloadURL: 'file:///C:/evil.js',
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            webSecurity: false,
        } as any);
        expect(webPreferences).toEqual({
            nodeIntegration: false,
            nodeIntegrationInSubFrames: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
        });
        expect('preload' in webPreferences).toBe(false);
        expect('preloadURL' in webPreferences).toBe(false);
    });
});

// The wall is only as good as the policy behind it, so this runs against the
// REAL one rather than a stub: the two halves ship together or not at all.
const policy = { checkIsLocalHostname };

describe('checkIsGuestRequestAllowed', () => {
    test('the public internet, and nothing on this machine', () => {
        expect(
            checkIsGuestRequestAllowed('https://claude.ai/new', policy),
        ).toBe(true);
        expect(
            checkIsGuestRequestAllowed(
                'https://cdn.oaistatic.com/a.js?v=1',
                policy,
            ),
        ).toBe(true);
        expect(checkIsGuestRequestAllowed('http://example.com/', policy)).toBe(
            true,
        );
    });

    test('refuses the app own doors, however they are spelled', () => {
        // The MCP host and the CDP endpoint. Measured 2026-09-12: a no-cors
        // fetch at both was served before this wall existed.
        expect(
            checkIsGuestRequestAllowed('http://127.0.0.1:39223/mcp', policy),
        ).toBe(false);
        expect(
            checkIsGuestRequestAllowed(
                'http://127.0.0.1:50597/json/list',
                policy,
            ),
        ).toBe(false);
        expect(
            checkIsGuestRequestAllowed(
                'https://localhost:3000/presenter.html',
                policy,
            ),
        ).toBe(false);
        // Every classic way of writing loopback, canonicalised by the URL
        // parser before the policy reads it.
        for (const address of [
            'http://127.1/',
            'http://2130706433/',
            'http://0x7f.1/',
            'http://0177.0.0.1/',
            'http://127.0.0.2/',
            'http://[::1]/',
            'http://[::ffff:7f00:1]/',
            'http://LOCALHOST./',
            'http://0.0.0.0/',
        ]) {
            expect([
                address,
                checkIsGuestRequestAllowed(address, policy),
            ]).toEqual([address, false]);
        }
    });

    test('refuses the church own network', () => {
        for (const address of [
            'http://192.168.1.1/',
            'http://10.0.0.5/',
            'https://172.16.0.1/',
            'http://169.254.169.254/latest/meta-data/',
            'http://printer/',
            'http://nas.local/',
            'http://files.intranet/',
        ]) {
            expect([
                address,
                checkIsGuestRequestAllowed(address, policy),
            ]).toEqual([address, false]);
        }
    });

    test('refuses what it cannot read as an address', () => {
        expect(checkIsGuestRequestAllowed('not a url', policy)).toBe(false);
        expect(checkIsGuestRequestAllowed('', policy)).toBe(false);
    });
});
