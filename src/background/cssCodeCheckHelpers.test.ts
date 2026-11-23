import { describe, expect, it } from 'vitest';

import {
    MAX_CSS_CODE_LENGTH,
    checkCssCodeProblem,
    checkIsGlslCodeText,
} from './cssCodeCheckHelpers';
import { CSS_CODE_STARTER } from './cssCodeAnimationHelpers';

describe('checkCssCodeProblem', () => {
    it('keeps the starter and plain animated CSS', () => {
        expect(checkCssCodeProblem(CSS_CODE_STARTER)).toBeNull();
        expect(
            checkCssCodeProblem(
                [
                    '.scene { background: linear-gradient(var(--color-1), var(--color-2)); }',
                    '.dot { animation: spin 4s linear infinite; }',
                    '@keyframes spin {',
                    '  0% { transform: rotate(0deg); opacity: 0.4; }',
                    '  100% { rotate: 360deg; scale: 1.2; translate: 4cqw 0; }',
                    '}',
                ].join('\n'),
            ),
        ).toBeNull();
    });

    it('refuses anything that loads, in any spelling', () => {
        for (const code of [
            '.scene { background: url(https://example.com/a.png); }',
            '.scene { background: URL ( "x.png" ); }',
            '@import "https://example.com/a.css";',
            '@font-face { font-family: x; }',
            '.dot { background: image-set("a.png" 1x); }',
            '.dot { background: -webkit-image-set("a.png" 1x); }',
            '.dot { background: image("a.png"); }',
        ]) {
            expect(checkCssCodeProblem(code)).not.toBeNull();
        }
    });

    it('refuses an escape, markup and a way out of the box', () => {
        expect(
            checkCssCodeProblem('.dot { background: u\\72l(x); }'),
        ).toContain('backslash');
        expect(checkCssCodeProblem('</style><script>x</script>')).toContain(
            '"<"',
        );
        expect(checkCssCodeProblem(':host { position: fixed; }')).toContain(
            ':host',
        );
        expect(
            checkCssCodeProblem('::slotted(*) { color: red; }'),
        ).not.toBeNull();
        expect(
            checkCssCodeProblem('.dot::part(x) { color: red; }'),
        ).not.toBeNull();
    });

    it('reads a word split by a comment as the word', () => {
        expect(
            checkCssCodeProblem('.dot { background: url/**/(x); }'),
        ).not.toBeNull();
    });

    it('refuses a keyframe that repaints, naming it', () => {
        const problem = checkCssCodeProblem(
            '@keyframes glow { from { opacity: 1; } to { background: red; } }',
        );
        expect(problem).toContain('@keyframes glow animates background');
        expect(
            checkCssCodeProblem(
                '@-webkit-keyframes x { to { --angle: 90deg; } }',
            ),
        ).toContain('animates --angle');
        // A comment inside a keyframe is no property.
        expect(
            checkCssCodeProblem(
                '@keyframes x { /* background: red; */ to { opacity: 0; } }',
            ),
        ).toBeNull();
    });

    it('refuses empty, too long and non-ASCII code', () => {
        expect(checkCssCodeProblem('  ')).toBe('The CSS is empty.');
        expect(checkCssCodeProblem(null)).toBe('The CSS is empty.');
        expect(
            checkCssCodeProblem(`.a{}${' '.repeat(MAX_CSS_CODE_LENGTH)}`),
        ).toContain('longer than');
        expect(checkCssCodeProblem('.dot::after { content: "→"; }')).toContain(
            'ASCII',
        );
    });
});

describe('checkIsGlslCodeText', () => {
    it('tells a shader from a style sheet by its mainImage', () => {
        expect(
            checkIsGlslCodeText('void mainImage(out vec4 c, in vec2 p) {}'),
        ).toBe(true);
        expect(checkIsGlslCodeText(CSS_CODE_STARTER)).toBe(false);
    });
});
