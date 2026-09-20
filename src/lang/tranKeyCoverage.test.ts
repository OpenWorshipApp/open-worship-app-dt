import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

// Every `tran()` key the app can name statically must have a Khmer string.
// `tran()` THROWS on a missing key in dev -- a whole subtree blanks when the
// call is in a render -- and shows English in a packaged Khmer window, while
// the typecheck, eslint and every other test stay green (memory
// `tran-missing-key-throws-in-dev`). Before this test, five keys on failure
// paths had no Khmer string at all (EN-20), and nothing could have noticed.
//
// The dictionary is read as SOURCE, never imported: the module pulls in font
// files, a `.gz.bundle` and the open-lyric Khmer plugin.

const REPO_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
);
const SRC_DIR = path.join(REPO_DIR, 'src');
const KM_SOURCE_PATH = path.join(SRC_DIR, 'lang', 'data', 'km', 'index.ts');

// A `'…'`, `"…"` or a template literal with no `${}` -- one piece of a key.
const LITERAL_SOURCE =
    String.raw`(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|` + '`[^`$]*`)';
// `tran(` followed by literals joined with `+` and nothing else: ONE key at
// runtime, however many lines it is written over.
const LITERAL_CALL_PATTERN = new RegExp(
    String.raw`(?<![\w.$])tran\(\s*(` +
        LITERAL_SOURCE +
        String.raw`(?:\s*\+\s*` +
        LITERAL_SOURCE +
        String.raw`)*)\s*[,)]`,
    'g',
);
const CONSTANT_CALL_PATTERN = /(?<![\w.$])tran\(\s*([A-Z_][A-Z0-9_]*)\s*[,)]/g;
const CONSTANT_PATTERN =
    /\bconst\s+([A-Z_][A-Z0-9_]*)\s*=\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*;/g;

function evaluateLiteral(sourceText: string): unknown {
    // Only ever handed text these patterns matched: string literals, `+`,
    // and an object literal of strings. Nothing else reaches it.
    return new Function(`return (${sourceText});`)();
}

// Mirrors `sanitizeTranKey` in the km module; the test below holds the two
// together.
function sanitizeTranKey(key: string) {
    return key.trim().toLowerCase();
}

function readKhmerKeys() {
    const kmSource = readFileSync(KM_SOURCE_PATH, 'utf-8');
    const start = kmSource.indexOf('const dictionary = {');
    const end = kmSource.indexOf('function sanitizeTranKey');
    if (start === -1 || end === -1) {
        throw new Error('The km dictionary is no longer shaped as expected');
    }
    const objectText = kmSource
        .slice(start + 'const dictionary = '.length, end)
        .trim()
        .replace(/;$/, '');
    const dictionary = evaluateLiteral(objectText) as Record<string, string>;
    return {
        kmSource,
        keySet: new Set(Object.keys(dictionary).map(sanitizeTranKey)),
    };
}

function listSourceFiles(dirPath: string): string[] {
    return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            // The dictionaries themselves, not callers.
            return fullPath === path.join(SRC_DIR, 'lang', 'data')
                ? []
                : listSourceFiles(fullPath);
        }
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
            ? [fullPath]
            : [];
    });
}

type TranCallType = { key: string; at: string };

function toLineNumber(text: string, index: number) {
    return text.slice(0, index).split('\n').length;
}

function collectTranCalls(fileTextMap: Map<string, string>): TranCallType[] {
    const constantMap = new Map<string, Set<string>>();
    for (const text of fileTextMap.values()) {
        for (const match of text.matchAll(CONSTANT_PATTERN)) {
            const values = constantMap.get(match[1]) ?? new Set<string>();
            values.add(evaluateLiteral(match[2]) as string);
            constantMap.set(match[1], values);
        }
    }
    const calls: TranCallType[] = [];
    for (const [filePath, text] of fileTextMap) {
        const where = (index: number) => {
            return `${filePath}:${toLineNumber(text, index)}`;
        };
        for (const match of text.matchAll(LITERAL_CALL_PATTERN)) {
            calls.push({
                key: evaluateLiteral(match[1]) as string,
                at: where(match.index),
            });
        }
        for (const match of text.matchAll(CONSTANT_CALL_PATTERN)) {
            for (const key of constantMap.get(match[1]) ?? []) {
                calls.push({ key, at: where(match.index) });
            }
        }
    }
    return calls;
}

