import { describe, expect, test, vi } from 'vitest';

// Only `describeLlmError` is under test, and it touches nothing -- but the
// module pulls both SDKs and the setting store in at import time, so they are
// stubbed down to what loading needs.
vi.mock('../helper/ai/aiHelpers', () => ({
    getAISetting: () => ({ openAIAPIKey: '', anthropicAPIKey: '' }),
}));
vi.mock('../helper/ai/anthropicHelpers', () => ({
    getAnthropicInstance: () => null,
}));
vi.mock('../helper/ai/openAIHelpers', () => ({
    getOpenAIInstance: () => null,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));
vi.mock('./mcpClient', () => ({
    callTool: async () => '',
    listTools: async () => [],
}));

import { describeLlmError } from './llmBotHelpers';

// What the window shows when a call fails. The person reading it is a
// volunteer minutes before a service, so every branch has to come back as one
// line they can act on -- never the raw JSON body both SDKs put in `message`.
describe('describeLlmError', () => {
    test('a refused key sends them to the panel that holds it', () => {
        expect(describeLlmError({ status: 401 })).toContain(
            'Settings → Others',
        );
        expect(describeLlmError({ status: 403 })).toContain(
            'Settings → Others',
        );
    });

    test('a missing workspace id names the field to fill in', () => {
        const error = {
            status: 400,
            error: {
                error: {
                    message:
                        'anthropic-workspace-id is required when ' +
                        'authenticating with an identity-linked API key',
                },
            },
        };

        expect(describeLlmError(error)).toContain('workspace id');
        expect(describeLlmError(error)).toContain('Settings → Others');
    });

    test('a rate limit is said in money terms, not in HTTP', () => {
        expect(describeLlmError({ status: 429 })).toBe(
            'the AI account is out of credit or being rate-limited',
        );
    });

    test("the provider's own fault is not blamed on the user", () => {
        expect(describeLlmError({ status: 500 })).toBe(
            'the AI service is having trouble right now',
        );
        expect(describeLlmError({ status: 503 })).toBe(
            'the AI service is having trouble right now',
        );
    });

    // Mid-service on a church machine this is nearly always the real cause.
    test('no status at all reads as the connection, not as a bug', () => {
        expect(describeLlmError(new Error('fetch failed'))).toBe(
            'it could not be reached — the internet may be down',
        );
    });

    // Both SDKs prefix the raw JSON body with the status code. Showing that
    // is frightening, and the markdown renderer eats its underscores.
    test('a raw JSON body is never passed through', () => {
        const message =
            '400 {"type":"error","error":{"type":"invalid_request_error",' +
            '"message":"max_tokens: is too large"}}';

        const said = describeLlmError({ status: 400, message });

        expect(said).not.toContain('{');
        expect(said).toBe('the AI service refused the request (error 400)');
    });

    test('a short plain message is worth passing on as it is', () => {
        expect(
            describeLlmError({ status: 400, message: 'model not found' }),
        ).toBe('model not found');
    });

    test('a message too long for one line falls back to the status', () => {
        expect(
            describeLlmError({ status: 400, message: 'x'.repeat(400) }),
        ).toBe('the AI service refused the request (error 400)');
    });

    test('a status nested under `response` is found too', () => {
        expect(describeLlmError({ response: { status: 429 } })).toBe(
            'the AI account is out of credit or being rate-limited',
        );
    });
});
