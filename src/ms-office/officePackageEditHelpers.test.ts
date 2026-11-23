import { describe, expect, test } from 'vitest';

import { concatBytes, toZipBytes } from './officeZipHelpers';
import {
    readOfficeZipEntries,
    readOfficeZipEntryBytes,
} from './officeZipReadHelpers';
import {
    type OfficeAskedChangeType,
    type OfficeChangeType,
    type OfficeDocumentType,
    type OfficeReplaceType,
    applyOfficeChanges,
    readOfficeDocument,
    resolvePartPath,
    toOfficeReadResult,
    toOrderedSectionsXml,
    toRelsPath,
} from './officePackageEditHelpers';
import {
    openOfficePackage,
    writeOfficePackage,
} from './officePackageIoHelpers';

const REL =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6]);

function genRels(rels: [string, string, string][]) {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        rels
            .map(([id, type, target]) => {
                return `<Relationship Id="${id}" Type="${REL}${type}" Target="${target}"/>`;
            })
            .join('') +
        '</Relationships>'
    );
}

function genSlide(title: string, body: string[], extra = '') {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<p:sld xmlns:a="a" xmlns:p="p" xmlns:r="r"><p:cSld><p:spTree>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/>' +
        '<p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>' +
        '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" b="1"/>' +
        `<a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>` +
        '<p:sp><p:nvSpPr><p:cNvPr id="3" name="TextBox 2"/><p:cNvSpPr/>' +
        '<p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>' +
        body
            .map((line) => {
                return `<a:p><a:r><a:rPr lang="en-US"/><a:t>${line}</a:t></a:r></a:p>`;
            })
            .join('') +
        `</p:txBody></p:sp>${extra}</p:spTree></p:cSld></p:sld>`
    );
}

// a picture the size of the slide, as the user's hymn deck has on each
const CURTAIN =
    '<p:pic><p:nvPicPr><p:cNvPr id="9" name="Curtain" descr="curtain.jpg"/>' +
    '<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1">' +
    '<a:extLst><a:ext uri="{x}"/></a:extLst></a:blip></p:blipFill>' +
    '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/>' +
    '</a:xfrm></p:spPr></p:pic>';

function genNotes(note: string) {
    return (
        '<p:notes xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>' +
        '<p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr></p:sp>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr/>' +
        '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
        '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/>' +
        `<a:t>${note}</a:t></a:r></a:p></p:txBody></p:sp>` +
        '<p:sp><p:nvSpPr><p:cNvPr id="4" name="Slide Number 3"/><p:cNvSpPr/>' +
        '<p:nvPr><p:ph type="sldNum" idx="5"/></p:nvPr></p:nvSpPr><p:spPr/>' +
        '<p:txBody><a:bodyPr/><a:p><a:fld id="{1}" type="slidenum">' +
        '<a:t>1</a:t></a:fld></a:p></p:txBody></p:sp>' +
        '</p:spTree></p:cSld></p:notes>'
    );
}

const CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="p"/>' +
    '<Override PartName="/ppt/slides/slide1.xml" ContentType="s"/>' +
    '<Override PartName="/ppt/slides/slide2.xml" ContentType="s"/>' +
    '<Override PartName="/ppt/slides/slide3.xml" ContentType="s"/>' +
    '<Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="n"/>' +
    '</Types>';

async function genDeckBytes(
    slide1Extra = '',
    slide2Extra = '',
    // parts added, or put in place of the deck's own of the same name
    extraEntries: { fileName: string; data: string }[] = [],
) {
    const entries = [
        { fileName: '[Content_Types].xml', data: CONTENT_TYPES },
        {
            fileName: '_rels/.rels',
            data: genRels([['rId1', 'officeDocument', 'ppt/presentation.xml']]),
        },
        {
            fileName: 'ppt/presentation.xml',
            data:
                '<p:presentation xmlns:p="p" xmlns:r="r" xmlns:p14="p14">' +
                '<p:sldIdLst><p:sldId id="256" r:id="rId2"/>' +
                '<p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/>' +
                '</p:sldIdLst><p:extLst><p:ext><p14:sectionLst><p14:section>' +
                '<p14:sldIdLst><p14:sldId id="256"/><p14:sldId id="257"/>' +
                '<p14:sldId id="258"/></p14:sldIdLst></p14:section>' +
                '</p14:sectionLst></p:ext></p:extLst></p:presentation>',
        },
        {
            fileName: 'ppt/_rels/presentation.xml.rels',
            data: genRels([
                ['rId1', 'notesMaster', 'notesMasters/notesMaster1.xml'],
                ['rId2', 'slide', 'slides/slide1.xml'],
                ['rId3', 'slide', 'slides/slide2.xml'],
                ['rId4', 'slide', 'slides/slide3.xml'],
            ]),
        },
        {
            fileName: 'ppt/notesMasters/notesMaster1.xml',
            data: '<p:notesMaster xmlns:p="p"/>',
        },
        {
            fileName: 'ppt/slides/slide1.xml',
            data: genSlide(
                'Welcome',
                ['Good morning', 'Please stand'],
                slide1Extra,
            ),
        },
        {
            fileName: 'ppt/slides/_rels/slide1.xml.rels',
            data: genRels([
                ['rId1', 'image', '../media/image1.png'],
                ['rId2', 'notesSlide', '../notesSlides/notesSlide1.xml'],
            ]),
        },
        {
            fileName: 'ppt/notesSlides/notesSlide1.xml',
            data: genNotes('Smile at everyone'),
        },
        {
            fileName: 'ppt/notesSlides/_rels/notesSlide1.xml.rels',
            data: genRels([
                ['rId1', 'notesMaster', '../notesMasters/notesMaster1.xml'],
                ['rId2', 'slide', '../slides/slide1.xml'],
            ]),
        },
        {
            fileName: 'ppt/slides/slide2.xml',
            data: genSlide(
                'Amazing Grace',
                ['how sweet the sound', 'Lord'],
                slide2Extra,
            ),
        },
        {
            fileName: 'ppt/slides/_rels/slide2.xml.rels',
            data: genRels([['rId1', 'image', '../media/image1.png']]),
        },
        {
            fileName: 'ppt/slides/slide3.xml',
            data: genSlide('Offering', ['Give to the Lord']),
        },
        { fileName: 'ppt/media/image1.png', data: PICTURE },
    ];
    const extraNames = new Set(
        extraEntries.map((entry) => {
            return entry.fileName;
        }),
    );
    return await toZipBytes([
        ...entries.filter((entry) => {
            return !extraNames.has(entry.fileName);
        }),
        ...extraEntries,
    ]);
}

async function runOnBytes(
    bytes: Uint8Array,
    kind: 'pptx' | 'docx',
    changes: OfficeAskedChangeType[],
    replaces: OfficeReplaceType[] = [],
    pictures: ReadonlyMap<string, Uint8Array> = new Map(),
) {
    const opened = openOfficePackage(bytes);
    if ('reason' in opened) {
        throw new Error(opened.reason);
    }
    const document = await readOfficeDocument(opened.pkg, kind);
    if ('reason' in document) {
        throw new Error(document.reason);
    }
    const result = await applyOfficeChanges(
        opened.pkg,
        document,
        changes,
        replaces,
        pictures,
    );
    if ('reason' in result) {
        return { reason: result.reason };
    }
    const chunks: Uint8Array[] = [];
    await writeOfficePackage(opened, result.parts, (chunk) => {
        chunks.push(chunk);
    });
    const written = concatBytes(chunks);
    const reopened = openOfficePackage(written);
    if ('reason' in reopened) {
        throw new Error(reopened.reason);
    }
    const after = await readOfficeDocument(reopened.pkg, kind);
    if ('reason' in after) {
        throw new Error(after.reason);
    }
    return { written, after, changed: result.changed, pkg: reopened.pkg };
}

function toSlideTexts(document: OfficeDocumentType) {
    if (document.kind !== 'pptx') {
        return [];
    }
    return document.slides.map((slide) => {
        return slide.lines
            .map((line) => {
                return line.text;
            })
            .join(' / ');
    });
}

describe('paths', () => {
    test('a part names its relationships and its targets', () => {
        expect(toRelsPath('ppt/slides/slide1.xml')).toBe(
            'ppt/slides/_rels/slide1.xml.rels',
        );
        expect(resolvePartPath('ppt/slides/slide1.xml', '../media/a.png')).toBe(
            'ppt/media/a.png',
        );
        expect(resolvePartPath('', '/ppt/presentation.xml')).toBe(
            'ppt/presentation.xml',
        );
    });
});

describe('a deck read', () => {
    test('slides in their order, lines by id, notes, the boxes', async () => {
        const opened = openOfficePackage(await genDeckBytes());
        if ('reason' in opened) {
            throw new Error(opened.reason);
        }
        const document = await readOfficeDocument(opened.pkg, 'pptx');
        if ('reason' in document) {
            throw new Error(document.reason);
        }
        const read = toOfficeReadResult(document);
        if (read.kind !== 'PowerPoint') {
            throw new Error('not a deck');
        }
        expect(read.slideCount).toBe(3);
        expect(read.slides[0]).toEqual({
            slide: 1,
            lines: [
                { id: '1.1', box: 'title', text: 'Welcome' },
                { id: '1.2', box: 'TextBox 2', text: 'Good morning' },
                { id: '1.3', text: 'Please stand' },
            ],
            note: 'Smile at everyone',
            // each box with the lines in it (no place: none is said)
            boxes: [
                { name: 'Title 1', lines: '1.1' },
                { name: 'TextBox 2', lines: '1.2-1.3' },
            ],
        });
        // a short page says where to read on
        const short = toOfficeReadResult(document, 1, 50);
        expect(short.kind === 'PowerPoint' && short.slides).toHaveLength(1);
        expect(short.nextStart).toBe(2);
    });

    test('refuses what is not a deck', async () => {
        expect(openOfficePackage(new Uint8Array([1, 2, 3]))).toEqual({
            reason: 'The file is not a PowerPoint or Word package.',
        });
        const opened = openOfficePackage(await genDeckBytes());
        if ('reason' in opened) {
            throw new Error(opened.reason);
        }
        expect(await readOfficeDocument(opened.pkg, 'docx')).toEqual({
            reason: 'The file is not a Word document.',
        });
    });
});

