import { beforeAll, describe, expect, test, vi } from 'vitest';

// The app as it ships (2026-11-04: _must not ship in the app, except
// english_): English alone, no other language installed. A question typed in
// a language that is not installed is not NAMED -- its `typed.json` comes
// with it -- but it is still answered in the language it was written in when
// the line says it is not English.
let detectTypedLanguage: (text: string) => string | null;
let pickReplyLanguage: (
    typed: string,
    options?: { appLangCode?: string; isPressed?: boolean },
) => string;
let otherCode: string;

beforeAll(async () => {
    vi.resetModules();
    const store = await import('../../../langFileStore');
    store.setLangFiles([], async () => {
        return null;
    });
    const helpers = await import('../../../../chatbot/chatLangHelpers');
    detectTypedLanguage = helpers.detectTypedLanguage;
    pickReplyLanguage = helpers.pickReplyLanguage;
    otherCode = helpers.OTHER_CHAT_LANG_CODE;
});

describe('a question typed with only English installed', () => {
    test.each([
        '¿Cómo puedo cambiar el tamaño de la letra en la Biblia?',
        'Como coloco um versículo da Bíblia na tela?',
        'Die Schrift ist zu klein. Wie mache ich sie größer?',
        'Làm sao để hiển thị câu Kinh Thánh lên màn hình?',
    ])(
        'in Latin letters English never writes is answered in itself: %s',
        (text) => {
            expect(detectTypedLanguage(text)).toBe(otherCode);
            expect(pickReplyLanguage(text, { appLangCode: 'en' })).toBe(
                otherCode,
            );
        },
    );

    test('in a script nobody here names is answered in itself', () => {
        expect(
            detectTypedLanguage('Как показать стих из Библии на экране?'),
        ).toBe(otherCode);
    });

    test('in English is English, accented name or not', () => {
        expect(
            detectTypedLanguage(
                'How do I make the words on the screen bigger?',
            ),
        ).toBe('en');
        expect(
            detectTypedLanguage('Where is the song called Noël in the list?'),
        ).toBe('en');
    });

    test('with nothing to tell it by goes to the app language', () => {
        // No English word and no letter English never writes: a doubt.
        expect(
            detectTypedLanguage('Hoe zet ik een bijbeltekst op het scherm?'),
        ).toBeNull();
        expect(
            pickReplyLanguage('Hoe zet ik een bijbeltekst op het scherm?', {
                appLangCode: 'en',
            }),
        ).toBe('en');
    });
});
