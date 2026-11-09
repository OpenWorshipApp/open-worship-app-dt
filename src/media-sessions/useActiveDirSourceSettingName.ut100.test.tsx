// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The folder setting of a list's ACTIVE session, for a view that shows the
// list's files without being the list: read at first, again on every
// (re)subscribe, and whenever a strip of that list switches.
const h = vi.hoisted(() => {
    return {
        // The active session's setting name, by the list's base name.
        activeMap: new Map<string, string>(),
        listenerMap: new Map<string, Set<() => void>>(),
        unsubscribedList: [] as string[],
    };
});

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('./folderSessionHelpers', () => ({
    getActiveDirSourceSettingName: (baseSettingName: string) => {
        return h.activeMap.get(baseSettingName) ?? baseSettingName;
    },
}));
vi.mock('./mediaSessionData', () => ({
    subscribeMediaSessionStrips: (
        baseSettingName: string,
        listener: () => void,
    ) => {
        const set = h.listenerMap.get(baseSettingName) ?? new Set();
        set.add(listener);
        h.listenerMap.set(baseSettingName, set);
        return () => {
            h.unsubscribedList.push(baseSettingName);
            set.delete(listener);
        };
    },
}));

import { useActiveDirSourceSettingName } from './useActiveDirSourceSettingName';

function SettingNameComp({ baseSettingName }: { baseSettingName: string }) {
    const settingName = useActiveDirSourceSettingName(baseSettingName);
    return <span>{settingName}</span>;
}

function switchSession(baseSettingName: string, settingName: string) {
    h.activeMap.set(baseSettingName, settingName);
    for (const listener of h.listenerMap.get(baseSettingName) ?? []) {
        listener();
    }
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.activeMap.clear();
    h.listenerMap.clear();
    h.unsubscribedList = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('useActiveDirSourceSettingName', () => {
    test('starts on the active session and follows a switch of that list', async () => {
        h.activeMap.set('dir-docs', 'dir-docs-session-2');
        await act(async () => {
            root.render(<SettingNameComp baseSettingName="dir-docs" />);
        });
        expect(container.textContent).toBe('dir-docs-session-2');

        await act(async () => {
            switchSession('dir-docs', 'dir-docs-session-3');
        });
        expect(container.textContent).toBe('dir-docs-session-3');

        // Another list switching is not this view's business.
        await act(async () => {
            switchSession('dir-videos', 'dir-videos-session-9');
        });
        expect(container.textContent).toBe('dir-docs-session-3');
    });

    test('another list re-subscribes and reads that list’s active session', async () => {
        await act(async () => {
            root.render(<SettingNameComp baseSettingName="dir-docs" />);
        });
        expect(container.textContent).toBe('dir-docs');

        // A switch made while nobody listened to this list is in the setting.
        h.activeMap.set('dir-audios', 'dir-audios-session-1');
        await act(async () => {
            root.render(<SettingNameComp baseSettingName="dir-audios" />);
        });

        expect(container.textContent).toBe('dir-audios-session-1');
        expect(h.unsubscribedList).toEqual(['dir-docs']);
        expect(h.listenerMap.get('dir-docs')?.size).toBe(0);
        expect(h.listenerMap.get('dir-audios')?.size).toBe(1);
    });
});
