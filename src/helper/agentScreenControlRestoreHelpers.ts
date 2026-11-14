/**
 * A screen's controls and its background and slide layers, read and written
 * the way its Mini Screen card does it -- for `owa_screen_edit`
 * (`agentScreenControlHelpers.ts`), which reads them before and after a
 * change to back it up, and for an undo, which puts back what that change
 * did (`screen-setting` and `screen-layer` restores,
 * `agentBackupPlanHelpers.ts`). Every write goes through the managers' own
 * setters, so the screens redraw, the setting is saved and the card follows.
 *
 * Imported lazily, by `agentBackupHelpers.ts` and the screen worker: it
 * pulls in the screen managers.
 */
import {
    addScreenManager,
    getAllScreenManagers,
} from '../_screen/managers/screenManagerHelpers';
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import type ScreenManager from '../_screen/managers/ScreenManager';
import type ScreenEffectManager from '../_screen/managers/ScreenEffectManager';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import type { VarySlideScreenDataType } from '../_screen/screenAppDocumentTypeHelpers';
import {
    AGENT_SCREEN_SETTING_FIELD_LIST,
    type AgentRestoreType,
    type AgentScreenControlStateType,
    type AgentScreenControlsType,
    type AgentScreenLayerStateType,
    type AgentScreenSettingFieldType,
    toScreenLayerKey,
} from './agentBackupPlanHelpers';
import type { AnyObjectType } from './typeHelpers';

export type ScreenControlRestoreType = Extract<
    AgentRestoreType,
    { type: 'screen-setting' | 'screen-layer' }
>;

export type ScreenPresenceRestoreType = Extract<
    AgentRestoreType,
    { type: 'screen-presence' }
>;

/** The effect managers' own names for the three layers a card transitions. */
export const SCREEN_EFFECT_TARGET_LIST = [
    'vary-app-document',
    'background',
    'foreground',
] as const;

export function listLiveScreenManagers() {
    return getAllScreenManagers()
        .filter((screenManager) => {
            return !screenManager.isDeleted;
        })
        .sort((one, other) => {
            return one.screenId - other.screenId;
        });
}

function findLiveScreenManager(screenId: number | undefined) {
    if (screenId === undefined) {
        return null;
    }
    return (
        listLiveScreenManagers().find((screenManager) => {
            return screenManager.screenId === screenId;
        }) ?? null
    );
}

export function toEffectManager(
    screenManager: ScreenManager,
    target: string,
): ScreenEffectManager | null {
    if (target === 'background') {
        return screenManager.backgroundEffectManager;
    }
    if (target === 'vary-app-document') {
        return screenManager.varyAppDocumentEffectManager;
    }
    if (target === 'foreground') {
        return screenManager.foregroundEffectManager;
    }
    return null;
}

function toJson(value: unknown): unknown {
    return value === null || value === undefined
        ? null
        : JSON.parse(JSON.stringify(value));
}

function readDisplayId(screenManager: ScreenManager) {
    try {
        return screenManager.displayId;
    } catch {
        return null;
    }
}

type ScreenValueFieldType = Exclude<
    AgentScreenSettingFieldType,
    'transition' | 'style'
>;

const SCREEN_VALUE_READER_MAP: Record<
    ScreenValueFieldType,
    (screenManager: ScreenManager) => unknown
> = {
    group: (screenManager) => {
        return screenManager.colorNote ?? null;
    },
    display: readDisplayId,
    stage: (screenManager) => {
        return screenManager.stage;
    },
    'line-sync': (screenManager) => {
        return screenManager.screenLongTextManager.isLineSync;
    },
    selected: (screenManager) => {
        return screenManager.isSelected;
    },
    showing: (screenManager) => {
        return screenManager.isShowing;
    },
    lock: (screenManager) => {
        return screenManager.isLocked;
    },
};

