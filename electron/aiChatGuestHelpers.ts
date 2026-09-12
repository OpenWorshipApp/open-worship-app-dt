// The box the AI Chat window keeps a website in.
//
// `html/aichat.html` holds a company's own chat page (ChatGPT, Claude,
// Gemini, ...) in a `<webview>` guest, the way a browser's AI sidebar does.
// Every other renderer in this app runs with node integration on, which is
// what makes a foreign page loaded into one arbitrary code execution -- so
// the guest is the one place in the app a stranger's page runs, and this
// file is what keeps it a stranger:
//
//  - the guest's own preferences are FORCED here (`will-attach-webview`), not
//    trusted from the page: no preload, no node, context isolation, sandbox;
//  - it may only ever be on one session, `persist:aichat`, which is locked
//    down once -- no permission granted to anything that asks (camera,
//    microphone, location, notifications) -- and PERSISTENT, so a sign-in
//    survives a restart, which is the point of holding the site here;
//  - it may navigate to http(s) and nothing else, and a link it opens goes to
//    the system browser and never to a window of this app: `window.open` on
//    an app page reaches `handlePopupWindowOpen`, which hands out
//    `nodeIntegration: true`, and nothing loaded here may go near that.
//
// Same split as `webPageHelpers.ts`, which reads a page nobody chose for the
// chatbot's model: what the SESSION can refuse is refused once, what a
// navigation can be judged on is judged every time. Two things differ, both
// because a PERSON is driving this one: downloads are left on Electron's own
// Save dialog rather than refused, and the session persists.

import {
    app,
    session,
    shell,
    type Session,
    type WebContents,
    type WebPreferences,
} from 'electron';
import { pathToFileURL } from 'node:url';

import { importEsm, toMcpPackagePath } from './aiHelpers';

// Its twin in `src/aichat/AiChatAppComp.tsx` is what the page puts on the
// element. A guest on any other partition is refused below.
export const AI_CHAT_PARTITION = 'persist:aichat';

type GuestAddressPolicyType = {
    checkIsLocalHostname: (hostname: string) => boolean;
};

/**
 * Which addresses count as this machine and its network lives in
 * `tools/owa-devtools-mcp/webUrlPolicy.mjs`, the same module the MCP firewall
 * and the chatbot's web reader use, and is loaded the way
 * `webPageHelpers.ts` loads it: `tools/` ships unpacked beside the asar, and
 * `tsc` would rewrite a plain dynamic import into a `require` that cannot
 * load ESM. One dialect, because a second one is a second thing to get wrong
 * about `127.1` and `0x7f.1`.
 */
let addressPolicy: GuestAddressPolicyType | null = null;
let addressPolicyLoad: Promise<void> | null = null;

function loadAddressPolicy() {
    if (addressPolicyLoad === null) {
        addressPolicyLoad = importEsm(
            pathToFileURL(toMcpPackagePath('webUrlPolicy.mjs')).toString(),
        )
            .then((policy: GuestAddressPolicyType) => {
                addressPolicy = policy;
            })
            .catch((error: unknown) => {
                // Fail closed and say so. Without the policy nothing can be
                // shown to be on the public internet, and this is the one
                // renderer in the app running a page nobody here wrote.
                addressPolicy = null;
                console.error('AI Chat address policy could not load', error);
            });
    }
    return addressPolicyLoad;
}

/**
 * Whether a request the guest is making may leave for the address it names.
 *
 * The fifth wall, and the one the other four say nothing about. The guest's
 * preferences, its session, its navigation and the host page all keep the
 * SITE out of the app -- and none of them touches the fact that the site is
 * running on a machine whose loopback carries this app's own doors: the CDP
 * endpoint (a WebSocket into renderers that all have node integration) and
 * the MCP host (click, present, write a file). Measured 2026-09-12 from
 * inside a live guest: a cross-origin READ of either is refused by CORS and a
 * CDP WebSocket by Chromium's own origin rule, but a `no-cors` `fetch` at
 * both went out and was served -- a blind request needs no permission and
 * reads no answer, which is all a state-changing call needs. Beyond this app
 * the same request reaches the church's router, its NAS and its printers.
 *
 * So the guest's session may talk to the public internet and nothing else. No
 * chat site asks for a local address; one that ever does gets the
 * `Open in your browser` button, not a hole here.
 */
