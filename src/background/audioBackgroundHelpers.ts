import { dirSourceSettingNames } from '../helper/constants';
import { genTimeoutAttempt } from '../helper/helpers';
import { getSetting } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { showSimpleToast } from '../toast/toastHelpers';

export function showAudioPlayingToast() {
    showSimpleToast(
        tran('Audio playing'),
        tran('Please stop the audio before leaving the page.'),
    );
}

const attemptTimeout = genTimeoutAttempt(3000);
let attemptCount = 0;
function blockUnload(event: BeforeUnloadEvent) {
    attemptTimeout(() => {
        attemptCount = 0;
    });
    attemptCount++;
    if (attemptCount > 3) {
        window.removeEventListener('beforeunload', blockUnload);
        return;
    }
    event.preventDefault();
    showAudioPlayingToast();
}

export function checkAudioPlaying() {
    return Array.from(document.querySelectorAll('audio')).some(
        (audioElement) => {
            return !audioElement.paused;
        },
    );
}

export const audioEvent = {
    onChange: (_isPlay: boolean) => {},
};

export function handleAudioPlaying(event: any) {
    const audioElement = event.target;
    const audioElements = document.querySelectorAll('audio');
    for (const element of audioElements) {
        if (element !== audioElement) {
            element.pause();
            element.currentTime = 0;
        }
    }
    window.addEventListener('beforeunload', blockUnload);
    audioEvent.onChange(checkAudioPlaying());
}

export function handleAudioPausing(_event: any) {
    const isPlaying = checkAudioPlaying();
    if (!isPlaying) {
        window.removeEventListener('beforeunload', blockUnload);
    }
    audioEvent.onChange(isPlaying);
}

export function getAudioRepeatSettingName(src: string) {
    const md5 = appProvider.systemUtils.generateMD5(src);
    const settingName =
        dirSourceSettingNames.BACKGROUND_AUDIO + '-repeat-' + md5;
    return settingName;
}

export function handleAudioEnding(event: any) {
    const audioElement = event.target;
    audioElement.currentTime = 0;
    const isRepeating =
        getSetting(audioElement.dataset.repeatSettingName) === 'true';
    if (isRepeating) {
        audioElement.play();
        return;
    }
    const isPlaying = checkAudioPlaying();
    if (!isPlaying) {
        window.removeEventListener('beforeunload', blockUnload);
    }
    audioEvent.onChange(isPlaying);
}
