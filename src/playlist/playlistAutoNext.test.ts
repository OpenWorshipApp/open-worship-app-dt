// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import PlaylistItem from './PlaylistItem';
import { PLAYLIST_ACTION_TYPE } from './playlistActionHelpers';
import {
    checkPlaylistAutoNextIsRunnable,
    firePlaylistRunAction,
    getPlaylistAutoNextState,
    jumpPlaylistRunToCcItem,
    notifyPlaylistRunSelectionChanged,
    registerPlaylistRunController,
    setPlaylistAutoNextPaused,
    startPlaylistAutoNext,
    stopPlaylistAutoNext,
} from './playlistAutoNextHelpers';

const PLAYLIST_FILE_PATH = '/data/playlists/pl1.owp';
const OTHER_FILE_PATH = '/data/playlists/pl2.owp';

function genStepping(isStepped = true) {
    return vi.fn(() => {
        return isStepped;
    });
}

// The run controller with only its stepping half under test; the jump half
// answers false unless a test replaces it.
function genController(stepForward: () => boolean, jumpToUuid = () => false) {
    return { stepForward, jumpToUuid };
}

// The countdown ticks once a second, so everything here drives real timer time.
function tickSeconds(seconds: number) {
    vi.advanceTimersByTime(seconds * 1000);
}

