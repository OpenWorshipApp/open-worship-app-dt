// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    editingHistoryState: {
        canRedo: false,
        canUndo: false,
        currentHistory: null as string | null,
        originalData: null as string | null,
    },
    editingHistoryGetInstanceMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    useFileSourceEventsMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../helper/debuggerHelpers', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: mocks.useFileSourceEventsMock,
}));

vi.mock('./EditingHistoryManager', () => ({
    default: {
        getInstance: mocks.editingHistoryGetInstanceMock,
    },
}));

vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: () => 'Ctrl+S',
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirmMock,
}));

import { FileEditingMenuComp, useEditingHistoryStatus } from './editingHelpers';

function createEditableDocument(filePath = '/docs/example.owa') {
    return {
        filePath,
        historyDiscard: vi.fn(),
        historyRedo: vi.fn(),
        historyUndo: vi.fn(),
        save: vi.fn(),
    } as any;
}

function StatusHarness({
    filePath,
    onUpdate,
}: Readonly<{
    filePath: string;
    onUpdate: (status: ReturnType<typeof useEditingHistoryStatus>) => void;
}>) {
    const status = useEditingHistoryStatus(filePath);

    useEffect(() => {
        onUpdate(status);
    }, [onUpdate, status]);

    return <div data-testid="status">{JSON.stringify(status)}</div>;
}

describe('editingHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();

        mocks.editingHistoryState.canUndo = false;
        mocks.editingHistoryState.canRedo = false;
        mocks.editingHistoryState.currentHistory = null;
        mocks.editingHistoryState.originalData = null;
        mocks.editingHistoryGetInstanceMock.mockImplementation(() => ({
            checkCanUndo: vi.fn(async () => mocks.editingHistoryState.canUndo),
            checkCanRedo: vi.fn(async () => mocks.editingHistoryState.canRedo),
            getCurrentHistory: vi.fn(
                async () => mocks.editingHistoryState.currentHistory,
            ),
            getOriginalData: vi.fn(
                async () => mocks.editingHistoryState.originalData,
            ),
        }));
        mocks.showAppConfirmMock.mockResolvedValue(true);
        mocks.useFileSourceEventsMock.mockImplementation(() => undefined);

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('computes save status after sanitizing metadata-only differences', async () => {
        const updates: Array<ReturnType<typeof useEditingHistoryStatus>> = [];
        mocks.editingHistoryState.canUndo = true;
        mocks.editingHistoryState.currentHistory = JSON.stringify({
            metadata: { lastEditDate: '2026-04-13T12:00:00Z' },
            value: 'same text',
        });
        mocks.editingHistoryState.originalData = JSON.stringify({
            metadata: { lastEditDate: '2026-04-01T12:00:00Z' },
            value: 'same text',
        });

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <StatusHarness
                    filePath="/docs/status.owa"
                    onUpdate={(status) => {
                        updates.push(status);
                    }}
                />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(updates.at(-1)).toEqual({
            canUndo: true,
            canRedo: false,
            canSave: false,
        });

        mocks.editingHistoryState.currentHistory = JSON.stringify({
            metadata: { lastEditDate: '2026-04-13T12:00:00Z' },
            value: 'changed text',
        });

        await act(async () => {
            root?.render(
                <StatusHarness
                    filePath="/docs/status-2.owa"
                    onUpdate={(status) => {
                        updates.push(status);
                    }}
                />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(updates.at(-1)).toEqual({
            canUndo: true,
            canRedo: false,
            canSave: true,
        });
    });

    test('returns null when there are no tools or extra children', async () => {
        const editableDocument = createEditableDocument('/docs/empty.owa');

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <FileEditingMenuComp editableDocument={editableDocument} />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(container?.innerHTML).toBe('');
    });

    test('renders tool buttons and wires undo redo save and discard actions', async () => {
        const editableDocument = createEditableDocument('/docs/menu.owa');
        mocks.editingHistoryState.canUndo = true;
        mocks.editingHistoryState.canRedo = true;
        mocks.editingHistoryState.currentHistory = 'draft 2';
        mocks.editingHistoryState.originalData = 'draft 1';
        mocks.showAppConfirmMock
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <FileEditingMenuComp editableDocument={editableDocument} />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        const buttons = Array.from(container?.querySelectorAll('button') ?? []);

        expect(buttons).toHaveLength(4);
        expect(buttons[0]?.disabled).toBe(false);
        expect(buttons[1]?.disabled).toBe(false);
        expect(buttons[3]?.getAttribute('title')).toContain('Ctrl+S');

        await act(async () => {
            buttons[0]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            buttons[1]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            buttons[2]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            await Promise.resolve();
        });

        expect(editableDocument.historyUndo).toHaveBeenCalledTimes(1);
        expect(editableDocument.historyRedo).toHaveBeenCalledTimes(1);
        expect(editableDocument.historyDiscard).not.toHaveBeenCalled();

        await act(async () => {
            buttons[2]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            buttons[3]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            await Promise.resolve();
        });

        expect(mocks.showAppConfirmMock).toHaveBeenCalledWith(
            'Discard changed',
            'Are you sure to discard all histories?',
            { confirmButtonLabel: 'Yes' },
        );
        expect(editableDocument.historyDiscard).toHaveBeenCalledTimes(1);
        expect(editableDocument.save).toHaveBeenCalledTimes(1);
    });
});
