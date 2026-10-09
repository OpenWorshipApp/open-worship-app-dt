import dgram from 'node:dgram';
import net from 'node:net';

import { isMirrorLanAddress } from './screenMirrorProtocol';
import {
    UpnpSoapError,
    checkIsDeviceUrl,
    listLocalIpv4s,
    readXmlTag,
    sendSsdpSearch,
    upnpRequest,
    upnpSoap,
    type UpnpFailureType,
} from './upnpHelpers';

// UPnP IGD: ask the router -- the Internet Gateway Device -- to forward the
// Screen Mirror port to this computer, and which public address it has. Used
// only while "Open to the internet" is on. Every address the router hands back
// must be the router itself, so a device on the network that answers the
// search cannot send this computer's requests anywhere else.

const SEARCH_TARGETS = [
    'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
    'urn:schemas-upnp-org:device:InternetGatewayDevice:2',
    'urn:schemas-upnp-org:service:WANIPConnection:1',
    'urn:schemas-upnp-org:service:WANIPConnection:2',
    'urn:schemas-upnp-org:service:WANPPPConnection:1',
];
const SERVICE_PATTERN =
    /^urn:schemas-upnp-org:service:WAN(?:IP|PPP)Connection:\d$/;
const DESCRIPTION = 'Open Worship Screen Mirror';
// Renewed at half time while the option is on. A crash leaves the mapping to
// lapse on its own, and the next launch removes it (see `readRouterMapping`).
export const ROUTER_LEASE_SECONDS = 3600;
// Where the probe through the router's public side asks this computer's own
// server for the one-time token it was given (`probeRouterPort`).
export const ROUTER_PROBE_PATH = '/router-probe/';
// Asked for this network's public address only when no router tells it, and
// only while "Open to the internet" is on. It answers the bare IPv4 text.
export const PUBLIC_ADDRESS_LOOKUP_URL = 'https://api.ipify.org';
// The code of a RouterError for a router that did not answer at all, as
// opposed to one that answered no.
const NO_ANSWER = -1;
// Ports asked for at most: the one remembered, this computer's own, and
// random ones -- a router can say no to a port for many reasons.
const MAX_PORT_TRIES = 8;

export type RouterGateway = {
    controlUrl: string;
    serviceType: string;
    // This computer's address on the router's network: where it forwards to.
    localAddress: string;
};
export type RouterMapping = RouterGateway & {
    externalAddress: string;
    externalPort: number;
    internalPort: number;
    leaseSeconds: number;
};
// Who a router forwards an external port to: this computer (`ours`), nobody
// (`free`), another computer -- or another app on this one -- (`taken`), or
// `unknown` when the router will not say.
export type RouterPortOwner = 'ours' | 'free' | 'taken' | 'unknown';
// What answered on the router's public side: this computer's server
// (`this`), something else (`other`), or nothing (`unknown`).
export type RouterReach = 'this' | 'other' | 'unknown';
export class RouterError extends Error {
    constructor(
        message: string,
        readonly code = 0,
    ) {
        super(message);
    }
}

const checkIsRouterUrl = checkIsDeviceUrl;
const readTag = readXmlTag;
function toRouterError(failure: UpnpFailureType) {
    return new RouterError(
        failure === 'timeout' ? 'Router did not answer' : 'Answer too large',
        NO_ANSWER,
    );
}
function request(url: string, options: Parameters<typeof upnpRequest>[1] = {}) {
    return upnpRequest(url, options, toRouterError);
}

