// A song page, as lines of words.
//
// `openLyricDraft.mjs` turns lines of words into notation. This turns a WEB
// PAGE into those lines, and it is a separate job because a chord site does
// not serve a song -- it serves a song inside a toolbar, a strumming diagram,
// a fretboard chart, a related-songs rail and a footer, and it lays the song
// itself out in COLUMNS that text extraction flattens into confetti.
//
// What comes out of `owa_read_website` for one verse looks like this:
//
//     |
//     E
//         To the earth You
//     |
//     A
//     humbly came
//     The King of kings
//
// Four facts are buried in that, and all four are lost if it is read as seven
// lines of lyrics:
//
//   1. `|` and `E` are a bar line and a chord. They are POSITIONS, not words,
//      and sung out loud they are nonsense.
//   2. The fragments between them are ONE sung line. The chord sits mid-word
//      as often as not, so they join with no space: "gr" + "ace" is "grace".
//   3. A fragment that follows another fragment with no chord between them is
//      a NEW line -- that is where the page started a new row.
//   4. Everything before the first chord and after the last one is furniture.
//
// So this module does four things, in that order: find the region of the page
// the song is in, drop the furniture, rejoin the fragments, and pair a
// translation with the line it translates. It knows nothing about any
// particular site -- every rule below is about the SHAPE of a chord sheet, and
// each one is a no-op on text that is not one.
//
// THE NO-OP PROMISE. `checkIsPageText` gates the whole thing. An ordinary
// paste -- the case this all started as -- goes through untouched, which is
// what keeps the drafter's existing behaviour and its tests exactly as they
// were. Everything here is extra reach, never a different answer to the old
// question.

import { checkIsOpenLyricChord } from './openLyric.mjs';

/** How much of the wall before a song can be its own opening chords. */
const MAX_OPENER_LINES = 3;
/** Consecutive lines carrying no words before a region is cut in two. */
export const JUNK_RUN_LENGTH = 6;
/** The same, for a page with no chords: consecutive lines too short to sing. */
export const THIN_RUN_LENGTH = 4;
/** A run this long of anything at all is not a stanza; stop reading credits. */
const MAX_CREDIT_LINES = 8;
/** Long enough for a credit line, short enough that a verse is not one. */
const MAX_CREDIT_LENGTH = 48;
/**
 * And short enough in WORDS. A publisher, a fellowship and a chart heading are
 * three or four words; a line somebody sings is usually five or more. The
 * bound is what stops the sweep taking the last line of a song whose page
 * happened to print no chord over it.
 */
const MAX_CREDIT_WORDS = 4;
/** How much of a line to quote back when reporting what was identified. */
const EXCERPT_LENGTH = 60;

/**
 * An icon font's ligature name, leaking into the text as a word.
 *
 * Every icon set in wide use names its glyphs in snake_case, and a page that
 * draws them as ligatures hands that name to anything reading the text. They
 * are not words in any language, so this cannot eat a lyric.
 */
const ICON_WORD_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
/** The same, glued to the front of a real word: `play_arrowPlay`, `check Go`. */
const ICON_PREFIX_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?=[A-Z\s]|$)/;
/** `|`, `||`, `||:`, `:|`, `:||` -- a bar, a repeat open, a repeat close. */
export const BAR_TOKEN_PATTERN = /^:?\|{1,2}:?$/;
/** `(2x)`, `x2`, `2x`, `(x4)` -- how many times, not what. */
export const REPEAT_TOKEN_PATTERN = /^\(?(?:x\s*\d{1,2}|\d{1,2}\s*x)\)?$/i;
/** The same, on the FRONT of a token: `|D`, `||:Bm7`. */
const BAR_PREFIX_PATTERN = /^:?\|{1,2}:?/;
const REPEAT_PATTERN = REPEAT_TOKEN_PATTERN;
/** A fret position on a chord chart: `2fr`, `10fr`. */
const FRET_PATTERN = /^\d{1,2}fr$/i;

const LETTER_PATTERN = /\p{L}/u;
const LATIN_PATTERN = /\p{Script=Latin}/u;
const NON_LATIN_LETTER_PATTERN = /[^\P{L}\p{Script=Latin}]/u;

/**
 * The zero of every decimal digit system a Bible or a hymn book in this app is
 * likely to be printed in. Each is a contiguous run of ten, which is what
 * makes the arithmetic below legal.
 *
 * Khmer is the one that matters -- a Khmer hymnal numbers its verses `១.`,
 * `២.`, `៣.` -- and the others cost a line each.
 */
const DIGIT_ZERO_LIST = [
    0x0660, // Arabic-Indic
    0x06f0, // Extended Arabic-Indic
    0x0966, // Devanagari
    0x09e6, // Bengali
    0x0e50, // Thai
    0x0ed0, // Lao
    0x0f20, // Tibetan
    0x1040, // Myanmar
    0x17e0, // Khmer
    0xff10, // Fullwidth
];

/** Any script's digits as `0`-`9`, so one number pattern serves every one. */
export function toAsciiDigits(text) {
    let out = '';
    for (const character of String(text ?? '')) {
        const code = character.codePointAt(0);
        const zero = DIGIT_ZERO_LIST.find((one) => {
            return code >= one && code <= one + 9;
        });
        out += zero === undefined ? character : String(code - zero);
    }
    return out;
}

/** The line with any leading icon-font ligature taken off the front. */
export function stripIconPrefix(line) {
    return line.replace(ICON_PREFIX_PATTERN, '').replace(/^\s+/, '');
}

/** Bar-glued chords in one region before a bare one is taken as a chord too. */
const GLUED_PAGE_EVIDENCE = 2;

/**
 * A page's chord token pulled apart: the bar markers it carries, and the
 * chord itself. `null` when the token is neither.
 *
 * A chord site does not print `|` and `D` as two separate things. It prints
 * `|D` -- one token -- and text extraction hands it over glued. That matched
 * neither the bar pattern nor open-lyric's chord pattern, so every chord on
 * such a page read as an ordinary WORD and rode into the song as literal
 * text: a slide that said `|D` in front of every second syllable.
 */
