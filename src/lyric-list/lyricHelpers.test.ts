// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

// `lyricHelpers` pulls the whole open-lyric + FileSource + language stack in at
// module load and none of it participates in resolving a stage to its document,
// so it is all stubbed. The two stage classes are stubbed down to the only thing
// the resolution uses: `getStageInstance`, cached on the file path AND the
// stage, which is what `LyricAppDocumentStageAbstract.getStageInstance` does for
// real (`_getInstance` keys on the class name plus the path, and the stage goes
// in as the suffix — which is what gives a stage past the layout list an
// identity of its own). `initOpenLyric` runs against the same stubs: what it is
// tested for is the order it awaits things in.
const mocks = vi.hoisted(() => {
    const genStageClass = (layoutStage: number) => {
        const instances = new Map<string, any>();
        return {
            layoutStage,
            getStageInstance: vi.fn((filePath: string, stage: number) => {
                const cacheKey = `${filePath}:${stage}`;
                if (!instances.has(cacheKey)) {
                    instances.set(cacheKey, { layoutStage, stage, filePath });
                }
                return instances.get(cacheKey);
            }),
        };
    };
    return {
        stage0: genStageClass(0),
        stage1: genStageClass(1),
        stage2: genStageClass(2),
        stage3: genStageClass(3),
        stage4: genStageClass(4),
        stage5: genStageClass(5),
        getContentMock: vi.fn(async () => ''),
        initAllLangCssMock: vi.fn(async (): Promise<any[]> => []),
        addPluginMock: vi.fn(),
    };
});

vi.mock('open-lyric', () => ({
    OpenLyric: class {
        addPlugin = mocks.addPluginMock;
    },
}));
vi.mock('open-lyric-plugin-player', () => ({
    OpenLyricPluginPlayer: class {},
}));
vi.mock('./Lyric', () => ({
    default: {
        getInstance: vi.fn(() => ({ getContent: mocks.getContentMock })),
    },
}));
vi.mock('./LyricAppDocumentStage0', () => ({ default: mocks.stage0 }));
vi.mock('./LyricAppDocumentStage1', () => ({ default: mocks.stage1 }));
vi.mock('./LyricAppDocumentStage2', () => ({ default: mocks.stage2 }));
vi.mock('./LyricAppDocumentStage3', () => ({ default: mocks.stage3 }));
vi.mock('./LyricAppDocumentStage4', () => ({ default: mocks.stage4 }));
vi.mock('./LyricAppDocumentStage5', () => ({ default: mocks.stage5 }));
vi.mock('../lang/langHelpers', () => ({
    genOpenLyricFontFaces: vi.fn(),
    initAllLangCss: mocks.initAllLangCssMock,
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
    },
}));
vi.mock('../helper/FileSource', () => ({ default: { getInstance: vi.fn() } }));
vi.mock('../others/themeHelpers', () => ({
    checkIsDarkMode: vi.fn(() => false),
}));
vi.mock('./lyricPrintHelpers', () => ({
    installOpenLyricPrintPopupHandler: vi.fn(),
}));

import {
    applyOpenLyricTheme,
    checkIsValidLyricStage,
    DEFAULT_OPEN_LYRIC_FONT_SIZE,
    getLyricAppDocumentStageByStage,
    getOpenLyricFontSetting,
    initOpenLyric,
} from './lyricHelpers';
import { OpenLyricPluginPlayer } from 'open-lyric-plugin-player';
import { checkIsDarkMode } from '../others/themeHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import FileSource from '../helper/FileSource';
import { genOpenLyricFontFaces } from '../lang/langHelpers';

const FILE_PATH = '/songs/aa3.owl';

describe('checkIsValidLyricStage', () => {
    test('accepts every non-negative integer, and nothing else', () => {
        expect(checkIsValidLyricStage(0)).toBe(true);
        expect(checkIsValidLyricStage(1)).toBe(true);
        // Past the layout list on purpose: a screen's `St:` increments without
        // a ceiling, so the previewer has to be able to show what a screen can
        // already be set to.
        expect(checkIsValidLyricStage(7)).toBe(true);
        expect(checkIsValidLyricStage(-1)).toBe(false);
        expect(checkIsValidLyricStage(1.5)).toBe(false);
        expect(checkIsValidLyricStage(NaN)).toBe(false);
    });
});

