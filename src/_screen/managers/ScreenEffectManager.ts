import EventHandler from '../../event/EventHandler';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { ScreenMessageType, PTEffectDataType } from '../screenHelpers';
import {
    ScreenTransitionEffectType,
    PTFEventType,
    styleAnimList,
    TargetType,
    transitionEffect,
} from '../transitionEffectHelpers';
import ScreenManagerBase from './ScreenManagerBase';

const cache = new Map<string, ScreenEffectManager>();
class ScreenEffectManager extends EventHandler<PTFEventType> {
    screenManagerBase: ScreenManagerBase;
    readonly target: TargetType;
    private _effectType: ScreenTransitionEffectType;
    constructor(screenManagerBase: ScreenManagerBase, target: TargetType) {
        super();
        this.screenManagerBase = screenManagerBase;
        this.target = target;
        const effectType = getSetting(this.settingName, '');
        this._effectType = Object.keys(transitionEffect).includes(effectType)
            ? (effectType as ScreenTransitionEffectType)
            : 'none';
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
        this.screenManagerBase.fireRefreshEvent();
    }
    get styleAnim() {
        return styleAnimList[this.effectType](this.target);
    }
    get style() {
        return this.styleAnim.style;
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
            } as PTEffectDataType,
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

    static getInstance(screenId: number, target: TargetType) {
        const instance = cache.get(`${screenId}-${target}`);
        if (instance === undefined) {
            throw new Error('instance is not found.');
        }
        return instance;
    }
}

export default ScreenEffectManager;
