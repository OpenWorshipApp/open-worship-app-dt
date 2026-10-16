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
    checkIsAppDocumentSelectedMock,
    openAppDocumentEditorExternalMock,
    openPopupWindowMock,
} = vi.hoisted(() => ({
    appProviderMock: {
        isPagePresenter: true,
        isPageAppDocumentEditor: false,
        isPageReader: false,
        isPageScreenMirror: false,
        presenterHomePage: '/presenter',
        readerHomePage: '/reader',
        experimentHomePage: '/experiment',
        appDocumentEditorHomePage: '/slide-editor',
        screenMirrorHomePage: '/screen-mirror',
        systemUtils: { isDev: false },
    },
    getSelectedVaryAppDocumentMock: vi.fn(async () => null as any),
    getSelectedEditingSlideMock: vi.fn(async () => null as any),
    setSelectedVaryAppDocumentMock: vi.fn(),
    setSelectedEditingSlideMock: vi.fn(),
    preloadAttachedBackgroundMock: vi.fn(),
    checkIsVaryAppDocumentSwitchRefusedMock: vi.fn(() => false),
    forceUnpinVaryAppDocumentMock: vi.fn(),
    checkIsAppDocumentSelectedMock: vi.fn(async () => false),
    openAppDocumentEditorExternalMock: vi.fn(),
    openPopupWindowMock: vi.fn(),
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
vi.mock('../helper/domHelpers', () => ({
    openPopupWindow: openPopupWindowMock,
}));
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
    checkIsAppDocumentSelected: checkIsAppDocumentSelectedMock,
    openAppDocumentEditorExternal: openAppDocumentEditorExternalMock,
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

describe('layout navigation tabs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageAppDocumentEditor = false;
        appProviderMock.isPageScreenMirror = false;
        appProviderMock.systemUtils.isDev = false;
        checkIsAppDocumentSelectedMock.mockResolvedValue(false);
    });

    test('shows the editor from Presenter and the Presenter from other pages', async () => {
        const { genTabs } = await import('./layoutHelpers');
        expect(genTabs().map((tab) => tab.routePath)).toEqual([
            '/slide-editor',
            '/reader',
            '/screen-mirror',
        ]);

        appProviderMock.isPagePresenter = false;
        appProviderMock.isPageScreenMirror = true;
        appProviderMock.systemUtils.isDev = true;
        expect(genTabs().map((tab) => tab.routePath)).toEqual([
            '/presenter',
            '/reader',
            '/presenter',
        ]);
        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageAppDocumentEditor = true;
        appProviderMock.systemUtils.isDev = false;
        expect(genTabs().map((tab) => tab.routePath)).toEqual(['/reader']);
    });

    test('opens Reader and experiment in their own windows', async () => {
        const { genLayoutTabs } = await import('./layoutHelpers');
        const { readerTab, experimentTab } = genLayoutTabs();
        readerTab.externalOpen?.onOpen();
        expect(openPopupWindowMock).toHaveBeenCalledWith(
            '/reader',
            expect.stringMatching(/^reader_\d+$/),
            'reader',
        );
        experimentTab.onOpen?.();
        expect(openPopupWindowMock).toHaveBeenCalledWith(
            '/experiment',
            expect.stringMatching(/^experiment_\d+$/),
            'experiment',
            { appBlinkFeatures: ['CanvasDrawElement'] },
        );
    });

    test('opens a selected document in an external editor only after precheck', async () => {
        const { genLayoutTabs } = await import('./layoutHelpers');
        const editorTab = genLayoutTabs().editorTab;
        expect(editorTab.preCheck).toBe(checkIsAppDocumentSelectedMock);
        await editorTab.externalOpen?.onOpen();
        expect(getSelectedVaryAppDocumentMock).not.toHaveBeenCalled();
        expect(openAppDocumentEditorExternalMock).not.toHaveBeenCalled();

        checkIsAppDocumentSelectedMock.mockResolvedValue(true);
        getSelectedVaryAppDocumentMock.mockResolvedValue(DOCUMENT_1);
        await editorTab.externalOpen?.onOpen();
        expect(getSelectedVaryAppDocumentMock).toHaveBeenCalledOnce();
        expect(openAppDocumentEditorExternalMock).toHaveBeenCalledWith(
            DOCUMENT_1,
        );
    });
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
