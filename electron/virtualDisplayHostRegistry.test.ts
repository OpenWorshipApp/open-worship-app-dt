import { expect, test, vi } from 'vitest';

import {
    checkIsVirtualDisplayGuest,
    checkIsVirtualDisplayHost,
    markVirtualDisplayHost,
    setVirtualDisplayAudioTarget,
    takeVirtualDisplayAudioTarget,
} from './virtualDisplayHostRegistry';

// A compositor page as the registry sees it: an id, and its `destroyed`
// event, fired by the test.
function genContents(id: number) {
    const listeners = new Map<string, () => void>();
    const contents = {
        id,
        once: vi.fn((name: string, listener: () => void) => {
            listeners.set(name, listener);
        }),
    };
    return {
        contents: contents as any,
        destroy: () => listeners.get('destroyed')?.(),
    };
}

test('a compositor is a host until it is destroyed, and its guests are known by it', () => {
    const { contents: host, destroy } = genContents(9001);
    const { contents: other } = genContents(9002);
    expect(checkIsVirtualDisplayHost(host)).toBe(false);
    markVirtualDisplayHost(host);
    expect(host.once).toHaveBeenCalledWith('destroyed', expect.any(Function));
    expect(checkIsVirtualDisplayHost(host)).toBe(true);
    expect(checkIsVirtualDisplayHost(other)).toBe(false);
    expect(checkIsVirtualDisplayHost(null)).toBe(false);
    expect(checkIsVirtualDisplayHost(undefined)).toBe(false);
    // A screen page inside it, and one inside a page that is not one.
    expect(checkIsVirtualDisplayGuest({ hostWebContents: host } as any)).toBe(
        true,
    );
    expect(checkIsVirtualDisplayGuest({ hostWebContents: other } as any)).toBe(
        false,
    );
    expect(checkIsVirtualDisplayGuest({} as any)).toBe(false);
    expect(checkIsVirtualDisplayGuest(null)).toBe(false);

    // Destroyed: no longer a host, and its audio target goes with it.
    setVirtualDisplayAudioTarget(host, { routingId: 1 } as any);
    destroy();
    expect(checkIsVirtualDisplayHost(host)).toBe(false);
    expect(checkIsVirtualDisplayGuest({ hostWebContents: host } as any)).toBe(
        false,
    );
    expect(takeVirtualDisplayAudioTarget(host)).toBeNull();
});

test("a screen's audio target is taken once, and null clears it", () => {
    const { contents: host } = genContents(9003);
    const { contents: other } = genContents(9004);
    const frame = { routingId: 2 } as any;
    setVirtualDisplayAudioTarget(host, frame);
    // Kept per host.
    expect(takeVirtualDisplayAudioTarget(other)).toBeNull();
    expect(takeVirtualDisplayAudioTarget(host)).toBe(frame);
    expect(takeVirtualDisplayAudioTarget(host)).toBeNull();
    setVirtualDisplayAudioTarget(host, frame);
    setVirtualDisplayAudioTarget(host, null);
    expect(takeVirtualDisplayAudioTarget(host)).toBeNull();
});
