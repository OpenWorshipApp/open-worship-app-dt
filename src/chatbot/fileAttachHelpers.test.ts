// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A file by its path, made into something the assistant can read. The disk,
// the main process that draws a PDF's pages and the Resources folder list are
// stood in for here; the attachment store and the readers are the real ones.
// jsdom has a `FileReader` but loads no picture, so `Image` is a stand-in
// whose size each test says, and a canvas hands back fixed data URLs.
const { diskState, sendState, folderState, imageState } = vi.hoisted(() => ({
    diskState: {
        // Size by path; a path not here is not on the disk.
        sizeMap: new Map<string, number>(),
        textMap: new Map<string, string>(),
        bytesMap: new Map<string, Uint8Array>(),
        readCountMap: new Map<string, number>(),
    },
    sendState: {
        channelList: [] as { channel: string; data: any }[],
        answer: null as any,
        isThrowing: false,
    },
    folderState: {
        dirPaths: [] as string[],
        isThrowing: false,
        readCount: 0,
    },
    // The size the stand-in `Image` loads at; null fails to load.
    imageState: { size: { width: 40, height: 20 } as null | object },
}));

vi.mock('../server/fileHelpers', () => ({
    fsGetFileSize: async (filePath: string) => {
        const size = diskState.sizeMap.get(filePath);
        if (size === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return size;
    },
    fsReadFile: async (filePath: string) => {
        diskState.readCountMap.set(
            filePath,
            (diskState.readCountMap.get(filePath) ?? 0) + 1,
        );
        const text = diskState.textMap.get(filePath);
        if (text === undefined) {
            throw new Error(`EACCES: ${filePath}`);
        }
        return text;
    },
    fsReadFileBytes: async (filePath: string) => {
        diskState.readCountMap.set(
            filePath,
            (diskState.readCountMap.get(filePath) ?? 0) + 1,
        );
        const bytes = diskState.bytesMap.get(filePath);
        if (bytes === undefined) {
            throw new Error(`EACCES: ${filePath}`);
        }
        return bytes;
    },
    // As `path.basename` does: a trailing separator names no empty file.
    pathBasename: (filePath: string) => {
        return (
            filePath
                .replace(/[\\/]+$/, '')
                .split(/[\\/]/)
                .pop() ?? ''
        );
    },
    pathSeparator: '/',
    toPathCompareKey: (filePath: string) => {
        return filePath.replaceAll('\\', '/').toLowerCase();
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: async (channel: string, data: any) => {
        sendState.channelList.push({ channel, data });
        if (sendState.isThrowing) {
            throw new Error('main is gone');
        }
        return sendState.answer;
    },
}));
vi.mock('../resources/resourcesFolderHelpers', () => ({
    getResourcesFolderList: () => {
        folderState.readCount += 1;
        if (folderState.isThrowing) {
            throw new Error('setting store not ready');
        }
        return folderState.dirPaths;
    },
}));

import {
    dropAttachmentData,
    genFileAttachment,
    genTextAttachment,
    getAttachmentData,
    getAttachmentPages,
    putAttachmentData,
    putAttachmentPages,
    type ChatAttachmentType,
} from './attachmentHelpers';
import {
    findResourceFileNames,
    genAttachmentFromPath,
    genPdfAttachment,
    reloadFileAttachment,
} from './fileAttachHelpers';

const PAGE_ONE = 'data:image/png;base64,UEFHRTE=';
const PAGE_TWO = 'data:image/jpeg;base64,UEFHRTI=';

class FakeImage {
    width = 0;
    height = 0;
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_value: string) {
        queueMicrotask(() => {
            const size = imageState.size as null | {
                width: number;
                height: number;
            };
            if (size === null) {
                this.onerror?.();
                return;
            }
            this.width = size.width;
            this.height = size.height;
            this.onload?.();
        });
    }
}

beforeEach(() => {
    diskState.sizeMap.clear();
    diskState.textMap.clear();
    diskState.bytesMap.clear();
    diskState.readCountMap.clear();
    sendState.channelList = [];
    sendState.answer = null;
    sendState.isThrowing = false;
    folderState.dirPaths = [];
    folderState.isThrowing = false;
    folderState.readCount = 0;
    imageState.size = { width: 40, height: 20 };
    vi.stubGlobal('Image', FakeImage);
});
afterEach(() => {
    vi.unstubAllGlobals();
});

function expectAttachment(
    result: Awaited<ReturnType<typeof genAttachmentFromPath>>,
) {
    if (!('attachment' in result)) {
        throw new Error(`expected an attachment, got: ${result.failure}`);
    }
    return result.attachment;
}

function expectFailure(
    result: Awaited<ReturnType<typeof genAttachmentFromPath>>,
) {
    if (!('failure' in result)) {
        throw new Error('expected a failure');
    }
    return result.failure;
}

describe('a PDF is held as its pages', () => {
    test('the pages main drew are kept, anything that is not a picture dropped', async () => {
        diskState.sizeMap.set('C:/res/pdf/LUK.6.pdf', 2048);
        sendState.answer = {
            isSuccessful: true,
            pageCount: 12,
            dataUrls: [
                PAGE_ONE,
                'data:text/html;base64,PHNjcmlwdD4=',
                7,
                PAGE_TWO,
            ],
        };

        const attachment = expectAttachment(
            await genAttachmentFromPath('C:/res/pdf/LUK.6.pdf'),
        );

        expect(sendState.channelList).toEqual([
            {
                channel: 'main:app:pdf-to-chat-pages',
                data: { filePath: 'C:/res/pdf/LUK.6.pdf' },
            },
        ]);
        expect(attachment).toMatchObject({
            kind: 'file',
            name: 'LUK.6.pdf',
            byteSize: 2048,
            filePath: 'C:/res/pdf/LUK.6.pdf',
            pageCount: 12,
        });
        expect(getAttachmentPages(attachment.id)).toEqual([PAGE_ONE, PAGE_TWO]);
        dropAttachmentData(attachment.id);
    });

    test('one that could not be drawn is still attached, with no pages', async () => {
        sendState.answer = { isSuccessful: false, message: 'encrypted' };
        const refused = await genPdfAttachment('x.pdf', 10, 'C:/x.pdf');
        expect(refused.kind).toBe('file');
        expect(refused.pageCount).toBeUndefined();
        expect(getAttachmentPages(refused.id)).toEqual([]);

        sendState.isThrowing = true;
        const gone = await genPdfAttachment('y.pdf', 10, 'C:/y.pdf');
        expect(getAttachmentPages(gone.id)).toEqual([]);

        // A count main could not give is left out, not guessed.
        sendState.isThrowing = false;
        sendState.answer = { isSuccessful: true, dataUrls: [PAGE_ONE] };
        const uncounted = await genPdfAttachment('z.pdf', 10, 'C:/z.pdf');
        expect(uncounted.pageCount).toBeUndefined();
        expect(getAttachmentPages(uncounted.id)).toEqual([PAGE_ONE]);
        dropAttachmentData(uncounted.id);
    });
});

describe('genAttachmentFromPath', () => {
    test('a file that has gone is said so by its name', async () => {
        expect(
            expectFailure(await genAttachmentFromPath('C:/gone/notes.txt')),
        ).toBe('notes.txt is not there any more.');
    });

    test('anything over the read ceiling is refused before it is read', async () => {
        diskState.sizeMap.set('C:/big.txt', 17 * 1024 * 1024);
        diskState.textMap.set('C:/big.txt', 'never read');
        expect(expectFailure(await genAttachmentFromPath('C:/big.txt'))).toBe(
            'big.txt is too large to attach — 16 MB at most.',
        );
        expect(diskState.readCountMap.get('C:/big.txt')).toBeUndefined();
    });

    test('a picture is read off the disk and held as itself', async () => {
        diskState.sizeMap.set('C:/pics/stage.png', 4);
        diskState.bytesMap.set(
            'C:/pics/stage.png',
            new Uint8Array([1, 2, 3, 4]),
        );

        const attachment = expectAttachment(
            await genAttachmentFromPath('C:/pics/stage.png'),
        );

        expect(attachment).toMatchObject({
            kind: 'image',
            name: 'stage.png',
            mimeType: 'image/png',
            filePath: 'C:/pics/stage.png',
        });
        // Small already and a kind every provider takes: kept as it came.
        expect(getAttachmentData(attachment.id)).toBe(
            'data:image/png;base64,AQIDBA==',
        );
        dropAttachmentData(attachment.id);
    });

    test('a picture that cannot be read or drawn is refused in words', async () => {
        diskState.sizeMap.set('C:/pics/broken.jpg', 4);
        diskState.bytesMap.set('C:/pics/broken.jpg', new Uint8Array([9, 9]));
        imageState.size = null;
        expect(
            expectFailure(await genAttachmentFromPath('C:/pics/broken.jpg')),
        ).toBe('I cannot read broken.jpg — try a picture of it instead.');

        // Its bytes could not be read at all.
        diskState.sizeMap.set('C:/pics/locked.gif', 4);
        imageState.size = { width: 4, height: 4 };
        expect(
            expectFailure(await genAttachmentFromPath('C:/pics/locked.gif')),
        ).toContain('I cannot read locked.gif');
    });

    test('a text file goes in as its words, under the line for the model', async () => {
        diskState.sizeMap.set('C:/docs/order.txt', 20);
        diskState.textMap.set('C:/docs/order.txt', 'Hymn 1\nReading\nHymn 2');

        const attachment = expectAttachment(
            await genAttachmentFromPath('C:/docs/order.txt'),
        );

        expect(attachment).toMatchObject({
            kind: 'text',
            name: 'order.txt',
            filePath: 'C:/docs/order.txt',
        });
        expect(attachment.summary).toBe(
            'The user attached a file called "order.txt":\n' +
                'Hymn 1\nReading\nHymn 2',
        );
    });

    test('a Bible note goes in as its notes, never as its JSON', async () => {
        diskState.sizeMap.set('C:/notes/sermon.own', 200);
        diskState.textMap.set(
            'C:/notes/sermon.own',
            JSON.stringify({ items: [{ title: 'Grace', content: '' }] }),
        );

        const attachment = expectAttachment(
            await genAttachmentFromPath('C:/notes/sermon.own'),
        );

        expect(attachment.summary).toBe(
            'The user attached a file called "sermon.own":\n' +
                'Note: Grace\n(empty)',
        );
        expect(attachment.summary).not.toContain('"items"');

        // A note file that is not one the editor wrote goes in as it is.
        diskState.sizeMap.set('C:/notes/odd.own', 9);
        diskState.textMap.set('C:/notes/odd.own', 'not json');
        const odd = expectAttachment(
            await genAttachmentFromPath('C:/notes/odd.own'),
        );
        expect(odd.summary).toContain('not json');
    });

    test('a text file that cannot be read, or a kind it cannot read, is refused', async () => {
        diskState.sizeMap.set('C:/docs/locked.md', 20);
        expect(
            expectFailure(await genAttachmentFromPath('C:/docs/locked.md')),
        ).toBe('I cannot read locked.md — try a picture of it instead.');
        diskState.sizeMap.set('C:/docs/report.docx', 20);
        expect(
            expectFailure(await genAttachmentFromPath('C:/docs/report.docx')),
        ).toBe('I cannot read report.docx — try a picture of it instead.');
    });
});

describe('reloadFileAttachment', () => {
    test('a PDF whose pages were let go is drawn again; one that has them is not', async () => {
        const attachment = genFileAttachment('LUK.6.pdf', 10, 'C:/LUK.6.pdf');
        sendState.answer = { isSuccessful: true, dataUrls: [PAGE_ONE] };

        await reloadFileAttachment(attachment);
        expect(getAttachmentPages(attachment.id)).toEqual([PAGE_ONE]);

        await reloadFileAttachment(attachment);
        // Held already: main is not asked a second time.
        expect(sendState.channelList).toHaveLength(1);

        const undrawn = genFileAttachment('x.pdf', 10, 'C:/x.pdf');
        sendState.answer = { isSuccessful: false };
        await reloadFileAttachment(undrawn);
        expect(getAttachmentPages(undrawn.id)).toEqual([]);
        dropAttachmentData(attachment.id);
    });

    test('a picture is read again under the id the tab knows it by', async () => {
        diskState.sizeMap.set('C:/pics/stage.webp', 3);
        diskState.bytesMap.set('C:/pics/stage.webp', new Uint8Array([7, 7, 7]));
        const attachment: ChatAttachmentType = {
            id: 'tab-picture-1',
            kind: 'image',
            name: 'stage.webp',
            mimeType: 'image/webp',
            byteSize: 3,
            filePath: 'C:/pics/stage.webp',
        };

        await reloadFileAttachment(attachment);
        expect(getAttachmentData('tab-picture-1')).toBe(
            'data:image/webp;base64,BwcH',
        );

        // Already held: not read off the disk again.
        await reloadFileAttachment(attachment);
        expect(diskState.readCountMap.get('C:/pics/stage.webp')).toBe(1);
        dropAttachmentData('tab-picture-1');
    });

    test('nothing is read for a file with no path, a moved one, or words', async () => {
        await reloadFileAttachment({
            id: 'pasted',
            kind: 'image',
            name: 'pasted.png',
            mimeType: 'image/png',
            byteSize: 1,
        });
        expect(getAttachmentData('pasted')).toBeNull();

        // Too large to read again.
        diskState.sizeMap.set('C:/pics/huge.png', 17 * 1024 * 1024);
        await reloadFileAttachment({
            id: 'huge',
            kind: 'image',
            name: 'huge.png',
            mimeType: 'image/png',
            byteSize: 1,
            filePath: 'C:/pics/huge.png',
        });
        expect(getAttachmentData('huge')).toBeNull();
        expect(diskState.readCountMap.get('C:/pics/huge.png')).toBeUndefined();

        const text = genTextAttachment('a.txt', 'words', 'C:/a.txt');
        await reloadFileAttachment(text);
        expect(diskState.readCountMap.size).toBe(0);
        expect(sendState.channelList).toEqual([]);
    });

    test('a picture held by the store is left alone even with a path', async () => {
        putAttachmentData('held', PAGE_ONE);
        await reloadFileAttachment({
            id: 'held',
            kind: 'image',
            name: 'held.png',
            mimeType: 'image/png',
            byteSize: 1,
            filePath: 'C:/pics/held.png',
        });
        expect(getAttachmentData('held')).toBe(PAGE_ONE);
        dropAttachmentData('held');
        putAttachmentPages('pages', [PAGE_ONE, PAGE_TWO]);
        dropAttachmentData('pages');
    });
});

describe('findResourceFileNames', () => {
    test('names each file inside a Resources folder as the tool does, once', () => {
        folderState.dirPaths = ['C:/Data/Resources/pdf', 'D:/Other/notes/'];
        const luke = genFileAttachment(
            'LUK.6.pdf',
            1,
            'C:\\Data\\Resources\\pdf\\LUK.6.pdf',
        );
        const lukeAgain = genFileAttachment(
            'LUK.6.pdf',
            1,
            'C:/Data/Resources/pdf/LUK.6.pdf',
        );
        const outside = genFileAttachment('x.pdf', 1, 'C:/Elsewhere/x.pdf');
        const nested = genFileAttachment(
            'GEN.1.pdf',
            1,
            'D:/Other/notes/genesis/GEN.1.pdf',
        );

        expect(
            findResourceFileNames([luke, lukeAgain, outside, nested]),
        ).toEqual(['pdf/LUK.6.pdf', 'notes/genesis/GEN.1.pdf']);
    });

    test('reads no setting for a question with no file on it', () => {
        const text = genTextAttachment('a.txt', 'words');
        expect(findResourceFileNames([text])).toEqual([]);
        expect(folderState.readCount).toBe(0);
    });

    test('no folders, or a folder list that cannot be read, names nothing', () => {
        const luke = genFileAttachment('LUK.6.pdf', 1, 'C:/r/LUK.6.pdf');
        expect(findResourceFileNames([luke])).toEqual([]);
        folderState.isThrowing = true;
        expect(findResourceFileNames([luke])).toEqual([]);
        expect(folderState.readCount).toBe(2);
    });
});
