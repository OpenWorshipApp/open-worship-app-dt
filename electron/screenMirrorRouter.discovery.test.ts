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
