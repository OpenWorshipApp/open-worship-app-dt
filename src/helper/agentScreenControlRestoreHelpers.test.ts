import { beforeEach, describe, expect, it, vi } from 'vitest';

// EC-630: a screen the assistant added is taken away by its undo, and put
// back -- its card's settings with it -- by the undo of that undo.
const h = vi.hoisted(() => {
    return {
        managers: [] as any[],
        calls: [] as string[],
    };
});

function genManager(screenId: number, state: Record<string, unknown> = {}) {
    const genEffect = (target: string) => {
        let effectType = 'fade';
        return {
            get effectType() {
                return effectType;
            },
            set effectType(value: string) {
                h.calls.push(`transition ${screenId} ${target} ${value}`);
                effectType = value;
            },
        };
    };
    let displayId = 1;
    let stage = 0;
    let isSelected = false;
    let isLineSync = false;
    const screenManager: any = {
        screenId,
        isDeleted: false,
        isShowing: false,
        isLocked: false,
        colorNote: null as string | null,
        get displayId() {
            return displayId;
        },
        set displayId(value: number) {
            h.calls.push(`display ${screenId} ${value}`);
            displayId = value;
        },
        get stage() {
            return stage;
        },
        set stage(value: number) {
            h.calls.push(`stage ${screenId} ${value}`);
            stage = value;
        },
        get isSelected() {
            return isSelected;
        },
        set isSelected(value: boolean) {
            h.calls.push(`selected ${screenId} ${value}`);
            isSelected = value;
        },
        screenLongTextManager: {
            get isLineSync() {
                return isLineSync;
            },
            set isLineSync(value: boolean) {
                h.calls.push(`line-sync ${screenId} ${value}`);
                isLineSync = value;
            },
        },
        varyAppDocumentEffectManager: genEffect('vary-app-document'),
        backgroundEffectManager: genEffect('background'),
        foregroundEffectManager: genEffect('foreground'),
        setColorNote: async (color: string | null) => {
            h.calls.push(`group ${screenId} ${color}`);
            screenManager.colorNote = color;
        },
        delete: async () => {
            h.calls.push(`delete ${screenId}`);
            screenManager.isDeleted = true;
            h.managers = h.managers.filter((one) => {
                return one !== screenManager;
            });
        },
        ...state,
    };
    return screenManager;
}

vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.managers,
    addScreenManager: (screenId: number) => {
        h.calls.push(`add ${screenId}`);
        const screenManager = genManager(screenId);
        h.managers.push(screenManager);
        return screenManager;
    },
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: { textStyle: {}, sendSynTextStyle: () => {} },
}));

const {
    applyScreenPresenceRestore,
    readScreenControlState,
    snapshotScreenPresenceRestore,
} = await import('./agentScreenControlRestoreHelpers');

const added = {
    type: 'screen-presence' as const,
    screenId: 2,
    present: false,
};

beforeEach(() => {
    h.calls = [];
    h.managers = [genManager(0), genManager(2)];
});

describe('a screen added, and its undo', () => {
    it('takes the screen away, keeping its settings for the undo of it', async () => {
        const screenManager = h.managers[1];
        screenManager.colorNote = 'blue';
        screenManager.isSelected = true;
        h.calls = [];
        const [kept] = snapshotScreenPresenceRestore(added);
        expect(kept).toEqual({
            type: 'screen-presence',
            screenId: 2,
            present: true,
            controls: readScreenControlState(screenManager),
        });
        expect(kept.controls?.values.group).toBe('blue');
        await applyScreenPresenceRestore(added);
        expect(h.calls).toEqual(['delete 2']);
        expect(
            h.managers.map((one) => {
                return one.screenId;
            }),
        ).toEqual([0]);
    });

    it('does nothing to a screen gone already, and keeps nothing', async () => {
        h.managers = [genManager(0)];
        expect(snapshotScreenPresenceRestore(added)).toEqual([]);
        await applyScreenPresenceRestore(added);
        expect(h.calls).toEqual([]);
    });

    it('puts a screen back with its settings, through its setters', async () => {
        const original = h.managers[1];
        original.colorNote = 'blue';
        original.displayId = 7;
        original.stage = 2;
        original.backgroundEffectManager.effectType = 'zoom';
        original.screenLongTextManager.isLineSync = true;
        original.isSelected = true;
        const [kept] = snapshotScreenPresenceRestore(added);
        await applyScreenPresenceRestore(added);
        h.calls = [];
        // The undo of the undo.
        expect(snapshotScreenPresenceRestore(kept)).toEqual([added]);
        await applyScreenPresenceRestore(kept);
        expect(h.calls).toEqual([
            'add 2',
            'group 2 blue',
            'display 2 7',
            'stage 2 2',
            'transition 2 vary-app-document fade',
            'transition 2 background zoom',
            'transition 2 foreground fade',
            'line-sync 2 true',
            'selected 2 true',
        ]);
        expect(readScreenControlState(h.managers[1])).toEqual(kept.controls);
    });

    it('puts none back over a screen that is there', async () => {
        const back = { ...added, present: true };
        expect(snapshotScreenPresenceRestore(back)).toEqual([]);
        await applyScreenPresenceRestore(back);
        expect(h.calls).toEqual([]);
    });
});
