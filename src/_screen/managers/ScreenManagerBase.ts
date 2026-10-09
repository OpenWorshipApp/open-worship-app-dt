import { createElement } from 'react';

import EventHandler from '../../event/EventHandler';
import type { DroppedDataType } from '../../helper/DragInf';
import { getWindowDim } from '../../helper/helpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import ScreenForegroundManager from './ScreenForegroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import ScreenBibleManager from './ScreenBibleManager';
import {
    getAllShowingScreenIds,
    hideScreen,
    setDisplay,
    showScreen,
} from '../screenHelpers';
import type ScreenManagerInf from '../preview/ScreenManagerInf';
import ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';
import type ColorNoteInf from '../../helper/ColorNoteInf';
import {
    getDisplayByScreenId,
    getDisplayIdByScreenId,
    SCREEN_MANAGER_SETTING_NAME,
} from './screenHelpers';
import appProvider from '../../server/appProvider';
import { showSimpleToast } from '../../toast/toastHelpers';
import type {
    ScreenMessageType,
    ScreenShowPayloadType,
} from '../screenTypeHelpers';
import { tran } from '../../lang/langHelpers';
import { checkMediaPlaying } from '../../helper/mediaControlHelpers';
import { applyRemoteScrollPercentage } from './screenScrollSyncHelpers';
import { MIRROR_REMOTE_DISPLAY_FIRST } from '../../../electron/screenMirrorProtocol';
import { isVirtualDisplayId } from '../../../electron/virtualDisplayProtocol';
import ScreenLockedToastMessageComp from '../preview/ScreenLockedToastMessageComp';
import { getAllScreenManagerBases } from './screenManagerBaseHelpers';
import { rememberVirtualScreensShowing } from './virtualScreenShowingHelpers';

// Which screens are up on a virtual display, kept for the next start.
function rememberVirtualDisplayScreens() {
    rememberVirtualScreensShowing(
        getAllScreenManagerBases()
            .filter((screenManagerBase) => {
                return !screenManagerBase.isDeleted;
            })
            .map((screenManagerBase) => {
                return {
                    screenId: screenManagerBase.screenId,
                    isShowing: screenManagerBase.isShowing,
                };
            }),
    );
}

export type ScreenManagerEventType =
    | 'instance'
    | 'update'
    | 'visible'
    | 'display-id'
    | 'refresh'
    | 'scale'
    | 'color-note-update';

