/**
 * The app side of `owa_resource_file`'s `draft`, `save` and `preview`
 * (2026-11-09, EC-464): a study file for a passage, drafted by the help
 * window's assistant and SAVED by the person's press into
 * `<data folder>/resources/Default` -- or, since 2026-11-12 (EC-509), into
 * the Bible Notes list in front, the person picking at Create (`to`). Loaded
 * from `handleAgentResourcesRequest` only when one of the three is asked
 * for.
 *
 * - `draft` writes nothing. It reads the passage off the reference (the
 *   book, chapter and span in the name are the app's, never the model's),
 *   quotes it from the installed Bible, puts in the verse tokens, checks the
 *   diagrams and answers the whole file with the name it would take -- the
 *   next free one when that is taken (`MAT.3.3-7 The Voice (1).md`). With
 *   `file`, a CHANGE to a study file already in Default or Bible Notes: the
 *   new text, what it changes and the `hash` of the file it was drafted
 *   from.
 * - `save` is the press. It makes Default when it is missing and puts it on
 *   the panel's list unless a listed folder already shows it (the Bible
 *   Notes list watches its own folder and needs neither), never writes
 *   over a file (a name taken since the draft takes the next free one), and
 *   writes a change only while the file still reads as it did at the draft.
 *   Each write takes a backup first, so **Undo this change** puts it back --
 *   a new file goes to the trash.
 * - `preview` writes the draft into a folder of its own under the system's
 *   temporary folder (the last three kept) and opens it in the Markdown
 *   Preview window, diagrams drawn.
 * - A change goes by PART (EC-479): `section` names a heading and `content`
 *   is its new text, `append` adds words at the end of it or of the file;
 *   `content` alone is still the whole new text. Or it writes some WORDS
 *   anew where they stand (2026-11-12, EC-537): `replace`, pairs of `from`
 *   as the file writes it and `to`, within `section` when one is named --
 *   every other letter of the file as it was.
 * - `translate` writes nothing either (EC-478): the file in the parts a
 *   translation treats apart, each quoted passage quoted again from
 *   `bible`. The help window translates the words part by part and drafts
 *   the result; an outside agent can do the same.
 *
 * `save` and `preview` are refused to the help window's MODEL
 * (`runMcpToolCall`): the model drafts, the person presses.
 */
import {
    STUDY_CONTENT_MAX_CHARS,
    STUDY_FILE_EXTENSION,
    STUDY_FILE_MAX_CHARS,
    STUDY_FILE_MAX_DIAGRAMS,
    STUDY_BIBLE_NOTES_LABEL,
    STUDY_FOLDER_NAME,
    STUDY_MAX_DIAGRAMS,
    STUDY_MAX_QUOTED_VERSES,
    STUDY_MAX_VERSE_TOKENS,
    STUDY_PASSAGE_MAX_VERSES,
    STUDY_PLACE_LIST,
    STUDY_REMOVE_ALONE_REASON,
    STUDY_REPLACE_ALONE_REASON,
    type StudyPlaceType,
    type StudyQuoteType,
    type StudyReplacedType,
    type StudyRequotedPassageType,
    applyStudyEdit,
    applyStudyRemove,
    applyStudyVerseTokens,
    checkIsSameStudyPassage,
    composeStudyFile,
    describeStudyChange,
    describeStudyEditKept,
    describeStudyReplace,
    describeStudyRequotedPassages,
    describeStudyRestoredPassages,
    lintStudyContent,
    listChangedStudyDiagrams,
    listStudyHalves,
    listStudyNewPassages,
    listStudyVerseTokens,
    mergeStudyQuoteLines,
    readStudyFileName,
    readStudyTitleLine,
    replaceStudyLineRanges,
    restoreStudyPassages,
    separateStudyLines,
    splitStudyFooter,
    splitStudyForTranslation,
    splitStudyTranslations,
    summarizeStudyChange,
    toStudyBody,
    toStudyFileName,
    toStudyQuoteLines,
    toStudyQuoteMaxVerses,
    toStudySpanText,
    toStudyTextHash,
    toStudyTitle,
} from './agentStudyFileRules';
import {
    type StudyOwnQuoteRequotedType,
    type StudyOwnQuoteUnlikeType,
    checkIsStudyPassageLike,
    describeStudyOwnQuotes,
    judgeStudyOwnQuote,
    listStudyOwnQuotes,
    replaceStudyOwnQuotes,
} from './agentStudyOwnQuoteRules';
import {
    type StudyReplaceRepairType,
    applyStudyReplaceChecked,
    describeStudyReplaceRepair,
} from '../chatbot/studyNameCheckHelpers';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import type BibleItem from '../bible-list/BibleItem';
import { getActiveBibleNotesDirPath } from '../bible-list/note/bibleNotesDirHelpers';
import { announceResourcesChanged } from '../resources/resourcesChangedEvent';
import {
    genFreeFilePath,
    getResourcesDataDirPath,
} from '../resources/resourcesCopyHelpers';
import {
    addResourcesFoldersToList,
    filterUnlistedResourcesFolders,
    getResourcesFolderList,
} from '../resources/resourcesFolderHelpers';
import {
    MAX_SCAN_DEPTH,
    invalidateResourcesScanCache,
} from '../resources/resourcesScanHelpers';
import {
    NoBackupError,
    genUndoField,
    runWithAgentBackup,
} from './agentBackupHelpers';
import { splitNoteVerseRef } from './agentNoteBlockHelpers';
import { handleError } from './errorHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsCreateDir,
    fsDeleteFile,
    fsGetFileStamp,
    fsListDirents,
    fsReadFile,
    fsWriteFile,
    getTempPath,
    pathBasename,
    pathJoin,
} from '../server/fileHelpers';

export type AgentStudyRequestType = {
    action?: unknown;
    ref?: unknown;
    title?: unknown;
    content?: unknown;
    bible?: unknown;
    name?: unknown;
    file?: unknown;
    hash?: unknown;
    section?: unknown;
    append?: unknown;
    replace?: unknown;
    remove?: unknown;
    to?: unknown;
};

type RefusalType = { isError: true; reason: string };

function toReason(reason: string): RefusalType {
    return { isError: true, reason };
}

