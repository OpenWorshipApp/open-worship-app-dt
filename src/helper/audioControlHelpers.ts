import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import EventHandler from '../event/EventHandler';
import { playMediaElement } from './mediaHelpers';
import { genBlockUnload } from './blockUnloadHelpers';

export const AUDIO_PLAYING_CHANGE_EVENT = 'audio-playing-change';
export const BLOCK_UNLOAD_WHILE_PLAYING_ATTR =
    'data-block-unload-while-playing';

export function showMediaPlayingToast() {
    showSimpleToast(
        tran('Media playing'),
        tran('Please pause all audio and video before leaving the page.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
}

export function showAudioPlayingToast() {
    showSimpleToast(
        tran('Audio playing'),
        tran('Please stop the audio before leaving the page.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
}

const blockUnload = genBlockUnload(
    showMediaPlayingToast,
    checkBlockingMediaPlaying,
);

export function checkAudioPlaying() {
    return Array.from(document.querySelectorAll('audio')).some(
        (audioElement) => {
            return !audioElement.paused;
        },
    );
}

function checkGuardedMediaPlaying(root: ParentNode): boolean {
    const mediaElements = root.querySelectorAll<HTMLMediaElement>(
        `audio[${BLOCK_UNLOAD_WHILE_PLAYING_ATTR}], ` +
            `video[${BLOCK_UNLOAD_WHILE_PLAYING_ATTR}]`,
    );
    if (
        Array.from(mediaElements).some((mediaElement) => !mediaElement.paused)
    ) {
        return true;
    }
    for (const element of root.querySelectorAll('*')) {
        if (
            element instanceof HTMLElement &&
            element.shadowRoot !== null &&
            checkGuardedMediaPlaying(element.shadowRoot)
        ) {
            return true;
        }
    }
    return false;
}

export function checkBlockingMediaPlaying() {
    if (checkAudioPlaying()) {
        return true;
    }
    return checkGuardedMediaPlaying(document);
}

function getEventMediaElement(event: Event) {
    const target = event.currentTarget ?? event.target;
    return target instanceof HTMLMediaElement ? target : null;
}

export function handleMediaPlaying(event: Event) {
    const mediaElement = getEventMediaElement(event);
    if (mediaElement === null) {
        return;
    }
    mediaElement.setAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR, '');
    window.addEventListener('beforeunload', blockUnload);
}

export function handleMediaStopped(event: Event) {
    getEventMediaElement(event)?.removeAttribute(
        BLOCK_UNLOAD_WHILE_PLAYING_ATTR,
    );
    if (!checkBlockingMediaPlaying()) {
        window.removeEventListener('beforeunload', blockUnload);
    }
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
    handleMediaPlaying(event);
    EventHandler.addPropEvent(AUDIO_PLAYING_CHANGE_EVENT, audioElement);
}

export function handleAudioPausing(event: any) {
    handleMediaStopped(event);
    EventHandler.addPropEvent(AUDIO_PLAYING_CHANGE_EVENT, null);
}

export function handleAudioEnding(isRepeating: boolean, event: any) {
    const audioElement = event.target;
    audioElement.currentTime = 0;
    if (isRepeating) {
        playMediaElement(audioElement);
        return;
    }
    handleMediaStopped(event);
    EventHandler.addPropEvent(AUDIO_PLAYING_CHANGE_EVENT, null);
}
