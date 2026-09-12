import { describe, expect, it } from 'vitest';

import {
    describeScreenContent,
    genListScreensExpression,
} from './agentScreens.mjs';

describe('genListScreensExpression', () => {
    const expression = genListScreensExpression();

    it('asks the app through the relay and answers on its second event', () => {
        expect(expression).toContain("'owa-agent-screens'");
        expect(expression).toContain("'owa-agent-screens-answer'");
    });

    it('reads the labels off each screen card, not off a guess', () => {
        expect(expression).toContain('.mini-screen.card[data-screen-key]');
        expect(expression).toContain('.show-hide[role="button"]');
        expect(expression).toContain('.control-buttons button');
        expect(expression).toContain('[data-widget-name="Mini Screen"]');
    });

    it('is one self-contained expression with no import in it', () => {
        expect(expression).not.toMatch(/\bimport\(/);
        expect(expression).not.toMatch(/\brequire\((?!'electron')/);
        // The whitespace regex must reach the page as \s, not as s.
        expect(expression).toContain('replace(/\\s+/g');
        expect(expression.trim().startsWith('(() => {')).toBe(true);
        expect(expression.trim().endsWith('})()')).toBe(true);
    });
});

describe('describeScreenContent', () => {
    it('says what a screen holds in one sentence, most important first', () => {
        expect(
            describeScreenContent({
                slide: {
                    document: 'Amazing Grace',
                    kind: 'song',
                    name: 'Verse 2',
                    text: 'Twas grace that taught',
                },
                bible: { reference: 'John 3:16', version: 'KJV' },
                background: { kind: 'video', name: 'sea.mp4' },
                foreground: ['clock', 'marquee at the top: "Welcome"'],
            }),
        ).toBe(
            'the song "Amazing Grace" (Verse 2) -- "Twas grace that taught"; ' +
                'John 3:16 (KJV); a video background (sea.mp4); ' +
                'foreground: clock, marquee at the top: "Welcome"',
        );
    });

    it('names every version when the passage is shown in several', () => {
        expect(
            describeScreenContent({
                bible: {
                    reference: 'John 3:16',
                    version: 'KJV',
                    versions: ['KJV', 'KHSV'],
                },
            }),
        ).toBe('John 3:16 in KJV, KHSV');
    });

    it('says blank plainly', () => {
        expect(
            describeScreenContent({
                slide: null,
                bible: null,
                background: null,
                foreground: [],
            }),
        ).toBe('nothing on any layer');
        expect(describeScreenContent(null)).toBe('');
    });
});