const MAX_REFERENCE_LENGTH = 80;
const PREVIEW_DIR_NAME = 'open-worship-app-study-preview';
const PREVIEW_KEEP_COUNT = 3;
const FOOTNOTE_TEXT =
    'Drafted with the app assistant. Check it against your Bible.';

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function getStudyDirPath() {
    return pathJoin(getResourcesDataDirPath(), STUDY_FOLDER_NAME);
}

/** The footnote in the app's language; English when that cannot be read. */
async function getFootnote() {
    try {
        const { tran } = await import('../lang/langHelpers');
        return tran(
            'Drafted with the app assistant. Check it against your Bible.',
        );
    } catch (_error) {
        return FOOTNOTE_TEXT;
    }
}

/**
 * A passage's verses as a quote: its reference as the Bible writes it, a
 * verse a line, and whether it was cut at `maxVerses`. A passage over two
 * chapters numbers its verses `3:16`, since the numbers start over.
 */
async function readQuote(
    bibleItem: BibleItem,
    maxVerses: number,
): Promise<{ quote: StudyQuoteType; isCut: boolean } | null> {
    const verseList = await bibleItem.toVerseTextList();
    if (verseList === null || verseList.length === 0) {
        return null;
    }
    const isCrossChapter = verseList.some((verse) => {
        return verse.chapter !== verseList[0].chapter;
    });
    return {
        quote: {
            title: await bibleItem.toTitle(),
            bibleKey: bibleItem.bibleKey,
            verses: verseList.slice(0, maxVerses).map((verse) => {
                return {
                    number: isCrossChapter
                        ? `${verse.localeChapter}:${verse.localeVerse}`
                        : verse.localeVerse,
                    text: String(verse.text ?? '')
                        .replace(/<[^>]*>/g, '')
                        .replace(/\s+/g, ' ')
                        .trim(),
                };
            }),
        },
        isCut: verseList.length > maxVerses,
    };
}

/**
 * The Bible each verse is read from: the one asked for, else the one the
 * Bible Lookup is on, then every other installed one (`resolveVersionOrder`).
 */
async function getVersions(bible: string | null) {
    const { resolveVersionOrder } = await import('./agentBibleHelpers');
    const resolved = await resolveVersionOrder(bible);
    if (!('order' in resolved)) {
        return toReason(resolved.reason);
    }
    return resolved;
}

async function getVersionOrder(bible: string | null) {
    const versions = await getVersions(bible);
    return 'isError' in versions ? versions : versions.order;
}

/**
 * A passage as the app quotes it from one Bible -- its reference as that
 * Bible writes it and its lines -- or null when the Bible cannot read it.
 */
async function quoteStudyPassage(
    title: string,
    bibleKey: string,
    maxVerses: number,
) {
    const { resolveBibleItem } = await import('./agentBibleHelpers');
    const bibleItem = await resolveBibleItem(title, [bibleKey]).catch(() => {
        return null;
    });
    const read =
        bibleItem === null
            ? null
            : await readQuote(bibleItem, maxVerses).catch(() => {
                  return null;
              });
    if (read === null) {
        return null;
    }
    const lines = toStudyQuoteLines(read.quote);
    if (read.isCut) {
        lines.push('>', '> …');
    }
    return { title: read.quote.title, lines };
}

/**
 * New words with each passage they quote in the app's form under an
 * installed Bible's name, which the old text does not quote -- a model's
 * own quote -- quoted from that Bible (2026-11-13, EC-565): a line holding
 * its words is kept as sent (a phrase put in bold), every other as the
 * Bible reads. A Bible not installed, a reference it cannot read and a
 * reference read as other verses than the words number are left as
 * written. Only such a passage costs a Bible read.
 */
async function requoteNewStudyPassages(
    oldText: string,
    text: string,
    installed: string[],
) {
    const requoted: StudyRequotedPassageType[] = [];
    const ranges: { start: number; end: number; lines: string[] }[] = [];
    for (const passage of listStudyNewPassages(oldText, text)) {
        const bibleKey = findInstalledBibleKey(installed, passage.bibleKey);
        const quoted =
            bibleKey === undefined
                ? null
                : await quoteStudyPassage(
                      passage.title,
                      bibleKey,
                      toStudyQuoteMaxVerses(passage.lines),
                  );
        // Read by its words too (EC-575): a head with a short book name and
        // no verse numbered under it is the passage its words are.
        if (
            bibleKey === undefined ||
            quoted === null ||
            !(
                checkIsSameStudyPassage(passage, quoted.title, quoted.lines) ||
                checkIsStudyPassageLike(passage.lines, quoted.lines)
            )
        ) {
            continue;
        }
        const merged = mergeStudyQuoteLines(quoted.lines, passage.lines);
        if (merged.changedCount === 0) {
            continue;
        }
        ranges.push({
            start: passage.start,
            end: passage.end,
            lines: merged.lines,
        });
        requoted.push({
            title: quoted.title,
            bibleKey,
            lineCount: merged.changedCount,
        });
    }
    return {
        text: ranges.length === 0 ? text : replaceStudyLineRanges(text, ranges),
        requoted,
    };
}

/** The installed Bible a key names, whatever its case, or undefined. */
function findInstalledBibleKey(installed: string[], bibleKey: string | null) {
    const wanted = bibleKey?.toLowerCase();
    return installed.find((key) => {
        return key.toLowerCase() === wanted;
    });
}

/** `order` with `bibleKey` first, when there is one. */
function toOrderFrom(bibleKey: string | undefined, order: string[]) {
    return bibleKey === undefined
        ? order
        : [
              bibleKey,
              ...order.filter((key) => {
                  return key !== bibleKey;
              }),
          ];
}

/** Some of a study's words, and the Bibles their verse tokens are read from. */
type StudyTokenPartType = { text: string; order: string[] };

/**
 * A changed study in the parts its verse tokens are read by (2026-11-13,
 * EC-570): the study as written and each translation added after it, each
 * from the Bible its own passage is quoted from, then `order`. Read from
 * the Lookup's Bible, a verse added to the user's John 3 study had come in
 * the other language in one half or the other, whichever Bible the Lookup
 * was on. A Bible asked for is every part's.
 */
function toStudyTokenParts(
    text: string,
    versions: { order: string[]; installed: string[] },
    isBibleAsked: boolean,
): StudyTokenPartType[] {
    if (listStudyVerseTokens(text).length === 0) {
        return [{ text, order: versions.order }];
    }
    return toStudyHalfParts(text, versions, isBibleAsked);
}

