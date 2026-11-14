/**
 * A song made out of a document the person already has -- a PowerPoint, a
 * Word or PDF file, a slide document -- by asking the help window
 * (2026-11-10, the user: _user ask to create lyric from powerpoint file then
 * chatbot should list available powerpoint files when user choose then
 * chatbot should use all api to extract text and prepare for the lyric_).
 *
 * A conversation of buttons, with no model unless pictures must be read:
 *
 * 1. the ask ("make a song from my PowerPoint") lists the files of that kind
 *    in the Documents folder, ten a page -- or reads the one it names;
 * 2. a press (or its number, or its name typed) READS it: the app converts
 *    a PowerPoint or Word file and takes its words out in the order they are
 *    sung (`owa_media_file info`, `agentDocumentWordsHelpers.ts`), and the
 *    song drafter writes them out (`owa_lyric_validate` `draft`) under the
 *    song card every draft gets -- **Create "…"** / **Copy song text** --
 *    which keeps the font the slides were set in for the new song's stages;
 * 3. pages whose words could not be read -- a picture, a legacy font -- are
 *    offered as **Read the words off the pictures**: the app draws them and
 *    an assistant that sees pictures reads them (`transcribe`, the window's),
 *    and their words join the rest, page by page.
 *
 * Every button is `LYRIC_DOCUMENT_STEP_TOOL_NAME`, a pseudo tool no tool
 * host registers, carrying its WHOLE step in its args: the window keeps
 * nothing, an old button runs its own step again, and a file is named, never
 * a path -- the app resolves the name inside its Documents folder.
 */
import { appError } from '../helper/loggerHelpers';
import {
    joinDocumentWords,
    type DocumentWordsBlockType,
} from '../helper/documentWordsRules';
import type { BotImageType } from './attachmentHelpers';
import { listAssistantLanguages } from './chatLangHelpers';
import { fillWords, tran, tranLabel } from './chatTranHelpers';
import {
    genLyricDraftAnswer,
    type BotActionType,
    type BotAnswerType,
} from './helpBotHelpers';
import { OPEN_AI_SETTING_TOOL_NAME } from './providerIssueHelpers';

export const LYRIC_DOCUMENT_STEP_TOOL_NAME = 'owa-lyric-document-step';

// The buttons, stored in English (code matches them, a typed reply is read
// against them) and drawn in the window's language with `tranLabel`.
export const LYRIC_DOCUMENT_MORE_LABEL = 'More files';
export const LYRIC_DOCUMENT_PICTURES_LABEL = 'Read the words off the pictures';

export type LyricDocumentKindType = 'pptx' | 'docx' | 'pdf' | 'slide';

export const LYRIC_DOCUMENT_KIND_LIST: readonly LyricDocumentKindType[] = [
    'pptx',
    'docx',
    'pdf',
    'slide',
];

export type LyricDocumentStateType =
    | {
          step: 'list';
          kinds: LyricDocumentKindType[];
          offset?: number;
          // The words of the ask: a file named in them is read at once.
          words?: string;
      }
    | { step: 'read'; name: string }
    | { step: 'pictures'; name: string };

/** What the step runner needs of the window: the tool host and a model. */
export type LyricDocumentDepsType = {
    callTool: (name: string, args: any) => Promise<string>;
    callToolWithPictures: (
        name: string,
        args: any,
    ) => Promise<{ text: string; pictures: BotImageType[] }>;
    // Words read off pictures, the marker lines kept, and who read them;
    // `null` when no assistant here sees pictures.
    transcribe: (
        pictures: BotImageType[],
    ) => Promise<{ text: string; who: string } | null>;
    // The step in front, for the waiting line.
    report?: (text: string) => void;
};

const PAGE_SIZE = 10;
const MAX_ASK_LENGTH = 400;

const EXTENSION_KIND_MAP: Record<string, LyricDocumentKindType> = {
    pptx: 'pptx',
    docx: 'docx',
    pdf: 'pdf',
    ows: 'slide',
    preview: 'slide',
};

