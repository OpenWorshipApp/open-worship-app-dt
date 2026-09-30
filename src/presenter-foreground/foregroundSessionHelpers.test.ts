import { describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/MediaSessionsComp', () => ({
    default: () => null,
    toSessionSuffix: (id: string) => (id === 'default' ? '' : `-${id}`),
    useMediaSessions: () => ({ sessions: [], activeId: 'default' }),
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: <T>(value: T) => ({ current: value }),
}));
vi.mock('./propertiesSettingHelpers', () => ({
    genPropsSettingNames: () => ({ width: 'width', height: 'height' }),
}));
vi.mock('./ForegroundCommonPropertiesSettingComp', () => ({
    genCommonStyleSettingNames: () => ({ font: 'font' }),
}));
vi.mock('./foregroundDecorationHelpers', () => ({
    genDecorationSettingName: () => 'decoration',
}));

import {
    checkIsSessionData,
    genForegroundPropsSettingNames,
    toSessionShowingList,
} from './foregroundSessionHelpers';

describe('foreground sessions', () => {
    test('collects every session-owned setting so removing a session leaves no stale files', () => {
        expect(genForegroundPropsSettingNames('message-a')).toEqual([
            'width',
            'height',
            'font',
            'decoration',
            'foreground-message-a-show-properties-setting',
        ]);
    });
    test('matches legacy no-id data to Default and filters a properties update to its own session', () => {
        expect(checkIsSessionData({}, 'default')).toBe(false);
        expect(checkIsSessionData({}, '')).toBe(true);
        expect(checkIsSessionData({ id: 'two' }, 'two')).toBe(true);
        expect(
            toSessionShowingList(
                [
                    [1, {}],
                    [2, { id: 'two' }],
                    [3, { id: 'other' }],
                ],
                'two',
            ),
        ).toEqual([[2, { id: 'two' }]]);
    });
});
