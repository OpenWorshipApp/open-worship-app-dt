// A circuit breaker on what the assistant may spend.
//
// Asked for by the user on 2026-09-10, in their own words: "I don't want to
// mistakenly get stuck in an infinite loop of programmatic error that eats
// all my credit or floods the bill." Every model round is paid for with the
// church's own API key, and until now the only things standing between a
// runaway and the bill were the ten-round cap on ONE question and the human
// pressing Stop. Neither helps when the thing asking is not a human: a
// window re-asking on every render, a card rescuing the same step for ever,
// a script driving the window, a crash-and-relaunch loop -- each one asks a
// perfectly bounded question, and then asks it again. What bounds THAT is a
// budget with a latch: past the limit the assistant refuses to post another
// round, says so, and stays refused until a PERSON presses a button. A loop
// cannot press a button. That is the whole design.
//
// Three rules, and the order matters:
//
// - It sits on the ONE seam every model call goes through -- `askLlmBot`'s
//   round loops -- checked BEFORE a round is bought and recorded the moment
//   its usage lands, whoever the caller is. A guard in the window would guard
//   the window; the report, the rescue and any caller yet to be written
//   spend through the same door, so the door is where it lives.
// - It persists. The ledger and the latch ride `appLocalStorage`, so a
//   runaway that reloads the window, or the app, arrives already paused.
// - It never spends to say no. A refused ask falls to the offline guide,
//   which costs nothing, and the refusal names the button that lifts it.
//
// The money cap is the user's (a picker in the head row, `/limit`), because
// what an hour of help is worth is their call; the pace cap is fixed, because
// a hundred and fifty model rounds in an hour is not a person at any price,
// and it is what protects a free or unpriced model that the money cap cannot
// see. Both count over a ROLLING hour, and the hour restarts when the person
// allows more -- so "allow another dollar" means exactly that.

import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    toRoundCostUsd,
    toUsdLabel,
    type LlmRoundUsageType,
} from './usageHelpers';

export const SPEND_LIMIT_SETTING_NAME = 'chatbot-spend-limit';
const SPEND_LEDGER_SETTING_NAME = 'chatbot-spend-ledger';

/**
 * The button that lifts a pause, as a pseudo tool the way the report's Send
 * and the drafted song's Create are: caught in the window's `handleActing`
 * by name, registered on no server, so nothing outside the window -- and no
 * model, whose options are only ever words -- can press it. A loop cannot
 * press a button; that sentence is only true while this stays a button.
 */
export const SPEND_ALLOW_TOOL_NAME = 'owa-spend-allow';
export const SPEND_ALLOW_LABEL = 'Allow more';

/** The window the two caps are counted over. */
export const SPEND_WINDOW_MS = 60 * 60 * 1000;
/**
 * The money cap a fresh install starts on. The standing corpus -- twelve
 * questions on Claude Sonnet 5 -- costs about $0.28, so a dollar is an hour
 * of heavy use, and a runaway on the dearest model is stopped inside a
 * minute. One press allows the next dollar.
 */
export const DEFAULT_SPEND_LIMIT_USD = 1;
/** What the picker offers, in dollars an hour. `null` is no money cap. */
export const SPEND_LIMIT_CHOICE_LIST: (number | null)[] = [
    0.25,
    0.5,
    1,
    2,
    5,
    10,
    20,
    null,
];
/**
 * The pace cap. A question is two or three rounds and takes five to fifteen
 * seconds to read, so fifty questions an hour is a volunteer working flat
 * out; a hundred and fifty rounds is past that whatever they cost, and a
 * free model's rounds cost nothing the money cap could ever notice.
 */
export const MAX_SPEND_ROUNDS_PER_HOUR = 150;
/** The share of the money cap at which the head row turns amber. */
const NEAR_LIMIT_RATIO = 0.8;
/**
 * A bound on the ledger itself, well above anything the pace cap lets
 * through, because it is JSON in a settings file read synchronously and a
 * file nobody trims is how those reach megabytes.
 */
const MAX_LEDGER_ROUNDS = 400;

