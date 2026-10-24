// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    infoList: vi.fn(),
    getBibleInfo: vi.fn(),
    menu: vi.fn(),
    alert: vi.fn(),
    error: vi.fn(),
    openSettings: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: h.infoList,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: h.getBibleInfo,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: h.alert,
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: h.error,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    getLanguageTitle: ({ locale }: { locale: string }) => locale,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: 'divider',
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.menu,
}));
vi.mock('../setting/settingHelpers', () => ({
    openBibleSetting: h.openSettings,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'Test Serif',
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({
        onOpening,
        label,
    }: {
        onOpening: (event: MouseEvent) => void;
        label: string;
    }) =>
        createElement('button', {
            type: 'button',
            'aria-label': label,
            onClick: (event: MouseEvent) => {
                event.stopPropagation();
                onOpening(event);
            },
        }),
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            (event.currentTarget as HTMLElement).click();
        }
    },
}));

import BibleKeySelectionComp, {
    BibleKeySelectionMiniComp,
    genContextMenuBibleKeys,
    showBibleKeyOption,
} from './BibleKeySelectionComp';

let root: Root;
let container: HTMLDivElement;

async function renderMini(
    onBibleKeyChange?: (
        isContextMenu: boolean,
        oldKey: string,
        newKey: string,
    ) => void,
) {
    await act(async () =>
        root.render(
            createElement(BibleKeySelectionMiniComp, {
                bibleKey: 'en',
                onBibleKeyChange,
                contextMenuTitle: 'Add comparison Bible',
            }),
        ),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.infoList.mockReset().mockResolvedValue([
        { key: 'km', title: 'Khmer', locale: 'km-KH' },
        { key: 'en', title: 'English', locale: 'en-US' },
        { key: 'fr', title: 'French', locale: 'fr-FR' },
    ]);
    h.getBibleInfo.mockReset().mockResolvedValue({ title: 'English' });
    h.menu.mockClear();
    h.alert.mockClear();
    h.error.mockClear();
    h.openSettings.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Bible-key selection', () => {
    it('groups available Bibles by locale and excludes selected keys', async () => {
        const onSelect = vi.fn();
        const items = (await genContextMenuBibleKeys(onSelect, ['en']))!;
        expect(
            items.filter((item) => item.title).map((item) => item.title),
        ).toEqual(['fr-FR', '(fr) French', 'km-KH', '(km) Khmer']);
        const french = items.find((item) => item.title === '(fr) French')!;
        const event = new MouseEvent('click');
        french.onSelect!(event as any);
        expect(onSelect).toHaveBeenCalledWith(event, 'fr');
    });

    // GL-14: the real helper never resolves null -- a failure REJECTS -- so
    // the alert used to wait on a null that never came while the rejection
    // escaped and the menu silently did not open.
    it('alerts when installed Bible information cannot be loaded', async () => {
        const failure = new Error('bible folder unreadable');
        h.infoList.mockRejectedValue(failure);
        expect(await genContextMenuBibleKeys(vi.fn())).toBeNull();
        expect(h.alert).toHaveBeenCalledTimes(1);
        expect(h.alert).toHaveBeenCalledWith(
            'Unable to get bible info list',
            'We were sorry, but we are unable to get bible list at the ' +
                'moment please try again later',
        );
        expect(h.error).toHaveBeenCalledWith(failure);
        await expect(
            showBibleKeyOption(new MouseEvent('click'), vi.fn()),
        ).resolves.toBeUndefined();
        expect(h.alert).toHaveBeenCalledTimes(2);
        expect(h.menu).not.toHaveBeenCalled();
    });

    it('adds a menu title and an entry that opens Bible settings', async () => {
        const onSelect = vi.fn();
        const event = new MouseEvent('click');
        await showBibleKeyOption(event, onSelect, ['en'], 'Choose a Bible');
        const items = h.menu.mock.calls.at(-1)![1];
        expect(items[0]).toMatchObject({
            menuElement: 'Choose a Bible',
            isSectionHeader: true,
        });
        const french = items.find((item: any) => item.title === '(fr) French')!;
        french.onSelect(event);
        expect(onSelect).toHaveBeenCalledWith('fr', event);
        items.at(-1).onSelect();
        expect(h.openSettings).toHaveBeenCalledTimes(1);
    });

    it('changes the selected Bible through the main picker', async () => {
        const onChange = vi.fn();
        await act(async () =>
            root.render(
                createElement(BibleKeySelectionComp, {
                    bibleKey: 'en',
                    onBibleKeyChange: onChange,
                }),
            ),
        );
        expect(container.querySelector('button')?.textContent).toContain('en');
        expect(h.getBibleInfo).toHaveBeenCalledWith('en');
        await act(async () => container.querySelector('button')!.click());
        const items = h.menu.mock.calls.at(-1)![1];
        expect(items.some((item: any) => item.title === '(en) English')).toBe(
            false,
        );
        const french = items.find((item: any) => item.title === '(fr) French');
        await act(async () => french.onSelect(new MouseEvent('click')));
        expect(onChange).toHaveBeenCalledWith('en', 'fr');
    });

    it('separates replace and compare menus and supports keyboard activation', async () => {
        const onChange = vi.fn();
        await renderMini(onChange);
        const chip = container.querySelector<HTMLElement>('.bible-selector')!;
        expect(chip.getAttribute('role')).toBe('button');
        await act(async () =>
            chip.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                }),
            ),
        );
        let items = h.menu.mock.calls.at(-1)![1];
        await act(async () =>
            items
                .find((item: any) => item.title === '(fr) French')
                .onSelect(new MouseEvent('click')),
        );
        expect(onChange).toHaveBeenCalledWith(false, 'en', 'fr');
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Add comparison Bible"]',
                )!
                .click(),
        );
        items = h.menu.mock.calls.at(-1)![1];
        expect(items[0].menuElement).toBe('Add comparison Bible');
        await act(async () =>
            items
                .find((item: any) => item.title === '(km) Khmer')
                .onSelect(new MouseEvent('click')),
        );
        expect(onChange).toHaveBeenCalledWith(true, 'en', 'km');
    });
});
