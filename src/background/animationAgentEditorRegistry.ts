/**
 * The animation editors open NOW, for the help window's assistant
 * (2026-11-19, the user, the shader's Edit Code panel open: _add chatbot icon
 * to open in chatbot and let chatbot control editor_, the goal _chatbot can
 * help handle css and glsl code editing_).
 *
 * Each editable animation picker -- one per screen holding an animation, in
 * the Background panel's Animations tab and in Animation Show -- puts a
 * handle here while it is mounted, and its Edit Code panel -- Shader Code or
 * CSS Code -- adds the code's own handle while that is open.
 * `owa_animation_edit` reads and changes an animation through these handles
 * alone, so a change goes the way a person's press in Customize goes (the
 * picker's draft, then the screen after its pause) and code is typed into
 * the very editor on screen, as one edit Ctrl+Z takes back.
 *
 * Nothing is kept for an editor that is gone: a handle is removed by its own
 * unmount, and the short undo list each holds goes with it. A leaf: it
 * imports nothing, so neither the panel nor the agent worker pulls the other
 * in through it.
 */

export type AnimationAgentPlaceType = 'background' | 'foreground';

export type AnimationAgentCodeHandleType = {
    /** Which panel: Shader Code (glsl) or CSS Code (css). */
    engine: 'css' | 'glsl';
    getCode: () => string;
    /** Typed into the editor as one edit, so Ctrl+Z takes it back. */
    setCode: (code: string) => void;
    /** Why the code cannot run, or null when it compiles or passes. */
    checkCode: (code: string) => string | null;
    /** The panel's own Apply: false when the code cannot run. */
    apply: () => boolean;
};

export type AnimationAgentEditorHandleType = {
    id: string;
    place: AnimationAgentPlaceType;
    screenId: number | null;
    /** What Customize shows now (`toAnimationSrc` of the draft). */
    getDraftSrc: () => string | null;
    /** A change, the way a press in Customize makes it. */
    setDraftSrc: (src: string) => boolean;
    /** Edit Code opened for the animation held; false with none. */
    openCode: () => boolean;
};

/**
 * What one change by the assistant replaced, for its undo: the draft before
 * it, and the code the Edit Code panel held before code was typed in.
 */
export type AnimationAgentUndoType = {
    id: string;
    src: string | null;
    code: string | null;
};

// A few changes back is what "undo that" needs; more would be held for an
// editor nobody is looking at.
const MAX_UNDO_COUNT = 10;

type EntryType = {
    handle: AnimationAgentEditorHandleType;
    code: AnimationAgentCodeHandleType | null;
    openedAt: number;
    undoList: AnimationAgentUndoType[];
};

const entryMap = new Map<string, EntryType>();
const listenerSet = new Set<() => void>();
let openCounter = 0;
let undoCounter = 0;

function notify() {
    for (const listener of listenerSet) {
        listener();
    }
}

export function genAnimationAgentEditorId(
    place: AnimationAgentPlaceType,
    screenId: number | null,
) {
    return `${place}:${screenId ?? 'none'}`;
}

/** Puts a picker's handle in; the function returned takes it out again. */
export function registerAnimationAgentEditor(
    handle: AnimationAgentEditorHandleType,
) {
    const old = entryMap.get(handle.id);
    entryMap.set(handle.id, {
        handle,
        code: old?.code ?? null,
        openedAt: ++openCounter,
        undoList: old?.undoList ?? [],
    });
    notify();
    return () => {
        if (entryMap.get(handle.id)?.handle === handle) {
            entryMap.delete(handle.id);
            notify();
        }
    };
}

/** Puts an open Edit Code panel's handle on its picker's entry. */
export function registerAnimationAgentCode(
    editorId: string,
    code: AnimationAgentCodeHandleType,
) {
    const entry = entryMap.get(editorId);
    if (entry !== undefined) {
        entry.code = code;
        entry.openedAt = ++openCounter;
        notify();
    }
    return () => {
        const current = entryMap.get(editorId);
        if (current?.code === code) {
            current.code = null;
            notify();
        }
    };
}

/** Every open editor, the one opened or touched last first. */
export function listAnimationAgentEditors() {
    return [...entryMap.values()]
        .sort((entry1, entry2) => {
            return entry2.openedAt - entry1.openedAt;
        })
        .map((entry) => {
            return { ...entry.handle, code: entry.code };
        });
}

export type AnimationAgentEditorType = ReturnType<
    typeof listAnimationAgentEditors
>[number];

/** Told when an editor or its code panel comes or goes. */
export function onAnimationAgentEditorsChanged(listener: () => void) {
    listenerSet.add(listener);
    return () => {
        listenerSet.delete(listener);
    };
}

/** The editor the help window was opened from, so it is asked about first. */
export function touchAnimationAgentEditor(editorId: string) {
    const entry = entryMap.get(editorId);
    if (entry !== undefined) {
        entry.openedAt = ++openCounter;
    }
}

/** Keeps what a change replaced; answers the id that puts it back. */
export function pushAnimationAgentUndo(
    editorId: string,
    before: Omit<AnimationAgentUndoType, 'id'>,
) {
    const entry = entryMap.get(editorId);
    if (entry === undefined) {
        return null;
    }
    undoCounter += 1;
    const id = `animation.${undoCounter}.${Date.now().toString(36)}`;
    entry.undoList = [...entry.undoList, { id, ...before }].slice(
        -MAX_UNDO_COUNT,
    );
    return id;
}

/**
 * The change `undoId` names (the newest with none), taken off the list with
 * every change made after it: putting back what it replaced takes those
 * back too. Null when the editor or the change is gone.
 */
export function takeAnimationAgentUndo(
    editorId: string,
    undoId: string | null,
) {
    const entry = entryMap.get(editorId);
    if (entry === undefined || entry.undoList.length === 0) {
        return null;
    }
    const index =
        undoId === null
            ? entry.undoList.length - 1
            : entry.undoList.findIndex((one) => {
                  return one.id === undoId;
              });
    if (index < 0) {
        return null;
    }
    const takenList = entry.undoList.slice(index);
    // The code goes back to what the panel held before the FIRST change
    // taken that typed code: a colour change named, with code typed after
    // it, had put the colours back and left the typed code in the panel.
    const codeUndo = takenList.find((one) => {
        return one.code !== null;
    });
    const undo = { ...takenList[0], code: codeUndo?.code ?? null };
    entry.undoList = entry.undoList.slice(0, index);
    return { undo, laterCount: takenList.length - 1 };
}

/** The editor holding the change `undoId`, or null. */
export function findAnimationAgentUndoEditorId(undoId: string) {
    for (const [editorId, entry] of entryMap) {
        if (
            entry.undoList.some((one) => {
                return one.id === undoId;
            })
        ) {
            return editorId;
        }
    }
    return null;
}