function readAppTranCalls() {
    const fileTextMap = new Map<string, string>();
    for (const filePath of listSourceFiles(SRC_DIR)) {
        const relativePath = path
            .relative(REPO_DIR, filePath)
            .split(path.sep)
            .join('/');
        fileTextMap.set(relativePath, readFileSync(filePath, 'utf-8'));
    }
    return collectTranCalls(fileTextMap);
}

describe('Khmer translation coverage', () => {
    test('every key the app names has a Khmer string', () => {
        const { keySet } = readKhmerKeys();
        const missingMap = new Map<string, string[]>();
        for (const { key, at } of readAppTranCalls()) {
            if (keySet.has(sanitizeTranKey(key))) {
                continue;
            }
            missingMap.set(key, [...(missingMap.get(key) ?? []), at]);
        }
        const missing = [...missingMap].map(([key, sites]) => {
            return `${JSON.stringify(key)} <- ${sites.join(', ')}`;
        });
        // Add each key to `src/lang/data/km/index.ts`, checking first for a
        // case or whitespace variant (the module throws on a duplicate).
        expect(missing).toEqual([]);
    });

    test('still finds the calls, so a green run means something', () => {
        // A pattern that broke would match nothing and pass; ~1 600 keys were
        // resolved when this test was written.
        expect(readAppTranCalls().length).toBeGreaterThan(1000);
        const { kmSource, keySet } = readKhmerKeys();
        expect(keySet.size).toBeGreaterThan(1000);
        expect(keySet.has(sanitizeTranKey('Clear Bible'))).toBe(true);
        // Unquoted identifier keys are keys too.
        expect(keySet.has(sanitizeTranKey('Sort'))).toBe(true);
        expect(kmSource).toContain('return key.trim().toLowerCase();');
    });

    // `toForegroundDragLabel` translates through a LOOKUP
    // (`tran(targetLabelMap[target])`), so the sweep above cannot see those
    // keys at all. They are the labels on every foreground row of a presenting
    // flow, and a missing one throws in a Khmer window while every other check
    // stays green -- exactly the hole this file exists to close.
    test('every foreground widget label has a Khmer string', () => {
        const { keySet } = readKhmerKeys();
        const source = readFileSync(
            path.join(
                SRC_DIR,
                'presenter-foreground',
                'foregroundDragHelpers.ts',
            ),
            'utf-8',
        );
        const start = source.indexOf('const targetLabelMap');
        const end = source.indexOf('};', start);
        if (start === -1 || end === -1) {
            throw new Error('`targetLabelMap` is no longer shaped as expected');
        }
        const labels = [
            ...source
                .slice(start, end)
                .matchAll(/:\s*('(?:[^'\\\n]|\\.)*')\s*,/g),
        ].map((match) => {
            return evaluateLiteral(match[1]) as string;
        });
        // A regex that stopped matching would pass an empty list.
        expect(labels).toContain('Countdown');
        expect(labels.length).toBeGreaterThanOrEqual(8);
        expect(
            labels.filter((label) => {
                return !keySet.has(sanitizeTranKey(label));
            }),
        ).toEqual([]);
    });

    test('reads a key the way tran() receives it', () => {
        const text = [
            "tran('Plain');",
            "tran(\n    'Split over ' +\n        'two lines',\n);",
            'tran(`Template`);',
            "const SOME_TITLE = 'From a constant';",
            'tran(SOME_TITLE);',
            // Neither of these is a static key.
            "tran('Joined ' + name);",
            'tran(`Built ${name}`);',
            // A method of the same name is not the app's `tran`.
            "other.tran('Not ours');",
        ].join('\n');
        const keys = collectTranCalls(new Map([['sample.ts', text]])).map(
            ({ key }) => key,
        );
        expect(keys).toEqual([
            'Plain',
            'Split over two lines',
            'Template',
            'From a constant',
        ]);
    });
});
