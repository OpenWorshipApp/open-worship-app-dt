import { getSetting } from '../helper/settingHelpers';

/**
 * Atom Mode for a song's slides: every LINE of a part is a slide of its own,
 * the way Long Text Show's Atom Mode makes every line a row (asked for
 * 2026-11-07 with Long Text's toggle and the song's Stage Previewer row in the
 * pictures). Blank lines are kept -- each is an empty slide, a pause -- and a
 * line stage 0 does not draw (a `// comment`, a line of chords alone) has no
 * slide of its own: on a stage that does draw it, it rides with the next line.
 *
 * ONE switch for every song and every stage, never per stage: a slide's id is
 * its place in the deck, and a screen on another `St:`, a Presenting Flow row
 * and the lyric editor's `?id=` all turn an id back into a slide. Every stage
 * has to split a song the same way for those to land on the same line, so the
 * number of lines a part has is read from the song's TEXT
 * (`getLyricAtomLineCounts`), which no stage option changes, and each stage
 * cuts its own markup into exactly that many pieces (`splitLyricPartHtml`).
 *
 * A LEAF, like `lyricStageStyleHelpers`: `LyricAppDocument` imports it, and
 * anything from `./` here would close the `lyricHelpers -> Stage ->
 * LyricAppDocument` cycle. `../helper/settingHelpers` is the only value import.
 */

/**
 * Unprefixed for the same reason as `lyric-stage-style-<n>`: the presenter,
 * the reader, the lyric editor and a screen must resolve one key, or a slide id
 * would mean another line in another window.
 */
export const LYRIC_ATOM_MODE_SETTING_NAME = 'lyric-slides-atom-mode';

export function getIsLyricAtomMode() {
    return getSetting(LYRIC_ATOM_MODE_SETTING_NAME) === 'true';
}

/**
 * A part's plain text as the lines Atom Mode makes slides of: inner blank
 * lines kept, those before the first line and after the last one not --
 * open-lyric's text reader drops those itself, and the markup carries them as
 * `&nbsp;` lines that `splitLyricPartHtml` drops to match.
 */
export function toLyricAtomLines(text: string) {
    const lines = text.split(/\r?\n/);
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim() === '') {
        start++;
    }
    while (end > start && lines[end - 1].trim() === '') {
        end--;
    }
    return lines.slice(start, end);
}

type LyricTextReaderType = {
    readonly value: string;
    getElementMap(options: {
        type: 'text';
        isWithInfo: boolean;
        isWithKeyNote: boolean;
        isShowingCommentText: boolean;
    }): Promise<Record<string, string>>;
};

// Per live `OpenLyric`, for the text it was asked about. A WeakMap: an entry
// goes with its instance, and a changed song (another `value`) is read again,
// so nothing here outlives the song or answers for an older text of it.
const lineCountsMap = new WeakMap<
    object,
    { value: string; promise: Promise<Record<string, number>> }
>();

async function readLyricAtomLineCounts(openLyric: LyricTextReaderType) {
    // Exactly what stage 0 draws: no chords (a line of chords alone is not
    // there at all), no comments. The text reader parses and lays nothing
    // out, so this is cheap enough for the per-render `getSlidesQuick`.
    const textMap = await openLyric.getElementMap({
        type: 'text',
        isWithInfo: false,
        isWithKeyNote: false,
        isShowingCommentText: false,
    });
    const counts: Record<string, number> = {};
    for (const [key, text] of Object.entries(textMap)) {
        counts[key] =
            typeof text === 'string' ? toLyricAtomLines(text).length : 0;
    }
    return counts;
}

/**
 * How many lines each part of the song has, by part name. A part with no
 * line (chords alone) or one line stays one slide: see `expandLyricAtomSteps`.
 */
export function getLyricAtomLineCounts(openLyric: LyricTextReaderType) {
    const value = openLyric.value;
    const cached = lineCountsMap.get(openLyric);
    if (cached !== undefined && cached.value === value) {
        return cached.promise;
    }
    const promise = readLyricAtomLineCounts(openLyric);
    lineCountsMap.set(openLyric, { value, promise });
    promise.catch(() => {
        // A failed read is not kept: the next call asks again.
        if (lineCountsMap.get(openLyric)?.promise === promise) {
            lineCountsMap.delete(openLyric);
        }
    });
    return promise;
}

const LINE_SELECTOR = '.ol-preview-line';
// Everything chord-like in a line: the chord buttons, the bars, and the chip
// that holds both above a lyric segment.
const CHORD_SELECTOR =
    '.ol-preview-chord, .ol-preview-bar, .ol-preview-lyric-segment__chord';
