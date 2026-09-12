import { describe, expect, test } from 'vitest';

import {
    addRoundUsage,
    describeUsageBriefly,
    describeUsageInFull,
    genEmptyUsage,
    getLlmModelPrice,
    toAnthropicRoundUsage,
    toCompactCount,
    toCostLabel,
    toOpenAiRoundUsage,
    toPriceLabel,
    toRoundCostUsd,
    toTotalTokens,
    toUsdLabel,
    toValidUsage,
    type LlmRoundUsageType,
} from './usageHelpers';

// The standing corpus's own first question, read off the wire on 2026-09-10:
// three rounds on Claude Sonnet 5, nearly all of it a cache read.
const SONNET_ROUND: LlmRoundUsageType = {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    input: 6,
    cacheRead: 46901,
    cacheWrite: 1641,
    output: 425,
};

describe('reading a provider usage block', () => {
    test("Anthropic's block is already split into cached and not", () => {
        expect(
            toAnthropicRoundUsage('claude-sonnet-5', {
                input_tokens: 6,
                output_tokens: 425,
                cache_creation_input_tokens: 1641,
                cache_read_input_tokens: 46901,
            }),
        ).toEqual(SONNET_ROUND);
    });

    test('null cache counts (no cache_control at all) read as zero', () => {
        const round = toAnthropicRoundUsage('claude-haiku-4-5', {
            input_tokens: 900,
            output_tokens: 20,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
        });
        expect(round.cacheRead).toBe(0);
        expect(round.cacheWrite).toBe(0);
        expect(round.input).toBe(900);
    });

    test('the OpenAI shape reports the whole prompt, so the cached part comes off it', () => {
        expect(
            toOpenAiRoundUsage('openai', 'gpt-5-mini', {
                prompt_tokens: 10_000,
                completion_tokens: 300,
                prompt_tokens_details: { cached_tokens: 9_000 },
            }),
        ).toEqual({
            provider: 'openai',
            model: 'gpt-5-mini',
            input: 1_000,
            cacheRead: 9_000,
            cacheWrite: 0,
            output: 300,
        });
    });

    test('a host that reports no details cached nothing', () => {
        const round = toOpenAiRoundUsage('free', 'gpt-oss', {
            prompt_tokens: 5_000,
            completion_tokens: 100,
        });
        expect(round.input).toBe(5_000);
        expect(round.cacheRead).toBe(0);
    });

    test('a cached count larger than the prompt cannot go negative', () => {
        const round = toOpenAiRoundUsage('kimi', 'kimi-k3', {
            prompt_tokens: 100,
            completion_tokens: 1,
            prompt_tokens_details: { cached_tokens: 500 },
        });
        expect(round.input).toBe(0);
        expect(round.cacheRead).toBe(100);
    });

    test('a missing block is a round of nothing, not a crash', () => {
        expect(toAnthropicRoundUsage('claude-sonnet-5', undefined).output).toBe(
            0,
        );
        expect(toOpenAiRoundUsage('openai', 'gpt-5', null).input).toBe(0);
    });
});

describe('the price list', () => {
    test('every free model costs nothing, whatever it is called', () => {
        expect(getLlmModelPrice('free', 'anything/at-all:free')).toEqual({
            input: 0,
            cacheRead: 0,
            cacheWrite: 0,
            output: 0,
        });
    });

    test('a model off the account catalogue has no price here', () => {
        expect(getLlmModelPrice('anthropic', 'claude-opus-4-8')).toBeNull();
        expect(getLlmModelPrice('kimi', 'kimi-k2.6')).toBeNull();
    });

    test('the picker label is the list price, input then output', () => {
        expect(toPriceLabel('claude-sonnet-5')).toBe('$2/$10');
        expect(toPriceLabel('gpt-5')).toBe('$1.25/$10');
        expect(toPriceLabel('gpt-5-nano')).toBe('$0.05/$0.40');
        expect(toPriceLabel('kimi-k2.6')).toBe('');
    });

    test('a Sonnet round is priced with the cache read at a tenth', () => {
        // 6 × 2 + 46 901 × 0.2 + 1 641 × 2.5 + 425 × 10, per million.
        expect(toRoundCostUsd(SONNET_ROUND)).toBeCloseTo(0.0177447, 7);
    });

    test('an unpriced round costs null, never zero', () => {
        expect(
            toRoundCostUsd({ ...SONNET_ROUND, model: 'claude-opus-4-8' }),
        ).toBeNull();
    });
});

