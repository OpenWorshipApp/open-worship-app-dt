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
//    location, notifications, screen), the microphone only when the person
//    says yes on the window's own line -- and PERSISTENT, so a sign-in
//    survives a restart, which is the point of holding the site here;
//  - it may navigate to http(s) and nothing else, and a link it opens goes to
//    the system browser and never to a window of this app: `window.open` on
//    an app page reaches `handlePopupWindowOpen`, which hands out
//    `nodeIntegration: true`, and nothing loaded here may go near that. Even
//    the browser gets a link only for a press the person made in the page;
//  - its requests -- WebSockets included -- reach the public internet and
//    nothing on this machine or its network.
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
    webContents,
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
// that correctness is bought with.
//
// WebSockets need patterns of their own. `*://` means http and https and
// nothing else, so until 2026-09-14 a WebSocket handshake never reached the
// listener at all: measured from inside a claude.ai guest, `ws://` to
// 127.0.0.1, localhost, 127.1, [::1] and 127.0.0.2 all OPENED and a
// throwaway server on each received the handshake with the site's Origin,
// while plain http to the same server was refused. A church machine's
// loopback is where OBS, Companion and presentation remotes listen for
// exactly that kind of connection, many of them with no origin check. The
// `ws://` and `wss://` patterns were proven on this Electron (43.3.0) in a
// harness of its own first: the listener sees the handshake as `webSocket`,
// a cancel closes it, and ordinary pages still load. Not `<all_urls>`: that
// also hands the listener `data:` and `blob:` loads, whose empty host counts
// as local, and every site would break.
export const GUEST_REQUEST_URL_PATTERNS = ['*://*/*', 'ws://*/*', 'wss://*/*'];
const GUEST_REQUEST_FILTER = { urls: GUEST_REQUEST_URL_PATTERNS };

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
// Everything else -- the camera, `notifications`, `clipboard-read`,
// `geolocation`, the lot -- is refused without a prompt: a permission dialog
// over a live service, raised by a page in a side window, is exactly the
// surprise the rest of this app is built to avoid. The microphone is the one
// exception, and it is ASKED, below.
const GRANTED_PERMISSION_SET = new Set<string>(['clipboard-sanitized-write']);

// Twins of the channel names in `src/aichat/aiChatMicrophoneHelpers.ts`.
export const AI_CHAT_MICROPHONE_ASK_CHANNEL = 'app:ai-chat:microphone-ask';
export const AI_CHAT_MICROPHONE_SETTLED_CHANNEL =
    'app:ai-chat:microphone-settled';
export const AI_CHAT_MICROPHONE_ANSWER_CHANNEL =
    'main:app:ai-chat-microphone-answer';

// Long enough to read the line and decide; short enough that a question
// nobody answered does not hold the site's request open for good.
const MICROPHONE_ASK_TIMEOUT_MS = 2 * 60 * 1000;

type MicrophoneAskDetailsType = {
    isMainFrame: boolean;
    requestingUrl?: string;
    mediaTypes?: readonly string[];
};

/**
 * The origin a microphone ask is for, or null when the ask is anything else.
 *
 * Asked for on 2026-09-14 with a picture of claude.ai's dictation button under
 * "Microphone access is blocked" -- the site's own words, pointing at a
 * browser address bar this window does not have, so the person had nothing
 * to press. So the microphone, and only the microphone, is ASKED rather than
 * refused. Only when all of this holds:
 *
 *  - `media`, and every media type in it is `audio`: a request that also
 *    wants the camera is refused whole, never half-granted;
 *  - the site's own top page (`isMainFrame`): an ad or an embedded frame on
 *    the page never gets to ask;
 *  - https: a microphone needs a secure page, and the guest may only ever be
 *    on the public internet anyway -- the request wall above cancels every
 *    local address before a page there could exist.
 */
export function toMicrophoneOrigin(
    permission: string,
    details: MicrophoneAskDetailsType,
) {
    if (permission !== 'media' || !details.isMainFrame) {
        return null;
    }
    const mediaTypes = details.mediaTypes ?? [];
    if (
        mediaTypes.length === 0 ||
        mediaTypes.some((mediaType) => {
            return mediaType !== 'audio';
        })
    ) {
        return null;
    }
    const url = details.requestingUrl ?? '';
    if (!URL.canParse(url)) {
        return null;
    }
    const { protocol, origin } = new URL(url);
    return protocol === 'https:' ? origin : null;
}

type MicrophoneAskType = {
    origin: string;
    guestId: number;
    // The AI Chat window the question went to: the only sender whose answer
    // counts.
    hostId: number;
    doneList: ((isAllowed: boolean) => void)[];
    timer: ReturnType<typeof setTimeout>;
    release: () => void;
};

