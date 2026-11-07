import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showSimpleToastMock,
    handleErrorMock,
    appErrorMock,
    bibleItemFromJsonMock,
    genCopyingMenuMock,
    quickTrimTextMock,
    getLangDataAsyncMock,
    tranMock,
    showAppContextMenuMock,
    saveBibleItemMock,
    genContextMenuItemIconMock,
    toVerseFullKeyFormatMock,
    setSettingMock,
    openDetailPanelMock,
    genOpenInChatbotMenuMock,
} = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
    handleErrorMock: vi.fn(),
    appErrorMock: vi.fn(),
    bibleItemFromJsonMock: vi.fn((json: any) => ({
        __bibleItem: true,
        ...json,
    })),
    genCopyingMenuMock: vi.fn(() => [{ menuElement: 'copy' }]),
    quickTrimTextMock: vi.fn((_locale: string, text: string) => text),
    // The English finding form, as `src/lang/data/en` writes it.
    getLangDataAsyncMock: vi.fn(async (_locale: string): Promise<any> => ({
        sanitizeFindingText: (text: string) => {
            return text
                .toLowerCase()
                .replaceAll(/[^a-z0-9 ]/g, ' ')
                .replaceAll(/\s+/g, ' ')
                .trim();
        },
    })),
    tranMock: vi.fn((key: string) => key),
    showAppContextMenuMock: vi.fn(),
    saveBibleItemMock: vi.fn(),
    genContextMenuItemIconMock: vi.fn(() => null),
    toVerseFullKeyFormatMock: vi.fn(() => 'KJV-KEY'),
    setSettingMock: vi.fn(),
    openDetailPanelMock: vi.fn(async (_bibleItem: unknown) => {}),
    genOpenInChatbotMenuMock: vi.fn((_bibleItem: unknown) => [
        { menuElement: 'Open in Chatbot' },
    ]),
}));

vi.mock('../../../../../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));
vi.mock('../../../../../../helper/loggerHelpers', () => ({
    appError: appErrorMock,
}));
vi.mock('../../../../../../bible-list/BibleItem', () => ({
    default: { fromJson: bibleItemFromJsonMock },
}));
vi.mock('../../../../../../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: genCopyingMenuMock,
}));
vi.mock('../../../../../langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: getLangDataAsyncMock,
    quickTrimText: quickTrimTextMock,
    tran: tranMock,
}));
vi.mock('../../../../../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));
vi.mock('../../../../../../bible-list/bibleHelpers', () => ({
    saveBibleItem: saveBibleItemMock,
}));
vi.mock('../../../../../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: genContextMenuItemIconMock,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleInfoHelpers', () => ({
    toVerseFullKeyFormat: toVerseFullKeyFormatMock,
}));
vi.mock('../../../../../../helper/settingHelpers', () => ({
    setSetting: setSettingMock,
}));
vi.mock('../../../../../../location-name-lookup/detailPanelHelpers', () => ({
    openBibleItemDetailPanel: openDetailPanelMock,
}));
vi.mock('../../../../../../helper/ai/bibleItemChatbotMenuHelpers', () => ({
    genOpenInChatbotContextMenu: genOpenInChatbotMenuMock,
}));

import {
    highlightFoundWords,
    toFindWildCardText,
} from '../../../../../../bible-find/bibleFindHelpers';

describe('bible-find bibleFindHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mark = (text: string) => {
        return `<span class="app-found-match">${text}</span>`;
    };

    test('highlightFoundWords matches across what the finding form drops', () => {
        // The Khmer finding form keeps Khmer letters only, so the zero-width
        // non-joiner inside a word is not there to match -- the marker goes
        // round it, and round the whole word.
        const toKhmerFindingText = (text: string) => {
            return text
                .replaceAll(/[^ក-៓០-៩]/g, ' ')
                .replaceAll(/\s+/g, ' ')
                .trim();
        };
        const word = 'ព្រះ‌យេហូវ៉ា';
        expect(
            highlightFoundWords(
                `${word}​ទ្រង់`,
                'ព្រះយេហូវ៉ា',
                toKhmerFindingText,
            ),
        ).toBe(`${mark(word)}​ទ្រង់`);
        // A conjunct is never split: `ស្រី` segments as `ស្` + `រី`.
        expect(highlightFoundWords('ស្រី', 'ស', toKhmerFindingText)).toBe(
            mark('ស្រី'),
        );
    });
});

describe('toFindWildCardText', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        quickTrimTextMock.mockImplementation(
            (_locale: string, text: string) => text,
        );
    });

    test('returns null when the query holds nothing of this bible script', () => {
        // Measured 2026-09-20: a Khmer word looked up in the KJV built
        // `LIKE '%%'` and answered "31,102 verses found" -- the whole bible.
        quickTrimTextMock.mockImplementation(() => '');
        expect(toFindWildCardText('en' as any, 'ឥន្ទ្រីយ')).toBeNull();
    });
});
