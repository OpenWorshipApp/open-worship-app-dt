import EventHandler from '../../event/EventHandler';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import type {
    PTEffectDataType,
    PTFEventType,
    ScreenMessageType,
    ScreenTransitionEffectType,
    StyleAnimType,
} from '../screenTypeHelpers';
import { transitionEffect } from '../screenTypeHelpers';
import { styleAnimList } from '../transitionEffectHelpers';
import type ScreenManagerBase from './ScreenManagerBase';

const cache = new Map<string, ScreenEffectManager>();
class ScreenEffectManager extends EventHandler<PTFEventType> {
    screenManagerBase: ScreenManagerBase;
    readonly target: string;
    private _effectType: ScreenTransitionEffectType;
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
            ? (effectType as ScreenTransitionEffectType)
            : 'fade';
        cache.set(this.toCacheKey(), this);
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

    get effectType(): ScreenTransitionEffectType {
        return this._effectType;
    }
    set effectType(value: ScreenTransitionEffectType) {
        this._effectType = value;
        setSetting(this.settingName, value);
        this.sendSyncScreen();
        this.addPropEvent('update');
    }
    get styleAnim() {
        return this.styleAnimList[this.effectType];
    }
    get duration() {
        return this.styleAnim.duration;
    }

    sendSyncScreen() {
        this.screenManagerBase.sendScreenMessage({
            screenId: this.screenId,
            type: 'effect',
            data: {
                target: this.target,
                effect: this.effectType,
            },
        });
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
        this.screenManagerBase =
            this.screenManagerBase.createScreenManagerBaseGhost(this.screenId);
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
