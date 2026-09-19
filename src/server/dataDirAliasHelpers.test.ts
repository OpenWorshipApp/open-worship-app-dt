import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { applyPatch, createPatch, parsePatch, reversePatch } from 'diff';
import { describe, expect, test } from 'vitest';

import {
    DATA_DIR_PATH_ALIAS,
    type DataDirAliasType,
    fromPortableText,
    genDataDirAlias,
    toPortableText,
} from './dataDirAliasHelpers';

// `$&` in both folder names: a replacement STRING would read it as a pattern.
const WINDOWS_DIR = String.raw`E:\open worship$&\data`;
const POSIX_DIR = '/Volumes/My USB$&/data';

type MachineType = {
    alias: DataDirAliasType;
    join: (...names: string[]) => string;
    toFileUrl: (filePath: string) => string;
};

function genMachine(isWindows: boolean, dirPath: string): MachineType {
    const pathUtils = isWindows ? path.win32 : path.posix;
    const toFileUrl = (filePath: string) => {
        return pathToFileURL(filePath, { windows: isWindows }).href;
    };
    return {
        alias: genDataDirAlias(dirPath, pathUtils.sep, toFileUrl),
        join: (...names) => {
            return pathUtils.join(dirPath, ...names);
        },
        toFileUrl,
    };
}

function genWindows(dirPath = WINDOWS_DIR) {
    return genMachine(true, dirPath);
}

function genPosix(dirPath = POSIX_DIR) {
    return genMachine(false, dirPath);
}

// Every form a data-folder path takes in a real file, on one machine.
function genDocumentText({ join, toFileUrl }: MachineType) {
    const songPath = join('documents', 'song.ows');
    return JSON.stringify(
        {
            filePath: join('videos', 'intro.mp4'),
            colorNotes: { [`${songPath}<id>2`]: '#ff0000' },
            collapsedKeys: [`slide|${songPath}|3|0`],
            background: toFileUrl(join('videos', 'My Intro.mp4')),
            // A note's content: JSON inside a JSON string.
            content: JSON.stringify({
                src: join('videos', 'a.mp4'),
                text: `see ${join('images', 'a b.png')}\nNext line`,
            }),
            twoPaths: `${join('a.png')} ${join('b.png')}`,
            markdown: `${join('a.png')} [link](${toFileUrl(join('b.png'))})`,
            // An agent backup of a note: three strings deep, counting this
            // document's own.
            backup: JSON.stringify({
                text: JSON.stringify({ src: join('c.mp4') }),
            }),
        },
        null,
        2,
    );
}

function genRawSettingText({ join }: MachineType) {
    return `${join('documents', 'song.ows')}<id>3`;
}

function moveText(text: string, writer: MachineType, reader: MachineType) {
    return fromPortableText(toPortableText(text, writer.alias), reader.alias);
}

describe('genDataDirAlias', () => {
    test('has the URL first and one pair per distinct escape level', () => {
        const windows = genWindows();
        expect(windows.alias.prefix).toBe(`${WINDOWS_DIR}\\`);
        expect(windows.alias.pairs[0]).toEqual([
            'file:///E:/open%20worship$&/data/',
            `file:///${DATA_DIR_PATH_ALIAS}/`,
        ]);
        expect(windows.alias.pairs).toHaveLength(5);
        expect(genPosix().alias.pairs).toHaveLength(2);
    });

    test('ends the prefix in exactly one separator', () => {
        expect(genWindows(`${WINDOWS_DIR}\\`).alias.prefix).toBe(
            genWindows().alias.prefix,
        );
        expect(genWindows('E:\\').alias.prefix).toBe('E:\\');
        expect(genPosix(`${POSIX_DIR}/`).alias.prefix).toBe(`${POSIX_DIR}/`);
    });
});

describe('same operating system', () => {
    test.each([
        ['Windows', genWindows],
        ['macOS/Linux', genPosix],
    ])('%s: stores no real prefix and reads back exactly', (_name, gen) => {
        const machine = gen();
        for (const text of [
            genDocumentText(machine),
            genRawSettingText(machine),
        ]) {
            const stored = toPortableText(text, machine.alias);
            expect(stored).toContain(DATA_DIR_PATH_ALIAS);
            for (const [real] of machine.alias.pairs) {
                expect(stored).not.toContain(real);
            }
            expect(fromPortableText(stored, machine.alias)).toBe(text);
        }
    });

    test('a data folder at a drive root reads back exactly', () => {
        const machine = genWindows('E:\\');
        const text = genDocumentText(machine);
        const stored = toPortableText(text, machine.alias);
        expect(stored).not.toContain('E:\\');
        expect(fromPortableText(stored, machine.alias)).toBe(text);
    });

    test('a data folder moved to another drive follows it', () => {
        const from = genWindows();
        const to = genWindows(String.raw`F:\church\data`);
        expect(moveText(genDocumentText(from), from, to)).toBe(
            genDocumentText(to),
        );
        expect(moveText(genRawSettingText(from), from, to)).toBe(
            genRawSettingText(to),
        );
    });
});

