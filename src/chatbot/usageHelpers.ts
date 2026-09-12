// What a conversation has cost, and how to say it.
//
// Every model round reports what it used -- the provider counts the tokens
// and sends the count back on the response -- and until 2026-09-10 the
// window threw the number away. A volunteer asking the app for help was
// spending the church's API credit with nothing anywhere saying how much,
// and the one figure that would let them decide whether the assistant is
// cheap enough to use freely (rung 4 of the chatbot's ladder) could only be
// read off the wire by a developer. So every answer now carries what it
// cost, and every tab carries what the whole conversation has cost so far.
//
// Two rules hold. The number is an ESTIMATE, written from the list prices
// this build knows, and every place it is drawn says so: a provider's own
// bill is the real figure, and this app has no way to read it. And the
// tokens are counted whether or not the price is known -- a model read off
// the account's own catalogue has no price here, and a count with "price not
// known" beside it is worth more than a blank.

import type { LlmProviderType } from './llmBotHelpers';

/**
 * A model's list price, in US dollars per million tokens. Cached input is
 * priced separately by every provider that caches at all; writing to the
 * cache is only ever charged by Anthropic (the OpenAI-shaped ones write for
 * free), so the two OpenAI-shaped rows carry the plain input price there and
 * never see a cache-write token to apply it to.
 */
export type LlmModelPriceType = {
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
};

// The provider's own published rates, checked 2026-09-10. Anthropic's cache
// reads are a tenth of input and writes a quarter more; the GPT-5 family and
// Kimi K3 read cached input at a tenth. Kimi's K2 family publishes no rate
// and is deliberately absent: a wrong number about money is worse than none,
// which is also why the hover in the model picker prints these same figures
// through `toPriceLabel` rather than from a second hand-written copy.
const MODEL_PRICE_MAP: Record<string, LlmModelPriceType> = {
    'claude-opus-5': { input: 5, cacheRead: 0.5, cacheWrite: 6.25, output: 25 },
    'claude-sonnet-5': {
        input: 2,
        cacheRead: 0.2,
        cacheWrite: 2.5,
        output: 10,
    },
    'claude-haiku-4-5': {
        input: 1,
        cacheRead: 0.1,
        cacheWrite: 1.25,
        output: 5,
    },
    'gpt-5': { input: 1.25, cacheRead: 0.125, cacheWrite: 1.25, output: 10 },
    'gpt-5-mini': {
        input: 0.25,
        cacheRead: 0.025,
        cacheWrite: 0.25,
        output: 2,
    },
    'gpt-5-nano': {
        input: 0.05,
        cacheRead: 0.005,
        cacheWrite: 0.05,
        output: 0.4,
    },
    'kimi-k3': { input: 3, cacheRead: 0.3, cacheWrite: 3, output: 15 },
};

// The keyless services charge nobody. Priced at zero rather than left
// unknown, because "free" is a fact about them and "price not known" is not.
const FREE_PRICE: LlmModelPriceType = {
    input: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
};

/**
 * The list price of a model, or null when this build has none for it. The
 * provider decides before the model does: every model on the free services
 * costs nothing, whatever it is called.
 */
export function getLlmModelPrice(
    provider: LlmProviderType,
    model: string,
): LlmModelPriceType | null {
    if (provider === 'free') {
        return FREE_PRICE;
    }
    return MODEL_PRICE_MAP[model] ?? null;
}

/**
 * The price the way the model picker's hover prints it: input then output,
 * per million. Blank for a model with no price, and the picker drops a blank
 * line -- exactly as it does for a model read off the account's own list.
 */
export function toPriceLabel(model: string) {
    const price = MODEL_PRICE_MAP[model];
    if (price === undefined) {
        return '';
    }
    const toDollars = (value: number) => {
        // "$5" and "$0.40", never "$5.00" or "$0.4": the rates read as a
        // price list, and a price list writes whole dollars whole and cents
        // in pairs.
        return `$${value % 1 === 0 ? value : value.toFixed(2)}`;
    };
    return `${toDollars(price.input)}/${toDollars(price.output)}`;
}