// A Latin word or an extension says which kind of file, in any language: a
// brand is written as it is (PowerPoint, PDF, Word) in most of them.
// "Word" alone is a word ("a song from the word of God"): only a Word FILE.
const WORD_FILE_SOURCE = String.raw`ms\s*word|word\s+(?:files?|documents?|docs?)|docx?`;
const KIND_WORD_PATTERN_LIST: [RegExp, LyricDocumentKindType][] = [
    [/\b(?:power\s*point|pptx?|presentation|slide\s*show|deck)\b/i, 'pptx'],
    [new RegExp(String.raw`\b(?:${WORD_FILE_SOURCE})\b`, 'i'), 'docx'],
    [/\bpdf\b/i, 'pdf'],
    [/\b(?:slide\s+documents?|\.ows)\b/i, 'slide'],
];
const SONG_WORD_PATTERN = /\b(?:lyrics?|songs?|hymns?)\b/i;
const DOCUMENT_SOURCE =
    String.raw`power\s*point|pptx?|presentation|slide\s*show|deck|slides?|` +
    String.raw`${WORD_FILE_SOURCE}|pdf|documents?|files?`;
// The DOCUMENT is where the song comes FROM: "a song from my PowerPoint",
// "turn this pdf into lyrics" -- never "a lyric FILE from <a page>", where the
// file is the song being made (the song-from-a-link starter).
const FROM_DOCUMENT_PATTERN = new RegExp(
    String.raw`\b(?:from|out\s+of|using|off|based\s+on)\b(?:[^.?!]|\.(?=\w)){0,60}?\b(?:${DOCUMENT_SOURCE})\b`,
    'i',
);
const INTO_SONG_PATTERN = new RegExp(
    String.raw`\b(?:turn|convert|change|make)\b(?:[^.?!]|\.(?=\w)){0,60}?\b(?:${DOCUMENT_SOURCE})\b(?:[^.?!]|\.(?=\w)){0,40}?\b(?:into|to)\s+(?:an?\s+|my\s+)?(?:lyrics?|songs?|hymns?)\b`,
    'i',
);
const MAKING_PATTERN =
    /\b(?:make|create|build|turn|convert|change|write|prepare|get|import|extract|pull|copy|bring)\b/i;
// A song page goes in by its link (`/lyric https://…`, `answerLyricLink`).
const LINK_PATTERN = /\bhttps?:\/\//i;
// The lyric going TO a document is the other feature (Export to PPTX).
const EXPORT_PATTERN =
    /\b(?:export|save\s+as|print|send)\b|\b(?:to|into|as)\s+(?:an?\s+)?(?:power\s*point|pptx?|pdf|word|docx?)\b/i;
// A question about how is the guide's.
const HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|can\s+i|is\s+it\s+possible|is\s+there)\b/i;

function toKindsInLine(line: string) {
    const kinds = new Set<LyricDocumentKindType>();
    for (const [pattern, kind] of KIND_WORD_PATTERN_LIST) {
        if (pattern.test(line)) {
            kinds.add(kind);
        }
    }
    for (const matched of line.matchAll(/\.(pptx|docx|pdf|ows)\b/gi)) {
        kinds.add(EXTENSION_KIND_MAP[matched[1].toLowerCase()]);
    }
    return kinds.size === 0 ? [...LYRIC_DOCUMENT_KIND_LIST] : [...kinds];
}

/**
 * The one listed file the ask names, by its full name or its name without
 * the extension ("from Hymns 21&22"), or null: read off the real list,
 * because a file name has spaces in it and no pattern can tell where it
 * starts in a sentence.
 */
export function findNamedDocumentFile(words: string, names: readonly string[]) {
    const line = toPickKey(words);
    const named = names.filter((name) => {
        const full = toPickKey(name);
        const stem = toPickKey(toNameStem(name));
        return line.includes(full) || (stem.length >= 3 && line.includes(stem));
    });
    if (named.length <= 1) {
        return named[0] ?? null;
    }
    // "Song.pptx" and "Song 2.pptx" both fit "Song 2": the longest wins.
    const longest = [...named].sort((a, b) => {
        return b.length - a.length;
    });
    return toPickKey(toNameStem(longest[0])).length >
        toPickKey(toNameStem(longest[1])).length
        ? longest[0]
        : null;
}

/**
 * A song asked to be made out of a document: English in code ("make a song
 * from my PowerPoint", "turn this pdf into lyrics"), any other language off
 * its own `lyricDocumentAsks`. Never a question of how (the guide's), never
 * a song going TO a document (Export to PPTX), never a `/` command.
 */
