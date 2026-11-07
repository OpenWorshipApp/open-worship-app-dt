import { afterEach, describe, expect, test } from 'vitest';

import {
    findChatBibleKeyByName,
    getChatBibleKeyList,
    getChatBibleKeyName,
    setChatTranslator,
    tran,
    tranLabel,
} from '../../../../../../chatbot/chatTranHelpers';

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe('the help window’s own words', () => {
    test('come from the translators the window plugs in', () => {
        const dictionary: Record<string, string> = {
            'new chat': 'ការសន្ទនាថ្មី',
        };
        setChatTranslator(
            (text) => {
                const value = dictionary[text.toLowerCase()];
                if (value === undefined) {
                    throw new Error(`no "${text}"`);
                }
                return value;
            },
            (text) => dictionary[text.toLowerCase()] ?? text,
        );
        expect(tran('New chat')).toBe('ការសន្ទនាថ្មី');
        expect(() => tran('Not a key')).toThrow('no "Not a key"');
        // A label that may not be one is never a reason to throw.
        expect(tranLabel('Not a key')).toBe('Not a key');
        expect(tranLabel('new chat')).toBe('ការសន្ទនាថ្មី');
    });
});

describe('a Bible short name', () => {
    test('is named by the language the BIBLE is in', () => {
        expect(getChatBibleKeyName('KJV', 'en-US')).toBe('King James Version');
        expect(getChatBibleKeyName('kjv', 'en-US')).toBe('King James Version');
        expect(getChatBibleKeyName('ពគប', 'km-KH')).toBe(
            'ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤',
        );
        // An imported file's own short name means nothing outside that file,
        // and a language the app holds no names for has none to give.
        expect(getChatBibleKeyName('KM2005', 'km-KH')).toBeNull();
        expect(getChatBibleKeyName('KJV', 'th-TH')).toBeNull();
    });

    test('lists the names of ONE language only', () => {
        expect(getChatBibleKeyList('km-KH')).toEqual([
            'ពគប',
            'គខប',
            'គកស១៦',
            'អគត',
            'GKHB',
            'KCB',
        ]);
        expect(getChatBibleKeyList('en-US')).toContain('KJV');
        expect(getChatBibleKeyList('th-TH')).toEqual([]);
    });

    test('is found from the edition name a downloaded file carries', () => {
        expect(
            findChatBibleKeyByName(
                'Khmer 2012 (Khmer Christian Bible)',
                'km-KH',
            ),
        ).toBe('KCB');
        expect(
            findChatBibleKeyByName('Khmer 2023 (ព្រះគម្ពីរខ្មែរសាកល)', 'km-KH'),
        ).toBe('GKHB');
        // The longest name that fits wins, so the New King James is not KJV.
        expect(findChatBibleKeyByName('New King James Version', 'en-US')).toBe(
            'NKJV',
        );
        // A file titled with its own short name names nothing, and a
        // language with no names cannot name anything.
        expect(findChatBibleKeyByName('English NKJV', 'en-US')).toBeNull();
        expect(
            findChatBibleKeyByName('Khmer Standard Version 1954', 'km-KH'),
        ).toBeNull();
        expect(
            findChatBibleKeyByName(
                'Khmer 2012 (Khmer Christian Bible)',
                'th-TH',
            ),
        ).toBeNull();
    });
});
