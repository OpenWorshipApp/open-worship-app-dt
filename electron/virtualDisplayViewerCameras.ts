// A browser watching a virtual display can share its camera with this
// computer, as in a video call: it shows up beside this computer's own
// cameras (`vd-camera:<viewer>`), to be put on a screen as a foreground or a
// background. The pictures travel inside the viewer page's own socket as VP8
// frames -- so a camera reaches this computer wherever the page does, the
// tunnel too -- and the browser encodes only while something shows it.
//
// What shows it is a watcher: a window here (`window:<webContents id>`), or a
// browser drawing a screen of a virtual display that has the camera on it
// (`screen:<viewer>:<screen>`) -- the same frames, passed on, never encoded
// again.
//
// A watch outlives the sharing: a browser that stops sharing, or reloads
// (its tab keeps its id), pauses every watcher (`vd:camera-end`), and sharing
// again starts its encoder for them at once -- the camera on the screens
// comes back on its own, like a call's video, with nothing re-added.

export const VIEWER_CAMERA_PREFIX = 'vd-camera:';
// One frame, base64 on the wire; a key frame of 640x360 is far under this.
export const MAX_VIEWER_FRAME_TEXT = 384 * 1024;
const MAX_FRAMES_PER_SECOND = 40;
const MAX_LABEL_LENGTH = 80;
// Cameras watched while not shared, at most: only what is on a screen.
const MAX_WATCHED_UNSHARED = 64;

export type ViewerCameraInfoType = {
    deviceId: string;
    groupId: string;
    label: string;
};

type CameraType = {
    label: string;
    windowStart: number;
    count: number;
};

export type ViewerCamerasHostType = {
    // A packet to the viewer's page (`camera-start`, `camera-stop`,
    // `camera-keyframe`).
    toViewer: (viewerId: string, packet: Record<string, unknown>) => void;
    // A frame (`vd:camera-frame`: its bytes as `data`, the same as base64
    // `text`) or a pause (`vd:camera-end`: not shared now) to a watcher.
    toWatcher: (
        watcher: string,
        channel: string,
        data: Record<string, unknown>,
    ) => void;
    // The list of cameras changed: windows here list them again.
    onListChanged: () => void;
};

export function toViewerCameraId(viewerId: string) {
    return `${VIEWER_CAMERA_PREFIX}${viewerId}`;
}

export class ViewerCameras {
    // Shared now, by viewer.
    private cameras = new Map<string, CameraType>();
    // What shows each viewer's camera, shared now or not.
    private watchers = new Map<string, Set<string>>();

    constructor(private readonly host: ViewerCamerasHostType) {}

    list(): ViewerCameraInfoType[] {
        return [...this.cameras.entries()].map(([viewerId, camera]) => ({
            deviceId: toViewerCameraId(viewerId),
            groupId: '',
            label: camera.label,
        }));
    }

    labelOf(viewerId: string) {
        return this.cameras.get(viewerId)?.label ?? null;
    }

    // From a viewer that was let in: its camera shared or not, and frames.
    receive(
        viewerId: string,
        address: string,
        packet: Record<string, unknown>,
    ) {
        if (packet.type === 'camera-state') {
            if (packet.shared === true) {
                this.share(viewerId, address, packet.label);
            } else {
                this.drop(viewerId);
            }
            return;
        }
        if (packet.type !== 'video') {
            return;
        }
        const camera = this.cameras.get(viewerId);
        const watchers = this.watchers.get(viewerId);
        const { data, key, timestamp } = packet;
        if (
            camera === undefined ||
            watchers === undefined ||
            typeof data !== 'string' ||
            data.length === 0 ||
            data.length > MAX_VIEWER_FRAME_TEXT ||
            typeof timestamp !== 'number' ||
            !Number.isFinite(timestamp) ||
            !this.countFrame(camera)
        ) {
            return;
        }
        const frame = {
            cameraId: toViewerCameraId(viewerId),
            type: key === true ? 'key' : 'delta',
            timestamp: Math.max(0, Math.round(timestamp)),
            data: new Uint8Array(Buffer.from(data, 'base64')),
            text: data,
        };
        for (const watcher of watchers) {
            this.host.toWatcher(watcher, 'vd:camera-frame', frame);
        }
    }

