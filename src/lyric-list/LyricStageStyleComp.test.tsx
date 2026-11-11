// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The REAL `lyricStageStyleHelpers` (sanitizing, one blob per stage) over an
// in-memory setting store, so what a commit writes can be read back exactly.
// `AppRangeComp` is a stub input that hands its `setValue` to the test.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    setSetting: vi.fn(),
    removeSetting: vi.fn(),
    // What the panel last handed its Presets row.
    presetsRow: null as any,
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: h.setSetting,
    removeSetting: h.removeSetting,
}));
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
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title, setValue, defaultSize }: any) =>
        createElement('input', {
            'data-range': title,
            'data-value': String(value),
            'data-max': String(defaultSize.max),
            readOnly: true,
            ref: (element: any) => {
                if (element !== null) {
                    element.setRangeValue = setValue;
                }
            },
        }),
}));

// The row has its own suite (`PresetsRowComp`); here only what the panel
// hands it, each of the app's looks a button a test can press.
vi.mock('../others/PresetsRowComp', () => ({
    default: (props: any) => {
        h.presetsRow = props;
        return createElement(
            'div',
            { 'data-presets': props.savedSettingName },
            ...props.builtIns.map((preset: any) => {
                return createElement(
                    'button',
                    {
                        key: preset.id,
                        type: 'button',
                        title: `Presets: ${preset.label}`,
                        onClick: preset.onPick,
                    },
                    preset.label,
                );
            }),
        );
    },
}));

import LyricStageStyleComp, { toReadableCss } from './LyricStageStyleComp';
import {
    LYRIC_STAGE_STYLE_DEFAULT,
    toLyricStageStyleSettingName,
    type LyricStageStyleType,
} from './lyricStageStyleHelpers';
import {
    genLyricStageStylePresetPatch,
    LYRIC_STAGE_STYLE_PRESET_LIST,
    toLyricStageStyleSavedPreset,
} from './lyricStageStylePresetHelpers';

const MARGIN_X = 'Horizontal Margin (%)';
const MARGIN_Y = 'Vertical Margin (%)';
const OPACITY = 'Background Opacity (%)';
const FONT = 'Extra Font Size';

let container: HTMLDivElement;
let root: Root;

function genPanel(
    stage: number,
    onChanged: () => void,
    genStageBuiltInCss?: (stage: number) => string,
) {
    return createElement(
        'div',
        { id: `panel-${stage}` },
        createElement(LyricStageStyleComp, {
            stage,
            onChanged,
            genStageBuiltInCss,
        }),
    );
}

// As a stage document writes it: indented for the template literal it is in.
const STAGE_CSS = `
                .ol-song-view__section-title {
                    display: none;
                }


                .ol-preview-line {
                    color: red;
                }
            `;
const READABLE_STAGE_CSS = [
    '.ol-song-view__section-title {',
    '    display: none;',
    '}',
    '',
    '.ol-preview-line {',
    '    color: red;',
    '}',
].join('\n');
const EDIT_COPY = "Edit a copy of the stage's CSS";

async function renderPanels(...panels: ReturnType<typeof genPanel>[]) {
    await act(async () => {
        root.render(createElement('div', null, ...panels));
    });
}

function getPanel(stage: number) {
    return container.querySelector(`#panel-${stage}`)!;
}

function getRange(stage: number, title: string) {
    return getPanel(stage).querySelector<HTMLInputElement>(
        `[data-range="${title}"]`,
    )!;
}

async function slide(stage: number, title: string, value: number) {
    await act(async () => {
        (getRange(stage, title) as any).setRangeValue(value);
    });
}

function getButtonByTitle(stage: number, title: string) {
    return getPanel(stage).querySelector<HTMLButtonElement>(
        `button[title="${title}"]`,
    )!;
}

function getLinkButton(stage: number) {
    return getButtonByTitle(stage, 'Link horizontal and vertical margin');
}

