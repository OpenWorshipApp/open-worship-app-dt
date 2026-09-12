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
import { getPresetList, repairGraph, savePreset } from './graphPresetHelpers';

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
