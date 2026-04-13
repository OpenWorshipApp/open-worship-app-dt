import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getOpenSharedLinkMenuItemMock } = vi.hoisted(() => ({
    getOpenSharedLinkMenuItemMock: vi.fn((sharedKey: string) => ({
        menuElement: 'Open Shared Link',
        title: `https://www.openworship.app/shared#${sharedKey}`,
        onSelect: vi.fn(),
    })),
}));

vi.mock('../helper/domHelpers', () => ({
    openPopupWindow: vi.fn(),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        webEditorHomePage: 'https://editor.openworship.app',
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsWriteFile: vi.fn(),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('./downloadHelper', () => ({
    getOpenSharedLinkMenuItem: getOpenSharedLinkMenuItemMock,
}));

import { genBackgroundWebContextMenuItems } from './backgroundWebHelpers';

describe('backgroundWebHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('appends the shared webs link after extra menu items', () => {
        const addUrlItem = {
            menuElement: 'Add URL',
            onSelect: vi.fn(),
        };

        const menuItems = genBackgroundWebContextMenuItems({} as any, [
            addUrlItem,
        ]);

        expect(getOpenSharedLinkMenuItemMock).toHaveBeenCalledWith('webs');
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'New File',
            'Add URL',
            'Open Shared Link',
        ]);
        expect(menuItems[1]).toBe(addUrlItem);
        expect(menuItems[2]?.title).toBe(
            'https://www.openworship.app/shared#webs',
        );
    });
});
