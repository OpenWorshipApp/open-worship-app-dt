import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { MIRROR_REMOTE_DISPLAY_FIRST } from './screenMirrorProtocol';
import {
    readBasicAuthPassword,
    readVirtualDisplayAccessMode,
    MAX_VIRTUAL_DISPLAYS,
    VIRTUAL_DISPLAY_MAX_PIXELS,
    checkIsVirtualDisplayDevViewerFile,
    clampResolution,
    isVirtualDisplayId,
    listVirtualDisplayVideoCodecs,
    parseVirtualDisplayPath,
    parseVirtualDisplayStreamPath,
    readVirtualDisplaySetting,
    sanitizeVirtualDisplayName,
    sanitizeVirtualDisplayRecord,
    sanitizeWallpaper,
    toVirtualDisplayBitrate,
    toVirtualDisplayId,
    toVirtualDisplayNumber,
    toVirtualDisplayPageUrl,
    toVirtualDisplayStreamUrl,
} from './virtualDisplayProtocol';

describe('virtualDisplayProtocol', () => {
    test('ids sit between real monitors and Screen Mirror guests', () => {
        expect(toVirtualDisplayId(1)).toBe(-500001);
        expect(toVirtualDisplayNumber(-500001)).toBe(1);
        expect(isVirtualDisplayId(-500001)).toBe(true);
        expect(isVirtualDisplayId(-500000)).toBe(false);
        // Neither a real monitor nor a guest's is ever taken for one.
        expect(isVirtualDisplayId(2528732444)).toBe(false);
        expect(isVirtualDisplayId(MIRROR_REMOTE_DISPLAY_FIRST)).toBe(false);
        expect(isVirtualDisplayId(MIRROR_REMOTE_DISPLAY_FIRST - 3)).toBe(false);
        expect(isVirtualDisplayId('-500001')).toBe(false);
        expect(toVirtualDisplayNumber(15)).toBeNull();
    });

    test('a resolution is clamped, made even and kept under 4K pixels', () => {
        expect(clampResolution(1921, 1081)).toEqual({
            width: 1922,
            height: 1082,
        });
        expect(clampResolution(10, 99999)).toEqual({
            width: 160,
            height: 3840,
        });
        expect(clampResolution('abc', null)).toEqual({
            width: 1920,
            height: 1080,
        });
        const { width, height } = clampResolution(3840, 3840);
        expect(width * height).toBeLessThanOrEqual(3840 * 2160);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
        // Portrait 4K is allowed as it is.
        expect(clampResolution(2160, 3840)).toEqual({
            width: 2160,
            height: 3840,
        });
    });

    test('a wallpaper is a colour, an image or a video file, else none', () => {
        expect(sanitizeWallpaper({ kind: 'color', color: '#AABBCC' })).toEqual({
            kind: 'color',
            color: '#aabbcc',
        });
        expect(sanitizeWallpaper({ kind: 'color', color: 'red' })).toEqual({
            kind: 'none',
        });
        expect(
            sanitizeWallpaper({ kind: 'image', filePath: 'C:\\a\\b.JPG' }),
        ).toEqual({ kind: 'image', filePath: 'C:\\a\\b.JPG' });
        expect(
            sanitizeWallpaper({ kind: 'video', filePath: '/home/a/loop.mp4' }),
        ).toEqual({ kind: 'video', filePath: '/home/a/loop.mp4' });
        // A relative path, a wrong extension, or a page are refused.
        expect(sanitizeWallpaper({ kind: 'image', filePath: 'b.png' })).toEqual(
            { kind: 'none' },
        );
        expect(
            sanitizeWallpaper({ kind: 'video', filePath: '/a/setting.json' }),
        ).toEqual({ kind: 'none' });
        expect(
            sanitizeWallpaper({ kind: 'image', filePath: '/a/page.html' }),
        ).toEqual({ kind: 'none' });
        expect(sanitizeWallpaper(null)).toEqual({ kind: 'none' });
    });

    test('a name is trimmed and capped, with a fallback', () => {
        expect(sanitizeVirtualDisplayName('  Lobby   TV  ', 2)).toBe(
            'Lobby TV',
        );
        expect(sanitizeVirtualDisplayName('', 2)).toBe('Virtual Display 2');
        expect(sanitizeVirtualDisplayName('x'.repeat(200), 2)).toHaveLength(64);
    });

    test('the stored list drops what it cannot use and never reuses a number', () => {
        const setting = readVirtualDisplaySetting(
            JSON.stringify({
                nextNumber: 2,
                list: [
                    { number: 1, name: 'A', width: 1280, height: 720 },
                    { number: 1, name: 'Twin', width: 1280, height: 720 },
                    { number: 'x', name: 'Bad' },
                    { number: 5, name: 'B', width: 640, height: 480 },
                ],
            }),
        );
        expect(setting.list.map((item) => item.number)).toEqual([1, 5]);
        // Never below what is in use.
        expect(setting.nextNumber).toBe(6);
        expect(readVirtualDisplaySetting('not json')).toEqual({
            nextNumber: 1,
            list: [],
        });
        const many = readVirtualDisplaySetting(
            JSON.stringify({
                list: Array.from({ length: 20 }, (_, i) => ({ number: i + 1 })),
            }),
        );
        expect(many.list).toHaveLength(MAX_VIRTUAL_DISPLAYS);
    });

    test('the stream path is /vd/<number>/video and nothing else', () => {
        expect(parseVirtualDisplayStreamPath('/vd/1/video')).toBe(1);
        expect(parseVirtualDisplayStreamPath('/vd/12/video')).toBe(12);
        expect(parseVirtualDisplayStreamPath('/vd/0/video')).toBeNull();
        expect(parseVirtualDisplayStreamPath('/vd/1/video/x')).toBeNull();
        expect(parseVirtualDisplayStreamPath('/vd/../video')).toBeNull();
        expect(
            toVirtualDisplayStreamUrl({ host: '192.168.1.3', port: 39240 }, 1),
        ).toBe('http://192.168.1.3:39240/vd/1/video');
        expect(
            toVirtualDisplayStreamUrl({ host: '2001:db8::1', port: 39240 }, 2),
        ).toBe('http://[2001:db8::1]:39240/vd/2/video');
    });

    test('the page, the MP4 and a viewer socket, and nothing else', () => {
        expect(parseVirtualDisplayPath('/vd/3/')).toEqual({
            number: 3,
            kind: 'page',
        });
        expect(parseVirtualDisplayPath('/vd/3')).toEqual({
            number: 3,
            kind: 'page',
        });
        expect(parseVirtualDisplayPath('/vd/3/video')).toEqual({
            number: 3,
            kind: 'video',
        });
        expect(parseVirtualDisplayPath('/vd/3/ws')).toEqual({
            number: 3,
            kind: 'ws',
        });
        expect(parseVirtualDisplayPath('/vd/3/other')).toBeNull();
        expect(parseVirtualDisplayPath('/vd/0/')).toBeNull();
        expect(
            toVirtualDisplayPageUrl({ host: '192.168.1.3', port: 39240 }, 3),
        ).toBe('http://192.168.1.3:39240/vd/3/');
        // A tunnel address is https on its default port.
        const tunnel = {
            host: 'quiet-river.trycloudflare.com',
            port: 443,
            kind: 'tunnel',
        };
        expect(toVirtualDisplayPageUrl(tunnel, 3)).toBe(
            'https://quiet-river.trycloudflare.com/vd/3/',
        );
        expect(toVirtualDisplayStreamUrl(tunnel, 3)).toBe(
            'https://quiet-river.trycloudflare.com/vd/3/video',
        );
    });

    test('H.264 High, Main then Baseline, at the level the size needs', () => {
        expect(listVirtualDisplayVideoCodecs(1920, 1080)).toEqual([
            'avc1.640028',
            'avc1.4D0028',
            'avc1.42E028',
        ]);
        expect(listVirtualDisplayVideoCodecs(3840, 2160)[0]).toBe(
            'avc1.640033',
        );
        expect(toVirtualDisplayBitrate(1920, 1080, 30)).toBe(4354560);
        expect(toVirtualDisplayBitrate(3840, 2160, 30)).toBe(8000000);
        expect(toVirtualDisplayBitrate(160, 160, 30)).toBe(800000);
    });
});

