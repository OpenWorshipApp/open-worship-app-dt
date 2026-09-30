import { showSimpleToast } from '../../toast/toastHelpers';
import appProvider from '../../server/appProvider';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../../helper/settingHelpers';
import ScreenEventHandler from './ScreenEventHandler';
import { type GroupMembershipInf } from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type {
    BasicScreenMessageType,
    ScreenMessageType,
    MaskDataType,
} from '../screenTypeHelpers';
import { clampNumber } from './screenOverlayHelpers';

export type ScreenMaskEventType = 'update';

// Blanking ("Mask"): solid bars over the edges of the projector's picture, so
// the output stops short of an organ pipe, a window frame or the bottom of a
// screen that only comes half way down.
//
// It is DOM and it is static: four plain divs sized in percentages, no canvas,
// no timer, no animation, nothing that repaints once painted. That is the whole
// point of it on the low-spec target -- a mask is up for the entire service, so
// anything with a per-frame cost would be paid for hours.
//
// Percentages rather than pixels because the data outlives the display: the
// same mask is right when the projector is swapped for one with a different
// native resolution, and it lands identically on the CSS-scaled mini preview
// and the unscaled output window without a conversion step.

const MASK_SETTING_PREFIX = 'screen-mask-';
export const DEFAULT_MASK_COLOR = '#000000';
export const MASK_INSET_MIN = 0;
// Not 100: four insets that each cover the whole screen is a projector turned
// off in an expensive way, and an operator who has done it by accident has no
// picture left to see the handles on.
export const MASK_INSET_MAX = 45;

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

// The colour arrives from an `<input type="color">`, from disk, or off the
// wire, and goes straight into a style string. Anything that is not exactly
// `#rrggbb` falls back rather than producing an unparseable value -- which
// would paint NOTHING, i.e. an unmasked screen mid-service.
function toValidColor(color: unknown) {
    return typeof color === 'string' && HEX_COLOR_REGEX.test(color)
        ? color.toLowerCase()
        : DEFAULT_MASK_COLOR;
}

function toValidInset(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return MASK_INSET_MIN;
    }
    return clampNumber(value, MASK_INSET_MIN, MASK_INSET_MAX);
}

export function toValidMaskData(data: any): MaskDataType {
    return {
        topPercentage: toValidInset(data?.topPercentage),
        rightPercentage: toValidInset(data?.rightPercentage),
        bottomPercentage: toValidInset(data?.bottomPercentage),
        leftPercentage: toValidInset(data?.leftPercentage),
        color: toValidColor(data?.color),
    };
}

