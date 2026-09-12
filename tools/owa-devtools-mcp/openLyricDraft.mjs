// Turning whatever the user has into a song the Lyric Editor will accept.
//
// `openLyric.mjs` answers "is this valid?". This answers "make it valid" --
// from a paste, from a file somebody dropped on the chat window, from the text
// of a page `owa_read_website` fetched. It is the other half of the same job
// and it is deliberately NOT in that file: the two tests that keep the grammar
// honest re-read `schema.md` and open-lyric's own validator against it, and an
// emitter has no business perturbing what they check.
//
// WHY A MACHINE WRITES THIS AND NOT THE MODEL. Measured against the real
// validator, 2026-09-02, on one ordinary hymn:
//
//   plain lyrics, as pasted     1 problem  -- no ol:Config at all
//   a plausible model attempt   9 problems -- no `- ` prefix, `72 bpm`,
//                               spaces in Structure, `[...]` read as a chord
//   a CAREFUL model attempt     2 problems -- `CC` must be `Cx2`; free text
//                               inside ol:Instrumental, which takes chords only
//   this module                 valid
//
// The last two are the point. A careful attempt still dies, and it dies on
// traps that are invisible from the outside -- so the fix is not a longer
// prompt. A language model should not be asked to write a format with rules
// like "the same part may not appear twice in a row". It writes the WORDS;
// this writes the NOTATION.
//
// Everything emitted is round-tripped through `validateOpenLyric` before it is
// handed back, so a drift here cannot quietly produce a broken song: it
// produces a report saying the song is broken. And when tier 1 is refused for
// any reason at all, tier 2 rebuilds every part as a `Breakdown` fence, which
// open-lyric does not validate -- the same two-tier shape the song-import
// plugin under `src/plugins/song-select/` already uses, for the same reason:
// a song that imports imperfectly beats a song that does not import.
//
// The two importers in `src/` cannot be reused from here -- this package may
// not import an app module -- so the sanitisers below are re-expressed rather
// than shared. That is a third copy of this idea in the repo; `MC-19` tracks
// unifying them.

import {
    OPEN_LYRIC_FENCE_LIST,
    OPEN_LYRIC_KEY_LIST,
    OPEN_LYRIC_MAX_CHARS,
    OPEN_LYRIC_TIME_LIST,
    checkIsOpenLyricChord,
    formatOpenLyricReport,
    validateOpenLyric,
} from './openLyric.mjs';
import {
    BAR_TOKEN_PATTERN,
    REPEAT_TOKEN_PATTERN,
    readLyricPage,
    toAsciiDigits,
} from './lyricPageText.mjs';

/** Long enough for any real song title, short enough that prose is not one. */
const MAX_TITLE_LENGTH = 80;
/** A section label is a short line on its own; a lyric line rarely is. */
const MAX_LABEL_LENGTH = 40;
/** Below this there is no song here, whatever the words are. */
const MIN_SONG_LINES = 2;
/** What open-lyric's own plain-text import fills in, and both app importers. */
const DEFAULT_CONFIG = {
    Artist: 'Unknown Artist',
    Copyright: 'Unknown',
    Key: 'C',
    Tempo: '120bpm',
    Time: '4/4',
};
const FENCE_MARKER = '```';
/** Long enough for any real address, short enough not to be a payload. */
const MAX_SOURCE_URL_LENGTH = 300;
/** A tool result rides every remaining round; a whole hymn should not. */
const MAX_ECHOED_MARKDOWN = 12000;

const FENCE_BY_HEADER = new Map(
    OPEN_LYRIC_FENCE_LIST.map((one) => {
        return [one.header, one];
    }),
);

// What people actually write above a stanza, mapped onto the fence that means
// it. A line is only a LABEL if it hits this map (or is a bare number), which
// is what stops `[sic]`, `(2x)` and `[G]` becoming sections of a song.
const LABEL_HEADER_MAP = {
    verse: 'Verse',
    v: 'Verse',
    stanza: 'Verse',
    rap: 'Verse',
    chorus: 'Chorus',
    c: 'Chorus',
    refrain: 'Refrain',
    prechorus: 'Pre-Chorus',
    build: 'Pre-Chorus',
    lift: 'Pre-Chorus',
    postchorus: 'Post-Chorus',
    finalchorus: 'Final-Chorus',
    lastchorus: 'Final-Chorus',
    bridge: 'Bridge',
    middle: 'Bridge',
    middle8: 'Bridge',
    tag: 'Tag',
    hook: 'Refrain',
    note: 'Note',
    spoken: 'Note',
    keychange: 'Note',
    intro: 'Intro',
    outro: 'Outro',
    ending: 'Outro',
    coda: 'Outro',
    fine: 'Outro',
    vamp: 'Vamp',
    turnaround: 'Turnaround',
    breakdown: 'Breakdown',
    break: 'Breakdown',
    solo: 'Solo',
    // Recognised, and deliberately sent to `Breakdown` rather than to the
    // fence of the same name. Leaving them out of this map does NOT keep them
    // away from that fence -- it stops the line being read as a label at all,
    // so "[Instrumental]" becomes a lyric somebody sings.
    instrumental: 'Breakdown',
    instr: 'Breakdown',
    interlude: 'Breakdown',
    musical: 'Breakdown',
    music: 'Breakdown',
    riff: 'Breakdown',
};

/** `Repeat Chorus`, `Back to Verse 1` -- sung again, not written again. */
const REFERENCE_PATTERN = /^(?:repeat|repeat\s+the|back\s+to|then)\s+(.+)$/i;

// ---------------------------------------------------------------------------
// Getting to the words
// ---------------------------------------------------------------------------

/**
 * Strip the wrapper `owa_read_website` puts round a page, when the caller
 * pasted its whole answer in. The fence is a security boundary on the way OUT
 * (a page is a document that was read, never an instruction); on the way back
 * IN it is noise, and a song with `--- END WEBSITE TEXT ---` sitting in it as
 * a lyric line is the sort of thing nobody notices until it is on a projector.
 */
