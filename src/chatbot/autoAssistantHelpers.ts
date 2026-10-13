// The **Auto** row of the assistant list: who is asked when the tab leaves the
// choice to the window.
//
// Asked for by the user with a picture of the list, the space under *Free*
// circled (2026-10-12): _add `Auto` option, the chatbot should choose best no
// cost for user … check which one not busy and smarter and no cost then use it
// in asking_, and then: _keep `Auto` selected but do dynamic endpoint+model_.
// So the tab STAYS on Auto, and the server and the model are settled again in
// front of every question.
//
// This module is the POLICY and nothing else: which of the no-cost assistants
// is asked first, and what moves the question on to the next one. It imports
// no SDK, no setting store and no IPC -- what the servers said about
// themselves is handed in (`autoAssistantSourceHelpers` reads it) -- so every
// rule below is a test.
//
// Three rules, in the user's own order:
//
// - **no cost**: only an assistant whose answers are priced at nothing is a
//   candidate at all -- a server on this computer or the church's network, a
//   shared server marked free, and the keyless service. A key somebody pays
//   for is never spent by a choice nobody made.
// - **not busy**: a server that does not answer is left out; one this window
//   is already asking in another tab, and one that has just failed or just
//   taken minutes, go to the back of the line rather than out of it -- when
//   they are all there is, the best of them is still asked.
// - **smarter**: among the rest, the bigger model first.

import {
    CUSTOM_CONTEXT_MIN,
    type CustomServerKindType,
} from '../../electron/customLlmProtocol';

/** The two providers whose answers cost nothing. */
export type AutoProviderType = 'custom' | 'free';

export type AutoCandidateType = {
    provider: AutoProviderType;
    // What a tab keeps as its model: `<serverId>/<rowId>` for a server.
    model: string;
    serverId: string | null;
    // "LM Studio · Gemma 4 12B" -- who answered, in the words of the two
    // pickers the choice was taken from.
    label: string;
    // What the size is read off: the id the server knows the model by and
    // the name it is shown under.
    modelName: string;
    canSeeImages: boolean;
};

/**
 * What a candidate's server said in front of this question. Every field of a
 * server that says nothing (`kind` other, or the keyless service, which is
 * never asked about itself) is null: not known is not the same as no.
 */
export type AutoCandidateStateType = {
    isReachable: boolean;
    kind: CustomServerKindType | null;
    isLoaded: boolean | null;
    loadedContext: number | null;
};

export const UNKNOWN_AUTO_STATE: AutoCandidateStateType = {
    isReachable: true,
    kind: null,
    isLoaded: null,
    loadedContext: null,
};

/**
 * What the keyless service's models count as, in billions of parameters,
 * beside a model whose size is in its name.
 *
 * It is where the line between "ask the user's own server" and "ask the
 * public service" is drawn, and it is drawn from what was measured
 * (`extra-work/local-llm/model-benchmarks.json`, 2026-10-12): the free models
 * answered 7 of 7 volunteer questions in 8-20 seconds; a 9B model on the
 * church's own graphics card answered app questions correctly in 20-30; a 4B
 * one was right on 26 of 47 and wrong on 9. So a server's model of 8B or more
 * is asked before the public service -- it is as good, and the words stay in
 * the building -- and a smaller one, or one whose name says no size, is asked
 * after it: there for the Sunday the internet is down.
 */
export const FREE_MODEL_SIZE = 8;

// "9b", "e4b" (Gemma's effective size), "1.5b", "270m"; never the "128k" of a
// context length nor the "8" of an "8bit" quantisation.
const MODEL_SIZE_PATTERN =
    /(?<![a-z0-9.])e?(\d+(?:\.\d+)?)([bm])(?![a-z0-9])/gi;

/**
 * How big a model its name says it is, in billions of parameters, or 0 when
 * the name does not say -- the biggest figure, when a name carries two. The
 * name is all there is to go by: no server's protocol door says how good its
 * model is, and the size is the one thing nearly every model file is named
 * after.
 */
export function readModelSize(name: string): number {
    let size = 0;
    for (const match of String(name ?? '').matchAll(MODEL_SIZE_PATTERN)) {
        const value = Number(match[1]);
        if (!Number.isFinite(value)) {
            continue;
        }
        size = Math.max(
            size,
            match[2].toLowerCase() === 'm' ? value / 1000 : value,
        );
    }
    return size;
}

/** One candidate, for the memory of what just went wrong with it. */
export function toAutoCandidateKey(candidate: {
    provider: string;
    model: string;
}) {
    return `${candidate.provider}/${candidate.model}`;
}

/**
 * What an ask keeps BUSY: the whole server for one of the user's own -- a
 * local program answers one question at a time, and a second model on it
 * means unloading the first -- and the service itself for the keyless one,
 * whose free pool is rationed by caller.
 */
