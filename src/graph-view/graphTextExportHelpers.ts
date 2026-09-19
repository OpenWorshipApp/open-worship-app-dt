import type { GraphEdgeType, GraphRelationDefType } from './core';
import type { GraphExportNodeType } from './graphExportHelpers';

/**
 * Turning the graph into TEXT: a Markdown document for a note, and the same
 * graph as a diagram somebody else's tool can redraw — in five diagram
 * languages, because which one is right depends entirely on what it is being
 * pasted into (`GRAPH_DIAGRAM_FORMAT_LIST`). The document itself carries the
 * default one in a `mermaid` fence, so pasting the Markdown somewhere brings
 * the picture with it.
 *
 * ONE walk over the same node and edge lists feeds them all, for the same reason
 * `graphExportHelpers` serializes once for the saved picture and the printed
 * page: two copies that disagreed about which boxes are on screen would be
 * worse than either on its own.
 *
 * PURE — no React, no DOM, no app imports (both imports here are types, and
 * are erased), so each builder is testable without a running app. Record
 * wording arrives already resolved and is translated through the injected
 * `translate`, which is the LOOKUP language's dictionary rather than the
 * interface locale: the boxes follow the records, so a copy of them does too.
 *
 * The structural furniture — `## Records`, `flowchart`, `centre` — stays
 * English on purpose. This is an interchange document rather than a control:
 * Mermaid has no other keyword vocabulary, and what is copied leaves the app
 * for a note, an issue or another program, where the headings are read by
 * whoever receives it. Everything that came out of the dataset — names, types,
 * descriptions, relation words — is in the reader's own language.
 */

export type GraphTextExportOptionsType = {
    title: string;
    // Marked as the centre, and listed first: the box every other one was
    // reached from is the one a reader needs to find at a glance.
    rootKey: string;
    nodeList: readonly GraphExportNodeType[];
    edgeList: readonly GraphEdgeType[];
    relationDefList: readonly GraphRelationDefType[];
    // Already translated and already gendered by the record the edge points
    // at — the same resolver the canvas and the SVG label their lines with.
    resolveEdge: (edge: GraphEdgeType) => {
        label: string;
        isDirected: boolean;
    };
    translate: (key: string) => string;
};

/** Which diagram language a copy is written in. */
export type GraphDiagramFormatType =
    | 'mermaid-flowchart-lr'
    | 'mermaid-flowchart-td'
    | 'mermaid-mindmap'
    | 'graphviz-dot'
    | 'plantuml';

export type GraphDiagramFormatDefType = {
    key: GraphDiagramFormatType;
    // A raw English `tran` key, and the MENU ROW itself — which is why it is
    // written short. A context menu in this app is 210px wide and clips what
    // does not fit, and the first cut of this list put
    // `Copy as Mermaid Flowchart (left to right)` next to
    // `Copy as Mermaid Flowchart (top down)`: both drew as
    // `Copy as Mermaid Flowchar…`, two identical rows doing different things.
    label: string;
    // The unabbreviated name, on the row's hover and on the toast that
    // confirms the copy — both have the room the row does not.
    title: string;
    // The format's own name with no verb in front of it, for a row that does
    // something OTHER than copy — the Mermaid Live Editor menu is the first.
    // Kept as its own key rather than cut out of `label`, which is translated
    // as a whole phrase and does not come apart in every language.
    name: string;
    iconName: string;
    // What a markdown fence would call it, which is also the file extension
    // each ecosystem uses.
    fenceLanguage: string;
};

/**
 * The diagram languages on offer, in menu order.
 *
 * FIVE rather than one, because "which diagram format" is not a question this
 * app can answer for the user: it depends entirely on what they are pasting
 * INTO. Mermaid is what a markdown viewer draws (a repository, a notes app,
 * this app's own preview) and comes in three shapes, since the one graph is
 * read differently as a fan, as a chain and as a hierarchy. DOT and PlantUML
 * are here because a Mermaid-only menu quietly excludes everyone whose tool
 * reads one of those instead — they are the two most widely understood
 * diagram languages outside it.
 *
 * Adding a format is adding a row here plus a branch in `buildGraphDiagram`
 * and a Khmer key for the label; nothing else knows the list's length.
 */