describe('playlist auto next', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        stopPlaylistAutoNext();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    test('nothing is armed without an open run', () => {
        expect(checkPlaylistAutoNextIsRunnable(PLAYLIST_FILE_PATH)).toBe(false);
        expect(startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 5)).toBe(
            false,
        );
        expect(getPlaylistAutoNextState()).toBe(null);
    });

    test('a run open on ANOTHER playlist does not answer', () => {
        const unregister = registerPlaylistRunController(
            OTHER_FILE_PATH,
            genController(genStepping()),
        );
        expect(checkPlaylistAutoNextIsRunnable(PLAYLIST_FILE_PATH)).toBe(false);
        expect(startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 5)).toBe(
            false,
        );
        unregister();
    });

    test('a number that is not greater than 0 arms nothing', () => {
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(genStepping()),
        );
        expect(startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 0)).toBe(
            false,
        );
        expect(startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', -3)).toBe(
            false,
        );
        expect(getPlaylistAutoNextState()).toBe(null);
        unregister();
    });

    test('a timeout counts down to 0, steps ONCE and is spent', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 3);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(3);
        tickSeconds(2);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(1);
        expect(step).not.toHaveBeenCalled();
        tickSeconds(1);
        expect(step).toHaveBeenCalledTimes(1);
        // Spent: the panel must not be left showing a 0 that never fires again.
        expect(getPlaylistAutoNextState()).toBe(null);
        tickSeconds(10);
        expect(step).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('the run moving cancels a timeout, and nothing else does', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 5);
        // A stray click anywhere in the app is NOT the operator taking over —
        // an unintended one must not silently kill the wait.
        window.dispatchEvent(new Event('pointerdown'));
        window.dispatchEvent(new Event('keydown'));
        tickSeconds(2);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(3);
        // Going somewhere in the run IS.
        notifyPlaylistRunSelectionChanged();
        expect(getPlaylistAutoNextState()).toBe(null);
        tickSeconds(10);
        expect(step).not.toHaveBeenCalled();
        unregister();
    });

    test('an interval restarts its count when the run moves', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 4);
        tickSeconds(3);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(1);
        // The operator stepped ahead by hand: the line they landed on gets the
        // WHOLE interval, not the second that was left of the last one.
        notifyPlaylistRunSelectionChanged();
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(4);
        tickSeconds(3);
        expect(step).not.toHaveBeenCalled();
        tickSeconds(1);
        expect(step).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('an interval keeps stepping and survives a stray click', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 2);
        window.dispatchEvent(new Event('pointerdown'));
        window.dispatchEvent(new Event('keydown'));
        expect(getPlaylistAutoNextState()?.mode).toBe('interval');
        tickSeconds(2);
        expect(step).toHaveBeenCalledTimes(1);
        // Counting again from what it was armed with, not stopping.
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(2);
        tickSeconds(4);
        expect(step).toHaveBeenCalledTimes(3);
        unregister();
    });

    test('an interval stops itself at the end of the run sheet', () => {
        const step = genStepping(false);
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 1);
        tickSeconds(1);
        expect(step).toHaveBeenCalledTimes(1);
        expect(getPlaylistAutoNextState()).toBe(null);
        tickSeconds(10);
        expect(step).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('arming one replaces whatever was armed before', () => {
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(genStepping()),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 9);
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 4);
        expect(getPlaylistAutoNextState()).toEqual({
            mode: 'timeout',
            seconds: 4,
            remainingSeconds: 4,
            // Armed with a count of seconds, so nothing on the wall clock.
            dueTime: null,
            isPaused: false,
        });
        // An INTERVAL is still a re-arm even over a running interval: that is an
        // operator naming the sheet's own pace.
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 6);
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 2);
        expect(getPlaylistAutoNextState()?.seconds).toBe(2);
        unregister();
    });

    test('a timeout lends a running interval its count for ONE cycle', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 5);
        tickSeconds(2);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(3);
        // The line the run is showing carries a `Next: Timeout (7)`: hold this
        // one longer, do not kill the loop walking the sheet.
        expect(startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 7)).toBe(
            true,
        );
        expect(getPlaylistAutoNextState()).toEqual({
            mode: 'interval',
            // What it goes back to counting once this cycle is spent.
            seconds: 5,
            remainingSeconds: 7,
            dueTime: null,
            isPaused: false,
        });
        tickSeconds(6);
        expect(step).not.toHaveBeenCalled();
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(1);
        tickSeconds(1);
        expect(step).toHaveBeenCalledTimes(1);
        // Spent: its own count from here on, 5 and not 7.
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(5);
        tickSeconds(5);
        expect(step).toHaveBeenCalledTimes(2);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(5);
        unregister();
    });

    test('a borrowed cycle is given up when the run moves', () => {
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(genStepping()),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 4);
        startPlaylistAutoNext(
            PLAYLIST_FILE_PATH,
            'timeout',
            30,
            Date.now() + 30_000,
        );
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(30);
        // The operator stepped ahead by hand: the line they landed on gets the
        // interval's own count, and the wall clock the borrow was reading goes
        // with it — left behind, every later tick would read a time long past.
        notifyPlaylistRunSelectionChanged();
        expect(getPlaylistAutoNextState()).toEqual({
            mode: 'interval',
            seconds: 4,
            remainingSeconds: 4,
            dueTime: null,
            isPaused: false,
        });
        unregister();
    });

    test('a borrowed cycle counted to a TIME OF DAY leaves no wall clock behind', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 3);
        startPlaylistAutoNext(
            PLAYLIST_FILE_PATH,
            'timeout',
            2,
            Date.now() + 2_000,
        );
        tickSeconds(2);
        expect(step).toHaveBeenCalledTimes(1);
        expect(getPlaylistAutoNextState()).toEqual({
            mode: 'interval',
            seconds: 3,
            remainingSeconds: 3,
            dueTime: null,
            isPaused: false,
        });
        // Counting itself down again rather than re-reading a due time that has
        // gone by — which would step the run every single tick.
        tickSeconds(1);
        expect(step).toHaveBeenCalledTimes(1);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(2);
        unregister();
    });

    test('either clock can be HELD and let go again', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 5);
        tickSeconds(2);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(3);

        setPlaylistAutoNextPaused(true);
        expect(getPlaylistAutoNextState()?.isPaused).toBe(true);
        // Frozen, and costing nothing: the ticking is cleared outright rather
        // than left running against a flag.
        tickSeconds(30);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(3);
        expect(step).not.toHaveBeenCalled();

        setPlaylistAutoNextPaused(false);
        expect(getPlaylistAutoNextState()?.isPaused).toBe(false);
        tickSeconds(3);
        expect(step).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('holding a TIME OF DAY countdown gives up its wall clock', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(
            PLAYLIST_FILE_PATH,
            'timeout',
            10,
            Date.now() + 10_000,
        );
        tickSeconds(2);
        setPlaylistAutoNextPaused(true);
        // Holding "go on at 7:05" means the run waits that many more seconds
        // from when it is let go — not that the hour comes round anyway.
        expect(getPlaylistAutoNextState()?.dueTime).toBe(null);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(8);
        tickSeconds(60);
        expect(step).not.toHaveBeenCalled();

        setPlaylistAutoNextPaused(false);
        tickSeconds(7);
        expect(step).not.toHaveBeenCalled();
        tickSeconds(1);
        expect(step).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('a borrowed cycle does not let a HELD interval go', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 4);
        setPlaylistAutoNextPaused(true);
        // A line going up with a timeout attached is not the operator letting
        // the run walk itself again.
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'timeout', 7);
        expect(getPlaylistAutoNextState()?.isPaused).toBe(true);
        expect(getPlaylistAutoNextState()?.remainingSeconds).toBe(7);
        tickSeconds(20);
        expect(step).not.toHaveBeenCalled();
        unregister();
    });

    test('closing the run stops the clock with it', () => {
        const step = genStepping();
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(step),
        );
        startPlaylistAutoNext(PLAYLIST_FILE_PATH, 'interval', 2);
        unregister();
        expect(getPlaylistAutoNextState()).toBe(null);
        tickSeconds(10);
        expect(step).not.toHaveBeenCalled();
    });
});

