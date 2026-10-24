// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        panels: [] as any[],
        managers: undefined as any,
        controller: null as object | null,
        isAiEnabled: false,
    },
    mocks: {
        closePanel: vi.fn(),
        openPanel: vi.fn(),
        copy: vi.fn(),
        buildNameSummary: vi.fn(),
        buildLocationSummary: vi.fn(),
        openVerse: vi.fn(),
        showToast: vi.fn(),
        handleError: vi.fn(),
        showBibleKeyOption: vi.fn(),
        useLookupManagers: vi.fn(),
        verseFontFamily: vi.fn(),
        openChatbotWithLookup: vi.fn(),
        shortToBibleItem: vi.fn(),
        showAppContextMenu: vi.fn(),
        genCopyingMenu: vi.fn(),
    },
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => state.isAiEnabled,
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotWithLookup: mocks.openChatbotWithLookup,
}));

vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        children,
        extraActionButtons,
        menuItems,
        onClose,
        options,
    }: {
        title: ReactNode;
        children: ReactNode;
        extraActionButtons?: ReactNode;
        menuItems?: {
            menuElement: ReactNode;
            onSelect?: (event: MouseEvent) => void;
        }[];
        onClose: () => void;
        options: { initialOffset: number; extraClassName?: string };
    }) => (
        <section
            data-offset={options.initialOffset}
            className={options.extraClassName}
        >
            <header>{title}</header>
            {extraActionButtons}
            {/* The `⋮` menu's items, flattened into buttons. */}
            {menuItems?.map((item, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={(event) => item.onSelect?.(event.nativeEvent)}
                >
                    {item.menuElement}
                </button>
            ))}
            <button type="button" onClick={onClose}>
                Close detail
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: mocks.showBibleKeyOption,
}));
vi.mock('../graph-view/OpenGraphPreviewButtonComp', () => ({
    default: ({ name }: { name: string }) => <span>Graph: {name}</span>,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    getCurrentLookupBibleItemController: () => state.controller,
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../helper/bibleViewHelpers', () => ({
    useBibleViewTextScale: () => 1.5,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/LoadingComp', () => ({
    default: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: ({
        shouldShowPlayToBottom,
    }: {
        shouldShowPlayToBottom?: boolean;
    }) => (
        <i
            data-testid="scrolling-handler"
            data-play-to-bottom={shouldShowPlayToBottom ? '1' : '0'}
        />
    ),
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showToast,
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('./bibleVerseHelpers', () => ({
    openVerseInBibleLookup: mocks.openVerse,
    shortToBibleItem: mocks.shortToBibleItem,
    useLookupVerseFontFamily: mocks.verseFontFamily,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
// jsdom here refuses a `MouseEvent` whose `view` is the test's `window`.
vi.mock('../context-menu/contextMenuEventHelpers', async () => ({
    ...(await vi.importActual<any>('../context-menu/contextMenuEventHelpers')),
    createMouseEvent: (clientX: number, clientY: number) => ({
        clientX,
        clientY,
    }),
}));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: mocks.genCopyingMenu,
}));
vi.mock('./detailPanelHelpers', () => ({
    closeDetailPanel: mocks.closePanel,
    openDetailPanel: mocks.openPanel,
    useOpenDetailPanels: () => state.panels,
}));
vi.mock('./lookupLangHelpers', async () => {
    const { createContext } = await import('react');
    return {
        LookupLangContext: createContext<string | null>(null),
        useLookupLangPresentation: () => ({ fontFamily: 'NameFont' }),
    };
});
vi.mock('./LookupLangCodeButtonComp', () => ({
    default: ({ onSelect }: { onSelect: (code: string) => void }) => (
        <button type="button" onClick={() => onSelect('fr')}>
            French
        </button>
    ),
}));
vi.mock('./lookupManagersContext', async () => {
    const { createContext } = await import('react');
    return {
        LookupManagersContext: createContext<unknown>(null),
        useLookupManagers: mocks.useLookupManagers,
    };
});
vi.mock('./lookupPresentationHelpers', () => ({
    getRecordKjvName: () => 'KJV name',
}));
vi.mock('./lookupRecordHelpers', () => ({
    buildLocationSummary: mocks.buildLocationSummary,
    buildNameSummary: mocks.buildNameSummary,
    copyRecordToClipboard: mocks.copy,
    escapeHtml: (text: string) => text,
}));
vi.mock('./RenderDetailBodyComp', () => ({
    RenderNameDetailComp: ({
        onVersesResolved,
    }: {
        onVersesResolved: (verses: string[]) => void;
    }) => (
        <button
            type="button"
            onClick={() => onVersesResolved(['Genesis 12:1'])}
        >
            Resolve names
        </button>
    ),
    RenderLocationDetailComp: ({
        onVersesResolved,
    }: {
        onVersesResolved: (verses: string[]) => void;
    }) => (
        <button type="button" onClick={() => onVersesResolved(['Exodus 2:2'])}>
            Resolve locations
        </button>
    ),
    RenderVerseDetailComp: ({
        bibleKey,
        onResolved,
    }: {
        bibleKey?: string;
        onResolved: (verse: unknown) => void;
    }) => (
        <button
            type="button"
            data-bible-key={bibleKey ?? 'lookup'}
            onClick={() =>
                onResolved({
                    title: 'Genesis 1:1',
                    bibleKey: bibleKey ?? 'KJV',
                    text: 'In the beginning',
                })
            }
        >
            Resolve verse
        </button>
    ),
}));

import LocationNameDetailPanelsComp from './LocationNameDetailPanelsComp';

let host: HTMLDivElement;
let root: Root;

function click(label: string) {
    const button = [...document.body.querySelectorAll('button')].find(
        (item) =>
            item.textContent === label ||
            item.getAttribute('aria-label') === label,
    );
    expect(button).toBeDefined();
    button!.click();
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.panels = [];
    state.managers = undefined;
    state.controller = null;
    mocks.copy.mockResolvedValue(undefined);
    mocks.openVerse.mockResolvedValue(true);
    mocks.showBibleKeyOption.mockResolvedValue(undefined);
    mocks.useLookupManagers.mockImplementation(() => state.managers);
    mocks.verseFontFamily.mockReturnValue('VerseFont');
    mocks.buildNameSummary.mockImplementation((_, record, verses) => ({
        plainText: `${record.name}: ${verses.join(', ')}`,
        html: '<p>Name</p>',
    }));
    mocks.buildLocationSummary.mockImplementation((_, record, verses) => ({
        plainText: `${record.name}: ${verses.join(', ')}`,
        html: '<p>Location</p>',
    }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('location and name detail panels', () => {
    test('shows loading and failure states and closes the selected panel', async () => {
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(
            document.querySelector('.app-floating-widget-portal'),
        ).toBeNull();

        state.panels = [
            {
                key: 'name-1',
                kind: 'name',
                target: 'n1',
                name: 'Adam',
                raiseCount: 0,
            },
        ];
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(document.body.textContent).toContain('Loading lookup data');
        state.managers = null;
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(document.body.textContent).toContain(
            'Failed to load lookup data',
        );
        await act(async () => click('Close detail'));
        expect(mocks.closePanel).toHaveBeenCalledWith('name-1');
    });

    test('copies raw and resolved name references and toasts each copy', async () => {
        const record = { name: 'Abraham', verses: ['GEN.12.1'] };
        state.panels = [
            {
                key: 'name-1',
                kind: 'name',
                target: 'n1',
                name: 'Old name',
                raiseCount: 0,
            },
        ];
        state.managers = {
            namesLookupManager: { getRecordById: () => record },
            locationsLookupManager: { getRecordById: () => null },
        };
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(document.body.textContent).toContain('Abraham');
        expect(document.body.textContent).toContain('KJV name');
        await act(async () => click('Copy'));
        expect(mocks.copy).toHaveBeenLastCalledWith(
            'Abraham: GEN.12.1',
            '<p>Name</p>',
        );
        expect(mocks.showToast).toHaveBeenLastCalledWith(
            'Copy',
            'Text has been copied to clipboard',
        );

        await act(async () => click('Resolve names'));
        await act(async () => click('Copy'));
        expect(mocks.copy).toHaveBeenLastCalledWith(
            'Abraham: Genesis 12:1',
            '<p>Name</p>',
        );
        expect(mocks.showToast).toHaveBeenCalledTimes(2);
        // A failed copy says nothing landed.
        mocks.copy.mockRejectedValueOnce(new Error('denied'));
        await act(async () => click('Copy'));
        expect(mocks.showToast).toHaveBeenCalledTimes(2);
        expect(mocks.handleError).toHaveBeenCalled();
        await act(async () => click('French'));
        expect(mocks.openPanel).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'name',
                target: 'n1',
                langCode: 'fr',
            }),
        );
    });

    test('copies a location summary and a resolved verse with its Bible title', async () => {
        const record = { name: 'Jerusalem', verses: ['JOS.10.1'] };
        state.panels = [
            {
                key: 'location-1',
                kind: 'location',
                target: 'l1',
                name: 'Old',
                raiseCount: 0,
            },
        ];
        state.managers = {
            namesLookupManager: { getRecordById: () => null },
            locationsLookupManager: { getRecordById: () => record },
        };
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        await act(async () => click('Copy'));
        expect(mocks.copy).toHaveBeenLastCalledWith(
            'Jerusalem: JOS.10.1',
            '<p>Location</p>',
        );

        state.panels = [
            {
                key: 'verse-1',
                kind: 'verse',
                target: 'GEN.1.1',
                name: 'Old',
                raiseCount: 1,
            },
        ];
        state.controller = {};
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        // Not read yet: the reference is all there is to copy.
        await act(async () => click('Copy'));
        expect(mocks.copy).toHaveBeenLastCalledWith(
            'GEN.1.1',
            '<p>GEN.1.1</p>',
        );
        await act(async () => click('Resolve verse'));
        expect(document.body.textContent).toContain('Genesis 1:1');
        expect(document.body.textContent).toContain('KJV');
        expect(document.body.textContent).not.toContain('(KJV)');
        // Read, Copy opens the Bible copy menu for the passage rather than
        // copying straight away (2026-10-22).
        const bibleItem = { bibleKey: 'KJV' };
        const copyingMenu = [{ menuElement: 'Copy Title' }];
        mocks.shortToBibleItem.mockResolvedValue(bibleItem);
        mocks.genCopyingMenu.mockReturnValue(copyingMenu);
        const copyCount = mocks.copy.mock.calls.length;
        await act(async () => click('Copy'));
        await vi.waitFor(() => {
            expect(mocks.showAppContextMenu).toHaveBeenCalledWith(
                { clientX: expect.any(Number), clientY: expect.any(Number) },
                copyingMenu,
            );
        });
        expect(mocks.shortToBibleItem).toHaveBeenCalledWith('KJV', 'GEN.1.1');
        expect(mocks.genCopyingMenu).toHaveBeenCalledWith(bibleItem);
        expect(mocks.copy).toHaveBeenCalledTimes(copyCount);
        // A passage that no longer reads opens nothing.
        mocks.shortToBibleItem.mockResolvedValue(null);
        await act(async () => click('Copy'));
        await vi.waitFor(() => {
            expect(mocks.shortToBibleItem).toHaveBeenCalledTimes(2);
        });
        await act(async () => vi.advanceTimersByTimeAsync(10));
        expect(mocks.showAppContextMenu).toHaveBeenCalledTimes(1);
        mocks.openVerse.mockResolvedValueOnce(false);
        await act(async () => click('Open in bible lookup'));
        expect(mocks.openVerse).toHaveBeenCalledWith(
            state.controller,
            'GEN.1.1',
            undefined,
        );
        expect(mocks.showToast).toHaveBeenCalledWith(
            'Open in bible lookup',
            'Unable to seek bible item',
        );
    });

    // A cross reference or a found verse opens a verse panel with no lookup
    // panel holding the ~34MB names and places dataset: it must not load it.
    test('a verse panel reads in its own bible and never loads the lookup data', async () => {
        state.panels = [
            {
                key: 'verse:GEN 17:5:KHM',
                kind: 'verse',
                target: 'GEN 17:5',
                name: 'Genesis 17:5',
                bibleKey: 'KHM',
                raiseCount: 0,
            },
        ];
        state.controller = {};
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(mocks.useLookupManagers).not.toHaveBeenCalled();
        expect(mocks.verseFontFamily).toHaveBeenCalledWith('KHM');
        expect(
            document
                .querySelector('[data-bible-key]')
                ?.getAttribute('data-bible-key'),
        ).toBe('KHM');
        await act(async () => click('Resolve verse'));
        await act(async () => click('Open in bible lookup'));
        expect(mocks.openVerse).toHaveBeenCalledWith(
            state.controller,
            'GEN 17:5',
            'KHM',
        );
    });

    // The Bible view's to-the-top on every panel, and its auto-scroll on a
    // passage only (2026-10-22): a name or a place is a record to look at,
    // not text to read down.
    test('every panel scrolls to the top; only a verse panel auto-scrolls', async () => {
        state.panels = [
            {
                key: 'verse:GEN 8:1-22:KHM',
                kind: 'verse',
                target: 'GEN 8:1-22',
                name: 'Genesis 8:1-22',
                bibleKey: 'KHM',
                raiseCount: 0,
            },
        ];
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        const handler = document.querySelector<HTMLElement>(
            '[data-testid="scrolling-handler"]',
        );
        expect(handler?.dataset.playToBottom).toBe('1');
        expect(
            document.querySelector('section')?.classList.value.split(' '),
        ).toEqual([
            'location-name-lookup-detail-widget',
            'location-name-lookup-detail-widget--verse',
        ]);

        state.panels = [
            {
                key: 'name-1',
                kind: 'name',
                target: 'n1',
                name: 'Abraham',
                raiseCount: 0,
            },
        ];
        state.managers = {
            namesLookupManager: { getRecordById: () => ({ name: 'Abraham' }) },
            locationsLookupManager: { getRecordById: () => null },
        };
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(
            document.querySelector<HTMLElement>(
                '[data-testid="scrolling-handler"]',
            )?.dataset.playToBottom,
        ).toBe('0');
        expect(document.querySelector('section')?.className).toBe(
            'location-name-lookup-detail-widget',
        );
    });

    test('the bible key in a verse title opens the verse in another bible', async () => {
        state.panels = [
            {
                key: 'verse:GEN 17:5:KJV',
                kind: 'verse',
                target: 'GEN 17:5',
                name: 'Old',
                bibleKey: 'KJV',
                raiseCount: 0,
            },
        ];
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        // Nothing to pick from until the verse has said which bible it is in.
        expect(
            document.querySelector('[aria-label^="Open in another Bible"]'),
        ).toBeNull();
        await act(async () => click('Resolve verse'));
        const bibleKeyButton = document.querySelector<HTMLButtonElement>(
            '[aria-label="Open in another Bible: KJV"]',
        );
        expect(bibleKeyButton?.textContent).toBe('KJV');
        await act(async () => bibleKeyButton!.click());
        const [, onSelect, excludedKeys, menuTitle] =
            mocks.showBibleKeyOption.mock.calls[0];
        expect(excludedKeys).toEqual(['KJV']);
        expect(menuTitle).toBe('Open in another Bible');
        onSelect('KHM');
        expect(mocks.openPanel).toHaveBeenCalledWith({
            kind: 'verse',
            target: 'GEN 17:5',
            name: 'Genesis 1:1',
            bibleKey: 'KHM',
        });
    });

    // The robot at the left of the title (2026-10-18): which record, never
    // its words, handed to the assistant -- and nothing at all with AI off.
    test('asks the assistant about the record it shows, only while AI is on', async () => {
        const record = { name: 'Abraham', verses: ['GEN.12.1'] };
        state.panels = [
            {
                key: 'name-1',
                kind: 'name',
                target: 'n1',
                name: 'Old name',
                langCode: 'km',
                raiseCount: 0,
            },
        ];
        state.managers = {
            namesLookupManager: { getRecordById: () => record },
            locationsLookupManager: { getRecordById: () => null },
        };
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        expect(
            document.querySelector(
                '[aria-label="Ask the Assistant About This Person"]',
            ),
        ).toBeNull();
        state.isAiEnabled = true;
        await act(async () => root.render(<LocationNameDetailPanelsComp />));
        await act(async () => click('Ask the Assistant About This Person'));
        expect(mocks.openChatbotWithLookup).toHaveBeenCalledWith({
            kind: 'name',
            target: 'n1',
            title: 'Abraham',
            langCode: 'km',
            page: globalThis.location.href,
        });
        state.isAiEnabled = false;
    });
});
