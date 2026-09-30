/**
 * The box a WEBSITE ITEM is photographed in, for `captureWebScreenShot`.
 *
 * ## Why this is not `webPageHelpers.ts`
 *
 * That module reads a page a language MODEL chose, and refuses anything off
 * the public web outright. This one renders an address the USER typed into a
 * slide -- a church's own intranet notice board is a legitimate website item --
 * so the two cannot share one policy without the stricter one breaking a
 * feature or the looser one being handed to the assistant. What they DO share
 * is the address dialect (`webUrlPolicy.mjs`), because `127.1`, `0x7f.1` and
 * `localtest.me` must mean the same thing in both.
 *
 * ## What this window was, and why it needed a box
 *
 * `captureWebScreenShot` opened a bare hidden `BrowserWindow` on the app's
 * DEFAULT session with `webSecurity: false` and no handler of any kind, and
 * loaded whatever address the document carried. Every one of those is reached
 * by OPENING A SHARED DOCUMENT -- a presenting flow handed over on a memory
 * stick, a `.owadoc` from another church -- with no model and no agent
 * anywhere near it:
 *
 *  - **The app's own doors.** This machine's loopback carries the CDP endpoint
 *    (a WebSocket into renderers that all have node integration) and the MCP
 *    host (click, present, write a file), and with `webSecurity: false` there
 *    is no CORS between a slide's page and either. This is the same wall the
 *    AI Chat guest got on 2026-09-12, in the one renderer that never had it.
 *  - **The room's network.** The church's router, its NAS, its printers, and
 *    whatever OBS or Companion is listening on for a presentation remote.
 *  - **The operator's disk.** `file:///C:/Users/.../setting.json` is a URL, and
 *    `webSecurity: false` lets a `file://` page read its neighbours.
 *  - **The user's signed-in sessions**, because it ran on the app's own
 *    session -- plus a Save As dialog or a permission prompt over a live
 *    projector, raised by a page nobody in the room chose to visit.
 *
 * ## The rule
 *
 * **A capture may talk to the site it was asked for and to the public
 * internet; never to this machine, and never to anything else on the local
 * network.** The same-host exemption is what keeps the intranet notice board
 * working: a private page may load its own images and stylesheets, and
 * nothing else private. Loopback has no exemption at all -- that is where this
 * app's own doors live, and no slide needs it.
 *
 * ## The app's own pages are `file:` URLs, and they are not the threat
 *
 * The Webs panel's **New File** writes an `.html` into `<data folder>/webs`,
 * the app's own editor edits it, and the Background tab, every Foreground
 * **Web Show** widget and a slide's website item put that page up as a `file:`
 * URL. A blanket "http(s) only" refusal took all of them down at once -- the
 * globe-and-url placeholder in every tile and one error per file in the
 * console -- while the genuinely dangerous address, `file:///C:/Users/.../
 * setting.json`, differs from them not in its SCHEME but in its FOLDER.
 *
 * So the second rule is **a local page may be captured only out of a folder
 * this app's Webs panel was pointed at, and it may read that folder and
 * nothing else of this machine.** A path a shared document carries is judged
 * by the same test and fails it, because it names the other church's folders;
 * where the two really are the same item, `$DATA_DIR_PATH` has already
 * rewritten it into THIS user's own webs folder by the time it gets here.
 *
 * `webSecurity` is deliberately still OFF. It is the one setting here that
 * might be load-bearing for a real user's slide, nothing measured says whether
 * it is, and the walls above close what it would otherwise open -- for a local
 * page it is also what the projector already gives it, since the screen's own
 * iframe carries `allow-same-origin`. See `MC-16`.
 */
import { type BrowserWindow, session, type Session } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { importEsm, toMcpPackagePath } from './aiHelpers';

type CaptureAddressPolicyType = {
    checkIsLocalHostname: (hostname: string) => boolean;
};

// Its own session, never the app's. Without `persist:` this is memory-only, so
// a page a document pointed at cannot read a cookie or a cached response
// belonging to anything the user is signed in to, and leaves nothing behind.
const CAPTURE_PARTITION = 'owa-capture-website';

