import { describe, expect, test } from 'vitest';

import {
    OPEN_AI_SETTING_TOOL_NAME,
    OPEN_PROVIDER_PAGE_TOOL_NAME,
    PAID_PROVIDER_PAGE_MAP,
    checkIsProviderIssue,
    genProviderIssueActions,
    getLlmProviderPageUrl,
    readLlmIssue,
} from './providerIssueHelpers';

// The shapes below are the ones each provider DOCUMENTS (read 2026-09-10),
// in the object the SDK actually throws: `status`, and the body under
// `error` -- Anthropic wraps its own (`{type: "error", error: {...}}`),
// OpenAI and Kimi do not.
function genAnthropicError(status: number, type: string, message: string) {
    return {
        status,
        message: `${status} ${JSON.stringify({ type: 'error', error: { type, message } })}`,
        error: { type: 'error', error: { type, message } },
    };
}

function genOpenAiError(
    status: number,
    body: { code?: string; type?: string; message: string },
) {
    return {
        status,
        message: `${status} ${body.message}`,
        error: { param: null, ...body },
        code: body.code ?? null,
        type: body.type ?? null,
    };
}

describe('readLlmIssue', () => {
    test('an Anthropic empty account is a 402, and a 400 that says so', () => {
        expect(
            readLlmIssue(
                genAnthropicError(
                    402,
                    'billing_error',
                    'There is an issue with your billing.',
                ),
            ).kind,
        ).toBe('noCredit');
        // The older shape, still the one most people have seen: a plain
        // 400 whose only clue is the sentence.
        expect(
            readLlmIssue(
                genAnthropicError(
                    400,
                    'invalid_request_error',
                    'Your credit balance is too low to access the Anthropic ' +
                        'API. Please go to Plans & Billing to upgrade or ' +
                        'purchase credits.',
                ),
            ).kind,
        ).toBe('noCredit');
        // And an organisation's own spend limit, which the API also files
        // under 400.
        expect(
            readLlmIssue(
                genAnthropicError(
                    400,
                    'invalid_request_error',
                    'Your organization has reached its spend limit.',
                ),
            ).kind,
        ).toBe('noCredit');
    });

    test('a plain 400 is the request, not the account', () => {
        const issue = readLlmIssue(
            genAnthropicError(
                400,
                'invalid_request_error',
                'max_tokens: is too large',
            ),
        );
        expect(issue.kind).toBe('other');
        expect(issue.message).toBe('max_tokens: is too large');
    });

    test('an OpenAI 429 is read by its code, not its status', () => {
        expect(
            readLlmIssue(
                genOpenAiError(429, {
                    code: 'insufficient_quota',
                    type: 'insufficient_quota',
                    message:
                        'You exceeded your current quota, please check ' +
                        'your plan and billing details.',
                }),
            ).kind,
        ).toBe('noCredit');
        // The name OpenAI's error guide gives it now.
        expect(
            readLlmIssue(
                genOpenAiError(429, {
                    code: 'credit_balance_exhausted',
                    message: 'Your credit balance is exhausted.',
                }),
            ).kind,
        ).toBe('noCredit');
        expect(
            readLlmIssue(
                genOpenAiError(429, {
                    code: 'rate_limit_exceeded',
                    type: 'requests',
                    message: 'Rate limit reached for gpt-5 in organization.',
                }),
            ).kind,
        ).toBe('rateLimited');
        expect(
            readLlmIssue(
                genOpenAiError(503, {
                    code: 'server_is_overloaded',
                    type: 'service_unavailable_error',
                    message: 'The model is temporarily overloaded.',
                }),
            ).kind,
        ).toBe('overloaded');
    });

    test('a Kimi 429 can be an empty account, a rate limit or a busy engine', () => {
        expect(
            readLlmIssue(
                genOpenAiError(429, {
                    type: 'exceeded_current_quota_error',
                    message:
                        'Account balance is insufficient or the account ' +
                        'has been disabled.',
                }),
            ).kind,
        ).toBe('noCredit');
        expect(
            readLlmIssue(
                genOpenAiError(429, {
                    type: 'rate_limit_reached_error',
                    message: 'Your account has reached its RPM limit.',
                }),
            ).kind,
        ).toBe('rateLimited');
        expect(
            readLlmIssue(
                genOpenAiError(429, {
                    type: 'engine_overloaded_error',
                    message:
                        'The engine is currently overloaded, please try ' +
                        'again later.',
                }),
            ).kind,
        ).toBe('overloaded');
    });

    test('a 429 that says nothing more is left ambiguous', () => {
        expect(readLlmIssue({ status: 429 }).kind).toBe('quotaOrRate');
        expect(readLlmIssue({ response: { status: 429 } }).kind).toBe(
            'quotaOrRate',
        );
    });

    test('a refused key is the key whatever the provider calls it', () => {
        expect(readLlmIssue({ status: 401 }).kind).toBe('badKey');
        expect(readLlmIssue({ status: 403 }).kind).toBe('badKey');
        expect(
            readLlmIssue(
                genOpenAiError(401, {
                    code: 'invalid_api_key',
                    message: 'Incorrect API key provided.',
                }),
            ).kind,
        ).toBe('badKey');
        expect(
            readLlmIssue(
                genOpenAiError(401, {
                    type: 'incorrect_api_key_error',
                    message: 'Incorrect API key provided',
                }),
            ).kind,
        ).toBe('badKey');
    });

    test('a workspace id missing is its own kind, on any status', () => {
        const issue = readLlmIssue({
            status: 400,
            error: {
                error: {
                    message:
                        'anthropic-workspace-id is required when ' +
                        'authenticating with an identity-linked API key',
                },
            },
        });
        expect(issue.kind).toBe('workspace');
    });

    test('the service being down is its own kind, and 529 is capacity', () => {
        expect(readLlmIssue({ status: 500 }).kind).toBe('serverTrouble');
        expect(readLlmIssue({ status: 503 }).kind).toBe('serverTrouble');
        expect(readLlmIssue({ status: 529 }).kind).toBe('overloaded');
        expect(
            readLlmIssue(
                genAnthropicError(529, 'overloaded_error', 'Overloaded'),
            ).kind,
        ).toBe('overloaded');
    });

    test('a 404 is a model this account cannot run', () => {
        expect(readLlmIssue({ status: 404 }).kind).toBe('modelMissing');
        expect(
            readLlmIssue(
                genAnthropicError(
                    404,
                    'not_found_error',
                    'model: claude-nonesuch',
                ),
            ).kind,
        ).toBe('modelMissing');
    });

    test('no status at all is the connection', () => {
        expect(readLlmIssue(new Error('fetch failed')).kind).toBe(
            'unreachable',
        );
        expect(readLlmIssue(null).kind).toBe('unreachable');
        expect(readLlmIssue(undefined).kind).toBe('unreachable');
    });

    test('a body left only in the message is still read', () => {
        // What a test fake, or a gateway that dropped the structured fields,
        // hands over: the raw body behind its status and nothing else.
        const issue = readLlmIssue({
            status: 429,
            message:
                '429 {"error":{"message":"You have no credits remaining.",' +
                '"type":"insufficient_quota"}}',
        });
        expect(issue.kind).toBe('noCredit');
        expect(issue.code).toBe('insufficient_quota');
        expect(issue.message).toBe('You have no credits remaining.');
    });

    test('a raw body never becomes the message', () => {
        const issue = readLlmIssue({
            status: 400,
            message: '400 {"type":"error","error":{"type":"x","message":"y"}}',
        });
        expect(issue.message).not.toContain('{');
    });
});

