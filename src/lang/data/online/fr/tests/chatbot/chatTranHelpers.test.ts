import { describe, expect, test } from 'vitest';

import {
    getChatBibleKeyList,
    getChatBibleKeyName,
} from '../../../../../../chatbot/chatTranHelpers';

describe('a Bible short name', () => {
    test('is named by the language the BIBLE is in', () => {
        expect(getChatBibleKeyName('LSG', 'fr-FR')).toBe(
            'La Sainte Bible, Louis Segond',
        );
    });

    test('lists the names of ONE language only', () => {
        expect(getChatBibleKeyList('fr-FR')).toEqual(['LSG']);
    });
});
