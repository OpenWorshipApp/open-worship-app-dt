import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    liveScreenIds: [] as number[],
    getValidOnScreenError: null as null | Error,
    selectedBases: [] as any[],
    allScreenManagers: [] as any[],
    menuCalls: [] as { event: any; items: any[] }[],
    handleError: vi.fn(),
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name),
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../helper/helpers', () => ({
    parseJsonSafely: (json: any) => {
        if (!json) {
            return null;
        }
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    },
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: any, items: any[]) => {
        h.menuCalls.push({ event, items });
    },
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string, style?: object) => {
        return style === undefined ? `icon:${name}` : { name, style };
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../managers/screenManagerBaseHelpers', () => ({
    getSelectedScreenManagerBases: () => h.selectedBases,
    // The real filter: only screens that still exist keep their entry.
    getValidOnScreen: (data: { [key: string]: any }) => {
        if (h.getValidOnScreenError !== null) {
            throw h.getValidOnScreenError;
        }
        return Object.fromEntries(
            Object.entries(data).filter(([key]) => {
                return h.liveScreenIds.includes(Number.parseInt(key));
            }),
        );
    },
}));
vi.mock('../managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.allScreenManagers,
}));
// A slide is valid when its `id` is a number; each office kind is told
// apart by `kind`.
vi.mock('../../app-document-list/Slide', () => ({
    default: {
        validate: (item: any) => {
            if (typeof item?.id !== 'number') {
                throw new Error('Invalid slide');
            }
        },
    },
}));
vi.mock('../../app-document-list/PdfSlide', () => ({
    default: { tryValidate: (item: any) => item?.kind === 'pdf' },
}));
vi.mock('../../app-document-list/PptxSlide', () => ({
    default: { tryValidate: (item: any) => item?.kind === 'pptx' },
}));
vi.mock('../../app-document-list/DocxSlide', () => ({
    default: { tryValidate: (item: any) => item?.kind === 'docx' },
}));

import { screenManagerSettingNames } from '../../helper/constants';
import {
    getAppDocumentListOnScreenSetting,
    openContextMenu,
} from './screenPreviewerHelpers';

function setOnScreen(map: object | string) {
    h.settings.set(
        screenManagerSettingNames.VARY_APP_DOCUMENT,
        typeof map === 'string' ? map : JSON.stringify(map),
    );
    // A new MANAGERS string invalidates the memo even when the map's own
    // string is unchanged.
    h.settings.set(
        screenManagerSettingNames.MANAGERS,
        JSON.stringify(h.liveScreenIds),
    );
}

function createScreenManager(
    screenId: number,
    {
        isSelected = false,
        screenViewData = null as any,
        isShowingLongText = false,
        isLineSync = false,
    } = {},
) {
    return {
        screenId,
        isSelected,
        delete: vi.fn(async () => {}),
        fireRefreshEvent: vi.fn(),
        screenLongTextManager: {
            screenViewData,
            isShowingLongText,
            isLineSync,
        },
    };
}

function getMenu() {
    return h.menuCalls.at(-1)!.items;
}