describe('a deck changed', () => {
    test('a line, a new line and a removal; untouched parts copied', async () => {
        const bytes = await genDeckBytes();
        const out = await runOnBytes(bytes, 'pptx', [
            { id: '2.2', text: 'how sweet the sound that saved' },
            { after: '2.2', text: 'a wretch like me' },
            { id: '2.3', remove: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(toSlideTexts(out.after)).toEqual([
            'Welcome / Good morning / Please stand',
            'Amazing Grace / how sweet the sound that saved / a wretch like me',
            'Offering / Give to the Lord',
        ]);
        expect(out.changed).toHaveLength(3);
        // the picture is the same bytes it was
        const entries = readOfficeZipEntries(out.written);
        if ('reason' in entries) {
            throw new Error(entries.reason);
        }
        const picture = entries.find((entry) => {
            return entry.fileName === 'ppt/media/image1.png';
        });
        expect(picture).toBeDefined();
        expect(await readOfficeZipEntryBytes(out.written, picture!)).toEqual(
            PICTURE,
        );
    });

    test('words replaced everywhere, the notes included, counted', async () => {
        const out = await runOnBytes(
            await genDeckBytes(),
            'pptx',
            [],
            [{ from: 'Lord', to: 'God' }],
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(toSlideTexts(out.after)[2]).toBe('Offering / Give to the God');
        expect(out.changed).toEqual(['Replaced “Lord” with “God” (2 places).']);
    });

    test('a replace not found says so, and with other capitals', async () => {
        const bytes = await genDeckBytes();
        expect(
            await runOnBytes(bytes, 'pptx', [], [{ from: 'zebra', to: 'x' }]),
        ).toEqual({
            reason:
                '“zebra” is not in the document as written. Read it ' +
                'again and write `from` exactly as a line has it.',
        });
        const other = await runOnBytes(
            bytes,
            'pptx',
            [],
            [{ from: 'lord', to: 'x' }],
        );
        expect('reason' in other && other.reason).toContain(
            'other capital letters',
        );
    });

    test('speaker notes written, and made for a slide that had none', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 1, note: 'Line one\nLine two' },
            { slide: 3, note: 'Pass the plates' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        if (out.after.kind !== 'pptx') {
            throw new Error('not a deck');
        }
        expect(
            out.after.slides.map((slide) => {
                return slide.note;
            }),
        ).toEqual(['Line one\nLine two', null, 'Pass the plates']);
        const types = await out.pkg.readText('[Content_Types].xml');
        expect(types).toContain('/ppt/notesSlides/notesSlide2.xml');
        const rels = await out.pkg.readText('ppt/slides/_rels/slide3.xml.rels');
        expect(rels).toContain('../notesSlides/notesSlide2.xml');
        // the slide number box of the notes page is not the notes
        const notesXml = await out.pkg.readText(
            'ppt/notesSlides/notesSlide1.xml',
        );
        expect(notesXml).toContain('type="slidenum"');
    });

    test('a deck no one wrote a note in is given a notes page layout', async () => {
        const opened = openOfficePackage(await genDeckBytes());
        if ('reason' in opened) {
            throw new Error(opened.reason);
        }
        // the same deck without its notes: no master, no notes pages
        const bare = new Map<string, string | null>([
            ['ppt/notesMasters/notesMaster1.xml', null],
            ['ppt/notesSlides/notesSlide1.xml', null],
            ['ppt/notesSlides/_rels/notesSlide1.xml.rels', null],
            [
                'ppt/_rels/presentation.xml.rels',
                genRels([
                    ['rId2', 'slide', 'slides/slide1.xml'],
                    ['rId3', 'slide', 'slides/slide2.xml'],
                    ['rId4', 'slide', 'slides/slide3.xml'],
                ]),
            ],
            [
                'ppt/slides/_rels/slide1.xml.rels',
                genRels([['rId1', 'image', '../media/image1.png']]),
            ],
            [
                'ppt/presentation.xml',
                '<p:presentation xmlns:p="p" xmlns:r="r">' +
                    '<p:sldMasterIdLst><p:sldMasterId id="1" r:id="rId9"/></p:sldMasterIdLst>' +
                    '<p:sldIdLst><p:sldId id="256" r:id="rId2"/>' +
                    '<p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/>' +
                    '</p:sldIdLst></p:presentation>',
            ],
        ]);
        const chunks: Uint8Array[] = [];
        await writeOfficePackage(opened, bare, (chunk) => {
            chunks.push(chunk);
        });
        const out = await runOnBytes(concatBytes(chunks), 'pptx', [
            { slide: 2, note: 'Sing it twice' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(
            out.after.kind === 'pptx' &&
                out.after.slides.map((slide) => {
                    return slide.note;
                }),
        ).toEqual([null, 'Sing it twice', null]);
        const presentation =
            (await out.pkg.readText('ppt/presentation.xml')) ?? '';
        expect(presentation).toContain(
            '</p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId5"/>',
        );
        expect(
            await out.pkg.readText('ppt/_rels/presentation.xml.rels'),
        ).toContain('Target="notesMasters/notesMaster1.xml"');
        expect(
            await out.pkg.readText(
                'ppt/notesMasters/_rels/notesMaster1.xml.rels',
            ),
        ).toContain('Target="../theme/theme1.xml"');
        const types = (await out.pkg.readText('[Content_Types].xml')) ?? '';
        expect(types).toContain('/ppt/notesMasters/notesMaster1.xml');
        expect(types).toContain('/ppt/theme/theme1.xml');
    });

    test('a slide moved, copied and taken out', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 3, to: 1 },
            { slide: 1, duplicate: true },
            { slide: 2, removeSlide: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(toSlideTexts(out.after)).toEqual([
            'Offering / Give to the Lord',
            'Welcome / Good morning / Please stand',
            'Welcome / Good morning / Please stand',
        ]);
        if (out.after.kind !== 'pptx') {
            throw new Error('not a deck');
        }
        // the copy has notes of its own, which point at the copy
        const copy = out.after.slides[2];
        expect(copy.note).toBe('Smile at everyone');
        expect(copy.notesPath).toBe('ppt/notesSlides/notesSlide2.xml');
        const copyNotesRels = await out.pkg.readText(
            'ppt/notesSlides/_rels/notesSlide2.xml.rels',
        );
        expect(copyNotesRels).toContain(
            `Target="../slides/${copy.partPath.split('/').pop()}"`,
        );
        expect(out.pkg.names).not.toContain('ppt/slides/slide2.xml');
        const presentation =
            (await out.pkg.readText('ppt/presentation.xml')) ?? '';
        expect(presentation).not.toContain('<p14:sldId id="257"/>');
        expect(presentation).toContain('<p14:sldId id="259"/>');
        const types = (await out.pkg.readText('[Content_Types].xml')) ?? '';
        expect(types).not.toContain('/ppt/slides/slide2.xml"');
        expect(types).toContain('/ppt/slides/slide4.xml"');
    });

    test('a copy put at a place in the same change, past the end refused', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 1, duplicate: true, to: 4 },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const texts = toSlideTexts(out.after);
        expect(texts).toHaveLength(4);
        expect(texts[3]).toBe(texts[0]);
        expect(texts[1]).not.toBe(texts[0]);
        expect(out.changed).toEqual([
            'Copied slide 1; the copy is at place 4.',
        ]);
        const refused = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 1, duplicate: true, to: 5 },
        ]);
        expect(refused).toEqual({
            reason: '`to` is where the copy of slide 1 goes: a number from 1 to 4.',
        });
    });

    test('a line break a model wrote out as \\n is written as one', async () => {
        const out = await runOnBytes(
            await genDeckBytes(),
            'pptx',
            [{ id: '1.1', text: 'Welcome\\nGood day' }],
            [{ from: 'Good morning', to: 'Good morning\\nHello friends' }],
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const text = toSlideTexts(out.after)[0];
        expect(text).toContain('Welcome\nGood day');
        expect(text).toContain('Good morning\nHello friends');
        expect(text).not.toContain('\\n');
        const slideXml =
            (await out.pkg.readText('ppt/slides/slide1.xml')) ?? '';
        expect(slideXml).toMatch(/<a:t>Welcome<\/a:t><\/a:r><a:br\b/);
    });

    test('the sections follow the slides after a move', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 3, to: 1 },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const presentation =
            (await out.pkg.readText('ppt/presentation.xml')) ?? '';
        expect(presentation).toContain(
            '<p14:sldIdLst><p14:sldId id="258"/><p14:sldId id="256"/>' +
                '<p14:sldId id="257"/></p14:sldIdLst>',
        );
    });

    test('a slide another slide links to is not taken out', async () => {
        const bytes = await genDeckBytes();
        const opened = openOfficePackage(bytes);
        if ('reason' in opened) {
            throw new Error(opened.reason);
        }
        const linked = new Map<string, string | null>([
            [
                'ppt/slides/_rels/slide2.xml.rels',
                genRels([
                    ['rId1', 'image', '../media/image1.png'],
                    ['rId2', 'slide', 'slide3.xml'],
                ]),
            ],
        ]);
        const chunks: Uint8Array[] = [];
        await writeOfficePackage(opened, linked, (chunk) => {
            chunks.push(chunk);
        });
        const out = await runOnBytes(concatBytes(chunks), 'pptx', [
            { slide: 3, removeSlide: true },
        ]);
        expect('reason' in out && out.reason).toContain(
            'another slide links to it',
        );
    });

    test('all or nothing: one ask that cannot be done refuses the call', async () => {
        const bytes = await genDeckBytes();
        expect(
            await runOnBytes(bytes, 'pptx', [
                { id: '1.1', text: 'Hi' },
                { id: '9.9', text: 'nowhere' },
            ]),
        ).toEqual({
            reason:
                'There is no line "9.9". Use a line\'s id as read ("2.3" is ' +
                'slide 2, line 3).',
        });
        expect(
            await runOnBytes(bytes, 'pptx', [{ slide: 7, note: 'x' }]),
        ).toEqual({ reason: 'There is no slide 7: the deck has 3.' });
        expect(await runOnBytes(bytes, 'pptx', [{ slide: 1, to: 9 }])).toEqual({
            reason: '`to` is where slide 1 goes: a number from 1 to 3.',
        });
        expect(await runOnBytes(bytes, 'pptx', [{ slide: 1 }])).toEqual({
            reason:
                'A change names a line (`id`, or `after` / `before` for a new ' +
                'one) or a `slide` with `note`, `to`, `duplicate`, ' +
                '`removeSlide`, `background`, `hidden`, `transition`, ' +
                '`advance`, `textBox`, `shape`, `picture`, `media`, ' +
                '`animation`, `table` or `chart`, or `removeBox`; a `box` ' +
                "with `at`; the deck's `slideSize`, `theme`, `slideNumbers` " +
                'or `footer`; `newSlide`; or it gives a look (`color`, ' +
                '`size`, …) for every line.',
        });
        expect(
            await runOnBytes(bytes, 'pptx', [
                { id: '1.2', text: 'a' },
                { id: '1.2', remove: true },
            ]),
        ).toEqual({
            reason: 'Line 1.2 is changed twice in one call; send one change for it.',
        });
    });

    test('every line of a box taken out leaves the box one empty line', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { id: '3.2', remove: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(toSlideTexts(out.after)[2]).toBe('Offering / ');
    });

    test('a deck keeps one slide', async () => {
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [
                { slide: 1, removeSlide: true },
                { slide: 2, removeSlide: true },
                { slide: 3, removeSlide: true },
            ]),
        ).toEqual({ reason: 'A deck keeps at least one slide.' });
    });
});

