import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        showDropped: vi.fn(),
        handleError: vi.fn(),
        revealItem: vi.fn(),
        revealSlide: vi.fn(),
        send: vi.fn(),
        chooseColor: vi.fn(),
        askArming: vi.fn(),
    },
}));

vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    showDroppedDataOnScreens: mocks.showDropped,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon-${name}`,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/FileItemHandlerComp', () => ({
    genRevealOriginal: (callback: () => void) => ({
        menuElement: 'Reveal Original',
        onSelect: callback,
    }),
    genShowOnScreensContextMenu: (
        callback: (event: unknown) => void,
        label?: string,
    ) => [{ menuElement: label ?? 'Show on Screens', onSelect: callback }],
}));
vi.mock('../others/ItemColorNoteComp', () => ({
    chooseColorNote: mocks.chooseColor,
}));
vi.mock('./presentingFlowActionArmingHelpers', () => ({
    askForPresentingFlowActionArming: mocks.askArming,
}));
vi.mock('./PresentingFlowCcRowsComp', () => ({
    genAddCcElementsContextMenu: (_host: unknown, uuid: unknown) => [
        { menuElement: 'Add CC', uuid },
    ],
    genAddMediaControlContextMenu: () => [{ menuElement: 'Add Media' }],
}));
vi.mock('./presentingFlowHelpers', () => ({
    genDisableContextMenu: (
        disabled: boolean,
        set: (value: boolean) => void,
    ) => [
        {
            menuElement: disabled ? 'Enable' : 'Disable',
            onSelect: () => set(!disabled),
        },
    ],
    sendPresentingFlowItemToScreens: mocks.send,
}));
vi.mock('./presentingFlowOriginHelpers', () => ({
    notifyPresentingFlowItemOrigin: mocks.revealItem,
    notifyVarySlideOrigin: mocks.revealSlide,
}));
vi.mock('./PresentingFlowScreenPinComp', () => ({
    genSetSpecificScreenContextMenu: (
        _ids: number[],
        set: (ids: number[]) => void,
    ) => [{ menuElement: 'Set Specific Screen', onSelect: () => set([2]) }],
}));

import {
    genPresentingFlowItemContextMenuItems,
    genPresentingFlowVarySlideContextMenuItems,
} from './presentingFlowItemMenuHelpers';

function flow() {
    return {
        moveItemToIndex: vi.fn(),
        duplicateItemAtIndex: vi.fn(),
        setItemColorNote: vi.fn(),
        setItemDisabled: vi.fn(),
        removeItemAtIndex: vi.fn(),
        setItemScreenIds: vi.fn(),
        setItemActionArming: vi.fn(),
    } as any;
}

function item(overrides: Record<string, unknown> = {}) {
    return {
        isAction: false,
        isScreenReachable: true,
        isDisabled: false,
        runAction: null,
        isScreenPinnable: true,
        screenIds: [],
        canHostMoreCcItems: true,
        isSlide: true,
        isAppDocument: false,
        uuid: 'uuid',
        colorNote: null,
        actionArming: {},
        hostsCcFollowers: false,
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.askArming.mockResolvedValue(null);
});

describe('presenting-flow item menus', () => {
    test('builds and executes the complete content-entry menu', () => {
        const model = flow();
        const entry = item({ colorNote: '#123' });
        const menu = genPresentingFlowItemContextMenuItems(model, entry, 1, 3);
        expect(menu.map((one) => one.menuElement)).toEqual([
            'Reveal Original',
            'Show on Screens',
            'Set Specific Screen',
            'Add CC',
            'Add Media',
            'Move up',
            'Move to Top',
            'Move down',
            'Move to Bottom',
            'Duplicate',
            'Choose Color',
            'Disable',
            'Remove from Presenting Flow',
        ]);
        for (const one of menu) one.onSelect?.({ type: 'contextmenu' } as any);
        expect(mocks.revealItem).toHaveBeenCalledWith(entry);
        expect(mocks.send).toHaveBeenCalledWith(entry, expect.anything(), true);
        expect(model.setItemScreenIds).toHaveBeenCalledWith(1, [2]);
        expect(model.moveItemToIndex).toHaveBeenCalledWith(1, 0);
        expect(model.moveItemToIndex).toHaveBeenCalledWith(1, 2);
        expect(model.duplicateItemAtIndex).toHaveBeenCalledWith(1);
        expect(model.setItemDisabled).toHaveBeenCalledWith(1, true);
        expect(model.removeItemAtIndex).toHaveBeenCalledWith(1);
        const colorCallback = mocks.chooseColor.mock.calls[0][1];
        colorCallback('#456');
        expect(model.setItemColorNote).toHaveBeenCalledWith(1, '#456');
    });

    test('builds run-action labels, fires them, and applies successful re-arming', async () => {
        const model = flow();
        const clock = item({
            isAction: true,
            isScreenReachable: false,
            isScreenPinnable: false,
            canHostMoreCcItems: false,
            runAction: {
                iconName: 'clock',
                color: 'red',
                number: {},
                canBeKeyArmed: false,
                canBeTimeArmed: true,
                label: 'Timeout',
            },
        });
        mocks.askArming.mockResolvedValueOnce({ actionNumber: 8 });
        const menu = genPresentingFlowItemContextMenuItems(model, clock, 0, 1);
        expect(menu.map((one) => one.menuElement)).toContain('Start Auto Next');
        expect(menu.map((one) => one.menuElement)).toContain('Change Timing');
        menu.find((one) => one.menuElement === 'Start Auto Next')?.onSelect?.(
            {} as any,
        );
        menu.find((one) => one.menuElement === 'Change Timing')?.onSelect?.(
            {} as any,
        );
        await vi.waitFor(() =>
            expect(model.setItemActionArming).toHaveBeenCalledWith(0, {
                actionNumber: 8,
            }),
        );

        const keyboard = item({
            isAction: true,
            isScreenReachable: false,
            isScreenPinnable: false,
            runAction: {
                iconName: 'key',
                color: 'pink',
                number: null,
                canBeKeyArmed: true,
                canBeTimeArmed: false,
                label: 'Keyboard',
            },
            hostsCcFollowers: true,
        });
        expect(
            genPresentingFlowItemContextMenuItems(model, keyboard, 0, 1).map(
                (one) => one.menuElement,
            ),
        ).toContain('Apply on Screens');
        expect(
            genPresentingFlowItemContextMenuItems(model, keyboard, 0, 1).map(
                (one) => one.menuElement,
            ),
        ).toContain('Change Shortcut');
    });

    test('omits activation for parked or terminal entries and reports arming errors', async () => {
        const model = flow();
        const parked = item({
            isDisabled: true,
            runAction: {
                iconName: 'x',
                color: 'x',
                number: {},
                canBeKeyArmed: false,
                canBeTimeArmed: false,
                label: 'Interval',
            },
        });
        mocks.askArming.mockRejectedValueOnce(new Error('failed'));
        const menu = genPresentingFlowItemContextMenuItems(model, parked, 0, 1);
        expect(menu.map((one) => one.menuElement)).not.toContain(
            'Start Auto Next',
        );
        expect(menu.map((one) => one.menuElement)).toContain('Change Seconds');
        menu.find((one) => one.menuElement === 'Change Seconds')?.onSelect?.(
            {} as any,
        );
        await vi.waitFor(() => expect(mocks.handleError).toHaveBeenCalled());
        expect(menu.map((one) => one.menuElement)).not.toContain('Move up');
        expect(menu.map((one) => one.menuElement)).not.toContain('Move down');
    });

    test('builds slide menus with optional pin, disable, and CC families', () => {
        const slide = { id: 7, dragType: 'slide' } as any;
        const setIds = vi.fn();
        const setDisabled = vi.fn();
        const menu = genPresentingFlowVarySlideContextMenuItems({
            varySlide: slide,
            isDisabled: false,
            isOwnDisabled: false,
            ownScreenIds: [1],
            setSlideScreenIds: setIds,
            setSlideDisabled: setDisabled,
            ccHost: {} as any,
        });
        expect(menu.map((one) => one.menuElement)).toEqual([
            'Reveal Original',
            'Show on Screens',
            'Set Specific Screen',
            'Disable',
            'Add CC',
            'Add Media',
        ]);
        for (const one of menu) one.onSelect?.({ type: 'contextmenu' } as any);
        expect(mocks.revealSlide).toHaveBeenCalledWith(slide);
        expect(mocks.showDropped).toHaveBeenCalledWith(
            expect.anything(),
            { type: 'slide', item: slide },
            true,
        );
        expect(setIds).toHaveBeenCalledWith(7, [2]);
        expect(setDisabled).toHaveBeenCalledWith(7, true);
        const minimal = genPresentingFlowVarySlideContextMenuItems({
            varySlide: slide,
            isDisabled: true,
            isOwnDisabled: true,
            ownScreenIds: [],
        });
        expect(minimal.map((one) => one.menuElement)).toEqual([
            'Reveal Original',
        ]);
    });
});
