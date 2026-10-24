import crypto from 'node:crypto';
import net from 'node:net';

import { readMirrorIpv4, readMirrorIpv6 } from './screenMirrorProtocol';

// HTTPS on the Screen Mirror server's own port, for browsers watching a
// virtual display: a phone on `http://192.168.x.x` is not a secure context,
// so the page has no full screen keep-awake, microphone, camera or clipboard
// there. Nobody can sign a certificate for a LAN address, so this computer
// signs its own -- a browser warns once per address and then opens it.

export type MirrorTlsCertificateType = { key: string; cert: string };

// Apple refuses a server certificate valid for more than 825 days, even one
// the person chose to trust; a new one is made when 30 are left.
const VALID_DAYS = 800;
const RENEW_DAYS = 30;
const DAY_MILLISECOND = 24 * 60 * 60 * 1000;
const MAX_NAMES = 32;
const COMMON_NAME = 'Open Worship App';

function toDerLength(length: number) {
    if (length < 0x80) {
        return Buffer.from([length]);
    }
    const bytes: number[] = [];
    for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) {
        bytes.unshift(rest % 256);
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function toDer(tag: number, ...parts: Buffer[]) {
    const body = Buffer.concat(parts);
    return Buffer.concat([Buffer.from([tag]), toDerLength(body.length), body]);
}

function toDerSequence(...parts: Buffer[]) {
    return toDer(0x30, ...parts);
}

function toDerOid(text: string) {
    const [first, second, ...rest] = text.split('.').map(Number);
    const bytes = [first * 40 + second];
    for (const value of rest) {
        const chunk = [value % 128];
        for (let high = Math.floor(value / 128); high > 0;) {
            chunk.unshift((high % 128) | 0x80);
            high = Math.floor(high / 128);
        }
        bytes.push(...chunk);
    }
    return toDer(0x06, Buffer.from(bytes));
}

// UTCTime until 2050, GeneralizedTime from then on (RFC 5280 4.1.2.5).
function toDerTime(date: Date) {
    const digits = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return date.getUTCFullYear() < 2050
        ? toDer(0x17, Buffer.from(`${digits.slice(2)}Z`, 'ascii'))
        : toDer(0x18, Buffer.from(`${digits}Z`, 'ascii'));
}

function toDerName() {
    return toDerSequence(
        toDer(
            0x31,
            toDerSequence(
                toDerOid('2.5.4.3'),
                toDer(0x0c, Buffer.from(COMMON_NAME, 'utf8')),
            ),
        ),
    );
}

function toDerExtension(oid: string, value: Buffer, isCritical = false) {
    return toDerSequence(
        toDerOid(oid),
        ...(isCritical ? [Buffer.from([0x01, 0x01, 0xff])] : []),
        toDer(0x04, value),
    );
}

// The bytes of an IP address for a certificate's subjectAltName.
function toIpBytes(address: string) {
    if (net.isIPv4(address)) {
        return Buffer.from(readMirrorIpv4(address)!);
    }
    const hextets = net.isIPv6(address) ? readMirrorIpv6(address) : null;
    if (hextets === null) {
        return null;
    }
    const bytes = Buffer.alloc(16);
    hextets.forEach((hextet, index) => {
        bytes.writeUInt16BE(hextet, index * 2);
    });
    return bytes;
}

// `localhost`, this computer's name and every address it is reached on. A
// browser warns about a certificate this computer signed either way; the
// names matter to a device that was told to trust it.
function toSubjectAltNames(names: string[]) {
    const seen = new Set<string>();
    const entries: Buffer[] = [];
    for (const name of names) {
        const text = name
            .trim()
            .replace(/^\[|\]$/g, '')
            .replace(/%.*$/, '')
            .toLowerCase();
        if (!text || seen.has(text) || entries.length >= MAX_NAMES) {
            continue;
        }
        seen.add(text);
        const ip = toIpBytes(text);
        if (ip !== null) {
            entries.push(toDer(0x87, ip));
        } else if (
            /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*$/.test(
                text,
            )
        ) {
            entries.push(toDer(0x82, Buffer.from(text, 'ascii')));
        }
    }
    return toDerSequence(...entries);
}

function toPem(label: string, der: Buffer) {
    const lines = der.toString('base64').match(/.{1,64}/g) ?? [];
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

// A self-signed RSA 2048 / SHA-256 server certificate -- what every phone,
// TV and old browser takes -- for `names`, valid from a day ago (a device
// whose clock is behind) for VALID_DAYS. The key is made off the main
// thread; nothing here runs unless HTTPS was turned on.
export async function genMirrorTlsCertificate(
    names: string[],
    now = new Date(),
): Promise<MirrorTlsCertificateType> {
    const { publicKey, privateKey } = await new Promise<{
        publicKey: crypto.KeyObject;
        privateKey: crypto.KeyObject;
    }>((resolve, reject) => {
        crypto.generateKeyPair(
            'rsa',
            { modulusLength: 2048 },
            (error, publicKey, privateKey) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ publicKey, privateKey });
                }
            },
        );
    });
    const serial = crypto.randomBytes(16);
    // Positive, and minimal in DER: the top bit clear, the first byte not 0.
    serial[0] = (serial[0] & 0x7f) | 0x40;
    const algorithm = toDerSequence(
        toDerOid('1.2.840.113549.1.1.11'),
        Buffer.from([0x05, 0x00]),
    );
    const name = toDerName();
    const tbs = toDerSequence(
        toDer(0xa0, toDer(0x02, Buffer.from([0x02]))),
        toDer(0x02, serial),
        algorithm,
        name,
        toDerSequence(
            toDerTime(new Date(now.getTime() - DAY_MILLISECOND)),
            toDerTime(new Date(now.getTime() + VALID_DAYS * DAY_MILLISECOND)),
        ),
        name,
        publicKey.export({ type: 'spki', format: 'der' }),
        toDer(
            0xa3,
            toDerSequence(
                // basicConstraints: not a CA.
                toDerExtension('2.5.29.19', toDerSequence()),
                // keyUsage: digitalSignature, keyEncipherment.
                toDerExtension(
                    '2.5.29.15',
                    Buffer.from([0x03, 0x02, 0x05, 0xa0]),
                    true,
                ),
                // extKeyUsage: serverAuth (Apple requires it).
                toDerExtension(
                    '2.5.29.37',
                    toDerSequence(toDerOid('1.3.6.1.5.5.7.3.1')),
                ),
                toDerExtension(
                    '2.5.29.17',
                    toSubjectAltNames(['localhost', ...names]),
                ),
            ),
        ),
    );
    const signature = crypto.sign('sha256', tbs, privateKey);
    const certificate = toDerSequence(
        tbs,
        algorithm,
        toDer(0x03, Buffer.from([0x00]), signature),
    );
    return {
        key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        cert: toPem('CERTIFICATE', certificate),
    };
}

