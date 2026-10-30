// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    scale: 1,
    info: null as any,
    controllers: [] as any[],
    isSelected: false,
    isEditing: false,
    selectedItems: [] as any[],
    props: null as any,
    canvasItem: null as any,
    canvasController: null as any,
    snapContext: {
        getSnapTargets: () => ({ vertical: [], horizontal: [] }),
        setSnapLines: () => {},
    },
    setEditing: vi.fn(),
    setSelected: vi.fn(),
}));

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
    useCanvasControllerContext: () => h.canvasController,
}));

vi.mock('../canvasEventHelpers', () => ({
    useSlideCanvasScale: () => h.scale,
}));

vi.mock('../canvasSnapGuideHelpers', () => ({
    useCanvasSnapContext: () => h.snapContext,
}));

vi.mock('../../../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => null,
}));

vi.mock('./boxEditorHelpers', () => ({
    getRotatedResizeCursor: () => 'nw-resize',
}));

vi.mock('../CanvasItem', () => ({
    default: {
        genShapeBoxStyle: () => ({}),
        genBlendStyle: () => ({}),
    },
    genBoxBorderRadius: () => undefined,
    useCanvasItemContext: () => h.canvasItem,
    useCanvasItemPropsContext: () => h.props,
    useIsCanvasItemSelected: () => h.isSelected,
    useEditingCanvasItemAndSetterContext: () => ({
        canvasItem: h.isEditing ? h.canvasItem : null,
    }),
    useSelectedCanvasItemsAndSetterContext: () => ({
        canvasItems: h.selectedItems,
    }),
    useSetEditingCanvasItem: () => h.setEditing,
    useSetSelectedCanvasItems: () => h.setSelected,
}));

vi.mock('./BoxEditorCanvasItemRenderComp', () => ({
    default: () => <div data-content-probe="" />,
}));

vi.mock('./BoxEditorNormalTextEditModeComp', () => ({
    default: () => <textarea data-text-edit-probe="" />,
}));

vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    genErrorContextMenuHandler: () => () => {},
}));

// The drag engine itself is covered by `BoxEditorController.test.ts`; this
// suite is about what the box does with what the engine reports.
vi.mock('../../BoxEditorController', () => ({
    default: class FakeBoxEditorController {
        scaleFactor: number;
        lockAspectRatio = false;
        getSnapTargets: unknown = null;
        onSnapping: unknown = null;
        getMoveGroupIds: null | (() => number[]) = null;
        rotatorCN = 'rotate';
        resizeActorList = { 'right-mid': {}, 'left-mid': {} };
        onDone: (moves: any[]) => Promise<void> = async () => {};
        initEvent = vi.fn(
            (
                _wrapper: HTMLElement,
                _chrome: HTMLElement,
                onDone: (moves: any[]) => Promise<void>,
            ) => {
                this.onDone = onDone;
            },
        );
        release = vi.fn();
        constructor(scaleFactor: number) {
            this.scaleFactor = scaleFactor;
            h.controllers.push(this);
        }
        getInfo() {
            return h.info;
        }
    },
}));

import { BoxEditorComp } from './BoxEditorComp';

let container: HTMLDivElement;
let root: Root;

function controller() {
    expect(h.controllers).toHaveLength(1);
    return h.controllers[0];
}

