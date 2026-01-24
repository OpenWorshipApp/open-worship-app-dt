import './ToastComp.scss';

import { useState } from 'react';

import { useToastSimpleShowing } from '../event/ToastEventListener';
import type { SimpleToastType } from './SimpleToastComp';
import SimpleToastComp from './SimpleToastComp';

let timeoutId: any = null;
export default function ToastComp() {
    const handleMouseEntering = () => {
        clearTimer();
    };
    const handleMouseLeaving = () => {
        initTimeout(2e3);
    };
    const handleClosing = () => {
        setSimpleToast(null);
    };
    const [simpleToast, setSimpleToast] = useState<SimpleToastType | null>(
        null,
    );
    const clearTimer = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    const initTimeout = (timer: number) => {
        clearTimer();
        timeoutId = setTimeout(() => {
            timeoutId = null;
            setSimpleToast(null);
        }, timer);
    };
    useToastSimpleShowing((toast: SimpleToastType) => {
        setSimpleToast(toast);
        initTimeout(toast.timeout ?? 4e3);
    });
    if (!simpleToast) {
        return null;
    }
    return (
        <SimpleToastComp
            onMouseEnter={handleMouseEntering}
            onMouseLeave={handleMouseLeaving}
            onClose={handleClosing}
            toast={simpleToast}
        />
    );
}
