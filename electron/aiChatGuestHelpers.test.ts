import { afterEach, describe, expect, test, vi } from 'vitest';

const { hostMap } = vi.hoisted(() => {
    return { hostMap: new Map<number, unknown>() };
});

vi.mock('electron', () => {
    return {
        app: {},
        session: {},
        shell: {},
        webContents: {
            fromId: (id: number) => {
                return hostMap.get(id);
            },
        },
    };
});

import {
    AI_CHAT_MICROPHONE_ASK_CHANNEL,
    AI_CHAT_MICROPHONE_SETTLED_CHANNEL,
    AI_CHAT_PARTITION,
    answerAiChatMicrophoneAsk,
    askAiChatMicrophone,
    checkIsGuestAttachAllowed,
    checkIsGuestPressFresh,
    checkIsGuestRequestAllowed,
    checkIsGuestUrlAllowed,
    decideGuestWindowOpen,
    forgetAiChatMicrophoneGrants,
    GUEST_PRESS_FRESH_MS,
    GUEST_PRESS_INPUT_TYPE_SET,
    GUEST_REQUEST_URL_PATTERNS,
    toGuestWebPreferences,
    toMicrophoneOrigin,
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

describe('toMicrophoneOrigin', () => {
    const genDetails = (overrides = {}) => {
        return {
            isMainFrame: true,
            requestingUrl: 'https://claude.ai/new',
            mediaTypes: ['audio'],
            ...overrides,
        };
    };

    test('the microphone, asked for by a site own page', () => {
        expect(toMicrophoneOrigin('media', genDetails())).toBe(
            'https://claude.ai',
        );
    });

    test('never the camera, not even beside the microphone', () => {
        expect(
            toMicrophoneOrigin('media', genDetails({ mediaTypes: ['video'] })),
        ).toBeNull();
        expect(
            toMicrophoneOrigin(
                'media',
                genDetails({ mediaTypes: ['audio', 'video'] }),
            ),
        ).toBeNull();
        expect(
            toMicrophoneOrigin('media', genDetails({ mediaTypes: [] })),
        ).toBeNull();
        expect(
            toMicrophoneOrigin(
                'media',
                genDetails({ mediaTypes: ['unknown'] }),
            ),
        ).toBeNull();
    });

    test('never a frame inside the page, a plain page, or another ask', () => {
        expect(
            toMicrophoneOrigin('media', genDetails({ isMainFrame: false })),
        ).toBeNull();
        expect(
            toMicrophoneOrigin(
                'media',
                genDetails({ requestingUrl: 'http://claude.ai/' }),
            ),
        ).toBeNull();
        expect(
            toMicrophoneOrigin('media', genDetails({ requestingUrl: 'nope' })),
        ).toBeNull();
        for (const permission of [
            'display-capture',
            'geolocation',
            'notifications',
            'clipboard-read',
        ]) {
            expect(toMicrophoneOrigin(permission, genDetails())).toBeNull();
        }
    });
});

describe('askAiChatMicrophone', () => {
    function genHost(id: number) {
        const sentList: [string, any][] = [];
        const host = {
            id,
            isDestroyed: () => false,
            send: (channel: string, data: any) => {
                sentList.push([channel, data]);
            },
        };
        hostMap.set(id, host);
        return { host, sentList };
    }

    function genGuest(id: number, host: unknown) {
        const listenerMap = new Map<string, () => void>();
        const guest = {
            id,
            hostWebContents: host,
            once: (eventName: string, listener: () => void) => {
                listenerMap.set(eventName, listener);
            },
            removeListener: (eventName: string) => {
                listenerMap.delete(eventName);
            },
        };
        return {
            guest: guest as any,
            destroy: () => {
                listenerMap.get('destroyed')?.();
            },
        };
    }

    afterEach(() => {
        forgetAiChatMicrophoneGrants();
        hostMap.clear();
    });

    test('asks the window, and only that window answers', () => {
        const { host, sentList } = genHost(1);
        const { guest } = genGuest(7, host);
        const doneList: boolean[] = [];
        askAiChatMicrophone(guest, 'https://claude.ai', (isAllowed) => {
            doneList.push(isAllowed);
        });
        expect(sentList).toEqual([
            [
                AI_CHAT_MICROPHONE_ASK_CHANNEL,
                {
                    askId: expect.any(Number),
                    guestId: 7,
                    hostname: 'claude.ai',
                    isAllowed: false,
                },
            ],
        ]);
        const { askId } = sentList[0][1];
        // Any other page in the app sending the same answer is ignored.
        answerAiChatMicrophoneAsk(2, { askId, isAllowed: true });
        expect(doneList).toEqual([]);
        answerAiChatMicrophoneAsk(1, { askId, isAllowed: true });
        expect(doneList).toEqual([true]);
        expect(sentList[1]).toEqual([
            AI_CHAT_MICROPHONE_SETTLED_CHANNEL,
            { askId },
        ]);
        // A yes is remembered for the site, and still goes to the window.
        askAiChatMicrophone(guest, 'https://claude.ai', () => {});
        expect(sentList[2][1].isAllowed).toBe(true);
    });

    test('a no is not remembered', () => {
        const { host, sentList } = genHost(1);
        const { guest } = genGuest(7, host);
        const doneList: boolean[] = [];
        askAiChatMicrophone(guest, 'https://claude.ai', (isAllowed) => {
            doneList.push(isAllowed);
        });
        answerAiChatMicrophoneAsk(1, {
            askId: sentList[0][1].askId,
            isAllowed: false,
        });
        expect(doneList).toEqual([false]);
        askAiChatMicrophone(guest, 'https://claude.ai', () => {});
        expect(sentList[2][1].isAllowed).toBe(false);
    });

    test('a second ask from the same page waits on the first', () => {
        const { host, sentList } = genHost(1);
        const { guest } = genGuest(7, host);
        const doneList: boolean[] = [];
        const done = (isAllowed: boolean) => {
            doneList.push(isAllowed);
        };
        askAiChatMicrophone(guest, 'https://claude.ai', done);
        askAiChatMicrophone(guest, 'https://claude.ai', done);
        expect(sentList).toHaveLength(1);
        answerAiChatMicrophoneAsk(1, {
            askId: sentList[0][1].askId,
            isAllowed: true,
        });
        expect(doneList).toEqual([true, true]);
    });

    test('a guest that goes away takes its question with it', () => {
        const { host } = genHost(1);
        const { guest, destroy } = genGuest(7, host);
        const doneList: boolean[] = [];
        askAiChatMicrophone(guest, 'https://claude.ai', (isAllowed) => {
            doneList.push(isAllowed);
        });
        destroy();
        expect(doneList).toEqual([false]);
    });

    test('a guest with no window is refused without asking', () => {
        const doneList: boolean[] = [];
        askAiChatMicrophone(
            genGuest(7, null).guest,
            'https://claude.ai',
            (isAllowed) => {
                doneList.push(isAllowed);
            },
        );
        expect(doneList).toEqual([false]);
    });

    test('Sign out of every site takes every yes back', () => {
        const { host, sentList } = genHost(1);
        const { guest } = genGuest(7, host);
        askAiChatMicrophone(guest, 'https://claude.ai', () => {});
        answerAiChatMicrophoneAsk(1, {
            askId: sentList[0][1].askId,
            isAllowed: true,
        });
        const doneList: boolean[] = [];
        askAiChatMicrophone(
            genGuest(8, host).guest,
            'https://chatgpt.com',
            (isAllowed) => {
                doneList.push(isAllowed);
            },
        );
        forgetAiChatMicrophoneGrants();
        expect(doneList).toEqual([false]);
        askAiChatMicrophone(guest, 'https://claude.ai', () => {});
        expect(sentList.at(-1)?.[1].isAllowed).toBe(false);
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

    test('judges a WebSocket the same way', () => {
        // Measured 2026-09-14: `ws://` to all of these OPENED from a guest
        // while the filter was `*://*/*`, which never hands the listener a
        // WebSocket handshake.
        for (const address of [
            'ws://127.0.0.1:4455/',
            'ws://localhost:8000/',
            'ws://127.1:1025/',
            'ws://[::1]:4455/',
            'ws://127.0.0.2:4455/',
            'wss://192.168.1.20/',
            'ws://nas.local/',
        ]) {
            expect([
                address,
                checkIsGuestRequestAllowed(address, policy),
            ]).toEqual([address, false]);
        }
        expect(
            checkIsGuestRequestAllowed('wss://ws.postman-echo.com/raw', policy),
        ).toBe(true);
    });
});

describe('GUEST_REQUEST_URL_PATTERNS', () => {
    test('covers WebSockets, and never <all_urls>', () => {
        // `*://` is http and https only. `<all_urls>` would also hand the
        // listener data: and blob: loads, whose empty host counts as local.
        expect(GUEST_REQUEST_URL_PATTERNS).toEqual([
            '*://*/*',
            'ws://*/*',
            'wss://*/*',
        ]);
        expect(checkIsLocalHostname('')).toBe(true);
    });
});

describe('checkIsGuestPressFresh', () => {
    test('a press counts for five seconds, never before it happened', () => {
        expect(checkIsGuestPressFresh(1000, 1000)).toBe(true);
        expect(checkIsGuestPressFresh(1000, 1000 + GUEST_PRESS_FRESH_MS)).toBe(
            true,
        );
        expect(checkIsGuestPressFresh(1000, 1001 + GUEST_PRESS_FRESH_MS)).toBe(
            false,
        );
        expect(checkIsGuestPressFresh(1000, 999)).toBe(false);
        expect(checkIsGuestPressFresh(null, 1000)).toBe(false);
    });

    test('a press is a click, a key or a tap, never a mouse passing over', () => {
        for (const type of [
            'mouseDown',
            'mouseUp',
            'rawKeyDown',
            'keyDown',
            'touchStart',
            'touchEnd',
            'gestureTap',
        ]) {
            expect([type, GUEST_PRESS_INPUT_TYPE_SET.has(type)]).toEqual([
                type,
                true,
            ]);
        }
        for (const type of [
            'mouseMove',
            'mouseEnter',
            'mouseLeave',
            'mouseWheel',
            'gestureScrollUpdate',
            'keyUp',
            'char',
        ]) {
            expect([type, GUEST_PRESS_INPUT_TYPE_SET.has(type)]).toEqual([
                type,
                false,
            ]);
        }
    });
});

describe('decideGuestWindowOpen', () => {
    const now = 50_000;

    test('a page the person just pressed for opens in their browser', () => {
        expect(
            decideGuestWindowOpen(
                'https://www.anthropic.com/news',
                now - 200,
                now,
                policy,
            ),
        ).toBe('open');
        expect(
            decideGuestWindowOpen('http://example.com/', now, now, policy),
        ).toBe('open');
    });

    test('with nothing pressed it is refused, and the window is told', () => {
        // Measured 2026-09-14: a page's timer reached the handler with no
        // press at all, and the system browser opened.
        expect(
            decideGuestWindowOpen('https://example.com/', null, now, policy),
        ).toBe('refuse-and-tell');
        expect(
            decideGuestWindowOpen(
                'https://example.com/',
                now - GUEST_PRESS_FRESH_MS - 1,
                now,
                policy,
            ),
        ).toBe('refuse-and-tell');
    });

    test('this machine, its network and the app are refused even after a press', () => {
        for (const url of [
            'http://127.0.0.1:39223/mcp',
            'http://192.168.1.1/',
            'http://printer/',
            'file:///C:/Users/x/setting.json',
            'owa://local/presenter.html',
            'javascript:alert(1)',
            'about:blank',
            'not a url',
        ]) {
            expect([url, decideGuestWindowOpen(url, now, now, policy)]).toEqual(
                [url, 'refuse'],
            );
        }
    });

    test('nothing opens before the address policy has loaded', () => {
        expect(
            decideGuestWindowOpen('https://example.com/', now, now, null),
        ).toBe('refuse');
    });
});
