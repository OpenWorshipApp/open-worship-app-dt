import { handleError } from '../helper/errorHelpers';
import CacheManager from '../others/CacheManager';
import appProvider from '../server/appProvider';
import { unlocking } from '../server/unlockingHelpers';

export type HTMLDataType = {
    id: string;
    html: string;
};

const markdownCacheManager = new CacheManager<HTMLDataType>(10); // 10 second

// Takes the text alone, as every caller does: an options bag (theme, font,
// scale...) was read for `theme` only, through a `setTheme` that markdown-it
// does not have -- it threw -- and the cache, keyed by the text, would have
// ignored the rest (2026-11-03).
export async function renderMarkdown(text: string) {
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
