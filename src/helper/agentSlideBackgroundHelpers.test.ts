import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
    const folders: Record<string, { filePath: string; fullName: string }[]> =
        {};
    const sidecar: { data: Record<string, any> } = { data: {} };
    const backups: { summary: string; restores: any[] }[] = [];
    return {
        folders,
        sidecar,
        backups,
        dirPathMap: {
            'select-dir-bg-image': 'C:\\bg\\images',
            'select-dir-bg-video': 'C:\\bg\\videos',
        } as Record<string, string | null>,
        setAttachedBackgrounds: vi.fn(
            async (
                _filePath: string,
                idList: (string | number | undefined)[],
                droppedData: any,
            ) => {
                for (const id of idList) {
                    const key = id === undefined ? 'self' : String(id);
                    if (droppedData === null) {
                        delete sidecar.data[key];
                    } else {
                        sidecar.data[key] = droppedData;
                    }
                }
            },
        ),
        isBackupBroken: { value: false },
    };
});

vi.mock('./constants', () => {
    return {
        dirSourceSettingNames: {
            BACKGROUND_IMAGE: 'select-dir-bg-image',
            BACKGROUND_VIDEO: 'select-dir-bg-video',
        },
    };
});
vi.mock('./DirSource', () => {
    return {
        default: {
            getDirPathBySettingName: (settingName: string) => {
                return mocked.dirPathMap[settingName] ?? null;
            },
        },
    };
});
vi.mock('./FileSource', () => {
    return {
        default: {
            getInstance: (filePath: string) => {
                return { filePath, isFileSource: true };
            },
        },
    };
});
vi.mock('./errorHelpers', () => {
    return { handleError: vi.fn() };
});
vi.mock('./agentBackupHelpers', () => {
    class NoBackupError extends Error {}
    return {
        ATTACHED_BACKGROUND_EXTENSION: '.bg.json',
        NoBackupError,
        genUndoField: (meta: { id: string }) => {
            return { undoId: meta.id, undo: `owa_undo ${meta.id}` };
        },
        listAgentFiles: async (dirPath: string) => {
            return mocked.folders[dirPath] ?? [];
        },
        snapshotAgentFile: async (filePath: string) => {
            return { type: 'file', filePath, text: '{}' };
        },
        runWithAgentBackup: async (
            summary: string,
            restores: any[],
            change: () => Promise<unknown>,
        ) => {
            if (mocked.isBackupBroken.value) {
                throw new NoBackupError('No backup could be kept.');
            }
            mocked.backups.push({ summary, restores });
            return { meta: { id: 'b-1' }, value: await change() };
        },
    };
});
vi.mock('../others/AttachBackgroundManager', () => {
    return {
        attachBackgroundManager: {
            readData: async () => {
                return mocked.sidecar.data;
            },
            setAttachedBackgrounds: mocked.setAttachedBackgrounds,
            toKey: (id?: string | number) => {
                return id === undefined ? 'self' : String(id);
            },
        },
    };
});

import {
    handleSlideBackgroundAt,
    readSlideBackgroundLines,
} from './agentSlideBackgroundHelpers';

const DOC_PATH = 'C:\\docs\\Talk.ows';
const json = { items: [{ id: 11 }, { id: 12 }, { id: 13 }] };

beforeEach(() => {
    mocked.folders['C:\\bg\\images'] = [
        { filePath: 'C:\\bg\\images\\sunrise.jpg', fullName: 'sunrise.jpg' },
    ];
    mocked.folders['C:\\bg\\videos'] = [
        { filePath: 'C:\\bg\\videos\\waves.mp4', fullName: 'waves.mp4' },
    ];
    mocked.sidecar.data = {};
    mocked.backups.length = 0;
    mocked.isBackupBroken.value = false;
    mocked.setAttachedBackgrounds.mockClear();
});

