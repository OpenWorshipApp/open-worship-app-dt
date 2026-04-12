// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { openExternalURLMock, copyToClipboardMock, getLangCodeMock } =
    vi.hoisted(() => ({
        openExternalURLMock: vi.fn(),
        copyToClipboardMock: vi.fn(),
        getLangCodeMock: vi.fn((locale: string) => locale.split('-')[0]),
    }));

vi.mock('../server/appProvider', () => ({
    default: {
        browserUtils: {
            openExternalURL: openExternalURLMock,
        },
    },
}));

vi.mock('../server/appHelpers', () => ({
    copyToClipboard: copyToClipboardMock,
}));

vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: '__DIVIDER__',
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));

vi.mock('../lang/langHelpers', () => ({
    getLangCode: getLangCodeMock,
    tran: (value: string) => value,
}));

import {
    genSelectedTextContextMenus,
    getSelectedText,
} from './textSelectionHelpers';

function selectNodeContents(node: Node) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
}

describe('textSelectionHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        window.getSelection()?.removeAllRanges();
    });

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
    });

    test('returns null and no menus when nothing is selected', () => {
        expect(getSelectedText()).toBeNull();
        expect(genSelectedTextContextMenus()).toEqual([]);
    });

    test('builds copy, search and dictionary menus for selected text', () => {
        document.body.innerHTML =
            '<div data-dict-locale="en-US"><span id="word" data-dict-locale="km-KH">Grace</span></div>';
        const container = document.querySelector('[data-dict-locale="en-US"]');
        if (!container) {
            throw new Error('Expected selected text container');
        }
        selectNodeContents(container);

        const extraAction = vi.fn();
        const menuItems = genSelectedTextContextMenus([
            {
                menuElement: 'Extra Action',
                onSelect: extraAction,
            },
        ]);

        expect(getSelectedText()).toBe('Grace');
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'Copy Selected Text',
            'Search Selected Text on Google',
            'Dictionary for Selected Text',
            'Extra Action',
            '__DIVIDER__',
        ]);

        menuItems[0].onSelect?.();
        expect(copyToClipboardMock).toHaveBeenCalledWith('Grace');

        menuItems[1].onSelect?.();
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://www.google.com/search?q=Grace',
        );

        openExternalURLMock.mockClear();
        menuItems[2].onSelect?.();
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://en.wiktionary.org/wiki/Grace',
        );
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://km.wiktionary.org/wiki/Grace',
        );
    });

    test('omits dictionary entries when the selection has no locale metadata', () => {
        document.body.innerHTML = '<div><span id="plain">Mercy</span></div>';
        const textNode = document.getElementById('plain')?.firstChild;
        if (!textNode) {
            throw new Error('Expected selected text node');
        }
        selectNodeContents(textNode);

        const menuItems = genSelectedTextContextMenus();

        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'Copy Selected Text',
            'Search Selected Text on Google',
            '__DIVIDER__',
        ]);
    });
});
