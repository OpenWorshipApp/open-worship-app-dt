// Where a piece of media lives. An image/video/audio canvas item names its
// source as a path to a file on disk, as a remote `http(s)` link, or — for a
// lyric attachment — as a `file://` URL, and the three are handled differently:
// a URL of either kind is rendered verbatim (never run through
// `pathToFileURL`), and a remote link is additionally never bundled into an
// archive and never copied into the document.
//
// Deliberately dependency-free so the view components, the canvas item models
// and the archive helpers can all share it without dragging `appProvider` in.

export type RemoteMediaSourceType = `http://${string}` | `https://${string}`;

export function checkIsRemoteMediaSource(
    source: string,
): source is RemoteMediaSourceType {
    return /^https?:\/\//i.test(source);
}

// How a lyric attachment names a file on the operator's own machine —
// open-lyric writes attachments as URLs, so a local file arrives as
// `file:///C:/…` rather than as a path. Like a remote link it is ALREADY a URL
// and must be rendered verbatim, but unlike one it names a file on this disk,
// so it stays outside `checkIsRemoteMediaSource` — the archive helpers and the
// canvas context menu use that predicate to mean "not on this disk".
export type FileUrlMediaSourceType = `file://${string}`;

export function checkIsFileUrlMediaSource(
    source: string,
): source is FileUrlMediaSourceType {
    // Case-insensitive like its `http(s)` sibling: a scheme is case-insensitive
    // (RFC 3986 §3.1), and a hand-written `FILE:///C:/…` attachment that failed
    // this check would silently lose its canvas item rather than fail loudly.
    return /^file:\/\//i.test(source);
}

// The only question a media renderer has to ask: is this source already a URL,
// or is it a path that still has to go through `pathToFileURL`?
export type UrlMediaSourceType = RemoteMediaSourceType | FileUrlMediaSourceType;

export function checkIsUrlMediaSource(
    source: string,
): source is UrlMediaSourceType {
    return (
        checkIsRemoteMediaSource(source) || checkIsFileUrlMediaSource(source)
    );
}
