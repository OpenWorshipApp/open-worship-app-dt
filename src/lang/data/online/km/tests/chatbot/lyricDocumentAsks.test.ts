import { describe, expect, test, vi } from 'vitest';

// The draft card's module loads the whole help window with it.
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/helpBotHelpers', () => {
    return { genLyricDraftAnswer: vi.fn() };
});

import { readLyricDocumentAsk } from '../../../../../../chatbot/lyricDocumentChatHelpers';

// 2026-11-10: a song asked to be made out of a document, in Khmer, is the
// window's own list of files -- from `lyricDocumentAsks` in this package's
// `assistant.json`. A how-to and an export stay the guide's.

describe('a song made from a document, asked in Khmer', () => {
    test('make a song from a PowerPoint, a file, slides', () => {
        expect(readLyricDocumentAsk('បង្កើតចម្រៀងពី PowerPoint')).toMatchObject({
            step: 'list',
            kinds: ['pptx'],
        });
        expect(
            readLyricDocumentAsk('សូមធ្វើទំនុកតម្កើងចេញពីឯកសារ PDF របស់ខ្ញុំ'),
        ).toMatchObject({ step: 'list', kinds: ['pdf'] });
        expect(readLyricDocumentAsk('បម្លែងស្លាយនេះទៅជាចម្រៀង')).toMatchObject({
            step: 'list',
        });
    });

    test('a how-to and an export are not', () => {
        for (const asked of [
            'តើបង្កើតចម្រៀងពី PowerPoint ដោយរបៀបណា?',
            'នាំចេញចម្រៀងទៅ PowerPoint',
            'បង្កើតចម្រៀងថ្មី',
        ]) {
            expect(readLyricDocumentAsk(asked)).toBeNull();
        }
    });
});
