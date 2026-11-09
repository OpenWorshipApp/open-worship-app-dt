/**
 * The app side of `owa_note_edit`: ONE Bible note read as numbered blocks and
 * changed part by part, its formatting kept (2026-11-07, the user, with a
 * note row's menu open: _add `Open in Chatbot` for bible-note … goal: chatbot
 * can help modify and answer everything on bible-note_). The rules are pure
 * in `agentNoteBlockHelpers.ts`; this file reads, resolves verses and writes.
 *
 * ## Where a change goes
 *
 * Into the note's EDITING HISTORY, never the file -- the way the note window
 * writes its own typing, and the way a song or a slide document changed by
 * the assistant is left: unsaved, the window's **Save** keeps it, **Undo
 * Saved Change** walks it back. The note is read from that history's head,
 * so what somebody typed and has not saved is what is changed. An open note
 * window is told (`notifyNoteHeadChanged`) and shows the change at once --
 * the file did not change, so its own watch would never hear it.
 *
 * A TITLE is the list's (the row shows the saved file, and Edit Title saves
 * at once), so a new title is saved to the file, as Edit Title does.
 *
 * ## The undo
 *
 * Every change is backed up first (`runWithAgentBackup`): the head as it was
 * -- or, for a note no window ever wrote a history for, the file's state
 * taken AS the head, so an undo puts that back rather than leaving the
 * change -- and the file too when a title changes. No backup, no change.
 *
 * ## The toolbar
 *
 * Everything the note editor's toolbar does to a note is a change here
 * (`agentNoteStyleHelpers.ts`, `agentNoteInsertHelpers.ts`): the font box
 * lists the editor's six fonts and each installed language's own face, which
 * a read hands over as `fonts`; a NEW person or place mention (`[@Moses]`,
 * `[#Jerusalem]`) is looked up in the names lookup -- only for a name a
 * change adds, the data given back at once -- and written as the words when
 * the lookup does not have it; and `undo` / `redo` step the note's editing
 * history, the toolbar's Undo and Redo for what has been kept there, refused
 * when the step would be another note's of the same file. Two controls keep
 * nothing in the note: Link block text and the ¶ view are the editor's own
 * keys of the app's home storage, which `edit` (`linkTo`) and `view`
 * write -- backed up as `home-setting` restores, the open note window told
 * to mount its editor again. The Default Example's nodes are read from
 * `agentNoteDefaultExample.json` only when one is asked for.
 *
 * ## Which notes
 *
 * A `.own` file in a Bible Notes folder (any folder session) and a note in it
 * that is not a verse's marks. The help window resolves the note the
 * conversation is about to its path and id; a path from anywhere else is
 * refused.
 *
 * ## In the note's OWN window, through its editor
 *
 * (2026-11-08, the user: _chatbot should work directly on UI, e.g. bible-note
 * chatbot should depend on bible-note UI controller_; the goal _chatbot
 * modifying files should work on the fresh latest user seen content_.) This
 * worker runs in the note's window only (`owa_note_edit` aims there, opening
 * it first) and refuses anywhere else, and refuses a window showing another
 * note -- the same file name in another Bible Notes folder included -- by the
 * WHOLE path. The note is read off the editor as it is that moment
 * (`noteWindowControllerHelpers.ts`), and a change goes INTO the editor: the
 * window's own save writes it into the editing history, the one writer the
 * note has, and the editor's Undo takes it back. Before it ever reads, what
 * was typed and not yet kept is kept, so the backup is of what the person
 * saw.
 */
