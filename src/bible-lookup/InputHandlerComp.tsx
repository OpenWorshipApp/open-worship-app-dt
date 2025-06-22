import { createContext, createRef, Fragment, use } from 'react';

import BibleSelectionComp from './BibleSelectionComp';
import {
    BIBLE_LOOKUP_INPUT_ID,
    INPUT_TEXT_CLASS,
    focusRenderFound,
} from './selectionHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { toInputText } from '../helper/bible-helpers/serverBibleHelpers2';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { getBookKVList } from '../helper/bible-helpers/bibleInfoHelpers';
import InputExtraButtonsComp from './InputExtraButtonsComp';

export const InputTextContext = createContext<{
    inputText: string;
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
    const inputRef = createRef<HTMLInputElement>();
    const { inputText } = useInputTextContext();
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const [books] = useAppStateAsync(() => {
        return getBookKVList(bibleKey);
    }, [bibleKey]);
    const bookKey = !books ? null : books['GEN'];
    const [placeholder] = useAppStateAsync(() => {
        return toInputText(bibleKey, bookKey, 1, 1, 2);
    });
    return (
        <Fragment>
            <BibleSelectionComp
                bibleKey={bibleKey}
                onBibleKeyChange={onBibleKeyChange}
            />
            <input
                id={BIBLE_LOOKUP_INPUT_ID}
                ref={inputRef}
                data-bible-key={bibleKey}
                type="text"
                className={`form-control ${INPUT_TEXT_CLASS}`}
                value={inputText}
                autoFocus
                placeholder={placeholder ?? ''}
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
                    viewController.inputText = value;
                }}
            />
            <InputExtraButtonsComp />
            <div className="d-flex justify-content-between h-100">
                <button
                    className="btn btn-sm btn-outline-secondary"
                    title="Previous"
                    onClick={() => {
                        viewController.tryJumpingChapter(false);
                    }}
                >
                    <i className="bi bi-caret-left" />
                </button>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    title="Next"
                    onClick={() => {
                        viewController.tryJumpingChapter(true);
                    }}
                >
                    <i className="bi bi-caret-right" />
                </button>
            </div>
        </Fragment>
    );
}
