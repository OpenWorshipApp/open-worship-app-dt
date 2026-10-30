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

const { genStyleMock } = vi.hoisted(() => ({
    genStyleMock: vi.fn(),
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

// The real `CanvasItemText` reaches `CanvasItem` and the whole event/progress
// stack; this suite is about the textarea, so only its style hook is stubbed.
vi.mock('../CanvasItemText', () => ({
    default: { genStyle: genStyleMock },
}));

// `canvasHelpers` is kept real for its line-height constant; only the file
// helpers it imports for media checks are cut off here.
vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: () => false,
    isSupportedMimetype: () => false,
}));

import BoxEditorTextAreaComp from './BoxEditorTextAreaComp';
import { SCRIPT_SAFE_LINE_HEIGHT } from '../canvasHelpers';

function textProps(overrides: Record<string, unknown> = {}) {
    return {
        id: 4,
        type: 'text',
        text: 'First\nSecond',
        fontSize: 20,
        height: 100,
        width: 300,
        textHorizontalAlignment: 'center',
        textVerticalAlignment: 'start',
        color: '#ffffff',
        ...overrides,
    } as any;
}

let container: HTMLDivElement;
let root: Root;
let onTextChange: Mock<(newText: string) => void>;
let onBlur: Mock<() => void>;

async function render(props = textProps(), text = props.text) {
    await act(async () => {
        root.render(
            <BoxEditorTextAreaComp
                props={props}
                text={text}
                onTextChange={onTextChange}
                onBlur={onBlur}
            />,
        );
    });
    return container.querySelector('textarea')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    genStyleMock.mockImplementation((props: any) => ({
        fontSize: `${props.fontSize}px`,
        color: props.color,
    }));
    onTextChange = vi.fn();
    onBlur = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BoxEditorTextAreaComp', () => {
    test('draws the draft with the item text style and a transparent, borderless box', async () => {
        const props = textProps();
        const textarea = await render(props, 'Draft text');

        expect(textarea.value).toBe('Draft text');
        expect(textarea.getAttribute('aria-label')).toBe('Text');
        expect(genStyleMock).toHaveBeenCalledWith(props);
        expect(textarea.style.fontSize).toBe('20px');
        expect(textarea.style.textAlign).toBe('center');
        expect(textarea.style.resize).toBe('none');
        expect(textarea.style.background).toContain('transparent');
        expect(textarea.style.boxSizing).toBe('border-box');
        // The base padding is a tenth of the font size on every side.
        expect(textarea.style.paddingLeft).toBe('2px');
        expect(textarea.style.paddingRight).toBe('2px');
        expect(textarea.style.paddingBottom).toBe('2px');
    });

    test.each([
        ['start', 0],
        ['center', 0.5],
        ['end', 1],
    ])(
        'pushes the text down for a %s vertical alignment',
        async (alignment, share) => {
            const fontSize = 20;
            const height = 100;
            const textarea = await render(
                textProps({ textVerticalAlignment: alignment }),
            );
            const basePadding = fontSize / 10;
            const textHeight = fontSize * SCRIPT_SAFE_LINE_HEIGHT * 2;
            const extra = height - basePadding * 2 - textHeight;
            expect(Number.parseFloat(textarea.style.paddingTop)).toBeCloseTo(
                basePadding + extra * share,
            );
        },
    );

    test('never pads overflowing text above the base padding', async () => {
        const textarea = await render(
            textProps({
                textVerticalAlignment: 'end',
                text: Array.from({ length: 10 }, () => 'line').join('\n'),
            }),
        );
        expect(textarea.style.paddingTop).toBe('2px');
    });

    test('puts the caret after the existing text when it takes focus', async () => {
        const textarea = await render(textProps(), 'Hello world');

        // `autoFocus`: the box opens ready for typing at the end of its text.
        expect(document.activeElement).toBe(textarea);
        expect(textarea.selectionStart).toBe('Hello world'.length);
        expect(textarea.selectionEnd).toBe('Hello world'.length);
    });

    test('reports every edit and the blur to its owner', async () => {
        const textarea = await render();
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;

        await act(async () => {
            setValue.call(textarea, 'Typed');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(onTextChange).toHaveBeenCalledWith('Typed');

        await act(async () => textarea.blur());
        expect(onBlur).toHaveBeenCalledOnce();
    });

    test('routes edits to the newest change handler after a re-render', async () => {
        const textarea = await render();
        const firstHandler = onTextChange;
        onTextChange = vi.fn();
        await render();
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;

        await act(async () => {
            setValue.call(textarea, 'Later');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(onTextChange).toHaveBeenCalledWith('Later');
        expect(firstHandler).not.toHaveBeenCalled();
    });
});
