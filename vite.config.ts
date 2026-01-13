import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import basicSsl from '@vitejs/plugin-basic-ssl';

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

const htmlDir = resolve(__dirname, 'html');
const htmlFiles = readdirSync(htmlDir)
    .filter((fileName) => {
        return fileName.endsWith('.html');
    })
    .map((fileFullName) => {
        return [fileFullName, resolve(htmlDir, fileFullName)];
    });

// https://vitejs.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.dll'],
    plugins: [
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
