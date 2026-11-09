import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        existing: new Set<string>(),
        texts: new Map<string, string>(),
        listed: [] as string[],
        mimeFiles: [] as string[],
        noteHasHistories: false,
        noteEditingData: null as Record<string, unknown> | null,
        flowData: null as Record<string, unknown> | null,
        lyricData: new Map<string, Record<string, unknown>>(),
        slideData: new Map<string, Record<string, unknown>>(),
        listError: null as Error | null,
    },
    mocks: {
        handleError: vi.fn(),
        fsCreateDir: vi.fn(),
        fsCloneFile: vi.fn(),
        fsDeleteFile: vi.fn(),
        fsGetFileStamp: vi.fn(),
        fsWriteFile: vi.fn(),
        trashAllMaterialFiles: vi.fn(),
        renameAllMaterialFiles: vi.fn(),
        deleteMetaDataFile: vi.fn(),
        deleteTransitionMetaDataFile: vi.fn(),
        moveFilePath: vi.fn(),
        preDelete: vi.fn(),
        fireUpdateEvent: vi.fn(),
        deleteHistories: vi.fn(),
        addNoteHistory: vi.fn(),
        notifyNoteHeadChanged: vi.fn(),
        saveFlow: vi.fn(),
        removeFlowSettings: vi.fn(),
        documentRead: vi.fn(),
        lyricPreDelete: vi.fn(),
        slidePreDelete: vi.fn(),
        clearBibleXMLCache: vi.fn(),
    },
}));

vi.mock('./constants', () => ({
    appManagedDataDirNames: { AGENT_BACKUP: 'agent-backups' },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => state.existing.has(path),
    fsCheckFileExist: async (path: string) => state.existing.has(path),
    fsCreateDir: mocks.fsCreateDir,
    fsCloneFile: mocks.fsCloneFile,
    fsDeleteFile: mocks.fsDeleteFile,
    fsGetFileStamp: mocks.fsGetFileStamp,
    fsListFiles: async () => {
        if (state.listError !== null) {
            throw state.listError;
        }
        return state.listed;
    },
    fsListFilesWithMimetype: async () => state.mimeFiles,
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
    fsWriteFile: mocks.fsWriteFile,
    getFileFullName: (path: string) => path.split('/').at(-1),
    pathJoin: (...parts: string[]) => {
        const joined = parts.join('/').replace(/\/{2,}/g, '/');
        return joined.replace(/\/[^/]+\/\.\.\//g, '/');
    },
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/data' },
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            name: path.split('/').at(-1)?.split('.')[0],
            trash: async () => state.existing.delete(path),
            renameTo: async (newName: string) => {
                const renamedPath = `${path.slice(0, path.lastIndexOf('/') + 1)}${newName}${path.slice(path.lastIndexOf('.'))}`;
                state.existing.delete(path);
                state.existing.add(renamedPath);
                return {
                    filePath: renamedPath,
                    fireUpdateEvent: mocks.fireUpdateEvent,
                };
            },
            writeFileData: async (text: string) => {
                state.existing.add(path);
                state.texts.set(path, text);
                return true;
            },
            fireUpdateEvent: mocks.fireUpdateEvent,
        }),
    },
}));
vi.mock('../server/appHelpers', () => ({
    trashAllMaterialFiles: mocks.trashAllMaterialFiles,
    renameAllMaterialFiles: mocks.renameAllMaterialFiles,
}));
vi.mock('../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        deleteMetaDataFile: mocks.deleteTransitionMetaDataFile,
    },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: mocks.deleteMetaDataFile },
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: {
        moveFilePath: mocks.moveFilePath,
        getInstance: () => ({
            checkHasHistories: async () => state.noteHasHistories,
            deleteHistories: mocks.deleteHistories,
        }),
    },
}));
// An open note window is told when an undo puts its head back (2026-11-07).
vi.mock('../bible-list/note/noteHeadChangeHelpers', () => ({
    notifyNoteHeadChanged: mocks.notifyNoteHeadChanged,
}));
vi.mock('../bible-list/note/Note', () => ({
    default: {
        fromFilePathEditing: async () =>
            state.noteEditingData === null
                ? null
                : { toJson: () => state.noteEditingData },
        fromJson: (_filePath: string, jsonData: Record<string, unknown>) => ({
            addEditingHistory: async () => {
                state.noteEditingData = jsonData;
                mocks.addNoteHistory(jsonData);
            },
        }),
    },
}));
vi.mock('../presenting-flow/PresentingFlow', () => ({
    default: {
        getInstance: () => ({
            getJsonData: async () => state.flowData,
            setJsonData: async (jsonData: Record<string, unknown>) => {
                state.flowData = jsonData;
            },
            save: mocks.saveFlow,
            preDelete: mocks.preDelete,
        }),
    },
}));
vi.mock('../presenting-flow/presentingFlowHelpers', () => ({
    removePresentingFlowSettings: mocks.removeFlowSettings,
}));
// A song and a slide document each through its OWN class: the two maps are
// apart so a head read or put back through the wrong class shows.
vi.mock('../lyric-list/Lyric', () => ({
    default: {
        getInstance: (filePath: string) => ({
            getJsonData: async () => {
                mocks.documentRead('lyric', filePath);
                return state.lyricData.get(filePath) ?? null;
            },
            setJsonData: async (jsonData: Record<string, unknown>) => {
                state.lyricData.set(filePath, jsonData);
            },
            preDelete: async () => mocks.lyricPreDelete(filePath),
        }),
    },
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        getInstance: (filePath: string) => ({
            getJsonData: async () => {
                mocks.documentRead('slide', filePath);
                return state.slideData.get(filePath) ?? null;
            },
            setJsonData: async (jsonData: Record<string, unknown>) => {
                state.slideData.set(filePath, jsonData);
            },
            preDelete: async () => mocks.slidePreDelete(filePath),
        }),
    },
}));
vi.mock('../setting/bible-setting/bibleXMLHelpers', () => ({
    clearBibleXMLCache: (...args: unknown[]) =>
        mocks.clearBibleXMLCache(...args),
}));