export const GRAPH_DIAGRAM_FORMAT_LIST: readonly GraphDiagramFormatDefType[] = [
    {
        key: 'mermaid-flowchart-lr',
        label: 'Copy as Mermaid (across)',
        title: 'Copy as Mermaid Flowchart (left to right)',
        name: 'Mermaid (across)',
        iconName: 'diagram-3',
        fenceLanguage: 'mermaid',
    },
    {
        key: 'mermaid-flowchart-td',
        label: 'Copy as Mermaid (down)',
        title: 'Copy as Mermaid Flowchart (top down)',
        name: 'Mermaid (down)',
        iconName: 'diagram-2',
        fenceLanguage: 'mermaid',
    },
    {
        key: 'mermaid-mindmap',
        label: 'Copy as Mermaid Mindmap',
        title: 'Copy as Mermaid Mindmap',
        name: 'Mermaid Mindmap',
        iconName: 'share',
        fenceLanguage: 'mermaid',
    },
    {
        key: 'graphviz-dot',
        label: 'Copy as Graphviz DOT',
        title: 'Copy as Graphviz DOT',
        name: 'Graphviz DOT',
        iconName: 'braces',
        fenceLanguage: 'dot',
    },
    {
        key: 'plantuml',
        label: 'Copy as PlantUML',
        title: 'Copy as PlantUML',
        name: 'PlantUML',
        iconName: 'file-earmark-code',
        fenceLanguage: 'plantuml',
    },
];

/**
 * The formats the Mermaid Live Editor can be handed, in menu order.
 *
 * DERIVED from `fenceLanguage` rather than declared a second time: the editor
 * takes exactly what a `mermaid` fence holds, so a sixth Mermaid shape added
 * above joins this menu by saying what it IS, and a DOT or PlantUML row can
 * never reach it through a flag someone set by hand. `mermaid.live` is the
 * only editor any of these five open in — see `src/helper/mermaidLiveHelpers`.
 */
export const MERMAID_LIVE_FORMAT_LIST: readonly GraphDiagramFormatDefType[] =
    GRAPH_DIAGRAM_FORMAT_LIST.filter((definition) => {
        return definition.fenceLanguage === 'mermaid';
    });

/**
 * What the Markdown document carries.
 *
 * Mermaid, because a markdown VIEWER is what has to draw it: a repository, a
 * notes app, a static site and this app's own preview all render a `mermaid`
 * block and none of them renders DOT or PlantUML, so embedding either would
 * put a block in the document that nothing anywhere draws. Left to right for
 * the reason `buildMermaidFlowchart` gives.
 */
export const MARKDOWN_DIAGRAM_FORMAT: GraphDiagramFormatType =
    'mermaid-flowchart-lr';

/**
 * A dataset description can carry newlines, and both formats are line-based —
 * Markdown would break out of its table cell and Mermaid out of its statement.
 */
function toOneLine(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}

/** `ដាវីឌ (David)`, exactly as the box writes it. */
function toNodeLabel(item: GraphExportNodeType) {
    const name = toOneLine(item.view?.name ?? item.node.name);
    const kjvName = toOneLine(item.view?.kjvName ?? '');
    return kjvName === '' || kjvName === name ? name : `${name} (${kjvName})`;
}

/** Root first, then the order the graph itself holds. */
function toOrderedNodeList(options: GraphTextExportOptionsType) {
    const rootList = options.nodeList.filter((item) => {
        return item.node.key === options.rootKey;
    });
    if (rootList.length === 0) {
        return [...options.nodeList];
    }
    return [
        ...rootList,
        ...options.nodeList.filter((item) => {
            return item.node.key !== options.rootKey;
        }),
    ];
}

/**
 * Edges bucketed by relation, in the source's own chip order.
 *
 * A canonical kind is declared TWICE — `parent` and `child` are one stored
 * line — and a heading has to read from the end the edge points AT, so the
 * definition whose `canonicalFrom` is `origin` wins: a stored parent -> child
 * edge belongs under `Children`, never under `Parents`. A relation with no
 * definition at all keeps its raw kind rather than being dropped.
 */
