// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));

// The app's half of `owa_lyric_edit` where a song cannot be read, a name
// has no file, and a song named by its whole PATH is described or given
// words the editor would not take.
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
    info: null as Record<string, unknown> | null,
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
            getContent: async () => h.head ?? '',
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
    OpenLyric: class {
        getInfo() {
            return h.info;
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
    // `update-slides` / `add-slides` (`owa_slide_edit`) and the whole-words
    // read: not what these tests drive.
    AGENT_SLIDE_LIMITS: { shownTextChars: 300, fullTextChars: 5000 },
    applyAgentSlideBatch: vi.fn(),
    checkIsAgentSlideBatchAction: () => false,
    readAgentSlideBatchRequest: vi.fn(),
    checkIsAgentSlideAction: () => false,
    applyAgentSlideAction: vi.fn(),
    readAgentSlideDocument: vi.fn(),
    readAgentSlideRequest: vi.fn(),
}));

import { handleAgentFileRequest, toAgentContentHash } from './agentFileHelpers';

const SONG_PATH = 'C:\\data\\elsewhere\\Still here.owl';

beforeEach(() => {
    h.head = 'song as it is now';
    h.info = null;
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

describe('a song that cannot be read', () => {
    test('a read by name says so, and nothing else is said of it', async () => {
        h.head = null;
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'read',
                name: 'Still',
            }),
        ).toEqual({ isError: true, reason: '"Still" could not be read.' });
    });

    test('an update held to a hash is refused before anything is backed up', async () => {
        h.head = null;
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'update',
                name: 'Still',
                content: 'new song',
                expectedHash: toAgentContentHash('song as it is now'),
            }),
        ).toEqual({
            isError: true,
            reason: '"Still" could not be read, so it was not changed.',
        });
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.setContent).not.toHaveBeenCalled();
    });

    test('a read by a name no file has names the missing song', async () => {
        h.exists.mockResolvedValue(false);
        const result = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'read',
            name: 'Gone',
        });
        expect(result).toMatchObject({ isError: true });
        expect((result as { reason: string }).reason).toContain('Gone');
    });
});

describe('a song named by its path', () => {
    test('info says whether it has unsaved edits and what it holds', async () => {
        h.info = {
            title: 'Still',
            key: 'C',
            metaLine: 1,
            structureLine: 4,
            sections: [{ partName: 'Verse 1' }, { partName: 'Chorus' }],
        };
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'info',
                filePath: SONG_PATH,
            }),
        ).toEqual({
            name: 'Still here',
            filePath: SONG_PATH,
            hasUnsavedChanges: true,
            characters: 'song as it is now'.length,
            title: 'Still',
            key: 'C',
            metaLine: 1,
            structureLine: 4,
            sections: ['Verse 1', 'Chorus'],
        });
        // The head read back as saved: nothing unsaved.
        h.head = 'song as saved';
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'info',
                filePath: SONG_PATH,
            }),
        ).toMatchObject({ hasUnsavedChanges: false });
    });

    test('an update with no words, or words the editor refuses, writes nothing', async () => {
        const empty = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'update',
            filePath: SONG_PATH,
            content: '   ',
        });
        expect(empty).toEqual({
            isError: true,
            reason: 'Content is required to update a song.',
        });
        h.checkMarkdown.mockReturnValue(false);
        const invalid = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'update',
            filePath: SONG_PATH,
            content: 'not a song',
        });
        expect(invalid).toMatchObject({ isError: true });
        expect(h.setContent).not.toHaveBeenCalled();
        expect(h.backup).not.toHaveBeenCalled();
    });
});
