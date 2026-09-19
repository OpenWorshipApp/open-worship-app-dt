// The Open Lyric notation grammar, as a validator that needs nothing but a
// string.
//
// A song in this app is a Markdown document written in `open-lyric`'s fenced
// notation, and the Lyric Editor marks a mistake with a red squiggle and no
// words a volunteer can act on. This module is what turns the squiggle into a
// sentence: line, section, what is wrong, and what to write instead.
//
// WHY NOT CALL open-lyric ITSELF. Two reasons, both hard:
//  - its validator is `validateMarkdownOlModel(model)`, which takes a Monaco
//    model and pushes markers into an editor. The one headless entry point,
//    `api.document.checkMarkdown`, answers a BOOLEAN -- no line, no message,
//    which is the entire value here;
//  - reaching it means importing an 863 KB bundle that pulls monaco in and
//    touches `document` at module scope. This server is plain node, and
//    CLAUDE.md puts memory on a church back-room machine ahead of elegance.
//
// So the grammar is written out, and TWO tests hold it honest:
//  - `openLyric.test.mjs` re-reads `node_modules/open-lyric/schema.md` §8.1 --
//    the machine-readable grammar the package ships -- and fails when a table
//    here disagrees with it, which is what an open-lyric upgrade looks like;
//  - `openLyricOracle.test.mjs` runs a corpus through open-lyric's own
//    `checkMarkdown` and through this module, and fails when the two verdicts
//    disagree.
// Every rule below was probed against that oracle (open-lyric 0.1.57) before
// it was written, not inferred from the prose.
//
// Message wording follows schema.md §6 where §6 documents a message, so what
// the user is told matches what the editor is complaining about. The few rules
// §6 leaves unnamed carry `own wording` at their site.

/**
 * @typedef {object} OpenLyricProblemType
 * @property {number} line 1-based line number in the text as given.
 * @property {string|null} part The part the line belongs to (`Verse 2`),
 *   `Config`, or null outside every fence.
 * @property {string} message What is wrong, in schema.md's own words.
 * @property {string|null} hint What to write instead, when there is one.
 * @property {string|null} excerpt The offending line, clipped.
 */

// ---------------------------------------------------------------------------
// The grammar. Mirrors schema.md §8.1; `openLyric.test.mjs` proves it does.
// ---------------------------------------------------------------------------

/** Every fence a document may declare. Order is schema.md's. */
export const OPEN_LYRIC_FENCE_LIST = [
    {
        header: 'Config',
        allowsNumbering: false,
        structureCode: null,
        bodyRule: 'config',
    },
    {
        header: 'Intro',
        allowsNumbering: false,
        structureCode: 'I',
        bodyRule: 'mixed',
    },
    {
        header: 'Final-Chorus',
        allowsNumbering: false,
        structureCode: 'F',
        bodyRule: 'lyric',
    },
    {
        header: 'Pre-Chorus',
        allowsNumbering: true,
        structureCode: 'P',
        bodyRule: 'lyric',
    },
    {
        header: 'Post-Chorus',
        allowsNumbering: true,
        structureCode: 'X',
        bodyRule: 'lyric',
    },
    {
        header: 'Refrain',
        allowsNumbering: true,
        structureCode: 'R',
        bodyRule: 'lyric',
    },
    {
        header: 'Bridge',
        allowsNumbering: true,
        structureCode: 'B',
        bodyRule: 'lyric',
    },
    {
        header: 'Chorus',
        allowsNumbering: true,
        structureCode: 'C',
        bodyRule: 'lyric',
    },
    {
        header: 'Verse',
        allowsNumbering: true,
        structureCode: 'V',
        bodyRule: 'lyric',
    },
    {
        header: 'Note',
        allowsNumbering: true,
        structureCode: 'N',
        bodyRule: 'lyric',
    },
    {
        header: 'Tag',
        allowsNumbering: true,
        structureCode: 'T',
        bodyRule: 'lyric',
    },
    {
        header: 'Turnaround',
        allowsNumbering: true,
        structureCode: 'TU',
        bodyRule: 'mixed',
    },
    {
        header: 'Outro',
        allowsNumbering: false,
        structureCode: 'O',
        bodyRule: 'mixed',
    },
    {
        header: 'Instrumental',
        allowsNumbering: true,
        structureCode: 'IS',
        bodyRule: 'progression',
    },
    {
        header: 'Interlude',
        allowsNumbering: true,
        structureCode: 'L',
        bodyRule: 'progression',
    },
    {
        header: 'Breakdown',
        allowsNumbering: true,
        structureCode: 'D',
        bodyRule: 'freeText',
    },
    {
        header: 'Vamp',
        allowsNumbering: false,
        structureCode: 'A',
        bodyRule: 'freeText',
    },
    {
        header: 'Solo',
        allowsNumbering: true,
        structureCode: 'S',
        bodyRule: 'freeText',
    },
];

export const OPEN_LYRIC_CONFIG_FIELD_LIST = [
    'Title',
    'Subtitle',
    'Description',
    'Artist',
    'Copyright',
    'Locales',
    'Key',
    'Tempo',
    'Time',
    'Theme',
    'Structure',
    'Genre',
    'Style',
    'Attachments',
    'Strumming Patterns',
];

export const OPEN_LYRIC_REQUIRED_CONFIG_FIELD_LIST = [
    'Title',
    'Artist',
    'Copyright',
    'Key',
    'Tempo',
    'Time',
    'Structure',
];

/** The three fields an indented continuation line may belong to. */
export const OPEN_LYRIC_MULTILINE_CONFIG_FIELD_LIST = [
    'Description',
    'Attachments',
    'Strumming Patterns',
];

const MULTILINE_FIELD_SET = new Set(OPEN_LYRIC_MULTILINE_CONFIG_FIELD_LIST);

export const OPEN_LYRIC_CONFIG_FIELD_ALIAS_MAP = {
    'Strumming Pattern': 'Strumming Patterns',
};

