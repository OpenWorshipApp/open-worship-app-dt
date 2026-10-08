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
// Where a guest came from: this computer's own networks, or the internet.
export type MirrorNetwork = 'local' | 'internet';
export type MirrorGuest = {
    id: string;
    name: string;
    prefix: string;
    address: string;
    network: MirrorNetwork;
    displays: MirrorDisplay[];
    cameras: MirrorCamera[];
};
// One address a guest can type: on a network card of this computer (`lan`, or
// `internet` for a global IPv6 one), the router's public side once UPnP opened
// the port (`router`), or the public address the operator typed (`typed`).
export type MirrorAddressKind = 'lan' | 'internet' | 'router' | 'typed';
export type MirrorAddress = {
    host: string;
    port: number;
    kind: MirrorAddressKind;
};
// The router's answer to "open the port": `working` while asking,
// `unavailable` when no UPnP router answered, `refused` when one would not map
// it, `shared` when its own public side is a private address (carrier NAT) so
// the internet cannot reach it anyway.
export type MirrorRouterStatus =
    'off' | 'working' | 'open' | 'unavailable' | 'refused' | 'shared';
export type MirrorState = {
    id: string;
    port: number;
    // Whether this computer accepts guests; off until turned on in its panel.
    hostEnabled: boolean;
    // Whether guests outside this computer's own networks may connect; off
    // until turned on, and only in effect while hosting is.
    internetEnabled: boolean;
    // Counts this computer's monitor changes, so a page drawing them knows
    // when to read them again without asking on every render.
    displayRevision: number;
    addresses: MirrorAddress[];
    publicAddress: string;
    router: MirrorRouterStatus;
    error: string | null;
    approvalMode: 'approve' | 'code';
    hasCode: boolean;
    customPort: number | null;
    guests: MirrorGuest[];
    pending: {
        id: string;
        name: string;
        address: string;
        network: MirrorNetwork;
    }[];
    // This computer as a guest: one entry per host it is linked to.
    connections: MirrorConnection[];
};
export type MirrorConnectionStatus =
    'connecting' | 'pending' | 'connected' | 'reconnecting' | 'error';
export type MirrorConnection = {
    id: string;
    // The host's own id, so a scan can tell a host this computer is linked to.
    hostId: string;
    status: MirrorConnectionStatus;
    host: string;
    port: number;
    // The host's own name, read from it when connecting, so a guest page
    // opened (or reopened) on a live connection can still say who it is.
    name: string;
    prefix: string;
    error: string | null;
};
export type MirrorScreenContext = {
    screenId: number;
    stage: number;
    settings: Record<string, string>;
    resources: Record<string, string>;
    fontCss: string;
    isWindows: boolean;
    remote: boolean;
    // Shown on a virtual display: the screen page plays its own sound (it is
    // what the display streams), and the presenter's copy stays silent.
    isSoundOwner?: boolean;
    messages?: MirrorScreenMessage[];
};
// What the operating system's firewall does to other computers reaching this
// app: `blocked` (a rule refuses it, or every incoming connection is refused),
// `blocked-public` (allowed only on private networks while this one is
// public), `not-allowed` (nothing allows it and the default refuses), `ok`, or
// `unknown` (this system cannot be asked).
export type MirrorFirewallVerdict =
    'ok' | 'blocked' | 'blocked-public' | 'not-allowed' | 'unknown';