// The lit cells of the Position pad: always exactly one.
function getLitCellTitles(stage: number) {
    return Array.from(
        getPanel(stage).querySelectorAll<HTMLButtonElement>(
            '.fg-pad-cell[aria-pressed="true"]',
        ),
    ).map((cell) => cell.title);
}

async function press(button: HTMLButtonElement) {
    await act(async () => {
        button.click();
    });
}

function getThemeButton(stage: number, label: 'Light' | 'Dark') {
    return Array.from(getPanel(stage).querySelectorAll('button')).find(
        (button) => button.textContent === label,
    )!;
}

function getCssBox(stage: number) {
    return getPanel(stage).querySelector('textarea')!;
}

async function typeCss(stage: number, text: string) {
    const textarea = getCssBox(stage);
    const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        valueSetter.call(textarea, text);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

function lastWritten(stage: number) {
    const calls = h.setSetting.mock.calls.filter(([key]) => {
        return key === toLyricStageStyleSettingName(stage);
    });
    return calls.length === 0 ? null : JSON.parse(calls.at(-1)![1]);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settings.clear();
    h.setSetting.mockImplementation((key: string, value: string) => {
        h.settings.set(key, value);
    });
    h.removeSetting.mockImplementation((key: string) => {
        h.settings.delete(key);
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('opening', () => {
    test('shows the saved style of its own stage', async () => {
        h.settings.set(
            toLyricStageStyleSettingName(2),
            JSON.stringify({
                marginHorizontalPercentage: 5,
                marginVerticalPercentage: 3,
                isMarginLinked: false,
                boxVerticalAlignment: 'end',
                boxHorizontalAlignment: 'center',
                backgroundAlphaPercentage: 80,
                extraFontSize: 60,
                theme: 'dark',
                customCss: '.ol-preview-line { color: red; }',
            }),
        );
        await renderPanels(genPanel(2, vi.fn()));

        expect(getRange(2, MARGIN_X).dataset.value).toBe('5');
        expect(getRange(2, MARGIN_Y).dataset.value).toBe('3');
        expect(getLinkButton(2).getAttribute('aria-pressed')).toBe('false');
        expect(
            getButtonByTitle(2, 'Bottom center').getAttribute('aria-pressed'),
        ).toBe('true');
        expect(getLitCellTitles(2)).toEqual(['Bottom center']);
        expect(getRange(2, OPACITY).dataset.value).toBe('80');
        expect(getRange(2, FONT).dataset.value).toBe('60');
        // The slider ranges are the record's own clamps.
        expect(getRange(2, MARGIN_X).dataset.max).toBe('99');
        expect(getRange(2, MARGIN_Y).dataset.max).toBe('99');
        expect(getThemeButton(2, 'Dark').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getThemeButton(2, 'Dark').className).toBe('btn btn-sm btn-info');
        expect(getThemeButton(2, 'Light').className).toBe(
            'btn btn-sm btn-outline-info',
        );
        expect(getCssBox(2).value).toBe('.ol-preview-line { color: red; }');
    });

    test('a stage never customized opens on the defaults', async () => {
        await renderPanels(genPanel(0, vi.fn()));
        expect(getRange(0, MARGIN_X).dataset.value).toBe('2');
        expect(getRange(0, MARGIN_Y).dataset.value).toBe('2');
        expect(getLinkButton(0).getAttribute('aria-pressed')).toBe('true');
        // Middle center, lit from the start.
        expect(getLitCellTitles(0)).toEqual(['Middle center']);
        expect(getRange(0, OPACITY).dataset.value).toBe('50');
        expect(getRange(0, FONT).dataset.value).toBe('45');
        expect(getThemeButton(0, 'Light').getAttribute('aria-pressed')).toBe(
            'true',
        );
    });
});

describe('committing', () => {
    test('a slider drag is written ONCE, after it stops, with its last value', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));

        await slide(0, MARGIN_X, 2);
        await advance(100);
        await slide(0, MARGIN_X, 3);
        await advance(100);
        await slide(0, OPACITY, 70);
        // The controls follow the drag at once...
        expect(getRange(0, MARGIN_X).dataset.value).toBe('3');
        await advance(499);
        // ...the write and the whole-song re-render do not.
        expect(h.setSetting).not.toHaveBeenCalled();
        expect(onChanged).not.toHaveBeenCalled();

        await advance(1);
        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(lastWritten(0)).toMatchObject({
            marginHorizontalPercentage: 3,
            // Linked by default: the other side followed in the same write.
            marginVerticalPercentage: 3,
            backgroundAlphaPercentage: 70,
        });
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('the trailing commit tells the CURRENT onChanged', async () => {
        const firstOnChanged = vi.fn();
        const secondOnChanged = vi.fn();
        await renderPanels(genPanel(0, firstOnChanged));
        await slide(0, FONT, 90);
        await renderPanels(genPanel(0, secondOnChanged));
        await advance(500);

        expect(lastWritten(0).extraFontSize).toBe(90);
        expect(firstOnChanged).not.toHaveBeenCalled();
        expect(secondOnChanged).toHaveBeenCalledTimes(1);
    });

    test('a theme pick is written at once', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(1, onChanged));
        await act(async () => {
            getThemeButton(1, 'Dark').click();
        });

        expect(lastWritten(1).theme).toBe('dark');
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getThemeButton(1, 'Dark').getAttribute('aria-pressed')).toBe(
            'true',
        );
    });

    test('the css box waits out a pause, and a blur commits it at once', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));

        await typeCss(0, '.a { color: red; }');
        expect(getCssBox(0).value).toBe('.a { color: red; }');
        await advance(500);
        // Slower than a slider: each commit re-renders the whole song.
        expect(h.setSetting).not.toHaveBeenCalled();
        await advance(1000);
        expect(lastWritten(0).customCss).toBe('.a { color: red; }');

        await typeCss(0, '.b { color: blue; }');
        await act(async () => {
            getCssBox(0).dispatchEvent(
                new FocusEvent('focusout', { bubbles: true }),
            );
        });
        expect(lastWritten(0).customCss).toBe('.b { color: blue; }');
        expect(onChanged).toHaveBeenCalledTimes(2);
        // The blur took the pending write with it; nothing fires later.
        await advance(2000);
        expect(onChanged).toHaveBeenCalledTimes(2);
    });
});

