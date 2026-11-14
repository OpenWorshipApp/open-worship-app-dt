import { readFileSync } from 'node:fs';

import type { Plugin } from 'vite';

/**
 * The boot loader: what a page shows from its first paint until its React
 * root mounts (`getReactRoot` empties `#root`, which takes it away).
 *
 * A page asks for it with this comment inside its `<div id="root">`, and the
 * transform puts the loading spinner's own stylesheet
 * (`src/others/LoadingComp.css`) and one spinner there. Inlined, so the first
 * paint waits on no request; from the file `LoadingComp` imports, so a
 * window's first spinner and every later one are one design.
 */
export const BOOT_LOADING_MARKER = '<!-- boot-loading -->';

// `transformIndexHtml` output is not minified, so the comments and the
// indentation would reach every page as written.
export function toInlineCss(css: string) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function genBootLoadingHtml(css: string) {
    return (
        `<style>${toInlineCss(css)}</style>` +
        '<span class="app-loading-spinner app-boot-loading"' +
        ' role="img" aria-label="Loading"></span>'
    );
}

export function injectBootLoading(html: string, css: string) {
    return html.split(BOOT_LOADING_MARKER).join(genBootLoadingHtml(css));
}

export function bootLoadingPlugin(cssFilePath: string): Plugin {
    return {
        name: 'boot-loading',
        transformIndexHtml(html: string) {
            if (!html.includes(BOOT_LOADING_MARKER)) {
                return html;
            }
            // Read per page, so an edit shows on the next dev reload.
            return injectBootLoading(html, readFileSync(cssFilePath, 'utf8'));
        },
    };
}
