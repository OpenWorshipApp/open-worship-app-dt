import { describe, expect, it, vi } from 'vitest';

// The hook's effect runs in a panel; this file holds the notice itself.
vi.mock('../helper/appHooks', () => ({
    useAppEffect: () => {},
}));

import {
    notifyForegroundPanel,
    subscribeForegroundPanel,
} from './foregroundPanelRevisionHelpers';

describe('a panel told of a write from outside it', () => {
    it("tells that component's open panels, and only them", () => {
        const countdown = vi.fn();
        const marquee = vi.fn();
        const stopCountdown = subscribeForegroundPanel('countdown', countdown);
        const stopMarquee = subscribeForegroundPanel('marquee-top', marquee);
        notifyForegroundPanel('countdown');
        expect(countdown).toHaveBeenCalledTimes(1);
        expect(marquee).not.toHaveBeenCalled();
        stopCountdown();
        stopMarquee();
    });

    it('forgets a closed panel', () => {
        const listener = vi.fn();
        const stop = subscribeForegroundPanel('quick-text', listener);
        stop();
        notifyForegroundPanel('quick-text');
        expect(listener).not.toHaveBeenCalled();
    });

    it('survives a listener that closes another while it is told', () => {
        const second = vi.fn();
        let stopSecond = () => {};
        const first = vi.fn(() => {
            stopSecond();
        });
        const stopFirst = subscribeForegroundPanel('time', first);
        stopSecond = subscribeForegroundPanel('time', second);
        notifyForegroundPanel('time');
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        stopFirst();
    });
});