const COMMENT_LINE_CLASS = 'ol-preview-line--comment';
const PROGRESSION_LINE_CLASS = 'ol-preview-line--progression';
const LINE_MARK = 'ol-atom-line-';
const LINE_MARK_REGEX = new RegExp(`<!--${LINE_MARK}(\\d+)-->`);

type LineKindType = 'words' | 'blank' | 'extra';

/**
 * `words` and `blank` lines are the ones stage 0 draws, so each is a slide.
 * `extra` is what only a later stage draws -- a comment, a progression, a
 * line of chords with nothing sung under them -- which rides with a slide.
 * `trim()` takes the `&nbsp;` of a blank line too.
 */
function getLineKind(line: Element): LineKindType {
    if (
        line.classList.contains(COMMENT_LINE_CLASS) ||
        line.classList.contains(PROGRESSION_LINE_CLASS)
    ) {
        return 'extra';
    }
    if (line.querySelector(CHORD_SELECTOR) === null) {
        return (line.textContent ?? '').trim() === '' ? 'blank' : 'words';
    }
    const clone = line.cloneNode(true) as Element;
    clone.querySelectorAll(CHORD_SELECTOR).forEach((element) => {
        element.remove();
    });
    return (clone.textContent ?? '').trim() === '' ? 'extra' : 'words';
}

/**
 * Which slide each line of the part goes on, `-1` for none.
 *
 * Blank lines before the first slide line and after the last are on no slide
 * (the text the count comes from has none there). An `extra` line goes with
 * the NEXT slide line -- a comment or a chord line introduces what follows --
 * and the ones after the last slide line with the last. A stage with more
 * slide lines than `count` puts the rest on the last slide; one with fewer
 * leaves the last slides without lines. Either way there are `count` slides,
 * so no id moves.
 */
function genLineSlideIndexes(kinds: LineKindType[], count: number) {
    const rowIndexes: number[] = [];
    kinds.forEach((kind, i) => {
        if (kind !== 'extra') {
            rowIndexes.push(i);
        }
    });
    let start = 0;
    let end = rowIndexes.length;
    while (start < end && kinds[rowIndexes[start]] === 'blank') {
        start++;
    }
    while (end > start && kinds[rowIndexes[end - 1]] === 'blank') {
        end--;
    }
    const droppedSet = new Set([
        ...rowIndexes.slice(0, start),
        ...rowIndexes.slice(end),
    ]);
    const slideIndexes = kinds.map(() => -1);
    let pendingList: number[] = [];
    let rowCount = 0;
    kinds.forEach((kind, i) => {
        if (droppedSet.has(i)) {
            return;
        }
        if (kind === 'extra') {
            pendingList.push(i);
            return;
        }
        const slideIndex = Math.min(rowCount, count - 1);
        for (const pending of pendingList) {
            slideIndexes[pending] = slideIndex;
        }
        pendingList = [];
        slideIndexes[i] = slideIndex;
        rowCount++;
    });
    const lastSlideIndex = Math.max(0, Math.min(rowCount, count) - 1);
    for (const pending of pendingList) {
        slideIndexes[pending] = lastSlideIndex;
    }
    return slideIndexes;
}

/**
 * One part's markup, as rendered for a stage, cut into `count` slides of one
 * line each -- the rest of the part (its tile, its title, the lines' box and
 * every style open-lyric wrote inline) kept on each.
 *
 * Parsed ONCE, and never cloned per line: the markup carries every computed
 * style inline, so a part can be hundreds of kilobytes. Each line is swapped
 * for a marker, the shell serialized once, and every slide is that shell with
 * its own lines put back -- string joins, no DOM.
 *
 * Call it from async data code only, never inside a `renderToStaticMarkup`
 * (memory `static-render-must-not-parse-html`). A `<template>` is inert:
 * nothing in it loads or runs.
 */
export function splitLyricPartHtml(html: string, count: number): string[] {
    if (count < 2) {
        return [html];
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    const lineList = Array.from(
        template.content.querySelectorAll(LINE_SELECTOR),
    );
    const slideIndexes = genLineSlideIndexes(lineList.map(getLineKind), count);
    const lineHtmlList = lineList.map((line, i) => {
        const lineHtml = line.outerHTML;
        line.replaceWith(document.createComment(`${LINE_MARK}${i}`));
        return lineHtml;
    });
    // `split` with a capture group: text, line index, text, line index, ...
    const pieceList = template.innerHTML.split(LINE_MARK_REGEX);
    return Array.from({ length: count }, (_, slideIndex) => {
        return pieceList
            .map((piece, i) => {
                if (i % 2 === 0) {
                    return piece;
                }
                const lineIndex = Number.parseInt(piece, 10);
                return slideIndexes[lineIndex] === slideIndex
                    ? lineHtmlList[lineIndex]
                    : '';
            })
            .join('');
    });
}