import { dirSourceSettingNames } from './constants';
import { handleError } from './errorHelpers';
import {
    fsCheckFileExist,
    fsReadFile,
    pathBasename,
    pathResolve,
    toPathCompareKey,
} from '../server/fileHelpers';
import {
    NOTE_WINDOW_MISSING_CODE,
    NOTE_WINDOW_OTHER_CODE,
    getNoteWindowController,
} from '../bible-list/note/noteWindowControllerHelpers';
import { findSessionIdByFilePath } from '../media-sessions/folderSessionPathHelpers';
import { checkIsBibleNoteFileName } from '../bible-list/note/bibleNotePreviewHelpers';
import { notifyNoteHeadChanged } from '../bible-list/note/noteHeadChangeHelpers';
import {
    type AgentResultType,
    type AgentRestoreType,
    NoBackupError,
    genUndoField,
    runWithAgentBackup,
    snapshotAgentEditing,
    snapshotAgentFile,
} from './agentBackupHelpers';
import {
    type NoteEditChangeType,
    type NoteNameType,
    type NoteVerseType,
    NOTE_EDIT_MAX_CHANGES,
    applyNoteEdit,
    collectNewNoteNameRefs,
    collectNewNoteVerseRefs,
    genNoteContentHash,
    readNoteBlocks,
    splitNoteVerseRef,
    toNameKey,
} from './agentNoteBlockHelpers';
import {
    toNoteAddChanges,
    toUnfoundVersesAsWords,
} from './agentNoteMarkupHelpers';
import { NOTE_STANDARD_FONT_LIST } from './agentNoteStyleHelpers';
import { toNoteCanonicalText } from './agentNoteNormalizeHelpers';
import {
    NOTE_BLOCK_LINK_STORAGE_KEY,
    readNoteBlockLinks,
} from './agentNoteBlockLinkHelpers';

// The editor's own settings, kept as the ones that differ from its defaults.
const NOTE_EDITOR_SETTINGS_KEY = 'lexical-playground-settings';

async function getHomeStorage() {
    return (await import('../server/appHomeStorage')).appHomeStorage;
}

/** A key of the app's home storage as it is now, for the undo. */
async function snapshotHomeSetting(
    key: string,
    filePath: string,
): Promise<AgentRestoreType> {
    return {
        type: 'home-setting',
        key,
        text: (await getHomeStorage()).getItem(key),
        filePath,
    };
}

async function loadExampleNodes() {
    const data = (await import('./agentNoteDefaultExample.json')).default;
    return Array.isArray(data?.nodes) ? data.nodes : [];
}

export type AgentNoteEditRequestType = {
    action?: unknown;
    invisibleCharacters?: unknown;
    filePath?: unknown;
    noteId?: unknown;
    from?: unknown;
    hash?: unknown;
    title?: unknown;
    bible?: unknown;
    changes?: unknown;
};

const NOTE_EDITABLE_KIND = 'note' as const;
const UNTITLED_NOTE_NAME = 'Unnamed';
const MAX_NEW_VERSES = 20;
const MAX_NEW_NAMES = 20;
const NAME_SEARCH_LIMIT = 8;
// How many echo steps an undo or redo steps over at most.
const MAX_ECHO_STEPS = 3;

/**
 * What the editor's font box lists: its six fonts and each installed
 * language's own face (`editorExtraFontFamilies` in `bibleNoteHelpers.ts`),
 * in the box's order. The languages are the ones this window already loaded.
 */
async function loadNoteFontList() {
    const fontSet = new Set(NOTE_STANDARD_FONT_LIST);
    try {
        const { initAllLangCss } = await import('../lang/langHelpers');
        for (const langData of (await initAllLangCss()) ?? []) {
            if (typeof langData?.fontFamily === 'string') {
                fontSet.add(langData.fontFamily);
            }
        }
    } catch (error) {
        handleError(error);
    }
    return [...fontSet].sort((one, other) => {
        return one.localeCompare(other);
    });
}

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

function failWithCode(reason: string, code: string): AgentResultType {
    return { isError: true, reason, code };
}

function checkIsSamePath(one: string, other: string) {
    return (
        toPathCompareKey(pathResolve(one)) ===
        toPathCompareKey(pathResolve(other))
    );
}

function toNoteName(title: unknown) {
    return typeof title === 'string' && title.trim() !== ''
        ? title.trim()
        : UNTITLED_NOTE_NAME;
}

async function getNoteClass() {
    return (await import('../bible-list/note/Note')).default;
}

