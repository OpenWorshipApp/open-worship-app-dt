// @vitest-environment jsdom
// jsdom because `errorHelpers` reaches `appProvider`, which touches `document`
// at module scope.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getSettingMock, setSettingMock } = vi.hoisted(() => ({
    getSettingMock: vi.fn<(key: string) => string | null>(() => {
        return null;
    }),
    setSettingMock: vi.fn(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));

import { createGraphView } from './core';
import type { GraphViewType } from './core';
import { handleError } from '../helper/errorHelpers';
import {
    deletePreset,
    getPresetList,
    repairGraph,
    savePreset,
} from './graphPresetHelpers';

function genGraph(): GraphViewType {
    return createGraphView({
        sourceId: 'lookup',
        root: { kind: 'name', recordId: 'hodaviah', name: 'Hodaviah' },
    });
}

/**
 * A graph as a FOUND PATH leaves it in an older stored value: the chain
 * replaced every box while the root key and the title stayed on the record the
 * search was started from.
 */
function genStalePathGraph(): GraphViewType {
    const graph = genGraph();
    return {
        ...graph,
        nodeList: [
            {
                key: 'name:david',
                kind: 'name',
                recordId: 'david',
                name: 'David',
                x: 0,
                y: 0,
                isPinned: true,
                isCollapsed: false,
                originKey: null,
                isExpanded: false,
            },
        ],
        pathNodeKeyList: ['name:david'],
    };
}

describe('graph presets', () => {
    beforeEach(() => {
        getSettingMock.mockReset();
        getSettingMock.mockReturnValue(null);
        setSettingMock.mockReset();
    });

    test('saves under a name and reads it back', () => {
        savePreset('Line of David', genGraph());
        const [, value] = setSettingMock.mock.calls.at(-1) ?? [];
        getSettingMock.mockReturnValue(value as string);
        const [preset] = getPresetList();
        expect(preset.name).toBe('Line of David');
        expect(preset.graph.title).toBe('Hodaviah');
        // A live "bring me forward" signal has no business in storage.
        expect(preset.graph.raiseCount).toBe(0);
    });

    test('repairs a root that names no box the graph holds', () => {
        const repaired = repairGraph(genStalePathGraph());
        expect(repaired.rootKey).toBe('name:david');
        expect(repaired.title).toBe('David');
    });

    test('leaves a healthy graph exactly as it is', () => {
        const graph = genGraph();
        expect(repairGraph(graph)).toBe(graph);
    });

    test('a stale stored preset is repaired rather than dropped', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify([
                {
                    name: 'Line of David',
                    savedAt: 1,
                    graph: genStalePathGraph(),
                },
            ]),
        );
        const [preset] = getPresetList();
        expect(preset.name).toBe('Line of David');
        expect(preset.graph.rootKey).toBe('name:david');
        expect(preset.graph.title).toBe('David');
    });

    test('a value that is not a graph at all is skipped', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify([{ name: 'broken', savedAt: 1, graph: null }]),
        );
        expect(getPresetList()).toHaveLength(0);
    });
});

describe('graph preset storage edge cases', () => {
    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
    });

    function genStored(nameList: string[]) {
        return JSON.stringify(
            nameList.map((name, index) => {
                return { name, savedAt: index, graph: genGraph() };
            }),
        );
    }

    function getWrittenNameList() {
        const [settingName, value] = setSettingMock.mock.calls.at(-1) ?? [];
        expect(settingName).toBe('graph-view-presets');
        return (JSON.parse(value as string) as { name: string }[]).map(
            (preset) => {
                return preset.name;
            },
        );
    }

    test('a corrupted stored value is reported and read as no presets', () => {
        getSettingMock.mockReturnValue('{not json');
        expect(getPresetList()).toEqual([]);
        expect(handleError).toHaveBeenCalledTimes(1);
        expect(handleError).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    test('a blank name saves nothing', () => {
        savePreset('   ', genGraph());
        expect(setSettingMock).not.toHaveBeenCalled();
    });

    test('saving under an existing name replaces it and moves it first', () => {
        getSettingMock.mockReturnValue(genStored(['Abraham', 'Isaac']));
        savePreset('  Isaac ', genGraph());
        expect(getWrittenNameList()).toEqual(['Isaac', 'Abraham']);
    });

    test('keeps at most thirty presets, dropping the oldest', () => {
        getSettingMock.mockReturnValue(
            genStored(
                Array.from({ length: 30 }, (_unused, index) => {
                    return `Preset ${index}`;
                }),
            ),
        );
        savePreset('Newest', genGraph());
        const nameList = getWrittenNameList();
        expect(nameList).toHaveLength(30);
        expect(nameList[0]).toBe('Newest');
        expect(nameList).not.toContain('Preset 29');
    });

    test('deleting removes only the preset with that name', () => {
        getSettingMock.mockReturnValue(
            genStored(['Abraham', 'Isaac', 'Jacob']),
        );
        deletePreset('Isaac');
        expect(getWrittenNameList()).toEqual(['Abraham', 'Jacob']);
    });

    test('a settings write that throws is reported, not thrown', () => {
        setSettingMock.mockImplementation(() => {
            throw new Error('disk full');
        });
        expect(() => {
            savePreset('Abraham', genGraph());
        }).not.toThrow();
        expect(handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'disk full' }),
        );
    });
});
