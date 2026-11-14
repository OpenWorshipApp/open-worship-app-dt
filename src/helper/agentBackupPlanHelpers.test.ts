import { describe, expect, it } from 'vitest';

import {
    AGENT_BACKUP_KEEP_COUNT,
    type AgentBackupMetaType,
    type AgentRestoreType,
    checkIsAgentBackupId,
    checkIsScreenRestore,
    diffForegroundSlots,
    diffScreenLayers,
    diffScreenSettings,
    diffTextLayers,
    findLaterOverlappingChanges,
    genAddedScreenRestores,
    genLaterChangesNote,
    genAgentBackupId,
    listRestoreFilePaths,
    mergeForegroundSlot,
    pickPrunableBackupIds,
    pickUndoTarget,
    readAgentBackupFileName,
    sortRestoresForUndo,
    toAgentBackupFileNames,
    toForegroundItemKey,
    toScreenLayerKey,
    toTextLayerKey,
    type AgentScreenControlsType,
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
        // The copy of a binary file a change keeps (MC-52).
        expect(
            readAgentBackupFileName('20260914-151623456-k3x9.blob-0.bin'),
        ).toEqual({ id: '20260914-151623456-k3x9', part: 'blob' });
        expect(
            readAgentBackupFileName('20260914-151623456-k3x9.blob-0.json'),
        ).toEqual({ id: '20260914-151623456-k3x9', part: 'blob' });
        expect(
            readAgentBackupFileName('20260914-151623456-k3x9.blob.bin'),
        ).toBeNull();
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
                    : one.type === 'app-setting'
                      ? `${one.type}:${one.key}`
                      : one.type === 'screen-foreground' ||
                          one.type === 'screen-text' ||
                          one.type === 'screen-setting' ||
                          one.type === 'screen-layer' ||
                          one.type === 'screen-presence'
                        ? `${one.type}:${one.screenId}`
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

    // EC-630: a screen added, then moved and turned on and off, all went
    // with the undo of its add -- and nothing named them.
    it('names every later change on a screen the change added', () => {
        const target = genMeta('20261114-100000000-aaaa', ['screen:2']);
        const laterList = [
            genMeta('20261114-110000000-bbbb', ['screen:2:display']),
            genMeta('20261114-120000000-cccc', ['screen:2:countdownDataList:']),
            genMeta('20261114-130000000-dddd', ['screen:20:display']),
            genMeta('20261114-140000000-eeee', ['screen:1:showing']),
        ];
        expect(
            findLaterOverlappingChanges([target, ...laterList], target).map(
                (one) => {
                    return one.id;
                },
            ),
        ).toEqual(['20261114-110000000-bbbb', '20261114-120000000-cccc']);
        expect(
            genLaterChangesNote(target, [laterList[0], laterList[1]]),
        ).toContain('Later changes to the same screen went back with it');
        // A screen's own control is not the whole screen: a later add of a
        // screen that took its number did not go back with it.
        const displayTarget = genMeta('20261114-100000000-ffff', [
            'screen:2:display',
        ]);
        expect(
            findLaterOverlappingChanges(
                [
                    displayTarget,
                    genMeta('20261114-110000000-gggg', ['screen:2']),
                ],
                displayTarget,
            ),
        ).toEqual([]);
    });
});

describe('genLaterChangesNote (EC-613)', () => {
    const target = genMeta('20261114-100000000-aaaa', [
        '/songs/One.owl',
        'setting:foreground-countdown',
        'screen:0:lock',
    ]);

    it('says nothing when no later change went back', () => {
        expect(genLaterChangesNote(target, [])).toBe('');
    });

    it('names what the later change shared: a file, a setting or a screen', () => {
        const genNote = (filePaths: string[]) => {
            return genLaterChangesNote(target, [
                genMeta('20261114-110000000-bbbb', filePaths),
            ]);
        };
        expect(genNote(['/songs/One.owl'])).toContain(
            'Later changes to the same file went back with it',
        );
        expect(genNote(['setting:foreground-countdown'])).toContain(
            'the same setting went back',
        );
        // A screen's lock has no file: the old sentence said "file".
        expect(genNote(['screen:0:lock', 'screen:1:lock'])).toContain(
            'Later changes to the same screen went back with it',
        );
        expect(genNote(['screen:0:lock', '/songs/One.owl'])).toContain(
            'the same file, setting or screen',
        );
        // Only what it SHARED counts: screen 1 was never the target's.
        expect(genNote(['/songs/One.owl', 'screen:1:lock'])).toContain(
            'the same file went back',
        );
    });
});