/** A study's halves, each with the Bibles its verses are read from. */
function toStudyHalfParts(
    text: string,
    versions: { order: string[]; installed: string[] },
    isBibleAsked: boolean,
): StudyTokenPartType[] {
    if (isBibleAsked) {
        return [{ text, order: versions.order }];
    }
    return listStudyHalves(text).map((half) => {
        return {
            text: half.text,
            order: toOrderFrom(
                findInstalledBibleKey(versions.installed, half.bibleKey),
                versions.order,
            ),
        };
    });
}

/**
 * A new study's words in the parts its verses are read by: as written,
 * from its passage's Bible (`bodyOrder`) -- and each translation drafted
 * after it (EC-609) from the Bible its own passage is quoted from, then
 * `order`, as a changed study's halves are (EC-570). A Bible asked for
 * is the study's passage's, not its translation's.
 */
function toNewStudyHalfParts(
    text: string,
    bodyOrder: string[],
    versions: { order: string[]; installed: string[] },
): StudyTokenPartType[] {
    const [first, ...translations] = listStudyHalves(text);
    if (first === undefined || translations.length === 0) {
        return [{ text, order: bodyOrder }];
    }
    return [
        { text: first.text, order: bodyOrder },
        ...translations.map((half) => {
            return {
                text: half.text,
                order: toOrderFrom(
                    findInstalledBibleKey(versions.installed, half.bibleKey),
                    versions.order,
                ),
            };
        }),
    ];
}

/**
 * New words with each verse they quote in a form of their own -- `> "…"
 * (John 3:16)` -- written as a Bible reads it, in the app's form
 * (2026-11-13, EC-575): from the Bible named beside it when installed,
 * else from its part's (the half it stands in, EC-570). Words that are the
 * verse's own stay as written, and so do words that do not read as it --
 * named when they were set out as a quote. Only such a quote costs a read.
 */
async function requoteStudyOwnQuotes(
    oldText: string,
    parts: StudyTokenPartType[],
    installed: string[],
) {
    const requoted: StudyOwnQuoteRequotedType[] = [];
    const unlike: StudyOwnQuoteUnlikeType[] = [];
    const { resolveBibleItem } = await import('./agentBibleHelpers');
    const texts: string[] = [];
    for (const part of parts) {
        const replacements: { start: number; end: number; lines: string[] }[] =
            [];
        for (const quote of listStudyOwnQuotes(oldText, part.text)) {
            const bibleItem =
                quote.ref.length > MAX_REFERENCE_LENGTH
                    ? null
                    : await resolveBibleItem(
                          quote.ref,
                          toOrderFrom(
                              findInstalledBibleKey(installed, quote.bibleName),
                              part.order,
                          ),
                      ).catch(() => {
                          return null;
                      });
            const read =
                bibleItem === null
                    ? null
                    : await readQuote(bibleItem, STUDY_MAX_QUOTED_VERSES).catch(
                          () => {
                              return null;
                          },
                      );
            // A reference no Bible reads may be no verse's at all, and a
            // range past a quote's length is not quoted whole.
            if (read === null || read.isCut) {
                continue;
            }
            const verdict = judgeStudyOwnQuote(
                quote,
                read.quote.verses
                    .map((verse) => {
                        return verse.text;
                    })
                    .join(' '),
            );
            if (verdict === 'other' && quote.isQuoteForm) {
                unlike.push({ ref: quote.ref, bibleKey: read.quote.bibleKey });
            }
            if (verdict !== 'like') {
                continue;
            }
            replacements.push({
                start: quote.start,
                end: quote.end,
                lines: [
                    ...(quote.label === '' ? [] : [quote.label, '']),
                    ...toStudyQuoteLines(read.quote),
                ],
            });
            requoted.push({
                title: read.quote.title,
                bibleKey: read.quote.bibleKey,
            });
        }
        texts.push(
            replacements.length === 0
                ? part.text
                : replaceStudyOwnQuotes(part.text, replacements),
        );
    }
    return {
        text: texts.join('\n'),
        said: describeStudyOwnQuotes(requoted, unlike),
    };
}

/**
 * Every verse token in the study read from the Bible and put in -- one
 * naming its own installed Bible (`[^(KJV) John 1:23]`) from that one, any
 * other from its part's `order`, each read once an order -- or the
 * sentence naming the ones no installed Bible could read.
 */
async function quoteStudyTokens(
    parts: StudyTokenPartType[],
    installed: string[],
) {
    const tokenSet = new Set(
        parts.flatMap((part) => {
            return listStudyVerseTokens(part.text);
        }),
    );
    if (tokenSet.size > STUDY_MAX_VERSE_TOKENS) {
        return toReason(
            `The study names ${tokenSet.size} verses as [^…]; keep it to ` +
                `${STUDY_MAX_VERSE_TOKENS} and write any other reference as ` +
                'plain words.',
        );
    }
    const quoteMapByOrder = new Map<string, Map<string, StudyQuoteType>>();
    const unread = new Set<string>();
    const warnings = new Set<string>();
    const { resolveBibleItem } = await import('./agentBibleHelpers');
    for (const part of parts) {
        const orderKey = part.order.join('\n');
        const quoteMap =
            quoteMapByOrder.get(orderKey) ?? new Map<string, StudyQuoteType>();
        quoteMapByOrder.set(orderKey, quoteMap);
        for (const token of listStudyVerseTokens(part.text)) {
            if (quoteMap.has(token)) {
                continue;
            }
            const { bibleKey, ref } = splitNoteVerseRef(token);
            const bibleItem =
                ref.length > MAX_REFERENCE_LENGTH
                    ? null
                    : await resolveBibleItem(
                          ref,
                          toOrderFrom(
                              findInstalledBibleKey(installed, bibleKey),
                              part.order,
                          ),
                      );
            const read =
                bibleItem === null
                    ? null
                    : await readQuote(bibleItem, STUDY_MAX_QUOTED_VERSES);
            if (read === null) {
                unread.add(`[^${token}]`);
                continue;
            }
            if (read.isCut) {
                warnings.add(
                    `[^${token}] is quoted to its first ` +
                        `${STUDY_MAX_QUOTED_VERSES} verses.`,
                );
            }
            quoteMap.set(token, read.quote);
        }
    }
    if (unread.size > 0) {
        return toReason(
            `No installed Bible could read ${[...unread].join(', ')}. Write ` +
                'each as [^Book Chapter:Verse] in English (e.g. [^Isaiah ' +
                '40:3]), or as plain words, and call draft again.',
        );
    }
    return {
        text: parts
            .map((part) => {
                return applyStudyVerseTokens(
                    part.text,
                    quoteMapByOrder.get(part.order.join('\n')) ?? new Map(),
                );
            })
            .join('\n'),
        warnings: [...warnings],
    };
}

