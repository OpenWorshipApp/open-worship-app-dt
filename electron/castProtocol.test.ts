import { describe, expect, test } from 'vitest';

import {
    CAST_NAMESPACE,
    CastFrameReader,
    GOOGLE_CAST_SERVICE,
    buildDlnaMetadata,
    buildMdnsQuery,
    decodeCastMessage,
    encodeCastMessage,
    readDlnaRenderer,
    readGoogleCastAnswer,
    readRokuDevice,
    readSsdpAnswer,
    toCastLoadPayload,
    toCastTargetName,
    toRokuPlayUrl,
    toRokuStopUrl,
} from './castProtocol';

describe('Google Cast frames', () => {
    const message = {
        sourceId: 'sender-0',
        destinationId: 'receiver-0',
        namespace: CAST_NAMESPACE.receiver,
        payload: JSON.stringify({ type: 'LAUNCH', appId: 'CC1AD845' }),
    };

    test('round-trip, a length then the protobuf', () => {
        const frame = encodeCastMessage(message);
        expect(frame.readUInt32BE(0)).toBe(frame.length - 4);
        expect(decodeCastMessage(frame.subarray(4))).toEqual(message);
    });

    test('a long payload takes a multi-byte length', () => {
        const long = { ...message, payload: 'x'.repeat(300) };
        const frame = encodeCastMessage(long);
        expect(decodeCastMessage(frame.subarray(4))?.payload).toHaveLength(300);
    });

    test('frames are read however the stream was cut', () => {
        const pong = {
            ...message,
            namespace: CAST_NAMESPACE.heartbeat,
            payload: '{"type":"PONG"}',
        };
        const bytes = Buffer.concat([
            encodeCastMessage(message),
            encodeCastMessage(pong),
        ]);
        const reader = new CastFrameReader();
        const got = [
            ...reader.push(bytes.subarray(0, 3)),
            ...reader.push(bytes.subarray(3, 40)),
            ...reader.push(bytes.subarray(40)),
        ];
        expect(got).toEqual([message, pong]);
    });

    test('a frame too large is refused, bytes cut short are not a message', () => {
        const huge = Buffer.alloc(4);
        huge.writeUInt32BE(1 << 20);
        expect(() => new CastFrameReader().push(huge)).toThrow();
        expect(decodeCastMessage(Buffer.from([0x12, 0x40, 0x41]))).toBeNull();
        // A field of a wire type it cannot skip.
        expect(decodeCastMessage(Buffer.from([0x0d, 1, 2, 3, 4]))).toBeNull();
    });

    test('the LOAD hands the TV a live MP4', () => {
        expect(
            toCastLoadPayload(
                3,
                'http://192.168.1.5:39240/vd/1/video',
                'Lobby',
            ),
        ).toEqual({
            type: 'LOAD',
            requestId: 3,
            autoplay: true,
            currentTime: 0,
            media: {
                contentId: 'http://192.168.1.5:39240/vd/1/video',
                contentType: 'video/mp4',
                streamType: 'LIVE',
                metadata: { metadataType: 0, title: 'Lobby' },
            },
        });
    });
});

// A DNS name, uncompressed.
function dnsName(name: string) {
    return Buffer.concat([
        ...name.split('.').map((label) => {
            return Buffer.concat([
                Buffer.from([label.length]),
                Buffer.from(label),
            ]);
        }),
        Buffer.from([0]),
    ]);
}

function record(name: string, type: number, data: Buffer) {
    const head = Buffer.alloc(10);
    head.writeUInt16BE(type, 0);
    head.writeUInt16BE(1, 2);
    head.writeUInt32BE(120, 4);
    head.writeUInt16BE(data.length, 8);
    return Buffer.concat([dnsName(name), head, data]);
}

function txt(entries: string[]) {
    return Buffer.concat(
        entries.map((entry) => {
            return Buffer.concat([
                Buffer.from([entry.length]),
                Buffer.from(entry),
            ]);
        }),
    );
}

function srv(port: number, target: string) {
    const head = Buffer.alloc(6);
    head.writeUInt16BE(port, 4);
    return Buffer.concat([head, dnsName(target)]);
}

function answer(records: Buffer[]) {
    const head = Buffer.alloc(12);
    head.writeUInt16BE(0x8400, 2);
    head.writeUInt16BE(records.length, 6);
    return Buffer.concat([head, ...records]);
}