const microphoneAskMap = new Map<number, MicrophoneAskType>();
// Sites the person said yes to, by origin. In memory ONLY: gone when the app
// closes, and emptied by Sign out of every site. At most one entry per site a
// person pressed Allow for, so it cannot grow on its own.
const allowedMicrophoneOriginSet = new Set<string>();
let lastMicrophoneAskId = 0;

function settleMicrophoneAsk(askId: number, isAllowed: boolean) {
    const ask = microphoneAskMap.get(askId);
    if (ask === undefined) {
        return;
    }
    microphoneAskMap.delete(askId);
    clearTimeout(ask.timer);
    ask.release();
    if (isAllowed) {
        allowedMicrophoneOriginSet.add(ask.origin);
    }
    // However it ended, the window's line has nothing left to ask.
    const host = webContents.fromId(ask.hostId);
    if (host !== undefined && !host.isDestroyed()) {
        host.send(AI_CHAT_MICROPHONE_SETTLED_CHANNEL, { askId });
    }
    for (const done of ask.doneList) {
        done(isAllowed);
    }
}

/**
 * Hand a microphone ask to the AI Chat window holding the guest, which knows
 * what this process cannot: whether that guest is the tab in FRONT, and
 * whether the page is that tab's own site. Even a site already allowed goes
 * through the window, so a tab nobody is looking at cannot open a microphone
 * on a yes given to it earlier.
 */
export function askAiChatMicrophone(
    guest: WebContents,
    origin: string,
    done: (isAllowed: boolean) => void,
) {
    const host = guest.hostWebContents;
    if (!host || host.isDestroyed()) {
        done(false);
        return;
    }
    for (const ask of microphoneAskMap.values()) {
        if (ask.guestId === guest.id && ask.origin === origin) {
            ask.doneList.push(done);
            return;
        }
    }
    lastMicrophoneAskId += 1;
    const askId = lastMicrophoneAskId;
    const handleEnding = () => {
        settleMicrophoneAsk(askId, false);
    };
    guest.once('destroyed', handleEnding);
    microphoneAskMap.set(askId, {
        origin,
        guestId: guest.id,
        hostId: host.id,
        doneList: [done],
        timer: setTimeout(handleEnding, MICROPHONE_ASK_TIMEOUT_MS),
        release: () => {
            guest.removeListener('destroyed', handleEnding);
        },
    });
    host.send(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
        askId,
        guestId: guest.id,
        hostname: new URL(origin).hostname,
        isAllowed: allowedMicrophoneOriginSet.has(origin),
    });
}

/** The window's answer. Only the window that was asked may give one. */
export function answerAiChatMicrophoneAsk(senderId: number, data: unknown) {
    if (typeof data !== 'object' || data === null) {
        return;
    }
    const { askId, isAllowed } = data as Record<string, unknown>;
    if (typeof askId !== 'number') {
        return;
    }
    const ask = microphoneAskMap.get(askId);
    if (ask === undefined || ask.hostId !== senderId) {
        return;
    }
    settleMicrophoneAsk(askId, isAllowed === true);
}

/** Every yes taken back, and every question still open answered no. */
export function forgetAiChatMicrophoneGrants() {
    allowedMicrophoneOriginSet.clear();
    for (const askId of Array.from(microphoneAskMap.keys())) {
        settleMicrophoneAsk(askId, false);
    }
}

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
 * Where a navigation may go: the protocol first, then the address.
 * Synchronous, because `preventDefault` is -- so it reads whatever the policy
 * has become rather than waiting for it. A navigation made in the moment
 * before the policy lands is still stopped by the request wall above, which
 * can afford to wait; this is the cheaper first line, not the only one.
 */
function checkIsGuestDestinationAllowed(url: string) {
    if (!checkIsGuestUrlAllowed(url)) {
        return false;
    }
    return (
        addressPolicy === null || checkIsGuestRequestAllowed(url, addressPolicy)
    );
}

// The input a person makes when they press something in the page: a click, a
// key, a tap. Moving the mouse over it is not asking for anything.
export const GUEST_PRESS_INPUT_TYPE_SET = new Set<string>([
    'mouseDown',
    'mouseUp',
    'rawKeyDown',
    'keyDown',
    'touchStart',
    'touchEnd',
    'gestureTap',
]);

// How long a press counts as the person asking for what the page opens next.
// Chromium's own user activation lasts the same five seconds, which covers a
// site that looks something up between the click and the window.
export const GUEST_PRESS_FRESH_MS = 5000;

export function checkIsGuestPressFresh(
    lastPressAt: number | null,
    now: number,
) {
    return (
        lastPressAt !== null &&
        now >= lastPressAt &&
        now - lastPressAt <= GUEST_PRESS_FRESH_MS
    );
}

export type GuestWindowOpenDecisionType = 'open' | 'refuse' | 'refuse-and-tell';