function toRelationGroupList(options: GraphTextExportOptionsType) {
    const definitionByKind = new Map<string, GraphRelationDefType>();
    for (const definition of options.relationDefList) {
        const existing = definitionByKind.get(definition.canonicalKind);
        if (
            existing === undefined ||
            (existing.canonicalFrom !== 'origin' &&
                definition.canonicalFrom === 'origin')
        ) {
            definitionByKind.set(definition.canonicalKind, definition);
        }
    }
    const edgeListByKind = new Map<string, GraphEdgeType[]>();
    for (const edge of options.edgeList) {
        const edgeList = edgeListByKind.get(edge.relation);
        if (edgeList === undefined) {
            edgeListByKind.set(edge.relation, [edge]);
        } else {
            edgeList.push(edge);
        }
    }
    const groupList: { label: string; edgeList: GraphEdgeType[] }[] = [];
    for (const [kind, definition] of definitionByKind) {
        const edgeList = edgeListByKind.get(kind);
        if (edgeList !== undefined) {
            groupList.push({
                label: options.translate(definition.label),
                edgeList,
            });
            edgeListByKind.delete(kind);
        }
    }
    for (const [kind, edgeList] of edgeListByKind) {
        groupList.push({ label: options.translate(kind), edgeList });
    }
    return groupList;
}

/** A pipe would end the cell it sits in. */
function toTableCell(value: string) {
    return toOneLine(value).replace(/\|/g, '\\|');
}

/**
 * How many of a record's references are written out.
 *
 * Measured on the live panel: David's own graph opened to 29 boxes copied as
 * 19KB, of which 15KB was references — Solomon alone cites 174 and wrote a
 * single four-thousand-character line. The box on screen shows a COUNT and
 * keeps the list behind its Verses button, so a copy that dumps every one of
 * them is not what was on screen either. Twelve covers the great majority of
 * records whole, and the ones it does not say how many are missing rather than
 * trailing off.
 */
const MARKDOWN_VERSE_LIMIT = 12;

function toVerseLine(verseList: readonly string[]) {
    if (verseList.length <= MARKDOWN_VERSE_LIMIT) {
        return verseList.join(', ');
    }
    const shown = verseList.slice(0, MARKDOWN_VERSE_LIMIT).join(', ');
    return `${shown} _(+${verseList.length - MARKDOWN_VERSE_LIMIT} more)_`;
}

/**
 * The Mermaid diagram inside a fence, ready to paste into a document.
 *
 * The fence GROWS past any run of backticks in the diagram, which is what a
 * nested fence needs: a record whose name carried ``` would otherwise end the
 * block early and spill the rest of the diagram into the page as prose.
 */
function toMermaidBlock(diagram: string) {
    let fence = '```';
    while (diagram.includes(fence)) {
        fence += '`';
    }
    return [`${fence}mermaid`, diagram.trimEnd(), fence];
}

/**
 * The graph as a Markdown document: the picture, what is in it, how it is
 * joined, and what it cites.
 *
 * Four sections, each answering one question, and each left out when it has
 * nothing to say.
 *
 * **The diagram leads**, in a `mermaid` fence, because a document about a
 * graph should show the graph: everywhere markdown is actually rendered — the
 * app's own preview, a wiki, a repository, a notes app — that block draws the
 * same boxes and lines the canvas has, and the tables below it are the detail
 * behind the picture rather than a substitute for it. Where nothing renders
 * mermaid it is a code block plainly labelled as a diagram, which a reader
 * skips in one go. The diagram rows on the menu still exist for the other
 * half of the job: handing a drawing ALONE to something that wants only that
 * (a `.mmd` or `.dot` file, a wiki's `@startuml` block, a tool's own diagram
 * field).
 *
 * The references are the dataset's own canonical keys (`1SA 16:1`) rather than
 * the titles the Verses list shows: naming a reference the way the reader's
 * bible names it is one bible READ per reference, and a copy has to be
 * instant. They are capped — see `MARKDOWN_VERSE_LIMIT`.
 */