export default class ScreenMaskManager
    extends ScreenEventHandler<ScreenMaskEventType>
    implements GroupMembershipInf
{
    static readonly eventNamePrefix: string = 'screen-mask-m';
    private _div: HTMLDivElement | null = null;
    maskData: MaskDataType;

    constructor(screenManagerBase: ScreenManagerBase) {
        super(screenManagerBase);
        this.maskData = this.readPersisted();
    }

    private get settingKey() {
        return `${MASK_SETTING_PREFIX}${this.key}`;
    }

    private readPersisted(): MaskDataType {
        const raw = getSetting(this.settingKey);
        if (!raw) {
            return toValidMaskData(null);
        }
        try {
            return toValidMaskData(JSON.parse(raw));
        } catch (_error) {
            // A hand-edited or truncated value is not worth a toast at start-up
            // -- an unmasked screen is the safe reading of a broken mask.
            return toValidMaskData(null);
        }
    }

    /**
     * Whether anything is actually covered. `Clear All` deliberately does NOT
     * call this manager, so this is read only by the panel and by anything
     * reporting what a screen holds -- never to decide a clear.
     */
    get isShowing() {
        const {
            topPercentage,
            rightPercentage,
            bottomPercentage,
            leftPercentage,
        } = this.maskData;
        return (
            topPercentage > 0 ||
            rightPercentage > 0 ||
            bottomPercentage > 0 ||
            leftPercentage > 0
        );
    }

    get div(): HTMLDivElement | null {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        if (this._div === div) {
            return;
        }
        this._div = div;
        this.render();
    }

    setMaskData(data: MaskDataType, isNoSyncGroup = false) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        this.maskData = toValidMaskData(data);
        this.render();
        setSetting(this.settingKey, JSON.stringify(this.maskData));
        if (!isNoSyncGroup) {
            ScreenMaskManager.enableSyncGroup(this.screenId);
        }
        this.fireUpdateEvent();
        this.sendSyncScreen();
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'mask',
            data: this.maskData,
        };
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenMaskManager.fireUpdateEvent();
    }

    receiveSyncScreen(message: ScreenMessageType) {
        // Cloned through the validator rather than kept by reference:
        // sync-group members share the same message object in-process, so
        // holding it would let one screen's next edit mutate another's mask
        // (see the foreground-sync-shared-refs note).
        this.maskData = toValidMaskData(message.data);
        this.render();
        setSetting(this.settingKey, JSON.stringify(this.maskData));
        this.fireUpdateEvent();
    }

    render() {
        const div = this._div;
        if (div === null) {
            return;
        }
        const { width, height } = this.screenManagerBase;
        Object.assign(div.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: `${width}px`,
            height: `${height}px`,
            overflow: 'hidden',
            // ABOVE EVERYTHING. Being last in the DOM is not enough: a
            // foreground overlay carries its own "Always on Top" number
            // (`zIndex` in its `extraStyle`, 7 by default), and `#foreground`
            // makes no stacking context, so that number competes directly with
            // this layer in the root. Measured: a full-screen Video Show at 7
            // painted straight over the blanking bars, which is a mask that
            // silently stops masking the moment an overlay goes up -- the one
            // failure this layer must not have.
            //
            // It does NOT break foreground blending. That rule is about
            // `#foreground` itself: a `z-index` THERE would cut its children
            // off from the background they blend with. This is a sibling, and
            // what it changes is only what paints over it.
            zIndex: '2147483000',
            // The mask must never swallow a click: the output window carries a
            // close button and the mini preview is dragged and dropped onto.
            pointerEvents: 'none',
        });
        const {
            topPercentage,
            rightPercentage,
            bottomPercentage,
            leftPercentage,
            color,
        } = this.maskData;
        const barList: [string, Record<string, string>][] = [
            [
                'top',
                {
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: `${topPercentage}%`,
                },
            ],
            [
                'bottom',
                {
                    bottom: '0',
                    left: '0',
                    width: '100%',
                    height: `${bottomPercentage}%`,
                },
            ],
            [
                'left',
                {
                    top: '0',
                    left: '0',
                    width: `${leftPercentage}%`,
                    height: '100%',
                },
            ],
            [
                'right',
                {
                    top: '0',
                    right: '0',
                    width: `${rightPercentage}%`,
                    height: '100%',
                },
            ],
        ];
        // Rebuilt rather than diffed: this runs when the mask is EDITED and on
        // a screen resize, never per frame, and four divs is less code than a
        // reconciler that would have to be read and trusted mid-service.
        div.replaceChildren(
            ...barList.map(([_name, boxStyle]) => {
                const bar = document.createElement('div');
                Object.assign(bar.style, {
                    position: 'absolute',
                    backgroundColor: color,
                    ...boxStyle,
                });
                return bar;
            }),
        );
    }

    // Overwritten per-screen by setGroupMembershipInf in the ScreenManager
    // constructor; the stubs keep the class structurally a GroupMembershipInf.
    async getMemberInstances(): Promise<ScreenMaskManager[]> {
        return [];
    }
    async getMemberIds(): Promise<number[]> {
        return [];
    }
    async checkIsMainInstance(): Promise<boolean> {
        return false;
    }

    /**
     * DELIBERATELY A NO-OP, and the one place in this class where that is the
     * feature rather than an omission.
     *
     * `clear()` is the layer-clearing verb every other screen layer implements,
     * and it is what a generic "clear this screen" sweep calls. A mask is not
     * content: it is the shape of the ROOM, measured once so the picture stops
     * short of an organ pipe or the bottom of a half-lowered screen. Wiping it
     * with the content would hand an operator who just pressed the panic key a
     * picture spilling onto the wall, mid-service, with a mask to re-measure.
     *
     * So the mask comes off through `clearMask()` -- its panel's own button --
     * and through nothing else. `ScreenManager.clear()` also does not call this
     * at all; the no-op is the second lock on the same door.
     */
    clear() {}

    /**
     * Take the mask off entirely: the panel's own Remove button, and nothing
     * else. See `clear()` above for why this is not that.
     */
    clearMask() {
        this.setMaskData(toValidMaskData(null));
    }

    delete() {
        if (appProvider.isPagePresenter) {
            // The screen id is handed straight back out to the next screen
            // created, so leaving this behind would give that screen this
            // room's mask.
            removeSetting(this.settingKey);
        }
        this.maskData = toValidMaskData(null);
        this._div = null;
        super.delete();
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenMaskManager = this.getInstance(screenId);
        if (screenMaskManager === null) {
            // English on purpose: this receiver also runs in the screen window,
            // where a `tran()` before the language data has loaded throws in
            // dev (see `ScreenCloseButtonComp`).
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenMaskManager.receiveSyncScreen(message);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenMaskManager>(screenId);
    }
}
