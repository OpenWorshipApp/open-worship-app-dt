// @vitest-environment jsdom

import { inflateSync } from 'node:zlib';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { openExternalURLMock, copyToClipboardMock, showSimpleToastMock } =
    vi.hoisted(() => ({
        openExternalURLMock: vi.fn(),
        copyToClipboardMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
    }));

vi.mock('../server/appProvider', () => ({
    default: {
        browserUtils: { openExternalURL: openExternalURLMock },
        systemUtils: { copyToClipboard: copyToClipboardMock },
    },
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

import {
    buildMermaidLiveState,
    buildMermaidLiveUrl,
    MERMAID_LIVE_EDITOR_URL,
    MERMAID_LIVE_URL_LENGTH_LIMIT,
    openMermaidLiveEditor,
} from './mermaidLiveHelpers';

const DIAGRAM =
    '%% ដាវីឌ — connection graph\n' +
    'flowchart LR\n' +
    '    n0["ដាវីឌ (David)<br/>មនុស្ស"]\n' +
    '    n1["អ៊ីសាយ (Jesse)<br/>មនុស្ស"]\n' +
    '    n0 -->|"ឪពុក"| n1\n';

/** The editor's own `deserializeState`, written out. */
function readMermaidLiveUrl(url: string) {
    const fragment = url.slice(url.indexOf('#') + 1);
    const separatorIndex = fragment.indexOf(':');
    const serde = fragment.slice(0, separatorIndex);
    const payload = fragment.slice(separatorIndex + 1);
    // URL-safe base64 with the padding dropped, exactly as `js-base64` writes
    // it; Node's decoder takes the `base64url` alphabet as it stands.
    const bytes = Buffer.from(payload, 'base64url');
    const json =
        serde === 'pako'
            ? inflateSync(bytes).toString('utf8')
            : bytes.toString('utf8');
    return { serde, state: JSON.parse(json) };
}

describe('buildMermaidLiveState', () => {
    test('carries the four fields the editor requires', () => {
        const state = JSON.parse(buildMermaidLiveState(DIAGRAM));
        expect(state.code).toBe(DIAGRAM);
        expect(JSON.parse(state.mermaid)).toEqual({ theme: 'default' });
        expect(state.updateDiagram).toBe(true);
        expect(state.rough).toBe(false);
    });
});

describe('buildMermaidLiveUrl', () => {
    test('writes a pako link the editor can read back', async () => {
        const url = await buildMermaidLiveUrl(DIAGRAM);
        expect(url.startsWith(`${MERMAID_LIVE_EDITOR_URL}#pako:`)).toBe(true);
        const { serde, state } = readMermaidLiveUrl(url);
        expect(serde).toBe('pako');
        expect(state.code).toBe(DIAGRAM);
    });

    test('the payload is URL-safe and unpadded', async () => {
        // A `+`, a `/` or a `=` in the fragment is what `js-base64`'s URL-safe
        // alphabet exists to avoid; a `%` would mean one had been escaped.
        const url = await buildMermaidLiveUrl(DIAGRAM.repeat(40));
        const payload = url.slice(url.indexOf(':', url.indexOf('#')) + 1);
        expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('compresses: the link is far shorter than the diagram', async () => {
        const url = await buildMermaidLiveUrl(DIAGRAM.repeat(40));
        expect(url.length).toBeLessThan(DIAGRAM.repeat(40).length);
    });

    test('falls back to the base64 serde with no CompressionStream', async () => {
        const original = globalThis.CompressionStream;
        // The editor's other documented tag — the same state, uncompressed —
        // so a platform without the stream still opens the right diagram.
        Reflect.deleteProperty(globalThis, 'CompressionStream');
        try {
            const url = await buildMermaidLiveUrl(DIAGRAM);
            expect(url.startsWith(`${MERMAID_LIVE_EDITOR_URL}#base64:`)).toBe(
                true,
            );
            const { serde, state } = readMermaidLiveUrl(url);
            expect(serde).toBe('base64');
            expect(state.code).toBe(DIAGRAM);
        } finally {
            Object.defineProperty(globalThis, 'CompressionStream', {
                value: original,
                configurable: true,
                writable: true,
            });
        }
    });
});

describe('openMermaidLiveEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('hands an ordinary diagram to the browser', async () => {
        const isOpened = await openMermaidLiveEditor(DIAGRAM, 'Open');
        expect(isOpened).toBe(true);
        expect(openExternalURLMock).toHaveBeenCalledTimes(1);
        expect(copyToClipboardMock).not.toHaveBeenCalled();
        const [url] = openExternalURLMock.mock.calls[0];
        expect(readMermaidLiveUrl(url).state.code).toBe(DIAGRAM);
        expect(showSimpleToastMock).toHaveBeenCalledTimes(1);
    });

    test('copies instead of opening when the link is too long', async () => {
        // Past the measured ceiling `shell.openExternal` drops a URL in
        // silence, so the clipboard is the honest answer rather than a press
        // that appears to do nothing.
        let diagram = DIAGRAM;
        let batchSize = 32;
        while (
            (await buildMermaidLiveUrl(diagram)).length <=
            MERMAID_LIVE_URL_LENGTH_LIMIT
        ) {
            // Random text so the compressor cannot shrink the repeats away.
            // The batch DOUBLES: adding one line per check deflated the whole
            // growing diagram ~400 times and timed out under the full suite.
            for (let index = 0; index < batchSize; index += 1) {
                diagram += `    n${diagram.length}["${Math.random()}"]\n`;
            }
            batchSize *= 2;
        }
        const isOpened = await openMermaidLiveEditor(diagram, 'Open');
        expect(isOpened).toBe(false);
        expect(openExternalURLMock).not.toHaveBeenCalled();
        expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
        const [copied] = copyToClipboardMock.mock.calls[0];
        expect(readMermaidLiveUrl(copied).state.code).toBe(diagram);
    });
});
