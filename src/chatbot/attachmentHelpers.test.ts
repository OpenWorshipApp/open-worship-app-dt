import { describe, expect, test } from 'vitest';

import { REPORT_FILE_MAX_BYTES } from '../../electron/customLlmProtocol';
import {
    ATTACHMENT_ONLY_QUESTION,
    FILE_ONLY_QUESTION,
    MAX_CARRIED_FILE_BYTES,
    checkCanAttachFileName,
    checkIsFileAttachment,
    findOpenFileAttachments,
    getAttachmentPages,
    putAttachmentPages,
    checkIsCarriedFileName,
    checkIsReadableTextFile,
    dropAttachmentData,
    genElementAttachment,
    genFileAttachment,
    genTextAttachment,
    numberAttachments,
    toAttachedText,
    getAttachmentData,
    putAttachmentData,
    toAskedOfModel,
    toAttachmentLegend,
    toAttachmentNote,
    toAttachmentText,
    toBotImage,
    toBotImages,
    toImageMediaType,
    toReusableAttachments,
} from './attachmentHelpers';

// The one rule this module exists to keep: bytes live in memory, bounded, for
// as long as the window does -- and the thing that goes anywhere else is a
// handful of words describing them.
describe('the live store', () => {
    test('hands back what it was given, and forgets on request', () => {
        putAttachmentData('a1', 'data:image/png;base64,AAAA');
        expect(getAttachmentData('a1')).toBe('data:image/png;base64,AAAA');
        dropAttachmentData('a1');
        expect(getAttachmentData('a1')).toBeNull();
    });

    test('drops the oldest rather than growing', () => {
        for (let index = 0; index < 12; index++) {
            putAttachmentData(
                `n${index.toString()}`,
                'data:image/png;base64,AA',
            );
        }
        expect(getAttachmentData('n0')).toBeNull();
        // ...and never the one just added: the caller is about to send it.
        expect(getAttachmentData('n11')).not.toBeNull();
    });

    test('re-putting an id does not count its old size twice', () => {
        putAttachmentData('same', 'data:image/png;base64,AAAA');
        putAttachmentData('same', 'data:image/png;base64,BBBB');
        expect(getAttachmentData('same')).toBe('data:image/png;base64,BBBB');
        dropAttachmentData('same');
    });
});

describe('toBotImage', () => {
    test('splits a data URL the way Anthropic wants it', () => {
        expect(toBotImage('data:image/jpeg;base64,ZZZZ')).toEqual({
            mediaType: 'image/jpeg',
            data: 'ZZZZ',
        });
    });

    test('refuses anything that is not a base64 image', () => {
        expect(toBotImage('https://example.com/a.png')).toBeNull();
        expect(toBotImage('data:text/plain;base64,AAAA')).toBeNull();
        expect(toBotImage('')).toBeNull();
    });

    // "Session only" is not a slogan: a tab re-asked after a reload has the
    // description and not the picture, and the ask must simply go without it.
    test('an image whose bytes have gone is skipped rather than sent empty', () => {
        expect(
            toBotImages([
                {
                    id: 'gone',
                    kind: 'image',
                    name: 'my screen',
                    mimeType: 'image/png',
                    byteSize: 10,
                },
            ]),
        ).toEqual([]);
    });
});

describe('what the transcript and the history say', () => {
    test('names what was attached, in words a volunteer would use', () => {
        expect(
            toAttachmentNote([
                {
                    id: 'a',
                    kind: 'image',
                    name: 'my screen',
                    mimeType: 'image/png',
                    byteSize: 1,
                },
                {
                    id: 'b',
                    kind: 'element',
                    name: 'Bible Lookup',
                    mimeType: 'application/x-owa-element',
                    byteSize: 0,
                },
            ]),
        ).toBe('(with a picture and the "Bible Lookup" control attached)');
    });

    test('counts pictures rather than listing them', () => {
        const image = {
            kind: 'image' as const,
            name: 'x',
            mimeType: 'image/png',
            byteSize: 1,
        };
        expect(
            toAttachmentNote([
                { ...image, id: '1' },
                { ...image, id: '2' },
                { ...image, id: '3' },
            ]),
        ).toBe('(with 3 pictures attached)');
    });

    test('says nothing when nothing was attached', () => {
        expect(toAttachmentNote([])).toBe('');
    });
});

