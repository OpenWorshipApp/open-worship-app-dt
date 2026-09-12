// The AI chat sites the window can hold, declared once.
//
// Each is a company's own chat page, used the way a browser's AI sidebar
// uses it: the user signs in there with their own account and the
// conversation lives there. Nothing in this app talks to any of them -- the
// chatbot's providers (`src/helper/ai/*`) are a different thing, keyed by
// the user's own API key, and this list does not touch them.
//
// Adding a site is adding a row. `hosts` is the part that matters beyond the
// name: it says which addresses a tab may REMEMBER (`toKeptUrl` in
// `aiChatSessionHelpers.ts`), so a tab reopens on the conversation it was on
// and never on a sign-in page half-way through a redirect.

export type AiChatProviderType = {
    key: string;
    name: string;
    homeUrl: string;
    // A page is "the site" when its host is one of these or a subdomain of
    // one. The sign-in hosts (accounts.google.com, auth.openai.com) are
    // deliberately NOT here.
    hosts: string[];
    // Drawn on the chooser card in place of a logo: the host CSP allows no
    // outside image, and a letter in the company's colour is recognisable
    // enough in a list of ten.
    badgeLetter: string;
    badgeColor: string;
};

export const AI_CHAT_PROVIDER_LIST: readonly AiChatProviderType[] = [
    {
        key: 'chatgpt',
        name: 'ChatGPT',
        homeUrl: 'https://chatgpt.com/',
        hosts: ['chatgpt.com', 'chat.openai.com'],
        badgeLetter: 'GPT',
        badgeColor: '#10a37f',
    },
    {
        key: 'claude',
        name: 'Claude',
        homeUrl: 'https://claude.ai/new',
        hosts: ['claude.ai'],
        badgeLetter: 'Cl',
        badgeColor: '#d97757',
    },
    {
        key: 'gemini',
        name: 'Gemini',
        homeUrl: 'https://gemini.google.com/app',
        hosts: ['gemini.google.com'],
        badgeLetter: 'Ge',
        badgeColor: '#4285f4',
    },
    {
        key: 'deepseek',
        name: 'DeepSeek',
        homeUrl: 'https://chat.deepseek.com/',
        hosts: ['chat.deepseek.com'],
        badgeLetter: 'DS',
        badgeColor: '#4d6bfe',
    },
    {
        key: 'kimi',
        name: 'Kimi',
        homeUrl: 'https://www.kimi.com/',
        hosts: ['kimi.com'],
        badgeLetter: 'Ki',
        badgeColor: '#6c5ce7',
    },
    {
        key: 'grok',
        name: 'Grok',
        homeUrl: 'https://grok.com/',
        hosts: ['grok.com'],
        badgeLetter: 'Gr',
        badgeColor: '#5f6368',
    },
    {
        key: 'mistral',
        name: 'Mistral (Le Chat)',
        homeUrl: 'https://chat.mistral.ai/chat',
        hosts: ['chat.mistral.ai'],
        badgeLetter: 'Mi',
        badgeColor: '#ff7000',
    },
    {
        key: 'perplexity',
        name: 'Perplexity',
        homeUrl: 'https://www.perplexity.ai/',
        hosts: ['perplexity.ai'],
        badgeLetter: 'Px',
        badgeColor: '#20808d',
    },
    {
        key: 'qwen',
        name: 'Qwen',
        homeUrl: 'https://chat.qwen.ai/',
        hosts: ['chat.qwen.ai'],
        badgeLetter: 'Qw',
        badgeColor: '#615ced',
    },
    {
        key: 'copilot',
        name: 'Copilot',
        homeUrl: 'https://copilot.microsoft.com/',
        hosts: ['copilot.microsoft.com'],
        badgeLetter: 'Co',
        badgeColor: '#0078d4',
    },
];

const AI_CHAT_PROVIDER_MAP: Record<string, AiChatProviderType> =
    Object.fromEntries(
        AI_CHAT_PROVIDER_LIST.map((provider) => {
            return [provider.key, provider];
        }),
    );

/** The row for a key, or null for a key this build does not know. */
export function getAiChatProvider(key: string | null | undefined) {
    if (typeof key !== 'string') {
        return null;
    }
    return Object.hasOwn(AI_CHAT_PROVIDER_MAP, key)
        ? AI_CHAT_PROVIDER_MAP[key]
        : null;
}

/** `chatgpt.com` for `https://chatgpt.com/` -- what the chooser prints. */
export function toAiChatHostLabel(url: string) {
    return URL.canParse(url) ? new URL(url).host.replace(/^www[.]/, '') : url;
}
