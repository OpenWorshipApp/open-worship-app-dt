import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import EventHandler from '../event/EventHandler';
import { playMediaElement } from './mediaHelpers';
import { genBlockUnload } from './blockUnloadHelpers';

export function showMediaPlayingToast() {
    showSimpleToast(
        tran('Media is Playing'),
        tran(
            'Please pause all background audios before disabling audio handlers',
        ),
    );
}

// Depth-first search for a non-paused media element, piercing shadow roots
// (the slide/preview content is rendered inside shadow DOM, which
// `querySelectorAll` does not traverse on its own).
function hasPlayingMediaDeep(root: ParentNode, query: string): boolean {
    for (const media of root.querySelectorAll<HTMLMediaElement>(query)) {
        if (!media.paused && media.dataset.ignoreMediaGuarding !== 'true') {
            return true;
        }
    }
    for (const element of root.querySelectorAll('*')) {
        if (
            element instanceof HTMLElement &&
            element.shadowRoot !== null &&
            hasPlayingMediaDeep(element.shadowRoot, query)
        ) {
            return true;
        }
    }
    return false;
}

export function checkMediaPlaying({
    query = 'audio,video',
    targetElement = document,
    withMessage = true,
}: {
    query?: string;
    targetElement?: ParentNode;
    withMessage?: boolean;
}) {
    const isPlaying = hasPlayingMediaDeep(targetElement, query);
    if (isPlaying && withMessage) {
        showMediaPlayingToast();
    }
    return isPlaying;
}

export const AUDIO_PLAYING_CHANGE_EVENT = 'audio-playing-change';
export const BLOCK_UNLOAD_WHILE_PLAYING_ATTR =
    'data-block-unload-while-playing';

export function showMediaPlayingToast3Attempt() {
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
    showMediaPlayingToast3Attempt,
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
    return hasPlayingMediaDeep(
        root,
        `audio[${BLOCK_UNLOAD_WHILE_PLAYING_ATTR}], ` +
            `video[${BLOCK_UNLOAD_WHILE_PLAYING_ATTR}]`,
    );
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