describe('virtualDisplayProtocol edges', () => {
    test('a path names a display of 1 to 4 digits and one of three kinds', () => {
        expect(parseVirtualDisplayPath('/vd/1')).toEqual({
            number: 1,
            kind: 'page',
        });
        expect(parseVirtualDisplayPath('/vd/1/')).toEqual({
            number: 1,
            kind: 'page',
        });
        expect(parseVirtualDisplayPath('/vd/1/video')).toEqual({
            number: 1,
            kind: 'video',
        });
        expect(parseVirtualDisplayPath('/vd/1/ws')).toEqual({
            number: 1,
            kind: 'ws',
        });
        expect(parseVirtualDisplayPath('/vd/9999/')).toEqual({
            number: 9999,
            kind: 'page',
        });
        for (const path of [
            '/vd/x',
            '/vd/x/',
            '/vd/12345',
            '/vd/12345/video',
            '/vd/-1/',
            '/vd/1.5/',
            '/vd/1/ws/',
            '/vd/1/video/',
            '/vd/1//',
            '/VD/1/',
            '/vd/',
            '/vd',
            '/x/vd/1/',
        ]) {
            expect(parseVirtualDisplayPath(path)).toBeNull();
        }
        expect(parseVirtualDisplayStreamPath('/vd/12345/video')).toBeNull();
        expect(parseVirtualDisplayStreamPath('/vd/1/')).toBeNull();
    });

    test('the codec level changes just above 1080p, by pixels not by side', () => {
        expect(listVirtualDisplayVideoCodecs(1920, 1080)[0]).toBe(
            'avc1.640028',
        );
        expect(listVirtualDisplayVideoCodecs(1080, 1920)[0]).toBe(
            'avc1.640028',
        );
        expect(listVirtualDisplayVideoCodecs(1922, 1080)).toEqual([
            'avc1.640033',
            'avc1.4D0033',
            'avc1.42E033',
        ]);
    });

    test('the bitrate stays between 0.8 and 8 Mbps', () => {
        expect(toVirtualDisplayBitrate(1280, 720, 30)).toBe(1935360);
        expect(toVirtualDisplayBitrate(1, 1, 1)).toBe(800_000);
        expect(toVirtualDisplayBitrate(0, 0, 0)).toBe(800_000);
        expect(toVirtualDisplayBitrate(3840, 2160, 60)).toBe(8_000_000);
        expect(
            Number.isInteger(toVirtualDisplayBitrate(1001, 1003, 29.97)),
        ).toBe(true);
    });

    test('a stored record needs a whole number from 1 to 9999', () => {
        for (const number of [0, -1, 1.5, 10000, '', null]) {
            expect(sanitizeVirtualDisplayRecord({ number })).toBeNull();
        }
        expect(sanitizeVirtualDisplayRecord('x')).toBeNull();
        expect(sanitizeVirtualDisplayRecord({ number: '7' })).toEqual({
            number: 7,
            name: 'Virtual Display 7',
            width: 1920,
            height: 1080,
            wallpaper: { kind: 'none' },
        });
    });

    test('the stored next number is kept only above every number in use', () => {
        const read = (nextNumber: unknown) => {
            return readVirtualDisplaySetting(
                JSON.stringify({ nextNumber, list: [{ number: 4 }] }),
            ).nextNumber;
        };
        expect(read(9)).toBe(9);
        expect(read(4)).toBe(5);
        expect(read(2.5)).toBe(5);
        expect(read('x')).toBe(5);
        expect(read(123456)).toBe(9999);
    });

    // The scale-down floors each side to an even number. Flooring and then
    // rounding to even rounded an odd side UP and passed the cap:
    // clampResolution(3841, 3000) gave 3258 x 2546 = 8294868 > 8294400.
    test('a scaled-down size never passes the 4K pixel cap', () => {
        for (const [width, height] of [
            [3841, 3000],
            [2171, 3840],
            [3840, 3840],
            [3000, 3000],
        ]) {
            const size = clampResolution(width, height);
            expect(size.width % 2).toBe(0);
            expect(size.height % 2).toBe(0);
            expect(size.width * size.height).toBeLessThanOrEqual(
                VIRTUAL_DISPLAY_MAX_PIXELS,
            );
        }
    });
});

