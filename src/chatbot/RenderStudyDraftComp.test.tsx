import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import type { BotActionType } from './helpBotHelpers';
import RenderStudyDraftComp from './RenderStudyDraftComp';
import {
    STUDY_CREATE_TOOL_NAME,
    keepDraftedStudy,
} from './studyFileChatHelpers';

// The card over a study a Create or Save changes button would write, drawn
// off the draft the window holds.
function renderCard(diagramCount: number, passage = 'John 3:16-17') {
    const kept = keepDraftedStudy({
        name: 'JHN.3.16-17 Love.md',
        nameTaken: null,
        isChange: false,
        file: null,
        hash: null,
        passage,
        bible: 'KJV',
        diagramCount,
        change: null,
        content: '# Love\n',
        raw: null,
    });
    const action: BotActionType = {
        label: 'Create "JHN.3.16-17 Love.md"',
        toolName: STUDY_CREATE_TOOL_NAME,
        args: { reference: kept.reference },
    };
    return renderToStaticMarkup(<RenderStudyDraftComp actions={[action]} />);
}

describe('RenderStudyDraftComp', () => {
    test('says one diagram as one (EC-487), and more as more', () => {
        const one = renderCard(1);
        expect(one).toContain('John 3:16-17 (KJV) · 1 diagram</div>');
        expect(one).not.toContain('diagrams');
        expect(renderCard(2)).toContain('John 3:16-17 (KJV) · 2 diagrams');
        expect(renderCard(0)).toContain('John 3:16-17 (KJV) · 0 diagrams');
    });

    test('draws no passage line for a draft that names none', () => {
        expect(renderCard(1, '')).not.toContain('cue-study-line');
    });

    // EC-706: two studies of one name, one in each folder, and the card
    // had named the file alone.
    test('says where a change is written, and nothing of the kind for a new study', () => {
        const renderChange = (file: string) => {
            const kept = keepDraftedStudy({
                name: 'PSA.100.Joy.md',
                nameTaken: null,
                isChange: true,
                file,
                hash: 'h',
                passage: '',
                bible: '',
                diagramCount: 0,
                change: null,
                content: '# Joy\n',
                raw: null,
            });
            return renderToStaticMarkup(
                <RenderStudyDraftComp
                    actions={[
                        {
                            label: 'Save changes to "PSA.100.Joy.md"',
                            toolName: STUDY_CREATE_TOOL_NAME,
                            args: { reference: kept.reference },
                        },
                    ]}
                />,
            );
        };
        expect(renderChange('Bible Notes/PSA.100.Joy.md')).toContain(
            '<div class="cue-study-line cue-study-place">Bible Notes › ' +
                'PSA.100.Joy.md</div>',
        );
        expect(renderChange('Default/PSA.100.Joy.md')).toContain(
            '<div class="cue-study-line cue-study-place">Resources › ' +
                'Default › PSA.100.Joy.md</div>',
        );
        expect(renderCard(1)).not.toContain('cue-study-place');
    });
});
