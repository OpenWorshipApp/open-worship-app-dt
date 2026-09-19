import { beforeEach, describe, expect, test, vi } from 'vitest';

// The guard rides the settings store; an in-memory map stands in for the
// file, the same way the session and tip tests do it.
const settingMap = new Map<string, string>();
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    DEFAULT_SPEND_LIMIT_USD,
    MAX_SPEND_ROUNDS_PER_HOUR,
    SPEND_WINDOW_MS,
    SpendLimitError,
    allowMoreSpending,
    checkIsSpendLimitError,
    describeSpendGuard,
    describeSpendPause,
    describeSpendState,
    getSpendLimitUsd,
    getSpendState,
    parseSpendLimitValue,
    recordSpendRound,
    resetSpendGuardForTests,
    setSpendLimitUsd,
    subscribeSpendGuard,
    takeNearLimitNotice,
    throwIfSpendLimitReached,
    toSpendLimitLabel,
    toSpendLimitValue,
    toValidSpendLedger,
} from './spendGuardHelpers';
import type { LlmRoundUsageType } from './usageHelpers';

// A cache-cold round on Claude Sonnet 5, about four cents at list price --
// what the standing corpus's first question costs on its first round.
const COLD_ROUND: LlmRoundUsageType = {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    input: 6,
    cacheRead: 0,
    cacheWrite: 16875,
    output: 425,
};
// About $0.19 -- a round on the dearest model with a big uncached prompt,
// which is what a runaway looks like when nothing is cached any more.
const DEAR_ROUND: LlmRoundUsageType = {
    provider: 'anthropic',
    model: 'claude-opus-5',
    input: 30000,
    cacheRead: 0,
    cacheWrite: 0,
    output: 1500,
};
const FREE_ROUND: LlmRoundUsageType = {
    provider: 'free',
    model: 'nemotron',
    input: 8000,
    cacheRead: 0,
    cacheWrite: 0,
    output: 200,
};
const UNPRICED_ROUND: LlmRoundUsageType = {
    provider: 'kimi',
    model: 'kimi-k2-turbo-preview',
    input: 8000,
    cacheRead: 0,
    cacheWrite: 0,
    output: 200,
};

const T0 = 1_800_000_000_000;

beforeEach(() => {
    settingMap.clear();
    resetSpendGuardForTests();
});

describe('the limit setting', () => {
    test('a fresh install starts on the default, not on "off"', () => {
        expect(getSpendLimitUsd()).toBe(DEFAULT_SPEND_LIMIT_USD);
    });

    test('a corrupt or absurd value reads as the default too', () => {
        settingMap.set('chatbot-spend-limit', 'lots');
        expect(getSpendLimitUsd()).toBe(DEFAULT_SPEND_LIMIT_USD);
        resetSpendGuardForTests();
        settingMap.set('chatbot-spend-limit', '-3');
        expect(getSpendLimitUsd()).toBe(DEFAULT_SPEND_LIMIT_USD);
    });

    test('"off" is the one word that turns the money cap off', () => {
        settingMap.set('chatbot-spend-limit', 'off');
        expect(getSpendLimitUsd()).toBeNull();
    });

    test('setting it writes the value the picker reads back', () => {
        setSpendLimitUsd(2, T0);
        expect(settingMap.get('chatbot-spend-limit')).toBe('2');
        expect(getSpendLimitUsd()).toBe(2);
        setSpendLimitUsd(null, T0);
        expect(settingMap.get('chatbot-spend-limit')).toBe('off');
        expect(getSpendLimitUsd()).toBeNull();
    });

    test('the picker labels and values round-trip', () => {
        expect(toSpendLimitLabel(1)).toBe('$1');
        expect(toSpendLimitLabel(0.25)).toBe('$0.25');
        expect(toSpendLimitLabel(0.5)).toBe('$0.50');
        expect(toSpendLimitLabel(null)).toBe('No limit');
        expect(parseSpendLimitValue(toSpendLimitValue(0.5))).toBe(0.5);
        expect(parseSpendLimitValue(toSpendLimitValue(null))).toBeNull();
        expect(parseSpendLimitValue('$2')).toBe(2);
        expect(parseSpendLimitValue('none')).toBeNull();
        expect(parseSpendLimitValue('two')).toBeUndefined();
        expect(parseSpendLimitValue('0')).toBeUndefined();
        expect(parseSpendLimitValue('5000')).toBeUndefined();
    });
});

