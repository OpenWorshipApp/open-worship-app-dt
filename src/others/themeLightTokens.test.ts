import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

// `theme-light-tokens.scss` turns a dark window's page light for paper (the
// Markdown Preview's print). It can only undo what it names: a property
// Bootstrap or the dark theme sets that it misses keeps its DARK value on the
// light page.

const readSource = (path: string) => {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
};
const require = createRequire(import.meta.url);
const tokensScss = readSource('src/others/theme-light-tokens.scss');

function readBlockProperties(css: string, selector: string) {
    const start = css.indexOf(`${selector} {`);
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    return [...block.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((match) => {
        return match[1];
    });
}

describe('the light theme inside a dark window', () => {
    test("names every property Bootstrap's dark theme changes", () => {
        const bootstrapCss = readFileSync(
            require.resolve('bootstrap/dist/css/bootstrap.css'),
            'utf8',
        );
        const darkProperties = readBlockProperties(
            bootstrapCss,
            '[data-bs-theme=dark]',
        ).map((property) => {
            return property.replace(/^--bs-/, '');
        });
        const listText = /\$bootstrap-dark-properties:([^;]+);/.exec(
            tokensScss,
        )?.[1];
        expect(listText).toBeDefined();

        expect(listText!.trim().split(/\s+/).sort()).toEqual(
            [...new Set(darkProperties)].sort(),
        );
    });

    test("gives a light value to every property the app's dark theme sets", () => {
        const darkScss = readSource('src/others/theme-override-dark.scss');
        const darkStart = darkScss.indexOf(".app[data-bs-theme='dark'] {");
        // The block's own declarations: the ones before its first nested rule.
        const darkHead = darkScss.slice(
            darkStart,
            darkScss.indexOf('{', darkStart + 30),
        );
        const darkProperties = [
            ...darkHead.matchAll(/^\s*(--[a-z0-9-]+):/gm),
        ].map((match) => {
            return match[1];
        });
        expect(darkProperties.length).toBeGreaterThan(5);
        const mixinStart = tokensScss.indexOf('@mixin app-light-theme-tokens');
        const lightProperties = readBlockProperties(
            tokensScss.slice(mixinStart),
            '@mixin app-light-theme-tokens',
        );

        expect([...lightProperties].sort()).toEqual([...darkProperties].sort());
    });
});
