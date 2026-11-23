import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fill Show's and Animation Show's slide shows: each session walks only what
// it has up, keeps its look, and runs on a timer of its own.

const state = vi.hoisted(() => ({
    showing: [] as [number, any][],
    listKeys: [] as string[],
    sessions: [{ id: '', name: 'Default' }] as { id: string; name: string }[],
    playing: new Set<string>(),
    options: {
        seconds: 4,
        maxSeconds: 0,
        repeatKind: 'all',
        step: 1,
        isUntilMediaEnd: false,
    } as any,
    saved: [] as string[],
    pinned: [] as string[],
    savedSuffixes: [] as string[],
    put: [] as [number, string, any][],
    applied: [] as {
        runners: any[];
        checkIsOwnKey: (key: string) => boolean;
    }[],
    notified: 0,
}));

vi.mock('./foregroundHelpers', () => ({
    getForegroundSessionShowingList: (listKey: string) => {
        state.listKeys.push(listKey);
        return state.showing;
    },
    getScreenForegroundManagerInstances: (
        screenId: number,
        callback: (manager: any) => void,
    ) => {
        callback({
            putSessionData: (listKey: string, data: any) => {
                state.put.push([screenId, listKey, data]);
            },
        });
    },
}));
// Ownership as the real one reads it, without the strip's UI behind it.
vi.mock('./foregroundSessionHelpers', () => ({
    toSessionShowingList: (
        list: [number, { id?: string }][],
        sessionId: string,
        sessionIds: string[],
    ) => {
        return list.filter(([, data]) => {
            const owner = data.id ?? '';
            return (
                (sessionIds.includes(owner) ? owner : sessionIds[0]) ===
                sessionId
            );
        });
    },
}));
vi.mock('../media-sessions/mediaSessionData', () => ({
    readSessions: () => state.sessions,
    toSessionSuffix: (sessionId: string) => {
        return sessionId === '' ? '' : `-${sessionId}`;
    },
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    applyAutoPlayRunners: (
        runners: any[],
        checkIsOwnKey: (key: string) => boolean,
    ) => {
        state.applied.push({ runners, checkIsOwnKey });
    },
}));
vi.mock('../slide-auto-play/slideAutoPlayHelpers', () => ({
    checkIsSlideAutoPlaying: (prefix: string) => state.playing.has(prefix),
    setIsSlideAutoPlaying: (prefix: string, isPlaying: boolean) => {
        if (isPlaying) {
            state.playing.add(prefix);
        } else {
            state.playing.delete(prefix);
        }
    },
    readSlideAutoPlayOptions: () => state.options,
    genNextDelaySeconds: (options: any) => options.seconds,
    notifySlideAutoPlayStateChanged: () => {
        state.notified += 1;
    },
}));
vi.mock('../background/paintShowSavedHelpers', () => ({
    readPaintSavedSrcList: (_kind: string, suffix: string) => {
        state.savedSuffixes.push(suffix);
        return state.saved;
    },
    readPaintPinnedSrcList: (kind: string) => {
        return kind === 'animation' ? state.pinned : [];
    },
}));

import {
    checkIsForegroundPaintAutoPlayKey,
    stopForegroundPaintAutoPlay,
    syncForegroundPaintAutoPlayRunners,
    tickForegroundPaint,
} from './foregroundPaintAutoPlayHelpers';
import { FILL_BUILT_IN_PATTERN_MAP } from '../background/fillBuiltInHelpers';
import { listAnimationCategorySrcs } from '../background/animationBuiltInHelpers';

const PATTERNS = FILL_BUILT_IN_PATTERN_MAP.dark;
const CSS_SRC_LIST = listAnimationCategorySrcs('sunday-worship', 'css');

beforeEach(() => {
    vi.useFakeTimers();
    state.showing = [];
    state.listKeys = [];
    state.sessions = [{ id: '', name: 'Default' }];
    state.playing = new Set();
    state.options = {
        seconds: 4,
        maxSeconds: 0,
        repeatKind: 'all',
        step: 1,
        isUntilMediaEnd: false,
    };
    state.saved = [];
    state.pinned = [];
    state.savedSuffixes = [];
    state.put = [];
    state.applied = [];
    state.notified = 0;
    return () => {
        vi.useRealTimers();
    };
});

