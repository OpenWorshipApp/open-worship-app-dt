import { describe, expect, it } from 'vitest';

import {
    AGENT_FOREGROUND_ACTIONS,
    AGENT_FOREGROUND_WIDGETS,
    describeForeground,
    formatForegroundResult,
    genForegroundExpression,
    toForegroundWidgetNoun,
} from './agentForeground.mjs';

const started = {
    did: 'started',
    widget: 'countdown',
    detail: 'a 5 minute countdown, ending at 11:45 AM',
    screens: [{ screenId: 0, isShowing: false, isLocked: false, foreground: ['countdown to 11:45:03 AM'] }],
    isAnyShowing: false,
};

describe('genForegroundExpression', () => {
    it('carries the request and no app import', () => {
        const expression = genForegroundExpression({
            widget: 'countdown',
            minutes: 5,
            action: 'start',
        });
        expect(expression).toContain('"widget":"countdown"');
        expect(expression).toContain('"minutes":5');
        expect(expression).toContain("'owa-agent-foreground'");
        expect(expression).toContain("'owa-agent-foreground-answer'");
        expect(expression).not.toContain('import(');
    });

    it('lists the widgets and the three actions', () => {
        expect(AGENT_FOREGROUND_WIDGETS).toEqual([
            'countdown',
            'stopwatch',
            'clock',
            'marquee-top',
            'marquee-bottom',
            'quick-text',
            'all',
        ]);
        expect(AGENT_FOREGROUND_ACTIONS).toEqual(['start', 'stop', 'check']);
    });

    it('names each widget for a person', () => {
        expect(toForegroundWidgetNoun('marquee-bottom')).toBe(
            'scrolling message along the bottom',
        );
        expect(toForegroundWidgetNoun('nonsense')).toBe('foreground extra');
    });
});

describe('formatForegroundResult', () => {
    it("hands a refusal to the model as the worker's own sentence", () => {
        const formatted = formatForegroundResult({
            isError: true,
            reason: 'Say how long the countdown is.',
        });
        expect(formatted.isError).toBe(true);
        expect(formatted.text).toBe('Say how long the countdown is.');
    });

    it('hands a result over as JSON', () => {
        const formatted = formatForegroundResult(started);
        expect(formatted.isError).toBe(false);
        expect(JSON.parse(formatted.text)).toEqual(started);
    });

    it('says when the app did not answer at all', () => {
        expect(formatForegroundResult(null)).toEqual({
            isError: true,
            text: 'The app did not answer.',
        });
    });
});

describe('describeForeground', () => {
    it('says what went up and that the screen is off', () => {
        expect(describeForeground(started)).toBe(
            'A 5 minute countdown, ending at 11:45 AM is on the screen now. ' +
                'Screen 0 is off, so the projector is not showing it yet.',
        );
    });

    it('says the screen is showing it when it is', () => {
        expect(
            describeForeground({
                ...started,
                isAnyShowing: true,
                screens: [{ screenId: 0, isShowing: true, isLocked: false, foreground: [] }],
            }),
        ).toBe(
            'A 5 minute countdown, ending at 11:45 AM is on the screen now. ' +
                'Screen 0 is showing it to the projector.',
        );
    });

    it('leaves a locked screen out of both lists', () => {
        expect(
            describeForeground({
                ...started,
                screens: [{ screenId: 1, isShowing: false, isLocked: true, foreground: [] }],
            }),
        ).toBe('A 5 minute countdown, ending at 11:45 AM is on the screen now.');
    });

    it('a stop carries its note, and a check its detail', () => {
        expect(
            describeForeground({
                did: 'stopped',
                widget: 'countdown',
                detail: 'The countdown is off the screen now.',
                screens: [],
                isAnyShowing: false,
                note: 'There was no countdown on the screen, so nothing changed.',
            }),
        ).toBe(
            'The countdown is off the screen now. There was no countdown on ' +
                'the screen, so nothing changed.',
        );
        expect(
            describeForeground({
                did: 'checked',
                widget: null,
                detail: 'No foreground extra is on any screen.',
                screens: [],
                isAnyShowing: false,
            }),
        ).toBe('No foreground extra is on any screen.');
    });

    it('repeats a refusal, and says when the app did not answer', () => {
        expect(describeForeground({ isError: true, reason: 'Nope.' })).toBe('Nope.');
        expect(describeForeground(null)).toBe('The app did not answer.');
    });
});