async function readSlideXml(out: { pkg: { readText: any } }, n: number) {
    return ((await out.pkg.readText(`ppt/slides/slide${n}.xml`)) ??
        '') as string;
}

describe('a deck given a look', () => {
    test('"change the colour to green": every line of every slide', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { color: 'green' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual(['Every line: colour green (#008000).']);
        for (const n of [1, 2, 3]) {
            const xml = await readSlideXml(out, n);
            const runs = xml.match(/<a:r>[\s\S]*?<\/a:r>/g) ?? [];
            expect(runs.length).toBeGreaterThan(0);
            for (const run of runs) {
                expect(run).toContain(
                    '<a:solidFill><a:srgbClr val="008000"/></a:solidFill>',
                );
            }
        }
        // the title's bold and the words kept
        expect(await readSlideXml(out, 1)).toContain(
            '<a:rPr lang="en-US" b="1"><a:solidFill>',
        );
        expect(toSlideTexts(out.after)[0]).toBe(
            'Welcome / Good morning / Please stand',
        );
        // the notes are not slide words
        expect(
            await out.pkg.readText('ppt/notesSlides/notesSlide1.xml'),
        ).not.toContain('008000');
    });

    test("a slide's lines, one line over them, and a new line beside", async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 2, color: '#FFFFFF', size: 40 },
            { id: '2.1', color: 'yellow', bold: false, align: 'center' },
            { after: '2.2', text: 'that saved a wretch', italic: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const xml = await readSlideXml(out, 2);
        // the title: its own colour over the slide's, the slide's size
        expect(xml).toContain(
            '<a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" b="0" sz="4000">' +
                '<a:solidFill><a:srgbClr val="FFFF00"/></a:solidFill></a:rPr>' +
                '<a:t>Amazing Grace</a:t>',
        );
        // the new line: the slide's look and its own
        expect(xml).toMatch(
            /<a:rPr lang="en-US" sz="4000" i="1"><a:solidFill><a:srgbClr val="FFFFFF"\/><\/a:solidFill><\/a:rPr><a:t>that saved a wretch<\/a:t>/,
        );
        expect(await readSlideXml(out, 1)).not.toContain('FFFFFF');
        expect(toSlideTexts(out.after)[1]).toBe(
            'Amazing Grace / how sweet the sound / that saved a wretch / Lord',
        );
    });

    test('a background, a slide hidden, words changed in the same call', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 1, background: 'navy' },
            { slide: 3, hidden: true },
            { id: '1.1', text: 'Welcome home' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(await readSlideXml(out, 1)).toContain(
            '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="000080"/>',
        );
        expect(await readSlideXml(out, 3)).toContain('show="0"');
        if (out.after.kind !== 'pptx') {
            throw new Error('not a deck');
        }
        expect(out.after.slides[2].isHidden).toBe(true);
        expect(out.after.slides[0].lines[0].text).toBe('Welcome home');
        expect(out.changed).toEqual([
            'Line 1.1 now reads “Welcome home”.',
            "Slide 1's background is now navy (#000080).",
            'Slide 3 is hidden in the show now.',
        ]);
        // every slide's background, and one taken off again
        const all = await runOnBytes(out.written, 'pptx', [
            { background: 'black' },
            { slide: 3, hidden: false },
        ]);
        if ('reason' in all) {
            throw new Error(all.reason);
        }
        for (const n of [1, 2, 3]) {
            expect(await readSlideXml(all, n)).toContain(
                '<a:srgbClr val="000000"/></a:solidFill><a:effectLst/>',
            );
        }
        expect(await readSlideXml(all, 3)).not.toContain('show=');
        const none = await runOnBytes(all.written, 'pptx', [
            { slide: 2, background: 'none' },
        ]);
        if ('reason' in none) {
            throw new Error(none.reason);
        }
        expect(await readSlideXml(none, 2)).not.toContain('<p:bg>');
    });

    test('a gradient background (2026-11-21)', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 2, background: 'black to navy, left to right' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(await readSlideXml(out, 2)).toContain(
            '<p:bg><p:bgPr><a:gradFill rotWithShape="1"><a:gsLst>',
        );
        expect(out.changed).toEqual([
            "Slide 2's background is now a blend of black (#000000) to " +
                'navy (#000080), left to right.',
        ]);
    });

    test('a slide named by its words (EC-774)', async () => {
        const bytes = await genDeckBytes();
        const out = await runOnBytes(bytes, 'pptx', [
            { slide: 'amazing grace', background: 'navy' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(await readSlideXml(out, 2)).toContain('<p:bg>');
        expect(await readSlideXml(out, 1)).not.toContain('<p:bg>');
        const none = await runOnBytes(bytes, 'pptx', [
            { slide: 'prayers', background: 'navy' },
        ]);
        expect(none).toEqual({
            reason:
                'No slide says "prayers". The slides: slide 1 ("Welcome"), ' +
                'slide 2 ("Amazing Grace"), slide 3 ("Offering"). Ask the ' +
                'person which slide they mean, the slides as OPTIONS; never ' +
                'choose one for them.',
        });
        const several = await runOnBytes(bytes, 'pptx', [
            { slide: 'lord', hidden: true },
        ]);
        expect(several).toEqual({
            reason: expect.stringMatching(
                /^2 slides say "lord": slide 2 \("Amazing Grace"\), slide 3 \("Offering"\)\. Ask/,
            ),
        });
        expect(
            await runOnBytes(bytes, 'pptx', [{ slide: '3', hidden: true }]),
        ).not.toHaveProperty('reason');
    });

    test("the deck's theme: its colours and fonts (2026-11-21)", async () => {
        const theme =
            '<a:theme xmlns:a="a" name="Office Theme"><a:themeElements>' +
            '<a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" ' +
            'lastClr="000000"/></a:dk1><a:accent1><a:srgbClr val="4F81BD"/>' +
            '</a:accent1></a:clrScheme><a:fontScheme name="Office">' +
            '<a:majorFont><a:latin typeface="Calibri Light" ' +
            'panose="020F0302020204030204"/><a:ea typeface=""/></a:majorFont>' +
            '<a:minorFont><a:latin typeface="Calibri"/></a:minorFont>' +
            '</a:fontScheme></a:themeElements></a:theme>';
        const bytes = await genDeckBytes('', '', [
            {
                fileName: 'ppt/slideMasters/slideMaster1.xml',
                data: '<p:sldMaster/>',
            },
            {
                fileName: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
                data: genRels([['rId1', 'theme', '../theme/theme1.xml']]),
            },
            { fileName: 'ppt/theme/theme1.xml', data: theme },
        ]);
        const out = await runOnBytes(bytes, 'pptx', [
            {
                theme: {
                    colors: { accent1: 'navy', dark1: '#222222' },
                    headingFont: 'Georgia',
                },
            },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const xml = (await out.pkg.readText('ppt/theme/theme1.xml')) as string;
        expect(xml).toContain(
            '<a:accent1><a:srgbClr val="000080"/></a:accent1>',
        );
        expect(xml).toContain('<a:dk1><a:srgbClr val="222222"/></a:dk1>');
        expect(xml).toContain(
            '<a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/>',
        );
        expect(xml).toContain('<a:minorFont><a:latin typeface="Calibri"/>');
        expect(out.changed).toEqual([
            "The deck's theme now has headings in Georgia, accent 1 navy " +
                '(#000080), text dark 1 #222222: every slide, shape and ' +
                'table that takes the theme follows it; words given a ' +
                'colour or a font of their own keep it.',
        ]);
        expect(
            await runOnBytes(bytes, 'pptx', [
                { slide: 1, theme: { bodyFont: 'Arial' } },
            ]),
        ).toEqual({
            reason: "`theme` is the whole deck's: give it with no `slide`.",
        });
        expect(
            await runOnBytes(bytes, 'pptx', [{ theme: { accent9: 'red' } }]),
        ).toEqual({
            reason: expect.stringContaining('`theme` has no "accent9"'),
        });
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [
                { theme: { bodyFont: 'Arial' } },
            ]),
        ).toEqual({ reason: 'This deck has no theme to change.' });
    });

    test("a SmartArt's words: read, and changed by replace", async () => {
        const genPoint = (id: string, words: string) => {
            return (
                `<dgm:pt modelId="${id}"><dgm:prSet/><dgm:spPr/><dgm:t>` +
                '<a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>' +
                `<a:t>${words}</a:t></a:r></a:p></dgm:t></dgm:pt>`
            );
        };
        const data =
            '<dgm:dataModel xmlns:dgm="d" xmlns:a="a"><dgm:ptLst>' +
            genPoint('1', 'Plan') +
            genPoint('2', 'Pray') +
            genPoint('3', 'Go') +
            '</dgm:ptLst><dgm:extLst><a:ext uri="x"><dsp:dataModelExt ' +
            'xmlns:dsp="s" relId="rId6" minVer="x"/></a:ext></dgm:extLst>' +
            '</dgm:dataModel>';
        const drawing =
            '<dsp:drawing xmlns:dsp="s" xmlns:a="a"><dsp:spTree>' +
            ['Plan', 'Pray', 'Go']
                .map((words, index) => {
                    return (
                        `<dsp:sp modelId="${index}"><dsp:txBody><a:bodyPr/>` +
                        `<a:p><a:r><a:t>${words}</a:t></a:r></a:p>` +
                        '</dsp:txBody></dsp:sp>'
                    );
                })
                .join('') +
            '</dsp:spTree></dsp:drawing>';
        const frame =
            '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" ' +
            'name="Diagram 6"/><p:cNvGraphicFramePr/><p:nvPr/>' +
            '</p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext ' +
            'cx="6096000" cy="3429000"/></p:xfrm><a:graphic><a:graphicData ' +
            'uri="d"><dgm:relIds xmlns:dgm="d" r:dm="rId2" r:lo="rId3" ' +
            'r:qs="rId4" r:cs="rId5"/></a:graphicData></a:graphic>' +
            '</p:graphicFrame>';
        const bytes = await genDeckBytes('', frame, [
            {
                fileName: 'ppt/slides/_rels/slide2.xml.rels',
                data: genRels([
                    ['rId1', 'image', '../media/image1.png'],
                    ['rId2', 'diagramData', '../diagrams/data1.xml'],
                    ['rId6', 'diagramDrawing', '../diagrams/drawing1.xml'],
                ]),
            },
            { fileName: 'ppt/diagrams/data1.xml', data },
            { fileName: 'ppt/diagrams/drawing1.xml', data: drawing },
        ]);
        const opened = openOfficePackage(bytes);
        if ('reason' in opened) {
            throw new Error(opened.reason);
        }
        const read = await readOfficeDocument(opened.pkg, 'pptx');
        if ('reason' in read || read.kind !== 'pptx') {
            throw new Error('not read');
        }
        const box = read.slides[1].boxes.find((one) => {
            return one.name === 'Diagram 6';
        });
        expect(box?.kind).toBe('smartart');
        expect(box?.smartArt?.words).toEqual(['Plan', 'Pray', 'Go']);
        const out = await runOnBytes(
            bytes,
            'pptx',
            [],
            [{ from: 'Pray', to: 'Worship' }],
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const dataAfter = (await out.pkg.readText(
            'ppt/diagrams/data1.xml',
        )) as string;
        const drawingAfter = (await out.pkg.readText(
            'ppt/diagrams/drawing1.xml',
        )) as string;
        expect(dataAfter).toContain('<a:t>Worship</a:t>');
        expect(dataAfter).not.toContain('<a:t>Pray</a:t>');
        expect(drawingAfter).toContain('<a:t>Worship</a:t>');
        expect(drawingAfter).not.toContain('<a:t>Pray</a:t>');
        // counted once: the drawing is a copy of the same words
        expect(out.changed).toEqual([
            'Replaced “Pray” with “Worship” (1 place).',
        ]);
    });

    test('a look that cannot be written refuses the call', async () => {
        const bytes = await genDeckBytes();
        expect(
            await runOnBytes(bytes, 'pptx', [
                { id: '1.1', text: 'Hi' },
                { id: '1.2', color: 'greenish' },
            ]),
        ).toEqual({
            reason: expect.stringContaining('"greenish" is not a colour'),
        });
        expect(
            await runOnBytes(bytes, 'pptx', [{ slide: 9, color: 'red' }]),
        ).toEqual({ reason: 'There is no slide 9: the deck has 3.' });
        expect(await runOnBytes(bytes, 'pptx', [{ hidden: true }])).toEqual({
            reason: '`hidden` hides or shows one slide: give its `slide` number.',
        });
        expect(
            await runOnBytes(bytes, 'pptx', [{ id: '1.1', background: 'red' }]),
        ).toEqual({
            reason:
                "A slide's `background`, `hidden`, `removeBox`, " +
                '`transition`, `advance`, a `box` and a `textBox` go ' +
                'with `slide` (or none), never with a line id.',
        });
        expect(
            await runOnBytes(bytes, 'pptx', [{ slide: 1, background: 'sky' }]),
        ).toEqual({ reason: expect.stringContaining('is not a colour') });
        expect(await runOnBytes(bytes, 'pptx', [{ id: '1.1' }])).toEqual({
            reason:
                'Say what to do with line 1.1: `text` for its new words, ' +
                '`remove`: true, or its look (`color`, `size`, `bold`, …).',
        });
    });
});

describe('a deck with pictures', () => {
    test('read with its pictures; a background behind one is said', async () => {
        const bytes = await genDeckBytes(CURTAIN);
        const opened = openOfficePackage(bytes);
        if ('reason' in opened) {
            throw new Error(opened.reason);
        }
        const document = await readOfficeDocument(opened.pkg, 'pptx');
        if ('reason' in document) {
            throw new Error(document.reason);
        }
        const read = toOfficeReadResult(document);
        expect(read.kind === 'PowerPoint' && read.slides[0].boxes).toEqual([
            { name: 'Title 1', lines: '1.1' },
            { name: 'TextBox 2', lines: '1.2-1.3' },
            {
                name: 'Curtain',
                kind: 'picture',
                at: [0, 0, 100, 100],
                fills: true,
            },
        ]);
        expect(
            read.kind === 'PowerPoint' &&
                (read.slides[1].boxes as { kind?: string }[]).some((box) => {
                    return box.kind === 'picture';
                }),
        ).toBe(false);
        const out = await runOnBytes(bytes, 'pptx', [{ background: 'navy' }]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            "Every slide's background is now navy (#000080).",
            'It does NOT show: a picture fills the slide in front of it -- ' +
                '"Curtain" on slide 1. Say so; {removeBox: "Curtain"} with no ' +
                'slide takes that picture off every slide that has it, and ' +
                'the colour shows there.',
        ]);
    });

    test('a picture taken off by its name, the colour then shown', async () => {
        const out = await runOnBytes(await genDeckBytes(CURTAIN), 'pptx', [
            { slide: 1, removeBox: 'curtain' },
            { slide: 1, background: 'green' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Took "curtain" off slide 1.',
            "Slide 1's background is now green (#008000).",
        ]);
        const xml = await readSlideXml(out, 1);
        expect(xml).not.toContain('<p:pic>');
        expect(xml).toContain('<a:srgbClr val="008000"/>');
        // the words stay
        expect(toSlideTexts(out.after)[0]).toBe(
            'Welcome / Good morning / Please stand',
        );
        // off every slide that has it, and one no slide has
        const every = await runOnBytes(await genDeckBytes(CURTAIN), 'pptx', [
            { removeBox: 'Curtain' },
        ]);
        expect('changed' in every && every.changed).toEqual([
            'Took "Curtain" off slide 1.',
        ]);
        expect(
            await runOnBytes(await genDeckBytes(CURTAIN), 'pptx', [
                { slide: 2, removeBox: 'Curtain' },
            ]),
        ).toEqual({
            reason:
                'Slide 2: There is no box "Curtain" there. Its boxes: ' +
                '"Title 1" (text), "TextBox 2" (text).',
        });
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [
                { removeBox: 'Curtain' },
            ]),
        ).toEqual({
            reason: 'No slide has a box "Curtain". Name a box as read.',
        });
    });
});

