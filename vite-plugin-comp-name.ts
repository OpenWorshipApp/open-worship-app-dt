import { parse } from '@babel/parser';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';

const ATTRIBUTE_NAME = 'data-react-comp-name';
const FILE_PATH_ATTRIBUTE_NAME = 'data-react-comp-fp';
const COMP_NAME_REGEX = /^[A-Z][A-Za-z0-9_]*Comp$/;

type AstNode = {
    type: string;
    start: number;
    end: number;
    [key: string]: any;
};

function isFunctionNode(node: AstNode) {
    return (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
    );
}

/**
 * Collect the JSX elements that can end up as the root DOM element of a
 * returned expression: the element itself, both branches of
 * ternary/logical expressions, direct element children of a fragment, and
 * expressions behind TS casts. Custom-component roots (capitalized tags)
 * are collected too and filtered out later in `stampElement`.
 */
function collectRootJsxElements(node: AstNode | null, out: AstNode[]) {
    if (!node) {
        return;
    }
    switch (node.type) {
        case 'JSXElement':
            out.push(node);
            break;
        case 'JSXFragment':
            for (const child of node.children ?? []) {
                if (child.type === 'JSXElement') {
                    out.push(child);
                }
            }
            break;
        case 'ConditionalExpression':
            collectRootJsxElements(node.consequent, out);
            collectRootJsxElements(node.alternate, out);
            break;
        case 'LogicalExpression':
            collectRootJsxElements(node.left, out);
            collectRootJsxElements(node.right, out);
            break;
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
        case 'ParenthesizedExpression':
            collectRootJsxElements(node.expression, out);
            break;
    }
}

function stampElement(
    jsxElement: AstNode,
    compName: string,
    srcFilePath: string | null,
    s: MagicString,
) {
    const opening = jsxElement.openingElement;
    const tag = opening.name;
    // Only host elements (lowercase tags) map directly onto a DOM element.
    // A component root stamps its own name when it is transformed itself.
    if (tag.type !== 'JSXIdentifier' || !/^[a-z]/.test(tag.name)) {
        return false;
    }
    const hasAttributeAlready = (attributeName: string) => {
        return (opening.attributes ?? []).some((attribute: AstNode) => {
            return (
                attribute.type === 'JSXAttribute' &&
                attribute.name?.name === attributeName
            );
        });
    };
    let insertion = '';
    if (!hasAttributeAlready(ATTRIBUTE_NAME)) {
        insertion += ` ${ATTRIBUTE_NAME}="${compName}"`;
    }
    if (
        srcFilePath !== null &&
        !hasAttributeAlready(FILE_PATH_ATTRIBUTE_NAME)
    ) {
        insertion += ` ${FILE_PATH_ATTRIBUTE_NAME}="${srcFilePath}"`;
    }
    if (insertion === '') {
        return false;
    }
    s.appendLeft(tag.end, insertion);
    return true;
}

type ReturnCallback = (expression: AstNode, compName: string) => void;

const SKIPPED_KEYS = new Set([
    'loc',
    'leadingComments',
    'trailingComments',
    'innerComments',
    'extra',
]);

/**
 * Walk the AST tracking which `*Comp` function the traversal is inside.
 * `compName` resets at every function boundary so returns of nested
 * callbacks, hooks and helper closures are never mistaken for the
 * component root.
 */
function walk(node: any, compName: string | null, onReturn: ReturnCallback) {
    if (!node || typeof node !== 'object') {
        return;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            walk(child, compName, onReturn);
        }
        return;
    }
    if (typeof node.type !== 'string') {
        return;
    }
    switch (node.type) {
        case 'VariableDeclarator':
            if (
                node.init &&
                isFunctionNode(node.init) &&
                node.id?.type === 'Identifier'
            ) {
                walkFunction(node.init, node.id.name, onReturn);
                return;
            }
            break;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
            walkFunction(node, node.id?.name ?? null, onReturn);
            return;
        case 'ArrowFunctionExpression':
        case 'ObjectMethod':
        case 'ClassMethod':
        case 'ClassPrivateMethod':
            walkFunction(node, null, onReturn);
            return;
        case 'ReturnStatement':
            if (compName && node.argument) {
                onReturn(node.argument, compName);
            }
            break;
    }
    for (const key of Object.keys(node)) {
        if (!SKIPPED_KEYS.has(key)) {
            walk(node[key], compName, onReturn);
        }
    }
}