export function stripWebsiteWrapper(text) {
    const begin = text.indexOf('--- BEGIN WEBSITE TEXT');
    if (begin === -1) {
        return text;
    }
    const closed = text.indexOf('---', begin + '--- BEGIN WEBSITE TEXT'.length);
    const from = closed === -1 ? begin : closed + 3;
    const end = text.indexOf('--- END WEBSITE TEXT', from);
    return text.slice(from, end === -1 ? undefined : end);
}

/**
 * The text as lines, with a page of chords read back into a song.
 *
 * The trailing whitespace survives into `readLyricPage` and is stripped only
 * on the way out, because on a flattened chord sheet a fragment's trailing
 * space is the only surviving evidence that the chord after it landed between
 * two words rather than inside one.
 */
function toCleanLines(text, markers) {
    const whole = String(text ?? '');
    const inner = stripWebsiteWrapper(whole);
    const source = readSourceUrl(whole);
    const raw = inner.replace(/\r\n?/g, '\n').split('\n');
    const page = readLyricPage(raw, {
        ...markers,
        // The wrapper is the one piece of PROOF that this text came off a
        // page. Sniffing for chords and icons finds a chord site; a hymn-text
        // site has neither, and its menu would have been drafted as verse one.
        isFromPage: inner !== whole,
        // So the footer's own `© 2026 Site.com` is not taken for the
        // song's notice. Off the header this package wrote, never the body.
        siteHost: toHostname(source),
        checkIsLabel: (line) => {
            return parseSectionLabel(line) !== null;
        },
    });
    return {
        ...page,
        source,
        lines: page.lines.map((line) => {
            return line.replace(/\s+$/, '');
        }),
    };
}

/** The hostname of an address, or `''` for anything that is not one. */
function toHostname(url) {
    try {
        return url === '' ? '' : new URL(url).hostname;
    } catch {
        return '';
    }
}

/**
 * The address the words came from, off `owa_read_website`'s own header line.
 *
 * Read ONLY from in front of the fence, never from the page body: the header
 * is written by this package and the body is written by a stranger, and a
 * `Read https://…` line planted in a page would otherwise end up in the
 * user's own song file as its source.
 *
 * It goes into the Config `Attachments` field, which is where open-lyric puts
 * a link belonging to a song -- the Public Domain Songs importer already does
 * exactly this, and the app draws it as a final slide. A song whose file says
 * where its words came from is one whose next reader can go and check.
 */
function readSourceUrl(whole) {
    const at = whole.indexOf('--- BEGIN WEBSITE TEXT');
    if (at === -1) {
        return '';
    }
    const matched = /^Read\s+(https?:\/\/\S+)\s*$/m.exec(whole.slice(0, at));
    const url = matched === null ? '' : matched[1];
    return url.length > MAX_SOURCE_URL_LENGTH ? '' : url;
}

/**
 * A lyric line, made safe for a fence body.
 *
 * Five separate things bite here and every one of them is silent: a `[` opens
 * a chord annotation that never closes, a stray `]` is an error on its own, a
 * line starting with a fence marker ends the section early, a leading `//` is
 * eaten as a comment -- and the one nothing else in this repo guards against,
 * because nothing else in this repo takes text a human indented:
 *
 * AN INDENTED LINE IS THE TRANSLATION OF THE LINE ABOVE IT (schema.md §2).
 *
 * A hymn book scrape and a chord sheet are both full of leading whitespace, so
 * keeping it would quietly turn half a song into translations of the other
 * half. It stays VALID, so no validator catches it, and it is plainly wrong
 * the moment it reaches a projector.
 */
