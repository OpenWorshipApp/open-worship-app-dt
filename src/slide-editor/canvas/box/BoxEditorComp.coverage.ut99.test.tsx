// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeBoxControllerType = {
    scaleFactor: number;
    lockAspectRatio: boolean;
    getMoveGroupIds: () => number[];
    getSnapTargets: unknown;
    onSnapping: unknown;
    info: unknown;
    initCalls: [HTMLElement, HTMLElement, (moves: any[]) => Promise<void>][];
    releaseCount: number;
};

const h = vi.hoisted(() => ({
    controllers: [] as FakeBoxControllerType[],
    canvasController: null as any,
    canvasItem: null as any,
    props: null as any,
    isSelected: false,
    editing: null as any,
    selected: [] as any[],
    setSelected: null as any,
    setEditing: null as any,
    snap: {
        getSnapTargets: () => ({ vertical: [], horizontal: [] }),
        setSnapLines: () => {},
    },
}));

vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));
vi.mock('../../BoxEditorController', () => ({
    default: class FakeBoxEditorController {
        scaleFactor: number;
        lockAspectRatio = false;
        getMoveGroupIds: () => number[] = () => [];
        getSnapTargets: unknown = null;
        onSnapping: unknown = null;
        info: unknown = null;
        initCalls: any[] = [];
        releaseCount = 0;
        rotatorCN = 'rotate';
        resizeActorList = { 'left-top': {}, 'right-bottom': {} };
        constructor(scaleFactor: number) {
            this.scaleFactor = scaleFactor;
            h.controllers.push(this as any);
        }
        initEvent(wrapper: HTMLElement, chrome: HTMLElement, onDone: any) {
            this.initCalls.push([wrapper, chrome, onDone]);
        }
        getInfo() {
            return this.info;
        }
        release() {
            this.releaseCount++;
        }
    },
}));
vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => h.canvasController,
}));
vi.mock('../canvasEventHelpers', () => ({
    useSlideCanvasScale: () => 0.5,
}));
vi.mock('../canvasSnapGuideHelpers', () => ({
    useCanvasSnapContext: () => h.snap,
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
    useEditingCanvasItemAndSetterContext: () => ({ canvasItem: h.editing }),
    useSelectedCanvasItemsAndSetterContext: () => ({
        canvasItems: h.selected,
    }),
    useSetEditingCanvasItem: () => h.setEditing,
    useSetSelectedCanvasItems: () => h.setSelected,
}));
vi.mock('./BoxEditorCanvasItemRenderComp', () => ({
    default: function ContentProbeComp() {
        return <i className="content" />;
    },
}));
vi.mock('./BoxEditorNormalTextEditModeComp', () => ({
    default: function TextEditProbeComp() {
        return <textarea className="text-edit" />;
    },
}));
vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    genErrorContextMenuHandler: () => () => {},
}));

import { BoxEditorComp } from './BoxEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function genItem(id: number, isLocked = false, type = 'image') {
    return {
        id,
        uuid: `uuid-${id}`,
        type,
        isLocked,
        shouldLockAspectRatio: true,
    };
}

async function render() {
    await act(async () => {
        root.render(<BoxEditorComp />);
    });
}

function onlyController() {
    expect(h.controllers).toHaveLength(1);
    return h.controllers[0];
}

beforeEach(() => {
    h.controllers.length = 0;
    h.canvasController = {
        editCanvasItemById: vi.fn(),
        editCanvasItemsByIds: vi.fn(),
        genHandleContextMenuOpening: () => () => {},
        focusEditor: vi.fn(),
    };
    h.canvasItem = genItem(1);
    h.props = { id: 1, top: 10, left: 20, width: 100, height: 50, rotate: 0 };
    h.isSelected = true;
    h.editing = null;
    h.selected = [h.canvasItem];
    h.setSelected = vi.fn();
    h.setEditing = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('BoxEditorComp drag engine wiring', () => {
    it('drives the selected box and moves only the unlocked members with it', async () => {
        h.selected = [h.canvasItem, genItem(2, true), genItem(3)];
        await render();
        const controller = onlyController();
        expect(controller.scaleFactor).toBe(0.5);
        expect(controller.lockAspectRatio).toBe(true);
        expect(controller.getSnapTargets).toBe(h.snap.getSnapTargets);
        expect(controller.onSnapping).toBe(h.snap.setSnapLines);
        expect(controller.getMoveGroupIds()).toEqual([1, 3]);
        expect(controller.initCalls).toHaveLength(1);
        const [wrapper, chrome] = controller.initCalls[0];
        expect(wrapper.className).toBe(
            'editor-controller-box-wrapper controlling',
        );
        expect(chrome.className).toBe('editor-controller-box-chrome');
    });

    it('commits nothing when the drag left no box info', async () => {
        await render();
        const controller = onlyController();
        controller.info = null;
        await controller.initCalls[0][2]([]);
        expect(h.canvasController.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.canvasController.editCanvasItemsByIds).not.toHaveBeenCalled();
    });

    it('commits a single box drag as one edit of that box', async () => {
        await render();
        const controller = onlyController();
        controller.info = { top: 40, left: 60, width: 100, height: 50 };
        await controller.initCalls[0][2]([]);
        expect(h.canvasController.editCanvasItemById).toHaveBeenCalledTimes(1);
        const [id, edit] = h.canvasController.editCanvasItemById.mock.calls[0];
        expect(id).toBe(1);
        const latest = { id: 1, applyProps: vi.fn() };
        edit(latest);
        expect(latest.applyProps).toHaveBeenCalledWith(controller.info);
        expect(h.canvasController.editCanvasItemsByIds).not.toHaveBeenCalled();
    });

    it('commits a group drag as one edit over every moved box', async () => {
        await render();
        const controller = onlyController();
        controller.info = { top: 40, left: 60 };
        await controller.initCalls[0][2]([
            { id: 3, top: 5, left: 6 },
            { id: 4, top: 7, left: 8 },
        ]);
        expect(h.canvasController.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.canvasController.editCanvasItemsByIds).toHaveBeenCalledTimes(
            1,
        );
        const [ids, edit] =
            h.canvasController.editCanvasItemsByIds.mock.calls[0];
        expect(ids).toEqual([1, 3, 4]);
        const dragged = { id: 1, applyProps: vi.fn() };
        const follower = { id: 4, applyProps: vi.fn() };
        edit(dragged);
        edit(follower);
        expect(dragged.applyProps).toHaveBeenCalledWith({ top: 40, left: 60 });
        expect(follower.applyProps).toHaveBeenCalledWith({ top: 7, left: 8 });
    });

    it('stops the engine when the box is deselected', async () => {
        await render();
        const controller = onlyController();
        expect(controller.releaseCount).toBe(0);
        h.isSelected = false;
        h.selected = [];
        await render();
        expect(controller.releaseCount).toBe(1);
        // a deselected box is not driven again
        expect(controller.initCalls).toHaveLength(1);
    });

    it('leaves the focus in the textarea when the box being typed in is clicked', async () => {
        h.canvasItem = genItem(1, false, 'text');
        h.editing = h.canvasItem;
        h.isSelected = false;
        h.selected = [];
        await render();
        expect(container.querySelector('.text-edit')).not.toBe(null);
        const box = container.querySelector('[data-app-box-editor-id="1"]')!;
        expect(box.className).toBe(
            'app-box-editor shadow-caught-hover-pointer editable',
        );
        await act(async () => {
            box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(h.canvasController.focusEditor).not.toHaveBeenCalled();
        expect(h.setSelected).not.toHaveBeenCalled();
    });
});