export function readChordToken(token) {
    // The same typographic accidentals `classifyLine` normalises, because this
    // is also called on a raw token that has not been through it.
    const text = String(token ?? '')
        .replace(/♯/g, '#')
        .replace(/♭/g, 'b');
    if (text === '') {
        return null;
    }
    const bar = BAR_PREFIX_PATTERN.exec(text)?.[0] ?? '';
    const chord = text.slice(bar.length);
    if (chord === '') {
        return bar === '' ? null : { bar, chord: '' };
    }
    return checkIsOpenLyricChord(chord) ? { bar, chord } : null;
}

/**
 * A chord as open-lyric writes it INSIDE a lyric line: the bar markers, then
 * the annotation, immediately before the syllable it lands on (schema.md §3).
 *
 * The bar goes OUTSIDE the brackets. `[|D]` is what the page looks like and
 * it is REFUSED by open-lyric and by our own validator alike -- the brackets
 * must hold a chord symbol and nothing else, and a root is `A`-`G` -- while
 * `|[D]` is the form the schema's own translation-line example uses. Both
 * were probed against `checkMarkdown` before this line was written.
 */
function toChordMark(parsed) {
    return parsed.chord === '' ? parsed.bar : `${parsed.bar}[${parsed.chord}]`;
}

/**
 * Is this leading chord token safe to read as a chord rather than as a word?
 *
 * `A` is a chord, and it is also a word in half the languages written in
 * Latin script. A rule that took every leading chord would quietly delete the
 * first word of lines like "A brand new day". Three things make it safe, any
 * one of them being enough:
 *
 * - the page wrote a BAR on it, and a bar is not a word in any language;
 * - the rest of the line is in another script entirely, where an English
 *   chord name cannot be a word at all;
 * - the page has already been shown to glue its chords AND the token is more
 *   than one character, which is exactly what tells `Bm7` from `A`.
 */
function checkIsChordNotAWord(parsed, after, isGlued) {
    return (
        parsed.bar !== '' ||
        !LATIN_PATTERN.test(after) ||
        (isGlued && parsed.chord.length > 1)
    );
}

/**
 * The chords a page glued to the front of a line, and the words after them.
 *
 * @returns {{marks: string, text: string, chords: number}} `marks` is what to
 *   write in front of the words -- bars and all -- and `chords` is how many
 *   chords went into it. The CALLER decides whether to use them, because a run
 *   of several chords before a single fragment tells you which chords are
 *   played and not where any of them lands, and a chord written over the wrong
 *   syllable is worse than a chord left off: a musician reads it and plays the
 *   change in the wrong place. The count has to cross line boundaries to be
 *   worth anything -- a fretboard chart is four chord lines in a row -- which
 *   is why it is not applied here.
 */
export function splitLeadingChords(line, isGlued = false) {
    let rest = String(line ?? '');
    let marks = '';
    let chords = 0;
    for (;;) {
        const match = /^\s*(\S+)\s*/.exec(rest);
        if (match === null) {
            break;
        }
        const parsed = readChordToken(match[1]);
        if (parsed === null) {
            break;
        }
        const after = rest.slice(match[0].length);
        if (
            parsed.chord !== '' &&
            !checkIsChordNotAWord(parsed, after, isGlued)
        ) {
            break;
        }
        marks += toChordMark(parsed);
        chords += parsed.chord === '' ? 0 : 1;
        rest = after;
    }
    return { marks, text: rest, chords };
}

/**
 * The chords a page glued INSIDE a row of words, written where they land.
 *
 * `splitLeadingChords` takes the chords off the FRONT of a fragment, and on a
 * page that hands its rows over one fragment per line that is every chord
 * there is. A page that hands over the whole row at once -- `|D word |D word
 * A7 word |D word` -- has its chords in the middle of the text, and each one
 * was riding into the song as a word somebody sings, with only the first of
 * the row in brackets. The same three tests decide whether a token is a chord
 * (a bar on it, another script around it, or a glued page and a name longer
 * than one letter), and the same rule holds for a run: ONE chord in front of
 * a word is written there, several say which chords are played and not where,
 * and are left out. A bar without a chord goes through as it is.
 *
 * The chord is glued to the word after it, because an annotation names the
 * syllable it sits immediately before (schema.md §3); the space BEFORE it is
 * the page's own word break and stays.
 */
export function writeInlineChords(line, isGlued = false) {
    let out = '';
    let rest = String(line ?? '');
    // The script test is made against the WORDS of the row, not against
    // whatever follows the token: the chords glued later in the same row are
    // Latin letters too, and `A7` in the middle of a Khmer line was refused
    // as a word because a `|D` three words on made the rest "Latin".
    const words = rest
        .split(/\s+/)
        .filter((token) => {
            return token !== '' && readChordToken(token) === null;
        })
        .join(' ');
    let run = { marks: '', chords: 0 };
    const flushRun = () => {
        if (run.chords <= 1) {
            out += run.marks;
        }
        run = { marks: '', chords: 0 };
    };
    for (;;) {
        const match = /^(\s*)(\S+)(\s*)/.exec(rest);
        if (match === null) {
            out += rest;
            break;
        }
        const [whole, before, token, after] = match;
        const following = rest.slice(whole.length);
        const parsed = readChordToken(token);
        const isChord =
            parsed !== null &&
            parsed.chord !== '' &&
            checkIsChordNotAWord(parsed, words, isGlued);
        if (!isChord) {
            flushRun();
            out += whole;
            rest = following;
            continue;
        }
        if (run.marks === '') {
            out += before;
        }
        run.marks += toChordMark(parsed);
        run.chords += 1;
        if (following === '') {
            // The row ends on the chord: keep the page's own trailing space.
            run.marks += after;
        }
        rest = following;
    }
    flushRun();
    return out;
}

/**
 * Does this page glue its chords onto the front of the words?
 *
 * Asked once per region, and only ever to RELAX the rule above: a bar-glued
 * chord is unambiguous, so a couple of them are proof of the page's habit,
 * and on a page with that habit a bare `Bm7` in front of the words is one too.
 */
export function checkIsGluedPage(lines) {
    let seen = 0;
    for (const line of lines) {
        const first = String(line ?? '').trim().split(/\s+/)[0] ?? '';
        const parsed = readChordToken(first);
        if (parsed !== null && parsed.bar !== '' && parsed.chord !== '') {
            seen += 1;
            if (seen >= GLUED_PAGE_EVIDENCE) {
                return true;
            }
        }
    }
    return false;
}

