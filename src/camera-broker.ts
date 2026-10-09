// A source renderer is created only when somebody actually uses a network camera.
import appProvider from './server/appProvider';
import { sendMirrorCameraPacket } from './screen-mirror/mirrorCameraTransport';
import {
    closeMirrorIntercom,
    initMirrorIntercomBroker,
    receiveIntercomMessage,
} from './screen-mirror/mirrorIntercomBroker';

type Capture = { promise: Promise<MediaStream>; users: number };
type Source = {
    peer: RTCPeerConnection;
    captureId: string;
    candidates: RTCIceCandidateInit[];
};
const sources = new Map<string, Source>();
const captures = new Map<string, Capture>();
function release(requestId: string) {
    const source = sources.get(requestId);
    if (!source) return;
    sources.delete(requestId);
    source.peer.close();
    const capture = captures.get(source.captureId);
    if (capture && --capture.users === 0) {
        captures.delete(source.captureId);
        void capture.promise.then(
            (stream) => stream.getTracks().forEach((track) => track.stop()),
            () => {},
        );
    }
}
appProvider.messageUtils.listenForData('mirror:camera', (_, packet) => {
    void (async () => {
        if (packet.type === 'camera-close') {
            release(packet.requestId);
            return;
        }
        if (packet.type === 'camera-request') {
            if (sources.has(packet.requestId) || sources.size >= 32) return;
            const peer = new RTCPeerConnection({ iceServers: [] });
            const source: Source = {
                peer,
                captureId: packet.deviceId,
                candidates: [],
            };
            sources.set(packet.requestId, source);
            let capture = captures.get(packet.deviceId);
            if (!capture) {
                capture = {
                    users: 0,
                    promise: (async () => {
                        const devices =
                            await navigator.mediaDevices.enumerateDevices();
                        const device =
                            devices.find(
                                (item) =>
                                    item.kind === 'videoinput' &&
                                    item.deviceId === packet.deviceId,
                            ) ??
                            devices.find(
                                (item) =>
                                    item.kind === 'videoinput' &&
                                    item.label === packet.label,
                            );
                        if (!device) throw new Error('Camera is unavailable');
                        return await navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: {
                                deviceId: { exact: device.deviceId },
                                width: { ideal: 1280 },
                                height: { ideal: 720 },
                                frameRate: { ideal: 15, max: 15 },
                            },
                        });
                    })(),
                };
                captures.set(packet.deviceId, capture);
            }
            capture.users++;
            const stream = await capture.promise;
            if (sources.get(packet.requestId) !== source) return;
            for (const track of stream.getVideoTracks())
                peer.addTrack(track, stream);
            peer.onicecandidate = (event) => {
                if (event.candidate)
                    sendMirrorCameraPacket({
                        type: 'camera-signal',
                        requestId: packet.requestId,
                        candidate: event.candidate.toJSON(),
                    });
            };
            peer.onconnectionstatechange = () => {
                if (['failed', 'closed'].includes(peer.connectionState)) {
                    sendMirrorCameraPacket({
                        type: 'camera-close',
                        requestId: packet.requestId,
                    });
                    release(packet.requestId);
                }
            };
            await peer.setLocalDescription(await peer.createOffer());
            for (const sender of peer.getSenders()) {
                const parameters = sender.getParameters();
                if (parameters.encodings?.length) {
                    for (const encoding of parameters.encodings)
                        Object.assign(encoding, {
                            maxBitrate: 1500000,
                            maxFramerate: 15,
                        });
                    await sender.setParameters(parameters);
                }
            }
            sendMirrorCameraPacket({
                type: 'camera-signal',
                requestId: packet.requestId,
                description: peer.localDescription?.toJSON(),
            });
        } else {
            const source = sources.get(packet.requestId);
            if (!source) return;
            if (packet.description?.type === 'answer') {
                await source.peer.setRemoteDescription(packet.description);
                for (const candidate of source.candidates.splice(0))
                    await source.peer.addIceCandidate(candidate);
            } else if (packet.candidate) {
                if (source.peer.remoteDescription)
                    await source.peer.addIceCandidate(packet.candidate);
                else source.candidates.push(packet.candidate);
            }
        }
    })().catch((error: unknown) => {
        console.warn('Mirror camera source is unavailable', error);
        sendMirrorCameraPacket({
            type: 'camera-close',
            requestId: packet.requestId,
        });
        release(packet.requestId);
    });
});
appProvider.messageUtils.listenForData('mirror:camera-reset', () => {
    for (const id of sources.keys()) release(id);
});
// Screen Mirror's intercom: this computer's microphone out, each
// connection's sound in.
initMirrorIntercomBroker((data) => {
    appProvider.messageUtils.sendData('mirror:intercom-audio', data);
});
appProvider.messageUtils.listenForData('mirror:intercom', (_, message) => {
    receiveIntercomMessage(message);
});
window.addEventListener('beforeunload', () => {
    for (const id of sources.keys()) release(id);
    closeMirrorIntercom();
});
