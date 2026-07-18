import { genVideoIDFromSrc } from '../screenHelpers';
import { YOUTUBE_PLAYING_ATTR } from '../../helper/mediaControlHelpers';

// YouTube IFrame API `playerState` values.
const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;

// A YouTube canvas item embeds `…/embed/<id>?…&enablejsapi=1`. Only those get
// JS-API driven sync; a plain website iframe is left untouched.
export function checkIsYouTubeSyncIframe(iframe: HTMLIFrameElement): boolean {
    const src = iframe.getAttribute('src') ?? '';
    return src.includes('youtube.com/embed/') && src.includes('enablejsapi=1');
}

// A sync id that is identical in every window for the same embed, mirroring how
// a slide `<video>` is keyed by its resolved source. Both the presenter mini
// screen and the projected screen render the same slide HTML, so the iframe
// `src` (and therefore this id) matches everywhere.
export function genYouTubeSyncId(iframe: HTMLIFrameElement): string {
    return genVideoIDFromSrc(iframe.getAttribute('src') ?? '');
}

type YouTubePlayerCallbacksType = {
    // These fire ONLY for the sound "master" (the presenter mini screen). The
    // projected screen and idle followers pass none, so they never broadcast.
    onPlay?: (currentTime: number) => void;
    onPause?: (currentTime: number) => void;
    onTimeUpdate?: (currentTime: number, isPlaying: boolean) => void;
};

/**
 * Drives one embedded YouTube `<iframe>` through the (undocumented but stable)
 * postMessage protocol the official IFrame Player API uses under the hood. The
 * app's production CSP is `script-src 'self'`, so `https://www.youtube.com/
 * iframe_api` cannot be loaded — we speak the protocol directly instead:
 *
 *  - post `{event:'listening'}` to start receiving state, then
 *  - post `{event:'command', func, args}` to control playback, and
 *  - listen for `{event:'infoDelivery', info:{currentTime, playerState}}`.
 *
 * This exposes the same shape a slide `<video>` has (an id, a current time, a
 * playing flag, and play/pause/seek/mute) so YouTube reuses the exact same
 * cross-window group-sync plumbing as a slide video.
 */
export class SlideYouTubePlayer {
    readonly id: string;
    private readonly iframe: HTMLIFrameElement;
    private readonly callbacks: YouTubePlayerCallbacksType;
    private currentTime = 0;
    private lastState = -1;
    private isDisposed = false;
    // Set when this player was paused by group exclusivity so the resulting
    // pause is not broadcast back (which would stop the projected screens that
    // are following the master). Mirrors a slide video's `pausedByGroupSync`.
    pausedBySync = false;
    // Followers (the projected screens) mute themselves the moment the player
    // becomes ready so only the master (the first-clicked mini) makes sound.
    private readonly muteOnReady: boolean;
    private isReadyMuteApplied = false;
    private handshakeTimer: ReturnType<typeof setInterval> | null = null;
    private readonly boundOnMessage: (event: MessageEvent) => void;
    private readonly boundSendListening: () => void;

    constructor(
        iframe: HTMLIFrameElement,
        id: string,
        callbacks: YouTubePlayerCallbacksType,
        { muteOnReady = false }: { muteOnReady?: boolean } = {},
    ) {
        this.iframe = iframe;
        this.id = id;
        this.callbacks = callbacks;
        this.muteOnReady = muteOnReady;
        this.boundOnMessage = (event: MessageEvent) => {
            this.handleMessage(event);
        };
        this.boundSendListening = () => {
            this.sendListening();
        };
        window.addEventListener('message', this.boundOnMessage);
        // The iframe may not have loaded the player yet; poke it until it
        // answers (or we give up), and again once it fires `load`.
        this.iframe.addEventListener('load', this.boundSendListening);
        this.startHandshake();
    }

