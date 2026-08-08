// @vitest-environment jsdom
// jsdom because `settingHelpers` is loaded for real (for the key sanitizer) and
// it pulls `appProvider`, which touches `document` at module scope.
import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * The migration is the only thing standing between an existing installation and
 * an empty panel, and it runs exactly once — there is no second chance to get
 * it right on a user's machine, and no way to re-run it here by hand. So the
 * whole pass is driven against an in-memory disk instead.
 */

const settings = new Map<string, string>();
// `name -> isFile`, keyed by full path.
const entries = new Map<string, boolean>();

function normalize(filePath: string) {
    const parts: string[] = [];
    for (const part of filePath.split('/')) {
        if (part === '..') {
            parts.pop();
        } else if (part !== '.') {
            parts.push(part);
        }
    }
    const joined = parts.join('/');
    return joined.length > 1 && joined.endsWith('/')
        ? joined.slice(0, -1)
        : joined;
}

vi.mock('../server/fileHelpers', () => {
    return {
        pathJoin: (...paths: string[]) => normalize(paths.join('/')),
        pathResolve: (...paths: string[]) => normalize(paths.join('/')),
        pathBasename: (filePath: string) => filePath.split('/').pop() ?? '',
        fsExistSync: (filePath: string) => entries.has(filePath),
        // Not used by the migration, only by `settingHelpers`, which is loaded
        // for real so the key sanitizer under test is the shipped one.
        fsCheckFileExist: async (filePath: string) => entries.has(filePath),
        fsList: async (dirPath: string) => {
            return [...entries.entries()]
                .filter(([filePath]) => {
                    return (
                        filePath.startsWith(`${dirPath}/`) &&
                        !filePath.slice(dirPath.length + 1).includes('/')
                    );
                })
                .map(([filePath, isFile]) => ({
                    name: filePath.slice(dirPath.length + 1),
                    filePath,
                    isFile,
                    isDirectory: !isFile,
                }));
        },
        fsMove: async (oldPath: string, newPath: string) => {
            for (const [filePath, isFile] of [...entries.entries()]) {
                if (
                    filePath === oldPath ||
                    filePath.startsWith(`${oldPath}/`)
                ) {
                    entries.delete(filePath);
                    entries.set(
                        newPath + filePath.slice(oldPath.length),
                        isFile,
                    );
                }
            }
        },
    };
});

vi.mock('../setting/directory-setting/appLocalStorage', () => {
    return {
        appLocalStorage: {
            listKeys: async () => [...settings.keys()],
            getItem: (key: string) => settings.get(key) ?? null,
            setItem: (key: string, value: string) => settings.set(key, value),
            removeItem: (key: string) => settings.delete(key),
        },
    };
});

vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));

const { default: migratePresentingFlowRename } =
    await import('./presentingFlowRenameMigration');

// A name the app never used, to prove the pass reads the old one off the
// installation rather than carrying a hard-coded copy of it.
const TOKEN = 'runsheet';
const LEGACY_DIR_PATH = `/data/${TOKEN}s`;
const DIR_PATH = '/data/presenting-flows';

beforeEach(() => {
    settings.clear();
    entries.clear();
    settings.set(`select-dir-${TOKEN}`, LEGACY_DIR_PATH);
    settings.set(`${TOKEN}-opened-_data_${TOKEN}s_pl1_owp`, 'true');
    settings.set(
        `${TOKEN}-item-expanded-_data_${TOKEN}s_pl1_owp-_docs_a_ows`,
        'true',
    );
    settings.set(`${TOKEN}-preview-thumbnail-size-scale`, '1.5');
    settings.set(`floating-widget-rect-${TOKEN}-preview`, '{"x":1}');
    settings.set('select-dir-app-document', '/data/documents');
    settings.set('select-dir-app-document-list-sort', 'asc');
    entries.set(LEGACY_DIR_PATH, false);
    entries.set(`${LEGACY_DIR_PATH}/pl1.owp`, true);
    entries.set(`${LEGACY_DIR_PATH}/pl1.owp.histories`, false);
    entries.set(`${LEGACY_DIR_PATH}/pl1.owp.histories/3-head`, true);
    entries.set(`${LEGACY_DIR_PATH}/notes.txt`, true);
    entries.set('/data/documents', false);
});

