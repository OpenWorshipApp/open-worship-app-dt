import {
    MIRROR_INTERCOM_MAX_BYTES,
    MIRROR_INTERCOM_MAX_PER_SECOND,
    type MirrorIntercomState,
} from './screenMirrorProtocol';

// The intercom of every Screen Mirror connection this computer has: whose
// microphone goes where, and which speaker plays what. The sound is captured
// and played by the hidden broker window (`mirrorIntercomBroker.ts`) and
// travels inside the connection's own socket as Opus packets -- so it reaches
// wherever the connection does, the internet and the tunnel too, where a
// WebRTC stream with no relay would not.
//
// A pair is `guest:<id>` on a host, `link:<id>` on a guest, `viewer:<id>` for a
// browser watching a virtual display (its page's own socket). Each side turns on
// only its own microphone and its own speaker; the other side is told when a
// microphone goes on or off, so it can show it.
export type IntercomHostType = {
    // A packet to the other side of that pair, if it is connected.
    send: (key: string, type: string, data: Record<string, unknown>) => void;
    toBroker: (message: Record<string, unknown>) => void;
    // Something here captures or plays: the broker has to stay up.
    onActiveChanged: (isActive: boolean) => void;
    onChanged: () => void;
};

type PairType = MirrorIntercomState & {
    windowStart: number;
    count: number;
};

const DEFAULT_STATE: MirrorIntercomState = {
    mic: false,
    speaker: false,
    volume: 1,
    remoteMic: false,
};
// Base64 of the largest packet allowed.
const MAX_TEXT_LENGTH = Math.ceil(MIRROR_INTERCOM_MAX_BYTES / 3) * 4;
export const MIRROR_INTERCOM_KEY_PATTERN =
    /^(?:guest|link|viewer):[\w-]{1,64}$/;

export class MirrorIntercom {
    private pairs = new Map<string, PairType>();
    private isActive = false;

    constructor(private readonly host: IntercomHostType) {}

    stateOf(key: string): MirrorIntercomState {
        const pair = this.pairs.get(key);
        if (pair === undefined) {
            return { ...DEFAULT_STATE };
        }
        const { mic, speaker, volume, remoteMic } = pair;
        return { mic, speaker, volume, remoteMic };
    }

    private ensure(key: string) {
        let pair = this.pairs.get(key);
        if (pair === undefined) {
            pair = { ...DEFAULT_STATE, windowStart: 0, count: 0 };
            this.pairs.set(key, pair);
        }
        return pair;
    }

    // The operator's toggles for one connection. A volume is shown too: the
    // slider sends one only when a drag pauses, so the broadcast is cheap,
    // and without it the slider sprang back to the old value.
    set(
        key: string,
        change: { mic?: unknown; speaker?: unknown; volume?: unknown },
    ) {
        const pair = this.ensure(key);
        let isShownChanged = false;
        if (typeof change.mic === 'boolean' && change.mic !== pair.mic) {
            pair.mic = change.mic;
            this.host.send(key, 'intercom-state', { mic: pair.mic });
            isShownChanged = true;
        }
        if (
            typeof change.speaker === 'boolean' &&
            change.speaker !== pair.speaker
        ) {
            pair.speaker = change.speaker;
            isShownChanged = true;
        }
        if (
            typeof change.volume === 'number' &&
            Number.isFinite(change.volume)
        ) {
            const volume = Math.min(1, Math.max(0, change.volume));
            if (volume !== pair.volume) {
                pair.volume = volume;
                isShownChanged = true;
            }
        }
        this.sync();
        if (isShownChanged) {
            this.host.onChanged();
        }
    }

    // The other side's microphone went on or off.
    setRemoteMic(key: string, isOn: boolean) {
        const pair = this.ensure(key);
        if (pair.remoteMic !== isOn) {
            pair.remoteMic = isOn;
            this.host.onChanged();
        }
    }

    // The connection came (back): the other side learns this microphone.
    announce(key: string) {
        if (this.pairs.get(key)?.mic) {
            this.host.send(key, 'intercom-state', { mic: true });
        }
    }

    // The connection dropped and may come back: its own toggles stay, what
    // the other side had on does not.
    pause(key: string) {
        const pair = this.pairs.get(key);
        if (pair?.remoteMic) {
            pair.remoteMic = false;
            this.host.onChanged();
        }
    }

    // The connection ended: nothing of it stays on.
    forget(key: string) {
        if (this.pairs.delete(key)) {
            this.sync();
        }
    }

    // An Opus packet from the other side: played only while this speaker is
    // on, within size and rate.
    receive(key: string, packet: Record<string, unknown>) {
        const pair = this.pairs.get(key);
        const text = packet.data;
        if (
            pair === undefined ||
            !pair.speaker ||
            typeof text !== 'string' ||
            text.length === 0 ||
            text.length > MAX_TEXT_LENGTH ||
            !this.countPacket(pair)
        ) {
            return;
        }
        const data = Buffer.from(text, 'base64');
        if (data.length === 0 || data.length > MIRROR_INTERCOM_MAX_BYTES) {
            return;
        }
        this.host.toBroker({ type: 'audio', key, data: new Uint8Array(data) });
    }

    // An Opus packet of this computer's microphone, from the broker: to
    // every connection whose microphone is on.
    sendLocal(data: unknown) {
        if (
            !(data instanceof Uint8Array) ||
            data.length === 0 ||
            data.length > MIRROR_INTERCOM_MAX_BYTES
        ) {
            return;
        }
        const text = Buffer.from(data).toString('base64');
        for (const [key, pair] of this.pairs) {
            if (pair.mic) {
                this.host.send(key, 'audio', { data: text });
            }
        }
    }

    private countPacket(pair: PairType) {
        const now = Date.now();
        if (now - pair.windowStart >= 1000) {
            pair.windowStart = now;
            pair.count = 0;
        }
        return ++pair.count <= MIRROR_INTERCOM_MAX_PER_SECOND;
    }

    // What the broker captures and plays now.
    private sync() {
        const pairs = [...this.pairs.entries()];
        const isMicOn = pairs.some(([, pair]) => pair.mic);
        const speakers = Object.fromEntries(
            pairs
                .filter(([, pair]) => pair.speaker)
                .map(([key, pair]) => [key, pair.volume]),
        );
        const isActive = isMicOn || Object.keys(speakers).length > 0;
        if (isActive !== this.isActive) {
            this.isActive = isActive;
            this.host.onActiveChanged(isActive);
        }
        this.host.toBroker({ type: 'config', isMicOn, speakers });
    }
}