export type SpendTripReasonType = 'money' | 'pace';

/**
 * One model round: when it landed, how many tokens it used, and what it
 * cost at list price (null for a model this build has no price for -- it
 * still counts towards the pace cap, and the state says how many were
 * unpriced so the money figure is never quietly understated).
 */
type SpendLedgerRoundType = [at: number, tokens: number, usd: number | null];

type SpendLedgerType = {
    rounds: SpendLedgerRoundType[];
    // The moment a person last allowed more. Rounds before it do not count,
    // which is what makes "allow another dollar" mean another dollar.
    resetAt: number;
    // The latch. Set when a cap was reached; cleared by a person, never by
    // time passing -- a runaway that is merely waited out is a runaway that
    // starts again at the top of the next hour.
    trippedAt: number | null;
    trippedBy: SpendTripReasonType | null;
};

export type SpendStateType = {
    /** Dollars an hour, or null when the money cap is off. */
    limitUsd: number | null;
    spentUsd: number;
    spentRounds: number;
    spentTokens: number;
    unpricedRounds: number;
    isTripped: boolean;
    trippedBy: SpendTripReasonType | null;
    /** Over the amber line, or paused: the head row says so either way. */
    isNearLimit: boolean;
};

/**
 * The assistant is paused. Its own class, like the cancellation, because it
 * must reach the user as itself: `describeLlmError` reads an error with no
 * status as an unreachable service, and "the internet may be down" is the
 * wrong sentence to hand someone whose guard has just done its job.
 */
export class SpendLimitError extends Error {
    readonly state: SpendStateType;
    constructor(state: SpendStateType) {
        super(describeSpendPause(state));
        this.name = 'SpendLimitError';
        this.state = state;
    }
}

export function checkIsSpendLimitError(
    error: unknown,
): error is SpendLimitError {
    return (
        error instanceof SpendLimitError ||
        (error as any)?.name === 'SpendLimitError'
    );
}

function genEmptyLedger(): SpendLedgerType {
    return { rounds: [], resetAt: 0, trippedAt: null, trippedBy: null };
}

function checkIsCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * A stored ledger, checked field by field on its way back off disk. Plain
 * JSON a hand can edit; a shape that is wrong anywhere is an empty ledger,
 * which errs on the side of the assistant answering -- the latch is the
 * one field worth keeping on its own, and it is.
 */
export function toValidSpendLedger(raw: unknown): SpendLedgerType {
    if (typeof raw !== 'object' || raw === null) {
        return genEmptyLedger();
    }
    const record = raw as Record<string, unknown>;
    const rounds: SpendLedgerRoundType[] = [];
    for (const one of Array.isArray(record.rounds) ? record.rounds : []) {
        if (!Array.isArray(one) || !checkIsCount(one[0])) {
            continue;
        }
        rounds.push([
            one[0],
            checkIsCount(one[1]) ? one[1] : 0,
            checkIsCount(one[2]) ? one[2] : null,
        ]);
    }
    const trippedBy =
        record.trippedBy === 'money' || record.trippedBy === 'pace'
            ? record.trippedBy
            : null;
    return {
        rounds: rounds.slice(-MAX_LEDGER_ROUNDS),
        resetAt: checkIsCount(record.resetAt) ? record.resetAt : 0,
        trippedAt:
            checkIsCount(record.trippedAt) && trippedBy !== null
                ? record.trippedAt
                : null,
        trippedBy,
    };
}

// The ledger lives here, written through to the settings file on every
// change. In memory because it is read before EVERY model round and a
// settings read is a file read; bounded because `MAX_LEDGER_ROUNDS` bounds it
// and the window drops what is older than an hour on every write. It is the
// window's live state, not a cache of anything.
let ledger: SpendLedgerType | null = null;
let limitUsd: number | null | undefined = undefined;
let lastState: SpendStateType | null = null;
// The amber line is said ONCE per crossing (`takeNearLimitNotice`), and
// crossing back -- an allow, a raised limit, an hour passing -- re-arms it.
let isNearLimitNoticed = false;
const listenerSet = new Set<(state: SpendStateType) => void>();