describe('getLyricAppDocumentStageByStage', () => {
    test('each stage resolves to a document of its own', () => {
        const [stage0, document0] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            0,
        );
        const [stage1, document1] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            1,
        );
        expect(stage0).toBe(0);
        expect(stage1).toBe(1);
        expect(document0).not.toBe(document1);
    });

    test('the same stage and path resolve to the same cached instance', () => {
        const [, first] = getLyricAppDocumentStageByStage(FILE_PATH, 1);
        const [, second] = getLyricAppDocumentStageByStage(FILE_PATH, 1);
        expect(first).toBe(second);
    });

    // Stages 2 and 3 are the singers' look-ahead layouts (current section plus
    // the next one or two), each a layout of its own.
    test('stages 4 and 5 render with their own layouts', () => {
        [4, 5].forEach((stage) => {
            const [resolvedStage, document] = getLyricAppDocumentStageByStage(
                FILE_PATH,
                stage,
            );
            expect(resolvedStage).toBe(stage);
            expect((document as any).layoutStage).toBe(stage);
        });
    });

    test('stages 2 and 3 render with their own look-ahead layouts', () => {
        const [stage2, document2] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            2,
        );
        const [stage3, document3] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            3,
        );
        expect(stage2).toBe(2);
        expect(stage3).toBe(3);
        expect((document2 as any).layoutStage).toBe(2);
        expect((document3 as any).layoutStage).toBe(3);
    });

    // The regression, and the reason the clamp went. A stage past the layout
    // list used to fall through to `LyricAppDocumentStage1` while still echoing
    // back the stage that was ASKED for, so the caller believed it held a
    // distinct document when it held stage 1's own cached instance — the Stage
    // Previewer trusted that number for its chip label and rendered a
    // byte-identical second pane. A stage past the list now keeps its number
    // and gets an instance of its own. It borrows the STAGE-1 layout, not the
    // last one: a screen set to `St: 6` looked like stage 1 before the
    // look-ahead layouts existed and must not change under a volunteer.
    test('a stage past the layout list keeps its number and its own instance', () => {
        const [stage6, document6] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            6,
        );
        const [stage7, document7] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            7,
        );
        const [, stage1Document] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            1,
        );
        expect(stage6).toBe(6);
        expect(stage7).toBe(7);
        expect(document6).not.toBe(stage1Document);
        expect(document6).not.toBe(document7);
        // Borrowed layout, own number.
        expect((document6 as any).layoutStage).toBe(1);
        expect(document6.stage).toBe(6);
    });

    test('a negative or non-finite stage clamps to the base stage', () => {
        expect(getLyricAppDocumentStageByStage(FILE_PATH, -3)[0]).toBe(0);
        expect(getLyricAppDocumentStageByStage(FILE_PATH, NaN)[0]).toBe(0);
    });
});

describe('initOpenLyric', () => {
    // The overprint regression. open-lyric freezes a slide's lines into pixel
    // boxes measured in whatever faces the window has registered, and this used
    // to fetch the language list WITHOUT registering any: a song set in
    // `app-Battambang` was measured in the fallback font, then drawn in
    // Battambang, and its long lines wrapped over the next one.
    test('registers every language font before handing the previewer out', async () => {
        let isRegistered = false;
        mocks.initAllLangCssMock.mockImplementationOnce(async () => {
            await Promise.resolve();
            isRegistered = true;
            return [];
        });
        const openLyricPreviewer = await initOpenLyric(FILE_PATH, true);
        expect(mocks.initAllLangCssMock).toHaveBeenCalledTimes(1);
        expect(isRegistered).toBe(true);
        expect(openLyricPreviewer).toBeDefined();
        expect(mocks.addPluginMock).toHaveBeenCalledExactlyOnceWith(
            'player',
            expect.any(OpenLyricPluginPlayer),
        );
    });
});

