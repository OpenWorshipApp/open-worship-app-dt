/**
 * A song out of a document file, asked for with NO file attached
 * (2026-11-13, `EC-590`; the user, a tab answering _new lyric from
 * powerpoint_ and _turn powerpoint to lyric_ with "The app cannot turn a
 * PowerPoint file into a lyric file": _chatbot have to support turning
 * powerpoint to lyric, it related to creating lyric from documents file_,
 * then the goal _chatbot can understand and turn powerpoint to lyric_, then
 * _after powerpoint to lyric then appdocument to lyric_ and _also add other
 * support like docx pdf ..._).
 *
 * The window could already draft a song from an attached deck's words
 * (`EC-589`) with no model. Asked with nothing attached, the ask went to a
 * model, and _new lyric from powerpoint_ carries two rows' keyword phrases
 * on two pages (_new lyric_, W-15; _lyric from powerpoint_, W-42), so it was
 * handed no page and answered that the app cannot. Now the window answers
 * such an ask itself: the slide documents, PowerPoint decks, Word files and
 * PDFs of the Documents list (`owa_media_file` `list`, kind `document`) --
 * the kind the ask named first -- as one button each, which drafts that
 * file's song (its words read by `documentWordsHelpers.ts`), or, when the
 * ask names the song and one file fits, that song at once.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import { fillWords, tran } from './chatTranHelpers';
import { checkIsSongDocumentName } from './documentTextHelpers';

/**
 * The pseudo tool a deck's button carries (`args.filePath`, `args.name`):
 * the window reads that file and drafts its song. Never sent to a model.
 */
export const DECK_SONG_TOOL_NAME = 'owa-deck-song';

/** How many files of the Documents list are offered as buttons. */
export const MAX_DECK_BUTTON_COUNT = 6;

/**
 * The card button that drafts the attached deck, done by the window in any
 * language (`findWindowDoneCardAsk` asks it in this English).
 */
export const DECK_SONG_REPLY = 'Make a song from it';

const MAX_DECK_SONG_ASK_WORDS = 24;

// Each kind of document a song is made from, as a volunteer says it: a
// PowerPoint deck, a Word file, a PDF, a slide document of this app.
const PPTX_WORD_SOURCE =
    '(?:power\\s*-?\\s*points?|pptx|ppt|slide\\s+decks?|decks?)';
const DOCX_WORD_SOURCE = '(?:docx|word\\s+(?:files?|documents?|docs?))';
const PDF_WORD_SOURCE = 'pdfs?';
const OWS_WORD_SOURCE = '(?:slide\\s+documents?|app\\s+documents?)';
// Any of them, or a document file of no kind said.
const DECK_WORD_SOURCE =
    `(?:${PPTX_WORD_SOURCE}|${DOCX_WORD_SOURCE}|${PDF_WORD_SOURCE}|` +
    `${OWS_WORD_SOURCE}|documents?\\s+files?)`;
const DECK_WORD_PATTERN = new RegExp(`\\b${DECK_WORD_SOURCE}\\b`, 'i');
const KIND_PATTERN_LIST: [SongDocumentKindType, RegExp][] = [
    ['pptx', new RegExp(`\\b${PPTX_WORD_SOURCE}\\b`, 'i')],
    ['docx', new RegExp(`\\b${DOCX_WORD_SOURCE}\\b`, 'i')],
    ['pdf', new RegExp(`\\b${PDF_WORD_SOURCE}\\b`, 'i')],
    ['ows', new RegExp(`\\b${OWS_WORD_SOURCE}\\b`, 'i')],
];
const SONG_WORD_SOURCE = '(?:songs?|lyrics?|hymns?)';
const SONG_WORD_PATTERN = new RegExp(`\\b${SONG_WORD_SOURCE}\\b`, 'i');
// What turns one into the other: a verb, or the words that say which way.
const TURN_WORD_PATTERN =
    /\b(?:turn|turns|turning|convert|converts|converting|change|transform|make|makes|making|create|creating|import|importing|extract|generate|build|draft|get|new|into|from)\b/i;
