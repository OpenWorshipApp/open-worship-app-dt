import { expect, test, vi } from 'vitest';

vi.mock('./foregroundDecorationHelpers', () => ({
    DEFAULT_MESSAGE_LINE_HEIGHT: 1.35,
    getDecorationBorderWidth: (data: any) =>
        data.borderStyle === 'none' ? 0 : data.borderWidth,
    getForegroundDecoration: () => ({
        lineHeight: 2,
        padding: 0.5,
        borderStyle: 'solid',
        borderWidth: 2,
    }),
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/settingHelpers', () => ({}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: {},
    MESSAGE_ALL_ID: 'message-all',
}));
vi.mock('./foregroundHelpers', () => ({}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({}));
vi.mock('./ScreensRendererComp', () => ({ default: () => null }));
vi.mock('../_screen/managers/screenEventHelpers', () => ({}));
vi.mock('./propertiesSettingHelpers', () => ({}));
vi.mock('./ForegroundPropRowComp', () => ({ default: () => null }));
vi.mock('./ForegroundLayoutComp', () => ({ default: () => null }));
vi.mock('./SavedTextSessionButtonsComp', () => ({ default: () => null }));
vi.mock('../helper/dragHelpers', () => ({}));
vi.mock('./foregroundDragHelpers', () => ({}));
vi.mock('../helper/timeoutHelpers', () => ({}));
vi.mock('../helper/appHooks', () => ({}));
vi.mock('../event/KeyboardEventListener', () => ({}));
vi.mock('./foregroundSessionHelpers', () => ({}));
vi.mock('../toast/toastHelpers', () => ({}));
import {
    genStackedMessageDataList,
    checkIsShowingId,
    toLineList,
    toMessageList,
    toMessageAllId,
    toMessageSessionId,
    toStoredText,
} from './ForegroundMessageComp';

test('persists empty editors and preserves per-message stack offsets after a style update', () => {
    expect(toStoredText([{ id: 'message-0', text: '' }])).toBe(' ');
    expect(toStoredText([])).toBe('');
    expect(toMessageSessionId('message-3-sunday')).toBe('sunday');
    expect(toMessageSessionId('message-all')).toBe('');
    expect(toMessageSessionId('custom')).toBe('');
    expect(toMessageAllId('-sunday')).toBe('message-all-sunday');
    expect(toMessageList('First\n\nSecond  ', '-s2')).toEqual([
        { id: 'message-0-s2', text: 'First' },
        { id: 'message-1-s2', text: 'Second' },
    ]);
    expect(toLineList('One\n\n')).toEqual(['One', '']);
    const data = genStackedMessageDataList(
        [
            { id: 'message-0', text: 'One\nTwo' },
            { id: 'message-1', text: 'Three' },
        ],
        ['message-0', 'message-1'],
        { color: 'white' },
        'message',
    );
    expect(data).toHaveLength(2);
    expect(data[0].extraStyle).toEqual({ color: 'white' });
    expect(data[1].extraStyle).toEqual({
        color: 'white',
        marginTop: 'calc(5em + 4px)',
    });
    expect(
        genStackedMessageDataList(
            [
                { id: 'message-0', text: '' },
                { id: 'message-1', text: 'Shown' },
            ],
            ['message-0', 'message-1'],
            {},
            'message',
        ),
    ).toEqual([
        expect.objectContaining({ id: 'message-1', textList: ['Shown'] }),
    ]);
    expect(
        checkIsShowingId(
            [
                [1, { id: 'message-1' }],
                [2, { id: 'message-2' }],
            ] as any,
            'message-2',
        ),
    ).toBe(true);
    expect(
        checkIsShowingId([[1, { id: 'message-1' }]] as any, 'message-2'),
    ).toBe(false);
});
