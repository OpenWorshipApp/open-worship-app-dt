import { useBibleFindController } from './BibleFindController';
import { useAppEffect } from '../helper/debuggerHelpers';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/helpers';
import { useRef } from 'react';
import { pasteTextToInput } from '../server/appHelpers';

const BIBLE_FIND_RECENT_SEARCH_SETTING_NAME = 'bible-find-recent-search';
let setFindText: (text: string) => void = () => {};
export function setBibleFindRecentSearch(text: string) {
    if (text.trim() === '') {
        text = '';
    }
    setSetting(BIBLE_FIND_RECENT_SEARCH_SETTING_NAME, text);
    setFindText(text);
}

const attemptTimeout = genTimeoutAttempt(2000);
export default function BibleFindHeaderComp({
    handleFinding,
}: Readonly<{
    handleFinding: (text: string, isFresh?: boolean) => void;
}>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useStateSettingString(
        BIBLE_FIND_RECENT_SEARCH_SETTING_NAME,
        '' as string,
    );
    const setText1 = (newText: string) => {
        setText((preText) => {
            attemptTimeout(() => {
                handleFinding(!preText ? '' : newText);
            });
            return newText;
        });
    };
    const bibleFindController = useBibleFindController();
    useAppEffect(() => {
        setFindText = (newText: string) => {
            if (inputRef.current === null) {
                return;
            }
            pasteTextToInput(inputRef.current, newText);
        };
        return () => {
            setFindText = () => {};
        };
    }, []);
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
            const isEnterKey = event.key === 'Enter';
            const newText = isEnterKey ? text : '';
            setText(newText);
            attemptTimeout(() => {
                handleFinding(newText, isEnterKey);
            }, true);
        }
    };
    useAppEffect(() => {
        handleFinding(text);
    }, []);
    return (
        <>
            <input
                ref={inputRef}
                data-bible-key={bibleFindController.bibleKey}
                type="text"
                value={text}
                className="form-control"
                onKeyUp={keyUpHandling}
                onChange={(event) => {
                    bibleFindController.handleNewValue(event);
                    setText1(event.target.value);
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
