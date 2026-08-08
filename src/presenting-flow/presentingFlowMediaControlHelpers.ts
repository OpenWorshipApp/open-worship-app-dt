/**
 * What a `Slide: Media Control` is set to do — the config, and nothing else.
 *
 * Deliberately a LEAF, for the same reason `presentingFlowCcHelpers` is one and more
 * so: this type is read by the presenting flow model, by the settings panel, and by
 * the executor over in `src/_screen/managers/screenSlideMediaControlHelpers.ts`.
 * Nothing translated, nothing that reads a file, no React, no `appProvider` — or
 * the screen managers would drag the whole presenting flow graph in behind it.
 */

/**
 * What the controller DOES when its host goes up.
 *
 * `pause`/`stop` exist because a run sheet has to be able to take back what an
 * earlier line started: an operator who armed a video on one slide needs a later
 * line that cuts it, and `Clear Slide` (which takes the slide down with it) is the
 * only thing that could do that before. `stop` is `pause` plus a rewind to where
 * the play would have started, so the same line can be run twice over.
 */
export const presentingFlowMediaControlModeList = [
    'play',
    'pause',
    'stop',
] as const;

export type PresentingFlowMediaControlModeType =
    (typeof presentingFlowMediaControlModeList)[number];

/**
 * The English label of each mode — the `tran` KEY, not the translated text: this
 * module stays dependency-free (the screen managers import it), so the one place
 * that draws a mode calls `tran` on what it finds here. Keyed by the mode so a
 * fourth one would be a compile error rather than a row reading `undefined`.
 */
export const presentingFlowMediaControlModeLabelMap: Record<
    PresentingFlowMediaControlModeType,
    string
> = {
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
};

/** The two ways of saying "and then stop", as the panel asks it. */
export const presentingFlowMediaControlPauseKindList = [
    'none',
    'after',
    'at',
] as const;

export type PresentingFlowMediaControlPauseKindType =
    (typeof presentingFlowMediaControlPauseKindList)[number];

/**
 * A media controller's settings, stored per ATTACHMENT (on the CC record, not on
 * the action element) — see `PresentingFlowCcItemType`.
 *
 * Every field but `mode` is OPTIONAL, and absence means "leave it alone" rather
 * than "use a default". That distinction is the whole contract: an operator who
 * set the volume by hand on the mini screen must not have it reset to 100 by a
 * controller that only meant to start the video, and a controller that only meant
 * to set the volume must not also seek the media back to 0.
 */
export type PresentingFlowMediaControlType = {
    mode: PresentingFlowMediaControlModeType;
    /** Seconds to wait after the host lands before doing anything. */
    delaySecond?: number;
    /** Seek the media to this point on its own clock before playing. */
    startAtSecond?: number;
    /**
     * Pause this many seconds after the playback starts.
     *
     * An ALTERNATIVE to `pauseAtSecond`, never stored beside it — "for a minute"
     * and "up to 1:10" are two ways of answering one question, and a config
     * carrying both would have a rule to invent about which wins.
     */
    pauseAfterSecond?: number;
    /** Pause when the media's OWN time reaches this. Alternative to the above. */
    pauseAtSecond?: number;
    /**
     * 0-100.
     *
     * Presenter side only, and not a limitation to fix: the projected screen holds
     * every slide media `muted` on purpose (`ScreenVaryAppDocumentManager.cleanupSlideContent`)
     * because the sound comes out of the presenter machine. A volume applied on the
     * screen copy would be a number that changed nothing anybody could hear.
     */
    volume?: number;
    /** Playback rate — 2 for 2x. Synced to the screen, unlike the volume. */
    speed?: number;
};

const MAX_VOLUME = 100;
const MAX_SPEED = 16;

function toOptionalSecond(value: any): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return undefined;
    }
    return value;
}

/**
 * A stored config read back, or null when there is nothing usable there.
 *
 * DEFENSIVE, and never throwing, exactly as `toScreenIds` is: a hand-edited file or
 * one written by a later version must not turn a run sheet line into an error row
 * mid-service. An unreadable field is dropped and the rest of the config still
 * runs; an unreadable MODE is the one thing that answers null, since there is
 * nothing left to do without it.
 */
