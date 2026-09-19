import appProvider from '../server/appProvider';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

/**
 * One collapsible pane, as the native **View → Widgets** menu sees it.
 *
 * `id` is the identity the menu clicks come back with, and it is derived from
 * the owning actor's `flexSizeName` plus the pane key so it survives a rename of
 * the user-visible label. `widgetName` is only the label — it must be unique per
 * page or the menu shows two identical checkboxes (see `checkAreNamesUnique`).
 */
export type WidgetEntryType = {
    id: string;
    widgetName: string;
    isHidden: boolean;
    toggle: () => void;
};

export function toWidgetId(flexSizeName: string, key: string) {
    return `${flexSizeName}::${key}`;
}

// Keyed by REGISTRANT — in practice one `toWidgetId` per pane, since each pane
// registers and unregisters on its own so an unmounting one cannot leave a dead
// entry behind. A caller is free to write several entries under one key; what
// matters is that the key it unregisters with is the key it registered with.
// Insertion order is mount order, which `getWidgetEntries` re-sorts anyway.
const widgetEntriesMap = new Map<string, WidgetEntryType[]>();
const resetHandlerMap = new Map<string, () => void>();

const listeners = new Set<() => void>();

// Module level is right here: the ONE menu builder is the only subscriber, so
// there is nothing for a shared timer to collapse away. It matters because every
// rebuild is an IPC round trip plus a full `initMenu()` +
// `Menu.setApplicationMenu` in the main process, and mounting a page registers a
// dozen actors within a few frames.
const attemptTimeout = genTimeoutAttempt(500);

function notifyChanged() {
    attemptTimeout(() => {
        for (const listener of listeners) {
            listener();
        }
    });
}

export function subscribeWidgetsChanged(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function registerWidgets(
    registrantKey: string,
    entries: WidgetEntryType[],
) {
    if (entries.length === 0) {
        widgetEntriesMap.delete(registrantKey);
    } else {
        widgetEntriesMap.set(registrantKey, entries);
    }
    notifyChanged();
}

export function unregisterWidgets(registrantKey: string) {
    if (!widgetEntriesMap.delete(registrantKey)) {
        return;
    }
    notifyChanged();
}

/**
 * Sorted by `id`, never by insertion order.
 *
 * Toggling a widget re-registers it, which in a Map moves it to the end — so an
 * insertion-ordered menu reshuffles itself every time the user picks something
 * from it. Sorting on the actor name + pane key also keeps each actor's panes
 * together and in their `v1`/`v2` layout order.
 */
export function getWidgetEntries() {
    return Array.from(widgetEntriesMap.values())
        .flat()
        .sort((a, b) => {
            return a.id.localeCompare(b.id);
        });
}

export function toggleWidget(id: string) {
    const entry = getWidgetEntries().find((item) => {
        return item.id === id;
    });
    if (entry === undefined) {
        return false;
    }
    entry.toggle();
    return true;
}

/**
 * The reset handlers are per ACTOR, not per pane: restoring one pane's size
 * without its siblings' would leave the group's grows summing to something the
 * defaults never describe.
 */
export function registerWidgetsResetHandler(
    flexSizeName: string,
    handler: () => void,
) {
    resetHandlerMap.set(flexSizeName, handler);
    return () => {
        if (resetHandlerMap.get(flexSizeName) === handler) {
            resetHandlerMap.delete(flexSizeName);
        }
    };
}

export function resetAllWidgets() {
    for (const handler of Array.from(resetHandlerMap.values())) {
        handler();
    }
}

/**
 * Dev-only guard for the "widget names are unique per page" rule the View menu
 * depends on. It warns rather than throws: a duplicate makes one menu entry
 * ambiguous, which is worth shouting about, but not worth blanking the app for
 * while someone is halfway through renaming a label.
 */
export function checkAreNamesUnique(entries: WidgetEntryType[]) {
    const idsByName = new Map<string, string[]>();
    for (const { widgetName, id } of entries) {
        const ids = idsByName.get(widgetName) ?? [];
        ids.push(id);
        idsByName.set(widgetName, ids);
    }
    const duplicates = Array.from(idsByName.entries()).filter(([, ids]) => {
        return ids.length > 1;
    });
    if (duplicates.length === 0) {
        return true;
    }
    if (appProvider.systemUtils.isDev) {
        for (const [widgetName, ids] of duplicates) {
            console.error(
                `Duplicated widget name "${widgetName}" on this page, shared ` +
                    `by: ${ids.join(', ')}. Widget names are the View menu's ` +
                    'labels and must be unique per page.',
            );
        }
    }
    return false;
}
