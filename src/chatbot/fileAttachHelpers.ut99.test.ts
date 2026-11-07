// @vitest-environment jsdom
// A file on disk, made into something the assistant can read
// (`fileAttachHelpers.ts`): what is refused and the words the person is
// shown, what is held for the model -- a PDF's pages, a picture's bytes, a
// note's words -- and what is never read at all.
//
// The attachment store is the REAL one (`attachmentHelpers.ts`), so a test
// can say which pages and which bytes would reach the model. Only the disk,
// the main-process PDF drawer and the Resources folder setting are fakes.
// jsdom for `FileReader` (a picture off the disk becomes a data URL through
// it); `Image` is stubbed because jsdom never loads one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        electronSendAsync: vi.fn(),
        fsGetFileSize: vi.fn(),
        fsReadFile: vi.fn(),
        fsReadFileBytes: vi.fn(),
        getResourcesFolderList: vi.fn(),
        // What the stubbed `Image` decodes a data URL to; null fails it.
        imageSize: null as { width: number; height: number } | null,
    };
});

vi.mock('../server/electronSendHelpers', () => {
    return {
        electronSendAsync: (...args: any[]) => h.electronSendAsync(...args),
    };
});

vi.mock('../server/fileHelpers', () => {
    return {
        fsGetFileSize: (...args: any[]) => h.fsGetFileSize(...args),
        fsReadFile: (...args: any[]) => h.fsReadFile(...args),
        fsReadFileBytes: (...args: any[]) => h.fsReadFileBytes(...args),
        // As `path.basename` does: a trailing separator is not a name.
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
    };
});

vi.mock('../resources/resourcesFolderHelpers', () => {
    return {
        getResourcesFolderList: () => h.getResourcesFolderList(),
    };
});

import {
    type ChatAttachmentType,
    dropAttachmentData,
    getAttachmentData,
    getAttachmentPages,
    putAttachmentData,
    putAttachmentPages,
} from './attachmentHelpers';
import {
    findResourceFileNames,
    genAttachmentFromPath,
    genPdfAttachment,
    reloadFileAttachment,
} from './fileAttachHelpers';

const MB = 1024 * 1024;
const PNG_PAGE = 'data:image/png;base64,UEFHRTE=';
const JPEG_PAGE = 'data:image/jpeg;base64,UEFHRTI=';

class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 0;
    height = 0;
    set src(_value: string) {
        queueMicrotask(() => {
            if (h.imageSize === null) {
                this.onerror?.();
                return;
            }
            this.width = h.imageSize.width;
            this.height = h.imageSize.height;
            this.onload?.();
        });
    }
}

function toBase64(bytes: Uint8Array) {
    return Buffer.from(bytes).toString('base64');
}

const heldIdList: string[] = [];

function hold<T extends { id: string }>(attachment: T) {
    heldIdList.push(attachment.id);
    return attachment;
}

let originalImage: any;

beforeEach(() => {
    originalImage = (globalThis as any).Image;
    (globalThis as any).Image = FakeImage;
    h.imageSize = { width: 320, height: 200 };
    h.electronSendAsync.mockResolvedValue({
        isSuccessful: true,
        pageCount: 2,
        dataUrls: [PNG_PAGE, JPEG_PAGE],
    });
    h.fsGetFileSize.mockResolvedValue(2048);
    h.fsReadFile.mockResolvedValue('');
    h.fsReadFileBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    h.getResourcesFolderList.mockReturnValue([]);
});

afterEach(() => {
    (globalThis as any).Image = originalImage;
    for (const id of heldIdList.splice(0)) {
        dropAttachmentData(id);
    }
});

