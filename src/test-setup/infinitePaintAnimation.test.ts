import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

// CLAUDE.md: no `infinite` CSS animation of a PAINT property on anything that
// stays mounted at rest -- run it a few times, or animate `opacity` /
// `transform` only. Three traces paid for that rule: one noted verse held the
// idle Reader at 235 paints a second (EN-09), one on-screen slide card the
// Presenter at 59 frames a second (EN-10), the Mini Screen's show / hide icon
// at 60 frames + 120 paints a second while a screen was up (EN-19). Until
// 2026-11-19 (`AD-36`) only the boot spinner's keyframes were held by a test
// (`bootLoading.test.ts`); this holds every stylesheet and every page.
//
// Read: `src/**/*.{css,scss}` and `html/*.html`, where the app's own chrome is
// styled. Not read: the CSS that TypeScript writes for what goes ON a screen
// (`src/background`'s fills and animations, `screenForegroundHelpers.tsx`'s
// marquee) -- that motion is the content a person chose to show, not chrome
// left running at rest, and a background effect's keyframes are held to
// `transform` / `opacity` by their own checks (`cssCodeCheckHelpers.ts`,
// `cssAnimationLayerHelpers.ts`' keyframes test).

// Animated by the compositor alone, once the layer is painted.
const COMPOSITED_PROPERTY_SET = new Set([
    'opacity',
    'transform',
    'rotate',
    'scale',
    'translate',
]);

// A keyframes name allowed to animate something else forever, with the reason
// it is not chrome at rest. Empty on 2026-11-19: every infinite animation in
// the tree moved `transform` or `opacity` alone.
const EXEMPT_KEYFRAMES_REASON_MAP: Record<string, string> = {};

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function stripComments(text: string) {
    return (
        text
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // An SCSS line comment; `url(https://…)` keeps its `://`.
            .replace(/(^|[^:])\/\/.*$/gm, '$1')
    );
}

// Commas inside `calc(…)` and `var(--a, 8s)` do not separate animations.
function splitTopLevelComma(value: string) {
    const partList: string[] = [];
    let depth = 0;
    let part = '';
    for (const char of value) {
        if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth -= 1;
        } else if (char === ',' && depth === 0) {
            partList.push(part);
            part = '';
            continue;
        }
        part += char;
    }
    partList.push(part);
    return partList.map((one) => one.trim()).filter((one) => one !== '');
}