describe('finding Google Cast devices', () => {
    test('the query asks for the service, its answer straight back', () => {
        const query = buildMdnsQuery(GOOGLE_CAST_SERVICE);
        expect(query.readUInt16BE(4)).toBe(1);
        expect(query.subarray(12).includes(Buffer.from('_googlecast'))).toBe(
            true,
        );
        // PTR, class IN with the unicast-response bit.
        expect([...query.subarray(-4)]).toEqual([0, 12, 0x80, 1]);
    });

    test('a TV is named, placed where the answer came from, and speakers are left out', () => {
        const tv = `Living-Room-TV-abc.${GOOGLE_CAST_SERVICE}`;
        const speaker = `Kitchen-speaker.${GOOGLE_CAST_SERVICE}`;
        const packet = answer([
            record(GOOGLE_CAST_SERVICE, 12, dnsName(tv)),
            record(GOOGLE_CAST_SERVICE, 12, dnsName(speaker)),
            record(tv, 33, srv(8009, 'abc.local')),
            record(tv, 16, txt(['id=abc123', 'fn=Living Room TV', 'ca=4101'])),
            record(speaker, 16, txt(['id=def', 'fn=Kitchen', 'ca=2052'])),
            // Says it is elsewhere: still taken to be the one that answered.
            record('abc.local', 1, Buffer.from([10, 0, 0, 99])),
        ]);
        expect(readGoogleCastAnswer(packet, '192.168.1.40')).toEqual([
            {
                id: 'google-cast:abc123',
                kind: 'google-cast',
                name: 'Living Room TV',
                host: '192.168.1.40',
                port: 8009,
            },
        ]);
    });

    test('a broken packet names nothing', () => {
        expect(
            readGoogleCastAnswer(Buffer.from([1, 2, 3]), '10.0.0.2'),
        ).toEqual([]);
        const cut = answer([
            record(
                GOOGLE_CAST_SERVICE,
                12,
                dnsName(`x.${GOOGLE_CAST_SERVICE}`),
            ),
        ]).subarray(0, 30);
        expect(readGoogleCastAnswer(cut, '10.0.0.2')).toEqual([]);
    });
});

describe('DLNA and Roku', () => {
    const LOCATION = 'http://192.168.1.50:7676/dmr.xml';
    const description = (control: string, host = '') => {
        return `<?xml version="1.0"?><root><URLBase>${host}</URLBase><device>
            <friendlyName>[TV] Samsung &amp; Co</friendlyName>
            <modelName>UE55</modelName><UDN>uuid:1234-abcd</UDN>
            <serviceList>
              <service><serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
                <controlURL>/rc</controlURL></service>
              <service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
                <controlURL>${control}</controlURL></service>
            </serviceList></device></root>`;
    };

    test('an SSDP answer gives where its description is', () => {
        expect(
            readSsdpAnswer(
                'HTTP/1.1 200 OK\r\nLOCATION: http://192.168.1.50:7676/dmr.xml\r\n' +
                    'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n' +
                    'SERVER: Samsung UPnP SDK/1.0\r\n\r\n',
            ),
        ).toEqual({
            location: LOCATION,
            target: 'urn:schemas-upnp-org:device:MediaRenderer:1',
            server: 'Samsung UPnP SDK/1.0',
        });
        expect(readSsdpAnswer('HTTP/1.1 200 OK\r\n\r\n')).toBeNull();
    });

    test('a renderer is its name and AVTransport control address', () => {
        expect(
            readDlnaRenderer(
                description('/upnp/control/AVTransport1'),
                LOCATION,
            ),
        ).toEqual({
            id: 'dlna:1234-abcd',
            name: '[TV] Samsung & Co',
            controlUrl: 'http://192.168.1.50:7676/upnp/control/AVTransport1',
            serviceType: 'urn:schemas-upnp-org:service:AVTransport:1',
        });
    });

    test('a control address on another computer, or none, is no renderer', () => {
        expect(
            readDlnaRenderer(description('http://10.9.9.9/avt'), LOCATION),
        ).toBeNull();
        expect(
            readDlnaRenderer(description('/avt', 'http://10.9.9.9/'), LOCATION),
        ).toBeNull();
        expect(
            readDlnaRenderer('<root><device></device></root>', LOCATION),
        ).toBeNull();
    });

    test('what a renderer is told it plays is escaped XML', () => {
        const metadata = buildDlnaMetadata(
            'Lobby <1> & "B"',
            'http://192.168.1.5:39240/vd/1/video?a=1&b=2',
        );
        expect(metadata).toContain(
            '<dc:title>Lobby &lt;1&gt; &amp; &quot;B&quot;</dc:title>',
        );
        expect(metadata).toContain('video?a=1&amp;b=2</res>');
        expect(metadata).toContain('http-get:*:video/mp4:DLNA.ORG_OP=00');
    });

    test('a Roku is named from its description and told to play and stop', () => {
        expect(
            readRokuDevice(
                '<root><device><friendlyName>Den Roku</friendlyName>' +
                    '<serialNumber>X00Y</serialNumber></device></root>',
                '192.168.1.60',
            ),
        ).toEqual({ id: 'roku:X00Y', name: 'Den Roku' });
        expect(readRokuDevice('<root/>', '192.168.1.60')).toEqual({
            id: 'roku:192.168.1.60',
            name: 'Roku',
        });
        const target = { host: '192.168.1.60', port: 8060 };
        const play = new URL(
            toRokuPlayUrl(
                target,
                'http://192.168.1.5:39240/vd/1/video',
                'Lobby',
            ),
        );
        expect(play.origin + play.pathname).toBe(
            'http://192.168.1.60:8060/launch/15985',
        );
        expect(Object.fromEntries(play.searchParams)).toEqual({
            t: 'v',
            u: 'http://192.168.1.5:39240/vd/1/video',
            videoName: 'Lobby',
            videoFormat: 'mp4',
        });
        expect(toRokuStopUrl(target)).toBe(
            'http://192.168.1.60:8060/keypress/Home',
        );
    });

    test('a name a device gave itself is one tidy line', () => {
        expect(toCastTargetName('  Big\n\tTV\u0007 ', 'x')).toBe('Big TV');
        expect(toCastTargetName('', 'Fallback')).toBe('Fallback');
        expect(toCastTargetName(42, 'Fallback')).toBe('Fallback');
        expect(toCastTargetName('a'.repeat(200), 'x')).toHaveLength(80);
    });
});
