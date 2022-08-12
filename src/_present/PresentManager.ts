import EventHandler from '../event/EventHandler';
import { getWindowDim } from '../helper/helpers';
import { getSetting, setSetting } from '../helper/settingHelper';
import { showAppContextMenu } from '../others/AppContextMenu';
import PresentBGManager from './PresentBGManager';
import { getAllDisplays, getAllShowingPresentIds, hidePresent, PresentMessageType, setDisplay, showPresent } from './presentHelpers';
import PresentSlideManager from './PresentSlideManager';
import PresentTransitionEffect from './transition-effect/PresentTransitionEffect';

export type PresentManagerEventType = 'instance' | 'update'
    | 'visible' | 'display-id' | 'resize';
const settingName = 'present-display-';

export default class PresentManager extends EventHandler<PresentManagerEventType> {
    static eventNamePrefix: string = 'present-m';
    readonly presentBGManager: PresentBGManager;
    readonly presentSlideManager: PresentSlideManager;
    readonly presentId: number;
    width: number;
    height: number;
    name: string;
    _isSelected: boolean = false;
    private _isShowing: boolean;
    static readonly _cache = new Map<string, PresentManager>();
    constructor(presentId: number) {
        super();
        const dim = getWindowDim();
        this.width = dim.width;
        this.height = dim.height;
        this.presentId = presentId;
        this.name = `present-${presentId}`;
        this.presentBGManager = new PresentBGManager(presentId);
        this.presentSlideManager = new PresentSlideManager(presentId);
        const ids = getAllShowingPresentIds();
        this._isShowing = ids.some((id) => id === presentId);
    }
    get key() {
        return this.presentId.toString();
    }
    get displayId() {
        const defaultDisplay = PresentManager.getDefaultPresentDisplay();
        const str = getSetting(`${settingName}-pid-${this.presentId}`,
            defaultDisplay.id.toString());
        if (isNaN(+str)) {
            return defaultDisplay.id;
        }
        const id = +str;
        const { displays } = getAllDisplays();
        return displays.find((display) => {
            return display.id === id;
        })?.id || defaultDisplay.id;
    }
    set displayId(id: number) {
        setSetting(`${settingName}-pid-${this.presentId}`, id.toString());
        if (this.isShowing) {
            setDisplay({
                presentId: this.presentId,
                displayId: id,
            });
        }
        const data = {
            presentId: this.presentId,
            displayId: id,
        };
        this.addPropEvent('display-id', data);
        PresentManager.addPropEvent('display-id', data);
    }
    get isSelected() {
        return this._isSelected;
    }
    set isSelected(isSelected: boolean) {
        this._isSelected = isSelected;
        this.fireInstanceEvent();
    }
    get isShowing() {
        return this._isShowing;
    }
    set isShowing(isShowing: boolean) {
        this._isShowing = isShowing;
        if (isShowing) {
            this.show().then(() => {
                PresentTransitionEffect.sendSyncPresent();
                this.presentBGManager.sendSyncPresent();
                this.presentSlideManager.sendSyncPresent();
            });
        } else {
            this.hide();
        }
        this.fireVisibleEvent();
    }
    show() {
        return showPresent({
            presentId: this.presentId,
            displayId: this.displayId,
        });
    }
    hide() {
        hidePresent(this.presentId);
    }
    static getDefaultPresentDisplay() {
        const { primaryDisplay, displays } = getAllDisplays();
        return displays.find((display) => {
            return display.id !== primaryDisplay.id;
        }) || primaryDisplay;
    }
    fireUpdateEvent() {
        this.addPropEvent('update');
        PresentManager.fireUpdateEvent();
    }
    static fireUpdateEvent() {
        this.addPropEvent('update');
    }
    fireInstanceEvent() {
        this.addPropEvent('instance');
        PresentManager.fireInstanceEvent();
    }
    static fireInstanceEvent() {
        this.addPropEvent('instance');
    }
    fireVisibleEvent() {
        this.addPropEvent('visible');
        PresentManager.fireVisibleEvent();
    }
    static fireVisibleEvent() {
        this.addPropEvent('visible');
    }
    fireResizeEvent() {
        this.addPropEvent('resize');
        PresentManager.fireVisibleEvent();
    }
    static fireResizeEvent() {
        this.addPropEvent('resize');
    }
    delete() {
        this.hide();
        this.presentBGManager.bgSrc = null;
        PresentManager._cache.delete(this.key);
        this.fireInstanceEvent();
    }
    static getInstanceByKey(key: string) {
        return this.getInstance(+key);
    }
    static getAllInstances() {
        const cachedInstances = Array.from(this._cache.values());
        if (cachedInstances.length > 0) {
            return cachedInstances;
        }
        return getAllShowingPresentIds().map((presentId) => {
            return this.getInstance(presentId);
        });
    }
    static getInstance(presentId: number) {
        const key = presentId.toString();
        if (!this._cache.has(key)) {
            const presentManager = new PresentManager(presentId);
            this._cache.set(key, presentManager);
        }
        return this._cache.get(key) as PresentManager;
    }
    static getSelectedInstances() {
        return Array.from(this._cache.values())
            .filter((presentManager) => {
                return presentManager.isSelected;
            });
    }
    static contextChooseInstances(e: React.MouseEvent<HTMLElement, MouseEvent>) {
        return new Promise<PresentManager[]>((resolve) => {
            const selectedPresentManagers = this.getSelectedInstances();
            if (selectedPresentManagers.length > 0) {
                return resolve(selectedPresentManagers);
            }
            const allPresentManagers = PresentManager.getAllInstances();
            showAppContextMenu(e, allPresentManagers.map((presentManager) => {
                return {
                    title: presentManager.name,
                    onClick: () => {
                        resolve([presentManager]);
                    },
                };
            })).then(() => resolve([]));
        });
    }
    static receiveSyncPresent(message: PresentMessageType) {
        const { type, data, presentId } = message;
        const presentManager = PresentManager.getInstance(presentId);
        if (type === 'background') {
            PresentBGManager.receiveSyncPresent(message);
        } else if (type === 'slide') {
            PresentSlideManager.receiveSyncPresent(message);
        } else if (type === 'visible') {
            presentManager.isShowing = data?.isShowing;
        } else {
            console.log(message);
        }
    }
}
