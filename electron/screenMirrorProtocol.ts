// Shared wire types. No Electron, renderer, or filesystem dependencies.
export const MIRROR_PROTOCOL = 1;
export const MIRROR_PORT_FIRST = 39240;
export const MIRROR_PORT_LAST = 39259;
export const MIRROR_MAX_MESSAGE = 4 * 1024 * 1024;
export const MIRROR_REMOTE_DISPLAY_FIRST = -1000000;

export type MirrorCamera = { deviceId: string; label: string; groupId: string };
export type MirrorDisplay = {
    id: number;
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    scaleFactor: number;
    isPrimary: boolean;
    guestId?: string;
    localId?: number;
};
export type MirrorDiscovery = {
    service: 'owa-screen-mirror';
    protocol: number;
    id: string;
    name: string;
    version: string;
    port: number;
    host?: string;
};
export type MirrorGuest = {
    id: string;
    name: string;
    prefix: string;
    address: string;
    displays: MirrorDisplay[];
    cameras: MirrorCamera[];
};
export type MirrorState = {
    id: string;
    port: number;
    // Whether this computer accepts guests; off until turned on in its panel.
    hostEnabled: boolean;
    // Counts this computer's monitor changes, so a page drawing them knows
    // when to read them again without asking on every render.
    displayRevision: number;
    addresses: string[];
    error: string | null;
    approvalMode: 'approve' | 'code';
    hasCode: boolean;
    customPort: number | null;
    guests: MirrorGuest[];
    pending: { id: string; name: string; address: string }[];
    connection: {
        status:
            | 'disconnected'
            | 'connecting'
            | 'pending'
            | 'connected'
            | 'reconnecting'
            | 'error';
        host: string;
        port: number;
        // The host's own name, read from it when connecting, so a guest page
        // opened (or reopened) on a live connection can still say who it is.
        name: string;
        prefix: string;
        error: string | null;
    };
};
export type MirrorScreenContext = {
    screenId: number;
    stage: number;
    settings: Record<string, string>;
    resources: Record<string, string>;
    fontCss: string;
    isWindows: boolean;
    remote: boolean;
    messages?: MirrorScreenMessage[];
};
export type MirrorScreenMessage = {
    screenId: number;
    type: string;
    data: any;
    stage?: number;
};
export const MIRROR_SCREEN_TYPES = new Set([
    'init',
    'visible',
    'display-change',
    'background',
    'vary-app-document',
    'bible-screen-view',
    'foreground',
    'draw',
    'focus',
    'mask',
    'effect',
    'bible-screen-view-selected-index',
    'bible-screen-view-text-style',
    'background-video-time',
    'vary-app-document-video-time',
    'sync-scroll-percentage',
]);
export const MIRROR_FEEDBACK_TYPES = new Set([
    'init',
    'visible',
    'background-video-time',
    'vary-app-document-video-time',
    'sync-scroll-percentage',
    'bible-screen-view-selected-index',
]);

export function isMirrorScreenMessage(
    value: any,
): value is MirrorScreenMessage {
    return (
        value !== null &&
        typeof value === 'object' &&
        Number.isSafeInteger(value.screenId) &&
        value.screenId >= 0 &&
        typeof value.type === 'string' &&
        MIRROR_SCREEN_TYPES.has(value.type)
    );
}

export function readMirrorPacket(text: string): Record<string, any> | null {
    if (text.length > MIRROR_MAX_MESSAGE) return null;
    try {
        const packet = JSON.parse(text);
        return packet &&
            !Array.isArray(packet) &&
            typeof packet === 'object' &&
            packet.protocol === MIRROR_PROTOCOL &&
            typeof packet.type === 'string'
            ? packet
            : null;
    } catch {
        return null;
    }
}

export function readMirrorDisplays(value: unknown): MirrorDisplay[] {
    if (!Array.isArray(value) || value.length > 32) return [];
    const ids = new Set<number>();
    return value
        .filter((item) => {
            const valid =
                item &&
                Number.isSafeInteger(item.id) &&
                !ids.has(item.id) &&
                item.bounds &&
                ['x', 'y', 'width', 'height'].every((key) =>
                    Number.isFinite(item.bounds[key]),
                ) &&
                item.bounds.width > 0 &&
                item.bounds.height > 0 &&
                item.bounds.width <= 32768 &&
                item.bounds.height <= 32768 &&
                typeof item.label === 'string' &&
                item.label.length <= 256 &&
                Number.isFinite(item.scaleFactor) &&
                item.scaleFactor > 0 &&
                item.scaleFactor <= 8;
            if (valid) ids.add(item.id);
            return valid;
        })
        .map((item) => ({
            id: item.id,
            label: item.label,
            bounds: { ...item.bounds },
            scaleFactor: item.scaleFactor,
            isPrimary: item.isPrimary === true,
        }));
}

export function readMirrorCameras(value: unknown, limit = 32): MirrorCamera[] {
    if (!Array.isArray(value) || value.length > limit) return [];
    return value
        .filter(
            (item) =>
                item &&
                typeof item.deviceId === 'string' &&
                item.deviceId.length <= 512 &&
                typeof item.label === 'string' &&
                item.label.length <= 256,
        )
        .map((item) => ({
            deviceId: item.deviceId,
            label: item.label,
            groupId: '',
        }));
}

// A host answers the scan once per network the two computers share, and every
// answer is checked over HTTP, so each address it gives is one this computer
// reached. The one offered is the most useful of them: a real LAN before a
// virtual adapter (Hyper-V, WSL and Docker sit in 172.16/12), before
// link-local, and loopback only when it is all there is -- the host is this
// same computer. Lower is better.
export function rankMirrorAddress(address: string) {
    const [first, second] = address.split('.').map(Number);
    if (first === 192 && second === 168) return 0;
    if (first === 10) return 1;
    if (first === 172 && second >= 16 && second <= 31) return 2;
    if (first === 169 && second === 254) return 4;
    if (first === 127) return 5;
    return 3;
}

// The scan's answer, best first: by the address it will connect on, then by
// name so the list does not reshuffle between two scans.
export function sortMirrorHosts(hosts: MirrorDiscovery[]) {
    return [...hosts].sort((a, b) => {
        return (
            rankMirrorAddress(a.host ?? '') - rankMirrorAddress(b.host ?? '') ||
            a.name.localeCompare(b.name) ||
            a.port - b.port
        );
    });
}
