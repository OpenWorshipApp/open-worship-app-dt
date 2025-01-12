import { useAppEffect } from '../helper/debuggerHelpers';
import { getSetting, useStateSettingNumber } from '../helper/settingHelpers';
import {
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
    THUMBNAIL_WIDTH_SETTING_NAME,
    VaryAppDocumentItemType,
} from '../app-document-list/appDocumentHelpers';
import EventHandler, { ListenerType } from './EventHandler';

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
    defaultSize = DEFAULT_THUMBNAIL_SIZE_FACTOR,
): [number, (newScale: number) => void] {
    const getDefaultSize = () => {
        return parseInt(getSetting(settingName, defaultSize.toString()));
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
