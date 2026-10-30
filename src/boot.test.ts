// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME } from './helper/constants';

const state = vi.hoisted(() => ({
    localItems: new Map<string, string>(),
    homeItems: new Map<string, string>(),
    calls: [] as string[],
    provider: { sessionData: {} as Record<string, unknown> },
    fontFamily: null as string | null,
    fontWeight: null as number | null,
    locale: 'km-KH',
    langCode: 'km' as string | null,
    handleError: vi.fn(),
    renameMigration: vi.fn(),
    keyPathMigration: vi.fn(),
    noteCloseMigration: vi.fn(),
    pendingMove: vi.fn(),
    getLangDataAsync: vi.fn(),
}));

vi.mock('./server/appProvider', () => ({ default: state.provider }));
vi.mock('./setting/directory-setting/appLocalStorage', () => ({
    DATA_DIR_MOVE_PENDING_SETTING_NAME: 'data-dir-move-pending',
    appLocalStorage: {
        defaultStorageDirPath: '/data/owa',
        getItem: (key: string) => state.localItems.get(key) ?? null,
        setItem: (key: string, value: string) => {
            state.calls.push(`claim:${key}`);
            state.localItems.set(key, value);
        },
    },
}));
vi.mock('./server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => state.homeItems.get(key) ?? null,
    },
}));
vi.mock('./setting/appFontSettingHelpers', () => ({
    getAppFontFamily: async () => state.fontFamily,
    getAppFontWeight: async () => state.fontWeight,
}));
vi.mock('./helper/errorHelpers', () => ({ handleError: state.handleError }));
vi.mock('./lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getCurrentLocale: () => state.locale,
    getLangCode: () => state.langCode,
    getLangDataAsync: state.getLangDataAsync,
}));
vi.mock('./helper/presentingFlowRenameMigration', () => ({
    default: state.renameMigration,
}));
vi.mock('./helper/settingKeyPathMigration', () => ({
    default: state.keyPathMigration,
}));
vi.mock('./helper/previewerNoteCloseMigration', () => ({
    default: state.noteCloseMigration,
}));
vi.mock('./setting/directory-setting/dataDirMoveHelpers', () => ({
    runPendingDataDirMove: state.pendingMove,
}));

import { init } from './boot';

const KEY_PATH_SETTING = 'setting-key-path-migration';
const NOTE_CLOSE_SETTING = 'previewer-note-close-migration';

function customStyle() {
    return document.getElementById('app-custom-style') as HTMLStyleElement;
}

async function flushStyle() {
    for (let index = 0; index < 6; index++) {
        await Promise.resolve();
    }
}

beforeEach(() => {
    state.localItems.clear();
    state.homeItems.clear();
    state.calls = [];
    state.provider.sessionData = {};
    state.fontFamily = null;
    state.fontWeight = null;
    state.locale = 'km-KH';
    state.langCode = 'km';
    state.renameMigration.mockImplementation(async () => {
        state.calls.push('run:rename');
    });
    state.keyPathMigration.mockImplementation(async () => {
        state.calls.push('run:key-path');
    });
    state.noteCloseMigration.mockImplementation(async () => {
        state.calls.push('run:note-close');
    });
    state.pendingMove.mockImplementation(async () => {
        state.calls.push('run:data-dir-move');
    });
    state.getLangDataAsync.mockImplementation(async () => {
        state.calls.push('lang-data');
    });
});

afterEach(() => {
    customStyle()?.remove();
    document.documentElement.lang = '';
});

describe('window boot', () => {
    test('claims each one-off migration before running it, then loads the language and calls back', async () => {
        const callback = vi.fn(() => state.calls.push('callback'));

        await init(callback);

        expect(state.calls).toEqual([
            `claim:${PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME}`,
            'run:rename',
            `claim:${KEY_PATH_SETTING}`,
            'run:key-path',
            `claim:${NOTE_CLOSE_SETTING}`,
            'run:note-close',
            'lang-data',
            'callback',
        ]);
        expect(state.provider.sessionData.defaultStorageDirPath).toBe(
            '/data/owa',
        );
        expect(state.getLangDataAsync).toHaveBeenCalledWith('km-KH');
        expect(document.documentElement.lang).toBe('km');
        // No pending move was asked for, so its module is never loaded.
        expect(state.pendingMove).not.toHaveBeenCalled();
    });

    test('runs no migration a second time once its marker is claimed', async () => {
        state.localItems.set(
            PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME,
            'true',
        );
        state.localItems.set(KEY_PATH_SETTING, 'true');
        state.localItems.set(NOTE_CLOSE_SETTING, 'true');

        await init();

        expect(state.renameMigration).not.toHaveBeenCalled();
        expect(state.keyPathMigration).not.toHaveBeenCalled();
        expect(state.noteCloseMigration).not.toHaveBeenCalled();
        expect(state.calls).toEqual(['lang-data']);
    });

    test('reports a failed migration and still finishes booting with the marker kept', async () => {
        const failure = new Error('rename failed');
        state.renameMigration.mockRejectedValueOnce(failure);
        state.keyPathMigration.mockRejectedValueOnce(new Error('keys'));
        state.noteCloseMigration.mockRejectedValueOnce(new Error('note'));
        const callback = vi.fn();

        await init(callback);

        expect(state.handleError).toHaveBeenCalledWith(failure);
        expect(state.handleError).toHaveBeenCalledTimes(3);
        expect(callback).toHaveBeenCalledOnce();
        // Claimed before the work: a failure is not retried on every window.
        expect(
            state.localItems.get(PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME),
        ).toBe('true');
    });

    test('runs a pending data-folder move before anything reads the folder', async () => {
        state.homeItems.set('data-dir-move-pending', '{"to":"/new"}');

        await init();

        expect(state.calls[0]).toBe('run:data-dir-move');
        expect(state.calls).toContain(
            `claim:${PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME}`,
        );
    });

    test('reports a failed data-folder move and keeps booting', async () => {
        state.homeItems.set('data-dir-move-pending', '{}');
        const failure = new Error('rename blocked');
        state.pendingMove.mockRejectedValueOnce(failure);
        const callback = vi.fn();

        await init(callback);

        expect(state.handleError).toHaveBeenCalledWith(failure);
        expect(callback).toHaveBeenCalledOnce();
    });

    test('falls back to English for the document language when the locale has no code', async () => {
        state.langCode = null;

        await init();

        expect(document.documentElement.lang).toBe('en');
    });

    test('writes the chosen font family and weight with CSS-breaking characters removed', async () => {
        state.fontFamily = "Battambang'; } body { color: red";
        state.fontWeight = 600;

        await init();
        await flushStyle();

        const css = customStyle().innerHTML;
        expect(css).toContain("font-family: 'Battambang  body  color: red'");
        // One rule per setting: the name could not close a rule of its own.
        expect(css.match(/}/g)).toHaveLength(2);
        expect(css).toContain('font-weight: 600;');
    });

    test('reuses one style element and leaves it empty when no font is chosen', async () => {
        await init();
        await flushStyle();
        await init();
        await flushStyle();

        expect(document.querySelectorAll('#app-custom-style')).toHaveLength(1);
        expect(customStyle().innerHTML).toBe('');
    });
});
