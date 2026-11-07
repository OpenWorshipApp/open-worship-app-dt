import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `appProvider` reaches `document` at module scope and this runs in the node
// environment, so the one thing the client asks of it -- where the tool host
// is, and the bearer token -- is stubbed. `isThrowing` stands in for a main
// process that has no handler for the ask.
const { fake } = vi.hoisted(() => ({
    fake: {
        mcpUrl: 'http://127.0.0.1:39223/mcp' as string | null,
        mcpToken: 'tok-3f9a-secret' as string | null,
        isThrowing: false,
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendDataSync: () => {
                if (fake.isThrowing) {
                    throw new Error('No handler registered');
                }
                return {
                    mcpUrl: fake.mcpUrl,
                    mcpToken: fake.mcpToken,
                    cdpPort: null,
                };
            },
        },
    },
}));

type ClientType = typeof import('./mcpClient');
type HostReplyType = {
    status: number;
    body?: unknown;
    sessionId?: string;
};
type SeenCallType = {
    url: string;
    init: any;
    body: any;
    session: string | null;
};

// The session id lives in the module, so every test starts on a fresh copy
// of it: no test depends on a session another one left open.
async function loadClient(): Promise<ClientType> {
    vi.resetModules();
    return await import('./mcpClient');
}

// A tool host scripted per request. Every request is remembered with the
// session it carried, so a test can say what was asked, in what order and on
// which session.
function stubHost(answer: (call: SeenCallType) => HostReplyType) {
    const seenList: SeenCallType[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: any) => {
            const call: SeenCallType = {
                url,
                init,
                body: JSON.parse(init.body),
                session: init.headers['mcp-session-id'] ?? null,
            };
            seenList.push(call);
            const reply = answer(call);
            const headers: Record<string, string> = {};
            if (reply.sessionId !== undefined) {
                headers['mcp-session-id'] = reply.sessionId;
            }
            return new Response(
                reply.body === undefined ? null : JSON.stringify(reply.body),
                { status: reply.status, headers },
            );
        }),
    );
    return seenList;
}

// The host's two session calls answered as a well host answers them; every
// other method goes to `onCall`.
function genHost(
    onCall: (call: SeenCallType) => HostReplyType,
    newSessionId = 'S1',
) {
    return (call: SeenCallType): HostReplyType => {
        if (call.body.method === 'initialize') {
            return {
                status: 200,
                body: { result: { protocolVersion: '2025-06-18' } },
                sessionId: newSessionId,
            };
        }
        if (call.body.method === 'notifications/initialized') {
            return { status: 202 };
        }
        return onCall(call);
    };
}

function toolResult(result: unknown): HostReplyType {
    return { status: 200, body: { jsonrpc: '2.0', result } };
}

function methodsOf(seenList: SeenCallType[]) {
    return seenList.map((call) => {
        return call.body.method;
    });
}