describe('presenting flow rename migration', () => {
    test('renames the data folder, its files and their history folders', async () => {
        await migratePresentingFlowRename();

        expect(entries.has(LEGACY_DIR_PATH)).toBe(false);
        expect(entries.has(`${DIR_PATH}/pl1.owpf`)).toBe(true);
        expect(entries.has(`${DIR_PATH}/pl1.owpf.histories/3-head`)).toBe(true);
        // Anything that is not ours is carried along untouched.
        expect(entries.has(`${DIR_PATH}/notes.txt`)).toBe(true);
    });

    test('rewrites every setting key the old name is baked into', async () => {
        await migratePresentingFlowRename();

        expect([...settings.keys()].some((key) => key.includes(TOKEN))).toBe(
            false,
        );
        expect(
            settings.get(
                `presenting-flow-opened-_data_presenting-flows_pl1_owpf`,
            ),
        ).toBe('true');
        expect(
            settings.get(
                'presenting-flow-item-expanded-' +
                    '_data_presenting-flows_pl1_owpf-_docs_a_ows',
            ),
        ).toBe('true');
        expect(
            settings.get('presenting-flow-preview-thumbnail-size-scale'),
        ).toBe('1.5');
        expect(
            settings.get('floating-widget-rect-presenting-flow-preview'),
        ).toBe('{"x":1}');
    });

    test('points the directory setting at where the folder actually ended up', async () => {
        await migratePresentingFlowRename();

        expect(settings.get('select-dir-presenting-flow')).toBe(DIR_PATH);
    });

    test('leaves the other directory settings alone', async () => {
        await migratePresentingFlowRename();

        expect(settings.get('select-dir-app-document')).toBe('/data/documents');
        expect(settings.get('select-dir-app-document-list-sort')).toBe('asc');
    });

    test('keeps a folder the user chose themselves where it is', async () => {
        const chosenDirPath = '/elsewhere/service';
        settings.set(`select-dir-${TOKEN}`, chosenDirPath);
        entries.delete(LEGACY_DIR_PATH);
        entries.delete(`${LEGACY_DIR_PATH}/pl1.owp`);
        entries.set(chosenDirPath, false);
        entries.set(`${chosenDirPath}/pl1.owp`, true);

        await migratePresentingFlowRename();

        expect(entries.has(`${chosenDirPath}/pl1.owpf`)).toBe(true);
        expect(settings.get('select-dir-presenting-flow')).toBe(chosenDirPath);
    });

    test('is a no-op once there is nothing left carrying the old extension', async () => {
        settings.clear();
        settings.set('select-dir-presenting-flow', DIR_PATH);
        entries.clear();
        entries.set(DIR_PATH, false);
        entries.set(`${DIR_PATH}/pl1.owpf`, true);

        await migratePresentingFlowRename();

        expect([...settings.keys()]).toEqual(['select-dir-presenting-flow']);
        expect(entries.has(`${DIR_PATH}/pl1.owpf`)).toBe(true);
    });

    test('does not clobber a file an interrupted attempt already produced', async () => {
        entries.set(`${LEGACY_DIR_PATH}/pl1.owpf`, true);

        await migratePresentingFlowRename();

        // Both survive the folder move, and the renamed one is left as it is
        // rather than being overwritten by the file it came from.
        expect(entries.has(`${DIR_PATH}/pl1.owp`)).toBe(true);
        expect(entries.has(`${DIR_PATH}/pl1.owpf`)).toBe(true);
    });
});
