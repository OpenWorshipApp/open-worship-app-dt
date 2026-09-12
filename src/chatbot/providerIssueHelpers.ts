import type { BotActionType } from './helpBotHelpers';
import type { LlmProviderType } from './llmBotHelpers';

/**
 * What an unusual answer from a provider IS, read off the error the SDK threw.
 *
 * Every provider says the same handful of things in its own words: the key is
 * wrong, the account is empty, you are asking too often, the service is down.
 * The window used to read only the HTTP status, and a status is not enough --
 * an OpenAI 429 is `insufficient_quota` (an empty account, which no waiting
 * fixes) as often as it is a rate limit, an Anthropic empty account is a 402
 * (or, on an organisation's own spend limit, a 400), and a Kimi 429 can be
 * `engine_overloaded_error`, which is the service's fault and not the
 * account's. Measured 2026-09-10 through the real window on a ChatGPT key a
 * week out of credit: *"the AI account is out of credit or being
 * rate-limited"*, with the body saying `insufficient_quota` in plain sight,
 * and nothing under it a volunteer could press.
 *
 * So the body is read too -- the code or type every provider puts in it, and
 * the words it used -- and the answer is a KIND, which is what decides both
 * the sentence and the button: an empty account gets the billing page, a
 * refused key the keys page, a busy service its status page.
 */
export type LlmIssueKindType =
    // 402, or a 400/429 whose code or words say the account is empty or has
    // hit a spending cap. Nothing but money fixes it.
    | 'noCredit'
    // 401/403: the key is wrong, revoked, or not allowed to do this.
    | 'badKey'
    // A 429 whose code says it IS a rate limit. Waiting fixes it.
    | 'rateLimited'
    // A 429 that said nothing more: the account is empty OR asking too often,
    // and the window cannot tell which.
    | 'quotaOrRate'
    // The service is at capacity (529, a 503 that says so, Kimi's
    // `engine_overloaded_error`). Nothing on the account fixes it.
    | 'overloaded'
    // Any other 5xx: the service's own trouble.
    | 'serverTrouble'
    // 404: the model asked for is not one this account can run.
    | 'modelMissing'
    // An identity-linked Anthropic key sent without its workspace id.
    | 'workspace'
    // No status at all: the request never got an answer.
    | 'unreachable'
    // A 400 or anything else: the request's own fault.
    | 'other';

export type LlmIssueType = {
    kind: LlmIssueKindType;
    status: number | null;
    /**
     * The provider's own code or type for the fault (`insufficient_quota`,
     * `authentication_error`, ...), when the body carried one. Kept for the
     * log, never shown: it is written for whoever wrote the client.
     */
    code: string | null;
    /** The provider's own sentence, when the body carried one. */
    message: string;
};

// The codes and types each provider documents. Every list was read off the
// provider's own error page on 2026-09-10 rather than remembered, because a
// remembered name is how `insufficient_quota` stays the only one checked
// after OpenAI renamed it `credit_balance_exhausted`.
const NO_CREDIT_CODE_SET = new Set([
    // Anthropic: a 402, and its type.
    'billing_error',
    // OpenAI: a prepaid balance at zero (old and new names), and the three
    // spend limits an organisation or a project can set for itself.
    'insufficient_quota',
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
    'billing_hard_limit_reached',
    'billing_not_active',
    // Kimi: "Account balance is insufficient" / "Token quota is insufficient".
    'exceeded_current_quota_error',
]);
const RATE_LIMIT_CODE_SET = new Set([
    'rate_limit_error',
    'rate_limit_exceeded',
    'rate_limit_reached_error',
    'slow_down',
    'requests',
    'tokens',
]);
const OVERLOADED_CODE_SET = new Set([
    'overloaded_error',
    'engine_overloaded_error',
    'server_is_overloaded',
    'service_unavailable_error',
    'server_unavailable',
]);
const BAD_KEY_CODE_SET = new Set([
    'authentication_error',
    'permission_error',
    'invalid_api_key',
    'invalid_authentication_error',
    'incorrect_api_key_error',
    'permission_denied_error',
]);
const MODEL_MISSING_CODE_SET = new Set([
    'model_not_found',
    'not_found_error',
    'resource_not_found_error',
]);
// The words a provider uses for an empty account when it gives no code worth
// the name: Anthropic's "Your credit balance is too low" arrives as a plain
// 400 `invalid_request_error`, and so does an organisation's own spend limit.
const NO_CREDIT_WORDS_PATTERN =
    /credit|balance|quota|billing|spend(?:ing)? (?:limit|cap)|usage limit|insufficient|prepaid|top up/i;

function toStatus(error: any): number | null {
    const raw = error?.status ?? error?.response?.status ?? null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw === 'string' && /^\d{3}$/.test(raw)) {
        return Number(raw);
    }
    return null;
}

function toNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
}

/**
 * Both SDKs put the raw JSON body into `error.message` behind its status
 * (`429 {"error":{...}}`). When that is all there is -- a fake in a test, a
 * gateway that lost the structured fields -- the body is read out of it, so
 * the code is not lost for being in the wrong place.
 */
