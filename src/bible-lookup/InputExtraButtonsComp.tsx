import type {
    CSSProperties,
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent,
} from 'react';
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
import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import {
    lookupEscapeEventMapper,
    lookupRemoveAllEventMapper,
    lookupTabEventMapper,
} from '../keyboard-shortcut/appShortcutMappers';
import { useInputTextContext } from './InputHandlerComp';
import { genLookupTabCompletionText } from './lookupEnterHelpers';
import { tran } from '../lang/langHelpers';

function useTabAvailable(
    viewController: LookupBibleItemController,
    inputText: string,
) {
    const [isTabAvailable, setIsTabAvailable] = useState(false);
    useAppEffectAsync(
        async (contextMethods) => {
            const editingResult =
                await viewController.getEditingResult(inputText);
            const newInputText = await genLookupTabCompletionText(
                editingResult.bibleKey,
                editingResult,
            );
            contextMethods.setIsTabAvailable(newInputText !== null);
        },
        [viewController, inputText],
        { setIsTabAvailable },
    );
    return isTabAvailable;
}

const escapeEventMap = lookupEscapeEventMapper;
const removeAllEventMap = lookupRemoveAllEventMapper;
const tabEventMap = lookupTabEventMapper;

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
    const handleTabbing = useCallback(async () => {
        const inputText = inputTextRef.current;
        const editingResult =
            await viewControllerRef.current.getEditingResult(inputText);
        const newInputText = await genLookupTabCompletionText(
            editingResult.bibleKey,
            editingResult,
        );
        // Typed on while this was worked out: the press belonged to a text
        // the box no longer holds.
        if (newInputText === null || inputTextRef.current !== inputText) {
            return;
        }
        viewControllerRef.current.inputText = newInputText;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTabbingRef = useAppCurrentRef(handleTabbing);
    // Tab is registered on the whole document, so this hears it wherever focus
    // is. Only the reference box completes: Tab on a saved passage's version
    // button is the browser moving focus, and it used to pull focus into the
    // box and widen `John 3:16` to `John 3:16-` instead. With the box focused
    // Tab is its autocomplete and NEVER leaves it, even with nothing to
    // complete: blurring mid-typing is the last thing someone reaching for
    // autocomplete wants. Shift+Tab is a different event key and still
    // navigates backward, so a keyboard user is not trapped in the box.
    const handleTabKey = useCallback(
        (event: KeyboardEvent | ReactKeyboardEvent<any>) => {
            if (!checkIsBibleLookupInputFocused()) {
                return;
            }
            // Before any await: the focus move is the keydown's default
            // action and runs once dispatch ends, so a `preventDefault` that
            // waits for the lookup arrives after focus has already left.
            event.preventDefault();
            event.stopPropagation();
            handleTabbingRef.current();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    useKeyboardRegistering([tabEventMap], handleTabKey, []);
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
        [removeAllEventMap],
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
                    ` [${toShortcutKey(removeAllEventMap)}]`
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
