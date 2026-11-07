// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    finishPdfConversion,
    startPdfConversion,
    updatePdfConversion,
    usePdfConversionProgress,
} from './pdfConversionProgress';

// The store is module state shared by every test here, so each test converts
// a file of its own.

let renders: Array<string | null> = [];

function ProbeComp({ filePath }: Readonly<{ filePath: string | null }>) {
    const progress = usePdfConversionProgress(filePath);
    renders.push(filePath);
    if (progress === null) {
        return <span>none</span>;
    }
    return (
        <span>
            {progress.completed}/{progress.total ?? '?'}
        </span>
    );
}

describe('the conversion counters', () => {
    test('a second start of the same file joins the running one', () => {
        expect(startPdfConversion('/joined.pdf')).toBe(true);
        expect(startPdfConversion('/joined.pdf')).toBe(false);
        // The first finish only leaves; the conversion is still running.
        expect(finishPdfConversion('/joined.pdf')).toBe(false);
        expect(finishPdfConversion('/joined.pdf')).toBe(true);
        // Once all have left, the next start is a fresh one again.
        expect(startPdfConversion('/joined.pdf')).toBe(true);
        expect(finishPdfConversion('/joined.pdf')).toBe(true);
    });
});

describe('usePdfConversionProgress', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        renders = [];
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    test('follows a conversion from start to finish', () => {
        act(() => {
            root.render(<ProbeComp filePath="/sermon.pdf" />);
        });
        expect(container.textContent).toBe('none');

        act(() => {
            startPdfConversion('/sermon.pdf');
        });
        expect(container.textContent).toBe('0/?');

        act(() => {
            updatePdfConversion('/sermon.pdf', 3, 10);
        });
        expect(container.textContent).toBe('3/10');

        act(() => {
            finishPdfConversion('/sermon.pdf');
        });
        expect(container.textContent).toBe('none');
    });

    test('a count past either end is clamped into the page range', () => {
        startPdfConversion('/clamped.pdf');
        act(() => {
            root.render(<ProbeComp filePath="/clamped.pdf" />);
        });

        act(() => {
            updatePdfConversion('/clamped.pdf', 14, 12);
        });
        expect(container.textContent).toBe('12/12');

        act(() => {
            updatePdfConversion('/clamped.pdf', -2, 12);
        });
        expect(container.textContent).toBe('0/12');
        finishPdfConversion('/clamped.pdf');
    });

    test.each([
        ['a completed count that is not a number', Number.NaN, 10],
        ['an endless total', 2, Number.POSITIVE_INFINITY],
        ['a negative total', 2, -1],
    ])('%s is ignored', (_label, completed, total) => {
        startPdfConversion('/garbled.pdf');
        updatePdfConversion('/garbled.pdf', 1, 5);
        act(() => {
            root.render(<ProbeComp filePath="/garbled.pdf" />);
        });
        const rendersBefore = renders.length;

        act(() => {
            updatePdfConversion('/garbled.pdf', completed, total);
        });
        expect(container.textContent).toBe('1/5');
        expect(renders).toHaveLength(rendersBefore);
        finishPdfConversion('/garbled.pdf');
    });

    test('another file converting does not re-render this one', () => {
        act(() => {
            root.render(<ProbeComp filePath="/mine.pdf" />);
        });
        const rendersBefore = renders.length;

        act(() => {
            startPdfConversion('/theirs.pdf');
            updatePdfConversion('/theirs.pdf', 1, 2);
            finishPdfConversion('/theirs.pdf');
        });
        expect(renders).toHaveLength(rendersBefore);
        expect(container.textContent).toBe('none');
    });

    test('no file reads as no progress and listens to nothing', () => {
        act(() => {
            root.render(<ProbeComp filePath={null} />);
        });
        expect(container.textContent).toBe('none');
        const rendersBefore = renders.length;

        act(() => {
            startPdfConversion('/any.pdf');
            finishPdfConversion('/any.pdf');
        });
        expect(renders).toHaveLength(rendersBefore);
    });

    test('an unmounted reader stops being told about its file', () => {
        act(() => {
            root.render(<ProbeComp filePath="/left.pdf" />);
        });
        act(() => {
            root.render(<span>gone</span>);
        });
        const rendersBefore = renders.length;

        act(() => {
            startPdfConversion('/left.pdf');
        });
        expect(renders).toHaveLength(rendersBefore);
        expect(container.textContent).toBe('gone');
        finishPdfConversion('/left.pdf');
    });

    test('a static render never shows a conversion in flight', () => {
        startPdfConversion('/printed.pdf');
        updatePdfConversion('/printed.pdf', 4, 8);
        expect(
            renderToStaticMarkup(<ProbeComp filePath="/printed.pdf" />),
        ).toBe('<span>none</span>');
        finishPdfConversion('/printed.pdf');
    });
});
