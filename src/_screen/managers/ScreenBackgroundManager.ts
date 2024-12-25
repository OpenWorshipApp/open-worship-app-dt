import { CSSProperties } from 'react';

import { DragTypeEnum, DroppedDataType } from '../../helper/DragInf';
import {
    getImageDim, getVideoDim,
} from '../../helper/helpers';
import { setSetting } from '../../helper/settingHelpers';
import appProviderScreen from '../appProviderScreen';
import { genHtmlBackground } from '../ScreenBackgroundComp';
import {
    BackgroundSrcType, BackgroundType, BasicScreenMessageType,
    getBackgroundSrcListOnScreenSetting, ScreenMessageType,
} from '../screenHelpers';
import { handleError } from '../../helper/errorHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import {
    chooseScreenManagerInstances, getScreenManagerInstanceForce,
} from './screenManagerHelpers';
import { unlocking } from '../../server/appHelpers';
import ScreenEventHandler from './ScreenEventHandler';
import ScreenManager from './ScreenManager';

export type ScreenBackgroundManagerEventType = 'update';

export default class ScreenBackgroundManager
    extends ScreenEventHandler<ScreenBackgroundManagerEventType> {

    static readonly eventNamePrefix: string = 'screen-bg-m';
    private _backgroundSrc: BackgroundSrcType | null = null;
    private _div: HTMLDivElement | null = null;

    constructor(screenManager: ScreenManager) {
        super(screenManager);
        if (appProviderScreen.isPagePresenter) {
            const allBackgroundSrcList = getBackgroundSrcListOnScreenSetting();
            this._backgroundSrc = allBackgroundSrcList[this.key] || null;
        }
    }

    get isShowing() {
        return this.backgroundSrc !== null;
    }

    get div() {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        this._div = div;
        this.render();
    }

    get effectManager() {
        return this.screenManager.backgroundEffectManager;
    }

    get backgroundSrc() {
        return this._backgroundSrc;
    }

    set backgroundSrc(backgroundSrc: BackgroundSrcType | null) {
        this._backgroundSrc = backgroundSrc;
        this.render();
        unlocking(screenManagerSettingNames.BACKGROUND, () => {
            const allBackgroundSrcList = getBackgroundSrcListOnScreenSetting();
            if (backgroundSrc === null) {
                delete allBackgroundSrcList[this.key];
            } else {
                allBackgroundSrcList[this.key] = backgroundSrc;
            }
            const str = JSON.stringify(allBackgroundSrcList);
            setSetting(screenManagerSettingNames.BACKGROUND, str);
        });
        this.sendSyncScreen();
        this.fireUpdateEvent();
    }

    toSyncMessage() {
        return {
            type: 'background',
            data: this.backgroundSrc,
        } as BasicScreenMessageType;
    }

    receiveSyncScreen(message: ScreenMessageType) {
        this.backgroundSrc = message.data;
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenBackgroundManager.fireUpdateEvent();
    }

    static getBackgroundSrcListByType(backgroundType: BackgroundType) {
        const backgroundSrcList = getBackgroundSrcListOnScreenSetting();
        return Object.entries(backgroundSrcList).filter(
            ([_, backgroundSrc]) => {
                return backgroundSrc.type === backgroundType;
            },
        );
    }

    static getSelectBackgroundSrcList(
        src: string, backgroundType: BackgroundType,
    ) {
        const keyBackgroundSrcList = this.getBackgroundSrcListByType(
            backgroundType,
        );
        return keyBackgroundSrcList.filter(([_, backgroundSrc]) => {
            return backgroundSrc.src === src;
        });
    }

    static async initBackgroundSrcDim(
        src: string, backgroundType: BackgroundType,
    ) {
        const backgroundSrc: BackgroundSrcType = {
            type: backgroundType,
            src,
        };
        const [width, height] = await this.extractDim(backgroundSrc);
        if (width !== undefined && height !== undefined) {
            backgroundSrc.width = width;
            backgroundSrc.height = height;
        }
        return backgroundSrc;
    }

    applyBackgroundSrcWithSyncGroup(backGroundSrc: BackgroundSrcType | null) {
        ScreenBackgroundManager.enableSyncGroup(this.screenId);
        this.backgroundSrc = backGroundSrc;
    }

    static async handleBackgroundSelecting(
        event: React.MouseEvent<HTMLElement, MouseEvent>,
        backgroundType: BackgroundType, src: string | null,
        isForceChoosing = false,
    ) {
        const chosenScreenManagers = await chooseScreenManagerInstances(
            event, isForceChoosing,
        );
        for (const screenManager of chosenScreenManagers) {
            const { screenBackgroundManager } = screenManager;
            if (
                src === null ||
                screenBackgroundManager.backgroundSrc?.src === src
            ) {
                screenBackgroundManager.applyBackgroundSrcWithSyncGroup(null);
            } else {
                const backgroundSrc = await this.initBackgroundSrcDim(
                    src, backgroundType,
                );
                screenBackgroundManager.applyBackgroundSrcWithSyncGroup(
                    backgroundSrc,
                );
            }
        }
        this.fireUpdateEvent();
    }

    static async extractDim(backgroundSrc: BackgroundSrcType)
        : Promise<[number | undefined, number | undefined]> {
        if (backgroundSrc.type === 'image') {
            try {
                return await getImageDim(backgroundSrc.src);
            } catch (error) {
                handleError(error);
            }
        } else if (backgroundSrc.type === 'video') {
            try {
                return await getVideoDim(backgroundSrc.src);
            } catch (error) {
                handleError(error);
            }
        }
        return [undefined, undefined];
    }

    render() {
        if (this.div === null) {
            return;
        }
        const aminData = this.effectManager.styleAnim;
        if (this.backgroundSrc !== null) {
            const newDiv = genHtmlBackground(
                this.backgroundSrc, this.screenManager,
            );
            const childList = Array.from(this.div.children);
            this.div.appendChild(newDiv);
            aminData.animIn(newDiv).then(() => {
                childList.forEach((child) => {
                    child.remove();
                });
            });
        } else if (this.div.lastChild !== null) {
            const targetDiv = this.div.lastChild as HTMLDivElement;
            aminData.animOut(targetDiv).then(() => {
                targetDiv.remove();
            });
        }
    }

    get containerStyle(): CSSProperties {
        return {
            pointerEvents: 'none',
            position: 'absolute',
            width: `${this.screenManager.width}px`,
            height: `${this.screenManager.height}px`,
            overflow: 'hidden',
        };
    }

    async receiveScreenDropped({ type, item }: DroppedDataType) {
        const backgroundTypeMap: { [key: string]: BackgroundType } = {
            [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
            [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
        };
        if (type in backgroundTypeMap) {
            const backgroundSrc = (
                await ScreenBackgroundManager.initBackgroundSrcDim(
                    item.src, backgroundTypeMap[type],
                )
            );
            this.applyBackgroundSrcWithSyncGroup(backgroundSrc);
        } else if (type === DragTypeEnum.BACKGROUND_COLOR) {
            this.applyBackgroundSrcWithSyncGroup({
                type: 'color',
                src: item,
            });
        }
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const { screenBackgroundManager } = getScreenManagerInstanceForce(screenId);
        screenBackgroundManager.receiveSyncScreen(message);
    }

    clear() {
        this.applyBackgroundSrcWithSyncGroup(null);
    }
}
