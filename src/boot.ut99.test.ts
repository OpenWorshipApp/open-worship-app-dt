// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME } from './helper/constants';
import { init } from './boot';

// `init()` is what every window runs before it draws anything. Every module it
// imports is mocked here except two leaves: the real setting-name constants and
// the real `sanitizeCssValue`, so a hostile font name is cleaned by the code
// that ships. The modules `init` loads on demand are mocked with getters, so a
// test sees whether the module was read at all, not only whether it ran.
const h = vi.hoisted(() => {
    return {
        events: [] as string[],
        localSettings: new Map<string, string>(),
        homeSettings: new Map<string, string>(),
        sessionData: {} as Record<string, unknown>,
        defaultStorageDirPath: '/data/open-worship-data',
        getCurrentLocale: vi.fn(),
        getLangCode: vi.fn(),
        getLangDataAsync: vi.fn(),
        handleError: vi.fn(),
        getAppFontFamily: vi.fn(),
        getAppFontWeight: vi.fn(),
        migratePresentingFlowRename: vi.fn(),
        migrateSettingKeyPaths: vi.fn(),
        migratePreviewerNoteClose: vi.fn(),
        runPendingDataDirMove: vi.fn(),
    };
});

vi.mock('./lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    // The window's language plugins, read before the locale.
    ensureLangPlugins: async () => [],
    checkIsRtl: () => false,
    getCurrentLocale: h.getCurrentLocale,
    getLangCode: h.getLangCode,
    getLangDataAsync: h.getLangDataAsync,
}));
vi.mock('./helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./setting/appFontSettingHelpers', () => ({
    getAppFontFamily: h.getAppFontFamily,
    getAppFontWeight: h.getAppFontWeight,
}));
vi.mock('./server/appProvider', () => ({
    default: {
        get sessionData() {
            return h.sessionData;
        },
    },
}));
vi.mock('./server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (name: string) => {
            h.events.push(`home-get:${name}`);
            return h.homeSettings.get(name) ?? null;
        },
    },
}));
vi.mock('./setting/directory-setting/appLocalStorage', () => ({
    DATA_DIR_MOVE_PENDING_SETTING_NAME: 'data-dir-move-pending',
    appLocalStorage: {
        getItem: (name: string) => {
            return h.localSettings.get(name) ?? null;
        },
        setItem: (name: string, value: string) => {
            h.events.push(`claim:${name}`);
            h.localSettings.set(name, value);
        },
        get defaultStorageDirPath() {
            h.events.push('read-storage-dir');
            return h.defaultStorageDirPath;
        },
    },
}));
vi.mock('./helper/presentingFlowRenameMigration', () => ({
    get default() {
        h.events.push('load:presenting-flow-rename');
        return h.migratePresentingFlowRename;
    },
}));
vi.mock('./helper/settingKeyPathMigration', () => ({
    get default() {
        h.events.push('load:setting-key-path');
        return h.migrateSettingKeyPaths;
    },
}));
vi.mock('./helper/previewerNoteCloseMigration', () => ({
    get default() {
        h.events.push('load:previewer-note-close');
        return h.migratePreviewerNoteClose;
    },
}));
vi.mock('./setting/directory-setting/dataDirMoveHelpers', () => ({
    get runPendingDataDirMove() {
        h.events.push('load:data-dir-move');
        return h.runPendingDataDirMove;
    },
}));

const MIGRATION_NAMES = [
    PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME,
    'setting-key-path-migration',
    'previewer-note-close-migration',
];

function getCustomStyle() {
    return document.getElementById('app-custom-style') as HTMLStyleElement;
}

/** `init` starts the font style without waiting for it. */
async function flushFontStyle() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

beforeEach(() => {
    h.events.length = 0;
    h.localSettings.clear();
    h.homeSettings.clear();
    h.sessionData = {};
    h.defaultStorageDirPath = '/data/open-worship-data';
    h.getCurrentLocale.mockReturnValue('km-KH');
    h.getLangCode.mockImplementation((locale: string) => {
        return locale === 'km-KH' ? 'km' : null;
    });
    h.getLangDataAsync.mockImplementation(async (locale: string) => {
        h.events.push(`lang-data:${locale}`);
        return { locale };
    });
    h.getAppFontFamily.mockResolvedValue(null);
    h.getAppFontWeight.mockResolvedValue(null);
    h.migratePresentingFlowRename.mockImplementation(async () => {
        h.events.push(
            `run:presenting-flow-rename@${h.sessionData.defaultStorageDirPath}`,
        );
    });
    h.migrateSettingKeyPaths.mockImplementation(async () => {
        h.events.push('run:setting-key-path');
    });
    h.migratePreviewerNoteClose.mockImplementation(async () => {
        h.events.push('run:previewer-note-close');
    });
    h.runPendingDataDirMove.mockImplementation(async () => {
        h.events.push('run:data-dir-move');
    });
});

