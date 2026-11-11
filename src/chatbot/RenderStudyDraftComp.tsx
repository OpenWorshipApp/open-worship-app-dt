import { fillWords, tran } from './chatTranHelpers';
import type { BotActionType } from './helpBotHelpers';
import {
    STUDY_CREATE_TOOL_NAME,
    takeDraftedStudy,
} from './studyFileChatHelpers';

/**
 * The study file a card would save (EC-464), under its Create / Save
 * changes button: the passage, the Bible its verses were quoted from, how
 * many diagrams it draws and the whole Markdown, read-only. Plain text in a
 * box -- never HTML -- off the SAME held draft the button saves, so a
 * window reopened since shows nothing rather than an empty file. Preview is
 * where it is drawn with its diagrams.
 */
export default function RenderStudyDraftComp({
    actions,
}: Readonly<{ actions: BotActionType[] }>) {
    const action = actions.find((one) => {
        return one.toolName === STUDY_CREATE_TOOL_NAME;
    });
    if (action === undefined) {
        return null;
    }
    const drafted = takeDraftedStudy(action.args?.reference ?? '');
    if (drafted === null) {
        return null;
    }
    const lineCount = drafted.content.split('\n').length;
    // What a change does is said by the answer above, in the reader's
    // language; the card's words are the window's own.
    const heading = drafted.isChange
        ? tran('The study file, as it will be changed')
        : tran('The study file, as it will be saved');
    return (
        <details className="cue-lyric cue-study" open>
            <summary>{heading}</summary>
            {drafted.passage === '' ? null : (
                <div className="cue-study-line">
                    {fillWords(
                        // One diagram is said as one (EC-487: _1 diagrams_).
                        drafted.diagramCount === 1
                            ? tran('{passage} ({bible}) · {count} diagram')
                            : tran('{passage} ({bible}) · {count} diagrams'),
                        {
                            passage: drafted.passage,
                            bible: drafted.bible,
                            count: String(drafted.diagramCount),
                        },
                    )}
                </div>
            )}
            {drafted.nameTaken === null ? null : (
                <div className="cue-study-line">
                    {fillWords(
                        tran(
                            '"{taken}" is already in Resources, so this one ' +
                                'will be "{name}".',
                        ),
                        { taken: drafted.nameTaken, name: drafted.name },
                    )}
                </div>
            )}
            <textarea
                className="cue-lyric-text cue-study-text"
                readOnly={true}
                spellCheck={false}
                value={drafted.content}
                rows={Math.min(20, Math.max(6, lineCount))}
                aria-label={heading}
            />
        </details>
    );
}
