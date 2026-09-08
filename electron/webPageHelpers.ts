/**
 * Reading a page off the public web on the assistant's behalf, for
 * `owa_read_website`.
 *
 * ## Why a browser window and not `fetch`
 *
 * The obvious implementation is `fetch` plus a regular expression that strips
 * tags, and it was rejected for three reasons that all point the same way:
 *
 *  - Half the web renders nothing without JavaScript, so a text-only fetch
 *    would answer "this page is empty" for pages that plainly are not, which
 *    reads as a bug rather than a limit.
 *  - The user asked for a picture of the page as well, and that needs a real
 *    renderer regardless. Two mechanisms would be two places to get the
 *    address policy right, and one of them would eventually be wrong.
 *  - `document.body.innerText` after layout is a far better extraction than
 *    any tag-stripper: it honours `display: none`, collapses whitespace the
 *    way a reader sees it, and never hands back the contents of a `<script>`.
 *
 * So one load serves both, and there is exactly one path out to the network.
 *
 * ## Why not `captureWebScreenShot`
 *
 * That one exists for website canvas items and is deliberately left alone. It
 * runs with `webSecurity: false` and the app's own session because it is
 * previewing an address the USER typed into a slide. This is loading an
 * address a language MODEL chose, which is a different trust level and
 * therefore different settings -- a shared function with a "be careful" flag
 * would be the worst of both. See `MC-16` in the enhance-mcp backlog for the
 * hardening that one still wants on its own terms.
 *
 * ## The lockdown
 *
 * Every line of `genWebPreferences` here is load-bearing; the comments say
 * which attack each one answers. The short version is that this window is a
 * plain sandboxed Chrome tab with no way back into the app: no Node, no
 * preload, no popups, no downloads, no permissions, no shared session, and no
 * navigation off the public web.
 */
import { BrowserWindow, session } from 'electron';
import { pathToFileURL } from 'node:url';

import { attemptClosing } from './electronHelpers';
import { importEsm, toMcpPackagePath } from './aiHelpers';

type WebUrlVerdictType = {
    isAllowed: boolean;
    reason?: string;
    href?: string;
    hostname?: string;
};

type WebUrlPolicyType = {
    checkWebUrl: (url: string) => WebUrlVerdictType;
    checkWebUrlIsFetchable: (url: string) => Promise<WebUrlVerdictType>;
};

/**
 * The address policy lives in `tools/owa-devtools-mcp/webUrlPolicy.mjs` so
 * that the MCP firewall and this -- the thing that actually opens the socket
 * -- cannot drift apart. Loaded the same way `startMcpHost` loads the host:
 * `tools/` ships unpacked beside the asar, and a plain dynamic import would be
 * rewritten by `tsc` into a `require`.
 */
let webUrlPolicy: Promise<WebUrlPolicyType> | null = null;

function getWebUrlPolicy() {
    if (webUrlPolicy === null) {
        webUrlPolicy = importEsm(
            pathToFileURL(toMcpPackagePath('webUrlPolicy.mjs')).toString(),
        ) as Promise<WebUrlPolicyType>;
    }
    return webUrlPolicy;
}

// Its own session, never the app's. Without `persist:` this is memory-only, so
// nothing a read leaves behind survives a restart -- and, more to the point,
// the page cannot see a cookie, a token or a cached response belonging to
// anything the user is signed in to.
const READ_PARTITION = 'owa-read-website';

// A page is given this long to load and settle. Past it the window is torn
// down and the caller is told the page did not answer, which is a better
// outcome than an assistant hanging mid-service on a slow site.
const LOAD_TIMEOUT_MILLISECONDS = 20 * 1000;

// After `did-finish-load`, before reading. Enough for the common
// render-on-load page to paint; not so long that a read feels broken.
const SETTLE_MILLISECONDS = 1200;

// Reading the loaded page. Shorter than the load: by here the document is
// there and the work is walking it, so a wait this long means the page is
// still running scripts of its own and will not stop for us.
const READ_TIMEOUT_MILLISECONDS = 10 * 1000;

