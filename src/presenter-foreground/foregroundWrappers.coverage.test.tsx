import { describe, expect, test, vi } from 'vitest';

// The launcher's thin entries: each one is the shared panel set to ITS OWN
// kind or position, so opening Image Show never opens Video Show.

const { mocks } = vi.hoisted(() => ({
    mocks: {
        MediaComp: function ForegroundMediaComp() {
            return null;
        },
        MarqueeComp: function ForegroundMarqueeComp() {
            return null;
        },
    },
}));

vi.mock('./ForegroundMediaComp', () => ({ default: mocks.MediaComp }));
vi.mock('./ForegroundMarqueeComp', () => ({ default: mocks.MarqueeComp }));

import ForegroundImageComp from './ForegroundImageComp';
import ForegroundMarqueeBottomComp from './ForegroundMarqueeBottomComp';
import ForegroundMarqueeTopComp from './ForegroundMarqueeTopComp';
import ForegroundVideoComp from './ForegroundVideoComp';
import ForegroundWebComp from './ForegroundWebComp';

describe('the thin foreground entries', () => {
    test.each([
        ['Image Show', ForegroundImageComp, 'image'],
        ['Video Show', ForegroundVideoComp, 'video'],
        ['Web Show', ForegroundWebComp, 'web'],
    ] as const)(
        '%s is the media panel for its own kind',
        (_name, Comp, kind) => {
            const element = Comp();
            expect(element.type).toBe(mocks.MediaComp);
            expect(element.props).toEqual({ kind });
        },
    );

    test.each([
        ['Marquee Top', ForegroundMarqueeTopComp, 'top'],
        ['Marquee Bottom', ForegroundMarqueeBottomComp, 'bottom'],
    ] as const)(
        '%s is the marquee panel at its own edge',
        (_name, Comp, position) => {
            const element = Comp();
            expect(element.type).toBe(mocks.MarqueeComp);
            expect(element.props).toEqual({ position });
        },
    );
});