// EC-540: an undo of a start put the session's settings back and left its
// countdown running on the wall. A show now keeps each screen slot it changed.
describe('a screen foreground slot', () => {
    it('is the item id, a number as text, and "" for a Default session', () => {
        expect(toForegroundItemKey({ id: 's5k1' })).toBe('s5k1');
        expect(toForegroundItemKey({ id: 2 })).toBe('2');
        expect(toForegroundItemKey({ text: 'Default' })).toBe('');
        expect(toForegroundItemKey(null)).toBe('');
    });

    it('names only the slots a show changed, with what they held', () => {
        const other = { id: 'other', text: 'Welcome' };
        const restoreList = diffForegroundSlots(
            'countdownDataList',
            [
                { screenId: 0, items: [other, { text: 'old default' }] },
                { screenId: 1, items: [] },
            ],
            [
                {
                    screenId: 0,
                    items: [
                        other,
                        { text: 'new default' },
                        { id: 's9', text: '5:00' },
                    ],
                },
                { screenId: 1, items: [] },
            ],
            'countdown',
        );
        expect(restoreList).toEqual([
            {
                type: 'screen-foreground',
                screenId: 0,
                listKey: 'countdownDataList',
                itemKey: '',
                items: [{ text: 'old default' }],
                foreground: 'countdown',
            },
            {
                type: 'screen-foreground',
                screenId: 0,
                listKey: 'countdownDataList',
                itemKey: 's9',
                items: [],
                foreground: 'countdown',
            },
        ]);
    });

    it('names a slot a show emptied, and a screen first seen after it', () => {
        expect(
            diffForegroundSlots(
                'messageDataList',
                [{ screenId: 0, items: [{ id: 'message-1-s2', t: 'a' }] }],
                [
                    { screenId: 0, items: [{ id: 'message-all-s2', t: 'b' }] },
                    { screenId: 3, items: [{ id: 'message-1-s2', t: 'a' }] },
                ],
            ).map((restore) => {
                return restore.type === 'screen-foreground'
                    ? `${restore.screenId}:${restore.itemKey}:${restore.items.length}`
                    : restore.type;
            }),
        ).toEqual([
            '0:message-1-s2:1',
            '0:message-all-s2:0',
            '3:message-1-s2:0',
        ]);
    });

    it('names nothing when the screens did not change', () => {
        const items = [{ id: 'a', dateTime: '2026-11-13T00:00:00.000Z' }];
        expect(
            diffForegroundSlots(
                'countdownDataList',
                [{ screenId: 0, items }],
                [{ screenId: 0, items: [...items] }],
            ),
        ).toEqual([]);
    });

    it('is put back in its place, every other item kept as the same object', () => {
        const first = { id: 'a' };
        const last = { id: 'c' };
        const merged = mergeForegroundSlot(
            [first, { id: 'b', n: 1 }, last],
            'b',
            [{ id: 'b', n: 0 }],
        );
        expect(merged).toEqual([first, { id: 'b', n: 0 }, last]);
        expect(merged[0]).toBe(first);
        expect(merged[2]).toBe(last);
    });

    it('is emptied, or filled at the end when the screen lacks it', () => {
        expect(mergeForegroundSlot([{ id: 'a' }, {}], '', [])).toEqual([
            { id: 'a' },
        ]);
        expect(mergeForegroundSlot([{ id: 'a' }], 'z', [{ id: 'z' }])).toEqual([
            { id: 'a' },
            { id: 'z' },
        ]);
    });

    it('goes back last, after the session it belongs to', () => {
        expect(
            sortRestoresForUndo([
                {
                    type: 'screen-foreground',
                    screenId: 0,
                    listKey: 'countdownDataList',
                    itemKey: 's9',
                    items: [],
                },
                { type: 'app-setting', key: 'k', text: null },
            ]).map((restore) => {
                return restore.type;
            }),
        ).toEqual(['app-setting', 'screen-foreground']);
    });

    it('is named by screen, list and slot, so a later show into it is seen', () => {
        expect(
            listRestoreFilePaths([
                {
                    type: 'screen-foreground',
                    screenId: 1,
                    listKey: 'quickTextDataList',
                    itemKey: '',
                    items: [],
                },
            ]),
        ).toEqual(['screen:1:quickTextDataList:']);
    });
});

