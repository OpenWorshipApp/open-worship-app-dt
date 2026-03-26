import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
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
    static selectVarySlide(varySlide: VarySlideType | null) {
        this.addPropEvent('app-document-item-select', varySlide);
    }
    static fireEventVarySlideSizing() {
        this.addPropEvent('app-document-item-sizing');
    }
}

export function useVarySlideSelecting(
    listener: ListenerType<VarySlideType | null>,
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

export function useVarySlideThumbnailSizeScale({
    settingName = THUMBNAIL_WIDTH_SETTING_NAME,
    defaultSize = Math.fround(DEFAULT_THUMBNAIL_SIZE_FACTOR / 30),
}: {
    settingName?: string;
    defaultSize?: number;
} = {}): [number, (newScale: number) => void] {
    const getDefaultSize = () => {
        const settingN = getSetting(settingName);
        if (settingN === null) {
            return defaultSize;
        }
        const n = Number.parseInt(settingN ?? '', 10);
        if (Number.isNaN(n)) {
            return defaultSize;
        }
        return n;
    };
    const [thumbnailSizeScale, setThumbnailSizeScale] = useStateSettingNumber(
        settingName,
        getDefaultSize,
    );

    useAppEffect(() => {
        const event = AppDocumentListEventListener.registerEventListener(
            ['app-document-item-sizing'],
            () => setThumbnailSizeScale(getDefaultSize()),
        );
        return () => {
            AppDocumentListEventListener.unregisterEventListener(event);
        };
    }, [settingName, defaultSize]);
    const applyThumbnailSizeScale = (size: number) => {
        setThumbnailSizeScale(size);
        AppDocumentListEventListener.fireEventVarySlideSizing();
    };
    return [thumbnailSizeScale, applyThumbnailSizeScale];
}
