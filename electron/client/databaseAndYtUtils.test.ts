import { DatabaseSync } from 'node:sqlite';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { closeMock, helperState } = vi.hoisted(() => ({
    closeMock: vi.fn(),
    helperState: { isMac: false, isWindows: true },
}));

vi.mock('../electronHelpers', () => ({
    attemptClosing: closeMock,
    get isMac() {
        return helperState.isMac;
    },
    get isWindows() {
        return helperState.isWindows;
    },
    toUnpackedPath: (filePath: string) => `unpacked:${filePath}`,
    unlocking: async (_key: string, callback: () => Promise<unknown>) => {
        return await callback();
    },
}));
import databaseUtils from './databaseUtils';
import { ytUtils } from './ytUtils';

describe('databaseUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        helperState.isWindows = true;
        helperState.isMac = false;
        vi.spyOn(DatabaseSync.prototype, 'loadExtension').mockImplementation(
            () => {},
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('opens SQLite with FTS support and delegates table operations', async () => {
        const db = await databaseUtils.getSQLiteDatabaseInstance(':memory:');
        db.createTable('CREATE TABLE notes (text TEXT)');
        db.exec("INSERT INTO notes VALUES ('hello')");

        expect(db.getAll('SELECT text FROM notes')).toEqual([
            { text: 'hello' },
        ]);
        expect(DatabaseSync.prototype.loadExtension).toHaveBeenCalledWith(
            expect.stringContaining('unpacked:'),
        );

        db.close();
        expect(closeMock).toHaveBeenCalledWith(db.database);
    });

    test('selects native extension names for macOS and Linux', async () => {
        helperState.isWindows = false;
        helperState.isMac = true;
        await databaseUtils.getSQLiteDatabaseInstance(':memory:');
        expect(DatabaseSync.prototype.loadExtension).toHaveBeenLastCalledWith(
            expect.stringContaining('.dylib'),
        );

        helperState.isMac = false;
        await databaseUtils.getSQLiteDatabaseInstance(':memory:');
        expect(DatabaseSync.prototype.loadExtension).toHaveBeenLastCalledWith(
            expect.stringContaining('.so'),
        );
    });
});

describe('ytUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('reuses the helper only for the same installed binary', async () => {
        const first = await ytUtils.getYTHelper('/pack-a/yt-dlp');
        const same = await ytUtils.getYTHelper('/pack-a/yt-dlp');
        const moved = await ytUtils.getYTHelper('/pack-b/yt-dlp');

        expect(same).toBe(first);
        expect(moved).not.toBe(first);
    });

    test('releases an idle helper after ten seconds', async () => {
        const first = await ytUtils.getYTHelper('/pack/yt-dlp');
        await vi.advanceTimersByTimeAsync(10_000);
        const afterRelease = await ytUtils.getYTHelper('/pack/yt-dlp');

        expect(afterRelease).not.toBe(first);
    });
});
