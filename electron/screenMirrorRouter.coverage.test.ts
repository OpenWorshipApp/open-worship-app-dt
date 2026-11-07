import { EventEmitter } from 'node:events';
import dgram from 'node:dgram';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { UpnpSoapError } from './upnpHelpers';
import type * as upnpHelpersModule from './upnpHelpers';

// A router that stops answering or answers too much, a description whose
// control address is no address, and a search where no router tells its
// public address. Nothing leaves this computer: the UPnP requests and the
// search socket are stand-ins.

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

import {
    ROUTER_LEASE_SECONDS,
    RouterError,
    findRouterGateway,
    getRouterExternalAddress,
    openRouterPort,
    readRouterPortOwner,
    readRouterServices,
    type RouterGateway,
} from './screenMirrorRouter';

const SERVICE = 'urn:schemas-upnp-org:service:WANIPConnection:1';
const GATEWAY: RouterGateway = {
    controlUrl: 'http://192.168.1.1:5000/ctl/IPConn',
    serviceType: SERVICE,
    localAddress: '192.168.1.3',
};

function makeSocket() {
    const socket = new EventEmitter() as EventEmitter & {
        bind: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
    };
    socket.bind = vi.fn((_port: number, callback: () => void) => callback());
    socket.close = vi.fn();
    return socket;
}

function actionsAsked() {
    return mocks.upnpSoap.mock.calls.map(([, , action]) => action);
}

// Each action asked with the external port it named.
function portsAsked() {
    return mocks.upnpSoap.mock.calls.map(([, , action, args]) => {
        const port = (args as [string, string | number][]).find(
            ([name]) => name === 'NewExternalPort',
        )?.[1];
        return `${action} ${port}`;
    });
}

function answerExternalAddress(address: string) {
    mocks.upnpSoap.mockResolvedValue(
        `<s:Body><NewExternalIPAddress>${address}</NewExternalIPAddress></s:Body>`,
    );
}

function serviceAt(control: string) {
    return `<root><service><serviceType>${SERVICE}</serviceType><controlURL>${control}</controlURL></service></root>`;
}

function emitLocation(target: EventEmitter, file: string) {
    target.emit(
        'message',
        Buffer.from(
            `HTTP/1.1 200 OK\r\nLOCATION: http://192.168.1.1:1900/${file}\r\n\r\n`,
        ),
        { address: '192.168.1.1' },
    );
}

beforeEach(() => {
    mocks.addresses = ['192.168.1.3'];
});

afterEach(() => {
    mocks.addresses = [];
});

describe('a router that stops answering', () => {
    test('its silence and its too-large answers are the router’s errors', async () => {
        mocks.upnpSoap.mockImplementation(
            async (...args: unknown[]): Promise<string> => {
                const toError = args[4] as (failure: string) => Error;
                throw toError('timeout');
            },
        );
        const silent = await getRouterExternalAddress(GATEWAY).catch(
            (error) => error,
        );
        expect(silent).toBeInstanceOf(RouterError);
        expect(silent).toMatchObject({
            message: 'Router did not answer',
            code: -1,
        });

        mocks.upnpSoap.mockImplementation(
            async (...args: unknown[]): Promise<string> => {
                const toError = args[4] as (failure: string) => Error;
                throw toError('too-large');
            },
        );
        await expect(getRouterExternalAddress(GATEWAY)).rejects.toMatchObject({
            message: 'Answer too large',
            code: -1,
        });
    });

    test('a router with no public address yet tells none', async () => {
        answerExternalAddress('0.0.0.0');
        await expect(getRouterExternalAddress(GATEWAY)).resolves.toBe('');

        answerExternalAddress('pending');
        await expect(getRouterExternalAddress(GATEWAY)).resolves.toBe('');

        answerExternalAddress('203.0.113.10');
        await expect(getRouterExternalAddress(GATEWAY)).resolves.toBe(
            '203.0.113.10',
        );
    });

    test('ends the search for a port at once, rather than trying the next', async () => {
        mocks.upnpSoap.mockImplementation(
            async (...args: unknown[]): Promise<string> => {
                const toError = args[4] as (failure: string) => Error;
                throw toError('timeout');
            },
        );

        await expect(
            openRouterPort(GATEWAY, 39241, '203.0.113.10'),
        ).rejects.toMatchObject({ message: 'Router did not answer', code: -1 });

        // Whose the port is could not be read; then one mapping asked for.
        expect(actionsAsked()).toEqual([
            'GetSpecificPortMappingEntry',
            'AddPortMapping',
        ]);
    });
});

