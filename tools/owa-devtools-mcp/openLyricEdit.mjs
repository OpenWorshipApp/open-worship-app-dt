// `owa_lyric_edit`: one change to a song, made by code from the WORDS a
// caller gives -- never from notation the caller wrote.
//
// Asked for 2026-11-06 (the user, with `Still khmer` -- a copy of `Still`
// whose every line was still English -- circled in the Documents list: _I
// want to translate all english in `Still khmer` to khmer, so chatbot should
// be able to help doing this_; and the operations: _add section: verse 1,
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
    'add-section',
    'remove-section',
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
        const oldSung = listSungIndexes(fence).map((index) => {
            return fence.body[index];
        });
        if (
            fence.bodyRule !== 'progression' &&
            oldSung.some(checkHasChord) &&
            !cleaned.lines.some(checkHasChord)
        ) {
            state.warnings.push(
                `${name}: its chords were not carried into the new words -- ` +
                    'add them back with set-chords if the band needs them.',
            );
        }
        if (fence.body.some(checkIsTranslationLine)) {
            state.warnings.push(
                `${name}: its translation lines went with the old words.`,
            );
        }
        fence.body = [...takeLeadingComments(fence.body), ...cleaned.lines];
        state.changes.push(`new words for ${name}`);
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
        for (let index = 0; index < sungIndexes.length; index += 1) {
            const before = fence.body[sungIndexes[index]];
            const after = cleaned.lines[index];
            if (toBareWords(before) !== toBareWords(after)) {
                return (
                    `Line ${index + 1} of ${name} changes the words ` +
                    `("${toBareWords(before)}" became "${toBareWords(after)}"). ` +
                    'set-chords only adds or moves chords: give the same words ' +
                    'with [chords] in them, or change words with set-lines.'
                );
            }
            fence.body[sungIndexes[index]] = after;
        }
        state.changes.push(`the chords of ${name}`);
    }
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
        return (
            `"${String(request?.part ?? '').slice(0, 40)}" is not a part a ` +
            'song can have. Use one of: ' +
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
    'add-section': applyAddSection,
    'remove-section': applyRemoveSection,
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
    const state = { doc, changes: [], warnings: [] };
    const reason = apply(state, request);
    if (typeof reason === 'string') {
        return fail(reason);
    }
    const next = serializeLyricDocument(doc);
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
