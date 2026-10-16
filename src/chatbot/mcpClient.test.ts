import { afterEach, describe, expect, test, vi } from 'vitest';

// `appProvider` reaches `document` at module scope and these tests run in the
// node environment, so the one thing this client asks of it -- where the tool
// host is -- is stubbed.
const { fake } = vi.hoisted(() => ({
    fake: {
        mcpUrl: 'http://127.0.0.1:39223/mcp' as string | null,
        mcpToken: 'test-token' as string | null,
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendDataSync: () => {
                return {
                    mcpUrl: fake.mcpUrl,
                    mcpToken: fake.mcpToken,
                    cdpPort: null,
                };
            },
        },
    },
}));

import {
    ToolHostError,
    callToolPicture,
    checkIsToolHostError,
    listTools,
} from './mcpClient';

// A host that opens a session and answers `tools/call` with `content`,
// remembering the arguments each call was sent.
function stubToolHost(content: any[], isError = false) {
    const calls: any[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init: any) => {
            const body = JSON.parse(init.body);
            if (body.method === 'notifications/initialized') {
                return new Response(null, { status: 202 });
            }
            if (body.method === 'tools/call') {
                calls.push(body.params);
            }
            return new Response(
                JSON.stringify({
                    result:
                        body.method === 'tools/call'
                            ? { content, isError }
                            : {},
                }),
                { status: 200, headers: { 'mcp-session-id': 'S1' } },
            );
        }),
    );
    return calls;
}

// The 📷 with a window of its own chosen: `owa_screenshot` of that window.
describe('a picture from a tool', () => {
    const aim = {
        windowId: 'EDITOR',
        focus: 'appDocumentEditor' as const,
        isSeparateWindow: true,
    };

    test('comes back as a data URL, taken in the chosen window', async () => {
        const calls = stubToolHost([
            { type: 'text', text: 'A picture of the app as it is right now.' },
            { type: 'image', mimeType: 'image/png', data: 'AAAA' },
        ]);
        await expect(
            callToolPicture('owa_screenshot', {}, null, aim),
        ).resolves.toBe('data:image/png;base64,AAAA');
        expect(calls).toEqual([
            { name: 'owa_screenshot', arguments: { page: 'EDITOR' } },
        ]);
    });

    test("says the tool's own words when there is no picture", async () => {
        stubToolHost([{ type: 'text', text: 'That window is not open' }], true);
        await expect(
            callToolPicture('owa_screenshot', {}, null, aim),
        ).rejects.toThrow('That window is not open');
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    fake.mcpUrl = 'http://127.0.0.1:39223/mcp';
    fake.mcpToken = 'test-token';
});

describe('the app tool host failing', () => {
    test('is said in words, not as a status code', async () => {
        // Measured 2026-09-12: the window printed "The assistant service
        // answered 500" to a volunteer, with nothing to do about it.
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                return new Response('{"error":"boom"}', { status: 500 });
            }),
        );
        const error = await listTools().catch((caught) => {
            return caught;
        });
        expect(checkIsToolHostError(error)).toBe(true);
        expect(error.hostStatus).toBe(500);
        expect(error.message).not.toContain('500');
        expect(error.message).toContain('Relaunch');
        expect(fetch).toHaveBeenCalledWith(
            fake.mcpUrl,
            expect.objectContaining({
                headers: expect.objectContaining({
                    authorization: 'Bearer test-token',
                }),
            }),
        );
    });

    test('carries no `status`, so no provider fault is read into it', () => {
        // `readLlmIssue` reads `status` as the AI provider's, and a 500 there
        // is a provider fault -- which would hand the question to another of
        // the user's keys for a failure no key can fix.
        expect('status' in new ToolHostError(500)).toBe(false);
    });

    test('a host that is not running at all is not this error', async () => {
        fake.mcpUrl = null;
        const error = await listTools().catch((caught) => {
            return caught;
        });
        expect(error).toBeInstanceOf(Error);
        expect(checkIsToolHostError(error)).toBe(false);
    });

    test('a missing capability is treated as a host that is not running', async () => {
        fake.mcpToken = null;
        vi.stubGlobal('fetch', vi.fn());
        const error = await listTools().catch((caught) => caught);
        expect(error).toBeInstanceOf(Error);
        expect(checkIsToolHostError(error)).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });
});
