// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import {
    finishPdfConversion,
    startPdfConversion,
    updatePdfConversion,
} from '../../helper/pdfConversionProgress';
import PdfConversionProgressComp from './PdfConversionProgressComp';

const filePath = '/docs/sermon.pdf';
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
    await act(async () => {
        finishPdfConversion(filePath);
        root.render(null);
    });
});

test('shows preparation, page count and percent while PDF conversion runs', async () => {
    await act(async () => {
        startPdfConversion(filePath);
        root.render(<PdfConversionProgressComp filePath={filePath} />);
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
        'Preparing PDF pages...',
    );
    expect(
        container
            .querySelector('[role="progressbar"]')
            ?.getAttribute('aria-valuenow'),
    ).toBeNull();

    await act(async () => {
        updatePdfConversion(filePath, 12, 25);
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
        '12 / 25 (48%)',
    );
    expect(
        container.querySelector<HTMLElement>('[role="progressbar"]')?.style
            .width,
    ).toBe('48%');

    await act(async () => {
        finishPdfConversion(filePath);
    });
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
});
