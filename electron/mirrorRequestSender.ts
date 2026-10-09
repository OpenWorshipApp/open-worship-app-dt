import type http from 'node:http';
import net from 'node:net';

// Who sent a request to the Screen Mirror server. Normally the socket's peer;
// through Cloudflare's tunnel the socket is this computer's own cloudflared,
// so the sender is the address Cloudflare saw (`Cf-Connecting-Ip`) and the
// request is from the internet whatever that address looks like. The server
// notes it once per request; everything downstream reads it here, never the
// socket.
export type MirrorRequestSenderType = {
    address: string;
    isTunnel: boolean;
};

const senders = new WeakMap<http.IncomingMessage, MirrorRequestSenderType>();

export function noteTunnelRequest(req: http.IncomingMessage) {
    const header = req.headers['cf-connecting-ip'];
    const text = typeof header === 'string' ? header.trim() : '';
    const sender = {
        // An unreadable header still comes from the internet: an address no
        // network card of this computer has.
        address: net.isIP(text) ? text : '0.0.0.0',
        isTunnel: true,
    };
    senders.set(req, sender);
    return sender;
}

export function readRequestSender(
    req: http.IncomingMessage,
): MirrorRequestSenderType {
    return (
        senders.get(req) ?? {
            address: req.socket?.remoteAddress ?? '',
            isTunnel: false,
        }
    );
}
