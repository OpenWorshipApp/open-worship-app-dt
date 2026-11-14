import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    SCREEN_EDIT_CLEARS,
    SCREEN_EDIT_DESCRIPTION,
    SCREEN_EDIT_FIELDS,
    SCREEN_EDIT_SELECTS,
} from '../../tools/owa-devtools-mcp/agentScreenEdit.mjs';
import { SCREEN_STYLE_KEY_LIST } from './agentScreenControlRules';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
        textStyle: {} as Record<string, unknown>,
        applied: [] as Record<string, unknown>[],
        displays: [] as any[],
        bibles: [] as { key: string; title: string; locale: string }[],
        summaries: [] as string[],
        appended: [] as [string, unknown[]][],
        isBackupRefused: false,
        isAddIgnored: false,
        calls: [] as string[],
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
    getAllDisplays: () => ({
        primaryDisplay: h.displays[0],
        displays: h.displays,
    }),
}));
vi.mock('../_screen/screenBibleHelpers', () => ({
    bibleItemJsonToScreenViewData: async (
        bibleItem: unknown,
        keys: string[],
    ) => {
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
        // The Mini Screen menu's Add New Screen, as the worker presses it.
        genNewScreenManagerBase: () => {
            const screenId = findFreeScreenId();
            h.calls.push(`add screen ${screenId}`);
            if (!h.isAddIgnored) {
                h.managers.push(genManager(screenId));
            }
            return screenId;
        },
    };
});
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: async () => h.bibles,
}));
vi.mock('./agentScreenHelpers', () => ({
    describeScreensForAgent: () => ({
        screens: h.managers.map((screenManager) => ({
            screenId: screenManager.screenId,
            bible: screenManager.screenLongTextManager.screenViewData
                ? { reference: 'John 3:16' }
                : null,
            slide: null,
            background: null,
            foreground: [],
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
    captureForegroundLists: () => [],
    captureTextLayers: () => ['texts'],
}));
// What the change did, as restores the test can recognise.
vi.mock('./agentBackupPlanHelpers', () => ({
    diffScreenSettings: () => [{ kind: 'screen-setting' }],
    diffTextLayers: () => [],
    diffScreenLayers: () => [{ kind: 'screen-layer' }],
    diffForegroundSlots: () => [],
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
            h.appended.push([id, restores]);
        },
        genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    };
});
vi.mock('./cssColorResolveHelpers', () => ({
    resolveCssColor: () => null,
}));
vi.mock('./errorHelpers', () => ({
    handleError: () => {},
}));

const { handleAgentScreenEditRequest } =
    await import('./agentScreenControlHelpers');
const {
    AGENT_SCREEN_CLEAR_LIST,
    AGENT_SCREEN_EDIT_FIELD_LIST,
    AGENT_SCREEN_SELECT_LIST,
} = await import('./agentScreenControlHelpers');

function genManager(screenId: number, state: Record<string, unknown> = {}) {
    const screenManager: any = {
        screenId,
        isSelected: false,
        isShowing: false,
        isLocked: false,
        colorNote: null,
        stage: 0,
        displayId: 1,
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

function genPassage(keys: string[]) {
    return {
        bibleItemData: {
            bibleItem: { bibleKey: keys[0], target: { bookKey: 'JHN' } },
            renderedList: keys.map((bibleKey) => ({ bibleKey })),
        },
    };
}

async function edit(request: Record<string, unknown>) {
    const promise = handleAgentScreenEditRequest(request);
    // The change waits for what its setters started to land.
    await vi.runAllTimersAsync();
    return promise;
}

beforeEach(() => {
    vi.useFakeTimers();
    h.isPagePresenter = true;
    h.textStyle = {};
    h.applied = [];
    h.summaries = [];
    h.appended = [];
    h.calls = [];
    h.isBackupRefused = false;
    h.isAddIgnored = false;
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

describe('the tool and the worker', () => {
    it('take the same fields, ticks and clears', () => {
        expect([...AGENT_SCREEN_EDIT_FIELD_LIST]).toEqual(SCREEN_EDIT_FIELDS);
        expect(AGENT_SCREEN_SELECT_LIST).toEqual(SCREEN_EDIT_SELECTS);
        expect(AGENT_SCREEN_CLEAR_LIST).toEqual(SCREEN_EDIT_CLEARS);
    });

    it("say every style field in the tool's description", () => {
        for (const key of SCREEN_STYLE_KEY_LIST) {
            expect(SCREEN_EDIT_DESCRIPTION, key).toContain(key);
        }
    });
});

describe('off the Presenter', () => {
    it('reads as a note naming the page, and changes nothing', async () => {
        h.isPagePresenter = false;
        const read = await edit({ action: 'read' });
        expect(read.needsPage).toBe('presenter');
        expect(read.isError).toBeUndefined();
        const set = await edit({ action: 'set', style: { size: 'larger' } });
        expect(set.isError).toBe(true);
        expect(set.reason).toContain('Nothing was changed');
        expect(h.applied).toEqual([]);
    });
});

describe('read', () => {
    it('says each screen as its card shows it, and what can be chosen', async () => {
        h.managers[0].colorNote = '#FFFF00';
        h.managers[1].colorNote = '#FFFF00';
        h.managers[1].isLocked = true;
        h.managers[1].displayId = -900001;
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
            'ASV',
        ]);
        const result = await edit({ action: 'read' });
        const screens = result.screens as any[];
        expect(screens[0]).toMatchObject({
            id: 0,
            on: true,
            ticked: true,
            locked: false,
            group: 'yellow',
            groupWith: [1],
            display: 'Built-in Retina Display (id 1)',
            transition: {
                slide: 'fade',
                background: 'fade',
                foreground: 'fade',
            },
            bible: { reference: 'John 3:16', versions: ['KJV', 'ASV'] },
        });
        expect(screens[1]).toMatchObject({
            locked: true,
            display:
                'Display -900001 (id -900001, virtual: on no monitor here)',
            bible: null,
        });
        expect(result.bibleStyle).toBe('65px, words #FFFFFF');
        expect(result.displays).toEqual([
            {
                id: 1,
                name: 'Built-in Retina Display',
                size: '1512x982',
                primary: true,
            },
            {
                id: -900001,
                name: 'Display -900001',
                size: '1920x1080',
                virtual: true,
            },
        ]);
        expect(result.bibles).toEqual([
            'KJV: King James Version (English)',
            'ASV: American Standard Version (English)',
        ]);
        expect(result.groupColors).toContain('yellow');
    });
});

describe('set', () => {
    it('changes the Bible text style once, backed up, with its Undo', async () => {
        const result = await edit({
            action: 'set',
            style: { size: 'larger', bold: true },
        });
        expect(h.applied).toEqual([{ fontSize: 81, isBold: true }]);
        expect(h.summaries).toEqual([
            'Changed the screens: the Bible text on every screen: size ' +
                '65px -> 81px, bold',
        ]);
        expect(h.appended).toEqual([
            ['undo-1', [{ kind: 'screen-setting' }, { kind: 'screen-layer' }]],
        ]);
        expect(result).toMatchObject({
            did: 'the Bible text on every screen: size 65px -> 81px, bold',
            bibleStyle: '81px, words #FFFFFF, bold',
            undoId: 'undo-1',
        });
        expect(result.isError).toBeUndefined();
    });

    it('refuses the whole call for one wrong field, changing nothing', async () => {
        const result = await edit({
            action: 'set',
            style: { size: 'larger' },
            transition: 'spin',
        });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('"spin" is not a transition');
        expect(h.applied).toEqual([]);
        expect(h.summaries).toEqual([]);
    });

    it('names the screens there are for a number no screen has', async () => {
        const result = await edit({
            action: 'set',
            screens: [5],
            lineSync: true,
        });
        expect(result.reason).toBe(
            'There is no screen 5. The screens: 0 (ticked, on), 1 (not ' +
                'ticked, OFF). Leave screens out to use the ticked ones, or ' +
                'name one of those numbers.',
        );
    });

    it('works on the ticked screens when none are named', async () => {
        await edit({ action: 'set', transition: { background: 'zoom' } });
        expect(h.managers[0].effects.background.effectType).toBe('zoom');
        expect(h.managers[1].effects.background.effectType).toBe('fade');
    });

    it('turns Line Sync on in a sentence, and says when it already is', async () => {
        const result = await edit({ action: 'set', lineSync: true });
        // It read "Line Sync on on screen 0" in the live run.
        expect(result.did).toBe(
            'Line Sync turned on for screen 0 (the versions lined up verse ' +
                'by verse)',
        );
        expect(h.managers[0].screenLongTextManager.isLineSync).toBe(true);
        const again = await edit({ action: 'set', lineSync: true });
        expect(again.already).toEqual(['Line Sync already on for screen 0']);
    });

    it('says it is already so and keeps no backup for nothing', async () => {
        const result = await edit({
            action: 'set',
            screens: [0, 1],
            transition: 'fade',
        });
        expect(result.did).toBe('nothing: it is already so');
        expect(result.already).toEqual([
            'the slide transition of screens 0 and 1 already fade',
        ]);
        expect(h.summaries).toEqual([]);
    });

    it('refuses to change what a locked screen shows, unless unlocked first', async () => {
        h.managers[1].isLocked = true;
        h.managers[1].screenBackgroundManager.backgroundSrc = { src: 'a.jpg' };
        const refused = await edit({
            action: 'set',
            screens: [1],
            clear: 'background',
        });
        expect(refused.reason).toContain('screen 1 is locked');
        expect(refused.reason).toContain('Nothing was changed');
        expect(h.calls).toEqual([]);
        await edit({
            action: 'set',
            screens: [1],
            clear: 'background',
            lock: false,
        });
        // Unlocked before the clear, so the clear can happen.
        expect(h.calls).toEqual(['lock 1 false', 'clear background 1']);
    });

    it('groups two screens in the first colour nobody uses', async () => {
        h.managers.push(genManager(2, { colorNote: '#FFFF00' }));
        const result = await edit({
            action: 'set',
            screens: [0, 1],
            group: true,
        });
        expect(h.calls).toEqual(['color 0 #00FF00', 'color 1 #00FF00']);
        expect(result.did).toBe('screens 0 and 1 in the lime group');
        expect(result.note).toContain('screen 1 now shows what screen 0 shows');
    });

    it('refuses a group of one', async () => {
        const result = await edit({ action: 'set', screens: [0], group: true });
        expect(result.reason).toContain('A group is two screens at least');
    });

    it('ticks the named screen alone, and never leaves none ticked', async () => {
        await edit({ action: 'set', screens: [1], select: 'only' });
        expect(h.managers.map((one) => one.isSelected)).toEqual([false, true]);
        const refused = await edit({
            action: 'set',
            screens: [1],
            select: 'remove',
        });
        expect(refused.reason).toContain('no screen ticked');
    });

    it('adds a version to the passage up, after those there', async () => {
        h.managers[0].screenLongTextManager.screenViewData = genPassage([
            'KJV',
        ]);
        const result = await edit({
            action: 'set',
            versions: { add: ['American Standard'] },
        });
        expect(
            h.managers[0].screenLongTextManager.screenViewData.bibleItemData
                .renderedList,
        ).toEqual([{ bibleKey: 'KJV' }, { bibleKey: 'ASV' }]);
        expect(result.did).toBe('screen 0 in KJV + ASV');
        expect(result.note).toContain('Line Sync');
    });

    it('asks for a passage first when the screen shows none', async () => {
        const result = await edit({
            action: 'set',
            versions: { add: ['ASV'] },
        });
        expect(result.reason).toContain('shows no Bible passage');
        expect(h.summaries).toEqual([]);
    });

    it('turns a screen on only when asked, and says a step that failed', async () => {
        h.managers[1].setColorNote = async () => {
            throw new Error('the screen window closed');
        };
        h.managers[0].colorNote = '#FFFF00';
        const result = await edit({
            action: 'set',
            screens: [0, 1],
            group: 'yellow',
        });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('the screen window closed');
        expect(result.reason).toContain('owa_undo id "undo-1"');
    });

    it('changes nothing when no backup can be kept', async () => {
        h.isBackupRefused = true;
        const result = await edit({ action: 'set', style: { size: 90 } });
        expect(result).toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup could be saved.',
        });
        expect(h.applied).toEqual([]);
    });

    it('refuses an action it does not know', async () => {
        expect((await edit({ action: 'delete' })).reason).toBe(
            '`action` is "read" or "set".',
        );
    });
});

describe('a screen added (EC-630)', () => {
    it('adds one off and unticked, backed up by what takes it away again', async () => {
        const result: any = await edit({ action: 'set', newScreen: true });
        expect(result.isError).toBeUndefined();
        expect(h.calls).toEqual(['add screen 2']);
        expect(result.did).toBe('added screen 2');
        expect(result.newScreen).toBe(2);
        expect(result.undoId).toBe('undo-1');
        expect(h.summaries).toEqual(['Added screen 2']);
        expect(h.appended).toEqual([
            [
                'undo-1',
                [{ type: 'screen-presence', screenId: 2, present: false }],
            ],
        ]);
        expect(
            result.screens.map((screen: any) => {
                return [screen.id, screen.on, screen.ticked];
            }),
        ).toEqual([
            [0, true, true],
            [1, false, false],
            [2, false, false],
        ]);
        // What to do with it next, by its number.
        expect(result.note).toContain('Screen 2 is new: off and not ticked');
        expect(result.note).toContain('screens: [2]');
        expect(result.note).toContain('Built-in Retina Display');
    });

    it('takes the first number free, as the menu does', async () => {
        h.managers = [genManager(0), genManager(2)];
        const result: any = await edit({ action: 'set', newScreen: true });
        expect(result.newScreen).toBe(1);
        expect(h.summaries).toEqual(['Added screen 1']);
    });

    it('is a call of its own, and changes nothing beside another field', async () => {
        const result: any = await edit({
            action: 'set',
            newScreen: true,
            screens: [1],
            select: 'only',
        });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('a call of its own');
        expect(result.reason).toContain('screens, select');
        expect(h.calls).toEqual([]);
        expect(h.summaries).toEqual([]);
        expect(h.managers).toHaveLength(2);
    });

    it('is asked for with true alone', async () => {
        const result: any = await edit({ action: 'set', newScreen: 'yes' });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('`newScreen` is true');
        expect(h.calls).toEqual([]);
    });

    it('adds none past the most it adds to, and names the menu', async () => {
        h.managers = [0, 1, 2, 3, 4, 5, 6, 7].map((screenId) => {
            return genManager(screenId);
        });
        const result: any = await edit({ action: 'set', newScreen: true });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('There are 8 screens already');
        expect(result.reason).toContain('Add New Screen');
        expect(h.calls).toEqual([]);
        expect(h.summaries).toEqual([]);
    });

    it('says so when no screen came, and keeps nothing to undo', async () => {
        h.isAddIgnored = true;
        const result: any = await edit({ action: 'set', newScreen: true });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('No screen was added');
        expect(h.appended).toEqual([]);
    });

    it('changes nothing when no backup can be kept', async () => {
        h.isBackupRefused = true;
        const result: any = await edit({ action: 'set', newScreen: true });
        expect(result.isError).toBe(true);
        expect(h.calls).toEqual([]);
        expect(h.managers).toHaveLength(2);
    });
});
