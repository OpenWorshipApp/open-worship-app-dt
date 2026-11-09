/**
 * Words selected in a Bible note, with WHERE they are, for the 🤖 on the
 * editor's selection bar (2026-11-08, the user: _should provide selection
 * range in the input text for enough context_): the words before and after
 * them in their line, and their first and last character in it when the
 * selection is one line. The help window quotes them in its box
 * (`selectionMentionHelpers.ts`).
 *
 * Read at the press from the selection's DOM range, which the editor hands
 * over with the click; types only from the hand-off, so nothing of the help
 * window comes with the note window.
 */
import type { BibleNoteTextSelection } from 'bible-note';

import type { SelectionMentionType } from '../../helper/ai/chatbotHandoffStoreHelpers';

// What the editor draws one line of a note as: a paragraph, a heading, a
// list item, a quote, a code block, a table cell.
const NOTE_LINE_SELECTOR =
    'p, h1, h2, h3, h4, h5, h6, li, blockquote, code, td, th';

function findLineElement(node: Node) {
    const element =
        node.nodeType === Node.ELEMENT_NODE
            ? (node as Element)
            : node.parentElement;
    return element?.closest(NOTE_LINE_SELECTOR) ?? null;
}

function readAround(line: Element, range: Range, side: 'before' | 'after') {
    const probe = document.createRange();
    probe.selectNodeContents(line);
    if (side === 'before') {
        probe.setEnd(range.startContainer, range.startOffset);
    } else {
        probe.setStart(range.endContainer, range.endOffset);
    }
    return probe.toString();
}

/**
 * The selection and its line, or its words alone when the editor gave no
 * range or the range is not in a line the editor draws.
 */
export function toNoteSelectionMention(
    selection: BibleNoteTextSelection,
): SelectionMentionType | string {
    const range = selection.domRange;
    if (range === null) {
        return selection.text;
    }
    try {
        const startLine = findLineElement(range.startContainer);
        const endLine = findLineElement(range.endContainer);
        if (startLine === null || endLine === null) {
            return selection.text;
        }
        const before = readAround(startLine, range, 'before');
        const after = readAround(endLine, range, 'after');
        const selected = range.toString();
        const words = selected.trim();
        // Counted on the screen's own text, the spaces a drag picked up at
        // either end left out.
        const isOneLine =
            startLine === endLine &&
            words.length > 0 &&
            !selection.text.includes('\n');
        const leading = selected.length - selected.trimStart().length;
        return {
            text: selection.text,
            before: before + selected.slice(0, leading),
            after: selected.slice(selected.trimEnd().length) + after,
            start: isOneLine ? before.length + leading + 1 : null,
            end: isOneLine ? before.length + leading + words.length : null,
        };
    } catch (_error) {
        // A range the note no longer matches: the words still go.
        return selection.text;
    }
}
