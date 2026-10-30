// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const h = vi.hoisted(() => ({
    handleErrorMock: vi.fn(),
    handleSettingsExportingMock: vi.fn(),
    handleSettingsImportingMock: vi.fn(),
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => `t(${text})`,
}));

// Development: the module also leaves both flows on `globalThis`, because a
// native file dialog cannot be driven over CDP.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));

vi.mock('./settingArchiveMenuHelpers', () => ({
    handleSettingsExporting: h.handleSettingsExportingMock,
    handleSettingsImporting: h.handleSettingsImportingMock,
}));

import SettingArchiveButtonsComp from './SettingArchiveButtonsComp';

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent === text;
    }) as HTMLButtonElement;
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.handleSettingsExportingMock.mockResolvedValue(undefined);
    h.handleSettingsImportingMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<SettingArchiveButtonsComp />));
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

afterAll(() => {
    delete (globalThis as any).trySettingsExport;
    delete (globalThis as any).trySettingsImport;
});

describe('SettingArchiveButtonsComp', () => {
    test('draws both buttons with their translated titles', () => {
        expect(
            Array.from(container.querySelectorAll('button')).map((button) => {
                return [button.textContent, button.title, button.type];
            }),
        ).toEqual([
            ['t(Export Settings)', 't(Export settings to a file)', 'button'],
            ['t(Import Settings)', 't(Import settings from a file)', 'button'],
        ]);
    });

    test('Export Settings runs the export flow', async () => {
        await act(async () => findButton('t(Export Settings)').click());
        expect(h.handleSettingsExportingMock).toHaveBeenCalledOnce();
        expect(h.handleSettingsImportingMock).not.toHaveBeenCalled();
    });

    test('Import Settings runs the import flow, which asks for the file', async () => {
        await act(async () => findButton('t(Import Settings)').click());
        expect(h.handleSettingsImportingMock).toHaveBeenCalledWith();
        expect(h.handleSettingsExportingMock).not.toHaveBeenCalled();
    });

    test('a failing flow is reported rather than thrown', async () => {
        const exportError = new Error('cannot write');
        const importError = new Error('bad archive');
        h.handleSettingsExportingMock.mockRejectedValue(exportError);
        h.handleSettingsImportingMock.mockRejectedValue(importError);

        await act(async () => findButton('t(Export Settings)').click());
        await act(async () => findButton('t(Import Settings)').click());

        expect(h.handleErrorMock.mock.calls).toEqual([
            [exportError],
            [importError],
        ]);
    });

    test('development exposes both flows with the path handed in', async () => {
        await (globalThis as any).trySettingsExport();
        expect(h.handleSettingsExportingMock).toHaveBeenCalledOnce();

        await (globalThis as any).trySettingsImport('/tmp/a.owasetting');
        expect(h.handleSettingsImportingMock).toHaveBeenCalledWith(
            '/tmp/a.owasetting',
        );
    });
});
