// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    addLayerMock,
    removeLayerMock,
    registerFileSourceEventListenerMock,
    unregisterFileSourceEventListenerMock,
    appDocumentGetInstanceMock,
    appDocumentGetItemByIdMock,
    popupRenderMock,
} = vi.hoisted(() => ({
    addLayerMock: vi.fn(),
    removeLayerMock: vi.fn(),
    registerFileSourceEventListenerMock: vi.fn(),
    unregisterFileSourceEventListenerMock: vi.fn(),
    appDocumentGetInstanceMock: vi.fn(),
    appDocumentGetItemByIdMock: vi.fn(),
    popupRenderMock: vi.fn(),
}));

vi.mock('../helper/debuggerHelpers', async () => {
    const { useEffect } = await import('react');

    return {
        useAppEffect: useEffect,
    };
});

vi.mock('../event/KeyboardEventListener', () => ({
    default: {
        addLayer: addLayerMock,
        removeLayer: removeLayerMock,
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        registerFileSourceEventListener: registerFileSourceEventListenerMock,
        unregisterEventListener: unregisterFileSourceEventListenerMock,
    },
}));

vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        getInstance: appDocumentGetInstanceMock,
    },
}));

vi.mock('../slide-editor/SlideEditorPopupComp', () => ({
    default: ({
        slide,
    }: {
        slide: { id: number; filePath: string; name?: string };
    }) => {
        popupRenderMock(slide);
        return (
            <div data-testid="slide-editor-popup">
                {slide.id}:{slide.name ?? ''}:{slide.filePath}
            </div>
        );
    },
}));

function createSlide(overrides: Record<string, unknown> = {}) {
    return {
        id: 7,
        filePath: '/docs/main.ows',
        name: 'Original slide',
        ...overrides,
    } as any;
}

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('SlideEditHandlerComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    let fileSourceCallbacks: Array<(data: any) => Promise<void>>;
    let listenerTokens: string[];

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.resetModules();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        fileSourceCallbacks = [];
        listenerTokens = [];

        registerFileSourceEventListenerMock.mockImplementation(
            (_events: string[], callback: (data: any) => Promise<void>) => {
                fileSourceCallbacks.push(callback);
                const token = `listener-${fileSourceCallbacks.length}`;
                listenerTokens.push(token);
                return token;
            },
        );
        appDocumentGetInstanceMock.mockReturnValue({
            getItemById: appDocumentGetItemByIdMock,
        });
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
            await flushAsyncEvents();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('opens, refreshes, ignores unrelated updates, and closes the quick editor', async () => {
        const {
            closeItemSlideEditEvent,
            closeSlideQuickEdit,
            default: SlideEditHandlerComp,
            openItemSlideEditEvent,
            openSlideQuickEdit,
        } = await import('./SlideEditHandlerComp');

        const initialSlide = createSlide();
        const refreshedSlide = createSlide({ name: 'Updated slide' });

        appDocumentGetItemByIdMock
            .mockResolvedValueOnce(refreshedSlide)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(refreshedSlide);

        await act(async () => {
            root.render(<SlideEditHandlerComp />);
            await flushAsyncEvents();
        });

        expect(
            container.querySelector('[data-testid="slide-editor-popup"]'),
        ).toBeNull();
        expect(openItemSlideEditEvent).toEqual({
            widget: 'slide-edit',
            state: 'open',
        });
        expect(closeItemSlideEditEvent).toEqual({
            widget: 'slide-edit',
            state: 'close',
        });

        await act(async () => {
            openSlideQuickEdit(initialSlide);
            await flushAsyncEvents();
        });

        expect(addLayerMock).toHaveBeenCalledWith('slide-edit');
        expect(registerFileSourceEventListenerMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
            '/docs/main.ows',
        );
        expect(popupRenderMock).toHaveBeenCalledWith(initialSlide);
        expect(container.textContent).toContain('Original slide');
        expect(fileSourceCallbacks).toHaveLength(1);

        await act(async () => {
            await fileSourceCallbacks[0]?.({ eventType: 'save' });
            await flushAsyncEvents();
        });

        expect(appDocumentGetInstanceMock).not.toHaveBeenCalled();
        expect(appDocumentGetItemByIdMock).not.toHaveBeenCalled();

        await act(async () => {
            await fileSourceCallbacks[0]?.({ eventType: 'redo' });
            await flushAsyncEvents();
        });

        expect(appDocumentGetInstanceMock).toHaveBeenCalledWith(
            '/docs/main.ows',
        );
        expect(appDocumentGetItemByIdMock).toHaveBeenCalledWith(7);
        expect(popupRenderMock).toHaveBeenLastCalledWith(refreshedSlide);
        expect(container.textContent).toContain('Updated slide');
        expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(2);
        expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith(
            listenerTokens[0],
        );

        await act(async () => {
            await fileSourceCallbacks[1]?.({ eventType: 'undo' });
            await flushAsyncEvents();
        });

        expect(appDocumentGetItemByIdMock).toHaveBeenCalledTimes(2);
        expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain('Updated slide');

        await act(async () => {
            await fileSourceCallbacks[1]?.({ eventType: 'discard' });
            await flushAsyncEvents();
        });

        expect(appDocumentGetItemByIdMock).toHaveBeenCalledTimes(3);
        expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain('Updated slide');

        await act(async () => {
            closeSlideQuickEdit();
            await flushAsyncEvents();
        });

        expect(removeLayerMock).toHaveBeenCalledWith('slide-edit');
        expect(
            container.querySelector('[data-testid="slide-editor-popup"]'),
        ).toBeNull();
        expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith(
            listenerTokens[1],
        );
    });
});
