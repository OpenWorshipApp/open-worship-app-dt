// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    lastCleanup: undefined as undefined | (() => void),
    setAppMenuItemsMock: vi.fn(),
    registerAppMenuClickedMock: vi.fn(),
    unregisterMock: vi.fn(),
    handleErrorMock: vi.fn(),
    handleTextMock: vi.fn(),
    handleCameraMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => `tran:${value}`,
    setAppMenuItems: mocks.setAppMenuItemsMock,
    registerAppMenuClicked: mocks.registerAppMenuClickedMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

vi.mock('./canvasInsertActionHelpers', () => ({
    canvasInsertActionList: [
        {
            key: 'text',
            label: 'New',
            iconName: 'plus-square',
            handle: mocks.handleTextMock,
        },
        {
            key: 'camera',
            label: 'Insert Camera',
            iconName: 'camera-video',
            handle: mocks.handleCameraMock,
        },
    ],
}));

// `useAppEffect` is `useEffect` in production builds; run the effect body
// directly so the test does not need a renderer.
vi.mock('../../helper/appHooks', () => ({
    useAppCurrentRef: (value: any) => ({ current: value }),
    useAppEffect: (effect: () => any) => {
        mocks.lastCleanup = effect();
    },
}));

import { useCanvasInsertAppMenu } from './canvasInsertAppMenuHelpers';

const canvasController = { id: 'controller' } as any;

function mount() {
    mocks.registerAppMenuClickedMock.mockReturnValue(mocks.unregisterMock);
    useCanvasInsertAppMenu(canvasController);
    const handler = mocks.registerAppMenuClickedMock.mock.calls[0][0];
    return { handler, cleanup: mocks.lastCleanup as () => void };
}

describe('canvasInsertAppMenuHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('contributes every insert action to the Insert menu, translated', () => {
        mount();

        expect(mocks.setAppMenuItemsMock).toHaveBeenCalledWith(
            'canvas-insert',
            {
                insert: [
                    { label: 'tran:New', clickData: { canvasInsert: 'text' } },
                    {
                        label: 'tran:Insert Camera',
                        clickData: { canvasInsert: 'camera' },
                    },
                ],
            },
        );
    });

    test('runs the matching action with no event so the box is centered', () => {
        const { handler } = mount();

        handler(null, { canvasInsert: 'camera' });

        expect(mocks.handleCameraMock).toHaveBeenCalledWith(canvasController);
        // No second argument at all — that is what makes the controller fall
        // back to the slide center instead of reading a pointer.
        expect(mocks.handleCameraMock.mock.calls[0]).toHaveLength(1);
        expect(mocks.handleTextMock).not.toHaveBeenCalled();
    });

    test('ignores menu clicks belonging to other features', () => {
        const { handler } = mount();

        // Every menu click for this window reaches every registered handler,
        // including parents that carry no `clickData` at all.
        handler(null, undefined);
        handler(null, {});
        handler(null, { dataArchive: 'data-archive:export' });
        handler(null, { canvasInsert: 'not-a-real-action' });

        expect(mocks.handleTextMock).not.toHaveBeenCalled();
        expect(mocks.handleCameraMock).not.toHaveBeenCalled();
        expect(mocks.handleErrorMock).not.toHaveBeenCalled();
    });

    test('withdraws the menu on unmount and on page navigation', () => {
        const addSpy = vi.spyOn(globalThis, 'addEventListener');
        const { cleanup } = mount();

        const pageHideCall = addSpy.mock.calls.find(([name]) => {
            return name === 'pagehide';
        });
        expect(pageHideCall).toBeDefined();

        // A route change is a full page load, which React never cleans up
        // after: without this the Insert menu lingers on the presenter with
        // every entry dead.
        (pageHideCall![1] as () => void)();
        expect(mocks.setAppMenuItemsMock).toHaveBeenLastCalledWith(
            'canvas-insert',
            null,
        );

        mocks.setAppMenuItemsMock.mockClear();
        cleanup();
        expect(mocks.unregisterMock).toHaveBeenCalledTimes(1);
        expect(mocks.setAppMenuItemsMock).toHaveBeenLastCalledWith(
            'canvas-insert',
            null,
        );
        addSpy.mockRestore();
    });
});
