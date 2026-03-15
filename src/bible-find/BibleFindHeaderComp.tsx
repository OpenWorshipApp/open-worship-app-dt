import { type ChangeEvent, type KeyboardEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import { useBibleFindController } from './BibleFindController';
import { useAppEffect } from '../helper/debuggerHelpers';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import { pasteTextToInput } from '../server/appHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';

const BIBLE_FIND_RECENT_SEARCH_SETTING_NAME = 'bible-find-recent-search';
let setFindText: (text: string) => void = () => {};
export function setBibleFindRecentSearch(text: string) {
    if (text.trim() === '') {
        text = '';
    }
    setSetting(BIBLE_FIND_RECENT_SEARCH_SETTING_NAME, text);
    setFindText(text);
}

export default function BibleFindHeaderComp({
    handleFinding,
}: Readonly<{
    handleFinding: (text: string, isFresh?: boolean) => void;
}>) {
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(2000);
    }, []);
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useStateSettingString(
        BIBLE_FIND_RECENT_SEARCH_SETTING_NAME,
        '' as string,
    );
    const setText1 = (newText: string) => {
        setText((preText) => {
            attemptTimeout(() => {
                handleFinding(preText ? newText : '');
            });
            return newText;
        });
    };
    const bibleFindController = useBibleFindController();
    const { bibleKey } = bibleFindController;
    const fontFamily = useBibleFontFamily(bibleKey);
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
    const keyUpHandling = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
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
        },
        [bibleFindController, text, handleFinding, attemptTimeout],
    );
    // empty deps is intentional to only trigger finding on the first render
    useAppEffect(() => {
        handleFinding(text);
    }, []);
    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            bibleFindController.handleNewValue(event);
            setText1(event.target.value);
        },
        [bibleFindController, setText1],
    );
    const handleRefreshing = useCallback(() => {
        attemptTimeout(() => {
            handleFinding(text, true);
        }, true);
    }, [attemptTimeout, handleFinding, text]);
    return (
        <>
            <input
                className="form-control form-control-sm"
                ref={inputRef}
                type="text"
                value={text}
                onKeyUp={keyUpHandling}
                style={{ fontFamily }}
                onChange={handleInputChange}
            />
            <button className="btn btn-sm" onClick={handleRefreshing}>
                <i className="bi bi-arrow-clockwise app-caught-hover-pointer" />
            </button>
        </>
    );
}