function parseBodyInMessage(message: string): any {
    const match = /^\d{3}\s*(\{[\s\S]*\})\s*$/.exec(message);
    if (match === null) {
        return null;
    }
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

/** Every place a provider's code or type can sit, in preference order. */
function collectCodes(error: any, body: any): string[] {
    const candidates = [
        // OpenAI and Kimi: `{error: {code, type, message}}`.
        error?.code,
        error?.error?.code,
        error?.error?.type,
        // Anthropic: `{type: "error", error: {type, message}}`.
        error?.error?.error?.type,
        error?.type,
        body?.error?.code,
        body?.error?.type,
        body?.error?.error?.type,
    ];
    return candidates
        .map(toNonEmptyString)
        .filter((one): one is string => {
            // Anthropic's outer `type` is the word "error" and says nothing.
            return one !== null && one !== 'error';
        })
        .map((one) => {
            return one.toLowerCase();
        });
}

function toMessage(error: any, body: any): string {
    const raw =
        toNonEmptyString(error?.error?.error?.message) ??
        toNonEmptyString(error?.error?.message) ??
        toNonEmptyString(body?.error?.message) ??
        toNonEmptyString(body?.error?.error?.message) ??
        toNonEmptyString(error?.message) ??
        '';
    // A raw body is never a sentence for anyone.
    return raw.replace(/^\d{3}\s*\{[\s\S]*$/, '').trim();
}

function toKind(
    status: number | null,
    codes: string[],
    message: string,
): LlmIssueKindType {
    if (/workspace/i.test(message)) {
        return 'workspace';
    }
    const has = (set: Set<string>) => {
        return codes.some((code) => {
            return set.has(code);
        });
    };
    // A code is the provider saying exactly what it meant; it outranks the
    // status it happens to arrive under.
    if (has(NO_CREDIT_CODE_SET)) {
        return 'noCredit';
    }
    if (has(OVERLOADED_CODE_SET)) {
        return 'overloaded';
    }
    if (has(RATE_LIMIT_CODE_SET)) {
        return 'rateLimited';
    }
    if (has(BAD_KEY_CODE_SET)) {
        return 'badKey';
    }
    if (has(MODEL_MISSING_CODE_SET)) {
        return 'modelMissing';
    }
    if (status === null) {
        return 'unreachable';
    }
    if (status === 402) {
        return 'noCredit';
    }
    if (status === 401 || status === 403) {
        return 'badKey';
    }
    if (status === 404) {
        return 'modelMissing';
    }
    if (status === 529) {
        return 'overloaded';
    }
    if (status >= 500) {
        return 'serverTrouble';
    }
    // The words, only where the status leaves room for them: a 429 or a 400
    // saying "credit balance" is an empty account; a 5xx saying "quota" is
    // still the service's trouble, and a 401 is still the key.
    if (
        (status === 400 || status === 429) &&
        NO_CREDIT_WORDS_PATTERN.test(message)
    ) {
        return 'noCredit';
    }
    if (status === 429) {
        return 'quotaOrRate';
    }
    return 'other';
}

/** What went wrong, read off whatever the SDK threw. Never throws itself. */
export function readLlmIssue(error: any): LlmIssueType {
    const status = toStatus(error);
    const body =
        typeof error?.message === 'string'
            ? parseBodyInMessage(error.message)
            : null;
    const codes = collectCodes(error, body);
    const message = toMessage(error, body);
    return {
        kind: toKind(status, codes, message),
        status,
        code: codes[0] ?? null,
        message,
    };
}

/**
 * The kinds that are the PROVIDER's own fault -- its key, its account, its
 * servers -- which another key of the user's would not share. Everything else
 * would fail the same way again with a different key.
 */
export function checkIsProviderIssue(issue: LlmIssueType) {
    switch (issue.kind) {
        case 'noCredit':
        case 'badKey':
        case 'rateLimited':
        case 'quotaOrRate':
        case 'overloaded':
        case 'serverTrouble':
            return true;
        case 'workspace':
            // Refused for the key's own configuration; a 400 with the same
            // words is a request the API could not take.
            return issue.status === 401 || issue.status === 403;
        default:
            return false;
    }
}

/**
 * The console pages a provider keeps for the things that go wrong, read off
 * each provider's own documentation on 2026-09-10. The Anthropic console
 * answers on `platform.claude.com` now (`console.anthropic.com` redirects
 * there), OpenAI's pages are the ones its error guide links, and Kimi
 * documents its keys page and nothing for money -- so its console home stands
 * in for the billing and limits pages rather than a guessed deep link, which
 * would be worse than the front door when it is wrong.
 *
 * These are the ONLY addresses a button in the help window ever opens. A
 * button carries a provider and a page NAME, never an address, so a saved
 * conversation edited by hand cannot send anyone anywhere else.
 */
export type LlmProviderPageType =
    'billing' | 'keys' | 'limits' | 'status' | 'workspaces';

type ProviderPagesType = {
    billing: string;
    keys: string;
    limits: string;
    status?: string;
    workspaces?: string;
};

export const PAID_PROVIDER_PAGE_MAP: Record<
    Exclude<LlmProviderType, 'free'>,
    ProviderPagesType
> = {
    anthropic: {
        billing: 'https://platform.claude.com/settings/billing',
        keys: 'https://platform.claude.com/settings/keys',
        limits: 'https://platform.claude.com/settings/limits',
        workspaces: 'https://platform.claude.com/settings/workspaces',
        status: 'https://status.anthropic.com',
    },
    openai: {
        billing: 'https://platform.openai.com/settings/organization/billing',
        keys: 'https://platform.openai.com/settings/organization/api-keys',
        limits: 'https://platform.openai.com/settings/organization/limits',
        status: 'https://status.openai.com',
    },
    kimi: {
        billing: 'https://platform.kimi.ai/console',
        keys: 'https://platform.kimi.ai/console/api-keys',
        limits: 'https://platform.kimi.ai/console',
    },
};

const PAGE_NAME_SET = new Set<string>([
    'billing',
    'keys',
    'limits',
    'status',
    'workspaces',
]);

/**
 * The address behind a provider and a page name, or null: for the keyless
 * provider (no account to go to), for a page a provider does not keep, and
 * for anything that is not a name in the table -- which is what a button out
 * of a hand-edited session file would carry.
 */
export function getLlmProviderPageUrl(
    provider: unknown,
    page: unknown,
): string | null {
    if (
        typeof provider !== 'string' ||
        typeof page !== 'string' ||
        !PAGE_NAME_SET.has(page) ||
        !Object.hasOwn(PAID_PROVIDER_PAGE_MAP, provider)
    ) {
        return null;
    }
    const pages =
        PAID_PROVIDER_PAGE_MAP[provider as Exclude<LlmProviderType, 'free'>];
    return pages[page as LlmProviderPageType] ?? null;
}

/**
 * Two buttons that are not tools. Caught by name in the window (like the
 * report's Send and the spend guard's Allow more) and registered nowhere, so
 * nothing a model says can open a page in the user's browser: the window
 * mints them itself, off a kind it read from the wire, and the press resolves
 * the page through `getLlmProviderPageUrl` at press time.
 */
export const OPEN_PROVIDER_PAGE_TOOL_NAME = 'owa-open-provider-page';
export const OPEN_AI_SETTING_TOOL_NAME = 'owa-open-ai-setting';
export const OPEN_AI_SETTING_LABEL = 'Open AI settings';

function genPageAction(
    provider: LlmProviderType,
    page: LlmProviderPageType,
    label: string,
): BotActionType | null {
    if (getLlmProviderPageUrl(provider, page) === null) {
        return null;
    }
    return {
        label,
        toolName: OPEN_PROVIDER_PAGE_TOOL_NAME,
        args: { provider, page },
    };
}

const SETTING_ACTION: BotActionType = {
    label: OPEN_AI_SETTING_LABEL,
    toolName: OPEN_AI_SETTING_TOOL_NAME,
    args: {},
};

/**
 * What to put under an answer that says the provider could not answer: the
 * door to the thing that is wrong. `providerLabel` is the name the window
 * shows for the provider (Claude, ChatGPT, Kimi), so the button says whose
 * page it opens -- a volunteer with two keys must not top up the wrong one.
 *
 * Empty for the kinds nothing on a console fixes (the internet, a bad
 * request, a model this account cannot run), and the app's own settings
 * panel for the keyless provider, because the way out of a busy free pool is
 * a key of one's own and there is no account to go and look at.
 */
export function genProviderIssueActions(
    provider: LlmProviderType,
    kind: LlmIssueKindType,
    providerLabel: string,
): BotActionType[] {
    let wanted: { page: LlmProviderPageType; label: string }[];
    let isSettingWanted = false;
    switch (kind) {
        case 'noCredit':
            wanted = [
                { page: 'billing', label: `Open ${providerLabel} billing` },
            ];
            break;
        case 'quotaOrRate':
            wanted = [
                { page: 'billing', label: `Open ${providerLabel} billing` },
                { page: 'limits', label: `Open ${providerLabel} usage limits` },
            ];
            break;
        case 'rateLimited':
            wanted = [
                { page: 'limits', label: `Open ${providerLabel} usage limits` },
            ];
            break;
        case 'badKey':
            isSettingWanted = true;
            wanted = [
                { page: 'keys', label: `Open ${providerLabel} API keys` },
            ];
            break;
        case 'workspace':
            isSettingWanted = true;
            wanted = [
                {
                    page: 'workspaces',
                    label: `Open ${providerLabel} workspaces`,
                },
            ];
            break;
        case 'overloaded':
        case 'serverTrouble':
            wanted = [
                { page: 'status', label: `${providerLabel} status page` },
            ];
            break;
        default:
            return [];
    }
    const pageActions = wanted
        .map((one) => {
            return genPageAction(provider, one.page, one.label);
        })
        .filter((one): one is BotActionType => {
            return one !== null;
        });
    if (pageActions.length === 0 && !isSettingWanted) {
        // No console to send them to (the keyless provider): the one door
        // that helps is the panel where a key of their own goes.
        return [SETTING_ACTION];
    }
    return isSettingWanted ? [SETTING_ACTION, ...pageActions] : pageActions;
}
