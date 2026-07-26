/**
 * The code listing that sits under every demo preview.
 *
 * The text is the demo's own source, read at run time (see
 * ./demoSourceHelpers.ts), so what is on screen is exactly what ran. Only the
 * files the open section refers to are fetched, and only once it is opened.
 */
import { useMemo, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import { COLOR } from './htmlInCanvasHelpers';
import {
    type SourceBlockType,
    SHARED_SOURCE_LIST,
    loadSourceBlockList,
} from './demoSourceHelpers';

const TOKEN_COLOR = {
    comment: '#6f7d80',
    string: '#c3e88d',
    keyword: '#c792ea',
    literal: '#f78c6c',
    number: '#f78c6c',
    tag: '#ffcb6b',
    call: '#82aaff',
};

const KEYWORD_LIST = [
    'as',
    'async',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'default',
    'delete',
    'else',
    'export',
    'extends',
    'finally',
    'for',
    'from',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'interface',
    'let',
    'new',
    'of',
    'return',
    'throw',
    'try',
    'type',
    'typeof',
    'var',
    'while',
];

const TOKEN_PATTERN = new RegExp(
    [
        String.raw`(?<comment>/\*[\s\S]*?\*/|//[^\n]*)`,
        String.raw`(?<string>\`(?:\\.|[^\\\`])*\`` +
            String.raw`|'(?:\\.|[^\\'])*'` +
            String.raw`|"(?:\\.|[^\\"])*")`,
        String.raw`(?<keyword>\b(?:${KEYWORD_LIST.join('|')})\b)`,
        String.raw`(?<literal>\b(?:true|false|null|undefined|this)\b)`,
        String.raw`(?<number>\b\d[\d_.]*\b)`,
        String.raw`(?<tag></?[A-Z][A-Za-z0-9]*)`,
        String.raw`(?<call>\b[A-Za-z_$][\w$]*(?=\())`,
    ].join('|'),
    'g',
);

type TokenType = { text: string; color: string | null };

/**
 * A deliberately small highlighter: enough to make the API calls stand out,
 * with no parser and no third-party dependency. Tokens are returned as data
 * and rendered as elements, so nothing is ever injected as HTML.
 */
function toTokenList(code: string) {
    const tokenList: TokenType[] = [];
    let lastIndex = 0;
    for (const match of code.matchAll(TOKEN_PATTERN)) {
        const groups = match.groups ?? {};
        const name = Object.keys(groups).find((key) => {
            return groups[key] !== undefined;
        });
        if (name === undefined) {
            continue;
        }
        if (match.index > lastIndex) {
            tokenList.push({
                text: code.slice(lastIndex, match.index),
                color: null,
            });
        }
        tokenList.push({
            text: match[0],
            color: TOKEN_COLOR[name as keyof typeof TOKEN_COLOR],
        });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < code.length) {
        tokenList.push({ text: code.slice(lastIndex), color: null });
    }
    return tokenList;
}

function CopyButtonComp({ code }: { code: string }) {
    const [isCopied, setIsCopied] = useState(false);

    useAppEffect(() => {
        if (!isCopied) {
            return;
        }
        const timeoutId = setTimeout(() => {
            setIsCopied(false);
        }, 1200);
        return () => {
            clearTimeout(timeoutId);
        };
    }, [isCopied]);

    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(code).then(() => {
                    setIsCopied(true);
                });
            }}
            style={{
                background: 'transparent',
                color: isCopied ? COLOR.good : COLOR.muted,
                border: `1px solid ${isCopied ? COLOR.good : COLOR.border}`,
                borderRadius: 3,
                padding: '1px 7px',
                fontSize: 11,
                cursor: 'pointer',
            }}
        >
            {isCopied ? 'copied' : 'copy'}
        </button>
    );
}

function CodeBlockComp({ block }: { block: SourceBlockType }) {
    const tokenList = useMemo(() => {
        return toTokenList(block.code);
    }, [block.code]);

    return (
        <div
            style={{
                border: `1px solid ${COLOR.border}`,
                borderRadius: 4,
                overflow: 'hidden',
                background: COLOR.panel,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '4px 8px',
                    borderBottom: `1px solid ${COLOR.border}`,
                    background: COLOR.panelSoft,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: COLOR.muted,
                }}
            >
                <span>
                    {block.fileName}
                    <span style={{ color: COLOR.accent }}>
                        {' · '}
                        {block.symbol}
                    </span>
                </span>
                <CopyButtonComp code={block.code} />
            </div>
            <pre
                style={{
                    margin: 0,
                    padding: 10,
                    maxHeight: 420,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    color: COLOR.text,
                    tabSize: 4,
                }}
            >
                {tokenList.map((token, index) => {
                    return (
                        <span
                            key={index}
                            style={
                                token.color === null
                                    ? undefined
                                    : { color: token.color }
                            }
                        >
                            {token.text}
                        </span>
                    );
                })}
            </pre>
        </div>
    );
}

function useSourceBlockList(referenceList: string[], isEnabled: boolean) {
    const [blockList, setBlockList] = useState<SourceBlockType[] | null>(null);

    useAppEffect(() => {
        if (!isEnabled) {
            return;
        }
        let isCancelled = false;
        loadSourceBlockList(referenceList).then((loadedList) => {
            if (!isCancelled) {
                setBlockList(loadedList);
            }
        });
        return () => {
            isCancelled = true;
        };
    }, [referenceList, isEnabled]);

    return blockList;
}

function LoadingComp() {
    return (
        <div style={{ fontSize: 11, color: COLOR.muted }}>loading source…</div>
    );
}

function SharedHelpersComp() {
    const [isOpen, setIsOpen] = useState(false);
    const blockList = useSourceBlockList(SHARED_SOURCE_LIST, isOpen);

    return (
        <details
            onToggle={(event) => {
                setIsOpen(event.currentTarget.open);
            }}
        >
            <summary
                style={{
                    cursor: 'pointer',
                    fontSize: 11,
                    color: COLOR.muted,
                    padding: '2px 0',
                }}
            >
                Shared helpers used by every demo
            </summary>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 8,
                }}
            >
                {blockList === null ? (
                    <LoadingComp />
                ) : (
                    blockList.map((block) => {
                        return (
                            <CodeBlockComp
                                key={`${block.fileName}#${block.symbol}`}
                                block={block}
                            />
                        );
                    })
                )}
            </div>
        </details>
    );
}

export default function DemoSourceComp({
    sourceList,
}: {
    sourceList: string[];
}) {
    const blockList = useSourceBlockList(sourceList, true);

    return (
        <div
            style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: `1px solid ${COLOR.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: COLOR.muted,
                }}
            >
                Code
            </div>
            {blockList === null ? (
                <LoadingComp />
            ) : (
                blockList.map((block) => {
                    return (
                        <CodeBlockComp
                            key={`${block.fileName}#${block.symbol}`}
                            block={block}
                        />
                    );
                })
            )}
            <SharedHelpersComp />
        </div>
    );
}
