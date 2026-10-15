// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isMac: false } },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => name,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/settingHelpers', () => ({
    toFilePathSettingName: (prefix: string, path: string) =>
        `${prefix}:${path}`,
}));

import {
    checkHandleOpenSlidesPreviewClicking,
    checkIsAppDocumentPreviewOpened,
    closeAppDocumentPreviewFloating,
    DEFAULT_PREVIEW_THUMBNAIL_SCALE,
    genOpenSlidesPreviewContextMenu,
    openAppDocumentPreviewFloating,
    OPEN_SLIDES_PREVIEW_SHORTCUT_LABEL,
    toAppDocumentPreviewRectSettingName,
    toAppDocumentPreviewScaleSettingName,
    toggleAppDocumentPreviewFloating,
    useIsAppDocumentPreviewOpened,
    useOpenedAppDocumentPreviewFilePaths,
} from './appDocumentPreviewFloatingHelpers';
import {
    MIN_THUMBNAIL_SCALE,
    THUMBNAIL_WIDTH_SETTING_NAME,
} from './appDocumentTypeHelpers';

const FIRST = 'C:/documents/first.owa';
const SECOND = 'C:/documents/second.pdf';
let container: HTMLDivElement;
let root: Root;

function PreviewStatusComp() {
    const all = useOpenedAppDocumentPreviewFilePaths();
    const first = useIsAppDocumentPreviewOpened(FIRST);
    const second = useIsAppDocumentPreviewOpened(SECOND);
    return createElement('div', {}, `${all.join('|')} / ${first} / ${second}`);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    closeAppDocumentPreviewFloating(FIRST);
    closeAppDocumentPreviewFloating(SECOND);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    closeAppDocumentPreviewFloating(FIRST);
    closeAppDocumentPreviewFloating(SECOND);
    container.remove();
    vi.unstubAllGlobals();
});

describe('floating document preview state', () => {
    it('tracks several files and updates subscribers on open, close and toggle', async () => {
        await act(async () => root.render(createElement(PreviewStatusComp)));
        expect(container.textContent).toBe(' / false / false');
        await act(async () => openAppDocumentPreviewFloating(FIRST));
        expect(container.textContent).toBe(`${FIRST} / true / false`);
        await act(async () => openAppDocumentPreviewFloating(FIRST));
        expect(container.textContent).toBe(`${FIRST} / true / false`);
        await act(async () => toggleAppDocumentPreviewFloating(SECOND));
        expect(container.textContent).toBe(`${FIRST}|${SECOND} / true / true`);
        await act(async () => closeAppDocumentPreviewFloating(FIRST));
        expect(container.textContent).toBe(`${SECOND} / false / true`);
        await act(async () => toggleAppDocumentPreviewFloating(SECOND));
        expect(container.textContent).toBe(' / false / false');
    });

    it('exposes per-file setting names and the standard thumbnail scale', () => {
        expect(toAppDocumentPreviewRectSettingName(FIRST)).toBe(
            `app-document-preview-rect:${FIRST}`,
        );
        expect(toAppDocumentPreviewScaleSettingName(FIRST)).toBe(
            `${THUMBNAIL_WIDTH_SETTING_NAME}:${FIRST}`,
        );
        expect(DEFAULT_PREVIEW_THUMBNAIL_SCALE).toBe(MIN_THUMBNAIL_SCALE + 10);
        expect(OPEN_SLIDES_PREVIEW_SHORTCUT_LABEL).toBe('Ctrl + Click');
    });

    it('disables the menu action for a document already in the main previewer', () => {
        const selected = genOpenSlidesPreviewContextMenu(FIRST, true);
        expect(selected.disabled).toBe(true);
        expect(selected.title).toBe('Already showing in the main previewer');
        const other = genOpenSlidesPreviewContextMenu(SECOND, false);
        expect(other.disabled).toBe(false);
        expect(other.title).toContain('Ctrl + Click');
        other.onSelect?.(new MouseEvent('click'));
        expect(checkIsAppDocumentPreviewOpened(SECOND)).toBe(true);
    });

    it('consumes modified clicks and leaves selected documents in the main previewer', () => {
        expect(checkHandleOpenSlidesPreviewClicking({}, FIRST, false)).toBe(
            false,
        );
        expect(
            checkHandleOpenSlidesPreviewClicking(undefined, FIRST, false),
        ).toBe(false);
        expect(
            checkHandleOpenSlidesPreviewClicking(
                { ctrlKey: true },
                FIRST,
                true,
            ),
        ).toBe(true);
        expect(checkIsAppDocumentPreviewOpened(FIRST)).toBe(false);
        expect(
            checkHandleOpenSlidesPreviewClicking(
                { ctrlKey: true },
                FIRST,
                false,
            ),
        ).toBe(true);
        expect(checkIsAppDocumentPreviewOpened(FIRST)).toBe(true);
        expect(
            checkHandleOpenSlidesPreviewClicking(
                { metaKey: true },
                FIRST,
                false,
            ),
        ).toBe(true);
        expect(checkIsAppDocumentPreviewOpened(FIRST)).toBe(false);
    });
});
