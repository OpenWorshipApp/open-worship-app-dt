import { EventEmitter } from 'node:events';
import dgram from 'node:dgram';
import { afterEach, expect, test, vi } from 'vitest';
import type * as upnpHelpersModule from './upnpHelpers';

const mocks = vi.hoisted(() => ({
    addresses: [] as string[],
    sendSsdpSearch: vi.fn(),
    upnpRequest: vi.fn(),
    upnpSoap: vi.fn(),
}));

vi.mock('./upnpHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof upnpHelpersModule>();
    return {
        ...actual,
        listLocalIpv4s: () => mocks.addresses,
        sendSsdpSearch: mocks.sendSsdpSearch,
        upnpRequest: mocks.upnpRequest,
        upnpSoap: mocks.upnpSoap,
    };
});

import { findRouterGateway } from './screenMirrorRouter';

function makeSocket() {
    const socket = new EventEmitter() as EventEmitter & {
        bind: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
    };
    socket.bind = vi.fn((_port: number, callback: () => void) => callback());
    socket.close = vi.fn();
    return socket;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.addresses = [];
});

test('searches each local card and accepts only a router with a public address', async () => {
    const socket = makeSocket();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
    mocks.addresses = ['192.168.1.3'];
    mocks.sendSsdpSearch.mockImplementation(async (target: EventEmitter) => {
        target.emit(
            'message',
            Buffer.from(
                'HTTP/1.1 200 OK\r\nLOCATION: http://192.168.1.1:1900/root.xml\r\n\r\n',
            ),
            { address: '192.168.1.1' },
        );
    });
    mocks.upnpRequest.mockResolvedValue({
        status: 200,
        body: `<root><service><serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType><controlURL>/control</controlURL></service></root>`,
        localAddress: '192.168.1.3',
    });
    mocks.upnpSoap.mockResolvedValue(
        '<NewExternalIPAddress>203.0.113.10</NewExternalIPAddress>',
    );

    await expect(findRouterGateway(1000)).resolves.toEqual({
        controlUrl: 'http://192.168.1.1:1900/control',
        serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
        localAddress: '192.168.1.3',
    });

    expect(socket.bind).toHaveBeenCalledWith(0, expect.any(Function));
    expect(mocks.sendSsdpSearch).toHaveBeenCalledWith(
        socket,
        expect.arrayContaining([
            'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
            'urn:schemas-upnp-org:service:WANIPConnection:1',
        ]),
        '192.168.1.3',
    );
    expect(mocks.upnpRequest).toHaveBeenCalledWith(
        'http://192.168.1.1:1900/root.xml',
        {},
        expect.any(Function),
    );
    expect(mocks.upnpSoap).toHaveBeenCalledWith(
        'http://192.168.1.1:1900/control',
        'urn:schemas-upnp-org:service:WANIPConnection:1',
        'GetExternalIPAddress',
        [],
        expect.any(Function),
    );
    expect(socket.close).toHaveBeenCalledOnce();
});

test('ignores malformed and off-network responses and times out with no router', async () => {
    const socket = makeSocket();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
    mocks.sendSsdpSearch.mockImplementation(async (target: EventEmitter) => {
        target.emit('message', Buffer.alloc(4097), { address: '192.168.1.1' });
        target.emit('message', Buffer.from('HTTP/1.1 200 OK'), {
            address: '192.168.1.1',
        });
        target.emit(
            'message',
            Buffer.from(
                'HTTP/1.1 200 OK\r\nLOCATION: http://192.168.1.2:1900/root.xml\r\n',
            ),
            { address: '192.168.1.1' },
        );
    });

    await expect(findRouterGateway(10)).resolves.toBeNull();

    expect(mocks.upnpRequest).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledOnce();
});

test('uses an unbound search when there are no IPv4 cards and closes on socket error', async () => {
    const socket = makeSocket();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
    mocks.sendSsdpSearch.mockResolvedValue(undefined);

    const found = findRouterGateway(1000);
    await vi.waitFor(() => expect(mocks.sendSsdpSearch).toHaveBeenCalledOnce());
    expect(mocks.sendSsdpSearch).toHaveBeenCalledWith(
        socket,
        expect.any(Array),
        undefined,
    );
    socket.emit('error', new Error('network unavailable'));
    await expect(found).resolves.toBeNull();
    expect(socket.close).toHaveBeenCalledOnce();
});

const WAN_IP = 'urn:schemas-upnp-org:service:WANIPConnection:1';

function routerDescription(controlPath: string) {
    return `<root><service><serviceType>${WAN_IP}</serviceType><controlURL>${controlPath}</controlURL></service></root>`;
}