export function toPresentingFlowMediaControl(
    raw: any,
): PresentingFlowMediaControlType | null {
    if (raw === null || typeof raw !== 'object') {
        return null;
    }
    const { mode } = raw;
    if (!presentingFlowMediaControlModeList.includes(mode)) {
        return null;
    }
    const config: PresentingFlowMediaControlType = { mode };
    const delaySecond = toOptionalSecond(raw.delaySecond);
    if (delaySecond !== undefined) {
        config.delaySecond = delaySecond;
    }
    const startAtSecond = toOptionalSecond(raw.startAtSecond);
    if (startAtSecond !== undefined) {
        config.startAtSecond = startAtSecond;
    }
    // Read as alternatives on the way IN as well as on the way out, so a
    // hand-edited config carrying both is not left with a rule to invent.
    const pauseAtSecond = toOptionalSecond(raw.pauseAtSecond);
    const pauseAfterSecond = toOptionalSecond(raw.pauseAfterSecond);
    if (pauseAtSecond !== undefined) {
        config.pauseAtSecond = pauseAtSecond;
    } else if (pauseAfterSecond !== undefined) {
        config.pauseAfterSecond = pauseAfterSecond;
    }
    const { volume } = raw;
    if (
        typeof volume === 'number' &&
        Number.isFinite(volume) &&
        volume >= 0 &&
        volume <= MAX_VOLUME
    ) {
        config.volume = volume;
    }
    const { speed } = raw;
    if (
        typeof speed === 'number' &&
        Number.isFinite(speed) &&
        speed > 0 &&
        speed <= MAX_SPEED
    ) {
        config.speed = speed;
    }
    return config;
}

/**
 * Write ONE of the two pause fields and delete the other — the same rule
 * `applyPresentingFlowActionArming` follows for the three arming fields, and for the
 * same reason: a config re-answered with "after 30 seconds" that still carried the
 * "at 1:10" it was given last time would be running on the field that quietly
 * stopped mattering.
 */
export function applyPresentingFlowMediaControlPause(
    config: PresentingFlowMediaControlType,
    pauseKind: PresentingFlowMediaControlPauseKindType,
    second: number,
): PresentingFlowMediaControlType {
    const { pauseAfterSecond: _after, pauseAtSecond: _at, ...rest } = config;
    if (pauseKind === 'after') {
        return { ...rest, pauseAfterSecond: second };
    }
    if (pauseKind === 'at') {
        return { ...rest, pauseAtSecond: second };
    }
    return rest;
}

/** Which half of the pause question a stored config answers. */
export function toPresentingFlowMediaControlPauseKind(
    config: PresentingFlowMediaControlType | null,
): PresentingFlowMediaControlPauseKindType {
    if (config === null) {
        return 'none';
    }
    if (config.pauseAtSecond !== undefined) {
        return 'at';
    }
    if (config.pauseAfterSecond !== undefined) {
        return 'after';
    }
    return 'none';
}

/**
 * The parameters a row shows after the mode, shortest form that still says what it
 * will do — `10s→70s 70% 2x`.
 *
 * Numbers only, no words: this is appended AFTER `tran(label)` and after the
 * translated mode, so nothing here may become part of a `tran` key (a baked-in
 * number is a key that throws on the next locale).
 */
export function toPresentingFlowMediaControlSummary(
    config: PresentingFlowMediaControlType,
): string {
    const parts: string[] = [];
    const { delaySecond, startAtSecond, pauseAfterSecond, pauseAtSecond } =
        config;
    if (delaySecond) {
        parts.push(`+${delaySecond}s`);
    }
    if (config.mode !== 'pause') {
        const from = startAtSecond ?? 0;
        if (pauseAtSecond !== undefined) {
            parts.push(`${from}s→${pauseAtSecond}s`);
        } else if (startAtSecond) {
            parts.push(`${from}s`);
        }
    }
    if (pauseAfterSecond !== undefined) {
        parts.push(`${pauseAfterSecond}s`);
    }
    if (config.volume !== undefined) {
        parts.push(`${config.volume}%`);
    }
    if (config.speed !== undefined) {
        parts.push(`${config.speed}x`);
    }
    return parts.join(' ');
}
