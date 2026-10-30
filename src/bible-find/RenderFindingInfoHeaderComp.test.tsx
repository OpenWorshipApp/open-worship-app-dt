// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    showAppContextMenu: vi.fn(),
    genBookMatches: vi.fn(),
    showSimpleToast: vi.fn(),
    showAppConfirm: vi.fn(),
    resetSearchingDatabase: vi.fn(),
    reload: vi.fn(),
    openChatbotAsking: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => <i data-icon={name} />,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    checkIsOldTestament: (bookKey: string) => ['GEN', 'EXO'].includes(bookKey),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: h.genBookMatches,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirm,
}));
vi.mock('./BibleFindController', () => ({
    default: { resetSearchingDatabase: h.resetSearchingDatabase },
}));
vi.mock('../server/appProvider', () => ({
    default: { reload: h.reload },
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) =>
        bibleKey === 'KJV' ? 'serif' : 'monospace',
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotAsking: h.openChatbotAsking,
}));

import RenderFindingInfoHeaderComp from './RenderFindingInfoHeaderComp';
import type { SelectedBookKeyType } from './bibleFindHelpers';

const BOOKS = [
    {
        bibleKey: 'KJV',
        bookKey: 'GEN',
        book: 'Genesis',
        modelBook: 'Genesis',
        isAvailable: true,
    },
    {
        bibleKey: 'KJV',
        bookKey: 'EXO',
        book: 'Exodus',
        modelBook: 'Exodus',
        isAvailable: false,
    },
    {
        bibleKey: 'KJV',
        bookKey: 'JHN',
        book: 'Jean',
        modelBook: 'John',
        isAvailable: true,
    },
];

let host: HTMLDivElement;
let root: Root;
let setSelectedBooks: Mock<(selectedBooks: SelectedBookKeyType[]) => void>;

async function renderHeader(
    selectedBooks: SelectedBookKeyType[],
    findText?: string,
) {
    await act(async () => {
        root.render(
            <RenderFindingInfoHeaderComp
                bibleKey="KJV"
                selectedBooks={selectedBooks}
                setSelectedBooks={setSelectedBooks}
                findText={findText}
            />,
        );
    });
}

function getButton(selector: string) {
    const button = host.querySelector<HTMLButtonElement>(selector);
    if (button === null) {
        throw new Error(`No button ${selector}`);
    }
    return button;
}

async function click(button: HTMLButtonElement) {
    await act(async () => {
        button.click();
    });
}

// What a menu row reads: a plain label, or the text of its element.
function toLabel(item: { menuElement: any }) {
    if (typeof item.menuElement === 'string') {
        return item.menuElement;
    }
    return item.menuElement.props.children;
}

async function openBookMenu() {
    await click(getButton('.app-find-filter'));
    expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
    return h.showAppContextMenu.mock.calls[0][1] as any[];
}