describe('the running total', () => {
    test('starts from nothing and adds a round without touching the old object', () => {
        const before = genEmptyUsage();
        const after = addRoundUsage(before, SONNET_ROUND);
        expect(before.rounds).toBe(0);
        expect(after.rounds).toBe(1);
        expect(after.cacheRead).toBe(46901);
        expect(after.costUsd).toBeCloseTo(0.0177447, 7);
        expect(toTotalTokens(after)).toBe(6 + 46901 + 1641 + 425);
    });

    test('an undefined total is an empty one', () => {
        expect(addRoundUsage(undefined, SONNET_ROUND).rounds).toBe(1);
    });

    test('an unpriced round is counted in tokens and named, not priced', () => {
        const total = addRoundUsage(addRoundUsage(undefined, SONNET_ROUND), {
            ...SONNET_ROUND,
            model: 'claude-opus-4-8',
        });
        expect(total.rounds).toBe(2);
        expect(total.unpricedRounds).toBe(1);
        expect(total.costUsd).toBeCloseTo(0.0177447, 7);
        expect(total.output).toBe(850);
    });
});

describe('a stored total', () => {
    test('comes back whole when every field is a number', () => {
        const total = addRoundUsage(undefined, SONNET_ROUND);
        expect(toValidUsage(JSON.parse(JSON.stringify(total)))).toEqual(total);
    });

    test('a hand-edited field drops the whole total', () => {
        const total = addRoundUsage(undefined, SONNET_ROUND);
        expect(toValidUsage({ ...total, costUsd: '0.5' })).toBeNull();
        expect(toValidUsage({ ...total, rounds: -1 })).toBeNull();
        expect(toValidUsage({ ...total, output: Number.NaN })).toBeNull();
    });

    test('an empty total and a non-object are not worth a field', () => {
        expect(toValidUsage(genEmptyUsage())).toBeNull();
        expect(toValidUsage('usage')).toBeNull();
        expect(toValidUsage(null)).toBeNull();
    });
});

describe('saying it', () => {
    test('token counts read at a glance', () => {
        expect(toCompactCount(425)).toBe('425');
        expect(toCompactCount(1641)).toBe('1.6k');
        expect(toCompactCount(46901)).toBe('46.9k');
        expect(toCompactCount(511_234)).toBe('511k');
        expect(toCompactCount(1_234_567)).toBe('1.2M');
    });

    test('dollars keep the third decimal under a cent', () => {
        expect(toUsdLabel(0)).toBe('$0.00');
        expect(toUsdLabel(0.28)).toBe('$0.28');
        expect(toUsdLabel(1.5)).toBe('$1.50');
        expect(toUsdLabel(0.0177)).toBe('$0.02');
        expect(toUsdLabel(0.0041)).toBe('$0.004');
        expect(toUsdLabel(0.0002)).toBe('under $0.001');
    });

    test('the brief line is money first, then tokens', () => {
        const total = addRoundUsage(undefined, SONNET_ROUND);
        expect(describeUsageBriefly(total)).toBe('≈ $0.02 · 49k tokens');
    });

    test('a free tab says free, an unpriced one says so, a mix says both', () => {
        const free = addRoundUsage(undefined, {
            ...SONNET_ROUND,
            provider: 'free',
            model: 'gpt-oss',
        });
        expect(toCostLabel(free)).toBe('free');
        const unpriced = addRoundUsage(undefined, {
            ...SONNET_ROUND,
            model: 'claude-opus-4-8',
        });
        expect(toCostLabel(unpriced)).toBe('price not known');
        const mixed = addRoundUsage(unpriced, SONNET_ROUND);
        expect(toCostLabel(mixed)).toBe('≈ $0.02 + some at an unknown price');
    });

    test('nothing is said for a total that never saw a round', () => {
        expect(describeUsageBriefly(undefined)).toBe('');
        expect(describeUsageBriefly(genEmptyUsage())).toBe('');
        expect(describeUsageInFull(genEmptyUsage())).toBe('');
        expect(toCostLabel(genEmptyUsage())).toBe('');
    });

    test('the hover says where the tokens went and that the money is an estimate', () => {
        const total = addRoundUsage(undefined, SONNET_ROUND);
        const text = describeUsageInFull(total);
        expect(text).toContain('1 model round: 6 tokens in at the full rate');
        expect(text).toContain('46,901 read from the cache');
        expect(text).toContain('1,641 written to it');
        expect(text).toContain('425 tokens out.');
        expect(text).toContain('About $0.02 at the list price.');
        expect(text).toContain('An estimate');
    });

    test('the hover names the rounds it could not price', () => {
        const mixed = addRoundUsage(addRoundUsage(undefined, SONNET_ROUND), {
            ...SONNET_ROUND,
            model: 'claude-opus-4-8',
        });
        expect(describeUsageInFull(mixed)).toContain(
            'not counting 1 round on a model this app has no price for',
        );
        const free = addRoundUsage(undefined, {
            ...SONNET_ROUND,
            provider: 'free',
            model: 'gpt-oss',
        });
        expect(describeUsageInFull(free)).toContain('free service');
    });
});
