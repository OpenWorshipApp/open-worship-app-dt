// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

// The browser page watching a virtual display (`/vd/<n>/`), run on its own
// HTML with a stand-in socket: when it loses the display it says so and
// offers Retry, which tries at once instead of a reload.
class FakeSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: FakeSocket[] = [];
    readyState = FakeSocket.CONNECTING;
    sent: string[] = [];
    private listeners = new Map<string, ((event: any) => void)[]>();
    constructor(readonly url: string) {
        FakeSocket.instances.push(this);
    }
    addEventListener(name: string, listener: (event: any) => void) {
        this.listeners.set(name, [
            ...(this.listeners.get(name) ?? []),
            listener,
        ]);
    }
    send(text: string) {
        this.sent.push(text);
    }
    private emit(name: string, event: any) {
        for (const listener of this.listeners.get(name) ?? []) {
            listener(event);
        }
    }
    open() {
        this.readyState = FakeSocket.OPEN;
        this.emit('open', {});
    }
    receive(packet: unknown) {
        this.emit('message', { data: JSON.stringify(packet) });
    }
    drop(code = 1006) {
        this.readyState = FakeSocket.CLOSED;
        this.emit('close', { code });
    }
}

const LAYOUT = {
    number: 1,
    name: 'Lobby TV',
    width: 1920,
    height: 1080,
    wallpaper: { kind: 'none' },
    screenIds: [],
    labels: { retry: 'Try now', waiting: 'Lost the display' },
};

function element<T extends HTMLElement>(id: string) {
    return document.getElementById(id) as T;
}
const latest = () => FakeSocket.instances.at(-1)!;

// The browser's cast picker (the Remote Playback API), as Chrome has it.
let reportAvailability: (isAvailable: boolean) => void = () => {};
const remote = Object.assign(new EventTarget(), {
    prompt: vi.fn(async () => {}),
    watchAvailability: vi.fn(
        async (callback: (isAvailable: boolean) => void) => {
            reportAvailability = callback;
            return 1;
        },
    ),
    cancelWatchAvailability: vi.fn(async () => {}),
});

beforeAll(async () => {
    vi.useFakeTimers();
    globalThis.history.replaceState(null, '', '/vd/1/');
    const html = fs.readFileSync(
        path.join(process.cwd(), 'html', 'virtual-display-viewer.html'),
        'utf8',
    );
    document.body.innerHTML = new DOMParser()
        .parseFromString(html, 'text/html')
        .body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, '');
    (globalThis as any).WebSocket = FakeSocket;
    HTMLMediaElement.prototype.play = vi.fn(async () => {});
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'remote', {
        configurable: true,
        get: () => remote,
    });
    await import('./virtual-display-viewer');
});

afterEach(() => {
    vi.clearAllTimers();
});

test('a lost display offers Retry, which tries at once', () => {
    expect(FakeSocket.instances).toHaveLength(1);
    expect(latest().url).toMatch(/\/vd\/1\/ws\?viewer=[0-9a-f]{24}$/);
    latest().open();
    latest().receive({ type: 'layout', layout: LAYOUT });
    expect(element('status').hidden).toBe(true);

    latest().drop();
    expect(element('status').hidden).toBe(false);
    expect(element('status-text').textContent).toBe('Lost the display');
    const retry = element<HTMLButtonElement>('retry-button');
    expect(retry.hidden).toBe(false);
    expect(retry.textContent).toBe('Try now');

    retry.click();
    expect(FakeSocket.instances).toHaveLength(2);
    expect(retry.disabled).toBe(true);
    // While that one is still connecting, another press does nothing, and
    // the automatic try it replaced never comes.
    retry.click();
    vi.advanceTimersByTime(20000);
    expect(FakeSocket.instances).toHaveLength(2);

    latest().open();
    latest().receive({ type: 'layout', layout: LAYOUT });
    expect(element('status').hidden).toBe(true);
});

test('without Retry it still tries again by itself', () => {
    const before = FakeSocket.instances.length;
    latest().drop();
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.instances).toHaveLength(before + 1);
    latest().open();
    latest().receive({ type: 'layout', layout: LAYOUT });
});

test('disconnected or locked out, it stops asking until Retry', () => {
    latest().receive({
        type: 'refused',
        reason: 'locked',
        labels: { locked: 'Too many wrong codes' },
    });
    latest().drop(4001);
    expect(element('status-text').textContent).toBe('Too many wrong codes');
    const before = FakeSocket.instances.length;
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(before);
    expect(element<HTMLButtonElement>('retry-button').hidden).toBe(false);
    element<HTMLButtonElement>('retry-button').click();
    expect(FakeSocket.instances).toHaveLength(before + 1);
});

