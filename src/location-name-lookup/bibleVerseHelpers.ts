import type { CSSProperties } from 'react';
import { useState } from 'react';

import BibleItem from '../bible-list/BibleItem';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { getCurrentLookupBibleItemController } from '../bible-reader/LookupBibleItemController';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import { toChapterFullKeyFormat } from '../helper/bible-helpers/bibleKeyFormatHelpers';
import { toLocaleNumBible } from '../helper/bible-helpers/bibleLogicHelpers2';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { cloneJson } from '../helper/helpers';
import { DEFAULT_LANG_CODE } from '../lang/langHelpers';
import {
    getSelectedLookupLangCode,
    useSelectedLookupLangCode,
} from './lookupLangHelpers';

export type VerseDataType = {
    bibleKey: string;
    title: string;
    text: string;
    style: CSSProperties;
};

/**
 * `{ bibleKey: 'KJV', title: 'Genesis 35:11' }` -> `'(KJV) Genesis 35:11'`.
 *
 * The key is carried BESIDE the title rather than baked into it: the panel
 * writes the two into its title bar as separately styled spans, and only the
 * clipboard wants them joined back into one line.
 */
export function toVerseFullTitle({
    bibleKey,
    title,
}: Readonly<{ bibleKey: string; title: string }>) {
    return `(${bibleKey}) ${title}`;
}

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

/**
 * Which bible names a reference RIGHT NOW, for callers with no hook.
 *
 * The hook below is the one a panel wants; this is for one-shot reads outside
 * React, such as labelling a context menu the moment it opens.
 */
export function getLookupVerseBibleKey() {
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
 * `EXO 6:23` -> `{ title: 'Exodus 6:23', text: '(23): And Aaron took…' }`.
 *
 * `toText`, NOT `toFullText`: the reference is shown once, by the panel's title
 * bar, so prefixing the body with `(KJV) Exodus 6:23` again only cost a line of
 * a small floating widget.
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
    const text = await bibleItem.toText();
    const fontFamily = await getBibleFontFamily(bibleKey);
    return { bibleKey, title, text, style: { fontFamily } };
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
 * The three shapes of bible reference a record's prose can carry, as the
 * dataset stores them: `book-key://ACT`, `chapter-key://GEN 14` and
 * `verse-key://ACT 28:15`.
 */
export type BibleReferenceKindType = 'book' | 'chapter' | 'verse';

export const BIBLE_REFERENCE_KIND_BY_SCHEME: {
    [scheme: string]: BibleReferenceKindType;
} = {
    'book-key': 'book',
    'chapter-key': 'chapter',
    'verse-key': 'verse',
};

/**
 * One inline reference as the READER's bible names it.
 *
 * The datasets are written against the KJV, so a token's label is always its
 * English wording — a Khmer record reads `...ក្នុងកណ្ឌ [Acts](book-key://ACT)`,
 * one English word stranded in Khmer prose. Only the stored KEY is canonical,
 * so the label is re-derived here per bible: the book name comes from that
 * bible's own book map and the chapter number through its numeral list, exactly
 * as `bibleRenderHelper.toTitle` writes a verse title.
 *
 * Returns null when the key names nothing that bible knows, so a caller can
 * fall back to the label the dataset shipped rather than showing a blank.
 */
export async function shortToReferenceTitle(
    bibleKey: string,
    kind: BibleReferenceKindType,
    target: string,
): Promise<string | null> {
    if (kind === 'verse') {
        return await shortToVerseTitle(bibleKey, target);
    }
    // `GEN` for a book, `GEN 14` for a chapter — book keys never hold a space.
    const [bookKey, chapterText] = target.split(' ');
    const localeBook = await bibleRenderHelper.toLocaleBook(bibleKey, bookKey);
    if (!localeBook) {
        return null;
    }
    if (kind === 'book') {
        return localeBook;
    }
    const chapter = Number.parseInt(chapterText ?? '', 10);
    if (Number.isNaN(chapter)) {
        return null;
    }
    const localeChapter = await toLocaleNumBible(bibleKey, chapter);
    if (localeChapter === null) {
        return null;
    }
    return toChapterFullKeyFormat(localeBook, localeChapter);
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
