// @vitest-environment jsdom

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const h = vi.hoisted(() => ({
    sendDataMock: vi.fn(),
    handleErrorMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    tranMock: vi.fn((text: string) => text),
    collectFontFaceCssMock: vi.fn(() => ''),
}));

vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendData: h.sendDataMock } },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleErrorMock }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../lang/langHelpers', () => ({ tran: h.tranMock }));
vi.mock('../helper/printCssHelpers', () => ({
    collectFontFaceCss: h.collectFontFaceCssMock,
    resolveCssUrls: (cssText: string) => cssText,
}));

const { installOpenLyricPrintPopupHandler } =
    await import('./lyricPrintHelpers');

// the `open` the handler wraps - what a non-blank url must still reach
const openMock = vi.fn(() => null);

// open-lyric writes its print document into a popup it opens with a blank url
function writeToPrintPopup(htmlText: string) {
    const popupWindow = globalThis.open('', '_blank', 'width=100');
    if (popupWindow === null) {
        throw new Error('No print popup');
    }
    popupWindow.document.open();
    popupWindow.document.write(htmlText);
    popupWindow.document.close();
}

async function getSentHtml() {
    // the written document is post-processed asynchronously (stylesheets)
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
    return (h.sendDataMock.mock.calls.at(-1)?.[1] ?? '') as string;
}

describe('installOpenLyricPrintPopupHandler', () => {
    beforeAll(() => {
        globalThis.open = openMock as any;
        installOpenLyricPrintPopupHandler();
    });
    beforeEach(() => {
        globalThis.fetch = vi.fn(async () => {
            return { ok: true, text: async () => '.a{color:red}' } as any;
        });
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    test('a blank popup document is printed through the app IPC', async () => {
        writeToPrintPopup(
            '<!doctype html><html><head><title>Song - Print</title>' +
                '</head><body><p>lyric</p></body></html>',
        );
        const htmlText = await getSentHtml();
        expect(openMock).not.toHaveBeenCalled();
        expect(h.sendDataMock).toHaveBeenCalledTimes(1);
        expect(h.sendDataMock.mock.calls[0][0]).toBe('all:app:print');
        expect(htmlText).toContain('<p>lyric</p>');
    });

    test('the self-printing script and the website link are dropped', async () => {
        writeToPrintPopup(
            '<!doctype html><html><body><a class="open-lyric-print-meta__link"' +
                ' href="https://localhost:3000/presenter.html">Website</a>' +
                '<p>lyric</p><script>window.print();</script></body></html>',
        );
        const htmlText = await getSentHtml();
        expect(htmlText).not.toContain('window.print()');
        expect(htmlText).not.toContain('presenter.html');
        expect(htmlText).toContain('<p>lyric</p>');
    });

    test('linked stylesheets are inlined', async () => {
        writeToPrintPopup(
            '<!doctype html><html><head><link rel="stylesheet"' +
                ' href="https://localhost:3000/theme.css" /></head>' +
                '<body><p>lyric</p></body></html>',
        );
        const htmlText = await getSentHtml();
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://localhost:3000/theme.css',
        );
        expect(htmlText).toContain('.a{color:red}');
        expect(htmlText).not.toContain('<link');
    });

    test('app font faces are copied into the print document', async () => {
        h.collectFontFaceCssMock.mockReturnValueOnce(
            '@font-face{font-family:app-Battambang;src:url(a.woff)}',
        );
        writeToPrintPopup('<html><body><p>lyric</p></body></html>');
        const htmlText = await getSentHtml();
        expect(htmlText).toContain('app-Battambang');
    });

    test('nothing is printed when no document was written', async () => {
        globalThis.open('', '_blank', 'width=100')?.document.close();
        await getSentHtml();
        expect(h.sendDataMock).not.toHaveBeenCalled();
    });

    test('a popup with a real url still goes to the real open', () => {
        globalThis.open('https://example.com/x.html', 'popup_window_1', '');
        expect(openMock).toHaveBeenCalledWith(
            'https://example.com/x.html',
            'popup_window_1',
            '',
        );
    });
});
