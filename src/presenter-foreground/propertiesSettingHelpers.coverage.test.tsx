// @vitest-environment jsdom

import { act, type CSSProperties, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Properties PANEL of every foreground widget: the controls, the setting
// each one writes, and the restyled overlay each change hands its widget.
// `propertiesSettingHelpers.test.tsx` holds the pure style readers.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        // Raw strings, the way a settings file holds them.
        settings: new Map<string, string>(),
        commonProps: null as any,
    },
    mocks: {
        setSetting: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const { useRef, useState } = await import('react');
    function writeSetting(name: string, value: string) {
        state.settings.set(name, value);
        mocks.setSetting(name, value);
    }
    // The real hooks' shape: read once on mount, write the string through.
    function genHook(parse: (raw: string) => unknown) {
        return (name: string, fallback: unknown) => {
            const [value, setValue] = useState<any>(() => {
                const raw = state.settings.get(name);
                if (raw !== undefined && raw !== '') {
                    return parse(raw);
                }
                return typeof fallback === 'function' ? fallback() : fallback;
            });
            const valueRef = useRef(value);
            valueRef.current = value;
            return [
                value,
                (next: any) => {
                    const newValue =
                        typeof next === 'function'
                            ? next(valueRef.current)
                            : next;
                    valueRef.current = newValue;
                    writeSetting(name, `${newValue}`);
                    setValue(newValue);
                },
            ];
        };
    }
    return {
        getSetting: (name: string) => state.settings.get(name) ?? null,
        setSetting: writeSetting,
        removeSetting: (name: string) => {
            state.settings.delete(name);
        },
        useStateSettingNumber: genHook(Number.parseFloat),
        useStateSettingBoolean: genHook((raw) => raw === 'true'),
        useStateSettingString: genHook((raw) => raw),
    };
});
// A text box rather than a real slider: jsdom clamps a range input to 0..100.
vi.mock('../others/AppRangeComp', () => ({
    default: ({
        value,
        title,
        setValue,
    }: {
        value: number;
        title: string;
        setValue: (value: number) => void;
    }) => (
        <input
            type="text"
            aria-label={title}
            value={value}
            onChange={(event) => {
                setValue(Number(event.target.value));
            }}
        />
    ),
}));
vi.mock('./ForegroundPositionPadComp', () => ({
    default: ({
        data,
        onData,
        offsetX,
        setOffsetX,
        offsetY,
        setOffsetY,
    }: any) => (
        <div
            data-testid="pad"
            data-alignment={JSON.stringify(data)}
            data-offset={`${offsetX},${offsetY}`}
        >
            <button
                type="button"
                onClick={() => {
                    onData({ horizontalAlignment: 'left' });
                }}
            >
                pad-left
            </button>
            <button
                type="button"
                onClick={() => {
                    onData({ verticalAlignment: 'end' });
                }}
            >
                pad-bottom
            </button>
            <button
                type="button"
                onClick={() => {
                    setOffsetX(12);
                }}
            >
                offset-x
            </button>
            <button
                type="button"
                onClick={() => {
                    setOffsetY(-4);
                }}
            >
                offset-y
            </button>
        </div>
    ),
}));
vi.mock('../others/BlendModeSelectComp', () => ({
    default: ({ blendMode, setBlendMode }: any) => (
        <select
            aria-label="blend mode picker"
            value={blendMode}
            onChange={(event) => {
                setBlendMode(event.target.value);
            }}
        >
            <option value="normal">normal</option>
            <option value="multiply">multiply</option>
            <option value="screen">screen</option>
        </select>
    ),
}));
vi.mock('./ForegroundDecorationSettingComp', () => ({
    default: ({ prefix, isText, isLeadingEngaged, leadingRows }: any) => (
        <div
            data-testid="decoration"
            data-prefix={prefix}
            data-is-text={String(isText)}
            data-leading-engaged={String(isLeadingEngaged)}
        >
            {leadingRows}
        </div>
    ),
}));
vi.mock('./ForegroundTransitionControlsComp', () => ({
    ForegroundTransitionPropComp: ({ prefix, widgetKey }: any) => (
        <div
            data-testid="transition"
            data-prefix={prefix}
            data-widget-key={widgetKey}
        />
    ),
}));
// The real setting names and readers; only the control strip is stood in.
vi.mock('../others/FontFamilyControlComp', () => ({ default: () => null }));
vi.mock('../others/color/ColorPicker', () => ({ default: () => null }));
vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_WHITE: '#FFFFFF',
}));
vi.mock('./ForegroundCommonPropertiesSettingComp', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('./ForegroundCommonPropertiesSettingComp')
        >();
    return {
        ...actual,
        default: (props: any) => {
            state.commonProps = props;
            return <div data-testid="common" />;
        },
    };
});