const DEFAULT_VIEWPORT = { width: 1024, height: 768 };

// How tall a picture of a page may get. A screenshot is billed by its area and
// then re-sent on every remaining round, so this is a budget, not a limit of
// the capture: 1024 x 2400 is most of a song page for about three times the
// cost of a viewport, and an endless feed would otherwise cost fifty.
const MAX_CAPTURE_HEIGHT = 2400;

// One frame at the new size before the shutter.
const RESIZE_SETTLE_MILLISECONDS = 350;

let isSessionLockedDown = false;

/**
 * Everything the SESSION can refuse, done once. A permission prompt or a
 * download dialog appearing over a live service, raised by a page nobody in
 * the room chose to visit, is precisely the surprise this whole subsystem is
 * built to avoid.
 */
function lockDownReadSession() {
    const readSession = session.fromPartition(READ_PARTITION);
    if (isSessionLockedDown) {
        return readSession;
    }
    isSessionLockedDown = true;
    // Camera, microphone, location, notifications, clipboard, the lot. Both
    // handlers: `setPermissionRequestHandler` answers a page that asks,
    // `setPermissionCheckHandler` answers one that only queries.
    readSession.setPermissionRequestHandler((_contents, _permission, done) => {
        done(false);
    });
    readSession.setPermissionCheckHandler(() => {
        return false;
    });
    // A page that starts a download would otherwise write to the user's disk
    // and pop a Save As dialog over whatever is on the projector.
    readSession.on('will-download', (event) => {
        event.preventDefault();
    });
    return readSession;
}

function genWebPreferences() {
    return {
        // The three that matter most. Every OTHER renderer in this app runs
        // with node integration on, which is what makes a foreign page loaded
        // into one arbitrary code execution. This window is the exception and
        // must stay it.
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // Left ON, unlike `captureWebScreenShot`: this is a foreign page and
        // same-origin rules are part of what keeps it in its box.
        webSecurity: true,
        // No app code in the page at all. Named explicitly rather than left
        // out, because a preload added "just for this" is how the boundary
        // gets lost later.
        preload: undefined,
        // A page nobody chose to visit must not make noise in a hall.
        autoplayPolicy: 'document-user-activation-required' as const,
        backgroundThrottling: false,
    };
}

/**
 * The one place a navigation is judged, and it runs for the first load, every
 * redirect and anything the page tries afterwards.
 *
 * Synchronous, so it is the address half of the policy only -- the DNS half
 * cannot run inside a `will-redirect` handler. That is the documented residual
 * in `webUrlPolicy.mjs`: a redirect to a NAME that resolves somewhere private
 * is not caught here, while a redirect to a private address, to plain http or
 * to any other scheme is.
 */
function guardNavigation(win: BrowserWindow, policy: WebUrlPolicyType) {
    const handleNavigation = (
        event: { preventDefault: () => void },
        url: string,
    ) => {
        if (!policy.checkWebUrl(url).isAllowed) {
            event.preventDefault();
        }
    };
    win.webContents.on('will-navigate', handleNavigation);
    win.webContents.on('will-redirect', handleNavigation);
    // `window.open` on a page in this app reaches `handlePopupWindowOpen`,
    // which hands out `nodeIntegration: true`. Nothing loaded here may go
    // anywhere near that.
    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' as const };
    });
}