export function toSafeLyricLine(line) {
    // The ONE indent that is kept, and it is kept because it was put there on
    // purpose: `readLyricPage` flattens every tab it is given and then re-adds
    // exactly one, in front of a line it identified as the translation of the
    // line above. Nothing else in this file can produce a leading tab, so
    // preserving it cannot resurrect the trap the rest of this function exists
    // to close.
    const indent = line.startsWith('\t') ? '\t' : '';
    return (
        indent +
        toSafeBrackets(line.replace(/`/g, "'"))
            .replace(/^\s*\/\/+\s*/, '')
            .replace(/^\s+/, '')
    );
}

/**
 * `[` and `]` neutralised -- EXCEPT where they hold a chord.
 *
 * Every bracket used to go, because a `[` that does not open a valid chord
 * annotation and close on the same line is an error, and a bare `]` is one on
 * its own. Then `readLyricPage` learnt to write the chords a page glues to
 * its words back into the line as annotations, and this function was rubbing
 * out every one of them a line later: `|[D]morning` came out `|(D)morning`,
 * a chord turned into a word somebody sings.
 *
 * So the test is the chord grammar itself. A bracket holding something
 * open-lyric accepts as a chord is left exactly as it is -- and it can only
 * be there because this package put it there, having checked the same way --
 * while every other bracket is rewritten as before.
 */
function toSafeBrackets(line) {
    let out = '';
    let rest = line;
    for (;;) {
        const at = rest.indexOf('[');
        if (at === -1) {
            break;
        }
        out += rest.slice(0, at).replace(/\]/g, ')');
        const close = rest.indexOf(']', at);
        const inner = close === -1 ? null : rest.slice(at + 1, close);
        if (inner !== null && checkIsOpenLyricChord(inner)) {
            out += `[${inner}]`;
            rest = rest.slice(close + 1);
        } else {
            out += '(';
            rest = rest.slice(at + 1);
        }
    }
    return out + rest.replace(/\]/g, ')');
}

/**
 * A Config value the editor will actually take, or `''` to fall back.
 *
 * `Key`, `Time` and `Tempo` are closed sets, and a page prints whatever it
 * likes in them -- a capo note, a key the notation has no name for, a tempo
 * with a space in it. Passing one straight through fails validation, which
 * sends the WHOLE song to tier 2 and loses every verse and chorus name over
 * one field nobody would miss. Better to say the field was not usable and
 * keep the song.
 */
function toTrustedConfigValue(field, value) {
    if (value === '') {
        return '';
    }
    if (field === 'Key') {
        return OPEN_LYRIC_KEY_LIST.includes(value) ? value : '';
    }
    if (field === 'Time') {
        return OPEN_LYRIC_TIME_LIST.includes(value) ? value : '';
    }
    if (field === 'Tempo') {
        // `73 bpm` and `73BPM` are the same tempo as `73bpm`, and only one of
        // them is legal. Closing that gap here is worth more than reporting it.
        const compact = value.replace(/\s+/g, '').toLowerCase();
        return /^[1-9]\d*bpm$/.test(compact) ? compact : '';
    }
    return value;
}

/** A Config value cannot carry a newline, and a backtick reads as markup. */
function toSafeConfigValue(value) {
    return String(value ?? '')
        .replace(/`/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Is this a line of chords rather than a line of words? A chord SHEET puts
 * them above the lyric, and carried into a fence they become the song's own
 * words -- "G D Em C", sung out loud.
 *
 * A single-letter line is left alone on purpose: `A` is a valid chord and also
 * a word, and dropping a lyric is worse than keeping a chord.
 */
export function checkIsChordLine(line) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return false;
    }
    let chords = 0;
    let bars = 0;
    for (const token of tokens) {
        if (BAR_TOKEN_PATTERN.test(token)) {
            bars += 1;
            continue;
        }
        if (REPEAT_TOKEN_PATTERN.test(token)) {
            continue;
        }
        if (!checkIsOpenLyricChord(token)) {
            return false;
        }
        chords += 1;
    }
    // A progression is written with bars: `| E | C#m | A | B | (2x)`. Without
    // counting them as part of the line it read as words, and an Intro nobody
    // sings became four bars of lyrics on a slide.
    if (chords === 0) {
        return bars > 0;
    }
    return chords > 1 || bars > 0 || tokens[0].length > 1;
}

/**
 * `Intro`, `Outro` and `Turnaround` are `mixed` fences: a line holding a `|`
 * AND a whole-token chord stops being words and becomes a chord progression,
 * at which point its actual words are each reported as an invalid token. A
 * `{`-led line is a directive and has the same problem.
 *
 * Cheap to check, and without it a stanza labelled "Ending" that happens to
 * carry a bar line takes the whole song down to tier 2.
 */
export function checkIsMixedSafe(lines) {
    return lines.every((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('{')) {
            return false;
        }
        if (!trimmed.includes('|')) {
            return true;
        }
        return !trimmed
            .split(/[\s|]+/)
            .filter(Boolean)
            .some(checkIsOpenLyricChord);
    });
}

// ---------------------------------------------------------------------------
// Reading the shape of the song
// ---------------------------------------------------------------------------

/**
 * `[Chorus]`, `Chorus:`, `CHORUS`, `Verse 2`, `2.`, `១.`, `Verse 1:(2x)`,
 * `Repeat Chorus(4x)` -- or not a label at all.
 *
 * Three things a lyrics page writes that a person typing does not:
 *
 *   - the number in the script the song is printed in, which is why every
 *     numeral goes through `toAsciiDigits` first. A Khmer hymnal's verses are
 *     `១.` `២.` `៣.`, and unread they are not labels, so the whole song
 *     arrives as one undivided verse.
 *   - how many times to sing it, in a trailing `(2x)`. That is the Structure,
 *     not the name, and it is thrown away by anything that only reads names.
 *   - a line that REFERS to a part rather than opening one. "Repeat Chorus" is
 *     an instruction; written as a section it becomes a fence with no words in
 *     it and the chorus goes missing from the play order.
 */
export function parseSectionLabel(line) {
    let bare = toAsciiDigits(line).trim();
    let repeat = 1;
    // Trailing parentheticals, innermost last: `(2x)` says how many times,
    // `(Gtr Solo)` says nothing this can use. Both have to come off the name.
    for (let guard = 0; guard < 4; guard += 1) {
        const matched = /^(.*?)[\s:.-]*[([{]([^()[\]{}]*)[)\]}]\s*$/.exec(bare);
        if (matched === null || matched[1].trim() === '') {
            break;
        }
        const inner = matched[2].trim();
        const times = /^x?\s*(\d{1,2})\s*x?$/i.exec(inner);
        if (times !== null && /x/i.test(inner)) {
            repeat = Math.max(repeat, Number(times[1]));
        }
        bare = matched[1];
    }
    bare = bare
        .replace(/^[[({<]+/, '')
        .replace(/[\])}>]+$/, '')
        .replace(/[:.\-–—]+$/, '')
        .trim();
    if (bare === '' || bare.length > MAX_LABEL_LENGTH) {
        return null;
    }
    const reference = REFERENCE_PATTERN.exec(bare);
    if (reference !== null) {
        const referred = parseSectionLabel(reference[1]);
        return referred === null
            ? null
            : { ...referred, repeat, label: bare, isReference: true };
    }
    // A lone number above a stanza is how a hymn book numbers its verses --
    // but only up to a point. A page's copyright year sits on a line of its
    // own too, and `Verse 1984` beside `Verse 5` is how you can tell.
    const numberOnly = /^([1-9]\d?)$/.exec(bare);
    if (numberOnly !== null) {
        return {
            header: 'Verse',
            index: Number(numberOnly[1]),
            label: bare,
            repeat,
            isReference: false,
        };
    }
    const matched = /^(.*?)\s*([1-9]\d*)?$/.exec(bare);
    const word = (matched === null ? bare : matched[1])
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[\s_\-–—]/g, '');
    const header = LABEL_HEADER_MAP[word];
    if (header === undefined) {
        return null;
    }
    return {
        header,
        index:
            matched === null || matched[2] === undefined
                ? null
                : Number(matched[2]),
        label: bare,
        repeat,
        isReference: false,
    };
}

/**
 * Hands out part names nobody else has, and slides a colliding index up rather
 * than emitting a duplicate -- two parts with one name is an error, and two
 * stanzas both labelled "Chorus 1" is what a real lyrics page looks like.
 */
