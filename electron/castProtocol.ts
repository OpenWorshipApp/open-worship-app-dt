import { checkIsDeviceUrl, escapeXml, readXmlTag } from './upnpHelpers';

// Casting a virtual display to a TV on this network: the pieces that only
// read and build bytes and text, kept apart from the sockets
// (`castTargets.ts`) so each is tested alone. Every kind of TV is handed the
// same thing -- the display's live MP4 address on this network -- and pulls
// the stream itself, like any other player in Watching now.
//
// - Google Cast (Chromecast, Google TV, TVs with it built in): found over
//   mDNS, told over its own TLS protocol (CASTV2) to open Google's Default
//   Media Receiver and load the address.
// - DLNA media renderers (most Samsung, LG, Sony, Philips TVs): found over
//   SSDP, told over UPnP AVTransport (SetAVTransportURI, then Play).
// - Roku: found over SSDP, told over its External Control Protocol to open
//   its media player on the address.

export type CastTargetKind = 'google-cast' | 'dlna' | 'roku';
export type CastTarget = {
    id: string;
    kind: CastTargetKind;
    name: string;
    // An IPv4 address on this network.
    host: string;
    port: number;
    // A DLNA renderer's AVTransport service.
    controlUrl?: string;
    serviceType?: string;
};

export const MAX_CAST_TARGETS = 32;
const MAX_NAME_LENGTH = 80;

// A name a device gave itself, fit to show: no control characters, one line,
// not too long.
export function toCastTargetName(text: unknown, fallback: string) {
    const name =
        typeof text === 'string'
            ? text
                  // eslint-disable-next-line no-control-regex
                  .replace(/[\u0000-\u001f\u007f]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, MAX_NAME_LENGTH)
            : '';
    return name || fallback;
}

// -- Google Cast (CASTV2) ----------------------------------------------------

export const GOOGLE_CAST_SERVICE = '_googlecast._tcp.local';
export const GOOGLE_CAST_PORT = 8009;
export const DEFAULT_MEDIA_RECEIVER = 'CC1AD845';
export const CAST_NAMESPACE = {
    connection: 'urn:x-cast:com.google.cast.tp.connection',
    heartbeat: 'urn:x-cast:com.google.cast.tp.heartbeat',
    receiver: 'urn:x-cast:com.google.cast.receiver',
    media: 'urn:x-cast:com.google.cast.media',
} as const;
export const CAST_SENDER_ID = 'sender-0';
export const CAST_RECEIVER_ID = 'receiver-0';
// A frame the TV sends is a few KB of JSON at most.
const MAX_CAST_FRAME = 64 * 1024;

export type CastMessage = {
    sourceId: string;
    destinationId: string;
    namespace: string;
    // JSON text.
    payload: string;
};

function encodeVarint(value: number) {
    const bytes: number[] = [];
    let rest = value;
    while (rest > 0x7f) {
        bytes.push((rest & 0x7f) | 0x80);
        rest = Math.floor(rest / 128);
    }
    bytes.push(rest);
    return Buffer.from(bytes);
}

function encodeStringField(field: number, text: string) {
    const bytes = Buffer.from(text, 'utf8');
    return Buffer.concat([
        encodeVarint((field << 3) | 2),
        encodeVarint(bytes.length),
        bytes,
    ]);
}

// A CastMessage protobuf (protocol 0, a string payload) behind its 4-byte
// big-endian length -- one frame on the TLS socket.
export function encodeCastMessage(message: CastMessage) {
    const body = Buffer.concat([
        Buffer.from([0x08, 0x00]),
        encodeStringField(2, message.sourceId),
        encodeStringField(3, message.destinationId),
        encodeStringField(4, message.namespace),
        Buffer.from([0x28, 0x00]),
        encodeStringField(6, message.payload),
    ]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    return Buffer.concat([length, body]);
}

// One CastMessage, or null for anything else (a binary payload, a field this
// does not know how to skip, bytes cut short).
export function decodeCastMessage(body: Buffer): CastMessage | null {
    const message: CastMessage = {
        sourceId: '',
        destinationId: '',
        namespace: '',
        payload: '',
    };
    let offset = 0;
    const readVarint = () => {
        let value = 0;
        let scale = 1;
        for (let index = 0; index < 5; index++) {
            if (offset >= body.length) {
                return null;
            }
            const byte = body[offset++];
            value += (byte & 0x7f) * scale;
            if ((byte & 0x80) === 0) {
                return value;
            }
            scale *= 128;
        }
        return null;
    };
    while (offset < body.length) {
        const tag = readVarint();
        if (tag === null) {
            return null;
        }
        const field = tag >> 3;
        const wireType = tag & 7;
        if (wireType === 0) {
            if (readVarint() === null) {
                return null;
            }
            continue;
        }
        if (wireType !== 2) {
            return null;
        }
        const length = readVarint();
        if (length === null || offset + length > body.length) {
            return null;
        }
        const text = body.toString('utf8', offset, offset + length);
        offset += length;
        if (field === 2) {
            message.sourceId = text;
        } else if (field === 3) {
            message.destinationId = text;
        } else if (field === 4) {
            message.namespace = text;
        } else if (field === 6) {
            message.payload = text;
        }
    }
    return message.namespace ? message : null;
}

// The frames in a TLS stream, however its chunks were cut.
export class CastFrameReader {
    private buffer = Buffer.alloc(0);

    push(chunk: Buffer) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const messages: CastMessage[] = [];
        while (this.buffer.length >= 4) {
            const length = this.buffer.readUInt32BE(0);
            if (length > MAX_CAST_FRAME) {
                throw new Error('Cast frame too large');
            }
            if (this.buffer.length < 4 + length) {
                break;
            }
            const message = decodeCastMessage(
                this.buffer.subarray(4, 4 + length),
            );
            this.buffer = this.buffer.subarray(4 + length);
            if (message !== null) {
                messages.push(message);
            }
        }
        return messages;
    }
}

