/**
 * Bible words that the note editor would turn into a smiley (BN-70, BN-240).
 *
 * The `bible-note` package's EmojisPlugin replaces `:)`, `:D`, `:(` and `<3`
 * in every plain text node with an emoji node, and the app cannot switch it
 * off. The KJV closes forty of its asides with `:)` -- Luke 2:4's "(because
 * he was of the house and lineage of David:)" -- so every Christmas lesson
 * printed "David🙂", and both blind readers counted it against the lesson.
 *
 * A WORD JOINER (U+2060) between the two characters breaks the pattern: it
 * is invisible, never breaks a line, and the words read as the Bible writes
 * them. Only for Bible text the app writes into a note. A leaf: no imports.
 */

const WORD_JOINER = '⁠';
// The plugin's own keys, each two characters: the first of each, where the
// second follows it.
const EMOTICON_START_PATTERN = /:(?=[)D(])|<(?=3)/g;

export function toEmoticonSafeText(text: string) {
    return String(text ?? '').replace(EMOTICON_START_PATTERN, (mark) => {
        return `${mark}${WORD_JOINER}`;
    });
}
