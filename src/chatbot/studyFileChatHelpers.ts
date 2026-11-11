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
 * (`handleActing`): **Create "MAT.3.3-7 The Voice.md"** (or **Save changes
 * to "…"** for a change), **Preview** and **Change the name**. The model
 * sees what it drafted with the study itself left out -- it wrote it, and
 * the whole file again on every later round would be billed twice.
 *
 * An ask is read here too (`readStudyFileAsk`): English in code, every other
 * language in its `assistant.json` (`studyFileAsks`). It goes out under
 * `STUDY_SYSTEM_PROMPT` with the `study` tool list (`modelTools.mjs`); a
 * Resources, Bible Reader or lookup conversation keeps its own prompt, which
 * carries `STUDY_FILE_PROMPT` (`noteCreatePromptHelpers.ts`).
 */
import {
    STUDY_CONTENT_RULES,
    STUDY_FILE_PROMPT,
} from './noteCreatePromptHelpers';
import { listAssistantLanguages } from './chatLangHelpers';

export { STUDY_FILE_PROMPT };

export const STUDY_ASK_KIND = 'study';
export const STUDY_MAX_TOOL_ROUNDS = 8;

/** The pseudo tools the card's buttons carry. Never sent to a model. */
export const STUDY_CREATE_TOOL_NAME = 'owa-study-create';
export const STUDY_PREVIEW_TOOL_NAME = 'owa-study-preview';
export const STUDY_RENAME_TOOL_NAME = 'owa-study-rename';

export const STUDY_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program. The person wants a Bible STUDY FILE: a Markdown ' +
    'file the app keeps in their Resources, beside the chapter it is about, ' +
    'where the Bible Reader shows it. Make it now with owa_resource_file ' +
    'action "draft": `ref` the passage they named (or the one this ' +
    'conversation is about), a 2-6 word `title`, and the whole study as ' +
    '`content`; never ask what to write. First you may read the passage ' +
    'once with owa_lookup_record kind "verse" (`names` and `related` true) ' +
    'for its people, places and cross references. ' +
    `${STUDY_CONTENT_RULES} ` +
    'If draft refuses, fix what it says and call it again. The app saves ' +
    'NOTHING until they press Create under your answer: never say it is ' +
    'saved. Your answer: two or three sentences on what the study holds and ' +
    'which diagrams it draws, then tell them to press Create to save it or ' +
    'Preview to look at it first. Never paste the study into the answer. If ' +
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
    'your answer with Create, Preview and Change the name: tell the person ' +
    'to press Create to save it. Say in two or three sentences what it ' +
    'holds; never paste it.';

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
};

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
 * which is held by the window, and a note on what to do next.
 */
export function toModelDraftText(text: string) {
    const result = parseJson(String(text ?? ''));
    if (result === null || typeof result.content !== 'string') {
        return text;
    }
    const { content, ...rest } = result;
    return JSON.stringify({
        ...rest,
        content: `[held by the window: ${content.length} characters]`,
        note:
            result.isChange === true ? STUDY_CHANGE_HELD_NOTE : STUDY_HELD_NOTE,
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

/** The card's buttons; labels in English, translated where drawn. */
export function genStudyDraftActions(drafted: DraftedStudyType) {
    return [
        {
            label: drafted.isChange
                ? `Save changes to "${drafted.name}"`
                : `Create "${drafted.name}"`,
            toolName: STUDY_CREATE_TOOL_NAME,
            args: { reference: drafted.reference },
        },
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

/**
 * Whether a typed line asks for a study file. English in code; every other
 * language's own patterns from its `assistant.json` (`studyFileAsks`).
 */
export function readStudyFileAsk(text: string) {
    const line = String(text ?? '').trim();
    if (line === '' || line.startsWith('/') || line.length > 400) {
        return false;
    }
    if (
        listAssistantLanguages().some((language) => {
            return language.studyFileAskPatterns.some((pattern) => {
                return pattern.test(line);
            });
        })
    ) {
        return true;
    }
    if (HOW_TO_PATTERN.test(line) || !MAKING_PATTERN.test(line)) {
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
