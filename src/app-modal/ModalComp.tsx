import './ModalComp.scss';

import type { PropsWithChildren, ReactNode } from 'react';

import type { EventMapperType } from '../event/KeyboardEventListener';
import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { ModalLayerContext } from './modalLayerContext';

interface MyProps {
    children?: ReactNode;
}

const quittingEventMap: EventMapperType = {
    allControlKey: ['Ctrl'],
    key: 'q',
};

export function ModalCloseButtonComp({
    close,
}: Readonly<{ close: () => void }>) {
    useKeyboardRegistering([quittingEventMap], close, []);
    return (
        <div
            style={{
                position: 'absolute',
                right: 0,
                top: 0,
            }}
        >
            <button
                className="btn btn-danger"
                type="button"
                style={{
                    height: '38px',
                }}
                onClick={close}
                title={`${tran('Close')} [${toShortcutKey(quittingEventMap)}]`}
                aria-label={tran('Close')}
            >
                <i className="bi bi-x-lg" />
            </button>
        </div>
    );
}

export function ModalComp({ children }: PropsWithChildren<MyProps>) {
    return (
        // Anything this modal opens — a floating widget above all — has to know
        // it is on top of the modal layer so it can render ABOVE it instead of
        // being hidden behind the very thing that opened it.
        <ModalLayerContext value={true}>
            <div id="modal-container">{children}</div>
        </ModalLayerContext>
    );
}
