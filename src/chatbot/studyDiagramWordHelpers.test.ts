import { describe, expect, it } from 'vitest';

import {
    keepStudySequenceIds,
    listStudyDiagramLabels,
    listStudyDiagramLeftLabels,
    listStudySequenceIds,
    readStudyDiagramKind,
    toStudyDiagramSeenWordsText,
    withStudySequenceNames,
} from './studyDiagramWordHelpers';

// "Its own script": the letters of one Unicode block, made by code point,
// so no word of any language is written here.
const SCRIPT_PATTERN = new RegExp(
    `[${String.fromCodePoint(0x1000)}-${String.fromCodePoint(0x109f)}]`,
    'u',
);
function toScript(words: string) {
    return words.replace(/[A-Za-z]/g, (letter) => {
        return String.fromCodePoint(0x1000 + (letter.charCodeAt(0) % 32));
    });
}

describe('readStudyDiagramKind', () => {
    it('reads the first word of the first line that says one', () => {
        expect(readStudyDiagramKind('\n%% a comment\n  timeline\n')).toBe(
            'timeline',
        );
        expect(readStudyDiagramKind('graph TD\n    A --> B')).toBe('graph');
        expect(readStudyDiagramKind('  \n')).toBe('');
    });
});

describe('toStudyDiagramSeenWordsText', () => {
    it('names the words a reader sees for each kind', () => {
        // A timeline's period stands BEFORE its colon (EC-533).
        expect(toStudyDiagramSeenWordsText('timeline\n  title A')).toContain(
            'the words BEFORE each colon as well as after it',
        );
        // A mindmap's node has no colon at all.
        expect(toStudyDiagramSeenWordsText('mindmap\n  root((A))')).toContain(
            'every node',
        );
        expect(toStudyDiagramSeenWordsText('graph TD')).toBe(
            toStudyDiagramSeenWordsText('flowchart LR'),
        );
        expect(toStudyDiagramSeenWordsText('stateDiagram-v2')).toBe(
            toStudyDiagramSeenWordsText('stateDiagram'),
        );
        expect(toStudyDiagramSeenWordsText('journey')).toContain(
            'each task before its first colon',
        );
        // A participant's name, never its id: the arrows use it (EC-582).
        expect(toStudyDiagramSeenWordsText('sequenceDiagram')).toContain(
            'each name after `as` -- never the id before it',
        );
        expect(toStudyDiagramSeenWordsText('gantt\n  title A')).toBe(
            'the labels in quotes and brackets, the words after a colon, a title',
        );
    });
});