async function openExtraMenu() {
    await click(getButton('[aria-label="More Options"]'));
    expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
    return h.showAppContextMenu.mock.calls[0][1] as any[];
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.genBookMatches.mockResolvedValue(BOOKS);
    h.showAppConfirm.mockResolvedValue(true);
    h.resetSearchingDatabase.mockResolvedValue(true);
    h.openChatbotAsking.mockResolvedValue(undefined);
    setSelectedBooks = vi.fn<(selectedBooks: SelectedBookKeyType[]) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Find filter bar', () => {
    test('says All Books with no filter, and names the books when filtered', async () => {
        await renderHeader([]);
        const filter = getButton('.app-find-filter');
        expect(filter.textContent).toBe('All Books');
        expect(filter.title).toBe('All Books');
        expect(filter.classList.contains('is-filtered')).toBe(false);
        expect(filter.querySelector('.bi-funnel-fill')).toBeNull();
        // The Bible's own face, for book names in its own script.
        expect(filter.querySelector('span')!.style.fontFamily).toBe('serif');

        await renderHeader([
            { bookKey: 'GEN', book: 'Genesis' },
            { bookKey: 'JHN', book: 'John' },
        ]);
        expect(filter.textContent).toBe('Genesis, John');
        expect(filter.classList.contains('is-filtered')).toBe(true);
        expect(filter.querySelector('.bi-funnel-fill')).not.toBeNull();
    });

    test('lists the books by testament, the unavailable ones disabled', async () => {
        await renderHeader([]);
        const items = await openBookMenu();
        expect(h.genBookMatches).toHaveBeenCalledWith('KJV');
        expect(items.map(toLabel)).toEqual([
            'All Books',
            'Old Testament',
            'Genesis',
            'Exodus',
            'New Testament',
            // A book whose name differs from the model's says both.
            'Jean (John)',
        ]);
        expect(items.map((item) => item.disabled ?? false)).toEqual([
            false,
            false,
            false,
            true,
            false,
            false,
        ]);
        expect(items[2].menuElement.props['data-bible-key-ff']).toBe('KJV');
    });

    test('each menu row sets the filter it names', async () => {
        await renderHeader([]);
        const items = await openBookMenu();
        items[0].onSelect();
        expect(setSelectedBooks).toHaveBeenLastCalledWith([]);
        items[1].onSelect();
        expect(setSelectedBooks).toHaveBeenLastCalledWith([BOOKS[0], BOOKS[1]]);
        items[4].onSelect();
        expect(setSelectedBooks).toHaveBeenLastCalledWith([BOOKS[2]]);
        items[2].onSelect({ shiftKey: false });
        expect(setSelectedBooks).toHaveBeenLastCalledWith([
            { bookKey: 'GEN', book: 'Genesis' },
        ]);
    });

    test('Shift adds a book to the filter; the only selected book cannot be picked again', async () => {
        const selected = [{ bookKey: 'GEN', book: 'Genesis' }];
        await renderHeader(selected);
        const items = await openBookMenu();
        expect(items.map(toLabel)).toEqual([
            'All Books',
            'Shift + Click to select multiple',
            'Old Testament',
            'Genesis',
            'Exodus',
            'New Testament',
            'Jean (John)',
        ]);
        expect(items[3].disabled).toBe(true);
        items[6].onSelect({ shiftKey: true });
        expect(setSelectedBooks).toHaveBeenLastCalledWith([
            { bookKey: 'GEN', book: 'Genesis' },
            { bookKey: 'JHN', book: 'Jean' },
        ]);
        items[6].onSelect({ shiftKey: false });
        expect(setSelectedBooks).toHaveBeenLastCalledWith([
            { bookKey: 'JHN', book: 'Jean' },
        ]);
    });

    test('a Bible whose books cannot be read says so instead of a menu', async () => {
        h.genBookMatches.mockResolvedValue(null);
        await renderHeader([]);
        await click(getButton('.app-find-filter'));
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Getting bible list',
            'Fail to get bible list',
        );
    });

    test('More Options resets the book filter, only when there is one', async () => {
        await renderHeader([]);
        let items = await openExtraMenu();
        expect(items.map(toLabel)).toEqual([
            'Reset Search Data',
            'Reset Selected Books',
        ]);
        expect(items[1].disabled).toBe(true);

        h.showAppContextMenu.mockClear();
        await renderHeader([{ bookKey: 'GEN', book: 'Genesis' }]);
        items = await openExtraMenu();
        expect(items[1].disabled).toBe(false);
        items[1].onSelect();
        expect(setSelectedBooks).toHaveBeenCalledWith([]);
    });

    test('Reset Search Data asks first, then reloads once the index is reset', async () => {
        await renderHeader([]);
        const items = await openExtraMenu();
        await items[0].onSelect();
        expect(h.showAppConfirm).toHaveBeenCalledWith(
            'Reset Search Data',
            'Are you sure to reset search data? This will take a moment to restore',
        );
        expect(h.resetSearchingDatabase).toHaveBeenCalledWith('KJV');
        expect(h.reload).toHaveBeenCalledTimes(1);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('Reset Search Data does nothing when declined, and says so when it fails', async () => {
        await renderHeader([]);
        const items = await openExtraMenu();
        h.showAppConfirm.mockResolvedValueOnce(false);
        await items[0].onSelect();
        expect(h.resetSearchingDatabase).not.toHaveBeenCalled();
        expect(h.reload).not.toHaveBeenCalled();

        h.resetSearchingDatabase.mockResolvedValueOnce(false);
        await items[0].onSelect();
        expect(h.reload).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Reset Search Data',
            'Fail to reset search data, please try again',
        );
    });

    test('the robot asks the assistant about this Bible, with what is typed in Find', async () => {
        await renderHeader([], '  shepherd  ');
        const robot = getButton(
            '[aria-label="Find a Verse with the Assistant"]',
        );
        expect(robot.title).toBe('Find a Verse with the Assistant');
        await click(robot);
        expect(h.openChatbotAsking).toHaveBeenCalledWith(
            'Help me find a Bible verse in "KJV": shepherd',
        );

        // The words ride as they are at the time of the press.
        await renderHeader([], '');
        await click(robot);
        expect(h.openChatbotAsking).toHaveBeenLastCalledWith(
            'Help me find a Bible verse in "KJV"',
        );
    });
});