export function readLyricDocumentAsk(
    text: string,
): LyricDocumentStateType | null {
    const line = String(text ?? '').trim();
    if (line === '' || line.startsWith('/') || line.length > MAX_ASK_LENGTH) {
        return null;
    }
    const isOwnLanguageAsk = listAssistantLanguages().some((language) => {
        return language.lyricDocumentAskPatterns.some((pattern) => {
            return pattern.test(line);
        });
    });
    const isEnglishAsk =
        !HOW_TO_PATTERN.test(line) &&
        !EXPORT_PATTERN.test(line) &&
        SONG_WORD_PATTERN.test(line) &&
        MAKING_PATTERN.test(line) &&
        (FROM_DOCUMENT_PATTERN.test(line) || INTO_SONG_PATTERN.test(line));
    if (LINK_PATTERN.test(line) || (!isOwnLanguageAsk && !isEnglishAsk)) {
        return null;
    }
    return { step: 'list', kinds: toKindsInLine(line), words: line };
}

/**
 * The list a `/lyric-from` command asks for: the kinds its words name (all
 * four when they name none), the words kept so a file they name is read.
 */
export function genLyricDocumentListState(
    words: string,
): LyricDocumentStateType {
    const line = words.trim().slice(0, MAX_ASK_LENGTH);
    return line === ''
        ? { step: 'list', kinds: [...LYRIC_DOCUMENT_KIND_LIST] }
        : { step: 'list', kinds: toKindsInLine(line), words: line };
}

export function toLyricDocumentKind(name: string) {
    const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
    return EXTENSION_KIND_MAP[extension] ?? null;
}

function toAction(label: string, state: LyricDocumentStateType): BotActionType {
    return {
        label,
        toolName: LYRIC_DOCUMENT_STEP_TOOL_NAME,
        args: state,
    };
}

function toFileAction(name: string): BotActionType {
    // A file's name is DATA: drawn as it is, never translated.
    return { ...toAction(name, { step: 'read', name }), isData: true };
}

/** The list a press picks from, ten a page. */
export function genLyricDocumentListAnswer(
    names: readonly string[],
    state: Extract<LyricDocumentStateType, { step: 'list' }>,
): BotAnswerType {
    const matching = names.filter((name) => {
        const kind = toLyricDocumentKind(name);
        return kind !== null && state.kinds.includes(kind);
    });
    if (matching.length === 0) {
        return {
            text: genNoDocumentText(),
        };
    }
    const offset = Math.max(
        0,
        Math.min(state.offset ?? 0, matching.length - 1),
    );
    const page = matching.slice(offset, offset + PAGE_SIZE);
    const actions = page.map(toFileAction);
    if (offset + PAGE_SIZE < matching.length) {
        actions.push(
            toAction(LYRIC_DOCUMENT_MORE_LABEL, {
                step: 'list',
                kinds: state.kinds,
                offset: offset + PAGE_SIZE,
            }),
        );
    }
    return {
        text: tran(
            'Which file should I make the song from? Press its name, or ' +
                'type its number.',
        ),
        actions,
    };
}

function toPickKey(text: string) {
    return text
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/[.!?]+$/, '');
}

function toNameStem(name: string) {
    return name.replace(/\.[^.]+$/, '');
}

/**
 * A typed reply under the list: its number, a file's name with or without
 * its extension, a unique piece of one (three letters or more), or the
 * More button's own words. Read off the LAST answer only.
 */
