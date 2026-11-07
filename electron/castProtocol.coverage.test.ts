import { describe, expect, test } from 'vitest';

import {
    CAST_NAMESPACE,
    GOOGLE_CAST_SERVICE,
    decodeCastMessage,
    encodeCastMessage,
    readDlnaRenderer,
    readGoogleCastAnswer,
} from './castProtocol';

// The edges of what a TV, or something pretending to be one, can send: cut
// protobufs, DNS names that point at each other, lengths past the packet.

describe('a CastMessage cut or bent out of shape', () => {
    test('a length whose bytes run out is no message', () => {
        // Field 2, a string -- and a length that says "more to come".
        expect(decodeCastMessage(Buffer.from([0x12, 0x80]))).toBeNull();
    });

    test('a varint longer than five bytes is no message', () => {
        expect(
            decodeCastMessage(
                Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x01]),
            ),
        ).toBeNull();
    });

    test('a number field cut short is no message', () => {
        expect(decodeCastMessage(Buffer.from([0x08, 0x80]))).toBeNull();
    });

    test('number fields and fields it does not know are skipped', () => {
        const frame = encodeCastMessage({
            sourceId: 'sender-0',
            destinationId: 'receiver-0',
            namespace: CAST_NAMESPACE.heartbeat,
            payload: '{"type":"PING"}',
        });
        // Field 5, a string this reader has no use for, in front.
        const unknown = Buffer.from([0x2a, 0x03, 0x61, 0x62, 0x63]);
        // Field 7, a multi-byte number.
        const number = Buffer.from([0x38, 0x96, 0x01]);
        const body = Buffer.concat([unknown, number, frame.subarray(4)]);

        expect(decodeCastMessage(body)).toEqual({
            sourceId: 'sender-0',
            destinationId: 'receiver-0',
            namespace: CAST_NAMESPACE.heartbeat,
            payload: '{"type":"PING"}',
        });
    });

    test('a message that names no namespace is nothing to act on', () => {
        expect(
            decodeCastMessage(
                encodeCastMessage({
                    sourceId: 'sender-0',
                    destinationId: 'receiver-0',
                    namespace: '',
                    payload: '{}',
                }).subarray(4),
            ),
        ).toBeNull();
    });
});

// -- mDNS packets with compressed names -----------------------------------

function label(text: string) {
    return Buffer.concat([Buffer.from([text.length]), Buffer.from(text)]);
}

function name(text: string) {
    return Buffer.concat([...text.split('.').map(label), Buffer.from([0])]);
}

function pointer(offset: number) {
    return Buffer.from([0xc0 | (offset >> 8), offset & 0xff]);
}

function recordHead(type: number, dataLength: number) {
    const head = Buffer.alloc(10);
    head.writeUInt16BE(type, 0);
    head.writeUInt16BE(1, 2);
    head.writeUInt32BE(120, 4);
    head.writeUInt16BE(dataLength, 8);
    return head;
}

function header(questions: number, answers: number) {
    const head = Buffer.alloc(12);
    head.writeUInt16BE(0x8400, 2);
    head.writeUInt16BE(questions, 4);
    head.writeUInt16BE(answers, 6);
    return head;
}

// An answer that repeats the question and then names the TV the way real
// receivers do: every name after the first is a pointer back into the packet.
function genCompressedAnswer(instanceLabel: string, txtEntries: string[]) {
    const parts: Buffer[] = [header(1, 2)];
    let length = 12;
    const push = (part: Buffer) => {
        parts.push(part);
        length += part.length;
    };
    const serviceOffset = length;
    push(name(GOOGLE_CAST_SERVICE));
    // The question's type and class.
    push(Buffer.from([0, 12, 0, 1]));
    // PTR: the service (a pointer) names the instance (a label, then a
    // pointer to the service).
    push(pointer(serviceOffset));
    const ptrData = Buffer.concat([
        label(instanceLabel),
        pointer(serviceOffset),
    ]);
    push(recordHead(12, ptrData.length));
    const instanceOffset = length;
    push(ptrData);
    // TXT for the instance, named by a pointer to the PTR's data.
    const txt = Buffer.concat(txtEntries.map(label));
    push(pointer(instanceOffset));
    push(recordHead(16, txt.length));
    push(txt);
    return Buffer.concat(parts);
}

