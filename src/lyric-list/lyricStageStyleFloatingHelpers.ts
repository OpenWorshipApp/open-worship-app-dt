import { useSyncExternalStore } from 'react';

/**
 * WHICH stage's style panel is open, if any, and WHICH previewer owns it.
 *
 * A shared store rather than per-chip state, so exactly one widget exists no
 * matter how many stage chips are listed — clicking another chip's gear
 * RETARGETS the open panel instead of opening a second one.
 *
 * The OWNER is half the answer, and it is load-bearing. `LyricSlidesPreviewerComp`
 * mounts the widget host itself, and more than one of them can be on screen at
 * once: a floating document preview of a `.owl` renders the very same tree
 * (`VaryAppDocumentPreviewerCardComp` -> `PreviewerBodyComp` -> `LyricHandlerComp`)
 * for a document the main panel is not showing. With a stage alone in here,
 * every mounted host answered "open" to the same click and each portaled its own
 * `FloatingWidgetComp` under the ONE `persistKey` — two identical panels stacked
 * on one rect, each with its own commit timer racing on the same
 * `lyric-stage-style-<n>` setting, and each refreshing a DIFFERENT lyric. Keyed
 * by owner, only the previewer whose gear was actually clicked opens a panel,
 * which is also the only one whose `onChanged` refreshes the right song.
 *
 * In memory only, unlike the widget's own size/position (which
 * `FloatingWidgetComp` persists under its `persistKey`): this is what the
 * operator has open right now, not something worth restoring days later, and a
 * setting would mean a synchronous file write on every toggle.
 */
export type LyricStageStyleFloatingStateType = {
    ownerId: string | null;
    stage: number | null;
};

const listeners = new Set<() => void>();

// REPLACED, never mutated: `useSyncExternalStore` compares snapshots by
// identity, so an in-place edit would never re-render.
let state: LyricStageStyleFloatingStateType = { ownerId: null, stage: null };

let ownerCount = 0;

/**
 * A fresh id for one previewer's widget host. A plain counter, taken once per
 * mount through `useMemo` — NOT `useId`, whose generated ids carry characters
 * that would need escaping if this ever reached a selector.
 */
export function genLyricStageStyleFloatingOwnerId() {
    ownerCount += 1;
    return `lyric-stage-style-owner-${ownerCount}`;
}

function getState() {
    return state;
}

function setState(ownerId: string | null, stage: number | null) {
    if (state.ownerId === ownerId && state.stage === stage) {
        return;
    }
    state = { ownerId, stage };
    for (const listener of listeners) {
        listener();
    }
}

export function toggleLyricStageStyleFloatingStage(
    ownerId: string,
    stage: number,
) {
    const isOpened = state.ownerId === ownerId && state.stage === stage;
    setState(isOpened ? null : ownerId, isOpened ? null : stage);
}

/**
 * Drop the panel when the previewer that opened it goes away — a floating
 * document preview being closed, or the main panel swapping to another
 * document. Scoped to the owner so a host unmounting cannot shut a panel that
 * belongs to a previewer still on screen.
 */
export function closeLyricStageStyleFloating(ownerId: string) {
    if (state.ownerId !== ownerId) {
        return;
    }
    setState(null, null);
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * The stage THIS previewer has open, or `null` — which is also the answer while
 * another previewer has a panel open.
 */
export function useLyricStageStyleFloatingStage(ownerId: string) {
    const currentState = useSyncExternalStore(subscribe, getState, getState);
    return currentState.ownerId === ownerId ? currentState.stage : null;
}