/**
 * The content's lint as one refusal, or null when it can be written. A new
 * study draws a few diagrams; a whole file may hold its translation's too.
 */
function checkContent(content: string, isWholeFile = false) {
    const lint = lintStudyContent(
        content,
        isWholeFile ? STUDY_FILE_MAX_DIAGRAMS : STUDY_MAX_DIAGRAMS,
    );
    if (lint.reasons.length > 0) {
        return {
            refusal: toReason(
                `${lint.reasons.join(' ')} Fix ${
                    lint.reasons.length > 1 ? 'these' : 'it'
                } and call draft again.`,
            ),
            diagramCount: lint.diagrams.length,
        };
    }
    return { refusal: null, diagramCount: lint.diagrams.length };
}

/**
 * A new study's lint. Drafted with a translation after it (2026-11-14,
 * EC-609: the help window translates a new study not saved yet into a
 * study with its translation, or in its place), each half draws a new
 * study's few diagrams and the file a whole file's: a study of four,
 * translated, draws eight.
 */
function checkNewStudyContent(body: string) {
    const halves = listStudyHalves(body);
    if (halves.length < 2) {
        return checkContent(body);
    }
    const whole = checkContent(body, true);
    if (whole.refusal !== null) {
        return whole;
    }
    for (const half of halves) {
        const { refusal } = checkContent(half.text);
        if (refusal !== null) {
            return { refusal, diagramCount: whole.diagramCount };
        }
    }
    return whole;
}

type StudyPlaceFolderType = {
    label: string;
    dirPath: string;
    isBibleNotes: boolean;
};

/**
 * Where a study file may be changed: Resources → Default, and the Bible
 * Notes folder of the session in front (EC-509) when there is one.
 */
function listStudyPlaceFolders(): StudyPlaceFolderType[] {
    const bibleNotesDirPath = getActiveBibleNotesDirPath();
    return [
        {
            label: STUDY_FOLDER_NAME,
            dirPath: getStudyDirPath(),
            isBibleNotes: false,
        },
        ...(bibleNotesDirPath === null
            ? []
            : [
                  {
                      label: STUDY_BIBLE_NOTES_LABEL,
                      dirPath: bibleNotesDirPath,
                      isBibleNotes: true,
                  },
              ]),
    ];
}

function toSlashed(path: string) {
    return path.replaceAll('\\', '/');
}

/**
 * A study file named the way `list` names it (`Default/MAT.3.3-7 The
 * Voice.md`, `Bible Notes/MAT.3.3-7 The Voice.md`), by its whole path --
 * what an attached file carries -- or by its file name alone, for the one
 * of the two folders that has it (2026-11-14, EC-706): it had been read as
 * Default's, so a study kept in Bible Notes was never reached by its name,
 * and with a copy of that name in Default, the copy was changed instead.
 * Both have it, and it is refused naming both. Nothing outside those two
 * folders is changed here, and only a Markdown file straight inside one.
 */
async function resolveStudyFile(file: unknown) {
    const placeFolders = listStudyPlaceFolders();
    let text = toSlashed(toText(file));
    // A whole path inside one of them is taken as its name.
    for (const placeFolder of placeFolders) {
        const dirText = `${toSlashed(placeFolder.dirPath).replace(/\/+$/, '')}/`;
        if (text.toLowerCase().startsWith(dirText.toLowerCase())) {
            text = `${placeFolder.label}/${text.slice(dirText.length)}`;
            break;
        }
    }
    const parts = text.split('/').filter(Boolean);
    const name = parts.at(-1) ?? '';
    const label = parts.length > 1 ? parts.at(-2) : STUDY_FOLDER_NAME;
    let placeFolder = placeFolders.find((one) => {
        return one.label.toLowerCase() === label?.toLowerCase();
    });
    if (
        name === '' ||
        parts.length > 2 ||
        placeFolder === undefined ||
        !name.toLowerCase().endsWith(STUDY_FILE_EXTENSION) ||
        checkAgentFileName(name) !== null
    ) {
        return toReason(
            `Only a Markdown study file in Resources → ${STUDY_FOLDER_NAME} ` +
                `or in ${STUDY_BIBLE_NOTES_LABEL} can be changed here; name ` +
                'it as `list` gives it, e.g. ' +
                `"${STUDY_FOLDER_NAME}/MAT.3.3-7 The Voice.md".`,
        );
    }
    if (parts.length === 1) {
        const foundList: StudyPlaceFolderType[] = [];
        for (const one of placeFolders) {
            if (await fsCheckFileExist(pathJoin(one.dirPath, name))) {
                foundList.push(one);
            }
        }
        if (foundList.length > 1) {
            const names = foundList.map((one) => {
                return `"${one.label}/${name}"`;
            });
            return toReason(
                `${names.join(' and ')} are both called "${name}". Name the ` +
                    'one you mean with its folder.',
            );
        }
        placeFolder = foundList[0] ?? placeFolder;
    }
    const filePath = pathJoin(placeFolder.dirPath, name);
    if (!(await fsCheckFileExist(filePath))) {
        return toReason(
            `${placeFolder.label}/${name} is not there. List the chapter's ` +
                'files and name one as listed.',
        );
    }
    return {
        name,
        filePath,
        file: `${placeFolder.label}/${name}`,
        dirPath: placeFolder.dirPath,
        isBibleNotes: placeFolder.isBibleNotes,
    };
}