describe('one step of a Fill Show or Animation Show', () => {
    it("walks only the session's own, each with its look, one after another", () => {
        state.sessions = [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Two' },
        ];
        const look = { opacity: 0.4 };
        state.showing = [
            [0, { id: 's1', src: PATTERNS[0], extraStyle: look }],
            [1, { src: PATTERNS[0] }],
            [2, { id: 's1', src: PATTERNS[2] }],
        ];
        expect(tickForegroundPaint('fill', 's1')).toBe(true);
        expect(state.listKeys).toEqual(['fillDataList']);
        // The foreground offers one saved list, the Default one.
        expect(state.savedSuffixes).toEqual(['']);
        vi.advanceTimersByTime(0);
        expect(state.put).toEqual([
            [
                0,
                'fillDataList',
                { id: 's1', src: PATTERNS[1], extraStyle: look },
            ],
        ]);
        vi.advanceTimersByTime(100);
        expect(state.put[1]).toEqual([
            2,
            'fillDataList',
            { id: 's1', src: PATTERNS[3] },
        ]);
        // Default's overlay on screen 1 is not this show's.
        expect(state.put).toHaveLength(2);
    });

    it("walks the animation's category row, and back when asked", () => {
        state.showing = [[0, { src: CSS_SRC_LIST[1] }]];
        expect(tickForegroundPaint('animation', '', false)).toBe(true);
        expect(state.listKeys).toEqual(['animationDataList']);
        vi.advanceTimersByTime(0);
        expect(state.put[0][2].src).toBe(CSS_SRC_LIST[0]);
    });

    it('walks the pinned animations when one of them is up', () => {
        state.pinned = [CSS_SRC_LIST[3], CSS_SRC_LIST[7]];
        state.showing = [[0, { src: CSS_SRC_LIST[7] }]];
        expect(tickForegroundPaint('animation', '')).toBe(true);
        vi.advanceTimersByTime(0);
        // Round to the first pin, not on to the category's next.
        expect(state.put[0][2].src).toBe(CSS_SRC_LIST[3]);
    });

    it('answers false with nothing up, or nothing in a row', () => {
        expect(tickForegroundPaint('fill', '')).toBe(false);
        state.showing = [[0, { src: '#00FF00' }]];
        expect(tickForegroundPaint('fill', '')).toBe(false);
        vi.advanceTimersByTime(500);
        expect(state.put).toEqual([]);
    });
});

describe('the timers of a panel', () => {
    it("runs one per playing session with one up, under the launcher's key", () => {
        state.sessions = [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Two' },
        ];
        state.playing = new Set(['foreground-fill', 'foreground-fill-s1']);
        state.showing = [[0, { id: 's1', src: PATTERNS[0] }]];
        syncForegroundPaintAutoPlayRunners('fill');
        const { runners, checkIsOwnKey } = state.applied.at(-1)!;
        expect(
            runners.map((runner) => {
                return runner.key;
            }),
        ).toEqual(['foreground-fill-s1']);
        // Default had nothing up, so its show is over.
        expect(state.playing.has('foreground-fill')).toBe(false);
        expect(state.notified).toBe(1);
        expect(runners[0].getDelaySeconds()).toBe(4);
        runners[0].tick();
        vi.advanceTimersByTime(0);
        expect(state.put[0][2].src).toBe(PATTERNS[1]);
        runners[0].onEnded();
        expect(state.playing.has('foreground-fill-s1')).toBe(false);
        expect(checkIsOwnKey('foreground-fill')).toBe(true);
        expect(checkIsOwnKey('foreground-fill-s1')).toBe(true);
        expect(checkIsOwnKey('foreground-image')).toBe(false);
        expect(checkIsOwnKey('foreground-animation')).toBe(false);
        expect(checkIsOwnKey('background-fill')).toBe(false);
    });

    it('runs none without seconds to wait', () => {
        state.playing = new Set(['foreground-animation']);
        state.showing = [[0, { src: CSS_SRC_LIST[0] }]];
        state.options = { ...state.options, seconds: 0 };
        syncForegroundPaintAutoPlayRunners('animation');
        expect(state.applied.at(-1)!.runners).toEqual([]);
        expect(state.playing.has('foreground-animation')).toBe(true);
    });

    it("stops a removed session's timer alone", () => {
        stopForegroundPaintAutoPlay('animation', '-s3');
        const { runners, checkIsOwnKey } = state.applied.at(-1)!;
        expect(runners).toEqual([]);
        expect(checkIsOwnKey('foreground-animation-s3')).toBe(true);
        expect(checkIsOwnKey('foreground-animation')).toBe(false);
    });

    it('tells its keys from the media widgets and the other kind', () => {
        expect(
            checkIsForegroundPaintAutoPlayKey('fill', 'foreground-fills'),
        ).toBe(false);
        expect(
            checkIsForegroundPaintAutoPlayKey(
                'animation',
                'foreground-animation-x',
            ),
        ).toBe(true);
    });
});
