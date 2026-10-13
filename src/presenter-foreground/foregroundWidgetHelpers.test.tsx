import { describe, expect, test, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
    state: {
        // [screenId, foregroundData] as the foreground setting holds them.
        foregroundList: [] as [number, any][],
        longTextScreenIds: [] as number[],
    },
}));

vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        getLongTextShowingList: () => {
            return state.longTextScreenIds.map((screenId) => {
                return [screenId, {}];
            });
        },
    },
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        checkIsOnScreen: (data: any) => boolean,
    ) => {
        return state.foregroundList.filter(([, data]) => {
            return checkIsOnScreen(data);
        });
    },
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    getRunningAutoPlayKeys: () => [],
}));
vi.mock('./foregroundAutoPlayPrefix', () => ({
    toForegroundAutoPlayPrefix: (key: string) => key,
}));

import {
    FOREGROUND_WIDGET_LIST,
    genForegroundPanelMenuItems,
    getForegroundWidgetShowingScreenIds,
    toOpenPanelKeys,
    toToggledPanelKeys,
} from './foregroundWidgetHelpers';

function getWidget(key: string) {
    const widget = FOREGROUND_WIDGET_LIST.find((item) => {
        return item.key === key;
    });
    if (widget === undefined) {
        throw new Error(`no foreground component "${key}"`);
    }
    return widget;
}

describe('the foreground launcher', () => {
    test('asks the foreground data for a component the foreground draws', () => {
        state.foregroundList = [
            [2, { messageDataList: [{ id: 'message-0' }] }],
            [0, { messageDataList: [{ id: 'message-1' }] }],
            [1, { messageDataList: [] }],
        ];
        state.longTextScreenIds = [5];
        // Lowest first, and a long text on screen 5 is no message.
        expect(
            getForegroundWidgetShowingScreenIds(getWidget('message')),
        ).toEqual([0, 2]);
    });

    test('asks the long-text layer for Long Text Show, which the foreground data knows nothing of', () => {
        const widget = getWidget('long-text');
        expect(widget.labelKey).toBe('Long Text Show');
        // Its layer has no transition of its own to offer.
        expect(widget.isNoTransition).toBe(true);
        state.foregroundList = [[0, { messageDataList: [{ id: 'm' }] }]];
        state.longTextScreenIds = [];
        expect(getForegroundWidgetShowingScreenIds(widget)).toEqual([]);
        state.longTextScreenIds = [3, 1, 3];
        expect(getForegroundWidgetShowingScreenIds(widget)).toEqual([1, 3]);
    });

    test('badges a launcher row with the screens its component is on', () => {
        state.foregroundList = [];
        state.longTextScreenIds = [1];
        const menuItems = genForegroundPanelMenuItems(
            'long-text',
            () => {},
            (labelKey) => labelKey,
        );
        const longTextItem = menuItems.find((item) => {
            return item.title === 'Long Text Show';
        });
        const messageItem = menuItems.find((item) => {
            return item.title === 'Messages';
        });
        const readBadges = (item: any) => {
            // menuElement: <span><span class?>label</span>{badges}{autoPlay}</span>
            const [label, badges] = item.menuElement.props.children;
            return {
                className: label.props.className,
                screenIds: badges.map((badge: any) => badge.props.children),
            };
        };
        expect(readBadges(longTextItem)).toEqual({
            className: 'app-on-screen',
            screenIds: [1],
        });
        expect(readBadges(messageItem)).toEqual({
            className: '',
            screenIds: [],
        });
    });

    test('keeps only the panels there are, and toggles one', () => {
        expect(toOpenPanelKeys('message, long-text,gone')).toEqual([
            'message',
            'long-text',
        ]);
        expect(toToggledPanelKeys('message', 'long-text')).toBe(
            'message,long-text',
        );
        expect(toToggledPanelKeys('message,long-text', 'message')).toBe(
            'long-text',
        );
    });
});
