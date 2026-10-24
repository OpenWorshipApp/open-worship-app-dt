import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    createMouseEvent,
    type MenuAnchorType,
} from '../context-menu/contextMenuEventHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { handleError } from '../helper/errorHelpers';
import {
    checkIsCrossChapterTarget,
    toSingleChapterTarget,
} from '../helper/bible-helpers/bibleTargetHelpers';
import type BibleItem from './BibleItem';
import {
    bibleRenderHelper,
    type CompiledVerseType,
} from './bibleRenderHelpers';
import {
    toVerseListText,
    type BibleVerseNumberStyleType,
} from './bibleVerseTextHelpers';

/**
 * The copy menu's _More…_ (2026-10-22, the user: _show maximum option of all
 * (title and text) like: bible key located after verse title plus verse
 * number without `()` but with `:` …_, and _each option should show what text
 * be like in mouse hover title_): every way a passage's title and text can be
 * copied, each row's hover showing what it copies. Loaded on the press, from
 * `genBibleItemCopyingContextMenu`.
 */

// Where the version goes in a copied title: `(KJV) John 3:16`,
// `John 3:16 (KJV)`, or `John 3:16`.
export type BibleTitleKeyStyleType = 'before' | 'after' | 'none';

// `null` leaves that part out: a title alone, or the text alone.
export type BibleCopyFormatType = {
    titleStyle: BibleTitleKeyStyleType | null;
    verseNumberStyle: BibleVerseNumberStyleType | null;
};

const TITLE_STYLE_LIST: BibleTitleKeyStyleType[] = ['before', 'after', 'none'];
const VERSE_NUMBER_STYLE_LIST: BibleVerseNumberStyleType[] = [
    'parenthesis',
    'colon',
    'none',
];

// A hover shows what a row copies, not all of it: the passage's first verses.
const PREVIEW_VERSE_COUNT = 3;
// Wider than a menu's usual 210px: two parts and a `+` in one label.
const MENU_WIDTH = 320;

export function toCopyingTitle(
    bibleItem: BibleItem,
    title: string,
    titleStyle: BibleTitleKeyStyleType,
) {
    if (titleStyle === 'before') {
        return `${bibleItem.getCopyingBibleKey()} ${title}`;
    }
    if (titleStyle === 'after') {
        return `${title} ${bibleItem.getCopyingBibleKey()}`;
    }
    return title;
}

export async function toBibleItemCopyingText(
    bibleItem: BibleItem,
    format: BibleCopyFormatType,
) {
    const lineList: string[] = [];
    if (format.titleStyle !== null) {
        const title = await bibleItem.toTitle();
        lineList.push(toCopyingTitle(bibleItem, title, format.titleStyle));
    }
    if (format.verseNumberStyle !== null) {
        lineList.push(
            await bibleItem.toText(undefined, format.verseNumberStyle),
        );
    }
    return lineList.join('\n');
}

type CopyingPreviewType = {
    title: string;
    // A passage crossing chapters copies each chapter under its own title.
    sectionTitle: string | null;
    verseList: CompiledVerseType[];
    isCut: boolean;
};

/**
 * Only what a hover shows is read: the first verses of a one-chapter passage,
 * or the first chapter of one crossing chapters (its section title needs the
 * chapter's last verse) — never the whole passage once per row.
 */
async function readCopyingPreview(
    bibleItem: BibleItem,
): Promise<CopyingPreviewType> {
    const { bibleKey, target } = bibleItem;
    const title = await bibleItem.toTitle();
    const isCrossChapter = checkIsCrossChapterTarget(target);
    const verseCount = target.verseEnd - target.verseStart + 1;
    const previewTarget = isCrossChapter
        ? target
        : toSingleChapterTarget(
              target.bookKey,
              target.chapter,
              target.verseStart,
              Math.min(
                  target.verseEnd,
                  target.verseStart + PREVIEW_VERSE_COUNT - 1,
              ),
          );
    const verseList =
        (await bibleRenderHelper.toVerseTextList(
            bibleKey,
            previewTarget,
            true,
            { start: 0, count: 1 },
        )) ?? [];
    let sectionTitle: string | null = null;
    const firstVerse = verseList[0];
    if (isCrossChapter && firstVerse !== undefined) {
        const lastVerse = verseList.at(-1) ?? firstVerse;
        sectionTitle = await bibleRenderHelper.toTitle(
            bibleKey,
            toSingleChapterTarget(
                target.bookKey,
                firstVerse.chapter,
                firstVerse.verse,
                lastVerse.verse,
            ),
        );
    }
    return {
        title,
        sectionTitle,
        verseList: verseList.slice(0, PREVIEW_VERSE_COUNT),
        isCut: isCrossChapter || verseCount > PREVIEW_VERSE_COUNT,
    };
}