async function draftNew(request: AgentStudyRequestType) {
    const ref = toText(request.ref);
    if (ref === '' || ref.length > MAX_REFERENCE_LENGTH) {
        return toReason(
            'Give `ref`, the passage the study is about, e.g. "Matthew 3:3-7".',
        );
    }
    const titled = toStudyTitle(request.title);
    if ('reason' in titled) {
        return toReason(titled.reason);
    }
    const body = separateStudyLines(toStudyBody(toText(request.content)));
    if (body === '') {
        return toReason(
            'Write the study itself in `content`: Markdown sections with ' +
                '## headings, and diagrams in ```mermaid blocks.',
        );
    }
    if (body.length > STUDY_CONTENT_MAX_CHARS) {
        return toReason(
            `The study is ${body.length} characters; keep it under ` +
                `${STUDY_CONTENT_MAX_CHARS} and call draft again.`,
        );
    }
    const { refusal, diagramCount } = checkNewStudyContent(body);
    if (refusal !== null) {
        return refusal;
    }
    const bible = toText(request.bible);
    const versions = await getVersions(bible === '' ? null : bible);
    if ('isError' in versions) {
        return versions;
    }
    const { order } = versions;
    const { resolveBibleItem } = await import('./agentBibleHelpers');
    const bibleItem = await resolveBibleItem(ref, order);
    if (bibleItem === null) {
        return toReason(
            `No installed Bible could read "${ref}" as a passage. Give it ` +
                'as Book Chapter:Verse, e.g. "Matthew 3:3-7" or "John 3".',
        );
    }
    const { getVersesCount } =
        await import('./bible-helpers/bibleLogicHelpers2');
    const { target } = bibleItem;
    const verseCount = await getVersesCount(
        bibleItem.bibleKey,
        target.bookKey,
        target.chapter,
    ).catch(() => {
        return null;
    });
    const named = toStudyFileName(
        target.bookKey,
        target.chapter,
        toStudySpanText(target, verseCount ?? null),
        titled.title,
    );
    if ('reason' in named) {
        return toReason(named.reason);
    }
    const passage = await readQuote(bibleItem, STUDY_PASSAGE_MAX_VERSES);
    if (passage === null) {
        return toReason(`The Bible ${bibleItem.bibleKey} has no ${ref}.`);
    }
    // A passage the study quotes by itself under a Bible's name is that
    // Bible's words (EC-565), and so is a verse it quotes in a form of its
    // own (EC-575).
    const requote = await requoteNewStudyPassages('', body, versions.installed);
    const bodyOrder = toOrderFrom(bibleItem.bibleKey, order);
    const own =
        listStudyOwnQuotes('', requote.text).length === 0
            ? { text: requote.text, said: '' }
            : await requoteStudyOwnQuotes(
                  '',
                  toNewStudyHalfParts(requote.text, bodyOrder, versions),
                  versions.installed,
              );
    const tokens = await quoteStudyTokens(
        toNewStudyHalfParts(own.text, bodyOrder, versions),
        versions.installed,
    );
    if ('isError' in tokens) {
        return tokens;
    }
    const content = composeStudyFile({
        title: titled.title,
        passage: passage.quote,
        isPassageCut: passage.isCut,
        body: tokens.text,
        footnote: await getFootnote(),
    });
    if (content.length > STUDY_FILE_MAX_CHARS) {
        return toReason(
            `With the passage quoted the file is ${content.length} ` +
                `characters; shorten the study by ` +
                `${content.length - STUDY_FILE_MAX_CHARS} and call draft again.`,
        );
    }
    const name = pathBasename(
        await genFreeFilePath(getStudyDirPath(), named.name),
    );
    const warnings = [
        ...tokens.warnings,
        describeStudyRequotedPassages(requote.requoted),
        own.said,
    ].filter((warning) => {
        return warning !== '';
    });
    if (passage.isCut) {
        warnings.push(
            `The passage is quoted to its first ${STUDY_PASSAGE_MAX_VERSES} ` +
                'verses.',
        );
    }
    return {
        drafted: true,
        isChange: false,
        name,
        ...(name !== named.name ? { nameTaken: named.name } : {}),
        passage: passage.quote.title,
        bible: bibleItem.bibleKey,
        diagramCount,
        warnings,
        content,
    };
}