describe('margin', () => {
    test('linked, either slider moves both', async () => {
        await renderPanels(genPanel(0, vi.fn()));

        await slide(0, MARGIN_Y, 7);
        expect(getRange(0, MARGIN_X).dataset.value).toBe('7');
        expect(getRange(0, MARGIN_Y).dataset.value).toBe('7');
        await advance(500);
        expect(lastWritten(0)).toMatchObject({
            marginHorizontalPercentage: 7,
            marginVerticalPercentage: 7,
            isMarginLinked: true,
        });
    });

    test('unlinked, each slider moves its own side alone', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));

        await press(getLinkButton(0));
        // The toggle is a press, so it is written at once.
        expect(lastWritten(0).isMarginLinked).toBe(false);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getLinkButton(0).getAttribute('aria-pressed')).toBe('false');

        await slide(0, MARGIN_X, 9);
        await slide(0, MARGIN_Y, 2);
        await advance(500);
        expect(lastWritten(0)).toMatchObject({
            marginHorizontalPercentage: 9,
            marginVerticalPercentage: 2,
        });
    });

    test('linking again evens the vertical out to the horizontal', async () => {
        h.settings.set(
            toLyricStageStyleSettingName(0),
            JSON.stringify({
                marginHorizontalPercentage: 6,
                marginVerticalPercentage: 2,
                isMarginLinked: false,
            }),
        );
        await renderPanels(genPanel(0, vi.fn()));

        await press(getLinkButton(0));
        expect(getRange(0, MARGIN_Y).dataset.value).toBe('6');
        expect(lastWritten(0)).toMatchObject({
            marginHorizontalPercentage: 6,
            marginVerticalPercentage: 6,
            isMarginLinked: true,
        });
    });

    test('a record from before the split opens on its one side doubled, linked', async () => {
        h.settings.set(
            toLyricStageStyleSettingName(0),
            JSON.stringify({ paddingPercentage: 4 }),
        );
        await renderPanels(genPanel(0, vi.fn()));
        expect(getRange(0, MARGIN_X).dataset.value).toBe('8');
        expect(getRange(0, MARGIN_Y).dataset.value).toBe('8');
        expect(getLinkButton(0).getAttribute('aria-pressed')).toBe('true');
    });
});