function getLabels() {
    return getMenu().map((item: any) => {
        return item.menuElement;
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    h.settings.clear();
    h.liveScreenIds = [0, 1, 2];
    h.getValidOnScreenError = null;
    h.selectedBases = [];
    h.allScreenManagers = [];
    h.menuCalls.length = 0;
});

afterEach(() => {
    vi.useRealTimers();
});

describe('getAppDocumentListOnScreenSetting', () => {
    test('one invalid entry is dropped alone, never the whole map', () => {
        setOnScreen({
            0: { filePath: '/a.slide', itemJson: { id: 1 } },
            1: { filePath: '/b.slide', itemJson: { broken: true } },
            2: { filePath: '/c.pdf', itemJson: { kind: 'pdf' } },
        });
        const map = getAppDocumentListOnScreenSetting();
        expect(Object.keys(map).sort()).toEqual(['0', '2']);
        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(h.handleError.mock.calls[0][0].message).toBe(
            'Dropping invalid on-screen slide entry for screen id: 1',
        );
    });

    test('an entry with no file path is invalid', () => {
        setOnScreen({
            0: { itemJson: { id: 1 } },
            1: { filePath: '/b.pptx', itemJson: { kind: 'pptx' } },
            2: { filePath: '/c.docx', itemJson: { kind: 'docx' } },
        });
        expect(Object.keys(getAppDocumentListOnScreenSetting()).sort()).toEqual(
            ['1', '2'],
        );
    });

    test('drops the entries of screens that no longer exist', () => {
        h.liveScreenIds = [0];
        setOnScreen({
            0: { filePath: '/a.slide', itemJson: { id: 1 } },
            5: { filePath: '/b.slide', itemJson: { id: 2 } },
        });
        expect(Object.keys(getAppDocumentListOnScreenSetting())).toEqual(['0']);
    });

    test('hands out a copy: a caller editing its map cannot corrupt the next read', () => {
        setOnScreen({ 0: { filePath: '/a.slide', itemJson: { id: 1 } } });
        const first = getAppDocumentListOnScreenSetting();
        delete (first as any)[0];
        (first as any)[9] = { filePath: '/x.slide', itemJson: { id: 9 } };

        const second = getAppDocumentListOnScreenSetting();
        expect(Object.keys(second)).toEqual(['0']);
        expect(second).not.toBe(first);
    });

    test('parses once per setting string, again when it changes', () => {
        const raw = JSON.stringify({
            0: { filePath: '/a.slide', itemJson: { id: 1 } },
            1: { filePath: '/b.slide', itemJson: { bad: 1 } },
        });
        setOnScreen(raw);
        getAppDocumentListOnScreenSetting();
        getAppDocumentListOnScreenSetting();
        // The invalid entry is reported by the one parse, not per read.
        expect(h.handleError).toHaveBeenCalledTimes(1);

        setOnScreen({
            1: { filePath: '/b.slide', itemJson: { bad: 2 } },
        });
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        expect(h.handleError).toHaveBeenCalledTimes(2);
    });

    test('an empty or unreadable setting reads as no slide anywhere', () => {
        setOnScreen('');
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        setOnScreen('{not json');
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a failure while validating reports it and reads as empty', () => {
        h.getValidOnScreenError = new Error('settings gone');
        setOnScreen({ 0: { filePath: '/a.slide', itemJson: { id: 1 } } });
        expect(getAppDocumentListOnScreenSetting()).toEqual({});
        expect(h.handleError).toHaveBeenCalledWith(h.getValidOnScreenError);
    });
});

describe('openContextMenu', () => {
    test('a lone screen gets refresh only', () => {
        const screenManager = createScreenManager(0);
        h.allScreenManagers = [screenManager];
        openContextMenu({}, screenManager as any);
        expect(getLabels()).toEqual(['Refresh Preview']);

        getMenu()[0].onSelect();
        expect(screenManager.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });

    test('with several screens: solo, select and delete', () => {
        const first = createScreenManager(0, { isSelected: true });
        const second = createScreenManager(1);
        h.allScreenManagers = [first, second];
        h.selectedBases = [first];
        openContextMenu({}, second as any);
        expect(getLabels()).toEqual([
            'Solo',
            'Select',
            'Delete',
            'Refresh Preview',
        ]);
        expect(getMenu()[1].childBefore).toBe('icon:check-square');
        expect(getMenu()[2].childBefore).toEqual({
            name: 'trash3',
            style: { color: 'var(--bs-danger)' },
        });

        // Solo deselects every selected screen and selects this one.
        getMenu()[0].onSelect();
        expect(first.isSelected).toBe(false);
        expect(second.isSelected).toBe(true);
    });

    test('a screen already solo is offered no Solo, and Deselect', () => {
        const first = createScreenManager(0, { isSelected: true });
        const second = createScreenManager(1);
        h.allScreenManagers = [first, second];
        openContextMenu({}, first as any);
        expect(getLabels()).toEqual(['Deselect', 'Delete', 'Refresh Preview']);
        expect(getMenu()[0].childBefore).toBe('icon:square');

        getMenu()[0].onSelect();
        expect(first.isSelected).toBe(false);
    });

    test('delete routes a failed settings sweep to the error handler', async () => {
        const first = createScreenManager(0);
        const second = createScreenManager(1);
        const failure = new Error('write failed');
        second.delete.mockRejectedValueOnce(failure);
        h.allScreenManagers = [first, second];
        openContextMenu({}, second as any);
        const deleteItem = getMenu().find((item: any) => {
            return item.menuElement === 'Delete';
        });
        deleteItem.onSelect();
        expect(second.delete).toHaveBeenCalledTimes(1);
        await vi.waitFor(() => {
            expect(h.handleError).toHaveBeenCalledWith(failure);
        });
    });

    test('a screen showing a Bible passage can toggle line sync', () => {
        const screenManager = createScreenManager(0, {
            screenViewData: { bibleItemData: {} },
        });
        h.allScreenManagers = [screenManager];
        openContextMenu({}, screenManager as any);
        expect(getLabels()).toEqual(['Set Line Sync', 'Refresh Preview']);
        getMenu()[0].onSelect();
        expect(screenManager.screenLongTextManager.isLineSync).toBe(true);

        openContextMenu({}, screenManager as any);
        expect(getLabels()[0]).toBe('Unset Line Sync');
        getMenu()[0].onSelect();
        expect(screenManager.screenLongTextManager.isLineSync).toBe(false);
    });

    test('a long text is offered no line sync', () => {
        const screenManager = createScreenManager(0, {
            screenViewData: { type: 'long-text' },
            isShowingLongText: true,
        });
        h.allScreenManagers = [screenManager];
        openContextMenu({}, screenManager as any);
        expect(getLabels()).toEqual(['Refresh Preview']);
    });

    test('refresh reaches every screen, not just the one clicked', () => {
        const first = createScreenManager(0);
        const second = createScreenManager(1);
        h.allScreenManagers = [first, second];
        openContextMenu({}, first as any);
        getMenu().at(-1).onSelect();
        expect(first.fireRefreshEvent).toHaveBeenCalledTimes(1);
        expect(second.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });
});
