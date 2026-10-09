import { describe, expect, test } from 'vitest';

import type { VirtualDisplayAddress } from '../../electron/virtualDisplayProtocol';
import {
    splitVirtualDisplayAddresses,
    toViewerDeviceLabel,
} from './virtualDisplayAddressHelpers';

const address = (
    host: string,
    kind: VirtualDisplayAddress['kind'],
): VirtualDisplayAddress => {
    return { host, port: 39240, kind };
};

describe('splitVirtualDisplayAddresses', () => {
    // Seen on the dev laptop: a VPN, WSL and Hyper-V beside the real LAN.
    const thisComputer = address('127.0.0.1', 'this-computer');
    const hyperV = address('172.18.192.1', 'lan');
    const vpn = address('10.2.0.2', 'lan');
    const home = address('192.168.1.3', 'lan');
    const wsl = address('172.27.128.1', 'lan');

    test('leads with the best network, folds the rest', () => {
        const { main, others } = splitVirtualDisplayAddresses([
            thisComputer,
            hyperV,
            vpn,
            home,
            wsl,
        ]);
        expect(main).toEqual([home]);
        expect(others).toEqual([thisComputer, hyperV, vpn, wsl]);
    });

    test('every internet address opened on purpose is offered too', () => {
        const router = address('203.0.113.7', 'router');
        const tunnel = address('quick.trycloudflare.com', 'tunnel');
        const { main } = splitVirtualDisplayAddresses([
            thisComputer,
            home,
            router,
            tunnel,
        ]);
        expect(main).toEqual([home, router, tunnel]);
    });

    test('with sharing off, this computer is all there is', () => {
        const { main, others } = splitVirtualDisplayAddresses([thisComputer]);
        expect(main).toEqual([thisComputer]);
        expect(others).toEqual([]);
    });
});

describe('toViewerDeviceLabel', () => {
    test.each([
        [
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
            'Chrome · Android',
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
            'Safari · iPhone',
        ],
        [
            'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/94.0 TV Safari/537.36',
            'Samsung Internet · TV',
        ],
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
            'Edge · Windows',
        ],
        ['VLC/3.0.21 LibVLC/3.0.21', 'VLC'],
        ['Lavf/61.1.100', 'FFmpeg'],
    ])('%s', (userAgent, label) => {
        expect(toViewerDeviceLabel(userAgent)).toBe(label);
    });

    test('nothing to say about an unknown or missing agent', () => {
        expect(toViewerDeviceLabel(undefined)).toBe('');
        expect(toViewerDeviceLabel('curl/8.0')).toBe('');
    });
});