async function draftChange(request: AgentStudyRequestType) {
    const resolved = await resolveStudyFile(request.file);
    if ('isError' in resolved) {
        return resolved;
    }
    const oldText = await fsReadFile(resolved.filePath);
    if (oldText.length > STUDY_FILE_MAX_CHARS) {
        return toReason(
            `${resolved.name} is longer than a change here can hold whole. ` +
                'Make a new study file instead.',
        );
    }
    let text = toText(request.content);
    const section = toText(request.section);
    const append = separateStudyLines(toText(request.append));
    // Words written anew where they stand (EC-537): nothing else is moved,
    // so no line of it is kept apart either. An empty list is no replace,
    // as an empty `section` is no section: a model filling every field
    // sends one beside a whole text, and the help window reads it so.
    let replaced: StudyReplacedType[] | null = null;
    // Pairs the study's own name check put right (EC-541): a word a vowel
    // sign apart from its verse, the difference a model cannot see.
    let repaired: StudyReplaceRepairType[] = [];
    let keptText = '';
    const isReplace = Array.isArray(request.replace)
        ? request.replace.length > 0
        : request.replace !== undefined && request.replace !== null;
    // A part taken out whole (EC-543), named by its heading alone.
    if (request.remove === true) {
        if (text.trim() !== '' || append.trim() !== '' || isReplace) {
            return toReason(STUDY_REMOVE_ALONE_REASON);
        }
        const edited = applyStudyRemove(oldText, section);
        if ('reason' in edited) {
            return toReason(edited.reason);
        }
        text = edited.text;
    } else if (isReplace) {
        if (text.trim() !== '' || append.trim() !== '') {
            return toReason(STUDY_REPLACE_ALONE_REASON);
        }
        const edited = applyStudyReplaceChecked(
            oldText,
            request.replace,
            section,
        );
        if ('reason' in edited) {
            return toReason(edited.reason);
        }
        text = edited.text;
        replaced = edited.replaced;
        repaired = edited.repaired;
    } else if (section !== '' || append !== '') {
        const edited = applyStudyEdit(oldText, {
            section,
            content: separateStudyLines(text),
            append,
        });
        if ('reason' in edited) {
            return toReason(edited.reason);
        }
        text = edited.text;
        // The parts kept under the part's new words (EC-544), and the
        // passage the app quoted there (EC-548).
        keptText = describeStudyEditKept(edited);
    } else {
        // The whole new text: only what the model wrote anew is kept apart.
        text = separateStudyLines(text, oldText);
    }
    // A passage the app quoted, copied back with words changed, is put
    // back as quoted (EC-549): it is the Bible's words. A part taken out
    // writes none, and `replace` never writes inside one.
    if (request.remove !== true && !isReplace) {
        const restored = restoreStudyPassages(oldText, text);
        text = restored.text;
        keptText = [keptText, describeStudyRestoredPassages(restored.restored)]
            .filter((sentence) => {
                return sentence !== '';
            })
            .join(' ');
    }
    if (text === '') {
        return toReason(
            'Give the new words: `section` (a heading) with its new ' +
                '`content`, `append` for words added at the end, or the ' +
                'WHOLE new text in `content`. To fix some words where they ' +
                'stand, `replace`: each `from` as the file writes it, and ' +
                'its `to`.',
        );
    }
    const { refusal, diagramCount } = checkContent(text, true);
    if (refusal !== null) {
        return refusal;
    }
    const bible = toText(request.bible);
    const versions = await getVersions(bible === '' ? null : bible);
    if ('isError' in versions) {
        return versions;
    }
    // A passage new to the file, quoted under a Bible's name, is that
    // Bible's words (EC-565). A part taken out writes none, and `replace`
    // never writes a quote.
    if (request.remove !== true && !isReplace) {
        const requote = await requoteNewStudyPassages(
            oldText,
            text,
            versions.installed,
        );
        text = requote.text;
        keptText = [keptText, describeStudyRequotedPassages(requote.requoted)]
            .filter((sentence) => {
                return sentence !== '';
            })
            .join(' ');
        // A verse quoted in a form of the model's own is written as the
        // Bible of its half reads it (EC-575).
        if (listStudyOwnQuotes(oldText, text).length > 0) {
            const own = await requoteStudyOwnQuotes(
                oldText,
                toStudyHalfParts(text, versions, bible !== ''),
                versions.installed,
            );
            text = own.text;
            keptText = [keptText, own.said]
                .filter((sentence) => {
                    return sentence !== '';
                })
                .join(' ');
        }
    }
    // A verse added to a half is quoted from that half's Bible (EC-570).
    const tokens = await quoteStudyTokens(
        toStudyTokenParts(text, versions, bible !== ''),
        versions.installed,
    );
    if ('isError' in tokens) {
        return tokens;
    }
    const content = `${tokens.text.trimEnd()}\n`;
    if (content.length > STUDY_FILE_MAX_CHARS) {
        return toReason(
            `The changed file is ${content.length} characters; keep it ` +
                `under ${STUDY_FILE_MAX_CHARS}.`,
        );
    }
    if (content.trim() === oldText.trim()) {
        return toReason(
            'That is the file as it already is: nothing would change.',
        );
    }
    return {
        drafted: true,
        isChange: true,
        name: resolved.name,
        file: resolved.file,
        hash: toStudyTextHash(oldText),
        change:
            replaced === null
                ? [
                      describeStudyChange(
                          summarizeStudyChange(oldText, content),
                      ),
                      keptText,
                  ]
                      .filter((sentence) => {
                          return sentence !== '';
                      })
                      .join(' ')
                : [
                      describeStudyReplaceRepair(repaired),
                      describeStudyReplace(replaced),
                  ]
                      .filter((sentence) => {
                          return sentence !== '';
                      })
                      .join(' '),
        // What each pair wrote, what was put right of what was asked, and
        // the file's own diagrams it changed -- the only ones the help
        // window parses (EC-503).
        ...(replaced === null
            ? {}
            : {
                  replaced,
                  ...(repaired.length === 0 ? {} : { repaired }),
                  diagramsChanged: listChangedStudyDiagrams(oldText, content),
              }),
        diagramCount,
        warnings: tokens.warnings,
        content,
    };
}

/**
 * Default on the panel's list, unless a listed folder already shows it
 * (`<data folder>/resources` itself, within the scan's depth). Said in the
 * answer when it was added, since the person never asked for a folder.
 */
function putStudyFolderOnList(dirPath: string) {
    const unlisted = filterUnlistedResourcesFolders(
        [dirPath],
        getResourcesFolderList(),
        MAX_SCAN_DEPTH,
    );
    return (
        unlisted.length > 0 && addResourcesFoldersToList(unlisted).length > 0
    );
}

function announceSaved(dirPath: string) {
    invalidateResourcesScanCache(dirPath);
    announceResourcesChanged();
}

function toChangeFailure(error: unknown, what: string) {
    if (error instanceof NoBackupError) {
        return toReason(error.message);
    }
    handleError(error);
    return toReason(
        `${what} could not be finished: ` +
            `${error instanceof Error ? error.message : String(error)} ` +
            'Anything it did get to do can be put back with owa_undo.',
    );
}

/** Where `to` says a new study goes; null for a place there is not. */
function toStudyPlace(to: unknown): StudyPlaceType | null {
    const text = toText(to);
    if (text === '') {
        return 'resources';
    }
    return (
        STUDY_PLACE_LIST.find((place) => {
            return place === text;
        }) ?? null
    );
}

