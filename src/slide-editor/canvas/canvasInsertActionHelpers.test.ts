import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    askForURLMock: vi.fn(),
    windowDim: { width: 0, height: 0 },
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
    getWindowDim: () => mocks.windowDim,
}));

import { canvasInsertActionList } from './canvasInsertActionHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { getAllCameraDevices } from '../../helper/cameraHelpers';

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

describe('canvasInsertActionHelpers camera from the menu bar', () => {
    beforeEach(() => {
        mocks.windowDim = { width: 1200, height: 800 };
    });

    test('opens the camera list in the middle of the window, and the chosen camera is placed by the controller, not at that point', async () => {
        const cameras = [
            { deviceId: 'cam-1', groupId: 'g1', label: '' },
            { deviceId: 'cam-2', groupId: 'g2', label: 'Desk camera' },
        ];
        vi.mocked(getAllCameraDevices).mockResolvedValue(cameras);
        const centerEvent = new Event('contextmenu') as MouseEvent;
        vi.mocked(createMouseEvent).mockReturnValue(centerEvent);
        const newItem = { id: 9 };
        const controller = {
            genNewCameraItem: vi.fn(() => newItem),
            addNewItems: vi.fn(),
        };
        // The Insert menu has no pointer: no event at all.
        await findAction('camera').handle(controller as any);
        expect(createMouseEvent).toHaveBeenCalledExactlyOnceWith(600, 400);
        expect(showAppContextMenu).toHaveBeenCalledOnce();
        const [menuEvent, items] = vi.mocked(showAppContextMenu).mock.calls[0];
        expect(menuEvent).toBe(centerEvent);
        expect(items.map((item) => item.menuElement)).toEqual([
            'tran:Camera 1',
            'Desk camera',
        ]);
        items[1].onSelect!(centerEvent);
        // The window-centre event only places the menu; the box itself gets
        // no event so the controller centres it on the slide.
        expect(controller.genNewCameraItem).toHaveBeenCalledExactlyOnceWith(
            cameras[1],
            undefined,
        );
        expect(controller.addNewItems).toHaveBeenCalledExactlyOnceWith([
            newItem,
        ]);
    });
});