test('waiting to be let in shows no Retry; the code form sends the code', () => {
    latest().open();
    latest().receive({ type: 'access', waiting: 'approval', labels: {} });
    expect(element('status').hidden).toBe(false);
    expect(element<HTMLButtonElement>('retry-button').hidden).toBe(true);
    latest().receive({ type: 'access', waiting: 'code', labels: {} });
    expect(element('status').hidden).toBe(true);
    expect(element('code-form').hidden).toBe(false);
    element<HTMLInputElement>('code-input').value = 'church-1234';
    element<HTMLFormElement>('code-form').requestSubmit();
    expect(latest().sent).toEqual([
        JSON.stringify({ type: 'code', code: 'church-1234' }),
    ]);
});

// A display with nothing on it says so instead of a bare wallpaper: no screen
// on it, or every screen page on it said it shows nothing.
test('an empty display says nothing is showing yet', () => {
    const notice = element('empty-notice');
    latest().open();
    latest().receive({ type: 'layout', layout: { ...LAYOUT, screenIds: [] } });
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('Nothing is showing on this display yet.');
    latest().receive({ type: 'layout', layout: { ...LAYOUT, screenIds: [5] } });
    // Not heard from yet: counted as showing something.
    expect(notice.hidden).toBe(true);
    const frame = element('stage').querySelector('iframe')!;
    const post = (isEmpty: boolean, source: unknown = frame.contentWindow) => {
        globalThis.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'owa-vd-screen-state', screenId: 5, isEmpty },
                origin: globalThis.location.origin,
                source: source as Window,
            }),
        );
    };
    post(true);
    expect(notice.hidden).toBe(false);
    post(false);
    expect(notice.hidden).toBe(true);
    // Another window's word does not count.
    post(true, globalThis.window);
    expect(notice.hidden).toBe(true);
    // Losing the display shows that instead.
    post(true);
    latest().drop();
    expect(notice.hidden).toBe(true);
    expect(element('status').hidden).toBe(false);
});

// The controls show while a mouse is over the page and hide the moment it
// leaves; a touch, with no hover to go by, shows them for three seconds.
test('the controls show only while the mouse is over the page', () => {
    const isShown = () => !document.body.classList.contains('is-idle');
    const pointer = (pointerType: string, type = 'pointermove') => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, 'pointerType', { value: pointerType });
        document.dispatchEvent(event);
    };
    pointer('mouse');
    expect(isShown()).toBe(true);
    // Resting inside: still shown.
    vi.advanceTimersByTime(10000);
    expect(isShown()).toBe(true);
    document.documentElement.dispatchEvent(new Event('mouseleave'));
    expect(isShown()).toBe(false);
    pointer('touch', 'pointerdown');
    expect(isShown()).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(isShown()).toBe(false);
});

// One speaker on the page: the display's sound and the voice of whoever runs
// it, on and off together. The screens load again as the sound player
// (`sound=1`), or no longer.
test('one sound button turns the sound on and off again', () => {
    latest().open();
    latest().receive({
        type: 'layout',
        layout: { ...LAYOUT, screenIds: [3] },
    });
    const button = element<HTMLButtonElement>('sound-button');
    const frame = () => document.querySelector('iframe')!;
    expect(
        document.querySelectorAll('#toolbar [id$="sound-button"]'),
    ).toHaveLength(1);
    expect(element('sound-group').hidden).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.title).toBe('Turn on sound');
    expect(frame().src).not.toContain('sound=1');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe('Turn off sound');
    expect(frame().src).toContain('sound=1');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.title).toBe('Turn on sound');
    expect(frame().src).not.toContain('sound=1');
});

// Shared like a video call: pressed, the camera opens and the computer running
// the display is told; pressed again, it closes. One that cannot be opened (in
// use by another app, refused) leaves the button off and says so.
test('the camera button turns on with the camera, and says when it cannot', async () => {
    latest().open();
    latest().receive({ type: 'layout', layout: LAYOUT });
    const track = { label: 'Front Camera', stop: vi.fn() };
    const stream = {
        getVideoTracks: () => [track],
        getTracks: () => [track],
    };
    const getUserMedia = vi.fn(async () => stream);
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
    });
    const button = element<HTMLButtonElement>('share-camera-button');
    const flush = () => vi.advanceTimersByTimeAsync(0);
    button.click();
    await flush();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(latest().sent.map((text) => JSON.parse(text))).toContainEqual({
        type: 'camera-state',
        shared: true,
        label: 'Front Camera',
    });
    button.click();
    await flush();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(track.stop).toHaveBeenCalled();
    expect(JSON.parse(latest().sent.at(-1)!)).toEqual({
        type: 'camera-state',
        shared: false,
    });
    getUserMedia.mockRejectedValueOnce(new Error('NotReadableError'));
    button.click();
    await flush();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(element('toast').hidden).toBe(false);
    expect(element('toast').textContent).toContain(
        'The camera could not be opened.',
    );
    vi.advanceTimersByTime(5000);
    expect(element('toast').hidden).toBe(true);
});