export function buildGraphMarkdown(
    options: GraphTextExportOptionsType,
): string {
    const nodeList = toOrderedNodeList(options);
    const labelByKey = new Map(
        nodeList.map((item) => {
            return [item.node.key, toNodeLabel(item)];
        }),
    );
    const lineList: string[] = [
        `# ${toOneLine(options.title)}`,
        '',
        `Connection graph — ${nodeList.length} ` +
            `${nodeList.length === 1 ? 'record' : 'records'}, ` +
            `${options.edgeList.length} ` +
            `${options.edgeList.length === 1 ? 'connection' : 'connections'}.`,
    ];
    if (nodeList.length > 0) {
        // Skipped with no records at all, rather than fencing a `flowchart`
        // that declares nothing: an empty diagram is a parse error wherever
        // this lands, and a document is not the place to find that out.
        lineList.push(
            '',
            '## Diagram',
            '',
            ...toMermaidBlock(
                buildGraphDiagram(options, MARKDOWN_DIAGRAM_FORMAT),
            ),
        );
        lineList.push(
            '',
            '## Records',
            '',
            '| Record | Type | About |',
            '| --- | --- | --- |',
        );
        for (const item of nodeList) {
            const isRoot = item.node.key === options.rootKey;
            const name =
                `**${toTableCell(labelByKey.get(item.node.key) ?? '')}**` +
                (isRoot ? ' _(centre)_' : '');
            const type = toTableCell(
                options.translate(item.view?.caption ?? ''),
            );
            const about = toTableCell(item.view?.title ?? '');
            lineList.push(`| ${name} | ${type} | ${about} |`);
        }
    }
    const groupList = toRelationGroupList(options);
    if (groupList.length > 0) {
        lineList.push('', '## Connections');
        for (const group of groupList) {
            lineList.push('', `### ${toOneLine(group.label)}`, '');
            for (const edge of group.edgeList) {
                const from = labelByKey.get(edge.fromKey);
                const to = labelByKey.get(edge.toKey);
                if (from === undefined || to === undefined) {
                    continue;
                }
                const { label, isDirected } = options.resolveEdge(edge);
                // An arrow only where the two ends mean different things: a
                // spouse line drawn with one would claim a direction the
                // dataset never states.
                lineList.push(
                    `- **${from}** ${isDirected ? '→' : '↔'} **${to}**` +
                        (label === '' ? '' : ` — ${toOneLine(label)}`),
                );
            }
        }
    }
    const verseItemList = nodeList.filter((item) => {
        return (item.view?.verseList.length ?? 0) > 0;
    });
    if (verseItemList.length > 0) {
        lineList.push('', '## References', '');
        for (const item of verseItemList) {
            lineList.push(
                `- **${labelByKey.get(item.node.key) ?? ''}**: ` +
                    toVerseLine(item.view?.verseList ?? []),
            );
        }
    }
    return `${lineList.join('\n')}\n`;
}

/**
 * Mermaid reads a label as markup, so anything it could take as syntax is
 * written as an entity instead. `&` goes FIRST or the `#` replacement's own
 * ampersand is escaped in turn and the reader sees `&#35;` as text; `#` needs
 * replacing at all because it opens an entity in Mermaid, and `"` would close
 * the quoted label it sits in.
 */