export function readLyricDocumentTypedPick(
    actions: BotActionType[] | undefined,
    text: string,
): LyricDocumentStateType | null {
    const said = toPickKey(text);
    const own = (actions ?? []).filter((action) => {
        return action.toolName === LYRIC_DOCUMENT_STEP_TOOL_NAME;
    });
    if (own.length === 0 || said === '') {
        return null;
    }
    const byLabel = own.find((action) => {
        return (
            toPickKey(action.label) === said ||
            toPickKey(tranLabel(action.label)) === said
        );
    });
    if (byLabel !== undefined) {
        return byLabel.args as LyricDocumentStateType;
    }
    const files = own.filter((action) => {
        return (action.args as LyricDocumentStateType)?.step === 'read';
    });
    const number = /^(?:#\s*)?(\d{1,2})$/.exec(said);
    if (number !== null) {
        const picked = files[Number(number[1]) - 1];
        return picked === undefined
            ? null
            : (picked.args as LyricDocumentStateType);
    }
    const byStem = files.filter((action) => {
        return toPickKey(toNameStem(action.label)) === said;
    });
    if (byStem.length === 1) {
        return byStem[0].args as LyricDocumentStateType;
    }
    if (said.length < 3) {
        return null;
    }
    const byPiece = files.filter((action) => {
        return toPickKey(action.label).includes(said);
    });
    return byPiece.length === 1
        ? (byPiece[0].args as LyricDocumentStateType)
        : null;
}

type DocumentWordsAnswerType = {
    name?: string;
    title?: string;
    headings?: string[];
    fontFamily?: string | null;
    isFontMissing?: boolean;
    text?: string;
    blocks?: DocumentWordsBlockType[];
    pictureNeededPages?: number[];
    pictureFor?: number[];
};

function parseDocumentWords(text: string): DocumentWordsAnswerType | null {
    try {
        const value = JSON.parse(text);
        return value !== null && typeof value === 'object' ? value : null;
    } catch (_error) {
        return null;
    }
}

/**
 * The words an assistant read off the pictures, picture by picture: split
 * on the marker lines the prompt asks for (`=== picture N ===`), a code
 * fence or a lead-in sentence left out. Pictures it said nothing for are
 * missing from the map. With no marker at all, everything is the first
 * picture's -- the common case of one.
 */
export function readPictureWords(text: string, count: number) {
    const map = new Map<number, string>();
    const cleaned = String(text ?? '')
        .replace(/```[a-z]*\n?/gi, '')
        .trim();
    const markerPattern = /^\s*=+\s*picture\s+(\d+)\s*=+\s*$/gim;
    const markers = [...cleaned.matchAll(markerPattern)];
    if (markers.length === 0) {
        if (count >= 1 && cleaned !== '') {
            map.set(1, cleaned);
        }
        return map;
    }
    markers.forEach((marker, index) => {
        const number = Number(marker[1]);
        const start = (marker.index ?? 0) + marker[0].length;
        const end = markers[index + 1]?.index ?? cleaned.length;
        const words = cleaned.slice(start, end).trim();
        if (number >= 1 && number <= count && words !== '') {
            map.set(number, words);
        }
    });
    return map;
}

function genFontNotes(read: DocumentWordsAnswerType) {
    const notes: string[] = [];
    if (typeof read.fontFamily === 'string' && read.fontFamily !== '') {
        notes.push(
            fillWords(
                tran(
                    'Every stage shows it in {font}, the font of its ' +
                        'slides. Change it in {place}.',
                ),
                {
                    font: read.fontFamily,
                    place: `${tran('Stage Style')} → ${tran('Song Font')}`,
                },
            ),
        );
        if (read.isFontMissing === true) {
            notes.push(
                fillWords(
                    tran(
                        '{font} is not installed on this computer, so it ' +
                            'shows in the app font here.',
                    ),
                    { font: read.fontFamily },
                ),
            );
        }
    }
    return notes;
}

function genHeadingNote(read: DocumentWordsAnswerType) {
    const all = read.headings ?? [];
    if (all.length === 0) {
        return [];
    }
    return [
        fillWords(
            tran(
                'I left out the headings at the top of its slides: ' +
                    '{headings}.',
            ),
            {
                headings: all
                    .slice(0, 4)
                    .map((heading) => {
                        return `“${heading}”`;
                    })
                    .join(', '),
            },
        ),
    ];
}

function genNoDocumentText() {
    return tran(
        'There is no PowerPoint, Word, PDF or slide file in your Documents ' +
            'list. Add the file there first, then ask me again.',
    );
}

function genPicturesOfferText() {
    return tran(
        'Press Read the words off the pictures and an assistant that can ' +
            'see pictures will read them.',
    );
}

function genPicturesAction(name: string) {
    return toAction(LYRIC_DOCUMENT_PICTURES_LABEL, { step: 'pictures', name });
}

async function draftDocumentWords(
    name: string,
    read: DocumentWordsAnswerType,
    text: string,
    deps: LyricDocumentDepsType,
    extra: { notes: string[]; actions: BotActionType[] },
): Promise<BotAnswerType> {
    const raw = await deps.callTool('owa_lyric_validate', {
        text,
        mode: 'draft',
        title: read.title,
    });
    const answer = genLyricDraftAnswer(
        raw,
        fillWords(
            tran(
                'I read {site} and wrote the song on it out for the Lyric ' +
                    'Editor.',
            ),
            { site: `“${name}”` },
        ),
        {
            fontFamily:
                typeof read.fontFamily === 'string' ? read.fontFamily : null,
            notes: [
                ...genHeadingNote(read),
                ...genFontNotes(read),
                ...extra.notes,
            ],
            actions: extra.actions,
        },
    );
    if (answer !== null) {
        return answer;
    }
    return {
        text: fillWords(
            tran(
                'I read {site} but could not find a song on it. If the ' +
                    'words are in front of you, paste them here and I will ' +
                    'write them out.',
            ),
            { site: `“${name}”` },
        ),
        actions: extra.actions,
    };
}

async function runRead(
    name: string,
    deps: LyricDocumentDepsType,
): Promise<BotAnswerType> {
    deps.report?.(fillWords(tran('Reading {name} from the app'), { name }));
    const { text } = await deps.callToolWithPictures('owa_media_file', {
        action: 'info',
        kind: 'document',
        name,
    });
    const read = parseDocumentWords(text);
    if (read === null) {
        throw new Error('The words of the document did not come back.');
    }
    const pictureNeeded = read.pictureNeededPages ?? [];
    const hasWords = (read.blocks ?? []).length > 0;
    if (!hasWords) {
        return pictureNeeded.length > 0
            ? {
                  text: [
                      fillWords(
                          tran(
                              'I could not read any words in "{name}": its ' +
                                  'pages are pictures, or in a font that ' +
                                  'does not copy.',
                          ),
                          { name },
                      ),
                      genPicturesOfferText(),
                  ].join(' '),
                  actions: [genPicturesAction(name)],
              }
            : {
                  text: fillWords(
                      tran(
                          'I read {site} but could not find a song on it. If ' +
                              'the words are in front of you, paste them here ' +
                              'and I will write them out.',
                      ),
                      { site: `“${name}”` },
                  ),
              };
    }
    return await draftDocumentWords(name, read, read.text ?? '', deps, {
        notes:
            pictureNeeded.length > 0
                ? [
                      [
                          tran(
                              'Some of its pages have no words I can read: ' +
                                  'they are pictures, or in a font that does ' +
                                  'not copy.',
                          ),
                          genPicturesOfferText(),
                      ].join(' '),
                  ]
                : [],
        actions: pictureNeeded.length > 0 ? [genPicturesAction(name)] : [],
    });
}

async function runPictures(
    name: string,
    deps: LyricDocumentDepsType,
): Promise<BotAnswerType> {
    deps.report?.(fillWords(tran('Reading {name} from the app'), { name }));
    const { text, pictures } = await deps.callToolWithPictures(
        'owa_media_file',
        { action: 'info', kind: 'document', name, pictures: true },
    );
    const read = parseDocumentWords(text);
    if (read === null) {
        throw new Error('The words of the document did not come back.');
    }
    const pictureFor = read.pictureFor ?? [];
    if (pictures.length === 0 || pictureFor.length === 0) {
        return {
            text: tran(
                'I could not read the words off the pictures just now. ' +
                    'Press the button again in a moment.',
            ),
            actions: [genPicturesAction(name)],
        };
    }
    const transcribed = await deps.transcribe(
        pictures.slice(0, pictureFor.length),
    );
    if (transcribed === null) {
        return {
            text: tran(
                'No assistant here can see pictures, so I could not read ' +
                    'those pages. Choose one that can, or add an AI key in ' +
                    'Settings, then press the button again.',
            ),
            actions: [
                {
                    label: 'Open AI settings',
                    toolName: OPEN_AI_SETTING_TOOL_NAME,
                },
                genPicturesAction(name),
            ],
        };
    }
    const wordsMap = readPictureWords(transcribed.text, pictureFor.length);
    const pictureBlocks: DocumentWordsBlockType[] = [];
    wordsMap.forEach((words, index) => {
        pictureBlocks.push({ page: pictureFor[index - 1], text: words });
    });
    if (pictureBlocks.length === 0) {
        return {
            text: tran(
                'I could not read the words off the pictures just now. ' +
                    'Press the button again in a moment.',
            ),
            actions: [genPicturesAction(name)],
        };
    }
    const { text: joined } = joinDocumentWords(read.title ?? toNameStem(name), [
        ...(read.blocks ?? []),
        ...pictureBlocks,
    ]);
    return await draftDocumentWords(name, read, joined, deps, {
        notes: [
            fillWords(
                tran(
                    '{who} read the words of {count} pages off pictures. ' +
                        'Check them before you save.',
                ),
                { who: transcribed.who, count: String(pictureBlocks.length) },
            ),
        ],
        actions: [],
    });
}

/**
 * One step of the conversation. Never throws for a person to read: a tool
 * that failed is said in a sentence, and the reason goes to the log.
 */
export async function runLyricDocumentStep(
    state: LyricDocumentStateType,
    deps: LyricDocumentDepsType,
): Promise<BotAnswerType> {
    try {
        if (state.step === 'list') {
            const listed = JSON.parse(
                await deps.callTool('owa_media_file', {
                    action: 'list',
                    kind: 'document',
                }),
            );
            const names: string[] = Array.isArray(listed?.names)
                ? listed.names.filter((name: unknown) => {
                      return typeof name === 'string';
                  })
                : [];
            const named =
                state.words === undefined
                    ? null
                    : findNamedDocumentFile(
                          state.words,
                          names.filter((name) => {
                              const kind = toLyricDocumentKind(name);
                              return (
                                  kind !== null && state.kinds.includes(kind)
                              );
                          }),
                      );
            if (named !== null) {
                return await runRead(named, deps);
            }
            return genLyricDocumentListAnswer(names, state);
        }
        if (state.step === 'read') {
            return await runRead(state.name, deps);
        }
        return await runPictures(state.name, deps);
    } catch (error) {
        appError(error, 'lyric from a document');
        const name = state.step === 'list' ? null : state.name;
        return {
            text:
                name === null
                    ? genNoDocumentText()
                    : fillWords(
                          tran('I could not open "{name}" to read its words.'),
                          { name },
                      ),
        };
    }
}

/** What the waiting line says while a step runs. */
export function describeLyricDocumentStep(state: LyricDocumentStateType) {
    if (state.step === 'list') {
        return null;
    }
    return fillWords(tran('Reading {name} from the app'), {
        name: state.name,
    });
}

/** Checked at the press: a saved button is a hand-editable file. */
export function toValidLyricDocumentState(
    value: unknown,
): LyricDocumentStateType | null {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    const state = value as Record<string, unknown>;
    if (state.step === 'list') {
        const kinds = Array.isArray(state.kinds)
            ? state.kinds.filter((kind): kind is LyricDocumentKindType => {
                  return LYRIC_DOCUMENT_KIND_LIST.includes(
                      kind as LyricDocumentKindType,
                  );
              })
            : [];
        const offset = Number(state.offset);
        return {
            step: 'list',
            kinds: kinds.length === 0 ? [...LYRIC_DOCUMENT_KIND_LIST] : kinds,
            ...(Number.isInteger(offset) && offset > 0 ? { offset } : {}),
            ...(typeof state.words === 'string' &&
            state.words.length <= MAX_ASK_LENGTH
                ? { words: state.words }
                : {}),
        };
    }
    if (
        (state.step === 'read' || state.step === 'pictures') &&
        typeof state.name === 'string' &&
        state.name.trim() !== '' &&
        state.name.length <= 260 &&
        !/[\\/]/.test(state.name) &&
        toLyricDocumentKind(state.name) !== null
    ) {
        return { step: state.step, name: state.name.trim() };
    }
    return null;
}

/** The ask that comes after a pressed transcription, put to the model. */
export function genPictureWordsAsk(count: number) {
    return (
        `Read the song's words off these ${count} picture(s), in order. ` +
        'Write each picture\'s marker line, "=== picture N ===", then its ' +
        'words.'
    );
}
