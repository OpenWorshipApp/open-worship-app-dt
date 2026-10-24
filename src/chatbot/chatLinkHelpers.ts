/**
 * The web addresses an answer may OPEN, drawn as links in its text
 * (`ChatMessageType.links`). Only the app writes them -- a downloaded
 * Bible's notice of where it came from -- never a model: a model's words can
 * carry what a web page it read told it to say, and a link is one press from
 * the person's browser. No imports: the session store, the Bible import and
 * the window all read it.
 */

// A notice names two (the page, the file); room for a little more.
export const MAX_CHAT_LINK_COUNT = 4;
const MAX_CHAT_LINK_LENGTH = 600;

export function checkIsOpenableLink(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > MAX_CHAT_LINK_LENGTH) {
        return false;
    }
    try {
        const url = new URL(value);
        return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password
        );
    } catch (_error) {
        return false;
    }
}

// The most of an address drawn in the answer; the whole is on its hover.
const MAX_SHOWN_LINK_LENGTH = 60;

/**
 * An address as it is DRAWN: decoded, without `https://` and `www.`, a
 * search's `+` as the spaces they are, cut at 60 characters (2026-10-17,
 * EC-297: a Google search for Khmer words was drawn as 300 characters of
 * `%E1%9E%96…`, which nobody can read). What is opened is the address itself.
 */
export function toShownLinkText(url: string) {
    let shown: string;
    try {
        shown = decodeURI(url);
    } catch (_error) {
        shown = url;
    }
    shown = shown.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    const queryAt = shown.indexOf('?');
    if (queryAt !== -1) {
        shown =
            shown.slice(0, queryAt) +
            shown.slice(queryAt).replaceAll('+', ' ').replaceAll('%2B', '+');
    }
    return [...shown].length > MAX_SHOWN_LINK_LENGTH
        ? [...shown].slice(0, MAX_SHOWN_LINK_LENGTH - 1).join('') + '…'
        : shown;
}

/** The openable ones of `raw`, each once, at most `MAX_CHAT_LINK_COUNT`. */
export function toOpenableLinks(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    return [...new Set(raw.filter(checkIsOpenableLink))].slice(
        0,
        MAX_CHAT_LINK_COUNT,
    );
}
