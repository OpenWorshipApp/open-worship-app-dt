import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dictionaries: [] as Record<string, string>[],
        opened: null as any,
        exportAnswer: {
            leafIds: ['appearance'],
            password: 'secret',
            confirmedPassword: 'secret',
        },
        importLeafIds: ['appearance'] as string[],
        secure: false,
        dirty: false,
        errors: [] as Error[],
    },
    mocks: {
        input: vi.fn(),
        confirm: vi.fn(),
        selectFiles: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        open: vi.fn(),
        import: vi.fn(),
        tree: vi.fn(),
        explorer: vi.fn(),
        toast: vi.fn(),
        cleanup: vi.fn(),
        pending: vi.fn(),
        reload: vi.fn(),
        relaunch: vi.fn(),
        warnDirty: vi.fn(),
    },
}));

vi.mock('../../helper/appArchiveHelpers', () => ({
    createWorkDir: async () => '/tmp/settings-import',
    safeDeleteDir: mocks.cleanup,
}));
vi.mock('../../helper/archiveFlowHelpers', () => ({
    runMenuAction: async (_title: string, run: () => Promise<void>) => {
        try {
            await run();
        } catch (error: any) {
            state.errors.push(error);
        }
    },
    runWithProgress: async (_title: string, run: () => Promise<unknown>) =>
        run(),
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined)
                throw new Error(`Missing translation: ${key}`);
        }
        return key;
    },
}));
vi.mock('../../popup-widget/ArchivePasswordComp', () => ({
    MAX_PASSWORD_ATTEMPTS: 3,
}));
vi.mock('../../popup-widget/ArchiveTreeSelectorComp', () => ({
    default: () => null,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
    showAppInput: mocks.input,
}));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.explorer,
}));
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: { checkIsAvailable: () => state.secure },
}));
vi.mock('../../server/fileHelpers', () => ({ selectFiles: mocks.selectFiles }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../bible-setting/bibleEditorDirtyHelpers', () => ({
    warnIfAnyBibleEditorDirty: mocks.warnDirty,
}));
vi.mock('../SettingApplyComp', () => ({
    applyStore: { pendingApply: mocks.pending },
}));
vi.mock('../settingHelpers', () => ({
    forceReloadAppWindows: mocks.reload,
    relaunchApp: mocks.relaunch,
}));
vi.mock('./settingArchiveChoiceHelpers', () => ({
    genSettingTreeChoices: mocks.tree,
}));
vi.mock('./settingArchiveHelpers', () => ({
    countManifestByLeaf: () => new Map([['appearance', 2]]),
    createSettingArchive: mocks.create,
    importSettingSections: mocks.import,
    listExportableSettingKeys: mocks.list,
    openSettingArchive: mocks.open,
}));
vi.mock('./SettingExportDialogBodyComp', () => ({ default: () => null }));

import {
    handleSettingsExporting,
    handleSettingsImporting,
} from './settingArchiveMenuHelpers';
import { readSourceDictionary } from '../../../tools/owa-devtools-mcp/langPacks.mjs';
import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../../test-setup/langPackageDirs';

// Every language package but English, found by its folder: its real
// dictionary.
const dictionaries = listLangPackageCodes({ isEnglishIncluded: false }).map(
    (code) => {
        return readSourceDictionary(toLangPackageDir(code));
    },
);

beforeEach(() => {
    state.dictionaries = dictionaries;
    state.opened = {
        manifest: { version: 1, sections: ['appearance'] },
        isProtected: false,
    };
    state.exportAnswer = {
        leafIds: ['appearance'],
        password: 'secret',
        confirmedPassword: 'secret',
    };
    state.importLeafIds = ['appearance'];
    state.secure = false;
    state.dirty = false;
    state.errors = [];
    mocks.input.mockImplementation(async (_title: string, content: any) => {
        if (content.props.onChange) content.props.onChange(state.exportAnswer);
        else content.props.children[1].props.onChange(state.importLeafIds);
        return true;
    });
    mocks.confirm.mockResolvedValue(false);
    mocks.selectFiles.mockResolvedValue([
        '/downloads/settings.owasetting.tar.gz',
    ]);
    mocks.list.mockResolvedValue({
        refs: [{ key: 'theme', value: 'dark' }],
        countByLeafId: new Map([['appearance', 2]]),
    });
    mocks.create.mockResolvedValue('/downloads/settings.owasetting.tar.gz');
    mocks.open.mockImplementation(async () => state.opened);
    mocks.import.mockResolvedValue({
        writtenCount: 2,
        removedCount: 1,
        needsRelaunch: false,
    });
    mocks.tree.mockImplementation(
        (_counts: unknown, optionFor: (leaf: any) => any) => [
            { id: 'appearance', ...optionFor({ id: 'appearance' }) },
        ],
    );
    mocks.warnDirty.mockImplementation(() => state.dirty);
    mocks.cleanup.mockResolvedValue(undefined);
});

