// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    getSelectedVaryAppDocumentMock,
    getSelectedEditingSlideMock,
    setSelectedVaryAppDocumentMock,
    setSelectedEditingSlideMock,
    preloadAttachedBackgroundMock,
    checkIsVaryAppDocumentSwitchRefusedMock,
    forceUnpinVaryAppDocumentMock,
    fileSourceEventListeners,
} = vi.hoisted(() => ({
    appProviderMock: {
        isPagePresenter: true,
        isPageAppDocumentEditor: false,
        isPageReader: false,
        systemUtils: { isDev: false },
    },
    getSelectedVaryAppDocumentMock: vi.fn(async () => null as any),
    getSelectedEditingSlideMock: vi.fn(async () => null as any),
    setSelectedVaryAppDocumentMock: vi.fn(),
    setSelectedEditingSlideMock: vi.fn(),
    preloadAttachedBackgroundMock: vi.fn(),
    checkIsVaryAppDocumentSwitchRefusedMock: vi.fn(() => false),
    forceUnpinVaryAppDocumentMock: vi.fn(),
    fileSourceEventListeners: [] as {
        events: string[];
        callback: (filePath: string) => void;
    }[],
}));

vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/labelIconHelpers', () => ({
    genLabelIcon: () => null,
}));
vi.mock('../helper/domHelpers', () => ({ openPopupWindow: vi.fn() }));
vi.mock('./routeHelpers', () => ({
    toTitleExternal: (value: string) => value,
}));
vi.mock('../slide-editor/slideEditingKeyboardEventHelpers', () => ({
    onSlideItemsKeyboardEvent: vi.fn(),
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    checkIsHistoryMovementEventType: () => false,
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: { checkIsThisType: () => false },
    checkIsAppDocumentSelected: vi.fn(),
    openAppDocumentEditorExternal: vi.fn(),
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    getSelectedVaryAppDocument: getSelectedVaryAppDocumentMock,
    getSelectedEditingSlide: getSelectedEditingSlideMock,
    setSelectedVaryAppDocument: setSelectedVaryAppDocumentMock,
    setSelectedEditingSlide: setSelectedEditingSlideMock,
    preloadAttachedBackground: preloadAttachedBackgroundMock,
}));
vi.mock('../app-document-list/varyAppDocumentLockHelpers', () => ({
    checkIsVaryAppDocumentSwitchRefused:
        checkIsVaryAppDocumentSwitchRefusedMock,
    forceUnpinVaryAppDocument: forceUnpinVaryAppDocumentMock,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (events: string[], callback: any) => {
        fileSourceEventListeners.push({ events, callback });
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffectAsync: (
            effectMethod: (methods: any) => Promise<any>,
            deps: any[],
            methods: any,
        ) => {
            useEffect(() => {
                effectMethod({ ...methods });
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

const DOCUMENT_1 = { filePath: '/docs/a1.ows', isEditable: false } as any;
const DOCUMENT_2 = { filePath: '/docs/a2.ows', isEditable: false } as any;

describe('useAppDocumentContextValues', () => {
    let container: HTMLDivElement;
    let root: Root;
    let contextValue: any;

    async function renderHost() {
        const { useAppDocumentContextValues } = await import('./layoutHelpers');
        function HostComp() {
            const { varyAppDocumentContextValue } =
                useAppDocumentContextValues();
            contextValue = varyAppDocumentContextValue;
            return null;
        }
        await act(async () => {
            root.render(<HostComp />);
            await flushAsyncEvents();
        });
    }

    function fireDeleteEvent(filePath: string) {
        for (const listener of fileSourceEventListeners) {
            if (listener.events.includes('delete')) {
                listener.callback(filePath);
            }
        }
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        fileSourceEventListeners.length = 0;
        checkIsVaryAppDocumentSwitchRefusedMock.mockReturnValue(false);
        getSelectedVaryAppDocumentMock.mockResolvedValue(null);
        getSelectedEditingSlideMock.mockResolvedValue(null);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('a refused switch changes nothing and costs no document loading', async () => {
        getSelectedVaryAppDocumentMock.mockResolvedValue(DOCUMENT_1);
        await renderHost();
        expect(contextValue.selectedVaryAppDocument).toBe(DOCUMENT_1);

        checkIsVaryAppDocumentSwitchRefusedMock.mockReturnValue(true);
        preloadAttachedBackgroundMock.mockClear();
        let isApplied: boolean | undefined;
        await act(async () => {
            isApplied =
                await contextValue.setSelectedVaryAppDocument(DOCUMENT_2);
            await flushAsyncEvents();
        });

        expect(isApplied).toBe(false);
        expect(contextValue.selectedVaryAppDocument).toBe(DOCUMENT_1);
        expect(setSelectedVaryAppDocumentMock).not.toHaveBeenCalled();
        // The guard runs BEFORE any loading, so a mis-click is cheaper than a
        // real switch.
        expect(preloadAttachedBackgroundMock).not.toHaveBeenCalled();
    });

    test('a forced switch bypasses the pin, as a rename must', async () => {
        getSelectedVaryAppDocumentMock.mockResolvedValue(DOCUMENT_1);
        await renderHost();

        checkIsVaryAppDocumentSwitchRefusedMock.mockReturnValue(true);
        let isApplied: boolean | undefined;
        await act(async () => {
            isApplied = await contextValue.setSelectedVaryAppDocument(
                DOCUMENT_2,
                { isForce: true },
            );
            await flushAsyncEvents();
        });

        expect(isApplied).toBe(true);
        expect(checkIsVaryAppDocumentSwitchRefusedMock).not.toHaveBeenCalled();
        expect(contextValue.selectedVaryAppDocument).toBe(DOCUMENT_2);
        expect(setSelectedVaryAppDocumentMock).toHaveBeenCalledWith(DOCUMENT_2);
    });

    test('an allowed switch applies and reports true', async () => {
        await renderHost();

        let isApplied: boolean | undefined;
        await act(async () => {
            isApplied =
                await contextValue.setSelectedVaryAppDocument(DOCUMENT_2);
            await flushAsyncEvents();
        });

        expect(isApplied).toBe(true);
        expect(contextValue.selectedVaryAppDocument).toBe(DOCUMENT_2);
        expect(preloadAttachedBackgroundMock).toHaveBeenCalledWith(DOCUMENT_2);
    });

    test('deleting the selected document force-unpins, another one does not', async () => {
        getSelectedVaryAppDocumentMock.mockResolvedValue(DOCUMENT_1);
        await renderHost();

        await act(async () => {
            fireDeleteEvent(DOCUMENT_2.filePath);
            await flushAsyncEvents();
        });
        expect(forceUnpinVaryAppDocumentMock).not.toHaveBeenCalled();
        expect(contextValue.selectedVaryAppDocument).toBe(DOCUMENT_1);

        await act(async () => {
            fireDeleteEvent(DOCUMENT_1.filePath);
            await flushAsyncEvents();
        });
        expect(forceUnpinVaryAppDocumentMock).toHaveBeenCalledTimes(1);
        expect(contextValue.selectedVaryAppDocument).toBeNull();
    });

    test('a start-up selection that no longer resolves force-unpins', async () => {
        getSelectedVaryAppDocumentMock.mockResolvedValue(null);
        await renderHost();

        expect(forceUnpinVaryAppDocumentMock).toHaveBeenCalledTimes(1);
        expect(preloadAttachedBackgroundMock).not.toHaveBeenCalled();
    });

    test('a start-up selection that resolves keeps the pin', async () => {
        getSelectedVaryAppDocumentMock.mockResolvedValue(DOCUMENT_1);
        await renderHost();

        expect(forceUnpinVaryAppDocumentMock).not.toHaveBeenCalled();
        expect(preloadAttachedBackgroundMock).toHaveBeenCalledWith(DOCUMENT_1);
    });
});
