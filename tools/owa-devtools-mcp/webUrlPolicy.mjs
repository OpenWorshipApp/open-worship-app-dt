// Which addresses on the internet this app will fetch on an assistant's say-so.
//
// `owa_read_website` is the first tool in this package that reaches OUT. Every
// other one drives a window the operator is already looking at; this one opens
// a socket to somewhere a language model chose, having possibly just read an
// attachment somebody handed the volunteer. That is a different shape of risk
// and it has two halves:
//
//  - **Reaching back in.** The app's OWN doors are on loopback and neither has
//    a credential (`MC-01`): the CDP endpoint (`/json/list`, `/json/new?url=`)
//    and the MCP host itself. A fetch tool that can say `127.0.0.1` is a way
//    to drive the app from inside an answer, and `file:` is a way to read the
//    disk. So is the church's router at `192.168.1.1` and a cloud metadata
//    service at `169.254.169.254`. This is the half that must not leak, and it
//    is why the rule is an ALLOWLIST of what the public internet looks like
//    rather than a blocklist of what it does not.
//  - **Getting data out.** A URL is a channel: whatever is in the model's
//    context can be spelled into a query string. That one cannot be closed by
//    a check -- see `WEB_URL_MAX_LENGTH` for what is done about it instead.
//
// **Node's URL parser is load-bearing here.** Every classic way of writing
// `127.0.0.1` so that a naive check misses it -- `0177.0.0.1`, `2130706433`,
// `0x7f.1`, `127.1` -- is normalised by `new URL()` into the canonical dotted
// quad before this file ever sees it, and IPv6 into its canonical bracketed
// form. So these checks read the canonical hostname and nothing else; do NOT
// "improve" them by matching the raw string the caller passed.
//
// Two layers use this, and they are not the same check twice:
//
//  - `firewall.mjs` calls the SYNCHRONOUS half at the seam both MCP doors
//    share, so a bad address is refused where every other refusal is made,
//    logged there, and costs no round trip to the app.
//  - The main process calls BOTH halves in `electron/webPageHelpers.ts`
//    immediately before it opens the socket, and again on every redirect and
//    navigation. That is the authoritative one: nothing reaches the network
//    without it.
//
// Plain ESM, and `node:dns` is imported lazily inside the one function that
// needs it, so importing this module costs nothing and it stays loadable
// wherever the rest of the package is.

/**
 * How long an address the assistant is allowed to name.
 *
 * This is the exfiltration lever, and it is honest about what it does: it does
 * not CLOSE the channel -- many small requests still leak -- it caps one
 * request at a postcard rather than a filing cabinet. Together with the
 * network budget in `firewall.mjs` (a handful of reads per five minutes) and
 * the banner every read raises in the operator's own window, bulk
 * exfiltration in a single unnoticed call is off the table, which is the
 * outcome that was actually available.
 *
 * 600 is roomy for real addresses -- a Wikipedia article is ~60 characters, a
 * search result with tracking parameters ~250 -- and the refusal tells the
 * model to ask the user for the plain address, which is a better answer than
 * silently truncating one.
 */
export const WEB_URL_MAX_LENGTH = 600;

// Names that mean "this machine" or "this network" without any address in
// them. A single-label name (`intranet`, `printer`) is refused for the same
// reason: it resolves through the operator's own DNS suffix or hosts file,
// which is exactly the network this tool must not be able to explore.
const PRIVATE_HOST_SUFFIXES = [
    '.local',
    '.localhost',
    '.internal',
    '.intranet',
    '.lan',
    '.home.arpa',
];

function toBareHostname(hostname) {
    // `https://LOCALHOST./` parses to `localhost.` -- a trailing root dot is
    // legal, resolves the same, and would slip past an equality check.
    return String(hostname ?? '')
        .toLowerCase()
        .replace(/\.$/, '');
}

/** A canonical dotted quad as four numbers, or null for anything else. */
function toIpV4Parts(hostname) {
    const parts = hostname.split('.');
    if (parts.length !== 4) {
        return null;
    }
    const numbers = parts.map((part) => {
        return /^\d{1,3}$/.test(part) ? Number(part) : -1;
    });
    return numbers.every((one) => {
        return one >= 0 && one <= 255;
    })
        ? numbers
        : null;
}

