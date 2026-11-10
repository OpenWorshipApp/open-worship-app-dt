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
    locale: 'xx-XX',
    langCode: 'xx' as string | null,
    isRtl: false,
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
    DEFAULT_LOCALE: 'en-US',
    // The window's language plugins, read before the locale.
    ensureLangPlugins: async () => [],
    checkIsRtl: () => state.isRtl,
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
// Each locale's face as its language data gives it; English's is the app's
// default (`data/en/fonts.json`).
const LANG_FONT_FAMILY_MAP: Record<string, string | undefined> = {
    'en-US': 'app-Google-Sans',
    'xx-XX': 'app-Xx-Face',
    'yy-YY': undefined,
};
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
    state.locale = 'xx-XX';
    state.langCode = 'xx';
    state.isRtl = false;
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
    state.getLangDataAsync.mockImplementation(async (locale: string) => {
        state.calls.push(`lang-data:${locale}`);
        return { fontFamily: LANG_FONT_FAMILY_MAP[locale] };
    });
});

afterEach(() => {
    customStyle()?.remove();
    document.getElementById('app-ui-text-direction')?.remove();
    document.documentElement.removeAttribute('data-ui-direction');
    document.documentElement.lang = '';
    document.documentElement.style.removeProperty('--app-font-family');
    document.body.style.fontFamily = '';
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
            'lang-data:xx-XX',
            // English too, for the app's default face behind the language's own.
            'lang-data:en-US',
            'callback',
        ]);
        expect(state.provider.sessionData.defaultStorageDirPath).toBe(
            '/data/owa',
        );
        expect(state.getLangDataAsync).toHaveBeenCalledWith('xx-XX');
        expect(document.documentElement.lang).toBe('xx');
        // No pending move was asked for, so its module is never loaded.
        expect(state.pendingMove).not.toHaveBeenCalled();
    });

    test('sets the data folder before its first await, for a window that does not wait', async () => {
        // The Lyric Editor starts `init` and reads its song in the same tick:
        // the `$DATA_DIR_PATH` in its folder setting expands only once this is
        // set. An `await` ahead of it -- even one that resolves at once --
        // left it null, and every song read as "not found".
        const pending = init();
        const dirPathInSameTick =
            state.provider.sessionData.defaultStorageDirPath;
        await pending;

        expect(dirPathInSameTick).toBe('/data/owa');
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
        expect(state.calls).toEqual(['lang-data:xx-XX', 'lang-data:en-US']);
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

    test('a right-to-left language reads each text its own way without mirroring the window', async () => {
        state.isRtl = true;
        state.locale = 'yy-YY';
        state.langCode = 'yy';

        await init();

        // The layout stays left to right: an English Bible, a file name or an
        // untranslated label must not flip with the UI's language.
        expect(document.documentElement.hasAttribute('dir')).toBe(false);
        expect(document.documentElement.getAttribute('data-ui-direction')).toBe(
            'rtl',
        );
        expect(
            document.getElementById('app-ui-text-direction')?.textContent,
        ).toContain('unicode-bidi: plaintext');
    });

    test('a left-to-right language injects no text-direction rule', async () => {
        await init();

        expect(document.documentElement.hasAttribute('dir')).toBe(false);
        expect(document.getElementById('app-ui-text-direction')).toBeNull();
    });

    test("puts the language's own face in front of English's on the page", async () => {
        await init();

        expect(
            document.documentElement.style.getPropertyValue(
                '--app-font-family',
            ),
        ).toBe('app-Xx-Face, app-Google-Sans');
        expect(document.body.style.fontFamily).toBe(
            'var(--app-font-family), var(--bs-body-font-family, system-ui, sans-serif)',
        );
    });

    test('an English window loads English once and draws in its face alone', async () => {
        state.locale = 'en-US';
        state.langCode = 'en';

        await init();

        expect(state.getLangDataAsync).toHaveBeenCalledOnce();
        expect(
            document.documentElement.style.getPropertyValue(
                '--app-font-family',
            ),
        ).toBe('app-Google-Sans');
    });

    test("a language with no face of its own is drawn in English's", async () => {
        state.locale = 'yy-YY';
        state.langCode = 'yy';

        await init();

        expect(
            document.documentElement.style.getPropertyValue(
                '--app-font-family',
            ),
        ).toBe('app-Google-Sans');
    });

    test('writes the chosen font family and weight with CSS-breaking characters removed', async () => {
        state.fontFamily = "Made Up Sans'; } body { color: red";
        state.fontWeight = 600;

        await init();
        await flushStyle();

        const css = customStyle().innerHTML;
        expect(css).toContain("font-family: 'Made Up Sans  body  color: red'");
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
