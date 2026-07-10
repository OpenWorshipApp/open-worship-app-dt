import {
    type LocaleType,
    getLangDataAsync,
    DEFAULT_LOCALE,
    getFontFamilyByLocale,
} from '../../lang/langHelpers';
import { globalCacheManager1M } from '../../others/CacheManager';
import { unlocking } from '../../server/unlockingHelpers';
import { useAppStateAsync } from '../appHooks';
import { getBibleInfo } from './bibleInfoHelpers';

export async function getBibleLocale(bibleKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return 'en' as LocaleType;
    }
    return bibleInfo.locale;
}

export async function getLangDataFromBibleKey(bibleKey: string) {
    const locale = await getBibleLocale(bibleKey);
    const langData =
        (await getLangDataAsync(locale)) ||
        (await getLangDataAsync(DEFAULT_LOCALE));
    return langData;
}

export async function getBibleFontFamily(bibleKey: string): Promise<string> {
    if (!bibleKey) {
        return await getFontFamilyByLocale(DEFAULT_LOCALE);
    }
    const key = `FontFamilyBibleKey:${bibleKey}`;
    return await unlocking(key, async () => {
        const cachedFontFamily = await globalCacheManager1M.get(key);
        if (cachedFontFamily) {
            return cachedFontFamily;
        }
        const locale = await getBibleLocale(bibleKey);
        const fontFamily = getFontFamilyByLocale(locale);
        await globalCacheManager1M.set(key, fontFamily);
        return fontFamily;
    });
}
export function useBibleFontFamily(bibleKey: string): string | undefined {
    const [fontFamily] = useAppStateAsync(() => {
        return getBibleFontFamily(bibleKey);
    }, [bibleKey]);
    return fontFamily ?? undefined;
}
