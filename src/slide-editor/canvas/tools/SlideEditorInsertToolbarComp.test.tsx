// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    actions: [] as any[],
    handleError: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => `tr:${text}`,
}));

vi.mock('../../../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));

vi.mock('../canvasInsertActionHelpers', () => ({
    get canvasInsertActionList() {
        return h.actions;
    },
}));

import SlideEditorInsertToolbarComp from './SlideEditorInsertToolbarComp';

let container: HTMLDivElement;
let root: Root;
const canvasController = { name: 'controller' } as any;

async function render() {
    await act(async () => {
        root.render(
            <SlideEditorInsertToolbarComp
                canvasController={canvasController}
            />,
        );
    });
    return Array.from(container.querySelectorAll('button'));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.handleError.mockReset();
    h.actions = [
        {
            key: 'text',
            label: 'Insert Text',
            iconName: 'fonts',
            handle: vi.fn(),
        },
        {
            key: 'image',
            label: 'Insert Image',
            iconName: 'image',
            handle: vi.fn(),
        },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorInsertToolbarComp', () => {
    test('shows one translated button per insert action', async () => {
        const buttons = await render();

        expect(buttons.map((button) => button.textContent)).toEqual([
            'tr:Insert Text',
            'tr:Insert Image',
        ]);
        expect(buttons.map((button) => button.title)).toEqual([
            'tr:Insert Text',
            'tr:Insert Image',
        ]);
        expect(buttons[1].querySelector('i')?.className).toBe('bi bi-image');
    });

    test('a press runs its action on the canvas, with no click position', async () => {
        const buttons = await render();

        await act(async () => buttons[1].click());

        expect(h.actions[1].handle).toHaveBeenCalledExactlyOnceWith(
            canvasController,
        );
        expect(h.actions[0].handle).not.toHaveBeenCalled();
    });

    test('a failing action is reported, not thrown', async () => {
        const error = new Error('no file chosen');
        h.actions[0].handle.mockRejectedValue(error);
        const buttons = await render();

        await act(async () => buttons[0].click());
        await vi.waitFor(() => {
            expect(h.handleError).toHaveBeenCalledWith(error);
        });
    });
});
