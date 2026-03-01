import type { CSSProperties } from 'react';

import type BibleItem from '../../bible-list/BibleItem';
import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import {
    bringDomToCenterView,
    bringDomToNearestView,
    bringDomToTopView,
    checkIsVerticalPartialInvisible,
    cloneJson,
    isValidJson,
} from '../../helper/helpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import bibleScreenHelper from '../bibleScreenHelpers';
import type { ScreenBibleManagerEventType } from '../screenBibleHelpers';
import {
    SCREEN_BIBLE_SETTING_PREFIX,
    renderScreenBibleManager,
    bibleItemJsonToScreenViewData,
    onSelectKey,
} from '../screenBibleHelpers';
import {
    genScreenMouseEvent,
    getBibleListOnScreenSetting,
} from '../screenHelpers';
import * as loggerHelpers from '../../helper/loggerHelpers';
import { handleError } from '../../helper/errorHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import { getAllScreenManagerBases } from './screenManagerBaseHelpers';
import appProvider from '../../server/appProvider';
import { applyAttachBackground } from './screenBackgroundHelpers';
import type { BibleItemType } from '../../bible-list/bibleItemHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import Bible from '../../bible-list/Bible';
import type { AnyObjectType } from '../../helper/typeHelpers';
import type {
    BasicScreenMessageType,
    BibleItemDataType,
    ScreenMessageType,
} from '../screenTypeHelpers';
import { registerScrollingSyncEvent } from './screenEventHelpers';

class ScreenBibleManager extends ScreenEventHandler<ScreenBibleManagerEventType> {
    static readonly eventNamePrefix: string = 'screen-ft-m';
    private _screenViewData: BibleItemDataType | null = null;
    private _div: HTMLDivElement | null = null;
    public isToTop = false;
    applyBibleViewData = (_bibleData: BibleItemDataType | null) => {};
    handleBibleViewVersesHighlighting = (
        _kjvVerseKey: string,
        _isToTop: boolean,
    ) => {};

    constructor(screenManagerBase: ScreenManagerBase) {
        super(screenManagerBase);
        if (appProvider.isPagePresenter) {
            const allBibleDataList = getBibleListOnScreenSetting();
            this._screenViewData = allBibleDataList[this.key] ?? null;
        }
    }

    get isShowing() {
        return this.screenViewData !== null;
    }

    applyHeaderEffectOnScroll(div: HTMLDivElement) {
        const thElement = div.querySelector('th.header');
        if (thElement instanceof HTMLElement === false) {
            return;
        }
        const percentage = Math.min(div.scrollTop, 118) / 118;
        thElement.style.fontSize = `${1 - 0.5 * percentage}em`;

        const hexAlpha = Math.round(83 + 100 * percentage).toString(16);
        const firstChild = thElement.children[0];
        if (firstChild instanceof HTMLElement) {
            firstChild.style.backgroundColor = `#999999${hexAlpha}`;
        }
    }

    get isLineSync() {
        const settingKey = `${SCREEN_BIBLE_SETTING_PREFIX}-line-sync-${this.screenId}`;
        return getSetting(settingKey) === 'true';
    }