async function render() {
    await act(async () => root.render(<BoxEditorComp />));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.scale = 1;
    h.info = { left: 1, top: 2, width: 30, height: 40, rotate: 5 };
    h.controllers = [];
    h.isSelected = true;
    h.isEditing = false;
    h.setEditing.mockReset();
    h.setSelected.mockReset();
    h.props = {
        id: 11,
        type: 'image',
        top: 100,
        left: 200,
        width: 60,
        height: 40,
        rotate: 0,
    };
    h.canvasItem = {
        id: 11,
        type: 'image',
        isLocked: false,
        shouldLockAspectRatio: true,
    };
    h.selectedItems = [h.canvasItem];
    h.canvasController = {
        focusEditor: vi.fn(),
        genHandleContextMenuOpening: () => () => {},
        editCanvasItemById: vi.fn(),
        editCanvasItemsByIds: vi.fn(),
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BoxEditorComp drag commits', () => {
    test('a selected box gives the engine its anchor, chrome and settings', async () => {
        h.scale = 0.5;
        await render();
        const engine = controller();

        expect(engine.initEvent).toHaveBeenCalledOnce();
        const [wrapper, chrome] = engine.initEvent.mock.calls[0];
        expect(wrapper).toBe(
            container.querySelector('.editor-controller-box-wrapper'),
        );
        expect(chrome).toBe(
            container.querySelector('.editor-controller-box-chrome'),
        );
        expect(engine.scaleFactor).toBe(0.5);
        expect(engine.lockAspectRatio).toBe(true);
        expect(engine.getSnapTargets).toBe(h.snapContext.getSnapTargets);
        expect(engine.onSnapping).toBe(h.snapContext.setSnapLines);
    });

    test('a single-box drag writes the measured box onto the latest item', async () => {
        await render();
        await act(async () => controller().onDone([]));

        expect(h.canvasController.editCanvasItemById).toHaveBeenCalledWith(
            11,
            expect.any(Function),
        );
        const edit = h.canvasController.editCanvasItemById.mock.calls[0][1];
        const latestItem = { id: 11, applyProps: vi.fn() };
        edit(latestItem);
        expect(latestItem.applyProps).toHaveBeenCalledWith(h.info);
        expect(h.canvasController.editCanvasItemsByIds).not.toHaveBeenCalled();
    });

    test('a group drag lands as one edit that places every box', async () => {
        await render();
        await act(async () =>
            controller().onDone([
                { id: 12, left: 5, top: 6 },
                { id: 13, left: 7, top: 8 },
            ]),
        );

        expect(h.canvasController.editCanvasItemById).not.toHaveBeenCalled();
        const [ids, edit] =
            h.canvasController.editCanvasItemsByIds.mock.calls[0];
        expect(ids).toEqual([11, 12, 13]);
        const leader = { id: 11, applyProps: vi.fn() };
        const follower = { id: 13, applyProps: vi.fn() };
        edit(leader);
        edit(follower);
        // The dragged box takes its full measured geometry; the others only
        // move.
        expect(leader.applyProps).toHaveBeenCalledWith(h.info);
        expect(follower.applyProps).toHaveBeenCalledWith({ left: 7, top: 8 });
    });

    test('a drag the engine cannot measure commits nothing', async () => {
        h.info = null;
        await render();
        await act(async () =>
            controller().onDone([{ id: 12, left: 5, top: 6 }]),
        );

        expect(h.canvasController.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.canvasController.editCanvasItemsByIds).not.toHaveBeenCalled();
    });

    test('only the unlocked boxes of the selection travel with a drag', async () => {
        h.selectedItems = [
            h.canvasItem,
            { id: 12, isLocked: false },
            { id: 13, isLocked: true },
            { id: 14, isLocked: false },
        ];
        await render();

        expect(controller().getMoveGroupIds()).toEqual([11, 12, 14]);
    });

    test('deselecting and unmounting release the engine', async () => {
        await render();
        const engine = controller();
        expect(engine.release).not.toHaveBeenCalled();

        h.isSelected = false;
        await render();
        expect(engine.release).toHaveBeenCalledOnce();
        // Still the same engine: it lives as long as the box does.
        expect(h.controllers).toHaveLength(1);

        h.isSelected = true;
        await render();
        expect(engine.initEvent).toHaveBeenCalledTimes(2);
        await act(async () => root.unmount());
        root = createRoot(container);
        expect(engine.release).toHaveBeenCalledTimes(2);
    });

    test('a locked box gets no drag engine', async () => {
        h.props = { ...h.props, locked: true };
        h.canvasItem = { ...h.canvasItem, isLocked: true };
        await render();

        expect(controller().initEvent).not.toHaveBeenCalled();
    });

    test('a click inside a box being text-edited keeps the focus where it is', async () => {
        h.isSelected = false;
        h.isEditing = true;
        h.canvasItem = { ...h.canvasItem, type: 'text' };
        h.props = { ...h.props, type: 'text' };
        await render();
        expect(
            container.querySelector('[data-text-edit-probe]'),
        ).not.toBeNull();

        await act(async () => {
            container
                .querySelector('.app-box-editor')!
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(h.setSelected).not.toHaveBeenCalled();
        expect(h.canvasController.focusEditor).not.toHaveBeenCalled();
    });
});
