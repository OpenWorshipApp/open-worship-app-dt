// @vitest-environment jsdom

import { act, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// What the Properties block does with its Presets row's two callbacks: the
// row's Dark / Light switch writes BOTH colours through the block and
// restyles once; a preset written straight into the settings remounts the
// block, so its fields -- which read their setting once, at mount -- show
// the preset rather than writing the old values back over it. The row is a
// stub that presses those callbacks; the block around it is the real one.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        dictionaries: [] as Record<string, string>[],
        presets: null as any,
    },
    mocks: {
        onChange: vi.fn(),
    },
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
vi.mock('../others/color/colorHelpers', () => ({ HEX_COLOR_WHITE: '#FFFFFF' }));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title }: any) => (
        <input type="range" aria-label={title} value={value} readOnly />
    ),
}));
vi.mock('../others/FontFamilyControlComp', () => ({ default: () => null }));
vi.mock('../others/color/ColorPicker', () => ({ default: () => null }));
vi.mock('./ForegroundDecorationSettingComp', () => ({
    default: () => null,
}));
vi.mock('./ForegroundTransitionControlsComp', () => ({
    ForegroundTransitionPropComp: () => null,
}));
vi.mock('./ForegroundPresetsComp', () => ({
    default: (props: any) => {
        state.presets = props;
        return (
            <span
                data-presets={props.widgetKey}
                data-colors={
                    props.colors === undefined
                        ? 'none'
                        : `${props.colors.color}|${props.colors.backgroundColor}`
                }
            />
        );
    },
}));

import { useForegroundPropsSetting } from './propertiesSettingHelpers';

const WIDTH = 'video-setting-show-widget-width-percentage';
const COLOR = 'video-common-color';
const BACKGROUND = 'video-common-background-color';

type HostPropsType = Parameters<typeof useForegroundPropsSetting>[0];

function HostComp(props: HostPropsType) {
    return <div>{useForegroundPropsSetting(props).element}</div>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.clear();
    state.dictionaries = readLangPackageDictionaries();
    state.presets = null;
    // The block opened, as a person left it.
    state.settings.set('foreground-video-show-properties-setting', 'true');
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

function widthValue() {
    return container.querySelector<HTMLInputElement>(
        'input[aria-label="Width (%)"]',
    )!.value;
}

function lastStyle(): CSSProperties {
    const call = mocks.onChange.mock.calls.at(-1);
    if (call === undefined) {
        throw new Error('onChange was never called');
    }
    return call[0];
}

describe('the Presets row inside the Properties block', () => {
    test('the colour switch writes both colours and restyles once', async () => {
        state.settings.set(COLOR, '#FFFFFF');
        state.settings.set(BACKGROUND, '#000080AA');
        await render();
        expect(
            container
                .querySelector('[data-presets]')!
                .getAttribute('data-colors'),
        ).toBe('#FFFFFF|#000080AA');
        await act(async () => {
            state.presets.colors.onChange({
                color: '#111111',
                backgroundColor: '#EEEEEEDD',
            });
        });
        expect(state.settings.get(COLOR)).toBe('#111111');
        expect(state.settings.get(BACKGROUND)).toBe('#EEEEEEDD');
        expect(mocks.onChange).toHaveBeenCalledTimes(1);
        expect(lastStyle()).toMatchObject({
            color: '#111111',
            backgroundColor: '#EEEEEEDD',
        });
        // The row is drawn again with the colours it just set.
        expect(
            container
                .querySelector('[data-presets]')!
                .getAttribute('data-colors'),
        ).toBe('#111111|#EEEEEEDD');
    });

    test('a picture with no words is handed no colours to switch', async () => {
        await render({ isCommonStyle: false });
        expect(
            container
                .querySelector('[data-presets]')!
                .getAttribute('data-colors'),
        ).toBe('none');
    });

    test('a preset applied remounts the block, so its fields show the preset', async () => {
        state.settings.set(WIDTH, '40');
        await render();
        expect(widthValue()).toBe('40');
        // What a preset does: written straight into the settings.
        state.settings.set(WIDTH, '80');
        await render();
        // Read once at mount: still the old value until the block remounts.
        expect(widthValue()).toBe('40');
        await act(async () => {
            state.presets.onApplied();
        });
        expect(widthValue()).toBe('80');
        // A second preset remounts it again.
        state.settings.set(WIDTH, '65');
        await act(async () => {
            state.presets.onApplied();
        });
        expect(widthValue()).toBe('65');
    });
});
