import http from 'node:http';
import type dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    SSDP_ADDRESS,
    SSDP_PORT,
    UpnpSoapError,
    checkIsDeviceUrl,
    sendSsdpSearch,
    upnpRequest,
    upnpSoap,
} from './upnpHelpers';

const servers: http.Server[] = [];
afterEach(async () => {
    for (const server of servers.splice(0)) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

// A device on this computer, answering on a port of its own.
async function serve(handle: http.RequestListener) {
    const requests: { method: string; headers: any; body: string }[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            requests.push({
                method: req.method ?? '',
                headers: req.headers,
                body,
            });
            handle(req, res);
        });
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    return { url: `http://127.0.0.1:${port}`, requests };
}

describe('checkIsDeviceUrl', () => {
    test('plain http to an IPv4 address with no credentials, on the host given', () => {
        expect(checkIsDeviceUrl('http://192.168.1.1:5000/ctl')).toBe(true);
        expect(
            checkIsDeviceUrl('http://192.168.1.1:5000/ctl', '192.168.1.1'),
        ).toBe(true);
        expect(
            checkIsDeviceUrl('http://192.168.1.1:5000/ctl', '192.168.1.2'),
        ).toBe(false);
        expect(checkIsDeviceUrl('https://192.168.1.1/ctl')).toBe(false);
        expect(checkIsDeviceUrl('http://user:pass@192.168.1.1/ctl')).toBe(
            false,
        );
        expect(checkIsDeviceUrl('http://router.local/ctl')).toBe(false);
        expect(checkIsDeviceUrl('http://[fe80::1]/ctl')).toBe(false);
        expect(checkIsDeviceUrl('not an address')).toBe(false);
    });
});

describe('upnpRequest', () => {
    test('answers the status, the body and the card it went out of', async () => {
        const device = await serve((_req, res) => {
            res.writeHead(201).end('<ok/>');
        });
        expect(
            await upnpRequest(`${device.url}/desc.xml`, {
                method: 'POST',
                body: 'hello',
                headers: { 'X-Test': 1 },
            }),
        ).toEqual({ status: 201, body: '<ok/>', localAddress: '127.0.0.1' });
        expect(device.requests).toEqual([
            {
                method: 'POST',
                headers: expect.objectContaining({ 'x-test': '1' }),
                body: 'hello',
            },
        ]);
    });

    test('an answer too large to be a description is cut off', async () => {
        const device = await serve((_req, res) => {
            res.writeHead(200).end('x'.repeat(300 * 1024));
        });
        await expect(upnpRequest(`${device.url}/big.xml`)).rejects.toThrow(
            'Answer too large',
        );
        const toError = vi.fn((failure: string) => new Error(`own ${failure}`));
        await expect(
            upnpRequest(`${device.url}/big.xml`, {}, toError),
        ).rejects.toThrow('own too-large');
        expect(toError).toHaveBeenCalledWith('too-large');
    });

    test('a device that does not answer in time is given up on', async () => {
        // Takes the request and never answers it.
        await serve(() => {});
        const device = servers.at(-1)!;
        const { port } = device.address() as AddressInfo;
        await expect(
            upnpRequest(`http://127.0.0.1:${port}/slow.xml`, { timeout: 20 }),
        ).rejects.toThrow('Did not answer');
        await expect(
            upnpRequest(
                `http://127.0.0.1:${port}/slow.xml`,
                { timeout: 20 },
                (failure) => new Error(`router ${failure}`),
            ),
        ).rejects.toThrow('router timeout');
    });

    test('a device that is not there fails at once', async () => {
        const device = await serve((_req, res) => res.end());
        const url = device.url;
        for (const server of servers.splice(0)) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        await expect(upnpRequest(`${url}/gone.xml`)).rejects.toMatchObject({
            code: 'ECONNREFUSED',
        });
    });
});

describe('upnpSoap', () => {
    test("says the action, escapes its arguments, and hands back the device's yes", async () => {
        const device = await serve((_req, res) => {
            res.writeHead(200).end('<u:PlayResponse/>');
        });
        expect(
            await upnpSoap(
                `${device.url}/avt`,
                'urn:schemas-upnp-org:service:AVTransport:1',
                'Play',
                [
                    ['InstanceID', 0],
                    ['Speed', '1 & <fast>'],
                ],
            ),
        ).toBe('<u:PlayResponse/>');
        const [request] = device.requests;
        expect(request.headers.soapaction).toBe(
            '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
        );
        expect(request.headers['content-length']).toBe(
            String(Buffer.byteLength(request.body)),
        );
        expect(request.body).toContain(
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">' +
                '<InstanceID>0</InstanceID><Speed>1 &amp; &lt;fast&gt;</Speed></u:Play>',
        );
    });

    test("a no carries the device's own words and code, or says which action was refused", async () => {
        let answer = '';
        const device = await serve((_req, res) => {
            res.writeHead(500).end(answer);
        });
        answer =
            '<s:Fault><detail><UPnPError><errorCode>718</errorCode>' +
            '<errorDescription>ConflictInMappingEntry</errorDescription>' +
            '</UPnPError></detail></s:Fault>';
        const refusal = await upnpSoap(
            `${device.url}/ctl`,
            'urn:schemas-upnp-org:service:WANIPConnection:1',
            'AddPortMapping',
            [],
        ).catch((error) => error);
        expect(refusal).toBeInstanceOf(UpnpSoapError);
        expect(refusal).toMatchObject({
            message: 'ConflictInMappingEntry',
            code: 718,
        });
        answer = '<html>Internal error</html>';
        await expect(
            upnpSoap(
                `${device.url}/ctl`,
                'urn:schemas-upnp-org:service:WANIPConnection:1',
                'DeletePortMapping',
                [],
            ),
        ).rejects.toMatchObject({
            message: 'DeletePortMapping refused',
            code: 0,
        });
    });
});

describe('sendSsdpSearch', () => {
    function genSocket() {
        return {
            sent: [] as { text: string; port: number; address: string }[],
            setMulticastInterface: vi.fn(),
            send: vi.fn(function send(
                this: any,
                text: string,
                port: number,
                address: string,
                callback: () => void,
            ) {
                this.sent.push({ text, port, address });
                callback();
            }),
        };
    }

    test('one M-SEARCH per target, out of the card asked for', async () => {
        const socket = genSocket();
        await sendSsdpSearch(
            socket as unknown as dgram.Socket,
            ['roku:ecp', 'urn:schemas-upnp-org:device:MediaRenderer:1'],
            '192.168.1.3',
        );
        expect(socket.setMulticastInterface).toHaveBeenCalledTimes(2);
        expect(socket.setMulticastInterface).toHaveBeenCalledWith(
            '192.168.1.3',
        );
        expect(socket.sent).toEqual([
            {
                text:
                    'M-SEARCH * HTTP/1.1\r\n' +
                    `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
                    'MAN: "ssdp:discover"\r\n' +
                    'MX: 2\r\n' +
                    'ST: roku:ecp\r\n\r\n',
                port: 1900,
                address: '239.255.255.250',
            },
            {
                text: expect.stringContaining(
                    'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n',
                ),
                port: 1900,
                address: '239.255.255.250',
            },
        ]);
    });

    test('with no card named it sends out of the default one', async () => {
        const socket = genSocket();
        await sendSsdpSearch(socket as unknown as dgram.Socket, ['roku:ecp']);
        expect(socket.setMulticastInterface).not.toHaveBeenCalled();
        expect(socket.sent).toHaveLength(1);
    });

    test('a card or socket that will not send still lets the search finish', async () => {
        const socket = genSocket();
        socket.setMulticastInterface.mockImplementation(() => {
            throw new Error('EADDRNOTAVAIL');
        });
        await expect(
            sendSsdpSearch(
                socket as unknown as dgram.Socket,
                ['roku:ecp', 'urn:x'],
                '10.0.0.9',
            ),
        ).resolves.toEqual([undefined, undefined]);
        expect(socket.send).not.toHaveBeenCalled();

        const closed = genSocket();
        closed.send.mockImplementation(() => {
            throw new Error('Not running');
        });
        await expect(
            sendSsdpSearch(closed as unknown as dgram.Socket, ['roku:ecp']),
        ).resolves.toEqual([undefined]);
    });
});
