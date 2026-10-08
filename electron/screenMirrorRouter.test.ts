import { afterEach, expect, test } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
    closeRouterPort,
    getRouterExternalAddress,
    openRouterPort,
    readRouterMapping,
    readRouterServices,
    renewRouterPort,
    type RouterGateway,
} from './screenMirrorRouter';

const SERVICE = 'urn:schemas-upnp-org:service:WANIPConnection:1';
const servers: http.Server[] = [];
afterEach(async () => {
    for (const server of servers.splice(0))
        await new Promise<void>((resolve) => server.close(() => resolve()));
});

// A router that answers the SOAP actions it is sent, failing AddPortMapping
// with the codes a test lines up.
async function fakeRouter(failures: number[] = []) {
    const calls: { action: string; body: string }[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            const action = /#(\w+)"$/.exec(String(req.headers.soapaction))?.[1];
            calls.push({ action: action ?? '', body });
            if (action === 'AddPortMapping' && failures.length) {
                res.writeHead(500).end(
                    `<s:Envelope><s:Body><s:Fault><detail><UPnPError><errorCode>${failures.shift()}</errorCode><errorDescription>No</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>`,
                );
                return;
            }
            res.writeHead(200).end(
                action === 'GetExternalIPAddress'
                    ? `<s:Envelope><s:Body><u:GetExternalIPAddressResponse><NewExternalIPAddress>203.0.113.10</NewExternalIPAddress></u:GetExternalIPAddressResponse></s:Body></s:Envelope>`
                    : '<s:Envelope><s:Body/></s:Envelope>',
            );
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
    return { calls, gateway };
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
    const busy = await fakeRouter([718, 725]);
    const moved = await openRouterPort(busy.gateway, 39241, '203.0.113.10');
    expect(moved.externalPort).not.toBe(39241);
    expect(moved.leaseSeconds).toBe(0);

    await renewRouterPort(mapping);
    await closeRouterPort(mapping);
    expect(router.calls.map((call) => call.action)).toEqual([
        'GetExternalIPAddress',
        'AddPortMapping',
        'AddPortMapping',
        'DeletePortMapping',
    ]);

    const refusing = await fakeRouter([606]);
    await expect(
        openRouterPort(refusing.gateway, 39241, '203.0.113.10'),
    ).rejects.toMatchObject({ code: 606 });
});

test('a remembered mapping is trusted only on a router of this network', () => {
    const value = (controlUrl: string) =>
        JSON.stringify({ controlUrl, serviceType: SERVICE, externalPort: 1 });
    expect(readRouterMapping(value('http://192.168.1.1:5000/ctl'))).toEqual({
        controlUrl: 'http://192.168.1.1:5000/ctl',
        serviceType: SERVICE,
        externalPort: 1,
    });
    expect(readRouterMapping(value('http://203.0.113.9/ctl'))).toBeNull();
    expect(readRouterMapping(value('file:///etc/passwd'))).toBeNull();
    expect(readRouterMapping('not json')).toBeNull();
    expect(readRouterMapping(null)).toBeNull();
});