const DECK_TO_SONG_PATTERN = new RegExp(
    `${DECK_WORD_SOURCE}\\b.*\\b(?:to|into|as)\\b.*\\b${SONG_WORD_SOURCE}`,
    'i',
);
// A bare "document" counts only said the way round a song is made from it
// -- _new lyric from my document_, _turn the document into a song_: alone,
// _How do I make a new song document?_ is about making a song.
const FROM_DOCUMENT_PATTERN =
    /\bfrom\s+(?:an?\s+|the\s+|my\s+|our\s+|this\s+|that\s+)*(?:[\w-]+\s+)?documents?\b/i;
const DOCUMENT_TO_SONG_PATTERN = new RegExp(
    `\\bdocuments?\\b.*\\b(?:to|into|as)\\b.*\\b${SONG_WORD_SOURCE}`,
    'i',
);
// The other way round -- a song put INTO a deck, or a deck made of one --
// is exporting, which the Documents list's own menu does.
const EXPORT_WORD_PATTERN = /\b(?:export|exporting|save|print)\b/i;
const SONG_TO_DECK_PATTERN = new RegExp(
    `\\b${SONG_WORD_SOURCE}\\b.*\\b(?:to|into|as)\\s+(?:an?\\s+|the\\s+|my\\s+|new\\s+)*${DECK_WORD_SOURCE}\\b`,
    'i',
);
const FROM_SONG_PATTERN = new RegExp(
    `\\bfrom\\s+(?:an?\\s+|the\\s+|my\\s+|this\\s+|that\\s+)*${SONG_WORD_SOURCE}\\b`,
    'i',
);
const MAKE_DECK_PATTERN = new RegExp(
    `\\b(?:make|create|build|generate)\\s+(?:an?\\s+|the\\s+|my\\s+|new\\s+)*${DECK_WORD_SOURCE}\\b`,
    'i',
);

// The words of such an ask that are no part of a song's name.
const ASK_FILLER_WORD_SET = new Set(
    (
        'a an the my our your this that these those it its them all any ' +
        'every each some to into from of for with in on at as by and or ' +
        'please can could would will you i me us we do does how what which ' +
        'is are be there here out up file files document documents doc docs ' +
        'list folder new one ones called named titled lyric lyrics song ' +
        'songs hymn hymns power point points powerpoint powerpoints pptx ppt ' +
        'slide slides deck decks docx word pdf pdfs app turn turns turning ' +
        'convert ' +
        'converts converting change transform make makes making create ' +
        'creating import importing extract generate build draft get want ' +
        'need help like just'
    ).split(' '),
);

/** A kind of document a song is made from, by its file's extension. */
export type SongDocumentKindType = 'pptx' | 'docx' | 'pdf' | 'ows';

export const SONG_DOCUMENT_KIND_LIST: readonly SongDocumentKindType[] = [
    'ows',
    'pptx',
    'docx',
    'pdf',
];

export type DeckSongAskType = {
    /** Words that may name the song (lower case), none when it named none. */
    nameWords: string[];
    /** The kinds the ask named, or every kind when it named none. */
    kinds: SongDocumentKindType[];
};

function toNameWords(text: string): string[] {
    const quoted = /["“”«»]([^"“”«»\n]{2,80})["“”«»]/u.exec(text)?.[1];
    const source = quoted ?? text;
    const words = source
        .toLowerCase()
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .filter((word) => {
            return word !== '' && !ASK_FILLER_WORD_SET.has(word);
        });
    return [...new Set(words)];
}

function toAskKinds(text: string): SongDocumentKindType[] {
    const named = KIND_PATTERN_LIST.filter(([, pattern]) => {
        return pattern.test(text);
    }).map(([kind]) => {
        return kind;
    });
    return named.length > 0 ? named : [...SONG_DOCUMENT_KIND_LIST];
}