/**
 * What to do with a page's `window.open`, which from a guest can only ever
 * mean the person's own browser.
 *
 * `allowpopups` is on the guest so that a pressed link reaches this instead
 * of dying in silence -- and Electron applies no popup blocker to a guest
 * that has it. Measured 2026-09-14 on this app's Electron (43.3.0): a page's
 * `window.open` from a timer, with nothing pressed, reached the handler, which
 * then opened the system browser. An ad script on a chat site could put
 * browser windows over a live service one after another, and nobody would
 * have asked for any of them.
 *
 * So a page may hand the browser ONE page per press made inside it, within
 * five seconds of the press. Anything else is refused, and the window is
 * told when it was a page the person might have wanted. An address the guest
 * itself is refused -- this machine, its network, anything not http(s) -- is
 * never handed to the browser on the site's say-so, and nothing is while the
 * address policy has not loaded.
 */
export function decideGuestWindowOpen(
    url: string,
    lastPressAt: number | null,
    now: number,
    policy: GuestAddressPolicyType | null,
): GuestWindowOpenDecisionType {
    if (
        policy === null ||
        !checkIsGuestUrlAllowed(url) ||
        !checkIsGuestRequestAllowed(url, policy)
    ) {
        return 'refuse';
    }
    return checkIsGuestPressFresh(lastPressAt, now)
        ? 'open'
        : 'refuse-and-tell';
}

// Twin of the channel name in `src/aichat/aiChatPopupHelpers.ts`.
export const AI_CHAT_POPUP_REFUSED_CHANNEL = 'app:ai-chat:popup-refused';

// A page opening windows in a loop earns one line in the window, not a
// flicker of them.
const POPUP_NOTICE_GAP_MS = 5000;

function tellHostPopupRefused(contents: WebContents, url: string) {
    const host = contents.hostWebContents;
    if (!host || host.isDestroyed()) {
        return;
    }
    host.send(AI_CHAT_POPUP_REFUSED_CHANNEL, {
        guestId: contents.id,
        hostname: new URL(url).hostname,
    });
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
    // Read here in the main process, where a page's script cannot make one.
    // Measured on the same Electron: the press arrives before the page's
    // click handler reaches the window-open handler below.
    let lastPressAt: number | null = null;
    let lastNoticeAt = 0;
    contents.on('input-event', (_event, input) => {
        if (GUEST_PRESS_INPUT_TYPE_SET.has(input.type)) {
            lastPressAt = Date.now();
        }
    });
    contents.setWindowOpenHandler(({ url }) => {
        // A link out of the site (a citation, a "learn more") opens in the
        // browser the user already has. Never a window of this app.
        const now = Date.now();
        const decision = decideGuestWindowOpen(
            url,
            lastPressAt,
            now,
            addressPolicy,
        );
        if (decision === 'open') {
            // One press, one page: a second window the same press asks for
            // is the page's idea, not the person's.
            lastPressAt = null;
            shell.openExternal(url);
        } else if (
            decision === 'refuse-and-tell' &&
            now - lastNoticeAt >= POPUP_NOTICE_GAP_MS
        ) {
            lastNoticeAt = now;
            tellHostPopupRefused(contents, url);
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
    guestSession.setPermissionRequestHandler(
        (contents, permission, done, details) => {
            if (GRANTED_PERMISSION_SET.has(permission)) {
                done(true);
                return;
            }
            const origin = toMicrophoneOrigin(permission, details);
            if (origin === null) {
                done(false);
                return;
            }
            askAiChatMicrophone(contents, origin, done);
        },
    );
    // A CHECK has no "ask me" answer in Electron: true reads to the page as
    // granted and false as denied. A site that checks before it asks takes
    // denied as final and shows its own "blocked" notice without ever asking,
    // so the microphone on a site's own page checks as available and the
    // REQUEST for the stream is what the person is asked about. What that
    // costs: `permissions.query` says granted before anyone said so.
    guestSession.setPermissionCheckHandler(
        (_contents, permission, requestingOrigin, details) => {
            if (GRANTED_PERMISSION_SET.has(permission)) {
                return true;
            }
            return (
                toMicrophoneOrigin(permission, {
                    isMainFrame: details.isMainFrame,
                    requestingUrl: details.requestingUrl ?? requestingOrigin,
                    mediaTypes:
                        details.mediaType === undefined
                            ? []
                            : [details.mediaType],
                }) !== null
            );
        },
    );
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
    // A yes to the microphone was given by whoever was signed in; it goes
    // with them.
    forgetAiChatMicrophoneGrants();
    const guestSession = session.fromPartition(AI_CHAT_PARTITION);
    await guestSession.clearStorageData();
    await guestSession.clearCache();
    // Cookies are storage; an HTTP auth credential is not, and outlives
    // `clearStorageData` on its own.
    await guestSession.clearAuthCache();
}