describe('setting a background', () => {
    it('puts a picture by name behind the slides asked, backed up first', async () => {
        const result = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'file', name: 'SUNRISE' },
            slides: [1, 3],
        });
        expect(result).toMatchObject({
            background: 'picture sunrise.jpg',
            slides: [1, 3],
            isSaved: true,
            undoId: 'b-1',
        });
        expect(mocked.backups).toEqual([
            {
                summary:
                    'Put the picture sunrise.jpg behind 2 slides of “Talk”',
                restores: [
                    {
                        type: 'file',
                        filePath: 'C:\\docs\\Talk.ows.bg.json',
                        text: '{}',
                    },
                ],
            },
        ]);
        // ONE write for the whole change.
        expect(mocked.setAttachedBackgrounds).toHaveBeenCalledTimes(1);
        expect(Object.keys(mocked.sidecar.data)).toEqual(['11', '13']);
        expect(mocked.sidecar.data['11']).toEqual({
            type: 'bg-image',
            item: {
                filePath: 'C:\\bg\\images\\sunrise.jpg',
                isFileSource: true,
            },
        });
    });

    it('puts a video or a colour behind every slide', async () => {
        await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'file', name: 'waves.mp4' },
            slides: null,
        });
        expect(Object.keys(mocked.sidecar.data)).toEqual(['11', '12', '13']);
        expect(mocked.sidecar.data['12'].type).toBe('bg-video');
        const colored = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'color', color: '#102030' },
            slides: [2],
        });
        expect(colored).toMatchObject({ background: 'colour #102030' });
        expect(mocked.sidecar.data['12']).toEqual({
            type: 'bg-color',
            item: '#102030',
        });
    });

    it('takes every one off, the document’s own too', async () => {
        mocked.sidecar.data = {
            self: { type: 'bg-color', item: '#000000' },
            '12': { type: 'bg-color', item: '#ffffff' },
        };
        const result = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'none' },
            slides: null,
        });
        expect(result).toMatchObject({ background: 'none' });
        expect(mocked.sidecar.data).toEqual({});
    });

    it('finds the one file a word names, and names several back', async () => {
        mocked.folders['C:\\bg\\images'].push({
            filePath: 'C:\\bg\\images\\wp_beach_sunrise.jpg',
            fullName: 'wp_beach_sunrise.jpg',
        });
        const found = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'file', name: 'beach' },
            slides: [1],
        });
        expect(found).toMatchObject({
            background: 'picture wp_beach_sunrise.jpg',
        });
        // "sunrise" alone is a whole name (sunrise.jpg) and wins; "rise" is
        // only a word, and two names hold it.
        const several = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'file', name: 'rise' },
            slides: [1],
        });
        expect(several).toMatchObject({
            isError: true,
            reason: expect.stringMatching(
                /Several backgrounds fit "rise": "sunrise\.jpg", "wp_beach_sunrise\.jpg"\. Nothing was changed/,
            ),
        });
    });

    it('says nothing changed when there is no background to take off', async () => {
        const result = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'none' },
            slides: [2],
        });
        expect(result).toMatchObject({ didChange: false, background: 'none' });
        expect(mocked.backups).toEqual([]);
        expect(mocked.setAttachedBackgrounds).not.toHaveBeenCalled();
    });

    it('refuses a name the panel does not have, and names what it has', async () => {
        const result = await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
            wanted: { kind: 'file', name: 'forest' },
            slides: null,
        });
        expect(result).toMatchObject({
            isError: true,
            reason: expect.stringMatching(
                /no picture or video called "forest".*pictures "sunrise\.jpg"; videos "waves\.mp4".*Nothing was changed/,
            ),
        });
        expect(mocked.setAttachedBackgrounds).not.toHaveBeenCalled();
        expect(mocked.backups).toEqual([]);
    });

    it('refuses an empty document, a missing slide and a lost backup', async () => {
        expect(
            await handleSlideBackgroundAt(
                DOC_PATH,
                'Talk',
                { items: [] },
                {
                    wanted: { kind: 'none' },
                    slides: null,
                },
            ),
        ).toMatchObject({ isError: true });
        expect(
            await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
                wanted: { kind: 'none' },
                slides: [9],
            }),
        ).toMatchObject({ reason: expect.stringMatching(/no slide 9/) });
        mocked.isBackupBroken.value = true;
        expect(
            await handleSlideBackgroundAt(DOC_PATH, 'Talk', json, {
                wanted: { kind: 'color', color: '#000000' },
                slides: null,
            }),
        ).toMatchObject({ isError: true, reason: 'No backup could be kept.' });
        expect(mocked.setAttachedBackgrounds).not.toHaveBeenCalled();
    });
});

describe('what a read says of backgrounds', () => {
    it('names each slide’s own, the document’s and the choices', async () => {
        mocked.sidecar.data = {
            self: { type: 'bg-color', item: '#000000' },
            '12': { type: 'bg-image', item: 'sunrise.jpg' },
        };
        const lines = await readSlideBackgroundLines(DOC_PATH, json.items);
        expect(lines).toEqual({
            bySlide: [null, 'picture sunrise.jpg', null],
            documentBackground: 'colour #000000',
            backgroundChoices: {
                pictures: ['sunrise.jpg'],
                videos: ['waves.mp4'],
            },
        });
    });

    it('lists at most 30 of a kind, and none for a folder not set up', async () => {
        mocked.folders['C:\\bg\\images'] = Array.from(
            { length: 31 },
            (_one, i) => {
                return {
                    filePath: `C:\\bg\\images\\${i}.jpg`,
                    fullName: `${i}.jpg`,
                };
            },
        );
        mocked.dirPathMap['select-dir-bg-video'] = null;
        try {
            const lines = await readSlideBackgroundLines(DOC_PATH, json.items);
            expect(lines.backgroundChoices).toMatchObject({
                videos: [],
                isTruncated: true,
            });
            expect(
                (lines.backgroundChoices as { pictures: string[] }).pictures,
            ).toHaveLength(30);
        } finally {
            mocked.dirPathMap['select-dir-bg-video'] = 'C:\\bg\\videos';
        }
    });
});
