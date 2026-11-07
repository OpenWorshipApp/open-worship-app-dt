// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const store = vi.hoisted(() => {
    return {
        values: new Map<string, string>(),
        removed: [] as string[],
    };
});

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return store.values.get(key) ?? null;
    },
    setSetting: (key: string, value: string) => {
        store.values.set(key, value);
    },
    removeSetting: (key: string) => {
        store.removed.push(key);
        store.values.delete(key);
    },
}));
// `transitionEffectHelpers` -> `appHooks` reads `systemUtils.isDev` at load.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import EventHandler from '../../event/EventHandler';
import ScreenEffectManager, {
    SCREEN_EFFECT_CHANGED_EVENT,
} from './ScreenEffectManager';
import { transitionEffect } from '../transitionEffectHelpers';

const createdList: ScreenEffectManager[] = [];
let changedCount = 0;
let registeredChanged: any;

function genScreenManagerBase(screenId: number) {
    return {
        screenId,
        sendScreenMessage: vi.fn(),
        createScreenManagerBaseGhost: vi.fn((ghostScreenId: number) => {
            return { screenId: ghostScreenId, isGhost: true };
        }),
    } as any;
}

function genManager(screenId: number, target: string) {
    const screenManagerBase = genScreenManagerBase(screenId);
    const manager = new ScreenEffectManager(screenManagerBase, target);
    createdList.push(manager);
    return { manager, screenManagerBase };
}

// Listeners run on microtasks (`BasicEventHandler.checkOnEvent`).
async function flushEvents() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

beforeEach(() => {
    store.values.clear();
    store.removed.length = 0;
    changedCount = 0;
    registeredChanged = EventHandler.registerEventListener(
        [SCREEN_EFFECT_CHANGED_EVENT],
        () => {
            changedCount += 1;
        },
    );
});

afterEach(() => {
    EventHandler.unregisterEventListener(registeredChanged);
    for (const manager of createdList.splice(0)) {
        try {
            ScreenEffectManager.getInstance(manager.screenId, manager.target);
            manager.delete();
        } catch {
            // Already deleted by the test.
        }
    }
});

describe('ScreenEffectManager', () => {
    test('restores the stored transition, else fades', async () => {
        store.values.set('pt-effect-1-slide', 'zoom');
        store.values.set('pt-effect-2-slide', 'spin');
        const { manager: stored } = genManager(1, 'slide');
        const { manager: invalid } = genManager(2, 'slide');
        const { manager: unset } = genManager(3, 'slide');

        expect(stored.effectType).toBe('zoom');
        expect(invalid.effectType).toBe('fade');
        expect(unset.effectType).toBe('fade');
        expect(stored.settingName).toBe('pt-effect-1-slide');
        // Asked before any screen existed: every new one says so.
        await flushEvents();
        expect(changedCount).toBe(3);
    });

    test('carries one animation per transition, aimed at its own layer', () => {
        const { manager } = genManager(4, 'background');

        expect(Object.keys(manager.styleAnimList).sort()).toEqual(
            Object.keys(transitionEffect).sort(),
        );
        expect(manager.styleAnim).toBe(manager.styleAnimList.fade);
        expect(manager.duration).toBe(manager.styleAnimList.fade.duration);
        expect(typeof manager.styleAnim.animIn).toBe('function');
        expect(typeof manager.styleAnim.animOut).toBe('function');
    });

    test('choosing a transition saves it, syncs the screen and says so', async () => {
        const { manager, screenManagerBase } = genManager(5, 'foreground');
        const updates: number[] = [];
        manager.registerEventListener(['update'], () => {
            updates.push(updates.length);
        });
        await flushEvents();
        changedCount = 0;

        manager.effectType = 'move';

        expect(manager.effectType).toBe('move');
        expect(manager.styleAnim).toBe(manager.styleAnimList.move);
        expect(store.values.get('pt-effect-5-foreground')).toBe('move');
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 5,
                type: 'effect',
                data: { target: 'foreground', effect: 'move' },
            },
            false,
        );
        await flushEvents();
        expect(updates).toHaveLength(1);
        expect(changedCount).toBe(1);
    });

    test('a sync message sets the transition on the screen it names', () => {
        const { manager: target, screenManagerBase } = genManager(6, 'slide');
        const { manager: other } = genManager(7, 'slide');

        ScreenEffectManager.receiveSyncScreen({
            screenId: 6,
            type: 'effect',
            data: { target: 'slide', effect: 'none' },
        } as any);

        expect(target.effectType).toBe('none');
        expect(other.effectType).toBe('fade');
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledTimes(1);
    });

    test('an unknown screen or layer is an error', () => {
        genManager(8, 'slide');
        expect(() => {
            ScreenEffectManager.getInstance(8, 'background');
        }).toThrow('instance is not found.');
        expect(() => {
            ScreenEffectManager.getInstance(99, 'slide');
        }).toThrow('instance is not found.');
    });

    test('the common transition is null unless every screen agrees', () => {
        expect(ScreenEffectManager.getCommonEffectType('slide')).toBeNull();

        const { manager: first } = genManager(9, 'slide');
        const { manager: second } = genManager(10, 'slide');
        // Another layer never counts.
        const { manager: background } = genManager(11, 'background');
        background.effectType = 'zoom';
        expect(ScreenEffectManager.getCommonEffectType('slide')).toBe('fade');

        second.effectType = 'move';
        expect(ScreenEffectManager.getCommonEffectType('slide')).toBeNull();

        first.effectType = 'move';
        expect(ScreenEffectManager.getCommonEffectType('slide')).toBe('move');
        expect(ScreenEffectManager.getCommonEffectType('background')).toBe(
            'zoom',
        );
    });

    test('deleting takes the transition with the screen', async () => {
        store.values.set('pt-effect-12-slide', 'zoom');
        const { manager, screenManagerBase } = genManager(12, 'slide');
        await flushEvents();
        changedCount = 0;

        manager.delete();

        // Screen ids are reused: the next screen 12 must not inherit it.
        expect(store.removed).toEqual(['pt-effect-12-slide']);
        expect(store.values.has('pt-effect-12-slide')).toBe(false);
        expect(() => {
            ScreenEffectManager.getInstance(12, 'slide');
        }).toThrow('instance is not found.');
        expect(
            screenManagerBase.createScreenManagerBaseGhost,
        ).toHaveBeenCalledWith(12);
        expect((manager.screenManagerBase as any).isGhost).toBe(true);
        expect(ScreenEffectManager.getCommonEffectType('slide')).toBeNull();
        await flushEvents();
        expect(changedCount).toBe(1);
    });
});