describe('what the model is handed', () => {
    test('a text file arrives named, and a long one says it was cut', () => {
        const short = genTextAttachment('notes.txt', 'line one\nline two');
        expect(short.summary).toContain('"notes.txt"');
        expect(short.summary).toContain('line two');

        const long = genTextAttachment(
            'big.log',
            Array.from({ length: 4000 }, () => {
                return 'a line of log';
            }).join('\n'),
        );
        expect(long.summary).toContain(
            'the rest of this file was not included',
        );
        expect(long.byteSize).toBeGreaterThan(long.summary?.length ?? 0);
    });

    test('a pointed-at control is described in words, selector last', () => {
        const attachment = genElementAttachment({
            label: 'Clear Long Text',
            inPanel: 'Screen Preview',
            where: 'at the bottom right of the window',
            isVisible: true,
            isEnabled: false,
            selector: 'button[title="Clear Long Text [F9]"]',
        });
        expect(attachment.name).toBe('Clear Long Text');
        expect(attachment.selector).toBe(
            'button[title="Clear Long Text [F9]"]',
        );
        const lines = (attachment.summary ?? '').split('\n');
        expect(lines[1]).toContain('Clear Long Text');
        expect(lines).toContain('- it is greyed out');
        // The selector is there for the model's own tool calls and is told, in
        // as many words, not to come back out at the user.
        expect(lines[lines.length - 1]).toContain('never to');
    });

    test('a control with no words on it still says so', () => {
        const attachment = genElementAttachment({ label: '' });
        expect(attachment.name).toBe('the control they pointed at');
        expect(attachment.summary).toContain('(no words on it)');
    });

    test('only the text kinds contribute text', () => {
        expect(
            toAttachmentText([
                {
                    id: 'a',
                    kind: 'image',
                    name: 'x',
                    mimeType: 'image/png',
                    byteSize: 1,
                },
            ]),
        ).toBe('');
    });
});

// A picture with an empty box is a whole question, and the wire has to carry
// one: Anthropic refuses an empty text block outright, and the window read that
// refusal back to the user as a broken provider -- after the assistant had just
// asked them for the screenshot.
describe('toAskedOfModel', () => {
    const picture = {
        id: 'p',
        kind: 'image' as const,
        name: 'my screen',
        mimeType: 'image/png',
        byteSize: 10,
    };

    test('a picture on its own still asks something', () => {
        const asked = toAskedOfModel('', [picture]);
        expect(asked).toBe(ATTACHMENT_ONLY_QUESTION);
        expect(asked.trim().length).toBeGreaterThan(0);
    });

    test('their own words win whenever they typed any', () => {
        expect(toAskedOfModel('  what is this?  ', [picture])).toBe(
            'what is this?',
        );
    });

    test('what an attachment says in words is folded in after them', () => {
        const file = genTextAttachment('notes.txt', 'line one');
        const asked = toAskedOfModel('read this', [file]);
        expect(asked.startsWith('read this')).toBe(true);
        expect(asked).toContain('"notes.txt"');
    });

    test('a file with no words typed is asked as its own words', () => {
        const file = genTextAttachment('notes.txt', 'line one');
        const asked = toAskedOfModel('', [file]);
        expect(asked).not.toBe(ATTACHMENT_ONLY_QUESTION);
        expect(asked).toContain('"notes.txt"');
    });

    // An empty box with nothing clipped to it is not a question, and must not
    // be dressed up as one -- the window turns it away before this is reached.
    test('nothing at all stays nothing', () => {
        expect(toAskedOfModel('   ', [])).toBe('');
    });
});

describe('checkIsReadableTextFile', () => {
    test('takes what can be read as words', () => {
        expect(
            checkIsReadableTextFile({ name: 'a.md', type: '' } as File),
        ).toBe(true);
        expect(
            checkIsReadableTextFile({ name: 'a', type: 'text/plain' } as File),
        ).toBe(true);
    });

    // Refused by NAME rather than sent as mojibake: a model handed the first
    // 16 KB of a .docx answers about the bytes instead of saying it cannot
    // read it.
    test('refuses what cannot', () => {
        expect(
            checkIsReadableTextFile({
                name: 'a.docx',
                type: 'application/vnd.openxmlformats',
            } as File),
        ).toBe(false);
    });
});