/**
 * What a line IS, for the purposes of finding the song.
 *
 * `word` is the only kind that can be a lyric. Everything else is either
 * structure (`bar`, `chord`) or page furniture, and the difference between
 * those two is what tells the song apart from the fretboard chart under it.
 */
export function classifyLine(line) {
    // A fretboard chart writes its chords with the TYPOGRAPHIC sharp and flat,
    // `C♯m` rather than `C#m`, and open-lyric's chord pattern knows only the
    // ASCII ones. So every name on the chart read as an ordinary word, each
    // one resetting the wordless run that is supposed to mark the end of the
    // song -- and one page's draft ran on through the chart, the comment box
    // and the footer to finish with twenty-five verses.
    const trimmed = String(line ?? '')
        .replace(/♯/g, '#')
        .replace(/♭/g, 'b')
        .trim();
    if (trimmed === '') {
        return 'blank';
    }
    if (ICON_WORD_PATTERN.test(trimmed)) {
        return 'icon';
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const parsedList = tokens.map(readChordToken);
    const bars = parsedList.filter((one) => {
        return one !== null && one.chord === '';
    }).length;
    const chords = parsedList.filter((one) => {
        return one !== null && one.chord !== '';
    }).length;
    const skippable = tokens.filter((one) => {
        return REPEAT_PATTERN.test(one) || FRET_PATTERN.test(one) || one === 'X';
    }).length;
    if (bars + chords + skippable === tokens.length) {
        if (chords > 0) {
            return 'chord';
        }
        if (bars > 0) {
            return 'bar';
        }
        return 'junk';
    }
    if (!LETTER_PATTERN.test(trimmed)) {
        // Digits, arrows, ampersands: a strumming pattern, drawn one cell to a
        // line.
        return 'junk';
    }
    // A lone letter is a strumming hand (`p`, `i`, `m`, `a`) or a chart's
    // fingering, never a word.
    //
    // It used to be "shorter than four characters", and that was a rule about
    // ENGLISH written into a reader whose whole job is other people's
    // languages. A Khmer syllable under a chord is two or three characters, so
    // every second fragment of a Khmer song was thrown away as furniture --
    // and worse, counted as a wordless line, which split the song's own region
    // in half and lost the verses on the far side of the split.
    if (/^[\p{L}]$/u.test(trimmed) || /^[Xx]$/.test(trimmed)) {
        return 'junk';
    }
    return 'word';
}

/**
 * Is this text something read off a page, rather than something a person
 * typed or pasted?
 *
 * Three independent tells, any one of which is enough, and none of which an
 * ordinary paste of lyrics produces. This is the gate on every rule in this
 * file: get it wrong in the false-positive direction and a plain song gets
 * carved up; get it wrong the other way and a page stays confetti. It is
 * deliberately the cautious side of that trade.
 */
export function checkIsPageText(lines) {
    let icons = 0;
    let bars = 0;
    for (const line of lines) {
        const kind = classifyLine(line);
        if (kind === 'icon') {
            icons += 1;
        } else if (kind === 'bar') {
            bars += 1;
        }
        if (icons >= 2 || bars >= 3) {
            return true;
        }
        if (/\S\s*[·|]\s*(?:key|tempo|time)\s*:/i.test(line)) {
            // `Key: E · Time: 4/4 · Tempo: 70bpm` -- a metadata strip, which is
            // a page's way of saying it knows what it is showing.
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// What the page says about the song
// ---------------------------------------------------------------------------

const METADATA_FIELD_MAP = {
    key: 'Key',
    tempo: 'Tempo',
    time: 'Time',
    bpm: 'Tempo',
};

/**
 * The song's key, tempo and time, off the strip a chord page prints them in.
 *
 * They arrive `·`-separated on ONE line, which is why the drafter's own
 * line-at-a-time `Name: value` reader cannot have them: it would take
 * "D  ·  Time: 4/4  ·  Tempo: 73bpm" as the key and produce a song the editor
 * refuses over a field the page got right.
 */
/** The `Key: D · Time: 4/4 · Tempo: 73bpm` strip, which is not a lyric. */
export function checkIsMetadataStrip(line) {
    return /[·|]/.test(line) && /(?:key|tempo|time)\s*:/i.test(line);
}

export function readMetadataStrip(lines) {
    const found = {};
    for (const line of lines) {
        if (!checkIsMetadataStrip(line)) {
            continue;
        }
        for (const piece of line.split(/\s*[·|]\s*/)) {
            const matched = /^\s*([a-z]+)\s*:\s*(.+?)\s*$/i.exec(piece);
            if (matched === null) {
                continue;
            }
            const field = METADATA_FIELD_MAP[matched[1].toLowerCase()];
            // A trailing ligature glued to the last value -- the strip usually
            // ends at a control rather than at the end of the line.
            const value = stripIconPrefix(matched[2].split(/\s{2,}/)[0].trim());
            if (field !== undefined && found[field] === undefined && value) {
                found[field] = value;
            }
        }
        if (Object.keys(found).length > 0) {
            return found;
        }
    }
    return found;
}

/**
 * The title and who it is by, from the top of the page.
 *
 * A song page opens with its own heading and the artist under it, in that
 * order, before any control. Taken from the BODY rather than from the
 * document title, which is padded with the site's name and the word "chords"
 * -- and overridable by the caller, who can see the page and can simply say.
 */
export function readPageHeading(lines, checkIsLabel = () => false) {
    const found = {};
    const heading = [];
    // The heading is only a heading if the page put its CONTROLS under it. A
    // song's own first two lines are two lines of words as well, and taking
    // them as the title and the artist both invented a title and deleted the
    // opening of the song -- so the proof required is the toolbar, the chord,
    // the strumming diagram that a page has and a paste does not.
    let isFollowedByFurniture = false;
    for (const line of lines) {
        const kind = classifyLine(line);
        if (kind === 'blank') {
            continue;
        }
        const text = kind === 'word' ? stripIconPrefix(line.trim()) : '';
        if (text === '' || /[:·]/.test(text) || checkIsLabel(text)) {
            isFollowedByFurniture = true;
            break;
        }
        heading.push(text);
        // A THIRD line of plain words means this is not a heading at all: it
        // is a menu, or the song itself. A hymn-text site opens with a column
        // of links, and taking the first two of them gave a song called
        // "Home" by "Log in".
        if (heading.length > 2) {
            break;
        }
    }
    if (!isFollowedByFurniture || heading.length === 0 || heading.length > 2) {
        return found;
    }
    if (heading.length > 0 && heading[0].length <= 80) {
        found.Title = heading[0];
    }
    if (heading.length > 1 && heading[1].length <= 80) {
        found.Artist = heading[1];
    }
    return found;
}

// ---------------------------------------------------------------------------
// Finding the song on the page
// ---------------------------------------------------------------------------

/**
 * The page split at every long run of wordless lines.
 *
 * A strumming diagram and a fretboard chart are each a wall of single
 * characters, and they sit either side of the song on every chord page there
 * is. That makes them the most reliable boundary available -- more reliable
 * than any word, because words are the part that changes with the language.
 */
export function toRegions(lines) {
    const regions = [];
    let current = null;
    let junkRun = 0;
    // The chords that OPEN a song sit INSIDE the wall that ends the page's
    // furniture: a wall is only broken by a line of words, and the `|` and the
    // `D` over the first syllable are neither. So the region began one line
    // late and the song's very first chord -- the one that says where to start
    // -- was the only one missing from the whole document.
    let opener = [];
    lines.forEach((line, index) => {
        const kind = classifyLine(line);
        if (kind === 'word') {
            junkRun = 0;
        } else if (kind !== 'blank' && kind !== 'chord' && kind !== 'bar') {
            // Chords and bars are NEUTRAL here. They are the song's own
            // scaffolding -- a flattened verse is one third bar lines -- so
            // counting them towards the wall that ends the song makes a long
            // instrumental break end it instead.
            junkRun += 1;
        }
        if (junkRun >= JUNK_RUN_LENGTH) {
            current = null;
            if (kind === 'chord' || kind === 'bar') {
                // Only the run touching the words, and only a few of it: a
                // fretboard chart is chord lines too, and it is not an opening.
                opener = [...opener, { index, line }].slice(-MAX_OPENER_LINES);
            } else {
                opener = [];
            }
            return;
        }
        if (current === null) {
            current = {
                from: opener[0]?.index ?? index,
                to: index,
                lines: opener.map((one) => {
                    return one.line;
                }),
                words: 0,
                // Carried, never COUNTED. `pickLyricRegion` treats three
                // chords as proof a region is a song, and three opening
                // chords handed exactly that proof to the stats line under a
                // fretboard chart -- which then won on word count and was
                // drafted as the whole song.
                chords: 0,
            };
            regions.push(current);
        }
        opener = [];
        current.to = index;
        current.lines.push(line);
        if (kind === 'word') {
            current.words += 1;
        } else if (kind === 'chord' || kind === 'bar') {
            current.chords += 1;
        }
    });
    return regions;
}

/**
 * Is there enough of a line here for it to be a line of a song?
 *
 * The measure for a page with no chords on it, where the boundary between the
 * song and the site is not a fretboard chart but LENGTH: a navigation item is
 * one or two words, a sung line is five or ten. Nothing else separates them --
 * both are ordinary words, both are in the reader's language, and a menu has
 * as many entries as a hymn has lines.
 */
export function checkIsSubstantial(line) {
    if (classifyLine(line) !== 'word') {
        return false;
    }
    const trimmed = String(line).trim();
    return (
        trimmed.split(/\s+/).length >= 3 ||
        // A script that does not put spaces between its words has to be
        // measured by how much of it there is.
        (NON_LATIN_LETTER_PATTERN.test(trimmed) && trimmed.length >= 12)
    );
}

/**
 * The page split at every run of lines too short to be sung.
 *
 * The counterpart of `toRegions` for a page of hymn TEXTS. Blank lines cannot
 * be the boundary here, because on such a page they are what separates one
 * stanza from the next -- the thing the song is made of.
 */
export function toProseRegions(lines) {
    const regions = [];
    let current = null;
    let thinRun = 0;
    lines.forEach((line, index) => {
        if (checkIsSubstantial(line)) {
            thinRun = 0;
        } else if (String(line).trim() !== '') {
            thinRun += 1;
        }
        if (thinRun >= THIN_RUN_LENGTH) {
            current = null;
            return;
        }
        if (current === null) {
            current = { from: index, to: index, lines: [], words: 0, chords: 0 };
            regions.push(current);
        }
        current.to = index;
        current.lines.push(line);
        if (checkIsSubstantial(line)) {
            current.words += 1;
        }
    });
    return regions;
}

/** `1 ` at the head of a stanza's first line, as a hymn book prints it. */
const STANZA_NUMBER_PATTERN = /^\s*([1-9]\d?)[ .)\]]\s*\S/;

/** The page as blank-separated blocks, each with where it sits. */
function toBlocks(lines) {
    const blocks = [];
    let current = null;
    lines.forEach((line, index) => {
        if (String(line).trim() === '') {
            current = null;
            return;
        }
        if (current === null) {
            current = { from: index, to: index, lines: [] };
            blocks.push(current);
        }
        current.to = index;
        current.lines.push(line);
    });
    return blocks;
}

/**
 * The song on a page that prints its stanzas NUMBERED, the way a hymn book
 * does and the way every site that prints from one does: `1 Amazing grace…`,
 * a blank line, `2 'Twas grace…`.
 *
 * Measured 2026-09-08 on a hymnal site's text page handed over whole: the
 * length rule below took a region from the first mention of the first line
 * down to the "Text Information" table, ninety lines on, because a line like
 * "Printable scores: PDF, MusicXML" is four words and counts as sung. Sixteen
 * verses came out, and the six real ones were numbers 8 to 13 among
 * "Playable presentation: Lyrics only" and "Song available on My.Hymnary".
 * A run of consecutive numbers starting at 1 is the one thing on such a page
 * that nothing but the hymn has, so where it exists it is taken as the song
 * -- from the first numbered block to the last, plus any LABELLED block that
 * follows on directly (a refrain printed after the last stanza). Two numbers
 * at least: one stanza opening with a numeral is a coincidence.
 *
 * `null` where the page prints no such run, so the length rule keeps its
 * job on every other page.
 */
export function pickNumberedStanzas(lines, checkIsLabel = () => false) {
    const blocks = toBlocks(lines);
    let best = null;
    for (let start = 0; start < blocks.length; start += 1) {
        const first = STANZA_NUMBER_PATTERN.exec(
            toAsciiDigits(blocks[start].lines[0]),
        );
        if (first === null || Number(first[1]) !== 1) {
            continue;
        }
        let expected = 2;
        let end = start;
        for (let index = start + 1; index < blocks.length; index += 1) {
            const matched = STANZA_NUMBER_PATTERN.exec(
                toAsciiDigits(blocks[index].lines[0]),
            );
            if (matched === null) {
                // A refrain or chorus printed between two stanzas, under its
                // own label, is part of the hymn; a block of anything else
                // ends it.
                if (checkIsLabel(stripIconPrefix(blocks[index].lines[0]).trim())) {
                    continue;
                }
                break;
            }
            if (Number(matched[1]) !== expected) {
                break;
            }
            expected += 1;
            end = index;
        }
        if (expected < 3) {
            continue;
        }
        // A labelled block straight after the last stanza belongs to it.
        while (
            end + 1 < blocks.length &&
            checkIsLabel(stripIconPrefix(blocks[end + 1].lines[0]).trim())
        ) {
            end += 1;
        }
        const count = expected - 1;
        if (best === null || count > best.count) {
            best = { count, from: blocks[start].from, to: blocks[end].to };
        }
    }
    if (best === null) {
        return null;
    }
    const picked = lines.slice(best.from, best.to + 1);
    return {
        from: best.from,
        to: best.to,
        lines: picked,
        words: picked.filter(checkIsSubstantial).length,
        chords: 0,
    };
}

const PAGE_FIELD_MAP = {
    title: 'Title',
    author: 'Artist',
    artist: 'Artist',
    writer: 'Artist',
    words: 'Artist',
    copyright: 'Copyright',
    key: 'Key',
    tempo: 'Tempo',
    time: 'Time',
};

/**
 * The song's own facts, off the table a hymnal site prints them in --
 * `Title: …`, `Author: …`, `Copyright: Public Domain` -- which sits far below
 * the words, outside any region, and which the drafter's line reader
 * therefore never saw: a page that said "Public Domain" in plain sight came
 * out as `Copyright: Unknown`, and with no heading over the words, "Untitled".
 *
 * One line, one field, a colon, and a value that is words: `First Line:` is
 * not a field this knows, and `Copyright Policy` has no colon. The first of
 * each wins. Read on the whole page, so it is only consulted for a page with
 * no chords on it, where the heading reader has already been proven wrong.
 */
export function readPageFields(lines) {
    const found = {};
    for (const line of lines) {
        const matched = /^\s*([a-z]+)\s*:\s*(\S.*?)\s*$/i.exec(
            stripIconPrefix(String(line ?? '')),
        );
        if (matched === null) {
            continue;
        }
        const field = PAGE_FIELD_MAP[matched[1].toLowerCase()];
        if (field === undefined || found[field] !== undefined) {
            continue;
        }
        const value = matched[2].trim();
        if (value.length > 120 || /[|·]/.test(value)) {
            continue;
        }
        found[field] = value;
    }
    return found;
}

/**
 * Which region is the song.
 *
 * Chords first, words second, and that order is the whole trick: a footer full
 * of related songs, sign-in prompts and menu items has as many WORDS as a
 * verse does, and not one chord anywhere near them. Scoring on words alone
 * picked the footer on a page with a long enough one.
 *
 * A page with no chords at all -- a plain lyrics site -- falls through to the
 * word count, which is the best that is available there.
 */
export function pickLyricRegion(regions) {
    if (regions.length === 0) {
        return null;
    }
    const withChords = regions.filter((one) => {
        return one.chords >= 3;
    });
    const candidates = withChords.length > 0 ? withChords : regions;
    return candidates.reduce((best, one) => {
        return one.words > best.words ? one : best;
    });
}

// ---------------------------------------------------------------------------
// Putting the lines back together
// ---------------------------------------------------------------------------

/**
 * Cut the region a little after the last chord in it.
 *
 * The wordless-run boundary works because a fretboard chart sits between the
 * song and the footer. Not every page draws one -- and on those, the song ran
 * straight on through the view count, the comment box and the site's own menu,
 * finishing with twenty-five verses of which seven were links.
 *
 * On a chord sheet the last chord is where the song stops, by definition. What
 * follows it within a line or three is the last fragment and its translation;
 * anything past that is the page talking about itself.
 */
function trimAfterLastChord(lines, tail) {
    let last = -1;
    lines.forEach((line, index) => {
        const kind = classifyLine(line);
        if (kind === 'chord' || kind === 'bar') {
            last = index;
        }
    });
    return last === -1 ? lines : lines.slice(0, last + 1 + tail);
}

/**
 * A line that summarises the play order rather than being sung:
 * "Bridge 1 (6x) → Instr 1 (2x) → Chorus (4x)".
 *
 * Two repeat markers on one line is the tell. A sung line does not carry them.
 */
export function checkIsPlayOrderLine(line) {
    const markers = String(line).match(/\(\s*\d{1,2}\s*x\s*\)/gi) ?? [];
    if (markers.length < 2) {
        return false;
    }
    return /\b(?:verse|chorus|bridge|intro|outro|instr|tag|refrain|vamp|solo)\b/i.test(
        line,
    );
}

/**
 * Is this a line about who wrote the song rather than a line of the song?
 *
 * Only the shapes that are unmistakable: a year, an English credit opener, or
 * a short label followed by a colon of any script. Anything looser starts
 * eating last verses.
 */
export function checkIsCreditLine(line) {
    const text = String(line).trim();
    if (text === '' || text.length > 120) {
        return false;
    }
    if (/\b(?:19|20)\d{2}\b/.test(text)) {
        return true;
    }
    if (
        /^(?:words|music|lyrics?|composed|composer|arranged|arrangement|translation|translated|written|writer|author|by|copyright|source)\b/i.test(
            text,
        )
    ) {
        return true;
    }
    if (/\b(?:words|music|lyrics?|translation)\b[^:]{0,20}:/i.test(text)) {
        return true;
    }
    // `ទំនុកច្រៀងៈ សម សារិន` -- a short label, a colon of some script, a name.
    return /^\S{1,20}[:：៖ៈ]\s*\S/.test(text);
}

/**
 * The copyright line a page prints under the song, kept as the song's own
 * `Copyright` field.
 *
 * Worth carrying rather than dropping: the notice is the one part of a credit
 * that says who the song belongs to, and a file that has it is a file whose
 * next reader can see whose song it is. Open Lyric has a field for exactly
 * this and it was being filled in with "Unknown".
 */
function readCreditCopyright(line) {
    const text = String(line).trim();
    if (!/©|\(c\)\s*\d|copyright/i.test(text)) {
        return null;
    }
    const cleaned = text
        .replace(/^copyright[:\s]*/i, '')
        // A page footer prints the notice and then its own menu on the same
        // line -- `© 2026 Somebody | Terms of Service | Privacy Policy` -- and
        // only the first part of that is the notice.
        .split(/\s[|·•]\s/)[0]
        .trim();
    return cleaned === '' || cleaned.length > 120 ? null : cleaned;
}

/**
 * The copyright notice a page prints in its FOOTER, which is nowhere near the
 * song.
 *
 * `readCreditCopyright` reads the line under the words, and a lot of pages do
 * not have one -- they put the notice at the very bottom, outside the region
 * this file works so hard to isolate, so the song came out with `Unknown` on
 * a page that says whose it is in plain sight.
 *
 * Read from the BOTTOM up, and only a real notice: the SIGN, or `(c) 2026`.
 * The word on its own is a menu item (`Copyright Policy`), and taking that
 * would put the name of a link in the song's own field.
 */
export function readPageCopyright(lines) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const text = String(lines[index] ?? '').trim();
        if (!/©|\(c\)\s*(?:19|20)\d{2}/i.test(text)) {
            continue;
        }
        const found = readCreditCopyright(text);
        if (found !== null) {
            return found;
        }
    }
    return null;
}

