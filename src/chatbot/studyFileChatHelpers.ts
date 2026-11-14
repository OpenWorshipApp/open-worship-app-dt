/**
 * A STUDY FILE from the help window (2026-11-09, EC-464, the user: _open
 * chatbot then ask chatbot to make a resource study content for Mathew 3:3-7
 * I expect to have the new markdown file with enough information for the
 * passage with creative mermaid diagrams_; _should ask user to confirm file
 * name and confirm create_; _if resource file exist then should create with
 * different suffix_).
 *
 * The model DRAFTS (`owa_resource_file draft`, which writes nothing); the
 * person PRESSES. The draft is held here, in memory and bounded like a
 * drafted song (`lyricDraftHelpers.ts`), and the answer carries three
 * buttons that are pseudo tools registered nowhere and caught by the window
 * (`handleActing`): **Create "MAT.3.3-7 The Voice.md" in Resources** and
 * **… in Bible Notes** -- the person picks where it is kept (EC-509) -- or
 * **Save changes to "…"** for a change, **Preview** and **Change the
 * name**. The model
 * sees what it drafted with the study itself left out -- it wrote it, and
 * the whole file again on every later round would be billed twice.
 *
 * An ask is read here too (`readStudyFileAsk`): English in code, every other
 * language in its `assistant.json` or `typed.json` (`studyFileAsks`). It
 * goes out under `STUDY_SYSTEM_PROMPT` with the `study` tool list
 * (`modelTools.mjs`); a Resources, Bible Reader or lookup conversation keeps
 * its own prompt, which carries `STUDY_FILE_PROMPT`
 * (`noteCreatePromptHelpers.ts`).
 */
import {
    STUDY_ANSWER_MARKER,
    STUDY_CONTENT_RULES,
    STUDY_FILE_PROMPT,
    STUDY_KEEP_ANSWER_RULE,
} from './noteCreatePromptHelpers';
import {
    OTHER_CHAT_LANG_CODE,
    checkIsStudyKeepAsk,
    detectTypedLanguage,
    getAssistantLanguage,
    listAssistantLanguages,
    listTypedLanguages,
} from './chatLangHelpers';
import type { ChatMessageType } from './chatSessionHelpers';
import { readAskedTextFiles } from './attachmentHelpers';
import {
    STUDY_BIBLE_NOTES_LABEL,
    STUDY_FILE_EXTENSION,
    STUDY_FOLDER_NAME,
    type StudyPlaceType,
    STUDY_HEADINGS_LEAD,
    STUDY_REMOVE_ALONE_REASON,
    STUDY_REPLACE_ALONE_REASON,
    STUDY_TITLE_MAX_CHARS,
    applyStudyEdit,
    applyStudyRemove,
    describeStudyChange,
    describeStudyEditKept,
    describeStudyReplace,
    dropStudyDiagrams,
    lintStudyContent,
    listChangedStudyDiagrams,
    listStudySections,
    listStudyTranslations,
    readStudyFileName,
    readStudySection,
    separateStudyLines,
    splitLinesByFence,
    splitStudyFooter,
    splitStudyTranslations,
    summarizeStudyChange,
    toStudyBody,
    toStudyHeadingKey,
    toStudyOutline,
    toStudyTitle,
} from '../helper/agentStudyFileRules';
import {
    applyStudyReplaceChecked,
    describeStudyReplaceRepair,
} from './studyNameCheckHelpers';
import { toStudyLanguageSample } from './resourcesChatHelpers';
import {
    type StudyTranslateLanguageType,
    type StudyTranslatePlaceType,
    type StudyTranslatePlanType,
    toStudyTranslateDraftArgs,
} from './studyTranslateHelpers';

export { STUDY_ANSWER_MARKER, STUDY_FILE_PROMPT };

export const STUDY_ASK_KIND = 'study';
export const STUDY_MAX_TOOL_ROUNDS = 8;

/** The pseudo tools the card's buttons carry. Never sent to a model. */
export const STUDY_CREATE_TOOL_NAME = 'owa-study-create';
export const STUDY_PREVIEW_TOOL_NAME = 'owa-study-preview';
export const STUDY_RENAME_TOOL_NAME = 'owa-study-rename';

export const STUDY_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program. The person wants a Bible STUDY FILE: a Markdown ' +
    'file the app keeps where they choose -- in their Resources, beside the ' +
    'chapter it is about, where the Bible Reader shows it, or in their ' +
    'Bible Notes. Make it now with owa_resource_file ' +
    'action "draft": `ref` the passage they named (or the one this ' +
    'conversation is about), a 2-6 word `title`, and the whole study as ' +
    '`content`; never ask what to write. First you may read the passage ' +
    'once with owa_lookup_record kind "verse" (`names` and `related` true) ' +
    'for its people, places and cross references. ' +
    `${STUDY_CONTENT_RULES} ${STUDY_KEEP_ANSWER_RULE} ` +
    'If draft refuses, fix what it says and call it again. The app saves ' +
    'NOTHING until they press a button under your answer -- New Bible Note ' +
    'keeps it as a Bible note, Create keeps it as a Markdown file in ' +
    'Resources or in Bible Notes: never say it is saved, nor where. ' +
    'Your answer: two or three sentences on what the study holds and ' +
    'which diagrams it draws, then tell them to press the one they want, ' +
    'or Preview to look at it first. Never paste the study ' +
    'into the answer. If ' +
    'no passage is named and none is open, ask which passage in one line. ' +
    'Answer in the language of their question.';

/** What the model is told when it asks to save or preview by itself. */
export const STUDY_SAVE_MODEL_REFUSAL =
    'Saving and previewing a study file are the person’s presses: the ' +
    'Create and Preview buttons under your answer do them. Call draft, ' +
    'then tell them to press Create.';

/** What the model sees in place of the study it drafted. */
export const STUDY_HELD_NOTE =
    'Nothing is saved yet. The window holds this draft and shows it under ' +
    'your answer with New Bible Note (kept as a Bible note), Create in ' +
    'Resources and Create in Bible Notes (kept as a Markdown file), Preview ' +
    'and Change the name: tell the person to press the one they want -- a ' +
    'Bible note or a Markdown file. Say in two or three sentences what it ' +
    'holds; never paste it.';

/**
 * The same when the person PRESSED for a Markdown file (EC-581): the card
 * keeps the Markdown buttons alone.
 */
export const STUDY_HELD_MARKDOWN_NOTE =
    'Nothing is saved yet. They chose a Markdown file: the window holds ' +
    'this draft and shows it under your answer with Create in Resources, ' +
    'Create in Bible Notes, Preview and Change the name: tell the person ' +
    'to press Create where they want it kept. Say in two or three ' +
    'sentences what it holds; never paste it.';

/**
 * The same for a CHANGE to a study file, whose button is Save changes --
 * seen live 2026-11-10, a change's answer told the person to press Create,
 * a button the card does not have. What it changes is said WHOLE: the card
 * leaves that to the answer, and an answer naming only the part asked for
 * hid a change that also rewrote another.
 */
export const STUDY_CHANGE_HELD_NOTE =
    'Nothing is saved yet. The window holds this change and shows it under ' +
    'your answer with Save changes and Preview: tell the person to press ' +
    'Save changes to write it. Say in one or two sentences what it ' +
    'changes -- every part `change` names, not only the one asked for; ' +
    'never paste it.';

/**
 * What a window that has been reopened since says instead. One literal, so
 * `tran(STUDY_DRAFT_GONE_TEXT)` where it is written is a key the coverage
 * test can read.
 */
export const STUDY_DRAFT_GONE_TEXT =
    'That study file is not held any more — this window has been reopened since. Ask me again and I will write it afresh.';

export const STUDY_STOPPED_TEXT =
    'The study file is drafted, but the assistant stopped before saying more. Press Create to save it, or Preview to look at it first.';

/**
 * The same for a drafted CHANGE to a study open in the tab, whose button is
 * Save changes, not Create (2026-11-11, EC-504). Preview first: the
 * assistant never said what the change does, and the one such change seen
 * took out 29 of the study's 30 parts. One literal, as the sentence above.
 */
export const STUDY_CHANGE_STOPPED_TEXT =
    'The change to the study file is drafted, but the assistant stopped before saying what it changes. Press Preview to look at it first, then Save changes.';

export type DraftedStudyRawType = {
    ref: string;
    title: string;
    content: string;
    bible: string | null;
};

export type DraftedStudyType = {
    reference: string;
    name: string;
    nameTaken: string | null;
    isChange: boolean;
    file: string | null;
    hash: string | null;
    passage: string;
    bible: string;
    diagramCount: number;
    change: string | null;
    content: string;
    /** What the draft was made from, for **Change the name**. */
    raw: DraftedStudyRawType | null;
    /**
     * The Bible note a model asked for, held as this draft's twin until
     * the person chooses which is kept (EC-581): **New Bible Note** makes
     * it as the model wrote it.
     */
    note?: HeldNoteType;
    /** The person PRESSED for a Markdown file: no **New Bible Note**. */
    isMarkdownOnly?: true;
    /**
     * The window wrote its words (a translation, EC-604): the model was
     * shown none of them, so a part of it is read before it is written.
     */
    isWindowMade?: true;
    /**
     * Held from an EARLIER answer (EC-606): the model asked now was shown
     * none of its words either, so a part of it is read before it is
     * written, as a window-made one's is.
     */
    isFromEarlierAsk?: true;
    /**
     * The plain answers between that card and the ask (EC-701): a question
     * asked in between no longer ends the chain, and the ask is told the
     * card is further up.
     */
    answersBetween?: number;
};

/** A Bible note's words, as `owa_bible_note add` takes them. */
export type HeldNoteType = { title: string; text: string; file?: string };

/** A note holds at most this many characters (`AGENT_NOTE_TEXT_MAX_CHARS`). */
export const NOTE_TEXT_MAX_CHARS = 20_000;
/** A note's title, at most (`owa_bible_note`'s own limit). */
export const NOTE_TITLE_MAX_CHARS = 200;

/**
 * What the model is shown for a new note the window HOLDS (EC-581), in
 * place of a note made: the person chooses under the answer.
 */
export const NOTE_HELD_CHOICE_NOTE =
    'Nothing is made yet. The window holds this note under your answer as ' +
    'a card: New Bible Note keeps it as a Bible note, and Create keeps it ' +
    'as a Markdown file in Resources or in Bible Notes. Tell the person to ' +
    'press the one they want, and say in one or two sentences what it ' +
    'holds. Never paste it, and never say it is made or where.';

/** The same when they PRESSED for a Markdown file. */
export const NOTE_HELD_MARKDOWN_NOTE =
    'Nothing is made yet. They chose a Markdown file, so the window made ' +
    'your note one and holds it under your answer with Create in ' +
    'Resources, Create in Bible Notes, Preview and Change the name: tell ' +
    'them to press Create where they want it kept, and say in one or two ' +
    'sentences what it holds. Never paste it.';

/** Pressed for a Markdown file, a note that names no passage. */
export const NOTE_MARKDOWN_NO_PASSAGE_REFUSAL =
    'They chose a Markdown file, and a study file is about a passage: put ' +
    'the passage it is about in `text`, a verse token alone on its line ' +
    '(e.g. [^John 3:16-21]), and call add again.';

/** A new note asked for while a new study is held under the answer. */
export const NOTE_BESIDE_DRAFT_REFUSAL =
    'The window already holds what you drafted under your answer, and the ' +
    'person chooses there what it is kept as -- a Bible note or a Markdown ' +
    'file. Do not make it again: tell them to press the one they want.';

/** What a **New Bible Note** press on a study card carries in `to`. */
export const STUDY_NOTE_PLACE = 'note';

/** Whether a card press makes a Bible note, not a Markdown file. */
export function checkIsStudyNotePress(args: any) {
    return args?.to === STUDY_NOTE_PLACE;
}

// `[^John 3:16]`, `[^(KJV) Matthew 3:3-7]`.
const VERSE_TOKEN_PATTERN = /\[\^(?:\(([^)\]]+)\)\s*)?([^\]]+)\]/;
const VERSE_TOKEN_LINE_PATTERN = /^\s*\[\^(?:\(([^)\]]+)\)\s*)?([^\]]+)\]\s*$/;