describe('listStudyDiagramLabels', () => {
    it('reads a flowchart’s brackets, quotes and arrow words, never an id', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'graph TD',
                    '    A["Love"] --> B("Gift")',
                    '    B -->|"chosen"| C{Choice}',
                    '    C --> D[(Store)]',
                    '    C -- plain --> E((Life))',
                    '    subgraph S1 ["The Gift"]',
                    '    subgraph Bare',
                    '    end',
                    '    classDef big fill:#f9f',
                    '    style A fill:#fff',
                    '    A --> E',
                ].join('\n'),
            ),
        ).toEqual([
            'Love',
            'Gift',
            'chosen',
            'Choice',
            'Store',
            'Life',
            'The Gift',
        ]);
    });

    it('reads a timeline’s title, sections, periods and events', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'timeline',
                    '    title The Night Talk',
                    '    section Early',
                    "    John's Ministry : Forerunner : Preaching",
                    '                    : Baptizing',
                ].join('\n'),
            ),
        ).toEqual([
            'The Night Talk',
            'Early',
            "John's Ministry",
            'Forerunner',
            'Preaching',
            'Baptizing',
        ]);
    });

    it('reads a mindmap’s nodes, never an icon or a class', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'mindmap',
                    '  root((John 3))',
                    '    Spiritual Rebirth',
                    '      ::icon(fa fa-book)',
                    '      id1[Born of Water]',
                    '    Divine Love:::urgent',
                ].join('\n'),
            ),
        ).toEqual([
            'John 3',
            'Spiritual Rebirth',
            'Born of Water',
            'Divine Love',
        ]);
    });

    it('reads a sequence’s title, messages, notes, names and blocks', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'sequenceDiagram',
                    '    title The Night Talk',
                    '    participant N as Nicodemus',
                    '    participant Jesus',
                    '    N->>Jesus: How can a man be born?',
                    '    Note right of Jesus: Born of the Spirit',
                    '    loop Every night',
                    '    end',
                    '    critical Faith',
                    '    option Doubt',
                    '    end',
                ].join('\n'),
            ),
        ).toEqual([
            'The Night Talk',
            'Nicodemus',
            // A participant with no name of its own is drawn by its id
            // (EC-582).
            'Jesus',
            'How can a man be born?',
            'Born of the Spirit',
            'Every night',
            'Faith',
            'Doubt',
        ]);
    });

    // EC-582: the user's Genesis 4 study drew "God", "Cain" and "Abel" in
    // its Khmer half -- ids no label had ever named.
    it('reads the ids a message or a note draws, and the words of every kind of arrow', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'sequenceDiagram',
                    '    God->>+Cain: Why are you angry?',
                    '    Cain-x Abel: In the field',
                    '    Cain--)God: Am I my keeper?',
                    '    Note over Cain,Abel: Brothers',
                ].join('\n'),
            ),
        ).toEqual([
            'God',
            'Cain',
            'Why are you angry?',
            'Abel',
            'In the field',
            'Am I my keeper?',
            'Brothers',
        ]);
    });

    it('reads a journey, a pie, a state diagram and a quadrant chart', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'journey',
                    '    title A Night Visit',
                    '    section Coming',
                    '      Walk to Jesus: 3: Nicodemus, Disciples',
                ].join('\n'),
            ),
        ).toEqual([
            'A Night Visit',
            'Coming',
            'Walk to Jesus',
            'Nicodemus',
            'Disciples',
        ]);
        expect(
            listStudyDiagramLabels(
                'pie title Faith\n    "Belief" : 60\n    "Doubt" : 40',
            ),
        ).toEqual(['Faith', 'Belief', 'Doubt']);
        expect(
            listStudyDiagramLabels(
                [
                    'stateDiagram-v2',
                    '    [*] --> Dark',
                    '    Dark --> Light : Believing',
                    '    state "In the Light" as Light',
                ].join('\n'),
            ),
        ).toEqual(['Believing', 'In the Light']);
        expect(
            listStudyDiagramLabels(
                [
                    'quadrantChart',
                    '    title Response',
                    '    x-axis Low Faith --> High Faith',
                    '    quadrant-1 Mature',
                    '    Nicodemus: [0.3, 0.6]',
                ].join('\n'),
            ),
        ).toEqual([
            'Response',
            'Low Faith',
            'High Faith',
            'Mature',
            'Nicodemus',
        ]);
    });

    it('names each label once, and none of a kind it does not read', () => {
        expect(
            listStudyDiagramLabels('graph LR\n  A["Love"] --> B["Love"]'),
        ).toEqual(['Love']);
        expect(listStudyDiagramLabels('gantt\n    title A Plan')).toEqual([]);
        expect(listStudyDiagramLabels('')).toEqual([]);
    });
});

