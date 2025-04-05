import { createContext, Fragment, use } from 'react';

import { useGetBookKVList } from '../helper/bible-helpers/serverBibleHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import BibleSelectionComp from './BibleSelectionComp';
import {
    BIBLE_LOOKUP_INPUT_ID,
    INPUT_TEXT_CLASS,
    checkIsBibleLookupInputFocused,
    focusRenderFound,
    setBibleLookupInputFocus,
} from './selectionHelpers';
import { useBibleItemPropsToInputText } from '../bible-list/bibleItemHelpers';
import { LookupBibleItemViewController } from '../bible-reader/BibleItemViewController';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';

export const InputTextContext = createContext<{
    inputText: string;
    setInputText: (text: string) => void;
} | null>(null);
export function useInputTextContext() {
    const inputTextContext = use(InputTextContext);
    if (inputTextContext === null) {
        throw new Error('InputTextContext is not provided');
    }
    return inputTextContext;
}

export function getInputTrueValue() {
    const input = document.getElementById(BIBLE_LOOKUP_INPUT_ID);
    return (input as HTMLInputElement)?.value ?? null;
}

export default function InputHandlerComp({
    onBibleKeyChange,
}: Readonly<{
    onBibleKeyChange: (oldBibleKey: string, newBibleKey: string) => void;
}>) {
    const { inputText } = useInputTextContext();
    const setInputText =
        LookupBibleItemViewController.getInstance().setInputText;
    const bibleKey = useBibleKeyContext();
    const books = useGetBookKVList(bibleKey);
    const bookKey = books === null ? null : books['GEN'];
    const placeholder = useBibleItemPropsToInputText(
        bibleKey,
        bookKey,
        1,
        1,
        2,
    );
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        () => {
            if (!checkIsBibleLookupInputFocused()) {
                setBibleLookupInputFocus();
                return;
            }
            const arr = inputText.split(' ').filter((str) => str !== '');
            if (arr.length === 1) {
                setInputText('');
                return;
            }
            arr.pop();
            setInputText(arr.join(' ') + (arr.length > 0 ? ' ' : ''));
        },
        [inputText],
    );
    return (
        <Fragment>
            <BibleSelectionComp
                bibleKey={bibleKey}
                onBibleKeyChange={onBibleKeyChange}
            />
            <input
                id={BIBLE_LOOKUP_INPUT_ID}
                type="text"
                className={`form-control ${INPUT_TEXT_CLASS}`}
                value={inputText}
                autoFocus
                placeholder={placeholder}
                onKeyUp={(event) => {
                    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
                        event.stopPropagation();
                        event.preventDefault();
                        event.currentTarget.blur();
                        focusRenderFound();
                    }
                }}
                onChange={(event) => {
                    const value = event.target.value;
                    setInputText(value);
                }}
            />
        </Fragment>
    );
}
