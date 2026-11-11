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
    STUDY_ANSWER_MARKER,
    STUDY_CONTENT_RULES,
    STUDY_FILE_PROMPT,
    STUDY_KEEP_ANSWER_RULE,
} from './noteCreatePromptHelpers';
import {
    OTHER_CHAT_LANG_CODE,
    detectTypedLanguage,
    listAssistantLanguages,
} from './chatLangHelpers';
import type { ChatMessageType } from './chatSessionHelpers';
import {
    STUDY_FILE_EXTENSION,
    STUDY_FOLDER_NAME,
    STUDY_HEADINGS_LEAD,
    applyStudyEdit,
    lintStudyContent,
    listStudySections,
    separateStudyLines,
    toStudyHeadingKey,
    toStudyOutline,
} from '../helper/agentStudyFileRules';

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
    'file the app keeps in their Resources, beside the chapter it is about, ' +
    'where the Bible Reader shows it. Make it now with owa_resource_file ' +
    'action "draft": `ref` the passage they named (or the one this ' +
    'conversation is about), a 2-6 word `title`, and the whole study as ' +
    '`content`; never ask what to write. First you may read the passage ' +
    'once with owa_lookup_record kind "verse" (`names` and `related` true) ' +
    'for its people, places and cross references. ' +
    `${STUDY_CONTENT_RULES} ${STUDY_KEEP_ANSWER_RULE} ` +
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
 * which is held by the window, and a note on what to do next -- the
 * kept-answer note when the window put in the answer above (EC-466).
 */
export function toModelDraftText(text: string, isAnswerKept = false) {
    const result = parseJson(String(text ?? ''));
    if (result === null || typeof result.content !== 'string') {
        return text;
    }
    const { content, ...rest } = result;
    const isChange = result.isChange === true;
    return JSON.stringify({
        ...rest,
        content: `[held by the window: ${content.length} characters]`,
        note: isAnswerKept
            ? isChange
                ? STUDY_KEPT_ANSWER_CHANGE_NOTE
                : STUDY_KEPT_ANSWER_NOTE
            : isChange
              ? STUDY_CHANGE_HELD_NOTE
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
 * a thumb down, a study card (so a second ask still finds the answer that
 * was read) or a line too short to be a study. Null when the tab holds
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
            (message.actions ?? []).some((action) => {
                return STUDY_CARD_TOOL_NAME_SET.has(action.toolName ?? '');
            }) ||
            text.length < MIN_ANSWER_ABOVE_LENGTH
        ) {
            if (options.isNewestOnly === true) {
                return null;
            }
            continue;
        }
        return text;
    }
    return null;
}

// "Save that as a study file" (EC-466): a keeping word, the answer pointed
// back at and a study word, and nothing more asked of it -- a line that also
// asks for a change, a diagram or a translation is the model's to read.
// English in code; another language's own words are EC-465's.
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
 * whatever the model writes (`toKeptAnswerDraftArgs`).
 */
export function readKeepAnswerAsk(text: string) {
    const line = String(text ?? '')
        .trim()
        .replace(/[.!?]+$/, '');
    if (
        line === '' ||
        line.length > MAX_KEEP_ASK_LENGTH ||
        line.startsWith('/') ||
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
 * A draft's arguments with the answer above in place of whatever the model
 * wrote (EC-466): a new study's `content`, or -- with `file`, a study file
 * being changed -- words added at its end (or at the end of `section`),
 * never its whole text replaced.
 */
export function toKeptAnswerDraftArgs(args: any, answer: string) {
    const kept = toStudyContentFromAnswer(answer);
    const { content: _content, append: _append, section, ...rest } = args ?? {};
    if (typeof rest.file === 'string' && rest.file !== '') {
        return {
            ...rest,
            ...(typeof section === 'string' && section !== ''
                ? { section }
                : {}),
            append: kept,
        };
    }
    return { ...rest, content: kept };
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
    'under your answer with Create, Preview and Change the name. Say in one ' +
    'sentence that their answer is ready as a study file and tell them to ' +
    'press Create to save it; name no section or diagram, never paste it.';

export const STUDY_KEPT_ANSWER_CHANGE_NOTE =
    'Nothing is saved yet. The window added your answer above, word for ' +
    'word, to the study file -- not anything you wrote for it -- and shows ' +
    'the change under your answer with Save changes and Preview. Say in one ' +
    'sentence that their answer is added and tell them to press Save ' +
    'changes to write it; never paste it.';

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
 * `Default/<name>.md`, the only files a change can be drafted for.
 */
export function findOpenStudyFiles(openFiles: readonly string[]) {
    const prefix = `${STUDY_FOLDER_NAME}/`.toLowerCase();
    return openFiles.filter((name) => {
        const lower = String(name ?? '').toLowerCase();
        return (
            lower.startsWith(prefix) &&
            lower.endsWith(STUDY_FILE_EXTENSION) &&
            !lower.slice(prefix.length).includes('/')
        );
    });
}

function checkIsStudyPartEdit(args: any) {
    return (
        toText(args?.section).trim() !== '' ||
        toText(args?.append).trim() !== ''
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
        'alone), one call a part, or `append` (words added at its end). ' +
        'Never write the whole study again to change a part of it: a long ' +
        'file is shown only in part, and the rest would be lost. To see a ' +
        'part first, call read with `file` and `section`. Until a draft ' +
        'goes through, nothing in the file has changed: never say it was ' +
        'changed or fixed. A NEW study needs `ref` (its passage) and a ' +
        '`title`.' +
        (outline === '' ? '' : ` ${STUDY_HEADINGS_LEAD}\n${outline}`)
    );
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
): { args: any } | { reason: string } | null {
    if (
        held === null ||
        !held.isChange ||
        held.file === null ||
        !checkIsStudyPartEdit(args) ||
        toStudyFileKey(toText(args?.file)) !== toStudyFileKey(held.file)
    ) {
        return null;
    }
    const edited = applyStudyEdit(held.content, {
        section: toText(args.section),
        content: separateStudyLines(toText(args.content)),
        append: separateStudyLines(toText(args.append)),
    });
    if ('reason' in edited) {
        return edited;
    }
    const {
        section: _section,
        append: _append,
        content: _content,
        ...rest
    } = args;
    return { args: { ...rest, file: held.file, content: edited.text } };
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
        "reads) and `content` (that part's new words), or `append`. When it " +
        'cannot be done, say so plainly; when no change was asked for, ' +
        'write your answer again without saying the file was changed.'
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
        'or `append` (words added at its end). Nothing in the file has ' +
        'changed: never say it was. ' +
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
        'Nothing in the file has changed: never say it was. To change a ' +
        'line, call draft with `file`, `section` (the heading of the part ' +
        "that holds the line, as it reads) and `content` (that part's whole " +
        'text, the line changed and every other line as it was); a part the ' +
        'ask does not show in full is read first (`read` with `file` and ' +
        '`section`).' +
        (outline === '' ? '' : ` ${STUDY_HEADINGS_LEAD}\n${outline}`)
    );
}
