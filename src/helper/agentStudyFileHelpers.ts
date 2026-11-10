/**
 * The app side of `owa_resource_file`'s `draft`, `save` and `preview`
 * (2026-11-09, EC-464): a study file for a passage, drafted by the help
 * window's assistant and SAVED by the person's press into
 * `<data folder>/resources/Default`. Loaded from
 * `handleAgentResourcesRequest` only when one of the three is asked for.
 *
 * - `draft` writes nothing. It reads the passage off the reference (the
 *   book, chapter and span in the name are the app's, never the model's),
 *   quotes it from the installed Bible, puts in the verse tokens, checks the
 *   diagrams and answers the whole file with the name it would take -- the
 *   next free one when that is taken (`MAT.3.3-7 The Voice (1).md`). With
 *   `file`, a CHANGE to a study file already in Default: the new text, what
 *   it changes and the `hash` of the file it was drafted from.
 * - `save` is the press. It makes Default when it is missing and puts it on
 *   the panel's list unless a listed folder already shows it, never writes
 *   over a file (a name taken since the draft takes the next free one), and
 *   writes a change only while the file still reads as it did at the draft.
 *   Each write takes a backup first, so **Undo this change** puts it back --
 *   a new file goes to the trash.
 * - `preview` writes the draft into a folder of its own under the system's
 *   temporary folder (the last three kept) and opens it in the Markdown
 *   Preview window, diagrams drawn.
 *
 * `save` and `preview` are refused to the help window's MODEL
 * (`runMcpToolCall`): the model drafts, the person presses.
 */
import {
    STUDY_CONTENT_MAX_CHARS,
    STUDY_FILE_EXTENSION,
    STUDY_FILE_MAX_CHARS,
    STUDY_FOLDER_NAME,
    STUDY_MAX_QUOTED_VERSES,
    STUDY_MAX_VERSE_TOKENS,
    STUDY_PASSAGE_MAX_VERSES,
    type StudyQuoteType,
    applyStudyVerseTokens,
    composeStudyFile,
    describeStudyChange,
    lintStudyContent,
    listStudyVerseTokens,
    readStudyFileName,
    summarizeStudyChange,
    toStudyBody,
    toStudyFileName,
    toStudySpanText,
    toStudyTextHash,
    toStudyTitle,
} from './agentStudyFileRules';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import type BibleItem from '../bible-list/BibleItem';
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
async function getVersionOrder(bible: string | null) {
    const { resolveVersionOrder } = await import('./agentBibleHelpers');
    const resolved = await resolveVersionOrder(bible);
    if (!('order' in resolved)) {
        return toReason(resolved.reason);
    }
    return resolved.order;
}

/**
 * Every verse token in the study read from the Bible -- one naming its own
 * Bible (`[^(KJV) John 1:23]`) from that one, any other from the passage's
 * first -- or the sentence naming the ones no installed Bible could read.
 */
async function readTokenQuotes(body: string, order: string[]) {
    const tokens = listStudyVerseTokens(body);
    if (tokens.length > STUDY_MAX_VERSE_TOKENS) {
        return toReason(
            `The study names ${tokens.length} verses as [^…]; keep it to ` +
                `${STUDY_MAX_VERSE_TOKENS} and write any other reference as ` +
                'plain words.',
        );
    }
    const { resolveBibleItem } = await import('./agentBibleHelpers');
    const quoteMap = new Map<string, StudyQuoteType>();
    const unread: string[] = [];
    const warnings: string[] = [];
    for (const token of tokens) {
        const { bibleKey, ref } = splitNoteVerseRef(token);
        const bibleItem =
            ref.length > MAX_REFERENCE_LENGTH
                ? null
                : await resolveBibleItem(
                      ref,
                      bibleKey === null
                          ? order
                          : [
                                ...order.filter((key) => {
                                    return (
                                        key.toLowerCase() ===
                                        bibleKey.toLowerCase()
                                    );
                                }),
                                ...order,
                            ],
                  );
        const read =
            bibleItem === null
                ? null
                : await readQuote(bibleItem, STUDY_MAX_QUOTED_VERSES);
        if (read === null) {
            unread.push(`[^${token}]`);
            continue;
        }
        if (read.isCut) {
            warnings.push(
                `[^${token}] is quoted to its first ` +
                    `${STUDY_MAX_QUOTED_VERSES} verses.`,
            );
        }
        quoteMap.set(token, read.quote);
    }
    if (unread.length > 0) {
        return toReason(
            `No installed Bible could read ${unread.join(', ')}. Write each ` +
                'as [^Book Chapter:Verse] in English (e.g. [^Isaiah 40:3]), ' +
                'or as plain words, and call draft again.',
        );
    }
    return { quoteMap, warnings };
}

