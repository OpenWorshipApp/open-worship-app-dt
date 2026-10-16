import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import ScreenManagerBase from '../_screen/managers/ScreenManagerBase';
import { getAllScreenManagerBases } from '../_screen/managers/screenManagerBaseHelpers';
import { getLyricAppDocumentStageByStage } from './lyricHelpers';
import type LyricManager from './LyricManager';
import { holdLyricWarmSlides } from './lyricWarmSlidesHelpers';

/**
 * The stages a click on this song can be presented at that no pane already
 * builds: each screen's `St:`, once. A pane's own stage is left out — its
 * `VarySlidesComp` builds that deck anyway, and the deck is stored as it is
 * built, so warming it here would only build it twice.
 */
export function getLyricWarmStages(paneStages: readonly number[]) {
    const stages = new Set<number>();
    for (const screenManagerBase of getAllScreenManagerBases()) {
        if (!screenManagerBase.isDeleted) {
            stages.add(screenManagerBase.stage);
        }
    }
    return Array.from(stages).filter((stage) => {
        return !paneStages.includes(stage);
    });
}

/**
 * Builds this song's slides, ahead of the click, at every stage a screen shows
 * — the way a PowerPoint's slides already carry their HTML when one is
 * presented. One stage at a time, never in parallel: each is an open-lyric
 * render, and a weak machine should do one at a time.
 */
export async function warmLyricStages(
    filePath: string,
    stages: readonly number[],
    checkIsActive: () => boolean,
) {
    for (const stage of stages) {
        if (!checkIsActive()) {
            return;
        }
        const [, lyricAppDocument] = getLyricAppDocumentStageByStage(
            filePath,
            stage,
        );
        if (lyricAppDocument.getWarmDeck() !== null) {
            continue;
        }
        // Stored as it is built — see `LyricAppDocumentStageAbstract.getSlides`.
        await lyricAppDocument.getSlides();
    }
}

/**
 * Holds the song while its slides pane is mounted (see
 * `lyricWarmSlidesHelpers`) and keeps its screens' stages built. Returns the
 * scheduler, for the owner's own `update` handler to call once it has dropped
 * the stale slides.
 */
export function useLyricWarmSlides(
    lyricManager: LyricManager,
    paneStages: readonly number[],
) {
    // Per instance: a floating preview of the same song mounts a second one,
    // and a shared timer would let one previewer cancel the other's run.
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const lyricManagerRef = useAppCurrentRef(lyricManager);
    const paneStagesRef = useAppCurrentRef(paneStages);
    const isActiveRef = useRef(false);
    // Runs are chained, so a trigger landing mid-run waits for it rather than
    // building the same stage beside it.
    const runningRef = useRef<Promise<void>>(Promise.resolve());

    const scheduleWarmUp = useCallback(() => {
        attemptTimeout(() => {
            runningRef.current = runningRef.current
                .then(() => {
                    if (!isActiveRef.current) {
                        return;
                    }
                    return warmLyricStages(
                        lyricManagerRef.current.filePath,
                        getLyricWarmStages(paneStagesRef.current),
                        () => isActiveRef.current,
                    );
                })
                .catch(handleError);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A LAYOUT effect, so the hold is in place before the panes' own
    // `getSlides()` (a passive effect further down the tree) reads whether the
    // song is held — their first deck is then kept too. (Not under dev's
    // StrictMode: its remount releases and holds again, and a build begun
    // under the first hold is refused by the second, as it must be.)
    useLayoutEffect(() => {
        isActiveRef.current = true;
        const release = holdLyricWarmSlides(
            lyricManager.filePath,
            lyricManager.openLyricPreviewer,
        );
        return () => {
            isActiveRef.current = false;
            release();
        };
    }, [lyricManager]);

    // On mount, and whenever a pane is added or hidden: what the panes build
    // themselves changes which screen stages are left to warm here.
    const paneStagesKey = paneStages.join(',');
    useAppEffect(() => {
        scheduleWarmUp();
    }, [lyricManager, paneStagesKey, scheduleWarmUp]);

    // A screen's `St:` changing fires its `instance` event. Registered
    // directly rather than through `useScreenManagerEvents`, which re-renders
    // its host on every such event — here the whole previewer.
    useAppEffect(() => {
        const registeredEvents = ScreenManagerBase.registerEventListener(
            ['instance'],
            scheduleWarmUp,
        );
        return () => {
            ScreenManagerBase.unregisterEventListener(registeredEvents);
        };
    }, [scheduleWarmUp]);

    return scheduleWarmUp;
}
