// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ isDev: true }));

vi.mock('../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isDev: mocks.isDev };
        },
    },
}));

import {
    checkAreNamesUnique,
    getWidgetEntries,
    registerWidgets,
    registerWidgetsResetHandler,
    resetAllWidgets,
    subscribeWidgetsChanged,
    toggleWidget,
    toWidgetId,
    type WidgetEntryType,
} from './widgetRegistry';

function genEntry(
    id: string,
    widgetName: string,
    overrides: Partial<WidgetEntryType> = {},
): WidgetEntryType {
    return {
        id,
        widgetName,
        isHidden: false,
        toggle: vi.fn(),
        ...overrides,
    };
}

// The registry is module state shared by the whole suite, so every key a test
// registers has to be handed back before the next one runs.
const registeredKeys = new Set<string>();
function register(key: string, entries: WidgetEntryType[]) {
    registeredKeys.add(key);
    registerWidgets(key, entries);
}

describe('resize-actor widgetRegistry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.isDev = true;
    });

    afterEach(() => {
        for (const key of registeredKeys) {
            registerWidgets(key, []);
        }
        registeredKeys.clear();
        vi.runAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test('toWidgetId identifies a pane by its actor and key, not its label', () => {
        expect(toWidgetId('app-presenter-left', 'v1')).toBe(
            'app-presenter-left::v1',
        );
    });

    test('entries are ordered by id, so the menu never reshuffles', () => {
        register('b', [genEntry('b::v1', 'Three')]);
        register('a', [genEntry('a::v1', 'One'), genEntry('a::v2', 'Two')]);

        const readNames = () => {
            return getWidgetEntries().map((entry) => {
                return entry.widgetName;
            });
        };
        expect(readNames()).toEqual(['One', 'Two', 'Three']);

        // Toggling re-registers the entry, which in a Map moves it to the end.
        // The user would otherwise watch the menu rearrange under them.
        register('a', [genEntry('a::v1', 'One', { isHidden: true })]);
        register('a', [
            genEntry('a::v1', 'One', { isHidden: true }),
            genEntry('a::v2', 'Two'),
        ]);
        expect(readNames()).toEqual(['One', 'Two', 'Three']);
    });

    test('registering an empty list withdraws the actor', () => {
        register('a', [genEntry('a::v1', 'One')]);
        register('a', []);

        expect(getWidgetEntries()).toEqual([]);
    });

    test('toggleWidget routes to the matching entry only', () => {
        const first = genEntry('a::v1', 'One');
        const second = genEntry('a::v2', 'Two');
        register('a', [first, second]);

        expect(toggleWidget('a::v2')).toBe(true);
        expect(second.toggle).toHaveBeenCalledTimes(1);
        expect(first.toggle).not.toHaveBeenCalled();

        // A menu built before an actor unmounted can still deliver a click for
        // a pane that is gone; that must be a no-op, not a throw.
        expect(toggleWidget('gone::v1')).toBe(false);
    });

    test('change notifications are debounced into one rebuild', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeWidgetsChanged(listener);

        // Mounting a page registers a dozen actors within a few frames, and
        // every rebuild is an IPC round trip plus a full native menu rebuild.
        register('a', [genEntry('a::v1', 'One')]);
        register('b', [genEntry('b::v1', 'Two')]);
        register('c', [genEntry('c::v1', 'Three')]);
        expect(listener).not.toHaveBeenCalled();

        vi.runAllTimers();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        register('d', [genEntry('d::v1', 'Four')]);
        vi.runAllTimers();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('reset fans out to every registered actor and stops after unregister', () => {
        const first = vi.fn();
        const second = vi.fn();
        const unregisterFirst = registerWidgetsResetHandler(':r1', first);
        registerWidgetsResetHandler(':r2', second);

        resetAllWidgets();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);

        unregisterFirst();
        resetAllWidgets();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
    });

    test('a re-registered handler is not removed by the previous cleanup', () => {
        // Two actors legitimately share an id only across a remount, where the
        // new registration lands before the old cleanup runs.
        const stale = vi.fn();
        const fresh = vi.fn();
        const unregisterStale = registerWidgetsResetHandler(':r1', stale);
        registerWidgetsResetHandler(':r1', fresh);
        unregisterStale();

        resetAllWidgets();
        expect(fresh).toHaveBeenCalledTimes(1);
        expect(stale).not.toHaveBeenCalled();

        registerWidgetsResetHandler(':r1', () => {});
    });

    test('checkAreNamesUnique reports duplicated labels in dev', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        expect(
            checkAreNamesUnique([
                genEntry('a::v1', 'Background'),
                genEntry('b::h1', 'Background'),
                genEntry('c::v1', 'Mini Screen'),
            ]),
        ).toBe(false);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0]).toContain('Background');
        expect(errorSpy.mock.calls[0][0]).toContain('a::v1, b::h1');

        errorSpy.mockClear();
        expect(
            checkAreNamesUnique([
                genEntry('a::v1', 'Background'),
                genEntry('c::v1', 'Mini Screen'),
            ]),
        ).toBe(true);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('checkAreNamesUnique stays quiet in production', () => {
        mocks.isDev = false;
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        expect(
            checkAreNamesUnique([
                genEntry('a::v1', 'Background'),
                genEntry('b::h1', 'Background'),
            ]),
        ).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
