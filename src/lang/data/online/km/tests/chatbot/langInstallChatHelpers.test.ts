import { describe, expect, it, vi } from 'vitest';

// The Khmer half of `src/chatbot/langInstallChatHelpers.test.ts`: a request
// to install a language typed in Khmer (`langInstallAsks` in this package's
// `assistant.json`). Asked so on 2026-11-05 it had gone to a model that
// wrote the steps out with no button to press.
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/mcpClient', () => {
    return {
        callTool: vi.fn(),
        parseToolJson: (text: string) => JSON.parse(text),
    };
});

import { readLangInstallAsk } from '../../../../../../chatbot/langInstallChatHelpers';

describe('a request to install a language, in Khmer', () => {
    it('is read with the name it gives', () => {
        expect(readLangInstallAsk('សូមដំឡើងភាសាអេស្ប៉ាញ')).toEqual({
            step: 'check',
            language: 'អេស្ប៉ាញ',
        });
        expect(readLangInstallAsk('ដំឡើងភាសាថៃផង')).toEqual({
            step: 'check',
            language: 'ថៃ',
        });
        expect(readLangInstallAsk('ខ្ញុំចង់ដំឡើងភាសាចិន')?.language).toBe(
            'ចិន',
        );
        expect(readLangInstallAsk('សូមបន្ថែមភាសាជប៉ុនឲ្យខ្ញុំ')?.language).toBe(
            'ជប៉ុន',
        );
        expect(readLangInstallAsk('ទាញយកភាសាកូរ៉េមក')?.language).toBe('កូរ៉េ');
    });

    it('leaves a how-to, a nameless one and a Bible alone', () => {
        expect(readLangInstallAsk('តើខ្ញុំដំឡើងភាសាដោយរបៀបណា?')).toBeNull();
        expect(readLangInstallAsk('ដំឡើងភាសាដោយរបៀបណា')).toBeNull();
        expect(readLangInstallAsk('ដំឡើងភាសាមួយ')).toBeNull();
        expect(readLangInstallAsk('ដំឡើងព្រះគម្ពីរ')).toBeNull();
        expect(readLangInstallAsk('ដំឡើងព្រះគម្ពីរភាសាខ្មែរ')).toBeNull();
    });

    it('still reads English the way it did', () => {
        expect(readLangInstallAsk('Install the German language')).toEqual({
            step: 'check',
            language: 'German',
        });
    });
});