// The Bible Note editor's own keys (its settings, its block links) live in
// the app's home storage; an undo of the help window's change puts the key
// back as it was, or takes it away when it was not there.
const { homeStorage } = vi.hoisted(() => ({
    homeStorage: new Map<string, string>(),
}));
vi.mock('../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => homeStorage.get(key) ?? null,
        setItem: (key: string, text: string) => homeStorage.set(key, text),
        removeItem: (key: string) => homeStorage.delete(key),
    },
}));

import { saveAgentBackup, undoAgentBackup } from './agentBackupHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.existing.clear();
    state.texts.clear();
    state.listed = [];
    state.mimeFiles = [];
    state.noteHasHistories = false;
    state.noteEditingData = null;
    state.flowData = null;
    state.lyricData.clear();
    state.slideData.clear();
    state.listError = null;
    mocks.fsDeleteFile.mockImplementation(async (path: string) => {
        state.existing.delete(path);
        state.texts.delete(path);
    });
    mocks.fsCreateDir.mockImplementation(async (path: string) => {
        state.existing.add(path);
    });
    mocks.fsCloneFile.mockImplementation(async (from: string, to: string) => {
        state.existing.add(to);
        state.texts.set(to, state.texts.get(from) ?? '');
    });
    mocks.fsGetFileStamp.mockImplementation(async (path: string) => {
        return state.existing.has(path)
            ? { size: state.texts.get(path)?.length ?? 0 }
            : null;
    });
    mocks.fsWriteFile.mockImplementation(async (path: string, text: string) => {
        state.existing.add(path);
        state.texts.set(path, text);
    });
});

const SETTINGS_KEY = 'lexical-playground-settings';
const NOTE_PATH = '/notes/Study.own';

function readUndoRestores(originalId: string) {
    const meta = JSON.parse(
        state.texts.get(`/data/agent-backups/${originalId}.meta.json`) ?? '',
    );
    const undoData = JSON.parse(
        state.texts.get(`/data/agent-backups/${meta.undoneBy}.data.json`) ?? '',
    );
    return undoData.restores;
}

describe('undo of a note editor key in the home storage', () => {
    beforeEach(() => {
        homeStorage.clear();
    });

    test('puts the key back as it was, keeps the current one to redo, and tells the note window', async () => {
        homeStorage.set(SETTINGS_KEY, '{"showInvisibleCharacters":true}');
        const original = await saveAgentBackup('Showed the marks', [
            {
                type: 'home-setting',
                key: SETTINGS_KEY,
                text: '{"isCodeShiki":true}',
                filePath: NOTE_PATH,
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Showed the marks',
        });

        expect(homeStorage.get(SETTINGS_KEY)).toBe('{"isCodeShiki":true}');
        expect(mocks.notifyNoteHeadChanged).toHaveBeenCalledWith(NOTE_PATH);
        // The undo's own backup holds what the key read before it, so the
        // undo can itself be undone.
        expect(readUndoRestores(original.id)).toEqual([
            {
                type: 'home-setting',
                key: SETTINGS_KEY,
                text: '{"showInvisibleCharacters":true}',
                filePath: NOTE_PATH,
            },
        ]);
        // No file of the note is touched.
        expect(mocks.fireUpdateEvent).not.toHaveBeenCalled();
        expect(state.texts.has(NOTE_PATH)).toBe(false);
    });

    test('a key that was not there before the change is taken away', async () => {
        homeStorage.set(SETTINGS_KEY, '{"showInvisibleCharacters":true}');
        const original = await saveAgentBackup('Showed the marks', [
            {
                type: 'home-setting',
                key: SETTINGS_KEY,
                text: null,
                filePath: NOTE_PATH,
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await undoAgentBackup(original.id);

        expect(homeStorage.has(SETTINGS_KEY)).toBe(false);
        expect(readUndoRestores(original.id)).toEqual([
            {
                type: 'home-setting',
                key: SETTINGS_KEY,
                text: '{"showInvisibleCharacters":true}',
                filePath: NOTE_PATH,
            },
        ]);
    });

    test('a note window that cannot be told leaves the undo done', async () => {
        const error = new Error('no window');
        mocks.notifyNoteHeadChanged.mockImplementation(() => {
            throw error;
        });
        const original = await saveAgentBackup('Linked a block', [
            {
                type: 'home-setting',
                key: 'lexical-playground-block-text-links',
                text: '[]',
                filePath: NOTE_PATH,
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Linked a block',
        });

        expect(homeStorage.get('lexical-playground-block-text-links')).toBe(
            '[]',
        );
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });
});

describe('undo of a Bible note head', () => {
    test('a note window that cannot be told leaves the note put back', async () => {
        const error = new Error('no window');
        mocks.notifyNoteHeadChanged.mockImplementation(() => {
            throw error;
        });
        state.existing.add(NOTE_PATH);
        state.noteHasHistories = true;
        state.noteEditingData = { title: 'New title' };
        const original = await saveAgentBackup('Edited note', [
            {
                type: 'editing',
                filePath: NOTE_PATH,
                kind: 'note',
                text: JSON.stringify({ title: 'Old title' }),
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Edited note',
        });

        expect(state.noteEditingData).toEqual({ title: 'Old title' });
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });
});
