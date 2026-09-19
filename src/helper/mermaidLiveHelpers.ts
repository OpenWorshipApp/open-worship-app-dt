import appProvider from '../server/appProvider';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

/**
 * Handing a Mermaid diagram to the Mermaid Live Editor (`mermaid.live`).
 *
 * Copying a diagram is only half of what a diagram is for: the other half is
 * SEEING it, and nothing on this machine draws one except the app's own
 * markdown preview. `mermaid.live` is the editor Mermaid itself publishes, it
 * draws every shape this app writes, and it is where a diagram gets zoomed,
 * re-coloured and exported as a picture. So the copy menu offers to open it
 * there directly rather than leaving the user to find the site, press New and
 * paste.
 *
 * **The diagram travels in the link's FRAGMENT, which a browser never sends to
 * a server.** That is not a detail: these graphs are built out of a church's
 * own study notes, and "open this in a website" would otherwise mean uploading
 * them. Everything after the `#` stays in the browser — it is how the editor's
 * own Share box works, and why it says the diagrams never leave the browser.
 *
 * The link format is the editor's own `serializeState` (its `src/lib/util/serde.ts`,
 * read 2026-09-17), which this file has to match byte for byte or the page
 * opens empty:
 *
 * 1. the state as JSON,
 * 2. UTF-8 bytes,
 * 3. zlib `deflate`,
 * 4. URL-safe base64 with the `=` padding dropped,
 * 5. behind a `pako:` tag, in the fragment of `https://mermaid.live/edit`.
 *
 * Its OTHER tag, `base64:`, is the same state with step 3 left out, and this
 * file writes that one wherever `CompressionStream` is missing — a fallback
 * that is a documented half of the format rather than a guess, which is what
 * makes it safe to lean on.
 */

/**
 * What the editor reads out of a link.
 *
 * Its `State` has a dozen fields and all but these four are optional (its
 * comment: "All new options must be optional, as users would have old states
 * saved"), so this writes the four and leaves the editor's own defaults to
 * everything else — a link that pins a zoom, a pan or a theme is a link that
 * overrides whatever the person opening it had set.
 */
type MermaidLiveStateType = {
    code: string;
    // The mermaid CONFIG, itself a JSON string inside the state.
    mermaid: string;
    updateDiagram: boolean;
    rough: boolean;
};

/** Named once: the menu row, the toast and the fallback all say this. */
export const MERMAID_LIVE_LABEL = 'Open in Mermaid Live';
export const MERMAID_LIVE_TITLE = 'Open the diagram in the Mermaid Live Editor';
const MERMAID_LIVE_OPENING_MESSAGE = 'Opening in the Mermaid Live Editor';
// One literal, not two joined: every one of these is a `tran` key, and a key
// the dictionary cannot be searched for is a key that goes missing.
const MERMAID_LIVE_TOO_LONG_MESSAGE =
    'The link is too long for the browser. It has been copied — paste it into the address bar.';

export const MERMAID_LIVE_EDITOR_URL = 'https://mermaid.live/edit';

/**
 * How long a link may be before it is copied instead of opened.
 *
 * MEASURED against this project's own Electron (2026-09-17, a local server
 * answering `shell.openExternal` and reporting the length that arrived): 2 500
 * and 8 000 characters both came through whole, 30 000 never arrived at all
 * and `openExternal` still resolved — a URL too long for the command line the
 * browser is launched with is dropped in SILENCE, which is the one failure a
 * user could not diagnose. So the length is checked here instead, and past it
 * the link goes to the clipboard with a sentence saying why.
 *
 * For scale: the 29-box graph in the screenshot this was built from writes a
 * 1 290 character link, so nothing an ordinary graph produces comes near it.
 */
export const MERMAID_LIVE_URL_LENGTH_LIMIT = 8000;

/** The state the editor opens with, as JSON — the input to the encoding. */
export function buildMermaidLiveState(code: string) {
    const state: MermaidLiveStateType = {
        code,
        mermaid: JSON.stringify({ theme: 'default' }),
        // The editor renders on open rather than waiting for a keystroke.
        updateDiagram: true,
        // The hand-drawn look, off: this is a reference diagram.
        rough: false,
    };
    return JSON.stringify(state);
}

/**
 * URL-safe base64 of raw bytes, padding dropped — `js-base64`'s
 * `fromUint8Array(bytes, true)`, which is what the editor decodes with.
 *
 * Built a chunk at a time because `String.fromCharCode(...bytes)` passes one
 * ARGUMENT per byte and blows the call's argument limit on anything large,
 * which is exactly the diagram that needed compressing.
 */
function toUrlSafeBase64(bytes: Uint8Array) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(index, index + chunkSize),
        );
    }
    return globalThis
        .btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * zlib-deflated bytes, or `null` where the platform has no `CompressionStream`.
 *
 * Written against the stream's own writer and reader rather than through a
 * `Blob` or a `Response`: those two are separate implementations that a test
 * environment may hold a different copy of, while the compressor itself is the
 * one thing this needs. The write is NOT awaited before the read — a stream
 * that is not being drained stops accepting — so it is kept as a promise and
 * awaited afterwards, where a failure still surfaces instead of being lost.
 */
async function deflateText(text: string) {
    const { CompressionStream: CompressionStreamClass } = globalThis as {
        CompressionStream?: typeof CompressionStream;
    };
    if (CompressionStreamClass === undefined) {
        return null;
    }
    const compressionStream = new CompressionStreamClass('deflate');
    const writer = compressionStream.writable.getWriter();
    const writing = (async () => {
        await writer.write(new TextEncoder().encode(text));
        await writer.close();
    })();
    const chunkList: Uint8Array[] = [];
    let totalLength = 0;
    const reader = compressionStream.readable.getReader();
    for (;;) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        if (value !== undefined) {
            chunkList.push(value);
            totalLength += value.length;
        }
    }
    await writing;
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunkList) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}

/** The whole `https://mermaid.live/edit#pako:…` link for one diagram. */
export async function buildMermaidLiveUrl(code: string) {
    const stateJson = buildMermaidLiveState(code);
    const compressed = await deflateText(stateJson);
    const payload =
        compressed === null
            ? `base64:${toUrlSafeBase64(new TextEncoder().encode(stateJson))}`
            : `pako:${toUrlSafeBase64(compressed)}`;
    return `${MERMAID_LIVE_EDITOR_URL}#${payload}`;
}

/**
 * Opens the diagram in the system browser, and says so.
 *
 * The toast is not decoration: launching a browser takes seconds on the
 * machines this app is built for, and a menu row that appears to do nothing is
 * a menu row the user presses again.
 *
 * `title` names the format, so the confirmation belongs to the row that was
 * pressed rather than reading the same for all three.
 */
export async function openMermaidLiveEditor(code: string, title: string) {
    const url = await buildMermaidLiveUrl(code);
    if (url.length > MERMAID_LIVE_URL_LENGTH_LIMIT) {
        appProvider.systemUtils.copyToClipboard(url);
        showSimpleToast(title, tran(MERMAID_LIVE_TOO_LONG_MESSAGE));
        return false;
    }
    appProvider.browserUtils.openExternalURL(url);
    showSimpleToast(title, tran(MERMAID_LIVE_OPENING_MESSAGE));
    return true;
}