export const OPEN_LYRIC_KEY_LIST = [
    'C',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
    'Am',
    'Bbm',
    'Bm',
    'Cm',
    'C#m',
    'Dm',
    'D#m',
    'Ebm',
    'Em',
    'Fm',
    'F#m',
    'Gm',
    'G#m',
];

export const OPEN_LYRIC_TIME_LIST = [
    '4/4',
    '2/2',
    '2/4',
    '3/4',
    '3/8',
    '6/8',
    '9/8',
    '12/8',
];

// The closed locale set -- the Windows LCID tag list. A tag outside it is an
// error, so the list has to be here in full rather than approximated by a
// shape test: `zz-ZZ` has the shape and open-lyric refuses it.
// prettier-ignore
export const OPEN_LYRIC_LOCALE_LIST = [
    'arc', 'af-ZA', 'am-ET', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IQ',
    'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-MA', 'arn-CL', 'ar-OM', 'ar-QA',
    'ar-SA', 'ar-SD', 'ar-SY', 'ar-TN', 'ar-YE', 'as-IN', 'az-az', 'az-Cyrl-AZ',
    'az-Latn-AZ', 'ba-RU', 'be-BY', 'bg-BG', 'bn-BD', 'bn-IN', 'bo-CN', 'br-FR',
    'bs-Cyrl-BA', 'bs-Latn-BA', 'ca-ES', 'co-FR', 'cs-CZ', 'cy-GB', 'da-DK', 'de-AT',
    'de-CH', 'de-DE', 'de-LI', 'de-LU', 'dsb-DE', 'dv-MV', 'el-CY', 'el-GR',
    'en-029', 'en-AU', 'en-BZ', 'en-CA', 'en-cb', 'en-GB', 'en-IE', 'en-IN',
    'en-JM', 'en-MT', 'en-MY', 'en-NZ', 'en-PH', 'en-SG', 'en-TT', 'en-US',
    'en-ZA', 'en-ZW', 'es-AR', 'es-BO', 'es-CL', 'es-CO', 'es-CR', 'es-DO',
    'es-EC', 'es-ES', 'es-GT', 'es-HN', 'es-MX', 'es-NI', 'es-PA', 'es-PE',
    'es-PR', 'es-PY', 'es-SV', 'es-US', 'es-UY', 'es-VE', 'et-EE', 'eu-ES',
    'fa-IR', 'fi-FI', 'fil-PH', 'fo-FO', 'fr-BE', 'fr-CA', 'fr-CH', 'fr-FR',
    'fr-LU', 'fr-MC', 'fy-NL', 'ga-IE', 'gd-GB', 'gd-ie', 'gl-ES', 'gsw-FR',
    'gu-IN', 'ha-Latn-NG', 'he-IL', 'hi-IN', 'hr-BA', 'hr-HR', 'hsb-DE', 'hu-HU',
    'hy-AM', 'id-ID', 'ig-NG', 'ii-CN', 'in-ID', 'is-IS', 'it-CH', 'it-IT',
    'iu-Cans-CA', 'iu-Latn-CA', 'iw-IL', 'ja-JP', 'ka-GE', 'kk-KZ', 'kl-GL', 'km-KH',
    'kn-IN', 'kok-IN', 'ko-KR', 'ky-KG', 'lb-LU', 'lo-LA', 'lt-LT', 'lv-LV',
    'mi-NZ', 'mk-MK', 'ml-IN', 'mn-MN', 'mn-Mong-CN', 'moh-CA', 'mr-IN', 'ms-BN',
    'ms-MY', 'mt-MT', 'nb-NO', 'ne-NP', 'nl-BE', 'nl-NL', 'nn-NO', 'no-no',
    'nso-ZA', 'oc-FR', 'or-IN', 'pa-IN', 'pl-PL', 'prs-AF', 'ps-AF', 'pt-BR',
    'pt-PT', 'qut-GT', 'quz-BO', 'quz-EC', 'quz-PE', 'rm-CH', 'ro-mo', 'ro-RO',
    'ru-mo', 'ru-RU', 'rw-RW', 'sah-RU', 'sa-IN', 'se-FI', 'se-NO', 'se-SE',
    'si-LK', 'sk-SK', 'sl-SI', 'sma-NO', 'sma-SE', 'smj-NO', 'smj-SE', 'smn-FI',
    'sms-FI', 'sq-AL', 'sr-BA', 'sr-CS', 'sr-Cyrl-BA', 'sr-Cyrl-CS', 'sr-Cyrl-ME', 'sr-Cyrl-RS',
    'sr-Latn-BA', 'sr-Latn-CS', 'sr-Latn-ME', 'sr-Latn-RS', 'sr-ME', 'sr-RS', 'sr-sp', 'sv-FI',
    'sv-SE', 'sw-KE', 'syr-SY', 'ta-IN', 'te-IN', 'tg-Cyrl-TJ', 'th-TH', 'tk-TM',
    'tlh-QS', 'tn-ZA', 'tr-TR', 'tt-RU', 'tzm-Latn-DZ', 'ug-CN', 'uk-UA', 'ur-PK',
    'uz-Cyrl-UZ', 'uz-Latn-UZ', 'uz-uz', 'vi-VN', 'wo-SN', 'xh-ZA', 'yo-NG', 'zh-CN',
    'zh-HK', 'zh-MO', 'zh-SG', 'zh-TW', 'zu-ZA',
];

/** Verbatim from schema.md §3, so a chord this accepts is one open-lyric does. */
export const OPEN_LYRIC_CHORD_SOURCE =
    '[A-G](?:#|b)?(?:(?:maj|min|m|dim|aug)(?:2|4|5|6|7|9|11|13)?|sus(?:2|4)?|' +
    '(?:add|no|omit)(?:2|4|5|6|7|9|11|13)|(?:2|4|5|6|7|9|11|13))?' +
    '(?:\\/[A-G](?:#|b)?)?';

