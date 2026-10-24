import { rankMirrorAddress } from '../../electron/screenMirrorProtocol';
import type { VirtualDisplayAddress } from '../../electron/virtualDisplayProtocol';

// "Where to watch" listed every network card the same way: on a laptop with a
// VPN, WSL and Hyper-V that was five "This network" addresses (each twice,
// browser and MP4), and nothing said which one a TV in the room can reach.
// The first ones are what to give someone: the best of this computer's
// networks -- a home or church router's 192.168 before a VPN's 10.x before a
// virtual adapter's 172.16/12 -- and every internet address the operator
// opened on purpose. With sharing off, this computer's own. The rest fold.
export function splitVirtualDisplayAddresses(
    addresses: VirtualDisplayAddress[],
) {
    const lanAddresses = addresses
        .filter((address) => address.kind === 'lan')
        .sort((a, b) => rankMirrorAddress(a.host) - rankMirrorAddress(b.host));
    const internetAddresses = addresses.filter((address) => {
        return address.kind !== 'lan' && address.kind !== 'this-computer';
    });
    const recommended = [...lanAddresses.slice(0, 1), ...internetAddresses];
    const main =
        recommended.length > 0
            ? recommended
            : addresses.filter((address) => {
                  return address.kind === 'this-computer';
              });
    const others = addresses.filter((address) => !main.includes(address));
    return { main, others };
}

// First match wins, so the more particular comes first: a TV's agent also
// says Linux, Edge's also says Chrome, Chrome's also says Safari.
const VIEWER_SYSTEMS: [RegExp, string][] = [
    [/CrKey/, 'Chromecast'],
    [/\bAFT[A-Z]/, 'Fire TV'],
    [
        /SMART-TV|SmartTV|Tizen|Web0S|webOS|BRAVIA|HbbTV|NetCast|GoogleTV|Android TV/i,
        'TV',
    ],
    [/iPad/, 'iPad'],
    [/iPhone|iPod/, 'iPhone'],
    [/Android/, 'Android'],
    [/Windows/, 'Windows'],
    [/Mac OS X|Macintosh/, 'Mac'],
    [/CrOS/, 'Chromebook'],
    [/Linux/, 'Linux'],
];
const VIEWER_BROWSERS: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/SamsungBrowser/, 'Samsung Internet'],
    [/Firefox\/|FxiOS/, 'Firefox'],
    [/Chrome\/|CriOS/, 'Chrome'],
    [/Safari\//, 'Safari'],
];

function findViewerName(agent: string, names: [RegExp, string][]) {
    return names.find(([pattern]) => pattern.test(agent))?.[1] ?? '';
}

// What kind of device a viewer is, read off its user agent, for "Watching
// now": two TVs behind one router share an address, so the address alone did
// not tell them apart. Product names, never translated; empty when unknown.
export function toViewerDeviceLabel(userAgent: string | undefined) {
    const agent = userAgent ?? '';
    if (!agent) {
        return '';
    }
    const player = /\b(VLC|OBS|Lavf|mpv|Kodi|GStreamer)\b/i.exec(agent);
    if (player !== null) {
        return player[1] === 'Lavf' ? 'FFmpeg' : player[1];
    }
    return [
        findViewerName(agent, VIEWER_BROWSERS),
        findViewerName(agent, VIEWER_SYSTEMS),
    ]
        .filter(Boolean)
        .join(' · ');
}
