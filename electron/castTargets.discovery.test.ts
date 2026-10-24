import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type * as upnpHelpersModule from './upnpHelpers';

const dgramState = vi.hoisted(() => ({ sockets: [] as any[] }));
vi.mock('node:dgram', async () => {
    const { EventEmitter: Emitter } = await import('node:events');
    class FakeSocket extends Emitter {
        bind = vi.fn((_port: number, callback?: () => void) => {
            queueMicrotask(() => callback?.());
        });
        close = vi.fn();
        send = vi.fn(
            (
                _message: unknown,
                _port: number,
                _address: string,
                callback?: () => void,
            ) => callback?.(),
        );
        setMulticastInterface = vi.fn();
    }
    const createSocket = vi.fn(() => {
        const socket = new FakeSocket();
        dgramState.sockets.push(socket);
        return socket;
    });
    return { default: { createSocket }, createSocket };
});

vi.mock('./upnpHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof upnpHelpersModule>();
    return {
        ...actual,
        listLocalIpv4s: vi.fn(() => ['192.168.1.3', '10.0.0.4']),
        sendSsdpSearch: vi.fn(async () => {}),
        upnpRequest: vi.fn(async (url: string) => {
            if (url.endsWith('/unavailable.xml')) {
                return { status: 503, body: '', localAddress: '192.168.1.3' };
            }
            if (url.endsWith('/empty.xml')) {
                return {
                    status: 200,
                    body: '<root><device/></root>',
                    localAddress: '192.168.1.3',
                };
            }
            if (url.endsWith('/roku.xml')) {
                return {
                    status: 200,
                    body:
                        '<root><device><friendlyName>Hall Roku</friendlyName>' +
                        '<serialNumber>roku-1</serialNumber></device></root>',
                    localAddress: '192.168.1.3',
                };
            }
            return {
                status: 200,
                body:
                    '<root><URLBase>http://192.168.1.50:7676/</URLBase>' +
                    '<device><friendlyName>Hall TV</friendlyName>' +
                    '<UDN>uuid:tv-1</UDN><serviceList><service>' +
                    '<serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>' +
                    '<controlURL>/avtransport</controlURL></service></serviceList></device></root>',
                localAddress: '192.168.1.3',
            };
        }),
    };
});

import dgram from 'node:dgram';
import { discoverCastTargets } from './castTargets';

const GOOGLE_CAST_SERVICE = '_googlecast._tcp.local';

function dnsName(name: string) {
    return Buffer.concat([
        ...name.split('.').map((label) => {
            const bytes = Buffer.from(label);
            return Buffer.concat([Buffer.from([bytes.length]), bytes]);
        }),
        Buffer.from([0]),
    ]);
}

function dnsRecord(name: string, type: number, data: Buffer) {
    const fields = Buffer.alloc(10);
    fields.writeUInt16BE(type, 0);
    fields.writeUInt16BE(1, 2);
    fields.writeUInt32BE(120, 4);
    fields.writeUInt16BE(data.length, 8);
    return Buffer.concat([dnsName(name), fields, data]);
}

function dnsTxt(values: string[]) {
    return Buffer.concat(
        values.map((value) => {
            const bytes = Buffer.from(value);
            return Buffer.concat([Buffer.from([bytes.length]), bytes]);
        }),
    );
}

function googleCastAnswer() {
    const tv = `lobby.${GOOGLE_CAST_SERVICE}`;
    const speaker = `kitchen.${GOOGLE_CAST_SERVICE}`;
    const srv = (port: number) => {
        const values = Buffer.alloc(6);
        values.writeUInt16BE(port, 4);
        return Buffer.concat([values, dnsName('tv.local')]);
    };
    const records = [
        dnsRecord(GOOGLE_CAST_SERVICE, 12, dnsName(tv)),
        dnsRecord(GOOGLE_CAST_SERVICE, 12, dnsName(speaker)),
        dnsRecord(tv, 33, srv(8009)),
        dnsRecord(tv, 16, dnsTxt(['id=cast-1', 'fn=Living Room', 'ca=4101'])),
        dnsRecord(speaker, 33, srv(8009)),
        dnsRecord(
            speaker,
            16,
            dnsTxt(['id=speaker-1', 'fn=Kitchen', 'ca=2052']),
        ),
    ];
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0x8400, 2);
    header.writeUInt16BE(records.length, 6);
    return Buffer.concat([header, ...records]);
}

function ssdp(location: string, target: string, server = '') {
    return Buffer.from(
        'HTTP/1.1 200 OK\r\n' +
            `LOCATION: ${location}\r\n` +
            `ST: ${target}\r\n` +
            `SERVER: ${server}\r\n\r\n`,
    );
}

describe('Cast TV discovery', () => {
    beforeEach(() => {
        dgramState.sockets.length = 0;
    });

    afterEach(() => {
        for (const socket of dgramState.sockets) socket.removeAllListeners();
        vi.useRealTimers();
    });

    test('searches every local card and returns verified Google Cast, DLNA, and Roku targets', async () => {
        const discovery = discoverCastTargets(30);
        const [mdns, ssdpSocket] = dgramState.sockets;
        expect(dgram.createSocket).toHaveBeenCalledTimes(2);
        await Promise.resolve();
        expect(mdns.send).toHaveBeenCalled();

        const source = { address: '192.168.1.50' };
        mdns.emit('message', googleCastAnswer(), source);
        mdns.emit('message', Buffer.from([1, 2, 3]), {
            address: '203.0.113.8',
        });
        mdns.emit('message', Buffer.alloc(9001), source);

        const dmr = 'http://192.168.1.50:7676/dmr.xml';
        const roku = 'http://192.168.1.50:8060/roku.xml';
        ssdpSocket.emit(
            'message',
            ssdp(dmr, 'urn:schemas-upnp-org:device:MediaRenderer:1'),
            source,
        );
        // A repeat does not fetch the same description twice.
        ssdpSocket.emit(
            'message',
            ssdp(dmr, 'urn:schemas-upnp-org:device:MediaRenderer:1'),
            source,
        );
        ssdpSocket.emit('message', ssdp(roku, 'roku:ecp', 'Roku/14.0'), source);
        ssdpSocket.emit(
            'message',
            ssdp('http://192.168.1.50/unavailable.xml', 'roku:ecp'),
            source,
        );
        ssdpSocket.emit(
            'message',
            ssdp(
                'http://192.168.1.50/empty.xml',
                'urn:schemas-upnp-org:device:MediaRenderer:1',
            ),
            source,
        );
        ssdpSocket.emit(
            'message',
            ssdp('http://203.0.113.9/fake.xml', 'roku:ecp'),
            source,
        );
        ssdpSocket.emit('message', Buffer.alloc(9001), source);

        const targets = await discovery;
        expect(
            targets.map(({ id, kind, name }) => ({ id, kind, name })),
        ).toEqual([
            { id: 'roku:roku-1', kind: 'roku', name: 'Hall Roku' },
            { id: 'dlna:tv-1', kind: 'dlna', name: 'Hall TV' },
            {
                id: 'google-cast:cast-1',
                kind: 'google-cast',
                name: 'Living Room',
            },
        ]);
        expect(mdns.setMulticastInterface).toHaveBeenCalledWith('192.168.1.3');
        expect(mdns.setMulticastInterface).toHaveBeenCalledWith('10.0.0.4');
        expect(mdns.close).toHaveBeenCalledOnce();
        expect(ssdpSocket.close).toHaveBeenCalledOnce();
    });
});
