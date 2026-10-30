// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The REAL hold store (`lyricWarmSlidesHelpers`) and the real per-instance
// debounce (`genTimeoutAttempt`) under fake timers; the screens, their
// `instance` event and the stage documents are stand-ins that record which
// stage of which song was built.
const h = vi.hoisted(() => ({
    screens: [] as { stage: number; isDeleted?: boolean }[],
    instanceListeners: new Set<() => void>(),
    stageDocuments: new Map<string, any>(),
    warmStages: new Set<string>(),
    built: [] as string[],
    handleError: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../_screen/managers/ScreenManagerBase', () => ({
    default: {
        registerEventListener: (eventNames: string[], listener: () => void) => {
            expect(eventNames).toEqual(['instance']);
            h.instanceListeners.add(listener);
            return [listener];
        },
        unregisterEventListener: ([listener]: [() => void]) => {
            h.instanceListeners.delete(listener);
        },
    },
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => h.screens,
}));
vi.mock('./lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: (filePath: string, stage: number) => {
        const key = `${filePath}@${stage}`;
        if (!h.stageDocuments.has(key)) {
            h.stageDocuments.set(key, {
                getWarmDeck: () => (h.warmStages.has(key) ? [] : null),
                getSlides: vi.fn(async () => {
                    h.built.push(key);
                    return [];
                }),
            });
        }
        return [stage, h.stageDocuments.get(key)];
    },
}));

import {
    getLyricWarmStages,
    useLyricWarmSlides,
    warmLyricStages,
} from './useLyricWarmSlides';
import { getHeldOpenLyric } from './lyricWarmSlidesHelpers';

function genLyricManager(filePath: string) {
    return { filePath, openLyricPreviewer: { filePath } as any } as any;
}

let container: HTMLDivElement;
let root: Root;
let scheduleWarmUps: (() => void)[] = [];

function PreviewerComp({
    lyricManager,
    paneStages,
}: {
    lyricManager: any;
    paneStages: number[];
}) {
    scheduleWarmUps.push(useLyricWarmSlides(lyricManager, paneStages));
    return null;
}

async function renderPreviewers(
    ...previewers: { lyricManager: any; paneStages: number[] }[]
) {
    await act(async () => {
        root.render(
            createElement(
                'div',
                null,
                previewers.map((props, index) =>
                    createElement(PreviewerComp, { key: index, ...props }),
                ),
            ),
        );
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.screens = [];
    h.instanceListeners.clear();
    h.stageDocuments.clear();
    h.warmStages.clear();
    h.built = [];
    scheduleWarmUps = [];
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

describe('getLyricWarmStages', () => {
    test("each live screen's stage once, minus what a pane builds", () => {
        h.screens = [
            { stage: 0 },
            { stage: 2 },
            { stage: 2 },
            { stage: 3, isDeleted: true },
            { stage: 4 },
        ];
        expect(getLyricWarmStages([0])).toEqual([2, 4]);
        expect(getLyricWarmStages([0, 4])).toEqual([2]);
        h.screens = [];
        expect(getLyricWarmStages([0])).toEqual([]);
    });
});

describe('warmLyricStages', () => {
    test('builds the stages that have no deck yet, one at a time', async () => {
        h.warmStages.add('/a.owl@4');
        let releaseFirst: () => void = () => {};
        const [, stage2] = (
            await import('./lyricHelpers')
        ).getLyricAppDocumentStageByStage('/a.owl', 2) as any;
        stage2.getSlides.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    releaseFirst = () => {
                        h.built.push('/a.owl@2');
                        resolve();
                    };
                }),
        );

        const running = warmLyricStages('/a.owl', [2, 4, 5], () => true);
        await Promise.resolve();
        // Stage 5 waits for stage 2: never two open-lyric renders at once.
        expect(h.built).toEqual([]);
        releaseFirst();
        await running;
        expect(h.built).toEqual(['/a.owl@2', '/a.owl@5']);
    });

    test('stops as soon as the song is no longer held', async () => {
        let isActive = true;
        const [, stage1] = (
            await import('./lyricHelpers')
        ).getLyricAppDocumentStageByStage('/b.owl', 1) as any;
        stage1.getSlides.mockImplementation(async () => {
            h.built.push('/b.owl@1');
            isActive = false;
        });
        await warmLyricStages('/b.owl', [1, 2, 3], () => isActive);
        expect(h.built).toEqual(['/b.owl@1']);
    });
});

