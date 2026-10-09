import { afterEach, expect, test, vi } from 'vitest';

import { MirrorIntercom, type IntercomHostType } from './mirrorIntercom';

function genIntercom() {
    const host = {
        send: vi.fn(),
        toBroker: vi.fn(),
        onActiveChanged: vi.fn(),
        onChanged: vi.fn(),
    } satisfies IntercomHostType;
    return { intercom: new MirrorIntercom(host), host };
}

afterEach(() => {
    vi.useRealTimers();
});

test('each side turns on only its own microphone and speaker', () => {
    const { intercom, host } = genIntercom();
    expect(intercom.stateOf('guest:a')).toEqual({
        mic: false,
        speaker: false,
        volume: 1,
        remoteMic: false,
    });
    intercom.set('guest:a', { mic: true });
    // The other side is told, so it can show it.
    expect(host.send).toHaveBeenCalledWith('guest:a', 'intercom-state', {
        mic: true,
    });
    expect(host.onActiveChanged).toHaveBeenLastCalledWith(true);
    expect(host.toBroker).toHaveBeenLastCalledWith({
        type: 'config',
        isMicOn: true,
        speakers: {},
    });
    intercom.set('link:b', { speaker: true, volume: 0.4 });
    expect(host.toBroker).toHaveBeenLastCalledWith({
        type: 'config',
        isMicOn: true,
        speakers: { 'link:b': 0.4 },
    });
    // A volume is shown too (the slider sprang back without it), clamped
    // to 0..1; the same volume again changes nothing.
    host.onChanged.mockClear();
    intercom.set('link:b', { volume: 7 });
    expect(intercom.stateOf('link:b').volume).toBe(1);
    expect(host.onChanged).toHaveBeenCalledTimes(1);
    intercom.set('link:b', { volume: 1 });
    expect(host.onChanged).toHaveBeenCalledTimes(1);
    intercom.set('guest:a', { mic: false });
    intercom.set('link:b', { speaker: false });
    expect(host.onActiveChanged).toHaveBeenLastCalledWith(false);
    expect(host.onActiveChanged).toHaveBeenCalledTimes(2);
});

test('sound goes out on every microphone that is on, and in only to a speaker that is on', () => {
    const { intercom, host } = genIntercom();
    intercom.set('guest:a', { mic: true });
    intercom.set('guest:b', { mic: false, speaker: true });
    host.send.mockClear();
    intercom.sendLocal(new Uint8Array([1, 2, 3]));
    expect(host.send).toHaveBeenCalledTimes(1);
    expect(host.send).toHaveBeenCalledWith('guest:a', 'audio', {
        data: 'AQID',
    });
    // Not bytes, or too many of them: nothing goes out.
    intercom.sendLocal('AQID');
    intercom.sendLocal(new Uint8Array(2000));
    expect(host.send).toHaveBeenCalledTimes(1);
    host.toBroker.mockClear();
    intercom.receive('guest:a', { data: 'AQID' });
    expect(host.toBroker).not.toHaveBeenCalled();
    intercom.receive('guest:b', { data: 'AQID' });
    expect(host.toBroker).toHaveBeenCalledWith({
        type: 'audio',
        key: 'guest:b',
        data: new Uint8Array([1, 2, 3]),
    });
    intercom.receive('guest:b', { data: 42 });
    intercom.receive('guest:b', { data: 'A'.repeat(5000) });
    expect(host.toBroker).toHaveBeenCalledTimes(1);
});

test('at most a hundred packets a second come in from one connection', () => {
    vi.useFakeTimers();
    const { intercom, host } = genIntercom();
    intercom.set('link:b', { speaker: true });
    host.toBroker.mockClear();
    for (let index = 0; index < 150; index++) {
        intercom.receive('link:b', { data: 'AQID' });
    }
    expect(host.toBroker).toHaveBeenCalledTimes(100);
    vi.advanceTimersByTime(1000);
    intercom.receive('link:b', { data: 'AQID' });
    expect(host.toBroker).toHaveBeenCalledTimes(101);
});

test('the other side’s microphone, a dropped connection and an ended one', () => {
    const { intercom, host } = genIntercom();
    intercom.setRemoteMic('link:b', true);
    expect(intercom.stateOf('link:b').remoteMic).toBe(true);
    expect(host.onChanged).toHaveBeenCalledTimes(1);
    intercom.set('link:b', { mic: true, speaker: true });
    // Dropped: its own toggles stay, the other side's microphone does not.
    intercom.pause('link:b');
    expect(intercom.stateOf('link:b')).toMatchObject({
        mic: true,
        speaker: true,
        remoteMic: false,
    });
    // Back: the other side learns this microphone again.
    host.send.mockClear();
    intercom.announce('link:b');
    expect(host.send).toHaveBeenCalledWith('link:b', 'intercom-state', {
        mic: true,
    });
    intercom.forget('link:b');
    expect(intercom.stateOf('link:b').mic).toBe(false);
    expect(host.onActiveChanged).toHaveBeenLastCalledWith(false);
    host.send.mockClear();
    intercom.announce('link:b');
    expect(host.send).not.toHaveBeenCalled();
});
