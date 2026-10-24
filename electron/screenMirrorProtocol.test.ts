import { describe, expect, test } from 'vitest';
import {
    isMirrorScreenMessage,
    readMirrorPacket,
    readMirrorDiscovery,
    readMirrorDisplays,
    readMirrorCameras,
    rankMirrorAddress,
    sortMirrorHosts,
    readMirrorIpv6,
    readMirrorIpv4,
    toMirrorPlainAddress,
    isMirrorLanAddress,
    isMirrorGlobalIpv6,
    toMirrorSenderKey,
    toMirrorHostPort,
    readMirrorAddressText,
    readMirrorOrigin,
    toMirrorAddressText,
    toMirrorDefaultPort,
} from './screenMirrorProtocol';

describe('mirror wire validation', () => {
    test('rebuilds discovery records and rejects malformed fields before sorting', () => {
        const valid = {
            service: 'owa-screen-mirror',
            protocol: 1,
            id: 'host-1',
            name: 'Host',
            version: '2026.10.01',
            port: 39240,
        };
        expect(
            readMirrorDiscovery({ ...valid, host: 'untrusted', extra: true }),
        ).toEqual(valid);
        for (const value of [
            null,
            [],
            {},
            { ...valid, id: '' },
            { ...valid, id: 'x'.repeat(257) },
            { ...valid, name: 1 },
            { ...valid, name: 'x'.repeat(257) },
            { ...valid, version: null },
            { ...valid, protocol: 2 },
            { ...valid, service: 'other' },
            { ...valid, port: '39240' },
            { ...valid, port: 1.5 },
            { ...valid, port: 65536 },
        ]) {
            expect(readMirrorDiscovery(value)).toBeNull();
        }
        const reached = {
            ...valid,
            service: 'owa-screen-mirror' as const,
            host: '192.168.1.2',
        };
        expect(
            sortMirrorHosts([
                reached,
                { ...reached, name: null } as any,
                { ...reached, host: {} } as any,
                null as any,
            ]),
        ).toEqual([reached]);
    });

    test('requires the protocol version and known screen channels', () => {
        expect(readMirrorPacket('{"protocol":1,"type":"hello"}')).toEqual({
            protocol: 1,
            type: 'hello',
        });
        expect(readMirrorPacket('{"protocol":2,"type":"hello"}')).toBeNull();
        expect(readMirrorPacket('not json')).toBeNull();
        expect(
            isMirrorScreenMessage({
                screenId: 1,
                type: 'background',
                data: null,
            }),
        ).toBe(true);
        expect(
            isMirrorScreenMessage({
                screenId: 1,
                type: 'main:app:client-setting',
            }),
        ).toBe(false);
        expect(isMirrorScreenMessage({ screenId: -1, type: 'draw' })).toBe(
            false,
        );
    });
    test('rejects malformed and duplicate display records and strips extra fields', () => {
        const display = {
            id: 7,
            bounds: { x: 0, y: 0, width: 1024, height: 768 },
            label: '',
            scaleFactor: 1,
            isPrimary: true,
            guestId: 'spoof',
        };
        expect(
            readMirrorDisplays([
                display,
                display,
                { ...display, id: 8, bounds: { ...display.bounds, width: -1 } },
            ]),
        ).toEqual([
            {
                id: 7,
                bounds: display.bounds,
                label: '',
                scaleFactor: 1,
                isPrimary: true,
            },
        ]);
        expect(
            readMirrorCameras([
                { deviceId: 'device', label: 'Camera', groupId: 'private' },
            ]),
        ).toEqual([{ deviceId: 'device', label: 'Camera', groupId: '' }]);
    });
});

describe('choosing the address a scanned host is offered on', () => {
    test('a real LAN beats a virtual adapter, link-local and loopback', () => {
        const ranked = [
            '127.0.0.1',
            '169.254.10.2',
            '172.20.240.1',
            '10.0.0.7',
            '192.168.1.5',
        ].sort((a, b) => rankMirrorAddress(a) - rankMirrorAddress(b));
        expect(ranked).toEqual([
            '192.168.1.5',
            '10.0.0.7',
            '172.20.240.1',
            '169.254.10.2',
            '127.0.0.1',
        ]);
        // 172.32 is outside the private 172.16/12 block.
        expect(rankMirrorAddress('172.32.0.1')).toBe(3);
    });

    test('the scan answer lists the best-reached host first', () => {
        const toHost = (id: string, host: string, name: string) => ({
            service: 'owa-screen-mirror' as const,
            protocol: 1,
            id,
            name,
            version: '1',
            port: 39240,
            host,
        });
        const hosts = [
            toHost('a', '172.20.240.1', 'Hall'),
            toHost('b', '192.168.1.9', 'Sanctuary'),
            toHost('c', '192.168.1.5', 'Lobby'),
        ];
        expect(sortMirrorHosts(hosts).map((item) => item.id)).toEqual([
            'c',
            'b',
            'a',
        ]);
        expect(hosts[0].id).toBe('a');
    });
});