// EC-550: a Long Text Show is drawn in the text layer a Bible passage is
// drawn in, so its start keeps that layer, by what holds it.
describe('a screen text layer', () => {
    const longText = (sourceId: string, scroll = 0) => ({
        type: 'long-text',
        longTextData: { sourceId, renderedList: [] },
        scroll,
        selectedKJVVerseKey: null,
    });
    const verse = {
        type: 'bible-item',
        bibleItemData: {
            renderedList: [],
            bibleItem: { bibleKey: 'KJV', target: { bookKey: 'JHN' } },
        },
        scroll: 0,
        selectedKJVVerseKey: null,
    };

    it('tells nothing, a long text by its session and a verse apart', () => {
        expect(toTextLayerKey(null)).toBe('');
        expect(toTextLayerKey(undefined)).toBe('');
        expect(toTextLayerKey(longText('long-text-s1', 40))).toBe(
            'long-text:long-text-s1',
        );
        expect(toTextLayerKey(verse)).toBe(
            'bible:{"bibleKey":"KJV","target":{"bookKey":"JHN"}}',
        );
    });

    it('names each screen a start changed, with what it held before', () => {
        const restoreList = diffTextLayers(
            [
                { screenId: 0, data: verse },
                { screenId: 1, data: null },
                { screenId: 2, data: longText('long-text-s1') },
            ],
            [
                { screenId: 0, data: longText('long-text') },
                { screenId: 1, data: longText('long-text') },
                { screenId: 2, data: longText('long-text-s1') },
            ],
            'long-text',
        );
        expect(restoreList).toEqual([
            {
                type: 'screen-text',
                screenId: 0,
                data: verse,
                expect: 'long-text:long-text',
                foreground: 'long-text',
            },
            {
                type: 'screen-text',
                screenId: 1,
                data: null,
                expect: 'long-text:long-text',
                foreground: 'long-text',
            },
        ]);
    });

    it('goes after the session, and is named by its screen', () => {
        const textRestore: AgentRestoreType = {
            type: 'screen-text',
            screenId: 3,
            data: null,
            expect: 'long-text:long-text',
        };
        expect(
            sortRestoresForUndo([
                textRestore,
                { type: 'app-setting', key: 'long-text-setting', text: '{}' },
            ]).map((one) => {
                return one.type;
            }),
        ).toEqual(['app-setting', 'screen-text']);
        expect(listRestoreFilePaths([textRestore])).toEqual(['screen:3:text']);
    });
});

describe("a screen's controls and layers", () => {
    function genControls(
        screens: {
            screenId: number;
            values?: Record<string, unknown>;
            transitions?: Record<string, unknown>;
        }[],
        style: unknown = { fontSize: 65 },
    ): AgentScreenControlsType {
        return {
            style,
            screens: screens.map((screen) => {
                return {
                    screenId: screen.screenId,
                    values: {
                        group: null,
                        display: 1,
                        stage: 0,
                        'line-sync': false,
                        selected: true,
                        showing: true,
                        lock: false,
                        ...screen.values,
                    },
                    transitions: {
                        'vary-app-document': 'fade',
                        background: 'fade',
                        foreground: 'fade',
                        ...screen.transitions,
                    },
                };
            }),
        };
    }

    it('keeps what each changed control was, the shared style last', () => {
        const before = genControls([{ screenId: 0 }, { screenId: 1 }]);
        const after = genControls(
            [
                { screenId: 0, values: { group: '#FFFF00', lock: true } },
                { screenId: 1, transitions: { background: 'zoom' } },
            ],
            { fontSize: 81 },
        );
        expect(diffScreenSettings(before, after)).toEqual([
            {
                type: 'screen-setting',
                field: 'group',
                screenId: 0,
                value: null,
            },
            {
                type: 'screen-setting',
                field: 'lock',
                screenId: 0,
                value: false,
            },
            {
                type: 'screen-setting',
                field: 'transition',
                screenId: 1,
                target: 'background',
                value: 'fade',
            },
            { type: 'screen-setting', field: 'style', value: { fontSize: 65 } },
        ]);
        expect(diffScreenSettings(before, before)).toEqual([]);
    });

    it('puts the slide transition back with the stage, changed or not', () => {
        // A stage above 0 sets the slide transition to none; the stage put
        // back can set it again, so the transition it had goes back after.
        const before = genControls([{ screenId: 0 }]);
        const after = genControls([{ screenId: 0, values: { stage: 2 } }]);
        expect(diffScreenSettings(before, after)).toEqual([
            { type: 'screen-setting', field: 'stage', screenId: 0, value: 0 },
            {
                type: 'screen-setting',
                field: 'transition',
                screenId: 0,
                target: 'vary-app-document',
                value: 'fade',
            },
        ]);
    });

    it('has nothing to put back on a screen added by the change', () => {
        const before = genControls([{ screenId: 0 }]);
        const after = genControls([
            { screenId: 0 },
            { screenId: 1, values: { group: '#FFFF00' } },
        ]);
        expect(diffScreenSettings(before, after)).toEqual([]);
    });

    it('keeps what a layer held and what the change left there', () => {
        const background = { src: 'sunrise.jpg', type: 'image' };
        const slide = { droppedSlide: { id: 4 } };
        const restoreList = diffScreenLayers(
            [
                { screenId: 0, background, slide: null },
                { screenId: 1, background: null, slide },
            ],
            [
                { screenId: 0, background: null, slide: null },
                { screenId: 1, background, slide },
            ],
        );
        expect(restoreList).toEqual([
            {
                type: 'screen-layer',
                screenId: 0,
                layer: 'background',
                data: background,
                expect: '',
            },
            {
                type: 'screen-layer',
                screenId: 1,
                layer: 'background',
                data: null,
                expect: toScreenLayerKey(background),
            },
        ]);
    });

    it('tells layer contents apart by a short key, nothing as empty', () => {
        expect(toScreenLayerKey(null)).toBe('');
        expect(toScreenLayerKey(undefined)).toBe('');
        const key = toScreenLayerKey({ src: 'a.jpg' });
        expect(key).toMatch(/^\d+:[\da-z]+$/);
        expect(toScreenLayerKey({ src: 'a.jpg' })).toBe(key);
        expect(toScreenLayerKey({ src: 'b.jpg' })).not.toBe(key);
    });

    it('unlocks first and locks or turns a screen on last', () => {
        const restoreList: AgentRestoreType[] = [
            {
                type: 'screen-setting',
                field: 'showing',
                screenId: 0,
                value: true,
            },
            {
                type: 'screen-setting',
                field: 'line-sync',
                screenId: 0,
                value: false,
            },
            {
                type: 'screen-setting',
                field: 'lock',
                screenId: 0,
                value: false,
            },
            {
                type: 'screen-layer',
                screenId: 0,
                layer: 'slide',
                data: null,
                expect: '',
            },
            { type: 'screen-setting', field: 'lock', screenId: 1, value: true },
            { type: 'screen-setting', field: 'style', value: {} },
        ];
        expect(
            sortRestoresForUndo(restoreList).map((one) => {
                return one.type === 'screen-setting'
                    ? `${one.field}:${String(one.value === true)}`
                    : one.type;
            }),
        ).toEqual([
            // Locked, the screen would refuse its Line Sync and its layers.
            'lock:false',
            'line-sync:false',
            'style:false',
            'screen-layer',
            'showing:true',
            'lock:true',
        ]);
    });

    it('is a screen restore, named by its screen and control', () => {
        const restoreList: AgentRestoreType[] = [
            {
                type: 'screen-setting',
                field: 'transition',
                screenId: 2,
                target: 'background',
                value: 'fade',
            },
            { type: 'screen-setting', field: 'style', value: {} },
            {
                type: 'screen-layer',
                screenId: 2,
                layer: 'slide',
                data: null,
                expect: '',
            },
        ];
        expect(restoreList.every(checkIsScreenRestore)).toBe(true);
        expect(
            checkIsScreenRestore({ type: 'file', filePath: '/a', text: null }),
        ).toBe(false);
        expect(listRestoreFilePaths(restoreList)).toEqual([
            'screen:2:transition:background',
            'screen:style',
            'screen:2:slide',
        ]);
    });
});