function ssdpAnswer(location: string) {
    return Buffer.from(`HTTP/1.1 200 OK\r\nLOCATION: ${location}\r\n\r\n`);
}

test('the first router with a public address wins; one answering later changes nothing', async () => {
    const socket = makeSocket();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
    mocks.addresses = ['192.168.1.3'];
    let answerLate: (value: unknown) => void = () => {};
    mocks.upnpRequest.mockImplementation((url: string) => {
        if (url.startsWith('http://192.168.1.254')) {
            return new Promise((resolve) => {
                answerLate = resolve;
            });
        }
        return Promise.resolve({
            status: 200,
            body: routerDescription('/first'),
            localAddress: '192.168.1.3',
        });
    });
    mocks.upnpSoap.mockResolvedValue(
        '<NewExternalIPAddress>203.0.113.10</NewExternalIPAddress>',
    );
    mocks.sendSsdpSearch.mockImplementation(async (target: EventEmitter) => {
        target.emit(
            'message',
            ssdpAnswer('http://192.168.1.254:1900/late.xml'),
            {
                address: '192.168.1.254',
            },
        );
        target.emit(
            'message',
            ssdpAnswer('http://192.168.1.1:1900/first.xml'),
            {
                address: '192.168.1.1',
            },
        );
    });

    const found = await findRouterGateway(1000);
    expect(found).toEqual({
        controlUrl: 'http://192.168.1.1:1900/first',
        serviceType: WAN_IP,
        localAddress: '192.168.1.3',
    });
    answerLate({
        status: 200,
        body: routerDescription('/late'),
        localAddress: '192.168.1.3',
    });
    // The late one is still asked, and still settles: once, harmlessly.
    await vi.waitFor(() => expect(mocks.upnpSoap).toHaveBeenCalledTimes(2));
    expect(mocks.upnpSoap).toHaveBeenLastCalledWith(
        'http://192.168.1.254:1900/late',
        WAN_IP,
        'GetExternalIPAddress',
        [],
        expect.any(Function),
    );
    expect(socket.close).toHaveBeenCalledOnce();
});

test('a router that says no, has no IPv4 side, fails, or has no public address is passed over', async () => {
    const socket = makeSocket();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
    mocks.addresses = ['192.168.1.3'];
    mocks.upnpRequest.mockImplementation(async (url: string) => {
        if (url.includes('192.168.1.10')) {
            return { status: 404, body: '', localAddress: '192.168.1.3' };
        }
        if (url.includes('192.168.1.11')) {
            return {
                status: 200,
                body: routerDescription('/v6'),
                localAddress: 'fe80::3',
            };
        }
        if (url.includes('192.168.1.12')) {
            throw new Error('ECONNRESET');
        }
        return {
            status: 200,
            body: routerDescription('/none'),
            localAddress: '192.168.1.3',
        };
    });
    mocks.upnpSoap.mockResolvedValue(
        '<NewExternalIPAddress>0.0.0.0</NewExternalIPAddress>',
    );
    mocks.sendSsdpSearch.mockImplementation(async (target: EventEmitter) => {
        for (const last of [10, 11, 12, 13]) {
            target.emit(
                'message',
                ssdpAnswer(`http://192.168.1.${last}:1900/root.xml`),
                { address: `192.168.1.${last}` },
            );
        }
    });

    await expect(findRouterGateway(20)).resolves.toBeNull();
    expect(mocks.upnpRequest).toHaveBeenCalledTimes(4);
    // Only the one with a description and an IPv4 side was asked its
    // public address, and it had none.
    expect(mocks.upnpSoap).toHaveBeenCalledOnce();
    expect(mocks.upnpSoap).toHaveBeenCalledWith(
        'http://192.168.1.13:1900/none',
        WAN_IP,
        'GetExternalIPAddress',
        [],
        expect.any(Function),
    );
    expect(socket.close).toHaveBeenCalledOnce();
});

test('a search a socket error ended is not carried on out of the next card', async () => {
    const socket = makeSocket();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
    mocks.addresses = ['192.168.1.3', '10.0.0.4'];
    mocks.sendSsdpSearch.mockImplementation(async (target: EventEmitter) => {
        target.emit('error', new Error('ENETDOWN'));
    });

    await expect(findRouterGateway(1000)).resolves.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.sendSsdpSearch).toHaveBeenCalledOnce();
    expect(mocks.sendSsdpSearch).toHaveBeenCalledWith(
        socket,
        expect.any(Array),
        '192.168.1.3',
    );
    expect(socket.close).toHaveBeenCalledOnce();
});
