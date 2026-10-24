// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
    getPdfPageText,
    setPdfTextRange,
    type PdfTextMapType,
} from './pdfTextRanges';

function makeMap(parts: string[]): PdfTextMapType {
    let start = 0;
    const runs = parts.map((text) => {
        const element = document.createElement('span');
        element.textContent = text;
        const run = { element, text, start };
        start += text.length;
        return run;
    });
    return { source: parts.join(''), runs };
}

describe('PDF text extraction and range listeners', () => {
    it('gets page text once and preserves the content for TextLayer', async () => {
        const content = {
            items: [
                { str: 'John' },
                { type: 'beginMarkedContent' },
                { str: '3:16', hasEOL: true },
                { str: 'Next line' },
            ],
            styles: { font1: { fontFamily: 'serif' } },
        };
        const page = { getTextContent: vi.fn().mockResolvedValue(content) };
        const result = await getPdfPageText(page);
        expect(page.getTextContent).toHaveBeenCalledTimes(1);
        expect(result.content).toBe(content);
        expect(result.text).toBe('John 3:16\nNext line ');
    });

    it('sets a title and native click/contextmenu listeners across fragmented spans', () => {
        const map = makeMap(['before Jo', 'hn 3:', '16 after']);
        const onClick = vi.fn();
        const onContextMenu = vi.fn((event: MouseEvent) =>
            event.preventDefault(),
        );
        const annotation = setPdfTextRange(map, 7, 16, {
            title: 'A Bible verse',
            onClick,
            onContextMenu,
        });
        expect(annotation.text).toBe('John 3:16');
        expect(
            annotation.elements.map((element) => element.textContent),
        ).toEqual(['Jo', 'hn 3:', '16']);
        expect(
            annotation.elements.every(
                (element) => element.title === 'A Bible verse',
            ),
        ).toBe(true);
        annotation.elements[2].click();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][1]).toEqual({
            start: 7,
            end: 16,
            text: 'John 3:16',
        });
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        expect(annotation.elements[0].dispatchEvent(event)).toBe(false);
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(map.runs.map((run) => run.element.textContent).join('')).toBe(
            map.source,
        );
        annotation.setTitle('Full verse text');
        expect(
            annotation.elements.every(
                (element) => element.title === 'Full verse text',
            ),
        ).toBe(true);
    });

    it('supports adjacent ranges, keyboard clicks and disposal without losing other listeners', () => {
        const map = makeMap(['abcdef']);
        const firstClick = vi.fn();
        const secondClick = vi.fn();
        const first = setPdfTextRange(map, 1, 3, {
            title: 'bc',
            onClick: firstClick,
        });
        const second = setPdfTextRange(map, 3, 5, {
            title: 'de',
            onClick: secondClick,
        });
        expect(() => setPdfTextRange(map, 2, 4, { title: 'overlap' })).toThrow(
            RangeError,
        );
        const oldElement = first.elements[0];
        oldElement.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(firstClick).toHaveBeenCalledTimes(1);
        first.dispose();
        first.dispose();
        oldElement.click();
        expect(firstClick).toHaveBeenCalledTimes(1);
        second.elements[0].click();
        expect(secondClick).toHaveBeenCalledTimes(1);
        expect(map.runs[0].element.textContent).toBe('abcdef');
        const replacement = setPdfTextRange(map, 1, 3, { title: 'bc again' });
        replacement.dispose();
        second.dispose();
        expect(
            map.runs[0].element.querySelector('[data-pdf-text-range]'),
        ).toBeNull();
        expect(map.runs[0].element.textContent).toBe('abcdef');
    });

    it('rejects invalid offsets and ranges joining distant blocks', () => {
        const map = makeMap(['John\0', '3:16']);
        for (const [start, end] of [
            [-1, 2],
            [0, 99],
            [2, 2],
            [0.5, 2],
            [0, 9],
        ]) {
            expect(() =>
                setPdfTextRange(map, start, end, { title: 'invalid' }),
            ).toThrow(RangeError);
        }
        expect(
            map.runs.every(
                (run) => !run.element.querySelector('[data-pdf-text-range]'),
            ),
        ).toBe(true);
    });

    it('treats PDF strings and titles as text, with UTF-16 offsets', () => {
        const map = makeMap(['😀<img src=x onerror=alert(1)>']);
        const annotation = setPdfTextRange(map, 2, map.source.length, {
            title: '<script>not markup</script>',
        });
        expect(annotation.text).toBe('<img src=x onerror=alert(1)>');
        expect(map.runs[0].element.querySelector('img')).toBeNull();
        expect(annotation.elements[0].title).toBe(
            '<script>not markup</script>',
        );
        annotation.dispose();
        expect(map.runs[0].element.textContent).toBe(map.source);
    });
});
