/**
 * A song's `Note` sections — the ```` ```ol:Note ```` / ```` ```ol:Note 2 ````
 * fences — read out of its text for the Presenter's read-only note pane, the
 * song's counterpart of a slide document's Document Note and a PowerPoint's
 * slide notes (asked for 2026-11-13: _`Note *` is the special element that
 * should be render in slide note_).
 *
 * A LEAF with no imports. open-lyric parses the same fences, but its
 * `listOpenLyricFences` is exported from neither `open-lyric` nor
 * `open-lyric/internal`, and this runs on every update of the song, so the
 * three rules it needs are restated here from open-lyric's `schema.md`: a fence
 * opens with `^\s*```ol:(.*)$`, closes with `^\s*```\s*$`, and its header is
 * case-sensitive and exact — `Note`, or `Note` and a 1-based index.
 */

export type LyricNoteType = {
    // The fence's part name as the song writes it: `Note`, `Note 2`.
    partName: string;
    text: string;
};

const FENCE_OPEN_REGEX = /^\s*```ol:(.*)$/;
const FENCE_CLOSE_REGEX = /^\s*```\s*$/;
const NOTE_HEADER_REGEX = /^Note(?:\s+[1-9]\d*)?$/;

// The body as written, less the blank lines at its start and end.
function toNoteText(lines: string[]) {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim() === '') {
        start++;
    }
    while (end > start && lines[end - 1].trim() === '') {
        end--;
    }
    return lines.slice(start, end).join('\n');
}

/**
 * Every `Note` fence of the song, in the order it is written. A note with
 * nothing in it has nothing to read and is left out, and so is a fence the
 * file never closes — open-lyric does not count that one either.
 */
export function getLyricNoteList(markdown: string): LyricNoteType[] {
    const noteList: LyricNoteType[] = [];
    let isInFence = false;
    let notePartName: string | null = null;
    let noteLines: string[] = [];
    for (const line of markdown.split(/\r?\n/)) {
        if (!isInFence) {
            const match = FENCE_OPEN_REGEX.exec(line);
            if (match !== null) {
                isInFence = true;
                const info = match[1].trim();
                notePartName = NOTE_HEADER_REGEX.test(info) ? info : null;
                noteLines = [];
            }
            continue;
        }
        if (FENCE_CLOSE_REGEX.test(line)) {
            isInFence = false;
            if (notePartName !== null) {
                const text = toNoteText(noteLines);
                if (text !== '') {
                    noteList.push({ partName: notePartName, text });
                }
            }
            notePartName = null;
            continue;
        }
        if (notePartName !== null) {
            noteLines.push(line);
        }
    }
    return noteList;
}

export function checkIsSameLyricNoteList(
    noteList1: LyricNoteType[],
    noteList2: LyricNoteType[],
) {
    if (noteList1.length !== noteList2.length) {
        return false;
    }
    return noteList1.every((note, i) => {
        const otherNote = noteList2[i];
        return (
            note.partName === otherNote.partName && note.text === otherNote.text
        );
    });
}
