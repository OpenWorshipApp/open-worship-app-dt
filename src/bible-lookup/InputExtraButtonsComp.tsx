import type { CSSProperties, MouseEvent } from 'react';
import { createRef, useCallback, useState } from 'react';

import {
    checkIsBibleLookupInputFocused,
    INPUT_TEXT_CLASS,
    setBibleLookupInputFocus,
} from './selectionHelpers';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppCurrentRef,
} from '../helper/appHooks';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import type { EventMapperType as KeyboardEventMapper } from '../event/KeyboardEventListener';
import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { useInputTextContext } from './InputHandlerComp';
import { parseChapterFromGuessing } from '../helper/bible-helpers/bibleLogicHelpers2';
import { tran } from '../lang/langHelpers';

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

function genAvailableStyle(isDisabled: boolean): CSSProperties {
    if (!isDisabled) {
        return {};
    }
    return {
        pointerEvents: 'none',
        opacity: '0.5',
    };
}

/**
 * One of the icons stacked against the right edge of the lookup input.
 *
 * `role`/`tabIndex`/`aria-label` rather than a real `<button>`: these are 12px
 * glyphs in an absolutely positioned `line-height: 0` column, and a button's
 * own box would have to be unstyled back out. It is the same shape the colour
 * swatches use (`RenderColorComp`). As bare `<i>` elements they carried a
 * `title` and nothing else, so the accessibility tree showed three unnamed
 * text nodes where three controls are.
 */
function RenderInputActionIconComp({
    iconClassName,
    label,
    color,
    isDisabled,
    onActivate,
}: Readonly<{
    iconClassName: string;
    label: string;
    color: string;
    isDisabled: boolean;
    onActivate: (event: any) => void;
}>) {
    return (
        <i
            className={`${iconClassName} app-caught-hover-pointer`}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-label={label}
            aria-disabled={isDisabled || undefined}
            title={label}
            style={{ color, ...genAvailableStyle(isDisabled) }}
            onClick={onActivate}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                // Space would scroll the lookup body away from the input.
                event.preventDefault();
                onActivate(event);
            }}
        />
    );
}

export default function InputExtraButtonsComp() {
    const viewController = useLookupBibleItemControllerContext();
    const { inputText } = useInputTextContext();
    const isTabAvailable = useTabAvailable(viewController, inputText);
    const isInputEmpty = inputText === '';
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
    const viewControllerRef = useAppCurrentRef(viewController);
    const inputTextRef = useAppCurrentRef(inputText);
    const handleTabbing = useCallback(async (event?: any) => {
        const newInputText = await checkNewTabInputText(
            viewControllerRef.current,
            inputTextRef.current,
            event,
        );
        if (newInputText === null) {
            return;
        }
        viewControllerRef.current.inputText = newInputText;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useKeyboardRegistering([tabEventMap], handleTabbing, []);
    useKeyboardRegistering(
        [escapeEventMap],
        () => {
            if (checkIsBibleLookupInputFocused()) {
                removeInputTextChunk();
            } else if (
                document.activeElement instanceof HTMLInputElement ===
                false
            ) {
                setBibleLookupInputFocus();
            }
        },
        [],
    );
    useKeyboardRegistering(
        [ctrlEscapeEventMap],
        () => {
            removeInputText();
        },
        [],
    );
    const removeInputTextChunk = useCallback(() => {
        const inputText = inputTextRef.current;
        const viewController = viewControllerRef.current;
        const arr = inputText.split(' ').filter((str) => str !== '');
        if (arr.length === 1) {
            viewController.inputText = '';
            return;
        }
        arr.pop();
        const newInputText = arr.join(' ') + (arr.length > 0 ? ' ' : '');
        viewController.inputText = newInputText;
        setBibleLookupInputFocus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const removeInputText = () => {
        viewController.inputText = '';
        setBibleLookupInputFocus();
    };
    const removeInputTextChunkRef = useAppCurrentRef(removeInputTextChunk);
    const handleClearInputChunk = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        removeInputTextChunkRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            ref={extractButtonsRef}
            className={
                'd-flex justify-content-end align-items-center flex-column' +
                ' h-100 custom-clear-input-wrapper'
            }
            style={{ position: 'absolute', fontSize: '12px', lineHeight: '0' }}
        >
            <RenderInputActionIconComp
                iconClassName="bi bi-x"
                label={
                    tran('Clear input') +
                    ` [${toShortcutKey(ctrlEscapeEventMap)}]`
                }
                color="red"
                isDisabled={isInputEmpty}
                onActivate={removeInputText}
            />
            <RenderInputActionIconComp
                iconClassName="bi bi-x"
                label={
                    tran('Clear input chunk') +
                    ` [${toShortcutKey(escapeEventMap)}]`
                }
                color="var(--bs-danger-text-emphasis)"
                isDisabled={isInputEmpty}
                onActivate={handleClearInputChunk}
            />
            <RenderInputActionIconComp
                iconClassName="bi bi-arrow-bar-right"
                label={
                    tran('Tab to complete') + ` [${toShortcutKey(tabEventMap)}]`
                }
                color="var(--bs-secondary-text-emphasis)"
                isDisabled={!isTabAvailable}
                onActivate={handleTabbing}
            />
        </div>
    );
}
