import { type ChangeEvent, type KeyboardEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import { useBibleFindController } from './BibleFindController';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import { pasteTextToInput } from '../server/appHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

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
    const setText1 = useCallback(
        (newText: string) => {
            setText((preText) => {
                attemptTimeout(() => {
                    handleFinding(preText ? newText : '');
                });
                return newText;
            });
        },
        [attemptTimeout, handleFinding, setText],
    );
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
    const bibleFindControllerRef = useAppCurrentRef(bibleFindController);
    const textRef = useAppCurrentRef(text);
    const setTextRef = useAppCurrentRef(setText);
    const attemptTimeoutRef = useAppCurrentRef(attemptTimeout);
    const handleFindingRef = useAppCurrentRef(handleFinding);
    const keyUpHandling = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (bibleFindControllerRef.current.menuControllerSession !== null) {
                if (event.key === 'Enter') {
                    bibleFindControllerRef.current.closeSuggestionMenu();
                }
                return;
            }
            if (['Enter', 'Escape'].includes(event.key)) {
                event.preventDefault();
                event.stopPropagation();
                const isEnterKey = event.key === 'Enter';
                const newText = isEnterKey ? textRef.current : '';
                setTextRef.current(newText);
                attemptTimeoutRef.current(() => {
                    handleFindingRef.current(newText, isEnterKey);
                }, true);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // empty deps is intentional to only trigger finding on the first render
    useAppEffect(() => {
        handleFinding(text);
    }, []);
    const setText1Ref = useAppCurrentRef(setText1);
    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            bibleFindControllerRef.current.handleNewValue(event);
            setText1Ref.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleRefreshing = useCallback(() => {
        attemptTimeoutRef.current(() => {
            handleFindingRef.current(textRef.current, true);
        }, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