// The chip is read by a person; the matcher's `label` is not written for one.
describe('the name on an element chip', () => {
    test('does not repeat a control that names itself twice', () => {
        // `labelOf` joins every way an element is named, so the settings
        // button -- whose text and aria-label are the same word -- comes back
        // as "Setting Setting".
        expect(
            genElementAttachment({
                label: 'Setting Setting',
                labelParts: ['Setting', 'Setting'],
            }).name,
        ).toBe('Setting');
    });

    test('takes the name, not the tooltip explaining it', () => {
        expect(
            genElementAttachment({
                label: 'Bible Lookup Open bible lookup popup [Ctrl+B]',
                labelParts: [
                    'Bible Lookup',
                    'Open bible lookup popup [Ctrl+B]',
                ],
            }).name,
        ).toBe('Bible Lookup');
    });

    test('falls back to the joined label when there are no parts', () => {
        expect(genElementAttachment({ label: 'Videos' }).name).toBe('Videos');
    });
});

// The user: _make sure screenshot and element selection have uuid
// information to the window to let mcp know_.
describe('the window a picture or a pointed-at control came from', () => {
    const SETTING = {
        id: 'SETTING-ID',
        page: 'setting.html?uuid=setting',
        label: 'Settings',
        isMain: false,
    };
    const MAIN = {
        id: 'MAIN-ID',
        page: 'presenter.html',
        label: 'Presenter',
        isMain: true,
    };

    test('is kept on the attachment and said in the words the model reads', () => {
        const pointed = genElementAttachment(
            { label: 'Apply Settings', selector: '#apply' },
            SETTING,
        );
        expect(pointed.window).toEqual(SETTING);
        expect(pointed.summary).toContain(
            'The user pointed at a control in the Settings window.',
        );
        // No launch-bound id in the words that are kept with the message.
        expect(pointed.summary).not.toContain('SETTING-ID');
        expect(genElementAttachment({ label: 'x' }).window).toBeUndefined();
        expect(genElementAttachment({ label: 'x' }).summary).toContain(
            'in the app window.',
        );
    });

    test('tells the model the page its tools reach each window by, NOW', () => {
        const attachments = [
            {
                ...genElementAttachment({ label: 'Apply Settings' }, SETTING),
                number: 1,
            },
            {
                id: 'gone-shot',
                kind: 'image' as const,
                name: 'my screen',
                mimeType: 'image/png',
                byteSize: 4,
                number: 2,
                window: MAIN,
            },
        ];
        // Its stored id when nobody says otherwise.
        expect(toAttachmentLegend(attachments)).toContain(
            '[1] the control "Apply Settings" they pointed at, in the ' +
                'Settings window -- for your tool calls about it, page ' +
                '"SETTING-ID"',
        );
        // After a relaunch: the popup by its page and uuid, the main window
        // by no page at all (the tools' default).
        const relaunched = toAttachmentLegend(attachments, (takenIn) => {
            return takenIn.isMain ? undefined : takenIn.page;
        });
        expect(relaunched).toContain('page "setting.html?uuid=setting"');
        // ...with no page to pass: the tools' default IS the main window.
        expect(
            relaunched.endsWith(
                '[2] a picture called "my screen", no longer attached, in ' +
                    'the main window (on the Presenter)',
            ),
        ).toBe(true);
        expect(
            toAskedOfModel('what is this?', attachments, () => {
                return 'NOW-ID';
            }),
        ).toContain('page "NOW-ID"');
    });

    test('rides into the history by name, never by id', () => {
        const note = toAttachmentNote([
            {
                ...genElementAttachment({ label: 'Apply Settings' }, SETTING),
                number: 1,
            },
        ]);
        expect(note).toBe(
            '(with the "Apply Settings" control [1] in the Settings window attached)',
        );
    });
});

