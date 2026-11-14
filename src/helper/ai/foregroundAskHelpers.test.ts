import { describe, expect, it } from 'vitest';

import {
    checkIsSameForegroundAsk,
    toValidForegroundAsk,
} from './foregroundAskHelpers';

describe('the foreground session a conversation is about', () => {
    it('keeps a component, a session and a camera, field by field', () => {
        expect(
            toValidForegroundAsk({
                widget: 'quick-text',
                sessionId: 's5k1',
                sessionName: '  Session   2 ',
                stray: 'dropped',
            }),
        ).toEqual({
            widget: 'quick-text',
            sessionId: 's5k1',
            sessionName: 'Session 2',
        });
        expect(
            toValidForegroundAsk({
                widget: 'camera',
                sessionId: '',
                itemId: 'abc',
                itemLabel: 'USB Camera',
            }),
        ).toEqual({
            widget: 'camera',
            sessionId: '',
            sessionName: '',
            itemId: 'abc',
            itemLabel: 'USB Camera',
        });
    });

    it('drops an unknown component or a session id no strip could make', () => {
        expect(toValidForegroundAsk({ widget: 'clock' })).toBeNull();
        expect(
            toValidForegroundAsk({ widget: 'countdown', sessionId: '../x' }),
        ).toBeNull();
        expect(toValidForegroundAsk('countdown')).toBeNull();
    });

    it('tells two chips of the same session apart from two sessions', () => {
        const one = { widget: 'countdown', sessionId: 's1', sessionName: 'A' };
        expect(
            checkIsSameForegroundAsk(
                one as any,
                {
                    ...one,
                    sessionName: 'renamed',
                } as any,
            ),
        ).toBe(true);
        expect(
            checkIsSameForegroundAsk(
                one as any,
                {
                    ...one,
                    sessionId: 's2',
                } as any,
            ),
        ).toBe(false);
    });
});
