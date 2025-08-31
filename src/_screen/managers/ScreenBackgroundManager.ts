import { CSSProperties } from 'react';

import { DragTypeEnum, DroppedDataType } from '../../helper/DragInf';
import { getImageDim, getVideoDim } from '../../helper/helpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { genHtmlBackground } from '../ScreenBackgroundComp';
import { getBackgroundSrcListOnScreenSetting } from '../screenHelpers';
import { handleError } from '../../helper/errorHelpers';
import {
    dirSourceSettingNames,
    screenManagerSettingNames,
} from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import ScreenManagerBase from './ScreenManagerBase';
import ScreenEffectManager from './ScreenEffectManager';
import appProvider from '../../server/appProvider';
import { unlocking } from '../../server/unlockingHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import {
    BackgroundDataType,
    BackgroundSrcType,
    BackgroundType,
    BasicScreenMessageType,
    ScreenMessageType,
    StyleAnimType,
} from '../screenTypeHelpers';
import { ANIM_END_DELAY_MILLISECOND } from '../transitionEffectHelpers';
import { getIsFadingAtTheEndSetting } from '../../background/videoBackgroundHelpers';

export type ScreenBackgroundManagerEventType = 'update';

const FADING_DURATION_SECOND = 3;
const FADING_DURATION_MILLISECOND = FADING_DURATION_SECOND * 1000;
export const BACKGROUND_VIDEO_FADING_SETTING_NAME =
    dirSourceSettingNames.BACKGROUND_VIDEO + '-fading-at-end';

export function getIsFadingAtEndSetting() {
    return getSetting(BACKGROUND_VIDEO_FADING_SETTING_NAME) !== 'false';
}

class ScreenBackgroundManager extends ScreenEventHandler<ScreenBackgroundManagerEventType> {
    static readonly eventNamePrefix: string = 'screen-bg-m';
    private _backgroundSrc: BackgroundSrcType | null = null;
    private _rootContainer: HTMLDivElement | null = null;
    effectManager: ScreenEffectManager;

    constructor(
        screenManagerBase: ScreenManagerBase,
        effectManager: ScreenEffectManager,
    ) {
        super(screenManagerBase);
        this.effectManager = effectManager;
        if (appProvider.isPagePresenter) {
            const allBackgroundSrcList = getBackgroundSrcListOnScreenSetting();
            this._backgroundSrc = allBackgroundSrcList[this.key] ?? null;
        }
    }

    get isShowing() {
        return this.backgroundSrc !== null;
    }

    get rootContainer() {
        return this._rootContainer;
    }

    set rootContainer(rootContainer: HTMLDivElement | null) {
        this._rootContainer = rootContainer;
        this.render();
    }

    get backgroundSrc() {
        return this._backgroundSrc;
    }

    set backgroundSrc(backgroundSrc: BackgroundSrcType | null) {
        if (
            this.screenManagerBase.checkIsLockedWithMessage() ||
            checkAreObjectsEqual(this._backgroundSrc, backgroundSrc)
        ) {
            return;
        }
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
            this.fireUpdateEvent();
        });
        this.sendSyncScreen();
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
        src: string,
        backgroundType: BackgroundType,
    ) {
        const keyBackgroundSrcList =
            this.getBackgroundSrcListByType(backgroundType);
        return keyBackgroundSrcList.filter(([_, backgroundSrc]) => {
            return backgroundSrc.src === src;
        });
    }

    static async initBackgroundSrcDim(
        src: string,
        backgroundType: BackgroundType,
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

    async applyBackgroundSrc(
        backgroundType: BackgroundType,
        data: BackgroundDataType,
    ) {
        if (data.src === null || this.backgroundSrc?.src === data.src) {
            this.applyBackgroundSrcWithSyncGroup(null);
        } else {
            const backgroundSrc =
                await ScreenBackgroundManager.initBackgroundSrcDim(
                    data.src,
                    backgroundType,
                );
            this.applyBackgroundSrcWithSyncGroup({
                ...backgroundSrc,
                scaleType: data.scaleType,
                extraStyle: data.extraStyle,
            });
        }
    }

    static async handleBackgroundSelecting(
        event: React.MouseEvent,
        backgroundType: BackgroundType,
        data: BackgroundDataType,
        isForceChoosing = false,
    ) {
        const screenIds = await this.chooseScreenIds(event, isForceChoosing);
        for (const screenId of screenIds) {
            const screenBackgroundManager = this.getInstance(screenId);
            screenBackgroundManager.applyBackgroundSrc(backgroundType, data);
        }
    }

    static async extractDim(
        backgroundSrc: BackgroundSrcType,
    ): Promise<[number | undefined, number | undefined]> {
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

    removeOldElements(aminData: StyleAnimType, elements: HTMLDivElement[]) {
        for (const element of elements) {
            aminData.animOut(element).then(() => {
                element.remove();
            });
        }
    }

    _checkVideoFadingAtEnd(container: HTMLDivElement) {
        const video = container.querySelector('video');
        if (video !== null) {
            const fadeOutListener = async () => {
                const duration = video.duration;
                if (
                    !(isNaN(duration) || duration === Infinity) &&
                    duration - video.currentTime <= FADING_DURATION_SECOND
                ) {
                    const isFadingAtTheEnd = getIsFadingAtTheEndSetting(
                        video.src,
                    );
                    if (!isFadingAtTheEnd) {
                        return;
                    }
                    video.removeEventListener('timeupdate', fadeOutListener);
                    this.render({
                        ...this.effectManager.styleAnimList.fade,
                        animOut: async () => {
                            const duration =
                                FADING_DURATION_MILLISECOND +
                                ANIM_END_DELAY_MILLISECOND;
                            await new Promise<void>((resolve) => {
                                setTimeout(() => {
                                    resolve();
                                }, duration);
                            });
                        },
                        duration: FADING_DURATION_MILLISECOND,
                    });
                }
            };
            video.addEventListener('timeupdate', fadeOutListener);
        }
    }

    render(overrideAnimData?: StyleAnimType) {
        if (this.rootContainer === null) {
            return;
        }
        const aminData = overrideAnimData ?? this.effectManager.styleAnim;
        if (this.backgroundSrc !== null) {
            const newDiv = genHtmlBackground(this.screenId, this.backgroundSrc);
            const childList = Array.from(this.rootContainer.children).filter(
                (element) => {
                    return element instanceof HTMLDivElement;
                },
            );
            this._checkVideoFadingAtEnd(newDiv);
            aminData.animIn(newDiv, this.rootContainer);
            this.removeOldElements(aminData, childList);
        } else if (this.rootContainer.lastChild !== null) {
            const targetDiv = this.rootContainer.lastChild as HTMLDivElement;
            this.removeOldElements(aminData, [targetDiv]);
        }
    }

    get containerStyle(): CSSProperties {
        return {
            pointerEvents: 'none',
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            overflow: 'hidden',
        };
    }

    async receiveScreenDropped({ type, item }: DroppedDataType) {
        const backgroundTypeMap: { [key: string]: BackgroundType } = {
            [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
            [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
        };
        if (type in backgroundTypeMap) {
            const backgroundSrc =
                await ScreenBackgroundManager.initBackgroundSrcDim(
                    item.src,
                    backgroundTypeMap[type],
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
        const screenBackgroundManager = this.getInstance(screenId);
        screenBackgroundManager.receiveSyncScreen(message);
    }

    clear() {
        this.applyBackgroundSrcWithSyncGroup(null);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenBackgroundManager>(screenId);
    }
}

export default ScreenBackgroundManager;
