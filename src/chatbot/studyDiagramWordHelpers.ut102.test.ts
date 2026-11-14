import { describe, expect, it } from 'vitest';

import {
    listStudyDiagramLabels,
    listStudySequenceIds,
    withStudySequenceNames,
} from './studyDiagramWordHelpers';

describe('a diagram read line by line, the rest (UT-102)', () => {
    it('reads no participant off a line with no arrow or one with no sender', () => {
        const source = [
            'sequenceDiagram',
            '    Shepherd stands at the gate',
            '    ->>Sheep: no sender',
            '    Shepherd: calls ->> Sheep',
            '    Shepherd->>Sheep: come',
        ].join('\n');
        expect(listStudySequenceIds(source)).toEqual(['Shepherd', 'Sheep']);
        // Only the message that reads as one declares its two boxes.
        expect(withStudySequenceNames(source).split('\n')).toEqual([
            'sequenceDiagram',
            '    Shepherd stands at the gate',
            '    ->>Sheep: no sender',
            '    Shepherd: calls ->> Sheep',
            '    participant Shepherd as Shepherd',
            '    participant Sheep as Sheep',
            '    Shepherd->>Sheep: come',
        ]);
    });

    it('reads a pie titled on a line of its own, comments and blank lines aside', () => {
        expect(
            listStudyDiagramLabels(
                [
                    'pie',
                    '    %% the share of each',
                    '',
                    '    title Faith and Doubt',
                    '    "Belief" : 60',
                    '    "Doubt" : 40',
                ].join('\n'),
            ),
        ).toEqual(['Faith and Doubt', 'Belief', 'Doubt']);
    });
});
