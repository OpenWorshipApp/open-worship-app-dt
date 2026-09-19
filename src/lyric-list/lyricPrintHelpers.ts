import appProvider from '../server/appProvider';
import { handleError } from '../helper/errorHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';
import { collectFontFaceCss, resolveCssUrls } from '../helper/printCssHelpers';

/**
 * open-lyric prints the way a web page does: it opens a blank popup and
 * `document.write`s a self-printing HTML document into it (the `⋮` menu's
 * Print, and the lyric editor's Open Lyric / Markdown preview print buttons).
 *
 * Electron denies those popups — `handlePopupWindowOpen`
 * (`electron/electronHelpers.ts`) only allows `popup_window*` frame names, so
 * `open()` returns `null` and every Print button only flashes "Pop-up
 * blocked". This catches the blank popup, keeps the document open-lyric wrote,
 * and routes it through the same `all:app:print` IPC the Bible Note and slide
 * printing use: hidden `BrowserWindow` -> `printToPDF` -> Print Preview window.
 */

function removeAll(documentObject: Document, selector: string) {
    for (const element of Array.from(
        documentObject.querySelectorAll(selector),
    )) {
        element.remove();
    }
}

// Stylesheets are linked by URL (open-lyric's own theme/preview assets). This
// window can fetch them; the print window loads from a temp `file://` path and
// may not, so inline what we can and leave the link alone when we cannot.
async function inlineLinkedStyleSheets(documentObject: Document) {
    const links = Array.from(
        documentObject.querySelectorAll('link[rel="stylesheet"][href]'),
    ) as HTMLLinkElement[];
    await Promise.all(
        links.map(async (link) => {
            const href = link.getAttribute('href');
            if (href === null) {
                return;
            }
            try {
                const response = await fetch(href);
                if (!response.ok) {
                    return;
                }
                const cssText = await response.text();
                const style = documentObject.createElement('style');
                style.textContent = resolveCssUrls(cssText, href);
                link.replaceWith(style);
            } catch (error) {
                handleError(error);
            }
        }),
    );
}

// App fonts (the language fonts, e.g. `app-Battambang` for Khmer songs) are
// @font-face rules injected into this window only; without a copy the print
// window rasterizes fallback glyphs.
function appendFontFaceCss(documentObject: Document, printedHtml: string) {
    const fontFaceCss = collectFontFaceCss(printedHtml);
    if (fontFaceCss === '') {
        return;
    }
    const style = documentObject.createElement('style');
    style.textContent = fontFaceCss;
    documentObject.head.appendChild(style);
}

async function toPrintableHtml(htmlText: string) {
    const documentObject = new DOMParser().parseFromString(
        htmlText,
        'text/html',
    );
    // The written document prints itself (`window.print()` on load,
    // `window.close()` on `afterprint`). The hidden print window does the
    // printing, so those scripts would only pop a native dialog there.
    removeAll(documentObject, 'script');
    // The metadata header carries a "Website" link built from `location.href` —
    // meaningful on the web, but in the app that is the window's own
    // `.../presenter.html?...` URL printed onto every song sheet.
    removeAll(documentObject, '.open-lyric-print-meta__link');
    await inlineLinkedStyleSheets(documentObject);
    // Serialized here rather than inside `appendFontFaceCss`, so the one
    // expensive step (a song sheet carries inlined stylesheets and images) is
    // visible at the level that owns the pipeline instead of hidden in a helper
    // whose name suggests it only appends.
    appendFontFaceCss(documentObject, documentObject.documentElement.outerHTML);
    return `<!DOCTYPE html>${documentObject.documentElement.outerHTML}`;
}

async function printWrittenDocument(htmlText: string) {
    try {
        if (htmlText.trim() === '') {
            return;
        }
        const printableHtml = await toPrintableHtml(htmlText);
        appProvider.messageUtils.sendData('all:app:print', printableHtml);
    } catch (error) {
        handleError(error);
        showSimpleToast(
            tran('Print'),
            tran('Unable to prepare the document for printing'),
        );
    }
}

// Only the handful of members open-lyric touches on the popup it opens:
// `document.open/write/close` and `focus`.
function genPrintWindowStub() {
    let htmlText = '';
    let isPrinted = false;
    const print = () => {
        if (isPrinted) {
            return;
        }
        isPrinted = true;
        void printWrittenDocument(htmlText);
    };
    return {
        closed: false,
        document: {
            open: () => {
                htmlText = '';
            },
            write: (text: string) => {
                htmlText += text;
            },
            writeln: (text: string) => {
                htmlText += `${text}\n`;
            },
            close: print,
        },
        focus: () => {},
        print,
        close: () => {},
    } as unknown as Window;
}

let isPrintPopupHandlerInstalled = false;

/**
 * Idempotent; safe to call from every window that mounts an open-lyric
 * surface. Only blank-URL popups are taken over - a popup with a real URL (the
 * app's own popup windows, external links) still goes to the real `open`.
 */
export function installOpenLyricPrintPopupHandler() {
    if (isPrintPopupHandlerInstalled) {
        return;
    }
    isPrintPopupHandlerInstalled = true;
    const originalOpen = globalThis.open.bind(globalThis);
    globalThis.open = ((
        url?: string | URL,
        target?: string,
        features?: string,
    ) => {
        const urlText = String(url ?? '').trim();
        if (urlText === '' || urlText === 'about:blank') {
            return genPrintWindowStub();
        }
        return originalOpen(url, target, features);
    }) as typeof globalThis.open;
}