/** One screen's controls now: what `diffScreenSettings` compares. */
export function readScreenControlState(
    screenManager: ScreenManager,
): AgentScreenControlStateType {
    const values: AgentScreenControlStateType['values'] = {};
    for (const [field, read] of Object.entries(SCREEN_VALUE_READER_MAP)) {
        values[field as ScreenValueFieldType] = read(screenManager);
    }
    const transitions: Record<string, unknown> = {};
    for (const target of SCREEN_EFFECT_TARGET_LIST) {
        transitions[target] =
            toEffectManager(screenManager, target)?.effectType ?? null;
    }
    return { screenId: screenManager.screenId, values, transitions };
}

/** Every live screen's controls and the shared Bible text style, now. */
export function captureScreenControls(): AgentScreenControlsType {
    return {
        style: toJson(ScreenLongTextManager.textStyle),
        screens: listLiveScreenManagers().map(readScreenControlState),
    };
}

/** Every live screen's background and slide layers, now, as JSON. */
export function captureScreenLayers(): AgentScreenLayerStateType[] {
    return listLiveScreenManagers().map((screenManager) => {
        return {
            screenId: screenManager.screenId,
            background: toJson(
                screenManager.screenBackgroundManager.backgroundSrc,
            ),
            slide: toJson(
                screenManager.screenVaryAppDocumentManager.varySlideData,
            ),
        };
    });
}

function readScreenSetting(
    restore: Extract<ScreenControlRestoreType, { type: 'screen-setting' }>,
): unknown {
    if (restore.field === 'style') {
        return toJson(ScreenLongTextManager.textStyle);
    }
    const screenManager = findLiveScreenManager(restore.screenId);
    if (screenManager === null) {
        return restore.value;
    }
    if (restore.field === 'transition') {
        return (
            toEffectManager(screenManager, restore.target ?? '')?.effectType ??
            restore.value
        );
    }
    return SCREEN_VALUE_READER_MAP[restore.field](screenManager);
}

/**
 * One control put as `value`, through the setter its card presses. A screen
 * that is gone has nothing to put back.
 */
export async function writeScreenSetting(
    field: AgentScreenSettingFieldType,
    screenManager: ScreenManager | null,
    value: unknown,
    target?: string,
) {
    if (field === 'style') {
        if (typeof value === 'object' && value !== null) {
            ScreenLongTextManager.textStyle = toJson(value) as AnyObjectType;
            ScreenLongTextManager.sendSynTextStyle();
        }
        return;
    }
    if (screenManager === null) {
        return;
    }
    if (field === 'group') {
        await screenManager.setColorNote(
            typeof value === 'string' && value !== '' ? value : null,
        );
    } else if (field === 'display') {
        if (typeof value === 'number' && Number.isFinite(value)) {
            screenManager.displayId = value;
        }
    } else if (field === 'stage') {
        if (typeof value === 'number' && value >= 0) {
            screenManager.stage = value;
        }
    } else if (field === 'transition') {
        const effectManager = toEffectManager(screenManager, target ?? '');
        if (effectManager !== null && typeof value === 'string') {
            effectManager.effectType = value as TransitionEffectType;
        }
    } else if (field === 'line-sync') {
        screenManager.screenLongTextManager.isLineSync = value === true;
    } else if (field === 'selected') {
        screenManager.isSelected = value === true;
    } else if (field === 'showing') {
        if (screenManager.isShowing !== (value === true)) {
            screenManager.isShowing = value === true;
        }
    } else if (field === 'lock') {
        screenManager.isLocked = value === true;
    }
}

async function writeScreenLayer(
    screenManager: ScreenManager,
    layer: 'background' | 'slide',
    data: unknown,
) {
    if (layer === 'background') {
        screenManager.screenBackgroundManager.applyBackgroundSrcWithSyncGroup(
            toJson(data) as BackgroundSrcType | null,
        );
        return;
    }
    await screenManager.screenVaryAppDocumentManager.applySlideSrcWithSyncGroup(
        toJson(data) as VarySlideScreenDataType | null,
    );
}

function readScreenLayer(
    screenManager: ScreenManager | null,
    layer: 'background' | 'slide',
) {
    if (screenManager === null) {
        return null;
    }
    return toJson(
        layer === 'background'
            ? screenManager.screenBackgroundManager.backgroundSrc
            : screenManager.screenVaryAppDocumentManager.varySlideData,
    );
}

