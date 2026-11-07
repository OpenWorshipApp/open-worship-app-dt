// The Khmer cases of `tools/owa-devtools-mcp/tran.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { pathToFileURL as toSourceUrl } from 'node:url';
import { join as joinSourcePath } from 'node:path';
const SOURCE_URL = toSourceUrl(joinSourcePath(process.cwd(), 'tools/owa-devtools-mcp/tran.test.mjs')).href;
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readSourceDictionary } from '../../../../../../../../tools/owa-devtools-mcp/langPacks.mjs';
import {
    listTranLanguages,
    listTranTemplateKeys,
    loadTranBundle,
    resolveTranTemplates,
    tranText,
} from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';

const HERE = path.dirname(fileURLToPath(SOURCE_URL));
const REPO_ROOT = path.join(HERE, '..', '..');

describe('resolveTranTemplates', () => {
    it('fills a label in with what the button says in that language', () => {
        const source = 'Press **F9** ([en:tran:Clear Long Text]) to clear it.';
        expect(resolveTranTemplates(source, 'en')).toBe(
            'Press **F9** (Clear Long Text) to clear it.',
        );
        expect(resolveTranTemplates(source, 'km')).toBe(
            'Press **F9** (លុបអត្ថបទវែង) to clear it.',
        );
    });

    it('takes a locale as readily as a language code', () => {
        expect(resolveTranTemplates('[en:tran:All Books]', 'km-KH')).toBe(
            'សៀវភៅទាំងអស់',
        );
    });

    it('resolves every token in a line, not just the first', () => {
        expect(
            resolveTranTemplates(
                '[en:tran:Colors] / [en:tran:Images] / [en:tran:Videos]',
                'km',
            ),
        ).toBe('ពណ៌ / រូបភាព / វីដេអូ');
    });
});

describe('tranText', () => {
    it('answers what one label reads as on screen', () => {
        expect(tranText('Bible Lookup', 'km')).toBe('ស្វែងរកព្រះគម្ពីរ');
        // Matched the way `tran()` matches: trimmed and case-insensitive.
        expect(tranText('  clear long text ', 'km')).toBe('លុបអត្ថបទវែង');
        expect(tranText('Bible Lookup', 'en')).toBe('Bible Lookup');
    });
});

// The Khmer package, where every language but English lives: its own folder.
const KHMER_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data', 'online', 'km');

describe('the language packs', () => {
    it('reads the dictionary out of a pack without loading it', () => {
        const dictionary = readSourceDictionary(KHMER_DIR);
        expect(Object.keys(dictionary).length).toBeGreaterThan(1000);
        // Sanitized to `tran()`'s own key shape.
        expect(dictionary['clear long text']).toBe('លុបអត្ថបទវែង');
        expect(dictionary['Clear Long Text']).toBeUndefined();
    });

    it('reads each language its own name', () => {
        // The list of languages names it from its manifest, `meta.json`.
        const khmer = listTranLanguages().find((language) => {
            return language.code === 'km';
        });
        expect(khmer).toMatchObject({ name: 'Khmer', nativeName: 'ខ្មែរ' });
    });
});

// The guard this whole mechanism stands on.
//
// A document that says `[en:tran:Clear Bibel]` looks fine in English -- the
// token falls back to its own text -- and silently hands a Khmer volunteer an
// English label they cannot find on their screen. Nothing about reading the
// page shows it up, so it is caught here instead: every key written in the
// corpus has to be a key the app can actually translate.
describe('the knowledge corpus', () => {
    // Everything the knowledge bundle ships: the rules and the project
    // instructions name controls as templates too, and were walked by nothing
    // until the notes were read against the code (2026-10-11).
    const SOURCES = [
        path.join(REPO_ROOT, 'docs', 'manual-sources'),
        path.join(REPO_ROOT, '.claude', 'memory'),
        path.join(REPO_ROOT, '.claude', 'skills'),
        path.join(REPO_ROOT, '.claude', 'rules'),
    ];
    const listMarkdown = (dirPath) => {
        const filePaths = [];
        const walk = (current) => {
            for (const name of readdirSync(current)) {
                const entryPath = path.join(current, name);
                if (statSync(entryPath).isDirectory()) {
                    walk(entryPath);
                } else if (name.endsWith('.md')) {
                    filePaths.push(entryPath);
                }
            }
        };
        walk(dirPath);
        return filePaths;
    };
    const filePaths = [
        ...SOURCES.flatMap(listMarkdown),
        path.join(REPO_ROOT, '.claude', 'CLAUDE.md'),
    ];

    it('names app labels through a template, not a hand-copied twin', () => {
        // What the templates replaced: `**Bible Lookup** (ស្វែងរកព្រះគម្ពីរ)`,
        // written out by hand in both languages. Those copies went stale --
        // the manual still said `គ្រប់កណ្ឌគម្ពីរ` for **All Books** long after
        // the app had moved to `សៀវភៅទាំងអស់` -- and the English-only help
        // window had to strip them back out with a stack of regexes.
        //
        // Only a twin the DICTIONARY recognises counts. Khmer that is content
        // rather than a label is fine and expected -- `**Jacob** (យ៉ាកុប)` is a
        // name to type into the lookup, not a button -- and a rule that could
        // not tell the two apart would either fail forever or be switched off.
        const bundle = loadTranBundle();
        const labels = new Set(Object.values(bundle.dictionaries?.km ?? {}));
        const twinPattern =
            /\*\*[^*\n]+\*\*[\s\n]*(?:\(|\/\s*)([ក-៿][^)\n]*)/gu;
        const offenders = [];
        for (const filePath of filePaths) {
            for (const match of readFileSync(filePath, 'utf-8').matchAll(
                twinPattern,
            )) {
                if (labels.has(match[1].trim())) {
                    offenders.push(
                        `${path.basename(filePath)}: ${match[0].slice(0, 60)}`,
                    );
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