import { useForegroundPropsSetting } from './propertiesSettingHelpers';

type HookResultType = ReturnType<typeof useForegroundPropsSetting>;
type HostPropsType = {
    prefix: string;
    onChange: (style: CSSProperties, isBehind: boolean) => void;
    isFontSize?: boolean;
    isGeometry?: boolean;
    isCommonStyle?: boolean;
    isBlendMode?: boolean;
    extraControls?: ReactNode;
    onResult?: (result: HookResultType) => void;
};

function HostComp({ onResult, ...props }: Readonly<HostPropsType>) {
    const result = useForegroundPropsSetting({ widgetKey: 'video', ...props });
    onResult?.(result);
    return <div>{result.element}</div>;
}

let container: HTMLDivElement;
let root: Root;
const onChange = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.settings.clear();
    state.commonProps = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render(props: Partial<HostPropsType> = {}) {
    await act(async () => {
        root.render(<HostComp prefix="video" onChange={onChange} {...props} />);
    });
}
function query<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector(selector) as T | null;
}
function getButton(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === text,
    );
    expect(button, `button ${text}`).toBeDefined();
    return button as HTMLButtonElement;
}
async function click(element: HTMLElement) {
    await act(async () => element.click());
}
async function typeInto(label: string, value: string) {
    const input = query<HTMLInputElement>(`input[aria-label="${label}"]`);
    expect(input, `input ${label}`).not.toBeNull();
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
async function toggleCheckbox(label: string) {
    const input = query<HTMLInputElement>(
        `input[type="checkbox"][aria-label="${label}"]`,
    );
    expect(input, `checkbox ${label}`).not.toBeNull();
    await click(input!);
}
function lastChange() {
    const call = onChange.mock.calls.at(-1);
    expect(call, 'onChange was called').toBeDefined();
    return { style: call![0] as CSSProperties, isBehind: call![1] as boolean };
}
function getRow(label: string) {
    const row = Array.from(container.querySelectorAll('.fg-prop')).find(
        (item) =>
            item.querySelector('.fg-prop-name')?.textContent?.trim() === label,
    );
    expect(row, `row ${label}`).toBeDefined();
    return row as HTMLElement;
}
async function openPanel(props: Partial<HostPropsType> = {}) {
    await render(props);
    await click(query('.fg-props-toggle')!);
    expect(query('.fg-props')).not.toBeNull();
}

describe('the Properties toggle', () => {
    test('mounts the form only while open, and remembers being open per prefix', async () => {
        await render();
        const toggle = query('.fg-props-toggle')!;
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.title).toBe('Properties');
        // Closed, nothing of the form is drawn -- and nothing of it is read.
        expect(query('.fg-props')).toBeNull();
        await click(toggle);
        expect(
            state.settings.get('foreground-video-show-properties-setting'),
        ).toBe('true');
        expect(query('.fg-props-toggle')!.className).toContain(
            'fg-props-toggle-on',
        );
        expect(query('.fg-props')).not.toBeNull();
        await click(query('.fg-props-toggle')!);
        expect(
            state.settings.get('foreground-video-show-properties-setting'),
        ).toBe('false');
        expect(query('.fg-props')).toBeNull();
    });

    test('opens already open when the panel was left open', async () => {
        state.settings.set('foreground-video-show-properties-setting', 'true');
        await render();
        expect(query('.fg-props-toggle')!.getAttribute('aria-expanded')).toBe(
            'true',
        );
        expect(query('[data-testid="pad"]')).not.toBeNull();
    });

    test('remounts the form for another session so it shows that session’s values', async () => {
        state.settings.set('foreground-a-show-properties-setting', 'true');
        state.settings.set('foreground-b-show-properties-setting', 'true');
        state.settings.set('a-setting-show-widget-width-percentage', '30');
        state.settings.set('b-setting-show-widget-width-percentage', '70');
        await render({ prefix: 'a' });
        expect(
            query<HTMLInputElement>('input[aria-label="Width (%)"]')!.value,
        ).toBe('30');
        await render({ prefix: 'b' });
        expect(
            query<HTMLInputElement>('input[aria-label="Width (%)"]')!.value,
        ).toBe('70');
        expect(
            query('[data-testid="transition"]')!.getAttribute('data-prefix'),
        ).toBe('b');
    });
});

