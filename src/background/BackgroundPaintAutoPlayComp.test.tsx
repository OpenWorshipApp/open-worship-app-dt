// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The slide show of the Fills and Animations tabs: one step of it with
// nothing rendered, the timers it keeps, and one show per background layer.

const state = vi.hoisted(() => ({
    showing: [] as [string, any][],
    managers: new Map<number, { applyBackgroundSrcWithSyncGroup: any }>(),
    sessions: [{ id: '', name: 'Default' }] as { id: string; name: string }[],
    playing: new Set<string>(),
    options: {
        seconds: 5,
        maxSeconds: 0,
        repeatKind: 'all',
        step: 1,
        isUntilMediaEnd: false,
    } as any,
    saved: [] as string[],
    pinned: [] as string[],
    pinnedKinds: [] as string[],
    savedSuffixes: [] as string[],
    applied: [] as {
        runners: any[];
        checkIsOwnKey: (key: string) => boolean;
    }[],
    notified: 0,
    autoPlayProps: null as any,
}));

vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: {
        getBackgroundSrcListByType: () => state.showing,
        getInstance: (screenId: number) => state.managers.get(screenId) ?? null,
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
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
vi.mock('./paintShowSavedHelpers', () => ({
    readPaintSavedSrcList: (_kind: string, suffix: string) => {
        state.savedSuffixes.push(suffix);
        return state.saved;
    },
    readPaintPinnedSrcList: (kind: string) => {
        state.pinnedKinds.push(kind);
        return state.pinned;
    },
}));
vi.mock('../slide-auto-play/SlideAutoPlayComp', () => ({
    default: (props: any) => {
        state.autoPlayProps = props;
        return <div data-auto-play={props.prefix} />;
    },
}));

import BackgroundPaintAutoPlayComp, {
    syncBackgroundPaintAutoPlayRunners,
    tickBackgroundPaint,
    toBackgroundPaintAutoPlayPrefix,
    toBackgroundPaintSessionTarget,
    useBackgroundPaintAutoPlaySync,
} from './BackgroundPaintAutoPlayComp';
import { FILL_BUILT_IN_GRADIENT_MAP } from './fillBuiltInHelpers';
import { listAnimationCategorySrcs } from './animationBuiltInHelpers';

const GRADIENTS = FILL_BUILT_IN_GRADIENT_MAP.dark;
const SHADERS = listAnimationCategorySrcs('christmas', 'glsl');

function genManager() {
    return { applyBackgroundSrcWithSyncGroup: vi.fn() };
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.showing = [];
    state.managers = new Map();
    state.sessions = [{ id: '', name: 'Default' }];
    state.playing = new Set();
    state.options = {
        seconds: 5,
        maxSeconds: 0,
        repeatKind: 'all',
        step: 1,
        isUntilMediaEnd: false,
    };
    state.saved = [];
    state.pinned = [];
    state.pinnedKinds = [];
    state.savedSuffixes = [];
    state.applied = [];
    state.notified = 0;
    state.autoPlayProps = null;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('one step of a Fills or Animations show', () => {
    it('moves every screen on along its row, its look kept, one after another', () => {
        const first = genManager();
        const second = genManager();
        state.managers.set(1, first);
        state.managers.set(2, second);
        state.showing = [
            [
                '1',
                {
                    type: 'fill',
                    src: GRADIENTS[0],
                    scaleType: 'fill',
                    extraStyle: { opacity: 0.5 },
                },
            ],
            ['2', { type: 'fill', src: GRADIENTS[3] }],
        ];
        expect(tickBackgroundPaint('fill', '-s1')).toBe(true);
        // The session's own saved row is the one looked at first.
        expect(state.savedSuffixes).toEqual(['-s1']);
        vi.advanceTimersByTime(0);
        expect(first.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith({
            type: 'fill',
            src: GRADIENTS[1],
            scaleType: 'fill',
            extraStyle: { opacity: 0.5 },
        });
        // Staggered, so two screens do not redraw in one frame.
        expect(second.applyBackgroundSrcWithSyncGroup).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(second.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith(
            expect.objectContaining({ src: GRADIENTS[4] }),
        );
    });

    it("steps back when asked, through its category's shaders for an animation", () => {
        const manager = genManager();
        state.managers.set(0, manager);
        state.showing = [['0', { type: 'animation', src: SHADERS[1] }]];
        expect(tickBackgroundPaint('animation', '', false)).toBe(true);
        vi.advanceTimersByTime(0);
        expect(manager.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'animation', src: SHADERS[0] }),
        );
        expect(state.pinnedKinds).toEqual(['animation']);
    });

    it('walks the pinned ones when one of them is up', () => {
        const manager = genManager();
        state.managers.set(0, manager);
        state.pinned = [SHADERS[5], GRADIENTS[0], SHADERS[2]];
        state.showing = [['0', { type: 'animation', src: SHADERS[5] }]];
        expect(tickBackgroundPaint('animation', '')).toBe(true);
        vi.advanceTimersByTime(0);
        expect(manager.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'animation', src: GRADIENTS[0] }),
        );
    });

    it('moves nothing when nothing is up, or what is up is in no row', () => {
        expect(tickBackgroundPaint('fill', '')).toBe(false);
        const manager = genManager();
        state.managers.set(0, manager);
        state.showing = [['0', { type: 'fill', src: '#FF0000' }]];
        expect(tickBackgroundPaint('fill', '')).toBe(false);
        vi.advanceTimersByTime(500);
        expect(manager.applyBackgroundSrcWithSyncGroup).not.toHaveBeenCalled();
    });

    it('puts the one up up again for a row of one, never pressing it off', () => {
        const manager = genManager();
        state.managers.set(0, manager);
        state.saved = ['#112233'];
        state.showing = [['0', { type: 'fill', src: '#112233' }]];
        expect(tickBackgroundPaint('fill', '')).toBe(true);
        vi.advanceTimersByTime(0);
        expect(manager.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith(
            expect.objectContaining({ src: '#112233' }),
        );
    });
});

describe('the timers of a tab', () => {
    it('runs one for each session that plays with one up, and owns only its own', () => {
        state.sessions = [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Two' },
        ];
        state.playing.add('background-fill-s1');
        state.showing = [['0', { type: 'fill', src: GRADIENTS[0] }]];
        syncBackgroundPaintAutoPlayRunners('fill');
        const { runners, checkIsOwnKey } = state.applied.at(-1)!;
        expect(
            runners.map((runner) => {
                return runner.key;
            }),
        ).toEqual(['background-fill-s1']);
        expect(runners[0].getDelaySeconds()).toBe(5);
        expect(checkIsOwnKey('background-fill')).toBe(true);
        expect(checkIsOwnKey('background-fill-s1')).toBe(true);
        expect(checkIsOwnKey('background-image')).toBe(false);
        expect(checkIsOwnKey('background-animation')).toBe(false);
        expect(checkIsOwnKey('foreground-fill')).toBe(false);
        // Its tick is the step above, under the session's own saved list.
        runners[0].tick();
        expect(state.savedSuffixes).toEqual(['-s1']);
        runners[0].onEnded();
        expect(state.playing.has('background-fill-s1')).toBe(false);
    });

    it('ends a playing show once the tab has nothing up', () => {
        state.playing.add('background-animation');
        syncBackgroundPaintAutoPlayRunners('animation');
        expect(state.playing.has('background-animation')).toBe(false);
        expect(state.notified).toBe(1);
        expect(state.applied.at(-1)!.runners).toEqual([]);
    });

    it('runs none without seconds to wait', () => {
        state.playing.add('background-fill');
        state.showing = [['0', { type: 'fill', src: GRADIENTS[0] }]];
        state.options = { ...state.options, seconds: 0, maxSeconds: 0 };
        syncBackgroundPaintAutoPlayRunners('fill');
        expect(state.applied.at(-1)!.runners).toEqual([]);
        // ...and leaves it playing, to start once a number is typed.
        expect(state.playing.has('background-fill')).toBe(true);
    });

    it('is reconciled by the tab whenever what is up changes', () => {
        function SyncStandInComp({ count }: Readonly<{ count: number }>) {
            useBackgroundPaintAutoPlaySync('fill', count);
            return null;
        }
        act(() => root.render(<SyncStandInComp count={0} />));
        act(() => root.render(<SyncStandInComp count={0} />));
        expect(state.applied).toHaveLength(1);
        act(() => root.render(<SyncStandInComp count={1} />));
        expect(state.applied).toHaveLength(2);
    });
});

describe("the tab's slide-show control", () => {
    it("runs under the session's own key; Play there ends another session's show", () => {
        state.sessions = [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Two' },
        ];
        state.showing = [['0', { type: 'fill', src: GRADIENTS[0] }]];
        act(() =>
            root.render(
                <BackgroundPaintAutoPlayComp kind="fill" sessionId="s1" />,
            ),
        );
        expect(state.autoPlayProps.prefix).toBe('background-fill-s1');
        expect(state.autoPlayProps.isTimerExternal).toBe(true);
        state.playing.add('background-fill');
        state.playing.add('background-fill-s1');
        act(() => state.autoPlayProps.onStateChange());
        expect([...state.playing]).toEqual(['background-fill-s1']);
        expect(state.notified).toBe(1);
        expect(
            state.applied.at(-1)!.runners.map((runner) => {
                return runner.key;
            }),
        ).toEqual(['background-fill-s1']);
        // Stopped, it leaves the others as they are.
        state.playing = new Set(['background-fill']);
        act(() => state.autoPlayProps.onStateChange());
        expect(state.playing.has('background-fill')).toBe(true);
    });

    it("steps with the runner's own step", () => {
        const manager = genManager();
        state.managers.set(0, manager);
        state.showing = [['0', { type: 'fill', src: GRADIENTS[2] }]];
        act(() =>
            root.render(
                <BackgroundPaintAutoPlayComp kind="fill" sessionId="" />,
            ),
        );
        expect(state.autoPlayProps.onNext({ isNext: false })).toBe(true);
        vi.advanceTimersByTime(0);
        expect(manager.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith(
            expect.objectContaining({ src: GRADIENTS[1] }),
        );
    });
});

describe('the names a tab keeps its sessions and shows under', () => {
    it('are its own beside the Images tab', () => {
        expect(toBackgroundPaintSessionTarget('animation')).toBe(
            'background-animation',
        );
        expect(toBackgroundPaintAutoPlayPrefix('fill', '-s2')).toBe(
            'background-fill-s2',
        );
    });
});
