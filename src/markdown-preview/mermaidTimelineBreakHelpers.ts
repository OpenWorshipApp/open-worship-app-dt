/**
 * Break hints for a mermaid TIMELINE's labels.
 *
 * Mermaid wraps a timeline's labels itself and breaks a line at whitespace
 * only (the timeline's own `wrap`, mermaid 12), so a label in a script
 * written with no spaces between its words is one unbreakable word to it:
 * its box is sized for one line and the words run past it, under the next
 * column's box, on screen and on paper alike. The other diagrams this app
 * draws hold HTML labels the browser breaks between words, or break an
 * over-wide word themselves.
 *
 * So before a timeline is laid out, a hint -- a space and a WORD JOINER --
 * goes between two words the browser's word segmenter finds touching (or held
 * apart by a zero width space alone), mermaid's wrap may break the line
 * there, and the hints come out of the drawn picture again. Mermaid measures
 * a line WITH its hints' spaces, so a line can only come out narrower than
 * its box, never wider. The joiner marks a space as a hint's: a space the
 * file holds is never taken out.
 */

type WordSegmenterType = {
    segment(text: string): Iterable<{ segment: string; isWordLike?: boolean }>;
};

const HINT_MARK = '\u2060';
// Mermaid's wrap splits the label at the space; the mark starts the next word.
const BREAK_HINT = ` ${HINT_MARK}`;
// A hint as the drawn picture holds it: its space run into the spaces mermaid
// puts between a line's parts, or trimmed off a line's end, and the mark.
const DRAWN_HINT_PATTERN = new RegExp(` *${HINT_MARK}`, 'g');
const ZERO_WIDTH_SPACE_PATTERN = /^\u200B+$/;
// A line that is part of no diagram: its settings, a comment.
const SETTING_LINE_PATTERN = /^\s*(?:%%|$)/;
const FRONT_MATTER_FENCE_PATTERN = /^-{3}\s*$/;
const TIMELINE_KEYWORD_PATTERN = /^\s*timeline\b/;
// Lines a timeline draws without wrapping them: its title (mermaid reads any
// line starting `title ` as one) and what it holds for a screen reader.
const UNWRAPPED_LINE_PATTERN = /^\s*(?:title\s|acc(?:Title|Descr)\b)/;

/**
 * The index of the line naming `lines`' diagram type: the first after any
 * front matter that is not a comment, a setting or empty; -1 if none.
 */
function findKeywordLineIndex(lines: string[]) {
    let index = 0;
    while (index < lines.length && lines[index].trim() === '') {
        index += 1;
    }
    if (FRONT_MATTER_FENCE_PATTERN.test(lines[index] ?? '')) {
        index += 1;
        while (
            index < lines.length &&
            !FRONT_MATTER_FENCE_PATTERN.test(lines[index])
        ) {
            index += 1;
        }
        index += 1;
    }
    while (index < lines.length && SETTING_LINE_PATTERN.test(lines[index])) {
        index += 1;
    }
    return index < lines.length ? index : -1;
}

function hintLine(line: string, segmenter: WordSegmenterType) {
    let hinted = '';
    let isAfterWord = false;
    for (const { segment, isWordLike } of segmenter.segment(line)) {
        if (isWordLike && isAfterWord) {
            hinted += BREAK_HINT;
        }
        hinted += segment;
        // A zero width space between two words breaks a line in a browser,
        // never in mermaid: the words around it still touch.
        if (!ZERO_WIDTH_SPACE_PATTERN.test(segment)) {
            isAfterWord = isWordLike === true;
        }
    }
    return hinted;
}

/**
 * `source` with a break hint between every two touching words of the labels
 * it wraps, when it is a timeline; any other diagram -- and a timeline that
 * already holds the hint's mark, which `removeTimelineBreakHints` could not
 * tell from a hint -- as it is. `segmenter` is for a test; the browser's word
 * segmenter is made only for a timeline, and dropped with the call.
 */
export function addTimelineBreakHints(
    source: string,
    segmenter?: WordSegmenterType,
) {
    if (source.includes(HINT_MARK)) {
        return source;
    }
    const lines = source.split('\n');
    const keywordIndex = findKeywordLineIndex(lines);
    if (
        keywordIndex < 0 ||
        !TIMELINE_KEYWORD_PATTERN.test(lines[keywordIndex])
    ) {
        return source;
    }
    const wordSegmenter =
        segmenter ?? new Intl.Segmenter(undefined, { granularity: 'word' });
    let isHinted = false;
    for (let index = keywordIndex + 1; index < lines.length; index++) {
        const line = lines[index];
        if (
            SETTING_LINE_PATTERN.test(line) ||
            UNWRAPPED_LINE_PATTERN.test(line)
        ) {
            continue;
        }
        const hintedLine = hintLine(line, wordSegmenter);
        if (hintedLine !== line) {
            lines[index] = hintedLine;
            isHinted = true;
        }
    }
    return isHinted ? lines.join('\n') : source;
}

/** The picture drawn from `addTimelineBreakHints`' source, its hints out. */
export function removeTimelineBreakHints(svg: string) {
    return svg.replace(DRAWN_HINT_PATTERN, '');
}
