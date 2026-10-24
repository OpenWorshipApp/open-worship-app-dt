import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';

import {
    genMirrorTlsCertificate,
    readMirrorTlsCertificate,
    routeMirrorSocket,
    type MirrorTlsCertificateType,
} from './mirrorTls';

const NOW = new Date('2026-10-08T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

let certificate: MirrorTlsCertificateType;
const closers: (() => void)[] = [];

beforeAll(async () => {
    certificate = await genMirrorTlsCertificate(
        ['192.168.1.3', 'fe80::1%12', '2001:db8::5', 'Church-PC', '../bad'],
        NOW,
    );
}, 30_000);

afterEach(() => {
    for (const close of closers.splice(0)) {
        close();
    }
});

test('signs a server certificate browsers and Apple accept', () => {
    const x509 = new crypto.X509Certificate(certificate.cert);
    expect(x509.verify(x509.publicKey)).toBe(true);
    expect(x509.checkPrivateKey(crypto.createPrivateKey(certificate.key))).toBe(
        true,
    );
    expect(x509.subject).toBe('CN=Open Worship App');
    expect(x509.issuer).toBe(x509.subject);
    expect(x509.ca).toBe(false);
    expect(x509.keyUsage).toEqual(['1.3.6.1.5.5.7.3.1']);
    expect(x509.publicKey.asymmetricKeyDetails?.modulusLength).toBe(2048);
    expect(x509.checkIP('192.168.1.3')).toBe('192.168.1.3');
    expect(x509.checkIP('2001:db8::5')).toBe('2001:db8::5');
    expect(x509.checkIP('fe80::1')).toBe('fe80::1');
    expect(x509.checkHost('localhost')).toBe('localhost');
    expect(x509.checkHost('church-pc')).toBe('church-pc');
    expect(x509.subjectAltName).not.toContain('bad');
    const validFrom = new Date(x509.validFrom).getTime();
    const validTo = new Date(x509.validTo).getTime();
    expect(validFrom).toBe(NOW.getTime() - DAY);
    expect((validTo - NOW.getTime()) / DAY).toBe(800);
});

test('reads a stored certificate back until it is about to run out', () => {
    const text = JSON.stringify(certificate);
    expect(readMirrorTlsCertificate(text, NOW)).toEqual(certificate);
    expect(
        readMirrorTlsCertificate(text, new Date(NOW.getTime() + 769 * DAY)),
    ).toEqual(certificate);
    expect(
        readMirrorTlsCertificate(text, new Date(NOW.getTime() + 771 * DAY)),
    ).toBeNull();
    expect(readMirrorTlsCertificate('', NOW)).toBeNull();
    expect(readMirrorTlsCertificate(null, NOW)).toBeNull();
    expect(readMirrorTlsCertificate('{"key":1}', NOW)).toBeNull();
    expect(readMirrorTlsCertificate('not json', NOW)).toBeNull();
    const otherKey = crypto
        .generateKeyPairSync('rsa', { modulusLength: 1024 })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString();
    expect(
        readMirrorTlsCertificate(
            JSON.stringify({ ...certificate, key: otherKey }),
            NOW,
        ),
    ).toBeNull();
});

async function startPort(isSecure: () => boolean) {
    const handle = (req: http.IncomingMessage, res: http.ServerResponse) => {
        const encrypted = (req.socket as { encrypted?: boolean }).encrypted;
        res.end(`${encrypted ? 'tls' : 'plain'} ${req.url}`);
    };
    const plain = http.createServer(handle);
    const secure = https.createServer(certificate, handle);
    const wss = new WebSocketServer({ noServer: true });
    for (const server of [plain, secure]) {
        server.on('upgrade', (req, socket, head) => {
            wss.handleUpgrade(req, socket, head, (client) => {
                client.on('message', (data) => {
                    const encrypted = (req.socket as { encrypted?: boolean })
                        .encrypted;
                    client.send(`${encrypted ? 'tls' : 'plain'} ${data}`);
                });
            });
        });
    }
    const secureSockets = new Set<net.Socket>();
    const sockets = new Set<net.Socket>();
    const port = net.createServer((socket) => {
        sockets.add(socket);
        routeMirrorSocket(socket, {
            plain,
            toSecure: () => (isSecure() ? secure : null),
            onSecure: (socket) => secureSockets.add(socket),
        });
    });
    await new Promise<void>((resolve) => {
        port.listen(0, '127.0.0.1', resolve);
    });
    closers.push(() => {
        for (const socket of sockets) {
            socket.destroy();
        }
        port.close();
        wss.close();
    });
    const address = port.address() as net.AddressInfo;
    return { port: address.port, secureSockets, sockets, server: port };
}

function get(url: string) {
    return new Promise<string>((resolve, reject) => {
        const request = (url.startsWith('https') ? https : http).get(
            url,
            { rejectUnauthorized: false, agent: false },
            (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => resolve(body));
            },
        );
        request.on('error', reject);
    });
}

