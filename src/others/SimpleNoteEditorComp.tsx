import {
    type CSSProperties,
    useCallback,
    useMemo,
    useState,
    type KeyboardEvent,
} from 'react';
import { showSimpleToast } from '../toast/toastHelpers';
import { tran } from '../lang/langHelpers';
import { checkIsKeyboardEventMatch } from '../event/KeyboardEventListener';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';

const attemptTimeout = genTimeoutAttempt(3000);
let attemptCount = 0;
function blockUnload(event: BeforeUnloadEvent) {
    attemptTimeout(() => {
        attemptCount = 0;
    });
    attemptCount++;
    if (attemptCount > 3) {
        window.removeEventListener('beforeunload', blockUnload);
        return;
    }
    event.preventDefault();
    showSimpleToast(
        tran('Saving note'),
        tran('Please wait while the note is being saved.') +
            ' ' +
            tran('Or attempt 3 times to force leaving.'),
    );
}

export interface SimpleNoteEditorStoreType {
    defaultText: string;
    currentText: string;
    checkCanSave: () => boolean;
    save?: () => Promise<boolean>;
}
export default function SimpleNoteEditorComp({
    store,
    placeholder,
    isResizable,
    isInput,
    onEscape,
    onBlur,
    onEnter,
}: Readonly<{
    store: SimpleNoteEditorStoreType;
    placeholder?: string;
    isResizable?: boolean;
    isInput?: boolean;
    onEscape?: () => void;
    onBlur?: () => void;
    onEnter?: () => void;
}>) {
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(5e3); // 5 seconds
    }, []);
    const [isSaved, setIsSaved] = useState(true);
    const [text, setText] = useState(store.defaultText);
    const setCurrentText1 = useCallback(
        (newText: string) => {
            if (store.save === undefined) {
                return;
            }
            store.currentText = newText;
            setIsSaved(!store.checkCanSave());
            setText(newText);
            attemptTimeout(async () => {
                if (store.save === undefined) {
                    return;
                }
                const isSaved = await store.save();
                setIsSaved(isSaved);
            });
        },
        [store, attemptTimeout],
    );
    useAppEffect(() => {
        window.removeEventListener('beforeunload', blockUnload);
        setText(store.defaultText);
        setIsSaved(true);
    }, [store]);
    useAppEffect(() => {
        if (isSaved) {
            return;
        }
        window.addEventListener('beforeunload', blockUnload);
        return () => {
            window.removeEventListener('beforeunload', blockUnload);
        };
    }, [isSaved]);
    const forceSaving = useCallback(async () => {
        if (store.save === undefined) {
            return;
        }
        const isSaved = await store.save();
        setIsSaved(isSaved);
    }, [store]);
    const handleKeyDown = useCallback(
        async (
            event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
            if (
                onEscape !== undefined &&
                event.key === 'Escape' &&
                !event.shiftKey &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey
            ) {
                onEscape();
                return;
            }
            if (
                checkIsKeyboardEventMatch(
                    [
                        {
                            mControlKey: ['Meta'],
                            wControlKey: ['Ctrl'],
                            lControlKey: ['Ctrl'],
                            key: 's',
                        },
                    ],
                    event,
                )
            ) {
                if (store.save === undefined) {
                    return;
                }
                event.preventDefault();
                const isSaved = await store.save();
                setIsSaved(isSaved);
            }
            if (onEnter !== undefined && event.key === 'Enter') {
                forceSaving();
                onEnter();
            }
        },
        [store, onEscape, onEnter, forceSaving],
    );
    const handleChanging = useCallback(
        (event: any) => {
            const value = event.target.value;
            setCurrentText1(value);
        },
        [setCurrentText1],
    );
    const handleBlur = useCallback(async () => {
        forceSaving();
        onBlur?.();
    }, [onBlur, forceSaving]);
    const style: CSSProperties = {
        outline: 'none',
        boxSizing: 'border-box',
        resize: isResizable ? 'both' : 'none',
        border: isSaved ? '2px solid transparent' : '2px solid #007bff44',
    };
    const isReadOnly = store.save === undefined;
    if (isInput) {
        return (
            <input
                readOnly={isReadOnly}
                className="w-100 h-100 m-0"
                placeholder={placeholder}
                style={style}
                onKeyDown={handleKeyDown}
                value={text}
                onChange={handleChanging}
                onBlur={handleBlur}
            />
        );
    }
    return (
        <textarea
            readOnly={isReadOnly}
            className="w-100 h-100 m-0"
            placeholder={placeholder}
            style={style}
            onKeyDown={handleKeyDown}
            value={text}
            onChange={handleChanging}
            onBlur={handleBlur}
        />
    );
}
