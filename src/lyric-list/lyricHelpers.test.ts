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
        getContentMock: vi.fn(async () => ''),
        initAllLangCssMock: vi.fn(async (): Promise<any[]> => []),
    };
});

vi.mock('open-lyric', () => ({ OpenLyric: class {} }));
vi.mock('./Lyric', () => ({
    default: {
        getInstance: vi.fn(() => ({ getContent: mocks.getContentMock })),
    },
}));
vi.mock('./LyricAppDocumentStage0', () => ({ default: mocks.stage0 }));
vi.mock('./LyricAppDocumentStage1', () => ({ default: mocks.stage1 }));
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
    checkIsValidLyricStage,
    getLyricAppDocumentStageByStage,
    initOpenLyric,
} from './lyricHelpers';

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

    // The regression, and the reason the clamp went. A stage past the layout
    // list used to fall through to `LyricAppDocumentStage1` while still echoing
    // back the stage that was ASKED for, so the caller believed it held a
    // distinct stage-2 document when it held stage 1's own cached instance —
    // the Stage Previewer trusted that number for its chip label and rendered a
    // byte-identical second pane. A stage past the list now keeps its number,
    // borrows the last layout, and gets an instance of its own.
    test('a stage past the layout list keeps its number and its own instance', () => {
        const [stage2, document2] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            2,
        );
        const [stage3, document3] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            3,
        );
        const [, stage1Document] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            1,
        );
        expect(stage2).toBe(2);
        expect(stage3).toBe(3);
        expect(document2).not.toBe(stage1Document);
        expect(document2).not.toBe(document3);
        // Borrowed layout, own number.
        expect((document2 as any).layoutStage).toBe(1);
        expect(document2.stage).toBe(2);
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
    });
});
