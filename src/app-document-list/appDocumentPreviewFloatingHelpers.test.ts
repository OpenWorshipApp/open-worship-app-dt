// @vitest-environment jsdom
// jsdom because `settingHelpers` pulls in `appProvider`, which touches
// `document` at module scope.

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => name,
}));

import {
    checkHandleOpenSlidesPreviewClicking,
    checkIsAppDocumentPreviewOpened,
    closeAppDocumentPreviewFloating,
    genOpenSlidesPreviewContextMenu,
    openAppDocumentPreviewFloating,
    OPEN_SLIDES_PREVIEW_SHORTCUT_LABEL,
    toAppDocumentPreviewRectSettingName,
    toAppDocumentPreviewScaleSettingName,
    toggleAppDocumentPreviewFloating,
} from './appDocumentPreviewFloatingHelpers';

const FILE_PATH_1 = 'C:\\data\\documents\\a1.owd';
const FILE_PATH_2 = 'C:\\data\\documents\\a 2.owd';

describe('appDocumentPreviewFloatingHelpers', () => {
    beforeEach(() => {
        closeAppDocumentPreviewFloating(FILE_PATH_1);
        closeAppDocumentPreviewFloating(FILE_PATH_2);
    });

    test('opens one widget per file and closes only the asked one', () => {
        openAppDocumentPreviewFloating(FILE_PATH_1);
        openAppDocumentPreviewFloating(FILE_PATH_2);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(true);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_2)).toBe(true);

        closeAppDocumentPreviewFloating(FILE_PATH_1);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(false);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_2)).toBe(true);
    });

    test('opening twice and closing an unknown file are no-ops', () => {
        openAppDocumentPreviewFloating(FILE_PATH_1);
        openAppDocumentPreviewFloating(FILE_PATH_1);
        closeAppDocumentPreviewFloating('C:\\data\\documents\\never.owd');
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(true);
    });

    test('toggling flips the file it is given', () => {
        toggleAppDocumentPreviewFloating(FILE_PATH_1);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(true);
        toggleAppDocumentPreviewFloating(FILE_PATH_1);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(false);
    });

    test('setting names carry no path separators, dots or spaces', () => {
        for (const settingName of [
            toAppDocumentPreviewRectSettingName(FILE_PATH_2),
            toAppDocumentPreviewScaleSettingName(FILE_PATH_2),
        ]) {
            expect(settingName).not.toMatch(/[\\/:*?"<>|.\s]/);
        }
        // Two files must not collide on one key.
        expect(toAppDocumentPreviewRectSettingName(FILE_PATH_1)).not.toBe(
            toAppDocumentPreviewRectSettingName(FILE_PATH_2),
        );
        // The rect and the zoom of ONE file are separate keys.
        expect(toAppDocumentPreviewRectSettingName(FILE_PATH_1)).not.toBe(
            toAppDocumentPreviewScaleSettingName(FILE_PATH_1),
        );
    });

    test('the menu entry is disabled for the document already previewed', () => {
        const enabledItem = genOpenSlidesPreviewContextMenu(FILE_PATH_1, false);
        expect(enabledItem.disabled).toBe(false);
        // The tooltip is the only place the click shortcut is advertised.
        expect(enabledItem.title).toContain(OPEN_SLIDES_PREVIEW_SHORTCUT_LABEL);

        const disabledItem = genOpenSlidesPreviewContextMenu(FILE_PATH_1, true);
        expect(disabledItem.disabled).toBe(true);
        expect(disabledItem.title).toBe(
            'Already showing in the main previewer',
        );

        // Selecting the enabled one opens that file's widget.
        enabledItem.onSelect?.({} as any);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(true);
    });

    test('a plain click is left alone, a modified one toggles the widget', () => {
        expect(
            checkHandleOpenSlidesPreviewClicking({}, FILE_PATH_1, false),
        ).toBe(false);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(false);

        for (const event of [{ ctrlKey: true }, { metaKey: true }]) {
            expect(
                checkHandleOpenSlidesPreviewClicking(event, FILE_PATH_1, false),
            ).toBe(true);
        }
        // Twice: opened then closed again, like the menu entry.
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(false);
    });

    test('a modified click on the selected document opens nothing', () => {
        // Still consumed — the row must not fall back to plain selecting.
        expect(
            checkHandleOpenSlidesPreviewClicking(
                { ctrlKey: true },
                FILE_PATH_1,
                true,
            ),
        ).toBe(true);
        expect(checkIsAppDocumentPreviewOpened(FILE_PATH_1)).toBe(false);
    });
});
