// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type FakeHistoryType = {
    hasHistories: boolean;
    canUndo: boolean;
    canRedo: boolean;
    head: string | null;
    file: string | null;
};

const mocks = vi.hoisted(() => ({
    histories: new Map<string, FakeHistoryType>(),
    // How often each file's status was read, keyed by path.
    statusReadCounts: new Map<string, number>(),
    // One entry per mounted `useFileSourceEvents`, as FileSource fans an
    // event out to every listener of a path.
    fileUpdateListeners: new Set<{ filePath?: string; fire: () => void }>(),
    keyboardRegistrations: [] as {
        eventMappers: unknown[];
        listener: (event: { preventDefault: () => void }) => void;
    }[],
    showAppConfirmMock: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});

vi.mock('../helper/dirSourceHelpers', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useFileSourceEvents: (
            _events: string[],
            callback: () => void,
            _deps?: unknown,
            filePath?: string,
        ) => {
            const callbackRef = useRef(callback);
            callbackRef.current = callback;
            useEffect(() => {
                const listener = {
                    filePath,
                    fire: () => {
                        callbackRef.current();
                    },
                };
                mocks.fileUpdateListeners.add(listener);
                return () => {
                    mocks.fileUpdateListeners.delete(listener);
                };
            }, [filePath]);
        },
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: (eventMapper: { key: string }) => {
        return `Ctrl+${eventMapper.key.toUpperCase()}`;
    },
    useKeyboardRegistering: (
        eventMappers: unknown[],
        listener: (event: { preventDefault: () => void }) => void,
    ) => {
        mocks.keyboardRegistrations.push({ eventMappers, listener });
    },
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirmMock,
}));

// The history's own I/O; `getInstance` is replaced per test below, and the
// real `sanitizeForUpdatingComparison` is what decides whether Save lights.
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../server/fileHelpers', () => ({}));
vi.mock('../helper/FileSource', () => ({ default: {} }));
vi.mock('../server/unlockingHelpers', () => ({ unlocking: vi.fn() }));

import EditingHistoryManager from './EditingHistoryManager';
import {
    FileEditingMenuComp,
    savingEventMapper,
    type EditingHistoryHolderType,
} from './editingHelpers';

const FILE_PATH = '/docs/service.ows';

function toDocText(items: number[], lastEditDate?: string) {
    return JSON.stringify({
        metadata: { app: 'OpenWorship', lastEditDate },
        items,
    });
}

function setHistory(filePath: string, history: Partial<FakeHistoryType>) {
    mocks.histories.set(filePath, {
        hasHistories: true,
        canUndo: false,
        canRedo: false,
        head: toDocText([1]),
        file: toDocText([1]),
        ...history,
    });
}

function genEditableDocument(
    filePath = FILE_PATH,
): EditingHistoryHolderType & Record<string, any> {
    return {
        filePath,
        historyUndo: vi.fn(),
        historyRedo: vi.fn(),
        historyDiscard: vi.fn(),
        save: vi.fn(),
    };
}

let container: HTMLDivElement;
let root: Root;

async function flushAsync() {
    await act(async () => {
        for (let i = 0; i < 50; i++) {
            await Promise.resolve();
        }
    });
}

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
    await flushAsync();
}

async function fireFileUpdate(filePath: string) {
    await act(async () => {
        for (const listener of Array.from(mocks.fileUpdateListeners)) {
            if (listener.filePath === filePath) {
                listener.fire();
            }
        }
    });
}

async function passDebounce() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
    });
    await flushAsync();
}

function getButton(label: string) {
    const button = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    );
    if (button === null) {
        throw new Error(`No button labelled ${label}`);
    }
    return button;
}