describe('a router that needs the same port on both sides', () => {
    // A router that forwards 39241 only to 39241, and holds nothing yet.
    function sameportRouter({ isOwnPortRefused = false } = {}) {
        const mapped = new Set<number>();
        mocks.upnpSoap.mockImplementation(
            async (...args: unknown[]): Promise<string> => {
                const action = args[2] as string;
                const port = Number(
                    (args[3] as [string, string | number][]).find(
                        ([name]) => name === 'NewExternalPort',
                    )?.[1],
                );
                if (action === 'GetSpecificPortMappingEntry') {
                    if (!mapped.has(port)) {
                        throw new UpnpSoapError('NoSuchEntryInArray', 714);
                    }
                    return '<NewInternalClient>192.168.1.3</NewInternalClient><NewInternalPort>39241</NewInternalPort>';
                }
                if (port !== 39241 || isOwnPortRefused) {
                    throw new UpnpSoapError('SamePortValuesRequired', 724);
                }
                mapped.add(port);
                return '';
            },
        );
    }

    test('is given this computer’s own port after the one remembered', async () => {
        sameportRouter();

        const mapping = await openRouterPort(GATEWAY, 39241, '203.0.113.10', {
            preferredPort: 40001,
        });

        expect(mapping).toEqual({
            ...GATEWAY,
            externalAddress: '203.0.113.10',
            externalPort: 39241,
            internalPort: 39241,
            leaseSeconds: ROUTER_LEASE_SECONDS,
        });
        expect(portsAsked()).toEqual([
            'GetSpecificPortMappingEntry 40001',
            'AddPortMapping 40001',
            'GetSpecificPortMappingEntry 39241',
            'AddPortMapping 39241',
            'GetSpecificPortMappingEntry 39241',
        ]);
    });

    test('that will not have this computer’s own port is asked for no other', async () => {
        sameportRouter({ isOwnPortRefused: true });

        await expect(
            openRouterPort(GATEWAY, 39241, '203.0.113.10'),
        ).rejects.toMatchObject({
            message: 'SamePortValuesRequired',
            code: 724,
        });

        // None of the random ports was asked for.
        expect(portsAsked()).toEqual([
            'GetSpecificPortMappingEntry 39241',
            'AddPortMapping 39241',
        ]);
    });
});

describe('who a router forwards a port to', () => {
    function answerMapping(client: string, port = 39241) {
        mocks.upnpSoap.mockResolvedValue(
            `<NewInternalClient>${client}</NewInternalClient><NewInternalPort>${port}</NewInternalPort>`,
        );
    }
    const { localAddress: _localAddress, ...noLocalAddress } = GATEWAY;

    test('a name that is no address is not known', async () => {
        answerMapping('church-pc.lan');

        await expect(readRouterPortOwner(GATEWAY, 39241, 39241)).resolves.toBe(
            'unknown',
        );
    });

    test('with no address of its own given, this computer’s addresses tell', async () => {
        answerMapping('192.168.1.3');
        await expect(
            readRouterPortOwner(noLocalAddress, 39241, 39241),
        ).resolves.toBe('ours');

        answerMapping('192.168.1.9');
        await expect(
            readRouterPortOwner(noLocalAddress, 39241, 39241),
        ).resolves.toBe('taken');
    });
});

describe('a router’s description', () => {
    test('a control address that is no address is passed over', () => {
        const xml = [
            '<root>',
            `<service><serviceType>${SERVICE}</serviceType><controlURL>http://bad host/ctl</controlURL></service>`,
            `<service><serviceType>${SERVICE}</serviceType><controlURL>/ctl/IPConn</controlURL></service>`,
            '</root>',
        ].join('');

        expect(
            readRouterServices(
                xml,
                'http://192.168.1.1:5000/desc.xml',
                '192.168.1.3',
            ),
        ).toEqual([GATEWAY]);
    });
});