export function toAutoBusyKey(provider: string, model: string) {
    return provider === 'custom' ? `custom/${model.split('/')[0]}` : provider;
}

// How long a candidate that failed, or took minutes, stays at the back of the
// line. Long enough that the next few questions go straight to one that
// works; short enough that a server put right is back the same service.
const SETBACK_MILLISECONDS = 10 * 60 * 1000;
// An answer that took longer than this came from a machine too slow to be
// "not busy" in any sense a volunteer would recognise: the keyless service
// answers in 8-20 seconds and a graphics card in 20-30, while a laptop with
// no graphics card was measured at three and a half to twenty minutes.
export const AUTO_SLOW_MILLISECONDS = 3 * 60 * 1000;

// By candidate key. Bounded by the candidates there are -- a row per model of
// the user's own servers -- and an entry is dropped the first time it is
// read past its time.
const setbackUntilMap = new Map<string, number>();

export function markAutoSetback(key: string, now = Date.now()) {
    setbackUntilMap.set(key, now + SETBACK_MILLISECONDS);
}

export function clearAutoSetback(key: string) {
    setbackUntilMap.delete(key);
}

export function checkHasAutoSetback(key: string, now = Date.now()) {
    const until = setbackUntilMap.get(key);
    if (until === undefined) {
        return false;
    }
    if (until <= now) {
        setbackUntilMap.delete(key);
        return false;
    }
    return true;
}

/** Everything forgotten: the Reload beside the list, and the tests. */
export function clearAutoSetbacks() {
    setbackUntilMap.clear();
}

export type AutoRankOptionsType = {
    // A picture rides the question: a model with no eyes answers it 400.
    needsImages?: boolean;
    // A `/btw` question carries no tools and a short prompt, so the context
    // a model is loaded with is not what decides whether it can answer.
    isGeneral?: boolean;
    // `toAutoBusyKey` of every ask this window still has out.
    busyKeys?: readonly string[];
    now?: number;
};

function checkCanAnswer(
    candidate: AutoCandidateType,
    state: AutoCandidateStateType,
    options: AutoRankOptionsType,
) {
    if (!state.isReachable) {
        return false;
    }
    if (options.needsImages === true && !candidate.canSeeImages) {
        return false;
    }
    // Refused before a round by the ask itself (`askCustomServer`): the
    // app's own request does not fit, and the fix is a setting on the
    // server, which is not this question's to wait for.
    return (
        options.isGeneral === true ||
        state.loadedContext === null ||
        state.loadedContext >= CUSTOM_CONTEXT_MIN
    );
}

/**
 * The candidates that can be asked, best first.
 *
 * `stateMap` is by `toAutoCandidateKey`; a candidate it does not carry is one
 * nothing was asked about, and is taken as able to answer.
 *
 * **LM Studio serves what is loaded.** A model there is loaded by hand with a
 * context length of the owner's choosing; asking for another one makes the
 * program load it beside or instead of that one, at its default length (4k,
 * which the app's request does not fit). So while anything of an LM Studio
 * server's is loaded, only what is loaded is a candidate there -- and with
 * nothing loaded, its rows are the LAST resort, behind every assistant that
 * is ready: its list is everything ever downloaded, and the biggest file on
 * the disk is as often one the graphics card cannot hold (a 27B model beside
 * an 8 GB card, on the user's own server) as the one to ask. Ollama and a
 * llama.cpp router load on the question by design, with one context length
 * for the whole server, and offer every row at its size.
 */
