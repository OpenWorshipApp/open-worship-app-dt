import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    OTHER_CHAT_LANG_CODE,
    detectTypedLanguage,
} from '../../../../chatbot/chatLangHelpers';
import { checkHasLangPackage } from '../../../../test-setup/langPackageDirs';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('detectTypedLanguage', () => {
    // Any installed language a person may type is named (its `typed.json`,
    // 2026-11-03): Chinese was `other`, and answered with no chips.
    test.runIf(['zh', 'ja', 'es'].every(checkHasLangPackage))(
        'a language only typed is named, by its script or its words',
        () => {
            expect(detectTypedLanguage('如何显示圣经经文？')).toBe('zh');
            expect(detectTypedLanguage('如何顯示聖經經文？')).toBe('zh-Hant');
            expect(detectTypedLanguage('聖書の節を画面に表示するには？')).toBe(
                'ja',
            );
            expect(
                detectTypedLanguage(
                    '¿Cómo pongo un versículo de la Biblia en la pantalla?',
                ),
            ).toBe('es');
        },
    );

    test('a script no language here claims is `other`', () => {
        expect(detectTypedLanguage('ᎣᏏᏲ ᏙᎯᏧ ᎤᏁᎳᏅᎯ')).toBe(OTHER_CHAT_LANG_CODE);
    });
});
