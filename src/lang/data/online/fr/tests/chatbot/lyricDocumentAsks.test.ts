import { describe, expect, test, vi } from 'vitest';

// The draft card's module loads the whole help window with it.
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/helpBotHelpers', () => {
    return { genLyricDraftAnswer: vi.fn() };
});

import { readLyricDocumentAsk } from '../../../../../../chatbot/lyricDocumentChatHelpers';

// 2026-11-10: a song asked to be made out of a document, in French, is the
// window's own list of files -- from `lyricDocumentAsks` in this package's
// `assistant.json`. A how-to and an export stay the guide's.

describe('a song made from a document, asked in French', () => {
    test('make a song from a PowerPoint, a PDF, a file', () => {
        expect(
            readLyricDocumentAsk('Fais un chant à partir de mon PowerPoint'),
        ).toMatchObject({ step: 'list', kinds: ['pptx'] });
        expect(
            readLyricDocumentAsk('Créer des paroles depuis ce fichier PDF'),
        ).toMatchObject({ step: 'list', kinds: ['pdf'] });
        expect(
            readLyricDocumentAsk('Transforme ce PDF en chant'),
        ).toMatchObject({ step: 'list', kinds: ['pdf'] });
    });

    test('a how-to and an export are not', () => {
        for (const asked of [
            'Comment faire un chant à partir de mon PowerPoint ?',
            'Exporter le chant en PowerPoint',
            'Créer un nouveau chant',
        ]) {
            expect(readLyricDocumentAsk(asked)).toBeNull();
        }
    });
});