/** What the restore's control or layer holds now: an undo's own backup. */
export async function snapshotScreenControlRestore(
    restore: ScreenControlRestoreType,
): Promise<ScreenControlRestoreType> {
    if (restore.type === 'screen-setting') {
        return { ...restore, value: readScreenSetting(restore) };
    }
    return {
        ...restore,
        data: readScreenLayer(
            findLiveScreenManager(restore.screenId),
            restore.layer,
        ),
        // Put back only over what this undo leaves there.
        expect: toScreenLayerKey(restore.data),
    };
}

/**
 * The control or layer as it was. A layer is put back only while it holds
 * what the change left there: a background or slide put up since stays.
 */
export async function applyScreenControlRestore(
    restore: ScreenControlRestoreType,
) {
    const screenManager = findLiveScreenManager(restore.screenId);
    if (restore.type === 'screen-setting') {
        await writeScreenSetting(
            restore.field,
            screenManager,
            restore.value,
            restore.target,
        );
        return;
    }
    if (screenManager === null) {
        return;
    }
    if (
        toScreenLayerKey(readScreenLayer(screenManager, restore.layer)) !==
        restore.expect
    ) {
        return;
    }
    await writeScreenLayer(screenManager, restore.layer, restore.data);
}

// --- a screen added, or put back (`screen-presence`) -----------------------

/**
 * What an undo of a `screen-presence` restore leaves for its own undo: a
 * screen it takes away comes back with its card's settings as they are now,
 * and a screen it puts back goes again. Nothing when the undo does nothing:
 * the screen is gone already, or there already.
 */
export function snapshotScreenPresenceRestore(
    restore: ScreenPresenceRestoreType,
): ScreenPresenceRestoreType[] {
    const screenManager = findLiveScreenManager(restore.screenId);
    if (restore.present) {
        return screenManager === null
            ? [
                  {
                      type: 'screen-presence',
                      screenId: restore.screenId,
                      present: false,
                  },
              ]
            : [];
    }
    return screenManager === null
        ? []
        : [
              {
                  type: 'screen-presence',
                  screenId: restore.screenId,
                  present: true,
                  controls: readScreenControlState(screenManager),
              },
          ];
}

type PutBackFieldType = Exclude<
    AgentScreenSettingFieldType,
    'showing' | 'lock' | 'style'
>;

// What a screen put back is given of its card's settings, in the order an
// undo writes them: never on and never locked -- a screen is taken away only
// while it is neither -- and the Bible text style is every screen's.
const PUT_BACK_FIELD_LIST = AGENT_SCREEN_SETTING_FIELD_LIST.filter(
    (field): field is PutBackFieldType => {
        return field !== 'showing' && field !== 'lock' && field !== 'style';
    },
);

/**
 * A screen the change added, taken away again -- the undo was refused
 * already, before anything, when it is on, locked or holds anything
 * (`checkScreenRestores`) -- or one an undo took away, put back with its
 * card's settings through the setters its card presses.
 */
export async function applyScreenPresenceRestore(
    restore: ScreenPresenceRestoreType,
) {
    const screenManager = findLiveScreenManager(restore.screenId);
    if (!restore.present) {
        if (screenManager !== null) {
            await screenManager.delete();
        }
        return;
    }
    if (screenManager !== null) {
        return;
    }
    const addedManager = addScreenManager(restore.screenId);
    const controls = restore.controls;
    if (controls === undefined) {
        return;
    }
    for (const field of PUT_BACK_FIELD_LIST) {
        if (field === 'transition') {
            for (const [target, value] of Object.entries(
                controls.transitions ?? {},
            )) {
                if (value !== null && value !== undefined) {
                    await writeScreenSetting(
                        field,
                        addedManager,
                        value,
                        target,
                    );
                }
            }
            continue;
        }
        const value = controls.values?.[field];
        if (value !== null && value !== undefined) {
            await writeScreenSetting(field, addedManager, value);
        }
    }
}