// "Attachment should have id like 1 2 3 ... so user can mention in the
// text" -- said over four chips all called "my screen".
describe('the number an attachment is called by', () => {
    const genPicture = (id: string, number?: number) => {
        return {
            id,
            kind: 'image' as const,
            name: 'my screen',
            mimeType: 'image/png',
            byteSize: 4,
            ...(number === undefined ? {} : { number }),
        };
    };

    test('is the next one of its tab, and is never changed afterwards', () => {
        const first = numberAttachments(
            [genPicture('p1'), genPicture('p2'), genPicture('p3')],
            [],
        );
        expect(first.map((one) => one.number)).toEqual([1, 2, 3]);
        // The middle chip taken off: the others keep theirs, so "in 3"
        // still means the picture it meant, and the next one is 4.
        const left = [first[0], first[2]];
        expect(
            numberAttachments([genPicture('p4')], left).map(
                (one) => one.number,
            ),
        ).toEqual([4]);
        // The LAST chip taken off: its number is free again.
        expect(
            numberAttachments([genPicture('p5')], [first[0], first[1]])[0]
                .number,
        ).toBe(3);
        // One past whatever the tab's earlier questions carried.
        expect(
            numberAttachments(
                [genPicture('p6'), genPicture('p7')],
                [genPicture('old', 7), genPicture('older')],
            ).map((one) => one.number),
        ).toEqual([8, 9]);
        // One that has a number keeps it (asked again with the same chips).
        expect(
            numberAttachments([genPicture('p8', 2), genPicture('p9')], []).map(
                (one) => one.number,
            ),
        ).toEqual([2, 3]);
        // Nothing handed in is changed in place.
        expect(genPicture('p1').number).toBeUndefined();
    });

    // A model is handed pictures with no names on them at all.
    test('is told to the model, each picture by its order among those sent', () => {
        putAttachmentData('n1', 'data:image/png;base64,AAAA');
        putAttachmentData('n3', 'data:image/png;base64,BBBB');
        const attachments = [
            genPicture('n1', 1),
            { ...genTextAttachment('notes.md', '# hi'), number: 2 },
            genPicture('n3', 3),
            // Its bytes went with an earlier window.
            genPicture('gone', 4),
            { ...genElementAttachment({ label: 'Clear All' }), number: 5 },
            { ...genFileAttachment('order.pdf', 2048, '/d/o.pdf'), number: 6 },
        ];
        expect(toAttachmentLegend(attachments)).toBe(
            'Each thing the user attached shows a number, and they may call ' +
                'it by that number ("in 2 the button is missing"):\n' +
                '[1] a picture called "my screen" -- the 1st picture attached here\n' +
                '[2] the file "notes.md"\n' +
                '[3] a picture called "my screen" -- the 2nd picture attached here\n' +
                '[4] a picture called "my screen", no longer attached\n' +
                '[5] the control "Clear All" they pointed at\n' +
                '[6] the file "order.pdf"',
        );
        // The pictures really are sent in that order.
        expect(toBotImages(attachments).map((one) => one.data)).toEqual([
            'AAAA',
            'BBBB',
        ]);
        const asked = toAskedOfModel('in 3 the button is missing', attachments);
        expect(asked.startsWith('in 3 the button is missing\n\n')).toBe(true);
        expect(asked.endsWith('[6] the file "order.pdf"')).toBe(true);
        // A bare picture is still asked as the question it is.
        expect(toAskedOfModel('', [genPicture('n1', 1)])).toBe(
            `${ATTACHMENT_ONLY_QUESTION}\n\n` +
                'Each thing the user attached shows a number, and they may ' +
                'call it by that number ("in 2 the button is missing"):\n' +
                '[1] a picture called "my screen" -- the 1st picture attached here',
        );
        dropAttachmentData('n1');
        dropAttachmentData('n3');
    });

    test('says nothing where nothing is numbered', () => {
        expect(toAttachmentLegend([genPicture('x')])).toBe('');
        expect(toAttachmentLegend([])).toBe('');
        expect(toAskedOfModel('what is this?', [genPicture('x')])).toBe(
            'what is this?',
        );
    });

    // The line that rides in the history of every later question.
    test('is in what the transcript says was attached', () => {
        expect(
            toAttachmentNote([
                genPicture('a', 1),
                genPicture('b', 2),
                { ...genTextAttachment('notes.md', 'x'), number: 3 },
            ]),
        ).toBe(
            '(with picture [1], picture [2] and the file "notes.md" [3] attached)',
        );
        expect(toAttachmentNote([genPicture('a', 4)])).toBe(
            '(with picture [4] attached)',
        );
        // Unnumbered, as it always read.
        expect(toAttachmentNote([genPicture('a'), genPicture('b')])).toBe(
            '(with 2 pictures attached)',
        );
    });
});

