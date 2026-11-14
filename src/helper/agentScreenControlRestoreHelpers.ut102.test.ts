// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

// A screen's controls and layers, read before and after a change and put
// back by an undo through the setters its Mini Screen card presses
// (`owa_screen_edit`'s `screen-setting` and `screen-layer` restores).
const h = vi.hoisted(() => {
    return {
        managers: [] as any[],
        calls: [] as string[],
        textStyle: {} as Record<string, unknown>,
    };
});

function genEffect(screenId: number, target: string) {
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
}

function genManager(screenId: number, state: Record<string, unknown> = {}) {
    let displayId = 1;
    let stage = 0;
    let isSelected = false;
    let isShowing = false;
    let isLocked = false;
    let isLineSync = false;
    const screenManager: any = {
        screenId,
        isDeleted: false,
        colorNote: null as string | null,
        isDisplayUnknown: false,
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
        get isShowing() {
            return isShowing;
        },
        set isShowing(value: boolean) {
            h.calls.push(`showing ${screenId} ${value}`);
            isShowing = value;
        },
        get isLocked() {
            return isLocked;
        },
        set isLocked(value: boolean) {
            h.calls.push(`lock ${screenId} ${value}`);
            isLocked = value;
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
        screenBackgroundManager: {
            backgroundSrc: null as unknown,
            applyBackgroundSrcWithSyncGroup: (data: unknown) => {
                h.calls.push(`background ${screenId} ${JSON.stringify(data)}`);
                screenManager.screenBackgroundManager.backgroundSrc = data;
            },
        },
        screenVaryAppDocumentManager: {
            varySlideData: null as unknown,
            applySlideSrcWithSyncGroup: async (data: unknown) => {
                h.calls.push(`slide ${screenId} ${JSON.stringify(data)}`);
                screenManager.screenVaryAppDocumentManager.varySlideData = data;
            },
        },
        varyAppDocumentEffectManager: genEffect(screenId, 'vary-app-document'),
        backgroundEffectManager: genEffect(screenId, 'background'),
        foregroundEffectManager: genEffect(screenId, 'foreground'),
        setColorNote: async (color: string | null) => {
            h.calls.push(`group ${screenId} ${color}`);
            screenManager.colorNote = color;
        },
        delete: async () => {
            h.calls.push(`delete ${screenId}`);
            screenManager.isDeleted = true;
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
    default: {
        get textStyle() {
            return h.textStyle;
        },
        set textStyle(style: Record<string, unknown>) {
            h.calls.push(`style ${JSON.stringify(style)}`);
            h.textStyle = style;
        },
        sendSynTextStyle: () => {
            h.calls.push('style sent to the screens');
        },
    },
}));

const {
    applyScreenControlRestore,
    applyScreenPresenceRestore,
    captureScreenControls,
    captureScreenLayers,
    listLiveScreenManagers,
    snapshotScreenControlRestore,
    toEffectManager,
    writeScreenSetting,
} = await import('./agentScreenControlRestoreHelpers');
const { toScreenLayerKey } = await import('./agentBackupPlanHelpers');

function genSetting(
    field: string,
    value: unknown,
    extra: Record<string, unknown> = {},
) {
    return {
        type: 'screen-setting' as const,
        field: field as any,
        screenId: 0,
        value,
        ...extra,
    };
}

function genLayer(
    layer: 'background' | 'slide',
    data: unknown,
    expect: string,
    screenId = 0,
) {
    return { type: 'screen-layer' as const, screenId, layer, data, expect };
}

beforeEach(() => {
    h.calls = [];
    h.textStyle = { fontSize: 65 };
    h.managers = [genManager(0), genManager(1)];
});

describe('the live screens', () => {
    it('are the ones not deleted, by their number', () => {
        const deleted = genManager(3, { isDeleted: true });
        h.managers = [genManager(2), deleted, genManager(0)];
        expect(
            listLiveScreenManagers().map((screenManager) => {
                return screenManager.screenId;
            }),
        ).toEqual([0, 2]);
    });

    it('name a layer the card does not transition as no effect', () => {
        const screenManager = h.managers[0];
        expect(toEffectManager(screenManager, 'background')).toBe(
            screenManager.backgroundEffectManager,
        );
        expect(toEffectManager(screenManager, 'curtain')).toBeNull();
    });
});

describe('captureScreenControls', () => {
    it('reads every control and a copy of the style, never the live one', () => {
        h.managers[1].colorNote = '#FFFF00';
        h.managers[1].stage = 2;
        h.managers[1].backgroundEffectManager.effectType = 'zoom';
        h.managers[1].isDisplayUnknown = true;
        const captured: any = captureScreenControls();
        expect(captured.style).toEqual({ fontSize: 65 });
        // A later change to the style is not in what was read before it.
        h.textStyle.fontSize = 90;
        expect(captured.style).toEqual({ fontSize: 65 });
        expect(captured.screens[1]).toEqual({
            screenId: 1,
            values: {
                group: '#FFFF00',
                // Not known in this window: read as none, never a throw.
                display: null,
                stage: 2,
                'line-sync': false,
                selected: false,
                showing: false,
                lock: false,
            },
            transitions: {
                'vary-app-document': 'fade',
                background: 'zoom',
                foreground: 'fade',
            },
        });
        expect(captured.screens[0].values.display).toBe(1);
    });

    it('reads no style when there is none', () => {
        h.textStyle = undefined as any;
        expect(captureScreenControls().style).toBeNull();
    });
});

describe('captureScreenLayers', () => {
    it('reads each layer as a copy, and nothing as null', () => {
        const background = { src: 'a.jpg', type: 'image' };
        h.managers[0].screenBackgroundManager.backgroundSrc = background;
        h.managers[1].screenVaryAppDocumentManager.varySlideData = {
            slideId: 4,
        };
        h.managers[1].screenBackgroundManager.backgroundSrc = undefined;
        const layers = captureScreenLayers();
        expect(layers).toEqual([
            {
                screenId: 0,
                background: { src: 'a.jpg', type: 'image' },
                slide: null,
            },
            { screenId: 1, background: null, slide: { slideId: 4 } },
        ]);
        background.src = 'b.jpg';
        expect((layers[0].background as any).src).toBe('a.jpg');
    });
});

describe('snapshotScreenControlRestore: what an undo keeps for its own undo', () => {
    it('reads the shared style now, whatever the restore held', async () => {
        const kept = await snapshotScreenControlRestore(
            genSetting('style', { fontSize: 40 }, { screenId: undefined }),
        );
        expect(kept).toMatchObject({ field: 'style', value: { fontSize: 65 } });
        h.textStyle.fontSize = 99;
        expect((kept as any).value.fontSize).toBe(65);
    });

    it('reads each control of the screen as it is now', async () => {
        const screenManager = h.managers[0];
        screenManager.colorNote = '#00FF00';
        screenManager.displayId = 7;
        screenManager.stage = 3;
        screenManager.screenLongTextManager.isLineSync = true;
        screenManager.isSelected = true;
        screenManager.isShowing = true;
        screenManager.isLocked = true;
        const read = async (field: string) => {
            const kept: any = await snapshotScreenControlRestore(
                genSetting(field, 'as it was'),
            );
            return kept.value;
        };
        expect(await read('group')).toBe('#00FF00');
        expect(await read('display')).toBe(7);
        expect(await read('stage')).toBe(3);
        expect(await read('line-sync')).toBe(true);
        expect(await read('selected')).toBe(true);
        expect(await read('showing')).toBe(true);
        expect(await read('lock')).toBe(true);
    });

    it("reads a layer's transition, keeping the restore's for a layer it lacks", async () => {
        h.managers[0].foregroundEffectManager.effectType = 'move';
        const kept: any = await snapshotScreenControlRestore(
            genSetting('transition', 'zoom', { target: 'foreground' }),
        );
        expect(kept.value).toBe('move');
        const unknown: any = await snapshotScreenControlRestore(
            genSetting('transition', 'zoom', { target: 'curtain' }),
        );
        expect(unknown.value).toBe('zoom');
        const noTarget: any = await snapshotScreenControlRestore(
            genSetting('transition', 'none'),
        );
        expect(noTarget.value).toBe('none');
    });

    it('keeps what the restore held for a screen that is gone, or not named', async () => {
        const gone: any = await snapshotScreenControlRestore(
            genSetting('stage', 4, { screenId: 9 }),
        );
        expect(gone.value).toBe(4);
        const unnamed: any = await snapshotScreenControlRestore(
            genSetting('lock', true, { screenId: undefined }),
        );
        expect(unnamed.value).toBe(true);
    });

    it("keeps a layer's content now, put back only over what the undo leaves", async () => {
        h.managers[0].screenBackgroundManager.backgroundSrc = {
            src: 'now.jpg',
        };
        const before = { src: 'before.jpg' };
        const kept: any = await snapshotScreenControlRestore(
            genLayer('background', before, 'ignored'),
        );
        expect(kept).toEqual({
            type: 'screen-layer',
            screenId: 0,
            layer: 'background',
            data: { src: 'now.jpg' },
            expect: toScreenLayerKey(before),
        });
        h.managers[1].screenVaryAppDocumentManager.varySlideData = {
            slideId: 2,
        };
        const slide: any = await snapshotScreenControlRestore(
            genLayer('slide', null, 'ignored', 1),
        );
        expect(slide.data).toEqual({ slideId: 2 });
        expect(slide.expect).toBe('');
        const gone: any = await snapshotScreenControlRestore(
            genLayer('slide', { slideId: 1 }, 'ignored', 9),
        );
        expect(gone.data).toBeNull();
    });
});

describe('applyScreenControlRestore: a control put back', () => {
    it('puts the shared style back whole, and tells the screens', async () => {
        const style = { fontSize: 40, isBold: true };
        await applyScreenControlRestore(
            genSetting('style', style, { screenId: undefined }),
        );
        expect(h.textStyle).toEqual({ fontSize: 40, isBold: true });
        // A copy: the backup's object is not the setting's.
        expect(h.textStyle).not.toBe(style);
        expect(h.calls).toEqual([
            'style {"fontSize":40,"isBold":true}',
            'style sent to the screens',
        ]);
    });

    it('puts no style back that is not one', async () => {
        await applyScreenControlRestore(genSetting('style', null));
        await applyScreenControlRestore(genSetting('style', 'bold'));
        expect(h.calls).toEqual([]);
        expect(h.textStyle).toEqual({ fontSize: 65 });
    });

    it('puts each control back through its setter', async () => {
        h.managers[0].colorNote = '#FFFF00';
        await applyScreenControlRestore(genSetting('group', ''));
        await applyScreenControlRestore(genSetting('group', '#0000FF'));
        await applyScreenControlRestore(genSetting('display', 5));
        await applyScreenControlRestore(genSetting('stage', 2));
        await applyScreenControlRestore(
            genSetting('transition', 'zoom', { target: 'background' }),
        );
        await applyScreenControlRestore(genSetting('line-sync', true));
        await applyScreenControlRestore(genSetting('selected', true));
        await applyScreenControlRestore(genSetting('showing', true));
        await applyScreenControlRestore(genSetting('lock', true));
        expect(h.calls).toEqual([
            'group 0 null',
            'group 0 #0000FF',
            'display 0 5',
            'stage 0 2',
            'transition 0 background zoom',
            'line-sync 0 true',
            'selected 0 true',
            'showing 0 true',
            'lock 0 true',
        ]);
    });

    it('writes nothing a control cannot hold', async () => {
        await applyScreenControlRestore(genSetting('display', 'DELL'));
        await applyScreenControlRestore(genSetting('display', Infinity));
        await applyScreenControlRestore(genSetting('stage', -1));
        await applyScreenControlRestore(genSetting('stage', '2'));
        await applyScreenControlRestore(
            genSetting('transition', 'zoom', { target: 'curtain' }),
        );
        await applyScreenControlRestore(
            genSetting('transition', 3, { target: 'background' }),
        );
        expect(h.calls).toEqual([]);
        expect(h.managers[0].displayId).toBe(1);
        expect(h.managers[0].stage).toBe(0);
    });

    it('turns a screen on or off only when it is not so already', async () => {
        await applyScreenControlRestore(genSetting('showing', false));
        expect(h.calls).toEqual([]);
        await applyScreenControlRestore(genSetting('showing', true));
        await applyScreenControlRestore(genSetting('showing', true));
        expect(h.calls).toEqual(['showing 0 true']);
    });

    it('reads anything but true as off', async () => {
        h.managers[0].isLocked = true;
        h.managers[0].isSelected = true;
        h.calls = [];
        await applyScreenControlRestore(genSetting('lock', 'yes'));
        await applyScreenControlRestore(genSetting('selected', 1));
        await applyScreenControlRestore(genSetting('line-sync', null));
        expect(h.calls).toEqual([
            'lock 0 false',
            'selected 0 false',
            'line-sync 0 false',
        ]);
    });

    it('puts nothing back on a screen that is gone', async () => {
        await applyScreenControlRestore(
            genSetting('lock', true, { screenId: 9 }),
        );
        await writeScreenSetting('stage', null, 2);
        expect(h.calls).toEqual([]);
    });
});

describe('applyScreenControlRestore: a layer put back', () => {
    it('puts the background back while the screen holds what the change left', async () => {
        const left = { src: 'left.jpg' };
        h.managers[0].screenBackgroundManager.backgroundSrc = left;
        const before = { src: 'before.jpg' };
        await applyScreenControlRestore(
            genLayer('background', before, toScreenLayerKey(left)),
        );
        expect(h.calls).toEqual(['background 0 {"src":"before.jpg"}']);
        // A copy of the backup, not the backup's own object.
        expect(h.managers[0].screenBackgroundManager.backgroundSrc).toEqual(
            before,
        );
        expect(h.managers[0].screenBackgroundManager.backgroundSrc).not.toBe(
            before,
        );
    });

    it('takes a slide the change put up off again, through the slide setter', async () => {
        h.managers[1].screenVaryAppDocumentManager.varySlideData = {
            slideId: 3,
        };
        await applyScreenControlRestore(
            genLayer('slide', null, toScreenLayerKey({ slideId: 3 }), 1),
        );
        expect(h.calls).toEqual(['slide 1 null']);
        expect(h.managers[1].screenVaryAppDocumentManager.varySlideData).toBe(
            null,
        );
    });

    it('leaves a layer put up since the change, and a screen that is gone', async () => {
        h.managers[0].screenBackgroundManager.backgroundSrc = {
            src: 'since.jpg',
        };
        await applyScreenControlRestore(
            genLayer(
                'background',
                { src: 'before.jpg' },
                toScreenLayerKey({ src: 'left.jpg' }),
            ),
        );
        await applyScreenControlRestore(
            genLayer('slide', { slideId: 1 }, '', 9),
        );
        expect(h.calls).toEqual([]);
        expect(h.managers[0].screenBackgroundManager.backgroundSrc).toEqual({
            src: 'since.jpg',
        });
    });

    it('is undone by its own snapshot, back to what the change left', async () => {
        const left = { slideId: 7 };
        h.managers[0].screenVaryAppDocumentManager.varySlideData = left;
        const restore = genLayer(
            'slide',
            { slideId: 2 },
            toScreenLayerKey(left),
        );
        const kept = await snapshotScreenControlRestore(restore);
        await applyScreenControlRestore(restore);
        expect(
            h.managers[0].screenVaryAppDocumentManager.varySlideData,
        ).toEqual({ slideId: 2 });
        await applyScreenControlRestore(kept);
        expect(
            h.managers[0].screenVaryAppDocumentManager.varySlideData,
        ).toEqual({ slideId: 7 });
    });
});

describe('a screen put back with no settings kept', () => {
    it('is added and given none', async () => {
        await applyScreenPresenceRestore({
            type: 'screen-presence',
            screenId: 4,
            present: true,
        });
        expect(h.calls).toEqual(['add 4']);
        expect(
            listLiveScreenManagers().map((screenManager) => {
                return screenManager.screenId;
            }),
        ).toEqual([0, 1, 4]);
    });

    it('is given only the settings it kept', async () => {
        await applyScreenPresenceRestore({
            type: 'screen-presence',
            screenId: 4,
            present: true,
            controls: {
                screenId: 4,
                values: { stage: 2, group: null },
            } as any,
        });
        expect(h.calls).toEqual(['add 4', 'stage 4 2']);
    });
});

describe('a screen with a layer it cannot transition', () => {
    it('reads that transition as none set, and writes none without a layer', async () => {
        h.managers[0].foregroundEffectManager = null;
        expect(captureScreenControls().screens[0].transitions).toEqual({
            'vary-app-document': 'fade',
            background: 'fade',
            foreground: null,
        });
        await writeScreenSetting('transition', h.managers[1], 'zoom');
        expect(h.calls).toEqual([]);
    });
});
