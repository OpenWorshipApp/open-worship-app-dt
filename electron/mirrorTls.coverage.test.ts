import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type net from 'node:net';

import { describe, expect, test, vi } from 'vitest';

import { genMirrorTlsCertificate, routeMirrorSocket } from './mirrorTls';

// The certificate's names when they repeat or run long, a key that cannot
// be made, and a connection that fails or goes before its first byte.

// A connection as `routeMirrorSocket` reads it: bytes come when pushed.
class FakeSocket extends EventEmitter {
    destroyed = false;
    readableEnded = false;
    chunks: Buffer[] = [];
    reads = 0;
    read() {
        this.reads += 1;
        return this.chunks.shift() ?? null;
    }
    unshift(chunk: Buffer) {
        this.chunks.unshift(chunk);
    }
    setTimeout(_millisecond: number, listener?: () => void) {
        if (listener) {
            this.once('timeout', listener);
        }
        return this;
    }
    destroy() {
        this.destroyed = true;
        return this;
    }
}

function route(socket: FakeSocket) {
    const plain = new EventEmitter();
    const toSecure = vi.fn(() => null);
    routeMirrorSocket(socket as unknown as net.Socket, {
        plain: plain as unknown as net.Server,
        toSecure,
    });
    const connections: unknown[] = [];
    plain.on('connection', (connection) => connections.push(connection));
    return { connections, toSecure };
}

// The key's size is not what these are about: a small one is quick.
function useSmallKey() {
    const generateKeyPair = crypto.generateKeyPair;
    vi.spyOn(crypto, 'generateKeyPair').mockImplementation(((
        type: any,
        options: any,
        callback: any,
    ) => {
        return generateKeyPair(
            type,
            { ...options, modulusLength: 1024 },
            callback,
        );
    }) as any);
}

describe('the certificate', () => {
    test('a year from 2050 on is written in full, as it must be', async () => {
        useSmallKey();

        const { cert } = await genMirrorTlsCertificate(
            ['localhost'],
            new Date('2049-06-01T00:00:00Z'),
        );

        // Two digits would read 2051 as 1951: a certificate long expired.
        const x509 = new crypto.X509Certificate(cert);
        expect(x509.validFrom).toBe('May 31 00:00:00 2049 GMT');
        expect(x509.validTo).toBe('Aug 10 00:00:00 2051 GMT');
    }, 20_000);
});

describe('the certificate’s names', () => {
    test('each is named once, and at most 32 are', async () => {
        useSmallKey();
        const many = Array.from({ length: 40 }, (_, index) => {
            return `host-${index}`;
        });

        const { cert } = await genMirrorTlsCertificate([
            '192.168.1.3',
            ' 192.168.1.3 ',
            'Church-PC',
            'church-pc',
            '',
            '   ',
            ...many,
        ]);

        const names = new crypto.X509Certificate(cert)
            .subjectAltName!.split(', ')
            .map((entry) => entry.replace(/^(DNS:|IP Address:)/, ''));
        expect(names).toHaveLength(32);
        expect(new Set(names).size).toBe(32);
        expect(names.filter((name) => name === '192.168.1.3')).toHaveLength(1);
        expect(names.filter((name) => name === 'church-pc')).toHaveLength(1);
        expect(names).not.toContain('host-39');
    }, 20_000);

    test('a key that cannot be made is a failure, not a certificate', async () => {
        const failure = new Error('no entropy');
        vi.spyOn(crypto, 'generateKeyPair').mockImplementation(((
            _type: any,
            _options: any,
            callback: any,
        ) => {
            callback(failure);
        }) as any);

        await expect(genMirrorTlsCertificate(['localhost'])).rejects.toBe(
            failure,
        );
    });
});

describe('a connection on the shared port', () => {
    test('that fails, or says nothing in time, before its first byte is closed', () => {
        const failing = new FakeSocket();
        route(failing);
        failing.emit('error', new Error('ECONNRESET'));
        expect(failing.destroyed).toBe(true);

        const silent = new FakeSocket();
        route(silent);
        silent.emit('timeout');
        expect(silent.destroyed).toBe(true);
    });

    test('closed before its first byte arrives is handed to no one', () => {
        const socket = new FakeSocket();
        const { connections, toSecure } = route(socket);
        expect(socket.reads).toBe(1);

        socket.destroy();
        socket.chunks.push(Buffer.from('GET / HTTP/1.1\r\n'));
        socket.emit('readable');

        expect(socket.reads).toBe(1);
        expect(connections).toEqual([]);
        expect(toSecure).not.toHaveBeenCalled();
    });

    test('that ends without a byte is not waited on', () => {
        const socket = new FakeSocket();
        socket.readableEnded = true;

        const { connections, toSecure } = route(socket);

        expect(socket.listenerCount('readable')).toBe(0);
        expect(connections).toEqual([]);
        expect(toSecure).not.toHaveBeenCalled();
    });

    test('that has not spoken yet is waited on', () => {
        const socket = new FakeSocket();

        const { connections } = route(socket);
        expect(socket.listenerCount('readable')).toBe(1);

        socket.chunks.push(Buffer.from('G'));
        socket.emit('readable');

        expect(connections).toEqual([socket]);
        expect(socket.chunks.map((chunk) => chunk.toString())).toEqual(['G']);
        // Handed over: its failures and silence are the server's now.
        expect(socket.listenerCount('error')).toBe(0);
        expect(socket.listenerCount('timeout')).toBe(0);
    });
});
