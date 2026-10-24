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
// - **smarter**: among the rest, a server's cloud model first, then the bigger
//   model first.
// - **and in the app's own language**: while the app is shown in a language
//   other than English, the models that speak such a language well are asked
//   ahead of the size order -- Gemma 4 first of all (`LANGUAGE_TIER_LIST`).

import {
    CUSTOM_CONTEXT_MIN,
    type CustomServerKindType,
} from '../../electron/customLlmProtocol';
import { fillWords, tran, tranLabel } from './chatTranHelpers';
import type { BotActionType } from './helpBotHelpers';

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

// `gemma4:cloud`, `gemma4:31b-cloud`, `deepseek-v4.1-flash:cloud`: a model
// tag that ends in `cloud`.
const CLOUD_MODEL_PATTERN = /(?:^|[\s:/_-])cloud(?=\s|$)/i;

/**
 * Whether a server's model runs in its maker's cloud rather than on the
 * server itself -- Ollama's `:cloud` and `-cloud` tags. Asked for by the user
 * with a picture of their Ollama list, two of those rows circled
 * (2026-10-17): _in `Auto` mode it should highly prefer any models ends with
 * `cloud` … let the choose cloud and stronger model first_, and then the
 * order in so many words: _cloud/strongest -> cloud/stronger -> cloud/strong
 * -> cloud -> non-cloud/strongest -> non-cloud/stronger -> ..._. Such a model
 * is the full-size one on a data centre's cards, so it answers faster and
 * better than anything a church's own machine holds, and costs this app
 * nothing: the server's owner signed it in to their own account.
 */
export function checkIsCloudModel(name: string): boolean {
    return CLOUD_MODEL_PATTERN.test(String(name ?? ''));
}

/**
 * Who is asked first while the app is shown in a language other than English
 * (`AutoRankOptionsType.languageModelsFirst`), best first. Asked for by the
 * user with a picture of the Auto picker (2026-10-20): _mode ranking to pick:
 * `gemma4:cloud` (from any assistant) -> `Nemotron Super VL` (from Free) ->
 * `gemma4:31b` -> `gemma4:12b` -> any model in `Free`_, _apply the ranking for
 * non-english app language setting only_, _e.g. my app using Khmer then Gemma4
 * should be prefered_ -- and the reason given: _gemma4 … support well for
 * language like Khmer_. A matched pattern is read off the model's id AND its
 * shown name; `provider` narrows a tier to the keyless service.
 */
export const LANGUAGE_TIER_LIST: readonly {
    provider: AutoProviderType | null;
    pattern: RegExp;
}[] = [
    // `gemma4:cloud`, `Gemma 4 Cloud` -- never `gemma4:31b-cloud`.
    {
        provider: null,
        pattern: /gemma[-_\s]?4[:/_\s-]?cloud(?![a-z0-9])/i,
    },
    // The free service's one model that speaks the language well AND sees.
    { provider: 'free', pattern: /nemotron[-_\s\d.]*super[-_\s]?vl/i },
    { provider: null, pattern: /gemma[-_\s]?4[^\s]*31b/i },
    { provider: null, pattern: /gemma[-_\s]?4[^\s]*12b/i },
    { provider: 'free', pattern: /./ },
];

// A candidate no tier names, ranked after them all, among itself by the
// ordinary rules (cloud, size, …).
export const NO_LANGUAGE_TIER = LANGUAGE_TIER_LIST.length;

/**
 * A candidate's tier of `LANGUAGE_TIER_LIST`, or `NO_LANGUAGE_TIER` when none
 * holds -- the tier decides only among the models that CAN answer: setbacks,
 * busy servers and an LM Studio with nothing loaded still go first.
 */
