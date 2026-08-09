// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    canvasControllerState,
    canvasItemPropsState,
    canvasItemState,
    contextMenuHandlerMock,
    errorContextMenuHandlerMock,
    genErrorContextMenuHandlerMock,
    genHandleContextMenuOpeningMock,
    selectionState,
    setEditingCanvasItemMock,
    setSelectedCanvasItemsMock,
} = vi.hoisted(() => {
    const contextMenuHandlerMock = vi.fn();
    const errorContextMenuHandlerMock = vi.fn();
    return {
        contextMenuHandlerMock,
        errorContextMenuHandlerMock,
        genHandleContextMenuOpeningMock: vi.fn(() => contextMenuHandlerMock),
        genErrorContextMenuHandlerMock: vi.fn(() => {
            return errorContextMenuHandlerMock;
        }),
        setEditingCanvasItemMock: vi.fn(),
        setSelectedCanvasItemsMock: vi.fn(),
        selectionState: { isSelected: false, isEditing: false },
        canvasItemPropsState: {
            value: {
                id: 11,
                type: 'video',
                top: 100,
                left: 200,
                width: 60,
                height: 40,
                rotate: 0,
            } as any,
        },
        canvasItemState: {
            value: {
                id: 11,
                type: 'video',
                isLocked: false,
                shouldLockAspectRatio: false,
            } as any,
        },
        canvasControllerState: { value: {} as any },
    };
});

// `isDev` keeps `useAppEffect` a plain `useEffect`; `pathUtils.sep` is read at
// module load by `fileHelpers`, which `boxEditorHelpers` -> `themeHelpers`
// pulls in transitively.
vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        pathUtils: { sep: '/' },
    },
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => canvasControllerState.value,
}));

vi.mock('../canvasEventHelpers', () => ({
    useSlideCanvasScale: () => 1,
}));

vi.mock('../canvasSnapGuideHelpers', () => ({
    useCanvasSnapContext: () => ({
        getSnapTargets: () => ({ vertical: [], horizontal: [] }),
        setSnapLines: vi.fn(),
    }),
}));

vi.mock('../../../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => null,
}));

// Only the cursor helper is needed here, and the real module reaches
// `themeHelpers` -> `colorHelpers` -> `dragHelpers`, dragging the whole Bible
// subsystem into this suite.
vi.mock('./boxEditorHelpers', () => ({
    getRotatedResizeCursor: () => 'nw-resize',
}));

vi.mock('../CanvasItem', () => ({
    default: {
        genShapeBoxStyle: (props: any) => ({
            width: `${props.width}px`,
            height: `${props.height}px`,
        }),
    },
    useCanvasItemContext: () => canvasItemState.value,
    useCanvasItemPropsContext: () => canvasItemPropsState.value,
    useIsCanvasItemSelected: () => selectionState.isSelected,
    useEditingCanvasItemAndSetterContext: () => ({
        canvasItem: selectionState.isEditing ? canvasItemState.value : null,
    }),
    useSelectedCanvasItemsAndSetterContext: () => ({
        canvasItems: selectionState.isSelected ? [canvasItemState.value] : [],
    }),
    useSetEditingCanvasItem: () => setEditingCanvasItemMock,
    useSetSelectedCanvasItems: () => setSelectedCanvasItemsMock,
}));

// Stubs: this suite is about the shell around the content, not the content.
// `BoxEditorNormalViews.coverage.test.tsx` covers the renderers themselves.
vi.mock('./BoxEditorCanvasItemRenderComp', () => ({
    default: () => <video data-content-probe="" />,
}));

vi.mock('./BoxEditorNormalTextEditModeComp', () => ({
    default: () => <textarea data-text-edit-probe="" />,
}));

vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    genErrorContextMenuHandler: genErrorContextMenuHandlerMock,
}));

import { BoxEditorComp } from './BoxEditorComp';

