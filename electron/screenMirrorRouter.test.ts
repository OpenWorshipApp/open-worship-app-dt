import { afterEach, expect, test } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
    closeRouterPort,
    getRouterExternalAddress,
    lookUpPublicAddress,
    openRouterPort,
    probeRouterPort,
    readRouterMapping,
    readRouterServices,
    renewRouterPort,
    ROUTER_PROBE_PATH,
    type RouterGateway,
} from './screenMirrorRouter';

const SERVICE = 'urn:schemas-upnp-org:service:WANIPConnection:1';
// Another computer behind the same router: a documentation address, so it is
// never one of the network cards of the machine running the tests.
const OTHER = { client: '198.51.100.7', port: 39240 };
const servers: http.Server[] = [];
afterEach(async () => {
    for (const server of servers.splice(0))
        await new Promise<void>((resolve) => server.close(() => resolve()));
});

type Entry = { client: string; port: number };
// A router holding a real table of TCP mappings. AddPortMapping fails with the
// codes a test lines up; on an `elsewhere` port it says yes and forwards to
// the other computer anyway; a `blind` one will not say whose a port is, as
// GetSpecificPortMappingEntry is optional on IGD:1; a `samePort` one maps an
// external port only to the same internal one (724).
async function fakeRouter({
    failures = [],
    table = new Map<number, Entry>(),
    elsewhere = [],
    blind = false,
    samePort = false,
}: {
    failures?: number[];
    table?: Map<number, Entry>;
    elsewhere?: number[];
    blind?: boolean;
    samePort?: boolean;
} = {}) {
    const calls: { action: string; body: string }[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            const action = /#(\w+)"$/.exec(String(req.headers.soapaction))?.[1];
            calls.push({ action: action ?? '', body });
            const arg = (name: string) => {
                return new RegExp(`<${name}>([^<]*)<`).exec(body)?.[1] ?? '';
            };
            const port = Number(arg('NewExternalPort'));
            const fault = (code: number) => {
                res.writeHead(500).end(
                    `<s:Envelope><s:Body><s:Fault><detail><UPnPError><errorCode>${code}</errorCode><errorDescription>No</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>`,
                );
            };
            const answer = (inner = '') => {
                res.writeHead(200).end(
                    `<s:Envelope><s:Body><u:${action}Response>${inner}</u:${action}Response></s:Body></s:Envelope>`,
                );
            };
            if (action === 'GetExternalIPAddress') {
                answer(
                    '<NewExternalIPAddress>203.0.113.10</NewExternalIPAddress>',
                );
            } else if (action === 'AddPortMapping') {
                if (samePort && port !== Number(arg('NewInternalPort'))) {
                    fault(724);
                    return;
                }
                if (failures.length) {
                    fault(failures.shift()!);
                    return;
                }
                table.set(
                    port,
                    elsewhere.includes(port)
                        ? OTHER
                        : {
                              client: arg('NewInternalClient'),
                              port: Number(arg('NewInternalPort')),
                          },
                );
                answer();
            } else if (action === 'GetSpecificPortMappingEntry') {
                const entry = table.get(port);
                if (blind) fault(401);
                else if (!entry) fault(714);
                else
                    answer(
                        `<NewInternalPort>${entry.port}</NewInternalPort><NewInternalClient>${entry.client}</NewInternalClient><NewEnabled>1</NewEnabled>`,
                    );
            } else if (action === 'DeletePortMapping') {
                table.delete(port);
                answer();
            } else {
                fault(401);
            }
        });
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const gateway: RouterGateway = {
        controlUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/ctl/IPConn`,
        serviceType: SERVICE,
        localAddress: '192.168.1.3',
    };
    const addedPorts = () => {
        return calls
            .filter((call) => call.action === 'AddPortMapping')
            .map((call) => {
                return Number(/<NewExternalPort>(\d+)</.exec(call.body)?.[1]);
            });
    };
    return { calls, gateway, table, addedPorts };
}

test('reads only the router’s own WAN services, IP before PPP', () => {
    const xml = `<root><URLBase>http://192.168.1.1:5000/</URLBase><device>
        <service><serviceType>urn:schemas-upnp-org:service:WANPPPConnection:1</serviceType><controlURL>/ppp</controlURL></service>
        <service><serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType><controlURL>/l3</controlURL></service>
        <service><serviceType>${SERVICE}</serviceType><controlURL>/ip?a=1&amp;b=2</controlURL></service>
        <service><serviceType>${SERVICE}</serviceType><controlURL>http://203.0.113.9/elsewhere</controlURL></service>
    </device></root>`;
    expect(
        readRouterServices(
            xml,
            'http://192.168.1.1:5000/desc.xml',
            '192.168.1.3',
        ),
    ).toEqual([
        {
            controlUrl: 'http://192.168.1.1:5000/ip?a=1&b=2',
            serviceType: SERVICE,
            localAddress: '192.168.1.3',
        },
        {
            controlUrl: 'http://192.168.1.1:5000/ppp',
            serviceType: 'urn:schemas-upnp-org:service:WANPPPConnection:1',
            localAddress: '192.168.1.3',
        },
    ]);
});

test('maps the same port, steps past a taken one, and falls back to a permanent lease', async () => {
    const router = await fakeRouter();
    expect(await getRouterExternalAddress(router.gateway)).toBe('203.0.113.10');
    const mapping = await openRouterPort(router.gateway, 39241, '203.0.113.10');
    expect(mapping).toMatchObject({
        externalAddress: '203.0.113.10',
        externalPort: 39241,
        internalPort: 39241,
        leaseSeconds: 3600,
    });
    const add = router.calls.find((call) => call.action === 'AddPortMapping');
    expect(add?.body).toContain('<NewInternalClient>192.168.1.3<');
    expect(add?.body).toContain('<NewProtocol>TCP<');

    // 718: another computer holds 39241; 725: only permanent leases.
    const busy = await fakeRouter({ failures: [718, 725] });
    const moved = await openRouterPort(busy.gateway, 39241, '203.0.113.10');
    expect(moved.externalPort).not.toBe(39241);
    expect(moved.leaseSeconds).toBe(0);

    await renewRouterPort(mapping);
    await closeRouterPort(mapping);
    expect(router.calls.map((call) => call.action)).toEqual([
        'GetExternalIPAddress',
        // Free, mapped, and then read back as this computer's.
        'GetSpecificPortMappingEntry',
        'AddPortMapping',
        'GetSpecificPortMappingEntry',
        'GetSpecificPortMappingEntry',
        'AddPortMapping',
        'GetSpecificPortMappingEntry',
        'DeletePortMapping',
    ]);
    expect(router.table.size).toBe(0);

    const refusing = await fakeRouter({ failures: Array(8).fill(606) });
    await expect(
        openRouterPort(refusing.gateway, 39241, '203.0.113.10'),
    ).rejects.toMatchObject({ code: 606 });
    expect(new Set(refusing.addedPorts()).size).toBe(8);
});

test('a port the router will not have, for any reason, moves to another', async () => {
    // 606 (not allowed), 729 (kept for something else), 501 (failed).
    const picky = await fakeRouter({ failures: [606, 729, 501] });
    const mapping = await openRouterPort(picky.gateway, 39241, '203.0.113.10', {
        preferredPort: 40500,
    });
    expect(picky.addedPorts().slice(0, 2)).toEqual([40500, 39241]);
    expect(picky.addedPorts()).toHaveLength(4);
    expect(picky.table.get(mapping.externalPort)).toEqual({
        client: '192.168.1.3',
        port: 39241,
    });

    // A router that maps a port only to the same port is asked for no other.
    const same = await fakeRouter({ samePort: true });
    const sameMapping = await openRouterPort(
        same.gateway,
        39241,
        '203.0.113.10',
        { preferredPort: 40500 },
    );
    expect(sameMapping.externalPort).toBe(39241);
    expect(same.addedPorts()).toEqual([40500, 39241]);
});

test('the public address is looked up only as bare IPv4 text from the internet side', async () => {
    let answer = '203.0.113.10\n';
    const server = http.createServer((_req, res) => {
        res.writeHead(200).end(answer);
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    expect(await lookUpPublicAddress(url)).toBe('203.0.113.10');
    answer = '192.168.1.3';
    expect(await lookUpPublicAddress(url)).toBe('');
    answer = '<html>hello</html>';
    expect(await lookUpPublicAddress(url)).toBe('');
    expect(await lookUpPublicAddress('http://127.0.0.1:1/')).toBe('');
});

test('never asks for a port another computer holds, nor trusts a yes that leaves it there', async () => {
    const held = await fakeRouter({ table: new Map([[39241, OTHER]]) });
    const mapping = await openRouterPort(held.gateway, 39241, '203.0.113.10');
    expect(mapping.externalPort).not.toBe(39241);
    // Asking would hand some routers the other computer's port.
    expect(held.addedPorts()).not.toContain(39241);
    expect(held.table.get(39241)).toEqual(OTHER);
    expect(held.table.get(mapping.externalPort)).toEqual({
        client: '192.168.1.3',
        port: 39241,
    });

    const lying = await fakeRouter({ elsewhere: [39241] });
    const moved = await openRouterPort(lying.gateway, 39241, '203.0.113.10');
    expect(moved.externalPort).not.toBe(39241);
    expect(lying.addedPorts()[0]).toBe(39241);
    // Not this computer's to remove.
    expect(lying.table.get(39241)).toEqual(OTHER);
});

test('a public side that answers for someone else moves to another port', async () => {
    const router = await fakeRouter();
    const reached: number[] = [];
    const mapping = await openRouterPort(
        router.gateway,
        39241,
        '203.0.113.10',
        {
            reach: async (port) => {
                reached.push(port);
                return port === 39241 ? 'other' : 'unknown';
            },
        },
    );
    expect(reached).toEqual([39241, mapping.externalPort]);
    expect(mapping.externalPort).not.toBe(39241);
    // Its own entry on the port that leads elsewhere goes.
    expect(router.table.has(39241)).toBe(false);

    // A router that will not say whose an entry is keeps it: it may be the
    // very one that leads to the other computer.
    const blind = await fakeRouter({ blind: true });
    const blindMapping = await openRouterPort(
        blind.gateway,
        39241,
        '203.0.113.10',
        {
            reach: async (port) => (port === 39241 ? 'other' : 'this'),
        },
    );
    expect(blindMapping.externalPort).not.toBe(39241);
    expect(
        blind.calls.some((call) => call.action === 'DeletePortMapping'),
    ).toBe(false);
});

test('renewing notices a port gone elsewhere, and closing leaves another computer’s mapping', async () => {
    const router = await fakeRouter({ table: new Map([[40001, OTHER]]) });
    const mapping = {
        ...router.gateway,
        externalAddress: '203.0.113.10',
        externalPort: 40001,
        internalPort: 39241,
        leaseSeconds: 3600,
    };
    await expect(renewRouterPort(mapping)).rejects.toMatchObject({
        code: 718,
    });
    await closeRouterPort(mapping);
    expect(router.table.get(40001)).toEqual(OTHER);
    // Another app on this computer holds it on its own port.
    router.table.set(40001, { client: '192.168.1.3', port: 39240 });
    await closeRouterPort(mapping);
    expect(router.table.has(40001)).toBe(true);

    // A permanent lease has nothing to renew while it is still this
    // computer's, and is mapped again once it is gone.
    const permanent = { ...mapping, leaseSeconds: 0 };
    router.table.set(40001, { client: '192.168.1.3', port: 39241 });
    await renewRouterPort(permanent);
    expect(router.addedPorts()).toEqual([]);
    router.table.delete(40001);
    await renewRouterPort(permanent);
    expect(router.addedPorts()).toEqual([40001]);
    await closeRouterPort(permanent);
    expect(router.table.has(40001)).toBe(false);

    // A router that will not say is asked to remove it, as before.
    const blind = await fakeRouter({ blind: true });
    await closeRouterPort({ ...blind.gateway, externalPort: 40001 });
    expect(
        blind.calls.some((call) => call.action === 'DeletePortMapping'),
    ).toBe(true);
});

test('the probe tells this computer’s server from anything else on the port', async () => {
    const server = http.createServer((req, res) => {
        res.writeHead(200).end(
            req.url === `${ROUTER_PROBE_PATH}token-1` ? 'token-1' : 'hello',
        );
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as AddressInfo).port;
    expect(await probeRouterPort('127.0.0.1', port, 'token-1')).toBe('this');
    expect(await probeRouterPort('127.0.0.1', port, 'token-2')).toBe('other');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    servers.splice(servers.indexOf(server), 1);
    // Nothing answering is not a verdict: many routers do not loop back.
    expect(await probeRouterPort('127.0.0.1', port, 'token-1')).toBe('unknown');
});

test('a remembered mapping is trusted only on a router of this network', () => {
    const value = (controlUrl: string) =>
        JSON.stringify({ controlUrl, serviceType: SERVICE, externalPort: 1 });
    expect(readRouterMapping(value('http://192.168.1.1:5000/ctl'))).toEqual({
        controlUrl: 'http://192.168.1.1:5000/ctl',
        serviceType: SERVICE,
        externalPort: 1,
    });
    expect(
        readRouterMapping(
            JSON.stringify({
                controlUrl: 'http://192.168.1.1:5000/ctl',
                serviceType: SERVICE,
                externalPort: 40001,
                internalPort: 39241,
            }),
        ),
    ).toMatchObject({ externalPort: 40001, internalPort: 39241 });
    expect(readRouterMapping(value('http://203.0.113.9/ctl'))).toBeNull();
    expect(readRouterMapping(value('file:///etc/passwd'))).toBeNull();
    expect(readRouterMapping('not json')).toBeNull();
    expect(readRouterMapping(null)).toBeNull();
});