// "Cast to a TV" did nothing in Chrome: the browser's picker, handed a stream
// it had never loaded, closed at once, and the page took that for a person
// closing it. The page casts to a TV on THIS DEVICE's network through the
// browser, from the app's stream (its address carries the token the app gave
// this browser); a browser on the app's network also gets the app's TVs.
test('the cast button casts through the browser, from the app’s stream', async () => {
    const flush = () => vi.advanceTimersByTimeAsync(0);
    const sentOf = (type: string) => {
        return latest()
            .sent.map((text) => JSON.parse(text))
            .filter((packet) => packet.type === type);
    };
    const castUrl = 'http://192.168.1.5:39240/vd/1/video';
    latest().open();
    latest().receive({ type: 'layout', layout: { ...LAYOUT, castUrl } });
    const button = element<HTMLButtonElement>('cast-button');
    const panel = element('cast-panel');
    const picker = element<HTMLButtonElement>('cast-picker');
    expect(button.hidden).toBe(false);
    expect(button.title).toBe('Cast to a TV');
    button.click();
    await flush();
    expect(panel.hidden).toBe(false);
    expect(sentOf('cast-open')).toHaveLength(1);
    expect(sentOf('cast-stream')).toHaveLength(1);
    // No stream yet: nothing to hand a TV.
    expect(picker.disabled).toBe(true);

    // The app's stream for this browser. This page is on the display's own
    // computer, so the TV is handed the app's address on its network.
    latest().receive({ type: 'cast-stream', path: '/vd/1/video?cast=abc123' });
    const video = [
        ...document.querySelectorAll<HTMLVideoElement>('body > video'),
    ].find((item) => item.src.includes('/vd/1/video'))!;
    expect(video.src).toBe(`${castUrl}?cast=abc123`);
    expect(video.preload).toBe('metadata');
    expect(video.muted).toBe(true);
    // Read to its start, never played here.
    expect(video.play).not.toHaveBeenCalled();
    expect(remote.watchAvailability).toHaveBeenCalled();
    expect(picker.disabled).toBe(false);
    expect(picker.textContent).toBe('Cast from this browser');
    expect(element('cast-picker-note').textContent).toContain(
        'same network as this device',
    );
    // Having read the stream, the browser says whether it knows a TV.
    await flush();
    reportAvailability(false);
    expect(element('cast-picker-note').textContent).toContain(
        'This browser found no TV',
    );
    reportAvailability(true);
    expect(element('cast-picker-note').textContent).toBe(
        'For a TV on the same network as this device.',
    );

    // The browser's own picker, and a TV taking it.
    picker.click();
    await flush();
    expect(remote.prompt).toHaveBeenCalledTimes(1);
    remote.dispatchEvent(new Event('connect'));
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(video.play).toHaveBeenCalled();
    remote.dispatchEvent(new Event('disconnect'));
    expect(button.getAttribute('aria-pressed')).toBe('false');

    // Closed at once, before a hand could: the browser found no TV.
    remote.prompt.mockRejectedValueOnce(
        new DOMException('The prompt was dismissed.', 'NotAllowedError'),
    );
    picker.click();
    await flush();
    expect(element('cast-picker-note').textContent).toContain(
        'This browser found no TV',
    );
    // Closed by a hand: nothing to say.
    remote.prompt.mockImplementationOnce(() => {
        return new Promise((_resolve, reject) => {
            setTimeout(() => {
                reject(
                    new DOMException(
                        'The prompt was dismissed.',
                        'NotAllowedError',
                    ),
                );
            }, 1000);
        });
    });
    picker.click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(element('cast-picker-note').textContent).not.toContain(
        'This browser found no TV',
    );

    // On the app's network, the TVs the app found are listed too.
    const tv = { id: 'tv-1', name: 'Hall TV', kind: 'google-cast' };
    const state = (status: string | null, isAllowed = true) => ({
        isAllowed,
        isSharing: true,
        isSearching: false,
        targets: [{ ...tv, status, behind: status === 'casting' ? 1.4 : null }],
    });
    latest().receive({ type: 'cast', state: state(null) });
    expect(element('cast-app').hidden).toBe(false);
    const row = () => element('cast-list').querySelector('li')!;
    expect(row().textContent).toContain('Hall TV');
    expect(row().textContent).toContain('Google Cast');
    row().querySelector('button')!.click();
    expect(sentOf('cast-start')).toEqual([
        { type: 'cast-start', targetId: 'tv-1' },
    ]);
    latest().receive({ type: 'cast', state: state('casting') });
    expect(row().textContent).toContain('Casting · 1.4 s');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    row().querySelector('button')!.click();
    expect(sentOf('cast-stop')).toEqual([
        { type: 'cast-stop', targetId: 'tv-1' },
    ]);
    // From the internet the app's network is not this device's: only the
    // browser's own cast is offered.
    latest().receive({ type: 'cast', state: state(null, false) });
    expect(element('cast-app').hidden).toBe(true);
    expect(picker.hidden).toBe(false);

    // Closed: the stream is let go, so the app stops making it.
    element<HTMLButtonElement>('cast-close').click();
    expect(panel.hidden).toBe(true);
    expect(sentOf('cast-close')).toHaveLength(1);
    expect(remote.cancelWatchAvailability).toHaveBeenCalledWith(1);
    expect(video.hasAttribute('src')).toBe(false);
});
