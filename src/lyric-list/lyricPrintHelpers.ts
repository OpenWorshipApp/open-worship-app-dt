import type { OpenLyricPrintPage } from 'open-lyric';

import appProvider from '../server/appProvider';

/**
 * Song print is open-lyric's own (2026-11-22, the user: _should use
 * open-lyric native printing_). Every previewer the app makes is given this as
 * its `onPrint` -- the presenter's (`initOpenLyric`) and the lyric editor
 * window's lyric and Markdown panels (`lyricEditorBoot.ts`) -- so the ⋮ menu's
 * Print and the editor's print buttons hand over the page open-lyric built:
 * its style sheets written in and the song's faces embedded
 * (`buildOpenLyricPortablePrintPage`). The app only shows it, in the same
 * Print Preview window Bible notes and slides use (`all:app:print`: a hidden
 * window, then `printToPDF`).
 *
 * Without it open-lyric opens a blank popup to print in, which Electron
 * refuses (`handlePopupWindowOpen` lets only `popup_window*` frames through):
 * every Print would only flash "Pop-up blocked". The app used to catch that
 * popup and rebuild the page itself; how a song looks on paper is open-lyric's
 * to get right, so a print fault is fixed there.
 */

function removeAll(documentObject: Document, selector: string) {
    for (const element of Array.from(
        documentObject.querySelectorAll(selector),
    )) {
        element.remove();
    }
}

function toPrintableHtml(htmlText: string) {
    const documentObject = new DOMParser().parseFromString(
        htmlText,
        'text/html',
    );
    // The page prints itself (`window.print()` on load, `window.close()` on
    // `afterprint`). The hidden print window does the printing, so that
    // script would only pop a native dialog there.
    removeAll(documentObject, 'script');
    // The header's "Website" link is built from `location.href` -- meaningful
    // on the web, but in the app it is the window's own
    // `.../presenter.html?...` URL printed onto every song sheet.
    removeAll(documentObject, '.open-lyric-print-meta__link');
    return `<!DOCTYPE html>${documentObject.documentElement.outerHTML}`;
}

/**
 * The `onPrint` of every open-lyric previewer the app makes. A throw reaches
 * open-lyric, whose progress line then reads "Print failed".
 */
export function printOpenLyricPage({ html }: OpenLyricPrintPage) {
    if (html.trim() === '') {
        return;
    }
    appProvider.messageUtils.sendData('all:app:print', toPrintableHtml(html));
}