/** The note file and note asked for, or why not. */
async function findNote(request: AgentNoteEditRequestType) {
    const filePath = request.filePath;
    if (
        typeof filePath !== 'string' ||
        !checkIsBibleNoteFileName(filePath) ||
        findSessionIdByFilePath(dirSourceSettingNames.BIBLE_NOTES, filePath) ===
            null
    ) {
        return toFailure(
            'That is not a notes file of the Bible Notes panel. Open the note ' +
                'with Open in Chatbot on its row.',
        );
    }
    if (!(await fsCheckFileExist(filePath))) {
        return toFailure(`"${pathBasename(filePath)}" is not there any more.`);
    }
    const noteId = request.noteId;
    if (!Number.isSafeInteger(noteId) || (noteId as number) < 0) {
        return toFailure('Which note of the file: `noteId` is a note number.');
    }
    // Only the note's own window, and only the note it shows: the person's
    // eyes are on that editor, and the file behind it may be a moment old.
    const controller = getNoteWindowController();
    if (controller === null) {
        return toFailure(
            'A note is read and changed in its own window only: open it ' +
                'with Open on its row in the Bible Notes panel.',
            NOTE_WINDOW_MISSING_CODE,
        );
    }
    if (
        controller.noteId !== noteId ||
        !checkIsSamePath(controller.filePath, filePath)
    ) {
        return toFailure(
            'This note window shows another note, so nothing was read ' +
                'or changed in it.',
            NOTE_WINDOW_OTHER_CODE,
        );
    }
    // What was typed a moment ago goes into the history first: the backup,
    // the undo and the read are all of what the person sees.
    await controller.flush();
    const Note = await getNoteClass();
    const note = await Note.fromFilePathEditing(filePath);
    const noteItem = note?.getItemById(noteId as number) ?? null;
    if (note === null || noteItem === null) {
        return toFailure(
            'That note is not in the file any more: it was removed or moved ' +
                'to another file.',
        );
    }
    if (noteItem.isVerseItem) {
        return toFailure(
            "This is a verse's highlights and comments, not a note: change " +
                'those in the Bible Reader.',
        );
    }
    // The editor's own state is the note: the head can trail it.
    noteItem.content = controller.readContent();
    return {
        found: {
            Note,
            note,
            noteItem,
            filePath,
            noteId: noteId as number,
            controller,
        },
    };
}

function toFailure(reason: string, code?: string) {
    return {
        failure: code === undefined ? fail(reason) : failWithCode(reason, code),
    };
}

async function handleRead(request: AgentNoteEditRequestType) {
    const lookedUp = await findNote(request);
    if ('failure' in lookedUp) {
        return lookedUp.failure;
    }
    const { noteItem, filePath } = lookedUp.found;
    const read = readNoteBlocks(
        noteItem.content,
        Number.isInteger(request.from) ? (request.from as number) : 1,
    );
    if (read === null) {
        return fail(
            'This note is kept in an older form that cannot be read here. ' +
                'Ask the person to open it in its own window once.',
        );
    }
    return {
        name: toNoteName(noteItem.title),
        file: pathBasename(filePath).replace(/\.own$/i, ''),
        ...read,
        fonts: await loadNoteFontList(),
    };
}

/**
 * New people and places, as the names lookup has them -- the name itself or
 * its KJV spelling, in any case; one it does not have stays words. Read only
 * when a change adds one, and given back at once.
 */
async function resolveNames(
    refs: { mentionKind: 'mention' | 'location'; text: string }[],
) {
    const nameMap = new Map<string, NoteNameType>();
    if (refs.length === 0) {
        return nameMap;
    }
    const { acquireLookupData, releaseLookupData } =
        await import('../location-name-lookup/lookupDataHelpers');
    const managers = await acquireLookupData();
    try {
        for (const ref of refs.slice(0, MAX_NEW_NAMES)) {
            const wanted = ref.text.trim().toLowerCase();
            const records =
                ref.mentionKind === 'location'
                    ? managers.locationsLookupManager.searchLocations(
                          ref.text,
                          {
                              limit: NAME_SEARCH_LIMIT,
                          },
                      )
                    : managers.namesLookupManager.searchNames(ref.text, {
                          limit: NAME_SEARCH_LIMIT,
                      });
            const found = records.find((record: any) => {
                return [record.name, record.kjvName].some((one) => {
                    return (
                        typeof one === 'string' &&
                        one.trim().toLowerCase() === wanted
                    );
                });
            });
            if (found !== undefined) {
                nameMap.set(toNameKey(ref.mentionKind, ref.text), {
                    mentionId: String(found.id),
                    mentionName: String(found.name),
                });
            }
        }
    } finally {
        releaseLookupData();
    }
    return nameMap;
}