// The Default Media Receiver's LOAD for a live MP4 at `url`.
export function toCastLoadPayload(
    requestId: number,
    url: string,
    title: string,
) {
    return {
        type: 'LOAD',
        requestId,
        autoplay: true,
        currentTime: 0,
        media: {
            contentId: url,
            contentType: 'video/mp4',
            streamType: 'LIVE',
            metadata: { metadataType: 0, title },
        },
    };
}

// -- mDNS --------------------------------------------------------------------

// A PTR question for `name`, asking for the answer straight back (the QU bit):
// it is sent from a port other than 5353.
export function buildMdnsQuery(name: string) {
    const labels = name.split('.').map((label) => {
        const bytes = Buffer.from(label, 'utf8');
        return Buffer.concat([Buffer.from([bytes.length]), bytes]);
    });
    return Buffer.concat([
        Buffer.from([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]),
        ...labels,
        Buffer.from([0, 0, 12, 0x80, 1]),
    ]);
}

type DnsRecordType = {
    name: string;
    type: number;
    data: Buffer;
    dataOffset: number;
};

function readDnsName(packet: Buffer, start: number) {
    const labels: string[] = [];
    let offset = start;
    let end = -1;
    for (let jumps = 0; jumps < 32; jumps++) {
        if (offset >= packet.length) {
            return null;
        }
        const length = packet[offset];
        if (length === 0) {
            return { name: labels.join('.'), end: end < 0 ? offset + 1 : end };
        }
        if ((length & 0xc0) === 0xc0) {
            if (offset + 1 >= packet.length) {
                return null;
            }
            if (end < 0) {
                end = offset + 2;
            }
            offset = ((length & 0x3f) << 8) | packet[offset + 1];
            continue;
        }
        if (offset + 1 + length > packet.length) {
            return null;
        }
        labels.push(packet.toString('utf8', offset + 1, offset + 1 + length));
        offset += 1 + length;
    }
    return null;
}

function readDnsRecords(packet: Buffer) {
    if (packet.length < 12) {
        return [];
    }
    const questions = packet.readUInt16BE(4);
    const count =
        packet.readUInt16BE(6) +
        packet.readUInt16BE(8) +
        packet.readUInt16BE(10);
    let offset = 12;
    for (let index = 0; index < questions; index++) {
        const name = readDnsName(packet, offset);
        if (name === null) {
            return [];
        }
        offset = name.end + 4;
    }
    const records: DnsRecordType[] = [];
    for (let index = 0; index < count && index < 64; index++) {
        const name = readDnsName(packet, offset);
        if (name === null || name.end + 10 > packet.length) {
            break;
        }
        const type = packet.readUInt16BE(name.end);
        const length = packet.readUInt16BE(name.end + 8);
        const dataOffset = name.end + 10;
        if (dataOffset + length > packet.length) {
            break;
        }
        records.push({
            name: name.name.toLowerCase(),
            type,
            data: packet.subarray(dataOffset, dataOffset + length),
            dataOffset,
        });
        offset = dataOffset + length;
    }
    return records;
}

function readTxt(data: Buffer) {
    const entries: Record<string, string> = {};
    let offset = 0;
    while (offset < data.length) {
        const length = data[offset];
        const text = data.toString('utf8', offset + 1, offset + 1 + length);
        const equal = text.indexOf('=');
        if (equal > 0) {
            entries[text.slice(0, equal).toLowerCase()] = text.slice(equal + 1);
        }
        offset += 1 + length;
    }
    return entries;
}