/** Who a credit line names, when it names them in a way worth believing. */
function readCreditArtist(line) {
    const matched =
        /^(?:words\s+and\s+music|words|music|lyrics?|composed|composer|written|by)\b[^:]{0,20}:\s*(.+)$/i.exec(
            String(line).trim(),
        );
    const value = matched === null ? '' : matched[1].trim();
    return value === '' || value.length > 80 ? null : value;
}

/**
 * The fragments of one page row, joined back into the line that was sung.
 *
 * Joined with NOTHING between them, which looks wrong and is right: a chord
 * lands mid-word far more often than between words, and where it does land
 * between words the page's own spacing is still sitting on the end of the
 * fragment. Putting a space in would break every word a chord divides;
 * leaving it out breaks nothing, because the space that belongs there is
 * already there.
 */
/**
 * Is what has accumulated so far a translation of the row above it, and
 * nothing else?
 *
 * The same script test `markTranslations` makes, asked one step earlier so the
 * row can be CLOSED rather than merely labelled. It fires only where a page is
 * genuinely bilingual, which is the only place it could be right.
 */
function checkIsSoleTranslation(fragments, out) {
    if (fragments.length === 0) {
        return false;
    }
    const previous = out[out.length - 1]?.text ?? '';
    const text = fragments.join('');
    return (
        NON_LATIN_LETTER_PATTERN.test(previous) &&
        LATIN_PATTERN.test(text) &&
        !NON_LATIN_LETTER_PATTERN.test(text)
    );
}