/**
 * New verses resolved from the installed Bibles -- the lookup's version first,
 * or the one asked for -- as the editor keeps them: "(KJV) John 3:16", the
 * reference as that Bible writes it, the verse words, its font.
 */
async function resolveVerses(refs: string[], bible: string | null) {
    const verseMap = new Map<string, NoteVerseType>();
    if (refs.length === 0) {
        return verseMap;
    }
    const { resolveVersionOrder, resolveBibleItem } =
        await import('./agentBibleHelpers');
    // A token that names its Bible -- `[^(KJV) Hebrews 11:1]` -- is read from
    // that one; any other from the call's `bible`, else the lookup's first.
    const orderMap = new Map<string, string[]>();
    const getOrder = async (bibleKey: string | null) => {
        const known = orderMap.get(bibleKey ?? '');
        if (known !== undefined) {
            return known;
        }
        const resolved = await resolveVersionOrder(bibleKey);
        if (!('order' in resolved)) {
            throw new Error(String(resolved.reason ?? 'No Bible to read.'));
        }
        orderMap.set(bibleKey ?? '', resolved.order);
        return resolved.order;
    };
    const { getBibleFontFamily } =
        await import('./bible-helpers/bibleStyleHelpers');
    for (const token of refs.slice(0, MAX_NEW_VERSES)) {
        const { bibleKey, ref } = splitNoteVerseRef(token);
        const bibleItem = await resolveBibleItem(
            ref,
            await getOrder(bibleKey ?? bible),
        );
        if (bibleItem === null) {
            continue;
        }
        const fontFamily = await getBibleFontFamily(bibleItem.bibleKey);
        verseMap.set(token, {
            mentionName: await bibleItem.toTitleWithBibleKey(),
            shownText: await bibleItem.toTitle(),
            verseText: await bibleItem.toText(),
            style: fontFamily ? `font-family: ${fontFamily};` : '',
        });
    }
    return verseMap;
}

/**
 * The editor content of a NEW note whose words carry mark-up
 * (`agentNoteMarkupHelpers.ts`, `owa_bible_note add`): its blocks built by
 * the rules a change is built by, a new verse read from the installed Bible
 * and a new name looked up exactly as a change's are -- a verse no Bible
 * here has stays its words, so the note is still made. Null when the words
 * cannot be built that way (more blocks than one change takes, or a rule
 * refused them): the caller writes them plain, a line a paragraph.
 */
export async function genNewNoteContent(text: string, title = '') {
    const changes = toNoteAddChanges(text, title);
    if (changes.length === 0) {
        return '';
    }
    if (changes.length > NOTE_EDIT_MAX_CHANGES) {
        return null;
    }
    let verseMap = new Map<string, NoteVerseType>();
    try {
        verseMap = await resolveVerses(
            collectNewNoteVerseRefs('', changes),
            null,
        );
    } catch (_error) {
        // No Bible to read them from: every verse stays its words.
    }
    const resolvedChanges = toUnfoundVersesAsWords(
        changes,
        new Set(verseMap.keys()),
    );
    let nameMap = new Map<string, NoteNameType>();
    try {
        nameMap = await resolveNames(
            collectNewNoteNameRefs('', resolvedChanges),
        );
    } catch (error) {
        // A name the lookup could not be asked for stays its words.
        handleError(error);
    }
    const result = applyNoteEdit({
        content: '',
        changes: resolvedChanges,
        verseMap,
        nameMap,
    });
    return 'reason' in result ? null : result.content;
}

/**
 * The head as it is now, for the undo. A note no window ever wrote a history
 * for has none -- its head IS the file -- and that state is kept as the head,
 * or an undo would have nothing to put back over this change.
 */
async function snapshotNoteHead(filePath: string): Promise<AgentRestoreType> {
    const editing = await snapshotAgentEditing(NOTE_EDITABLE_KIND, filePath);
    if (editing !== null) {
        return editing;
    }
    return {
        type: 'editing',
        kind: NOTE_EDITABLE_KIND,
        filePath,
        text: JSON.stringify(JSON.parse(await fsReadFile(filePath)), null, 2),
    };
}

