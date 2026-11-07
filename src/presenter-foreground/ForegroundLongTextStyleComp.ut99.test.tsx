// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

import type { LongTextColumnStyleType } from '../_screen/screenLongTextTypeHelpers';

// One language's own font and size in Long Text Show. Every change leaves
// through the screen's own reader (`readLongTextColumnStyle`, real here), so
// what reaches `onChange` is exactly what a screen would draw: a key at its
// default is dropped, and a style with nothing left in it is no style at all.

const { state, mocks } = vi.hoisted(() => ({
    state: { dictionaries: [] as Record<string, string>[] },
    mocks: { onChange: vi.fn() },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));
// The real picker asks the system for its fonts.
vi.mock('../others/FontFamilyControlComp', () => ({
    default: ({ fontFamily, setFontFamily, setFontWeight }: any) => (
        <span
            data-font={fontFamily}
            data-has-weight={setFontWeight === undefined ? 'no' : 'yes'}
        >
            <button
                type="button"
                onClick={() => {
                    setFontFamily('Battambang');
                }}
            >
                Pick font
            </button>
            <button
                type="button"
                onClick={() => {
                    setFontFamily('');
                }}
            >
                Pick no font
            </button>
        </span>
    ),
}));

import ForegroundLongTextStyleComp from './ForegroundLongTextStyleComp';

const dictionaries = readLangPackageDictionaries();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.dictionaries = dictionaries;
    mocks.onChange.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

async function render(style: LongTextColumnStyleType | undefined) {
    await act(async () => {
        root.render(
            <ForegroundLongTextStyleComp
                style={style}
                onChange={(newStyle) => {
                    mocks.onChange(newStyle);
                }}
            />,
        );
    });
}

function getButton(name: string) {
    const button =
        container.querySelector<HTMLButtonElement>(
            `button[aria-label="${name}"]`,
        ) ??
        container.querySelector<HTMLButtonElement>(`button[title="${name}"]`) ??
        Array.from(container.querySelectorAll('button')).find((item) => {
            return item.textContent?.trim() === name;
        });
    if (!button) {
        throw new Error(`no button "${name}"`);
    }
    return button;
}

async function press(name: string) {
    await act(async () => {
        getButton(name).click();
    });
}

function getSizeBox() {
    return container.querySelector<HTMLInputElement>(
        'input[aria-label="Text Size (%)"]',
    )!;
}

async function typeSize(value: string) {
    const box = getSizeBox();
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function getRow(label: string) {
    return Array.from(container.querySelectorAll('.fg-prop')).find((row) => {
        return row.querySelector('.fg-prop-name')?.textContent === label;
    });
}

describe('a Long Text language font and size', () => {
    test('a language with no font or size of its own is quiet and follows the screen', async () => {
        await render(undefined);
        for (const label of ['Font', 'Text Size (%)']) {
            expect(getRow(label)!.classList.contains('fg-prop-engaged')).toBe(
                false,
            );
        }
        // Colour and alignment are Bible/LongText Properties' alone now.
        expect(getRow('Text Color')).toBeUndefined();
        expect(getRow('Text Align')).toBeUndefined();
        expect(getSizeBox().value).toBe('100');
        expect(mocks.onChange).not.toHaveBeenCalled();
    });

    test('a family is the language own, without a weight, and `--` gives the screen its own back', async () => {
        await render({ fontFamily: 'Arial', fontSizeScale: 0.8 });
        const font = container.querySelector('[data-font]')!;
        expect(font.getAttribute('data-font')).toBe('Arial');
        expect(font.getAttribute('data-has-weight')).toBe('no');
        expect(getRow('Font')!.classList.contains('fg-prop-engaged')).toBe(
            true,
        );
        await press('Pick font');
        expect(mocks.onChange).toHaveBeenLastCalledWith({
            fontFamily: 'Battambang',
            fontSizeScale: 0.8,
        });
        await press('Pick no font');
        expect(mocks.onChange).toHaveBeenLastCalledWith({
            fontSizeScale: 0.8,
        });
    });

    test('a size is set by a preset or typed, and only a real size is applied', async () => {
        await render({ fontSizeScale: 1.2 });
        expect(getSizeBox().value).toBe('120');
        expect(
            getButton('Text Size (%): 120').getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            getRow('Text Size (%)')!.classList.contains('fg-prop-engaged'),
        ).toBe(true);

        await press('Text Size (%): 60');
        expect(mocks.onChange).toHaveBeenLastCalledWith({ fontSizeScale: 0.6 });
        // 100% IS the default, so it leaves the key out.
        await press('Text Size (%): 100');
        expect(mocks.onChange).toHaveBeenLastCalledWith(undefined);

        mocks.onChange.mockClear();
        // `8` on the way to `80` is not a size yet and is not clamped to 50.
        await typeSize('8');
        expect(getSizeBox().value).toBe('8');
        expect(mocks.onChange).not.toHaveBeenCalled();
        await typeSize('80');
        expect(mocks.onChange).toHaveBeenLastCalledWith({ fontSizeScale: 0.8 });
        await typeSize('250');
        expect(mocks.onChange).toHaveBeenCalledTimes(1);
        // Leaving the box shows the size it is on again.
        await act(async () => {
            getSizeBox().dispatchEvent(
                new FocusEvent('focusout', { bubbles: true }),
            );
        });
        expect(getSizeBox().value).toBe('120');

        // A preset also drops whatever was half typed.
        await typeSize('9');
        await press('Text Size (%): 150');
        expect(mocks.onChange).toHaveBeenLastCalledWith({ fontSizeScale: 1.5 });
        expect(getSizeBox().value).toBe('120');
    });
});
