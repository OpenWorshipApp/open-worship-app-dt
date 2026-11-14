import { describe, expect, it } from 'vitest';

import { toNoteFromStudy, toStudyArgsFromNote } from './studyFileChatHelpers';

describe('a study as a note and back, the rest (UT-102)', () => {
    const raw = {
        ref: 'Matthew 3:3-7',
        title: 'The Voice',
        content: 'John came preaching [^Matthew 3:1].',
        bible: null,
    };

    it('makes no note of a draft with no title or no passage', () => {
        expect(
            toNoteFromStudy({
                isChange: false,
                raw: { ...raw, title: '  ' },
                bible: 'KJV',
            }),
        ).toBe(null);
        expect(
            toNoteFromStudy({
                isChange: false,
                raw: { ...raw, ref: ' ' },
                bible: 'KJV',
            }),
        ).toBe(null);
        // Both given, it is a note.
        expect(
            toNoteFromStudy({ isChange: false, raw, bible: 'KJV' }),
        ).toMatchObject({ title: 'The Voice' });
    });

    it('cuts a title of long words at the last word that fits a file name', () => {
        const words = [
            'Incomprehensibilities',
            'Counterrevolutionaries',
            'Uncharacteristically',
        ];
        expect(words.join(' ').length).toBeGreaterThan(60);
        expect(
            toStudyArgsFromNote({
                title: words.join(' '),
                text: '[^Ephesians 2:8]\n\nWords.',
            })?.title,
        ).toBe('Incomprehensibilities Counterrevolutionaries');
    });

    it('is null for a note whose title no file name can take, or whose passage is blank', () => {
        expect(
            toStudyArgsFromNote({
                title: 'x'.repeat(70),
                text: '[^Ephesians 2:8]\n\nWords.',
            }),
        ).toBe(null);
        expect(
            toStudyArgsFromNote({
                title: '### ???',
                text: '[^Ephesians 2:8]\n\nWords.',
            }),
        ).toBe(null);
        expect(
            toStudyArgsFromNote({
                title: 'Grace',
                text: 'Saved by grace [^ ] alone.',
            }),
        ).toBe(null);
    });
});
