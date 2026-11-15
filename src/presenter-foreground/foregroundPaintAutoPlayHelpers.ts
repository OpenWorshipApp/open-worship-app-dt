import {
    findNextPaintShowSrc,
    type PaintShowKindType,
} from '../background/paintShowOrderHelpers';
import { readPaintSavedSrcList } from '../background/paintShowSavedHelpers';
import {
    readSessions,
    toSessionSuffix,
} from '../media-sessions/mediaSessionData';
import { applyAutoPlayRunners } from '../slide-auto-play/autoPlayRunnerHelpers';
import {
    checkIsSlideAutoPlaying,
    genNextDelaySeconds,
    notifySlideAutoPlayStateChanged,
    readSlideAutoPlayOptions,
    setIsSlideAutoPlaying,
} from '../slide-auto-play/slideAutoPlayHelpers';
import { toForegroundAutoPlayPrefix } from './foregroundAutoPlayPrefix';
import { toForegroundSessionsTarget } from './foregroundComponentRules';
import {
    getForegroundSessionShowingList,
    getScreenForegroundManagerInstances,
} from './foregroundHelpers';
import { toSessionShowingList } from './foregroundSessionHelpers';

/**
 * The slide shows of Fill Show and Animation Show (2026-11-15, the user:
 * _`Fills Show` and `Animations Show` should support auto-play as well_).
 *
 * Image Show's, with a row where it has a folder: each session's show moves
 * every screen that session has up on to the next fill or animation in the
 * row the one up is in (`findPaintShowRow`) -- the gradients, the patterns,
 * the CSS animations, the shaders, or the saved ones -- keeping the
 * session's look, staggered so several screens do not redraw in the same
 * frame. Sessions are separate overlays, so their shows are separate too.
 *
 * The timers live outside React (`applyAutoPlayRunners`), under the key the
 * launcher menu already reads for a running show (`toForegroundAutoPlayPrefix`),
 * so a show keeps going with its panel closed.
 */

function toListKey(kind: PaintShowKindType) {
    return kind === 'fill' ? 'fillDataList' : 'animationDataList';
}

function readSessionIds(kind: PaintShowKindType) {
    return readSessions(toForegroundSessionsTarget(kind)).map((session) => {
        return session.id;
    });
}

function getPaintSessionShowingList(
    kind: PaintShowKindType,
    sessionId: string,
    sessionIds: string[],
) {
    return toSessionShowingList(
        getForegroundSessionShowingList(toListKey(kind)),
        sessionId,
        sessionIds,
    );
}

/** Whether a running timer is one of this panel's shows. */
export function checkIsForegroundPaintAutoPlayKey(
    kind: PaintShowKindType,
    key: string,
) {
    const base = toForegroundAutoPlayPrefix(kind, '');
    return key === base || key.startsWith(`${base}-`);
}

/**
 * One step of a session's show, with nothing rendered. Answers false when
 * nothing moved: the session has nothing up (Clear Foreground, its Hide), or
 * what it has up is in no row, or "no repeat" ran off the end of it.
 */
export function tickForegroundPaint(
    kind: PaintShowKindType,
    sessionId: string,
    isNext = true,
) {
    const showingList = getPaintSessionShowingList(
        kind,
        sessionId,
        readSessionIds(kind),
    );
    if (showingList.length === 0) {
        return false;
    }
    const options = readSlideAutoPlayOptions(
        toForegroundAutoPlayPrefix(kind, toSessionSuffix(sessionId)),
    );
    // The foreground's saved row is the one list it has always offered.
    const savedSrcList = readPaintSavedSrcList(kind, '');
    const moveList = showingList
        .map(([screenId, data]) => {
            const src = findNextPaintShowSrc(kind, data.src, savedSrcList, {
                isNext,
                step: options.step,
                repeatKind: options.repeatKind,
            });
            return src === null ? null : { screenId, data, src };
        })
        .filter((move) => {
            return move !== null;
        });
    for (let i = 0; i < moveList.length; i++) {
        const { screenId, data, src } = moveList[i];
        setTimeout(() => {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    // The session's own item, its look kept: what Customize
                    // writes, with the next one in place of the one up.
                    screenForegroundManager.putSessionData(toListKey(kind), {
                        ...data,
                        src,
                    });
                },
            );
        }, i * 100);
    }
    return moveList.length > 0;
}

/**
 * Starts or stops a timer for every session of this panel that is playing
 * and has something up, read from the SETTINGS so a session nobody is
 * looking at keeps its show. Only this panel's keys are touched.
 */
export function syncForegroundPaintAutoPlayRunners(kind: PaintShowKindType) {
    const sessionIds = readSessionIds(kind);
    const runners = [];
    for (const sessionId of sessionIds) {
        const prefix = toForegroundAutoPlayPrefix(
            kind,
            toSessionSuffix(sessionId),
        );
        if (!checkIsSlideAutoPlaying(prefix)) {
            continue;
        }
        // Its last one came off, so the show is OVER, as Image Show's is:
        // left playing, the next one put up would start it by itself.
        if (
            getPaintSessionShowingList(kind, sessionId, sessionIds).length === 0
        ) {
            setIsSlideAutoPlaying(prefix, false);
            notifySlideAutoPlayStateChanged();
            continue;
        }
        const options = readSlideAutoPlayOptions(prefix);
        if (!(options.seconds > 0 || options.maxSeconds > 0)) {
            continue;
        }
        runners.push({
            key: prefix,
            signature: [
                options.seconds,
                options.maxSeconds,
                options.repeatKind,
                options.step,
            ].join(':'),
            getDelaySeconds: () => {
                return genNextDelaySeconds(options);
            },
            tick: () => {
                return tickForegroundPaint(kind, sessionId);
            },
            onEnded: () => {
                setIsSlideAutoPlaying(prefix, false);
                notifySlideAutoPlayStateChanged();
            },
        });
    }
    applyAutoPlayRunners(runners, (key) => {
        return checkIsForegroundPaintAutoPlayKey(kind, key);
    });
}

/** A removed session's show: its timer, which nothing would stop again. */
export function stopForegroundPaintAutoPlay(
    kind: PaintShowKindType,
    sessionSuffix: string,
) {
    const prefix = toForegroundAutoPlayPrefix(kind, sessionSuffix);
    applyAutoPlayRunners([], (key) => {
        return key === prefix;
    });
}
