import { describe, expect, test } from 'vitest';

import type { GraphEdgeType, GraphRelationDefType } from './core';
import type { GraphExportNodeType } from './graphExportHelpers';
import {
    buildGraphDiagram,
    buildGraphMarkdown,
    GRAPH_DIAGRAM_FORMAT_LIST,
} from './graphTextExportHelpers';
import type { GraphTextExportOptionsType } from './graphTextExportHelpers';

// The lookup vocabulary in miniature: parent and child are the same stored
// line from opposite ends, spouse is its own undirected one.
const RELATION_DEF_LIST: GraphRelationDefType[] = [
    {
        kind: 'parent',
        canonicalKind: 'child',
        canonicalFrom: 'target',
        isDirected: true,
        label: 'Parents',
        styleKey: 'parentage',
    },
    {
        kind: 'spouse',
        canonicalKind: 'spouse',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Spouses',
        styleKey: 'spouse',
    },
    {
        kind: 'child',
        canonicalKind: 'child',
        canonicalFrom: 'origin',
        isDirected: true,
        label: 'Children',
        styleKey: 'parentage',
    },
];

function genNode(
    key: string,
    name: string,
    extra: Partial<GraphExportNodeType['view']> = {},
): GraphExportNodeType {
    const [kind, recordId] = key.split(':');
    return {
        node: {
            key,
            kind,
            recordId,
            name,
            x: 0,
            y: 0,
            isPinned: false,
            isCollapsed: false,
            originKey: null,
            isExpanded: false,
        },
        view: {
            name,
            kjvName: '',
            title: '',
            caption: 'Person',
            iconClass: 'bi bi-person',
            typeKey: 'person',
            verseList: [],
            labelHint: 'male',
            ...extra,
        },
        typeColor: '#6ea8fe',
    };
}

function genEdge(
    fromKey: string,
    toKey: string,
    relation: string,
): GraphEdgeType {
    return { key: `${fromKey}|${toKey}|${relation}`, fromKey, toKey, relation };
}

function genOptions(
    overrides: Partial<GraphTextExportOptionsType> = {},
): GraphTextExportOptionsType {
    return {
        title: 'David',
        rootKey: 'name:david',
        nodeList: [
            genNode('name:solomon', 'Solomon'),
            genNode('name:david', 'David', {
                title: 'king of Israel',
                verseList: ['1SA 16:1', '1SA 16:13'],
            }),
            genNode('name:abigail', 'Abigail', { labelHint: 'female' }),
        ],
        edgeList: [
            genEdge('name:david', 'name:solomon', 'child'),
            genEdge('name:david', 'name:abigail', 'spouse'),
        ],
        relationDefList: RELATION_DEF_LIST,
        resolveEdge: (edge) => {
            return edge.relation === 'child'
                ? { label: 'son', isDirected: true }
                : { label: 'wife', isDirected: false };
        },
        translate: (key: string) => {
            return key;
        },
        ...overrides,
    };
}

