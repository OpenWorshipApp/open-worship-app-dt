// @vitest-environment jsdom

import { act, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// The Properties panel itself: `useForegroundPropsSetting`'s element, opened
// and driven through its own controls, with the REAL position pad, prop rows,
// blend-mode select and common-style rows. Every control writes its setting
// and then reports the widget's whole style through `onChange`, which is read
// straight back off the settings -- so the assertions below are on what a
// screen would actually be handed.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        dictionaries: [] as Record<string, string>[],
        result: null as any,
    },
    mocks: {
        persist: vi.fn(),
        onChange: vi.fn(),
    },
}));

// English labels to query by, while BOTH real dictionaries are checked: a
// label missing its Khmer or French string throws here exactly as it would in
// a dev window.
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
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: any) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
// A setting store the hooks and the straight reads share, so a control's
// write is what the next `genStyle` reads.
vi.mock('../helper/settingHelpers', async () => {
    const { useRef, useState } = await import('react');
    function genHook(parse: (raw: string) => unknown) {
        return (name: string, fallback: unknown) => {
            const [value, setValue] = useState(() => {
                return state.settings.has(name)
                    ? parse(state.settings.get(name)!)
                    : fallback;
            });
            const ref = useRef(value);
            ref.current = value;
            const set = (next: any) => {
                const newValue =
                    typeof next === 'function' ? next(ref.current) : next;
                ref.current = newValue;
                state.settings.set(name, `${newValue}`);
                mocks.persist(name, newValue);
                setValue(newValue);
            };
            return [value, set];
        };
    }
    return {
        getSetting: (name: string) => state.settings.get(name) ?? null,
        setSetting: (name: string, value: string) => {
            state.settings.set(name, value);
        },
        removeSetting: (name: string) => {
            state.settings.delete(name);
        },
        useStateSettingString: genHook((raw) => raw),
        useStateSettingNumber: genHook((raw) => Number(raw)),
        useStateSettingBoolean: genHook((raw) => raw === 'true'),
    };
});
// The real module drags the whole drag-and-drop stack in for one constant.
vi.mock('../others/color/colorHelpers', () => ({ HEX_COLOR_WHITE: '#FFFFFF' }));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title, setValue, defaultSize }: any) => (
        <input
            type="range"
            aria-label={title}
            value={value}
            min={defaultSize.min}
            max={defaultSize.max}
            step={defaultSize.step}
            onChange={(event) => {
                setValue(Number(event.target.value));
            }}
        />
    ),
}));
vi.mock('../others/FontFamilyControlComp', () => ({
    default: ({
        fontFamily,
        setFontFamily,
        fontWeight,
        setFontWeight,
    }: any) => (
        <span data-font={`${fontFamily}|${fontWeight}`}>
            <button
                type="button"
                onClick={() => {
                    setFontFamily('Khmer OS');
                }}
            >
                Pick font
            </button>
            <button
                type="button"
                onClick={() => {
                    setFontWeight('700');
                }}
            >
                Pick weight
            </button>
        </span>
    ),
}));
vi.mock('../others/color/ColorPicker', () => ({
    default: ({ color, defaultColor, onNoColor, onColorChange }: any) => (
        <span data-color={color} data-default-color={defaultColor}>
            <button
                type="button"
                onClick={() => {
                    onColorChange('#123456');
                }}
            >
                Pick color
            </button>
            <button type="button" onClick={onNoColor}>
                No color
            </button>
        </span>
    ),
}));
vi.mock('./ForegroundDecorationSettingComp', () => ({
    default: ({ prefix, isText, isLeadingEngaged, leadingRows }: any) => (
        <section
            data-decoration={prefix}
            data-is-text={`${isText}`}
            data-leading-engaged={`${isLeadingEngaged}`}
        >
            {leadingRows}
        </section>
    ),
}));
vi.mock('./ForegroundTransitionControlsComp', () => ({
    ForegroundTransitionPropComp: ({ prefix, widgetKey }: any) => (
        <span data-transition={`${widgetKey}:${prefix}`} />
    ),
}));

import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
    getForegroundCommonProperties,
} from './ForegroundCommonPropertiesSettingComp';

const dictionaries = readLangPackageDictionaries();

