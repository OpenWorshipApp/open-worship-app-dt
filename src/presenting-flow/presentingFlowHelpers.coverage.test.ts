// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dragData: null as any,
        droppedData: null as any,
        manager: null as any,
    },
    mocks: {
        applyChosen: vi.fn(),
        chooseIds: vi.fn(),
        showDropped: vi.fn(),
        genIcon: vi.fn((name: string) => `icon:${name}`),
        removePrefix: vi.fn(),
        toast: vi.fn(),
        fireRun: vi.fn(),
        armCc: vi.fn(),
    },
}));

vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    applyOnChosenScreens: mocks.applyChosen,
    chooseScreenIdsOnEvent: mocks.chooseIds,
    showDroppedDataOnScreens: mocks.showDropped,
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getScreenManagerByKey: () => state.manager,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: mocks.genIcon,
}));
vi.mock('../helper/dragHelpers', () => ({
    extractDragData: () => state.dragData,
    deserializeDragData: () => state.droppedData,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../helper/settingHelpers', () => ({
    removeSettingsByPrefix: mocks.removePrefix,
    toFilePathSettingKey: (...parts: string[]) => parts.join('~'),
    toFilePathSettingName: (prefix: string, ...parts: string[]) =>
        [prefix, ...parts].join('~'),
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('./presentingFlowAutoNextHelpers', () => ({
    firePresentingFlowRunAction: mocks.fireRun,
}));
vi.mock('./presentingFlowCcApplyHelpers', () => ({
    armPresentingFlowCcPropagation: mocks.armCc,
}));

import { DragTypeEnum } from '../helper/DragInf';
import {
    UNSUPPORTED_DROP_PAYLOAD,
    extractDropPayload,
    genDisableContextMenu,
    handlePresentingFlowItemScreenDropping,
    removePresentingFlowSettings,
    sendPresentingFlowItemToScreens,
    toDocumentIcon,
    toDragTypeIconName,
    toPresentingFlowRowDropKind,
    toPresentingFlowSettingKey,
    toPresentingFlowSettingName,
} from './presentingFlowHelpers';

function item(overrides: Record<string, unknown> = {}) {
    return {
        isDisabled: false,
        isAction: false,
        isRunAction: false,
        hostsCcFollowers: false,
        ccItems: [],
        screenIds: [],
        screenAction: null,
        toDroppedData: vi.fn(async () => ({ type: 'slide' })),
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.dragData = null;
    state.droppedData = null;
    state.manager = null;
    mocks.removePrefix.mockImplementation(async (prefix: string) => [prefix]);
    mocks.applyChosen.mockImplementation(async (_e, _f, callback) =>
        callback({ id: 1 }),
    );
});

describe('presenting-flow shared helpers', () => {
    test('maps icons and setting names and removes every persisted prefix', async () => {
        expect(toDragTypeIconName(DragTypeEnum.BACKGROUND_IMAGE)).toBe(
            'file-earmark-image',
        );
        expect(toDragTypeIconName('unknown')).toBe('question-diamond');
        expect(toDocumentIcon('/A.PDF')).toEqual([
            'file-earmark-pdf',
            '#bd0b02',
        ]);
        expect(toDocumentIcon('/song.owl')).toEqual(['music-note']);
        expect(toDocumentIcon('/no-extension')).toEqual([
            'file-earmark-slides',
        ]);
        expect(toPresentingFlowSettingKey('/a', 'b')).toBe('/a~b');
        expect(toPresentingFlowSettingName('prefix', '/a')).toBe('prefix~/a');
        expect(await removePresentingFlowSettings('/a')).toHaveLength(4);
        expect(mocks.removePrefix).toHaveBeenCalledTimes(4);
    });

    test('builds a reversible disable menu', () => {
        const setDisabled = vi.fn();
        const enabledMenu = genDisableContextMenu(false, setDisabled)[0];
        expect(enabledMenu.menuElement).toBe('Disable');
        enabledMenu.onSelect?.({} as any);
        expect(setDisabled).toHaveBeenCalledWith(true);
        const disabledMenu = genDisableContextMenu(true, setDisabled)[0];
        expect(disabledMenu.menuElement).toBe('Enable');
        disabledMenu.onSelect?.({} as any);
        expect(setDisabled).toHaveBeenCalledWith(false);
    });

    test('classifies the row drop target from modifiers and edge geometry', () => {
        const event = (clientY: number, keys = {}) => ({
            clientY,
            currentTarget: {
                getBoundingClientRect: () => ({ top: 10, height: 30 }),
            },
            ...keys,
        });
        expect(
            toPresentingFlowRowDropKind(event(20, { ctrlKey: true }), true),
        ).toBe('position');
        expect(
            toPresentingFlowRowDropKind(event(20, { metaKey: true }), true),
        ).toBe('position');
        expect(
            toPresentingFlowRowDropKind(event(20, { altKey: true }), true),
        ).toBe('cc');
        expect(toPresentingFlowRowDropKind(event(20), false)).toBe('cc');
        expect(toPresentingFlowRowDropKind(event(11), true)).toBe('position');
        expect(toPresentingFlowRowDropKind(event(39), true)).toBe('position');
        expect(toPresentingFlowRowDropKind(event(25), true)).toBe('cc');
    });

    test('distinguishes absent, unsupported, and decoded drag payloads', () => {
        expect(extractDropPayload({})).toBeNull();
        state.dragData = { type: 'anything' };
        expect(extractDropPayload({})).toBe(UNSUPPORTED_DROP_PAYLOAD);
        state.droppedData = { type: 'slide', data: 1 };
        expect(extractDropPayload({})).toEqual({
            dragData: state.dragData,
            droppedData: state.droppedData,
        });
    });

    test('drops content or actions directly on a named screen preview', async () => {
        const div = document.createElement('div');
        const receive = vi.fn();
        state.manager = { receiveScreenDropped: receive };
        await handlePresentingFlowItemScreenDropping(
            item({ isDisabled: true }),
            { currentTarget: div },
        );
        await handlePresentingFlowItemScreenDropping(item(), {
            currentTarget: {},
        });
        await handlePresentingFlowItemScreenDropping(item(), {
            currentTarget: div,
        });
        div.dataset.screenKey = 'screen-1';
        state.manager = null;
        await handlePresentingFlowItemScreenDropping(item(), {
            currentTarget: div,
        });
        state.manager = { receiveScreenDropped: receive };
        const apply = vi.fn();
        await handlePresentingFlowItemScreenDropping(
            item({ isAction: true, screenAction: { apply } }),
            { currentTarget: div },
        );
        expect(apply).toHaveBeenCalledWith(state.manager, expect.anything());
        const content = item();
        await handlePresentingFlowItemScreenDropping(content, {
            currentTarget: div,
        });
        expect(receive).toHaveBeenCalledWith({ type: 'slide' });
        await handlePresentingFlowItemScreenDropping(
            item({ toDroppedData: vi.fn(async () => null) }),
            { currentTarget: div },
        );
    });

    test('fires run actions and resolves follower-only run actions to screens', async () => {
        const event = { type: 'click' };
        await sendPresentingFlowItemToScreens(
            item({ isDisabled: true }),
            event,
        );
        const emptyRun = item({ isRunAction: true });
        await sendPresentingFlowItemToScreens(emptyRun, event);
        expect(mocks.fireRun).toHaveBeenCalledWith(emptyRun);
        const ccItems = [{ uuid: 'cc' }];
        await sendPresentingFlowItemToScreens(
            item({
                isRunAction: true,
                hostsCcFollowers: true,
                ccItems,
                screenIds: [2],
            }),
            event,
            true,
        );
        expect(mocks.armCc).toHaveBeenCalledWith(event, ccItems);
        expect(mocks.chooseIds).toHaveBeenCalledWith(event, true, [2]);
    });

    test('applies screen actions and sends resolved content with adjacent CC arming', async () => {
        const event = { type: 'click' };
        const apply = vi.fn();
        await sendPresentingFlowItemToScreens(
            item({
                screenIds: [],
                screenAction: {
                    requiresScreenIds: true,
                    label: 'Screen: Show',
                    apply,
                },
            }),
            event,
        );
        expect(mocks.toast).toHaveBeenCalledWith(
            'Screen: Show',
            'Please choose at least one screen',
        );
        expect(mocks.armCc).not.toHaveBeenCalled();

        const actionItem = item({
            screenIds: [3],
            ccItems: [{ uuid: 'c' }],
            screenAction: { requiresScreenIds: false, label: 'Clear', apply },
        });
        await sendPresentingFlowItemToScreens(actionItem, event);
        expect(mocks.armCc).toHaveBeenCalledWith(event, actionItem.ccItems);
        expect(apply).toHaveBeenCalledWith({ id: 1 }, actionItem);

        const unreadable = item({ toDroppedData: vi.fn(async () => null) });
        await sendPresentingFlowItemToScreens(unreadable, event);
        expect(mocks.toast).toHaveBeenCalledWith(
            'Showing Presenting Flow Item',
            'Fail to read file data',
        );
        const content = item({ screenIds: [1], ccItems: [{ uuid: 'f' }] });
        await sendPresentingFlowItemToScreens(content, event, true);
        expect(mocks.showDropped).toHaveBeenCalledWith(
            event,
            { type: 'slide' },
            true,
            [1],
        );
    });
});