describe('counting the hour', () => {
    test('nothing spent is nothing to say', () => {
        const state = getSpendState(T0);
        expect(state.spentRounds).toBe(0);
        expect(state.isTripped).toBe(false);
        expect(state.isNearLimit).toBe(false);
        expect(describeSpendState(state)).toBe('');
        expect(() => throwIfSpendLimitReached(T0)).not.toThrow();
    });

    test('a round is counted with its cost and its tokens', () => {
        const state = recordSpendRound(COLD_ROUND, T0);
        expect(state.spentRounds).toBe(1);
        expect(state.spentTokens).toBe(6 + 16875 + 425);
        expect(state.spentUsd).toBeCloseTo(0.0464, 3);
        expect(describeSpendState(state)).toBe('≈ $0.05 of $1 this hour');
    });

    test('a round older than an hour stops counting, and stops being stored', () => {
        recordSpendRound(COLD_ROUND, T0);
        recordSpendRound(COLD_ROUND, T0 + SPEND_WINDOW_MS + 1);
        expect(getSpendState(T0 + SPEND_WINDOW_MS + 1).spentRounds).toBe(1);
        const stored = JSON.parse(settingMap.get('chatbot-spend-ledger')!);
        expect(stored.rounds).toHaveLength(1);
    });

    test('an unpriced round counts towards the pace and is named', () => {
        const state = recordSpendRound(UNPRICED_ROUND, T0);
        expect(state.spentRounds).toBe(1);
        expect(state.unpricedRounds).toBe(1);
        expect(state.spentUsd).toBe(0);
        expect(describeSpendState(state)).toBe('1 call of $1 this hour');
        expect(describeSpendGuard(state)).toContain('no list price');
    });

    test('the amber line is four fifths of the cap', () => {
        setSpendLimitUsd(0.25, T0);
        for (let i = 0; i < 4; i++) {
            recordSpendRound(COLD_ROUND, T0 + i);
        }
        // ~$0.186 of $0.25.
        expect(getSpendState(T0 + 10).isNearLimit).toBe(false);
        recordSpendRound(COLD_ROUND, T0 + 5);
        // ~$0.232 of $0.25.
        const state = getSpendState(T0 + 10);
        expect(state.isNearLimit).toBe(true);
        expect(state.isTripped).toBe(false);
    });

    test('the heads-up is said once per crossing', () => {
        setSpendLimitUsd(0.25, T0);
        expect(takeNearLimitNotice(T0)).toBeNull();
        for (let i = 0; i < 5; i++) {
            recordSpendRound(COLD_ROUND, T0 + i);
        }
        const notice = takeNearLimitNotice(T0 + 10);
        expect(notice).toContain('of the $0.25 hourly limit');
        expect(takeNearLimitNotice(T0 + 11)).toBeNull();
        // The hour passes: room again, and the line is armed again.
        expect(takeNearLimitNotice(T0 + SPEND_WINDOW_MS + 10)).toBeNull();
        recordSpendRound(COLD_ROUND, T0 + SPEND_WINDOW_MS + 11);
        for (let i = 0; i < 4; i++) {
            recordSpendRound(COLD_ROUND, T0 + SPEND_WINDOW_MS + 12 + i);
        }
        expect(takeNearLimitNotice(T0 + SPEND_WINDOW_MS + 20)).not.toBeNull();
    });
});

