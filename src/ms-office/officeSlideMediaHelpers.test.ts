// @vitest-environment jsdom
import { crc32, inflateSync } from 'node:zlib';

import { describe, expect, test } from 'vitest';

import {
    type OfficeAnimationType,
    readSlideAnimations,
    setShapeAnimationXml,
} from './officeSlideAnimationHelpers';
import {
    OFFICE_MEDIA_REL_TYPE,
    type OfficeMediaInfoType,
    type OfficeMediaKindType,
    addMediaTimingXml,
    dropMediaTimingXml,
    fitMediaBox,
    genMediaPicXml,
    genMediaPosterPng,
    readOfficeMediaDurationMs,
    readOfficeMediaInfo,
} from './officeSlideMediaHelpers';

// --- bytes ---------------------------------------------------------------

type PartType = Uint8Array | number[];

function concat(...parts: PartType[]) {
    const total = parts.reduce((sum, part) => {
        return sum + part.length;
    }, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}

function u32(value: number) {
    const unsigned = value >>> 0;
    return [
        (unsigned >>> 24) & 0xff,
        (unsigned >>> 16) & 0xff,
        (unsigned >>> 8) & 0xff,
        unsigned & 0xff,
    ];
}

function le32(value: number) {
    return u32(value).reverse();
}

function le16(value: number) {
    return [value & 0xff, (value >>> 8) & 0xff];
}

function ascii(text: string) {
    return [...text].map((char) => {
        return char.charCodeAt(0);
    });
}

function box(type: string, ...parts: PartType[]) {
    const body = concat(...parts);
    return concat(u32(8 + body.length), ascii(type), body);
}

function genFtyp(brand = 'isom') {
    return box('ftyp', ascii(brand), u32(512), ascii('isom'), ascii('mp41'));
}

function genTkhd(
    width: number,
    height: number,
    { version = 0, isTurned = false } = {},
) {
    // version and flags, then the fields before the matrix
    const head = new Uint8Array(version === 1 ? 52 : 40);
    head[0] = version;
    const matrix = isTurned
        ? [0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000]
        : [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
    return box(
        'tkhd',
        head,
        ...matrix.map(u32),
        u32(width * 65536),
        u32(height * 65536),
    );
}

function genMvhd(timescale: number, duration: number, version = 0) {
    return version === 1
        ? box(
              'mvhd',
              [1, 0, 0, 0],
              new Uint8Array(16),
              u32(timescale),
              u32(0),
              u32(duration),
              new Uint8Array(80),
          )
        : box(
              'mvhd',
              [0, 0, 0, 0],
              new Uint8Array(8),
              u32(timescale),
              u32(duration),
              new Uint8Array(80),
          );
}

function trak(...children: PartType[]) {
    return box('trak', ...children);
}

function genIsoFile(brand: string, ...moovChildren: PartType[]) {
    return concat(genFtyp(brand), box('moov', ...moovChildren));
}

const MP4 = genIsoFile(
    'isom',
    genMvhd(1000, 27002),
    trak(genTkhd(0, 0)),
    trak(genTkhd(1280, 720)),
);

// an ID3v2.4 tag of 10 bytes, then an MPEG-1 layer III frame header
const MP3_TAGGED = concat(
    ascii('ID3'),
    [4, 0, 0, 0, 0, 0, 10],
    new Uint8Array(10),
    [0xff, 0xfb, 0x90, 0x64],
    new Uint8Array(64),
);

function genWav(seconds: number) {
    const byteRate = 16000;
    const data = new Uint8Array(byteRate * seconds);
    return concat(
        ascii('RIFF'),
        le32(36 + data.length),
        ascii('WAVE'),
        ascii('fmt '),
        le32(16),
        le16(1),
        le16(1),
        le32(8000),
        le32(byteRate),
        le16(2),
        le16(16),
        ascii('data'),
        le32(data.length),
        data,
    );
}

function genAvi(width: number, height: number) {
    // 25 frames a second, 250 frames: ten seconds
    const avih = concat(
        ascii('avih'),
        le32(56),
        le32(40000),
        le32(0),
        le32(0),
        le32(0),
        le32(250),
        le32(0),
        le32(1),
        le32(0),
        le32(width),
        le32(height),
        new Uint8Array(16),
    );
    const list = concat(
        ascii('LIST'),
        le32(4 + avih.length),
        ascii('hdrl'),
        avih,
    );
    return concat(ascii('RIFF'), le32(4 + list.length), ascii('AVI '), list);
}

const ASF = concat(
    [
        0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa,
        0x00, 0x62, 0xce, 0x6c,
    ],
    new Uint8Array(32),
);

// --- slides --------------------------------------------------------------

const NAMESPACES =
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

const TITLE =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr>' +
    '<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody>' +
    '<a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Amazing Grace</a:t></a:r>' +
    '</a:p></p:txBody></p:sp>';

const PLACE = { x: 3483840, y: 962891, cx: 6096000, cy: 4572000 };

function genPic(shapeId: number, kind: OfficeMediaKindType = 'video') {
    return genMediaPicXml({
        shapeId,
        name: `Clip ${shapeId}`,
        description: 'clip.mp4',
        kind,
        linkRelId: 'rId2',
        mediaRelId: 'rId1',
        posterRelId: 'rId4',
        place: PLACE,
    });
}

// the slide's own extension list, after where a timing goes
const SLIDE_EXT =
    '<p:extLst><p:ext uri="{6950BFC3-D8DA-4A85-94F7-54DA5524770B}">' +
    `<p14:showEvtLst xmlns:p14="${P14}"/></p:ext></p:extLst>`;

function genSlide(after = '', boxes = genPic(3)) {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        `<p:sld ${NAMESPACES}><p:cSld><p:spTree><p:nvGrpSpPr>` +
        '<p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
        `<p:grpSpPr/>${TITLE}${boxes}</p:spTree><p:extLst><p:ext ` +
        `uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId ` +
        `xmlns:p14="${P14}" val="1608748676"/></p:ext></p:extLst></p:cSld>` +
        `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${after}</p:sld>`
    );
}

const SLIDE_COND =
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/>' +
    '</p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond ' +
    'evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>' +
    '</p:nextCondLst>';

const VIDEO_NODE_3 =
    '<p:video><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" ' +
    'display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>' +
    '</p:cTn><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cMediaNode>' +
    '</p:video>';

const TOGGLE_SEQ_3 =
    '<p:seq concurrent="1" nextAc="seek"><p:cTn id="8" ' +
    'restart="whenNotActive" fill="hold" evtFilter="cancelBubble" ' +
    'nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" ' +
    'delay="0"><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cond>' +
    '</p:stCondLst><p:endSync evt="end" delay="0"><p:rtn val="all"/>' +
    '</p:endSync><p:childTnLst><p:par><p:cTn id="9" fill="hold">' +
    '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par>' +
    '<p:cTn id="10" fill="hold"><p:stCondLst><p:cond delay="0"/>' +
    '</p:stCondLst><p:childTnLst><p:par><p:cTn id="11" presetID="2" ' +
    'presetClass="mediacall" presetSubtype="0" fill="hold" ' +
    'nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/>' +
    '</p:stCondLst><p:childTnLst><p:cmd type="call" cmd="togglePause">' +
    '<p:cBhvr><p:cTn id="12" dur="1" fill="hold"/><p:tgtEl><p:spTgt ' +
    'spid="3"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn>' +
    '</p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>' +
    '</p:par></p:childTnLst></p:cTn><p:nextCondLst><p:cond evt="onClick" ' +
    'delay="0"><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cond>' +
    '</p:nextCondLst></p:seq>';

// The timing of a slide PowerPoint for Mac saved with a video set to
// "Start: Automatically" (its `mute="1"` taken out): the main sequence's
// play step, the media node, the click's pause-and-resume sequence.
const POWERPOINT_AUTO_TIMING =
    '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" ' +
    'restart="never" nodeType="tmRoot"><p:childTnLst><p:seq ' +
    'concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" ' +
    'nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold">' +
    '<p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" ' +
    'delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>' +
    '<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/>' +
    '</p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" ' +
    'presetClass="mediacall" presetSubtype="0" fill="hold" ' +
    'nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/>' +
    '</p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)">' +
    '<p:cBhvr><p:cTn id="6" dur="27002" fill="hold"/><p:tgtEl><p:spTgt ' +
    'spid="3"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn>' +
    '</p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>' +
    `</p:par></p:childTnLst></p:cTn>${SLIDE_COND}</p:seq>${VIDEO_NODE_3}` +
    `${TOGGLE_SEQ_3}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;

const FADE_CLICK: OfficeAnimationType = {
    effect: 'fade',
    byLine: false,
    start: 'click',
    seconds: 0.5,
};

function readTiming(xml: string) {
    return /<p:timing>[\s\S]*?<\/p:timing>/.exec(xml)?.[0] ?? null;
}

function listIds(xml: string) {
    return [...xml.matchAll(/<p:cTn\b[^>]*?\sid="(\d+)"/g)].map((match) => {
        return Number(match[1]);
    });
}

function normalizeIds(xml: string) {
    return xml.replace(/(<p:cTn\b[^>]*?\sid=")\d+"/g, '$1#"');
}

function countOf(xml: string, text: string) {
    return xml.split(text).length - 1;
}

function checkIsWellFormed(xml: string) {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    return document.getElementsByTagName('parsererror').length === 0;
}

function add(
    xml: string,
    shapeId: string | number,
    kind: OfficeMediaKindType,
    play: 'click' | 'auto',
    durationMs: number | null = null,
) {
    const out = addMediaTimingXml(xml, shapeId, kind, play, durationMs);
    expect(out).not.toBeNull();
    return out as string;
}

function animate(
    xml: string,
    shapeId: string,
    animation: OfficeAnimationType | null,
) {
    const out = setShapeAnimationXml(xml, shapeId, animation);
    expect(out).not.toBeNull();
    return out as string;
}

// --- tests ---------------------------------------------------------------

describe('readOfficeMediaInfo', () => {
    test('an MP4: its first track with a frame, the sound track skipped', () => {
        expect(readOfficeMediaInfo('Choir Intro.MP4', MP4)).toEqual({
            kind: 'video',
            extension: 'mp4',
            contentType: 'video/mp4',
            width: 1280,
            height: 720,
        });
    });

    test('each kind PowerPoint plays, by its name and its bytes', () => {
        const cases: [string, Uint8Array, string, string][] = [
            [
                'a.m4v',
                genIsoFile('M4V ', trak(genTkhd(640, 360))),
                'video',
                'video/mp4',
            ],
            [
                'a.mov',
                genIsoFile('qt  ', trak(genTkhd(720, 480))),
                'video',
                'video/quicktime',
            ],
            [
                'a.m4a',
                genIsoFile('M4A ', trak(genTkhd(0, 0))),
                'audio',
                'audio/mp4',
            ],
            ['a.mp3', MP3_TAGGED, 'audio', 'audio/mpeg'],
            [
                'a.mp3',
                concat([0xff, 0xfb, 0x90, 0x64], new Uint8Array(8)),
                'audio',
                'audio/mpeg',
            ],
            ['a.wav', genWav(1), 'audio', 'audio/wav'],
            ['a.avi', genAvi(640, 480), 'video', 'video/x-msvideo'],
            ['a.wmv', ASF, 'video', 'video/x-ms-wmv'],
            ['a.wma', ASF, 'audio', 'audio/x-ms-wma'],
        ];
        for (const [name, bytes, kind, contentType] of cases) {
            const info = readOfficeMediaInfo(name, bytes);
            expect(info, name).not.toBeNull();
            expect(info?.kind, name).toBe(kind);
            expect(info?.contentType, name).toBe(contentType);
            expect(info?.extension, name).toBe(name.slice(2));
        }
    });

    test('a frame size from the header, else 16:9; a sound is square', () => {
        expect(
            readOfficeMediaInfo(
                'a.mov',
                genIsoFile('qt  ', trak(genTkhd(720, 480))),
            ),
        ).toMatchObject({ width: 720, height: 480 });
        expect(readOfficeMediaInfo('a.avi', genAvi(640, 480))).toMatchObject({
            width: 640,
            height: 480,
        });
        expect(readOfficeMediaInfo('a.wmv', ASF)).toMatchObject({
            width: 1920,
            height: 1080,
        });
        expect(readOfficeMediaInfo('a.mp4', genIsoFile('isom'))).toMatchObject({
            width: 1920,
            height: 1080,
        });
        const sound = readOfficeMediaInfo('a.mp3', MP3_TAGGED);
        expect(sound?.width).toBeGreaterThan(0);
        expect(sound?.width).toBe(sound?.height);
    });

    test('a version 1 tkhd, and a phone held upright turns the frame', () => {
        expect(
            readOfficeMediaInfo(
                'a.mp4',
                genIsoFile('isom', trak(genTkhd(1920, 1080, { version: 1 }))),
            ),
        ).toMatchObject({ width: 1920, height: 1080 });
        expect(
            readOfficeMediaInfo(
                'a.mp4',
                genIsoFile(
                    'isom',
                    trak(genTkhd(1920, 1080, { isTurned: true })),
                ),
            ),
        ).toMatchObject({ width: 1080, height: 1920 });
    });

    test('a moov after a big mdat with a 64-bit size, and a QuickTime with no ftyp', () => {
        const mdat = concat(
            u32(1),
            ascii('mdat'),
            u32(0),
            u32(16 + 32),
            new Uint8Array(32),
        );
        const bytes = concat(
            genFtyp(),
            mdat,
            box('moov', trak(genTkhd(854, 480))),
        );
        expect(readOfficeMediaInfo('a.mp4', bytes)).toMatchObject({
            width: 854,
            height: 480,
        });
        const old = concat(
            box('wide'),
            box('mdat', new Uint8Array(16)),
            box('moov', trak(genTkhd(320, 240))),
        );
        expect(readOfficeMediaInfo('a.mov', old)).toMatchObject({
            width: 320,
            height: 240,
        });
        // only a QuickTime movie may start without a ftyp
        expect(readOfficeMediaInfo('a.mp4', old)).toBeNull();
    });

    test('wrong bytes for the name, or a name PowerPoint does not play: null', () => {
        expect(readOfficeMediaInfo('a.mp4', genWav(1))).toBeNull();
        expect(readOfficeMediaInfo('a.wav', MP4)).toBeNull();
        expect(readOfficeMediaInfo('a.avi', genWav(1))).toBeNull();
        expect(readOfficeMediaInfo('a.wav', genAvi(1, 1))).toBeNull();
        expect(readOfficeMediaInfo('a.wmv', MP4)).toBeNull();
        expect(readOfficeMediaInfo('a.mp3', MP4)).toBeNull();
        expect(
            readOfficeMediaInfo(
                'a.mp3',
                Uint8Array.from(ascii('hello, world, not a song')),
            ),
        ).toBeNull();
        // an ID3 tag on a FLAC: the frame after it is not MPEG audio
        expect(
            readOfficeMediaInfo(
                'a.mp3',
                concat(
                    ascii('ID3'),
                    [4, 0, 0, 0, 0, 0, 0],
                    ascii('fLaC'),
                    [0xff, 0xf8, 0x69, 0x18],
                    new Uint8Array(8),
                ),
            ),
        ).toBeNull();
        // a HEIC photo named as a clip
        expect(readOfficeMediaInfo('a.mp4', genIsoFile('heic'))).toBeNull();
        expect(readOfficeMediaInfo('a.mkv', MP4)).toBeNull();
        expect(readOfficeMediaInfo('mp4', MP4)).toBeNull();
        expect(readOfficeMediaInfo('a.mp4', new Uint8Array(0))).toBeNull();
        expect(readOfficeMediaInfo('a.wma', new Uint8Array(4))).toBeNull();
    });

    test('a cut or hostile box tree neither throws nor loops', () => {
        // a moov saying it runs past the end, its tkhd cut in half
        const whole = genIsoFile('isom', trak(genTkhd(1280, 720)));
        const cut = whole.subarray(0, whole.length - 20);
        expect(readOfficeMediaInfo('a.mp4', cut)).toMatchObject({
            width: 1920,
            height: 1080,
        });
        // a box shorter than its own header ends the walk
        const short = concat(
            genFtyp(),
            u32(4),
            ascii('moov'),
            trak(genTkhd(10, 10)),
        );
        expect(readOfficeMediaInfo('a.mp4', short)).toMatchObject({
            width: 1920,
            height: 1080,
        });
        // a 64-bit size past what a number holds
        const huge = concat(
            genFtyp(),
            u32(1),
            ascii('mdat'),
            u32(0xffffffff),
            u32(0),
        );
        expect(readOfficeMediaInfo('a.mp4', huge)).toMatchObject({
            width: 1920,
            height: 1080,
        });
        // a size of 0 runs to the end of what holds it
        const open = concat(
            genFtyp(),
            u32(0),
            ascii('moov'),
            trak(genTkhd(600, 400)),
        );
        expect(readOfficeMediaInfo('a.mp4', open)).toMatchObject({
            width: 600,
            height: 400,
        });
        // a million bytes of empty boxes before the moov: the walk gives up
        const many = concat(
            genFtyp(),
            new Uint8Array(1 << 20).map((_value, index) => {
                return index % 8 === 3 ? 8 : 0;
            }),
            box('moov', trak(genTkhd(600, 400))),
        );
        const started = performance.now();
        expect(readOfficeMediaInfo('a.mp4', many)).toMatchObject({
            width: 1920,
            height: 1080,
        });
        expect(performance.now() - started).toBeLessThan(500);
    });
});

describe('readOfficeMediaDurationMs', () => {
    test('MP4 (both mvhd versions), WAV and AVI say how long; MP3 does not', () => {
        expect(readOfficeMediaDurationMs('a.mp4', MP4)).toBe(27002);
        expect(
            readOfficeMediaDurationMs(
                'a.m4a',
                genIsoFile('M4A ', genMvhd(44100, 44100 * 3, 1)),
            ),
        ).toBe(3000);
        expect(readOfficeMediaDurationMs('a.wav', genWav(2))).toBe(2000);
        expect(readOfficeMediaDurationMs('a.avi', genAvi(640, 480))).toBe(
            10000,
        );
        expect(readOfficeMediaDurationMs('a.mp3', MP3_TAGGED)).toBeNull();
        expect(readOfficeMediaDurationMs('a.wmv', ASF)).toBeNull();
    });

    test('an unknown length, or bytes of another kind: null', () => {
        expect(
            readOfficeMediaDurationMs(
                'a.mp4',
                genIsoFile('isom', genMvhd(1000, 0xffffffff)),
            ),
        ).toBeNull();
        expect(
            readOfficeMediaDurationMs(
                'a.mp4',
                genIsoFile('isom', genMvhd(0, 1000)),
            ),
        ).toBeNull();
        expect(readOfficeMediaDurationMs('a.mp4', genWav(1))).toBeNull();
    });
});

describe('genMediaPosterPng', () => {
    function readChunks(png: Uint8Array) {
        const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
        const chunks: { type: string; data: Uint8Array }[] = [];
        let at = 8;
        while (at < png.length) {
            const length = view.getUint32(at);
            const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
            const data = png.subarray(at + 8, at + 8 + length);
            expect(view.getUint32(at + 8 + length), type).toBe(
                crc32(png.subarray(at + 4, at + 8 + length)),
            );
            chunks.push({ type, data });
            at += 12 + length;
        }
        expect(at).toBe(png.length);
        return chunks;
    }

    function readPixel(png: Uint8Array, x: number, y: number) {
        const chunks = readChunks(png);
        const header = new DataView(
            chunks[0].data.buffer,
            chunks[0].data.byteOffset,
        );
        const width = header.getUint32(0);
        const raw = inflateSync(
            chunks.find((chunk) => {
                return chunk.type === 'IDAT';
            })?.data as Uint8Array,
        );
        const rowLength = 1 + Math.ceil(width / 8);
        return (raw[y * rowLength + 1 + (x >> 3)] >> (7 - (x & 7))) & 1;
    }

    test.each([
        ['video', 256, 144],
        ['audio', 128, 128],
    ] as const)(
        'a valid PNG for a %s: chunks, CRCs, size, zlib',
        (kind, width, height) => {
            const png = genMediaPosterPng(kind);
            expect([...png.subarray(0, 8)]).toEqual([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);
            const chunks = readChunks(png);
            expect(
                chunks.map((chunk) => {
                    return chunk.type;
                }),
            ).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
            const header = new DataView(
                chunks[0].data.buffer,
                chunks[0].data.byteOffset,
                13,
            );
            expect([header.getUint32(0), header.getUint32(4)]).toEqual([
                width,
                height,
            ]);
            // 1 bit, palette
            expect([chunks[0].data[8], chunks[0].data[9]]).toEqual([1, 3]);
            expect(chunks[1].data.length).toBe(6);
            // inflate checks the stored blocks and the adler32 at the end
            const raw = inflateSync(chunks[2].data);
            expect(raw.length).toBe(height * (1 + Math.ceil(width / 8)));
            expect(png.length).toBeLessThan(8 * 1024);
            expect(genMediaPosterPng(kind)).toEqual(png);
        },
    );

    test('a broken adler32 is refused: the check above can fail', () => {
        const idat = readChunks(genMediaPosterPng('video'))[2].data.slice();
        idat[idat.length - 1] ^= 0xff;
        expect(() => {
            return inflateSync(idat);
        }).toThrow();
    });

    test('a light mark on the dark frame', () => {
        const video = genMediaPosterPng('video');
        expect(readPixel(video, 0, 0)).toBe(0);
        // the triangle's centre, and the ring's left edge
        expect(readPixel(video, 128, 72)).toBe(1);
        expect(readPixel(video, 84, 72)).toBe(1);
        expect(readPixel(video, 100, 72)).toBe(0);
        const audio = genMediaPosterPng('audio');
        expect(readPixel(audio, 3, 3)).toBe(0);
        // the magnet and the cone
        expect(readPixel(audio, 34, 64)).toBe(1);
        expect(readPixel(audio, 60, 40)).toBe(1);
    });
});

describe('genMediaPicXml', () => {
    test('a video frame as PowerPoint 2010+ writes one', () => {
        const xml = genMediaPicXml({
            shapeId: '7',
            name: 'Video 6 "A & B"',
            description: 'choir <intro>.mp4',
            kind: 'video',
            linkRelId: 'rId5',
            mediaRelId: 'rId6',
            posterRelId: 'rId7',
            place: { x: 10.4, y: 20, cx: 300, cy: 200.6 },
        });
        expect(xml).toBe(
            '<p:pic><p:nvPicPr><p:cNvPr id="7" ' +
                'name="Video 6 &quot;A &amp; B&quot;" ' +
                'descr="choir &lt;intro&gt;.mp4"><a:hlinkClick r:id="" ' +
                'action="ppaction://media"/></p:cNvPr><p:cNvPicPr>' +
                '<a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr>' +
                '<a:videoFile r:link="rId5"/><p:extLst><p:ext ' +
                'uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media ' +
                `xmlns:p14="${P14}" r:embed="rId6"/></p:ext></p:extLst>` +
                '</p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rId7"/>' +
                '<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>' +
                '<a:xfrm><a:off x="10" y="20"/><a:ext cx="300" cy="201"/>' +
                '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
                '</p:spPr></p:pic>',
        );
    });

    test('a sound names an audio file; a slide declaring a, r, p reads it', () => {
        const xml = genPic(4, 'audio');
        expect(xml).toContain('<a:audioFile r:link="rId2"/>');
        expect(xml).not.toContain('videoFile');
        expect(checkIsWellFormed(genSlide('', xml))).toBe(true);
        // the check can fail: the same frame with p14 left undeclared
        expect(
            checkIsWellFormed(
                genSlide('', xml.replace(/ xmlns:p14="[^"]*"/, '')),
            ),
        ).toBe(false);
    });
});

describe('fitMediaBox', () => {
    const WIDE = { cx: 12192000, cy: 6858000 };
    const info = (
        width: number,
        height: number,
        kind: OfficeMediaKindType = 'video',
    ): OfficeMediaInfoType => {
        return {
            kind,
            extension: 'mp4',
            contentType: 'video/mp4',
            width,
            height,
        };
    };

    test('a video centred in three fifths of the slide, its shape kept', () => {
        expect(fitMediaBox(info(1920, 1080), WIDE)).toEqual({
            x: 2438400,
            y: 1371600,
            cx: 7315200,
            cy: 4114800,
        });
        expect(fitMediaBox(info(640, 480), WIDE)).toEqual({
            x: 3352800,
            y: 1371600,
            cx: 5486400,
            cy: 4114800,
        });
        expect(fitMediaBox(info(1080, 1920), WIDE)).toEqual({
            x: 4938713,
            y: 1371600,
            cx: 2314575,
            cy: 4114800,
        });
        expect(fitMediaBox(info(0, 0), WIDE)).toEqual(
            fitMediaBox(info(1920, 1080), WIDE),
        );
    });

    test('a sound a half-inch icon in the bottom-right corner', () => {
        expect(fitMediaBox(info(128, 128, 'audio'), WIDE)).toEqual({
            x: 11506200,
            y: 6172200,
            cx: 457200,
            cy: 457200,
        });
        // a small slide gets a smaller icon, still inside it
        expect(
            fitMediaBox(info(128, 128, 'audio'), { cx: 1000000, cy: 800000 }),
        ).toEqual({ x: 700000, y: 500000, cx: 200000, cy: 200000 });
    });
});

describe('addMediaTimingXml', () => {
    test('the relationship types PowerPoint writes', () => {
        expect(OFFICE_MEDIA_REL_TYPE).toEqual({
            video: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
            audio: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio',
            media: 'http://schemas.microsoft.com/office/2007/relationships/media',
        });
    });

    test('"Automatically" on a slide with no timing: what PowerPoint wrote', () => {
        const slide = genSlide();
        const out = add(slide, 3, 'video', 'auto', 27002);
        expect(readTiming(out)).toBe(POWERPOINT_AUTO_TIMING);
        expect(out).toBe(
            slide.replace('</p:sld>', `${POWERPOINT_AUTO_TIMING}</p:sld>`),
        );
        expect(checkIsWellFormed(out)).toBe(true);
    });

    test('"When Clicked On": the media node and the click sequence', () => {
        const out = add(genSlide(), 3, 'video', 'click');
        expect(readTiming(out)).toBe(
            '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" ' +
                'restart="never" nodeType="tmRoot"><p:childTnLst>' +
                VIDEO_NODE_3.replace('id="7"', 'id="2"') +
                TOGGLE_SEQ_3.replace(
                    /id="(8|9|10|11|12)"/g,
                    (_whole, id: string) => {
                        return `id="${Number(id) - 5}"`;
                    },
                ) +
                '</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>',
        );
        expect(out).not.toContain('mainSeq');
    });

    test('a sound gets a p:audio node; an unknown length is 1 ms', () => {
        const slide = genSlide('', genPic(4, 'audio'));
        const out = add(slide, '4', 'audio', 'auto');
        expect(out).toContain('<p:audio><p:cMediaNode vol="80000">');
        expect(out).not.toContain('<p:video>');
        expect(out).toContain(
            'cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="4"/>',
        );
    });

    test('the timing goes after a wrapped transition, before the slide extLst', () => {
        const transition =
            `<mc:AlternateContent xmlns:mc="${MC}"><mc:Choice ` +
            `xmlns:p14="${P14}" Requires="p14"><p:transition spd="slow" ` +
            'p14:dur="2000"><p14:prism/></p:transition></mc:Choice>' +
            '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition>' +
            '</mc:Fallback></mc:AlternateContent>';
        const slide = genSlide(transition + SLIDE_EXT);
        const out = add(slide, 3, 'video', 'auto', 27002);
        expect(out).toBe(
            slide.replace(SLIDE_EXT, POWERPOINT_AUTO_TIMING + SLIDE_EXT),
        );
        expect(checkIsWellFormed(out)).toBe(true);
    });

    test('entrance animations kept byte for byte around the added nodes', () => {
        const animated = animate(genSlide(), '2', FADE_CLICK);
        const out = add(animated, 3, 'video', 'click');
        const at = animated.indexOf(
            '</p:childTnLst></p:cTn></p:par></p:tnLst>',
        );
        const added = out.length - animated.length;
        expect(out.slice(0, at)).toBe(animated.slice(0, at));
        expect(out.slice(at + added)).toBe(animated.slice(at));
        expect(out.slice(at, at + added)).toMatch(/^<p:video>.*<\/p:seq>$/);
        // numbered past the highest id already there, none twice
        const before = Math.max(...listIds(readTiming(animated) as string));
        const ids = listIds(readTiming(out) as string);
        expect(new Set(ids).size).toBe(ids.length);
        expect(Math.min(...ids.slice(-6))).toBe(before + 1);
        expect(checkIsWellFormed(out)).toBe(true);
    });

    test('"Automatically" with click animations: a group of its own first', () => {
        const animated = animate(genSlide(), '2', FADE_CLICK);
        const out = add(animated, 3, 'video', 'auto', 5000);
        const open = 'nodeType="mainSeq"><p:childTnLst>';
        const at = animated.indexOf(open) + open.length;
        expect(out.slice(0, at)).toBe(animated.slice(0, at));
        expect(out.slice(at)).toMatch(
            /^<p:par><p:cTn id="\d+" fill="hold"><p:stCondLst><p:cond delay="indefinite"\/><p:cond evt="onBegin" delay="0"><p:tn val="2"\/><\/p:cond>/,
        );
        expect(countOf(out, 'nodeType="mainSeq"')).toBe(1);
        expect(readSlideAnimations(out)).toEqual(readSlideAnimations(animated));
        expect(dropMediaTimingXml(out, 3)).toBe(animated);
    });

    test('"Automatically" when the slide already starts with one: with it', () => {
        const animated = animate(genSlide(), '2', {
            ...FADE_CLICK,
            start: 'after',
        });
        const out = add(animated, 3, 'video', 'auto', 5000);
        expect(countOf(out, 'evt="onBegin"')).toBe(1);
        expect(out).toMatch(
            /presetClass="entr"[^]*nodeType="withEffect"><p:stCondLst><p:cond delay="0"\/><\/p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom\(0\.0\)">/,
        );
        expect(dropMediaTimingXml(out, 3)).toBe(animated);
    });

    test('two clips on one slide, each its own nodes, ids never twice', () => {
        const slide = genSlide('', genPic(3) + genPic(4, 'audio'));
        const out = add(
            add(slide, 3, 'video', 'click'),
            4,
            'audio',
            'auto',
            3000,
        );
        const timing = readTiming(out) as string;
        const ids = listIds(timing);
        expect(new Set(ids).size).toBe(ids.length);
        expect(countOf(timing, '<p:video>')).toBe(1);
        expect(countOf(timing, '<p:audio>')).toBe(1);
        expect(countOf(timing, 'nodeType="interactiveSeq"')).toBe(2);
        // the main sequence made for the sound goes first
        expect(timing).toMatch(
            /nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="\d+" dur="indefinite" nodeType="mainSeq">/,
        );
        expect(checkIsWellFormed(out)).toBe(true);
        const without = dropMediaTimingXml(out, 4) as string;
        expect(without).not.toContain('spid="4"');
        expect(countOf(without, 'spid="3"')).toBe(4);
        // an emptied main sequence keeps its shell, as the animations
        // helper leaves one (an empty time list is not allowed)
        expect(without).toMatch(
            /<p:cTn id="\d+" dur="indefinite" nodeType="mainSeq"><\/p:cTn><p:prevCondLst>/,
        );
        expect(without).not.toContain('<p:childTnLst></p:childTnLst>');
        expect(checkIsWellFormed(without)).toBe(true);
        expect(dropMediaTimingXml(without, 3)).toBe(slide);
    });

    test('a clip added again has its nodes replaced, not doubled', () => {
        const slide = genSlide();
        const twice = add(
            add(slide, 3, 'video', 'click'),
            3,
            'video',
            'auto',
            27002,
        );
        expect(twice).toBe(add(slide, 3, 'video', 'auto', 27002));
    });

    test('a timing in an mc:AlternateContent: both copies get the nodes', () => {
        const timing = readTiming(
            animate(genSlide(), '2', FADE_CLICK),
        ) as string;
        const slide = genSlide(
            `<mc:AlternateContent xmlns:mc="${MC}"><mc:Choice ` +
                `xmlns:p14="${P14}" Requires="p14">${timing}</mc:Choice>` +
                `<mc:Fallback>${timing}</mc:Fallback></mc:AlternateContent>`,
        );
        const out = add(slide, 3, 'video', 'click');
        expect(countOf(out, '<p:video>')).toBe(2);
        expect(countOf(out, '<p:timing>')).toBe(2);
        expect(checkIsWellFormed(out)).toBe(true);
        expect(dropMediaTimingXml(out, 3)).toBe(slide);
    });

    test('a timing with no time list gets one before its build list', () => {
        const slide = genSlide(
            '<p:timing><p:bldLst><p:bldP spid="2" grpId="0"/></p:bldLst></p:timing>',
        );
        const out = add(slide, 3, 'video', 'click');
        expect(readTiming(out)).toMatch(
            /^<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:video>.*<\/p:tnLst><p:bldLst><p:bldP spid="2" grpId="0"\/><\/p:bldLst><\/p:timing>$/,
        );
    });

    test('null: a timing it cannot read, no such frame, no slide', () => {
        expect(
            addMediaTimingXml(
                genSlide(
                    '<p:timing><p:tnLst><p:par><p:seq/></p:par></p:tnLst></p:timing>',
                ),
                3,
                'video',
                'click',
            ),
        ).toBeNull();
        expect(addMediaTimingXml(genSlide(), 9, 'video', 'click')).toBeNull();
        expect(
            addMediaTimingXml(genSlide(), 'three', 'video', 'click'),
        ).toBeNull();
        expect(addMediaTimingXml(genPic(3), 3, 'video', 'click')).toBeNull();
    });
});

describe("the animations helper keeps a clip's timing", () => {
    test('an entrance added and taken off: the media nodes stay', () => {
        const withMedia = add(genSlide(), 3, 'video', 'click');
        const media = normalizeIds(VIDEO_NODE_3 + TOGGLE_SEQ_3);
        const animated = animate(withMedia, '2', FADE_CLICK);
        expect(normalizeIds(animated)).toContain(media);
        expect(readSlideAnimations(animated)).toEqual([
            { shapeId: '2', effect: 'fade', byLine: false },
        ]);
        const ids = listIds(readTiming(animated) as string);
        expect(new Set(ids).size).toBe(ids.length);
        // the entrance taken off: a timing still holding the clip stays
        const taken = animate(animated, '2', null);
        expect(normalizeIds(taken)).toContain(media);
        expect(readSlideAnimations(taken)).toEqual([]);
        expect(dropMediaTimingXml(taken, 3)).toBe(genSlide());
    });

    test('a play step in the main sequence survives an entrance after it', () => {
        const withMedia = add(genSlide(), 3, 'video', 'auto', 5000);
        const animated = animate(withMedia, '2', {
            ...FADE_CLICK,
            start: 'after',
        });
        expect(animated).toContain('cmd="playFrom(0.0)"');
        expect(animated).toContain('<p:video>');
        // after the clip's 5 s
        expect(animated).toContain('<p:cond delay="5000"/>');
        const replaced = animate(animated, '2', FADE_CLICK);
        expect(replaced).toContain('cmd="playFrom(0.0)"');
        expect(replaced).toContain('nodeType="interactiveSeq"');
    });
});

describe('dropMediaTimingXml', () => {
    test('nothing of the clip: the slide as it was', () => {
        const animated = animate(genSlide(), '2', FADE_CLICK);
        expect(dropMediaTimingXml(animated, 3)).toBe(animated);
        expect(dropMediaTimingXml(genSlide(), '3')).toBe(genSlide());
        expect(dropMediaTimingXml(genPic(3), 3)).toBeNull();
    });

    test('its own timing gone, the timing with it when emptied', () => {
        const slide = genSlide('', genPic(3) + genPic(4, 'audio'));
        for (const play of ['click', 'auto'] as const) {
            expect(dropMediaTimingXml(add(slide, 4, 'audio', play), '4')).toBe(
                slide,
            );
        }
    });

    test('a step after the clip moves up by its length', () => {
        const withMedia = add(genSlide(), 3, 'video', 'auto', 5000);
        const animated = animate(withMedia, '2', {
            ...FADE_CLICK,
            start: 'after',
        });
        const out = dropMediaTimingXml(animated, 3) as string;
        expect(out).not.toContain('delay="5000"');
        expect(out).not.toContain('mediacall');
        expect(out).not.toContain('spid="3"');
        expect(readSlideAnimations(out)).toEqual([
            { shapeId: '2', effect: 'fade', byLine: false },
        ]);
        expect(countOf(out, 'evt="onBegin"')).toBe(1);
        expect(checkIsWellFormed(out)).toBe(true);
    });

    test('a click group losing its first effect starts with the next one', () => {
        const play =
            '<p:par><p:cTn id="5" presetID="1" presetClass="mediacall" ' +
            'presetSubtype="0" fill="hold" nodeType="clickEffect">' +
            '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
            '<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" ' +
            'dur="5000" fill="hold"/><p:tgtEl><p:spTgt spid="3"/></p:tgtEl>' +
            '</p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>';
        const fade = (nodeType: string) => {
            return (
                '<p:par><p:cTn id="7" presetID="10" presetClass="entr" ' +
                `presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}">` +
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
                '<p:set><p:cBhvr><p:cTn id="8" dur="1" fill="hold"><p:stCondLst>' +
                '<p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt ' +
                'spid="2"/></p:tgtEl><p:attrNameLst><p:attrName>' +
                'style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to>' +
                '<p:strVal val="visible"/></p:to></p:set></p:childTnLst></p:cTn>' +
                '</p:par>'
            );
        };
        const timing = (effects: string, media: string) => {
            return (
                '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" ' +
                'restart="never" nodeType="tmRoot"><p:childTnLst><p:seq ' +
                'concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" ' +
                'nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" ' +
                'fill="hold"><p:stCondLst><p:cond delay="indefinite"/>' +
                '</p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold">' +
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
                `${effects}</p:childTnLst></p:cTn></p:par></p:childTnLst>` +
                `</p:cTn></p:par></p:childTnLst></p:cTn>${SLIDE_COND}</p:seq>` +
                `${media}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
            );
        };
        const media = VIDEO_NODE_3.replace('id="7"', 'id="9"');
        const slide = genSlide(timing(play + fade('withEffect'), media));
        expect(dropMediaTimingXml(slide, 3)).toBe(
            genSlide(timing(fade('clickEffect'), '')),
        );
    });

    test("isWholeShape: the frame's entrance and build entries go too", () => {
        const both = animate(
            animate(genSlide(), '3', FADE_CLICK),
            '2',
            FADE_CLICK,
        );
        const out = add(both, 3, 'video', 'click');
        // the clip's own nodes only, by default
        expect(dropMediaTimingXml(out, 3)).toBe(both);
        const whole = dropMediaTimingXml(out, 3, true) as string;
        expect(whole).not.toContain('spid="3"');
        expect(readSlideAnimations(whole)).toEqual([
            { shapeId: '2', effect: 'fade', byLine: false },
        ]);
        expect(checkIsWellFormed(whole)).toBe(true);
        // a box's build entry goes with its last effect
        expect(both).toContain('<p:bldP spid="2"');
        const titleless = dropMediaTimingXml(both, 2, true) as string;
        expect(titleless).not.toContain('spid="2"');
        expect(titleless).not.toContain('<p:bldLst>');
        expect(readSlideAnimations(titleless)).toEqual([
            { shapeId: '3', effect: 'fade', byLine: false },
        ]);
    });

    test('a wrapped timing left empty takes its wrapper with it', () => {
        const timing = readTiming(
            add(genSlide(), 3, 'video', 'click'),
        ) as string;
        const slide = genSlide(
            `<mc:AlternateContent xmlns:mc="${MC}"><mc:Choice ` +
                `xmlns:p14="${P14}" Requires="p14">${timing}</mc:Choice>` +
                `<mc:Fallback>${timing}</mc:Fallback></mc:AlternateContent>`,
        );
        expect(dropMediaTimingXml(slide, 3)).toBe(genSlide());
    });
});