describe('BoxEditorComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        selectionState.isSelected = false;
        selectionState.isEditing = false;
        canvasItemPropsState.value = {
            id: 11,
            type: 'video',
            top: 100,
            left: 200,
            width: 60,
            height: 40,
            rotate: 0,
        };
        canvasItemState.value = {
            id: 11,
            type: 'video',
            isLocked: false,
            shouldLockAspectRatio: false,
        };
        canvasControllerState.value = {
            focusEditor: vi.fn(),
            genHandleContextMenuOpening: genHandleContextMenuOpeningMock,
            editCanvasItemById: vi.fn(),
            editCanvasItemsByIds: vi.fn(),
        };
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

    async function render() {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            if (!root) {
                root = createRoot(container);
            }
            root.render(<BoxEditorComp />);
        });
    }

    // The whole reason the two modes were merged: a selection change used to
    // swap one subtree for another, which restarted every <video>, <iframe>
    // and camera stream on the canvas.
    test('keeps the content element across selection changes', async () => {
        await render();

        const contentElement = container?.querySelector('video');
        expect(contentElement).not.toBeNull();
        (contentElement as any).probeMarker = 'original';
        expect(container?.querySelector('.object.rotate')).toBeNull();

        selectionState.isSelected = true;
        await render();

        expect(container?.querySelector('video')).toBe(contentElement);
        expect((container?.querySelector('video') as any).probeMarker).toBe(
            'original',
        );
        // ...and the controller chrome mounted on top of it.
        expect(
            container?.querySelector('.app-box-editor.controllable'),
        ).not.toBeNull();
        expect(container?.querySelector('.object.rotate')).not.toBeNull();
        expect(container?.querySelectorAll('.tools .object').length).toBe(9);

        selectionState.isSelected = false;
        await render();

        expect(container?.querySelector('video')).toBe(contentElement);
        expect(container?.querySelector('.object.rotate')).toBeNull();
    });

    test('positions every state from the same wrapper, at the box center', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            rotate: 30,
        };
        await render();

        const wrapper = container?.querySelector<HTMLDivElement>(
            '.editor-controller-box-wrapper',
        );
        // top/left + half the size: the wrapper is a zero-sized anchor at the
        // box center, which is what makes rotation origin-independent.
        expect(wrapper?.style.top).toBe('120px');
        expect(wrapper?.style.left).toBe('230px');
        expect(wrapper?.style.transform).toBe('rotate(30deg)');
        expect(wrapper?.classList.contains('controlling')).toBe(false);

        const box = container?.querySelector<HTMLDivElement>('.app-box-editor');
        expect(box?.dataset.appBoxEditorId).toBe('11');
        expect(box?.style.transform).toBe('translate(-50%, -50%)');
        expect(box?.style.width).toBe('60px');

        selectionState.isSelected = true;
        await render();

        expect(
            container
                ?.querySelector('.editor-controller-box-wrapper')
                ?.classList.contains('controlling'),
        ).toBe(true);
    });

    test('shows a lock indicator instead of handles for a locked box', async () => {
        canvasItemState.value = { ...canvasItemState.value, isLocked: true };
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            locked: true,
        };
        selectionState.isSelected = true;
        await render();

        expect(container?.querySelector('.locked-indicator')).not.toBeNull();
        expect(container?.querySelector('.object.rotate')).toBeNull();
        // A locked box can't be dragged, so it is not a drag-group target.
        expect(
            container
                ?.querySelector('.editor-controller-box-wrapper')
                ?.classList.contains('controlling'),
        ).toBe(false);
    });

    test('selects on click, and only appends on a modifier click when already selected', async () => {
        await render();
        const box = container?.querySelector<HTMLDivElement>('.app-box-editor');

        await act(async () => {
            box?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(setSelectedCanvasItemsMock).toHaveBeenCalledWith(
            canvasItemState.value,
            { isAppend: false },
        );

        selectionState.isSelected = true;
        await render();
        setSelectedCanvasItemsMock.mockClear();

        // A plain click on an already-selected box must leave the selection
        // alone, or dragging a multi-selection would collapse it to one box.
        await act(async () => {
            box?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(setSelectedCanvasItemsMock).not.toHaveBeenCalled();

        await act(async () => {
            box?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, shiftKey: true }),
            );
        });
        expect(setSelectedCanvasItemsMock).toHaveBeenCalledWith(
            canvasItemState.value,
            { isAppend: true },
        );
    });

    test('enters text editing on a double click of a selected box only', async () => {
        await render();
        const box = container?.querySelector<HTMLDivElement>('.app-box-editor');

        await act(async () => {
            box?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        expect(setEditingCanvasItemMock).not.toHaveBeenCalled();

        selectionState.isSelected = true;
        await render();
        await act(async () => {
            box?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        expect(setEditingCanvasItemMock).toHaveBeenCalledWith(
            canvasItemState.value,
        );
    });

    test('swaps in the text editor and hands it the context menu', async () => {
        canvasItemState.value = { ...canvasItemState.value, type: 'text' };
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            type: 'text',
        };
        selectionState.isEditing = true;
        await render();

        const box = container?.querySelector<HTMLDivElement>('.app-box-editor');
        expect(box?.classList.contains('editable')).toBe(true);
        expect(
            container?.querySelector('[data-text-edit-probe]'),
        ).not.toBeNull();
        expect(container?.querySelector('[data-content-probe]')).toBeNull();

        // Right-clicking while editing commits the draft (handled inside the
        // text editor) instead of opening the box menu.
        await act(async () => {
            box?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(contextMenuHandlerMock).not.toHaveBeenCalled();
    });

    test('gives an error box its own context menu', async () => {
        canvasItemState.value = { ...canvasItemState.value, type: 'error' };
        await render();

        const box = container?.querySelector<HTMLDivElement>('.app-box-editor');
        await act(async () => {
            box?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(genErrorContextMenuHandlerMock).toHaveBeenCalledWith(
            canvasControllerState.value,
            canvasItemState.value,
        );
        expect(errorContextMenuHandlerMock).toHaveBeenCalledOnce();
        expect(genHandleContextMenuOpeningMock).not.toHaveBeenCalled();
    });
});