/** One model round, as the loop reports it the moment the response lands. */
export type LlmRoundUsageType = {
    provider: LlmProviderType;
    model: string;
    // Input tokens billed at the full rate -- what was NOT served from the
    // cache. Anthropic reports it that way; the OpenAI shape reports the
    // whole prompt and the cached part inside it, and `toOpenAiRoundUsage`
    // takes the one from the other.
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
};

/**
 * The running total for an answer or a whole tab. Tokens are counted for
 * every round; dollars only for the rounds whose model has a list price
 * here, and `unpricedRounds` says how many were left out so the line can
 * say "and more" instead of quietly understating.
 */
export type ChatUsageType = {
    rounds: number;
    unpricedRounds: number;
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    costUsd: number;
};

export function genEmptyUsage(): ChatUsageType {
    return {
        rounds: 0,
        unpricedRounds: 0,
        input: 0,
        cacheRead: 0,
        cacheWrite: 0,
        output: 0,
        costUsd: 0,
    };
}

function toCount(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : 0;
}

/**
 * Anthropic's `usage` block. `input_tokens` there is already the uncached
 * part, and the two cache counts arrive as `null` on a request that carried
 * no `cache_control` at all.
 */
export function toAnthropicRoundUsage(
    model: string,
    usage:
        | {
              input_tokens?: number | null;
              output_tokens?: number | null;
              cache_creation_input_tokens?: number | null;
              cache_read_input_tokens?: number | null;
          }
        | null
        | undefined,
): LlmRoundUsageType {
    return {
        provider: 'anthropic',
        model,
        input: toCount(usage?.input_tokens),
        cacheRead: toCount(usage?.cache_read_input_tokens),
        cacheWrite: toCount(usage?.cache_creation_input_tokens),
        output: toCount(usage?.output_tokens),
    };
}

/**
 * The OpenAI shape, which ChatGPT, Kimi and both free services all speak.
 * `prompt_tokens` is the WHOLE prompt and `cached_tokens` the part of it that
 * was served from the cache, so the full-rate part is the difference; a host
 * that reports no details at all is read as having cached nothing. Reasoning
 * tokens are inside `completion_tokens` already and billed as output, so
 * nothing is added for them.
 */
export function toOpenAiRoundUsage(
    provider: LlmProviderType,
    model: string,
    usage:
        | {
              prompt_tokens?: number | null;
              completion_tokens?: number | null;
              prompt_tokens_details?: { cached_tokens?: number | null } | null;
          }
        | null
        | undefined,
): LlmRoundUsageType {
    const prompt = toCount(usage?.prompt_tokens);
    const cached = Math.min(
        prompt,
        toCount(usage?.prompt_tokens_details?.cached_tokens),
    );
    return {
        provider,
        model,
        input: prompt - cached,
        cacheRead: cached,
        cacheWrite: 0,
        output: toCount(usage?.completion_tokens),
    };
}

/** What one round costs at list price, or null for a model with no price. */
export function toRoundCostUsd(round: LlmRoundUsageType): number | null {
    const price = getLlmModelPrice(round.provider, round.model);
    if (price === null) {
        return null;
    }
    return (
        (round.input * price.input +
            round.cacheRead * price.cacheRead +
            round.cacheWrite * price.cacheWrite +
            round.output * price.output) /
        1_000_000
    );
}

/**
 * A round folded into a total. Returns a new object: the totals live in
 * React state and in the tab store, and both are compared by identity.
 */
export function addRoundUsage(
    total: ChatUsageType | undefined,
    round: LlmRoundUsageType,
): ChatUsageType {
    const base = total ?? genEmptyUsage();
    const cost = toRoundCostUsd(round);
    return {
        rounds: base.rounds + 1,
        unpricedRounds: base.unpricedRounds + (cost === null ? 1 : 0),
        input: base.input + round.input,
        cacheRead: base.cacheRead + round.cacheRead,
        cacheWrite: base.cacheWrite + round.cacheWrite,
        output: base.output + round.output,
        costUsd: base.costUsd + (cost ?? 0),
    };
}

/**
 * A stored total, checked field by field on its way back off disk -- the
 * tab file is plain JSON a hand can edit, and a total is only worth keeping
 * when every number in it is one. Null for anything else, and for a total
 * that never saw a round, which is not worth a field.
 */
