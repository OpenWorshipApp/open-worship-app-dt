import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    managers: [] as any[],
    documents: new Map<number, any>(),
    handleError: vi.fn(),
}));

vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: { getAllInstances: () => h.managers },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: (_filePath: string, stage: number) => {
        return [stage, h.documents.get(stage)];
    },
}));
vi.mock('./LyricSlide', () => ({ LYRIC_SLIDE_TYPE_KEY: 'lyric-slide' }));

import {
    mapLyricSlideIdAcrossAtomMode,
    prepareLyricAtomModeScreens,
} from './lyricAtomModeScreenHelpers';

type QuickType = {
    id: number;
    openLyricIndex: number;
    openLyricRepeat: { index: number; count: number } | null;
    openLyricLine: { index: number; count: number } | null;
};

function genExtraSlide(id: number): QuickType {
    return {
        id,
        openLyricIndex: -1,
        openLyricRepeat: null,
        openLyricLine: null,
    };
}

// First, Info and None, then the song's own slides from `steps`: each step
// a structure index, a repeat index (or -1) and how many lines it is -- then
// the None that closes a song with any part, as `extendExtraSlide` lists it.
function genQuickList(steps: [number, number, number][]): QuickType[] {
    const list: QuickType[] = [0, 1, 2].map(genExtraSlide);
    for (const [structureIndex, repeatIndex, lineCount] of steps) {
        for (let index = 0; index < Math.max(1, lineCount); index++) {
            list.push({
                id: list.length,
                openLyricIndex: structureIndex,
                openLyricRepeat:
                    repeatIndex < 0 ? null : { index: repeatIndex, count: 2 },
                openLyricLine:
                    lineCount < 2 ? null : { index, count: lineCount },
            });
        }
    }
    if (steps.length > 0) {
        list.push(genExtraSlide(list.length));
    }
    return list;
}

// Verse (one step), Chorus played twice.
const WHOLE = genQuickList([
    [0, -1, 1],
    [1, 0, 1],
    [1, 1, 1],
]);
// The same song, Verse of 3 lines and Chorus of 2.
const ATOM = genQuickList([
    [0, -1, 3],
    [1, 0, 2],
    [1, 1, 2],
]);

describe('mapLyricSlideIdAcrossAtomMode', () => {
    test('First, Info and None keep their ids', () => {
        for (const id of [0, 1, 2]) {
            expect(mapLyricSlideIdAcrossAtomMode(WHOLE, ATOM, id)).toBe(id);
            expect(mapLyricSlideIdAcrossAtomMode(ATOM, WHOLE, id)).toBe(id);
        }
    });

    test('switched on, a part goes to its first line, of the same play', () => {
        // Verse -> its line 1; the second play of the Chorus -> its line 1.
        expect(mapLyricSlideIdAcrossAtomMode(WHOLE, ATOM, 3)).toBe(3);
        expect(mapLyricSlideIdAcrossAtomMode(WHOLE, ATOM, 4)).toBe(6);
        expect(mapLyricSlideIdAcrossAtomMode(WHOLE, ATOM, 5)).toBe(8);
    });

    test('switched off, any line goes to its whole part', () => {
        expect(mapLyricSlideIdAcrossAtomMode(ATOM, WHOLE, 5)).toBe(3);
        expect(mapLyricSlideIdAcrossAtomMode(ATOM, WHOLE, 7)).toBe(4);
        expect(mapLyricSlideIdAcrossAtomMode(ATOM, WHOLE, 9)).toBe(5);
    });

    test('the None that closes the song stays the last of its slides', () => {
        // WHOLE ends on 6, ATOM on 10.
        expect(mapLyricSlideIdAcrossAtomMode(WHOLE, ATOM, 6)).toBe(10);
        expect(mapLyricSlideIdAcrossAtomMode(ATOM, WHOLE, 10)).toBe(6);
    });

    test('a song with no parts has only its leading None', () => {
        const empty = genQuickList([]);
        expect(empty).toHaveLength(3);
        expect(mapLyricSlideIdAcrossAtomMode(empty, empty, 2)).toBe(2);
    });

    test('the attachment slides after the song move with its length', () => {
        // WHOLE has 7 slides, ATOM 11: the first attachment is 7, then 11.
        expect(mapLyricSlideIdAcrossAtomMode(WHOLE, ATOM, 7)).toBe(11);
        expect(mapLyricSlideIdAcrossAtomMode(ATOM, WHOLE, 12)).toBe(8);
    });
});

