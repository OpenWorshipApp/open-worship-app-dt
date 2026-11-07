import { EventEmitter } from 'node:events';
import { expect, test } from 'vitest';

import {
    checkIsVirtualDisplayGuest,
    checkIsVirtualDisplayHost,
    markVirtualDisplayHost,
    setVirtualDisplayAudioTarget,
    takeVirtualDisplayAudioTarget,
} from './virtualDisplayHostRegistry';

// A WebContents as far as the registry reads one: an id, and `destroyed`.
let lastId = 9000;
function genContents(hostWebContents?: unknown) {
    const contents = new EventEmitter() as any;
    lastId += 1;
    contents.id = lastId;
    contents.hostWebContents = hostWebContents;
    return contents;
}

test('only a page the main process marked is a host; a URL never makes one', () => {
    const host = genContents();
    const stranger = genContents();
    stranger.getURL = () => 'owa://local/virtual-display.html';

    markVirtualDisplayHost(host);

    expect(checkIsVirtualDisplayHost(host)).toBe(true);
    expect(checkIsVirtualDisplayHost(stranger)).toBe(false);
    expect(checkIsVirtualDisplayHost(null)).toBe(false);
    expect(checkIsVirtualDisplayHost(undefined)).toBe(false);
});

test('a guest is a page whose embedder is a marked host', () => {
    const host = genContents();
    markVirtualDisplayHost(host);
    const guest = genContents(host);
    const otherGuest = genContents(genContents());

    expect(checkIsVirtualDisplayGuest(guest)).toBe(true);
    expect(checkIsVirtualDisplayGuest(otherGuest)).toBe(false);
    // A page with no embedder at all is no guest.
    expect(checkIsVirtualDisplayGuest(genContents())).toBe(false);
    expect(checkIsVirtualDisplayGuest(null)).toBe(false);
});

test('the next capture takes the audio target once, and null clears it', () => {
    const host = genContents();
    const frame = { routingId: 4 } as any;

    setVirtualDisplayAudioTarget(host, frame);
    expect(takeVirtualDisplayAudioTarget(host)).toBe(frame);
    // Taken: the request after it captures no guest's sound.
    expect(takeVirtualDisplayAudioTarget(host)).toBeNull();

    setVirtualDisplayAudioTarget(host, frame);
    setVirtualDisplayAudioTarget(host, null);
    expect(takeVirtualDisplayAudioTarget(host)).toBeNull();
});

test('a destroyed host leaves the set and takes its audio target with it', () => {
    const host = genContents();
    const guest = genContents(host);
    markVirtualDisplayHost(host);
    setVirtualDisplayAudioTarget(host, { routingId: 7 } as any);

    host.emit('destroyed');

    expect(checkIsVirtualDisplayHost(host)).toBe(false);
    expect(checkIsVirtualDisplayGuest(guest)).toBe(false);
    expect(takeVirtualDisplayAudioTarget(host)).toBeNull();
    // `once`: nothing is left listening on the dead page.
    expect(host.listenerCount('destroyed')).toBe(0);
});
