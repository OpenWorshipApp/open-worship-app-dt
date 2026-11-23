import { describe, expect, test, vi } from 'vitest';

import { genLangData, type LangFolderType } from './onlineLangPackage';

// A made-up language: the factory names none, so neither does its test.
function genFolder(overrides: Partial<LangFolderType> = {}): LangFolderType {
    return {
        langCode: 'xx',
        meta: {
            locale: 'xx-XX',
            name: 'Invented',
            nativeName: 'Invented Own',
            version: '1.0.0',
        },
        dictionary: { People: 'Folk' },
        flagSVG: ' <svg></svg> ',
        ...overrides,
    };
}

describe('genLangData dictionary', () => {
    test('two keys that sanitize alike are refused, naming the second', () => {
        expect(() => {
            genLangData(
                genFolder({
                    dictionary: { People: 'Folk', ' people ': 'Others' },
                }),
            );
        }).toThrow(
            'Duplicate translation keys found after sanitization:  people ',
        );
    });

    test('every duplicate is listed, not only the first', () => {
        expect(() => {
            genLangData(
                genFolder({
                    dictionary: {
                        Save: 'a',
                        SAVE: 'b',
                        Open: 'c',
                        OPEN: 'd',
                    },
                }),
            );
        }).toThrow(/SAVE, OPEN$/);
    });

    test('distinct keys are kept under their sanitized form', () => {
        const langData = genLangData(
            genFolder({ dictionary: { ' People ': 'Folk', Save: 'Keep' } }),
        );
        expect(langData.dictionary).toEqual({ people: 'Folk', save: 'Keep' });
    });
});

describe('genLangData finding text without a letter pattern', () => {
    test('lower-cases and trims but keeps every non-space sign', () => {
        const langData = genLangData(genFolder());
        expect(langData.sanitizeFindingText('  Hello, World!  ')).toBe(
            'hello, world!',
        );
    });
});

describe('genLangData song plugin without fonts', () => {
    test('registers the plugin under the locale and applies no font faces', () => {
        class InventedPlugin {
            kind = 'invented';
        }
        const langData = genLangData(
            genFolder({ OpenLyricPlugin: InventedPlugin }),
        );
        expect(langData.initOpenLyricPlugins).toBeTypeOf('function');
        const addPlugin = vi.fn();
        const genOpenLyricFontFaces = vi.fn();
        const openLyric = { fontFaces: {} };
        langData.initOpenLyricPlugins!({
            editor: { addPlugin } as any,
            openLyric: openLyric as any,
            genOpenLyricFontFaces,
        });
        expect(addPlugin).toHaveBeenCalledOnce();
        expect(addPlugin.mock.calls[0][0]).toBe('xx-XX');
        expect(addPlugin.mock.calls[0][1]).toBeInstanceOf(InventedPlugin);
        expect(genOpenLyricFontFaces).not.toHaveBeenCalled();
        expect(openLyric.fontFaces).toEqual({});
        expect(langData.getFontFamilyFiles).toBeUndefined();
    });

    test('no editor is fine: nothing is registered and nothing throws', () => {
        class InventedPlugin {}
        const langData = genLangData(
            genFolder({ OpenLyricPlugin: InventedPlugin }),
        );
        const genOpenLyricFontFaces = vi.fn();
        expect(() => {
            langData.initOpenLyricPlugins!({ genOpenLyricFontFaces });
        }).not.toThrow();
        expect(genOpenLyricFontFaces).not.toHaveBeenCalled();
    });

    test('neither a plugin nor fonts: no song plugin hook at all', () => {
        expect(genLangData(genFolder()).initOpenLyricPlugins).toBeUndefined();
    });
});

describe('genLangData song labels (F-10)', () => {
    // A language's preview and Config card plugins, as a package's
    // `openLyricPlugin.ts` names them: what they contribute is all that is read.
    class InventedPreviewPlugin {
        contributes = {
            language: { labels: { Key: 'Keyword', Attachments: 'Things' } },
            settings: [{ render: () => undefined }],
        };
        install() {
            throw new Error('never installed: it would hold every preview');
        }
    }
    class InventedMarkdownPlugin {
        contributes = { language: { labels: { Title: 'Heading' } } };
    }

    function genSurface(ids: string[] = []) {
        const plugins = new Map<string, any>(ids.map((id) => [id, {}]));
        return {
            plugins,
            addPlugin: vi.fn((id: string, plugin: any) => {
                plugins.set(id, plugin);
            }),
            hasPlugin: (id: string) => plugins.has(id),
        };
    }

    test('the preview gets the labels alone, under the locale, for auto', () => {
        const langData = genLangData(
            genFolder({
                openLyricPluginModule: {
                    LyricPreviewPlugin: InventedPreviewPlugin,
                    LyricMarkdownPlugin: InventedMarkdownPlugin,
                },
            }),
        );
        const openLyric = genSurface();
        const openLyricMarkdownManager = genSurface();
        langData.initOpenLyricPlugins!({
            openLyric: openLyric as any,
            openLyricMarkdownManager: openLyricMarkdownManager as any,
            genOpenLyricFontFaces: vi.fn(),
        });
        expect(openLyric.plugins.get('xx-XX')).toEqual({
            id: 'xx-XX',
            apiVersion: 1,
            surfaces: ['lyric'],
            contributes: {
                language: { labels: { Key: 'Keyword', Attachments: 'Things' } },
            },
        });
        expect(openLyricMarkdownManager.plugins.get('xx-XX')).toEqual({
            id: 'xx-XX',
            apiVersion: 1,
            surfaces: ['markdown'],
            contributes: { language: { labels: { Title: 'Heading' } } },
        });
        // No `labelLocale` was set: the song's own Locales decide.
        expect('labelLocale' in openLyric).toBe(false);
    });

    test('a surface that has the locale already keeps it', () => {
        const langData = genLangData(
            genFolder({
                openLyricPluginModule: {
                    LyricPreviewPlugin: InventedPreviewPlugin,
                },
            }),
        );
        const openLyric = genSurface(['xx-XX']);
        langData.initOpenLyricPlugins!({
            openLyric: openLyric as any,
            genOpenLyricFontFaces: vi.fn(),
        });
        expect(openLyric.addPlugin).not.toHaveBeenCalled();
    });

    test('a plugin with no labels, or none named, adds nothing', () => {
        class NoLabelsPlugin {
            contributes = { language: {} };
        }
        const langData = genLangData(
            genFolder({
                openLyricPluginModule: { LyricPreviewPlugin: NoLabelsPlugin },
            }),
        );
        const openLyric = genSurface();
        const openLyricMarkdownManager = genSurface();
        langData.initOpenLyricPlugins!({
            openLyric: openLyric as any,
            openLyricMarkdownManager: openLyricMarkdownManager as any,
            genOpenLyricFontFaces: vi.fn(),
        });
        expect(openLyric.addPlugin).not.toHaveBeenCalled();
        expect(openLyricMarkdownManager.addPlugin).not.toHaveBeenCalled();
    });

    test('the labels are read once, however many previews are made', () => {
        let made = 0;
        class CountedPlugin {
            contributes = { language: { labels: { Key: 'Keyword' } } };
            constructor() {
                made += 1;
            }
        }
        const langData = genLangData(
            genFolder({
                openLyricPluginModule: { LyricPreviewPlugin: CountedPlugin },
            }),
        );
        for (let i = 0; i < 3; i += 1) {
            langData.initOpenLyricPlugins!({
                openLyric: genSurface() as any,
                genOpenLyricFontFaces: vi.fn(),
            });
        }
        expect(made).toBe(1);
    });
});