describe('genPdfAttachment', () => {
    it('asks main to draw the pages and holds only png and jpeg pictures', async () => {
        h.electronSendAsync.mockResolvedValue({
            isSuccessful: true,
            pageCount: 12,
            dataUrls: [
                PNG_PAGE,
                'data:image/gif;base64,R0lG',
                42,
                'https://example.com/page.png',
                JPEG_PAGE,
            ],
        });
        const attachment = hold(
            await genPdfAttachment('LUK.6.pdf', 4096, '/res/pdf/LUK.6.pdf'),
        );
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            'main:app:pdf-to-chat-pages',
            { filePath: '/res/pdf/LUK.6.pdf' },
        );
        expect(attachment).toMatchObject({
            kind: 'file',
            name: 'LUK.6.pdf',
            mimeType: 'application/pdf',
            byteSize: 4096,
            filePath: '/res/pdf/LUK.6.pdf',
            pageCount: 12,
        });
        expect(getAttachmentPages(attachment.id)).toEqual([
            PNG_PAGE,
            JPEG_PAGE,
        ]);
    });

    it('still attaches a PDF main could not draw, with no pages and no count', async () => {
        h.electronSendAsync.mockResolvedValue({
            isSuccessful: false,
            message: 'broken file',
        });
        const attachment = hold(
            await genPdfAttachment('scan.pdf', 10, '/x/scan.pdf'),
        );
        expect(attachment.kind).toBe('file');
        expect('pageCount' in attachment).toBe(false);
        expect(getAttachmentPages(attachment.id)).toEqual([]);
        expect(attachment.summary).toContain('You cannot read what is inside');
    });

    it('treats a reply without a page list, or a thrown send, as no pages', async () => {
        h.electronSendAsync.mockResolvedValueOnce({
            isSuccessful: true,
            pageCount: 3,
            dataUrls: 'not-a-list',
        });
        const first = hold(await genPdfAttachment('a.pdf', 1, '/a.pdf'));
        expect(getAttachmentPages(first.id)).toEqual([]);
        expect('pageCount' in first).toBe(false);

        h.electronSendAsync.mockRejectedValueOnce(new Error('no main'));
        const second = hold(await genPdfAttachment('b.pdf', 1, '/b.pdf'));
        expect(getAttachmentPages(second.id)).toEqual([]);
    });

    it('keeps the pages but drops a page count that is not a number', async () => {
        h.electronSendAsync.mockResolvedValue({
            isSuccessful: true,
            pageCount: '7',
            dataUrls: [PNG_PAGE],
        });
        const attachment = hold(await genPdfAttachment('c.pdf', 1, '/c.pdf'));
        expect('pageCount' in attachment).toBe(false);
        expect(getAttachmentPages(attachment.id)).toEqual([PNG_PAGE]);
    });
});

describe('reloadFileAttachment', () => {
    function genAttachment(
        overrides: Partial<ChatAttachmentType>,
    ): ChatAttachmentType {
        return hold({
            id: `reload-${heldIdList.length}`,
            kind: 'file',
            name: 'LUK.6.pdf',
            mimeType: 'application/pdf',
            byteSize: 10,
            filePath: '/res/pdf/LUK.6.pdf',
            ...overrides,
        });
    }

    it('reads nothing for an attachment that never came from disk', async () => {
        const attachment = genAttachment({ filePath: undefined });
        await reloadFileAttachment(attachment);
        expect(h.electronSendAsync).not.toHaveBeenCalled();
        expect(h.fsGetFileSize).not.toHaveBeenCalled();
    });

    it('leaves a PDF whose pages are still held alone', async () => {
        const attachment = genAttachment({});
        putAttachmentPages(attachment.id, [PNG_PAGE]);
        await reloadFileAttachment(attachment);
        expect(h.electronSendAsync).not.toHaveBeenCalled();
        expect(getAttachmentPages(attachment.id)).toEqual([PNG_PAGE]);
    });

    it('draws a let-go PDF again under the id the tab knows it by', async () => {
        const attachment = genAttachment({});
        await reloadFileAttachment(attachment);
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            'main:app:pdf-to-chat-pages',
            { filePath: '/res/pdf/LUK.6.pdf' },
        );
        expect(getAttachmentPages(attachment.id)).toEqual([
            PNG_PAGE,
            JPEG_PAGE,
        ]);
    });

    it('quietly does nothing for a PDF that moved', async () => {
        h.electronSendAsync.mockResolvedValue({ isSuccessful: false });
        const attachment = genAttachment({});
        await reloadFileAttachment(attachment);
        expect(getAttachmentPages(attachment.id)).toEqual([]);
    });

    it('never re-reads a text file: its words are on the message', async () => {
        const attachment = genAttachment({
            kind: 'text',
            name: 'notes.md',
            summary: 'kept',
        });
        await reloadFileAttachment(attachment);
        expect(h.fsGetFileSize).not.toHaveBeenCalled();
        expect(h.fsReadFile).not.toHaveBeenCalled();
    });

    it('leaves a picture whose bytes are still held alone', async () => {
        const attachment = genAttachment({
            kind: 'image',
            name: 'photo.png',
            filePath: '/pics/photo.png',
        });
        putAttachmentData(attachment.id, PNG_PAGE);
        await reloadFileAttachment(attachment);
        expect(h.fsReadFileBytes).not.toHaveBeenCalled();
        expect(getAttachmentData(attachment.id)).toBe(PNG_PAGE);
    });

    it('reads a let-go picture back off the disk, typed by its name', async () => {
        const bytes = new Uint8Array([255, 216, 255, 224]);
        h.fsReadFileBytes.mockResolvedValue(bytes);
        const attachment = genAttachment({
            kind: 'image',
            name: 'photo.JPG',
            filePath: '/pics/photo.JPG',
        });
        await reloadFileAttachment(attachment);
        expect(h.fsGetFileSize).toHaveBeenCalledWith('/pics/photo.JPG');
        expect(getAttachmentData(attachment.id)).toBe(
            `data:image/jpeg;base64,${toBase64(bytes)}`,
        );
    });

    it('takes a picture with no extension in its name as a PNG', async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        h.fsReadFileBytes.mockResolvedValue(bytes);
        const attachment = genAttachment({
            kind: 'image',
            name: 'my screen',
            filePath: '/pics/capture',
        });
        await reloadFileAttachment(attachment);
        expect(getAttachmentData(attachment.id)).toBe(
            `data:image/png;base64,${toBase64(bytes)}`,
        );
    });

    it('does not read a picture grown past 16 MB, nor hold one that fails', async () => {
        const big = genAttachment({
            kind: 'image',
            name: 'huge.png',
            filePath: '/pics/huge.png',
        });
        h.fsGetFileSize.mockResolvedValue(16 * MB + 1);
        await reloadFileAttachment(big);
        expect(h.fsReadFileBytes).not.toHaveBeenCalled();
        expect(getAttachmentData(big.id)).toBeNull();

        const broken = genAttachment({
            kind: 'image',
            name: 'broken.png',
            filePath: '/pics/broken.png',
        });
        h.fsGetFileSize.mockResolvedValue(100);
        h.fsReadFileBytes.mockRejectedValue(new Error('EACCES'));
        await reloadFileAttachment(broken);
        expect(getAttachmentData(broken.id)).toBeNull();
    });
});