    private sendListening() {
        const win = this.iframe.contentWindow;
        if (win === null) {
            return;
        }
        win.postMessage(
            JSON.stringify({
                event: 'listening',
                id: this.id,
                channel: 'widget',
            }),
            '*',
        );
    }

    private startHandshake() {
        this.sendListening();
        let attempts = 0;
        this.handshakeTimer = setInterval(() => {
            attempts += 1;
            if (this.isDisposed || attempts > 25) {
                this.stopHandshake();
                return;
            }
            this.sendListening();
        }, 400);
    }

    private stopHandshake() {
        if (this.handshakeTimer !== null) {
            clearInterval(this.handshakeTimer);
            this.handshakeTimer = null;
        }
    }

    private post(func: string, args: (number | boolean)[] = []) {
        const win = this.iframe.contentWindow;
        if (win === null) {
            return;
        }
        win.postMessage(
            JSON.stringify({
                event: 'command',
                func,
                args,
                id: this.id,
                channel: 'widget',
            }),
            '*',
        );
    }

    private handleMessage(event: MessageEvent) {
        if (this.isDisposed || event.source !== this.iframe.contentWindow) {
            return;
        }
        if (
            typeof event.origin === 'string' &&
            event.origin !== '' &&
            !event.origin.includes('youtube.com')
        ) {
            return;
        }
        let data: any;
        try {
            data =
                typeof event.data === 'string'
                    ? JSON.parse(event.data)
                    : event.data;
        } catch {
            return;
        }
        if (data === null || typeof data !== 'object') {
            return;
        }
        // The player answered — no need to keep poking it.
        this.stopHandshake();
        // Mute a follower as soon as it is ready to accept commands (the
        // setup-time mute can land before the player exists and be dropped).
        if (this.muteOnReady && !this.isReadyMuteApplied) {
            this.isReadyMuteApplied = true;
            this.mute();
        }
        const info = data.info;
        if (info !== null && typeof info === 'object') {
            if (typeof info.currentTime === 'number') {
                this.currentTime = info.currentTime;
            }
            if (typeof info.playerState === 'number') {
                this.handleStateChange(info.playerState);
            }
        } else if (data.event === 'onStateChange' && typeof info === 'number') {
            this.handleStateChange(info);
        }
        if (this.lastState === YT_STATE_PLAYING) {
            this.callbacks.onTimeUpdate?.(this.currentTime, true);
        }
    }

    private handleStateChange(state: number) {
        if (state === this.lastState) {
            return;
        }
        this.lastState = state;
        if (state === YT_STATE_PLAYING) {
            // Expose the playing state to the DOM so the media guards
            // (`checkMediaPlaying`) can detect this otherwise-opaque iframe.
            this.iframe.setAttribute(YOUTUBE_PLAYING_ATTR, '');
            this.callbacks.onPlay?.(this.currentTime);
        } else if (state === YT_STATE_PAUSED || state === YT_STATE_ENDED) {
            this.iframe.removeAttribute(YOUTUBE_PLAYING_ATTR);
            if (this.pausedBySync) {
                this.pausedBySync = false;
            } else {
                this.callbacks.onPause?.(this.currentTime);
            }
        }
    }

    get isPlaying() {
        return this.lastState === YT_STATE_PLAYING;
    }

    getCurrentTime() {
        return this.currentTime;
    }

    play() {
        this.post('playVideo');
    }

    pause() {
        this.post('pauseVideo');
    }

    seekTo(seconds: number) {
        this.currentTime = seconds;
        this.post('seekTo', [seconds, true]);
    }

    mute() {
        this.post('mute');
    }

    unMute() {
        this.post('unMute');
    }

    destroy() {
        this.isDisposed = true;
        this.stopHandshake();
        this.iframe.removeAttribute(YOUTUBE_PLAYING_ATTR);
        window.removeEventListener('message', this.boundOnMessage);
        this.iframe.removeEventListener('load', this.boundSendListening);
    }
}
