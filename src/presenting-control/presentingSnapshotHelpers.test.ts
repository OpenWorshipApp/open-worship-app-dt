// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    captureAppWindow: vi.fn(),
    getDirSource: vi.fn(),
    writeFileBase64Data: vi.fn(),
    openChatbotPage: vi.fn(),
    sendData: vi.fn(),
    getDotExtension: vi.fn(),
    showSimpleToast: vi.fn(),
    calls: [] as string[],
}));

vi.mock('../helper/appCaptureHelpers', () => ({
    captureAppWindow: h.captureAppWindow,
}));
vi.mock('../helper/DirSource', () => ({
    default: { getInstance: h.getDirSource },
}));
vi.mock('../helper/FileSource', () => ({
    default: { writeFileBase64Data: h.writeFileBase64Data },
}));
vi.mock('../helper/domHelpers', () => ({
    openChatbotPage: h.openChatbotPage,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendData: h.sendData } },
}));
vi.mock('../server/fileHelpers', () => ({
    getDotExtensionFromBase64Data: h.getDotExtension,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));

import {
    copySnapshot,
    saveSnapshotToImages,
    sendSnapshotToChatbot,
    takeAppSnapshot,
} from './presentingSnapshotHelpers';
import { dirSourceSettingNames } from '../helper/constants';

// "hi!" — three bytes, so the decode can be checked byte for byte.
const DATA_URL = 'data:image/png;base64,aGkh';

function genDirSource(dirPath: string) {
    return {
        dirPath,
        genRandomFilePath: vi.fn(),
        fireReloadEvent: vi.fn(),
    };
}

beforeEach(() => {
    h.calls = [];
    h.openChatbotPage.mockImplementation(() => {
        h.calls.push('open');
    });
    h.sendData.mockImplementation(() => {
        h.calls.push('send');
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('takeAppSnapshot', () => {
    test('hands back the captured picture', async () => {
        h.captureAppWindow.mockResolvedValue(DATA_URL);
        await expect(takeAppSnapshot()).resolves.toBe(DATA_URL);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a failed capture says why and hands back nothing', async () => {
        h.captureAppWindow.mockRejectedValue(new Error('window is gone'));
        await expect(takeAppSnapshot()).resolves.toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'window is gone',
        );
    });

    test('a non-Error rejection is still reported as text', async () => {
        h.captureAppWindow.mockRejectedValue('denied');
        await expect(takeAppSnapshot()).resolves.toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'denied',
        );
    });
});

describe('sendSnapshotToChatbot', () => {
    test('opens the help window BEFORE sending, so it is there to receive', () => {
        sendSnapshotToChatbot(DATA_URL);
        expect(h.calls).toEqual(['open', 'send']);
        expect(h.sendData).toHaveBeenCalledWith('all:app:chat-attach', {
            dataUrl: DATA_URL,
        });
    });
});

describe('copySnapshot', () => {
    test('puts the decoded png on the clipboard', async () => {
        const write = vi.fn(async (_items: any[]) => {});
        vi.stubGlobal('navigator', { clipboard: { write } });
        vi.stubGlobal(
            'ClipboardItem',
            class {
                constructor(readonly data: Record<string, Blob>) {}
            },
        );

        await copySnapshot(DATA_URL);

        expect(write).toHaveBeenCalledTimes(1);
        const [[item]] = write.mock.calls[0];
        const blob: Blob = item.data['image/png'];
        expect(blob.type).toBe('image/png');
        // jsdom's Blob has no `arrayBuffer()`; its FileReader does.
        const bytes = await new Promise<number[]>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(Array.from(new Uint8Array(reader.result as any)));
            };
            reader.readAsArrayBuffer(blob);
        });
        expect(bytes).toEqual([0x68, 0x69, 0x21]);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'Copied to clipboard',
        );
    });

    test('a picture with no readable mime type is still written as png', async () => {
        const write = vi.fn(async (_items: any[]) => {});
        vi.stubGlobal('navigator', { clipboard: { write } });
        vi.stubGlobal(
            'ClipboardItem',
            class {
                constructor(readonly data: Record<string, Blob>) {}
            },
        );

        await copySnapshot('data,aGkh');

        const [[item]] = write.mock.calls[0];
        expect(item.data['image/png'].type).toBe('image/png');
    });

    test('a refused clipboard is reported, not thrown', async () => {
        vi.stubGlobal('navigator', {
            clipboard: {
                write: vi.fn(async () => {
                    throw new Error('Document is not focused');
                }),
            },
        });
        vi.stubGlobal(
            'ClipboardItem',
            class {
                constructor(readonly data: Record<string, Blob>) {}
            },
        );

        await expect(copySnapshot(DATA_URL)).resolves.toBeUndefined();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'Document is not focused',
        );
    });
});

describe('saveSnapshotToImages', () => {
    test('writes into the background images folder and refreshes it', async () => {
        const dirSource = genDirSource('/data/images');
        dirSource.genRandomFilePath.mockResolvedValue('/data/images/a.png');
        h.getDirSource.mockResolvedValue(dirSource);
        h.getDotExtension.mockReturnValue('.png');
        h.writeFileBase64Data.mockResolvedValue(true);

        await saveSnapshotToImages(DATA_URL);

        expect(h.getDirSource).toHaveBeenCalledWith(
            dirSourceSettingNames.BACKGROUND_IMAGE,
        );
        expect(dirSource.genRandomFilePath).toHaveBeenCalledWith('.png');
        expect(h.writeFileBase64Data).toHaveBeenCalledWith(
            '/data/images/a.png',
            DATA_URL,
        );
        expect(dirSource.fireReloadEvent).toHaveBeenCalledTimes(1);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'Saved into your images',
        );
    });

    test('with no images folder set it says so and writes nothing', async () => {
        h.getDirSource.mockResolvedValue(genDirSource(''));

        await saveSnapshotToImages(DATA_URL);

        expect(h.writeFileBase64Data).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'No images folder is set yet',
        );
    });

    test('a picture of no known type is refused', async () => {
        const dirSource = genDirSource('/data/images');
        h.getDirSource.mockResolvedValue(dirSource);
        h.getDotExtension.mockReturnValue(null);

        await saveSnapshotToImages('data:application/x-unknown;base64,aGkh');

        expect(dirSource.genRandomFilePath).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'Cannot save this picture',
        );
    });

    test('no free file name is refused', async () => {
        const dirSource = genDirSource('/data/images');
        dirSource.genRandomFilePath.mockResolvedValue(null);
        h.getDirSource.mockResolvedValue(dirSource);
        h.getDotExtension.mockReturnValue('.png');

        await saveSnapshotToImages(DATA_URL);

        expect(h.writeFileBase64Data).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'Cannot save this picture',
        );
    });

    test('a failed write is reported and the folder is not reloaded', async () => {
        const dirSource = genDirSource('/data/images');
        dirSource.genRandomFilePath.mockResolvedValue('/data/images/a.png');
        h.getDirSource.mockResolvedValue(dirSource);
        h.getDotExtension.mockReturnValue('.png');
        h.writeFileBase64Data.mockResolvedValue(false);

        await saveSnapshotToImages(DATA_URL);

        expect(dirSource.fireReloadEvent).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'App Snapshot',
            'Cannot save this picture',
        );
    });
});