describe('box position', () => {
    test('a cell is written at once and lights only itself', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));

        await press(getButtonByTitle(0, 'Bottom center'));
        expect(lastWritten(0)).toMatchObject({
            boxVerticalAlignment: 'end',
            boxHorizontalAlignment: 'center',
        });
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(
            getButtonByTitle(0, 'Bottom center').getAttribute('aria-pressed'),
        ).toBe('true');
        expect(getLitCellTitles(0)).toEqual(['Bottom center']);

        await press(getButtonByTitle(0, 'Top left'));
        expect(lastWritten(0)).toMatchObject({
            boxVerticalAlignment: 'start',
            boxHorizontalAlignment: 'left',
        });
        expect(
            getButtonByTitle(0, 'Bottom center').getAttribute('aria-pressed'),
        ).toBe('false');
    });

    test('the lit cell stays lit, and pressing it again writes nothing', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));
        await press(getButtonByTitle(0, 'Middle right'));
        await press(getButtonByTitle(0, 'Middle right'));

        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getLitCellTitles(0)).toEqual(['Middle right']);
    });
});

describe('custom css placeholder', () => {
    test('reads like a style sheet: no template indent, no blank runs', () => {
        expect(toReadableCss(STAGE_CSS)).toBe(READABLE_STAGE_CSS);
        expect(toReadableCss('')).toBe('');
        expect(toReadableCss('a {}\r\n  b {}')).toBe('a {}\n  b {}');
    });

    test("the box's placeholder is the css its stage applies", async () => {
        const genStageBuiltInCss = vi.fn(() => STAGE_CSS);
        await renderPanels(genPanel(2, vi.fn(), genStageBuiltInCss));

        expect(genStageBuiltInCss).toHaveBeenCalledWith(2);
        expect(getCssBox(2).placeholder).toBe(READABLE_STAGE_CSS);
        expect(getCssBox(2).value).toBe('');
        // Read once, not once per drag.
        await slide(2, OPACITY, 30);
        expect(genStageBuiltInCss).toHaveBeenCalledTimes(1);
    });

    test('with no stage document the box shows the example', async () => {
        await renderPanels(genPanel(0, vi.fn()));
        expect(getCssBox(0).placeholder).toBe(
            '.ol-preview-line { letter-spacing: 0.02em; }',
        );
        expect(getButtonByTitle(0, EDIT_COPY)).toBeNull();
    });

    test('the pencil makes the placeholder the text, written at once', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged, () => STAGE_CSS));

        await press(getButtonByTitle(0, EDIT_COPY));
        expect(getCssBox(0).value).toBe(READABLE_STAGE_CSS);
        expect(lastWritten(0).customCss).toBe(READABLE_STAGE_CSS);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(getCssBox(0));
        // Filled, the box has nothing to overwrite with: the pencil goes.
        expect(getButtonByTitle(0, EDIT_COPY)).toBeNull();
    });

    test('a box that already holds rules offers no pencil', async () => {
        h.settings.set(
            toLyricStageStyleSettingName(0),
            JSON.stringify({ customCss: '.mine { color: blue }' }),
        );
        await renderPanels(genPanel(0, vi.fn(), () => STAGE_CSS));
        expect(getButtonByTitle(0, EDIT_COPY)).toBeNull();
    });
});

