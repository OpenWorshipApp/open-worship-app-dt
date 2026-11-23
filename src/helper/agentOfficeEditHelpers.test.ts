import { beforeEach, describe, expect, test, vi } from 'vitest';

import { toZipBytes } from '../ms-office/officeZipHelpers';

// The worker behind `owa_office_edit`, driven against a disk that lives in
// memory with a real (small) deck and Word file: what it reads, what it
// refuses before anything is kept, and that a change is the whole file
// backed up first, written beside it and moved over it.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        documentsDir: '/documents' as string | null,
        disk: {} as Record<string, Uint8Array>,
        sizes: {} as Record<string, number>,
        moveError: null as (Error & { code?: string }) | null,
        backupError: null as Error | null,
        isWindows: false,
    },
    mocks: {
        handleError: vi.fn(),
        runWithAgentBackup: vi.fn(),
        fireUpdateEvent: vi.fn(),
        fsDeleteFile: vi.fn(),
        sinkAbort: vi.fn(),
    },
}));

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    getActiveDirSourceSettingName: (settingName: string) => settingName,
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'select-dir-app-document' },
}));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) => {
            return settingName === 'select-dir-app-document'
                ? state.documentsDir
                : null;
        },
    },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isWindows() {
                return state.isWindows;
            },
        },
    },
}));
vi.mock('../server/storageFileHelpers', () => ({
    pathJoin: (dir: string, name: string) => {
        return `${dir.replace(/\/$/, '')}/${name}`;
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => {
        return Object.hasOwn(state.disk, filePath);
    },
    fsGetFileStamp: async (filePath: string) => {
        return Object.hasOwn(state.disk, filePath)
            ? {
                  size: state.sizes[filePath] ?? state.disk[filePath].length,
                  modifiedAt: 0,
              }
            : null;
    },
    fsReadFileBytes: async (filePath: string) => {
        return state.disk[filePath];
    },
    fsMove: async (fromPath: string, toPath: string) => {
        if (state.moveError !== null) {
            throw state.moveError;
        }
        state.disk[toPath] = state.disk[fromPath];
        delete state.disk[fromPath];
    },
    fsDeleteFile: async (filePath: string) => {
        mocks.fsDeleteFile(filePath);
        delete state.disk[filePath];
    },
    getFileFullName: (filePath: string) => {
        return filePath.split(/[\\/]/).at(-1);
    },
}));
vi.mock('../ms-office/officeFileSinkHelpers', () => ({
    createOfficeFileSink: (filePath: string) => {
        const chunks: Uint8Array[] = [];
        return {
            write: async (chunk: Uint8Array) => {
                chunks.push(chunk);
            },
            close: async () => {
                const size = chunks.reduce((sum, one) => sum + one.length, 0);
                const bytes = new Uint8Array(size);
                let offset = 0;
                for (const chunk of chunks) {
                    bytes.set(chunk, offset);
                    offset += chunk.length;
                }
                state.disk[filePath] = bytes;
            },
            abort: mocks.sinkAbort,
        };
    },
}));
vi.mock('./agentBackupPlanHelpers', () => ({
    AGENT_BACKUP_MAX_BLOB_BYTES: 1_000_000,
}));
vi.mock('./agentBackupHelpers', () => {
    class NoBackupError extends Error {}
    return {
        NoBackupError,
        genBlobTooBigReason: (fileName: string, size: number) => {
            return `"${fileName}" is ${size} bytes, too big for the copy`;
        },
        genUndoField: (meta: { id: string }) => {
            return { undoId: meta.id, undo: `owa_undo ${meta.id}` };
        },
        runWithAgentBackup: async (
            summary: string,
            restores: unknown[],
            change: () => Promise<unknown>,
        ) => {
            mocks.runWithAgentBackup(summary, restores);
            if (state.backupError !== null) {
                throw new NoBackupError(state.backupError.message);
            }
            const value = await change();
            return { meta: { id: 'undo-1' }, value };
        },
    };
});
vi.mock('./FileSource', () => ({
    default: {
        getInstance: () => {
            return { fireUpdateEvent: mocks.fireUpdateEvent };
        },
    },
}));

import { handleAgentOfficeEditRequest } from './agentOfficeEditHelpers';

const REL =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

function genRels(rels: [string, string, string][]) {
    return (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        rels
            .map(([id, type, target]) => {
                return `<Relationship Id="${id}" Type="${REL}${type}" Target="${target}"/>`;
            })
            .join('') +
        '</Relationships>'
    );
}

function genSlide(title: string, line: string) {
    return (
        '<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/>' +
        '<p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>' +
        '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1"/>' +
        `<a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>` +
        '<p:sp><p:nvSpPr><p:cNvPr id="3" name="TextBox 2"/><p:cNvSpPr/>' +
        '<p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>' +
        `<a:p><a:r><a:rPr/><a:t>${line}</a:t></a:r></a:p>` +
        '</p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
    );
}

async function genDeckBytes() {
    return await toZipBytes([
        {
            fileName: '[Content_Types].xml',
            data:
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Override PartName="/ppt/slides/slide1.xml" ContentType="s"/>' +
                '<Override PartName="/ppt/slides/slide2.xml" ContentType="s"/>' +
                '</Types>',
        },
        {
            fileName: '_rels/.rels',
            data: genRels([['rId1', 'officeDocument', 'ppt/presentation.xml']]),
        },
        {
            fileName: 'ppt/presentation.xml',
            data:
                '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>' +
                '<p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/>' +
                '</p:sldIdLst></p:presentation>',
        },
        {
            fileName: 'ppt/_rels/presentation.xml.rels',
            data: genRels([
                ['rId2', 'slide', 'slides/slide1.xml'],
                ['rId3', 'slide', 'slides/slide2.xml'],
            ]),
        },
        {
            fileName: 'ppt/slides/slide1.xml',
            data: genSlide('Welcome', 'Good morning, church'),
        },
        {
            fileName: 'ppt/slides/slide2.xml',
            data: genSlide('Amazing Grace', 'How sweet the sound'),
        },
    ]);
}

async function genWordBytes() {
    return await toZipBytes([
        {
            fileName: '_rels/.rels',
            data: genRels([['rId1', 'officeDocument', 'word/document.xml']]),
        },
        {
            fileName: 'word/document.xml',
            data:
                '<w:document xmlns:w="w"><w:body>' +
                '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
                '<w:r><w:t>Notes</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>Read Exodus 3.</w:t></w:r></w:p>' +
                '<w:sectPr/></w:body></w:document>',
        },
    ]);
}

const DECK_PATH = '/documents/Sunday.pptx';
const WORD_PATH = '/documents/Notes.docx';
let deckBytes: Uint8Array;

beforeEach(async () => {
    vi.clearAllMocks();
    deckBytes = await genDeckBytes();
    state.documentsDir = '/documents';
    state.disk = {
        [DECK_PATH]: deckBytes,
        [WORD_PATH]: await genWordBytes(),
        '/documents/Old.ppt': new Uint8Array([1, 2, 3]),
    };
    state.sizes = {};
    state.moveError = null;
    state.backupError = null;
    state.isWindows = false;
});

async function readLines(request: object) {
    const result: any = await handleAgentOfficeEditRequest({
        action: 'read',
        ...request,
    });
    return result;
}

describe('read', () => {
    test('a deck by its Documents name: slides, ids and boxes', async () => {
        const result = await readLines({ name: 'Sunday.pptx' });
        expect(result.file).toBe('Sunday.pptx');
        expect(result.kind).toBe('PowerPoint');
        expect(result.slideCount).toBe(2);
        expect(result.slides[0].lines).toEqual([
            { id: '1.1', box: 'title', text: 'Welcome' },
            { id: '1.2', box: 'TextBox 2', text: 'Good morning, church' },
        ]);
    });

    test('a Word file by its whole path, read being the default', async () => {
        const result: any = await handleAgentOfficeEditRequest({
            filePath: WORD_PATH,
        });
        expect(result.kind).toBe('Word');
        expect(result.lines).toEqual([
            { id: '1', style: 'Heading1', text: 'Notes' },
            { id: '2', text: 'Read Exodus 3.' },
        ]);
    });

    test('`start` reads on from a slide', async () => {
        const result = await readLines({ name: 'Sunday.pptx', start: 2 });
        expect(
            result.slides.map((slide: any) => {
                return slide.slide;
            }),
        ).toEqual([2]);
    });
});

describe('what it refuses before reading', () => {
    test.each([
        [{ action: 'delete', name: 'Sunday.pptx' }, 'Unknown action'],
        [{ filePath: 'documents/Sunday.pptx' }, 'the whole path'],
        [{ filePath: '/documents/../etc/Sunday.pptx' }, 'step out'],
        [{ name: 'Old.ppt' }, 'saved again as .pptx'],
        [{ name: 'Missing.pptx' }, 'There is no file "Missing.pptx"'],
        [{ name: '' }, 'Give the `filePath`'],
        [{ name: 'a/b.pptx' }, '/'],
    ])('%j', async (request, words) => {
        const result: any = await handleAgentOfficeEditRequest(request);
        expect(result.isError).toBe(true);
        expect(result.reason).toContain(words);
    });

    test('no Documents folder', async () => {
        state.documentsDir = null;
        const result: any = await readLines({ name: 'Sunday.pptx' });
        expect(result.reason).toContain('No Documents folder');
    });

    test('a file too big to back up is not read at all', async () => {
        state.sizes[DECK_PATH] = 2_000_000;
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            replace: [{ from: 'Welcome', to: 'Hello' }],
        });
        expect(result.reason).toContain('too big for the copy');
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });
});

