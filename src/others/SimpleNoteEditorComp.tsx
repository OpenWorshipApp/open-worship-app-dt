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

function blockUnload(event: BeforeUnloadEvent) {
    event.preventDefault();
    showSimpleToast(
        tran('Saving note'),
        tran('Please wait while the note is being saved.'),
    );
}

export interface SimpleNoteEditorStoreType {
    defaultText: string;
    currentText: string;
    checkCanSave: () => boolean;
    save: () => Promise<void>;
}
export default function SimpleNoteEditorComp({
    store,
    placeholder,
    isResizable,
    isInput,
}: Readonly<{
    store: SimpleNoteEditorStoreType;
    placeholder?: string;
    isResizable?: boolean;
    isInput?: boolean;
}>) {
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(5e3); // 5 seconds
    }, []);
    const [isSaved, setIsSaved] = useState(true);
    const [text, setText] = useState(store.defaultText);
    const setCurrentText1 = useCallback(
        (newText: string) => {
            store.currentText = newText;
            setIsSaved(!store.checkCanSave());
            setText(newText);
            attemptTimeout(async () => {
                await store.save();
                setIsSaved(true);
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
    const handleKeyDown = useCallback(
        async (
            event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
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
                event.preventDefault();
                await store.save();
                setIsSaved(true);
            }
        },
        [store],
    );
    const handleChanging = useCallback(
        (event: any) => {
            const value = event.target.value;
            setCurrentText1(value);
        },
        [setCurrentText1],
    );
    const handleBlur = useCallback(async () => {
        await store.save();
        setIsSaved(true);
    }, [store]);
    const style: CSSProperties = {
        outline: 'none',
        boxSizing: 'border-box',
        resize: isResizable ? 'both' : 'none',
        border: isSaved ? '2px solid transparent' : '2px solid #007bff44',
    };
    if (isInput) {
        return (
            <input
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
