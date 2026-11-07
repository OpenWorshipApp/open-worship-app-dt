import http from 'node:http';
import type net from 'node:net';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    SSDP_ADDRESS,
    SSDP_PORT,
    UpnpSoapError,
    checkIsDeviceUrl,
    escapeXml,
    listLocalIpv4s,
    readXmlTag,
    sendSsdpSearch,
    unescapeXml,
    upnpRequest,
    upnpSoap,
} from './upnpHelpers';

// A device on this network, played by a server on loopback port 0: every
// request it saw, and what it answers decided per test.
type SeenRequest = {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
};
let server: http.Server;
let baseUrl = '';
let seen: SeenRequest[] = [];
let answer: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeEach(async () => {
    seen = [];
    answer = (_req, res) => res.end('ok');
    server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            seen.push({
                method: req.method ?? '',
                url: req.url ?? '',
                headers: req.headers,
                body,
            });
            answer(req, res);
        });
    });
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address() as net.AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('checkIsDeviceUrl', () => {
    test('accepts plain http to an IPv4 address only', () => {
        expect(checkIsDeviceUrl('http://192.168.1.1:1900/root.xml')).toBe(true);
        expect(checkIsDeviceUrl('https://192.168.1.1/root.xml')).toBe(false);
        expect(checkIsDeviceUrl('http://router.local/root.xml')).toBe(false);
        expect(checkIsDeviceUrl('http://[::1]/root.xml')).toBe(false);
        // Credentials in the address could be sent to whoever answered.
        expect(checkIsDeviceUrl('http://admin@192.168.1.1/')).toBe(false);
        expect(checkIsDeviceUrl('http://:secret@192.168.1.1/')).toBe(false);
    });

    test('given a host, accepts that address and no other', () => {
        expect(checkIsDeviceUrl('http://192.168.1.1/ctl', '192.168.1.1')).toBe(
            true,
        );
        expect(checkIsDeviceUrl('http://192.168.1.99/ctl', '192.168.1.1')).toBe(
            false,
        );
    });

    test('says no to text that is not an address, rather than throwing', () => {
        expect(checkIsDeviceUrl('not an address')).toBe(false);
        expect(checkIsDeviceUrl('')).toBe(false);
    });
});