describe('listStudyDiagramLeftLabels', () => {
    // The user's John 3 study, its timeline as the window's translator gave
    // it back (2026-11-12): the events translated, the periods not.
    const TIMELINE = [
        'timeline',
        '    title Transition from John to Jesus',
        "    John's Ministry : Forerunner : Preparing the way",
        '    Overlap : Both baptizing',
    ].join('\n');

    it('names a label written in Latin letters with none of the script', () => {
        const translated = [
            'timeline',
            `    title ${toScript('Transition from John to Jesus')}`,
            `    John's Ministry : ${toScript('Forerunner')} : ${toScript('Preparing the way')}`,
            `    Overlap : ${toScript('Both baptizing')}`,
        ].join('\n');
        expect(
            listStudyDiagramLeftLabels(TIMELINE, translated, SCRIPT_PATTERN),
        ).toEqual(["John's Ministry", 'Overlap']);
        // Every label in the script: nothing left.
        expect(
            listStudyDiagramLeftLabels(
                TIMELINE,
                [
                    'timeline',
                    `    title ${toScript('Transition from John to Jesus')}`,
                    `    ${toScript("John's Ministry")} : ${toScript('Forerunner')} : ${toScript('Preparing the way')}`,
                    `    ${toScript('Overlap')} : ${toScript('Both baptizing')}`,
                ].join('\n'),
                SCRIPT_PATTERN,
            ),
        ).toEqual([]);
    });

    it('takes an abbreviation, a number and a label partly in the script', () => {
        const translated = [
            'graph TD',
            '    A["KJV"] --> B["3:16"]',
            `    B --> C["${toScript('Love')} KJV"]`,
            `    C --> D["${toScript('Gift')} of God"]`,
            '    D --> E["Nicodemus"]',
        ].join('\n');
        // A name in Latin letters is left: such a language writes names in
        // its own letters.
        expect(
            listStudyDiagramLeftLabels('graph TD', translated, SCRIPT_PATTERN),
        ).toEqual(['Nicodemus']);
    });

    it('into a language written in Latin letters, names a label of two words or more given back word for word', () => {
        const source =
            'graph TD\n    A["Born Again"] --> B["Life"]\n    B --> C["Eternal Life"]';
        expect(
            listStudyDiagramLeftLabels(
                source,
                'graph TD\n    A["born  again"] --> B["Life"]\n    B --> C["Eternalo Lifeo"]',
                null,
            ),
        ).toEqual(['born  again']);
        // One word may fairly be the same in both; of 2 letters it is no word.
        expect(
            listStudyDiagramLeftLabels(
                'graph TD\n    A["Life"] --> B["of me"]',
                'graph TD\n    A["Life"] --> B["of me"]',
                null,
            ),
        ).toEqual([]);
    });

    // EC-582, as the user's Genesis 4 study was translated: every message
    // in the script, the three participants drawn by their English ids.
    it('names a participant drawn by its id in Latin letters', () => {
        expect(
            listStudyDiagramLeftLabels(
                '',
                [
                    'sequenceDiagram',
                    `    God->>Cain: "${toScript('Why are you angry')}?"`,
                    `    Cain->>Abel: (${toScript('kills him')})`,
                ].join('\n'),
                SCRIPT_PATTERN,
            ),
        ).toEqual(['God', 'Cain', 'Abel']);
    });
});

// The user's Genesis 4 study's dialogue (2026-11-13): its participants
// named only by its messages.
const GENESIS_4 = [
    'sequenceDiagram',
    '    God->>Cain: "Why are you angry?"',
    '    Cain->>Abel: (kills him in the field)',
    '    Cain->>God: "Am I my brother\'s keeper?"',
].join('\n');

describe('listStudySequenceIds', () => {
    it('names each participant once, where mermaid first meets it', () => {
        expect(
            listStudySequenceIds(
                [
                    'sequenceDiagram',
                    '    participant B as Bob',
                    '    A->>B: hi',
                    '    Note left of C: aside',
                    '    create actor D',
                    '    A->>D: made',
                    '    Holy Spirit-->>A: led',
                ].join('\n'),
            ),
        ).toEqual(['B', 'A', 'C', 'D', 'Holy Spirit']);
        expect(listStudySequenceIds(GENESIS_4)).toEqual([
            'God',
            'Cain',
            'Abel',
        ]);
        expect(listStudySequenceIds('graph TD\n    A --> B')).toEqual([]);
    });
});

