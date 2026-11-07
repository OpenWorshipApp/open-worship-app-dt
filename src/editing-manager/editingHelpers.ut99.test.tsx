// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ManagerStateType = {
    hasHistories: boolean;
    canUndo: boolean;
    canRedo: boolean;
    current: string | null;
    original: string | null;
};

const h = vi.hoisted(() => {
    return {
        managers: new Map<string, ManagerStateType>(),
        getInstanceCalls: [] as string[],
        fileListeners: [] as {
            events: string[];
            filePath: string | undefined;
            callback: () => void;
        }[],
        keyboard: [] as {
            mappers: unknown[];
            listener: (event: { preventDefault: () => void }) => void;
        }[],
        showAppConfirm: null as any,
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => void,
        _deps: unknown,
        filePath?: string,
    ) => {
        h.fileListeners.push({ events, filePath, callback });
    },
}));
vi.mock('./EditingHistoryManager', () => {
    function getState(filePath: string) {
        const state = h.managers.get(filePath);
        if (state === undefined) {
            throw new Error(`no manager state for ${filePath}`);
        }
        return state;
    }
    return {
        default: {
            getInstance(filePath: string) {
                h.getInstanceCalls.push(filePath);
                return {
                    checkHasHistories: async () =>
                        getState(filePath).hasHistories,
                    checkCanUndo: async () => getState(filePath).canUndo,
                    checkCanRedo: async () => getState(filePath).canRedo,
                    getCurrentHistory: async () => getState(filePath).current,
                    getOriginalData: async () => getState(filePath).original,
                };
            },
        },
        // the real rule: a stamp-only difference is not a change
        sanitizeForUpdatingComparison(text: string | null) {
            if (text === null) {
                return null;
            }
            try {
                const json = JSON.parse(text);
                json.metadata ??= {};
                json.metadata.lastEditDate = '';
                return JSON.stringify(json);
            } catch (_error) {}
            return text;
        },
    };
});
vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: (mapper: { allControlKey: string[]; key: string }) =>
        `${mapper.allControlKey.join('+')}+${mapper.key.toUpperCase()}`,
    useKeyboardRegistering: (
        mappers: unknown[],
        listener: (event: { preventDefault: () => void }) => void,
    ) => {
        h.keyboard.push({ mappers, listener });
    },
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: (...args: unknown[]) => h.showAppConfirm(...args),
}));

import {
    FileEditingMenuComp,
    savingEventMapper,
    useEditingHistoryStatus,
    type EditingHistoryHolderType,
} from './editingHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function setManager(filePath: string, state: Partial<ManagerStateType>) {
    h.managers.set(filePath, {
        hasHistories: true,
        canUndo: false,
        canRedo: false,
        current: null,
        original: null,
        ...state,
    });
}

function genDocument(filePath = 'Sunday.slides') {
    const editableDocument = {
        filePath,
        historyUndo: vi.fn(),
        historyRedo: vi.fn(),
        historyDiscard: vi.fn(),
        save: vi.fn(),
    } satisfies EditingHistoryHolderType;
    return editableDocument;
}

async function flush() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
    });
}

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
    await flush();
}

function button(label: string) {
    const found = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    );
    if (found === null) {
        throw new Error(`no button ${label}`);
    }
    return found;
}