async function saveStudy(request: AgentStudyRequestType) {
    const content = typeof request.content === 'string' ? request.content : '';
    if (content.trim() === '') {
        return toReason('Give the drafted file in `content`.');
    }
    if (content.length > STUDY_FILE_MAX_CHARS) {
        return toReason(
            `The file is longer than ${STUDY_FILE_MAX_CHARS} characters.`,
        );
    }
    const { refusal } = checkContent(content, true);
    if (refusal !== null) {
        return refusal;
    }
    if (toText(request.file) !== '') {
        const resolved = await resolveStudyFile(request.file);
        if ('isError' in resolved) {
            return resolved;
        }
        const oldText = await fsReadFile(resolved.filePath);
        if (toStudyTextHash(oldText) !== toText(request.hash)) {
            return toReason(
                `${resolved.name} has changed since this was drafted, so it ` +
                    'is not written over. Read it again and draft the ' +
                    'change again.',
            );
        }
        try {
            const { meta } = await runWithAgentBackup(
                `Changed the study file “${resolved.name}”`,
                [
                    {
                        type: 'file',
                        filePath: resolved.filePath,
                        text: oldText,
                        ...(resolved.isBibleNotes
                            ? {}
                            : { isResource: true as const }),
                    },
                ],
                async () => {
                    await fsWriteFile(resolved.filePath, content);
                },
            );
            if (!resolved.isBibleNotes) {
                announceSaved(resolved.dirPath);
            }
            return {
                changed: resolved.name,
                file: resolved.file,
                filePath: resolved.filePath,
                ...genUndoField(meta),
            };
        } catch (error) {
            return toChangeFailure(error, `Changing “${resolved.name}”`);
        }
    }
    const asked = toText(request.name);
    if (
        readStudyFileName(asked) === null ||
        checkAgentFileName(asked) !== null
    ) {
        return toReason(
            'Give the `name` the draft answered, e.g. ' +
                '"MAT.3.3-7 The Voice.md".',
        );
    }
    const place = toStudyPlace(request.to);
    if (place === null) {
        return toReason(
            'Give `to` "resources" (Resources → Default) or "bible-notes" ' +
                '(the Bible Notes list), or leave it out for Resources.',
        );
    }
    const isBibleNotes = place === 'bible-notes';
    const dirPath = isBibleNotes
        ? getActiveBibleNotesDirPath()
        : getStudyDirPath();
    if (dirPath === null) {
        return toReason(
            'No Bible Notes folder is set up yet. The person chooses one in ' +
                'Settings under Path Settings.',
        );
    }
    try {
        if (!(await fsCheckDirExist(dirPath))) {
            await fsCreateDir(dirPath);
        }
        const filePath = await genFreeFilePath(dirPath, asked);
        const name = pathBasename(filePath);
        const { meta } = await runWithAgentBackup(
            `Made the study file “${name}”`,
            [
                {
                    type: 'file',
                    filePath,
                    text: null,
                    // Resources is told by hand; the Bible Notes list
                    // watches its folder.
                    ...(isBibleNotes ? {} : { isResource: true as const }),
                },
            ],
            async () => {
                await fsWriteFile(filePath, content);
                if (!(await fsCheckFileExist(filePath))) {
                    throw new Error('The file is not there after writing it.');
                }
            },
        );
        const isFolderAdded = !isBibleNotes && putStudyFolderOnList(dirPath);
        if (!isBibleNotes) {
            announceSaved(dirPath);
        }
        return {
            created: name,
            file: `${isBibleNotes ? STUDY_BIBLE_NOTES_LABEL : STUDY_FOLDER_NAME}/${name}`,
            filePath,
            ...(isBibleNotes ? { place } : {}),
            ...(name !== asked ? { nameTaken: asked } : {}),
            ...(isFolderAdded ? { folderAdded: STUDY_FOLDER_NAME } : {}),
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, `Making “${asked}”`);
    }
}

/** Every preview but the newest few, let go of. */
async function sweepPreviews(dirPath: string) {
    const dirents = await fsListDirents(dirPath).catch(() => {
        return [];
    });
    const stampList: { filePath: string; modifiedAt: number }[] = [];
    for (const dirent of dirents) {
        if (!dirent.isFile) {
            continue;
        }
        const filePath = pathJoin(dirPath, dirent.name);
        const stamp = await fsGetFileStamp(filePath);
        stampList.push({ filePath, modifiedAt: stamp?.modifiedAt ?? 0 });
    }
    stampList.sort((one, other) => {
        return other.modifiedAt - one.modifiedAt;
    });
    for (const { filePath } of stampList.slice(PREVIEW_KEEP_COUNT)) {
        await fsDeleteFile(filePath).catch(() => {});
    }
}

async function previewStudy(request: AgentStudyRequestType) {
    let filePath: string;
    let name: string;
    if (toText(request.file) !== '' && typeof request.content !== 'string') {
        const resolved = await resolveStudyFile(request.file);
        if ('isError' in resolved) {
            return resolved;
        }
        ({ filePath, name } = resolved);
    } else {
        const content =
            typeof request.content === 'string' ? request.content : '';
        if (content.trim() === '' || content.length > STUDY_FILE_MAX_CHARS) {
            return toReason('Give the drafted file in `content`.');
        }
        const asked = toText(request.name);
        name =
            asked !== '' && checkAgentFileName(asked) === null
                ? asked
                : `study${STUDY_FILE_EXTENSION}`;
        const dirPath = pathJoin(getTempPath(), PREVIEW_DIR_NAME);
        if (!(await fsCheckDirExist(dirPath))) {
            await fsCreateDir(dirPath);
        }
        filePath = pathJoin(dirPath, name);
        await fsWriteFile(filePath, content);
        await sweepPreviews(dirPath);
    }
    const { openMarkdownPreview } =
        await import('../resources/resourcePreviewOpenHelpers');
    openMarkdownPreview(filePath);
    return {
        previewed: name,
        note: 'The Markdown Preview window is open with it. Nothing is saved.',
    };
}

/**
 * A passage the file quotes, quoted again from `bibleKey`: read under the
 * Bible that wrote it, so the verses are the same ones whatever language its
 * reference is written in. Null when either Bible cannot read it -- the
 * passage is then left as it is, never put into words by a model.
 */
async function requotePassage(
    title: string,
    sourceKey: string,
    bibleKey: string,
    maxVerses: number,
) {
    const [{ resolveBibleItem }, { default: BibleItem }] = await Promise.all([
        import('./agentBibleHelpers'),
        import('../bible-list/BibleItem'),
    ]);
    const source = await resolveBibleItem(title, [sourceKey]).catch(() => {
        return null;
    });
    if (source === null) {
        return null;
    }
    const { bookKey, chapter, verseStart, verseEnd, chapterEnd } =
        source.target;
    // The verse key every Bible reads (`JHN 3:1-21`), no book name in it.
    const verseKey =
        chapterEnd !== undefined && chapterEnd > chapter
            ? `${bookKey} ${chapter}:${verseStart}-${chapterEnd}:${verseEnd}`
            : verseEnd > verseStart
              ? `${bookKey} ${chapter}:${verseStart}-${verseEnd}`
              : `${bookKey} ${chapter}:${verseStart}`;
    const target =
        (await BibleItem.fromVerseKey(bibleKey, verseKey).catch(() => {
            return null;
        })) ??
        (await resolveBibleItem(verseKey, [bibleKey]).catch(() => {
            return null;
        }));
    if (target === null) {
        return null;
    }
    const read = await readQuote(target, maxVerses);
    if (read === null) {
        return null;
    }
    const lines = toStudyQuoteLines(read.quote);
    if (read.isCut) {
        lines.push('>', '> …');
    }
    return lines.join('\n');
}