function loadLedger(): SpendLedgerType {
    if (ledger === null) {
        let parsed: unknown = null;
        try {
            const stored = getSetting(SPEND_LEDGER_SETTING_NAME);
            parsed = stored ? JSON.parse(stored) : null;
        } catch (_error) {
            // A half-written file reads as an empty ledger, deliberately:
            // see `toValidSpendLedger`.
        }
        ledger = toValidSpendLedger(parsed);
    }
    return ledger;
}

function saveLedger(next: SpendLedgerType) {
    ledger = next;
    setSetting(SPEND_LEDGER_SETTING_NAME, JSON.stringify(next));
}

function publish(state: SpendStateType) {
    lastState = state;
    if (!state.isNearLimit) {
        isNearLimitNoticed = false;
    }
    for (const listener of listenerSet) {
        listener(state);
    }
    return state;
}

/**
 * The money cap as set, in dollars an hour; null when it is off. Unset or
 * unreadable is the default, never "off": a setting that could turn the
 * guard off by being absent is a guard that a corrupt file switches off.
 */
export function getSpendLimitUsd(): number | null {
    if (limitUsd !== undefined) {
        return limitUsd;
    }
    const stored = getSetting(SPEND_LIMIT_SETTING_NAME);
    if (stored === 'off') {
        limitUsd = null;
    } else {
        const parsed = Number(stored);
        limitUsd =
            stored && Number.isFinite(parsed) && parsed > 0
                ? parsed
                : DEFAULT_SPEND_LIMIT_USD;
    }
    return limitUsd;
}

/**
 * A person changed the cap, so the latch opens: whatever tripped it, they
 * have just looked at the figure and decided. The hour is NOT restarted --
 * lowering the cap under what was already spent pauses again on the next
 * round, which is what lowering it means.
 */
export function setSpendLimitUsd(limit: number | null, now = Date.now()) {
    const next =
        limit !== null && Number.isFinite(limit) && limit > 0 ? limit : null;
    limitUsd = next;
    setSetting(SPEND_LIMIT_SETTING_NAME, next === null ? 'off' : String(next));
    const current = loadLedger();
    if (current.trippedAt !== null) {
        saveLedger({ ...current, trippedAt: null, trippedBy: null });
    }
    return publish(toSpendState(loadLedger(), now));
}

function toCountedRounds(current: SpendLedgerType, now: number) {
    const since = Math.max(now - SPEND_WINDOW_MS, current.resetAt);
    return current.rounds.filter(([at]) => {
        return at > since;
    });
}

function toSpendState(current: SpendLedgerType, now: number): SpendStateType {
    const limit = getSpendLimitUsd();
    let spentUsd = 0;
    let spentTokens = 0;
    let unpricedRounds = 0;
    const counted = toCountedRounds(current, now);
    for (const [, tokens, usd] of counted) {
        spentTokens += tokens;
        if (usd === null) {
            unpricedRounds += 1;
        } else {
            spentUsd += usd;
        }
    }
    const isTripped = current.trippedAt !== null;
    return {
        limitUsd: limit,
        spentUsd,
        spentRounds: counted.length,
        spentTokens,
        unpricedRounds,
        isTripped,
        trippedBy: isTripped ? current.trippedBy : null,
        isNearLimit:
            isTripped ||
            (limit !== null && spentUsd >= limit * NEAR_LIMIT_RATIO) ||
            counted.length >= MAX_SPEND_ROUNDS_PER_HOUR * NEAR_LIMIT_RATIO,
    };
}

/** Which cap the hour has reached, or null while there is room. */
function findReachedCap(state: SpendStateType): SpendTripReasonType | null {
    if (state.spentRounds >= MAX_SPEND_ROUNDS_PER_HOUR) {
        return 'pace';
    }
    if (state.limitUsd !== null && state.spentUsd >= state.limitUsd) {
        return 'money';
    }
    return null;
}

export function getSpendState(now = Date.now()): SpendStateType {
    // Recomputed rather than read back: an hour passing changes the figure
    // with no write to publish it.
    return toSpendState(loadLedger(), now);
}