// The WAN connection services a router's description offers, IP before PPP:
// a router that lists both usually leaves PPP idle.
export function readRouterServices(
    xml: string,
    location: string,
    localAddress: string,
): RouterGateway[] {
    const host = new URL(location).hostname;
    const base = readTag(xml, 'URLBase') || location;
    const gateways: RouterGateway[] = [];
    for (const [, block] of xml.matchAll(/<service>([\s\S]*?)<\/service>/gi)) {
        const serviceType = readTag(block, 'serviceType');
        const control = readTag(block, 'controlURL');
        if (!SERVICE_PATTERN.test(serviceType) || !control) continue;
        let controlUrl: string;
        try {
            controlUrl = new URL(control, base).href;
        } catch {
            continue;
        }
        if (!checkIsRouterUrl(controlUrl, host)) continue;
        gateways.push({ controlUrl, serviceType, localAddress });
    }
    return gateways.sort((a, b) => {
        return (
            Number(a.serviceType.includes('PPP')) -
            Number(b.serviceType.includes('PPP'))
        );
    });
}

async function soap(
    gateway: RouterGateway,
    action: string,
    args: [string, string | number][],
) {
    try {
        return await upnpSoap(
            gateway.controlUrl,
            gateway.serviceType,
            action,
            args,
            toRouterError,
        );
    } catch (error) {
        if (error instanceof UpnpSoapError) {
            throw new RouterError(error.message, error.code);
        }
        throw error;
    }
}

export async function getRouterExternalAddress(gateway: RouterGateway) {
    const address = readTag(
        await soap(gateway, 'GetExternalIPAddress', []),
        'NewExternalIPAddress',
    );
    return net.isIPv4(address) && address !== '0.0.0.0' ? address : '';
}

function sendSearch(socket: dgram.Socket, address?: string) {
    return sendSsdpSearch(socket, SEARCH_TARGETS, address);
}

// The first router on any of this computer's networks that answers the search
// AND tells its public address; null when none did within `timeout`.
export function findRouterGateway(timeout = 2500) {
    return new Promise<RouterGateway | null>((resolve) => {
        const socket = dgram.createSocket('udp4');
        const seen = new Set<string>();
        let open = 0;
        let searching = true;
        let done = false;
        const close = () => {
            searching = false;
            clearTimeout(timer);
            try {
                socket.close();
            } catch {}
        };
        const settle = (gateway: RouterGateway | null) => {
            if (done) return;
            if (gateway) {
                done = true;
                close();
                resolve(gateway);
            } else if (!searching && open === 0) {
                done = true;
                resolve(null);
            }
        };
        const timer = setTimeout(() => {
            close();
            settle(null);
        }, timeout);
        socket.on('error', () => {
            close();
            settle(null);
        });
        socket.on('message', (message, rinfo) => {
            if (message.length > 4096 || !searching) return;
            const location = /^location:\s*(\S+)/im.exec(message.toString());
            if (
                !location ||
                seen.has(location[1]) ||
                seen.size >= 16 ||
                !checkIsRouterUrl(location[1], rinfo.address)
            ) {
                return;
            }
            seen.add(location[1]);
            open++;
            void (async () => {
                const description = await request(location[1]);
                if (description.status !== 200) return null;
                for (const gateway of readRouterServices(
                    description.body,
                    location[1],
                    description.localAddress,
                )) {
                    if (!net.isIPv4(gateway.localAddress)) continue;
                    try {
                        if (await getRouterExternalAddress(gateway))
                            return gateway;
                    } catch {}
                }
                return null;
            })()
                .catch(() => null)
                .then((gateway) => {
                    open--;
                    settle(gateway);
                });
        });
        socket.bind(0, async () => {
            // One search out of every network card: Windows sends multicast
            // out of one card only unless told otherwise.
            const addresses = listLocalIpv4s();
            for (const address of addresses.length ? addresses : [undefined]) {
                if (!searching) return;
                await sendSearch(socket, address);
            }
        });
    });
}