class PartNamer {
    constructor() {
        this.taken = new Set();
        this.breakdownCount = 0;
    }

    /** `Verse 2` / `Chorus` / null when this header can hold no more. */
    next(header, wantedIndex) {
        const fence = FENCE_BY_HEADER.get(header);
        if (fence === undefined) {
            return null;
        }
        if (!fence.allowsNumbering) {
            // Intro, Outro, Final-Chorus and Vamp cannot be numbered, so a
            // second one has nowhere to go and becomes free text instead.
            if (this.taken.has(header)) {
                return null;
            }
            this.taken.add(header);
            return { partName: header, structureCode: fence.structureCode };
        }
        if (wantedIndex === null && !this.taken.has(header)) {
            this.taken.add(header);
            return { partName: header, structureCode: fence.structureCode };
        }
        let index = wantedIndex === null ? 1 : wantedIndex;
        while (this.taken.has(`${header} ${index}`)) {
            index += 1;
        }
        this.taken.add(`${header} ${index}`);
        return {
            partName: `${header} ${index}`,
            structureCode: `${fence.structureCode}${index}`,
        };
    }

    /** The bucket nothing can fall out of: free text, validated not at all. */
    nextBreakdown() {
        this.breakdownCount += 1;
        const index = this.breakdownCount;
        this.taken.add(`Breakdown ${index}`);
        return { partName: `Breakdown ${index}`, structureCode: `D${index}` };
    }
}

/**
 * Split the cleaned lines into `{label, lines}` blocks -- by explicit labels
 * where the text has them, and by blank lines where it does not.
 */
export function toRawBlocks(lines) {
    const blocks = [];
    let current = null;
    const push = () => {
        // A reference is kept even with nothing under it -- an empty one is
        // exactly what "Repeat Chorus" is, and it is the play order.
        if (
            current !== null &&
            (current.lines.length > 0 || current.label?.isReference === true)
        ) {
            blocks.push(current);
        }
        current = null;
    };
    for (const line of lines) {
        if (line.trim() === '') {
            push();
            continue;
        }
        const label = parseSectionLabel(line);
        if (label !== null) {
            push();
            current = { label, lines: [] };
            continue;
        }
        if (current === null) {
            current = { label: null, lines: [] };
        }
        current.lines.push(line);
    }
    push();
    return toNumberedBlocks(blocks);
}

/** `1 ` at the head of a stanza's first line, as printed in a hymn book. */
const STANZA_NUMBER_PATTERN = /^\s*([1-9]\d?)[ .)\]]\s*(\S.*)$/;

/**
 * Stanzas numbered in line, rather than above.
 *
 * A hymn book -- and every site that prints from one -- runs the number into
 * the first line: "1 Amazing grace...". There is no label line to find, so
 * without this the whole hymn is one long unlabelled block and the number is
 * sung as part of the words.
 *
 * Guarded on there being at least TWO of them, because one stanza starting
 * with a numeral is a coincidence and a song about counting is not a song
 * about verses.
 */
function toNumberedBlocks(blocks) {
    const numbered = blocks.filter((block) => {
        return (
            block.label === null &&
            STANZA_NUMBER_PATTERN.test(toAsciiDigits(block.lines[0] ?? ''))
        );
    });
    if (numbered.length < 2) {
        return blocks;
    }
    return blocks.map((block) => {
        if (!numbered.includes(block)) {
            return block;
        }
        const raw = block.lines[0];
        const converted = toAsciiDigits(raw);
        const matched = STANZA_NUMBER_PATTERN.exec(converted);
        // The NUMBER is read off the converted line and the WORDS are cut from
        // the original one. `toAsciiDigits` is one code point in, one out, so
        // the offsets agree -- and taking the converted words instead would
        // rewrite every numeral the song itself sings.
        return {
            label: {
                header: 'Verse',
                index: Number(matched[1]),
                label: matched[1],
                repeat: 1,
                isReference: false,
                // Remembered so the heading a hymnal prints ABOVE stanza 1
                // can be told from a verse somebody wrote.
                isNumbered: true,
            },
            lines: [
                raw.slice(converted.length - matched[2].length),
                ...block.lines.slice(1),
            ],
        };
    });
}

const MAX_HEADING_BLOCK_LINES = 3;

/**
 * A short unlabelled block ABOVE a run of numbered stanzas is the hymn's
 * heading, not its first verse.
 *
 * Measured 2026-09-08: a model that had read a hymnal page handed the words
 * over with the page's own title line, "Author: …" and "Tune: NEW BRITAIN"
 * above "1 Amazing grace…"; the author line was read as a field, the other
 * two became a three-line Verse 1, and the six real stanzas were numbered
 * two to seven. A verse is four lines or more on every hymnal there is, so
 * a block of up to three, unlabelled, sitting where the heading goes, is the
 * heading. Only when the stanzas ARE numbered: with nothing numbered, a
 * three-line opening block is a short verse and stays.
 *
 * @returns {{blocks: object[], droppedLines: number, heading: string[]}}
 *   `heading` is what was left out, in order, for a caller that still needs
 *   a title.
 */
export function dropHeadingAboveNumberedStanzas(blocks) {
    const firstNumbered = blocks.findIndex((block) => {
        return block.label?.isNumbered === true;
    });
    const numberedCount = blocks.filter((block) => {
        return block.label?.isNumbered === true;
    }).length;
    if (numberedCount < 2 || firstNumbered < 1) {
        return { blocks, droppedLines: 0, heading: [] };
    }
    const headingBlocks = blocks.slice(0, firstNumbered);
    const isHeading = headingBlocks.every((block) => {
        return (
            block.label === null &&
            block.lines.length <= MAX_HEADING_BLOCK_LINES
        );
    });
    if (!isHeading) {
        return { blocks, droppedLines: 0, heading: [] };
    }
    const heading = headingBlocks.flatMap((block) => {
        return block.lines.map((line) => {
            return line.trim();
        });
    });
    return {
        blocks: blocks.slice(firstNumbered),
        droppedLines: heading.length,
        heading,
    };
}

