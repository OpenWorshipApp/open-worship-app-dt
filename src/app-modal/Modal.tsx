import './Modal.scss';

import { PropsWithChildren, ReactNode } from 'react';
import {
    EventMapper, toShortcutKey, useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { useCloseAppModal } from './LinkToAppModal';


interface MyProps {
    children?: ReactNode
}

const quittingEventMap: EventMapper = {
    allControlKey: ['Ctrl'],
    key: 'q',
};

export function useModal(isHandlingClose: boolean = true) {
    const closeModal = useCloseAppModal();
    useKeyboardRegistering([quittingEventMap], () => {
        if (isHandlingClose) {
            closeModal();
        }
    });
    function Modal({
        children,
    }: PropsWithChildren<MyProps>) {
        return (
            <div id='modal-container'>
                {children}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                }}>
                    {isHandlingClose && (
                        <button type='button'
                            onClick={() => {
                                closeModal();
                            }}
                            data-tool-tip={toShortcutKey(quittingEventMap)}
                            className='btn btn-outline-danger m-2'>
                            <i className='bi bi-x-lg' />
                        </button>
                    )}
                </div>
            </div>
        );
    }
    return {
        closeModal,
        Modal,
    };
}
