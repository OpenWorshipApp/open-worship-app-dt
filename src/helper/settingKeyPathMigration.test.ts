import { describe, expect, test, vi } from 'vitest';

vi.mock('../server/fileHelpers', () => ({
    DATA_DIR_RELATIVE_PATH_TOKEN: '@data',
    fsListDirectories: vi.fn(),
    getDataDirPath: () => null,
    pathSeparator: '\\',
    toDataDirRelativePath: (filePath: string) => filePath,
}));

vi.mock('./constants', () => ({ dirSourceSettingNames: {} }));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {},
}));

vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));

vi.mock('./settingHelpers', () => ({
    getSetting: () => null,
    toAbsoluteFilePathSettingKey: (...parts: string[]) => {
        return parts
            .join('-')
            .replace(/[\\/:*?"<>|.]/g, '_')
            .replace(/\s+/g, '_');
    },
}));

const { toMigratedSettingKey } = await import('./settingKeyPathMigration');

// This computer's data folder, and the folders the settings are about.
const DATA_DIR_KEY = 'C__Users_me_open-worship-data-dev_';
const CHILD_KEYS = ['documents', 'lyrics', 'presenting-flows', 'resources'];

function migrate(key: string) {
    return toMigratedSettingKey(key, DATA_DIR_KEY, '@data_', CHILD_KEYS);
}

describe('toMigratedSettingKey', () => {
    test("this computer's data folder becomes the relative form", () => {
        expect(
            migrate(
                'widget-size-app-document-previewer-C__Users_me_open-worship-data-dev_documents_Peaching_ows',
            ),
        ).toBe(
            'widget-size-app-document-previewer-@data_documents_Peaching_ows',
        );
    });

    test("another computer's path is cut where it meets a data folder", () => {
        expect(
            migrate(
                'widget-size-slide-editor-note-_Users_raksa_Desktop_open-worship-data_documents_song_74_new_ows',
            ),
        ).toBe('widget-size-slide-editor-note-@data_documents_song_74_new_ows');
    });

    test('a key naming two files migrates each path on its own', () => {
        expect(
            migrate(
                'presenting-flow-item-expanded-_Users_raksa_Desktop_open-worship-data_presenting-flows_test1_owpf-_Users_raksa_Desktop_open-worship-data_documents_a_ows',
            ),
        ).toBe(
            'presenting-flow-item-expanded-@data_presenting-flows_test1_owpf-@data_documents_a_ows',
        );
    });

    test('a folder this data folder is set to use elsewhere keeps its keys', () => {
        // Documents kept in ANOTHER data folder on this computer: the key
        // builder keeps absolute keys for them, so a guess would lose them.
        const key =
            'widget-size-app-document-previewer-C__Users_me_open-worship-data_documents_Peaching_ows';
        expect(
            toMigratedSettingKey(key, DATA_DIR_KEY, '@data_', CHILD_KEYS, [
                'C__Users_me_open-worship-data_documents',
            ]),
        ).toBe(key);
    });

    test('a path outside any data folder, or no path at all, is left alone', () => {
        const outside = 'resources-folder-expanded-D__Sermons_2026';
        expect(migrate(outside)).toBe(outside);
        expect(migrate('widget-size-slide-editor')).toBe(
            'widget-size-slide-editor',
        );
        const relative =
            'widget-size-app-document-previewer-@data_documents_a_ows';
        expect(migrate(relative)).toBe(relative);
    });
});