/** Everything the Config block can be told by the text itself. */
function readConfigFromText(lines) {
    const found = {};
    const consumed = new Set();
    const pattern =
        /^\s*(title|artist|author|by|copyright|key|tempo|time)\s*:\s*(.+)$/i;
    lines.forEach((line, index) => {
        const matched = pattern.exec(line);
        if (matched === null) {
            return;
        }
        const name = matched[1].toLowerCase();
        const field =
            name === 'author' || name === 'by'
                ? 'Artist'
                : name.charAt(0).toUpperCase() + name.slice(1);
        if (found[field] === undefined) {
            found[field] = toSafeConfigValue(matched[2]);
            consumed.add(index);
        }
    });
    return { found, consumed };
}

/**
 * The title, when the text plainly gives one: a markdown heading, or a first
 * line standing alone above a blank one.
 *
 * NOT simply "the first line" -- for most hymns that is the first line of the
 * first verse, and a song called "Amazing grace how sweet the sound" with that
 * line then missing from verse 1 is worse than one called "Untitled".
 */
function readTitle(lines) {
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === '') {
            continue;
        }
        const heading = /^#{1,6}\s+(.+)$/.exec(line.trim());
        if (heading !== null) {
            return { title: toSafeConfigValue(heading[1]), lineIndex: index };
        }
        const next = lines[index + 1];
        if (
            line.trim().length <= MAX_TITLE_LENGTH &&
            parseSectionLabel(line) === null &&
            (next === undefined || next.trim() === '')
        ) {
            return { title: toSafeConfigValue(line), lineIndex: index };
        }
        return { title: null, lineIndex: -1 };
    }
    return { title: null, lineIndex: -1 };
}

// ---------------------------------------------------------------------------
// Writing it out
// ---------------------------------------------------------------------------

/** Adjacent repeats become a repeat count: `CC` is refused, `Cx2` is not. */
export function toStructureText(codes) {
    const runs = [];
    for (const code of codes) {
        const last = runs[runs.length - 1];
        if (last !== undefined && last.code === code) {
            last.repeat += 1;
            continue;
        }
        runs.push({ code, repeat: 1 });
    }
    return runs
        .map((one) => {
            return one.repeat > 1 ? `${one.code}x${one.repeat}` : one.code;
        })
        .join('');
}

function genMarkdown(config, parts, playCodes) {
    const lines = [];
    if (config.Title) {
        lines.push(`# ${config.Title}`, '');
    }
    lines.push(`${FENCE_MARKER}ol:Config`);
    // The leading `- ` is required on every one of these, and leaving it off is
    // the first mistake everything that writes this format makes.
    for (const field of [
        'Title',
        'Artist',
        'Copyright',
        'Key',
        'Tempo',
        'Time',
    ]) {
        lines.push(`- ${field}: ${config[field]}`);
    }
    lines.push(`- Structure: ${toStructureText(playCodes)}`);
    if (config.Attachments) {
        // After `Structure`, which is the order open-lyric's own field list
        // uses. One bare URL on the line is the simplest of the two shapes
        // that field takes.
        lines.push(`- Attachments: ${config.Attachments}`);
    }
    lines.push(FENCE_MARKER, '');
    for (const part of parts) {
        lines.push(`${FENCE_MARKER}ol:${part.partName}`);
        if (part.comment) {
            lines.push(`// ${part.comment}`);
        }
        lines.push(...part.lines);
        lines.push(FENCE_MARKER, '');
    }
    return lines.join('\n').replace(/\n+$/, '\n');
}

/**
 * The play order, which is not the list of parts: a refrain is written once
 * and sung after every verse, so it appears once above and many times here.
 */
function genPlayCodes(parts, occurrences) {
    const codeByPart = new Map(
        parts.map((one) => {
            return [one.partName, one.structureCode];
        }),
    );
    return occurrences
        .map((partName) => {
            return codeByPart.get(partName);
        })
        .filter((code) => {
            return code !== undefined;
        });
}

// ---------------------------------------------------------------------------
// The two tiers
// ---------------------------------------------------------------------------

/** The blocks as bodies, with the empties and the chord sheets taken out. */
function toBodies(blocks) {
    return blocks.map((block) => {
        return block.lines.map(toSafeLyricLine).filter((line) => {
            return line.trim() !== '' && !checkIsChordLine(line);
        });
    });
}

/**
 * What an unlabelled stanza that comes round again should be CALLED.
 *
 * Not every repeat is a chorus: a repeated single line is a tag, and the
 * opening stanza repeating is a song that starts and ends the same way rather
 * than a song whose first verse is its chorus. Getting this wrong is not a
 * validation error -- it is a wrong word on the presenter's section list,
 * which nothing would ever catch.
 */
function genRepeatHeader(body, count, isFirst) {
    if (count < 2 || isFirst) {
        return 'Verse';
    }
    return body.length < 2 ? 'Tag' : 'Chorus';
}

/** Fences whose words a bar line would turn into chords. */
const MIXED_HEADER_LIST = ['Intro', 'Outro', 'Turnaround'];

/**
 * Which fence each block wants, before anything is named.
 *
 * A pass of its own because the NAME depends on how many of that header the
 * whole song turns out to hold: one verse is `Verse`, two are `Verse 1` and
 * `Verse 2`, and `Verse` beside `Verse 1` -- which is what naming them as they
 * came did -- is two legal part names that read as a mistake.
 */
