import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    addPropEventMock,
    fromTitleTextMock,
    readClipboardMock,
    applyTargetOrBibleKeyMock,
} = vi.hoisted(() => ({
    addPropEventMock: vi.fn(),
    fromTitleTextMock: vi.fn(),
    readClipboardMock: vi.fn(),
    applyTargetOrBibleKeyMock: vi.fn(),
}));

vi.mock('../../event/EventHandler', () => ({
    default: class {
        static addPropEvent = addPropEventMock;
    },
}));
vi.mock('../../bible-list/BibleItem', () => ({
    default: { fromTitleText: fromTitleTextMock },
}));
vi.mock('../../server/appHelpers', () => ({
    readTextFromClipboard: readClipboardMock,
}));
vi.mock('../../bible-reader/LookupBibleItemController', () => ({
    default: class {
        selectedBibleItem = { id: 1 };
        applyTargetOrBibleKey = applyTargetOrBibleKeyMock;
    },
}));
vi.mock('../../helper/helpers', () => ({
    cloneJson: (v: any) => structuredClone(v),
}));

import {
    CanvasBibleItemEventListener,
    lookupBibleItemProps,
    readBibleItemFromClipboard,
} from './canvasBibleItemHelpers';

describe('slide-editor canvasBibleItemHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('insertBibleItem fires the insert event', () => {
        const bibleItem = { id: 1 } as any;
        CanvasBibleItemEventListener.insertBibleItem(bibleItem);
        expect(addPropEventMock).toHaveBeenCalledWith(
            'insert-bible-item',
            bibleItem,
        );
    });

    test('readBibleItemFromClipboard returns null for empty clipboard', async () => {
        readClipboardMock.mockResolvedValue('');
        expect(await readBibleItemFromClipboard()).toBeNull();
    });

    test('readBibleItemFromClipboard returns null when text does not match', async () => {
        readClipboardMock.mockResolvedValue('just some text');
        expect(await readBibleItemFromClipboard()).toBeNull();
    });

    test('readBibleItemFromClipboard parses a matching bible text', async () => {
        readClipboardMock.mockResolvedValue(
            '(KJV) 2 Samuel 5:15\r\n(15): Ibhar also, and Elishua',
        );
        fromTitleTextMock.mockResolvedValue({ id: 9 });
        const result = await readBibleItemFromClipboard();
        expect(fromTitleTextMock).toHaveBeenCalledWith('KJV', '2 Samuel 5:15');
        expect(result).toEqual({ id: 9 });
    });

    test('readBibleItemFromClipboard returns null when parsing throws', async () => {
        readClipboardMock.mockResolvedValue('(KJV) Genesis 1:1\n(1): text');
        fromTitleTextMock.mockRejectedValue(new Error('bad'));
        expect(await readBibleItemFromClipboard()).toBeNull();
    });

    test('lookupBibleItemProps seeds the controller and opens lookup', () => {
        const openBibleLookup = vi.fn();
        lookupBibleItemProps(
            {
                bibleKeys: ['ESV'],
                bibleItemTarget: { bookKey: 'GEN', chapter: 1 },
            } as any,
            openBibleLookup,
        );
        expect(applyTargetOrBibleKeyMock).toHaveBeenCalledWith(
            { id: 1 },
            expect.objectContaining({ bibleKey: 'ESV' }),
        );
        expect(openBibleLookup).toHaveBeenCalled();
    });
});