describe('edit', () => {
    test('one call, one backup of the whole file, the file replaced', async () => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            replace: [{ from: 'church', to: 'friends' }],
            changes: [{ id: '2.1', text: 'Amazing Grace!' }],
        });
        expect(result).toMatchObject({
            file: 'Sunday.pptx',
            didChange: true,
            note: 'Kept in the file at once.',
            undoId: 'undo-1',
        });
        expect(result.changed).toHaveLength(2);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledTimes(1);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Changed “Sunday.pptx”',
            [{ type: 'blob', filePath: DECK_PATH, sourcePath: DECK_PATH }],
        );
        expect(mocks.fireUpdateEvent).toHaveBeenCalledTimes(1);
        // nothing left beside it but the file itself
        expect(Object.keys(state.disk).sort()).toEqual(
            ['/documents/Old.ppt', DECK_PATH, WORD_PATH].sort(),
        );
        const read = await readLines({ name: 'Sunday.pptx' });
        expect(read.slides[0].lines[1].text).toBe('Good morning, friends');
        expect(read.slides[1].lines[0]).toEqual({
            id: '2.1',
            box: 'title',
            text: 'Amazing Grace!',
        });
    });

    test('a line added says the ids moved', async () => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            filePath: WORD_PATH,
            changes: [{ after: '1', text: 'Sunday 9am' }],
        });
        expect(result.note).toContain('read it again');
        const read = await readLines({ filePath: WORD_PATH });
        expect(
            read.lines.map((line: any) => {
                return line.text;
            }),
        ).toEqual(['Notes', 'Sunday 9am', 'Read Exodus 3.']);
    });

    test("a copy's lines come back by their new ids", async () => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            changes: [{ slide: 1, duplicate: true, to: 3 }],
        });
        expect(result.copies).toEqual([
            {
                slide: 3,
                lines: [
                    { id: '3.1', box: 'title', text: 'Welcome' },
                    {
                        id: '3.2',
                        box: 'TextBox 2',
                        text: 'Good morning, church',
                    },
                ],
                // its boxes too, so a box on the copy is named at once
                boxes: [
                    { name: 'Title 1', lines: '3.1' },
                    { name: 'TextBox 2', lines: '3.2' },
                ],
            },
        ]);
        expect(result.note).toContain("a copy's lines are in `copies`");
        // a call that copies nothing reads nothing more
        const plain: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            changes: [{ id: '1.1', text: 'Hello' }],
        });
        expect(plain.copies).toBeUndefined();
    });

    test("a copy's line named in the call that makes it says how", async () => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            changes: [
                { slide: 1, duplicate: true, to: 3 },
                { id: '3.1', text: 'See You Next Week' },
            ],
        });
        expect(result.reason).toBe(
            'Nothing was changed. There is no line "3.1" yet: ids are as ' +
                'read, and a copy made in this call has none. Make the copy ' +
                "alone: the answer gives the copy's lines by their ids.",
        );
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('a refusal keeps nothing and takes no backup', async () => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            changes: [{ id: '9.9', text: 'x' }],
        });
        expect(result.reason).toMatch(
            /^Nothing was changed\. There is no line/,
        );
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(state.disk[DECK_PATH]).toBe(deckBytes);
    });

    test.each([
        [{}, 'Say what to change'],
        [{ changes: ['x'] }, 'is an object'],
        [
            {
                changes: Array.from({ length: 201 }, (_, index) => {
                    return { id: '1.1', text: String(index) };
                }),
            },
            'At most 200',
        ],
    ])('%#: an ask that cannot be a change', async (extra, words) => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            ...extra,
        });
        expect(result.reason).toContain(words);
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('a file open in another program is left as it was', async () => {
        state.moveError = Object.assign(new Error('busy'), { code: 'EBUSY' });
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            replace: [{ from: 'Welcome', to: 'Hello' }],
        });
        expect(result.reason).toContain('Close it in PowerPoint or Word');
        expect(result.reason).toContain('The file is as it was.');
        expect(mocks.sinkAbort).toHaveBeenCalledTimes(1);
        expect(mocks.fsDeleteFile).toHaveBeenCalledWith(
            expect.stringMatching(
                /^\/documents\/\.Sunday\.pptx\..+\.owa-edit$/,
            ),
        );
        expect(state.disk[DECK_PATH]).toBe(deckBytes);
        expect(mocks.fireUpdateEvent).not.toHaveBeenCalled();
    });

    // EC-766: on a Mac nothing stops the write, and PowerPoint's next save
    // puts its own copy back over it -- the file it keeps beside an open
    // document says so first
    test.each([
        ['Sunday.pptx', '~$Sunday.pptx', 'PowerPoint'],
        ['Sunday.pptx', '.~lock.Sunday.pptx#', 'LibreOffice'],
        ['Notes.docx', '~$tes.docx', 'Word'],
    ])(
        '%s open in a program (%s) is not written',
        async (name, ownerName, program) => {
            state.disk[`/documents/${ownerName}`] = new Uint8Array([1]);
            const before = state.disk[`/documents/${name}`];
            const result: any = await handleAgentOfficeEditRequest({
                action: 'edit',
                name,
                replace: [{ from: 'Welcome', to: 'Hello' }],
            });
            expect(result.reason).toBe(
                `Nothing was changed. "${name}" is open in ${program}, on ` +
                    'this computer or on another sharing its folder ' +
                    `(${program} keeps "${ownerName}" beside it while it ` +
                    `is open), and ${program}'s next save would put its ` +
                    'own copy back over a change made now. Ask them to ' +
                    'close it there and ask again. If it is not open ' +
                    'anywhere, that hidden file was left behind: once it ' +
                    'is deleted the change can be made.',
            );
            expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
            expect(state.disk[`/documents/${name}`]).toBe(before);
        },
    );

    test('on Windows the open file answers for itself', async () => {
        state.isWindows = true;
        state.disk['/documents/~$Sunday.pptx'] = new Uint8Array([1]);
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            replace: [{ from: 'Welcome', to: 'Hello' }],
        });
        expect(result.didChange).toBe(true);
    });

    test("another file's lock is not this one's", async () => {
        state.disk['/documents/~$Other.pptx'] = new Uint8Array([1]);
        state.disk['/documents/.~lock.Notes.docx#'] = new Uint8Array([1]);
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            replace: [{ from: 'Welcome', to: 'Hello' }],
        });
        expect(result.didChange).toBe(true);
    });

    test('no backup, no change', async () => {
        state.backupError = new Error('The backup could not be saved.');
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            replace: [{ from: 'Welcome', to: 'Hello' }],
        });
        expect(result).toEqual({
            isError: true,
            reason: 'The backup could not be saved.',
        });
        expect(state.disk[DECK_PATH]).toBe(deckBytes);
    });
});