function planTierOne(blocks, bodies, notes) {
    const bodyCount = new Map();
    for (const body of bodies) {
        if (body.length > 0) {
            const key = body.join('\n').toLowerCase();
            bodyCount.set(key, (bodyCount.get(key) ?? 0) + 1);
        }
    }
    const planned = [];
    const seenKeys = new Set();
    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const body = bodies[index];
        if (block.label?.isReference === true) {
            planned.push({ isReference: true, block, body: [], header: null });
            continue;
        }
        if (body.length === 0) {
            planned.push(null);
            continue;
        }
        const bodyKey = body.join('\n').toLowerCase();
        if (seenKeys.has(bodyKey)) {
            // Sung again, not written again.
            planned.push({ bodyKey, header: null, block, body });
            continue;
        }
        const wasFirst = seenKeys.size === 0;
        seenKeys.add(bodyKey);
        if (block.label === null) {
            notes.isInferred = true;
        }
        let header =
            block.label === null
                ? genRepeatHeader(body, bodyCount.get(bodyKey) ?? 1, wasFirst)
                : block.label.header;
        if (block.label === null && header !== 'Verse') {
            notes.isFolded = true;
        }
        // A `mixed` fence turns words into chords the moment a bar line shows
        // up in them, so a stanza that cannot be one is kept as free text.
        if (MIXED_HEADER_LIST.includes(header) && !checkIsMixedSafe(body)) {
            header = 'Breakdown';
        }
        planned.push({ bodyKey, header, block, body });
    }
    const headerCount = new Map();
    for (const one of planned) {
        if (one !== null && one.header !== null) {
            headerCount.set(one.header, (headerCount.get(one.header) ?? 0) + 1);
        }
    }
    return { planned, headerCount };
}

function genTierOne(blocks, config) {
    const namer = new PartNamer();
    const parts = [];
    const occurrences = [];
    const byBody = new Map();
    const namedByLabel = new Map();
    const notes = { isInferred: false, brokenOut: [], isFolded: false };
    const bodies = toBodies(blocks);
    const { planned, headerCount } = planTierOne(blocks, bodies, notes);
    // Sung twice is not written twice: `(2x)` on a label belongs in the play
    // order, where `toStructureText` turns the run back into `V1x2`.
    const pushOccurrences = (partName, times) => {
        for (let count = 0; count < Math.max(1, times ?? 1); count += 1) {
            occurrences.push(partName);
        }
    };
    for (const one of planned) {
        if (one === null) {
            continue;
        }
        // "Repeat Chorus (4x)" names a part that is already written out. It
        // contributes to the play order and to nothing else -- and if it names
        // one the song never declared, it contributes nothing at all rather
        // than an empty fence.
        if (one.isReference === true) {
            const wanted = one.block.label;
            const partName =
                namedByLabel.get(`${wanted.header} ${wanted.index}`) ??
                namedByLabel.get(wanted.header);
            if (partName !== undefined) {
                pushOccurrences(partName, wanted.repeat);
            }
            continue;
        }
        if (one.header === null) {
            const seen = byBody.get(one.bodyKey);
            if (seen !== undefined) {
                pushOccurrences(seen, one.block.label?.repeat ?? 1);
            }
            continue;
        }
        const { block, body } = one;
        // Breakdown is the bucket things fall INTO, so it always numbers --
        // an unnumbered one beside `Breakdown 2` reads as a different kind of
        // thing rather than the first of a set.
        let named =
            one.header === 'Breakdown'
                ? namer.nextBreakdown()
                : namer.next(
                      one.header,
                      block.label?.index ??
                          ((headerCount.get(one.header) ?? 0) > 1 ? 1 : null),
                  );
        if (named === null) {
            named = namer.nextBreakdown();
            notes.brokenOut.push(block.label?.label ?? one.header);
        }
        parts.push({
            partName: named.partName,
            structureCode: named.structureCode,
            lines: body,
            comment:
                named.partName.startsWith('Breakdown') && block.label !== null
                    ? block.label.label
                    : null,
        });
        byBody.set(one.bodyKey, named.partName);
        namedByLabel.set(one.header, named.partName);
        if (block.label?.index != null) {
            namedByLabel.set(`${one.header} ${block.label.index}`, named.partName);
        }
        pushOccurrences(named.partName, block.label?.repeat ?? 1);
    }
    if (parts.length === 0) {
        return null;
    }
    const playCodes = genPlayCodes(parts, occurrences);
    return {
        markdown: genMarkdown(config, parts, playCodes),
        parts,
        notes,
    };
}

/**
 * The tier that cannot fail. `Breakdown` is free text -- open-lyric does not
 * look inside it at all -- so the only things left that could be wrong are the
 * fence markers themselves, and `toSafeLyricLine` has already defused those.
 */
function genTierTwo(blocks, config) {
    const namer = new PartNamer();
    const parts = [];
    for (const block of blocks) {
        const body = block.lines.map(toSafeLyricLine).filter((line) => {
            return line.trim() !== '';
        });
        if (body.length === 0) {
            continue;
        }
        const named = namer.nextBreakdown();
        parts.push({
            partName: named.partName,
            structureCode: named.structureCode,
            lines: body,
            comment: block.label?.label ?? null,
        });
    }
    if (parts.length === 0) {
        return null;
    }
    return {
        markdown: genMarkdown(
            config,
            parts,
            parts.map((one) => {
                return one.structureCode;
            }),
        ),
        parts,
    };
}

// ---------------------------------------------------------------------------
// The one entry point
// ---------------------------------------------------------------------------

/**
 * @typedef {object} OpenLyricDraftType
 * @property {boolean} ok Was a valid song produced.
 * @property {string|null} markdown The document, or null when there was none.
 * @property {'drafted'|'not-a-song'|'already-open-lyric'|'too-long'|'browser-check'} outcome
 * @property {1|2|null} tier Which pass produced it.
 * @property {string[]} guessed What had to be assumed, in plain words.
 * @property {object|null} report The `validateOpenLyric` result for it.
 */

/**
 * What the page reader did, in words the model can repeat to the user.
 *
 * A page has one song on it and a great deal else, and the thing most likely
 * to be wrong about a drafted song is not its notation but WHICH PART OF THE
 * PAGE it was made from. So the area that was identified is reported rather
 * than assumed -- with its first and last line, which is the only evidence a
 * reader has that the toolbar or the footer got in.
 */