// GetSpecificPortMappingEntry is optional on IGD:1 routers, so `unknown` is a
// real answer: the caller then goes on as it would without asking.
export async function readRouterPortOwner(
    gateway: Pick<RouterGateway, 'controlUrl' | 'serviceType'> & {
        localAddress?: string;
    },
    externalPort: number,
    internalPort?: number,
): Promise<RouterPortOwner> {
    let xml: string;
    try {
        xml = await soap(
            { localAddress: '', ...gateway },
            'GetSpecificPortMappingEntry',
            [
                ['NewRemoteHost', ''],
                ['NewExternalPort', externalPort],
                ['NewProtocol', 'TCP'],
            ],
        );
    } catch (error) {
        // NoSuchEntryInArray.
        return error instanceof RouterError && error.code === 714
            ? 'free'
            : 'unknown';
    }
    const client = readTag(xml, 'NewInternalClient');
    if (!net.isIPv4(client)) return 'unknown';
    const clients = new Set(listLocalIpv4s());
    if (gateway.localAddress) clients.add(gateway.localAddress);
    return clients.has(client) &&
        (internalPort === undefined ||
            Number(readTag(xml, 'NewInternalPort')) === internalPort)
        ? 'ours'
        : 'taken';
}

// Asks the router's public side for `token`, through the router itself (NAT
// loopback). Only this computer's server knows the token, so any other answer
// means the port leads elsewhere: a manual forwarding rule outranks UPnP on
// most routers, and some keep another computer's mapping while saying yes.
// No answer is `unknown` -- many routers do not loop back at all.
export async function probeRouterPort(
    externalAddress: string,
    externalPort: number,
    token: string,
): Promise<RouterReach> {
    try {
        const response = await request(
            `http://${externalAddress}:${externalPort}${ROUTER_PROBE_PATH}${token}`,
        );
        return response.status === 200 && response.body === token
            ? 'this'
            : 'other';
    } catch {
        return 'unknown';
    }
}

// This network's public IPv4 address as a lookup site sees it, '' when it
// does not say. Asked only when no router told it: behind a VPN it is the
// VPN's address, which reaches this computer only if the VPN forwards the port.
export async function lookUpPublicAddress(url = PUBLIC_ADDRESS_LOOKUP_URL) {
    try {
        const response = await request(url);
        const address = response.body.trim();
        return response.status === 200 &&
            net.isIPv4(address) &&
            !isMirrorLanAddress(address)
            ? address
            : '';
    } catch {
        return '';
    }
}

function addMapping(
    gateway: RouterGateway,
    externalPort: number,
    internalPort: number,
    leaseSeconds: number,
) {
    return soap(gateway, 'AddPortMapping', [
        ['NewRemoteHost', ''],
        ['NewExternalPort', externalPort],
        ['NewProtocol', 'TCP'],
        ['NewInternalPort', internalPort],
        ['NewInternalClient', gateway.localAddress],
        ['NewEnabled', 1],
        ['NewPortMappingDescription', DESCRIPTION],
        ['NewLeaseDuration', leaseSeconds],
    ]);
}

