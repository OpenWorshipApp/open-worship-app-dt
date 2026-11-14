import { describe, expect, test, vi } from 'vitest';

import {
    STDIO_SERVER_INSTRUCTIONS,
    checkIsBrowserTool,
    guardAppChoice,
} from './appChoice.mjs';
import {
    compareAppVersions,
    genMcpVersionFileText,
    genVersionCheck,
} from './mcpVersion.mjs';

function genTransport() {
    const inner = vi.fn(() => 'forwarded');
    const transport = { onmessage: inner, send: vi.fn() };
    return { transport, inner };
}

function genCall(id, name) {
    return { jsonrpc: '2.0', id, method: 'tools/call', params: { name } };
}

describe('the app choice at the door', () => {
    test('a browser tool waits for the choice, with the list as its answer', () => {
        const { transport, inner } = genTransport();
        guardAppChoice(transport, { describeProblem: () => 'Ask the user.' });
        expect(transport.onmessage(genCall(7, 'take_snapshot'))).toBeUndefined();
        expect(inner).not.toHaveBeenCalled();
        expect(transport.send).toHaveBeenCalledWith({
            jsonrpc: '2.0',
            id: 7,
            result: {
                content: [{ type: 'text', text: 'Ask the user.' }],
                isError: true,
            },
        });
    });

    test('the owa tools, lists and a settled choice go through', () => {
        let problem = 'Ask the user.';
        const { transport, inner } = genTransport();
        guardAppChoice(transport, { describeProblem: () => problem });
        // The owa tools answer the list themselves, and owa_choose_app is
        // how the choice is made.
        transport.onmessage(genCall(1, 'owa_choose_app'));
        transport.onmessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
        problem = null;
        transport.onmessage(genCall(3, 'click'));
        expect(inner).toHaveBeenCalledTimes(3);
        expect(transport.send).not.toHaveBeenCalled();
    });

    test('wraps a transport once', () => {
        const { transport } = genTransport();
        guardAppChoice(transport, { describeProblem: () => null });
        const wrapped = transport.onmessage;
        guardAppChoice(transport, { describeProblem: () => null });
        expect(transport.onmessage).toBe(wrapped);
        expect(guardAppChoice(null)).toBeNull();
    });

    test('names which tools reach the app through the browser', () => {
        expect(checkIsBrowserTool('click')).toBe(true);
        expect(checkIsBrowserTool('owa_click')).toBe(false);
        expect(checkIsBrowserTool('')).toBe(false);
        expect(checkIsBrowserTool(undefined)).toBe(false);
    });

    test('the instructions name the version check and the choice', () => {
        expect(STDIO_SERVER_INSTRUCTIONS).toContain('versionCheck');
        expect(STDIO_SERVER_INSTRUCTIONS).toContain('owa_choose_app');
        // Read on every connect by most clients: kept short.
        expect(STDIO_SERVER_INSTRUCTIONS.length).toBeLessThan(500);
    });
});

describe('the MCP version against the app', () => {
    test('compares part by part, as numbers', () => {
        expect(compareAppVersions('2026.11.02', '2026.11.2')).toBe(0);
        expect(compareAppVersions('2026.11.2', '2026.11.13')).toBe(-1);
        expect(compareAppVersions('v2026.12.1', '2026.11.30')).toBe(1);
        expect(compareAppVersions(null, '2026.11.2')).toBeNull();
        expect(compareAppVersions('2026.11.2', 'dev')).toBeNull();
    });

    test('a match is said without a note', () => {
        expect(genVersionCheck('2026.11.02', '2026.11.2')).toEqual({
            mcp: '2026.11.2',
            app: '2026.11.02',
            isMatch: true,
        });
    });

    test('an older server says to update it, a newer one the app', () => {
        const older = genVersionCheck('2026.11.13', '2026.11.2');
        expect(older.isMatch).toBe(false);
        expect(older.note).toContain('OLDER than the app');
        expect(older.note).toContain('Extra Binaries > Update');
        expect(older.note).toContain('Tell the user');
        const newer = genVersionCheck('2026.11.2', '2026.11.13');
        expect(newer.isMatch).toBe(false);
        expect(newer.note).toContain('NEWER than the app');
        expect(newer.note).toContain('Update the app');
    });

    test('an unknown version is a sentence, not a guess', () => {
        const check = genVersionCheck(undefined, '2026.11.2');
        expect(check).toMatchObject({ app: null, isMatch: null });
        expect(check.note).toContain('unknown');
    });

    test('the file staged beside the server', () => {
        expect(JSON.parse(genMcpVersionFileText('2026.11.13'))).toEqual({
            appVersion: '2026.11.13',
        });
        expect(genMcpVersionFileText('1.0.0').endsWith('\n')).toBe(true);
    });
});
