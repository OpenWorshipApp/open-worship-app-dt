import EventHandler from '../event/EventHandler';

/**
 * Asks the background panel to reveal its Audios split.
 *
 * The panel keeps that flag in local state seeded from a setting, so writing
 * the setting from elsewhere would not re-render it — an event is what actually
 * opens it. Used when pointing at a track from somewhere else in the app (a
 * playlist entry), where the panel may well be closed.
 */
export const OPEN_BACKGROUND_AUDIO_TAB_EVENT = 'open-background-audio-tab';

export function openBackgroundAudioTab() {
    EventHandler.addPropEvent(OPEN_BACKGROUND_AUDIO_TAB_EVENT);
}
