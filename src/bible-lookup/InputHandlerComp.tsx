import { createContext, createRef, Fragment, use } from 'react';

import BibleSelectionComp from './BibleSelectionComp';
import {
    BIBLE_LOOKUP_INPUT_ID,
    INPUT_TEXT_CLASS,
    focusRenderFound,
} from './selectionHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import { toInputText } from '../helper/bible-helpers/bibleLogicHelpers2';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { getBookKVList } from '../helper/bible-helpers/bibleInfoHelpers';
import InputExtraButtonsComp from './InputExtraButtonsComp';
import {
    BIBLE_XML_CACHE_DURATION_SEC,
    getBibleXMLDataFromKeyCaching,
} from '../setting/bible-setting/bibleXMLHelpers';

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
    useAppEffect(() => {
        const input = inputRef.current;
        const text = inputText ?? '';
        if (input && input.value !== text) {
            document.execCommand('selectAll', false);
            document.execCommand('insertText', false, text);
        }
    }, [inputText]);
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    useAppEffect(() => {
        // keep bible data in cache
        const intervalId = setInterval(
            () => {
                getBibleXMLDataFromKeyCaching(bibleKey);
            },
            (BIBLE_XML_CACHE_DURATION_SEC - 5) * 1000,
        );
        return () => {
            clearInterval(intervalId);
        };
    }, [bibleKey]);
    const [books] = useAppStateAsync(() => {
        return getBookKVList(bibleKey);
    }, [bibleKey]);
    const bookKey = books ? books['GEN'] : null;
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
                className={`form-control form-control-sm ${INPUT_TEXT_CLASS}`}
                ref={inputRef}
                data-bible-key={bibleKey}
                type="text"
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
            <button
                className="btn btn-sm btn-outline-secondary"
                data-previous-chapter-button="1"
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
                data-next-chapter-button="1"
                onClick={() => {
                    viewController.tryJumpingChapter(true);
                }}
            >
                <i className="bi bi-caret-right" />
            </button>
        </Fragment>
    );
}