async function genLetterBytes() {
    return await toZipBytes([
        {
            fileName: '[Content_Types].xml',
            data: '<Types xmlns="t"><Override PartName="/word/document.xml" ContentType="d"/></Types>',
        },
        {
            fileName: '_rels/.rels',
            data: genRels([['rId1', 'officeDocument', 'word/document.xml']]),
        },
        {
            fileName: 'word/document.xml',
            data:
                '<w:document xmlns:w="w"><w:body>' +
                '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Newsletter</w:t></w:r></w:p>' +
                '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Dear friends,</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>We meet on Sunday.</w:t></w:r></w:p>' +
                '<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:pPr>' +
                '<w:r><w:t>Last</w:t></w:r></w:p>' +
                '<w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:body></w:document>',
        },
    ]);
}

describe("a Word page's colour and a picture in it (2026-11-21)", () => {
    // a phone's 4:3 photo, its header alone
    const PHOTO_PATH = '/pics/photo.jpg';
    const photo = new Uint8Array([
        0xff,
        0xd8,
        ...[0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20],
        ...Array(12).fill(0),
    ]);
    const pictures = new Map([[PHOTO_PATH, photo]]);

    test('a page colour set, read back, then taken off', async () => {
        const out = await runOnBytes(await genLetterBytes(), 'docx', [
            { pageColor: '#FFF2CC' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            expect.stringMatching(/^The page is .+ now\.$/),
        ]);
        const xml = (await out.pkg.readText('word/document.xml')) ?? '';
        expect(xml).toMatch(/<w:background w:color="FFF2CC"\/>\s*<w:body>/);
        const read = toOfficeReadResult(out.after);
        expect(read.kind === 'Word' && read.pageColor).toEqual(
            expect.any(String),
        );
        const off = await runOnBytes(out.written, 'docx', [
            { pageColor: 'none' },
        ]);
        if ('reason' in off) {
            throw new Error(off.reason);
        }
        expect(
            (await off.pkg.readText('word/document.xml')) ?? '',
        ).not.toContain('w:background');
        expect(toOfficeReadResult(off.after)).not.toHaveProperty('pageColor');
    });

    test('a picture in a line of its own after a line, its parts once', async () => {
        const out = await runOnBytes(
            await genLetterBytes(),
            'docx',
            [{ after: '2', picture: PHOTO_PATH, width: 50 }],
            [],
            pictures,
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            "Put “photo.jpg” in a line of its own after 2, 50% of the page's " +
                'width.',
        ]);
        const xml = (await out.pkg.readText('word/document.xml')) ?? '';
        // after "Dear friends," and before "We meet on Sunday."
        const at = xml.indexOf('<wp:inline');
        expect(at).toBeGreaterThan(xml.indexOf('Dear friends,'));
        expect(at).toBeLessThan(xml.indexOf('We meet on Sunday.'));
        const relId = /r:embed="(rId\d+)"/.exec(xml)?.[1];
        const rels =
            (await out.pkg.readText('word/_rels/document.xml.rels')) ?? '';
        expect(rels).toContain(`Id="${relId}"`);
        expect(rels).toContain('Target="media/image1.jpeg"');
        expect((await out.pkg.readText('[Content_Types].xml')) ?? '').toContain(
            'Extension="jpeg"',
        );
        const entries = readOfficeZipEntries(out.written);
        if ('reason' in entries) {
            throw new Error(entries.reason);
        }
        expect(
            entries.filter((entry) => {
                return entry.fileName.startsWith('word/media/');
            }),
        ).toHaveLength(1);
        if (out.after.kind !== 'docx') {
            throw new Error('not a letter');
        }
        // read back as line 3, a picture with no words, removable by its id
        expect(out.after.lines).toHaveLength(5);
        const read = toOfficeReadResult(out.after);
        expect(read.kind === 'Word' && read.lines[2]).toEqual({
            id: '3',
            picture: true,
            text: '',
        });
    });

    test('refused: a page colour on a deck or with a line, a width alone', async () => {
        expect(
            await runOnBytes(await genLetterBytes(), 'docx', [
                { id: '1', pageColor: 'blue' },
            ]),
        ).toHaveProperty('reason', expect.stringContaining('`pageColor`'));
        expect(
            await runOnBytes(await genLetterBytes(), 'docx', [
                { id: '1', width: 50 },
            ]),
        ).toHaveProperty('reason', expect.stringContaining('`width`'));
        expect(
            await runOnBytes(await genLetterBytes(), 'docx', [
                { pageColor: 'not a colour' },
            ]),
        ).toHaveProperty(
            'reason',
            'No colour "not a colour": a name or ' + '#RRGGBB, or "none".',
        );
    });
});