describe('the money cap', () => {
    test('the round that reaches the cap latches, and the next is refused', () => {
        setSpendLimitUsd(0.5, T0);
        let state = getSpendState(T0);
        for (let i = 0; i < 3; i++) {
            expect(() => throwIfSpendLimitReached(T0 + i)).not.toThrow();
            state = recordSpendRound(DEAR_ROUND, T0 + i);
        }
        // Three rounds at ~$0.19 is ~$0.56: over.
        expect(state.spentUsd).toBeGreaterThan(0.5);
        expect(state.isTripped).toBe(true);
        expect(state.trippedBy).toBe('money');
        expect(state.isNearLimit).toBe(true);
        expect(() => throwIfSpendLimitReached(T0 + 5)).toThrow(SpendLimitError);
        expect(describeSpendState(state)).toMatch(
            /^paused · ≈ \$0\.5\d this hour$/,
        );
    });

    test('the refusal is a sentence for the room, with the button named', () => {
        setSpendLimitUsd(0.25, T0);
        recordSpendRound(DEAR_ROUND, T0);
        recordSpendRound(DEAR_ROUND, T0 + 1);
        let raised: any = null;
        try {
            throwIfSpendLimitReached(T0 + 2);
        } catch (error) {
            raised = error;
        }
        expect(checkIsSpendLimitError(raised)).toBe(true);
        expect(raised.message).toContain(
            'paused the assistant to protect your credit',
        );
        expect(raised.message).toContain('$0.25 limit');
        expect(raised.message).toContain('Press Allow more');
        expect(raised.message).not.toContain('*');
        expect(raised.message).toContain('guide answers for free');
        expect(raised.message).not.toMatch(/internet|undefined|null/);
    });

    test('the latch holds across an hour passing -- time never lifts it', () => {
        setSpendLimitUsd(0.25, T0);
        recordSpendRound(DEAR_ROUND, T0);
        recordSpendRound(DEAR_ROUND, T0 + 1);
        expect(getSpendState(T0 + 2).isTripped).toBe(true);
        const later = T0 + 3 * SPEND_WINDOW_MS;
        expect(getSpendState(later).spentRounds).toBe(0);
        expect(getSpendState(later).isTripped).toBe(true);
        expect(() => throwIfSpendLimitReached(later)).toThrow(SpendLimitError);
    });

    test('the latch survives a reload: it is read back off the file', () => {
        setSpendLimitUsd(0.25, T0);
        recordSpendRound(DEAR_ROUND, T0);
        recordSpendRound(DEAR_ROUND, T0 + 1);
        // A new window: memory gone, file kept.
        const kept = new Map(settingMap);
        resetSpendGuardForTests();
        for (const [key, value] of kept) {
            settingMap.set(key, value);
        }
        const state = getSpendState(T0 + 2);
        expect(state.isTripped).toBe(true);
        expect(state.trippedBy).toBe('money');
        expect(state.spentRounds).toBe(2);
    });

    test('Allow more lifts the latch and starts the hour again from now', () => {
        setSpendLimitUsd(0.25, T0);
        recordSpendRound(DEAR_ROUND, T0);
        recordSpendRound(DEAR_ROUND, T0 + 1);
        expect(getSpendState(T0 + 2).isTripped).toBe(true);
        const state = allowMoreSpending(T0 + 3);
        expect(state.isTripped).toBe(false);
        expect(state.spentRounds).toBe(0);
        expect(state.spentUsd).toBe(0);
        expect(() => throwIfSpendLimitReached(T0 + 4)).not.toThrow();
        // The rounds are still on the file -- the bill is the bill.
        const stored = JSON.parse(settingMap.get('chatbot-spend-ledger')!);
        expect(stored.rounds).toHaveLength(2);
        expect(stored.resetAt).toBe(T0 + 3);
        // ...and the next dollar is a whole dollar.
        recordSpendRound(DEAR_ROUND, T0 + 5);
        expect(getSpendState(T0 + 6).isTripped).toBe(false);
        recordSpendRound(DEAR_ROUND, T0 + 6);
        expect(getSpendState(T0 + 7).isTripped).toBe(true);
    });

    test('raising the cap lifts the latch; lowering it under the spend pauses again', () => {
        setSpendLimitUsd(0.25, T0);
        recordSpendRound(DEAR_ROUND, T0);
        recordSpendRound(DEAR_ROUND, T0 + 1);
        expect(getSpendState(T0 + 2).isTripped).toBe(true);
        let state = setSpendLimitUsd(2, T0 + 3);
        expect(state.isTripped).toBe(false);
        expect(() => throwIfSpendLimitReached(T0 + 4)).not.toThrow();
        state = setSpendLimitUsd(0.25, T0 + 5);
        expect(state.isTripped).toBe(false);
        // The next round would go over, so it is never posted.
        expect(() => throwIfSpendLimitReached(T0 + 6)).toThrow(SpendLimitError);
        expect(getSpendState(T0 + 7).isTripped).toBe(true);
    });

    test('with the cap off, money never pauses -- only the pace does', () => {
        setSpendLimitUsd(null, T0);
        for (let i = 0; i < 20; i++) {
            recordSpendRound(DEAR_ROUND, T0 + i);
        }
        const state = getSpendState(T0 + 30);
        expect(state.spentUsd).toBeGreaterThan(3);
        expect(state.isTripped).toBe(false);
        expect(describeSpendState(state)).toMatch(/this hour$/);
        expect(describeSpendState(state)).not.toContain(' of ');
        expect(describeSpendGuard(state)).toContain('money cap is off');
    });
});