// Every request on the capture session, for the reason
// `aiChatGuestHelpers.ts` spells out: Chromium's match patterns take a `*`
// host or a `*.suffix` one and no address range, so `127.0.0.2` -- loopback,
// and not `127.0.0.1` -- walks through a pattern list. The listener is what
// judges. `ws://` and `wss://` need patterns of their own because `*://` is
// http and https and nothing else; not `<all_urls>`, whose `data:` and
// `blob:` loads have an empty host that counts as local. `file:///*` is the
// disk: a local page reads its own folder through it, and a SITE's page must
// not read it at all -- without the pattern neither request is ever judged.
const CAPTURE_REQUEST_URL_PATTERNS = [
    '*://*/*',
    'ws://*/*',
    'wss://*/*',
    'file:///*',
];

let addressPolicy: CaptureAddressPolicyType | null = null;
let addressPolicyLoad: Promise<void> | null = null;

/**
 * Loaded the way `webPageHelpers.ts` and `aiChatGuestHelpers.ts` load it:
 * `tools/` ships unpacked beside the asar, and `tsc` would rewrite a plain
 * dynamic import into a `require` that cannot load ESM.
 */
function loadAddressPolicy() {
    if (addressPolicyLoad === null) {
        addressPolicyLoad = importEsm(
            pathToFileURL(toMcpPackagePath('webUrlPolicy.mjs')).toString(),
        )
            .then((policy: CaptureAddressPolicyType) => {
                addressPolicy = policy;
            })
            .catch((error: unknown) => {
                // Fail CLOSED and say so. Without the dialect nothing can be
                // shown to be off this machine, and the whole point of the
                // wall is that the page was chosen by a document rather than
                // by anyone in the room.
                addressPolicy = null;
                console.error('Capture address policy could not load', error);
            });
    }
    return addressPolicyLoad;
}

/** Only a real web page. A `file:` or `data:` URL is not a website item. */
export function checkIsCaptureUrlAllowed(url: string) {
    if (!URL.canParse(url)) {
        return false;
    }
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
}

/**
 * The app's own local pages, and the folders they are allowed to live in.
 *
 * The two names below are the RENDERER's -- `dirSourceSettingNames.
 * BACKGROUND_WEB` and `defaultDataDirNames.BACKGROUND_WEB` in
 * `src/helper/constants.ts` -- and `electron/` may not import from `src/`, so
 * `webCaptureHelpers.test.ts` reads that module and holds the copies to it. A
 * silent rename there would otherwise switch every local web tile off again.
 */
export const WEB_CAPTURE_DIR_SETTING_NAME_PREFIX = 'select-dir-web-bg';
export const WEB_CAPTURE_DEFAULT_DIR_NAME = 'webs';
const LOCAL_WEB_FILE_EXTENSION_LIST = ['.html', '.htm'];
// `dataDirAliasHelpers.ts`'s alias as a DIRECTORY SETTING stores it: raw and
// never JSON-escaped, because one of those files holds one path and nothing
// else.
const DATA_DIR_PATH_ALIAS = '$DATA_DIR_PATH';

/**
 * A directory setting's stored text as a path on THIS machine -- the data
 * folder travels between computers, so both the alias and the other OS
 * family's separator have to be read -- or null when it names nothing usable.
 */
export function toCaptureDirPath(text: string, dataDirPath: string) {
    const trimmedText = text.trim();
    if (trimmedText === '') {
        return null;
    }
    if (trimmedText.startsWith(DATA_DIR_PATH_ALIAS)) {
        const tail = trimmedText
            .slice(DATA_DIR_PATH_ALIAS.length)
            .replace(/[\\/]+/g, path.sep);
        return path.resolve(path.join(dataDirPath, tail));
    }
    return path.isAbsolute(trimmedText) ? path.resolve(trimmedText) : null;
}

// Windows compares paths without case, and so does a Mac's disk as it is sold.
// Linux does not, and folding there would let a folder nobody registered pass
// for one that was.
function toComparablePath(filePath: string) {
    const resolvedPath = path.resolve(filePath);
    return process.platform === 'win32' || process.platform === 'darwin'
        ? resolvedPath.toLowerCase()
        : resolvedPath;
}

/** Whether `filePath` sits inside `dirPath` -- `..` resolved away first. */
export function checkIsPathInsideDir(dirPath: string, filePath: string) {
    const comparableDirPath = toComparablePath(dirPath);
    const prefix = comparableDirPath.endsWith(path.sep)
        ? comparableDirPath
        : `${comparableDirPath}${path.sep}`;
    return toComparablePath(filePath).startsWith(prefix);
}

