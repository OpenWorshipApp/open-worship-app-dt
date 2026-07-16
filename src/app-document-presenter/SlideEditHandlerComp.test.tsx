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

vi.mock('../helper/appHooks', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const { useEffect } = await import('react');

    return {
        ...actual,
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
    const data = {
        id: 7,
        filePath: '/docs/main.ows',
        name: 'Original slide',
        ...overrides,
    };
    return {
        ...data,
        toJson: () => ({ id: data.id, name: data.name }),
    } as any;
}

async function flushAsyncEvents() {
    // WindowEventListener dispatches open/close through genTimeoutAttempt(10),
    // a real 10ms setTimeout, so flushing microtasks alone is not enough — wait
    // a macrotask longer than the debounce for those events to actually fire.
    await new Promise((resolve) => setTimeout(resolve, 25));
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

    test(
        'opens; refreshes on external change and history navigation; ' +
            'ignores self-echoes and redundant updates; closes',
        async () => {
            const {
                closeItemSlideEditEvent,
                closeSlideQuickEdit,
                default: SlideEditHandlerComp,
                openItemSlideEditEvent,
                openSlideQuickEdit,
            } = await import('./SlideEditHandlerComp');

            const initialSlide = createSlide();
            const externallyChangedSlide = createSlide({
                name: 'Updated slide',
            });
            const sameContentEcho = createSlide({ name: 'Updated slide' });
            const historySlide = createSlide({ name: 'History slide' });

            appDocumentGetItemByIdMock
                .mockResolvedValueOnce(externallyChangedSlide) // external change
                .mockResolvedValueOnce(sameContentEcho) // redundant echo
                .mockResolvedValueOnce(historySlide) // history navigation
                .mockResolvedValueOnce(null); // slide gone

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

            // A self-echo from this window's own in-progress editing must be
            // ignored so it doesn't revert the live edits.
            await act(async () => {
                await fileSourceCallbacks[0]?.({ isHistoryEditing: true });
                await flushAsyncEvents();
            });

            expect(appDocumentGetInstanceMock).not.toHaveBeenCalled();
            expect(appDocumentGetItemByIdMock).not.toHaveBeenCalled();
            expect(container.textContent).toContain('Original slide');

            // A genuine external change (another window/process saved the file)
            // arrives as a bare update and must refresh the popup.
            await act(async () => {
                await fileSourceCallbacks[0]?.(undefined);
                await flushAsyncEvents();
            });

            expect(appDocumentGetInstanceMock).toHaveBeenCalledWith(
                '/docs/main.ows',
            );
            expect(appDocumentGetItemByIdMock).toHaveBeenCalledWith(7);
            expect(popupRenderMock).toHaveBeenLastCalledWith(
                externallyChangedSlide,
            );
            expect(container.textContent).toContain('Updated slide');
            expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(
                2,
            );
            expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith(
                listenerTokens[0],
            );

            // A redundant update whose content matches the current slide must
            // not reload the canvas (no re-render / re-registration).
            await act(async () => {
                await fileSourceCallbacks[1]?.(undefined);
                await flushAsyncEvents();
            });

            expect(appDocumentGetItemByIdMock).toHaveBeenCalledTimes(2);
            expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(
                2,
            );
            expect(popupRenderMock).toHaveBeenLastCalledWith(
                externallyChangedSlide,
            );
            expect(container.textContent).toContain('Updated slide');

            // History navigation always refreshes, even when content matches.
            await act(async () => {
                await fileSourceCallbacks[1]?.({
                    eventType: 'undo',
                    isHistoryEditing: true,
                });
                await flushAsyncEvents();
            });

            expect(appDocumentGetItemByIdMock).toHaveBeenCalledTimes(3);
            expect(popupRenderMock).toHaveBeenLastCalledWith(historySlide);
            expect(container.textContent).toContain('History slide');
            expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(
                3,
            );

            // If the slide no longer exists at this history point, keep the
            // current view instead of crashing.
            await act(async () => {
                await fileSourceCallbacks[2]?.({
                    eventType: 'discard',
                    isHistoryEditing: true,
                });
                await flushAsyncEvents();
            });

            expect(appDocumentGetItemByIdMock).toHaveBeenCalledTimes(4);
            expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(
                3,
            );
            expect(container.textContent).toContain('History slide');

            await act(async () => {
                closeSlideQuickEdit();
                await flushAsyncEvents();
            });

            expect(removeLayerMock).toHaveBeenCalledWith('slide-edit');
            expect(
                container.querySelector('[data-testid="slide-editor-popup"]'),
            ).toBeNull();
            expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith(
                listenerTokens[2],
            );
        },
    );
});
