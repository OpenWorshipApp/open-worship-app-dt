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
//
// And it follows the camera, not the tab: a screen page watching a camera
// that is not shared names the camera as the screen does, and a camera
// shared under exactly that name feeds it instead, its frames tagged with the
// id the page asked for. A new tab, or a tab Safari threw away, is a new
// viewer id; the presenter already found the camera again by its name
// (`resolveCameraDeviceId`) while every browser drawing the display showed an
// empty box for it (2026-10-09). The name starts with the browser's address,
// which this computer writes, so no other device can take a camera over.

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
    // The name a screen gives a watched camera, for finding it again.
    private expectedLabels = new Map<string, string>();
    // Which shared camera feeds each watched one now (itself, one shared
    // under its name, or none), worked out again on every change.
    private routes = new Map<string, string | null>();

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
        const { data, key, timestamp } = packet;
        if (
            camera === undefined ||
            typeof data !== 'string' ||
            data.length === 0 ||
            data.length > MAX_VIEWER_FRAME_TEXT ||
            typeof timestamp !== 'number' ||
            !Number.isFinite(timestamp)
        ) {
            return;
        }
        // Every camera this one feeds: itself, and any shown under its name.
        const fed = [...this.routes].filter(([, source]) => {
            return source === viewerId;
        });
        if (fed.length === 0 || !this.countFrame(camera)) {
            return;
        }
        const bytes = new Uint8Array(Buffer.from(data, 'base64'));
        for (const [requested] of fed) {
            const frame = {
                cameraId: toViewerCameraId(requested),
                type: key === true ? 'key' : 'delta',
                timestamp: Math.max(0, Math.round(timestamp)),
                data: bytes,
                text: data,
            };
            for (const watcher of this.watchers.get(requested) ?? []) {
                this.host.toWatcher(watcher, 'vd:camera-frame', frame);
            }
        }
    }

    private share(viewerId: string, address: string, label: unknown) {
        const name =
            typeof label === 'string' && label.trim()
                ? label.trim().slice(0, MAX_LABEL_LENGTH)
                : 'Camera';
        const full = `Browser ${address}: ${name}`;
        const before = this.snapshot();
        const camera = this.cameras.get(viewerId);
        if (camera !== undefined) {
            camera.label = full;
        } else {
            this.cameras.set(viewerId, {
                label: full,
                windowStart: 0,
                count: 0,
            });
        }
        // Shown somewhere while it was not shared: back on.
        this.reconcile(before);
        this.host.onListChanged();
    }

    // Not shared any more, or the viewer gone: what shows it is told, and
    // keeps watching for it to come back.
    drop(viewerId: string) {
        if (!this.cameras.has(viewerId)) {
            return;
        }
        const before = this.snapshot();
        this.cameras.delete(viewerId);
        this.reconcile(before);
        this.host.onListChanged();
    }

    // A watcher starts or stops showing a viewer's camera. The first one
    // starts the browser's encoder, each new one asks for a key frame, the
    // last one stops it. One with nothing feeding it pauses at once. A
    // screen page gives the camera's name (`label`): with it, a camera
    // shared under that name feeds the watcher while its own is not shared.
    watch(
        watcher: string,
        cameraId: string,
        isWatching: boolean,
        label?: string,
    ) {
        if (!cameraId.startsWith(VIEWER_CAMERA_PREFIX)) {
            return false;
        }
        const viewerId = cameraId.slice(VIEWER_CAMERA_PREFIX.length);
        const before = this.snapshot();
        if (!isWatching) {
            this.unwatch(watcher, viewerId, before);
            return this.routes.get(viewerId) != null;
        }
        let watchers = this.watchers.get(viewerId);
        if (watchers === undefined) {
            if (
                this.sourceOf(viewerId, label) === null &&
                this.countUnshared() >= MAX_WATCHED_UNSHARED
            ) {
                this.host.toWatcher(watcher, 'vd:camera-end', { cameraId });
                return false;
            }
            watchers = new Set();
            this.watchers.set(viewerId, watchers);
        }
        if (label) {
            this.expectedLabels.set(viewerId, label);
        }
        const isNew = !watchers.has(watcher);
        watchers.add(watcher);
        this.reconcile(before);
        const source = this.routes.get(viewerId) ?? null;
        if (source === null) {
            this.host.toWatcher(watcher, 'vd:camera-end', { cameraId });
            return false;
        }
        // Its encoder ran already for this camera: a key frame for the
        // newcomer (a new route got one above).
        if (
            isNew &&
            before.routes.get(viewerId) === source &&
            (before.counts.get(source) ?? 0) > 0
        ) {
            this.host.toViewer(source, { type: 'camera-keyframe' });
        }
        return true;
    }

    // A watcher gone (a window closed, a screen page left): it watches
    // nothing any more.
    forgetWatcher(watcher: string) {
        for (const viewerId of [...this.watchers.keys()]) {
            this.unwatch(watcher, viewerId, this.snapshot());
        }
    }

    private unwatch(
        watcher: string,
        viewerId: string,
        before: ReturnType<ViewerCameras['snapshot']>,
    ) {
        const watchers = this.watchers.get(viewerId);
        if (watchers === undefined || !watchers.delete(watcher)) {
            return;
        }
        if (watchers.size === 0) {
            this.watchers.delete(viewerId);
            this.expectedLabels.delete(viewerId);
        }
        this.reconcile(before);
    }

    // What feeds a watched camera: itself while shared, else a camera
    // shared under the name the screen gives it, else nothing.
    private sourceOf(viewerId: string, label?: string) {
        if (this.cameras.has(viewerId)) {
            return viewerId;
        }
        const expected = label || this.expectedLabels.get(viewerId);
        if (!expected) {
            return null;
        }
        for (const [sourceId, camera] of this.cameras) {
            if (camera.label === expected) {
                return sourceId;
            }
        }
        return null;
    }

    private snapshot() {
        const counts = new Map<string, number>();
        for (const [viewerId, source] of this.routes) {
            if (source !== null) {
                counts.set(
                    source,
                    (counts.get(source) ?? 0) +
                        (this.watchers.get(viewerId)?.size ?? 0),
                );
            }
        }
        return { routes: new Map(this.routes), counts };
    }

    // The routes worked out again, and what changed told: an encoder that
    // now has something to show starts (with a key frame), one with nothing
    // left stops, a watcher fed by a camera already running gets a key
    // frame, and one left with nothing pauses.
    private reconcile(before: ReturnType<ViewerCameras['snapshot']>) {
        this.routes = new Map(
            [...this.watchers.keys()].map((viewerId) => {
                return [viewerId, this.sourceOf(viewerId)];
            }),
        );
        const after = this.snapshot();
        const keyWanted = new Set<string>();
        for (const [viewerId, source] of this.routes) {
            const previous = before.routes.get(viewerId) ?? null;
            if (source === previous) {
                continue;
            }
            if (source === null) {
                for (const watcher of this.watchers.get(viewerId) ?? []) {
                    this.host.toWatcher(watcher, 'vd:camera-end', {
                        cameraId: toViewerCameraId(viewerId),
                    });
                }
            } else if ((before.counts.get(source) ?? 0) > 0) {
                keyWanted.add(source);
            }
        }
        const sources = new Set([
            ...before.counts.keys(),
            ...after.counts.keys(),
        ]);
        for (const source of sources) {
            const was = before.counts.get(source) ?? 0;
            const now = after.counts.get(source) ?? 0;
            if (was === 0 && now > 0) {
                this.host.toViewer(source, { type: 'camera-start' });
                keyWanted.delete(source);
            } else if (was > 0 && now === 0 && this.cameras.has(source)) {
                this.host.toViewer(source, { type: 'camera-stop' });
            }
        }
        for (const source of keyWanted) {
            this.host.toViewer(source, { type: 'camera-keyframe' });
        }
    }

    private countUnshared() {
        let count = 0;
        for (const source of this.routes.values()) {
            if (source === null) {
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
