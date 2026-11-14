import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    addTimelineBreakHints,
    removeTimelineBreakHints,
} from './mermaidTimelineBreakHelpers';

const MARK = '\u2060';
const ZERO_WIDTH_SPACE = '\u200B';

// A stand-in for a script written with no spaces between its words: every
// capital letter starts a word, as the browser's segmenter cuts such a
// script by its words.
const stubSegmenter = {
    segment(text: string) {
        return (text.match(/[A-Z][a-z]*|[a-z]+|\d+|[^A-Za-z\d]/g) ?? []).map(
            (segment) => {
                return { segment, isWordLike: /^[A-Za-z\d]/.test(segment) };
            },
        );
    },
};

/**
 * The lines mermaid 12's timeline `wrap` makes of a label: split at
 * whitespace, the parts joined by spaces, a line closed once it measures
 * wider than `width` -- measured here in characters, a run of spaces as one,
 * the way a picture's text collapses them.
 */
function wrapLikeMermaid(label: string, width: number) {
    const measure = (text: string) => {
        return text.replace(/ +/g, ' ').replace(new RegExp(MARK, 'g'), '')
            .length;
    };
    const lines: string[] = [];
    let line: string[] = [];
    for (const word of label.split(/(\s+|<br>)/)) {
        line.push(word);
        if (measure(line.join(' ').trim()) > width) {
            line.pop();
            lines.push(line.join(' ').trim());
            line = [word];
        }
    }
    lines.push(line.join(' ').trim());
    return lines;
}

describe('break hints for a mermaid timeline', () => {
    test('go between touching words of the labels a timeline wraps, and nowhere else', () => {
        const source = [
            '---',
            'title: FrontMatterTitle',
            '---',
            "%%{init: {'theme': 'base'}}%%",
            'timeline',
            '    title TitleWordsTouch',
            '    accTitle: AccessibleTitle',
            '    %% CommentWordsTouch',
            '    section SectionOneTwo',
            '    PeriodAlpha : EventOneTwo : spaced words stay',
            '',
        ].join('\n');

        const lines = addTimelineBreakHints(source, stubSegmenter).split('\n');

        expect(lines).toEqual([
            '---',
            'title: FrontMatterTitle',
            '---',
            "%%{init: {'theme': 'base'}}%%",
            'timeline',
            '    title TitleWordsTouch',
            '    accTitle: AccessibleTitle',
            '    %% CommentWordsTouch',
            `    section Section ${MARK}One ${MARK}Two`,
            `    Period ${MARK}Alpha : Event ${MARK}One ${MARK}Two : spaced words stay`,
            '',
        ]);
    });

    test('leave any other diagram, and a timeline with nothing to hint, as it is', () => {
        const flowchart = 'flowchart TD\n    OneTwo --> ThreeFour';
        const spaced = 'timeline\n    Then : spaced words only';

        expect(addTimelineBreakHints(flowchart, stubSegmenter)).toBe(flowchart);
        expect(addTimelineBreakHints(spaced, stubSegmenter)).toBe(spaced);
        expect(addTimelineBreakHints('', stubSegmenter)).toBe('');
    });

    test('leave a timeline that already holds the mark as it is: its own mark is never taken out', () => {
        const source = `timeline\n    OneTwo : Three${MARK}Four`;

        expect(addTimelineBreakHints(source, stubSegmenter)).toBe(source);
    });

    test('break between words a zero width space alone holds apart, and keep that space', () => {
        // The browser's own segmenter, with words it reads as two.
        const source = `timeline\n    Then : Alpha${ZERO_WIDTH_SPACE}Beta`;

        expect(addTimelineBreakHints(source)).toBe(
            `timeline\n    Then : Alpha${ZERO_WIDTH_SPACE} ${MARK}Beta`,
        );
    });

    test('let mermaid break a label of touching words inside its width, and come out of the picture as the label', () => {
        const label = 'OneTwoThreeFourFiveSixSeven';
        const width = 12;
        const hinted = addTimelineBreakHints(
            `timeline\n    Then : ${label}`,
            stubSegmenter,
        ).split(' : ')[1];

        // As written, one line wider than its box (under an empty one).
        expect(wrapLikeMermaid(label, width)).toEqual(['', label]);
        const lines = wrapLikeMermaid(hinted, width);
        expect(lines.length).toBeGreaterThan(1);
        const drawnLines = lines.map((line) => {
            return removeTimelineBreakHints(`<tspan>${line}</tspan>`).slice(
                '<tspan>'.length,
                -'</tspan>'.length,
            );
        });
        for (const line of drawnLines) {
            expect(line.length).toBeLessThanOrEqual(width);
        }
        expect(drawnLines.join('')).toBe(label);
    });

    test('take out only the hints, never a space the file holds', () => {
        expect(
            removeTimelineBreakHints(
                `<text><tspan>One   ${MARK}Two words</tspan><tspan>${MARK}Three</tspan></text>`,
            ),
        ).toBe('<text><tspan>OneTwo words</tspan><tspan>Three</tspan></text>');
    });

    test("mermaid's timeline still breaks a label at whitespace only, the reason these hints exist", () => {
        // A mermaid upgrade that wraps a timeline's labels some other way
        // fails here: then look again whether the hints are still needed.
        const chunkDir = path.join(
            process.cwd(),
            'node_modules/mermaid/dist/chunks/mermaid.core',
        );
        const timelineChunks = readdirSync(chunkDir).filter((name) => {
            return /^timeline-definition-.*\.mjs$/.test(name);
        });
        expect(timelineChunks).toHaveLength(1);
        const code = readFileSync(
            path.join(chunkDir, timelineChunks[0]),
            'utf8',
        );

        expect(code).toContain('text2.text().split(/(\\s+|<br>)/)');
        expect(code).toContain('tspan.text(line.join(" ").trim())');
    });
});
