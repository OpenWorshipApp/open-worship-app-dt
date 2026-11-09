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
import { toForegroundSessionsTarget } from './foregroundSessionHelpers';
import {
    FOREGROUND_OPEN_PANELS_SETTING_NAME,
    requestForegroundPanelOpening,
    toOpenedPanelKeys,
} from './foregroundWidgetHelpers';
import {
    QUICK_TEXT_WIDGET_KEY,
    applyQuickTextPreset,
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
 * The passage as Quick Text: its reference in bold, then its words, each
 * chapter of a passage that crosses one a paragraph of its own. One verse
 * goes without its number; a range keeps `(16):` before each, the way Copy
 * writes it. Bold rather than a heading: a heading is sized by the screen's
 * root, not by the Font Size the operator sets.
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
        markdown: [`**${escapeMarkdownText(title)}**`, ...paragraphs].join(
            '\n\n',
        ),
    };
}

/**
 * A Bible passage straight into Quick Text: a NEW session named after the
 * reference, holding the passage, dressed by the Bible Verse preset, and the
 * panel opened on it -- one press from the verse to a Show button.
 *
 * Always a new session, never the one open: that one may hold a notice
 * somebody typed, or be on a screen.
 */
export async function openBibleItemInQuickText(bibleItem: BibleItem) {
    const { title, markdown } = await genBibleItemQuickTextMarkdown(bibleItem);
    const sessionId = genMediaSessionId();
    const suffix = toSessionSuffix(sessionId);
    // Written FIRST: the panel switching to the session reads it on the spot.
    setSetting(toQuickTextSettingName(suffix), markdown);
    applyQuickTextPreset(suffix, 'bible-verse');
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
