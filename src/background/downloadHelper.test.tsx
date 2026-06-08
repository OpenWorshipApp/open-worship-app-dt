// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showAppInputMock,
    readTextFromClipboardMock,
    showSimpleToastMock,
    openExternalURLMock,
    writeStreamToFileMock,
    showProgressBarMessageMock,
} = vi.hoisted(() => ({
    showAppInputMock: vi.fn(),
    readTextFromClipboardMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    openExternalURLMock: vi.fn(),
    writeStreamToFileMock: vi.fn(),
    showProgressBarMessageMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: showAppInputMock,
}));

vi.mock('../server/appHelpers', () => ({
    readTextFromClipboard: readTextFromClipboardMock,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: {
            homepage: 'https://www.openworship.app',
        },
        browserUtils: {
            openExternalURL: openExternalURLMock,
        },
    },
}));

vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    writeStreamToFile: writeStreamToFileMock,
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBarMessage: showProgressBarMessageMock,
}));

import {
    askForURL,
    genDownloadContextMenuItems,
    getOpenSharedLinkMenuItem,
    messageCallback,
    streamDownloadFile,
} from './downloadHelper';

describe('downloadHelper', () => {
    let promptContainer: HTMLDivElement | null = null;
    let promptRoot: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await cleanupPrompt();
        vi.useRealTimers();
    });

    async function cleanupPrompt() {
        if (promptRoot) {
            await act(async () => {
                promptRoot?.unmount();
            });
            promptRoot = null;
        }
        promptContainer?.remove();
        promptContainer = null;
    }

    async function renderPrompt(element: ReactElement) {
        await cleanupPrompt();
        promptContainer = document.createElement('div');
        document.body.appendChild(promptContainer);
        promptRoot = createRoot(promptContainer);
        await act(async () => {
            promptRoot?.render(element);
        });
    }

    async function updatePromptValue(
        value: string,
        promptElement?: ReactElement,
    ) {
        const input = promptContainer?.querySelector(
            'input',
        ) as HTMLInputElement | null;
        if (!input) {
            throw new Error('Missing prompt input');
        }
        await act(async () => {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            await Promise.resolve();
        });
        const onChange = (promptElement?.props as { onChange?: unknown })
            ?.onChange;
        if (typeof onChange === 'function') {
            onChange(value);
        }
        return input;
    }

    test('returns the edited URL from the prompt when confirmed', async () => {
        readTextFromClipboardMock.mockResolvedValue('http://clipboard.example');
        showAppInputMock.mockImplementation(
            async (_title: string, element: ReactElement) => {
                await renderPrompt(element);
                const input = promptContainer?.querySelector(
                    'input',
                ) as HTMLInputElement | null;
                expect(input?.value).toBe('http://clipboard.example');
                await updatePromptValue('https://edited.example/path', element);
                await cleanupPrompt();
                return true;
            },
        );

        await expect(askForURL('Download From URL', 'Web URL:')).resolves.toBe(
            'https://edited.example/path',
        );
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('returns null when the prompt is cancelled', async () => {
        readTextFromClipboardMock.mockResolvedValue(
            'https://clipboard.example',
        );
        showAppInputMock.mockResolvedValue(false);

        await expect(askForURL('Download From URL', 'Web URL:')).resolves.toBe(
            null,
        );
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('rejects invalid prompt values after rendering the invalid state', async () => {
        readTextFromClipboardMock.mockResolvedValue('not copied from browser');
        showAppInputMock.mockImplementation(
            async (_title: string, element: ReactElement) => {
                await renderPrompt(element);
                const inputGroup = promptContainer?.querySelector(
                    '.input-group',
                ) as HTMLDivElement | null;
                const input = promptContainer?.querySelector(
                    'input',
                ) as HTMLInputElement | null;
                expect(inputGroup?.title).toBe('Cannot be empty');
                expect(input?.className).toContain('is-invalid');
                await updatePromptValue(
                    'ftp://invalid.example/file.zip',
                    element,
                );
                await cleanupPrompt();
                return true;
            },
        );

        await expect(askForURL('Download From URL', 'Web URL:')).resolves.toBe(
            null,
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Download From URL',
            'Invalid URL',
        );
    });

    test('opens shared links through the browser provider', async () => {
        const menuItem = getOpenSharedLinkMenuItem('shared-key');

        expect(menuItem.title).toBe(
            'https://www.openworship.app/shared#shared-key',
        );

        await menuItem.onSelect?.({} as any);

        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://www.openworship.app/shared#shared-key',
        );
    });

    test('returns no download menu items when the directory is not configured', async () => {
        await expect(
            genDownloadContextMenuItems(
                {
                    title: 'Download From URL',
                    subTitle: 'Web URL:',
                },
                { dirPath: '' } as any,
                vi.fn(),
            ),
        ).resolves.toEqual([]);
    });

    test('skips downloads when the URL prompt is cancelled and omits shared links when absent', async () => {
        const downloadMock = vi.fn();
        readTextFromClipboardMock.mockResolvedValue(null);
        showAppInputMock.mockResolvedValue(false);

        const menuItems = await genDownloadContextMenuItems(
            {
                title: 'Download From URL',
                subTitle: 'Web URL:',
            },
            { dirPath: '/downloads' } as any,
            downloadMock,
        );

        expect(menuItems).toHaveLength(1);

        await menuItems[0]?.onSelect?.({} as any);

        expect(downloadMock).not.toHaveBeenCalled();
    });

    test('downloads the confirmed URL and appends the shared link menu item', async () => {
        const downloadMock = vi.fn();
        readTextFromClipboardMock.mockResolvedValue(null);
        showAppInputMock.mockImplementation(
            async (_title: string, element: ReactElement) => {
                await renderPrompt(element);
                await updatePromptValue(
                    'https://cdn.example/file.zip',
                    element,
                );
                await cleanupPrompt();
                return true;
            },
        );

        const menuItems = await genDownloadContextMenuItems(
            {
                title: 'Download From URL',
                subTitle: 'Web URL:',
            },
            { dirPath: '/downloads' } as any,
            downloadMock,
            'shared-file',
        );

        expect(menuItems).toHaveLength(2);

        await menuItems[0]?.onSelect?.({} as any);
        await menuItems[1]?.onSelect?.({} as any);

        expect(downloadMock).toHaveBeenCalledWith(
            'https://cdn.example/file.zip',
        );
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://www.openworship.app/shared#shared-file',
        );
    });

    test('streams downloads, blocks unload attempts, and resolves on success', async () => {
        vi.useFakeTimers();
        const messageMock = vi.fn();

        writeStreamToFileMock.mockImplementation(
            async (filePath: string, options: any) => {
                await options.onStart(1.23);
                await options.onProgress(0.25);
                const attempts = Array.from(
                    { length: 4 },
                    () => new Event('beforeunload', { cancelable: true }),
                );
                attempts.forEach((event) => {
                    window.dispatchEvent(event);
                });
                expect(
                    attempts
                        .slice(0, 3)
                        .every((event) => event.defaultPrevented),
                ).toBe(true);
                expect(attempts[3]?.defaultPrevented).toBe(false);
                await options.onDone(null, filePath);
            },
        );

        await expect(
            streamDownloadFile('/downloads/file.zip', {}, messageMock),
        ).resolves.toBeUndefined();

        expect(messageMock).toHaveBeenNthCalledWith(
            1,
            'Start downloading (File size: 1MB)...',
        );
        expect(messageMock).toHaveBeenNthCalledWith(2, '25.00% done');
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Download Completed',
            'File saved at: /downloads/file.zip',
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Downloading in progress',
            "Can't leave the page while downloading. Please wait until the download is complete. Or attempt 3 times to force leaving.",
        );

        const eventAfterDone = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(eventAfterDone);
        expect(eventAfterDone.defaultPrevented).toBe(false);

        vi.runAllTimers();
    });

    test('rejects downloads when the stream callback reports an error', async () => {
        writeStreamToFileMock.mockImplementation(
            async (_filePath: string, options: any) => {
                await options.onStart(2.4);
                await options.onDone(new Error('boom'));
            },
        );

        await expect(
            streamDownloadFile('/downloads/file.zip', {}, vi.fn()),
        ).rejects.toMatchObject({ message: 'boom' });
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Download Error',
            'Error: Error: boom',
        );
    });

    test('forwards progress bar messages and falls back to an empty string', () => {
        messageCallback(null);
        messageCallback('Downloading...');

        expect(showProgressBarMessageMock).toHaveBeenNthCalledWith(1, '');
        expect(showProgressBarMessageMock).toHaveBeenNthCalledWith(
            2,
            'Downloading...',
        );
    });
});
