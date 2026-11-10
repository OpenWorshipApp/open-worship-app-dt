/**
 * The MARKDOWN half of a Quick Text preset (2026-11-09, the user: _for
 * quick-text should have the markdown format preset as well_). A preset's
 * look says where the box goes and how it is dressed; its format says how
 * the words inside it are set -- a speaker's name as a heading over their
 * role, a song's title in bold over its writer in italics.
 *
 * Every word is kept: only the marks change. The first line is the TITLE
 * and is given the format's title mark, whatever marks it had (so a press
 * twice is the same as once, and a Speaker after a Bible Verse is a heading
 * rather than a heading in bold); the lines after it are the BODY, left as
 * typed or, where the format says so, set in italics.
 *
 * No imports: the panel and the preset module both read it.
 */

/** What a new session's box holds before anybody types. */
export const QUICK_TEXT_DEFAULT_MARKDOWN =
    '## This is Title\n\ntext **bold** and *italic*.';

export type QuickTextFormatType = {
    title: 'bold' | 'h2' | 'h3';
    isBodyItalic: boolean;
};

const TITLE_MARK_MAP: Record<QuickTextFormatType['title'], string> = {
    bold: '**',
    h2: '## ',
    h3: '### ',
};

/** The words of a line with a heading mark or one pair of emphasis off. */
export function stripLineMarks(line: string) {
    let text = line.trim().replace(/^#{1,6}\s+/, '');
    const wrapped = /^(\*\*|__|\*|_)(.+)\1$/.exec(text);
    if (wrapped !== null && !/^[*_]|[*_]$/.test(wrapped[2])) {
        text = wrapped[2].trim();
    }
    return text;
}

function genTitleLine(words: string, title: QuickTextFormatType['title']) {
    const mark = TITLE_MARK_MAP[title];
    return title === 'bold' ? `${mark}${words}${mark}` : `${mark}${words}`;
}

/**
 * `text` set in `format`: its first line the title, the paragraphs after it
 * the body, one blank line between each. Empty text stays empty.
 */
export function formatQuickTextMarkdown(
    text: string,
    format: QuickTextFormatType,
) {
    const lineList = text.split(/\r?\n/);
    const titleIndex = lineList.findIndex((line) => {
        return line.trim() !== '';
    });
    if (titleIndex === -1) {
        return text;
    }
    const titleLine = genTitleLine(
        stripLineMarks(lineList[titleIndex]),
        format.title,
    );
    // Paragraphs, not lines: a line break inside one is a soft wrap in
    // markdown, so a body is kept as the blocks the blank lines make.
    const paragraphList: string[] = [];
    let current: string[] = [];
    for (const line of lineList.slice(titleIndex + 1)) {
        if (line.trim() === '') {
            if (current.length > 0) {
                paragraphList.push(current.join('\n'));
                current = [];
            }
            continue;
        }
        current.push(line.trimEnd());
    }
    if (current.length > 0) {
        paragraphList.push(current.join('\n'));
    }
    const bodyList = paragraphList.map((paragraph) => {
        if (!format.isBodyItalic) {
            // Upright again: a whole line in italics is what an italic
            // format left (a Sermon Title, then a Bible Verse). Bold and
            // emphasis INSIDE a line are the person's and stay.
            return paragraph
                .split('\n')
                .map((line) => {
                    const wrapped = /^\s*([*_])([^*_](?:.*[^*_])?)\1\s*$/.exec(
                        line,
                    );
                    return wrapped === null ? line : wrapped[2].trim();
                })
                .join('\n');
        }
        return paragraph
            .split('\n')
            .map((line) => {
                const words = stripLineMarks(line);
                // A line with emphasis of its own inside it is left as it
                // is: wrapped again it would nest one mark in another.
                if (words === '' || /[*_]/.test(words)) {
                    return line;
                }
                return `*${words}*`;
            })
            .join('\n');
    });
    return [titleLine, ...bodyList].join('\n\n');
}

/**
 * How much a passage can say before a Bible Verse look has to shrink: about
 * three verses, which the user set at 45px on a full-width band.
 */
const FIT_FULL_SIZE_CHARACTERS = 480;

/**
 * A font size that keeps a long passage a BAND at the bottom rather than a
 * wall over the slide: `base` up to about three verses' worth of words, then
 * smaller as the square root of the length (the box grows in two
 * directions as the type shrinks), never under `min`. Counted in what
 * shows: markdown marks left out and a run of spaces counted once.
 */
export function fitQuickTextFontSize(text: string, base: number, min: number) {
    const shownLength = Array.from(
        text
            .replaceAll(/[*_#>`\\]/g, '')
            .replaceAll(/\s+/g, ' ')
            .trim(),
    ).length;
    if (shownLength <= FIT_FULL_SIZE_CHARACTERS) {
        return base;
    }
    const fitted = base * Math.sqrt(FIT_FULL_SIZE_CHARACTERS / shownLength);
    return Math.max(min, Math.round(fitted));
}

export type QuickTextReadingPaceType = 'slow' | 'medium' | 'fast';

/** The Live box's reading button goes through them in this order. */
export const QUICK_TEXT_READING_PACE_LIST: readonly QuickTextReadingPaceType[] =
    ['slow', 'medium', 'fast'];

/** Words a minute, read aloud; a Bible Verse preset reads at `medium`. */
const READING_WORDS_PER_MINUTE_MAP: Readonly<
    Record<QuickTextReadingPaceType, number>
> = {
    slow: 110,
    medium: 150,
    fast: 200,
};
/** A moment to find the words before the reading, and to finish after it. */
const READING_LEAD_SECONDS = 5;
const READING_MIN_SECONDS = 10;
/** Rounded up to a step the Live box reads at a glance. */
const READING_STEP_SECONDS = 5;

/**
 * How long a passage stays up: long enough to be read aloud (2026-11-10,
 * the user: _create quick text from bible verse should re-calculate live
 * time base on text length_). Counted in WORDS, as the browser's word
 * segmenter cuts them, so a script written with no spaces between its words
 * is counted by its words and not as one, and a script of one letter a
 * syllable is not counted by its letters. A verse number is not read aloud
 * and does not count. `pace` is how fast it is read (the Live box's button,
 * the same day: _slow, medium, fast_).
 */
export function genQuickTextReadingSeconds(
    text: string,
    pace: QuickTextReadingPaceType = 'medium',
) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    let wordCount = 0;
    for (const { segment, isWordLike } of segmenter.segment(text)) {
        if (isWordLike && !/^\p{Nd}+$/u.test(segment)) {
            wordCount += 1;
        }
    }
    const seconds =
        READING_LEAD_SECONDS +
        (wordCount * 60) / READING_WORDS_PER_MINUTE_MAP[pace];
    return Math.max(
        READING_MIN_SECONDS,
        Math.ceil(seconds / READING_STEP_SECONDS) * READING_STEP_SECONDS,
    );
}

/** The pace the next press goes to: slow first, then medium, fast, slow. */
export function toNextQuickTextReadingPace(
    pace: QuickTextReadingPaceType | null,
) {
    const index =
        pace === null ? -1 : QUICK_TEXT_READING_PACE_LIST.indexOf(pace);
    return QUICK_TEXT_READING_PACE_LIST[
        (index + 1) % QUICK_TEXT_READING_PACE_LIST.length
    ];
}

/**
 * What a preset writes into a box with nothing of the person's in it yet --
 * empty, or still the sample a new session starts with (2026-11-09, the
 * user: _when the input is empty and preset clicked then use example, e.g.
 * (kjv) john 3:16 for bible example_). Words to type over, set the way the
 * preset sets them; the verse is the KJV's own.
 */
export const QUICK_TEXT_EXAMPLE_MAP: Readonly<Record<string, string>> = {
    'bible-verse':
        '(KJV) John 3:16\n\nFor God so loved the world, that he gave his ' +
        'only begotten Son, that whosoever believeth in him should not ' +
        'perish, but have everlasting life.',
    speaker: 'Pastor John Smith\n\nSenior Pastor, Grace Church',
    'song-title': 'Amazing Grace\n\nJohn Newton',
    'sermon-title': 'Walking in Faith\n\nHebrews 11:1-6',
    'event-session': 'Morning Session\n\nWorship and the Word',
    announcement: 'Welcome!\n\nPlease join us for lunch after the service.',
};

/** Nothing of the person's in the box: empty, or the untouched sample. */
export function checkIsQuickTextUntouched(text: string | null) {
    const trimmed = (text ?? '').trim();
    return trimmed === '' || trimmed === QUICK_TEXT_DEFAULT_MARKDOWN;
}