export function readLanguageModelTier(candidate: AutoCandidateType): number {
    const name = `${candidate.modelName} ${candidate.label}`;
    const tier = LANGUAGE_TIER_LIST.findIndex((one) => {
        return (
            (one.provider === null || one.provider === candidate.provider) &&
            one.pattern.test(name)
        );
    });
    return tier === -1 ? NO_LANGUAGE_TIER : tier;
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
    // The app is shown in a language other than English: the models that
    // speak it well (Gemma 4 first of all, `LANGUAGE_TIER_LIST`) go ahead of
    // the size order, in the list's own order (2026-10-20).
    languageModelsFirst?: boolean;
    // Models to ask FIRST among those that can answer, read off the model's
    // name -- size and setbacks aside. A verse remembered in Khmer has to be
    // put into English to be found in the KJV, and the user's word was _for
    // any translation attempt please prefer Gemma 4 models_ (2026-10-16).
    preferModelPattern?: RegExp;
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
                isPreferred:
                    options.preferModelPattern?.test(
                        `${candidate.modelName} ${candidate.label}`,
                    ) === true,
                languageTier:
                    options.languageModelsFirst === true
                        ? readLanguageModelTier(candidate)
                        : NO_LANGUAGE_TIER,
                // The keyless service is a service, not a server's model.
                isCloud:
                    candidate.provider === 'custom' &&
                    checkIsCloudModel(candidate.modelName),
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
            Number(other.isPreferred) - Number(one.isPreferred) ||
            // The app's language first, then every cloud model before every
            // other, a size-less one too: within each, the bigger first.
            one.languageTier - other.languageTier ||
            Number(other.isCloud) - Number(one.isCloud) ||
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
    // to press it again -- unless the ask's tools can only read
    // (`canHandOnAfterRound`).
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
 * came back is final too (`AutoAttemptType`) -- except for an ask whose tools
 * can only READ (`canHandOnAfterRound`: a question about a Resources file,
 * a general one with no tools), where a model that wrote nothing in the end
 * has pressed nothing either, and the next one may still answer (2026-10-22:
 * _Explain it in simple words_ under `MAT.18.pdf`, Free · Nemotron Super VL
 * wrote no answer after 34.7k tokens and the guide answered instead). Both
 * are thrown as they are; when every attempt failed, the last one's error is.
 */
export async function askWithAutoAssistant<T>(options: {
    picks: readonly AutoCandidateType[];
    ask: (pick: AutoCandidateType, attempt: AutoAttemptType) => Promise<T>;
    checkIsFinal: (error: any) => boolean;
    canHandOnAfterRound?: boolean;
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
            if (attempt.hasRound && options.canHandOnAfterRound !== true) {
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
        return fillWords(tran('{tried} Auto asked {assistant} instead.'), {
            tried: describeSkippedAssistants(skipped),
            assistant: toShownPickLabel(pick),
        });
    }
    if (previousLabel !== undefined && previousLabel !== pick.label) {
        return fillWords(tran('Auto asked {assistant} this time.'), {
            assistant: toShownPickLabel(pick),
        });
    }
    return null;
}

/**
 * One sentence for each assistant that could not answer, and why when it
 * said: what goes in front of who answered instead, or of the guide's answer
 * when nobody did.
 */
export function describeSkippedAssistants(
    skipped: readonly AutoSkipType[],
): string {
    return skipped
        .map((one) => {
            const assistant = toShownPickLabel(one.pick);
            return one.reason.length > 0
                ? fillWords(tran('{assistant} could not answer — {reason}.'), {
                      assistant,
                      reason: one.reason,
                  })
                : fillWords(tran('{assistant} could not answer.'), {
                      assistant,
                  });
        })
        .join(' ');
}

/**
 * Who a question is handed to when the assistant the TAB names -- a server of
 * the user's own, or a free model -- could not answer before saying anything
 * (2026-10-22, the user, with a picture of _Local Ollama could not answer --
 * nothing answered at http://localhost:11434/v1_ over a verse card the guide
 * had written: _when one server provider fail it should try next one_).
 * Auto's own line, the one that failed left out of it. When that one was in
 * the building, the others in the building are asked before anything outside
 * it: the person chose to keep the words here, and the public service is the
 * last thing to try, not the next.
 *
 * A key somebody pays for is never in the line, as on Auto: a paid provider
 * that fails is stood in for by another key of the user's own
 * (`getStandInLlmProvider`) and by nothing else.
 */
export function orderHandOnPicks(
    ranked: readonly AutoCandidateType[],
    failed: AutoCandidateType,
    checkIsInBuilding: (candidate: AutoCandidateType) => boolean,
): AutoCandidateType[] {
    const failedKey = toAutoCandidateKey(failed);
    const rest = ranked.filter((one) => {
        return toAutoCandidateKey(one) !== failedKey;
    });
    if (!checkIsInBuilding(failed)) {
        return rest;
    }
    return [
        ...rest.filter(checkIsInBuilding),
        ...rest.filter((one) => {
            return !checkIsInBuilding(one);
        }),
    ];
}

/**
 * The line over an answer another assistant gave because the tab's own could
 * not: who could not answer and why, and who did. The tab keeps its own pick
 * -- the next question goes to it first again, so a server switched back on
 * is asked without anybody having to choose it a second time.
 */
export function genHandOnAnswerNote(
    failed: AutoSkipType,
    pick: AutoCandidateType,
    skipped: readonly AutoSkipType[],
): string {
    return fillWords(tran('{tried} {assistant} answered instead.'), {
        tried: describeSkippedAssistants([failed, ...skipped]),
        assistant: toShownPickLabel(pick),
    });
}

// The pseudo tool under that note (2026-10-22, the user, under _Test Down
// Server could not answer … Local Ollama · gemma4:cloud answered instead_:
// _should provide user the option to change provider_, _like use another
// free or use `Auto`_). Pressed, the TAB moves -- to the one that answered,
// or to Auto -- and nothing is asked again: the answer is already there.
// Registered nowhere; only the window handles it (`handleActing`), so no
// model can move a tab.
export const USE_ASSISTANT_TOOL_NAME = 'use-assistant';
// Stored English and drawn in the window's language (`SHOWN_LABEL_PATTERN_LIST`
// in `ChatbotAppComp.tsx`; held by `chatTranLabels.test.ts`).
export const USE_AUTO_LABEL = 'Use Auto for this chat';
export const USE_ASSISTANT_LABEL_TEMPLATE = 'Use {assistant} for this chat';

/**
 * The two buttons under a hand-on note: keep asking the one that answered,
 * or leave the choosing to Auto. Only an assistant Auto could have picked is
 * ever a button -- one that costs nothing.
 */
export function genAssistantSwitchActions(
    answered: AutoCandidateType,
): BotActionType[] {
    return [
        {
            label: `Use ${toShownPickLabel(answered)} for this chat`,
            toolName: USE_ASSISTANT_TOOL_NAME,
            args: { provider: answered.provider, model: answered.model },
        },
        {
            label: USE_AUTO_LABEL,
            toolName: USE_ASSISTANT_TOOL_NAME,
            args: { auto: true },
        },
    ];
}

export type AssistantSwitchType =
    | { isAuto: true }
    | { isAuto: false; provider: AutoProviderType; model: string };

/**
 * What a press of one of them asks for, as it may be trusted -- read off a
 * saved conversation too, so a hand-edited button can name no paid key and
 * nothing that is not a model id. Null for anything else.
 */
export function readAssistantSwitch(args: unknown): AssistantSwitchType | null {
    if (args === null || typeof args !== 'object') {
        return null;
    }
    const { auto, provider, model } = args as Record<string, unknown>;
    if (auto === true) {
        return { isAuto: true };
    }
    if (
        (provider !== 'custom' && provider !== 'free') ||
        typeof model !== 'string' ||
        model.trim().length === 0 ||
        model.length > 200
    ) {
        return null;
    }
    return { isAuto: false, provider, model };
}

/**
 * A pick's label as the person reads it: `Free · Nemotron Super VL` says
 * the keyless service's word in the app's language and keeps the model's
 * name. A server's name is the user's own and stays as they wrote it, and
 * the label itself is untouched -- it is compared and matched.
 */
function toShownPickLabel(pick: AutoCandidateType): string {
    if (pick.provider !== 'free') {
        return pick.label;
    }
    const [service, ...rest] = pick.label.split(' · ');
    return [tranLabel(service), ...rest].join(' · ');
}
