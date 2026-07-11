// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAllLocalBibleInfoListMock: vi.fn(),
    getBibleInfoMock: vi.fn(),
    getLanguageTitleMock: vi.fn(),
    showAppAlertMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
    useBibleFontFamilyMock: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenuMock,
}));

vi.mock('../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: mocks.getAllLocalBibleInfoListMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: mocks.showAppAlertMock,
}));

vi.mock('../lang/langHelpers', () => ({
    getLanguageTitle: mocks.getLanguageTitleMock,
    tran: (value: string) => value,
}));

vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: 'DIVIDER',
}));

vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfoMock,
}));

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: mocks.useBibleFontFamilyMock,
}));

import BibleKeySelectionComp, {
    BibleKeySelectionMiniComp,
    genContextMenuBibleKeys,
    showBibleKeyOption,
} from './BibleKeySelectionComp';

type MenuItemType = {
    childBefore?: any;
    disabled?: boolean;
    menuElement: any;
    onSelect?: (event: any) => void;
    title?: string;
};

function getTextProps(node: any) {
    return node?.props ?? {};
}

describe('BibleSelectionComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();

        mocks.getAllLocalBibleInfoListMock.mockResolvedValue([
            { key: 'KJV', locale: 'en-US', title: 'King James Version' },
            { key: 'ESV', locale: 'en-US', title: 'English Standard Version' },
            { key: 'KHM', locale: 'km-KH', title: 'Khmer Bible' },
        ]);
        mocks.getLanguageTitleMock.mockImplementation(
            ({ locale }: { locale: string }) => {
                return `Language ${locale}`;
            },
        );
        mocks.getBibleInfoMock.mockResolvedValue({
            title: 'King James Version',
        });
        mocks.useBibleFontFamilyMock.mockReturnValue('BibleFont');

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('builds locale-grouped context-menu items and filters excluded bible keys', async () => {
        const onSelect = vi.fn();
        const menuItems = await genContextMenuBibleKeys(onSelect, ['ESV']);

        expect(menuItems).toHaveLength(5);
        expect(menuItems?.[0]?.disabled).toBe(true);
        expect(
            getTextProps(menuItems?.[0]?.menuElement)['data-locale-ff'],
        ).toBe('en-US');
        expect(getTextProps(menuItems?.[0]?.menuElement).children).toBe(
            'Language en-US',
        );
        expect(menuItems?.[1]?.title).toBe('King James Version');
        menuItems?.[1]?.onSelect?.('event-1' as any);
        expect(onSelect).toHaveBeenCalledWith('event-1', 'KJV');
        expect(menuItems?.[2]?.menuElement).toBe('DIVIDER');
        expect(
            getTextProps(menuItems?.[3]?.menuElement)['data-locale-ff'],
        ).toBe('km-KH');
        expect(menuItems?.[4]?.title).toBe('Khmer Bible');
    });

    test('alerts and returns early when bible info cannot be loaded', async () => {
        mocks.getAllLocalBibleInfoListMock.mockResolvedValueOnce(null);

        expect(await genContextMenuBibleKeys(vi.fn())).toBeNull();
        expect(mocks.showAppAlertMock).toHaveBeenCalledWith(
            'Unable to get bible info list',
            'We were sorry, but we are unable to get bible list at the moment please try again later',
        );

        mocks.getAllLocalBibleInfoListMock.mockResolvedValueOnce(null);
        await showBibleKeyOption({ type: 'click' }, vi.fn());
        expect(mocks.showAppContextMenuMock).not.toHaveBeenCalled();
    });

    test('prepends title hints before opening bible options and forwards selection', async () => {
        const onSelect = vi.fn();
        const event = { type: 'contextmenu' };

        await showBibleKeyOption(event, onSelect, ['KHM'], 'Pick a Bible');

        expect(mocks.showAppContextMenuMock).toHaveBeenCalledTimes(1);
        expect(mocks.showAppContextMenuMock).toHaveBeenCalledWith(
            event,
            expect.any(Array),
        );
        const menuItems = mocks.showAppContextMenuMock.mock
            .calls[0]?.[1] as MenuItemType[];
        expect(menuItems[0]?.disabled).toBe(true);
        expect(menuItems[0]?.menuElement).toBe('Pick a Bible');
        expect(getTextProps(menuItems[0]?.childBefore).className).toBe(
            'bi bi-lightbulb',
        );
        expect(menuItems[1]?.menuElement).toBe('DIVIDER');

        menuItems[3]?.onSelect?.('event-2');
        expect(onSelect).toHaveBeenCalledWith('KJV');
    });

    test('renders the default selector button and opens a menu on click', async () => {
        const onBibleKeyChange = vi.fn();

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <BibleKeySelectionComp
                    bibleKey="KJV"
                    onBibleKeyChange={onBibleKeyChange}
                />,
            );
        });

        const button = container?.querySelector('button');
        const titleSpan = container?.querySelector('button span[title]');
        expect(button).not.toBeNull();
        expect(titleSpan?.textContent).toBe('KJV');
        expect(titleSpan?.getAttribute('title')).toBe('King James Version');
        expect((titleSpan as HTMLElement | null)?.style.fontFamily).toBe(
            'BibleFont',
        );

        await act(async () => {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await Promise.resolve();
        });

        const menuItems = mocks.showAppContextMenuMock.mock.calls.at(
            -1,
        )?.[1] as MenuItemType[];
        expect(menuItems[1]?.title).toBe('English Standard Version');
        menuItems[1]?.onSelect?.('event-3');
        expect(onBibleKeyChange).toHaveBeenCalledWith('KJV', 'ESV');
    });

    test('renders the mini selector in clickable and passive modes', async () => {
        const onBibleKeyChange = vi.fn();

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <BibleKeySelectionMiniComp
                    bibleKey="KJV"
                    contextMenuTitle="Choose translation"
                    extraStyle={{ color: 'red' }}
                    isMinimal
                    onBibleKeyChange={onBibleKeyChange}
                />,
            );
        });

        const activeSpan = container?.querySelector<HTMLElement>(
            'span.bible-selector',
        );
        expect(activeSpan?.className).toContain('pointer');
        expect(activeSpan?.className).toContain('bg-info');
        expect(activeSpan?.style.paddingLeft).toBe('2px');
        expect(activeSpan?.style.color).toBe('red');

        await act(async () => {
            activeSpan?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            await Promise.resolve();
        });

        let menuItems = mocks.showAppContextMenuMock.mock.calls.at(
            -1,
        )?.[1] as MenuItemType[];
        expect(menuItems[0]?.menuElement.props.children).toBe('Language en-US');
        menuItems[1]?.onSelect?.('event-4');
        expect(onBibleKeyChange).toHaveBeenCalledWith(false, 'KJV', 'ESV');

        await act(async () => {
            activeSpan?.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
            await Promise.resolve();
        });

        menuItems = mocks.showAppContextMenuMock.mock.calls.at(
            -1,
        )?.[1] as MenuItemType[];
        expect(menuItems[0]?.menuElement).toBe('Choose translation');
        menuItems[3]?.onSelect?.('event-5');
        expect(onBibleKeyChange).toHaveBeenCalledWith(true, 'KJV', 'ESV');

        await act(async () => {
            root?.render(<BibleKeySelectionMiniComp bibleKey="WEB" />);
        });

        const passiveSpan = container?.querySelector<HTMLElement>(
            'span.bible-selector',
        );
        expect(passiveSpan?.className).not.toContain('pointer');
        expect(passiveSpan?.className).toContain(
            'badge rounded-pill text-bg-info',
        );
        expect(passiveSpan?.style.paddingLeft).toBe('6px');

        const callCount = mocks.showAppContextMenuMock.mock.calls.length;
        await act(async () => {
            passiveSpan?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            passiveSpan?.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
            await Promise.resolve();
        });
        expect(mocks.showAppContextMenuMock).toHaveBeenCalledTimes(callCount);
    });
});