describe('a picture put into the deck (EC-770)', () => {
    const PHOTO_PATH = '/Users/a/Pictures/Choir.png';
    // a PNG's header: 1600 x 900, all a slide needs to place it
    const photo = new Uint8Array(40);
    photo.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(photo.buffer).setUint32(16, 1600);
    new DataView(photo.buffer).setUint32(20, 900);

    test('read off the disk once, kept in the deck, backed up first', async () => {
        state.disk[PHOTO_PATH] = photo;
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            changes: [
                { slide: 2, picture: PHOTO_PATH, at: [50, 50, 40, null] },
            ],
        });
        expect(result).toMatchObject({ didChange: true, undoId: 'undo-1' });
        expect(result.changed).toEqual([
            'Added “Choir.png” as "Picture 3" on slide 2 ("Amazing Grace") ' +
                'at [50, 50, 40, ' +
                '40], in front.',
        ]);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledTimes(1);
        // the picture on disk is untouched
        expect(state.disk[PHOTO_PATH]).toBe(photo);
        const read = await readLines({ name: 'Sunday.pptx' });
        expect(read.slides[1].boxes).toContainEqual({
            name: 'Picture 3',
            kind: 'picture',
            at: [50, 50, 40, 40],
        });
    });

    test.each([
        ['a path that is not whole', 'Pictures/Choir.png'],
        ['a file that is no picture', '/Users/a/notes.txt'],
        ['a path climbing out', '/Users/a/../b/Choir.png'],
    ])('refused, nothing read: %s', async (_label, picture) => {
        const result: any = await handleAgentOfficeEditRequest({
            action: 'edit',
            name: 'Sunday.pptx',
            changes: [{ slide: 1, picture }],
        });
        expect(result).toEqual({
            isError: true,
            reason:
                '`picture` is a picture attached to the chat, by its name: ' +
                'a PNG, JPEG, GIF or BMP file.',
        });
        expect(state.disk[DECK_PATH]).toBe(deckBytes);
    });

    test('refused: a picture gone, one too big, too many at once', async () => {
        const run = async (changes: object[]) => {
            return await handleAgentOfficeEditRequest({
                action: 'edit',
                name: 'Sunday.pptx',
                changes,
            });
        };
        expect(await run([{ slide: 1, picture: PHOTO_PATH }])).toEqual({
            isError: true,
            reason: 'The picture "Choir.png" could not be read.',
        });
        state.disk[PHOTO_PATH] = photo;
        state.sizes[PHOTO_PATH] = 30 * 1024 * 1024;
        expect(await run([{ slide: 1, picture: PHOTO_PATH }])).toEqual({
            isError: true,
            reason:
                'The picture "Choir.png" is over 25 MB: make it smaller ' +
                'first, or put it in in PowerPoint.',
        });
        expect(
            await run(
                Array.from({ length: 11 }, (_one, index) => {
                    return { slide: 1, picture: `/p/${index}.png` };
                }),
            ),
        ).toEqual({
            isError: true,
            reason: 'At most 10 pictures in one call: send the rest in another.',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(state.disk[DECK_PATH]).toBe(deckBytes);
    });
});
