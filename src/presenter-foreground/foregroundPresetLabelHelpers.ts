import { tran } from '../lang/langHelpers';
import type { ForegroundPresetIdType } from './foregroundPresetHelpers';

// Apart from the presets themselves, so the worker and the Bible row's
// Create Quick Text, which only WRITE a preset, carry no translator.

/**
 * A preset's name, translated in render. Written out one literal at a time so
 * the key coverage test can read every one of them.
 */
export function toForegroundPresetLabel(id: ForegroundPresetIdType) {
    switch (id) {
        case 'bible-verse':
            return tran('Bible Verse');
        case 'speaker':
            return tran('Speaker');
        case 'song-title':
            return tran('Song Title');
        case 'sermon-title':
            return tran('Sermon Title');
        case 'event-session':
            return tran('Event Session');
        case 'announcement':
            return tran('Announcement');
        case 'top-banner':
            return tran('Top Banner');
        case 'bottom-banner':
            return tran('Bottom Banner');
        case 'urgent-alert':
            return tran('Urgent Alert');
        case 'top-left':
            return tran('Top Left');
        case 'top-right':
            return tran('Top Right');
        case 'bottom-left':
            return tran('Bottom Left');
        case 'bottom-right':
            return tran('Bottom Right');
        case 'center':
            return tran('Center');
        case 'full-screen':
            return tran('Full Screen');
        case 'picture-in-picture':
            return tran('Picture in Picture');
    }
}
