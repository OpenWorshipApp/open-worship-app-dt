/**
 * YouTube URL parsing, and NOTHING else.
 *
 * Deliberately a zero-import leaf: `CanvasItemYouTube` sits inside the canvas
 * item graph (`CanvasItem` -> `canvasHelpers` -> `appProvider` -> ... ->
 * `CanvasController`), so anything that only needs to ask "is this a YouTube
 * link?" and imported the item class for it would close an import cycle and
 * blow up with `class extends undefined`. Both the item class and the
 * background-drop mapping import this instead, so the host list still lives in
 * exactly one place.
 */

// Any of the common YouTube URL forms: watch, youtu.be, shorts, live, embed.
export function checkIsYouTubeUrl(url: string) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        return (
            host === 'youtu.be' ||
            host === 'youtube.com' ||
            host.endsWith('.youtube.com')
        );
    } catch (_error) {
        return false;
    }
}

// The video id, or '' when the URL is not a recognized YouTube link.
export function extractYouTubeVideoId(url: string) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') {
            return parsed.pathname.slice(1);
        }
        if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
            if (parsed.pathname === '/watch') {
                return parsed.searchParams.get('v') ?? '';
            }
            const match = parsed.pathname.match(
                /^\/(?:embed|shorts|live|v)\/([^/?#]+)/,
            );
            if (match !== null) {
                return match[1];
            }
        }
    } catch (_error) {
        return '';
    }
    return '';
}
