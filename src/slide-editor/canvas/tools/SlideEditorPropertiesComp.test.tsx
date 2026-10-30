// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./CanvasItemPropsEditorComp', () => ({
    default: ({ canvasItem }: { canvasItem: { id: number } }) => (
        <div data-item-editor={canvasItem.id} />
    ),
}));

vi.mock('./SlidePropertyEditorComp', () => ({
    default: () => <div data-slide-properties="" />,
}));

vi.mock('./DocumentFontEditorComp', () => ({
    default: () => <div data-document-font="" />,
}));

import SlideEditorPropertiesComp from './SlideEditorPropertiesComp';

let container: HTMLDivElement;
let root: Root;

async function render(canvasItems: any[]) {
    await act(async () => {
        root.render(<SlideEditorPropertiesComp canvasItems={canvasItems} />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorPropertiesComp', () => {
    test('with nothing selected it keeps the slide panels and asks for a pick', async () => {
        await render([]);

        expect(
            container.querySelector('[data-slide-properties]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-document-font]')).not.toBeNull();
        expect(container.querySelector('h2')?.textContent).toBe(
            'No canvas item selected',
        );
        expect(container.querySelector('h3')?.textContent).toBe(
            'Please select an item to edit',
        );
        expect(container.querySelector('[data-item-editor]')).toBeNull();
    });

    test('shows one property editor per selected item', async () => {
        await render([{ id: 3 }, { id: 8 }]);

        expect(
            Array.from(container.querySelectorAll('[data-item-editor]')).map(
                (element) => element.getAttribute('data-item-editor'),
            ),
        ).toEqual(['3', '8']);
        expect(container.querySelector('h2')).toBeNull();
    });

    test('scrolls sideways rather than cutting labels off', async () => {
        await render([]);
        expect(
            (container.firstElementChild as HTMLElement).style.overflowX,
        ).toBe('auto');
    });
});
