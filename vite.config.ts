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

const htmlFiles = readdirSync(__dirname).filter((fileName) => {
    return fileName.endsWith('.html');
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
    build: {
        rollupOptions: {
            input: htmlFiles.map((item) => {
                return resolve(item);
            }),
        },
    },
});