/** A `file:` URL as a path on this machine, or null for anything else. */
export function toCaptureFilePath(url: string) {
    if (!URL.canParse(url)) {
        return null;
    }
    const parsedUrl = new URL(url);
    // `file://server/share` is a machine on the room's network wearing a file
    // URL, which is the one thing this whole module exists to refuse.
    if (parsedUrl.protocol !== 'file:' || parsedUrl.host !== '') {
        return null;
    }
    try {
        const filePath = fileURLToPath(parsedUrl);
        return filePath.includes('\0') ? null : filePath;
    } catch (_error) {
        return null;
    }
}

/**
 * The web folder a local page belongs to, or null when it belongs to none of
 * them. The extension is checked as well as the folder: a page is what a
 * website item shows, and `setting.json` must not become one by being moved.
 */
export function findLocalWebFileDirPath(url: string, dirPathList: string[]) {
    const filePath = toCaptureFilePath(url);
    if (
        filePath === null ||
        !LOCAL_WEB_FILE_EXTENSION_LIST.includes(
            path.extname(filePath).toLowerCase(),
        )
    ) {
        return null;
    }
    return (
        dirPathList.find((dirPath) => {
            return checkIsPathInsideDir(dirPath, filePath);
        }) ?? null
    );
}

/** A site, or one of the app's own local pages -- and `dirPath` is the only
 * folder of this machine that page may read. */
export type CaptureTargetType =
    { kind: 'web'; hostname: string } | { kind: 'file'; dirPath: string };

/**
 * What this capture IS, or null when it is neither and must be refused.
 *
 * `listWebDirPaths` is a callback rather than a list because reading the app's
 * own web folders is a `readdir` and all but a handful of captures are
 * ordinary web addresses -- they must not pay for it.
 */
export async function resolveCaptureTarget(
    url: string,
    listWebDirPaths: () => Promise<string[]>,
): Promise<CaptureTargetType | null> {
    if (checkIsCaptureUrlAllowed(url)) {
        return { kind: 'web', hostname: new URL(url).hostname };
    }
    const dirPath = findLocalWebFileDirPath(url, await listWebDirPaths());
    return dirPath === null ? null : { kind: 'file', dirPath };
}

// The three RFC1918 ranges, written out. These -- and only these -- are the
// "another machine on our own network" a slide may legitimately name, so they
// are the whole of what the same-host exemption is allowed to cover. Link-local
// (`169.254`, which carries cloud metadata), carrier-grade NAT and the
// protocol-assignment blocks are left OUT on purpose: the dialect calls them
// local, nothing in a church names them, and each one is somewhere a page
// should not be able to sit.
function checkIsLanAddress(bare: string) {
    const parts = bare.split('.');
    if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) {
        return false;
    }
    const [a, b] = parts.map(Number);
    return (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
    );
}

/**
 * Whether a hostname means THIS MACHINE rather than the network around it.
 *
 * Asked of the dialect first, so `::ffff:7f00:1`, `127.1` and `0x7f.1` --
 * already canonicalised by the URL parser -- are read the same way here as in
 * the firewall. What it calls local and is not a LAN address is treated as
 * this machine: `localhost`, a bare single-label name, `::1`, a mapped
 * loopback. That is the safe way to be wrong about an address nobody can name.
 */
function checkIsLoopbackHostname(
    hostname: string,
    policy: CaptureAddressPolicyType,
) {
    const bare = hostname
        .toLowerCase()
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .replace(/\.$/, '');
    if (!policy.checkIsLocalHostname(bare)) {
        return false;
    }
    return !checkIsLanAddress(bare);
}

/**
 * Whether a request the captured page is making may leave.
 *
 * `captureHostname` is the host the capture was ASKED for -- the address in
 * the slide. A private page may talk to itself; a public one may not reach
 * anything private at all. Loopback is refused either way, so a slide pointed
 * at this app's own doors cannot walk from one port to the next.
 */
export function checkIsCaptureRequestAllowed(
    url: string,
    captureHostname: string,
    policy: CaptureAddressPolicyType,
) {
    if (!URL.canParse(url)) {
        return false;
    }
    const { hostname } = new URL(url);
    if (!policy.checkIsLocalHostname(hostname)) {
        return true;
    }
    return (
        hostname.toLowerCase() === captureHostname.toLowerCase() &&
        !checkIsLoopbackHostname(hostname, policy)
    );
}

/**
 * The same question for one of the app's OWN pages.
 *
 * It may read the folder it lives in -- its own stylesheet, its own font, the
 * picture beside it -- and it may reach the public internet, the way the same
 * page does when the projector renders it live. It may not read another folder
 * on this machine, and it may not reach anything in the room. The folder is
 * the wall because the folder is what the user pointed the Webs panel at:
 * everything in it is already theirs.
 */