afterEach(() => {
    getCustomStyle()?.remove();
    document.documentElement.lang = '';
    document.documentElement.style.removeProperty('--app-font-family');
    document.body.style.fontFamily = '';
});

describe('init: once-per-folder migrations', () => {
    test('a folder never migrated claims each marker BEFORE running its migration, in order, then loads the language', async () => {
        const callback = vi.fn(() => {
            h.events.push('callback');
        });
        await init(callback);

        expect(h.events).toEqual([
            'home-get:data-dir-move-pending',
            'read-storage-dir',
            `claim:${PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME}`,
            'load:presenting-flow-rename',
            // The storage folder is known before the first migration reads it.
            'run:presenting-flow-rename@/data/open-worship-data',
            'claim:setting-key-path-migration',
            'load:setting-key-path',
            'run:setting-key-path',
            'claim:previewer-note-close-migration',
            'load:previewer-note-close',
            'run:previewer-note-close',
            'lang-data:km-KH',
            'lang-data:en-US',
            'callback',
        ]);
        expect(callback).toHaveBeenCalledOnce();
        for (const name of MIGRATION_NAMES) {
            expect(h.localSettings.get(name)).toBe('true');
        }
        expect(h.sessionData.defaultStorageDirPath).toBe(
            '/data/open-worship-data',
        );
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a folder already migrated loads none of the migration modules', async () => {
        for (const name of MIGRATION_NAMES) {
            h.localSettings.set(name, 'true');
        }
        await init();

        expect(h.events).toEqual([
            'home-get:data-dir-move-pending',
            'read-storage-dir',
            'lang-data:km-KH',
            'lang-data:en-US',
        ]);
        expect(h.migratePresentingFlowRename).not.toHaveBeenCalled();
        expect(h.migrateSettingKeyPaths).not.toHaveBeenCalled();
        expect(h.migratePreviewerNoteClose).not.toHaveBeenCalled();
    });

    test('only the presenting-flow rename runs while only its marker is missing', async () => {
        h.localSettings.set('setting-key-path-migration', 'true');
        h.localSettings.set('previewer-note-close-migration', 'true');
        await init();

        expect(h.events).toContain('load:presenting-flow-rename');
        expect(h.migratePresentingFlowRename).toHaveBeenCalledOnce();
        expect(h.events).not.toContain('load:setting-key-path');
        expect(h.events).not.toContain('load:previewer-note-close');
    });

    test('a failing migration is reported, keeps its claim and does not stop the next one or the window', async () => {
        const renameError = new Error('rename failed');
        const keyPathError = new Error('key paths failed');
        h.migratePresentingFlowRename.mockRejectedValue(renameError);
        h.migrateSettingKeyPaths.mockImplementation(() => {
            throw keyPathError;
        });
        const callback = vi.fn();
        await init(callback);

        expect(h.handleError.mock.calls).toEqual([
            [renameError],
            [keyPathError],
        ]);
        // Claimed, so a second window opening at the same moment does not
        // retry a half-done move.
        for (const name of MIGRATION_NAMES) {
            expect(h.localSettings.get(name)).toBe('true');
        }
        expect(h.migratePreviewerNoteClose).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledOnce();
    });

    test('a failing previewer migration is reported and the language still loads', async () => {
        const previewerError = new Error('layouts unreadable');
        h.migratePreviewerNoteClose.mockRejectedValue(previewerError);
        const callback = vi.fn();
        await init(callback);

        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(previewerError);
        expect(h.localSettings.get('previewer-note-close-migration')).toBe(
            'true',
        );
        expect(h.getLangDataAsync.mock.calls).toEqual([['km-KH'], ['en-US']]);
        expect(callback).toHaveBeenCalledOnce();
    });
});