function genPageGuesses(notes) {
    if (notes?.isPage !== true || notes.isRegionFound !== true) {
        return [];
    }
    const guesses = [
        `that was a page rather than plain words, so the song was taken from ` +
            `the part running "${notes.firstLine}" to "${notes.lastLine}"` +
            (notes.droppedLines > 0
                ? `, leaving out ${notes.droppedLines} lines of menus, chord ` +
                  'charts and links'
                : '') +
            (notes.isMarked
                ? ''
                : ' -- if that took in too much or too little, say where the ' +
                  'song starts and ends'),
    ];
    if (notes.translations > 0) {
        guesses.push(
            `${notes.translations} lines were in a second language under the ` +
                'line they translate, and were kept as translations of it',
        );
    }
    if ((notes.furniture ?? []).length > 0) {
        // Named, every one: a button swept off the front of a song is the
        // same bet as a credit swept off the end, and a reader who sees
        // "Transpose" in this list knows at once what happened.
        guesses.push(
            `left out above the song, as the page's own buttons rather than ` +
                'words to sing: ' +
                notes.furniture
                    .map((one) => {
                        return `"${one}"`;
                    })
                    .join(', '),
        );
    }
    if (notes.credits.length > 0) {
        guesses.push(
            `left out of the song, as a credit rather than words to sing: ` +
                notes.credits
                    .map((one) => {
                        return `"${one}"`;
                    })
                    .join(', '),
        );
    }
    return guesses;
}

function genRefusal(outcome) {
    return {
        ok: false,
        markdown: null,
        outcome,
        tier: null,
        guessed: [],
        report: null,
    };
}

/**
 * Raw words in, a song out.
 *
 * @param {string} rawText Anything: a paste, a file body, a page's text.
 * @param {{title?: string, artist?: string, from?: string, to?: string}}
 *   [known] What the caller knows and this cannot work out: what the song is
 *   called, who it is by, and -- for a page, where a caller can SEE the layout
 *   that flattening destroyed -- where on it the song starts and ends. All of
 *   it beats anything guessed from the text.
 * @returns {OpenLyricDraftType}
 */
export function draftOpenLyric(rawText, known = {}) {
    const text = String(rawText ?? '');
    if (text.length > OPEN_LYRIC_MAX_CHARS) {
        return genRefusal('too-long');
    }
    if (new RegExp(`^\\s*${FENCE_MARKER}ol:Config`, 'm').test(
        stripWebsiteWrapper(text),
    )) {
        // Already the format. Drafting it again would throw away whatever the
        // author wrote in it -- chords, cues, strumming patterns, a Structure
        // they meant.
        return genRefusal('already-open-lyric');
    }
    if (checkIsBrowserCheckPage(text)) {
        // Measured 2026-09-10: a hymnal's third read in a row came back as the
        // site's "Hold tight... checking your browser..." interstitial, which
        // has enough short lines to pass every test below and was drafted as
        // a valid song called "Untitled" -- with a Create button under it.
        return genRefusal('browser-check');
    }
    const page = toCleanLines(text, {
        from: known.from,
        to: known.to,
    });
    const lines = page.lines;
    const titleRead = readTitle(lines);
    const configRead = readConfigFromText(lines);
    // What the page itself said, under what a plain `Name: value` line says
    // and under what the caller was told outright.
    const pageFound = page.found ?? {};
    const bodyLines = lines.filter((line, index) => {
        return index !== titleRead.lineIndex && !configRead.consumed.has(index);
    });
    const wordLineCount = bodyLines.filter((line) => {
        return line.trim() !== '';
    }).length;
    if (wordLineCount < MIN_SONG_LINES) {
        return genRefusal('not-a-song');
    }
    const guessed = [];
    const { blocks, droppedLines, heading } = dropHeadingAboveNumberedStanzas(
        toRawBlocks(bodyLines),
    );
    const title =
        toSafeConfigValue(known.title) ||
        configRead.found.Title ||
        titleRead.title ||
        toSafeConfigValue(pageFound.Title) ||
        // The heading left out above stanza 1 names the hymn when nothing
        // else did -- its first line, cut at the ` | Site name` a page's own
        // title line carries.
        toSafeConfigValue(
            (heading[0] ?? '').split(/\s+[|–—-]\s+/)[0].slice(0, MAX_TITLE_LENGTH),
        ) ||
        '';
    if (title === '') {
        guessed.push('there was no title in the text, so it is "Untitled"');
    }
    const config = { Title: title === '' ? 'Untitled' : title };
    const refused = [];
    // What the text actually SAID, rather than what happens to equal the
    // default. A page that prints "Time: 4/4" was reported back as having
    // given no time, because 4/4 is also what is used when nothing is given --
    // an honest report that says the opposite of the truth.
    const defaulted = [];
    for (const field of ['Artist', 'Copyright', 'Key', 'Tempo', 'Time']) {
        const said =
            (field === 'Artist' ? toSafeConfigValue(known.artist) : '') ||
            // What the caller was told outright beats what it copied: a
            // model that has read a page passes the words in its own copy,
            // and the page's "Copyright: Public Domain" line, printed far
            // below the stanzas, comes along one time in two (measured
            // 2026-09-08). A slot it can fill from what it read does not
            // depend on which lines it chose to copy.
            (field === 'Copyright' ? toSafeConfigValue(known.copyright) : '') ||
            configRead.found[field] ||
            toSafeConfigValue(pageFound[field]) ||
            '';
        const given = toTrustedConfigValue(field, said);
        if (said !== '' && given === '') {
            refused.push(field);
        } else if (said === '' && ['Key', 'Tempo', 'Time'].includes(field)) {
            defaulted.push(field);
        }
        config[field] = given === '' ? DEFAULT_CONFIG[field] : given;
    }
    if (page.source) {
        config.Attachments = page.source;
        guessed.push(
            'the address the words came from is kept with the song, in its ' +
                'attachments, so whoever opens the file can see where they ' +
                'came from',
        );
    }
    if (defaulted.length > 0) {
        guessed.push(
            'the text gave no ' +
                defaulted
                    .map((field) => {
                        return field.toLowerCase();
                    })
                    .join(', ') +
                ' -- used ' +
                defaulted
                    .map((field) => {
                        return DEFAULT_CONFIG[field];
                    })
                    .join(', '),
        );
    }
    if (refused.length > 0) {
        guessed.push(
            'the ' +
                refused
                    .map((field) => {
                        return field.toLowerCase();
                    })
                    .join(', ') +
                ' the text gave is not one open-lyric has a name for, so the ' +
                'usual value was used instead -- worth setting by hand',
        );
    }
    if (config.Artist === DEFAULT_CONFIG.Artist) {
        guessed.push('nobody was named as the author');
    }
    guessed.push(...genPageGuesses(page.notes));
    if (droppedLines > 0) {
        guessed.push(
            `${droppedLines} ${droppedLines === 1 ? 'line' : 'lines'} above ` +
                'the first numbered verse read as a heading, not as words to ' +
                'sing, and were left out',
        );
    }
    const first = genTierOne(blocks, config);
    if (first !== null) {
        const report = validateOpenLyric(first.markdown);
        if (report.ok) {
            if (first.notes.isInferred) {
                guessed.push(
                    'the text had no section labels, so each block of lines ' +
                        'was read as a verse',
                );
            }
            if (first.notes.isFolded) {
                guessed.push(
                    'a block that came round again word for word was written ' +
                        'once and played each time it appeared -- check that ' +
                        'is really the chorus',
                );
            }
            if (first.notes.brokenOut.length > 0) {
                guessed.push(
                    first.notes.brokenOut.join(', ') +
                        ' could not be a section of its own, so it was kept ' +
                        'as free text',
                );
            }
            return {
                ok: true,
                markdown: first.markdown,
                outcome: 'drafted',
                tier: 1,
                guessed,
                report,
            };
        }
    }
    const second = genTierTwo(blocks, config);
    if (second === null) {
        return genRefusal('not-a-song');
    }
    guessed.push(
        'the sections could not be worked out, so every block was kept as ' +
            'free text with its own label above it -- the words are all ' +
            'there, and the section names may want setting by hand',
    );
    const report = validateOpenLyric(second.markdown);
    return {
        ok: report.ok,
        markdown: second.markdown,
        outcome: 'drafted',
        tier: 2,
        guessed,
        report,
    };
}

