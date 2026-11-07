import { describe, expect, it } from 'vitest';

import { genBiblesAnswer } from '../../../../../../chatbot/lookupStepHelpers';

const PASSAGE = {
    kind: 'verse' as const,
    target: 'GEN 4:1-26',
    title: 'Genesis 4:1-26',
    bibleKey: 'KJV',
    page: 'https://localhost:3000/reader.html',
};

function toLabels(actions: { label: string }[]) {
    return actions.map((action) => action.label);
}

describe('the lists a step answers with', () => {
    it('keeps the Bibles in a language the person named', () => {
        const listed = {
            bibles: [
                { key: 'KJV', title: 'King James Version' },
                { key: 'NIV', title: 'English NIV' },
                { key: 'BDS', title: 'French (BDS) 2015' },
            ],
        };
        expect(
            toLabels(genBiblesAnswer(PASSAGE, listed, 'fr').actions ?? []),
        ).toEqual(['BDS — French (BDS) 2015']);
    });
});
