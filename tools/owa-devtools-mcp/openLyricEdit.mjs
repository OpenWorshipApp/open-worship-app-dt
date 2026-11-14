// `owa_lyric_edit`: one change to a song, made by code from the WORDS a
// caller gives -- never from notation the caller wrote.
//
// Asked for 2026-11-06 (the user, with a copy of `Still` named for another
// language -- every line still English -- circled in the Documents list,
// asking that the chatbot help translate all its English into that language;
// and the operations: _add section: verse 1,
// verse 2 ...; translate text to another language; change text; add keynote_).
//
// WHY WORDS AND NOT A DOCUMENT. `owa_lyric_file update` takes the whole Open
// Lyric document, and a model cannot write that notation reliably (memory
// `model-cannot-write-open-lyric`: 9 problems in a plausible attempt, 2 in a
// careful one, both invisible from outside the grammar -- `CC` where `Cx2` is
// required, words inside an Instrumental). So here the caller names a part
// and hands over lines; this module splices them into the document it was
// given, rebuilds `Structure` with `toStructureText`, and checks the result
// with `validateOpenLyric` -- a change that ADDS a problem is refused with
// the validator's own sentence, and nothing is written.
//
// SURGICAL. The document is split into its fences and the text between them,
// and joining an untouched split gives back the same bytes: an edit replaces
// only the lines it is about, so a comment, an `Attachments` field, a
// strumming pattern and anything this module does not understand stay
// exactly as the person left them.
//
// Pure: no file, no app, no network. The tool reads the song's editing head
// through the app, calls `applyLyricEdit`, and writes the result back the
// same way (`owaTools.mjs`).

import {
    OPEN_LYRIC_FENCE_LIST,
    OPEN_LYRIC_KEY_LIST,
    OPEN_LYRIC_LOCALE_LIST,
    OPEN_LYRIC_TIME_LIST,
    checkIsOpenLyricChord,
    parseFenceInfo,
    parseStructure,
    validateOpenLyric,
} from './openLyric.mjs';
import { toSafeLyricLine, toStructureText } from './openLyricDraft.mjs';

/** Everything the tool does; `read` is the one that changes nothing. */
export const LYRIC_EDIT_ACTIONS = [
    'read',
    'set-lines',
    'add-translation',
    'set-chords',
    'replace',
    'remove-translations',
    'remove-chords',
    'add-section',
    'remove-section',
    'rename-section',
    'set-order',
    'set-config',
    'transpose',
];

export const LYRIC_EDIT_WRITE_ACTIONS = LYRIC_EDIT_ACTIONS.filter((one) => {
    return one !== 'read';
});

// The Config fields a caller may set: the single-line ones a person would
// ask about. `Structure` is `set-order`'s; the multi-line ones (Description,
// Attachments, Strumming Patterns) are the Lyric Editor's.
export const LYRIC_EDIT_CONFIG_FIELDS = [
    'Title',
    'Subtitle',
    'Artist',
    'Copyright',
    'Key',
    'Tempo',
    'Time',
    'Locales',
];

// Bounds: the lines arrive from a model, and this runs inside the process
// that serves the chatbot.
const MAX_SECTIONS = 40;
const MAX_LINES_PER_PART = 120;
const MAX_LINE_CHARS = 400;
const MAX_ORDER_ENTRIES = 60;
const MAX_REPEAT = 20;
const MAX_CONFIG_VALUE_CHARS = 200;
const MAX_REPORTED_PROBLEMS = 5;

const FENCE_OPEN_PATTERN = /^\s*```ol:(.*)$/;
const FENCE_CLOSE_PATTERN = /^\s*```\s*$/;
const COMMENT_PATTERN = /^\s*\/\//;
const CONFIG_FIELD_PATTERN = /^\s*-\s*(.+?)\s*:\s?(.*)$/;
const CHORD_ANNOTATION_PATTERN = /\[([^\]\r\n]+)\]/g;

const FENCE_MAP = new Map(
    OPEN_LYRIC_FENCE_LIST.map((one) => {
        return [one.header, one];
    }),
);

function fail(reason) {
    return { isError: true, reason };
}

// ---------------------------------------------------------------------------
// The document as fences and the text between them
// ---------------------------------------------------------------------------

function toFenceSegment(openLine, info) {
    const parsed = parseFenceInfo(info);
    const fence =
        parsed === null || parsed.isBadIndex === true
            ? undefined
            : FENCE_MAP.get(parsed.header);
    let partName = null;
    if (fence !== undefined) {
        if (parsed.indexText === null) {
            partName = parsed.header;
        } else if (
            fence.allowsNumbering &&
            /^[1-9]\d*$/.test(parsed.indexText)
        ) {
            partName = `${parsed.header} ${parsed.indexText}`;
        }
    }
    return {
        kind: 'fence',
        openLine,
        header: fence === undefined ? null : parsed.header,
        partName,
        bodyRule: fence?.bodyRule ?? null,
        body: [],
        closeLine: null,
    };
}

/**
 * The song as segments: `{kind: 'text', lines}` between fences and
 * `{kind: 'fence', openLine, header, partName, bodyRule, body, closeLine}`.
 * `serializeLyricDocument` joins it back, byte for byte when nothing changed.
 */
export function parseLyricDocument(text) {
    const source = String(text ?? '');
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const segments = [];
    let loose = [];
    let open = null;
    const flush = () => {
        if (loose.length > 0) {
            segments.push({ kind: 'text', lines: loose });
            loose = [];
        }
    };
    for (const line of source.split(/\r\n|\r|\n/)) {
        if (open !== null) {
            if (FENCE_CLOSE_PATTERN.test(line)) {
                open.closeLine = line;
                segments.push(open);
                open = null;
            } else {
                open.body.push(line);
            }
            continue;
        }
        const match = line.match(FENCE_OPEN_PATTERN);
        if (match === null) {
            loose.push(line);
            continue;
        }
        flush();
        open = toFenceSegment(line, match[1].trim());
    }
    if (open !== null) {
        segments.push(open);
    }
    flush();
    return { eol, segments };
}

export function serializeLyricDocument(doc) {
    const lines = [];
    for (const segment of doc.segments) {
        if (segment.kind === 'text') {
            lines.push(...segment.lines);
            continue;
        }
        lines.push(segment.openLine, ...segment.body);
        if (segment.closeLine !== null) {
            lines.push(segment.closeLine);
        }
    }
    return lines.join(doc.eol);
}

function findConfig(doc) {
    return (
        doc.segments.find((one) => {
            return one.kind === 'fence' && one.header === 'Config';
        }) ?? null
    );
}

function listParts(doc) {
    return doc.segments.filter((one) => {
        return (
            one.kind === 'fence' &&
            one.partName !== null &&
            one.header !== 'Config'
        );
    });
}

function listPartNames(doc) {
    return listParts(doc).map((one) => {
        return one.partName;
    });
}

// ---------------------------------------------------------------------------
// Part names as a person says them
// ---------------------------------------------------------------------------

