import type ColorNoteInf from '../helper/ColorNoteInf';
import type DragInf from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { getColorNoteFilePathSetting } from '../helper/FileSourceMetaManager';
import FileSource from '../helper/FileSource';
import SettingManager from '../helper/SettingManager';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { askForURL } from './downloadHelper';
import { handleError } from '../helper/errorHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';

export type BackgroundWebUrlItemData = {
    id: string;
    src: string;
    isUrl: true;
};

const BACKGROUND_WEB_URL_LIST_SETTING_NAME = 'background-web-url-list';

export function normalizeBackgroundWebUrl(url: string) {
    return new URL(url.trim()).toString();
}

export function isBackgroundWebUrlItemData(
    value: unknown,
): value is BackgroundWebUrlItemData {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('id' in value) ||
        !('src' in value) ||
        !('isUrl' in value)
    ) {
        return false;
    }
    return (
        typeof value.id === 'string' &&
        value.id.trim().length > 0 &&
        typeof value.src === 'string' &&
        value.src.trim().length > 0 &&
        value.isUrl === true
    );
}

function sanitizeBackgroundWebUrlItemList(
    itemList: BackgroundWebUrlItemData[],
): BackgroundWebUrlItemData[] {
    const existingSrcSet = new Set<string>();
    const sanitizedItemList: BackgroundWebUrlItemData[] = [];
    for (const item of itemList) {
        if (!isBackgroundWebUrlItemData(item)) {
            continue;
        }
        try {
            const normalizedSrc = normalizeBackgroundWebUrl(item.src);
            if (existingSrcSet.has(normalizedSrc)) {
                continue;
            }
            existingSrcSet.add(normalizedSrc);
            sanitizedItemList.push({
                id: item.id,
                src: normalizedSrc,
                isUrl: true,
            });
        } catch (error) {
            handleError(error);
        }
    }
    return sanitizedItemList;
}

const backgroundWebUrlListSettingManager = new SettingManager<
    BackgroundWebUrlItemData[]
>({
    settingName: BACKGROUND_WEB_URL_LIST_SETTING_NAME,
    defaultValue: [],
    isErrorToDefault: true,
    validate: (jsonString) => {
        try {
            return Array.isArray(JSON.parse(jsonString));
        } catch (_error) {
            return false;
        }
    },
    serialize: (itemList) =>
        JSON.stringify(sanitizeBackgroundWebUrlItemList(itemList)),
    deserialize: (jsonString) =>
        sanitizeBackgroundWebUrlItemList(JSON.parse(jsonString)),
});

export function getBackgroundWebUrlItemList() {
    return backgroundWebUrlListSettingManager.getSetting();
}

export function setBackgroundWebUrlItemList(
    itemList: BackgroundWebUrlItemData[],
) {
    backgroundWebUrlListSettingManager.setSetting(itemList);
}

export class BackgroundWebUrlSource
    implements DragInf<BackgroundWebUrlItemData>, ColorNoteInf
{
    readonly id: string;
    readonly src: string;
    readonly fullName: string;
    readonly name: string;
    readonly isUrl = true as const;
    colorNote: string | null;

    constructor(itemData: BackgroundWebUrlItemData) {
        this.id = itemData.id;
        this.src = normalizeBackgroundWebUrl(itemData.src);
        this.fullName = this.src;
        this.name = this.src;
        this.colorNote = getSetting(this.colorNoteKey);
    }

    get filePath() {
        return this.src;
    }

    private get colorNoteKey() {
        return `background-web-url_${this.id}`;
    }

    dragSerialize(type?: DragTypeEnum) {
        return {
            type: type ?? DragTypeEnum.BACKGROUND_WEB,
            data: this.toData(),
        };
    }

    async getColorNote() {
        this.colorNote = getColorNoteFilePathSetting(this.colorNoteKey, null);
        return this.colorNote;
    }

    async setColorNote(color: string | null) {
        this.colorNote = color;
        setSetting(this.colorNoteKey, color);
    }

    toData(): BackgroundWebUrlItemData {
        return {
            id: this.id,
            src: this.src,
            isUrl: true,
        };
    }
}

export function createBackgroundWebUrlSourceList(
    itemList: BackgroundWebUrlItemData[],
) {
    return itemList.map((item) => {
        return new BackgroundWebUrlSource(item);
    });
}

export function deserializeBackgroundWebDragItem(data: unknown) {
    if (typeof data === 'string') {
        return FileSource.dragDeserialize(data);
    }
    if (isBackgroundWebUrlItemData(data)) {
        return new BackgroundWebUrlSource(data);
    }
    return null;
}

export async function promptBackgroundWebUrlSource(existingSrcList: string[]) {
    const url = await askForURL(tran('Add URL'), 'Web URL:');
    if (url === null) {
        return null;
    }
    let normalizedUrl = '';
    try {
        normalizedUrl = normalizeBackgroundWebUrl(url);
    } catch (_error) {
        showSimpleToast(tran('Add URL'), 'Invalid URL');
        return null;
    }
    if (existingSrcList.includes(normalizedUrl)) {
        showSimpleToast(tran('Add URL'), 'URL already exists');
        return null;
    }
    return new BackgroundWebUrlSource({
        id: crypto.randomUUID(),
        src: normalizedUrl,
        isUrl: true,
    });
}