describe('geometry rows', () => {
    test('width, scale and opacity write their settings and restyle the overlay', async () => {
        await openPanel();
        expect(getRow('Width (%)').className).not.toContain('fg-prop-engaged');
        await typeInto('Width (%)', '80');
        expect(
            state.settings.get('video-setting-show-widget-width-percentage'),
        ).toBe('80');
        expect(lastChange()).toEqual({
            style: expect.objectContaining({ width: '80%' }),
            isBehind: false,
        });
        expect(getRow('Width (%)').className).toContain('fg-prop-engaged');

        await typeInto('Scale', '1.5');
        expect(lastChange().style.transform).toContain('scale(1.5)');
        expect(getRow('Scale').className).toContain('fg-prop-engaged');

        await typeInto('Opacity (%)', '40');
        expect(lastChange().style.opacity).toBe(0.4);
        expect(getRow('Opacity').className).toContain('fg-prop-engaged');
    });

    test('the position pad merges each choice into the stored alignment and nudges by pixels', async () => {
        await openPanel();
        const pad = query('[data-testid="pad"]')!;
        expect(JSON.parse(pad.getAttribute('data-alignment')!)).toEqual({
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
        });
        await click(getButton('pad-left'));
        // The vertical half stays what it was.
        expect(
            JSON.parse(
                state.settings.get('video-setting-show-widget-alignment-data')!,
            ),
        ).toEqual({ horizontalAlignment: 'left', verticalAlignment: 'center' });
        expect(lastChange().style).toMatchObject({
            left: '0px',
            top: '50%',
            transformOrigin: 'left center',
        });
        await click(getButton('pad-bottom'));
        await click(getButton('offset-x'));
        await click(getButton('offset-y'));
        expect(state.settings.get('video-setting-show-widget-offset-x')).toBe(
            '12',
        );
        expect(state.settings.get('video-setting-show-widget-offset-y')).toBe(
            '-4',
        );
        expect(lastChange().style).toMatchObject({
            left: '12px',
            bottom: '-4px',
            transformOrigin: 'left bottom',
        });
        expect(query('[data-testid="pad"]')!.getAttribute('data-offset')).toBe(
            '12,-4',
        );
    });

    test('a widget without geometry draws neither the pad nor the size rows', async () => {
        await openPanel({ isGeometry: false });
        expect(query('[data-testid="pad"]')).toBeNull();
        expect(query('input[aria-label="Width (%)"]')).toBeNull();
        expect(query('input[aria-label="Scale"]')).toBeNull();
    });
});

describe('the Round control', () => {
    test('a geometry widget starts in pixels at 5 and is not lit for it', async () => {
        await openPanel();
        const pixelButton = query('button[title="Round px"]')!;
        expect(pixelButton.getAttribute('aria-pressed')).toBe('true');
        expect(pixelButton.className).toBe('fg-unit-on');
        expect(
            query<HTMLInputElement>('input[aria-label="Round px"]')!.value,
        ).toBe('5');
        expect(getRow('Round').className).not.toContain('fg-prop-engaged');
        expect(
            query('[data-testid="decoration"]')!.getAttribute(
                'data-leading-engaged',
            ),
        ).toBe('false');
    });

    test('switching units goes through zero and back to the pixel default', async () => {
        await openPanel();
        await click(query('button[title="Round %"]')!);
        // Zero pixels IS "use the percentage".
        expect(
            state.settings.get('video-setting-show-widget-round-size-px'),
        ).toBe('0');
        expect(query('input[aria-label="Round px"]')).toBeNull();
        expect(
            query<HTMLInputElement>('input[aria-label="Round %"]')!.value,
        ).toBe('50');
        expect(lastChange().style.borderRadius).toBe('25%');
        expect(getRow('Round').className).toContain('fg-prop-engaged');

        await typeInto('Round %', '100');
        expect(lastChange().style.borderRadius).toBe('50%');

        // Back to pixels with none set starts at the default, not at zero.
        await click(query('button[title="Round px"]')!);
        expect(
            state.settings.get('video-setting-show-widget-round-size-px'),
        ).toBe('5');
        expect(lastChange().style.borderRadius).toBe('5px');
    });

    test('a typed pixel size is never negative and keeps a size already set', async () => {
        await openPanel();
        await typeInto('Round px', '12');
        expect(lastChange().style.borderRadius).toBe('12px');
        expect(
            query('[data-testid="decoration"]')!.getAttribute(
                'data-leading-engaged',
            ),
        ).toBe('true');
        // Pressing px again keeps the 12 rather than resetting it.
        await click(query('button[title="Round px"]')!);
        expect(
            state.settings.get('video-setting-show-widget-round-size-px'),
        ).toBe('12');
        await typeInto('Round px', '-3');
        expect(
            state.settings.get('video-setting-show-widget-round-size-px'),
        ).toBe('0');
        // ...which is the percentage mode again.
        expect(query('input[aria-label="Round %"]')).not.toBeNull();
    });

    test('a widget without geometry starts square, in percent', async () => {
        await openPanel({ isGeometry: false });
        expect(
            query('button[title="Round %"]')!.getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            query<HTMLInputElement>('input[aria-label="Round %"]')!.value,
        ).toBe('0');
        expect(getRow('Round').className).not.toContain('fg-prop-engaged');
    });
});