/**
 * The passage a study file's NAME says it is about, as a reference any
 * Bible reads (`JHN 3:1-21`), or null for a name that is not a study's.
 */
function toNamedPassageRef(name: string) {
    const named = readStudyFileName(name);
    if (named === null) {
        return null;
    }
    const span = named.span.replace(/-(\d+)\.(\d+)$/, '-$1:$2');
    return span === ''
        ? `${named.bookKey} ${named.chapter}`
        : `${named.bookKey} ${named.chapter}:${span}`;
}

const STUDY_TRANSLATE_PARTS_NOTE =
    'Translate each "text" part (keep its Markdown marks and line breaks) ' +
    'and the labels of each "diagram" (keep its syntax); put a passage\'s ' +
    '"quoted" in its place, or keep its "text" when quoted is null; keep ' +
    'each "keep" part. Join the parts with a line break, then ';

/** How a new study not saved yet, planned from its words, is drafted. */
const STUDY_TRANSLATE_NEW_NOTE =
    'draft it as a new study, since these words are no saved file: `ref`, ' +
    'the translated `#` title as `title` and the words under its passage ' +
    "as `content` -- to keep the study with it, the study's words first, " +
    'then a `---` rule and the translation. "translations" are the ' +
    'translations already added after the study: never translate them ' +
    "again; keep them after the study's words, one already in the " +
    'language translated into giving its place to the new one.';

/**
 * What `translate` plans from: a study file, or -- with no `file` -- a new
 * study not saved yet, its words in `content` as its draft wrote them and
 * the name it was drafted under in `name` (2026-11-14, EC-609). The help
 * window holds a new study's words under its card until Create is
 * pressed, and a study was planned only from a saved file: asked to
 * translate the study just drafted, the window could only say to press
 * Create and ask again.
 */
async function readStudyToTranslate(request: AgentStudyRequestType) {
    const content = typeof request.content === 'string' ? request.content : '';
    if (toText(request.file) === '' && content.trim() !== '') {
        const name = toText(request.name);
        if (
            !name.toLowerCase().endsWith(STUDY_FILE_EXTENSION) ||
            checkAgentFileName(name) !== null
        ) {
            return toReason(
                'Name the new study its words are in `name`, as its draft ' +
                    'named it (e.g. "MAT.3.3-7 The Voice.md"), or a saved ' +
                    'study in `file`.',
            );
        }
        return { file: '', name, text: content };
    }
    const resolved = await resolveStudyFile(request.file);
    if ('isError' in resolved) {
        return resolved;
    }
    return {
        file: resolved.file,
        name: resolved.name,
        text: await fsReadFile(resolved.filePath),
    };
}

/**
 * `translate`: the file in its parts (`splitStudyForTranslation`) -- its
 * words to translate, its diagrams to translate the labels of, the passages
 * it quotes quoted again from `bible` (a Bible in the new language), what
 * is kept as it is -- with its hash, its title and the app's last lines
 * apart, and the translations already added after it apart too
 * (`splitStudyTranslations`): only the study as it was written is
 * translated again. Writes nothing: whoever translates drafts the result.
 */
async function planTranslation(request: AgentStudyRequestType) {
    const resolved = await readStudyToTranslate(request);
    if ('isError' in resolved) {
        return resolved;
    }
    const oldText = resolved.text;
    if (oldText.length > STUDY_FILE_MAX_CHARS) {
        return toReason(
            `${resolved.name} is longer than ${STUDY_FILE_MAX_CHARS} ` +
                'characters: it cannot be translated here.',
        );
    }
    const bible = toText(request.bible);
    if (bible !== '') {
        const order = await getVersionOrder(bible);
        if (!Array.isArray(order)) {
            return order;
        }
        if (order[0]?.toLowerCase() !== bible.toLowerCase()) {
            return toReason(`No installed Bible is called "${bible}".`);
        }
    }
    const { body, footer } = splitStudyFooter(oldText);
    const { original, translations } = splitStudyTranslations(body);
    const parts = splitStudyForTranslation(original);
    let quotedCount = 0;
    const planned = [];
    for (const [index, part] of parts.entries()) {
        if (part.kind !== 'passage') {
            planned.push({ kind: part.kind, text: part.text });
            continue;
        }
        const quoted =
            bible === '' ||
            part.title === undefined ||
            part.bibleKey === undefined
                ? null
                : await requotePassage(
                      part.title,
                      part.bibleKey,
                      bible,
                      // The file's own passage, right under its title, is
                      // quoted as far as a new study quotes it.
                      index <= 1
                          ? STUDY_PASSAGE_MAX_VERSES
                          : STUDY_MAX_QUOTED_VERSES,
                  );
        if (quoted !== null) {
            quotedCount += 1;
        }
        planned.push({ kind: part.kind, text: part.text, quoted });
    }
    return {
        translating: true,
        file: resolved.file,
        name: resolved.name,
        hash: toStudyTextHash(oldText),
        title: readStudyTitleLine(body),
        ref: toNamedPassageRef(resolved.name),
        bible: bible === '' ? null : bible,
        passageCount: planned.filter((part) => {
            return part.kind === 'passage';
        }).length,
        quotedCount,
        parts: planned,
        translations,
        footer,
        note:
            STUDY_TRANSLATE_PARTS_NOTE +
            (resolved.file === ''
                ? STUDY_TRANSLATE_NEW_NOTE
                : 'draft with `file` and `append` (the translation added at ' +
                  'the end) or `content` (the whole new text with the footer ' +
                  'last). "translations" are the translations already added ' +
                  'after the study: never translate them again; with ' +
                  '`content`, keep them after the new text, before the ' +
                  'footer. One already in the language translated into is ' +
                  'replaced: draft `content` with the new translation in its ' +
                  'place, never a second one.'),
    };
}

export async function handleAgentStudyRequest(request: AgentStudyRequestType) {
    if (request.action === 'translate') {
        return await planTranslation(request);
    }
    if (request.action === 'draft') {
        return toText(request.file) === ''
            ? await draftNew(request)
            : await draftChange(request);
    }
    if (request.action === 'save') {
        return await saveStudy(request);
    }
    if (request.action === 'preview') {
        return await previewStudy(request);
    }
    return toReason('Give action "draft", "translate", "save" or "preview".');
}