describe('a Word document changed', () => {
    test('lines by number, a line added, words replaced', async () => {
        const out = await runOnBytes(
            await genLetterBytes(),
            'docx',
            [
                { id: '2', text: 'Dear church family,' },
                { before: '3', text: 'Welcome back!' },
            ],
            [{ from: 'Sunday', to: 'Saturday' }],
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        if (out.after.kind !== 'docx') {
            throw new Error('not a letter');
        }
        expect(
            out.after.lines.map((line) => {
                return line.text;
            }),
        ).toEqual([
            'Newsletter',
            'Dear church family,',
            'Welcome back!',
            'We meet on Saturday.',
            'Last',
        ]);
        const xml = (await out.pkg.readText('word/document.xml')) ?? '';
        // the bold of line 2 kept
        expect(xml).toContain(
            '<w:rPr><w:b/></w:rPr><w:t>Dear church family,</w:t>',
        );
        const read = toOfficeReadResult(out.after);
        expect(read.kind === 'Word' && read.lines[0]).toEqual({
            id: '1',
            style: 'Title',
            text: 'Newsletter',
        });
    });

    test('the line holding the page settings is emptied, never taken out', async () => {
        const out = await runOnBytes(await genLetterBytes(), 'docx', [
            { id: '4', remove: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const xml = (await out.pkg.readText('word/document.xml')) ?? '';
        expect(xml.match(/<w:sectPr>/g)).toHaveLength(2);
        expect(xml).not.toContain('Last');
    });

    test('a look for one line and for every line', async () => {
        const out = await runOnBytes(await genLetterBytes(), 'docx', [
            { color: 'green', font: 'Georgia' },
            { id: '1', align: 'center', size: 28 },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const xml = (await out.pkg.readText('word/document.xml')) ?? '';
        expect(xml.match(/<w:color w:val="008000"\/>/g)).toHaveLength(8);
        expect(xml).toContain(
            '<w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/>',
        );
        expect(xml).toContain('<w:sz w:val="56"/>');
        // the bold kept beside the new face
        expect(xml).toContain(
            '<w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" ' +
                'w:eastAsia="Georgia" w:cs="Georgia"/><w:b/><w:color w:val="008000"/>',
        );
        // the page settings stay in the last line, after its look
        expect(xml).toMatch(
            /<\/w:rPr><w:sectPr><w:pgSz w:w="12240"\/><\/w:sectPr><\/w:pPr>/,
        );
        expect(
            await runOnBytes(await genLetterBytes(), 'docx', [
                { background: 'red' },
            ]),
        ).toEqual({ reason: expect.stringContaining('`pageColor`') });
    });

    test('a Word file has no slides', async () => {
        expect(
            await runOnBytes(await genLetterBytes(), 'docx', [
                { slide: 1, note: 'x' },
            ]),
        ).toEqual({
            reason: 'A Word file has no slides: change its lines by id, or replace words.',
        });
    });
});

describe('sections after slides moved', () => {
    const genSections = (lists: string[][]) => {
        return (
            '<p:presentation><p:extLst><p:ext><p14:sectionLst>' +
            lists
                .map((ids, index) => {
                    return (
                        `<p14:section name="S${index}" id="{${index}}">` +
                        (ids.length === 0
                            ? '<p14:sldIdLst/>'
                            : `<p14:sldIdLst>${ids
                                  .map((id) => {
                                      return `<p14:sldId id="${id}"/>`;
                                  })
                                  .join('')}</p14:sldIdLst>`) +
                        '</p14:section>'
                    );
                })
                .join('') +
            '</p14:sectionLst></p:ext></p:extLst></p:presentation>'
        );
    };

    test('a slide moved to the front joins the first section', () => {
        const before = genSections([['256', '257'], ['258'], ['259']]);
        expect(toOrderedSectionsXml(before, ['259', '256', '257', '258'])).toBe(
            genSections([['259', '256', '257'], ['258'], []]),
        );
    });

    test('a copy put at the end joins the last section', () => {
        // the copy (300) was listed beside the slide it copies
        const before = genSections([['256', '300', '257'], ['258']]);
        expect(toOrderedSectionsXml(before, ['256', '257', '258', '300'])).toBe(
            genSections([
                ['256', '257'],
                ['258', '300'],
            ]),
        );
    });

    test('slides in order keep their sections; a deck with none is left', () => {
        const before = genSections([['256'], ['257', '258']]);
        expect(toOrderedSectionsXml(before, ['256', '258', '257'])).toBe(
            genSections([['256'], ['258', '257']]),
        );
        const plain = '<p:presentation><p:sldIdLst/></p:presentation>';
        expect(toOrderedSectionsXml(plain, ['256'])).toBe(plain);
        // a section it cannot read whole is not guessed at
        const odd =
            '<p14:sectionLst><p14:section name="A" id="{1}"/></p14:sectionLst>';
        expect(toOrderedSectionsXml(odd, ['256'])).toBe(odd);
    });
});

describe('a deck laid out and shown (the goal: everything on a pptx)', () => {
    // a box placed by the deck itself, where the hymn deck has its verse
    const VERSE_BOX =
        '<p:sp><p:nvSpPr><p:cNvPr id="7" name="Verse 6"/><p:cNvSpPr/>' +
        '<p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1219200" ' +
        'y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm></p:spPr>' +
        '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="5800"/>' +
        '<a:t>Jesus Christ the Son</a:t></a:r></a:p></p:txBody></p:sp>';

    test('"make the words bigger": each from its own size', async () => {
        const out = await runOnBytes(await genDeckBytes(VERSE_BOX), 'pptx', [
            { size: '+20%' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual(['Every line: 20% bigger.']);
        const xml = await readSlideXml(out, 1);
        // 58 pt is 69.5, never flattened to one size; a run with none of
        // its own is drawn at PowerPoint's 18 pt here (no layout says)
        expect(xml).toContain('sz="6950"');
        expect(xml).toContain('<a:rPr lang="en-US" b="1" sz="2150"/>');
    });

    test('"make the word … red": those words alone, every place', async () => {
        const out = await runOnBytes(await genDeckBytes(VERSE_BOX), 'pptx', [
            { slide: 1, words: 'Christ', color: 'red' },
            { id: '2.3', words: 'lord', bold: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        // a line's own change is worked out first
        expect(out.changed).toEqual([
            '“lord” in line 2.3 (1 place): bold.',
            '“Christ” in every line of slide 1 (1 place): colour red (#FF0000).',
        ]);
        const xml = await readSlideXml(out, 1);
        expect(xml).toContain(
            '<a:r><a:rPr lang="en-US" sz="5800"/><a:t>Jesus </a:t></a:r>' +
                '<a:r><a:rPr lang="en-US" sz="5800"><a:solidFill>' +
                '<a:srgbClr val="FF0000"/></a:solidFill></a:rPr>' +
                '<a:t>Christ</a:t></a:r><a:r><a:rPr lang="en-US" ' +
                'sz="5800"/><a:t> the Son</a:t></a:r>',
        );
        expect(toSlideTexts(out.after)[0]).toContain('Jesus Christ the Son');
        expect(await readSlideXml(out, 2)).toContain(
            '<a:rPr lang="en-US" b="1"/><a:t>Lord</a:t>',
        );
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [
                { id: '1.2', words: 'Jesus', color: 'red' },
            ]),
        ).toEqual({
            reason:
                '“Jesus” is not in line 1.2 as written. Write `words` ' +
                'exactly as the line has them.',
        });
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [{ words: 'Lord' }]),
        ).toEqual({ reason: expect.stringContaining('say the look too') });
    });

    test('a box moved, sized, and its lines given a look', async () => {
        const bytes = await genDeckBytes(VERSE_BOX);
        const out = await runOnBytes(bytes, 'pptx', [
            { slide: 1, box: 'Verse 6', at: [null, 70, 80, null] },
            { id: '1.1', at: [0, 85, 100, 15] },
            { box: 'title', color: 'gold' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'The lines of "Title 1" on 3 slides (1-3): colour #FFD700.',
            'Moved "Verse 6" on slide 1: at [10, 70, 80, 50] (x, y, width, ' +
                'height in % of the slide). Part of it is off the slide now: ' +
                'say so, and offer to fit it on the slide.',
            'Moved "Title 1" on slide 1: at [0, 85, 100, 15] (x, y, width, ' +
                'height in % of the slide).',
        ]);
        const read = toOfficeReadResult(out.after);
        expect(read.kind === 'PowerPoint' && read.slides[0].boxes).toEqual([
            { name: 'Title 1', at: [0, 85, 100, 15], lines: '1.1' },
            { name: 'TextBox 2', lines: '1.2-1.3' },
            { name: 'Verse 6', at: [10, 70, 80, 50], lines: '1.4' },
        ]);
        // the title had no place of its own: one is made in its properties
        expect(await readSlideXml(out, 1)).toContain(
            '<p:spPr><a:xfrm><a:off x="0" y="5829300"/>',
        );
        expect(
            await runOnBytes(bytes, 'pptx', [
                { slide: 1, box: 'Picture 9', at: [0, 0, 10, 10] },
            ]),
        ).toEqual({
            reason:
                'Slide 1 has no box "Picture 9". Its boxes: "Title 1" ' +
                '(title), "TextBox 2" (text), "Verse 6" (text).',
        });
        expect(
            await runOnBytes(bytes, 'pptx', [
                { slide: 1, box: 'title', at: [null, 50, null, null] },
            ]),
        ).toEqual({
            reason: expect.stringContaining('no place of its own to keep'),
        });
    });

    test('a new text box in the look of the slide, a look of its own', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { slide: 1, textBox: 'Welcome\nfriends', at: [10, 80, 80, 12] },
            { slide: 2, textBox: 'Amen', color: 'white', size: 40 },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Added a text box "TextBox 3" on slide 1 at [10, 80, 80, 12]: ' +
                '“Welcome friends”.',
            'Added a text box "TextBox 3" on slide 2 at [10, 40, 80, 20]: ' +
                '“Amen” (colour white (#FFFFFF), 40 pt).',
        ]);
        expect(toSlideTexts(out.after)).toEqual([
            'Welcome / Good morning / Please stand / Welcome / friends',
            'Amazing Grace / how sweet the sound / Lord / Amen',
            'Offering / Give to the Lord',
        ]);
        const xml = await readSlideXml(out, 2);
        expect(xml).toContain(
            '<p:cNvPr id="4" name="TextBox 3"/><p:cNvSpPr txBox="1"/>',
        );
        // the slide's first words' look, the size and colour asked over it
        expect(xml).toContain(
            '<a:rPr lang="en-US" b="1" sz="4000"><a:solidFill><a:srgbClr ' +
                'val="FFFFFF"/></a:solidFill></a:rPr><a:t>Amen</a:t>',
        );
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [{ textBox: 'Hi' }]),
        ).toEqual({
            reason: 'A new text box goes on one slide: give its `slide`.',
        });
    });

    test('transitions, the seconds a slide waits, refusals', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            { transition: 'Fade' },
            { slide: 2, transition: 'push', advance: 5 },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Every slide: fade transition.',
            'Slide 2: push transition, goes on by itself after 5 s.',
        ]);
        expect(await readSlideXml(out, 1)).toContain(
            '</p:cSld><p:transition spd="med"><p:fade/></p:transition></p:sld>',
        );
        expect(await readSlideXml(out, 2)).toContain(
            '<p:transition spd="med" advTm="5000"><p:push/></p:transition>',
        );
        const read = toOfficeReadResult(out.after);
        expect(read.kind === 'PowerPoint' && read.slides[1].transition).toEqual(
            { kind: 'push', advance: 5 },
        );
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [
                { transition: 'swirl' },
            ]),
        ).toEqual({
            reason:
                '`transition` is one of fade, push, wipe, cover, uncover, ' +
                'split, dissolve, zoom, wheel, random, cut, none.',
        });
    });

    test('4:3: every box moved with the slide, a full picture still full', async () => {
        const out = await runOnBytes(
            await genDeckBytes(CURTAIN + VERSE_BOX),
            'pptx',
            [{ slideSize: '4x3' }],
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'The slides are 4:3 now (they were 16:9): every box was moved ' +
                'and sized with them; words keep their size, so a line may ' +
                'wrap where it did not.',
        ]);
        // a deck that said no size gets one, where the schema puts it
        expect(await out.pkg.readText('ppt/presentation.xml')).toContain(
            '</p:sldIdLst><p:sldSz cx="9144000" cy="6858000" ' +
                'type="screen4x3"/><p:extLst>',
        );
        const read = toOfficeReadResult(out.after);
        expect(read.kind === 'PowerPoint' && read.slides[0].boxes).toEqual([
            { name: 'Title 1', lines: '1.1' },
            { name: 'TextBox 2', lines: '1.2-1.3' },
            {
                name: 'Curtain',
                kind: 'picture',
                at: [0, 0, 100, 100],
                fills: true,
            },
            { name: 'Verse 6', at: [10, 10, 50, 50], lines: '1.4' },
        ]);
        expect(
            await runOnBytes(await genDeckBytes(), 'pptx', [
                { slide: 1, slideSize: '4:3' },
            ]),
        ).toEqual({
            reason: "`slideSize` is the whole deck's: give it with no `slide`.",
        });
    });

    test('a Word file: words given a look; boxes and slides refused', async () => {
        const out = await runOnBytes(await genLetterBytes(), 'docx', [
            { words: 'Sunday', color: 'blue', size: '+2' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            '“Sunday” in every line (1 place): colour blue (#0000FF), 2 pt ' +
                'bigger.',
        ]);
        expect(await out.pkg.readText('word/document.xml')).toContain(
            '<w:color w:val="0000FF"/><w:sz w:val="26"/>',
        );
        expect(
            await runOnBytes(await genLetterBytes(), 'docx', [
                { transition: 'fade' },
            ]),
        ).toEqual({
            reason: expect.stringContaining(
                'A Word file has no slides or boxes',
            ),
        });
    });
});

