import type BibleItem from '../bible-list/BibleItem';
import RenderCustomVerseComp from '../bible-reader/RenderCustomVerseComp';
import {
    handleMatchClicking,
    useVerseLookupMatcher,
} from './RenderVerseLookupTextComp';
import { decorateLookupMatchesInElement } from './verseTextIndexHelpers';

/**
 * Custom/edited verse HTML with names and locations made clickable.
 *
 * Split from the plain-text path because that one can build React elements,
 * while this text arrives as sanitized HTML through `dangerouslySetInnerHTML` —
 * so the matches have to be wrapped in the DOM afterwards. This matters far more
 * than the name suggests: the words-of-Christ markup (`app-god-word`) makes most
 * gospel verses "custom", and before this they were silently never decorated.
 *
 * The index subscription lives HERE rather than in `RenderCustomVerseComp`, so
 * the component used for undecorated text never loads the index at all.
 */
export default function RenderCustomVerseLookupComp({
    bibleItem,
    customHtml,
    kjvShortVerse,
    lookupLangCode,
}: Readonly<{
    bibleItem: BibleItem;
    customHtml: string;
    kjvShortVerse: string;
    lookupLangCode: string;
}>) {
    const findMatchList = useVerseLookupMatcher(lookupLangCode, kjvShortVerse);
    return (
        <RenderCustomVerseComp
            bibleItem={bibleItem}
            customHtml={customHtml}
            decorateElement={
                findMatchList === null
                    ? undefined
                    : (element) => {
                          decorateLookupMatchesInElement(
                              element,
                              findMatchList,
                              handleMatchClicking,
                          );
                      }
            }
        />
    );
}