/**
 * Is this an ask to make a song out of a document file -- _turn powerpoint
 * to lyric_, _new lyric from powerpoint_, _Can you turn a PowerPoint song
 * into a lyric file?_, _make a song from my PDF_, _turn my slide document
 * into a lyric_ -- and, when it names the song, its name's words, and the
 * kinds of file it named? Null for anything else: a song put into a
 * document (_export the song to PowerPoint_), a document shown or added, a
 * long message. The caller asks it only with nothing attached; with a
 * document attached or open it is `checkIsDocumentSongAsk`'s.
 */
export function readDeckSongAsk(text: string): DeckSongAskType | null {
    const trimmed = String(text ?? '').trim();
    if (
        trimmed === '' ||
        trimmed.startsWith('/') ||
        trimmed.includes('\n') ||
        trimmed.includes('```') ||
        /https?:\/\//i.test(trimmed) ||
        trimmed.split(/\s+/).length > MAX_DECK_SONG_ASK_WORDS
    ) {
        return null;
    }
    if (
        !SONG_WORD_PATTERN.test(trimmed) ||
        !(
            DECK_WORD_PATTERN.test(trimmed) ||
            FROM_DOCUMENT_PATTERN.test(trimmed) ||
            DOCUMENT_TO_SONG_PATTERN.test(trimmed)
        )
    ) {
        return null;
    }
    if (
        EXPORT_WORD_PATTERN.test(trimmed) ||
        SONG_TO_DECK_PATTERN.test(trimmed) ||
        FROM_SONG_PATTERN.test(trimmed) ||
        MAKE_DECK_PATTERN.test(trimmed)
    ) {
        return null;
    }
    if (
        !TURN_WORD_PATTERN.test(trimmed) &&
        !DECK_TO_SONG_PATTERN.test(trimmed) &&
        !DOCUMENT_TO_SONG_PATTERN.test(trimmed)
    ) {
        return null;
    }
    return { nameWords: toNameWords(trimmed), kinds: toAskKinds(trimmed) };
}

/**
 * A file a song can be drafted from with no model: a slide document, a
 * PowerPoint deck, a Word file, a PDF.
 */
export function checkIsDeckFileName(name: string) {
    return checkIsSongDocumentName(name);
}

function toKind(name: string) {
    return (/\.([a-z]+)$/i.exec(name)?.[1] ?? '').toLowerCase();
}

const MAX_DOCUMENT_SONG_ASK_WORDS = 16;
// What is made: a song, its words, its file.
const MADE_SONG_SOURCE =
    '(?:songs?|lyrics?|hymns?|lyric\\s+files?|song\\s+files?|chord\\s+sheets?)';
const DETERMINER_SOURCE =
    '(?:(?:a|an|the|new|my|our|its|their|one|some)\\s+){0,3}';
// A song made FROM the document: _make a song from it_, _create lyric files
// out of these_, _make a hymn of it_.
const SONG_FROM_DOCUMENT_PATTERN = new RegExp(
    '\\b(?:create|make|draft|write|generate|build|get|extract|import)\\s+' +
        `${DETERMINER_SOURCE}${MADE_SONG_SOURCE}\\s+(?:from|out\\s+of|` +
        'of\\s+(?:it|this|that|these|those|them)\\b)',
    'i',
);
// The document turned INTO one: _turn this into a lyric_, _convert the deck
// to a song_ -- the song the END of it, so _change the title to the song
// name_ and _change slide 2 to the song's chorus_ stay changes to slides.
const DOCUMENT_INTO_SONG_PATTERN = new RegExp(
    '\\b(?:turn|convert|change|transform|make)\\b.{0,60}?\\b(?:into|to|as)\\s+' +
        `${DETERMINER_SOURCE}${MADE_SONG_SOURCE}` +
        '(?=\\s*[.!,;]*\\s*$|\\s+(?:please|now|for\\s+(?:me|us|sunday|' +
        'church|worship|(?:the\\s+)?service))\\b)',
    'i',
);
const DECK_SAID_PATTERN = /\b(?:slide\s+)?decks?\b/i;
// A request put as a question: _Can you make a song from it?_
const POLITE_ASK_PATTERN =
    /^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?([^?]+?)\s*\?*$/i;

