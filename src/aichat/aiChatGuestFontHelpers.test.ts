import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    applyGuestLanguageFont,
    genGuestFontScript,
    readLanguageFontFiles,
    setLanguageFont,
    toSafeFontList,
    toUnicodeRange,
} from './aiChatGuestFontHelpers';
import type { AiChatGuestElementType } from './webviewTypes';

describe('toUnicodeRange', () => {
    it("reads the letters a language's script pattern names", () => {
        expect(toUnicodeRange('[\\u1780-\\u17FF\\u19E0-\\u19FF]')).toBe(
            'U+1780-17FF, U+19E0-19FF',
        );
        expect(toUnicodeRange('[A-Za-z]')).toBeNull();
    });
});

describe('readLanguageFontFiles', () => {
    const CSS = `
        @font-face {
            font-family: app-Battambang;
            src: url(/fonts/Battambang-Regular.ttf) format("truetype");
            font-weight: normal;
        }
        @font-face {
            font-family: app-Battambang;
            src: url(/fonts/Battambang-Bold.ttf) format("truetype");
            font-weight: bold;
        }
        @font-face {
            font-family: app-Battambang;
            src: url(/fonts/Battambang-Light.ttf) format("truetype");
            font-weight: 300;
        }
        @font-face {
            font-family: km-font-Fasthand;
            src: url(/fonts/Fasthand.ttf) format("truetype");
            font-weight: normal;
        }`;

    it('takes the regular and bold files of the face, nothing else', () => {
        expect(readLanguageFontFiles(CSS, 'app-Battambang')).toEqual([
            { url: '/fonts/Battambang-Regular.ttf', weight: '400' },
            { url: '/fonts/Battambang-Bold.ttf', weight: '700' },
        ]);
        expect(readLanguageFontFiles(CSS, 'nothing')).toEqual([]);
    });
});

describe('toSafeFontList', () => {
    // Read off a stranger's page: only what a font list can hold goes into
    // the rule written back into it.
    it('keeps names and commas, and nothing that could close the rule', () => {
        expect(toSafeFontList('"Anthropic Serif", Georgia, serif')).toBe(
            '"Anthropic Serif", Georgia, serif',
        );
        expect(toSafeFontList('a; } body { color: red')).toBe(
            'a  body  color red',
        );
        expect(toSafeFontList(42)).toBe('');
    });

    it('cuts a long list between names, never inside a quote', () => {
        const long = Array.from({ length: 120 }, (_, index) => {
            return `"Noto Sans ${index}"`;
        }).join(', ');
        const safe = toSafeFontList(long);
        expect(safe.length).toBeLessThanOrEqual(1200);
        expect(safe.endsWith('"')).toBe(true);
        expect(safe.split('"').length % 2).toBe(1);
        expect(toSafeFontList('"Open, Georgia, serif')).toBe('Georgia, serif');
    });
});

type FakeFaceType = {
    family: string;
    weight: string;
    style: string;
    stretch: string;
    unicodeRange: string;
    status: string;
    buffer?: ArrayBuffer;
};

// The page the script runs in: a FontFaceSet holding the site's own faces.
function runInFakePage(
    script: string,
    siteFaces: FakeFaceType[],
    bodyFonts = 'anthropic-sans, system-ui',
) {
    const fonts = [...siteFaces];
    const listeners: ((event: { fontfaces: FakeFaceType[] }) => void)[] = [];
    const document = {
        body: {},
        fonts: {
            add: (face: FakeFaceType) => {
                fonts.push(face);
            },
            addEventListener: (
                _name: string,
                listener: (event: { fontfaces: FakeFaceType[] }) => void,
            ) => {
                listeners.push(listener);
            },
            [Symbol.iterator]: () => {
                return [...fonts][Symbol.iterator]();
            },
        },
    };
    class FontFace {
        status = 'loaded';
        constructor(
            public family: string,
            public buffer: ArrayBuffer,
            descriptors: Partial<FakeFaceType>,
        ) {
            Object.assign(this, {
                weight: 'normal',
                style: 'normal',
                stretch: 'normal',
                ...descriptors,
            });
        }
    }
    const window = {} as Record<string, unknown>;
    const run = () => {
        return new Function(
            'window',
            'document',
            'FontFace',
            'getComputedStyle',
            `return ${script}`,
        )(window, document, FontFace, () => {
            return { fontFamily: bodyFonts };
        });
    };
    const added = () => {
        return fonts.slice(siteFaces.length).map((face) => {
            return [
                face.family,
                face.weight,
                face.style,
                face.unicodeRange,
                face.buffer?.byteLength,
            ].join(' | ');
        });
    };
    const load = (face: FakeFaceType) => {
        for (const listener of listeners) {
            listener({ fontfaces: [face] });
        }
    };
    return { run, added, load };
}

