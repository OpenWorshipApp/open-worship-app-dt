// Screen Mirror's intercom in the hidden broker window: the main process says
// what is on (`config`) and hands over packets only for a speaker that is on;
// this computer's microphone packets go back to it to send down each
// connection whose microphone is on. The sound itself is `intercomAudio.ts`.
import { createIntercomAudio, type IntercomAudioType } from './intercomAudio';

type ConfigType = {
    type: 'config';
    isMicOn: boolean;
    speakers: Record<string, number>;
};
type AudioType = { type: 'audio'; key: string; data: Uint8Array };

let send: (data: Uint8Array) => void = () => {};
let audio: IntercomAudioType | null = null;
let isMicWanted = false;

function getAudio() {
    audio ??= createIntercomAudio((data) => send(data));
    return audio;
}

export function initMirrorIntercomBroker(sender: (data: Uint8Array) => void) {
    send = sender;
}

export function receiveIntercomMessage(message: ConfigType | AudioType) {
    if (message.type === 'audio') {
        audio?.receive(message.key, message.data);
        return;
    }
    if (message.type !== 'config') {
        return;
    }
    const volumes = message.speakers ?? {};
    const current = getAudio();
    for (const key of current.speakerKeys()) {
        if (!(key in volumes)) {
            current.setSpeaker(key, null);
        }
    }
    for (const [key, volume] of Object.entries(volumes)) {
        current.setSpeaker(key, Number(volume));
    }
    if (message.isMicOn !== isMicWanted) {
        isMicWanted = message.isMicOn;
        current.setMic(isMicWanted).catch((error: unknown) => {
            console.warn('Intercom microphone is unavailable', error);
            isMicWanted = false;
            void current.setMic(false);
        });
    }
}

export function closeMirrorIntercom() {
    isMicWanted = false;
    audio?.close();
    audio = null;
}
