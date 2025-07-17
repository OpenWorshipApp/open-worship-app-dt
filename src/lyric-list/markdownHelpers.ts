import Lyric from './Lyric';
import { handleError } from '../helper/errorHelpers';
import CacheManager from '../others/CacheManager';
import appProvider from '../server/appProvider';
import { unlocking } from '../server/unlockingHelpers';
import { toIframe } from './markdownHtmlHelpers';

type RenderMarkdownOptions = {
    isJustifyCenter?: boolean;
    isDisablePointerEvents?: boolean;
    theme?: string;
    fontFamily?: string;
    fontWeight?: string;
    scale?: number;
};
function wrapHTML({
    html,
    options = {},
}: {
    html: string;
    options?: RenderMarkdownOptions;
}) {
    return `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <style>
        .dark::-webkit-scrollbar-track {
            box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1);
            background-color: #adb5bd;
            border-radius: 10px;
        }
        .dark::-webkit-scrollbar {
            width: 7px;
            height: 7px;
            background-color: #6c757d;
        }
        .dark::-webkit-scrollbar-thumb {
            border-radius: 10px;
            background-color: #6c757d;
            background-image: gradient(linear, 40% 0%, 75% 84%, from(#343a40), to(#343a40), color-stop(0.6, #6c757d));
        }
        .dark::-webkit-scrollbar-corner {
            background-color: #6c757d;
        }
        body {
            margin: 0;
            padding: 3px;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }
        #container {
            ${
                options.isJustifyCenter
                    ? `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                user-select: none !important;
                `
                    : ''
            }
            ${options.scale ? `transform: scale(${options.scale});` : ''}
            width: 100vw;
            height: 100vh;
            overflow: auto;
        }
        * {
            font-family: ${options.fontFamily}, "Arial", sans-serif;
            font-weight: ${options.fontWeight};
            margin: 0.05em !important;
        }
        ${
            options.isDisablePointerEvents
                ? `body { pointer-events: none; }`
                : ''
        }
    </style>
    <body>
        <div id="container" class="${options.theme}">
            ${html}
        </div>
        <script>
            const container = document.getElementById('container');
            if (container) {
                container.scrollTop = 0;
                container.scrollLeft = 0;
            }
        </script>
    </body>
</html>
`;
}

export type HTMLDataType = {
    id: string;
    html: string;
};

export const markdownCacheManager = new CacheManager<HTMLDataType>(10); // 10 second

export async function renderMarkdownMusic(
    text: string,
    options?: RenderMarkdownOptions,
) {
    if (!text) {
        return {
            id: '',
            html: '',
        };
    }
    const hashKey = appProvider.systemUtils.generateMD5(text);
    return unlocking(`markdown-music-${hashKey}`, async () => {
        const cached = await markdownCacheManager.get(hashKey);
        if (cached) {
            return cached;
        }
        const MarkdownIt = (await import('markdown-it')).default;
        // @ts-expect-error: ts(7016)
        const MarkdownItMusic = (await import('markdown-it-music')).default;
        const markdown = new MarkdownIt({ html: true }).use(MarkdownItMusic);
        if (options?.theme) {
            (markdown as any).setTheme(options.theme);
        }
        let html = '';
        try {
            const renderedHtml = markdown.render(text);
            html = wrapHTML({
                html: renderedHtml,
                options,
            });
            html = toIframe(html, hashKey);
        } catch (error) {
            handleError(error);
            html = wrapHTML({
                html: `<pre>${text}</pre>`,
            });
        }
        const data = { id: hashKey, html };
        await markdownCacheManager.set(hashKey, data);
        return data;
    });
}

export async function renderMarkdown(
    text: string,
    options?: RenderMarkdownOptions,
) {
    if (!text) {
        return {
            id: '',
            html: '',
        };
    }
    const hashKey = appProvider.systemUtils.generateMD5(text);
    return unlocking(`markdown-${hashKey}`, async () => {
        const cached = await markdownCacheManager.get(hashKey);
        if (cached) {
            return cached;
        }
        const MarkdownIt = (await import('markdown-it')).default;
        const markdown = new MarkdownIt({ html: true });
        if (options?.theme) {
            (markdown as any).setTheme(options.theme);
        }
        let html = '';
        try {
            html = markdown.render(text);
        } catch (error) {
            handleError(error);
            html = `<pre>${text}</pre>`;
        }
        const data = { id: hashKey, html };
        await markdownCacheManager.set(hashKey, data);
        return data;
    });
}

export async function renderLyricSlideMarkdownMusicTextList(lyric: Lyric) {
    const content = await lyric.getContent();
    const contentList = content.split('---\n').map((item) => {
        return item.trim();
    });
    return contentList;
}

export async function renderLyricSlide(
    lyric: Lyric,
    options?: RenderMarkdownOptions,
) {
    return unlocking(`lyric-slides-${lyric.filePath}`, async () => {
        const content = await lyric.getContent();
        return await renderMarkdownMusic(content, options);
    });
}
