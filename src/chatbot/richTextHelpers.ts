// How an answer's line is cut into what is drawn bold, as code, in italics or
// as it is. Kept apart from `ChatbotAppComp` so the rule has a test.

// Underscore emphasis only where markdown itself means it: at a word's edge.
// Inside a word an underscore is part of a NAME -- the starter chip's own
// address read `amazing_grace_how_sweet_the_sound` and was drawn as *amazing*
// grace *how* sweet *the* sound in the user's own message (EC-39).
// A code span neither starts nor ends beside another backtick: a song's part
// opens on a line of THREE, and an answer saying so -- "a line of three
// backticks (```)" -- was drawn with a code span from the third to the next
// group's first, the backticks gone and the words between in code (the whole
// list asked in Khmer, 2026-10-18). Markdown's way to show backticks in code,
// two of them and a space on each side (`` ``` ``), is read too: the Khmer
// manual writes the fence so, and an answer copies it.
const RICH_TEXT_PART_PATTERN =
    /(\*\*[^*]+\*\*|(?<!`)`` [^\n]+? ``(?!`)|(?<!`)`[^`]+`(?!`)|(?<![\w/.-])_[^_\s][^_]*_(?![\w/.-]))/g;

// A manual paragraph can be wrapped in the source in the middle of bold words.
// The renderer draws one paragraph per source line, so pair the emphasis first
// and turn only the line breaks inside it into spaces. Everything else keeps its
// line and list structure, and the result still goes through React as text.
export function joinWrappedBoldText(content: string) {
    return content.replace(/\*\*[^*]+\*\*/g, (part) => {
        return part.replace(/\r?\n\s*/g, ' ');
    });
}

export function splitRichTextParts(content: string) {
    return content.split(RICH_TEXT_PART_PATTERN);
}

// A split part can also be plain text. A line containing only ``` is a
// fence, not a code span: stripping its first and last characters leaves a
// single backtick and makes an otherwise valid song example unusable.
export function checkIsCodeSpan(part: string) {
    return /^(?:`[^`]+`|`` [^\n]+? ``)$/.test(part);
}

// The words of a code part, without its backticks (and the space that pads a
// double-backtick span).
export function toCodeSpanText(part: string) {
    if (part.startsWith('`` ') && part.endsWith(' ``') && part.length > 6) {
        return part.slice(3, -3);
    }
    return part.slice(1, -1);
}
