// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    backgroundTransfer: false,
    droppedData: null as null | object,
    plan: null as null | object,
    files: [] as { name: string; type: string }[],
    planDrop: vi.fn(),
    applyPlan: vi.fn(),
    extract: vi.fn(),
    toast: vi.fn(),
    menu: vi.fn(),
}));

vi.mock('../canvasContextMenuHelpers', () => ({
    showCanvasContextMenu: state.menu,
}));
vi.mock('../../../toast/toastHelpers', () => ({
    showSimpleToast: state.toast,
}));
vi.mock('../../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../../others/droppingFileHelpers', () => ({
    readDroppedFiles: async function* () {
        for (const file of state.files) yield file;
    },
}));
vi.mock('../canvasHelpers', () => ({
    checkIsSupportCanvasMediaType: (type: string) => type.startsWith('image/'),
}));
vi.mock('../../../helper/dragHelpers', () => ({
    extractDropData: state.extract,
}));
vi.mock('../canvasBackgroundDropHelpers', () => ({
    checkIsCanvasBackgroundDropDataTransfer: () => state.backgroundTransfer,
    planCanvasBackgroundDrop: state.planDrop,
    applyCanvasBackgroundDropPlan: state.applyPlan,
}));

import {
    clampToCanvasPoint,
    dragOverHandling,
    findDroppedCanvasItemId,
    handleDropping,
    openCanvasContextMenu,
    scrollToCenter,
} from './canvasContainerHelpers';

function dragEvent(canvas: HTMLElement, target: EventTarget = canvas) {
    return {
        preventDefault: vi.fn(),
        currentTarget: canvas,
        target,
        clientX: 110,
        clientY: 80,
        dataTransfer: { items: [] as { type: string }[] },
    };
}

beforeEach(() => {
    state.backgroundTransfer = false;
    state.droppedData = null;
    state.plan = null;
    state.files = [];
    state.planDrop.mockReset().mockImplementation(() => state.plan);
    state.applyPlan.mockReset().mockResolvedValue(undefined);
    state.extract.mockReset().mockImplementation(() => state.droppedData);
    state.toast.mockReset();
    state.menu.mockReset();
});

describe('canvas drop and viewport helpers', () => {
    it('dims only supported drags, including internal background drags', () => {
        const canvas = document.createElement('div');
        const event = dragEvent(canvas);
        dragOverHandling(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(canvas.style.opacity).toBe('');

        event.dataTransfer.items = [{ type: 'image/png' }];
        dragOverHandling(event);
        expect(canvas.style.opacity).toBe('0.5');
        canvas.style.opacity = '1';
        event.dataTransfer.items = [
            { type: 'image/png' },
            { type: 'text/plain' },
        ];
        dragOverHandling(event);
        expect(canvas.style.opacity).toBe('1');

        state.backgroundTransfer = true;
        dragOverHandling(event);
        expect(canvas.style.opacity).toBe('0.5');
    });

    it('finds the closest box id and rejects bare or invalid targets', () => {
        const canvas = document.createElement('div');
        const box = document.createElement('div');
        box.dataset.appBoxEditorId = '42';
        const child = document.createElement('span');
        box.append(child);
        canvas.append(box);
        expect(findDroppedCanvasItemId(dragEvent(canvas, child) as never)).toBe(
            42,
        );
        expect(findDroppedCanvasItemId(dragEvent(canvas) as never)).toBeNull();
        box.dataset.appBoxEditorId = 'bad';
        expect(
            findDroppedCanvasItemId(dragEvent(canvas, child) as never),
        ).toBeNull();
    });

    it('applies an internal background plan against the canvas position', async () => {
        const canvas = document.createElement('div');
        canvas.style.opacity = '0.5';
        const box = document.createElement('div');
        box.dataset.appBoxEditorId = '7';
        canvas.append(box);
        const event = dragEvent(canvas, box);
        state.droppedData = { kind: 'background' };
        state.plan = { kind: 'apply-color' };
        state.files = [{ name: 'ignored.png', type: 'image/png' }];
        const controller = { genNewMediaItemFromFile: vi.fn() };

        await handleDropping(controller as never, event as never);
        expect(canvas.style.opacity).toBe('1');
        expect(state.planDrop).toHaveBeenCalledWith(state.droppedData);
        expect(state.applyPlan).toHaveBeenCalledWith(
            controller,
            state.plan,
            { clientX: 110, clientY: 80, target: canvas },
            7,
        );
        expect(controller.genNewMediaItemFromFile).not.toHaveBeenCalled();
    });

    it('adds supported dropped files and reports unsupported media', async () => {
        const canvas = document.createElement('div');
        const event = dragEvent(canvas);
        state.files = [
            { name: 'one.png', type: 'image/png' },
            { name: 'text.txt', type: 'text/plain' },
            { name: 'failed.png', type: 'image/png' },
        ];
        const controller = {
            genNewMediaItemFromFile: vi
                .fn()
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce(null),
            addNewItems: vi.fn(),
        };
        await handleDropping(controller as never, event as never);
        expect(controller.genNewMediaItemFromFile).toHaveBeenCalledWith(
            state.files[0],
            { clientX: 110, clientY: 80, target: canvas },
        );
        expect(controller.addNewItems).toHaveBeenCalledOnce();
        expect(controller.addNewItems).toHaveBeenCalledWith([{ id: 1 }]);
        expect(state.toast).toHaveBeenCalledWith(
            'Insert Image, Video or Audio',
            'Unsupported file type!',
        );
    });

    it('focuses before opening a context menu and clamps canvas geometry', async () => {
        const target = document.createElement('div');
        const focus = vi.spyOn(target, 'focus');
        const stopAllModes = vi.fn();
        const event = { target };
        await openCanvasContextMenu({} as never, event, stopAllModes);
        expect(focus).toHaveBeenCalledOnce();
        expect(stopAllModes).toHaveBeenCalledOnce();
        expect(state.menu).toHaveBeenCalledWith(event, {});

        expect(
            clampToCanvasPoint(110, 80, { left: 10, top: 20 }, 2, 40, 20),
        ).toEqual({
            x: 40,
            y: 20,
        });
        expect(
            clampToCanvasPoint(-10, -20, { left: 10, top: 20 }, 2, 40, 20),
        ).toEqual({
            x: 0,
            y: 0,
        });
        const parent = document.createElement('div');
        Object.defineProperties(parent, {
            clientWidth: { value: 100 },
            clientHeight: { value: 200 },
        });
        scrollToCenter(parent, 80, 60);
        expect(parent.scrollLeft).toBe(150);
        expect(parent.scrollTop).toBe(50);
    });
});
