import EventHandler from '../../event/EventHandler';
import { DroppedDataType } from '../../helper/DragInf';
import { getWindowDim } from '../../helper/helpers';
import { setSetting } from '../../helper/settingHelpers';
import ScreenForegroundManager from './ScreenForegroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import ScreenBibleManager from './ScreenBibleManager';
import {
    getAllShowingScreenIds,
    hideScreen,
    setDisplay,
    showScreen,
} from '../screenHelpers';
import ScreenManagerInf from '../preview/ScreenManagerInf';
import ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';
import ColorNoteInf from '../../helper/ColorNoteInf';
import {
    getDisplayByScreenId,
    getDisplayIdByScreenId,
    SCREEN_MANAGER_SETTING_NAME,
} from './screenHelpers';
import appProvider from '../../server/appProvider';
import { showSimpleToast } from '../../toast/toastHelpers';
import { ScreenMessageType } from '../screenTypeHelpers';

export type ScreenManagerEventType =
    | 'instance'
    | 'update'
    | 'visible'
    | 'display-id'
    | 'refresh';

export default class ScreenManagerBase
    extends EventHandler<ScreenManagerEventType>
    implements ScreenManagerInf, ColorNoteInf
{
    static readonly eventNamePrefix: string = 'screen-m';
    readonly screenId: number;
    isDeleted: boolean;
    width = 1;
    height = 1;
    _isSelected: boolean = false;
    _isLocked: boolean = false;
    _stageNumber: number = 0;
    colorNote: string | null = null;
    private _isShowing: boolean;
    noSyncGroupMap: Map<string, boolean>;

    constructor(screenId: number) {
        super();
        this.screenId = screenId;
        this.isDeleted = false;
        this.noSyncGroupMap = new Map();
        const ids = getAllShowingScreenIds();
        this._isShowing = ids.some((id) => {
            return id === screenId;
        });
        this.updateDim();
    }
    get key() {
        return this.screenId.toString();
    }

    static idFromKey(key: string): number {
        const id = Number.parseInt(key, 10);
        if (Number.isNaN(id)) {
            throw new Error(`Invalid screen key: ${key}`);
        }
        return id;
    }

    get displayId() {
        return getDisplayIdByScreenId(this.screenId);
    }

    get display() {
        return getDisplayByScreenId(this.screenId);
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

    get stageNumber() {
        return this._stageNumber;
    }

    set stageNumber(stageNumber: number) {
        this._stageNumber = stageNumber;
    }

    get isShowing() {
        return this._isShowing;
    }

    checkIsLockedWithMessage() {
        if (this.isLocked) {
            showSimpleToast(
                'Screen Manager is locked',
                'Please unlock the screen manager to change the app document',
            );
            return true;
        }
        return false;
    }

    updateDim() {
        const display = this.display;
        const dim = appProvider.isPageScreen ? getWindowDim() : display.bounds;
        this.width = dim.width;
        this.height = dim.height;
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
        this.sendSyncScreen();
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
    }

    set isShowing(isShowing: boolean) {
        this._isShowing = isShowing;
        if (isShowing) {
            this.show();
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

    hide() {
        hideScreen(this.screenId);
    }

    fireUpdateEvent() {
        this.addPropEvent('update');
        ScreenManagerBase.fireUpdateEvent();
    }

    fireInstanceEvent() {
        this.addPropEvent('instance');
        ScreenManagerBase.fireInstanceEvent();
    }

    fireVisibleEvent() {
        this.addPropEvent('visible');
        ScreenManagerBase.fireVisibleEvent();
    }

    fireRefreshEvent() {
        this.addPropEvent('refresh');
        ScreenManagerBase.fireVisibleEvent();
    }

    static fireUpdateEvent() {
        this.addPropEvent('update');
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

    sendSyncScreen() {
        throw new Error('sendSyncScreen is not implemented.');
    }

    clear() {
        throw new Error('clear is not implemented.');
    }

    async delete() {
        throw new Error('delete is not implemented.');
    }

    receiveScreenDropped(_droppedData: DroppedDataType) {
        throw new Error('receiveScreenDropped is not implemented.');
    }

    sendScreenMessage(_message: ScreenMessageType, _isForce?: boolean) {
        throw new Error('sendScreenMessage is not implemented.');
    }

    createScreenManagerBaseGhost(_screenId: number): ScreenManagerBase {
        throw new Error('createScreenManagerGhost is not implemented.');
    }

    getScreenManagerBaseForce(_screenId: number): ScreenManagerBase {
        throw new Error('getScreenManagerForce is not implemented.');
    }
}