/**
 * Is this an ask to make a song of the documents in front of the person --
 * attached to it, or still open in the tab (`EC-590`)? A song made FROM
 * them (_Make a song from it_, the card's own button; _create lyric files
 * out of these_) or they turned INTO one (_turn this into a lyric_), as an
 * order or as _Can you …?_. A song word beside a verb is not enough: in a
 * slide document's own conversation _add the song title to slide 1_
 * changes its slides, and under a PDF _write a summary of the song_ is a
 * question about it.
 */
export function checkIsDocumentSongAsk(text: string) {
    const trimmed = String(text ?? '').trim();
    const plain = POLITE_ASK_PATTERN.exec(trimmed)?.[1] ?? trimmed;
    if (
        plain === '' ||
        plain.startsWith('/') ||
        plain.includes('?') ||
        plain.includes('\n') ||
        plain.includes('```') ||
        /https?:\/\//i.test(plain) ||
        plain.split(/\s+/).length > MAX_DOCUMENT_SONG_ASK_WORDS ||
        EXPORT_WORD_PATTERN.test(plain)
    ) {
        return false;
    }
    return (
        SONG_FROM_DOCUMENT_PATTERN.test(plain) ||
        DOCUMENT_INTO_SONG_PATTERN.test(plain)
    );
}

/**
 * Which of the documents still open in a tab a song ask is about: all of
 * them, unless the ask names a kind none of them is (_from my PDF_ with a
 * slide document open) or a name none of them has (_from the Amazing Grace
 * PowerPoint_) -- then null, and the Documents list answers it. The
 * documents attached to the ask itself are all of them, always.
 */
export function pickOpenSongDocuments<
    T extends { filePath: string; name: string },
>(files: readonly T[] | null, text: string): T[] | null {
    if (files === null || files.length === 0) {
        return null;
    }
    const ask = readDeckSongAsk(text);
    if (ask === null) {
        return [...files];
    }
    // A deck said with a slide document open is that document.
    const kinds: SongDocumentKindType[] = DECK_SAID_PATTERN.test(text)
        ? [...ask.kinds, 'ows']
        : ask.kinds;
    const ofKind = files.filter((file) => {
        return kinds.includes(toKind(file.filePath) as SongDocumentKindType);
    });
    if (ofKind.length === 0) {
        return null;
    }
    if (ask.nameWords.length === 0) {
        return ofKind;
    }
    const picked = pickFilesByName(
        ofKind.map((file) => {
            return file.name;
        }),
        ask.nameWords,
    );
    return picked.isNamed
        ? ofKind.filter((file) => {
              return picked.files.includes(file.name);
          })
        : null;
}

function toNameKey(name: string) {
    return ` ${name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .filter((word) => {
            return word !== '';
        })
        .join(' ')} `;
}

function pickFilesByName(
    decks: readonly string[],
    nameWords: readonly string[],
): { files: string[]; isNamed: boolean } {
    if (nameWords.length === 0 || decks.length === 0) {
        return { files: [...decks], isNamed: false };
    }
    const scored = decks.map((name) => {
        const key = toNameKey(name);
        const hits = nameWords.filter((word) => {
            return key.includes(` ${word}`);
        }).length;
        return { name, hits };
    });
    const best = Math.max(
        ...scored.map((one) => {
            return one.hits;
        }),
    );
    if (best === 0) {
        return { files: [...decks], isNamed: false };
    }
    return {
        files: scored
            .filter((one) => {
                return one.hits === best;
            })
            .map((one) => {
                return one.name;
            }),
        isNamed: true,
    };
}

