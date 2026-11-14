/**
 * The wall round a document page drawn into a picture: a converted deck is
 * a document from anywhere, so what it may load is its own folder and
 * nothing else, and only a converter's own folder may be drawn at all.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => {
    return {
        BrowserWindow: vi.fn(),
        session: { fromPartition: vi.fn() },
    };
});

import {
    checkIsDocumentRequestAllowed,
    checkIsPathInside,
    findCapturePathsProblem,
    toCaptureLayout,
} from './documentCaptureHelpers';

const DECK_DIR = path.resolve('/data/documents/Song.pptx-htmls');

describe('documentCaptureHelpers', () => {
    it('knows a file inside its folder from one beside or above it', () => {
        expect(
            checkIsPathInside(DECK_DIR, path.join(DECK_DIR, 'slide1.html')),
        ).toBe(true);
        expect(
            checkIsPathInside(DECK_DIR, path.join(DECK_DIR, 'fonts', 'a.ttf')),
        ).toBe(true);
        expect(checkIsPathInside(DECK_DIR, DECK_DIR)).toBe(false);
        expect(
            checkIsPathInside(DECK_DIR, path.join(DECK_DIR, '..', 'x.html')),
        ).toBe(false);
        expect(
            checkIsPathInside(DECK_DIR, `${DECK_DIR}-evil${path.sep}a.html`),
        ).toBe(false);
    });

    it('draws only pages of a converted PowerPoint or Word file', () => {
        expect(
            findCapturePathsProblem(DECK_DIR, [
                path.join(DECK_DIR, 'slide1.html'),
            ]),
        ).toBeNull();
        expect(
            findCapturePathsProblem(path.resolve('/data/documents'), [
                path.resolve('/data/documents/a.html'),
            ]),
        ).toMatch(/Only a page/);
        expect(
            findCapturePathsProblem(DECK_DIR, [
                path.resolve('/data/setting.json'),
            ]),
        ).toMatch(/outside/);
        expect(
            findCapturePathsProblem(DECK_DIR, [
                path.join(DECK_DIR, '..', 'Other.pptx-htmls', 'slide1.html'),
            ]),
        ).toMatch(/outside/);
        expect(findCapturePathsProblem(DECK_DIR, [])).toMatch(/No page/);
        expect(findCapturePathsProblem(undefined, undefined)).toMatch(
            /Only a page/,
        );
    });

    it('draws a big page in a picture-sized window, zoomed to fit', () => {
        // A 1920px slide in a 1920px hidden window was shrunk by the OS to
        // the screen: the picture was its top-left corner alone.
        expect(toCaptureLayout(1920, 1080)).toEqual({
            scale: 1024 / 1920,
            windowWidth: 1024,
            windowHeight: 576,
        });
        expect(toCaptureLayout(816, 1056)).toEqual({
            scale: 1024 / 1056,
            windowWidth: 791,
            windowHeight: 1024,
        });
        expect(toCaptureLayout(640, 360)).toEqual({
            scale: 1,
            windowWidth: 640,
            windowHeight: 360,
        });
    });

    it('lets a page load its own folder and inline pictures, nothing else', () => {
        const fontUrl = pathToFileURL(
            path.join(DECK_DIR, 'fonts', 'Face.ttf'),
        ).toString();
        expect(checkIsDocumentRequestAllowed(fontUrl, DECK_DIR)).toBe(true);
        expect(
            checkIsDocumentRequestAllowed(
                'data:image/png;base64,AAAA',
                DECK_DIR,
            ),
        ).toBe(true);
        expect(
            checkIsDocumentRequestAllowed(
                pathToFileURL(path.resolve('/data/setting.json')).toString(),
                DECK_DIR,
            ),
        ).toBe(false);
        expect(
            checkIsDocumentRequestAllowed(
                'https://example.com/a.png',
                DECK_DIR,
            ),
        ).toBe(false);
        expect(
            checkIsDocumentRequestAllowed(
                'http://127.0.0.1:39223/mcp',
                DECK_DIR,
            ),
        ).toBe(false);
        expect(checkIsDocumentRequestAllowed(fontUrl, null)).toBe(false);
    });
});
