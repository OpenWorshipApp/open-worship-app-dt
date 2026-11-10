import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

import { defineConfig, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import basicSsl from '@vitejs/plugin-basic-ssl';

import { compNameAttributePlugin } from './vite-plugin-comp-name';
import { gzBundlePlugin } from './vite-plugin-gz-bundle';

const htmlPlugin = () => {
    return {
        name: 'html-transform',
        transformIndexHtml(html: string) {
            // <!-- prod<meta ..>prod -->
            html = html.replace(/<!-- prod/g, '');
            html = html.replace(/prod -->/g, '');
            // <!-- prod<meta ..>prod -->
            /*
            <!-- open-dev -->
            <meta ..>
            <!-- close-dev -->
            */
            html = html
                .split('<!-- open-dev -->')
                .map((htmlChunk) => {
                    const htmlChunkArr = htmlChunk.split('<!-- close-dev -->');
                    if (htmlChunkArr.length > 1) {
                        htmlChunkArr.shift();
                    }
                    return htmlChunkArr.join('');
                })
                .join('');
            return html;
        },
    };
};

/**
 * Dev-only playground code. The `(dev)Experiment` tab is gated on
 * `systemUtils.isDev`, so the page and its sources are never reachable from a
 * packaged build — keep them out of `dist` entirely instead of shipping dead
 * weight. The dev server still serves `html/experiment.html` as usual.
 */
const excludedHtmlFileNames = ['experiment.html'];
const excludedSrcDirPattern = /[\\/]src[\\/]experiments[\\/]/;

// `apply: 'build'` + the hook filter keep this free: the hook is never called
// during dev and, in a build, only for the excluded sources themselves.
const excludeExperimentsPlugin = (): Plugin => {
    return {
        name: 'exclude-experiments',
        apply: 'build',
        enforce: 'pre',
        load: {
            filter: { id: excludedSrcDirPattern },
            handler(id) {
                this.error(
                    `"${normalizePath(id)}" is excluded from the production ` +
                        'build, but something imported it. Move shared code ' +
                        'out of "src/experiments" instead.',
                );
            },
        },
    };
};

/**
 * `react-dom/server` is CommonJS that requires BOTH of React's browser server
 * renderers -- the legacy one (`renderToString`, `renderToStaticMarkup`) and
 * the streaming one (`renderToReadableStream`, `resume`) -- and a CommonJS
 * module cannot be tree-shaken. The app calls `renderToStaticMarkup` alone,
 * so the streaming build was 97.5 KB of minified code nothing runs, in the
 * static closure of every window that renders a slide: the screens, the
 * Presenter, the Reader, the editors (EN-60). The production build answers
 * the import with the legacy build only; dev and the tests resolve as before.
 * A React that moves the file fails the build here, rather than silently
 * shipping both again.
 */
const reactStaticMarkupOnlyPlugin = (): Plugin => {
    let filePath = '';
    return {
        name: 'react-static-markup-only',
        apply: 'build',
        enforce: 'pre',
        configResolved(config) {
            const flavor = config.isProduction ? 'production' : 'development';
            filePath = resolve(
                __dirname,
                'node_modules/react-dom/cjs',
                `react-dom-server-legacy.browser.${flavor}.js`,
            );
        },
        resolveId(id) {
            if (id !== 'react-dom/server') {
                return null;
            }
            if (!existsSync(filePath)) {
                this.error(
                    `"${normalizePath(filePath)}" is gone: react-dom changed ` +
                        'its layout, see reactStaticMarkupOnlyPlugin.',
                );
            }
            return filePath;
        },
    };
};

const htmlDir = resolve(__dirname, 'html');
const htmlFiles = readdirSync(htmlDir)
    .filter((fileName) => {
        return (
            fileName.endsWith('.html') &&
            !excludedHtmlFileNames.includes(fileName)
        );
    })
    .map((fileFullName) => {
        return [fileFullName, resolve(htmlDir, fileFullName)];
    });

// https://vitejs.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.dll'],
    plugins: [
        excludeExperimentsPlugin(),
        reactStaticMarkupOnlyPlugin(),
        gzBundlePlugin(),
        compNameAttributePlugin(),
        react(),
        htmlPlugin(),
        basicSsl({
            name: 'localhost',
            domains: ['localhost'],
            certDir: '.devServer/cert',
        }),
    ],
    css: {
        preprocessorOptions: {
            scss: {},
        },
    },
    server: {
        port: 3000,
        // Dev Electron always loads `https://localhost:3000`
        // (`electron/protocolHelpers.ts`), so a server that quietly moved to
        // 3001 because a leftover one held 3000 left the app on the OTHER
        // server's code (EN-15). Fail loudly instead.
        strictPort: true,
    },
    optimizeDeps: {
        // Bundled up front, next to `open-lyric`, so the app and an
        // installed language's song plugin share one plugin registry: a
        // language plugin binds to the window's own `open-lyric/internal`
        // (`extra-work/build-lang-plugins.mjs`). No language's song plugin
        // is ever served by this server -- it is declared and installed in
        // its language's own folder and reaches a window only inside the
        // built language plugin (2026-11-05).
        include: ['open-lyric/internal'],
    },

    root: './html',
    resolve: {
        alias: {
            '/src': '../src',
        },
    },
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        // Shipped on purpose: an agent driving the packaged app through
        // DevTools sees real file names and line numbers instead of
        // `index-Bq7f.js:1`, and so does a stack trace in a bug report. They
        // are only fetched when something opens DevTools, so the runtime cost
        // on a low-spec machine is nil -- it is install size we are paying.
        sourcemap: true,
        rollupOptions: {
            input: Object.fromEntries(htmlFiles),
        },
    },
});