/**
 * What a change did, with every new verse named as it was read -- its Bible
 * and its reference as that Bible writes it, `(KJV) Hebrews 11:1` -- so an
 * answer says which Bible each verse came from, never which one was asked.
 */
function withVerseSources(
    summary: string,
    verseMap: Map<string, NoteVerseType>,
) {
    const names = [...verseMap.values()].map((verse) => {
        return verse.mentionName;
    });
    return names.length === 0
        ? summary
        : `${summary}; new verses read from the Bible: ${names.join(', ')}`;
}

function toChanges(value: unknown): NoteEditChangeType[] | null {
    if (value === undefined) {
        return [];
    }
    return Array.isArray(value) ? (value as NoteEditChangeType[]) : null;
}

async function handleEdit(request: AgentNoteEditRequestType) {
    const lookedUp = await findNote(request);
    if ('failure' in lookedUp) {
        return lookedUp.failure;
    }
    const { Note, noteItem, filePath, noteId, controller } = lookedUp.found;
    if (controller.isReadOnly) {
        return fail(
            'This note is open read-only (a preview of a file outside the ' +
                'Bible Notes folders): nothing in it can be changed.',
        );
    }
    const changes = toChanges(request.changes);
    if (changes === null) {
        return fail('`changes` is a list of changes.');
    }
    const title = typeof request.title === 'string' ? request.title : null;
    if (changes.length === 0 && title === null) {
        return fail('Nothing to change: give `changes` or `title`.');
    }
    // Block numbers mean the note as it was READ: typed into since, they
    // may point at other words.
    if (
        typeof request.hash === 'string' &&
        request.hash !== '' &&
        request.hash !== genNoteContentHash(noteItem.content)
    ) {
        return fail(
            'The note changed since it was read (somebody is typing in it): ' +
                'read it again, then make the change.',
        );
    }
    const bible =
        typeof request.bible === 'string' && request.bible.trim() !== ''
            ? request.bible.trim()
            : null;
    let verseMap: Map<string, NoteVerseType>;
    let nameMap: Map<string, NoteNameType>;
    try {
        verseMap = await resolveVerses(
            collectNewNoteVerseRefs(noteItem.content, changes),
            bible,
        );
        nameMap = await resolveNames(
            collectNewNoteNameRefs(noteItem.content, changes),
        );
    } catch (error: any) {
        return fail(String(error?.message ?? error));
    }
    const isFontAsked = changes.some((change) => {
        return change?.font !== undefined;
    });
    const isExampleAsked = changes.some((change) => {
        return change?.kind === 'example';
    });
    const result = applyNoteEdit({
        content: noteItem.content,
        changes,
        title,
        verseMap,
        nameMap,
        ...(isFontAsked ? { fontList: await loadNoteFontList() } : {}),
        ...(isExampleAsked ? { exampleNodes: await loadExampleNodes() } : {}),
    });
    if ('reason' in result) {
        return fail(result.reason);
    }
    const name = toNoteName(result.title ?? noteItem.title);
    if (!result.isChanged) {
        return {
            name,
            isChanged: false,
            hash: genNoteContentHash(noteItem.content),
            // Said so a model cannot read it as done (BN-53: asked to lay a
            // drawing out across that already was, the model answered "I've
            // updated the drawing").
            summary:
                'Nothing was changed: the note already reads that way. Tell ' +
                'them so -- never that you changed it.',
        };
    }
    const isContentChanged = result.content !== noteItem.content;
    const restores: AgentRestoreType[] = [];
    if (isContentChanged) {
        restores.push(await snapshotNoteHead(filePath));
    }
    if (result.title !== null) {
        restores.push(await snapshotAgentFile(filePath, NOTE_EDITABLE_KIND));
    }
    const blockLinks = result.blockLinks ?? [];
    if (blockLinks.length > 0) {
        restores.push(
            await snapshotHomeSetting(NOTE_BLOCK_LINK_STORAGE_KEY, filePath),
        );
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Changed the Bible note "${name}" (${withVerseSources(result.summary, verseMap)})`,
            restores,
            async () => {
                // Into the editor the person is looking at: its own save
                // keeps it in the editing history, as typing is kept.
                if (
                    isContentChanged &&
                    !(await controller.writeContent(result.content))
                ) {
                    throw new Error('The note window did not take the change.');
                }
                if (blockLinks.length > 0) {
                    // The editor's own list, added to: the note window
                    // draws them once it mounts again (told below).
                    const homeStorage = await getHomeStorage();
                    homeStorage.setItem(
                        NOTE_BLOCK_LINK_STORAGE_KEY,
                        JSON.stringify([
                            ...readNoteBlockLinks(
                                homeStorage.getItem(
                                    NOTE_BLOCK_LINK_STORAGE_KEY,
                                ),
                            ),
                            ...blockLinks,
                        ]),
                    );
                }
                if (result.title !== null) {
                    // The list's own way: the saved file, at once.
                    const savedNote = await Note.fromFilePath(filePath);
                    const savedItem = savedNote?.getItemById(noteId) ?? null;
                    if (savedNote === null || savedItem === null) {
                        throw new Error(
                            'The note could not be read to rename.',
                        );
                    }
                    savedItem.title = result.title;
                    savedNote.updateNoteItem(savedItem, true);
                    if (!(await savedNote.save())) {
                        throw new Error('The notes file could not be saved.');
                    }
                }
            },
        );
        // Any OTHER window of this note follows; this one shows it already
        // and finds nothing new in the head.
        notifyNoteHeadChanged(filePath);
        return {
            name,
            isChanged: true,
            // As the editor holds it now -- its own writing of the change --
            // so the next change's `hash` matches what it reads.
            hash: genNoteContentHash(controller.readContent()),
            summary: withVerseSources(result.summary, verseMap),
            isSaved: false,
            ...genUndoField(meta),
        };
    } catch (error: any) {
        if (error instanceof NoBackupError) {
            return fail(error.message);
        }
        handleError(error);
        return fail(
            `The change could not be finished: ${String(error?.message ?? error)}` +
                ' Anything it did get to do can be put back with owa_undo.',
        );
    }
}

/**
 * The toolbar's Undo / Redo, for what the note's editing history kept: one
 * step back or forward. The history is the FILE's, every note of it, so a
 * step that changed another note and not this one is taken back again and
 * refused -- this conversation is about one note.
 */
async function handleHistoryStep(
    request: AgentNoteEditRequestType,
    isUndo: boolean,
) {
    const lookedUp = await findNote(request);
    if ('failure' in lookedUp) {
        return lookedUp.failure;
    }
    const { Note, note, noteItem, filePath, noteId } = lookedUp.found;
    const beforeMap = new Map(
        note.items.map((item) => {
            return [item.id, `${item.title}\n${item.content}`];
        }),
    );
    const step = () => {
        return isUndo ? note.historyUndo() : note.historyRedo();
    };
    if (!(await step())) {
        return fail(
            isUndo
                ? 'There is nothing kept to go back to: the note is as its ' +
                      'history starts. A change made a moment ago may still ' +
                      'be in the note window, whose own Undo takes it back.'
                : 'There is nothing undone to do again.',
        );
    }
    let after = await Note.fromFilePathEditing(filePath);
    let afterItem = after?.getItemById(noteId) ?? null;
    // A step that only RE-WROTE this note -- an open note window writing back
    // what it was handed its own way (a code block's highlighting) -- is no
    // step a person made: one more is taken, so "undo that" takes back the
    // change itself (seen live 2026-11-08).
    for (let extra = 0; extra < MAX_ECHO_STEPS; extra++) {
        if (
            afterItem === null ||
            afterItem.content === noteItem.content ||
            afterItem.title !== noteItem.title ||
            toNoteCanonicalText(afterItem.content) !==
                toNoteCanonicalText(noteItem.content)
        ) {
            break;
        }
        if (!(await step())) {
            break;
        }
        after = await Note.fromFilePathEditing(filePath);
        afterItem = after?.getItemById(noteId) ?? null;
    }
    const isThisChanged =
        afterItem === null ||
        `${afterItem.title}\n${afterItem.content}` !== beforeMap.get(noteId);
    const isOtherChanged =
        after === null ||
        after.items.length !== beforeMap.size ||
        after.items.some((item) => {
            return (
                item.id !== noteId &&
                beforeMap.get(item.id) !== `${item.title}\n${item.content}`
            );
        });
    if (!isThisChanged && isOtherChanged) {
        await (isUndo ? note.historyRedo() : note.historyUndo());
        return fail(
            'The last change kept for this notes file was to another of its ' +
                'notes, so nothing was undone here. Change this note back ' +
                'with a change of its own.',
        );
    }
    notifyNoteHeadChanged(filePath);
    return {
        name: toNoteName(afterItem?.title ?? noteItem.title),
        isChanged: isThisChanged,
        hash: genNoteContentHash(afterItem?.content ?? noteItem.content),
        summary: isUndo
            ? "one step back in the note's history"
            : "one step forward in the note's history",
        isSaved: false,
    };
}

/**
 * The toolbar's ¶: how the note window draws the note -- its spaces and line
 * ends shown, or not. The editor's own setting, so it is the same for every
 * note window, as the ¶ is; the window asked from mounts again with it.
 */
async function handleView(request: AgentNoteEditRequestType) {
    const lookedUp = await findNote(request);
    if ('failure' in lookedUp) {
        return lookedUp.failure;
    }
    const { noteItem, filePath } = lookedUp.found;
    if (typeof request.invisibleCharacters !== 'boolean') {
        return fail(
            '`view` takes `invisibleCharacters`: true shows the spaces and ' +
                "line ends (the toolbar's ¶), false hides them.",
        );
    }
    const isShown = request.invisibleCharacters;
    const homeStorage = await getHomeStorage();
    const oldText = homeStorage.getItem(NOTE_EDITOR_SETTINGS_KEY);
    let settings: Record<string, unknown> = {};
    try {
        const parsed = oldText === null ? {} : JSON.parse(oldText);
        if (
            parsed !== null &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
        ) {
            settings = parsed;
        }
    } catch (_error) {
        settings = {};
    }
    const name = toNoteName(noteItem.title);
    if ((settings.showInvisibleCharacters === true) === isShown) {
        return {
            name,
            isChanged: false,
            summary: isShown
                ? 'The spaces and line ends are shown already.'
                : 'The spaces and line ends are hidden already.',
        };
    }
    // Kept as the editor keeps it: only what differs from its defaults.
    const newSettings = { ...settings };
    if (isShown) {
        newSettings.showInvisibleCharacters = true;
    } else {
        delete newSettings.showInvisibleCharacters;
    }
    try {
        const { meta } = await runWithAgentBackup(
            `${isShown ? 'Showed' : 'Hid'} the spaces and line ends of the Bible ` +
                `note window ("${name}")`,
            [await snapshotHomeSetting(NOTE_EDITOR_SETTINGS_KEY, filePath)],
            async () => {
                if (Object.keys(newSettings).length === 0) {
                    homeStorage.removeItem(NOTE_EDITOR_SETTINGS_KEY);
                } else {
                    homeStorage.setItem(
                        NOTE_EDITOR_SETTINGS_KEY,
                        JSON.stringify(newSettings),
                    );
                }
            },
        );
        notifyNoteHeadChanged(filePath);
        return {
            name,
            isChanged: true,
            summary: isShown
                ? 'spaces and line ends shown (the ¶ on)'
                : 'spaces and line ends hidden (the ¶ off)',
            ...genUndoField(meta),
        };
    } catch (error: any) {
        if (error instanceof NoBackupError) {
            return fail(error.message);
        }
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}

/**
 * One request from `owa_note_edit`. Always answers with a plain object and
 * never throws: the caller is a page expression whose only channel back is a
 * DOM event.
 */
export async function handleAgentNoteEditRequest(
    request: AgentNoteEditRequestType,
): Promise<AgentResultType> {
    try {
        const action = String(request?.action ?? '');
        if (action === 'read') {
            return await handleRead(request);
        }
        if (action === 'edit') {
            return await handleEdit(request);
        }
        if (action === 'undo' || action === 'redo') {
            return await handleHistoryStep(request, action === 'undo');
        }
        if (action === 'view') {
            return await handleView(request);
        }
        return fail('Unknown action. Use read, edit, undo, redo or view.');
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