describe('mDNS answers with compressed names', () => {
    test('a TV named through pointers is found, its question skipped', () => {
        const packet = genCompressedAnswer('Hall-TV-1f2e', [
            'id=1f2e',
            'fn=Hall TV',
            'ca=5',
        ]);

        expect(readGoogleCastAnswer(packet, '192.168.1.41')).toEqual([
            {
                id: 'google-cast:1f2e',
                kind: 'google-cast',
                name: 'Hall TV',
                host: '192.168.1.41',
                port: 8009,
            },
        ]);
    });

    test('a TV that says nothing of itself is named by its label, at its address', () => {
        const packet = genCompressedAnswer('Lobby', ['md=Chromecast']);

        const targets = readGoogleCastAnswer(packet, '10.0.0.7');
        expect(targets).toMatchObject([
            {
                id: 'google-cast:10.0.0.7:8009',
                kind: 'google-cast',
                host: '10.0.0.7',
                port: 8009,
            },
        ]);
        // The label, whatever its case: instances are matched lowercased.
        expect(targets[0].name.toLowerCase()).toBe('lobby');
    });

    test('a question whose name runs off the packet names nothing', () => {
        const packet = Buffer.concat([header(1, 0), Buffer.from([20, 0x61])]);

        expect(readGoogleCastAnswer(packet, '10.0.0.7')).toEqual([]);
    });

    test('a pointer cut in half names nothing', () => {
        // The answer's name is the first byte of a pointer, and then the end.
        const packet = Buffer.concat([header(0, 1), Buffer.from([0xc0])]);

        expect(readGoogleCastAnswer(packet, '10.0.0.7')).toEqual([]);
    });

    test('a pointer past the end of the packet names nothing', () => {
        const packet = Buffer.concat([header(0, 1), pointer(500)]);

        expect(readGoogleCastAnswer(packet, '10.0.0.7')).toEqual([]);
    });

    test('names that point at each other forever are given up on', () => {
        // Offset 12 points at itself: a reader that follows it never ends.
        const packet = Buffer.concat([
            header(0, 1),
            pointer(12),
            recordHead(12, 0),
        ]);

        expect(readGoogleCastAnswer(packet, '10.0.0.7')).toEqual([]);
    });

    test('a PTR whose instance name loops is no TV', () => {
        const parts = [header(0, 1)];
        const serviceName = name(GOOGLE_CAST_SERVICE);
        // The PTR's data is a pointer to itself.
        const dataOffset = 12 + serviceName.length + 10;
        parts.push(serviceName, recordHead(12, 2), pointer(dataOffset));

        expect(readGoogleCastAnswer(Buffer.concat(parts), '10.0.0.7')).toEqual(
            [],
        );
    });

    test('a record claiming more data than the packet holds ends the read', () => {
        const tv = `Den-TV.${GOOGLE_CAST_SERVICE}`;
        const ptrData = name(tv);
        const packet = Buffer.concat([
            header(0, 2),
            name(GOOGLE_CAST_SERVICE),
            recordHead(12, ptrData.length),
            ptrData,
            // The TXT says 200 bytes follow; three do.
            name(tv),
            recordHead(16, 200),
            Buffer.from([2, 0x69, 0x64]),
        ]);

        // The PTR before it still stands; the TXT is not read, so the TV
        // has no `fn` and no `id` of its own.
        const targets = readGoogleCastAnswer(packet, '10.0.0.8');
        expect(targets).toMatchObject([
            {
                id: 'google-cast:10.0.0.8:8009',
                kind: 'google-cast',
                host: '10.0.0.8',
                port: 8009,
            },
        ]);
        expect(targets[0].name.toLowerCase()).toBe('den-tv');
    });
});

describe('a DLNA description with a control address that is no address', () => {
    test('is skipped for the next service that has one', () => {
        const xml = `<root><device><friendlyName>Den TV</friendlyName>
            <UDN>uuid:9999</UDN><serviceList>
              <service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
                <controlURL>http://bad host/avt</controlURL></service>
              <service><serviceType>urn:schemas-upnp-org:service:AVTransport:2</serviceType>
                <controlURL>/avt2</controlURL></service>
            </serviceList></device></root>`;

        expect(
            readDlnaRenderer(xml, 'http://192.168.1.50:7676/dmr.xml'),
        ).toEqual({
            id: 'dlna:9999',
            name: 'Den TV',
            controlUrl: 'http://192.168.1.50:7676/avt2',
            serviceType: 'urn:schemas-upnp-org:service:AVTransport:2',
        });
    });

    test('with no other service, is no renderer', () => {
        const xml = `<root><device><serviceList>
              <service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
                <controlURL>http://bad host/avt</controlURL></service>
            </serviceList></device></root>`;

        expect(
            readDlnaRenderer(xml, 'http://192.168.1.50:7676/dmr.xml'),
        ).toBeNull();
    });
});
