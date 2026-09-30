// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { presenter: true, menu: [] as any[], choose: null as any },
    mocks: { showMenu: vi.fn(), createEvent: vi.fn(), stop: vi.fn() },
}));

vi.mock('../_screen/managers/screenChoosingHelpers', () => ({
    genScreenIdMenuItems: (
        choose: (id: number) => void,
        checked: (id: number) => boolean,
    ) => {
        state.choose = choose;
        return [1, 2, 3].map((id) => ({
            menuElement: `screen-${id}`,
            checked: checked(id),
            onSelect: () => choose(id),
        }));
    },
}));
vi.mock('../_screen/preview/screenIdColorHelpers', () => ({
    genColorFromScreenId: (id: number) => `color-${id}`,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: mocks.createEvent,
    showAppContextMenu: (event: unknown, items: any[]) => {
        state.menu = items;
        mocks.showMenu(event, items);
    },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon-${name}`,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return state.presenter;
        },
    },
}));

import PresentingFlowScreenPinComp, {
    chooseScreenIdsPreset,
    genSetSpecificScreenContextMenu,
} from './PresentingFlowScreenPinComp';

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    state.presenter = true;
    state.menu = [];
    mocks.createEvent.mockReturnValue({ synthetic: true });
});

describe('screen pin UI', () => {
    test('renders no badge for inheritance and colored ids for explicit pins', () => {
        expect(
            renderToStaticMarkup(
                <PresentingFlowScreenPinComp screenIds={[]} />,
            ),
        ).toBe('');
        const html = renderToStaticMarkup(
            <PresentingFlowScreenPinComp screenIds={[2, 4]} />,
        );
        expect(html).toContain('Set Specific Screen: 2, 4');
        expect(html).toContain('color-2');
        expect(html).toContain('>2<');
        expect(html).toContain('>4<');
    });

    test('offers presenter-only pin editing and opens its checklist', () => {
        state.presenter = false;
        expect(genSetSpecificScreenContextMenu([], vi.fn())).toEqual([]);
        state.presenter = true;
        const setIds = vi.fn();
        const entry = genSetSpecificScreenContextMenu([2], setIds)[0];
        expect(entry.menuElement).toBe('Set Specific Screen');
        entry.onSelect?.({
            stopPropagation: mocks.stop,
            clientX: 10,
            clientY: 20,
        } as any);
        expect(mocks.stop).toHaveBeenCalled();
        expect(state.menu[0]).toMatchObject({
            menuElement: 'No Specific Screen',
            disabled: false,
        });
        state.menu[0].onSelect();
        expect(setIds).toHaveBeenCalledWith([]);
    });

    test('toggles, sorts, removes, and reopens at the original coordinates', () => {
        const setIds = vi.fn();
        chooseScreenIdsPreset([3, 1], setIds, {
            stopPropagation: mocks.stop,
            clientX: 7,
            clientY: 8,
        });
        state.choose(2);
        expect(setIds).toHaveBeenCalledWith([1, 2, 3]);
        vi.runAllTimers();
        expect(mocks.createEvent).toHaveBeenCalledWith(7, 8);
        expect(mocks.showMenu).toHaveBeenCalledTimes(2);
        state.choose(2);
        expect(setIds).toHaveBeenLastCalledWith([1, 3]);
        expect(state.menu[0].disabled).toBe(false);
        vi.useRealTimers();
    });
});
