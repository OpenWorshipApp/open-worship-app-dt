// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../others/AppRangeComp', () => ({
    default: ({
        title,
        value,
        setValue,
    }: {
        title: string;
        value: number;
        setValue: (value: number) => void;
    }) => (
        <button
            type="button"
            data-range={title}
            onClick={() => setValue(value + 0.05)}
        >
            {title}: {value}
        </button>
    ),
}));
vi.mock('../others/FontFamilyControlComp', () => ({
    default: ({ setFontFamily }: { setFontFamily: (font: string) => void }) => (
        <button type="button" onClick={() => setFontFamily('Inter')}>
            Choose font
        </button>
    ),
}));
vi.mock('../others/color/ColorPicker', () => ({
    default: ({
        color,
        onColorChange,
        onNoColor,
    }: {
        color: string;
        onColorChange: (color: string) => void;
        onNoColor?: () => void;
    }) => (
        <div data-picker={color}>
            <button type="button" onClick={() => onColorChange('#000000')}>
                Choose black
            </button>
            <button type="button" onClick={onNoColor}>
                Remove color
            </button>
        </div>
    ),
}));
vi.mock('../presenter-foreground/ForegroundPropRowComp', () => ({
    default: ({
        label,
        children,
    }: {
        label: string;
        children: React.ReactNode;
    }) => <div data-row={label}>{children}</div>,
    PropSwatchComp: ({
        label,
        onToggle,
    }: {
        label: string;
        onToggle: () => void;
    }) => (
        <button type="button" onClick={onToggle}>
            {label} picker
        </button>
    ),
    PropTogglesComp: ({
        items,
    }: {
        items: { label: string; onToggle: () => void }[];
    }) => (
        <div>
            {items.map((item) => (
                <button key={item.label} type="button" onClick={item.onToggle}>
                    {item.label}
                </button>
            ))}
        </div>
    ),
    PropOptionsComp: ({
        options,
        setValue,
    }: {
        options: { label: string; value: string }[];
        setValue: (value: string) => void;
    }) => (
        <div>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    ),
}));

import { toBibleTextStyleView } from '../_screen/bibleTextStyleHelpers';
import BibleTextControlsComp from './BibleTextControlsComp';

describe('BibleTextControlsComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    const applyStyle = vi.fn();

    async function renderPanel(style: Record<string, unknown> = {}) {
        await act(async () => {
            root.render(
                <BibleTextControlsComp
                    view={toBibleTextStyleView(style)}
                    backdrop="dark"
                    applyStyle={applyStyle}
                />,
            );
        });
    }

    async function click(label: string) {
        const button = [...container.querySelectorAll('button')].find((item) =>
            item.textContent?.includes(label),
        );
        if (!button) throw new Error(`Missing button: ${label}`);
        await act(async () => button.click());
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        applyStyle.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.stubGlobal('CSS', { supports: vi.fn(() => true) });
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('emits independent font, size, weight, alignment and spacing patches', async () => {
        await renderPanel();
        await click('Choose font');
        expect(applyStyle).toHaveBeenLastCalledWith({ fontFamily: 'Inter' });
        await click('Font Size:');
        expect(applyStyle).toHaveBeenLastCalledWith({ fontSize: 65.05 });
        await click('Bold');
        expect(applyStyle).toHaveBeenLastCalledWith({ isBold: true });
        await click('Italic');
        expect(applyStyle).toHaveBeenLastCalledWith({ isItalic: true });
        await click('Align center');
        expect(applyStyle).toHaveBeenLastCalledWith({ textAlign: 'center' });
        await click('Line Height:');
        expect(applyStyle).toHaveBeenLastCalledWith({ lineHeight: 1.55 });
        await click('Letter Spacing:');
        expect(applyStyle).toHaveBeenLastCalledWith({ letterSpacing: 0.05 });
    });

    test('choosing dark text crosses to a light backdrop', async () => {
        await renderPanel();
        await click('Text Color picker');
        expect(
            container.querySelector('[aria-label="Text Color"]'),
        ).not.toBeNull();
        await click('Choose black');
        expect(applyStyle).toHaveBeenLastCalledWith(
            expect.objectContaining({ color: '#000000' }),
        );
        expect(applyStyle.mock.lastCall?.[0]).toHaveProperty('textShadow');
        await click('Text Color picker');
        expect(container.querySelector('[aria-label="Text Color"]')).toBeNull();
    });

    test('effect sliders and new colors emit a complete screen effect', async () => {
        await renderPanel();
        await click('Outline:');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { outlineWidth: 0.05 },
        });
        await click('Shadow Blur:');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { shadowBlur: 0.05 },
        });
        await click('Shadow Offset X:');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { shadowX: 0.05 },
        });
        await click('Shadow Offset Y:');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { shadowY: 0.05 },
        });
        await click('Glow:');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { glowSize: 0.05 },
        });
        await click('Outline Color picker');
        await click('Choose black');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { outlineWidth: 0.03, outlineColor: '#000000' },
        });
        await click('Remove color');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { outlineWidth: 0 },
        });
        await click('Shadow Color picker');
        await click('Choose black');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { shadowY: 0.04, shadowBlur: 0.1 },
        });
        await click('Remove color');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { shadowX: 0, shadowY: 0, shadowBlur: 0 },
        });
        await click('Glow Color picker');
        await click('Choose black');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { glowSize: 0.2 },
        });
        await click('Remove color');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            effect: { glowSize: 0 },
        });
    });

    test('accepts valid CSS shadow, rejects unsafe edits, and resets the look', async () => {
        await renderPanel();
        const input = container.querySelector(
            'input[aria-label="Text Shadow"]',
        )!;
        const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        await act(async () => {
            nativeSetter.call(input, '0 0 4px #000000');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () =>
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
        );
        expect(applyStyle).toHaveBeenLastCalledWith({
            textShadow: '0 0 4px #000000',
            effect: undefined,
        });
        const callCount = applyStyle.mock.calls.length;
        vi.mocked(CSS.supports).mockReturnValueOnce(false);
        await act(async () => {
            nativeSetter.call(input, 'invalid shadow');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () =>
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
        );
        expect(applyStyle).toHaveBeenCalledTimes(callCount);
        expect((input as HTMLInputElement).value).toBe('none');
        await click('Reset');
        expect(applyStyle.mock.lastCall?.[0]).toMatchObject({
            textShadow: 'none',
        });
    });
});
