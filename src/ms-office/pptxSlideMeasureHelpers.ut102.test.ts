// @vitest-environment jsdom

// The measurer's last guards: a web font that will not load, a YouTube
// thumbnail stored through its loader, and a thumbnail or a background that
// decodes to no size.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    getAttachedBackground: vi.fn(),
    genSlideHtml: vi.fn(),
    fillWebsiteScreenShots: vi.fn(),
    captureVideoFrameDataUrl: vi.fn(),
    fsReadFileBytes: vi.fn(),
    getBibleFontFamily: vi.fn(),
    handleError: vi.fn(),
    fontResolverInit: vi.fn(),
}));

vi.mock('../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: fixture.genSlideHtml,
}));
vi.mock('../app-document-list/appDocumentPrintHelpers', () => ({
    fillWebsiteScreenShots: fixture.fillWebsiteScreenShots,
}));
vi.mock('../helper/mediaHelpers', () => ({
    captureVideoFrameDataUrl: fixture.captureVideoFrameDataUrl,
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: fixture.getAttachedBackground,
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsReadFileBytes: fixture.fsReadFileBytes,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: fixture.getBibleFontFamily,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: fixture.handleError }));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isWindows: true, isMac: false, isLinux: false } },
}));
vi.mock('./pptxFontHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./pptxFontHelpers')>()),
    PptxFontResolver: class {
        async init() {
            fixture.fontResolverInit();
        }
        splitByFont(text: string, spec: { familyList: string }) {
            return [{ text, fontFamily: spec.familyList || 'Arial' }];
        }
        getMetrics(spec: { size: number }) {
            return { ascent: spec.size * 0.8, descent: spec.size * 0.2 };
        }
    },
}));

import type Slide from '../app-document-list/Slide';
import {
    PptxSlideMeasurer,
    type PptxMediaAdderType,
} from './pptxSlideMeasureHelpers';
import type { PptxMediaType } from './pptxXmlHelpers';

type MeasurerInternals = Pick<
    PptxSlideMeasurer,
    'measureSlide' | 'destroy' | 'init'
> & {
    measureBackground(slide: Slide): Promise<unknown>;
    measurePicture(
        element: Element,
        rect: { x: number; y: number; width: number; height: number },
        style: CSSStyleDeclaration,
        itemJson: { type: string; url?: string },
    ): Promise<unknown>;
    measureItem(
        wrapper: HTMLElement,
        itemJson: {
            id: number;
            type: string;
            rotate?: number;
            backdropFilter?: number;
        },
        origin: DOMRect,
        index: number,
    ): Promise<unknown>;
    measureTextBlocks(
        root: HTMLElement,
        origin: DOMRect,
    ): Array<{
        textBody: {
            lines: Array<{
                runs: Array<{
                    text: string;
                    fontSize: number;
                    color: { hex: string; alpha: number };
                    baselineShift: number;
                }>;
                isNewParagraph: boolean;
            }>;
            lineSpacing: number;
        };
        frame: { x: number; y: number; width: number; height: number };
    }>;
    measureDecorations(
        root: HTMLElement,
        origin: DOMRect,
        name: string,
    ): unknown[];
    genBackdropPicture(
        box: {
            x: number;
            y: number;
            width: number;
            height: number;
            rotation: number;
        },
        geometry: { kind: 'rect' },
        blurRadius: number,
        name: string,
    ): Promise<unknown>;
};

function mockLoadedImages(width = 800, height = 600) {
    const setter = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
    setter.mockImplementation(function (this: HTMLImageElement) {
        Object.defineProperty(this, 'naturalWidth', {
            configurable: true,
            value: width,
        });
        Object.defineProperty(this, 'naturalHeight', {
            configurable: true,
            value: height,
        });
        queueMicrotask(() => this.onload?.(new Event('load')));
    });
    return setter;
}

function makeSlide(overrides: Record<string, unknown> = {}): Slide {
    return {
        width: 1920,
        height: 1080,
        filePath: 'Sunday.owa',
        id: 1,
        note: 'speaker note',
        isDisabled: false,
        canvasItemsJson: [],
        getBibleKeys: () => [],
        ...overrides,
    } as unknown as Slide;
}

