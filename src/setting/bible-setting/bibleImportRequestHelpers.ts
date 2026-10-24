import {
    getSettingForce,
    removeSetting,
    setSetting,
} from '../../helper/settingHelpers';

const REQUEST_KEY = 'bible-xml-import-request';

export function readBibleImportAsk(text: string): string | null {
    if (
        text.length > 1200 ||
        !/\bimport\b/i.test(text) ||
        !/\bbible\b/i.test(text)
    )
        return null;
    const urls = text.match(/https?:\/\/[^\s<>"`]+/g) ?? [];
    if (urls.length !== 1) return null;
    try {
        const url = new URL(urls[0].replace(/[),.;]+$/, ''));
        if (!/\.xml$/i.test(url.pathname) && !/\bxml\b/i.test(text))
            return null;
        if (url.username || url.password) return null;
        return url.href;
    } catch {
        return null;
    }
}

export function requestBibleImport(url: string) {
    setSetting(REQUEST_KEY, JSON.stringify({ url, at: Date.now() }));
}

export function takeBibleImportRequest(): string | null {
    const text = getSettingForce(REQUEST_KEY);
    if (!text) return null;
    removeSetting(REQUEST_KEY);
    try {
        const data = JSON.parse(text);
        if (
            typeof data.at !== 'number' ||
            Math.abs(Date.now() - data.at) > 30000
        )
            return null;
        return readBibleImportAsk(`Import bible xml ${data.url}`);
    } catch {
        return null;
    }
}
