import './ModalComp.scss';

import { PropsWithChildren, ReactNode } from 'react';

import { EventMapper, toShortcutKey } from '../event/KeyboardEventListener';

interface MyProps {
    children?: ReactNode;
}

const quittingEventMap: EventMapper = {
    allControlKey: ['Ctrl'],
    key: 'q',
};

export function ModalCloseButton({ close }: Readonly<{ close: () => void }>) {
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
                title={`Close [${toShortcutKey(quittingEventMap)}]`}
            >
                <i className="bi bi-x-lg" />
            </button>
        </div>
    );
}

export function ModalComp({ children }: PropsWithChildren<MyProps>) {
    return <div id="modal-container">{children}</div>;
}