describe('a picture put into a deck (the goal: everything on a pptx)', () => {
    // a phone's 4:3 photo and a 4:3 PNG, their headers alone
    const PHOTO_PATH = '/pics/photo.jpg';
    const BACK_PATH = 'C:\\pics\\Back Ground.PNG';
    const photo = new Uint8Array([
        0xff,
        0xd8,
        ...[0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20],
        ...Array(12).fill(0),
    ]);
    const back = new Uint8Array(33);
    back.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(back.buffer).setUint32(16, 1600);
    new DataView(back.buffer).setUint32(20, 1200);
    const pictures = new Map([
        [PHOTO_PATH, photo],
        [BACK_PATH, back],
        ['/pics/fake.png', PICTURE],
    ]);
    const listEntries = (written: Uint8Array) => {
        const entries = readOfficeZipEntries(written);
        if ('reason' in entries) {
            throw new Error(entries.reason);
        }
        return entries;
    };
    const readEntry = async (written: Uint8Array, name: string) => {
        const entry = listEntries(written).find((one) => {
            return one.fileName === name;
        });
        return entry === undefined
            ? null
            : await readOfficeZipEntryBytes(written, entry);
    };

    test('in front of words: the change says so, with the way out', async () => {
        // the hymn deck's verse, placed by the deck: 10% in, half the slide
        const verse =
            '<p:sp><p:nvSpPr><p:cNvPr id="7" name="Verse 6"/><p:cNvSpPr/>' +
            '<p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1219200" ' +
            'y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm>' +
            '</p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr/>' +
            '<a:t>Jesus Christ the Son</a:t></a:r></a:p></p:txBody></p:sp>';
        const run = async (at: (number | null)[]) => {
            const out = await runOnBytes(
                await genDeckBytes(verse),
                'pptx',
                [{ slide: 1, picture: PHOTO_PATH, at }],
                [],
                pictures,
            );
            if ('reason' in out) {
                throw new Error(out.reason);
            }
            return out.changed;
        };
        expect(await run([40, 20, 30, null])).toEqual([
            'Added “photo.jpg” as "Picture 7" on slide 1 ("Welcome") at ' +
                '[40, 20, 30, 40], ' +
                'in front. It lies over the words of "Verse 6" on slide 1: ' +
                'say so, and offer to move it or make it smaller ' +
                '({box: "Picture 7", at}) or to move the words.',
        ]);
        // clear of the verse, nothing to say
        expect(await run([70, 70, 20, null])).toEqual([
            'Added “photo.jpg” as "Picture 7" on slide 1 ("Welcome") at ' +
                '[70, 70, 20, ' +
                '26.7], in front.',
        ]);
    });

    test('on a slide, in front: the bytes once, a relationship, its type', async () => {
        const out = await runOnBytes(
            await genDeckBytes(),
            'pptx',
            [{ slide: 2, picture: PHOTO_PATH, at: [60, 10, 30, null] }],
            [],
            pictures,
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Added “photo.jpg” as "Picture 3" on slide 2 ("Amazing Grace") ' +
                'at [60, 10, 30, 40], ' +
                'in front.',
        ]);
        // the deck's own picture is image1: the new one is image2
        expect(await readEntry(out.written, 'ppt/media/image2.jpeg')).toEqual(
            photo,
        );
        expect(await out.pkg.readText('[Content_Types].xml')).toContain(
            '<Default Extension="jpeg" ContentType="image/jpeg"/>',
        );
        expect(
            await out.pkg.readText('ppt/slides/_rels/slide2.xml.rels'),
        ).toContain(
            `<Relationship Id="rId2" Type="${REL}image" ` +
                'Target="../media/image2.jpeg"/>',
        );
        const slide = (await out.pkg.readText('ppt/slides/slide2.xml')) ?? '';
        expect(slide).toContain('<a:blip r:embed="rId2"/><a:stretch>');
        expect(slide.indexOf('name="Picture 3"')).toBeGreaterThan(
            slide.indexOf('name="TextBox 2"'),
        );
        const read = toOfficeReadResult(out.after);
        expect(
            read.kind === 'PowerPoint' && read.slides[1].boxes,
        ).toContainEqual({
            name: 'Picture 3',
            kind: 'picture',
            at: [60, 10, 30, 40],
        });
    });

    test('filling the slide: behind the words, cropped, on every slide', async () => {
        const out = await runOnBytes(
            await genDeckBytes(),
            'pptx',
            [{ picture: BACK_PATH, at: [0, 0, 100, 100] }],
            [],
            pictures,
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Added “Back Ground.PNG” as "Picture 3" on 3 slides (1-3) at ' +
                '[0, 0, 100, 100], behind the words, filling the slide, ' +
                'cropped to that shape.',
        ]);
        // one copy of the bytes for the three slides; png already typed
        expect(
            listEntries(out.written).filter((one) => {
                return one.fileName.startsWith('ppt/media/');
            }),
        ).toHaveLength(2);
        expect(
            (await out.pkg.readText('[Content_Types].xml'))?.match(
                /Extension="png"/g,
            ),
        ).toHaveLength(1);
        for (const number of [1, 2, 3]) {
            const slide =
                (await out.pkg.readText(`ppt/slides/slide${number}.xml`)) ?? '';
            expect(slide).toContain(
                '<p:spTree><p:pic><p:nvPicPr><p:cNvPr id="4" ' +
                    'name="Picture 3" descr="Back Ground.PNG"/>',
            );
            expect(slide).toContain('<a:srcRect t="12500" b="12500"/>');
        }
        // the old words are still read, in front of it
        expect(toSlideTexts(out.after)[0]).toBe(
            'Welcome / Good morning / Please stand',
        );
    });

    test("in a picture's place: the same box, the new picture, cropped", async () => {
        const out = await runOnBytes(
            await genDeckBytes(CURTAIN),
            'pptx',
            [{ box: 'Curtain', picture: BACK_PATH }],
            [],
            pictures,
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Put “Back Ground.PNG” in the place of "Curtain" on slide 1: the ' +
                'same place and size, cropped to its shape, never squeezed.',
        ]);
        const slide = (await out.pkg.readText('ppt/slides/slide1.xml')) ?? '';
        expect(slide).toContain(
            '<a:blip r:embed="rId3"><a:extLst><a:ext uri="{x}"/></a:extLst>' +
                '</a:blip><a:srcRect t="12500" b="12500"/></p:blipFill>',
        );
        expect(
            await out.pkg.readText('ppt/slides/_rels/slide1.xml.rels'),
        ).toContain(
            'Id="rId3" Type="' + REL + 'image" Target="../media/image2.png"',
        );
    });

    test('the same picture under another name is named for the next call', async () => {
        // slide 2 draws the curtain's own media as "Backdrop": a deck made
        // slide by slide names one picture as many ways as PowerPoint did
        const backdrop = CURTAIN.replace('name="Curtain"', 'name="Backdrop"');
        const out = await runOnBytes(
            await genDeckBytes(CURTAIN, backdrop),
            'pptx',
            [{ box: 'Curtain', picture: BACK_PATH }],
            [],
            pictures,
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            'Put “Back Ground.PNG” in the place of "Curtain" on slide 1: the ' +
                'same place and size, cropped to its shape, never squeezed. ' +
                'The picture it replaced is still drawn by "Backdrop" on ' +
                'slide 2, left as it was: when they asked for it everywhere, ' +
                'put it there too in this answer ({slide: 2, box: ' +
                '"Backdrop", picture}).',
        ]);
        // and that call, made beside it, names nothing left
        const both = await runOnBytes(
            await genDeckBytes(CURTAIN, backdrop),
            'pptx',
            [
                { box: 'Curtain', picture: BACK_PATH },
                { slide: 2, box: 'Backdrop', picture: BACK_PATH },
            ],
            [],
            pictures,
        );
        if ('reason' in both) {
            throw new Error(both.reason);
        }
        expect(both.changed[1]).toBe(
            'Put “Back Ground.PNG” in the place of "Backdrop" on slide 2: the ' +
                'same place and size, cropped to its shape, never squeezed.',
        );
        // one copy of the bytes for both
        expect(
            listEntries(both.written).filter((one) => {
                return one.fileName.startsWith('ppt/media/');
            }),
        ).toHaveLength(2);
    });

    test('refused, nothing written: a curtain over it, a text box, no picture', async () => {
        const run = async (changes: OfficeChangeType[], extra = '') => {
            return await runOnBytes(
                await genDeckBytes(extra),
                'pptx',
                changes,
                [],
                pictures,
            );
        };
        expect(
            await run(
                [{ slide: 1, picture: BACK_PATH, at: [0, 0, 100, 100] }],
                CURTAIN,
            ),
        ).toEqual({
            reason:
                'A picture filling the slide goes behind the words, and ' +
                '"Curtain" already fills slide 1 there, so it would not show. ' +
                'Put it in that picture\'s place: {box: "Curtain", ' +
                'picture}, with the slide.',
        });
        expect(
            await run([{ slide: 1, box: 'Title 1', picture: PHOTO_PATH }]),
        ).toEqual({
            reason: expect.stringContaining(
                '"Title 1" on slide 1 draws no picture',
            ),
        });
        expect(await run([{ slide: 1, picture: '/pics/gone.png' }])).toEqual({
            reason: expect.stringContaining('`picture` is a picture attached'),
        });
        expect(await run([{ slide: 1, picture: '/pics/fake.png' }])).toEqual({
            reason:
                '"fake.png" is not a PNG, JPEG, GIF or BMP picture: those are ' +
                'what a slide draws.',
        });
        expect(
            await run([{ slide: 1, picture: PHOTO_PATH, textBox: 'Hi' }]),
        ).toEqual({ reason: expect.stringContaining('send a text box') });
        expect(await run([{ slide: 9, picture: PHOTO_PATH }])).toEqual({
            reason: 'There is no slide 9: the deck has 3.',
        });
        expect(
            await runOnBytes(
                await genLetterBytes(),
                'docx',
                [{ picture: PHOTO_PATH }],
                [],
                pictures,
            ),
        ).toEqual({
            reason: expect.stringContaining(
                'A Word file has no slides or boxes',
            ),
        });
    });
});

