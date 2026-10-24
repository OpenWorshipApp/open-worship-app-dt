// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DESKTOP_DIR = 'C:\\Users\\me\\Desktop\\open-worship-data';

const h = vi.hoisted(() => ({
    dataDirPath: '',
    isOnOwnFolder: false,
    isHidden: false,
    askToMove: vi.fn(async (_dirPath: string, _isAskedFor: boolean) => {}),
    hide: vi.fn(),
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME: 'data-dir-move-hide-changed',
    appLocalStorage: {
        get isOnOwnFolder() {
            return h.isOnOwnFolder;
        },
        get defaultStorageDirPath() {
            return h.dataDirPath;
        },
    },
}));
vi.mock('../server/appProvider', () => ({
    default: { isPageSetting: false },
}));
vi.mock('../server/fileHelpers', () => ({
    checkIsDesktopDataDir: (dirPath: string) => {
        return dirPath === 'C:\\Users\\me\\Desktop\\open-worship-data';
    },
}));
vi.mock('../setting/directory-setting/dataDirMoveHelpers', () => ({
    checkIsDataDirMoveHidden: () => h.isHidden,
    hideDataDirMoveForAWhile: h.hide,
}));
vi.mock('../setting/directory-setting/dataDirMoveAskHelpers', () => ({
    askToMoveDesktopDataDir: h.askToMove,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: React.useEffect,
    };
});

import DesktopDataDirCardComp from './DesktopDataDirCardComp';

let root: Root;
let container: HTMLDivElement;

async function render() {
    await act(async () => root.render(createElement(DesktopDataDirCardComp)));
    // The 30-day hide is read by a lazy import.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function pressButton(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (one) => one.textContent?.includes(text),
    );
    expect(button).toBeDefined();
    return act(async () => {
        button!.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.dataDirPath = DESKTOP_DIR;
    h.isOnOwnFolder = false;
    h.isHidden = false;
    h.askToMove.mockClear();
    h.hide.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('the Desktop data folder card', () => {
    it('is in the window while the folder in use is on the Desktop', async () => {
        await render();
        expect(container.textContent).toContain(
            'Move Your Data Folder Off the Desktop',
        );
        expect(container.textContent).toContain(DESKTOP_DIR);
    });

    it('is not there for a folder elsewhere, none, or the question put away', async () => {
        h.dataDirPath = 'C:\\Users\\me\\.owa\\open-worship-data';
        await render();
        expect(container.textContent).toBe('');

        await act(async () => root.unmount());
        root = createRoot(container);
        h.dataDirPath = DESKTOP_DIR;
        h.isOnOwnFolder = true;
        await render();
        expect(container.textContent).toBe('');

        await act(async () => root.unmount());
        root = createRoot(container);
        h.isOnOwnFolder = false;
        h.isHidden = true;
        await render();
        expect(container.textContent).toBe('');
    });

    it('Move Now asks the move question, as a press asks it', async () => {
        await render();
        await pressButton('Move Now');
        expect(h.askToMove).toHaveBeenCalledExactlyOnceWith(DESKTOP_DIR, true);
    });

    it('goes when the start-up question is put away in this window', async () => {
        await render();
        expect(container.textContent).toContain('Move Now');
        // The question's own Hide for 30 days says so to the window.
        h.isHidden = true;
        await act(async () => {
            globalThis.dispatchEvent(new Event('data-dir-move-hide-changed'));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(container.textContent).toBe('');
    });

    it('comes back when the hide is taken off, read as the window comes to the front', async () => {
        h.isHidden = true;
        await render();
        expect(container.textContent).toBe('');
        h.isHidden = false;
        await act(async () => {
            globalThis.dispatchEvent(new Event('focus'));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(container.textContent).toContain('Move Now');
    });

    it('the ✕ closes it for this window, and a focus does not bring it back', async () => {
        await render();
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.btn-close')!.click();
        });
        expect(container.textContent).toBe('');
        await act(async () => {
            globalThis.dispatchEvent(new Event('focus'));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(container.textContent).toBe('');
    });

    it('Hide for 30 days puts it away with the start-up question', async () => {
        await render();
        await pressButton('Hide for 30 days');
        expect(h.hide).toHaveBeenCalledOnce();
        expect(container.textContent).toBe('');
    });
});
