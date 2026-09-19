import { getSetting, setSetting } from '../helper/settingHelpers';
import { handleError } from '../helper/errorHelpers';
import type { GraphViewType } from './core';

/**
 * Saving and restoring graphs.
 *
 * Named presets, and nothing else: opening a record always starts a fresh
 * graph, so the only thing kept between sessions is what the user explicitly
 * asked to keep.
 *
 * What is stored is record IDS and positions — never record CONTENT. A preset
 * therefore survives a dataset update and a lookup-language change (the same
 * ids resolve to the translated records), and it can never pin the ~34MB
 * dataset alive through a settings string.
 */

const PRESET_SETTING_NAME = 'graph-view-presets';

// Enough to be useful, small enough that the settings file stays sane: a
// 120-node graph serializes to roughly 20KB.
const MAX_PRESET_COUNT = 30;

export type GraphPresetType = {
    name: string;
    savedAt: number;
    graph: GraphViewType;
};

/**
 * Strips the fields that describe THIS session rather than the graph.
 *
 * `raiseCount` is a live "bring me forward" signal; restoring one would make a
 * reopened graph fight for the front for no reason.
 */
function toStorableGraph(graph: Readonly<GraphViewType>): GraphViewType {
    return { ...graph, raiseCount: 0 };
}

/**
 * Puts a stored graph back on its feet.
 *
 * A graph whose `rootKey` names no box it holds is not a corrupt file — it is
 * what a FOUND PATH used to leave behind: the chain replaced the canvas while
 * `rootKey` and the panel title stayed on the record the search was started
 * from. Restoring one gave a panel named after a record that was nowhere on it.
 * Newly saved graphs cannot be in that state; these are the ones already
 * written to settings.
 */
export function repairGraph(graph: GraphViewType): GraphViewType {
    const hasRoot = graph.nodeList.some((node) => {
        return node.key === graph.rootKey;
    });
    if (hasRoot) {
        return graph;
    }
    const first = graph.nodeList[0];
    return { ...graph, rootKey: first.key, title: first.name };
}

function readJson<T>(settingName: string, fallback: T): T {
    const raw = getSetting(settingName);
    if (!raw) {
        return fallback;
    }
    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        // A corrupted or half-written value must not take the panel down with
        // it; losing saved layouts is recoverable, a crash on open is not.
        handleError(error);
        return fallback;
    }
}

function writeJson(settingName: string, value: unknown) {
    try {
        setSetting(settingName, JSON.stringify(value));
    } catch (error) {
        handleError(error);
    }
}

/**
 * Whether a stored value still looks like a graph.
 *
 * Settings survive app upgrades, so a value written by an older shape can come
 * back; a missing array here would throw deep inside the renderer instead of
 * simply falling back to a fresh graph.
 */
export function checkIsGraphValid(value: unknown): value is GraphViewType {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const graph = value as Partial<GraphViewType>;
    return (
        typeof graph.key === 'string' &&
        typeof graph.rootKey === 'string' &&
        Array.isArray(graph.nodeList) &&
        Array.isArray(graph.edgeList) &&
        graph.nodeList.length > 0
    );
}

export function getPresetList(): GraphPresetType[] {
    return readJson<GraphPresetType[]>(PRESET_SETTING_NAME, [])
        .filter((preset) => {
            return (
                typeof preset?.name === 'string' &&
                checkIsGraphValid(preset?.graph)
            );
        })
        .map((preset) => {
            // A preset is a NAMED arrangement, so a stale one is repaired
            // rather than dropped: the user asked for it to be kept.
            return { ...preset, graph: repairGraph(preset.graph) };
        });
}

/** Saves under a name, replacing any preset that already had it. */
export function savePreset(name: string, graph: Readonly<GraphViewType>) {
    const trimmedName = name.trim();
    if (trimmedName === '') {
        return;
    }
    const list = getPresetList().filter((preset) => {
        return preset.name !== trimmedName;
    });
    writeJson(
        PRESET_SETTING_NAME,
        [
            {
                name: trimmedName,
                savedAt: Date.now(),
                graph: toStorableGraph(graph),
            },
            ...list,
        ].slice(0, MAX_PRESET_COUNT),
    );
}

export function deletePreset(name: string) {
    writeJson(
        PRESET_SETTING_NAME,
        getPresetList().filter((preset) => {
            return preset.name !== name;
        }),
    );
}
