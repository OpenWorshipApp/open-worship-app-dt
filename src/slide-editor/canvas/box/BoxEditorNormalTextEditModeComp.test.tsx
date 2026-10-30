// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    canvasController: null as any,
    canvasItem: null as any,
    props: null as any,
    editCanvasItemById: vi.fn(),
    setEditing: vi.fn(),
    setSelected: vi.fn(),
    outerContextMenu: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => h.canvasController,
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemContext: () => h.canvasItem,
    useCanvasItemPropsContext: () => h.props,
    useSetEditingCanvasItem: () => h.setEditing,
    useSetSelectedCanvasItems: () => h.setSelected,
}));

vi.mock('../CanvasItemText', () => ({
    default: { genStyle: () => ({}) },
}));

vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: () => false,
    isSupportedMimetype: () => false,
}));

import BoxEditorNormalTextEditModeComp from './BoxEditorNormalTextEditModeComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(
            // Stands in for the box shell: its context menu must not open
            // while a draft is being edited.
            <div onContextMenu={h.outerContextMenu}>
                <BoxEditorNormalTextEditModeComp />
            </div>,
        );
    });
    return container.querySelector('textarea')!;
}

async function type(textarea: HTMLTextAreaElement, text: string) {
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setValue.call(textarea, text);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function keyUp(target: Element, init: KeyboardEventInit) {
    await act(async () => {
        target.dispatchEvent(
            new KeyboardEvent('keyup', { bubbles: true, ...init }),
        );
    });
}

// Runs the edit the component handed to the controller against a stand-in for
// the controller's latest copy of the item, and returns what it applied.
function runCommittedEdit() {
    expect(h.editCanvasItemById).toHaveBeenCalledOnce();
    const [id, edit] = h.editCanvasItemById.mock.calls[0];
    const latestCanvasItem = { applyProps: vi.fn() };
    edit(latestCanvasItem);
    return { id, applied: latestCanvasItem.applyProps.mock.calls };
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.editCanvasItemById.mockReset();
    h.setEditing.mockReset();
    h.setSelected.mockReset();
    h.outerContextMenu.mockReset();
    h.canvasController = { editCanvasItemById: h.editCanvasItemById };
    h.canvasItem = { id: 21, type: 'text' };
    h.props = {
        id: 21,
        type: 'text',
        text: 'Old text',
        fontSize: 30,
        height: 120,
        textHorizontalAlignment: 'left',
        textVerticalAlignment: 'start',
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

describe('BoxEditorNormalTextEditModeComp', () => {
    test('starts from the item text and commits a changed draft on blur', async () => {
        const textarea = await render();
        expect(textarea.value).toBe('Old text');

        await type(textarea, 'New text');
        expect(textarea.value).toBe('New text');
        // Typing alone writes nothing: the draft is local until the edit ends.
        expect(h.editCanvasItemById).not.toHaveBeenCalled();

        await act(async () => textarea.blur());

        const { id, applied } = runCommittedEdit();
        expect(id).toBe(21);
        expect(applied).toEqual([[{ text: 'New text' }]]);
        // Committing leaves the box selected, not editing, so its properties
        // panel stays open.
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
        expect(h.setEditing).not.toHaveBeenCalled();
    });

    test('an unchanged draft selects the box without writing anything', async () => {
        const textarea = await render();

        await act(async () => textarea.blur());

        expect(h.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
    });

    test('Escape drops the draft and leaves edit mode, and its blur commits nothing', async () => {
        const textarea = await render();
        await type(textarea, 'Throw away');

        await keyUp(textarea, { key: 'Escape' });
        expect(h.setEditing).toHaveBeenCalledWith(h.canvasItem, false);

        // Leaving edit mode blurs the textarea: that blur must not commit the
        // draft the operator just cancelled.
        await act(async () => textarea.blur());
        expect(h.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.setSelected).not.toHaveBeenCalled();

        // The cancel swallows exactly one blur.
        await act(async () => textarea.focus());
        await act(async () => textarea.blur());
        expect(runCommittedEdit().applied).toEqual([[{ text: 'Throw away' }]]);
    });

    test('Ctrl+Enter commits while a plain Enter keeps typing', async () => {
        const textarea = await render();
        await type(textarea, 'Line one\nLine two');

        await keyUp(textarea, { key: 'Enter' });
        expect(h.editCanvasItemById).not.toHaveBeenCalled();
        expect(h.setSelected).not.toHaveBeenCalled();

        await keyUp(textarea, { key: 'Enter', ctrlKey: true });
        expect(runCommittedEdit().applied).toEqual([
            [{ text: 'Line one\nLine two' }],
        ]);
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
    });

    test('a right-click commits the draft instead of opening the box menu', async () => {
        const textarea = await render();
        await type(textarea, 'Right clicked');

        await act(async () => {
            textarea.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(runCommittedEdit().applied).toEqual([
            [{ text: 'Right clicked' }],
        ]);
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
        expect(h.outerContextMenu).not.toHaveBeenCalled();
    });

    test('commits through the newest controller and item after a re-render', async () => {
        const textarea = await render();
        await type(textarea, 'Edited');
        const newerEdit = vi.fn();
        h.canvasController = { editCanvasItemById: newerEdit };
        h.canvasItem = { id: 22, type: 'text' };
        await render();

        await act(async () => textarea.blur());

        expect(h.editCanvasItemById).not.toHaveBeenCalled();
        expect(newerEdit).toHaveBeenCalledWith(22, expect.any(Function));
        expect(h.setSelected).toHaveBeenCalledWith(h.canvasItem);
    });
});