// The Google Cast devices one mDNS answer names. They are always taken to be
// where the answer came from: an answer cannot send this computer to another
// address. Speakers and speaker groups (no video out) are left out.
export function readGoogleCastAnswer(packet: Buffer, fromAddress: string) {
    const records = readDnsRecords(packet);
    const service = GOOGLE_CAST_SERVICE.toLowerCase();
    const instances = new Set<string>();
    for (const record of records) {
        if (record.type === 12 && record.name === service) {
            const instance = readDnsName(packet, record.dataOffset);
            if (instance !== null) {
                instances.add(instance.name.toLowerCase());
            }
        }
    }
    const targets: CastTarget[] = [];
    for (const instance of instances) {
        let port = GOOGLE_CAST_PORT;
        let txt: Record<string, string> = {};
        for (const record of records) {
            if (record.name !== instance) {
                continue;
            }
            if (record.type === 33 && record.data.length >= 6) {
                port = record.data.readUInt16BE(4) || GOOGLE_CAST_PORT;
            } else if (record.type === 16) {
                txt = readTxt(record.data);
            }
        }
        const capabilities = Number(txt.ca);
        if (
            Number.isFinite(capabilities) &&
            txt.ca &&
            (capabilities & 1) === 0
        ) {
            continue;
        }
        const label = instance.slice(0, -(service.length + 1));
        targets.push({
            id: `google-cast:${(txt.id || `${fromAddress}:${port}`).slice(0, 64)}`,
            kind: 'google-cast',
            name: toCastTargetName(
                txt.fn,
                toCastTargetName(label, 'Chromecast'),
            ),
            host: fromAddress,
            port,
        });
    }
    return targets;
}

// -- SSDP and UPnP -------------------------------------------------------------

export const DLNA_RENDERER_TARGET =
    'urn:schemas-upnp-org:device:MediaRenderer:1';
export const ROKU_TARGET = 'roku:ecp';
const AV_TRANSPORT_PATTERN = /^urn:schemas-upnp-org:service:AVTransport:\d$/;

export function readSsdpAnswer(text: string) {
    const location = /^location:\s*(\S+)/im.exec(text)?.[1] ?? '';
    const target = /^st:\s*(.+?)\s*$/im.exec(text)?.[1] ?? '';
    const server = /^server:\s*(.+?)\s*$/im.exec(text)?.[1] ?? '';
    return location ? { location, target, server } : null;
}

// A DLNA renderer's name and AVTransport control address, from its
// description. Null when it has none, or names another computer for it.
export function readDlnaRenderer(xml: string, location: string) {
    const host = new URL(location).hostname;
    const base = readXmlTag(xml, 'URLBase') || location;
    for (const [, block] of xml.matchAll(/<service>([\s\S]*?)<\/service>/gi)) {
        const serviceType = readXmlTag(block, 'serviceType');
        const control = readXmlTag(block, 'controlURL');
        if (!AV_TRANSPORT_PATTERN.test(serviceType) || !control) {
            continue;
        }
        let controlUrl: string;
        try {
            controlUrl = new URL(control, base).href;
        } catch {
            continue;
        }
        if (!checkIsDeviceUrl(controlUrl, host)) {
            continue;
        }
        const udn = readXmlTag(xml, 'UDN').replace(/^uuid:/i, '');
        return {
            id: `dlna:${(udn || host).slice(0, 64)}`,
            name: toCastTargetName(
                readXmlTag(xml, 'friendlyName'),
                toCastTargetName(readXmlTag(xml, 'modelName'), host),
            ),
            controlUrl,
            serviceType,
        };
    }
    return null;
}

// Streamed live, not seekable, nothing to download first.
export const DLNA_CONTENT_FEATURES =
    'DLNA.ORG_OP=00;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000';

// What a renderer is told it is about to play.
export function buildDlnaMetadata(title: string, url: string) {
    return (
        '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">' +
        '<item id="0" parentID="-1" restricted="1">' +
        `<dc:title>${escapeXml(title)}</dc:title>` +
        '<upnp:class>object.item.videoItem</upnp:class>' +
        `<res protocolInfo="http-get:*:video/mp4:${DLNA_CONTENT_FEATURES}">` +
        `${escapeXml(url)}</res></item></DIDL-Lite>`
    );
}

// -- Roku --------------------------------------------------------------------

export const ROKU_PORT = 8060;
// Roku's own media player ("Play on Roku").
const ROKU_PLAYER_APP = '15985';

export function readRokuDevice(xml: string, host: string) {
    const serial = readXmlTag(xml, 'serialNumber');
    return {
        id: `roku:${(serial || host).slice(0, 64)}`,
        name: toCastTargetName(
            readXmlTag(xml, 'friendlyName'),
            toCastTargetName(readXmlTag(xml, 'modelName'), 'Roku'),
        ),
    };
}

export function toRokuPlayUrl(
    target: Pick<CastTarget, 'host' | 'port'>,
    url: string,
    title: string,
) {
    const query = new URLSearchParams({
        t: 'v',
        u: url,
        videoName: title,
        videoFormat: 'mp4',
    });
    return `http://${target.host}:${target.port}/launch/${ROKU_PLAYER_APP}?${query}`;
}

// Back to the Roku's home screen: its player closes, and the stream with it.
export function toRokuStopUrl(target: Pick<CastTarget, 'host' | 'port'>) {
    return `http://${target.host}:${target.port}/keypress/Home`;
}
