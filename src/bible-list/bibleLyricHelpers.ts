import { toLocaleNumBible } from '../helper/bible-helpers/bibleLogicHelpers2';
import { checkIsCrossChapterTarget } from '../helper/bible-helpers/bibleTargetHelpers';
import { dirSourceSettingNames } from '../helper/constants';
import DirSource from '../helper/DirSource';
import { getActiveDirSourceSettingName } from '../media-sessions/folderSessionHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    getAvailableFileName,
    getMimetypeExtensions,
    toPortableFileName,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type BibleItem from './BibleItem';
import { genBibleLyricMarkdown } from './bibleLyricMarkdownHelpers';
import { readBiblePassageVerses } from './biblePassageVerseHelpers';

// A verse's number as that version writes it; `2:1` once the passage has
// crossed into another chapter, where `1` alone would read as this one's.
async function toVerseNumberText(
    bibleKey: string,
    chapter: number,
    verse: number,
    isCrossChapter: boolean,
) {
    const localeVerse = (await toLocaleNumBible(bibleKey, verse)) ?? `${verse}`;
    if (!isCrossChapter) {
        return localeVerse;
    }
    const localeChapter =
        (await toLocaleNumBible(bibleKey, chapter)) ?? `${chapter}`;
    return `${localeChapter}:${localeVerse}`;
}

// Imported only when the popup's button is pressed, like the slides. The song
// is titled `(KJV) John 3:16`, the passage's own version; the other versions'
// passages are its subtitle, `(KH) ..., (NIV) ...`. One `Verse 16` part per
// Bible verse and in it one `16: ...` line per version, its own version first.
// The file is named after every version, and Generate Slides names its
// document the same way, so one passage made with other versions is a file of
// its own name.
export async function createBibleItemLyric(
    source: BibleItem,
    selectedBibleKeys: string[] = [source.bibleKey],
) {
    const bibleItem = source.clone();
    const bibleKeys = [...new Set([bibleItem.bibleKey, ...selectedBibleKeys])];
    try {
        const dirSource = await DirSource.getInstance(
            getActiveDirSourceSettingName(dirSourceSettingNames.APP_DOCUMENT),
        );
        if (!dirSource.isDirPathValid) {
            throw new Error('Documents directory is unavailable');
        }
        const dirPath = dirSource.dirPath;
        const passageVerseList = await readBiblePassageVerses(
            bibleItem,
            bibleKeys,
            tran('Create Lyric'),
        );
        if (passageVerseList === null) {
            return null;
        }
        const titleList: string[] = [];
        for (const bibleKey of bibleKeys) {
            const titleItem = bibleItem.clone();
            titleItem.bibleKey = bibleKey;
            titleList.push(await titleItem.toTitleWithBibleKey());
        }
        const [title = '', ...subtitleList] = titleList;
        const isCrossChapter = checkIsCrossChapterTarget(bibleItem.target);
        const verses = [];
        for (const { chapter, verse, textList } of passageVerseList) {
            const lines: string[] = [];
            for (const [index, bibleKey] of bibleKeys.entries()) {
                const numberText = await toVerseNumberText(
                    bibleKey,
                    chapter,
                    verse,
                    isCrossChapter,
                );
                lines.push(`${numberText}: ${textList[index] ?? ''}`);
            }
            verses.push({ number: verse, lines });
        }
        const content = genBibleLyricMarkdown(
            title,
            verses,
            subtitleList.join(', '),
        );
        // Dynamic on purpose: open-lyric stays out of every Bible row until a
        // song is made, and a static import of the lyric modules can close a
        // cycle through the app-document helpers.
        const { default: Lyric } = await import('../lyric-list/Lyric');
        // Serialize name selection + creation for repeated presses.
        const fileSource = await unlocking('create-bible-lyric', async () => {
            const name = await getAvailableFileName(
                dirPath,
                toPortableFileName(titleList.join(', '), tran('Bible Item')),
                `.${getMimetypeExtensions('lyric')[0]}`,
            );
            return Lyric.createWithContent(dirPath, name, content);
        });
        if (fileSource === null) {
            throw new Error('Unable to create lyric document');
        }
        dirSource.fireRefreshEvent();
        return fileSource;
    } catch (error) {
        handleError(error);
        showSimpleToast(
            tran('Create Lyric'),
            tran('Failed to create lyric document'),
        );
        return null;
    }
}