describe('prepareLyricAtomModeScreens', () => {
    function genManager(itemJson: any, isLocked = false) {
        const manager = {
            screenManagerBase: { isLocked },
            varySlideData:
                itemJson === null
                    ? null
                    : { filePath: '/songs/grace.owl', itemJson },
            applyVarySlideData: vi.fn(async (data: any) => {
                manager.varySlideData = data;
            }),
        };
        return manager;
    }

    function genDocument() {
        return {
            getSlidesQuick: vi.fn(async (isAtomMode: boolean) => {
                return isAtomMode ? ATOM : WHOLE;
            }),
            getSlideById: vi.fn(async (id: number) => {
                return {
                    toJson: () => ({ type: 'lyric-slide', id, stage: 0 }),
                };
            }),
        };
    }

    beforeEach(() => {
        h.managers = [];
        h.documents = new Map([
            [0, genDocument()],
            [2, genDocument()],
        ]);
        h.handleError.mockReset();
    });

    test('puts every song slide that is up back as its counterpart', async () => {
        const stage0 = genManager({ type: 'lyric-slide', id: 4, stage: 0 });
        const stage2 = genManager({ type: 'lyric-slide', id: 5, stage: 2 });
        h.managers = [stage0, stage2];
        const reapply = await prepareLyricAtomModeScreens(true);
        // Nothing moves before the switch is written.
        expect(stage0.applyVarySlideData).not.toHaveBeenCalled();
        await reapply();
        expect(stage0.applyVarySlideData).toHaveBeenCalledWith(
            expect.objectContaining({
                filePath: '/songs/grace.owl',
                itemJson: { type: 'lyric-slide', id: 6, stage: 0 },
            }),
        );
        // Each screen's slide is read off ITS stage's document.
        expect(h.documents.get(2).getSlideById).toHaveBeenCalledWith(8);
    });

    test('a screen on the closing None is put on the new closing None', async () => {
        const manager = genManager({ type: 'lyric-slide', id: 6, stage: 0 });
        h.managers = [manager];
        await (
            await prepareLyricAtomModeScreens(true)
        )();
        expect(manager.applyVarySlideData).toHaveBeenCalledWith(
            expect.objectContaining({
                itemJson: { type: 'lyric-slide', id: 10, stage: 0 },
            }),
        );
    });

    test('leaves a locked screen, a slide of no song and First alone', async () => {
        const locked = genManager(
            { type: 'lyric-slide', id: 4, stage: 0 },
            true,
        );
        const other = genManager({ type: 'slide', id: 4 });
        const empty = genManager(null);
        const first = genManager({ type: 'lyric-slide', id: 0, stage: 0 });
        h.managers = [locked, other, empty, first];
        await (
            await prepareLyricAtomModeScreens(true)
        )();
        for (const manager of h.managers) {
            expect(manager.applyVarySlideData).not.toHaveBeenCalled();
        }
    });

    test('keeps what the operator put up in the meantime', async () => {
        const manager = genManager({ type: 'lyric-slide', id: 4, stage: 0 });
        h.managers = [manager];
        const reapply = await prepareLyricAtomModeScreens(true);
        manager.varySlideData = {
            filePath: '/songs/grace.owl',
            itemJson: { type: 'lyric-slide', id: 3, stage: 0 },
        };
        await reapply();
        expect(manager.applyVarySlideData).not.toHaveBeenCalled();
    });

    test('a song that cannot be read is reported, the rest still done', async () => {
        h.documents.get(2).getSlidesQuick.mockRejectedValue(new Error('gone'));
        const broken = genManager({ type: 'lyric-slide', id: 4, stage: 2 });
        const fine = genManager({ type: 'lyric-slide', id: 4, stage: 0 });
        h.managers = [broken, fine];
        await (
            await prepareLyricAtomModeScreens(true)
        )();
        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(broken.applyVarySlideData).not.toHaveBeenCalled();
        expect(fine.applyVarySlideData).toHaveBeenCalledTimes(1);
    });
});
