import { useCallback, useEffect, useMemo, useState } from 'react';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import { checkIsKeyboardEventMatch } from '../../event/KeyboardEventListener';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';

function blockUnload(event: BeforeUnloadEvent) {
    event.preventDefault();
    showSimpleToast(
        tran('Saving note'),
        tran('Please wait while the note is being saved.'),
    );
}

export interface DocumentNoteStoreType {
    defaultText: string;
    currentText: string;
    save: () => Promise<void>;
}
export default function SimpleNoteEditorComp({
    store,
    placeholder,
    isResizable,
}: Readonly<{
    store: DocumentNoteStoreType;
    placeholder?: string;
    isResizable?: boolean;
}>) {
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(5e3); // 5 seconds
    }, []);
    const [isSaved, setIsSaved] = useState(true);
    const [text, setText] = useState(store.defaultText);
    const setCurrentText1 = useCallback(
        (newText: string) => {
            setIsSaved(false);
            store.currentText = newText;
            setText(newText);
            attemptTimeout(async () => {
                await store.save();
                setIsSaved(true);
            });
        },
        [store, attemptTimeout],
    );
    useEffect(() => {
        window.removeEventListener('beforeunload', blockUnload);
        setText(store.defaultText);
        setIsSaved(true);
    }, [store]);
    useEffect(() => {
        if (isSaved) {
            return;
        }
        window.addEventListener('beforeunload', blockUnload);
        return () => {
            window.removeEventListener('beforeunload', blockUnload);
        };
    }, [isSaved]);
    const handleKeyDown = useCallback(
        async (event: any) => {
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
    return (
        <textarea
            className="w-100 h-100 m-0"
            placeholder={placeholder}
            style={{
                outline: 'none',
                boxSizing: 'border-box',
                padding: '0.5rem',
                resize: isResizable ? 'both' : 'none',
                border: isSaved
                    ? '1px solid transparent'
                    : '1px solid #007bff44',
            }}
            onKeyDown={handleKeyDown}
            value={text}
            onChange={(event) => {
                const value = event.target.value;
                setCurrentText1(value);
            }}
            onBlur={async () => {
                await store.save();
                setIsSaved(true);
            }}
        />
    );
}