describe('a video or a sound put on a slide (2026-11-21)', () => {
    const CLIP_PATH = '/Movies/Welcome Loop.mp4';
    const BELL_PATH = 'C:\\sounds\\Bell.mp3';
    // an MP4's first box and an MP3's tag: what the bytes say they are
    const clip = new Uint8Array(64);
    clip.set([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const bell = new Uint8Array(64);
    bell.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64]);
    const media = new Map([
        [CLIP_PATH, clip],
        [BELL_PATH, bell],
        ['/Movies/renamed.mp4', PICTURE],
    ]);
    const run = async (changes: OfficeChangeType[], bytes?: Uint8Array) => {
        return await runOnBytes(
            bytes ?? (await genDeckBytes()),
            'pptx',
            changes,
            [],
            media,
        );
    };
    const readText = async (
        out: { pkg: { readText: (name: string) => Promise<string | null> } },
        name: string,
    ) => {
        return (await out.pkg.readText(name)) ?? '';
    };

    test('a video at a click: the clip once, a poster, three relationships, its box and timing', async () => {
        const out = await run([{ slide: 2, media: CLIP_PATH }]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toHaveLength(1);
        expect(out.changed[0]).toMatch(
            /^Added the video “Welcome Loop\.mp4” as "Video \d+" on slide 2 \("Amazing Grace"\) at \[[\d., ]+\], playing when it is clicked in the slide show\. The file is kept inside the PowerPoint\./,
        );
        const names = out.pkg.names as readonly string[];
        expect(names).toContain('ppt/media/media1.mp4');
        const bytes = await out.pkg.readBytes?.('ppt/media/media1.mp4');
        expect(bytes).toEqual(clip);
        const poster = names.find((name) => {
            return (
                /^ppt\/media\/image\d+\.png$/.test(name) &&
                name !== 'ppt/media/image1.png'
            );
        });
        expect(poster).toBeDefined();
        const types = await readText(out, '[Content_Types].xml');
        expect(types).toMatch(
            /<Default Extension="mp4" ContentType="video\/mp4"\/>/,
        );
        expect(types).toMatch(/<Default Extension="png" /);
        const rels = await readText(out, toRelsPath('ppt/slides/slide2.xml'));
        expect(rels).toContain('relationships/video"');
        expect(rels).toContain(
            'http://schemas.microsoft.com/office/2007/relationships/media"',
        );
        expect(rels.match(/Target="\.\.\/media\/media1\.mp4"/g)).toHaveLength(
            2,
        );
        const slide = await readText(out, 'ppt/slides/slide2.xml');
        expect(slide).toContain('<a:videoFile r:link="');
        expect(slide).toMatch(/<p14:media\b[^>]*r:embed="/);
        expect(slide).toContain('<p:video>');
        // the read names it as a video box
        const read = out.after.kind === 'pptx' ? out.after.slides[1] : null;
        expect(
            read?.boxes.some((box) => {
                return box.kind === 'video' && /^Video \d+$/.test(box.name);
            }),
        ).toBe(true);
    });

    test('a sound that plays by itself is a small speaker in a corner', async () => {
        const out = await run([{ slide: 1, media: BELL_PATH, play: 'auto' }]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed[0]).toContain(
            'Added the sound “Bell.mp3” as "Audio',
        );
        expect(out.changed[0]).toContain(
            'playing by itself when the slide shows: a small speaker on the ' +
                'slide stands for it.',
        );
        const types = await readText(out, '[Content_Types].xml');
        expect(types).toMatch(
            /<Default Extension="mp3" ContentType="audio\/mpeg"\/>/,
        );
        const slide = await readText(out, 'ppt/slides/slide1.xml');
        expect(slide).toContain('<a:audioFile r:link="');
        expect(slide).toContain('<p:audio>');
        // the box sits at the bottom right
        const at = /\[([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\]/
            .exec(out.changed[0])
            ?.slice(1)
            .map(Number) as number[];
        expect(at[0]).toBeGreaterThan(80);
        expect(at[1]).toBeGreaterThan(75);
    });

    test('taken off by its name, its timing goes with it', async () => {
        const added = await run([{ slide: 2, media: CLIP_PATH }]);
        if ('reason' in added) {
            throw new Error(added.reason);
        }
        const name = /as "(Video \d+)"/.exec(added.changed[0])?.[1] as string;
        const out = await run([{ slide: 2, removeBox: name }], added.written);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const slide = await readText(out, 'ppt/slides/slide2.xml');
        expect(slide).not.toContain('<a:videoFile');
        expect(slide).not.toContain('<p:video>');
    });

    test('refused: no clip attached, not a clip, no slide, play alone, a Word file', async () => {
        expect(await run([{ slide: 1, media: '/Movies/other.mp4' }])).toEqual({
            reason: expect.stringContaining('`media` is a video or a sound'),
        });
        expect(await run([{ slide: 1, media: '/Movies/renamed.mp4' }])).toEqual(
            {
                reason: expect.stringContaining('"renamed.mp4" is not a video'),
            },
        );
        expect(await run([{ media: CLIP_PATH }])).toEqual({
            reason: expect.stringContaining('give its `slide`'),
        });
        expect(await run([{ slide: 1, play: 'auto' }])).toEqual({
            reason: expect.stringContaining('`play` is "click" or "auto"'),
        });
        expect(
            await run([{ slide: 1, media: CLIP_PATH, textBox: 'Welcome' }]),
        ).toEqual({ reason: expect.stringContaining('send a picture') });
        expect(
            await runOnBytes(
                await genLetterBytes(),
                'docx',
                [{ media: CLIP_PATH, after: '1' }],
                [],
                media,
            ),
        ).toEqual({ reason: expect.any(String) });
    });
});

describe('a new slide beside a slide with its own curtain (EC-771)', () => {
    test('no layout named: copied instead, the call handed back', async () => {
        // the hymn deck: a plain layout slide had come out dark words on
        // white among slides that each draw a curtain and white words
        expect(
            await runOnBytes(await genDeckBytes(CURTAIN), 'pptx', [
                { newSlide: true, title: 'Amen', to: 2 },
            ]),
        ).toEqual({
            reason:
                'Slide 1 draws its own picture "Curtain" behind its words, ' +
                "and a layout's slide has none of it. Copy that slide " +
                'instead ({slide: 1, duplicate: true, to: 2}) and then ' +
                "change the copy's lines by the ids the answer gives; or " +
                'name a `layout` for a plain slide.',
        });
        // the slide before it has none: no refusal for that
        expect(
            await runOnBytes(await genDeckBytes(CURTAIN), 'pptx', [
                { newSlide: true, title: 'Amen', to: 4 },
            ]),
        ).toEqual({
            reason:
                'The deck has no layouts to make a slide from: copy a slide ' +
                'instead ({slide, duplicate: true, to}).',
        });
    });
});

describe("a box's own look, and the words' shadow, spacing and bullets (2026-11-21)", () => {
    test('a dark see-through fill behind the words, outlined, the words in the middle', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            {
                slide: 1,
                box: 'TextBox 2',
                fill: 'black',
                transparency: 40,
                outline: 'white',
                valign: 'middle',
            },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            '"TextBox 2" on slide 1: filled black (#000000), 40% ' +
                'see-through, outlined white (#FFFFFF), its words at the ' +
                'middle.',
        ]);
        const xml = await readSlideXml(out, 1);
        expect(xml).toContain(
            '<p:spPr><a:solidFill><a:srgbClr val="000000"><a:alpha ' +
                'val="60000"/></a:srgbClr></a:solidFill><a:ln w="25400">' +
                '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>' +
                '</p:spPr><p:txBody><a:bodyPr anchor="ctr"/>',
        );
        // the title is left as it was
        expect(xml).toContain(
            '<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>',
        );
        // solid again, its colour kept; then no fill at all
        const solid = await runOnBytes(out.written, 'pptx', [
            { slide: 1, box: 'TextBox 2', transparency: 0 },
        ]);
        if ('reason' in solid) {
            throw new Error(solid.reason);
        }
        expect(await readSlideXml(solid, 1)).toContain(
            '<p:spPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill>',
        );
        const none = await runOnBytes(solid.written, 'pptx', [
            { slide: 1, box: 'TextBox 2', fill: 'none', outline: 'none' },
        ]);
        if ('reason' in none) {
            throw new Error(none.reason);
        }
        expect(await readSlideXml(none, 1)).toContain(
            '<p:spPr><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>',
        );
    });

    test('a picture darker and see-through, turned, sent to the back', async () => {
        const out = await runOnBytes(await genDeckBytes(CURTAIN), 'pptx', [
            {
                slide: 1,
                box: 'Curtain',
                brightness: 'darker',
                transparency: '20%',
                rotate: -90,
                order: 'back',
            },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            '"Curtain" on slide 1: 20% see-through, 30% darker, turned 270 ' +
                'degrees, sent to the back.',
        ]);
        const xml = await readSlideXml(out, 1);
        expect(xml).toContain(
            '<a:blip r:embed="rId1"><a:alphaModFix amt="80000"/><a:lum ' +
                'bright="-30000"/><a:extLst><a:ext uri="{x}"/></a:extLst>' +
                '</a:blip>',
        );
        expect(xml).toContain('<a:xfrm rot="16200000">');
        // drawn first: behind the title and the words
        expect(xml.indexOf('name="Curtain"')).toBeLessThan(
            xml.indexOf('name="Title 1"'),
        );
        // its own brightness again: the effect goes, the see-through stays
        const back = await runOnBytes(out.written, 'pptx', [
            { slide: 1, box: 'Curtain', brightness: 0 },
        ]);
        if ('reason' in back) {
            throw new Error(back.reason);
        }
        expect(await readSlideXml(back, 1)).toContain(
            '<a:blip r:embed="rId1"><a:alphaModFix amt="80000"/><a:extLst>',
        );
    });

    test('words sent behind a picture filling the slide are said to be hidden', async () => {
        const bytes = await genDeckBytes(CURTAIN);
        const out = await runOnBytes(bytes, 'pptx', [
            { slide: 1, box: 'TextBox 2', order: 'backward' },
            { slide: 1, box: 'Title 1', order: 'front' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed).toEqual([
            '"TextBox 2" on slide 1: sent one back. "TextBox 2" on slide 1 ' +
                'is behind "Curtain", which fills the slide: it will not ' +
                'show. Say so, and offer to bring it to the front.',
            '"Title 1" on slide 1: brought to the front.',
        ]);
        const xml = await readSlideXml(out, 1);
        const order = ['TextBox 2', 'Curtain', 'Title 1'].map((name) => {
            return xml.indexOf(`name="${name}"`);
        });
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        // already in front: said, nothing moved
        const again = await runOnBytes(out.written, 'pptx', [
            { slide: 1, box: 'Title 1', order: 'front' },
        ]);
        if ('reason' in again) {
            throw new Error(again.reason);
        }
        expect(again.changed).toEqual([
            '"Title 1" on slide 1 already was in front of every box: ' +
                'nothing moved.',
        ]);
        expect(await readSlideXml(again, 1)).toBe(xml);
    });

    test('a new text box given its fill with its words', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            {
                slide: 1,
                textBox: 'Welcome',
                at: [10, 10, 30, 10],
                fill: 'navy',
                color: 'white',
            },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed[1]).toBe(
            '"TextBox 3" on slide 1: filled navy (#000080).',
        );
        const xml = await readSlideXml(out, 1);
        const box = xml.slice(xml.indexOf('name="TextBox 3"'));
        expect(box).toContain('<a:solidFill><a:srgbClr val="000080"/>');
        expect(box).toContain('<a:srgbClr val="FFFFFF"/>');
    });

    test('the words: a shadow, more space between lines, bullets off and on', async () => {
        const out = await runOnBytes(await genDeckBytes(), 'pptx', [
            {
                slide: 1,
                box: 'TextBox 2',
                shadow: true,
                lineSpacing: '1.5',
                bullets: false,
            },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed.join(' ')).toContain(
            'a shadow behind the words, line spacing 1.5, no bullets',
        );
        const xml = await readSlideXml(out, 1);
        expect(xml).toContain(
            '<a:p><a:pPr marL="0" indent="0"><a:lnSpc><a:spcPct ' +
                'val="150000"/></a:lnSpc><a:buNone/></a:pPr><a:r><a:rPr ' +
                'lang="en-US"><a:effectLst><a:outerShdw',
        );
        // the title has none of it
        expect(xml).toContain('<a:rPr lang="en-US" b="1"/><a:t>Welcome');
        const on = await runOnBytes(out.written, 'pptx', [
            { slide: 1, box: 'TextBox 2', bullets: true, shadow: false },
        ]);
        if ('reason' in on) {
            throw new Error(on.reason);
        }
        const onXml = await readSlideXml(on, 1);
        expect(onXml).toContain(
            '<a:pPr marL="342900" indent="-342900"><a:lnSpc><a:spcPct ' +
                'val="150000"/></a:lnSpc><a:buChar char="&#8226;"/></a:pPr>' +
                '<a:r><a:rPr lang="en-US"><a:effectLst/></a:rPr>',
        );
    });

    test('a Word letter: a shadow and double line spacing', async () => {
        const out = await runOnBytes(await genLetterBytes(), 'docx', [
            { id: '3', shadow: true, lineSpacing: 'double' },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        const xml = (await out.pkg.readText('word/document.xml')) as string;
        expect(xml).toContain(
            '<w:p><w:pPr><w:spacing w:line="480" w:lineRule="auto"/>' +
                '<w:rPr><w:shadow/></w:rPr></w:pPr><w:r><w:rPr><w:shadow/>' +
                '</w:rPr><w:t>We meet on Sunday.',
        );
    });

    test('a Word letter: a line through, no link, no numbers', async () => {
        const letter = await genLetterBytes();
        const out = await runOnBytes(letter, 'docx', [
            { id: '3', strike: true },
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(
            (await out.pkg.readText('word/document.xml')) as string,
        ).toContain('<w:r><w:rPr><w:strike/></w:rPr><w:t>We meet on Sunday.');
        expect(
            await runOnBytes(letter, 'docx', [
                { id: '3', link: 'grace.church' },
            ]),
        ).toEqual({ reason: expect.stringContaining('A link in a Word file') });
        expect(
            await runOnBytes(letter, 'docx', [{ slideNumbers: true }]),
        ).toEqual({ reason: expect.stringContaining("are a deck's") });
    });

    test('refused: no box, a look a box does not take, a Word file', async () => {
        const run = async (changes: OfficeChangeType[]) => {
            return await runOnBytes(
                await genDeckBytes(CURTAIN),
                'pptx',
                changes,
            );
        };
        expect(await run([{ slide: 1, fill: 'black' }])).toEqual({
            reason: expect.stringContaining("are a box's own: name it"),
        });
        // beside the change that makes the box: the look belongs in it
        expect(
            await run([
                { slide: 1, brightness: -30 },
                { slide: 1, picture: '/pics/cross.png', at: [0, 0, 100, 100] },
            ]),
        ).toEqual({
            reason:
                'Give the look IN the change that adds the new picture -- ' +
                '{slide: 1, picture, at, brightness}: it has no name until ' +
                'it is made.',
        });
        expect(
            await run([{ slide: 1, box: 'TextBox 2', brightness: -30 }]),
        ).toEqual({
            reason:
                '"TextBox 2" on slide 1: it is a box of words: only a ' +
                'picture is made darker or lighter.',
        });
        expect(await run([{ slide: 1, box: 'Curtain', fill: 'red' }])).toEqual({
            reason: expect.stringContaining(
                'only a box of words or a shape takes a `fill`',
            ),
        });
        expect(
            await run([{ slide: 1, box: 'TextBox 2', transparency: 30 }]),
        ).toEqual({
            reason: expect.stringContaining(
                'no colour of its own to see through',
            ),
        });
        expect(
            await run([{ slide: 1, box: 'TextBox 2', order: 'sideways' }]),
        ).toEqual({
            reason: expect.stringContaining('`order` puts a box in front'),
        });
        expect(
            await run([
                {
                    slide: 1,
                    box: 'TextBox 2',
                    fill: 'black',
                    animation: 'fade',
                },
            ]),
        ).toEqual({ reason: expect.stringContaining('send it apart') });
        expect(
            await run([{ id: '1.2', words: 'Good', lineSpacing: 2 }]),
        ).toEqual({ reason: expect.stringContaining("are a whole line's") });
        const letter = await genLetterBytes();
        expect(
            await runOnBytes(letter, 'docx', [{ box: 'Title', fill: 'red' }]),
        ).toEqual({ reason: expect.stringContaining("a slide box's") });
        expect(await runOnBytes(letter, 'docx', [{ bullets: true }])).toEqual({
            reason: expect.stringContaining('made in Word'),
        });
    });
});