describe('upnpRequest', () => {
    test('answers the status, the body and the card that faced the device', async () => {
        answer = (_req, res) => {
            res.writeHead(201, { 'content-type': 'text/xml' });
            res.end('<root/>');
        };

        const response = await upnpRequest(`${baseUrl}/description.xml`);

        expect(response).toEqual({
            status: 201,
            body: '<root/>',
            localAddress: '127.0.0.1',
        });
        expect(seen).toMatchObject([
            { method: 'GET', url: '/description.xml', body: '' },
        ]);
    });

    test('sends the method, headers and body it is given', async () => {
        await upnpRequest(`${baseUrl}/ctl`, {
            method: 'POST',
            headers: { 'x-test': 'yes' },
            body: 'payload',
        });

        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({
            method: 'POST',
            url: '/ctl',
            body: 'payload',
        });
        expect(seen[0].headers['x-test']).toBe('yes');
    });

    test('gives up on an answer too large to hold', async () => {
        const chunk = 'x'.repeat(64 * 1024);
        answer = (_req, res) => {
            res.writeHead(200);
            // Past the 256 KiB ceiling, then left open: only the ceiling
            // can end this request.
            for (let index = 0; index < 5; index++) res.write(chunk);
        };

        await expect(upnpRequest(`${baseUrl}/big`)).rejects.toThrow(
            'Answer too large',
        );
    });

    test('words a failure the way the caller asks', async () => {
        const chunk = 'x'.repeat(64 * 1024);
        answer = (_req, res) => {
            res.writeHead(200);
            for (let index = 0; index < 5; index++) res.write(chunk);
        };
        const toError = vi.fn((failure: string) => {
            return new Error(`router: ${failure}`);
        });

        await expect(
            upnpRequest(`${baseUrl}/big`, {}, toError),
        ).rejects.toThrow('router: too-large');
        expect(toError).toHaveBeenCalledWith('too-large');
    });

    test('gives up on a device that never answers', async () => {
        // Never answered: only the timeout can end it.
        answer = () => {};

        await expect(
            upnpRequest(`${baseUrl}/silent`, { timeout: 30 }),
        ).rejects.toThrow('Did not answer');
    });

    test('rejects when nothing is listening', async () => {
        // A port that was free a moment ago: nothing answers on it.
        const probe = http.createServer();
        await new Promise<void>((resolve) => {
            probe.listen(0, '127.0.0.1', resolve);
        });
        const { port } = probe.address() as net.AddressInfo;
        await new Promise<void>((resolve) => probe.close(() => resolve()));

        await expect(
            upnpRequest(`http://127.0.0.1:${port}/gone`),
        ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    });
});

describe('upnpSoap', () => {
    test('posts the action as SOAP, escaping each argument', async () => {
        answer = (_req, res) => {
            res.writeHead(200);
            res.end('<NewExternalIPAddress>203.0.113.9</NewExternalIPAddress>');
        };

        const body = await upnpSoap(
            `${baseUrl}/ctl`,
            'urn:schemas-upnp-org:service:WANIPConnection:1',
            'AddPortMapping',
            [
                ['NewExternalPort', 40001],
                ['NewPortMappingDescription', 'Open <Worship> & "co"'],
            ],
        );

        expect(body).toBe(
            '<NewExternalIPAddress>203.0.113.9</NewExternalIPAddress>',
        );
        expect(seen).toHaveLength(1);
        const [request] = seen;
        expect(request.method).toBe('POST');
        expect(request.headers.soapaction).toBe(
            '"urn:schemas-upnp-org:service:WANIPConnection:1#AddPortMapping"',
        );
        expect(request.headers['content-type']).toBe(
            'text/xml; charset="utf-8"',
        );
        expect(Number(request.headers['content-length'])).toBe(
            Buffer.byteLength(request.body),
        );
        expect(request.body).toContain(
            '<u:AddPortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1">',
        );
        expect(request.body).toContain(
            '<NewExternalPort>40001</NewExternalPort>',
        );
        expect(request.body).toContain(
            '<NewPortMappingDescription>Open &lt;Worship&gt; &amp; &quot;co&quot;</NewPortMappingDescription>',
        );
    });

    test('a refusal carries the device’s own words and code', async () => {
        answer = (_req, res) => {
            res.writeHead(500);
            res.end(
                '<s:Envelope><s:Body><s:Fault><detail><UPnPError>' +
                    '<errorCode>718</errorCode>' +
                    '<errorDescription>ConflictInMappingEntry</errorDescription>' +
                    '</UPnPError></detail></s:Fault></s:Body></s:Envelope>',
            );
        };

        const error = await upnpSoap(
            `${baseUrl}/ctl`,
            'urn:x',
            'Add',
            [],
        ).catch((caught) => caught);

        expect(error).toBeInstanceOf(UpnpSoapError);
        expect(error.message).toBe('ConflictInMappingEntry');
        expect(error.code).toBe(718);
    });

    test('a refusal with no words says which action was refused', async () => {
        answer = (_req, res) => {
            res.writeHead(401);
            res.end('<html>nope</html>');
        };

        const error = await upnpSoap(
            `${baseUrl}/ctl`,
            'urn:x',
            'GetExternalIPAddress',
            [],
        ).catch((caught) => caught);

        expect(error).toBeInstanceOf(UpnpSoapError);
        expect(error.message).toBe('GetExternalIPAddress refused');
        expect(error.code).toBe(0);
    });
});

describe('the XML pieces', () => {
    test('reads a tag with or without a namespace prefix, unescaped', () => {
        const xml =
            '<root><u:friendlyName>  Living &amp; Room &lt;TV&gt;  </u:friendlyName>' +
            '<controlURL>/ctl?a=&quot;1&quot;&amp;b=&apos;2&apos;</controlURL></root>';

        expect(readXmlTag(xml, 'friendlyName')).toBe('Living & Room <TV>');
        expect(readXmlTag(xml, 'CONTROLURL')).toBe(`/ctl?a="1"&b='2'`);
        expect(readXmlTag(xml, 'missing')).toBe('');
    });

    test('escaping then unescaping gives the text back', () => {
        const text = `a < b & "c" > d`;

        expect(escapeXml(text)).toBe('a &lt; b &amp; &quot;c&quot; &gt; d');
        expect(unescapeXml(escapeXml(text))).toBe(text);
        // `&amp;lt;` is a literal "&lt;", not a "<".
        expect(unescapeXml('&amp;lt;')).toBe('&lt;');
    });
});

describe('listLocalIpv4s', () => {
    test('lists the external IPv4 addresses of every card', () => {
        vi.spyOn(os, 'networkInterfaces').mockReturnValue({
            lo: [
                {
                    address: '127.0.0.1',
                    family: 'IPv4',
                    internal: true,
                } as os.NetworkInterfaceInfo,
            ],
            eth0: [
                {
                    address: '192.168.1.3',
                    family: 'IPv4',
                    internal: false,
                } as os.NetworkInterfaceInfo,
                {
                    address: 'fe80::1',
                    family: 'IPv6',
                    internal: false,
                } as os.NetworkInterfaceInfo,
            ],
            wifi: undefined,
            vpn: [
                {
                    address: '10.8.0.2',
                    family: 'IPv4',
                    internal: false,
                } as os.NetworkInterfaceInfo,
            ],
        });

        expect(listLocalIpv4s()).toEqual(['192.168.1.3', '10.8.0.2']);
    });
});

describe('sendSsdpSearch', () => {
    function makeSocket() {
        return {
            setMulticastInterface: vi.fn(),
            send: vi.fn(
                (
                    _message: string,
                    _port: number,
                    _address: string,
                    callback: () => void,
                ) => {
                    callback();
                },
            ),
        };
    }

    test('sends one M-SEARCH per target out of the named card', async () => {
        const socket = makeSocket();

        await sendSsdpSearch(
            socket as any,
            ['urn:dial-multiscreen-org:service:dial:1', 'roku:ecp'],
            '192.168.1.3',
        );

        expect(socket.setMulticastInterface).toHaveBeenCalledTimes(2);
        expect(socket.setMulticastInterface).toHaveBeenCalledWith(
            '192.168.1.3',
        );
        expect(socket.send).toHaveBeenCalledTimes(2);
        const [message, port, address] = socket.send.mock.calls[1];
        expect(port).toBe(SSDP_PORT);
        expect(address).toBe(SSDP_ADDRESS);
        expect(message).toBe(
            'M-SEARCH * HTTP/1.1\r\n' +
                'HOST: 239.255.255.250:1900\r\n' +
                'MAN: "ssdp:discover"\r\n' +
                'MX: 2\r\n' +
                'ST: roku:ecp\r\n\r\n',
        );
    });

    test('leaves the card to the system when none is named', async () => {
        const socket = makeSocket();

        await sendSsdpSearch(socket as any, ['ssdp:all']);

        expect(socket.setMulticastInterface).not.toHaveBeenCalled();
        expect(socket.send).toHaveBeenCalledTimes(1);
    });

    test('a card that cannot send does not stop the search', async () => {
        const socket = makeSocket();
        socket.setMulticastInterface.mockImplementation(() => {
            throw new Error('EADDRNOTAVAIL');
        });

        await expect(
            sendSsdpSearch(socket as any, ['ssdp:all', 'roku:ecp'], '10.0.0.9'),
        ).resolves.toEqual([undefined, undefined]);
        expect(socket.send).not.toHaveBeenCalled();
    });
});