describe('jumping the run', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    const TARGET = PlaylistItem.fromActionId('clear-all');

    // The SHEET is what resolves a CC, so a jump and the line it names have to
    // be bound together the way `Playlist.getItems` binds them.
    function genBoundItems(jsonList: any[]) {
        return PlaylistItem.bindCcSources(
            jsonList.map((json) => {
                return PlaylistItem.fromJson(PLAYLIST_FILE_PATH, json);
            }),
        );
    }

    function genJumpItem(isTargetAttached: boolean) {
        return genBoundItems([
            TARGET,
            {
                ...PlaylistItem.fromActionId('jump-to'),
                ...(isTargetAttached
                    ? { ccItems: [{ uuid: TARGET.uuid as string }] }
                    : {}),
            },
        ])[1];
    }

    test('it is armed with a CC, not with a number', () => {
        const playlistItem = genJumpItem(false);
        // No number, so an entry with none is a line still being written rather
        // than an error row.
        expect(playlistItem.isRunAction).toBe(true);
        expect(playlistItem.runAction?.number).toBe(null);
        expect(playlistItem.title).not.toContain('(');
        // Exactly one CC, and it may never be one itself.
        expect(playlistItem.maxCcItemCount).toBe(1);
        expect(
            PlaylistItem.resolveCcItemJson(
                PlaylistItem.fromActionId('jump-to'),
            ),
        ).toBe(null);
    });

    test('a second CC is refused on read, so the row cannot lie', () => {
        const other = PlaylistItem.fromActionId('clear-slide');
        const playlistItem = genBoundItems([
            TARGET,
            other,
            {
                ...PlaylistItem.fromActionId('jump-to'),
                ccItems: [
                    { uuid: TARGET.uuid as string },
                    { uuid: other.uuid as string },
                ],
            },
        ])[2];
        expect(playlistItem.ccItems).toHaveLength(1);
        expect(playlistItem.canHostMoreCcItems).toBe(false);
    });

    test('firing one sends the run to its CC’s origin', () => {
        const jumpToUuid = vi.fn(() => true);
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(genStepping(), jumpToUuid),
        );
        const playlistItem = genJumpItem(true);
        expect(
            jumpPlaylistRunToCcItem(
                PLAYLIST_FILE_PATH,
                playlistItem.ccItems[0],
            ),
        ).toBe(null);
        // By uuid, so two identical-looking lines are no longer a guess.
        expect(jumpToUuid).toHaveBeenCalledWith(TARGET.uuid);
        unregister();
    });

    test('it says what is missing rather than doing nothing', () => {
        // No CC attached yet.
        expect(genJumpItem(false).runAction?.start(genJumpItem(false))).toBe(
            'Attach the element to jump to as a CC element',
        );
        // Attached, but no run open.
        expect(
            jumpPlaylistRunToCcItem(
                PLAYLIST_FILE_PATH,
                genJumpItem(true).ccItems[0],
            ),
        ).toBe('Open the playlist preview to use this action');
        // A run open, but the sheet no longer lists what it points at.
        const unregister = registerPlaylistRunController(
            PLAYLIST_FILE_PATH,
            genController(genStepping()),
        );
        expect(
            jumpPlaylistRunToCcItem(
                PLAYLIST_FILE_PATH,
                genJumpItem(true).ccItems[0],
            ),
        ).toBe('The element to jump to is not in this playlist');
        unregister();
    });

    test('only a jump is withheld from a jump; a clock is not', () => {
        // The whole point of "jump to" is that it behaves like the next-key on a
        // chosen line — so landing on a `Next: Interval` must ARM it, which is
        // how a looping set is built. Only another jump is withheld, because two
        // aimed at each other would move the run for ever with nothing in
        // between to break the chain.
        const toAction = (id: any) => {
            return PlaylistItem.fromJson(
                PLAYLIST_FILE_PATH,
                PlaylistItem.fromActionId(id, { actionNumber: 5 }),
            ).runAction;
        };
        expect(toAction('jump-to')?.movesRunAtOnce).toBe(true);
        expect(toAction('next-interval')?.movesRunAtOnce).toBe(false);
        expect(toAction('next-timeout')?.movesRunAtOnce).toBe(false);
    });

    test('firing a non-run action does nothing here', () => {
        // `firePlaylistRunAction` is the one funnel and must ignore what is not
        // a run action at all.
        expect(() => {
            firePlaylistRunAction(
                PlaylistItem.fromJson(
                    PLAYLIST_FILE_PATH,
                    PlaylistItem.fromActionId('clear-all'),
                ),
            );
        }).not.toThrow();
    });
});

