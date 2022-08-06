import { toastEventListener } from '../event/ToastEventListener';
import appProvider from './appProvider';

export type BoundsType = {
    x: number,
    y: number,
    width: number,
    height: number,
};
export type DisplayType = {
    id: number,
    bounds: BoundsType,
};
export type AllDisplayType = {
    primaryDisplay: DisplayType,
    displays: DisplayType[],
}

// TODO: remove this
export function saveDisplaySetting(data: {
    presentId: number,
    presentDisplayId: string,
}) {
    const success = !!appProvider.messageUtils.
        sendSyncData('main:app:set-present-display', data);
    toastEventListener.showSimpleToast({
        title: 'Save Display',
        message: success ? 'Display setting have been saved' :
            'Fail to save display setting',
    });
    return success;
}
