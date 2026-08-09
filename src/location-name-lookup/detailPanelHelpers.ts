import { useSyncExternalStore } from 'react';

export type DetailPanelKindType = 'name' | 'location' | 'verse';

export type DetailPanelType = {
    // `kind:target`, so opening the same record twice raises the existing panel
    // instead of stacking a duplicate on top of it.
    key: string;
    kind: DetailPanelKindType;
    // A record id for name/location, a short verse (e.g. `EXO 6:23`) for verse.
    target: string;
    // What to show in the title bar until the record resolves.
    name: string;
};

// Panels are deliberately window-scoped rather than owned by the lookup panel:
// closing the lookup must not yank away the detail the user opened from it, and
// a reference followed from one detail panel opens a sibling, not a child.
let openPanels: DetailPanelType[] = [];
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

export function openDetailPanel(panel: Omit<DetailPanelType, 'key'>) {
    const key = `${panel.kind}:${panel.target}`;
    if (openPanels.some((item) => item.key === key)) {
        return;
    }
    openPanels = [...openPanels, { ...panel, key }];
    notify();
}

export function closeDetailPanel(key: string) {
    const nextPanels = openPanels.filter((item) => item.key !== key);
    if (nextPanels.length === openPanels.length) {
        return;
    }
    openPanels = nextPanels;
    notify();
}

export function closeAllDetailPanels() {
    if (openPanels.length === 0) {
        return;
    }
    openPanels = [];
    notify();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot() {
    return openPanels;
}

export function useOpenDetailPanels() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