describe('layering', () => {
    test('Always on Top enables its z-index, which lifts the overlay', async () => {
        await openPanel();
        const zIndexInput = query<HTMLInputElement>(
            'input[aria-label="Z-Index"]',
        )!;
        expect(zIndexInput.disabled).toBe(true);
        expect(getRow('Always on Top').className).not.toContain(
            'fg-prop-engaged',
        );
        await toggleCheckbox('Always on Top');
        expect(
            state.settings.get('video-setting-show-widget-always-on-top'),
        ).toBe('true');
        expect(
            query<HTMLInputElement>('input[aria-label="Z-Index"]')!.disabled,
        ).toBe(false);
        expect(getRow('Always on Top').className).toContain('fg-prop-engaged');
        await typeInto('Z-Index', '7');
        expect(lastChange().style).toMatchObject({
            position: 'absolute',
            zIndex: 7,
        });
        // Not a number is no lift at all.
        await typeInto('Z-Index', 'x');
        expect(state.settings.get('video-setting-show-widget-z-index')).toBe(
            '0',
        );
    });

    test('Behind Slide travels beside the style and switches Always on Top off, saying why', async () => {
        state.settings.set('video-setting-show-widget-always-on-top', 'true');
        state.settings.set('video-setting-show-widget-z-index', '7');
        await openPanel();
        expect(getRow('Behind Slide').className).not.toContain(
            'fg-prop-engaged',
        );
        await toggleCheckbox('Behind Slide');
        expect(state.settings.get('video-setting-show-widget-is-behind')).toBe(
            'true',
        );
        const { style, isBehind } = lastChange();
        expect(isBehind).toBe(true);
        // A z-index would lift it back over the words it was put behind.
        expect(style).not.toHaveProperty('zIndex');
        expect(getRow('Behind Slide').className).toContain('fg-prop-engaged');
        const onTopInput = query<HTMLInputElement>(
            'input[type="checkbox"][aria-label="Always on Top"]',
        )!;
        expect(onTopInput.disabled).toBe(true);
        expect(onTopInput.title).toBe(
            'Always on Top does not apply while it is behind the slide',
        );
        expect(
            query<HTMLInputElement>('input[aria-label="Z-Index"]')!.disabled,
        ).toBe(true);
        expect(getRow('Always on Top').className).not.toContain(
            'fg-prop-engaged',
        );
    });
});

