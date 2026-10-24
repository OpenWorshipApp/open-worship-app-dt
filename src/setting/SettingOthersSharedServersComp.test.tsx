// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The window's real registry helpers are under test with the panel: only the
// IPC to main, the stores and the fold's setting are stood in for.
const h = vi.hoisted(() => ({
    send: vi.fn(),
    collapsedMap: new Map<string, boolean>(),
    locale: 'en-US',
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
    getCurrentLocale: () => h.locale,
    getLangCode: (locale: string) => locale.split('-')[0],
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('../server/appHomeStorage', () => ({
    appHomeStorage: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock('../server/appSecureStorage', () => ({
    appSecureStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));
vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendData: vi.fn() } },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: h.send,
}));

vi.mock('./settingSectionFoldHelpers', () => ({
    getIsSettingSectionCollapsed: (foldName: string) => {
        return h.collapsedMap.get(foldName) ?? false;
    },
    saveIsSettingSectionCollapsed: (foldName: string, isCollapsed: boolean) => {
        h.collapsedMap.set(foldName, isCollapsed);
    },
    forgetIsSettingSectionCollapsed: (foldName: string) => {
        h.collapsedMap.delete(foldName);
    },
}));

import {
    LLM_REGISTRY_GET_CHANNEL,
    LLM_REGISTRY_RELOAD_CHANNEL,
} from '../../electron/customLlmProtocol';
import SettingOthersSharedServersComp from './SettingOthersSharedServersComp';

// As main hands them to a window: each address a stand-in on a reserved
// name, never the one the registry file carries.
const CHURCH_SERVER = {
    id: 'registry-church-lmstudio',
    name: 'Church LM Studio',
    baseUrl: 'https://shared-server.invalid/v1',
    models: [
        {
            id: 'm0-qwen',
            model: 'qwen/qwen3.5-9b',
            name: 'Qwen 3.5 9B',
            canSeeImages: true,
        },
        { id: 'm1-gemma', model: 'google/gemma-4-e4b', name: '' },
    ],
    isFree: true,
    source: 'registry',
};
const OTHER_SERVER = {
    id: 'registry-other',
    name: 'Other server',
    baseUrl: 'https://shared-server.invalid/v1',
    models: [{ id: 'm0-x', model: 'x/model', name: '' }],
    source: 'registry',
};

function genStatus(servers: unknown[], error: string | null = null) {
    return {
        url: 'https://www.openworship.app/llm/info.json',
        servers,
        fetchedAt: new Date(2026, 9, 10, 21, 45, 53).getTime(),
        error,
    };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function render() {
    await act(async () => {
        root = createRoot(container);
        root.render(<SettingOthersSharedServersComp />);
    });
}

function findFoldButton(text: string) {
    return Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'),
    ).find((one) => {
        return one.textContent === text;
    }) as HTMLButtonElement;
}

function findReloadButton() {
    return container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reload the shared servers"]',
    ) as HTMLButtonElement;
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    h.collapsedMap.clear();
    h.locale = 'en-US';
    h.send.mockReset();
    // Whatever a test before left in the window's copy is put back to empty.
    h.send.mockResolvedValue(genStatus([]));
});

afterEach(async () => {
    await act(async () => {
        root?.unmount();
    });
    root = null;
    container.remove();
});

