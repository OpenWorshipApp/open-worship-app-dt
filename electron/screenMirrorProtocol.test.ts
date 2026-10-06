import { describe, expect, test } from 'vitest';
import {
    isMirrorScreenMessage,
    readMirrorPacket,
    readMirrorDisplays,
    readMirrorCameras,
    rankMirrorAddress,
    sortMirrorHosts,
} from './screenMirrorProtocol';

describe('mirror wire validation', () => {
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
