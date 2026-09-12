import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    extractDictionary,
    extractLangMeta,
    listTranLanguages,
    listTranTemplateKeys,
    loadTranBundle,
    resolveTranTemplates,
    tranText,
} from './tran.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..', '..');

describe('resolveTranTemplates', () => {
    it('fills a label in with what the button says in that language', () => {
        const source = 'Press **F9** ([en:tran:Clear Bible]) to clear it.';
        expect(resolveTranTemplates(source, 'en')).toBe(
            'Press **F9** (Clear Bible) to clear it.',
        );
        expect(resolveTranTemplates(source, 'km')).toBe(
            'Press **F9** (លុបព្រះគម្ពីរ) to clear it.',
        );
    });

    it('takes a locale as readily as a language code', () => {
        expect(resolveTranTemplates('[en:tran:All Books]', 'km-KH')).toBe(
            'សៀវភៅទាំងអស់',
        );
    });

    it('leaves the English in place when nothing can translate it', () => {
        // A language the app does not have, no language at all, and a key the
        // dictionary does not carry. The app's own `tran` throws on the last
        // of these in dev; a document must not, or one mistyped label costs
        // the reader the whole answer.
        expect(resolveTranTemplates('[en:tran:Clear Bible]', 'fr')).toBe(
            'Clear Bible',
        );
        expect(resolveTranTemplates('[en:tran:Clear Bible]', null)).toBe(
            'Clear Bible',
        );
        expect(resolveTranTemplates('[en:tran:Not A Real Label]', 'km')).toBe(
            'Not A Real Label',
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

    it('leaves text alone when there is nothing to fill in', () => {
        const plain = 'Press **F9** to clear it.';
        expect(resolveTranTemplates(plain, 'km')).toBe(plain);
        // A bracket that is not a template must survive verbatim: the manual
        // is full of `[text](link)` and of bracketed asides.
        expect(resolveTranTemplates('[see W-06](w-06.md)', 'km')).toBe(
            '[see W-06](w-06.md)',
        );
    });
});

describe('tranText', () => {
    it('answers what one label reads as on screen', () => {
        expect(tranText('Bible Lookup', 'km')).toBe('ស្វែងរកព្រះគម្ពីរ');
        // Matched the way `tran()` matches: trimmed and case-insensitive.
        expect(tranText('  clear bible ', 'km')).toBe('លុបព្រះគម្ពីរ');
        expect(tranText('Bible Lookup', 'en')).toBe('Bible Lookup');
    });
});

describe('the language packs', () => {
    it('lifts the dictionary out of a pack without loading it', () => {
        const dictionary = extractDictionary(
            readFileSync(
                path.join(REPO_ROOT, 'src', 'lang', 'data', 'km', 'index.ts'),
                'utf-8',
            ),
        );
        expect(Object.keys(dictionary).length).toBeGreaterThan(1000);
        // Sanitized to `tran()`'s own key shape.
        expect(dictionary['clear bible']).toBe('លុបព្រះគម្ពីរ');
        expect(dictionary['Clear Bible']).toBeUndefined();
    });

    it('reads each language its own name', () => {
        const meta = extractLangMeta(
            readFileSync(
                path.join(REPO_ROOT, 'src', 'lang', 'data', 'km', 'index.ts'),
                'utf-8',
            ),
        );
        expect(meta).toEqual({ name: 'Khmer', nativeName: 'ខ្មែរ' });
    });

    it('lists what the interface can be shown in', () => {
        expect(
            listTranLanguages().map((language) => {
                return language.code;
            }),
        ).toEqual(expect.arrayContaining(['en', 'km']));
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
    const SOURCES = [
        path.join(REPO_ROOT, 'docs', 'manual-sources'),
        path.join(REPO_ROOT, '.claude', 'memory'),
        path.join(REPO_ROOT, '.claude', 'skills'),
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
    const filePaths = SOURCES.flatMap(listMarkdown);

    it('writes label templates that the app can actually translate', () => {
        const bundle = loadTranBundle();
        // English is the language the keys are WRITTEN in, so it translates
        // every key to itself by construction and can prove nothing here.
        const translatable = (bundle.languages ?? []).filter((language) => {
            return (
                language.code !== 'en' &&
                bundle.dictionaries?.[language.code] !== undefined
            );
        });
        expect(translatable.length).toBeGreaterThan(0);
        const broken = [];
        let total = 0;
        for (const filePath of filePaths) {
            const content = readFileSync(filePath, 'utf-8');
            for (const token of listTranTemplateKeys(content)) {
                total += 1;
                if (token.sourceLang !== 'en' || token.kind !== 'tran') {
                    broken.push(
                        `${path.basename(filePath)}: unknown template ` +
                            `[${token.sourceLang}:${token.kind}:...]`,
                    );
                    continue;
                }
                for (const language of translatable) {
                    if (tranText(token.key, language.code) === token.key) {
                        broken.push(
                            `${path.basename(filePath)}: "${token.key}" has ` +
                                `no ${language.code} translation`,
                        );
                    }
                }
            }
        }
        expect(broken).toEqual([]);
        // The templates exist at all: a corpus that lost them would pass the
        // check above by having nothing to check.
        expect(total).toBeGreaterThan(100);
    });

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
