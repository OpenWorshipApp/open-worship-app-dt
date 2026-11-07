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

// Export Settings / Import Settings in the Settings sidebar: two buttons
// that load their flows only when pressed.
const { mocks } = vi.hoisted(() => ({
    mocks: {
        handleError: vi.fn(),
        exporting: vi.fn(),
        importing: vi.fn(),
    },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => `[${text}]`,
}));
// The dev-only hooks for an automated run are defined at load.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));
vi.mock('./settingArchiveMenuHelpers', () => ({
    handleSettingsExporting: mocks.exporting,
    handleSettingsImporting: mocks.importing,
}));

import SettingArchiveButtonsComp from './SettingArchiveButtonsComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(<SettingArchiveButtonsComp />);
    });
}

function findButton(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (element) => element.textContent === text,
    );
    if (button === undefined) {
        throw new Error(`No button "${text}"`);
    }
    return button;
}

async function press(text: string) {
    await act(async () => {
        findButton(text).click();
    });
}

beforeEach(() => {
    mocks.exporting.mockResolvedValue('exported');
    mocks.importing.mockResolvedValue('imported');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

afterAll(() => {
    delete (globalThis as any).trySettingsExport;
    delete (globalThis as any).trySettingsImport;
});

describe('the settings archive buttons', () => {
    test('two translated buttons, each saying what it does', async () => {
        await render();
        const buttons = Array.from(container.querySelectorAll('button'));
        expect(
            buttons.map((button) => [
                button.textContent,
                button.title,
                button.type,
                button.querySelector('i')?.className,
            ]),
        ).toEqual([
            [
                '[Export Settings]',
                '[Export settings to a file]',
                'button',
                'bi bi-box-arrow-up me-1',
            ],
            [
                '[Import Settings]',
                '[Import settings from a file]',
                'button',
                'bi bi-box-arrow-in-down me-1',
            ],
        ]);
        // Nothing is loaded or run merely by drawing them.
        expect(mocks.exporting).not.toHaveBeenCalled();
        expect(mocks.importing).not.toHaveBeenCalled();
    });

    test('each button runs its own flow, with no file named', async () => {
        await render();
        await press('[Export Settings]');
        await vi.waitFor(() => expect(mocks.exporting).toHaveBeenCalledOnce(), {
            interval: 5,
        });
        expect(mocks.exporting).toHaveBeenCalledWith();
        expect(mocks.importing).not.toHaveBeenCalled();

        await press('[Import Settings]');
        await vi.waitFor(() => expect(mocks.importing).toHaveBeenCalledOnce(), {
            interval: 5,
        });
        expect(mocks.importing).toHaveBeenCalledWith();
        expect(mocks.exporting).toHaveBeenCalledOnce();
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a flow that fails is reported', async () => {
        const exportError = new Error('disk full');
        const importError = new Error('not a settings file');
        mocks.exporting.mockRejectedValue(exportError);
        mocks.importing.mockRejectedValue(importError);
        await render();
        await press('[Export Settings]');
        await vi.waitFor(
            () =>
                expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(
                    exportError,
                ),
            { interval: 5 },
        );
        await press('[Import Settings]');
        await vi.waitFor(
            () => expect(mocks.handleError).toHaveBeenCalledTimes(2),
            { interval: 5 },
        );
        expect(mocks.handleError).toHaveBeenLastCalledWith(importError);
    });
});

describe('the development hooks', () => {
    test('drive the same two flows, the import with the file handed in', async () => {
        await expect((globalThis as any).trySettingsExport()).resolves.toBe(
            'exported',
        );
        expect(mocks.exporting).toHaveBeenCalledExactlyOnceWith();
        await expect(
            (globalThis as any).trySettingsImport(
                '/backups/church.owasetting.tar.gz',
            ),
        ).resolves.toBe('imported');
        expect(mocks.importing).toHaveBeenCalledExactlyOnceWith(
            '/backups/church.owasetting.tar.gz',
        );
    });
});