function toMermaidText(value: string) {
    return toOneLine(value)
        .replace(/&/g, '&amp;')
        .replace(/#/g, '&#35;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** A class name per record type, which the dataset writes free-form. */
function toMermaidClassName(typeKey: string) {
    const cleaned = typeKey
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
    return `type-${cleaned === '' ? 'unknown' : cleaned}`;
}

/** One id per box, in the order the document lists them. */
function toIdByKey(nodeList: readonly GraphExportNodeType[]) {
    const idByKey = new Map<string, string>();
    for (const item of nodeList) {
        idByKey.set(item.node.key, `n${idByKey.size}`);
    }
    return idByKey;
}

/**
 * The graph as a Mermaid `flowchart`.
 *
 * `flowchart` is the kind that carries this graph's whole shape: arrows where
 * a relation has two different ends and plain lines where it has not, a label
 * on every line, and arbitrary cross-links.
 *
 * `LR` is the DEFAULT, which is not the family-tree convention and is what the
 * rendered diagram actually asks for. A graph in this panel is nearly always
 * one record with everything it was expanded to around it, and `TD` lays that
 * fan out as a single row: David's own graph, copied at 29 boxes and drawn in
 * the app's markdown preview, came out as a strip 28 boxes wide, squeezed to
 * the page width, with nothing in it readable. The same diagram as `LR` is a
 * column of full-size boxes with their relation words legible beside them. A
 * document is read down a page — vertical room is free, horizontal room ends
 * at the viewer's width. `TD` is offered as well because the shape it is bad
 * at is not the only shape a graph takes: a found PATH is a chain, and a chain
 * reads down the page the way a family tree is drawn.
 *
 * Boxes are coloured by the same per-type accent the canvas uses, as a STROKE
 * only: these hues are chosen to sit on the app's own surface, and a fill
 * would fight whichever theme the diagram is finally drawn in.
 */
function buildMermaidFlowchart(
    options: GraphTextExportOptionsType,
    direction: 'LR' | 'TD',
): string {
    const nodeList = toOrderedNodeList(options);
    const idByKey = toIdByKey(nodeList);
    const lineList: string[] = [
        `%% ${toOneLine(options.title)} — connection graph`,
        `flowchart ${direction}`,
    ];
    const idListByClassName = new Map<string, string[]>();
    const colorByClassName = new Map<string, string>();
    for (const item of nodeList) {
        const id = idByKey.get(item.node.key) ?? '';
        const caption = toMermaidText(
            options.translate(item.view?.caption ?? ''),
        );
        const label =
            toMermaidText(toNodeLabel(item)) +
            (caption === '' ? '' : `<br/>${caption}`);
        lineList.push(`    ${id}["${label}"]`);
        const className = toMermaidClassName(item.view?.typeKey ?? '');
        const idList = idListByClassName.get(className);
        if (idList === undefined) {
            idListByClassName.set(className, [id]);
            colorByClassName.set(className, item.typeColor);
        } else {
            idList.push(id);
        }
    }
    for (const edge of options.edgeList) {
        const fromId = idByKey.get(edge.fromKey);
        const toId = idByKey.get(edge.toKey);
        if (fromId === undefined || toId === undefined) {
            continue;
        }
        const { label, isDirected } = options.resolveEdge(edge);
        const link = isDirected ? '-->' : '---';
        lineList.push(
            label === ''
                ? `    ${fromId} ${link} ${toId}`
                : `    ${fromId} ${link}|"${toMermaidText(label)}"| ${toId}`,
        );
    }
    for (const [className, idList] of idListByClassName) {
        const color = (colorByClassName.get(className) ?? '').trim();
        // The colour is read off a live stylesheet, so anything that could end
        // the `classDef` statement means no statement at all rather than a
        // diagram that fails to parse.
        if (color === '' || /[,;"\s]/.test(color)) {
            continue;
        }
        lineList.push(
            `    classDef ${className} stroke:${color},stroke-width:2px`,
            `    class ${idList.join(',')} ${className}`,
        );
    }
    return `${lineList.join('\n')}\n`;
}

/**
 * The spanning tree a hierarchy format has to be given.
 *
 * Breadth-first from the centre, keeping the FIRST line that reaches each
 * record, because that is the shortest way there and the one a reader of a
 * tree expects to see. Walked undirected: the graph's arrows say what a
 * relation MEANS, not which way it was explored, and a tree built only along
 * them would drop a whole family whenever the centre happens to be someone's
 * child. Anything the centre cannot reach — a relation filter can cut the
 * graph in two — is returned as a child of the centre rather than left out.
 */
function toChildKeyListByKey(
    options: GraphTextExportOptionsType,
    nodeList: readonly GraphExportNodeType[],
) {
    const neighbourKeyListByKey = new Map<string, string[]>();
    const addNeighbour = (fromKey: string, toKey: string) => {
        const list = neighbourKeyListByKey.get(fromKey);
        if (list === undefined) {
            neighbourKeyListByKey.set(fromKey, [toKey]);
        } else {
            list.push(toKey);
        }
    };
    const keySet = new Set(
        nodeList.map((item) => {
            return item.node.key;
        }),
    );
    for (const edge of options.edgeList) {
        if (!keySet.has(edge.fromKey) || !keySet.has(edge.toKey)) {
            continue;
        }
        addNeighbour(edge.fromKey, edge.toKey);
        addNeighbour(edge.toKey, edge.fromKey);
    }
    const rootKey = keySet.has(options.rootKey)
        ? options.rootKey
        : (nodeList[0]?.node.key ?? '');
    const childKeyListByKey = new Map<string, string[]>();
    const seenKeySet = new Set([rootKey]);
    const queue = [rootKey];
    while (queue.length > 0) {
        const key = queue.shift() as string;
        for (const neighbourKey of neighbourKeyListByKey.get(key) ?? []) {
            if (seenKeySet.has(neighbourKey)) {
                continue;
            }
            seenKeySet.add(neighbourKey);
            const childKeyList = childKeyListByKey.get(key);
            if (childKeyList === undefined) {
                childKeyListByKey.set(key, [neighbourKey]);
            } else {
                childKeyList.push(neighbourKey);
            }
            queue.push(neighbourKey);
        }
    }
    for (const item of nodeList) {
        if (seenKeySet.has(item.node.key)) {
            continue;
        }
        seenKeySet.add(item.node.key);
        const childKeyList = childKeyListByKey.get(rootKey);
        if (childKeyList === undefined) {
            childKeyListByKey.set(rootKey, [item.node.key]);
        } else {
            childKeyList.push(item.node.key);
        }
    }
    return { rootKey, childKeyListByKey };
}

/**
 * The graph as a Mermaid `mindmap`: the centre, and what hangs off it.
 *
 * A mindmap is a TREE and a graph is not, so this is the one format that
 * cannot say everything the canvas does, and what it drops it drops FOR a
 * reason rather than by accident: a second line between two records already
 * on the tree has nowhere to go, and there are no edge labels in the format at
 * all — so the relation words (`son`, `wife`) are absent rather than guessed.
 * They would have to be, even if the format had somewhere to put them: an edge
 * is labelled from the end it POINTS AT, and a tree walked outwards crosses
 * half of them the other way, which would caption a father `son`.
 *
 * It is here because a fan of relatives around one person is exactly what a
 * mindmap draws well, and it is the cleanest of the five to read at a glance.
 */
function buildMermaidMindmap(options: GraphTextExportOptionsType): string {
    const nodeList = toOrderedNodeList(options);
    const itemByKey = new Map(
        nodeList.map((item) => {
            return [item.node.key, item];
        }),
    );
    const idByKey = toIdByKey(nodeList);
    const { rootKey, childKeyListByKey } = toChildKeyListByKey(
        options,
        nodeList,
    );
    const lineList: string[] = [
        `%% ${toOneLine(options.title)} — connection graph`,
        'mindmap',
    ];
    const writeNode = (key: string, depth: number) => {
        const item = itemByKey.get(key);
        if (item === undefined) {
            return;
        }
        const caption = toMermaidText(
            options.translate(item.view?.caption ?? ''),
        );
        const label =
            toMermaidText(toNodeLabel(item)) +
            (caption === '' ? '' : ` · ${caption}`);
        const id = idByKey.get(key) ?? '';
        // The centre is drawn as a circle, everything else as a rounded box:
        // a mindmap has no other way to say which node the graph is about.
        lineList.push(
            '  '.repeat(depth + 1) +
                (depth === 0 ? `${id}(("${label}"))` : `${id}("${label}")`),
        );
        for (const childKey of childKeyListByKey.get(key) ?? []) {
            writeNode(childKey, depth + 1);
        }
    };
    writeNode(rootKey, 0);
    return `${lineList.join('\n')}\n`;
}

/**
 * A quoted DOT string. The backslash goes first, or the escape this adds for a
 * quote is itself escaped and the quote reaches the parser bare.
 */
function toDotText(value: string) {
    return toOneLine(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The graph as Graphviz DOT.
 *
 * The oldest and most widely READ of these formats — VS Code extensions,
 * Obsidian plugins, `dot -Tpng`, half the diagram tools in existence — and the
 * reason a Mermaid-only menu was not enough.
 *
 * A `digraph` throughout, with the undirected relations drawn as `dir=none`
 * rather than split into a second `graph`: one statement list keeps every box
 * in one layout, and a mixed graph is what this data IS. `\n` inside a label
 * is DOT's own line break, not an escape this code has to spell out twice.
 */
function buildGraphvizDot(options: GraphTextExportOptionsType): string {
    const nodeList = toOrderedNodeList(options);
    const idByKey = toIdByKey(nodeList);
    const lineList: string[] = [
        `// ${toOneLine(options.title)} — connection graph`,
        `digraph "${toDotText(options.title)}" {`,
        '    rankdir=LR;',
        '    node [shape=box, style="rounded", fontsize=11];',
        '    edge [fontsize=9];',
    ];
    for (const item of nodeList) {
        const id = idByKey.get(item.node.key) ?? '';
        const caption = toDotText(options.translate(item.view?.caption ?? ''));
        const label =
            toDotText(toNodeLabel(item)) +
            (caption === '' ? '' : `\\n${caption}`);
        const color = item.typeColor.trim();
        // Same rule as the Mermaid `classDef`: a colour read off a live
        // stylesheet that could end the attribute list is left out.
        const colorPart = /^[#\w]+$/.test(color)
            ? `, color="${color}", penwidth=2`
            : '';
        lineList.push(`    ${id} [label="${label}"${colorPart}];`);
    }
    for (const edge of options.edgeList) {
        const fromId = idByKey.get(edge.fromKey);
        const toId = idByKey.get(edge.toKey);
        if (fromId === undefined || toId === undefined) {
            continue;
        }
        const { label, isDirected } = options.resolveEdge(edge);
        const attributeList = [
            label === '' ? '' : `label="${toDotText(label)}"`,
            isDirected ? '' : 'dir=none',
        ].filter(Boolean);
        lineList.push(
            `    ${fromId} -> ${toId}` +
                (attributeList.length === 0
                    ? ';'
                    : ` [${attributeList.join(', ')}];`),
        );
    }
    lineList.push('}');
    return `${lineList.join('\n')}\n`;
}

/**
 * PlantUML has no escape for a double quote inside a quoted label, so one is
 * turned into a typographic quote: the name still reads correctly and the
 * string cannot end early.
 */
function toPlantUmlText(value: string) {
    return toOneLine(value).replace(/"/g, '”');
}

/**
 * The graph as PlantUML.
 *
 * The format a wiki is most likely to draw — Confluence, Redmine, a
 * `@startuml` block in a repository — and the one a user with a PlantUML habit
 * will look for by name. Deliberately the PLAINEST subset that says everything
 * here: `rectangle … as <id>` per box, `-->` for a directed relation and `--`
 * for an undirected one, the relation word after the colon. No colours and no
 * skinparams, because nothing on this machine can render PlantUML to prove
 * styling behaves — the structure is what was checked, so the structure is all
 * this writes.
 */
function buildPlantUml(options: GraphTextExportOptionsType): string {
    const nodeList = toOrderedNodeList(options);
    const idByKey = toIdByKey(nodeList);
    const lineList: string[] = [
        '@startuml',
        `' ${toPlantUmlText(options.title)} — connection graph`,
        'left to right direction',
    ];
    for (const item of nodeList) {
        const id = idByKey.get(item.node.key) ?? '';
        const caption = toPlantUmlText(
            options.translate(item.view?.caption ?? ''),
        );
        const label =
            toPlantUmlText(toNodeLabel(item)) +
            (caption === '' ? '' : `\\n${caption}`);
        lineList.push(`rectangle "${label}" as ${id}`);
    }
    for (const edge of options.edgeList) {
        const fromId = idByKey.get(edge.fromKey);
        const toId = idByKey.get(edge.toKey);
        if (fromId === undefined || toId === undefined) {
            continue;
        }
        const { label, isDirected } = options.resolveEdge(edge);
        lineList.push(
            `${fromId} ${isDirected ? '-->' : '--'} ${toId}` +
                (label === '' ? '' : ` : ${toPlantUmlText(label)}`),
        );
    }
    lineList.push('@enduml');
    return `${lineList.join('\n')}\n`;
}

/** The graph as one of the diagram languages the menu offers. */
export function buildGraphDiagram(
    options: GraphTextExportOptionsType,
    format: GraphDiagramFormatType,
): string {
    switch (format) {
        case 'mermaid-flowchart-td':
            return buildMermaidFlowchart(options, 'TD');
        case 'mermaid-mindmap':
            return buildMermaidMindmap(options);
        case 'graphviz-dot':
            return buildGraphvizDot(options);
        case 'plantuml':
            return buildPlantUml(options);
        default:
            return buildMermaidFlowchart(options, 'LR');
    }
}
