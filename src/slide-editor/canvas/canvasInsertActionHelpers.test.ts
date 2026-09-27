import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    askForURLMock: vi.fn(),
}));

// A marked `tran` makes a second translation visible: anything that reaches
// `askForURL` already wearing the marker was translated by the caller.
vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => `tran:${value}`,
}));

vi.mock('../../background/downloadHelper', () => ({
    askForURL: mocks.askForURLMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    getMimetypeExtensions: () => [],
    selectFiles: vi.fn(async () => []),
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: vi.fn(),
    showAppContextMenu: vi.fn(),
}));

vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(),
}));

vi.mock('../../helper/cameraHelpers', () => ({
    getAllCameraDevices: vi.fn(async () => []),
}));

vi.mock('../../helper/helpers', () => ({
    getWindowDim: () => ({ width: 0, height: 0 }),
}));

import { canvasInsertActionList } from './canvasInsertActionHelpers';

function findAction(key: string) {
    const action = canvasInsertActionList.find((item) => item.key === key);
    if (action === undefined) {
        throw new Error(`No insert action "${key}"`);
    }
    return action;
}

describe('canvasInsertActionHelpers URL prompts', () => {
    beforeEach(() => {
        mocks.askForURLMock.mockReset();
        mocks.askForURLMock.mockResolvedValue(null);
    });

    // `askForURL` translates its subtitle itself (InputUrlComp). Translating
    // it here too handed Khmer text to `tran`, which throws on a missing key
    // in dev and blanked the whole editor in Khmer.
    test.each([
        ['media-link', 'Media URL:'],
        ['youtube', 'YouTube URL:'],
        ['website', 'Website URL:'],
    ])('%s passes its URL label untranslated', async (key, label) => {
        await findAction(key).handle({} as any);
        expect(mocks.askForURLMock).toHaveBeenCalledTimes(1);
        const [title, subTitle] = mocks.askForURLMock.mock.calls[0];
        expect(title.startsWith('tran:')).toBe(true);
        expect(subTitle).toBe(label);
    });
});