describe('a screen added (EC-630)', () => {
    it('takes away each screen live after the change and not before', () => {
        expect(genAddedScreenRestores([0, 1], [0, 2, 1, 3, 2])).toEqual([
            { type: 'screen-presence', screenId: 2, present: false },
            { type: 'screen-presence', screenId: 3, present: false },
        ]);
        // A screen gone by the end of a change is no screen added.
        expect(genAddedScreenRestores([0, 1], [0])).toEqual([]);
        expect(genAddedScreenRestores([], [])).toEqual([]);
    });

    it('puts a screen back first and takes one away last', () => {
        const restoreList: AgentRestoreType[] = [
            { type: 'screen-presence', screenId: 3, present: false },
            {
                type: 'screen-setting',
                field: 'display',
                screenId: 2,
                value: 7,
            },
            {
                type: 'screen-setting',
                field: 'lock',
                screenId: 2,
                value: false,
            },
            { type: 'screen-presence', screenId: 2, present: true },
            { type: 'screen-setting', field: 'lock', screenId: 1, value: true },
        ];
        expect(
            sortRestoresForUndo(restoreList).map((one) => {
                return one.type === 'screen-setting'
                    ? `${one.field}:${one.screenId}`
                    : one.type === 'screen-presence'
                      ? `${one.type}:${one.screenId}`
                      : one.type;
            }),
        ).toEqual([
            // Its settings, the unlock too, have a screen to go to.
            'screen-presence:2',
            'lock:2',
            'display:2',
            'lock:1',
            'screen-presence:3',
        ]);
    });

    it('is a screen restore, named by its screen alone', () => {
        const restore: AgentRestoreType = {
            type: 'screen-presence',
            screenId: 2,
            present: false,
        };
        expect(checkIsScreenRestore(restore)).toBe(true);
        expect(listRestoreFilePaths([restore])).toEqual(['screen:2']);
    });
});
