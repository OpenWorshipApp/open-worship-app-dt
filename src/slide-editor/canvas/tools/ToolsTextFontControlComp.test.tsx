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

vi.mock('../../../others/FontSizeControlComp', () => ({
    default: ({
        fontSize,
        setFontSize,
    }: {
        fontSize: number;
        setFontSize: (size: number) => void;
    }) => (
        <button data-font-size={fontSize} onClick={() => setFontSize(48)}>
            size
        </button>
    ),
}));

vi.mock('../../../others/FontFamilyControlComp', () => ({
    default: (props: {
        fontFamily: string;
        fontWeight: string;
        setFontFamily: (family: string) => void;
        setFontWeight: (weight: string) => void;
    }) => (
        <div
            data-font-family={props.fontFamily}
            data-font-weight={props.fontWeight}
        >
            <button onClick={() => props.setFontFamily('Battambang')}>
                family
            </button>
            <button onClick={() => props.setFontWeight('700')}>weight</button>
        </div>
    ),
}));

import ToolsTextFontControlComp from './ToolsTextFontControlComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => root.render(<ToolsTextFontControlComp />));
}

async function click(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (element) => element.textContent === label,
    )!;
    await act(async () => button.click());
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setProps.mockReset();
    h.props = { fontSize: 32, fontFamily: 'Arial', fontWeight: '400' };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('ToolsTextFontControlComp', () => {
    test('hands the item font to the size and family controls', async () => {
        await render();

        expect(container.querySelector('section')?.dataset.title).toBe('Font');
        expect(
            container
                .querySelector('[data-font-size]')
                ?.getAttribute('data-font-size'),
        ).toBe('32');
        const family =
            container.querySelector<HTMLElement>('[data-font-family]')!;
        expect(family.dataset.fontFamily).toBe('Arial');
        expect(family.dataset.fontWeight).toBe('400');
    });

    test('an item with no font family or weight shows them empty', async () => {
        h.props = { fontSize: 20 };
        await render();

        const family =
            container.querySelector<HTMLElement>('[data-font-family]')!;
        expect(family.dataset.fontFamily).toBe('');
        expect(family.dataset.fontWeight).toBe('');
    });

    test('each control writes only its own property', async () => {
        await render();

        await click('size');
        expect(h.setProps).toHaveBeenLastCalledWith({ fontSize: 48 });
        await click('family');
        expect(h.setProps).toHaveBeenLastCalledWith({
            fontFamily: 'Battambang',
        });
        await click('weight');
        expect(h.setProps).toHaveBeenLastCalledWith({ fontWeight: '700' });
        expect(h.setProps).toHaveBeenCalledTimes(3);
    });

    test('writes through the newest setter after a re-render', async () => {
        await render();
        const firstSetter = h.setProps;
        const newerSetter = vi.fn();
        h.setProps = newerSetter;
        await render();

        await click('size');
        expect(newerSetter).toHaveBeenCalledWith({ fontSize: 48 });
        expect(firstSetter).not.toHaveBeenCalled();
        h.setProps = firstSetter;
    });
});