describe('run action entries', () => {
    test('a run action must carry a number greater than 0', () => {
        expect(() => {
            PlaylistItem.fromJson(PLAYLIST_FILE_PATH, {
                type: PLAYLIST_ACTION_TYPE,
                data: 'next-timeout',
            });
        }).toThrow();
        expect(() => {
            PlaylistItem.fromJson(PLAYLIST_FILE_PATH, {
                type: PLAYLIST_ACTION_TYPE,
                data: 'next-interval',
                actionNumber: 0,
            });
        }).toThrow();
        expect(() => {
            PlaylistItem.fromJson(
                PLAYLIST_FILE_PATH,
                PlaylistItem.fromActionId('next-interval', {
                    actionNumber: 15,
                }),
            );
        }).not.toThrow();
    });

    test('a screen action needs no number', () => {
        const playlistItem = PlaylistItem.fromJson(
            PLAYLIST_FILE_PATH,
            PlaylistItem.fromActionId('clear-all'),
        );
        expect(playlistItem.isRunAction).toBe(false);
        expect(playlistItem.isScreenReachable).toBe(true);
        expect(playlistItem.screenAction?.id).toBe('clear-all');
    });

    test('screen show/hide NAMES its screens, a clear does not', () => {
        // The pin is what the line IS for these two, so it is asked for when
        // they are added and written through the ordinary `screenIds` field.
        for (const actionId of ['screen-show', 'screen-hide'] as const) {
            const json = PlaylistItem.fromActionId(actionId, {}, [1, 2]);
            expect(json.screenIds).toEqual([1, 2]);
            const playlistItem = PlaylistItem.fromJson(
                PLAYLIST_FILE_PATH,
                json,
            );
            expect(playlistItem.screenAction?.requiresScreenIds).toBe(true);
            expect(playlistItem.screenIds).toEqual([1, 2]);
            expect(playlistItem.isScreenPinnable).toBe(true);
        }
        // An empty answer leaves the key out entirely, the way an unpinned entry
        // written before this existed reads.
        expect(PlaylistItem.fromActionId('screen-show', {}, []).screenIds).toBe(
            undefined,
        );
        const clearItem = PlaylistItem.fromJson(
            PLAYLIST_FILE_PATH,
            PlaylistItem.fromActionId('clear-all'),
        );
        expect(clearItem.screenAction?.requiresScreenIds).toBe(false);
    });

    test('screen show/hide drives the WINDOW, and only when it has to', () => {
        const genManager = (isShowing: boolean) => {
            const writes: boolean[] = [];
            return {
                writes,
                manager: {
                    get isShowing() {
                        return isShowing;
                    },
                    set isShowing(value: boolean) {
                        writes.push(value);
                        isShowing = value;
                    },
                } as any,
            };
        };
        const genAction = (actionId: 'screen-show' | 'screen-hide') => {
            return PlaylistItem.fromJson(
                PLAYLIST_FILE_PATH,
                PlaylistItem.fromActionId(actionId),
            ).screenAction;
        };

        const hidden = genManager(false);
        genAction('screen-show')?.apply(hidden.manager);
        expect(hidden.writes).toEqual([true]);
        const showing = genManager(true);
        genAction('screen-hide')?.apply(showing.manager);
        expect(showing.writes).toEqual([false]);

        // The setter does real show/hide window work and fires an event on
        // every write, so a sheet walked by an interval must not re-show a
        // screen that is already live.
        const alreadyShowing = genManager(true);
        genAction('screen-show')?.apply(alreadyShowing.manager);
        expect(alreadyShowing.writes).toEqual([]);
        const alreadyHidden = genManager(false);
        genAction('screen-hide')?.apply(alreadyHidden.manager);
        expect(alreadyHidden.writes).toEqual([]);
    });

    test('a run action reaches the RUN but never a screen', () => {
        const playlistItem = PlaylistItem.fromJson(
            PLAYLIST_FILE_PATH,
            PlaylistItem.fromActionId('next-timeout', { actionNumber: 20 }),
        );
        expect(playlistItem.isRunAction).toBe(true);
        expect(playlistItem.screenAction).toBe(null);
        expect(playlistItem.isScreenReachable).toBe(false);
        expect(playlistItem.isScreenPinnable).toBe(false);
        // The run stops on it and fires it — it is the sheet's own instruction.
        expect(playlistItem.isRunReachable).toBe(true);
        // Its number is read straight off the row.
        expect(playlistItem.title).toContain('20');
    });

    test('a TIMEOUT may follow a line, an INTERVAL may not', () => {
        const timeoutJson = PlaylistItem.fromActionId('next-timeout', {
            actionNumber: 20,
        });
        // "Show this, and go on by yourself 20 seconds later" — read off the
        // element every time, so re-arming it re-arms every follower of it.
        expect(PlaylistItem.resolveCcItemJson(timeoutJson)).toEqual({
            ...timeoutJson,
            type: PLAYLIST_ACTION_TYPE,
            data: 'next-timeout',
            actionNumber: 20,
        });
        expect(
            PlaylistItem.resolveCcItemJson(
                PlaylistItem.fromActionId('next-interval', {
                    actionNumber: 20,
                }),
            ),
        ).toBe(null);
    });
});