    private share(viewerId: string, address: string, label: unknown) {
        const name =
            typeof label === 'string' && label.trim()
                ? label.trim().slice(0, MAX_LABEL_LENGTH)
                : 'Camera';
        const full = `Browser ${address}: ${name}`;
        const camera = this.cameras.get(viewerId);
        if (camera !== undefined) {
            camera.label = full;
        } else {
            this.cameras.set(viewerId, {
                label: full,
                windowStart: 0,
                count: 0,
            });
            // Shown somewhere while it was not shared: back on.
            if (this.watchers.has(viewerId)) {
                this.host.toViewer(viewerId, { type: 'camera-start' });
            }
        }
        this.host.onListChanged();
    }

    // Not shared any more, or the viewer gone: what shows it is told, and
    // keeps watching for it to come back.
    drop(viewerId: string) {
        if (!this.cameras.delete(viewerId)) {
            return;
        }
        for (const watcher of this.watchers.get(viewerId) ?? []) {
            this.host.toWatcher(watcher, 'vd:camera-end', {
                cameraId: toViewerCameraId(viewerId),
            });
        }
        this.host.onListChanged();
    }

    // A watcher starts or stops showing a viewer's camera. The first one
    // starts the browser's encoder, each new one asks for a key frame, the
    // last one stops it. One not shared now pauses the watcher at once.
    watch(watcher: string, cameraId: string, isWatching: boolean) {
        if (!cameraId.startsWith(VIEWER_CAMERA_PREFIX)) {
            return false;
        }
        const viewerId = cameraId.slice(VIEWER_CAMERA_PREFIX.length);
        const isShared = this.cameras.has(viewerId);
        if (!isWatching) {
            this.unwatch(watcher, viewerId);
            return isShared;
        }
        let watchers = this.watchers.get(viewerId);
        if (watchers === undefined) {
            if (!isShared && this.countUnshared() >= MAX_WATCHED_UNSHARED) {
                this.host.toWatcher(watcher, 'vd:camera-end', { cameraId });
                return false;
            }
            watchers = new Set();
            this.watchers.set(viewerId, watchers);
        }
        const isFirst = watchers.size === 0;
        watchers.add(watcher);
        if (!isShared) {
            this.host.toWatcher(watcher, 'vd:camera-end', { cameraId });
            return false;
        }
        this.host.toViewer(viewerId, {
            type: isFirst ? 'camera-start' : 'camera-keyframe',
        });
        return true;
    }

    // A watcher gone (a window closed, a screen page left): it watches
    // nothing any more.
    forgetWatcher(watcher: string) {
        for (const viewerId of [...this.watchers.keys()]) {
            this.unwatch(watcher, viewerId);
        }
    }

    private unwatch(watcher: string, viewerId: string) {
        const watchers = this.watchers.get(viewerId);
        if (watchers === undefined || !watchers.delete(watcher)) {
            return;
        }
        if (watchers.size > 0) {
            return;
        }
        this.watchers.delete(viewerId);
        if (this.cameras.has(viewerId)) {
            this.host.toViewer(viewerId, { type: 'camera-stop' });
        }
    }

    private countUnshared() {
        let count = 0;
        for (const viewerId of this.watchers.keys()) {
            if (!this.cameras.has(viewerId)) {
                count++;
            }
        }
        return count;
    }

    private countFrame(camera: CameraType) {
        const now = Date.now();
        if (now - camera.windowStart >= 1000) {
            camera.windowStart = now;
            camera.count = 0;
        }
        return ++camera.count <= MAX_FRAMES_PER_SECOND;
    }
}
