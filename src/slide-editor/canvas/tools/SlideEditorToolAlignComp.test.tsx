// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    type Mock,
    test,
    vi,
} from 'vitest';

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

import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';

let container: HTMLDivElement;
let root: Root;
let onData: Mock<(data: any) => void>;

async function render(props: { data?: any; isText?: boolean }) {
    await act(async () => {
        root.render(<SlideEditorToolAlignComp onData={onData} {...props} />);
    });
}

function button(label: string) {
    return container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    )!;
}

function groupLabels() {
    return Array.from(container.querySelectorAll('[role="group"]')).map(
        (group) => [
            group.getAttribute('aria-label'),
            Array.from(group.querySelectorAll('button')).map((element) =>
                element.getAttribute('aria-label'),
            ),
        ],
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onData = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorToolAlignComp', () => {
    test('offers box alignment in two named groups', async () => {
        await render({});

        expect(groupLabels()).toEqual([
            [
                'Vertical alignment',
                ['Align top', 'Align middle', 'Align bottom'],
            ],
            [
                'Horizontal alignment',
                ['Align left', 'Align center', 'Align right'],
            ],
        ]);
        expect(button('Align top').title).toBe('Align top');
        expect(button('Align center').querySelector('i')?.className).toBe(
            'bi bi-align-center',
        );
    });

    test('names the text alignment buttons apart from the box ones', async () => {
        await render({ isText: true });

        expect(groupLabels()).toEqual([
            [
                'Vertical alignment',
                ['Text align top', 'Text align middle', 'Text align bottom'],
            ],
            [
                'Horizontal alignment',
                ['Text align left', 'Text align center', 'Text align right'],
            ],
        ]);
        expect(button('Text align left').querySelector('i')?.className).toBe(
            'bi bi-text-left',
        );
    });

    test('marks the current alignment and cannot re-pick it', async () => {
        await render({
            data: { verticalAlignment: 'center', horizontalAlignment: 'right' },
        });

        const middle = button('Align middle');
        expect(middle.disabled).toBe(true);
        expect(middle.className).toBe('btn btn-sm btn-info');
        expect(button('Align top').disabled).toBe(false);
        expect(button('Align top').className).toBe(
            'btn btn-sm btn-outline-info',
        );
        expect(button('Align right').disabled).toBe(true);
    });

    test('reports the picked alignment under its own key', async () => {
        await render({ isText: true, data: {} });

        await act(async () => button('Text align bottom').click());
        expect(onData).toHaveBeenLastCalledWith({ verticalAlignment: 'end' });

        await act(async () => button('Text align center').click());
        expect(onData).toHaveBeenLastCalledWith({
            horizontalAlignment: 'center',
        });
    });

    test('reports to the newest handler after a re-render', async () => {
        await render({});
        const firstHandler = onData;
        onData = vi.fn();
        await render({});

        await act(async () => button('Align left').click());
        expect(onData).toHaveBeenCalledWith({ horizontalAlignment: 'left' });
        expect(firstHandler).not.toHaveBeenCalled();
    });
});