describe('the search for a router', () => {
    test('finds none when one description cannot be read and the other’s router keeps its address', async () => {
        const socket = makeSocket();
        vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
        mocks.sendSsdpSearch.mockImplementation(
            async (target: EventEmitter) => {
                for (const file of ['broken.xml', 'quiet.xml']) {
                    target.emit(
                        'message',
                        Buffer.from(
                            `HTTP/1.1 200 OK\r\nLOCATION: http://192.168.1.1:1900/${file}\r\n\r\n`,
                        ),
                        { address: '192.168.1.1' },
                    );
                }
            },
        );
        mocks.upnpRequest.mockImplementation(async (url: string) => {
            if (url.endsWith('/broken.xml')) {
                throw new Error('connection reset');
            }
            return {
                status: 200,
                body: `<root><service><serviceType>${SERVICE}</serviceType><controlURL>/control</controlURL></service></root>`,
                localAddress: '192.168.1.3',
            };
        });
        mocks.upnpSoap.mockRejectedValue(new Error('no public address'));

        await expect(findRouterGateway(20)).resolves.toBeNull();

        expect(mocks.upnpRequest.mock.calls.map(([url]) => url)).toEqual([
            'http://192.168.1.1:1900/broken.xml',
            'http://192.168.1.1:1900/quiet.xml',
        ]);
        expect(actionsAsked()).toEqual(['GetExternalIPAddress']);
        expect(socket.close).toHaveBeenCalledOnce();
    });

    test('a description not found, and a router reached on no IPv4 address, are asked nothing', async () => {
        const socket = makeSocket();
        vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
        mocks.sendSsdpSearch.mockImplementation(
            async (target: EventEmitter) => {
                emitLocation(target, 'missing.xml');
                emitLocation(target, 'v6.xml');
            },
        );
        mocks.upnpRequest.mockImplementation(async (url: string) => {
            return url.endsWith('/missing.xml')
                ? { status: 404, body: '', localAddress: '192.168.1.3' }
                : {
                      status: 200,
                      body: serviceAt('/control'),
                      localAddress: 'fe80::1',
                  };
        });

        await expect(findRouterGateway(20)).resolves.toBeNull();

        expect(mocks.upnpRequest).toHaveBeenCalledTimes(2);
        expect(actionsAsked()).toEqual([]);
        expect(socket.close).toHaveBeenCalledOnce();
    });

    test('the first router to tell its address is the one, and no more searches go out', async () => {
        mocks.addresses = ['192.168.1.3', '10.0.0.5'];
        const socket = makeSocket();
        vi.spyOn(dgram, 'createSocket').mockReturnValue(socket as any);
        mocks.sendSsdpSearch.mockImplementation((target: EventEmitter) => {
            emitLocation(target, 'one.xml');
            emitLocation(target, 'two.xml');
            // The search out of this card is still going out.
            return new Promise((resolve) => setTimeout(resolve, 5));
        });
        mocks.upnpRequest.mockImplementation(async (url: string) => {
            return {
                status: 200,
                body: serviceAt(url.endsWith('/one.xml') ? '/one' : '/two'),
                localAddress: '192.168.1.3',
            };
        });
        answerExternalAddress('203.0.113.10');

        const gateway = await findRouterGateway(1000);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(gateway).toEqual({
            controlUrl: 'http://192.168.1.1:1900/one',
            serviceType: SERVICE,
            localAddress: '192.168.1.3',
        });
        // Both routers were asked; the second's answer changed nothing.
        expect(actionsAsked()).toEqual([
            'GetExternalIPAddress',
            'GetExternalIPAddress',
        ]);
        expect(mocks.sendSsdpSearch).toHaveBeenCalledOnce();
        expect(mocks.sendSsdpSearch.mock.calls[0][2]).toBe('192.168.1.3');
        expect(socket.close).toHaveBeenCalledOnce();
    });
});