describe('findResourceFileNames', () => {
    function genFile(filePath: string, id = filePath): ChatAttachmentType {
        return {
            id,
            kind: 'file',
            name: filePath.split('/').pop() ?? '',
            mimeType: 'application/pdf',
            byteSize: 1,
            filePath,
        };
    }

    it('reads no setting for a question with no file of the disk on it', () => {
        const names = findResourceFileNames([
            {
                id: 'e',
                kind: 'element',
                name: 'Clear All',
                mimeType: 'application/x-owa-element',
                byteSize: 0,
                filePath: '/x/y.pdf',
            },
            {
                id: 'shot',
                kind: 'image',
                name: 'my screen',
                mimeType: 'image/png',
                byteSize: 1,
                filePath: '/x/shot.png',
                window: {
                    id: 'T1',
                    page: 'presenter.html',
                    label: 'Presenter',
                    isMain: true,
                },
            },
            {
                id: 'pasted',
                kind: 'image',
                name: 'pasted',
                mimeType: 'image/png',
                byteSize: 1,
            },
        ]);
        expect(names).toEqual([]);
        expect(h.getResourcesFolderList).not.toHaveBeenCalled();
    });

    it('is empty when the folder list cannot be read or is empty', () => {
        h.getResourcesFolderList.mockImplementation(() => {
            throw new Error('setting store gone');
        });
        expect(findResourceFileNames([genFile('/res/pdf/LUK.6.pdf')])).toEqual(
            [],
        );
        h.getResourcesFolderList.mockReturnValue([]);
        expect(findResourceFileNames([genFile('/res/pdf/LUK.6.pdf')])).toEqual(
            [],
        );
    });

    it('names files as the tool does, once each, and skips files outside', () => {
        h.getResourcesFolderList.mockReturnValue([
            '/Users/me/Res/pdf/',
            '/Volumes/Stick/PDF',
        ]);
        const names = findResourceFileNames([
            genFile('/Users/me/Res/pdf/LUK.6.pdf', 'one'),
            genFile('/users/ME/res/pdf/LUK.6.pdf', 'two'),
            genFile('/Volumes/Stick/PDF/notes/GEN.1.pdf'),
            genFile('/Users/me/Desktop/other.pdf'),
        ]);
        // Two folders called "pdf" are told apart; the account name in the
        // folder's path never reaches the name.
        expect(names).toEqual(['pdf/LUK.6.pdf', 'PDF#2/notes/GEN.1.pdf']);
    });
});