// A development build hands a virtual display's browser page its modules
// straight from Vite: only that page's module graph may pass, never the rest
// of the dev server (which reads any file it can).
describe('checkIsVirtualDisplayDevViewerFile', () => {
    const appPath = 'C:\\work\\owa';
    const check = (address: string) => {
        return checkIsVirtualDisplayDevViewerFile(
            new URL(address, 'http://192.168.1.3:39240'),
            appPath,
        );
    };
    const fs = '/@fs/C:/work/owa';
    test('lets the viewer page and its modules through', () => {
        for (const address of [
            '/vd-screen.html?vd=1&screenId=0&viewer=abcdef12',
            // "Turn on sound" loads every screen again as the sound player.
            '/vd-screen.html?vd=1&screenId=0&viewer=abcdef12&sound=1',
            '/vd-screen.html?vd=1&screenId=0&viewer=abcdef12&preview=1',
            '/src/vd-screen.ts',
            '/@vite/client',
            '/@vite/env',
            '/@react-refresh',
            '/@id/__x00__vite/dynamic-import-helper.js',
            '/assets/transparency-cursor.svg',
            `${fs}/src/screen.tsx?t=1791402796655`,
            `${fs}/src/lang/data/km/location-name-map-data/namesMap.json?import&url`,
            `${fs}/node_modules/.vite/deps/react.js?v=1a2b3c4d`,
            `${fs}/node_modules/open-lyric-plugin-km-kh/dist/index.js`,
            `${fs}/tools/owa-devtools-mcp/agentFileName.mjs`,
            `${fs}/electron/virtualDisplayProtocol.ts`,
        ]) {
            expect(check(address), address).toBe(true);
        }
    });
    // The screen page imports half of `src/`, so any `electron/` module a
    // source file imports for a VALUE is fetched by every remote viewer. One
    // missing here was a 404 that left a LAN, internet and tunnel viewer with
    // the wallpaper alone, while 127.0.0.1 (never filtered) looked fine.
    test('lets every electron module src imports through', () => {
        const repoDir = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '..',
        );
        const listSources = (dirPath: string): string[] => {
            return readdirSync(dirPath, { withFileTypes: true }).flatMap(
                (entry) => {
                    const entryPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        return listSources(entryPath);
                    }
                    return /\.tsx?$/.test(entry.name) &&
                        !/\.test\.tsx?$/.test(entry.name)
                        ? [entryPath]
                        : [];
                },
            );
        };
        const names = new Set<string>();
        for (const filePath of listSources(path.join(repoDir, 'src'))) {
            const text = readFileSync(filePath, 'utf8');
            const pattern =
                /(?:^|\n)\s*(import|export)\s+(type\s+)?[^;]*?from\s+'(?:\.\.\/)+electron\/([\w-]+)'/g;
            for (const match of text.matchAll(pattern)) {
                if (match[2] === undefined) {
                    names.add(match[3]);
                }
            }
            const dynamicPattern =
                /import\(\s*'(?:\.\.\/)+electron\/([\w-]+)'/g;
            for (const match of text.matchAll(dynamicPattern)) {
                names.add(match[1]);
            }
        }
        expect(names.size).toBeGreaterThan(0);
        for (const name of names) {
            const address = `${fs}/electron/${name}.ts`;
            expect(check(address), address).toBe(true);
        }
    });
    test('refuses everything else the dev server would answer', () => {
        for (const address of [
            '/presenter.html',
            '/vd-screen.html?raw',
            `${fs}/package.json`,
            `${fs}/.env`,
            `${fs}/.claude/memory/MEMORY.md`,
            `${fs}/electron/aiHelpers.ts`,
            `${fs}/tools/owa-devtools-mcp/firewall.mjs?raw`,
            `${fs}/node_modules/.cache/secret.json`,
            `${fs}/src/../package.json`,
            `${fs}/src/%2e%2e/package.json`,
            `${fs}/src/..%5c..%5cpackage.json`,
            `${fs}/src/screen.tsx?raw`,
            `${fs}/src/screen.tsx?import&raw`,
            `${fs}/src/screen.tsx%3Fraw`,
            '/@fs/C:/Windows/win.ini',
            '/@fs/C:/work/owa-other/src/a.ts',
            '/assets/../package.json',
            '/node_modules/.vite/deps/react.js',
        ]) {
            expect(check(address), address).toBe(false);
        }
    });
});

// How a media player gives the connection code: as the password of HTTP
// Basic, whatever the user name.
test('reads the password of a Basic authorization header', () => {
    expect(readBasicAuthPassword(`Basic ${btoa('vlc:church-1234')}`)).toBe(
        'church-1234',
    );
    expect(readBasicAuthPassword(`basic ${btoa(':a:b')}`)).toBe('a:b');
    expect(readBasicAuthPassword(`Basic ${btoa('no-colon')}`)).toBeNull();
    expect(readBasicAuthPassword('Bearer abc')).toBeNull();
    expect(readBasicAuthPassword('Basic ***')).toBeNull();
    expect(readBasicAuthPassword(undefined)).toBeNull();
    expect(readBasicAuthPassword(`Basic ${'A'.repeat(600)}`)).toBeNull();
});

test('the access option is approval unless it says code', () => {
    expect(readVirtualDisplayAccessMode('code')).toBe('code');
    expect(readVirtualDisplayAccessMode('approve')).toBe('approve');
    expect(readVirtualDisplayAccessMode(null)).toBe('approve');
    expect(readVirtualDisplayAccessMode('open')).toBe('approve');
});
