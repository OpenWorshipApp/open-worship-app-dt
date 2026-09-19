import { DEFAULT_LOCALE } from '../../lang/langHelpers';
import type {
    BibleXMLExtraType,
    BibleXMLJsonType,
} from '../../setting/bible-setting/bibleXMLJsonDataHelpers';
import { jsonToXMLText } from '../../setting/bible-setting/bibleXMLJsonDataHelpers';
import { BIBLE_KJV_KEY, kjvBibleModelInfo } from './bibleModelHelpers';

/**
 * The app-embedded KJV rendered as XML text, or `null` when it fails to
 * serialize.
 *
 * Its own module so the two callers — first-run creation in `BibleDataReader`
 * and the settings reset button in `bibleXMLHelpers` — can both reach it
 * without either importing the other.
 *
 * The bible behind it is ~5MB of JSON, so it is `import()`ed inside the
 * function and nowhere else: both callers are one-shot user actions, and
 * neither should cost anything at load time.
 */
export async function genEmbeddedKJVBibleXMLText() {
    const { basicKJVBibleData } = await import('./bible-data/kjvBibleHelpers');
    const extraData: BibleXMLExtraType = {
        newLines: [],
        newLinesTitleMap: {},
        customVersesMap: {},
    };
    return jsonToXMLText({
        ...basicKJVBibleData,
        info: {
            ...basicKJVBibleData.info,
            key: BIBLE_KJV_KEY,
            version: 1,
            locale: DEFAULT_LOCALE,
            numbersMap: Object.fromEntries(
                Array.from({ length: 10 }, (_, i) => [
                    i.toString(),
                    i.toString(),
                ]),
            ),
            keyBookMap: kjvBibleModelInfo.keyBookMap,
        },
        ...extraData,
    } as BibleXMLJsonType);
}
