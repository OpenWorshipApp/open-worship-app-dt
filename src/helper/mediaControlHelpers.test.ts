// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lang/langHelpers', () => {
    return { tran: (text: string) => text };
});
vi.mock('../toast/toastHelpers', () => {
    return { showSimpleToast: vi.fn() };
});
// `appProvider` reads the electron preload at module load, which jsdom has
// not got. Stubbed locally, the way every other test here does it -- there is
// deliberately no shared mock.
vi.mock('../server/appProvider', () => {
    return { default: {} };
});

import {
    BACKGROUND_AUDIO_ATTR,
    checkAudioPlaying,
    checkBackgroundAudioPlaying,
} from './mediaControlHelpers';

function addAudio({
    isBackground,
    isPaused,
}: {
    isBackground: boolean;
    isPaused: boolean;
}) {
    const audioElement = document.createElement('audio');
    if (isBackground) {
        audioElement.setAttribute(BACKGROUND_AUDIO_ATTR, 'true');
    }
    // jsdom's `paused` is a read-only getter that is always `true`; the code
    // under test only ever reads it, so a per-element override is the whole
    // fixture.
    Object.defineProperty(audioElement, 'paused', {
        value: isPaused,
        configurable: true,
    });
    document.body.append(audioElement);
    return audioElement;
}

describe('checkBackgroundAudioPlaying', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('is false with nothing on the page', () => {
        expect(checkBackgroundAudioPlaying()).toBe(false);
    });

    it('is true while a background track is playing', () => {
        addAudio({ isBackground: true, isPaused: false });
        expect(checkBackgroundAudioPlaying()).toBe(true);
    });

    it('is false once every background track is paused', () => {
        addAudio({ isBackground: true, isPaused: true });
        addAudio({ isBackground: true, isPaused: true });
        expect(checkBackgroundAudioPlaying()).toBe(false);
    });

    it('stays true while ONE of several background tracks plays', () => {
        // The regression this exists for: starting a track pauses its
        // siblings first, and each of those pauses fires its own
        // `AUDIO_PLAYING_CHANGE_EVENT(null)` AFTER the play event. A listener
        // that believed the last payload turned the Audios tab's on-air dot
        // off while a track was still running. Read off the DOM, this shape
        // -- one playing, the rest paused -- is unambiguous.
        addAudio({ isBackground: true, isPaused: true });
        addAudio({ isBackground: true, isPaused: false });
        addAudio({ isBackground: true, isPaused: true });
        expect(checkBackgroundAudioPlaying()).toBe(true);
    });

    it('ignores audio that is not the background tab', () => {
        // The mini-screen background-video handler and the slide editor's
        // preview are `<audio>` too; the Audios TAB marker is not about them.
        addAudio({ isBackground: false, isPaused: false });
        expect(checkBackgroundAudioPlaying()).toBe(false);
        // ...while the broader unload guard still counts it.
        expect(checkAudioPlaying()).toBe(true);
    });
});