describe('reset', () => {
    test('deletes the record and cancels a drag still in flight', async () => {
        h.settings.set(
            toLyricStageStyleSettingName(3),
            JSON.stringify({
                paddingPercentage: 8,
                boxVerticalAlignment: 'end',
                boxHorizontalAlignment: 'left',
                theme: 'dark',
            }),
        );
        const onChanged = vi.fn();
        await renderPanels(genPanel(3, onChanged));

        await slide(3, MARGIN_X, 12);
        await act(async () => {
            Array.from(getPanel(3).querySelectorAll('button'))
                .find((button) => button.title === 'Reset Stage Style')!
                .click();
        });

        expect(h.removeSetting).toHaveBeenCalledWith('lyric-stage-style-3');
        expect(h.settings.has('lyric-stage-style-3')).toBe(false);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getRange(3, MARGIN_X).dataset.value).toBe('2');
        expect(getRange(3, MARGIN_Y).dataset.value).toBe('2');
        expect(getLitCellTitles(3)).toEqual(['Middle center']);
        expect(getThemeButton(3, 'Light').getAttribute('aria-pressed')).toBe(
            'true',
        );

        // The drag's pending write must not resurrect the record.
        await advance(1000);
        expect(h.setSetting).not.toHaveBeenCalled();
        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});

describe('presets', () => {
    // A stage somebody styled by hand: a theme and rules of their own.
    const STYLED: LyricStageStyleType = {
        marginHorizontalPercentage: 12,
        marginVerticalPercentage: 30,
        isMarginLinked: false,
        boxVerticalAlignment: 'end',
        boxHorizontalAlignment: 'right',
        backgroundAlphaPercentage: 80,
        extraFontSize: 10,
        theme: 'dark',
        customCss: '.ol-preview-line { color: gold; }',
    };

    function getPresetButton(stage: number, label: string) {
        return getButtonByTitle(stage, `Presets: ${label}`);
    }

    function findLook(id: string) {
        return LYRIC_STAGE_STYLE_PRESET_LIST.find((preset) => {
            return preset.id === id;
        })!;
    }

    test('the row offers the four stage looks over one list for every stage', async () => {
        await renderPanels(genPanel(2, vi.fn()));
        expect(h.presetsRow.savedSettingName).toBe(
            'lyric-stage-style-saved-presets',
        );
        expect(h.presetsRow.toSavedPreset).toBe(toLyricStageStyleSavedPreset);
        expect(
            h.presetsRow.builtIns.map((preset: any) => {
                return [preset.id, preset.label];
            }),
        ).toEqual([
            ['full-screen', 'Full Screen'],
            ['center', 'Center'],
            ['top-banner', 'Top Banner'],
            ['bottom-banner', 'Bottom Banner'],
        ]);

        await act(async () => {
            root.render(genPanel(4, vi.fn()));
        });
        expect(h.presetsRow.savedSettingName).toBe(
            'lyric-stage-style-saved-presets',
        );
        // Opening a panel writes nothing.
        expect(h.setSetting).not.toHaveBeenCalled();
    });

    test('a look is written at once and moves only the layout', async () => {
        h.settings.set(toLyricStageStyleSettingName(2), JSON.stringify(STYLED));
        const onChanged = vi.fn();
        await renderPanels(genPanel(2, onChanged));

        await press(getPresetButton(2, 'Bottom Banner'));
        // No timer: a press is not a drag.
        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(lastWritten(2)).toEqual({
            ...STYLED,
            ...genLyricStageStylePresetPatch(findLook('bottom-banner')),
        });
        // The stage's own theme and rules are still its own.
        expect(lastWritten(2).theme).toBe('dark');
        expect(lastWritten(2).customCss).toBe(STYLED.customCss);
        expect(onChanged).toHaveBeenCalledTimes(1);
        // The controls show the look.
        expect(getRange(2, MARGIN_Y).dataset.value).toBe('70');
        expect(getLinkButton(2).getAttribute('aria-pressed')).toBe('false');
        expect(getLitCellTitles(2)).toEqual(['Bottom center']);
        expect(getCssBox(2).value).toBe(STYLED.customCss);
        expect(getThemeButton(2, 'Dark').getAttribute('aria-pressed')).toBe(
            'true',
        );
        // Nothing is left pending to write it a second time.
        await advance(2000);
        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('a look takes a drag still in flight with it, its own layout winning', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));
        await slide(0, OPACITY, 20);
        await slide(0, FONT, 120);

        await press(getPresetButton(0, 'Full Screen'));
        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(lastWritten(0)).toEqual({
            ...LYRIC_STAGE_STYLE_DEFAULT,
            marginHorizontalPercentage: 0,
            marginVerticalPercentage: 0,
        });
        // The drag's trailing write never comes back over it.
        await advance(1000);
        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getRange(0, OPACITY).dataset.value).toBe('50');
    });

    test('css still being typed survives a look', async () => {
        await renderPanels(genPanel(0, vi.fn()));
        await typeCss(0, '.typed { color: red; }');

        await press(getPresetButton(0, 'Top Banner'));
        expect(lastWritten(0)).toMatchObject({
            customCss: '.typed { color: red; }',
            boxVerticalAlignment: 'start',
        });
        await advance(2000);
        expect(lastWritten(0)).toMatchObject({
            customCss: '.typed { color: red; }',
            boxVerticalAlignment: 'start',
        });
        expect(getCssBox(0).value).toBe('.typed { color: red; }');
    });

    test('Save keeps the whole style in front, a drag not yet written included', async () => {
        h.settings.set(toLyricStageStyleSettingName(1), JSON.stringify(STYLED));
        await renderPanels(genPanel(1, vi.fn()));
        await slide(1, FONT, 90);

        const current = h.presetsRow.readCurrent();
        expect(current).toEqual({ values: { ...STYLED, extraFontSize: 90 } });
        // A copy: what Save keeps cannot change the panel, nor the panel it.
        current.values.theme = 'light';
        await advance(500);
        expect(lastWritten(1)).toEqual({ ...STYLED, extraFontSize: 90 });
        expect(h.presetsRow.readCurrent()).toEqual({
            values: { ...STYLED, extraFontSize: 90 },
        });
    });

    test('a saved look puts the whole record back at once', async () => {
        const onChanged = vi.fn();
        await renderPanels(genPanel(0, onChanged));
        const saved = { id: 'p1', name: 'Mine', values: { ...STYLED } };

        await act(async () => {
            h.presetsRow.onSavedPick(saved);
        });
        expect(h.setSetting).toHaveBeenCalledTimes(1);
        expect(lastWritten(0)).toEqual(STYLED);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getRange(0, MARGIN_X).dataset.value).toBe('12');
        expect(getRange(0, MARGIN_Y).dataset.value).toBe('30');
        expect(getLinkButton(0).getAttribute('aria-pressed')).toBe('false');
        expect(getLitCellTitles(0)).toEqual(['Bottom right']);
        expect(getRange(0, OPACITY).dataset.value).toBe('80');
        expect(getRange(0, FONT).dataset.value).toBe('10');
        expect(getThemeButton(0, 'Dark').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getCssBox(0).value).toBe(STYLED.customCss);

        // The panel works on a copy: a drag afterwards leaves the list alone.
        await slide(0, OPACITY, 10);
        await advance(500);
        expect(lastWritten(0).backgroundAlphaPercentage).toBe(10);
        expect(saved.values).toEqual(STYLED);
    });
});

test('two open panels keep their own timers, so neither write is lost', async () => {
    // A module-level timer here would let the second drag `clearTimeout` the
    // first panel's pending write — the multi-instance debounce bug class.
    const onChangedA = vi.fn();
    const onChangedB = vi.fn();
    await renderPanels(genPanel(0, onChangedA), genPanel(1, onChangedB));

    await slide(0, MARGIN_X, 6);
    await advance(200);
    await slide(1, MARGIN_X, 9);
    await advance(500);

    expect(lastWritten(0).marginHorizontalPercentage).toBe(6);
    expect(lastWritten(1).marginHorizontalPercentage).toBe(9);
    expect(onChangedA).toHaveBeenCalledTimes(1);
    expect(onChangedB).toHaveBeenCalledTimes(1);
});