type HostPropsType = Parameters<typeof useForegroundPropsSetting>[0];

function HostComp(props: HostPropsType) {
    const result = useForegroundPropsSetting(props);
    state.result = result;
    return <div>{result.element}</div>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.clear();
    state.dictionaries = dictionaries;
    state.result = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

async function render(props: Partial<HostPropsType> = {}) {
    await act(async () => {
        root.render(
            <HostComp
                prefix="video"
                widgetKey="video"
                onChange={(style, isBehind) => {
                    mocks.onChange(style, isBehind);
                }}
                {...props}
            />,
        );
    });
}

function query<T extends Element>(selector: string) {
    return container.querySelector<T>(selector);
}

function getByLabel<T extends HTMLElement>(label: string) {
    const element = query<T>(`[aria-label="${label}"]`);
    if (element === null) {
        throw new Error(`nothing labelled "${label}"`);
    }
    return element;
}

function getUnitButton(title: string) {
    const button = query<HTMLButtonElement>(
        `.fg-unit button[title="${title}"]`,
    );
    if (button === null) {
        throw new Error(`no unit button "${title}"`);
    }
    return button;
}

async function press(label: string) {
    const button =
        query<HTMLButtonElement>(`button[aria-label="${label}"]`) ??
        query<HTMLButtonElement>(`button[title="${label}"]`) ??
        Array.from(container.querySelectorAll('button')).find((item) => {
            return item.textContent?.trim() === label;
        }) ??
        null;
    if (button === null) {
        throw new Error(`no button "${label}"`);
    }
    await act(async () => {
        button.click();
    });
}

// React reads a controlled field through the element's own value setter.
async function setValue(label: string, value: string) {
    const element = getByLabel<HTMLInputElement | HTMLSelectElement>(label);
    const prototype =
        element instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
            element,
            value,
        );
        element.dispatchEvent(
            new Event(
                element instanceof HTMLSelectElement ? 'change' : 'input',
                {
                    bubbles: true,
                },
            ),
        );
    });
}

async function toggle(label: string) {
    const checkbox = getByLabel<HTMLInputElement>(label);
    await act(async () => {
        checkbox.click();
    });
}

function lastChange(): { style: CSSProperties; isBehind: boolean } {
    const call = mocks.onChange.mock.calls.at(-1);
    if (call === undefined) {
        throw new Error('onChange was never called');
    }
    return { style: call[0], isBehind: call[1] };
}

function getRow(label: string) {
    const row = Array.from(container.querySelectorAll('.fg-prop')).find(
        (item) => {
            return item.querySelector('.fg-prop-name')?.textContent === label;
        },
    );
    if (row === undefined) {
        throw new Error(`no row "${label}"`);
    }
    return row;
}

