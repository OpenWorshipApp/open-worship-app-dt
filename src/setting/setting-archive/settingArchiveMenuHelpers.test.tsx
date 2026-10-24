import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { extractDictionary } from '../../../tools/owa-devtools-mcp/tran.mjs';

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

const dictionaries = ['km', 'fr'].map((code) =>
    extractDictionary(readFileSync(`src/lang/data/${code}/index.ts`, 'utf8')),
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
});