    set isLineSync(isLineSync: boolean) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        setSetting(
            `${SCREEN_BIBLE_SETTING_PREFIX}-line-sync-${this.screenId}`,
            `${isLineSync}`,
        );
        this.screenViewData = cloneJson(this.screenViewData);
    }

    get div() {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        this._div = div;
        if (div !== null) {
            div.addEventListener('wheel', (event) => {
                if (!event.ctrlKey) {
                    return;
                }
                event.preventDefault();
                const isUp = event.deltaY < 0;
                ScreenBibleManager.changeTextStyleTextFontSize(isUp);
            });
            div.addEventListener('scroll', () => {
                this.scroll =
                    div.scrollTop / (div.scrollHeight - div.clientHeight);
                this.applyHeaderEffectOnScroll(div);
            });
            div.classList.add('screen-bible-container-scroll');
            registerScrollingSyncEvent(div, (scroll) => {
                this.sendSyncScrollPercentage(
                    '.screen-bible-container-scroll',
                    scroll,
                );
            });
        }

        this.render();
    }

    get screenViewData() {
        return this._screenViewData;
    }

    set screenViewData(screenViewData: BibleItemDataType | null) {
        this._screenViewData = screenViewData;
        this.applyBibleViewData(screenViewData);
        this.render();
        unlocking(`set-${screenManagerSettingNames.FULL_TEXT}`, () => {
            const allBibleDataList = getBibleListOnScreenSetting();
            if (screenViewData === null) {
                delete allBibleDataList[this.key];
            } else {
                allBibleDataList[this.key] = screenViewData;
            }
            const string = JSON.stringify(allBibleDataList);
            setSetting(screenManagerSettingNames.FULL_TEXT, string);
            this.fireUpdateEvent();
        });
        this.sendSyncScreen();
    }

    getRenderedBibleKeys() {
        if (this._screenViewData === null) {
            return [];
        }
        return (this._screenViewData.bibleItemData?.renderedList ?? []).map(
            ({ bibleKey }) => bibleKey,
        );
    }

    private _setMetadata(key: string, value: any) {
        if (this._screenViewData !== null) {
            (this._screenViewData as any)[key] = value;
            if (!appProvider.isPageScreen) {
                unlocking(
                    `set-meta-${screenManagerSettingNames.FULL_TEXT}`,
                    () => {
                        const allBibleDataList = getBibleListOnScreenSetting();
                        allBibleDataList[this.key] = this
                            ._screenViewData as any;
                        const string = JSON.stringify(allBibleDataList);
                        setSetting(screenManagerSettingNames.FULL_TEXT, string);
                    },
                );
            }
        }
    }

    get containerStyle(): CSSProperties {
        return {
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            overflowX: 'hidden',
            overflowY: 'auto',
        };
    }

    get selectedKJVVerseKey() {
        return this._screenViewData === null
            ? null
            : this._screenViewData.selectedKJVVerseKey;
    }

    set selectedKJVVerseKey(selectedKJVVerseKey: string | null) {
        this._setMetadata('selectedKJVVerseKey', selectedKJVVerseKey);
        this.renderSelectedIndex();
    }

    get scroll() {
        return this.screenViewData?.scroll ?? 0;
    }

    set scroll(scroll: number) {
        this._setMetadata('scroll', scroll);
    }
    sendSyncSelectedIndex() {
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                type: 'bible-screen-view-selected-index',
                data: {
                    selectedKJVVerseKey: this.selectedKJVVerseKey,
                },
            },
            true,
        );
    }

    static receiveSyncSelectedIndex(message: ScreenMessageType) {
        const { data, screenId } = message;
        const screenBibleManager = this.getInstance(screenId);
        if (screenBibleManager === null) {
            return;
        }
        screenBibleManager.selectedKJVVerseKey = data.selectedKJVVerseKey;
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'bible-screen-view',
            data: this.screenViewData,
        };
    }

    applyFullDataSrcWithSyncGroup(bibleData: BibleItemDataType | null) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        ScreenBibleManager.enableSyncGroup(this.screenId);
        this.screenViewData = bibleData;
    }

    receiveSyncScreen(message: ScreenMessageType) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        this.screenViewData = message.data;
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenBibleManager.fireUpdateEvent();
    }

    static readonly maxTextStyleTextFontSize = 200;
    static get textStyleTextFontSize() {
        const textStyle = this.textStyle;
        return typeof textStyle.fontSize === 'number' ? textStyle.fontSize : 65;
    }

    static changeTextStyleTextFontSize(isUp: boolean) {
        let fontSize = this.textStyleTextFontSize;
        fontSize += isUp ? 1 : -1;
        this.applyTextStyle({
            fontSize: Math.min(
                this.maxTextStyleTextFontSize,
                Math.max(1, fontSize),
            ),
        });
    }

    static get textStyleTextColor(): string {
        const textStyle = this.textStyle;
        return typeof textStyle.color === 'string'
            ? textStyle.color
            : '#ffffff';
    }

    static get textStyleTextTextShadow(): string {
        const textStyle = this.textStyle;
        return typeof textStyle.textShadow === 'string'
            ? textStyle.textShadow
            : 'none';
    }

    static get textStyleText(): string {
        return `
            font-size: ${this.textStyleTextFontSize}px;
            color: ${this.textStyleTextColor};
            text-shadow: ${this.textStyleTextTextShadow};
        `;
    }

    static get textStyle(): AnyObjectType {
        const str =
            getSetting(`${SCREEN_BIBLE_SETTING_PREFIX}-style-text`) ?? '';
        try {
            if (isValidJson(str, true)) {
                const style = JSON.parse(str);
                if (typeof style !== 'object') {
                    loggerHelpers.appError(style);
                    throw new Error('Invalid style data');
                }
                return style;
            }
        } catch (error) {
            handleError(error);
        }
        return {};
    }

    static set textStyle(style: AnyObjectType) {
        setSetting(
            `${SCREEN_BIBLE_SETTING_PREFIX}-style-text`,
            JSON.stringify(style),
        );
        this.addPropEvent('text-style');
    }

    static applyTextStyle(style: AnyObjectType) {
        const textStyle = this.textStyle;
        Object.assign(textStyle, style);
        this.textStyle = textStyle;
        this.sendSynTextStyle();
    }

    static sendSynTextStyle() {
        for (const screenManagerBase of getAllScreenManagerBases()) {
            screenManagerBase.sendScreenMessage(
                {
                    screenId: screenManagerBase.screenId,
                    type: 'bible-screen-view-text-style',
                    data: {
                        textStyle: this.textStyle,
                    },
                },
                true,
            );
        }
    }

    static receiveSyncTextStyle(message: ScreenMessageType) {
        const { data } = message;
        this.textStyle = data.textStyle;
    }

    async applyNewBibleItemJson(
        bibleItemJson: BibleItemType,
        filePath: string | undefined,
    ) {
        let bibleKeys = this.getRenderedBibleKeys();
        if (bibleKeys.length === 1) {
            bibleKeys = [bibleItemJson.bibleKey];
        } else if (bibleKeys.length > 1) {
            bibleKeys = Array.from(
                new Set([bibleItemJson.bibleKey].concat(bibleKeys)),
            );
        }
        const newBibleItemData = await bibleItemJsonToScreenViewData(
            bibleItemJson,
            bibleKeys,
        );
        this.applyFullDataSrcWithSyncGroup(newBibleItemData);
        if (filePath !== undefined) {
            applyAttachBackground(this.screenId, filePath, bibleItemJson.id);
        }
    }

    static async handleBibleItemSelecting(
        event: MouseEvent | null,
        bibleItem: BibleItem,
        isForceChoosing = false,
    ) {
        const bibleItemJson = bibleItem.toJson();
        const screenIds = await this.chooseScreenIds(
            genScreenMouseEvent(event) as any,
            isForceChoosing,
        );
        let filePath = bibleItem.filePath;
        if (filePath === undefined) {
            const defaultBible = await Bible.getDefault();
            filePath = defaultBible?.filePath ?? undefined;
        }
        for (const screenId of screenIds) {
            const screenBibleManager = this.getInstance(screenId);
            await screenBibleManager.applyNewBibleItemJson(
                bibleItemJson,
                filePath,
            );
        }
    }

    render() {
        renderScreenBibleManager(this);
    }

    handleScreenVersesHighlighting(kjvVerseKey: string, isToTop: boolean) {
        onSelectKey(this, kjvVerseKey, isToTop);
    }

    renderSelectedIndex() {
        if (this.div === null) {
            return;
        }
        bibleScreenHelper.removeClassName(this.div, 'selected');
        const isToTop = this.isToTop;
        this.isToTop = false;
        const selectedBlockDoms = bibleScreenHelper.resetClassName(
            this.div,
            'selected',
            true,
            `${this.selectedKJVVerseKey}`,
        );
        for (const blockDom of selectedBlockDoms) {
            if (isToTop) {
                bringDomToTopView(blockDom);
                this.handleBibleViewVersesHighlighting(
                    (blockDom as any).dataset.kjvVerseKey,
                    true,
                );
            } else {
                const isPartiallyInvisible = checkIsVerticalPartialInvisible(
                    this.div,
                    blockDom as HTMLElement,
                );
                if (isPartiallyInvisible) {
                    bringDomToCenterView(blockDom);
                } else {
                    bringDomToNearestView(blockDom);
                }
                this.handleBibleViewVersesHighlighting(
                    (blockDom as any).dataset.kjvVerseKey,
                    false,
                );
            }
        }
    }

    async receiveScreenDropped(droppedData: DroppedDataType) {
        if (droppedData.type === DragTypeEnum.BIBLE_ITEM) {
            const bibleItem: BibleItem = droppedData.item;
            this.applyNewBibleItemJson(
                bibleItem.toJson(),
                droppedData.item.filePath,
            );
        } else {
            loggerHelpers.appLog(droppedData);
        }
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenBibleManager = this.getInstance(screenId);
        screenBibleManager.receiveSyncScreen(message);
    }

    clear() {
        this.applyFullDataSrcWithSyncGroup(null);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenBibleManager>(screenId);
    }
}

export default ScreenBibleManager;