async function click(element: HTMLElement) {
    await act(async () => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
}

function StatusProbeComp({
    filePath,
    label,
}: Readonly<{ filePath: string; label: string }>) {
    const status = useEditingHistoryStatus(filePath);
    return (
        <output data-label={label}>
            {`${status.canUndo}/${status.canRedo}/${status.canSave}`}
        </output>
    );
}

function readProbe(label: string) {
    return container.querySelector(`output[data-label="${label}"]`)
        ?.textContent;
}

beforeEach(() => {
    vi.useFakeTimers();
    h.managers.clear();
    h.getInstanceCalls.length = 0;
    h.fileListeners.length = 0;
    h.keyboard.length = 0;
    h.showAppConfirm = vi.fn(async () => true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('useEditingHistoryStatus', () => {
    it('reports nothing to do when the file has no history at all', async () => {
        setManager('a.slides', {
            hasHistories: false,
            // would light every flag if the early return were skipped
            canUndo: true,
            canRedo: true,
            current: '{"a":1}',
            original: '{"a":2}',
        });
        await render(<StatusProbeComp filePath="a.slides" label="a" />);
        expect(readProbe('a')).toBe('false/false/false');
        expect(h.getInstanceCalls).toEqual(['a.slides']);
    });

    it('reads undo, redo and an unsaved change from the history', async () => {
        setManager('a.slides', {
            canUndo: true,
            canRedo: false,
            current: '{"title":"new","metadata":{"lastEditDate":"1"}}',
            original: '{"title":"old","metadata":{"lastEditDate":"1"}}',
        });
        await render(<StatusProbeComp filePath="a.slides" label="a" />);
        expect(readProbe('a')).toBe('true/false/true');
    });

    it('does not offer Save when only the edit stamp differs', async () => {
        setManager('a.slides', {
            canRedo: true,
            current: '{"title":"same","metadata":{"lastEditDate":"2"}}',
            original: '{"title":"same","metadata":{"lastEditDate":"1"}}',
        });
        await render(<StatusProbeComp filePath="a.slides" label="a" />);
        expect(readProbe('a')).toBe('false/true/false');
    });

    it('does not offer Save when the head history cannot be read', async () => {
        setManager('a.slides', {
            canUndo: true,
            current: null,
            original: '{"title":"old"}',
        });
        await render(<StatusProbeComp filePath="a.slides" label="a" />);
        expect(readProbe('a')).toBe('true/false/false');
    });

    it('re-reads 500 ms after the last update event, once for a burst', async () => {
        setManager('a.slides', {});
        await render(<StatusProbeComp filePath="a.slides" label="a" />);
        expect(readProbe('a')).toBe('false/false/false');
        const listener = h.fileListeners.at(-1)!;
        expect(listener.events).toEqual(['update']);
        expect(listener.filePath).toBe('a.slides');
        const callsBefore = h.getInstanceCalls.length;
        setManager('a.slides', {
            canUndo: true,
            current: '{"v":2}',
            original: '{"v":1}',
        });
        act(() => {
            listener.callback();
            listener.callback();
            listener.callback();
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(readProbe('a')).toBe('false/false/false');
        expect(h.getInstanceCalls.length).toBe(callsBefore);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        await flush();
        expect(readProbe('a')).toBe('true/false/true');
        expect(h.getInstanceCalls.length).toBe(callsBefore + 1);
    });

    it('keeps one debounce per instance so two items on one file both refresh', async () => {
        setManager('same.slides', {});
        await render(
            <>
                <StatusProbeComp filePath="same.slides" label="first" />
                <StatusProbeComp filePath="same.slides" label="second" />
            </>,
        );
        const [first, second] = h.fileListeners.slice(-2);
        setManager('same.slides', { canRedo: true });
        act(() => {
            first.callback();
            second.callback();
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        await flush();
        expect(readProbe('first')).toBe('false/true/false');
        expect(readProbe('second')).toBe('false/true/false');
    });
});

describe('FileEditingMenuComp', () => {
    it('renders nothing when there is no history and no extra children', async () => {
        setManager('Sunday.slides', { hasHistories: false });
        await render(<FileEditingMenuComp editableDocument={genDocument()} />);
        expect(container.innerHTML).toBe('');
    });

    it('still shows the extra children with every history button disabled', async () => {
        setManager('Sunday.slides', { hasHistories: false });
        await render(
            <FileEditingMenuComp
                editableDocument={genDocument()}
                extraChildren={<span className="extra">extra</span>}
            />,
        );
        expect(container.querySelector('.extra')?.textContent).toBe('extra');
        for (const label of ['Undo', 'Redo', 'Discard changed', 'Save']) {
            expect(button(label).disabled).toBe(true);
            expect(button(label).style.opacity).toBe('0.1');
        }
    });

    it('presses undo and redo on the document and labels Save with its shortcut', async () => {
        setManager('Sunday.slides', {
            canUndo: true,
            canRedo: true,
            current: '{"v":2}',
            original: '{"v":1}',
        });
        const editableDocument = genDocument();
        await render(
            <FileEditingMenuComp editableDocument={editableDocument} />,
        );
        expect(button('Undo').disabled).toBe(false);
        expect(button('Undo').style.opacity).toBe('');
        expect(button('Save').title).toBe('Save [Ctrl+S]');
        await click(button('Undo'));
        expect(editableDocument.historyUndo).toHaveBeenCalledTimes(1);
        expect(editableDocument.historyRedo).not.toHaveBeenCalled();
        await click(button('Redo'));
        expect(editableDocument.historyRedo).toHaveBeenCalledTimes(1);
        await click(button('Save'));
        expect(editableDocument.save).toHaveBeenCalledTimes(1);
    });

    it('uses the caller labels for undo and redo', async () => {
        setManager('Sunday.slides', { canUndo: true });
        await render(
            <FileEditingMenuComp
                editableDocument={genDocument()}
                undoLabel="Undo note"
                redoLabel="Redo note"
            />,
        );
        expect(button('Undo note').title).toBe('Undo note');
        expect(button('Redo note').title).toBe('Redo note');
        expect(container.querySelector('button[aria-label="Undo"]')).toBe(null);
    });

    it('discards the history only after the confirm says yes', async () => {
        setManager('Sunday.slides', { canUndo: true });
        const editableDocument = genDocument();
        await render(
            <FileEditingMenuComp editableDocument={editableDocument} />,
        );
        h.showAppConfirm.mockImplementation(async () => false);
        await click(button('Discard changed'));
        expect(h.showAppConfirm).toHaveBeenCalledWith(
            'Discard changed',
            'Are you sure to discard all change histories?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(editableDocument.historyDiscard).not.toHaveBeenCalled();
        h.showAppConfirm.mockImplementation(async () => true);
        await click(button('Discard changed'));
        expect(editableDocument.historyDiscard).toHaveBeenCalledTimes(1);
        expect(editableDocument.save).not.toHaveBeenCalled();
    });

    it('registers Ctrl+S only when asked to and saves the latest document', async () => {
        setManager('Sunday.slides', { canUndo: true });
        setManager('Other.slides', { canUndo: true });
        await render(<FileEditingMenuComp editableDocument={genDocument()} />);
        expect(h.keyboard.at(-1)!.mappers).toEqual([]);
        const firstDocument = genDocument();
        const latestDocument = genDocument('Other.slides');
        await render(
            <FileEditingMenuComp
                editableDocument={firstDocument}
                isSaveShortcutGlobal
            />,
        );
        await render(
            <FileEditingMenuComp
                editableDocument={latestDocument}
                isSaveShortcutGlobal
            />,
        );
        const registration = h.keyboard.at(-1)!;
        expect(registration.mappers).toEqual([savingEventMapper]);
        const event = { preventDefault: vi.fn() };
        registration.listener(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(latestDocument.save).toHaveBeenCalledTimes(1);
        expect(firstDocument.save).not.toHaveBeenCalled();
    });
});
