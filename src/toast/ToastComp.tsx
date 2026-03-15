import './ToastComp.scss';

import { useCallback, useState } from 'react';

import { useToastSimpleShowing } from '../event/ToastEventListener';
import type { SimpleToastType } from './SimpleToastComp';
import SimpleToastComp from './SimpleToastComp';

let timeoutId: any = null;
export default function ToastComp() {
    const [simpleToast, setSimpleToast] = useState<SimpleToastType | null>(
        null,
    );
    const clearTimer = useCallback(() => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }, []);
    const initTimeout = useCallback(
        (timer: number) => {
            clearTimer();
            timeoutId = setTimeout(() => {
                timeoutId = null;
                setSimpleToast(null);
            }, timer);
        },
        [clearTimer],
    );
    const handleMouseEntering = useCallback(() => {
        clearTimer();
    }, [clearTimer]);
    const handleMouseLeaving = useCallback(() => {
        initTimeout(2e3);
    }, [initTimeout]);
    const handleClosing = useCallback(() => {
        setSimpleToast(null);
    }, []);
    useToastSimpleShowing((toast: SimpleToastType) => {
        setSimpleToast(toast);
        initTimeout(toast.timeout ?? 4e3);
    });
    if (!simpleToast) {
        return null;
    }
    return (
        <SimpleToastComp
            onMouseOver={handleMouseEntering}
            onMouseOut={handleMouseLeaving}
            onClose={handleClosing}
            toast={simpleToast}
        />
    );
}
