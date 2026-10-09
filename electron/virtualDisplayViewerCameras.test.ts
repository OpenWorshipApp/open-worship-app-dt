import { expect, test, vi } from 'vitest';

import {
    MAX_VIEWER_FRAME_TEXT,
    ViewerCameras,
    type ViewerCamerasHostType,
} from './virtualDisplayViewerCameras';

function genCameras() {
    const host = {
        toViewer: vi.fn(),
        toWatcher: vi.fn(),
        onListChanged: vi.fn(),
    } satisfies ViewerCamerasHostType;
    return { cameras: new ViewerCameras(host), host };
}

// A browser's camera, shared like in a video call: listed here, encoded only
// while a window here shows it, and its frames go to those windows alone.
test('a shared camera is listed, started for its first window and stopped after its last', () => {
    const { cameras, host } = genCameras();
    cameras.receive('viewer-1', '198.51.100.9', {
        type: 'camera-state',
        shared: true,
        label: 'Front Camera',
    });
    expect(cameras.list()).toEqual([
        {
            deviceId: 'vd-camera:viewer-1',
            groupId: '',
            label: 'Browser 198.51.100.9: Front Camera',
        },
    ]);
    expect(cameras.labelOf('viewer-1')).toBe(
        'Browser 198.51.100.9: Front Camera',
    );
    expect(host.onListChanged).toHaveBeenCalledTimes(1);
    // Nobody watches: frames go nowhere.
    cameras.receive('viewer-1', '', {
        type: 'video',
        data: 'AQID',
        timestamp: 0,
    });
    expect(host.toWatcher).not.toHaveBeenCalled();
    expect(cameras.watch('window:7', 'vd-camera:viewer-1', true)).toBe(true);
    expect(host.toViewer).toHaveBeenLastCalledWith('viewer-1', {
        type: 'camera-start',
    });
    cameras.watch('window:8', 'vd-camera:viewer-1', true);
    expect(host.toViewer).toHaveBeenLastCalledWith('viewer-1', {
        type: 'camera-keyframe',
    });
    cameras.receive('viewer-1', '', {
        type: 'video',
        data: 'AQID',
        key: true,
        timestamp: 33.4,
    });
    expect(host.toWatcher).toHaveBeenCalledTimes(2);
    expect(host.toWatcher).toHaveBeenCalledWith('window:7', 'vd:camera-frame', {
        cameraId: 'vd-camera:viewer-1',
        type: 'key',
        timestamp: 33,
        data: new Uint8Array([1, 2, 3]),
        text: 'AQID',
    });
    cameras.watch('window:7', 'vd-camera:viewer-1', false);
    expect(host.toViewer).not.toHaveBeenLastCalledWith('viewer-1', {
        type: 'camera-stop',
    });
    cameras.forgetWatcher('window:8');
    expect(host.toViewer).toHaveBeenLastCalledWith('viewer-1', {
        type: 'camera-stop',
    });
});

test('a frame too large, too many, or not a frame is dropped', () => {
    vi.useFakeTimers();
    try {
        const { cameras, host } = genCameras();
        cameras.receive('v', '', { type: 'camera-state', shared: true });
        cameras.watch('window:1', 'vd-camera:v', true);
        cameras.receive('v', '', {
            type: 'video',
            data: 'A'.repeat(MAX_VIEWER_FRAME_TEXT + 4),
            timestamp: 0,
        });
        cameras.receive('v', '', { type: 'video', data: 'AQID' });
        cameras.receive('v', '', { type: 'video', data: 42, timestamp: 0 });
        expect(host.toWatcher).not.toHaveBeenCalled();
        for (let index = 0; index < 60; index++) {
            cameras.receive('v', '', {
                type: 'video',
                data: 'AQID',
                timestamp: 0,
            });
        }
        expect(host.toWatcher).toHaveBeenCalledTimes(40);
    } finally {
        vi.useRealTimers();
    }
});

test('a camera no longer shared pauses what shows it, and sharing again brings it back', () => {
    const { cameras, host } = genCameras();
    cameras.receive('v', '', { type: 'camera-state', shared: true });
    cameras.watch('window:3', 'vd-camera:v', true);
    host.toViewer.mockClear();
    cameras.receive('v', '', { type: 'camera-state', shared: false });
    expect(host.toWatcher).toHaveBeenCalledWith('window:3', 'vd:camera-end', {
        cameraId: 'vd-camera:v',
    });
    expect(cameras.list()).toEqual([]);
    // Asked for while not shared: paused at once, and kept.
    expect(cameras.watch('screen:v2:0', 'vd-camera:v', true)).toBe(false);
    expect(host.toWatcher).toHaveBeenLastCalledWith(
        'screen:v2:0',
        'vd:camera-end',
        {
            cameraId: 'vd-camera:v',
        },
    );
    expect(host.toViewer).not.toHaveBeenCalled();
    // Shared again (the tab reloaded, or the camera turned back on): its
    // encoder starts for both, with nothing asked again.
    cameras.receive('v', '', { type: 'camera-state', shared: true });
    expect(host.toViewer).toHaveBeenLastCalledWith('v', {
        type: 'camera-start',
    });
    host.toWatcher.mockClear();
    cameras.receive('v', '', {
        type: 'video',
        data: 'AQID',
        key: true,
        timestamp: 0,
    });
    expect(host.toWatcher.mock.calls.map(([watcher]) => watcher)).toEqual([
        'window:3',
        'screen:v2:0',
    ]);
    cameras.watch('window:3', 'vd-camera:v', false);
    cameras.forgetWatcher('screen:v2:0');
    expect(host.toViewer).toHaveBeenLastCalledWith('v', {
        type: 'camera-stop',
    });
    expect(cameras.watch('screen:v2:0', 'mirror-camera:x', true)).toBe(false);
});

test('a camera never shared is let go of without telling its browser, and only so many wait', () => {
    const { cameras, host } = genCameras();
    cameras.watch('window:1', 'vd-camera:gone', true);
    cameras.watch('window:1', 'vd-camera:gone', false);
    // Let go of: sharing it later starts nothing.
    cameras.receive('gone', '', { type: 'camera-state', shared: true });
    expect(host.toViewer).not.toHaveBeenCalled();
    for (let index = 0; index < 70; index++) {
        cameras.watch('window:1', `vd-camera:waiting-${index}`, true);
    }
    cameras.receive('waiting-63', '', { type: 'camera-state', shared: true });
    expect(host.toViewer).toHaveBeenLastCalledWith('waiting-63', {
        type: 'camera-start',
    });
    host.toViewer.mockClear();
    cameras.receive('waiting-64', '', { type: 'camera-state', shared: true });
    expect(host.toViewer).not.toHaveBeenCalled();
});
