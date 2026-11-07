// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    screenManagers: [] as any[],
    selectedBases: [] as any[],
    handleError: vi.fn(),
    showAppContextMenu: vi.fn(),
    getValidOnScreen: vi.fn(),
    provider: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        appUtils: { handleError: () => {} },
        messageUtils: { sendData: () => {} },
    },
}));

vi.mock('../../server/appProvider', () => ({ default: h.provider }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? '',
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../managers/screenManagerBaseHelpers', () => ({
    getSelectedScreenManagerBases: () => h.selectedBases,
    getValidOnScreen: (data: unknown) => h.getValidOnScreen(data),
}));
vi.mock('../managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.screenManagers,
}));
vi.mock('../../app-document-list/Slide', () => ({
    default: class Slide {
        static validate(json: any) {
            if (json?.kind !== 'slide') {
                throw new Error('Invalid slide');
            }
        }
    },
}));
vi.mock('../../app-document-list/PdfSlide', () => ({
    default: class PdfSlide {
        static tryValidate(json: any) {
            return json?.kind === 'pdf';
        }
    },
}));
vi.mock('../../app-document-list/PptxSlide', () => ({
    default: class PptxSlide {
        static tryValidate(json: any) {
            return json?.kind === 'pptx';
        }
    },
}));
vi.mock('../../app-document-list/DocxSlide', () => ({
    default: class DocxSlide {
        static tryValidate(json: any) {
            return json?.kind === 'docx';
        }
    },
}));

import {
    getAppDocumentListOnScreenSetting,
    openContextMenu,
} from './screenPreviewerHelpers';
import { screenManagerSettingNames } from '../../helper/constants';

function genScreen(screenId: number, isSelected = false) {
    return {
        screenId,
        isSelected,
        delete: vi.fn(async () => {}),
        fireRefreshEvent: vi.fn(),
        screenLongTextManager: {
            screenViewData: null as any,
            isShowingLongText: false,
            isLineSync: false,
        },
    };
}

function openFor(screen: any) {
    const event = new MouseEvent('contextmenu');
    openContextMenu(event, screen);
    const [menuEvent, items] = h.showAppContextMenu.mock.calls.at(-1)!;
    expect(menuEvent).toBe(event);
    return items as any[];
}

function item(items: any[], label: string) {
    const found = items.find((menuItem) => menuItem.menuElement === label);
    if (found === undefined) {
        throw new Error(`Missing menu item: ${label}`);
    }
    return found;
}

describe('a screen card menu', () => {
    beforeEach(() => {
        h.screenManagers = [];
        h.selectedBases = [];
    });

    test('with several screens: Solo, Select, Delete and Refresh, each doing its job', async () => {
        const first = genScreen(1, true);
        const target = genScreen(2);
        const third = genScreen(3, true);
        h.screenManagers = [first, target, third];
        h.selectedBases = [first, third];
        const items = openFor(target);
        expect(items.map((menuItem) => menuItem.menuElement)).toEqual([
            'Solo',
            'Select',
            'Delete',
            'Refresh Preview',
        ]);
        expect(items[1].childBefore.props.className).toBe('bi bi-check-square');
        expect(items[2].childBefore.props.style.color).toBe('var(--bs-danger)');

        item(items, 'Solo').onSelect();
        expect([first.isSelected, target.isSelected, third.isSelected]).toEqual(
            [false, true, false],
        );

        item(items, 'Select').onSelect();
        expect(target.isSelected).toBe(false);

        // A failed delete goes to the app's error handler, not an unhandled
        // rejection.
        const error = new Error('settings write failed');
        target.delete.mockRejectedValue(error);
        item(items, 'Delete').onSelect();
        expect(target.delete).toHaveBeenCalledTimes(1);
        await Promise.resolve();
        await Promise.resolve();
        expect(h.handleError).toHaveBeenCalledWith(error);

        item(items, 'Refresh Preview').onSelect();
        for (const screen of [first, target, third]) {
            expect(screen.fireRefreshEvent).toHaveBeenCalledTimes(1);
        }
    });

    test('the solo screen has no Solo row, and reads Deselect', () => {
        const solo = genScreen(1, true);
        h.screenManagers = [solo, genScreen(2)];
        const items = openFor(solo);
        expect(items.map((menuItem) => menuItem.menuElement)).toEqual([
            'Deselect',
            'Delete',
            'Refresh Preview',
        ]);
        expect(items[0].childBefore.props.className).toBe('bi bi-square');
    });

    test('the only screen can only be refreshed', () => {
        const only = genScreen(1);
        h.screenManagers = [only];
        const items = openFor(only);
        expect(items.map((menuItem) => menuItem.menuElement)).toEqual([
            'Refresh Preview',
        ]);
    });

    test('Line Sync is offered for a Bible on screen, never for a long text', () => {
        const screen = genScreen(1);
        h.screenManagers = [screen];
        screen.screenLongTextManager.screenViewData = { bibleItemData: {} };
        let items = openFor(screen);
        expect(items.map((menuItem) => menuItem.menuElement)).toEqual([
            'Set Line Sync',
            'Refresh Preview',
        ]);
        item(items, 'Set Line Sync').onSelect();
        expect(screen.screenLongTextManager.isLineSync).toBe(true);
        items = openFor(screen);
        item(items, 'Unset Line Sync').onSelect();
        expect(screen.screenLongTextManager.isLineSync).toBe(false);

        // A long text is row by row whatever this says.
        screen.screenLongTextManager.isShowingLongText = true;
        expect(openFor(screen).map((menuItem) => menuItem.menuElement)).toEqual(
            ['Refresh Preview'],
        );
        // Nothing on the layer: no row either.
        screen.screenLongTextManager.isShowingLongText = false;
        screen.screenLongTextManager.screenViewData = null;
        expect(openFor(screen).map((menuItem) => menuItem.menuElement)).toEqual(
            ['Refresh Preview'],
        );
    });
});