// A stored certificate, while it has its key and more than RENEW_DAYS left;
// null for anything else, so a new one is made.
export function readMirrorTlsCertificate(
    text: unknown,
    now = new Date(),
): MirrorTlsCertificateType | null {
    if (typeof text !== 'string' || !text) {
        return null;
    }
    try {
        const { key, cert } = JSON.parse(text);
        if (typeof key !== 'string' || typeof cert !== 'string') {
            return null;
        }
        const x509 = new crypto.X509Certificate(cert);
        const validTo = new Date(x509.validTo).getTime();
        if (
            !(validTo - now.getTime() > RENEW_DAYS * DAY_MILLISECOND) ||
            !x509.checkPrivateKey(crypto.createPrivateKey(key))
        ) {
            return null;
        }
        return { key, cert };
    } catch {
        return null;
    }
}

// The first byte of a TLS connection: a handshake record.
const TLS_HANDSHAKE_BYTE = 0x16;
// A connection that says nothing at all is closed, as Node's own
// `headersTimeout` would close one that never finished its headers.
const FIRST_BYTE_MILLISECOND = 60_000;

// One port, two protocols: each connection is looked at once, its first
// byte put back, and handed whole to the plain HTTP server or -- for a TLS
// handshake, while `toSecure` gives one -- the HTTPS server. Neither of them
// listens itself. A TLS connection with no HTTPS server is closed.
export function routeMirrorSocket(
    socket: net.Socket,
    targets: {
        plain: net.Server;
        toSecure: () => net.Server | null;
        onSecure?: (socket: net.Socket) => void;
    },
) {
    // Nothing else listens yet: an unanswered reset would throw.
    const onError = () => {
        socket.destroy();
    };
    socket.on('error', onError);
    socket.setTimeout(FIRST_BYTE_MILLISECOND, onError);
    const route = () => {
        if (socket.destroyed) {
            return;
        }
        const chunk: Buffer | null = socket.read(1);
        if (chunk === null) {
            if (!socket.readableEnded) {
                socket.once('readable', route);
            }
            return;
        }
        socket.unshift(chunk);
        socket.setTimeout(0);
        socket.off('timeout', onError);
        socket.off('error', onError);
        if (chunk[0] !== TLS_HANDSHAKE_BYTE) {
            targets.plain.emit('connection', socket);
            return;
        }
        const secure = targets.toSecure();
        if (secure === null) {
            socket.on('error', () => {});
            socket.destroy();
            return;
        }
        targets.onSecure?.(socket);
        secure.emit('connection', socket);
    };
    route();
}
