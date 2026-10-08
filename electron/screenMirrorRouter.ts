import http from 'node:http';
import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';

import { isMirrorLanAddress } from './screenMirrorProtocol';

// UPnP IGD: ask the router -- the Internet Gateway Device -- to forward the
// Screen Mirror port to this computer, and which public address it has. Used
// only while "Open to the internet" is on. Every address the router hands back
// must be the router itself, so a device on the network that answers the
// search cannot send this computer's requests anywhere else.

const SSDP_ADDRESS = '239.255.255.250';
const SSDP_PORT = 1900;
const SEARCH_TARGETS = [
    'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
    'urn:schemas-upnp-org:device:InternetGatewayDevice:2',
    'urn:schemas-upnp-org:service:WANIPConnection:1',
    'urn:schemas-upnp-org:service:WANIPConnection:2',
    'urn:schemas-upnp-org:service:WANPPPConnection:1',
];
const SERVICE_PATTERN =
    /^urn:schemas-upnp-org:service:WAN(?:IP|PPP)Connection:\d$/;
const MAX_BODY = 256 * 1024;
const DESCRIPTION = 'Open Worship Screen Mirror';
// Renewed at half time while the option is on. A crash leaves the mapping to
// lapse on its own, and the next launch removes it (see `readRouterMapping`).
export const ROUTER_LEASE_SECONDS = 3600;

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
export class RouterError extends Error {
    constructor(
        message: string,
        readonly code = 0,
    ) {
        super(message);
    }
}

function checkIsRouterUrl(url: string, host?: string) {
    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === 'http:' &&
            !parsed.username &&
            !parsed.password &&
            net.isIPv4(parsed.hostname) &&
            (host === undefined || parsed.hostname === host)
        );
    } catch {
        return false;
    }
}
function request(
    url: string,
    options: {
        method?: string;
        headers?: Record<string, string | number>;
        body?: string;
    } = {},
) {
    return new Promise<{ status: number; body: string; localAddress: string }>(
        (resolve, reject) => {
            const req = http.request(
                url,
                {
                    method: options.method ?? 'GET',
                    headers: options.headers,
                    timeout: 3000,
                    agent: false,
                },
                (res) => {
                    const localAddress = (
                        res.socket?.localAddress ?? ''
                    ).replace(/^::ffff:/, '');
                    let body = '';
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        body += chunk;
                        if (body.length > MAX_BODY)
                            req.destroy(new RouterError('Answer too large'));
                    });
                    res.on('error', reject);
                    res.on('end', () => {
                        resolve({
                            status: res.statusCode ?? 0,
                            body,
                            localAddress,
                        });
                    });
                },
            );
            req.on('timeout', () => {
                req.destroy(new RouterError('Router did not answer'));
            });
            req.on('error', reject);
            req.end(options.body);
        },
    );
}
function readTag(xml: string, tag: string) {
    const match = new RegExp(
        `<(?:\\w+:)?${tag}>\\s*([^<]*?)\\s*</(?:\\w+:)?${tag}>`,
        'i',
    ).exec(xml);
    return (match?.[1] ?? '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}
function escapeXml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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
    const body =
        '<?xml version="1.0"?>\r\n' +
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
        's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
        `<s:Body><u:${action} xmlns:u="${gateway.serviceType}">` +
        args
            .map(([name, value]) => {
                return `<${name}>${escapeXml(String(value))}</${name}>`;
            })
            .join('') +
        `</u:${action}></s:Body></s:Envelope>`;
    const response = await request(gateway.controlUrl, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'Content-Length': Buffer.byteLength(body),
            SOAPAction: `"${gateway.serviceType}#${action}"`,
        },
    });
    if (response.status === 200) return response.body;
    throw new RouterError(
        readTag(response.body, 'errorDescription') || `${action} refused`,
        Number(readTag(response.body, 'errorCode')) || 0,
    );
}

export async function getRouterExternalAddress(gateway: RouterGateway) {
    const address = readTag(
        await soap(gateway, 'GetExternalIPAddress', []),
        'NewExternalIPAddress',
    );
    return net.isIPv4(address) && address !== '0.0.0.0' ? address : '';
}

function localIpv4s() {
    return Object.values(os.networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((nic) => !nic.internal && nic.family === 'IPv4')
        .map((nic) => nic.address);
}
function sendSearch(socket: dgram.Socket, address?: string) {
    return Promise.all(
        SEARCH_TARGETS.map((target) => {
            return new Promise<void>((resolve) => {
                try {
                    if (address) socket.setMulticastInterface(address);
                    socket.send(
                        'M-SEARCH * HTTP/1.1\r\n' +
                            `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
                            'MAN: "ssdp:discover"\r\n' +
                            'MX: 2\r\n' +
                            `ST: ${target}\r\n\r\n`,
                        SSDP_PORT,
                        SSDP_ADDRESS,
                        () => resolve(),
                    );
                } catch {
                    resolve();
                }
            });
        }),
    );
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
            const addresses = localIpv4s();
            for (const address of addresses.length ? addresses : [undefined]) {
                if (!searching) return;
                await sendSearch(socket, address);
            }
        });
    });
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

// Forwards `externalPort` (the same port as this computer's, unless another
// computer already holds that one) to this computer. Re-adding a mapping this
// computer already holds renews it.
export async function openRouterPort(
    gateway: RouterGateway,
    internalPort: number,
    externalAddress: string,
    preferredPort = internalPort,
): Promise<RouterMapping> {
    const ports = [
        ...new Set([
            preferredPort,
            internalPort,
            ...Array.from({ length: 4 }, () => {
                return 40000 + Math.floor(Math.random() * 20000);
            }),
        ]),
    ];
    let leaseSeconds = ROUTER_LEASE_SECONDS;
    for (const externalPort of ports) {
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
            return {
                ...gateway,
                externalAddress,
                externalPort,
                internalPort,
                leaseSeconds,
            };
        } catch (error) {
            // ConflictInMappingEntry: another computer holds that port.
            if (!(error instanceof RouterError) || error.code !== 718)
                throw error;
        }
    }
    throw new RouterError('Router port is taken', 718);
}

export async function renewRouterPort(mapping: RouterMapping) {
    await addMapping(
        mapping,
        mapping.externalPort,
        mapping.internalPort,
        mapping.leaseSeconds,
    );
}

export async function closeRouterPort(
    mapping: Pick<RouterMapping, 'controlUrl' | 'serviceType' | 'externalPort'>,
) {
    await soap({ ...mapping, localAddress: '' }, 'DeletePortMapping', [
        ['NewRemoteHost', ''],
        ['NewExternalPort', mapping.externalPort],
        ['NewProtocol', 'TCP'],
    ]);
}

// A mapping remembered from an earlier run, so the next launch can remove it
// when the app did not get to: it holds only where to ask and which port.
export function readRouterMapping(text: string | null | undefined) {
    try {
        const value = JSON.parse(text ?? '');
        if (
            typeof value?.controlUrl === 'string' &&
            checkIsRouterUrl(value.controlUrl) &&
            isMirrorLanAddress(new URL(value.controlUrl).hostname) &&
            typeof value.serviceType === 'string' &&
            SERVICE_PATTERN.test(value.serviceType) &&
            Number.isInteger(value.externalPort) &&
            value.externalPort > 0 &&
            value.externalPort <= 65535
        ) {
            return {
                controlUrl: value.controlUrl as string,
                serviceType: value.serviceType as string,
                externalPort: value.externalPort as number,
            };
        }
    } catch {}
    return null;
}
