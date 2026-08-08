import { describe, expect, test, vi } from 'vitest';

// `lyricHelpers` pulls the whole open-lyric + FileSource + language stack in at
// module load and none of it participates in resolving a stage to its class, so
// it is all stubbed. The two stage classes are stubbed down to the only thing
// the resolution uses: a per-class `getInstance` cached on the file path, which
// is what `AppDocumentSourceAbs._getInstance` does for real (it keys on the
// CLASS NAME plus the path, which is why a stage only gets an identity of its
// own by having a class of its own).
const mocks = vi.hoisted(() => {
    const genStageClass = (stage: number) => {
        const instances = new Map<string, any>();
        return {
            stage,
            getInstance: vi.fn((filePath: string) => {
                if (!instances.has(filePath)) {
                    instances.set(filePath, { stage, filePath });
                }
                return instances.get(filePath);
            }),
        };
    };
    return { stage0: genStageClass(0), stage1: genStageClass(1) };
});

vi.mock('open-lyric', () => ({ OpenLyric: class {} }));
vi.mock('./Lyric', () => ({ default: class {} }));
vi.mock('./LyricAppDocumentStage0', () => ({ default: mocks.stage0 }));
vi.mock('./LyricAppDocumentStage1', () => ({ default: mocks.stage1 }));
vi.mock('../lang/langHelpers', () => ({ getAllLangsAsync: vi.fn() }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: vi.fn(() => null),
    setSetting: vi.fn(),
}));
vi.mock('../helper/FileSource', () => ({ default: { getInstance: vi.fn() } }));
vi.mock('../others/themeHelpers', () => ({
    checkIsDarkMode: vi.fn(() => false),
}));
vi.mock('./lyricPrintHelpers', () => ({
    installOpenLyricPrintPopupHandler: vi.fn(),
}));

import {
    getAvailableLyricStages,
    getLyricAppDocumentStageByStage,
} from './lyricHelpers';

const FILE_PATH = '/songs/aa3.owl';

describe('getAvailableLyricStages', () => {
    test('lists exactly the stages that have a layout class', () => {
        expect(getAvailableLyricStages()).toEqual([0, 1]);
    });
});

describe('getLyricAppDocumentStageByStage', () => {
    test('each registered stage resolves to a document of its own', () => {
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

    // The regression. An unregistered stage used to fall through to
    // `LyricAppDocumentStage1` while still echoing back the stage that was
    // ASKED for, so the caller believed it held a distinct stage-2 document
    // when it held stage 1's own cached instance. The Stage Previewer trusted
    // that number for its chip label and rendered a byte-identical second pane.
    test('an unregistered stage clamps AND reports the stage it landed on', () => {
        const [stage, document] = getLyricAppDocumentStageByStage(FILE_PATH, 2);
        const [, stage1Document] = getLyricAppDocumentStageByStage(
            FILE_PATH,
            1,
        );
        expect(stage).toBe(1);
        expect(document).toBe(stage1Document);
    });

    test('a negative or non-finite stage clamps to the base stage', () => {
        expect(getLyricAppDocumentStageByStage(FILE_PATH, -3)[0]).toBe(0);
        expect(getLyricAppDocumentStageByStage(FILE_PATH, NaN)[0]).toBe(0);
    });
});