/** The content's lint as one refusal, or null when it can be written. */
function checkContent(content: string) {
    const lint = lintStudyContent(content);
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
 * A file in the Default folder named the way `list` names it
 * (`Default/MAT.3.3-7 The Voice.md`) or by its file name alone. Nothing
 * outside that folder is changed here, and only a Markdown file.
 */
async function resolveStudyFile(file: unknown) {
    const text = toText(file).replaceAll('\\', '/');
    const parts = text.split('/').filter(Boolean);
    const name = parts.at(-1) ?? '';
    const folder = parts.length > 1 ? parts.at(-2) : STUDY_FOLDER_NAME;
    if (
        name === '' ||
        parts.length > 2 ||
        folder?.toLowerCase() !== STUDY_FOLDER_NAME.toLowerCase() ||
        !name.toLowerCase().endsWith(STUDY_FILE_EXTENSION) ||
        checkAgentFileName(name) !== null
    ) {
        return toReason(
            `Only a Markdown study file in Resources → ${STUDY_FOLDER_NAME} ` +
                `can be changed here; name it as \`list\` gives it, e.g. ` +
                `"${STUDY_FOLDER_NAME}/MAT.3.3-7 The Voice.md".`,
        );
    }
    const filePath = pathJoin(getStudyDirPath(), name);
    if (!(await fsCheckFileExist(filePath))) {
        return toReason(
            `${STUDY_FOLDER_NAME}/${name} is not there. List the chapter's ` +
                'files and name one as listed.',
        );
    }
    return { name, filePath };
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
    const body = toStudyBody(toText(request.content));
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
    const { refusal, diagramCount } = checkContent(body);
    if (refusal !== null) {
        return refusal;
    }
    const bible = toText(request.bible);
    const order = await getVersionOrder(bible === '' ? null : bible);
    if (!Array.isArray(order)) {
        return order;
    }
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
    const tokens = await readTokenQuotes(body, [
        bibleItem.bibleKey,
        ...order.filter((key) => {
            return key !== bibleItem.bibleKey;
        }),
    ]);
    if ('isError' in tokens) {
        return tokens;
    }
    const content = composeStudyFile({
        title: titled.title,
        passage: passage.quote,
        isPassageCut: passage.isCut,
        body: applyStudyVerseTokens(body, tokens.quoteMap),
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
    const warnings = [...tokens.warnings];
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
    const text = toText(request.content);
    if (text === '') {
        return toReason(
            'Give the WHOLE new text of the file in `content`, as `read` ' +
                'gave it with the change made.',
        );
    }
    const { refusal, diagramCount } = checkContent(text);
    if (refusal !== null) {
        return refusal;
    }
    const bible = toText(request.bible);
    const order = await getVersionOrder(bible === '' ? null : bible);
    if (!Array.isArray(order)) {
        return order;
    }
    const tokens = await readTokenQuotes(text, order);
    if ('isError' in tokens) {
        return tokens;
    }
    const content = `${applyStudyVerseTokens(text, tokens.quoteMap).trimEnd()}\n`;
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
        file: `${STUDY_FOLDER_NAME}/${resolved.name}`,
        hash: toStudyTextHash(oldText),
        change: describeStudyChange(summarizeStudyChange(oldText, content)),
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
    const { refusal } = checkContent(content);
    if (refusal !== null) {
        return refusal;
    }
    const dirPath = getStudyDirPath();
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
                        isResource: true,
                    },
                ],
                async () => {
                    await fsWriteFile(resolved.filePath, content);
                },
            );
            announceSaved(dirPath);
            return {
                changed: resolved.name,
                file: `${STUDY_FOLDER_NAME}/${resolved.name}`,
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
    try {
        if (!(await fsCheckDirExist(dirPath))) {
            await fsCreateDir(dirPath);
        }
        const filePath = await genFreeFilePath(dirPath, asked);
        const name = pathBasename(filePath);
        const { meta } = await runWithAgentBackup(
            `Made the study file “${name}”`,
            [{ type: 'file', filePath, text: null, isResource: true }],
            async () => {
                await fsWriteFile(filePath, content);
                if (!(await fsCheckFileExist(filePath))) {
                    throw new Error('The file is not there after writing it.');
                }
            },
        );
        const isFolderAdded = putStudyFolderOnList(dirPath);
        announceSaved(dirPath);
        return {
            created: name,
            file: `${STUDY_FOLDER_NAME}/${name}`,
            filePath,
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

export async function handleAgentStudyRequest(request: AgentStudyRequestType) {
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
    return toReason('Give action "draft", "save" or "preview".');
}
