// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { PublicDomainSongType } from './publicDomainSongsData';

const state = vi.hoisted(() => ({
    existing: new Set<string>(),
    created: [] as { dirPath: string; name: string; markdown: string }[],
    createResult: 'file' as 'file' | 'null' | 'throw',
    fireUpdateEvent: vi.fn(),
    toast: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath.split('/').pop(),
            // The app's own rule: the next free "name (n).ext".
            genNextFilePath: async () => {
                let candidate = filePath;
                let index = 1;
                while (state.existing.has(candidate)) {
                    candidate = filePath.replace(/\.own$/, ` (${index}).own`);
                    index++;
                }
                return candidate;
            },
        }),
    },
}));
vi.mock('../../lyric-list/Lyric', () => ({
    default: {
        createWithContent: async (
            dirPath: string,
            name: string,
            markdown: string,
        ) => {
            if (state.createResult === 'throw') {
                throw new Error('disk full');
            }
            state.created.push({ dirPath, name, markdown });
            return state.createResult === 'null'
                ? null
                : { fireUpdateEvent: state.fireUpdateEvent };
        },
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['own'],
    pathJoin: (...parts: string[]) => parts.join('/'),
    toPortableFileName: (name: string, fallback: string) =>
        name.replaceAll(/[\\/:*?"<>|]/g, '').trim() || fallback,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: state.handleError,
}));

import { importPublicDomainSongToDirectory } from './publicDomainSongsImportHelpers';

const TITLE = 'Import From Public Domain Songs';

function genSong(
    overrides: Partial<PublicDomainSongType> = {},
): PublicDomainSongType {
    return {
        id: 'amazing-grace',
        title: 'Amazing Grace',
        authors: ['John Newton'],
        year: '1779',
        sources: [],
        verses: ['Amazing grace! How sweet the sound\nThat saved a wretch'],
        refrain: null,
        ...overrides,
    };
}

beforeEach(() => {
    state.existing = new Set();
    state.created = [];
    state.createResult = 'file';
});

describe('importing a public domain song', () => {
    test('writes the song as a lyric document and announces it', async () => {
        const isDone = await importPublicDomainSongToDirectory(
            '/data/Documents',
            genSong(),
        );

        expect(isDone).toBe(true);
        expect(state.created).toHaveLength(1);
        const [{ dirPath, name, markdown }] = state.created;
        expect(dirPath).toBe('/data/Documents');
        expect(name).toBe('Amazing Grace.own');
        expect(markdown).toContain('# Amazing Grace');
        expect(markdown).toContain('- Artist: John Newton');
        expect(markdown).toContain('- Copyright: Public Domain (1779)');
        expect(markdown).toContain('Amazing grace! How sweet the sound');
        expect(state.fireUpdateEvent).toHaveBeenCalledOnce();
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'Lyric document created successfully',
        );
    });

    test('writes a refrain as one chorus and keeps the link to where the text came from', async () => {
        await importPublicDomainSongToDirectory(
            '/data/Documents',
            genSong({
                verses: ['First verse', 'Second verse'],
                refrain: 'Glory, glory',
                sources: [{ title: 'Hymnary', url: 'https://hymnary.org/x' }],
            }),
        );

        const { markdown } = state.created[0];
        expect(markdown).toContain('- Structure: V1CV2C');
        expect(markdown).toContain(
            '- Attachments: [Hymnary](https://hymnary.org/x)',
        );
        expect(markdown.match(/```ol:Chorus/g)).toHaveLength(1);
    });

    test('lands beside an existing file of the same name rather than over it', async () => {
        state.existing.add('/data/Documents/Amazing Grace.own');

        await importPublicDomainSongToDirectory('/data/Documents', genSong());

        expect(state.created[0].name).toBe('Amazing Grace (1).own');
    });

    test('drops the characters a file name cannot carry', async () => {
        await importPublicDomainSongToDirectory(
            '/data/Documents',
            genSong({ title: 'Holy, Holy: Holy?' }),
        );

        expect(state.created[0].name).toBe('Holy, Holy Holy.own');
    });

    test('creates nothing for a song with no lyrics', async () => {
        const isDone = await importPublicDomainSongToDirectory(
            '/data/Documents',
            genSong({ verses: [] }),
        );

        expect(isDone).toBe(false);
        expect(state.created).toHaveLength(0);
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'This song has no lyrics to import',
        );
    });

    test('says so when the document could not be created', async () => {
        state.createResult = 'null';

        const isDone = await importPublicDomainSongToDirectory(
            '/data/Documents',
            genSong(),
        );

        expect(isDone).toBe(false);
        expect(state.fireUpdateEvent).not.toHaveBeenCalled();
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'Failed to create lyric document',
        );
    });

    test('reports a write that throws and tells the user', async () => {
        state.createResult = 'throw';

        const isDone = await importPublicDomainSongToDirectory(
            '/data/Documents',
            genSong(),
        );

        expect(isDone).toBe(false);
        expect(state.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'disk full' }),
        );
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'Failed to create lyric document',
        );
    });
});
