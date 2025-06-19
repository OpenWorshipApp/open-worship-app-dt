import { createRef, useMemo, useState } from 'react';

import {
    checkIsBibleLookupInputFocused,
    INPUT_TEXT_CLASS,
    setBibleLookupInputFocus,
} from './selectionHelpers';
import { useAppEffect, useAppEffectAsync } from '../helper/debuggerHelpers';
import LookupBibleItemController, {
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import {
    EventMapper as KeyboardEventMapper,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { useInputTextContext } from './InputHandlerComp';
import { parseChapterFromGuessing } from '../helper/bible-helpers/serverBibleHelpers2';

async function checkNewTabInputText(
    viewController: LookupBibleItemController,
    inputText: string,
    event?: KeyboardEvent,
) {
    const editingResult = await viewController.getEditingResult(inputText);
    const { bookKey, guessingChapter, bibleItem } = editingResult.result;
    if (bibleItem === null) {
        if (bookKey !== null && guessingChapter !== null) {
            const chapter = await parseChapterFromGuessing(
                viewController.selectedBibleItem.bibleKey,
                bookKey,
                guessingChapter,
            );
            if (chapter !== null) {
                event?.stopPropagation();
                event?.preventDefault();
                return `${editingResult.oldInputText}:`;
            }
        }
    } else if (bibleItem.target.verseStart === bibleItem.target.verseEnd) {
        event?.stopPropagation();
        event?.preventDefault();
        return `${editingResult.oldInputText}-`;
    }
    return null;
}

function useTabAvailable(
    viewController: LookupBibleItemController,
    inputText: string,
) {
    const [isTabAvailable, setIsTabAvailable] = useState(false);
    useAppEffectAsync(
        async (contextMethods) => {
            const newInputText = await checkNewTabInputText(
                viewController,
                inputText,
            );
            contextMethods.setIsTabAvailable(newInputText !== null);
        },
        [viewController, inputText],
        { setIsTabAvailable },
    );
    return isTabAvailable;
}

const escapeEventMap: KeyboardEventMapper = { key: 'Escape' };
const ctrlEscapeEventMap: KeyboardEventMapper = {
    allControlKey: ['Ctrl'],
    key: 'Escape',
};
const tabEventMap: KeyboardEventMapper = { key: 'Tab' };

function genAvailableStyle(isDisabled: boolean): React.CSSProperties {
    if (!isDisabled) {
        return {};
    }
    return {
        pointerEvents: 'none',
        opacity: '0.5',
    };
}

export default function InputExtraButtonsComp() {
    const viewController = useLookupBibleItemControllerContext();
    const { inputText } = useInputTextContext();
    const isTabAvailable = useTabAvailable(viewController, inputText);
    const availableStyle = useMemo(() => {
        return genAvailableStyle(inputText === '');
    }, [inputText]);
    const extractButtonsRef = createRef<HTMLDivElement>();
    useAppEffect(() => {
        const wrapper = extractButtonsRef.current;
        const input = wrapper?.parentElement!.querySelector(
            `.${INPUT_TEXT_CLASS}`,
        ) as HTMLInputElement | null;
        if (input === null || wrapper === null) {
            return;
        }
        const inputRect = input.getBoundingClientRect();
        const parentRect = wrapper.parentElement!.getBoundingClientRect();
        wrapper.style.right = `${parentRect.right - inputRect.right + 5}px`;
        wrapper.style.zIndex = '5';
    }, []);
    const removeInputTextChunk = () => {
        const arr = inputText.split(' ').filter((str) => str !== '');
        if (arr.length === 1) {
            viewController.inputText = '';
            return;
        }
        arr.pop();
        const newInputText = arr.join(' ') + (arr.length > 0 ? ' ' : '');
        viewController.inputText = newInputText;
        setBibleLookupInputFocus();
    };
    useKeyboardRegistering(
        [escapeEventMap],
        () => {
            if (!checkIsBibleLookupInputFocused()) {
                setBibleLookupInputFocus();
                return;
            }
            removeInputTextChunk();
        },
        [inputText],
    );
    const removeInputText = () => {
        viewController.inputText = '';
        setBibleLookupInputFocus();
    };
    useKeyboardRegistering([ctrlEscapeEventMap], removeInputText, [inputText]);
    const handleTabbing = async (event?: any) => {
        const newInputText = await checkNewTabInputText(
            viewController,
            inputText,
            event,
        );
        if (newInputText === null) {
            return;
        }
        viewController.inputText = newInputText;
    };
    useKeyboardRegistering([tabEventMap], handleTabbing, []);
    return (
        <div
            ref={extractButtonsRef}
            className={
                'd-flex justify-content-end align-items-center flex-column' +
                ' h-100 custom-clear-input-wrapper'
            }
            style={{ position: 'absolute', fontSize: '12px', lineHeight: '0' }}
        >
            <i
                className="bi bi-x app-caught-hover-pointer"
                title={`\`Clear input [${toShortcutKey(ctrlEscapeEventMap)}]\``}
                style={{
                    color: 'red',
                    ...availableStyle,
                }}
                onClick={removeInputText}
            />
            <i
                className="bi bi-x app-caught-hover-pointer"
                title={`Clear input chunk [${toShortcutKey(escapeEventMap)}]`}
                style={{
                    color: 'var(--bs-danger-text-emphasis)',
                    ...availableStyle,
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    removeInputTextChunk();
                }}
            />
            <i
                className="bi bi-arrow-bar-right app-caught-hover-pointer"
                title={`Tab to complete [${toShortcutKey(tabEventMap)}]`}
                style={{
                    color: 'var(--bs-secondary-text-emphasis)',
                    ...genAvailableStyle(!isTabAvailable),
                }}
                onClick={() => {
                    handleTabbing();
                }}
            />
        </div>
    );
}
