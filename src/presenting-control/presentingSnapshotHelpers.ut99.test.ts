// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dictionaries: [] as Record<string, string>[],
        dirSource: null as any,
    },
    mocks: {
        capture: vi.fn(),
        toast: vi.fn(),
        openChatbot: vi.fn(),
        sendData: vi.fn(),
        getDirSource: vi.fn(),
        genRandomFilePath: vi.fn(),
        fireReloadEvent: vi.fn(),
        writeFile: vi.fn(),
        toDotExtension: vi.fn(),
        clipboardWrite: vi.fn(),
    },
}));

vi.mock('../helper/appCaptureHelpers', () => ({
    captureAppWindow: mocks.capture,
}));
vi.mock('../helper/DirSource', () => ({
    default: { getInstance: mocks.getDirSource },
}));
vi.mock('../helper/FileSource', () => ({
    default: { writeFileBase64Data: mocks.writeFile },
}));
vi.mock('../helper/domHelpers', () => ({
    openChatbotPage: mocks.openChatbot,
}));
vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendData: mocks.sendData } },
}));
// The real one sits in the file-system helper module, which drags node:fs and
// the whole mime table in behind it.
vi.mock('../server/fileHelpers', () => ({
    getDotExtensionFromBase64Data: mocks.toDotExtension,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
// Both real dictionaries must hold every label the toasts show.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));

import { dirSourceSettingNames } from '../helper/constants';
import {
    copySnapshot,
    saveSnapshotToImages,
    sendSnapshotToChatbot,
    takeAppSnapshot,
} from './presentingSnapshotHelpers';

const dictionaries = readLangPackageDictionaries();

// "\x89PNG" — four bytes whose base64 round-trip is easy to check.
const PNG_DATA_URL = 'data:image/png;base64,iVBORw==';
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47];

class ClipboardItemStub {
    constructor(readonly items: Record<string, Blob>) {}
}

let clipboardDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
    state.dictionaries = dictionaries;
    state.dirSource = {
        dirPath: '/data/images',
        genRandomFilePath: mocks.genRandomFilePath,
        fireReloadEvent: mocks.fireReloadEvent,
    };
    mocks.getDirSource.mockImplementation(async () => state.dirSource);
    mocks.toDotExtension.mockImplementation((dataUrl: string) => {
        return dataUrl.startsWith('data:image/png;') ? '.png' : null;
    });
    mocks.genRandomFilePath.mockImplementation(async (dotExtension: string) => {
        return `/data/images/file-1${dotExtension}`;
    });
    mocks.writeFile.mockResolvedValue(true);
    mocks.clipboardWrite.mockResolvedValue(undefined);
    clipboardDescriptor = Object.getOwnPropertyDescriptor(
        navigator,
        'clipboard',
    );
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { write: mocks.clipboardWrite },
    });
    vi.stubGlobal('ClipboardItem', ClipboardItemStub);
});

afterEach(() => {
    if (clipboardDescriptor === undefined) {
        delete (navigator as any).clipboard;
    } else {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    }
    vi.unstubAllGlobals();
});

// jsdom's Blob has no `arrayBuffer()`; its FileReader does the same job.
function readBlobBytes(blob: Blob) {
    return new Promise<number[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
        };
        reader.onerror = () => {
            reject(reader.error);
        };
        reader.readAsArrayBuffer(blob);
    });
}

describe('takeAppSnapshot', () => {
    test('hands back the captured picture', async () => {
        mocks.capture.mockResolvedValue(PNG_DATA_URL);

        await expect(takeAppSnapshot()).resolves.toBe(PNG_DATA_URL);
        expect(mocks.capture).toHaveBeenCalledWith();
        expect(mocks.toast).not.toHaveBeenCalled();
    });

    test('says why a capture failed and hands back nothing', async () => {
        mocks.capture.mockRejectedValueOnce(new Error('window is gone'));
        await expect(takeAppSnapshot()).resolves.toBeNull();
        expect(mocks.toast).toHaveBeenLastCalledWith(
            'App Snapshot',
            'window is gone',
        );

        // A rejection that is not an Error still reads as itself.
        mocks.capture.mockRejectedValueOnce('denied');
        await expect(takeAppSnapshot()).resolves.toBeNull();
        expect(mocks.toast).toHaveBeenLastCalledWith('App Snapshot', 'denied');
    });
});

describe('sendSnapshotToChatbot', () => {
    test('opens the help window before sending it the picture', () => {
        sendSnapshotToChatbot(PNG_DATA_URL);

        expect(mocks.openChatbot).toHaveBeenCalledTimes(1);
        expect(mocks.sendData).toHaveBeenCalledWith('all:app:chat-attach', {
            dataUrl: PNG_DATA_URL,
        });
        expect(mocks.openChatbot.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.sendData.mock.invocationCallOrder[0],
        );
    });
});