function readButtons() {
    return Array.from(container.querySelectorAll('button')).map((button) => {
        return {
            label: button.getAttribute('aria-label'),
            disabled: button.disabled,
            faded: button.style.opacity === '0.1',
        };
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.histories.clear();
    mocks.statusReadCounts.clear();
    mocks.fileUpdateListeners.clear();
    mocks.keyboardRegistrations.length = 0;
    vi.spyOn(EditingHistoryManager, 'getInstance').mockImplementation(
        (filePath: string) => {
            const read = () => {
                const history = mocks.histories.get(filePath);
                if (history === undefined) {
                    throw new Error(`No history set for ${filePath}`);
                }
                return history;
            };
            return {
                checkHasHistories: async () => {
                    mocks.statusReadCounts.set(
                        filePath,
                        (mocks.statusReadCounts.get(filePath) ?? 0) + 1,
                    );
                    return read().hasHistories;
                },
                checkCanUndo: async () => read().canUndo,
                checkCanRedo: async () => read().canRedo,
                getCurrentHistory: async () => read().head,
                getOriginalData: async () => read().file,
            } as unknown as EditingHistoryManager;
        },
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('FileEditingMenuComp', () => {
    test('draws nothing for a document with no history and nothing extra', async () => {
        setHistory(FILE_PATH, { hasHistories: false, canUndo: true });

        await render(
            <FileEditingMenuComp editableDocument={genEditableDocument()} />,
        );

        expect(container.innerHTML).toBe('');
    });

    test('greys every control out while there is nothing to take back or save', async () => {
        setHistory(FILE_PATH, { hasHistories: false });

        await render(
            <FileEditingMenuComp
                editableDocument={genEditableDocument()}
                extraChildren={<span className="extra">Fix</span>}
            />,
        );

        expect(readButtons()).toEqual([
            { label: 'Undo', disabled: true, faded: true },
            { label: 'Redo', disabled: true, faded: true },
            { label: 'Discard changed', disabled: true, faded: true },
            { label: 'Save', disabled: true, faded: true },
        ]);
        expect(container.querySelector('.extra')?.textContent).toBe('Fix');
    });

    test('a head that moved away from the file can be undone, discarded and saved', async () => {
        setHistory(FILE_PATH, {
            canUndo: true,
            head: toDocText([1, 2]),
            file: toDocText([1]),
        });
        const editableDocument = genEditableDocument();

        await render(
            <FileEditingMenuComp editableDocument={editableDocument} />,
        );

        expect(readButtons()).toEqual([
            { label: 'Undo', disabled: false, faded: false },
            { label: 'Redo', disabled: true, faded: true },
            { label: 'Discard changed', disabled: false, faded: false },
            { label: 'Save', disabled: false, faded: false },
        ]);
        expect(getButton('Save').title).toBe('Save [Ctrl+S]');

        await act(async () => {
            getButton('Undo').click();
            getButton('Save').click();
        });
        expect(editableDocument.historyUndo).toHaveBeenCalledOnce();
        expect(editableDocument.save).toHaveBeenCalledOnce();
        expect(editableDocument.historyRedo).not.toHaveBeenCalled();
    });

    test('redo is pressed through to the document', async () => {
        setHistory(FILE_PATH, { canRedo: true });
        const editableDocument = genEditableDocument();

        await render(
            <FileEditingMenuComp editableDocument={editableDocument} />,
        );
        await act(async () => {
            getButton('Redo').click();
        });

        expect(editableDocument.historyRedo).toHaveBeenCalledOnce();
    });

    test('a head that differs from the file only by its edit stamp is not unsaved', async () => {
        setHistory(FILE_PATH, {
            canUndo: true,
            head: toDocText([1, 2], '2026-10-28T10:00:00.000Z'),
            file: toDocText([1, 2], '2026-10-01T10:00:00.000Z'),
        });

        await render(
            <FileEditingMenuComp editableDocument={genEditableDocument()} />,
        );

        expect(getButton('Save').disabled).toBe(true);
        expect(getButton('Undo').disabled).toBe(false);
    });

    test('an unreadable head is nothing to save', async () => {
        setHistory(FILE_PATH, { canUndo: true, head: null });

        await render(
            <FileEditingMenuComp editableDocument={genEditableDocument()} />,
        );

        expect(getButton('Save').disabled).toBe(true);
    });

    test('named undo and redo controls keep their own names', async () => {
        setHistory(FILE_PATH, { canUndo: true, canRedo: true });

        await render(
            <FileEditingMenuComp
                editableDocument={genEditableDocument()}
                undoLabel="Undo note"
                redoLabel="Redo note"
            />,
        );

        expect(getButton('Undo note').title).toBe('Undo note');
        expect(getButton('Redo note').title).toBe('Redo note');
    });

    test('Discard asks first and discards only on Yes', async () => {
        setHistory(FILE_PATH, { canUndo: true });
        const editableDocument = genEditableDocument();
        await render(
            <FileEditingMenuComp editableDocument={editableDocument} />,
        );

        mocks.showAppConfirmMock.mockResolvedValueOnce(false);
        await act(async () => {
            getButton('Discard changed').click();
        });
        expect(editableDocument.historyDiscard).not.toHaveBeenCalled();
        expect(mocks.showAppConfirmMock).toHaveBeenCalledWith(
            'Discard changed',
            'Are you sure to discard all change histories?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );

        mocks.showAppConfirmMock.mockResolvedValueOnce(true);
        await act(async () => {
            getButton('Discard changed').click();
        });
        expect(editableDocument.historyDiscard).toHaveBeenCalledOnce();
    });

    test('the Save shortcut is window-wide only when asked, and saves', async () => {
        setHistory(FILE_PATH, { hasHistories: false });
        const editableDocument = genEditableDocument();

        await render(
            <FileEditingMenuComp
                editableDocument={editableDocument}
                isSaveShortcutGlobal
            />,
        );

        const registration = mocks.keyboardRegistrations.at(-1)!;
        expect(registration.eventMappers).toEqual([savingEventMapper]);
        expect(savingEventMapper).toEqual({
            allControlKey: ['Ctrl'],
            key: 's',
        });
        const preventDefault = vi.fn();
        registration.listener({ preventDefault });
        // Even with nothing showing as unsaved: the status trails the edit.
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(editableDocument.save).toHaveBeenCalledOnce();

        await render(
            <FileEditingMenuComp editableDocument={editableDocument} />,
        );
        expect(mocks.keyboardRegistrations.at(-1)?.eventMappers).toEqual([]);
    });
});

describe('useEditingHistoryStatus', () => {
    test('re-reads the status after a burst of file updates, once', async () => {
        setHistory(FILE_PATH, { hasHistories: false });
        await render(
            <FileEditingMenuComp editableDocument={genEditableDocument()} />,
        );
        expect(container.innerHTML).toBe('');
        expect(mocks.statusReadCounts.get(FILE_PATH)).toBe(1);

        setHistory(FILE_PATH, { canRedo: true });
        await fireFileUpdate(FILE_PATH);
        await fireFileUpdate(FILE_PATH);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(mocks.statusReadCounts.get(FILE_PATH)).toBe(1);

        await passDebounce();

        expect(mocks.statusReadCounts.get(FILE_PATH)).toBe(2);
        expect(getButton('Redo').disabled).toBe(false);
    });

    test('every menu over the same file refreshes on one update', async () => {
        // One per list item: a module-level timer would let the last caller
        // cancel the others and leave them stale.
        setHistory(FILE_PATH, { hasHistories: false });
        await render(
            <>
                <FileEditingMenuComp editableDocument={genEditableDocument()} />
                <FileEditingMenuComp editableDocument={genEditableDocument()} />
            </>,
        );
        expect(container.querySelectorAll('.editing-menu-body')).toHaveLength(
            0,
        );

        setHistory(FILE_PATH, { canUndo: true });
        await fireFileUpdate(FILE_PATH);
        await passDebounce();

        expect(container.querySelectorAll('.editing-menu-body')).toHaveLength(
            2,
        );
    });

    test('reads the new file when the document changes', async () => {
        const otherPath = '/docs/other.ows';
        setHistory(FILE_PATH, { hasHistories: false });
        setHistory(otherPath, { canUndo: true });
        await render(
            <FileEditingMenuComp editableDocument={genEditableDocument()} />,
        );
        expect(container.innerHTML).toBe('');

        await render(
            <FileEditingMenuComp
                editableDocument={genEditableDocument(otherPath)}
            />,
        );

        expect(getButton('Undo').disabled).toBe(false);
        expect(mocks.statusReadCounts.get(otherPath)).toBe(1);
    });
});
