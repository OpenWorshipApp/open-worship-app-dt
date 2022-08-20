import { AllDisplayType } from '../server/displayHelper';
import appProviderPresent from './appProviderPresent';
import {
    PresentTransitionEffectType,
    TargetType,
} from './transition-effect/transitionEffectHelpers';

export const presentTypeList = [
    'background', 'slide', 'full-text', 'full-text-scroll',
    'full-text-selected-index', 'display-change', 'visible',
    'init', 'effect',
] as const;
export type PresentType = typeof presentTypeList[number];
export type PresentMessageType = {
    presentId: number,
    type: PresentType,
    data: any,
};

const messageUtils = appProviderPresent.messageUtils;

export function calMediaSizes({
    parentWidth, parentHeight,
}: {
    parentWidth: number,
    parentHeight: number,
}, { width, height }: {
    width?: number,
    height?: number,
}) {
    if (width === undefined || height === undefined) {
        return {
            width: parentWidth,
            height: parentHeight,
            offsetH: 0,
            offsetV: 0,
        };
    }
    const scale = Math.max(parentWidth / width,
        parentHeight / height);
    const newWidth = width * scale;
    const newHeight = height * scale;
    const offsetH = (newWidth - parentWidth) / 2;
    const offsetV = (newHeight - parentHeight) / 2;
    return {
        width: newWidth,
        height: newHeight,
        offsetH,
        offsetV,
    };
}

type SetDisplayType = {
    presentId: number,
    displayId: number,
}
export function setDisplay({
    presentId, displayId,
}: SetDisplayType) {
    messageUtils.sendData('main:app:set-present-display', {
        presentId,
        displayId,
    });
}

export function getAllShowingPresentIds(): number[] {
    return messageUtils.sendDataSync('main:app:get-presents');
}
export function getAllDisplays(): AllDisplayType {
    return messageUtils.sendDataSync('main:app:get-displays');
}

type ShowPresentDataType = {
    presentId: number,
    displayId: number,
    replyEventName: string,
};
export function showPresent({
    presentId, displayId,
}: SetDisplayType) {
    return new Promise<void>((resolve) => {
        const replyEventName = 'app:main-' + Date.now();
        messageUtils.listenOnceForData(replyEventName, () => {
            resolve();
        });
        const data: ShowPresentDataType = {
            presentId,
            displayId,
            replyEventName,
        };
        messageUtils.sendData('main:app:show-present', data);
    });
}
export function hidePresent(presentId: number) {
    messageUtils.sendData('app:hide-present', presentId);
}

export type PTEffectDataType = {
    target: TargetType,
    effect: PresentTransitionEffectType,
};
