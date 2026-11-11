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
});
