import { describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/MediaSessionsComp', () => ({
    default: () => null,
    DEFAULT_SESSION_ID: '',
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
    toOwnerSessionId,
    toSessionShowingList,
} from './foregroundSessionHelpers';

const SESSION_IDS = ['', 'two', 'three'];

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
        expect(checkIsSessionData({}, 'default', SESSION_IDS)).toBe(false);
        expect(checkIsSessionData({}, '', SESSION_IDS)).toBe(true);
        expect(checkIsSessionData({ id: 'two' }, 'two', SESSION_IDS)).toBe(
            true,
        );
        expect(
            toSessionShowingList(
                [
                    [1, {}],
                    [2, { id: 'two' }],
                    [3, { id: 'three' }],
                ],
                'two',
                SESSION_IDS,
            ),
        ).toEqual([[2, { id: 'two' }]]);
    });
    test("lists only the session in front's overlay, never Default's under Session 2", () => {
        // The reported bug: Default's marquee was on screen 0, and Session
        // 2's panel offered `Hide Marquee Bottom 0` as though it were its own.
        const showing: [number, { id?: string }][] = [[0, {}]];
        expect(toSessionShowingList(showing, 'two', SESSION_IDS)).toEqual([]);
        expect(toSessionShowingList(showing, '', SESSION_IDS)).toEqual([
            [0, {}],
        ]);
    });
    test('gives an overlay whose session is gone to the first session', () => {
        // Default removed: a drag, a run-sheet row or the assistant still puts
        // an overlay up with no id, and it must keep one Hide row.
        expect(toOwnerSessionId({}, ['two', 'three'])).toBe('two');
        expect(toOwnerSessionId({ id: 'gone' }, SESSION_IDS)).toBe('');
        expect(toOwnerSessionId({ id: 'three' }, SESSION_IDS)).toBe('three');
        expect(toOwnerSessionId({ id: 'two' }, [])).toBe('two');
        expect(
            toSessionShowingList(
                [
                    [0, {}],
                    [1, { id: 'three' }],
                ],
                'two',
                ['two', 'three'],
            ),
        ).toEqual([[0, {}]]);
    });
});
