import { describe, expect, it } from 'vitest';

import {
    AGENT_BACKUP_KEEP_COUNT,
    type AgentBackupMetaType,
    type AgentRestoreType,
    checkIsAgentBackupId,
    findLaterOverlappingChanges,
    genAgentBackupId,
    listRestoreFilePaths,
    pickPrunableBackupIds,
    pickUndoTarget,
    readAgentBackupFileName,
    sortRestoresForUndo,
    toAgentBackupFileNames,
} from './agentBackupPlanHelpers';

function genMeta(
    id: string,
    filePaths: string[],
    extra: Partial<AgentBackupMetaType> = {},
): AgentBackupMetaType {
    return {
        id,
        at: '2026-09-14T00:00:00.000Z',
        summary: id,
        filePaths,
        ...extra,
    };
}

describe('a backup id', () => {
    it('says when, sorts by it, and is a safe file name', () => {
        const earlier = genAgentBackupId(
            new Date('2026-09-14T15:16:23.456Z'),
            0.5,
        );
        const later = genAgentBackupId(new Date('2026-09-14T15:16:23.457Z'), 0);
        expect(earlier).toMatch(/^20260914-151623456-[a-z0-9]{4}$/);
        expect(checkIsAgentBackupId(earlier)).toBe(true);
        expect([later, earlier].sort()).toEqual([earlier, later]);
        const { meta, data } = toAgentBackupFileNames(earlier);
        expect(readAgentBackupFileName(meta)).toEqual({
            id: earlier,
            part: 'meta',
        });
        expect(readAgentBackupFileName(data)?.part).toBe('data');
    });

    // An id arrives from a tool call and names a file on disk.
    it('refuses anything that is not one', () => {
        for (const id of [
            '../setting',
            '20260914-151623456-ab12/../../x',
            '20260914-151623456-AB12',
            '',
            null,
            42,
        ]) {
            expect(checkIsAgentBackupId(id)).toBe(false);
        }
        expect(readAgentBackupFileName('settings.json')).toBeNull();
    });
});

describe('sortRestoresForUndo', () => {
    // A deleted document's unsaved state can only be written into a document
    // that exists again, and both are addressed by the name it had.
    it('renames, then files, then editing heads, keeping their own order', () => {
        const restoreList: AgentRestoreType[] = [
            { type: 'editing', kind: 'slide', filePath: '/a.ows', text: '{}' },
            { type: 'file', filePath: '/a.ows', text: '{}', kind: 'slide' },
            { type: 'file', filePath: '/a.ows.bg.json', text: '{}' },
            { type: 'rename', from: '/b.ows', to: '/a.ows' },
        ];
        expect(
            sortRestoresForUndo(restoreList).map((one) => {
                return one.type === 'rename'
                    ? 'rename'
                    : `${one.type}:${one.filePath}`;
            }),
        ).toEqual([
            'rename',
            'file:/a.ows',
            'file:/a.ows.bg.json',
            'editing:/a.ows',
        ]);
    });

    it('lists every file a backup concerns once', () => {
        expect(
            listRestoreFilePaths([
                { type: 'file', filePath: '/a', text: null },
                { type: 'editing', kind: 'lyric', filePath: '/a', text: '{}' },
                { type: 'rename', from: '/b', to: '/c' },
            ]),
        ).toEqual(['/a', '/b', '/c']);
    });
});

describe('pickPrunableBackupIds', () => {
    const now = new Date('2026-09-14T12:00:00.000Z');

    it('lets the oldest go past the count', () => {
        const idList = Array.from(
            { length: AGENT_BACKUP_KEEP_COUNT + 3 },
            (_value, index) => {
                return genAgentBackupId(
                    new Date(now.getTime() - (index + 1) * 1000),
                    0.5,
                );
            },
        );
        const prunedList = pickPrunableBackupIds(idList, now);
        expect(prunedList).toHaveLength(3);
        expect(prunedList).toEqual([...idList].sort().slice(0, 3));
    });

    it('lets go of anything older than the age, and nothing newer', () => {
        const old = genAgentBackupId(new Date('2026-08-01T00:00:00.000Z'), 0.5);
        const recent = genAgentBackupId(
            new Date('2026-09-13T00:00:00.000Z'),
            0.5,
        );
        expect(pickPrunableBackupIds([recent, old], now)).toEqual([old]);
    });
});

describe('pickUndoTarget', () => {
    const metaList = [
        genMeta('20260914-100000000-aaaa', ['/a']),
        genMeta('20260914-110000000-bbbb', ['/b'], {
            undoneAt: 'x',
            undoneBy: '20260914-120000000-cccc',
        }),
        genMeta('20260914-120000000-cccc', ['/b'], {
            undoOf: '20260914-110000000-bbbb',
        }),
    ];

    // "Undo" twice steps back through two changes; it never undoes the undo.
    it('means the newest change that is neither undone nor an undo', () => {
        expect(pickUndoTarget(metaList)?.id).toBe('20260914-100000000-aaaa');
    });

    it('means exactly the one named', () => {
        expect(pickUndoTarget(metaList, '20260914-120000000-cccc')?.id).toBe(
            '20260914-120000000-cccc',
        );
        expect(pickUndoTarget(metaList, '20260914-130000000-dddd')).toBeNull();
    });

    it('finds nothing to undo when everything is', () => {
        expect(pickUndoTarget([metaList[1], metaList[2]])).toBeNull();
    });
});

describe('findLaterOverlappingChanges', () => {
    it('names later changes still in force on the same files', () => {
        const target = genMeta('20260914-100000000-aaaa', ['/a']);
        const laterList = [
            genMeta('20260914-110000000-bbbb', ['/a', '/x']),
            genMeta('20260914-120000000-cccc', ['/a'], { undoneAt: 'x' }),
            genMeta('20260914-130000000-dddd', ['/z']),
            genMeta('20260914-090000000-eeee', ['/a']),
        ];
        expect(
            findLaterOverlappingChanges([target, ...laterList], target).map(
                (one) => {
                    return one.id;
                },
            ),
        ).toEqual(['20260914-110000000-bbbb']);
    });
});