export function rankAutoCandidates(
    candidates: readonly AutoCandidateType[],
    stateMap: ReadonlyMap<string, AutoCandidateStateType>,
    options: AutoRankOptionsType = {},
): AutoCandidateType[] {
    const now = options.now ?? Date.now();
    const busyKeys = options.busyKeys ?? [];
    const toState = (candidate: AutoCandidateType) => {
        return (
            stateMap.get(toAutoCandidateKey(candidate)) ?? UNKNOWN_AUTO_STATE
        );
    };
    const servingLoadedOnly = new Set<string>();
    for (const candidate of candidates) {
        const state = toState(candidate);
        if (
            candidate.serverId !== null &&
            state.kind === 'lm-studio' &&
            state.isLoaded === true
        ) {
            servingLoadedOnly.add(candidate.serverId);
        }
    }
    const rows = candidates
        .map((candidate, index) => {
            return { candidate, index, state: toState(candidate) };
        })
        .filter(({ candidate, state }) => {
            if (
                candidate.serverId !== null &&
                servingLoadedOnly.has(candidate.serverId) &&
                state.isLoaded !== true
            ) {
                return false;
            }
            return checkCanAnswer(candidate, state, options);
        })
        .map((row) => {
            const { candidate, state } = row;
            return {
                ...row,
                hasSetback: checkHasAutoSetback(
                    toAutoCandidateKey(candidate),
                    now,
                ),
                isBusy: busyKeys.includes(
                    toAutoBusyKey(candidate.provider, candidate.model),
                ),
                // Nothing of this LM Studio's is loaded (see above).
                isLastResort:
                    state.kind === 'lm-studio' && state.isLoaded === false,
                size:
                    candidate.provider === 'free'
                        ? FREE_MODEL_SIZE
                        : readModelSize(candidate.modelName),
                // Loaded, then not said, then known to need loading first.
                wait:
                    state.isLoaded === true
                        ? 0
                        : state.isLoaded === null
                          ? 1
                          : 2,
            };
        });
    rows.sort((one, other) => {
        return (
            Number(one.hasSetback) - Number(other.hasSetback) ||
            Number(one.isBusy) - Number(other.isBusy) ||
            Number(one.isLastResort) - Number(other.isLastResort) ||
            other.size - one.size ||
            // As smart as each other: the words stay in the building.
            Number(one.candidate.provider === 'free') -
                Number(other.candidate.provider === 'free') ||
            one.wait - other.wait ||
            one.index - other.index
        );
    });
    return rows.map((row) => {
        return row.candidate;
    });
}

// One question is put to this many assistants at most. Each one that fails
// has usually cost the person a wait, and a list of eight servers that are
// all switched off must not be eight waits.
export const AUTO_MAX_ATTEMPTS = 3;

export const NO_AUTO_ASSISTANT_TEXT =
    'no assistant that costs nothing could be asked just now';

/** What one attempt tells the loop about itself while it runs. */
export type AutoAttemptType = {
    // A model round came back. From then on the model may have pressed
    // something in the app, and the question is not handed to another one
    // to press it again.
    hasRound: boolean;
};

export type AutoSkipType = {
    pick: AutoCandidateType;
    reason: string;
};

/**
 * Asks the first of `picks`, and moves on to the next when it fails BEFORE
 * answering anything -- the server went away between the look and the
 * question, its model would not load, the free pool is full.
 *
 * `checkIsFinal` names the failures no other assistant would change: a Stop,
 * the spend guard's pause, the app's own tool host. A failure after a round
 * came back is final too (`AutoAttemptType`). Both are thrown as they are;
 * when every attempt failed, the last one's error is.
 */
export async function askWithAutoAssistant<T>(options: {
    picks: readonly AutoCandidateType[];
    ask: (pick: AutoCandidateType, attempt: AutoAttemptType) => Promise<T>;
    checkIsFinal: (error: any) => boolean;
    now?: () => number;
}): Promise<{ answer: T; pick: AutoCandidateType; skipped: AutoSkipType[] }> {
    const now = options.now ?? Date.now;
    const skipped: AutoSkipType[] = [];
    let lastError: any = new Error(NO_AUTO_ASSISTANT_TEXT);
    for (const pick of options.picks.slice(0, AUTO_MAX_ATTEMPTS)) {
        const key = toAutoCandidateKey(pick);
        const attempt: AutoAttemptType = { hasRound: false };
        const startedAt = now();
        try {
            const answer = await options.ask(pick, attempt);
            if (now() - startedAt > AUTO_SLOW_MILLISECONDS) {
                markAutoSetback(key, now());
            } else {
                clearAutoSetback(key);
            }
            return { answer, pick, skipped };
        } catch (error: any) {
            if (options.checkIsFinal(error)) {
                throw error;
            }
            markAutoSetback(key, now());
            if (attempt.hasRound) {
                throw error;
            }
            skipped.push({
                pick,
                reason: String(error?.message ?? '').replace(/\.+$/, ''),
            });
            lastError = error;
        }
    }
    throw lastError;
}

/**
 * The line over an Auto answer, or null when there is nothing to say: who
 * could not answer and who did, or -- with nothing having gone wrong -- that
 * this answer came from another assistant than the one above it. The first
 * answer of a tab says nothing: the head row names who was asked.
 */
export function genAutoAnswerNote(
    pick: AutoCandidateType,
    skipped: readonly AutoSkipType[],
    previousLabel: string | undefined,
): string | null {
    if (skipped.length > 0) {
        const tried = skipped
            .map((one) => {
                return one.reason.length > 0
                    ? `${one.pick.label} could not answer — ${one.reason}.`
                    : `${one.pick.label} could not answer.`;
            })
            .join(' ');
        return `${tried} Auto asked ${pick.label} instead.`;
    }
    if (previousLabel !== undefined && previousLabel !== pick.label) {
        return `Auto asked ${pick.label} this time.`;
    }
    return null;
}