/**
 * The documents of the Documents list a song ask is about, best first: of
 * the kinds the ask named (every kind when the list has none of them),
 * every file whose name holds every word named, else the files holding the
 * most of them, else every one -- in the list's own order. A name that
 * fits no file of the kinds named but fits one of another kind is that
 * file: _the Amazing Grace PowerPoint_ may well be a Word file. `isNamed`
 * says the words chose them.
 */
export function pickDeckFiles(
    names: readonly string[],
    nameWords: readonly string[],
    kinds: readonly SongDocumentKindType[] = SONG_DOCUMENT_KIND_LIST,
): { files: string[]; isNamed: boolean } {
    const all = names.filter((name) => {
        return checkIsDeckFileName(name);
    });
    const ofKind = all.filter((name) => {
        return kinds.includes(toKind(name) as SongDocumentKindType);
    });
    const first = pickFilesByName(ofKind.length > 0 ? ofKind : all, nameWords);
    if (first.isNamed || ofKind.length === 0 || ofKind.length === all.length) {
        return first;
    }
    const wider = pickFilesByName(all, nameWords);
    return wider.isNamed ? wider : first;
}

/** A file of a folder, written with the folder's own separator. */
export function toDeckFilePath(folder: string, name: string) {
    const separator =
        folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
    return folder.endsWith(separator)
        ? `${folder}${name}`
        : `${folder}${separator}${name}`;
}

export type DeckSongActionType = {
    label: string;
    toolName: string;
    args: { filePath: string; name: string };
};

/**
 * The answer to such an ask when no one file is settled: the documents of
 * the Documents list a song can be made from, a button each
 * (`MAX_DECK_BUTTON_COUNT` at most, how many more said), and the way to
 * attach another -- or, with none in the list, the way to attach one.
 * Labels in English: the window translates them where drawn (`Make a song
 * from "{name}"`).
 */
export function genDeckSongListAnswer(
    folder: string,
    files: readonly string[],
): { text: string; actions: DeckSongActionType[] } {
    if (files.length === 0) {
        return {
            text: tran(
                'Your Documents list has no slide document, PowerPoint, ' +
                    'Word file or PDF to make a song from. Attach one — the ' +
                    '⋮ at the left of the box, then Attach a file — or drop ' +
                    'it on this window, and ask me to make a song from it.',
            ),
            actions: [],
        };
    }
    const shown = files.slice(0, MAX_DECK_BUTTON_COUNT);
    const lines = [
        tran(
            'I can make a song out of the words on a slide document, a ' +
                'PowerPoint, a Word file or a PDF. Press one of the files in ' +
                'your Documents list below, or attach another: the ⋮ at the ' +
                'left of the box, then Attach a file.',
        ),
    ];
    // The FILE's name: the ask's words are matched against the names in
    // the list (`pickDeckFiles`), and a hymnal's decks may be numbered
    // rather than named after their songs.
    if (files.length > shown.length) {
        lines.push(
            fillWords(
                tran(
                    'These are {shown} of the {count} in your Documents ' +
                        'list. Say the file’s name in your question to find ' +
                        'another one.',
                ),
                { shown: shown.length, count: files.length },
            ),
        );
    }
    return {
        text: lines.join('\n\n'),
        actions: shown.map((name) => {
            return {
                label: `Make a song from "${name}"`,
                toolName: DECK_SONG_TOOL_NAME,
                args: { filePath: toDeckFilePath(folder, name), name },
            };
        }),
    };
}

/** A deck button's file, or null when its arguments are not one. */
export function readDeckSongArgs(
    args: unknown,
): { filePath: string; name: string } | null {
    const value = args as { filePath?: unknown; name?: unknown } | null;
    const filePath = value?.filePath;
    if (typeof filePath !== 'string' || !checkIsDeckFileName(filePath)) {
        return null;
    }
    const name =
        typeof value?.name === 'string' && value.name !== ''
            ? value.name
            : (filePath.split(/[\\/]/).pop() ?? filePath);
    return { filePath, name };
}