/**
 * Read in the page, with no dependency on anything in the app.
 *
 * `innerText` rather than `textContent` on purpose: it is computed from
 * LAYOUT, so it skips hidden elements and the contents of `<script>` and
 * `<style>` for free, and it breaks lines the way a reader sees them. The
 * `main`/`article` preference is what drops a site's navigation, cookie bar
 * and footer without a single site-specific rule -- with a length floor under
 * it, because a page whose `<main>` is a spinner should fall back to the whole
 * body rather than answer "empty".
 *
 * Two things it does that are worth not undoing:
 *
 *  - **It hides the navigation before reading**, because `<main>` is not
 *    always only the article: Wikipedia's own tab strip ("Article Talk Read
 *    Edit View history") and language switcher sit inside it, and forty words
 *    of chrome at the top of every read is forty words the model pays for and
 *    may quote. Only the roles that mean navigation, never `<header>` -- an
 *    `<article><header><h1>` is the headline, and hiding it would lose the one
 *    line most worth having. The document is mutated rather than cloned
 *    because `innerText` needs layout and a detached node has none; that is
 *    safe here only because this window is destroyed moments later and the
 *    picture, if one was asked for, was already taken.
 *  - **It cuts the text to length in the PAGE.** A long article is ~100 KB of
 *    text and at most 20 KB of it is ever shown, so returning the whole thing
 *    would push 80 KB across the IPC boundary and then across CDP, to be
 *    thrown away -- on a machine chosen for being cheap. The word count is
 *    taken before the cut so the caller can still say how much more there is.
 */
function genReadExpression(maxChars: number) {
    return `(() => {
    const hide = document.querySelectorAll(
        'nav, aside, [role="navigation"], [role="banner"], [role="contentinfo"]',
    );
    for (const element of hide) {
        element.style.display = 'none';
    }
    const pick = () => {
        const main = document.querySelector('main, article, [role="main"]');
        const mainText = main === null ? '' : (main.innerText || '');
        if (mainText.trim().length >= 200) {
            return mainText;
        }
        return (document.body && document.body.innerText) || mainText || '';
    };
    const full = pick()
        .replace(/[ \\t]+\\n/g, '\\n')
        .replace(/\\n{3,}/g, '\\n\\n')
        .trim();
    const seen = new Set();
    const links = [];
    for (const anchor of document.querySelectorAll('a[href]')) {
        const href = anchor.href;
        const text = (anchor.innerText || '').replace(/\\s+/g, ' ').trim();
        if (!/^https?:/.test(href) || text === '' || seen.has(href)) {
            continue;
        }
        seen.add(href);
        links.push({ text: text.slice(0, 80), href });
        if (links.length >= 40) {
            break;
        }
    }
    return {
        title: document.title || '',
        url: location.href,
        text: full.slice(0, ${maxChars}),
        totalWords: full === '' ? 0 : full.split(/\\s+/).length,
        isCut: full.length > ${maxChars},
        links,
    };
})()`;
}

export type WebPageReadType = {
    title: string;
    url: string;
    text: string;
    totalWords: number;
    isCut: boolean;
    links: { text: string; href: string }[];
    imageDataUrl: string | null;
};

/**
 * A picture of the WHOLE page, not of the top of it.
 *
 * `capturePage` photographs the viewport, and the viewport was 768 pixels
 * tall -- on a song page that is the site's own toolbar and nothing else, so
 * the one question a picture is worth asking (which part of this page is the
 * song?) could not be answered from it.
 *
 * Capped, because the picture is charged by its AREA and then rides every
 * remaining round of the question. A page taller than the cap is reported as
 * cut rather than quietly cropped: a reader who is told the picture stops
 * short can ask for the text, and one who is not will believe the song ended.
 */
async function captureWholePage(win: BrowserWindow, width: number) {
    const measured = (await withTimeout(
        win.webContents.executeJavaScript(
            'Math.ceil(Math.max(document.documentElement.scrollHeight, ' +
                'document.body ? document.body.scrollHeight : 0))',
            true,
        ),
        READ_TIMEOUT_MILLISECONDS,
    ).catch(() => {
        return 0;
    })) as number;
    const wanted = Math.max(
        DEFAULT_VIEWPORT.height,
        Math.min(Number(measured) || 0, MAX_CAPTURE_HEIGHT),
    );
    if (wanted > DEFAULT_VIEWPORT.height) {
        win.setContentSize(width, wanted);
        // One paint at the new size. Without it the bottom of a tall page
        // comes back blank, which looks exactly like a page that ends early.
        await new Promise((resolve) => {
            setTimeout(resolve, RESIZE_SETTLE_MILLISECONDS);
        });
    }
    const image = await withTimeout(
        win.webContents.capturePage(),
        READ_TIMEOUT_MILLISECONDS,
    );
    return image.toDataURL();
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => {
                    reject(
                        new Error(
                            'That page did not answer in time. Tell the user ' +
                                'the site did not respond, and offer to try ' +
                                'a different address.',
                        ),
                    );
                }, milliseconds);
            }),
        ]);
    } finally {
        if (timer !== null) {
            clearTimeout(timer);
        }
    }
}