/** Every `@keyframes` name of a stylesheet, with the properties it moves. */
function readKeyframes(text: string) {
    const keyframesMap = new Map<string, Set<string>>();
    const source = stripComments(text);
    for (const match of source.matchAll(
        /@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g,
    )) {
        let depth = 1;
        let at = (match.index ?? 0) + match[0].length;
        const start = at;
        while (at < source.length && depth > 0) {
            if (source[at] === '{') {
                depth += 1;
            } else if (source[at] === '}') {
                depth -= 1;
            }
            at += 1;
        }
        const body = source.slice(start, at - 1);
        const propertySet = keyframesMap.get(match[1]) ?? new Set<string>();
        for (const declaration of body.matchAll(
            /(?:^|[;{\s])([a-z-]+)\s*:(?!:)/g,
        )) {
            propertySet.add(declaration[1]);
        }
        keyframesMap.set(match[1], propertySet);
    }
    return keyframesMap;
}

/**
 * The keyframes names a stylesheet runs `infinite`, by the declaration that
 * runs them. A shorthand names its own; `animation-iteration-count: infinite`
 * applies to every `animation-name` the same file sets, read conservatively.
 */
function readInfiniteUseList(text: string, knownNameSet: Set<string>) {
    const source = stripComments(text);
    const nameDeclarationList = [
        ...source.matchAll(/animation-name\s*:\s*([^;{}]*)/g),
    ].flatMap((match) => {
        return splitTopLevelComma(match[1]);
    });
    const useList: { declaration: string; nameList: string[] }[] = [];
    for (const match of source.matchAll(
        /(animation|animation-iteration-count)\s*:\s*([^;{}]*)/g,
    )) {
        const [, property, value] = match;
        if (property === 'animation-iteration-count') {
            if (/\binfinite\b/.test(value)) {
                useList.push({
                    declaration: match[0].trim(),
                    nameList: nameDeclarationList,
                });
            }
            continue;
        }
        for (const item of splitTopLevelComma(value)) {
            if (!/\binfinite\b/.test(item)) {
                continue;
            }
            const nameList = (item.match(/[\w-]+/g) ?? []).filter((word) => {
                return knownNameSet.has(word);
            });
            useList.push({ declaration: item, nameList });
        }
    }
    return useList;
}

/** Each infinite use that moves a paint property, or names no keyframes. */
function findPaintViolations(fileList: { relPath: string; text: string }[]) {
    const keyframesMap = new Map<string, Set<string>>();
    for (const { text } of fileList) {
        for (const [name, propertySet] of readKeyframes(text)) {
            const merged = keyframesMap.get(name) ?? new Set<string>();
            propertySet.forEach((one) => merged.add(one));
            keyframesMap.set(name, merged);
        }
    }
    const knownNameSet = new Set(keyframesMap.keys());
    const violationList: string[] = [];
    let useCount = 0;
    for (const { relPath, text } of fileList) {
        for (const use of readInfiniteUseList(text, knownNameSet)) {
            useCount += 1;
            if (use.nameList.length === 0) {
                violationList.push(
                    `${relPath}: \`${use.declaration}\` names no @keyframes this test can find`,
                );
                continue;
            }
            for (const name of use.nameList) {
                if (name in EXEMPT_KEYFRAMES_REASON_MAP) {
                    continue;
                }
                const paintList = [...(keyframesMap.get(name) ?? [])].filter(
                    (property) => {
                        return !COMPOSITED_PROPERTY_SET.has(property);
                    },
                );
                if (paintList.length > 0) {
                    violationList.push(
                        `${relPath}: \`${name}\` runs infinite and animates ${paintList.join(', ')}`,
                    );
                }
            }
        }
    }
    return { violationList, useCount };
}

function readStylesheets() {
    const fileList: { relPath: string; text: string }[] = [];
    const srcDir = path.join(REPO_ROOT, 'src');
    for (const relPath of readdirSync(srcDir, { recursive: true })) {
        const name = String(relPath);
        if (/\.(css|scss)$/.test(name)) {
            fileList.push({
                relPath: `src/${name.replace(/\\/g, '/')}`,
                text: readFileSync(path.join(srcDir, name), 'utf8'),
            });
        }
    }
    const htmlDir = path.join(REPO_ROOT, 'html');
    for (const name of readdirSync(htmlDir)) {
        if (name.endsWith('.html')) {
            fileList.push({
                relPath: `html/${name}`,
                text: readFileSync(path.join(htmlDir, name), 'utf8'),
            });
        }
    }
    return fileList;
}

describe('no infinite animation of a paint property', () => {
    test('a planted infinite colour animation is caught', () => {
        const { violationList } = findPaintViolations([
            {
                relPath: 'planted.scss',
                text: [
                    '.noted { animation: noted-glow 2s ease-in-out infinite; }',
                    '@keyframes noted-glow { 50% { color: red; } }',
                ].join('\n'),
            },
        ]);
        expect(violationList).toEqual([
            'planted.scss: `noted-glow` runs infinite and animates color',
        ]);
    });

    test('a few runs, or transform and opacity, pass', () => {
        const { violationList, useCount } = findPaintViolations([
            {
                relPath: 'fine.scss',
                text: [
                    '.a { animation: glow 2s 3; }',
                    '.b { animation: spin calc(var(--i, 1) * -1s) linear infinite, glow 1s 2; }',
                    '@keyframes glow { to { box-shadow: 0 0 4px red; } }',
                    '@keyframes spin { to { transform: rotate(1turn); opacity: 0.5; } }',
                ].join('\n'),
            },
        ]);
        expect(violationList).toEqual([]);
        expect(useCount).toBe(1);
    });

    test('an iteration count reads the names its file sets', () => {
        const { violationList } = findPaintViolations([
            {
                relPath: 'split.scss',
                text: [
                    '.motion { animation-iteration-count: infinite; }',
                    '.drift { animation-name: drift; }',
                    '@keyframes drift { to { background-position: 10px 0; } }',
                ].join('\n'),
            },
        ]);
        expect(violationList).toEqual([
            'split.scss: `drift` runs infinite and animates background-position',
        ]);
    });

    test('a name with no keyframes is not passed in silence', () => {
        const { violationList } = findPaintViolations([
            {
                relPath: 'lost.scss',
                text: '.x { animation: $pulse 1s infinite; } // `$pulse` is SCSS',
            },
        ]);
        expect(violationList).toHaveLength(1);
        expect(violationList[0]).toContain('names no @keyframes');
    });

    test('the stylesheets and pages hold the rule', () => {
        const fileList = readStylesheets();
        const { violationList, useCount } = findPaintViolations(fileList);
        expect(violationList).toEqual([]);
        // The read is not empty: the spinners, the marquee and the projector
        // fill run infinite on purpose, each on `transform` or `opacity`.
        expect(useCount).toBeGreaterThanOrEqual(10);
    });
});