describe('applyOpenLyricTheme', () => {
    test('follows the app theme, explicit or read off the page', () => {
        const target = { theme: 'light' as any };
        applyOpenLyricTheme(target, true);
        expect(target.theme).toBe('dark-bs');
        applyOpenLyricTheme(target, false);
        expect(target.theme).toBe('light-bs');

        vi.mocked(checkIsDarkMode).mockReturnValue(true);
        applyOpenLyricTheme(target);
        expect(target.theme).toBe('dark-bs');
    });

    test('a previewer that is not ready yet is left alone', () => {
        expect(() => applyOpenLyricTheme(null, true)).not.toThrow();
        expect(checkIsDarkMode).not.toHaveBeenCalled();
    });
});

describe('getOpenLyricFontSetting', () => {
    test('reads the size and face the previewer saved', () => {
        vi.mocked(appLocalStorage.getItem).mockReturnValue(
            JSON.stringify({ fontSize: 61, fontFamily: 'app-Battambang' }),
        );
        expect(getOpenLyricFontSetting()).toEqual({
            fontSize: 61,
            fontFamily: 'app-Battambang',
        });
        expect(appLocalStorage.getItem).toHaveBeenCalledWith(
            'open-lyric-previewer-setting',
        );
    });

    test.each([
        ['nothing saved', null],
        ['a corrupt file', '{ not json'],
        ['a value that is not an object', '61'],
    ])('falls back to the 16px default on %s', (_label, raw) => {
        vi.mocked(appLocalStorage.getItem).mockReturnValue(raw);
        expect(getOpenLyricFontSetting()).toEqual({
            fontSize: DEFAULT_OPEN_LYRIC_FONT_SIZE,
            fontFamily: undefined,
        });
    });
});

describe('initOpenLyric wiring', () => {
    test('the previewer reads and writes the ONE shared setting', async () => {
        const fileSource = { fireUpdateEvent: vi.fn() };
        vi.mocked(FileSource.getInstance).mockReturnValue(fileSource as any);
        vi.mocked(appLocalStorage.getItem).mockReturnValue(
            JSON.stringify({ fontSize: 40 }),
        );
        const previewer: any = await initOpenLyric(FILE_PATH, true);

        expect(previewer.loadSetting()).toEqual({ fontSize: 40 });
        previewer.saveSetting({ fontSize: 44, fontFamily: 'Arial' });
        expect(appLocalStorage.setItem).toHaveBeenCalledWith(
            'open-lyric-previewer-setting',
            JSON.stringify({ fontSize: 44, fontFamily: 'Arial' }),
        );
        // Every pane of the song listens on its file for exactly this.
        expect(FileSource.getInstance).toHaveBeenCalledWith(FILE_PATH);
        expect(fileSource.fireUpdateEvent).toHaveBeenCalledTimes(1);
    });

    test('starts from the song text and the saved font', async () => {
        mocks.getContentMock.mockResolvedValue('v1: Amazing grace');
        vi.mocked(appLocalStorage.getItem).mockReturnValue(
            JSON.stringify({ fontSize: 61, fontFamily: 'app-Battambang' }),
        );
        const previewer: any = await initOpenLyric(FILE_PATH, true);
        expect(previewer.value).toBe('v1: Amazing grace');
        expect(previewer.fontSize).toBe('61px');
        expect(previewer.fontFamily).toBe('app-Battambang');
    });

    test('no saved face leaves open-lyric its own', async () => {
        const previewer: any = await initOpenLyric(FILE_PATH, true);
        expect(previewer.fontSize).toBe(`${DEFAULT_OPEN_LYRIC_FONT_SIZE}px`);
        expect('fontFamily' in previewer).toBe(false);
    });

    test('each language may plug into the previewer, unless told not to', async () => {
        const khmerPlugins = vi.fn();
        mocks.initAllLangCssMock.mockResolvedValue([
            { initOpenLyricPlugins: khmerPlugins },
            {},
        ]);
        const previewer = await initOpenLyric(FILE_PATH);
        expect(khmerPlugins).toHaveBeenCalledExactlyOnceWith({
            openLyric: previewer,
            genOpenLyricFontFaces,
        });

        khmerPlugins.mockClear();
        await initOpenLyric(FILE_PATH, true);
        expect(khmerPlugins).not.toHaveBeenCalled();
    });
});
