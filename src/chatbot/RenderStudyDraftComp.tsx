import { STUDY_BIBLE_NOTES_LABEL } from '../helper/agentStudyFileRules';
import { fillWords, tran } from './chatTranHelpers';
import type { BotActionType } from './helpBotHelpers';
import {
    STUDY_CREATE_TOOL_NAME,
    takeDraftedStudy,
} from './studyFileChatHelpers';

/**
 * Where a change is written, as the panels name it: `Resources › Default ›
 * <name>` or `Bible Notes › <name>` (2026-11-14, EC-706). A study in Bible
 * Notes and a copy of it in Resources → Default had the same name, the card
 * named the file alone, and **Save changes** wrote the Resources copy twice
 * while the person read the other.
 */
export function toShownStudyPlace(file: string) {
    const [folder, ...rest] = file.split('/');
    const name = rest.join('/');
    if (name === '') {
        return file;
    }
    return folder.toLowerCase() === STUDY_BIBLE_NOTES_LABEL.toLowerCase()
        ? `${tran('Bible Notes')} › ${name}`
        : `${tran('Resources')} › ${folder} › ${name}`;
}

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
            {!drafted.isChange || drafted.file === null ? null : (
                <div className="cue-study-line cue-study-place">
                    {toShownStudyPlace(drafted.file)}
                </div>
            )}
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