describe('genGuestFontScript', () => {
    // Regular 1 byte, bold 2 bytes: the byte count tells the files apart.
    const SCRIPT = genGuestFontScript(
        [
            { data: btoa('r'), weight: '400' },
            { data: btoa('bb'), weight: '700' },
        ],
        'app-Battambang',
        'U+1780-17FF, U+19E0-19FF',
    );
    const genFace = (overrides: Partial<FakeFaceType>): FakeFaceType => {
        return {
            family: 'anthropic-sans',
            weight: '300 800',
            style: 'normal',
            stretch: 'normal',
            unicodeRange: 'U+0-10FFFF',
            status: 'loaded',
            ...overrides,
        };
    };

    it('hands the bytes over and fetches nothing', () => {
        expect(SCRIPT).toContain('new FontFace(name, buffer');
        expect(SCRIPT).toContain('"U+1780-17FF, U+19E0-19FF"');
        expect(SCRIPT).not.toMatch(/fetch\(|url\(/);
    });

    // Chromium picks one group of faces per name by weight, style and
    // stretch; a face at 400 beside the site's `300 800` won regular text
    // and dropped claude.ai's Latin to Segoe UI.
    it("joins each loaded site face's own group, with its descriptors", () => {
        const page = runInFakePage(SCRIPT, [
            genFace({}),
            genFace({ style: 'italic', status: 'unloaded' }),
            genFace({ family: '"Heavy Face"', weight: '700' }),
            genFace({
                family: 'Anthropic Serif Fallback Georgia',
                weight: 'normal',
                unicodeRange: 'U+20-7E, U+A0-B4',
            }),
        ]);
        // Its body's first face took the language's: no body rule.
        expect(page.run()).toBe('');
        expect(page.added()).toEqual([
            'app-Battambang | 400 | normal | U+1780-17FF, U+19E0-19FF | 1',
            'app-Battambang | 700 | normal | U+1780-17FF, U+19E0-19FF | 2',
            'anthropic-sans | 300 800 | normal | U+1780-17FF, U+19E0-19FF | 1',
            'Heavy Face | 700 | normal | U+1780-17FF, U+19E0-19FF | 2',
        ]);
    });

    it('follows a face the page loads later, once, and runs once a page', () => {
        const page = runInFakePage(SCRIPT, [], 'system-ui, sans-serif');
        // A site on system fonts: the body's list comes back for the rule.
        expect(page.run()).toBe('system-ui, sans-serif');
        const serif = genFace({ family: 'anthropic-serif' });
        page.load(serif);
        page.load({ ...serif });
        expect(page.added().slice(2)).toEqual([
            'anthropic-serif | 300 800 | normal | U+1780-17FF, U+19E0-19FF | 1',
        ]);
        expect(page.run()).toBeNull();
        expect(page.added()).toHaveLength(3);
    });
});

describe('applyGuestLanguageFont', () => {
    afterEach(() => {
        setLanguageFont(null);
        vi.restoreAllMocks();
    });

    const genGuest = (hasFont: boolean) => {
        const guest = {
            executeJavaScript: vi.fn(async (code: string) => {
                return code.startsWith('window.')
                    ? hasFont
                    : 'anthropic-sans, system-ui';
            }),
            insertCSS: vi.fn(async () => {
                return '';
            }),
        };
        return {
            guest,
            element: guest as unknown as AiChatGuestElementType,
        };
    };

    const useFont = () => {
        setLanguageFont({
            family: 'app-Battambang',
            css: `@font-face {
                font-family: app-Battambang;
                src: url(/fonts/Battambang-Regular.ttf) format("truetype");
                font-weight: normal;
            }`,
            unicodeRange: 'U+1780-17FF',
        });
        return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            return new Response(new Uint8Array([1, 2, 3]));
        });
    };

    it('hands the face over once, for both load events of a page', async () => {
        const fetchSpy = useFont();
        const { guest, element } = genGuest(false);
        await Promise.all([
            applyGuestLanguageFont(element),
            applyGuestLanguageFont(element),
        ]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(guest.executeJavaScript).toHaveBeenCalledTimes(2);
        expect(guest.insertCSS).toHaveBeenCalledWith(
            'body { font-family: "app-Battambang", anthropic-sans, system-ui; }',
        );
    });

    it('sends no font to a page that already has it', async () => {
        const fetchSpy = useFont();
        const { guest, element } = genGuest(true);
        await applyGuestLanguageFont(element);
        expect(guest.executeJavaScript).toHaveBeenCalledTimes(1);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(guest.insertCSS).not.toHaveBeenCalled();
    });
});
