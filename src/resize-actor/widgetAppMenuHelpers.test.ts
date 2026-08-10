// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setAppMenuItemsMock: vi.fn(),
    registerAppMenuClickedMock: vi.fn(),
    unregisterMock: vi.fn(),
    handleErrorMock: vi.fn(),
    showAppConfirmMock: vi.fn(async () => true),
    clearWidgetSizeSettingMock: vi.fn(async () => [] as string[]),
    resetAllWidgetsMock: vi.fn(),
    toggleWidgetMock: vi.fn(() => true),
    getWidgetEntriesMock: vi.fn(() => [] as any[]),
    checkAreNamesUniqueMock: vi.fn(() => true),
    subscribeWidgetsChangedMock: vi.fn((_listener: () => void) => () => {}),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => `tran:${value}`,
    setAppMenuItems: mocks.setAppMenuItemsMock,
    registerAppMenuClicked: mocks.registerAppMenuClickedMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirmMock,
}));

vi.mock('./flexSizeHelpers', () => ({
    clearWidgetSizeSetting: mocks.clearWidgetSizeSettingMock,
}));

vi.mock('./widgetRegistry', () => ({
    getWidgetEntries: mocks.getWidgetEntriesMock,
    checkAreNamesUnique: mocks.checkAreNamesUniqueMock,
    resetAllWidgets: mocks.resetAllWidgetsMock,
    subscribeWidgetsChanged: mocks.subscribeWidgetsChangedMock,
    toggleWidget: mocks.toggleWidgetMock,
}));

import { genViewMenuItems, initWidgetAppMenu } from './widgetAppMenuHelpers';

const ENTRIES = [
    {
        id: 'app-presenter-left::v1',
        widgetName: 'Document List',
        isHidden: false,
        toggle: vi.fn(),
    },
    {
        id: 'app-presenter-left::v2',
        widgetName: 'Presenting Flow List',
        isHidden: true,
        toggle: vi.fn(),
    },
];

function init() {
    mocks.registerAppMenuClickedMock.mockReturnValue(mocks.unregisterMock);
    const cleanup = initWidgetAppMenu();
    const handler = mocks.registerAppMenuClickedMock.mock.calls[0][0];
    return { handler, cleanup };
}

describe('resize-actor widgetAppMenuHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getWidgetEntriesMock.mockReturnValue([]);
        mocks.showAppConfirmMock.mockResolvedValue(true);
        mocks.subscribeWidgetsChangedMock.mockReturnValue(() => {});
    });

    test('a checked box per widget, unchecked when collapsed', () => {
        mocks.getWidgetEntriesMock.mockReturnValue(ENTRIES);

        expect(genViewMenuItems()).toEqual([
            {
                label: 'tran:Widgets',
                submenu: [
                    {
                        label: 'Document List',
                        type: 'checkbox',
                        checked: true,
                        clickData: { widgetToggle: 'app-presenter-left::v1' },
                    },
                    {
                        label: 'Presenting Flow List',
                        type: 'checkbox',
                        checked: false,
                        clickData: { widgetToggle: 'app-presenter-left::v2' },
                    },
                ],
            },
            {
                label: 'tran:Reset Widgets Size',
                clickData: { widgetReset: true },
            },
        ]);
        // The labels ARE the widget names, so a duplicate would render two
        // identical checkboxes — worth shouting about on every rebuild.
        expect(mocks.checkAreNamesUniqueMock).toHaveBeenCalledWith(ENTRIES);
    });

    test('drops the Widgets submenu when nothing is collapsible, keeps the reset', () => {
        expect(genViewMenuItems()).toEqual([
            {
                label: 'tran:Reset Widgets Size',
                clickData: { widgetReset: true },
            },
        ]);
    });

    test('registers on init and rebuilds whenever the registry changes', () => {
        let notify = () => {};
        mocks.subscribeWidgetsChangedMock.mockImplementation(
            (listener: any) => {
                notify = listener;
                return () => {};
            },
        );
        init();

        expect(mocks.setAppMenuItemsMock).toHaveBeenCalledTimes(1);
        expect(mocks.setAppMenuItemsMock).toHaveBeenLastCalledWith(
            'view-widgets',
            { view: genViewMenuItems() },
        );

        mocks.getWidgetEntriesMock.mockReturnValue(ENTRIES);
        notify();
        expect(mocks.setAppMenuItemsMock).toHaveBeenCalledTimes(2);
        expect(
            mocks.setAppMenuItemsMock.mock.calls[1][1].view[0].submenu,
        ).toHaveLength(2);
    });

    test('a widget click toggles that widget', () => {
        const { handler } = init();

        handler(null, { widgetToggle: 'app-presenter-left::v2' });

        expect(mocks.toggleWidgetMock).toHaveBeenCalledWith(
            'app-presenter-left::v2',
        );
    });

    test('ignores menu clicks belonging to other features', () => {
        const { handler } = init();

        // Every menu click for this window reaches every registered handler,
        // including parents that carry no `clickData` at all.
        handler(null, undefined);
        handler(null, {});
        handler(null, { canvasInsert: 'camera' });

        expect(mocks.toggleWidgetMock).not.toHaveBeenCalled();
        expect(mocks.resetAllWidgetsMock).not.toHaveBeenCalled();
        expect(mocks.handleErrorMock).not.toHaveBeenCalled();
    });

    test('reset confirms, then clears the settings before restoring live', async () => {
        const { handler } = init();

        handler(null, { widgetReset: true });
        await vi.waitFor(() => {
            expect(mocks.resetAllWidgetsMock).toHaveBeenCalledTimes(1);
        });

        expect(mocks.showAppConfirmMock).toHaveBeenCalledWith(
            'tran:Reset Widgets Size',
            expect.stringContaining('tran:'),
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        // Clearing first is what gives the panes that are NOT mounted (other
        // pages, other windows, per-document panes) a clean slate.
        expect(
            mocks.clearWidgetSizeSettingMock.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.resetAllWidgetsMock.mock.invocationCallOrder[0]);
    });

    test('reset does nothing when the confirm is declined', async () => {
        mocks.showAppConfirmMock.mockResolvedValue(false);
        const { handler } = init();

        handler(null, { widgetReset: true });
        await vi.waitFor(() => {
            expect(mocks.showAppConfirmMock).toHaveBeenCalledTimes(1);
        });

        expect(mocks.clearWidgetSizeSettingMock).not.toHaveBeenCalled();
        expect(mocks.resetAllWidgetsMock).not.toHaveBeenCalled();
    });

    test('withdraws the menu on cleanup and on page navigation', () => {
        const addSpy = vi.spyOn(globalThis, 'addEventListener');
        const unsubscribe = vi.fn();
        mocks.subscribeWidgetsChangedMock.mockReturnValue(unsubscribe);
        const { cleanup } = init();

        const pageHideCall = addSpy.mock.calls.find(([name]) => {
            return name === 'pagehide';
        });
        expect(pageHideCall).toBeDefined();

        // A route change is a full page load, which React never cleans up
        // after: without this the checkboxes linger while their clicks land in
        // a renderer that no longer listens.
        (pageHideCall![1] as () => void)();
        expect(mocks.setAppMenuItemsMock).toHaveBeenLastCalledWith(
            'view-widgets',
            null,
        );

        mocks.setAppMenuItemsMock.mockClear();
        cleanup();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(mocks.unregisterMock).toHaveBeenCalledTimes(1);
        expect(mocks.setAppMenuItemsMock).toHaveBeenLastCalledWith(
            'view-widgets',
            null,
        );
        addSpy.mockRestore();
    });
});
