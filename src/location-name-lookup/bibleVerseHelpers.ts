import type { CSSProperties } from 'react';
import { useState } from 'react';

import BibleItem from '../bible-list/BibleItem';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { getCurrentLookupBibleItemController } from '../bible-reader/LookupBibleItemController';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { cloneJson } from '../helper/helpers';
import { DEFAULT_LANG_CODE } from '../lang/langHelpers';
import {
    getSelectedLookupLangCode,
    useSelectedLookupLangCode,
} from './lookupLangHelpers';

export type VerseDataType = {
    title: string;
    fullText: string;
    style: CSSProperties;
};

/**
 * Which bible a stored reference is READ BACK in.
 *
 * English records were extracted FROM the KJV, so its wording is the one that
 * matches them and the reference stays KJV however the reader is set. In any
 * other lookup language the KJV becomes the odd one out: a Khmer record whose
 * own prose is Khmer, citing `Ezekiel 27:11` in English, is unreadable to
 * exactly the person who chose that language — so the reference follows
 * whichever bible the reader is showing instead.
 *
 * This is purely a RENDERING choice. The stored key is canonical (`EZK 27:11`)
 * and targets are canonical throughout the app; `bibleRenderHelper.toTitle`
 * localizes the book name and the numerals per bible key without renumbering
 * anything. The KJV text is still what the in-verse scan reads — see
 * `checkCanLookupVerseText`.
 */
export function toLookupVerseBibleKey(currentBibleKey: string | null) {
    if (getSelectedLookupLangCode() === DEFAULT_LANG_CODE) {
        return BIBLE_KJV_KEY;
    }
    return currentBibleKey ?? BIBLE_KJV_KEY;
}

function getLookupVerseBibleKey() {
    const viewController = getCurrentLookupBibleItemController();
    return toLookupVerseBibleKey(
        viewController?.selectedBibleItem.bibleKey ?? null,
    );
}

/**
 * The same answer, kept current while a detail panel is open.
 *
 * These panels are window-level widgets with no controller in scope, so the
 * reader's `update` event is subscribed on the registry instance rather than
 * through `useBibleItemViewControllerUpdateEvent`, which needs the context.
 * Called once per panel BODY — not per verse row — so an open panel adds one
 * listener, not one per reference in a record that lists hundreds.
 */
export function useLookupVerseBibleKey() {
    const langCode = useSelectedLookupLangCode();
    const [bibleKey, setBibleKey] = useState(getLookupVerseBibleKey);
    useAppEffect(() => {
        setBibleKey(getLookupVerseBibleKey());
        const viewController = getCurrentLookupBibleItemController();
        if (viewController === null) {
            return;
        }
        const instanceEvents = viewController.registerEventListener(
            ['update'],
            () => {
                setBibleKey(getLookupVerseBibleKey());
            },
        );
        return () => {
            viewController.unregisterEventListener(instanceEvents);
        };
    }, [langCode]);
    return bibleKey;
}

/**
 * Resolves one stored reference to a bible item.
 *
 * The dataset stores CANONICAL verse keys — `GEN 41:1`, occasionally a range —
 * and `fromVerseKey` is the parser for exactly that shape: it defaults
 * `verseEnd` to `verseStart`, so a cited verse stays one verse.
 *
 * `fromTitleText` is deliberately NOT used here. That one drives the lookup
 * INPUT, where a half-typed `GEN 41:1` still means "verse 1 onwards" and so
 * comes back widened to the end of the chapter. Routing citations through it
 * turned every one of them into `Genesis 41:1-57`, made a click open the rest
 * of the chapter instead of the verse that was cited, and put those same wrong
 * ranges on the clipboard via Copy — while costing a whole chapter's worth of
 * bible reads and DOM per citation.
 */
async function shortToBibleItem(bibleKey: string, shortVerse: string) {
    const bibleItem = await BibleItem.fromVerseKey(bibleKey, shortVerse);
    if (bibleItem !== null) {
        return bibleItem;
    }
    // Anything outside the canonical form still gets the lenient parser rather
    // than being dropped from the list.
    return await BibleItem.fromTitleText(bibleKey, shortVerse);
}

/**
 * The font of the bible those references are read in.
 *
 * A verse panel's TITLE is a reference in that bible — `លោកុប្បត្តិ ១០:៤`, not
 * `Genesis 10:4`, once the lookup language stops being English — and it renders
 * in the widget chrome, outside the body that carries `VerseDataType.style`. It
 * takes the BIBLE's font rather than the lookup language's: the two are
 * independent settings, and the reference is written by the bible.
 */
export function useLookupVerseFontFamily() {
    const bibleKey = useLookupVerseBibleKey();
    const [fontFamily] = useAppStateAsync(() => {
        return getBibleFontFamily(bibleKey);
    }, [bibleKey]);
    return fontFamily ?? undefined;
}

/**
 * `EXO 6:23` -> `{ title: 'Exodus 6:23', fullText: '(23): And Aaron took…' }`.
 */
export async function shortToVerseData(
    bibleKey: string,
    shortVerse: string,
): Promise<VerseDataType | null> {
    const bibleItem = await shortToBibleItem(bibleKey, shortVerse);
    if (bibleItem === null) {
        return null;
    }
    const title = await bibleItem.toTitle();
    const fullText = await bibleItem.toFullText();
    const fontFamily = await getBibleFontFamily(bibleKey);
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
    bibleKey: string,
    shortVerse: string,
): Promise<string | null> {
    const bibleItem = await shortToBibleItem(bibleKey, shortVerse);
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
 * render as a title in that bible — setting the text first would format it
 * against whichever bible was previously selected.
 */
export async function openVerseInBibleLookup(
    viewController: LookupBibleItemController,
    shortVerse: string,
) {
    // The reader's own key under a non-English lookup language, so opening a
    // citation reads it where the panel just showed it rather than swapping the
    // reader to the KJV underneath the user.
    const bibleKey = toLookupVerseBibleKey(
        viewController.selectedBibleItem.bibleKey,
    );
    const bibleItem = await shortToBibleItem(bibleKey, shortVerse);
    if (bibleItem === null) {
        return false;
    }
    viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
        bibleKey,
        target: cloneJson(bibleItem.target),
    });
    return true;
}