function toLooseRef(ref: string) {
    return ref.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A NEW study as a Bible note (EC-581): its passage first, as a token
 * alone on its line -- the app prints it whole there, as the study quotes
 * it -- then the model's own words, verse tokens and all, with no diagram
 * and no code: a note draws neither. The note the model itself asked for,
 * when this draft is its twin, is that note as written. Null for a change,
 * a draft that keeps nothing it was made from, or words longer than a note
 * holds.
 */
export function toNoteFromStudy(
    drafted: Pick<DraftedStudyType, 'isChange' | 'raw' | 'bible' | 'note'>,
): (HeldNoteType & { diagramCount: number }) | null {
    if (drafted.isChange) {
        return null;
    }
    if (drafted.note !== undefined) {
        return { ...drafted.note, diagramCount: 0 };
    }
    if (drafted.raw === null) {
        return null;
    }
    const titled = toStudyTitle(drafted.raw.title);
    const title = 'title' in titled ? titled.title : drafted.raw.title.trim();
    const ref = drafted.raw.ref.trim();
    if (title === '' || ref === '') {
        return null;
    }
    const body = toStudyBody(drafted.raw.content);
    const bodyLines = splitLinesByFence(body)
        .filter(({ line, isInFence }) => {
            if (isInFence) {
                return false;
            }
            // The passage is printed once, at the top.
            const token = VERSE_TOKEN_LINE_PATTERN.exec(line);
            return token === null || toLooseRef(token[2]) !== toLooseRef(ref);
        })
        .map(({ line }) => {
            return line;
        });
    const bible = drafted.bible.trim();
    const passage = bible === '' ? `[^${ref}]` : `[^(${bible}) ${ref}]`;
    const text = [passage, '', ...bodyLines]
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (text.length > NOTE_TEXT_MAX_CHARS) {
        return null;
    }
    return {
        title,
        text,
        diagramCount: lintStudyContent(body).diagrams.length,
    };
}

/**
 * A note's title as a study file's: the characters no file name takes made
 * spaces, then its first words within the study title's length. Null when
 * nothing of it will do.
 */
function toStudyTitleFromNote(title: string) {
    const titled = toStudyTitle(title);
    if ('title' in titled) {
        return titled.title;
    }
    const words = title
        .replace(/[\\/:*?"<>|#^[\]{}]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ');
    let cut = '';
    for (const word of words.slice(0, 6)) {
        const next = cut === '' ? word : `${cut} ${word}`;
        if (next.length > STUDY_TITLE_MAX_CHARS) {
            break;
        }
        cut = next;
    }
    const retried = toStudyTitle(cut);
    return 'title' in retried ? retried.title : null;
}

/**
 * A held note's words as a study file's `draft` (EC-581): its first
 * passage -- a token alone on its line, else the first token -- is the
 * study's `ref` and its Bible the study's, and that line leaves the words,
 * since the study quotes its passage at the top. Null for a note that
 * cites no passage: a study file is about one.
 */
export function toStudyArgsFromNote(note: HeldNoteType): {
    ref: string;
    title: string;
    content: string;
    bible?: string;
} | null {
    const lines = note.text.replace(/\r\n?/g, '\n').split('\n');
    const lineIndex = lines.findIndex((line) => {
        return VERSE_TOKEN_LINE_PATTERN.test(line);
    });
    const token =
        lineIndex >= 0
            ? VERSE_TOKEN_LINE_PATTERN.exec(lines[lineIndex])
            : VERSE_TOKEN_PATTERN.exec(note.text);
    if (token === null) {
        return null;
    }
    const ref = token[2].trim();
    const bible = (token[1] ?? '').trim();
    const title = toStudyTitleFromNote(note.title);
    if (ref === '' || title === null) {
        return null;
    }
    // The note's own title line, when it opens with one, is the file's.
    const firstIndex = lines.findIndex((line) => {
        return line.trim() !== '';
    });
    const firstLine = (lines[firstIndex] ?? '').replace(/^#+\s*/, '').trim();
    const titleIndex =
        firstIndex >= 0 &&
        toLooseRef(firstLine) === toLooseRef(note.title) &&
        firstIndex !== lineIndex
            ? firstIndex
            : -1;
    const content = lines
        .filter((_line, index) => {
            return index !== lineIndex && index !== titleIndex;
        })
        .join('\n')
        .trim();
    if (content === '') {
        return null;
    }
    return { ref, title, content, ...(bible === '' ? {} : { bible }) };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value : '';
}

function parseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}

/**
 * A `draft` result as a held draft's fields, or null for anything else --
 * a refusal is prose, and nothing was drafted.
 */
export function readDraftedStudy(
    text: string,
    args: any,
): Omit<DraftedStudyType, 'reference'> | null {
    const result = parseJson(String(text ?? ''));
    if (
        result?.drafted !== true ||
        typeof result.content !== 'string' ||
        typeof result.name !== 'string'
    ) {
        return null;
    }
    const isChange = result.isChange === true;
    return {
        name: result.name,
        nameTaken:
            typeof result.nameTaken === 'string' ? result.nameTaken : null,
        isChange,
        file: typeof result.file === 'string' ? result.file : null,
        hash: typeof result.hash === 'string' ? result.hash : null,
        passage: toText(result.passage),
        bible: toText(result.bible),
        diagramCount: Number(result.diagramCount) || 0,
        change: typeof result.change === 'string' ? result.change : null,
        content: result.content,
        raw: isChange
            ? null
            : {
                  ref: toText(args?.ref),
                  title: toText(args?.title),
                  content: toText(args?.content),
                  bible:
                      typeof args?.bible === 'string' && args.bible !== ''
                          ? args.bible
                          : null,
              },
    };
}

/**
 * The draft result as the model is shown it: everything but the study,
 * which is held by the window, and a note on what to do next -- the
 * kept-answer note when the window put in the answer above (EC-466). A
 * `noteText` -- what the window's chain did that the tool cannot say: a
 * pair put right (EC-541), the parts kept under a part's new words
 * (EC-544) -- leads what the change is said to do.
 */
export function toModelDraftText(
    text: string,
    isAnswerKept = false,
    noteText = '',
    // The person pressed for a Markdown file (EC-581): no Bible note.
    isMarkdownOnly = false,
) {
    const result = parseJson(String(text ?? ''));
    if (result === null || typeof result.content !== 'string') {
        return text;
    }
    const { content, ...rest } = result;
    const isChange = result.isChange === true;
    const change = [
        noteText,
        typeof rest.change === 'string' ? rest.change : '',
    ]
        .filter((sentence) => {
            return sentence !== '';
        })
        .join(' ');
    return JSON.stringify({
        ...rest,
        ...(noteText === '' ? {} : { change }),
        content: `[held by the window: ${content.length} characters]`,
        note: isAnswerKept
            ? isChange
                ? STUDY_KEPT_ANSWER_CHANGE_NOTE
                : STUDY_KEPT_ANSWER_NOTE
            : isChange
              ? STUDY_CHANGE_HELD_NOTE
              : isMarkdownOnly
                ? STUDY_HELD_MARKDOWN_NOTE
                : STUDY_HELD_NOTE,
    });
}

// In memory only and bounded, like a drafted song: a session file with a
// study in every other message is a slower launch on a weak machine.
const draftedStudyMap = new Map<string, DraftedStudyType>();
const MAX_DRAFTED_STUDIES = 3;
let draftCount = 0;

export function keepDraftedStudy(
    drafted: Omit<DraftedStudyType, 'reference'>,
): DraftedStudyType {
    draftCount += 1;
    const kept = {
        ...drafted,
        reference: `study-${Date.now().toString(36)}-${draftCount}`,
    };
    draftedStudyMap.set(kept.reference, kept);
    while (draftedStudyMap.size > MAX_DRAFTED_STUDIES) {
        const oldest = draftedStudyMap.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        draftedStudyMap.delete(oldest);
    }
    return kept;
}

export function takeDraftedStudy(reference: string) {
    return draftedStudyMap.get(reference) ?? null;
}

/**
 * The card's buttons; labels in English, translated where drawn. A NEW
 * study asks where it is kept (2026-11-12, EC-509, the user: _when create
 * markdown file for user make sure ask user into resource or bible-note
 * area_): one Create for Resources, one for the Bible Notes list, each
 * naming the file it makes. And first, what it is kept AS (EC-581): **New
 * Bible Note** -- the panel's own words for one -- makes it a Bible note,
 * unless the person pressed for a Markdown file, or its words are more
 * than a note holds.
 */
export function genStudyDraftActions(drafted: DraftedStudyType) {
    const reference = drafted.reference;
    const isNoteOffered =
        !drafted.isChange &&
        drafted.isMarkdownOnly !== true &&
        toNoteFromStudy(drafted) !== null;
    return [
        ...(isNoteOffered
            ? [
                  {
                      label: 'New Bible Note',
                      toolName: STUDY_CREATE_TOOL_NAME,
                      args: { reference, to: STUDY_NOTE_PLACE },
                  },
              ]
            : []),
        ...(drafted.isChange
            ? [
                  {
                      label: `Save changes to "${drafted.name}"`,
                      toolName: STUDY_CREATE_TOOL_NAME,
                      args: { reference },
                  },
              ]
            : [
                  {
                      label: `Create "${drafted.name}" in Resources`,
                      toolName: STUDY_CREATE_TOOL_NAME,
                      args: { reference, to: 'resources' },
                  },
                  {
                      label: `Create "${toBibleNotesDraftName(drafted)}" in Bible Notes`,
                      toolName: STUDY_CREATE_TOOL_NAME,
                      args: { reference, to: 'bible-notes' },
                  },
              ]),
        {
            label: 'Preview',
            toolName: STUDY_PREVIEW_TOOL_NAME,
            args: { reference: drafted.reference },
        },
        ...(drafted.isChange
            ? []
            : [
                  {
                      label: 'Change the name',
                      toolName: STUDY_RENAME_TOOL_NAME,
                      args: { reference: drafted.reference },
                  },
              ]),
    ];
}

// A model's option that says one of the card's buttons again in other
// words: create, save or keep it -- in Resources, in Bible Notes, as a
// note -- save the changes, preview it, change its name. Never a change
// asked for: that names what to change.
const STUDY_CARD_ECHO_PATTERN =
    /^(?:(?:yes|yeah|ok|okay|sure|please)[,!. ]*)?(?:please )?(?:(?:create|save|keep|make)(?: (?:it|this|that|this study|this file|the (?:study|file|study file|markdown file)))?(?: as (?:a |the )?(?:bible note|note|markdown file|file))?(?: (?:in|to|into) (?:the |my )?(?:resources|bible notes)(?: folder| list)?)?|save(?: the)? changes(?: (?:to|in) (?:it|this|this study|the (?:study|file|study file)))?|(?:a )?new bible note|(?:make|create|save) (?:it )?(?:as )?a bible note|preview(?: (?:it|this|that|this study|the (?:study|file|study file|changes)))?|(?:change|edit) the (?:study |file )?name|rename(?: (?:it|this|the (?:study|file)))?)[.!]?$/i;
// A label without the file name it quotes, and `to` before one.
const QUOTED_NAME_PATTERN = /\s*(?:\bto\s+)?["“«„][^"”»“]*["”»“]/g;

/**
 * A model's options under a study card, less those that say one of its
 * buttons again (2026-11-14, EC-705). Seen live under a kept answer: the
 * model's _Create in Resources_ and _Create in Bible Notes_ beside **Create
 * "JHN.3.16 The Heart of the Gospel.md" in Resources** and **… in Bible
 * Notes**. Pressed, those words go to the model as a question, and the
 * model can never save a study (`STUDY_SAVE_MODEL_REFUSAL`). Read by the
 * card's own labels with the quoted name taken out -- in English and as
 * drawn (`toShown`), so in the window's language too -- and, in English,
 * by `STUDY_CARD_ECHO_PATTERN`. With no card, nothing is dropped.
 */
export function dropStudyCardEchoReplies<
    T extends { label: string; toolName?: string },
>(
    replies: readonly string[],
    actions: readonly T[],
    toShown: (action: T) => string = (action) => action.label,
): string[] {
    const cardActions = actions.filter((action) => {
        return STUDY_CARD_TOOL_NAME_SET.has(action.toolName ?? '');
    });
    if (cardActions.length === 0) {
        return [...replies];
    }
    const taken = new Set(
        cardActions.flatMap((action) => {
            return [action.label, toShown(action)].map((label) => {
                return toEchoKey(label.replace(QUOTED_NAME_PATTERN, ' '));
            });
        }),
    );
    return replies.filter((reply) => {
        const text = String(reply ?? '').trim();
        return (
            !taken.has(toEchoKey(text)) && !STUDY_CARD_ECHO_PATTERN.test(text)
        );
    });
}

// Letters and digits alone: a language written without spaces between its
// words is matched however the model spaced them.
function toEchoKey(text: string) {
    return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '');
}

/**
 * The name a study asks for in Bible Notes: the one it was drafted under.
 * The "(1)" a name taken in Resources gave it is Resources' own.
 */
export function toBibleNotesDraftName(drafted: {
    name: string;
    nameTaken: string | null;
}) {
    return drafted.nameTaken ?? drafted.name;
}

/** Where a Create press keeps the study; Resources unless it says. */
export function readStudyCreatePlace(args: any): StudyPlaceType {
    return args?.to === 'bible-notes' ? 'bible-notes' : 'resources';
}

// "Change the name": the tab waits for ONE line, the new name.
const renameWaitMap = new Map<string, string>();
const MAX_NAME_LINE_LENGTH = 80;

export function setStudyRenameWait(sessionId: string, reference: string) {
    renameWaitMap.set(sessionId, reference);
}

export function clearStudyRenameWait(sessionId: string) {
    renameWaitMap.delete(sessionId);
}

/**
 * The draft a typed line names anew, or null. The wait ends either way: a
 * line that is not a name -- a question, more than one line, a command --
 * is asked as it stands, and the name is forgotten.
 */
export function takeStudyRenameWait(sessionId: string, text: string) {
    const reference = renameWaitMap.get(sessionId);
    renameWaitMap.delete(sessionId);
    if (reference === undefined) {
        return null;
    }
    const line = String(text ?? '').trim();
    if (
        line === '' ||
        line.length > MAX_NAME_LINE_LENGTH ||
        line.includes('\n') ||
        line.startsWith('/') ||
        /[?？]$/.test(line)
    ) {
        return null;
    }
    return reference;
}

// A making word and a study word. "Note" alone is a Bible note's
// (`NOTE_CREATE_PROMPT`); a how-to about the panel is the guide's.
const MAKING_PATTERN =
    /\b(make|create|write|prepare|build|generate|draft|produce|save|put|turn|do)\b/i;
const STUDY_FILE_WORD_PATTERN =
    /\b(resources?|markdown|md file|\.md|study[- ](?:file|content|context|guide|material|sheet|document|page))\b/i;
const STUDY_WORD_PATTERN = /\bstud(?:y|ies)\b/i;
const NOTE_WORD_PATTERN = /\bnotes?\b/i;
const HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|when|which|is there|are there)\b|\bfolders?\b/i;

// A line as the patterns read it: one form of every letter, nothing a
// keyboard adds that is no part of the words (a zero-width space between
// words, Persian's half-space -- the patterns hold none), and one
// apostrophe for the curly ones and the okina a Samoan or Tongan keyboard
// types.
function toStudyAskLine(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʻʼ]/g, "'")
        .trim();
}

