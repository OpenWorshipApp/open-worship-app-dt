import http from 'node:http';
import https from 'node:https';
import type dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';

// The small HTTP, XML and SSDP pieces for talking to devices on this network
// over UPnP: the router (`screenMirrorRouter.ts`) and TVs (`castTargets.ts`).

export const SSDP_ADDRESS = '239.255.255.250';
export const SSDP_PORT = 1900;
const MAX_BODY = 256 * 1024;

export type UpnpResponse = {
    status: number;
    body: string;
    // This computer's address on the connection: the network card facing the
    // device.
    localAddress: string;
};
export type UpnpFailureType = 'timeout' | 'too-large';

// Plain http to an IPv4 address with no credentials -- and, given `host`, to
// that address only: whatever answered a search cannot point this computer's
// requests anywhere else.
export function checkIsDeviceUrl(url: string, host?: string) {
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

export function upnpRequest(
    url: string,
    options: {
        method?: string;
        headers?: Record<string, string | number>;
        body?: string;
        timeout?: number;
    } = {},
    toError: (failure: UpnpFailureType) => Error = (failure) => {
        return new Error(
            failure === 'timeout' ? 'Did not answer' : 'Answer too large',
        );
    },
) {
    return new Promise<UpnpResponse>((resolve, reject) => {
        const transport = url.startsWith('https:') ? https : http;
        const req = transport.request(
            url,
            {
                method: options.method ?? 'GET',
                headers: options.headers,
                timeout: options.timeout ?? 3000,
                agent: false,
            },
            (res) => {
                const localAddress = (res.socket?.localAddress ?? '').replace(
                    /^::ffff:/,
                    '',
                );
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    body += chunk;
                    if (body.length > MAX_BODY)
                        req.destroy(toError('too-large'));
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
            req.destroy(toError('timeout'));
        });
        req.on('error', reject);
        req.end(options.body);
    });
}

export function readXmlTag(xml: string, tag: string) {
    const match = new RegExp(
        `<(?:\\w+:)?${tag}>\\s*([^<]*?)\\s*</(?:\\w+:)?${tag}>`,
        'i',
    ).exec(xml);
    return unescapeXml(match?.[1] ?? '');
}

export function unescapeXml(text: string) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

export function escapeXml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function listLocalIpv4s() {
    return Object.values(os.networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((nic) => !nic.internal && nic.family === 'IPv4')
        .map((nic) => nic.address);
}

// One SSDP search per target out of `address`'s network card: Windows sends
// multicast out of one card only unless told otherwise.
export function sendSsdpSearch(
    socket: dgram.Socket,
    targets: readonly string[],
    address?: string,
) {
    return Promise.all(
        targets.map((target) => {
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

// SOAP to a UPnP service: the answer's body when it says yes, else an error
// carrying the device's own words and code.
export class UpnpSoapError extends Error {
    constructor(
        message: string,
        readonly code = 0,
    ) {
        super(message);
    }
}
export async function upnpSoap(
    controlUrl: string,
    serviceType: string,
    action: string,
    args: [string, string | number][],
    toError?: (failure: UpnpFailureType) => Error,
) {
    const body =
        '<?xml version="1.0"?>\r\n' +
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
        's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
        `<s:Body><u:${action} xmlns:u="${serviceType}">` +
        args
            .map(([name, value]) => {
                return `<${name}>${escapeXml(String(value))}</${name}>`;
            })
            .join('') +
        `</u:${action}></s:Body></s:Envelope>`;
    const response = await upnpRequest(
        controlUrl,
        {
            method: 'POST',
            body,
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'Content-Length': Buffer.byteLength(body),
                SOAPAction: `"${serviceType}#${action}"`,
            },
        },
        toError,
    );
    if (response.status === 200) return response.body;
    throw new UpnpSoapError(
        readXmlTag(response.body, 'errorDescription') || `${action} refused`,
        Number(readXmlTag(response.body, 'errorCode')) || 0,
    );
}
