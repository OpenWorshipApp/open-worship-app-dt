// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    send: vi.fn(),
    error: vi.fn(),
    toast: vi.fn(),
    background: vi.fn(),
    fontCss: vi.fn(),
    screenshot: vi.fn(),
    frame: vi.fn(),
}));

vi.mock('../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: (text: string) => {
        const div = document.createElement('div');
        div.className = 'slide-content';
        div.textContent = text;
        return div;
    },
}));
vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendData: h.send } },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { getAttachedBackground: h.background },
}));
vi.mock('../helper/printCssHelpers', () => ({ collectFontFaceCss: h.fontCss }));
vi.mock('../helper/DragInf', () => ({
    DragTypeEnum: {
        BACKGROUND_COLOR: 'color',
        BACKGROUND_IMAGE: 'image',
        BACKGROUND_VIDEO: 'video',
    },
}));
vi.mock('../helper/websiteCaptureHelpers', () => ({
    parseWebsiteCaptureSize: (value: string | null) => {
        const match = /^(\d+)x(\d+)$/.exec(value ?? '');
        return match
            ? { width: Number(match[1]), height: Number(match[2]) }
            : null;
    },
}));
vi.mock('../helper/capturingHelpers', () => ({
    captureWebScreenShot: h.screenshot,
}));
vi.mock('../helper/mediaHelpers', () => ({
    captureVideoFrameDataUrl: h.frame,
}));
vi.mock('../helper/constants', () => ({
    PREVIEW_ONLY_ATTR: 'data-preview-only',
    WEBSITE_CAPTURE_SIZE_ATTR: 'data-capture-size',
    WEBSITE_ITEM_ATTR: 'data-website-item',
    WEBSITE_URL_ATTR: 'data-website-url',
}));

import {
    fillWebsiteScreenShots,
    printAppDocument,
} from './appDocumentPrintHelpers';

function slide(id: string, width = 800, height = 600) {
    return {
        id,
        width,
        height,
        filePath: 'C:/documents/service.owa',
        canvasItemsJson: `Text for ${id}`,
    };
}

function sentHtml() {
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send).toHaveBeenCalledWith('all:app:print', expect.any(String));
    return h.send.mock.calls[0][1] as string;
}

beforeEach(() => {
    for (const value of Object.values(h)) value.mockReset();
    h.background.mockResolvedValue(null);
    h.fontCss.mockReturnValue('@font-face { font-family: Test; }');
    h.screenshot.mockResolvedValue('data:image/png;base64,shot');
    h.frame.mockResolvedValue('data:image/png;base64,frame');
});

describe('document printing', () => {
    it('builds one unscaled page per slide and escapes the document title', async () => {
        const slides = [slide('one'), slide('two'), slide('wide', 1024, 768)];
        await printAppDocument({
            getSlides: async () => slides,
            fileSource: { name: '<Service & Songs>' },
        } as any);
        const html = sentHtml();
        expect(html).toContain('<title>&lt;Service &amp; Songs&gt;</title>');
        expect(html.match(/@page page-800x600/g)).toHaveLength(1);
        expect(html.match(/@page page-1024x768/g)).toHaveLength(1);
        expect(html).toContain('size: 800px 600px; margin: 0');
        expect(html).toContain('size: 1024px 768px; margin: 0');
        expect(html).toContain('@font-face { font-family: Test; }');
        expect(html.match(/break-after: page/g)).toHaveLength(3);
        expect(html).toContain('Text for one');
        expect(html).toContain('Text for wide');
        expect(html).not.toContain('transform: scale');
        expect(h.fontCss).toHaveBeenCalledWith(
            expect.stringContaining('Text for one'),
        );
    });

    it('uses slide backgrounds first and falls back to the document background', async () => {
        h.background.mockImplementation(async (_path: string, id?: string) => {
            if (id === 'color') return { type: 'color', item: '#123456' };
            if (id === undefined)
                return { type: 'image', item: { src: 'file:///back.png' } };
            return null;
        });
        await printAppDocument({
            getSlides: async () => [slide('color'), slide('fallback')],
            fileSource: { name: 'Service' },
        } as any);
        const pages = Array.from(
            new DOMParser().parseFromString(sentHtml(), 'text/html').body
                .children,
        );
        expect(pages[0].innerHTML).toContain(
            'background-color: rgb(18, 52, 86)',
        );
        expect(pages[1].querySelector('img')?.getAttribute('src')).toBe(
            'file:///back.png',
        );
        expect(h.background).toHaveBeenCalledWith(
            'C:/documents/service.owa',
            'color',
        );
        expect(h.background).toHaveBeenCalledWith('C:/documents/service.owa');
    });

    it('captures a repeated video background once for the document', async () => {
        h.background.mockResolvedValue({
            type: 'video',
            item: { src: 'file:///video.mp4' },
        });
        await printAppDocument({
            getSlides: async () => [slide('one'), slide('two')],
            fileSource: { name: 'Service' },
        } as any);
        expect(h.frame).toHaveBeenCalledTimes(1);
        expect(h.frame).toHaveBeenCalledWith('file:///video.mp4');
        expect(sentHtml().match(/data:image\/png;base64,frame/g)).toHaveLength(
            2,
        );
    });

    it('reports a failed preparation without sending a print request', async () => {
        const failure = new Error('slide read failed');
        await printAppDocument({
            getSlides: async () => {
                throw failure;
            },
            fileSource: { name: 'Service' },
        } as any);
        expect(h.send).not.toHaveBeenCalled();
        expect(h.error).toHaveBeenCalledWith(failure);
        expect(h.toast).toHaveBeenCalledWith(
            'Print',
            'Unable to prepare the document for printing',
        );
    });
});

describe('website screenshots in printed slides', () => {
    function webItem(url: string, size: string, withPlaceholder = true) {
        const frame = document.createElement('div');
        frame.setAttribute('data-website-item', '');
        frame.setAttribute('data-website-url', url);
        frame.setAttribute('data-capture-size', size);
        if (withPlaceholder) {
            const placeholder = document.createElement('div');
            placeholder.setAttribute('data-preview-only', '');
            placeholder.textContent = 'Waiting';
            frame.appendChild(placeholder);
        }
        return frame;
    }

    it('reuses shots for the same URL and size but captures other sizes', async () => {
        const div = document.createElement('div');
        div.append(
            webItem('https://example.org', '640x480'),
            webItem('https://example.org', '640x480'),
            webItem('https://example.org', '800x600'),
        );
        await fillWebsiteScreenShots(div, new Map());
        expect(h.screenshot).toHaveBeenCalledTimes(2);
        expect(h.screenshot).toHaveBeenCalledWith('https://example.org', {
            width: 640,
            height: 480,
            delay: 3000,
        });
        expect(h.screenshot).toHaveBeenCalledWith('https://example.org', {
            width: 800,
            height: 600,
            delay: 3000,
        });
        expect(div.querySelectorAll('[data-preview-only] img')).toHaveLength(3);
    });

    it('keeps placeholders when capture is impossible or returns no image', async () => {
        h.screenshot.mockResolvedValue(null);
        const div = document.createElement('div');
        div.append(
            webItem('', '640x480'),
            webItem('https://example.org', 'bad'),
            webItem('https://example.org', '640x480', false),
            webItem('https://example.org', '640x480'),
        );
        await fillWebsiteScreenShots(div, new Map());
        expect(h.screenshot).toHaveBeenCalledTimes(1);
        expect(div.querySelectorAll('img')).toHaveLength(0);
        expect(div.textContent).toContain('Waiting');
    });
});