describe('buildGraphMarkdown', () => {
    test('lists the centre first and marks it', () => {
        const lineList = buildGraphMarkdown(genOptions()).split('\n');
        const rowIndex = lineList.findIndex((line) => {
            return line.startsWith('| **David**');
        });
        expect(lineList[0]).toBe('# David');
        expect(lineList[2]).toBe(
            'Connection graph — 3 records, 2 connections.',
        );
        expect(lineList[rowIndex]).toBe(
            '| **David** _(centre)_ | Person | king of Israel |',
        );
        // The other records follow the graph's own order, unmarked.
        expect(lineList[rowIndex + 1]).toBe('| **Solomon** | Person |  |');
    });

    test('carries the diagram in a mermaid fence, ahead of the tables', () => {
        const lineList = buildGraphMarkdown(genOptions()).split('\n');
        const fenceIndex = lineList.indexOf('```mermaid');
        expect(lineList[fenceIndex - 2]).toBe('## Diagram');
        expect(lineList[fenceIndex + 2]).toBe('flowchart LR');
        // The whole diagram, not a second rendering of it.
        expect(buildGraphMarkdown(genOptions())).toContain(
            buildGraphDiagram(genOptions(), 'mermaid-flowchart-lr').trimEnd(),
        );
        expect(lineList.indexOf('```', fenceIndex + 1)).toBeLessThan(
            lineList.indexOf('## Records'),
        );
    });

    test('a label holding a fence does not end the block early', () => {
        const text = buildGraphMarkdown(
            genOptions({
                nodeList: [genNode('name:david', 'David ``` ish')],
                edgeList: [],
            }),
        );
        expect(text).toContain('````mermaid');
        expect(text).toContain('\n````\n');
    });

    test('an empty graph is written with no diagram to draw', () => {
        const text = buildGraphMarkdown(
            genOptions({ nodeList: [], edgeList: [] }),
        );
        expect(text).not.toContain('## Diagram');
        expect(text).not.toContain('mermaid');
    });

    test('groups connections by relation and arrows only directed ones', () => {
        const text = buildGraphMarkdown(genOptions());
        // The stored line is parent -> child, so it reads as Children even
        // though the `parent` definition declares the same canonical kind.
        expect(text).toContain(
            '### Children\n\n- **David** → **Solomon** — son',
        );
        expect(text).toContain(
            '### Spouses\n\n- **David** ↔ **Abigail** — wife',
        );
        expect(text).not.toContain('### Parents');
    });

    test('names a record with an English twin the way the box does', () => {
        const text = buildGraphMarkdown(
            genOptions({
                nodeList: [
                    genNode('name:david', 'ដាវីឌ', { kjvName: 'David' }),
                ],
                edgeList: [],
            }),
        );
        expect(text).toContain('| **ដាវីឌ (David)** _(centre)_ |');
        expect(text).not.toContain('## Connections');
    });

    test('references are listed only for records that cite any', () => {
        const text = buildGraphMarkdown(genOptions());
        expect(text).toContain(
            '## References\n\n- **David**: 1SA 16:1, 1SA 16:13\n',
        );
        expect(text).not.toContain('- **Solomon**:');
        expect(buildGraphMarkdown(genOptions({ nodeList: [] }))).not.toContain(
            '## References',
        );
    });

    test('a long reference list is capped and says how many are left', () => {
        const verseList = Array.from({ length: 15 }, (_unused, index) => {
            return `1KI ${index + 1}:1`;
        });
        const text = buildGraphMarkdown(
            genOptions({
                nodeList: [genNode('name:david', 'David', { verseList })],
                edgeList: [],
            }),
        );
        expect(text).toContain(
            '- **David**: 1KI 1:1, 1KI 2:1, 1KI 3:1, 1KI 4:1, 1KI 5:1, ' +
                '1KI 6:1, 1KI 7:1, 1KI 8:1, 1KI 9:1, 1KI 10:1, 1KI 11:1, ' +
                '1KI 12:1 _(+3 more)_',
        );
        expect(text).not.toContain('1KI 13:1');
    });

    test('a pipe in a description stays inside its cell', () => {
        const text = buildGraphMarkdown(
            genOptions({
                nodeList: [
                    genNode('name:david', 'David', {
                        title: 'a | b\nsecond line',
                    }),
                ],
                edgeList: [],
            }),
        );
        expect(text).toContain('| a \\| b second line |');
    });
});

