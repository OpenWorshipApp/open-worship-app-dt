import { dirSourceSettingNames } from '../helper/constants';
import { genTimeoutAttempt } from '../helper/helpers';
import { getSetting } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';
import { showSimpleToast } from '../toast/toastHelpers';

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
    showSimpleToast(
        '`Audio playing',
        '`Please stop the audio before leaving the page.',
    );
}

function checkAudioPlaying() {
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
    audioElements.forEach((element) => {
        if (element !== audioElement) {
            element.pause();
            element.currentTime = 0;
        }
    });
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

export function getSoundRepeatSettingName(src: string) {
    const md5 = appProvider.systemUtils.generateMD5(src);
    const settingName =
        dirSourceSettingNames.BACKGROUND_SOUND + '-repeat-' + md5;
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