describe('SettingOthersSharedServersComp', () => {
    test('asks main for what it holds and lists each shared server, folded', async () => {
        h.send.mockResolvedValue(genStatus([CHURCH_SERVER, OTHER_SERVER]));
        await render();
        // What main holds: no read of the site for opening a panel.
        expect(h.send).toHaveBeenCalledTimes(1);
        expect(h.send).toHaveBeenCalledWith(LLM_REGISTRY_GET_CHANNEL);
        expect(findFoldButton('Church LM Studio · Models: 2')).toBeDefined();
        expect(findFoldButton('Other server · Models: 1')).toBeDefined();
        expect(container.textContent).toContain('Last read at');
    });

    test('is read-only: nothing to type in, nothing to delete, and it says why', async () => {
        h.send.mockResolvedValue(genStatus([CHURCH_SERVER]));
        await render();
        await act(async () => {
            findFoldButton('Church LM Studio · Models: 2').click();
        });
        expect(
            container.querySelectorAll('input, textarea, select'),
        ).toHaveLength(0);
        // The group's fold, the reload, and the server's fold: nothing else.
        expect(
            Array.from(container.querySelectorAll('button')).map((one) => {
                return one.getAttribute('aria-label') ?? one.textContent;
            }),
        ).toEqual([
            'Shared servers',
            'Reload the shared servers',
            'Church LM Studio · Models: 2',
        ]);
        expect(
            container.querySelector(
                '[title="Shared by openworship.app. It cannot be changed here."]',
            ),
        ).not.toBeNull();
    });

    test('opened, a server shows what each model is, and no address at all', async () => {
        h.send.mockResolvedValue(genStatus([CHURCH_SERVER]));
        await render();
        await act(async () => {
            findFoldButton('Church LM Studio · Models: 2').click();
        });
        const text = container.textContent ?? '';
        // Not the stand-in either, and no row that would hold one: an
        // address on screen is an address copied and used elsewhere.
        expect(container.innerHTML).not.toContain('shared-server.invalid');
        expect(text).not.toContain('Base URL');
        expect(text).not.toContain('://');
        expect(text).toContain('qwen/qwen3.5-9b · Qwen 3.5 9B · Sees pictures');
        expect(text).toContain('google/gemma-4-e4b');
        expect(text).not.toContain('google/gemma-4-e4b · Sees pictures');
        // Folded again, what was under the title is taken off.
        await act(async () => {
            findFoldButton('Church LM Studio · Models: 2').click();
        });
        expect(container.textContent).not.toContain('qwen/qwen3.5-9b');
    });

    // The registry's notes are shown to the person choosing (2026-10-17):
    // the server's over its models, each model's under it, in the window's
    // language when the note has one.
    test('opened, a server shows its note and each model’s, in the window’s language', async () => {
        h.locale = 'km-KH';
        h.send.mockResolvedValue(
            genStatus([
                {
                    ...CHURCH_SERVER,
                    note: { en: 'Free for us', km: 'ឥតគិតថ្លៃសម្រាប់យើង' },
                    models: [
                        {
                            ...CHURCH_SERVER.models[0],
                            note: { '': 'Slow, but saves cost' },
                        },
                        CHURCH_SERVER.models[1],
                    ],
                },
            ]),
        );
        await render();
        await act(async () => {
            findFoldButton('Church LM Studio · Models: 2').click();
        });
        const text = container.textContent ?? '';
        expect(text).toContain('ឥតគិតថ្លៃសម្រាប់យើង');
        expect(text).not.toContain('Free for us');
        expect(text).toContain('Slow, but saves cost');
    });

    test('the reload button reads the site again and draws what came back', async () => {
        h.send.mockResolvedValue(genStatus([CHURCH_SERVER]));
        await render();
        let answer: (status: unknown) => void = () => {};
        h.send.mockImplementation(() => {
            return new Promise((resolve) => {
                answer = resolve;
            });
        });
        await act(async () => {
            findReloadButton().click();
        });
        expect(h.send).toHaveBeenLastCalledWith(LLM_REGISTRY_RELOAD_CHANNEL);
        // One read at a time: the button waits for the answer.
        expect(findReloadButton().disabled).toBe(true);
        await act(async () => {
            answer(genStatus([OTHER_SERVER]));
        });
        expect(findReloadButton().disabled).toBe(false);
        expect(findFoldButton('Other server · Models: 1')).toBeDefined();
        expect(findFoldButton('Church LM Studio · Models: 2')).toBeUndefined();
    });

    test('a read that failed is said, over the servers main still holds', async () => {
        h.send.mockResolvedValue(
            genStatus(
                [CHURCH_SERVER],
                'openworship.app did not answer in time',
            ),
        );
        await render();
        expect(container.textContent).toContain(
            'The last read failed: openworship.app did not answer in time',
        );
        expect(findFoldButton('Church LM Studio · Models: 2')).toBeDefined();
        expect(container.textContent).not.toContain('Last read at');
    });

    test('says so when nothing is shared', async () => {
        await render();
        expect(container.textContent).toContain(
            'No server is shared right now.',
        );
        expect(
            container.querySelectorAll('.app-setting-others-server'),
        ).toHaveLength(0);
    });

    test('folded, the group keeps a mark that something is shared and draws nothing else', async () => {
        h.send.mockResolvedValue(genStatus([CHURCH_SERVER]));
        h.collapsedMap.set('ai-shared-servers', true);
        await render();
        expect(findReloadButton()).toBeNull();
        expect(container.textContent).toBe('Shared servers');
        expect(
            container.querySelector('[title="Offered in the chatbot"]'),
        ).not.toBeNull();
        await act(async () => {
            findFoldButton('Shared servers').click();
        });
        expect(findReloadButton()).not.toBeNull();
        expect(h.collapsedMap.get('ai-shared-servers')).toBe(false);
    });

    test('keeps what it showed when main cannot be reached', async () => {
        h.send.mockResolvedValue(genStatus([CHURCH_SERVER]));
        await render();
        h.send.mockRejectedValue(new Error('no handler'));
        await act(async () => {
            findReloadButton().click();
        });
        expect(findReloadButton().disabled).toBe(false);
        expect(findFoldButton('Church LM Studio · Models: 2')).toBeDefined();
    });
});
