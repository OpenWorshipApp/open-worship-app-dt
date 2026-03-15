import './ModalComp.scss';

import type { PropsWithChildren, ReactNode } from 'react';

import type { EventMapperType } from '../event/KeyboardEventListener';
import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';

interface MyProps {
    children?: ReactNode;
}

const quittingEventMap: EventMapperType = {
    allControlKey: ['Ctrl'],
    key: 'q',
};

export function ModalCloseButton({ close }: Readonly<{ close: () => void }>) {
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
            >
                <i className="bi bi-x-lg" />
            </button>
        </div>
    );
}

export function ModalComp({ children }: PropsWithChildren<MyProps>) {
    return <div id="modal-container">{children}</div>;
}
