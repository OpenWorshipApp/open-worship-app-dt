import BibleItem from '../bible-list/BibleItem';
import EventHandler from '../event/EventHandler';
import { AnyObjectType } from '../helper/helpers';
import { getSetting, setSetting } from '../helper/settingHelper';
import appProviderPresent from './appProviderPresent';
import fullTextPresentHelper, { RenderedType } from './fullTextPresentHelper';
import { sendPresentMessage } from './presentEventHelpers';
import { PresentMessageType } from './presentHelpers';
import PresentManager from './PresentManager';

export type FTItemDataType = {
    ftFilePath: string;
    id: number,
    renderedList: RenderedType[],
    scroll: number,
};
export type FTListType = {
    [key: string]: FTItemDataType;
};

export type PresentFTManagerEventType = 'update';

const settingName = 'present-ft-';
export default class PresentFTManager extends EventHandler<PresentFTManagerEventType> {
    static eventNamePrefix: string = 'present-ft-m';
    readonly presentId: number;
    private _ftItemData: FTItemDataType | null = null;
    private _div: HTMLDivElement | null = null;
    private _syncScrollTimeout: any = null;
    private _divScrollListener;
    constructor(presentId: number) {
        super();
        this.presentId = presentId;
        if (appProviderPresent.isMain) {
            const allFTList = PresentFTManager.getFTList();
            this._ftItemData = allFTList[this.key] || null;
        }
        this._divScrollListener = () => {
            if (this.div === null) {
                return;
            }
            this.scroll = this.div.scrollTop / this.div.scrollHeight;
            this.sendSyncScroll();
        };
    }
    get div() {
        return this._div;
    }
    set div(div: HTMLDivElement | null) {
        this._div = div;
        this.registerScrollListener();
        this.render();
    }
    get presentManager() {
        return PresentManager.getInstance(this.presentId);
    }
    get key() {
        return this.presentId.toString();
    }
    get ftItemData() {
        return this._ftItemData;
    }
    set ftItemData(ftItemData: FTItemDataType | null) {
        this._ftItemData = ftItemData;
        this.render();
        const allFTList = PresentFTManager.getFTList();
        if (ftItemData === null) {
            delete allFTList[this.key];
        } else {
            allFTList[this.key] = ftItemData;
        }
        PresentFTManager.setFTList(allFTList);
        this.sendSyncPresent();
        this.fireUpdate();
    }
    get scroll() {
        return this.ftItemData?.scroll || 0;
    }
    set scroll(scroll: number) {
        if (this._ftItemData !== null) {
            this._ftItemData.scroll = scroll;
            if (!appProviderPresent.isPresent) {
                const allFTList = PresentFTManager.getFTList();
                allFTList[this.key] = this._ftItemData;
                PresentFTManager.setFTList(allFTList);
            }
        }
    }
    registerScrollListener() {
        this.div?.addEventListener('scroll', this._divScrollListener);
    }
    unregisterScrollListener() {
        this.div?.removeEventListener('scroll', this._divScrollListener);
    }
    sendSyncScroll() {
        sendPresentMessage({
            presentId: this.presentId,
            type: 'full-text-scroll',
            data: {
                scroll: this.scroll,
            },
        }, true);
    }
    static receiveSyncScroll(message: PresentMessageType) {
        const { data, presentId } = message;
        const presentManager = PresentManager.getInstance(presentId);
        const { presentFTManager } = presentManager;
        if (presentFTManager._syncScrollTimeout !== null) {
            clearTimeout(presentFTManager._syncScrollTimeout);
        }
        presentFTManager.unregisterScrollListener();
        presentFTManager._syncScrollTimeout = setTimeout(() => {
            presentFTManager._syncScrollTimeout = null;
            presentFTManager.registerScrollListener();
        }, 1e3);
        presentFTManager.scroll = data.scroll;
        presentFTManager.renderScroll();
    }
    sendSyncPresent() {
        sendPresentMessage({
            presentId: this.presentId,
            type: 'full-text',
            data: this.ftItemData,
        });
    }
    static receiveSyncPresent(message: PresentMessageType) {
        const { data, presentId } = message;
        const presentManager = PresentManager.getInstance(presentId);
        presentManager.presentFTManager.ftItemData = data;
    }
    fireUpdate() {
        this.addPropEvent('update');
        PresentFTManager.fireUpdateEvent();
    }
    static fireUpdateEvent() {
        this.addPropEvent('update');
    }
    static getFTList(): FTListType {
        const str = getSetting(settingName, '');
        if (str !== '') {
            try {
                const json = JSON.parse(str);
                Object.values(json).forEach((item: any) => {
                    if (typeof item.ftFilePath !== 'string'
                        || typeof item.id !== 'number'
                        || !Array.isArray(item.renderedList)
                        || item.renderedList.some(({
                            bibleName, title, verses,
                        }: any) => {
                            return typeof bibleName !== 'string'
                                || typeof title !== 'string'
                                || !Array.isArray(verses)
                                || verses.some(({ num, text }: any) => {
                                    return typeof num !== 'string'
                                        || typeof text !== 'string';
                                });
                        })) {
                        console.log(item);
                        throw new Error('Invalid full-text data');
                    }
                });
                return json;
            } catch (error) {
                appProviderPresent.appUtils
                    .handleError(error);
            }
        }
        return {};
    }
    static setFTList(ftList: FTListType) {
        const str = JSON.stringify(ftList);
        setSetting(settingName, str);
    }
    static getDataList(ftFilePath: string, ftItemId: number) {
        const dataList = this.getFTList();
        return Object.entries(dataList).filter(([_, data]) => {
            return data.ftFilePath === ftFilePath &&
                data.id === ftItemId;
        });
    }
    static async ftSelect(ftFilePath: string,
        id: number, bibleItems: BibleItem[],
        event: React.MouseEvent) {
        const chosenPresentManagers = await PresentManager.contextChooseInstances(event);
        const renderedList = await fullTextPresentHelper.genRenderList(bibleItems);
        chosenPresentManagers.forEach(async (presentManager) => {
            const { presentFTManager } = presentManager;
            const { ftItemData } = presentFTManager;
            const willSelected = `${ftFilePath}:${id}`;
            const selected = `${ftItemData?.ftFilePath}:${ftItemData?.id}`;
            if (selected !== willSelected) {
                presentFTManager.ftItemData = {
                    ftFilePath,
                    id,
                    renderedList,
                    scroll: 0,
                };
            } else {
                presentFTManager.ftItemData = null;
            }
        });
        PresentFTManager.fireUpdateEvent();
    }
    static bibleItemSelect(bibleItem: BibleItem, event: React.MouseEvent) {
        if (bibleItem.fileSource !== undefined) {
            const convertedItems = BibleItem.convertPresent(bibleItem,
                BibleItem.getBiblePresentingSetting());
            PresentFTManager.ftSelect(bibleItem.fileSource.filePath,
                bibleItem.id, convertedItems, event);
        }
    }
    render() {
        if (this.div === null) {
            return;
        }
        const ftItemData = this.ftItemData;
        if (ftItemData !== null) {
            const newDiv = fullTextPresentHelper.genHtmlFTItem(ftItemData.renderedList);
            const divHaftScale = document.createElement('div');
            divHaftScale.appendChild(newDiv);
            const parentWidth = this.presentManager.width;
            const parentHeight = this.presentManager.height;
            const { bounds } = PresentManager.getDisplayByPresentId(this.presentId);
            const width = bounds.width;
            const height = bounds.height;
            Object.assign(divHaftScale.style, {
                width: `${width}px`,
                height: `${height}px`,
                transform: 'translate(-50%, -50%)',
            });
            const scale = parentWidth / width;
            const divContainer = document.createElement('div');
            divContainer.appendChild(divHaftScale);
            Object.assign(divContainer.style, {
                position: 'absolute',
                width: `${parentWidth}px`,
                height: `${parentHeight}px`,
                transform: `scale(${scale},${scale}) translate(50%, 50%)`,
            });
            Array.from(this.div.children).forEach((child) => {
                child.remove();
            });
            this.div.appendChild(divContainer);
            this.renderScroll(true);
        } else {
            if (this.div.lastChild !== null) {
                const targetDiv = this.div.lastChild as HTMLDivElement;
                targetDiv.remove();
            }
        }
    }
    renderScroll(isQuick?: boolean) {
        if (this.div === null) {
            return;
        }
        const scrollTop = this.scroll * this.div.scrollHeight;
        if (isQuick) {
            this.div.scrollTop = scrollTop;
        }
        this.div.scroll({
            top: scrollTop,
            left: 0,
            behavior: 'smooth',
        });
    }
    get containerStyle(): React.CSSProperties {
        return {
            position: 'absolute',
            width: `${this.presentManager.width}px`,
            height: `${this.presentManager.height}px`,
            overflowX: 'hidden',
            overflowY: 'auto',
        };
    }
    static startPresentDrag(event: React.DragEvent<HTMLDivElement>,
        ftItemData: FTItemDataType) {
        const data = {
            present: {
                target: 'ft',
                ftItemData,
            },
        };
        event.dataTransfer.setData('text/plain',
            JSON.stringify(data));
    }
    async receivePresentDrag(presentData: AnyObjectType) {
        this.ftItemData = presentData.ftItemData;
    }
}
