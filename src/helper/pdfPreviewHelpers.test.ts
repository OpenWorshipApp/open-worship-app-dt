import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        pathToFileURL: vi.fn(),
        openPopupWindow: vi.fn(),
    },
}));

vi.mock('../server/calcHelpers', () => ({
    pathToFileURL: mocks.pathToFileURL,
}));
vi.mock('../server/fileHelpers', () => ({
    pathBasename: (filePath: string) => filePath.split(/[\\/]/).at(-1),
}));
vi.mock('./domHelpers', () => ({ openPopupWindow: mocks.openPopupWindow }));

import { openPdfPreview } from './pdfPreviewHelpers';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_750_000_000_000);
    mocks.pathToFileURL.mockImplementation((filePath: string) => {
        return `file:///${filePath.replaceAll('\\', '/')}`;
    });
    mocks.openPopupWindow.mockImplementation(() => ({ name: 'preview' }));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('openPdfPreview', () => {
    test('opens the file url in a popup that carries the file name', () => {
        const popup = openPdfPreview(String.raw`C:\docs\Sunday notes.pdf`);
        expect(popup).toEqual({ name: 'preview' });
        expect(mocks.openPopupWindow).toHaveBeenCalledExactlyOnceWith(
            'file:///C:/docs/Sunday notes.pdf',
            'pdf_preview-Sunday notes.pdf_1750000000000',
            'Sunday notes.pdf',
        );
    });

    test('two opens of one file share the id the main process focuses by', () => {
        openPdfPreview('/docs/order.pdf');
        vi.advanceTimersByTime(5);
        openPdfPreview('/docs/order.pdf');
        const [first, second] = mocks.openPopupWindow.mock.calls;
        expect(second[2]).toBe(first[2]);
        // ...while each press still names a frame of its own.
        expect([first[1], second[1]]).toEqual([
            'pdf_preview-order.pdf_1750000000000',
            'pdf_preview-order.pdf_1750000000005',
        ]);
    });
});