export type MirrorFirewallStatus = {
    verdict: MirrorFirewallVerdict;
    platform: 'win32' | 'darwin' | 'linux' | 'other';
    // The firewall's own names for this app's rules, to find in its list.
    ruleNames: string[];
    appName: string;
    port: number;
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

function readIpv4(address: string) {
    const parts = address.split('.');
    if (parts.length !== 4) return null;
    const octets = parts.map((part) => {
        return /^\d{1,3}$/.test(part) ? Number(part) : NaN;
    });
    return octets.every((octet) => octet <= 255) ? octets : null;
}
// Eight hextets, or null. Takes brackets, a zone (`%12`) and an IPv4 tail.
export function readMirrorIpv6(address: string) {
    let text = address
        .replace(/^\[|\]$/g, '')
        .replace(/%.*$/, '')
        .toLowerCase();
    if (!text.includes(':')) return null;
    const tail: number[] = [];
    const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
    if (v4) {
        const octets = readIpv4(v4[1]);
        if (!octets) return null;
        tail.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
        text = text.slice(0, -v4[1].length);
        if (text.endsWith(':') && !text.endsWith('::'))
            text = text.slice(0, -1);
    }
    const halves = text.split('::');
    if (halves.length > 2) return null;
    const toHextets = (part: string) => {
        return part === ''
            ? []
            : part.split(':').map((hextet) => {
                  return /^[\da-f]{1,4}$/.test(hextet)
                      ? parseInt(hextet, 16)
                      : NaN;
              });
    };
    const left = toHextets(halves[0]);
    const right = halves.length === 2 ? toHextets(halves[1]) : [];
    const missing = 8 - left.length - right.length - tail.length;
    if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
    const hextets = [
        ...left,
        ...new Array<number>(halves.length === 2 ? missing : 0).fill(0),
        ...right,
        ...tail,
    ];
    return hextets.every(Number.isInteger) ? hextets : null;
}
// An IPv4 address, written plainly or mapped into IPv6 (`::ffff:1.2.3.4`, how
// a dual-stack server reports an IPv4 guest), as four octets.
export function readMirrorIpv4(address: string) {
    const octets = readIpv4(address);
    if (octets) return octets;
    const hextets = readMirrorIpv6(address);
    if (
        hextets &&
        hextets.slice(0, 5).every((hextet) => hextet === 0) &&
        hextets[5] === 0xffff
    ) {
        return [
            hextets[6] >> 8,
            hextets[6] & 255,
            hextets[7] >> 8,
            hextets[7] & 255,
        ];
    }
    return null;
}
// The address as a person reads it: an IPv4 guest without the `::ffff:`.
export function toMirrorPlainAddress(address: string) {
    return readMirrorIpv4(address)?.join('.') ?? address;
}
// Addresses no internet sender has: loopback, the private ranges, link-local,
// carrier NAT (100.64/10, where Tailscale also puts its VPN) and IPv6 unique
// local. A guest from anywhere else came from the internet.
export function isMirrorLanAddress(address: string) {
    const v4 = readMirrorIpv4(address);
    if (v4) {
        const [a, b] = v4;
        return (
            a === 127 ||
            a === 10 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 169 && b === 254) ||
            (a === 100 && b >= 64 && b <= 127)
        );
    }
    const v6 = readMirrorIpv6(address);
    if (!v6) return false;
    return (
        (v6.slice(0, 7).every((hextet) => hextet === 0) && v6[7] === 1) ||
        (v6[0] & 0xfe00) === 0xfc00 ||
        (v6[0] & 0xffc0) === 0xfe80
    );
}
// A global unicast IPv6 address (2000::/3): reachable from the internet when
// the router lets it through.
export function isMirrorGlobalIpv6(address: string) {
    const v6 = readMirrorIpv6(address);
    return !!v6 && !readMirrorIpv4(address) && (v6[0] & 0xe000) === 0x2000;
}
// Who a wrong code is counted against: one IPv4 address, or one IPv6 /64 --
// the block a single home or phone is handed, so a sender cannot dodge the
// count by stepping to the next address.
export function toMirrorSenderKey(address: string) {
    const v4 = readMirrorIpv4(address);
    if (v4) return v4.join('.');
    const v6 = readMirrorIpv6(address);
    if (!v6) return address;
    return `${v6
        .slice(0, 4)
        .map((hextet) => hextet.toString(16))
        .join(':')}::/64`;
}
// `host:port`, an IPv6 host in brackets -- what the panel shows, copies and
// puts in a QR code, and what the guest's address box reads back.
export function toMirrorHostPort(host: string, port: number) {
    const bare = host.replace(/^\[|\]$/g, '');
    return `${bare.includes(':') ? `[${bare}]` : bare}:${port}`;
}
// What a person types or pastes as an address: a host, `host:port`,
// `[IPv6]:port`, a bare IPv6 address, or a whole `http://` link. The port is
// null when the text has none.
export function readMirrorAddressText(
    text: string,
): { host: string; port: number | null } | null {
    const value = text.trim();
    if (!value || value.length > 300 || /\s/.test(value)) return null;
    // A bare IPv6 address is all colons, so it cannot also carry a port.
    if (!value.startsWith('[') && readMirrorIpv6(value)) {
        return { host: value, port: null };
    }
    let url: URL;
    try {
        url = new URL(
            /^[a-z][\da-z+.-]*:\/\//i.test(value) ? value : `http://${value}`,
        );
    } catch {
        return null;
    }
    if (
        !['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        !url.hostname
    ) {
        return null;
    }
    return {
        host: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port ? Number(url.port) : null,
    };
}
// The origin a guest reached this host on, from its own `Host` header: on the
// internet that is the router's public address and port, not the network card
// the connection arrived on, so it is the one base its files can load from.
export function readMirrorOrigin(host: unknown) {
    if (
        typeof host !== 'string' ||
        host.length > 300 ||
        !/^(?:\[[\da-f:.]+\]|[\da-z.-]+)(?::\d{1,5})?$/i.test(host)
    ) {
        return null;
    }
    try {
        return new URL(`http://${host}`).origin;
    } catch {
        return null;
    }
}
