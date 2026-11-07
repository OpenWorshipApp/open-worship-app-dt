import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        requestBibleImport: vi.fn(),
        openBibleSetting: vi.fn(),
        openExternalURL: vi.fn(),
    };
});

vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/mcpClient', () => {
    return {
        callTool: mocks.callTool,
        parseToolJson: (text: string) => JSON.parse(text),
    };
});
vi.mock(
    '../../../../../../setting/bible-setting/bibleImportRequestHelpers',
    () => {
        return { requestBibleImport: mocks.requestBibleImport };
    },
);
vi.mock('../../../../../../setting/settingHelpers', () => {
    return { openBibleSetting: mocks.openBibleSetting };
});
vi.mock('../../../../../../server/appProvider', () => {
    return {
        default: { browserUtils: { openExternalURL: mocks.openExternalURL } },
    };
});

import { runBibleImportStep } from '../../../../../../chatbot/bibleImportChatHelpers';

describe('a step by step import, pressed through', () => {
    it('offers the language’s key even when the file title names nothing', async () => {
        const step = await runBibleImportStep({
            step: 'key',
            draftId: 'he10paxbbz64',
            title: 'French (NBS) 2002 (Nouvelle Bible Segond)',
            locales: [{ locale: 'fr-FR', name: 'French (France)' }],
            keys: ['NBS', 'FRNBS'],
            takenKeys: [],
        });
        expect(step.actions?.map((one) => one.label)).toEqual([
            'LSG (suggested)',
            'Cancel',
        ]);
        expect(step.actions?.[0].title).toBe('La Sainte Bible, Louis Segond');
    });
});