beforeEach(() => {
    fake.mcpUrl = 'http://127.0.0.1:39223/mcp';
    fake.mcpToken = 'tok-3f9a-secret';
    fake.isThrowing = false;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('the bearer token', () => {
    test('travels in a header and never in the address, the body or a result', async () => {
        const client = await loadClient();
        const seenList = stubHost(
            genHost(() => {
                return toolResult({
                    content: [{ type: 'text', text: 'The Presenter is open.' }],
                });
            }),
        );
        const text = await client.callTool('owa_app_state', {}, null, null);
        expect(text).toBe('The Presenter is open.');
        expect(methodsOf(seenList)).toEqual([
            'initialize',
            'notifications/initialized',
            'tools/call',
        ]);
        for (const call of seenList) {
            expect(call.url).toBe('http://127.0.0.1:39223/mcp');
            expect(call.url).not.toContain('tok-3f9a-secret');
            expect(call.init.body).not.toContain('tok-3f9a-secret');
            expect(call.init.headers.authorization).toBe(
                'Bearer tok-3f9a-secret',
            );
            expect(call.init.method).toBe('POST');
        }
        expect(text).not.toContain('tok-3f9a-secret');
    });

    test('a main process that cannot say where the host is reads as no host', async () => {
        const client = await loadClient();
        fake.isThrowing = true;
        expect(client.getAiEndpoints()).toEqual({
            mcpUrl: null,
            mcpToken: null,
            cdpPort: null,
        });
        vi.stubGlobal('fetch', vi.fn());
        await expect(client.callTool('owa_app_state')).rejects.toThrow(
            'The assistant service is not running in this app instance.',
        );
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('the session', () => {
    test('is opened once and named on every later call', async () => {
        const client = await loadClient();
        const seenList = stubHost(
            genHost((call) => {
                if (call.body.method === 'tools/list') {
                    return toolResult({
                        tools: [
                            { name: 'owa_app_state' },
                            { name: 'owa_click' },
                        ],
                    });
                }
                return toolResult({ content: [{ type: 'text', text: 'ok' }] });
            }),
        );
        expect(await client.callTool('owa_list_ui', {}, null, null)).toBe('ok');
        expect(await client.listTools()).toEqual([
            { name: 'owa_app_state' },
            { name: 'owa_click' },
        ]);
        expect(await client.callTool('owa_find_ui', {}, null, null)).toBe('ok');
        expect(methodsOf(seenList)).toEqual([
            'initialize',
            'notifications/initialized',
            'tools/call',
            'tools/list',
            'tools/call',
        ]);
        // The opening ask names no session; every one after it names the
        // session the host gave.
        expect(
            seenList.map((call) => {
                return call.session;
            }),
        ).toEqual([null, 'S1', 'S1', 'S1', 'S1']);
        // Each request its own id.
        const idList = seenList
            .map((call) => {
                return call.body.id;
            })
            .filter((id) => {
                return id !== undefined;
            });
        expect(new Set(idList).size).toBe(idList.length);
    });

    test('a session the host swept is opened again and the call asked once more', async () => {
        const client = await loadClient();
        let sessionCount = 0;
        const seenList = stubHost((call) => {
            if (call.body.method === 'initialize') {
                sessionCount += 1;
                return {
                    status: 200,
                    body: { result: {} },
                    sessionId: `S${sessionCount}`,
                };
            }
            if (call.body.method === 'notifications/initialized') {
                return { status: 202 };
            }
            // Fifteen idle minutes later the host has forgotten S1.
            if (
                call.session === 'S1' &&
                sessionCount > 0 &&
                seenList.length > 3
            ) {
                return { status: 404, body: { error: 'Session not found' } };
            }
            return toolResult({
                content: [
                    { type: 'text', text: `answered on ${call.session}` },
                ],
            });
        });
        expect(await client.callTool('owa_app_state', {}, null, null)).toBe(
            'answered on S1',
        );
        expect(await client.callTool('owa_app_state', {}, null, null)).toBe(
            'answered on S2',
        );
        expect(methodsOf(seenList).slice(3)).toEqual([
            'tools/call',
            'initialize',
            'notifications/initialized',
            'tools/call',
        ]);
        // The new session is opened as a new one -- naming the swept id
        // would be refused again.
        expect(seenList[4].session).toBeNull();
        expect(seenList[6].session).toBe('S2');
    });

    test('a host answering 404 to everything is one honest error, not a loop', async () => {
        const client = await loadClient();
        const seenList = stubHost(() => {
            return { status: 404 };
        });
        const error = await client
            .callTool('owa_app_state', {}, null, null)
            .catch((caught) => {
                return caught;
            });
        expect(client.checkIsToolHostError(error)).toBe(true);
        expect(error.hostStatus).toBe(404);
        // The opening ask is never re-opened to replay itself.
        expect(methodsOf(seenList)).toEqual(['initialize']);
    });

    test('a call refused again after the session was opened anew is not asked a third time', async () => {
        const client = await loadClient();
        let hasOpened = false;
        const seenList = stubHost(
            genHost(() => {
                if (!hasOpened) {
                    hasOpened = true;
                    return toolResult({
                        content: [{ type: 'text', text: 'first' }],
                    });
                }
                return { status: 404 };
            }),
        );
        expect(await client.callTool('owa_app_state', {}, null, null)).toBe(
            'first',
        );
        const error = await client
            .callTool('owa_app_state', {}, null, null)
            .catch((caught) => {
                return caught;
            });
        expect(error).toBeInstanceOf(client.ToolHostError);
        expect(error.hostStatus).toBe(404);
        expect(methodsOf(seenList).slice(3)).toEqual([
            'tools/call',
            'initialize',
            'notifications/initialized',
            'tools/call',
        ]);
    });

    test('a session swept while it is being re-opened fails without a loop', async () => {
        const client = await loadClient();
        let initializeCount = 0;
        const seenList = stubHost((call) => {
            if (call.body.method === 'initialize') {
                initializeCount += 1;
                return initializeCount === 1
                    ? { status: 200, body: { result: {} }, sessionId: 'S1' }
                    : { status: 404 };
            }
            if (call.body.method === 'notifications/initialized') {
                return { status: 202 };
            }
            return initializeCount === 1 && seenList.length === 3
                ? toolResult({ content: [{ type: 'text', text: 'first' }] })
                : { status: 404 };
        });
        await client.callTool('owa_app_state', {}, null, null);
        await expect(
            client.callTool('owa_app_state', {}, null, null),
        ).rejects.toMatchObject({ name: 'ToolHostError', hostStatus: 404 });
        expect(methodsOf(seenList).slice(3)).toEqual([
            'tools/call',
            'initialize',
        ]);
    });
});

describe('what a call answers', () => {
    test('a JSON-RPC error is said in the host’s words, or in a sentence of its own', async () => {
        const client = await loadClient();
        let reply: unknown = { error: { message: 'Unknown tool: owa_nope' } };
        stubHost(
            genHost(() => {
                return { status: 200, body: reply };
            }),
        );
        await expect(
            client.callTool('owa_nope', {}, null, null),
        ).rejects.toThrow('Unknown tool: owa_nope');
        reply = { error: { code: -32000 } };
        await expect(
            client.callTool('owa_nope', {}, null, null),
        ).rejects.toThrow('The assistant call failed');
    });

    test('a tool’s words, without its pictures; a failure in its own words', async () => {
        const client = await loadClient();
        let result: any = {
            content: [
                { type: 'text', text: 'Line one' },
                { type: 'image', mimeType: 'image/png', data: 'AAAA' },
                { type: 'text', text: 'Line two' },
            ],
        };
        stubHost(
            genHost(() => {
                return toolResult(result);
            }),
        );
        expect(await client.callTool('owa_app_state', {}, null, null)).toBe(
            'Line one\nLine two',
        );
        result = {
            isError: true,
            content: [{ type: 'text', text: 'No control called that' }],
        };
        await expect(
            client.callTool('owa_click', { label: 'x' }, null, null),
        ).rejects.toThrow('No control called that');
        result = { isError: true };
        await expect(
            client.callTool('owa_click', { label: 'x' }, null, null),
        ).rejects.toThrow('The tool call failed');
        // A host that answered with no result at all says nothing.
        result = undefined;
        expect(await client.callTool('owa_app_state', {}, null, null)).toBe('');
    });

    test('a tool list the host did not send is an empty list', async () => {
        const client = await loadClient();
        stubHost(
            genHost(() => {
                return { status: 202 };
            }),
        );
        expect(await client.listTools()).toEqual([]);
    });

    test('pictures come apart from their media type, and only real pictures', async () => {
        const client = await loadClient();
        let result: any = {
            content: [
                { type: 'text', text: 'Page 1 of 2' },
                { type: 'image', mimeType: 'IMAGE/JPEG', data: 'JJJJ' },
                { type: 'image', data: 'PPPP' },
                { type: 'image', mimeType: 'application/pdf', data: 'XXXX' },
                { type: 'image', mimeType: 'image/png', data: 42 },
                { type: 'text', text: 'Page 2 of 2' },
            ],
        };
        stubHost(
            genHost(() => {
                return toolResult(result);
            }),
        );
        expect(
            await client.callToolWithPictures(
                'owa_resource_file',
                { action: 'read', file: 'pdf/LUK.6.pdf' },
                null,
                null,
            ),
        ).toEqual({
            text: 'Page 1 of 2\nPage 2 of 2',
            pictures: [
                { mediaType: 'image/jpeg', data: 'JJJJ' },
                { mediaType: 'image/png', data: 'PPPP' },
            ],
        });
        result = {
            isError: true,
            content: [{ type: 'text', text: 'No such file in Resources' }],
        };
        await expect(
            client.callToolWithPictures('owa_resource_file', {}, null, null),
        ).rejects.toThrow('No such file in Resources');
        result = { isError: true, content: [] };
        await expect(
            client.callToolWithPictures('owa_resource_file', {}, null, null),
        ).rejects.toThrow('The tool call failed');
        result = {};
        expect(
            await client.callToolWithPictures(
                'owa_resource_file',
                {},
                null,
                null,
            ),
        ).toEqual({ text: '', pictures: [] });
    });

    test('a window picture with no media type is a PNG; none at all is said so', async () => {
        const client = await loadClient();
        let result: any = { content: [{ type: 'image', data: 'QQQQ' }] };
        stubHost(
            genHost(() => {
                return toolResult(result);
            }),
        );
        expect(
            await client.callToolPicture('owa_screenshot', {}, null, null),
        ).toBe('data:image/png;base64,QQQQ');
        result = { content: [{ type: 'text', text: '' }] };
        await expect(
            client.callToolPicture('owa_screenshot', {}, null, null),
        ).rejects.toThrow('The window did not return a picture');
        // A failed call is a failure even when a picture rode along.
        result = {
            isError: true,
            content: [
                { type: 'text', text: 'The window closed' },
                { type: 'image', data: 'QQQQ' },
            ],
        };
        await expect(
            client.callToolPicture('owa_screenshot', {}, null, null),
        ).rejects.toThrow('The window closed');
    });

    test('a tool reply is read as JSON, and words that are not JSON as nothing', async () => {
        const client = await loadClient();
        expect(client.parseToolJson('{"screens":[1]}')).toEqual({
            screens: [1],
        });
        expect(client.parseToolJson('The screen is off')).toBeNull();
    });
});

describe('every call carries', () => {
    test('the caller’s stop signal all the way to the fetch', async () => {
        const client = await loadClient();
        const seenList = stubHost(
            genHost(() => {
                return toolResult({ content: [{ type: 'text', text: 'ok' }] });
            }),
        );
        const controller = new AbortController();
        await client.callTool('owa_app_state', {}, controller.signal, null);
        expect(seenList).toHaveLength(3);
        for (const call of seenList) {
            expect(call.init.signal).toBe(controller.signal);
        }
        // No signal is `undefined` to fetch, never `null`.
        await client.callTool('owa_app_state', {}, null, null);
        expect(seenList[3].init.signal).toBeUndefined();
    });

    test('the tab in front’s window, when the caller names none', async () => {
        const client = await loadClient();
        const { setCurrentWindowAim } = await import('./windowAimHelpers');
        const seenList = stubHost(
            genHost(() => {
                return toolResult({ content: [{ type: 'text', text: 'ok' }] });
            }),
        );
        setCurrentWindowAim({
            windowId: 'SETTING-1',
            focus: 'setting',
            isSeparateWindow: true,
        });
        try {
            await client.callTool('owa_click', { label: 'Apply' });
            await client.callTool('owa_bible_item', { action: 'list' });
        } finally {
            setCurrentWindowAim(null);
        }
        const toolCallList = seenList.filter((call) => {
            return call.body.method === 'tools/call';
        });
        expect(
            toolCallList.map((call) => {
                return call.body.params;
            }),
        ).toEqual([
            {
                name: 'owa_click',
                arguments: { label: 'Apply', page: 'SETTING-1' },
            },
            // A data tool's `page` means something else: left alone.
            { name: 'owa_bible_item', arguments: { action: 'list' } },
        ]);
    });
});
