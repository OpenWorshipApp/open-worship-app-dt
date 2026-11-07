import { describe, expect, test } from 'vitest';

import { genFontsData, type LangFontsFileType } from './langFontFaces';

const FONT_URLS = {
    'fonts/Face-Regular.ttf': '/assets/Face-Regular.ttf',
    'fonts/Face-Bold.ttf': '/assets/Face-Bold.ttf',
    'fonts/Face-Italic.ttf': '/assets/Face-Italic.ttf',
    'fonts/Note.ttf': '/assets/Note.ttf',
};

describe('a language font sheet', () => {
    test('an upright face carries no font-style, as every built plugin reads', () => {
        const fonts: LangFontsFileType = {
            uiFamily: 'app-Face',
            family: 'Face',
            faces: [
                { file: 'fonts/Face-Regular.ttf', weight: 'normal' },
                { file: 'fonts/Face-Bold.ttf', weight: 'bold' },
            ],
        };

        const { css, fileUrls } = genFontsData(fonts, FONT_URLS);

        expect(css).not.toContain('font-style');
        expect(css).toContain(`@font-face {
    font-family: app-Face;
    src: url(/assets/Face-Regular.ttf) format("truetype");
    font-weight: normal;
}`);
        // Each face under the app's name and the font's real one.
        expect(css.match(/font-family: app-Face;/g)).toHaveLength(2);
        expect(css.match(/font-family: "Face";/g)).toHaveLength(2);
        expect(fileUrls).toEqual([
            '/assets/Face-Regular.ttf',
            '/assets/Face-Bold.ttf',
        ]);
    });

    test('an italic face is declared italic under both names', () => {
        const fonts: LangFontsFileType = {
            uiFamily: 'app-Face',
            family: 'Face',
            faces: [
                { file: 'fonts/Face-Regular.ttf', weight: 'normal' },
                {
                    file: 'fonts/Face-Italic.ttf',
                    weight: 'normal',
                    style: 'italic',
                },
            ],
        };

        const { css } = genFontsData(fonts, FONT_URLS);

        expect(css.match(/font-style: italic;/g)).toHaveLength(2);
        expect(css)
            .toContain(`    src: url(/assets/Face-Italic.ttf) format("truetype");
    font-weight: normal;
    font-style: italic;
}`);
    });

    test('look-alikes and the sticky note face are drawn by the shipped files', () => {
        const fonts: LangFontsFileType = {
            uiFamily: 'app-Face',
            family: 'Face',
            faces: [{ file: 'fonts/Face-Regular.ttf', weight: 'normal' }],
            lookAlikes: ['Face Old'],
            stickyNote: { family: 'app-Note', file: 'fonts/Note.ttf' },
        };

        const { css, fileUrls } = genFontsData(fonts, FONT_URLS);

        expect(css).toContain(
            'src: local("Face Old"), url(/assets/Face-Regular.ttf) format("truetype");',
        );
        expect(css).toContain('font-family: app-Note;');
        expect(fileUrls).toEqual([
            '/assets/Face-Regular.ttf',
            '/assets/Note.ttf',
        ]);
    });

    test('refuses a face whose file was not found', () => {
        const fonts: LangFontsFileType = {
            uiFamily: 'app-Face',
            family: 'Face',
            faces: [{ file: 'fonts/Missing.ttf', weight: 'normal' }],
        };

        expect(() => genFontsData(fonts, FONT_URLS)).toThrow(
            'fonts.json names fonts/Missing.ttf, which was not found.',
        );
    });
});
