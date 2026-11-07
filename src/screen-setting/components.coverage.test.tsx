// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// One mock surface for the small Screen Setting components: the preview
// width / background row a document previewer hosts, and the Bible/LongText Properties
// panel (stage, looks, floating host, toggles). Each test drives the real
// component through its DOM and asserts what it WRITES (a setting, the style
// patch) and what each screen is TOLD (its `varySlideData`).

const h = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
    isPdfFullWidth: false,
    setIsPdfFullWidth: vi.fn(),
    screenManagers: [] as unknown[],
    // What `useBibleTextStyleEditing` opens on, and every patch it was given.
    initialStyle: {} as Record<string, unknown>,
    applyStyle: vi.fn(),
    theme: 'dark',
    lastControlsProps: null as null | Record<string, any>,
    lastPresetTilesProps: null as null | Record<string, any>,
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settingStore.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settingStore.set(key, value);
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.screenManagers,
}));
vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    checkIsPdfFullWidth: () => h.isPdfFullWidth,
    setIsPdfFullWidth: h.setIsPdfFullWidth,
}));
// The real hook keeps a local copy of the style and commits each patch to
// `ScreenLongTextManager`; this one keeps the copy and records the patch.
vi.mock('../_screen/preview/stylingHelpers', async () => {
    const { useState } = await import('react');
    const { toBibleTextStyleView } =
        await import('../_screen/bibleTextStyleHelpers');
    return {
        useBibleTextStyleEditing: () => {
            const [style, setStyle] = useState(() => ({ ...h.initialStyle }));
            const applyStyle = (patch: Record<string, unknown>) => {
                h.applyStyle(patch);
                setStyle((old) => ({ ...old, ...patch }));
            };
            return [toBibleTextStyleView(style), applyStyle] as const;
        },
    };
});
// Both have suites of their own; here they only show what they were given.
vi.mock('./BibleTextControlsComp', () => ({
    default: (props: Record<string, any>) => {
        h.lastControlsProps = props;
        return <div className="mock-controls" data-backdrop={props.backdrop} />;
    },
}));
vi.mock('./BibleTextPresetTilesComp', () => ({
    default: (props: Record<string, any>) => {
        h.lastPresetTilesProps = props;
        return (
            <button type="button" title="Saved look">
                {props.sample}
            </button>
        );
    },
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        widgetName,
        persistKey,
        options,
        onClose,
        children,
    }: Record<string, any>) => (
        <section
            className="mock-floating-widget"
            data-title={title}
            data-widget-name={widgetName}
            data-persist-key={persistKey}
            data-width={options.width}
            data-height={options.height}
        >
            <button type="button" onClick={onClose}>
                Close floating widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: { children: React.ReactNode }) => (
            <Suspense fallback={<span className="mock-loading">Loading</span>}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.theme }),
}));

import { toBibleTextStyleView } from '../_screen/bibleTextStyleHelpers';
import PageBaseAppearanceSettingComp from './PageBaseAppearanceSettingComp';
import VirtualBGColorSettingComp from './VirtualBGColorSettingComp';
import BibleCustomStyleComp from './BibleCustomStyleComp';
import BibleCustomStyleFloatingComp from './BibleCustomStyleFloatingComp';
import BibleCustomStyleFloatingToggleComp from './BibleCustomStyleFloatingToggleComp';
import {
    genBibleBackdropPatch,
    genBibleTextEffectPatch,
    genBibleTextLookEffect,
    genBibleTextLookList,
} from './bibleTextLookHelpers';

const FLOATING_SETTING_NAME = 'bible-custom-style-floating';
const LOOK_LABEL_LIST = [
    'Normal',
    'Thin Outline',
    'Outline',
    'Heavy Outline',
    'Soft Shadow',
    'Deep Shadow',
    'Hard Shadow',
    'Lifted',
    'Glow',
    'Haze',
    'Halo',
    'Blue Edge',
];

let container: HTMLDivElement;
let root: Root;

// A screen whose document manager records every `varySlideData` it is told:
// the real setter re-renders, persists and syncs the projected screen.
function genScreenManager(varySlideData: Record<string, unknown> | null) {
    const told: Array<Record<string, unknown> | null> = [];
    let current = varySlideData;
    return {
        told,
        screenVaryAppDocumentManager: {
            get varySlideData() {
                return current;
            },
            set varySlideData(value: Record<string, unknown> | null) {
                told.push(value);
                current = value;
            },
        },
    };
}

async function render(element: React.ReactElement) {
    await act(async () => {
        root.render(element);
    });
}

