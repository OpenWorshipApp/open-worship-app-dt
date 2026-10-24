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

// A screen still shows the camera of a tab that is gone; the same device
// shares it again from a new tab (a new viewer id). The presenter found it by
// its name; a browser drawing the display showed an empty box (2026-10-09).
test('a screen page watching a camera no longer shared is fed the camera shared under its name', () => {
    const { cameras, host } = genCameras();
    const LABEL = 'Browser 192.168.1.5: Back Camera';
    // The old tab's camera, on the screen, watched by a browser's page.
    expect(cameras.watch('screen:p:0', 'vd-camera:old-tab', true, LABEL)).toBe(
        false,
    );
    expect(host.toWatcher).toHaveBeenLastCalledWith(
        'screen:p:0',
        'vd:camera-end',
        { cameraId: 'vd-camera:old-tab' },
    );
    // Another device under another name feeds nothing.
    cameras.receive('other', '192.168.1.6', {
        type: 'camera-state',
        shared: true,
        label: 'Back Camera',
    });
    expect(host.toViewer).not.toHaveBeenCalled();
    // The same device, from a new tab: its encoder starts for the page...
    cameras.receive('new-tab', '192.168.1.5', {
        type: 'camera-state',
        shared: true,
        label: 'Back Camera',
    });
    expect(host.toViewer).toHaveBeenCalledWith('new-tab', {
        type: 'camera-start',
    });
    // ...and its frames reach the page as the camera the page asked for.
    host.toWatcher.mockClear();
    cameras.receive('new-tab', '', {
        type: 'video',
        data: 'AQID',
        key: true,
        timestamp: 10,
    });
    expect(host.toWatcher).toHaveBeenCalledTimes(1);
    expect(host.toWatcher).toHaveBeenCalledWith(
        'screen:p:0',
        'vd:camera-frame',
        expect.objectContaining({ cameraId: 'vd-camera:old-tab', type: 'key' }),
    );
    // A window watching the new tab directly shares the running encoder.
    cameras.watch('window:7', 'vd-camera:new-tab', true);
    expect(host.toViewer).toHaveBeenLastCalledWith('new-tab', {
        type: 'camera-keyframe',
    });
    host.toWatcher.mockClear();
    cameras.receive('new-tab', '', {
        type: 'video',
        data: 'AQID',
        timestamp: 20,
    });
    expect(
        host.toWatcher.mock.calls.map((call) => [call[0], call[2].cameraId]),
    ).toEqual([
        ['screen:p:0', 'vd-camera:old-tab'],
        ['window:7', 'vd-camera:new-tab'],
    ]);

    // The new tab stops sharing: both pause; nothing tells it to stop.
    host.toWatcher.mockClear();
    host.toViewer.mockClear();
    cameras.receive('new-tab', '', { type: 'camera-state', shared: false });
    expect(host.toWatcher.mock.calls.map((call) => [call[0], call[1]])).toEqual(
        [
            ['screen:p:0', 'vd:camera-end'],
            ['window:7', 'vd:camera-end'],
        ],
    );
    expect(host.toViewer).not.toHaveBeenCalled();
});

test('the old tab coming back feeds its own camera again; renamed, the follower pauses', () => {
    const { cameras, host } = genCameras();
    const LABEL = 'Browser 192.168.1.5: Back Camera';
    cameras.watch('screen:p:0', 'vd-camera:old-tab', true, LABEL);
    cameras.receive('new-tab', '192.168.1.5', {
        type: 'camera-state',
        shared: true,
        label: 'Back Camera',
    });
    // The old tab shares again: it feeds its own watcher, and the new tab,
    // with nothing left to show, stops.
    host.toViewer.mockClear();
    cameras.receive('old-tab', '192.168.1.5', {
        type: 'camera-state',
        shared: true,
        label: 'Back Camera',
    });
    expect(host.toViewer).toHaveBeenCalledTimes(2);
    expect(host.toViewer).toHaveBeenCalledWith('old-tab', {
        type: 'camera-start',
    });
    expect(host.toViewer).toHaveBeenCalledWith('new-tab', {
        type: 'camera-stop',
    });
    // The old tab gone again: the new tab, still shared under the name the
    // screen gives it, feeds it at once -- never a paused box between...
    host.toViewer.mockClear();
    host.toWatcher.mockClear();
    cameras.receive('old-tab', '', { type: 'camera-state', shared: false });
    expect(host.toViewer.mock.calls).toEqual([
        ['new-tab', { type: 'camera-start' }],
    ]);
    expect(host.toWatcher).not.toHaveBeenCalled();
    // ...until it switches to another camera: another name, so the follower
    // pauses and the new tab, shown nowhere now, stops.
    cameras.receive('new-tab', '192.168.1.5', {
        type: 'camera-state',
        shared: true,
        label: 'Front Camera',
    });
    expect(host.toWatcher).toHaveBeenLastCalledWith(
        'screen:p:0',
        'vd:camera-end',
        { cameraId: 'vd-camera:old-tab' },
    );
    expect(host.toViewer).toHaveBeenLastCalledWith('new-tab', {
        type: 'camera-stop',
    });
    // The page leaves: nothing is watched, nothing more is said.
    host.toViewer.mockClear();
    cameras.forgetWatcher('screen:p:0');
    cameras.receive('new-tab', '192.168.1.5', {
        type: 'camera-state',
        shared: true,
        label: 'Back Camera',
    });
    expect(host.toViewer).not.toHaveBeenCalled();
});

test('a window gives no name: it follows only the id it asked for', () => {
    const { cameras, host } = genCameras();
    cameras.watch('window:7', 'vd-camera:old-tab', true);
    cameras.receive('new-tab', '192.168.1.5', {
        type: 'camera-state',
        shared: true,
        label: 'Back Camera',
    });
    expect(host.toViewer).not.toHaveBeenCalled();
});