function makeMeasurer(addMedia: PptxMediaAdderType = async () => null) {
    return new PptxSlideMeasurer(addMedia) as unknown as MeasurerInternals;
}

beforeEach(() => {
    vi.clearAllMocks();
    fixture.genSlideHtml.mockImplementation(() =>
        document.createElement('div'),
    );
    fixture.fillWebsiteScreenShots.mockResolvedValue(undefined);
    fixture.getAttachedBackground.mockResolvedValue(null);
    fixture.getBibleFontFamily.mockResolvedValue('Arial');
    Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { load: vi.fn(async () => []), ready: Promise.resolve() },
    });
});

afterEach(() => {
    document.body.replaceChildren();
    delete (Range.prototype as unknown as { getClientRects?: unknown })
        .getClientRects;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function genRecordingAddMedia(
    media = { fileName: 'image1.png' } as PptxMediaType,
) {
    const loaded: unknown[] = [];
    const addMedia = vi.fn(
        async (_key: string, load: () => Promise<unknown>) => {
            const result = await load();
            loaded.push(result);
            return result === null ? null : media;
        },
    );
    return { loaded, addMedia, media };
}

function stubFetch(mime: string, bytes: number[]) {
    const fetchMock = vi.fn(async () => ({
        ok: true,
        headers: { get: () => mime },
        arrayBuffer: async () => new Uint8Array(bytes).buffer,
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const YOUTUBE_ITEM = { type: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' };
const THUMBNAIL_URL = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';

describe('PowerPoint slide measurement residual guards', () => {
    it('a web font that fails to load does not stop the slide being measured', async () => {
        const load = vi.fn(async () => {
            throw new Error('font file gone');
        });
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { load, ready: Promise.resolve() },
        });
        fixture.genSlideHtml.mockImplementation(() => {
            const root = document.createElement('div');
            root.append(document.createElement('span'));
            return root;
        });
        const measurer = makeMeasurer();
        const model = await measurer.measureSlide(makeSlide());
        expect(load).toHaveBeenCalled();
        expect(model).toMatchObject({
            width: 1920,
            height: 1080,
            elements: [],
            note: 'speaker note',
        });
        measurer.destroy();
    });

    it('a YouTube thumbnail is stored as the JPEG bytes the site served', async () => {
        mockLoadedImages(480, 360);
        const fetchMock = stubFetch('image/jpeg', [0xff, 0xd8, 0xff]);
        const { loaded, addMedia, media } = genRecordingAddMedia();
        const measurer = makeMeasurer(addMedia);
        const iframe = document.createElement('iframe');
        const picture = await measurer.measurePicture(
            iframe,
            { x: 0, y: 0, width: 480, height: 270 },
            getComputedStyle(iframe),
            YOUTUBE_ITEM,
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            name: 'youtube picture',
        });
        expect(addMedia.mock.calls[0][0]).toBe(THUMBNAIL_URL);
        expect(fetchMock).toHaveBeenCalledWith(THUMBNAIL_URL);
        expect(loaded).toEqual([
            { bytes: new Uint8Array([0xff, 0xd8, 0xff]), extension: 'jpeg' },
        ]);
        measurer.destroy();
    });

    it('a thumbnail PowerPoint cannot hold, decoded to no size, stores nothing', async () => {
        mockLoadedImages(0, 0);
        stubFetch('image/webp', [1, 2, 3]);
        const { loaded, addMedia } = genRecordingAddMedia();
        const measurer = makeMeasurer(addMedia);
        const iframe = document.createElement('iframe');
        expect(
            await measurer.measurePicture(
                iframe,
                { x: 0, y: 0, width: 480, height: 270 },
                getComputedStyle(iframe),
                YOUTUBE_ITEM,
            ),
        ).toBeNull();
        // The store was asked, and its loader handed back nothing to keep.
        expect(addMedia).toHaveBeenCalledOnce();
        expect(loaded).toEqual([null]);
        measurer.destroy();
    });
});
