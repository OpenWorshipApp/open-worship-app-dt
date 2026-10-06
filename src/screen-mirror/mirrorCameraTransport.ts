import appProvider from '../server/appProvider';

type Receiver = {
    peer: RTCPeerConnection;
    resolve: (stream: MediaStream) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    candidates: RTCIceCandidateInit[];
};
const receivers = new Map<string, Receiver>();
const streamRequests = new WeakMap<MediaStream, string>();
let initialized = false;

export function sendMirrorCameraPacket(packet: Record<string, any>) {
    appProvider.messageUtils.sendData('mirror:camera-send', packet);
}
function closeReceiver(id: string, reason = 'Camera is unavailable') {
    const receiver = receivers.get(id);
    if (!receiver) return;
    clearTimeout(receiver.timer);
    receiver.peer.close();
    receivers.delete(id);
    receiver.reject(new Error(reason));
}
function initialize() {
    if (initialized) return;
    initialized = true;
    appProvider.messageUtils.listenForData('mirror:camera', (_, packet) => {
        const receiver = receivers.get(packet.requestId);
        if (!receiver) return;
        void (async () => {
            if (packet.type === 'camera-close') {
                closeReceiver(packet.requestId);
                return;
            }
            if (packet.description?.type === 'offer') {
                await receiver.peer.setRemoteDescription(packet.description);
                for (const candidate of receiver.candidates.splice(0))
                    await receiver.peer.addIceCandidate(candidate);
                await receiver.peer.setLocalDescription(
                    await receiver.peer.createAnswer(),
                );
                sendMirrorCameraPacket({
                    type: 'camera-signal',
                    requestId: packet.requestId,
                    description: receiver.peer.localDescription?.toJSON(),
                });
            } else if (packet.candidate) {
                if (receiver.peer.remoteDescription)
                    await receiver.peer.addIceCandidate(packet.candidate);
                else receiver.candidates.push(packet.candidate);
            }
        })().catch(() => {
            sendMirrorCameraPacket({
                type: 'camera-close',
                requestId: packet.requestId,
            });
            closeReceiver(packet.requestId);
        });
    });
    window.addEventListener('beforeunload', () => {
        for (const id of receivers.keys())
            sendMirrorCameraPacket({ type: 'camera-close', requestId: id });
    });
}
export function getMirrorCameraStream(deviceId: string, label = '') {
    initialize();
    const requestId = crypto.randomUUID();
    const peer = new RTCPeerConnection({ iceServers: [] });
    return new Promise<MediaStream>((resolve, reject) => {
        const timer = setTimeout(() => {
            sendMirrorCameraPacket({ type: 'camera-close', requestId });
            closeReceiver(requestId);
        }, 15000);
        receivers.set(requestId, {
            peer,
            resolve,
            reject,
            timer,
            candidates: [],
        });
        peer.onicecandidate = (event) => {
            if (event.candidate)
                sendMirrorCameraPacket({
                    type: 'camera-signal',
                    requestId,
                    candidate: event.candidate.toJSON(),
                });
        };
        peer.ontrack = (event) => {
            clearTimeout(timer);
            const stream = event.streams[0] ?? new MediaStream([event.track]);
            streamRequests.set(stream, requestId);
            resolve(stream);
        };
        peer.onconnectionstatechange = () => {
            if (['failed', 'closed'].includes(peer.connectionState)) {
                sendMirrorCameraPacket({ type: 'camera-close', requestId });
                closeReceiver(requestId);
            }
        };
        sendMirrorCameraPacket({
            type: 'camera-request',
            requestId,
            deviceId,
            label,
        });
    });
}
export function releaseMirrorCameraStream(stream: MediaStream) {
    const id = streamRequests.get(stream);
    if (!id) return;
    streamRequests.delete(stream);
    sendMirrorCameraPacket({ type: 'camera-close', requestId: id });
    closeReceiver(id);
}
