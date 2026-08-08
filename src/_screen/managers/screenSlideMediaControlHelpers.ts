import type { PresentingFlowMediaControlType } from '../../presenting-flow/presentingFlowMediaControlHelpers';
import { playMediaElement } from '../../helper/mediaHelpers';
import type { SlideYouTubePlayer } from './slideYouTubeSyncHelpers';
import type ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';

/**
 * Driving the media of the slide that is on a screen — what a run sheet's
 * `Slide: Media Control` element actually does.
 *
 * It lives here, under `_screen`, rather than beside the action it serves: the
 * presenting flow may import the screen managers (it already does, for their types)
 * but nothing under `_screen` may import the presenting flow, and
 * `ScreenVaryAppDocumentManager` has to be able to call the canceller below. The
 * only presenting flow thing reached from here is the config TYPE, whose module is
 * a deliberate dependency-free leaf for exactly this.
 *
 * **It runs on the PRESENTER side, and that is the whole trick.** A slide's media is
 * two elements in two windows: the presenter's mini screen holds the sound and the
 * controls, and the projected screen is a muted follower kept in step by
 * `'vary-app-document-video-time'`. So this drives the presenter's element and lets
 * the projection follow through the `play`/`pause`/`timeupdate` listeners
 * `cleanupSlideContent` already attached — the same route an operator's own click on
 * the mini screen takes. Reaching into the screen window directly would mean a new
 * message per parameter and would fight those listeners for the play state.
 */

const MILLISECOND_PER_SECOND = 1000;
const MAX_VOLUME = 100;

type SlideMediaControlSlotType = {
    /**
     * Which arming this slot IS, from a counter that only ever goes up.
     *
     * Clearing a timeout does not unqueue a callback that has already been handed
     * its tick, so a fired handler re-reads the slot and compares: a slot that has
     * been dropped (new slide) or replaced (newer controller) strands it. Same
     * guard `presentingFlowAutoNextHelpers` uses, for the same reason.
     */
    generation: number;
    timeoutIds: any[];
    /** Listener removals — a `timeupdate` watcher must not outlive its slide. */
    cleanupList: (() => void)[];
};

/**
 * One slot per SCREEN, in memory only, holding nothing while nothing is armed.
 *
 * Keyed by screen id rather than by controller: two controllers aimed at one
 * screen are two answers to "what should this media be doing", and the later one
 * wins outright. Keeping both would leave the first one's pause firing into the
 * second one's playback.
 */
const slotMap = new Map<number, SlideMediaControlSlotType>();
let generationCounter = 0;

/**
 * Drop everything armed for a screen.
 *
 * Called by `ScreenVaryAppDocumentManager` from the one place a slide (or a null)
 * lands, so nothing armed for one slide can fire against the next: a "pause at
 * 1:10" left running would pause whatever the operator put up in the meantime, and
 * a `timeupdate` watcher on a replaced element would hold that element — and the
 * slide behind it — for as long as the app ran.
 */
export function cancelScreenSlideMediaControl(screenId: number) {
    const slot = slotMap.get(screenId);
    if (slot === undefined) {
        return;
    }
    // Dropped rather than emptied in place: a screen running no controller must
    // cost nothing to hold, and the missing entry is itself what strands any tick
    // already queued against it.
    slotMap.delete(screenId);
    for (const timeoutId of slot.timeoutIds) {
        clearTimeout(timeoutId);
    }
    for (const cleanup of slot.cleanupList) {
        cleanup();
    }
}

function armSlot(screenId: number): SlideMediaControlSlotType {
    cancelScreenSlideMediaControl(screenId);
    generationCounter += 1;
    const slot: SlideMediaControlSlotType = {
        generation: generationCounter,
        timeoutIds: [],
        cleanupList: [],
    };
    slotMap.set(screenId, slot);
    return slot;
}

function schedule(
    slot: SlideMediaControlSlotType,
    screenId: number,
    second: number,
    handler: () => void,
) {
    const { generation } = slot;
    const timeoutId = setTimeout(() => {
        if (slotMap.get(screenId)?.generation !== generation) {
            return;
        }
        handler();
    }, second * MILLISECOND_PER_SECOND);
    slot.timeoutIds.push(timeoutId);
}

type SlideMediaType = {
    mediaElements: HTMLMediaElement[];
    youTubePlayers: SlideYouTubePlayer[];
};

/**
 * Everything the current slide holds that can be played, in both flavours.
 *
 * A preview-only canvas `audio` item is included on purpose: it exists on the
 * presenter side only (the projected screen hides it and never fetches it), so it
 * plays out of the presenter machine exactly as a background audio does. That IS
 * its design, and a controller that skipped it would silently ignore half of what
 * "all the media in this slide" means to an operator looking at the slide.
 *
 * Re-read at each step rather than captured once: a re-render for another reason
 * (a stage change) replaces the elements without changing the slide, and a handler
 * holding the old ones would act on nodes that are no longer on screen.
 */
function collectMedia(manager: ScreenVaryAppDocumentManager): SlideMediaType {
    return {
        mediaElements: manager.getAllMediaElements(),
        youTubePlayers: manager.getSlideYouTubePlayers(),
    };
}

function pauseAll(manager: ScreenVaryAppDocumentManager) {
    const { mediaElements, youTubePlayers } = collectMedia(manager);
    for (const mediaElement of mediaElements) {
        if (!mediaElement.paused) {
            mediaElement.pause();
        }
    }
    for (const player of youTubePlayers) {
        if (player.isPlaying) {
            player.pause();
        }
    }
}

