// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// The app's half of `owa_lyric_edit`: a song READ whole (its editing head,
// unsaved edits included) with a hash, a song named by its whole PATH (the
// help window's attached song lives in any folder), and an update refused
// when the song changed since that read.
const h = vi.hoisted(() => ({
    exists: vi.fn(),
    head: 'song as it is now' as string | null,
    saved: 'song as saved',
    setContent: vi.fn(),
    checkMarkdown: vi.fn(),
    backup: vi.fn(),
    snapshotEditing: vi.fn(),
    refresh: vi.fn(),
    forget: vi.fn(),
    forgetUnder: vi.fn(),
    lastSummary: '',
}));

vi.mock('./DirSource', () => ({
    default: { getDirPathBySettingName: () => '/documents' },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: h.exists,
    fsListFilesWithMimetype: vi.fn(),
    getMimetypeExtensions: (kind: string) => [kind === 'lyric' ? 'owl' : 'ows'],
    pathJoin: path.posix.join,
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: path.posix.parse(filePath.replace(/\\/g, '/')).name,
            filePath,
            fireUpdateEvent: h.refresh,
        }),
        forgetCachedData: h.forget,
        forgetCachedDataUnder: h.forgetUnder,
    },
}));
vi.mock('../lyric-list/Lyric', () => ({
    default: {
        getInstance: () => ({
            getJsonData: async (isOriginal = false) => {
                if (isOriginal) {
                    return { metadata: {}, content: h.saved };
                }
                return h.head === null
                    ? null
                    : { metadata: {}, content: h.head };
            },
            setContent: h.setContent,
        }),
    },
}));
vi.mock('open-lyric', () => ({
    EditorOpenLyricPlugin: class {
        getOpenLyricApi() {
            return { document: { checkMarkdown: h.checkMarkdown } };
        }
    },
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: vi.fn(),
    genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    runWithAgentBackup: h.backup,
    snapshotAgentEditing: h.snapshotEditing,
    snapshotAgentFileForDelete: vi.fn(),
    renameAgentFile: vi.fn(),
    trashAgentFile: vi.fn(),
}));
vi.mock('./agentSlideHelpers', () => ({
    checkIsAgentSlideAction: () => false,
    applyAgentSlideAction: vi.fn(),
    readAgentSlideDocument: vi.fn(),
    readAgentSlideRequest: vi.fn(),
}));

import { handleAgentFileRequest, toAgentContentHash } from './agentFileHelpers';

const SONG_PATH = 'C:\\data\\elsewhere\\Still khmer.owl';

beforeEach(() => {
    h.head = 'song as it is now';
    h.exists.mockReset().mockResolvedValue(true);
    h.setContent.mockReset();
    h.checkMarkdown.mockReset().mockReturnValue(true);
    h.refresh.mockReset();
    h.forget.mockReset();
    h.forgetUnder.mockReset();
    h.snapshotEditing.mockReset().mockResolvedValue({ type: 'editing' });
    h.backup
        .mockReset()
        .mockImplementation(
            async (
                summary: string,
                _restores: unknown[],
                change: () => Promise<unknown>,
            ) => {
                h.lastSummary = summary;
                return { meta: { id: 'undo-7' }, value: await change() };
            },
        );
});

describe('a fingerprint of the text', () => {
    test('the same text, the same hash; any change, another', () => {
        expect(toAgentContentHash('abc')).toBe(toAgentContentHash('abc'));
        expect(toAgentContentHash('abc')).not.toBe(toAgentContentHash('abd'));
        expect(toAgentContentHash('')).toMatch(/^0-/);
    });
});

describe('read', () => {
    test('answers the editing head with its hash, read fresh', async () => {
        const result = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'read',
            name: 'Still',
        });
        expect(result).toEqual({
            name: 'Still',
            filePath: '/documents/Still.owl',
            content: 'song as it is now',
            hash: toAgentContentHash('song as it is now'),
            hasUnsavedChanges: true,
        });
        expect(h.forget).toHaveBeenCalledWith('/documents/Still.owl');
        expect(h.forgetUnder).toHaveBeenCalledWith(
            '/documents/Still.owl.histories',
        );
    });

    test('a song by its whole path, from any folder', async () => {
        const result = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'read',
            filePath: SONG_PATH,
        });
        expect(result).toMatchObject({
            name: 'Still khmer',
            filePath: SONG_PATH,
            content: 'song as it is now',
        });
    });

    test('only a song is read whole', async () => {
        expect(
            await handleAgentFileRequest({
                kind: 'slide',
                action: 'read',
                name: 'Deck',
            }),
        ).toEqual({
            isError: true,
            reason: 'Only a song is read whole this way.',
        });
    });
});

describe('a song named by its path', () => {
    test('is refused unless it is a whole path to a song that is there', async () => {
        const reasonOf = async (filePath: string) => {
            return (
                (await handleAgentFileRequest({
                    kind: 'lyric',
                    action: 'read',
                    filePath,
                })) as { reason?: string }
            ).reason;
        };
        expect(await reasonOf('Still.owl')).toMatch(/whole path/);
        expect(await reasonOf('C:\\data\\..\\x\\Still.owl')).toMatch(/\.\./);
        expect(await reasonOf('C:\\data\\setting.json')).toMatch(
            /Only a song file/,
        );
        h.exists.mockResolvedValue(false);
        expect(await reasonOf(SONG_PATH)).toMatch(/no song file/);
        h.exists.mockResolvedValue(true);
        h.head = null;
        expect(await reasonOf(SONG_PATH)).toMatch(/not a song/);
    });

    test('takes read, info and update only, and for songs only', async () => {
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'delete',
                filePath: SONG_PATH,
            }),
        ).toMatchObject({ isError: true });
        expect(
            await handleAgentFileRequest({
                kind: 'slide',
                action: 'read',
                filePath: SONG_PATH,
            }),
        ).toEqual({
            isError: true,
            reason: 'Only a song can be named by its path.',
        });
    });
});

describe('update with the hash its read answered', () => {
    test('writes the editing history, backed up, named for what changed', async () => {
        const result = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'update',
            filePath: SONG_PATH,
            content: 'new song',
            expectedHash: toAgentContentHash('song as it is now'),
            summary: 'new words for Verse 1',
        });
        expect(result).toMatchObject({
            updated: 'Still khmer',
            isSaved: false,
            undoId: 'undo-7',
        });
        expect(h.setContent).toHaveBeenCalledWith('new song');
        expect(h.lastSummary).toBe(
            'Changed the song “Still khmer”: new words for Verse 1',
        );
        expect(h.refresh).toHaveBeenCalled();
    });

    test('is refused, nothing written, when the song changed since the read', async () => {
        const result = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'update',
            filePath: SONG_PATH,
            content: 'new song',
            expectedHash: toAgentContentHash('what it said before'),
        });
        expect(result).toMatchObject({ isError: true });
        expect((result as { reason: string }).reason).toMatch(
            /changed while this was being worked out/,
        );
        expect(h.setContent).not.toHaveBeenCalled();
        expect(h.backup).not.toHaveBeenCalled();
    });

    test('a name keeps its Documents rules and is held to the hash too', async () => {
        const result = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'update',
            name: 'Still',
            content: 'new song',
            expectedHash: 'stale',
        });
        expect((result as { reason: string }).reason).toMatch(/changed while/);
    });
});
