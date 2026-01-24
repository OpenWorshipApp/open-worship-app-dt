import type { VaryAppDocumentItemType } from '../app-document-list/appDocumentTypeHelpers';
import {
    THUMBNAIL_WIDTH_SETTING_NAME,
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
} from '../app-document-list/appDocumentTypeHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { getSetting, useStateSettingNumber } from '../helper/settingHelpers';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';

export type AppDocumentListEventType =
    | 'app-document-item-select'
    | 'app-document-item-sizing';

export default class AppDocumentListEventListener extends EventHandler<AppDocumentListEventType> {
    static readonly eventNamePrefix: string = 'app-document-list';
    static selectAppDocumentItem(
        varyAppDocumentItem: VaryAppDocumentItemType | null,
    ) {
        this.addPropEvent('app-document-item-select', varyAppDocumentItem);
    }
    static appDocumentItemSizing() {
        this.addPropEvent('app-document-item-sizing');
    }
}

export function useAppDocumentItemSelecting(
    listener: ListenerType<VaryAppDocumentItemType | null>,
) {
    useAppEffect(() => {
        const event = AppDocumentListEventListener.registerEventListener(
            ['app-document-item-select'],
            listener,
        );
        return () => {
            AppDocumentListEventListener.unregisterEventListener(event);
        };
    }, [listener]);
}

export function useAppDocumentItemThumbnailSizeScale(
    settingName = THUMBNAIL_WIDTH_SETTING_NAME,
    defaultSize = Math.fround(DEFAULT_THUMBNAIL_SIZE_FACTOR / 30),
): [number, (newScale: number) => void] {
    const getDefaultSize = () => {
        return Number.parseInt(
            getSetting(settingName) ?? defaultSize.toString(),
        );
    };
    const [thumbnailSizeScale, setThumbnailSizeScale] = useStateSettingNumber(
        settingName,
        getDefaultSize(),
    );
    useAppEffect(() => {
        const event = AppDocumentListEventListener.registerEventListener(
            ['app-document-item-sizing'],
            () => setThumbnailSizeScale(getDefaultSize()),
        );
        return () => {
            AppDocumentListEventListener.unregisterEventListener(event);
        };
    }, []);
    const applyThumbnailSizeScale = (size: number) => {
        setThumbnailSizeScale(size);
        AppDocumentListEventListener.appDocumentItemSizing();
    };
    return [thumbnailSizeScale, applyThumbnailSizeScale];
}
