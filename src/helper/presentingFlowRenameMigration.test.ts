import path from 'node:path/posix';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    entries: new Map<
        string,
        { name: string; filePath: string; isFile: boolean }[]
    >(),
    existing: new Set<string>(),
    moves: [] as [string, string][],
    failMove: '' as string,
    handleError: vi.fn(),
}));

vi.mock('../server/fileHelpers', async () => {
    const pathModule = await import('node:path/posix');
    return {
        fsExistSync: (filePath: string) => state.existing.has(filePath),
        fsList: async (dirPath: string) => state.entries.get(dirPath) ?? [],
        fsMove: async (from: string, to: string) => {
            if (from === state.failMove) {
                throw new Error('move failed');
            }
            state.moves.push([from, to]);
            state.existing.delete(from);
            state.existing.add(to);
            if (state.entries.has(from)) {
                state.entries.set(
                    to,
                    state.entries.get(from)!.map((entry) => ({
                        ...entry,
                        filePath: pathModule.join(to, entry.name),
                    })),
                );
                state.entries.delete(from);
            }
        },
        pathBasename: pathModule.basename,
        pathJoin: pathModule.join,
        pathResolve: pathModule.resolve,
    };
});

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: async () => [...state.settings.keys()],
        getItem: (key: string) => state.settings.get(key) ?? null,
        setItem: (key: string, value: string) => state.settings.set(key, value),
        removeItem: (key: string) => state.settings.delete(key),
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: state.handleError }));
vi.mock('./settingHelpers', () => ({
    toAbsoluteFilePathSettingKey: (filePath: string) =>
        filePath.replace(/[/.]/g, '_'),
}));

import migratePresentingFlowRename from './presentingFlowRenameMigration';

const oldDir = '/data/set-lists';
const newDir = '/data/presenting-flows';
const oldDirKey = '_data_set-lists';
const newDirKey = '_data_presenting-flows';

function addEntry(dirPath: string, name: string, isFile: boolean) {
    const filePath = path.join(dirPath, name);
    state.entries.set(dirPath, [
        ...(state.entries.get(dirPath) ?? []),
        { name, filePath, isFile },
    ]);
    state.existing.add(filePath);
}

beforeEach(() => {
    state.settings.clear();
    state.entries.clear();
    state.existing.clear();
    state.moves.length = 0;
    state.failMove = '';
    state.handleError.mockClear();
});

describe('presenting flow rename migration', () => {
    it('discovers only an unknown directory setting that points to an old-format file', async () => {
        state.settings.set('select-dir-presenting-flow', '/data/current');
        state.settings.set('random-setting', '/data/other');
        state.settings.set('select-dir-missing', '/data/missing');
        state.settings.set('select-dir-empty', '/data/empty');
        state.settings.set('select-dir-images', '/data/images');
        state.existing.add('/data/empty');
        state.existing.add('/data/images');
        addEntry('/data/images', 'old.owp', false);
        await migratePresentingFlowRename();
        expect(state.moves).toEqual([]);
        expect(state.settings.get('select-dir-presenting-flow')).toBe(
            '/data/current',
        );
    });

    it('renames the default folder, old files and histories, and path-bearing settings', async () => {
        state.settings.set('select-dir-set-list', oldDir);
        state.settings.set(`row-set-list-${oldDirKey}_opening_owp`, 'expanded');
        state.settings.set('unrelated', 'keep');
        state.existing.add(oldDir);
        addEntry(oldDir, 'opening.owp', true);
        addEntry(oldDir, 'opening.owp.histories', false);
        addEntry(oldDir, 'leave.owpf', true);

        await migratePresentingFlowRename();

        expect(state.moves).toEqual([
            [oldDir, newDir],
            [`${newDir}/opening.owp`, `${newDir}/opening.owpf`],
            [
                `${newDir}/opening.owp.histories`,
                `${newDir}/opening.owpf.histories`,
            ],
        ]);
        expect(state.settings.get('select-dir-set-list')).toBeUndefined();
        expect(state.settings.get('select-dir-presenting-flow')).toBe(newDir);
        expect(
            state.settings.get(`row-presenting-flow-${newDirKey}_opening_owpf`),
        ).toBe('expanded');
        expect(state.settings.get('unrelated')).toBe('keep');
    });

    it('leaves a user-chosen folder in place and preserves existing targets', async () => {
        const customDir = '/custom/show';
        state.settings.set('select-dir-set-list', customDir);
        state.settings.set('row-set-list_extra_owp', 'keep');
        state.existing.add(customDir);
        state.existing.add(`${customDir}/existing.owpf`);
        addEntry(customDir, 'existing.owp', true);
        addEntry(customDir, 'new.owp', true);
        state.failMove = `${customDir}/new.owp`;

        await migratePresentingFlowRename();

        expect(state.moves).toEqual([]);
        expect(state.handleError).toHaveBeenCalledOnce();
        expect(state.settings.get('select-dir-presenting-flow')).toBe(
            customDir,
        );
        expect(state.settings.get('row-presenting-flow_extra_owpf')).toBe(
            'keep',
        );
    });
});
