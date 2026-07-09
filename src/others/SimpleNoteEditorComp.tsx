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
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';

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
    const storeRef = useAppCurrentRef(store);
    const onEscapeRef = useAppCurrentRef(onEscape);
    const onEnterRef = useAppCurrentRef(onEnter);
    const forceSavingRef = useAppCurrentRef(forceSaving);
    const handleKeyDown = useCallback(
        async (
            event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
            if (
                onEscapeRef.current !== undefined &&
                event.key === 'Escape' &&
                !event.shiftKey &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey
            ) {
                onEscapeRef.current();
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
                if (storeRef.current.save === undefined) {
                    return;
                }
                event.preventDefault();
                const isSaved = await storeRef.current.save();
                setIsSaved(isSaved);
            }
            if (onEnterRef.current !== undefined && event.key === 'Enter') {
                forceSavingRef.current();
                onEnterRef.current();
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setCurrentText1Ref = useAppCurrentRef(setCurrentText1);
    const handleChanging = useCallback((event: any) => {
        const value = event.target.value;
        setCurrentText1Ref.current(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onBlurRef = useAppCurrentRef(onBlur);
    const handleBlur = useCallback(async () => {
        forceSavingRef.current();
        onBlurRef.current?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
