import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        allDisplays: null as any,
        showingScreenIds: [] as number[],
        channels: [] as string[],
    };
});

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (key: string) => {
        return state.settings.get(key) ?? null;
    },
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendDataSync: (channel: string) => {
                state.channels.push(channel);
                if (channel === 'main:app:get-displays') {
                    return state.allDisplays;
                }
                if (channel === 'main:app:get-screens') {
                    return state.showingScreenIds;
                }
                throw new Error(`unexpected channel ${channel}`);
            },
        },
    },
}));

import {
    getAllDisplays,
    getAllShowingScreenIds,
    getDefaultScreenDisplay,
    getDisplayByScreenId,
    getDisplayIdByScreenId,
    getPresentingScreenDisplay,
    SCREEN_MANAGER_SETTING_NAME,
} from './screenHelpers';

const PRIMARY = { id: 1, label: 'Laptop', bounds: { width: 1494 } };
const SECOND = { id: 2, label: 'Projector', bounds: { width: 1920 } };
const THIRD = { id: 3, label: 'TV', bounds: { width: 3840 } };
// Between the real monitors and Screen Mirror's guests.
const VIRTUAL = { id: -500001, label: 'Virtual 1', bounds: { width: 1920 } };
const OTHER_VIRTUAL = { id: -500002, label: 'Virtual 2', bounds: {} };
const REMOTE_ID = -1000003;

function setDisplays(displays: any[], primaryDisplay = PRIMARY) {
    state.allDisplays = { primaryDisplay, displays };
}

function setScreenDisplay(screenId: number, displayId: number | string) {
    state.settings.set(
        `${SCREEN_MANAGER_SETTING_NAME}-pid-${screenId}`,
        `${displayId}`,
    );
}

function setScreenIds(screenIds: unknown[]) {
    state.settings.set(
        'screen-managers',
        JSON.stringify(
            screenIds.map((screenId) => {
                return { screenId };
            }),
        ),
    );
}

beforeEach(() => {
    state.settings.clear();
    state.showingScreenIds = [];
    state.channels.length = 0;
    setDisplays([PRIMARY]);
});

describe('the main-process readers', () => {
    test('ask for the displays and the showing screens', () => {
        setDisplays([PRIMARY, SECOND]);
        state.showingScreenIds = [0, 2];

        expect(getAllDisplays()).toBe(state.allDisplays);
        expect(getAllShowingScreenIds()).toEqual([0, 2]);
        expect(state.channels).toEqual([
            'main:app:get-displays',
            'main:app:get-screens',
        ]);
    });
});

describe('getDefaultScreenDisplay', () => {
    test('a second monitor wins', () => {
        setDisplays([PRIMARY, VIRTUAL, SECOND, THIRD]);
        setScreenIds([0]);
        setScreenDisplay(0, VIRTUAL.id);

        expect(getDefaultScreenDisplay()).toBe(SECOND);
    });

    test('with no second monitor, a virtual display a screen is set to', () => {
        setDisplays([PRIMARY, OTHER_VIRTUAL, VIRTUAL]);
        // Screen 0 is on the laptop, screen 1 on a virtual display that is
        // gone, screen 2 on one that is there.
        setScreenIds([0, 1, 2]);
        setScreenDisplay(0, PRIMARY.id);
        setScreenDisplay(1, -500007);
        setScreenDisplay(2, VIRTUAL.id);

        expect(getDefaultScreenDisplay()).toBe(VIRTUAL);
    });

    test('a virtual display nobody is set to is never chosen', () => {
        setDisplays([PRIMARY, VIRTUAL]);
        setScreenIds([0]);

        expect(getDefaultScreenDisplay()).toBe(PRIMARY);
    });

    test('an unreadable screen list falls back to this monitor', () => {
        setDisplays([PRIMARY, VIRTUAL]);
        setScreenDisplay(0, VIRTUAL.id);

        state.settings.set('screen-managers', '{broken');
        expect(getDefaultScreenDisplay()).toBe(PRIMARY);

        state.settings.set('screen-managers', '{"screenId":0}');
        expect(getDefaultScreenDisplay()).toBe(PRIMARY);

        // Entries that carry no integer id are not screens.
        setScreenIds(['0', 0.5, null]);
        expect(getDefaultScreenDisplay()).toBe(PRIMARY);

        setScreenIds([0]);
        expect(getDefaultScreenDisplay()).toBe(VIRTUAL);
    });
});

describe('getDisplayIdByScreenId', () => {
    test('a screen with no choice goes to the placement display', () => {
        setDisplays([PRIMARY, SECOND]);
        expect(getDisplayIdByScreenId(0)).toBe(SECOND.id);

        setDisplays([PRIMARY]);
        expect(getDisplayIdByScreenId(0)).toBe(PRIMARY.id);
    });

    test('an unreadable choice goes to the placement display', () => {
        setDisplays([PRIMARY, SECOND]);
        setScreenDisplay(0, 'abc');
        expect(getDisplayIdByScreenId(0)).toBe(SECOND.id);
    });

    test('a display that is there is kept, one that is gone is replaced', () => {
        setDisplays([PRIMARY, SECOND, THIRD]);
        setScreenDisplay(0, THIRD.id);
        setScreenDisplay(1, 99);

        expect(getDisplayIdByScreenId(0)).toBe(THIRD.id);
        expect(getDisplayIdByScreenId(1)).toBe(SECOND.id);
    });

    test('a remote Screen Mirror display is kept while unplugged', () => {
        setDisplays([PRIMARY, SECOND]);
        setScreenDisplay(0, REMOTE_ID);

        expect(getDisplayIdByScreenId(0)).toBe(REMOTE_ID);
    });
});

describe('getDisplayByScreenId', () => {
    test('the display the screen is set to, else the placement display', () => {
        setDisplays([PRIMARY, SECOND, THIRD]);
        setScreenDisplay(0, THIRD.id);
        // Kept while unplugged, but there is no such display to hand back.
        setScreenDisplay(1, REMOTE_ID);

        expect(getDisplayByScreenId(0)).toBe(THIRD);
        expect(getDisplayByScreenId(1)).toBe(SECOND);
        expect(getDisplayByScreenId(2)).toBe(SECOND);
    });
});

describe('getPresentingScreenDisplay', () => {
    test('with nothing up, the default display', () => {
        setDisplays([PRIMARY, SECOND]);
        setScreenDisplay(0, PRIMARY.id);

        expect(getPresentingScreenDisplay()).toBe(SECOND);
    });

    test('the display the first screen up is actually on', () => {
        setDisplays([PRIMARY, SECOND]);
        // Screen 1 moved onto the laptop: slides are sized for THAT display.
        setScreenDisplay(1, PRIMARY.id);
        setScreenDisplay(2, SECOND.id);
        state.showingScreenIds = [1, 2];

        expect(getPresentingScreenDisplay()).toBe(PRIMARY);
    });
});