/**
 * Load a public web page in a locked-down offscreen window and answer with its
 * text, its links and -- when asked -- a picture of it.
 *
 * Always tears the window down, on every path. A hidden BrowserWindow left
 * running holds a live page with its timers and its media going, on a machine
 * chosen for being cheap.
 */
export async function readWebPage(
    url: string,
    {
        wantsScreenshot = false,
        maxChars = 20000,
        width = DEFAULT_VIEWPORT.width,
        height = DEFAULT_VIEWPORT.height,
    }: {
        wantsScreenshot?: boolean;
        maxChars?: number;
        width?: number;
        height?: number;
    } = {},
): Promise<WebPageReadType> {
    const policy = await getWebUrlPolicy();
    // Re-checked here even though the MCP firewall already refused a bad
    // address: this function is what opens the socket, and it must not depend
    // on a caller having been careful.
    const verdict = await policy.checkWebUrlIsFetchable(url);
    if (!verdict.isAllowed || verdict.href === undefined) {
        throw new Error(verdict.reason ?? 'That address cannot be read.');
    }
    const readSession = lockDownReadSession();
    const win = new BrowserWindow({
        show: false,
        width,
        height,
        webPreferences: {
            ...genWebPreferences(),
            session: readSession,
        },
    });
    try {
        guardNavigation(win, policy);
        // Belt and braces over `autoplayPolicy`: a hall is not the place to
        // discover a page had a video on it.
        win.webContents.setAudioMuted(true);
        await withTimeout(
            (async () => {
                // The normalised href, never the caller's string: a check made
                // against the canonical address enforces nothing if a
                // different one is fetched.
                await win.loadURL(verdict.href as string);
                await new Promise((resolve) => {
                    setTimeout(resolve, SETTLE_MILLISECONDS);
                });
            })(),
            LOAD_TIMEOUT_MILLISECONDS,
        );
        // The picture first, then the text: reading is harmless, but it is
        // read out of the live document, and a capture taken afterwards would
        // be a photograph of whatever the page did in the meantime.
        const imageDataUrl = wantsScreenshot
            ? await captureWholePage(win, width)
            : null;
        // Timed out like the LOAD is, and for a reason the app has already
        // been bitten by: `executeJavaScript` on a page still busy with its
        // own scripts never settles, so the `finally` below never runs, and
        // the hidden window stays alive with the page running in it. Two of
        // them were left behind by one heavy site, and every later read timed
        // out against a main process busy with pages nobody could see.
        const read = (await withTimeout(
            win.webContents.executeJavaScript(
                genReadExpression(Math.max(200, Math.min(maxChars, 20000))),
                true,
            ),
            READ_TIMEOUT_MILLISECONDS,
        )) as Omit<WebPageReadType, 'imageDataUrl'>;
        return {
            title: String(read?.title ?? ''),
            url: String(read?.url ?? verdict.href),
            text: String(read?.text ?? ''),
            totalWords: Number(read?.totalWords ?? 0),
            isCut: read?.isCut === true,
            links: Array.isArray(read?.links) ? read.links : [],
            imageDataUrl,
        };
    } finally {
        attemptClosing(win);
        // Nothing a page left behind outlives the read. Fire and forget: a
        // failed cleanup must not turn a good answer into an error.
        readSession.clearStorageData().catch(() => {});
    }
}
