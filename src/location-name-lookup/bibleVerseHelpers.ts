import type { CSSProperties } from 'react';

import BibleItem from '../bible-list/BibleItem';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { cloneJson } from '../helper/helpers';

export type VerseDataType = {
    title: string;
    fullText: string;
    style: CSSProperties;
};

// The lookup dataset stores its verse references against the KJV, and the
// records themselves are English, so the references are read back in KJV too
// rather than in whichever bible the reader happens to be showing.
const LOOKUP_BIBLE_KEY = BIBLE_KJV_KEY;

/**
 * `EXO 6:23` -> `{ title: 'Exodus 6:23', fullText: '(23): And Aaron took…' }`.
 */
export async function shortToVerseData(
    shortVerse: string,
): Promise<VerseDataType | null> {
    const bibleItem = await BibleItem.fromTitleText(
        LOOKUP_BIBLE_KEY,
        shortVerse,
    );
    if (bibleItem === null) {
        return null;
    }
    const title = await bibleItem.toTitle();
    const fullText = await bibleItem.toFullText();
    const fontFamily = await getBibleFontFamily(LOOKUP_BIBLE_KEY);
    return { title, fullText, style: { fontFamily } };
}

/**
 * Title only — deliberately NOT `shortToVerseData`.
 *
 * A record like Moses lists dozens of verses and the list shows nothing but
 * their references, so reading each verse's TEXT to render a label would be
 * dozens of pointless bible reads. The text is read once, on demand, when a
 * single reference is actually opened.
 */
export async function shortToVerseTitle(
    shortVerse: string,
): Promise<string | null> {
    const bibleItem = await BibleItem.fromTitleText(
        LOOKUP_BIBLE_KEY,
        shortVerse,
    );
    if (bibleItem === null) {
        return null;
    }
    return await bibleItem.toTitle();
}

/**
 * Loads a verse reference into the reader's lookup input, the same way the
 * bible list's own "Lookup" context-menu entry does.
 *
 * `applyTargetOrBibleKey` applies the bible key BEFORE it derives the input text
 * from the target, so passing both in one call is what makes the reference
 * render as a KJV title — setting the text first would format it against
 * whichever bible was previously selected.
 */
export async function openVerseInBibleLookup(
    viewController: LookupBibleItemController,
    shortVerse: string,
) {
    const bibleItem = await BibleItem.fromTitleText(
        LOOKUP_BIBLE_KEY,
        shortVerse,
    );
    if (bibleItem === null) {
        return false;
    }
    viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
        bibleKey: LOOKUP_BIBLE_KEY,
        target: cloneJson(bibleItem.target),
    });
    return true;
}