/**
 * Whether a typed line asks for a study file. English in code; every other
 * language's own pattern from its `assistant.json` or, for a language only
 * typed, its `typed.json` (`studyFileAsks`, EC-465). An English how-to is
 * nobody's ask: a pattern of a Latin-script language must never take one.
 */
export function readStudyFileAsk(text: string) {
    const line = toStudyAskLine(text);
    if (line === '' || line.startsWith('/') || line.length > 400) {
        return false;
    }
    if (HOW_TO_PATTERN.test(line)) {
        return false;
    }
    if (
        [...listAssistantLanguages(), ...listTypedLanguages()].some(
            (language) => {
                return language.studyFileAskPatterns.some((pattern) => {
                    return pattern.test(line);
                });
            },
        )
    ) {
        return true;
    }
    if (!MAKING_PATTERN.test(line)) {
        return false;
    }
    if (STUDY_FILE_WORD_PATTERN.test(line)) {
        return true;
    }
    return STUDY_WORD_PATTERN.test(line) && !NOTE_WORD_PATTERN.test(line);
}

/**
 * The question as the model is asked it: the study's language named, since
 * a question put into English for the model would otherwise come back as an
 * English file (the arguments of a tool are never translated).
 */
export function toStudyAsk(question: string, fileLanguageName: string | null) {
    return (
        `${question}\n\n(They ask for a study file.` +
        (fileLanguageName === null
            ? ')'
            : ` Write the study file -- its title and every word of it -- in ${fileLanguageName}.)`)
    );
}

/** What the model is told when it writes `@answer` and none is held. */
export const STUDY_NO_ANSWER_REFUSAL =
    `There is no answer of yours above to put in for "${STUDY_ANSWER_MARKER}": ` +
    'write the study itself as `content`.';

// Shorter than this is a line, not a study: the window's own notices
// ("That study file is not held any more …") are.
const MIN_ANSWER_ABOVE_LENGTH = 120;

const STUDY_CARD_TOOL_NAME_SET = new Set([
    STUDY_CREATE_TOOL_NAME,
    STUDY_PREVIEW_TOOL_NAME,
    STUDY_RENAME_TOOL_NAME,
]);

/**
 * The answer a "save that as a study file" means (EC-466): the newest in
 * the tab that is the assistant's words -- never the window's follow-up to
 * a thumb down, what stood for a failed ask (the guide's stand-in under the
 * failure, EC-702), a study card (so a second ask still finds the answer
 * that was read) or a line too short to be a study. Null when the tab holds
 * none. `beforeId`: only what is above that message is looked at -- a
 * Retry's question, so the answer it retries is not taken for the one its
 * "that" pointed at. `isNewestOnly`: the newest of the assistant's own
 * messages decides, and a study card or a short line there answers null --
 * what the window keeps whatever the model writes must be the answer "that"
 * can only mean.
 */
export function findStudyAnswerAbove(
    messages: readonly ChatMessageType[],
    options: { beforeId?: number; isNewestOnly?: boolean } = {},
): string | null {
    const index = findStudyAnswerAboveIndex(messages, options);
    return index < 0 ? null : String(messages[index].text ?? '').trim();
}

function findStudyAnswerAboveIndex(
    messages: readonly ChatMessageType[],
    options: { beforeId?: number; isNewestOnly?: boolean },
) {
    const beforeIndex =
        options.beforeId === undefined
            ? -1
            : messages.findIndex((message) => {
                  return message.id === options.beforeId;
              });
    const lastIndex = beforeIndex < 0 ? messages.length - 1 : beforeIndex - 1;
    for (let index = lastIndex; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.author !== 'bot' || message.isFollowUp === true) {
            continue;
        }
        const text = String(message.text ?? '').trim();
        if (
            // Newest, "that" may mean the answer above it as well.
            message.isAskFailed === true ||
            (message.actions ?? []).some((action) => {
                return STUDY_CARD_TOOL_NAME_SET.has(action.toolName ?? '');
            }) ||
            text.length < MIN_ANSWER_ABOVE_LENGTH
        ) {
            if (options.isNewestOnly === true) {
                return -1;
            }
            continue;
        }
        return index;
    }
    return -1;
}

/**
 * The question the answer `findStudyAnswerAbove` finds was asked by: the
 * person's own line right above it (EC-704), what a kept answer added to a
 * study is headed with. Null when the tab holds no such answer or no line
 * of theirs above it.
 */
export function findStudyAnswerQuestion(
    messages: readonly ChatMessageType[],
    options: { beforeId?: number } = {},
): string | null {
    const answerIndex = findStudyAnswerAboveIndex(messages, options);
    for (let index = answerIndex - 1; index >= 0; index -= 1) {
        if (messages[index].author === 'you') {
            return String(messages[index].text ?? '').trim();
        }
    }
    return null;
}

// "Save that as a study file" (EC-466): a keeping word, the answer pointed
// back at and a study word, and nothing more asked of it -- a line that also
// asks for a change, a diagram or a translation is the model's to read.
// English in code; every other language's own words are its `studyKeepAsks`
// (EC-508).
const KEEP_VERB_PATTERN =
    /\b(save|keep|store|put|turn|make|copy|convert|add|place)\b/i;
// "that", "this", "it" -- never "this passage" or "that story", which name
// what a NEW study is about, nor a study "that explains John 3" -- or the
// answer itself.
const ANSWER_POINTER_PATTERN = new RegExp(
    [
        String.raw`(?<!\b(?:stud(?:y|ies)|files?|resources?|markdown|documents?|pages?|sheets?|guides?)\s)` +
            String.raw`\b(?:that|this|it|these|those)\b` +
            String.raw`(?!\s+(?:passages?|verses?|chapters?|stor(?:y|ies)|books?|topics?|subjects?|psalms?|parables?|lessons?|sermons?|texts?|parts?|sections?|files?|stud(?:y|ies))\b)`,
        String.raw`\b(?:your|the|last)\s+(?:last\s+)?(?:answer|reply|response|explanation|summary)\b`,
        String.raw`\bwhat you (?:said|wrote|told me|explained|gave me)\b`,
        String.raw`\babove\b`,
    ].join('|'),
    'i',
);
// "Save as a study file", the answer left unsaid.
const KEEP_AS_PATTERN =
    /^(?:(?:please|pls|can you|could you|would you)\s+)*(?:save|keep|store)\s+as\b/i;
// What a new study is ABOUT or LIKE, not the answer kept: "a study about
// this", "one for John 3 like that".
const TOPIC_POINTER_PATTERN =
    /\b(?:about|on|for|from|of|regarding|like|similar to)\s+(?:that|this|it|these|those)\b/i;
const MORE_ASKED_PATTERN =
    /\b(?:and|with|plus|also|but|then|except|translat\w*|diagrams?|charts?|mermaid|maps?|shorter|longer|simpler|more|less|expand\w*|rewrite|rephrase|improve|fix|change|edit|questions?|prayer)\b/i;
const KEEP_HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|when|which|is there|are there|can i|could i|do i|should i|may i)\b/i;
const MAX_KEEP_ASK_LENGTH = 120;

/**
 * Whether a line asks to keep the answer above as a study file, as it is
 * (EC-466). Told only to write `@answer`, gemma4:cloud drafted a study of
 * its own again, so a line read so has the answer put in by the window
 * whatever the model writes (`toKeptAnswerDraftArgs`). In English, or in
 * any installed language's own words (`studyKeepAsks`, EC-508): EC-465's
 * patterns read _save that as a study file_ in Spanish, Chinese or Khmer as
 * a NEW study, which the model then wrote.
 */
export function readKeepAnswerAsk(text: string) {
    const line = toStudyAskLine(text).replace(/[.!?]+$/, '');
    if (
        line === '' ||
        line.length > MAX_KEEP_ASK_LENGTH ||
        line.startsWith('/')
    ) {
        return false;
    }
    return readEnglishKeepAsk(line) || checkIsStudyKeepAsk(line);
}

function readEnglishKeepAsk(line: string) {
    if (
        KEEP_HOW_TO_PATTERN.test(line) ||
        NOTE_WORD_PATTERN.test(line) ||
        TOPIC_POINTER_PATTERN.test(line) ||
        MORE_ASKED_PATTERN.test(line) ||
        !KEEP_VERB_PATTERN.test(line) ||
        !(STUDY_FILE_WORD_PATTERN.test(line) || STUDY_WORD_PATTERN.test(line))
    ) {
        return false;
    }
    return ANSWER_POINTER_PATTERN.test(line) || KEEP_AS_PATTERN.test(line);
}

/**
 * Said on an ask read as keeping the answer above (`readKeepAnswerAsk`):
 * the prompt's rule alone was passed over.
 */
export const STUDY_KEEP_ANSWER_HINT =
    '(They ask to keep your last answer above as a study file, as it is: ' +
    `call owa_resource_file draft once with \`content\` "${STUDY_ANSWER_MARKER}" ` +
    '-- the app puts that answer in word for word -- the passage it is ' +
    'about as `ref` and a 2-6 word `title` in the language of that answer; ' +
    `to add it to a study file open here, \`file\` and \`append\` "${STUDY_ANSWER_MARKER}" ` +
    'instead. Never write the study again.)';

/**
 * Beside that hint while a card above holds a new study (EC-701): _add that
 * to the study_ under an answer may mean the study the card holds, and the
 * hint above names only a study file open here, which a study not saved
 * yet is not.
 */
export function genHeldStudyKeepHint(
    held: Omit<DraftedStudyType, 'reference'>,
) {
    return (
        '(To add that answer to the new study the card above holds instead, ' +
        `call owa_resource_file draft with \`file\` "${held.name}" and ` +
        `\`append\` "${STUDY_ANSWER_MARKER}".)`
    );
}

/**
 * A draft's arguments with the answer above in place of whatever the model
 * wrote (EC-466): a new study's `content`, or -- with `file`, a study file
 * being changed -- words added at its end (or at the end of `section`),
 * never its whole text replaced. Added at the end with no `section`, an
 * answer that opens on no heading of its own goes under one (EC-704): its
 * own `#` title a level down, else the question it answered. Seen live,
 * an answer on what "begotten" means, added to a John 3:16 study, read as
 * one more paragraph of its last part, Questions for Discussion.
 */
export function toKeptAnswerDraftArgs(
    args: any,
    answer: string,
    question: string | null = null,
) {
    const kept = toStudyContentFromAnswer(answer);
    // A replace or a removal beside a kept answer is not what was asked:
    // the answer goes in whole (EC-537, EC-543).
    const {
        content: _content,
        append: _append,
        replace: _replace,
        remove: _remove,
        section,
        ...rest
    } = args ?? {};
    if (typeof rest.file === 'string' && rest.file !== '') {
        const isInSection = typeof section === 'string' && section !== '';
        const heading = isInSection
            ? null
            : toKeptAnswerHeading(answer, kept, question, rest.file);
        return {
            ...rest,
            ...(isInSection ? { section } : {}),
            append: heading === null ? kept : `## ${heading}\n\n${kept}`,
        };
    }
    return { ...rest, content: kept };
}

// A question too short or too long to stand as a heading: "why?", or a
// paragraph pasted in.
const MIN_KEPT_HEADING_LENGTH = 8;
const MAX_KEPT_HEADING_LENGTH = 100;

/**
 * The words a kept answer added at a study's end is headed with (EC-704):
 * none when it opens on a heading of its own (`kept`, the words as added),
 * its `#` title when it had one (`toStudyContentFromAnswer` leaves that to
 * a new study's file) and that is not the title of the study it goes into
 * (`studyFile`, its name), else the question it answered -- the line they
 * typed (a reply's quote left out), a `/btw` in front and the marks a
 * heading would misread taken off, first letter a capital --
 * when that is a heading's length. Null otherwise: the answer goes in as
 * it did.
 */
