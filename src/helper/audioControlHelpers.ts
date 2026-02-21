import { genTimeoutAttempt } from './helpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import EventHandler from '../event/EventHandler';

export const AUDIO_PLAYING_CHANGE_EVENT = 'audio-playing-change';

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
    EventHandler.addPropEvent(AUDIO_PLAYING_CHANGE_EVENT, audioElement);
}

export function handleAudioPausing(_event: any) {
    const isPlaying = checkAudioPlaying();
    if (!isPlaying) {
        window.removeEventListener('beforeunload', blockUnload);
    }
    EventHandler.addPropEvent(AUDIO_PLAYING_CHANGE_EVENT, null);
}

export function handleAudioEnding(isRepeating: boolean, event: any) {
    const audioElement = event.target;
    audioElement.currentTime = 0;
    if (isRepeating) {
        audioElement.play();
        return;
    }
    const isPlaying = checkAudioPlaying();
    if (!isPlaying) {
        window.removeEventListener('beforeunload', blockUnload);
    }
    EventHandler.addPropEvent(AUDIO_PLAYING_CHANGE_EVENT, null);
}
