import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, test } from 'vitest';

// The words of a toast, an alert or a confirm reach the person only as the
// caller wrote them: `SimpleToastComp` draws its title and message as given,
// and a confirm's title and body are the caller's to translate (memory
// `confirm-popup-labels-auto-tran`). A sentence written outside `tran()` is
// English in every translated window -- and `tranKeyCoverage.test.ts` cannot
// see it, because it reads `tran()` calls only, while dev never throws for it.
// 42 such messages were found at once (EN-63), among them the PowerPoint
// import's "Do not close application" and the boot confirm whose OK erases
// the local settings; the import flows had been fixed one line at a time
// before (`dataArchiveMenuHelpers.tsx`). This test holds the whole class.
//
// Read: the TITLE and MESSAGE (the first two arguments) of every call to the
// functions below. A string or template literal with a word in it is a leak
// unless it is inside `tran(...)` / `tranSafely(...)`. Not read: a literal
// compared with `===` (`refusal === 'self'`), a `{name}` placeholder (filled
// with data), and JSX -- a message built as an element is out of this reach.

const REPO_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
);
const SRC_DIR = path.join(REPO_DIR, 'src');

const MESSAGE_FUNCTION_NAME_SET = new Set([
    'showSimpleToast',
    'showAppConfirm',
    'showAppAlert',
    'showAppInput',
]);
const TRANSLATOR_NAME_SET = new Set(['tran', 'tranSafely']);
const COMPARISON_TOKEN_SET = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
]);

// Each one stays English ON PURPOSE, and says why. An entry no call matches
// any more fails the test, so the list cannot outlive what it excuses.
const ALLOWED_LIST: { file: string; text: string; reason: string }[] = [
    ...[
        'src/_screen/managers/ScreenBackgroundManager.ts',
        'src/_screen/managers/ScreenForegroundManager.ts',
        'src/_screen/managers/ScreenLongTextManager.ts',
    ].flatMap((file) => {
        return [
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        ].map((text) => {
            return {
                file,
                text,
                reason:
                    'EN-20: a static receiver that also runs in the screen ' +
                    'window, which loads no language -- a tran() there ' +
                    'throws in dev',
            };
        });
    }),
    ...[
        'Failed to sync slide. Please make sure the screen is open.',
        'error',
    ].map((text) => {
        return {
            file: 'src/_screen/managers/ScreenVaryAppDocumentManager.ts',
            text,
            reason: 'EN-20: the same screen-window receiver',
        };
    }),
    ...['ScreenManager not found', 'error'].map((text) => {
        return {
            file: 'src/presenter-foreground/foregroundHelpers.ts',
            text,
            reason: 'an invariant of the code, not a state a person can reach',
        };
    }),
    // A literal joined with `+` is read piece by piece.
    ...[
        'run `npm i` (or `node extra-work/build-extra-bin.mjs`) ',
        'to create one in "${}"',
    ].map((text) => {
        return {
            file: 'src/helper/extra-bin/extraBinInstallHelpers.ts',
            text,
            reason: 'the development branch: a command for the developer',
        };
    }),
    ...[
        'run `node extra-work/build-lang-plugins.mjs --pack` ',
        'to create one in "${}"',
    ].map((text) => {
        return {
            file: 'src/lang/langPluginInstallHelpers.ts',
            text,
            reason: 'the development branch: a command for the developer',
        };
    }),
    ...[
        '1: Test Title',
        'This is a test message',
        '2: Another Test Title',
        'This is another test message',
        '3: Yet Another Test Title',
        'This is yet another test message',
    ].map((text) => {
        return {
            file: 'src/toast/toastHelpers.ts',
            text,
            reason: 'the development-only `testSimpleToasts` demo',
        };
    }),
    ...[
        '1: Confirm Title',
        'Are you sure you want to proceed?',
        '2: Alert Title',
        'This is an alert message.',
        '3: Alert Title',
        '4: Confirm Title',
        '5: Alert Title',
    ].map((text) => {
        return {
            file: 'src/popup-widget/popupWidgetHelpers.ts',
            text,
            reason: 'the development-only popup demo',
        };
    }),
];

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

function checkHasWord(text: string) {
    // `{name}` is filled with data, `<br>` is markup and `MB` a unit every
    // dictionary keeps as it is: none of them is read as a word.
    return /[A-Za-z]{2,}/.test(
        text
            .replaceAll(/\{\w+\}/g, '')
            .replaceAll(/<\/?\w+\s*\/?>/g, '')
            .replaceAll(/\b[KMG]B\b/g, ''),
    );
}