export function toKeptAnswerHeading(
    answer: string,
    kept: string,
    question: string | null,
    studyFile: string | null = null,
) {
    if (/^#{1,6}\s/.test(kept)) {
        return null;
    }
    const title = toHeadingWords(
        /^#\s+(.+)$/.exec(
            String(answer ?? '')
                .replace(/\r\n?/g, '\n')
                .trim()
                .split('\n')[0] ?? '',
        )?.[1] ?? '',
    );
    // The study's own title again at its end would say nothing.
    const isStudyTitle =
        title.toLowerCase() === toStudyFileTitle(studyFile).toLowerCase();
    const words =
        title === '' || isStudyTitle
            ? toHeadingWords(toQuestionLine(question))
            : title;
    if (
        words.startsWith('/') ||
        words.endsWith(':') ||
        words.length < MIN_KEPT_HEADING_LENGTH ||
        words.length > MAX_KEPT_HEADING_LENGTH
    ) {
        return null;
    }
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function toHeadingWords(line: string) {
    return line
        .replace(/^\/btw\b/i, '')
        .replace(/\*\*|__|`/g, '')
        .replace(/^[\s#>*+_~-]+/, '')
        .replace(/[*_~]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// `Default/JHN.3.16 God So Loved (1).md` reads `God So Loved`; '' for none.
function toStudyFileTitle(file: string | null) {
    const fileName =
        String(file ?? '')
            .split('/')
            .pop() ?? '';
    return toHeadingWords(
        (readStudyFileName(fileName)?.title ?? '').replace(/\s*\(\d+\)$/, ''),
    );
}

/**
 * The line of a question that says what it asked: the first one typed, a
 * quote left out -- its `> ` lines and the frame over them
 * (`toAnswerQuoteText`'s _Replying to your answer:_), which goes under what
 * the box held, so the words may be above it or below. '' for none.
 */
function toQuestionLine(question: string | null) {
    const lines = String(question ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => {
            return line.trim();
        })
        .filter((line) => {
            return line !== '';
        });
    const own = lines.filter((line, index) => {
        return (
            !line.startsWith('>') &&
            !(line.endsWith(':') && (lines[index + 1] ?? '').startsWith('>'))
        );
    });
    return own[0] ?? '';
}

/**
 * The language a kept answer's passage is quoted in (EC-466): the
 * answer's own -- the answer IS the study -- whatever the line asking to
 * keep it was typed in. Seen live: "save that as a study file" typed in
 * English under a Khmer answer quoted John 3:16 from an English Bible over
 * the Khmer words. The typed line's language when the answer's cannot be
 * told, or is no language here.
 */
export function pickKeptAnswerLanguage(
    answer: string,
    typedLangCode: string,
    appLangCode?: string,
) {
    const answerLangCode = detectTypedLanguage(answer, appLangCode);
    return answerLangCode === null || answerLangCode === OTHER_CHAT_LANG_CODE
        ? typedLangCode
        : answerLangCode;
}

/**
 * What the model sees in place of the held draft when the window put in the
 * answer above (EC-466): what it wrote is not what is held, so it says only
 * that the answer is kept -- a reply naming the diagrams it drew had
 * described a study nobody would save.
 */
export const STUDY_KEPT_ANSWER_NOTE =
    'Nothing is saved yet. The window put in your answer above, word for ' +
    'word, as the study -- not anything you wrote for it -- and shows it ' +
    'under your answer with New Bible Note, Create in Resources, Create in ' +
    'Bible Notes, Preview and Change the name. Say in one sentence that ' +
    'their answer is ready and tell them to press New Bible Note to keep ' +
    'it as a Bible note, or Create where they want it kept as a Markdown ' +
    'file; name no section or diagram, never paste it.';

export const STUDY_KEPT_ANSWER_CHANGE_NOTE =
    'Nothing is saved yet. The window added your answer above, word for ' +
    'word, to the study file -- not anything you wrote for it -- and shows ' +
    'the change under your answer with Save changes and Preview. Say in one ' +
    'sentence that their answer is added and tell them to press Save ' +
    'changes to write it; never paste it.';

/**
 * The same when the answer went into the new study a card above holds
 * (EC-701): its card is a new study's, with its Create buttons, not a
 * change's Save changes.
 */
export const STUDY_KEPT_ANSWER_HELD_NOTE =
    'Nothing is saved yet. The window added your answer above, word for ' +
    'word, to the new study the card holds -- not anything you wrote for ' +
    'it -- and shows that study under your answer with New Bible Note, ' +
    'Create in Resources, Create in Bible Notes, Preview and Change the ' +
    'name. Say in one sentence that their answer is added and tell them to ' +
    'press New Bible Note to keep it as a Bible note, or Create where they ' +
    'want it kept as a Markdown file; never paste it.';

/** The same when they PRESSED for a Markdown file: no New Bible Note. */
export const STUDY_KEPT_ANSWER_HELD_MARKDOWN_NOTE =
    'Nothing is saved yet. The window added your answer above, word for ' +
    'word, to the new study the card holds -- not anything you wrote for ' +
    'it -- and shows that study under your answer with Create in ' +
    'Resources, Create in Bible Notes, Preview and Change the name. Say in ' +
    'one sentence that their answer is added and tell them to press Create ' +
    'where they want it kept; never paste it.';

/** Whether a model's `content` or `append` is the answer above. */
export function checkIsStudyAnswerMarker(value: unknown) {
    if (typeof value !== 'string') {
        return false;
    }
    return (
        value
            .trim()
            .replace(/^["'`]+|["'`]+$/g, '')
            .trim()
            .toLowerCase() === STUDY_ANSWER_MARKER
    );
}

