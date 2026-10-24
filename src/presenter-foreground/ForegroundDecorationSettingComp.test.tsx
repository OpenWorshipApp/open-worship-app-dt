// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    saved: null as string | null,
    setSetting: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: () => h.saved,
        setSetting: h.setSetting,
        useStateSettingBoolean: (_name: string, initial: boolean) =>
            useState(initial),
    };
});
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
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
        <button type="button" onClick={() => setValue(value + 0.1)}>
            {title} range
        </button>
    ),
}));
vi.mock('../others/color/ColorPicker', () => ({
    default: ({
        onColorChange,
        onNoColor,
    }: {
        onColorChange: (color: string) => void;
        onNoColor: () => void;
    }) => (
        <div>
            <button type="button" onClick={() => onColorChange('#123456')}>
                Choose color
            </button>
            <button type="button" onClick={onNoColor}>
                Default color
            </button>
        </div>
    ),
}));
vi.mock('./ForegroundPropRowComp', () => ({
    default: ({
        label,
        children,
    }: {
        label: string;
        children: React.ReactNode;
    }) => <div data-row={label}>{children}</div>,
    PropOptionsComp: ({
        label,
        options,
        setValue,
    }: {
        label: string;
        options: { value: string }[];
        setValue: (value: string) => void;
    }) => (
        <div>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue(option.value)}
                >
                    {label}:{option.value}
                </button>
            ))}
        </div>
    ),
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
}));

import DecorationControlsComp from './ForegroundDecorationSettingComp';

describe('DecorationControlsComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    const onChange = vi.fn();

    async function renderPanel(isText = true, isLeadingEngaged = false) {
        await act(async () =>
            root.render(
                <DecorationControlsComp
                    prefix="message"
                    isText={isText}
                    onChange={onChange}
                    isLeadingEngaged={isLeadingEngaged}
                    leadingRows={<span>Corner radius</span>}
                />,
            ),
        );
    }

    async function click(label: string) {
        const button = [...container.querySelectorAll('button')].find((item) =>
            item.textContent?.includes(label),
        );
        if (!button) throw new Error(`Missing button: ${label}`);
        await act(async () => button.click());
    }

    function savedDecoration() {
        expect(h.setSetting).toHaveBeenCalledWith(
            'message-setting-show-widget-decoration',
            expect.any(String),
        );
        return JSON.parse(h.setSetting.mock.lastCall![1]) as Record<
            string,
            unknown
        >;
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.saved = null;
        h.setSetting.mockClear();
        onChange.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('fold stays closed until opened and reflects an engaged leading row', async () => {
        await renderPanel(true, true);
        const toggle =
            container.querySelector<HTMLButtonElement>('.fg-deco-toggle')!;
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.className).toContain('fg-deco-toggle-engaged');
        expect(container.textContent).not.toContain('Corner radius');
        await click('Effects');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(container.textContent).toContain('Corner radius');
        await click('Effects');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    test('persists frame style, bounded width, and color in one setting', async () => {
        await renderPanel();
        await click('Effects');
        await click('Border:solid');
        expect(savedDecoration()).toMatchObject({ borderStyle: 'solid' });
        expect(onChange).toHaveBeenCalledTimes(1);
        const width = container.querySelector<HTMLInputElement>(
            'input[aria-label="Border Width"]',
        )!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!.call(width, '500');
            width.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(savedDecoration()).toMatchObject({ borderWidth: 40 });
        await click('Border Color picker');
        await click('Choose color');
        expect(savedDecoration()).toMatchObject({ borderColor: '#123456' });
        await click('Default color');
        expect(savedDecoration()).toMatchObject({ borderColor: '#FFFFFF' });
    });

    test('changes text-only layout and style while keeping prior edits', async () => {
        await renderPanel();
        await click('Effects');
        await click('Padding range');
        expect(savedDecoration()).toMatchObject({ padding: 0.35 });
        await click('Text Align:center');
        expect(savedDecoration()).toMatchObject({
            textAlign: 'center',
            padding: 0.35,
        });
        await click('Line Height range');
        expect(savedDecoration()).toMatchObject({ lineHeight: 0.1 });
        await click('Letter Spacing range');
        expect(savedDecoration()).toMatchObject({ letterSpacing: 0.1 });
        await click('Text Shadow:glow');
        expect(savedDecoration()).toMatchObject({ textShadow: 'glow' });
        await click('Italic');
        await click('Underline');
        await click('Uppercase');
        expect(savedDecoration()).toMatchObject({
            isItalic: true,
            isUnderline: true,
            isUppercase: true,
        });
        await click('Text Shadow Color picker');
        await click('Choose color');
        expect(savedDecoration()).toMatchObject({ textShadowColor: '#123456' });
    });

    test('media widgets omit text controls and use zero padding', async () => {
        await renderPanel(false);
        await click('Effects');
        expect(container.textContent).not.toContain('Text Align:');
        await click('Shadow:soft');
        expect(savedDecoration()).toMatchObject({ shadow: 'soft', padding: 0 });
        await click('Shadow Color picker');
        await click('Choose color');
        expect(savedDecoration()).toMatchObject({ shadowColor: '#123456' });
    });
});
