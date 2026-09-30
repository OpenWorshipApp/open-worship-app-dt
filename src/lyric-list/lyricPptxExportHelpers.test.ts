import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        exportAppDocumentsToPptx: vi.fn(),
    };
});

vi.mock('../ms-office/pptxExportHelpers', () => ({
    exportAppDocumentsToPptx: mocks.exportAppDocumentsToPptx,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import { exportLyricStagesToPptx } from './lyricPptxExportHelpers';

describe('lyricPptxExportHelpers', () => {
    beforeEach(() => {
        mocks.exportAppDocumentsToPptx.mockReset();
    });

    test('exports every visible lyric stage as a separately named deck', async () => {
        const stage0 = { fileSource: { name: 'Amazing Grace' } };
        const stage1 = { fileSource: { name: 'Amazing Grace' } };
        mocks.exportAppDocumentsToPptx.mockResolvedValue([
            '/downloads/Amazing Grace - Stage 0.pptx',
            '/downloads/Amazing Grace - Stage 1.pptx',
        ]);

        await expect(
            exportLyricStagesToPptx([
                [0, stage0 as never],
                [1, stage1 as never],
            ]),
        ).resolves.toHaveLength(2);
        expect(mocks.exportAppDocumentsToPptx).toHaveBeenCalledWith([
            {
                appDocument: stage0,
                name: 'Amazing Grace - Stage 0',
            },
            {
                appDocument: stage1,
                name: 'Amazing Grace - Stage 1',
            },
        ]);
    });
});