export function subscribeSpendGuard(listener: (state: SpendStateType) => void) {
    listenerSet.add(listener);
    return () => {
        listenerSet.delete(listener);
    };
}

/**
 * A model round landed: count it, and if that reached a cap, latch.
 *
 * Called from the one place every round's usage passes through
 * (`askLlmBot`), so a caller that forgot to would have to forget to use the
 * bot at all. The round is kept even when it trips -- it was paid for.
 */
export function recordSpendRound(round: LlmRoundUsageType, now = Date.now()) {
    const current = loadLedger();
    const cost = toRoundCostUsd(round);
    const tokens =
        round.input + round.cacheRead + round.cacheWrite + round.output;
    const kept = current.rounds.filter(([at]) => {
        return at > now - SPEND_WINDOW_MS;
    });
    kept.push([now, tokens, cost]);
    let next: SpendLedgerType = {
        ...current,
        rounds: kept.slice(-MAX_LEDGER_ROUNDS),
    };
    const reached = findReachedCap(toSpendState(next, now));
    if (reached !== null && next.trippedAt === null) {
        next = { ...next, trippedAt: now, trippedBy: reached };
    }
    saveLedger(next);
    return publish(toSpendState(next, now));
}

/**
 * Before a round is bought. Refuses while the latch is set, and sets it
 * when the hour is already over a cap -- the cap may have been lowered, or
 * the last round may have been the one that reached it -- so the round that
 * would go over is the round that is never posted.
 */
export function throwIfSpendLimitReached(now = Date.now()) {
    const current = loadLedger();
    let state = toSpendState(current, now);
    if (!state.isTripped) {
        const reached = findReachedCap(state);
        if (reached === null) {
            return;
        }
        saveLedger({ ...current, trippedAt: now, trippedBy: reached });
        state = publish(toSpendState(loadLedger(), now));
    }
    throw new SpendLimitError(state);
}

/**
 * A person pressed the button. The latch opens and the hour starts again
 * from this moment, so the whole cap is available once more; the rounds
 * already paid for stay in the file (they are the truth of the bill) and
 * simply stop counting.
 */
export function allowMoreSpending(now = Date.now()) {
    const current = loadLedger();
    saveLedger({
        ...current,
        resetAt: now,
        trippedAt: null,
        trippedBy: null,
    });
    return publish(toSpendState(loadLedger(), now));
}

/** The picker's option text: "$1", "$0.25", "No limit". */
export function toSpendLimitLabel(limit: number | null) {
    if (limit === null) {
        return 'No limit';
    }
    // "$1" and "$0.50", never "$1.00" or "$0.5": the same rule as the price
    // list in the model picker, so the two read as one voice.
    return `$${limit % 1 === 0 ? limit : limit.toFixed(2)}`;
}

/** The value the picker stores and reads back: "1", "0.25", "off". */
export function toSpendLimitValue(limit: number | null) {
    return limit === null ? 'off' : String(limit);
}

export function parseSpendLimitValue(value: string): number | null | undefined {
    const trimmed = value.trim().toLowerCase().replace(/^\$/, '');
    if (trimmed === 'off' || trimmed === 'none' || trimmed === 'no limit') {
        return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) {
        return undefined;
    }
    return parsed;
}

/**
 * The head row's figure: what this hour has cost against the cap, or that
 * the assistant is paused. Short, because it sits beside three pickers in a
 * 460px window; the sentences are on the hover.
 */
export function describeSpendState(state: SpendStateType) {
    const calls = `${state.spentRounds} call${state.spentRounds === 1 ? '' : 's'}`;
    if (state.isTripped) {
        return state.trippedBy === 'pace'
            ? `paused · ${calls} this hour`
            : `paused · ≈ ${toUsdLabel(state.spentUsd)} this hour`;
    }
    if (state.spentRounds === 0) {
        return '';
    }
    const spent =
        state.spentUsd > 0 || state.unpricedRounds === 0
            ? `≈ ${toUsdLabel(state.spentUsd)}`
            : calls;
    return state.limitUsd === null
        ? `${spent} this hour`
        : `${spent} of ${toSpendLimitLabel(state.limitUsd)} this hour`;
}

