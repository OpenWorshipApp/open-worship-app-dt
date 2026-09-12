import { describe, expect, it } from 'vitest';

import {
    AGENT_BIBLE_ACTIONS,
    describePresentedBible,
    formatPresentBibleResult,
    genPresentBibleExpression,
} from './agentBible.mjs';

const presented = {
    isPresented: true,
    reference: 'John 3:16',
    version: 'KJV',
    text: '(16): For God so loved the world',
    screens: [{ screenId: 0, isShowing: false, isLocked: false, bible: { reference: 'John 3:16', version: 'KJV' } }],
    isAnyShowing: false,
};

describe('genPresentBibleExpression', () => {
    it('carries the request and no app import', () => {
        const expression = genPresentBibleExpression({
            reference: 'John 3:16',
            version: 'KJV',
            action: 'present',
        });
        expect(expression).toContain('"reference":"John 3:16"');
        expect(expression).toContain("'owa-agent-bible'");
        expect(expression).toContain("'owa-agent-bible-answer'");
        expect(expression).not.toContain('import(');
    });

    it('lists the two actions', () => {
        expect(AGENT_BIBLE_ACTIONS).toEqual(['present', 'check']);
    });
});

describe('formatPresentBibleResult', () => {
    it('hands a refusal to the model as its own sentence, with the versions', () => {
        const formatted = formatPresentBibleResult({
            isError: true,
            reason: 'No Bible version called "NIV" is installed.',
            versions: ['KJV', 'Amplified'],
        });
        expect(formatted.isError).toBe(true);
        expect(formatted.text).toBe(
            'No Bible version called "NIV" is installed. Installed versions: KJV, Amplified.',
        );
    });

    it('treats no answer as an error, never as a blank success', () => {
        expect(formatPresentBibleResult(null).isError).toBe(true);
        expect(formatPresentBibleResult('x').isError).toBe(true);
    });

    it('passes a result through whole', () => {
        const formatted = formatPresentBibleResult(presented);
        expect(formatted.isError).toBe(false);
        expect(JSON.parse(formatted.text)).toEqual(presented);
    });
});

// What CHANGED, in words a person can check against the wall -- never what
// was pressed.
describe('describePresentedBible', () => {
    it('says the passage is up and that the screen is off', () => {
        expect(describePresentedBible(presented)).toBe(
            'John 3:16 (KJV) is on the screen now -- "(16): For God so loved the world". ' +
                'Screen 0 is off, so the projector is not showing it yet.',
        );
    });

    it('says which screens are showing it', () => {
        expect(
            describePresentedBible({
                ...presented,
                isAnyShowing: true,
                screens: [
                    { screenId: 0, isShowing: true, isLocked: false, bible: {} },
                    { screenId: 1, isShowing: true, isLocked: false, bible: {} },
                ],
            }),
        ).toBe(
            'John 3:16 (KJV) is on the screen now -- "(16): For God so loved the world". ' +
                'Screen 0 and 1 are showing it to the projector.',
        );
    });

    it('never counts a locked screen as one the verse reached', () => {
        expect(
            describePresentedBible({
                ...presented,
                screens: [
                    { screenId: 0, isShowing: false, isLocked: false, bible: {} },
                    { screenId: 1, isShowing: false, isLocked: true, bible: null },
                ],
            }),
        ).toBe(
            'John 3:16 (KJV) is on the screen now -- "(16): For God so loved the world". ' +
                'Screen 0 is off, so the projector is not showing it yet.',
        );
    });

    it('reads a check back without claiming a screen', () => {
        expect(
            describePresentedBible({ ...presented, isPresented: false }),
        ).toBe(
            'John 3:16 (KJV) reads -- "(16): For God so loved the world". It is not on a screen.',
        );
    });

    it('repeats a refusal as it was written', () => {
        expect(
            describePresentedBible({ isError: true, reason: 'Screen 0 is locked.' }),
        ).toBe('Screen 0 is locked.');
        expect(describePresentedBible(null)).toBe('The app did not answer.');
    });
});
