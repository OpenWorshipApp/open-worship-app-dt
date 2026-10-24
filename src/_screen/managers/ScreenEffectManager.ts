import EventHandler from '../../event/EventHandler';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../../helper/settingHelpers';
import type {
    PTEffectDataType,
    PTFEventType,
    ScreenMessageType,
    StyleAnimType,
} from '../screenTypeHelpers';
import {
    styleAnimList,
    transitionEffect,
    type TransitionEffectType,
} from '../transitionEffectHelpers';
import type ScreenManagerBase from './ScreenManagerBase';

const cache = new Map<string, ScreenEffectManager>();

/**
 * Fired when a screen's transition for any layer is created, changed or
 * removed: what an override's checkbox says it falls back to
 * (`getCommonEffectType`) has to follow, and a panel restored open on
 * start-up asks before any screen exists.
 */
export const SCREEN_EFFECT_CHANGED_EVENT = 'screen-effect-changed';

function fireScreenEffectChanged() {
    EventHandler.addPropEvent(SCREEN_EFFECT_CHANGED_EVENT);
}
class ScreenEffectManager extends EventHandler<PTFEventType> {
    screenManagerBase: ScreenManagerBase;
    readonly target: string;
    private _effectType: TransitionEffectType;
    styleAnimList: Record<string, StyleAnimType>;

    constructor(screenManagerBase: ScreenManagerBase, target: string) {
        super();
        this.screenManagerBase = screenManagerBase;
        this.target = target;
        const effectType = getSetting(this.settingName) ?? '';
        this.styleAnimList = Object.fromEntries(
            Object.entries(styleAnimList).map(([key, value]) => {
                return [key, value(this.target)];
            }),
        );
        this._effectType = Object.keys(transitionEffect).includes(effectType)
            ? (effectType as TransitionEffectType)
            : 'fade';
        cache.set(this.toCacheKey(), this);
        fireScreenEffectChanged();
    }

    protected toCacheKey() {
        return `${this.screenId}-${this.target}`;
    }

    get screenId() {
        return this.screenManagerBase.screenId;
    }

    get settingName() {
        return `pt-effect-${this.screenId}-${this.target}`;
    }

    get effectType(): TransitionEffectType {
        return this._effectType;
    }
    set effectType(value: TransitionEffectType) {
        this._effectType = value;
        setSetting(this.settingName, value);
        this.sendSyncScreen();
        this.addPropEvent('update');
        fireScreenEffectChanged();
    }
    get styleAnim() {
        return this.styleAnimList[this.effectType];
    }
    get duration() {
        return this.styleAnim.duration;
    }

    sendSyncScreen() {
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                type: 'effect',
                data: {
                    target: this.target,
                    effect: this.effectType,
                },
            },
            false,
        );
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const data = message.data as PTEffectDataType;
        const effectManager = ScreenEffectManager.getInstance(
            message.screenId,
            data.target,
        );
        effectManager.effectType = data.effect;
    }

    delete() {
        cache.delete(this.toCacheKey());
        fireScreenEffectChanged();
        // This instance owns `pt-effect-<screenId>-<target>`, and screen ids are
        // reused, so the chosen transition has to go with the screen.
        removeSetting(this.settingName);
        this.screenManagerBase =
            this.screenManagerBase.createScreenManagerBaseGhost(this.screenId);
    }

    /**
     * The transition every screen uses for `target`, or `null` when the
     * screens do not agree (or there are none). An override's checkbox shows
     * this while unticked, as what the item will fall back to.
     */
    static getCommonEffectType(target: string): TransitionEffectType | null {
        let commonEffectType: TransitionEffectType | null = null;
        for (const instance of cache.values()) {
            if (instance.target !== target) {
                continue;
            }
            if (
                commonEffectType !== null &&
                commonEffectType !== instance.effectType
            ) {
                return null;
            }
            commonEffectType = instance.effectType;
        }
        return commonEffectType;
    }

    static getInstance(screenId: number, target: string) {
        const instance = cache.get(`${screenId}-${target}`);
        if (instance === undefined) {
            throw new Error('instance is not found.');
        }
        return instance;
    }
}

export default ScreenEffectManager;