function joinFragments(fragments) {
    return fragments.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Chord-sheet confetti back into lines.
 *
 * @returns {{text: string, hadChord: boolean}[]}
 */
export function rejoinChordSheet(lines, checkIsLabel = () => false) {
    const isGlued = checkIsGluedPage(lines);
    const out = [];
    let fragments = [];
    let sawSeparator = false;
    let hadChord = false;
    // A chord counts for the row it sits OVER, which is the row whose words
    // come after it. Crediting it to the row above instead made the heading of
    // the fretboard chart look like a sung line -- the chart's first chord was
    // the very next thing on the page -- and the tail sweep, which stops at
    // anything with a chord on it, then stopped there every time.
    let pendingChord = false;
    // What to write in front of the next fragment. A chord is not thrown away
    // any more: it is carried to the words it sits over and written there as
    // an annotation, which is the difference between a song a musician can
    // play from and the words on their own.
    let pendingMarks = '';
    let pendingChords = 0;
    const flush = () => {
        if (fragments.length === 0) {
            return;
        }
        const text = joinFragments(fragments);
        if (text !== '') {
            out.push({ text, hadChord });
        }
        fragments = [];
        hadChord = false;
        pendingChord = false;
        pendingMarks = '';
        pendingChords = 0;
    };
    for (const line of lines) {
        const kind = classifyLine(line);
        if (kind === 'blank') {
            flush();
            out.push({ text: '', hadChord: false });
            sawSeparator = false;
            continue;
        }
        if (kind === 'chord' || kind === 'bar') {
            // A translation is a whole row on its own -- the page draws it
            // under the line it translates, with no chords over it. Left open,
            // the next row's first fragment appended to it and a slide read
            // "I am singingដោយអំណរ": an English line and the Khmer line after
            // it, run together.
            if (checkIsSoleTranslation(fragments, out)) {
                flush();
            }
            sawSeparator = true;
            pendingChord = true;
            // Accumulated ACROSS lines, not overwritten by the last one. A
            // fretboard chart is four chord lines in a row, and taking the
            // last of them wrote `[G]` onto the licence line underneath the
            // chart -- a chord over words nobody sings.
            const chordLine = splitLeadingChords(line, isGlued);
            pendingMarks += chordLine.marks;
            pendingChords += chordLine.chords;
            continue;
        }
        const text = stripIconPrefix(line);
        // A section name is never part of a sung line, and a chord sitting
        // between it and the words below it made it one: "Intro:Verse
        // 1:ខ្ញុំមក…" -- one line, no labels found, and a whole hymn drafted
        // as a single verse. It has to break the run in both directions.
        //
        // Tested AFTER the chord test and never before it, because a hymn
        // book's verse number is a bare digit and so is a fingering, and
        // because `C` on a line of its own is a chord about a thousand times
        // more often than it is the word "Chorus" abbreviated.
        if (checkIsLabel(text)) {
            flush();
            out.push({ text: text.trim(), hadChord: false, isLabel: true });
            sawSeparator = true;
            continue;
        }
        if (kind === 'icon' || kind === 'junk') {
            // Furniture inside the song's own region: a control that sits
            // between two rows. It separates without being a chord.
            sawSeparator = true;
            continue;
        }
        // A chord glued to the FRONT of the words is the same separator a
        // chord on a line of its own is, and it has to act like one: without
        // this every fragment of the row is a bare word line following
        // another, so each one flushed and a single sung line came out as
        // four -- broken exactly where the page happened to put a chord.
        const split = splitLeadingChords(text, isGlued);
        if (split.text.trim() === '') {
            sawSeparator = true;
            pendingChord = pendingChord || split.chords > 0;
            pendingMarks += split.marks;
            pendingChords += split.chords;
            continue;
        }
        if (split.chords > 0) {
            if (checkIsSoleTranslation(fragments, out)) {
                flush();
            }
            sawSeparator = true;
            pendingChord = true;
        }
        if (!sawSeparator) {
            // Two rows of words with nothing between them: the page moved on.
            flush();
        }
        if (pendingChord) {
            hadChord = true;
        }
        // The line's own chord outranks one left pending by the line before
        // it: it is written on the same row as these words, which is better
        // evidence of where the change lands than anything above them.
        // One chord, and only one, gets written: from this line if it carried
        // one, otherwise from the lines above it. A bar travels with the chord
        // it belongs to and never on its own -- there is nothing to place it
        // against.
        const marks =
            split.chords === 1
                ? split.marks
                : pendingChords === 1
                  ? pendingMarks
                  : '';
        // A chord annotation sits IMMEDIATELY before the syllable it lands on
        // (schema.md §3), so the indent the page used to hang the words under
        // the chord line has to go. Left in, it became an interior space --
        // `[D] a lantern` -- and the chord no longer names a syllable.
        const words = writeInlineChords(split.text, isGlued);
        fragments.push(
            `${marks}${marks === '' ? words : words.replace(/^\s+/, '')}`,
        );
        pendingMarks = '';
        pendingChords = 0;
        sawSeparator = false;
    }
    flush();
    return out;
}

/**
 * Mark the lines that are a translation of the line above them.
 *
 * A bilingual song page prints the sung line and its meaning underneath, and
 * open-lyric has somewhere to put exactly that: an indented line under a lyric
 * line IS its translation (schema.md §2). So the pairing is not decoration --
 * it is the difference between a slide that shows a song in two languages and
 * one that shows twice as many lines as the song has.
 *
 * The test is script, not language: a line of Latin under a line that is not
 * Latin. That fires only where a page is genuinely bilingual, which is the
 * only place it could be right.
 */
export function markTranslations(rows) {
    let previous = null;
    return rows.map((row) => {
        if (row.text === '' || row.isLabel === true) {
            previous = null;
            return { ...row, isTranslation: false };
        }
        const isTranslation =
            previous !== null &&
            NON_LATIN_LETTER_PATTERN.test(previous) &&
            LATIN_PATTERN.test(row.text) &&
            !NON_LATIN_LETTER_PATTERN.test(row.text) &&
            // A licence line under the last line of a song is not a
            // translation of it, and marking it as one made the tail sweep --
            // which stops at translations, so as never to eat a real lyric --
            // stop on the first piece of furniture it met.
            !checkIsCreditLine(row.text) &&
            // Nor is anything printed UNDER a credit line a translation of
            // it. `Guitar chords`, the heading of the fretboard chart, was
            // pairing with the songwriter's name above it, and the pair of
            // them rode into the last verse as its closing couplet.
            !checkIsCreditLine(previous);
        previous = isTranslation ? previous : row.text;
        return { ...row, isTranslation };
    });
}

/**
 * Take the tail off the end: who wrote it, and whatever the page put after it.
 *
 * On a chord sheet every line that is SUNG has a chord over it. So the two
 * stops are exactly the two kinds of line that carry no chord and belong to
 * the song anyway -- a chorded line, and a translation of one -- and between
 * those stops a short chord-less line at the very bottom of the page is a
 * credit, a heading for the fretboard chart under it, or a play-order
 * summary. None of them are words anybody sings.
 *
 * Bounded at both ends: at most eight lines, each of at most five words, and
 * every one of them named in the report. A sweep that silently ate a verse
 * would be far worse than one that leaves a stray line to be deleted.
 */
function takeTrailingCredits(rows, isChordSheet) {
    const taken = [];
    let found = null;
    let copyright = null;
    // Never all of them. On a page with no chords there is no "this line is
    // sung" signal at all, and the loose rule below happily ate a two-line
    // song from the bottom up and answered with nothing.
    while (rows.length > 1 && taken.length < MAX_CREDIT_LINES) {
        const last = rows[rows.length - 1];
        if (last.text === '') {
            rows.pop();
            continue;
        }
        if (last.isTranslation || last.hadChord) {
            break;
        }
        // The loose rule is a CHORD SHEET rule: there, a line with no chord
        // over it is not sung, so a short one at the very bottom is furniture.
        // A page of hymn texts has no chords anywhere, and applying it there
        // means "short last line" -- which plenty of songs end on.
        const isShort =
            isChordSheet &&
            last.isLabel !== true &&
            last.text.length <= MAX_CREDIT_LENGTH &&
            last.text.split(/\s+/).length <= MAX_CREDIT_WORDS;
        if (
            !checkIsCreditLine(last.text) &&
            !checkIsPlayOrderLine(last.text) &&
            !isShort
        ) {
            break;
        }
        if (found === null) {
            found = readCreditArtist(last.text);
        }
        if (copyright === null) {
            copyright = readCreditCopyright(last.text);
        }
        taken.push(last.text);
        rows.pop();
    }
    return { credits: taken.reverse(), artist: found, copyright };
}

function toExcerpt(text) {
    const trimmed = String(text ?? '').trim();
    return trimmed.length > EXCERPT_LENGTH
        ? `${trimmed.slice(0, EXCERPT_LENGTH - 1)}…`
        : trimmed;
}

/** The lines between the two markers the caller named, inclusive. */
function sliceByMarkers(lines, from, to) {
    const find = (marker, fromEnd) => {
        const needle = String(marker ?? '').trim().toLowerCase();
        if (needle === '') {
            return -1;
        }
        const at = lines.findIndex((line) => {
            return line.toLowerCase().includes(needle);
        });
        if (!fromEnd) {
            return at;
        }
        for (let index = lines.length - 1; index >= 0; index -= 1) {
            if (lines[index].toLowerCase().includes(needle)) {
                return index;
            }
        }
        return -1;
    };
    const start = find(from, false);
    const end = find(to, true);
    if (start === -1 && end === -1) {
        return null;
    }
    return lines.slice(
        start === -1 ? 0 : start,
        end === -1 || end < start ? undefined : end + 1,
    );
}

/**
 * A page of chords in, the song's own lines out.
 *
 * @param {string[]} rawLines The text as it arrived, trailing spaces INTACT --
 *   a fragment's trailing space is the only evidence left that a chord landed
 *   between two words rather than inside one.
 * @param {{from?: string, to?: string, checkIsLabel?: (line: string) => boolean}}
 *   [markers] What the caller could see and this cannot: where the song starts
 *   and ends on the page, and which lines name a section. The label test is
 *   passed IN rather than written here so the one that decides what a section
 *   is stays in one place -- and so this module never has to import the module
 *   that imports it.
 * @returns {{lines: string[], found: object, notes: object}}
 */
export function readLyricPage(rawLines, markers = {}) {
    const lines = rawLines.map((line) => {
        return String(line ?? '').replace(/\t/g, ' ');
    });
    if (markers.isFromPage !== true && !checkIsPageText(lines)) {
        // Not a page -- but a caller who said where the song starts and ends
        // is believed here too. Measured 2026-09-08: a model that had read a
        // page handed over its OWN copy of the words with the site's title
        // line and "Tune: NEW BRITAIN" on top, and said `from`/`to` around
        // the stanzas; the markers were only ever read on the page path, so
        // the three header lines became Verse 1 and the model spent a round
        // drafting again.
        const marked = sliceByMarkers(lines, markers.from, markers.to);
        return marked === null
            ? { lines, found: {}, notes: { isPage: false } }
            : {
                  lines: marked,
                  found: {},
                  notes: { isPage: false, isMarked: true },
              };
    }
    // Two page shapes, and they are not variations of one thing. A chord site
    // serves a song laid out in columns, surrounded by charts; a hymn-text
    // site serves whole lines in stanzas, surrounded by a menu. What separates
    // the song from the site is a wall of single characters on the first and
    // sheer line LENGTH on the second, so each gets its own reader rather than
    // one reader with a flag.
    const isChordSheet =
        lines.filter((line) => {
            const kind = classifyLine(line);
            return kind === 'chord' || kind === 'bar';
        }).length >= 3;
    const pageCopyright = readPageCopyright(lines);
    const found = {
        ...readPageHeading(lines, markers.checkIsLabel),
        ...readMetadataStrip(lines),
        // The footer's notice, which the region-tail sweep below overrides
        // when the page also prints one next to the words -- that one is
        // about the SONG, this one is about the site.
        ...(pageCopyright === null ? {} : { Copyright: pageCopyright }),
        // A hymnal site's own table of facts about the song, last because
        // a field the page LABELS beats one inferred from where a line sits
        // -- and only on the page shape that prints one.
        ...(isChordSheet ? {} : readPageFields(lines)),
    };
    const chosen =
        sliceByMarkers(lines, markers.from, markers.to) ??
        (isChordSheet
            ? null
            : pickNumberedStanzas(lines, markers.checkIsLabel)
        )?.lines ??
        pickLyricRegion(isChordSheet ? toRegions(lines) : toProseRegions(lines))
            ?.lines ??
        [];
    if (chosen.length === 0) {
        return { lines, found, notes: { isPage: true, isRegionFound: false } };
    }
    // A line already READ as the title, the artist or the key is not also a
    // line of the song. It only survives on a page that puts no wall of
    // controls between its heading and its words -- and there it arrives as
    // the first thing sung, which is the first thing anybody would see.
    const consumed = new Set(
        [found.Title, found.Artist]
            .filter(Boolean)
            .map((one) => {
                return one.trim();
            }),
    );
    const kept = (isChordSheet ? trimAfterLastChord(chosen, 3) : chosen).filter(
        (line) => {
            const trimmed = stripIconPrefix(line).trim();
            return (
                !checkIsPlayOrderLine(line) &&
                !consumed.has(trimmed) &&
                !checkIsMetadataStrip(trimmed)
            );
        },
    );
    const rows = markTranslations(
        rejoinChordSheet(kept, markers.checkIsLabel),
    );
    // A label with nothing under it labels nothing. They turn up at the bottom
    // because a fretboard chart's fingering numbers read as verse numbers, and
    // while an empty section is harmless in the song, it makes the report say
    // the words were taken from somewhere ending in "2".
    while (
        rows.length > 0 &&
        (rows[rows.length - 1].isLabel === true ||
            rows[rows.length - 1].text === '')
    ) {
        rows.pop();
    }
    const {
        credits,
        artist,
        copyright,
    } = takeTrailingCredits(rows, isChordSheet);
    if (copyright !== null) {
        found.Copyright = copyright;
    }
    // Only when the page's own heading named nobody. "Words and music by"
    // names the SONGWRITERS, and the heading names the band or the hymnal the
    // song is filed under -- which is what a volunteer looking through their
    // own song list is going to recognise.
    if (artist !== null && !found.Artist) {
        found.Artist = artist;
    }
    const out = rows.map((row) => {
        return row.text === ''
            ? ''
            : `${row.isTranslation ? '\t' : ''}${row.text}`;
    });
    return {
        lines: out,
        found,
        notes: {
            isPage: true,
            isRegionFound: true,
            isMarked: markers.from !== undefined || markers.to !== undefined,
            droppedLines: lines.length - kept.length,
            translations: rows.filter((one) => {
                return one.isTranslation;
            }).length,
            credits,
            firstLine: toExcerpt(
                rows.find((one) => {
                    return one.text !== '';
                })?.text ?? '',
            ),
            lastLine: toExcerpt(rows[rows.length - 1]?.text ?? ''),
        },
    };
}