export function toCopyingPreview(
    bibleItem: BibleItem,
    preview: CopyingPreviewType,
    format: BibleCopyFormatType,
) {
    const lineList: string[] = [];
    if (format.titleStyle !== null) {
        lineList.push(
            toCopyingTitle(bibleItem, preview.title, format.titleStyle),
        );
    }
    if (format.verseNumberStyle !== null && preview.verseList.length > 0) {
        if (preview.sectionTitle !== null) {
            lineList.push(preview.sectionTitle);
        }
        const text = toVerseListText(
            preview.verseList,
            format.verseNumberStyle,
        );
        lineList.push(preview.isCut ? `${text} …` : text);
    }
    return lineList.join('\n');
}

function toTitleStyleLabel(titleStyle: BibleTitleKeyStyleType) {
    if (titleStyle === 'before') {
        return tran('(Version) Title');
    }
    if (titleStyle === 'after') {
        return tran('Title (Version)');
    }
    return tran('Title without Version');
}

function toVerseNumberStyleLabel(verseNumberStyle: BibleVerseNumberStyleType) {
    if (verseNumberStyle === 'parenthesis') {
        return tran('(1): Text');
    }
    if (verseNumberStyle === 'colon') {
        return tran('1: Text');
    }
    return tran('Text without Numbers');
}

function toFormatLabel({ titleStyle, verseNumberStyle }: BibleCopyFormatType) {
    const labelList: string[] = [];
    if (titleStyle !== null) {
        labelList.push(toTitleStyleLabel(titleStyle));
    }
    if (verseNumberStyle !== null) {
        labelList.push(toVerseNumberStyleLabel(verseNumberStyle));
    }
    return labelList.join(' + ');
}

export function genBibleItemCopyFormatList(): BibleCopyFormatType[][] {
    return [
        TITLE_STYLE_LIST.flatMap((titleStyle) => {
            return VERSE_NUMBER_STYLE_LIST.map((verseNumberStyle) => {
                return { titleStyle, verseNumberStyle };
            });
        }),
        TITLE_STYLE_LIST.map((titleStyle) => {
            return { titleStyle, verseNumberStyle: null };
        }),
        VERSE_NUMBER_STYLE_LIST.map((verseNumberStyle) => {
            return { titleStyle: null, verseNumberStyle };
        }),
    ];
}

export async function genBibleItemCopyFormatMenuItems(
    bibleItem: BibleItem,
): Promise<ContextMenuItemType[]> {
    const preview = await readCopyingPreview(bibleItem);
    const genItem = (format: BibleCopyFormatType): ContextMenuItemType => {
        return {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: toFormatLabel(format),
            title: toCopyingPreview(bibleItem, preview, format),
            onSelect: () => {
                toBibleItemCopyingText(bibleItem, format)
                    .then(copyToClipboard)
                    .catch(handleError);
            },
        };
    };
    const [bothList, titleList, textList] = genBibleItemCopyFormatList();
    return [
        { menuElement: tran('Title and Text'), isSectionHeader: true },
        ...bothList.map(genItem),
        { menuElement: tran('Title Only'), isSectionHeader: true },
        ...titleList.map(genItem),
        { menuElement: tran('Text Only'), isSectionHeader: true },
        ...textList.map(genItem),
    ];
}

/**
 * Opens where _More…_ was (`anchor`, read at the press: by now that menu is
 * gone), pulled left as far as it must to stay in the window at its width.
 */
export async function showBibleItemCopyFormatMenu(
    bibleItem: BibleItem,
    anchor: MenuAnchorType | null,
) {
    try {
        const items = await genBibleItemCopyFormatMenuItems(bibleItem);
        const { innerWidth, innerHeight } = window;
        const x = Math.max(
            0,
            Math.min(
                anchor?.x ?? (innerWidth - MENU_WIDTH) / 2,
                innerWidth - MENU_WIDTH - 8,
            ),
        );
        showAppContextMenu(
            createMouseEvent(x, anchor?.y ?? innerHeight / 4),
            items,
            { style: { maxWidth: `${MENU_WIDTH}px` } },
        );
    } catch (error) {
        handleError(error);
    }
}
