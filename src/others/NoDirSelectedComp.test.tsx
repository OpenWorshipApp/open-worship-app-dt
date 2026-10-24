// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isOnOwnFolder: false,
    openPathSetting: vi.fn(),
    selectDefaultDataDirName: vi.fn(),
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get isOnOwnFolder() {
            return h.isOnOwnFolder;
        },
    },
}));
vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    selectDefaultDataDirName: h.selectDefaultDataDirName,
}));
vi.mock('../setting/settingHelpers', () => ({
    openPathSetting: h.openPathSetting,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import NoDirSelectedComp from './NoDirSelectedComp';

let root: Root;
let container: HTMLDivElement;
const dirSource = { dirPath: '', settingName: 'select-dir-bible-read' };

async function render() {
    await act(async () =>
        root.render(
            createElement(NoDirSelectedComp, {
                dirSource: dirSource as any,
                defaultFolderName: 'bibles-read',
            }),
        ),
    );
}

function buttonTexts() {
    return Array.from(container.querySelectorAll('button')).map((button) => {
        return button.textContent?.trim();
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.isOnOwnFolder = false;
    h.openPathSetting.mockClear();
    h.selectDefaultDataDirName.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('a panel with no folder', () => {
    it('offers its default folder inside the data folder in use', async () => {
        await render();
        expect(container.textContent).toContain('No directory selected');
        expect(buttonTexts()).toEqual([
            'Select Default "bibles-read"',
            'Go to Settings',
        ]);
    });

    it('with no data folder, says so and only leads to choosing one', async () => {
        h.isOnOwnFolder = true;
        await render();
        expect(container.textContent).toContain('No Parent Directory Selected');
        // A default folder cannot be made inside a data folder there is not.
        expect(buttonTexts()).toEqual(['Go to Settings']);
        await act(async () => container.querySelector('button')!.click());
        expect(h.openPathSetting).toHaveBeenCalledOnce();
        expect(h.selectDefaultDataDirName).not.toHaveBeenCalled();
    });
});
