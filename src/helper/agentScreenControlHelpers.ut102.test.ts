// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The screens' worker behind `owa_screen_edit` (EC-611, EC-630): every field
// of a `set` read and checked before anything changes, each change made
// through the setter its Mini Screen card presses, and backed up.
const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
        textStyle: {} as Record<string, unknown>,
        applied: [] as Record<string, unknown>[],
        displays: [] as any[],
        displayError: null as unknown,
        bibles: [] as { key: string; title: string; locale?: unknown }[],
        bibleError: null as unknown,
        viewDataError: null as unknown,
        summaries: [] as string[],
        appended: [] as [string, unknown[]][],
        appendError: null as unknown,
        isBackupRefused: false,
        isAddIgnored: false,
        calls: [] as string[],
        errors: [] as unknown[],
        foregroundReads: [] as string[],
        // What the screens' content reader says beyond a passage, by screen.
        contentById: {} as Record<number, Record<string, unknown>>,
        contentMissingIds: [] as number[],
        // What a screen the Mini Screen menu adds starts with.
        newScreenState: {} as Record<string, unknown>,
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
    },
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        get textStyle() {
            return h.textStyle;
        },
        applyTextStyle: (patch: Record<string, unknown>) => {
            h.applied.push(patch);
            h.textStyle = { ...h.textStyle, ...patch };
        },
    },
}));
vi.mock('../_screen/managers/screenHelpers', () => ({
    getAllDisplays: () => {
        if (h.displayError !== null) {
            throw h.displayError;
        }
        return { primaryDisplay: h.displays[0], displays: h.displays };
    },
}));
vi.mock('../_screen/screenBibleHelpers', () => ({
    bibleItemJsonToScreenViewData: async (
        bibleItem: unknown,
        keys: string[],
    ) => {
        if (h.viewDataError !== null) {
            throw h.viewDataError;
        }
        return {
            bibleItemData: {
                bibleItem,
                renderedList: keys.map((bibleKey) => ({ bibleKey })),
            },
        };
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => {
    function findFreeScreenId() {
        let screenId = 0;
        while (
            h.managers.some((screenManager) => {
                return screenManager.screenId === screenId;
            })
        ) {
            screenId++;
        }
        return screenId;
    }
    return {
        findFreeScreenId,
        genNewScreenManagerBase: () => {
            const screenId = findFreeScreenId();
            h.calls.push(`add screen ${screenId}`);
            if (!h.isAddIgnored) {
                h.managers.push(genManager(screenId, h.newScreenState));
            }
            return screenId;
        },
    };
});
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: async () => {
        if (h.bibleError !== null) {
            throw h.bibleError;
        }
        return h.bibles;
    },
}));
vi.mock('./agentScreenHelpers', () => ({
    describeScreensForAgent: () => ({
        screens: h.managers
            .filter((screenManager) => {
                return !h.contentMissingIds.includes(screenManager.screenId);
            })
            .map((screenManager) => ({
                screenId: screenManager.screenId,
                bible: screenManager.screenLongTextManager.screenViewData
                    ? { reference: 'John 3:16' }
                    : null,
                slide: null,
                background: null,
                foreground: [],
                ...h.contentById[screenManager.screenId],
            })),
    }),
}));
vi.mock('./agentScreenControlRestoreHelpers', () => ({
    listLiveScreenManagers: () => h.managers,
    toEffectManager: (screenManager: any, target: string) => {
        return screenManager.effects[target] ?? null;
    },
    captureScreenControls: () => ['controls'],
    captureScreenLayers: () => ['layers'],
}));
vi.mock('./agentScreenRestoreHelpers', () => ({
    captureForegroundLists: (key: string) => {
        h.foregroundReads.push(key);
        return [`lists of ${key}`];
    },
    captureTextLayers: () => ['texts'],
}));
// What the change did, as restores the test can recognise.
vi.mock('./agentBackupPlanHelpers', () => ({
    diffScreenSettings: () => [{ kind: 'screen-setting' }],
    diffTextLayers: () => [],
    diffScreenLayers: () => [{ kind: 'screen-layer' }],
    diffForegroundSlots: (key: string, before: unknown[], after: unknown[]) => {
        return [{ kind: 'screen-foreground', key, before, after }];
    },
    genAddedScreenRestores: (beforeIds: number[], afterIds: number[]) => {
        return afterIds
            .filter((screenId) => {
                return !beforeIds.includes(screenId);
            })
            .map((screenId) => {
                return { type: 'screen-presence', screenId, present: false };
            });
    },
}));
vi.mock('./agentBackupHelpers', () => {
    class NoBackupError extends Error {}
    return {
        NoBackupError,
        runWithAgentBackup: async (
            summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => {
            if (h.isBackupRefused) {
                throw new NoBackupError(
                    'Nothing was changed: no backup could be saved.',
                );
            }
            h.summaries.push(summary);
            const value = await change();
            return { meta: { id: 'undo-1' }, value };
        },
        appendAgentBackupRestores: async (id: string, restores: unknown[]) => {
            if (h.appendError !== null) {
                throw h.appendError;
            }
            h.appended.push([id, restores]);
        },
        genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    };
});
vi.mock('./cssColorResolveHelpers', () => ({
    resolveCssColor: () => null,
}));
vi.mock('./errorHelpers', () => ({
    handleError: (error: unknown) => {
        h.errors.push(error);
    },
}));

const { handleAgentScreenEditRequest } =
    await import('./agentScreenControlHelpers');

function genManager(screenId: number, state: Record<string, unknown> = {}) {
    let stage = 0;
    let displayId = 1;
    const screenManager: any = {
        screenId,
        isSelected: false,
        isShowing: false,
        isLocked: false,
        colorNote: null,
        isDisplayUnknown: false,
        get stage() {
            return stage;
        },
        set stage(value: number) {
            h.calls.push(`stage ${screenId} ${value}`);
            stage = value;
        },
        get displayId() {
            if (screenManager.isDisplayUnknown) {
                throw new Error('no display list in this window');
            }
            return displayId;
        },
        set displayId(value: number) {
            h.calls.push(`display ${screenId} ${value}`);
            displayId = value;
        },
        isShowingForeground: false,
        screenForegroundManager: { foregroundData: {} },
        screenLongTextManager: {
            screenViewData: null,
            isLineSync: false,
            isShowing: false,
            clear: () => {
                h.calls.push(`clear bible ${screenId}`);
            },
        },
        screenVaryAppDocumentManager: {
            varySlideData: null,
            clear: () => {
                h.calls.push(`clear slide ${screenId}`);
            },
        },
        screenBackgroundManager: {
            backgroundSrc: null,
            clear: () => {
                h.calls.push(`clear background ${screenId}`);
            },
        },
        clearForeground: () => {
            h.calls.push(`clear foreground ${screenId}`);
        },
        setColorNote: async (color: string | null) => {
            h.calls.push(`color ${screenId} ${color}`);
            screenManager.colorNote = color;
        },
        setIsLockedWithSyncGroup: async (isLocked: boolean) => {
            h.calls.push(`lock ${screenId} ${isLocked}`);
            screenManager.isLocked = isLocked;
        },
        ...state,
    };
    screenManager.effects = {
        'vary-app-document': { effectType: 'fade' },
        background: { effectType: 'fade' },
        foreground: { effectType: 'fade' },
    };
    screenManager.varyAppDocumentEffectManager =
        screenManager.effects['vary-app-document'];
    return screenManager;
}

function genPassage(keys: string[], renderedKeys: string[] = keys) {
    return {
        bibleItemData: {
            bibleItem: { bibleKey: keys[0], target: { bookKey: 'JHN' } },
            renderedList: renderedKeys.map((bibleKey) => ({ bibleKey })),
        },
    };
}

function readKeys(screenManager: any) {
    return screenManager.screenLongTextManager.screenViewData.bibleItemData.renderedList.map(
        (item: { bibleKey: string }) => {
            return item.bibleKey;
        },
    );
}

async function edit(request: any): Promise<any> {
    const promise = handleAgentScreenEditRequest(request);
    // The change waits for what its setters started to land.
    await vi.runAllTimersAsync();
    return promise;
}

async function set(request: Record<string, unknown>) {
    return edit({ action: 'set', ...request });
}

async function refuse(request: Record<string, unknown>) {
    const result = await set(request);
    expect(result.isError, JSON.stringify(result)).toBe(true);
    expect(h.summaries).toEqual([]);
    return result.reason as string;
}

beforeEach(() => {
    vi.useFakeTimers();
    h.isPagePresenter = true;
    h.textStyle = {};
    h.applied = [];
    h.summaries = [];
    h.appended = [];
    h.appendError = null;
    h.calls = [];
    h.errors = [];
    h.foregroundReads = [];
    h.contentById = {};
    h.contentMissingIds = [];
    h.newScreenState = {};
    h.isBackupRefused = false;
    h.isAddIgnored = false;
    h.displayError = null;
    h.bibleError = null;
    h.viewDataError = null;
    h.displays = [
        {
            id: 1,
            label: 'Built-in Retina Display',
            bounds: { width: 1512, height: 982 },
        },
        { id: -900001, label: '', bounds: { width: 1920, height: 1080 } },
    ];
    h.bibles = [
        { key: 'KJV', title: 'King James Version', locale: 'en' },
        { key: 'ASV', title: 'American Standard Version', locale: 'en-US' },
    ];
    h.managers = [
        genManager(0, { isSelected: true, isShowing: true }),
        genManager(1),
    ];
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('read: the displays', () => {
    it('names a display with no label as the card does', async () => {
        h.displays = [
            { id: 4, label: '', bounds: { width: 1280, height: 720 } },
            {
                id: 5,
                label: '  ',
                guestId: 'guest-1',
                bounds: { width: 800, height: 600 },
            },
            { id: 6, bounds: { width: 640, height: 480 } },
            {
                id: 7,
                label: 7,
                isPrimary: true,
                bounds: { width: 640, height: 480 },
            },
        ];
        const result = await edit({ action: 'read' });
        expect(result.displays).toEqual([
            { id: 4, name: 'Primary display', size: '1280x720', primary: true },
            { id: 5, name: 'Guest display', size: '800x600' },
            { id: 6, name: 'Display 6', size: '640x480' },
            // The display list's own flag is primary too.
            { id: 7, name: 'Primary display', size: '640x480', primary: true },
        ]);
    });

    it('says a screen on a display not connected, and one it cannot know', async () => {
        h.managers[0].displayId = 9;
        h.managers[1].isDisplayUnknown = true;
        const result = await edit({ action: 'read' });
        expect(result.screens[0].display).toBe('display 9, not connected');
        expect(result.screens[1].display).toBeNull();
    });

    it('reads the screens still when the display list cannot be read', async () => {
        h.displayError = new Error('screen module not ready');
        const result = await edit({ action: 'read' });
        expect(result.displays).toEqual([]);
        expect(h.errors).toEqual([h.displayError]);
        expect(result.screens.map((screen: any) => screen.id)).toEqual([0, 1]);
        expect(result.screens[0].display).toBe('display 1, not connected');
    });
});

describe('read: the Bibles', () => {
    it("names each Bible's language, or its code when no name is known", async () => {
        h.bibles = [
            { key: 'KJV', title: 'King James Version', locale: 'en_GB' },
            { key: 'AAA', title: 'No Locale' },
            { key: 'BBB', title: 'Odd Locale', locale: '1' },
            { key: 'CCC', title: 'Made Up', locale: 'xx' },
        ];
        const result = await edit({ action: 'read' });
        expect(result.bibles).toEqual([
            'KJV: King James Version (English)',
            'AAA: No Locale (?)',
            'BBB: Odd Locale (1)',
            'CCC: Made Up (xx)',
        ]);
    });

    it('says the code alone in a runtime with no language names', async () => {
        vi.spyOn(Intl, 'DisplayNames').mockImplementation(() => {
            throw new RangeError('no language names here');
        });
        const result = await edit({ action: 'read' });
        expect(result.bibles).toEqual([
            'KJV: King James Version (en)',
            'ASV: American Standard Version (en)',
        ]);
    });

    it('reads no installed Bibles as none', async () => {
        h.bibles = null as any;
        const result = await edit({ action: 'read' });
        expect(result.bibles).toEqual([]);
    });
});

describe('read: what a screen shows', () => {
    it('reads no passage off a long text, nor off a layer with no Bible in it', async () => {
        h.managers[0].screenLongTextManager.screenViewData = {
            type: 'long-text',
        };
        h.managers[1].screenLongTextManager.screenViewData = {};
        const result = await edit({ action: 'read' });
        expect(result.screens[0].bible).toBeNull();
        expect(result.screens[1].bible).toBeNull();
    });

    it('says the slide, the background and the foreground each screen holds', async () => {
        h.contentById[0] = {
            slide: { kind: 'song', document: 'Amazing Grace', name: 'Verse 1' },
            background: { kind: 'image', name: 'sky.jpg' },
            foreground: ['Countdown'],
        };
        h.contentById[1] = {
            slide: { kind: 'slide', document: 'Notices', name: '' },
            background: { kind: 'fill', name: '' },
        };
        const result = await edit({ action: 'read' });
        expect(result.screens[0]).toMatchObject({
            slide: 'song "Amazing Grace", Verse 1',
            background: 'image sky.jpg',
            foreground: ['Countdown'],
        });
        expect(result.screens[1]).toMatchObject({
            slide: 'slide "Notices"',
            background: 'fill',
        });
        expect(result.screens[1]).not.toHaveProperty('foreground');
    });

    it('still reads the versions of a screen the content reader says nothing of', async () => {
        h.contentMissingIds = [0];
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        h.managers[0].screenLongTextManager.screenViewData.bibleItemData.renderedList =
            undefined;
        const result = await edit({ action: 'read' });
        expect(result.screens[0].bible).toEqual({
            reference: '',
            versions: ['KJV'],
        });
        expect(result.screens[0]).not.toHaveProperty('slide');
    });

    it("reads a passage drawn in no listed version as its own version's", async () => {
        h.managers[0].screenLongTextManager.screenViewData = genPassage(
            ['KJV'],
            [],
        );
        const result = await edit({ action: 'read' });
        expect(result.screens[0].bible).toEqual({
            reference: 'John 3:16',
            versions: ['KJV'],
        });
    });
});

describe('set: the screens it works on', () => {
    it('asks for a screen first when there is none', async () => {
        h.managers = [];
        expect(await refuse({ lineSync: true })).toBe(
            'There is no screen. Add one first with `newScreen: true` alone ' +
                "in a call, as the Mini Screen panel's ⋮ menu does (Add New " +
                'Screen), then change it by its number.',
        );
    });

    it('refuses screens that are not a list of numbers, naming those there are', async () => {
        h.managers[1].isLocked = true;
        for (const screens of [0, [], [0.5], ['0']]) {
            expect(await refuse({ screens, lineSync: true })).toBe(
                '`screens` is a list of screen numbers, or left out for ' +
                    'the ticked ones. The screens: 0 (ticked, on), 1 (not ' +
                    'ticked, OFF, locked).',
            );
        }
    });

    it('works on every screen when none is ticked', async () => {
        h.managers[0].isSelected = false;
        const result = await set({ transition: { background: 'zoom' } });
        expect(result.did).toBe(
            'the background transition of screens 0 and 1 zoom',
        );
        expect(
            h.managers.map((one) => one.effects.background.effectType),
        ).toEqual(['zoom', 'zoom']);
    });

    it('takes a screen named twice once', async () => {
        const result = await set({ screens: [1, 1], lineSync: true });
        expect(result.did).toBe(
            'Line Sync turned on for screen 1 (the versions lined up verse ' +
                'by verse)',
        );
    });

    it('refuses a set with nothing in it', async () => {
        expect(await refuse({ screens: [0] })).toBe(
            '`set` changed nothing: give at least one of style, versions, ' +
                'lineSync, transition, display, group, lock, select, ' +
                'stage, show, clear, newScreen.',
        );
    });
});

describe('set: the tick', () => {
    it('refuses a word that is not one of its four', async () => {
        expect(await refuse({ screens: [1], select: 'solo' })).toBe(
            '`select` is "only" (those screens alone, the card\'s Solo), ' +
                '"add", "remove" or "all".',
        );
    });

    it('needs the screens for all but "all"', async () => {
        expect(await refuse({ select: 'add' })).toBe(
            '`select: "add"` needs `screens`.',
        );
    });

    it('ticks every screen with "all", and says when they are already', async () => {
        const result = await set({ select: 'all' });
        expect(result.did).toBe(
            'screens 0 and 1 ticked (what is put up goes there)',
        );
        expect(h.managers.map((one) => one.isSelected)).toEqual([true, true]);
        const again = await set({ select: 'all' });
        expect(again.did).toBe('nothing: it is already so');
        expect(again.already).toEqual(['screens 0 and 1 already ticked']);
    });

    it('adds a screen to those ticked', async () => {
        await set({ screens: [1], select: 'add' });
        expect(h.managers.map((one) => one.isSelected)).toEqual([true, true]);
    });
});

describe('set: a group', () => {
    it('takes a screen out of its group', async () => {
        h.managers[0].colorNote = '#FFFF00';
        h.managers[1].colorNote = '#FFFF00';
        const result = await set({ screens: [0], group: false });
        expect(h.calls).toEqual(['color 0 null']);
        expect(result.did).toBe('screen 0 out of its group');
        expect(h.managers[1].colorNote).toBe('#FFFF00');
    });

    it('says a screen in no group is in none', async () => {
        const result = await set({ group: false });
        expect(result.already).toEqual(['screen 0 in no group']);
        expect(h.calls).toEqual([]);
    });

    it('refuses what is not a group', async () => {
        expect(await refuse({ screens: [0, 1], group: 3 })).toContain(
            '`group` is true (the screens named, together), a colour ' +
                '(yellow, lime, aqua,',
        );
        expect(await refuse({ screens: [0, 1], group: 'sparkly' })).toContain(
            '"sparkly" is not a group colour.',
        );
    });

    it('says screens are in the group already', async () => {
        h.managers[0].colorNote = '#FFFF00';
        h.managers[1].colorNote = '#FFFF00';
        for (const group of ['yellow', true]) {
            const result = await set({ screens: [0, 1], group });
            expect(result.already).toEqual([
                'screens 0 and 1 already in the yellow group',
            ]);
        }
        expect(h.calls).toEqual([]);
    });

    it("joins a group by its colour, the joiner taking the group's content", async () => {
        h.managers[1].colorNote = '#FFFF00';
        const result = await set({ screens: [0], group: 'yellow' });
        expect(h.calls).toEqual(['color 0 #FFFF00']);
        expect(result.did).toBe('screen 0 in the yellow group with screen 1');
        expect(result.note).toBe(
            'screen 0 now shows what screen 1 shows: grouped screens show ' +
                'the same thing, and what is put on one goes on all of them.',
        );
    });

    it('refuses a locked screen the group would change, unless unlocked first', async () => {
        h.managers[1].colorNote = '#FFFF00';
        h.managers[0].isLocked = true;
        expect(await refuse({ screens: [0], group: 'yellow' })).toBe(
            'screen 0 is locked, so it refuses a change to what it shows. ' +
                'Ask whether to unlock (lock: false in the same call); the ' +
                'lock is on its Mini Screen card. Nothing was changed.',
        );
        await set({ screens: [0], group: 'yellow', lock: false });
        expect(h.calls).toEqual(['lock 0 false', 'color 0 #FFFF00']);
    });

    it('says two locked screens in the plural', async () => {
        h.managers.push(genManager(2, { colorNote: '#FFFF00' }));
        h.managers[0].isLocked = true;
        h.managers[1].isLocked = true;
        expect(await refuse({ screens: [0, 1], group: 'yellow' })).toContain(
            'screens 0 and 1 are locked, so they refuse a change to what ' +
                'they show.',
        );
    });
});

describe('set: the lock', () => {
    it('is true or false', async () => {
        expect(await refuse({ lock: 'yes' })).toBe('`lock` is true or false.');
    });

    it('says a screen is locked already', async () => {
        h.managers[0].isLocked = true;
        const result = await set({ lock: true });
        expect(result.already).toEqual(['screen 0 already locked']);
    });

    it('says a screen is unlocked already', async () => {
        const result = await set({ screens: [0, 1], lock: false });
        expect(result.already).toEqual(['screens 0 and 1 already unlocked']);
        expect(h.calls).toEqual([]);
    });

    it('locks last, once the rest of the call has changed the screen', async () => {
        h.managers[0].screenBackgroundManager.backgroundSrc = { src: 'a.jpg' };
        const result = await set({
            screens: [0],
            lock: true,
            clear: 'background',
        });
        expect(h.calls).toEqual(['clear background 0', 'lock 0 true']);
        expect(result.did).toBe(
            'the background off screen 0; screen 0 locked (with any screen ' +
                'grouped with it)',
        );
    });
});

describe('set: the stage', () => {
    it('is a whole number from 0 to 99', async () => {
        for (const stage of [-1, 1.5, 100, '2']) {
            expect(await refuse({ stage })).toBe(
                '`stage` is a whole number from 0 to 99.',
            );
        }
    });

    it('says a screen is on the stage already', async () => {
        const result = await set({ stage: 0 });
        expect(result.already).toEqual(['screen 0 already on stage 0']);
    });

    it('moves the screen, saying the slide transition goes to none', async () => {
        const result = await set({ screens: [0, 1], stage: 2 });
        expect(h.calls).toEqual(['stage 0 2', 'stage 1 2']);
        expect(result.did).toBe('screens 0 and 1 on stage 2');
        expect(result.note).toBe(
            'A stage above 0 cuts between slides, so the slide transition ' +
                'was set to none, as the card does.',
        );
    });

    it('says nothing of the transition when it is none already', async () => {
        h.managers[0].varyAppDocumentEffectManager.effectType = 'none';
        const result = await set({ stage: 3 });
        expect(result.did).toBe('screen 0 on stage 3');
        expect(result.note).toBeUndefined();
    });
});

describe('set: the display', () => {
    it('moves a screen onto a virtual display, naming who is on it too', async () => {
        h.managers[1].displayId = -900001;
        h.calls = [];
        const result = await set({ screens: [0], display: 'Display -900001' });
        expect(h.calls).toEqual(['display 0 -900001']);
        expect(result.did).toBe(
            'screen 0 on Display -900001 (virtual: on no monitor here)',
        );
        expect(result.note).toBe(
            'screen 1 is on Display -900001 too: shown together, the last ' +
                'one shown is on top.',
        );
    });

    it('names every screen sharing it, in the plural', async () => {
        h.managers.push(genManager(2));
        h.managers[1].displayId = -900001;
        h.managers[2].displayId = -900001;
        const result = await set({ screens: [0], display: -900001 });
        expect(result.note).toContain(
            'screens 1 and 2 are on Display -900001 too',
        );
    });

    it('says a screen is on the display already', async () => {
        const result = await set({ display: 'Built-in Retina Display' });
        expect(result.already).toEqual([
            'screen 0 already on Built-in Retina Display',
        ]);
        expect(h.calls).toEqual([]);
    });

    it('refuses a display there is not', async () => {
        expect(await refuse({ display: 'Nowhere' })).toContain(
            'No display is called "Nowhere".',
        );
    });

    it('moves a screen whose display this window cannot read', async () => {
        h.managers[0].isDisplayUnknown = true;
        h.managers[1].isDisplayUnknown = true;
        const result = await set({ screens: [0], display: 1 });
        expect(h.calls).toEqual(['display 0 1']);
        // A screen it cannot read is never said to share the display.
        expect(result.note).toBeUndefined();
    });
});

describe('set: a transition', () => {
    it('refuses a layer the card does not have, or none named', async () => {
        const reason =
            '`transition` is {slide, background, foreground}: each none, ' +
            'fade, move or zoom.';
        expect(await refuse({ transition: { curtain: 'fade' } })).toBe(reason);
        expect(await refuse({ transition: {} })).toBe(reason);
        expect(await refuse({ transition: 5 })).toBe(reason);
    });

    it('changes each layer named, and says the one that is so already', async () => {
        const result = await set({
            transition: { slide: 'cut', foreground: 'fade' },
        });
        expect(result.did).toBe('the slide transition of screen 0 none');
        expect(result.already).toEqual([
            'the foreground transition of screen 0 already fade',
        ]);
        expect(h.managers[0].effects['vary-app-document'].effectType).toBe(
            'none',
        );
    });
});

describe('set: Line Sync', () => {
    it('is true or false', async () => {
        expect(await refuse({ lineSync: 'on' })).toBe(
            '`lineSync` is true or false.',
        );
    });

    it('turns off in a sentence of its own', async () => {
        h.managers[0].screenLongTextManager.isLineSync = true;
        const result = await set({ lineSync: false });
        expect(result.did).toBe('Line Sync turned off for screen 0');
        expect(h.managers[0].screenLongTextManager.isLineSync).toBe(false);
        const again = await set({ lineSync: false });
        expect(again.already).toEqual(['Line Sync already off for screen 0']);
    });
});

describe("set: a passage's versions", () => {
    beforeEach(() => {
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
            'ASV',
        ]);
    });

    it('asks for a Bible to add or take off', async () => {
        const reason =
            '`versions` is {add: [Bibles]} and/or {remove: [Bibles]}, each ' +
            'a key ("KJV"), a title, or a language in English as the read ' +
            'names it.';
        expect(await refuse({ versions: {} })).toBe(reason);
        expect(await refuse({ versions: 'KJV' })).toBe(reason);
        expect(await refuse({ versions: { add: [] } })).toBe(reason);
    });

    it('asks for a passage on screens that show none, in the plural', async () => {
        h.managers[0].screenLongTextManager.screenViewData = null;
        expect(
            await refuse({ screens: [0, 1], versions: { add: 'ASV' } }),
        ).toBe(
            'screens 0 and 1 show no Bible passage. Put one up first ' +
                '(owa_present_bible), then add the version.',
        );
    });

    it('refuses a Bible not installed', async () => {
        expect(await refuse({ versions: { add: 'Vulgate' } })).toContain(
            'No Bible called "Vulgate" is installed.',
        );
    });

    it('takes a version off by its key in any case, and draws it again', async () => {
        const result = await set({ versions: { remove: 'asv' } });
        expect(readKeys(h.managers[0])).toEqual(['KJV']);
        expect(result.did).toBe('screen 0 in KJV');
        // One version left: no word about lining them up.
        expect(result.note).toBeUndefined();
    });

    it('takes a version off by its title', async () => {
        await set({ versions: { remove: ['American Standard'] } });
        expect(readKeys(h.managers[0])).toEqual(['KJV']);
    });

    it('swaps one version for another in one call', async () => {
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        const result = await set({ versions: { add: 'ASV', remove: 'KJV' } });
        expect(readKeys(h.managers[0])).toEqual(['ASV']);
        expect(result.did).toBe('screen 0 in ASV');
    });

    it('keeps one version at least', async () => {
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        expect(await refuse({ versions: { remove: 'KJV' } })).toContain(
            'A passage is drawn in one version at least.',
        );
    });

    it('refuses to take off an installed Bible the screen does not show', async () => {
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        expect(await refuse({ versions: { remove: 'ASV' } })).toBe(
            'ASV is not on the screen; it shows KJV.',
        );
    });

    it('names what is on the screen for a Bible it does not know', async () => {
        expect(await refuse({ versions: { remove: 'Vulgate' } })).toContain(
            'No Bible called "Vulgate" is installed. Installed: KJV ' +
                '(English), ASV (English). A Bible is added in Settings, ' +
                'under the Bible tab. On the screen: KJV, ASV.',
        );
    });

    it('says the passage is in the version already', async () => {
        const result = await set({ versions: { add: 'KJV' } });
        expect(result.did).toBe('nothing: it is already so');
        expect(result.already).toEqual(['the passage already in KJV + ASV']);
    });

    it('changes only the screens whose passage it changes', async () => {
        h.managers[1].isSelected = true;
        h.managers[1].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        const result = await set({ versions: { remove: 'ASV' } });
        expect(result.did).toBe('screen 0 in KJV');
        expect(readKeys(h.managers[1])).toEqual(['KJV']);
    });

    it('refuses the call whole when a version cannot draw the passage', async () => {
        h.viewDataError = new Error('The ASV file could not be read.');
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        const before = h.managers[0].screenLongTextManager.screenViewData;
        const result = await set({ versions: { add: 'ASV' }, lineSync: true });
        expect(result).toEqual({
            isError: true,
            reason: 'The ASV file could not be read.',
        });
        expect(h.managers[0].screenLongTextManager.screenViewData).toBe(before);
        expect(h.managers[0].screenLongTextManager.isLineSync).toBe(false);
        expect(h.summaries).toEqual([]);
    });
});

describe('set: a clear', () => {
    it('refuses a layer it does not clear', async () => {
        expect(await refuse({ clear: 'everything' })).toBe(
            '`clear` is "bible" (the passage, or a Long Text Show in its ' +
                'place), "slide", "background", "foreground" or "all".',
        );
    });

    it('says a screen holds nothing of it already', async () => {
        const slide = await set({ clear: 'slide' });
        expect(slide.already).toEqual(['screen 0 already holding no slide']);
        const all = await set({ clear: 'all' });
        expect(all.already).toEqual(['screen 0 already holding no content']);
        expect(h.calls).toEqual([]);
    });

    it('takes everything off a screen with "all"', async () => {
        const screenManager = h.managers[0];
        screenManager.screenLongTextManager.isShowing = true;
        screenManager.screenVaryAppDocumentManager.varySlideData = { id: 1 };
        screenManager.screenBackgroundManager.backgroundSrc = { src: 'a.jpg' };
        screenManager.isShowingForeground = true;
        const result = await set({ clear: 'all' });
        expect(h.calls).toEqual([
            'clear bible 0',
            'clear slide 0',
            'clear background 0',
            'clear foreground 0',
        ]);
        expect(result.did).toBe('everything off screen 0');
    });

    it('leaves the Bible layer alone in "all" when no passage is up', async () => {
        h.managers[0].screenBackgroundManager.backgroundSrc = { src: 'a.jpg' };
        await set({ clear: 'all' });
        expect(h.calls).toContain('clear background 0');
        expect(h.calls).not.toContain('clear bible 0');
    });

    it('takes one layer off, each by its own Clear', async () => {
        h.managers[0].screenLongTextManager.isShowing = true;
        h.managers[0].isShowingForeground = true;
        const bible = await set({ clear: 'bible' });
        expect(bible.did).toBe('the bible off screen 0');
        const foreground = await set({ clear: 'foreground' });
        expect(foreground.did).toBe('the foreground off screen 0');
        expect(h.calls).toEqual(['clear bible 0', 'clear foreground 0']);
    });
});

describe('set: the Bible text style', () => {
    it('is an object', async () => {
        for (const style of ['bold', null, [{ bold: true }]]) {
            expect(await refuse({ style })).toBe(
                '`style` is an object: size, color, bold, italic, shadow, ' +
                    'outline, outlineColor, glow, glowColor, look, align, ' +
                    'lineHeight, letterSpacing, font, backdrop, highlight, ' +
                    'reset.',
            );
        }
    });

    it("passes the rules' refusal on", async () => {
        expect(await refuse({ style: { size: 'huge' } })).toContain('`size`');
        expect(h.applied).toEqual([]);
    });

    it('says the style is so already, and keeps no backup for it', async () => {
        const result = await set({ style: { bold: false } });
        expect(result.did).toBe('nothing: it is already so');
        expect(result.already).toEqual([
            'the Bible text already so (65px, words #FFFFFF)',
        ]);
        expect(h.applied).toEqual([]);
        expect(h.summaries).toEqual([]);
    });
});

describe('set: on or off', () => {
    it('is true or false', async () => {
        expect(await refuse({ show: 'please' })).toBe(
            '`show` is true or false.',
        );
    });

    it('says a screen is on, or off, already', async () => {
        const result = await set({ show: true });
        expect(result.already).toEqual(['screen 0 already on']);
        const off = await set({ screens: [1], show: false });
        expect(off.already).toEqual(['screen 1 already off']);
    });

    it('turns a screen on when asked', async () => {
        const result = await set({ screens: [1], show: true });
        expect(result.did).toBe('screen 1 turned on');
        expect(h.managers[1].isShowing).toBe(true);
        const off = await set({ screens: [0, 1], show: false });
        expect(off.did).toBe('screens 0 and 1 turned off');
        expect(h.managers.map((one) => one.isShowing)).toEqual([false, false]);
    });
});

describe('set: the backup', () => {
    it("keeps each foreground component's lists, read before and after", async () => {
        h.managers[0].screenForegroundManager.foregroundData = {
            countdown: {},
            marquee: {},
        };
        h.managers[1].screenForegroundManager.foregroundData = {
            countdown: {},
        };
        await set({ lineSync: true });
        expect(h.foregroundReads).toEqual([
            'countdown',
            'marquee',
            'countdown',
            'marquee',
        ]);
        expect(h.appended).toEqual([
            [
                'undo-1',
                [
                    { kind: 'screen-setting' },
                    { kind: 'screen-layer' },
                    {
                        kind: 'screen-foreground',
                        key: 'countdown',
                        before: ['lists of countdown'],
                        after: ['lists of countdown'],
                    },
                    {
                        kind: 'screen-foreground',
                        key: 'marquee',
                        before: ['lists of marquee'],
                        after: ['lists of marquee'],
                    },
                ],
            ],
        ]);
    });

    it('says when no Undo could be kept for a change that was made', async () => {
        h.appendError = new Error('backup folder is read-only');
        const result = await set({ screens: [0], stage: 1 });
        expect(result.isError).toBeUndefined();
        expect(result.undoId).toBeUndefined();
        expect(h.errors).toEqual([h.appendError]);
        expect(result.note).toContain('A stage above 0 cuts between slides');
        expect(result.note).toContain(
            'Done, but no Undo could be kept for it: say so, and how to ' +
                'change it back on the Mini Screen card.',
        );
        expect(h.managers[0].stage).toBe(1);
    });

    it('says a step that failed is on the screens when no Undo was kept', async () => {
        h.appendError = new Error('backup folder is read-only');
        h.managers[1].setColorNote = async () => {
            throw new Error('the screen window closed');
        };
        const result = await set({ screens: [0, 1], group: 'lime' });
        expect(result.isError).toBe(true);
        expect(result.reason).toBe(
            'Part of it could not be done (screens 0 and 1 in the lime ' +
                'group: the screen window closed). What was done is on the ' +
                'screens now.',
        );
        expect(h.managers[0].colorNote).toBe('#00FF00');
    });

    it('says a step that threw a bare value, with the Undo of what was done', async () => {
        h.managers[1].setColorNote = async () => {
            throw 'window gone';
        };
        const result = await set({ screens: [0, 1], group: 'lime' });
        expect(result.reason).toBe(
            'Part of it could not be done (screens 0 and 1 in the lime ' +
                'group: window gone). What was done is undone with owa_undo ' +
                'id "undo-1".',
        );
        expect(result.undoId).toBe('undo-1');
    });

    it('cuts a long summary for the backup list, and says all of it back', async () => {
        h.managers[0].isSelected = true;
        h.managers[1].isSelected = true;
        const result = await set({
            transition: {
                slide: 'zoom',
                background: 'move',
                foreground: 'none',
            },
            stage: 4,
            lineSync: true,
            style: {
                size: 90,
                bold: true,
                italic: true,
                align: 'center',
                font: 'A Rather Long Font Family Name',
            },
        });
        const [summary] = h.summaries;
        expect(summary.length).toBe(300);
        expect(summary.endsWith('...')).toBe(true);
        expect(
            summary.startsWith(
                'Changed the screens: screens 0 and 1 on stage 4',
            ),
        ).toBe(true);
        expect(result.did.length).toBeGreaterThan(300);
        expect(result.did).toContain(
            'the font "A Rather Long Font Family Name"',
        );
        expect(result.bibleStyle).toContain('90px');
    });
});

describe('a screen added', () => {
    it('says when no Undo could be kept for the screen it added', async () => {
        h.appendError = new Error('backup folder is read-only');
        const result = await set({ newScreen: true });
        expect(result.isError).toBeUndefined();
        expect(result.newScreen).toBe(2);
        expect(result.undoId).toBeUndefined();
        expect(h.errors).toEqual([h.appendError]);
        expect(result.note).toContain(
            'Done, but no Undo could be kept for it: say so; a person ' +
                "removes it with Delete in its Mini Screen card's menu.",
        );
    });

    it('says the display the new screen is on', async () => {
        const result = await set({ newScreen: true });
        expect(result.note).toContain(
            '; it is on Built-in Retina Display (id 1).',
        );
    });

    it('names no display for a new screen whose display it cannot read', async () => {
        h.newScreenState = { isDisplayUnknown: true };
        const result = await set({ newScreen: true });
        expect(result.newScreen).toBe(2);
        expect(result.note).toContain(
            'Screen 2 is new: off and not ticked, so nothing put up goes ' +
                'to it yet. To use it',
        );
        expect(result.note).not.toContain('it is on');
    });
});

describe('a request that goes wrong', () => {
    it('answers with the reason, never a throw', async () => {
        h.bibleError = new Error('The Bibles folder could not be read.');
        const result = await edit({ action: 'read' });
        expect(result).toEqual({
            isError: true,
            reason: 'The Bibles folder could not be read.',
        });
        expect(h.errors).toEqual([h.bibleError]);
    });

    it('says a thrown value that is not an error', async () => {
        h.bibleError = 'disk gone';
        const result = await edit({ action: 'read' });
        expect(result).toEqual({ isError: true, reason: 'disk gone' });
    });

    it('asks for an action when the request has none at all', async () => {
        expect(await edit(null)).toEqual({
            isError: true,
            reason: '`action` is "read" or "set".',
        });
    });
});