describe('mirror addresses', () => {
    test('reads IPv6 in every written form and IPv4 mapped into it', () => {
        expect(readMirrorIpv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
        expect(readMirrorIpv6('[2001:db8::5]')).toEqual([
            0x2001, 0xdb8, 0, 0, 0, 0, 0, 5,
        ]);
        expect(readMirrorIpv6('fe80::1%12')).toEqual([
            0xfe80, 0, 0, 0, 0, 0, 0, 1,
        ]);
        expect(readMirrorIpv6('::ffff:192.168.1.5')).toEqual([
            0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0105,
        ]);
        expect(readMirrorIpv6('1:2:3:4:5:6:7:8:9')).toBeNull();
        expect(readMirrorIpv6('1::2::3')).toBeNull();
        expect(readMirrorIpv6('192.168.1.5')).toBeNull();
        expect(readMirrorIpv4('::ffff:10.0.0.7')).toEqual([10, 0, 0, 7]);
        expect(readMirrorIpv4('10.0.0.256')).toBeNull();
        expect(toMirrorPlainAddress('::ffff:192.168.1.5')).toBe('192.168.1.5');
        expect(toMirrorPlainAddress('2001:db8::5')).toBe('2001:db8::5');
    });
    test('tells this computer’s own networks from the internet', () => {
        for (const address of [
            '127.0.0.1',
            '::ffff:192.168.1.5',
            '10.1.2.3',
            '172.20.240.1',
            '169.254.9.9',
            '100.101.102.103',
            '::1',
            'fd12:3456::1',
            'fe80::1%4',
        ])
            expect(isMirrorLanAddress(address), address).toBe(true);
        for (const address of [
            '203.0.113.10',
            '172.32.0.1',
            '100.128.0.1',
            '2001:db8::5',
            '::ffff:8.8.8.8',
            'not an address',
        ])
            expect(isMirrorLanAddress(address), address).toBe(false);
        expect(isMirrorGlobalIpv6('2606:4700::1111')).toBe(true);
        expect(isMirrorGlobalIpv6('fd12::1')).toBe(false);
        expect(isMirrorGlobalIpv6('::ffff:8.8.8.8')).toBe(false);
    });
    test('counts wrong codes per IPv4 address and per IPv6 /64', () => {
        expect(toMirrorSenderKey('::ffff:203.0.113.10')).toBe('203.0.113.10');
        expect(toMirrorSenderKey('2001:db8:1:2:aaaa::1')).toBe(
            toMirrorSenderKey('2001:db8:1:2:bbbb::9'),
        );
        expect(toMirrorSenderKey('2001:db8:1:2::1')).not.toBe(
            toMirrorSenderKey('2001:db8:1:3::1'),
        );
    });
    test('writes and reads addresses the way a person types them', () => {
        expect(toMirrorHostPort('192.168.1.3', 39241)).toBe(
            '192.168.1.3:39241',
        );
        expect(toMirrorHostPort('2001:db8::5', 39241)).toBe(
            '[2001:db8::5]:39241',
        );
        expect(toMirrorHostPort('[2001:db8::5]', 1)).toBe('[2001:db8::5]:1');
        expect(readMirrorAddressText(' 192.168.1.3:39241 ')).toEqual({
            host: '192.168.1.3',
            port: 39241,
        });
        expect(readMirrorAddressText('[2001:db8::5]:39241')).toEqual({
            host: '2001:db8::5',
            port: 39241,
        });
        expect(readMirrorAddressText('2001:db8::5')).toEqual({
            host: '2001:db8::5',
            port: null,
        });
        expect(readMirrorAddressText('http://Church.example:8080/x')).toEqual({
            host: 'church.example',
            port: 8080,
        });
        expect(readMirrorAddressText('church.example')).toEqual({
            host: 'church.example',
            port: null,
        });
        expect(readMirrorAddressText('')).toBeNull();
        expect(readMirrorAddressText('a b')).toBeNull();
        expect(readMirrorAddressText('ftp://x.example')).toBeNull();
        expect(readMirrorAddressText('http://user@x.example')).toBeNull();
        expect(readMirrorAddressText('x.example:70000')).toBeNull();
        // A tunnel's address is a whole https link with no port: 443.
        expect(
            readMirrorAddressText('https://quiet-river.trycloudflare.com/'),
        ).toEqual({ host: 'quiet-river.trycloudflare.com', port: 443 });
        expect(readMirrorAddressText('wss://x.example')).toEqual({
            host: 'x.example',
            port: 443,
        });
        expect(readMirrorAddressText('https://x.example:8443')).toEqual({
            host: 'x.example',
            port: 8443,
        });
    });
    // With the port box left empty a guest dials a tunnel's 443, or Screen
    // Mirror's own first port.
    test('a host with no port is dialled on its default', () => {
        expect(toMirrorDefaultPort('quiet-river.trycloudflare.com')).toBe(443);
        expect(toMirrorDefaultPort(' QUIET.TRYCLOUDFLARE.COM ')).toBe(443);
        expect(toMirrorDefaultPort('trycloudflare.com.evil.example')).toBe(
            39240,
        );
        expect(toMirrorDefaultPort('192.168.1.3')).toBe(39240);
        expect(
            toMirrorAddressText({
                host: 'quiet-river.trycloudflare.com',
                port: 443,
                kind: 'tunnel',
            }),
        ).toBe('https://quiet-river.trycloudflare.com');
        expect(toMirrorAddressText({ host: '2001:db8::5', port: 39241 })).toBe(
            '[2001:db8::5]:39241',
        );
    });
    test('reads the origin a guest dialled from its Host header', () => {
        expect(readMirrorOrigin('203.0.113.10:40001')).toBe(
            'http://203.0.113.10:40001',
        );
        expect(readMirrorOrigin('[2001:db8::5]:39241')).toBe(
            'http://[2001:db8::5]:39241',
        );
        expect(readMirrorOrigin('church.example')).toBe(
            'http://church.example',
        );
        expect(readMirrorOrigin('evil.example/path')).toBeNull();
        expect(readMirrorOrigin('a@b.example')).toBeNull();
        expect(readMirrorOrigin('b.example:99999')).toBeNull();
        expect(readMirrorOrigin(undefined)).toBeNull();
        // Through the tunnel the guest dialled https.
        expect(readMirrorOrigin('quiet-river.trycloudflare.com', true)).toBe(
            'https://quiet-river.trycloudflare.com',
        );
    });
});