describe('buildGraphDiagram', () => {
    test('writes a left-to-right flowchart of the same boxes and lines', () => {
        const lineList = buildGraphDiagram(
            genOptions(),
            'mermaid-flowchart-lr',
        ).split('\n');
        expect(lineList[0]).toBe('%% David — connection graph');
        expect(lineList[1]).toBe('flowchart LR');
        expect(lineList[2]).toBe('    n0["David<br/>Person"]');
        expect(lineList).toContain('    n0 -->|"son"| n1');
        expect(lineList).toContain('    n0 ---|"wife"| n2');
    });

    test('colours the boxes by record type, as a stroke', () => {
        const text = buildGraphDiagram(
            genOptions({
                nodeList: [
                    genNode('name:david', 'David'),
                    {
                        ...genNode('location:gath', 'Gath', {
                            caption: 'city',
                            typeKey: 'settlement',
                        }),
                        typeColor: '#9ac6a0',
                    },
                ],
                edgeList: [],
            }),
            'mermaid-flowchart-lr',
        );
        expect(text).toContain(
            'classDef type-person stroke:#6ea8fe,stroke-width:2px',
        );
        expect(text).toContain('class n0 type-person');
        expect(text).toContain(
            'classDef type-settlement stroke:#9ac6a0,stroke-width:2px',
        );
    });

    test('a colour that could end the statement is left out', () => {
        const text = buildGraphDiagram(
            genOptions({
                nodeList: [
                    {
                        ...genNode('name:david', 'David'),
                        typeColor: 'rgb(110, 168, 254)',
                    },
                ],
                edgeList: [],
            }),
            'mermaid-flowchart-lr',
        );
        expect(text).not.toContain('classDef');
        expect(text).toContain('    n0["David<br/>Person"]');
    });

    test('a label that could be read as syntax is written as entities', () => {
        const text = buildGraphDiagram(
            genOptions({
                nodeList: [
                    genNode('name:david', 'A "quoted" #1 <name>', {
                        caption: '',
                    }),
                ],
                edgeList: [],
            }),
            'mermaid-flowchart-lr',
        );
        expect(text).toContain(
            '    n0["A &quot;quoted&quot; &#35;1 &lt;name&gt;"]',
        );
    });

    test('the same graph top down differs only in its direction line', () => {
        const downward = buildGraphDiagram(
            genOptions(),
            'mermaid-flowchart-td',
        );
        expect(downward).toContain('flowchart TD');
        expect(downward.replace('flowchart TD', 'flowchart LR')).toBe(
            buildGraphDiagram(genOptions(), 'mermaid-flowchart-lr'),
        );
    });

    test('the mindmap is a tree walked out from the centre', () => {
        const lineList = buildGraphDiagram(
            genOptions({
                // Solomon hangs off Abigail, not off David, so the tree has to
                // be two levels deep rather than a flat fan.
                edgeList: [
                    genEdge('name:david', 'name:abigail', 'spouse'),
                    genEdge('name:abigail', 'name:solomon', 'child'),
                ],
            }),
            'mermaid-mindmap',
        ).split('\n');
        expect(lineList[1]).toBe('mindmap');
        // The centre is the circle, and the depth of each line is its place in
        // the tree.
        expect(lineList[2]).toBe('  n0(("David · Person"))');
        expect(lineList[3]).toBe('    n2("Abigail · Person")');
        expect(lineList[4]).toBe('      n1("Solomon · Person")');
        // No edge labels anywhere: the format has nowhere to put them.
        expect(lineList.join('\n')).not.toContain('wife');
    });

    test('a record the centre cannot reach still appears, at the centre', () => {
        const lineList = buildGraphDiagram(
            genOptions({ edgeList: [] }),
            'mermaid-mindmap',
        ).split('\n');
        expect(lineList[2]).toBe('  n0(("David · Person"))');
        expect(lineList.slice(3)).toEqual([
            '    n1("Solomon · Person")',
            '    n2("Abigail · Person")',
            '',
        ]);
    });

    test('DOT writes one digraph, with the undirected lines as dir=none', () => {
        const lineList = buildGraphDiagram(genOptions(), 'graphviz-dot').split(
            '\n',
        );
        expect(lineList[1]).toBe('digraph "David" {');
        expect(lineList).toContain(
            '    n0 [label="David\\nPerson", color="#6ea8fe", penwidth=2];',
        );
        expect(lineList).toContain('    n0 -> n1 [label="son"];');
        expect(lineList).toContain('    n0 -> n2 [label="wife", dir=none];');
        expect(lineList[lineList.length - 2]).toBe('}');
    });

    test('a quote in a DOT label is escaped, and the backslash with it', () => {
        const text = buildGraphDiagram(
            genOptions({
                nodeList: [
                    genNode('name:david', 'A "quoted" back\\slash', {
                        caption: '',
                    }),
                ],
                edgeList: [],
            }),
            'graphviz-dot',
        );
        expect(text).toContain('    n0 [label="A \\"quoted\\" back\\\\slash"');
    });

    test('PlantUML writes a rectangle per box between the two markers', () => {
        const lineList = buildGraphDiagram(genOptions(), 'plantuml').split(
            '\n',
        );
        expect(lineList[0]).toBe('@startuml');
        expect(lineList).toContain('rectangle "David\\nPerson" as n0');
        expect(lineList).toContain('n0 --> n1 : son');
        expect(lineList).toContain('n0 -- n2 : wife');
        expect(lineList[lineList.length - 2]).toBe('@enduml');
    });

    test('a quote in a PlantUML label cannot end the label', () => {
        const text = buildGraphDiagram(
            genOptions({
                nodeList: [
                    genNode('name:david', 'A "quoted" name', { caption: '' }),
                ],
                edgeList: [],
            }),
            'plantuml',
        );
        expect(text).toContain('rectangle "A ”quoted” name" as n0');
    });

    test('every offered format writes something for the same graph', () => {
        for (const definition of GRAPH_DIAGRAM_FORMAT_LIST) {
            const text = buildGraphDiagram(genOptions(), definition.key);
            expect(text.trim().length).toBeGreaterThan(0);
            // Each one names all three records, whatever shape it draws them
            // in.
            for (const name of ['David', 'Solomon', 'Abigail']) {
                expect(text).toContain(name);
            }
        }
    });

    test('an edge whose end is not on the canvas is skipped', () => {
        const text = buildGraphDiagram(
            genOptions({
                nodeList: [genNode('name:david', 'David')],
                edgeList: [genEdge('name:david', 'name:gone', 'child')],
            }),
            'mermaid-flowchart-lr',
        );
        expect(text).not.toContain('-->');
    });
});