describe('checkIsProviderIssue', () => {
    test("the account, the key and the service are the provider's", () => {
        for (const kind of [
            'noCredit',
            'badKey',
            'rateLimited',
            'quotaOrRate',
            'overloaded',
            'serverTrouble',
        ] as const) {
            expect(
                checkIsProviderIssue({
                    kind,
                    status: null,
                    code: null,
                    message: '',
                }),
            ).toBe(true);
        }
    });

    test('the request, the model and the connection are not', () => {
        for (const kind of ['modelMissing', 'unreachable', 'other'] as const) {
            expect(
                checkIsProviderIssue({
                    kind,
                    status: null,
                    code: null,
                    message: '',
                }),
            ).toBe(false);
        }
        // A workspace refusal is the key's; the same words on a 400 are a
        // request the API could not take.
        expect(
            checkIsProviderIssue({
                kind: 'workspace',
                status: 401,
                code: null,
                message: '',
            }),
        ).toBe(true);
        expect(
            checkIsProviderIssue({
                kind: 'workspace',
                status: 400,
                code: null,
                message: '',
            }),
        ).toBe(false);
    });
});

describe('getLlmProviderPageUrl', () => {
    test('answers only a provider and a page NAME from the table', () => {
        expect(getLlmProviderPageUrl('openai', 'billing')).toBe(
            PAID_PROVIDER_PAGE_MAP.openai.billing,
        );
        expect(getLlmProviderPageUrl('anthropic', 'status')).toBe(
            'https://status.anthropic.com',
        );
        // Kimi keeps no status page; the keyless provider keeps no pages.
        expect(getLlmProviderPageUrl('kimi', 'status')).toBeNull();
        expect(getLlmProviderPageUrl('free', 'billing')).toBeNull();
        // Nothing that is not a name: the shape a hand-edited session file
        // would carry.
        expect(
            getLlmProviderPageUrl('openai', 'https://evil.example'),
        ).toBeNull();
        expect(getLlmProviderPageUrl('__proto__', 'billing')).toBeNull();
        expect(getLlmProviderPageUrl(undefined, undefined)).toBeNull();
    });

    test('every paid provider keeps the three pages a fault can need', () => {
        for (const pages of Object.values(PAID_PROVIDER_PAGE_MAP)) {
            for (const url of [pages.billing, pages.keys, pages.limits]) {
                expect(url).toMatch(/^https:\/\//);
            }
        }
    });
});

describe('genProviderIssueActions', () => {
    test('an empty account gets the billing page, named for the provider', () => {
        expect(
            genProviderIssueActions('openai', 'noCredit', 'ChatGPT'),
        ).toEqual([
            {
                label: 'Open ChatGPT billing',
                toolName: OPEN_PROVIDER_PAGE_TOOL_NAME,
                args: { provider: 'openai', page: 'billing' },
            },
        ]);
    });

    test('a refused key gets the app settings AND the keys page', () => {
        const actions = genProviderIssueActions(
            'anthropic',
            'badKey',
            'Claude',
        );
        expect(actions.map((one) => one.label)).toEqual([
            'Open AI settings',
            'Open Claude API keys',
        ]);
        expect(actions[0].toolName).toBe(OPEN_AI_SETTING_TOOL_NAME);
    });

    test('an ambiguous 429 gets both doors, a plain rate limit one', () => {
        expect(
            genProviderIssueActions('kimi', 'quotaOrRate', 'Kimi').map(
                (one) => {
                    return one.label;
                },
            ),
        ).toEqual(['Open Kimi billing', 'Open Kimi usage limits']);
        expect(
            genProviderIssueActions('kimi', 'rateLimited', 'Kimi').map(
                (one) => {
                    return one.label;
                },
            ),
        ).toEqual(['Open Kimi usage limits']);
    });

    test('a page the provider does not keep is not offered', () => {
        // Kimi has no status page, so a busy Kimi gets the settings panel
        // (the way to another key) rather than a dead button.
        expect(
            genProviderIssueActions('kimi', 'serverTrouble', 'Kimi').map(
                (one) => {
                    return one.toolName;
                },
            ),
        ).toEqual([OPEN_AI_SETTING_TOOL_NAME]);
        expect(
            genProviderIssueActions('openai', 'overloaded', 'ChatGPT').map(
                (one) => {
                    return one.label;
                },
            ),
        ).toEqual(['ChatGPT status page']);
    });

    test('the keyless provider is sent to the settings panel', () => {
        expect(
            genProviderIssueActions('free', 'quotaOrRate', 'Free').map(
                (one) => {
                    return one.toolName;
                },
            ),
        ).toEqual([OPEN_AI_SETTING_TOOL_NAME]);
    });

    test('nothing a console can fix gets no button', () => {
        expect(
            genProviderIssueActions('openai', 'unreachable', 'ChatGPT'),
        ).toEqual([]);
        expect(genProviderIssueActions('openai', 'other', 'ChatGPT')).toEqual(
            [],
        );
        expect(
            genProviderIssueActions('openai', 'modelMissing', 'ChatGPT'),
        ).toEqual([]);
    });
});
