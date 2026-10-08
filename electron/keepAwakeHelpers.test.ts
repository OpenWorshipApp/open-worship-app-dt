import { beforeEach, expect, test, vi } from 'vitest';

const powerSaveBlocker = vi.hoisted(() => {
    let lastId = 0;
    return {
        start: vi.fn(() => {
            lastId += 1;
            return lastId;
        }),
        stop: vi.fn(),
    };
});
vi.mock('electron', () => ({ powerSaveBlocker }));

import { genKeepAwake } from './keepAwakeHelpers';

beforeEach(() => {
    powerSaveBlocker.start.mockClear();
    powerSaveBlocker.stop.mockClear();
});

test('holds one request while awake and releases it on the way down', () => {
    const setIsAwake = genKeepAwake();

    setIsAwake(false);
    expect(powerSaveBlocker.stop).not.toHaveBeenCalled();

    setIsAwake(true);
    setIsAwake(true);
    expect(powerSaveBlocker.start).toHaveBeenCalledTimes(1);
    expect(powerSaveBlocker.start).toHaveBeenCalledWith(
        'prevent-display-sleep',
    );
    const blockerId = powerSaveBlocker.start.mock.results[0].value;

    setIsAwake(false);
    setIsAwake(false);
    expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
    expect(powerSaveBlocker.stop).toHaveBeenCalledWith(blockerId);

    setIsAwake(true);
    expect(powerSaveBlocker.start).toHaveBeenCalledTimes(2);
});

test('each holder releases only its own request', () => {
    const setScreenAwake = genKeepAwake();
    const setMirrorAwake = genKeepAwake();

    setScreenAwake(true);
    setMirrorAwake(true);
    const [screenId, mirrorId] = powerSaveBlocker.start.mock.results.map(
        ({ value }) => value,
    );
    expect(screenId).not.toBe(mirrorId);

    setScreenAwake(false);
    expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
    expect(powerSaveBlocker.stop).toHaveBeenCalledWith(screenId);
});
