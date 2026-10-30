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

vi.mock('./SlideEditorToolsColorComp', () => ({
    default: ({
        label,
        color,
        handleColorChanging,
    }: {
        label: string;
        color: string;
        handleColorChanging: (color: string) => void;
    }) => (
        <button
            data-color={color}
            aria-label={label}
            onClick={() => handleColorChanging('#ff0000')}
        >
            color
        </button>
    ),
}));

vi.mock('./ToolsTextFontControlComp', () => ({
    default: () => <div data-font-controls="" />,
}));

vi.mock('./SlideEditorToolsTextContentComp', () => ({
    default: () => <div data-text-content="" />,
}));

import SlideEditorToolsTextComp from './SlideEditorToolsTextComp';

let container: HTMLDivElement;
let root: Root;

async function render(props: {
    isAlignmentEnabled?: boolean;
    isTextContentEnabled?: boolean;
}) {
    await act(async () => root.render(<SlideEditorToolsTextComp {...props} />));
}

function sections() {
    return Array.from(container.querySelectorAll('section')).map(
        (section) => section.dataset.title,
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setProps.mockReset();
    h.props = {
        color: '#ffffff',
        textHorizontalAlignment: 'left',
        textVerticalAlignment: 'center',
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

describe('SlideEditorToolsTextComp', () => {
    test('shows colour, alignment, font and text content by default', async () => {
        await render({});

        expect(sections()).toEqual(['Color', 'Text Alignment']);
        expect(container.querySelector('[data-font-controls]')).not.toBeNull();
        expect(container.querySelector('[data-text-content]')).not.toBeNull();
        const colorButton =
            container.querySelector<HTMLElement>('[data-color]')!;
        expect(colorButton.dataset.color).toBe('#ffffff');
        expect(colorButton.getAttribute('aria-label')).toBe('Text Color');
    });

    test('a picked colour becomes the text colour', async () => {
        await render({});

        await act(async () =>
            container.querySelector<HTMLButtonElement>('[data-color]')!.click(),
        );
        expect(h.setProps).toHaveBeenCalledWith({ color: '#ff0000' });
    });

    test('marks the current text alignment', async () => {
        await render({});

        const disabled = Array.from(
            container.querySelectorAll<HTMLButtonElement>('button[disabled]'),
        ).map((button) => button.getAttribute('aria-label'));
        expect(disabled).toEqual(['Text align middle', 'Text align left']);
    });

    test('changing one direction keeps the other', async () => {
        await render({});

        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    'button[aria-label="Text align right"]',
                )!
                .click(),
        );
        expect(h.setProps).toHaveBeenLastCalledWith({
            textHorizontalAlignment: 'right',
            textVerticalAlignment: 'center',
        });

        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    'button[aria-label="Text align top"]',
                )!
                .click(),
        );
        expect(h.setProps).toHaveBeenLastCalledWith({
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'start',
        });
    });

    test('can leave out the alignment and the text content', async () => {
        await render({
            isAlignmentEnabled: false,
            isTextContentEnabled: false,
        });

        expect(sections()).toEqual(['Color']);
        expect(container.querySelector('[data-text-content]')).toBeNull();
        expect(container.querySelector('[data-font-controls]')).not.toBeNull();
    });
});
