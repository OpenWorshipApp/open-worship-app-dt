import { beforeEach, describe, expect, test, vi } from 'vitest';

// A document's words when the app's preview of it cannot be trusted: an
// `info.json` that is not JSON, a page `info.json` names that is not on the
// disk, and a file whose md5 cannot be worked out. The disk, the main
// process's converters and the md5 are stood in for, as in the sibling
// suite; the HTML readers are the real ones.
const { diskState, sendState, md5State } = vi.hoisted(() => ({
    diskState: {
        sizeMap: new Map<string, number>(),
        textMap: new Map<string, string>(),
        deletedList: [] as string[],
    },
    sendState: {
        channelList: [] as { channel: string; data: any }[],
        convertedMap: new Map<string, Record<string, string>>(),
    },
    md5State: {
        map: new Map<string, string>(),
        isFailing: false,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => {
        return diskState.textMap.has(filePath);
    },
    fsDeleteDir: async (dirPath: string) => {
        diskState.deletedList.push(dirPath);
        for (const key of [...diskState.textMap.keys()]) {
            if (key.startsWith(`${dirPath}/`)) {
                diskState.textMap.delete(key);
            }
        }
    },
    fsGetFileSize: async (filePath: string) => {
        const size = diskState.sizeMap.get(filePath);
        if (size === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return size;
    },
    fsReadFile: async (filePath: string) => {
        const text = diskState.textMap.get(filePath);
        if (text === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return text;
    },
    getTempPath: () => {
        return '/tmp';
    },
    pathBasename: (filePath: string) => {
        return filePath.split('/').pop() ?? '';
    },
    pathDirname: (filePath: string) => {
        return filePath.split('/').slice(0, -1).join('/');
    },
    pathJoin: (...parts: string[]) => {
        return parts.join('/').replace(/\/+/g, '/');
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: async (channel: string, data: any) => {
        sendState.channelList.push({ channel, data });
        const fileName = String(data.filePath).split('/').pop() ?? '';
        const written = sendState.convertedMap.get(fileName);
        if (written === undefined) {
            return false;
        }
        for (const [name, text] of Object.entries(written)) {
            diskState.textMap.set(`${data.outDir}/${name}`, text);
        }
        return true;
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            generateFileMD5: async (filePath: string) => {
                if (md5State.isFailing) {
                    throw new Error(`EACCES: ${filePath}`);
                }
                return md5State.map.get(filePath) ?? 'another-copy';
            },
        },
    },
}));

import { readDocumentWords } from './documentWordsHelpers';

function genSlideHtml(lines: string[]) {
    return (
        '<!DOCTYPE html><html><body><svg><g><foreignObject><div>' +
        lines
            .map((line) => {
                return `<p><span>${line}</span></p>`;
            })
            .join('') +
        '</div></foreignObject></g></svg></body></html>'
    );
}

const DECK_FILES = {
    'info.json': JSON.stringify({
        slides: [
            { htmlFileName: 'slide1.html' },
            // Named, never written.
            { htmlFileName: 'slide2.html' },
            { htmlFileName: 'slide3.html' },
        ],
        checksum: { md5: 'deck-md5' },
    }),
    'slide1.html': genSlideHtml(['Amazing grace', 'how sweet']),
    'slide3.html': genSlideHtml(['I once was lost', 'now found']),
};

const DECK_WORDS = 'Amazing grace\nhow sweet\n\nI once was lost\nnow found';

function putFolder(dirPath: string, files: Record<string, string>) {
    for (const [name, text] of Object.entries(files)) {
        diskState.textMap.set(`${dirPath}/${name}`, text);
    }
}

function listConverted() {
    return sendState.channelList.map((one) => {
        return one.channel;
    });
}

beforeEach(() => {
    diskState.sizeMap.clear();
    diskState.textMap.clear();
    diskState.deletedList.length = 0;
    sendState.channelList.length = 0;
    sendState.convertedMap.clear();
    md5State.map.clear();
    md5State.isFailing = false;
    diskState.sizeMap.set('/docs/Grace.pptx', 1000);
});

describe('the preview cannot be trusted', () => {
    test('a page info.json names but nobody wrote is left out, the others read', async () => {
        putFolder('/docs/Grace.pptx-htmls', DECK_FILES);
        md5State.map.set('/docs/Grace.pptx', 'deck-md5');
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        // The preview was the app's own and of this copy: nothing converted.
        expect(listConverted()).toEqual([]);
    });

    test('a preview info.json that is not JSON is no preview: a copy is converted', async () => {
        putFolder('/docs/Grace.pptx-htmls', {
            ...DECK_FILES,
            'info.json': '{"slides": [',
        });
        md5State.map.set('/docs/Grace.pptx', 'deck-md5');
        sendState.convertedMap.set('Grace.pptx', DECK_FILES);
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        expect(listConverted()).toEqual(['main:app:pptx-to-htmls']);
        // The copy's folder went; the person's preview stays as it was.
        expect(diskState.deletedList).toHaveLength(1);
        expect(diskState.textMap.get('/docs/Grace.pptx-htmls/info.json')).toBe(
            '{"slides": [',
        );
    });

    test('a file whose md5 cannot be read is converted afresh', async () => {
        putFolder('/docs/Grace.pptx-htmls', {
            ...DECK_FILES,
            'slide1.html': genSlideHtml(['Words of another copy']),
        });
        md5State.isFailing = true;
        sendState.convertedMap.set('Grace.pptx', DECK_FILES);
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        expect(listConverted()).toEqual(['main:app:pptx-to-htmls']);
    });

    test('a converted copy whose info.json is not JSON is no words', async () => {
        sendState.convertedMap.set('Grace.pptx', {
            ...DECK_FILES,
            'info.json': 'not json',
        });
        expect(await readDocumentWords('/docs/Grace.pptx')).toBeNull();
        expect(listConverted()).toEqual(['main:app:pptx-to-htmls']);
        expect(diskState.deletedList).toHaveLength(1);
    });
});
