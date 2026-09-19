// Appends a volume meter emoji to the window title while any media in this
// window is producing sound (e.g. background audio / video playback):
//   low → 🔈, medium → 🔉, high → 🔊.
//
// Deliberately event-driven with no polling and no Web Audio: on low-spec
// machines a continuous audio-analysis loop is exactly the kind of always-on
// work the performance mandate forbids, and a real-time tap (captureStream /
// createMediaElementSource) proved both unreliable and invasive in this
// Electron build. So the level is derived from the loudest audible element's
// volume, recomputed only when a media play/pause/volume event fires. Bursts of
// those events are coalesced into a single recompute + title write.

const METER_LOW = '🔈';
const METER_MEDIUM = '🔉';
const METER_HIGH = '🔊';
const METER_CHARS = [METER_LOW, METER_MEDIUM, METER_HIGH];

// Media events don't bubble, so listen in the capture phase on `document`.
const MEDIA_EVENTS = [
    'play',
    'playing',
    'pause',
    'ended',
    'volumechange',
    'emptied',
];

function stripMeter(title: string): string {
    for (const meterChar of METER_CHARS) {
        if (title.endsWith(meterChar)) {
            return title.slice(0, -meterChar.length).trimEnd();
        }
    }
    return title;
}

// The loudest effective volume (0..1) among media currently making sound, or
// null when nothing is audible.
function getAudibleLevel(): number | null {
    let maxLevel = -1;
    for (const mediaElement of document.querySelectorAll<HTMLMediaElement>(
        'audio, video',
    )) {
        if (
            mediaElement.paused ||
            mediaElement.ended ||
            mediaElement.muted ||
            mediaElement.volume <= 0 ||
            // HAVE_CURRENT_DATA: only count media that actually has audio data.
            mediaElement.readyState < 2
        ) {
            continue;
        }
        if (mediaElement.volume > maxLevel) {
            maxLevel = mediaElement.volume;
        }
    }
    return maxLevel < 0 ? null : maxLevel;
}

function levelToMeter(level: number | null): string {
    if (level === null) {
        return '';
    }
    if (level <= 1 / 3) {
        return METER_LOW;
    }
    if (level <= 2 / 3) {
        return METER_MEDIUM;
    }
    return METER_HIGH;
}

function updateTitleSoundMeter(): void {
    const meter = levelToMeter(getAudibleLevel());
    // Recomputed from the live title so it self-corrects if other code changed
    // document.title, and only writes the native title on an actual change.
    const baseTitle = stripMeter(document.title);
    const newTitle = meter ? `${baseTitle} ${meter}` : baseTitle;
    if (document.title !== newTitle) {
        document.title = newTitle;
    }
}

let isUpdateScheduled = false;
function scheduleTitleSoundMeterUpdate(): void {
    if (isUpdateScheduled) {
        return;
    }
    isUpdateScheduled = true;
    queueMicrotask(() => {
        isUpdateScheduled = false;
        updateTitleSoundMeter();
    });
}

export function initTitleSoundMeter(): void {
    for (const eventName of MEDIA_EVENTS) {
        document.addEventListener(eventName, scheduleTitleSoundMeterUpdate, {
            capture: true,
        });
    }
}