export function checkIsGuestRequestAllowed(
    url: string,
    policy: GuestAddressPolicyType,
) {
    if (!URL.canParse(url)) {
        return false;
    }
    return !policy.checkIsLocalHostname(new URL(url).hostname);
}

// Every request on the guest session, because the filter cannot say what this
// has to say: Chromium's match patterns take a `*` host or a `*.suffix` one
// and no address range, so `127.0.0.2` -- loopback, and not `127.0.0.1` --
// would walk through a pattern list. The listener is what judges, and the
// cost of routing a chat site's requests through the main process is what
// that correctness is bought with. `ws:`/`wss:` are outside a `*://` pattern
// and stay Chromium's business; the only WebSocket server on this loopback is
// the CDP endpoint, which refuses a foreign origin.
const GUEST_REQUEST_FILTER = { urls: ['*://*/*'] };

function guardGuestSessionRequests(guestSession: Session) {
    // Electron keeps ONE `onBeforeRequest` listener per session: anything
    // else registered on this partition later would silently replace this
    // wall rather than sit beside it.
    guestSession.webRequest.onBeforeRequest(
        GUEST_REQUEST_FILTER,
        (details, callback) => {
            if (addressPolicy !== null) {
                callback({
                    cancel: !checkIsGuestRequestAllowed(
                        details.url,
                        addressPolicy,
                    ),
                });
                return;
            }
            // Only reachable if a guest exists before the policy has landed,
            // which needs the window opened in the same breath as the app.
            loadAddressPolicy().then(() => {
                callback({
                    cancel:
                        addressPolicy === null ||
                        !checkIsGuestRequestAllowed(details.url, addressPolicy),
                });
            });
        },
    );
}

// The one permission a chat site needs and a person expects: its Copy button.
// Everything else -- `media` (voice mode), `notifications`, `clipboard-read`,
// `geolocation`, the lot -- is refused without a prompt: a permission dialog
// over a live service, raised by a page in a side window, is exactly the
// surprise the rest of this app is built to avoid.
const GRANTED_PERMISSION_SET = new Set<string>(['clipboard-sanitized-write']);

/** Where a guest may go: the web, and nothing on this machine. */
export function checkIsGuestUrlAllowed(url: string) {
    if (!URL.canParse(url)) {
        return false;
    }
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
}

/**
 * Whether a `<webview>` about to attach is the one this app hosts: an https
 * site, on the one locked-down partition. Anything else -- a partition with
 * a session nobody locked down, a `file:` address -- is refused outright.
 */
export function checkIsGuestAttachAllowed(params: Record<string, string>) {
    const src = params.src ?? '';
    return (
        params.partition === AI_CHAT_PARTITION &&
        URL.canParse(src) &&
        new URL(src).protocol === 'https:'
    );
}

/**
 * The preferences a guest gets, whatever the page asked for. Mutated in place
 * because that is the shape `will-attach-webview` hands them over in.
 */
export function toGuestWebPreferences(webPreferences: WebPreferences) {
    delete webPreferences.preload;
    delete (webPreferences as { preloadURL?: string }).preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    return webPreferences;
}

/**
 * Where a navigation or an outgoing link may go: the protocol first, then the
 * address. Synchronous, because `preventDefault` is -- so it reads whatever
 * the policy has become rather than waiting for it. A navigation made in the
 * moment before the policy lands is still stopped by the request wall above,
 * which can afford to wait; this is the cheaper first line, not the only one.
 */
function checkIsGuestDestinationAllowed(url: string) {
    if (!checkIsGuestUrlAllowed(url)) {
        return false;
    }
    return (
        addressPolicy === null || checkIsGuestRequestAllowed(url, addressPolicy)
    );
}