/**
 * Everything that is not a host on the public internet: this machine, this
 * network, the carrier's network, and the ranges that are not routable at all.
 */
function checkIsPrivateIpV4(parts) {
    const [a, b] = parts;
    return (
        a === 0 || // 0.0.0.0/8 -- "this network"
        a === 10 || // private
        a === 127 || // loopback: the app's own CDP and MCP doors
        (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
        (a === 169 && b === 254) || // link-local, incl. cloud metadata
        (a === 172 && b >= 16 && b <= 31) || // private
        (a === 192 && b === 168) || // private
        (a === 192 && b === 0) || // IETF protocol assignments + test net
        (a === 198 && (b === 18 || b === 19)) || // benchmarking
        a >= 224 // multicast and reserved, up to 255.255.255.255
    );
}

/**
 * IPv6, read off the CANONICAL form Node produces. Prefix matching rather than
 * a full parser: canonicalisation has already collapsed the leading zeros that
 * would otherwise make a prefix check wrong.
 */
function checkIsPrivateIpV6(bare) {
    const address = bare.replace(/^\[/, '').replace(/\]$/, '');
    if (address === '::1' || address === '::') {
        return true;
    }
    // IPv4-mapped (`::ffff:7f00:1` IS 127.0.0.1) and NAT64, both of which
    // carry a v4 address that has to be judged as one.
    const mapped =
        /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
    if (mapped !== null) {
        const high = Number.parseInt(mapped[1], 16);
        const low = Number.parseInt(mapped[2], 16);
        return checkIsPrivateIpV4([
            high >> 8,
            high & 0xff,
            low >> 8,
            low & 0xff,
        ]);
    }
    return (
        /^f[cd]/.test(address) || // unique local
        /^fe[89ab]/.test(address) || // link local
        /^ff/.test(address) || // multicast
        /^2002:/.test(address) // 6to4: can carry any v4 inside it
    );
}

/**
 * Whether a hostname names this machine or the network it is on, rather than
 * a host on the public internet. The NAME half of the rule below: an address
 * literal is judged as an address, and a name is judged on its shape, since
 * nothing here has resolved it yet.
 *
 * Two consumers want the same rule for different reasons, which is why this
 * is exported rather than left inside `checkWebUrl`:
 *
 *  - `checkWebUrl`, for an address a language MODEL named.
 *  - `electron/aiChatGuestHelpers.ts`, for a request a CHAT SITE made from
 *    inside the AI Chat window's guest. That is a page nobody here wrote,
 *    running on a machine whose loopback carries this app's own CDP and MCP
 *    doors, and a blind `fetch` at one needs no permission and reads no
 *    answer -- so it is refused by address rather than by what it asks for.
 *
 * The caller must pass the hostname a URL PARSER produced, never the raw
 * text -- see the note at the top of this file about `127.1` and friends.
 */
export function checkIsLocalHostname(hostname) {
    const bare = toBareHostname(hostname);
    if (bare === '') {
        return true;
    }
    if (toIpV4Parts(bare) !== null || bare.includes(':')) {
        return checkIsPrivateAddress(bare);
    }
    // A single-label name -- `localhost`, `intranet`, `printer` -- resolves
    // through the operator's own DNS suffix or hosts file, which is exactly
    // the network neither consumer may explore.
    return (
        !bare.includes('.') ||
        PRIVATE_HOST_SUFFIXES.some((suffix) => {
            return bare.endsWith(suffix);
        })
    );
}

/** Whether a resolved address may be connected to. Used by the DNS pass. */
export function checkIsPrivateAddress(address) {
    if (typeof address !== 'string' || address === '') {
        return true;
    }
    const bare = toBareHostname(address);
    const parts = toIpV4Parts(bare);
    if (parts !== null) {
        return checkIsPrivateIpV4(parts);
    }
    if (bare.includes(':')) {
        return checkIsPrivateIpV6(bare);
    }
    // Not an address at all. Callers pass RESOLVED addresses here, so reaching
    // this is a bug rather than a hostname -- refuse it.
    return true;
}

const ALLOWED = { isAllowed: true };

function refuse(reason) {
    return { isAllowed: false, reason };
}

function genPrivateReason(hostname) {
    return (
        `"${hostname}" is on this computer or its local network, not the ` +
        'public internet, so it cannot be read this way. This app\'s own ' +
        'windows, settings and files live there. To find out what the app is ' +
        'doing, use owa_app_state, owa_list_screens or owa_list_ui.'
    );
}

/**
 * The synchronous half: is this a well-formed public https address at all?
 *
 * Answers `{isAllowed}` plus, when it is, the normalised `href` and
 * `hostname` -- and the caller must fetch the NORMALISED one, or a check made
 * against the canonical form would be enforcing nothing about the address
 * actually used.
 */
export function checkWebUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') {
        return refuse('No address was given. Pass the full https address.');
    }
    if (url.length > WEB_URL_MAX_LENGTH) {
        return refuse(
            `That address is longer than ${WEB_URL_MAX_LENGTH} characters, ` +
                'which this app will not fetch. Ask the user for the plain ' +
                'address of the page -- the part up to the first "?" is ' +
                'almost always enough.',
        );
    }
    let parsed;
    try {
        parsed = new URL(url.trim());
    } catch {
        return refuse(
            `"${url}" is not a web address. Pass a full one starting with ` +
                'https://, or ask the user to paste the link.',
        );
    }
    if (parsed.protocol !== 'https:') {
        return refuse(
            'Only https addresses can be read. ' +
                (parsed.protocol === 'http:'
                    ? 'This one is plain http, which is not encrypted -- ask ' +
                      'the user whether the page has an https address.'
                    : `"${parsed.protocol}" is not the web: it can reach ` +
                      "this computer's own files and programs, which is why " +
                      'it is switched off.'),
        );
    }
    if (checkIsLocalHostname(parsed.hostname)) {
        return refuse(genPrivateReason(parsed.hostname));
    }
    return { isAllowed: true, href: parsed.href, hostname: parsed.hostname };
}