export default class ScreenManagerBase
    extends EventHandler<ScreenManagerEventType>
    implements ScreenManagerInf, ColorNoteInf
{
    static readonly eventNamePrefix: string = 'screen-m';
    readonly screenId: number;
    isDeleted: boolean;
    width = 1;
    height = 1;
    private isDimMeasured = false;
    _isSelected: boolean = false;
    _isLocked: boolean = false;
    _stage: number = 0;
    colorNote: string | null = null;
    private _isShowing: boolean;
    noSyncGroupMap: Map<string, boolean>;
    getElementsByDomSelector: (_domSelector: string) => HTMLElement[] =
        () => [];
    divRef: WeakRef<HTMLDivElement> | null = null;

    constructor(screenId: number, isInert = false) {
        super();
        this.screenId = screenId;
        this.isDeleted = false;
        this.noSyncGroupMap = new Map();
        if (isInert) {
            // ghost stand-in for a deleted screen: no IPC, no display lookup
            this._isShowing = false;
            return;
        }
        const ids = getAllShowingScreenIds();
        this._isShowing = ids.includes(screenId);
        this.updateDim();
    }
    get key() {
        return this.screenId.toString();
    }

    static idFromKey(key: string): number {
        const id = Number.parseInt(key, 10);
        if (Number.isNaN(id)) {
            throw new TypeError(`Invalid screen key: ${key}`);
        }
        return id;
    }

    get displayId() {
        return getDisplayIdByScreenId(this.screenId);
    }

    get display() {
        return getDisplayByScreenId(this.screenId);
    }

    // On a virtual display, the screen page plays the sound (it is what the
    // display streams). The screen page knows it from its context; the
    // presenter reads the stored choice first, so a screen on a real monitor
    // never pays for the display list.
    get isOnVirtualDisplay() {
        if (appProvider.isPageScreen) {
            return appProvider.screenUtils?.getContext()?.isSoundOwner === true;
        }
        const stored = Number.parseInt(
            getSetting(`${SCREEN_MANAGER_SETTING_NAME}-pid-${this.screenId}`) ??
                '',
        );
        // A deleted virtual display falls back to a real one.
        return isVirtualDisplayId(stored) && this.displayId === stored;
    }

    get isSelected() {
        return this._isSelected;
    }

    set isSelected(isSelected: boolean) {
        this._isSelected = isSelected;
    }

    get isLocked() {
        return appProvider.isPagePresenter && this._isLocked;
    }

    set isLocked(isLocked: boolean) {
        this._isLocked = isLocked;
    }

    async setIsLockedWithSyncGroup(isLocked: boolean) {
        this.isLocked = isLocked;
    }

    get stage() {
        return this._stage;
    }

    set stage(stage: number) {
        if (stage < 0) {
            throw new Error('Stage number cannot be negative');
        }
        this._stage = stage;
    }

    get isShowing() {
        return this._isShowing;
    }

    syncScrollPercentage(data: {
        domSelector: string;
        scroll: { x: number; y: number };
        isSubPixel?: boolean;
    }) {
        const { domSelector, scroll, isSubPixel } = data;
        const htmlElements = this.getElementsByDomSelector(domSelector);
        for (const element of htmlElements) {
            // Marked as remote-applied so the scroll events it sets off are
            // NOT re-broadcast (`registerScrollingSyncEvent`). The
            // focused/mouse-over guard on the send side is not enough: it is
            // true in the presenter whenever the operator is at it, and under
            // an attached DevTools/CDP session, and a re-broadcast echoes
            // between windows -- or between grouped mini screens -- forever.
            applyRemoteScrollPercentage(element, scroll, isSubPixel);
        }
    }

    checkIsMediaPlaying(isWithMessage = true) {
        const element = this.divRef?.deref();
        if (element === undefined) {
            return false;
        }
        // Refresh is a passive/system action (fired on resize, display change,
        // etc.), so guard silently — no toast to avoid spamming on repeated
        // fires.
        return checkMediaPlaying({
            targetElement: element,
            withMessage: isWithMessage,
            includeYouTube: true,
        });
    }

    // When the refusal was last SAID. One press reaches the check below from
    // every layer at once -- Clear All asks the background, slide, bible and
    // foreground managers in turn -- and each used to raise its own copy of
    // the same toast: four identical warnings stacked for one key. Shared by
    // every screen, because the same press is refused by each locked screen
    // too (a locked colour group refuses on all of them), and that stacked one
    // identical toast per screen. Every call is still refused; the message is
    // said once per burst.
    private static lockedMessageShownAt = 0;
    private static readonly lockedMessageGapMs = 1000;
    // The screens the current burst was refused by -- what its Unlock frees.
    // Replaced, not grown, by the next burst.
    private static lockedRefusedScreens = new Set<ScreenManagerBase>();

    checkIsLockedWithMessage() {
        if (!this.isLocked) {
            return false;
        }
        const now = Date.now();
        const elapsed = now - ScreenManagerBase.lockedMessageShownAt;
        // `elapsed >= 0`: a clock set back must not silence it until the
        // clock catches up again.
        if (elapsed >= 0 && elapsed < ScreenManagerBase.lockedMessageGapMs) {
            ScreenManagerBase.lockedRefusedScreens.add(this);
            return true;
        }
        ScreenManagerBase.lockedMessageShownAt = now;
        const refusedScreens = new Set<ScreenManagerBase>([this]);
        ScreenManagerBase.lockedRefusedScreens = refusedScreens;
        // Not "change the app document": a locked screen refuses a
        // background, a verse or a countdown just the same.
        showSimpleToast(
            tran('Screen Manager is locked'),
            createElement(ScreenLockedToastMessageComp, {
                onUnlock: () => {
                    for (const screenManagerBase of refusedScreens) {
                        void screenManagerBase.setIsLockedWithSyncGroup(false);
                    }
                },
            }),
        );
        return true;
    }

    updateDim() {
        const dim = appProvider.isPageScreen
            ? getWindowDim()
            : this.display.bounds;
        const isResized =
            this.isDimMeasured &&
            (dim.width !== this.width || dim.height !== this.height);
        this.isDimMeasured = true;
        this.width = dim.width;
        this.height = dim.height;
        // A display of the same shape but another size -- a guest's monitor
        // coming back in place of the 1920x1080 stand-in, or one 16:9 monitor
        // for another -- leaves the preview card's box as it was, so nothing
        // asks the previewer to rescale and it keeps the old pixel size around
        // content drawn at the new one. Never on the first measurement: the
        // static event handler is itself a `new ScreenManagerBase`, so firing
        // from the constructor recursed until the stack ran out.
        if (isResized) {
            this.fireScaleEvent();
        }
    }

    async getColorNote() {
        return this.colorNote;
    }

    async setColorNote(color: string | null) {
        this.colorNote = color;
        ScreenBackgroundManager.enableSyncGroup(this.screenId);
        ScreenVaryAppDocumentManager.enableSyncGroup(this.screenId);
        ScreenBibleManager.enableSyncGroup(this.screenId);
        ScreenForegroundManager.enableSyncGroup(this.screenId);
        this.sendSyncScreen(true);
    }

    checkIsSyncGroupEnabled(Class: { eventNamePrefix: string }) {
        const key = Class.eventNamePrefix;
        return !this.noSyncGroupMap.get(key);
    }

    set displayId(id: number) {
        setSetting(
            `${SCREEN_MANAGER_SETTING_NAME}-pid-${this.screenId}`,
            id.toString(),
        );
        if (this.isShowing) {
            setDisplay({
                screenId: this.screenId,
                displayId: id,
            });
        }
        const data = {
            screenId: this.screenId,
            displayId: id,
        };
        this.updateDim();
        this.addPropEvent('display-id', data);
        ScreenManagerBase.addPropEvent('display-id', data);
        this.fireRefreshEvent();
        // A showing screen moved onto or off a virtual display.
        rememberVirtualDisplayScreens();
    }

    set isShowing(isShowing: boolean) {
        this._isShowing = isShowing;
        if (isShowing) {
            this.showOrUndo();
        } else {
            this.hide();
        }
        this.fireVisibleEvent();
    }

    show() {
        return showScreen({
            screenId: this.screenId,
            displayId: this.displayId,
        });
    }

    // Counts show requests, so a refusal that comes back after a later show
    // (or a hide and a show) cannot switch that later one off.
    private showRequestCount = 0;

    // `show()` rejects when main cannot put the screen up at all -- above all a
    // Screen Mirror guest display that is not connected (`prepareOutput`
    // throws "Guest display is disconnected"). Left unhandled, that rejection
    // raised the app's "Reload is needed" dialog and left the toggle on with no
    // window behind it. Switch it back off and say why instead.
    private showOrUndo() {
        const requestCount = ++this.showRequestCount;
        const isRemoteDisplay = this.displayId <= MIRROR_REMOTE_DISPLAY_FIRST;
        const isVirtualDisplay = isVirtualDisplayId(this.displayId);
        Promise.resolve(this.show()).catch((error: unknown) => {
            if (requestCount !== this.showRequestCount || !this._isShowing) {
                return;
            }
            this._isShowing = false;
            // Drops anything main had started for it (a half-made mirror
            // output); a no-op when nothing was made.
            this.hide();
            this.fireVisibleEvent();
            showSimpleToast(
                tran('Screen not shown'),
                isRemoteDisplay
                    ? tran(
                          'Its Screen Mirror display is not connected. Connect that computer, or choose another display for this screen.',
                      )
                    : isVirtualDisplay
                      ? tran(
                            'Its virtual display is not available. Choose another display for this screen.',
                        )
                      : error instanceof Error
                        ? error.message
                        : String(error),
            );
        });
    }

    hide() {
        hideScreen(this.screenId);
    }

    fireUpdateEvent() {
        this.addPropEvent('update');
        ScreenManagerBase.fireUpdateEvent();
    }

    fireColorNoteUpdateEvent() {
        this.addPropEvent('color-note-update');
        ScreenManagerBase.fireColorNoteUpdateEvent();
    }

    fireInstanceEvent() {
        this.addPropEvent('instance');
        ScreenManagerBase.fireInstanceEvent();
    }

    fireVisibleEvent() {
        this.addPropEvent('visible');
        ScreenManagerBase.fireVisibleEvent();
        rememberVirtualDisplayScreens();
    }

    fireRefreshEvent() {
        this.addPropEvent('refresh');
        ScreenManagerBase.fireRefreshEvent();
    }

    fireScaleEvent() {
        this.addPropEvent('scale');
        ScreenManagerBase.fireScaleEvent();
    }

    static fireUpdateEvent() {
        this.addPropEvent('update');
    }

    static fireColorNoteUpdateEvent() {
        this.addPropEvent('color-note-update');
    }

    static fireInstanceEvent() {
        this.addPropEvent('instance');
    }

    static fireVisibleEvent() {
        this.addPropEvent('visible');
    }

    static fireRefreshEvent() {
        this.addPropEvent('refresh');
    }

    static fireScaleEvent() {
        this.addPropEvent('scale');
    }

    sendSyncScreen(_shouldFromOtherGroupMember = false) {
        throw new Error('sendSyncScreen is not implemented.');
    }

    // Screen Show: this screen's whole state, for a screen that shows it.
    // Only a full screen manager on the presenter has one to give.
    genScreenShowPayload(): ScreenShowPayloadType | null {
        return null;
    }

    // Screen Show: send this screen's window the whole state of each screen
    // it shows. Only the presenter sends.
    sendScreenShowSnapshots(_sourceScreenIds: number[]) {}

    clear() {
        throw new Error('clear is not implemented.');
    }

    async delete() {
        throw new Error('delete is not implemented.');
    }

    receiveScreenDropped(_droppedData: DroppedDataType): Promise<void> {
        throw new Error('receiveScreenDropped is not implemented.');
    }

    sendScreenMessage(_message: ScreenMessageType, _isForce: boolean) {
        throw new Error('sendScreenMessage is not implemented.');
    }

    createScreenManagerBaseGhost(_screenId: number): ScreenManagerBase {
        throw new Error('createScreenManagerGhost is not implemented.');
    }

    getScreenManagerBaseForce(_screenId: number): ScreenManagerBase {
        throw new Error('getScreenManagerForce is not implemented.');
    }
}

// Inert stand-in assigned to sub-managers when their screen is deleted.
// Deliberately NOT a full ScreenManager: constructing one would re-register a
// whole family of sub-managers into the module caches under the deleted
// screenId (a permanent leak) and make deleted screens look alive again.
export class ScreenManagerBaseGhost extends ScreenManagerBase {
    constructor(screenId: number) {
        super(screenId, true);
        this.isDeleted = true;
    }

    override sendSyncScreen() {}

    override clear() {}

    override async delete() {}

    override async receiveScreenDropped(_droppedData: DroppedDataType) {}

    override sendScreenMessage(
        _message: ScreenMessageType,
        _isForce: boolean,
    ) {}

    override createScreenManagerBaseGhost(screenId: number): ScreenManagerBase {
        return new ScreenManagerBaseGhost(screenId);
    }

    override getScreenManagerBaseForce(screenId: number): ScreenManagerBase {
        return new ScreenManagerBaseGhost(screenId);
    }
}
