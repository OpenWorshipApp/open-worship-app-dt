/**
 * The note editor's **••• › Link block text**, as a change (2026-11-08, the
 * user: _make chatbot able to use all toolbar operations_). In the editor a
 * person selects words, presses Link block text, selects words in another
 * block and picks how the arrow between them runs. What that makes is not a
 * node of the note: the editor keeps its links in its OWN storage
 * (`lexical-playground-block-text-links`, the app's home storage through the
 * note window's `storageManager`), each one two selections written as node
 * PATHS from the note's root -- child indices -- and offsets into the text
 * node, plus the paths of the top-level blocks each selection touches.
 *
 * This writes the same entry for words of one block (or the whole block)
 * and words of another, from the note as the change leaves it. Pure; the
 * app side appends it to the editor's storage.
 */
import { findWordRanges } from './agentNoteStyleHelpers';

type NodeType = Record<string, any>;

/** How the arrow runs: the editor's own six, the first its default here. */
export const NOTE_BLOCK_LINK_KIND_LIST = [
    'direction-to',
    'direction-from',
    'no-direction',
    'weak-direction-to',
    'weak-direction-from',
    'weak-no-direction',
] as const;

/** The editor's own storage key for its block links. */
export const NOTE_BLOCK_LINK_STORAGE_KEY =
    'lexical-playground-block-text-links';

type PointType = { offset: number; path: number[] };
type LinkEndType = {
    anchor: PointType;
    focus: PointType;
    blockPaths: number[][];
};
export type NoteBlockLinkType = {
    from: LinkEndType;
    id: string;
    kind: (typeof NOTE_BLOCK_LINK_KIND_LIST)[number];
    to: LinkEndType;
};

function checkIsNode(value: unknown): value is NodeType {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A node's path from the root: the child index at every level. */
export function findNodePath(
    root: NodeType,
    target: NodeType,
): number[] | null {
    const walk = (node: NodeType, path: number[]): number[] | null => {
        const children = Array.isArray(node.children) ? node.children : [];
        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            if (child === target) {
                return [...path, index];
            }
            if (checkIsNode(child)) {
                const found = walk(child, [...path, index]);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    };
    return walk(root, []);
}

type TextSlotType = { node: NodeType; start: number; end: number };

/** The block's text nodes in order, each with where it sits in the words. */
function collectTextSlots(block: NodeType) {
    const slots: TextSlotType[] = [];
    let text = '';
    const visit = (node: NodeType) => {
        for (const child of Array.isArray(node.children) ? node.children : []) {
            if (!checkIsNode(child)) {
                continue;
            }
            if (child.type === 'list' && block.type === 'listitem') {
                continue;
            }
            if (child.type === 'linebreak') {
                text += '\n';
                continue;
            }
            if (typeof child.text === 'string') {
                slots.push({
                    node: child,
                    start: text.length,
                    end: text.length + child.text.length,
                });
                text += child.text;
                continue;
            }
            visit(child);
        }
    };
    visit(block);
    return { slots, text };
}

/** One end of a link: the words of a block, or the whole block. */
function genLinkEnd(
    root: NodeType,
    block: NodeType,
    words: string | undefined,
): LinkEndType | { reason: string } {
    const topIndex = root.children.findIndex((child: NodeType) => {
        return child === block || findNodePath(child, block) !== null;
    });
    if (topIndex < 0) {
        return { reason: 'That block is not in the note any more.' };
    }
    const blockPaths = [[topIndex]];
    const { slots, text } = collectTextSlots(block);
    // A link joins WORDS: one to an empty line was stored and never drawn
    // (seen live 2026-11-08, "the last line" being an empty paragraph).
    if (slots.length === 0 || text.trim() === '') {
        return {
            reason:
                'The block has no words to link: a link joins words of two ' +
                'blocks -- choose blocks that have words.',
        };
    }
    let start = 0;
    let end = text.length;
    if (words !== undefined && words.trim() !== '') {
        const range = findWordRanges(text, words.trim())[0];
        if (range === undefined) {
            return { reason: `The block does not have the words "${words}".` };
        }
        [start, end] = range;
    }
    const pointAt = (offset: number, isEnd: boolean): PointType => {
        const slot =
            slots.find((one) => {
                return isEnd
                    ? offset > one.start && offset <= one.end
                    : offset >= one.start && offset < one.end;
            }) ?? (isEnd ? slots[slots.length - 1] : slots[0]);
        return {
            offset: Math.max(
                0,
                Math.min(offset - slot.start, String(slot.node.text).length),
            ),
            path: findNodePath(root, slot.node)!,
        };
    };
    return {
        anchor: pointAt(start, false),
        focus: pointAt(end, true),
        blockPaths,
    };
}

function genLinkId(now: Date) {
    return (
        `block-text-link-${now.getTime()}-` +
        Math.random().toString(36).slice(2)
    );
}

/** The editor's link entry from words of one block to another block. */
export function genNoteBlockLink({
    root,
    fromBlock,
    fromWords,
    toBlock,
    toWords,
    kind = 'direction-to',
    now = new Date(),
    genId,
}: {
    root: NodeType;
    fromBlock: NodeType;
    fromWords?: string;
    toBlock: NodeType;
    toWords?: string;
    kind?: string;
    now?: Date;
    genId?: () => string;
}): { link: NoteBlockLinkType } | { reason: string } {
    if (!(NOTE_BLOCK_LINK_KIND_LIST as readonly string[]).includes(kind)) {
        return {
            reason: `\`linkKind\` is one of ${NOTE_BLOCK_LINK_KIND_LIST.join(', ')}.`,
        };
    }
    if (fromBlock === toBlock) {
        return { reason: 'A block link joins two different blocks.' };
    }
    const from = genLinkEnd(root, fromBlock, fromWords);
    if ('reason' in from) {
        return from;
    }
    const to = genLinkEnd(root, toBlock, toWords);
    if ('reason' in to) {
        return {
            reason: to.reason.replace('The block', 'The block linked to'),
        };
    }
    return {
        link: {
            from,
            id:
                genId === undefined
                    ? genLinkId(now)
                    : `block-text-link-${genId()}`,
            kind: kind as NoteBlockLinkType['kind'],
            to,
        },
    };
}

/** The editor's stored links, read back; a broken value is no links. */
export function readNoteBlockLinks(text: string | null): NoteBlockLinkType[] {
    if (text === null) {
        return [];
    }
    try {
        const list = JSON.parse(text);
        return Array.isArray(list) ? list : [];
    } catch (_error) {
        return [];
    }
}