describe('getAppDocumentListOnScreenSetting', () => {
    // The reader memoizes on the RAW setting strings, so every case writes
    // strings of its own.
    let caseId = 0;
    function setOnScreen(value: unknown) {
        caseId++;
        h.settings.set(screenManagerSettingNames.MANAGERS, `[${caseId}]`);
        h.settings.set(
            screenManagerSettingNames.VARY_APP_DOCUMENT,
            typeof value === 'string' ? value : JSON.stringify(value),
        );
    }

    beforeEach(() => {
        h.getValidOnScreen.mockImplementation((data: unknown) => data);
    });

    test('drops only the invalid entries, and says which', () => {
        const valid = {
            1: { filePath: '/a.slide', itemJson: { kind: 'slide', id: 1 } },
            2: { filePath: '/b.pdf', itemJson: { kind: 'pdf' } },
            5: { filePath: '/c.pptx', itemJson: { kind: 'pptx' } },
            6: { filePath: '/d.docx', itemJson: { kind: 'docx' } },
        };
        setOnScreen({
            ...valid,
            3: { filePath: 5, itemJson: { kind: 'slide' } },
            4: { filePath: '/e.slide', itemJson: { kind: 'broken' } },
        });
        expect(getAppDocumentListOnScreenSetting()).toEqual(valid);
        expect(h.getValidOnScreen).toHaveBeenCalledWith(valid);
        expect(
            h.handleError.mock.calls.map(([error]) => {
                return (error as Error).message;
            }),
        ).toEqual([
            'Dropping invalid on-screen slide entry for screen id: 3',
            'Dropping invalid on-screen slide entry for screen id: 4',
        ]);
    });

    test('hands out a copy, so one caller cannot corrupt the next read', () => {
        setOnScreen({
            1: { filePath: '/a.slide', itemJson: { kind: 'slide' } },
        });
        const first = getAppDocumentListOnScreenSetting();
        delete (first as any)[1];
        expect(Object.keys(getAppDocumentListOnScreenSetting())).toEqual(['1']);
        // Derived once for both reads.
        expect(h.getValidOnScreen).toHaveBeenCalledTimes(1);
    });

    test('nothing saved, or something unreadable, is an empty map', () => {
        setOnScreen('');
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        setOnScreen('{not json');
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        expect(h.getValidOnScreen).not.toHaveBeenCalled();
    });

    test('a failure while filtering is reported and reads as empty', () => {
        const error = new Error('no screens');
        h.getValidOnScreen.mockImplementation(() => {
            throw error;
        });
        setOnScreen({
            1: { filePath: '/a.slide', itemJson: { kind: 'slide' } },
        });
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});