function walkFunction(
    fnNode: AstNode,
    name: string | null,
    onReturn: ReturnCallback,
) {
    const effectiveName =
        name !== null && COMP_NAME_REGEX.test(name) ? name : null;
    if (
        effectiveName !== null &&
        fnNode.type === 'ArrowFunctionExpression' &&
        fnNode.body?.type !== 'BlockStatement'
    ) {
        // Implicit return of an expression-bodied arrow component.
        onReturn(fnNode.body, effectiveName);
    }
    walk(fnNode.params, null, onReturn);
    walk(fnNode.body, effectiveName, onReturn);
}

/**
 * Map an absolute module path to its project-relative form starting at
 * `src/` (e.g. `src/app-document-presenter/items/VarySlidesComp.tsx`),
 * mirroring `toDistRelativePath` in `vite-plugin-gz-bundle.ts`. Returns
 * `null` for files outside `src`.
 */
function toSrcRelativePath(filePath: string) {
    const normalized = filePath.replace(/\\/g, '/');
    const marker = '/src/';
    const index = normalized.lastIndexOf(marker);
    if (index === -1) {
        return null;
    }
    return normalized.slice(index + 1);
}

export function transformCompName(code: string, filePath: string) {
    if (!filePath.endsWith('.tsx') || filePath.includes('node_modules')) {
        return null;
    }
    // Cheap bail-out for files that cannot contain a `*Comp` component.
    if (!code.includes('Comp')) {
        return null;
    }
    let ast: any;
    try {
        ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
    } catch (_error) {
        // Leave syntax errors to the real compiler (SWC) to report.
        return null;
    }
    const srcFilePath = toSrcRelativePath(filePath);
    const s = new MagicString(code);
    let isChanged = false;
    walk(ast.program, null, (expression, compName) => {
        const rootElements: AstNode[] = [];
        collectRootJsxElements(expression, rootElements);
        for (const element of rootElements) {
            if (stampElement(element, compName, srcFilePath, s)) {
                isChanged = true;
            }
        }
    });
    if (!isChanged) {
        return null;
    }
    return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
    };
}

/**
 * Stamp `data-react-comp-name="<ComponentName>"` and
 * `data-react-comp-fp="src/<path>.tsx"` onto the root DOM element of every
 * React function component at build time, e.g.:
 *
 * ```tsx
 * // src/foo/FooComp.tsx
 * function FooComp() {
 *     return <div className="foo">...</div>;
 * }
 * // becomes
 * function FooComp() {
 *     return (
 *         <div
 *             data-react-comp-name="FooComp"
 *             data-react-comp-fp="src/foo/FooComp.tsx"
 *             className="foo"
 *         >
 *             ...
 *         </div>
 *     );
 * }
 * ```
 *
 * A function counts as a component when its name matches the project
 * convention `*Comp` (declaration name, expression name or the variable it
 * is assigned to). Every `return` whose root resolves to a host element is
 * stamped, including both branches of ternaries and the direct element
 * children of a root fragment. Components whose root is another component
 * are left alone — the inner component stamps its own name, so the DOM
 * carries the innermost name only. Runs with `enforce: 'pre'` so the
 * source is plain TSX, before SWC compiles the JSX away.
 *
 * Dev-server only (`apply: 'serve'`): production builds get no attributes,
 * keeping the shipped DOM free of debug metadata and source paths.
 */
export function compNameAttributePlugin(): Plugin {
    return {
        name: 'comp-name-attribute',
        apply: 'serve',
        enforce: 'pre',
        transform(code, id) {
            const filePath = id.split('?')[0];
            return transformCompName(code, filePath);
        },
    };
}
