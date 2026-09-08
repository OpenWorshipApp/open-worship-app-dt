import { describe, expect, test } from 'vitest';

import {
    ATTACHMENT_ONLY_QUESTION,
    checkIsReadableTextFile,
    dropAttachmentData,
    genElementAttachment,
    genTextAttachment,
    getAttachmentData,
    putAttachmentData,
    toAskedOfModel,
    toAttachmentNote,
    toAttachmentText,
    toBotImage,
    toBotImages,
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
            label: 'Clear Bible',
            inPanel: 'Screen Preview',
            where: 'at the bottom right of the window',
            isVisible: true,
            isEnabled: false,
            selector: 'button[title="Clear Bible [F9]"]',
        });
        expect(attachment.name).toBe('Clear Bible');
        expect(attachment.selector).toBe('button[title="Clear Bible [F9]"]');
        const lines = (attachment.summary ?? '').split('\n');
        expect(lines[1]).toContain('Clear Bible');
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