describe('the foreground Properties panel', () => {
    test('opens closed, and remembers being opened', async () => {
        await render();
        const toggleButton = query<HTMLButtonElement>('.fg-props-toggle')!;
        expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
        expect(query('.fg-props')).toBeNull();

        await press('Properties');
        expect(query('.fg-props-toggle')!.getAttribute('aria-expanded')).toBe(
            'true',
        );
        expect(query('.fg-props-toggle-on')).not.toBeNull();
        expect(mocks.persist).toHaveBeenCalledWith(
            'foreground-video-show-properties-setting',
            true,
        );
        // The transition row is the session's, over its component's.
        expect(
            query('[data-transition]')!.getAttribute('data-transition'),
        ).toBe('video:video');

        await press('Properties');
        expect(query('.fg-props')).toBeNull();
        expect(
            state.settings.get('foreground-video-show-properties-setting'),
        ).toBe('false');
    });

    test('the position pad, width, scale and opacity reach the style', async () => {
        await render({ isCommonStyle: false });
        await press('Properties');

        await press('Top left');
        expect(
            JSON.parse(
                state.settings.get('video-setting-show-widget-alignment-data')!,
            ),
        ).toEqual({ horizontalAlignment: 'left', verticalAlignment: 'start' });
        expect(lastChange().style).toMatchObject({
            left: '0px',
            top: '0px',
            transformOrigin: 'left top',
        });
        expect(getByLabel('Top left').getAttribute('aria-pressed')).toBe(
            'true',
        );

        await setValue('Position offset in pixels X', '12');
        expect(lastChange().style).toMatchObject({ left: '12px' });
        await setValue('Position offset in pixels Y', '-4');
        expect(lastChange().style).toMatchObject({ top: '-4px' });

        expect(getRow('Width (%)').classList.contains('fg-prop-engaged')).toBe(
            false,
        );
        await setValue('Width (%)', '80');
        expect(lastChange().style).toMatchObject({ width: '80%' });
        expect(getRow('Width (%)').classList.contains('fg-prop-engaged')).toBe(
            true,
        );

        await setValue('Scale', '1.5');
        expect(String(lastChange().style.transform)).toContain('scale(1.5)');
        expect(getRow('Scale').classList.contains('fg-prop-engaged')).toBe(
            true,
        );

        await setValue('Opacity (%)', '40');
        expect(lastChange().style).toMatchObject({ opacity: 0.4 });
        expect(getRow('Opacity').classList.contains('fg-prop-engaged')).toBe(
            true,
        );
        // Every report so far is of an overlay in front.
        expect(
            mocks.onChange.mock.calls.every(([, isBehind]) => {
                return isBehind === false;
            }),
        ).toBe(true);
    });

    test('Always on Top lifts the overlay, and Behind Slide takes that away', async () => {
        await render({ isCommonStyle: false });
        await press('Properties');
        const zIndexInput = getByLabel<HTMLInputElement>('Z-Index');
        expect(zIndexInput.disabled).toBe(true);
        expect(
            getRow('Always on Top').classList.contains('fg-prop-engaged'),
        ).toBe(false);

        await toggle('Always on Top');
        expect(lastChange().style).toMatchObject({
            position: 'absolute',
            zIndex: 1,
        });
        expect(getByLabel<HTMLInputElement>('Z-Index').disabled).toBe(false);
        expect(
            getRow('Always on Top').classList.contains('fg-prop-engaged'),
        ).toBe(true);
        await setValue('Z-Index', '7');
        expect(lastChange().style).toMatchObject({ zIndex: 7 });
        // A cleared box is no z-index at all, not NaN.
        await setValue('Z-Index', '');
        expect(state.settings.get('video-setting-show-widget-z-index')).toBe(
            '0',
        );

        await toggle('Behind Slide');
        const { style, isBehind } = lastChange();
        expect(isBehind).toBe(true);
        expect(style).not.toHaveProperty('zIndex');
        const alwaysOnTop = getByLabel<HTMLInputElement>('Always on Top');
        expect(alwaysOnTop.disabled).toBe(true);
        expect(alwaysOnTop.title).toBe(
            'Always on Top does not apply while it is behind the slide',
        );
        expect(getByLabel<HTMLInputElement>('Z-Index').disabled).toBe(true);
        // Still ticked, just not doing anything -- so the row is quiet.
        expect(alwaysOnTop.checked).toBe(true);
        expect(
            getRow('Always on Top').classList.contains('fg-prop-engaged'),
        ).toBe(false);
        expect(
            getRow('Behind Slide').classList.contains('fg-prop-engaged'),
        ).toBe(true);
        expect(state.result.getIsBehind()).toBe(true);

        await toggle('Behind Slide');
        expect(lastChange().isBehind).toBe(false);
        expect(lastChange().style).toMatchObject({ zIndex: 0 });
    });

    test('corner rounding is one control with a unit', async () => {
        await render({ isCommonStyle: false });
        await press('Properties');
        const decoration = query('[data-decoration]')!;
        // A geometry widget starts on 5px, which is its default -- quiet.
        expect(getUnitButton('Round px').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getByLabel<HTMLInputElement>('Round px').value).toBe('5');
        expect(decoration.getAttribute('data-leading-engaged')).toBe('false');
        expect(decoration.getAttribute('data-is-text')).toBe('false');

        await press('Round %');
        expect(
            state.settings.get('video-setting-show-widget-round-size-px'),
        ).toBe('0');
        expect(lastChange().style).toMatchObject({ borderRadius: '25%' });
        expect(decoration.getAttribute('data-leading-engaged')).toBe('true');
        await setValue('Round %', '30');
        expect(lastChange().style).toMatchObject({ borderRadius: '15%' });

        // Back to pixels with none set starts at the default, not at 0 --
        // 0 would just be the percentage again.
        await press('Round px');
        expect(getByLabel<HTMLInputElement>('Round px').value).toBe('5');
        expect(lastChange().style).toMatchObject({ borderRadius: '5px' });
        await setValue('Round px', '9');
        expect(lastChange().style).toMatchObject({ borderRadius: '9px' });
        // Pressing px again keeps the size it already has.
        await press('Round px');
        expect(getByLabel<HTMLInputElement>('Round px').value).toBe('9');
        // Emptied to type another number: nothing is written, and the box
        // stays -- it used to flip to the % slider and vanish mid-typing.
        await setValue('Round px', '');
        expect(
            state.settings.get('video-setting-show-widget-round-size-px'),
        ).toBe('9');
        expect(getUnitButton('Round px').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getByLabel<HTMLInputElement>('Round px').value).toBe('');
        await setValue('Round px', '14');
        expect(lastChange().style).toMatchObject({ borderRadius: '14px' });
        // Left empty, it shows the size still in force.
        await setValue('Round px', '');
        await act(async () => {
            getByLabel<HTMLInputElement>('Round px').dispatchEvent(
                new FocusEvent('focusout', { bubbles: true }),
            );
        });
        expect(getByLabel<HTMLInputElement>('Round px').value).toBe('14');
    });

    test('font size and blend mode are only there when the widget asks', async () => {
        await render({ isCommonStyle: false });
        await press('Properties');
        expect(query('[aria-label="Font size in pixels"]')).toBeNull();
        expect(query('[aria-label="Blend Mode"]')).toBeNull();
        act(() => root.unmount());

        root = createRoot(container);
        await render({
            isCommonStyle: false,
            isFontSize: true,
            isBlendMode: true,
        });
        expect(query('.fg-props')).not.toBeNull();
        await setValue('Font size in pixels', '48');
        expect(lastChange().style).toMatchObject({ fontSize: '48px' });
        expect(getRow('Font Size').classList.contains('fg-prop-engaged')).toBe(
            true,
        );
        // An empty box falls back to the default rather than to 0px.
        await setValue('Font size in pixels', '');
        expect(lastChange().style).toMatchObject({ fontSize: '100px' });

        expect(getRow('Blend Mode').classList.contains('fg-prop-engaged')).toBe(
            false,
        );
        await setValue('Blend Mode', 'multiply');
        expect(lastChange().style).toMatchObject({ mixBlendMode: 'multiply' });
        expect(getRow('Blend Mode').classList.contains('fg-prop-engaged')).toBe(
            true,
        );
    });

    test('a text widget gets font, blur and colours instead of geometry', async () => {
        const names = genCommonStyleSettingNames('notice');
        await render({
            prefix: 'notice',
            widgetKey: 'quick-text',
            isGeometry: false,
        });
        await press('Properties');
        expect(query('.fg-pad')).toBeNull();
        expect(query('[aria-label="Width (%)"]')).toBeNull();
        expect(query('[data-decoration]')!.getAttribute('data-is-text')).toBe(
            'true',
        );
        // No geometry: square corners, and nothing engaged.
        expect(getUnitButton('Round %').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(
            query('[data-decoration]')!.getAttribute('data-leading-engaged'),
        ).toBe('false');

        expect(getRow('Font').classList.contains('fg-prop-engaged')).toBe(
            false,
        );
        await press('Pick font');
        expect(state.settings.get(names.fontFamily)).toBe('Khmer OS');
        // The family stays in the HOOK, so the widget's own preview follows.
        expect(state.result.fontFamily).toBe('Khmer OS');
        expect(getRow('Font').classList.contains('fg-prop-engaged')).toBe(true);
        expect(lastChange().style).toMatchObject({ fontFamily: 'Khmer OS' });
        await press('Pick weight');
        expect(state.result.fontWeight).toBe('700');
        expect(lastChange().style).toMatchObject({ fontWeight: '700' });

        expect(getRow('Blur').classList.contains('fg-prop-engaged')).toBe(
            false,
        );
        await setValue('Blur', '12');
        expect(lastChange().style).toMatchObject({
            backdropFilter: 'blur(12px)',
        });
        expect(getRow('Blur').classList.contains('fg-prop-engaged')).toBe(true);
        await setValue('Blur', '-3');
        expect(state.settings.get(names.backdropFilter)).toBe('0');

        // One picker at a time.
        expect(query('.fg-prop-expand')).toBeNull();
        await press('Text Color');
        expect(getByLabel('Text Color').getAttribute('aria-expanded')).toBe(
            'true',
        );
        const textPicker = query('.fg-prop-expand [data-color]')!;
        expect(textPicker.getAttribute('data-color')).toBe(DEFAULT_TEXT_COLOR);
        await press('Pick color');
        expect(state.settings.get(names.color)).toBe('#123456');
        expect(lastChange().style).toMatchObject({ color: '#123456' });
        expect(getRow('Colors').classList.contains('fg-prop-engaged')).toBe(
            true,
        );
        await press('No color');
        expect(state.settings.get(names.color)).toBe(DEFAULT_TEXT_COLOR);

        await press('Background Color');
        expect(container.querySelectorAll('.fg-prop-expand')).toHaveLength(1);
        expect(query('.fg-prop-expand')!.getAttribute('aria-label')).toBe(
            'Background Color',
        );
        expect(
            query('.fg-prop-expand [data-color]')!.getAttribute(
                'data-default-color',
            ),
        ).toBe(DEFAULT_BACKGROUND_COLOR);
        await press('Pick color');
        expect(lastChange().style).toMatchObject({
            backgroundColor: '#123456',
        });
        await press('No color');
        expect(state.settings.get(names.backgroundColor)).toBe(
            DEFAULT_BACKGROUND_COLOR,
        );
        await press('Background Color');
        expect(query('.fg-prop-expand')).toBeNull();
    });

    test('the hook answers for a widget whose panel is closed', async () => {
        await render({ prefix: 'logo', widgetKey: 'image' });
        expect(query('.fg-props')).toBeNull();
        expect(state.result.getTransition()).toBeUndefined();
        state.settings.set('foreground-component-transition-image', 'fade');
        expect(state.result.getTransition()).toBe('fade');
        state.settings.set('logo-setting-show-widget-transition', 'zoom');
        expect(state.result.getTransition()).toBe('zoom');

        expect(state.result.getIsBehind()).toBe(false);
        state.settings.set('logo-setting-show-widget-is-behind', 'true');
        expect(state.result.getIsBehind()).toBe(true);

        expect(state.result.getWidthScale()).toBe(50);
        state.settings.set('logo-setting-show-widget-width-percentage', '30');
        expect(state.result.getWidthScale()).toBe(30);
        expect(state.result.genStyle()).toMatchObject({ width: '30%' });
        // A text default: the common style comes along, read off the settings.
        expect(getForegroundCommonProperties('logo')).toEqual({
            fontFamily: '',
            fontWeight: '',
            color: DEFAULT_TEXT_COLOR,
            backgroundColor: DEFAULT_BACKGROUND_COLOR,
            backdropFilter: 'blur(5px)',
        });
        expect(state.result.genStyle()).toMatchObject({
            color: DEFAULT_TEXT_COLOR,
            backdropFilter: 'blur(5px)',
        });
        expect(mocks.onChange).not.toHaveBeenCalled();
    });

    test('a widget that swaps its session prefix shows the new session values', async () => {
        state.settings.set(
            'foreground-video-a-show-properties-setting',
            'true',
        );
        state.settings.set(
            'foreground-video-b-show-properties-setting',
            'true',
        );
        state.settings.set(
            'video-a-setting-show-widget-width-percentage',
            '70',
        );
        state.settings.set(
            'video-b-setting-show-widget-width-percentage',
            '20',
        );
        await render({ prefix: 'video-a', isCommonStyle: false });
        expect(getByLabel<HTMLInputElement>('Width (%)').value).toBe('70');

        await render({ prefix: 'video-b', isCommonStyle: false });
        expect(getByLabel<HTMLInputElement>('Width (%)').value).toBe('20');
        await setValue('Width (%)', '25');
        expect(
            state.settings.get('video-b-setting-show-widget-width-percentage'),
        ).toBe('25');
        expect(
            state.settings.get('video-a-setting-show-widget-width-percentage'),
        ).toBe('70');
    });
});