function echo(url: string) {
    return new Promise<string>((resolve, reject) => {
        const client = new WebSocket(url, { rejectUnauthorized: false });
        client.on('open', () => client.send('hello'));
        client.on('message', (data) => {
            resolve(String(data));
            client.close();
        });
        client.on('error', reject);
    });
}

test('answers plain HTTP and HTTPS, and their sockets, on one port', async () => {
    const { port, secureSockets } = await startPort(() => true);
    expect(await get(`http://127.0.0.1:${port}/vd/1/`)).toBe('plain /vd/1/');
    expect(await get(`https://127.0.0.1:${port}/vd/1/`)).toBe('tls /vd/1/');
    expect(await echo(`ws://127.0.0.1:${port}/vd/1/ws`)).toBe('plain hello');
    expect(await echo(`wss://127.0.0.1:${port}/vd/1/ws`)).toBe('tls hello');
    expect(secureSockets.size).toBe(2);
});

test('closes a TLS connection while HTTPS is off; plain HTTP still answers', async () => {
    const { port, secureSockets } = await startPort(() => false);
    await expect(get(`https://127.0.0.1:${port}/`)).rejects.toThrow();
    expect(await get(`http://127.0.0.1:${port}/`)).toBe('plain /');
    expect(secureSockets.size).toBe(0);
});

test('a connection that says nothing and leaves does not throw', async () => {
    const { port } = await startPort(() => true);
    await new Promise<void>((resolve) => {
        const socket = net.connect(port, '127.0.0.1', () => {
            socket.destroy();
            resolve();
        });
    });
    expect(await get(`http://127.0.0.1:${port}/after`)).toBe('plain /after');
});

test('destroying a routed TLS socket ends its HTTPS connection', async () => {
    const { port, secureSockets } = await startPort(() => true);
    const closed = new Promise<void>((resolve, reject) => {
        const client = new WebSocket(`wss://127.0.0.1:${port}/vd/1/ws`, {
            rejectUnauthorized: false,
        });
        client.on('open', () => {
            for (const socket of secureSockets) {
                socket.destroy();
            }
        });
        client.on('close', () => resolve());
        client.on('error', reject);
    });
    await closed;
});

// A rebind destroys every socket the port took and waits for it to close:
// a TLS viewer and a connection that never spoke must not hold it open.
test('the port closes once its sockets are destroyed, TLS ones too', async () => {
    const { port, sockets, server } = await startPort(() => true);
    const viewer = new WebSocket(`wss://127.0.0.1:${port}/vd/1/ws`, {
        rejectUnauthorized: false,
    });
    viewer.on('error', () => {});
    await new Promise((resolve) => viewer.once('open', resolve));
    const silent = net.connect(port, '127.0.0.1');
    silent.on('error', () => {});
    await new Promise((resolve) => silent.once('connect', resolve));
    await vi.waitFor(() => expect(sockets.size).toBe(2));
    const closed = new Promise<void>((resolve) =>
        server.close(() => resolve()),
    );
    for (const socket of sockets) {
        socket.destroy();
    }
    await closed;
});