describe('copySnapshot', () => {
    test('puts the decoded picture on the clipboard as an image', async () => {
        await copySnapshot(PNG_DATA_URL);

        expect(mocks.clipboardWrite).toHaveBeenCalledTimes(1);
        const [[item]] = mocks.clipboardWrite.mock.calls[0];
        expect(item).toBeInstanceOf(ClipboardItemStub);
        const blob = (item as ClipboardItemStub).items['image/png'];
        expect(blob.type).toBe('image/png');
        await expect(readBlobBytes(blob)).resolves.toEqual(PNG_BYTES);
        expect(mocks.toast).toHaveBeenCalledWith(
            'App Snapshot',
            'Copied to clipboard',
        );
    });

    test("keeps the data URL's own type, and falls back to PNG without one", async () => {
        await copySnapshot('data:image/jpeg;base64,QUJD');
        const jpeg = (mocks.clipboardWrite.mock.calls[0][0][0] as any).items[
            'image/png'
        ] as Blob;
        expect(jpeg.type).toBe('image/jpeg');
        await expect(readBlobBytes(jpeg)).resolves.toEqual([0x41, 0x42, 0x43]);

        await copySnapshot('no-header,QUJD');
        const bare = (mocks.clipboardWrite.mock.calls[1][0][0] as any).items[
            'image/png'
        ] as Blob;
        expect(bare.type).toBe('image/png');
    });

    test('says why the clipboard refused it', async () => {
        mocks.clipboardWrite.mockRejectedValueOnce(new Error('not allowed'));
        await copySnapshot(PNG_DATA_URL);
        expect(mocks.toast).toHaveBeenLastCalledWith(
            'App Snapshot',
            'not allowed',
        );

        mocks.clipboardWrite.mockRejectedValueOnce('blocked');
        await copySnapshot(PNG_DATA_URL);
        expect(mocks.toast).toHaveBeenLastCalledWith('App Snapshot', 'blocked');
        expect(mocks.toast).not.toHaveBeenCalledWith(
            'App Snapshot',
            'Copied to clipboard',
        );
    });
});

describe('saveSnapshotToImages', () => {
    test('writes it into the images folder and refreshes that folder', async () => {
        await saveSnapshotToImages(PNG_DATA_URL);

        expect(mocks.getDirSource).toHaveBeenCalledWith(
            dirSourceSettingNames.BACKGROUND_IMAGE,
        );
        expect(mocks.genRandomFilePath).toHaveBeenCalledWith('.png');
        expect(mocks.writeFile).toHaveBeenCalledWith(
            '/data/images/file-1.png',
            PNG_DATA_URL,
        );
        expect(mocks.toast).toHaveBeenCalledWith(
            'App Snapshot',
            'Saved into your images',
        );
        expect(mocks.fireReloadEvent).toHaveBeenCalledTimes(1);
    });

    test('says so when no images folder is set', async () => {
        state.dirSource.dirPath = '';

        await saveSnapshotToImages(PNG_DATA_URL);

        expect(mocks.toast).toHaveBeenCalledWith(
            'App Snapshot',
            'No images folder is set yet',
        );
        expect(mocks.toDotExtension).not.toHaveBeenCalled();
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('refuses a picture it cannot name a file for', async () => {
        await saveSnapshotToImages('data:application/x-unknown;base64,QUJD');
        expect(mocks.toast).toHaveBeenLastCalledWith(
            'App Snapshot',
            'Cannot save this picture',
        );
        expect(mocks.genRandomFilePath).not.toHaveBeenCalled();

        mocks.genRandomFilePath.mockResolvedValueOnce(null);
        await saveSnapshotToImages(PNG_DATA_URL);
        expect(mocks.toast).toHaveBeenLastCalledWith(
            'App Snapshot',
            'Cannot save this picture',
        );
        expect(mocks.writeFile).not.toHaveBeenCalled();
        expect(mocks.fireReloadEvent).not.toHaveBeenCalled();
    });

    test('reports a failed write and leaves the folder alone', async () => {
        mocks.writeFile.mockResolvedValueOnce(false);

        await saveSnapshotToImages(PNG_DATA_URL);

        expect(mocks.writeFile).toHaveBeenCalledTimes(1);
        expect(mocks.toast).toHaveBeenCalledWith(
            'App Snapshot',
            'Cannot save this picture',
        );
        expect(mocks.fireReloadEvent).not.toHaveBeenCalled();
    });
});
