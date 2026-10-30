// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    setProps: vi.fn(),
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

vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
}));

vi.mock('./SlideEditorToolTitleComp', () => ({
    default: ({ title, children }: { title: string; children: ReactNode }) => (
        <section data-title={title}>{children}</section>
    ),
}));

import SlideEditorToolsTextContentComp from './SlideEditorToolsTextContentComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => root.render(<SlideEditorToolsTextContentComp />));
    return container.querySelector('textarea')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setProps.mockReset();
    h.props = {
        text: 'Amazing grace',
        fontFamily: 'Battambang',
        fontWeight: '700',
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

describe('SlideEditorToolsTextContentComp', () => {
    test('edits the item text in its own font', async () => {
        const textarea = await render();

        expect(container.querySelector('section')?.dataset.title).toBe('Text');
        expect(textarea.value).toBe('Amazing grace');
        expect(textarea.placeholder).toBe('Type the slide text here');
        expect(textarea.style.fontFamily).toBe('Battambang');
        expect(textarea.style.fontWeight).toBe('700');
    });

    test('an item without a font leaves the field font alone', async () => {
        h.props = { text: '', fontFamily: '', fontWeight: '' };
        const textarea = await render();

        expect(textarea.style.fontFamily).toBe('');
        expect(textarea.style.fontWeight).toBe('');
    });

    test('every edit is written to the item', async () => {
        const textarea = await render();
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;

        await act(async () => {
            setValue.call(textarea, 'How sweet the sound');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect(h.setProps).toHaveBeenCalledExactlyOnceWith({
            text: 'How sweet the sound',
        });
    });
});