describe('another operating system', () => {
    test.each([
        ['Windows', 'macOS/Linux', genWindows, genPosix],
        ['macOS/Linux', 'Windows', genPosix, genWindows],
    ])(
        'a document written on %s reads exactly on %s',
        (_writerName, _readerName, genWriter, genReader) => {
            const writer = genWriter();
            const reader = genReader();
            const read = moveText(genDocumentText(writer), writer, reader);
            expect(read).toBe(genDocumentText(reader));
            const parsed = JSON.parse(read);
            expect(JSON.parse(parsed.content).src).toBe(
                reader.join('videos', 'a.mp4'),
            );
            expect(JSON.parse(JSON.parse(parsed.backup).text).src).toBe(
                reader.join('c.mp4'),
            );
        },
    );

    test.each([
        ['Windows', 'macOS/Linux', genWindows, genPosix],
        ['macOS/Linux', 'Windows', genPosix, genWindows],
    ])(
        'a raw setting written on %s reads exactly on %s',
        (_writerName, _readerName, genWriter, genReader) => {
            const writer = genWriter();
            const reader = genReader();
            expect(moveText(genRawSettingText(writer), writer, reader)).toBe(
                genRawSettingText(reader),
            );
            // A BOM before the path does not make it look quoted.
            expect(
                moveText(`\uFEFF${writer.join('lyrics')}`, writer, reader),
            ).toBe(`\uFEFF${reader.join('lyrics')}`);
        },
    );

    test('a Windows trailing separator becomes a POSIX one', () => {
        const writer = genWindows();
        const reader = genPosix();
        expect(moveText(`${writer.join('lyrics')}\\`, writer, reader)).toBe(
            `${reader.join('lyrics')}/`,
        );
    });

    test.each([
        ['Windows', 'macOS/Linux', genWindows, genPosix],
        ['macOS/Linux', 'Windows', genPosix, genWindows],
    ])(
        'undo history written on %s still applies on %s',
        (_writerName, _readerName, genWriter, genReader) => {
            const writer = genWriter();
            const reader = genReader();
            const documentText = genDocumentText(writer);
            const rawText = `${writer.join('a.png')}\nfirst\nsecond\n`;
            for (const [oldText, newText] of [
                [documentText, documentText.replace('intro.mp4', 'outro.mp4')],
                [rawText, rawText.replace('second', 'second changed')],
            ]) {
                // What `EditingHistoryManager` keeps: the new state in full,
                // and the patch back to the old one.
                const storedHead = toPortableText(newText, writer.alias);
                const storedPatch = toPortableText(
                    createPatch(
                        writer.join('documents', 'song.ows'),
                        oldText,
                        newText,
                    ),
                    writer.alias,
                );
                const head = fromPortableText(storedHead, reader.alias);
                const reversed = reversePatch(
                    parsePatch(fromPortableText(storedPatch, reader.alias)),
                );
                const undone = applyPatch(
                    head,
                    Array.isArray(reversed) ? reversed[0] : reversed,
                );
                expect(undone).toBe(moveText(oldText, writer, reader));
            }
        },
    );
});

describe('left alone', () => {
    test('text with no alias is returned as it is', () => {
        const { alias } = genWindows();
        const text = 'no path here';
        expect(fromPortableText(text, alias)).toBe(text);
        expect(toPortableText(text, alias)).toBe(text);
        expect(fromPortableText('cost $DATA_DIR_PATH today', alias)).toBe(
            'cost $DATA_DIR_PATH today',
        );
        expect(fromPortableText('$DATA_DIR_PATHx', alias)).toBe(
            '$DATA_DIR_PATHx',
        );
    });

    test('a sibling folder and a different case are not the data folder', () => {
        const { alias } = genWindows(String.raw`E:\open-worship-data`);
        const siblingPath = String.raw`E:\open-worship-data-dev\x.ows`;
        for (const text of [
            siblingPath,
            JSON.stringify({ filePath: siblingPath }),
            String.raw`e:\open-worship-data\x.ows`,
        ]) {
            expect(toPortableText(text, alias)).toBe(text);
        }
    });

    test('many foreign paths on one long line read in linear time', () => {
        const { alias } = genWindows();
        const text =
            'x'.repeat(1_000_000) +
            `${DATA_DIR_PATH_ALIAS}/a.png `.repeat(5_000);
        const startedAt = performance.now();
        const read = fromPortableText(text, alias);
        expect(performance.now() - startedAt).toBeLessThan(1_000);
        expect(read.endsWith(`${WINDOWS_DIR}\\a.png `)).toBe(true);
    });
});