async function press(element: Element | null | undefined) {
    if (!element) {
        throw new Error('Nothing to press');
    }
    await act(async () => {
        (element as HTMLElement).click();
    });
}

function findButton(title: string) {
    return [...document.body.querySelectorAll('button')].find((button) => {
        return button.title === title || button.textContent === title;
    });
}

async function dispatch(element: Element, event: Event) {
    await act(async () => {
        element.dispatchEvent(event);
    });
    return event;
}

async function typeColor(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function waitFor(check: () => boolean, what: string) {
    for (let i = 0; i < 50; i++) {
        if (check()) {
            return;
        }
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
        });
    }
    throw new Error(`Timed out waiting for ${what}`);
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settingStore.clear();
    h.isPdfFullWidth = false;
    h.screenManagers = [];
    h.initialStyle = {};
    h.theme = 'dark';
    h.lastControlsProps = null;
    h.lastPresetTilesProps = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('PageBaseAppearanceSettingComp', () => {
    function getRadio(id: string) {
        return container.querySelector<HTMLInputElement>(`#${id}`)!;
    }

    test('switching the width is stored and told to every screen showing a document', async () => {
        const showing = genScreenManager({
            id: 'slide-1',
            isRenderFullWidth: false,
            virtualBackgroundColor: '#112233',
        });
        const idle = genScreenManager(null);
        h.screenManagers = [showing, idle];
        await render(<PageBaseAppearanceSettingComp />);
        expect(getRadio('setting-not-full-width').checked).toBe(true);
        expect(getRadio('setting-full-width').checked).toBe(false);

        await press(container.querySelector('label[for="setting-full-width"]'));
        expect(h.setIsPdfFullWidth).toHaveBeenCalledTimes(1);
        expect(h.setIsPdfFullWidth).toHaveBeenLastCalledWith(true);
        // A fresh object, so the setter sees a change and re-renders it.
        expect(showing.told).toEqual([
            {
                id: 'slide-1',
                isRenderFullWidth: true,
                virtualBackgroundColor: '#112233',
            },
        ]);
        // A screen showing no document is left alone.
        expect(idle.told).toEqual([]);
        expect(getRadio('setting-full-width').checked).toBe(true);
        expect(getRadio('setting-not-full-width').checked).toBe(false);

        await press(
            container.querySelector('label[for="setting-not-full-width"]'),
        );
        expect(h.setIsPdfFullWidth).toHaveBeenLastCalledWith(false);
        expect(showing.told.at(-1)).toMatchObject({
            id: 'slide-1',
            isRenderFullWidth: false,
        });
        expect(showing.told).toHaveLength(2);
        expect(idle.told).toEqual([]);
        expect(getRadio('setting-not-full-width').checked).toBe(true);
    });

    test('opens on Full Width when that is what was stored', async () => {
        h.isPdfFullWidth = true;
        await render(<PageBaseAppearanceSettingComp />);
        expect(getRadio('setting-full-width').checked).toBe(true);
        expect(getRadio('setting-not-full-width').checked).toBe(false);
        expect(container.textContent).toContain('On Screen Width:');
        expect(container.textContent).toContain('Preview BG:');
    });

    test('a preview background goes to the caller and onto every showing screen', async () => {
        const showing = genScreenManager({
            id: 'slide-1',
            virtualBackgroundColor: null,
        });
        const idle = genScreenManager(null);
        h.screenManagers = [showing, idle];
        const onColorChange = vi.fn();
        await render(
            <PageBaseAppearanceSettingComp
                docxPreviewBackgroundColor="#112233"
                onDocxPreviewBackgroundColorChange={onColorChange}
            />,
        );
        const input = container.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        expect(input.value.toLowerCase()).toBe('#112233');

        await typeColor(input, '#abcdef');
        expect(onColorChange).toHaveBeenLastCalledWith('#ABCDEF');
        expect(showing.told).toEqual([
            { id: 'slide-1', virtualBackgroundColor: '#ABCDEF' },
        ]);
        expect(idle.told).toEqual([]);

        // Cleared: the screen is told "no colour", not an empty string.
        const swatch = container.querySelector('.docx-bg-color button')!;
        await dispatch(
            swatch,
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        expect(onColorChange).toHaveBeenLastCalledWith('');
        expect(showing.told.at(-1)).toEqual({
            id: 'slide-1',
            virtualBackgroundColor: null,
        });
    });

    test('with no caller listening, the screens are still told the colour', async () => {
        const showing = genScreenManager({ id: 'slide-2' });
        h.screenManagers = [showing];
        await render(<PageBaseAppearanceSettingComp />);
        const input = container.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        await typeColor(input, '#00ff00');
        expect(showing.told).toEqual([
            { id: 'slide-2', virtualBackgroundColor: '#00FF00' },
        ]);
    });
});

describe('VirtualBGColorSettingComp', () => {
    function getParts() {
        return {
            input: container.querySelector<HTMLInputElement>(
                'input[type="color"]',
            )!,
            button: container.querySelector('button')!,
            swatch: container.querySelector<HTMLElement>('.bi-record-circle')!,
            clear: container.querySelector<HTMLElement>('.bi-x-lg'),
        };
    }

    test('with no colour chosen the picker opens on white and nothing can be cleared', async () => {
        await render(<VirtualBGColorSettingComp />);
        const { input, button, clear } = getParts();
        expect(input.value.toLowerCase()).toBe('#ffffff');
        expect(button.title).toBe(
            'Choose DOCX Preview Background (right click to clear)',
        );
        expect(clear).toBeNull();
    });

    test('pressing the swatch opens the hidden colour picker', async () => {
        await render(<VirtualBGColorSettingComp />);
        const { input, button } = getParts();
        const onPickerOpening = vi.fn();
        input.addEventListener('click', onPickerOpening);
        const event = await dispatch(
            button,
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
        expect(onPickerOpening).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
    });

    test('a picked colour is reported in capitals', async () => {
        const onColorChange = vi.fn();
        await render(
            <VirtualBGColorSettingComp
                onDocxPreviewBackgroundColorChange={onColorChange}
            />,
        );
        await typeColor(getParts().input, '#a1b2c3');
        expect(onColorChange).toHaveBeenCalledTimes(1);
        expect(onColorChange).toHaveBeenCalledWith('#A1B2C3');
    });

    test('a chosen colour is shown, and the cross or a right-click clears it without opening the picker', async () => {
        const onColorChange = vi.fn();
        await render(
            <VirtualBGColorSettingComp
                docxPreviewBackgroundColor="#123456"
                onDocxPreviewBackgroundColorChange={onColorChange}
            />,
        );
        const { input, button, swatch, clear } = getParts();
        expect(swatch.style.color).toBe('rgb(18, 52, 86)');
        expect(clear).not.toBeNull();
        const onPickerOpening = vi.fn();
        input.addEventListener('click', onPickerOpening);

        await press(clear);
        expect(onColorChange).toHaveBeenCalledTimes(1);
        expect(onColorChange).toHaveBeenLastCalledWith('');
        // The cross sits inside the swatch button: its press must not reach
        // the button and open the picker as well.
        expect(onPickerOpening).not.toHaveBeenCalled();

        const event = await dispatch(
            button,
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        expect(onColorChange).toHaveBeenCalledTimes(2);
        expect(onColorChange).toHaveBeenLastCalledWith('');
        expect(event.defaultPrevented).toBe(true);
        expect(onPickerOpening).not.toHaveBeenCalled();
    });
});

describe('BibleCustomStyleComp (stage, looks and tiles)', () => {
    function getStage() {
        return container.querySelector('.bible-style-stage')!;
    }

    function getLookTiles() {
        return [
            ...container.querySelectorAll<HTMLButtonElement>(
                '.bible-style-looks > .bible-style-look',
            ),
        ];
    }

    function findLook(label: string) {
        const tile = getLookTiles().find((item) => item.title === label);
        if (tile === undefined) {
            throw new Error(`No look called "${label}"`);
        }
        return tile;
    }

    function getBackdropButton(label: string) {
        return [
            ...container.querySelectorAll<HTMLButtonElement>(
                '.bible-style-backdrop button',
            ),
        ].find((button) => button.textContent === label)!;
    }

    test('draws the verse on the background its words are for', async () => {
        h.initialStyle = {
            color: '#FFFFFF',
            fontSize: 100,
            lineHeight: 1.8,
            textAlign: 'center',
            // Typed by hand in pixels: the stage draws it at its own size.
            textShadow: '2px 2px 0 #000000',
        };
        await render(<BibleCustomStyleComp />);
        expect(getStage().className).toBe(
            'bible-style-stage bible-style-on-dark',
        );
        const verse =
            container.querySelector<HTMLElement>('.bible-style-verse')!;
        expect(verse.textContent).toBe(
            '16For God so loved the world, that he gave his only begotten Son',
        );
        expect(verse.style.textShadow).toBe('0.02em 0.02em 0 #000000');
        expect(verse.style.lineHeight).toBe('1.8');
        expect(verse.style.textAlign).toBe('center');
        expect(getBackdropButton('Dark').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getBackdropButton('Dark').className).toBe(
            'bible-style-backdrop-on',
        );
        expect(getBackdropButton('Dark').title).toBe(
            'Light words for a dark background',
        );
        expect(getBackdropButton('Light').getAttribute('aria-pressed')).toBe(
            'false',
        );
        expect(getBackdropButton('Light').className).toBe('');
        // CSS written by hand is no look of the panel's own.
        expect(
            getLookTiles().filter(
                (tile) => tile.getAttribute('aria-pressed') === 'true',
            ),
        ).toEqual([]);
    });

    test('shows every look as a tile wearing itself, the one on the screen lit', async () => {
        const haloEffect = genBibleTextLookEffect('halo', 'dark');
        h.initialStyle = genBibleTextEffectPatch(haloEffect);
        await render(<BibleCustomStyleComp />);
        expect(getLookTiles().map((tile) => tile.title)).toEqual(
            LOOK_LABEL_LIST,
        );
        const lookList = genBibleTextLookList('dark');
        getLookTiles().forEach((tile, i) => {
            const sample = tile.querySelector<HTMLElement>(
                '.bible-style-look-sample',
            )!;
            expect(sample.textContent).toBe('Aa');
            expect(sample.className).toContain('bible-style-on-dark');
            expect(sample.style.textShadow).toBe(lookList[i].textShadow);
        });
        expect(
            getLookTiles()
                .filter((tile) => tile.getAttribute('aria-pressed') === 'true')
                .map((tile) => tile.title),
        ).toEqual(['Halo']);
        // The saved looks follow the app's own in the same grid, on the
        // same letters.
        const grid = container.querySelector('.bible-style-looks')!;
        expect(grid.getAttribute('aria-label')).toBe('Presets');
        expect(grid.lastElementChild?.getAttribute('title')).toBe('Saved look');
        expect(h.lastPresetTilesProps?.sample).toBe('Aa');
    });

    test('pressing a look puts it on the screen and lights its tile', async () => {
        h.initialStyle = { color: '#FFFFFF' };
        await render(<BibleCustomStyleComp />);
        expect(findLook('Normal').getAttribute('aria-pressed')).toBe('true');

        await press(findLook('Outline'));
        expect(h.applyStyle).toHaveBeenCalledTimes(1);
        expect(h.applyStyle).toHaveBeenLastCalledWith(
            genBibleTextEffectPatch(genBibleTextLookEffect('outline', 'dark')),
        );
        expect(findLook('Outline').getAttribute('aria-pressed')).toBe('true');
        expect(findLook('Normal').getAttribute('aria-pressed')).toBe('false');
    });

    test('the other background carries the look across instead of clearing it', async () => {
        h.initialStyle = genBibleTextEffectPatch(
            genBibleTextLookEffect('outline', 'dark'),
        );
        await render(<BibleCustomStyleComp />);
        const viewBefore = toBibleTextStyleView(h.initialStyle);

        await press(getBackdropButton('Light'));
        expect(h.applyStyle).toHaveBeenCalledTimes(1);
        const patch = h.applyStyle.mock.calls[0][0];
        expect(patch).toEqual(genBibleBackdropPatch(viewBefore, 'light'));
        expect(patch.color).toBe('#000000');
        expect(patch.effect).toEqual(
            genBibleTextLookEffect('outline', 'light'),
        );
        // The stage, the looks and the rows all move to the light side, and
        // the same look stays lit.
        expect(getStage().className).toContain('bible-style-on-light');
        expect(getBackdropButton('Light').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(findLook('Outline').getAttribute('aria-pressed')).toBe('true');
        expect(
            findLook('Outline').querySelector('.bible-style-look-sample')!
                .className,
        ).toContain('bible-style-on-light');
        expect(h.lastControlsProps?.backdrop).toBe('light');

        await press(getBackdropButton('Dark'));
        expect(h.applyStyle.mock.lastCall?.[0]).toMatchObject({
            color: '#FFFFFF',
            effect: genBibleTextLookEffect('outline', 'dark'),
        });
        expect(getStage().className).toContain('bible-style-on-dark');
    });

    test('CSS written by hand is left as written when the background flips', async () => {
        h.initialStyle = { color: '#FFFFFF', textShadow: '2px 2px 0 #000000' };
        await render(<BibleCustomStyleComp />);
        await press(getBackdropButton('Light'));
        expect(h.applyStyle).toHaveBeenLastCalledWith({ color: '#000000' });
    });

    test('the rows and the saved looks edit the same style as the stage', async () => {
        h.initialStyle = { color: '#FFFFFF', fontSize: 90 };
        await render(<BibleCustomStyleComp />);
        expect(h.lastControlsProps?.backdrop).toBe('dark');
        expect(h.lastControlsProps?.view).toEqual(
            toBibleTextStyleView(h.initialStyle),
        );
        expect(h.lastPresetTilesProps?.view).toBe(h.lastControlsProps?.view);
        await act(async () => {
            h.lastControlsProps?.applyStyle({ isBold: true });
        });
        expect(h.applyStyle).toHaveBeenLastCalledWith({ isBold: true });
        // Bold made in the rows is drawn on the stage at once.
        expect(
            container.querySelector<HTMLElement>('.bible-style-verse')!.style
                .fontWeight,
        ).toBe('700');
        expect(h.lastPresetTilesProps?.view.isBold).toBe(true);
    });
});

describe('the floating Bible/LongText Properties panel', () => {
    function getPortal() {
        return document.body.querySelector<HTMLElement>(
            '.app-floating-widget-portal',
        );
    }

    function getToggles() {
        return [
            ...container.querySelectorAll<HTMLButtonElement>(
                'button[aria-label="Bible/LongText Properties"]',
            ),
        ];
    }

    test('every toggle opens the one shared panel, and its close hides it again', async () => {
        await render(
            <>
                <BibleCustomStyleFloatingToggleComp />
                <BibleCustomStyleFloatingToggleComp />
                <BibleCustomStyleFloatingComp />
            </>,
        );
        expect(getToggles()).toHaveLength(2);
        for (const toggle of getToggles()) {
            expect(toggle.className).toBe('btn btn-sm btn-secondary');
            expect(toggle.title).toBe('Bible/LongText Properties');
        }
        expect(getPortal()).toBeNull();

        await press(getToggles()[1]);
        expect(h.settingStore.get(FLOATING_SETTING_NAME)).toBe('true');
        for (const toggle of getToggles()) {
            expect(toggle.className).toBe('btn btn-sm btn-info');
        }
        // One panel, however many buttons, and portaled to the body so a
        // footer that hides itself cannot take the panel with it.
        expect(
            document.body.querySelectorAll('.app-floating-widget-portal'),
        ).toHaveLength(1);
        const portal = getPortal()!;
        expect(container.contains(portal)).toBe(false);
        expect(portal.dataset.bsTheme).toBe('dark');
        const widget = portal.querySelector<HTMLElement>(
            '.mock-floating-widget',
        )!;
        expect(widget.dataset.title).toBe('Bible/LongText Properties');
        expect(widget.dataset.widgetName).toBe('Bible/LongText Properties');
        expect(widget.dataset.persistKey).toBe(
            'floating-widget-rect-bible-property',
        );
        expect(widget.dataset.width).toBe('440');
        expect(widget.dataset.height).toBe('640');
        // The style panel is loaded only now that it is asked for.
        await waitFor(
            () => portal.querySelector('.bible-style') !== null,
            'the lazy Bible/LongText Properties panel',
        );
        expect(portal.querySelector('.mock-loading')).toBeNull();

        await press(findButton('Close floating widget'));
        expect(h.settingStore.get(FLOATING_SETTING_NAME)).toBe('false');
        expect(getPortal()).toBeNull();
        for (const toggle of getToggles()) {
            expect(toggle.className).toBe('btn btn-sm btn-secondary');
        }
    });

    test('a panel left open comes back open, in the theme the app is in', async () => {
        h.settingStore.set(FLOATING_SETTING_NAME, 'true');
        h.theme = 'light';
        await render(
            <>
                <BibleCustomStyleFloatingToggleComp />
                <BibleCustomStyleFloatingComp />
            </>,
        );
        expect(getPortal()?.dataset.bsTheme).toBe('light');
        expect(getToggles()[0].className).toBe('btn btn-sm btn-info');

        // Pressing the lit toggle closes it.
        await press(getToggles()[0]);
        expect(h.settingStore.get(FLOATING_SETTING_NAME)).toBe('false');
        expect(getPortal()).toBeNull();
    });

    test('a toggle that is gone stops listening; the ones left still follow the store', async () => {
        const otherContainer = document.createElement('div');
        document.body.appendChild(otherContainer);
        const otherRoot = createRoot(otherContainer);
        await act(async () => {
            otherRoot.render(<BibleCustomStyleFloatingToggleComp />);
        });
        await render(<BibleCustomStyleFloatingToggleComp />);
        await act(async () => {
            otherRoot.unmount();
        });
        otherContainer.remove();

        await press(getToggles()[0]);
        expect(h.settingStore.get(FLOATING_SETTING_NAME)).toBe('true');
        expect(getToggles()[0].className).toBe('btn btn-sm btn-info');
    });
});
