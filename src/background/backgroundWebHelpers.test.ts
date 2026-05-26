import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    fsWriteFileMock,
    getOpenSharedLinkMenuItemMock,
    openPopupWindowMock,
    fileSourceGetInstanceMock,
    showAppInputMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    fsWriteFileMock: vi.fn(),
    getOpenSharedLinkMenuItemMock: vi.fn((sharedKey: string) => ({
        menuElement: 'Open Shared Link',
        title: `https://www.openworship.app/shared#${sharedKey}`,
        onSelect: vi.fn(),
    })),
    openPopupWindowMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    showAppInputMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../helper/domHelpers', () => ({
    openPopupWindow: openPopupWindowMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: showAppInputMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        webEditorHomePage: 'https://editor.openworship.app',
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsWriteFile: fsWriteFileMock,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('./downloadHelper', () => ({
    getOpenSharedLinkMenuItem: getOpenSharedLinkMenuItemMock,
}));

import {
    genBackgroundWebContextMenuItems,
    genBackgroundWebExtraItemContextMenuItems,
    genNewFileNameInput,
} from './backgroundWebHelpers';

describe('backgroundWebHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

    test('builds a file name input element that forwards changes', () => {
        const onChange = vi.fn();

        const input = genNewFileNameInput('welcome', onChange);

        expect(input.props.defaultValue).toBe('welcome');

        input.props.onChange({
            target: { value: 'updated' },
        });

        expect(onChange).toHaveBeenCalledWith('updated');
    });

    test('creates a new default HTML file when a unique name is confirmed', async () => {
        const dirSource = {
            getAllFileFullNames: vi.fn().mockResolvedValue(['Existing.html']),
            getFileSourceInstance: vi.fn().mockReturnValue({
                filePath: '/web/Welcome.html',
            }),
        };
        showAppInputMock.mockImplementation(
            async (_title: string, input: any) => {
                input.props.onChange({ target: { value: 'Welcome' } });
                return true;
            },
        );

        const menuItems = genBackgroundWebContextMenuItems(dirSource as any);

        await menuItems[0]?.onSelect();

        expect(dirSource.getAllFileFullNames).toHaveBeenCalledTimes(1);
        expect(dirSource.getFileSourceInstance).toHaveBeenCalledWith(
            'Welcome.html',
        );
        expect(fsWriteFileMock).toHaveBeenCalledWith(
            '/web/Welcome.html',
            expect.stringContaining('<title>Welcome.html</title>'),
        );
    });

    test('skips file creation when the prompt is cancelled or blank', async () => {
        const dirSource = {
            getAllFileFullNames: vi.fn(),
            getFileSourceInstance: vi.fn(),
        };
        showAppInputMock.mockResolvedValueOnce(false);
        showAppInputMock.mockImplementationOnce(
            async (_title: string, input: any) => {
                input.props.onChange({ target: { value: '   ' } });
                return true;
            },
        );

        await genBackgroundWebContextMenuItems(dirSource as any)[0]?.onSelect();
        await genBackgroundWebContextMenuItems(dirSource as any)[0]?.onSelect();

        expect(dirSource.getAllFileFullNames).not.toHaveBeenCalled();
        expect(fsWriteFileMock).not.toHaveBeenCalled();
    });

    test('shows a toast instead of overwriting an existing web file', async () => {
        const dirSource = {
            getAllFileFullNames: vi.fn().mockResolvedValue(['Existing.html']),
            getFileSourceInstance: vi.fn(),
        };
        showAppInputMock.mockImplementation(
            async (_title: string, input: any) => {
                input.props.onChange({ target: { value: 'Existing' } });
                return true;
            },
        );

        await genBackgroundWebContextMenuItems(dirSource as any)[0]?.onSelect();

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Create New Web File',
            'File already exists',
        );
        expect(dirSource.getFileSourceInstance).not.toHaveBeenCalled();
        expect(fsWriteFileMock).not.toHaveBeenCalled();
    });

    test('opens the popup web editor for the selected file', () => {
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234);
        const randomUuidSpy = vi
            .spyOn(globalThis.crypto, 'randomUUID')
            .mockReturnValue('popup-uuid');
        fileSourceGetInstanceMock.mockReturnValue({
            fullName: 'My Page.html',
        });

        const menuItem =
            genBackgroundWebExtraItemContextMenuItems('/web/My Page.html')[0];
        menuItem?.onSelect();

        expect(openPopupWindowMock).toHaveBeenCalledWith(
            'https://editor.openworship.app?file=My%20Page.html',
            'My Page.html_1234',
            'popup-uuid',
        );

        randomUuidSpy.mockRestore();
        dateNowSpy.mockRestore();
    });
});
