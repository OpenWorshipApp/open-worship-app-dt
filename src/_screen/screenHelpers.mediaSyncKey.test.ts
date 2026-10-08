import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

// The presenter, a dev screen and a screen page served by Screen Mirror each
// address one file differently; the sync key and the video id must not.

vi.mock('../server/appProvider', async () => {
    const nodeCrypto = await import('node:crypto');
    return {
        default: {
            messageUtils: { sendData: vi.fn(), sendDataSync: vi.fn() },
            systemUtils: {
                isDev: false,
                generateMD5: (text: string) => {
                    return nodeCrypto
                        .createHash('md5')
                        .update(text)
                        .digest('hex');
                },
            },
            envUtils: { isFEUseEffectWarning: false },
        },
    };
});
vi.mock('../helper/loggerHelpers', () => ({
    appLog: vi.fn(),
    appError: vi.fn(),
    appWarning: vi.fn(),
    appTrace: vi.fn(),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
}));
vi.mock('../lang/langHelpers', () => ({
    checkIsValidLocale: vi.fn(() => true),
    tran: (text: string) => text,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: vi.fn(),
}));
vi.mock('../scrolling/scrollingHandlerHelpers', () => ({
    PLAY_TO_BOTTOM_CLASSNAME: 'play-to-bottom',
    PLAY_TO_BOTTOM_MENU_CLASSNAME: 'play-to-bottom-menu',
    TO_THE_TOP_CLASSNAME: 'to-the-top',
    TO_THE_TOP_STYLE_STRING: '',
    applyPlayToBottom: vi.fn(),
    applyToTheTop: vi.fn(),
}));
vi.mock('../scrolling/playToBottomMenuHelpers', () => ({
    showPlayToBottomContextMenu: vi.fn(),
}));
vi.mock('./managers/screenManagerBaseHelpers', () => ({
    getValidOnScreen: vi.fn(),
}));
vi.mock('./managers/screenManagerHooks', () => ({
    useScreenUpdateEvents: vi.fn(),
}));
vi.mock('../server/unlockingHelpers', () => ({ unlocking: vi.fn() }));
vi.mock('../server/appHelpers', () => ({ electronSendAsync: vi.fn() }));
vi.mock('../bible-list/BibleItem', () => ({ default: class BibleItem {} }));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: vi.fn(),
    useAppStateAsync: vi.fn(),
    useAppEffect: vi.fn(),
}));

import { genVideoIDFromSrc, toMediaSyncKey } from './screenHelpers';

const SCOPE_ID = 'a1'.repeat(24);
const RESOURCE_ID = 'b2'.repeat(12);

function toMirrorUrl(name: string) {
    // What `ScreenMirrorContent.publish` hands out.
    return (
        `http://127.0.0.1:39241/content/${SCOPE_ID}/${RESOURCE_ID}/` +
        encodeURIComponent(name)
    );
}

function toPresenterUrl(name: string) {
    // What the presenter's `browserUtils.pathToFileURL` gives on Windows.
    return pathToFileURL(`C:\\x\\data\\videos\\${name}`, { windows: true })
        .href;
}

function md5(text: string) {
    return createHash('md5').update(text).digest('hex');
}

describe('toMediaSyncKey / genVideoIDFromSrc', () => {
    test('a plain name: presenter, dev and mirror share one key and id', () => {
        const sources = [
            'file:///C:/x/data/videos/14_cv.mp4',
            toPresenterUrl('14_cv.mp4'),
            'https://localhost:3000/data/videos/14_cv.mp4',
            toMirrorUrl('14_cv.mp4'),
        ];
        for (const src of sources) {
            expect(toMediaSyncKey(src)).toBe('14_cv.mp4');
            expect(genVideoIDFromSrc(src)).toBe(`video-${md5('14_cv.mp4')}`);
        }
    });

    test('an encoded Khmer name with a space and # decodes to one key', () => {
        const name = 'ភ្លេង #1.mp4';
        const sources = [
            toPresenterUrl(name),
            'https://localhost:3000/data/videos/ភ្លេង%20%231.mp4',
            toMirrorUrl(name),
        ];
        // The `#` must be encoded in every one of them, or it is a fragment.
        for (const src of sources) {
            expect(src).toContain('%231.mp4');
            expect(toMediaSyncKey(src)).toBe(name);
        }
        const ids = new Set(sources.map(genVideoIDFromSrc));
        expect([...ids]).toEqual([`video-${md5(name)}`]);
    });

    test('a literal % in a name survives every window', () => {
        const name = '100% (live).mp4';
        const keys = [toPresenterUrl(name), toMirrorUrl(name)].map(
            toMediaSyncKey,
        );
        expect(keys).toEqual([name, name]);
    });

    test('a query or media fragment does not change the key', () => {
        expect(toMediaSyncKey(`${toMirrorUrl('14_cv.mp4')}?v=2`)).toBe(
            '14_cv.mp4',
        );
        expect(
            genVideoIDFromSrc('file:///C:/x/data/videos/14_cv.mp4#t=10'),
        ).toBe(genVideoIDFromSrc(toMirrorUrl('14_cv.mp4')));
    });

    test('a relative address is keyed on its name too', () => {
        expect(toMediaSyncKey('/content/x/y/14_cv.mp4')).toBe('14_cv.mp4');
        expect(toMediaSyncKey('14_cv.mp4')).toBe('14_cv.mp4');
    });

    test('two different file names give different keys and ids', () => {
        const first = toMirrorUrl('14_cv.mp4');
        const second = toMirrorUrl('15_cv.mp4');
        expect(toMediaSyncKey(first)).not.toBe(toMediaSyncKey(second));
        expect(genVideoIDFromSrc(first)).not.toBe(genVideoIDFromSrc(second));
        expect(genVideoIDFromSrc(toPresenterUrl('ភ្លេង #1.mp4'))).not.toBe(
            genVideoIDFromSrc(toPresenterUrl('ភ្លេង #2.mp4')),
        );
    });

    test('an address with no name falls back to the address itself', () => {
        expect(toMediaSyncKey('https://localhost:3000/')).toBe(
            'https://localhost:3000/',
        );
        expect(toMediaSyncKey('')).toBe('');
    });

    test('the id is selector safe', () => {
        expect(genVideoIDFromSrc(toPresenterUrl('ភ្លេង #1.mp4'))).toMatch(
            /^video-[0-9a-f]{32}$/,
        );
    });
});