function collectLeakTexts(node: ts.Node, leakTexts: string[]) {
    if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        TRANSLATOR_NAME_SET.has(node.expression.text)
    ) {
        return;
    }
    if (
        ts.isJsxElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxFragment(node)
    ) {
        return;
    }
    if (
        ts.isBinaryExpression(node) &&
        COMPARISON_TOKEN_SET.has(node.operatorToken.kind)
    ) {
        return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (checkHasWord(node.text)) {
            leakTexts.push(node.text);
        }
        return;
    }
    if (ts.isTemplateExpression(node)) {
        const pieces = [
            node.head.text,
            ...node.templateSpans.map((span) => {
                return span.literal.text;
            }),
        ];
        if (checkHasWord(pieces.join(' '))) {
            leakTexts.push(pieces.join('${}'));
        }
        for (const span of node.templateSpans) {
            collectLeakTexts(span.expression, leakTexts);
        }
        return;
    }
    ts.forEachChild(node, (child) => {
        collectLeakTexts(child, leakTexts);
    });
}

type LeakType = { file: string; line: number; name: string; text: string };

function findMessageLeaks(file: string, sourceText: string) {
    const sourceFile = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const leaks: LeakType[] = [];
    let callCount = 0;
    const visit = (node: ts.Node) => {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            MESSAGE_FUNCTION_NAME_SET.has(node.expression.text)
        ) {
            callCount++;
            for (const argument of node.arguments.slice(0, 2)) {
                const leakTexts: string[] = [];
                collectLeakTexts(argument, leakTexts);
                const { line } = sourceFile.getLineAndCharacterOfPosition(
                    argument.getStart(sourceFile),
                );
                for (const text of leakTexts) {
                    leaks.push({
                        file,
                        line: line + 1,
                        name: node.expression.text,
                        text,
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return { leaks, callCount };
}

function readAppMessageLeaks() {
    const leaks: LeakType[] = [];
    let callCount = 0;
    for (const filePath of listSourceFiles(SRC_DIR)) {
        const sourceText = readFileSync(filePath, 'utf-8');
        if (
            ![...MESSAGE_FUNCTION_NAME_SET].some((name) => {
                return sourceText.includes(name + '(');
            })
        ) {
            continue;
        }
        const file = path
            .relative(REPO_DIR, filePath)
            .split(path.sep)
            .join('/');
        const found = findMessageLeaks(file, sourceText);
        leaks.push(...found.leaks);
        callCount += found.callCount;
    }
    return { leaks, callCount };
}

describe('every toast, alert and confirm speaks through tran()', () => {
    test('the reader finds a leak and lets a translated message be', () => {
        const { leaks, callCount } = findMessageLeaks(
            'src/x.ts',
            [
                "showSimpleToast(tran('Saving File'), 'Do not close the app');",
                'showSimpleToast(tran(TITLE), `Imported ${count} file(s)`);',
                "showAppConfirm(tran('Remove'), tran('Remove \"{name}\"?')" +
                    ".replace('{name}', name));",
                "showSimpleToast(tran('A'), x === 'self' ? tran('B') : '');",
                "showAppAlert(tranSafely('Reload'), error?.message ?? 'Oops');",
            ].join('\n'),
        );
        expect(callCount).toBe(5);
        expect(
            leaks.map(({ line, text }) => {
                return `${line} ${text}`;
            }),
        ).toEqual([
            '1 Do not close the app',
            '2 Imported ${} file(s)',
            '5 Oops',
        ]);
    });

    test('no message has an English word outside tran()', () => {
        const { leaks, callCount } = readAppMessageLeaks();
        // A reader that stopped finding calls would pass with nothing found.
        expect(callCount).toBeGreaterThan(250);
        const isAllowed = (leak: LeakType) => {
            return ALLOWED_LIST.some(({ file, text }) => {
                return file === leak.file && text === leak.text;
            });
        };
        expect(
            leaks
                .filter((leak) => {
                    return !isAllowed(leak);
                })
                .map(({ file, line, name, text }) => {
                    return `${file}:${line} ${name}: ${JSON.stringify(text)}`;
                }),
        ).toEqual([]);
        // An excuse nothing needs any more is taken out, not kept.
        expect(
            ALLOWED_LIST.filter(({ file, text }) => {
                return !leaks.some((leak) => {
                    return leak.file === file && leak.text === text;
                });
            }).map(({ file, text }) => {
                return `${file}: ${JSON.stringify(text)}`;
            }),
        ).toEqual([]);
    }, 60000);
});