describe('withStudySequenceNames', () => {
    it('declares each participant a message first names, named by its id, right before that message', () => {
        const named = withStudySequenceNames(GENESIS_4);
        expect(named).toBe(
            [
                'sequenceDiagram',
                '    participant God as God',
                '    participant Cain as Cain',
                '    God->>Cain: "Why are you angry?"',
                '    participant Abel as Abel',
                '    Cain->>Abel: (kills him in the field)',
                '    Cain->>God: "Am I my brother\'s keeper?"',
            ].join('\n'),
        );
        // The boxes in the order they were drawn, each a name to translate.
        expect(listStudySequenceIds(named)).toEqual(
            listStudySequenceIds(GENESIS_4),
        );
        expect(listStudyDiagramLabels(named).slice(0, 2)).toEqual([
            'God',
            'Cain',
        ]);
    });

    it('names a bare declaration where it stands, and leaves a named, a typed or a later declared one as written', () => {
        expect(
            withStudySequenceNames(
                [
                    'sequenceDiagram',
                    '    %% the night visit',
                    '    participant Jesus',
                    '    actor N as Nicodemus',
                    '    participant Db@{ "type": "database" }',
                    '    N->>Jesus: Rabbi',
                    '    create participant Spirit',
                    '    Jesus-->>Spirit: sends',
                    '    Jesus->>Peter: Follow me',
                    '    participant Peter',
                    '    Jesus->>Db: writes',
                ].join('\n'),
            ),
        ).toBe(
            [
                'sequenceDiagram',
                '    %% the night visit',
                '    participant Jesus as Jesus',
                '    actor N as Nicodemus',
                '    participant Db@{ "type": "database" }',
                '    N->>Jesus: Rabbi',
                '    create participant Spirit as Spirit',
                '    Jesus-->>Spirit: sends',
                '    Jesus->>Peter: Follow me',
                '    participant Peter as Peter',
                '    Jesus->>Db: writes',
            ].join('\n'),
        );
    });

    it('keeps each line’s indent and end, and gives back another kind or a diagram with nothing to name', () => {
        expect(
            withStudySequenceNames('sequenceDiagram\r\n  A->>B: hi\r\n'),
        ).toBe(
            'sequenceDiagram\r\n  participant A as A\r\n  participant B as B\r\n  A->>B: hi\r\n',
        );
        const allNamed =
            'sequenceDiagram\n    participant A as Alice\n    A->>A: hi';
        expect(withStudySequenceNames(allNamed)).toBe(allNamed);
        expect(withStudySequenceNames('graph TD\n    A --> B')).toBe(
            'graph TD\n    A --> B',
        );
    });
});

describe('keepStudySequenceIds', () => {
    const source =
        'sequenceDiagram\n    participant God as God\n    participant Cain as Cain\n    God->>Cain: hi';

    it('puts back an id written in the language, by its order, and takes one with no name as the name', () => {
        expect(
            keepStudySequenceIds(
                source,
                [
                    'sequenceDiagram',
                    `    participant ${toScript('God')} as ${toScript('God')}`,
                    `    participant ${toScript('Cain')}`,
                    `    God->>Cain: ${toScript('hi')}`,
                ].join('\n'),
            ),
        ).toBe(
            [
                'sequenceDiagram',
                `    participant God as ${toScript('God')}`,
                `    participant Cain as ${toScript('Cain')}`,
                `    God->>Cain: ${toScript('hi')}`,
            ].join('\n'),
        );
    });

    it('gives back as it is a diagram declaring another number, one with its ids, and another kind', () => {
        const fewer = `sequenceDiagram\n    participant ${toScript('God')} as ${toScript('God')}\n    God->>Cain: hi`;
        expect(keepStudySequenceIds(source, fewer)).toBe(fewer);
        const kept = `sequenceDiagram\n    participant God as ${toScript('God')}\n    participant Cain as Cain\n    God->>Cain: hi`;
        expect(keepStudySequenceIds(source, kept)).toBe(kept);
        expect(keepStudySequenceIds('graph TD', 'graph TD\n    A')).toBe(
            'graph TD\n    A',
        );
    });
});
