import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

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
        rollupOptions: {
            input: Object.fromEntries(htmlFiles),
        },
    },
});