export function checkIsCaptureFileRequestAllowed(
    url: string,
    dirPath: string,
    policy: CaptureAddressPolicyType,
) {
    const filePath = toCaptureFilePath(url);
    if (filePath !== null) {
        return checkIsPathInsideDir(dirPath, filePath);
    }
    if (!URL.canParse(url)) {
        return false;
    }
    return !policy.checkIsLocalHostname(new URL(url).hostname);
}

/** The one question the wall asks, whichever kind of page is being captured. */
export function checkIsCaptureRequestAllowedForTarget(
    url: string,
    target: CaptureTargetType,
    policy: CaptureAddressPolicyType,
) {
    if (target.kind === 'file') {
        return checkIsCaptureFileRequestAllowed(url, target.dirPath, policy);
    }
    // A site's page has no business reading this machine's disk at all.
    if (toCaptureFilePath(url) !== null) {
        return false;
    }
    return checkIsCaptureRequestAllowed(url, target.hostname, policy);
}

let isSessionLockedDown = false;

/**
 * Everything the SESSION can refuse, done once. A permission prompt or a
 * download dialog over a live projector, raised by a page a shared document
 * pointed at, is precisely the surprise this app is built to avoid.
 */
export function lockDownCaptureSession() {
    const captureSession = session.fromPartition(CAPTURE_PARTITION);
    if (isSessionLockedDown) {
        return captureSession;
    }
    isSessionLockedDown = true;
    captureSession.setPermissionRequestHandler(
        (_contents, _permission, done) => {
            done(false);
        },
    );
    captureSession.setPermissionCheckHandler(() => {
        return false;
    });
    captureSession.on('will-download', (event) => {
        event.preventDefault();
    });
    return captureSession;
}

/**
 * The network wall, aimed at the page this capture is for.
 *
 * Electron keeps ONE `onBeforeRequest` listener per session, so this REPLACES
 * the last one rather than sitting beside it -- which is also how the wall
 * learns which host, or which folder, is allowed to talk to itself. Two
 * captures in flight at once share the later one's target; that is the
 * stricter mistake, and only when the two differ.
 */
export function guardCaptureSessionRequests(
    captureSession: Session,
    target: CaptureTargetType,
) {
    captureSession.webRequest.onBeforeRequest(
        { urls: CAPTURE_REQUEST_URL_PATTERNS },
        (details, callback) => {
            const decide = () => {
                callback({
                    cancel:
                        addressPolicy === null ||
                        !checkIsCaptureRequestAllowedForTarget(
                            details.url,
                            target,
                            addressPolicy,
                        ),
                });
            };
            if (addressPolicy !== null) {
                decide();
                return;
            }
            loadAddressPolicy().then(decide);
        },
    );
}

/**
 * Where the capture window may go once it is loaded.
 *
 * A redirect to `file:` is how a page gets off the web after the first load
 * has already been judged, so a web capture stays on the web. One of the
 * app's own pages may walk within its own folder -- a link from `index.html`
 * to `clock.html` is the same folder the user put both in.
 */
export function checkIsCaptureNavigationAllowed(
    url: string,
    target: CaptureTargetType,
) {
    if (checkIsCaptureUrlAllowed(url)) {
        return true;
    }
    return (
        target.kind === 'file' &&
        findLocalWebFileDirPath(url, [target.dirPath]) !== null
    );
}

/** The window's own refusals: a popup is a way back into a node renderer. */
export function guardCaptureWindow(
    win: BrowserWindow,
    target: CaptureTargetType,
) {
    // `window.open` from a page in this app reaches `handlePopupWindowOpen`
    // wherever `guardBrowsing` ran, and Electron's own default otherwise --
    // either way a window a document asked for, over a service. Denied.
    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' as const };
    });
    const handleNavigation = (
        event: { preventDefault: () => void },
        url: string,
    ) => {
        if (!checkIsCaptureNavigationAllowed(url, target)) {
            event.preventDefault();
        }
    };
    win.webContents.on('will-navigate', handleNavigation);
    win.webContents.on('will-redirect', handleNavigation);
}

/**
 * The session a capture runs in, walled for this page. Awaited before the
 * window is built so the dialect is never a load behind the first request.
 */
export async function prepareCaptureSession(target: CaptureTargetType) {
    await loadAddressPolicy();
    const captureSession = lockDownCaptureSession();
    guardCaptureSessionRequests(captureSession, target);
    return CAPTURE_PARTITION;
}
