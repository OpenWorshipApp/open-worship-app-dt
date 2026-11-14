import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    addMediaSession,
    genMediaSessionId,
    readSessions,
    toSessionSuffix,
    toUniqueSessionName,
} from '../media-sessions/mediaSessionData';
import type BibleItem from '../bible-list/BibleItem';
import { checkIsCrossChapterTarget } from '../helper/bible-helpers/bibleTargetHelpers';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { toForegroundSessionsTarget } from './foregroundSessionHelpers';
import { genCommonStyleSettingNames } from './foregroundStyleSettingNames';
import { getForegroundDefaultColors } from './foregroundThemeColorHelpers';
import {
    FOREGROUND_OPEN_PANELS_SETTING_NAME,
    requestForegroundPanelOpening,
    toOpenedPanelKeys,
} from './foregroundWidgetHelpers';
import {
    QUICK_TEXT_WIDGET_KEY,
    applyQuickTextPreset,
    toQuickTextPrefix,
    toQuickTextSettingName,
} from './quickTextPresetHelpers';

/**
 * Bible text is plain text, and Quick Text reads markdown: a verse with a
 * `*`, a `_` or a `<` in it would come out bold, slanted or eaten as a tag.
 * Only what markdown-it would act on is escaped, so a verse in any script
 * reads in the box as it reads in the Bible.
 */
export function escapeMarkdownText(text: string) {
    return text
        .replaceAll(/([\\`*_[\]<>|~])/g, String.raw`\$1`)
        .replaceAll(/^(\s*)([#>+=-])/gm, String.raw`$1\$2`)
        .replaceAll(/^(\s*\d+)([.)])/gm, String.raw`$1\$2`);
}

/**
 * The passage as Quick Text: its reference as a `### ` heading, the way the
 * Bible Verse preset sets it, then its words, each chapter of a passage that
 * crosses one a paragraph of its own. One verse goes without its number; a
 * range keeps `(16):` before each, the way Copy writes it.
 */
export async function genBibleItemQuickTextMarkdown(bibleItem: BibleItem) {
    const { target } = bibleItem;
    const isSingleVerse =
        !checkIsCrossChapterTarget(target) &&
        target.verseStart === target.verseEnd;
    const title = await bibleItem.toTitleWithBibleKey();
    const text = await bibleItem.toText(
        undefined,
        isSingleVerse ? 'none' : 'parenthesis',
    );
    const paragraphs = text
        .split(/\r?\n/)
        .map((line) => {
            return line.trim();
        })
        .filter((line) => {
            return line !== '';
        })
        .map(escapeMarkdownText);
    return {
        title,
        markdown: [`### ${escapeMarkdownText(title)}`, ...paragraphs].join(
            '\n\n',
        ),
        fontFamily: await readBibleFontFamily(bibleItem.bibleKey),
    };
}

/**
 * The family the Bible's text is drawn in -- its language's own face, an
 * `app-<family>` from that language's package (2026-11-09, the user: _all
 * related bible text have to use its language font-family_). '' when no
 * installed language names one: the session then keeps the panel's default.
 */
async function readBibleFontFamily(bibleKey: string) {
    try {
        return (await getBibleFontFamily(bibleKey)) ?? '';
    } catch (error) {
        console.error(error);
        return '';
    }
}

/**
 * The Bible's own font in a NEW verse session's Font box, which had been
 * left at `--`, the screen's default face.
 */
export function applyBibleVerseFont(suffix: string, fontFamily: string) {
    if (fontFamily !== '') {
        setSetting(
            genCommonStyleSettingNames(toQuickTextPrefix(suffix)).fontFamily,
            fontFamily,
        );
    }
}

/**
 * A Bible passage straight into Quick Text: a NEW session named after the
 * reference, holding the passage, dressed by the Bible Verse preset in the
 * Bible's own font, and the panel opened on it -- one press from the verse
 * to a Show button.
 *
 * Always a new session, never the one open: that one may hold a notice
 * somebody typed, or be on a screen.
 */
export async function openBibleItemInQuickText(bibleItem: BibleItem) {
    const { title, markdown, fontFamily } =
        await genBibleItemQuickTextMarkdown(bibleItem);
    const sessionId = genMediaSessionId();
    const suffix = toSessionSuffix(sessionId);
    // Written FIRST: the panel switching to the session reads it on the spot.
    setSetting(toQuickTextSettingName(suffix), markdown);
    // A new session has no colours: the look goes on the app theme's side.
    applyQuickTextPreset(
        suffix,
        'bible-verse',
        undefined,
        getForegroundDefaultColors(),
    );
    applyBibleVerseFont(suffix, fontFamily);
    const target = toForegroundSessionsTarget(QUICK_TEXT_WIDGET_KEY);
    addMediaSession(target, {
        id: sessionId,
        name: toUniqueSessionName(
            title,
            readSessions(target).map((session) => {
                return session.name;
            }),
        ),
    });
    if (!requestForegroundPanelOpening(QUICK_TEXT_WIDGET_KEY)) {
        setSetting(
            FOREGROUND_OPEN_PANELS_SETTING_NAME,
            toOpenedPanelKeys(
                getSetting(FOREGROUND_OPEN_PANELS_SETTING_NAME) ?? '',
                QUICK_TEXT_WIDGET_KEY,
            ),
        );
    }
}