describe('Settings archive menu flows', () => {
    test('exports selected sections with their confirmed password', async () => {
        await handleSettingsExporting();
        expect(mocks.create).toHaveBeenCalledWith(
            [{ key: 'theme', value: 'dark' }],
            ['appearance'],
            'secret',
        );
        expect(mocks.explorer).toHaveBeenCalledWith(
            '/downloads/settings.owasetting.tar.gz',
        );
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Settings',
            'Exported to /downloads/settings.owasetting.tar.gz',
        );
    });

    test('retries a wrong password confirmation without creating an archive', async () => {
        let attempt = 0;
        mocks.input.mockImplementation(async (_title: string, content: any) => {
            content.props.onChange({
                ...state.exportAnswer,
                confirmedPassword: attempt++ === 0 ? 'wrong' : 'secret',
            });
            return true;
        });
        await handleSettingsExporting();
        expect(mocks.input).toHaveBeenCalledTimes(2);
        expect(mocks.create).toHaveBeenCalledOnce();
    });

    test('an empty or cancelled selection exports nothing', async () => {
        state.exportAnswer.leafIds = [];
        await handleSettingsExporting();
        mocks.input.mockResolvedValueOnce(false);
        await handleSettingsExporting();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    test('unsaved Bible edits stop an import before choosing any file', async () => {
        state.dirty = true;
        await handleSettingsImporting();
        expect(mocks.selectFiles).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    test('a cancelled password prompt leaves the settings alone and cleans the temp folder', async () => {
        state.opened = null;
        await handleSettingsImporting('/downloads/protected.enc');
        expect(mocks.import).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/settings-import');
    });

    test('imports selected sections and offers a reload without doing it on No', async () => {
        await handleSettingsImporting('/downloads/settings.tar');
        expect(mocks.import).toHaveBeenCalledWith(
            state.opened.manifest,
            ['appearance'],
            false,
        );
        expect(mocks.toast).toHaveBeenCalledWith(
            'Import Settings',
            'Imported 2 setting(s); 1 reset to default',
        );
        expect(mocks.pending).toHaveBeenCalledOnce();
        expect(mocks.confirm).toHaveBeenCalledOnce();
        expect(mocks.reload).not.toHaveBeenCalled();
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/settings-import');
    });

    test('accepting the apply prompt reloads, while startup settings ask for a restart', async () => {
        mocks.confirm.mockResolvedValue(true);
        await handleSettingsImporting('/downloads/settings.tar');
        expect(mocks.reload).toHaveBeenCalledOnce();
        mocks.import.mockResolvedValue({
            writtenCount: 1,
            removedCount: 0,
            needsRelaunch: true,
        });
        await handleSettingsImporting('/downloads/settings.tar');
        expect(mocks.relaunch).toHaveBeenCalledOnce();
    });

    test('three mismatched confirmations give up without writing a file', async () => {
        state.exportAnswer = {
            leafIds: ['appearance'],
            password: 'secret',
            confirmedPassword: 'secrte',
        };
        await handleSettingsExporting();
        expect(mocks.input).toHaveBeenCalledTimes(3);
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
    });

    test('the picked file is opened; no file picked opens nothing', async () => {
        await handleSettingsImporting();
        expect(mocks.selectFiles).toHaveBeenCalledExactlyOnceWith([
            {
                name: 'Open Worship Settings',
                extensions: ['gz', 'tgz', 'tar', 'enc'],
            },
        ]);
        expect(mocks.open).toHaveBeenCalledExactlyOnceWith(
            '/downloads/settings.owasetting.tar.gz',
            '/tmp/settings-import',
            'Import Settings',
        );

        mocks.selectFiles.mockResolvedValue([]);
        await handleSettingsImporting();
        expect(mocks.selectFiles).toHaveBeenCalledTimes(2);
        expect(mocks.open).toHaveBeenCalledOnce();
        // No work folder was made for it, so none is removed.
        expect(mocks.cleanup).toHaveBeenCalledOnce();
    });

    test('a file with no section this version knows says so and asks nothing', async () => {
        state.opened = {
            manifest: { version: 1, sections: [] },
            isProtected: false,
        };
        await handleSettingsImporting('/downloads/settings.tar');
        expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(
            'Import Settings',
            'This file holds no settings this version can import',
        );
        expect(mocks.input).not.toHaveBeenCalled();
        expect(mocks.import).not.toHaveBeenCalled();
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/settings-import');
    });

    test('a cancelled or empty choice of sections imports nothing', async () => {
        mocks.input.mockResolvedValueOnce(false);
        await handleSettingsImporting('/downloads/settings.tar');
        state.importLeafIds = [];
        await handleSettingsImporting('/downloads/settings.tar');
        expect(mocks.input).toHaveBeenCalledTimes(2);
        expect(mocks.import).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(mocks.pending).not.toHaveBeenCalled();
        expect(mocks.cleanup.mock.calls).toEqual([
            ['/tmp/settings-import'],
            ['/tmp/settings-import'],
        ]);
    });

    test('only the sections in the file are offered, and credentials only where they can be kept', async () => {
        state.opened = {
            manifest: {
                version: 1,
                sections: ['general.language', 'secrets.aiKeys'],
            },
            isProtected: true,
        };
        const optionsFor: ((leaf: any) => any)[] = [];
        mocks.tree.mockImplementation(
            (_counts: unknown, toLeafOption: (leaf: any) => any) => {
                optionsFor.push(toLeafOption);
                return [];
            },
        );
        mocks.input.mockResolvedValue(false);
        await handleSettingsImporting('/downloads/settings.owasetting.enc');
        state.secure = true;
        await handleSettingsImporting('/downloads/settings.owasetting.enc');
        const aiKeys = {
            id: 'secrets.aiKeys',
            needsPassword: true,
            isOptInOnImport: true,
        };
        const [withoutSafeStorage, withSafeStorage] = optionsFor;
        expect(withoutSafeStorage({ id: 'general.theme' })).toEqual({
            isHidden: true,
        });
        expect(withoutSafeStorage({ id: 'general.language' })).toEqual({});
        expect(withoutSafeStorage(aiKeys)).toEqual({
            isDefaultUnchecked: true,
            invalidMessage: 'This computer cannot keep them safely',
        });
        expect(withSafeStorage(aiKeys)).toEqual({ isDefaultUnchecked: true });
        expect(withSafeStorage(aiKeys).invalidMessage).toBeUndefined();
    });
});
