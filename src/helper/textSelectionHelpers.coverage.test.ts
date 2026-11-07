// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        openExternalURL: vi.fn(),
        copyToClipboard: vi.fn(),
        getLangCode: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: mocks.openExternalURL } },
}));
vi.mock('../server/appHelpers', () => ({
    copyToClipboard: mocks.copyToClipboard,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: '__DIVIDER__',
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../lang/langHelpers', () => ({
    getLangCode: mocks.getLangCode,
    tran: (text: string) => text,
}));

import { genSelectedTextContextMenus } from './textSelectionHelpers';

function selectContentsOf(node: Node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = globalThis.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

function menuLabels() {
    return genSelectedTextContextMenus().map((item) => item.menuElement);
}

beforeEach(() => {
    mocks.getLangCode.mockImplementation((locale: string) => {
        return locale === 'xx-XX' ? undefined : locale.split('-')[0];
    });
});

afterEach(() => {
    globalThis.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
});

describe('the dictionary entry of the selected-text menu', () => {
    test('a selection resting on a text node with no parent element offers none', () => {
        // A text node straight in a shadow root, say: it has no element to
        // read a locale off.
        const strayText = document.createTextNode('Grace');
        vi.spyOn(globalThis, 'getSelection').mockReturnValue({
            rangeCount: 1,
            toString: () => 'Grace',
            getRangeAt: () => ({ commonAncestorContainer: strayText }),
            removeAllRanges: () => {},
        } as unknown as Selection);
        expect(menuLabels()).toEqual([
            'Copy Selected Text',
            'Search Selected Text on Google',
            '__DIVIDER__',
        ]);
    });

    test('an SVG inside the selection is not asked for its locale', () => {
        document.body.innerHTML =
            '<div id="verse" data-dict-locale="en-US">Grace ' +
            '<svg data-dict-locale="yy-YY"><text>✝</text></svg></div>';
        selectContentsOf(document.getElementById('verse')!);

        const items = genSelectedTextContextMenus();
        const dictionary = items.find((item) => {
            return item.menuElement === 'Dictionary for Selected Text';
        });
        dictionary!.onSelect!(new MouseEvent('click'));
        expect(mocks.openExternalURL.mock.calls).toEqual([
            ['https://en.wiktionary.org/wiki/Grace ✝'],
        ]);
    });

    test('a locale the app has no language code for gets no dictionary', () => {
        document.body.innerHTML =
            '<p id="verse" data-dict-locale="xx-XX">Selah</p>';
        selectContentsOf(document.getElementById('verse')!);
        expect(menuLabels()).toEqual([
            'Copy Selected Text',
            'Search Selected Text on Google',
            '__DIVIDER__',
        ]);
    });

    test('a locale written with padding is still found', () => {
        document.body.innerHTML =
            '<p id="verse" data-dict-locale=" yy-YY ">✝♪</p>';
        selectContentsOf(document.getElementById('verse')!);
        const items = genSelectedTextContextMenus();
        items[2].onSelect!(new MouseEvent('click'));
        expect(mocks.getLangCode).toHaveBeenCalledWith('yy-YY');
        expect(mocks.openExternalURL).toHaveBeenCalledWith(
            'https://yy.wiktionary.org/wiki/✝♪',
        );
    });
});