function guardGuest(contents: WebContents) {
    const handleNavigation = (
        event: { preventDefault: () => void },
        url: string,
    ) => {
        if (!checkIsGuestDestinationAllowed(url)) {
            event.preventDefault();
        }
    };
    contents.on('will-navigate', handleNavigation);
    contents.on('will-redirect', handleNavigation);
    contents.setWindowOpenHandler(({ url }) => {
        // A link out of the site (a citation, a "learn more") opens in the
        // browser the user already has. Never a window of this app, and never
        // the machine's own network -- an address the guest is refused is not
        // one to hand the system browser on the site's say-so.
        if (checkIsGuestDestinationAllowed(url)) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });
}

let isInitiated = false;

/**
 * Once, after `ready`: lock the guest session down and watch for guests.
 * Registered on `app` rather than on the AI Chat window because the window
 * is opened by a renderer's `window.open`, and a guest is created before any
 * code here could find that window.
 */
export function initAiChatGuestGuard() {
    if (isInitiated) {
        return;
    }
    isInitiated = true;
    // Started now so the request wall is judging rather than waiting by the
    // time a guest can exist: the window is opened by a human press, and this
    // runs at startup.
    loadAddressPolicy();
    const guestSession = session.fromPartition(AI_CHAT_PARTITION);
    guardGuestSessionRequests(guestSession);
    // The user agent is deliberately LEFT AS ELECTRON'S OWN. The first cut
    // rewrote it to plain Chrome so Google would not refuse a sign-in from a
    // browser that names Electron -- and claude.ai's Cloudflare check then
    // looped on "Verify you are human" for good (2026-09-11): a user agent
    // claiming Google Chrome from a browser whose every other trait says
    // Chromium is exactly the mismatch a bot check scores on. With the
    // honest one Cloudflare let the page through with no box at all, and
    // accounts.google.com showed its ordinary email prompt. Should Google
    // ever refuse a sign-in here, rewrite the `User-Agent` HEADER for its
    // sign-in hosts alone in `webRequest.onBeforeSendHeaders`, never what
    // the page's own script can read.
    guestSession.setPermissionRequestHandler((_contents, permission, done) => {
        done(GRANTED_PERMISSION_SET.has(permission));
    });
    guestSession.setPermissionCheckHandler((_contents, permission) => {
        return GRANTED_PERMISSION_SET.has(permission);
    });
    app.on('web-contents-created', (_event, contents) => {
        // The HOST side: every page gets this listener, and it only ever
        // fires in the one window whose preferences allow a `<webview>`.
        contents.on('will-attach-webview', (event, webPreferences, params) => {
            if (!checkIsGuestAttachAllowed(params)) {
                event.preventDefault();
                return;
            }
            toGuestWebPreferences(webPreferences);
        });
        if (contents.getType() === 'webview') {
            guardGuest(contents);
        }
    });
}

/**
 * Sign out of every site: throw the guest partition away whole -- its cookies,
 * its storage, its caches and any HTTP auth it is holding.
 *
 * The partition is PERSISTENT on purpose, because a sign-in that survives a
 * restart is the reason the window exists rather than a browser tab. On a
 * shared church computer that is also the problem: the volunteer who opened
 * ChatGPT before the service is still signed in for whoever sits down after
 * it, and closing every tab does not touch it -- the tabs are a setting file,
 * the sign-in is a Chromium profile beside it. This is the only thing in the
 * app that ends one.
 *
 * It asks nothing. The window asks, twice, before it calls this.
 */
export async function clearAiChatGuestData() {
    const guestSession = session.fromPartition(AI_CHAT_PARTITION);
    await guestSession.clearStorageData();
    await guestSession.clearCache();
    // Cookies are storage; an HTTP auth credential is not, and outlives
    // `clearStorageData` on its own.
    await guestSession.clearAuthCache();
}