export function toValidUsage(raw: unknown): ChatUsageType | null {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }
    const record = raw as Record<string, unknown>;
    const usage = genEmptyUsage();
    for (const key of Object.keys(usage) as (keyof ChatUsageType)[]) {
        const value = record[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            return null;
        }
        usage[key] = value;
    }
    return usage.rounds > 0 ? usage : null;
}

export function toTotalTokens(usage: ChatUsageType) {
    return usage.input + usage.cacheRead + usage.cacheWrite + usage.output;
}

/**
 * A token count the way a person reads one at a glance: "425", "46.9k",
 * "511k", "1.2M". One decimal until the number has three digits before it.
 */
export function toCompactCount(count: number) {
    const toShort = (value: number, unit: string) => {
        const shown =
            value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
        return `${shown}${unit}`;
    };
    if (count >= 1_000_000) {
        return toShort(count / 1_000_000, 'M');
    }
    if (count >= 1000) {
        return toShort(count / 1000, 'k');
    }
    return String(Math.round(count));
}

/**
 * Dollars the way they are worth reading at this scale. A whole question
 * on a cached prompt costs fractions of a cent, so cents alone would print
 * "$0.00" under most answers and teach the reader that the thing is free;
 * below a cent the third decimal is kept, and below a tenth of one the
 * line says so rather than rounding to nothing.
 */
export function toUsdLabel(usd: number) {
    if (usd <= 0) {
        return '$0.00';
    }
    if (usd >= 0.01) {
        return `$${usd.toFixed(2)}`;
    }
    if (usd >= 0.001) {
        return `$${usd.toFixed(3)}`;
    }
    return 'under $0.001';
}

/**
 * The cost half of a line: "≈ $0.014", "free", "price not known", or the
 * honest mix of a tab that changed model mid-way.
 */
export function toCostLabel(usage: ChatUsageType) {
    const pricedRounds = usage.rounds - usage.unpricedRounds;
    if (pricedRounds === 0) {
        return usage.rounds === 0 ? '' : 'price not known';
    }
    const dollars =
        usage.costUsd > 0 ? `≈ ${toUsdLabel(usage.costUsd)}` : 'free';
    return usage.unpricedRounds > 0
        ? `${dollars} + some at an unknown price`
        : dollars;
}

/**
 * The one line drawn under an answer and in the head of a tab: the money
 * first, because that is what is being asked, then the tokens it bought.
 * Empty for a total that never saw a round.
 */
export function describeUsageBriefly(usage: ChatUsageType | undefined) {
    if (usage === undefined || usage.rounds === 0) {
        return '';
    }
    return `${toCostLabel(usage)} · ${toCompactCount(toTotalTokens(usage))} tokens`;
}

function toPlural(count: number, noun: string) {
    return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The hover behind that line, in sentences: where the tokens went and what
 * the dollars are worth. It carries the caveat every time, because a
 * figure about money that reads as exact is a figure somebody will argue
 * with the provider about.
 */
export function describeUsageInFull(usage: ChatUsageType | undefined) {
    if (usage === undefined || usage.rounds === 0) {
        return '';
    }
    const inputParts = [
        `${toPlural(usage.input, 'token')} in at the full rate`,
    ];
    if (usage.cacheRead > 0) {
        inputParts.push(
            `${usage.cacheRead.toLocaleString('en-US')} read from the cache`,
        );
    }
    if (usage.cacheWrite > 0) {
        inputParts.push(
            `${usage.cacheWrite.toLocaleString('en-US')} written to it`,
        );
    }
    const lines = [
        `${toPlural(usage.rounds, 'model round')}: ${inputParts.join(', ')}; ` +
            `${toPlural(usage.output, 'token')} out.`,
    ];
    const pricedRounds = usage.rounds - usage.unpricedRounds;
    if (pricedRounds === 0) {
        lines.push(
            'This app has no list price for the model that answered, so it ' +
                'cannot put a figure on the cost.',
        );
    } else if (usage.costUsd === 0) {
        lines.push('Answered by a free service, so nothing was charged.');
    } else {
        lines.push(
            `About ${toUsdLabel(usage.costUsd)} at the list price` +
                (usage.unpricedRounds > 0
                    ? `, not counting ${toPlural(usage.unpricedRounds, 'round')} ` +
                      'on a model this app has no price for'
                    : '') +
                '. An estimate: the bill from your provider is the real figure.',
        );
    }
    return lines.join('\n');
}
