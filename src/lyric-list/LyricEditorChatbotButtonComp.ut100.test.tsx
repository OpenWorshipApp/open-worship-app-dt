// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LyricEditorSyncType } from './lyricEditorChatbotSync';

// The 🤖 in the Lyric Editor's top bar: the song as shown goes into its
// editing history, then the help window opens on it; and, while the
// assistant changed the song under the person's typing, the press that
// loads that change.
const h = vi.hoisted(() => {
    return {
        isAiEnabled: true,
        order: [] as string[],
        openLyricInChatbot: vi.fn(),
        handleError: vi.fn(),
    };
});

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAiEnabled,
}));
vi.mock('../helper/ai/lyricChatbotMenuHelpers', () => ({
    openLyricInChatbot: async (filePath: string) => {
        h.order.push(`open ${filePath}`);
        h.openLyricInChatbot(filePath);
    },
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));
// English: the key is the label.
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import LyricEditorChatbotButtonComp from './LyricEditorChatbotButtonComp';

const FILE_PATH = 'C:\\songs\\Still.owl';

function genSync(pending: string | null = null) {
    const state = {
        pending,
        listeners: new Set<() => void>(),
        writeError: null as Error | null,
    };
    const unsubscribe = vi.fn();
    const sync = {
        getPendingHead: () => state.pending,
        subscribe: (listener: () => void) => {
            state.listeners.add(listener);
            return () => {
                unsubscribe();
                state.listeners.delete(listener);
            };
        },
        applyPending: vi.fn(),
        markSaved: vi.fn(),
        writeShownToHead: async () => {
            if (state.writeError !== null) {
                throw state.writeError;
            }
            h.order.push('write');
        },
        dispose: vi.fn(),
    } satisfies LyricEditorSyncType;
    const notify = () => {
        for (const listener of state.listeners) {
            listener();
        }
    };
    return { sync, state, notify, unsubscribe };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.isAiEnabled = true;
    h.order = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

function getRobotButton() {
    return container.querySelector<HTMLButtonElement>(
        'button[aria-label="Open in Chatbot"]',
    );
}

describe('LyricEditorChatbotButtonComp', () => {
    test('with AI turned off there is no button', async () => {
        h.isAiEnabled = false;
        const { sync } = genSync();
        await act(async () => {
            root.render(
                <LyricEditorChatbotButtonComp
                    sync={sync}
                    filePath={FILE_PATH}
                />,
            );
        });
        expect(container.innerHTML).toBe('');
    });

    test('the press writes what is shown first, then opens the help window on the song', async () => {
        const { sync } = genSync();
        await act(async () => {
            root.render(
                <LyricEditorChatbotButtonComp
                    sync={sync}
                    filePath={FILE_PATH}
                />,
            );
        });
        const button = getRobotButton()!;
        expect(button.title).toBe('Open in Chatbot');
        // Nothing pending: no line, no load button.
        expect(container.textContent).not.toContain('The assistant changed');

        await act(async () => {
            button.click();
        });

        expect(h.order).toEqual(['write', `open ${FILE_PATH}`]);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a write that fails opens nothing and is reported', async () => {
        const { sync, state } = genSync();
        state.writeError = new Error('disk full');
        await act(async () => {
            root.render(
                <LyricEditorChatbotButtonComp
                    sync={sync}
                    filePath={FILE_PATH}
                />,
            );
        });

        await act(async () => {
            getRobotButton()!.click();
        });

        expect(h.openLyricInChatbot).not.toHaveBeenCalled();
        expect(h.handleError).toHaveBeenCalledWith(state.writeError);
    });

    test('a change held back is said, and loaded only by the person’s press', async () => {
        const { sync } = genSync('<song/>');
        await act(async () => {
            root.render(
                <LyricEditorChatbotButtonComp
                    sync={sync}
                    filePath={FILE_PATH}
                />,
            );
        });
        expect(container.textContent).toContain(
            'The assistant changed this song.',
        );
        expect(sync.applyPending).not.toHaveBeenCalled();
        const loadButton = Array.from(
            container.querySelectorAll('button'),
        ).find((button) => {
            return button.textContent === 'Load the change';
        })!;

        await act(async () => {
            loadButton.click();
        });

        expect(sync.applyPending).toHaveBeenCalledOnce();
    });

    test('the line follows the sync as it changes, and stops listening when gone', async () => {
        const { sync, state, notify, unsubscribe } = genSync();
        await act(async () => {
            root.render(
                <LyricEditorChatbotButtonComp
                    sync={sync}
                    filePath={FILE_PATH}
                />,
            );
        });
        expect(container.textContent).not.toContain('Load the change');

        state.pending = '<song/>';
        await act(async () => {
            notify();
        });
        expect(container.textContent).toContain('Load the change');

        state.pending = null;
        await act(async () => {
            notify();
        });
        expect(container.textContent).not.toContain('Load the change');

        await act(async () => {
            root.render(<div />);
        });
        expect(unsubscribe).toHaveBeenCalledOnce();
    });
});
