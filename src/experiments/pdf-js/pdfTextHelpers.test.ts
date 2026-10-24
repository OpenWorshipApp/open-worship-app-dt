// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { decoratePdfText, findBibleReferences } from './pdfTextHelpers';
import { setPdfTextRange } from './pdfTextRanges';

describe('study PDF references', () => {
    it('normalizes abbreviations, numbered books, spacing and verse ranges', () => {
        const text = 'Read Jn. 3 : 16–18; 1Cor 13:4-7; PSALMS\n23 : 1.';
        const matches = findBibleReferences(text);
        expect(matches.map((match) => match.reference)).toEqual([
            'John 3:16-18',
            '1 Corinthians 13:4-7',
            'Psalm 23:1',
        ]);
        expect(text.slice(matches[0].start, matches[0].end)).toBe(
            'Jn. 3 : 16–18',
        );
    });
    it('rejects invalid numbers, backwards ranges and embedded book names', () => {
        expect(
            findBibleReferences(
                'John 0:1; John 3:0; John 3:18-16; myJohn 3:16; 2026:10',
            ),
        ).toEqual([]);
    });
    it('detects multiple references in a single text run without swallowing prose', () => {
        const text = 'Compare John 3:16 with Genesis 1:1, then continue.';
        expect(
            findBibleReferences(text).map((match) =>
                text.slice(match.start, match.end),
            ),
        ).toEqual(['John 3:16', 'Genesis 1:1']);
    });
    it('uses native range listeners for references and shares the overlap registry', () => {
        const element = document.createElement('span');
        element.textContent = 'Read John 3:16 today.';
        const onClick = vi.fn();
        const onContextMenu = vi.fn();
        const result = decoratePdfText([element], { onClick, onContextMenu });
        const reference = element.querySelector<HTMLElement>(
            '[data-bible-reference]',
        )!;
        reference.click();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0].slice(1)).toEqual([
            { start: 5, end: 14, text: 'John 3:16' },
            'John 3:16',
        ]);
        reference.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true }),
        );
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        expect(() =>
            setPdfTextRange(result, 6, 10, { title: 'overlap' }),
        ).toThrow(RangeError);
        result.dispose();
        reference.click();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(element.textContent).toBe('Read John 3:16 today.');
    });
    it('connects fragmented nearby runs but keeps distant columns separate', () => {
        const createRun = (
            text: string,
            x: number,
            y: number,
            width: number,
        ) => {
            const element = document.createElement('span');
            element.textContent = text;
            vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
                x,
                y,
                left: x,
                top: y,
                width,
                height: 16,
                right: x + width,
                bottom: y + 16,
                toJSON: () => ({}),
            });
            return element;
        };
        const runs = [
            createRun('John', 0, 0, 35),
            createRun('3:', 39, 0, 15),
            createRun('16', 54, 0, 15),
        ];
        expect(runs.map((run) => run.getBoundingClientRect().left)).toEqual([
            0, 39, 54,
        ]);
        expect(findBibleReferences('John 3:16')).toHaveLength(1);
        const result = decoratePdfText(runs);
        expect(result.source).toBe('John 3:16');
        expect(result.matches).toHaveLength(1);
        expect(runs.map((run) => run.innerHTML)).toEqual([
            expect.stringContaining('data-bible-reference'),
            expect.stringContaining('data-bible-reference'),
            expect.stringContaining('data-bible-reference'),
        ]);
        expect(
            runs.map(
                (run) =>
                    run.querySelector<HTMLElement>('[data-bible-reference]')
                        ?.dataset.bibleReference,
            ),
        ).toEqual(['John 3:16', 'John 3:16', 'John 3:16']);
        expect(runs.map((run) => run.dataset.pdfText)).toEqual([
            'John',
            '3:',
            '16',
        ]);
        const distant = [
            createRun('John', 0, 0, 35),
            createRun('3:16', 300, 0, 40),
        ];
        decoratePdfText(distant);
        expect(
            distant.every(
                (run) => !run.querySelector('[data-bible-reference]'),
            ),
        ).toBe(true);
    });
});