function squash(text) {
    return text.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * `verse 2`, `Verse2`, `pre chorus` -> `{header, number}`; null when it names
 * no section open-lyric has. `Config` is not a part.
 */
export function toCanonicalPart(text) {
    const raw = String(text ?? '')
        .trim()
        .replace(/\s+/g, ' ');
    const match = raw.match(/^(.*?)\s*(\d+)?$/);
    if (match === null || match[1] === '') {
        return null;
    }
    const fence = OPEN_LYRIC_FENCE_LIST.find((one) => {
        return (
            one.header !== 'Config' && squash(one.header) === squash(match[1])
        );
    });
    if (fence === undefined) {
        return null;
    }
    if (match[2] === undefined) {
        return { header: fence.header, number: null };
    }
    const number = Number(match[2]);
    return number >= 1 ? { header: fence.header, number } : null;
}

function toPartName({ header, number }) {
    return number === null ? header : `${header} ${number}`;
}

function genNoSuchPartReason(doc, asked) {
    const names = listPartNames(doc);
    return (
        `There is no part called "${String(asked ?? '').slice(0, 60)}". ` +
        (names.length === 0
            ? 'The song has no parts yet; add one with add-section.'
            : `The song has: ${names.join(', ')}.`)
    );
}

/**
 * The part a caller means. Exact first; then `Chorus` for a song whose only
 * chorus is `Chorus 1`, and `Verse 1` for one whose only verse is `Verse`.
 */
function findPart(doc, asked) {
    const canonical = toCanonicalPart(asked);
    if (canonical === null) {
        return null;
    }
    const parts = listParts(doc);
    const name = toPartName(canonical);
    const exact = parts.find((one) => {
        return one.partName === name;
    });
    if (exact !== undefined) {
        return exact;
    }
    const sameHeader = parts.filter((one) => {
        return one.header === canonical.header;
    });
    if (
        sameHeader.length === 1 &&
        (canonical.number === null || canonical.number === 1)
    ) {
        return sameHeader[0];
    }
    return null;
}

/** The code a part plays under in `Structure`: `Verse 2` -> `V2`. */
function toPartCode(partName) {
    const parsed = parseFenceInfo(partName);
    const fence = FENCE_MAP.get(parsed.header);
    return `${fence.structureCode}${parsed.indexText ?? ''}`;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readConfigFieldMap(config) {
    const map = new Map();
    config.body.forEach((line, index) => {
        if (/^\s/.test(line) || COMMENT_PATTERN.test(line)) {
            return;
        }
        const match = line.match(CONFIG_FIELD_PATTERN);
        if (match !== null && !map.has(match[1])) {
            map.set(match[1], { index, value: match[2].trim() });
        }
    });
    return map;
}

function setConfigValue(config, name, value) {
    const map = readConfigFieldMap(config);
    const line = `- ${name}: ${value}`;
    const found = map.get(name);
    if (found !== undefined) {
        config.body[found.index] = line;
        return;
    }
    // Before `Structure`, the order every song this app writes keeps.
    const structure = map.get('Structure');
    if (structure !== undefined) {
        config.body.splice(structure.index, 0, line);
        return;
    }
    let at = config.body.length;
    while (at > 0 && config.body[at - 1].trim() === '') {
        at -= 1;
    }
    config.body.splice(at, 0, line);
}

function removeConfigValue(config, name) {
    const found = readConfigFieldMap(config).get(name);
    if (found === undefined) {
        return false;
    }
    let end = found.index + 1;
    while (end < config.body.length && /^\s+\S/.test(config.body[end])) {
        end += 1;
    }
    config.body.splice(found.index, end - found.index);
    return true;
}

function readConfigValue(doc, name) {
    const config = findConfig(doc);
    if (config === null) {
        return null;
    }
    const value = readConfigFieldMap(config).get(name)?.value ?? '';
    return value === '' ? null : value;
}

/** The play order, or `isPartial` when the Structure line could not be read. */
function readPlayOrder(doc) {
    const value = readConfigValue(doc, 'Structure');
    if (value === null) {
        return { order: [], isPartial: false, isMissing: true };
    }
    let problemCount = 0;
    const result = parseStructure(
        value,
        { number: 0, line: '', part: 'Config' },
        new Set(listPartNames(doc)),
        () => {
            problemCount += 1;
        },
    );
    return {
        order: result.order,
        isPartial: result.isPartial || problemCount > 0,
        isMissing: false,
    };
}

function toStructureValue(order) {
    return toStructureText(
        order.flatMap((one) => {
            return Array.from({ length: one.repeat }, () => {
                return toPartCode(one.partName);
            });
        }),
    );
}

function writePlayOrder(doc, order) {
    setConfigValue(findConfig(doc), 'Structure', toStructureValue(order));
}

const BROKEN_STRUCTURE_REASON =
    "The song's Structure line could not be read, so the play order was " +
    'not changed. Write the whole play order with set-order first.';

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

const checkIsSungLine = (line) => {
    return (
        line.trim() !== '' && !COMMENT_PATTERN.test(line) && !/^\s/.test(line)
    );
};

const checkIsTranslationLine = (line) => {
    return (
        line.trim() !== '' && /^\s/.test(line) && !COMMENT_PATTERN.test(line)
    );
};

function listSungIndexes(fence) {
    const indexes = [];
    fence.body.forEach((line, index) => {
        if (checkIsSungLine(line)) {
            indexes.push(index);
        }
    });
    return indexes;
}

function checkHasChord(line) {
    for (const match of line.matchAll(CHORD_ANNOTATION_PATTERN)) {
        if (checkIsOpenLyricChord(match[1])) {
            return true;
        }
    }
    return false;
}

/** The words of a line with its chords and bars taken out, for comparing. */
function toBareWords(line) {
    return line
        .replace(CHORD_ANNOTATION_PATTERN, '')
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function checkIsNotationLine(line) {
    return /^\s*```/.test(line) || /^\s*ol:/i.test(line);
}

const NOTATION_REASON =
    'A line may not be a fence (```) or an ol: header -- give the words ' +
    'only; the song notation is written by the app.';

/** One line as the caller gave it, made safe: never a translation by accident. */
function toCleanLine(raw) {
    return toSafeLyricLine(String(raw).replace(/^\s+/, '')).replace(/\s+$/, '');
}

/**
 * The lines of a part as given: each entry may hold several lines, a blank
 * entry is a blank line, and the blank lines at either end go.
 */
function toCleanLines(lines, partName) {
    if (!Array.isArray(lines)) {
        return fail(`Give the lines of ${partName} as a list of text lines.`);
    }
    const out = [];
    for (const raw of lines) {
        if (typeof raw !== 'string') {
            return fail(`Every line of ${partName} must be text.`);
        }
        for (const piece of raw.split(/\r\n|\r|\n/)) {
            if (checkIsNotationLine(piece)) {
                return fail(NOTATION_REASON);
            }
            const cleaned = toCleanLine(piece);
            if (cleaned.length > MAX_LINE_CHARS) {
                return fail(
                    `A line of ${partName} is ${cleaned.length} characters; ` +
                        `${MAX_LINE_CHARS} is the most one line may hold.`,
                );
            }
            out.push(cleaned);
        }
    }
    while (out.length > 0 && out[0] === '') {
        out.shift();
    }
    while (out.length > 0 && out[out.length - 1] === '') {
        out.pop();
    }
    if (out.length > MAX_LINES_PER_PART) {
        return fail(
            `${partName} would have ${out.length} lines; ` +
                `${MAX_LINES_PER_PART} is the most one part may hold.`,
        );
    }
    return { lines: out };
}

/**
 * One line per sung line, in order: a newline inside an entry is a space,
 * never a second line, and a blank entry means "leave this line alone".
 */
function toOneLineEach(lines, partName) {
    if (!Array.isArray(lines)) {
        return fail(`Give the lines of ${partName} as a list of text lines.`);
    }
    const out = [];
    for (const raw of lines) {
        if (typeof raw !== 'string') {
            return fail(`Every line of ${partName} must be text.`);
        }
        if (checkIsNotationLine(raw)) {
            return fail(NOTATION_REASON);
        }
        const cleaned = toCleanLine(raw.replace(/\s*(?:\r\n|\r|\n)\s*/g, ' '));
        if (cleaned.length > MAX_LINE_CHARS) {
            return fail(
                `A line of ${partName} is ${cleaned.length} characters; ` +
                    `${MAX_LINE_CHARS} is the most one line may hold.`,
            );
        }
        out.push(cleaned);
    }
    return { lines: out };
}

function takeLeadingComments(body) {
    const kept = [];
    for (const line of body) {
        if (!COMMENT_PATTERN.test(line)) {
            break;
        }
        kept.push(line);
    }
    return kept;
}

/** `sections`, or the one `part` + `lines` a caller may give instead. */
function toSectionList(request) {
    const list = Array.isArray(request?.sections)
        ? request.sections
        : request?.part !== undefined
          ? [{ part: request.part, lines: request.lines }]
          : null;
    if (list === null || list.length === 0) {
        return fail(
            'Name the parts to change: `sections` as [{part, lines}], or ' +
                '`part` with `lines`.',
        );
    }
    if (list.length > MAX_SECTIONS) {
        return fail(`${MAX_SECTIONS} parts at most in one change.`);
    }
    for (const one of list) {
        if (one === null || typeof one !== 'object') {
            return fail('Each section is {part, lines}.');
        }
    }
    return { list };
}

// ---------------------------------------------------------------------------
// Keys, chords and locales
// ---------------------------------------------------------------------------

const NOTE_PITCH_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
];
const FLAT_NAMES = [
    'C',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'Gb',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
];
// C and A minor have no accidental of their own: what a band reads there is
// the borrowed Bb, Eb and Ab and the F# of a D/F#.
const NEUTRAL_NAMES = [
    'C',
    'C#',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
];
const FLAT_KEY_SET = new Set([
    'F',
    'Bb',
    'Eb',
    'Ab',
    'Db',
    'Gb',
    'Dm',
    'Gm',
    'Cm',
    'Fm',
    'Bbm',
    'Ebm',
]);
const NEUTRAL_KEY_SET = new Set(['C', 'Am']);

function toPitch(note) {
    const base = NOTE_PITCH_MAP[note[0]];
    const shift = note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0;
    return (base + shift + 12) % 12;
}

/**
 * A key as a person writes it -- `g`, `Eb`, `C#`, `A minor`, `f# m` -- as
 * one of open-lyric's 26, or null. A key the list spells the other way round
 * (`C#` major is `Db` there, `Abm` is `G#m`) is taken by its sound.
 */
export function toLyricKey(text) {
    const raw = String(text ?? '')
        .trim()
        .replace(/\s+/g, ' ');
    const match = raw.match(
        /^([A-Ga-g])\s*(#|b|♯|♭)?\s*(m|min|minor|maj|major)?$/,
    );
    if (match === null) {
        return null;
    }
    const letter = match[1].toUpperCase();
    const accidental =
        match[2] === '♯' ? '#' : match[2] === '♭' ? 'b' : (match[2] ?? '');
    const isMinor = match[3] !== undefined && /^m(in(or)?)?$/.test(match[3]);
    const spelled = `${letter}${accidental}${isMinor ? 'm' : ''}`;
    if (OPEN_LYRIC_KEY_LIST.includes(spelled)) {
        return spelled;
    }
    const pitch = toPitch(`${letter}${accidental}`);
    return (
        OPEN_LYRIC_KEY_LIST.find((one) => {
            const isOneMinor = one.endsWith('m');
            const root = isOneMinor ? one.slice(0, -1) : one;
            return isOneMinor === isMinor && toPitch(root) === pitch;
        }) ?? null
    );
}

function toNoteName(pitch, original, names) {
    if (names !== null) {
        return names[pitch];
    }
    return original.includes('b') ? FLAT_NAMES[pitch] : SHARP_NAMES[pitch];
}

function pickNoteNames(targetKey, original) {
    if (FLAT_KEY_SET.has(targetKey)) {
        return FLAT_NAMES;
    }
    if (NEUTRAL_KEY_SET.has(targetKey)) {
        // The chord's own spelling when it had one; the band's usual
        // borrowed chords when it did not.
        return /[#b]/.test(original.slice(1, 2)) ? null : NEUTRAL_NAMES;
    }
    return SHARP_NAMES;
}

/** One chord moved `semitones` up, spelled for `targetKey`. */
export function transposeChord(chord, semitones, targetKey) {
    const match = String(chord).match(
        /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/,
    );
    if (match === null) {
        return chord;
    }
    const move = (note) => {
        const pitch = (toPitch(note) + semitones + 120) % 12;
        return toNoteName(pitch, note, pickNoteNames(targetKey, note));
    };
    const root = move(match[1]);
    const bass = match[3] === undefined ? '' : `/${move(match[3])}`;
    return `${root}${match[2]}${bass}`;
}

function checkIsProgressionLine(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{p:') || trimmed.startsWith('{c:')) {
        return true;
    }
    return (
        trimmed.includes('|') &&
        trimmed.split(/\s+/).some((token) => {
            return checkIsOpenLyricChord(token);
        })
    );
}

function transposeAnnotations(line, move) {
    let count = 0;
    const out = line.replace(CHORD_ANNOTATION_PATTERN, (whole, inner) => {
        if (!checkIsOpenLyricChord(inner)) {
            return whole;
        }
        count += 1;
        return `[${move(inner)}]`;
    });
    return { line: out, count };
}

function transposeTokens(line, move) {
    let count = 0;
    // A `{c: …}` cue is words, and `{p: #1}` a pattern number: left alone.
    const out = line.replace(/(\{[^}]*\})|([^\s{}]+)/g, (whole, brace) => {
        if (brace !== undefined || !checkIsOpenLyricChord(whole)) {
            return whole;
        }
        count += 1;
        return move(whole);
    });
    return { line: out, count };
}

function toLocaleList(value) {
    const items = (
        Array.isArray(value) ? value : String(value ?? '').split(',')
    )
        .map((one) => {
            return String(one).trim().replace(/_/g, '-');
        })
        .filter((one) => {
            return one !== '';
        });
    if (items.length === 0) {
        return { list: [] };
    }
    const out = [];
    for (const item of items) {
        const found = OPEN_LYRIC_LOCALE_LIST.find((one) => {
            return one.toLowerCase() === item.toLowerCase();
        });
        if (found === undefined) {
            return fail(
                `"${item.slice(0, 20)}" is not a locale tag Open Lyric knows. ` +
                    'Write a language and region, e.g. en-US or es-ES.',
            );
        }
        if (!out.includes(found)) {
            out.push(found);
        }
    }
    return { list: out };
}

function applyLocales(state, locales) {
    if (locales === undefined || locales === null) {
        return null;
    }
    const read = toLocaleList(locales);
    if (read.isError) {
        return read.reason;
    }
    const config = findConfig(state.doc);
    if (read.list.length === 0) {
        if (removeConfigValue(config, 'Locales')) {
            state.changes.push('took out Locales');
        }
        return null;
    }
    const value = read.list.join(', ');
    if (readConfigValue(state.doc, 'Locales') !== value) {
        setConfigValue(config, 'Locales', value);
        state.changes.push(`Locales: ${value}`);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Words changed in place (2026-11-12, EC-511)
// ---------------------------------------------------------------------------
//
// A song's WORDS are changed far more often than its parts -- a misspelt
// word, "thee" made "you" all through, one line said another way -- and
// `set-lines` alone did that: it wrote each part back as the lines it was
// given, so a one-letter fix took the translation line from under every
// line of the verse, and its chords too unless the model copied every `[G]`
// back exactly. Asked live on the free model, _Check the whole song for
// spelling mistakes and fix them_ was answered "I have corrected the
// spelling" over a verse that had lost 11 chords and 4 translation lines;
// the warning saying so reached the model, which offered to "restore" them
// -- there was no way to, short of retyping. So the words are the caller's
// and the rest stays the song's: a line given back keeps the lines under it,
// and its chords when it comes with none, carried word for word onto the
// words that stayed and by place onto the ones that changed -- when it is
// recognisably the same line (half its words or more). A line rewritten
// whole is new words, and what went with the old one is said, as before.
// And `replace` changes a word or a phrase where it stands, however often
// the song sings it, with nothing else touched.

// Words as the browser's word breaker draws them: a script written with no
// spaces between its words is cut by its dictionary, so "a whole word" means
// the same thing in every language a song is written in.
const WORD_SEGMENTER =
    typeof Intl?.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'word' })
        : null;

// A line is "the same line" given back when at least this share of its
// words is still there, in order.
const SAME_LINE_SHARE = 0.5;
const MAX_REPLACEMENTS = 40;
const MAX_FIND_CHARS = 200;

/** A line's words with its chords taken out, and where each chord stood. */
function splitChords(line) {
    const chords = [];
    let bare = '';
    let last = 0;
    for (const match of String(line).matchAll(CHORD_ANNOTATION_PATTERN)) {
        if (!checkIsOpenLyricChord(match[1])) {
            continue;
        }
        bare += line.slice(last, match.index);
        chords.push({ at: bare.length, token: match[0] });
        last = match.index + match[0].length;
    }
    bare += String(line).slice(last);
    return { bare, chords };
}

/** The line again: each chord put back in front of the letter at `at`. */
function joinChords(bare, chords) {
    const sorted = chords
        .map((one, order) => {
            return { ...one, order };
        })
        .sort((a, b) => {
            return a.at - b.at || a.order - b.order;
        });
    let out = '';
    let last = 0;
    for (const chord of sorted) {
        const at = Math.max(last, Math.min(chord.at, bare.length));
        out += bare.slice(last, at) + chord.token;
        last = at;
    }
    return out + bare.slice(last);
}

/** Every word of a text: where it starts and ends, and a key to compare. */
function listWords(text) {
    const value = String(text ?? '');
    if (WORD_SEGMENTER === null) {
        return [...value.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((match) => {
            return {
                start: match.index,
                end: match.index + match[0].length,
                key: match[0].toLowerCase(),
            };
        });
    }
    const words = [];
    for (const one of WORD_SEGMENTER.segment(value)) {
        if (one.isWordLike) {
            words.push({
                start: one.index,
                end: one.index + one.segment.length,
                key: one.segment.toLowerCase(),
            });
        }
    }
    return words;
}

/**
 * For each word of `oldKeys`, the index of the same word in `newKeys` -- the
 * longest run of words the two share, in order -- or -1.
 */
function matchWordIndexes(oldKeys, newKeys) {
    const rows = oldKeys.length;
    const columns = newKeys.length;
    const table = Array.from({ length: rows + 1 }, () => {
        return new Array(columns + 1).fill(0);
    });
    for (let i = rows - 1; i >= 0; i -= 1) {
        for (let j = columns - 1; j >= 0; j -= 1) {
            table[i][j] =
                oldKeys[i] === newKeys[j]
                    ? table[i + 1][j + 1] + 1
                    : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }
    const map = new Array(rows).fill(-1);
    let i = 0;
    let j = 0;
    while (i < rows && j < columns) {
        if (oldKeys[i] === newKeys[j]) {
            map[i] = j;
            i += 1;
            j += 1;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
            i += 1;
        } else {
            j += 1;
        }
    }
    return map;
}

/** How much of the old line the new one still says: 0 to 1. */
function toSameLineShare(oldLine, newLine) {
    const oldKeys = listWords(splitChords(oldLine).bare).map((one) => {
        return one.key;
    });
    const newKeys = listWords(splitChords(newLine).bare).map((one) => {
        return one.key;
    });
    const most = Math.max(oldKeys.length, newKeys.length);
    if (most === 0) {
        return 0;
    }
    const matched = matchWordIndexes(oldKeys, newKeys).filter((one) => {
        return one !== -1;
    }).length;
    return matched / most;
}

/** Where an unmatched old word sits among the new ones, by its neighbours. */
function placeByNeighbours(map, index, newCount) {
    let before = index - 1;
    while (before >= 0 && map[before] === -1) {
        before -= 1;
    }
    let after = index + 1;
    while (after < map.length && map[after] === -1) {
        after += 1;
    }
    let target;
    if (before >= 0 && after < map.length) {
        target =
            map[before] +
            Math.round(
                ((index - before) * (map[after] - map[before])) /
                    (after - before),
            );
    } else if (before >= 0) {
        target = map[before] + (index - before);
    } else if (after < map.length) {
        target = map[after] - (after - index);
    } else {
        target = Math.round(
            (index * (newCount - 1)) / Math.max(1, map.length - 1),
        );
    }
    return Math.max(0, Math.min(newCount - 1, target));
}

/**
 * A chord's place kept after the one before it: two chords on one letter
 * is no chart, and chords keep their order, so a chord that would land on
 * or before the last goes on to the next word -- past the last word, to
 * the end of the line, where nothing is lost.
 */
function toFreeChordAt(at, lastAt, words, endAt) {
    if (at > lastAt || at >= endAt) {
        return at;
    }
    const next = words.find((word) => {
        return word.start > lastAt;
    });
    return next === undefined ? endAt : next.start;
}

/**
 * The old line's chords on the new line's words: a chord on a word still
 * there goes on that word (mid-word as it was, when the word is long
 * enough), one on a changed word on the word now in its place. Null when
 * there is nothing to carry -- the new line has chords of its own, or the
 * old one had none.
 */
function carryChords(oldLine, newLine) {
    const old = splitChords(oldLine);
    if (old.chords.length === 0 || splitChords(newLine).chords.length > 0) {
        return null;
    }
    const oldWords = listWords(old.bare);
    const newWords = listWords(newLine);
    if (newWords.length === 0) {
        return null;
    }
    const map = matchWordIndexes(
        oldWords.map((one) => {
            return one.key;
        }),
        newWords.map((one) => {
            return one.key;
        }),
    );
    const placed = [];
    let lastAt = -1;
    for (const chord of old.chords) {
        const index = oldWords.findIndex((word) => {
            return chord.at < word.end;
        });
        let at = newLine.length;
        if (index !== -1) {
            const into = Math.max(0, chord.at - oldWords[index].start);
            const target =
                map[index] === -1
                    ? placeByNeighbours(map, index, newWords.length)
                    : map[index];
            const word = newWords[target];
            at = word.start + Math.min(into, word.end - word.start - 1);
        }
        at = toFreeChordAt(at, lastAt, newWords, newLine.length);
        lastAt = at;
        placed.push({ at, token: chord.token });
    }
    return joinChords(newLine, placed);
}

/** A part's sung lines, each with the lines (translations) under it. */
function readSungEntries(fence) {
    const entries = [];
    for (const line of fence.body) {
        if (checkIsSungLine(line)) {
            entries.push({ line, under: [] });
        } else if (checkIsTranslationLine(line) && entries.length > 0) {
            entries[entries.length - 1].under.push(line);
        }
    }
    return entries;
}

/**
 * Which old line each new line gives back, or -1 for a new one: the same
 * line wins, then the most like it (half its words or more), the nearest
 * when two are alike -- so lines swapped or one added keep what is theirs.
 */
function pairGivenLines(oldLines, newLines) {
    const pairs = new Array(newLines.length).fill(-1);
    const usedSet = new Set();
    const candidates = [];
    newLines.forEach((newLine, j) => {
        oldLines.forEach((oldLine, i) => {
            const share = toSameLineShare(oldLine, newLine);
            if (share >= SAME_LINE_SHARE) {
                candidates.push({ i, j, share });
            }
        });
    });
    candidates.sort((a, b) => {
        return (
            b.share - a.share ||
            Math.abs(a.i - a.j) - Math.abs(b.i - b.j) ||
            a.j - b.j
        );
    });
    for (const one of candidates) {
        if (pairs[one.j] !== -1 || usedSet.has(one.i)) {
            continue;
        }
        pairs[one.j] = one.i;
        usedSet.add(one.i);
    }
    return pairs;
}

/**
 * A lyric part's new body from the lines given: each line that gives back
 * an old one keeps that line's translation lines, and its chords when it
 * came with none. Says what it kept and what went.
 */
function rebuildKeepingLines(fence, lines) {
    const entries = readSungEntries(fence);
    const toKey = (line) => {
        return toBareWords(line).toLowerCase();
    };
    // A model shown a line and its translation side by side gives both back
    // as lines: a given line that IS one of the part's translation lines (and
    // none of its sung ones) stays a translation line, where it was given.
    const sungKeySet = new Set(
        entries.map((one) => {
            return toKey(one.line);
        }),
    );
    const underKeySet = new Set(
        entries.flatMap((one) => {
            return one.under.map(toKey);
        }),
    );
    const checkIsGivenBack = (line) => {
        const key = toKey(line);
        return underKeySet.has(key) && !sungKeySet.has(key);
    };
    const given = lines.filter((line) => {
        return line !== '' && !checkIsGivenBack(line);
    });
    const pairs = pairGivenLines(
        entries.map((one) => {
            return one.line;
        }),
        given,
    );
    const report = { chordLines: 0, underLines: 0 };
    const body = [];
    const writtenUnderSet = new Set();
    let givenAt = 0;
    for (const line of lines) {
        if (line === '') {
            body.push(line);
            continue;
        }
        if (checkIsGivenBack(line)) {
            if (!writtenUnderSet.has(toKey(line))) {
                writtenUnderSet.add(toKey(line));
                body.push(`\t${line}`);
            }
            continue;
        }
        const oldIndex = pairs[givenAt];
        givenAt += 1;
        if (oldIndex === -1) {
            body.push(line);
            continue;
        }
        const entry = entries[oldIndex];
        const carried = carryChords(entry.line, line);
        if (carried !== null) {
            report.chordLines += 1;
        }
        const written = carried ?? line;
        body.push(written);
        const writtenKey = toKey(written);
        const under = entry.under.filter((one) => {
            // The words promoted to the line itself are not its translation,
            // and a translation the caller gives back is written where given.
            const key = toKey(one);
            return (
                key !== writtenKey &&
                !writtenUnderSet.has(key) &&
                !lines.some((given) => {
                    return toKey(given) === key;
                })
            );
        });
        if (entry.under.length > 0) {
            report.underLines += 1;
        }
        for (const one of under) {
            writtenUnderSet.add(toKey(one));
            body.push(one);
        }
    }
    const usedSet = new Set(pairs);
    const gone = entries.filter((_one, index) => {
        return !usedSet.has(index);
    });
    report.lostChordLines = gone.filter((one) => {
        return checkHasChord(one.line);
    }).length;
    report.lostUnderLines = gone.filter((one) => {
        return one.under.some((line) => {
            return !writtenUnderSet.has(toKey(line));
        });
    }).length;
    return { body, report };
}

function genLineCount(count) {
    return `${count} line${count === 1 ? '' : 's'}`;
}

/** Text with `find` in it, as one regular expression (smart case). */
function genFindPattern(find) {
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Written all in small letters, it matches any case; with a capital,
    // only as written.
    return new RegExp(escaped, find === find.toLowerCase() ? 'giu' : 'gu');
}

/** The replacement in the case of the words it replaces. */
function toMatchedCase(found, replacement, find) {
    if (find !== find.toLowerCase()) {
        return replacement;
    }
    const letters = found.replace(/[^\p{L}]/gu, '');
    if (
        letters.length > 1 &&
        letters === letters.toUpperCase() &&
        letters !== letters.toLowerCase()
    ) {
        return replacement.toUpperCase();
    }
    const first = found.match(/\p{L}/u)?.[0] ?? '';
    if (first !== '' && first !== first.toLowerCase()) {
        return replacement.replace(/\p{L}/u, (letter) => {
            return letter.toUpperCase();
        });
    }
    return replacement;
}

const WORD_LETTER_PATTERN = /[\p{L}\p{M}\p{N}]/u;
const APOSTROPHE_PATTERN = /['’]/;

/**
 * Whether `at` cuts a word in two. A word the breaker drew that is the
 * whole run of letters between spaces (`disgrace`) is a word, and "grace"
 * is not a word inside it; one run holding SEVERAL drawn words is a script
 * written without spaces, where the breaker's dictionary may draw an edge
 * the singer would not -- an edge there is the caller's to choose. An
 * apostrophe ends a word (`God's`, `'Twas`).
 */
function checkIsInsideWord(bare, words, at) {
    const word = words.find((one) => {
        return one.start < at && at < one.end;
    });
    if (word === undefined) {
        return false;
    }
    if (
        APOSTROPHE_PATTERN.test(bare[at] ?? '') ||
        APOSTROPHE_PATTERN.test(bare[at - 1] ?? '')
    ) {
        return false;
    }
    let runStart = word.start;
    while (runStart > 0 && WORD_LETTER_PATTERN.test(bare[runStart - 1])) {
        runStart -= 1;
    }
    let runEnd = word.end;
    while (runEnd < bare.length && WORD_LETTER_PATTERN.test(bare[runEnd])) {
        runEnd += 1;
    }
    return runStart === word.start && runEnd === word.end;
}

/** Where a chord inside replaced words goes in the words put there. */
function toChordInHit(bare, hit, chordAt, newStart) {
    const oldWords = listWords(bare.slice(hit.start, hit.end));
    const newWords = listWords(hit.text);
    if (newWords.length === 0) {
        return newStart + hit.text.length;
    }
    const inHit = chordAt - hit.start;
    let index = oldWords.findIndex((word) => {
        return inHit < word.end;
    });
    if (index === -1) {
        return newStart + hit.text.length;
    }
    const into = Math.max(0, inHit - oldWords[index].start);
    index = Math.min(index, newWords.length - 1);
    const word = newWords[index];
    return newStart + word.start + Math.min(into, word.end - word.start - 1);
}

/**
 * `find` replaced in one text (the words of a line, its chords taken out):
 * whole words only, the chords kept where they stood -- one inside the
 * words replaced stays as far in, never past their end. Counts the
 * replacements, and the longer words it was found inside.
 */
function replaceInLine(line, find, replacement) {
    const indent = line.match(/^\s*/)[0];
    const { bare, chords } = splitChords(line.slice(indent.length));
    const words = listWords(bare);
    const pattern = genFindPattern(find);
    const hits = [];
    const insideList = [];
    for (const match of bare.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        if (
            checkIsInsideWord(bare, words, start) ||
            checkIsInsideWord(bare, words, end)
        ) {
            const first = words.find((one) => {
                return one.end > start;
            });
            const last = [...words].reverse().find((one) => {
                return one.start < end;
            });
            insideList.push(
                first === undefined || last === undefined
                    ? match[0]
                    : bare.slice(first.start, last.end),
            );
            continue;
        }
        const text = toMatchedCase(match[0], replacement, find);
        // A word taken out takes one space with it.
        let from = start;
        let to = end;
        if (text === '' && bare[to] === ' ') {
            to += 1;
        } else if (text === '' && bare[from - 1] === ' ') {
            from -= 1;
        }
        hits.push({ start: from, end: to, text });
    }
    if (hits.length === 0) {
        return { line, count: 0, insideList };
    }
    let out = '';
    let last = 0;
    for (const hit of hits) {
        out += bare.slice(last, hit.start) + hit.text;
        last = hit.end;
    }
    out += bare.slice(last);
    // Each chord where it stood: after a hit by the length the hit grew,
    // inside one on the same word of the new words (as far in, never past
    // its end), and never on or before the chord before it.
    const newWords = listWords(out);
    const moved = [];
    let lastAt = -1;
    for (const chord of chords) {
        let shift = 0;
        let at = null;
        for (const hit of hits) {
            if (chord.at >= hit.end) {
                shift += hit.text.length - (hit.end - hit.start);
                continue;
            }
            if (chord.at > hit.start) {
                at = toChordInHit(bare, hit, chord.at, hit.start + shift);
            }
            break;
        }
        at = toFreeChordAt(
            at ?? chord.at + shift,
            lastAt,
            newWords,
            out.length,
        );
        lastAt = at;
        moved.push({ ...chord, at });
    }
    return {
        line: indent + joinChords(out, moved),
        count: hits.length,
        insideList,
    };
}

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

function genKindWords(fence) {
    if (fence.bodyRule === 'progression') {
        return 'chords and bars only';
    }
    if (fence.bodyRule === 'freeText') {
        return 'free text';
    }
    return 'words';
}

function applySetLines(state, request) {
    const sections = toSectionList(request);
    if (sections.isError) {
        return sections.reason;
    }
    for (const one of sections.list) {
        const fence = findPart(state.doc, one.part);
        if (fence === null) {
            return genNoSuchPartReason(state.doc, one.part);
        }
        const name = fence.partName;
        const cleaned = toCleanLines(one.lines, name);
        if (cleaned.isError) {
            return cleaned.reason;
        }
        if (cleaned.lines.length === 0 && fence.bodyRule !== 'progression') {
            return (
                `Give the new lines of ${name}. To take a part out of the ` +
                'song, use remove-section.'
            );
        }
        if (fence.bodyRule !== 'lyric') {
            fence.body = [...takeLeadingComments(fence.body), ...cleaned.lines];
            state.changes.push(`new words for ${name}`);
            continue;
        }
        if (checkIsChordsDropped(fence, cleaned.lines)) {
            state.chordsDroppedParts.push(name);
        }
        const { body, report } = rebuildKeepingLines(fence, cleaned.lines);
        if (report.lostChordLines > 0) {
            state.warnings.push(
                `${name}: the chords were not carried onto ` +
                    `${genLineCount(report.lostChordLines)} rewritten or ` +
                    'taken out -- add them back with set-chords if the band ' +
                    'needs them.',
            );
        }
        if (report.lostUnderLines > 0) {
            state.warnings.push(
                `${name}: the translation under ` +
                    `${genLineCount(report.lostUnderLines)} rewritten or ` +
                    'taken out went with the old words.',
            );
        }
        fence.body = [...takeLeadingComments(fence.body), ...body];
        const keptList = [
            report.chordLines > 0
                ? `the chords of ${genLineCount(report.chordLines)}`
                : null,
            report.underLines > 0
                ? `the translation under ${genLineCount(report.underLines)}`
                : null,
        ].filter(Boolean);
        state.changes.push(
            `new words for ${name}` +
                (keptList.length > 0
                    ? ` (kept ${keptList.join(' and ')})`
                    : ''),
        );
    }
    const configReason = applyOptionalConfig(state, request.config);
    if (configReason !== null) {
        return configReason;
    }
    return applyLocales(state, request.locales);
}

function applyAddTranslation(state, request) {
    const sections = toSectionList(request);
    if (sections.isError) {
        return sections.reason;
    }
    for (const one of sections.list) {
        const fence = findPart(state.doc, one.part);
        if (fence === null) {
            return genNoSuchPartReason(state.doc, one.part);
        }
        const name = fence.partName;
        if (fence.bodyRule !== 'lyric') {
            return (
                `${name} holds ${genKindWords(fence)}, which takes no ` +
                'translation line. Translate the sung parts only.'
            );
        }
        const cleaned = toOneLineEach(one.lines, name);
        if (cleaned.isError) {
            return cleaned.reason;
        }
        const sungCount = listSungIndexes(fence).length;
        if (cleaned.lines.length !== sungCount) {
            return (
                `${name} has ${sungCount} sung lines and ` +
                `${cleaned.lines.length} translations were given. Give exactly ` +
                'one per sung line, in order ("" for a line to leave as it is).'
            );
        }
        // Each sung line's translation goes right under it, in place of the
        // one already there: one translation line per line, the bilingual
        // song this app shows.
        const body = [];
        let sungAt = -1;
        let isReplacing = false;
        for (const line of fence.body) {
            if (checkIsSungLine(line)) {
                body.push(line);
                sungAt += 1;
                const translation = cleaned.lines[sungAt];
                isReplacing = translation !== '';
                if (isReplacing) {
                    body.push(`\t${translation}`);
                }
                continue;
            }
            if (isReplacing && checkIsTranslationLine(line)) {
                continue;
            }
            isReplacing = false;
            body.push(line);
        }
        fence.body = body;
        state.changes.push(`a translation under each line of ${name}`);
    }
    const configReason = applyOptionalConfig(state, request.config);
    if (configReason !== null) {
        return configReason;
    }
    return applyLocales(state, request.locales);
}

function applySetChords(state, request) {
    const sections = toSectionList(request);
    if (sections.isError) {
        return sections.reason;
    }
    for (const one of sections.list) {
        const fence = findPart(state.doc, one.part);
        if (fence === null) {
            return genNoSuchPartReason(state.doc, one.part);
        }
        const name = fence.partName;
        if (fence.bodyRule === 'progression') {
            const cleaned = toCleanLines(one.lines, name);
            if (cleaned.isError) {
                return cleaned.reason;
            }
            fence.body = [...takeLeadingComments(fence.body), ...cleaned.lines];
            state.changes.push(`the chords of ${name}`);
            continue;
        }
        if (fence.bodyRule !== 'lyric') {
            return (
                `${name} holds ${genKindWords(fence)}; chords go into sung ` +
                'parts and Instrumental or Interlude parts.'
            );
        }
        const cleaned = toOneLineEach(one.lines, name);
        if (cleaned.isError) {
            return cleaned.reason;
        }
        const sungIndexes = listSungIndexes(fence);
        if (cleaned.lines.length !== sungIndexes.length) {
            return (
                `${name} has ${sungIndexes.length} sung lines and ` +
                `${cleaned.lines.length} were given. Give every sung line, in ` +
                'order, with [chords] in it.'
            );
        }
        let keptCount = 0;
        for (let index = 0; index < sungIndexes.length; index += 1) {
            const before = fence.body[sungIndexes[index]];
            const given = cleaned.lines[index];
            if (toBareWords(before) !== toBareWords(given)) {
                return (
                    `Line ${index + 1} of ${name} changes the words ` +
                    `("${toBareWords(before)}" became "${toBareWords(given)}"). ` +
                    'set-chords only adds or moves chords: give the same words ' +
                    'with [chords] in them, or change words with set-lines.'
                );
            }
            const merged = mergeGivenChords(before, given);
            keptCount += merged.keptCount;
            fence.body[sungIndexes[index]] = merged.line;
        }
        state.changes.push(
            `the chords of ${name}` +
                (keptCount > 0
                    ? ` (${keptCount} chord${keptCount === 1 ? '' : 's'} ` +
                      'not given kept where they were)'
                    : ''),
        );
    }
    return null;
}

/**
 * A set-chords line: the chords given, and every chord of the old line the
 * caller did not account for (2026-11-12, EC-527). Asked to move one chord,
 * a model gave the verse with that chord alone and twelve went. So set-chords
 * adds and moves and never takes away (remove-chords does): a line given
 * plain keeps its own; in a line given with chords, an old chord stays
 * unless a given chord stands in its place, or one of its name stands
 * elsewhere (it moved) -- each given chord accounts for one old one.
 */
function mergeGivenChords(oldLine, givenLine) {
    const given = splitChords(givenLine);
    const carried = carryChords(oldLine, given.bare);
    if (carried === null) {
        return { line: givenLine, keptCount: 0 };
    }
    if (given.chords.length === 0) {
        return { line: carried, keptCount: splitChords(carried).chords.length };
    }
    const toName = (token) => {
        return token.slice(1, -1);
    };
    const leftMap = new Map();
    for (const chord of given.chords) {
        const name = toName(chord.token);
        leftMap.set(name, (leftMap.get(name) ?? 0) + 1);
    }
    const takeOne = (name) => {
        const left = leftMap.get(name) ?? 0;
        if (left > 0) {
            leftMap.set(name, left - 1);
            return true;
        }
        return false;
    };
    const givenAtMap = new Map(
        given.chords.map((chord) => {
            return [chord.at, toName(chord.token)];
        }),
    );
    const oldChords = splitChords(carried).chords;
    const loose = [];
    for (const chord of oldChords) {
        const givenName = givenAtMap.get(chord.at);
        if (givenName === undefined) {
            loose.push(chord);
        } else {
            // Its place is taken: the same chord, or another in its stead.
            takeOne(givenName);
        }
    }
    const kept = loose.filter((chord) => {
        return !takeOne(toName(chord.token));
    });
    return {
        line:
            kept.length === 0
                ? givenLine
                : joinChords(given.bare, [...given.chords, ...kept]),
        keptCount: kept.length,
    };
}

const REPLACE_PLACE_LIST = ['words', 'translations', 'both'];

/** The lines a replacement may change in one part, by index. */
function listReplaceIndexes(fence, place) {
    if (fence.bodyRule !== 'lyric' && fence.bodyRule !== 'mixed') {
        return [];
    }
    const indexes = [];
    fence.body.forEach((line, index) => {
        if (
            fence.bodyRule === 'mixed' &&
            (checkIsProgressionLine(line) || /^\s/.test(line))
        ) {
            return;
        }
        const isSung = checkIsSungLine(line);
        const isUnder = checkIsTranslationLine(line);
        if (
            (isSung && place !== 'translations') ||
            (isUnder && place !== 'words')
        ) {
            indexes.push(index);
        }
    });
    return indexes;
}

/** `[F]` as the chord `F`; null for anything else. */
function toBracketChord(text) {
    const match = /^\[([^\]\s]+)\]$/.exec(String(text ?? '').trim());
    return match !== null && checkIsOpenLyricChord(match[1]) ? match[1] : null;
}

/** One chord changed in a line, bracketed in words or bare in a progression. */
function replaceChordInLine(line, find, replacement, isProgression) {
    let count = 0;
    if (isProgression) {
        const out = line
            .split(/(\s+)/)
            .map((token) => {
                if (token === find) {
                    count += 1;
                    return replacement;
                }
                return token;
            })
            .join('');
        return { line: out, count };
    }
    const out = line.replace(CHORD_ANNOTATION_PATTERN, (whole, inner) => {
        if (inner === find) {
            count += 1;
            return `[${replacement}]`;
        }
        return whole;
    });
    return { line: out, count };
}

/** A chord replacement across `fences`: how often, and in which parts. */
function applyChordReplacement(fences, one) {
    let count = 0;
    const partNameSet = new Set();
    for (const fence of fences) {
        if (!['lyric', 'mixed', 'progression'].includes(fence.bodyRule)) {
            continue;
        }
        fence.body = fence.body.map((line) => {
            if (line.trim() === '' || COMMENT_PATTERN.test(line)) {
                return line;
            }
            const isProgression =
                fence.bodyRule === 'progression' ||
                (fence.bodyRule === 'mixed' && checkIsProgressionLine(line));
            if (!isProgression && !checkIsSungLine(line)) {
                return line;
            }
            const done = replaceChordInLine(
                line,
                one.find,
                one.replacement,
                isProgression,
            );
            if (done.count > 0) {
                count += done.count;
                partNameSet.add(fence.partName);
            }
            return done.line;
        });
    }
    return { count, partNameList: [...partNameSet] };
}

/** A replacement as given, checked; or the reason it cannot be one. */
function toReplacement(raw, index) {
    const label = `Replacement ${index + 1}`;
    if (raw === null || typeof raw !== 'object') {
        return fail(`${label} must be {find, with}.`);
    }
    // `[F]` -> `[Fmaj7]`: a chord changed wherever it is played, the way a
    // model first asks for it (2026-11-12, EC-527).
    const chordFind = toBracketChord(raw.find);
    const chordWith = toBracketChord(raw.with);
    if (chordFind !== null || chordWith !== null) {
        if (chordFind === null || chordWith === null) {
            return fail(
                `${label}: a chord is changed into a chord, both in ` +
                    'brackets -- {"find": "[F]", "with": "[Fmaj7]"}.',
            );
        }
        return {
            isChord: true,
            find: chordFind,
            replacement: chordWith,
            part: typeof raw.part === 'string' ? raw.part.trim() : '',
        };
    }
    // The words are matched with the chords taken out, so a find copied
    // with its chords (`re[D]lieved`) is the same find; each chord stays
    // where the song has it.
    const find =
        typeof raw.find === 'string' ? splitChords(raw.find).bare.trim() : '';
    const replacement =
        typeof raw.with === 'string' ? splitChords(raw.with).bare.trim() : null;
    if (find === '' || replacement === null) {
        return fail(
            `${label} needs the words to find and the words to put ` +
                'there: {find, with}.',
        );
    }
    if (find.length > MAX_FIND_CHARS || replacement.length > MAX_FIND_CHARS) {
        return fail(
            `${label} is longer than ${MAX_FIND_CHARS} characters; change ` +
                'a whole line with set-lines.',
        );
    }
    if (/[\r\n]/.test(find + replacement)) {
        return fail(
            `${label} spans lines; a replacement stays inside one line.`,
        );
    }
    if (/[[\]]/.test(find + replacement)) {
        return fail(
            `${label} holds a chord bracket. replace changes words and ` +
                'keeps every chord where it stood; chords are set-chords and ' +
                "transpose's.",
        );
    }
    if (checkIsNotationLine(find) || checkIsNotationLine(replacement)) {
        return fail(NOTATION_REASON);
    }
    const place = raw.in ?? 'words';
    if (!REPLACE_PLACE_LIST.includes(place)) {
        return fail(
            `${label}: "in" is one of ${REPLACE_PLACE_LIST.join(', ')}.`,
        );
    }
    return {
        find,
        replacement,
        part: typeof raw.part === 'string' ? raw.part.trim() : '',
        place,
    };
}

/**
 * A word or a phrase changed where it stands, however often the song
 * sings it: whole words only (smart case -- written in small letters it
 * matches any case and keeps each one's capital), every chord left where
 * it stood, nothing else touched. All or nothing: a replacement that finds
 * nothing refuses the whole call.
 */
function applyReplace(state, request) {
    const list = request?.replacements;
    if (!Array.isArray(list) || list.length === 0) {
        return (
            'Give replacements: [{find, with}] -- the words as the song ' +
            'has them and the words to put there.'
        );
    }
    if (list.length > MAX_REPLACEMENTS) {
        return `At most ${MAX_REPLACEMENTS} replacements go in one call.`;
    }
    const missList = [];
    for (let index = 0; index < list.length; index += 1) {
        const one = toReplacement(list[index], index);
        if (one.isError) {
            return one.reason;
        }
        // A `part` beside the list is each one's that names none: "in the
        // chorus" written so had changed every verse too (EC-527).
        if (one.part === '' && typeof request.part === 'string') {
            one.part = request.part.trim();
        }
        let fences = listParts(state.doc);
        if (one.part !== '') {
            const fence = findPart(state.doc, one.part);
            if (fence === null) {
                return genNoSuchPartReason(state.doc, one.part);
            }
            fences = [fence];
        }
        const where =
            one.part === ''
                ? 'the song'
                : findPart(state.doc, one.part).partName;
        if (one.isChord === true) {
            const done = applyChordReplacement(fences, one);
            if (done.count === 0) {
                missList.push(
                    `[${one.find}] is not a chord played in ${where}`,
                );
                continue;
            }
            state.changes.push(
                `chord ${one.find} -> ${one.replacement} ${done.count} time` +
                    `${done.count === 1 ? '' : 's'} (${done.partNameList.join(', ')})`,
            );
            continue;
        }
        let count = 0;
        const partNameSet = new Set();
        const insideSet = new Set();
        for (const fence of fences) {
            for (const lineIndex of listReplaceIndexes(fence, one.place)) {
                const done = replaceInLine(
                    fence.body[lineIndex],
                    one.find,
                    one.replacement,
                );
                done.insideList.forEach((word) => {
                    insideSet.add(word);
                });
                if (done.count > 0) {
                    fence.body[lineIndex] = done.line;
                    count += done.count;
                    partNameSet.add(fence.partName);
                }
            }
        }
        if (count === 0) {
            const inside = [...insideSet].slice(0, 3);
            missList.push(
                `"${one.find}" is not a word ${
                    one.place === 'translations'
                        ? 'of the translation lines of'
                        : 'sung in'
                } ${where}` +
                    (inside.length > 0
                        ? ` (only inside ${inside
                              .map((word) => {
                                  return `"${word}"`;
                              })
                              .join(', ')} -- give the whole word)`
                        : ''),
            );
            continue;
        }
        state.changes.push(
            `"${one.find}" -> "${one.replacement}" ${count} time` +
                `${count === 1 ? '' : 's'} (${[...partNameSet].join(', ')})`,
        );
        for (const field of ['Title', 'Subtitle']) {
            const value = readConfigValue(state.doc, field) ?? '';
            if (
                one.part === '' &&
                one.place !== 'translations' &&
                replaceInLine(value, one.find, one.replacement).count > 0
            ) {
                state.warnings.push(
                    `The ${field} still says "${value}" -- change it with ` +
                        'set-config if it should change too.',
                );
            }
        }
    }
    if (missList.length > 0) {
        return (
            `Nothing was changed: ${missList.join('; ')}. Read the song for ` +
            'the words exactly as it has them, then call again with only ' +
            'the replacements it has.'
        );
    }
    return null;
}

/** Every translation line taken out of a part, or of the whole song. */
function applyRemoveTranslations(state, request) {
    let fences = listParts(state.doc).filter((one) => {
        return one.bodyRule === 'lyric';
    });
    const asked = typeof request?.part === 'string' ? request.part.trim() : '';
    if (asked !== '') {
        const fence = findPart(state.doc, asked);
        if (fence === null) {
            return genNoSuchPartReason(state.doc, asked);
        }
        fences = [fence];
    }
    const nameList = [];
    let count = 0;
    for (const fence of fences) {
        if (fence.bodyRule !== 'lyric') {
            continue;
        }
        const body = fence.body.filter((line) => {
            return !checkIsTranslationLine(line);
        });
        if (body.length < fence.body.length) {
            count += fence.body.length - body.length;
            nameList.push(fence.partName);
            fence.body = body;
        }
    }
    if (count === 0) {
        return asked === ''
            ? 'The song has no translation lines to take out.'
            : `${findPart(state.doc, asked).partName} has no translation ` +
                  'lines to take out.';
    }
    state.changes.push(
        `took out ${count} translation line${count === 1 ? '' : 's'} ` +
            `(${nameList.join(', ')})`,
    );
    const configReason = applyOptionalConfig(state, request.config);
    if (configReason !== null) {
        return configReason;
    }
    return applyLocales(state, request.locales);
}

// ---------------------------------------------------------------------------
// Chords taken out, a part renamed (2026-11-12, EC-527)
// ---------------------------------------------------------------------------
//
// Measured in the window on a second song: _Take the chords out of the
// chorus._ was sent as set-lines with the chorus's words and no chords,
// which keeps a line's chords (EC-511) -- nothing was written and the answer
// said they were gone; _Rename the chorus to Refrain._ took four calls (the
// part added again, the old one removed, the order rewritten), four undo
// steps for one change.

/** Whether every sung line given is the part's own words with no chord. */
function checkIsChordsDropped(fence, lines) {
    const given = lines.filter(checkIsSungLine);
    const sungIndexes = listSungIndexes(fence);
    return (
        given.length === sungIndexes.length &&
        sungIndexes.some((index) => {
            return checkHasChord(fence.body[index]);
        }) &&
        given.every((line, at) => {
            return (
                !checkHasChord(line) &&
                toBareWords(line) === toBareWords(fence.body[sungIndexes[at]])
            );
        })
    );
}

/** A sung line with its chords taken out, or null for a line of chords alone. */
function toLineWithoutChords(line) {
    const { bare, chords } = splitChords(line);
    if (chords.length === 0) {
        return line;
    }
    const words = bare.replace(/ {2,}/g, ' ').trim();
    return words === '' ? null : words;
}

function applyRemoveChords(state, request) {
    let fences = listParts(state.doc);
    const asked = typeof request?.part === 'string' ? request.part.trim() : '';
    if (asked !== '') {
        const fence = findPart(state.doc, asked);
        if (fence === null) {
            return genNoSuchPartReason(state.doc, asked);
        }
        fences = [fence];
    }
    const nameList = [];
    const keptList = [];
    let count = 0;
    let chordLineCount = 0;
    for (const fence of fences) {
        if (fence.bodyRule !== 'lyric') {
            // An Instrumental is its chords, and an Intro's lines may be a
            // progression: neither is emptied.
            if (
                fence.bodyRule !== 'config' &&
                (fence.bodyRule === 'progression'
                    ? fence.body.some((line) => {
                          return (
                              line.trim() !== '' && !COMMENT_PATTERN.test(line)
                          );
                      })
                    : fence.body.some(checkHasChord))
            ) {
                keptList.push(fence.partName);
            }
            continue;
        }
        let partCount = 0;
        fence.body = fence.body.map((line) => {
            if (!checkIsSungLine(line)) {
                return line;
            }
            const next = toLineWithoutChords(line);
            if (next === null) {
                chordLineCount += 1;
                return line;
            }
            partCount += splitChords(line).chords.length;
            return next;
        });
        if (partCount > 0) {
            count += partCount;
            nameList.push(fence.partName);
        }
    }
    if (keptList.length > 0) {
        state.warnings.push(
            `${keptList.join(', ')} kept ${keptList.length === 1 ? 'its' : 'their'} ` +
                'chords: chords are what such a part plays -- take it out ' +
                'with remove-section if it should go.',
        );
    }
    if (chordLineCount > 0) {
        state.warnings.push(
            `${genLineCount(chordLineCount)} of chords alone stayed -- give ` +
                'the part again with set-lines if they should go.',
        );
    }
    if (count === 0) {
        return asked === ''
            ? 'The song has no chords in its sung parts to take out.'
            : `${fences[0].partName} has no chords to take out.`;
    }
    state.changes.push(
        `took out ${count} chord${count === 1 ? '' : 's'} ` +
            `(${nameList.join(', ')})`,
    );
    return null;
}

function genNotAPartReason(text) {
    return (
        `"${String(text ?? '').slice(0, 40)}" is not a part a song can ` +
        'have. Use one of: ' +
        OPEN_LYRIC_FENCE_LIST.filter((one) => {
            return one.header !== 'Config';
        })
            .map((one) => {
                return one.header;
            })
            .join(', ') +
        ' -- with a number where there are several (Verse 3).'
    );
}

/**
 * `part` called `to` from now on: the same lines, chords and lines under,
 * where it stood, and every place it plays in the order -- one change, one
 * undo.
 */
function applyRenameSection(state, request) {
    const fence = findPart(state.doc, request?.part);
    if (fence === null) {
        return genNoSuchPartReason(state.doc, request?.part);
    }
    const canonical = toCanonicalPart(request?.to);
    if (canonical === null) {
        return genNotAPartReason(request?.to);
    }
    const target = FENCE_MAP.get(canonical.header);
    const old = fence.partName;
    if (
        target.bodyRule !== fence.bodyRule &&
        target.bodyRule !== 'mixed' &&
        fence.bodyRule !== 'mixed'
    ) {
        return (
            `${old} holds ${genKindWords(fence)}, and a ${canonical.header} ` +
            'holds something else: add a new part with add-section instead.'
        );
    }
    let name;
    if (canonical.number === null) {
        name =
            canonical.header === fence.header
                ? old
                : findFreePartName(state.doc, canonical.header);
        if (name === null) {
            return (
                `The song already has its ${canonical.header}, and there is ` +
                'only ever one.'
            );
        }
    } else {
        if (!target.allowsNumbering) {
            return `${canonical.header} cannot be numbered; there is only ever one.`;
        }
        name = toPartName(canonical);
    }
    if (name === old) {
        return `${old} is already called that.`;
    }
    if (listPartNames(state.doc).includes(name)) {
        return (
            `${name} is already in the song. Rename that one first, or ` +
            'change the play order with set-order.'
        );
    }
    const play = readPlayOrder(state.doc);
    if (play.isPartial) {
        return BROKEN_STRUCTURE_REASON;
    }
    fence.openLine = `\`\`\`ol:${name}`;
    fence.header = canonical.header;
    fence.partName = name;
    fence.bodyRule = target.bodyRule;
    if (!play.isMissing) {
        writePlayOrder(
            state.doc,
            play.order.map((one) => {
                return one.partName === old ? { ...one, partName: name } : one;
            }),
        );
    }
    state.changes.push(`renamed ${old} to ${name}`);
    return null;
}

/** `Verse 3` after `Verse 1` and `Verse 2`; `Bridge` when there is none. */
function findFreePartName(doc, header) {
    const fence = FENCE_MAP.get(header);
    const sameHeader = listParts(doc).filter((one) => {
        return one.header === header;
    });
    if (!fence.allowsNumbering) {
        return sameHeader.length === 0 ? header : null;
    }
    if (sameHeader.length === 0) {
        return header === 'Verse' ? 'Verse 1' : header;
    }
    const highest = Math.max(
        ...sameHeader.map((one) => {
            const parsed = parseFenceInfo(one.partName);
            return parsed.indexText === null ? 1 : Number(parsed.indexText);
        }),
    );
    return `${header} ${highest + 1}`;
}

function applyAddSection(state, request) {
    const canonical = toCanonicalPart(request?.part);
    if (canonical === null) {
        return genNotAPartReason(request?.part);
    }
    const fenceInfo = FENCE_MAP.get(canonical.header);
    let name;
    if (canonical.number === null) {
        name = findFreePartName(state.doc, canonical.header);
        if (name === null) {
            return (
                `The song already has its ${canonical.header}, and there is ` +
                'only ever one. Change its words with set-lines.'
            );
        }
    } else {
        if (!fenceInfo.allowsNumbering) {
            return `${canonical.header} cannot be numbered; there is only ever one.`;
        }
        name = toPartName(canonical);
        if (listPartNames(state.doc).includes(name)) {
            return `${name} is already in the song. Change its words with set-lines.`;
        }
    }
    const cleaned = toCleanLines(request?.lines ?? [], name);
    if (cleaned.isError) {
        return cleaned.reason;
    }
    if (cleaned.lines.length === 0 && fenceInfo.bodyRule !== 'progression') {
        return `Give the lines of the new ${name}.`;
    }
    let afterFence = null;
    if (request?.after !== undefined && request.after !== null) {
        afterFence = findPart(state.doc, request.after);
        if (afterFence === null) {
            return genNoSuchPartReason(state.doc, request.after);
        }
    }
    // A band note is read by the band, not sung: it is written down and not
    // put in the play order unless the caller placed it (a Note that plays
    // is a slide on the projector).
    const isPlayed = canonical.header !== 'Note' || afterFence !== null;
    const play = readPlayOrder(state.doc);
    if (isPlayed && play.isPartial) {
        return BROKEN_STRUCTURE_REASON;
    }
    const segment = {
        kind: 'fence',
        openLine: `\`\`\`ol:${name}`,
        header: canonical.header,
        partName: name,
        bodyRule: fenceInfo.bodyRule,
        body: cleaned.lines,
        closeLine: '```',
    };
    const segments = state.doc.segments;
    const anchor =
        afterFence ?? listParts(state.doc).at(-1) ?? findConfig(state.doc);
    const at = segments.indexOf(anchor) + 1;
    segments.splice(at, 0, { kind: 'text', lines: [''] }, segment);
    if (!isPlayed) {
        state.changes.push(`added ${name} (written for the band, not played)`);
        return null;
    }
    const order = [...play.order];
    let where = 'at the end';
    if (afterFence === null) {
        order.push({ partName: name, repeat: 1 });
    } else {
        const playAt = order.findIndex((one) => {
            return one.partName === afterFence.partName;
        });
        if (playAt === -1) {
            return (
                `${afterFence.partName} is not in the play order, so nothing ` +
                'can be placed after it. Leave `after` out to add it at the ' +
                'end, then set-order to place it.'
            );
        }
        order.splice(playAt + 1, 0, { partName: name, repeat: 1 });
        where = `after ${afterFence.partName}`;
    }
    writePlayOrder(state.doc, order);
    state.changes.push(`added ${name}, played ${where}`);
    return null;
}

function applyRemoveSection(state, request) {
    const fence = findPart(state.doc, request?.part);
    if (fence === null) {
        return genNoSuchPartReason(state.doc, request?.part);
    }
    const name = fence.partName;
    const play = readPlayOrder(state.doc);
    if (play.isPartial) {
        return BROKEN_STRUCTURE_REASON;
    }
    const order = play.order.filter((one) => {
        return one.partName !== name;
    });
    if (play.order.length > 0 && order.length === 0) {
        return `${name} is all the song plays; a song needs at least one part.`;
    }
    const segments = state.doc.segments;
    const at = segments.indexOf(fence);
    segments.splice(at, 1);
    // The blank line that stood in front of it goes too.
    const before = segments[at - 1];
    if (
        before?.kind === 'text' &&
        before.lines[before.lines.length - 1] === '' &&
        segments[at]?.kind !== 'text'
    ) {
        before.lines.pop();
        if (before.lines.length === 0) {
            segments.splice(at - 1, 1);
        }
    }
    if (order.length !== play.order.length) {
        writePlayOrder(state.doc, order);
    }
    state.changes.push(`removed ${name}`);
    return null;
}

function applySetOrder(state, request) {
    const list = request?.order;
    if (!Array.isArray(list) || list.length === 0) {
        return 'Give the play order as a list of part names, e.g. ["Verse 1", "Chorus", "Verse 2", "Chorus x2"].';
    }
    if (list.length > MAX_ORDER_ENTRIES) {
        return `${MAX_ORDER_ENTRIES} entries at most in a play order.`;
    }
    const order = [];
    for (const entry of list) {
        const match = String(entry ?? '')
            .trim()
            .match(/^(.*?)(?:\s*[x×]\s*(\d+))?$/i);
        const fence = findPart(state.doc, match?.[1]);
        if (fence === null) {
            return genNoSuchPartReason(state.doc, match?.[1] ?? entry);
        }
        const repeat = Number(match[2] ?? 1);
        if (!(repeat >= 1 && repeat <= MAX_REPEAT)) {
            return `A part plays 1 to ${MAX_REPEAT} times in a row.`;
        }
        order.push({ partName: fence.partName, repeat });
    }
    writePlayOrder(state.doc, order);
    state.changes.push(
        `play order: ${order
            .map((one) => {
                return one.repeat > 1
                    ? `${one.partName} x${one.repeat}`
                    : one.partName;
            })
            .join(' → ')}`,
    );
    return null;
}

function toSafeConfigText(value) {
    return String(value ?? '')
        .replace(/`/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function checkSongHasChords(doc) {
    return listParts(doc).some((fence) => {
        return fence.bodyRule === 'progression'
            ? fence.body.some((line) => {
                  return line.trim() !== '' && !COMMENT_PATTERN.test(line);
              })
            : fence.body.some(checkHasChord);
    });
}

function applySetConfig(state, request) {
    const config = request?.config;
    if (
        config === null ||
        typeof config !== 'object' ||
        Array.isArray(config)
    ) {
        return (
            'Give `config` as an object of the fields to set, e.g. ' +
            '{"Key": "G", "Tempo": "72bpm"}.'
        );
    }
    const entries = Object.entries(config);
    if (entries.length === 0) {
        return 'Give at least one field to set.';
    }
    return applyConfigFields(state, entries);
}

/**
 * A translation's Title and Subtitle, beside its words (2026-11-06, the
 * user: _it should translate title and sub-title as well_): `set-lines` and
 * `add-translation` take the same `config` `set-config` does, so a song is
 * put into another language in ONE call and one undo.
 */
function applyOptionalConfig(state, config) {
    if (config === undefined || config === null) {
        return null;
    }
    if (typeof config !== 'object' || Array.isArray(config)) {
        return 'Give `config` as an object, e.g. {"Title": "…"}.';
    }
    return applyConfigFields(state, Object.entries(config));
}

function applyConfigFields(state, entries) {
    const configFence = findConfig(state.doc);
    for (const [rawName, rawValue] of entries) {
        const name = LYRIC_EDIT_CONFIG_FIELDS.find((one) => {
            return one.toLowerCase() === String(rawName).toLowerCase();
        });
        if (name === undefined) {
            return (
                `"${String(rawName).slice(0, 30)}" is not a field this can ` +
                `set. It sets: ${LYRIC_EDIT_CONFIG_FIELDS.join(', ')}. The ` +
                'play order is set-order.'
            );
        }
        if (name === 'Locales') {
            const reason = applyLocales(state, rawValue ?? []);
            if (reason !== null) {
                return reason;
            }
            continue;
        }
        const text = toSafeConfigText(rawValue);
        if (text === '') {
            if (name === 'Title') {
                return 'A song needs a Title; give the new one.';
            }
            if (removeConfigValue(configFence, name)) {
                state.changes.push(`took out ${name}`);
            }
            continue;
        }
        if (text.length > MAX_CONFIG_VALUE_CHARS) {
            return `${name} is too long; ${MAX_CONFIG_VALUE_CHARS} characters at most.`;
        }
        let value = text;
        if (name === 'Key') {
            value = toLyricKey(text);
            if (value === null) {
                return `Key must be one of: ${OPEN_LYRIC_KEY_LIST.join(' ')}.`;
            }
            if (checkSongHasChords(state.doc)) {
                state.warnings.push(
                    'Only the Key line changed; every chord is where it was. ' +
                        'To move the chords to the new key too, use transpose.',
                );
            }
        } else if (name === 'Time') {
            if (!OPEN_LYRIC_TIME_LIST.includes(text)) {
                return `Time must be one of: ${OPEN_LYRIC_TIME_LIST.join(' ')}.`;
            }
        } else if (name === 'Tempo') {
            const compact = text.replace(/\s+/g, '').toLowerCase();
            value = /^\d+$/.test(compact) ? `${compact}bpm` : compact;
            if (!/^[1-9]\d*bpm$/.test(value)) {
                return 'Tempo is beats a minute, written like 72bpm.';
            }
        }
        if (readConfigValue(state.doc, name) !== value) {
            setConfigValue(configFence, name, value);
            state.changes.push(`${name}: ${value}`);
        }
    }
    return null;
}

function applyTranspose(state, request) {
    const target = toLyricKey(request?.key);
    if (target === null) {
        return `Give the new key as one of: ${OPEN_LYRIC_KEY_LIST.join(' ')}.`;
    }
    const written = readConfigValue(state.doc, 'Key');
    const hasFrom = request?.fromKey !== undefined && request.fromKey !== null;
    const current = hasFrom ? toLyricKey(request.fromKey) : toLyricKey(written);
    if (current === null) {
        return hasFrom
            ? `fromKey must be one of: ${OPEN_LYRIC_KEY_LIST.join(' ')}.`
            : 'The song has no Key line, so the key its chords are in is not ' +
                  'known. Say which key they are in now (`fromKey`).';
    }
    if (current.endsWith('m') !== target.endsWith('m')) {
        return (
            `${current} and ${target} are not the same kind of key (major ` +
            'and minor), and moving the chords keeps the kind. Ask for a ' +
            `${current.endsWith('m') ? 'minor' : 'major'} key, or change the ` +
            'Key line alone with set-config.'
        );
    }
    const rootOf = (key) => {
        return key.endsWith('m') ? key.slice(0, -1) : key;
    };
    const semitones =
        (toPitch(rootOf(target)) - toPitch(rootOf(current)) + 12) % 12;
    const move = (chord) => {
        return transposeChord(chord, semitones, target);
    };
    let count = 0;
    for (const fence of listParts(state.doc)) {
        fence.body = fence.body.map((line) => {
            if (COMMENT_PATTERN.test(line)) {
                return line;
            }
            const isTokens =
                fence.bodyRule === 'progression' ||
                (fence.bodyRule === 'mixed' && checkIsProgressionLine(line));
            const moved = isTokens
                ? transposeTokens(line, move)
                : transposeAnnotations(line, move);
            count += moved.count;
            return moved.line;
        });
    }
    if (written !== target) {
        setConfigValue(findConfig(state.doc), 'Key', target);
    }
    if (count === 0) {
        state.warnings.push(
            'The song has no chords, so only its Key line changed.',
        );
    }
    state.changes.push(
        semitones === 0
            ? `Key: ${target}`
            : `moved ${count} chord${count === 1 ? '' : 's'} from ${current} to ${target}`,
    );
    return null;
}

const ACTION_MAP = {
    'set-lines': applySetLines,
    'add-translation': applyAddTranslation,
    'set-chords': applySetChords,
    replace: applyReplace,
    'remove-translations': applyRemoveTranslations,
    'remove-chords': applyRemoveChords,
    'add-section': applyAddSection,
    'remove-section': applyRemoveSection,
    'rename-section': applyRenameSection,
    'set-order': applySetOrder,
    'set-config': applySetConfig,
    transpose: applyTranspose,
};

// ---------------------------------------------------------------------------
// The two entries
// ---------------------------------------------------------------------------

function toProblemKey(problem) {
    return `${problem.part ?? ''}|${problem.message}`;
}

function genBreakingReason(problems) {
    const shown = problems.slice(0, MAX_REPORTED_PROBLEMS).map((one) => {
        return (
            `- line ${one.line}${one.part === null ? '' : ` (${one.part})`}: ` +
            `${one.message}${one.hint === null ? '' : ` ${one.hint}`}`
        );
    });
    const rest = problems.length - shown.length;
    return (
        'That change would break the song, so nothing was written:\n' +
        shown.join('\n') +
        (rest > 0 ? `\n- and ${rest} more` : '')
    );
}

/**
 * One change to a song.
 *
 * @param {string} content The Open Lyric document as it stands.
 * @param {object} request `{action, part, lines, sections, after, order,
 *   config, key, fromKey, locales}` -- each action reads its own few.
 * @returns {{isError: true, reason: string} | {
 *   content: string, isChanged: boolean, changes: string[],
 *   warnings: string[],
 * }}
 */
export function applyLyricEdit(content, request) {
    const action = request?.action;
    const apply = ACTION_MAP[action];
    if (apply === undefined) {
        return fail(
            `Unknown action. Use one of: ${LYRIC_EDIT_ACTIONS.join(', ')}.`,
        );
    }
    const doc = parseLyricDocument(content);
    if (findConfig(doc) === null) {
        return fail(
            'This song has no ol:Config block, so it cannot be changed part ' +
                'by part. Open it in the Lyric Editor to fix it first.',
        );
    }
    const state = { doc, changes: [], warnings: [], chordsDroppedParts: [] };
    const reason = apply(state, request);
    if (typeof reason === 'string') {
        return fail(reason);
    }
    const next = serializeLyricDocument(doc);
    // The same words handed back without their chords is a way of asking for
    // the chords to go, and set-lines keeps a line's chords: refused, so the
    // answer cannot say they went (2026-11-12, EC-527).
    if (next === String(content ?? '') && state.chordsDroppedParts.length > 0) {
        return fail(
            `Nothing was changed: those are the words of ` +
                `${state.chordsDroppedParts.join(', ')} as they stand, and ` +
                "set-lines keeps a line's chords. To take chords out, use " +
                'remove-chords (`part`, else the whole song).',
        );
    }
    const before = validateOpenLyric(String(content ?? ''));
    const after = validateOpenLyric(next);
    const knownProblems = new Set(before.problems.map(toProblemKey));
    const addedProblems = after.problems.filter((one) => {
        return !knownProblems.has(toProblemKey(one));
    });
    if (addedProblems.length > 0) {
        return fail(genBreakingReason(addedProblems));
    }
    const knownWarnings = new Set(before.warnings.map(toProblemKey));
    for (const one of after.warnings) {
        if (!knownWarnings.has(toProblemKey(one))) {
            state.warnings.push(one.message);
        }
    }
    if (before.problems.length > 0) {
        state.warnings.push(
            `The song already had ${before.problems.length} problem` +
                `${before.problems.length === 1 ? '' : 's'} before this ` +
                'change; they are as they were.',
        );
    }
    return {
        content: next,
        isChanged: next !== String(content ?? ''),
        changes: state.changes,
        warnings: state.warnings,
    };
}

function describePart(fence) {
    const lines = [];
    const translations = [];
    for (const line of fence.body) {
        if (fence.bodyRule === 'progression') {
            if (line.trim() !== '' && !COMMENT_PATTERN.test(line)) {
                lines.push(line.trim());
            }
            continue;
        }
        if (checkIsSungLine(line)) {
            lines.push(line.trimEnd());
            translations.push([]);
        } else if (checkIsTranslationLine(line) && translations.length > 0) {
            translations[translations.length - 1].push(line.trim());
        }
    }
    const described = {
        part: fence.partName,
        lines,
    };
    if (fence.bodyRule !== 'lyric') {
        described.holds = genKindWords(fence);
    }
    if (
        translations.some((one) => {
            return one.length > 0;
        })
    ) {
        described.translations = translations.map((one) => {
            return one.length === 0 ? null : one.join(' / ');
        });
    }
    return described;
}

/**
 * What `read` answers: the song's Config, its play order and every part's
 * lines -- sung lines as they are (chords inline), translations beside them.
 */
export function describeLyricDocument(content) {
    const doc = parseLyricDocument(content);
    const value = (name) => {
        return readConfigValue(doc, name);
    };
    const play = readPlayOrder(doc);
    const described = {
        title: value('Title'),
        subtitle: value('Subtitle'),
        artist: value('Artist'),
        key: value('Key'),
        tempo: value('Tempo'),
        time: value('Time'),
        locales: value('Locales'),
        structure: value('Structure'),
        playOrder: play.order.map((one) => {
            return one.repeat > 1
                ? `${one.partName} x${one.repeat}`
                : one.partName;
        }),
        parts: listParts(doc).map(describePart),
    };
    if (play.isPartial) {
        described.playOrderNote =
            'The Structure line could not be read whole; set-order rewrites it.';
    }
    if (findConfig(doc) === null) {
        described.note =
            'This song has no ol:Config block; it can only be fixed in the ' +
            'Lyric Editor.';
    }
    return described;
}