describe('the pace cap', () => {
    test('free rounds cost nothing and still pause at the pace cap', () => {
        let state = getSpendState(T0);
        for (let i = 0; i < MAX_SPEND_ROUNDS_PER_HOUR; i++) {
            expect(() => throwIfSpendLimitReached(T0 + i)).not.toThrow();
            state = recordSpendRound(FREE_ROUND, T0 + i);
        }
        expect(state.spentUsd).toBe(0);
        expect(state.isTripped).toBe(true);
        expect(state.trippedBy).toBe('pace');
        expect(() => throwIfSpendLimitReached(T0 + 200)).toThrow(
            SpendLimitError,
        );
        const pause = describeSpendPause(state);
        expect(pause).toContain(`${MAX_SPEND_ROUNDS_PER_HOUR} model calls`);
        expect(pause).toContain('running away');
        expect(describeSpendState(state)).toBe(
            `paused · ${MAX_SPEND_ROUNDS_PER_HOUR} calls this hour`,
        );
    });

    test('the pace cap is on whatever the money cap says', () => {
        setSpendLimitUsd(null, T0);
        for (let i = 0; i < MAX_SPEND_ROUNDS_PER_HOUR; i++) {
            recordSpendRound(FREE_ROUND, T0 + i);
        }
        expect(getSpendState(T0 + 200).trippedBy).toBe('pace');
    });

    test('the pace is an hour of rounds, so a slow day never trips it', () => {
        // One round every minute for three hours: never sixty in one hour
        // at once... well within the cap.
        for (let i = 0; i < 180; i++) {
            recordSpendRound(FREE_ROUND, T0 + i * 60_000);
        }
        expect(getSpendState(T0 + 180 * 60_000).isTripped).toBe(false);
    });
});

describe('the store', () => {
    test('a listener hears every change, and a subscription can end', () => {
        const seen: number[] = [];
        const unsubscribe = subscribeSpendGuard((state) => {
            seen.push(state.spentRounds);
        });
        recordSpendRound(COLD_ROUND, T0);
        recordSpendRound(COLD_ROUND, T0 + 1);
        unsubscribe();
        recordSpendRound(COLD_ROUND, T0 + 2);
        expect(seen).toEqual([1, 2]);
    });

    test('a stored ledger is checked field by field on its way back', () => {
        expect(toValidSpendLedger(null)).toEqual({
            rounds: [],
            resetAt: 0,
            trippedAt: null,
            trippedBy: null,
        });
        expect(
            toValidSpendLedger({
                rounds: [[T0, 100, 0.01], ['x', 1, 1], [T0 + 1, 'y', 'z'], 7],
                resetAt: 'never',
                trippedAt: T0,
                trippedBy: 'sideways',
            }),
        ).toEqual({
            rounds: [
                [T0, 100, 0.01],
                [T0 + 1, 0, null],
            ],
            resetAt: 0,
            // A trip with no reason is no trip.
            trippedAt: null,
            trippedBy: null,
        });
        expect(
            toValidSpendLedger({ rounds: [], trippedAt: T0, trippedBy: 'pace' })
                .trippedAt,
        ).toBe(T0);
    });

    test('a half-written file reads as an empty ledger', () => {
        settingMap.set('chatbot-spend-ledger', '{"rounds":[[1,');
        expect(getSpendState(T0).spentRounds).toBe(0);
        expect(() => throwIfSpendLimitReached(T0)).not.toThrow();
    });

    test('the ledger is bounded however many rounds an hour holds', () => {
        setSpendLimitUsd(null, T0);
        // Past the pace cap (the loop would have stopped asking) -- the
        // file must still not grow without bound.
        for (let i = 0; i < 1000; i++) {
            recordSpendRound(FREE_ROUND, T0 + i);
        }
        const stored = JSON.parse(settingMap.get('chatbot-spend-ledger')!);
        expect(stored.rounds.length).toBeLessThanOrEqual(400);
    });
});
