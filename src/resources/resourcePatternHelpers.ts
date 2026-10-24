import douayRheimsBibleJson from '../helper/bible-helpers/douayRheimsBible.json';
import kjvBibleConfigJson from '../helper/bible-helpers/kjvBibleConfig.json';
import kjvdBibleJson from '../helper/bible-helpers/kjvdBible.json';
import { getCurrentLocale, getLangData, tran } from '../lang/langHelpers';
import type { ResourceMatchPatternType } from './resourcesScanHelpers';

export function toResourcePatternLabel({
    pattern,
    bookKey,
    chapter,
    isBookLevel,
}: ResourceMatchPatternType) {
    const bookIndex = kjvBibleConfigJson.bookKeysOrder.indexOf(bookKey);
    const localizedBooks = getLangData(getCurrentLocale())?.bibleBooks.find(
        ({ books }) => books.length === kjvBibleConfigJson.bookKeysOrder.length,
    )?.books;
    // Use the already loaded language metadata; no Bible files need opening.
    const book =
        localizedBooks?.[bookIndex] ??
        (kjvBibleConfigJson.keyBookMap as Record<string, string>)[bookKey] ??
        (kjvdBibleJson.keyBookMap as Record<string, string>)[bookKey] ??
        (douayRheimsBibleJson.keyBookMap as Record<string, string>)[bookKey] ??
        bookKey;
    const description = isBookLevel
        ? `${book} ${tran('Introduction')}`
        : tran('{book} chapter {chapter}')
              .replace('{book}', book)
              .replace('{chapter}', String(chapter));
    return `${pattern}, ${description}`;
}