/**
 * The words a site's bot check prints instead of its page. Read only off a
 * PAGE (the wrapper is the proof), and only when the page is short: a
 * challenge is a few lines, and a real song page could quote any of these.
 */
const BROWSER_CHECK_PATTERN =
    /\b(?:checking your browser|just a moment|verify (?:that )?you are (?:a )?human|enable javascript and cookies to continue|please wait while we (?:check|verify)|hold tight|attention required!? \| cloudflare|ddos protection by|are you a robot|access denied|security check)\b/i;
const MAX_BROWSER_CHECK_CHARS = 1500;

/**
 * Is this "page" a site's bot check rather than the page that was asked for?
 */
export function checkIsBrowserCheckPage(text) {
    const whole = String(text ?? '');
    const inner = stripWebsiteWrapper(whole);
    if (inner === whole) {
        // Plain words the user pasted, not a page: nothing to check.
        return false;
    }
    const trimmed = inner.trim();
    return (
        trimmed.length <= MAX_BROWSER_CHECK_CHARS &&
        BROWSER_CHECK_PATTERN.test(trimmed)
    );
}

/** The refusal for a bot check, exported so the offline answer can say it. */
export const BROWSER_CHECK_TEXT =
    'That address answered with a browser check ("checking your browser", ' +
    '"verify you are human") instead of the page, so there is no song to ' +
    'read. Ask them to open the page in their browser once, or to paste the ' +
    'words.';

const OUTCOME_TEXT = {
    'browser-check': BROWSER_CHECK_TEXT,
    'not-a-song':
        'That does not read as a song -- there are not enough lines of words ' +
        'in it. Ask them to paste the words themselves, or for a link to the ' +
        'page the words are on.',
    'already-open-lyric':
        'That is already written in Open Lyric notation, so there is nothing ' +
        'to work out. Check it with this same tool and no `mode`, which ' +
        'reports anything the editor would refuse.',
    'too-long':
        'That is too long to make a song out of. Ask for the words on their ' +
        'own, without the rest of the page.',
};

/**
 * The draft as the text the model is handed.
 *
 * Order matters: what happened, then the validation in
 * `formatOpenLyricReport`'s own words -- never re-written here, or the two
 * halves of one tool would come to describe a song differently -- then what
 * had to be guessed, and the notation LAST. A model that runs out of room
 * should lose the part the user is never shown, not the part it has to be
 * honest about.
 */
export function formatOpenLyricDraft(result) {
    if (result.markdown === null) {
        return OUTCOME_TEXT[result.outcome] ?? OUTCOME_TEXT['not-a-song'];
    }
    const pieces = [
        result.tier === 1
            ? 'Drafted a song from the text.'
            : 'Drafted a song from the text, keeping the blocks as they were ' +
              'written because their sections could not be worked out.',
        formatOpenLyricReport(result.report),
    ];
    if (result.guessed.length > 0) {
        pieces.push(
            'Guessed, and worth telling them:\n' +
                result.guessed
                    .map((one) => {
                        return `- ${one}`;
                    })
                    .join('\n'),
        );
    }
    // Capped because a tool RESULT is re-sent on every remaining round of the
    // question, so a long song is charged nine more times over. The schema for
    // this whole mode costs ~48 tokens a round; an uncapped hymn costs twenty
    // times that. What is cut is the only part the user is never shown.
    const shown =
        result.markdown.length > MAX_ECHOED_MARKDOWN
            ? result.markdown.slice(0, MAX_ECHOED_MARKDOWN) +
              '\n[... cut here; ask again for the rest if you need it ...]'
            : result.markdown;
    pieces.push(
        'The song itself is below. Do NOT paste it into your answer -- the ' +
            'buttons under your answer create the file and copy the text.\n' +
            shown,
    );
    return pieces.join('\n\n');
}

/** Draft and report in one call -- what the MCP tool does. */
export function draftOpenLyricText(text, known) {
    return formatOpenLyricDraft(draftOpenLyric(text, known));
}
