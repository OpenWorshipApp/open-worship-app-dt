import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    saved: '[]',
    options: null as null | {
        serialize: (items: unknown[]) => string;
        deserialize: (json: string) => unknown[];
    },
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    getColorNoteFilePathSetting: vi.fn(),
    dragDeserialize: vi.fn(),
    askForURL: vi.fn(),
    showSimpleToast: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../helper/SettingManager', () => ({
    default: class {
        constructor(options: typeof h.options) {
            h.options = options;
        }
        getSetting() {
            return h.options!.deserialize(h.saved);
        }
        setSetting(items: unknown[]) {
            h.saved = h.options!.serialize(items);
        }
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: { dragDeserialize: h.dragDeserialize },
}));
vi.mock('../helper/FileSourceMetaManager', () => ({
    getColorNoteFilePathSetting: h.getColorNoteFilePathSetting,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: h.getSetting,
    setSetting: h.setSetting,
}));
vi.mock('./downloadHelper', () => ({ askForURL: h.askForURL }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import { DragTypeEnum } from '../helper/DragInf';
import {
    BackgroundWebUrlSource,
    createBackgroundWebUrlSourceList,
    deserializeBackgroundWebDragItem,
    getBackgroundWebUrlItemList,
    isBackgroundWebUrlItemData,
    normalizeBackgroundWebUrl,
    promptBackgroundWebUrlSource,
    setBackgroundWebUrlItemList,
} from './backgroundWebUrlHelpers';

const item = { id: 'first', src: 'https://example.org/', isUrl: true as const };

beforeEach(() => {
    vi.clearAllMocks();
    h.saved = '[]';
    h.getSetting.mockReturnValue(null);
    h.getColorNoteFilePathSetting.mockResolvedValue('#ff0000');
    h.askForURL.mockResolvedValue('https://example.org/');
    vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('saved background web URLs', () => {
    it('normalizes addresses and rejects malformed saved records', () => {
        expect(normalizeBackgroundWebUrl('  https://example.org/path  ')).toBe(
            'https://example.org/path',
        );
        expect(isBackgroundWebUrlItemData(item)).toBe(true);
        expect(isBackgroundWebUrlItemData({ ...item, id: ' ' })).toBe(false);
        expect(isBackgroundWebUrlItemData({ ...item, isUrl: false })).toBe(
            false,
        );
        expect(isBackgroundWebUrlItemData(null)).toBe(false);
    });

    it('sanitizes invalid, duplicate and non-URL entries on save and load', () => {
        setBackgroundWebUrlItemList([
            { id: 'first', src: ' https://example.org ', isUrl: true },
            { id: 'duplicate', src: 'https://example.org/', isUrl: true },
            { id: 'broken', src: 'not an address', isUrl: true },
            { id: '', src: 'https://other.org/', isUrl: true },
        ]);
        expect(getBackgroundWebUrlItemList()).toEqual([item]);
        expect(h.handleError).toHaveBeenCalledOnce();
        h.saved = JSON.stringify([item, { ...item, id: 'again' }]);
        expect(getBackgroundWebUrlItemList()).toEqual([item]);
    });

    it('carries a URL through drag data and persists its color note', async () => {
        const [source] = createBackgroundWebUrlSourceList([item]);
        expect(source).toBeInstanceOf(BackgroundWebUrlSource);
        expect(source.filePath).toBe(item.src);
        expect(source.dragSerialize()).toEqual({
            type: DragTypeEnum.BACKGROUND_WEB,
            data: item,
        });
        expect(source.toData()).toEqual(item);
        expect(await source.getColorNote()).toBe('#ff0000');
        expect(h.getColorNoteFilePathSetting).toHaveBeenCalledWith(
            'background-web-url_first',
            null,
        );
        await source.setColorNote('#00ff00');
        expect(h.setSetting).toHaveBeenCalledWith(
            'background-web-url_first',
            '#00ff00',
        );
        expect(source.colorNote).toBe('#00ff00');
        expect(deserializeBackgroundWebDragItem(item)).toBeInstanceOf(
            BackgroundWebUrlSource,
        );
        expect(deserializeBackgroundWebDragItem({ bad: true })).toBeNull();
        h.dragDeserialize.mockReturnValue(source);
        expect(deserializeBackgroundWebDragItem(item.src)).toBe(source);
    });

    it('rejects cancellation, invalid addresses and duplicates before adding', async () => {
        h.askForURL.mockResolvedValueOnce(null);
        expect(await promptBackgroundWebUrlSource([])).toBeNull();
        h.askForURL.mockResolvedValueOnce('not a URL');
        expect(await promptBackgroundWebUrlSource([])).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Add URL',
            'Invalid URL',
        );
        expect(await promptBackgroundWebUrlSource([item.src])).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Add URL',
            'URL already exists',
        );
        expect(h.askForURL).toHaveBeenCalledWith('Add URL', 'Web URL:');
    });

    it('creates a uniquely identified source for a new address', async () => {
        const source = await promptBackgroundWebUrlSource([]);
        expect(source?.toData()).toEqual({ ...item, id: 'new-id' });
    });
});