describe('useLyricWarmSlides', () => {
    test('holds the song while mounted and warms the screen stages after a pause', async () => {
        h.screens = [{ stage: 0 }, { stage: 2 }];
        const lyricManager = genLyricManager('/song.owl');
        await renderPreviewers({ lyricManager, paneStages: [0] });

        // Held in a LAYOUT effect, before any pane builds its first deck.
        expect(getHeldOpenLyric('/song.owl')).toBe(
            lyricManager.openLyricPreviewer,
        );
        await advance(499);
        expect(h.built).toEqual([]);
        await advance(1);
        expect(h.built).toEqual(['/song.owl@2']);
    });

    test('a screen changing its stage warms again', async () => {
        h.screens = [{ stage: 1 }];
        await renderPreviewers({
            lyricManager: genLyricManager('/song.owl'),
            paneStages: [0],
        });
        await advance(500);
        expect(h.built).toEqual(['/song.owl@1']);

        h.screens = [{ stage: 3 }];
        await act(async () => {
            for (const listener of h.instanceListeners) {
                listener();
            }
        });
        await advance(500);
        expect(h.built).toEqual(['/song.owl@1', '/song.owl@3']);
    });

    test('a pane added for a screen stage leaves it to the pane', async () => {
        h.screens = [{ stage: 2 }, { stage: 5 }];
        const lyricManager = genLyricManager('/song.owl');
        await renderPreviewers({ lyricManager, paneStages: [0] });
        await renderPreviewers({ lyricManager, paneStages: [0, 2] });
        await advance(500);
        // One trailing run, for the stages no pane builds any more.
        expect(h.built).toEqual(['/song.owl@5']);
    });

    test('the returned scheduler is the same debounced run', async () => {
        h.screens = [{ stage: 1 }];
        await renderPreviewers({
            lyricManager: genLyricManager('/song.owl'),
            paneStages: [0],
        });
        await advance(500);
        scheduleWarmUps.at(-1)!();
        scheduleWarmUps.at(-1)!();
        await advance(500);
        expect(h.built).toEqual(['/song.owl@1', '/song.owl@1']);
    });

    test('unmounting releases the song and cancels the run it had pending', async () => {
        h.screens = [{ stage: 2 }];
        await renderPreviewers({
            lyricManager: genLyricManager('/song.owl'),
            paneStages: [0],
        });
        act(() => {
            root.unmount();
        });
        root = createRoot(container);

        expect(getHeldOpenLyric('/song.owl')).toBeNull();
        expect(h.instanceListeners.size).toBe(0);
        await advance(500);
        expect(h.built).toEqual([]);
    });

    test('a build that throws is handled and does not stop later runs', async () => {
        h.screens = [{ stage: 1 }];
        const error = new Error('render failed');
        await renderPreviewers({
            lyricManager: genLyricManager('/song.owl'),
            paneStages: [0],
        });
        const [, stage1] = (
            await import('./lyricHelpers')
        ).getLyricAppDocumentStageByStage('/song.owl', 1) as any;
        stage1.getSlides.mockRejectedValueOnce(error);
        await advance(500);
        expect(h.handleError).toHaveBeenCalledWith(error);

        scheduleWarmUps.at(-1)!();
        await advance(500);
        expect(h.built).toEqual(['/song.owl@1']);
    });

    test('two previewers keep their own timers, so both songs warm', async () => {
        // A module-level timer would let the second previewer's mount
        // `clearTimeout` the first one's run — the multi-instance debounce
        // bug class.
        h.screens = [{ stage: 2 }];
        await renderPreviewers(
            { lyricManager: genLyricManager('/one.owl'), paneStages: [0] },
            { lyricManager: genLyricManager('/two.owl'), paneStages: [0] },
        );
        await advance(500);
        expect(h.built.sort()).toEqual(['/one.owl@2', '/two.owl@2']);
    });
});