/**
 * "Stop at 1:10" on a native element is WATCHED rather than timed: `timeupdate`
 * already fires for the sync wiring, so the media's own clock is free, and neither
 * a rate change nor a manual scrub mid-play can make it miss. One-shot — removed
 * when it fires and, if it never does, when the slide goes.
 */
function watchPauseAtSecond(
    slot: SlideMediaControlSlotType,
    mediaElement: HTMLMediaElement,
    pauseAtSecond: number,
) {
    const handleTimeUpdate = () => {
        if (mediaElement.currentTime < pauseAtSecond) {
            return;
        }
        mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
        if (!mediaElement.paused) {
            mediaElement.pause();
        }
    };
    mediaElement.addEventListener('timeupdate', handleTimeUpdate);
    slot.cleanupList.push(() => {
        mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
    });
}

function applyVolumeAndSpeed(
    manager: ScreenVaryAppDocumentManager,
    media: SlideMediaType,
    config: PresentingFlowMediaControlType,
) {
    const { volume, speed } = config;
    if (volume === undefined && speed === undefined) {
        return;
    }
    for (const mediaElement of media.mediaElements) {
        if (volume !== undefined) {
            // Presenter side only, by design — see the note on the config field.
            mediaElement.volume = volume / MAX_VOLUME;
        }
        if (speed === undefined) {
            continue;
        }
        mediaElement.playbackRate = speed;
        // Broadcast at once rather than waiting for the next `timeupdate`: a
        // paused element emits none, so a rate set before the play would
        // otherwise never reach the projection — which would then be re-seeked
        // forward on every tick to keep up with a master running at 2x.
        if (mediaElement.id) {
            void manager.setSlideVideoCurrentTimeForce(
                mediaElement.id,
                mediaElement.currentTime,
                !mediaElement.paused,
                speed,
            );
        }
    }
    for (const player of media.youTubePlayers) {
        if (volume !== undefined) {
            player.setVolume(volume);
        }
        if (speed !== undefined) {
            player.setPlaybackRate(speed);
        }
    }
}

function startPlaying(
    slot: SlideMediaControlSlotType,
    manager: ScreenVaryAppDocumentManager,
    media: SlideMediaType,
    config: PresentingFlowMediaControlType,
) {
    const { startAtSecond, pauseAtSecond, speed } = config;
    for (const mediaElement of media.mediaElements) {
        if (startAtSecond !== undefined) {
            mediaElement.currentTime = startAtSecond;
        }
        if (pauseAtSecond !== undefined) {
            watchPauseAtSecond(slot, mediaElement, pauseAtSecond);
        }
        // `playMediaElement` rather than `.play()`: it swallows the AbortError a
        // play/pause race throws, and a controller playing media the operator is
        // already touching is a prime source of one.
        playMediaElement(mediaElement);
    }
    for (const player of media.youTubePlayers) {
        const fromSecond = startAtSecond ?? player.getCurrentTime();
        if (startAtSecond !== undefined) {
            player.seekTo(startAtSecond);
        }
        player.play();
        if (pauseAtSecond === undefined || pauseAtSecond <= fromSecond) {
            continue;
        }
        // A YouTube embed has no `timeupdate` of its own to hang a watcher on
        // (its one time callback is already taken by the group sync), so its stop
        // point is TIMED from the media-clock delta instead of watched. Off by
        // however long the player takes to start — acceptable for a stop point,
        // and the only reading that does not add a poll.
        schedule(
            slot,
            manager.screenId,
            (pauseAtSecond - fromSecond) / (speed ?? 1),
            () => {
                if (player.isPlaying) {
                    player.pause();
                }
            },
        );
    }
}

function run(
    slot: SlideMediaControlSlotType,
    manager: ScreenVaryAppDocumentManager,
    config: PresentingFlowMediaControlType,
) {
    const media = collectMedia(manager);
    // Volume and speed are set in every mode and BEFORE the mode acts: they say
    // how the media should sound and run rather than whether it is running, so a
    // `Pause` controller may legitimately be the line that turns the volume down.
    applyVolumeAndSpeed(manager, media, config);
    const { mode, startAtSecond, pauseAfterSecond } = config;
    if (mode === 'pause') {
        pauseAll(manager);
        return;
    }
    if (mode === 'stop') {
        pauseAll(manager);
        for (const mediaElement of media.mediaElements) {
            // Back to where a `play` on this same line would have begun, so the
            // line reads the same run twice over. The seek broadcasts itself
            // through the `timeupdate` listener the sync wiring already attached.
            mediaElement.currentTime = startAtSecond ?? 0;
        }
        for (const player of media.youTubePlayers) {
            player.seekTo(startAtSecond ?? 0);
        }
        return;
    }
    startPlaying(slot, manager, media, config);
    if (pauseAfterSecond !== undefined) {
        schedule(slot, manager.screenId, pauseAfterSecond, () => {
            pauseAll(manager);
        });
    }
}

/**
 * Run one controller against one screen.
 *
 * Nothing happens when the screen holds no slide: a controller whose host resolved
 * to a screen showing nothing has no media to reach, and arming a three-second
 * delay against it would fire into whatever landed in between.
 */
export function applyScreenSlideMediaControl(
    manager: ScreenVaryAppDocumentManager,
    config: PresentingFlowMediaControlType | null,
) {
    if (config === null || manager.div === null) {
        return;
    }
    const slot = armSlot(manager.screenId);
    const { delaySecond } = config;
    if (!delaySecond) {
        run(slot, manager, config);
        return;
    }
    schedule(slot, manager.screenId, delaySecond, () => {
        run(slot, manager, config);
    });
}
