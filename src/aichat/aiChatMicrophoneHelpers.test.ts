import { describe, expect, test } from 'vitest';

import {
    decideMicrophoneAsk,
    toMicrophoneAsk,
    type AiChatMicrophoneAskType,
} from './aiChatMicrophoneHelpers';
import { checkIsOnAiChatSite } from './aiChatProviders';

describe('checkIsOnAiChatSite', () => {
    test('the site and its subdomains, never a lookalike', () => {
        expect(checkIsOnAiChatSite('claude', 'claude.ai')).toBe(true);
        expect(checkIsOnAiChatSite('claude', 'www.claude.ai')).toBe(true);
        expect(checkIsOnAiChatSite('chatgpt', 'chat.openai.com')).toBe(true);
        expect(checkIsOnAiChatSite('claude', 'notclaude.ai')).toBe(false);
        expect(checkIsOnAiChatSite('claude', 'claude.ai.evil.com')).toBe(false);
        expect(checkIsOnAiChatSite('gemini', 'accounts.google.com')).toBe(
            false,
        );
        expect(checkIsOnAiChatSite('nope', 'claude.ai')).toBe(false);
        expect(checkIsOnAiChatSite(undefined, 'claude.ai')).toBe(false);
        expect(checkIsOnAiChatSite('claude', 42)).toBe(false);
    });
});

function genAsk(
    overrides: Partial<AiChatMicrophoneAskType> = {},
): AiChatMicrophoneAskType {
    return {
        askId: 1,
        guestId: 7,
        hostname: 'claude.ai',
        isAllowed: false,
        ...overrides,
    };
}

describe('toMicrophoneAsk', () => {
    test('reads the ask the main process sends', () => {
        expect(
            toMicrophoneAsk({
                askId: 3,
                guestId: 9,
                hostname: 'claude.ai',
                isAllowed: true,
            }),
        ).toEqual({
            askId: 3,
            guestId: 9,
            hostname: 'claude.ai',
            isAllowed: true,
        });
    });

    test('anything but a plain true is not allowed', () => {
        expect(
            toMicrophoneAsk({
                askId: 3,
                guestId: 9,
                hostname: 'claude.ai',
                isAllowed: 'yes',
            })?.isAllowed,
        ).toBe(false);
    });

    test('refuses what is not an ask', () => {
        expect(toMicrophoneAsk(null)).toBeNull();
        expect(toMicrophoneAsk('claude.ai')).toBeNull();
        expect(
            toMicrophoneAsk({ askId: '3', guestId: 9, hostname: 'claude.ai' }),
        ).toBeNull();
        expect(
            toMicrophoneAsk({ askId: 3, guestId: 1.5, hostname: 'claude.ai' }),
        ).toBeNull();
        expect(
            toMicrophoneAsk({ askId: 3, guestId: 9, hostname: '' }),
        ).toBeNull();
    });
});

describe('decideMicrophoneAsk', () => {
    test('the tab in front, on its own site, is asked', () => {
        expect(
            decideMicrophoneAsk(genAsk(), {
                guestId: 7,
                providerKey: 'claude',
            }),
        ).toBe('ask');
        expect(
            decideMicrophoneAsk(genAsk({ hostname: 'www.claude.ai' }), {
                guestId: 7,
                providerKey: 'claude',
            }),
        ).toBe('ask');
    });

    test('a site already allowed is not asked twice', () => {
        expect(
            decideMicrophoneAsk(genAsk({ isAllowed: true }), {
                guestId: 7,
                providerKey: 'claude',
            }),
        ).toBe('allow');
    });

    test('a tab behind is refused, even for a site already allowed', () => {
        expect(
            decideMicrophoneAsk(genAsk({ isAllowed: true }), {
                guestId: 8,
                providerKey: 'claude',
            }),
        ).toBe('refuse');
        expect(
            decideMicrophoneAsk(genAsk(), {
                guestId: null,
                providerKey: 'claude',
            }),
        ).toBe('refuse');
    });

    test('a page off the tab site is refused', () => {
        for (const hostname of [
            'accounts.google.com',
            'notclaude.ai',
            'claude.ai.evil.com',
            'chatgpt.com',
        ]) {
            expect(
                decideMicrophoneAsk(genAsk({ hostname, isAllowed: true }), {
                    guestId: 7,
                    providerKey: 'claude',
                }),
            ).toBe('refuse');
        }
        expect(
            decideMicrophoneAsk(genAsk(), { guestId: 7, providerKey: null }),
        ).toBe('refuse');
    });
});