export const OPEN_LYRIC_BAR_TOKEN_LIST = ['||:', '|:', ':||', ':|', '|'];

export const OPEN_LYRIC_STRUM_STEP_LIST = [
    'd', 'D', 'v', 'V', 'u', 'U', '^', 'x', 'X', '1', '*', '+', '-', '_', '.',
    '0',
];

const CHORD_PATTERN = new RegExp(`^${OPEN_LYRIC_CHORD_SOURCE}$`);
const TEMPO_PATTERN = /^[1-9]\d*bpm$/;
/** `(2x)` in a progression body -- the reverse of Structure's `x2`. */
export const OPEN_LYRIC_REPEAT_SUFFIX_SOURCE = '\\([1-9]\\d*x\\)';
const REPEAT_SUFFIX_PATTERN = new RegExp(
    `^${OPEN_LYRIC_REPEAT_SUFFIX_SOURCE}$`,
);
const CUE_PATTERN = /^\{c:\s*[A-Za-z0-9 +\-/#]+\s*\}$/;
const STRUM_DIRECTIVE_PATTERN = /^\{p:\s*#([1-9]\d*)\s*\}$/;
// Unanchored at the end: a strumming directive normally has the whole
// progression after it (`{p: #1} | G | D |`), and matching the trimmed LINE
// meant the warning only ever fired for a directive sitting on its own.
const STRUM_DIRECTIVE_PREFIX_PATTERN = /^\{p:\s*#([1-9]\d*)\s*\}/;
const STRUM_STEP_PATTERN = /^[dDvVuU^xX1*+_.0\-| \t]+$/;
const ATTACHMENT_PATTERN =
    /^(?:(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/\S[^\r\n]*)|\[[^\]\r\n]+\]\((?:[A-Za-z][A-Za-z0-9+.-]*:\/\/\S[^\r\n)]*)\))$/;
const BAR_TOKEN_SET = new Set(OPEN_LYRIC_BAR_TOKEN_LIST);

const FENCE_OPEN_PATTERN = /^\s*```ol:(.*)$/;
const FENCE_CLOSE_PATTERN = /^\s*```\s*$/;
const COMMENT_PATTERN = /^\s*\/\//;

const HEADER_MAP = new Map(
    OPEN_LYRIC_FENCE_LIST.map((one) => {
        return [one.header, one];
    }),
);

// Longest header first, so `Post-Chorus 1` is never read as `Chorus`-something
// and `Final-Chorus` never as `Chorus`.
const HEADERS_LONGEST_FIRST = OPEN_LYRIC_FENCE_LIST.map((one) => {
    return one.header;
}).sort((left, right) => {
    return right.length - left.length;
});

// The same rule for structure codes: `IS` must win over `I`, `TU` over `T`.
const STRUCTURE_CODES_LONGEST_FIRST = OPEN_LYRIC_FENCE_LIST.filter((one) => {
    return one.structureCode !== null;
})
    .map((one) => {
        return one.structureCode;
    })
    .sort((left, right) => {
        return right.length - left.length;
    });

const STRUCTURE_CODE_MAP = new Map(
    OPEN_LYRIC_FENCE_LIST.filter((one) => {
        return one.structureCode !== null;
    }).map((one) => {
        return [one.structureCode, one];
    }),
);

// ---------------------------------------------------------------------------
// Bounds. The text arrives from a model or from a paste, and this runs inside
// the process that serves the chatbot: a document nobody would ever write must
// cost a refusal, not a stalled window.
// ---------------------------------------------------------------------------

/** Longest document accepted. A 200-verse hymnal is around 60 KB. */
export const OPEN_LYRIC_MAX_CHARS = 200000;

/** Problems listed before the report starts counting instead. */
const MAX_REPORTED_PROBLEMS = 25;

/** Play-order entries spelled out before the report abbreviates. */
const MAX_PLAY_ORDER_ENTRIES = 40;

const EXCERPT_CHARS = 72;

function toExcerpt(line) {
    const trimmed = String(line ?? '').trim();
    if (trimmed === '') {
        return null;
    }
    return trimmed.length > EXCERPT_CHARS
        ? `${trimmed.slice(0, EXCERPT_CHARS - 1)}…`
        : trimmed;
}

/** Whether a token is a chord symbol open-lyric accepts. */
export function checkIsOpenLyricChord(token) {
    return CHORD_PATTERN.test(token);
}

/**
 * The nearest legal chord to something that is not one, or null.
 *
 * Only the two mistakes that actually happen: a decoration open-lyric does not
 * carry (`Cm7b5`, `C7sus4`) and a lower-case root. Anything cleverer would
 * suggest a chord the writer did not mean, which is worse than no suggestion.
 */
function findChordSuggestion(token) {
    const text = String(token).trim();
    if (text === '') {
        return null;
    }
    const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
    if (capitalised !== text && checkIsOpenLyricChord(capitalised)) {
        return capitalised;
    }
    for (let end = capitalised.length - 1; end > 0; end -= 1) {
        const shorter = capitalised.slice(0, end);
        if (checkIsOpenLyricChord(shorter)) {
            return shorter;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Reading the document into fences
// ---------------------------------------------------------------------------

function toLines(text) {
    return String(text).split(/\r\n|\r|\n/);
}

/**
 * Split a fence's info string into its header and its index text.
 *
 * `null` when the info names no known header at all. `isBadIndex` when it
 * names one and what follows is not a number -- `Verse two` is a different
 * mistake from `Wibble` and deserves a different sentence.
 */
function parseFenceInfo(info) {
    for (const header of HEADERS_LONGEST_FIRST) {
        if (info === header) {
            return { header, indexText: null };
        }
        if (info.startsWith(`${header} `)) {
            const rest = info.slice(header.length).trim();
            return /^\d+$/.test(rest)
                ? { header, indexText: rest }
                : { header, indexText: rest, isBadIndex: true };
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Body rules
// ---------------------------------------------------------------------------

/**
 * A lyric line. Two checks only, exactly as schema.md §2 says: every `[` opens
 * a valid chord annotation and closes on the same line, and a bare `]` is an
 * error. Everything else -- bars, markdown, any language -- is lyric.
 *
 * One problem per line, deliberately: a line with three bad chords in it is
 * one thing to go and fix, and the second and third messages would be paid for
 * on every round of the answer.
 */
function checkLyricLine(line, report) {
    let index = 0;
    while (index < line.length) {
        const character = line[index];
        if (character === '[') {
            const close = line.indexOf(']', index + 1);
            if (close === -1) {
                report(
                    'Unclosed chord annotation.',
                    'Close it on the same line, e.g. [G].',
                );
                return;
            }
            const inner = line.slice(index + 1, close);
            if (!checkIsOpenLyricChord(inner)) {
                const suggestion = findChordSuggestion(inner);
                report(
                    `Invalid chord annotation. Try [${suggestion ?? '<chord>'}].`,
                    suggestion === null
                        ? `"${inner}" is not a chord open-lyric knows. A root is A-G with at ` +
                              'most one # or b, then at most one of maj/min/m/dim/aug, sus, ' +
                              'add/no/omit or a bare 2 4 5 6 7 9 11 13.'
                        : `Write [${suggestion}] instead of [${inner}].`,
                );
                return;
            }
            index = close + 1;
            continue;
        }
        if (character === ']') {
            report(
                'Unexpected closing bracket in lyric line.',
                'A ] only ever closes a chord annotation that a [ opened.',
            );
            return;
        }
        index += 1;
    }
}

/**
 * The chord/bar tokens of a progression, with no directive left on the front.
 * `label` names the section, which is how schema.md words
 * `Invalid <section> token.`
 */
function checkProgressionTokens(text, label, report) {
    for (const token of text.split(/\s+/)) {
        if (token === '') {
            continue;
        }
        if (
            BAR_TOKEN_SET.has(token) ||
            checkIsOpenLyricChord(token) ||
            REPEAT_SUFFIX_PATTERN.test(token)
        ) {
            continue;
        }
        if (token.includes('{') || token.includes('}')) {
            report(
                `Invalid ${label} directive. Expected {c: Piano + Pads }.`,
                'A directive has to be the first thing in the section, and ' +
                    'only one is allowed.',
            );
            return;
        }
        if (token.startsWith('(') || /^\(?\d+\s*x/i.test(token)) {
            report(
                token.includes(')')
                    ? 'Repeat suffix must use exact format (2x).'
                    : 'Unclosed repeat suffix.',
                'A repeat is written (2x): digits, a lower-case x, no spaces.',
            );
            return;
        }
        const suggestion = findChordSuggestion(token);
        report(
            `Invalid ${label} token.`,
            suggestion === null
                ? `"${token}" is neither a chord, a bar (| |: :| ||: :||) nor a ` +
                      `repeat like (2x). Sung words do not belong in ${label}; ` +
                      'put them in a Breakdown, Vamp or Solo section.'
                : `Did you mean ${suggestion}?`,
        );
        return;
    }
}

/**
 * `Instrumental` / `Interlude`: the whole body is ONE progression, which may
 * open with a single `{c: …}` cue. That "may open with" is literal -- a cue on
 * the second line is a token in the middle of the progression and is refused,
 * which the joined-body reading gives for free.
 */
function checkProgressionBody(bodyLines, label, report) {
    const joined = bodyLines
        .map((one) => {
            return one.line;
        })
        .join(' ')
        .trim();
    if (joined === '') {
        return;
    }
    // Every problem in a joined body is reported against its first line: the
    // body is one progression, so there is no truer line to point at.
    const reportHere = (message, hint) => {
        report(bodyLines[0], message, hint);
    };
    let rest = joined;
    if (rest.startsWith('{')) {
        const close = rest.indexOf('}');
        const directive = close === -1 ? rest : rest.slice(0, close + 1);
        if (!CUE_PATTERN.test(directive)) {
            reportHere(
                `Invalid ${label} directive. Expected {c: Piano + Pads }.`,
                directive.startsWith('{p:')
                    ? `{p: #N} is only for Intro, Outro and Turnaround. ${label} ` +
                          'takes {c: …} alone.'
                    : 'A cue may hold letters, digits, spaces and + - / # only.',
            );
            return;
        }
        rest = rest.slice(close + 1);
    }
    checkProgressionTokens(rest, label, reportHere);
}

/**
 * `Intro` / `Outro` / `Turnaround`: every line decides for itself. A line
 * opening with `{p:` or `{c:` is a progression, and so is one holding a `|`
 * AND a whole-token chord; everything else is sung.
 */
function checkMixedLine(line, label, report) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{p:') || trimmed.startsWith('{c:')) {
        const close = trimmed.indexOf('}');
        const directive = close === -1 ? trimmed : trimmed.slice(0, close + 1);
        if (
            !CUE_PATTERN.test(directive) &&
            !STRUM_DIRECTIVE_PATTERN.test(directive)
        ) {
            report(
                `Invalid ${label} directive. Expected {p: #3} or {c: Piano + Pads }.`,
                'Write {p: #2} for a strumming pattern or {c: Piano + Pads } ' +
                    'for a cue.',
            );
            return;
        }
        checkProgressionTokens(trimmed.slice(close + 1), label, report);
        return;
    }
    const hasChordToken = trimmed.split(/\s+/).some((token) => {
        return checkIsOpenLyricChord(token);
    });
    if (trimmed.includes('|') && hasChordToken) {
        checkProgressionTokens(trimmed, label, report);
        return;
    }
    checkLyricLine(line, report);
}

// ---------------------------------------------------------------------------
// The Config fence
// ---------------------------------------------------------------------------

function parseConfigFence(bodyLines, report) {
    const fields = {};
    let lastField = null;
    for (const entry of bodyLines) {
        const { line } = entry;
        if (line.trim() === '' || COMMENT_PATTERN.test(line)) {
            continue;
        }
        const isIndented = /^\s/.test(line);
        const match = isIndented ? null : line.match(/^\s*-\s*(.+?)\s*:\s?(.*)$/);
        if (match !== null) {
            const rawName = match[1];
            const name = OPEN_LYRIC_CONFIG_FIELD_ALIAS_MAP[rawName] ?? rawName;
            if (!OPEN_LYRIC_CONFIG_FIELD_LIST.includes(name)) {
                report(
                    entry,
                    'Invalid config entry. Use - Field: value.',
                    `"${rawName}" is not an open-lyric field. They are: ` +
                        `${OPEN_LYRIC_CONFIG_FIELD_LIST.join(', ')}.`,
                );
                lastField = null;
                continue;
            }
            if (Object.hasOwn(fields, name)) {
                report(
                    entry,
                    `Duplicate config field. ${name} is already declared on ` +
                        `line ${fields[name].line}.`,
                    null,
                );
                lastField = null;
                continue;
            }
            fields[name] = {
                value: match[2].trim(),
                line: entry.number,
                extra: [],
                extraLines: [],
            };
            lastField = name;
            if (fields[name].value === '' && !MULTILINE_FIELD_SET.has(name)) {
                report(
                    entry,
                    `${name} must provide a value on the same line.`,
                    `Write "- ${name}: …" with the value after the colon.`,
                );
            }
            continue;
        }
        if (isIndented) {
            if (lastField === null || !MULTILINE_FIELD_SET.has(lastField)) {
                report(
                    entry,
                    'Config continuation lines must follow a Description, ' +
                        'Attachments, or Strumming Patterns entry.',
                    'Every other field takes its value on the same line as ' +
                        'its name.',
                );
                continue;
            }
            fields[lastField].extra.push(line.trim());
            fields[lastField].extraLines.push(entry);
            continue;
        }
        report(entry, 'Invalid config entry. Use - Field: value.', null);
        lastField = null;
    }
    return fields;
}

/** Every value of a field that may carry more than one, with its line. */
function toFieldValueList(field, name) {
    const head =
        field.value === ''
            ? []
            : [
                  {
                      text: field.value,
                      entry: {
                          number: field.line,
                          line: `- ${name}: ${field.value}`,
                          part: 'Config',
                      },
                  },
              ];
    return [
        ...head,
        ...field.extraLines.map((entry, index) => {
            return { text: field.extra[index], entry };
        }),
    ];
}

function checkConfigValues(fields, report, configEntry) {
    const missing = OPEN_LYRIC_REQUIRED_CONFIG_FIELD_LIST.filter((name) => {
        return !Object.hasOwn(fields, name);
    });
    if (missing.length > 0) {
        report(
            configEntry,
            `Missing required config fields: ${missing.join(', ')}.`,
            `Every song needs ${OPEN_LYRIC_REQUIRED_CONFIG_FIELD_LIST.join(', ')}.`,
        );
    }
    const at = (name) => {
        return {
            number: fields[name].line,
            line: `- ${name}: ${fields[name].value}`,
            part: 'Config',
        };
    };
    if (
        fields.Key !== undefined &&
        !OPEN_LYRIC_KEY_LIST.includes(fields.Key.value)
    ) {
        report(
            at('Key'),
            `Key must be one of: ${OPEN_LYRIC_KEY_LIST.join(' ')}.`,
            null,
        );
    }
    if (
        fields.Time !== undefined &&
        !OPEN_LYRIC_TIME_LIST.includes(fields.Time.value)
    ) {
        report(
            at('Time'),
            `Time must be one of: ${OPEN_LYRIC_TIME_LIST.join(' ')}.`,
            null,
        );
    }
    if (fields.Tempo !== undefined && !TEMPO_PATTERN.test(fields.Tempo.value)) {
        report(
            at('Tempo'),
            'Tempo must match [1-9]\\d*bpm.',
            'Digits then "bpm" with no space, e.g. 68bpm.',
        );
    }
    if (fields.Locales !== undefined && fields.Locales.value !== '') {
        checkLocales(fields.Locales.value, at('Locales'), report);
    }
    if (fields.Attachments !== undefined) {
        for (const one of toFieldValueList(fields.Attachments, 'Attachments')) {
            if (!ATTACHMENT_PATTERN.test(one.text)) {
                // own wording: schema.md §6 names no message for this.
                report(
                    one.entry,
                    'Attachments must be a web address, or a [label](address) link.',
                    `"${one.text}" has no scheme like https:// or file://.`,
                );
            }
        }
    }
    const patterns = fields['Strumming Patterns'];
    if (patterns !== undefined) {
        for (const one of toFieldValueList(patterns, 'Strumming Patterns')) {
            if (!STRUM_STEP_PATTERN.test(one.text)) {
                report(
                    one.entry,
                    'Strumming Patterns must use only ' +
                        `${OPEN_LYRIC_STRUM_STEP_LIST.join(', ')}, bar ` +
                        'separators (|), and spaces or tabs.',
                    null,
                );
            }
        }
    }
}

function checkLocales(value, entry, report) {
    const parts = value.split(',').map((one) => {
        return one.trim();
    });
    if (
        parts.some((one) => {
            return one === '';
        })
    ) {
        report(
            entry,
            'Locales must be a comma-separated list of locales with no empty entry.',
            'Drop the extra comma, e.g. "en-US, km-KH".',
        );
        return;
    }
    const seen = new Set();
    const lowerLocaleSet = new Set(
        OPEN_LYRIC_LOCALE_LIST.map((one) => {
            return one.toLowerCase();
        }),
    );
    for (const tag of parts) {
        const lower = tag.toLowerCase();
        if (seen.has(lower)) {
            report(entry, `Duplicate locale. ${tag} is already listed.`, null);
            return;
        }
        seen.add(lower);
        if (!lowerLocaleSet.has(lower)) {
            // own wording: schema.md §4 states the rule, §6 names no message.
            report(
                entry,
                `Unknown locale. ${tag} is not one of open-lyric's locale tags.`,
                'Use a language-region tag such as en-US, km-KH or fr-FR.',
            );
            return;
        }
    }
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/**
 * Read a Structure value into its tokens, reporting as it goes.
 *
 * Stops at the first bad token rather than carrying on: past a token it could
 * not read, every following message would be a guess. What it managed to read
 * still comes back, because a song with one bad token is worth describing --
 * but it comes back marked `isPartial`, because a play order printed as though
 * it were the whole song says the song ends where the mistake is.
 */
function parseStructure(value, entry, declaredPartSet, report) {
    const order = [];
    const partial = (list) => {
        return { order: list, isPartial: true };
    };
    const text = value.trim();
    if (/\s/.test(text)) {
        report(
            entry,
            'Structure must use compact codes like IV1x2CV1V2CO.',
            'No spaces, commas or dashes -- one run of codes.',
        );
        return partial(order);
    }
    let index = 0;
    let previousPart = null;
    while (index < text.length) {
        const code = STRUCTURE_CODES_LONGEST_FIRST.find((one) => {
            return text.startsWith(one, index);
        });
        if (code === undefined) {
            report(
                entry,
                `Unknown structure code. Use ${STRUCTURE_CODES_LONGEST_FIRST.join(' ')}.`,
                `Nothing in open-lyric is written "${text.slice(index, index + 2)}" ` +
                    'here, and the codes are upper case.',
            );
            return partial(order);
        }
        index += code.length;
        const fence = STRUCTURE_CODE_MAP.get(code);
        let indexText = '';
        while (index < text.length && /\d/.test(text[index])) {
            indexText += text[index];
            index += 1;
        }
        if (indexText !== '' && !fence.allowsNumbering) {
            report(
                entry,
                `${fence.header} cannot be numbered in Structure.`,
                `There is only ever one ${fence.header}, so write ${code} on its own.`,
            );
            return partial(order);
        }
        if (indexText !== '' && !/^[1-9]\d*$/.test(indexText)) {
            report(
                entry,
                'Section indexes must start at 1.',
                `${code}${indexText} names no section.`,
            );
            return partial(order);
        }
        let repeat = 1;
        if (text[index] === 'x') {
            index += 1;
            let repeatText = '';
            while (index < text.length && /\d/.test(text[index])) {
                repeatText += text[index];
                index += 1;
            }
            if (repeatText === '') {
                report(
                    entry,
                    'Repeat suffix must use compact format x2.',
                    'An x in Structure always carries a count, e.g. Cx2.',
                );
                return partial(order);
            }
            if (!/^[1-9]\d*$/.test(repeatText)) {
                report(
                    entry,
                    'Repeat counts must start at 1.',
                    `x${repeatText} plays it no times, which is what leaving ` +
                        'it out means.',
                );
                return partial(order);
            }
            repeat = Number(repeatText);
        }
        const partName =
            indexText === '' ? fence.header : `${fence.header} ${indexText}`;
        if (partName === previousPart) {
            report(
                entry,
                `Structure cannot place ${partName} twice in a row. Increase ` +
                    "the previous token's repeat count instead.",
                `Write ${code}${indexText}x2 once instead of ${code}${indexText} twice.`,
            );
            return partial(order);
        }
        if (!declaredPartSet.has(partName)) {
            report(
                entry,
                `Structure references undeclared ol part. ${partName} is not declared.`,
                `Add an ol:${partName} section, or take ${code}${indexText} ` +
                    'out of Structure.',
            );
            return partial(order);
        }
        previousPart = partName;
        order.push({ partName, repeat });
    }
    return { order, isPartial: false };
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

function toProblem(entry, message, hint) {
    return {
        line: entry?.number ?? 1,
        part: entry?.part ?? null,
        message,
        hint: hint ?? null,
        excerpt: toExcerpt(entry?.line ?? ''),
    };
}

/**
 * Validate an Open Lyric document.
 *
 * `problems` are what the Lyric Editor refuses the song for; `warnings` are
 * what it accepts and a musician would still want to know.
 *
 * @param {string} text The whole `.md` song file.
 * @returns {{
 *   ok: boolean,
 *   problems: OpenLyricProblemType[],
 *   warnings: OpenLyricProblemType[],
 *   song: object|null,
 * }}
 */
export function validateOpenLyric(text) {
    const problems = [];
    const warnings = [];
    const addProblem = (entry, message, hint) => {
        problems.push(toProblem(entry, message, hint));
    };
    const addWarning = (entry, message, hint) => {
        warnings.push(toProblem(entry, message, hint));
    };

    if (typeof text !== 'string' || text.trim() === '') {
        return {
            ok: false,
            problems: [
                toProblem(
                    null,
                    'Missing required ol part. Add ol:Config.',
                    'An Open Lyric song is a Markdown file whose first fenced ' +
                        'block is ol:Config.',
                ),
            ],
            warnings,
            song: null,
        };
    }
    if (text.length > OPEN_LYRIC_MAX_CHARS) {
        return {
            ok: false,
            problems: [
                toProblem(
                    null,
                    `This is ${text.length} characters; ${OPEN_LYRIC_MAX_CHARS} ` +
                        'is the most that can be checked at once.',
                    'Check one song at a time.',
                ),
            ],
            warnings,
            song: null,
        };
    }

    const lines = toLines(text);
    const fences = [];
    const declaredAt = new Map();
    let open = null;
    let openLine = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const number = index + 1;
        if (open !== null) {
            if (FENCE_CLOSE_PATTERN.test(line)) {
                fences.push(open);
                open = null;
                continue;
            }
            open.bodyLines.push({ number, line, part: open.partName });
            continue;
        }
        const match = line.match(FENCE_OPEN_PATTERN);
        if (match === null) {
            continue;
        }
        openLine = number;
        const info = match[1].trim();
        const entry = { number, line, part: null };
        const unsupported =
            'Unsupported ol part. Use Config, Intro, Instrumental, Interlude, ' +
            'Turnaround, lyric sections, Breakdown, Vamp, or Solo.';
        // A fence whose header could not be read still has to be CONSUMED, or
        // its body is read as the document and every lyric line in it becomes
        // a second complaint about the same mistake.
        const openUnknown = () => {
            open = {
                header: null,
                partName: null,
                bodyRule: 'freeText',
                bodyLines: [],
            };
        };
        if (info === '') {
            addProblem(
                entry,
                unsupported,
                'The fence needs a section name, e.g. ol:Verse 1.',
            );
            openUnknown();
            continue;
        }
        if (
            info.toLowerCase().startsWith('config') &&
            !info.startsWith('Config')
        ) {
            addProblem(
                entry,
                'Use ol:Config. Lowercase ol:config is not supported.',
                null,
            );
            openUnknown();
            continue;
        }
        const parsed = parseFenceInfo(info);
        if (parsed === null) {
            const known = HEADERS_LONGEST_FIRST.find((one) => {
                return one.toLowerCase() === info.toLowerCase().split(/\s+/)[0];
            });
            addProblem(
                entry,
                unsupported,
                known === undefined
                    ? `"${info}" is not a section open-lyric knows.`
                    : 'Section names are spelled exactly, capitals included: ' +
                          `write "${known}".`,
            );
            openUnknown();
            continue;
        }
        const fence = HEADER_MAP.get(parsed.header);
        let partName = parsed.header;
        if (parsed.indexText !== null) {
            if (parsed.header === 'Config') {
                addProblem(
                    entry,
                    'Config fences cannot be numbered or suffixed.',
                    'Write ol:Config on its own.',
                );
            } else if (parsed.isBadIndex === true) {
                addProblem(
                    entry,
                    unsupported,
                    'A section name takes a number after it, not ' +
                        `"${parsed.indexText}".`,
                );
            } else if (!fence.allowsNumbering) {
                addProblem(
                    entry,
                    `${parsed.header} fences cannot be numbered.`,
                    `There is only ever one ${parsed.header}.`,
                );
            } else if (!/^[1-9]\d*$/.test(parsed.indexText)) {
                addProblem(
                    entry,
                    'Section indexes must start at 1.',
                    `Write "${parsed.header} ${Number(parsed.indexText) || 1}".`,
                );
            } else {
                partName = `${parsed.header} ${parsed.indexText}`;
            }
        }
        if (declaredAt.has(partName)) {
            addProblem(
                entry,
                `Duplicate ol part. ${partName} is already declared on line ` +
                    `${declaredAt.get(partName)}.`,
                'Number them apart, or put the lines in one section.',
            );
        } else {
            declaredAt.set(partName, number);
        }
        open = {
            header: parsed.header,
            partName,
            bodyRule: fence.bodyRule,
            bodyLines: [],
        };
    }
    if (open !== null) {
        addProblem(
            { number: openLine, line: lines[openLine - 1], part: open.partName },
            'Unclosed ol fence.',
            'Every ol: block ends with a line holding three backticks and ' +
                'nothing else.',
        );
        fences.push(open);
    }

    const configFence = fences.find((one) => {
        return one.header === 'Config';
    });
    let configFields = {};
    if (configFence === undefined) {
        addProblem(
            { number: 1, line: lines[0], part: null },
            'Missing required ol part. Add ol:Config.',
            'A song starts with an ol:Config block naming its Title, Artist, ' +
                'Copyright, Key, Tempo, Time and Structure.',
        );
    } else {
        configFields = parseConfigFence(configFence.bodyLines, addProblem);
        checkConfigValues(configFields, addProblem, {
            number: declaredAt.get('Config') ?? 1,
            line: 'ol:Config',
            part: 'Config',
        });
    }

    const declaredPartSet = new Set(declaredAt.keys());
    let playOrder = [];
    let isPlayOrderPartial = false;
    if (
        configFields.Structure !== undefined &&
        configFields.Structure.value !== ''
    ) {
        ({ order: playOrder, isPartial: isPlayOrderPartial } = parseStructure(
            configFields.Structure.value,
            {
                number: configFields.Structure.line,
                line: `- Structure: ${configFields.Structure.value}`,
                part: 'Config',
            },
            declaredPartSet,
            addProblem,
        ));
    }

    const strummingCount = countStrummingPatterns(configFields);
    for (const one of fences) {
        checkFenceBody(one, addProblem, addWarning, strummingCount);
    }

    const playedSet = new Set(
        playOrder.map((one) => {
            return one.partName;
        }),
    );
    for (const [partName, line] of declaredAt) {
        // Silent while the play order is partial: past the token Structure
        // broke on, "never played" is not known, it is merely unread.
        if (partName === 'Config' || playedSet.has(partName) || isPlayOrderPartial) {
            continue;
        }
        addWarning(
            { number: line, line: `ol:${partName}`, part: partName },
            `${partName} is written but Structure never plays it.`,
            'Add its code to Structure, or leave it as a section the team ' +
                'can jump to by hand.',
        );
    }

    problems.sort((left, right) => {
        return left.line - right.line;
    });
    return {
        ok: problems.length === 0,
        problems,
        warnings,
        song: genSongSummary(configFields, declaredAt, fences, {
            playOrder,
            isPlayOrderPartial,
        }),
    };
}

function toRealBodyLines(fence) {
    return fence.bodyLines.filter((entry) => {
        return entry.line.trim() !== '' && !COMMENT_PATTERN.test(entry.line);
    });
}

function checkFenceBody(fence, addProblem, addWarning, strummingCount) {
    if (fence.header === 'Config' || fence.header === null) {
        return;
    }
    const bodyLines = toRealBodyLines(fence);
    if (fence.bodyRule === 'lyric') {
        for (const entry of bodyLines) {
            checkLyricLine(entry.line, (message, hint) => {
                addProblem(entry, message, hint);
            });
        }
        return;
    }
    if (fence.bodyRule === 'progression') {
        checkProgressionBody(bodyLines, fence.header, addProblem);
        return;
    }
    if (fence.bodyRule !== 'mixed') {
        return;
    }
    for (const entry of bodyLines) {
        checkMixedLine(entry.line, fence.header, (message, hint) => {
            addProblem(entry, message, hint);
        });
        const strum = entry.line.trim().match(STRUM_DIRECTIVE_PREFIX_PATTERN);
        if (strum !== null && Number(strum[1]) > strummingCount) {
            // A warning, not a problem: open-lyric accepts a {p: #N} pointing
            // at nothing (probed), and it still means the section plays with
            // no pattern the writer thought they had chosen.
            addWarning(
                entry,
                `{p: #${strum[1]}} points at strumming pattern ${strum[1]}, ` +
                    `and Config lists ${strummingCount}.`,
                strummingCount === 0
                    ? 'Add a "- Strumming Patterns:" entry to Config, or take ' +
                          'the directive out.'
                    : `The patterns are numbered 1 to ${strummingCount}, in the ` +
                          'order Config lists them.',
            );
        }
    }
}

function countStrummingPatterns(configFields) {
    const field = configFields['Strumming Patterns'];
    if (field === undefined) {
        return 0;
    }
    return (field.value === '' ? 0 : 1) + field.extra.length;
}

function genSongSummary(configFields, declaredAt, fences, playOrderInfo) {
    const valueOf = (name) => {
        return configFields[name]?.value ?? null;
    };
    const sections = [...declaredAt.keys()]
        .filter((one) => {
            return one !== 'Config';
        })
        .map((partName) => {
            const fence = fences.find((one) => {
                return one.partName === partName;
            });
            return {
                partName,
                lineCount: fence === undefined ? 0 : toRealBodyLines(fence).length,
            };
        });
    if (sections.length === 0 && valueOf('Title') === null) {
        return null;
    }
    return {
        title: valueOf('Title'),
        artist: valueOf('Artist'),
        copyright: valueOf('Copyright'),
        key: valueOf('Key'),
        tempo: valueOf('Tempo'),
        time: valueOf('Time'),
        locales: valueOf('Locales'),
        sections,
        playOrder: playOrderInfo.playOrder,
        isPlayOrderPartial: playOrderInfo.isPlayOrderPartial,
    };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

function genPlayOrderText(playOrder) {
    const shown = playOrder.slice(0, MAX_PLAY_ORDER_ENTRIES).map((one) => {
        return one.repeat > 1 ? `${one.partName} x${one.repeat}` : one.partName;
    });
    const rest = playOrder.length - shown.length;
    return shown.join(' → ') + (rest > 0 ? ` → … (${rest} more)` : '');
}

function genProblemLines(list) {
    const shown = list.slice(0, MAX_REPORTED_PROBLEMS);
    const out = shown.map((one) => {
        const where = one.part === null ? '' : ` (${one.part})`;
        return [
            `Line ${one.line}${where}: ${one.message}`,
            one.excerpt === null ? null : `    ${one.excerpt}`,
            one.hint === null ? null : `    → ${one.hint}`,
        ]
            .filter((piece) => {
                return piece !== null;
            })
            .join('\n');
    });
    const rest = list.length - shown.length;
    if (rest > 0) {
        out.push(`… and ${rest} more.`);
    }
    return out.join('\n');
}

/**
 * The validation result as the sentences a volunteer can act on.
 *
 * Text rather than JSON on purpose: it is what the assistant relays almost
 * verbatim, and the same facts cost roughly half as many tokens this way --
 * charged on every remaining round of the answer.
 */
export function formatOpenLyricReport(result) {
    const pieces = [];
    if (result.ok) {
        pieces.push('Valid Open Lyric. No problems found.');
    } else {
        const count = result.problems.length;
        pieces.push(
            `Not valid Open Lyric — ${count} ` +
                `${count === 1 ? 'problem' : 'problems'}. The Lyric Editor ` +
                'will not accept the song until every one is fixed.',
        );
        pieces.push(genProblemLines(result.problems));
    }
    if (result.warnings.length > 0) {
        pieces.push(
            'Worth knowing (open-lyric accepts the song on these points):\n' +
                genProblemLines(result.warnings),
        );
    }
    const song = result.song;
    if (song !== null) {
        const head = [
            song.title === null ? null : `"${song.title}"`,
            song.artist === null ? null : `by ${song.artist}`,
        ]
            .filter((one) => {
                return one !== null;
            })
            .join(' ');
        const facts = [
            song.key === null ? null : `key ${song.key}`,
            song.tempo,
            song.time,
            song.locales,
        ].filter((one) => {
            return one !== null && one !== '';
        });
        const lines = [];
        if (head !== '' || facts.length > 0) {
            lines.push(
                `Song: ${[head, facts.join(', ')]
                    .filter((one) => {
                        return one !== '';
                    })
                    .join(' — ')}`,
            );
        }
        if (song.sections.length > 0) {
            lines.push(
                `Sections (${song.sections.length}): ` +
                    song.sections
                        .map((one) => {
                            return (
                                `${one.partName} (${one.lineCount} ` +
                                `${one.lineCount === 1 ? 'line' : 'lines'})`
                            );
                        })
                        .join(', '),
            );
        }
        if (song.playOrder.length > 0) {
            lines.push(
                song.isPlayOrderPartial
                    ? 'Play order, as far as Structure could be read: ' +
                          `${genPlayOrderText(song.playOrder)} → ?`
                    : `Play order: ${genPlayOrderText(song.playOrder)}`,
            );
        }
        if (lines.length > 0) {
            pieces.push(lines.join('\n'));
        }
    }
    return pieces.join('\n\n');
}

/** Validate and report in one call -- what the MCP tool does. */
export function checkOpenLyricText(text) {
    return formatOpenLyricReport(validateOpenLyric(text));
}