// A code block or a diagram: a `#` inside one is no heading.
const ANSWER_FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
// The offer a chat answer ends on, which a study file does not: "Would you
// like me to …?". English only -- another language's stays.
const ANSWER_OFFER_PATTERN =
    /^(?:would you like|do you want me|shall i|should i|want me to|let me know if|if you(?:'d| would) like|i can also|feel free to)\b/i;
const MAX_OFFER_LENGTH = 240;

/**
 * An answer as a study file's body (EC-466): its own `#` title left to the
 * file's, every other `#` heading a level down -- a study has ONE `#` title,
 * which `splitStudyTranslations` finds its translations by -- and the offer
 * it ended on, a paragraph of its own, taken off. Nothing else is touched.
 */
export function toStudyContentFromAnswer(text: string) {
    const lines = String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .trim()
        .split('\n');
    if (lines.length > 0 && /^#\s/.test(lines[0])) {
        lines.shift();
    }
    const outLines: string[] = [];
    let fence: string | null = null;
    for (const line of lines) {
        const match = ANSWER_FENCE_PATTERN.exec(line);
        if (match !== null) {
            const mark = match[1][0];
            if (fence === null) {
                fence = mark;
            } else if (fence === mark) {
                fence = null;
            }
            outLines.push(line);
            continue;
        }
        outLines.push(fence === null && /^#\s/.test(line) ? `#${line}` : line);
    }
    while (outLines.length > 0 && outLines[outLines.length - 1].trim() === '') {
        outLines.pop();
    }
    const lastLine = (outLines[outLines.length - 1] ?? '').trim();
    if (
        fence === null &&
        outLines.length > 2 &&
        outLines[outLines.length - 2].trim() === '' &&
        lastLine.length <= MAX_OFFER_LENGTH &&
        ANSWER_OFFER_PATTERN.test(lastLine)
    ) {
        outLines.pop();
    }
    return outLines.join('\n').trim();
}

// --- the study a tab has open (2026-11-11, EC-499) ---------------------------
//
// Asked to "fix them in the study file" -- the references a verse check had
// found wrong in the study the tab was opened on -- gemma4:cloud drafted the
// WHOLE study four times with no `file` and no `ref`, written from the first
// 16 KB the tab is shown of a 44 KB file. The tool read each one as a NEW
// study with no passage and refused it, 128k tokens went, and the answer
// said the references were fixed. Nothing had changed.

/**
 * The study files a Resources tab has open, named as `draft` takes them --
 * `Default/<name>.md` and, kept in the Bible Notes list (EC-509),
 * `Bible Notes/<name>.md`: the only files a change can be drafted for.
 */
export function findOpenStudyFiles(openFiles: readonly string[]) {
    const prefixList = [STUDY_FOLDER_NAME, STUDY_BIBLE_NOTES_LABEL].map(
        (label) => {
            return `${label}/`.toLowerCase();
        },
    );
    return openFiles.filter((name) => {
        const lower = String(name ?? '').toLowerCase();
        return prefixList.some((prefix) => {
            return (
                lower.startsWith(prefix) &&
                lower.endsWith(STUDY_FILE_EXTENSION) &&
                !lower.slice(prefix.length).includes('/')
            );
        });
    });
}

/** A draft writing words anew where they stand (`replace`, EC-537). */
export function checkHasStudyReplace(args: any) {
    return Array.isArray(args?.replace) && args.replace.length > 0;
}

/**
 * `replace` as a model may write it -- the list as JSON text, or one pair
 * alone -- made the list the tool takes (EC-537); anything else is left
 * for the tool to refuse.
 */
export function toStudyReplaceArgs(args: any) {
    let replace = args?.replace;
    if (typeof replace === 'string') {
        replace = parseJson(replace) ?? replace;
    }
    if (
        replace !== null &&
        typeof replace === 'object' &&
        !Array.isArray(replace) &&
        'from' in replace
    ) {
        replace = [replace];
    }
    return replace === args?.replace ? args : { ...args, replace };
}

function checkIsStudyPartEdit(args: any) {
    return (
        toText(args?.section).trim() !== '' ||
        toText(args?.append).trim() !== '' ||
        checkHasStudyReplace(args) ||
        args?.remove === true
    );
}

/**
 * A model's draft that names no `file` and no `ref` while the tab has a
 * study open: a part of it (`section`, `append`) goes to the one open; the
 * whole study written again is refused (`genOpenStudyDraftRefusal`) -- a
 * long file is shown in part, and the part not shown would be lost. Null
 * when the call names a file or a passage, or no study is open.
 */
export function routeOpenStudyDraft(
    args: any,
    openStudyFiles: readonly string[],
): { args: any } | { isRefused: true } | null {
    if (
        openStudyFiles.length === 0 ||
        toText(args?.file).trim() !== '' ||
        toText(args?.ref).trim() !== ''
    ) {
        return null;
    }
    if (openStudyFiles.length === 1 && checkIsStudyPartEdit(args)) {
        return { args: { ...args, file: openStudyFiles[0] } };
    }
    return { isRefused: true };
}

/** What the model is told when it drafts no file and no passage. */
export function genOpenStudyDraftRefusal(
    openStudyFiles: readonly string[],
    outline = '',
) {
    const names = openStudyFiles
        .map((name) => {
            return `"${name}"`;
        })
        .join(' or ');
    return (
        'No `file` and no `ref`. To change the study open in this chat, ' +
        `call draft with \`file\` ${names} and \`section\` (one of its ` +
        'headings, as it reads) with `content` (the new words of that part ' +
        'alone), one call a part, or `append` (words added at its end), or ' +
        '`replace` (each `from` as the file writes it, and its `to`), or ' +
        '`remove` true (that part taken out). ' +
        'Never write the whole study again to change a part of it: a long ' +
        'file is shown only in part, and the rest would be lost. To see a ' +
        'part first, call read with `file` and `section`. Until a draft ' +
        'goes through, nothing in the file has changed: never say it was ' +
        'changed or fixed. A NEW study needs `ref` (its passage) and a ' +
        '`title`.' +
        (outline === '' ? '' : ` ${STUDY_HEADINGS_LEAD}\n${outline}`)
    );
}

/**
 * A study file a model named by its file name alone, or under the OTHER
 * study folder, while the tab has ONE study of that name open: the open
 * one (2026-11-14, EC-706). The user's Psalm 100 study was in Bible Notes,
 * attached to the tab, and a copy of the same name was in Resources →
 * Default; the window's card names the file without its folder, GPT-5
 * called `translate` by that name, and the tool reads a bare name as
 * Default's. The Resources copy was translated and saved twice, and every
 * ask after was told the study was all Khmer already, the attached one
 * still English. A whole path is named on purpose and stays; so does a
 * name two open studies share, and the new study a card holds, which a
 * call names by its file name too (`findHeldNewStudy`).
 */
export function pinOpenStudyFile(
    args: any,
    openStudyFiles: readonly string[],
    heldDraft: Omit<DraftedStudyType, 'reference'> | null = null,
) {
    const file = toText(args?.file).trim();
    if (file === '' || openStudyFiles.length === 0) {
        return args;
    }
    const parts = file.replaceAll('\\', '/').split('/').filter(Boolean);
    const folder = parts.length === 2 ? parts[0].toLowerCase() : null;
    if (
        parts.length > 2 ||
        (folder !== null &&
            folder !== STUDY_FOLDER_NAME.toLowerCase() &&
            folder !== STUDY_BIBLE_NOTES_LABEL.toLowerCase())
    ) {
        return args;
    }
    const key = toStudyFileKey(file);
    const sameNameList = findOpenStudyFiles(openStudyFiles).filter((name) => {
        return toStudyFileKey(name) === key;
    });
    if (
        sameNameList.length !== 1 ||
        sameNameList[0].toLowerCase() === parts.join('/').toLowerCase() ||
        findHeldNewStudy(file, heldDraft, openStudyFiles) !== null
    ) {
        return args;
    }
    return { ...args, file: sameNameList[0] };
}

export type StudyReadShapeType = { outline: string; isShownWhole: boolean };

/**
 * What a `read` of a study file shows of it: its headings -- the list a
 * long file's note gives (`STUDY_HEADINGS_LEAD`), or those of the text read
 * whole -- and whether the read holds it whole (a long file's says it does
 * not, in its note). Null for anything else.
 */
export function toStudyReadShape(readText: string): StudyReadShapeType | null {
    const result = parseJson(String(readText ?? ''));
    if (result === null || typeof result.text !== 'string') {
        return null;
    }
    const note = toText(result.note);
    const at = note.indexOf(STUDY_HEADINGS_LEAD);
    return {
        outline:
            at >= 0
                ? note.slice(at + STUDY_HEADINGS_LEAD.length).trim()
                : toStudyOutline(result.text),
        isShownWhole: note === '',
    };
}

function toStudyFileKey(file: string) {
    return (
        file.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? ''
    ).toLowerCase();
}

/**
 * A part of a study whose change the window already holds, drafted in the
 * same ask: applied to the HELD change, and the whole of it drafted again.
 * `draft` reads the file off the disk each call, so the English Cross
 * References and then the Khmer had left only the Khmer changed. Null when
 * the call is no part of that file; why not, when the part cannot be found.
 */
export function chainStudyPartEdit(
    args: any,
    held: Omit<DraftedStudyType, 'reference'> | null,
):
    | {
          args: any;
          writtenText?: string;
          noteText?: string;
          changeText?: string;
      }
    | { reason: string }
    | null {
    if (
        held === null ||
        !held.isChange ||
        held.file === null ||
        !checkIsStudyPartEdit(args) ||
        toStudyFileKey(toText(args?.file)) !== toStudyFileKey(held.file)
    ) {
        return null;
    }
    const {
        section: _section,
        append: _append,
        content: _content,
        replace: _replace,
        remove: _remove,
        ...rest
    } = args;
    // A part taken out of the held change (EC-543).
    if (args.remove === true) {
        if (
            toText(args.content).trim() !== '' ||
            toText(args.append).trim() !== '' ||
            checkHasStudyReplace(args)
        ) {
            return { reason: STUDY_REMOVE_ALONE_REASON };
        }
        const removed = applyStudyRemove(held.content, toText(args.section));
        if ('reason' in removed) {
            return removed;
        }
        return { args: { ...rest, file: held.file, content: removed.text } };
    }
    if (checkHasStudyReplace(args)) {
        return chainStudyReplace(args, held, rest);
    }
    const edited = applyStudyEdit(held.content, {
        section: toText(args.section),
        content: separateStudyLines(toText(args.content)),
        append: separateStudyLines(toText(args.append)),
    });
    if ('reason' in edited) {
        return edited;
    }
    return {
        args: { ...rest, file: held.file, content: edited.text },
        noteText: describeStudyEditKept(edited),
    };
}

/**
 * Words written anew in the held change (EC-537), drafted as its whole
 * text, with `writtenText` holding the diagrams those words changed --
 * the only ones the window parses -- `noteText` what the study's name
 * check put right of the pairs (EC-541), as the tool says it, and
 * `changeText` what the pairs write, as the tool says that (EC-604).
 */
function chainStudyReplace(
    args: any,
    held: Omit<DraftedStudyType, 'reference'>,
    rest: any,
):
    | { args: any; writtenText: string; noteText: string; changeText: string }
    | { reason: string } {
    if (
        toText(args.content).trim() !== '' ||
        toText(args.append).trim() !== ''
    ) {
        return { reason: STUDY_REPLACE_ALONE_REASON };
    }
    const replaced = applyStudyReplaceChecked(
        held.content,
        args.replace,
        toText(args.section),
    );
    if ('reason' in replaced) {
        return replaced;
    }
    const { diagrams } = lintStudyContent(replaced.text, Infinity);
    const writtenText = listChangedStudyDiagrams(held.content, replaced.text)
        .map((index) => {
            return `\`\`\`mermaid\n${diagrams[index]}\n\`\`\``;
        })
        .join('\n\n');
    return {
        args: { ...rest, file: held.file, content: replaced.text },
        writtenText,
        noteText: describeStudyReplaceRepair(replaced.repaired),
        changeText: describeStudyReplace(replaced.replaced),
    };
}

/**
 * The file's own diagrams a `replace` draft changed (`diagramsChanged`,
 * EC-537), by their places in the drafted file; null for any other draft.
 */
export function readStudyReplacedDiagrams(text: string): number[] | null {
    const result = parseJson(String(text ?? ''));
    if (!Array.isArray(result?.diagramsChanged)) {
        return null;
    }
    return result.diagramsChanged.filter((index: unknown) => {
        return Number.isInteger(index) && (index as number) >= 0;
    });
}

/**
 * What the model is told when words it wrote anew leave a diagram of the
 * file that no longer draws: the diagram is the person's, so it is never
 * dropped -- the change is refused, naming it by its place in the file.
 */
export function genStudyReplaceDiagramRefusal(
    failed: readonly { index: number; error: string }[],
) {
    return (
        failed
            .map(({ index, error }) => {
                return (
                    `Diagram ${index + 1} of the file would not draw with ` +
                    `these words in it: ${error}`
                );
            })
            .join(' ') +
        ' Nothing is changed: call draft again without the pair that ' +
        'changes it, or with a `to` the diagram can hold.'
    );
}

// --- a part of the NEW study the card holds (2026-11-13, EC-604) ------------
//
// A new study is held by the window until the person presses Create, so it
// has no file to change. EC-600 handed a model what a translation copy
// still left -- English words, a diagram's labels -- and could only say
// "put them right once it is created": a `draft` naming the new study's
// `file` was answered that no such file is saved, and the person had to
// save a copy with its slips first. A model that drafted a study and then
// wanted a part of it otherwise met the same wall. Now a part of the held
// study -- `section` with `content` or `remove`, `append`, `replace`, as a
// saved study's -- is changed in the held words by the same edits
// (`chainStudyPartEdit`), and the study is drafted again as a NEW one with
// its own `ref`: the passage the app quoted under its title is the app's,
// quoted again from its Bible, and the card is the same card with the
// change in it. `read` of it answers off the held words too.

/** What the model is told when a change would touch the passage. */
export const STUDY_HELD_PASSAGE_REASON =
    'The passage under the title is the app’s own: a new study quotes its ' +
    '`ref` there from the Bible, and it stays as it is. Name a heading of ' +
    'the study in `section`, or change words in it with `replace`; to ' +
    'study another passage, draft a new study with that `ref`.';

/** What the model is told when a change leaves the study no words. */
export const STUDY_HELD_EMPTY_REASON =
    'That leaves the study no words of its own under its passage: change ' +
    'a part of it instead.';

/** What the model is told when it sends a held new study whole again. */
export function genHeldStudyWholeRefusal(name: string) {
    return (
        `"${name}" is not saved yet: it is the new study the card under ` +
        'your answer holds. Change a part of it with this `file` and ' +
        '`section` (with `content`, or `remove` true), `append`, or ' +
        '`replace`; to write all of it again, call draft with `ref`, ' +
        '`title` and the whole study as `content`, and no `file`.'
    );
}

const HELD_STUDY_CHANGE_LEAD =
    'Changed in the new study the card holds, which is still not saved:';
const HELD_STUDY_UNSAVED_TEXT =
    'Not saved yet: the new study the card under your answer holds. ' +
    'Change it with draft and this `file`, as a saved study.';
// A read of a saved file is cut there too (`agentResourcesHelpers.ts`).
const HELD_STUDY_READ_MAX_CHARS = 16 * 1024;

/** A part of the held new study, ready to be drafted again (EC-604). */
export type HeldStudyEditType = {
    /** The new study's own draft: its passage, title and words. */
    args: {
        action: 'draft';
        ref: string;
        title: string;
        content: string;
        bible?: string;
    };
    /** The whole held study with the change made, as the chain made it. */
    whole: string;
    /** What the chain did that the tool cannot say (EC-541, EC-544). */
    noteText: string;
    /** What a replace writes, as the tool says it; null for the rest. */
    changeText: string | null;
    isReplace: boolean;
};

/**
 * The new study held as its parts: the `#` title's words, the passage
 * quoted under it (its `>` lines), and the words under that, without the
 * app's last lines. Null with no title.
 */
function readHeldStudyParts(text: string) {
    const lines = splitStudyFooter(text).body.split('\n');
    let at = 0;
    const skipBlankLines = () => {
        while (at < lines.length && lines[at].trim() === '') {
            at += 1;
        }
    };
    skipBlankLines();
    const title = /^#\s+(.+?)\s*#*\s*$/.exec(lines[at] ?? '');
    if (title === null) {
        return null;
    }
    at += 1;
    skipBlankLines();
    const passage: string[] = [];
    while (at < lines.length && /^\s{0,3}>/.test(lines[at])) {
        passage.push(lines[at].trim());
        at += 1;
    }
    return {
        title: title[1],
        passage,
        body: lines.slice(at).join('\n').trim(),
    };
}

/**
 * The held new study a call names -- by its `file`, never one a saved study
 * open in the tab is named by -- or null.
 */
function findHeldNewStudy(
    file: string,
    held: Omit<DraftedStudyType, 'reference'> | null,
    openStudyFiles: readonly string[],
) {
    if (
        held === null ||
        held.isChange ||
        held.raw === null ||
        held.note !== undefined ||
        held.raw.ref.trim() === ''
    ) {
        return null;
    }
    if (file === '') {
        return held;
    }
    const path = file.replaceAll('\\', '/').toLowerCase();
    if (
        openStudyFiles.some((name) => {
            return name.toLowerCase() === path;
        })
    ) {
        return null;
    }
    return toStudyFileKey(file) === toStudyFileKey(held.name) ? held : null;
}

/**
 * A `read` of the new study the card holds, answered off its words as a
 * read of a saved study is (`{file, kind, section?, text, note?}`), so a
 * part can be read before it is changed; null for any other read.
 */
export function readHeldNewStudy(
    args: any,
    heldDraft: Omit<DraftedStudyType, 'reference'> | null,
    openStudyFiles: readonly string[] = [],
) {
    const file = toText(args?.file).trim();
    const held =
        file === '' ? null : findHeldNewStudy(file, heldDraft, openStudyFiles);
    if (held === null) {
        return null;
    }
    const section = toText(args?.section).trim();
    if (section !== '') {
        const found = readStudySection(held.content, section);
        if ('reason' in found) {
            return `Tool refused: ${found.reason}`;
        }
        const isCut = found.text.length > HELD_STUDY_READ_MAX_CHARS;
        const outline = isCut ? toStudyOutline(found.text) : '';
        return JSON.stringify({
            file: held.name,
            kind: 'text',
            section: found.heading,
            text: found.text.slice(0, HELD_STUDY_READ_MAX_CHARS),
            ...(isCut
                ? {
                      note:
                          'Only the start of this section is here. Read a ' +
                          'heading inside it with `section`' +
                          (outline === '' ? '.' : `:\n${outline}`),
                  }
                : {}),
            held: HELD_STUDY_UNSAVED_TEXT,
        });
    }
    const text = held.content;
    const isCut = text.length > HELD_STUDY_READ_MAX_CHARS;
    const outline = isCut ? toStudyOutline(text) : '';
    return JSON.stringify({
        file: held.name,
        kind: 'text',
        text: text.slice(0, HELD_STUDY_READ_MAX_CHARS),
        ...(isCut
            ? {
                  note:
                      `Only the start of it is here: it is ${text.length} ` +
                      'characters. Read one part with `section` (one of its ' +
                      'headings); change it with `draft`, `file` and ' +
                      '`section`, or `append` -- never by writing back the ' +
                      'part read.' +
                      (outline === ''
                          ? ''
                          : ` ${STUDY_HEADINGS_LEAD}\n${outline}`),
              }
            : {}),
        held: HELD_STUDY_UNSAVED_TEXT,
    });
}

/**
 * A part of the new study the card holds, drafted in the same ask
 * (EC-604): the change made in the held words and the study's own draft
 * to make again. The call names the held study's `file`, or -- with no
 * study open in the tab to go to -- no `file` and no `ref`. Why not, when
 * the change cannot be made: the part is not there, the passage under the
 * title would change, the study written whole again, or a part of a study
 * the window wrote (a translation) that the model was not shown, with its
 * words (`shown`, kept by the caller, as EC-500's read is). Null for a call
 * that is about no held new study.
 */
export function chainHeldNewStudyEdit(
    args: any,
    heldDraft: Omit<DraftedStudyType, 'reference'> | null,
    openStudyFiles: readonly string[],
    shownBlocks: readonly StudyShownBlockType[] = [],
): HeldStudyEditType | { reason: string; shown?: StudyShownBlockType } | null {
    const file = toText(args?.file).trim();
    if (
        file === '' &&
        (toText(args?.ref).trim() !== '' || openStudyFiles.length > 0)
    ) {
        return null;
    }
    const held = findHeldNewStudy(file, heldDraft, openStudyFiles);
    if (held === null || held.raw === null) {
        return null;
    }
    if (!checkIsStudyPartEdit(args)) {
        return file === ''
            ? null
            : { reason: genHeldStudyWholeRefusal(held.name) };
    }
    // Words for a part the model never saw (EC-500): the part's own words
    // first, read off the held study -- one the window wrote, or one held
    // from an earlier answer (EC-606).
    const section = toText(args.section).trim();
    if (
        (held.isWindowMade === true || held.isFromEarlierAsk === true) &&
        section !== '' &&
        toText(args.content).trim() !== '' &&
        !checkIsStudyPartShown(shownBlocks, held.name, section)
    ) {
        const readText = readHeldNewStudy({ file: held.name, section }, held);
        const shown = readText === null ? null : toReadStudyBlock(readText);
        const refusal =
            readText === null
                ? null
                : genUnreadStudyPartRefusal(shownBlocks, held.name, readText);
        if (refusal !== null) {
            return shown === null
                ? { reason: refusal }
                : { reason: refusal, shown };
        }
    }
    const chained = chainStudyPartEdit(
        { ...args, file: held.name },
        { ...held, isChange: true, file: held.name },
    );
    if (chained === null || 'reason' in chained) {
        return chained;
    }
    const before = readHeldStudyParts(held.content);
    const after = readHeldStudyParts(toText(chained.args.content));
    if (before === null || after === null) {
        return {
            reason:
                'That takes out the study’s `#` title, which names the file. ' +
                'Change the words under it instead.',
        };
    }
    if (before.passage.join('\n') !== after.passage.join('\n')) {
        return { reason: STUDY_HELD_PASSAGE_REASON };
    }
    if (after.body === '') {
        return { reason: STUDY_HELD_EMPTY_REASON };
    }
    const bible = held.bible.trim() || (held.raw.bible ?? '');
    return {
        args: {
            action: 'draft',
            ref: held.raw.ref,
            title: after.title,
            content: after.body,
            ...(bible === '' ? {} : { bible }),
        },
        whole: toText(chained.args.content),
        noteText: chained.noteText ?? '',
        changeText: chained.changeText ?? null,
        isReplace: checkHasStudyReplace(args),
    };
}

/** What the model is told when a diagram a change wrote does not draw. */
function genHeldStudyDiagramRefusal(
    failed: readonly { index: number; error: string }[],
) {
    return (
        failed
            .map(({ index, error }) => {
                return (
                    `Diagram ${index + 1} of the study does not draw with ` +
                    `this change: ${error}`
                );
            })
            .join(' ') +
        ' Nothing is changed: the card holds the study as it was. Fix it ' +
        'and call draft again with the same change.'
    );
}

export type HeldStudyRedraftType = {
    /** What the model is shown. */
    text: string;
    /** The card's new draft; null when nothing changed. */
    drafted: Omit<DraftedStudyType, 'reference'> | null;
    /** A diagram was sent back to be fixed: the next failure drops it. */
    isDiagramRetry: boolean;
};

/**
 * The held new study drafted again with the change (`chainHeldNewStudyEdit`)
 * -- `callDraft` the tool's own `draft` -- and the diagrams the change
 * writes parsed (`parseDiagrams`, mermaid's own): the study's others drew
 * when it was first drafted. A replace that breaks one is refused, as in a
 * saved file; a part's or an append's is sent back once to be fixed and
 * left out after (`isDiagramRetried`), as in a first draft. The model is
 * shown the draft as a new one, and what changed in the held study.
 * `isAnswerKept`: the change is the answer above, put in by the window
 * (EC-701) -- no model's to fix, so a diagram of it that does not draw is
 * left out at once, as a kept answer's is in a first draft (EC-466), and
 * the model is told the answer was added, not what it wrote.
 */
export async function redraftHeldNewStudy(
    edit: HeldStudyEditType,
    held: Omit<DraftedStudyType, 'reference'>,
    tools: {
        callDraft: (args: HeldStudyEditType['args']) => Promise<string>;
        parseDiagrams: (sources: string[]) => Promise<(string | null)[]>;
    },
    isDiagramRetried: boolean,
    isAnswerKept = false,
): Promise<HeldStudyRedraftType> {
    const text = await tools.callDraft(edit.args);
    const drafted = readDraftedStudy(text, edit.args);
    if (drafted === null || drafted.isChange) {
        return {
            text:
                `${text}\n(Nothing is changed: the card holds the new study ` +
                'as it was.)',
            drafted: null,
            isDiagramRetry: false,
        };
    }
    const { diagrams } = lintStudyContent(drafted.content, Infinity);
    const changedList = listChangedStudyDiagrams(held.content, drafted.content);
    const errors =
        changedList.length === 0
            ? []
            : await tools.parseDiagrams(
                  changedList.map((index) => {
                      return diagrams[index];
                  }),
              );
    const failed = errors.flatMap((error, at) => {
        return typeof error === 'string'
            ? [{ index: changedList[at], error }]
            : [];
    });
    if (
        failed.length > 0 &&
        (edit.isReplace || (!isDiagramRetried && !isAnswerKept))
    ) {
        return {
            text: `Tool refused: ${
                edit.isReplace
                    ? genStudyReplaceDiagramRefusal(failed)
                    : genHeldStudyDiagramRefusal(failed)
            }`,
            drafted: null,
            isDiagramRetry: !edit.isReplace,
        };
    }
    let droppedText = '';
    if (failed.length > 0) {
        drafted.content = dropStudyDiagrams(
            drafted.content,
            failed.map(({ index }) => {
                return index;
            }),
        );
        drafted.diagramCount = lintStudyContent(
            drafted.content,
            Infinity,
        ).diagrams.length;
        droppedText =
            failed.length === 1
                ? 'A diagram the change wrote did not draw again and was ' +
                  'left out.'
                : `${failed.length} diagrams the change wrote did not draw ` +
                  'again and were left out.';
    }
    if (held.isMarkdownOnly === true) {
        drafted.isMarkdownOnly = true;
    }
    if (held.isWindowMade === true) {
        drafted.isWindowMade = true;
    }
    if (held.isFromEarlierAsk === true) {
        drafted.isFromEarlierAsk = true;
    }
    const said =
        edit.changeText !== null && drafted.content === edit.whole
            ? edit.changeText
            : describeStudyChange(
                  summarizeStudyChange(held.content, drafted.content),
              );
    const noteText = [
        `${HELD_STUDY_CHANGE_LEAD} ${said}`,
        edit.noteText,
        droppedText,
    ]
        .filter((sentence) => {
            return sentence !== '';
        })
        .join(' ');
    const shown = JSON.stringify({
        ...parseJson(text),
        diagramCount: drafted.diagramCount,
        content: drafted.content,
    });
    const modelText = toModelDraftText(
        shown,
        false,
        noteText,
        drafted.isMarkdownOnly === true,
    );
    const modelResult = isAnswerKept ? parseJson(modelText) : null;
    return {
        text:
            modelResult === null
                ? modelText
                : JSON.stringify({
                      ...modelResult,
                      note:
                          drafted.isMarkdownOnly === true
                              ? STUDY_KEPT_ANSWER_HELD_MARKDOWN_NOTE
                              : STUDY_KEPT_ANSWER_HELD_NOTE,
                  }),
        drafted,
        isDiagramRetry: false,
    };
}

// --- the new study the card ABOVE holds, asked of later (2026-11-13, EC-606)
//
// A held new study was reached only by its card's buttons and in the ask
// that drafted it (EC-604): a line typed under the card -- "change its
// title", "add a prayer at the end" -- was a new ask, which holds no study,
// is offered no study tool in an ordinary tab, and could only be answered
// that no such file is saved. Now the card right above the question hands
// its study to the ask: the study tool is offered with its name and
// headings, a part of it is changed as one the ask drafted is -- into a
// card of its own under the answer -- and a read of it, or a refusal,
// brings the same card back under the answer.

/** The tool a study is drafted with, as `RESOURCES_TOOL_NAME` names it. */
const STUDY_DRAFT_TOOL_NAME = 'owa_resource_file';

/**
 * A card's new study held for a later ask (EC-606), or null for one EC-604
 * changes nothing of either: a change to a saved file, a draft naming no
 * passage, one holding the model's note as its twin.
 */
export function toHeldStudyBefore(
    held: DraftedStudyType | null | undefined,
): DraftedStudyType | null {
    if (
        held === null ||
        held === undefined ||
        held.isChange ||
        held.raw === null ||
        held.raw.ref.trim() === '' ||
        held.note !== undefined
    ) {
        return null;
    }
    return { ...held, isFromEarlierAsk: true };
}

/**
 * The most plain answers a card's new study may have under it and still be
 * reached (EC-701): _what does verse 5 mean?_ asked between the card and
 * _add that to the study_. A third, and the card is far up the chat.
 */
const MAX_HELD_STUDY_ANSWERS_BETWEEN = 2;

/**
 * An answer of words alone (EC-701): no button, no chip, no picture asked
 * for. One that did anything else -- the card's own "Saved as" line, a
 * passage put up, a note made -- ends the chain.
 */
function checkIsPlainAnswer(message: ChatMessageType) {
    return (
        (message.actions ?? []).length === 0 &&
        (message.shows ?? []).length === 0 &&
        (message.attachRequests ?? []).length === 0
    );
}

/**
 * The new study a card above an ask holds (EC-606): the tab's newest answer
 * -- the window's follow-up to a thumb down stepped over -- when its buttons
 * are a new study's card still held, else null. Up to two plain answers
 * may stand between it and the ask (EC-701), counted on the study as
 * `answersBetween`: a question asked about it, answered in words, had ended
 * the chain. So may what stood for an answer when the assistant failed
 * (`isAskFailed`, EC-702), whatever its buttons -- the doors to what went
 * wrong and the guide's stand-in: the line typed again after it had reached
 * no study. One created since is not: its "Saved as" line stands under the
 * card, with its buttons, and so does any answer that did something. Only
 * what is above `beforeId` is looked at: a Retry's question.
 */
export function findHeldStudyAbove(
    messages: readonly ChatMessageType[],
    options: { beforeId?: number } = {},
): DraftedStudyType | null {
    const beforeIndex =
        options.beforeId === undefined
            ? -1
            : messages.findIndex((message) => {
                  return message.id === options.beforeId;
              });
    const lastIndex = beforeIndex < 0 ? messages.length - 1 : beforeIndex - 1;
    let answersBetween = 0;
    for (let index = lastIndex; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.author !== 'bot' || message.isFollowUp === true) {
            continue;
        }
        const reference = (message.actions ?? []).find((action) => {
            return action.toolName === STUDY_CREATE_TOOL_NAME;
        })?.args?.reference;
        if (typeof reference === 'string') {
            const held = toHeldStudyBefore(takeDraftedStudy(reference));
            if (held === null) {
                return null;
            }
            // Counted here alone: a card held again (`genHeldStudyBeforeActions`)
            // keeps the count it was reached with.
            const { answersBetween: _counted, ...study } = held;
            return answersBetween === 0 ? study : { ...study, answersBetween };
        }
        if (
            (!checkIsPlainAnswer(message) && message.isAskFailed !== true) ||
            answersBetween >= MAX_HELD_STUDY_ANSWERS_BETWEEN
        ) {
            return null;
        }
        answersBetween += 1;
    }
    return null;
}

/**
 * That study's card under the answer again (EC-606), when the ask read it
 * or was refused a change to it: the same draft and buttons while the
 * window still holds it, else held again -- so the next line reaches it.
 */
export function genHeldStudyBeforeActions(held: DraftedStudyType) {
    return genStudyDraftActions(
        takeDraftedStudy(held.reference) ?? keepDraftedStudy(held),
    );
}

/**
 * An ordinary ask's tools with the study tool from the host's list, when
 * the card above holds a new study (EC-606): changing it takes
 * `owa_resource_file`, which only a study, Resources, lookup or Bible
 * Reader ask is offered otherwise (`MODEL_ON_ASK_TOOL_MAP`).
 */
export function withHeldStudyTool<T extends { name: string }>(
    list: T[],
    tools: readonly T[],
    held: object | null,
): T[] {
    if (
        held === null ||
        list.some((tool) => {
            return tool.name === STUDY_DRAFT_TOOL_NAME;
        })
    ) {
        return list;
    }
    const tool = tools.find((item) => {
        return item.name === STUDY_DRAFT_TOOL_NAME;
    });
    return tool === undefined ? list : [...list, tool];
}

/**
 * Said on an ask under such a card (EC-606): the study it holds, its
 * headings and how a change reaches it -- by its name, as a saved study's
 * does. Told nothing, a model had no file to name. And that a translation
 * of it is the window's (EC-609): told only how a change is drafted, a
 * model asked to put it into another language would write its own. And
 * that a question about its passage is answered (EC-703): _What does the
 * word begotten mean in this verse?_ under a John 3:16 study's card was
 * told the guide covers this app only and to type `/btw` -- the prompt's
 * rule for a word's meaning -- and that answer's button then cut the card
 * off from the line typed next.
 */
export function genHeldStudyAskHint(held: Omit<DraftedStudyType, 'reference'>) {
    const outline = toStudyOutline(splitStudyFooter(held.content).body);
    // Further up when a question was answered in words since (EC-701).
    const lead =
        (held.answersBetween ?? 0) > 0
            ? '(A card further up this chat, above your last answer, still ' +
              'holds a NEW study file, not saved yet: '
            : '(The card under your last answer holds a NEW study file, not ' +
              'saved yet: ';
    return (
        `${lead}"${held.name}"` +
        (held.passage === '' ? '' : `, on ${held.passage}`) +
        '. When they ask to change it, call owa_resource_file draft with ' +
        'this `file`: `section` (a heading as it reads) with `content` -- ' +
        'that part read first, `read` with this `file` and `section` -- or ' +
        'with `remove` true; `append` for words at its end; `replace` for ' +
        'words where they stand. The change goes into a new card. To put it ' +
        'into another language, call owa_resource_file translate with this ' +
        '`file`, `language` and `place`: the window translates it, never ' +
        'you. To write it all again, draft with `ref` ' +
        `"${held.raw?.ref ?? ''}", a \`title\` and no \`file\`. Never tell ` +
        'them to change it by hand or to save it before it can be changed. ' +
        'A question about its passage -- what a word means, who someone ' +
        'is, the background -- is part of this study, not a question ' +
        'outside the app: answer it yourself in plain words (the passage ' +
        'as the study quotes it is `read` with this `file`), never telling ' +
        'them to type /btw, and change nothing in it for a question.' +
        (outline === '' ? ')' : ` Its headings:\n${outline})`)
    );
}

// --- a new study not saved yet, translated (2026-11-14, EC-609) -----------
//
// A `translate` of the new study a card holds was refused (EC-606): a study
// was translated from its saved file, so asked to put the study it had just
// drafted into another language the window could only say to press Create
// and ask again -- a file kept in a language that was never wanted, or
// kept to be translated over. Now the held words go to the app's planner
// in place of a file, are translated part by part as a saved study's are,
// and the result is drafted as a NEW study into a card of its own.

/**
 * The new study a `translate` names that the window holds, not saved yet
 * -- the one this ask drafted, or the card above the ask's (EC-606): by its
 * `file`, or by no `file` while no saved study is open in the tab. Null
 * for a call about another file.
 */
export function findHeldStudyToTranslate(
    args: any,
    heldDraft: Omit<DraftedStudyType, 'reference'> | null,
    openStudyFiles: readonly string[],
) {
    const file = toText(args?.file).trim();
    if (file === '' && openStudyFiles.length > 0) {
        return null;
    }
    return findHeldNewStudy(file, heldDraft, openStudyFiles);
}

/** What `translate` plans a held new study from: its words, by its name. */
export function toHeldStudyTranslatePlanArgs(
    held: Omit<DraftedStudyType, 'reference'>,
    bible: string | null,
) {
    return {
        action: 'translate',
        name: held.name,
        content: held.content,
        ...(bible === null ? {} : { bible }),
    };
}

/**
 * The `draft` that holds a held new study translated (EC-609), as a NEW
 * study with the study's own `ref` -- it has no file to change, and the
 * app quotes its passage again: added after it, the study with its
 * translation after it (one already in that language giving its place,
 * EC-547), its passage from the study's Bible; in its place, the study in
 * the language alone; a copy, the translation alone. Those two quote the
 * passage from the Bible in that language, else the study's.
 */
export function toHeldStudyTranslateDraftArgs(
    held: Omit<DraftedStudyType, 'reference'>,
    translation: {
        plan: StudyTranslatePlanType;
        body: string;
        place: StudyTranslatePlaceType;
        language: StudyTranslateLanguageType;
        taken: readonly number[];
    },
): HeldStudyEditType['args'] | { reason: string } {
    const { plan, body, place, language, taken } = translation;
    const ref = held.raw?.ref.trim() ?? '';
    const heldBible = held.bible.trim() || (held.raw?.bible ?? '');
    const bible = place === 'append' ? heldBible : (plan.bible ?? heldBible);
    const saved = toStudyTranslateDraftArgs(
        { ...plan, file: held.name, ref },
        body,
        place,
        language,
        taken,
    );
    if ('reason' in saved) {
        return { reason: saved.reason };
    }
    // A copy is drafted as a new study already; the study added to, or in
    // the language in place of its words, is read as its parts again.
    const parts =
        place === 'new'
            ? { title: saved.title ?? '', body: saved.content ?? '' }
            : readHeldStudyParts(
                  typeof saved.append === 'string'
                      ? `${splitStudyFooter(held.content).body.trimEnd()}` +
                            `\n\n${saved.append}`
                      : (saved.content ?? ''),
              );
    const title = parts?.title.slice(0, STUDY_TITLE_MAX_CHARS).trim() ?? '';
    if (ref === '' || parts === null || title === '' || parts.body === '') {
        return {
            reason:
                `The translation of "${held.name}" left it no title or no ` +
                'words to draft as a new study, so nothing was drafted.',
        };
    }
    return {
        action: 'draft',
        ref,
        title,
        content: parts.body,
        ...(bible === '' ? {} : { bible }),
    };
}

/**
 * Why a held new study is not translated as asked (EC-609), before any part
 * is: a copy of one this same answer drafted -- an answer holds one card,
 * so the copy would take the study itself out. Null for any other.
 */
export function genHeldStudyCopyRefusal(
    held: Omit<DraftedStudyType, 'reference'>,
    place: StudyTranslatePlaceType,
    isDraftedInAsk: boolean,
) {
    if (place !== 'new' || !isDraftedInAsk) {
        return null;
    }
    return (
        `"${held.name}" was drafted in this answer and is not saved yet, ` +
        'and an answer holds one card: a copy of its own would take the ' +
        'study out. Translate it with place "append" -- one new study ' +
        'holding both -- or "replace", or tell them to press Create first ' +
        'and then ask for the copy.'
    );
}

/** What the model is told of a held new study once translated (EC-609). */
export function genHeldStudyTranslatedNote(
    name: string,
    place: StudyTranslatePlaceType,
) {
    return (
        `"${name}" is a new study not saved yet, so no file changed: the ` +
        'card under your answer holds ' +
        (place === 'append'
            ? 'it again as a new study, its translation after it'
            : place === 'replace'
              ? 'it again as a new study, translated in place of its words'
              : 'the translation as a new study of its own, and the card ' +
                'it was drafted under still holds the study') +
        '. Nothing is kept until they press Create.'
    );
}

// --- the language a change to a study is written in (2026-11-13, EC-608) --
//
// Words put into a study are in the language of the part they go into.
// Asked in another language of a model that is not a Gemma 4, a question
// reaches the model in ENGLISH (`chatTranslateHelpers.ts`), and nothing said
// what the study is written in: "add a prayer at the end", typed under a
// study written in that language, could come back as an English prayer in
// it, and a new title they typed as its English. A Gemma 4 asked in their
// language had nothing saying an English study takes English. A note's
// conversation carries their words for the same reason (BN-23).

/** A study's halves read for their language: as written, then five more. */
const STUDY_LANGUAGE_HALF_MAX = 6;

/**
 * The language each half of a study is written in -- the study as written,
 * then each translation added after it, six at most -- read off its own
 * words (`toStudyLanguageSample`) as a typed line is (`readLanguage`): a
 * language's code, `other` for one none here names, null where its words
 * cannot say.
 */
export function readStudyHalfLanguages(
    text: string,
    appLangCode: string,
    readLanguage: (
        sample: string,
        appLangCode: string,
    ) => string | null = detectTypedLanguage,
) {
    const { body } = splitStudyFooter(
        String(text ?? '').replace(/\r\n?/g, '\n'),
    );
    const { original, translations } = splitStudyTranslations(body);
    return [
        original,
        ...listStudyTranslations(translations, STUDY_LANGUAGE_HALF_MAX - 1),
    ].map((half) => {
        return readLanguage(toStudyLanguageSample(half), appLangCode);
    });
}

/**
 * The name `draft` takes of the study file at `filePath` when it is one a
 * change can be drafted for (`findOpenStudyFiles`) among the tab's open
 * Resources names: the one of its own base name, else null.
 */
export function findOpenStudyFileName(
    filePath: string,
    resourceFileNames: readonly string[],
) {
    const toBaseKey = (path: string) => {
        return (
            String(path ?? '')
                .split(/[\\/]/)
                .pop() ?? ''
        ).toLowerCase();
    };
    const baseKey = toBaseKey(filePath);
    if (baseKey === '') {
        return null;
    }
    return (
        findOpenStudyFiles(resourceFileNames).find((name) => {
            return toBaseKey(name) === baseKey;
        }) ?? null
    );
}

/** What they typed, when the model is asked its English. */
export type StudyOwnWordsType = {
    // The language's English name.
    language: string;
    text: string;
};

/** A language's English name by its code; null for `other`. */
function toStudyLanguageName(code: string) {
    return code === OTHER_CHAT_LANG_CODE
        ? null
        : getAssistantLanguage(code).name;
}

function joinStudyLanguageNames(names: readonly string[]) {
    return names.length < 2
        ? (names[0] ?? '')
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function toStudyLanguageLine(
    name: string,
    halfLanguages: readonly (string | null)[],
    askedCode: string,
    toLanguageName: (code: string) => string | null,
) {
    const keep =
        'whatever language this message is in, unless they ask for another.';
    const nameList = halfLanguages.map((code) => {
        return code === null ? null : toLanguageName(code);
    });
    const knownList = [
        ...new Set(
            nameList.filter((item): item is string => {
                return item !== null;
            }),
        ),
    ];
    if (halfLanguages.length > 1) {
        const ownName = nameList[0] ?? 'its own language';
        const translatedList = nameList.slice(1).map((item) => {
            return item ?? 'another language';
        });
        return (
            `The study file "${name}" is written in ${ownName}, with ` +
            (translatedList.length === 1
                ? `a translation into ${translatedList[0]}`
                : `translations into ${joinStudyLanguageNames(translatedList)}`) +
            ' after it, each under a rule and a # title of its own: a word ' +
            'you put into a part is in the language of the half that part ' +
            `is in, ${keep}`
        );
    }
    if (knownList.length === 0) {
        return (
            `The study file "${name}" is not written in ` +
            `${toLanguageName(askedCode) ?? 'the language of this message'}: ` +
            'every word you put into it is in the language it is written ' +
            `in, ${keep}`
        );
    }
    return (
        `The study file "${name}" is written in ${knownList[0]}: every ` +
        `word you put into it is in ${knownList[0]}, ${keep}`
    );
}

/**
 * What an ask about a study the tool can change says of its language
 * (EC-608), or null with nothing to say: the language of its halves when
 * one is not `askedCode`, the language the model is asked in -- English
 * behind the window's translator -- and, asked its English, their words as
 * they typed them: a word of the study a `replace` writes over, or a title
 * to put in, does not survive being put into English. `toLanguageName`
 * names a code in English, null for one it cannot name.
 */
export function genStudyLanguageHint(options: {
    name: string;
    halfLanguages: readonly (string | null)[];
    askedCode: string;
    ownWords: StudyOwnWordsType | null;
    toLanguageName?: (code: string) => string | null;
}) {
    const {
        name,
        halfLanguages,
        askedCode,
        ownWords,
        toLanguageName = toStudyLanguageName,
    } = options;
    const lines: string[] = [];
    if (
        halfLanguages.some((code) => {
            return code !== null && code !== askedCode;
        })
    ) {
        lines.push(
            toStudyLanguageLine(name, halfLanguages, askedCode, toLanguageName),
        );
    }
    if (ownWords !== null && ownWords.text.trim() !== '') {
        lines.push(
            `They asked in ${ownWords.language}, and the question this ` +
                'message starts with is its English. As they typed it: ' +
                `${JSON.stringify(ownWords.text.trim())}. A word of the study ` +
                'it names -- what a `replace` writes over -- and words they ' +
                'give to be written into it are taken from what they typed, ' +
                'exactly as they typed it, never the English of it. Your ' +
                'answer to them stays in English: the window puts it into ' +
                'their language.',
        );
    }
    return lines.length === 0 ? null : `(${lines.join(' ')})`;
}

/**
 * What the model is told when it says the open study changed and no draft
 * was made (EC-499), as `NOTE_CLAIM_NUDGE` is for a note.
 */
export function genStudyClaimNudge(openStudyFiles: readonly string[]) {
    const names = openStudyFiles
        .map((name) => {
            return `"${name}"`;
        })
        .join(' or ');
    return (
        'Not yet: nothing in the study file changed -- no owa_resource_file ' +
        'draft went through, so there is no Save changes under your answer. ' +
        `Draft it now: \`file\` ${names}, \`section\` (a heading as it ` +
        "reads) and `content` (that part's new words), or `append`, or " +
        '`replace` (each `from` as the file writes it, and its `to`). When it ' +
        'cannot be done, say so plainly; when no change was asked for, ' +
        'write your answer again without saying the file was changed.'
    );
}

/**
 * What the model is told when it says the NEW study the card above holds
 * changed and no draft was made (2026-11-14, EC-700), as
 * `genStudyClaimNudge` is for a study open in the tab: the card still
 * holds the words it had, and its Create would keep them.
 */
export function genHeldStudyClaimNudge(
    held: Omit<DraftedStudyType, 'reference'>,
) {
    return (
        `Not yet: nothing in "${held.name}" changed -- no owa_resource_file ` +
        'draft went through, so the card under your last answer still holds ' +
        'it as it was, and its Create would keep it so. Draft the change ' +
        `now with \`file\` "${held.name}": \`section\` (a heading as it ` +
        "reads) and `content` (that part's new words), or `append`, or " +
        '`replace` (each `from` as the study writes it, and its `to`); to ' +
        'put it into another language, call owa_resource_file translate ' +
        'with this `file`, `language` and `place`. When it cannot be done, ' +
        'say so plainly; when no change was asked for, write your answer ' +
        'again without saying the study was changed.'
    );
}

/**
 * What the model is told when, under a card holding a new study, it sent
 * the question to `/btw` (2026-11-14, EC-703): a question asked there is
 * about the study's passage, and told so on the ask alone
 * (`genHeldStudyAskHint`), gemma4:cloud still answered _What does the word
 * begotten mean in this verse?_ with "type /btw" once of twice -- the
 * prompt's own rule sends a word's meaning there.
 */
export function genHeldStudyQuestionNudge(
    held: Omit<DraftedStudyType, 'reference'>,
) {
    return (
        'Not yet: that question is about the passage of the new study the ' +
        `card above holds, "${held.name}" -- part of this study, not a ` +
        'question outside the app. Answer it yourself in plain words (the ' +
        'passage as the study quotes it is owa_resource_file `read` with ' +
        `\`file\` "${held.name}"), never telling them to type /btw, and ` +
        'change nothing in the study for a question.'
    );
}

/**
 * The diagrams of a drafted CHANGE the window parses (2026-11-11, EC-503):
 * those in the words the call writes -- a part's, an append's, or the
 * whole text when it is all written anew -- by their indexes in the drafted
 * file. The file's own are the person's: one mermaid cannot draw had been
 * sent to the model to fix, and dropped from their file when it could not.
 */
export function listWrittenDiagramIndexes(
    draftedDiagrams: readonly string[],
    writtenText: string,
) {
    const writtenSet = new Set(
        lintStudyContent(String(writtenText ?? '')).diagrams.map((diagram) => {
            return diagram.trim();
        }),
    );
    return draftedDiagrams.flatMap((diagram, index) => {
        return writtenSet.has(diagram.trim()) ? [index] : [];
    });
}

// --- a study written whole again (2026-11-11, EC-502) ------------------------
//
// Asked to fix one line of the Khmer discussion questions -- past the 16 KB
// the ask shows of a 44 KB study -- gemma4:cloud read that part and sent it
// back as the WHOLE new text: `file` named, `content` that part alone, no
// `section`. The tool drafted a change taking out every other part of the
// study, and the card offered Save changes under an answer saying only that
// it could not settle on one. Its first try had sent the last answer, two
// sentences, as the whole study.

/** A draft writing a study file's whole text again: `file`, no part named. */
export function checkIsWholeStudyRewrite(args: any) {
    return (
        toText(args?.file).trim() !== '' &&
        toText(args?.content).trim() !== '' &&
        !checkIsStudyPartEdit(args)
    );
}

// An outline's line (`toStudyOutline`), and its last when it is cut short.
const OUTLINE_HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const OUTLINE_CUT_PATTERN = /^… and \d+ more$/;
const MAX_NAMED_PARTS = 5;

function readOutlineEntries(outline: string) {
    return outline.split('\n').flatMap((line) => {
        const match = OUTLINE_HEADING_PATTERN.exec(line.trim());
        return match === null
            ? []
            : [{ level: match[1].length, heading: match[2] }];
    });
}

/** The file's headings the new text has none for; one met twice, twice. */
function listMissingParts(fileHeadings: string[], writtenHeadings: string[]) {
    const leftCountMap = new Map<string, number>();
    for (const heading of writtenHeadings) {
        const key = toStudyHeadingKey(heading);
        leftCountMap.set(key, (leftCountMap.get(key) ?? 0) + 1);
    }
    return fileHeadings.filter((heading) => {
        const key = toStudyHeadingKey(heading);
        const left = leftCountMap.get(key) ?? 0;
        if (left > 0) {
            leftCountMap.set(key, left - 1);
            return false;
        }
        return true;
    });
}

/**
 * The heading of the ONE part of the file a whole new text is: it opens on
 * a heading the file has once, holds no other heading but its own
 * sub-headings, and leaves none of the file's sub-headings of that part
 * out. Null for anything else -- the part's end past the headings listed
 * included.
 */
function findWrittenPart(
    content: string,
    entries: { level: number; heading: string }[],
    isOutlineCut: boolean,
) {
    const sections = listStudySections(content);
    const first = sections[0];
    const firstLineIndex = content.split('\n').findIndex((line) => {
        return line.trim() !== '';
    });
    if (
        first === undefined ||
        first.start !== firstLineIndex ||
        sections.slice(1).some((one) => {
            return one.level <= first.level;
        })
    ) {
        return null;
    }
    const key = toStudyHeadingKey(first.heading);
    const foundList = entries.flatMap((entry, index) => {
        return toStudyHeadingKey(entry.heading) === key ? [index] : [];
    });
    if (foundList.length !== 1) {
        return null;
    }
    const at = foundList[0];
    const end = entries.findIndex((entry, index) => {
        return index > at && entry.level <= entries[at].level;
    });
    if (end < 0 && isOutlineCut) {
        return null;
    }
    const subHeadings = entries
        .slice(at + 1, end < 0 ? entries.length : end)
        .map((entry) => {
            return entry.heading;
        });
    const writtenHeadings = sections.slice(1).map((one) => {
        return one.heading;
    });
    return listMissingParts(subHeadings, writtenHeadings).length === 0
        ? first.heading
        : null;
}

/** What the model is told when a whole new text would lose study parts. */
function genWholeStudyRewriteRefusal(
    file: string,
    missingHeadings: string[],
    shape: StudyReadShapeType,
) {
    const named = missingHeadings
        .slice(0, MAX_NAMED_PARTS)
        .map((heading) => {
            return `“${heading}”`;
        })
        .join(', ');
    const more =
        missingHeadings.length > MAX_NAMED_PARTS
            ? ` and ${missingHeadings.length - MAX_NAMED_PARTS} more`
            : '';
    return (
        `\`content\` with no \`section\` is the WHOLE new text of "${file}", ` +
        `and this one leaves out ${missingHeadings.length} of its parts: ` +
        `${named}${more}. ` +
        (shape.isShownWhole
            ? ''
            : 'The ask shows only the start of this file: a whole text ' +
              'written from it loses the rest. ') +
        'To change a part, call draft with `file`, `section` (one of its ' +
        "headings, as it reads) and `content` (that part's new words alone; " +
        'a heading as their first line replaces its own), one call a part, ' +
        'or `append` (words added at its end); to fix some words where they ' +
        'stand, `replace` (each `from` as the file writes it, and its ' +
        '`to`); to take a part out, `remove` true with its `section`. ' +
        'Nothing in the file has changed: never say it was. ' +
        `${STUDY_HEADINGS_LEAD}\n${shape.outline}`
    );
}

/**
 * A model's draft writing a study file's whole text again, read against
 * the file's headings (`toStudyReadShape`): ONE part of the file written
 * out is drafted as that part (`section`); a text leaving out parts of a
 * file the ask shows only in part, or most of any file's parts, is refused
 * naming them. Null to draft it as it is: a text keeping every part, a file
 * shown whole losing a few, no read.
 */
export function routeWholeStudyRewrite(
    args: any,
    shape: StudyReadShapeType | null,
): { args: any } | { reason: string } | null {
    if (shape === null || !checkIsWholeStudyRewrite(args)) {
        return null;
    }
    const entries = readOutlineEntries(shape.outline);
    if (entries.length === 0) {
        return null;
    }
    const content = toText(args.content).replace(/\r\n/g, '\n');
    const isOutlineCut = shape.outline.split('\n').some((line) => {
        return OUTLINE_CUT_PATTERN.test(line.trim());
    });
    const part = findWrittenPart(content, entries, isOutlineCut);
    if (part !== null) {
        return { args: { ...args, section: part } };
    }
    const missing = listMissingParts(
        entries.map((entry) => {
            return entry.heading;
        }),
        listStudySections(content).map((one) => {
            return one.heading;
        }),
    );
    if (
        missing.length === 0 ||
        (shape.isShownWhole && missing.length * 2 <= entries.length)
    ) {
        return null;
    }
    return {
        reason: genWholeStudyRewriteRefusal(
            toText(args.file).trim(),
            missing,
            shape,
        ),
    };
}

// --- a report of a change written into the study (2026-11-11, EC-505) -------
//
// Asked to fix question 3 of the Khmer discussion questions, gemma4:cloud
// drafted `section` "Questions for Discussion" -- the ENGLISH part -- with
// an earlier answer of its own as the new words: "I have fixed the
// cross-references in the study file. I corrected the book names …". Save
// changes would have put that sentence in place of the four English
// questions, under an answer saying question 3 was corrected; the Khmer
// line was untouched. Its first try in the run before had sent that answer
// too, as the whole study (EC-502).

// How much of a report the model is shown back.
const MAX_QUOTED_REPORT_LENGTH = 100;

/**
 * What the model is told when the words a draft would write into a study
 * file say what was done to it (`findStudyChangeReport`), with the file's
 * headings when they were read.
 */
export function genStudyReportRefusal(report: string, outline: string) {
    const text = report.replace(/\s+/g, ' ').trim();
    const quoted =
        text.length > MAX_QUOTED_REPORT_LENGTH
            ? `${text.slice(0, MAX_QUOTED_REPORT_LENGTH).trimEnd()}…`
            : text;
    return (
        `These words say what was done to the study (“${quoted}”): a study ` +
        'never says what was changed in it, so they are not its words. ' +
        'Nothing in the file has changed: never say it was. To change some ' +
        'words, call draft with `file` and `replace` (each `from` the words ' +
        'as the file writes them, each `to` the words in their place). To ' +
        'change a line, call draft with `file`, `section` (the heading of ' +
        'the part that holds the line, as it reads) and `content` (that ' +
        "part's whole text, the line changed and every other line as it " +
        'was); a part the ask does not show in full is read first (`read` ' +
        'with `file` and `section`).' +
        (outline === '' ? '' : ` ${STUDY_HEADINGS_LEAD}\n${outline}`)
    );
}

// --- a part of a study written without its words (2026-11-11, EC-500) -------
//
// Asked in EC-499's tab to fix the Khmer Cross References -- past the 16 KB
// the ask shows of a 44 KB study -- gemma4:cloud drafted that part without
// reading it: the three references came out right, and two labels it wrote
// anew came out wrong, one a word short, the snake's another word. A change
// is the words asked for and every other line as it was.

/** What of a study file the model was shown: words whole, or cut short. */
export type StudyShownBlockType = {
    fileKey: string;
    text: string;
    isCut: boolean;
};

function checkIsStudyFileName(name: string) {
    return name.toLowerCase().endsWith(STUDY_FILE_EXTENSION);
}

/** The study files an ask carries (`readAskedTextFiles`), as shown. */
export function toAskedStudyBlocks(asked: string): StudyShownBlockType[] {
    return readAskedTextFiles(String(asked ?? '')).flatMap((file) => {
        return checkIsStudyFileName(file.name)
            ? [
                  {
                      fileKey: toStudyFileKey(file.name),
                      text: file.text,
                      isCut: file.isCut,
                  },
              ]
            : [];
    });
}

/**
 * A `read` of a study file as what it showed: the file's start, or a part
 * (`section`), cut when the read says it holds only the start. Null for
 * anything else.
 */
export function toReadStudyBlock(readText: string): StudyShownBlockType | null {
    const result = parseJson(String(readText ?? ''));
    if (
        result === null ||
        result.kind !== 'text' ||
        typeof result.text !== 'string' ||
        !checkIsStudyFileName(toText(result.file))
    ) {
        return null;
    }
    return {
        fileKey: toStudyFileKey(toText(result.file)),
        text: result.text,
        isCut: toText(result.note) !== '',
    };
}

/** A draft changing one part of a study file by its words; null if not. */
export function toStudyPartDraft(args: any) {
    const file = toText(args?.file).trim();
    const section = toText(args?.section).trim();
    return file !== '' &&
        section !== '' &&
        checkIsStudyFileName(file) &&
        toText(args?.content).trim() !== ''
        ? { file, section }
        : null;
}

/**
 * Whether a part of a study file was shown whole: in a block of that file
 * holding its heading once -- and, in a block cut short, a heading of its
 * level or above after it, where the part ends.
 */
export function checkIsStudyPartShown(
    blocks: readonly StudyShownBlockType[],
    file: string,
    section: string,
) {
    const fileKey = toStudyFileKey(file);
    const key = toStudyHeadingKey(section);
    return blocks.some((block) => {
        if (block.fileKey !== fileKey) {
            return false;
        }
        const found = listStudySections(block.text).filter((one) => {
            return toStudyHeadingKey(one.heading) === key;
        });
        return (
            found.length === 1 &&
            (!block.isCut ||
                found[0].end <
                    block.text.replace(/\r\n/g, '\n').split('\n').length)
        );
    });
}

function toShownWords(text: string) {
    return text.replace(/\r\n/g, '\n').trim();
}

/**
 * What the model is told when it drafts a part of a study it was not shown
 * (EC-500), off the window's `read` of that part: the part as the read gives
 * it, to make the change on. Null to draft it -- no part read, one too long
 * to send back (its read says so), or words a block shows after all.
 */
export function genUnreadStudyPartRefusal(
    blocks: readonly StudyShownBlockType[],
    file: string,
    readText: string,
) {
    const result = parseJson(String(readText ?? ''));
    if (
        result === null ||
        result.kind !== 'text' ||
        typeof result.text !== 'string' ||
        toText(result.section) === '' ||
        toText(result.note) !== ''
    ) {
        return null;
    }
    const words = toShownWords(result.text);
    const fileKey = toStudyFileKey(file);
    if (
        words === '' ||
        blocks.some((block) => {
            return (
                block.fileKey === fileKey &&
                toShownWords(block.text).includes(words)
            );
        })
    ) {
        return null;
    }
    return (
        `The part “${result.section}” is in nothing you were shown of ` +
        `"${file}": these words were written without its own. A change is ` +
        'the words asked for and every other line as it was. Call draft ' +
        'again with the same `file` and `section`, `content` the words ' +
        'below with only the asked change made. Nothing in the file has ' +
        `changed: never say it was. The part as a read of it gives it: ` +
        String(readText).trim()
    );
}
