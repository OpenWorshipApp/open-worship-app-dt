import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

// The plugin belongs to `tsconfig.node.json`'s project (`vite.config.ts`
// imports it), which `tsconfig.json` references, so a static import here makes
// `tsc` ask for its built `.d.ts` (TS6305). A specifier `tsc` cannot follow
// keeps the two projects apart; vitest loads the source all the same.
const PLUGIN_SPECIFIER = '../../vite-plugin-boot-loading';
const { BOOT_LOADING_MARKER, injectBootLoading, toInlineCss } = (await import(
    /* @vite-ignore */ PLUGIN_SPECIFIER
)) as {
    BOOT_LOADING_MARKER: string;
    injectBootLoading: (html: string, css: string) => string;
    toInlineCss: (css: string) => string;
};

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HTML_DIR = path.join(REPO_ROOT, 'html');
const LOADING_CSS = readFileSync(
    path.join(REPO_ROOT, 'src', 'others', 'LoadingComp.css'),
    'utf8',
);

function readPages() {
    return readdirSync(HTML_DIR)
        .filter((fileName) => {
            return fileName.endsWith('.html');
        })
        .map((fileName) => {
            return {
                fileName,
                html: readFileSync(path.join(HTML_DIR, fileName), 'utf8'),
            };
        });
}

describe('boot loader', () => {
    test('every page takes it from the one shared transform', () => {
        // Each page used to carry its own copy of `<img src="/loading.gif">`,
        // and the copies had already drifted apart.
        const ownCopies = readPages().filter(({ html }) => {
            return /loading\.gif|class="loading"/.test(html);
        });
        expect(ownCopies.map(({ fileName }) => fileName)).toEqual([]);
        const asking = readPages().filter(({ html }) => {
            return html.includes(BOOT_LOADING_MARKER);
        });
        expect(asking.map(({ fileName }) => fileName)).toEqual(
            expect.arrayContaining([
                'presenter.html',
                'reader.html',
                'setting.html',
                'appDocumentEditor.html',
            ]),
        );
    });

    test('sits inside #root, so mounting the page takes it away', () => {
        // `getReactRoot` empties `#root`; anywhere else the spinner would
        // turn under the page for as long as the window is open.
        for (const { fileName, html } of readPages()) {
            const markerIndex = html.indexOf(BOOT_LOADING_MARKER);
            if (markerIndex === -1) {
                continue;
            }
            const rootIndex = html.indexOf('<div id="root">');
            const rootEndIndex = html.indexOf('</div>', rootIndex);
            expect({ fileName, inRoot: rootIndex !== -1 }).toEqual({
                fileName,
                inRoot: true,
            });
            expect(markerIndex).toBeGreaterThan(rootIndex);
            expect(markerIndex).toBeLessThan(rootEndIndex);
        }
    });

    test('puts the spinner stylesheet and one spinner in place of the marker', () => {
        const html = injectBootLoading(
            `<div id="root">${BOOT_LOADING_MARKER}</div>`,
            LOADING_CSS,
        );
        expect(html).not.toContain(BOOT_LOADING_MARKER);
        expect(
            html.match(/class="app-loading-spinner app-boot-loading"/g),
        ).toHaveLength(1);
        expect(html).toContain('role="img"');
        expect(html).toContain('@keyframes app-loading-spin');
        expect(html).toContain('.app-loading-spinner.app-boot-loading');
        // Comments and indentation stay in the source file.
        expect(html).not.toContain('/*');
        expect(html).not.toMatch(/\n/);
    });

    test('animates only what the compositor runs without a repaint', () => {
        // CLAUDE.md: an `infinite` animation of a paint property held idle
        // windows at 60 frames/s (EN-19). A load can take minutes on a weak
        // machine, so the spinner may only move `transform` and `opacity`.
        const css = toInlineCss(LOADING_CSS);
        const keyframesBodies = [
            ...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)/g),
        ].map((match) => {
            return match[1];
        });
        expect(keyframesBodies.length).toBeGreaterThan(0);
        const properties = keyframesBodies.flatMap((body) => {
            return [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => {
                return match[1];
            });
        });
        expect(properties.length).toBeGreaterThan(0);
        const paintProperties = properties.filter((property) => {
            return !['transform', 'opacity'].includes(property);
        });
        expect(paintProperties).toEqual([]);
    });

    test('turns in steps, one compositor frame per segment', () => {
        // Measured 2026-11-10 with software compositing: a smooth turn drew 60
        // frames a second whatever the ring was made of; `steps(8)` draws 8.
        const css = toInlineCss(LOADING_CSS);
        const animations = [
            ...css.matchAll(/animation:\s*([^;}]*app-loading-spin[^;}]*)/g),
        ].map((match) => {
            return match[1];
        });
        expect(animations).toEqual([expect.stringMatching(/\bsteps\(8\)/)]);
    });
});
