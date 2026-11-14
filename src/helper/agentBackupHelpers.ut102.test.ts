// An undo of the screens' own controls (`owa_screen_edit`): a setting and
// a screen the change added, each snapshotted for the redo and put back by
// its own module; a refresh of the overlays that fails; and more restores
// than a backup may hold.

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

// EC-540: what a show put on the screens, behind its own module.
const { screenMocks, appSettings } = vi.hoisted(() => ({
    screenMocks: {
        checkScreenRestores: vi.fn(),
        snapshotScreenRestore: vi.fn(),
        applyScreenRestore: vi.fn(),
        refreshForegroundAfterUndo: vi.fn(),
    },
    appSettings: new Map<string, string>(),
}));
vi.mock('./agentScreenRestoreHelpers', () => ({
    checkScreenRestores: screenMocks.checkScreenRestores,
    snapshotScreenRestore: screenMocks.snapshotScreenRestore,
    applyScreenRestore: screenMocks.applyScreenRestore,
}));
vi.mock('./agentForegroundHelpers', () => ({
    refreshForegroundAfterUndo: screenMocks.refreshForegroundAfterUndo,
}));
const { controlMocks, limit } = vi.hoisted(() => ({
    controlMocks: {
        snapshotScreenControlRestore: vi.fn(),
        applyScreenControlRestore: vi.fn(),
        snapshotScreenPresenceRestore: vi.fn(),
        applyScreenPresenceRestore: vi.fn(),
    },
    limit: { maxChars: 25 * 1024 * 1024 },
}));
vi.mock('./agentScreenControlRestoreHelpers', () => ({
    snapshotScreenControlRestore: controlMocks.snapshotScreenControlRestore,
    applyScreenControlRestore: controlMocks.applyScreenControlRestore,
    snapshotScreenPresenceRestore: controlMocks.snapshotScreenPresenceRestore,
    applyScreenPresenceRestore: controlMocks.applyScreenPresenceRestore,
}));
// The cap a backup is held to, small for the one test that needs to pass it.
vi.mock('./agentBackupPlanHelpers', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        get AGENT_BACKUP_MAX_CHARS() {
            return limit.maxChars;
        },
    };
});
vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => appSettings.get(key) ?? null,
    setSetting: (key: string, text: string) => appSettings.set(key, text),
    removeSetting: (key: string) => appSettings.delete(key),
}));

import {
    appendAgentBackupRestores,
    saveAgentBackup,
    undoAgentBackup,
} from './agentBackupHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    limit.maxChars = 25 * 1024 * 1024;
    appSettings.clear();
    screenMocks.checkScreenRestores.mockReturnValue(null);
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

const SETTING_LOCK = {
    type: 'screen-setting' as const,
    field: 'lock' as const,
    screenId: 1,
    value: false,
};
const ADDED_SCREEN = {
    type: 'screen-presence' as const,
    screenId: 2,
    present: false,
};

function readMeta(id: string) {
    return JSON.parse(
        state.texts.get(`/data/agent-backups/${id}.meta.json`) ?? '',
    );
}

function readUndoRestores(originalId: string) {
    const meta = readMeta(originalId);
    const undoData = JSON.parse(
        state.texts.get(`/data/agent-backups/${meta.undoneBy}.data.json`) ?? '',
    );
    return undoData.restores;
}

describe('undo of the screens own controls', () => {
    beforeEach(() => {
        controlMocks.snapshotScreenControlRestore.mockImplementation(
            async (restore: Record<string, unknown>) => {
                return { ...restore, value: true };
            },
        );
        controlMocks.snapshotScreenPresenceRestore.mockImplementation(
            (restore: { screenId: number }) => {
                return [
                    {
                        type: 'screen-presence',
                        screenId: restore.screenId,
                        present: true,
                        controls: { group: null },
                    },
                ];
            },
        );
    });

    test('a setting and an added screen go back through their own module, kept to redo', async () => {
        const original = await saveAgentBackup('Locked screen 1', [
            SETTING_LOCK,
            ADDED_SCREEN,
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Locked screen 1',
        });

        expect(controlMocks.applyScreenControlRestore).toHaveBeenCalledWith(
            SETTING_LOCK,
        );
        expect(controlMocks.applyScreenPresenceRestore).toHaveBeenCalledWith(
            ADDED_SCREEN,
        );
        // The unlock goes back first, the added screen is taken away last.
        expect(
            controlMocks.applyScreenControlRestore.mock.invocationCallOrder[0],
        ).toBeLessThan(
            controlMocks.applyScreenPresenceRestore.mock.invocationCallOrder[0],
        );
        expect(readUndoRestores(original.id)).toEqual([
            { ...SETTING_LOCK, value: true },
            {
                type: 'screen-presence',
                screenId: 2,
                present: true,
                controls: { group: null },
            },
        ]);
        expect(screenMocks.checkScreenRestores).toHaveBeenCalledOnce();
    });

    test('a screen control that cannot be put back says so and leaves the change', async () => {
        const original = await saveAgentBackup('Locked screen 1', [
            SETTING_LOCK,
        ]);
        state.listed = [`${original.id}.meta.json`];
        controlMocks.applyScreenControlRestore.mockRejectedValue(
            new Error('Screen 1 is gone.'),
        );
        const result: any = await undoAgentBackup(original.id);
        expect(result.isError).toBe(true);
        expect(result.reason).toContain(
            'Part of "Locked screen 1" could not be put back: Screen 1 is gone.',
        );
        expect(readMeta(original.id).undoneAt).toBeUndefined();
    });
});

describe('an undo whose overlays cannot be refreshed', () => {
    test('is still done, the reason logged', async () => {
        const sessionKey = 'foreground-countdown-session';
        appSettings.set(sessionKey, '[{"id":"s1"}]');
        const original = await saveAgentBackup('Put up the Countdown', [
            {
                type: 'app-setting',
                key: sessionKey,
                text: null,
                foreground: 'countdown',
            },
        ]);
        state.listed = [`${original.id}.meta.json`];
        const failure = new Error('foreground not ready');
        screenMocks.refreshForegroundAfterUndo.mockRejectedValue(failure);

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Put up the Countdown',
        });

        expect(appSettings.has(sessionKey)).toBe(false);
        expect(mocks.handleError).toHaveBeenCalledWith(failure);
        expect(readMeta(original.id).undoneAt).toEqual(expect.any(String));
    });
});

describe('restores added to a backup past its cap', () => {
    test('are refused and the backup is left as it was', async () => {
        limit.maxChars = 400;
        const original = await saveAgentBackup('Changed the words', [
            { type: 'app-setting', key: 'k', text: 'old' },
        ]);
        const dataPath = `/data/agent-backups/${original.id}.data.json`;
        const before = state.texts.get(dataPath);
        mocks.fsWriteFile.mockClear();

        await expect(
            appendAgentBackupRestores(original.id, [
                { type: 'app-setting', key: 'big', text: 'x'.repeat(500) },
            ]),
        ).rejects.toThrow('what it changed is too large to back up');

        expect(mocks.fsWriteFile).not.toHaveBeenCalled();
        expect(state.texts.get(dataPath)).toBe(before);
    });
});