// Forwards an external port -- the one remembered, else the same port as this
// computer's -- to this computer, and moves on to another port whenever the
// router will not have that one: another computer holds it, it is kept for
// something else, it is outside what the router allows. Only a router that
// stops answering ends the search early. Re-adding a mapping this computer
// already holds renews it. The router's yes is not taken on its word: a port
// it says another computer holds is never asked for (some routers hand it
// over and cut that computer off, others say yes and keep it there), and
// `reach`, when given, checks that the public side lands on this computer.
export async function openRouterPort(
    gateway: RouterGateway,
    internalPort: number,
    externalAddress: string,
    {
        preferredPort = internalPort,
        reach,
    }: {
        preferredPort?: number;
        reach?: (externalPort: number) => Promise<RouterReach>;
    } = {},
): Promise<RouterMapping> {
    const ports = new Set([preferredPort, internalPort]);
    while (ports.size < MAX_PORT_TRIES) {
        ports.add(40000 + Math.floor(Math.random() * 20000));
    }
    let leaseSeconds = ROUTER_LEASE_SECONDS;
    let isSamePortRequired = false;
    let refusal = new RouterError('Router port is taken', 718);
    for (const externalPort of ports) {
        if (isSamePortRequired && externalPort !== internalPort) continue;
        let owner = await readRouterPortOwner(
            gateway,
            externalPort,
            internalPort,
        );
        if (owner === 'taken') continue;
        try {
            try {
                await addMapping(
                    gateway,
                    externalPort,
                    internalPort,
                    leaseSeconds,
                );
            } catch (error) {
                // OnlyPermanentLeasesSupported.
                if (!(error instanceof RouterError) || error.code !== 725)
                    throw error;
                leaseSeconds = 0;
                await addMapping(gateway, externalPort, internalPort, 0);
            }
        } catch (error) {
            if (!(error instanceof RouterError) || error.code === NO_ANSWER)
                throw error;
            // SamePortValuesRequired: only this computer's own port can work.
            if (error.code === 724) isSamePortRequired = true;
            refusal = error;
            continue;
        }
        if (owner === 'free') {
            owner = await readRouterPortOwner(
                gateway,
                externalPort,
                internalPort,
            );
            if (owner === 'taken') continue;
        }
        if (reach && (await reach(externalPort)) === 'other') {
            // Removed only when the router says it is this computer's: the
            // entry may be the very one that leads elsewhere.
            if (owner === 'ours') {
                await closeRouterPort({
                    ...gateway,
                    externalPort,
                    internalPort,
                }).catch(() => {});
            }
            continue;
        }
        return {
            ...gateway,
            externalAddress,
            externalPort,
            internalPort,
            leaseSeconds,
        };
    }
    throw refusal;
}

// Renews the lease, and fails with 718 once the port forwards elsewhere: a
// router can hand a lapsed or overwritten port to another computer, so this
// runs for a permanent lease too, which has nothing to renew.
export async function renewRouterPort(mapping: RouterMapping) {
    const owner = await readRouterPortOwner(
        mapping,
        mapping.externalPort,
        mapping.internalPort,
    );
    if (owner === 'taken') {
        throw new RouterError('Router port is taken', 718);
    }
    if (!mapping.leaseSeconds && owner !== 'free') return;
    await addMapping(
        mapping,
        mapping.externalPort,
        mapping.internalPort,
        mapping.leaseSeconds,
    );
}

// Removes the mapping only while it still forwards to this computer: a lapsed
// lease may since have gone to another one, and that mapping is not ours.
export async function closeRouterPort(
    mapping: Pick<
        RouterMapping,
        'controlUrl' | 'serviceType' | 'externalPort'
    > &
        Partial<Pick<RouterMapping, 'localAddress' | 'internalPort'>>,
) {
    const owner = await readRouterPortOwner(
        mapping,
        mapping.externalPort,
        mapping.internalPort,
    );
    if (owner === 'taken' || owner === 'free') return;
    await soap({ ...mapping, localAddress: '' }, 'DeletePortMapping', [
        ['NewRemoteHost', ''],
        ['NewExternalPort', mapping.externalPort],
        ['NewProtocol', 'TCP'],
    ]);
}

function checkIsPort(value: unknown): value is number {
    return (
        Number.isInteger(value) && Number(value) > 0 && Number(value) <= 65535
    );
}
// A mapping remembered from an earlier run, so the next launch can remove it
// when the app did not get to: it holds only where to ask, which port, and
// which port of this computer it led to (missing in a record from before).
export function readRouterMapping(text: string | null | undefined) {
    try {
        const value = JSON.parse(text ?? '');
        if (
            typeof value?.controlUrl === 'string' &&
            checkIsRouterUrl(value.controlUrl) &&
            isMirrorLanAddress(new URL(value.controlUrl).hostname) &&
            typeof value.serviceType === 'string' &&
            SERVICE_PATTERN.test(value.serviceType) &&
            checkIsPort(value.externalPort)
        ) {
            return {
                controlUrl: value.controlUrl as string,
                serviceType: value.serviceType as string,
                externalPort: value.externalPort,
                ...(checkIsPort(value.internalPort)
                    ? { internalPort: value.internalPort }
                    : {}),
            };
        }
    } catch {}
    return null;
}
