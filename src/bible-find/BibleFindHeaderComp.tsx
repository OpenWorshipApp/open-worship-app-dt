import { useBibleFindController } from './BibleFindController';
import { useAppEffect } from '../helper/debuggerHelpers';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/helpers';

const BIBLE_FIND_RECENT_SEARCH_SETTING_NAME = 'bible-find-recent-search';
export function setBibleFindRecentSearch(text: string) {
    if (text.trim() === '') {
        text = '';
    }
    setSetting(BIBLE_FIND_RECENT_SEARCH_SETTING_NAME, text);
}

const attemptTimeout = genTimeoutAttempt(2000);
export default function BibleFindHeaderComp({
    handleFinding,
}: Readonly<{
    handleFinding: (text: string, isFresh?: boolean) => void;
}>) {
    const [text, setText] = useStateSettingString(
        BIBLE_FIND_RECENT_SEARCH_SETTING_NAME,
        '' as string,
    );
    const bibleFindController = useBibleFindController();
    const keyUpHandling = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (bibleFindController.menuControllerSession !== null) {
            if (event.key === 'Enter') {
                bibleFindController.closeSuggestionMenu();
            }
            return;
        }
        if (['Enter', 'Escape'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            const newText = event.key === 'Enter' ? text : '';
            setText(newText);
            attemptTimeout(() => {
                handleFinding(newText);
            }, true);
        }
    };
    useAppEffect(() => {
        handleFinding(text);
    }, []);
    return (
        <>
            <input
                data-bible-key={bibleFindController.bibleKey}
                type="text"
                value={text}
                className="form-control"
                onKeyUp={keyUpHandling}
                onChange={(event) => {
                    bibleFindController.handleNewValue(event);
                    setText((preText) => {
                        const newText = event.target.value;
                        attemptTimeout(() => {
                            handleFinding(!preText ? '' : newText);
                        });
                        return newText;
                    });
                }}
            />
            <button
                className="btn btn-sm"
                onClick={() => {
                    attemptTimeout(() => {
                        handleFinding(text, true);
                    }, true);
                }}
            >
                <i className="bi bi-arrow-clockwise app-caught-hover-pointer" />
            </button>
        </>
    );
}
