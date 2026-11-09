/**
 * An ANSWER quoted in the box, for a question about it.
 *
 * Asked for 2026-11-09 (the user, with **Copy** circled under three answers:
 * _right next to the copy icon add reply icon, click reply to mention it in
 * input text_; the story _as a user I want to be able to follow up a
 * section_). The reply arrow under an answer puts that answer -- or the part
 * of it selected first -- in the box as a `> ` quote under a line saying
 * what it is, and the person writes the follow-up under it. It is the frame
 * the box already uses for words selected in a note or a verse
 * (`selectionMentionHelpers.ts`): every model reads `> ` lines as words the
 * person points at, and no app question is offered over a quote
 * (`checkHasSelectionQuote`).
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import { tran } from './chatTranHelpers';

// What one quote may hold. A whole answer can be a chapter's explanation of
// several thousand characters; the quote rides in the question, and so on
// every round of the ask and in the history after it, where the answer
// itself already is. A section the person picked out fits.
export const MAX_ANSWER_QUOTE_CHARS = 800;

const ELLIPSIS = '…';

// Cut at a whole letter (a Khmer letter with its marks and subscripts is one
// cluster), and back to the last space when one is near the end, so a word
// is not broken in two.
function cutWords(text: string, maxChars: number) {
    let end = 0;
    const segmenter = new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
    });
    for (const { index, segment } of segmenter.segment(text)) {
        if (index + segment.length > maxChars) {
            break;
        }
        end = index + segment.length;
    }
    const cut = text.slice(0, end);
    const lastSpace = cut.search(/\s\S*$/);
    const kept = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
    return kept.trimEnd() + ELLIPSIS;
}

// The words, not their mark-up: an answer's own `# heading` marks and
// `**bold**` stars were noise in the box (seen live 2026-11-09 on a Khmer
// preaching lesson). A `- ` list mark stays: it is how the lines read.
function toPlainLine(line: string) {
    return line
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*/g, '')
        .trim();
}

/**
 * The quote for the box: `Replying to your answer:` (or, for words selected
 * in it, `Replying to this part of your answer:`) and the words as `> `
 * lines, mark-up and blank lines left out, cut to `MAX_ANSWER_QUOTE_CHARS`
 * with `…` where they stop. Null for no words.
 */
export function toAnswerQuoteText(
    answerText: string,
    selectedText: string | null,
) {
    const isPart = selectedText !== null && selectedText.trim().length > 0;
    const lineList = (isPart ? selectedText : answerText)
        .split(/\r?\n/)
        .map(toPlainLine)
        .filter((line) => {
            return line.length > 0;
        });
    if (lineList.length === 0) {
        return null;
    }
    const keptList: string[] = [];
    let count = 0;
    for (const line of lineList) {
        const room = MAX_ANSWER_QUOTE_CHARS - count;
        if (line.length > room) {
            if (room > 0) {
                keptList.push(cutWords(line, room));
            } else {
                const last = keptList.length - 1;
                keptList[last] = keptList[last] + ELLIPSIS;
            }
            break;
        }
        keptList.push(line);
        count += line.length;
    }
    const header = isPart
        ? tran('Replying to this part of your answer')
        : tran('Replying to your answer');
    return (
        `${header}:\n` +
        keptList
            .map((line) => {
                return `> ${line}`;
            })
            .join('\n')
    );
}