/** The hover behind that figure, and the words under the picker. */
export function describeSpendGuard(state: SpendStateType) {
    const cap =
        state.limitUsd === null
            ? `The money cap is off. The assistant still pauses after ${MAX_SPEND_ROUNDS_PER_HOUR} model calls in one hour, which is more than a person asks for.`
            : `When the assistant has spent about ${toSpendLimitLabel(state.limitUsd)} in one hour (or made ${MAX_SPEND_ROUNDS_PER_HOUR} model calls), it pauses and asks before spending more, so a fault cannot run up the bill.`;
    const spent =
        state.spentRounds === 0
            ? 'Nothing has been spent in the last hour.'
            : `In the last hour: about ${toUsdLabel(state.spentUsd)} over ${state.spentRounds} model call${state.spentRounds === 1 ? '' : 's'}` +
              (state.unpricedRounds > 0
                  ? `, ${state.unpricedRounds} of them on a model with no list price here`
                  : '') +
              ', across every tab of this window. An estimate at list price.';
    const paused = state.isTripped
        ? ' The assistant is PAUSED now: press Allow more to carry on.'
        : '';
    return `${cap} ${spent}${paused}`;
}

/**
 * The sentence a refused ask is answered with. Written for the person in
 * the room: what happened, why it is a good thing, and the one button that
 * lifts it -- because a refusal that reads as a failure gets the window
 * closed, and one that reads as a decision gets the button pressed.
 */
export function describeSpendPause(state: SpendStateType) {
    // Plain words, no markup: this sentence is drawn as a NOTE over the
    // offline answer, and a note is plain text -- the asterisks would show.
    const lift =
        'Press Allow more to carry on for another hour' +
        (state.limitUsd === null
            ? ''
            : ', or raise the limit under Limit per hour at the top') +
        '. Until then the built-in guide answers for free.';
    if (state.trippedBy === 'pace') {
        return (
            `I have paused the assistant: it has made ${state.spentRounds} ` +
            'model calls in the last hour, which is more than a person ' +
            'would ask for, so something may be running away with your ' +
            `credit. ${lift}`
        );
    }
    return (
        'I have paused the assistant to protect your credit: it has spent ' +
        `about ${toUsdLabel(state.spentUsd)} in the last hour, which reaches ` +
        `the ${toSpendLimitLabel(state.limitUsd)} limit set for this window. ` +
        lift
    );
}

/**
 * The heads-up, once per crossing of the amber line: said on the answer
 * that crossed it, and not again until the hour has room in it once more.
 */
export function takeNearLimitNotice(now = Date.now()): string | null {
    const state = getSpendState(now);
    if (!state.isNearLimit || state.isTripped || isNearLimitNoticed) {
        return null;
    }
    isNearLimitNoticed = true;
    // With the share in it: at a small cap the two figures round to the
    // same cents ("$0.05 of $0.05") and the share is what says how close.
    const figure =
        state.limitUsd !== null &&
        state.spentUsd >= state.limitUsd * NEAR_LIMIT_RATIO
            ? `about ${toUsdLabel(state.spentUsd)} of the ${toSpendLimitLabel(state.limitUsd)} hourly limit is used (${Math.round((state.spentUsd / state.limitUsd) * 100)}%)`
            : `${state.spentRounds} of the ${MAX_SPEND_ROUNDS_PER_HOUR} model calls an hour are used`;
    return (
        `Heads-up: ${figure}. At the limit I pause and ask before ` +
        'spending more; the guide keeps answering for free.'
    );
}

/** The last state published, for a component mounting mid-way. */
export function getLastSpendState(now = Date.now()) {
    return lastState ?? getSpendState(now);
}

/** Tests only: forget everything held in memory. */
export function resetSpendGuardForTests() {
    ledger = null;
    limitUsd = undefined;
    lastState = null;
    isNearLimitNoticed = false;
    listenerSet.clear();
}
