import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getSettingMock, setSettingMock, fileSourceGetInstanceMock } =
    vi.hoisted(() => ({
        getSettingMock: vi.fn(),
        setSettingMock: vi.fn(),
        fileSourceGetInstanceMock: vi.fn(),
    }));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

import {
    getIsFadingAtTheEndSetting,
    methodMapIsFadingAtTheEnd,
    setIsFadingAtTheEndSetting,
} from './videoBackgroundHelpers';

describe('videoBackgroundHelpers', () => {
    afterEach(() => {
        delete methodMapIsFadingAtTheEnd['/videos/clip.mp4'];
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('prefers explicitly stored fading settings', () => {
        getSettingMock.mockReturnValue(
            JSON.stringify({ '/videos/clip.mp4': false }),
        );

        expect(getIsFadingAtTheEndSetting('/videos/clip.mp4')).toBe(false);
        expect(fileSourceGetInstanceMock).not.toHaveBeenCalled();
    });

    test('falls back to filename heuristics when stored settings are invalid', () => {
        getSettingMock.mockReturnValue('not-json');
        fileSourceGetInstanceMock.mockReturnValueOnce({
            name: 'ambient.loop.mp4',
        });
        fileSourceGetInstanceMock.mockReturnValueOnce({ name: 'ambient.mp4' });

        expect(getIsFadingAtTheEndSetting('/videos/loop.mp4')).toBe(false);
        expect(getIsFadingAtTheEndSetting('/videos/plain.mp4')).toBe(true);
    });

    test('updates listeners and persists fading settings', () => {
        const callbackMock = vi.fn();
        methodMapIsFadingAtTheEnd['/videos/clip.mp4'] = callbackMock;
        getSettingMock.mockReturnValue(
            JSON.stringify({ '/videos/other.mp4': false }),
        );

        setIsFadingAtTheEndSetting('/videos/clip.mp4', true);

        expect(callbackMock).toHaveBeenCalledWith(true);
        expect(setSettingMock).toHaveBeenCalledWith(
            'video-fading-at-the-end',
            JSON.stringify({
                '/videos/other.mp4': false,
                '/videos/clip.mp4': true,
            }),
        );
    });
});