// "And accept files like markdown pdf": a PDF goes along with a problem
// report for the people who can open it.
describe('a file that is carried, not read', () => {
    test('is a PDF, by its name', () => {
        expect(checkIsCarriedFileName('Order of Service.PDF')).toBe(true);
        expect(checkIsCarriedFileName('order.pdf.exe')).toBe(false);
        expect(checkIsCarriedFileName('notes.md')).toBe(false);
        expect(checkIsCarriedFileName('song.docx')).toBe(false);
    });

    test('holds where it is and never what is in it', () => {
        const attachment = genFileAttachment(
            'order.pdf',
            240 * 1024,
            'C:/docs/order.pdf',
        );
        expect(attachment).toMatchObject({
            kind: 'file',
            name: 'order.pdf',
            mimeType: 'application/pdf',
            byteSize: 240 * 1024,
            filePath: 'C:/docs/order.pdf',
        });
        // No bytes are held for it: it is read at the press that sends it.
        expect(getAttachmentData(attachment.id)).toBeNull();
        // It has no words of its own to preview or to send in their place.
        expect(toAttachedText(attachment)).toBe('');
    });

    // An answer must never pretend to have read it.
    test('tells the model it is there and cannot be opened', () => {
        const attachment = genFileAttachment('order.pdf', 240 * 1024, '/d/o');
        const asked = toAskedOfModel('why does this print wrong?', [
            attachment,
        ]);
        expect(asked).toContain('why does this print wrong?');
        expect(asked).toContain('a file called "order.pdf" (a PDF, 240 KB)');
        expect(asked).toContain('You cannot read what is inside it');
        expect(toAttachmentNote([attachment])).toBe(
            '(with the file "order.pdf" attached)',
        );
        expect(toBotImages([attachment])).toEqual([]);
    });

    test('is held to the size a report carries in one file', () => {
        expect(MAX_CARRIED_FILE_BYTES).toBe(REPORT_FILE_MAX_BYTES);
    });
});

// 2026-10-17, the user, with a picture of the assistant saying it could not
// open PDF files: _convert to images for pdf pages then send image as
// attachment_.
describe('a PDF read as its pages', () => {
    const PAGE_1 = 'data:image/png;base64,UEFHRTE=';
    const PAGE_2 = 'data:image/jpeg;base64,UEFHRTI=';

    test('sends its pages as pictures, in order, among the others', () => {
        const pdf = {
            ...genFileAttachment('LUK.6.pdf', 300 * 1024, '/r/LUK.6.pdf', 2),
            number: 2,
        };
        putAttachmentPages(pdf.id, [PAGE_1, PAGE_2]);
        putAttachmentData('shot', 'data:image/png;base64,U0hPVA==');
        const shot = {
            id: 'shot',
            kind: 'image' as const,
            name: 'my screen',
            mimeType: 'image/png',
            byteSize: 4,
            number: 1,
        };
        expect(toBotImages([shot, pdf]).map((one) => one.data)).toEqual([
            'U0hPVA==',
            'UEFHRTE=',
            'UEFHRTI=',
        ]);
        // ...and the legend counts them with the others, so "page 2" and
        // "the 3rd picture" are the same picture to the model.
        expect(toAttachmentLegend([shot, pdf])).toContain(
            '[2] the file "LUK.6.pdf" -- its pages 1 to 2 are the 2nd to ' +
                '3rd pictures attached here',
        );
        const asked = toAskedOfModel('what does page 2 say?', [pdf]);
        expect(asked).toContain('(a PDF, 2 pages, 300 KB)');
        expect(asked).toContain('All 2 of its pages are attached as pictures');
        expect(asked).not.toContain('You cannot read what is inside it');
        // A model the pictures do not go to is never told they are there.
        expect(toAttachmentText([pdf], false)).toContain(
            'You cannot read what is inside it',
        );
        dropAttachmentData(pdf.id);
        dropAttachmentData('shot');
    });

    test('says which pages the model was NOT shown', () => {
        const pdf = genFileAttachment('book.pdf', 2048, '/r/book.pdf', 40);
        putAttachmentPages(pdf.id, [PAGE_1, PAGE_2]);
        expect(toAttachmentText([pdf])).toContain(
            'Its first 2 pages are attached as pictures, in order; pages 3 ' +
                'to 40 are NOT',
        );
        dropAttachmentData(pdf.id);
        // Gone with the window: back to the sentence that it cannot be read.
        expect(toAttachmentText([pdf])).toContain(
            'You cannot read what is inside it',
        );
        expect(toBotImages([pdf])).toEqual([]);
    });

    test('is held and let go of WHOLE, as one attachment', () => {
        putAttachmentPages('doc', [PAGE_1, PAGE_2]);
        expect(getAttachmentPages('doc')).toEqual([PAGE_1, PAGE_2]);
        expect(getAttachmentData('doc')).toBe(PAGE_1);
        // Eight more pictures push the oldest out -- the PDF, all of it.
        for (let index = 0; index < 8; index++) {
            putAttachmentData(`p${index}`, PAGE_1);
        }
        expect(getAttachmentPages('doc')).toEqual([]);
        for (let index = 0; index < 8; index++) {
            dropAttachmentData(`p${index}`);
        }
    });

    test('is a file the assistant can be handed, as are its siblings', () => {
        expect(checkCanAttachFileName('LUK.6.pdf')).toBe(true);
        expect(checkCanAttachFileName('LUK.0.json')).toBe(true);
        expect(checkCanAttachFileName('Default.own')).toBe(true);
        expect(checkCanAttachFileName('notes.markdown')).toBe(true);
        expect(checkCanAttachFileName('map.jpg')).toBe(true);
        // Nothing the window would then refuse.
        expect(checkCanAttachFileName('sermon.docx')).toBe(false);
        expect(checkCanAttachFileName('slides.pptx')).toBe(false);
        expect(checkCanAttachFileName('song.mp4')).toBe(false);
    });
});

