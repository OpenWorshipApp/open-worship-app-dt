// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    sendDataMock: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendData: h.sendDataMock } },
}));

const { printOpenLyricPage } = await import('./lyricPrintHelpers');

// What open-lyric's Print hands a host's `onPrint`: the page it built, its
// style sheets and the song's faces already written in.
function genPage(html: string) {
    return { html, fileName: 'Song-print.html', title: 'Song' };
}

function getSentHtml() {
    return (h.sendDataMock.mock.calls.at(-1)?.[1] ?? '') as string;
}

describe('printOpenLyricPage', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("open-lyric's page goes to the app's print, styles and faces as built", () => {
        printOpenLyricPage(
            genPage(
                '<!doctype html><html><head>' +
                    '<style>.ol-song-view { color: red }</style>' +
                    '<style>@font-face { font-family: "Song Face";' +
                    ' src: url(data:font/ttf;base64,AA) }</style>' +
                    '</head><body><p>lyric</p></body></html>',
            ),
        );
        expect(h.sendDataMock).toHaveBeenCalledTimes(1);
        expect(h.sendDataMock.mock.calls[0][0]).toBe('all:app:print');
        const htmlText = getSentHtml();
        expect(htmlText.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(htmlText).toContain('.ol-song-view { color: red }');
        expect(htmlText).toContain('font-family: "Song Face"');
        expect(htmlText).toContain('<p>lyric</p>');
    });

    // The page prints itself on load and closes on `afterprint`: in the
    // hidden print window that would only pop a native dialog.
    test('the self-printing script and the website link are dropped', () => {
        printOpenLyricPage(
            genPage(
                '<!doctype html><html><body><a class="open-lyric-print-meta__link"' +
                    ' href="https://localhost:3000/presenter.html">Website</a>' +
                    '<p>lyric</p><script>window.print();</script></body></html>',
            ),
        );
        const htmlText = getSentHtml();
        expect(htmlText).not.toContain('window.print()');
        expect(htmlText).not.toContain('<script');
        expect(htmlText).not.toContain('presenter.html');
        expect(htmlText).toContain('<p>lyric</p>');
    });

    test('an empty page prints nothing', () => {
        printOpenLyricPage(genPage('  '));
        expect(h.sendDataMock).not.toHaveBeenCalled();
    });

    // open-lyric shows "Print failed" on its own progress line for a throw.
    test('a failure to hand the page over reaches open-lyric', () => {
        h.sendDataMock.mockImplementationOnce(() => {
            throw new Error('no main process');
        });
        expect(() => {
            printOpenLyricPage(genPage('<p>lyric</p>'));
        }).toThrow('no main process');
    });
});
