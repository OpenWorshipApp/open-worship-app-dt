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

import { ToolHostError, checkIsToolHostError, listTools } from './mcpClient';

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