describe('a file the tab is still asking about', () => {
    const pdf = {
        ...genFileAttachment('LUK.6.pdf', 100, '/r/LUK.6.pdf', 3),
        number: 1,
    };
    const note = {
        ...genTextAttachment('Default.own', 'Note: Unnamed', '/r/Default.own'),
        number: 2,
    };
    const shot = {
        id: 'shot',
        kind: 'image' as const,
        name: 'my screen',
        mimeType: 'image/png',
        byteSize: 4,
        window: {
            id: 'main',
            page: 'presenter.html',
            label: 'Presenter',
            isMain: true,
        },
    };

    test('is the last file asked with, until another is', () => {
        const messages = [
            { id: 1, author: 'you', text: 'about this', attachments: [pdf] },
            { id: 2, author: 'bot', text: 'It is Luke 6.' },
            { id: 3, author: 'you', text: 'and verse 27?' },
        ];
        expect(findOpenFileAttachments(messages)).toEqual([pdf]);
        expect(
            findOpenFileAttachments([
                ...messages,
                { id: 4, author: 'you', text: 'now this', attachments: [note] },
            ]),
        ).toEqual([note]);
    });

    test('is never a picture of the app, which was of the app as it WAS', () => {
        const messages = [
            { id: 1, author: 'you', text: 'x', attachments: [pdf] },
            { id: 2, author: 'you', text: 'y', attachments: [shot] },
        ];
        expect(findOpenFileAttachments(messages)).toEqual([pdf]);
        expect(checkIsFileAttachment(shot)).toBe(false);
    });

    test('stops at its × and opens again with the next file', () => {
        const messages = [
            { id: 1, author: 'you', text: 'x', attachments: [pdf] },
            { id: 2, author: 'bot', text: 'ok' },
        ];
        expect(findOpenFileAttachments(messages, 2)).toEqual([]);
        expect(
            findOpenFileAttachments(
                [
                    ...messages,
                    { id: 3, author: 'you', text: 'y', attachments: [note] },
                ],
                2,
            ),
        ).toEqual([note]);
    });

    test('with nothing typed, is asked about rather than searched for faults', () => {
        const asked = toAskedOfModel('', [note]);
        expect(asked.startsWith(FILE_ONLY_QUESTION)).toBe(true);
        expect(asked).toContain('Note: Unnamed');
        // A picture of the app is still the question it always was.
        putAttachmentData('shot', 'data:image/png;base64,AAAA');
        expect(toAskedOfModel('', [shot])).toBe(ATTACHMENT_ONLY_QUESTION);
        dropAttachmentData('shot');
    });
});