describe('genAttachmentFromPath', () => {
    it('says a file that is gone is not there any more', async () => {
        h.fsGetFileSize.mockRejectedValue(new Error('ENOENT'));
        expect(await genAttachmentFromPath('C:\\docs\\gone.txt')).toEqual({
            failure: 'gone.txt is not there any more.',
        });
        expect(h.fsReadFile).not.toHaveBeenCalled();
    });

    it('attaches a PDF of any size: its pages are drawn in main, not read here', async () => {
        h.fsGetFileSize.mockResolvedValue(40 * MB);
        const result = await genAttachmentFromPath('/res/pdf/LUK.6.pdf');
        expect('attachment' in result).toBe(true);
        const attachment = hold((result as any).attachment);
        expect(attachment).toMatchObject({
            kind: 'file',
            byteSize: 40 * MB,
            pageCount: 2,
        });
        expect(getAttachmentPages(attachment.id)).toHaveLength(2);
        expect(h.fsReadFileBytes).not.toHaveBeenCalled();
    });

    it('refuses anything else past 16 MB, naming the cap, before reading it', async () => {
        h.fsGetFileSize.mockResolvedValue(16 * MB + 1);
        expect(await genAttachmentFromPath('/pics/big.png')).toEqual({
            failure: 'big.png is too large to attach — 16 MB at most.',
        });
        expect(await genAttachmentFromPath('/docs/log.txt')).toEqual({
            failure: 'log.txt is too large to attach — 16 MB at most.',
        });
        expect(h.fsReadFileBytes).not.toHaveBeenCalled();
        expect(h.fsReadFile).not.toHaveBeenCalled();
    });

    it('attaches a picture of exactly 16 MB as the bytes on disk', async () => {
        h.fsGetFileSize.mockResolvedValue(16 * MB);
        const bytes = new Uint8Array([9, 8, 7, 6, 5]);
        h.fsReadFileBytes.mockResolvedValue(bytes);
        const result = await genAttachmentFromPath('/pics/Choir.jpeg');
        const attachment = hold((result as any).attachment);
        const dataUrl = `data:image/jpeg;base64,${toBase64(bytes)}`;
        expect(attachment).toMatchObject({
            kind: 'image',
            name: 'Choir.jpeg',
            mimeType: 'image/jpeg',
            filePath: '/pics/Choir.jpeg',
            byteSize: toBase64(bytes).length,
        });
        expect(getAttachmentData(attachment.id)).toBe(dataUrl);
    });

    it('says it cannot read a picture that does not decode or cannot be read', async () => {
        const cannotRead = {
            failure: 'I cannot read odd.png — try a picture of it instead.',
        };
        h.imageSize = null;
        expect(await genAttachmentFromPath('/pics/odd.png')).toEqual(
            cannotRead,
        );
        h.imageSize = { width: 10, height: 10 };
        h.fsReadFileBytes.mockRejectedValue(new Error('EACCES'));
        expect(await genAttachmentFromPath('/pics/odd.png')).toEqual(
            cannotRead,
        );
    });

    it('reads a Bible note as its words, not its JSON', async () => {
        h.fsReadFile.mockResolvedValue(
            JSON.stringify({
                items: [
                    {
                        title: 'Sermon',
                        content: JSON.stringify({
                            root: {
                                type: 'root',
                                children: [
                                    {
                                        type: 'paragraph',
                                        children: [
                                            { text: 'Love one another' },
                                        ],
                                    },
                                ],
                            },
                        }),
                    },
                ],
            }),
        );
        const result = await genAttachmentFromPath('/notes/Week 1.own');
        const attachment = (result as any).attachment;
        expect(h.fsReadFile).toHaveBeenCalledWith('/notes/Week 1.own');
        expect(attachment).toMatchObject({
            kind: 'text',
            name: 'Week 1.own',
            filePath: '/notes/Week 1.own',
        });
        expect(attachment.summary).toBe(
            'The user attached a file called "Week 1.own":\n' +
                'Note: Sermon\nLove one another',
        );
    });

    it('falls back to the raw text of a note file that is not one', async () => {
        h.fsReadFile.mockResolvedValue('just some words');
        const result = await genAttachmentFromPath('/notes/plain.own');
        expect((result as any).attachment.summary).toBe(
            'The user attached a file called "plain.own":\njust some words',
        );
    });

    it('reads a text file as it is, and says so when it cannot', async () => {
        h.fsReadFile.mockResolvedValueOnce('# Order of service\n1. Welcome');
        const result = await genAttachmentFromPath('/docs/order.md');
        expect((result as any).attachment).toMatchObject({
            kind: 'text',
            mimeType: 'text/plain',
            byteSize: 29,
            summary:
                'The user attached a file called "order.md":\n' +
                '# Order of service\n1. Welcome',
        });
        h.fsReadFile.mockRejectedValueOnce(new Error('EBUSY'));
        expect(await genAttachmentFromPath('/docs/order.md')).toEqual({
            failure: 'I cannot read order.md — try a picture of it instead.',
        });
    });

    it('refuses a kind it cannot read by name, without reading it', async () => {
        expect(await genAttachmentFromPath('/docs/Sermon.docx')).toEqual({
            failure: 'I cannot read Sermon.docx — try a picture of it instead.',
        });
        expect(await genAttachmentFromPath('/pics/logo.svg')).toEqual({
            failure: 'I cannot read logo.svg — try a picture of it instead.',
        });
        expect(h.fsReadFile).not.toHaveBeenCalled();
        expect(h.fsReadFileBytes).not.toHaveBeenCalled();
    });
});
