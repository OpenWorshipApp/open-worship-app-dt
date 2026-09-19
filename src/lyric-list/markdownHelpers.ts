import { handleError } from '../helper/errorHelpers';
import CacheManager from '../others/CacheManager';
import appProvider from '../server/appProvider';
import { unlocking } from '../server/unlockingHelpers';

type RenderMarkdownOptions = {
    isJustifyCenter?: boolean;
    isDisablePointerEvents?: boolean;
    theme?: string;
    fontFamily?: string;
    fontWeight?: string;
    scale?: number;
};

export type HTMLDataType = {
    id: string;
    html: string;
};

const markdownCacheManager = new CacheManager<HTMLDataType>(10); // 10 second

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
        let html: string;
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