describe('what a question is asked again with', () => {
    test('keeps a file, a control and a held picture; drops a picture let go of', () => {
        const pdf = {
            id: 'r-pdf',
            kind: 'file' as const,
            name: 'MAT.18.pdf',
            mimeType: 'application/pdf',
            byteSize: 10,
            filePath: 'C:/Resources/pdf/MAT.18.pdf',
            number: 1,
        };
        const control = {
            id: 'r-el',
            kind: 'element' as const,
            name: 'Clear All',
            mimeType: 'text/plain',
            byteSize: 0,
            summary: 'button Clear All',
        };
        const held = {
            id: 'r-held',
            kind: 'image' as const,
            name: 'my screen',
            mimeType: 'image/png',
            byteSize: 4,
        };
        const gone = { ...held, id: 'r-gone' };
        putAttachmentData('r-held', 'data:image/png;base64,AAAA');
        // The same objects, numbers and all: it is the same file.
        expect(toReusableAttachments([pdf, control, held, gone])).toEqual([
            pdf,
            control,
            held,
        ]);
        expect(toReusableAttachments(undefined)).toEqual([]);
        dropAttachmentData('r-held');
    });
});

// The smaller rules the cases above leave unrun.
describe('the rest of what the model is told', () => {
    test('a picture off the disk is given its media type by its name', () => {
        expect(toImageMediaType('Stage.JPG')).toBe('image/jpeg');
        expect(toImageMediaType('stage.jpeg')).toBe('image/jpeg');
        expect(toImageMediaType('stage.webp')).toBe('image/webp');
        expect(toImageMediaType('notes.txt')).toBeNull();
    });

    test('a carried file has no words of its own to show in the preview', () => {
        const pdf = genFileAttachment('LUK.6.pdf', 10, 'C:/LUK.6.pdf');
        expect(pdf.summary).toContain('LUK.6.pdf');
        expect(toAttachedText(pdf)).toBe('');
    });

    test('a pointed-at control says when it is hidden or greyed out', () => {
        const onHover = genElementAttachment({
            label: 'Bible Properties',
            isVisible: false,
            showsOnHover: true,
            isEnabled: false,
        });
        expect(onHover.summary).toContain(
            '- it only shows while the mouse is over that part of the window',
        );
        expect(onHover.summary).toContain('- it is greyed out');
        const offScreen = genElementAttachment({
            label: 'Clear All',
            isVisible: false,
        });
        expect(offScreen.summary).toContain(
            '- it is not on screen at the moment',
        );
        expect(offScreen.summary).not.toContain('greyed out');
    });

    test('an empty page list holds nothing, and lets go of what was held', () => {
        putAttachmentPages('p-empty', ['data:image/png;base64,AAAA']);
        putAttachmentPages('p-empty', []);
        expect(getAttachmentPages('p-empty')).toEqual([]);
        expect(getAttachmentData('p-empty')).toBeNull();
    });

    test('a one-page PDF is counted as one picture among the others', () => {
        const pdf = {
            ...genFileAttachment('one.pdf', 10, 'C:/one.pdf', 1),
            number: 1,
        };
        putAttachmentPages(pdf.id, ['data:image/png;base64,AAAA']);
        expect(toAttachmentLegend([pdf])).toContain(
            '[1] the file "one.pdf" -- its page is the 1st picture attached here',
        );
        dropAttachmentData(pdf.id);
    });

    test('the open files are those of the last question that had one', () => {
        const pdf = genFileAttachment('LUK.6.pdf', 10, 'C:/LUK.6.pdf');
        const messages = [
            { id: 1, author: 'you' as const, attachments: [pdf] },
            { id: 2, author: 'bot' as const },
            // A later question with no file leaves the file open.
            { id: 3, author: 'you' as const, attachments: [] },
        ];
        expect(findOpenFileAttachments(messages as any)).toEqual([pdf]);
        // Closed by the × after it was asked about.
        expect(findOpenFileAttachments(messages as any, 1)).toEqual([]);
        // No question carried a file: nothing is open.
        expect(
            findOpenFileAttachments([
                { id: 1, author: 'you' },
                { id: 2, author: 'bot' },
            ]),
        ).toEqual([]);
    });

    test('a text file shows its words without the line for the model', () => {
        const text = genTextAttachment('order.txt', 'Hymn 1\nHymn 2');
        expect(toAttachedText(text)).toBe('Hymn 1\nHymn 2');
        // A summary written some other way is shown as it is.
        expect(toAttachedText({ ...text, summary: 'other words' })).toBe(
            'other words',
        );
    });
});