/**
 * The asynchronous half: where does that name actually point?
 *
 * A name on the public internet is free to resolve to `127.0.0.1`, so the
 * synchronous check above proves nothing about a hostname -- only DNS does.
 * EVERY address the name resolves to has to be public, not merely the first:
 * a name answering with one public and one loopback address would otherwise be
 * a coin toss.
 *
 * A residual remains, and is worth naming rather than papering over: between
 * this lookup and the socket, a name whose DNS the attacker controls can
 * change its answer (DNS rebinding). Closing that needs the connection pinned
 * to the address checked here, which Electron's own loader does not offer. It
 * costs an attacker a domain the user asked about by name plus a sub-second
 * race, and the check is re-run on every redirect, so it is accepted
 * knowingly.
 */
export async function checkIsPublicHost(hostname) {
    const bare = toBareHostname(hostname);
    if (bare === '') {
        return refuse(genPrivateReason(hostname));
    }
    if (toIpV4Parts(bare) !== null || bare.includes(':')) {
        // Already an address; `checkWebUrl` judged it and there is nothing to
        // look up.
        return checkIsPrivateAddress(bare)
            ? refuse(genPrivateReason(hostname))
            : ALLOWED;
    }
    let addressList;
    try {
        const { lookup } = await import('node:dns/promises');
        addressList = await lookup(bare, { all: true });
    } catch {
        return refuse(
            `"${hostname}" could not be found. Check the address with the ` +
                'user, or tell them the page could not be reached.',
        );
    }
    if (addressList.length === 0) {
        return refuse(genPrivateReason(hostname));
    }
    for (const { address } of addressList) {
        if (checkIsPrivateAddress(address)) {
            return refuse(genPrivateReason(hostname));
        }
    }
    return ALLOWED;
}

/** Both halves, for a caller about to open the socket. */
export async function checkWebUrlIsFetchable(url) {
    const verdict = checkWebUrl(url);
    if (!verdict.isAllowed) {
        return verdict;
    }
    const hostVerdict = await checkIsPublicHost(verdict.hostname);
    return hostVerdict.isAllowed ? verdict : hostVerdict;
}
