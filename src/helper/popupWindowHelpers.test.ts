// @vitest-environment jsdom

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    type MockInstance,
    test,
    vi,
} from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: {
        POPUP_FRAME_NAME_PREFIX: 'owa-popup',
        aichatHomePage: 'https://localhost:3000/aichat.html',
    },
}));

import {
    checkIsPopupWindow,
    genAiChatWindowUuid,
    openAiChatPage,
    openPopupWindow,
} from './popupWindowHelpers';

const originalWindowName = window.name;
let openSpy: MockInstance<typeof window.open>;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_760_000_000_000);
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
    window.name = originalWindowName;
    vi.useRealTimers();
});

describe('checkIsPopupWindow', () => {
    test('a window stamped with the popup prefix is a popup', () => {
        window.name = 'owa-popup_reader';
        expect(checkIsPopupWindow()).toBe(true);
    });

    test('the main window has no name, so it is not', () => {
        window.name = '';
        expect(checkIsPopupWindow()).toBe(false);
        // Only a name that STARTS with the prefix counts.
        window.name = 'reader_owa-popup';
        expect(checkIsPopupWindow()).toBe(false);
    });
});

describe('the AI Chat window', () => {
    test('each press gets a fresh uuid from the clock', () => {
        expect(genAiChatWindowUuid()).toBe('aichat_1760000000000');
        vi.advanceTimersByTime(1);
        expect(genAiChatWindowUuid()).toBe('aichat_1760000000001');
    });

    test('opened from its button it stands beside the app', () => {
        openAiChatPage();
        expect(openSpy).toHaveBeenCalledExactlyOnceWith(
            'https://localhost:3000/aichat.html?uuid=aichat_1760000000000',
            'owa-popup_aichat_1760000000000',
            'popup,width=460,height=640,appGlassy,appAlignHorizontal=right,' +
                'appAlignVertical=center,appFollowScale,appTopToMain',
        );
    });

    test('a dragged-out tab opens where it was dropped, under its own uuid', () => {
        openAiChatPage('aichat_42', { x: 100.6, y: 49.4 });
        expect(openSpy).toHaveBeenCalledExactlyOnceWith(
            'https://localhost:3000/aichat.html?uuid=aichat_42',
            'owa-popup_aichat_42',
            'popup,width=460,height=640,appGlassy,x=101,y=49,' +
                'appFollowScale,appTopToMain',
        );
    });
});

describe('openPopupWindow features', () => {
    test('a window asking for Blink features gets a process of its own', () => {
        openPopupWindow('/reader.html', 'reader', 'r1', {
            appBlinkFeatures: ['CanvasDrawElement', 'Other'],
            appResize: false,
        });
        expect(openSpy).toHaveBeenCalledExactlyOnceWith(
            `${location.protocol}//${location.host}/reader.html?uuid=r1`,
            'owa-popup_reader',
            'popup,appBlinkFeatures=CanvasDrawElement+Other,appResize=false,' +
                'noopener',
        );
    });

    test('an empty Blink feature list is neither sent nor costs the opener', () => {
        openPopupWindow('https://localhost:3000/reader.html', 'reader', 'r2', {
            appBlinkFeatures: [],
        });
        expect(openSpy.mock.calls[0][2]).toBe('popup');
    });
});
