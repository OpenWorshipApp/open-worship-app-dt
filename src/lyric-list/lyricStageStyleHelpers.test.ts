import { beforeEach, describe, expect, test, vi } from 'vitest';

// `settingHelpers` is mocked WHOLESALE so this stays a node-env test: the real
// module reaches `appProvider`, which touches `document` at module scope and
// would die on import here.
const { getSettingMock, setSettingMock, removeSettingMock } = vi.hoisted(
    () => ({
        getSettingMock: vi.fn(),
        setSettingMock: vi.fn(),
        removeSettingMock: vi.fn(),
    }),
);

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
    removeSetting: removeSettingMock,
}));

import {
    getLyricStageStyle,
    LYRIC_STAGE_STYLE_DEFAULT,
    resetLyricStageStyle,
    setLyricStageStyle,
    toLyricStageStyleSettingName,
    toOpenLyricBackgroundAlpha,
    type LyricStageStyleType,
} from './lyricStageStyleHelpers';

beforeEach(() => {
    getSettingMock.mockReset();
    setSettingMock.mockReset();
    removeSettingMock.mockReset();
    getSettingMock.mockReturnValue(null);
    // The parse memo is module state; clearing every stage it could hold keeps
    // the cases below independent of each other's writes.
    for (const stage of [0, 1, 2]) {
        resetLyricStageStyle(stage);
    }
    removeSettingMock.mockReset();
});

describe('toLyricStageStyleSettingName', () => {
    test('is unprefixed, so the screen and the presenter read one key', () => {
        expect(toLyricStageStyleSettingName(0)).toBe('lyric-stage-style-0');
        expect(toLyricStageStyleSettingName(1)).toBe('lyric-stage-style-1');
    });
});

describe('getLyricStageStyle', () => {
    test('answers the pre-feature hard-coded values when nothing is saved', () => {
        getSettingMock.mockReturnValue(null);
        expect(getLyricStageStyle(0)).toEqual({
            paddingPercentage: 1,
            backgroundAlphaPercentage: 50,
            extraFontSize: 45,
            theme: 'light',
            customCss: '',
        });
    });

    test('a blank setting is not a customization', () => {
        getSettingMock.mockReturnValue('   ');
        expect(getLyricStageStyle(0)).toEqual(LYRIC_STAGE_STYLE_DEFAULT);
    });

    test.each([['}{ not json'], ['null'], ['[]'], ['"a string"'], ['7']])(
        'unusable stored value %s falls back without throwing',
        (raw) => {
            getSettingMock.mockReturnValue(raw);
            expect(() => getLyricStageStyle(0)).not.toThrow();
            expect(getLyricStageStyle(0)).toEqual(LYRIC_STAGE_STYLE_DEFAULT);
        },
    );

    test('clamps and rounds each numeric field into its own range', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify({
                paddingPercentage: 999,
                backgroundAlphaPercentage: -4,
                extraFontSize: 12.6,
                theme: 'dark',
                customCss: '.a { color: red }',
            }),
        );
        expect(getLyricStageStyle(0)).toEqual({
            paddingPercentage: 20,
            backgroundAlphaPercentage: 0,
            extraFontSize: 13,
            theme: 'dark',
            customCss: '.a { color: red }',
        });
    });

    test('a bad field falls back on its own, keeping its neighbours', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify({
                paddingPercentage: 'nope',
                backgroundAlphaPercentage: Number.NaN,
                extraFontSize: 90,
                theme: 'rainbow',
                customCss: 42,
            }),
        );
        expect(getLyricStageStyle(0)).toEqual({
            paddingPercentage: 1,
            backgroundAlphaPercentage: 50,
            extraFontSize: 90,
            theme: 'light',
            customCss: '',
        });
    });

    test('reads the key of the stage it was asked for', () => {
        getSettingMock.mockReturnValue(null);
        getLyricStageStyle(1);
        expect(getSettingMock).toHaveBeenCalledWith('lyric-stage-style-1');
    });

    test('hands back a copy, so a caller cannot mutate the memo', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify({ ...LYRIC_STAGE_STYLE_DEFAULT, extraFontSize: 60 }),
        );
        const first = getLyricStageStyle(0);
        first.extraFontSize = 999;
        expect(getLyricStageStyle(0).extraFontSize).toBe(60);
    });

    test('the memo keys on the stored string, so another window is seen', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify({ ...LYRIC_STAGE_STYLE_DEFAULT, extraFontSize: 60 }),
        );
        expect(getLyricStageStyle(0).extraFontSize).toBe(60);
        getSettingMock.mockReturnValue(
            JSON.stringify({ ...LYRIC_STAGE_STYLE_DEFAULT, extraFontSize: 70 }),
        );
        expect(getLyricStageStyle(0).extraFontSize).toBe(70);
    });
});

describe('setLyricStageStyle', () => {
    const style: LyricStageStyleType = {
        paddingPercentage: 4,
        backgroundAlphaPercentage: 80,
        extraFontSize: 100,
        theme: 'dark',
        customCss: '.ol-preview-line { color: red }',
    };

    test('writes ONE blob under the stage key', () => {
        setLyricStageStyle(1, style);
        expect(setSettingMock).toHaveBeenCalledTimes(1);
        expect(setSettingMock).toHaveBeenCalledWith(
            'lyric-stage-style-1',
            JSON.stringify(style),
        );
    });

    test('sanitizes on the way in, so a bad value cannot reach the file', () => {
        setLyricStageStyle(0, { ...style, paddingPercentage: 999 });
        const written = JSON.parse(setSettingMock.mock.calls[0][1]);
        expect(written.paddingPercentage).toBe(20);
    });

    test('stages are independent', () => {
        setLyricStageStyle(1, style);
        getSettingMock.mockReturnValue(null);
        expect(getLyricStageStyle(0)).toEqual(LYRIC_STAGE_STYLE_DEFAULT);
    });
});

describe('resetLyricStageStyle', () => {
    test('drops the file rather than writing a defaults blob', () => {
        resetLyricStageStyle(1);
        expect(removeSettingMock).toHaveBeenCalledWith('lyric-stage-style-1');
        expect(setSettingMock).not.toHaveBeenCalled();
    });

    test('clears the memo so the defaults come straight back', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify({ ...LYRIC_STAGE_STYLE_DEFAULT, extraFontSize: 60 }),
        );
        expect(getLyricStageStyle(0).extraFontSize).toBe(60);
        resetLyricStageStyle(0);
        getSettingMock.mockReturnValue(null);
        expect(getLyricStageStyle(0)).toEqual(LYRIC_STAGE_STYLE_DEFAULT);
    });
});

describe('toOpenLyricBackgroundAlpha', () => {
    test.each([
        [0, 0],
        [50, 0.5],
        [100, 1],
    ])('%i%% becomes %f', (percentage, expected) => {
        expect(
            toOpenLyricBackgroundAlpha({
                ...LYRIC_STAGE_STYLE_DEFAULT,
                backgroundAlphaPercentage: percentage,
            }),
        ).toBe(expected);
    });
});
