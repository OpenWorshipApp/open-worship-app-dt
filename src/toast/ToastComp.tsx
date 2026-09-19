import './ToastComp.scss';

import { useCallback, useRef, useState } from 'react';

import { useToastSimpleShowing } from '../event/ToastEventListener';
import type { SimpleToastType } from './SimpleToastComp';
import SimpleToastComp from './SimpleToastComp';

// Keep the stack bounded, a burst of toasts must not grow the DOM unbounded.
export const MAX_STACKED_TOAST_COUNT = 5;

type StackedToastType = SimpleToastType & { id: number };

export default function ToastComp() {
    const [toasts, setToasts] = useState<StackedToastType[]>([]);
    const lastIdRef = useRef(0);
    const handleClosing = useCallback((id: number) => {
        setToasts((oldToasts) => {
            return oldToasts.filter((toast) => {
                return toast.id !== id;
            });
        });
    }, []);
    useToastSimpleShowing((toast: SimpleToastType) => {
        lastIdRef.current += 1;
        const newToast = { ...toast, id: lastIdRef.current };
        setToasts((oldToasts) => {
            // newest at the bottom of the stack, oldest ones are dropped
            return [...oldToasts, newToast].slice(-MAX_STACKED_TOAST_COUNT);
        });
    });
    if (toasts.length === 0) {
        return null;
    }
    return (
        <div className="app-toast-stack">
            {toasts.map((toast) => {
                return (
                    <SimpleToastComp
                        key={toast.id}
                        toast={toast}
                        onClose={handleClosing.bind(null, toast.id)}
                    />
                );
            })}
        </div>
    );
}