describe('the optional rows', () => {
    test('the blend-mode picker is offered to picture widgets only, and blends the overlay', async () => {
        await openPanel();
        expect(query('select[aria-label="blend mode picker"]')).toBeNull();
        await act(async () => root.unmount());
        root = createRoot(container);
        await render({ isBlendMode: true });
        const select = query<HTMLSelectElement>(
            'select[aria-label="blend mode picker"]',
        )!;
        expect(getRow('Blend Mode').className).not.toContain('fg-prop-engaged');
        await act(async () => {
            select.value = 'multiply';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(state.settings.get('video-setting-show-widget-blend-mode')).toBe(
            'multiply',
        );
        expect(lastChange().style.mixBlendMode).toBe('multiply');
        expect(getRow('Blend Mode').className).toContain('fg-prop-engaged');
    });

    test('a text widget sizes its font in pixels, and an emptied box means the default', async () => {
        await openPanel({ isFontSize: true });
        expect(getRow('Font Size').title).toBe('Font size in pixels');
        await typeInto('Font size in pixels', '48');
        expect(state.settings.get('video-setting-show-widget-font-size')).toBe(
            '48',
        );
        expect(lastChange().style.fontSize).toBe('48px');
        expect(getRow('Font Size').className).toContain('fg-prop-engaged');
        await typeInto('Font size in pixels', '');
        expect(lastChange().style.fontSize).toBe('100px');
    });

    test('a picture widget has no font size row', async () => {
        await openPanel();
        expect(query('input[aria-label="Font size in pixels"]')).toBeNull();
    });

    test('the widget’s own controls come first, before the layering rows', async () => {
        await openPanel({
            extraControls: <div data-testid="extra">speed</div>,
        });
        const tail = query('.fg-props-tail')!;
        expect(tail.firstElementChild!.getAttribute('data-testid')).toBe(
            'extra',
        );
        expect(
            query('[data-testid="transition"]')!.getAttribute(
                'data-widget-key',
            ),
        ).toBe('video');
    });

    test('the common text style is wired to its own settings and reported', async () => {
        let result: HookResultType | null = null;
        await openPanel({
            onResult: (value) => {
                result = value;
            },
        });
        expect(
            query('[data-testid="decoration"]')!.getAttribute('data-is-text'),
        ).toBe('true');
        expect(state.commonProps).toMatchObject({
            fontFamily: '',
            fontWeight: '',
            color: '#FFFFFF',
            backgroundColor: '#000080AA',
            backdropFilter: 5,
        });
        await act(async () => state.commonProps.setColor('#FF0000'));
        expect(state.settings.get('video-common-color')).toBe('#FF0000');
        expect(lastChange().style.color).toBe('#FF0000');
        await act(async () => state.commonProps.setBackgroundColor('#00FF00'));
        expect(lastChange().style.backgroundColor).toBe('#00FF00');
        await act(async () => state.commonProps.setBackdropFilter(9));
        expect(lastChange().style.backdropFilter).toBe('blur(9px)');
        await act(async () => state.commonProps.setFontWeight('700'));
        await act(async () => state.commonProps.setFontFamily('Khmer OS'));
        expect(lastChange().style).toMatchObject({
            fontFamily: 'Khmer OS',
            fontWeight: '700',
        });
        // The two values the marquee and quick text draw their own preview
        // with come back out of the hook itself.
        expect(result!.fontFamily).toBe('Khmer OS');
        expect(result!.fontWeight).toBe('700');
    });

    test('a widget without common style draws none of it', async () => {
        await openPanel({ isCommonStyle: false });
        expect(query('[data-testid="common"]')).toBeNull();
        expect(
            query('[data-testid="decoration"]')!.getAttribute('data-is-text'),
        ).toBe('false');
    });
});

describe('the hook’s readers', () => {
    test('read the current settings without the panel being open', async () => {
        let result: HookResultType | null = null;
        await render({
            isCommonStyle: false,
            onResult: (value) => {
                result = value;
            },
        });
        expect(query('.fg-props')).toBeNull();
        expect(result!.getWidthScale()).toBe(50);
        state.settings.set('video-setting-show-widget-width-percentage', '0');
        expect(result!.getWidthScale()).toBe(1);
        expect(result!.getIsBehind()).toBe(false);
        state.settings.set('video-setting-show-widget-is-behind', 'true');
        expect(result!.getIsBehind()).toBe(true);
        // No transition of its own: the screen's applies.
        expect(result!.getTransition()).toBeUndefined();
        state.settings.set('foreground-component-transition-video', 'fade');
        expect(result!.getTransition()).toBe('fade');
        state.settings.set('video-setting-show-widget-transition', 'zoom');
        expect(result!.getTransition()).toBe('zoom');
        state.settings.set('video-setting-show-widget-width-percentage', '33');
        expect(result!.genStyle()).toMatchObject({
            position: 'absolute',
            width: '33%',
        });
    });
});