describe('init: a data-folder move waiting from before the relaunch', () => {
    test('runs first, before the storage folder is read', async () => {
        for (const name of MIGRATION_NAMES) {
            h.localSettings.set(name, 'true');
        }
        h.homeSettings.set('data-dir-move-pending', '{"to":"D:\\\\data"}');
        await init();

        expect(h.events).toEqual([
            'home-get:data-dir-move-pending',
            'load:data-dir-move',
            'run:data-dir-move',
            'read-storage-dir',
            'lang-data:km-KH',
            'lang-data:en-US',
        ]);
    });

    test('is reported when it fails, and the window still opens', async () => {
        for (const name of MIGRATION_NAMES) {
            h.localSettings.set(name, 'true');
        }
        h.homeSettings.set('data-dir-move-pending', '{}');
        const moveError = new Error('folder is in use');
        h.runPendingDataDirMove.mockRejectedValue(moveError);
        const callback = vi.fn();
        await init(callback);

        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(moveError);
        expect(h.sessionData.defaultStorageDirPath).toBe(
            '/data/open-worship-data',
        );
        expect(callback).toHaveBeenCalledOnce();
    });

    test('loads no move module when nothing is waiting', async () => {
        await init();
        expect(h.events).not.toContain('load:data-dir-move');
        expect(h.runPendingDataDirMove).not.toHaveBeenCalled();
    });
});

describe('init: language', () => {
    test('marks the document with the app language code', async () => {
        await init();
        expect(document.documentElement.lang).toBe('km');
        // The window's language, then English for the app's default face.
        expect(h.getLangDataAsync.mock.calls).toEqual([['km-KH'], ['en-US']]);
    });

    test('falls back to the default code for a locale with no language code', async () => {
        h.getCurrentLocale.mockReturnValue('xx-YY');
        await init();
        expect(h.getLangCode).toHaveBeenCalledWith('xx-YY');
        expect(document.documentElement.lang).toBe('en');
        expect(h.getLangDataAsync.mock.calls).toEqual([['xx-YY'], ['en-US']]);
    });

    test('runs the callback only once the language data is loaded', async () => {
        let resolveLangData: () => void = () => {};
        // The window's language waits; English, asked after it, does not.
        h.getLangDataAsync.mockImplementationOnce(() => {
            return new Promise<void>((resolve) => {
                resolveLangData = resolve;
            });
        });
        const callback = vi.fn();
        const booting = init(callback);
        await vi.waitFor(() => {
            expect(h.getLangDataAsync).toHaveBeenCalled();
        });
        await flushFontStyle();
        expect(callback).not.toHaveBeenCalled();
        resolveLangData();
        await booting;
        expect(callback).toHaveBeenCalledOnce();
    });

    test('works with no callback at all', async () => {
        await expect(init()).resolves.toBeUndefined();
    });
});

describe('init: the app font style', () => {
    test('writes the chosen family and weight into one style element', async () => {
        h.getAppFontFamily.mockResolvedValue('Battambang');
        h.getAppFontWeight.mockResolvedValue('700');
        await init();
        await flushFontStyle();

        const styles = document.head.querySelectorAll('style#app-custom-style');
        expect(styles).toHaveLength(1);
        const css = styles[0].innerHTML.replaceAll(/\s+/g, ' ').trim();
        expect(css).toBe(
            "* { font-family: 'Battambang'; } * { font-weight: 700; }",
        );
    });

    test('a hostile family name cannot close the rule or the quotes', async () => {
        h.getAppFontFamily.mockResolvedValue(
            "Evil'; } body { display: none; } <script>\\",
        );
        await init();
        await flushFontStyle();

        const css = getCustomStyle().innerHTML;
        expect(css).toContain(
            "font-family: 'Evil  body  display: none  script';",
        );
        expect(css.match(/[{}]/g)).toEqual(['{', '}']);
        expect(css).not.toContain('<');
        expect(css).not.toContain('\\');
    });

    test('a hostile weight cannot add a declaration', async () => {
        h.getAppFontFamily.mockResolvedValue('Battambang');
        h.getAppFontWeight.mockResolvedValue('700; color: red}');
        await init();
        await flushFontStyle();

        const css = getCustomStyle().innerHTML;
        expect(css).toContain('font-weight: 700 color: red;');
        expect(css.match(/[{}]/g)).toEqual(['{', '}', '{', '}']);
    });

    test('no chosen font leaves an empty style element in the head', async () => {
        await init();
        await flushFontStyle();
        expect(getCustomStyle().parentElement).toBe(document.head);
        expect(getCustomStyle().innerHTML).toBe('');
    });

    test('a second init reuses the element and replaces the family', async () => {
        h.getAppFontFamily.mockResolvedValue('Battambang');
        await init();
        await flushFontStyle();
        h.getAppFontFamily.mockResolvedValue('Noto Serif');
        await init();
        await flushFontStyle();

        expect(
            document.head.querySelectorAll('style#app-custom-style'),
        ).toHaveLength(1);
        const css = getCustomStyle().innerHTML;
        expect(css).toContain("font-family: 'Noto Serif';");
        expect(css).not.toContain('Battambang');
    });
});
